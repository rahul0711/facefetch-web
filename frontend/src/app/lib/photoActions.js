import { useCallback, useState } from 'react'
import { downloadFile } from '../services/api'
import { useToast } from '../components/ui/overlay'
import { favorites, setFavorites, toggleFavorite } from '../services/searchService'
import { useDbVersion } from './hooks'

// Favorite / download actions shared by results, viewer and profile.
// Downloads go through the backend so they're authorised and logged.
// user is null for a visitor without an account (favorites stay in this browser).
export function usePhotoActions(user) {
  useDbVersion() // re-render when favorites change
  const toast = useToast()
  const uid = user?.id ?? 'guest'
  const favs = new Set(favorites(uid))
  const [zipping, setZipping] = useState(false)

  const isFav = (id) => favs.has(id)

  const toggleFav = useCallback(
    (photo) => {
      const on = toggleFavorite(uid, photo.id)
      toast(on ? 'Added to favorites' : 'Removed from favorites', { tone: on ? 'success' : 'info', duration: 1800 })
    },
    [uid, toast],
  )

  const favAll = useCallback(
    (photos) => {
      setFavorites(uid, photos.map((p) => p.id), true)
      toast(`${photos.length} photos added to favorites`)
    },
    [uid, toast],
  )

  const download = useCallback(
    async (photo) => {
      toast('Downloading…', { tone: 'info', duration: 1200 })
      try {
        await downloadFile(photo.downloadPath || `/api/photos/${photo.id}/download`)
        toast('Photo saved', { description: 'Check your downloads folder.' })
      } catch (e) {
        toast(e.message || 'Download failed. Please try again.', { tone: 'error' })
      }
    },
    [toast],
  )

  const downloadAll = useCallback(
    async (photos) => {
      setZipping(true)
      toast(`Preparing ${photos.length} photos…`, { tone: 'info' })
      try {
        const key = photos.find((p) => p.key)?.key
        await downloadFile(`/api/photos/download-zip${key ? `?key=${encodeURIComponent(key)}` : ''}`, { method: 'POST', json: { photoIds: photos.map((p) => p.id) } })
        toast(`${photos.length} photos downloaded`, { description: 'Saved as a single zip file.' })
      } catch (e) {
        toast(e.message || 'Download failed. Please try again.', { tone: 'error' })
      } finally {
        setZipping(false)
      }
    },
    [toast],
  )

  return { isFav, toggleFav, favAll, download, downloadAll, zipping }
}
