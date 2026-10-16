// API responses as the backend sends them. Build fakes from these rather
// than by hand, so a mocked response cannot drift from the real one.

// Every error code the backend can send. fixtures.test.js checks this list
// against backend/app, so a code renamed there fails the frontend tests.
export const ERROR_CODES = [
  'AUTH_INVALID_TOKEN',
  'AUTH_MISSING_TOKEN',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_REVOKED',
  'BAD_REQUEST',
  'EMAIL_ALREADY_REGISTERED',
  'HTTP_ERROR',
  'INTERNAL_ERROR',
  'INVALID_CREDENTIALS',
  'METHOD_NOT_ALLOWED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'TERMS_OUTDATED',
  'UNSUPPORTED_MEDIA_TYPE',
  'VALIDATION_ERROR',
  'WRONG_PASSWORD',
]

/** The body of an error response: { error: { code, message } } */
export function errorBody(code, message = 'Request failed') {
  if (!ERROR_CODES.includes(code)) {
    throw new Error(`The backend never sends the error code ${code}`)
  }
  return { error: { code, message } }
}

/** The body of GET /api/account */
export function account(email = 'user@example.com', created_at = '2026-01-15T10:30:00+00:00') {
  return { email, created_at }
}

/** The body of a successful login or refresh */
export function tokens(access_token = 'access-token', refresh_csrf = 'refresh-csrf') {
  return { access_token, refresh_csrf }
}
