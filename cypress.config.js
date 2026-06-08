const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "https://osc-ultimate-demo.mageplaza.com",
    specPattern: "cypress/e2e/**/*.cy.js",
    setupNodeEvents(on, config) {
      return config;
    },
  },
  env: {
    apiUrl: "https://osc-ultimate-demo.mageplaza.com/rest/V1",
  },
  defaultCommandTimeout: 15000,
  requestTimeout: 15000,
  responseTimeout: 30000,
  retries: {
    runMode: 1,
    openMode: 0,
  },
});
