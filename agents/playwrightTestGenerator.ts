import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const ROOT = process.cwd();

const scenarioFile = path.join(
  ROOT,
  "output",
  "test-scenarios.json"
);

const requirementFile = path.join(
  ROOT,
  "input",
  "requirement.txt"
);

const configFile = path.join(
  ROOT,
  "config",
  "application.json"
);

const outputFile = path.join(
  ROOT,
  "tests",
  "generated",
  "login.spec.ts"
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.5-flash-lite";

function readTextFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf-8");
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readTextFile(filePath));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeCodeFences(code: string): string {
  let cleaned = code.trim();

  cleaned = cleaned.replace(
    /^```(?:typescript|ts)?\s*/i,
    ""
  );

  cleaned = cleaned.replace(
    /\s*```$/i,
    ""
  );

  return cleaned.trim();
}

async function callGemini(
  prompt: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing. Please configure it in .env"
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody = {
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
      responseMimeType: "text/plain"
    }
  };

  const maxAttempts = 3;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    console.log(
      `Gemini API attempt ${attempt}/${maxAttempts}...`
    );

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (
          (response.status === 429 ||
            response.status === 503) &&
          attempt < maxAttempts
        ) {
          console.log(
            `Gemini returned ${response.status}. Retrying...`
          );

          await sleep(attempt * 5000);
          continue;
        }

        throw new Error(
          `Gemini API failed with status ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      const generatedText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error(
          "Gemini response did not contain generated text."
        );
      }

      return generatedText;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.log(
        "Gemini request failed. Retrying..."
      );

      await sleep(attempt * 5000);
    }
  }

  throw new Error(
    "Gemini generation failed."
  );
}

function validateScenarios(
  scenarios: any[]
): void {
  if (!Array.isArray(scenarios)) {
    throw new Error(
      "Invalid test-scenarios.json format. Expected an array."
    );
  }

  if (scenarios.length !== 9) {
    throw new Error(
      `Expected exactly 9 scenarios but found ${scenarios.length}.`
    );
  }

  const expectedIds = [
    "TC001",
    "TC002",
    "TC003",
    "TC004",
    "TC005",
    "TC006",
    "TC007",
    "TC008",
    "TC009"
  ];

  const actualIds = scenarios.map(
    (scenario) => scenario.id
  );

  for (const id of expectedIds) {
    if (!actualIds.includes(id)) {
      throw new Error(
        `Missing required scenario ID: ${id}`
      );
    }
  }

  console.log(
    "Scenario validation: PASSED"
  );
}

function normalizeConfiguredLocators(
  code: string,
  config: any
): string {
  let normalized = code;

  const usernameLocator =
    config.locators.username;

  const passwordLocator =
    config.locators.password;

  const loginButtonLocator =
    config.locators.loginButton;

  const errorMessageLocator =
    config.locators.errorMessage;

  const productsTitleLocator =
    config.locators.productsTitle;

  /*
   * Username locator
   */
  normalized = normalized.replace(
    /page\.getByTestId\(\s*['"]username['"]\s*\)/g,
    `page.locator('${usernameLocator}')`
  );

  normalized = normalized.replace(
    /page\.getByLabel\(\s*['"]username['"]\s*\)/g,
    `page.locator('${usernameLocator}')`
  );

  /*
   * Password locator
   */
  normalized = normalized.replace(
    /page\.getByTestId\(\s*['"]password['"]\s*\)/g,
    `page.locator('${passwordLocator}')`
  );

  normalized = normalized.replace(
    /page\.getByLabel\(\s*['"]password['"]\s*\)/g,
    `page.locator('${passwordLocator}')`
  );

  /*
   * Login button
   */
  normalized = normalized.replace(
    /page\.getByTestId\(\s*['"]login-button['"]\s*\)/g,
    `page.locator('${loginButtonLocator}')`
  );

  normalized = normalized.replace(
    /page\.getByRole\(\s*['"]button['"]\s*,\s*\{\s*name:\s*['"]Login['"]\s*\}\s*\)/g,
    `page.locator('${loginButtonLocator}')`
  );

  /*
   * Error message
   */
  normalized = normalized.replace(
    /page\.getByTestId\(\s*['"]error['"]\s*\)/g,
    `page.locator('${errorMessageLocator}')`
  );

  /*
   * Products title
   */
  normalized = normalized.replace(
    /page\.getByTestId\(\s*['"]title['"]\s*\)/g,
    `page.locator('${productsTitleLocator}')`
  );

  return normalized;
}

/*
 * Makes invalid credential validation deterministic.
 *
 * Gemini may know that SauceDemo displays:
 *
 * "Epic sadface: Username and password do not match any user in this service"
 *
 * But our application configuration intentionally stores only:
 *
 * "Username and password do not match any user in this service"
 *
 * Therefore the generated test must use toContainText()
 * rather than toHaveText().
 */
function normalizeInvalidCredentialAssertions(
  code: string,
  config: any
): string {
  let normalized = code;

  const errorLocator =
    config.locators.errorMessage;

  const expectedMessage =
    config.expected.invalidCredentialsMessage;

  /*
   * Replace exact toHaveText assertions that Gemini
   * generated for the configured error locator.
   */
  const escapedLocator =
    errorLocator.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const escapedMessage =
    expectedMessage.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const haveTextPattern = new RegExp(
    `page\\.locator\\('${escapedLocator}'\\)\\)\\.toHaveText\\(\\s*['"][^'"]*${escapedMessage}[^'"]*['"]\\s*\\)`,
    "g"
  );

  normalized = normalized.replace(
    haveTextPattern,
    `page.locator('${errorLocator}')).toContainText('${expectedMessage}')`
  );

  /*
   * Handle the common Gemini format:
   *
   * await expect(
   *   page.locator('...')
   * ).toHaveText('...');
   */
  const multilinePattern = new RegExp(
    `await\\s+expect\\(\\s*page\\.locator\\('${escapedLocator}'\\)\\s*\\)\\s*\\.toHaveText\\(\\s*['"][^'"]*${escapedMessage}[^'"]*['"]\\s*\\)`,
    "g"
  );

  normalized = normalized.replace(
    multilinePattern,
    `await expect(
  page.locator('${errorLocator}')
).toContainText('${expectedMessage}')`
  );

  return normalized;
}

