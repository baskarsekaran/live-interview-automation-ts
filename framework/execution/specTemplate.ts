export function buildGeneratedSpec(): string {
  return `import { test, expect, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
type Evidence = { id: string; tag: string; role: string; text: string; label: string; placeholder: string; inputType: string; name: string; elementId: string; href: string };
type Action = { type: string; targetId?: string; value?: string };
type Plan = { scenarioId: string; status: "READY" | "BLOCKED"; reason: string; actions: Action[] };
const outputDir = process.env.QA_OUTPUT_DIR;
if (!outputDir) throw new Error("QA_OUTPUT_DIR must point to the selected application's generated artifacts.");
const discovery = JSON.parse(fs.readFileSync(path.join(outputDir, "discovery.json"), "utf8"));
const plans: Plan[] = JSON.parse(fs.readFileSync(path.join(outputDir, "test-plans.json"), "utf8"));
const app = JSON.parse(fs.readFileSync(path.join(outputDir, "application.json"), "utf8"));
const evidence: Evidence[] = discovery.pages.flatMap((page: any) => page.elements || []);

function locatorFor(page: Page, item: Evidence): Locator {
  // Prefer stable, directly discovered attributes over rendered accessible text.
  if (item.elementId) return page.locator("[id=" + JSON.stringify(item.elementId) + "]");
  if (item.tag === "a" && item.href) return page.locator("a[href=" + JSON.stringify(item.href) + "]");
  if (item.label) return page.getByLabel(item.label, { exact: true });
  if (item.placeholder) return page.getByPlaceholder(item.placeholder, { exact: true });
  if (item.name) return page.locator("[name=" + JSON.stringify(item.name) + "]");
  if (item.role !== "generic" && item.text) return page.getByRole(item.role as any, { name: item.text, exact: true });
  if (item.text) return page.getByText(item.text, { exact: true });
  throw new Error("No safe locator strategy for " + item.id);
}

async function targetFor(page: Page, id: string): Promise<Locator> {
  const item = evidence.find(item => item.id === id);
  if (!item) throw new Error("Evidence target not found: " + id);
  const locator = locatorFor(page, item);

  // Count assertions auto-wait for delayed client-side rendering and still reject duplicates.
  await expect(locator, "Evidence " + id + " should resolve to exactly one live element").toHaveCount(1, { timeout: 10000 });
  await expect(locator, "Evidence " + id + " should be visible before interaction").toBeVisible({ timeout: 10000 });
  return locator;
}

for (const plan of plans) {
  test(plan.scenarioId + " - " + plan.status, async ({ page }) => {
    test.skip(plan.status !== "READY", plan.reason || "Insufficient UI evidence.");
    await page.goto(app.baseUrl, { waitUntil: "load" });
    await expect(page.locator("body")).toBeVisible();
    for (const action of plan.actions) {
      if (action.type === "assertUrl") {
        await expect(page).toHaveURL(url => url.href.includes(String(action.value)));
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