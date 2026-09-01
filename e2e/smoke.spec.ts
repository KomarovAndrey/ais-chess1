import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Soft Skills/i }).first()).toBeVisible();
  });

  test("reversi page loads", async ({ page }) => {
    await page.goto("/reversi");
    await expect(page.locator("body")).toContainText(/Reversi|реверси/i);
  });

  test("soft-skills hub loads", async ({ page }) => {
    await page.goto("/soft-skills");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("ratings page loads", async ({ page }) => {
    await page.goto("/ratings");
    await expect(page.locator("body")).toContainText(/рейтинг|Рейтинг|участник/i);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /войти/i })).toBeVisible();
  });
});
