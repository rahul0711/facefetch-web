import { ArrowRight, KeyRound, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'
import { ROLE_HOME } from '../../services/authService'
import AuthShell from './AuthShell'

export default function Login() {
  useDocumentTitle('Log in')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const s = await login(email, password)
      navigate(params.get('next') || ROLE_HOME[s.user.role], { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold text-navy-950">Welcome back</h1>
      <p className="mt-2 text-navy-500">Log in to find your photos or manage your events.</p>

      <form onSubmit={submit} className="mt-8 grid gap-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" icon={Mail} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required aria-invalid={!!error} />
        </Field>
        <Field label="Password" htmlFor="password" error={error}>
          <Input id="password" type="password" icon={KeyRound} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required aria-invalid={!!error} />
        </Field>
        <Button type="submit" size="lg" loading={loading} disabled={!email || !password} className="mt-1 w-full">
          Log in <ArrowRight />
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-navy-500">
        Looking for your photos?{' '}
        <Link to="/events" className="font-medium text-brand-700 hover:underline">
          No account needed
        </Link>
      </p>
    </AuthShell>
  )
}
