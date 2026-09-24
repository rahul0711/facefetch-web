import { ArrowRight, KeyRound, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/ui/Button'
import { Checkbox, Field, Input } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'
import AuthShell from './AuthShell'

export default function Signup() {
  useDocumentTitle('Create account')
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().length < 2) errs.name = 'Tell us your name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    if (form.password.length < 6) errs.password = 'Use at least 6 characters.'
    if (!agree) errs.agree = 'Please accept the terms to continue.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      await signup(form)
      navigate('/events', { replace: true })
    } catch (err) {
      setErrors({ email: err.message })
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold text-navy-950">Find your moments</h1>
      <p className="mt-2 text-navy-500">Create a free account to search the events you attended.</p>
      <form onSubmit={submit} className="mt-8 grid gap-4" noValidate>
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input id="name" icon={User} autoComplete="name" value={form.name} onChange={set('name')} placeholder="Aarav Mehta" aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" icon={Mail} autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@example.com" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 6 characters.">
          <Input id="password" type="password" icon={KeyRound} autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="••••••••" aria-invalid={!!errors.password} />
        </Field>
        <div>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-navy-600">
            <Checkbox checked={agree} onChange={setAgree} className="mt-0.5" label="Accept terms" />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="font-medium text-brand-700 hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-medium text-brand-700 hover:underline">
                Privacy Policy
              </Link>
              , including using my photo to search events I choose.
            </span>
          </label>
          {errors.agree && <p className="mt-1.5 text-[13px] text-bad">{errors.agree}</p>}
        </div>
        <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
          Create account <ArrowRight />
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-navy-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}
