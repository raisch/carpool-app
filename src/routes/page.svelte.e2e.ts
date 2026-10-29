import { expect, test } from '@playwright/test';

test('has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Carpool events', level: 1 })).toBeVisible();
	await expect(page.getByRole('status')).toContainText('Identity integration pending');
});

test('event route presents a backend error state when the repository is unavailable', async ({
	page
}) => {
	await page.goto('/events/example-event');
	await expect(page.getByRole('heading', { name: 'Event transportation', level: 1 })).toBeVisible();
	await expect(page.getByRole('alert')).toContainText('We couldn’t load carpool data');
});
