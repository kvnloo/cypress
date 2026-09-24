# Cypress #34905: fork-only reproduction experiment

Target: https://github.com/cypress-io/cypress/issues/34905

This is an investigation scaffold, not a Cypress fix or a confirmed reproduction.
It does not change Cypress production code and is not intended as an upstream PR.

## Experiment

Cypress `16.1.0`, Chrome for Testing `154.0.8037.57`, Node `24.19.0`.
Two isolated jobs differ only in `forceHttp1`: `false` (native) and `true` (legacy).
Ubuntu `24.04` differs from the reporter's Ubuntu `26.04.1`; do not claim full environment parity.

Each job runs four cases three times: POST -> 200, plain POST -> 302 -> GET,
form POST -> 302 -> GET, and form POST -> 307 -> POST. No test retries, stubbed
responses, real customers, payments, or third-party application servers.
The two POSTs in the 307 case are to different endpoints and are expected.
Each original `/submit` must be reached exactly once.

The spec checks application success and exact server request receipts before it
checks the observed POST response status and redirect location. Run results,
server receipts, selected CDP debug logs, actual versions, and the generated
Yarn lockfile are saved even on browser-test failure. Twelve passing tests are
required per job; skipped tests do not count as success.

## Validation performed before upload

The dependency-free TypeScript HTTP fixture suite passed 6/6 on Node `22.16.0`.
Node type-stripping syntax checks passed for all five TypeScript files; this is
not a TypeScript type check. Cypress and the pinned browser have NOT run locally.
The sandbox could not resolve the npm registry, and installed Chromium
`144.0.7559.96` rejected loopback navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`.
Those are environment blocks, not evidence that #34905 reproduces.

## Run without installing monorepo dependencies

Copy this directory OUTSIDE the Cypress repository, then use Node `24.19.0`:

```sh
corepack yarn install --non-interactive
corepack yarn test:fixture
CHROME_BINARY=/absolute/path/to/chrome FORCE_HTTP1=false corepack yarn test:browser
CHROME_BINARY=/absolute/path/to/chrome FORCE_HTTP1=true corepack yarn test:browser
```

Save `evidence/` after each manual run; the next run overwrites it. Use the same
Chrome binary for both modes. The GitHub Actions matrix isolates the modes and
preserves separate artifacts automatically. Package and binary downloads fail
rather than falling back to a different version.

A green result means this reduced HTTP fixture did not reproduce the report;
it does not disprove a failure involving HTTPS, HTTP/2, Turbo, or other app state.
A red result must first be classified as setup failure versus application,
request-count, or interception assertion failure. No speculative timeout change.

AI assistance: ChatGPT prepared and locally checked this scaffold. Human review
and an inspected CI result are still required before any upstream contribution.
