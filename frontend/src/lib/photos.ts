import { useCallback, useEffect, useState } from 'react'
import { ApiError, api, tokenStore } from '../api/client'

// Photos on tasks. The phone shrinks a photo to at most 1280px (JPEG) before it's
// sent, so uploads are small on mobile data; images load with the sign-in token.

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`
const MAX_SIDE = 1280

export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), 'image/jpeg', 0.72))
}

export async function uploadPhoto(taskId: number, file: File): Promise<string> {
  const blob = await shrinkPhoto(file)
  const r = await fetch(`${BASE}/tasks/${taskId}/photos`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${tokenStore.get() ?? ''}` }, body: blob })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new ApiError(r.status, body.message ?? 'Upload failed')
  return body.message ?? 'Photo added'
}

export interface TaskPhoto { id: number; created_at: string; uploaded_by_name: string | null; url: string }

/** The task's photos as image URLs (fetched with the token). */
export function useTaskPhotos(taskId: number | null, enabled = true) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([])
  const load = useCallback(async () => {
    if (!taskId || !enabled) return
    const list = await api<{ photos: Omit<TaskPhoto, 'url'>[] }>(`/tasks/${taskId}/photos`).catch(() => ({ photos: [] }))
    const withUrls = await Promise.all(list.photos.map(async (p) => {
      const r = await fetch(`${BASE}/tasks/${taskId}/photos/${p.id}`, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` } })
      return { ...p, url: r.ok ? URL.createObjectURL(await r.blob()) : '' }
    }))
    setPhotos((old) => { old.forEach((p) => p.url && URL.revokeObjectURL(p.url)); return withUrls.filter((p) => p.url) })
  }, [taskId, enabled])
  useEffect(() => { load() }, [load])
  useEffect(() => () => setPhotos((old) => { old.forEach((p) => p.url && URL.revokeObjectURL(p.url)); return [] }), [])
  return { photos, reload: load }
}
