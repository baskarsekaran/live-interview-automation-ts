# AI-Assisted QA Automation — Playwright TypeScript

A practical SDET automation project demonstrating **UI automation, API automation, Page Object Model, Cucumber BDD, environment configuration, CI/CD, and an AI-assisted QA automation pipeline**.

The project is intentionally kept simple and focuses on **test engineering, automation architecture, technical judgment, failure analysis, and AI-assisted automation concepts** rather than building an unnecessarily complex framework.

---

# 🚀 AI Test Agent

The project includes a multi-stage **AI QA Pipeline** that converts a natural-language requirement into executable Playwright tests and produces a consolidated QA report.

```text
                    Requirement
                         │
                         ▼
             ┌──────────────────────┐
             │ Requirement           │
             │ Clarification Agent  │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │ Test Scenario        │
             │ Generation Agent     │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │ Playwright Test      │
             │ Generator Agent      │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │ Test Execution       │
             │ Agent                │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │ Failure Analysis     │
             │ Agent                │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │ QA Test Report       │
             │ Agent                │
             └──────────┬───────────┘
                        │
                        ▼
             ┌──────────────────────┐
             │ HTML Report Agent    │
             └──────────────────────┘
```

## AI QA Pipeline

The complete pipeline can be executed using:

```powershell
npm run ai:test
```

The pipeline performs seven stages:

### 1. Requirement Clarification

Analyzes the requirement for missing information, ambiguity, and risk.

Example:

```text
Requirement Quality:
PARTIALLY COMPLETE

Risk Level:
MEDIUM

Missing Information:
- Application URL
- Expected successful login result
```

The agent also generates clarification questions.

---

### 2. Test Scenario Generation

The requirement is converted into executable test scenarios.

Example:

```text
TC001 - Login with valid username and password
TC002 - Login with invalid username
TC003 - Login with invalid password
TC004 - Login with empty username
TC005 - Login with empty password
TC006 - Login with both username and password empty
```

The scenarios are classified as:

```text
Positive
Negative
```

Output:

```text
output/test-scenarios.json
```

---

### 3. Playwright Test Generation

The generated scenarios are converted into executable Playwright TypeScript tests.

Generated test:

```text
tests/generated/login.spec.ts
```

The current prototype uses SauceDemo as the demonstration application.

---

### 4. Automated Test Execution

The generated Playwright test suite is executed automatically using the Playwright JSON reporter.

Example successful execution:

```text
Total Tests: 18
Passed: 18
Failed: 0
Duration: 85.7s
```

Execution result:

```text
output/execution-result.json
```

---

### 5. Failure Analysis

The Failure Analysis Agent reads the execution result and classifies failures.

For example, a controlled execution produced:

```text
Status: FAILED

Failure Type:
Test Timeout

Root Cause:
One or more Playwright tests exceeded
the configured 30-second timeout.

Affected Browsers:
None
```

The agent can classify failures such as:

* Test Timeout
* Assertion Failure
* Locator Failure
* Network Failure
* Unknown Failure

Output:

```text
output/failure-analysis.json
```

---

### 6. QA Test Report

The Test Report Agent consolidates the execution and failure-analysis information.

Example:

```text
Overall Status: PASSED
Total Scenarios: 6
Positive Scenarios: 1
Negative Scenarios: 5
Total Executions: 18
Passed Tests: 18
Failed Tests: 0
Duration: 85.7s
```

Output:

```text
output/ai-test-report.json
```

---

### 7. HTML QA Dashboard

The final HTML report provides a human-readable QA dashboard.

Output:

```text
output/ai-test-report.html
```

The dashboard contains:

* Overall execution status
* Scenario count
* Positive/negative scenario count
* Execution count
* Passed/failed count
* Generated test scenarios
* Failure analysis
* Root cause
* Recommendation
* Execution duration

---

# Current AI Architecture

The current implementation is intentionally **rule-based/template-driven**.

```text
Requirement
     │
     ▼
Deterministic Analysis
     │
     ▼
Scenario Generation
     │
     ▼
Playwright Test Generation
     │
     ▼
Real Browser Execution
     │
     ▼
Failure Classification
     │
     ▼
QA Report
```

