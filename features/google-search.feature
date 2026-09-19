
Feature: Google search

  Scenario: Search for Selenium Java
    Given I open the Google website
    # When I search for "Selenium Java"
    When I search using Excel test data
    # Then the search results page should contain "Selenium"
    Then the search results should contain Excel test data