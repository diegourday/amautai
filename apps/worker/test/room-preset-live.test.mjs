import { test } from "node:test"
import process from "node:process"
import crypto from "node:crypto"
import assert from "node:assert/strict"
import { atomicRoomPresets } from "../src/modules/rooms/infrastructure/atomic-room-presets.ts"
import { roomPresetService } from "../src/modules/rooms/application/preset-service.ts"
import { presetSubject } from "../src/modules/rooms/domain/preset.ts"

// Explicit opt-in only: this creates and removes synthetic data in the configured
// real provider. Never use a real teacher's subject or log the server credential.
test(
  "real Atomic Memory saves, recalls, updates, isolates and forgets presets",
  { skip: process.env.ATOMICMEMORY_LIVE_TEST !== "true" },
  async (t) => {
    assert.ok(process.env.ATOMICMEMORY_API_URL, "API URL is required")
    assert.ok(process.env.ATOMICMEMORY_API_KEY, "Server API key is required")
    const actor = {
      tenantId: "amautai-integration-test",
      userId: "pr-1-" + crypto.randomUUID(),
    }
    const other = { ...actor, userId: actor.userId + "-other" }
    const store = () =>
      atomicRoomPresets({
        enabled: "true",
        apiUrl: process.env.ATOMICMEMORY_API_URL,
        apiKey: process.env.ATOMICMEMORY_API_KEY,
      })
    const service = () =>
      roomPresetService(store(), { teacher: async () => true })
    t.after(async () => {
      for (const owner of [actor, other]) {
        if ((await service().recall(owner)).remembered)
          await service().forget(owner)
        assert.equal((await service().recall(owner)).remembered, null)
      }
    })
    const first = { kind: "market", mode: "practice", region: "highlands" }
    const second = { kind: "builder", mode: "challenge", region: "jungle" }
    assert.equal((await service().recall(actor)).remembered, null)
    assert.deepEqual((await service().remember(actor, first)).preset, first)
    assert.deepEqual((await service().recall(actor)).remembered.preset, first)
    const originalId = (await store().read(presetSubject(actor))).id
    assert.equal((await service().recall(other)).remembered, null)
    await assert.rejects(service().forget(other), {
      code: "room_preset_not_found",
    })
    await service().remember(other, first)
    assert.deepEqual((await service().recall(other)).remembered.preset, first)
    assert.notEqual((await store().read(presetSubject(other))).id, originalId)
    await service().remember(other, second)
    assert.deepEqual((await service().recall(actor)).remembered.preset, first)
    assert.deepEqual((await service().recall(other)).remembered.preset, second)
    await service().remember(actor, second)
    assert.deepEqual((await service().recall(actor)).remembered.preset, second)
    assert.equal((await store().read(presetSubject(actor))).id, originalId)
    await service().forget(actor)
    assert.equal((await service().recall(actor)).remembered, null)
    assert.deepEqual((await service().recall(other)).remembered.preset, second)
    await service().forget(other)
    assert.equal((await service().recall(other)).remembered, null)
  }
)
