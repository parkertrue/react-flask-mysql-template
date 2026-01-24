export default function NotesList({ notes, loading }) {
  if (loading) {
    return <div className="notes-loading" data-testid="notes-loading">Loading notes...</div>
  }

  if (notes.length === 0) {
    return (
      <div className="notes-empty" data-testid="notes-empty">
        <p>No notes yet. Add your first note!</p>
      </div>
    )
  }

  return (
    <div className="notes-list" data-testid="notes-list">
      {notes.map(note => (
        <div key={note.id} className="note-item" data-testid="note-item">
          <span className="note-content">{note.content}</span>
          <span className="note-id">(#{note.id})</span>
        </div>
      ))}
    </div>
  )
}