
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

interface RequirementAnalysis {
  quality: string;
  riskLevel: string;
  missingInformation: string[];
  questions: string[];
}

type FeasibilityStatus =
  | "READY"
  | "NEEDS_CLARIFICATION"
  | "NEEDS_CONFIGURATION"
  | "PARTIALLY_AUTOMATABLE"
  | "NEEDS_REVIEW"
  | "BLOCKED";

interface FeasibilityResult {
  status: FeasibilityStatus;
  summary: string;
  blockers: string[];
  missingRequirements: string[];
  missingCapabilities: string[];
  missingConfiguration: string[];
  missingLocators: string[];
  automationApproach: string[];
  recommendations: string[];
  assumptions: string[];
}

interface ExecutionResult {
  status: string;
  total: number;
  passed: number;
  failed: number;
  duration: string;
  exitCode: number;
}

interface TestReport {
  overallStatus: string;
  summary: {
    totalScenarios: number;
    totalExecutions: number;
    passedTests: number;
    failedTests: number;
    duration: string;
  };
}

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "output");
const AGENTS = path.join(ROOT, "agents");

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readJsonFile<T>(filePath: string): T {
  if (!fileExists(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }

  return JSON.parse(
    fs.readFileSync(filePath, "utf8")
  ) as T;
}

// =================================
// COMMAND EXECUTION
// =================================

function runCommand(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log("\n=================================");
    console.log(`RUNNING: ${command}`);
    console.log("=================================\n");

    const child = spawn(command, {
      cwd: ROOT,
      env: { ...process.env },
      stdio: "inherit",
      shell: true,
      timeout: 10 * 60 * 1000
    });

    child.on("error", (error) => {
      console.error(`Command failed: ${command}`);
      console.error(error.message);
      resolve(false);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`Command failed: ${command}`);
        console.error(`Exit code: ${code ?? "unknown"}`);
        resolve(false);
        return;
      }

      console.log(`Command completed successfully: ${command}`);
      resolve(true);
    });
  });
}

// =================================
// AGENT EXECUTION
// =================================

async function runAgent(
  fileName: string,
  description: string
): Promise<void> {
  const agentPath = path.join(AGENTS, fileName);

  if (!fileExists(agentPath)) {
    throw new Error(
      `${description} cannot run: ${agentPath} does not exist.`
    );
  }

  const success = await runCommand(
    `npx ts-node "agents/${fileName}"`
  );

  if (!success) {
    throw new Error(`${description} failed.`);
  }
}

// =================================
// FEASIBILITY VALIDATION
// =================================

function validateFeasibility(
  result: FeasibilityResult
): void {
  const statuses: FeasibilityStatus[] = [
    "READY",
    "NEEDS_CLARIFICATION",
    "NEEDS_CONFIGURATION",
    "PARTIALLY_AUTOMATABLE",
    "NEEDS_REVIEW",
    "BLOCKED"
  ];

  if (!statuses.includes(result.status)) {
    throw new Error(
      `Invalid feasibility status: ${result.status}`
    );
  }

  if (
    typeof result.summary !== "string" ||
    !result.summary.trim()
  ) {
    throw new Error("Feasibility summary is missing.");
  }
}

// =================================
// FEASIBILITY STOP
// =================================

function stopForFeasibility(
  result: FeasibilityResult
): never {
  console.error("\n=================================");
  console.error("AUTOMATION GATE REQUIRES ACTION");
  console.error("=================================");
  console.error(`Status: ${result.status}`);
  console.error(`Summary: ${result.summary}`);

  const findings: Array<[string, string[]]> = [
    ["Blockers", result.blockers ?? []],
    ["Missing requirements", result.missingRequirements ?? []],
    ["Missing capabilities", result.missingCapabilities ?? []],
    ["Missing configuration", result.missingConfiguration ?? []],
    ["Missing locators", result.missingLocators ?? []],
    ["Recommendations", result.recommendations ?? []]
  ];

  for (const [heading, items] of findings) {
    if (items.length) {
      console.error(`\n${heading}:`);
      items.forEach(item => console.error(`- ${item}`));
    }
  }

  throw new Error(
    `Pipeline paused at feasibility gate: ${result.status}. ` +
    "Resolve the listed actions before generating tests."
  );
}

