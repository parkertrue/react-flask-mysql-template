import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { ERROR_CODES, errorBody } from '../fixtures'

const BACKEND_APP = path.resolve(import.meta.dirname, '../../../../backend/app')

function backendErrorCodes() {
  const codes = new Set()
  for (const entry of readdirSync(BACKEND_APP, { recursive: true })) {
    if (!entry.endsWith('.py')) continue
    const source = readFileSync(path.join(BACKEND_APP, entry), 'utf8')
    for (const [, code] of source.matchAll(/code='([A-Z_]+)'/g)) {
      codes.add(code)
    }
  }
  return [...codes].sort()
}

describe('test fixtures', () => {
  it('know exactly the error codes the backend sends', () => {
    expect([...ERROR_CODES].sort()).toEqual(backendErrorCodes())
  })

  it('refuse an error code the backend never sends', () => {
    expect(() => errorBody('EMAIL_ALREADY_EXISTS')).toThrow(/never sends/)
  })
})
