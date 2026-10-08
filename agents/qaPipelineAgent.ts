import fs from "fs";
import path from "path";
import { exec } from "child_process";

interface RequirementAnalysis {
  quality: string;
  riskLevel: string;
  missingInformation: string[];
  questions: string[];
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

function runCommand(
  command: string
): Promise<boolean> {
  return new Promise((resolve) => {
    console.log("");
    console.log("=================================");
    console.log(`RUNNING: ${command}`);
    console.log("=================================");
    console.log("");

    exec(
      command,
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
        timeout: 10 * 60 * 1000,
        env: {
          ...process.env
        }
      },
      (error, stdout, stderr) => {
        if (stdout) {
          console.log(stdout);
        }

        if (stderr) {
          console.log(stderr);
        }

        if (error) {
          console.log(
            `Command failed: ${command}`
          );

          console.log(
            `Exit code: ${error.code ?? "unknown"}`
          );

          resolve(false);
        } else {
          console.log(
            `Command completed successfully: ${command}`
          );

          resolve(true);
        }
      }
    );
  });
}

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

async function runQAPipeline() {
  console.log("");
  console.log("=================================");
  console.log("       AI QA PIPELINE AGENT");
  console.log("=================================");
  console.log("");

  const startTime = Date.now();

  // =================================
  // STEP 1
  // Gemini Requirement Analysis
  // =================================

  console.log(
    "STEP 1: Gemini Requirement Analysis"
  );

  const requirementSuccess =
    await runCommand(
      "npx ts-node agents/llmRequirementAgent.ts"
    );

  if (!requirementSuccess) {
    throw new Error(
      "Requirement analysis failed. Pipeline stopped."
    );
  }

  const analysisFile =
    path.join(
      process.cwd(),
      "output",
      "requirement-analysis.json"
    );

  if (!fs.existsSync(analysisFile)) {
    throw new Error(
      "Requirement analysis artifact was not generated."
    );
  }

  const requirementAnalysis =
    readJsonFile<RequirementAnalysis>(
      analysisFile
    );

  console.log("");
  console.log(
    `Requirement Quality : ${requirementAnalysis.quality}`
  );

  console.log(
    `Risk Level          : ${requirementAnalysis.riskLevel}`
  );

  // =================================
  // STEP 2
  // Human-in-the-Loop Clarification
  // =================================

  console.log("");
  console.log(
    "STEP 2: Human-in-the-Loop Clarification"
  );

  console.log("");
  console.log(
    "The AI identified requirement gaps."
  );

  console.log(
    "Human clarification is required before scenario generation."
  );

  /*
   * The clarification agent supports two modes:
   *
   * 1. Local interactive mode
   *    - If input/clarification-answers.json does not exist,
   *      the agent asks the human questions.
   *
   * 2. CI/CD non-interactive mode
   *    - If input/clarification-answers.json exists,
   *      approved human answers are loaded automatically.
   *
   * Therefore we use runCommand() instead of
   * runInteractiveCommand().
   */

  const clarificationSuccess =
    await runCommand(
      "npx ts-node agents/humanClarificationAgent.ts"
    );

  if (!clarificationSuccess) {
    throw new Error(
      "Human clarification failed. Pipeline stopped."
    );
  }

  const clarificationFile =
    path.join(
      process.cwd(),
      "output",
      "clarification-answers.json"
    );

  if (!fs.existsSync(clarificationFile)) {
    throw new Error(
      "Human clarification artifact was not generated."
    );
  }

  console.log("");
  console.log(
    "Human clarification completed successfully."
  );

  // =================================
  // STEP 3
  // Gemini Scenario Generation
  // =================================

  console.log("");
  console.log(
    "STEP 3: Gemini Test Scenario Generation"
  );

  const scenarioSuccess =
    await runCommand(
      "npx ts-node agents/llmScenarioAgent.ts"
    );

  if (!scenarioSuccess) {
    throw new Error(
      "Scenario generation failed. Pipeline stopped."
    );
  }

  const scenarioFile =
    path.join(
      process.cwd(),
      "output",
      "test-scenarios.json"
    );

  if (!fs.existsSync(scenarioFile)) {
    throw new Error(
      "Test scenario artifact was not generated."
    );
  }

  /*
   * test-scenarios.json is a direct array.
   *
   * Example:
   *
   * [
   *   { "id": "TC001", ... },
   *   { "id": "TC002", ... }
   * ]
   */

  const scenarioData =
    readJsonFile<any[]>(
      scenarioFile
    );

  if (!Array.isArray(scenarioData)) {
    throw new Error(
      "Invalid test-scenarios.json format. Expected an array."
    );
  }

  console.log("");
  console.log(
    `Scenarios generated: ${scenarioData.length}`
  );

  // =================================
  // STEP 4
  // Gemini Playwright Code Generation
  // =================================

  console.log("");
  console.log(
    "STEP 4: Gemini Playwright Code Generation"
  );

  const codeGenerationSuccess =
    await runCommand(
      "npx ts-node agents/playwrightTestGenerator.ts"
    );

  if (!codeGenerationSuccess) {
    throw new Error(
      "Playwright code generation failed. Pipeline stopped."
    );
  }

  const generatedTestFile =
    path.join(
      process.cwd(),
      "tests",
      "generated",
      "login.spec.ts"
    );

  if (!fs.existsSync(generatedTestFile)) {
    throw new Error(
      "Generated Playwright test file was not created."
    );
  }

  // =================================
  // STEP 5
  // Playwright Test Execution
  // =================================

  console.log("");
  console.log(
    "STEP 5: Playwright Test Execution"
  );

  const executionSuccess =
    await runCommand(
      "npx ts-node agents/testExecutionAgent.ts"
    );

  /*
   * Playwright execution can fail because individual
   * tests failed.
   *
   * This should NOT immediately stop the pipeline.
   *
   * The failure-analysis agent needs the execution
   * artifact to understand what failed.
   */

  if (!executionSuccess) {
    console.log("");
    console.log(
      "Playwright execution command reported failure."
    );

    console.log(
      "Continuing to failure analysis..."
    );
  }

  const executionFile =
    path.join(
      process.cwd(),
      "output",
      "execution-result.json"
    );

  if (!fs.existsSync(executionFile)) {
    throw new Error(
      "Execution result artifact was not generated."
    );
  }

  const executionResult =
    readJsonFile<ExecutionResult>(
      executionFile
    );

  console.log("");
  console.log(
    `Total Tests : ${executionResult.total}`
  );

  console.log(
    `Passed      : ${executionResult.passed}`
  );

  console.log(
    `Failed      : ${executionResult.failed}`
  );

  // =================================
  // STEP 6
  // Gemini Failure Analysis
  // =================================

  console.log("");
  console.log(
    "STEP 6: Gemini Failure Analysis"
  );

  const failureAnalysisSuccess =
    await runCommand(
      "npx ts-node agents/failureAnalysisAgent.ts"
    );

  if (!failureAnalysisSuccess) {
    console.log("");
    console.log(
      "Failure analysis reported an error."
    );
  }

  const failureAnalysisFile =
    path.join(
      process.cwd(),
      "output",
      "failure-analysis.json"
    );

  if (!fs.existsSync(failureAnalysisFile)) {
    console.log(
      "Warning: failure-analysis.json was not generated."
    );
  }

  // =================================
  // STEP 7
  // AI Test Report
  // =================================

  console.log("");
  console.log(
    "STEP 7: AI Test Report Generation"
  );

  const reportSuccess =
    await runCommand(
      "npx ts-node agents/testReportAgent.ts"
    );

  if (!reportSuccess) {
    throw new Error(
      "AI test report generation failed."
    );
  }

  const reportFile =
    path.join(
      process.cwd(),
      "output",
      "ai-test-report.json"
    );

  if (!fs.existsSync(reportFile)) {
    throw new Error(
      "AI test report was not generated."
    );
  }

  // =================================
  // STEP 8
  // HTML Report
  // =================================

  console.log("");
  console.log(
    "STEP 8: HTML Report Generation"
  );

  const htmlSuccess =
    await runCommand(
      "npx ts-node agents/htmlReportAgent.ts"
    );

  if (!htmlSuccess) {
    throw new Error(
      "HTML report generation failed."
    );
  }

  const htmlReportFile =
    path.join(
      process.cwd(),
      "output",
      "ai-test-report.html"
    );

  if (!fs.existsSync(htmlReportFile)) {
    throw new Error(
      "HTML report was not generated."
    );
  }

  // =================================
  // FINAL SUMMARY
  // =================================

  const report =
    readJsonFile<TestReport>(
      reportFile
    );

  const durationSeconds =
    (
      (Date.now() - startTime) /
      1000
    ).toFixed(1);

  console.log("");
  console.log("=================================");
  console.log("     AI QA PIPELINE COMPLETED");
  console.log("=================================");
  console.log("");

  console.log(
    `Overall Status : ${report.overallStatus}`
  );

  console.log(
    `Scenarios      : ${report.summary.totalScenarios}`
  );

  console.log(
    `Total Tests    : ${report.summary.totalExecutions}`
  );

  console.log(
    `Passed         : ${report.summary.passedTests}`
  );

  console.log(
    `Failed         : ${report.summary.failedTests}`
  );

  console.log(
    `Test Duration  : ${report.summary.duration}`
  );

  console.log(
    `Pipeline Time  : ${durationSeconds}s`
  );

  console.log("");
  console.log("Generated Artifacts:");
  console.log("");

  console.log(
    "✓ output/requirement-analysis.json"
  );

  console.log(
    "✓ output/clarification-answers.json"
  );

  console.log(
    "✓ output/test-scenarios.json"
  );

  console.log(
    "✓ tests/generated/login.spec.ts"
  );

  console.log(
    "✓ output/execution-result.json"
  );

  console.log(
    "✓ output/failure-analysis.json"
  );

  console.log(
    "✓ output/ai-test-report.json"
  );

  console.log(
    "✓ output/ai-test-report.html"
  );

  console.log("");
  console.log("=================================");
  console.log("        PIPELINE FINISHED");
  console.log("=================================");
  console.log("");
}

runQAPipeline().catch(
  (error) => {
    console.error("");
    console.error(
      "================================="
    );
    console.error(
      "       AI QA PIPELINE FAILED"
    );
    console.error(
      "================================="
    );
    console.error("");

    console.error(
      error instanceof Error
        ? error.message
        : error
    );

    console.error("");
    process.exit(1);
  }
);