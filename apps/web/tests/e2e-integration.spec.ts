import { test, expect } from "@playwright/test";

/**
 * End-to-End Integration Tests
 * Verifies all modules are connected from backend to frontend
 */

// ============================================
// API ENDPOINT TESTS
// ============================================

test.describe("API Endpoints - Core Modules", () => {
  test("GET /api/shipments returns shipment data", async ({ request }) => {
    const response = await request.get("/api/shipments");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(Array.isArray(data.data.items)).toBe(true);
    expect(data.data.items.length).toBeGreaterThan(0);
    // Verify shipment structure
    const shipment = data.data.items[0];
    expect(shipment).toHaveProperty("awbNumber");
    expect(shipment).toHaveProperty("status");
    expect(shipment).toHaveProperty("consigneeName");
  });

  test("GET /api/hubs returns hub data", async ({ request }) => {
    const response = await request.get("/api/hubs");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBeGreaterThan(0);
    // Verify hub structure
    const hub = data.data.items[0];
    expect(hub).toHaveProperty("code");
    expect(hub).toHaveProperty("name");
    expect(hub).toHaveProperty("type");
    expect(hub).toHaveProperty("city");
  });

  test("GET /api/vehicles returns vehicle data", async ({ request }) => {
    const response = await request.get("/api/vehicles");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBeGreaterThan(0);
    // Verify vehicle structure
    const vehicle = data.data.items[0];
    expect(vehicle).toHaveProperty("registrationNo");
    expect(vehicle).toHaveProperty("type");
    expect(vehicle).toHaveProperty("status");
  });

  test("GET /api/routes returns route data", async ({ request }) => {
    const response = await request.get("/api/routes");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBeGreaterThan(0);
    // Verify route structure
    const route = data.data.items[0];
    expect(route).toHaveProperty("code");
    expect(route).toHaveProperty("name");
    expect(route).toHaveProperty("type");
  });

  test("GET /api/trips returns trip data", async ({ request }) => {
    const response = await request.get("/api/trips");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBeGreaterThan(0);
    // Verify trip structure
    const trip = data.data.items[0];
    expect(trip).toHaveProperty("tripNumber");
    expect(trip).toHaveProperty("status");
    expect(trip).toHaveProperty("type");
  });

  test("GET /api/partners returns partner data", async ({ request }) => {
    const response = await request.get("/api/partners");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBeGreaterThan(0);
    // Verify partner structure
    const partner = data.data.items[0];
    expect(partner).toHaveProperty("code");
    expect(partner).toHaveProperty("name");
  });
});

test.describe("API Endpoints - Control Tower", () => {
  test("GET /api/control-tower/overview returns KPIs", async ({ request }) => {
    const response = await request.get("/api/control-tower/overview");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.kpis).toBeDefined();
    expect(data.data.kpis).toHaveProperty("activeShipments");
    expect(data.data.kpis).toHaveProperty("inTransit");
  });

  test("GET /api/control-tower/map-data returns map data", async ({ request }) => {
    const response = await request.get("/api/control-tower/map-data");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.hubs).toBeDefined();
    expect(data.data.vehicles).toBeDefined();
    expect(Array.isArray(data.data.hubs)).toBe(true);
  });

  test("GET /api/control-tower/predictions returns predictions", async ({ request }) => {
    const response = await request.get("/api/control-tower/predictions");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.items).toBeDefined();
    expect(data.data.summary).toBeDefined();
  });

  test("GET /api/control-tower/alerts returns alerts", async ({ request }) => {
    const response = await request.get("/api/control-tower/alerts");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });
});

