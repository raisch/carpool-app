const directionTables = {
	outbound: 'outbound_trips',
	return: 'return_trips'
};

function endpointError(status, code, message) {
	const error = new Error(message);
	error.status = status;
	error.code = code;
	return error;
}

function integerId(value, field) {
	const id = Number(value);
	if (!Number.isInteger(id) || id < 1) {
		throw endpointError(400, 'invalid_request', `${field} must be a positive integer`);
	}
	return id;
}

function choice(value, direction) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw endpointError(400, 'invalid_request', `${direction} decision is required`);
	}
	if (value.decision === 'opt_out') {
		if (value.tripRideId !== undefined && value.tripRideId !== null) {
			throw endpointError(400, 'invalid_request', `${direction} opt-out cannot include a ride`);
		}
		return { decision: 'opt_out', tripRideId: null };
	}
	if (value.decision !== 'ride') {
		throw endpointError(400, 'invalid_request', `${direction} decision is invalid`);
	}
	return { decision: 'ride', tripRideId: integerId(value.tripRideId, `${direction}.tripRideId`) };
}

function isoTimestamp(value) {
	if (!value) return null;
	const timestamp = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(timestamp.getTime())) return null;
	return timestamp.toISOString();
}

function latestTimestamp(decisions) {
	return (
		decisions
			.map((decision) => isoTimestamp(decision.updated_at))
			.filter(Boolean)
			.sort()
			.at(-1) ?? null
	);
}

function decisionDto(decision) {
	return {
		id: String(decision.id),
		eventId: String(decision.event_id),
		userId: String(decision.user_id),
		direction: decision.direction,
		decision: decision.decision,
		tripRideId: decision.trip_ride_id === null ? null : String(decision.trip_ride_id),
		updatedAt: isoTimestamp(decision.updated_at)
	};
}

async function publishedRides(trx, eventId, direction) {
	return trx('trip_rides as ride')
		.join(`${directionTables[direction]} as trip`, 'trip.id', 'ride.trip_id')
		.join('vehicles as vehicle', 'vehicle.id', 'ride.vehicle_id')
		.where('trip.event_id', eventId)
		.where('trip.status', 'published')
		.where('vehicle.status', 'published')
		.select('ride.id', 'ride.trip_id', 'ride.vehicle_id', 'vehicle.seats')
		.forUpdate();
}

async function riderCounts(trx, rideIds) {
	if (rideIds.length === 0) return new Map();
	const rows = await trx('trip_ride_riders')
		.whereIn('trip_ride_id', rideIds)
		.select('trip_ride_id')
		.count({ count: 'id' })
		.groupBy('trip_ride_id');
	return new Map(rows.map((row) => [Number(row.trip_ride_id), Number(row.count)]));
}

