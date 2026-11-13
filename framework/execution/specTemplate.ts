export function buildGeneratedSpec(): string {
  return `import { test, expect, type Page, type Locator } from "@playwright/test";
import { locatorFor } from "../../framework/execution/locatorResolver";
import fs from "node:fs";
import path from "node:path";
type Action = { type: string; targetId?: string; value?: string };
type Plan = { scenarioId: string; status: "READY" | "BLOCKED"; reason: string; actions: Action[] };
const outputDir = process.env.QA_OUTPUT_DIR;
if (!outputDir) throw new Error("QA_OUTPUT_DIR must point to the selected application's generated artifacts.");
const discovery = JSON.parse(fs.readFileSync(path.join(outputDir, "discovery.json"), "utf8"));
const plans: Plan[] = JSON.parse(fs.readFileSync(path.join(outputDir, "test-plans.json"), "utf8"));
const app = JSON.parse(fs.readFileSync(path.join(outputDir, "application.json"), "utf8"));
const evidence = discovery.pages.flatMap((page: any) => page.elements || []);

async function targetFor(page: Page, id: string): Promise<Locator> {
  const item = evidence.find(item => item.id === id);
  if (!item) throw new Error("Evidence target not found: " + id);
  if (item.pageUrl) {
    const expectedPage = new URL(item.pageUrl);
    const actualPage = new URL(page.url());
    if (expectedPage.origin !== actualPage.origin || expectedPage.pathname !== actualPage.pathname) {
      throw new Error("Navigation mismatch for evidence " + id + ": expected " + expectedPage.pathname + " but was " + actualPage.pathname + ". The test plan must navigate through an evidenced link first.");
    }
  }
  const locator = locatorFor(page, item);

  // Count assertions auto-wait for delayed client-side rendering and still reject duplicates.
  await expect(locator, "Evidence " + id + " should resolve to exactly one live element").toHaveCount(1, { timeout: 10000 });
  await expect(locator, "Evidence " + id + " should be visible before interaction").toBeVisible({ timeout: 10000 });
  return locator;
}

for (const plan of plans) {
  test(plan.scenarioId + " - " + plan.status, async ({ page }) => {
    test.skip(plan.status !== "READY", plan.reason || "Insufficient UI evidence.");
    await page.goto(app.baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await expect(page.locator("body")).toBeVisible();
    for (const action of plan.actions) {
      if (action.type === "assertUrl") {
        const expected = String(action.value);
        const expectedPath = expected.startsWith("http")
          ? new URL(expected).pathname
          : new URL(expected, app.baseUrl).pathname;
        // Poll the normalized pathname. This avoids fragile full-URL/predicate comparisons
        // across query strings, trailing slashes, and browser-specific URL serialization.
        await expect.poll(
          () => new URL(page.url()).pathname,
          { message: "Expected navigation to " + expectedPath, timeout: 10000 }
        ).toBe(expectedPath);
        continue;
      }
      const target = await targetFor(page, String(action.targetId));
      switch (action.type) {
        case "click": await target.click(); break;
        case "fill": await target.fill(String(action.value)); break;
        case "select": await target.selectOption(String(action.value)); break;
        case "check": await target.check(); break;
        case "uncheck": await target.uncheck(); break;
        case "assertVisible": await expect(target).toBeVisible(); break;
        case "assertText": await expect(target).toContainText(String(action.value)); break;
        default: throw new Error("Unsupported action: " + action.type);
      }
    }
  });
}
`;
}