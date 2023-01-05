import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: null,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
})
