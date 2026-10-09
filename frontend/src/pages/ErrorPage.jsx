import { Link } from 'react-router-dom'
import PageTitle from '@/components/layout/PageTitle'

// The router shows this when a page throws while rendering. The link
// reloads the app, since whatever broke may still be in memory.
export default function ErrorPage() {
  return (
    <div className="message-page">
      <PageTitle>Something went wrong</PageTitle>
      <h1>Something went wrong</h1>
      <p>This page hit an unexpected error.</p>
      <Link to="/" reloadDocument className="btn btn-primary">Go home</Link>
    </div>
  )
}
