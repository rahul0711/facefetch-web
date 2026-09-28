import { useCallback, useState } from 'react'
import { downloadFile } from '../services/api'
import { useToast } from '../components/ui/overlay'
import { favorites, setFavorites, toggleFavorite } from '../services/searchService'
import { useDbVersion } from './hooks'

// Favorite / download actions shared by results, viewer and profile.
// Downloads go through the backend so they're authorised and logged.
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
    async (photo) => {
      toast('Downloading…', { tone: 'info', duration: 1200 })
      try {
        await downloadFile(`/api/photos/${photo.id}/download`)
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
        await downloadFile('/api/photos/download-zip', { method: 'POST', json: { photoIds: photos.map((p) => p.id) } })
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
