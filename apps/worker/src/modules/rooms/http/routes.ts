import type { Hono } from "hono"
import {
  roomInput,
  participantInput,
  studentAssignmentInput,
} from "@amautai/contracts"
import type { AppContext, AppEnv } from "../../../shared/http/context.ts"
import type { RoomService } from "../application/service.ts"
import { registerRoomPlayRoutes } from "./play-routes.ts"
import type { AssignmentService } from "../application/assignment-service.ts"
import { RoomError } from "../domain/cargo.ts"
import type { RoomPresetService } from "../application/preset-service.ts"
import { registerRoomPresetRoutes } from "./preset-routes.ts"
export function registerRoomRoutes(
  app: Hono<AppEnv>,
  deps: {
    assignments: (c: AppContext) => AssignmentService
    service: (c: AppContext) => RoomService
    preset: (c: AppContext) => RoomPresetService
    ensure: (c: AppContext) => Promise<unknown>
  }
) {
  app.use("/api/game-rooms/*", async (c, next) => {
    await deps.ensure(c)
    await next()
  })
  app.use("/api/game-rooms", async (c, next) => {
    await deps.ensure(c)
    await next()
  })
  const actor = (c: AppContext) => ({
    tenantId: c.get("tenant").id,
    userId: c.get("identity").user.id,
  })
  const body = (c: AppContext) => c.req.json().catch(() => null)
  // Before the /:room routes so "preset" is never read as a room id.
  registerRoomPresetRoutes(app, { service: deps.preset, actor })
  async function action(c: AppContext, run: () => Promise<unknown>) {
    try {
      return c.json(await run())
    } catch (e) {
      if (e instanceof RoomError)
        return c.json(
          { error: e.code },
          e.code.endsWith("not_found")
            ? 404
            : e.code.startsWith("invalid_")
              ? 400
              : 409
        )
      throw e
    }
  }
  app.get("/api/game-rooms", (c) =>
    action(c, async () => ({ rooms: await deps.service(c).list(actor(c)) }))
  )
  app.post("/api/game-rooms", async (c) => {
    const input = roomInput.safeParse(await body(c))
    if (!input.success) return c.json({ error: "invalid_room_input" }, 400)
    return action(c, async () => ({
      room: await deps
        .service(c)
        .create(
          actor(c),
          input.data.region,
          input.data.kind,
          input.data.mode,
          input.data.name
        ),
    }))
  })
  app.delete("/api/game-rooms/:room", (c) =>
    action(c, async () => {
      await deps.service(c).deleteRoom(actor(c), c.req.param("room"))
      return { ok: true }
    })
  )
  app.get("/api/game-rooms/:room", (c) =>
    action(c, () => deps.service(c).detail(actor(c), c.req.param("room")))
  )
  app.post("/api/game-rooms/:room/participants", async (c) => {
    const input = participantInput.safeParse(await body(c))
    if (!input.success) return c.json({ error: "invalid_room_input" }, 400)
    return action(c, async () => {
      await deps.service(c).add(actor(c), c.req.param("room"), input.data.name)
      return { ok: true }
    })
  })
  app.delete("/api/game-rooms/:room/participants/:id", (c) =>
    action(c, async () => {
      await deps
        .service(c)
        .remove(actor(c), c.req.param("room"), c.req.param("id"))
      return { ok: true }
    })
  )
  app.post("/api/game-rooms/:room/assignments", async (c) => {
    const input = studentAssignmentInput.safeParse(await body(c))
    if (!input.success)
      return c.json({ error: "invalid_assignment_input" }, 400)
    return action(c, async () => ({
      assignment: await deps
        .assignments(c)
        .register(
          actor(c),
          c.req.param("room"),
          input.data,
          c.req.header("Origin") ?? new URL(c.req.url).origin
        ),
    }))
  })
  app.post("/api/game-rooms/:room/participants/:id/assignment", async (c) => {
    const input = studentAssignmentInput.safeParse(await body(c))
    if (!input.success)
      return c.json({ error: "invalid_assignment_input" }, 400)
    return action(c, async () => ({
      assignment: await deps
        .assignments(c)
        .register(
          actor(c),
          c.req.param("room"),
          { ...input.data, participantId: c.req.param("id") },
          c.req.header("Origin") ?? new URL(c.req.url).origin
        ),
    }))
  })
  app.post("/api/game-rooms/:room/participants/:id/assignment/retry", (c) =>
    action(c, async () => {
      await deps
        .assignments(c)
        .retry(actor(c), c.req.param("room"), c.req.param("id"))
      return { ok: true }
    })
  )
  registerRoomPlayRoutes(app, { service: deps.service, actor })
}
