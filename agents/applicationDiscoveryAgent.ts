import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { chromium, Page } from "@playwright/test";

dotenv.config();

const ROOT = process.cwd();

const CONFIG_PATH = path.join(ROOT, "config", "application.json");
const REQUIREMENT_PATH = path.join(ROOT, "input", "requirement.txt");
const SCENARIOS_PATH = path.join(ROOT, "output", "test-scenarios.json");
const OUTPUT_PATH = path.join(ROOT, "output", "application-discovery.json");

const MAX_PAGES_TO_INSPECT = 10;
const PAGE_NAVIGATION_TIMEOUT = 30000;

type Capability =
  | "authentication"
  | "productListing"
  | "search"
  | "filtering"
  | "sorting"
  | "pagination"
  | "cart"
  | "checkout"
  | "forms"
  | "navigation";

interface ApplicationConfig {
  name?: string;
  baseUrl?: string;
  url?: string;
  [key: string]: unknown;
}

interface LoginCredentials {
  username?: string;
  password?: string;
}

interface DiscoveredElement {
  tag: string;
  text: string;
  role: string | null;
  accessibleLabel: string | null;
  placeholder: string | null;
  name: string | null;
  type: string | null;
  id: string | null;
  testId: string | null;
  href: string | null;
  title: string | null;
  className: string | null;
  autocomplete: string | null;
  visible: boolean;
  enabled: boolean;
}

interface DiscoveredLink {
  text: string;
  href: string;
  title: string | null;
  visible: boolean;
}

interface InspectedPage {
  url: string;
  title: string;
  bodyText: string;
  elements: DiscoveredElement[];
  discoveredLinks: DiscoveredLink[];
  elementCounts: {
    inputs: number;
    buttons: number;
    links: number;
    selects: number;
    forms: number;
  };
  searchRelatedElements: DiscoveredElement[];
}

interface RouteDiscoveryResult {
  pages: InspectedPage[];
  followedLinks: string[];
  skippedLinks: Array<{
    url: string;
    reason: string;
  }>;
  errors: Array<{
    url: string;
    error: string;
  }>;
}

const CAPABILITY_RULES: Record<Capability, RegExp> = {
  authentication:
    /\b(login|log in|sign in|signin|sign-in|logout|log out|sign out|authenticate|authentication|username|password)\b/i,

  productListing:
    /\b(product|products|item|items|catalog|catalogue|inventory|listing|listings)\b/i,

  search:
    /\b(search|keyword|query|find products|find items)\b/i,

  filtering:
    /\b(filter|filters|filtering|category filter|price range|brand filter|refine results)\b/i,

  sorting:
    /\b(sort|sorting|order by|sort by|ascending|descending|low to high|high to low)\b/i,

  pagination:
    /\b(pagination|paginate|page number|next page|previous page|next|previous|load more)\b/i,

  cart:
    /\b(cart|basket|shopping cart|add to cart|remove from cart)\b/i,

  checkout:
    /\b(checkout|check out|payment|place order|purchase|billing|shipping address)\b/i,

  forms:
    /\b(form|submit|registration|register|contact form|enter details|submit details)\b/i,

  navigation:
    /\b(navigation|navigate|menu|sidebar|navigation link)\b/i,
};

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readText(filePath: string): string {
  return fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").trim()
    : "";
}

function getConfig(raw: unknown): ApplicationConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid config/application.json");
  }

  const root = raw as Record<string, unknown>;

  if (root.application && typeof root.application === "object") {
    return root.application as ApplicationConfig;
  }

  return root as ApplicationConfig;
}

