export default {
  e2e: {
    specPattern: ['00-auth-primer.cy.ts', 'spec.cy.ts'],
    supportFile: false,
    experimentalRunAllSpecs: true,
  },
  video: false,
  screenshotOnRunFailure: false,
  retries: 0,
  chromeWebSecurity: true,
  injectDocumentDomain: true,
}
