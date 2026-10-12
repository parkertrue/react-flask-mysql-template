import NoteItem from './NoteItem'

export default function NotesList({ ref, notes, loading, onEdit, onDelete, emptiedFocusRef }) {
  // Not a live region: the page's status line announces the load
  if (loading) {
    return <p className="notes-loading">Loading notes...</p>
  }

  if (notes.length === 0) {
    return <p className="notes-empty">No notes yet. Add your first note!</p>
  }

  return (
    <ul ref={ref} className="notes-list">
      {notes.map(note => (
        <NoteItem
          key={note.id}
          note={note}
          onEdit={onEdit}
          onDelete={onDelete}
          emptiedFocusRef={emptiedFocusRef}
        />
      ))}
    </ul>
  )
}
