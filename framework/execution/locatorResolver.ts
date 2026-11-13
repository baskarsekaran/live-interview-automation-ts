import type { Page, Locator } from "@playwright/test";
import type { DiscoveryElement } from "../core/types";

/**
 * Resolve a locator from previously captured discovery evidence.
 * The caller must still validate uniqueness and visibility against the live page.
 */
export function locatorFor(page: Page, item: DiscoveryElement): Locator {
  if (item.elementId) {
    return page.locator("[id=" + JSON.stringify(item.elementId) + "]");
  }

  if (item.tag === "a" && item.href) {
    const hrefPath = new URL(item.href, page.url()).pathname;
    const hrefLocator = page.locator("a[href$=" + JSON.stringify(hrefPath) + "]");

    if (item.text) {
      const escapedText = item.text.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      return hrefLocator.filter({
        hasText: new RegExp("^\\s*" + escapedText + "\\s*$")
      });
    }

    return hrefLocator;
  }

  if (item.label) return page.getByLabel(item.label, { exact: true });
  if (item.placeholder) return page.getByPlaceholder(item.placeholder, { exact: true });
  if (item.name) return page.locator("[name=" + JSON.stringify(item.name) + "]");
  if (item.role !== "generic" && item.text) {
    return page.getByRole(item.role as any, { name: item.text, exact: true });
  }
  if (item.text) return page.getByText(item.text, { exact: true });

  throw new Error("No safe locator strategy for " + item.id);
}
