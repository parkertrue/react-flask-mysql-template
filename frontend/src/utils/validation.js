export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 128

// Characters as the backend and MySQL count them. String.length counts
// UTF-16 units, so an emoji would count twice and the limits would bite early.
export const charCount = text => [...text].length

/**
 * An input's maxLength, counted in characters: given the value before and
 * after an edit, keep as much of what was typed or pasted as still fits. The
 * attribute itself counts UTF-16 units, so it would stop emoji at half.
 */
export function limitChars(previous, next, max) {
  const after = [...next]
  if (after.length <= max) return next

  // What the edit left alone: the characters it shares with the old value
  // at the start and at the end. The rest is what was inserted.
  const before = [...previous]
  let start = 0
  while (start < before.length && before[start] === after[start]) start++
  let end = 0
  while (end < before.length - start &&
         before[before.length - 1 - end] === after[after.length - 1 - end]) end++

  const room = Math.max(max - start - end, 0)
  const inserted = after.slice(start, after.length - end).slice(0, room)
  return [...after.slice(0, start), ...inserted, ...after.slice(after.length - end)].join('')
}

// A character a new password may not use, mirroring backend/app/schemas/auth.py:
// anything but a letter, combining mark, number, punctuation, or math,
// currency or modifier symbol (so no emoji, nor © or °), plus the emoji
// variation selectors and skin-tone modifiers, which fall in those classes.
const PASSWORD_FORBIDDEN =
  /[^\p{L}\p{Mn}\p{Mc}\p{N}\p{P}\p{Sm}\p{Sc}\p{Sk}]|[\uFE00-\uFE0F]|\p{Emoji_Modifier}/u

/**
 * The characters any password may use, checked at login as well as at
 * registration: no spaces, and no emoji or other pictographic symbols
 */
export function validatePasswordCharacters(password) {
  const errors = []
  const normalized = password.normalize('NFKC')

  if (/\s/u.test(normalized)) {
    errors.push('Password must not contain spaces')
  }

  if (PASSWORD_FORBIDDEN.test(normalized.replace(/\s/gu, ''))) {
    errors.push('Password must not contain emoji or other symbols like © or °')
  }

  return errors
}

/**
 * Validate password meets all requirements: 8-128 characters with an
 * uppercase letter, a lowercase letter and a number, and no spaces or emoji.
 * Checked as the backend checks it, after NFKC normalization.
 */
export function validatePassword(password) {
  const errors = []

  if (!password) {
    errors.push('Password is required')
    return errors
  }

  const normalized = password.normalize('NFKC')

  if (charCount(normalized) < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  }

  if (charCount(normalized) > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  }

  errors.push(...validatePasswordCharacters(password))

  if (!/[A-Z]/.test(normalized)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(normalized)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(normalized)) {
    errors.push('Password must contain at least one number')
  }

  return errors
}

// RFC 5322's unquoted local part, in ASCII only: anything else before the @
// needs SMTPUTF8, which many mail servers lack
const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/
// A domain label of any script's letters and digits, with inner hyphens. No
// emoji, which IDNA refuses.
const DOMAIN_LABEL = /^[\p{L}\p{M}\p{N}]([\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?$/u

// The address as the backend stores it: an international domain in its
// ASCII form (bücher.de -> xn--bcher-kva.de), which the URL parser computes
function asciiEmail(local, domain) {
  try {
    return `${local}@${new URL(`http://${domain}`).hostname}`
  } catch {
    return null
  }
}

/**
 * Validate email format: a plain local@domain.tld address, no display name,
 * with an ASCII local part. The backend's check is the full one; this only
 * spares the user a round trip.
 */
export function validateEmail(email) {
  const errors = []

  if (!email) {
    errors.push('Email is required')
    return errors
  }

  const parts = email.split('@')
  const [local, domain] = parts
  const labels = domain?.split('.') ?? []
  const stored = parts.length === 2 ? asciiEmail(local, domain) : null

  if (charCount(stored ?? email) > EMAIL_MAX_LENGTH) {
    errors.push(`Email must be at most ${EMAIL_MAX_LENGTH} characters`)
  }

  if (parts.length === 2 && /\P{ASCII}/u.test(local)) {
    errors.push('Before the @, an email can use only English letters, numbers and symbols like . _ + -')
  } else if (parts.length !== 2 || !EMAIL_LOCAL.test(local) || labels.length < 2 ||
             !labels.every(label => DOMAIN_LABEL.test(label)) || stored === null) {
    errors.push('Please enter a valid email address')
  }

  return errors
}

export function validatePasswordMatch(password, confirmPassword) {
  if (password !== confirmPassword) {
    return ['Passwords do not match']
  }
  return []
}