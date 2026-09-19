# Live Interview Automation – Playwright TypeScript

A minimal SDET automation project demonstrating **UI automation, API automation, Page Object Model (POM), Cucumber BDD, environment configuration, reporting, and GitHub Actions CI/CD**.

The project is intentionally kept simple to demonstrate automation fundamentals and technical judgment rather than building an over-engineered framework.

---

## Technology Stack

* Playwright
* TypeScript
* Cucumber.js
* Node.js
* Playwright APIRequestContext
* Page Object Model (POM)
* Cucumber BDD
* GitHub Actions
* HTML Reporting

---

## Project Structure

```text
live-interview-automation-ts/
│
├── .github/
│   └── workflows/
│       └── playwright.yml
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
│   └── jsonplaceholder-api.spec.ts
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

## Test Applications

### UI

The predefined UI application is:

```text
https://www.google.com
```

The test performs:

1. Open Google
2. Validate page title
3. Locate the search box
4. Search for `Selenium Java`
5. Validate the search results page title

### API

The predefined API is JSONPlaceholder:

```text
https://jsonplaceholder.typicode.com
```

The API tests cover:

* GET `/posts/1`
* POST `/posts`

Validations include:

* HTTP status code
* Response body
* Important response fields
* Created resource ID

---

# UI Automation

## 1. Direct Playwright UI Test

The direct test demonstrates a simple implementation without POM.

```text
tests/google-search-direct.spec.ts
```

Flow:

```text
Test
 ↓
Playwright Page
 ↓
Google
```

Run:

```powershell
npx.cmd playwright test tests/google-search-direct.spec.ts --project=chromium
```

---

## 2. Playwright UI Test with POM

The POM implementation separates page interaction logic from test logic.

```text
tests/google-search-pom.spec.ts
        ↓
pages/GooglePage.ts
        ↓
