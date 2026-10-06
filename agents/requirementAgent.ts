import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

interface TestScenario {
  id: string;
  title: string;
  type: "Positive" | "Negative" | "Edge";
}

function generateTestScenarios(requirement: string): TestScenario[] {

  const scenarios: TestScenario[] = [];

  // Positive scenario
  if (
    requirement.toLowerCase().includes("login") &&
    requirement.toLowerCase().includes("valid")
  ) {
    scenarios.push({
      id: "TC001",
      title: "Login with valid username and password",
      type: "Positive",
    });
  }

  // Invalid credentials
  if (
    requirement.toLowerCase().includes("invalid")
  ) {
    scenarios.push({
      id: "TC002",
      title: "Login with invalid username",
      type: "Negative",
    });

    scenarios.push({
      id: "TC003",
      title: "Login with invalid password",
      type: "Negative",
    });
  }

  // Empty fields
  if (
    requirement.toLowerCase().includes("empty") ||
    requirement.toLowerCase().includes("mandatory")
  ) {
    scenarios.push({
      id: "TC004",
      title: "Login with empty username",
      type: "Negative",
    });

    scenarios.push({
      id: "TC005",
      title: "Login with empty password",
      type: "Negative",
    });

    scenarios.push({
      id: "TC006",
      title: "Login with both username and password empty",
      type: "Negative",
    });
  }

  return scenarios;
}

function runAgent() {

  // Read requirement
  const requirement = fs.readFileSync(
    "input/requirement.txt",
    "utf-8"
  );

  console.log("=================================");
  console.log("AI TEST AGENT");
  console.log("=================================");

  console.log("\nRequirement:");
  console.log(requirement);

  // Generate scenarios
  const scenarios = generateTestScenarios(requirement);

  console.log("\nGenerated Test Scenarios:");

  console.log(
    JSON.stringify(scenarios, null, 2)
  );

  // Save result
  fs.writeFileSync(
    "output/test-scenarios.json",
    JSON.stringify(scenarios, null, 2)
  );

  console.log(
    "\nSaved to: output/test-scenarios.json"
  );
}

runAgent();