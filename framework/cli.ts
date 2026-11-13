import fs from "node:fs";
import path from "node:path";
import { loadApplicationConfig, resolveOptions } from "./core/config";
import { discoverWebApplication } from "./adapters/web/browserDiscovery";
import { analyzeRequirement } from "./ai/requirementAnalyzer";
import { generateScenarios } from "./ai/scenarioGenerator";
import { generateTestPlans } from "./ai/testPlanGenerator";
import { buildGeneratedSpec } from "./execution/specTemplate";
import { executeGeneratedTests } from "./execution/playwrightExecutor";

async function main(): Promise<void> {
  const options = resolveOptions();
  const config = loadApplicationConfig(options.configPath);
  const executeRequested = process.argv.includes("--execute");

  if (!fs.existsSync(options.requirementPath)) throw new Error(`Requirement file not found: ${options.requirementPath}`);
  const requirement = fs.readFileSync(options.requirementPath, "utf8").trim();
  if (!requirement) throw new Error("Requirement file is empty.");
  fs.mkdirSync(options.outputDir, { recursive: true });

  console.log("\nGENERIC AI QA FRAMEWORK");
  console.log("=======================");
  console.log(`Application: ${config.name} (${config.type})`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Requirement: ${options.requirementPath}`);
  console.log(`Output: ${options.outputDir}`);

  let discovery;
  if (config.type === "web" || config.type === "hybrid") {
    console.log("\nSTEP 1: Discovering application...");
    discovery = await discoverWebApplication(config);
    fs.writeFileSync(path.join(options.outputDir, "discovery.json"), JSON.stringify(discovery, null, 2), "utf8");
    const page = discovery.pages[0];
    console.log(`Discovery evidence saved. Page: ${page?.title ?? "(no title)"}`);
    console.log(`Headings: ${page?.headings.length ?? 0}; links: ${page?.links.length ?? 0}; forms: ${page?.forms.length ?? 0}; interactive elements: ${page?.elements.length ?? 0}`);
  } else {
    throw new Error("API-only execution is not supported by this web test-plan milestone. API adapter is a separate milestone.");
  }

  console.log("\nSTEP 2: Gemini requirement analysis...");
  const analysis = await analyzeRequirement(requirement, config, discovery);
  fs.writeFileSync(path.join(options.outputDir, "requirement-analysis.json"), JSON.stringify(analysis, null, 2), "utf8");
  console.log(`Requirement quality: ${analysis.quality}`);
  console.log(`Risk: ${analysis.riskLevel}`);
  console.log(`Required capabilities: ${analysis.capabilities.length}`);
  console.log(`Clarification questions: ${analysis.clarificationQuestions.length}`);
  console.log(`Evidence gaps: ${analysis.evidenceGaps.length}`);

  console.log("\nSTEP 3: Gemini test scenario generation...");
  const scenarios = await generateScenarios(requirement, config, analysis);
  fs.writeFileSync(path.join(options.outputDir, "test-scenarios.json"), JSON.stringify(scenarios, null, 2), "utf8");
  console.log(`Scenarios generated: ${scenarios.length}`);

  console.log("\nSTEP 4: Evidence-based Playwright test planning...");
  const plans = await generateTestPlans(config, scenarios, discovery);
  fs.writeFileSync(path.join(options.outputDir, "test-plans.json"), JSON.stringify(plans, null, 2), "utf8");
  fs.writeFileSync(path.join(options.outputDir, "application.json"), JSON.stringify(config, null, 2), "utf8");
  const readyCount = plans.filter(plan => plan.status === "READY").length;
  const blockedCount = plans.length - readyCount;
  console.log(`Executable plans: ${readyCount}; blocked plans: ${blockedCount}`);

  const specPath = path.join(options.outputDir, "generated-tests.spec.ts");
  fs.writeFileSync(specPath, buildGeneratedSpec(), "utf8");
  console.log("Generated Playwright spec: generated-tests.spec.ts");

  const reviewRequired = analysis.quality !== "COMPLETE" ||
    analysis.clarificationQuestions.length > 0 || analysis.evidenceGaps.length > 0;
  const gate = {
    status: reviewRequired ? "NEEDS_REVIEW" : "READY_FOR_TEST_EXECUTION",
    reason: reviewRequired
      ? "Requirement clarification or application evidence review remains necessary. Only individually READY plans can be executed."
      : "Requirement and application evidence checks passed.",
    clarificationQuestions: analysis.clarificationQuestions,
    evidenceGaps: analysis.evidenceGaps,
    generatedScenarioCount: scenarios.length,
    readyPlanCount: readyCount,
    blockedPlanCount: blockedCount,
    executionRequested: executeRequested,
    executionStatus: executeRequested ? "PENDING" : "NOT_RUN",
    executionExitCode: null as number | null
  };
  fs.writeFileSync(path.join(options.outputDir, "automation-gate.json"), JSON.stringify(gate, null, 2), "utf8");

  console.log("\nSTEP 5: Automation readiness gate");
  console.log(`Status: ${gate.status}`);
  if (gate.clarificationQuestions.length) {
    console.log("\nClarification questions:");
    gate.clarificationQuestions.forEach((question, index) => console.log(`${index + 1}. ${question}`));
  }
  if (gate.evidenceGaps.length) {
    console.log("\nApplication evidence gaps:");
    gate.evidenceGaps.forEach(gap => console.log(`- ${gap}`));
  }

  if (executeRequested) {
    if (readyCount === 0) {
      gate.executionStatus = "SKIPPED_NO_READY_TESTS";
      console.log("\nExecution skipped: no scenario passed evidence validation.");
    } else {
      console.log("\nSTEP 6: Executing evidence-approved Playwright tests...");
      const exitCode = executeGeneratedTests(specPath, options.outputDir);
      gate.executionStatus = exitCode === 0 ? "COMPLETED" : "FAILED";
      gate.executionExitCode = exitCode;
    }
    fs.writeFileSync(path.join(options.outputDir, "automation-gate.json"), JSON.stringify(gate, null, 2), "utf8");
  }

  console.log("\nArtifacts:");
  console.log("- discovery.json");
  console.log("- requirement-analysis.json");
  console.log("- test-scenarios.json");
  console.log("- test-plans.json");
  console.log("- generated-tests.spec.ts");
  console.log("- automation-gate.json");
  console.log(executeRequested ? "- Playwright execution report (if tests ran)" : "Use --execute to run only READY test plans.");
  if (executeRequested && gate.executionStatus === "FAILED") process.exitCode = Number(gate.executionExitCode) || 1;
}

main().catch((error: unknown) => {
  console.error("\nGENERIC AI QA FRAMEWORK FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
