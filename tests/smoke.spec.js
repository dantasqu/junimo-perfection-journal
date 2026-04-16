const { test, expect } = require('playwright/test');

async function summaryValue(page, summaryId, cardIndex) {
  return page.locator(`${summaryId} .summary-card`).nth(cardIndex).locator('strong').innerText();
}

test('loads the app and shows the main navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Junimo Perfection Journal' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fish' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cooking' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crafting' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Shipping' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Other Perfection' })).toBeVisible();
});

test('fish checkbox updates the caught summary immediately', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fish' }).click();

  const before = await summaryValue(page, '#fish-summary', 1);
  const firstCheckbox = page.locator('#fish-table input[data-action="fish-toggle"]').first();
  await firstCheckbox.check();

  await expect
    .poll(async () => summaryValue(page, '#fish-summary', 1))
    .not.toBe(before);
});

test('cooking views switch cleanly between recipes, planner, and split', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cooking' }).click();

  await page.getByRole('button', { name: 'Planner' }).click();
  await expect(page.getByRole('heading', { name: 'Ingredient Planner' })).toBeVisible();
  await expect(page.locator('#cooking-ingredients table')).toBeVisible();

  await page.getByRole('button', { name: 'Recipes' }).click();
  await expect(page.locator('#cooking-recipes .recipe-card').first()).toBeVisible();

  await page.getByRole('button', { name: 'Split' }).click();
  await expect(page.locator('#cooking-layout.is-split')).toBeVisible();
  await expect(page.locator('#cooking-ingredients table')).toBeVisible();
  await expect(page.locator('#cooking-recipes .recipe-card').first()).toBeVisible();
});

test('shipping status filter narrows the visible items', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Shipping' }).click();

  const initialLeft = await summaryValue(page, '#shipping-summary', 0);
  const initialDone = await summaryValue(page, '#shipping-summary', 1);

  await page.locator('#shipping-search').fill('Daffodil');
  await expect(page.locator('#shipping-content .pill-item')).toHaveCount(1);
  await expect(await summaryValue(page, '#shipping-summary', 0)).toBe(initialLeft);
  await expect(await summaryValue(page, '#shipping-summary', 1)).toBe(initialDone);

  await page.locator('#shipping-status').selectOption('remaining');
  await expect(page.locator('#shipping-content .pill-item')).toHaveCount(1);
  await expect(await summaryValue(page, '#shipping-summary', 0)).toBe(initialLeft);
  await expect(await summaryValue(page, '#shipping-summary', 1)).toBe(initialDone);

  await page.locator('#shipping-status').selectOption('all');
  await page.locator('#shipping-content input[data-action="shipping-toggle"]').check();
  await expect.poll(async () => summaryValue(page, '#shipping-summary', 0)).toBe('153');
  await expect.poll(async () => summaryValue(page, '#shipping-summary', 1)).toBe('1/154');
  await page.locator('#shipping-status').selectOption('done');

  await expect(page.locator('#shipping-content .pill-item')).toHaveCount(1);
  await expect(page.locator('#shipping-content .pill-item.is-done')).toHaveCount(1);
  await expect(await summaryValue(page, '#shipping-summary', 0)).toBe('153');
  await expect(await summaryValue(page, '#shipping-summary', 1)).toBe('1/154');
});

test('export, reset, and import restore tracker state', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fish' }).click();

  const firstCheckbox = page.locator('#fish-table input[data-action="fish-toggle"]').first();
  await firstCheckbox.check();
  const afterCheck = await summaryValue(page, '#fish-summary', 1);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  const download = await downloadPromise;
  const savePath = testInfo.outputPath('junimo-save.json');
  await download.saveAs(savePath);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reset tracker' }).click();
  await expect
    .poll(async () => summaryValue(page, '#fish-summary', 1))
    .not.toBe(afterCheck);

  await page.setInputFiles('#import-file', savePath);
  await expect
    .poll(async () => summaryValue(page, '#fish-summary', 1))
    .toBe(afterCheck);
});

test('other perfection values persist after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Other Perfection' }).click();

  const combatInput = page.locator('input[data-action="skill-level"][data-id="combat"]');
  await combatInput.fill('7');
  await page.reload();
  await page.getByRole('button', { name: 'Other Perfection' }).click();

  await expect(page.locator('input[data-action="skill-level"][data-id="combat"]')).toHaveValue('7');
});
