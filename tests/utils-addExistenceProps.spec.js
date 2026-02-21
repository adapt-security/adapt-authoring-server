import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addExistenceProps } from '../lib/utils/addExistenceProps.js'

describe('addExistenceProps()', () => {
  it('should set hasBody, hasParams, hasQuery to false for empty objects', () => {
    const req = { method: 'POST', body: {}, params: {}, query: {} }
    const res = {}
    let nextCalled = false
    const next = () => { nextCalled = true }

    addExistenceProps(req, res, next)

    assert.equal(req.hasBody, false)
    assert.equal(req.hasParams, false)
    assert.equal(req.hasQuery, false)
    assert.equal(nextCalled, true)
  })

  it('should set hasBody, hasParams, hasQuery to true for populated objects', () => {
    const req = { method: 'POST', body: { foo: 'bar' }, params: { id: '123' }, query: { search: 'test' } }
    const res = {}
    let nextCalled = false
    const next = () => { nextCalled = true }

    addExistenceProps(req, res, next)

    assert.equal(req.hasBody, true)
    assert.equal(req.hasParams, true)
    assert.equal(req.hasQuery, true)
    assert.equal(nextCalled, true)
  })

  it('should remove undefined and null values from request objects', () => {
    const req = { method: 'POST', body: { foo: 'bar', baz: undefined, qux: null }, params: {}, query: {} }
    const res = {}
    const next = () => {}

    addExistenceProps(req, res, next)

    assert.equal(req.body.foo, 'bar')
    assert.equal(req.body.baz, undefined)
    assert.equal(req.body.qux, undefined)
    assert.equal(req.hasBody, true)
  })

  it('should clear body for GET requests', () => {
    const req = { method: 'GET', body: { foo: 'bar' }, params: {}, query: {} }
    const res = {}
    const next = () => {}

    addExistenceProps(req, res, next)

    assert.deepEqual(req.body, {})
    assert.equal(req.hasBody, false)
  })

  it('should handle falsy attr values (missing body/params/query)', () => {
    const req = { method: 'POST', body: null, params: undefined, query: false }
    const res = {}
    const next = () => {}

    addExistenceProps(req, res, next)

    assert.equal(req.hasBody, false)
    assert.equal(req.hasParams, false)
    assert.equal(req.hasQuery, false)
  })

  it('should mark has* false when all entries are null or undefined', () => {
    const req = { method: 'POST', body: { a: null, b: undefined }, params: {}, query: {} }
    const res = {}
    const next = () => {}

    addExistenceProps(req, res, next)

    assert.equal(req.hasBody, false)
  })

  it('should always call next()', () => {
    const req = { method: 'POST', body: {}, params: {}, query: {} }
    const res = {}
    let nextCalled = false
    const next = () => { nextCalled = true }

    addExistenceProps(req, res, next)

    assert.equal(nextCalled, true)
  })
})
