import {
	CARPOOL_COLLECTIONS,
	CARPOOL_FIELD_ALLOWLISTS,
	type CarpoolCollection
} from '../collections';
import type { TransportationUpdateInput } from '#lib/domain/types';
import type { Role, UserAdminMutationInput } from '#lib/domain/types';
import { BackendUnavailableError } from '../errors';

export type DirectusFilterOperator = '_eq' | '_in';

export interface DirectusFilter {
	field: string;
	operator: DirectusFilterOperator;
	value: string | readonly string[];
}

export interface DirectusReadQuery {
	fields?: readonly string[];
	filters?: readonly DirectusFilter[];
	sort?: readonly string[];
	limit?: number;
}

export interface DirectusClient {
	readItems(collection: CarpoolCollection, query?: DirectusReadQuery): Promise<unknown[]>;
	createItem(collection: CarpoolCollection, data: DirectusWriteData): Promise<unknown>;
	updateItem(collection: CarpoolCollection, id: string, data: DirectusWriteData): Promise<unknown>;
	deleteItem(collection: CarpoolCollection, id: string): Promise<void>;
	updateCarpoolUser(userId: string, input: UserAdminMutationInput): Promise<unknown>;
	upsertWordPressUser(input: ProvisionedWordPressUser): Promise<ProvisionedCarpoolUser>;
	replaceTransportation(
		eventId: string,
		userId: string,
		input: TransportationUpdateInput
	): Promise<void>;
}

export interface ProvisionedWordPressUser {
	sourceSystem: 'wordpress';
	sourceUid: string;
	firstName: string;
	lastName: string;
	email: string;
	telephone: string | null;
}

export interface ProvisionedCarpoolUser {
	id: string;
	role: Role;
	status: 'active' | 'inactive';
}

export type DirectusWriteValue = string | number | null;
export type DirectusWriteData = Record<string, DirectusWriteValue>;

export interface DirectusClientOptions {
	baseUrl: string;
	token: string;
	fetch?: typeof globalThis.fetch;
}

export class DirectusBoundaryError extends Error {
	readonly code = 'directus_boundary_violation';
	readonly status = 400;

	constructor(message: string) {
		super(message);
		this.name = 'DirectusBoundaryError';
	}
}

export class DirectusRequestError extends BackendUnavailableError {
	readonly status: number;
	readonly directusStatus: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'DirectusRequestError';
		this.status = status;
		this.directusStatus = status;
	}
}

const collectionKeys = new Set(Object.values(CARPOOL_COLLECTIONS));
const operators = new Set<DirectusFilterOperator>(['_eq', '_in']);
const writableCollections = new Set<CarpoolCollection>([
	CARPOOL_COLLECTIONS.events,
	CARPOOL_COLLECTIONS.outboundTrips,
	CARPOOL_COLLECTIONS.returnTrips,
	CARPOOL_COLLECTIONS.vehicles,
	CARPOOL_COLLECTIONS.tripRides,
	CARPOOL_COLLECTIONS.tripRideRiders
]);
const provisionedUserFields = new Set([
	'display_name',
	'role',
	'status',
	'source_system',
	'source_uid',
	'first_name',
	'last_name',
	'email',
	'telephone'
]);

function isCollection(value: string): value is CarpoolCollection {
	return collectionKeys.has(value as CarpoolCollection);
}

function fieldsFor(collection: CarpoolCollection): readonly string[] {
	const key = (
		Object.entries(CARPOOL_COLLECTIONS) as [keyof typeof CARPOOL_COLLECTIONS, string][]
	).find(([, value]) => value === collection)?.[0];

	if (!key) throw new DirectusBoundaryError(`Collection ${collection} is not configured`);
	return CARPOOL_FIELD_ALLOWLISTS[key];
}

function validateQuery(collection: CarpoolCollection, query: DirectusReadQuery): readonly string[] {
	const allowedFields = fieldsFor(collection);
	const fields = query.fields ?? allowedFields;
	const allowed = new Set(allowedFields);

	for (const field of fields) {
		if (!allowed.has(field)) {
			throw new DirectusBoundaryError(`Field ${field} is not allowed for ${collection}`);
		}
	}

	for (const filter of query.filters ?? []) {
		if (!allowed.has(filter.field)) {
			throw new DirectusBoundaryError(
				`Filter field ${filter.field} is not allowed for ${collection}`
			);
		}
		if (!operators.has(filter.operator)) {
			throw new DirectusBoundaryError(`Filter operator ${filter.operator} is not allowed`);
		}
		if (filter.operator === '_in' && !Array.isArray(filter.value)) {
			throw new DirectusBoundaryError(`The ${filter.operator} filter requires an array`);
		}
		if (filter.operator === '_eq' && Array.isArray(filter.value)) {
			throw new DirectusBoundaryError(`The ${filter.operator} filter requires one value`);
		}
	}

	for (const sortField of query.sort ?? []) {
		const field = sortField.startsWith('-') ? sortField.slice(1) : sortField;
		if (!allowed.has(field)) {
			throw new DirectusBoundaryError(`Sort field ${field} is not allowed for ${collection}`);
		}
	}

	if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1)) {
		throw new DirectusBoundaryError('Directus query limit must be a positive integer');
	}

	return fields;
}

