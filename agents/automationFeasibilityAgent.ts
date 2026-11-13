
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

type CapabilityState =
  | "NOT_DETECTED"
  | "DETECTED_UNVERIFIED"
  | "VERIFIED"
  | "CONFIRMED_UNSUPPORTED";

interface ScenarioAssessment {
  scenarioId: string;
  scenarioName: string;
  status: ScenarioStatus;
  reason: string;
  evidence: string[];
  missingCapabilities: string[];
  unverifiedCapabilities: string[];
  recommendations: string[];
}

interface FeasibilityResult {
  status: FeasibilityStatus;
  mismatchType: MismatchType;
  summary: string;
  blockers: string[];
  missingRequirements: string[];
  missingCapabilities: string[];
  unverifiedCapabilities: string[];
  missingConfiguration: string[];
  missingLocators: string[];
  automationApproach: string[];
  recommendations: string[];
  assumptions: string[];
  scenarioAssessments: ScenarioAssessment[];
}

interface CapabilityEvidence {
  capability: string;
  requiredByRequirement?: boolean;
  potentialControlsFound: boolean;
  status: string;
  confidence?: string;
  evidence: string[];
  behaviorVerified: boolean;
  note?: string;
}

interface CapabilityAssessmentResult {
  capability: string;
  state: CapabilityState;
  requiredByRequirement: boolean;
  controlsDetected: boolean;
  behaviorVerified: boolean;
  evidence: string[];
  note: string;
}

