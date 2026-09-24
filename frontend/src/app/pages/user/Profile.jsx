import { ArrowRight, CalendarHeart, Download, Heart, Images, LogOut, ScanFace, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import MomentGrid from '../../components/MomentGrid'
import { EventCover } from '../../components/console'
import ShareModal from '../../components/ShareModal'
import Button from '../../components/ui/Button'
import { Modal } from '../../components/ui/overlay'
import { Avatar, EmptyState, Segmented, Skeleton } from '../../components/ui/primitives'
import { useDbVersion, useDocumentTitle, useQuery } from '../../lib/hooks'
import { usePhotoActions } from '../../lib/photoActions'
import { fmtDate } from '../../lib/utils'
import { db } from '../../services/db'
import { listGuestEvents } from '../../services/eventService'
import { clearHistory, favorites, lastSearch, myMatches } from '../../services/searchService'
import { userStats } from '../../services/userService'

const TABS = [
  { value: 'events', label: 'My Events', path: '/profile' },
  { value: 'photos', label: 'My Photos', path: '/my-photos' },
  { value: 'favorites', label: 'Favorites', path: '/favorites' },
]

export default function Profile({ tab = 'events' }) {
  useDbVersion()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const actions = usePhotoActions(user)
  const stats = userStats(user.id)
  const { data: events, loading } = useQuery(() => listGuestEvents(user.id), [user.id])
  const [sharing, setSharing] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  useDocumentTitle(TABS.find((t) => t.value === tab).label)

  const matches = myMatches(user.id).sort((a, b) => b.score - a.score)
  const favIds = favorites(user.id)
  const byId = Object.fromEntries(matches.map((m) => [m.photo.id, m]))
  // Favorites outlive search history: fall back to the bare photo.
  const favItems = favIds
    .map((id) => byId[id] || (db().photos.find((p) => p.id === id) && { photo: db().photos.find((p) => p.id === id), score: null, box: null }))
    .filter(Boolean)
  const shareEvent = sharing && db().events.find((e) => e.id === sharing.eventId)

  const cells = [
    { icon: CalendarHeart, label: 'Events', value: stats.events },
    { icon: ScanFace, label: 'Photos found', value: stats.found },
    { icon: Heart, label: 'Favorites', value: stats.favorites },
    { icon: Download, label: 'Downloads', value: stats.downloads },
  ]

  return (
    <div className="container-page py-8 sm:py-12">
      <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-navy-100">
        <div className="h-24 bg-gradient-to-r from-navy-900 via-brand-800 to-brand-600 sm:h-28" />
        <div className="flex flex-wrap items-end gap-5 px-5 pb-6 sm:px-8">
          <Avatar user={user} size={88} className="-mt-11 text-3xl ring-4 ring-white" />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-2xl font-semibold text-navy-950">{user.name}</h1>
            <p className="truncate text-navy-500">{user.email}</p>
          </div>
          <Button
            variant="secondary"
            className="max-sm:w-full"
            onClick={() => {
              logout()
              navigate('/')
            }}
          >
            <LogOut /> Log out
          </Button>
        </div>
        <dl className="grid grid-cols-2 border-t border-navy-100 sm:grid-cols-4">
          {cells.map(({ icon: Icon, label, value }, i) => (
            <div key={label} className={`flex items-center gap-3 px-5 py-4 sm:px-8 ${i % 2 ? 'border-l' : ''} ${i > 1 ? 'max-sm:border-t' : ''} sm:border-l sm:first:border-l-0 border-navy-100`}>
              <Icon className="size-5 text-brand-600" />
              <div>
                <dd className="text-xl font-semibold text-navy-950 tabular-nums">{value}</dd>
                <dt className="text-[13px] text-navy-500">{label}</dt>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Profile sections" value={tab} onChange={(v) => navigate(TABS.find((t) => t.value === v).path)} options={TABS} />
        {tab === 'photos' && matches.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            <Trash2 /> Clear search history
          </Button>
        )}
      </div>

      <div className="mt-6">
        {tab === 'events' &&
          (loading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <ul className="grid gap-3">
              {events.map((ev) => {
                const s = lastSearch(ev.id, user.id)
                return (
                  <li key={ev.id}>
                    <Link to={s ? `/events/${ev.id}/results` : `/events/${ev.id}`} className="group flex items-center gap-4 rounded-2xl bg-white p-3 ring-1 ring-navy-100 transition-shadow hover:shadow-lift sm:p-4">
                      <EventCover ev={ev} className="size-16 shrink-0 rounded-xl sm:size-20" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-navy-950">{ev.name}</span>
                        <span className="block text-sm text-navy-500">
                          {fmtDate(ev.date)} · {ev.city}
                        </span>
                      </span>
                      <span className="text-right text-sm">
                        {s ? (
                          <span className="font-semibold text-brand-700">{s.hits.length} moments</span>
                        ) : ev.status === 'Upcoming' ? (
                          <span className="text-navy-400">Upcoming</span>
                        ) : (
                          <span className="font-medium text-navy-500">Not searched yet</span>
                        )}
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-navy-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          ))}

        {tab === 'photos' &&
          (matches.length ? (
            <MomentGrid
              items={matches}
              actions={{ ...actions, onShare: setSharing }}
              linkFor={(it) => `/events/${it.photo.eventId}/photo/${encodeURIComponent(it.photo.id)}`}
            />
          ) : (
            <EmptyState icon={Images} title="No photos yet" action={<Button to="/events">Find my photos</Button>} className="rounded-3xl bg-white ring-1 ring-navy-100">
              Search an event with a selfie and every photo we find you in will be collected here.
            </EmptyState>
          ))}

        {tab === 'favorites' &&
          (favItems.length ? (
            <MomentGrid
              items={favItems}
              showMatch={false}
              actions={{ ...actions, onShare: setSharing }}
              linkFor={(it) => `/events/${it.photo.eventId}/photo/${encodeURIComponent(it.photo.id)}`}
            />
          ) : (
            <EmptyState icon={Heart} title="No favorites yet" action={<Button to={matches.length ? '/my-photos' : '/events'}>{matches.length ? 'Browse my photos' : 'Find my photos'}</Button>} className="rounded-3xl bg-white ring-1 ring-navy-100">
              Tap the heart on any photo to keep your best moments together here.
            </EmptyState>
          ))}
      </div>

      <ShareModal open={!!sharing} onClose={() => setSharing(null)} event={shareEvent} photo={sharing} />
      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear your search history?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearHistory(user.id)
                setConfirmClear(false)
              }}
            >
              Clear history
            </Button>
          </>
        }
      >
        <p className="text-navy-600">Your found photos will be removed from this list. Favorites and downloads you already saved stay. You can search again anytime.</p>
      </Modal>
    </div>
  )
}