// =================================
// GENERATED TEST DISCOVERY
// =================================

function findSpecFiles(directory: string): string[] {
  if (!fileExists(directory)) {
    return [];
  }

  const found: string[] = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...findSpecFiles(fullPath));
    } else if (
      entry.isFile() &&
      /\.spec\.(ts|js)$/.test(entry.name)
    ) {
      found.push(fullPath);
    }
  }

  return found;
}

// =================================
// MAIN QA PIPELINE
// =================================

async function runQAPipeline(): Promise<void> {
  const startedAt = Date.now();

  console.log("\n=================================");
  console.log("       GENERIC AI QA PIPELINE");
  console.log("=================================\n");

  // STEP 1: Requirement analysis
  console.log("STEP 1: Requirement Analysis");

  await runAgent(
    "llmRequirementAgent.ts",
    "Requirement analysis"
  );

  const requirementAnalysis =
    readJsonFile<RequirementAnalysis>(
      path.join(OUTPUT, "requirement-analysis.json")
    );

  console.log(
    `Requirement Quality: ${requirementAnalysis.quality}`
  );

  console.log(
    `Risk Level: ${requirementAnalysis.riskLevel}`
  );

  // STEP 2: Human clarification
  console.log("\nSTEP 2: Human-in-the-Loop Clarification");

  await runAgent(
    "humanClarificationAgent.ts",
    "Human clarification"
  );

  const clarificationPath =
    path.join(OUTPUT, "clarification-answers.json");

  if (!fileExists(clarificationPath)) {
    throw new Error(
      "Clarification artifact was not generated."
    );
  }

  // STEP 3: Scenario generation
  console.log("\nSTEP 3: Test Scenario Generation");

  await runAgent(
    "llmScenarioAgent.ts",
    "Test scenario generation"
  );

  const scenarios = readJsonFile<any>(
    path.join(OUTPUT, "test-scenarios.json")
  );

  const scenarioList = Array.isArray(scenarios)
    ? scenarios
    : scenarios?.scenarios ?? scenarios?.testScenarios;

  if (
    !Array.isArray(scenarioList) ||
    scenarioList.length === 0
  ) {
    throw new Error(
      "No valid test scenarios were generated."
    );
  }

  console.log(
    `Scenarios generated: ${scenarioList.length}`
  );

  // STEP 3.5: Application discovery
  console.log("\nSTEP 3.5: Application Discovery");

  const discoveryAgentPath =
    path.join(AGENTS, "applicationDiscoveryAgent.ts");

  const discoveryArtifact =
    path.join(OUTPUT, "application-discovery.json");

  if (fileExists(discoveryAgentPath)) {
    await runAgent(
      "applicationDiscoveryAgent.ts",
      "Application discovery"
    );

    if (!fileExists(discoveryArtifact)) {
      throw new Error(
        "Discovery agent ran but produced no application-discovery.json."
      );
    }

    console.log(
      "Application discovery evidence is available."
    );
  } else {
    console.warn(
      "Application discovery agent is not implemented yet."
    );

    console.warn(
      "Feasibility will be assessed using existing configuration and evidence."
    );
  }

  // STEP 4: Feasibility assessment
  console.log("\nSTEP 4: Automation Feasibility Assessment");

  await runAgent(
    "automationFeasibilityAgent.ts",
    "Automation feasibility assessment"
  );

  const feasibility =
    readJsonFile<FeasibilityResult>(
      path.join(OUTPUT, "automation-feasibility.json")
    );

  validateFeasibility(feasibility);

  console.log(
    `\nFeasibility status: ${feasibility.status}`
  );

  console.log(feasibility.summary);

  /*
   * READY:
   * All required scenarios can proceed.
   *
   * PARTIALLY_AUTOMATABLE:
   * This pipeline currently pauses for review because the
   * generator and execution agent must first support per-scenario
   * selection and partial execution.
   *
   * Other statuses:
   * Resolve clarification, configuration, review, or blockers.
   */

  if (feasibility.status !== "READY") {
    stopForFeasibility(feasibility);
  }

  // STEP 5: Generate tests
  console.log("\nSTEP 5: Playwright Test Generation");

  await runAgent(
    "playwrightTestGenerator.ts",
    "Playwright test generation"
  );

  /*
   * Generic output contract:
   * The generator should create one or more *.spec.ts files
   * under tests/generated/. Do not assume a login-specific name.
   */

  const generatedDirectory =
    path.join(ROOT, "tests", "generated");

  const generatedTests =
    findSpecFiles(generatedDirectory);

  if (generatedTests.length === 0) {
    throw new Error(
      "No generated Playwright *.spec.ts or *.spec.js files found."
    );
  }

  console.log(
    `Generated test files: ${generatedTests.length}`
  );

  generatedTests.forEach(file => {
    console.log(`- ${path.relative(ROOT, file)}`);
  });

  // STEP 6: Execute tests
  console.log("\nSTEP 6: Playwright Test Execution");

  const executionCommandSuccess = await runCommand(
    "npx ts-node agents/testExecutionAgent.ts"
  );

  const executionFile =
    path.join(OUTPUT, "execution-result.json");

  if (!fileExists(executionFile)) {
    throw new Error(
      "Execution result artifact was not generated."
    );
  }

  const execution =
    readJsonFile<ExecutionResult>(executionFile);

  console.log(`Total: ${execution.total}`);
  console.log(`Passed: ${execution.passed}`);
  console.log(`Failed: ${execution.failed}`);

  if (!executionCommandSuccess) {
    console.warn(
      "Execution command returned a failure. Continuing to analyze results."
    );
  }

  // STEP 7: Failure analysis
  console.log("\nSTEP 7: Failure Analysis");

  try {
    await runAgent(
      "failureAnalysisAgent.ts",
      "Failure analysis"
    );
  } catch (error) {
    console.warn(
      error instanceof Error ? error.message : error
    );

    console.warn(
      "Continuing; failure analysis is not available."
    );
  }

  // STEP 8: AI test report
  console.log("\nSTEP 8: AI Test Report");

  await runAgent(
    "testReportAgent.ts",
    "AI test report generation"
  );

  const reportFile =
    path.join(OUTPUT, "ai-test-report.json");

  if (!fileExists(reportFile)) {
    throw new Error(
      "AI test report was not generated."
    );
  }

  // STEP 9: HTML report
  console.log("\nSTEP 9: HTML Report");

  await runAgent(
    "htmlReportAgent.ts",
    "HTML report generation"
  );

  const htmlReportFile =
    path.join(OUTPUT, "ai-test-report.html");

  if (!fileExists(htmlReportFile)) {
    throw new Error(
      "HTML report was not generated."
    );
  }

  const report =
    readJsonFile<TestReport>(reportFile);

  console.log("\n=================================");
  console.log("       AI QA PIPELINE FINISHED");
  console.log("=================================");

  console.log(
    `Overall status: ${report.overallStatus}`
  );

  console.log(
    `Scenarios: ${report.summary.totalScenarios}`
  );

  console.log(
    `Executions: ${report.summary.totalExecutions}`
  );

  console.log(
    `Passed: ${report.summary.passedTests}`
  );

  console.log(
    `Failed: ${report.summary.failedTests}`
  );

  console.log(
    `Duration: ${report.summary.duration}`
  );

  console.log(
    `Pipeline time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
  );

  console.log("\nArtifacts:");
  console.log("- output/requirement-analysis.json");
  console.log("- output/clarification-answers.json");
  console.log("- output/test-scenarios.json");
  console.log("- output/application-discovery.json (when discovery is enabled)");
  console.log("- output/automation-feasibility.json");
  console.log("- output/execution-result.json");
  console.log("- output/failure-analysis.json (if generated)");
  console.log("- output/ai-test-report.json");
  console.log("- output/ai-test-report.html");
}

// =================================
// PIPELINE ENTRY POINT
// =================================

runQAPipeline().catch(error => {
  console.error("\n=================================");
  console.error("       AI QA PIPELINE FAILED");
  console.error("=================================\n");

  console.error(
    error instanceof Error ? error.message : error
  );

  process.exitCode = 1;
});
