import fs from "fs";
import path from "path";
import readline from "readline";

interface RequirementAnalysis {
  quality: string;
  riskLevel: string;
  missingInformation: string[];
  questions: string[];
}

interface ApprovedAnswers {
  answers: string[];
}

interface ClarificationOutput {
  mode: "INTERACTIVE_HUMAN" | "CI_APPROVED_ANSWERS";
  answers: string[];
}

const outputDir = path.join(
  process.cwd(),
  "output"
);

const analysisFile = path.join(
  outputDir,
  "requirement-analysis.json"
);

const approvedAnswersFile = path.join(
  process.cwd(),
  "input",
  "clarification-answers.json"
);

const outputFile = path.join(
  outputDir,
  "clarification-answers.json"
);

function readJsonFile<T>(
  filePath: string
): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Required file not found: ${filePath}`
    );
  }

  return JSON.parse(
    fs.readFileSync(
      filePath,
      "utf-8"
    )
  );
}

function writeJsonFile(
  filePath: string,
  data: unknown
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf-8"
  );
}

async function askQuestion(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise(
    (resolve) => {
      rl.question(
        question,
        (answer) => {
          resolve(
            answer.trim()
          );
        }
      );
    }
  );
}

async function runHumanClarificationAgent() {

  console.log("");
  console.log("=================================");
  console.log("HUMAN-IN-THE-LOOP CLARIFICATION");
  console.log("=================================");
  console.log("");

  if (!fs.existsSync(analysisFile)) {
    throw new Error(
      `Requirement analysis file not found: ${analysisFile}`
    );
  }

  const analysis =
    readJsonFile<RequirementAnalysis>(
      analysisFile
    );

  console.log(
    `Requirement Quality: ${analysis.quality}`
  );

  console.log(
    `Risk Level: ${analysis.riskLevel}`
  );

  console.log("");

  console.log(
    "AI identified missing information:"
  );

  analysis.missingInformation.forEach(
    (item, index) => {
      console.log(
        `${index + 1}. ${item}`
      );
    }
  );

  console.log("");

  console.log(
    "AI Clarification Questions:"
  );

  analysis.questions.forEach(
    (question, index) => {
      console.log(
        `${index + 1}. ${question}`
      );
    }
  );

  console.log("");

  // =================================
  // CI/CD APPROVED ANSWERS MODE
  // =================================

  if (
    fs.existsSync(
      approvedAnswersFile
    )
  ) {

    console.log(
      "Approved clarification answers found."
    );

    console.log(
      "Running in CI/CD non-interactive mode."
    );

    console.log("");

    const approved =
      readJsonFile<ApprovedAnswers>(
        approvedAnswersFile
      );

    if (
      !approved ||
      !Array.isArray(
        approved.answers
      )
    ) {
      throw new Error(
        "Invalid input/clarification-answers.json. Expected an object containing an answers array."
      );
    }

    /*
     * IMPORTANT:
     *
     * Do NOT require the number of approved answers
     * to exactly match the number of questions generated
     * by Gemini.
     *
     * Gemini may generate a different number or wording
     * of clarification questions on different runs.
     *
     * Human-approved answers are treated as authoritative
     * for this test specification.
     */

    const cleanedAnswers =
      approved.answers
        .map(
          (answer) =>
            String(answer).trim()
        )
        .filter(
          (answer) =>
            answer.length > 0
        );

    if (
      cleanedAnswers.length === 0
    ) {
      throw new Error(
        "No valid approved clarification answers were found."
      );
    }

    const clarificationOutput:
      ClarificationOutput = {
        mode:
          "CI_APPROVED_ANSWERS",
        answers:
          cleanedAnswers
      };

    writeJsonFile(
      outputFile,
      clarificationOutput
    );

    console.log("");
    console.log("=================================");
    console.log("CI CLARIFICATION COMPLETED");
    console.log("=================================");
    console.log("");

    console.log(
      `AI questions generated: ${analysis.questions.length}`
    );

    console.log(
      `Approved answers loaded: ${cleanedAnswers.length}`
    );

    console.log(
      `Output: ${outputFile}`
    );

    console.log("");

    console.log(
      "Approved clarification answers loaded successfully."
    );

    return;
  }

  // =================================
  // LOCAL INTERACTIVE HUMAN MODE
  // =================================

  console.log(
    "No approved clarification answers found."
  );

  console.log(
    "Running in interactive human mode."
  );

  console.log("");

  const rl =
    readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

  const answers: string[] = [];

  try {

    for (
      let i = 0;
      i < analysis.questions.length;
      i++
    ) {

      const question =
        analysis.questions[i];

      console.log("");

      const answer =
        await askQuestion(
          rl,
          `Answer ${i + 1}: ${question}\n> `
        );

      if (
        answer.length === 0
      ) {
        throw new Error(
          `Answer ${i + 1} cannot be empty.`
        );
      }

      answers.push(answer);
    }

  } finally {
    rl.close();
  }

  const clarificationOutput:
    ClarificationOutput = {
      mode:
        "INTERACTIVE_HUMAN",
      answers
    };

  writeJsonFile(
    outputFile,
    clarificationOutput
  );

  console.log("");
  console.log("=================================");
  console.log("HUMAN CLARIFICATION COMPLETED");
  console.log("=================================");
  console.log("");

  console.log(
    `Answers collected: ${answers.length}`
  );

  console.log(
    `Output: ${outputFile}`
  );

  console.log("");

  console.log(
    "Human clarification answers saved successfully."
  );
}

runHumanClarificationAgent()
  .catch(
    (error) => {

      console.error("");
      console.error(
        "================================="
      );

      console.error(
        "HUMAN CLARIFICATION FAILED"
      );

      console.error(
        "================================="
      );

      console.error("");

      console.error(
        error instanceof Error
          ? error.message
          : error
      );

      console.error("");

      process.exit(1);
    }
  );