import fs from "node:fs";
import path from "node:path";
import { loadApplicationConfig, resolveOptions } from "./core/config";
import { discoverWebApplication } from "./adapters/web/browserDiscovery";
import { analyzeRequirement } from "./ai/requirementAnalyzer";
import { generateScenarios } from "./ai/scenarioGenerator";

async function main(): Promise<void> {
  const options = resolveOptions();
  const config = loadApplicationConfig(options.configPath);

  if (!fs.existsSync(options.requirementPath)) {
    throw new Error(`Requirement file not found: ${options.requirementPath}`);
  }

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
    fs.writeFileSync(
      path.join(options.outputDir, "discovery.json"),
      JSON.stringify(discovery, null, 2),
      "utf8"
    );
    const page = discovery.pages[0];
    console.log(`Discovery evidence saved. Page: ${page?.title ?? "(no title)"}`);
    console.log(`Headings: ${page?.headings.length ?? 0}; links: ${page?.links.length ?? 0}; forms: ${page?.forms.length ?? 0}`);
  } else {
    console.log("\nAPI-only application selected. API discovery adapter is not implemented yet.");
  }

  console.log("\nSTEP 2: Gemini requirement analysis...");
  const analysis = await analyzeRequirement(requirement, config, discovery);
  fs.writeFileSync(
    path.join(options.outputDir, "requirement-analysis.json"),
    JSON.stringify(analysis, null, 2),
    "utf8"
  );
  console.log(`Requirement quality: ${analysis.quality}`);
  console.log(`Risk: ${analysis.riskLevel}`);
  console.log(`Required capabilities: ${analysis.capabilities.length}`);
  console.log(`Clarification questions: ${analysis.clarificationQuestions.length}`);
  console.log(`Evidence gaps: ${analysis.evidenceGaps.length}`);

  console.log("\nSTEP 3: Gemini test scenario generation...");
  const scenarios = await generateScenarios(requirement, config, analysis);
  fs.writeFileSync(
    path.join(options.outputDir, "test-scenarios.json"),
    JSON.stringify(scenarios, null, 2),
    "utf8"
  );
  console.log(`Scenarios generated: ${scenarios.length}`);

  const reviewRequired =
    analysis.quality !== "COMPLETE" ||
    analysis.clarificationQuestions.length > 0 ||
    analysis.evidenceGaps.length > 0;

  const gate = {
    status: reviewRequired ? "NEEDS_REVIEW" : "READY_FOR_TEST_DESIGN",
    reason: reviewRequired
      ? "Requirement clarification or application evidence review is required before automated test generation/execution."
      : "Requirement analysis and discovery did not identify blocking clarification or evidence gaps.",
    clarificationQuestions: analysis.clarificationQuestions,
    evidenceGaps: analysis.evidenceGaps,
    generatedScenarioCount: scenarios.length,
    executionStatus: "NOT_RUN"
  };
  fs.writeFileSync(
    path.join(options.outputDir, "automation-gate.json"),
    JSON.stringify(gate, null, 2),
    "utf8"
  );

  console.log("\nSTEP 4: Automation readiness gate");
  console.log(`Status: ${gate.status}`);
  if (gate.clarificationQuestions.length) {
    console.log("\nClarification questions:");
    gate.clarificationQuestions.forEach((question, index) =>
      console.log(`${index + 1}. ${question}`)
    );
  }
  if (gate.evidenceGaps.length) {
    console.log("\nApplication evidence gaps:");
    gate.evidenceGaps.forEach((gap) => console.log(`- ${gap}`));
  }

  console.log("\nArtifacts:");
  console.log("- discovery.json (web/hybrid)");
  console.log("- requirement-analysis.json");
  console.log("- test-scenarios.json");
  console.log("- automation-gate.json");
  console.log("\nThis milestone generates AI analysis and scenarios. Playwright test-code generation and execution are intentionally gated for the next milestone.");
}

main().catch((error: unknown) => {
  console.error("\nGENERIC AI QA FRAMEWORK FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
