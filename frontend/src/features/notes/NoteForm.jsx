import FormField from '@/components/forms/FormField'
import { useFormFields } from '@/components/forms/useFormFields'
import { validateNoteContent, NOTE_MAX_LENGTH } from './validation'

// Adds a note by default; NoteItem passes an id, labels, the note's content
// and onCancel to edit one in place
export default function NoteForm({
  onSubmit,
  submitting,
  id = 'note-input',
  label = 'New note',
  submitLabel = 'Add Note',
  busyLabel = 'Adding...',
  initialContent = '',
  onCancel,
}) {
  const { values, errors, handleChange, validate, reset } = useFormFields({ content: initialContent })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!validate(e.currentTarget, { content: validateNoteContent(values.content)[0] })) return

    try {
      await onSubmit(values.content.trim())
      reset()
    } catch {
      // The parent shows the error; keep the text so the user can retry
    }
  }

  // Escape anywhere in the edit form cancels it, as it would a dialog
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && onCancel && !submitting) onCancel()
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="note-form">
      <FormField
        id={id}
        name="content"
        label={label}
        type="text"
        value={values.content}
        onChange={handleChange}
        maxLength={NOTE_MAX_LENGTH}
        placeholder="Write a note..."
        readOnly={submitting}
        // Only the edit form, which opens on request, takes focus at once
        autoFocus={!!onCancel}
        error={errors.content}
        // Read with the input, so a screen reader hears why typing stops
        hint={`${NOTE_MAX_LENGTH - values.content.length} characters remaining`}
      >
        <button type="submit" aria-disabled={submitting} className="btn btn-primary">
          {submitting ? busyLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            aria-disabled={submitting}
            className="btn btn-secondary"
            onClick={() => { if (!submitting) onCancel() }}
          >
            Cancel
          </button>
        )}
      </FormField>
    </form>
  )
}
