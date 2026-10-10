import { hasUnsupportedCharacters, UNSUPPORTED_CHARACTERS_MESSAGE } from '@/utils/validation'

export const NOTE_MAX_LENGTH = 256

/**
 * Non-blank, at most NOTE_MAX_LENGTH characters once trimmed, and free of
 * emoji and other symbols, as backend/app/schemas/notes.py allows
 */
export function validateNoteContent(content) {
  const errors = []
  const trimmed = content?.trim()

  if (!trimmed) {
    errors.push('Note content is required')
    return errors
  }

  if (trimmed.length > NOTE_MAX_LENGTH) {
    errors.push(`Note must be at most ${NOTE_MAX_LENGTH} characters`)
  }

  if (hasUnsupportedCharacters(trimmed)) {
    errors.push(`Note ${UNSUPPORTED_CHARACTERS_MESSAGE}`)
  }

  return errors
}
