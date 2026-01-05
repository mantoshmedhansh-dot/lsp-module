import { test, expect } from "@playwright/test";

/**
 * Admin Dashboard End-to-End Tests
 * Tests navigation, components, and functionality
 */

// Helper to login as Super Admin
async function loginAsSuperAdmin(page: any) {
  await page.goto("/admin/login");
  await page.fill('input[type="email"]', "superadmin@cjdquick.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/admin", { timeout: 10000 });
}

// ============================================
// DASHBOARD TESTS
// ============================================

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("should display dashboard with all stats cards", async ({ page }) => {
    // Wait for dashboard to load (check for header)
    await expect(page.locator("h1:has-text('Operations Dashboard')")).toBeVisible({ timeout: 10000 });

    // Check for stat cards (use text-sm which contains the title)
    await expect(page.locator("p.text-sm:has-text('Hubs')").first()).toBeVisible();
    await expect(page.locator("p.text-sm:has-text('Vehicles')").first()).toBeVisible();
    await expect(page.locator("p.text-sm:has-text('Drivers')").first()).toBeVisible();
    await expect(page.locator("p.text-sm:has-text('Routes')").first()).toBeVisible();
    await expect(page.locator("p.text-sm:has-text('Trips')").first()).toBeVisible();
    await expect(page.locator("p.text-sm:has-text('Shipments')").first()).toBeVisible();
  });

  test("should display phase sections", async ({ page }) => {
    await expect(page.locator("h3:has-text('Hub Network')")).toBeVisible();
    await expect(page.locator("h3:has-text('Fleet Management')")).toBeVisible();
  });

  test("should have working refresh button", async ({ page }) => {
    const refreshButton = page.locator("text=Refresh");
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();
    // Page should still be on dashboard after refresh
    await expect(page).toHaveURL("/admin");
  });
});

// ============================================
// SIDEBAR NAVIGATION TESTS
// ============================================

test.describe("Admin Sidebar Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("should navigate to Hubs page", async ({ page }) => {
    await page.click("text=Hubs");
    await expect(page).toHaveURL("/admin/hubs");
    await expect(page.locator("h1")).toContainText("Hub");
  });

  test("should navigate to Pincode Coverage page", async ({ page }) => {
    await page.click("text=Pincode Coverage");
    await expect(page).toHaveURL("/admin/pincodes");
  });

  test("should navigate to Vehicles page", async ({ page }) => {
    await page.click("text=Vehicles");
    await expect(page).toHaveURL("/admin/vehicles");
    await expect(page.locator("h1")).toContainText("Vehicle");
  });

  test("should navigate to Drivers page", async ({ page }) => {
    await page.click("text=Drivers");
    await expect(page).toHaveURL("/admin/drivers");
    await expect(page.locator("h1")).toContainText("Driver");
  });

  test("should navigate to Routes page", async ({ page }) => {
    await page.click("text=Routes");
    await expect(page).toHaveURL("/admin/routes");
    await expect(page.locator("h1")).toContainText("Route");
  });

  test("should navigate to Trips page", async ({ page }) => {
    await page.click("text=Trips");
    await expect(page).toHaveURL("/admin/trips");
    await expect(page.locator("h1")).toContainText("Trip");
  });

  test("should navigate to All Shipments page", async ({ page }) => {
    await page.click("text=All Shipments");
    await expect(page).toHaveURL("/admin/shipments");
    await expect(page.locator("h1")).toContainText("Shipment");
  });

  test("should navigate to Consignments page", async ({ page }) => {
    await page.click("text=Consignments");
    await expect(page).toHaveURL("/admin/consignments");
  });

  test("should navigate to Journey Plans page", async ({ page }) => {
    await page.click("text=Journey Plans");
    await expect(page).toHaveURL("/admin/journeys");
  });

  test("should navigate to Hub Scanning page", async ({ page }) => {
    await page.click("text=Hub Scanning");
    await expect(page).toHaveURL("/admin/scanning");
  });

  test("should navigate to Partner Handovers page", async ({ page }) => {
    await page.click("text=Partner Handovers");
    await expect(page).toHaveURL("/admin/handovers");
  });

  test("should navigate to Settings page", async ({ page }) => {
    await page.click("text=Settings");
    await expect(page).toHaveURL("/admin/settings");
  });

  test("should collapse and expand sidebar", async ({ page }) => {
    // Find collapse button and click it
    const collapseButton = page.locator('button:has(svg)').first();
    await collapseButton.click();

    // Sidebar should be collapsed (narrow width)
    // Click again to expand
    await collapseButton.click();
  });
});

// ============================================
// HUB SELECTOR TESTS
// ============================================

