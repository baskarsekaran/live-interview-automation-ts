import fs from "node:fs";
import path from "node:path";
import type { ApplicationConfig, FrameworkOptions } from "./types";

function readArgument(name: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);

  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) {
    return args[index + 1];
  }

  const equalsArg = args.find((arg) => arg.startsWith(`${name}=`));
  return equalsesValue(equalsArg);
}

function equalsesValue(argument?: string): string | undefined {
  return argument?.slice(argument.indexOf("=") + 1);
}

export function resolveOptions(): FrameworkOptions {
  const root = process.cwd();
  const appId = readArgument("--app") ?? process.env.QA_APP ?? "saucedemo";
  const configPath =
    readArgument("--config") ??
    path.join(root, "config", "applications", `${appId}.json`);
  const requirementPath =
    readArgument("--requirement") ??
    path.join(root, "input", "requirements", `${appId}.txt`);
  const outputDir =
    readArgument("--output") ??
    path.join(root, "output", appId);

  if (!/^[a-z0-9][a-z0-9-]*$/i.test(appId)) {
    throw new Error("Invalid --app value. Use letters, numbers and hyphens.");
  }

  return { appId, configPath, requirementPath, outputDir };
}

export function loadApplicationConfig(configPath: string): ApplicationConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Application config not found: ${configPath}`);
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Application config must contain a JSON object.");
  }

  const config = parsed as Partial<ApplicationConfig>;
  if (
    !config.id ||
    !config.name ||
    !config.type ||
    !["web", "api", "hybrid"].includes(config.type) ||
    !config.baseUrl
  ) {
    throw new Error(
      "Invalid application config. Required: id, name, type (web|api|hybrid), baseUrl."
    );
  }

  try {
    new URL(config.baseUrl);
  } catch {
    throw new Error("application.baseUrl must be a valid absolute URL.");
  }

  return config as ApplicationConfig;
}
