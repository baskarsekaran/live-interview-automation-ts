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
  projectName?: string;
}

interface FailedTest {
  title: string;
  project?: string;
  error: string;
  stack?: string;
  duration?: number;
}

interface ExecutionResult {
  status: "PASSED" | "FAILED";
  total: number;
  passed: number;
  failed: number;
  duration: string;
  exitCode: number;
  output: string;
  failedTests: FailedTest[];
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
        maxBuffer: 20 * 1024 * 1024
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

        const failedTests: FailedTest[] = [];

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

            const tests: TestResult[] = [];

            /*
             * Recursively collect Playwright tests
             */
            function collectTests(
              suites: any[]
            ) {
              for (const suite of suites || []) {

                if (suite.specs) {
                  for (const spec of suite.specs) {

                    if (spec.tests) {
                      for (const test of spec.tests) {

                        const result =
                          test.results?.[0];

                        tests.push({
                          title:
                            spec.title,

                          status:
                            test.status,

                          duration:
                            result?.duration,

                          error:
                            result?.error,

                          projectName:
                            test.projectName ||
                            test.project?.name ||
                            result?.workerIndex !== undefined
                              ? test.projectName
                              : undefined
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

            /*
             * Count passed and failed tests
             */
            for (const test of tests) {

              if (
                test.status === "expected" ||
                test.status === "passed"
              ) {
                passed++;
              } else {

                failed++;

                failedTests.push({
                  title:
                    test.title ||
                    "Unknown test",

                  project:
                    test.projectName,

                  error:
                    test.error?.message ||
                    "Unknown error",

                  stack:
                    test.error?.stack,

                  duration:
                    test.duration
                });
              }
            }

            /*
             * Calculate total execution duration
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
         * if JSON report is unavailable
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

        /*
         * Determine final execution status
         */
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

        /*
         * Console result
         */
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

        /*
         * Print detailed failure information
         */
        if (failedTests.length > 0) {

          console.log("");

          console.log(
            "FAILED TEST DETAILS:"
          );

          for (
            const test
            of failedTests
          ) {

            console.log("");

            console.log(
              `Test: ${test.title}`
            );

            if (test.project) {
              console.log(
                `Project: ${test.project}`
              );
            }

            if (
              test.duration !== undefined
            ) {
              console.log(
                `Duration: ${test.duration}ms`
              );
            }

            console.log(
              `Error: ${test.error}`
            );

            if (test.stack) {
              console.log(
                "Stack:"
              );

              console.log(
                test.stack
              );
            }
          }
        }

        console.log("");

        /*
         * Save execution result
         */
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