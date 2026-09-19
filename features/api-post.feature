Feature: JSONPlaceholder API

  Scenario: Get an existing post
    Given I have the JSONPlaceholder API
    When I send a GET request for post 1
    Then the response status should be 200
    And the response should contain post 1

  Scenario: Create a new post
    Given I have a new post payload
    When I send a POST request to the posts API
    Then the response status should be 201
    And the response should contain the created post