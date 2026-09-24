import { ArrowRight, CalendarCog, Crown, KeyRound, Mail, ScanFace } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'
import { cn } from '../../lib/utils'
import { DEMO_ACCOUNTS, ROLE_HOME } from '../../services/authService'
import AuthShell from './AuthShell'

const ROLE_ICON = { super_admin: Crown, event_admin: CalendarCog, end_user: ScanFace }

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

  const fill = (a) => {
    setEmail(a.email)
    setPassword(a.password)
    setError('')
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

      <div className="mt-8">
        <div className="flex items-center gap-3 text-[13px] text-navy-400">
          <span className="h-px flex-1 bg-navy-100" />
          Demo accounts · password demo123
          <span className="h-px flex-1 bg-navy-100" />
        </div>
        <div className="mt-4 grid gap-2">
          {DEMO_ACCOUNTS.map((a) => {
            const Icon = ROLE_ICON[a.role]
            const selected = email === a.email
            return (
              <button
                key={a.role}
                type="button"
                onClick={() => fill(a)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                  selected ? 'border-brand-400 bg-brand-50/60 ring-2 ring-brand-500/15' : 'border-navy-100 hover:border-navy-200 hover:bg-navy-50/60',
                )}
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', selected ? 'bg-brand-600 text-white' : 'bg-navy-100 text-navy-700')}>
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-navy-900">{a.label}</span>
                  <span className="block truncate text-[13px] text-navy-500">{a.blurb}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-navy-500">
        New to Genesis Hub?{' '}
        <Link to="/signup" className="font-medium text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
