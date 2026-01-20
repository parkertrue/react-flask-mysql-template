import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div style={{ padding: 20 }}>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  )
}