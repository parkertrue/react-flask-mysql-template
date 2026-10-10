import { useState } from 'react'
import { flushSync } from 'react-dom'

// Values and validation messages for a form of FormFields, keyed by field id
export function useFormFields(initialValues) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})

  // Editing a field clears its message
  const handleChange = (e) => {
    const { name, value } = e.target
    setValues(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: undefined }))
  }

  // Returns whether every field is valid. If not, shows the messages and
  // focuses the first invalid field, so a screen reader reads its message.
  const validate = (form, fieldErrors) => {
    const firstInvalid = Object.keys(fieldErrors).find(name => fieldErrors[name])
    // Rendered before focusing, so the message is there to be read
    flushSync(() => setErrors(fieldErrors))
    if (!firstInvalid) return true
    form.elements[firstInvalid].focus()
    return false
  }

  // Back to the starting values (or new ones), with no messages
  const reset = (nextValues = initialValues) => {
    setValues(nextValues)
    setErrors({})
  }

  return { values, errors, handleChange, validate, reset }
}
