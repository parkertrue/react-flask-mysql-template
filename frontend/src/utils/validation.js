export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 128
export const NOTE_MIN_LENGTH = 1
export const NOTE_MAX_LENGTH = 256

/**
 * Validate password meets all requirements
 * Must be 8-128 chars with uppercase, lowercase, and number
 */
export function validatePassword(password) {
  const errors = []

  if (!password) {
    errors.push('Password is required')
    return errors
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  return errors
}

/**
 * Validate email format
 */
export function validateEmail(email) {
  const errors = []

  if (!email) {
    errors.push('Email is required')
    return errors
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    errors.push(`Email must be at most ${EMAIL_MAX_LENGTH} characters`)
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address')
  }

  return errors
}

/**
 * Validate note content
 * Must be 1-256 characters
 */
export function validateNoteContent(content) {
  const errors = []

  if (!content || !content.trim()) {
    errors.push('Note content is required')
    return errors
  }

  const trimmed = content.trim()

  if (trimmed.length < NOTE_MIN_LENGTH) {
    errors.push('Note cannot be empty')
  }

  if (trimmed.length > NOTE_MAX_LENGTH) {
    errors.push(`Note must be at most ${NOTE_MAX_LENGTH} characters`)
  }

  return errors
}

/**
 * Check if passwords match
 */
export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return ['Passwords do not match']
  }
  return []
}