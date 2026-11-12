
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const ROOT = process.cwd();

const requirementPath = path.join(ROOT, "input", "requirement.txt");
const scenariosPath = path.join(ROOT, "output", "test-scenarios.json");
const applicationPath = path.join(ROOT, "config", "application.json");
const discoveryPath = path.join(ROOT, "output", "application-discovery.json");
const outputPath = path.join(ROOT, "output", "automation-feasibility.json");

type FeasibilityStatus =
  | "READY"
  | "NEEDS_CLARIFICATION"
  | "NEEDS_CONFIGURATION"
  | "PARTIALLY_AUTOMATABLE"
  | "NEEDS_REVIEW"
  | "BLOCKED";

type ScenarioStatus =
  | "READY"
  | "NEEDS_CLARIFICATION"
  | "NEEDS_CONFIGURATION"
  | "NEEDS_REVIEW"
  | "BLOCKED";

type MismatchType =
  | "NONE"
  | "APPLICATION_REQUIREMENT_MISMATCH"
  | "UNVERIFIED_CAPABILITY"
  | "REQUIREMENT_AMBIGUITY"
  | "CONFIGURATION_GAP";

interface ScenarioAssessment {
  scenarioId: string;
  scenarioName: string;
  status: ScenarioStatus;
  reason: string;
  evidence: string[];
  missingCapabilities: string[];
  recommendations: string[];
}

interface FeasibilityResult {
  status: FeasibilityStatus;
  mismatchType: MismatchType;
  summary: string;
  blockers: string[];
  missingRequirements: string[];
  missingCapabilities: string[];
  missingConfiguration: string[];
  missingLocators: string[];
  automationApproach: string[];
  recommendations: string[];
  assumptions: string[];
  scenarioAssessments: ScenarioAssessment[];
}

const ALLOWED_STATUSES: FeasibilityStatus[] = [
  "READY",
  "NEEDS_CLARIFICATION",
  "NEEDS_CONFIGURATION",
  "PARTIALLY_AUTOMATABLE",
  "NEEDS_REVIEW",
  "BLOCKED",
];

const ALLOWED_SCENARIO_STATUSES: ScenarioStatus[] = [
  "READY",
  "NEEDS_CLARIFICATION",
  "NEEDS_CONFIGURATION",
  "NEEDS_REVIEW",
  "BLOCKED",
];

const ALLOWED_MISMATCH_TYPES: MismatchType[] = [
  "NONE",
  "APPLICATION_REQUIREMENT_MISMATCH",
  "UNVERIFIED_CAPABILITY",
  "REQUIREMENT_AMBIGUITY",
  "CONFIGURATION_GAP",
];

function readJsonIfExists(filePath: string): any | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    throw new Error(`Invalid JSON in file: ${filePath}`);
  }
}

function readRequiredText(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf8").trim();
}

function extractScenarios(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.scenarios)) return data.scenarios;
  if (Array.isArray(data?.testScenarios)) return data.testScenarios;
  return [];
}

function getApplicationName(
  application: any,
  discovery: any
): string {
  return (
    application?.application?.name ??
    application?.name ??
    discovery?.application?.name ??
    "Not identified"
  );
}