interface DiscoveryEvidence {
  available: boolean;
  inspectedPages: any[];
  pagesInspected: number;
  requiredCapabilities: string[];
  capabilityAssessments: CapabilityEvidence[];
  searchRelatedElements: any[];
  authenticationRequired: boolean;
  evidenceSummary: string[];
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

/**
 * Capability detection patterns.
 *
 * Explicit capabilities are detected from the original requirement.
 * Inferred capabilities are detected from generated scenarios.
 *
 * Keep patterns specific enough to avoid treating ordinary words
 * in scenario descriptions as independent application capabilities.
 */
const CAPABILITY_PATTERNS: Record<Capability, RegExp> = {
  authentication:
    /\b(login|log in|sign in|signin|sign-in|logout|log out|authentication|authenticate|username|password)\b/i,

  productListing:
    /\b(product listing|product catalog|product catalogue|inventory page|list products|product list|product details|product cards|product grid)\b/i,

  search:
    /\b(search|searching|searches|search results|search input|keyword search|find products|find items)\b/i,

  filtering:
    /\b(filter|filtering|filters|refine results|category filter|price filter)\b/i,

  sorting:
    /\b(sort|sorting|sort by|order by|ascending|descending|low to high|high to low)\b/i,

  pagination:
    /\b(pagination|paginate|page size|per page|next page|previous page|page navigation|load more|page number)\b/i,

  cart:
    /\b(cart|basket|add to cart|remove from cart|shopping cart)\b/i,

  checkout:
    /\b(checkout|check out|payment|place order|purchase|billing|shipping address)\b/i,

  forms:
    /\b(registration form|register form|contact form|checkout form|customer details form|form validation|form submission)\b/i,

  navigation:
    /\b(navigation menu|navigation link|sidebar|hamburger menu|main menu)\b/i,
};

const CAPABILITY_LOCATORS: Record<Capability, string> = {
  authentication:
    "Login form, username field, password field, and login button locators",

  productListing:
    "Product listing container, product item, product name, and product details locators",

  search:
    "Search input, search action, search results container, and no-results message locators",

  filtering:
    "Filter controls, filter options, and filtered results locators",

  sorting:
    "Sorting control, sorting options, and sorted results locators",

  pagination:
    "Pagination container, next-page button, previous-page button, and current-page indicator locators",

  cart:
    "Add-to-cart button, remove-from-cart button, cart container, and cart item locators",

  checkout:
    "Checkout form, customer details fields, and order submission locators",

  forms:
    "Form fields, validation messages, and submit button locators",

  navigation:
    "Navigation menu, navigation links, and navigation controls locators",
};

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

function getScenarioId(scenario: any, index: number): string {
  return String(
    scenario?.scenarioId ??
    scenario?.id ??
    scenario?.testCaseId ??
    `SCENARIO_${index + 1}`
  );
}

function getScenarioName(scenario: any, index: number): string {
  return String(
    scenario?.scenarioName ??
    scenario?.title ??
    scenario?.name ??
    scenario?.description ??
    `Scenario ${index + 1}`
  );
}

function getApplicationName(application: any, discovery: any): string {
  return (
    application?.application?.name ??
    application?.name ??
    discovery?.application?.name ??
    "Not identified"
  );
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();

  return items
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;

      const key = item.toLowerCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

function getSearchElements(discovery: any): any[] {
  const elements: any[] = [];

  const pages = [
    ...(discovery?.initialPage ? [discovery.initialPage] : []),
    ...(discovery?.inspectedPage ? [discovery.inspectedPage] : []),
    ...(Array.isArray(discovery?.pages) ? discovery.pages : []),
  ];

  for (const page of pages) {
    if (Array.isArray(page?.searchRelatedElements)) {
      elements.push(...page.searchRelatedElements);
    }
  }

  if (
    Array.isArray(
      discovery?.capabilityAssessment?.searchRelatedElements
    )
  ) {
    elements.push(
      ...discovery.capabilityAssessment.searchRelatedElements
    );
  }

  return elements;
}

function getDiscoveryEvidence(discovery: any): DiscoveryEvidence {
  if (!discovery || typeof discovery !== "object") {
    return {
      available: false,
      inspectedPages: [],
      pagesInspected: 0,
      requiredCapabilities: [],
      capabilityAssessments: [],
      searchRelatedElements: [],
      authenticationRequired: false,
      evidenceSummary: [
        "No application discovery evidence was supplied.",
      ],
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

  const rawAssessments =
    discovery.capabilityAssessment?.capabilities;

  const capabilityAssessments: CapabilityEvidence[] =
    Array.isArray(rawAssessments)
      ? rawAssessments.map((item: any) => ({
          capability: String(item.capability || "unknown"),
          requiredByRequirement: false,
          potentialControlsFound:
            item.potentialControlsFound === true,
          status: String(item.status || "UNKNOWN"),
          confidence: item.confidence,
          evidence: Array.isArray(item.evidence)
            ? uniqueStrings(
                item.evidence.filter(
                  (value: unknown) => typeof value === "string"
                )
              )
            : [],
          behaviorVerified: item.behaviorVerified === true,
          note: item.note,
        }))
      : [];

  const requiredCapabilities = Array.isArray(
    discovery.requiredCapabilities
  )
    ? discovery.requiredCapabilities.filter(
        (value: unknown): value is string =>
          typeof value === "string"
      )
    : [];

  const searchRelatedElements = getSearchElements(discovery);

  const initialPageHasPassword =
    Array.isArray(discovery.initialPage?.elements) &&
    discovery.initialPage.elements.some(
      (element: any) => element.type === "password"
    );

  const loginFailed =
    discovery.login?.attempted === false &&
    initialPageHasPassword;

  const authenticationRequired =
    loginFailed ||
    uniquePages.some(
      (page) => page.authenticationRequired === true
    );

  const evidenceSummary = uniqueStrings(
    uniquePages.map((page) => {
      const title = page.title || "Untitled page";
      const url = page.url || page.finalUrl || "URL unavailable";

      const elements = Array.isArray(page.elements)
        ? page.elements.length
        : 0;

      return (
        `Inspected page "${title}" at ${url}; ` +
        `captured ${elements} visible elements.`
      );
    })
  );

  for (const assessment of capabilityAssessments) {
    evidenceSummary.push(
      `${assessment.capability}: ` +
      `${assessment.potentialControlsFound ? "potential controls found" : "not detected on inspected pages"}; ` +
      `behavior verified: ${assessment.behaviorVerified}.`
    );
  }

  if (capabilityAssessments.length === 0 && uniquePages.length > 0) {
    evidenceSummary.push(
      "Generic capability assessments were not found in discovery output. Legacy discovery evidence will be used where possible."
    );
  }

  return {
    available: true,
    inspectedPages: uniquePages,
    pagesInspected: uniquePages.length,
    requiredCapabilities,
    capabilityAssessments,
    searchRelatedElements,
    authenticationRequired,
    evidenceSummary: uniqueStrings(evidenceSummary),
  };
}

function validateStringArray(value: any, field: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item: unknown) => typeof item === "string")
  ) {
    throw new Error(`${field} must be an array of strings.`);
  }

  return uniqueStrings(value);
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
    "unverifiedCapabilities",
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
        unverifiedCapabilities: validateStringArray(
          item.unverifiedCapabilities ?? [],
          "scenarioAssessment.unverifiedCapabilities"
        ),
        recommendations: validateStringArray(
          item.recommendations,
          "scenarioAssessment.recommendations"
        ),
      };
    });

  if (assessments.length !== scenarios.length) {
    throw new Error(
      `Expected ${scenarios.length} scenario assessments, ` +
      `received ${assessments.length}.`
    );
  }

  const expectedIds = scenarios.map((scenario, index) =>
    getScenarioId(scenario, index)
  );

  const actualIds = assessments.map(
    (assessment) => assessment.scenarioId
  );

  for (const expectedId of expectedIds) {
    const matches = actualIds.filter(
      (actualId) => actualId === expectedId
    ).length;

    if (matches !== 1) {
      throw new Error(
        `Expected exactly one assessment for ${expectedId}, found ${matches}.`
      );
    }
  }

  return {
    status: data.status,
    mismatchType: data.mismatchType,
    summary: data.summary,
    blockers: data.blockers,
    missingRequirements: data.missingRequirements,
    missingCapabilities: data.missingCapabilities,
    unverifiedCapabilities: data.unverifiedCapabilities,
    missingConfiguration: data.missingConfiguration,
    missingLocators: data.missingLocators,
    automationApproach: data.automationApproach,
    recommendations: data.recommendations,
    assumptions: data.assumptions,
    scenarioAssessments: assessments,
  };
}

