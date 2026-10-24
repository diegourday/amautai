import { z } from "zod"
export const roomInput = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    region: z.enum(["coast", "highlands", "jungle"]),
    kind: z
      .enum(["cargo", "market", "nursery", "fair", "builder"])
      .default("cargo"),
    mode: z.enum(["practice", "challenge"]).default("challenge"),
  })
  .strict()
export const studentAssignmentInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    guardianPhone: z.string().trim().min(8).max(30),
    requestKey: z.uuid(),
  })
  .strict()
export type StudentAssignment = {
  expired: boolean
  status:
    | "pending"
    | "dispatching"
    | "accepted"
    | "sent"
    | "delivered"
    | "read"
    | "failed"
    | "expired"
    | "cancelled"
    | "uncertain"
  guardianPhone: string
  expiresAt: string
}
export const participantInput = z
  .object({ name: z.string().trim().min(1).max(80) })
  .strict()
export const cargoCollectInput = z
  .object({
    version: z.number().int().min(1),
    value: z.number().int().min(1).max(10),
  })
  .strict()
export const cargoPauseInput = z
  .object({ version: z.number().int().min(1), paused: z.boolean() })
  .strict()
export type CargoRegion = z.infer<typeof roomInput>["region"]
export type CargoChallenge = { groupCount: number; unitsPerGroup: number }
export type CargoParticipant = {
  assignment?: StudentAssignment | null
  id: string
  name: string
  score: number
  solved: number
  started: boolean
  caught: number
  mistakes: number
  paused: boolean
  version: number
}
export type CargoRoom = {
  familyChildId?: string | null
  name: string | null
  id: string
  region: CargoRegion
  createdAt: string
  kind: "cargo" | "market" | "nursery" | "fair" | "data" | "builder"
  mode: "practice" | "challenge"
}
export type CargoRun = {
  participant: CargoParticipant
  room: CargoRoom
  challenge: CargoChallenge
}
export type CargoAnswer = {
  participant: CargoParticipant
  challenge: CargoChallenge
}

export const marketAnswerInput = z
  .object({
    version: z.number().int().min(1),
    answer: z.number().int().min(0).max(100),
  })
  .strict()
export const marketVersionInput = z
  .object({ version: z.number().int().min(1) })
  .strict()
export type MarketTask = {
  id: number
  skill: number
  band: number
  a: number
  b: number
  operation: "+" | "−"
  missing: boolean
}
export type MarketRun = {
  room: CargoRoom
  participant: CargoParticipant
  task: MarketTask
  helped: boolean
  attempts: number
  streak: number
  bands: number[]
  evidence: { correct: number; assisted: number; errors: number }[]
  feedback: "" | "correct" | "wrong" | "help"
  delta: number
}

/**
 * Remembered room defaults: only the typed game options, never names.
 * Defaults are unwrapped so a stored preset always states every option.
 */
export const roomPresetInput = z
  .object({
    kind: roomInput.shape.kind.unwrap(),
    mode: roomInput.shape.mode.unwrap(),
    region: roomInput.shape.region,
  })
  .strict()
export type RoomPreset = z.infer<typeof roomPresetInput>
export type RoomPresetMemory =
  | { kind: "disabled" }
  | {
      kind: "enabled"
      remembered: { preset: RoomPreset; savedAt: string } | null
    }
