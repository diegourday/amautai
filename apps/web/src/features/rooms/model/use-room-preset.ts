import { useEffect, useRef, useState } from "react"
import type { RoomPreset, RoomPresetMemory } from "@amautai/contracts"
import { roomsApi } from "../api/rooms-api"
import { roomError } from "./use-rooms"

type Remembered = { preset: RoomPreset; savedAt: string } | null

/**
 * Remembered new-room options for the signed-in teacher. Mount it keyed by
 * account: unmounting aborts every in-flight request, so no result from a
 * previous account can land in the form.
 */
export function useRoomPreset() {
  const [revision, setRevision] = useState(0)
  const [resource, setResource] = useState<{
    revision: number
    memory: RoomPresetMemory | null
    error: string
  }>({ revision: -1, memory: null, error: "" })
  const [busy, setBusy] = useState<"" | "remember" | "forget">("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    const owner = new AbortController()
    controller.current = owner
    return () => owner.abort()
  }, [])
  useEffect(() => {
    const load = new AbortController()
    roomsApi
      .preset(load.signal)
      .then((memory) => {
        if (!load.signal.aborted) setResource({ revision, memory, error: "" })
      })
      .catch(() => {
        if (!load.signal.aborted)
          setResource({
            revision,
            memory: null,
            error:
              "No pudimos consultar las opciones recordadas. Puedes crear la sala igual.",
          })
      })
    return () => load.abort()
  }, [revision])
  function setRemembered(remembered: Remembered) {
    setResource((current) => ({
      ...current,
      memory: { kind: "enabled", remembered },
    }))
  }
  async function action(
    kind: "remember" | "forget",
    run: (signal: AbortSignal) => Promise<string>
  ) {
    const signal = controller.current?.signal
    if (busy || !signal || signal.aborted) return
    setBusy(kind)
    setNotice("")
    setError("")
    try {
      const message = await run(signal)
      if (!signal.aborted) setNotice(message)
    } catch (e) {
      if (signal.aborted) return
      setError(roomError(e))
      // Show what the server actually holds after any failed change.
      setRevision((n) => n + 1)
    } finally {
      if (!signal.aborted) setBusy("")
    }
  }
  const memory = resource.memory
  return {
    loading: resource.revision !== revision,
    loadError: resource.error,
    enabled: memory?.kind === "enabled",
    remembered: memory?.kind === "enabled" ? memory.remembered : null,
    busy,
    notice,
    error,
    retry: () => setRevision((n) => n + 1),
    announce: (message: string) => {
      setError("")
      setNotice(message)
    },
    remember: (preset: RoomPreset) =>
      action("remember", async (signal) => {
        const { remembered } = await roomsApi.rememberPreset(preset, signal)
        if (!signal.aborted) setRemembered(remembered)
        return "Opciones recordadas. Úsalas cuando crees otra sala."
      }),
    forget: () =>
      action("forget", async (signal) => {
        await roomsApi.forgetPreset(signal)
        if (!signal.aborted) setRemembered(null)
        return "Las opciones recordadas se olvidaron."
      }),
  }
}
