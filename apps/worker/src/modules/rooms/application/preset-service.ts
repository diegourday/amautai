import type { Actor } from "../domain/cargo.ts"
import {
  RoomPresetError,
  normalizePreset,
  presetSubject,
  samePreset,
} from "../domain/preset.ts"
import type {
  PresetSubject,
  RememberedRoomPreset,
  RoomPreset,
  StoredRoomPreset,
} from "../domain/preset.ts"

/** Long-term memory holding at most one room preset per subject. */
export interface RoomPresetStore {
  read(subject: PresetSubject): Promise<StoredRoomPreset | null>
  write(
    subject: PresetSubject,
    preset: RoomPreset
  ): Promise<{ id: string | null; skipped: number }>
  /** Resolves only on a confirmed deletion receipt. */
  remove(subject: PresetSubject, id: string): Promise<void>
}

export type RoomPresetMemory =
  | { kind: "disabled" }
  | { kind: "enabled"; remembered: RememberedRoomPreset | null }

const remembered = ({ preset, savedAt }: StoredRoomPreset) => ({
  preset,
  savedAt,
})

export function roomPresetService(
  store: RoomPresetStore | null,
  rooms: { teacher(actor: Actor): Promise<boolean> }
) {
  async function access(actor: Actor) {
    if (!store) throw new RoomPresetError("room_preset_disabled")
    if (!(await rooms.teacher(actor)))
      throw new RoomPresetError("teacher_required")
    return { store, subject: presetSubject(actor) }
  }
  async function removeVerified(
    store: RoomPresetStore,
    subject: PresetSubject,
    id: string
  ) {
    await store.remove(subject, id)
    // A receipt alone is not enough: the preset must also be gone on readback.
    if (await store.read(subject))
      throw new RoomPresetError("room_preset_unavailable")
  }
  return {
    async recall(actor: Actor): Promise<RoomPresetMemory> {
      if (!store) return { kind: "disabled" }
      const { subject } = await access(actor)
      const stored = await store.read(subject)
      return { kind: "enabled", remembered: stored && remembered(stored) }
    },
    async remember(
      actor: Actor,
      input: RoomPreset
    ): Promise<RememberedRoomPreset> {
      const { store, subject } = await access(actor)
      const preset = normalizePreset(input)
      const current = await store.read(subject)
      if (current && samePreset(current.preset, preset))
        return remembered(current)
      // Stable externalId updates the single preset without first deleting it.
      const failed = new RoomPresetError("room_preset_unavailable")
      let receipt: { id: string | null; skipped: number }
      try {
        receipt = await store.write(subject, preset)
      } catch {
        throw failed
      }
      let stored: StoredRoomPreset | null
      try {
        stored = await store.read(subject)
      } catch {
        throw failed
      }
      // Only a readable record with these exact options counts as saved; an
      // empty receipt is accepted only when the provider reports a skip.
      if (
        !stored ||
        !samePreset(stored.preset, preset) ||
        (receipt.id ? stored.id !== receipt.id : receipt.skipped < 1)
      )
        throw failed
      return remembered(stored)
    },
    async forget(actor: Actor) {
      const { store, subject } = await access(actor)
      const current = await store.read(subject)
      if (!current) throw new RoomPresetError("room_preset_not_found")
      await removeVerified(store, subject, current.id)
    },
  }
}
export type RoomPresetService = ReturnType<typeof roomPresetService>
