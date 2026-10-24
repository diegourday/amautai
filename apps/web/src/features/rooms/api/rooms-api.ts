import { api } from "@/shared/api/client"
import type {
  StudentAssignment,
  FairRun,
  BuilderRun,
  BuilderPlacement,
  DataRun,
  NurseryRun,
  MarketRun,
  CargoRoom,
  CargoParticipant,
  CargoRegion,
  CargoRun,
  CargoAnswer,
  RoomPreset,
  RoomPresetMemory,
} from "@amautai/contracts"
export function createRoomsApi(token?: string) {
  const request = <T>(path: string, options: RequestInit = {}) =>
    api<T>(path, {
      ...options,
      ...(token
        ? {
            headers: {
              ...Object.fromEntries(new Headers(options.headers)),
              Authorization: "Bearer " + token,
            },
          }
        : {}),
    })
  const path = (room: string, id?: string) =>
    (token ? "/api/assigned-games/" : "/api/game-rooms/") +
    encodeURIComponent(room) +
    (id ? "/participants/" + encodeURIComponent(id) : "")
  return {
    nurseryStart: (room: string, id: string, signal?: AbortSignal) =>
      request<NurseryRun>(path(room, id) + "/nursery/start", {
        method: "POST",
        signal,
      }),
    nurseryAction: (
      room: string,
      id: string,
      version: number,
      kind: "answer" | "help" | "retry",
      load?: { trays: number; units: number }
    ) =>
      request<NurseryRun>(path(room, id) + "/nursery/" + kind, {
        method: "POST",
        body: JSON.stringify({ version, ...(kind === "answer" ? load : {}) }),
      }),
    marketStart: (room: string, id: string, signal?: AbortSignal) =>
      request<MarketRun>(path(room, id) + "/market/start", {
        method: "POST",
        signal,
      }),
    marketAction: (
      room: string,
      id: string,
      version: number,
      kind: "answer" | "help" | "retry",
      answer?: number
    ) =>
      request<MarketRun>(path(room, id) + "/market/" + kind, {
        method: "POST",
        body: JSON.stringify({
          version,
          ...(kind === "answer" ? { answer } : {}),
        }),
      }),
    fairStart: (room: string, id: string, signal?: AbortSignal) =>
      request<FairRun>(path(room, id) + "/fair/start", {
        method: "POST",
        signal,
      }),
    fairAction: (
      room: string,
      id: string,
      version: number,
      kind: "answer" | "help" | "retry",
      answer?: number
    ) =>
      request<FairRun>(path(room, id) + "/fair/" + kind, {
        method: "POST",
        body: JSON.stringify({
          version,
          ...(kind === "answer" ? { answer } : {}),
        }),
      }),
    dataStart: (room: string, id: string, signal?: AbortSignal) =>
      request<DataRun>(path(room, id) + "/data/start", {
        method: "POST",
        signal,
      }),
    dataAction: (
      room: string,
      id: string,
      version: number,
      kind: "answer" | "help" | "retry",
      answer?: number
    ) =>
      request<DataRun>(path(room, id) + "/data/" + kind, {
        method: "POST",
        body: JSON.stringify({
          version,
          ...(kind === "answer" ? { answer } : {}),
        }),
      }),
    builderStart: (room: string, id: string, signal?: AbortSignal) =>
      request<BuilderRun>(path(room, id) + "/builder/start", {
        method: "POST",
        signal,
      }),
    builderAction: (
      room: string,
      id: string,
      version: number,
      kind: "answer" | "help" | "retry",
      placement?: BuilderPlacement
    ) =>
      request<BuilderRun>(path(room, id) + "/builder/" + kind, {
        method: "POST",
        body: JSON.stringify({
          version,
          ...(kind === "answer" ? placement : {}),
        }),
      }),
    assigned: (signal?: AbortSignal) =>
      request<{ room: CargoRoom; participant: CargoParticipant }>(
        "/api/assigned-games",
        { signal }
      ),
    assign: (
      room: string,
      input: { name: string; guardianPhone: string; requestKey: string },
      participantId?: string
    ) =>
      request<{ assignment: StudentAssignment }>(
        participantId
          ? path(room, participantId) + "/assignment"
          : path(room) + "/assignments",
        { method: "POST", body: JSON.stringify(input) }
      ),
    retryAssignment: (room: string, id: string) =>
      request<{ ok: true }>(path(room, id) + "/assignment/retry", {
        method: "POST",
      }),
    list: (signal?: AbortSignal) =>
      request<{ rooms: CargoRoom[] }>("/api/game-rooms", { signal }),
    preset: (signal?: AbortSignal) =>
      request<RoomPresetMemory>("/api/game-rooms/preset", { signal }),
    rememberPreset: (preset: RoomPreset, signal?: AbortSignal) =>
      request<{
        remembered: { preset: RoomPreset; savedAt: string }
      }>("/api/game-rooms/preset", {
        method: "PUT",
        body: JSON.stringify(preset),
        signal,
      }),
    forgetPreset: (signal?: AbortSignal) =>
      request<{ forgotten: true }>("/api/game-rooms/preset", {
        method: "DELETE",
        signal,
      }),
    deleteRoom: (room: string) =>
      request<{ ok: true }>(path(room), { method: "DELETE" }),
    detail: (room: string, signal?: AbortSignal) =>
      request<{ room: CargoRoom; participants: CargoParticipant[] }>(
        path(room),
        {
          signal,
        }
      ),
    create: (
      region: CargoRegion,
      kind: CargoRoom["kind"] = "cargo",
      mode: CargoRoom["mode"] = "challenge",
      name?: string
    ) =>
      request<{ room: CargoRoom }>("/api/game-rooms", {
        method: "POST",
        body: JSON.stringify({ region, kind, mode, name }),
      }),
    add: (room: string, name: string) =>
      request(path(room) + "/participants", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    remove: (room: string, id: string) =>
      request(path(room, id), { method: "DELETE" }),
    start: (room: string, id: string, signal?: AbortSignal) =>
      request<CargoRun>(path(room, id) + "/start", { method: "POST", signal }),
    collect: (room: string, id: string, version: number, value: number) =>
      request<CargoAnswer>(path(room, id) + "/collect", {
        method: "POST",
        body: JSON.stringify({ version, value }),
      }),
    pause: (room: string, id: string, version: number, paused: boolean) =>
      request<CargoAnswer>(path(room, id) + "/pause", {
        method: "POST",
        body: JSON.stringify({ version, paused }),
      }),
    retry: (room: string, id: string) =>
      request<CargoRun>(path(room, id) + "/retry", { method: "POST" }),
  }
}
export const roomsApi = createRoomsApi()
