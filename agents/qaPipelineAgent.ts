import fs from "fs";
import { exec } from "child_process";
import path from "path";

interface RequirementAnalysis {
  requirementQuality: string;
  riskLevel: string;
  questions: string[];
}

function runCommand(command: string): Promise<boolean> {

  return new Promise((resolve) => {

    console.log("\n=================================");
    console.log(`RUNNING: ${command}`);
    console.log("=================================\n");

    exec(
      command,
      {
        cwd: process.cwd(),

        // Give Playwright and TypeScript
        // enough output buffer.
        maxBuffer: 20 * 1024 * 1024,

        // Prevent the orchestrator from
        // killing long-running test execution.
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
            `Command completed with failure: ${command}`
          );

          console.log(
            `Exit code: ${error.code ?? "unknown"}`
          );

          console.log(
            `Signal: ${error.signal ?? "none"}`
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

async function runQAPipeline() {

  console.log("\n");

  console.log(
    "================================="
  );

  console.log(
    "       AI QA PIPELINE AGENT"
  );

  console.log(
    "================================="
  );

  // --------------------------------
  // STEP 1 - Requirement Analysis
  // --------------------------------

  console.log(
    "\nSTEP 1: Requirement Clarification"
  );

  const clarificationSuccess =
    await runCommand(
      "npx ts-node agents/requirementClarificationAgent.ts"
    );

  if (!clarificationSuccess) {

    console.log(
      "\n❌ Requirement analysis failed."
    );

    return;
  }

  const analysisFile =
    path.join(
      process.cwd(),
      "output",
      "requirement-analysis.json"
    );

  if (!fs.existsSync(analysisFile)) {

    console.log(
      "\n❌ requirement-analysis.json not found."
    );

    return;
  }

  const analysis:
    RequirementAnalysis =
      JSON.parse(
        fs.readFileSync(
          analysisFile,
          "utf-8"
        )
      );

  console.log(
    "\nRequirement Quality:",
    analysis.requirementQuality
  );

  console.log(
    "Risk Level:",
    analysis.riskLevel
  );

  // --------------------------------
  // Stop only for completely
  // incomplete requirements
  // --------------------------------

  if (
    analysis.requirementQuality ===
    "INCOMPLETE"
  ) {

    console.log(
      "\n❌ PIPELINE STOPPED"
    );

    console.log(
      "\nClarification required:"
    );

    analysis.questions.forEach(
      question =>
        console.log(`- ${question}`)
    );

    return;
  }

  // --------------------------------
  // STEP 2 - Scenario Generation
  // --------------------------------

  console.log(
    "\nSTEP 2: Test Scenario Generation"
  );

  const scenarioSuccess =
    await runCommand(
      "npx ts-node agents/requirementAgent.ts"
    );

  if (!scenarioSuccess) {

    console.log(
      "\n❌ Scenario generation failed."
    );

    return;
  }

  // --------------------------------
  // STEP 3 - Playwright Generation
  // --------------------------------

  console.log(
    "\nSTEP 3: Playwright Test Generation"
  );

  const generatorSuccess =
    await runCommand(
      "npx ts-node agents/playwrightTestGenerator.ts"
    );

  if (!generatorSuccess) {

    console.log(
      "\n❌ Playwright test generation failed."
    );

    return;
  }

  // --------------------------------
  // STEP 4 - Test Execution
  // --------------------------------

  console.log(
    "\nSTEP 4: Playwright Test Execution"
  );

  const executionSuccess =
    await runCommand(
      "npx ts-node agents/testExecutionAgent.ts"
    );

  if (!executionSuccess) {

    console.log(
      "\n⚠️ Test execution command failed."
    );

    console.log(
      "Continuing to failure analysis..."
    );
  }

  // --------------------------------
  // STEP 5 - Failure Analysis
  // --------------------------------

  console.log(
    "\nSTEP 5: Failure Analysis"
  );

  const failureAnalysisSuccess =
    await runCommand(
      "npx ts-node agents/failureAnalysisAgent.ts"
    );

  if (!failureAnalysisSuccess) {

    console.log(
      "\n⚠️ Failure analysis failed."
    );
  }

  // --------------------------------
  // STEP 6 - JSON Report
  // --------------------------------

  console.log(
    "\nSTEP 6: Test Report Generation"
  );

  const reportSuccess =
    await runCommand(
      "npx ts-node agents/testReportAgent.ts"
    );

  if (!reportSuccess) {

    console.log(
      "\n⚠️ Test report generation failed."
    );
  }

  // --------------------------------
  // STEP 7 - HTML Report
  // --------------------------------

  console.log(
    "\nSTEP 7: HTML Report Generation"
  );

  const htmlSuccess =
    await runCommand(
      "npx ts-node agents/htmlReportAgent.ts"
    );

  if (!htmlSuccess) {

    console.log(
      "\n⚠️ HTML report generation failed."
    );
  }

  // --------------------------------
  // COMPLETE
  // --------------------------------

  console.log("\n");

  console.log(
    "================================="
  );

  console.log(
    "     AI QA PIPELINE COMPLETED"
  );

  console.log(
    "================================="
  );

  console.log(
    "\nGenerated artifacts:"
  );

  console.log(
    "✓ output/requirement-analysis.json"
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

  console.log("\n");
}

runQAPipeline();