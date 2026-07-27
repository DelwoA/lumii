import { expect, test } from "@playwright/test";

test("public shell uses the light botanical palette", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/LUMII/);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(243, 240, 232)",
  );
});

test("sign-in screen remains available", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByText(/sign in/i).first()).toBeVisible();
});
