// ---------------------------------------------------------------------------
// Pre-flight guard: probes the target before a suite runs and, if the
// response is a Cloudflare bot-management challenge rather than the real
// application, fails fast with ONE clear, descriptive error instead of
// letting every test in the suite fail individually with a confusing
// "expected 403 to equal 200"-style assertion error.
// ---------------------------------------------------------------------------
Cypress.Commands.add("guardAgainstCloudflareBlock", (probeUrl = "/") => {
  const base = Cypress.config("baseUrl") || "";

  // Skip the guard entirely when running against a local server
  if (base.startsWith("http://localhost") || base.startsWith("http://127.0.0.1")) {
    return;
  }

  return cy
    .request({ url: probeUrl, failOnStatusCode: false, log: false })
    .then((response) => {
      const headers = response.headers || {};
      const bodyText =
        typeof response.body === "string" ? response.body : JSON.stringify(response.body);

      const isChallenge =
        headers["cf-mitigated"] === "challenge" ||
        /Just a moment|Verify you are human|Checking your browser/i.test(bodyText);

      if (isChallenge) {
        throw new Error(
          [
            `BLOCKED BY CLOUDFLARE — target cannot be reached from this automated runner.`,
            `  URL probed   : ${base}${probeUrl}`,
            `  HTTP status  : ${response.status}`,
            `  cf-mitigated : ${headers["cf-mitigated"] || "n/a"}`,
            `  cf-ray       : ${headers["cf-ray"] || "n/a"}`,
            ``,
            `Cloudflare's bot-management is intercepting the request before it reaches`,
            `the application and serving a "Verify you are human" / "Just a moment..."`,
            `challenge instead. No amount of retrying, header tweaking, or UI-driven`,
            `navigation gets past this — it is a deliberate edge-level control.`,
            ``,
            `To run this suite for real: (a) ask the site owner to allow-list this runner,`,
            `or (b) point cypress.config.js's baseUrl/apiUrl at an environment that is not`,
            `behind Cloudflare bot management (e.g. a local/staging Magento instance).`,
            ``,
            `Skipping the remaining tests in this suite — they cannot produce meaningful`,
            `results while this block is active.`,
          ].join("\n")
        );
      }
    });
});

// Generates a unique customer payload for the Magento `/V1/customers` endpoint
Cypress.Commands.add("generateCustomer", (overrides = {}) => {
  const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  const customer = {
    email: `qa_user_${unique}@example.com`,
    firstname: "QA",
    lastname: "Automation",
    ...overrides.customer,
  };

  return {
    customer,
    password: overrides.password || "P@ssw0rd123!",
  };
});

// Registers a customer via the API and returns the cy.request response
Cypress.Commands.add("registerCustomer", (payload) => {
  return cy.request({
    method: "POST",
    url: `${Cypress.env("apiUrl")}/customers`,
    body: payload,
    failOnStatusCode: false,
  });
});

// Logs a customer in via the API and returns the cy.request response (token in body)
Cypress.Commands.add("loginCustomer", (username, password) => {
  return cy.request({
    method: "POST",
    url: `${Cypress.env("apiUrl")}/integration/customer/token`,
    body: { username, password },
    failOnStatusCode: false,
  });
});

// Convenience: register a brand new customer and return { customer, password, response }
Cypress.Commands.add("createRegisteredCustomer", (overrides = {}) => {
  return cy.generateCustomer(overrides).then((payload) => {
    return cy.registerCustomer(payload).then((response) => {
      expect(response.status, "registration setup should succeed").to.eq(200);
      return { customer: payload.customer, password: payload.password, response };
    });
  });
});

// ---------------------------------------------------------------------------
// UI helpers — selectors follow Magento's default Luma storefront theme
// markup (#firstname, #email_address, #password-confirmation, #email, #pass,
// etc.). If this storefront ships a customized theme, these selectors may
// need to be updated to match the actual rendered markup.
// ---------------------------------------------------------------------------

// Fills out the "Create an Account" form on /customer/account/create
Cypress.Commands.add("fillRegistrationForm", ({ customer, password, confirmPassword }) => {
  if (customer.firstname !== undefined) {
    cy.get("#firstname").clear().type(customer.firstname);
  }
  if (customer.lastname !== undefined) {
    cy.get("#lastname").clear().type(customer.lastname);
  }
  if (customer.email !== undefined) {
    cy.get("#email_address").clear().type(customer.email);
  }
  if (password !== undefined) {
    cy.get("#password").clear().type(password);
  }
  cy.get("#password-confirmation")
    .clear()
    .type(confirmPassword !== undefined ? confirmPassword : password);
});

Cypress.Commands.add("submitRegistrationForm", () => {
  cy.get('button[title="Create an Account"]').click();
});

// Fills out and submits the storefront sign-in form on /customer/account/login
Cypress.Commands.add("fillLoginForm", (email, password) => {
  cy.get("#email").clear().type(email);
  cy.get("#pass").clear().type(password);
});

Cypress.Commands.add("submitLoginForm", () => {
  cy.get("#send2").click();
});
