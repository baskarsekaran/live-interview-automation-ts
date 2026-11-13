import type { ApplicationConfig, DiscoveryEvidence, DiscoveryElement } from "../core/types";
import type { TestScenario } from "./scenarioGenerator";
import { generateWithGemini, parseJsonResponse } from "./geminiClient";

export type PlannedActionType = "click" | "fill" | "select" | "check" | "uncheck" | "assertVisible" | "assertText" | "assertUrl";
export interface PlannedAction { type: PlannedActionType; targetId?: string; value?: string; }
export interface ScenarioTestPlan { scenarioId: string; status: "READY" | "BLOCKED"; reason: string; actions: PlannedAction[]; }
const actionTypes: PlannedActionType[] = ["click", "fill", "select", "check", "uncheck", "assertVisible", "assertText", "assertUrl"];

export async function generateTestPlans(app: ApplicationConfig, scenarios: TestScenario[], discovery: DiscoveryEvidence): Promise<ScenarioTestPlan[]> {
  const prompt = `
You are a cautious Playwright test designer. Convert scenarios into structured UI action plans.
STRICT EVIDENCE RULES:
- Use only supplied discovery evidence. Never invent controls, routes, selectors, labels, text, workflows, or business rules.
- Every targetId must exactly match an element id in the evidence.
- If any essential step cannot be grounded, mark that scenario BLOCKED and return an empty actions array.
- READY means every action target is evidenced and unambiguous.
- Do not invent test data. Use scenario testData only when it clearly applies to an evidenced field.
- Use only click, fill, select, check, uncheck, assertVisible, assertText, assertUrl.
- assertUrl value must be a substring in an evidenced link href.
- Never submit payment, purchase, account creation, or consequential forms; mark those scenarios BLOCKED.
- Return JSON only, exactly one item per scenario and in input order.
Application: ${JSON.stringify({id:app.id,name:app.name,baseUrl:app.baseUrl})}
Scenarios: ${JSON.stringify(scenarios)}
Discovery: ${JSON.stringify(discovery)}
Schema: [{"scenarioId":"TC001","status":"READY | BLOCKED","reason":"evidence-based reason","actions":[{"type":"click | fill | select | check | uncheck | assertVisible | assertText | assertUrl","targetId":"E001","value":"optional"}]}]
`;
  const raw = await generateWithGemini(prompt, { temperature: 0, responseMimeType: "application/json" });
  const plans = parseJsonResponse<ScenarioTestPlan[]>(raw);
  if (!Array.isArray(plans) || plans.length !== scenarios.length) throw new Error("Gemini test plans must contain exactly one plan per scenario.");
  const evidence = new Map<string, DiscoveryElement>(discovery.pages.flatMap(page => page.elements).map(item => [item.id, item]));
  plans.forEach((plan, index) => {
    if (plan.scenarioId !== scenarios[index].id || !["READY","BLOCKED"].includes(plan.status) || typeof plan.reason !== "string" || !Array.isArray(plan.actions)) throw new Error(`Invalid test plan at index ${index}.`);
    if (plan.status === "BLOCKED" && plan.actions.length) throw new Error(`Blocked plan ${plan.scenarioId} cannot contain actions.`);
    for (const action of plan.actions) {
      if (!actionTypes.includes(action.type)) throw new Error(`Unsupported action in ${plan.scenarioId}.`);
      if (action.type === "assertUrl") {
        if (typeof action.value !== "string" || !discovery.pages.some(page => page.links.some(link => link.href.includes(action.value!)))) throw new Error(`Unverified URL assertion in ${plan.scenarioId}.`);
        continue;
      }
      const target = action.targetId ? evidence.get(action.targetId) : undefined;
      if (!target) throw new Error(`Unverified target in ${plan.scenarioId}: ${action.targetId ?? "(missing)"}.`);
      if (["fill","select","assertText"].includes(action.type) && typeof action.value !== "string") throw new Error(`Action ${action.type} requires a value in ${plan.scenarioId}.`);
      if (action.type === "fill" && !["input","textarea"].includes(target.tag)) throw new Error(`Fill target is not an input in ${plan.scenarioId}.`);
      if (action.type === "select" && target.tag !== "select") throw new Error(`Select target is not a select in ${plan.scenarioId}.`);
      if (["check","uncheck"].includes(action.type) && !(target.tag === "input" && ["checkbox","radio"].includes(target.inputType))) throw new Error(`Check target is not a checkbox/radio in ${plan.scenarioId}.`);
    }
    if (plan.status === "READY" && !plan.actions.length) throw new Error(`Ready plan ${plan.scenarioId} must contain actions.`);
  });
  return plans;
}