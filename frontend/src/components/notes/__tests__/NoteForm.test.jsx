import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NoteForm from '../NoteForm'
import { NOTE_MAX_LENGTH } from '../../../utils/validation'

function renderForm({ loading = false, onSubmit = vi.fn().mockResolvedValue() } = {}) {
  render(<NoteForm onSubmit={onSubmit} loading={loading} />)
  return onSubmit
}

const input = () => screen.getByLabelText('New note')
const button = () => screen.getByRole('button', { name: /add note|adding/i })
const type = text => fireEvent.change(input(), { target: { value: text } })
// Submitting the form directly, as Enter does, reaches validation even
// when the button is disabled
const submit = () => fireEvent.submit(screen.getByTestId('note-form'))

describe('NoteForm', () => {
  it('labels the input, so it has a name beyond its placeholder', () => {
    renderForm()

    expect(input()).toBe(screen.getByPlaceholderText('Write a note...'))
    expect(input()).toHaveAttribute('maxLength', String(NOTE_MAX_LENGTH))
  })

  it('counts down the characters left', () => {
    renderForm()
    expect(screen.getByText(`${NOTE_MAX_LENGTH} characters remaining`)).toBeInTheDocument()

    type('Hello')

    expect(screen.getByText(`${NOTE_MAX_LENGTH - 5} characters remaining`)).toBeInTheDocument()
  })

  it.each([
    ['empty', '', false],
    ['only whitespace', '   \n\t', false],
    ['has text', 'A note', true],
  ])('enables Add Note only when the note %s', (_, text, enabled) => {
    renderForm()

    type(text)

    expect(button()).toHaveProperty('disabled', !enabled)
  })

  it('submits the trimmed note once, then clears the field', async () => {
    const onSubmit = renderForm()
    type('  My note  ')

    fireEvent.click(button())

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('My note')
    await waitFor(() => expect(input()).toHaveValue(''))
  })

  it('keeps the text when saving fails, so the user can retry', async () => {
    const onSubmit = renderForm({ onSubmit: vi.fn().mockRejectedValue(new Error('500')) })
    type('Keep me')

    submit()

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(input()).toHaveValue('Keep me')
  })

  describe('validation', () => {
    it.each([
      ['a blank note', '   ', 'Note content is required'],
      // maxLength stops typing past it, but not a pasted or scripted value
      ['an over-long note', 'x'.repeat(NOTE_MAX_LENGTH + 1),
        `Note must be at most ${NOTE_MAX_LENGTH} characters`],
    ])('refuses %s and explains why', (_, text, message) => {
      const onSubmit = renderForm()
      type(text)

      submit()

      expect(onSubmit).not.toHaveBeenCalled()
      expect(input()).toHaveAttribute('aria-invalid', 'true')
      expect(input()).toHaveAccessibleDescription(message)
    })

    it('accepts a note of exactly the maximum length', async () => {
      const onSubmit = renderForm()
      type('x'.repeat(NOTE_MAX_LENGTH))

      submit()

      expect(onSubmit).toHaveBeenCalledWith('x'.repeat(NOTE_MAX_LENGTH))
      await waitFor(() => expect(input()).toHaveValue(''))
    })

    it('clears the message as soon as the user types again', () => {
      renderForm()
      type('   ')
      submit()
      expect(screen.getByTestId('note-error')).toBeInTheDocument()

      type('Better')

      expect(screen.queryByTestId('note-error')).not.toBeInTheDocument()
      expect(input()).toHaveAttribute('aria-invalid', 'false')
    })
  })

  it('locks while a note is being saved', () => {
    renderForm({ loading: true })

    expect(input()).toBeDisabled()
    expect(button()).toBeDisabled()
    expect(button()).toHaveTextContent('Adding...')
  })
})