function getDiscoveryEvidence(discovery: any): {
  available: boolean;
  inspectedPages: any[];
  searchRelatedElements: any[];
  authenticationRequired: boolean;
  pagesInspected: number;
  evidenceSummary: string[];
} {
  if (!discovery || typeof discovery !== "object") {
    return {
      available: false,
      inspectedPages: [],
      searchRelatedElements: [],
      authenticationRequired: false,
      pagesInspected: 0,
      evidenceSummary: ["No application discovery evidence was supplied."],
    };
  }

  const pages: any[] = [];

  if (discovery.initialPage) pages.push(discovery.initialPage);
  if (discovery.inspectedPage) pages.push(discovery.inspectedPage);

  if (Array.isArray(discovery.pages)) {
    pages.push(...discovery.pages);
  }

  const uniquePages = pages.filter(
    (page, index, all) =>
      all.findIndex(
        (other) =>
          other.url === page.url &&
          other.title === page.title
      ) === index
  );

  const searchElements: any[] = [];

  for (const page of uniquePages) {
    if (Array.isArray(page.searchRelatedElements)) {
      searchElements.push(...page.searchRelatedElements);
    }
  }

  if (Array.isArray(discovery.capabilityAssessment?.searchRelatedElements)) {
    searchElements.push(
      ...discovery.capabilityAssessment.searchRelatedElements
    );
  }

  const loginMessage =
    typeof discovery.login?.message === "string"
      ? discovery.login.message
      : "";

  const authenticationRequired =
    uniquePages.some((page) => page.authenticationRequired === true) ||
    /credentials are missing|login was not attempted|authentication required/i.test(
      loginMessage
    );

  const evidenceSummary = uniquePages.map((page) => {
    const title = page.title || "Untitled page";
    const url = page.url || page.finalUrl || "URL unavailable";
    const elements = Array.isArray(page.elements)
      ? page.elements.length
      : 0;

    return `Inspected page "${title}" at ${url}; captured ${elements} visible elements.`;
  });

  if (searchElements.length > 0) {
    evidenceSummary.push(
      `Found ${searchElements.length} search-related element record(s); actual search behavior has not been verified.`
    );
  } else if (uniquePages.length > 0) {
    evidenceSummary.push(
      "No search-related elements were reported on the inspected pages. This does not prove the capability is absent elsewhere."
    );
  }

  return {
    available: true,
    inspectedPages: uniquePages,
    searchRelatedElements: searchElements,
    authenticationRequired,
    pagesInspected: uniquePages.length,
    evidenceSummary,
  };
}

function validateStringArray(value: any, field: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item: unknown) => typeof item === "string")
  ) {
    throw new Error(`${field} must be an array of strings.`);
  }

  return value;
}

function validateResult(data: any, scenarios: any[]): FeasibilityResult {
  if (!data || typeof data !== "object") {
    throw new Error("Gemini returned an invalid feasibility object.");
  }

  if (!ALLOWED_STATUSES.includes(data.status)) {
    throw new Error(`Invalid feasibility status: ${data.status}`);
  }

  if (!ALLOWED_MISMATCH_TYPES.includes(data.mismatchType)) {
    throw new Error(`Invalid mismatch type: ${data.mismatchType}`);
  }

  if (typeof data.summary !== "string" || !data.summary.trim()) {
    throw new Error("Feasibility summary is missing.");
  }

  const arrayFields = [
    "blockers",
    "missingRequirements",
    "missingCapabilities",
    "missingConfiguration",
    "missingLocators",
    "automationApproach",
    "recommendations",
    "assumptions",
  ] as const;

  for (const field of arrayFields) {
    validateStringArray(data[field], field);
  }

  if (!Array.isArray(data.scenarioAssessments)) {
    throw new Error("scenarioAssessments must be an array.");
  }

  const assessments: ScenarioAssessment[] =
    data.scenarioAssessments.map((item: any) => {
      if (!item || typeof item !== "object") {
        throw new Error("Invalid scenario assessment.");
      }

      if (
        typeof item.scenarioId !== "string" ||
        typeof item.scenarioName !== "string" ||
        typeof item.reason !== "string" ||
        !ALLOWED_SCENARIO_STATUSES.includes(item.status)
      ) {
        throw new Error(
          "A scenario assessment is missing valid ID, name, status, or reason."
        );
      }

      return {
        scenarioId: item.scenarioId,
        scenarioName: item.scenarioName,
        status: item.status,
        reason: item.reason,
        evidence: validateStringArray(
          item.evidence,
          "scenarioAssessment.evidence"
        ),
        missingCapabilities: validateStringArray(
          item.missingCapabilities,
          "scenarioAssessment.missingCapabilities"
        ),
        recommendations: validateStringArray(
          item.recommendations,
          "scenarioAssessment.recommendations"
        ),
      };
    });

  // Every generated scenario must receive a decision.
  if (assessments.length !== scenarios.length) {
    throw new Error(
      `Expected ${scenarios.length} scenario assessments, received ${assessments.length}.`
    );
  }

  return {
    status: data.status,
    mismatchType: data.mismatchType,
    summary: data.summary,
    blockers: data.blockers,
    missingRequirements: data.missingRequirements,
    missingCapabilities: data.missingCapabilities,
    missingConfiguration: data.missingConfiguration,
    missingLocators: data.missingLocators,
    automationApproach: data.automationApproach,
    recommendations: data.recommendations,
    assumptions: data.assumptions,
    scenarioAssessments: assessments,
  };
}