The architecture is designed so that the deterministic agents can later be replaced or enhanced with LLM-based agents.

Potential future integrations include:

* OpenAI
* Anthropic
* LangGraph
* MCP
* Playwright MCP
* GitHub
* Jira
* Test management systems

The current prototype does **not** claim to use an external LLM for every decision.

---

# AI Test Agent Output

The pipeline generates the following artifacts:

```text
output/
├── requirement-analysis.json
├── test-scenarios.json
├── execution-result.json
├── failure-analysis.json
├── ai-test-report.json
└── ai-test-report.html

tests/
└── generated/
    └── login.spec.ts
```

---

# Technology Stack

* Playwright
* TypeScript
* Node.js
* Cucumber.js
* Playwright APIRequestContext
* Page Object Model
* API Client pattern
* GitHub Actions
* HTML Reporting
* JSON Reporting
* Environment Configuration
* AI-assisted QA architecture

---

# Project Structure

```text
live-interview-automation-ts/
│
├── .github/
│   └── workflows/
│       └── playwright.yml
│
├── agents/
│   ├── qaPipelineAgent.ts
│   ├── requirementClarificationAgent.ts
│   ├── requirementAgent.ts
│   ├── playwrightTestGenerator.ts
│   ├── testExecutionAgent.ts
│   ├── failureAnalysisAgent.ts
│   ├── testReportAgent.ts
│   └── htmlReportAgent.ts
│
├── config/
│   ├── qa.env
│   ├── test.env
│   ├── stage.env
│   └── uat.env
│
├── features/
│   ├── google-search.feature
│   ├── api.feature
│   └── step-definitions/
│       ├── google.steps.ts
│       └── api.steps.ts
│
├── pages/
│   ├── GooglePage.ts
│   └── PostApiClient.ts
│
├── support/
│   └── hooks.ts
│
├── tests/
│   ├── google-search-direct.spec.ts
│   ├── google-search-pom.spec.ts
│   ├── jsonplaceholder-api-direct.spec.ts
│   ├── jsonplaceholder-api.spec.ts
│   └── generated/
│       └── login.spec.ts
│
├── output/
│   ├── requirement-analysis.json
│   ├── test-scenarios.json
│   ├── execution-result.json
│   ├── failure-analysis.json
│   ├── ai-test-report.json
│   └── ai-test-report.html
│
├── reports/
│   └── cucumber-report.html
│
├── playwright.config.ts
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

---

# UI Automation

The project contains both direct Playwright tests and Page Object Model based tests.

## Google Search

Application:

```text
https://www.google.com
```

The test performs:

1. Open Google
2. Validate page title
3. Locate the search box
4. Search for `Selenium Java`
5. Validate the search results page

---

## Direct Playwright Test

```text
tests/google-search-direct.spec.ts
```

Run:

```powershell
npx.cmd playwright test tests/google-search-direct.spec.ts --project=chromium
```

---

## Playwright with POM

```text
tests/google-search-pom.spec.ts
```

Page Object:

```text
pages/GooglePage.ts
```

Architecture:

```text
Test
  ↓
GooglePage
  ↓
Playwright
  ↓
Google
```

The Page Object contains:

* Locators
* Navigation
* Search actions
* Page validations

### Why POM?

POM helps:

* Reduce duplicate locators
* Improve maintainability
* Separate test logic from UI implementation
* Reuse page actions
* Make tests easier to understand

---

# API Automation

The project uses Playwright `APIRequestContext` for API automation.

Application:

```text
https://jsonplaceholder.typicode.com
```

## Direct API Test

```text
tests/jsonplaceholder-api-direct.spec.ts
```

Covers:

* GET `/posts/1`
* POST `/posts`

---

## API Client

```text
pages/PostApiClient.ts
```

Architecture:

```text
Test
  ↓
PostApiClient
  ↓
Playwright APIRequestContext
  ↓
JSONPlaceholder
```

### Why API Client?

For API automation, an API Client / Service Object is more appropriate than treating an API like a UI page.

This separates:

* API endpoints
* Request operations
* Common validations
* Test scenarios

---

# Cucumber BDD

Cucumber.js is integrated with Playwright.

BDD scenarios use:

```text
Given
When
Then
```

Architecture:

```text
Feature
   ↓
