import { useCallback, useState } from 'react'
import { buildZip, saveBlob } from '../../facefetch/library'
import { useToast } from '../components/ui/overlay'
import { favorites, recordDownload, setFavorites, toggleFavorite } from '../services/searchService'
import { useDbVersion } from './hooks'
import { downloadUrl } from './utils'

const fileName = (photo, eventName) =>
  `${(eventName || 'genesis-hub').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${photo.id.split('__').pop().slice(0, 10)}.jpg`

// Favorite / download / share actions shared by results, viewer and profile.
export function usePhotoActions(user) {
  useDbVersion() // re-render when favorites change
  const toast = useToast()
  const favs = new Set(favorites(user.id))
  const [zipping, setZipping] = useState(false)

  const isFav = (id) => favs.has(id)

  const toggleFav = useCallback(
    (photo) => {
      const on = toggleFavorite(user.id, photo.id)
      toast(on ? 'Added to favorites' : 'Removed from favorites', { tone: on ? 'success' : 'info', duration: 1800 })
    },
    [user.id, toast],
  )

  const favAll = useCallback(
    (photos) => {
      setFavorites(user.id, photos.map((p) => p.id), true)
      toast(`${photos.length} photos added to favorites`)
    },
    [user.id, toast],
  )

  const download = useCallback(
    async (photo, eventName) => {
      toast('Downloading…', { tone: 'info', duration: 1200 })
      const ok = await downloadUrl(photo.src, fileName(photo, eventName))
      if (ok) {
        recordDownload(user.id)
        toast('Photo saved', { description: 'Check your downloads folder.' })
      } else toast('Download failed. Please try again.', { tone: 'error' })
    },
    [user.id, toast],
  )

  const downloadAll = useCallback(
    async (photos, eventName) => {
      setZipping(true)
      toast(`Preparing ${photos.length} photos…`, { tone: 'info' })
      try {
        const files = []
        for (const p of photos) {
          const blob = await (await fetch(p.src)).blob()
          files.push({ name: fileName(p, eventName), blob })
        }
        saveBlob(await buildZip(files), `${fileName({ id: 'moments' }, eventName).replace('.jpg', '')}.zip`)
        recordDownload(user.id, photos.length)
        toast(`${photos.length} photos downloaded`, { description: 'Saved as a single zip file.' })
      } catch {
        toast('Download failed. Please try again.', { tone: 'error' })
      } finally {
        setZipping(false)
      }
    },
    [user.id, toast],
  )

  return { isFav, toggleFav, favAll, download, downloadAll, zipping }
}