test.describe("Hub Selector", () => {
  test("Super Admin should see All Hubs option", async ({ page }) => {
    await loginAsSuperAdmin(page);
    // Wait for dashboard to load
    await expect(page.locator("h1:has-text('Operations Dashboard')")).toBeVisible({ timeout: 10000 });
    // Check for hub selector select element with All Hubs option
    const hubSelect = page.locator('select:has(option:text("All Hubs"))');
    await expect(hubSelect).toBeVisible({ timeout: 5000 });
  });

  test("Hub Manager should see their assigned hub", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[type="email"]', "manager.delhi@cjdquick.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/admin", { timeout: 10000 });

    // Wait for dashboard to load
    await expect(page.locator("h1:has-text('Operations Dashboard')")).toBeVisible({ timeout: 10000 });
    // Should show Delhi hub in the hub selector select
    const hubSelect = page.locator('select:has(option:text("DEL"))');
    await expect(hubSelect).toBeVisible({ timeout: 5000 });
  });
});

// ============================================
// HUBS PAGE TESTS
// ============================================

test.describe("Hubs Management Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.click("text=Hubs");
    await expect(page).toHaveURL("/admin/hubs");
  });

  test("should display list of hubs", async ({ page }) => {
    // Wait for page to load and data to appear
    await expect(page.locator("h1")).toContainText("Hub");
    // Wait for table or content to load
    await page.waitForLoadState("networkidle");

    // Check for hub codes (use first() to handle multiple matches)
    await expect(page.locator("text=DEL").first()).toBeVisible({ timeout: 10000 });
  });

  test("should show hub types", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Check that the page has table with hub data (type shown in badge or table cell)
    // Look for table cells or badges containing hub type text
    const hubTypeCell = page.locator("td:has-text('GATEWAY'), span:has-text('GATEWAY'), [class*='badge']:has-text('GATEWAY')");
    await expect(hubTypeCell.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// VEHICLES PAGE TESTS
// ============================================

test.describe("Vehicles Management Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.click("text=Vehicles");
    await expect(page).toHaveURL("/admin/vehicles");
  });

  test("should display list of vehicles", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Vehicle");
    await page.waitForLoadState("networkidle");

    // Check for vehicle registration numbers or page content
    await expect(page.locator("text=DL").first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// DRIVERS PAGE TESTS
// ============================================

test.describe("Drivers Management Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.click("text=Drivers");
    await expect(page).toHaveURL("/admin/drivers");
  });

  test("should display list of drivers", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Driver");
    await page.waitForLoadState("networkidle");

    // Check for driver data on page (code or name)
    await expect(page.locator("text=DRV").first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// SHIPMENTS PAGE TESTS
// ============================================

test.describe("Shipments Management Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.click("text=All Shipments");
    await expect(page).toHaveURL("/admin/shipments");
  });

  test("should display list of shipments", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Shipment");
    await page.waitForLoadState("networkidle");

    // Check for AWB numbers or shipment data
    await expect(page.locator("text=CJD").first()).toBeVisible({ timeout: 10000 });
  });

  test("should show shipment statuses", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Shipment");
    await page.waitForLoadState("networkidle");

    // Should have some status text visible (IN_HUB, IN_TRANSIT, etc.)
    const statusText = page.locator("text=/IN_HUB|IN_TRANSIT|DELIVERED|PENDING/i");
    await expect(statusText.first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// ORDERS PAGE TESTS
// ============================================

test.describe("Orders Management Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.click("text=All Orders");
    await expect(page).toHaveURL("/admin/orders");
  });

  test("should display orders page", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Order");
  });
});

// ============================================
// ROUTES PAGE TESTS
// ============================================

test.describe("Routes Management Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.click("text=Routes");
    await expect(page).toHaveURL("/admin/routes");
  });

  test("should display list of routes", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Route");
    await page.waitForLoadState("networkidle");

    // Check for route type or route code
    await expect(page.locator("text=/LINE_HAUL|MILK_RUN|RTN/i").first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// TRIPS PAGE TESTS
// ============================================

test.describe("Trips Management Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.click("text=Trips");
    await expect(page).toHaveURL("/admin/trips");
  });

  test("should display list of trips", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Trip");
    await page.waitForLoadState("networkidle");

    // Check for trip numbers or status
    await expect(page.locator("text=/TRP|PLANNED|IN_TRANSIT|COMPLETED/i").first()).toBeVisible({ timeout: 10000 });
  });
});

// ============================================
// RESPONSIVE DESIGN TESTS
// ============================================

test.describe("Responsive Design", () => {
  test("should work on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsSuperAdmin(page);

    // Dashboard should still be accessible
    await expect(page.locator("text=Operations Dashboard")).toBeVisible();
  });

  test("should work on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAsSuperAdmin(page);

    await expect(page.locator("text=Operations Dashboard")).toBeVisible();
  });
});
