import { useEffect, useRef, useState } from "react"
import type {
  CargoRoom,
  CargoParticipant,
  CargoRegion,
} from "@amautai/contracts"
import { ApiError } from "@/shared/api/client"
import { roomsApi } from "../api/rooms-api"
export function roomError(e: unknown) {
  const messages: Record<string, string> = {
    assignment_not_found:
      "El enlace de la actividad venció o ya no está disponible. Solicita otro a tu docente.",
    assignment_conflict:
      "Esta actividad ya fue asignada con otros datos o el envío sigue en curso. Actualiza la sala.",
    invalid_guardian_phone: "Escribe los 9 dígitos de tu celular.",
    invalid_assignment_input:
      "Revisa el nombre del estudiante y el teléfono de su apoderado.",
    duplicate_participant:
      "Ya hay un participante con ese nombre en esta sala.",
    room_not_found: "No encontramos la sala o no tienes acceso.",
    participant_not_found:
      "Esta participación fue eliminada. Vuelve a la sala.",
    room_conflict:
      "La prueba cambió. Recarga para continuar con el progreso guardado.",
    teacher_required: "Completa tu perfil docente para crear una sala.",
    room_full: "La sala admite hasta 100 participantes.",
    invalid_room_input: "Escribe un nombre válido de hasta 80 caracteres.",
    room_preset_disabled:
      "Recordar opciones no está habilitado en este servidor.",
    room_preset_not_found:
      "No hay opciones recordadas para olvidar. Actualiza la página.",
    room_preset_unavailable:
      "Atomic Memory no confirmó el cambio. Vuelve a intentarlo; crear salas sigue funcionando.",
  }
  return (
    (e instanceof ApiError && e.code && messages[e.code]) ||
    "No pudimos completar la solicitud. Inténtalo de nuevo."
  )
}
export function useRooms(roomId?: string) {
  const [revision, setRevision] = useState(0)
  const key = (roomId ?? "") + ":" + revision
  const [resource, setResource] = useState<{
    key: string
    rooms: CargoRoom[]
    room: CargoRoom | null
    participants: CargoParticipant[]
    error: string
  }>({ key: "", rooms: [], room: null, participants: [], error: "" })
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const request = roomId
      ? roomsApi
          .detail(roomId, controller.signal)
          .then((d) => ({ rooms: [], ...d }))
      : roomsApi
          .list(controller.signal)
          .then((d) => ({ ...d, room: null, participants: [] }))
    request
      .then((d) => {
        if (!controller.signal.aborted) setResource({ key, ...d, error: "" })
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResource({
            key,
            rooms: [],
            room: null,
            participants: [],
            error: roomError(e),
          })
      })
    return () => controller.abort()
  }, [roomId, key])
  async function action(run: () => Promise<void>) {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await run()
      return true
    } catch (e) {
      if (alive.current) setError(roomError(e))
      return false
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }
  return {
    rooms: resource.rooms,
    room: resource.room?.id === roomId ? resource.room : null,
    participants: resource.room?.id === roomId ? resource.participants : [],
    loading: resource.key !== key,
    loadError: resource.key === key ? resource.error : "",
    error,
    busy,
    notice,
    refresh: () => setRevision((n) => n + 1),
    create: (
      region: CargoRegion,
      onCreated: (room: CargoRoom) => void,
      kind: CargoRoom["kind"] = "cargo",
      mode: CargoRoom["mode"] = "challenge",
      name?: string
    ) =>
      action(async () => {
        const { room } = await roomsApi.create(region, kind, mode, name)
        if (alive.current) onCreated(room)
      }),
    deleteRoom: (id: string) =>
      action(async () => {
        await roomsApi.deleteRoom(id)
        if (alive.current) {
          setResource((current) => ({
            ...current,
            rooms: current.rooms.filter((room) => room.id !== id),
          }))
        }
      }),
    assign: (
      name: string,
      guardianPhone: string,
      requestKey: string,
      participantId?: string
    ) =>
      action(async () => {
        if (!roomId) return
        await roomsApi.assign(
          roomId,
          { name, guardianPhone, requestKey },
          participantId
        )
        if (alive.current) {
          setNotice(
            "Actividad asignada. El enlace está en la cola de envío de WhatsApp del apoderado."
          )
          setRevision((n) => n + 1)
        }
      }),
    retryAssignment: (id: string) =>
      action(async () => {
        if (!roomId) return
        await roomsApi.retryAssignment(roomId, id)
        if (alive.current) {
          setNotice("El envío por WhatsApp se reintentará en unos momentos.")
          setRevision((n) => n + 1)
        }
      }),
    add: (name: string) =>
      action(async () => {
        if (!roomId) return
        await roomsApi.add(roomId, name)
        if (alive.current) setRevision((n) => n + 1)
      }),
    remove: (id: string) =>
      action(async () => {
        if (!roomId) return
        await roomsApi.remove(roomId, id)
        if (alive.current) setRevision((n) => n + 1)
      }),
  }
}
