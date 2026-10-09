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
  'INTERNAL_ERROR',
  'INVALID_CREDENTIALS',
  'METHOD_NOT_ALLOWED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'UNSUPPORTED_MEDIA_TYPE',
  'VALIDATION_ERROR',
]

/** The body of an error response: { error: { code, message } } */
export function errorBody(code, message = 'Request failed') {
  if (!ERROR_CODES.includes(code)) {
    throw new Error(`The backend never sends the error code ${code}`)
  }
  return { error: { code, message } }
}

/** The body of a successful login or refresh */
export function tokens(access_token = 'access-token', refresh_csrf = 'refresh-csrf') {
  return { access_token, refresh_csrf }
}
