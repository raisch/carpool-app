import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

function routeFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return routeFiles(path);
		return statSync(path).isFile() ? [path] : [];
	});
}

describe('Milestone 1 route boundary', () => {
	it('does not introduce legacy authentication or CMS routes', () => {
		const routesDirectory = join(process.cwd(), 'src/routes');
		const forbiddenSegments = /(^|[/\\])(login|signup|password|jwt|cms)([/\\]|$)/i;
		const routes = routeFiles(routesDirectory).map((path) => relative(routesDirectory, path));

		expect(routes.some((route) => forbiddenSegments.test(route))).toBe(false);
	});
});
