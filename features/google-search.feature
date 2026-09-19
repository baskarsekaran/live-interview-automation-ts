
Feature: Google search

  Scenario: Search for Selenium Java
    Given I open the Google website
    When I search for "Selenium Java"
    Then the search results page should contain "Selenium"