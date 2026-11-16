import { useEffect, useState } from 'react'
import { settingsApi } from '../../api/endpoints'
import { useToast } from '../../components/Toast'
import { ErrorNote, Spinner } from '../../components/ui'
import type { Setting } from '../../types'

const HELP: Record<Setting['key'], string> = {
  registration_open: 'When off, the Register page says registration is closed.',
  login_alert_to_chairman: 'An email each time a committee member, staff or volunteer signs in.',
}

// Chairman only: the switches stored in the settings table.
export default function SettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState<Setting[] | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<Setting['key'] | null>(null)

  useEffect(() => {
    settingsApi.list().then((r) => setSettings(r.settings)).catch((e: Error) => setError(e.message))
  }, [])

  const toggle = async (s: Setting) => {
    setError('')
    setSaving(s.key)
    try {
      const r = await settingsApi.update(s.key, !s.value)
      setSettings(r.settings)
      toast('Setting saved')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Only the chairman can see and change these.</p>
        </div>
      </header>

      <section className="panel">
        <ErrorNote>{error}</ErrorNote>
        {!settings && !error && <Spinner />}
        {settings?.map((s) => (
          <div key={s.key} className="setting-row">
            <div className="grow">
              <div className="strong">{s.label}</div>
              <div className="muted small">{HELP[s.key]}</div>
            </div>
            <button
              role="switch"
              aria-checked={s.value}
              aria-label={s.label}
              className={`switch ${s.value ? 'on' : ''}`}
              disabled={saving === s.key}
              onClick={() => toggle(s)}
            >
              <span className="switch-knob" />
            </button>
          </div>
        ))}
      </section>
    </div>
  )
}
