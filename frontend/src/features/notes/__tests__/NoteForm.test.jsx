import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NoteForm from '../NoteForm'
import { NOTE_MAX_LENGTH } from '../validation'

function renderForm({ loading = false, onSubmit = vi.fn().mockResolvedValue() } = {}) {
  render(<NoteForm onSubmit={onSubmit} loading={loading} />)
  return { onSubmit, user: userEvent.setup() }
}

const input = () => screen.getByLabelText('New note')
const button = () => screen.getByRole('button', { name: /add note|adding/i })
// Sets the value outright, as a paste or a script can, past maxLength too
const setValue = text => fireEvent.change(input(), { target: { value: text } })

describe('NoteForm', () => {
  it('labels the input, so it has a name beyond its placeholder', () => {
    renderForm()

    expect(input()).toBe(screen.getByPlaceholderText('Write a note...'))
    expect(input()).toHaveAttribute('maxLength', String(NOTE_MAX_LENGTH))
  })

  it('counts down the characters left', async () => {
    const { user } = renderForm()
    expect(screen.getByText(`${NOTE_MAX_LENGTH} characters remaining`)).toBeInTheDocument()

    await user.type(input(), 'Hello')

    expect(screen.getByText(`${NOTE_MAX_LENGTH - 5} characters remaining`)).toBeInTheDocument()
  })

  it('submits the trimmed note on Enter, then clears the field', async () => {
    const { onSubmit, user } = renderForm()

    await user.type(input(), '  My note  {Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('My note')
    await waitFor(() => expect(input()).toHaveValue(''))
  })

  it('keeps the text when saving fails, so the user can retry', async () => {
    const { onSubmit, user } = renderForm({ onSubmit: vi.fn().mockRejectedValue(new Error('500')) })
    await user.type(input(), 'Keep me')

    await user.click(button())

    expect(onSubmit).toHaveBeenCalled()
    expect(input()).toHaveValue('Keep me')
  })

  describe('validation', () => {
    it.each([
      ['an empty note', '', 'Note content is required'],
      ['a blank note', '   ', 'Note content is required'],
      // maxLength stops typing past it, but not a pasted or scripted value
      ['an over-long note', 'x'.repeat(NOTE_MAX_LENGTH + 1),
        `Note must be at most ${NOTE_MAX_LENGTH} characters`],
    ])('refuses %s, explains why, and focuses the field', async (_, text, message) => {
      const { onSubmit, user } = renderForm()
      if (text) setValue(text)

      await user.click(button())

      expect(onSubmit).not.toHaveBeenCalled()
      expect(input()).toHaveAttribute('aria-invalid', 'true')
      expect(input()).toHaveAccessibleDescription(message)
      expect(input()).toHaveFocus()
    })

    it('accepts a note of exactly the maximum length', async () => {
      const { onSubmit, user } = renderForm()
      setValue('x'.repeat(NOTE_MAX_LENGTH))

      await user.click(button())

      expect(onSubmit).toHaveBeenCalledWith('x'.repeat(NOTE_MAX_LENGTH))
      await waitFor(() => expect(input()).toHaveValue(''))
    })

    it('clears the message as soon as the user types again', async () => {
      const { user } = renderForm()
      await user.click(button())
      expect(input()).toHaveAttribute('aria-invalid', 'true')

      await user.type(input(), 'Better')

      expect(input()).toHaveAttribute('aria-invalid', 'false')
      expect(input()).not.toHaveAccessibleDescription()
    })
  })

  it('stays focusable but refuses another submit while a note is being saved', async () => {
    const { onSubmit, user } = renderForm({ loading: true })
    setValue('Second note')

    await user.click(button())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(button()).toHaveTextContent('Adding...')
    expect(button()).toHaveAttribute('aria-disabled', 'true')
    expect(button()).toHaveFocus()
    expect(input()).toHaveAttribute('readonly')
  })
})
