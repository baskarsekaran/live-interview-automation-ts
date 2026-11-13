
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
  requirement: string;
  questions?: string[];
  answers: string[];
}

interface ClarificationOutput {
  mode: "INTERACTIVE_HUMAN" | "CI_APPROVED_ANSWERS";
  requirement: string;
  questions: string[];
  answers: string[];
}

const rootDir = process.cwd();

const inputDir = path.join(rootDir, "input");
const outputDir = path.join(rootDir, "output");

const requirementFile = path.join(
  inputDir,
  "requirement.txt"
);

const analysisFile = path.join(
  outputDir,
  "requirement-analysis.json"
);

const approvedAnswersFile = path.join(
  inputDir,
  "clarification-answers.json"
);

const outputFile = path.join(
  outputDir,
  "clarification-answers.json"
);

function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }

  return JSON.parse(
    fs.readFileSync(filePath, "utf-8")
  );
}

function writeJsonFile(
  filePath: string,
  data: unknown
): void {
  fs.mkdirSync(
    path.dirname(filePath),
    { recursive: true }
  );

  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

function normalizeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeRequirement(
  requirement: string
): string {
  return normalizeText(requirement);
}

function normalizeQuestions(
  questions: string[]
): string[] {
  return questions.map(normalizeText);
}

function questionsMatch(
  savedQuestions: unknown,
  currentQuestions: string[]
): boolean {
  if (
    !Array.isArray(savedQuestions) ||
    !savedQuestions.every(
      (question) => typeof question === "string"
    )
  ) {
    return false;
  }

  const saved = normalizeQuestions(savedQuestions);
  const current = normalizeQuestions(currentQuestions);

  if (saved.length !== current.length) {
    return false;
  }

  return saved.every(
    (question, index) => question === current[index]
  );
}

function cleanAnswers(answers: unknown): string[] {
  if (!Array.isArray(answers)) {
    return [];
  }

  return answers
    .filter(
      (answer): answer is string =>
        typeof answer === "string"
    )
    .map((answer) => answer.trim())
    .filter((answer) => answer.length > 0);
}

async function askQuestion(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function runInteractiveClarification(
  questions: string[]
): Promise<string[]> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answers: string[] = [];

  try {
    for (let i = 0; i < questions.length; i++) {
      console.log("");

      const answer = await askQuestion(
        rl,
        `Answer ${i + 1}: ${questions[i]}\n> `
      );

      if (!answer) {
        throw new Error(
          `Answer ${i + 1} cannot be empty.`
        );
      }

      answers.push(answer);
    }
  } finally {
    rl.close();
  }

  return answers;
}

async function runHumanClarification(): Promise<void> {
  console.log("");
  console.log("=================================");
  console.log("HUMAN-IN-THE-LOOP CLARIFICATION");
  console.log("=================================");
  console.log("");

  if (!fs.existsSync(requirementFile)) {
    throw new Error(
      `Requirement file not found: ${requirementFile}`
    );
  }

  if (!fs.existsSync(analysisFile)) {
    throw new Error(
      `Requirement analysis file not found: ${analysisFile}`
    );
  }

  const requirement = fs.readFileSync(
    requirementFile,
    "utf-8"
  ).trim();

  if (!requirement) {
    throw new Error(
      "The current requirement file is empty."
    );
  }

  const analysis =
    readJsonFile<RequirementAnalysis>(
      analysisFile
    );

  if (
    !Array.isArray(analysis.questions) ||
    !analysis.questions.every(
      (question) => typeof question === "string"
    ) ||
    !Array.isArray(analysis.missingInformation)
  ) {
    throw new Error(
      "Invalid requirement-analysis.json structure."
    );
  }

  const currentQuestions = analysis.questions;

  console.log(
    `Requirement Quality: ${analysis.quality}`
  );

  console.log(
    `Risk Level: ${analysis.riskLevel}`
  );

  console.log("");
  console.log("AI identified missing information:");

  analysis.missingInformation.forEach(
    (item, index) => {
      console.log(`${index + 1}. ${item}`);
    }
  );

  console.log("");
  console.log("AI Clarification Questions:");

  currentQuestions.forEach(
    (question, index) => {
      console.log(`${index + 1}. ${question}`);
    }
  );

  const currentRequirement =
    normalizeRequirement(requirement);

  let answers: string[] = [];

  let mode: ClarificationOutput["mode"] =
    "INTERACTIVE_HUMAN";

  // =================================
  // STEP 1: CHECK INPUT APPROVED DATA
  // =================================

  if (fs.existsSync(approvedAnswersFile)) {
    console.log("");
    console.log("Checking input clarification file...");

    const approved =
      readJsonFile<ApprovedAnswers>(
        approvedAnswersFile
      );

    if (
      !approved ||
      typeof approved.requirement !== "string" ||
      !Array.isArray(approved.answers)
    ) {
      throw new Error(
        "Invalid input/clarification-answers.json structure."
      );
    }

    if (
      normalizeRequirement(approved.requirement) !==
      currentRequirement
    ) {
      throw new Error(
        "Input clarification requirement does not match input/requirement.txt."
      );
    }

    const approvedAnswers =
      cleanAnswers(approved.answers);

    if (approvedAnswers.length > 0) {
      if (
        questionsMatch(
          approved.questions,
          currentQuestions
        )
      ) {
        answers = approvedAnswers;
        mode = "CI_APPROVED_ANSWERS";

        console.log(
          "Input requirement and questions match."
        );

        console.log(
          "Using approved input answers."
        );
      } else {
        console.log(
          "Input answers do not have a matching question set."
        );

        console.log(
          "Input answers will not be reused."
        );
      }
    } else {
      console.log(
        "No approved input answers provided."
      );
    }
  }

  // =================================
  // STEP 2: CHECK PREVIOUS OUTPUT
  // =================================

  if (
    answers.length === 0 &&
    fs.existsSync(outputFile)
  ) {
    console.log("");
    console.log(
      "Checking previous clarification output..."
    );

    const previous =
      readJsonFile<Partial<ClarificationOutput>>(
        outputFile
      );

    if (
      previous &&
      typeof previous.requirement === "string" &&
      Array.isArray(previous.answers)
    ) {
      const previousRequirement =
        normalizeRequirement(previous.requirement);

      const previousAnswers =
        cleanAnswers(previous.answers);

      const requirementMatches =
        previousRequirement === currentRequirement;

      const questionsMatchCurrent =
        questionsMatch(
          previous.questions,
          currentQuestions
        );

      if (
        requirementMatches &&
        questionsMatchCurrent &&
        previousAnswers.length > 0
      ) {
        answers = previousAnswers;
        mode = "CI_APPROVED_ANSWERS";

        console.log(
          "Previous requirement matches."
        );

        console.log(
          "Previous questions match."
        );

        console.log(
          "Reusing previous clarification answers."
        );
      } else {
        console.log(
          "Previous clarification data does not match the current requirement and questions."
        );

        console.log(
          "Previous answers will not be reused."
        );
      }
    }
  }

  // =================================
  // STEP 3: INTERACTIVE MODE
  // =================================

  if (answers.length === 0 && currentQuestions.length > 0) {
    console.log("");
    console.log(
      "No reusable clarification answers found."
    );

    console.log(
      "Starting interactive clarification mode."
    );

    mode = "INTERACTIVE_HUMAN";

    answers = await runInteractiveClarification(
      currentQuestions
    );
  }

  // =================================
  // STEP 4: SAVE OUTPUT
  // =================================

  const clarificationOutput: ClarificationOutput = {
    mode,
    requirement,
    questions: currentQuestions,
    answers
  };

  writeJsonFile(
    outputFile,
    clarificationOutput
  );

  console.log("");
  console.log("=================================");
  console.log("CLARIFICATION COMPLETED");
  console.log("=================================");
  console.log("");

  console.log(`Mode: ${mode}`);
  console.log(`Questions: ${currentQuestions.length}`);
  console.log(`Answers collected: ${answers.length}`);
  console.log(`Output: ${outputFile}`);

  console.log("");
  console.log(
    "Clarification answers saved successfully."
  );
}

runHumanClarification().catch((error) => {
  console.error("");
  console.error("=================================");
  console.error("HUMAN CLARIFICATION FAILED");
  console.error("=================================");
  console.error("");

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  console.error("");

  process.exit(1);
});
