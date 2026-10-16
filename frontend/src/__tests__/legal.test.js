import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { OPERATOR, TERMS_VERSION } from '../legal'
import { backendConstant } from '@/test/backend'

const securityTxt = readFileSync(
  path.resolve(import.meta.dirname, '../../public/.well-known/security.txt'), 'utf8')
const field = name => securityTxt.match(new RegExp(`^${name}: (.*)$`, 'm'))[1]

describe('legal details', () => {
  it('accept the terms version the backend requires', () => {
    expect(TERMS_VERSION).toBe(backendConstant('auth/models.py', 'TERMS_VERSION'))
  })

  // security.txt can't import legal.js
  it('give security.txt the operator\'s contact email', () => {
    expect(field('Contact')).toBe(`mailto:${OPERATOR.email}`)
  })

  // A future date would fail the template's own CI once it passed; README
  // tells each app to renew it yearly
  it('give security.txt an expiry date', () => {
    expect(field('Expires')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    expect(Number.isNaN(Date.parse(field('Expires')))).toBe(false)
  })
})
