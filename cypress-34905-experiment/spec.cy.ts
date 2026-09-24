import type { Receipt } from './server'

const cases = [
  { name: 'POST 200 control', status: 200, form: true },
  { name: 'POST 302 plain fetch', status: 302, form: false },
  { name: 'POST 302 form body', status: 302, form: true },
  { name: 'POST 307 preserves method and body', status: 307, form: true },
]

describe('issue 34905: browser success versus interception success', () => {
  before(() => {
    expect(Cypress.version, 'reported Cypress version').to.eq('16.1.0')
    expect(Cypress.browser.version, 'reported Chrome version').to.eq('154.0.8037.57')
    expect(Cypress.browser.family).to.eq('chromium')
  })

  for (const scenario of cases) {
    for (let repetition = 1; repetition <= 3; repetition++) {
      it(`${scenario.name}, observation ${repetition}`, () => {
        const id = Cypress._.uniqueId(`case-${scenario.status}-`)
        const query = new URLSearchParams({ id, status: String(scenario.status), form: String(scenario.form) })

        cy.intercept({ method: 'POST', pathname: '/submit' }).as('submit')
        cy.visit(`/?${query}`)
        cy.get('#form button').click()
        cy.get('#result').should('contain', '"status":200')
        cy.request<Receipt[]>(`/__receipts?id=${id}`).then(({ body }) => {
          expect(body.map(({ method, path, body }) => ({ method, path, body }))).to.deep.eq([
            { method: 'POST', path: '/submit', body: scenario.form ? 'item=synthetic' : '' },
            ...(scenario.status === 200 ? [] : [{
              method: scenario.status === 307 ? 'POST' : 'GET', path: '/done',
              body: scenario.status === 307 ? 'item=synthetic' : '',
            }]),
          ])
        })
        cy.wait('@submit', { requestTimeout: 10000, responseTimeout: 40000 }).then(({ response, error }) => {
          expect(error, 'interception error').to.eq(undefined)
          expect(response, 'POST response').to.exist
          expect(response!.statusCode).to.eq(scenario.status)
          if (scenario.status !== 200) {
            expect(response!.headers.location).to.eq(`/done?id=${id}&status=${scenario.status}`)
          }
        })
      })
    }
  }
})
