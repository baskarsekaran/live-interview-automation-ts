
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
    process.env.GEMINI_MODEL || "gemini-2.5-flash";

const GEMINI_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// --------------------------------------------------
// Requirement normalization
// --------------------------------------------------

function normalizeRequirement(
    requirement: string
): string {
    return requirement
        .trim()
        .replace(/\s+/g, " ");
}

// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {

    // --------------------------------------------------
    // 1. Validate API key
    // --------------------------------------------------

    if (!GEMINI_API_KEY) {

        throw new Error(
            "GEMINI_API_KEY is missing. Please add it to the .env file."
        );
    }

    // --------------------------------------------------
    // 2. File paths
    // --------------------------------------------------

    const requirementPath = path.join(
        process.cwd(),
        "input",
        "requirement.txt"
    );

    const analysisPath = path.join(
        process.cwd(),
        "output",
        "requirement-analysis.json"
    );

    const clarificationPath = path.join(
        process.cwd(),
        "output",
        "clarification-answers.json"
    );

    const applicationConfigPath = path.join(
        process.cwd(),
        "config",
        "application.json"
    );

    const outputPath = path.join(
        process.cwd(),
        "output",
        "test-scenarios.json"
    );

    // --------------------------------------------------
    // 3. Validate input files
    // --------------------------------------------------

    if (!fs.existsSync(requirementPath)) {
        throw new Error(
            `Requirement file not found: ${requirementPath}`
        );
    }

    if (!fs.existsSync(analysisPath)) {
        throw new Error(
            `Requirement analysis not found: ${analysisPath}`
        );
    }

    if (!fs.existsSync(clarificationPath)) {
        throw new Error(
            `Clarification answers not found: ${clarificationPath}`
        );
    }

    if (!fs.existsSync(applicationConfigPath)) {
        throw new Error(
            `Application configuration not found: ${applicationConfigPath}`
        );
    }

    // --------------------------------------------------
    // 4. Read input files
    // --------------------------------------------------

    const requirement = fs.readFileSync(
        requirementPath,
        "utf-8"
    ).trim();

    if (!requirement) {
        throw new Error(
            "The current requirement is empty."
        );
    }

    const analysis = JSON.parse(
        fs.readFileSync(
            analysisPath,
            "utf-8"
        )
    );

    const clarification = JSON.parse(
        fs.readFileSync(
            clarificationPath,
            "utf-8"
        )
    );

    const applicationConfig = JSON.parse(
        fs.readFileSync(
            applicationConfigPath,
            "utf-8"
        )
    );

    // --------------------------------------------------
    // 5. Validate clarification data
    // --------------------------------------------------

    console.log("\n=================================");
    console.log("VALIDATING CLARIFICATION DATA");
    console.log("=================================");

    if (
        !clarification ||
        typeof clarification !== "object" ||
        Array.isArray(clarification)
    ) {
        throw new Error(
            "Invalid clarification output. Expected a JSON object."
        );
    }

    if (
        typeof clarification.requirement !== "string"
    ) {
        throw new Error(
            "Clarification output is missing its requirement. Regenerate clarification answers using humanClarificationAgent.ts."
        );
    }

    const currentRequirement =
        normalizeRequirement(requirement);

    const clarificationRequirement =
        normalizeRequirement(
            clarification.requirement
        );

    if (
        currentRequirement !== clarificationRequirement
    ) {
        throw new Error(
            "REQUIREMENT MISMATCH: Clarification answers belong to a different requirement. Run humanClarificationAgent.ts again."
        );
    }

    if (
        !Array.isArray(clarification.answers) ||
        !clarification.answers.every(
            (answer: unknown) =>
                typeof answer === "string"
        )
    ) {
        throw new Error(
            "Invalid clarification answers. Expected an array of strings."
        );
    }

    if (
        ![
            "INTERACTIVE_HUMAN",
            "CI_APPROVED_ANSWERS"
        ].includes(clarification.mode)
    ) {
        throw new Error(
            "Invalid clarification mode."
        );
    }

    console.log(
        "Current requirement matches clarification requirement."
    );

    console.log(
        `Clarification mode: ${clarification.mode}`
    );

    console.log(
        `Clarification answers: ${clarification.answers.length}`
    );

    console.log(
        "Clarification validation passed."
    );

    // --------------------------------------------------
    // 6. Display application information
    // --------------------------------------------------

    console.log("\n=================================");
    console.log("GEMINI TEST SCENARIO AGENT");
    console.log("=================================");

    console.log("\nReading input files...");

    console.log(
        "Application:",
        applicationConfig?.application?.name || "Unknown"
    );

    console.log(
        "Base URL:",
        applicationConfig?.application?.baseUrl || "Unknown"
    );

    console.log("\nCurrent requirement:");
    console.log(requirement);

    // --------------------------------------------------
    // 7. Prompt
    // --------------------------------------------------

    const prompt = `
You are a senior QA automation engineer.

Generate functional test scenarios from the CURRENT software requirement.

IMPORTANT:

The CURRENT REQUIREMENT is the only source of truth.

Do NOT assume this is a login requirement.

Do NOT reuse scenarios from any previous requirement.

Do NOT generate login scenarios unless login is explicitly mentioned
in the CURRENT REQUIREMENT.

Do NOT generate scenarios based only on the application name.

The application may contain many features. Generate scenarios only
for the functionality described in the CURRENT REQUIREMENT.

Human clarification answers are authoritative when they provide
additional behavior.

The scenarios must be functional and automation-friendly.

Do not generate Playwright code.

Do not generate selectors.

Do not generate locators.

Do not generate JavaScript or TypeScript.

Do not invent unsupported business rules.

Consider appropriate:

- Positive scenarios
- Negative scenarios
- Validation scenarios
- Boundary scenarios
- Alternate flows

Only include a scenario category when it is relevant to the
CURRENT REQUIREMENT.

There is NO fixed number of scenarios.

Generate the number of scenarios needed to provide meaningful
functional coverage of the CURRENT REQUIREMENT.

Use sequential IDs:

TC001
TC002
TC003
...

Each scenario MUST use exactly this structure:

{
    "id": "TC001",
    "title": "Short scenario title",
    "type": "Positive | Negative | Validation | Boundary | Alternate",
    "description": "What is being validated",
    "preconditions": [
        "Precondition 1"
    ],
    "testData": [
        "Test data 1"
    ],
    "steps": [
        "Step 1",
        "Step 2"
    ],
    "expectedResult": "Expected application behavior"
}

Rules:

1. IDs must start with TC001.
2. IDs must increase sequentially.
3. Do not skip IDs.
4. Each scenario must directly relate to the CURRENT REQUIREMENT.
5. Avoid duplicate scenarios.
6. Do not invent application behavior that is not supported by
   the requirement or clarification.
7. Use clarification answers when available.
8. Keep scenarios concise but testable.
9. The output must be a JSON array.
10. Return ONLY valid JSON.
11. Do not return markdown.
12. Do not return explanations outside JSON.

=================================
CURRENT REQUIREMENT
=================================

${requirement}

=================================
REQUIREMENT ANALYSIS
=================================

${JSON.stringify(
        analysis,
        null,
        2
    )}

=================================
HUMAN CLARIFICATION
=================================

${JSON.stringify(
        clarification,
        null,
        2
    )}

=================================
APPLICATION INFORMATION
=================================

${JSON.stringify(
        {
            name: applicationConfig?.application?.name,
            baseUrl: applicationConfig?.application?.baseUrl
        },
        null,
        2
    )}

=================================
TASK
=================================

Generate the complete functional test scenario set
for the CURRENT REQUIREMENT.

Return JSON array only.
`;

    // --------------------------------------------------
    // 8. Call Gemini
    // --------------------------------------------------

    console.log("\nCalling Gemini...");

    const response = await fetch(
        GEMINI_URL,
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

    // --------------------------------------------------
    // 9. Validate API response
    // --------------------------------------------------

    if (!response.ok) {

        const errorText =
            await response.text();

        throw new Error(
            `Gemini API failed: ${response.status} ${response.statusText}\n${errorText}`
        );
    }

    const data: any =
        await response.json();

    // --------------------------------------------------
    // 10. Extract Gemini response
    // --------------------------------------------------

    const content =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {

        console.error(
            "\nFull Gemini response:"
        );

        console.error(
            JSON.stringify(
                data,
                null,
                2
            )
        );

        throw new Error(
            "No scenario content received from Gemini."
        );
    }

    console.log(
        "Gemini response received."
    );

    // --------------------------------------------------
    // 11. Parse JSON
    // --------------------------------------------------

    let scenarios: any;

    try {

        scenarios =
            JSON.parse(content);

    } catch (error) {

        console.error(
            "\nRaw Gemini response:"
        );

        console.error(content);

        throw new Error(
            "Gemini did not return valid JSON."
        );
    }

    // --------------------------------------------------
    // 12. Validate scenario array
    // --------------------------------------------------

    if (!Array.isArray(scenarios)) {

        console.error(
            "\nInvalid Gemini scenario response:"
        );

        console.error(
            JSON.stringify(
                scenarios,
                null,
                2
            )
        );

        throw new Error(
            "Gemini scenario response must be a JSON array."
        );
    }

    if (scenarios.length === 0) {

        throw new Error(
            "Gemini generated zero test scenarios."
        );
    }

    // --------------------------------------------------
    // 13. Validate scenario structure
    // --------------------------------------------------

    const requiredFields = [
        "id",
        "title",
        "type",
        "description",
        "preconditions",
        "testData",
        "steps",
        "expectedResult"
    ];

    const allowedTypes = [
        "Positive",
        "Negative",
        "Validation",
        "Boundary",
        "Alternate"
    ];

    console.log(
        "\nValidating generated scenarios..."
    );

    for (
        let index = 0;
        index < scenarios.length;
        index++
    ) {

        const scenario =
            scenarios[index];

        if (
            !scenario ||
            typeof scenario !== "object" ||
            Array.isArray(scenario)
        ) {
            throw new Error(
                `Scenario at index ${index} must be a JSON object.`
            );
        }

        const expectedId =
            `TC${String(index + 1).padStart(3, "0")}`;

        // ----------------------------------------------
        // Validate ID
        // ----------------------------------------------

        if (
            scenario.id !== expectedId
        ) {

            throw new Error(
                `Scenario validation failed: expected ${expectedId}, received ${scenario.id}`
            );
        }

        // ----------------------------------------------
        // Validate fields
        // ----------------------------------------------

        for (
            const field of requiredFields
        ) {

            if (
                !Object.prototype.hasOwnProperty.call(
                    scenario,
                    field
                )
            ) {

                throw new Error(
                    `Scenario ${scenario.id} is missing required field: ${field}`
                );
            }
        }

        // ----------------------------------------------
        // Validate text fields
        // ----------------------------------------------

        const textFields = [
            "id",
            "title",
            "description",
            "expectedResult"
        ];

        for (
            const field of textFields
        ) {

            if (
                typeof scenario[field] !== "string" ||
                scenario[field].trim() === ""
            ) {

                throw new Error(
                    `Scenario ${scenario.id}: ${field} must be a non-empty string.`
                );
            }
        }

        // ----------------------------------------------
        // Validate scenario type
        // ----------------------------------------------

        if (
            !allowedTypes.includes(
                scenario.type
            )
        ) {

            throw new Error(
                `Scenario ${scenario.id} has invalid type: ${scenario.type}`
            );
        }

        // ----------------------------------------------
        // Validate arrays
        // ----------------------------------------------

        if (
            !Array.isArray(
                scenario.preconditions
            )
        ) {

            throw new Error(
                `Scenario ${scenario.id}: preconditions must be an array.`
            );
        }

        if (
            !Array.isArray(
                scenario.testData
            )
        ) {

            throw new Error(
                `Scenario ${scenario.id}: testData must be an array.`
            );
        }

        if (
            !Array.isArray(
                scenario.steps
            )
        ) {

            throw new Error(
                `Scenario ${scenario.id}: steps must be an array.`
            );
        }

        if (
            scenario.steps.length === 0
        ) {

            throw new Error(
                `Scenario ${scenario.id}: steps cannot be empty.`
            );
        }

        // ----------------------------------------------
        // Validate array contents
        // ----------------------------------------------

        const arrayFields = [
            "preconditions",
            "testData",
            "steps"
        ];

        for (
            const field of arrayFields
        ) {

            if (
                !scenario[field].every(
                    (item: unknown) =>
                        typeof item === "string"
                )
            ) {

                throw new Error(
                    `Scenario ${scenario.id}: ${field} must contain only strings.`
                );
            }
        }
    }

    // --------------------------------------------------
    // 14. Save output
    // --------------------------------------------------

    const outputDirectory =
        path.dirname(outputPath);

    if (
        !fs.existsSync(
            outputDirectory
        )
    ) {

        fs.mkdirSync(
            outputDirectory,
            {
                recursive: true
            }
        );
    }

    fs.writeFileSync(

        outputPath,

        JSON.stringify(
            scenarios,
            null,
            2
        ),

        "utf-8"
    );

    // --------------------------------------------------
    // 15. Display scenarios
    // --------------------------------------------------

    console.log(
        "\nScenario validation passed."
    );

    console.log(`
=================================
GENERATED TEST SCENARIOS
=================================
`);

    scenarios.forEach(
        (
            scenario: any
        ) => {

            console.log(
                `${scenario.id} - ${scenario.title}`
            );

            console.log(
                `Type: ${scenario.type}`
            );
        }
    );

    console.log(`
=================================
TEST SCENARIO GENERATION COMPLETED
=================================

Scenarios generated: ${scenarios.length}
Output: ${outputPath}
`);

    console.log(
        "Gemini Test Scenario Agent completed successfully."
    );
}

// --------------------------------------------------
// Error handling
// --------------------------------------------------

main().catch(
    (
        error
    ) => {

        console.error(
            "\nGemini Test Scenario Agent failed."
        );

        console.error(
            error
        );

        process.exit(1);
    }
);
