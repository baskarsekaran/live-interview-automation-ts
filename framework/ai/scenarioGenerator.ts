import type { ApplicationConfig } from "../core/types";
import type { RequirementAnalysis } from "./requirementAnalyzer";
import { generateWithGemini, parseJsonResponse } from "./geminiClient";

export interface TestScenario {
  id: string;
  title: string;
  type: "Positive" | "Negative" | "Validation" | "Boundary" | "Alternate";
  description: string;
  preconditions: string[];
  testData: string[];
  steps: string[];
  expectedResult: string;
  requirementTrace: string[];
}

export async function generateScenarios(
  requirement: string,
  app: ApplicationConfig,
  analysis: RequirementAnalysis
): Promise<TestScenario[]> {
  const prompt = `
You are a senior functional QA engineer. Generate a complete but concise set of test scenarios for the requirement below.

Rules:
- Generate only scenarios traceable to the requirement or its explicit acceptance criteria.
- Do not assume features or workflows merely because this is an e-commerce, banking, or other application.
- Do not invent exact UI messages, selectors, API routes, credentials, prices, or business rules.
- If required behavior is unclear, identify it as a precondition/limitation; do not guess.
- Include positive, negative, validation, boundary and alternate flows only when relevant.
- Avoid duplicate scenarios. Generate the number needed for meaningful coverage; no fixed count.
- IDs must be sequential TC001, TC002, ...
- Return a JSON array only.

Application:
${JSON.stringify({ id: app.id, name: app.name, type: app.type, baseUrl: app.baseUrl })}

Requirement:
${requirement}

Analysis:
${JSON.stringify(analysis, null, 2)}

Each array item must have exactly:
{
  "id": "TC001",
  "title": "short title",
  "type": "Positive | Negative | Validation | Boundary | Alternate",
  "description": "what is verified",
  "preconditions": [],
  "testData": [],
  "steps": [],
  "expectedResult": "observable expected behavior",
  "requirementTrace": ["acceptance criterion or requirement statement"]
}
`;
  const raw = await generateWithGemini(prompt, {
    temperature: 0,
    responseMimeType: "application/json"
  });
  const scenarios = parseJsonResponse<TestScenario[]>(raw);

  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error("Gemini did not generate a non-empty scenario array.");
  }

  const types = ["Positive", "Negative", "Validation", "Boundary", "Alternate"];
  scenarios.forEach((item, index) => {
    if (
      item.id !== `TC${String(index + 1).padStart(3, "0")}` ||
      typeof item.title !== "string" ||
      !types.includes(item.type) ||
      typeof item.description !== "string" ||
      !Array.isArray(item.preconditions) ||
      !Array.isArray(item.testData) ||
      !Array.isArray(item.steps) ||
      item.steps.length === 0 ||
      typeof item.expectedResult !== "string" ||
      !Array.isArray(item.requirementTrace)
    ) {
      throw new Error(`Invalid scenario structure at index ${index}.`);
    }
  });

  return scenarios;
}
