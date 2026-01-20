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
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a note..."
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !content.trim()}
        >
          {loading ? 'Adding...' : 'Add Note'}
        </button>
      </div>
    </form>
  )
}