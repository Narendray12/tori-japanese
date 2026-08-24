import { db } from '../../db/db'
import type { StudySet } from '../../db/types'

/**
 * Your own sets first (newest first), then the shipped presets in natural
 * order so "Kanji 1-10" precedes "Kanji 11-20".
 */
export function sortSets(sets: StudySet[]): StudySet[] {
  return [...sets].sort((a, b) => {
    if (a.preset !== b.preset) return a.preset - b.preset
    if (a.preset === 0) return b.createdAt.getTime() - a.createdAt.getTime()
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })
}

export function newSetId(name: string, now: Date): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `set:${slug || 'untitled'}:${now.getTime()}`
}

export async function createSet(
  name: string,
  itemIds: string[],
): Promise<StudySet> {
  const now = new Date()
  const set: StudySet = {
    id: newSetId(name, now),
    name: name.trim() || 'Untitled set',
    description: '',
    group: 'Your sets',
    itemIds,
    active: 0,
    preset: 0,
    createdAt: now,
  }
  await db.studySets.add(set)
  return set
}

export async function addItemsToSet(
  setId: string,
  itemIds: string[],
): Promise<void> {
  await db.studySets
    .where('id')
    .equals(setId)
    .modify((s) => {
      s.itemIds = [...new Set([...s.itemIds, ...itemIds])]
    })
}

export async function removeItemsFromSet(
  setId: string,
  itemIds: string[],
): Promise<void> {
  const drop = new Set(itemIds)
  await db.studySets
    .where('id')
    .equals(setId)
    .modify((s) => {
      s.itemIds = s.itemIds.filter((id) => !drop.has(id))
    })
}

export async function setActive(setId: string, active: boolean): Promise<void> {
  await db.studySets.update(setId, { active: active ? 1 : 0 })
}

export async function deactivateAll(): Promise<void> {
  await db.studySets
    .where('active')
    .equals(1)
    .modify((s) => {
      s.active = 0
    })
}

export async function renameSet(setId: string, name: string): Promise<void> {
  await db.studySets.update(setId, { name: name.trim() || 'Untitled set' })
}

/** Presets are permanent; user sets can be deleted. */
export async function deleteSet(setId: string): Promise<void> {
  const set = await db.studySets.get(setId)
  if (!set || set.preset === 1) return
  await db.studySets.delete(setId)
}
