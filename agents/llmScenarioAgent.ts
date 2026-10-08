import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.5-flash-lite";

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not configured in .env");
}

const rootDir = process.cwd();

const requirementFile = path.join(
  rootDir,
  "input",
  "requirement.txt"
);

const analysisFile = path.join(
  rootDir,
  "output",
  "requirement-analysis.json"
);

const clarificationFile = path.join(
  rootDir,
  "output",
  "clarification-answers.json"
);

const applicationFile = path.join(
  rootDir,
  "config",
  "application.json"
);

const scenarioFile = path.join(
  rootDir,
  "output",
  "test-scenarios.json"
);

function readText(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, "utf-8");
}

function readJson(filePath: string): any {
  const content = readText(filePath);

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON: ${filePath}`);
  }
}

async function callGemini(prompt: string): Promise<string> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(endpoint, {
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
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Gemini API failed: ${response.status} ${errorText}`
    );
  }

  const data: any = await response.json();

  const generatedText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return generatedText;
}

function cleanJson(response: string): string {
  let content = response.trim();

  if (content.startsWith("```json")) {
    content = content.substring(
      "```json".length
    );
  }

  if (content.startsWith("```")) {
    content = content.substring(3);
  }

  if (content.endsWith("```")) {
    content = content.substring(
      0,
      content.length - 3
    );
  }

  return content.trim();
}