Step Definition
   ↓
Page Object / API Client
   ↓
Playwright
```

BDD files:

```text
features/
├── google-search.feature
├── api.feature
└── step-definitions/
    ├── google.steps.ts
    └── api.steps.ts
```

Run:

```powershell
npm run bdd
```

---

# Environment Configuration

Environment-specific configuration is externalized.

```text
config/
├── qa.env
├── test.env
├── stage.env
└── uat.env
```

Example:

```env
UI_URL=https://www.google.com
API_BASE_URL=https://jsonplaceholder.typicode.com
```

Environment selection:

```powershell
$env:ENV="qa"
npx.cmd playwright test --project=chromium
```

Or:

```powershell
$env:ENV="test"
npx.cmd playwright test --project=chromium
```

The objective is:

> Environment changes should require configuration changes rather than test-code changes.

---

# Headed / Headless Execution

## Normal Playwright Tests

Headless:

```powershell
npx.cmd playwright test --project=chromium
```

Headed:

```powershell
npx.cmd playwright test --project=chromium --headed
```

---

## Cucumber BDD

Headless:

```powershell
$env:HEADLESS="true"
npm run bdd
```

Headed:

```powershell
$env:HEADLESS="false"
npm run bdd
```

Headless execution is preferred for CI/CD.

Headed execution is useful for local debugging.

---

# Reporting

## Playwright HTML Report

Run:

```powershell
npx.cmd playwright test --project=chromium
```

Open:

```powershell
npx.cmd playwright show-report
```

If port `9323` is already in use:

```powershell
npx.cmd playwright show-report --port 9324
```

---

## Cucumber HTML Report

Run:

```powershell
npm run bdd
```

Open:

```powershell
Start-Process reports\cucumber-report.html
```

---

## AI QA HTML Report

Run:

```powershell
npm run ai:test
```

Then open:

```powershell
Start-Process output\ai-test-report.html
```

---

# GitHub Actions

The project includes GitHub Actions CI/CD.

Workflow:

```text
.github/workflows/playwright.yml
```

Pipeline:

```text
Checkout
   ↓
Setup Node.js
   ↓
npm ci
   ↓
Install Chromium
   ↓
Run Playwright Tests
   ↓
Run Cucumber BDD Tests
   ↓
Upload Reports
```

CI execution uses headless browser mode.

Reports are retained as GitHub Actions artifacts.

---

# Installation

Clone the repository and install dependencies:

```powershell
npm ci
```

Install Playwright Chromium:

```powershell
npx.cmd playwright install chromium
```

---

# Running the Project

## Run all Playwright tests

```powershell
npx.cmd playwright test --project=chromium
```

## Run BDD tests

```powershell
npm run bdd
```

## Run the AI QA Pipeline

```powershell
npm run ai:test
```

The AI pipeline produces:

```text
Requirement Analysis
        ↓
Test Scenarios
        ↓
Playwright Tests
        ↓
Execution
        ↓
Failure Analysis
        ↓
QA Report
        ↓
HTML Dashboard
```

---

# Excel Test Data

The project also demonstrates externalized test data using Excel.

Test data:

```text
testdata/testdata.xlsx
```

Example:

| SearchText    | ExpectedText |
| ------------- | ------------ |
| Selenium Java | Selenium     |

Data flow:

```text
Excel
  ↓
Excel Reader
  ↓
Cucumber Step Definition
  ↓
GooglePage
  ↓
