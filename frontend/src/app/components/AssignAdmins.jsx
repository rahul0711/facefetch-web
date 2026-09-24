import { Check, ChevronDown, Search, ShieldCheck, UserPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '../lib/hooks'
import { cn } from '../lib/utils'
import { PERMISSIONS } from '../data/seed'
import { db } from '../services/db'
import { listEventAssignments, setEventAdmins } from '../services/eventService'
import { listUsers } from '../services/userService'
import Button from './ui/Button'
import { Drawer, Modal, useToast } from './ui/overlay'
import { Avatar, Badge, Checkbox, Input, Skeleton, Switch } from './ui/primitives'

const DEFAULT_PERMS = { view: true, upload: true, manage: true, analytics: true, settings: false }

// Pick admins for one event and set their event-level permissions.
export function AssignAdminsPanel({ event, onDone, onCancel, compact }) {
  const toast = useToast()
  const { data: admins, loading } = useQuery(() => listUsers({ role: 'event_admin' }), [], { live: false })
  const { data: current } = useQuery(() => listEventAssignments(event.id), [event.id], { live: false })
  const [sel, setSel] = useState(null) // userId -> perms
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (current && sel === null) setSel(Object.fromEntries(current.map((a) => [a.userId, { ...a.perms }])))
  }, [current, sel])

  const filtered = useMemo(
    () => (admins || []).filter((a) => `${a.name} ${a.email}`.toLowerCase().includes(q.toLowerCase())),
    [admins, q],
  )
  const selected = sel ? Object.keys(sel) : []
  const before = new Set((current || []).map((a) => a.userId))
  const added = selected.filter((id) => !before.has(id))
  const removed = [...before].filter((id) => !sel?.[id])
  const dirty = sel && (added.length || removed.length || selected.some((id) => JSON.stringify(sel[id]) !== JSON.stringify(current.find((c) => c.userId === id)?.perms)))
  const nameOf = (id) => admins?.find((a) => a.id === id)?.name

  const toggle = (id) =>
    setSel((s) => {
      const next = { ...s }
      if (next[id]) delete next[id]
      else {
        next[id] = { ...DEFAULT_PERMS }
        setOpen(id)
      }
      return next
    })

  const save = async () => {
    setSaving(true)
    await setEventAdmins(event.id, selected.map((userId) => ({ userId, perms: sel[userId] })))
    setSaving(false)
    setConfirm(false)
    toast(`Event admins updated`, { description: `${selected.length} admin${selected.length === 1 ? '' : 's'} can manage ${event.name}.` })
    onDone?.()
  }

  return (
    <div className="flex h-full flex-col">
      <div className={cn('grid gap-3', compact ? 'px-6 pt-5' : '')}>
        <Input icon={Search} placeholder="Search admins by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search admins" />
      </div>
      <ul className={cn('mt-4 grid flex-1 content-start gap-2 overflow-y-auto', compact && 'px-6 pb-4')}>
        {loading || !sel
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)
          : filtered.map((a) => {
              const on = !!sel[a.id]
              const expanded = on && open === a.id
              const events = a.assignedEvents.map((id) => db().events.find((e) => e.id === id)?.name).filter(Boolean)
              return (
                <li key={a.id} className={cn('rounded-xl border transition-colors', on ? 'border-brand-300 bg-brand-50/40' : 'border-navy-100 bg-white')}>
                  <div className="flex items-center gap-3 p-3">
                    <Checkbox checked={on} onChange={() => toggle(a.id)} label={`Assign ${a.name}`} />
                    <Avatar user={a} size={40} />
                    <button type="button" onClick={() => on && setOpen(expanded ? null : a.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-navy-900">{a.name}</span>
                        {a.status !== 'Active' && <Badge tone="warn">{a.status}</Badge>}
                      </span>
                      <span className="block truncate text-[13px] text-navy-500">{a.email}</span>
                      <span className="block truncate text-[12px] text-navy-400">{events.length ? `${events.length} event${events.length > 1 ? 's' : ''}: ${events.join(', ')}` : 'No events yet'}</span>
                    </button>
                    {on && (
                      <button type="button" onClick={() => setOpen(expanded ? null : a.id)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-brand-700 hover:bg-brand-50" aria-expanded={expanded}>
                        Access <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
                      </button>
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mx-3 mb-3 grid gap-3 rounded-lg bg-white p-3 ring-1 ring-navy-100">
                          <p className="flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-navy-500 uppercase">
                            <ShieldCheck className="size-3.5" /> Event admin access for {event.name}
                          </p>
                          {PERMISSIONS.map((p) => (
                            <Switch
                              key={p.key}
                              label={p.label}
                              description={p.hint}
                              checked={sel[a.id][p.key]}
                              disabled={p.key === 'view'}
                              onChange={(v) => setSel((s) => ({ ...s, [a.id]: { ...s[a.id], [p.key]: v } }))}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
        {!loading && sel && !filtered.length && <li className="py-8 text-center text-sm text-navy-400">No admins match “{q}”.</li>}
      </ul>
      <div className={cn('flex items-center justify-between gap-3 border-t border-navy-100 pt-4', compact ? 'px-6 pb-safe' : 'mt-4')}>
        <span className="text-sm text-navy-500">{selected.length} selected</span>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={() => setConfirm(true)} disabled={!dirty}>
            <UserPlus /> Save access
          </Button>
        </div>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirm event admin access"
        description={event.name}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Back
            </Button>
            <Button onClick={save} loading={saving}>
              <Check /> Confirm
            </Button>
          </>
        }
      >
        <div className="grid gap-4 text-sm">
          <div>
            <p className="font-medium text-navy-900">Assigned admins</p>
            <ul className="mt-2 grid gap-2">
              {selected.map((id) => (
                <li key={id} className="flex items-center gap-2.5">
                  <Avatar user={admins.find((a) => a.id === id)} size={28} />
                  <span className="text-navy-800">{nameOf(id)}</span>
                  {added.includes(id) && <Badge tone="brand">New</Badge>}
                  <span className="ml-auto text-[12px] text-navy-400">{PERMISSIONS.filter((p) => sel[id][p.key]).length}/5 permissions</span>
                </li>
              ))}
              {!selected.length && <li className="text-navy-500">No admins. Only Super Admins will be able to manage this event.</li>}
            </ul>
          </div>
          {removed.length > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-amber-900 ring-1 ring-amber-200">
              {removed.map(nameOf).join(', ')} will lose access to this event.
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}

export function AssignAdminsDrawer({ event, open, onClose }) {
  return (
    <Drawer open={open} onClose={onClose} title="Assign event admins" description={event?.name} className="max-w-lg">
      {event && <AssignAdminsPanel event={event} compact onDone={onClose} onCancel={onClose} />}
    </Drawer>
  )
}