function validateWrite(collection: CarpoolCollection, data: DirectusWriteData): void {
	if (!writableCollections.has(collection)) {
		throw new DirectusBoundaryError(`Writes to ${collection} are not allowed`);
	}
	const allowed = new Set(fieldsFor(collection));
	for (const field of Object.keys(data)) {
		if (field === 'id' || !allowed.has(field)) {
			throw new DirectusBoundaryError(`Field ${field} cannot be written to ${collection}`);
		}
	}
}

function appendQuery(url: URL, query: DirectusReadQuery, fields: readonly string[]): void {
	url.searchParams.set('fields', fields.join(','));
	for (const filter of query.filters ?? []) {
		const values = typeof filter.value === 'string' ? filter.value : filter.value.join(',');
		url.searchParams.set(`filter[${filter.field}][${filter.operator}]`, values);
	}
	if (query.sort?.length) url.searchParams.set('sort', query.sort.join(','));
	if (query.limit !== undefined) url.searchParams.set('limit', String(query.limit));
}

export class ConstrainedDirectusClient implements DirectusClient {
	private readonly request: typeof globalThis.fetch;
	private readonly baseUrl: string;

	constructor(options: DirectusClientOptions) {
		if (!options.baseUrl.trim()) throw new DirectusBoundaryError('Directus URL is required');
		if (!options.token.trim()) throw new DirectusBoundaryError('Directus token is required');

		this.baseUrl = options.baseUrl.replace(/\/$/, '');
		this.token = options.token;
		this.request = options.fetch ?? globalThis.fetch;
	}

