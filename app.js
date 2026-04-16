const data = window.STARDEW_WIKI_DATA;
const APP_VERSION = "1.1.0";
const RELEASE_NAME = "Honey Junimo";
const SAVE_SCHEMA_VERSION = 2;
const STORAGE_KEY = "junimo-perfection-journal-save-v2";
const LEGACY_STORAGE_KEYS = ["stardew-perfection-tracker-v1"];
const SAVE_STATE_KEYS = [
  "fish",
  "cooking",
  "crafting",
  "shipping",
  "villagers",
  "monsterGoals",
  "skills",
  "stardrops",
  "buildings",
  "buildingStock",
  "goldenWalnuts",
];
const GOLDEN_WALNUT_ITEM = {
  name: "Golden Walnut",
  imageUrl: "https://stardewvalleywiki.com/mediawiki/images/5/54/Golden_Walnut.png",
};

const flatShippingItems = data.other.shippingPages.flatMap((page) => page.items);
const cookingIngredientCatalogMap = Object.fromEntries(
  (data.cooking.ingredientCatalog || []).map((entry) => [entry.item, entry])
);
const cookingIngredientNames = uniqueIngredientNames(data.cooking.recipes);
const craftingIngredientNames = uniqueIngredientNames(data.crafting.recipes);
const buildingMaterialNames = uniqueBuildingMaterialNames(data.other.buildings);

const initialSave = loadSaved();
let state = buildState(initialSave.state);
const ui = {
  activeTab: "general",
  fishSearch: "",
  fishSpot: "all",
  fishSeason: "all",
  fishWeather: "all",
  fishStatus: "remaining",
  cookingSearch: "",
  cookingStatus: "remaining",
  cookingIngredientCategory: "all",
  cookingView: "recipes",
  craftingSearch: "",
  craftingStatus: "remaining",
  shippingSearch: "",
  shippingStatus: "all",
};
let scheduledRenderHandle = 0;

const FISH_SPOT_ORDER = [
  "Legendary",
  "Beach",
  "River",
  "Mountain Lake",
  "Cindersap Forest Pond",
  "Secret Woods",
  "Mines",
  "Sewers",
  "Desert",
  "Mutant Bug Lair",
  "Witch's Swamp",
  "Night Market",
  "Crab Pot",
  "Ginger Island",
];

document.addEventListener("DOMContentLoaded", () => {
  populateStaticOptions();
  bindEvents();
  renderAllDynamic();
  updateVisibleTab();
});