Playwright
```

The `GooglePage` class contains:

* Locators
* Navigation
* Search action
* Page validations

Run:

```powershell
npx.cmd playwright test tests/google-search-pom.spec.ts --project=chromium
```

### Why POM?

POM helps:

* Reduce duplicate locators
* Improve maintainability
* Separate test logic from UI implementation
* Reuse page actions
* Make tests easier to read

---

# API Automation

## 1. Direct API Test

The direct API implementation demonstrates Playwright's `APIRequestContext` without an API Client abstraction.

```text
tests/jsonplaceholder-api-direct.spec.ts
```

It covers:

* GET post
* POST post

Run:

```powershell
npx.cmd playwright test tests/jsonplaceholder-api-direct.spec.ts --project=chromium
```

---

## 2. API Client Implementation

For reusable API automation, the project uses:

```text
pages/PostApiClient.ts
```

The API Client contains:

* GET post operation
* POST post operation
* Response validations

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

Run:

```powershell
npx.cmd playwright test tests/jsonplaceholder-api.spec.ts --project=chromium
```

### Why API Client instead of POM?

POM is primarily used for UI pages.

For API automation, an **API Client / Service Object** is more appropriate because there is no UI page.

This keeps:

* API endpoints
* Request operations
* Common validations

separate from the test scenarios.

---

# BDD Automation

Cucumber.js is integrated with Playwright.

BDD scenarios are written using Gherkin:

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

## BDD UI

Feature:

```text
features/google-search.feature
```

Step definitions:

```text
features/step-definitions/google.steps.ts
```

POM:

```text
pages/GooglePage.ts
```

---

## BDD API

Feature:

```text
features/api.feature
```

Step definitions:

```text
features/step-definitions/api.steps.ts
```

API Client:

```text
pages/PostApiClient.ts
```

The BDD API scenarios cover:

* GET post
* POST post

---

# Why Both Direct Tests and BDD/POM?

This project intentionally demonstrates multiple approaches.

### Direct implementation

Useful for:

* Proof of concept
* Small test suites
* Quick automation
* Demonstrating basic Playwright skills

### POM / API Client

Useful when:

* Tests increase
* Locators or endpoints are reused
* Maintainability becomes important
* Common operations need centralization

### BDD

Useful when:

* Business-readable scenarios are required
* Product owners or business analysts need readable scenarios
* Requirements are expressed as Given/When/Then

In a production project, the approach would be selected based on project requirements rather than unnecessarily duplicating coverage.

---

# Environment Configuration

Environment-specific values are externalized.

```text
config/
├── qa.env
├── test.env
├── stage.env
└── uat.env
```

Example:

```text
UI_URL=https://www.google.com
API_BASE_URL=https://jsonplaceholder.typicode.com
```

The environment is selected using the `ENV` variable.

### QA

```powershell
$env:ENV="qa"
npx.cmd playwright test --project=chromium
```

### TEST

```powershell
$env:ENV="test"
npx.cmd playwright test --project=chromium
```

### BDD with TEST environment

```powershell
$env:ENV="test"
npm run bdd
```

This follows the principle:

> Environment changes should require configuration changes, not test-code changes.

---

# Headed / Headless Execution

The Cucumber browser mode is controlled through the `HEADLESS` environment variable.

### Headless

```powershell
$env:HEADLESS="true"
npm run bdd
```

### Headed

```powershell
$env:HEADLESS="false"
npm run bdd
```

Headless mode is used in CI, while headed mode is useful for local debugging.

---

# Reports

## Playwright HTML Report

Run:

```powershell
npx.cmd playwright test --project=chromium
```

Then:

```powershell
npx.cmd playwright show-report
```

If port `9323` is already in use:

```powershell
npx.cmd playwright show-report --port 9324
```

---

## Cucumber HTML Report

BDD execution generates:

```text
reports/cucumber-report.html
```

Run:

```powershell
npm run bdd
```

Open the report:

```powershell
Start-Process reports\cucumber-report.html
```

The BDD report contains:

* Features
* Scenarios
* Steps
* Pass/fail status
* Execution details
* Screenshots for failed scenarios
* Recorded videos

Generated reports are excluded from Git using `.gitignore`.

---

# GitHub Actions

The project runs both Playwright and Cucumber BDD tests in GitHub Actions.

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

The workflow is located at:

```text
.github/workflows/playwright.yml
```

CI runs in headless mode.

Artifacts include:

```text
playwright-report
cucumber-report
```

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

# Run Tests

## All Playwright tests

```powershell
npx.cmd playwright test --project=chromium
```

## Direct UI test

```powershell
npx.cmd playwright test tests/google-search-direct.spec.ts --project=chromium
```

## POM UI test

```powershell
npx.cmd playwright test tests/google-search-pom.spec.ts --project=chromium
```

## Direct API tests

```powershell
npx.cmd playwright test tests/jsonplaceholder-api-direct.spec.ts --project=chromium
```

## API Client tests

```powershell
npx.cmd playwright test tests/jsonplaceholder-api.spec.ts --project=chromium
```

## All BDD tests

```powershell
npm run bdd
```

---

# Test Design Considerations

For a real production application, additional scenarios would be considered.

### UI

* Invalid search
* Empty search
* Browser compatibility
* Network failures
* Authentication if applicable
* Dynamic content
* Localization
* CAPTCHA/anti-automation behavior

### API

* Invalid endpoint
* Invalid ID
* Missing fields
* Invalid payload
* Boundary values
* Unsupported methods
* Authentication/authorization
* Schema validation
* Headers
* Negative scenarios

---

# Technical Decisions

### Why Playwright?

* Modern browser automation
* Auto-waiting
* Cross-browser support
* TypeScript support
* API testing capability
* Built-in reporting and debugging features

### Why Cucumber?

Cucumber provides a business-readable BDD layer using Gherkin.

It is useful when business stakeholders need scenarios that are easy to understand.

### Why POM?

POM separates page interaction logic from test logic and improves maintainability.

### Why API Client?

API Client provides an abstraction for API operations without treating an API like a UI page.

### Why environment configuration?

Environment-specific values should not be hardcoded into test cases.

### Why GitHub Actions?

It provides automated execution on code push and pull requests and allows test reports to be retained as build artifacts.

---

# Interview Focus

This project is designed to demonstrate:

* Test design
* UI automation
* API automation
* Playwright
* TypeScript
* Page Object Model
* API Client pattern
* Cucumber BDD
* Gherkin
* Environment configuration
* Headed/headless execution
* Screenshot and video capture
* HTML reporting
* GitHub Actions
* CI/CD
* Automation maintainability
* Technical judgment

The implementation is intentionally minimal while keeping the design extensible for a larger production automation framework.
