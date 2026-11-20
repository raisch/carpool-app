import { expect, test } from '@playwright/test';

test('has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Carpool events', level: 1 })).toBeVisible();
	await expect(page.getByRole('status')).toContainText(
		/Identity integration pending|Sign-in required/
	);
});

test('event route presents a backend error state when the repository is unavailable', async ({
	page
}) => {
	await page.goto('/events/example-event');
	await expect(page.getByRole('heading', { name: 'Event transportation', level: 1 })).toBeVisible();
	await expect(page.getByRole('alert')).toContainText('We couldn’t load carpool data');
});

test('branded shell keeps the navbar scoped and keyboard navigable', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByAltText('LigerBots', { exact: true })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Ligerbots external links' })).toBeVisible();
	await expect(page.getByRole('contentinfo')).toBeVisible();

	const skipLink = page.getByRole('link', { name: 'Skip to main content' });
	await skipLink.focus();
	await expect(skipLink).toBeFocused();

	await page.setViewportSize({ width: 390, height: 844 });
	const menu = page.getByRole('button', { name: 'Open navigation menu' });
	await expect(menu).toBeVisible();
	await menu.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
});
