import { Check, Copy, Mail, MessageCircle, Share2 } from 'lucide-react'
import { useState } from 'react'
import { copyText } from '../lib/utils'
import { shareLink } from '../services/searchService'
import Photo from './Photo'
import Button from './ui/Button'
import { Modal } from './ui/overlay'

// Mock sharing: generates a believable link; nothing is actually published.
export default function ShareModal({ open, onClose, event, photo, count }) {
  const [copied, setCopied] = useState(false)
  if (!event) return null
  const link = shareLink(event, photo)
  const text = photo ? `My photo from ${event.name}` : `My ${count ?? ''} photos from ${event.name}`.replace('  ', ' ')

  const copy = async () => {
    if (await copyText(link)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={photo ? 'Share this photo' : 'Share your moments'} description="Anyone with the link can view it.">
      {photo && (
        <div className="mb-5 overflow-hidden rounded-2xl ring-1 ring-navy-100">
          <Photo photo={photo} ratio={`${photo.width} / ${photo.height}`} className="max-h-72" />
        </div>
      )}
      <label className="text-sm font-medium text-navy-800" htmlFor="share-link">
        Share link
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="share-link"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="h-11 min-w-0 flex-1 rounded-[10px] border border-navy-200 bg-navy-50 px-3.5 font-mono text-[13px] text-navy-700 outline-none focus:border-brand-500"
        />
        <Button onClick={copy} variant={copied ? 'dark' : 'primary'} className="h-11 w-28">
          {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-2 rounded-xl border border-navy-100 py-4 text-[13px] font-medium text-navy-700 hover:bg-navy-50"
        >
          <MessageCircle className="size-5 text-emerald-600" /> WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(link)}`}
          className="flex flex-col items-center gap-2 rounded-xl border border-navy-100 py-4 text-[13px] font-medium text-navy-700 hover:bg-navy-50"
        >
          <Mail className="size-5 text-brand-600" /> Email
        </a>
        <button
          onClick={() => (navigator.share ? navigator.share({ title: text, url: link }).catch(() => {}) : copy())}
          className="flex flex-col items-center gap-2 rounded-xl border border-navy-100 py-4 text-[13px] font-medium text-navy-700 hover:bg-navy-50"
        >
          <Share2 className="size-5 text-navy-600" /> More
        </button>
      </div>
      <p className="mt-4 text-[13px] text-navy-400">Demo link: sharing is simulated in this prototype.</p>
    </Modal>
  )
}
