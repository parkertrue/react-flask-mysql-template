export default function NotesList({ notes, loading }) {
  if (loading) {
    return <p className="notes-loading" role="status">Loading notes...</p>
  }

  if (notes.length === 0) {
    return <p className="notes-empty">No notes yet. Add your first note!</p>
  }

  return (
    <ul className="notes-list">
      {notes.map(note => (
        <li key={note.id} className="note-item">
          <span className="note-content">{note.content}</span>
          <span className="note-id">(#{note.id})</span>
        </li>
      ))}
    </ul>
  )
}
