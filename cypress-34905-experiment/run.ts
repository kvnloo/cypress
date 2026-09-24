import { mkdir, writeFile } from 'node:fs/promises'
import { platform, release } from 'node:os'
import cypress from 'cypress'
import { startFixture } from './server.ts'

const mode = process.env.FORCE_HTTP1
const browser = process.env.CHROME_BINARY

if (!browser || !['true', 'false'].includes(mode ?? '')) {
  throw new Error('Set CHROME_BINARY and FORCE_HTTP1=true|false explicitly')
}

await mkdir('evidence', { recursive: true })
const fixture = await startFixture()
const environment = {
  node: process.version, platform: platform(), release: release(), browser,
  forceHttp1: mode === 'true', commit: process.env.GITHUB_SHA ?? null,
  expectedCypress: '16.1.0', expectedChrome: '154.0.8037.57',
}

try {
  const results = await cypress.run({
    browser, headless: true, record: false,
    configFile: 'cypress.config.ts',
    config: { baseUrl: fixture.baseUrl, forceHttp1: mode === 'true' },
  })

  await writeFile('evidence/cypress-result.json', JSON.stringify(results, null, 2))
  process.exitCode = 'totalFailed' in results && results.totalTests === 12 && results.totalPassed === 12 && results.totalFailed === 0 ? 0 : 1
} catch (error) {
  await writeFile('evidence/runner-error.txt', error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
} finally {
  await writeFile('evidence/environment.json', JSON.stringify(environment, null, 2))
  await writeFile('evidence/server-receipts.json', JSON.stringify(Object.fromEntries(fixture.receipts), null, 2))
  await fixture.close()
}