function validateMandatoryFieldAssertions(
  generatedCode: string
): void {
  /*
   * TC005, TC006 and TC007 only require
   * the error element to be visible.
   *
   * The requirement does not define an exact
   * mandatory-field error message.
   *
   * Therefore the generated automation must
   * NOT invent or assert a mandatory-field
   * message.
   */
  const mandatoryTests = [
    "TC005",
    "TC006",
    "TC007"
  ];

  for (const testId of mandatoryTests) {
    const testStart =
      generatedCode.indexOf(
        `test('${testId}`
      );

    if (testStart === -1) {
      throw new Error(
        `${testId} test was not found while validating mandatory-field assertions.`
      );
    }

    const nextTest =
      generatedCode.indexOf(
        "test('",
        testStart + 10
      );

    const testBlock =
      nextTest === -1
        ? generatedCode.substring(testStart)
        : generatedCode.substring(
            testStart,
            nextTest
          );

    if (
      !testBlock.includes(
        "toBeVisible()"
      ) &&
      !testBlock.includes(
        "toBeVisible("
      )
    ) {
      throw new Error(
        `${testId} must validate that the error message is visible.`
      );
    }

    /*
     * Prevent hard-coded SauceDemo mandatory
     * messages from being introduced by Gemini.
     */
    const forbiddenMessages = [
      "Epic sadface: Username is required",
      "Epic sadface: Password is required"
    ];

    for (
      const message of forbiddenMessages
    ) {
      if (
        testBlock.includes(message)
      ) {
        throw new Error(
          `${testId} contains an invented mandatory-field error message: ${message}`
        );
      }
    }
  }

  console.log(
    "Mandatory-field assertion validation: PASSED"
  );
}

