import { chromium } from "@playwright/test";
import type { DiscoveryEvidence } from "../../core/types";
import type { ApplicationConfig } from "../../core/types";

export async function discoverWebApplication(
  config: ApplicationConfig
): Promise<DiscoveryEvidence> {
  const browser = await chromium.launch({
    headless: config.browser?.headless ?? true
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(config.browser?.timeoutMs ?? 15000);
    const response = await page.goto(config.baseUrl, {
      waitUntil: "domcontentloaded"
    });

    const evidence = await page.evaluate(() => {
      const text = (element: Element | null): string =>
        (element?.textContent ?? "").trim().replace(/\s+/g, " ");

      const headings = Array.from(
        document.querySelectorAll("h1, h2, h3")
      ).map(text).filter(Boolean).slice(0, 60);

      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>("a[href]")
      ).map((link) => ({
        text: text(link),
        href: link.href
      })).filter((link) => link.text || link.href).slice(0, 100);

      const forms = Array.from(document.forms).map((form, index) => ({
        name: form.getAttribute("name") || form.id || `form-${index + 1}`,
        fields: Array.from(form.querySelectorAll("input, select, textarea"))
          .map((field) => {
            const element = field as HTMLInputElement;
            const id = element.id;
            const label = id
              ? text(document.querySelector(`label[for="${CSS.escape(id)}"]`))
              : "";
            return {
              name: element.name || element.id || element.getAttribute("placeholder") || "",
              type: element.type || element.tagName.toLowerCase(),
              label
            };
          })
      }));

      const buttons = Array.from(
        document.querySelectorAll("button, input[type=submit], input[type=button]")
      ).map((button) => text(button) || (button as HTMLInputElement).value)
        .filter(Boolean).slice(0, 80);

      return { title: document.title, headings, links, forms, buttons };
    });

    return {
      applicationId: config.id,
      baseUrl: config.baseUrl,
      inspectedAt: new Date().toISOString(),
      pages: [{
        url: page.url(),
        title: evidence.title,
        headings: evidence.headings,
        links: evidence.links,
        forms: evidence.forms,
        buttons: evidence.buttons
      }]
    };
  } finally {
    await browser.close();
  }
}
