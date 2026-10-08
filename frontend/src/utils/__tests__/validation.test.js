import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import {
  validatePassword,
  validateEmail,
  validateNoteContent,
  validatePasswordMatch,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  NOTE_MAX_LENGTH
} from '../validation'

describe('validatePassword', () => {
  it.each([
    ['all requirements met', 'Password123'],
    ['the minimum length', 'Pass123!'],
    ['the maximum length', 'A'.repeat(63) + 'a'.repeat(63) + '12'],
    ['special characters', 'P@ssw0rd!'],
    ['spaces', 'Pass word 123'],
  ])('accepts %s', (_, password) => {
    expect(validatePassword(password)).toEqual([])
  })

  it.each(['', undefined, null])('requires a password (%o)', (password) => {
    expect(validatePassword(password)).toEqual(['Password is required'])
  })

  it.each([
    ['too short', 'Pass1', `Password must be at least ${PASSWORD_MIN_LENGTH} characters`],
    ['too long', 'Aa1' + 'x'.repeat(PASSWORD_MAX_LENGTH - 2),
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters`],
    ['without an uppercase letter', 'password123', 'Password must contain at least one uppercase letter'],
    ['without a lowercase letter', 'PASSWORD123', 'Password must contain at least one lowercase letter'],
    ['without a number', 'Password', 'Password must contain at least one number'],
  ])('rejects a password %s', (_, password, message) => {
    expect(validatePassword(password)).toEqual([message])
  })

  it('reports every rule a password breaks', () => {
    expect(validatePassword('pass')).toEqual([
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      'Password must contain at least one uppercase letter',
      'Password must contain at least one number',
    ])
  })
})

describe('validateEmail', () => {
  it.each([
    'user@example.com',
    'user@mail.example.com',
    'user123@example.com',
    'first.last@example.com',
    'user+tag@example.com',
    'user-name@example.com',
    'user_name@example.com',
  ])('accepts %s', (email) => {
    expect(validateEmail(email)).toEqual([])
  })

  it.each(['', undefined, null])('requires an email (%o)', (email) => {
    expect(validateEmail(email)).toEqual(['Email is required'])
  })

  it.each([
    'userexample.com',
    'user@',
    '@example.com',
    'user@example',
    'user name@example.com',
    'user@@example.com',
    '@',
  ])('rejects %s as malformed', (email) => {
    expect(validateEmail(email)).toContain('Please enter a valid email address')
  })

  it('rejects an email longer than the users.email column', () => {
    expect(validateEmail('a'.repeat(EMAIL_MAX_LENGTH) + '@example.com'))
      .toContain(`Email must be at most ${EMAIL_MAX_LENGTH} characters`)
  })
})

describe('validateNoteContent', () => {
  it.each([
    ['one character', 'a'],
    ['the maximum length', 'a'.repeat(NOTE_MAX_LENGTH)],
    ['special characters and numbers', 'Note 123 with @#$% chars!'],
    // The backend trims too, so surrounding space never counts
    ['surrounding whitespace', '  Valid note  '],
  ])('accepts %s', (_, content) => {
    expect(validateNoteContent(content)).toEqual([])
  })

  it.each(['', undefined, null, '   ', '\t\t', '\n\n', '  \n\t  '])(
    'requires some content (%o)',
    (content) => {
      expect(validateNoteContent(content)).toEqual(['Note content is required'])
    }
  )

  it('rejects a note longer than the notes.content column', () => {
    expect(validateNoteContent('a'.repeat(NOTE_MAX_LENGTH + 1)))
      .toEqual([`Note must be at most ${NOTE_MAX_LENGTH} characters`])
  })
})

describe('validatePasswordMatch', () => {
  it.each([
    ['Password123', 'Password123'],
    ['', ''],
    ['Pass word 123', 'Pass word 123'],
  ])('accepts %o twice', (password, confirm) => {
    expect(validatePasswordMatch(password, confirm)).toEqual([])
  })

  it.each([
    ['Password123', 'Password456'],
    ['Password123', 'password123'],
    ['Password123', 'Password123 '],
    ['Password123', ''],
    ['', 'Password123'],
  ])('rejects %o and %o', (password, confirm) => {
    expect(validatePasswordMatch(password, confirm)).toEqual(['Passwords do not match'])
  })
})

// The backend's limits are the real ones; these only spare the user a round
// trip. Read from its source, so changing one side alone fails here.
describe('limits match the backend', () => {
  const backend = file => readFileSync(
    path.resolve(import.meta.dirname, '../../../../backend/app', file), 'utf8')
  const constant = (file, name) =>
    Number(backend(file).match(new RegExp(`^${name} = (\\d+)$`, 'm'))[1])

  it.each([
    ['PASSWORD_MIN_LENGTH', PASSWORD_MIN_LENGTH, 'schemas/auth.py'],
    ['PASSWORD_MAX_LENGTH', PASSWORD_MAX_LENGTH, 'schemas/auth.py'],
    ['EMAIL_MAX_LENGTH', EMAIL_MAX_LENGTH, 'models/user.py'],
    ['NOTE_MAX_LENGTH', NOTE_MAX_LENGTH, 'models/note.py'],
  ])('%s', (name, value, file) => {
    expect(value).toBe(constant(file, name))
  })
})
