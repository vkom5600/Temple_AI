import { useEffect, useState } from 'react'
import { settingsApi } from '../../api/endpoints'
import { useToast } from '../../components/Toast'
import { ErrorNote, Spinner } from '../../components/ui'
import type { Setting } from '../../types'

const HELP: Record<Setting['key'], string> = {
  registration_open: 'The main switch for sign-ups. Who can sign up, and when, is set in People → Sign-up window.',
  login_alert_to_chairman: 'An email each time a committee member, staff or volunteer signs in.',
  closing_time: "After this time, you're told if anyone is still checked in or nobody confirmed lamps, gas and doors.",
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

  const save = async (key: Setting['key'], value: boolean | string) => {
    setError('')
    setSaving(key)
    try {
      const r = await settingsApi.update(key, value)
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
        {settings?.filter((s) => s.key in HELP).map((s) => (
          <div key={s.key} className="setting-row">
            <div className="grow">
              <div className="strong">{s.label}</div>
              <div className="muted small">{HELP[s.key]}</div>
            </div>
            {typeof s.value === 'boolean' ? (
              <button
                role="switch"
                aria-checked={s.value}
                aria-label={s.label}
                className={`switch ${s.value ? 'on' : ''}`}
                disabled={saving === s.key}
                onClick={() => save(s.key, !s.value)}
              >
                <span className="switch-knob" />
              </button>
            ) : (
              <input
                type="time"
                className="setting-time"
                aria-label={s.label}
                defaultValue={s.value}
                disabled={saving === s.key}
                onBlur={(e) => e.target.value && e.target.value !== s.value && save(s.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
