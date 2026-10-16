import { NavLink } from 'react-router-dom'

// On every page, so the privacy notice, the terms and the operator's contact
// details are always one step away
export default function Footer() {
  return (
    <footer className="footer">
      <nav aria-label="Legal" className="footer-links">
        <NavLink to="/privacy" className="footer-link">Privacy</NavLink>
        <NavLink to="/terms" className="footer-link">Terms</NavLink>
        <NavLink to="/contact" className="footer-link">Contact</NavLink>
      </nav>
    </footer>
  )
}
