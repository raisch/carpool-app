import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const reportDirectory = path.join(root, '.release-verification');
const reportPath = path.join(reportDirectory, 'last-run.json');
const checks = [
	{ name: 'typecheck', command: 'pnpm', args: ['check'] },
	{ name: 'lint', command: 'pnpm', args: ['lint'] },
	{ name: 'unit-tests', command: 'pnpm', args: ['test:unit', '--', '--run'] },
	{ name: 'production-build', command: 'pnpm', args: ['build'] },
	{ name: 'wordpress-release-config', command: 'pnpm', args: ['wordpress:release:test'] },
	{ name: 'wordpress-plugin-contract', command: 'pnpm', args: ['wordpress:plugin:test'] },
	{ name: 'route-acceptance', command: 'pnpm', args: ['exec', 'playwright', 'test'] },
	{ name: 'migration-apply', command: 'pnpm', args: ['directus:migrate'] },
	{ name: 'migration-contract', command: 'pnpm', args: ['directus:test'] },
	{ name: 'milestone-3-live', command: 'pnpm', args: ['directus:test:m3'] },
	{ name: 'milestone-4-live', command: 'pnpm', args: ['directus:test:m4'] },
	{ name: 'milestone-5-live', command: 'pnpm', args: ['directus:test:m5'] }
];

function runCheck(check) {
	return new Promise((resolve) => {
		const startedAt = new Date().toISOString();
		console.log(`\n[release] ${check.name}: ${check.command} ${check.args.join(' ')}`);
		const child = spawn(check.command, check.args, {
			cwd: root,
			stdio: 'inherit',
			env: { ...process.env, CI: '1' }
		});
		child.on('error', (error) =>
			resolve({
				...check,
				status: 'failed',
				startedAt,
				finishedAt: new Date().toISOString(),
				exitCode: null,
				error: error.message
			})
		);
		child.on('exit', (code, signal) =>
			resolve({
				...check,
				status: code === 0 ? 'passed' : 'failed',
				startedAt,
				finishedAt: new Date().toISOString(),
				exitCode: code,
				signal: signal ?? null
			})
		);
	});
}

const results = [];
for (const check of checks) {
	const result = await runCheck(check);
	results.push(result);
	if (result.status === 'failed') break;
}

const report = {
	version: 1,
	completedAt: new Date().toISOString(),
	status: results.every((result) => result.status === 'passed') ? 'passed' : 'failed',
	checks: results
};
await mkdir(reportDirectory, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
	`\n[release] ${report.status.toUpperCase()}: ${results.length}/${checks.length} checks completed`
);
console.log(`[release] report: ${path.relative(root, reportPath)}`);
if (report.status !== 'passed') process.exitCode = 1;