	async readItems(
		collection: CarpoolCollection,
		query: DirectusReadQuery = {}
	): Promise<unknown[]> {
		if (!isCollection(collection)) {
			throw new DirectusBoundaryError(`Collection ${collection} is not allowed`);
		}

		const fields = validateQuery(collection, query);
		const url = new URL(`${this.baseUrl}/items/${collection}`);
		appendQuery(url, query, fields);

		let response: Response;
		try {
			response = await this.request(url, {
				headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` }
			});
		} catch (error) {
			throw new DirectusRequestError(
				502,
				`Directus request failed: ${error instanceof Error ? error.message : 'unknown network error'}`
			);
		}

		if (!response.ok) {
			throw new DirectusRequestError(
				response.status,
				`Directus returned ${response.status} while reading ${collection}`
			);
		}

		const body: unknown = await response.json();
		if (
			typeof body !== 'object' ||
			body === null ||
			!('data' in body) ||
			!Array.isArray(body.data)
		) {
			throw new DirectusRequestError(502, `Directus returned an invalid ${collection} response`);
		}

		return body.data;
	}

	private async write(
		method: 'POST' | 'PATCH' | 'DELETE',
		collection: CarpoolCollection,
		id?: string,
		data?: DirectusWriteData
	): Promise<unknown> {
		if (data) validateWrite(collection, data);
		const url = new URL(`${this.baseUrl}/items/${collection}${id ? `/${id}` : ''}`);
		let response: Response;
		try {
			response = await this.request(url, {
				method,
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${this.token}`,
					...(data ? { 'Content-Type': 'application/json' } : {})
				},
				...(data ? { body: JSON.stringify(data) } : {})
			});
		} catch (error) {
			throw new DirectusRequestError(
				502,
				`Directus request failed: ${error instanceof Error ? error.message : 'unknown network error'}`
			);
		}
		if (!response.ok) {
			throw new DirectusRequestError(
				response.status,
				`Directus returned ${response.status} while writing ${collection}`
			);
		}
		if (method === 'DELETE' || response.status === 204) return null;
		const body: unknown = await response.json();
		if (typeof body !== 'object' || body === null || !('data' in body)) {
			throw new DirectusRequestError(502, `Directus returned an invalid ${collection} response`);
		}
		return body.data;
	}

	private async writeProvisionedUser(
		method: 'POST' | 'PATCH',
		id: string | undefined,
		data: DirectusWriteData
	): Promise<unknown> {
		for (const field of Object.keys(data)) {
			if (!provisionedUserFields.has(field)) {
				throw new DirectusBoundaryError(`Field ${field} cannot be written during provisioning`);
			}
		}
		const url = new URL(`${this.baseUrl}/items/${CARPOOL_COLLECTIONS.users}${id ? `/${id}` : ''}`);
		let response: Response;
		try {
			response = await this.request(url, {
				method,
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${this.token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			});
		} catch (error) {
			throw new DirectusRequestError(
				502,
				`Directus request failed: ${error instanceof Error ? error.message : 'unknown network error'}`
			);
		}
		if (!response.ok) {
			throw new DirectusRequestError(
				response.status,
				`Directus returned ${response.status} while provisioning a user`
			);
		}
		const body: unknown = await response.json();
		if (typeof body !== 'object' || body === null || !('data' in body)) {
			throw new DirectusRequestError(502, 'Directus returned an invalid provisioning response');
		}
		return body.data;
	}

	async upsertWordPressUser(input: ProvisionedWordPressUser): Promise<ProvisionedCarpoolUser> {
		const existing = await this.readItems(CARPOOL_COLLECTIONS.users, {
			fields: ['id', 'role', 'status'],
			filters: [
				{ field: 'source_system', operator: '_eq', value: input.sourceSystem },
				{ field: 'source_uid', operator: '_eq', value: input.sourceUid }
			],
			limit: 1
		});
		const data: DirectusWriteData = {
			display_name: `${input.firstName} ${input.lastName}`,
			source_system: input.sourceSystem,
			source_uid: input.sourceUid,
			first_name: input.firstName,
			last_name: input.lastName,
			email: input.email,
			telephone: input.telephone
		};
		const value = existing[0]
			? await this.writeProvisionedUser(
					'PATCH',
					String((existing[0] as Record<string, unknown>).id),
					data
				)
			: await this.writeProvisionedUser('POST', undefined, {
					...data,
					role: 'rider',
					status: 'active'
				});
		if (typeof value !== 'object' || value === null) {
			throw new DirectusRequestError(502, 'Directus returned an invalid provisioned user');
		}
		const record = value as Record<string, unknown>;
		const id = record.id;
		const role = record.role;
		const status = record.status;
		if (
			(typeof id !== 'string' && typeof id !== 'number') ||
			!['rider', 'driver', 'admin'].includes(String(role)) ||
			!['active', 'inactive'].includes(String(status))
		) {
			throw new DirectusRequestError(502, 'Directus returned an invalid provisioned identity');
		}
		return { id: String(id), role: role as Role, status: status as 'active' | 'inactive' };
	}

	async updateCarpoolUser(userId: string, input: UserAdminMutationInput): Promise<unknown> {
		if (!userId.trim()) throw new DirectusBoundaryError('A user ID is required');
		if (!['rider', 'driver', 'admin'].includes(input.role)) {
			throw new DirectusBoundaryError('User role is invalid');
		}
		if (!['active', 'inactive'].includes(input.status)) {
			throw new DirectusBoundaryError('User status is invalid');
		}
		return this.writeProvisionedUser('PATCH', userId, {
			role: input.role,
			status: input.status
		});
	}

	createItem(collection: CarpoolCollection, data: DirectusWriteData): Promise<unknown> {
		return this.write('POST', collection, undefined, data);
	}

	updateItem(collection: CarpoolCollection, id: string, data: DirectusWriteData): Promise<unknown> {
		return this.write('PATCH', collection, id, data);
	}

	async deleteItem(collection: CarpoolCollection, id: string): Promise<void> {
		await this.write('DELETE', collection, id);
	}

	async replaceTransportation(
		eventId: string,
		userId: string,
		input: TransportationUpdateInput
	): Promise<void> {
		const url = new URL(`${this.baseUrl}/carpool/transportation`);
		let response: Response;
		try {
			response = await this.request(url, {
				method: 'PUT',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.token}`
				},
				body: JSON.stringify({ eventId, userId, ...input })
			});
		} catch (error) {
			throw new DirectusRequestError(
				502,
				`Directus transportation request failed: ${error instanceof Error ? error.message : 'unknown network error'}`
			);
		}

		if (!response.ok) {
			throw new DirectusRequestError(
				response.status,
				`Directus returned ${response.status} while saving transportation`
			);
		}
	}

	private readonly token: string;
}

export function createDirectusClient(): ConstrainedDirectusClient | null {
	// This module lives below src/lib/server, so process.env is never bundled
	// into browser code. Keeping configuration lookup here also makes the
	// repository usable by adapter-node without a client-visible env module.
	const baseUrl = process.env.DIRECTUS_URL?.trim();
	const token = process.env.DIRECTUS_TOKEN?.trim();
	if (!baseUrl || !token) return null;
	return new ConstrainedDirectusClient({ baseUrl, token });
}
