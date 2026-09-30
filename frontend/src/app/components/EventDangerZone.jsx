import { Power, PowerOff, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deactivateEvent, deleteEvent, reactivateEvent } from '../services/eventService'
import Button from './ui/Button'
import { Modal, useToast } from './ui/overlay'
import { Field, Input } from './ui/primitives'

// Deactivating hides an event from guests (status Archived) and keeps
// everything; reactivating makes it Active again. Deleting removes the event
// and all its photos for good, so it asks for the event code first.

export const isInactive = (ev) => ev.status === 'Archived'

/** The confirm dialog for one action: 'deactivate' | 'reactivate' | 'delete'. */
export function EventActionDialog({ ev, action, onClose, onDone }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')
  const open = !!ev && !!action
  const close = () => {
    setTyped('')
    onClose()
  }

  const run = async () => {
    setBusy(true)
    try {
      if (action === 'delete') {
        const r = await deleteEvent(ev.eventId)
        toast(`${ev.name} deleted`, { description: `${r.deletedPhotos} photo${r.deletedPhotos === 1 ? '' : 's'} removed.` })
      } else if (action === 'deactivate') {
        await deactivateEvent(ev.eventId)
        toast(`${ev.name} deactivated`, { description: 'Guests can no longer open or search it.' })
      } else {
        await reactivateEvent(ev.eventId)
        toast(`${ev.name} is live again`, { tone: 'success', description: 'Guests can open and search it.' })
      }
      setTyped('')
      onDone?.(action)
    } catch (e) {
      toast(e.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const copy = {
    deactivate: {
      title: `Deactivate ${ev?.name}?`,
      body: 'Guests won’t be able to open or search this event. Photos, visitors and analytics are kept, and you can reactivate it any time.',
      button: 'Deactivate',
      icon: PowerOff,
    },
    reactivate: {
      title: `Reactivate ${ev?.name}?`,
      body: 'The event becomes Active again: guests can open it and search for their photos.',
      button: 'Reactivate',
      icon: Power,
    },
    delete: {
      title: `Delete ${ev?.name}?`,
      body: 'This permanently deletes the event with all of its photos, detected faces, guest searches, visitors and download history. It can’t be undone.',
      button: 'Delete event',
      icon: Trash2,
    },
  }[action || 'deactivate']
  const Icon = copy.icon
  const confirmOk = action !== 'delete' || typed.trim() === ev?.code

  return (
    <Modal
      open={open}
      onClose={close}
      title={copy.title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant={action === 'reactivate' ? 'primary' : 'destructive'} loading={busy} disabled={!confirmOk} onClick={run}>
            {!busy && <Icon />} {copy.button}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-navy-600">{copy.body}</p>
        {action === 'delete' && (
          <Field label={`Type ${ev?.code} to confirm`} htmlFor="confirm-delete">
            <Input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={ev?.code} autoComplete="off" spellCheck={false} data-autofocus />
          </Field>
        )}
      </div>
    </Modal>
  )
}

/** "Danger zone" card for an event page: deactivate / reactivate, and delete. */
export default function EventDangerZone({ ev, canManage, canDelete, onDeleted, onChanged }) {
  const [action, setAction] = useState(null)
  if (!canManage && !canDelete) return null
  const inactive = isInactive(ev)
  return (
    <section className="overflow-hidden rounded-2xl border border-red-200 bg-white">
      <h2 className="border-b border-red-100 bg-red-50/60 px-5 py-3 text-sm font-semibold text-red-800">Danger zone</h2>
      <div className="divide-y divide-navy-100">
        {canManage && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-medium text-navy-900">{inactive ? 'Reactivate this event' : 'Deactivate this event'}</p>
              <p className="text-[13px] text-navy-500">
                {inactive ? 'It’s hidden from guests right now. Reactivate to let them search again.' : 'Hides it from guests. Photos, visitors and analytics are kept.'}
              </p>
            </div>
            {inactive ? (
              <Button variant="secondary" onClick={() => setAction('reactivate')}>
                <Power /> Reactivate
              </Button>
            ) : (
              <Button variant="destructive-ghost" onClick={() => setAction('deactivate')} className="ring-1 ring-red-200">
                <PowerOff /> Deactivate
              </Button>
            )}
          </div>
        )}
        {canDelete && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-medium text-navy-900">Delete this event</p>
              <p className="text-[13px] text-navy-500">Permanently removes the event and all of its photos. This can’t be undone.</p>
            </div>
            <Button variant="destructive" onClick={() => setAction('delete')}>
              <Trash2 /> Delete event
            </Button>
          </div>
        )}
      </div>
      <EventActionDialog
        ev={ev}
        action={action}
        onClose={() => setAction(null)}
        onDone={(a) => {
          setAction(null)
          if (a === 'delete') onDeleted?.()
          else onChanged?.()
        }}
      />
    </section>
  )
}
