import { ScanSearch } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/ui/Button'
import Logo from '../../components/ui/Logo'
import { EmptyState } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'
import { ROLE_HOME } from '../../services/authService'

export default function NotFound() {
  useDocumentTitle('Page not found')
  const { user } = useAuth()
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-canvas p-6">
      <Logo />
      <EmptyState
        icon={ScanSearch}
        title="We looked everywhere"
        action={<Button to={user ? ROLE_HOME[user.role] : '/'}>{user ? 'Back to Genesis Hub' : 'Go to the homepage'}</Button>}
        className="self-center"
      >
        This page doesn’t exist, or the link has expired. Even our face search couldn’t find it.
      </EmptyState>
    </div>
  )
}
