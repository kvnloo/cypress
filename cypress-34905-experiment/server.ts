import { createServer } from 'node:http'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'

export interface Receipt { method: string | undefined, path: string, body: string, httpVersion: string }

const allowedStatuses = new Set([200, 302, 303, 307, 308])

/** Loopback-only synthetic fixture; does not contact any third-party service. */
export async function startFixture(port = 0) {
  const receipts = new Map<string, Receipt[]>()
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const listeningPort = (server.address() as AddressInfo | null)?.port

      res.setHeader('Cache-Control', 'no-store')

      // Reproduce the newly reported precondition without a third-party auth
      // service: top-level navigation crosses from 127.0.0.1 to localhost,
      // then returns to the AUT origin before the redirecting fetch spec runs.
      if (url.pathname === '/auth-start' && listeningPort) {
        res.writeHead(302, { Location: `http://localhost:${listeningPort}/auth-hop` }).end()
        return
      }

      if (url.pathname === '/auth-hop' && listeningPort) {
        res.writeHead(302, {
          Location: `http://127.0.0.1:${listeningPort}/auth-done`,
          'Set-Cookie': 'issue34905_auth=1; Path=/; SameSite=Lax',
        }).end()

        return
      }

      if (url.pathname === '/auth-done') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end('<!doctype html><html><body><main id="auth-done">auth done</main></body></html>')
        return
      }

      if (url.pathname === '/') {
        const id = url.searchParams.get('id') || randomUUID()
        const status = Number(url.searchParams.get('status') || 302)
        const form = url.searchParams.get('form') === 'true'
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !allowedStatuses.has(status)) {
          res.writeHead(400).end('Invalid fixture case')
          return
        }
        const parameters = new URLSearchParams({ id, status: String(status) })
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(`<!doctype html><html><body>
<form id="form"><button type="submit">Submit</button></form>
<output id="result">idle</output>
<script>
window.__run = async function () {
  const options = { method: 'POST', redirect: 'follow', headers: { Accept: 'text/vnd.turbo-stream.html, text/html' } };
  if (${form}) options.body = new URLSearchParams({ item: 'synthetic' });
  const response = await fetch(${JSON.stringify('/submit?' + parameters)}, options);
  const text = await response.text();
  const result = { status: response.status, redirected: response.redirected, url: response.url, text };
  document.getElementById('result').textContent = JSON.stringify(result);
  window.__result = result;
  return result;
};
document.getElementById('form').addEventListener('submit', function (event) {
  event.preventDefault();
  window.__run().catch(error => { document.getElementById('result').textContent = 'ERROR: ' + error.message; });
});
</script></body></html>`)
        return
      }
      if (url.pathname === '/__receipts') {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(receipts.get(url.searchParams.get('id') ?? '') || []))
        return
      }
      if (url.pathname !== '/submit' && url.pathname !== '/done') {
        res.writeHead(404).end('Not found')
        return
      }
      const id = url.searchParams.get('id')
      const status = Number(url.searchParams.get('status'))
      if (!id || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !allowedStatuses.has(status)) {
        res.writeHead(400).end('Invalid fixture case')
        return
      }
      let body = ''
      for await (const chunk of req) {
        body += chunk.toString('utf8')
        if (body.length > 8192) {
          res.writeHead(413).end('Fixture body too large')
          return
        }
      }
      const entries = receipts.get(id) || []
      entries.push({ method: req.method, path: url.pathname, body, httpVersion: req.httpVersion })
      receipts.set(id, entries)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      if (url.pathname === '/submit' && status !== 200) {
        res.writeHead(status, { Location: '/done?' + url.searchParams.toString() }).end('')
      } else {
        res.writeHead(200).end('done')
      }
    } catch (error) {
      if (!res.headersSent) res.writeHead(500)
      res.end('Fixture request failed')
      process.stderr.write(String(error) + '\n')
    }
  })
  server.listen(port, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    baseUrl,
    receipts,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
      server.closeAllConnections()
    }),
  }
}
