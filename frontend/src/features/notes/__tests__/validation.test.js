import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { validateNoteContent, NOTE_MAX_LENGTH } from '../validation'

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

// The backend's limit is the real one; this only spares the user a round trip
it('NOTE_MAX_LENGTH matches the backend', () => {
  const source = readFileSync(
    path.resolve(import.meta.dirname, '../../../../../backend/app/models/note.py'), 'utf8')
  expect(NOTE_MAX_LENGTH).toBe(Number(source.match(/^NOTE_MAX_LENGTH = (\d+)$/m)[1]))
})
