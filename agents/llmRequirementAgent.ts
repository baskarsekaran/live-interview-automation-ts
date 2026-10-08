import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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

    const outputPath = path.join(
        process.cwd(),
        "output",
        "requirement-analysis.json"
    );

    // --------------------------------------------------
    // 3. Read requirement
    // --------------------------------------------------

    const requirement = fs.readFileSync(
        requirementPath,
        "utf-8"
    ).trim();

    console.log("\n========================================");
    console.log("GEMINI REQUIREMENT AGENT");
    console.log("========================================");

    console.log("Model:", GEMINI_MODEL);
    console.log("Reading:", requirementPath);

    // --------------------------------------------------
    // 4. Prompt
    // --------------------------------------------------

    const prompt = `
You are a senior QA engineer and requirement analyst.

Analyze the following software requirement.

Identify:

1. Requirement quality
2. Risk level
3. Important missing or ambiguous information
4. Questions that should be clarified before automation

Return ONLY valid JSON.

Do not return markdown.
Do not return explanations outside JSON.

Use exactly this JSON structure:

{
  "quality": "COMPLETE | PARTIALLY_COMPLETE | INCOMPLETE",
  "riskLevel": "LOW | MEDIUM | HIGH",
  "missingInformation": [
    "item 1",
    "item 2"
  ],
  "questions": [
    "question 1",
    "question 2"
  ]
}

Rules:

- COMPLETE means the requirement is sufficiently clear and testable.
- PARTIALLY_COMPLETE means the main behavior is clear but some important details are missing.
- INCOMPLETE means important information is missing and meaningful testing cannot be designed.
- Focus only on information needed for QA testing.
- Do not add unrelated security or technical recommendations.
- Do not invent facts.
- Keep the response concise.
- Return valid JSON only.

Requirement:

${requirement}
`;

    console.log("\nSending requirement to Gemini...");

    // --------------------------------------------------
    // 5. Call Gemini
    // --------------------------------------------------

    const response = await fetch(GEMINI_URL, {

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

    // --------------------------------------------------
    // 6. Check API response
    // --------------------------------------------------

    if (!response.ok) {

        const errorText = await response.text();

        throw new Error(
            `Gemini API failed: ${response.status} ${response.statusText}\n${errorText}`
        );
    }

    const data: any = await response.json();

    // --------------------------------------------------
    // 7. Extract Gemini response
    // --------------------------------------------------

    const content =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {

        console.error(
            "\nFull Gemini response:"
        );

        console.error(
            JSON.stringify(data, null, 2)
        );

        throw new Error(
            "No response content received from Gemini."
        );
    }

    console.log("\nGemini response received.");

    // --------------------------------------------------
    // 8. Parse JSON
    // --------------------------------------------------

    let analysis: any;

    try {

        analysis = JSON.parse(content);

    } catch (error) {

        console.error("\nRaw Gemini response:");
        console.error(content);

        throw new Error(
            "Gemini did not return valid JSON."
        );
    }

    // --------------------------------------------------
    // 9. Validate response structure
    // --------------------------------------------------

    if (
        !analysis.quality ||
        !analysis.riskLevel ||
        !Array.isArray(
            analysis.missingInformation
        ) ||
        !Array.isArray(
            analysis.questions
        )
    ) {

        console.error(
            "\nInvalid Gemini response:"
        );

        console.error(
            JSON.stringify(
                analysis,
                null,
                2
            )
        );

        throw new Error(
            "Gemini response does not match the expected requirement-analysis structure."
        );
    }

    // --------------------------------------------------
    // 10. Create output directory
    // --------------------------------------------------

    const outputDirectory =
        path.dirname(outputPath);

    if (!fs.existsSync(outputDirectory)) {

        fs.mkdirSync(
            outputDirectory,
            {
                recursive: true
            }
        );
    }

    // --------------------------------------------------
    // 11. Save analysis
    // --------------------------------------------------

    fs.writeFileSync(

        outputPath,

        JSON.stringify(
            analysis,
            null,
            2
        ),

        "utf-8"
    );

    // --------------------------------------------------
    // 12. Display result
    // --------------------------------------------------

    console.log("\n========================================");
    console.log("GEMINI REQUIREMENT ANALYSIS");
    console.log("========================================");

    console.log(
        "Quality:",
        analysis.quality
    );

    console.log(
        "Risk Level:",
        analysis.riskLevel
    );

    console.log("\nMissing Information:");

    if (
        analysis.missingInformation.length === 0
    ) {

        console.log("None");

    } else {

        analysis.missingInformation.forEach(
            (
                item: string,
                index: number
            ) => {

                console.log(
                    `${index + 1}. ${item}`
                );
            }
        );
    }

    console.log("\nQuestions:");

    if (
        analysis.questions.length === 0
    ) {

        console.log("None");

    } else {

        analysis.questions.forEach(
            (
                question: string,
                index: number
            ) => {

                console.log(
                    `${index + 1}. ${question}`
                );
            }
        );
    }

    console.log("\nOutput:");
    console.log(outputPath);

    console.log(
        "\nGemini Requirement Agent completed successfully."
    );
}

// --------------------------------------------------
// Error handling
// --------------------------------------------------

main().catch(
    (error) => {

        console.error(
            "\nGemini Requirement Agent failed."
        );

        console.error(error);

        process.exit(1);
    }
);