function getScenarioText(scenario: any): string {
  return JSON.stringify({
    title: scenario?.title,
    name: scenario?.name,
    description: scenario?.description,
    preconditions: scenario?.preconditions,
    steps: scenario?.steps,
    testData: scenario?.testData,
    expectedResult: scenario?.expectedResult,
    expectedOutcome: scenario?.expectedOutcome,
  });
}

/**
 * Explicit capabilities come ONLY from the original requirement.
 * Scenario-derived capabilities are inferred dependencies.
 * Discovery metadata never creates new requirement capabilities.
 */
function deriveCapabilityGroups(
  requirement: string,
  scenarios: any[]
): {
  explicitCapabilities: string[];
  inferredCapabilities: string[];
  requiredCapabilities: string[];
} {
  const allCapabilities = Object.keys(
    CAPABILITY_PATTERNS
  ) as Capability[];

  const explicitCapabilities = allCapabilities.filter(
    (capability) =>
      CAPABILITY_PATTERNS[capability].test(requirement)
  );

  const scenarioText = scenarios
    .map((scenario) => getScenarioText(scenario))
    .join("\n");

  const scenarioCapabilities = allCapabilities.filter(
    (capability) =>
      CAPABILITY_PATTERNS[capability].test(scenarioText)
  );

  const inferredCapabilities = scenarioCapabilities.filter(
    (capability) => !explicitCapabilities.includes(capability)
  );

  return {
    explicitCapabilities,
    inferredCapabilities,
    requiredCapabilities: uniqueStrings([
      ...explicitCapabilities,
      ...inferredCapabilities,
    ]),
  };
}

function getCapabilityAssessment(
  capability: string,
  discoveryEvidence: DiscoveryEvidence
): CapabilityEvidence | undefined {
  return discoveryEvidence.capabilityAssessments.find(
    (item) =>
      item.capability.toLowerCase() === capability.toLowerCase()
  );
}

function scenarioNeedsCapability(
  scenario: any,
  capability: string
): boolean {
  const pattern =
    CAPABILITY_PATTERNS[capability as Capability];

  return pattern ? pattern.test(getScenarioText(scenario)) : false;
}

function getCapabilityLocatorName(capability: string): string {
  return (
    CAPABILITY_LOCATORS[capability as Capability] ??
    `${capability} control locators`
  );
}

