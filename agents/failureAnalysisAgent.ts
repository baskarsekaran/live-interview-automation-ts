import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.5-flash-lite";

if (!GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is not configured in .env"
  );
}

interface FailedTest {
  title: string;
  project?: string;
  error: string;
  stack?: string;
  duration?: number;
}

interface ExecutionResult {
  status: string;
  total: number;
  passed: number;
  failed: number;
  duration: string;
  exitCode: number;
  output?: string;
  failedTests?: FailedTest[];
}

interface FailureAnalysis {
  status: string;
  failureType: string;
  rootCause: string;
  evidence: string;
  affectedBrowsers: string;
  recommendation: string;
}

const executionPath = path.join(
  process.cwd(),
  "output",
  "execution-result.json"
);

const outputPath = path.join(
  process.cwd(),
  "output",
  "failure-analysis.json"
);

async function main() {

  console.log("");
  console.log("=================================");
  console.log("GEMINI FAILURE ANALYSIS AGENT");
  console.log("=================================");
  console.log("");

  if (!fs.existsSync(executionPath)) {
    throw new Error(
      `Execution result not found: ${executionPath}`
    );
  }

  const executionResult: ExecutionResult =
    JSON.parse(
      fs.readFileSync(
        executionPath,
        "utf-8"
      )
    );

  console.log(
    `Execution Status: ${executionResult.status}`
  );

  console.log(
    `Total: ${executionResult.total}`
  );

  console.log(
    `Passed: ${executionResult.passed}`
  );

  console.log(
    `Failed: ${executionResult.failed}`
  );

  console.log("");

  /*
   * No failures
   *
   * There is no reason to call Gemini when
   * Playwright has confirmed that all tests passed.
   */

  if (executionResult.failed === 0) {

    const analysis: FailureAnalysis = {
      status: "NO_FAILURE",

      failureType: "None",

      rootCause:
        "No test failures detected.",

      evidence:
        `${executionResult.total} tests passed successfully.`,

      affectedBrowsers:
        "None",

      recommendation:
        "No corrective action required."
    };

    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        analysis,
        null,
        2
      ),
      "utf-8"
    );

    console.log(
      "No failures detected. Gemini analysis not required."
    );

    console.log("");

    console.log(
      `Output: ${outputPath}`
    );

    console.log("");

    console.log(
      "Gemini Failure Analysis Agent completed successfully."
    );

    return;
  }

  const failedTests =
    executionResult.failedTests || [];

  /*
   * Build a compact failure evidence object.
   *
   * This prevents Gemini from having to infer
   * important information from unrelated output.
   */

  const failureEvidence =
    failedTests.map(
      (test) => ({
        test: test.title,

        browser:
          test.project ||
          "Not available",

        error:
          test.error,

        stack:
          test.stack ||
          "Not available",

        duration:
          test.duration !== undefined
            ? `${test.duration}ms`
            : "Not available"
      })
    );

  const prompt = `
You are a Senior SDET and Test Automation Failure Analysis Expert.

Analyze the Playwright execution failures provided below.

Your responsibility is to determine the MOST LIKELY failure category and root cause based ONLY on the evidence provided.

IMPORTANT RULES:

1. Analyze only the supplied execution data.
2. Do not invent application behavior.
3. Do not invent browser information.
4. If browser/project information is unavailable, say "Unknown".
5. Do not automatically classify every timeout as an application defect.
6. Consider:
   - Application defects
   - Automation defects
   - Environment problems
   - Browser-specific problems
   - Timing/synchronization problems
   - Locator problems
   - Test-data problems
   - Network problems
7. Use the actual error message as primary evidence.
8. Use the stack trace when useful.
9. Look for patterns across multiple failed tests.
10. If the same failure occurs across multiple tests, mention that pattern.
11. If failures are limited to one browser, identify that browser.
12. If failures occur across browsers, state that clearly.
13. Do not claim certainty when the evidence only supports a likely cause.
14. Provide a practical next investigation or corrective action.
15. Return ONLY valid JSON.
16. Do not use markdown.
17. Do not include explanations outside the JSON.

EXECUTION SUMMARY:

${JSON.stringify(
  {
    status: executionResult.status,
    total: executionResult.total,
    passed: executionResult.passed,
    failed: executionResult.failed,
    duration: executionResult.duration,
    exitCode: executionResult.exitCode
  },
  null,
  2
)}

FAILED TEST EVIDENCE:

${JSON.stringify(
  failureEvidence,
  null,
  2
)}

Return exactly this JSON structure:

{
  "status": "FAILURE_ANALYZED",
  "failureType": "Application | Automation | Environment | Browser | Data | Timing | Unknown",
  "rootCause": "Most likely root cause based on the supplied evidence",
  "evidence": "Specific evidence from the failed tests supporting the conclusion",
  "affectedBrowsers": "Affected browsers or Unknown",
  "recommendation": "Practical next investigation or corrective action"
}
`;

  console.log(
    "Sending failure information to Gemini..."
  );

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(
    endpoint,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],

        generationConfig: {
          temperature: 0,

          responseMimeType:
            "application/json"
        }
      })
    }
  );

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Gemini API request failed: ${response.status} ${errorText}`
    );
  }

  const data =
    await response.json();

  const generatedText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  console.log(
    "Gemini failure analysis received."
  );

  let analysis: FailureAnalysis;

  try {

    analysis =
      JSON.parse(
        generatedText
      );

  } catch (error) {

    console.error(
      "Gemini response was not valid JSON:"
    );

    console.error(
      generatedText
    );

    throw new Error(
      "Failed to parse Gemini failure analysis response."
    );
  }

  /*
   * Validate Gemini response
   */

  if (
    !analysis.status ||
    !analysis.failureType ||
    !analysis.rootCause ||
    !analysis.evidence ||
    !analysis.affectedBrowsers ||
    !analysis.recommendation
  ) {
    throw new Error(
      "Invalid Gemini failure analysis structure."
    );
  }

  if (
    analysis.status !==
    "FAILURE_ANALYZED"
  ) {
    throw new Error(
      `Unexpected failure analysis status: ${analysis.status}`
    );
  }

  const allowedFailureTypes = [
    "Application",
    "Automation",
    "Environment",
    "Browser",
    "Data",
    "Timing",
    "Unknown"
  ];

  if (
    !allowedFailureTypes.includes(
      analysis.failureType
    )
  ) {
    throw new Error(
      `Invalid failure type returned by Gemini: ${analysis.failureType}`
    );
  }

  /*
   * Save analysis
   */

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      analysis,
      null,
      2
    ),
    "utf-8"
  );

  /*
   * Display analysis
   */

  console.log("");

  console.log(
    "================================="
  );

  console.log(
    "GEMINI FAILURE ANALYSIS"
  );

  console.log(
    "================================="
  );

  console.log("");

  console.log(
    `Status: ${analysis.status}`
  );

  console.log(
    `Failure Type: ${analysis.failureType}`
  );

  console.log(
    `Root Cause: ${analysis.rootCause}`
  );

  console.log(
    `Evidence: ${analysis.evidence}`
  );

  console.log(
    `Affected Browsers: ${analysis.affectedBrowsers}`
  );

  console.log(
    `Recommendation: ${analysis.recommendation}`
  );

  console.log("");

  console.log(
    `Output: ${outputPath}`
  );

  console.log("");

  console.log(
    "Gemini Failure Analysis Agent completed successfully."
  );
}

main().catch(
  (error) => {

    console.error("");

    console.error(
      "Gemini Failure Analysis Agent failed."
    );

    console.error(error);

    process.exit(1);
  }
);