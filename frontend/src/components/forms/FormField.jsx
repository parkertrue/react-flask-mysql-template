// A labelled input with an optional hint and its validation message. The
// message marks the input invalid, and screen readers read it, then the
// hint, along with the label.
export default function FormField({ id, label, error, hint, ...inputProps }) {
  const errorId = error ? `${id}-error` : null
  const hintId = hint ? `${id}-hint` : null

  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}</label>
      <input
        id={id}
        name={id}
        className="form-input"
        aria-invalid={!!error}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        {...inputProps}
      />
      {hint && <p id={hintId} className="form-hint">{hint}</p>}
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  )
}
