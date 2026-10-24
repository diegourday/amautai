import type { Actor, Region, Room } from "./cargo.ts"

/** Typed new-room options a teacher explicitly asked to remember. */
export type RoomPreset = {
  kind: Exclude<Room["kind"], "data">
  mode: Room["mode"]
  region: Region
}
export type RememberedRoomPreset = { preset: RoomPreset; savedAt: string }
export type StoredRoomPreset = RememberedRoomPreset & { id: string }

export type RoomPresetErrorCode =
  | "teacher_required"
  | "room_preset_disabled"
  | "room_preset_not_found"
  | "room_preset_unavailable"
export class RoomPresetError extends Error {
  readonly code: RoomPresetErrorCode
  constructor(code: RoomPresetErrorCode) {
    super(code)
    this.name = "RoomPresetError"
    this.code = code
  }
}

/** Opaque memory subject derived only from the verified tenant and user. */
export type PresetSubject = string & { readonly __brand: "PresetSubject" }
export const presetSubject = (actor: Actor) =>
  `amautai:${actor.tenantId}:teacher:${actor.userId}` as PresetSubject

/** Cargo rooms always run as a challenge, matching room creation. */
export const normalizePreset = (preset: RoomPreset): RoomPreset => ({
  kind: preset.kind,
  mode: preset.kind === "cargo" ? "challenge" : preset.mode,
  region: preset.region,
})
export const samePreset = (a: RoomPreset, b: RoomPreset) =>
  a.kind === b.kind && a.mode === b.mode && a.region === b.region

/** Distilled memory text; it never contains room or student names. */
export const presetSummary = (preset: RoomPreset) =>
  `Amautai new-room defaults: game=${preset.kind}; mode=${preset.mode}; context=${preset.region}.`
