import { CircleAlert, FolderOpen, Link2, Search } from 'lucide-react'
import { useState } from 'react'
import Button from '../../components/ui/Button'
import DriveIcon from '../../components/ui/DriveIcon'
import { Modal } from '../../components/ui/overlay'
import { Checkbox, Field, Input } from '../../components/ui/primitives'
import { fileSize, num } from '../../lib/utils'
import { listDriveFolder } from '../../services/photoService'

/**
 * Paste a Drive link -> see what's in it -> import. onImport(files) receives
 * only the photos that aren't in this event yet; the Photos page runs the
 * import with its usual progress panel.
 */
export default function DriveImportDialog({ eventId, open, onClose, onImport }) {
  const [url, setUrl] = useState('')
  const [subfolders, setSubfolders] = useState(true)
  const [finding, setFinding] = useState(false)
  const [error, setError] = useState(null)
  const [found, setFound] = useState(null)

  const reset = () => {
    setFound(null)
    setError(null)
  }
  const close = () => {
    reset()
    setUrl('')
    onClose()
  }

  const find = async (e) => {
    e?.preventDefault()
    if (!url.trim()) return
    setFinding(true)
    reset()
    try {
      setFound(await listDriveFolder(eventId, url, subfolders))
    } catch (err) {
      setError(err.message)
    } finally {
      setFinding(false)
    }
  }

  const fresh = found?.files.filter((f) => !f.alreadyImported) || []
  const already = (found?.files.length || 0) - fresh.length
  const bytes = fresh.reduce((a, f) => a + (f.size || 0), 0)

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import from Google Drive"
      description="Paste a link to a Drive folder or photo. Every photo is downloaded, and every face in it is indexed."
      footer={
        found && fresh.length ? (
          <>
            <Button variant="secondary" onClick={reset}>
              Back
            </Button>
            <Button
              onClick={() => {
                onImport(fresh)
                close()
              }}
            >
              <DriveIcon className="size-4" /> Import {num(fresh.length)} photo{fresh.length === 1 ? '' : 's'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form="drive-form" loading={finding} disabled={!url.trim()}>
              {!finding && <Search />} Find photos
            </Button>
          </>
        )
      }
    >
      {!found ? (
        <form id="drive-form" onSubmit={find} className="grid gap-4" noValidate>
          <Field label="Google Drive link" htmlFor="drive-url" error={error}>
            <Input
              id="drive-url"
              icon={Link2}
              data-autofocus
              value={url}
              onChange={(e) => (setUrl(e.target.value), setError(null))}
              placeholder="https://drive.google.com/drive/folders/…"
              aria-invalid={!!error}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-navy-700">
            <Checkbox checked={subfolders} onChange={setSubfolders} label="Include subfolders" />
            Include photos in subfolders
          </label>
          <div className="rounded-xl bg-navy-50 p-4 text-[13px] leading-relaxed text-navy-600">
            <p className="font-medium text-navy-900">Before you paste the link</p>
            In Google Drive, open <span className="font-medium">Share</span>, set <span className="font-medium">General access</span> to{' '}
            <span className="font-medium">Anyone with the link</span>, then <span className="font-medium">Copy link</span>. JPG, PNG and WEBP photos are imported; videos and other files are skipped.
          </div>
        </form>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-navy-100 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-navy-50">
              {found.isFolder ? <FolderOpen className="size-5 text-brand-600" /> : <DriveIcon className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-navy-950">{found.name}</p>
              <p className="text-[13px] text-navy-500">
                {num(found.files.length)} photo{found.files.length === 1 ? '' : 's'}
                {bytes > 0 && ` · ${fileSize(bytes)} to import`}
              </p>
            </div>
          </div>

          <ul className="grid gap-1.5 text-[13px]">
            {already > 0 && (
              <li className="text-navy-600">
                {num(already)} already in this event, so {already === 1 ? 'it' : 'they'} will be skipped.
              </li>
            )}
            {found.skipped > 0 && (
              <li className="text-navy-600">
                {num(found.skipped)} file{found.skipped === 1 ? ' isn’t a' : 's aren’t'} JPG, PNG or WEBP photo{found.skipped === 1 ? '' : 's'} (videos, documents, HEIC…) and will be skipped.
              </li>
            )}
            {found.truncated && (
              <li className="flex gap-1.5 text-warn">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> Very large folder: only the first 5,000 files were read. Import the rest from its subfolders.
              </li>
            )}
          </ul>

          {fresh.length ? (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-navy-100">
              <ul className="divide-y divide-navy-100 text-[13px]">
                {fresh.slice(0, 200).map((f) => (
                  <li key={f.id} className="flex justify-between gap-3 px-3 py-2">
                    <span className="truncate text-navy-800">
                      <span className="text-navy-400">{f.path}</span>
                      {f.name}
                    </span>
                    {f.size > 0 && <span className="shrink-0 text-navy-400 tabular-nums">{fileSize(f.size)}</span>}
                  </li>
                ))}
                {fresh.length > 200 && <li className="px-3 py-2 text-navy-400">…and {num(fresh.length - 200)} more</li>}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl bg-navy-50 p-4 text-sm text-navy-600">
              {found.files.length ? 'Every photo in this link is already in the event.' : 'No JPG, PNG or WEBP photos found at this link.'}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
