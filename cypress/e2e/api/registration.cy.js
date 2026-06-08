/// <reference types="cypress" />

// API regression suite for customer registration
// Endpoint under test: POST {{baseUrl}}/rest/V1/customers
// Reference: Magento 2 REST API - Customer creation

describe("API - Customer Registration (POST /V1/customers)", () => {
  const apiUrl = Cypress.env("apiUrl");
  let users;

  before(() => {
    cy.guardAgainstCloudflareBlock("/");
  });

  before(() => {
    cy.fixture("users").then((data) => {
      users = data;
    });
  });

  it("registers a new customer with valid data and returns 200 with the created profile", () => {
    cy.generateCustomer().then((payload) => {
      cy.registerCustomer(payload).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property("id").that.is.a("number");
        expect(response.body.email).to.eq(payload.customer.email);
        expect(response.body.firstname).to.eq(payload.customer.firstname);
        expect(response.body.lastname).to.eq(payload.customer.lastname);
        // Password must never be echoed back in the response
        expect(response.body).to.not.have.property("password");
      });
    });
  });

  it("rejects registration when the email is already in use", () => {
    cy.createRegisteredCustomer().then(({ customer, password }) => {
      const duplicatePayload = {
        customer: {
          email: customer.email,
          firstname: "Another",
          lastname: "User",
        },
        password,
      };

      cy.registerCustomer(duplicatePayload).then((response) => {
        expect(response.status).to.eq(400);
        expect(JSON.stringify(response.body).toLowerCase()).to.include(
          "already"
        );
      });
    });
  });

  it("rejects registration when the email format is invalid", () => {
    users.invalidEmails.forEach((invalidEmail) => {
      cy.generateCustomer({ customer: { email: invalidEmail } }).then(
        (payload) => {
          cy.registerCustomer(payload).then((response) => {
            expect(response.status, `email "${invalidEmail}" should be rejected`).to.eq(400);
          });
        }
      );
    });
  });

  it("rejects registration when required fields are missing", () => {
    cy.generateCustomer().then((payload) => {
      const { firstname, ...customerWithoutFirstname } = payload.customer;

      cy.registerCustomer({
        customer: customerWithoutFirstname,
        password: payload.password,
      }).then((response) => {
        expect(response.status).to.eq(400);
      });
    });
  });

  it("rejects registration when the password does not meet complexity/length requirements", () => {
    cy.generateCustomer({ password: users.weakPassword }).then((payload) => {
      cy.registerCustomer(payload).then((response) => {
        expect(response.status).to.eq(400);
        expect(JSON.stringify(response.body).toLowerCase()).to.match(
          /password|length|character/
        );
      });
    });
  });

  it("rejects registration when the request body is empty", () => {
    cy.request({
      method: "POST",
      url: `${apiUrl}/customers`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.be.oneOf([400, 401]);
    });
  });
});
