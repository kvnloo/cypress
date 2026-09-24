import assert from 'node:assert/strict'
import test from 'node:test'
import { startFixture } from './server.ts'

for (const status of [200, 302, 303, 307, 308]) {
  test(`real HTTP fixture serves ${status} and records each redirect hop`, async () => {
    const fixture = await startFixture()
    try {
      const id = `fixture-${status}`
      const response = await fetch(`${fixture.baseUrl}/submit?id=${id}&status=${status}`, {
        method: 'POST', body: 'item=synthetic', redirect: 'manual',
      })
      assert.equal(response.status, status)
      if (status !== 200) {
        assert.equal(response.headers.get('location'), `/done?id=${id}&status=${status}`)
        const preserveMethod = [307, 308].includes(status)
        const done = await fetch(fixture.baseUrl + response.headers.get('location'), {
          method: preserveMethod ? 'POST' : 'GET',
          ...(preserveMethod ? { body: 'item=synthetic' } : {}),
        })
        assert.equal(done.status, 200)
        assert.equal(await done.text(), 'done')
      } else assert.equal(await response.text(), 'done')
      assert.deepEqual(fixture.receipts.get(id)!.map(({ method, path, body }) => ({ method, path, body })), [
        { method: 'POST', path: '/submit', body: 'item=synthetic' },
        ...(status === 200 ? [] : [{ method: [307, 308].includes(status) ? 'POST' : 'GET', path: '/done', body: [307, 308].includes(status) ? 'item=synthetic' : '' }]),
      ])
    } finally { await fixture.close() }
  })
}

test('fixture rejects unexpected statuses rather than hiding bad test input', async () => {
  const fixture = await startFixture()
  try {
    assert.equal((await fetch(`${fixture.baseUrl}/submit?id=invalid&status=999`, { method: 'POST' })).status, 400)
  } finally { await fixture.close() }
})
