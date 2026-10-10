import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { validateNoteContent, NOTE_MAX_LENGTH } from './validation'

// Adds a note by default; NoteItem passes an id, labels, the note's content
// and onCancel to edit one in place
export default function NoteForm({
  onSubmit,
  submitting,
  id = 'note-input',
  label = 'New note',
  submitLabel = 'Add Note',
  busyLabel = 'Adding...',
  initialContent = '',
  onCancel,
}) {
  const [content, setContent] = useState(initialContent)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const errorId = `${id}-error`

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

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
    setContent(e.target.value)
    setError('')
  }

  // Escape anywhere in the edit form cancels it, as it would a dialog
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && onCancel && !submitting) onCancel()
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="note-form">
      <label htmlFor={id} className="form-label">{label}</label>
      <div className="note-form-group">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={content}
          onChange={handleChange}
          maxLength={NOTE_MAX_LENGTH}
          placeholder="Write a note..."
          readOnly={submitting}
          // Only the edit form, which opens on request, takes focus at once
          autoFocus={!!onCancel}
          className="form-input"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" aria-disabled={submitting} className="btn btn-primary">
          {submitting ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            aria-disabled={submitting}
            className="btn btn-secondary"
            onClick={() => { if (!submitting) onCancel() }}
          >
            Cancel
          </button>
        )}
      </div>

      <div className="note-form-footer">
        {error && <p className="field-error" id={errorId}>{error}</p>}
        <p className="char-counter">
          {NOTE_MAX_LENGTH - content.length} characters remaining
        </p>
      </div>
    </form>
  )
}
