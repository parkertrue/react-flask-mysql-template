// A labelled input with an optional hint and its validation message. The
// message marks the input invalid, and screen readers read it, then the
// hint, along with the label. Children (such as a form's buttons) sit on
// the input's line. The name defaults to the id, which must be unique on the
// page; pass a name when several forms hold the same field.
export default function FormField({ id, name = id, label, error, hint, children, ...inputProps }) {
  const errorId = error ? `${id}-error` : null
  const hintId = hint ? `${id}-hint` : null

  const input = (
    <input
      id={id}
      name={name}
      className="form-input"
      aria-invalid={!!error}
      aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
      {...inputProps}
    />
  )

  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label}</label>
      {children ? <div className="form-row">{input}{children}</div> : input}
      {hint && <p id={hintId} className="form-hint">{hint}</p>}
      {error && <p id={errorId} className="field-error">{error}</p>}
    </div>
  )
}
