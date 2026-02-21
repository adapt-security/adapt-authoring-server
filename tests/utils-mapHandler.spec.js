import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapHandler } from '../lib/utils/mapHandler.js'

describe('mapHandler()', () => {
  it('should return a function', () => {
    const mockRouter = { map: { test: 'data' } }
    const handler = mapHandler(mockRouter)

    assert.equal(typeof handler, 'function')
  })

  it('should respond with router map as JSON', () => {
    const mockRouter = { map: { test: 'data' } }
    const handler = mapHandler(mockRouter)
    const req = {}
    let responseData = null
    const res = {
      json: (data) => { responseData = data }
    }

    handler(req, res)

    assert.deepEqual(responseData, { test: 'data' })
  })

  it('should return the current map value on each call', () => {
    const mockRouter = { map: { initial: true } }
    const handler = mapHandler(mockRouter)
    const res = { json: () => {} }

    let captured
    res.json = (data) => { captured = data }

    handler({}, res)
    assert.deepEqual(captured, { initial: true })

    mockRouter.map = { updated: true }
    handler({}, res)
    assert.deepEqual(captured, { updated: true })
  })
})