function validateInvalidCredentialAssertions(
  generatedCode: string,
  config: any
): void {
  const invalidCredentialTests = [
    "TC002",
    "TC003",
    "TC004",
    "TC008",
    "TC009"
  ];

  const expectedMessage =
    config.expected.invalidCredentialsMessage;

  for (
    const testId of invalidCredentialTests
  ) {
    const testStart =
      generatedCode.indexOf(
        `test('${testId}`
      );

    if (testStart === -1) {
      throw new Error(
        `${testId} test was not found while validating invalid credential assertions.`
      );
    }

    const nextTest =
      generatedCode.indexOf(
        "test('",
        testStart + 10
      );

    const testBlock =
      nextTest === -1
        ? generatedCode.substring(testStart)
        : generatedCode.substring(
            testStart,
            nextTest
          );

    if (
      !testBlock.includes(
        "toContainText"
      )
    ) {
      throw new Error(
        `${testId} must use toContainText() for invalid credential validation.`
      );
    }

    if (
      !testBlock.includes(
        expectedMessage
      )
    ) {
      throw new Error(
        `${testId} is missing configured invalid credentials message.`
      );
    }

    if (
      testBlock.includes(
        "toHaveText"
      )
    ) {
      throw new Error(
        `${testId} must not use toHaveText() for invalid credential validation.`
      );
    }
  }

  console.log(
    "Invalid credential assertion validation: PASSED"
  );
}