function printList(heading: string, items: string[]): void {
  if (items.length === 0) return;

  console.log(`\n${heading}:`);

  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function printScenarioAssessments(
  assessments: ScenarioAssessment[]
): void {
  console.log("\n=================================");
  console.log("SCENARIO-LEVEL FEASIBILITY");
  console.log("=================================");

  for (const assessment of assessments) {
    console.log(
      `\n${assessment.scenarioId} - ${assessment.scenarioName}`
    );
    console.log(`Decision: ${assessment.status}`);
    console.log(`Reason: ${assessment.reason}`);

    printList("Evidence", assessment.evidence);
    printList(
      "Missing capabilities",
      assessment.missingCapabilities
    );
    printList(
      "Recommendations",
      assessment.recommendations
    );
  }
}

async function main(): Promise<void> {
  console.log("\n=================================");
  console.log("GENERIC AUTOMATION FEASIBILITY AGENT");
  console.log("=================================\n");

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing. Check your .env file.");
  }

  const requirement = readRequiredText(requirementPath);

  if (!requirement) {
    throw new Error("input/requirement.txt is empty.");
  }

  const scenarioData = readJsonIfExists(scenariosPath);

  if (!scenarioData) {
    throw new Error(
      "Test scenarios not found. Run the scenario agent first."
    );
  }

  const scenarios = extractScenarios(scenarioData);

  if (scenarios.length === 0) {
    throw new Error("No valid test scenarios were found.");
  }

  const application = readJsonIfExists(applicationPath);
  const discovery = readJsonIfExists(discoveryPath);
  const discoveryEvidence = getDiscoveryEvidence(discovery);

  const applicationInfo = {
    configurationAvailable: application !== null,
    configuration:
      application ?? { message: "No application configuration supplied." },
    discoveryEvidenceAvailable: discoveryEvidence.available,
    discoveryEvidence: discovery ?? {
      message: "No application discovery evidence supplied.",
    },
    normalizedDiscoveryEvidence: discoveryEvidence,
  };

  const applicationName = getApplicationName(application, discovery);

  console.log(`Application: ${applicationName}`);
  console.log(`Scenarios: ${scenarios.length}`);
  console.log(
    `Application configuration: ${application ? "Available" : "Not supplied"}`
  );
  console.log(
    `Discovery evidence: ${discovery ? "Available" : "Not supplied"}`
  );
  console.log(
    `Pages inspected: ${discoveryEvidence.pagesInspected}`
  );

  console.log("\nAssessing feasibility with Gemini...\n");

  const prompt = `
You are an evidence-driven senior QA automation architect.

Assess the automation feasibility of the supplied requirement and
EVERY generated scenario for ANY application.

REQUIREMENT:
${requirement}

GENERATED SCENARIOS:
${JSON.stringify(scenarios, null, 2)}

APPLICATION CONFIGURATION AND DISCOVERY EVIDENCE:
${JSON.stringify(applicationInfo, null, 2)}

RULES:

1. Return one scenario assessment for every supplied scenario.
   Preserve its original ID where available. If no ID exists, use
   "SCENARIO_1", "SCENARIO_2", etc. Preserve the scenario's title/name.

2. Assess each scenario independently. Use evidence, not assumptions.

3. Distinguish:
   - confirmed capability;
   - unverified capability;
   - confirmed unsupported capability;
   - missing automation configuration;
   - incomplete acceptance criteria;
   - confirmed application/requirement mismatch.

4. A missing locator alone does not prove that a feature is absent.
   Do not invent selectors or claim that a locator was inspected if
   the discovery evidence does not contain it.

5. Discovery evidence only describes the pages actually inspected.
   If one page was inspected, do not infer that the entire application
   has no feature based solely on that page.

6. Use mismatchType:
   - NONE: no identified mismatch or capability uncertainty.
   - APPLICATION_REQUIREMENT_MISMATCH: supplied evidence explicitly
     confirms that the requested capability is not supported by the
     application/version/role under test.
   - UNVERIFIED_CAPABILITY: requested capability was not found or
     has not been confirmed, but absence is not proven.
   - REQUIREMENT_AMBIGUITY: acceptance criteria or business rules
     are insufficient to determine expected results.
   - CONFIGURATION_GAP: required credentials, environment, adapter,
     API spec, or access configuration is missing.

7. Do not label an unverified feature as an application mismatch.
   Use UNVERIFIED_CAPABILITY unless the evidence confirms the mismatch.

8. Scenario statuses:
   READY: evidence and configuration are sufficient.
   NEEDS_CLARIFICATION: expected behavior cannot be determined.
   NEEDS_CONFIGURATION: necessary configuration or access is missing.
   NEEDS_REVIEW: important capability or behavior is unverified.
   BLOCKED: a specific evidence-based obstacle prevents this scenario.

9. Overall status:
   READY when all scenarios are READY.
   PARTIALLY_AUTOMATABLE when at least one scenario is READY and
   at least one other scenario cannot proceed.
   NEEDS_CLARIFICATION when requirement ambiguity is the main issue.
   NEEDS_CONFIGURATION when configuration/access is the main issue.
   NEEDS_REVIEW when important application capabilities are unverified.
   BLOCKED only for specific confirmed blockers.

10. If there are multiple issue types, choose the main status based
    on the most important blocker and explain the others in the arrays.

11. Do not claim a scenario is READY just because code can be written.
    The application must support the behavior being tested.

12. Select an automation approach justified by the evidence, such as
    browser UI, API, mobile UI, database validation, or a combination.

13. Do not treat requirement completeness questions as proof that a
    feature does not exist. Explain the separate issues.

14. Return valid JSON only. Do not use Markdown fences.

Return exactly this structure:

{
  "status": "NEEDS_REVIEW",
  "mismatchType": "UNVERIFIED_CAPABILITY",
  "summary": "Evidence-based summary",
  "blockers": [],
  "missingRequirements": [],
  "missingCapabilities": [],
  "missingConfiguration": [],
  "missingLocators": [],
  "automationApproach": [],
  "recommendations": [],
  "assumptions": [],
  "scenarioAssessments": [
    {
      "scenarioId": "TC001",
      "scenarioName": "Scenario title",
      "status": "NEEDS_REVIEW",
      "reason": "Why this scenario has this decision",
      "evidence": [],
      "missingCapabilities": [],
      "recommendations": []
    }
  ]
}

Allowed overall statuses:
READY, NEEDS_CLARIFICATION, NEEDS_CONFIGURATION,
PARTIALLY_AUTOMATABLE, NEEDS_REVIEW, BLOCKED.

Allowed mismatchType values:
NONE, APPLICATION_REQUIREMENT_MISMATCH, UNVERIFIED_CAPABILITY,
REQUIREMENT_AMBIGUITY, CONFIGURATION_GAP.

Allowed scenario statuses:
READY, NEEDS_CLARIFICATION, NEEDS_CONFIGURATION, NEEDS_REVIEW, BLOCKED.

The scenarioAssessments array MUST contain exactly ${scenarios.length} items,
one for each supplied scenario.
`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error (${response.status}): ${errorText}`
    );
  }

  const responseData: any = await response.json();

  const responseText = responseData.candidates?.[0]?.content?.parts
    ?.map((part: any) => part.text ?? "")
    .join("")
    .trim();

  if (!responseText) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsed: any;

  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error(`Gemini returned invalid JSON:\n${responseText}`);
  }

  const result = validateResult(parsed, scenarios);

  const output = {
    application: applicationName,
    requirement,
    scenarioCount: scenarios.length,
    evidence: {
      applicationConfigurationAvailable: application !== null,
      discoveryEvidenceAvailable: discovery !== null,
      pagesInspected: discoveryEvidence.pagesInspected,
      searchRelatedElementsFound:
        discoveryEvidence.searchRelatedElements.length,
      evidenceSummary: discoveryEvidence.evidenceSummary,
    },
    assessedAt: new Date().toISOString(),
    ...result,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log("\n=================================");
  console.log("FEASIBILITY RESULT");
  console.log("=================================");

  console.log(`Status: ${result.status}`);
  console.log(`Mismatch type: ${result.mismatchType}`);
  console.log(`Summary: ${result.summary}`);

  printList("Blockers", result.blockers);
  printList("Missing requirements", result.missingRequirements);
  printList("Missing or unverified capabilities", result.missingCapabilities);
  printList("Missing configuration", result.missingConfiguration);
  printList("Missing locator information", result.missingLocators);
  printList("Recommended automation approach", result.automationApproach);
  printList("Recommendations", result.recommendations);
  printList("Assumptions", result.assumptions);

  printScenarioAssessments(result.scenarioAssessments);

  console.log(`\nOutput: ${outputPath}`);
  console.log("\nFeasibility assessment completed.");
}

main().catch((error: unknown) => {
  console.error("\nAutomation Feasibility Agent failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});