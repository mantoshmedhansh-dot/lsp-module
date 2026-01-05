import { test, expect } from "@playwright/test";

/**
 * End-to-End Authentication Tests
 * Tests login flows for Admin Panel and Mobile App
 */

// ============================================
// ADMIN PANEL LOGIN TESTS
// ============================================

test.describe("Admin Panel Authentication", () => {
  test.describe("Login Page", () => {
    test("should display login page correctly", async ({ page }) => {
      await page.goto("/admin/login");

      // Check page elements
      await expect(page.locator("text=CJDarcl Quick")).toBeVisible();
      await expect(page.locator("text=Admin Panel Login")).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test("should show error for invalid credentials", async ({ page }) => {
      await page.goto("/admin/login");

      await page.fill('input[type="email"]', "invalid@email.com");
      await page.fill('input[type="password"]', "wrongpassword");
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator("text=Invalid credentials")).toBeVisible({ timeout: 5000 });
    });

    test("should show error for empty fields", async ({ page }) => {
      await page.goto("/admin/login");

      await page.click('button[type="submit"]');

      // HTML5 validation should prevent submission
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute("required", "");
    });
  });

  test.describe("Super Admin Login", () => {
    test("should login successfully as Super Admin", async ({ page }) => {
      await page.goto("/admin/login");

      await page.fill('input[type="email"]', "superadmin@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      // Should redirect to admin dashboard
      await expect(page).toHaveURL("/admin", { timeout: 10000 });

      // Should show dashboard content (wait for dashboard to load)
      await expect(page.locator("h1:has-text('Operations Dashboard')")).toBeVisible({ timeout: 10000 });
      // Super Admin role badge should be visible
      await expect(page.locator("text=Super Admin").first()).toBeVisible();
    });

    test("Super Admin should see all hubs", async ({ page }) => {
      await page.goto("/admin/login");
      await page.fill('input[type="email"]', "superadmin@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("/admin", { timeout: 10000 });

      // Wait for dashboard to load
      await expect(page.locator("h1:has-text('Operations Dashboard')")).toBeVisible({ timeout: 10000 });

      // Should have access to hub selector with all hubs option in the select
      const hubSelect = page.locator('select:has(option:text("All Hubs"))');
      await expect(hubSelect).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Hub Manager Login", () => {
    test("should login successfully as Delhi Hub Manager", async ({ page }) => {
      await page.goto("/admin/login");

      await page.fill('input[type="email"]', "manager.delhi@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      // Should redirect to admin dashboard
      await expect(page).toHaveURL("/admin", { timeout: 10000 });

      // Should show hub manager info
      await expect(page.locator("text=Delhi Hub Manager")).toBeVisible();
    });

    test("should login successfully as Mumbai Hub Manager", async ({ page }) => {
      await page.goto("/admin/login");

      await page.fill('input[type="email"]', "manager.mumbai@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("/admin", { timeout: 10000 });
      await expect(page.locator("text=Mumbai Hub Manager")).toBeVisible();
    });

    test("should login successfully as Bangalore Hub Manager", async ({ page }) => {
      await page.goto("/admin/login");

      await page.fill('input[type="email"]', "manager.bangalore@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("/admin", { timeout: 10000 });
      await expect(page.locator("text=Bangalore Hub Manager")).toBeVisible();
    });
  });

  test.describe("Operator Login", () => {
    test("should login successfully as Agra Operator", async ({ page }) => {
      await page.goto("/admin/login");

      await page.fill('input[type="email"]', "operator.agra@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("/admin", { timeout: 10000 });
      await expect(page.locator("text=Agra Spoke Operator")).toBeVisible();
    });

    test("should login successfully as Pune Operator", async ({ page }) => {
      await page.goto("/admin/login");

      await page.fill('input[type="email"]', "operator.pune@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("/admin", { timeout: 10000 });
      await expect(page.locator("text=Pune Spoke Operator")).toBeVisible();
    });

    test("should login successfully as Jaipur Operator", async ({ page }) => {
      await page.goto("/admin/login");

      await page.fill('input[type="email"]', "operator.jaipur@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("/admin", { timeout: 10000 });
      await expect(page.locator("text=Jaipur Operator")).toBeVisible();
    });
  });

  test.describe("Logout", () => {
    test("should logout successfully", async ({ page }) => {
      // Login first
      await page.goto("/admin/login");
      await page.fill('input[type="email"]', "superadmin@cjdquick.com");
      await page.fill('input[type="password"]', "password123");
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL("/admin", { timeout: 10000 });

      // Click on user menu and sign out
      await page.click("text=Super Admin");
      await page.click("text=Sign Out");

      // Should redirect to login page
      await expect(page).toHaveURL("/admin/login", { timeout: 5000 });
    });
  });

  test.describe("Access Control", () => {
    test("should redirect to login when accessing admin without auth", async ({ page }) => {
      await page.goto("/admin");

      // Should redirect to login
      await expect(page).toHaveURL("/admin/login", { timeout: 5000 });
    });

    test("mobile users should not be able to login to admin panel", async ({ request }) => {
      const response = await request.post("/api/admin/auth/login", {
        data: {
          email: "pickup1@cjdquick.com",
          password: "password123"
        }
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Access denied");
    });
  });
});

// ============================================
// MOBILE APP AUTH API TESTS
// ============================================

test.describe("Mobile App Authentication API", () => {
  test.describe("Pickup Agent Login", () => {
    test("should login successfully as Pickup Agent 1", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "pickup1@cjdquick.com",
          password: "password123"
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.name).toBe("Suresh Pickup Agent");
      expect(data.data.user.role).toBe("PICKUP_AGENT");
      expect(data.data.token).toBeDefined();
    });

    test("should login successfully as Pickup Agent 2", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "pickup2@cjdquick.com",
          password: "password123"
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.name).toBe("Ramesh Pickup Agent");
      expect(data.data.user.role).toBe("PICKUP_AGENT");
    });
  });

  test.describe("Delivery Agent Login", () => {
    test("should login successfully as Delivery Agent 1", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "delivery1@cjdquick.com",
          password: "password123"
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.name).toBe("Vikram Delivery Agent");
      expect(data.data.user.role).toBe("DELIVERY_AGENT");
      expect(data.data.token).toBeDefined();
    });

    test("should login successfully as Delivery Agent 2", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "delivery2@cjdquick.com",
          password: "password123"
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.name).toBe("Anil Delivery Agent");
      expect(data.data.user.role).toBe("DELIVERY_AGENT");
    });
  });

  test.describe("Hub Operator Login", () => {
    test("should login successfully as Hub Operator 1", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "hub1@cjdquick.com",
          password: "password123"
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.name).toBe("Priya Hub Operator");
      expect(data.data.user.role).toBe("HUB_OPERATOR");
      expect(data.data.token).toBeDefined();
    });

    test("should login successfully as Hub Operator 2", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "hub2@cjdquick.com",
          password: "password123"
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.name).toBe("Kavita Hub Operator");
      expect(data.data.user.role).toBe("HUB_OPERATOR");
    });
  });

  test.describe("Admin User Login", () => {
    test("should login successfully as Admin", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "admin@cjdquick.com",
          password: "password123"
        }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.name).toBe("Admin User");
      expect(data.data.user.role).toBe("ADMIN");
      expect(data.data.token).toBeDefined();
    });
  });

  test.describe("Invalid Credentials", () => {
    test("should reject invalid email", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "nonexistent@cjdquick.com",
          password: "password123"
        }
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid");
    });

    test("should reject invalid password", async ({ request }) => {
      const response = await request.post("/api/auth/login", {
        data: {
          email: "pickup1@cjdquick.com",
          password: "wrongpassword"
        }
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid");
    });
  });

  test.describe("Token Authentication", () => {
    test("should return user data with valid token", async ({ request }) => {
      // First login to get token
      const loginResponse = await request.post("/api/auth/login", {
        data: {
          email: "pickup1@cjdquick.com",
          password: "password123"
        }
      });

      const loginData = await loginResponse.json();
      const token = loginData.data.token;

      // Use token to access /me endpoint
      const meResponse = await request.get("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      expect(meResponse.ok()).toBeTruthy();
      const meData = await meResponse.json();
      expect(meData.success).toBe(true);
      expect(meData.data.email).toBe("pickup1@cjdquick.com");
    });

    test("should reject invalid token", async ({ request }) => {
      const response = await request.get("/api/auth/me", {
        headers: {
          Authorization: "Bearer invalid_token_here"
        }
      });

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    test("should reject request without token", async ({ request }) => {
      const response = await request.get("/api/auth/me");

      expect(response.status()).toBe(401);
    });
  });
});

// ============================================
// ADMIN AUTH API TESTS
// ============================================

test.describe("Admin Authentication API", () => {
  test("should login Super Admin via API", async ({ request }) => {
    const response = await request.post("/api/admin/auth/login", {
      data: {
        email: "superadmin@cjdquick.com",
        password: "password123"
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.user.role).toBe("SUPER_ADMIN");
    expect(data.data.user.hubId).toBeNull(); // Super Admin has access to all hubs
  });

  test("should login Hub Manager via API with hub assignment", async ({ request }) => {
    const response = await request.post("/api/admin/auth/login", {
      data: {
        email: "manager.delhi@cjdquick.com",
        password: "password123"
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.user.role).toBe("HUB_MANAGER");
    expect(data.data.user.hubId).toBeDefined();
    expect(data.data.user.hubCode).toBe("DEL");
    expect(data.data.user.hubName).toBe("Delhi Gateway Hub");
  });

  test("should return /me data for authenticated admin", async ({ request }) => {
    // Login first
    const loginResponse = await request.post("/api/admin/auth/login", {
      data: {
        email: "superadmin@cjdquick.com",
        password: "password123"
      }
    });

    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    // Access /me endpoint
    const meResponse = await request.get("/api/admin/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(meResponse.ok()).toBeTruthy();
    const meData = await meResponse.json();
    expect(meData.success).toBe(true);
    expect(meData.data.role).toBe("SUPER_ADMIN");
  });

  test("should logout successfully", async ({ request }) => {
    // Login first
    const loginResponse = await request.post("/api/admin/auth/login", {
      data: {
        email: "superadmin@cjdquick.com",
        password: "password123"
      }
    });

    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    // Logout
    const logoutResponse = await request.post("/api/admin/auth/logout", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(logoutResponse.ok()).toBeTruthy();
  });
});
