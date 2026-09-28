describe('issue 34905: state primer', () => {
  it('crosses an auth origin and returns before the redirecting fetch spec', () => {
    cy.visit('/auth-start')
    cy.location('hostname').should('eq', '127.0.0.1')
    cy.location('pathname').should('eq', '/auth-done')
    cy.get('#auth-done').should('have.text', 'auth done')
  })
})
