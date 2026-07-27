import { expect, test } from "@playwright/test";

test("quick start captures a scoreable session intention", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(
    page.getByRole("heading", { name: "Set your study intention" }),
  ).toBeVisible();
  await expect(page.getByLabel("Session title")).toHaveValue("Focused study");
  await expect(page.getByLabel("Target duration")).toHaveValue("25");
  await expect(page.getByText("10 minutes–4 hours")).toBeVisible();
});

test("progress exposes durable quality history and exports", async ({
  page,
}) => {
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Progress", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Session quality", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Session history" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "CSV history" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF report" })).toBeVisible();
});

test("timetable view choice is URL-backed", async ({ page }) => {
  await page.goto("/timetable");
  await page.getByRole("button", { name: "Week" }).click();
  await expect(page).toHaveURL(/view=week/);
  await page.getByRole("button", { name: "List" }).click();
  await expect(page).toHaveURL(/view=list/);
});
