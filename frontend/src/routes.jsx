import Layout from '@/components/layout/Layout'
import GuestRoute from '@/auth/GuestRoute'
import ProtectedRoute from '@/auth/ProtectedRoute'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import AccountPage from '@/pages/AccountPage'
import NotFoundPage from '@/pages/NotFoundPage'
import ErrorPage from '@/pages/ErrorPage'
import NotesPage from '@/features/notes/NotesPage'

export const routes = [
  {
    path: '/',
    element: <Layout />,
    // A crash in the layout itself: the error page replaces everything
    errorElement: <ErrorPage />,
    children: [
      {
        // A crash in a page: the error page takes its place under the navbar
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <GuestRoute />,
            children: [
              { path: 'login', element: <LoginPage /> },
              { path: 'register', element: <RegisterPage /> },
            ],
          },
          {
            element: <ProtectedRoute />,
            children: [
              { path: 'notes', element: <NotesPage /> },
              { path: 'account', element: <AccountPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
