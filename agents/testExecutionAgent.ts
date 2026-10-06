import { exec } from "child_process";
import fs from "fs";
import path from "path";

interface TestResult {
  title?: string;
  status?: string;
  duration?: number;
  error?: {
    message?: string;
    stack?: string;
  };
}

interface ExecutionResult {
  status: "PASSED" | "FAILED";
  total: number;
  passed: number;
  failed: number;
  duration: string;
  exitCode: number;
  output: string;
  failedTests: Array<{
    title: string;
    error: string;
  }>;
}

function runTests(): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    console.log("=================================");
    console.log("PLAYWRIGHT TEST EXECUTION AGENT");
    console.log("=================================");
    console.log("\nStarting Playwright execution...\n");

    const jsonReportPath = path.join(
      process.cwd(),
      "output",
      "playwright-report.json"
    );

    const outputDir = path.join(
      process.cwd(),
      "output"
    );

    fs.mkdirSync(outputDir, {
      recursive: true
    });

    // Remove old report
    if (fs.existsSync(jsonReportPath)) {
      fs.unlinkSync(jsonReportPath);
    }

    const command =
      `npx playwright test tests/generated/login.spec.ts ` +
      `--reporter=json > "${jsonReportPath}"`;

    exec(
      command,
      {
        maxBuffer: 10 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        const exitCode =
          typeof error?.code === "number"
            ? error.code
            : 0;

        const output =
          stdout +
          "\n" +
          stderr;

        let total = 0;
        let passed = 0;
        let failed = 0;
        let duration = "";

        const failedTests: Array<{
          title: string;
          error: string;
        }> = [];

        /*
         * Read Playwright JSON report
         */
        if (fs.existsSync(jsonReportPath)) {
          try {
            const reportText =
              fs.readFileSync(
                jsonReportPath,
                "utf-8"
              );

            const report =
              JSON.parse(reportText);

            /*
             * Playwright JSON reporter
             * contains suites -> specs -> tests
             */
            const tests: TestResult[] = [];

            function collectTests(
              suites: any[]
            ) {
              for (const suite of suites || []) {

                if (suite.specs) {
                  for (const spec of suite.specs) {

                    if (spec.tests) {
                      for (const test of spec.tests) {
                        tests.push({
                          title: spec.title,
                          status:
                            test.status,
                          duration:
                            test.results?.[0]?.duration,
                          error:
                            test.results?.[0]?.error
                        });
                      }
                    }
                  }
                }

                if (suite.suites) {
                  collectTests(
                    suite.suites
                  );
                }
              }
            }

            collectTests(
              report.suites || []
            );

            total = tests.length;

            for (const test of tests) {

              if (
                test.status ===
                  "expected" ||
                test.status ===
                  "passed"
              ) {
                passed++;
              } else {
                failed++;

                failedTests.push({
                  title:
                    test.title ||
                    "Unknown test",
                  error:
                    test.error?.message ||
                    "Unknown error"
                });
              }
            }

            /*
             * Calculate duration
             */
            const totalDuration =
              tests.reduce(
                (sum, test) =>
                  sum +
                  (test.duration || 0),
                0
              );

            if (totalDuration > 0) {
              duration =
                `${(
                  totalDuration / 1000
                ).toFixed(1)}s`;
            }

          } catch (parseError) {

            console.log(
              "Warning: Unable to parse Playwright JSON report."
            );

            console.log(
              parseError
            );
          }
        }

        /*
         * Fallback parser
         * in case JSON report is unavailable
         */
        if (total === 0) {

          const passedMatch =
            output.match(
              /(\d+)\s+passed/i
            );

          const failedMatch =
            output.match(
              /(\d+)\s+failed/i
            );

          if (passedMatch) {
            passed =
              Number(
                passedMatch[1]
              );
          }

          if (failedMatch) {
            failed =
              Number(
                failedMatch[1]
              );
          }

          total =
            passed + failed;
        }

        const status =
          failed > 0 ||
          exitCode !== 0
            ? "FAILED"
            : "PASSED";

        const executionResult:
          ExecutionResult = {
            status,
            total,
            passed,
            failed,
            duration,
            exitCode,
            output,
            failedTests
          };

        console.log("");

        if (status === "PASSED") {
          console.log(
            "✓ Playwright tests passed"
          );
        } else {
          console.log(
            "✗ Playwright tests failed"
          );
        }

        console.log("");

        console.log(
          "================================="
        );
        console.log(
          "EXECUTION RESULT"
        );
        console.log(
          "================================="
        );

        console.log(
          `Status: ${status}`
        );

        console.log(
          `Total Tests: ${total}`
        );

        console.log(
          `Passed: ${passed}`
        );

        console.log(
          `Failed: ${failed}`
        );

        console.log(
          `Duration: ${duration}`
        );

        if (failedTests.length > 0) {

          console.log("");

          console.log(
            "FAILED TESTS:"
          );

          for (
            const test
            of failedTests
          ) {

            console.log(
              `- ${test.title}`
            );

            console.log(
              `  ${test.error}`
            );
          }
        }

        console.log("");

        const executionResultPath =
          path.join(
            outputDir,
            "execution-result.json"
          );

        fs.writeFileSync(
          executionResultPath,
          JSON.stringify(
            executionResult,
            null,
            2
          ),
          "utf-8"
        );

        console.log(
          `Execution result saved to: ${executionResultPath}`
        );

        resolve(
          executionResult
        );
      }
    );
  });
}

async function runExecutionAgent() {

  try {

    await runTests();

  } catch (error) {

    console.error(
      "Execution Agent Error:",
      error
    );

    process.exit(1);
  }
}

runExecutionAgent();