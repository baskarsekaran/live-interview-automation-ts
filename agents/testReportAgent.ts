import fs from "fs";
import path from "path";

interface Scenario {
  id: string;
  title: string;
  type?: string;
  priority?: string;
}

interface FailedTest {
  title: string;
  project?: string;
  error: string;
  stack?: string;
  duration?: number;
}

interface ExecutionResult {
  status: "PASSED" | "FAILED";
  total: number;
  passed: number;
  failed: number;
  duration: string;
  exitCode: number;
  output?: string;
  failedTests?: FailedTest[];
}

interface FailureAnalysis {
  status: string;
  failureType: string;
  rootCause: string;
  evidence: string;
  affectedBrowsers: string | string[];
  recommendation: string;
}

interface TestReport {
  overallStatus: string;

  summary: {
    totalScenarios: number;
    positiveScenarios: number;
    negativeScenarios: number;
    totalExecutions: number;
    passedTests: number;
    failedTests: number;
    duration: string;
  };

  executionEvidence: {
    failedTests: FailedTest[];
  };

  failureAnalysis: FailureAnalysis;
}

console.log("");
console.log("=================================");
console.log("AI TEST REPORT AGENT");
console.log("=================================");
console.log("");

const scenariosPath = path.join(
  process.cwd(),
  "output",
  "test-scenarios.json"
);

const executionPath = path.join(
  process.cwd(),
  "output",
  "execution-result.json"
);

const failurePath = path.join(
  process.cwd(),
  "output",
  "failure-analysis.json"
);

const outputPath = path.join(
  process.cwd(),
  "output",
  "ai-test-report.json"
);

function readJsonFile<T>(
  filePath: string
): T {

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Required file not found: ${filePath}`
    );
  }

  return JSON.parse(
    fs.readFileSync(
      filePath,
      "utf-8"
    )
  );
}

/*
 * Read scenario file.
 */
const scenarios =
  readJsonFile<Scenario[]>(
    scenariosPath
  );

/*
 * Read Playwright execution result.
 */
const executionResult =
  readJsonFile<ExecutionResult>(
    executionPath
  );

/*
 * Read Gemini failure analysis.
 */
const failureAnalysis =
  readJsonFile<FailureAnalysis>(
    failurePath
  );

/*
 * Extract actual failed test evidence.
 *
 * This comes directly from Playwright,
 * not from Gemini.
 */
const failedTests =
  executionResult.failedTests || [];

/*
 * Positive scenario:
 * TC001 = successful login.
 *
 * All remaining scenarios are negative/
 * validation scenarios.
 */
const positiveScenarios =
  scenarios.filter(
    (scenario) =>
      scenario.id === "TC001"
  ).length;

const negativeScenarios =
  scenarios.length -
  positiveScenarios;

/*
 * Determine final status from Playwright.
 *
 * Playwright remains the source of truth.
 */
const overallStatus =
  executionResult.failed === 0
    ? "PASSED"
    : "FAILED";

/*
 * Build final AI test report.
 */
const report: TestReport = {

  overallStatus,

  summary: {

    totalScenarios:
      scenarios.length,

    positiveScenarios,

    negativeScenarios,

    totalExecutions:
      executionResult.total,

    passedTests:
      executionResult.passed,

    failedTests:
      executionResult.failed,

    duration:
      executionResult.duration
  },

  executionEvidence: {

    failedTests
  },

  failureAnalysis
};

/*
 * Save report.
 */
fs.writeFileSync(
  outputPath,
  JSON.stringify(
    report,
    null,
    2
  ),
  "utf-8"
);

/*
 * Console output.
 */
console.log(
  `Overall Status: ${overallStatus}`
);

console.log(
  `Total Scenarios: ${scenarios.length}`
);

console.log(
  `Positive Scenarios: ${positiveScenarios}`
);

console.log(
  `Negative/Validation Scenarios: ${negativeScenarios}`
);

console.log(
  `Total Executions: ${executionResult.total}`
);

console.log(
  `Passed: ${executionResult.passed}`
);

console.log(
  `Failed: ${executionResult.failed}`
);

console.log(
  `Duration: ${executionResult.duration}`
);

console.log("");

console.log(
  `Failure Analysis: ${failureAnalysis.status}`
);

console.log(
  `Failure Type: ${failureAnalysis.failureType}`
);

if (
  failureAnalysis.status ===
  "FAILURE_ANALYZED"
) {

  console.log(
    `Root Cause: ${failureAnalysis.rootCause}`
  );

  console.log(
    `Evidence: ${failureAnalysis.evidence}`
  );

  console.log(
    `Affected Browsers: ${failureAnalysis.affectedBrowsers}`
  );

  console.log(
    `Recommendation: ${failureAnalysis.recommendation}`
  );
}

if (failedTests.length > 0) {

  console.log("");

  console.log(
    "Playwright Failure Evidence:"
  );

  for (
    const test
    of failedTests
  ) {

    console.log(
      `- ${test.title}`
    );

    if (test.project) {
      console.log(
        `  Browser: ${test.project}`
      );
    }

    console.log(
      `  Error: ${test.error}`
    );
  }
}

console.log("");

console.log(
  `Output: ${outputPath}`
);

console.log("");

console.log(
  "AI Test Report Agent completed successfully."
);