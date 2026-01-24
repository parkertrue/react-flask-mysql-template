import { useState } from 'react'

export default function NoteForm({ onSubmit, loading }) {
  const [content, setContent] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!content.trim()) return

    try {
      await onSubmit(content)
      setContent('')
    } catch (err) {
      // Error handled by parent
    }
  }

  return (
    <form onSubmit={handleSubmit} className="note-form" data-testid="note-form">
      <div className="note-form-group">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a note..."
          disabled={loading}
          className="note-input"
          data-testid="note-input"
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
    </form>
  )
}