function validateGeneratedCode(
  generatedCode: string,
  config: any
): void {
  console.log(
    "Validating generated Playwright code..."
  );

  console.log(
    "Checking Playwright import..."
  );

  if (
    !generatedCode.includes(
      "import { test, expect } from '@playwright/test';"
    )
  ) {
    throw new Error(
      "Generated code is missing Playwright import."
    );
  }

  console.log(
    "Checking waitForTimeout usage..."
  );

  if (
    generatedCode.includes(
      "waitForTimeout"
    )
  ) {
    throw new Error(
      "Generated code contains waitForTimeout. Explicit sleeps are not allowed."
    );
  }

  console.log(
    "Checking beforeEach..."
  );

  if (
    !generatedCode.includes(
      "test.beforeEach"
    )
  ) {
    throw new Error(
      "Generated code is missing test.beforeEach."
    );
  }

  console.log(
    "Checking page readiness synchronization..."
  );

  if (
    !generatedCode.includes(
      "domcontentloaded"
    )
  ) {
    throw new Error(
      "Generated code is missing domcontentloaded navigation synchronization."
    );
  }

  console.log(
    "Checking login page readiness..."
  );

  if (
    !generatedCode.includes(
      "toBeVisible"
    )
  ) {
    throw new Error(
      "Generated code is missing login page readiness validation."
    );
  }

  console.log(
    "Checking generated test count..."
  );

  const testMatches =
    generatedCode.match(
      /\btest\(/g
    );

  const generatedTestCount =
    testMatches
      ? testMatches.length
      : 0;

  console.log(
    `Generated Playwright tests: ${generatedTestCount}`
  );

  if (
    generatedTestCount !== 9
  ) {
    throw new Error(
      `Expected 9 generated tests but found ${generatedTestCount}.`
    );
  }

  console.log(
    "Checking scenario IDs..."
  );

  for (
    let i = 1;
    i <= 9;
    i++
  ) {
    const id =
      `TC${String(i).padStart(3, "0")}`;

    if (
      !generatedCode.includes(id)
    ) {
      throw new Error(
        `Generated code is missing scenario ID: ${id}`
      );
    }
  }

  console.log(
    "Checking configured locators..."
  );

  const requiredLocators = [
    config.locators.username,
    config.locators.password,
    config.locators.loginButton,
    config.locators.errorMessage,
    config.locators.productsTitle
  ];

  for (
    const locator of requiredLocators
  ) {
    if (
      !generatedCode.includes(locator)
    ) {
      throw new Error(
        `Generated code is missing configured locator: ${locator}`
      );
    }
  }

  console.log(
    "Checking successful login URL..."
  );

  if (
    !generatedCode.includes(
      config.expected.successUrl
    )
  ) {
    throw new Error(
      "Generated code is missing configured successful login URL."
    );
  }

  console.log(
    "Successful login URL validation: PASSED"
  );

  console.log(
    "Checking products title..."
  );

  if (
    !generatedCode.includes(
      config.expected.productsTitle
    )
  ) {
    throw new Error(
      "Generated code is missing configured products title."
    );
  }

  console.log(
    "Products title validation: PASSED"
  );

  console.log(
    "Checking invalid credentials message..."
  );

  if (
    !generatedCode.includes(
      config.expected.invalidCredentialsMessage
    )
  ) {
    throw new Error(
      "Generated code is missing configured invalid credentials message."
    );
  }

  console.log(
    "Invalid credentials validation: PASSED"
  );

  validateInvalidCredentialAssertions(
    generatedCode,
    config
  );

  validateMandatoryFieldAssertions(
    generatedCode
  );

  console.log(
    "Generated Playwright code validation: PASSED"
  );
}

async function main(): Promise<void> {
  console.log(
    "=========================================="
  );

  console.log(
    "Playwright Test Generator"
  );

  console.log(
    "=========================================="
  );

  const scenarios =
    readJsonFile<any[]>(
      scenarioFile
    );

  const requirement =
    readTextFile(
      requirementFile
    );

  const config =
    readJsonFile<any>(
      configFile
    );

  console.log(
    `Loaded scenarios: ${scenarios.length}`
  );

  validateScenarios(
    scenarios
  );

  const prompt = `
You are an expert Senior SDET and Playwright TypeScript automation engineer.

Generate ONLY the complete contents of a Playwright TypeScript test file.

Do not provide explanations.
Do not use Markdown code fences.

APPLICATION CONFIGURATION:

${JSON.stringify(
  config,
  null,
  2
)}

REQUIREMENT:

${requirement}

TEST SCENARIOS:

${JSON.stringify(
  scenarios,
  null,
  2
)}

==================================================
MANDATORY GENERATION RULES
==================================================

Generate exactly 9 Playwright tests.

Required IDs:

TC001
TC002
TC003
TC004
TC005
TC006
TC007
TC008
TC009

Use:

import { test, expect } from '@playwright/test';

Use test.beforeEach.

Navigation must use:

await page.goto(
  '${config.application.baseUrl}',
  {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  }
);

After navigation verify the username field:

await expect(
  page.locator('${config.locators.username}')
).toBeVisible({
  timeout: 15000
});

Do not use waitForTimeout.

Do not use fixed sleeps.

Do not use arbitrary delays.

Do not use force:true.

Do not use network mocking.

Do not use API mocking.

Do not use retry loops.

==================================================
EXACT LOCATORS
==================================================

Use page.locator() with these exact values.

Username:

${config.locators.username}

Password:

${config.locators.password}

Login button:

${config.locators.loginButton}

Error message:

${config.locators.errorMessage}

Products title:

${config.locators.productsTitle}

Do not use getByRole.

Do not use getByTestId.

Do not use getByLabel.

Do not use getByText.

Do not use XPath.

==================================================
TEST DATA
==================================================

Valid username:

${config.login.validUsername}

Valid password:

${config.login.validPassword}

Invalid username:

${config.login.invalidUsername}

Invalid password:

${config.login.invalidPassword}

==================================================
EXPECTED RESULTS
==================================================

Success URL:

${config.expected.successUrl}

Products title:

${config.expected.productsTitle}

Invalid credentials message:

${config.expected.invalidCredentialsMessage}

For TC002, TC003, TC004, TC008 and TC009, validate the invalid credentials message using toContainText(), not toHaveText().

Use exactly:

await expect(
  page.locator('${config.locators.errorMessage}')
).toContainText(
  '${config.expected.invalidCredentialsMessage}'
);

Do not add any prefix such as "Epic sadface:".

Do not use toHaveText() for invalid credential validation.

==================================================
TC001
==================================================

Successful login using valid username and password.

Synchronize login click and navigation:

await Promise.all([
  page.waitForURL(
    '${config.expected.successUrl}',
    {
      timeout: 30000
    }
  ),
  page.click(
    '${config.locators.loginButton}'
  )
]);

Then verify the Products title.

==================================================
TC002
==================================================

Invalid username + valid password.

Verify the configured invalid credentials message.

Use toContainText(), not toHaveText().

Do not add any prefix to the configured message.

==================================================
TC003
==================================================

Valid username + invalid password.

Verify the configured invalid credentials message.

Use toContainText(), not toHaveText().

Do not add any prefix to the configured message.

==================================================
TC004
==================================================

Invalid username + invalid password.

Verify the configured invalid credentials message.

Use toContainText(), not toHaveText().

Do not add any prefix to the configured message.

==================================================
TC005
==================================================

Both username and password are empty.

Click the login button.

ONLY verify that the configured error message element is visible.

Use:

await expect(
  page.locator('${config.locators.errorMessage}')
).toBeVisible();

IMPORTANT:

Do NOT invent an error message.

Do NOT assert:

"Epic sadface: Username is required"

Do NOT assert:

"Epic sadface: Password is required"

The requirement does not specify the exact mandatory-field message.

==================================================
TC006
==================================================

Username is empty and password is valid.

Click the login button.

ONLY verify that the configured error message element is visible.

Do NOT assert any specific mandatory-field message.

==================================================
TC007
==================================================

Username is valid and password is empty.

Click the login button.

ONLY verify that the configured error message element is visible.

Do NOT assert any specific mandatory-field message.

==================================================
TC008
==================================================

Username case sensitivity.

Use a case variation of:

${config.login.validUsername}

The login should fail.

Verify:

${config.expected.invalidCredentialsMessage}

Use toContainText(), not toHaveText().

Do not add any prefix to the configured message.

==================================================
TC009
==================================================

Password case sensitivity.

Use a case variation of:

${config.login.validPassword}

The login should fail.

Verify:

${config.expected.invalidCredentialsMessage}

Use toContainText(), not toHaveText().

Do not add any prefix to the configured message.

==================================================
FINAL RULE
==================================================

The requirement is the source of truth.

The application configuration is the source of truth for configured locators and expected values.

Do NOT invent requirements.

Do NOT invent expected messages.

For invalid credential scenarios, the configured invalid credentials message must be checked with toContainText().

Never use toHaveText() for TC002, TC003, TC004, TC008 or TC009.

Return ONLY valid TypeScript source code.
`;

  console.log(
    "Sending scenarios to Gemini..."
  );

  const generatedResponse =
    await callGemini(prompt);

  let generatedCode =
    removeCodeFences(
      generatedResponse
    );

  console.log(
    "Normalizing configured locators..."
  );

  generatedCode =
    normalizeConfiguredLocators(
      generatedCode,
      config
    );

  console.log(
    "Normalizing invalid credential assertions..."
  );

  generatedCode =
    normalizeInvalidCredentialAssertions(
      generatedCode,
      config
    );

  fs.mkdirSync(
    path.dirname(outputFile),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    outputFile,
    generatedCode,
    "utf-8"
  );

  console.log(
    `Generated file written: ${outputFile}`
  );

  validateGeneratedCode(
    generatedCode,
    config
  );

  console.log("");

  console.log(
    "=========================================="
  );

  console.log(
    "PLAYWRIGHT TEST GENERATOR SUCCESS"
  );

  console.log(
    "=========================================="
  );
}

main().catch(
  (error) => {
    console.error("");

    console.error(
      "=========================================="
    );

    console.error(
      "PLAYWRIGHT TEST GENERATOR FAILED"
    );

    console.error(
      "=========================================="
    );

    console.error("");

    console.error(
      error instanceof Error
        ? error.message
        : error
    );

    process.exit(1);
  }
);