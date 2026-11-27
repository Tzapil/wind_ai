import { expect, test } from '@playwright/test';

test('shows a fullscreen canvas and localized placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.getByRole('main')).toHaveText('Попутного ветра');
  await expect(page).toHaveTitle('Попутного ветра');
  const canvasBounds = await page.locator('#game canvas').boundingBox();
  expect(canvasBounds?.width).toBe(page.viewportSize()?.width);
  expect(canvasBounds?.height).toBe(page.viewportSize()?.height);
});
