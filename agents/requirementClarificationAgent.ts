import fs from "fs";

interface ClarificationResult {
  requirement: string;
  requirementQuality: string;
  riskLevel: string;
  missingInformation: string[];
  questions: string[];
  recommendation: string;
  timestamp: string;
}

function analyzeRequirement(requirement: string): ClarificationResult {

  const missingInformation: string[] = [];
  const questions: string[] = [];

  const lowerRequirement =
    requirement.toLowerCase();

  // Application information
  if (
    !lowerRequirement.includes("url") &&
    !lowerRequirement.includes("application")
  ) {
    missingInformation.push(
      "Application URL"
    );

    questions.push(
      "What is the application URL or environment URL?"
    );
  }

  // Username
  if (
    lowerRequirement.includes("login") &&
    !lowerRequirement.includes("username")
  ) {
    missingInformation.push(
      "Valid username"
    );

    questions.push(
      "What valid username should be used for login?"
    );
  }

  // Password
  if (
    lowerRequirement.includes("login") &&
    !lowerRequirement.includes("password")
  ) {
    missingInformation.push(
      "Valid password"
    );

    questions.push(
      "What valid password should be used for login?"
    );
  }

  // Successful result
  if (
    !lowerRequirement.includes("dashboard") &&
    !lowerRequirement.includes("home") &&
    !lowerRequirement.includes("success") &&
    !lowerRequirement.includes("logged in")
  ) {
    missingInformation.push(
      "Expected successful login result"
    );

    questions.push(
      "What should happen after a successful login?"
    );
  }

  // Invalid login behavior
  if (
    lowerRequirement.includes("login") &&
    !lowerRequirement.includes("invalid") &&
    !lowerRequirement.includes("error")
  ) {
    missingInformation.push(
      "Invalid login behavior"
    );

    questions.push(
      "What should happen when invalid credentials are entered?"
    );
  }

  // Mandatory fields
  if (
    lowerRequirement.includes("login") &&
    !lowerRequirement.includes("mandatory") &&
    !lowerRequirement.includes("empty") &&
    !lowerRequirement.includes("required")
  ) {
    missingInformation.push(
      "Mandatory field validation"
    );

    questions.push(
      "What validation should occur when mandatory fields are empty?"
    );
  }

  let requirementQuality = "COMPLETE";
  let riskLevel = "LOW";

  if (missingInformation.length >= 4) {
    requirementQuality = "INCOMPLETE";
    riskLevel = "HIGH";
  }
  else if (missingInformation.length >= 2) {
    requirementQuality = "PARTIALLY COMPLETE";
    riskLevel = "MEDIUM";
  }

  let recommendation =
    "Requirement is sufficiently detailed for test generation.";

  if (missingInformation.length > 0) {
    recommendation =
      "Clarify the missing information before generating automation tests.";
  }

  return {
    requirement:
      requirement,

    requirementQuality:
      requirementQuality,

    riskLevel:
      riskLevel,

    missingInformation:
      missingInformation,

    questions:
      questions,

    recommendation:
      recommendation,

    timestamp:
      new Date().toISOString()
  };
}

function runClarificationAgent() {

  console.log("=================================");
  console.log("REQUIREMENT CLARIFICATION AGENT");
  console.log("=================================");

  const requirementFile =
    "input/requirement.txt";

  if (!fs.existsSync(requirementFile)) {
    console.log(
      "❌ input/requirement.txt not found."
    );

    return;
  }

  const requirement =
    fs.readFileSync(
      requirementFile,
      "utf-8"
    ).trim();

  console.log(
    "\nAnalyzing requirement...\n"
  );

  const result =
    analyzeRequirement(
      requirement
    );

  console.log(
    "Requirement Quality:"
  );

  console.log(
    result.requirementQuality
  );

  console.log(
    "\nRisk Level:"
  );

  console.log(
    result.riskLevel
  );

  console.log(
    "\nMissing Information:"
  );

  if (
    result.missingInformation.length === 0
  ) {
    console.log(
      "None"
    );
  }
  else {
    result.missingInformation
      .forEach(
        item => console.log(`- ${item}`)
      );
  }

  console.log(
    "\nClarification Questions:"
  );

  if (
    result.questions.length === 0
  ) {
    console.log(
      "None"
    );
  }
  else {
    result.questions
      .forEach(
        question =>
          console.log(`- ${question}`)
      );
  }

  console.log(
    "\nRecommendation:"
  );

  console.log(
    result.recommendation
  );

  fs.writeFileSync(
    "output/requirement-analysis.json",
    JSON.stringify(
      result,
      null,
      2
    )
  );

  console.log(
    "\n================================="
  );

  console.log(
    "Requirement analysis saved to:"
  );

  console.log(
    "output/requirement-analysis.json"
  );
}

runClarificationAgent();