import { test, expect } from "@playwright/test";

test.describe("Control Tower Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/control-tower");
  });

  test("should load the Control Tower page", async ({ page }) => {
    // Check page title/header
    await expect(page.getByText("Control Tower")).toBeVisible();
  });

  test("should display KPI cards", async ({ page }) => {
    // Wait for data to load
    await page.waitForResponse((res) =>
      res.url().includes("/api/control-tower/overview") && res.status() === 200
    );

    // Check KPI cards are visible
    await expect(page.getByText("Active Shipments", { exact: true })).toBeVisible();
    await expect(page.getByText("In Transit").first()).toBeVisible();
    await expect(page.getByText("At Risk (HIGH)")).toBeVisible();
  });

  test("should display the filter bar", async ({ page }) => {
    // Check filter bar elements
    await expect(page.getByText("All Clients (Company View)").first()).toBeVisible();
    await expect(page.getByText("Last Mile:")).toBeVisible();
    // "All" button in the Last Mile filter section
    await expect(page.locator("text=Last Mile:").locator("..").getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Own Fleet/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Partner/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Hybrid/i })).toBeVisible();
  });
});

test.describe("Control Tower - Client Selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/control-tower");
  });

  test("should open client dropdown when clicked", async ({ page }) => {
    // Click on Select Client button
    await page.getByRole("button", { name: /Select Client/i }).click();

    // Check dropdown is visible with search
    await expect(page.getByPlaceholder("Search clients...")).toBeVisible();
    // The dropdown should show All Clients option
    await expect(page.locator(".client-dropdown").getByText("All Clients (Company View)")).toBeVisible();
  });

  test("should search clients in dropdown", async ({ page }) => {
    // Open dropdown
    await page.getByRole("button", { name: /Select Client/i }).click();

    // Type in search
    const searchInput = page.getByPlaceholder("Search clients...");
    await searchInput.fill("test");

    // Search should filter the list
    await expect(searchInput).toHaveValue("test");
  });

  test("should select a client and update view indicator", async ({ page }) => {
    // Wait for clients to load
    await page.waitForResponse((res) =>
      res.url().includes("/api/control-tower/clients") && res.status() === 200
    );

    // Open dropdown
    await page.getByRole("button", { name: /Select Client/i }).click();

    // Click on "All Clients" option
    await page.locator(".client-dropdown").getByText("All Clients (Company View)").click();

    // Check view indicator shows "All Clients"
    await expect(page.locator(".border-r").getByText("All Clients (Company View)")).toBeVisible();
  });

  test("should close dropdown when clicking outside", async ({ page }) => {
    // Open dropdown
    await page.getByRole("button", { name: /Select Client/i }).click();
    await expect(page.getByPlaceholder("Search clients...")).toBeVisible();

    // Click outside
    await page.locator("body").click({ position: { x: 10, y: 10 } });

    // Dropdown should be closed
    await expect(page.getByPlaceholder("Search clients...")).not.toBeVisible();
  });
});

test.describe("Control Tower - Fulfillment Mode Filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/control-tower");
  });

  test("should have 'All' selected by default", async ({ page }) => {
    const allButton = page.getByRole("button", { name: "All" }).first();
    // The default button should have the "default" variant (not outline)
    await expect(allButton).toBeVisible();
  });

  test("should filter by Own Fleet", async ({ page }) => {
    // Click Own Fleet button
    await page.getByRole("button", { name: /Own Fleet/i }).click();

    // Wait for API call with filter
    const response = await page.waitForResponse((res) =>
      res.url().includes("/api/control-tower/overview") &&
      res.url().includes("fulfillmentMode=OWN_FLEET") &&
      res.status() === 200
    );

    expect(response.ok()).toBeTruthy();

    // Active filter tag should appear
    await expect(page.getByText("Mode: Own Fleet")).toBeVisible();
  });

  test("should filter by Partner", async ({ page }) => {
    // Click Partner button
    await page.getByRole("button", { name: /Partner/i }).first().click();

    // Wait for API call with filter
    const response = await page.waitForResponse((res) =>
      res.url().includes("/api/control-tower/overview") &&
      res.url().includes("fulfillmentMode=PARTNER") &&
      res.status() === 200
    );

    expect(response.ok()).toBeTruthy();

    // Active filter tag should appear
    await expect(page.getByText("Mode: Partner")).toBeVisible();
  });

  test("should filter by Hybrid", async ({ page }) => {
    // Click Hybrid button
    await page.getByRole("button", { name: /Hybrid/i }).click();

    // Wait for API call with filter
    const response = await page.waitForResponse((res) =>
      res.url().includes("/api/control-tower/overview") &&
      res.url().includes("fulfillmentMode=HYBRID") &&
      res.status() === 200
    );

    expect(response.ok()).toBeTruthy();

    // Active filter tag should appear
    await expect(page.getByText("Mode: Hybrid")).toBeVisible();
  });

  test("should toggle filter off when clicking same mode again", async ({ page }) => {
    // Click Own Fleet button
    await page.getByRole("button", { name: /Own Fleet/i }).click();
    await expect(page.getByText("Mode: Own Fleet")).toBeVisible();

    // Click Own Fleet again to toggle off
    await page.getByRole("button", { name: /Own Fleet/i }).click();

    // Filter tag should be gone
    await expect(page.getByText("Mode: Own Fleet")).not.toBeVisible();
  });
});