function normalizeCapabilityNames(
  items: string[],
  allowedCapabilities: string[]
): string[] {
  const normalized: string[] = [];

  for (const item of items) {
    const value = item.toLowerCase().trim();

    const match = allowedCapabilities.find((capability) => {
      if (value === capability.toLowerCase()) return true;

      const pattern = CAPABILITY_PATTERNS[
        capability as Capability
      ];

      return pattern?.test(value) ?? false;
    });

    if (match) {
      normalized.push(match);
    }
  }

  return uniqueStrings(normalized);
}

function normalizeMissingLocators(
  existingLocators: string[],
  capabilities: string[]
): string[] {
  const normalized: string[] = [];
  const recognizedCapabilities = new Set<string>();

  for (const locator of existingLocators) {
    const text = locator.toLowerCase();

    const matchedCapability = (
      Object.keys(CAPABILITY_LOCATORS) as Capability[]
    ).find((capability) =>
      CAPABILITY_PATTERNS[capability].test(text)
    );

    if (matchedCapability) {
      recognizedCapabilities.add(matchedCapability);
    } else {
      normalized.push(locator);
    }
  }

  for (const capability of capabilities) {
    if (
      recognizedCapabilities.has(capability) &&
      CAPABILITY_LOCATORS[capability as Capability]
    ) {
      normalized.push(getCapabilityLocatorName(capability));
    }
  }

  return uniqueStrings(normalized);
}

function getCapabilityState(
  assessment: CapabilityEvidence | undefined,
  legacySearchElements: any[],
  capability: string
): CapabilityState {
  if (!assessment) {
    if (
      capability === "search" &&
      legacySearchElements.length > 0
    ) {
      return "DETECTED_UNVERIFIED";
    }

    return "NOT_DETECTED";
  }

  if (assessment.status === "CONFIRMED_UNSUPPORTED") {
    return "CONFIRMED_UNSUPPORTED";
  }

  if (assessment.behaviorVerified) {
    return "VERIFIED";
  }

  if (assessment.potentialControlsFound) {
    return "DETECTED_UNVERIFIED";
  }

  return "NOT_DETECTED";
}

function buildCapabilityResults(
  requiredCapabilities: string[],
  explicitCapabilities: string[],
  discoveryEvidence: DiscoveryEvidence
): CapabilityAssessmentResult[] {
  return requiredCapabilities.map((capability) => {
    const assessment = getCapabilityAssessment(
      capability,
      discoveryEvidence
    );

    const state = getCapabilityState(
      assessment,
      discoveryEvidence.searchRelatedElements,
      capability
    );

    return {
      capability,
      state,
      requiredByRequirement:
        explicitCapabilities.includes(capability),
      controlsDetected:
        state === "DETECTED_UNVERIFIED" ||
        state === "VERIFIED",
      behaviorVerified: state === "VERIFIED",
      evidence: assessment?.evidence ?? (
        capability === "search" &&
        discoveryEvidence.searchRelatedElements.length > 0
          ? ["Search-related elements were found in legacy discovery output."]
          : []
      ),
      note:
        assessment?.note ??
        (
          state === "NOT_DETECTED"
            ? "No matching controls were found on the inspected pages. Other routes or application states may still provide this capability."
            : state === "DETECTED_UNVERIFIED"
              ? "Potential controls were found, but actual behavior has not been tested."
              : state === "VERIFIED"
                ? "The capability's behavior was verified by discovery evidence."
                : "The capability is explicitly reported as unsupported."
        ),
    };
  });
}


