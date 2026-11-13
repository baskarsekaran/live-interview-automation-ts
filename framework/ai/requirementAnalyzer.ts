import type { ApplicationConfig, DiscoveryEvidence } from "../core/types";
import { generateWithGemini, parseJsonResponse } from "./geminiClient";

export interface RequirementAnalysis {
  quality: "COMPLETE" | "PARTIALLY_COMPLETE" | "INCOMPLETE";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  capabilities: string[];
  acceptanceCriteria: string[];
  ambiguities: string[];
  clarificationQuestions: string[];
  assumptions: string[];
  evidenceGaps: string[];
}

const allowedQuality = ["COMPLETE", "PARTIALLY_COMPLETE", "INCOMPLETE"];
const allowedRisk = ["LOW", "MEDIUM", "HIGH"];

export async function analyzeRequirement(
  requirement: string,
  app: ApplicationConfig,
  discovery?: DiscoveryEvidence
): Promise<RequirementAnalysis> {
  const prompt = `
You are a senior software QA analyst. Analyze the requirement for the configured application.

STRICT RULES:
- The requirement is the source of expected behavior.
- Application discovery is evidence of observed UI only; it does not prove business rules.
- Do not infer that a feature exists merely because a requirement mentions it.
- Do not invent selectors, endpoints, data, credentials, workflows, or expected messages.
- Separate missing requirement details from missing application evidence.
- If discovery does not show evidence for a required capability, record an evidence gap; do not mark it supported.
- Ask concise clarification questions only when the answer affects test design.
- Return JSON only, matching the schema exactly.

Application:
${JSON.stringify({ id: app.id, name: app.name, type: app.type, baseUrl: app.baseUrl }, null, 2)}

Requirement:
${requirement}

Observed application discovery evidence (may be partial):
${JSON.stringify(discovery ?? null, null, 2)}

Return:
{
  "quality": "COMPLETE | PARTIALLY_COMPLETE | INCOMPLETE",
  "riskLevel": "LOW | MEDIUM | HIGH",
  "summary": "short assessment",
  "capabilities": ["capability directly required"],
  "acceptanceCriteria": ["atomic, testable criteria derived from the requirement"],
  "ambiguities": ["unclear or missing detail"],
  "clarificationQuestions": ["specific question for the requirement owner"],
  "assumptions": [],
  "evidenceGaps": ["required capability not evidenced by discovery"]
}

Use empty arrays when there are no findings. Do not include markdown.
`;

  const raw = await generateWithGemini(prompt, {
    temperature: 0,
    responseMimeType: "application/json"
  });
  const result = parseJsonResponse<RequirementAnalysis>(raw);

  if (
    !result ||
    !allowedQuality.includes(result.quality) ||
    !allowedRisk.includes(result.riskLevel) ||
    typeof result.summary !== "string" ||
    !Array.isArray(result.capabilities) ||
    !Array.isArray(result.acceptanceCriteria) ||
    !Array.isArray(result.ambiguities) ||
    !Array.isArray(result.clarificationQuestions) ||
    !Array.isArray(result.assumptions) ||
    !Array.isArray(result.evidenceGaps)
  ) {
    throw new Error("Gemini requirement analysis did not match the required schema.");
  }

  const arrays: Array<keyof RequirementAnalysis> = [
    "capabilities", "acceptanceCriteria", "ambiguities",
    "clarificationQuestions", "assumptions", "evidenceGaps"
  ];
  for (const key of arrays) {
    const value = result[key];
    if (!Array.isArray(value) || !value.every(item => typeof item === "string")) {
      throw new Error(`Invalid analysis field: ${key}`);
    }
  }

  return result;
}
