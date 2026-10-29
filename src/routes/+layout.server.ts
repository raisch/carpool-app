import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ setHeaders, locals }) => {
	setHeaders({ 'cache-control': 'no-store' });

	const configuredSimulatorUrl = process.env.WORDPRESS_SIMULATOR_URL?.trim();
	const simulatorUrl =
		configuredSimulatorUrl ||
		(process.env.NODE_ENV === 'production' ? null : 'http://localhost:8080/');

	return { identity: locals.identity, simulatorUrl };
};