function enforceCapabilityGuardrails(
  result: FeasibilityResult,
  requirement: string,
  scenarios: any[],
  discoveryEvidence: DiscoveryEvidence,
  explicitCapabilities: string[],
  inferredCapabilities: string[],
  requiredCapabilities: string[]
): FeasibilityResult {
  const capabilityResults = buildCapabilityResults(
    requiredCapabilities,
    explicitCapabilities,
    discoveryEvidence
  );

  const unverifiedCapabilities = capabilityResults
    .filter((item) =>
      item.state === "NOT_DETECTED" ||
      item.state === "DETECTED_UNVERIFIED"
    )
    .map((item) => item.capability);

  const missingCapabilities = capabilityResults
    .filter((item) =>
      item.state === "NOT_DETECTED" ||
      item.state === "CONFIRMED_UNSUPPORTED"
    )
    .map((item) => item.capability);

  const confirmedUnsupported = capabilityResults
    .filter((item) => item.state === "CONFIRMED_UNSUPPORTED")
    .map((item) => item.capability);

  const detectedButUnverified = capabilityResults
    .filter((item) => item.state === "DETECTED_UNVERIFIED")
    .map((item) => item.capability);

  // Assess every scenario independently.
  const affectedAssessments = result.scenarioAssessments.map(
    (assessment, index) => {
      const scenario = scenarios.find(
        (item, scenarioIndex) =>
          getScenarioId(item, scenarioIndex) === assessment.scenarioId
      ) ?? scenarios[index];

      const scenarioCapabilities = requiredCapabilities.filter(
        (capability) =>
          scenarioNeedsCapability(scenario, capability)
      );

      const affectedCapabilities = scenarioCapabilities.filter(
        (capability) =>
          unverifiedCapabilities.includes(capability) ||
          confirmedUnsupported.includes(capability)
      );

      const normalizedMissing = normalizeCapabilityNames(
        assessment.missingCapabilities,
        requiredCapabilities
      );

      const normalizedUnverified = normalizeCapabilityNames(
        assessment.unverifiedCapabilities,
        requiredCapabilities
      );

      if (affectedCapabilities.length === 0) {
        return {
          ...assessment,
          evidence: uniqueStrings(assessment.evidence),
          missingCapabilities: normalizedMissing,
          unverifiedCapabilities: normalizedUnverified,
          recommendations: uniqueStrings(assessment.recommendations),
        };
      }

      const scenarioMissing = affectedCapabilities.filter(
        (capability) =>
          missingCapabilities.includes(capability)
      );

      const scenarioUnverified = affectedCapabilities.filter(
        (capability) =>
          unverifiedCapabilities.includes(capability)
      );

      const hasConfirmedUnsupported =
        affectedCapabilities.some((capability) =>
          confirmedUnsupported.includes(capability)
        );

      const evidence = [
        ...assessment.evidence,
        ...affectedCapabilities.map((capability) => {
          const item = capabilityResults.find(
            (entry) => entry.capability === capability
          );

          return item
            ? `${capability}: ${item.note}`
            : `${capability}: behavior not verified.`;
        }),
      ];

      // Do not replace a more specific clarification or configuration
      // decision with NEEDS_REVIEW.
      let scenarioStatus: ScenarioStatus;

      if (hasConfirmedUnsupported) {
        scenarioStatus = "BLOCKED";
      } else if (
        assessment.status === "NEEDS_CLARIFICATION" ||
        assessment.status === "NEEDS_CONFIGURATION"
      ) {
        scenarioStatus = assessment.status;
      } else {
        scenarioStatus = "NEEDS_REVIEW";
      }

      const scenarioReason =
        scenarioStatus === "BLOCKED"
          ? `Application evidence confirms that a required capability is unsupported: ${affectedCapabilities.join(", ")}.`
          : scenarioStatus === "NEEDS_CONFIGURATION"
            ? assessment.reason
            : scenarioStatus === "NEEDS_CLARIFICATION"
              ? assessment.reason
              : `Required capability evidence is incomplete for this scenario: ${affectedCapabilities.join(", ")}. Verify the application behavior before generating executable tests.`;

      return {
        ...assessment,
        status: scenarioStatus,
        reason: scenarioReason,
        evidence: uniqueStrings(evidence),
        missingCapabilities: uniqueStrings([
          ...normalizedMissing,
          ...scenarioMissing,
        ]),
        unverifiedCapabilities: uniqueStrings([
          ...normalizedUnverified,
          ...scenarioUnverified,
        ]),
        recommendations: uniqueStrings([
          ...assessment.recommendations,
          ...affectedCapabilities.map((capability) =>
            confirmedUnsupported.includes(capability)
              ? `Resolve the confirmed ${capability} limitation or select a compatible application.`
              : `Inspect and verify the ${capability} capability before generating this scenario's executable test.`
          ),
        ]),
      };
    }
  );

  const recommendations = uniqueStrings([
    ...result.recommendations,
    "Verify required application capabilities through actual browser interaction before generating executable tests.",
    "Treat discovered controls as potential evidence until their behavior is verified.",
    "Do not treat capabilities missing from inspected pages as proof that the entire application lacks those features.",
  ]);

  const missingConfiguration = discoveryEvidence.authenticationRequired
    ? uniqueStrings([
        ...result.missingConfiguration,
        "Valid application authentication or access configuration is required.",
      ])
    : uniqueStrings(result.missingConfiguration);

  const missingLocators = missingCapabilities.map(
    (capability) => getCapabilityLocatorName(capability)
  );

  const finalScenarioAssessments = affectedAssessments;

  // Derive the overall status from the final scenario decisions.
  const readyCount = finalScenarioAssessments.filter(
    (item) => item.status === "READY"
  ).length;

  const blockedCount = finalScenarioAssessments.filter(
    (item) => item.status === "BLOCKED"
  ).length;

  const clarificationCount = finalScenarioAssessments.filter(
    (item) => item.status === "NEEDS_CLARIFICATION"
  ).length;

  const configurationCount = finalScenarioAssessments.filter(
    (item) => item.status === "NEEDS_CONFIGURATION"
  ).length;

  const reviewCount = finalScenarioAssessments.filter(
    (item) => item.status === "NEEDS_REVIEW"
  ).length;

  let status = result.status;
  let mismatchType = result.mismatchType;
  let summary = result.summary;

  if (
    readyCount > 0 &&
    readyCount < finalScenarioAssessments.length
  ) {
    status = "PARTIALLY_AUTOMATABLE";

    if (confirmedUnsupported.length > 0) {
      mismatchType = "APPLICATION_REQUIREMENT_MISMATCH";
    } else if (unverifiedCapabilities.length > 0) {
      mismatchType = "UNVERIFIED_CAPABILITY";
    } else if (missingConfiguration.length > 0) {
      mismatchType = "CONFIGURATION_GAP";
    } else if (clarificationCount > 0) {
      mismatchType = "REQUIREMENT_AMBIGUITY";
    }

    summary =
      `${readyCount} of ${finalScenarioAssessments.length} scenarios are ready for automation. ` +
      "The remaining scenarios require additional evidence, clarification, configuration, or resolution of confirmed limitations.";
  } else if (
    finalScenarioAssessments.length > 0 &&
    readyCount === finalScenarioAssessments.length
  ) {
    status = "READY";
    mismatchType = "NONE";
    summary =
      "All scenarios have sufficient evidence and configuration for automation.";
  } else if (configurationCount > 0 || missingConfiguration.length > 0) {
    status = "NEEDS_CONFIGURATION";
    mismatchType = "CONFIGURATION_GAP";
    summary =
      "Necessary application access, credentials, or environment configuration is incomplete.";
  } else if (clarificationCount > 0) {
    status = "NEEDS_CLARIFICATION";
    mismatchType = "REQUIREMENT_AMBIGUITY";
    summary =
      "Expected behavior is not sufficiently defined for the affected scenarios.";
  } else if (reviewCount > 0 || unverifiedCapabilities.length > 0) {
    status = "NEEDS_REVIEW";
    mismatchType = "UNVERIFIED_CAPABILITY";
    summary =
      `Required application capabilities have not been verified: ${unverifiedCapabilities.join(", ")}. ` +
      "This is an evidence gap, not confirmation that the entire application lacks those capabilities.";
  } else if (
    blockedCount === finalScenarioAssessments.length &&
    blockedCount > 0
  ) {
    status = "BLOCKED";
    mismatchType =
      confirmedUnsupported.length > 0
        ? "APPLICATION_REQUIREMENT_MISMATCH"
        : result.mismatchType;

    summary =
      confirmedUnsupported.length > 0
        ? `Application evidence confirms that required capabilities are unsupported: ${confirmedUnsupported.join(", ")}.`
        : "Specific evidence-based blockers prevent the scenarios from proceeding.";
  }

  return {
    ...result,
    status,
    mismatchType,
    summary,

    missingCapabilities: uniqueStrings([
      ...normalizeCapabilityNames(
        result.missingCapabilities,
        requiredCapabilities
      ),
      ...missingCapabilities,
    ]),

    unverifiedCapabilities: uniqueStrings([
      ...normalizeCapabilityNames(
        result.unverifiedCapabilities,
        requiredCapabilities
      ),
      ...unverifiedCapabilities,
    ]),

    missingConfiguration,

    missingLocators: normalizeMissingLocators(
      [
        ...result.missingLocators,
        ...missingLocators,
      ],
      uniqueStrings([
        ...missingCapabilities,
        ...detectedButUnverified,
      ])
    ),

    recommendations,

    scenarioAssessments: finalScenarioAssessments,

    assumptions: uniqueStrings([
      ...result.assumptions,
      ...capabilityResults
        .filter((item) =>
          item.state === "NOT_DETECTED" ||
          item.state === "DETECTED_UNVERIFIED"
        )
        .map((item) => `${item.capability}: ${item.note}`),
    ]),
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
    printList("Missing capabilities", assessment.missingCapabilities);
    printList("Unverified capabilities", assessment.unverifiedCapabilities);
    printList("Recommendations", assessment.recommendations);
  }
}

