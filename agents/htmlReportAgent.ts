import fs from "fs";
import path from "path";

interface TestScenario {
  id: string;
  title: string;
  type: string;
}

interface TestReport {
  overallStatus: string;

  summary: {
    totalScenarios: number;
    positiveScenarios: number;
    negativeScenarios: number;
    totalExecutions: number;
    passedTests: number;
    failedTests: number;
    duration: string;
  };

  failureAnalysis: {
    status: string;
    failureType: string;
    rootCause: string;
    evidence: string;
    affectedBrowsers: string | string[];
    recommendation: string;
  };
}

function generateHtmlReport() {

  console.log(
    "================================="
  );

  console.log(
    "HTML REPORT AGENT"
  );

  console.log(
    "================================="
  );

  const reportPath =
    path.join(
      process.cwd(),
      "output",
      "ai-test-report.json"
    );

  if (!fs.existsSync(reportPath)) {

    console.error(
      "❌ ai-test-report.json not found."
    );

    process.exit(1);
  }

  const report: TestReport =
    JSON.parse(
      fs.readFileSync(
        reportPath,
        "utf-8"
      )
    );

  /*
   * --------------------------------
   * READ REPORT DATA
   * --------------------------------
   */

  const overallStatus =
    report.overallStatus || "UNKNOWN";

  const summary =
    report.summary;

  const failureAnalysis =
    report.failureAnalysis;

  /*
   * --------------------------------
   * STATUS CLASS
   * --------------------------------
   */

  let statusClass =
    "unknown";

  if (overallStatus === "PASSED") {
    statusClass = "passed";
  }

  if (overallStatus === "FAILED") {
    statusClass = "failed";
  }

  /*
   * --------------------------------
   * BROWSER INFORMATION
   * --------------------------------
   *
   * Current testReportAgent produces
   * "None" as a string.
   *
   * Future versions may produce
   * an array.
   */

  let browserHtml =
    "";

  if (
    Array.isArray(
      failureAnalysis.affectedBrowsers
    )
  ) {

    browserHtml =
      failureAnalysis
        .affectedBrowsers
        .map(
          browser =>
            `<span class="browser">${browser}</span>`
        )
        .join("");

  } else {

    browserHtml = `
      <span class="browser">
        ${
          failureAnalysis.affectedBrowsers ||
          "None"
        }
      </span>
    `;
  }

  /*
   * --------------------------------
   * LOAD TEST SCENARIOS
   * --------------------------------
   *
   * ai-test-report.json does not
   * currently contain scenarios.
   *
   * We therefore load them directly
   * from test-scenarios.json.
   */

  const scenariosPath =
    path.join(
      process.cwd(),
      "output",
      "test-scenarios.json"
    );

  let scenarios: TestScenario[] =
    [];

  if (
    fs.existsSync(
      scenariosPath
    )
  ) {

    try {

      scenarios =
        JSON.parse(
          fs.readFileSync(
            scenariosPath,
            "utf-8"
          )
        );

    } catch (error) {

      console.log(
        "Warning: Unable to read test-scenarios.json."
      );
    }
  }

  /*
   * --------------------------------
   * SCENARIO TABLE
   * --------------------------------
   */

  const scenarioRows =
    scenarios.length > 0

      ? scenarios
          .map(
            scenario => `
              <tr>

                <td>
                  ${scenario.id}
                </td>

                <td>
                  ${scenario.title}
                </td>

                <td>
                  ${scenario.type}
                </td>

              </tr>
            `
          )
          .join("")

      : `
          <tr>

            <td colspan="3">
              No test scenarios available.
            </td>

          </tr>
        `;

  /*
   * --------------------------------
   * FAILURE / SUCCESS MESSAGE
   * --------------------------------
   */

  let analysisSection =
    "";

  if (
    overallStatus ===
    "PASSED"
  ) {

    analysisSection = `

      <div class="success-message">

        <h3>
          ✓ No Failures Detected
        </h3>

        <p>
          ${failureAnalysis.evidence}
        </p>

      </div>

    `;

  } else {

    analysisSection = `

      <div class="failure">

        <h3>
          ${failureAnalysis.failureType}
        </h3>

        <p>

          <strong>
            Root Cause:
          </strong>

          ${failureAnalysis.rootCause}

        </p>

        <p>

          <strong>
            Evidence:
          </strong>

          ${failureAnalysis.evidence}

        </p>

        <p>

          <strong>
            Affected Browsers:
          </strong>

        </p>

        ${browserHtml}

      </div>

    `;
  }

  /*
   * --------------------------------
   * HTML
   * --------------------------------
   */

  const html = `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>
AI Test Agent Report
</title>

<style>

body {

  font-family:
    Arial,
    sans-serif;

  margin: 0;

  background:
    #f4f6f8;

  color:
    #222;
}

.header {

  background:
    #1f2937;

  color:
    white;

  padding:
    30px;
}

.header h1 {

  margin:
    0;
}

.status {

  display:
    inline-block;

  padding:
    10px 20px;

  border-radius:
    20px;

  font-weight:
    bold;

  margin-top:
    10px;
}

.passed {

  background:
    #dcfce7;

  color:
    #166534;
}

.failed {

  background:
    #fee2e2;

  color:
    #b91c1c;
}

.unknown {

  background:
    #e5e7eb;

  color:
    #374151;
}

.container {

  padding:
    30px;

  max-width:
    1200px;

  margin:
    auto;
}

.cards {

  display:
    grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(
        180px,
        1fr
      )
    );

  gap:
    15px;

  margin-top:
    25px;
}

.card {

  background:
    white;

  padding:
    20px;

  border-radius:
    10px;

  box-shadow:
    0 2px 8px
    rgba(
      0,
      0,
      0,
      0.08
    );
}

.card h3 {

  margin-top:
    0;

  color:
    #6b7280;
}

.number {

  font-size:
    30px;

  font-weight:
    bold;
}

.section {

  background:
    white;

  padding:
    25px;

  margin-top:
    25px;

  border-radius:
    10px;

  box-shadow:
    0 2px 8px
    rgba(
      0,
      0,
      0,
      0.08
    );
}

table {

  width:
    100%;

  border-collapse:
    collapse;
}

th,
td {

  padding:
    12px;

  border-bottom:
    1px solid #ddd;

  text-align:
    left;
}

th {

  background:
    #f3f4f6;
}

.browser {

  display:
    inline-block;

  background:
    #e5e7eb;

  padding:
    6px 12px;

  border-radius:
    15px;

  margin-right:
    8px;
}

.failure {

  border-left:
    5px solid #dc2626;

  padding-left:
    20px;
}

.success-message {

  border-left:
    5px solid #16a34a;

  background:
    #f0fdf4;

  padding:
    20px;

  border-radius:
    8px;
}

.recommendation {

  background:
    #fff7ed;

  padding:
    15px;

  border-radius:
    8px;
}

.footer {

  text-align:
    center;

  color:
    #6b7280;

  margin-top:
    30px;

  padding-bottom:
    30px;
}

</style>

</head>

<body>

<div class="header">

  <h1>
    AI Test Agent
  </h1>

  <p>
    Automated QA Intelligence Report
  </p>

  <div class="status ${statusClass}">

    ${overallStatus}

  </div>

</div>


<div class="container">


  <!-- SUMMARY -->

  <div class="cards">


    <div class="card">

      <h3>
        Test Scenarios
      </h3>

      <div class="number">

        ${summary.totalScenarios}

      </div>

    </div>


    <div class="card">

      <h3>
        Positive
      </h3>

      <div class="number">

        ${summary.positiveScenarios}

      </div>

    </div>


    <div class="card">

      <h3>
        Negative
      </h3>

      <div class="number">

        ${summary.negativeScenarios}

      </div>

    </div>


    <div class="card">

      <h3>
        Executions
      </h3>

      <div class="number">

        ${summary.totalExecutions}

      </div>

    </div>


    <div class="card">

      <h3>
        Passed
      </h3>

      <div class="number">

        ${summary.passedTests}

      </div>

    </div>


    <div class="card">

      <h3>
        Failed
      </h3>

      <div class="number">

        ${summary.failedTests}

      </div>

    </div>


  </div>


  <!-- TEST SCENARIOS -->

  <div class="section">

    <h2>
      Generated Test Scenarios
    </h2>

    <table>

      <thead>

        <tr>

          <th>
            ID
          </th>

          <th>
            Scenario
          </th>

          <th>
            Type
          </th>

        </tr>

      </thead>

      <tbody>

        ${scenarioRows}

      </tbody>

    </table>

  </div>


  <!-- FAILURE ANALYSIS -->

  <div class="section">

    <h2>
      Failure Analysis
    </h2>

    ${analysisSection}

  </div>


  <!-- RECOMMENDATION -->

  <div class="section">

    <h2>
      Recommended Action
    </h2>

    <div class="recommendation">

      ${failureAnalysis.recommendation}

    </div>

  </div>


  <!-- EXECUTION -->

  <div class="section">

    <h2>
      Execution Summary
    </h2>

    <p>

      <strong>
        Status:
      </strong>

      ${overallStatus}

    </p>

    <p>

      <strong>
        Total Executions:
      </strong>

      ${summary.totalExecutions}

    </p>

    <p>

      <strong>
        Passed:
      </strong>

      ${summary.passedTests}

    </p>

    <p>

      <strong>
        Failed:
      </strong>

      ${summary.failedTests}

    </p>

    <p>

      <strong>
        Duration:
      </strong>

      ${summary.duration}

    </p>

  </div>


  <div class="footer">

    AI Test Agent •
    Automated QA Intelligence

  </div>


</div>

</body>

</html>
`;

  /*
   * --------------------------------
   * SAVE HTML
   * --------------------------------
   */

  const outputPath =
    path.join(
      process.cwd(),
      "output",
      "ai-test-report.html"
    );

  fs.writeFileSync(
    outputPath,
    html,
    "utf-8"
  );

  console.log(
    "\nHTML report generated successfully."
  );

  console.log(
    "Report location:"
  );

  console.log(
    outputPath
  );
}

generateHtmlReport();