import { useNotes } from '../hooks/useNotes'
import NotesList from '../components/notes/NotesList'
import NoteForm from '../components/notes/NoteForm'

export default function NotesPage() {
  const {
    notes, loading, loadingMore, hasMore, submitting, error, addNote, loadMore
  } = useNotes()

  return (
    <div className="notes-page">
      <div className="notes-container">
        <h1>My Notes</h1>

        <NoteForm onSubmit={addNote} loading={submitting} />

        {error && (
          <div className="error-message" data-testid="error-message">
            {error}
          </div>
        )}

        <NotesList notes={notes} loading={loading} />

        {hasMore && !loading && (
          <button
            type="button"
            className="btn btn-secondary btn-block load-more"
            data-testid="load-more"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}