import { useRef, useState } from 'react'
import { uploadPhoto, useTaskPhotos } from '../../lib/photos'
import { useToast } from '../Toast'
import { Icon } from '../ui'

// Thumbnails for a task, and (if allowed) "Add a photo" from the camera or gallery.
export default function TaskPhotos({ taskId, canAdd, onChanged }: { taskId: number; count?: number; canAdd: boolean; onChanged?: () => void }) {
  const toast = useToast()
  const { photos, reload } = useTaskPhotos(taskId, true)
  const [busy, setBusy] = useState(false)
  const [big, setBig] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const add = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      toast(await uploadPhoto(taskId, file))
      await reload()
      onChanged?.()
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  if (!canAdd && !photos.length) return null
  return (
    <div className="task-photos">
      {photos.map((p) => (
        <button key={p.id} type="button" className="photo-thumb" onClick={() => setBig(p.url)} aria-label={`Photo${p.uploaded_by_name ? ` by ${p.uploaded_by_name}` : ''}`}>
          <img src={p.url} alt="" />
        </button>
      ))}
      {canAdd && photos.length < 4 && (
        <label className={`photo-add ${busy ? 'busy' : ''}`}>
          <Icon name="plus" size={18} /> {busy ? 'Adding…' : photos.length ? 'Add' : 'Add a photo'}
          <input ref={input} type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={(e) => add(e.target.files?.[0])} />
        </label>
      )}
      {big && (
        <div className="photo-big" role="dialog" aria-label="Photo" onClick={() => setBig(null)}>
          <img src={big} alt="" />
          <button className="icon-btn" aria-label="Close"><Icon name="x" /></button>
        </div>
      )}
    </div>
  )
}