Playwright
```

Externalized test data helps:

* Avoid hardcoded values
* Reuse test scenarios
* Support data-driven testing
* Separate test data from automation logic

---

# Test Design Considerations

For a real production application, additional scenarios would be considered.

## UI

* Positive scenarios
* Negative scenarios
* Empty fields
* Boundary conditions
* Browser compatibility
* Network failures
* Dynamic content
* Localization
* Authentication
* CAPTCHA / anti-automation behavior

## API

* Invalid endpoint
* Invalid ID
* Missing fields
* Invalid payload
* Boundary values
* Unsupported methods
* Authentication
* Authorization
* Schema validation
* Headers
* Negative scenarios
* Error handling

---

# Technical Decisions

## Why Playwright?

* Modern browser automation
* Auto-waiting
* Cross-browser support
* TypeScript support
* API testing capability
* Built-in reporting
* Screenshots, videos and traces
* Good CI/CD support

## Why TypeScript?

* Strong typing
* Good Playwright support
* Better maintainability for larger automation projects
* Modern JavaScript ecosystem

## Why Cucumber?

Cucumber provides a business-readable BDD layer using Gherkin.

It is useful when business stakeholders need readable scenarios.

## Why POM?

POM separates page interaction logic from test logic and improves maintainability.

## Why API Client?

API Client provides an abstraction for API operations without treating an API like a UI page.

## Why environment configuration?

Environment-specific values should not be hardcoded into test cases.

## Why GitHub Actions?

It provides automated execution on code push and pull requests and allows reports to be retained as build artifacts.

## Why the AI QA Pipeline?

Traditional automation starts with manually designed test cases.

The AI-assisted pipeline explores a different workflow:

```text
Requirement
    ↓
Analysis
    ↓
Scenario Generation
    ↓
Automation Generation
    ↓
Execution
    ↓
Failure Analysis
    ↓
Reporting
```

This demonstrates how AI-assisted engineering can reduce repetitive test-design and automation work while keeping execution and validation under an automated QA framework.

---

# Current Limitations

This project is a portfolio/interview prototype.

The current AI agents use deterministic rules and templates rather than making live calls to an external LLM.

The architecture is intentionally designed so LLM capabilities can be introduced later.

Potential future improvements:

* LLM-based requirement analysis
* LLM-based test scenario generation
* LLM-based Playwright code generation
* Self-healing locators
* MCP-based browser interaction
* Playwright MCP
* LangGraph orchestration
* Jira integration
* GitHub issue creation
* Automatic defect creation
* Historical failure analysis
* Test prioritization
* Risk-based test generation
* Production environment approval gates

---

# Interview Talking Points

This project demonstrates:

* SDET automation architecture
* Playwright
* TypeScript
* UI automation
* API automation
* Page Object Model
* API Client pattern
* Cucumber BDD
* Gherkin
* Test design
* Negative testing
* Environment configuration
* Headed/headless execution
* CI/CD
* GitHub Actions
* JSON reporting
* HTML reporting
* Failure classification
* AI-assisted QA architecture
* Requirement analysis
* Automated test generation
* Technical judgment

### Recommended interview explanation

> "I built a multi-stage AI-assisted QA automation pipeline using TypeScript and Playwright. It starts with a natural-language requirement, analyzes it for ambiguity and missing information, generates test scenarios, generates Playwright automation, executes the tests, analyzes failures, and produces a consolidated HTML report."

If asked whether it uses a real LLM:

> "The current prototype is rule-based and template-driven because I wanted to first validate the end-to-end QA orchestration. The architecture is designed so individual agents can be replaced with LLM-powered agents using OpenAI, Anthropic, LangGraph or similar technologies."

---

# Example Successful Run

Latest validated execution:

```text
Requirement Analysis
        ↓
6 Test Scenarios
        ↓
Playwright Test Generation
        ↓
18 Test Executions
        ↓
18 Passed
0 Failed
        ↓
Failure Analysis
        ↓
QA Report
        ↓
HTML Dashboard
```

Result:

```text
Status: PASSED
Total Tests: 18
Passed: 18
Failed: 0
Duration: ~86 seconds
```

The pipeline has also been validated against test timeout failures, where the Failure Analysis Agent correctly classified the issue as:

```text
Failure Type:
Test Timeout
```

---

# Conclusion

This project demonstrates a progression from traditional test automation toward **AI-assisted quality engineering**.

It combines:

```text
SDET Fundamentals
        +
Modern Playwright Automation
        +
API Automation
        +
BDD
        +
CI/CD
        +
AI-Assisted QA Architecture
```

The goal is not to replace QA engineers with AI, but to use AI-assisted automation to reduce repetitive work and allow engineers to focus more on **test strategy, risk analysis, quality, and technical decision-making**.
