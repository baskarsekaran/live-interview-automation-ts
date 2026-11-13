import { chromium } from "@playwright/test";
import type { DiscoveryEvidence, DiscoveryElement, ApplicationConfig } from "../../core/types";

export async function discoverWebApplication(config: ApplicationConfig): Promise<DiscoveryEvidence> {
  const browser = await chromium.launch({ headless: config.browser?.headless ?? true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(config.browser?.timeoutMs ?? 15000);
    await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" });
    const evidence = await page.evaluate(() => {
      const text = (element: Element | null): string => (element?.textContent ?? "").trim().replace(/\\s+/g, " ");
      const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map(text).filter(Boolean).slice(0, 60);
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map(link => ({ text: text(link), href: link.href })).filter(link => link.text || link.href).slice(0, 100);
      const forms = Array.from(document.forms).map((form, index) => ({
        name: form.getAttribute("name") || form.id || `form-${index + 1}`,
        fields: Array.from(form.querySelectorAll("input, select, textarea")).map(field => {
          const element = field as HTMLInputElement;
          const label = element.id ? text(document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) : "";
          return { name: element.name || element.id || element.getAttribute("placeholder") || "", type: element.type || element.tagName.toLowerCase(), label };
        })
      }));
      const buttons = Array.from(document.querySelectorAll("button, input[type=submit], input[type=button]"))
        .map(button => text(button) || (button as HTMLInputElement).value).filter(Boolean).slice(0, 80);
      const interactive = Array.from(document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=link]")).slice(0, 250);
      const elements = interactive.map((element, index) => {
        const input = element as HTMLInputElement;
        const label = element.id
          ? text(document.querySelector(`label[for="${CSS.escape(element.id)}"]`))
          : text(element.closest("label"));
        const role = element.getAttribute("role") ||
          (element.tagName.toLowerCase() === "a" ? "link" : element.tagName.toLowerCase() === "button" ? "button" :
           element.tagName.toLowerCase() === "textarea" ? "textbox" : element.tagName.toLowerCase() === "select" ? "combobox" :
           element.tagName.toLowerCase() === "input" ? (["button", "submit"].includes(input.type) ? "button" : ["checkbox", "radio"].includes(input.type) ? input.type : "textbox") : "generic");
        return {
          id: `E${String(index + 1).padStart(3, "0")}`, tag: element.tagName.toLowerCase(), role,
          text: text(element).slice(0, 160) || input.value || "", label,
          placeholder: element.getAttribute("placeholder") || "", inputType: input.type || "",
          name: element.getAttribute("name") || "", elementId: element.id || "",
          href: (element as HTMLAnchorElement).href || ""
        };
      });
      return { title: document.title, headings, links, forms, buttons, elements };
    });
    return {
      applicationId: config.id, baseUrl: config.baseUrl, inspectedAt: new Date().toISOString(),
      pages: [{ url: page.url(), title: evidence.title, headings: evidence.headings, links: evidence.links,
        forms: evidence.forms, buttons: evidence.buttons, elements: evidence.elements as DiscoveryElement[] }]
    };
  } finally { await browser.close(); }
}