import { useState } from 'react'
import { validateNoteContent, NOTE_MAX_LENGTH } from '../../utils/validation'

export default function NoteForm({ onSubmit, loading }) {
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate note content
    const errors = validateNoteContent(content)
    if (errors.length > 0) {
      setError(errors[0])
      return
    }

    setError('')

    try {
      await onSubmit(content.trim())
      setContent('')
    } catch (err) {
      // Error handled by parent
    }
  }

  const handleChange = (e) => {
    const value = e.target.value
    setContent(value)
    
    // Clear error when user starts typing
    if (error) {
      setError('')
    }
  }

  const remainingChars = NOTE_MAX_LENGTH - content.length

  return (
    <form onSubmit={handleSubmit} className="note-form" data-testid="note-form">
      <div className="note-form-group">
        <input
          type="text"
          value={content}
          onChange={handleChange}
          placeholder="Write a note..."
          disabled={loading}
          className={`note-input ${error ? 'error' : ''}`}
          data-testid="note-input"
          aria-invalid={!!error}
          aria-describedby={error ? 'note-error' : undefined}
          maxLength={NOTE_MAX_LENGTH}
        />
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="btn btn-primary"
          data-testid="note-submit"
        >
          {loading ? 'Adding...' : 'Add Note'}
        </button>
      </div>
      
      <div className="note-form-footer">
        {error && (
          <div className="field-error" id="note-error" data-testid="note-error">
            {error}
          </div>
        )}
        <div className="char-counter">
          {remainingChars} characters remaining
        </div>
      </div>
    </form>
  )
}