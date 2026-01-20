export default function NotesList({ notes, loading }) {
  if (loading) {
    return <div>Loading notes...</div>
  }

  if (notes.length === 0) {
    return (
      <div>
        <p>No notes yet. Add your first note!</p>
      </div>
    )
  }

  return (
    <div>
      {notes.map(note => (
        <div key={note.id}>
          {note.content} (#{note.id})
        </div>
      ))}
    </div>
  )
}