async function replaceTransportation(database, body) {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw endpointError(400, 'invalid_request', 'A JSON object is required');
	}

	const eventId = integerId(body.eventId, 'eventId');
	const userId = integerId(body.userId, 'userId');
	const outbound = choice(body.outbound, 'outbound');
	const returning = choice(body.return, 'return');
	const expectedUpdatedAt = body.expectedUpdatedAt;
	if (
		expectedUpdatedAt !== undefined &&
		expectedUpdatedAt !== null &&
		!isoTimestamp(expectedUpdatedAt)
	) {
		throw endpointError(
			400,
			'invalid_request',
			'expectedUpdatedAt must be an ISO timestamp or null'
		);
	}

	return database.transaction(async (trx) => {
		const event = await trx('events').where({ id: eventId, status: 'published' }).first('id');
		if (!event) throw endpointError(404, 'not_found', 'Published event was not found');

		const currentDecisions = await trx('transportation_decisions')
			.where({ event_id: eventId, user_id: userId })
			.select('*');
		const currentVersion = latestTimestamp(currentDecisions);
		if (expectedUpdatedAt !== undefined && isoTimestamp(expectedUpdatedAt) !== currentVersion) {
			throw endpointError(
				409,
				'transportation_conflict',
				'This transportation status changed elsewhere. Refresh the event and try again.'
			);
		}

		const ridesByDirection = {
			outbound: await publishedRides(trx, eventId, 'outbound'),
			return: await publishedRides(trx, eventId, 'return')
		};
		const allRides = [...ridesByDirection.outbound, ...ridesByDirection.return];
		const allRideIds = allRides.map((ride) => Number(ride.id));
		const counts = await riderCounts(trx, allRideIds);
		const existingRiderRows = allRideIds.length
			? await trx('trip_ride_riders')
					.whereIn('trip_ride_id', allRideIds)
					.andWhere('user_id', userId)
			: [];
		const existingRides = new Set(existingRiderRows.map((row) => Number(row.trip_ride_id)));

		for (const [direction, selected] of Object.entries({ outbound, return: returning })) {
			if (selected.decision === 'opt_out') continue;
			const selectedRide = ridesByDirection[direction].find(
				(ride) => Number(ride.id) === selected.tripRideId
			);
			if (!selectedRide) {
				throw endpointError(
					409,
					'transportation_conflict',
					`The selected ${direction} ride is no longer available.`
				);
			}
			const occupied = counts.get(Number(selectedRide.id)) ?? 0;
			if (occupied >= Number(selectedRide.seats) && !existingRides.has(Number(selectedRide.id))) {
				throw endpointError(
					409,
					'transportation_conflict',
					`The selected ${direction} vehicle is full.`
				);
			}
		}

		await trx('transportation_decisions').where({ event_id: eventId, user_id: userId }).del();
		if (allRideIds.length > 0) {
			await trx('trip_ride_riders')
				.whereIn('trip_ride_id', allRideIds)
				.andWhere('user_id', userId)
				.del();
		}

		const updatedAt = new Date().toISOString();
		await trx('transportation_decisions').insert([
			{
				event_id: eventId,
				user_id: userId,
				direction: 'outbound',
				decision: outbound.decision,
				trip_ride_id: outbound.tripRideId,
				updated_at: updatedAt
			},
			{
				event_id: eventId,
				user_id: userId,
				direction: 'return',
				decision: returning.decision,
				trip_ride_id: returning.tripRideId,
				updated_at: updatedAt
			}
		]);

		const selectedRideIds = [outbound.tripRideId, returning.tripRideId].filter(Boolean);
		if (selectedRideIds.length > 0) {
			await trx('trip_ride_riders').insert(
				selectedRideIds.map((tripRideId) => ({ trip_ride_id: tripRideId, user_id: userId }))
			);
		}

		const decisions = await trx('transportation_decisions')
			.where({ event_id: eventId, user_id: userId })
			.select('*');
		const newCounts = await riderCounts(trx, allRideIds);
		return {
			eventId: String(eventId),
			outbound: decisions.find((decision) => decision.direction === 'outbound')
				? decisionDto(decisions.find((decision) => decision.direction === 'outbound'))
				: null,
			return: decisions.find((decision) => decision.direction === 'return')
				? decisionDto(decisions.find((decision) => decision.direction === 'return'))
				: null,
			remainingSeats: allRides.map((ride) => ({
				tripRideId: String(ride.id),
				remainingSeats: Math.max(0, Number(ride.seats) - (newCounts.get(Number(ride.id)) ?? 0))
			}))
		};
	});
}

export default {
	id: 'carpool',
	handler: (router, { database, logger }) => {
		router.put('/transportation', async (req, res) => {
			try {
				const status = await replaceTransportation(database, req.body);
				res.json({ data: status });
			} catch (error) {
				const status = Number.isInteger(error?.status) ? error.status : 500;
				if (status >= 500) logger.error(error);
				res.status(status).json({
					errors: [
						{ message: error.message, extensions: { code: error.code ?? 'INTERNAL_SERVER_ERROR' } }
					]
				});
			}
		});
	}
};
