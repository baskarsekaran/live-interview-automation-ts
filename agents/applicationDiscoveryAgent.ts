
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

interface ApplicationConfig {
  name?: string;
  baseUrl?: string;
  url?: string;
  [key: string]: unknown;
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
  visible: boolean;
  enabled: boolean;
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

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

async function inspectPage(page: Page) {
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

    const getText = (element: Element) =>
      (element.textContent || "").replace(/\s+/g, " ").trim();

    const elements: DiscoveredElement[] = Array.from(
      document.querySelectorAll(
        "input, button, a, select, textarea, [role], [data-testid], [data-test]"
      )
    )
      .filter(isVisible)
      .slice(0, 300)
      .map((element) => {
        const input = element as HTMLInputElement;
        const labels = input.labels
          ? Array.from(input.labels)
              .map((label) => getText(label))
              .filter(Boolean)
              .join(" ")
          : "";

        return {
          tag: element.tagName.toLowerCase(),
          text: getText(element).slice(0, 200),
          role: element.getAttribute("role"),
          accessibleLabel:
            labels ||
            element.getAttribute("aria-label") ||
            element.getAttribute("aria-labelledby"),
          placeholder: element.getAttribute("placeholder"),
          name: element.getAttribute("name"),
          type: element.getAttribute("type"),
          id: element.id || null,
          testId:
            element.getAttribute("data-testid") ||
            element.getAttribute("data-test"),
          href:
            element instanceof HTMLAnchorElement ? element.href : null,
          visible: true,
          enabled: !(
            "disabled" in input && input.disabled
          ) && !element.hasAttribute("disabled"),
        };
      });

    const bodyText = (document.body?.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);

    return {
      bodyText,
      elements,
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
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .match(/\bsearch\b|search|keyword|query/)
  );

  return {
    url: page.url(),
    title,
    bodyText: data.bodyText,
    elements: data.elements,
    elementCounts: data.counts,
    searchRelatedElements: searchElements,
  };
}

async function loginIfConfigured(
  page: Page,
  baseUrl: string
): Promise<{
  attempted: boolean;
  success: boolean;
  message: string;
}> {
  const username = process.env.DISCOVERY_USERNAME;
  const password = process.env.DISCOVERY_PASSWORD;

  if (!username || !password) {
    return {
      attempted: false,
      success: false,
      message: "Credentials are missing from .env; login was not attempted.",
    };
  }

  // Generic discovery: use standard form attributes and accessible labels.
  // Application-specific login selectors can be configured separately later.
  const usernameInput = page.locator(
    'input[autocomplete="username"], input[name="username"], input[id="user-name"], input[type="email"], input[type="text"]'
  ).first();

  const passwordInput = page.locator('input[type="password"]').first();

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
      message: "Credentials entered, but no recognizable submit button was found.",
    };
  }

  await submitButton.click();

  await page.waitForLoadState("domcontentloaded", {
    timeout: 15000,
  }).catch(() => {});

  await page.waitForTimeout(1000);

  const finalUrl = page.url();
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
    finalUrl !== baseUrl &&
    !/login|signin|sign-in/i.test(finalUrl);

  return {
    attempted: true,
    success,
    message: success
      ? "Login appears successful; inspecting the resulting page."
      : "Login success could not be confirmed. Inspect the resulting page and login behavior.",
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
  const baseUrl = app.baseUrl || app.url;

  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("Configure application.baseUrl in config/application.json.");
  }

  const parsedUrl = new URL(baseUrl);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS application URLs are supported.");
  }

  const requirement = readText(REQUIREMENT_PATH);
  const scenarios = readJson<unknown>(SCENARIOS_PATH);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Application: ${app.name || "Unnamed application"}`);
    console.log(`Base URL: ${baseUrl}`);
    console.log("Opening application...");

    await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});

    const initialPage = await inspectPage(page);

    let login = {
      attempted: false,
      success: false,
      message: "Login was not required or was not attempted.",
    };

    if (
      initialPage.elements.some((element) => element.type === "password")
    ) {
      login = await loginIfConfigured(page, baseUrl);
    }

    const authenticatedPage = await inspectPage(page);

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
        pagesInspected: 1,
        initialPageInspected: true,
        authenticatedPageInspected: login.success,
        linksFollowed: false,
      },
      initialPage,
      inspectedPage: authenticatedPage,
      capabilityAssessment: {
        searchRelatedElementsFound:
          authenticatedPage.searchRelatedElements.length,
        searchRelatedElements: authenticatedPage.searchRelatedElements,
        conclusion:
          authenticatedPage.searchRelatedElements.length > 0
            ? "Potential search-related controls were found. Their actual behavior still requires validation."
            : "No search-related controls were identified on the inspected page. This does not prove the application lacks the capability.",
      },
      limitations: [
        "Only the initial page and resulting page were inspected; other application routes were not crawled.",
        "Search behavior and results were not tested during discovery.",
        "A login success is an initial heuristic and should be confirmed using application-specific evidence.",
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
    console.log(`Inspected page: ${authenticatedPage.url}`);
    console.log(`Page title: ${authenticatedPage.title}`);
    console.log(
      `Search-related elements: ${authenticatedPage.searchRelatedElements.length}`
    );
    console.log(`Output: ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("\nApplication discovery failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});