function validateScenarios(
  scenarios: any
): void {
  console.log("");
  console.log("Validating generated scenarios...");

  if (!Array.isArray(scenarios)) {
    throw new Error(
      "Gemini scenario response must be a JSON array."
    );
  }

  if (scenarios.length !== 9) {
    throw new Error(
      `Expected 9 scenarios but Gemini generated ${scenarios.length}.`
    );
  }

  const requiredIds = [
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

  for (const requiredId of requiredIds) {
    const scenario = scenarios.find(
      (item: any) =>
        item.id === requiredId
    );

    if (!scenario) {
      throw new Error(
        `Missing required scenario: ${requiredId}`
      );
    }

    if (!scenario.title) {
      throw new Error(
        `Scenario ${requiredId} is missing title.`
      );
    }

    if (!scenario.type) {
      throw new Error(
        `Scenario ${requiredId} is missing type.`
      );
    }

    if (!scenario.priority) {
      throw new Error(
        `Scenario ${requiredId} is missing priority.`
      );
    }

    if (!Array.isArray(scenario.steps)) {
      throw new Error(
        `Scenario ${requiredId} steps must be an array.`
      );
    }

    if (scenario.steps.length === 0) {
      throw new Error(
        `Scenario ${requiredId} has no steps.`
      );
    }

    if (!scenario.expectedResult) {
      throw new Error(
        `Scenario ${requiredId} has no expected result.`
      );
    }

    console.log(
      `${requiredId} - ${scenario.title}`
    );
  }

  console.log("");
  console.log(
    "Scenario validation passed."
  );
}

async function main(): Promise<void> {
  console.log("");
  console.log("=================================");
  console.log("GEMINI TEST SCENARIO AGENT");
  console.log("=================================");
  console.log("");

  console.log("Reading input files...");

  const requirement =
    readText(requirementFile);

  const requirementAnalysis =
    readJson(analysisFile);

  const clarificationAnswers =
    readJson(clarificationFile);

  const applicationConfig =
    readJson(applicationFile);

  console.log(
    `Application: ${applicationConfig.application.name}`
  );

  console.log(
    `Base URL: ${applicationConfig.application.baseUrl}`
  );

  const prompt = `
You are a Senior SDET and Test Architect.

Your responsibility is ONLY to generate functional test scenarios.

You are NOT generating Playwright code.

You are NOT generating TypeScript.

You are NOT generating Selenium code.

You are NOT generating automation scripts.

Return ONLY a valid JSON array.

==============================
ORIGINAL REQUIREMENT
==============================

${requirement}

==============================
REQUIREMENT ANALYSIS
==============================

${JSON.stringify(
  requirementAnalysis,
  null,
  2
)}

==============================
HUMAN CLARIFICATION
==============================

${JSON.stringify(
  clarificationAnswers,
  null,
  2
)}

==============================
APPLICATION CONFIGURATION
==============================

${JSON.stringify(
  applicationConfig,
  null,
  2
)}

==============================
MANDATORY TEST SCENARIOS
==============================

Generate EXACTLY these 9 scenarios:

TC001 - Successful login with valid username and password

TC002 - Login fails with invalid username and valid password

TC003 - Login fails with valid username and invalid password

TC004 - Login fails with invalid username and invalid password

TC005 - Login fails when both mandatory fields are empty

TC006 - Login fails when username is empty and password is valid

TC007 - Login fails when username is valid and password is empty

TC008 - Login fails due to username case sensitivity

TC009 - Login fails due to password case sensitivity

Do not add scenarios.

Do not remove scenarios.

==============================
SCENARIO STRUCTURE
==============================

Every scenario MUST contain:

{
  "id": "TC001",
  "title": "Scenario title",
  "type": "Positive",
  "priority": "High",
  "steps": [
    "Step 1",
    "Step 2"
  ],
  "expectedResult": "Expected result"
}

==============================
MANDATORY RULES
==============================

1. Generate exactly 9 scenarios.

2. Use these IDs exactly:

TC001
TC002
TC003
TC004
TC005
TC006
TC007
TC008
TC009

3. TC001 must be the only positive scenario.

4. TC002 through TC009 must be negative or validation scenarios.

5. Use these configured credentials.

Valid username:
${applicationConfig.login.validUsername}

Valid password:
${applicationConfig.login.validPassword}

Invalid username:
${applicationConfig.login.invalidUsername}

Invalid password:
${applicationConfig.login.invalidPassword}

6. Username case sensitivity must use:

Standard_User

7. Password case sensitivity must use:

Secret_Sauce

8. Invalid credential scenarios must expect:

${applicationConfig.expected.invalidCredentialsMessage}

9. Empty mandatory-field scenarios must verify that an appropriate validation error is displayed.

10. Do NOT invent an exact validation message for empty fields.

11. Account lockout is NOT in scope.

12. Rate limiting is NOT in scope.

13. CAPTCHA is NOT in scope.

14. Password reset is NOT in scope.

15. Registration is NOT in scope.

16. MFA is NOT in scope.

17. Remember-me functionality is NOT in scope.

18. Session timeout is NOT in scope.

19. Logout is NOT in scope.

20. Do not invent additional requirements.

21. Do not generate automation code.

22. Do not output Markdown.

23. Do not output explanations.

24. Output ONLY valid JSON.

25. The generated scenarios must be suitable for later Playwright automation generation.
`;

  console.log("");
  console.log("Calling Gemini...");

  const response =
    await callGemini(prompt);

  console.log(
    "Gemini response received."
  );

  const cleanedResponse =
    cleanJson(response);

  let scenarios: any;

  try {
    scenarios =
      JSON.parse(cleanedResponse);
  } catch {
    throw new Error(
      "Gemini returned invalid JSON for test scenarios."
    );
  }

  validateScenarios(
    scenarios
  );

  fs.mkdirSync(
    path.dirname(scenarioFile),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    scenarioFile,
    JSON.stringify(
      scenarios,
      null,
      2
    ),
    "utf-8"
  );

  console.log("");
  console.log("=================================");
  console.log(
    "TEST SCENARIO GENERATION COMPLETED"
  );
  console.log("=================================");
  console.log("");

  console.log(
    `Scenarios generated: ${scenarios.length}`
  );

  console.log(
    `Output: ${scenarioFile}`
  );

  console.log("");
}

main().catch((error) => {
  console.log("");
  console.log("=================================");
  console.log(
    "TEST SCENARIO GENERATION FAILED"
  );
  console.log("=================================");
  console.log("");

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exit(1);
});