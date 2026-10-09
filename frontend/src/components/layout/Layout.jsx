import { useEffect, useRef } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const shownPath = useRef(pathname)

  // Changing pages in an SPA leaves focus on the link just used, so a screen
  // reader announces nothing. Focus the new page's content instead, where a
  // full page load would start. The first page keeps the browser's default.
  useEffect(() => {
    if (shownPath.current === pathname) return
    shownPath.current = pathname
    mainRef.current.focus()
  }, [pathname])

  return (
    <div className="layout">
      <Navbar />
      <main className="main-content" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  )
}
