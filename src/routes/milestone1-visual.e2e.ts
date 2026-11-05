import { expect, test } from '@playwright/test';

test.describe('Branded shell visual baseline', () => {
	test('landing page at approved widths', async ({ page }) => {
		for (const [label, width, height] of [
			['desktop', 1440, 900],
			['mobile', 390, 844]
		] as const) {
			await page.setViewportSize({ width, height });
			await page.goto('/');
			await expect(page).toHaveScreenshot(`milestone1-home-${label}.png`, {
				fullPage: true
			});
		}
	});

	test('event error state at approved widths', async ({ page }) => {
		for (const [label, width, height] of [
			['desktop', 1440, 900],
			['mobile', 390, 844]
		] as const) {
			await page.setViewportSize({ width, height });
			await page.goto('/events/example-event');
			await expect(page.getByRole('alert')).toContainText('We couldn’t load carpool data');
			await expect(page).toHaveScreenshot(`milestone1-event-error-${label}.png`, {
				fullPage: true
			});
		}
	});
});