async function main(): Promise<void> {
  console.log("\n=================================");
  console.log("GENERIC AUTOMATION FEASIBILITY AGENT");
  console.log("=================================\n");

  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing. Check your .env file."
    );
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

  const {
    explicitCapabilities,
    inferredCapabilities,
    requiredCapabilities,
  } = deriveCapabilityGroups(requirement, scenarios);

  // The original requirement is the source of truth.
  // Discovery metadata must never determine whether a capability
  // was explicitly requested by the requirement.
  discoveryEvidence.capabilityAssessments =
    discoveryEvidence.capabilityAssessments.map((item) => ({
      ...item,
      requiredByRequirement: explicitCapabilities.includes(
        item.capability
      ),
    }));

  const capabilityResults = buildCapabilityResults(
    requiredCapabilities,
    explicitCapabilities,
    discoveryEvidence
  );

  const applicationInfo = {
    configurationAvailable: application !== null,
    configuration:
      application ?? {
        message: "No application configuration supplied.",
      },
    discoveryEvidenceAvailable: discoveryEvidence.available,
    discoveryEvidence: discovery ?? {
      message: "No application discovery evidence supplied.",
    },
    normalizedDiscoveryEvidence: discoveryEvidence,
    explicitCapabilities,
    inferredCapabilities,
    requiredCapabilities,
    capabilityResults,
  };

  const applicationName = getApplicationName(
    application,
    discovery
  );

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

  printList("Explicit capabilities", explicitCapabilities);
  printList("Inferred capabilities", inferredCapabilities);
  printList("All required capabilities", requiredCapabilities);

  console.log("\nCapability discovery results:");

  if (capabilityResults.length === 0) {
    console.log("No capability results available.");
  } else {
    for (const item of capabilityResults) {
      console.log(
        `- ${item.capability}: ${item.state}; ` +
        `explicitly requested: ${item.requiredByRequirement}; ` +
        `controls detected: ${item.controlsDetected}; ` +
        `behavior verified: ${item.behaviorVerified}`
      );
    }
  }

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

