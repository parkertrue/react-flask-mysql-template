import { charCount } from '@/utils/validation'

export const NOTE_MAX_LENGTH = 256

/**
 * Validate note content
 * Must be non-blank and at most 256 characters once trimmed
 */
export function validateNoteContent(content) {
  const errors = []
  const trimmed = content?.trim()

  if (!trimmed) {
    errors.push('Note content is required')
    return errors
  }

  if (charCount(trimmed) > NOTE_MAX_LENGTH) {
    errors.push(`Note must be at most ${NOTE_MAX_LENGTH} characters`)
  }

  return errors
}
