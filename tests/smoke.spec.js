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

test('reaching full perfection shows the celebration popup', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    const data = window.STARDEW_WIKI_DATA;
    const truthMap = (ids) => Object.fromEntries(ids.map((id) => [id, true]));
    const fish = truthMap(data.fish.map((entry) => entry.id));
    fish[data.fish[0].id] = false;

    const save = {
      appName: data.meta.appName,
      appVersion: 'test',
      releaseName: '',
      saveVersion: 2,
      state: {
        fish,
        cooking: {
          recipes: truthMap(data.cooking.recipes.map((entry) => entry.id)),
          pantry: {},
        },
        crafting: {
          recipes: truthMap(data.crafting.recipes.map((entry) => entry.id)),
          stock: {},
        },
        shipping: truthMap(data.other.shippingPages.flatMap((page) => page.items.map((item) => item.id))),
        villagers: Object.fromEntries(data.other.villagers.map((entry) => [entry.id, entry.targetHearts])),
        monsterGoals: Object.fromEntries(data.other.monsterGoals.map((entry) => [entry.id, entry.target])),
        skills: Object.fromEntries(data.other.skills.map((entry) => [entry.id, entry.targetLevel])),
        stardrops: truthMap(data.other.stardrops.map((entry) => entry.id)),
        buildings: truthMap(data.other.buildings.map((entry) => entry.id)),
        buildingStock: {},
        goldenWalnuts: data.other.goldenWalnutsTarget,
      },
    };

    window.localStorage.setItem('junimo-perfection-journal-save-v2', JSON.stringify(save));
  });

  await page.reload();
  await page.getByRole('button', { name: 'Fish' }).click();
  await page.locator('#fish-table input[data-action="fish-toggle"]').first().click({ force: true });

  await expect(page.locator('#perfection-celebration')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You did it!' })).toBeVisible();
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

test('cooking pantry status only shows ingredients already on hand', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const data = window.STARDEW_WIKI_DATA;
    const save = {
      appName: data.meta.appName,
      appVersion: 'test',
      releaseName: '',
      saveVersion: 2,
      state: {
        fish: {},
        cooking: {
          recipes: {},
          pantry: {},
        },
        crafting: {
          recipes: {},
          stock: {},
        },
        shipping: {},
        villagers: {},
        monsterGoals: {},
        skills: {},
        stardrops: {},
        buildings: {},
        buildingStock: {},
        goldenWalnuts: 0,
      },
    };
    save.state.cooking.pantry = {
      Moss: 20,
      Milk: 12,
    };
    window.localStorage.setItem('junimo-perfection-journal-save-v2', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Cooking' }).click();
  await page.getByRole('button', { name: 'Planner' }).click();
  await page.locator('#cooking-status').selectOption('pantry');

  await expect(page.locator('#cooking-ingredients table')).toBeVisible();
  await expect(page.locator('#cooking-ingredients')).toContainText('Moss');
  await expect(page.locator('#cooking-ingredients')).toContainText('Milk');
  await expect(page.locator('#cooking-ingredients')).not.toContainText('Wheat Flour');
  await expect.poll(async () => summaryValue(page, '#cooking-summary', 2)).toBe('32');
  await expect.poll(async () => summaryValue(page, '#cooking-summary', 3)).toBe('2');
});

test('cooking restored pantry filter stays in sync with the rendered planner', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const data = window.STARDEW_WIKI_DATA;
    const save = {
      appName: data.meta.appName,
      appVersion: 'test',
      releaseName: '',
      saveVersion: 2,
      state: {
        fish: {},
        cooking: {
          recipes: {},
          pantry: {
            Moss: 20,
            Milk: 12,
          },
        },
        crafting: {
          recipes: {},
          stock: {},
        },
        shipping: {},
        villagers: {},
        monsterGoals: {},
        skills: {},
        stardrops: {},
        buildings: {},
        buildingStock: {},
        goldenWalnuts: 0,
      },
    };
    window.localStorage.setItem('junimo-perfection-journal-save-v2', JSON.stringify(save));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Cooking' }).click();
  await page.getByRole('button', { name: 'Planner' }).click();
  await page.evaluate(() => {
    document.getElementById('cooking-status').value = 'pantry';
    window.dispatchEvent(new PageTransitionEvent('pageshow'));
  });

  await expect(page.locator('#cooking-summary')).toContainText('Pantry units');
  await expect(page.locator('#cooking-summary')).toContainText('Ingredients on hand');
  await expect(page.locator('#cooking-ingredients')).toContainText('Moss');
  await expect(page.locator('#cooking-ingredients')).toContainText('Milk');
  await expect(page.locator('#cooking-ingredients')).not.toContainText('Wheat Flour');
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

test('other perfection card grids keep a stable order while values change', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Other Perfection' }).click();

  const villagersBefore = await page.locator('#villagers-content .villager-card h3').allInnerTexts();
  const skillsBefore = await page.locator('#skills-content .mini-card h3').allInnerTexts();
  const collectiblesBefore = await page.locator('#collectibles-content .collectible-card h3').allInnerTexts();
  const buildingsBefore = await page.locator('#buildings-content .building-card h3').allInnerTexts();

  await expect(page.locator('#skills-content .mini-card h3')).toHaveText([
    'Farming',
    'Foraging',
    'Fishing',
    'Mining',
    'Combat',
  ]);

  await page.locator('input[data-action="villager-hearts"][data-id="caroline"]').fill('10');
  await page.locator('input[data-action="skill-level"][data-id="combat"]').fill('10');
  await page.locator('#collectibles-content input[data-action="stardrop-toggle"]').first().check();
  await page.locator('#buildings-content input[data-action="building-toggle"]').first().check();

  await expect(page.locator('#villagers-content .villager-card h3')).toHaveText(villagersBefore);
  await expect(page.locator('#skills-content .mini-card h3')).toHaveText(skillsBefore);
  await expect(page.locator('#collectibles-content .collectible-card h3')).toHaveText(collectiblesBefore);
  await expect(page.locator('#buildings-content .building-card h3')).toHaveText(buildingsBefore);
});
