import { useNotes } from '../hooks/useNotes'
import NotesList from '../components/notes/NotesList'
import NoteForm from '../components/notes/NoteForm'

export default function NotesPage() {
  const { notes, loading, error, addNote } = useNotes()

  return (
    <div>
      <h1>My Notes</h1>

      <NoteForm onSubmit={addNote} loading={loading} />

      {error && (
        <div>
          {error}
        </div>
      )}

      <NotesList notes={notes} loading={loading} />
    </div>
  )
}