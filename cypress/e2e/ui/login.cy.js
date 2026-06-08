/// <reference types="cypress" />

// UI-driven regression suite for the storefront sign-in flow.
// Page under test: {{baseUrl}}/customer/account/login
// Each scenario intercepts the form's POST submission (customer/account/loginPost)
// so we can assert on both the resulting page state and the underlying network call.

describe("UI - Customer Login (/customer/account/login)", () => {
  let users;
  let registeredCustomer;
  let registeredPassword;

  before(() => {
    cy.guardAgainstCloudflareBlock("/");
  });

  before(() => {
    cy.fixture("users").then((data) => {
      users = data;
    });

    // Seed one customer via the API so the "happy path" has known-good credentials
    cy.createRegisteredCustomer().then(({ customer, password }) => {
      registeredCustomer = customer;
      registeredPassword = password;
    });
  });

  beforeEach(() => {
    cy.intercept("POST", "**/customer/account/loginPost").as("loginPost");
    cy.visit("/customer/account/login");
  });

  it("logs in with valid credentials and lands on the account dashboard", () => {
    cy.fillLoginForm(registeredCustomer.email, registeredPassword);
    cy.submitLoginForm();

    cy.wait("@loginPost").its("response.statusCode").should("be.oneOf", [200, 302]);

    cy.url().should("include", "/customer/account");
    cy.url().should("not.include", "/login");
    cy.contains(new RegExp(registeredCustomer.firstname, "i")).should("be.visible");
  });

  it("shows an error message for an incorrect password", () => {
    cy.fillLoginForm(registeredCustomer.email, "WrongPassword!23");
    cy.submitLoginForm();

    cy.wait("@loginPost");
    cy.url().should("include", "/customer/account/login");
    cy.contains(/invalid login or password|incorrect/i).should("be.visible");
  });

  it("shows an error message for an email that is not registered", () => {
    cy.fillLoginForm(users.knownInvalidLogin.email, users.knownInvalidLogin.password);
    cy.submitLoginForm();

    cy.wait("@loginPost");
    cy.url().should("include", "/customer/account/login");
    cy.contains(/invalid login or password|incorrect/i).should("be.visible");
  });

  it("shows validation errors when the form is submitted blank", () => {
    cy.submitLoginForm();

    cy.url().should("include", "/customer/account/login");
    cy.get("#email:invalid").should("exist");
    cy.get("#pass:invalid").should("exist");
  });

  it("does not reveal whether the account exists in the error message (enumeration check)", () => {
    // Wrong password for a known account vs. a completely unknown account
    // should both surface the same generic message — Magento intentionally
    // avoids leaking which part of the credential pair was wrong.
    cy.fillLoginForm(registeredCustomer.email, "WrongPassword!23");
    cy.submitLoginForm();
    cy.wait("@loginPost");

    cy.get("body").then(($bodyWithKnownEmail) => {
      const knownEmailMessage = $bodyWithKnownEmail.text();

      cy.visit("/customer/account/login");
      cy.fillLoginForm(users.knownInvalidLogin.email, users.knownInvalidLogin.password);
      cy.submitLoginForm();
      cy.wait("@loginPost");

      cy.get("body").then(($bodyWithUnknownEmail) => {
        const unknownEmailMessage = $bodyWithUnknownEmail.text();
        const extractError = (text) => (text.match(/invalid login or password[^.]*\./i) || [""])[0];

        expect(extractError(knownEmailMessage)).to.eq(extractError(unknownEmailMessage));
      });
    });
  });
});
