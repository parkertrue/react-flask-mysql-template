import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFormFields } from '../useFormFields'

const typeInto = (result, name, value) =>
  act(() => result.current.handleChange({ target: { name, value } }))

describe('useFormFields', () => {
  it.each([
    ['the starting values', undefined, { content: 'Start' }],
    ['the values given', { content: 'Next' }, { content: 'Next' }],
  ])('reset goes back to %s, with no messages', (_, nextValues, expected) => {
    const { result } = renderHook(() => useFormFields({ content: 'Start' }))
    typeInto(result, 'content', 'Typed')
    const form = { elements: { content: { focus: () => {} } } }
    act(() => { result.current.validate(form, { content: 'Too short' }) })
    expect(result.current.errors).toEqual({ content: 'Too short' })

    act(() => result.current.reset(nextValues))

    expect(result.current.values).toEqual(expected)
    expect(result.current.errors).toEqual({})
  })
})