function getLoginCredentials(rawConfig: unknown): LoginCredentials {
  if (!rawConfig || typeof rawConfig !== "object") {
    return {};
  }

  const root = rawConfig as Record<string, unknown>;

  const loginConfig =
    root.login && typeof root.login === "object"
      ? (root.login as Record<string, unknown>)
      : {};

  return {
    username:
      typeof loginConfig.validUsername === "string"
        ? loginConfig.validUsername
        : undefined,

    password:
      typeof loginConfig.validPassword === "string"
        ? loginConfig.validPassword
        : undefined,
  };
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

function isSameOrigin(url: string, baseUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

function shouldSkipRoute(
  url: string,
  linkText: string
): string | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return "Invalid URL";
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return "Unsupported URL protocol";
  }

  const routeInformation =
    `${parsedUrl.pathname} ${parsedUrl.search} ${linkText}`.toLowerCase();

  const unsafeRoutePatterns = [
    /\blogout\b/,
    /\bsignout\b/,
    /\bsign-out\b/,
    /\bdelete\b/,
    /\bremove\b/,
    /\badd-to-cart\b/,
    /\badd to cart\b/,
    /\bcheckout\b/,
    /\bcheck-out\b/,
    /\bpurchase\b/,
    /\bpayment\b/,
    /\bplace-order\b/,
    /\bplace order\b/,
    /\bsubmit-order\b/,
  ];

  if (unsafeRoutePatterns.some((pattern) => pattern.test(routeInformation))) {
    return "Skipped because the link may trigger a state-changing or transactional action";
  }

  const fileExtensionsToSkip =
    /\.(pdf|jpg|jpeg|png|gif|svg|zip|rar|doc|docx|xls|xlsx|mp4|mp3)$/i;

  if (fileExtensionsToSkip.test(parsedUrl.pathname)) {
    return "Skipped because the URL points to a file or media resource";
  }

  return null;
}

