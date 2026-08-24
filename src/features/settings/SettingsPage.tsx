import { useEffect, useRef, useState } from 'react'
import { db } from '../../db/db'
import {
  DEFAULT_SETTINGS,
  getSettings,
  setSetting,
  type AppSettings,
} from '../../db/settings'
import {
  backupFilename,
  BackupError,
  exportBackup,
  importBackup,
  parseBackup,
} from '../../db/backup'
import { applyTheme, storedTheme, type Theme } from '../../app/theme'
import { japaneseVoice, watchVoices } from '../review/tts'

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [theme, setTheme] = useState<Theme>(storedTheme)
  const [tts, setTts] = useState(() => japaneseVoice() !== null)
  const [message, setMessage] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getSettings().then(setSettings)
  }, [])
  useEffect(() => watchVoices(setTts), [])

  const update = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
    await setSetting(key, value)
  }

  const chooseTheme = (t: Theme) => {
    setTheme(t)
    applyTheme(t)
  }

  const download = async () => {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFilename()
    a.click()
    URL.revokeObjectURL(url)
    setMessage(`Saved ${backup.cards.length} cards and ${backup.reviewLogs.length} reviews.`)
    setProblem(null)
  }

  const restore = async (file: File) => {
    setMessage(null)
    setProblem(null)
    try {
      const summary = await importBackup(parseBackup(await file.text()))
      setMessage(
        `Restored ${summary.cards} cards, ${summary.reviews} reviews, and ${summary.sets} sets.`,
      )
      setSettings(await getSettings())
    } catch (e) {
      setProblem(
        e instanceof BackupError ? e.message : 'That file could not be restored.',
      )
    }
  }

  if (!settings) return null

  return (
    <div className="space-y-6 pt-2 pb-6">
      <Group title="Study">
        <Row
          label="Daily new items"
          hint="How many unseen items lessons may introduce each day."
        >
          <Stepper
            value={settings.newItemsPerDay}
            min={0}
            max={40}
            step={5}
            onChange={(v) => void update('newItemsPerDay', v)}
          />
        </Row>
        <Row
          label="Items per lesson"
          hint="How many are taught before the quiz that follows."
        >
          <Stepper
            value={settings.lessonBatchSize}
            min={1}
            max={20}
            step={1}
            onChange={(v) => void update('lessonBatchSize', v)}
          />
        </Row>
        <Row
          label="Target recall"
          hint={`Aim to remember ${Math.round(settings.desiredRetention * 100)}% at review time. Higher means more reviews and less forgetting.`}
        >
          <input
            type="range"
            min={0.8}
            max={0.97}
            step={0.01}
            value={settings.desiredRetention}
            onChange={(e) => void update('desiredRetention', Number(e.target.value))}
            className="w-32 accent-ai"
            aria-label="Target recall"
          />
        </Row>
      </Group>

      <Group title="How you are quizzed">
        <Toggle
          label="Type the answer"
          hint="Readings and fill-in-the-blank ask you to type. Romaji turns into kana as you go."
          on={settings.typing}
          onChange={(v) => void update('typing', v)}
        />
        <Toggle
          label="Multiple choice"
          hint="Meanings offer four options instead of grading yourself."
          on={settings.multipleChoice}
          onChange={(v) => void update('multipleChoice', v)}
        />
        <Toggle
          label="Listening"
          hint={
            tts
              ? 'Hear a word and pick what it means.'
              : 'This device has no Japanese voice, so listening cards stay off.'
          }
          on={settings.listening && tts}
          disabled={!tts}
          onChange={(v) => void update('listening', v)}
        />
        <p className="px-4 pb-3 text-xs text-ink-faint">
          Turn everything off to go back to plain flip cards where you grade
          yourself.
        </p>
      </Group>

      <Group title="Appearance">
        <div className="flex gap-1 p-3">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => chooseTheme(t)}
              aria-pressed={theme === t}
              className={`flex-1 rounded-md py-2 text-sm font-medium capitalize transition-colors ${
                theme === t
                  ? 'bg-ai-wash text-ai-deep'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Backup">
        <div className="space-y-2 p-4">
          <p className="text-xs text-ink-soft">
            Everything lives on this device. Save a copy before clearing your
            browser data or moving to another phone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void download()}
              className="flex-1 rounded-lg bg-ai py-2.5 text-sm font-medium text-white transition-colors hover:bg-ai-deep"
            >
              Save a backup
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-lg border border-mist py-2.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Restore
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Choose a backup file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void restore(f)
              e.target.value = ''
            }}
          />
          <p className="text-xs text-ink-faint">
            Restoring replaces the progress on this device.
          </p>
          {message && <p className="text-xs font-medium text-moss">{message}</p>}
          {problem && <p className="text-xs font-medium text-shu">{problem}</p>}
        </div>
      </Group>

      <Group title="Reset">
        <div className="p-4">
          <button
            onClick={() => {
              if (
                confirm(
                  'Erase all progress on this device? Your backups are not touched.',
                )
              ) {
                void (async () => {
                  await db.delete()
                  location.reload()
                })()
              }
            }}
            className="text-sm font-medium text-shu"
          >
            Erase all progress
          </button>
        </div>
      </Group>

      <p className="text-center text-xs text-ink-faint">
        Content from KANJIDIC, Tanos JLPT lists, and KanjiVG. Scheduling by FSRS.
      </p>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-medium tracking-widest text-ink-faint uppercase">
        {title}
      </h2>
      <div className="mt-2 divide-y divide-mist rounded-lg border border-mist bg-card">
        {children}
      </div>
    </section>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label="Decrease"
        className="size-8 rounded-lg border border-mist text-ink-soft hover:text-ink"
      >
        −
      </button>
      <span className="w-8 text-center font-mono text-sm tabular-nums">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        aria-label="Increase"
        className="size-8 rounded-lg border border-mist text-ink-soft hover:text-ink"
      >
        +
      </button>
    </div>
  )
}

function Toggle({
  label,
  hint,
  on,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  on: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40 ${
          on ? 'bg-ai' : 'bg-mist'
        }`}
      >
        <span
          className={`size-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`}
        />
      </button>
    </div>
  )
}

export { DEFAULT_SETTINGS }
