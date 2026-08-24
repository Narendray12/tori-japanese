import { describe, expect, it } from 'vitest'
import { BackupError, backupFilename, parseBackup, BACKUP_FORMAT } from './backup'

const valid = {
  format: BACKUP_FORMAT,
  app: 'tori',
  exportedAt: '2026-08-24T00:00:00.000Z',
  cards: [{ id: 'kanji:日#meaning' }],
  reviewLogs: [],
  studySets: [],
  settings: [],
  meta: [],
}

describe('backup files', () => {
  it('accepts a file this version wrote', () => {
    const b = parseBackup(JSON.stringify(valid))
    expect(b.cards).toHaveLength(1)
    expect(b.app).toBe('tori')
  })

  it('fills in sections an older backup may not have', () => {
    const { reviewLogs, settings, meta, ...older } = valid
    void reviewLogs
    void settings
    void meta
    const b = parseBackup(JSON.stringify(older))
    expect(b.reviewLogs).toEqual([])
    expect(b.settings).toEqual([])
  })

  it('refuses files from another app', () => {
    expect(() => parseBackup(JSON.stringify({ ...valid, app: 'anki' }))).toThrow(
      BackupError,
    )
  })

  it('refuses a backup from a newer version rather than mangling it', () => {
    expect(() =>
      parseBackup(JSON.stringify({ ...valid, format: BACKUP_FORMAT + 1 })),
    ).toThrow(/newer version/)
  })

  it('refuses a file with no cards', () => {
    const { cards, ...noCards } = valid
    void cards
    expect(() => parseBackup(JSON.stringify(noCards))).toThrow(/missing its cards/)
  })

  it('refuses text that is not JSON', () => {
    expect(() => parseBackup('not json at all')).toThrow(/valid JSON/)
  })

  it('names the file by date', () => {
    expect(backupFilename(new Date('2026-08-24T22:00:00Z'))).toBe(
      'tori-backup-2026-08-24.json',
    )
  })
})
