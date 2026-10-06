import fs from "fs";
import path from "path";

interface FailedTest {
  title: string;
  error: string;
}

interface ExecutionResult {
  status: string;
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
  affectedBrowsers: string;
  recommendation: string;
}

console.log("=================================");
console.log("FAILURE ANALYSIS AGENT");
console.log("=================================");

const executionPath = path.join(
  process.cwd(),
  "output",
  "execution-result.json"
);

if (!fs.existsSync(executionPath)) {
  console.error(
    "❌ execution-result.json not found."
  );

  process.exit(1);
}

const execution: ExecutionResult =
  JSON.parse(
    fs.readFileSync(
      executionPath,
      "utf-8"
    )
  );

console.log(
  "\nAnalyzing execution result..."
);

let failureType = "None";
let rootCause =
  "No failures detected.";
let evidence =
  `${execution.passed} of ${execution.total} tests passed successfully.`;
let affectedBrowsers = "None";
let recommendation =
  "No corrective action required.";

const failedTests =
  execution.failedTests || [];

/*
 * --------------------------------
 * NO FAILURES
 * --------------------------------
 */

if (
  execution.status === "PASSED" ||
  execution.failed === 0
) {
  failureType = "None";

  rootCause =
    "No test failures detected.";

  evidence =
    `${execution.passed} of ${execution.total} tests passed successfully.`;

  recommendation =
    "No corrective action required.";
}

/*
 * --------------------------------
 * FAILURES FOUND
 * --------------------------------
 */

else {

  const failureMessages =
    failedTests
      .map(test => test.error || "")
      .join(" ")
      .toLowerCase();

  const failedTitles =
    failedTests
      .map(test => test.title)
      .join(", ");

  /*
   * TIMEOUT
   */

  if (
    failureMessages.includes(
      "timeout"
    )
  ) {

    failureType =
      "Test Timeout";

    rootCause =
      "One or more Playwright tests exceeded the configured 30-second timeout.";

    evidence =
      `${failedTests.length} test(s) timed out: ${failedTitles}.`;

    recommendation =
      "Check application response time, locator stability, network availability, waits, and Playwright timeout configuration.";

  }

  /*
   * ASSERTION FAILURE
   */

  else if (
    failureMessages.includes(
      "expect("
    ) ||
    failureMessages.includes(
      "expected"
    ) ||
    failureMessages.includes(
      "received"
    )
  ) {

    failureType =
      "Assertion Failure";

    rootCause =
      "A test assertion did not match the actual application behavior.";

    evidence =
      `${failedTests.length} test(s) contain assertion failures: ${failedTitles}.`;

    recommendation =
      "Review the expected value, actual application behavior, and test data.";

  }

  /*
   * LOCATOR FAILURE
   */

  else if (
    failureMessages.includes(
      "locator"
    ) ||
    failureMessages.includes(
      "element"
    ) ||
    failureMessages.includes(
      "not found"
    )
  ) {

    failureType =
      "Locator Failure";

    rootCause =
      "Playwright was unable to locate or interact with an expected UI element.";

    evidence =
      `${failedTests.length} test(s) contain locator or element errors: ${failedTitles}.`;

    recommendation =
      "Verify selectors, page state, locator visibility, and synchronization.";

  }

  /*
   * NETWORK FAILURE
   */

  else if (
    failureMessages.includes(
      "net::"
    ) ||
    failureMessages.includes(
      "network"
    ) ||
    failureMessages.includes(
      "connection"
    )
  ) {

    failureType =
      "Network Failure";

    rootCause =
      "The test encountered a network or application connectivity problem.";

    evidence =
      `${failedTests.length} test(s) contain network-related errors: ${failedTitles}.`;

    recommendation =
      "Verify application availability, environment URL, network connectivity, and API dependencies.";

  }

  /*
   * UNKNOWN FAILURE
   */

  else {

    failureType =
      "Unknown";

    rootCause =
      "The execution failed, but the available error information was insufficient to classify the failure.";

    evidence =
      `${failedTests.length} test(s) failed: ${failedTitles}.`;

    recommendation =
      "Review the detailed Playwright error output and investigate the affected test cases.";
  }
}

/*
 * --------------------------------
 * BUILD RESULT
 * --------------------------------
 */

const analysis: FailureAnalysis = {

  status:
    execution.status,

  failureType,

  rootCause,

  evidence,

  affectedBrowsers,

  recommendation
};

/*
 * --------------------------------
 * CONSOLE OUTPUT
 * --------------------------------
 */

console.log(
  `\nStatus: ${analysis.status}`
);

console.log(
  `Failure Type: ${analysis.failureType}`
);

console.log(
  `Root Cause: ${analysis.rootCause}`
);

console.log(
  `Evidence: ${analysis.evidence}`
);

console.log(
  `Affected Browsers: ${analysis.affectedBrowsers}`
);

console.log(
  `Recommendation: ${analysis.recommendation}`
);

/*
 * --------------------------------
 * SAVE RESULT
 * --------------------------------
 */

const outputPath =
  path.join(
    process.cwd(),
    "output",
    "failure-analysis.json"
  );

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    analysis,
    null,
    2
  ),
  "utf-8"
);

console.log(
  "\nFailure analysis saved to:"
);

console.log(
  outputPath
);