EXPLICIT CAPABILITIES:
${JSON.stringify(explicitCapabilities)}

INFERRED CAPABILITIES:
${JSON.stringify(inferredCapabilities)}

RULES:

1. Return one scenario assessment for every supplied scenario.
   Preserve its original ID and title/name.

2. Assess each scenario independently. Use evidence, not assumptions.

3. Distinguish:
   - confirmed capability;
   - potential controls found but behavior unverified;
   - capability not detected on inspected pages;
   - confirmed unsupported capability;
   - missing automation configuration;
   - incomplete acceptance criteria;
   - confirmed application/requirement mismatch.

4. A missing locator alone does not prove that a feature is absent.
   Do not invent selectors.

5. Discovery evidence only describes the pages actually inspected.
   Do not infer that the entire application has no feature based
   solely on inspected pages.

6. A potential control is not proof that a capability works.

7. Explicit capabilities are taken from the original requirement.
   Inferred capabilities are dependencies identified from scenarios.
   Do not classify an inferred capability as explicitly requested.

8. missingCapabilities MUST contain capability names only.
   Examples: ["search", "pagination"].
   Never put explanations or sentences in this array.

9. unverifiedCapabilities MUST contain capability names only.
   Include required capabilities that have not been verified,
   whether controls were detected or not.

