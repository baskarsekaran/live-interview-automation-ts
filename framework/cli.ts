import fs from "node:fs";
import path from "node:path";
import { loadApplicationConfig, resolveOptions } from "./core/config";
import { discoverWebApplication } from "./adapters/web/browserDiscovery";

async function main(): Promise<void> {
  const options = resolveOptions();
  const config = loadApplicationConfig(options.configPath);

  if (!fs.existsSync(options.requirementPath)) {
    throw new Error(`Requirement file not found: ${options.requirementPath}`);
  }

  const requirement = fs.readFileSync(options.requirementPath, "utf8").trim();
  if (!requirement) {
    throw new Error("Requirement file is empty.");
  }

  fs.mkdirSync(options.outputDir, { recursive: true });

  console.log("\nGENERIC AI QA FRAMEWORK");
  console.log("=======================");
  console.log(`Application: ${config.name} (${config.type})`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Requirement: ${options.requirementPath}`);
  console.log(`Output: ${options.outputDir}`);

  if (config.type === "web" || config.type === "hybrid") {
    console.log("\nDiscovering web application...");
    const discovery = await discoverWebApplication(config);
    const outputPath = path.join(options.outputDir, "discovery.json");
    fs.writeFileSync(outputPath, JSON.stringify(discovery, null, 2), "utf8");
    console.log(`Discovery evidence saved: ${outputPath}`);
    console.log(`Inspected page title: ${discovery.pages[0]?.title ?? "(no title)"}`);
    console.log(`Headings found: ${discovery.pages[0]?.headings.length ?? 0}`);
    console.log(`Links found: ${discovery.pages[0]?.links.length ?? 0}`);
    console.log(`Forms found: ${discovery.pages[0]?.forms.length ?? 0}`);
  } else {
    console.log("\nAPI adapter is the next implementation milestone; no API calls were sent.");
  }

  console.log("\nBootstrap completed. This milestone validates configuration, requirement loading and web discovery.");
  console.log("AI analysis, scenario generation, test generation and execution are not wired into this new entry point yet.");
}

main().catch((error: unknown) => {
  console.error("\nFramework failed:", error);
  process.exitCode = 1;
});
