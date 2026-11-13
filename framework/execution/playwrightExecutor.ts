import { spawnSync } from "node:child_process";

export function executeGeneratedTests(specPath: string, outputDir: string): number {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(executable, ["playwright", "test", specPath, "--reporter=line"], {
    cwd: process.cwd(),
    env: { ...process.env, QA_OUTPUT_DIR: outputDir },
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}