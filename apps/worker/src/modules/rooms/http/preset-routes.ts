import type { Hono } from "hono"
import { roomPresetInput } from "@amautai/contracts"
import type { AppContext, AppEnv } from "../../../shared/http/context.ts"
import type { RoomPresetService } from "../application/preset-service.ts"
import { RoomPresetError } from "../domain/preset.ts"

const status = {
  teacher_required: 409,
  room_preset_disabled: 404,
  room_preset_not_found: 404,
  room_preset_unavailable: 503,
} as const satisfies Record<RoomPresetError["code"], number>

/** Registered after the room guards and before the /:room routes. */
export function registerRoomPresetRoutes(
  app: Hono<AppEnv>,
  deps: {
    service: (c: AppContext) => RoomPresetService
    actor: (c: AppContext) => { tenantId: string; userId: string }
  }
) {
  async function action(c: AppContext, run: () => Promise<unknown>) {
    try {
      return c.json(await run())
    } catch (error) {
      if (error instanceof RoomPresetError)
        return c.json({ error: error.code }, status[error.code])
      throw error
    }
  }
  app.get("/api/game-rooms/preset", (c) =>
    action(c, () => deps.service(c).recall(deps.actor(c)))
  )
  app.put("/api/game-rooms/preset", async (c) => {
    const input = roomPresetInput.safeParse(
      await c.req.json().catch(() => null)
    )
    if (!input.success) return c.json({ error: "invalid_room_input" }, 400)
    return action(c, async () => ({
      remembered: await deps.service(c).remember(deps.actor(c), input.data),
    }))
  })
  app.delete("/api/game-rooms/preset", (c) =>
    action(c, async () => {
      await deps.service(c).forget(deps.actor(c))
      return { forgotten: true }
    })
  )
}
