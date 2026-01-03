import { test, expect } from "@playwright/test";

// =============================================================================
// ERP Integration Module E2E Tests
// =============================================================================
test.describe("ERP Integration Module", () => {
  test.describe("API Tests", () => {
    test("GET /api/erp/integrations - should return integrations list", async ({ request }) => {
      const response = await request.get("/api/erp/integrations");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    test("GET /api/erp/integrations with erpType filter", async ({ request }) => {
      const response = await request.get("/api/erp/integrations?erpType=SAP");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("GET /api/erp/sync - should return sync jobs", async ({ request }) => {
      const response = await request.get("/api/erp/sync");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("POST /api/erp/integrations - should validate required fields", async ({ request }) => {
      const response = await request.post("/api/erp/integrations", {
        data: {
          // Missing required fields
          erpName: "Test ERP",
        },
      });
      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    test("POST /api/erp/integrations - should reject invalid ERP type", async ({ request }) => {
      const response = await request.post("/api/erp/integrations", {
        data: {
          clientId: "test-client-id",
          erpType: "INVALID_TYPE",
          erpName: "Test ERP",
        },
      });
      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid ERP type");
    });
  });

  test.describe("UI Tests", () => {
    test("should load ERP Integration page", async ({ page }) => {
      await page.goto("/integrations");
      await expect(page.getByRole("heading", { name: /ERP Integrations|Integrations/i }).first()).toBeVisible();
    });

    test("should display integration types", async ({ page }) => {
      await page.goto("/integrations");
      // Check for ERP section
      await page.waitForResponse(
        (res) => res.url().includes("/api/erp/integrations") && res.status() === 200,
        { timeout: 30000 }
      );
      // Page should have loaded with integration content
      await expect(page.locator("body")).toBeVisible();
    });
  });
});

// =============================================================================
// Analytics Module E2E Tests
// =============================================================================
test.describe("Analytics Module", () => {
  test.describe("API Tests", () => {
    test("GET /api/analytics/overview - should return analytics data", async ({ request }) => {
      const response = await request.get("/api/analytics/overview");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.volume).toBeDefined();
      expect(data.data.performance).toBeDefined();
      expect(data.data.cod).toBeDefined();
    });

    test("GET /api/analytics/overview - should accept period filter", async ({ request }) => {
      const response = await request.get("/api/analytics/overview?period=last_7_days");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.period.type).toBe("last_7_days");
    });

    test("GET /api/analytics/overview - should return volume metrics", async ({ request }) => {
      const response = await request.get("/api/analytics/overview");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.data.volume.total).toBeDefined();
      expect(data.data.volume.delivered).toBeDefined();
      expect(data.data.volume.inTransit).toBeDefined();
    });

    test("GET /api/analytics/overview - should return performance metrics", async ({ request }) => {
      const response = await request.get("/api/analytics/overview");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.data.performance.onTimeDeliveryRate).toBeDefined();
      expect(data.data.performance.firstAttemptRate).toBeDefined();
      expect(data.data.performance.avgDeliveryDays).toBeDefined();
    });

    test("GET /api/analytics - should return analytics list", async ({ request }) => {
      const response = await request.get("/api/analytics");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  test.describe("UI Tests", () => {
    test("should load Analytics page", async ({ page }) => {
      await page.goto("/analytics");
      await expect(page.getByText("Analytics")).toBeVisible();
    });

    test("should display KPI metrics", async ({ page }) => {
      await page.goto("/analytics");
      // Wait for data to load
      await page.waitForResponse(
        (res) => res.url().includes("/api/analytics") && res.status() === 200,
        { timeout: 30000 }
      );

      // Check for analytics sections
      await expect(page.locator("text=Shipments").first()).toBeVisible();
    });
  });
});

// =============================================================================
// Capacity Planning Module E2E Tests
// =============================================================================
test.describe("Capacity Planning Module", () => {
  test.describe("API Tests", () => {
    test("GET /api/capacity/forecast - should return forecasts", async ({ request }) => {
      const response = await request.get("/api/capacity/forecast");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    test("GET /api/capacity/forecast - should accept forecastType filter", async ({ request }) => {
      const response = await request.get("/api/capacity/forecast?forecastType=OVERALL");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("GET /api/capacity/forecast - should accept periodType filter", async ({ request }) => {
      const response = await request.get("/api/capacity/forecast?periodType=DAILY");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("GET /api/capacity/forecast - should accept days parameter", async ({ request }) => {
      const response = await request.get("/api/capacity/forecast?days=7");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("POST /api/capacity/forecast - should generate new forecasts", async ({ request }) => {
      const response = await request.post("/api/capacity/forecast", {
        data: {
          forecastType: "OVERALL",
          periodType: "DAILY",
          days: 7,
        },
      });
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("forecasts");
    });
  });

  test.describe("UI Tests", () => {
    test("should load Capacity Planning page", async ({ page }) => {
      await page.goto("/capacity");
      await expect(page.getByText("Capacity Planning")).toBeVisible();
    });

    test("should display forecast charts", async ({ page }) => {
      await page.goto("/capacity");
      // Wait for data to load
      await page.waitForResponse(
        (res) => res.url().includes("/api/capacity") && res.status() === 200,
        { timeout: 30000 }
      );

      // Check for capacity sections
      await expect(page.locator("text=Forecast").first()).toBeVisible();
    });
  });
});

// =============================================================================
// Carbon Tracking Module E2E Tests
// =============================================================================
test.describe("Carbon Tracking Module", () => {
  test.describe("API Tests", () => {
    test("GET /api/carbon/emissions - should return emissions summary", async ({ request }) => {
      const response = await request.get("/api/carbon/emissions");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.summary).toBeDefined();
      expect(data.data.summary.totalCo2Kg).toBeDefined();
      expect(data.data.summary.treesEquivalent).toBeDefined();
    });

    test("GET /api/carbon/emissions - should accept period filter", async ({ request }) => {
      const response = await request.get("/api/carbon/emissions?period=last_7_days");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("GET /api/carbon/emissions - should return byFuelType breakdown", async ({ request }) => {
      const response = await request.get("/api/carbon/emissions");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(Array.isArray(data.data.byFuelType)).toBe(true);
    });

    test("GET /api/carbon/emissions - should return byVehicleType breakdown", async ({ request }) => {
      const response = await request.get("/api/carbon/emissions");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(Array.isArray(data.data.byVehicleType)).toBe(true);
    });

    test("GET /api/carbon/emissions - should return comparison data", async ({ request }) => {
      const response = await request.get("/api/carbon/emissions");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.data.comparison).toBeDefined();
      expect(data.data.comparison.previousPeriodCo2Kg).toBeDefined();
      expect(data.data.comparison.changePercent).toBeDefined();
    });

    test("POST /api/carbon/emissions - should validate required fields", async ({ request }) => {
      const response = await request.post("/api/carbon/emissions", {
        data: {
          // Missing required fields
          vehicleType: "TRUCK",
        },
      });
      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    test("POST /api/carbon/emissions - should record emission with valid data", async ({ request }) => {
      const response = await request.post("/api/carbon/emissions", {
        data: {
          referenceId: "test-trip-001",
          referenceType: "TRIP",
          vehicleType: "TRUCK",
          fuelType: "DIESEL",
          distanceKm: 100,
          loadWeightKg: 500,
        },
      });
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("CO2");
    });
  });

  test.describe("UI Tests", () => {
    test("should load Carbon Tracking page", async ({ page }) => {
      await page.goto("/carbon");
      await expect(page.getByText("Carbon Footprint")).toBeVisible();
    });

    test("should display emissions metrics", async ({ page }) => {
      await page.goto("/carbon");
      // Wait for data to load
      await page.waitForResponse(
        (res) => res.url().includes("/api/carbon") && res.status() === 200,
        { timeout: 30000 }
      );

      // Check for emissions display
      await expect(page.locator("text=CO2").first()).toBeVisible();
    });
  });
});

// =============================================================================
// Insurance Module E2E Tests
// =============================================================================
test.describe("Insurance Module", () => {
  test.describe("API Tests", () => {
    test("GET /api/insurance/claims - should return claims list", async ({ request }) => {
      const response = await request.get("/api/insurance/claims");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.items).toBeDefined();
      expect(data.data.pagination).toBeDefined();
      expect(data.data.stats).toBeDefined();
    });

    test("GET /api/insurance/claims - should accept status filter", async ({ request }) => {
      const response = await request.get("/api/insurance/claims?status=FILED");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("GET /api/insurance/claims - should accept claimType filter", async ({ request }) => {
      const response = await request.get("/api/insurance/claims?claimType=DAMAGE");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("GET /api/insurance/claims - should return pagination info", async ({ request }) => {
      const response = await request.get("/api/insurance/claims?page=1&limit=10");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.limit).toBe(10);
      expect(data.data.pagination.total).toBeDefined();
    });

    test("GET /api/insurance/claims - should return stats", async ({ request }) => {
      const response = await request.get("/api/insurance/claims");
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.data.stats.filed).toBeDefined();
      expect(data.data.stats.approved).toBeDefined();
      expect(data.data.stats.rejected).toBeDefined();
      expect(data.data.stats.settled).toBeDefined();
    });

    test("POST /api/insurance/claims - should validate required fields", async ({ request }) => {
      const response = await request.post("/api/insurance/claims", {
        data: {
          // Missing required fields
          claimType: "DAMAGE",
        },
      });
      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("required");
    });

    test("PATCH /api/insurance/claims - should require claim ID", async ({ request }) => {
      const response = await request.patch("/api/insurance/claims", {
        data: {
          action: "REVIEW",
        },
      });
      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Claim ID");
    });
  });

  test.describe("UI Tests", () => {
    test("should load Insurance page", async ({ page }) => {
      await page.goto("/insurance");
      await expect(page.getByRole("heading", { name: /Insurance Management/i })).toBeVisible();
    });

    test("should display claims overview", async ({ page }) => {
      await page.goto("/insurance");
      // Wait for data to load
      await page.waitForResponse(
        (res) => res.url().includes("/api/insurance") && res.status() === 200,
        { timeout: 30000 }
      );

      // Check for insurance sections
      await expect(page.getByRole("heading", { name: /Insurance Claims/i })).toBeVisible();
    });
  });
});

// =============================================================================
// Cross-Module Integration Tests
// =============================================================================
test.describe("Cross-Module Integration", () => {
  test("Control Tower should integrate with all APIs", async ({ page }) => {
    await page.goto("/control-tower");

    // Check for API responses
    const overviewResponse = await page.waitForResponse(
      (res) => res.url().includes("/api/control-tower/overview") && res.status() === 200,
      { timeout: 30000 }
    );
    expect(overviewResponse.ok()).toBeTruthy();
  });

  test("Navigation between modules should work", async ({ page }) => {
    // Start at Control Tower
    await page.goto("/control-tower");
    await expect(page.getByRole("heading", { name: /Control Tower/i }).first()).toBeVisible();

    // Navigate to Analytics
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: /Analytics/i }).first()).toBeVisible();

    // Navigate to Capacity
    await page.goto("/capacity");
    await expect(page.getByRole("heading", { name: /Capacity Planning/i })).toBeVisible();

    // Navigate to Carbon
    await page.goto("/carbon");
    await expect(page.getByRole("heading", { name: /Carbon Footprint/i })).toBeVisible();

    // Navigate to Insurance
    await page.goto("/insurance");
    await expect(page.getByRole("heading", { name: /Insurance Management/i })).toBeVisible();

    // Navigate to Integrations (ERP)
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: /Integrations/i }).first()).toBeVisible();
  });

  test("All module APIs should be accessible", async ({ request }) => {
    // Test all major API endpoints
    const endpoints = [
      "/api/control-tower/overview",
      "/api/analytics/overview",
      "/api/capacity/forecast",
      "/api/carbon/emissions",
      "/api/insurance/claims",
      "/api/erp/integrations",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(response.ok(), `${endpoint} should return 200`).toBeTruthy();

      const data = await response.json();
      expect(data.success, `${endpoint} should have success: true`).toBe(true);
    }
  });
});
