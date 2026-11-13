import { chromium, type Page } from "@playwright/test";
import type { DiscoveryEvidence, DiscoveryElement, ApplicationConfig } from "../../core/types";

interface CapturedPage {
  url: string; title: string; depth: number; headings: string[];
  links: Array<{ text: string; href: string }>;
  forms: Array<{ name: string; fields: Array<{ name: string; type: string; label: string }> }>;
  buttons: string[]; elements: DiscoveryElement[];
}

const BLOCKED_PATH_SEGMENTS = ["logout", "signout", "delete", "remove", "destroy", "checkout", "payment", "purchase", "place-order", "confirm-order", "cancel"];

function normalizeUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    url.hash = "";
    if (url.search) return undefined;
    return url.toString().replace(/\/$/, "") || url.origin;
  } catch { return undefined; }
}

function isSafeInternalLink(raw: string, baseOrigin: string): boolean {
  try {
    const url = new URL(raw);
    if (url.origin !== baseOrigin || !["http:", "https:"].includes(url.protocol) || url.search || url.hash) return false;
    return !url.pathname.toLowerCase().split("/").filter(Boolean).some(segment =>
      BLOCKED_PATH_SEGMENTS.some(blocked => segment === blocked || segment.startsWith(blocked + "-") || segment.startsWith(blocked + "_"))
    );
  } catch { return false; }
}

async function capturePage(page: Page, pageUrl: string, depth: number, nextId: () => string): Promise<CapturedPage> {
  const captured = await page.evaluate(() => {
    const text = (element: Element | null): string => (element?.textContent ?? "").trim().replace(/\s+/g, " ");
    const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map(text).filter(Boolean).slice(0, 60);
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map(link => ({ text: text(link), href: link.href })).filter(link => link.text || link.href).slice(0, 120);
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
    const elements = interactive.map(element => {
      const input = element as HTMLInputElement;
      const label = element.id ? text(document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) : text(element.closest("label"));
      const role = element.getAttribute("role") ||
        (element.tagName.toLowerCase() === "a" ? "link" : element.tagName.toLowerCase() === "button" ? "button" :
         element.tagName.toLowerCase() === "textarea" ? "textbox" : element.tagName.toLowerCase() === "select" ? "combobox" :
         element.tagName.toLowerCase() === "input" ? (["button", "submit"].includes(input.type) ? "button" : ["checkbox", "radio"].includes(input.type) ? input.type : "textbox") : "generic");
      return {
        tag: element.tagName.toLowerCase(), role, text: text(element).slice(0, 160) || input.value || "", label,
        placeholder: element.getAttribute("placeholder") || "", inputType: input.type || "",
        name: element.getAttribute("name") || "", elementId: element.id || "",
        href: (element as HTMLAnchorElement).href || ""
      };
    });
    return { title: document.title, headings, links, forms, buttons, elements };
  });
  return {
    url: pageUrl, title: captured.title, depth, headings: captured.headings, links: captured.links,
    forms: captured.forms, buttons: captured.buttons,
    elements: captured.elements.map(item => ({ ...item, id: nextId(), pageUrl }))
  };
}

export async function discoverWebApplication(config: ApplicationConfig): Promise<DiscoveryEvidence> {
  const browser = await chromium.launch({ headless: config.browser?.headless ?? true });
  const maxPages = Math.max(1, Math.min(config.discovery?.maxPages ?? 8, 20));
  const maxDepth = Math.max(0, Math.min(config.discovery?.maxDepth ?? 2, 4));
  const base = new URL(config.baseUrl);
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: normalizeUrl(config.baseUrl) ?? config.baseUrl, depth: 0 }];
  const pages: CapturedPage[] = [];
  let elementSequence = 0;
  const nextId = () => `E${String(++elementSequence).padStart(4, "0")}`;

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(config.browser?.timeoutMs ?? 15000);
    while (queue.length && pages.length < maxPages) {
      const current = queue.shift()!;
      const normalized = normalizeUrl(current.url);
      if (!normalized || visited.has(normalized)) continue;
      visited.add(normalized);
      try {
        await page.goto(normalized, { waitUntil: "domcontentloaded", timeout: config.browser?.timeoutMs ?? 20000 });
        const finalUrl = normalizeUrl(page.url());
        if (!finalUrl || new URL(finalUrl).origin !== base.origin) continue;
        const captured = await capturePage(page, finalUrl, current.depth, nextId);
        pages.push(captured);
        if (current.depth >= maxDepth) continue;
        for (const link of captured.links) {
          if (!isSafeInternalLink(link.href, base.origin)) continue;
          const nextUrl = normalizeUrl(link.href);
          if (nextUrl && !visited.has(nextUrl) && !queue.some(item => normalizeUrl(item.url) === nextUrl)) {
            queue.push({ url: nextUrl, depth: current.depth + 1 });
          }
        }
      } catch (error) {
        console.warn(`Discovery skipped ${normalized}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { applicationId: config.id, baseUrl: config.baseUrl, inspectedAt: new Date().toISOString(), pages };
  } finally { await browser.close(); }
}
