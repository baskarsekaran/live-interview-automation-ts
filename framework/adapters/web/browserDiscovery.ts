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

export async function discoverWebApplication(config: ApplicationConfig, requirement = ""): Promise<DiscoveryEvidence> {
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
        const requirementTerms = new Set(
          requirement.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []
        );
        const candidates = captured.links
          .filter(link => isSafeInternalLink(link.href, base.origin))
          .map((link, index) => {
            const searchable = (link.text + " " + new URL(link.href).pathname).toLowerCase();
            const path = new URL(link.href).pathname.toLowerCase();
            const requirementScore = [...requirementTerms].reduce((sum, term) => sum + (searchable.includes(term) ? 1 : 0), 0);
            // Prefer concrete workflow destinations over broad category/archive pages.
            const routePriority = path.includes("/product_details/") ? 100
              : path.includes("/view_cart") ? 70
              : path.includes("/products") ? 30
              : path.includes("/category_products/") || path.includes("/brand_products/") ? -20
              : 0;
            const score = requirementScore + routePriority;
            return { link, index, score };
          })
          .sort((a, b) => b.score - a.score || a.index - b.index);
        for (const candidate of candidates) {
          const nextUrl = normalizeUrl(candidate.link.href);
          if (nextUrl && !visited.has(nextUrl) && !queue.some(item => normalizeUrl(item.url) === nextUrl)) {
            queue.push({ url: nextUrl, depth: current.depth + 1 });
          }
        }
        // Diversify discovery: do not let many records of the same route pattern
        // consume the page budget before primary workflow pages are inspected.
        const routePattern = (url: string) =>
          new URL(url).pathname.toLowerCase().replace(/\d+/g, ":id").replace(/\/+$/, "") || "/";
        const routeCounts = new Map<string, number>();
        for (const discovered of pages) {
          const pattern = routePattern(discovered.url);
          routeCounts.set(pattern, (routeCounts.get(pattern) ?? 0) + 1);
        }
        const queueCounts = new Map<string, number>();
        const diversifiedQueue: typeof queue = [];
        for (const candidate of queue) {
          const pattern = routePattern(candidate.url);
          const totalForPattern = (routeCounts.get(pattern) ?? 0) + (queueCounts.get(pattern) ?? 0);
          const isPrimaryWorkflowPage = /\/(products|view_cart|cart)(?:\/|$)/i.test(new URL(candidate.url).pathname);
          const maxPerPattern = isPrimaryWorkflowPage ? 4 : 2;
          if (totalForPattern >= maxPerPattern) continue;
          queueCounts.set(pattern, (queueCounts.get(pattern) ?? 0) + 1);
          diversifiedQueue.push(candidate);
        }
        queue.length = 0;
        queue.push(...diversifiedQueue);

        // Rank user-facing workflow destinations above individual product records
        // and broad category/archive pages.
        queue.sort((a, b) => {
          const priority = (url: string) => {
            const pathname = new URL(url).pathname.toLowerCase();
            if (/\/(view_cart|cart)(?:\/|$)/.test(pathname)) return 200;
            if (/\/products(?:\/|$)/.test(pathname)) return 180;
            if (/\/product_details\//.test(pathname)) return 60;
            if (/\/(category_products|brand_products)\//.test(pathname)) return 20;
            return 100;
          };
          return priority(b.url) - priority(a.url);
        });
      } catch (error) {
        console.warn(`Discovery skipped ${normalized}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { applicationId: config.id, baseUrl: config.baseUrl, inspectedAt: new Date().toISOString(), pages };
  } finally { await browser.close(); }
}
