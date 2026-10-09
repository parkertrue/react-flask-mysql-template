import PageTitle from '@/components/layout/PageTitle'
import { useNotes } from './useNotes'
import NotesList from './NotesList'
import NoteForm from './NoteForm'
import './notes.css'

export default function NotesPage() {
  const {
    notes, loading, loadingMore, hasMore, submitting, error, addNote, loadMore
  } = useNotes()

  return (
    <div className="notes-page">
      <PageTitle>My Notes</PageTitle>
      <h1>My Notes</h1>

      <NoteForm onSubmit={addNote} loading={submitting} />

      {error && <div className="error-message" role="alert">{error}</div>}

      <NotesList notes={notes} loading={loading} />

      {hasMore && !loading && (
        <button
          type="button"
          className="btn btn-secondary btn-block load-more"
          onClick={loadMore}
          aria-disabled={loadingMore}
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
