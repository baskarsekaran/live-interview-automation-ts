import { chromium } from "@playwright/test";
import type { ApplicationConfig, DiscoveryEvidence, DiscoveryElement } from "../core/types";
import type { ScenarioTestPlan } from "../ai/testPlanGenerator";
import { locatorFor } from "./locatorResolver";

export interface LocatorCheck {
  targetId: string;
  status: "VALID" | "INVALID";
  matchCount: number;
  visible: boolean;
  message: string;
}

export interface ScenarioLocatorValidation {
  scenarioId: string;
  status: "VALIDATED" | "BLOCKED";
  reason: string;
  targets: LocatorCheck[];
}

export interface LiveLocatorValidationResult {
  status: "COMPLETED" | "ENVIRONMENT_ERROR";
  checkedAt: string;
  browser: "chromium";
  pageUrl?: string;
  message?: string;
  scenarios: ScenarioLocatorValidation[];
  plans: ScenarioTestPlan[];
}

export async function validateTestPlansLive(
  app: ApplicationConfig,
  discovery: DiscoveryEvidence,
  plans: ScenarioTestPlan[]
): Promise<LiveLocatorValidationResult> {
  const checkedAt = new Date().toISOString();
  const evidence = new Map<string, DiscoveryElement>(
    discovery.pages.flatMap(page => page.elements).map(item => [item.id, item] as const)
  );
  const browser = await chromium.launch({ headless: app.browser?.headless ?? true });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(app.browser?.timeoutMs ?? 15000);

    try {
      await page.goto(app.baseUrl, {
        waitUntil: "domcontentloaded",
        timeout: app.browser?.timeoutMs ?? 20000
      });
      await page.locator("body").waitFor({ state: "visible" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const blockedPlans = plans.map(plan => plan.status === "READY"
        ? { ...plan, status: "BLOCKED" as const, reason: "Live locator validation could not run because the application was unreachable: " + message, actions: [] }
        : plan);
      return {
        status: "ENVIRONMENT_ERROR",
        checkedAt,
        browser: "chromium",
        message,
        scenarios: [],
        plans: blockedPlans
      };
    }

    const targetCache = new Map<string, LocatorCheck>();
    const scenarios: ScenarioLocatorValidation[] = [];

    for (const plan of plans) {
      if (plan.status !== "READY") {
        scenarios.push({
          scenarioId: plan.scenarioId,
          status: "BLOCKED",
          reason: plan.reason,
          targets: []
        });
        continue;
      }

      const targetIds = [...new Set(
        plan.actions
          .filter(action => action.type !== "assertUrl")
          .map(action => action.targetId)
          .filter((id): id is string => Boolean(id))
      )];
      const targets: LocatorCheck[] = [];

      for (const targetId of targetIds) {
        const cached = targetCache.get(targetId);
        if (cached) {
          targets.push(cached);
          continue;
        }

        const item = evidence.get(targetId);
        if (!item) {
          const missing: LocatorCheck = {
            targetId, status: "INVALID", matchCount: 0, visible: false,
            message: "Target ID is missing from discovery evidence."
          };
          targetCache.set(targetId, missing);
          targets.push(missing);
          continue;
        }

        let check: LocatorCheck;
        try {
          // Validate the target on the exact page where its evidence was captured.
          const targetPageUrl = item.pageUrl ?? discovery.pages[0]?.url ?? app.baseUrl;
          if (new URL(page.url()).pathname !== new URL(targetPageUrl).pathname ||
              new URL(page.url()).origin !== new URL(targetPageUrl).origin) {
            await page.goto(targetPageUrl, {
              waitUntil: "domcontentloaded",
              timeout: app.browser?.timeoutMs ?? 20000
            });
            await page.locator("body").waitFor({ state: "visible" });
          }
          const locator = locatorFor(page, item);
          await locator.first().waitFor({ state: "attached", timeout: 5000 }).catch(() => undefined);
          const matchCount = await locator.count();
          const visible = matchCount === 1 ? await locator.isVisible() : false;
          const valid = matchCount === 1 && visible;
          check = {
            targetId,
            status: valid ? "VALID" : "INVALID",
            matchCount,
            visible,
            message: valid
              ? "Exactly one matching live element is visible."
              : matchCount === 0
                ? "No live element matched the discovered locator."
                : matchCount > 1
                  ? "The locator is ambiguous: " + matchCount + " live elements matched."
                  : "The matching live element is not visible."
          };
        } catch (error) {
          check = {
            targetId, status: "INVALID", matchCount: 0, visible: false,
            message: error instanceof Error ? error.message : String(error)
          };
        }

        targetCache.set(targetId, check);
        targets.push(check);
      }

      const invalidTargets = targets.filter(target => target.status === "INVALID");
      const valid = invalidTargets.length === 0;
      scenarios.push({
        scenarioId: plan.scenarioId,
        status: valid ? "VALIDATED" : "BLOCKED",
        reason: valid
          ? "All action targets resolve to exactly one visible element on the discovered page."
          : "Live locator validation failed: " + invalidTargets.map(target => target.targetId + " (" + target.message + ")").join("; "),
        targets
      });
    }

    const validationByScenario = new Map(scenarios.map(item => [item.scenarioId, item]));
    const validatedPlans = plans.map(plan => {
      const validation = validationByScenario.get(plan.scenarioId);
      if (!validation || plan.status !== "READY" || validation.status === "VALIDATED") return plan;
      return { ...plan, status: "BLOCKED" as const, reason: validation.reason, actions: [] };
    });

    return {
      status: "COMPLETED",
      checkedAt,
      browser: "chromium",
      pageUrl: page.url(),
      scenarios,
      plans: validatedPlans
    };
  } finally {
    await browser.close();
  }
}
