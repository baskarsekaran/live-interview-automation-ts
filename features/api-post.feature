Feature: Create post API

  Scenario: Create a new post
    Given I have a new post payload
    When I send a POST request to the posts API
    Then the response status should be 201
    And the response should contain the created post