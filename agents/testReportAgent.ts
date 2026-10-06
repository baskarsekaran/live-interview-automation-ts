import fs from "fs";
import path from "path";

interface Scenario {
  id: string;
  title: string;
  type: string;
}

interface ExecutionResult {
  status: "PASSED" | "FAILED";
  total: number;
  passed: number;
  failed: number;
  duration: string;
  exitCode: number;
  output: string;
}

interface FailureAnalysis {
  status: string;
  failureType: string;
  rootCause: string;
  evidence: string;
  affectedBrowsers: string;
  recommendation: string;
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

if (!fs.existsSync(scenariosPath)) {
  console.error(
    "❌ test-scenarios.json not found."
  );
  process.exit(1);
}

if (!fs.existsSync(executionPath)) {
  console.error(
    "❌ execution-result.json not found."
  );
  process.exit(1);
}

if (!fs.existsSync(failurePath)) {
  console.error(
    "❌ failure-analysis.json not found."
  );
  process.exit(1);
}

const scenarios: Scenario[] =
  JSON.parse(
    fs.readFileSync(
      scenariosPath,
      "utf-8"
    )
  );

const executionResult: ExecutionResult =
  JSON.parse(
    fs.readFileSync(
      executionPath,
      "utf-8"
    )
  );

const failureAnalysis: FailureAnalysis =
  JSON.parse(
    fs.readFileSync(
      failurePath,
      "utf-8"
    )
  );

const totalScenarios =
  scenarios.length;

const positiveScenarios =
  scenarios.filter(
    scenario =>
      scenario.type.toLowerCase() ===
      "positive"
  ).length;

const negativeScenarios =
  scenarios.filter(
    scenario =>
      scenario.type.toLowerCase() ===
      "negative"
  ).length;

const overallStatus =
  executionResult.status;

console.log("=================================");
console.log("AI TEST REPORT");
console.log("=================================");
console.log("");

console.log(
  `Overall Status: ${overallStatus}`
);

console.log(
  `Total Scenarios: ${totalScenarios}`
);

console.log(
  `Positive Scenarios: ${positiveScenarios}`
);

console.log(
  `Negative Scenarios: ${negativeScenarios}`
);

console.log(
  `Total Executions: ${executionResult.total}`
);

console.log(
  `Passed Tests: ${executionResult.passed}`
);

console.log(
  `Failed Tests: ${executionResult.failed}`
);

console.log(
  `Duration: ${executionResult.duration}`
);

console.log("");

console.log(
  `Failure Type: ${failureAnalysis.failureType}`
);

console.log(
  `Root Cause: ${failureAnalysis.rootCause}`
);

console.log(
  `Recommendation: ${failureAnalysis.recommendation}`
);

console.log("");

const report = {
  overallStatus,

  summary: {
    totalScenarios,
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

  failureAnalysis: {
    status:
      failureAnalysis.status,

    failureType:
      failureAnalysis.failureType,

    rootCause:
      failureAnalysis.rootCause,

    evidence:
      failureAnalysis.evidence,

    affectedBrowsers:
      failureAnalysis.affectedBrowsers,

    recommendation:
      failureAnalysis.recommendation
  }
};

const outputPath = path.join(
  process.cwd(),
  "output",
  "ai-test-report.json"
);

fs.writeFileSync(
  outputPath,
  JSON.stringify(
    report,
    null,
    2
  ),
  "utf-8"
);

console.log(
  "Report saved to:"
);

console.log(outputPath);