async function inspectPage(page: Page): Promise<InspectedPage> {
  const title = await page.title();

  const data = await page.evaluate(() => {
    const isVisible = (element: Element): boolean => {
      const html = element as HTMLElement;
      const style = window.getComputedStyle(html);
      const rect = html.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const getText = (element: Element): string =>
      (element.textContent || "").replace(/\s+/g, " ").trim();

    const getAccessibleLabel = (element: Element): string | null => {
      const labelledBy = element.getAttribute("aria-labelledby");

      if (labelledBy) {
        const labelText = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .filter(Boolean)
          .map((label) => getText(label as Element))
          .filter(Boolean)
          .join(" ");

        if (labelText) {
          return labelText;
        }
      }

      const ariaLabel = element.getAttribute("aria-label");

      if (ariaLabel) {
        return ariaLabel;
      }

      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        const labels = element.labels
          ? Array.from(element.labels)
              .map((label) => getText(label))
              .filter(Boolean)
              .join(" ")
          : "";

        if (labels) {
          return labels;
        }
      }

      return null;
    };

    const selector = [
      "input",
      "button",
      "a",
      "select",
      "textarea",
      "[role]",
      "[data-testid]",
      "[data-test]",
      "[aria-label]",
      "[contenteditable='true']",
    ].join(",");

    const elements = Array.from(document.querySelectorAll(selector))
      .filter(isVisible)
      .slice(0, 500)
      .map((element) => {
        const input = element as HTMLInputElement;

        return {
          tag: element.tagName.toLowerCase(),
          text: getText(element).slice(0, 200),
          role: element.getAttribute("role"),
          accessibleLabel: getAccessibleLabel(element),
          placeholder: element.getAttribute("placeholder"),
          name: element.getAttribute("name"),
          type: element.getAttribute("type"),
          id: element.id || null,
          testId:
            element.getAttribute("data-testid") ||
            element.getAttribute("data-test"),
          href:
            element instanceof HTMLAnchorElement ? element.href : null,
          title: element.getAttribute("title"),
          className:
            typeof element.className === "string"
              ? element.className.slice(0, 200)
              : null,
          autocomplete: element.getAttribute("autocomplete"),
          visible: true,
          enabled:
            !("disabled" in input && input.disabled) &&
            !element.hasAttribute("disabled"),
        };
      });

    const discoveredLinks = Array.from(
      document.querySelectorAll("a[href]")
    )
      .filter(isVisible)
      .slice(0, 200)
      .map((element) => {
        const anchor = element as HTMLAnchorElement;

        return {
          text: getText(anchor).slice(0, 200),
          href: anchor.href,
          title: anchor.getAttribute("title"),
          visible: true,
        };
      });

    const bodyText = (document.body?.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);

    return {
      bodyText,
      elements,
      discoveredLinks,
      counts: {
        inputs: document.querySelectorAll("input, textarea").length,
        buttons: document.querySelectorAll("button, [role='button']").length,
        links: document.querySelectorAll("a[href]").length,
        selects: document.querySelectorAll("select").length,
        forms: document.querySelectorAll("form").length,
      },
    };
  });

  const searchElements = data.elements.filter((element) =>
    [
      element.text,
      element.placeholder,
      element.name,
      element.accessibleLabel,
      element.id,
      element.testId,
      element.type,
      element.title,
      element.className,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .match(/search|keyword|query/)
  );

  return {
    url: page.url(),
    title,
    bodyText: data.bodyText,
    elements: data.elements,
    discoveredLinks: data.discoveredLinks,
    elementCounts: data.counts,
    searchRelatedElements: searchElements,
  };
}

async function loginIfConfigured(
  page: Page,
  baseUrl: string,
  credentials: LoginCredentials
): Promise<{
  attempted: boolean;
  success: boolean;
  message: string;
}> {
  const username =
    credentials.username || process.env.DISCOVERY_USERNAME;

  const password =
    credentials.password || process.env.DISCOVERY_PASSWORD;

  if (!username || !password) {
    return {
      attempted: false,
      success: false,
      message:
        "Credentials are missing from config/application.json and .env; login was not attempted.",
    };
  }

  const usernameInput = page
    .locator(
      'input[autocomplete="username"], input[name="username"], input[id="user-name"], input[type="email"], input[type="text"]'
    )
    .first();

  const passwordInput = page
    .locator('input[type="password"]')
    .first();

  if (
    (await usernameInput.count()) === 0 ||
    (await passwordInput.count()) === 0
  ) {
    return {
      attempted: false,
      success: false,
      message:
        "A recognizable username/password form was not found. No login was attempted.",
    };
  }

  console.log("Login form detected. Attempting configured test login...");

  await usernameInput.fill(username);
  await passwordInput.fill(password);

  const submitButton = page
    .locator(
      'button[type="submit"], input[type="submit"], #login-button, [data-test="login-button"]'
    )
    .first();

  if ((await submitButton.count()) === 0) {
    return {
      attempted: true,
      success: false,
      message:
        "Credentials entered, but no recognizable submit button was found.",
    };
  }

  const originalUrl = normalizeUrl(page.url());

  await submitButton.click();

  await page
    .waitForLoadState("domcontentloaded", { timeout: 15000 })
    .catch(() => {});

  await page.waitForTimeout(1000);

  const finalUrl = normalizeUrl(page.url());

  const passwordStillVisible =
    (await page.locator('input[type="password"]').count()) > 0;

  const errorMessage = await page
    .locator('[data-test="error"], [role="alert"]')
    .first()
    .textContent()
    .catch(() => null);

  if (errorMessage?.trim()) {
    return {
      attempted: true,
      success: false,
      message: `Login was rejected or reported an error: ${errorMessage.trim()}`,
    };
  }

  const success =
    !passwordStillVisible &&
    finalUrl !== originalUrl &&
    !/login|signin|sign-in/i.test(finalUrl);

  return {
    attempted: true,
    success,
    message: success
      ? "Login appears successful; inspecting authenticated pages."
      : "Login success could not be confirmed. The resulting page will still be inspected.",
  };
}

function getRequiredCapabilities(
  requirement: string,
  scenarios: unknown
): Capability[] {
  const scenarioText = scenarios
    ? JSON.stringify(scenarios)
    : "";

  const combinedText = `${requirement}\n${scenarioText}`;

  return (Object.keys(CAPABILITY_RULES) as Capability[]).filter(
    (capability) => CAPABILITY_RULES[capability].test(combinedText)
  );
}

function getElementEvidence(
  page: InspectedPage,
  capability: Capability
): string[] {
  const evidence: string[] = [];

  const matches = (element: DiscoveredElement): boolean => {
    const text = [
      element.tag,
      element.text,
      element.role,
      element.accessibleLabel,
      element.placeholder,
      element.name,
      element.type,
      element.id,
      element.testId,
      element.href,
      element.title,
      element.className,
      element.autocomplete,
    ]
      .filter(Boolean)
      .join(" ");

    return CAPABILITY_RULES[capability].test(text);
  };

  for (const element of page.elements) {
    if (!matches(element)) {
      continue;
    }

    const description = [
      element.tag,
      element.text ? `text="${element.text}"` : "",
      element.placeholder ? `placeholder="${element.placeholder}"` : "",
      element.name ? `name="${element.name}"` : "",
      element.testId ? `testId="${element.testId}"` : "",
      element.className ? `class="${element.className}"` : "",
    ]
      .filter(Boolean)
      .join(" ");

    evidence.push(description || element.tag);
  }

  if (
    capability === "productListing" &&
    page.bodyText.match(/\b(products|items|inventory)\b/i)
  ) {
    evidence.push(
      "Relevant product, item, or inventory text found in page content."
    );
  }

  if (
    capability === "productListing" &&
    page.elements.some((element) =>
      /product|inventory_item|item-card/i.test(
        `${element.className || ""} ${element.testId || ""}`
      )
    )
  ) {
    evidence.push("Product-like or item-like element/container detected.");
  }

  if (
    capability === "authentication" &&
    page.elements.some((element) => element.type === "password")
  ) {
    evidence.push("Password input detected.");
  }

  if (capability === "forms" && page.elementCounts.forms > 0) {
    evidence.push(`${page.elementCounts.forms} form element(s) detected.`);
  }

  if (capability === "navigation" && page.elementCounts.links > 0) {
    evidence.push(`${page.elementCounts.links} link(s) detected.`);
  }

  return [...new Set(evidence)].slice(0, 20);
}

async function discoverRoutes(
  page: Page,
  baseUrl: string,
  initialPage: InspectedPage
): Promise<RouteDiscoveryResult> {
  const pages: InspectedPage[] = [initialPage];

  const followedLinks: string[] = [];

  const skippedLinks: Array<{
    url: string;
    reason: string;
  }> = [];

  const errors: Array<{
    url: string;
    error: string;
  }> = [];

  const visited = new Set<string>([
    normalizeUrl(initialPage.url),
  ]);

  const queued = new Set<string>();

  const queue: Array<{
    url: string;
    text: string;
  }> = [];

  function addLinksFromPage(inspectedPage: InspectedPage): void {
    for (const link of inspectedPage.discoveredLinks) {
      const normalizedUrl = normalizeUrl(link.href);

      if (!normalizedUrl || visited.has(normalizedUrl) || queued.has(normalizedUrl)) {
        continue;
      }

      if (!isSameOrigin(normalizedUrl, baseUrl)) {
        skippedLinks.push({
          url: link.href,
          reason: "External-domain link",
        });
        continue;
      }

      const skipReason = shouldSkipRoute(normalizedUrl, link.text);

      if (skipReason) {
        skippedLinks.push({
          url: link.href,
          reason: skipReason,
        });
        continue;
      }

      queued.add(normalizedUrl);

      queue.push({
        url: normalizedUrl,
        text: link.text,
      });
    }
  }

  addLinksFromPage(initialPage);

  console.log("\nStarting same-domain route discovery...");

  while (
    queue.length > 0 &&
    pages.length < MAX_PAGES_TO_INSPECT
  ) {
    const route = queue.shift();

    if (!route) {
      break;
    }

    const normalizedUrl = normalizeUrl(route.url);

    if (visited.has(normalizedUrl)) {
      continue;
    }

    visited.add(normalizedUrl);

    console.log(`Inspecting route: ${route.url}`);

    try {
      await page.goto(route.url, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_NAVIGATION_TIMEOUT,
      });

      await page.waitForTimeout(500);

      const currentPage = await inspectPage(page);

      pages.push(currentPage);
      followedLinks.push(route.url);

      console.log(`  Page title: ${currentPage.title}`);

      addLinksFromPage(currentPage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      errors.push({
        url: route.url,
        error: message,
      });

      console.log(`  Route inspection failed: ${message}`);
    }
  }

  if (queue.length > 0) {
    for (const remainingRoute of queue) {
      skippedLinks.push({
        url: remainingRoute.url,
        reason: `Maximum inspection limit of ${MAX_PAGES_TO_INSPECT} pages reached`,
      });
    }
  }

  return {
    pages,
    followedLinks,
    skippedLinks,
    errors,
  };
}

function buildCapabilityAssessment(
  pages: InspectedPage[],
  requiredCapabilities: Capability[]
) {
  const capabilities = Object.keys(CAPABILITY_RULES) as Capability[];

  const assessments = capabilities.map((capability) => {
    const evidence: string[] = [];

    for (const inspectedPage of pages) {
      const pageEvidence = getElementEvidence(
        inspectedPage,
        capability
      );

      for (const item of pageEvidence) {
        evidence.push(
          `${inspectedPage.url}: ${item}`
        );
      }
    }

    const uniqueEvidence = [...new Set(evidence)].slice(0, 50);

    const detected = uniqueEvidence.length > 0;
    const required = requiredCapabilities.includes(capability);

    return {
      capability,
      requiredByRequirement: required,
      potentialControlsFound: detected,
      status: detected
        ? "POTENTIAL_CONTROLS_FOUND"
        : "NOT_DETECTED_ON_INSPECTED_PAGES",
      confidence: detected
        ? uniqueEvidence.length >= 3
          ? "MEDIUM"
          : "LOW"
        : "NOT_ASSESSED",
      evidence: uniqueEvidence,
      behaviorVerified: false,
      note: detected
        ? "Potential controls or page evidence were found. The capability's actual behavior has not been tested."
        : "No matching evidence was found on the inspected pages. Other routes or hidden application states may still provide this capability.",
    };
  });

  const requirementAssessment = requiredCapabilities.map(
    (capability) => {
      const assessment = assessments.find(
        (item) => item.capability === capability
      );

      return {
        capability,
        detected: assessment?.potentialControlsFound || false,
        status:
          assessment?.status || "NOT_DETECTED_ON_INSPECTED_PAGES",
        evidence: assessment?.evidence || [],
      };
    }
  );

  const allSearchElements = pages.flatMap((inspectedPage) =>
    inspectedPage.searchRelatedElements.map((element) => ({
      ...element,
      discoveredOnPage: inspectedPage.url,
    }))
  );

  return {
    capabilities: assessments,
    requiredCapabilities,
    requirementAssessment,

    // Backward-compatible fields used by the feasibility agent.
    searchRelatedElementsFound: allSearchElements.length,
    searchRelatedElements: allSearchElements,

    conclusion:
      allSearchElements.length > 0
        ? "Potential search-related controls were found on one or more inspected pages. Their actual behavior still requires validation."
        : "No search-related controls were identified on the inspected pages. This does not prove the application lacks the capability.",
  };
}

async function main() {
  console.log("\n========================================");
  console.log("GENERIC APPLICATION DISCOVERY AGENT");
  console.log("========================================\n");

  const rawConfig = readJson<unknown>(CONFIG_PATH);

  if (!rawConfig) {
    throw new Error(`Configuration not found: ${CONFIG_PATH}`);
  }

  const app = getConfig(rawConfig);
  const credentials = getLoginCredentials(rawConfig);

  const baseUrl = app.baseUrl || app.url;

  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error(
      "Configure application.baseUrl in config/application.json."
    );
  }

  const parsedUrl = new URL(baseUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS application URLs are supported.");
  }

  const requirement = readText(REQUIREMENT_PATH);
  const scenarios = readJson<unknown>(SCENARIOS_PATH);

  const requiredCapabilities = getRequiredCapabilities(
    requirement,
    scenarios
  );

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Application: ${app.name || "Unnamed application"}`);
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Maximum pages to inspect: ${MAX_PAGES_TO_INSPECT}`);
    console.log("Opening application...");

    await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page
      .waitForLoadState("load", { timeout: 10000 })
      .catch(() => {});

    const initialPage = await inspectPage(page);

    let login = {
      attempted: false,
      success: false,
      message: "Login was not required or was not attempted.",
    };

    if (
      initialPage.elements.some(
        (element) => element.type === "password"
      )
    ) {
      login = await loginIfConfigured(
        page,
        baseUrl,
        credentials
      );
    }

    const postLoginPage = await inspectPage(page);

    console.log("\nInitial page inspection completed.");
    console.log(`Initial page: ${initialPage.url}`);

    if (login.attempted) {
      console.log(`Login successful: ${login.success}`);
      console.log(login.message);
    }

    const routeDiscovery = await discoverRoutes(
      page,
      baseUrl,
      postLoginPage
    );

    const allPages = [
      initialPage,
      ...routeDiscovery.pages.filter(
        (discoveredPage) =>
          normalizeUrl(discoveredPage.url) !==
          normalizeUrl(initialPage.url)
      ),
    ];

    const uniquePages = allPages.filter(
      (discoveredPage, index, collection) =>
        collection.findIndex(
          (item) =>
            normalizeUrl(item.url) ===
            normalizeUrl(discoveredPage.url)
        ) === index
    );

    const inspectedPage =
      uniquePages[uniquePages.length - 1] || initialPage;

    const capabilityAssessment = buildCapabilityAssessment(
      uniquePages,
      requiredCapabilities
    );

    const result = {
      generatedAt: new Date().toISOString(),

      application: {
        name: app.name || "Unnamed application",
        baseUrl,
      },

      requirement,
      scenarios,
      login,

      scope: {
        pagesInspected: uniquePages.length,
        initialPageInspected: true,
        authenticatedPageInspected: login.success,
        linksFollowed: routeDiscovery.followedLinks.length > 0,
        routesCrawled: routeDiscovery.followedLinks.length > 0,
        interactiveBehaviorTested: false,
        maximumPagesToInspect: MAX_PAGES_TO_INSPECT,
      },

      initialPage,
      inspectedPage,

      // All discovered pages are included for future agents.
      pages: uniquePages,

      routeDiscovery: {
        followedLinks: routeDiscovery.followedLinks,
        skippedLinks: routeDiscovery.skippedLinks,
        errors: routeDiscovery.errors,
      },

      requiredCapabilities,
      capabilityAssessment,

      limitations: [
        `A maximum of ${MAX_PAGES_TO_INSPECT} pages were inspected.`,
        "Only visible same-domain anchor links were followed during route discovery.",
        "External links and potentially transactional links were skipped.",
        "Buttons were not clicked and forms were not submitted, except for the configured login form.",
        "Discovery identifies potential controls and page evidence; it does not prove that a capability works.",
        "Search, filtering, sorting, pagination, cart, and checkout behavior were not executed during discovery.",
        "Some routes may require menu interactions, application-specific state, or other navigation triggers that this crawler does not perform.",
        "Login success is based on an initial heuristic and should be confirmed using application-specific evidence.",
        "A capability not detected on inspected pages may still exist on another route or application state.",
      ],
    };

    fs.writeFileSync(
      OUTPUT_PATH,
      JSON.stringify(result, null, 2),
      "utf8"
    );

    console.log("\n========================================");
    console.log("APPLICATION DISCOVERY RESULT");
    console.log("========================================");

    console.log(`Login attempted: ${login.attempted}`);
    console.log(`Login successful: ${login.success}`);
    console.log(`Login message: ${login.message}`);

    console.log(`\nPages inspected: ${uniquePages.length}`);

    uniquePages.forEach((discoveredPage, index) => {
      console.log(
        `${index + 1}. ${discoveredPage.url} (${discoveredPage.title})`
      );
    });

    console.log(
      `\nLinks followed: ${routeDiscovery.followedLinks.length}`
    );

    console.log(
      `Links skipped: ${routeDiscovery.skippedLinks.length}`
    );

    console.log(
      `Route inspection errors: ${routeDiscovery.errors.length}`
    );

    console.log("\nRequired capabilities:");

    if (requiredCapabilities.length === 0) {
      console.log(
        "No known capability keywords identified in the requirement."
      );
    } else {
      requiredCapabilities.forEach((capability) => {
        console.log(`- ${capability}`);
      });
    }

    console.log("\nPotential controls found:");

    capabilityAssessment.capabilities
      .filter((item) => item.potentialControlsFound)
      .forEach((item) => {
        console.log(
          `- ${item.capability}: ${item.evidence.length} evidence item(s)`
        );
      });

    console.log("\nRequired capabilities not detected:");

    capabilityAssessment.requirementAssessment
      .filter((item) => !item.detected)
      .forEach((item) => {
        console.log(`- ${item.capability}`);
      });

    console.log(`\nOutput: ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("\nApplication discovery failed:");

  console.error(
    error instanceof Error ? error.message : error
  );

  process.exitCode = 1;
});