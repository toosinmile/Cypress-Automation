const { defineConfig } = require("cypress");
const { createMockServer } = require("./cypress/support/mockServer");

const MOCK_PORT = 4001;
let mockServerInstance = null;

module.exports = defineConfig({
  e2e: {
    baseUrl: `http://localhost:${MOCK_PORT}`,
    specPattern: "cypress/e2e/**/*.cy.js",
    setupNodeEvents(on, config) {
      on("before:browser:launch", (browser, launchOptions) => {
        if (browser.name === "chrome" || browser.name === "chromium") {
          launchOptions.args.push("--disable-blink-features=AutomationControlled");
          launchOptions.args.push("--disable-infobars");
        }
        return launchOptions;
      });

      on("after:run", () => {
        if (mockServerInstance) mockServerInstance.close();
      });

      config.env.apiUrl = `http://localhost:${MOCK_PORT}/rest/V1`;

      // Start the mock server now — before Cypress validates baseUrl
      return new Promise((resolve) => {
        const app = createMockServer();
        mockServerInstance = app.listen(MOCK_PORT, () => {
          console.log(`\n  ✔  Mock Magento API running on http://localhost:${MOCK_PORT}\n`);
          resolve(config);
        });
      });
    },
  },
  defaultCommandTimeout: 15000,
  requestTimeout: 15000,
  responseTimeout: 30000,
  retries: {
    runMode: 1,
    openMode: 0,
  },
});
