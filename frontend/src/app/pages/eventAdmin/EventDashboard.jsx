import { ArrowRight, CloudUpload, Download, Images, Link2, ScanFace, ScanSearch, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Panel, StatusStack } from '../../components/charts'
import { StatStrip } from '../../components/console'
import Photo from '../../components/Photo'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/overlay'
import { EmptyState } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact, copyText } from '../../lib/utils'
import { eventAnalytics } from '../../services/analyticsService'
import { listPhotos } from '../../services/photoService'
import { shareLink } from '../../services/searchService'
import { EventAdminHeader, EventHeaderSkeleton, NotAssigned, useAdminEvent } from './shared'

export default function EAEventDashboard() {
  const { ev, perms, loading, error, eventId } = useAdminEvent()
  useDocumentTitle(ev?.name)
  const toast = useToast()
  const { data: photos } = useQuery(() => listPhotos(eventId), [eventId])
  const { data: stats } = useQuery(() => eventAnalytics(eventId), [eventId])
  if (loading) return <EventHeaderSkeleton />
  if (error) return <NotAssigned />

  return (
    <div className="grid gap-6">
      <EventAdminHeader
        ev={ev}
        perms={perms}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={async () => {
                await copyText(shareLink(ev))
                toast('Guest link copied', { description: 'Share it with guests so they can find their photos.' })
              }}
            >
              <Link2 /> Copy guest link
            </Button>
            {perms.upload && (
              <Button to={`/event-admin/events/${ev.id}/photos`}>
                <CloudUpload /> Upload photos
              </Button>
            )}
          </>
        }
      />
      <StatStrip
        items={[
          { label: 'Photos', value: compact(ev.stats.photos), icon: Images },
          { label: 'Faces detected', value: compact(ev.stats.faces), icon: ScanFace },
          { label: 'Searches', value: compact(ev.stats.searches), icon: ScanSearch },
          { label: 'Unique visitors', value: compact(ev.stats.visitors), icon: Users },
          { label: 'Downloads', value: compact(ev.stats.downloads), icon: Download },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Latest photos"
          className="lg:col-span-2"
          action={
            <Link to={`/event-admin/events/${ev.id}/photos`} className="flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
              Manage photos <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {photos?.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {photos.slice(0, 10).map((p) => (
                <Photo key={p.id} photo={p} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Images}
              title="No photos yet"
              className="py-8"
              action={perms.upload && <Button to={`/event-admin/events/${ev.id}/photos`}><CloudUpload /> Upload photos</Button>}
            >
              Upload the event’s photos. Guests can search as soon as faces are indexed.
            </EmptyState>
          )}
        </Panel>
        <Panel title="Processing status">
          {stats && <StatusStack counts={stats.processing} />}
        </Panel>
      </div>
    </div>
  )
}