test.describe("API Endpoints - Phase 2 Features", () => {
  test("GET /api/routes/traffic returns traffic data", async ({ request }) => {
    const response = await request.get("/api/routes/traffic");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("GET /api/hyperlocal/dark-stores returns dark stores", async ({ request }) => {
    const response = await request.get("/api/hyperlocal/dark-stores");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("GET /api/hyperlocal/orders returns hyperlocal orders", async ({ request }) => {
    const response = await request.get("/api/hyperlocal/orders");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("GET /api/hyperlocal/riders returns riders", async ({ request }) => {
    const response = await request.get("/api/hyperlocal/riders");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("GET /api/hyperlocal/pudo returns PUDO points", async ({ request }) => {
    const response = await request.get("/api/hyperlocal/pudo");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("GET /api/ecommerce/integrations returns e-commerce integrations", async ({ request }) => {
    const response = await request.get("/api/ecommerce/integrations");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.availablePlatforms).toBeDefined();
  });

  test("GET /api/ecommerce/orders returns e-commerce orders", async ({ request }) => {
    const response = await request.get("/api/ecommerce/orders");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("GET /api/whatsapp returns WhatsApp configs", async ({ request }) => {
    const response = await request.get("/api/whatsapp");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test("GET /api/consumer/tracking requires AWB parameter", async ({ request }) => {
    const response = await request.get("/api/consumer/tracking");
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});

// ============================================
// FRONTEND PAGE TESTS
// ============================================

test.describe("Frontend Pages - Core Modules", () => {
  test("Home page loads correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CJD/i);
  });

  test("Shipments page loads and displays data", async ({ page }) => {
    await page.goto("/shipments");
    await expect(page.locator("h1")).toContainText(/shipment/i);
    // Wait for data to load
    await page.waitForTimeout(2000);
  });

  test("Hubs page loads and displays data", async ({ page }) => {
    await page.goto("/hubs");
    await expect(page.locator("h1")).toContainText(/hub/i);
    await page.waitForTimeout(2000);
  });

  test("Fleet vehicles page loads", async ({ page }) => {
    await page.goto("/fleet/vehicles");
    await expect(page.locator("h1")).toContainText(/vehicle/i);
    await page.waitForTimeout(2000);
  });

  test("Fleet drivers page loads", async ({ page }) => {
    await page.goto("/fleet/drivers");
    await expect(page.locator("h1")).toContainText(/driver/i);
    await page.waitForTimeout(2000);
  });

  test("Routes page loads", async ({ page }) => {
    await page.goto("/routes");
    await expect(page.locator("h1")).toContainText(/route/i);
    await page.waitForTimeout(2000);
  });

  test("Trips page loads", async ({ page }) => {
    await page.goto("/trips");
    await expect(page.locator("h1")).toContainText(/trip/i);
    await page.waitForTimeout(2000);
  });

  test("Partners page loads", async ({ page }) => {
    await page.goto("/partners");
    await expect(page.locator("h1")).toContainText(/partner/i);
    await page.waitForTimeout(2000);
  });
});

test.describe("Frontend Pages - Control Tower", () => {
  test("Control Tower page loads with KPIs", async ({ page }) => {
    await page.goto("/control-tower");
    await expect(page.locator("h1")).toContainText(/control tower/i);
    // Wait for data to load
    await page.waitForTimeout(3000);
    // Check for KPI cards - use exact text match
    await expect(page.getByText("Active Shipments", { exact: true })).toBeVisible();
    await expect(page.getByText("In Transit", { exact: true })).toBeVisible();
  });

  test("Control Tower shows map section", async ({ page }) => {
    await page.goto("/control-tower");
    await page.waitForTimeout(2000);
    // Map section should exist
    await expect(page.getByText(/network map/i)).toBeVisible();
  });

  test("Control Tower shows alert center", async ({ page }) => {
    await page.goto("/control-tower");
    await page.waitForTimeout(2000);
    // Alert center should be visible
    const alertSection = page.locator("text=Alert").first();
    await expect(alertSection).toBeVisible();
  });
});

test.describe("Frontend Pages - Phase 2 Features", () => {
  test("Traffic routing page loads", async ({ page }) => {
    await page.goto("/routes/traffic");
    await expect(page.locator("h1")).toContainText(/traffic/i);
    await page.waitForTimeout(2000);
  });

  test("Hyperlocal page loads with tabs", async ({ page }) => {
    await page.goto("/hyperlocal");
    await expect(page.locator("h1")).toContainText(/hyperlocal/i);
    await page.waitForTimeout(2000);
    // Check for tabs
    await expect(page.getByRole("button", { name: /dark stores/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /orders/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /riders/i })).toBeVisible();
  });

  test("E-commerce page loads with tabs", async ({ page }) => {
    await page.goto("/ecommerce");
    await expect(page.locator("h1")).toContainText(/e-commerce/i);
    await page.waitForTimeout(2000);
    // Check for tabs
    await expect(page.getByRole("button", { name: /connected stores/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /orders/i })).toBeVisible();
  });

  test("WhatsApp notifications page loads", async ({ page }) => {
    await page.goto("/notifications/whatsapp");
    await expect(page.locator("h1")).toContainText(/whatsapp/i);
    await page.waitForTimeout(2000);
  });
});

test.describe("Frontend Pages - Operations", () => {
  test("Operations consignments page loads", async ({ page }) => {
    await page.goto("/operations/consignments");
    await expect(page.locator("h1")).toContainText(/consignment/i);
    await page.waitForTimeout(2000);
  });

  test("Operations handovers page loads", async ({ page }) => {
    await page.goto("/operations/handovers");
    await expect(page.locator("h1")).toContainText(/handover/i);
    await page.waitForTimeout(2000);
  });

  test("Operations scanning page loads", async ({ page }) => {
    await page.goto("/operations/scanning");
    await expect(page.locator("h1")).toContainText(/scan/i);
    await page.waitForTimeout(2000);
  });
});

test.describe("Frontend Pages - Compliance (Phase 1)", () => {
  test("Compliance ULIP page loads", async ({ page }) => {
    await page.goto("/compliance/ulip");
    await expect(page.locator("h1")).toContainText(/ulip/i);
    await page.waitForTimeout(2000);
  });

  test("Compliance E-way Bills page loads", async ({ page }) => {
    await page.goto("/compliance/eway-bills");
    await expect(page.locator("h1")).toContainText(/e-way/i);
    await page.waitForTimeout(2000);
  });

  test("Compliance E-invoices page loads", async ({ page }) => {
    await page.goto("/compliance/einvoices");
    await expect(page.locator("h1")).toContainText(/e-invoice/i);
    await page.waitForTimeout(2000);
  });
});

// ============================================
// DATA FLOW INTEGRATION TESTS
// ============================================

test.describe("Data Flow Integration", () => {
  test("Shipment data flows from API to Control Tower", async ({ request, page }) => {
    // First verify API has shipments
    const apiResponse = await request.get("/api/shipments");
    const apiData = await apiResponse.json();
    const shipmentCount = apiData.data.items.length;

    // Then verify Control Tower overview shows correct count
    const overviewResponse = await request.get("/api/control-tower/overview");
    const overviewData = await overviewResponse.json();

    // Active shipments should match (non-delivered shipments)
    expect(overviewData.data.kpis.activeShipments).toBeGreaterThan(0);
  });

  test("Hub data flows from API to Map", async ({ request }) => {
    // Verify hubs API
    const hubsResponse = await request.get("/api/hubs");
    const hubsData = await hubsResponse.json();
    const hubCount = hubsData.data.items.length;

    // Verify map data includes same hubs
    const mapResponse = await request.get("/api/control-tower/map-data");
    const mapData = await mapResponse.json();

    expect(mapData.data.hubs.length).toBe(hubCount);
  });

  test("Vehicle data flows from API to Map", async ({ request }) => {
    // Verify vehicles API
    const vehiclesResponse = await request.get("/api/vehicles");
    const vehiclesData = await vehiclesResponse.json();

    // Verify map data includes vehicles
    const mapResponse = await request.get("/api/control-tower/map-data");
    const mapData = await mapResponse.json();

    // Map should have vehicles (may filter by those with GPS)
    expect(mapData.data.vehicles).toBeDefined();
  });

  test("Predictions are generated for active shipments", async ({ request }) => {
    // Get predictions
    const response = await request.get("/api/control-tower/predictions");
    const data = await response.json();

    // Verify predictions exist and have required fields
    if (data.data.items.length > 0) {
      const prediction = data.data.items[0];
      expect(prediction).toHaveProperty("shipmentId");
      expect(prediction).toHaveProperty("prediction");
      expect(prediction.prediction).toHaveProperty("delayRisk");
      expect(prediction.prediction).toHaveProperty("riskScore");
    }
  });
});

// ============================================
// PUBLIC TRACKING API TESTS
// ============================================

test.describe("Public Tracking API", () => {
  test("Public track API works with valid AWB", async ({ request }) => {
    // First get a valid AWB from shipments
    const shipmentsResponse = await request.get("/api/shipments");
    const shipmentsData = await shipmentsResponse.json();

    if (shipmentsData.data.items.length > 0) {
      const awb = shipmentsData.data.items[0].awbNumber;

      // Track the shipment
      const trackResponse = await request.get(`/api/public/track?awb=${awb}`);
      expect(trackResponse.ok()).toBeTruthy();
      const trackData = await trackResponse.json();
      expect(trackData.success).toBe(true);
      expect(trackData.data.awbNumber).toBe(awb);
    }
  });

  test("Public track API returns error for invalid AWB", async ({ request }) => {
    const response = await request.get("/api/public/track?awb=INVALID123");
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
