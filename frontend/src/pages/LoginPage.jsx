import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { loginUser } from '@/auth/authService'
import { getErrorMessage } from '@/api/errors'
import FormField from '@/components/forms/FormField'
import { useFormFields } from '@/components/forms/useFormFields'
import PageTitle from '@/components/layout/PageTitle'
import { validateEmail, PASSWORD_MAX_LENGTH, EMAIL_MAX_LENGTH } from '@/utils/validation'

export default function LoginPage() {
  const { login } = useAuth()
  const location = useLocation()
  const { values, errors, handleChange, validate } = useFormFields({ email: '', password: '' })
  const [formError, setFormError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLoading) return

    const valid = validate(e.currentTarget, {
      email: validateEmail(values.email)[0],
      // Only registration enforces the password rules, so changing them never
      // locks out existing users
      password: values.password ? undefined : 'Password is required',
    })
    if (!valid) return

    setFormError(null)
    setIsLoading(true)
    try {
      const data = await loginUser(values.email, values.password)
      // GuestRoute moves the user on once they are signed in
      login(data.access_token, data.refresh_csrf, values.email)
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  // While submitting, inputs are read-only and the button aria-disabled
  // rather than disabled: a disabled element drops keyboard focus
  return (
    <div className="auth-page">
      <PageTitle>Login</PageTitle>
      <div className="auth-container">
        <div className="auth-card">
          <h1 id="login-heading">Login</h1>

          {location.state?.registered && (
            <p className="success-message" role="status">
              Registration successful. Please log in.
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            noValidate
            className="auth-form"
            aria-labelledby="login-heading"
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
              autoComplete="current-password"
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              readOnly={isLoading}
              required
              maxLength={PASSWORD_MAX_LENGTH}
            />

            {formError && <div className="error-message" role="alert">{formError}</div>}

            <button type="submit" aria-disabled={isLoading} className="btn btn-primary btn-block">
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="auth-footer">
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">Register</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
