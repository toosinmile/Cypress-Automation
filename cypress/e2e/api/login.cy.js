/// <reference types="cypress" />

// API regression suite for customer login
// Endpoint under test: POST {{baseUrl}}/rest/V1/integration/customer/token
// A valid login returns a bearer token (string) that can be used to call
// authenticated endpoints such as GET /V1/customers/me.

describe("API - Customer Login (POST /V1/integration/customer/token)", () => {
  const apiUrl = Cypress.env("apiUrl");
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

    // Create one customer up front and reuse it for the "happy path" cases
    cy.createRegisteredCustomer().then(({ customer, password }) => {
      registeredCustomer = customer;
      registeredPassword = password;
    });
  });

  it("logs in with valid credentials and returns a customer token", () => {
    cy.loginCustomer(registeredCustomer.email, registeredPassword).then(
      (response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.be.a("string");
        expect(response.body.length).to.be.greaterThan(10);

        cy.wrap(response.body).as("customerToken");
      }
    );
  });

  it("allows the returned token to access an authenticated endpoint (GET /V1/customers/me)", () => {
    cy.loginCustomer(registeredCustomer.email, registeredPassword).then(
      (loginResponse) => {
        const token = loginResponse.body;

        cy.request({
          method: "GET",
          url: `${apiUrl}/customers/me`,
          headers: { Authorization: `Bearer ${token}` },
          failOnStatusCode: false,
        }).then((meResponse) => {
          expect(meResponse.status).to.eq(200);
          expect(meResponse.body.email).to.eq(registeredCustomer.email);
        });
      }
    );
  });

  it("rejects login with an incorrect password", () => {
    cy.loginCustomer(registeredCustomer.email, "WrongPassword!23").then(
      (response) => {
        expect(response.status).to.eq(401);
        expect(JSON.stringify(response.body).toLowerCase()).to.include(
          "invalid"
        );
      }
    );
  });

  it("rejects login for an email that is not registered", () => {
    cy.loginCustomer(
      users.knownInvalidLogin.email,
      users.knownInvalidLogin.password
    ).then((response) => {
      expect(response.status).to.eq(401);
    });
  });

  it("rejects login when credentials are missing", () => {
    cy.request({
      method: "POST",
      url: `${apiUrl}/integration/customer/token`,
      body: { username: "", password: "" },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.be.oneOf([400, 401]);
    });
  });

  it("rejects access to an authenticated endpoint when no token is supplied", () => {
    cy.request({
      method: "GET",
      url: `${apiUrl}/customers/me`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });

  it("rejects access to an authenticated endpoint when the token is malformed/invalid", () => {
    cy.request({
      method: "GET",
      url: `${apiUrl}/customers/me`,
      headers: { Authorization: "Bearer this.is.not.a.valid.token" },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });
});
