import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
	await readFile(path.join(root, 'migrations/001-normalized-carpool.json'), 'utf8')
);
const identityManifest = JSON.parse(
	await readFile(path.join(root, 'migrations/003-wordpress-identity.json'), 'utf8')
);
const manifests = [
	manifest,
	{ collections: [{ name: identityManifest.collection, fields: identityManifest.fields }] }
];
const sqlMigrations = [
	{ version: '001-normalized-carpool', filename: '001-normalized-carpool.sql' },
	{ version: '002-demo-carpool', filename: '002-demo-carpool.sql' },
	{ version: '003-wordpress-identity', filename: '003-wordpress-identity.sql' },
	{ version: '004-user-lifecycle', filename: '004-user-lifecycle.sql' }
];

const baseUrl = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');

async function login() {
	const response = await fetch(`${baseUrl}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: process.env.DIRECTUS_ADMIN_EMAIL,
			password: process.env.DIRECTUS_ADMIN_PASSWORD
		})
	});
	if (!response.ok) throw new Error(`Directus login failed with HTTP ${response.status}`);
	const body = await response.json();
	return body.data.access_token;
}

const token = await login();

async function request(pathname, options = {}) {
	const response = await fetch(`${baseUrl}${pathname}`, {
		...options,
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${token}`,
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...(options.headers ?? {})
		}
	});
	const text = await response.text();
	const body = text ? JSON.parse(text) : null;
	if (!response.ok) {
		throw new Error(
			`${options.method ?? 'GET'} ${pathname} failed with HTTP ${response.status}: ${text}`
		);
	}
	return body?.data ?? body;
}

function fieldSchema(field) {
	return {
		is_primary_key: field.primaryKey ?? false,
		has_auto_increment: field.autoIncrement ?? false,
		is_nullable: !(field.required ?? false),
		...(field.maxLength ? { max_length: field.maxLength } : {})
	};
}

function fieldMeta(field) {
	return {
		interface: field.interface ?? (field.type === 'text' ? 'input-multiline' : 'input'),
		...(field.required ? { required: true } : {})
	};
}

const existingCollections = new Map(
	(await request('/collections')).map((collection) => [collection.collection, collection])
);

for (const schemaManifest of manifests) {
	for (const collection of schemaManifest.collections) {
		if (!existingCollections.has(collection.name)) {
			await request('/collections', {
				method: 'POST',
				body: JSON.stringify({
					collection: collection.name,
					meta: { hidden: false, singleton: false, note: collection.note },
					schema: {}
				})
			});
			console.log(`created collection ${collection.name}`);
		} else {
			console.log(`verified collection ${collection.name}`);
		}

		const existingFields = new Map(
			(await request(`/fields/${collection.name}`)).map((field) => [field.field, field])
		);
		for (const field of collection.fields) {
			if (existingFields.has(field.field)) {
				const actual = existingFields.get(field.field);
				if (actual.type !== field.type) {
					throw new Error(
						`Field ${collection.name}.${field.field} has type ${actual.type}, expected ${field.type}`
					);
				}
				const desiredMeta = fieldMeta(field);
				const actualMeta = actual.meta ?? {};
				const metadataNeedsUpdate = Object.entries(desiredMeta).some(
					([key, value]) => actualMeta[key] !== value
				);
				if (metadataNeedsUpdate) {
					await request(`/fields/${collection.name}/${field.field}`, {
						method: 'PATCH',
						body: JSON.stringify({ meta: { ...actualMeta, ...desiredMeta } })
					});
					console.log(`updated field metadata ${collection.name}.${field.field}`);
				}
				continue;
			}
			await request(`/fields/${collection.name}`, {
				method: 'POST',
				body: JSON.stringify({
					field: field.field,
					type: field.type,
					schema: fieldSchema(field),
					meta: fieldMeta(field)
				})
			});
			console.log(`created field ${collection.name}.${field.field}`);
		}
	}
}

const relations = await request('/relations');
for (const relation of manifest.relations) {
	const exists = relations.some(
		(candidate) =>
			candidate.collection === relation.collection && candidate.field === relation.field
	);
	if (exists) {
		console.log(`verified relation ${relation.collection}.${relation.field}`);
		continue;
	}
	await request('/relations', {
		method: 'POST',
		body: JSON.stringify({
			collection: relation.collection,
			field: relation.field,
			related_collection: relation.relatedCollection,
			schema: { on_delete: relation.onDelete },
			meta: { one_field: null }
		})
	});
	console.log(`created relation ${relation.collection}.${relation.field}`);
}

for (const migration of sqlMigrations) {
	const sql = await readFile(path.join(root, 'migrations', migration.filename), 'utf8');
	await new Promise((resolve, reject) => {
		const child = spawn(
			'docker',
			[
				'compose',
				'exec',
				'-T',
				'postgres',
				'psql',
				'-v',
				'ON_ERROR_STOP=1',
				'-U',
				process.env.POSTGRES_USER ?? 'directus',
				'-d',
				process.env.POSTGRES_DB ?? 'directus'
			],
			{ cwd: root, stdio: ['pipe', 'inherit', 'inherit'] }
		);
		child.on('error', reject);
		child.on('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`psql exited with ${code}`))
		);
		child.stdin.end(sql);
	});
	console.log(`applied ${migration.version}`);
}
