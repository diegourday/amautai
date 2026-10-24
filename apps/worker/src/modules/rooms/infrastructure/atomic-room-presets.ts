import { z } from "zod"
import { roomPresetInput } from "@amautai/contracts"
import type { RoomPresetStore } from "../application/preset-service.ts"
import { RoomPresetError, presetSummary } from "../domain/preset.ts"
import type { PresetSubject } from "../domain/preset.ts"

// Atomic Memory Core and Hosted Cloud: quick ingest with metadata.externalId,
// scoped list (supported by both), and verified deletion.
const sourceSite = "amautai-room-defaults"
// Cloud deduplicates external IDs at project scope, so every teacher needs a
// stable distinct ID even when both teachers choose identical options.
async function externalIdFor(subject: PresetSubject) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(subject)
  )
  return (
    "amautai-room-preset-v1-" +
    Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")
  )
}
const memorySchema = z.object({
  id: z.string().min(1),
  user_id: z.string(),
  session_id: z.string().nullable().optional(),
  source_site: z.string(),
  created_at: z.string(),
  metadata: z.object({ externalId: z.string(), preset: roomPresetInput }),
})
const ingestSchema = z.object({
  stored_memory_ids: z.array(z.string().min(1)),
  updated_memory_ids: z.array(z.string().min(1)),
  memories_skipped: z.number(),
})
const listSchema = z.object({
  memories: z.array(memorySchema).max(1),
  count: z.number().int().min(0).max(1),
})
const deleteSchema = z.union([
  z.object({ success: z.literal(true) }),
  z.object({ deleted: z.literal(true), id: z.string().min(1) }),
])

/** Returns null unless the feature is explicitly enabled and fully configured. */
export function atomicRoomPresets(config: {
  enabled?: string
  apiUrl?: string
  apiKey?: string
  timeoutMs?: number
}): RoomPresetStore | null {
  if (config.enabled !== "true" || !config.apiKey) return null
  let base: URL
  try {
    base = new URL(config.apiUrl || "")
  } catch {
    return null
  }
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/" ||
    !(base.protocol === "https:" || (base.protocol === "http:" && loopback))
  )
    return null
  const root = base.origin
  const key = config.apiKey
  const timeout = config.timeoutMs ?? 4000
  // This adapter is composed per request; all calls share one deadline.
  const deadline = Date.now() + timeout

  async function call(
    operation: string,
    path: string,
    init: { method: "GET" | "POST" | "DELETE"; body?: unknown }
  ) {
    let response: Response
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new RoomPresetError("room_preset_unavailable")
    try {
      response = await fetch(root + path, {
        method: init.method,
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          "User-Agent": "Amautai-RoomDefaults/1.0",
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: AbortSignal.timeout(remaining),
        redirect: "manual",
      })
    } catch (error) {
      console.info(
        "amautai_room_preset_transport_error",
        JSON.stringify({
          operation,
          name: error instanceof Error ? error.name : "unknown",
        })
      )
      throw new RoomPresetError("room_preset_unavailable")
    }
    if (!response.ok) {
      console.info(
        "amautai_room_preset_http_error",
        JSON.stringify({ operation, status: response.status })
      )
      throw new RoomPresetError("room_preset_unavailable")
    }
    return response.json().catch(() => null)
  }
  function invalid(operation: string): never {
    console.info(
      "amautai_room_preset_invalid_response",
      JSON.stringify({ operation })
    )
    throw new RoomPresetError("room_preset_unavailable")
  }
  function parse<T>(schema: z.ZodType<T>, operation: string, value: unknown) {
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : invalid(operation)
  }
  const scoped = (subject: PresetSubject) =>
    "?" + new URLSearchParams({ user_id: subject })
  return {
    async read(subject) {
      const externalId = await externalIdFor(subject)
      // This source is reserved for one preset per subject. Fetching two rows
      // detects duplicates without scanning unrelated memories or pagination.
      const page = parse(
        listSchema,
        "read",
        await call(
          "read",
          "/v1/memories/list?" +
            new URLSearchParams({
              user_id: subject,
              source_site: sourceSite,
              limit: "2",
              offset: "0",
            }),
          { method: "GET" }
        )
      )
      if (page.count !== page.memories.length) invalid("read")
      const memory = page.memories[0]
      if (!memory) return null
      // Core returns user_id directly. Hosted Cloud fixes user_id to its
      // authenticated project and projects the requested subject to session_id.
      const owned =
        memory.user_id === subject ||
        (memory.user_id.startsWith("project:") &&
          memory.user_id.length > "project:".length &&
          memory.session_id === subject)
      if (
        !owned ||
        memory.source_site !== sourceSite ||
        memory.metadata.externalId !== externalId
      )
        invalid("read")
      return {
        id: memory.id,
        preset: memory.metadata.preset,
        savedAt: memory.created_at,
      }
    },
    async write(subject, preset) {
      const externalId = await externalIdFor(subject)
      const receipt = parse(
        ingestSchema,
        "ingest",
        await call("ingest", "/v1/memories/ingest/quick", {
          method: "POST",
          body: {
            user_id: subject,
            conversation: presetSummary(preset),
            source_site: sourceSite,
            skip_extraction: true,
            content_class: "summary",
            metadata: { externalId, preset },
          },
        })
      )
      return {
        id:
          receipt.stored_memory_ids[0] ?? receipt.updated_memory_ids[0] ?? null,
        skipped: receipt.memories_skipped,
      }
    },
    async remove(subject, id) {
      // Both providers require an explicit receipt, plus service readback.
      const receipt = parse(
        deleteSchema,
        "delete",
        await call(
          "delete",
          "/v1/memories/" + encodeURIComponent(id) + scoped(subject),
          { method: "DELETE" }
        )
      )
      if ("id" in receipt && receipt.id !== id) invalid("delete")
    },
  }
}
