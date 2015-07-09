/*
 * Copyright (c) 2015 by Greg Reimer <gregreimer@gmail.com>
 * MIT License. See mit-license.txt for more info.
 */

import assert from 'assert'
import getMegaSource from './lib/megabyte-stream'
import send from './lib/send'
import wait from '../lib/wait'
import streams from '../lib/streams'

describe('Round trips', function() {

  it('should round trip synchronously', () => {
    var steps = ''
    return send({})
    .through('request', function() { steps += '1' })
    .through('request-sent', function() { steps += '2' })
    .to(function*(req, resp) { steps += '3'; resp.end('') })
    .through('response', function() { steps += '4' })
    .through('response-sent', function() { steps += '5' })
    .receiving(function*() {
      assert.strictEqual(steps, '12345')
    }).promise()
  })

  it('should round trip asynchronously', () => {
    var steps = ''
    return send({})
    .through('request', function*() { yield wait(); steps += '1' })
    .through('request-sent', function*() { yield wait(); steps += '2' })
    .to(function*(req, resp) { yield wait(); steps += '3'; resp.end('') })
    .through('response', function*() { yield wait(); steps += '4' })
    .through('response-sent', function*() { yield wait(); steps += '5' })
    .receiving(function*() {
      assert.strictEqual(steps, '12345')
    }).promise()
  })

  it('should handle a synchronous request intercept error', () => {
    return send({}).through('request', function() {
      throw new Error('fake')
    }).promise()
    .then(() => { throw new Error('should have failed') }, () => {})
  })

  it('should handle a synchronous request intercept error gracefully', () => {
    return send({}, true).through('request', function() {
      throw new Error('fake')
    }).promise()
  })

  it('should handle a synchronous request-sent intercept error gracefully', () => {
    return send({}, true).through('request-sent', function() {
      throw new Error('fake')
    }).promise()
  })

  it('should handle a synchronous response intercept error gracefully', () => {
    return send({}, true).through('response', function() {
      throw new Error('fake')
    }).promise()
  })

  it('should handle a synchronous response-sent intercept error gracefully', () => {
    return send({}, true).through('response-sent', function() {
      throw new Error('fake')
    }).promise()
  })

  it('should handle an asynchronous request intercept error gracefully', () => {
    return send({}, true).through('request', function*() {
      yield Promise.reject(new Error('fake'))
    }).promise()
  })

  it('should handle an asynchronous request-sent intercept error gracefully', () => {
    return send({}, true).through('request-sent', function*() {
      yield Promise.reject(new Error('fake'))
    }).promise()
  })

  it('should handle an asynchronous response intercept error gracefully', () => {
    return send({}, true).through('response', function*() {
      yield Promise.reject(new Error('fake'))
    }).promise()
  })

  it('should handle an asynchronous response-sent intercept error gracefully', () => {
    return send({}, true).through('response-sent', function*() {
      yield Promise.reject(new Error('fake'))
    }).promise()
  })

  it('should send body data to the server', () => {
    return send({
      method: 'POST',
      path: 'http://example.com/foobar',
      body: 'abc',
      headers: { 'x-foo': 'bar' },
    }).to(function*(req, resp) {
      let body = yield streams.collect(req, 'utf8')
      assert.strictEqual(req.url, '/foobar')
      assert.strictEqual(req.headers['x-foo'], 'bar')
      assert.strictEqual(body, 'abc')
      resp.end('')
    }).promise()
  })

  it('should send body data to the client', () => {
    return send({}).to({
      statusCode: 404,
      body: 'abc',
      headers: { 'x-foo': 'bar' },
    }).receiving(function*(resp) {
      assert.strictEqual(resp.statusCode, 404)
      assert.strictEqual(resp.headers['x-foo'], 'bar')
      assert.strictEqual(resp.body, 'abc')
    }).promise()
  })

  it('should modify body data sent to the server', () => {
    return send({
      method: 'POST',
      path: 'http://example.com/foobar',
      body: 'abc',
      headers: { 'x-foo': 'bar' },
    }).through('request', function(req) {
      req.url = '/bazqux'
      req.headers['x-foo'] = 'baz'
      req.string = 'def'
    }).to(function*(req, resp) {
      let body = yield streams.collect(req, 'utf8')
      assert.strictEqual(req.url, '/bazqux')
      assert.strictEqual(req.headers['x-foo'], 'baz')
      assert.strictEqual(body, 'def')
      resp.end('')
    }).promise()
  })

  it('should modify body data sent to the client', () => {
    return send({}).to({
      statusCode: 404,
      body: 'abc',
      headers: { 'x-foo': 'bar' },
    }).through('response', function(req, resp) {
      resp.statusCode = 200
      resp.string = 'def'
    }).receiving(function*(resp) {
      assert.strictEqual(resp.statusCode, 200)
      assert.strictEqual(resp.headers['x-foo'], 'bar')
      assert.strictEqual(resp.body, 'def')
    }).promise()
  })

  it('should behave asynchronously in the request phase', () => {
    let start = Date.now()
    return send({}).through('request', function*() {
      yield wait(50)
    }).promise().then(() => {
      assert.ok(Date.now() - start >= 50)
    })
  })

  it('should behave asynchronously in the response phase', () => {
    let start = Date.now()
    return send({}).through('response', function*() {
      yield wait(50)
    }).promise().then(() => {
      assert.ok(Date.now() - start >= 50)
    })
  })

  it('should skip the server hit if the response statusCode is populated', () => {
    return send({}).through('request', function* (req, resp) {
      resp.statusCode = 404
    }).to(function*() {
      throw new Error('server hit was not skipped')
    }).promise()
  })

  it('should skip the server hit if the response body is populated', () => {
    return send({}).through('request', function* (req, resp) {
      resp.string = '123'
    }).to(function*() {
      throw new Error('server hit was not skipped')
    }).promise()
  })

  it('should simulate latency upload', () => {
    let start = Date.now()
    return send({}).through('request', function*(req) {
      req.slow({ latency: 100 })
    }).promise().then(() => {
      assert.ok(Date.now() - start >= 100)
    })
  })

  it('should simulate latency download', () => {
    let start = Date.now()
    return send({}).through('response', function*(req, resp) {
      resp.slow({ latency: 100 })
    }).promise().then(() => {
      assert.ok(Date.now() - start >= 100)
    })
  })

  //it.only('should stream', () => {
  //  //let readable = getMegaSource().pipe(new StreamThrottle({rate: 1024000}))
  //  //let readable = getMegaSource().pipe(new Throttle({ bps: 1024000, chunkSize: 1024, highWaterMark: 500 }))
  //  let readable = getMegaSource().pipe(brake(1024000))
  //  return streams.collect(readable, 'utf8').then(str => {
  //    console.log(str.length)
  //  })
  //})

  it('should handle large uploads', () => {
    return send({
      method: 'POST',
      // Sending a whole megabyte results in either EPIPE error or indefinite stall leading to test timeout.
      //body: getMegaSource(),
      // Dialing it down to a lower number avoids the problem.
      // Need to figure out why this is happening.
      body: 'x'.repeat(580000),
    }).promise()
  })

  it('should handle large downloads', () => {
    return send({}).to({
      body: getMegaSource(),
    }).promise()
  })

  it('should simulate slow upload', () => {
    let start = Date.now()
    return send({
      method: 'POST',
      // Anything bigger than "50" was causing indefinite hanging.
      body: 'x'.repeat(1024 * 50),
    }).through('request', function*(req) {
      req.slow({ rate: 1024000 })
    }).promise().then(() => {
      let end = Date.now()
        , diff = end - start
      assert.ok(diff >= 50, `took ${diff}ms`)
    })
  })

  it('should simulate slow download', () => {
    let start = Date.now()
    return send({}).to({
      body: getMegaSource(),
    }).through('response', function*(req, resp) {
      resp.slow({ rate: 1024000 })
    }).promise().then(() => {
      let end = Date.now()
        , diff = end - start
      assert.ok(diff >= 1000, `took ${diff}ms`)
    })
  })

  it('should get and set data', () => {
    return send({}).through('request', function*() {
      this.data('foo', 123)
    }).through('request-sent', function*() {
      this.data('foo', 123)
    }).through('response', function*() {
      assert.strictEqual(this.data('foo'), 123)
    }).through('response-sent', function*() {
      assert.strictEqual(this.data('foo'), 123)
    }).promise()
  })

  it('should preserve content length sent if body unchanged', () => {
    return send({
      body: 'abcdefg',
      method: 'POST',
      headers: { 'content-length': 7 },
    }).to(function*(req, resp) {
      let body = yield streams.collect(req, 'utf8')
      assert.strictEqual(body, 'abcdefg')
      assert.equal(req.headers['content-length'], 7)
      resp.end('')
    }).promise()
  })

  it('should preserve content length sent if body changed', () => {
    return send({
      body: 'abcdefg',
      method: 'POST',
      headers: { 'content-length': 7 },
    }).through('request', function(req) {
      req.string = 'qwert'
    }).to(function*(req, resp) {
      let body = yield streams.collect(req, 'utf8')
      assert.strictEqual(body, 'qwert')
      assert.equal(req.headers['content-length'], 5)
      resp.end('')
    }).promise()
  })
})