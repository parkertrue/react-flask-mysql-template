export function getErrorMessage(err) {
  if (!err.response) return 'Network error'

  const error = err.response.data?.error
  if (!error) return 'Unknown error'

  return error.message || 'Request failed'
}
