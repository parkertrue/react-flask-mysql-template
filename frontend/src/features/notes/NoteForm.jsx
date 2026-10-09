import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { charCount, limitChars } from '@/utils/validation'
import { validateNoteContent, NOTE_MAX_LENGTH } from './validation'

export default function NoteForm({ onSubmit, loading }) {
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    const message = validateNoteContent(content)[0]
    if (message) {
      // Rendered before focusing, so a screen reader reads the message
      flushSync(() => setError(message))
      inputRef.current.focus()
      return
    }

    try {
      await onSubmit(content.trim())
      setContent('')
    } catch {
      // The parent shows the error; keep the text so the user can retry
    }
  }

  const handleChange = (e) => {
    // Stops at the limit like maxLength, but counting characters as the
    // backend does, so a note of emoji gets the whole limit
    setContent(limitChars(content, e.target.value, NOTE_MAX_LENGTH))
    setError('')
  }

  // While saving, the input is read-only and the button aria-disabled rather
  // than disabled: a disabled element drops keyboard focus
  return (
    <form onSubmit={handleSubmit} noValidate className="note-form">
      <label htmlFor="note-input" className="form-label">New note</label>
      <div className="note-form-group">
        <input
          ref={inputRef}
          id="note-input"
          type="text"
          value={content}
          onChange={handleChange}
          placeholder="Write a note..."
          readOnly={loading}
          className="form-input"
          aria-invalid={!!error}
          aria-describedby={error ? 'note-error' : undefined}
        />
        <button type="submit" aria-disabled={loading} className="btn btn-primary">
          {loading ? 'Adding...' : 'Add Note'}
        </button>
      </div>

      <div className="note-form-footer">
        {error && <p className="field-error" id="note-error">{error}</p>}
        <p className="char-counter">
          {NOTE_MAX_LENGTH - charCount(content)} characters remaining
        </p>
      </div>
    </form>
  )
}