test.describe("Control Tower - Clear Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/control-tower");
  });

  test("should show Clear Filters button when filter is active", async ({ page }) => {
    // Initially no Clear Filters button
    await expect(page.getByRole("button", { name: /Clear Filters/i })).not.toBeVisible();

    // Apply a filter
    await page.getByRole("button", { name: /Own Fleet/i }).click();

    // Clear Filters button should appear
    await expect(page.getByRole("button", { name: /Clear Filters/i })).toBeVisible();
  });

  test("should clear all filters when clicking Clear Filters", async ({ page }) => {
    // Apply filters
    await page.getByRole("button", { name: /Own Fleet/i }).click();
    await expect(page.getByText("Mode: Own Fleet")).toBeVisible();

    // Click Clear Filters
    await page.getByRole("button", { name: /Clear Filters/i }).click();

    // Filter tags should be gone
    await expect(page.getByText("Mode: Own Fleet")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Clear Filters/i })).not.toBeVisible();
  });

  test("should clear individual filter by clicking X on filter tag", async ({ page }) => {
    // Apply filter
    await page.getByRole("button", { name: /Partner/i }).first().click();
    await expect(page.getByText("Mode: Partner")).toBeVisible();

    // Click X on the filter tag (the lucide-x icon within the filter tag span)
    await page.locator("span:has-text('Mode: Partner') .lucide-x").click();

    // Filter should be removed
    await expect(page.getByText("Mode: Partner")).not.toBeVisible();
  });
});

test.describe("Control Tower - Map View", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/control-tower");
  });

  test("should load map data", async ({ page }) => {
    // Wait for map data API call
    const response = await page.waitForResponse(
      (res) =>
        res.url().includes("/api/control-tower/map-data") && res.status() === 200,
      { timeout: 30000 }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

test.describe("Control Tower - API Integration", () => {
  test("overview API should return valid data", async ({ request }) => {
    const response = await request.get("/api/control-tower/overview");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.kpis).toBeDefined();
    expect(data.data.kpis.activeShipments).toBeDefined();
    expect(data.data.fulfillmentBreakdown).toBeDefined();
  });

  test("overview API should accept clientId filter", async ({ request }) => {
    const response = await request.get("/api/control-tower/overview?clientId=test-client");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.filters.clientId).toBe("test-client");
  });

  test("overview API should accept fulfillmentMode filter", async ({ request }) => {
    const response = await request.get("/api/control-tower/overview?fulfillmentMode=OWN_FLEET");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.filters.fulfillmentMode).toBe("OWN_FLEET");
  });

  test("clients API should return client list", async ({ request }) => {
    const response = await request.get("/api/control-tower/clients");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.clients)).toBe(true);
    expect(data.data.totalClients).toBeDefined();
  });

  test("map-data API should return hubs and vehicles", async ({ request }) => {
    const response = await request.get("/api/control-tower/map-data");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.hubs)).toBe(true);
    expect(Array.isArray(data.data.vehicles)).toBe(true);
    expect(data.data.bounds).toBeDefined();
  });
});