function populateStaticOptions() {
  const fishSpot = document.getElementById("fish-spot");
  const fishSpots = FISH_SPOT_ORDER.filter((spot) =>
    data.fish.some((fish) => getFishSpots(fish).includes(spot))
  );
  fishSpot.insertAdjacentHTML(
    "beforeend",
    fishSpots
      .map((spot) => `<option value="${escapeHtml(spot)}">${escapeHtml(spot)}</option>`)
      .join("")
  );

  const ingredientCategorySelect = document.getElementById("cooking-ingredient-category");
  const ingredientCategories = [
    ...new Set((data.cooking.ingredientCatalog || []).map((entry) => entry.category)),
  ].sort();
  ingredientCategorySelect.insertAdjacentHTML(
    "beforeend",
    ingredientCategories
      .map(
        (category) =>
          `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
      )
      .join("")
  );

  document.getElementById("fish-spot").value = ui.fishSpot;
  document.getElementById("fish-season").value = ui.fishSeason;
  document.getElementById("fish-weather").value = ui.fishWeather;
  document.getElementById("fish-status").value = ui.fishStatus;
  document.getElementById("cooking-status").value = ui.cookingStatus;
  document.getElementById("cooking-ingredient-category").value = ui.cookingIngredientCategory;
  document.getElementById("crafting-status").value = ui.craftingStatus;
  document.getElementById("shipping-status").value = ui.shippingStatus;

  const versionPill = document.getElementById("version-pill");
  if (versionPill) {
    versionPill.textContent = `Version ${APP_VERSION} • ${RELEASE_NAME}`;
    versionPill.title = `Save format v${SAVE_SCHEMA_VERSION}`;
  }
}

function bindEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      ui.activeTab = button.dataset.tab;
      reconcileTabFilterForVisibility(ui.activeTab);
      updateVisibleTab();
      renderActiveTab();
    });
  });

  const fishSearchInput = document.getElementById("fish-search");
  const handleFishSearch = (event) => {
    ui.fishSearch = event.target.value;
    renderFish();
  };
  ["input", "change", "search"].forEach((eventName) => {
    fishSearchInput.addEventListener(eventName, handleFishSearch);
  });
  document.getElementById("fish-spot").addEventListener("change", (event) => {
    ui.fishSpot = event.target.value;
    renderFish();
  });
  document.getElementById("fish-season").addEventListener("change", (event) => {
    ui.fishSeason = event.target.value;
    renderFish();
  });
  document.getElementById("fish-weather").addEventListener("change", (event) => {
    ui.fishWeather = event.target.value;
    renderFish();
  });
  document.getElementById("fish-status").addEventListener("change", (event) => {
    ui.fishStatus = event.target.value;
    renderFish();
  });

  const cookingSearchInput = document.getElementById("cooking-search");
  const handleCookingSearch = (event) => {
    ui.cookingSearch = event.target.value;
    renderCooking();
  };
  ["input", "change", "search"].forEach((eventName) => {
    cookingSearchInput.addEventListener(eventName, handleCookingSearch);
  });
  document.getElementById("cooking-status").addEventListener("change", (event) => {
    ui.cookingStatus = event.target.value;
    renderCooking();
  });
  document.getElementById("cooking-ingredient-category").addEventListener("change", (event) => {
    ui.cookingIngredientCategory = event.target.value;
    renderCooking();
  });
  document.querySelectorAll("[data-action='cooking-view']").forEach((button) => {
    button.addEventListener("click", () => {
      ui.cookingView = button.dataset.view;
      renderCooking();
    });
  });

  const craftingSearchInput = document.getElementById("crafting-search");
  const handleCraftingSearch = (event) => {
    ui.craftingSearch = event.target.value;
    renderCrafting();
  };
  ["input", "change", "search"].forEach((eventName) => {
    craftingSearchInput.addEventListener(eventName, handleCraftingSearch);
  });
  document.getElementById("crafting-status").addEventListener("change", (event) => {
    ui.craftingStatus = event.target.value;
    renderCrafting();
  });

  const shippingSearchInput = document.getElementById("shipping-search");
  const handleShippingSearch = (event) => {
    ui.shippingSearch = event.target.value;
    renderShipping();
  };
  ["input", "change", "search"].forEach((eventName) => {
    shippingSearchInput.addEventListener(eventName, handleShippingSearch);
  });
  document.getElementById("shipping-status").addEventListener("change", (event) => {
    ui.shippingStatus = event.target.value;
    renderShipping();
  });

  document.body.addEventListener("input", handleStateChange);
  document.body.addEventListener("change", handleStateChange);

  document.getElementById("export-data").addEventListener("click", exportSave);
  document.getElementById("import-data").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", importSave);
  document.getElementById("reset-data").addEventListener("click", resetSave);
}

function handleStateChange(event) {
  const target = event.target;

  if (target.matches("[data-action='fish-toggle']")) {
    state.fish[target.dataset.id] = target.checked;
  } else if (target.matches("[data-action='cooking-toggle']")) {
    state.cooking.recipes[target.dataset.id] = target.checked;
  } else if (target.matches("[data-action='crafting-toggle']")) {
    state.crafting.recipes[target.dataset.id] = target.checked;
  } else if (target.matches("[data-action='shipping-toggle']")) {
    state.shipping[target.dataset.id] = target.checked;
  } else if (target.matches("[data-action='stardrop-toggle']")) {
    state.stardrops[target.dataset.id] = target.checked;
  } else if (target.matches("[data-action='building-toggle']")) {
    state.buildings[target.dataset.id] = target.checked;
  } else if (target.matches("[data-action='villager-hearts']")) {
    state.villagers[target.dataset.id] = clampNumber(target.value, 0, 14);
  } else if (target.matches("[data-action='villager-complete']")) {
    const villager = data.other.villagers.find((entry) => entry.id === target.dataset.id);
    if (villager) {
      state.villagers[target.dataset.id] = target.checked
        ? villager.targetHearts
        : Math.max(villager.targetHearts - 1, 0);
    }
  } else if (target.matches("[data-action='monster-count']")) {
    state.monsterGoals[target.dataset.id] = clampNumber(target.value, 0, 999999);
  } else if (target.matches("[data-action='monster-complete']")) {
    const goal = data.other.monsterGoals.find((entry) => entry.id === target.dataset.id);
    if (goal) {
      state.monsterGoals[target.dataset.id] = target.checked
        ? goal.target
        : Math.max(goal.target - 1, 0);
    }
  } else if (target.matches("[data-action='skill-level']")) {
    state.skills[target.dataset.id] = clampNumber(target.value, 0, 10);
  } else if (target.matches("[data-action='skill-complete']")) {
    const skill = data.other.skills.find((entry) => entry.id === target.dataset.id);
    if (skill) {
      state.skills[target.dataset.id] = target.checked
        ? skill.targetLevel
        : Math.max(skill.targetLevel - 1, 0);
    }
  } else if (target.matches("[data-action='cooking-owned']")) {
    state.cooking.pantry[target.dataset.item] = clampNumber(target.value, 0, 999999);
  } else if (target.matches("[data-action='crafting-owned']")) {
    state.crafting.stock[target.dataset.item] = clampNumber(target.value, 0, 999999);
  } else if (target.matches("[data-action='building-owned']")) {
    state.buildingStock[target.dataset.item] = clampNumber(target.value, 0, 999999999);
  } else if (target.matches("[data-action='golden-walnuts']")) {
    state.goldenWalnuts = clampNumber(target.value, 0, data.other.goldenWalnutsTarget);
  } else if (target.matches("[data-action='golden-walnuts-complete']")) {
    state.goldenWalnuts = target.checked ? data.other.goldenWalnutsTarget : 0;
  } else {
    return;
  }

  saveState();
  scheduleRenderAllDynamic();
}

function renderAllDynamic() {
  renderGeneral();
  renderFish();
  renderCooking();
  renderCrafting();
  renderShipping();
  renderOther();
}

function renderActiveTab() {
  if (ui.activeTab === "fish") {
    renderFish();
  } else if (ui.activeTab === "cooking") {
    renderCooking();
  } else if (ui.activeTab === "crafting") {
    renderCrafting();
  } else if (ui.activeTab === "shipping") {
    renderShipping();
  } else if (ui.activeTab === "other") {
    renderOther();
  } else {
    renderGeneral();
  }
}

function scheduleRenderAllDynamic() {
  if (scheduledRenderHandle) {
    return;
  }

  const scheduler =
    typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback) => setTimeout(callback, 0);

  scheduledRenderHandle = scheduler(() => {
    scheduledRenderHandle = 0;
    renderAllDynamic();
  });
}

function renderGeneral() {
  const progress = getProgressSnapshot();
  const remaining = getRemainingSnapshot();
  const totalTasksRemaining =
    (data.fish.length - progress.fish.done) +
    (data.cooking.recipes.length - progress.cooking.done) +
    (data.crafting.recipes.length - progress.crafting.done) +
    (flatShippingItems.length - progress.shipping.done);

  document.getElementById("general-top").innerHTML = `
    ${summaryCard("Overall perfection", `${progress.overallPercent.toFixed(1)}%`, "", progress.overallPercent)}
    ${summaryCard("Main checklist left", `${totalTasksRemaining}`, "Fish + cooking + crafting + shipping unfinished", ratioToPercent(totalTasksRemaining / (data.fish.length + data.cooking.recipes.length + data.crafting.recipes.length + flatShippingItems.length)))}
    ${summaryCard("Fish left", `${remaining.fish.length}`, "Uncaught fish", ratioToPercent(remaining.fish.length / data.fish.length))}
    ${summaryCard("Cooking left", `${remaining.cooking.length}`, "Recipes still to cook", ratioToPercent(remaining.cooking.length / data.cooking.recipes.length))}
    ${summaryCard("Crafting left", `${remaining.crafting.length}`, "Recipes still to craft", ratioToPercent(remaining.crafting.length / data.crafting.recipes.length))}
    ${summaryCard("Shipping left", `${remaining.shipping.length}`, "Items still to ship", ratioToPercent(remaining.shipping.length / flatShippingItems.length))}
  `;

  document.getElementById("general-left-board").innerHTML = renderGeneralLeftBoard(remaining);

  const categoryLookup = {
    "produce-forage-shipped": progress.shipping,
    "obelisks-on-farm": progress.obelisks,
    "golden-clock-on-farm": progress.goldClock,
    "monster-slayer-hero": progress.monsters,
    "great-friends": progress.friends,
    "farmer-level": progress.skills,
    "found-all-stardrops": progress.stardrops,
    "cooking-recipes-made": progress.cooking,
    "crafting-recipes-made": progress.crafting,
    "fish-caught": progress.fish,
    "golden-walnuts-found": progress.walnuts,
  };

  document.getElementById("general-categories").innerHTML = data.perfectionCategories
    .map((category) => {
      const entry = categoryLookup[category.id];
      return `
        <article class="category-card">
          <p class="section-kicker">${category.weightPercent}% of perfection</p>
          <h3>${escapeHtml(category.name)}</h3>
          <p>${escapeHtml(category.requirement)}</p>
          <div class="category-meta">
            <span>${entry.current}/${entry.total}</span>
            <span>${ratioToPercent(entry.ratio).toFixed(1)}%</span>
          </div>
          ${progressBar(entry.ratio)}
        </article>
      `;
    })
    .join("");

  document.getElementById("general-footer").innerHTML = `
    <p><strong>Built-in wiki data:</strong> ${escapeHtml(data.meta.notes.join(" "))}</p>
    <p class="subtle">App version: ${escapeHtml(APP_VERSION)} • ${escapeHtml(RELEASE_NAME)} • Save format v${SAVE_SCHEMA_VERSION}</p>
    <p class="subtle">Generated: ${escapeHtml(formatDate(data.meta.generatedAt))}</p>
    <div class="source-links">
      ${data.meta.wikiSourcePages
        .map(
          (page) =>
            `<a href="${page.url}" target="_blank" rel="noreferrer">${escapeHtml(page.label)}</a>`
        )
        .join("")}
    </div>
  `;
}

function renderGeneralLeftBoard(remaining) {
  return `
    <section class="section-card">
      <div class="section-header">
        <div>
          <p class="section-kicker">What&apos;s Left</p>
        </div>
      </div>
      <div class="remaining-grid">
        ${renderRemainingCard(
          "Fish",
          `${remaining.fish.length} left`,
          renderRemainingList(
            remaining.fish,
            (fish) => fish.name,
            (fish) => `${fish.location} • ${formatFishSeason(fish.season)} • ${fish.weather}`
          ),
          remaining.fish.length ? "Uncaught fish" : "Fish complete"
        )}
        ${renderRemainingCard(
          "Cooking",
          `${remaining.cooking.length} left`,
          renderRemainingList(
            remaining.cooking,
            (recipe) => recipe.name,
            (recipe) => recipe.ingredients.map((ingredient) => `${ingredient.item} x${ingredient.quantity}`).join(", ")
          ),
          remaining.cooking.length ? "Recipes still to cook" : "Cooking complete"
        )}
        ${renderRemainingCard(
          "Crafting",
          `${remaining.crafting.length} left`,
          renderRemainingList(
            remaining.crafting,
            (recipe) => recipe.name,
            (recipe) => `${recipe.category} • ${recipe.ingredients.map((ingredient) => `${ingredient.item} x${ingredient.quantity}`).join(", ")}`
          ),
          remaining.crafting.length ? "Recipes still to craft" : "Crafting complete"
        )}
        ${renderRemainingCard(
          "Shipping",
          `${remaining.shipping.length} left`,
          renderRemainingPills(remaining.shipping, (item) => item.name),
          remaining.shipping.length ? "Items still missing from the shipped collection" : "Shipping complete"
        )}
        ${renderRemainingCard(
          "People",
          `${remaining.villagers.length} left`,
          renderRemainingList(
            remaining.villagers,
            (entry) => entry.name,
            (entry) => entry.meta,
            (entry) => entry.value
          ),
          remaining.villagers.length ? "Villagers not yet at perfection hearts" : "Friends complete"
        )}
        ${renderRemainingCard(
          "Skills",
          `${remaining.skills.length} left`,
          renderRemainingList(
            remaining.skills,
            (entry) => entry.name,
            (entry) => entry.meta,
            (entry) => entry.value
          ),
          remaining.skills.length ? "Farmer levels still missing" : "Skills complete"
        )}
        ${renderRemainingCard(
          "Late Game",
          `${remaining.stardrops.length + remaining.buildings.length + (remaining.walnutsLeft ? 1 : 0)} checks left`,
          renderRemainingList(
            [
              ...remaining.stardrops,
              ...remaining.buildings,
              ...(remaining.walnutsLeft
                ? [
                    {
                      name: "Golden Walnuts",
                      imageUrl: GOLDEN_WALNUT_ITEM.imageUrl,
                      meta: `${state.goldenWalnuts}/${data.other.goldenWalnutsTarget} found`,
                      value: `${remaining.walnutsLeft} left`,
                    },
                  ]
                : []),
            ],
            (entry) => entry.name,
            (entry) => entry.meta,
            (entry) => entry.value
          ),
          remaining.stardrops.length || remaining.buildings.length || remaining.walnutsLeft ? "Stardrops, buildings, and walnuts" : "Late-game checks complete"
        )}
        ${renderRemainingCard(
          "Monster Slayer",
          `${remaining.monsters.length} left`,
          renderRemainingList(
            remaining.monsters,
            (entry) => entry.name,
            (entry) => entry.meta,
            (entry) => entry.value
          ),
          remaining.monsters.length ? "Monster eradication goals still open" : "Monster goals complete"
        )}
      </div>
    </section>
  `;
}

function renderRemainingCard(kicker, title, body, subtitle) {
  return `
    <article class="remaining-card">
      <p class="section-kicker">${escapeHtml(kicker)}</p>
      <h3>${escapeHtml(title)}</h3>
      <p class="remaining-subtitle">${escapeHtml(subtitle)}</p>
      ${body}
    </article>
  `;
}

function renderRemainingList(items, labelFn, metaFn, valueFn) {
  if (!items.length) {
    return emptyState("Nothing left here.");
  }

  return `
    <ul class="remaining-list">
      ${items
        .map(
          (item) => `
            <li class="remaining-item">
              <div class="remaining-copy">
                <div class="item-inline">
                  ${itemThumb(item, labelFn(item))}
                  <div>
                    <strong>${escapeHtml(labelFn(item))}</strong>
                    ${metaFn && metaFn(item) ? `<div class="remaining-meta">${escapeHtml(metaFn(item))}</div>` : ""}
                  </div>
                </div>
              </div>
              ${valueFn ? `<span class="status-pill is-pending">${escapeHtml(valueFn(item))}</span>` : ""}
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function renderRemainingPills(items, labelFn) {
  if (!items.length) {
    return emptyState("Nothing left here.");
  }

  return `
    <div class="pill-grid">
      ${items
        .map((item) => `<span class="token">${escapeHtml(labelFn(item))}</span>`)
        .join("")}
    </div>
  `;
}

function renderFish() {
  const filtered = getFilteredFish();
  const progress = getProgressSnapshot();
  const fishLeft = data.fish.length - progress.fish.done;
  const legendaryLeft = data.fish.filter(
    (fish) => fish.category === "Legendary Fish" && !state.fish[fish.id]
  ).length;
  document.getElementById("fish-summary").innerHTML = `
    ${summaryCard("Fish left", `${fishLeft}`, "Unfished fish", ratioToPercent(fishLeft / data.fish.length))}
    ${summaryCard("Caught", `${progress.fish.done}/${data.fish.length}`, "", ratioToPercent(progress.fish.ratio))}
    ${summaryCard("Legendary left", `${legendaryLeft}`, "", ratioToPercent(legendaryLeft / 5))}
  `;

  if (!filtered.length) {
    document.getElementById("fish-table").innerHTML = emptyState(
      ui.fishStatus === "remaining" && !getRemainingFish().length
        ? "You have every fish marked caught, so there is nothing left in Still need."
        : "No fish match that filter."
    );
    return;
  }

  document.getElementById("fish-table").innerHTML = `
    <div class="table-shell">
      <table class="fish-table">
        <colgroup>
          <col class="fish-col-done" />
          <col class="fish-col-name" />
          <col class="fish-col-type" />
          <col class="fish-col-where" />
          <col class="fish-col-when" />
          <col class="fish-col-season" />
          <col class="fish-col-weather" />
        </colgroup>
        <thead>
          <tr>
            <th>Done</th>
            <th>Fish</th>
            <th>Type</th>
            <th>Where</th>
            <th>When</th>
            <th>Season</th>
            <th>Weather</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((fish) => {
              const done = state.fish[fish.id];
              return `
                <tr>
                  <td>
                    <label class="checkbox-wrap">
                      <input type="checkbox" data-action="fish-toggle" data-id="${fish.id}" ${done ? "checked" : ""} />
                      <span class="status-pill ${done ? "is-done" : "is-pending"}">${done ? "Caught" : "Need"}</span>
                    </label>
                  </td>
                  <td>
                    <div class="item-inline">
                      ${itemThumb(fish, fish.name)}
                      <div>
                        <strong>${escapeHtml(fish.name)}</strong>
                      </div>
                    </div>
                  </td>
                  <td>${escapeHtml(getFishTypeLabel(fish))}</td>
                  <td>${escapeHtml(fish.location)}</td>
                  <td>${escapeHtml(fish.time)}</td>
                  <td>${escapeHtml(formatFishSeason(fish.season))}</td>
                  <td>${escapeHtml(fish.weather)}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getFilteredFish() {
  return data.fish
    .filter((fish) => {
      const done = state.fish[fish.id];
      const searchText = [
        fish.name,
        getFishTypeLabel(fish),
        getFishSpots(fish).join(" "),
        fish.location,
        fish.time,
        formatFishSeason(fish.season),
        fish.weather,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesSearch(searchText, ui.fishSearch) &&
        (ui.fishSpot === "all" || getFishSpots(fish).includes(ui.fishSpot)) &&
        matchesFishSeason(fish) &&
        matchesFishWeather(fish) &&
        matchesStatus(done, ui.fishStatus)
      );
    });
}

function getRemainingFish() {
  return data.fish.filter((fish) => !state.fish[fish.id]);
}

function reconcileTabFilterForVisibility(tab) {
  if (tab === "fish") {
    const canAutoSwitch =
      ui.fishStatus === "remaining" &&
      ui.fishSpot === "all" &&
      ui.fishSeason === "all" &&
      ui.fishWeather === "all" &&
      !ui.fishSearch.trim() &&
      getFilteredFish().length === 0;
    if (canAutoSwitch) {
      ui.fishStatus = "all";
      document.getElementById("fish-status").value = "all";
    }
    return;
  }

  if (tab === "cooking") {
    const canAutoSwitch =
      ui.cookingStatus === "remaining" &&
      ui.cookingIngredientCategory === "all" &&
      !ui.cookingSearch.trim() &&
      data.cooking.recipes.every((recipe) => state.cooking.recipes[recipe.id]);
    if (canAutoSwitch) {
      ui.cookingStatus = "all";
      document.getElementById("cooking-status").value = "all";
    }
    return;
  }

  if (tab === "crafting") {
    const canAutoSwitch =
      ui.craftingStatus === "remaining" &&
      !ui.craftingSearch.trim() &&
      data.crafting.recipes.every((recipe) => state.crafting.recipes[recipe.id]);
    if (canAutoSwitch) {
      ui.craftingStatus = "all";
      document.getElementById("crafting-status").value = "all";
    }
  }
}

function renderCooking() {
  const cookingLayout = document.getElementById("cooking-layout");
  const ingredientCategory = document.getElementById("cooking-ingredient-category");
  if (cookingLayout) {
    cookingLayout.classList.remove("is-recipes", "is-planner", "is-split");
    cookingLayout.classList.add(`is-${ui.cookingView}`);
  }
  if (ingredientCategory) {
    ingredientCategory.disabled = ui.cookingView === "recipes";
  }
  document.querySelectorAll("[data-action='cooking-view']").forEach((button) => {
    const isActive = button.dataset.view === ui.cookingView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
  renderRecipePlanner({
    kind: "cooking",
    recipes: data.cooking.recipes,
    statusMap: state.cooking.recipes,
    stockMap: state.cooking.pantry,
    summaryEl: "cooking-summary",
    ingredientsEl: "cooking-ingredients",
    recipesEl: "cooking-recipes",
    search: ui.cookingSearch,
    status: ui.cookingStatus,
    stockAction: "cooking-owned",
    ingredientCategory: ui.cookingIngredientCategory,
    extraBadge: null,
    showPlanner: ui.cookingView !== "recipes",
  });
}

function renderCrafting() {
  renderRecipePlanner({
    kind: "crafting",
    recipes: data.crafting.recipes,
    statusMap: state.crafting.recipes,
    stockMap: state.crafting.stock,
    summaryEl: "crafting-summary",
    ingredientsEl: "crafting-ingredients",
    recipesEl: "crafting-recipes",
    search: ui.craftingSearch,
    status: ui.craftingStatus,
    stockAction: "crafting-owned",
    extraBadge: null,
    showPlanner: false,
  });
}

function renderRecipePlanner(config) {
  const {
    kind,
    recipes,
    statusMap,
    stockMap,
    summaryEl,
    ingredientsEl,
    recipesEl,
    search,
    status,
    stockAction,
    ingredientCategory = "all",
    extraBadge,
    showPlanner = true,
  } = config;

  const filtered = recipes
    .filter((recipe) => {
      const done = statusMap[recipe.id];
      const searchText = [
        recipe.name,
        kind === "crafting" ? "" : recipe.description,
        kind === "cooking" || kind === "crafting" ? "" : recipe.recipeSource,
        recipe.ingredients.map((ingredient) => ingredient.item).join(" "),
        kind === "crafting" ? "" : recipe.category || "",
      ]
        .join(" ")
        .toLowerCase();
      return matchesSearch(searchText, search) && matchesStatus(done, status);
    });

  const doneCount = Object.values(statusMap).filter(Boolean).length;
  const remainingRecipes = recipes.length - doneCount;
  const plannerRecipes = search.trim() ? filtered : recipes;
  const summaryIngredientRows = Object.entries(aggregateRemainingIngredients(recipes, statusMap))
    .map(([item, needed]) => ({
      item,
      category:
        kind === "cooking"
          ? cookingIngredientCatalogMap[item]?.category || "Other"
          : "Material",
      imageUrl: kind === "cooking" ? cookingIngredientCatalogMap[item]?.imageUrl || "" : "",
      needed,
      owned: clampNumber(stockMap[item], 0, 999999),
      remaining: Math.max(needed - clampNumber(stockMap[item], 0, 999999), 0),
    }))
    .sort((left, right) => right.remaining - left.remaining || left.item.localeCompare(right.item));
  const summaryVisibleIngredientRows =
    status === "remaining" ? summaryIngredientRows.filter((row) => row.remaining > 0) : summaryIngredientRows;
  const ingredientTotals = aggregateRemainingIngredients(plannerRecipes, statusMap);
  const ingredientRows = Object.entries(ingredientTotals)
    .map(([item, needed]) => ({
      item,
      category:
        kind === "cooking"
          ? cookingIngredientCatalogMap[item]?.category || "Other"
          : "Material",
      imageUrl: kind === "cooking" ? cookingIngredientCatalogMap[item]?.imageUrl || "" : "",
      needed,
      owned: clampNumber(stockMap[item], 0, 999999),
      remaining: Math.max(needed - clampNumber(stockMap[item], 0, 999999), 0),
    }))
    .filter((row) => ingredientCategory === "all" || row.category === ingredientCategory)
    .sort((left, right) => right.remaining - left.remaining || left.item.localeCompare(right.item));

  const visibleIngredientRows =
    status === "remaining" ? ingredientRows.filter((row) => row.remaining > 0) : ingredientRows;
  const remainingUnits = summaryVisibleIngredientRows.reduce((sum, row) => sum + row.remaining, 0);

  document.getElementById(summaryEl).innerHTML = showPlanner
    ? `
    ${summaryCard(kind === "cooking" ? "Recipes left" : "Recipes left", `${remainingRecipes}`, kind === "cooking" ? "" : "Still to craft", ratioToPercent(remainingRecipes / recipes.length))}
    ${summaryCard(kind === "cooking" ? "Cooked" : "Crafted", `${doneCount}/${recipes.length}`, kind === "cooking" ? "" : "Completion so far", ratioToPercent(doneCount / recipes.length))}
    ${summaryCard("Materials left", `${remainingUnits}`, "", summaryVisibleIngredientRows.length ? 100 : 0)}
    ${summaryCard("Ingredients tracked", `${summaryVisibleIngredientRows.length}`, "", ratioToPercent(Math.min(summaryVisibleIngredientRows.length, recipes.length) / recipes.length))}
  `
    : `
    ${summaryCard("Recipes left", `${remainingRecipes}`, "", ratioToPercent(remainingRecipes / recipes.length))}
    ${summaryCard("Crafted", `${doneCount}/${recipes.length}`, "", ratioToPercent(doneCount / recipes.length))}
  `;

  document.getElementById(ingredientsEl).innerHTML = !showPlanner
    ? ""
    : visibleIngredientRows.length
    ? `
      <article class="planner-card">
        <h3>${kind === "cooking" ? "Ingredient Planner" : "Material Planner"}</h3>
        <div class="table-shell">
          <table class="planner-table tight-table ${kind === "cooking" ? "planner-table-cooking" : ""}">
            <thead>
              <tr>
                <th>Item</th>
                ${kind === "cooking" ? "<th>Category</th>" : ""}
                <th>Need</th>
                <th>You have</th>
                <th>Still need</th>
              </tr>
            </thead>
            <tbody>
              ${visibleIngredientRows
                .map(
                  (row) => `
                    <tr>
                      <td>
                        <div class="item-inline">
                          ${itemThumb(row, row.item)}
                          <span>${escapeHtml(row.item)}</span>
                        </div>
                      </td>
                      ${kind === "cooking" ? `<td>${escapeHtml(row.category)}</td>` : ""}
                      <td>${formatNumber(row.needed)}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          data-action="${stockAction}"
                          data-item="${escapeAttribute(row.item)}"
                          value="${row.owned}"
                        />
                      </td>
                      <td><strong>${formatNumber(row.remaining)}</strong></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </article>
    `
    : emptyState(
        showPlanner && remainingRecipes
          ? status === "remaining" && ingredientRows.length
            ? "You already have enough of the remaining ingredients in this view."
            : kind === "cooking" && ingredientCategory !== "all"
            ? `No remaining ingredients match the ${ingredientCategory} filter.`
            : "No remaining ingredients match the current filter."
          : showPlanner
          ? `All ${kind} recipes are done, so there are no remaining ingredients to plan around.`
          : ""
      );

  document.getElementById(recipesEl).innerHTML = filtered.length
    ? filtered
        .map((recipe) => {
          const done = statusMap[recipe.id];
          return `
            <article class="recipe-card ${done ? "is-done" : ""}">
              <div class="recipe-top">
                <div class="recipe-title">
                  <input type="checkbox" data-action="${kind}-toggle" data-id="${recipe.id}" ${done ? "checked" : ""} />
                  <div>
                    <div class="item-inline">
                      ${itemThumb(recipe, recipe.name)}
                      <h3>${escapeHtml(recipe.name)}</h3>
                    </div>
                    ${
                      extraBadge
                        ? `<div class="token-row">
                      <span class="token">${escapeHtml(extraBadge(recipe))}</span>
                    </div>`
                        : ""
                    }
                  </div>
                </div>
                <div class="recipe-status-corner">
                  <span class="status-pill ${done ? "is-done" : "is-pending"}">${done ? (kind === "cooking" ? "Cooked" : "Crafted") : "Need"}</span>
                </div>
              </div>
              ${kind === "cooking" || kind === "crafting" ? "" : `<p>${escapeHtml(recipe.description)}</p>`}
              <div class="meta-block">
                <div>
                  <div class="meta-label">Ingredients</div>
                  <div class="token-row">
                    ${recipe.ingredients
                      .map(
                        (ingredient) =>
                          `<span class="token">${escapeHtml(ingredient.item)} x${ingredient.quantity}</span>`
                      )
                      .join("")}
                  </div>
                </div>
                ${
                  kind === "cooking" || kind === "crafting"
                    ? ""
                    : `
                <div>
                  <div class="meta-label">Source</div>
                  <div>${escapeHtml(recipe.recipeSource)}</div>
                </div>
                `
                }
              </div>
            </article>
          `;
        })
        .join("")
    : emptyState(`No ${kind} recipes match that filter.`);
}

function renderOther() {
  const remaining = getRemainingSnapshot();

  document.getElementById("other-summary").innerHTML = `
    ${summaryCard("Friends left", `${remaining.villagers.length}`, "Villagers not yet at perfection hearts", ratioToPercent(remaining.villagers.length / data.other.villagers.length))}
    ${summaryCard("Monster goals left", `${remaining.monsters.length}`, "Eradication goals still unfinished", ratioToPercent(remaining.monsters.length / data.other.monsterGoals.length))}
    ${summaryCard("Walnuts left", `${remaining.walnutsLeft}`, "Golden walnuts still missing", ratioToPercent(remaining.walnutsLeft / data.other.goldenWalnutsTarget))}
  `;

  renderVillagers();
  renderMonsterGoals();
  renderSkills();
  renderStardropsAndWalnuts();
  renderBuildings();
}

function renderShipping() {
  const summaryEl = document.getElementById("shipping-summary");
  const contentEl = document.getElementById("shipping-content");
  if (!summaryEl || !contentEl) {
    return;
  }

  const term = ui.shippingSearch.toLowerCase().trim();
  const matchesStatus = (item) => {
    const done = Boolean(state.shipping[item.id]);
    if (ui.shippingStatus === "done") {
      return done;
    }
    if (ui.shippingStatus === "remaining") {
      return !done;
    }
    return true;
  };
  const filteredPages = data.other.shippingPages
    .map((page) => {
      const items = page.items.filter(
        (item) => matchesSearch(item.name.toLowerCase(), term) && matchesStatus(item)
      );
      const completed = items.filter((item) => state.shipping[item.id]).length;
      return { ...page, items, completed, remaining: items.length - completed };
    })
    .filter((page) => page.items.length);

  const totalDone = countTrueValues(state.shipping);
  const totalLeft = flatShippingItems.length - totalDone;

  summaryEl.innerHTML = `
    ${summaryCard("Shipping left", `${totalLeft}`, "Items still to ship", ratioToPercent(totalLeft / flatShippingItems.length))}
    ${summaryCard("Shipped", `${totalDone}/${flatShippingItems.length}`, "", ratioToPercent(totalDone / flatShippingItems.length))}
  `;

  if (!filteredPages.length) {
    contentEl.innerHTML = emptyState("No shipped items match that search.");
    return;
  }

  contentEl.innerHTML = `
    <div class="shipping-pages">
      ${filteredPages
        .map((page) => {
          return `
            <article class="page-card">
              <div class="page-head">
                <h3>${escapeHtml(page.name)}</h3>
                <span class="status-pill ${page.remaining === 0 ? "is-done" : "is-pending"}">${page.remaining} left</span>
              </div>
              <div class="pill-grid">
                ${page.items
                  .map((item) => {
                    const done = state.shipping[item.id];
                    return `
                      <label class="pill-item ${done ? "is-done" : ""}">
                        <input type="checkbox" data-action="shipping-toggle" data-id="${item.id}" ${done ? "checked" : ""} />
                        <span>${escapeHtml(item.name)}</span>
                      </label>
                    `;
                  })
                  .join("")}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderVillagers() {
  const villagers = [...data.other.villagers].sort((left, right) => {
    const leftRemaining = Math.max(left.targetHearts - state.villagers[left.id], 0);
    const rightRemaining = Math.max(right.targetHearts - state.villagers[right.id], 0);
    return rightRemaining - leftRemaining || left.name.localeCompare(right.name);
  });

  document.getElementById("villagers-content").innerHTML = `
    <div class="villager-grid">
      ${villagers
        .map((villager) => {
          const current = state.villagers[villager.id];
          const done = current >= villager.targetHearts;
          return `
            <article class="villager-card">
              <h3>${escapeHtml(villager.name)}</h3>
              <div class="control-stack">
                <div class="number-line villager-number-line">
                  <label class="subtle" for="villager-${villager.id}">Current hearts</label>
                  <div class="villager-heart-entry">
                    <div class="villager-portrait">${itemThumb(villager, villager.name)}</div>
                    <input
                      id="villager-${villager.id}"
                      type="number"
                      min="0"
                      max="14"
                      step="1"
                      value="${current}"
                      data-action="villager-hearts"
                      data-id="${villager.id}"
                    />
                  </div>
                </div>
              </div>
              <div class="villager-topline">
                <span class="status-pill ${done ? "is-done" : "is-pending"}">${done ? "Done" : `${villager.targetHearts - current} left`}</span>
                <label class="toggle-line villager-toggle-line">
                  <input
                    type="checkbox"
                    data-action="villager-complete"
                    data-id="${villager.id}"
                    ${done ? "checked" : ""}
                  />
                  <span>Max hearts</span>
                </label>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderMonsterGoals() {
  const goals = [...data.other.monsterGoals].sort((left, right) => {
    const leftRemaining = Math.max(left.target - state.monsterGoals[left.id], 0);
    const rightRemaining = Math.max(right.target - state.monsterGoals[right.id], 0);
    return rightRemaining - leftRemaining || getMonsterGoalLabel(left).localeCompare(getMonsterGoalLabel(right));
  });

  document.getElementById("monster-content").innerHTML = `
    <div class="table-shell">
      <table class="monster-table">
        <colgroup>
          <col class="monster-col-done" />
          <col class="monster-col-goal" />
          <col class="monster-col-target" />
          <col class="monster-col-current" />
          <col class="monster-col-remaining" />
        </colgroup>
        <thead>
          <tr>
            <th>Done</th>
            <th>Goal</th>
            <th>Target</th>
            <th>Current kills</th>
            <th>Still need</th>
          </tr>
        </thead>
        <tbody>
          ${goals
            .map((goal) => {
              const current = state.monsterGoals[goal.id];
              const done = current >= goal.target;
              const remaining = Math.max(goal.target - current, 0);
	          return `
		                <tr>
		                  <td class="monster-done-cell">
		                    <input
		                      type="checkbox"
	                      data-action="monster-complete"
	                      data-id="${goal.id}"
	                      ${done ? "checked" : ""}
	                    />
	                  </td>
	                  <td class="monster-goal-cell">
	                    <strong>${escapeHtml(getMonsterGoalLabel(goal))}</strong>
	                  </td>
	                  <td class="monster-target-cell">${formatNumber(goal.target)}</td>
	                  <td class="monster-number-cell">
	                    <input
	                      type="number"
	                      min="0"
	                      step="1"
	                      value="${current}"
	                      data-action="monster-count"
	                      data-id="${goal.id}"
	                    />
	                  </td>
	                  <td class="monster-remaining-cell"><strong>${formatNumber(remaining)}</strong></td>
	                </tr>
	              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSkills() {
  const skills = [...data.other.skills].sort((left, right) => {
    const leftRemaining = Math.max(left.targetLevel - state.skills[left.id], 0);
    const rightRemaining = Math.max(right.targetLevel - state.skills[right.id], 0);
    return rightRemaining - leftRemaining || left.name.localeCompare(right.name);
  });

  document.getElementById("skills-content").innerHTML = `
    <div class="skills-grid">
      ${skills
        .map((skill) => {
          const current = state.skills[skill.id];
          const done = current >= skill.targetLevel;
          return `
            <article class="mini-card">
              <h3>${escapeHtml(skill.name)}</h3>
              <div class="control-stack">
                <div class="number-line">
                  <span class="subtle">Current level</span>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    value="${current}"
                    data-action="skill-level"
                    data-id="${skill.id}"
                  />
                </div>
              </div>
              <div class="skill-footer">
                <label class="toggle-line">
                  <input
                    type="checkbox"
                    data-action="skill-complete"
                    data-id="${skill.id}"
                    ${done ? "checked" : ""}
                  />
                  <span>Max level</span>
                </label>
                <span class="status-pill ${done ? "is-done" : "is-pending"}">${done ? "Maxed" : `${skill.targetLevel - current} left`}</span>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderStardropsAndWalnuts() {
  const stardrops = [...data.other.stardrops].sort((left, right) => {
    const doneGap = Number(state.stardrops[left.id]) - Number(state.stardrops[right.id]);
    return doneGap || left.name.localeCompare(right.name);
  });

  document.getElementById("collectibles-content").innerHTML = `
    <div class="stardrop-grid collectibles-grid">
      ${stardrops
        .map((stardrop) => {
          const done = state.stardrops[stardrop.id];
          return `
            <article class="mini-card collectible-card">
              <div class="recipe-top">
                <div>
                  <div class="item-inline">
                    ${itemThumb(stardrop, stardrop.name)}
                    <h3>${escapeHtml(stardrop.name)}</h3>
                  </div>
                  <p>${escapeHtml(stardrop.details)}</p>
                </div>
                <input type="checkbox" data-action="stardrop-toggle" data-id="${stardrop.id}" ${done ? "checked" : ""} />
              </div>
            </article>
          `;
        })
        .join("")}
      <article class="mini-card collectible-card walnut-card">
        <div class="item-inline">
          ${itemThumb(GOLDEN_WALNUT_ITEM, GOLDEN_WALNUT_ITEM.name)}
          <h3>Golden Walnuts</h3>
        </div>
        <div class="control-stack">
          <div class="number-line">
            <span class="subtle">Current found</span>
            <input
              type="number"
              min="0"
              max="${data.other.goldenWalnutsTarget}"
              step="1"
              value="${state.goldenWalnuts}"
              data-action="golden-walnuts"
            />
          </div>
          <label class="toggle-line">
            <input
              type="checkbox"
              data-action="golden-walnuts-complete"
              ${state.goldenWalnuts >= data.other.goldenWalnutsTarget ? "checked" : ""}
            />
            <span>All found</span>
          </label>
        </div>
        ${progressBar(state.goldenWalnuts / data.other.goldenWalnutsTarget)}
      </article>
    </div>
  `;
}

function renderBuildings() {
  const buildings = [...data.other.buildings].sort((left, right) => {
    const doneGap = Number(state.buildings[left.id]) - Number(state.buildings[right.id]);
    return doneGap || left.name.localeCompare(right.name);
  });

  document.getElementById("buildings-content").innerHTML = `
    <div class="building-grid">
      ${buildings
        .map((building) => {
          const done = state.buildings[building.id];
          return `
            <article class="building-card">
              <div class="recipe-top">
                <div class="item-inline">
                  ${itemThumb(building, building.name)}
                  <h3>${escapeHtml(building.name)}</h3>
                </div>
                <span class="status-pill ${done ? "is-done" : "is-pending"}">${done ? "Built" : "Need"}</span>
              </div>
              <div class="control-stack building-controls">
                <label class="toggle-line">
                  <input type="checkbox" data-action="building-toggle" data-id="${building.id}" ${done ? "checked" : ""} />
                  <span>Built</span>
                </label>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
    ${buildings.length ? "" : emptyState("All obelisks and the Gold Clock are marked complete.")}
  `;
}

function getRemainingSnapshot() {
  const fish = data.fish.filter((entry) => !state.fish[entry.id]);
  const cooking = data.cooking.recipes.filter((entry) => !state.cooking.recipes[entry.id]);
  const crafting = data.crafting.recipes.filter((entry) => !state.crafting.recipes[entry.id]);
  const shipping = flatShippingItems.filter((entry) => !state.shipping[entry.id]);
  const villagers = data.other.villagers
    .filter((entry) => state.villagers[entry.id] < entry.targetHearts)
    .map((entry) => {
      const current = state.villagers[entry.id];
      const left = entry.targetHearts - current;
      return {
        name: entry.name,
        meta: `${current}/${entry.targetHearts} hearts`,
        value: `${left} left`,
        left,
      };
    })
    .sort((left, right) => right.left - left.left || left.name.localeCompare(right.name));
  const monsters = data.other.monsterGoals
    .filter((entry) => state.monsterGoals[entry.id] < entry.target)
    .map((entry) => {
      const current = state.monsterGoals[entry.id];
      const left = entry.target - current;
      return {
        name: getMonsterGoalLabel(entry),
        meta: `${current}/${entry.target} kills`,
        value: `${left} left`,
        left,
      };
    })
    .sort((left, right) => right.left - left.left || left.name.localeCompare(right.name));
  const skills = data.other.skills
    .filter((entry) => state.skills[entry.id] < entry.targetLevel)
    .map((entry) => {
      const current = state.skills[entry.id];
      const left = entry.targetLevel - current;
      return {
        name: entry.name,
        meta: `Level ${current}/${entry.targetLevel}`,
        value: `${left} left`,
        left,
      };
    })
    .sort((left, right) => right.left - left.left || left.name.localeCompare(right.name));
  const stardrops = data.other.stardrops
    .filter((entry) => !state.stardrops[entry.id])
    .map((entry) => ({
      name: entry.name,
      meta: entry.details,
      value: "Missing",
      imageUrl: entry.imageUrl,
    }));
  const buildings = data.other.buildings
    .filter((entry) => !state.buildings[entry.id])
    .map((entry) => ({
      name: entry.name,
      meta: "",
      value: "Not built",
      imageUrl: entry.imageUrl,
    }));
  const walnutsLeft = Math.max(data.other.goldenWalnutsTarget - state.goldenWalnuts, 0);
  const materials = [
    ...buildMaterialRows(aggregateRemainingIngredients(data.cooking.recipes, state.cooking.recipes), state.cooking.pantry, "Cooking"),
    ...buildMaterialRows(aggregateRemainingIngredients(data.crafting.recipes, state.crafting.recipes), state.crafting.stock, "Crafting"),
  ]
    .filter((entry) => entry.remaining > 0)
    .sort((left, right) => right.remaining - left.remaining || left.name.localeCompare(right.name))
    .slice(0, 12)
    .map((entry) => ({
      name: entry.name,
      meta: `${entry.group} • Need ${entry.displayNeed} • Have ${entry.displayOwned}`,
      value: entry.displayRemaining,
    }));

  return {
    fish,
    cooking,
    crafting,
    shipping,
    villagers,
    monsters,
    skills,
    stardrops,
    buildings,
    walnutsLeft,
    materials,
  };
}

function getMonsterGoalLabel(entry) {
  return entry.monsterType
    .split(":")[0]
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function matchesFishSeason(fish) {
  if (ui.fishSeason === "all") {
    return true;
  }

  const tags = getFishSeasonTags(fish);
  if (ui.fishSeason === "varies") {
    return tags.includes("varies");
  }

  return tags.includes("all") || tags.includes(ui.fishSeason);
}

function matchesFishWeather(fish) {
  if (ui.fishWeather === "all") {
    return true;
  }

  const tags = getFishWeatherTags(fish);
  return tags.includes("any") || tags.includes(ui.fishWeather);
}

function getFishTypeLabel(fish) {
  if (fish.category === "Legendary Fish") {
    return "Legendary";
  }
  if (fish.category === "Night Market Fish") {
    return "Night Market";
  }
  if (fish.category === "Crab Pot Fish") {
    return "Crab Pot";
  }
  if (fish.category === "Other Catchables") {
    return "Catchable";
  }
  return "Fish";
}

function getFishSpots(fish) {
  const spots = new Set();
  const location = fish.location || "";
  const season = fish.season || "";

  if (fish.category === "Legendary Fish") {
    spots.add("Legendary");
  }
  if (fish.category === "Night Market Fish" || /Night Market/i.test(location)) {
    spots.add("Night Market");
  }
  if (fish.category === "Crab Pot Fish") {
    spots.add("Crab Pot");
  }
  if (/(Ocean|Saltwater|Beach|East Pier|Pirate Cove)/i.test(location)) {
    spots.add("Beach");
  }
  if (/(Town River|Forest River|Forest Waterfalls|Freshwater|Everywhere but the Farm Pond)/i.test(location)) {
    spots.add("River");
  }
  if (/Mountain Lake/i.test(location)) {
    spots.add("Mountain Lake");
  }
  if (/(Forest Pond|Forest Farm)/i.test(location)) {
    spots.add("Cindersap Forest Pond");
  }
  if (/Secret Woods/i.test(location)) {
    spots.add("Secret Woods");
  }
  if (/(Mines|Ghost Drops|Levels 20, 60, and 100 of the Mines)/i.test(location)) {
    spots.add("Mines");
  }
  if (/Sewers/i.test(location)) {
    spots.add("Sewers");
  }
  if (/Desert/i.test(location)) {
    spots.add("Desert");
  }
  if (/Mutant Bug Lair/i.test(location)) {
    spots.add("Mutant Bug Lair");
  }
  if (/Witch's Swamp/i.test(location)) {
    spots.add("Witch's Swamp");
  }
  if (/(Ginger Island|Pirate Cove|Volcano Caldera|Arrowhead Island)/i.test(location) || /Ginger Island/i.test(season)) {
    spots.add("Ginger Island");
  }

  return [...spots].sort(
    (left, right) => FISH_SPOT_ORDER.indexOf(left) - FISH_SPOT_ORDER.indexOf(right)
  );
}

function getFishSeasonTags(fish) {
  const season = (fish.season || "").toLowerCase();
  const tags = [];

  if (season.includes("all seasons")) {
    tags.push("all");
  }
  if (season.includes("varies")) {
    tags.push("varies");
  }
  if (season.includes("spring")) {
    tags.push("spring");
  }
  if (season.includes("summer")) {
    tags.push("summer");
  }
  if (season.includes("fall")) {
    tags.push("fall");
  }
  if (season.includes("winter")) {
    tags.push("winter");
  }

  return tags;
}

function getFishWeatherTags(fish) {
  const weather = (fish.weather || "").toLowerCase();
  const tags = [];

  if (weather.includes("any")) {
    tags.push("any");
  }
  if (weather.includes("sun")) {
    tags.push("sun");
  }
  if (weather.includes("rain")) {
    tags.push("rain");
  }
  if (weather.includes("wind")) {
    tags.push("wind");
  }

  return tags;
}

function formatFishSeason(season) {
  return (season || "")
    .replace(
      /\b(Spring|Summer|Fall|Winter)\s+(?=(Spring|Summer|Fall|Winter)\b)/g,
      "$1, "
    )
    .replace(/\)\s+(?=(Spring|Summer|Fall|Winter)\b)/g, "), ");
}

function getProgressSnapshot() {
  const fishDone = countTrueValues(state.fish);
  const cookingDone = countTrueValues(state.cooking.recipes);
  const craftingDone = countTrueValues(state.crafting.recipes);
  const shippingDone = countTrueValues(state.shipping);
  const monsterComplete = data.other.monsterGoals.filter(
    (goal) => state.monsterGoals[goal.id] >= goal.target
  ).length;
  const friendComplete = data.other.villagers.filter(
    (villager) => state.villagers[villager.id] >= villager.targetHearts
  ).length;
  const skillsComplete = data.other.skills.filter(
    (skill) => state.skills[skill.id] >= skill.targetLevel
  ).length;
  const stardropsDone = countTrueValues(state.stardrops);
  const obeliskTotal = data.other.buildings.filter((building) => building.type === "obelisk").length;
  const obelisksDone = data.other.buildings.filter(
    (building) => building.type === "obelisk" && state.buildings[building.id]
  ).length;
  const goldClockDone = state.buildings["gold-clock"] ? 1 : 0;
  const walnutsCurrent = state.goldenWalnuts;

  const sections = {
    fish: snapshotEntry(fishDone, data.fish.length),
    cooking: snapshotEntry(cookingDone, data.cooking.recipes.length),
    crafting: snapshotEntry(craftingDone, data.crafting.recipes.length),
    shipping: snapshotEntry(shippingDone, flatShippingItems.length),
    monsters: snapshotEntry(monsterComplete, data.other.monsterGoals.length),
    friends: snapshotEntry(friendComplete, data.other.villagers.length),
    skills: snapshotEntry(skillsComplete, data.other.skills.length),
    stardrops: snapshotEntry(stardropsDone, data.other.stardrops.length),
    obelisks: snapshotEntry(obelisksDone, obeliskTotal),
    goldClock: snapshotEntry(goldClockDone, 1),
    walnuts: snapshotEntry(walnutsCurrent, data.other.goldenWalnutsTarget),
  };

  const overallWeighted =
    sections.shipping.ratio * 15 +
    sections.obelisks.ratio * 4 +
    sections.goldClock.ratio * 10 +
    sections.monsters.ratio * 10 +
    sections.friends.ratio * 11 +
    sections.skills.ratio * 5 +
    sections.stardrops.ratio * 10 +
    sections.cooking.ratio * 10 +
    sections.crafting.ratio * 10 +
    sections.fish.ratio * 10 +
    sections.walnuts.ratio * 5;

  return {
    ...sections,
    overallWeighted,
    overallPercent: overallWeighted,
  };
}

function aggregateRemainingIngredients(recipes, statusMap) {
  return recipes.reduce((totals, recipe) => {
    if (statusMap[recipe.id]) {
      return totals;
    }
    recipe.ingredients.forEach((ingredient) => {
      totals[ingredient.item] = (totals[ingredient.item] || 0) + ingredient.quantity;
    });
    return totals;
  }, {});
}

function aggregateRemainingBuildingMaterials() {
  const totals = {};
  data.other.buildings.forEach((building) => {
    if (state.buildings[building.id]) {
      return;
    }
    totals.Gold = (totals.Gold || 0) + building.goldCost;
    building.materials.forEach((material) => {
      totals[material.item] = (totals[material.item] || 0) + material.quantity;
    });
  });
  return totals;
}

function buildMaterialRows(totals, stockMap, group) {
  return Object.entries(totals).map(([name, needed]) => {
    const owned = stockMap[name] || 0;
    const remaining = Math.max(needed - owned, 0);
    return {
      group,
      name,
      needed,
      owned,
      remaining,
      displayNeed: name === "Gold" ? formatGold(needed) : formatNumber(needed),
      displayOwned: name === "Gold" ? formatGold(owned) : formatNumber(owned),
      displayRemaining: name === "Gold" ? formatGold(remaining) : `${formatNumber(remaining)} left`,
    };
  });
}

function exportSave() {
  const payload = {
    ...buildSavePayload(state),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "junimo-perfection-journal-save.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function importSave(event) {
  const input = event.currentTarget || event.target;
  const [file] = input?.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const importedSave = normalizeSavePayload(parsed);
      state = buildState(importedSave.state);
      saveState();
    } catch (error) {
      window.alert(
        error?.message === "future-save-version"
          ? "That save was made with a newer version of Junimo Perfection Journal."
          : error?.message === "invalid-save-file"
            ? "That file is not a Junimo Perfection Journal save."
          : "That file could not be imported."
      );
      return;
    }

    try {
      renderAllDynamic();
    } catch (error) {
      console.error("Imported save but failed to re-render the page.", error);
      window.alert("That save was imported, but this page needs a refresh.");
    } finally {
      if (input) {
        try {
          input.value = "";
        } catch (_error) {
          // Ignore file input reset issues after import.
        }
      }
    }
  };
  reader.onerror = () => {
    window.alert("That file could not be imported.");
    if (input) {
      try {
        input.value = "";
      } catch (_error) {
        // Ignore file input reset issues after import.
      }
    }
  };
  reader.readAsText(file);
}

function resetSave() {
  const confirmed = window.confirm("Reset all tracker progress on this Mac?");
  if (!confirmed) {
    return;
  }
  state = buildState({});
  saveState();
  renderAllDynamic();
}

function saveState() {
  writeStorageValue(STORAGE_KEY, JSON.stringify(buildSavePayload(state)));
  LEGACY_STORAGE_KEYS.forEach((key) => {
    writeStorageValue(key, JSON.stringify(state));
  });
}

function loadSaved() {
  const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of keys) {
    const raw = readStorageValue(key);
    if (!raw) {
      continue;
    }
    try {
      return normalizeSavePayload(JSON.parse(raw));
    } catch (error) {
      continue;
    }
  }
  return buildSavePayload({});
}

function buildSavePayload(stateOverride) {
  return {
    appName: data.meta.appName,
    appVersion: APP_VERSION,
    releaseName: RELEASE_NAME,
    saveVersion: SAVE_SCHEMA_VERSION,
    state: stateOverride,
  };
}

function normalizeSavePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid-save-file");
  }

  const isEnvelope =
    payload.state &&
    typeof payload.state === "object" &&
    !Array.isArray(payload.state);

  if (!isEnvelope) {
    if (!looksLikeSaveStateObject(payload)) {
      throw new Error("invalid-save-file");
    }
    return {
      ...buildSavePayload(migrateSaveState(payload, 1)),
      appVersion: "legacy",
      releaseName: "Legacy save",
    };
  }

  const saveVersion = Number.parseInt(payload.saveVersion, 10);
  if (Number.isFinite(saveVersion) && saveVersion > SAVE_SCHEMA_VERSION) {
    throw new Error("future-save-version");
  }

  if (!looksLikeSaveStateObject(payload.state)) {
    throw new Error("invalid-save-file");
  }

  return {
    appName: payload.appName || data.meta.appName,
    appVersion: payload.appVersion || "legacy",
    releaseName: payload.releaseName || "Legacy save",
    saveVersion: SAVE_SCHEMA_VERSION,
    state: migrateSaveState(payload.state, Number.isFinite(saveVersion) ? saveVersion : 1),
  };
}

function migrateSaveState(savedState, fromVersion) {
  let migrated = savedState && typeof savedState === "object" ? { ...savedState } : {};
  const startingVersion = Number.isFinite(fromVersion) && fromVersion > 0 ? fromVersion : 1;

  for (let version = startingVersion; version < SAVE_SCHEMA_VERSION; version += 1) {
    if (version === 1) {
      migrated = migrateSaveV1ToV2(migrated);
    }
  }

  return migrated;
}

function migrateSaveV1ToV2(savedState) {
  return {
    ...savedState,
    cooking: {
      recipes: savedState?.cooking?.recipes || {},
      pantry: savedState?.cooking?.pantry || {},
    },
    crafting: {
      recipes: savedState?.crafting?.recipes || {},
      stock: savedState?.crafting?.stock || {},
    },
  };
}

function looksLikeSaveStateObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return SAVE_STATE_KEYS.some((key) => Object.hasOwn(value, key));
}

function readStorageValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`Could not read tracker storage for ${key}.`, error);
    return null;
  }
}

function writeStorageValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Could not save tracker storage for ${key}.`, error);
    return false;
  }
}

function buildState(saved) {
  const cookingPantry = buildNumberMap(cookingIngredientNames, saved?.cooking?.pantry, 0, 999999);
  const craftingStock = buildNumberMap(craftingIngredientNames, saved?.crafting?.stock, 0, 999999);
  const buildingStock = buildNumberMap(buildingMaterialNames, saved?.buildingStock, 0, 999999999);

  return {
    fish: buildBooleanMap(data.fish.map((fish) => fish.id), saved?.fish),
    cooking: {
      recipes: buildBooleanMap(data.cooking.recipes.map((recipe) => recipe.id), saved?.cooking?.recipes),
      pantry: cookingPantry,
    },
    crafting: {
      recipes: buildBooleanMap(data.crafting.recipes.map((recipe) => recipe.id), saved?.crafting?.recipes),
      stock: craftingStock,
    },
    shipping: buildBooleanMap(flatShippingItems.map((item) => item.id), saved?.shipping),
    villagers: buildNumberMap(data.other.villagers.map((villager) => villager.id), saved?.villagers, 0, 14),
    monsterGoals: buildNumberMap(data.other.monsterGoals.map((goal) => goal.id), saved?.monsterGoals, 0, 999999),
    skills: buildNumberMap(data.other.skills.map((skill) => skill.id), saved?.skills, 0, 10),
    stardrops: buildBooleanMap(data.other.stardrops.map((stardrop) => stardrop.id), saved?.stardrops),
    buildings: buildBooleanMap(data.other.buildings.map((building) => building.id), saved?.buildings),
    buildingStock,
    goldenWalnuts: clampNumber(saved?.goldenWalnuts, 0, data.other.goldenWalnutsTarget),
  };
}

function buildBooleanMap(keys, saved) {
  const output = {};
  keys.forEach((key) => {
    output[key] = Boolean(saved && saved[key]);
  });
  return output;
}

function buildNumberMap(keys, saved, minimum, maximum) {
  const output = {};
  keys.forEach((key) => {
    output[key] = clampNumber(saved && saved[key], minimum, maximum);
  });
  return output;
}

function uniqueIngredientNames(recipes) {
  return [...new Set(recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.item)))].sort();
}

function uniqueBuildingMaterialNames(buildings) {
  return ["Gold", ...new Set(buildings.flatMap((building) => building.materials.map((material) => material.item))).values()].sort((left, right) => {
    if (left === "Gold") return -1;
    if (right === "Gold") return 1;
    return left.localeCompare(right);
  });
}

function snapshotEntry(current, total) {
  return {
    current,
    total,
    ratio: total ? current / total : 0,
    done: current,
  };
}

function summaryCard(label, value, detail, progressPercent) {
  return `
    <article class="summary-card">
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
      ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
      ${progressBar(progressPercent / 100)}
    </article>
  `;
}

function itemThumb(item, alt) {
  if (!item || !item.imageUrl) {
    return "";
  }
  return `<img class="item-thumb" src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(alt)}" loading="lazy" />`;
}

function progressBar(ratio) {
  const width = Math.max(0, Math.min(ratio, 1)) * 100;
  return `
    <div class="progress-track">
      <div class="progress-fill" style="width: ${width.toFixed(1)}%"></div>
    </div>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function matchesSearch(text, query) {
  if (!query) {
    return true;
  }
  return text.includes(query.toLowerCase().trim());
}

function matchesStatus(done, status) {
  if (status === "done") {
    return done;
  }
  if (status === "remaining") {
    return !done;
  }
  return true;
}

function countTrueValues(objectMap) {
  return Object.values(objectMap).filter(Boolean).length;
}

function ratioToPercent(ratio) {
  return Math.max(0, Math.min(ratio, 1)) * 100;
}

function clampNumber(value, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return minimum;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatGold(value) {
  return `${formatNumber(value)}g`;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function updateVisibleTab() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === ui.activeTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === ui.activeTab);
  });
}