10. Keep evidence and recommendations concise and avoid duplicates.

11. Use mismatchType:
   NONE: no identified mismatch or capability uncertainty.
   APPLICATION_REQUIREMENT_MISMATCH: supplied evidence explicitly
   confirms the requested capability is unsupported.
   UNVERIFIED_CAPABILITY: requested capability was not found or
   has not been confirmed.
   REQUIREMENT_AMBIGUITY: expected behavior cannot be determined.
   CONFIGURATION_GAP: necessary credentials, environment or access
   configuration is missing.

12. Never label an unverified feature as an application mismatch.

13. Scenario statuses:
   READY: evidence and configuration are sufficient.
   NEEDS_CLARIFICATION: expected behavior cannot be determined.
   NEEDS_CONFIGURATION: necessary configuration or access is missing.
   NEEDS_REVIEW: important capability or behavior is unverified.
   BLOCKED: a specific evidence-based obstacle prevents this scenario.

14. Overall status:
   READY when all scenarios are READY.
   PARTIALLY_AUTOMATABLE when some scenarios are READY and others
   cannot proceed.
   NEEDS_CLARIFICATION when ambiguity is the main issue.
   NEEDS_CONFIGURATION when configuration/access is the main issue.
   NEEDS_REVIEW when important capabilities are unverified.
   BLOCKED only for specific confirmed blockers.

15. Do not claim a scenario is READY just because code can be written.

16. Select an automation approach justified by the evidence.

17. Return valid JSON only. No Markdown fences.

Return exactly this structure:

{
  "status": "NEEDS_REVIEW",
  "mismatchType": "UNVERIFIED_CAPABILITY",
  "summary": "Evidence-based summary",
  "blockers": [],
  "missingRequirements": [],
  "missingCapabilities": [],
  "unverifiedCapabilities": [],
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
      "unverifiedCapabilities": [],
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

The scenarioAssessments array MUST contain exactly ${scenarios.length} items.

Use these scenario IDs:
${JSON.stringify(scenarios.map((scenario, index) => ({
  scenarioId: getScenarioId(scenario, index),
  scenarioName: getScenarioName(scenario, index),
})), null, 2)}

Do not invent behavior verification.
`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
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

  const responseText =
    responseData.candidates?.[0]?.content?.parts
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
    throw new Error(
      `Gemini returned invalid JSON:\n${responseText}`
    );
  }

  let result = validateResult(parsed, scenarios);

  result = enforceCapabilityGuardrails(
    result,
    requirement,
    scenarios,
    discoveryEvidence,
    explicitCapabilities,
    inferredCapabilities,
    requiredCapabilities
  );

  const finalCapabilityResults = buildCapabilityResults(
    requiredCapabilities,
    explicitCapabilities,
    discoveryEvidence
  );

  const output = {
    application: applicationName,
    requirement,
    scenarioCount: scenarios.length,

    evidence: {
      applicationConfigurationAvailable:
        application !== null,

      discoveryEvidenceAvailable:
        discovery !== null,

      pagesInspected:
        discoveryEvidence.pagesInspected,

      explicitCapabilities,
      inferredCapabilities,
      requiredCapabilities,

      capabilityAssessments:
        discoveryEvidence.capabilityAssessments,

      capabilityResults:
        finalCapabilityResults,

      evidenceSummary:
        discoveryEvidence.evidenceSummary,

      searchRelatedElementsFound:
        discoveryEvidence.searchRelatedElements.length,
    },

    assessedAt: new Date().toISOString(),
    ...result,
  };

  fs.mkdirSync(
    path.dirname(outputPath),
    { recursive: true }
  );

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
  printList("Missing capabilities", result.missingCapabilities);
  printList("Unverified capabilities", result.unverifiedCapabilities);
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

  console.error(
    error instanceof Error ? error.message : error
  );

  process.exitCode = 1;
});
