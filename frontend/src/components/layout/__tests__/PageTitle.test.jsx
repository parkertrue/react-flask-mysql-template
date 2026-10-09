import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PageTitle from '../PageTitle'

describe('PageTitle', () => {
  it.each([
    ['names the page, then the app', 'Login', 'Login | React + Flask Template'],
    ['is just the app name without a page name', undefined, 'React + Flask Template'],
  ])('%s', (_, name, title) => {
    render(<PageTitle>{name}</PageTitle>)

    expect(document.title).toBe(title)
  })
})
