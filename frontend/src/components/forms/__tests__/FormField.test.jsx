import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FormField from '../FormField'

const input = () => screen.getByLabelText('Password')

describe('FormField', () => {
  it('labels the input and passes its attributes through', () => {
    render(<FormField id="password" label="Password" type="password" autoComplete="new-password" />)

    expect(input()).toHaveAttribute('type', 'password')
    expect(input()).toHaveAttribute('name', 'password')
    expect(input()).toHaveAttribute('autocomplete', 'new-password')
    expect(input()).toHaveAttribute('aria-invalid', 'false')
    expect(input()).not.toHaveAttribute('aria-describedby')
  })

  it('reads the hint with the input', () => {
    render(<FormField id="password" label="Password" hint="At least 8 characters." />)

    expect(input()).toHaveAccessibleDescription('At least 8 characters.')
  })

  it('marks the input invalid and reads the message before the hint', () => {
    render(<FormField id="password" label="Password" hint="At least 8 characters." error="Too short" />)

    expect(input()).toHaveAttribute('aria-invalid', 'true')
    expect(input()).toHaveAccessibleDescription('Too short At least 8 characters.')
  })
})
