/// <reference types="cypress" />

// UI-driven regression suite for the storefront "Create an Account" flow.
// Page under test: {{baseUrl}}/customer/account/create
// Each scenario intercepts the form's POST submission (customer/account/createPost)
// so we can assert on both the resulting page state and the underlying network call.

describe("UI - Customer Registration (/customer/account/create)", () => {
  let users;

  before(() => {
    cy.guardAgainstCloudflareBlock("/");
  });

  before(() => {
    cy.fixture("users").then((data) => {
      users = data;
    });
  });

  beforeEach(() => {
    cy.intercept("POST", "**/customer/account/createPost").as("createPost");
    cy.visit("/customer/account/create");
  });

  it("registers a new customer through the form and lands on the account dashboard", () => {
    cy.generateCustomer().then(({ customer, password }) => {
      cy.fillRegistrationForm({ customer, password });
      cy.submitRegistrationForm();

      cy.wait("@createPost").its("response.statusCode").should("be.oneOf", [200, 302]);

      cy.url().should("include", "/customer/account/");
      cy.contains(/thank you for registering|my account/i).should("be.visible");
    });
  });

  it("shows a validation error when the password and confirmation do not match", () => {
    cy.generateCustomer().then(({ customer, password }) => {
      cy.fillRegistrationForm({ customer, password, confirmPassword: `${password}-mismatch` });
      cy.submitRegistrationForm();

      // Form should not submit successfully — stays on the create-account page
      cy.url().should("include", "/customer/account/create");
      cy.contains(/please enter the same value again|passwords.*match/i).should("be.visible");
    });
  });

  it("rejects registration when the email is already in use", () => {
    cy.createRegisteredCustomer().then(({ customer, password }) => {
      cy.fillRegistrationForm({
        customer: { firstname: "Another", lastname: "User", email: customer.email },
        password,
      });
      cy.submitRegistrationForm();

      cy.wait("@createPost");
      cy.url().should("include", "/customer/account/create");
      cy.contains(/already exists|there is already an account/i).should("be.visible");
    });
  });

  it("rejects registration when the email format is invalid", () => {
    const invalidEmail = users.invalidEmails[0];

    cy.generateCustomer({ customer: { email: invalidEmail } }).then(({ customer, password }) => {
      cy.fillRegistrationForm({ customer, password });
      cy.submitRegistrationForm();

      // HTML5 / Magento client-side validation should block submission
      cy.url().should("include", "/customer/account/create");
      cy.get("#email_address:invalid").should("exist");
    });
  });

  it("rejects registration when required fields are left blank", () => {
    cy.submitRegistrationForm();

    cy.url().should("include", "/customer/account/create");
    cy.get("#firstname:invalid").should("exist");
    cy.get("#lastname:invalid").should("exist");
    cy.get("#email_address:invalid").should("exist");
    cy.get("#password:invalid").should("exist");
  });

  it("rejects registration when the password does not meet complexity/length requirements", () => {
    cy.generateCustomer({ password: users.weakPassword }).then(({ customer, password }) => {
      cy.fillRegistrationForm({ customer, password });
      cy.submitRegistrationForm();

      cy.url().should("include", "/customer/account/create");
      cy.contains(/minimum.*characters|password.*requirements/i).should("be.visible");
    });
  });
});
