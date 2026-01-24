import { useNotes } from '../hooks/useNotes'
import NotesList from '../components/notes/NotesList'
import NoteForm from '../components/notes/NoteForm'

export default function NotesPage() {
  const { notes, loading, error, addNote } = useNotes()

  return (
    <div className="notes-page">
      <div className="notes-container">
        <h1>My Notes</h1>

        <NoteForm onSubmit={addNote} loading={loading} />

        {error && (
          <div className="error-message" data-testid="error-message">
            {error}
          </div>
        )}

        <NotesList notes={notes} loading={loading} />
      </div>
    </div>
  )
}