import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'NODE_ENV=development pnpm build && NODE_ENV=development pnpm preview',
		port: 4173
	},
	testMatch: '**/*.e2e.{ts,js}',
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
		{ name: 'firefox', use: { browserName: 'firefox' } },
		{ name: 'webkit', use: { browserName: 'webkit' } }
	]
});
