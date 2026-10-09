import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '@/auth/authService'
import { getErrorMessage } from '@/api/errors'
import FormField from '@/components/forms/FormField'
import { useFormFields } from '@/components/forms/useFormFields'
import PageTitle from '@/components/layout/PageTitle'
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH
} from '@/utils/validation'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { values, errors, handleChange, validate } = useFormFields({
    email: '', password: '', confirmPassword: ''
  })
  const [formError, setFormError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLoading) return

    const valid = validate(e.currentTarget, {
      email: validateEmail(values.email)[0],
      password: validatePassword(values.password)[0],
      confirmPassword: validatePasswordMatch(values.password, values.confirmPassword)[0],
    })
    if (!valid) return

    setFormError(null)
    setIsLoading(true)
    try {
      await registerUser(values.email, values.password)
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setFormError(getErrorMessage(err))
      setIsLoading(false)
    }
  }

  // While submitting, inputs are read-only and the button aria-disabled
  // rather than disabled: a disabled element drops keyboard focus
  return (
    <div className="auth-page">
      <PageTitle>Register</PageTitle>
      <div className="auth-container">
        <div className="auth-card">
          <h1 id="register-heading">Register</h1>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="auth-form"
            aria-labelledby="register-heading"
          >
            <FormField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange}
              error={errors.email}
              readOnly={isLoading}
              required
              maxLength={EMAIL_MAX_LENGTH}
            />
            <FormField
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              hint={`At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter and a number.`}
              readOnly={isLoading}
              required
              maxLength={PASSWORD_MAX_LENGTH}
            />
            <FormField
              id="confirmPassword"
              label="Confirm Password"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              readOnly={isLoading}
              required
              maxLength={PASSWORD_MAX_LENGTH}
            />

            {formError && <div className="error-message" role="alert">{formError}</div>}

            <button type="submit" aria-disabled={isLoading} className="btn btn-primary btn-block">
              {isLoading ? 'Creating account...' : 'Register'}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
