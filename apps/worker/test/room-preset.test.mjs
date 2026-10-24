import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { URL } from "node:url"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import http from "node:http"
import { DatabaseSync } from "node:sqlite"
import { readFileSync, readdirSync } from "node:fs"
import { createApp } from "../src/app.ts"
import { atomicRoomPresets } from "../src/modules/rooms/infrastructure/atomic-room-presets.ts"
import { presetSubject } from "../src/modules/rooms/domain/preset.ts"

// LOCAL TEST FIXTURE: an in-process HTTP server on 127.0.0.1 that implements
// the documented Atomic Memory routes Amautai uses for room defaults
// (ingest/quick, scoped list, DELETE). It is not the live service; it lets
// the real adapter run over real HTTP. `faults` can be changed mid-test.
async function atomicMemoryFixture() {
  const memories = []
  const calls = []
  const faults = {}
  const server = http.createServer(async (req, res) => {
    let raw = ""
    for await (const chunk of req) raw += chunk
    const url = new URL(req.url, "http://127.0.0.1")
    const body = raw ? JSON.parse(raw) : null
    const operation =
      req.method === "POST" && url.pathname === "/v1/memories/ingest/quick"
        ? "ingest"
        : req.method === "GET" && url.pathname === "/v1/memories/list"
          ? "read"
          : req.method === "DELETE"
            ? "delete"
            : "unknown"
    calls.push({ operation, method: req.method, url: req.url, body })
    const send = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json" })
      res.end(JSON.stringify(value))
    }
    if (req.headers.authorization !== "Bearer amc_test_fixture")
      return send(401, { error: "unauthorized" })
    if (faults.redirect) {
      res.writeHead(302, { Location: "http://127.0.0.1:1/elsewhere" })
      return res.end()
    }
    if (faults.delayMs) await delay(faults.delayMs)
    if (faults[operation]) return send(faults[operation], { error: "fixture" })
    const userId = body?.user_id ?? url.searchParams.get("user_id")
    if (operation === "ingest") {
      let row = memories.find(
        (m) =>
          (faults.cloud || m.user_id === userId) &&
          m.metadata?.externalId === body.metadata.externalId
      )
      const updated = !!row
      const id = row?.id ?? crypto.randomUUID()
      if (!faults.dropWrites) {
        if (!row) {
          row = { id }
          memories.push(row)
        }
        Object.assign(row, {
          user_id: userId,
          content: body.conversation,
          source_site: body.source_site,
          metadata: body.metadata,
          created_at: new Date().toISOString(),
        })
      }
      return send(
        200,
        (faults.ingestReceipt ?? ((r) => r))({
          episode_id: crypto.randomUUID(),
          facts_extracted: 0,
          memories_stored: 1,
          memories_updated: 0,
          memories_deleted: 0,
          memories_skipped: 0,
          stored_memory_ids: updated ? [] : [id],
          updated_memory_ids: updated ? [id] : [],
          links_created: 0,
          composites_created: 0,
        })
      )
    }
    if (operation === "read") {
      const rows = memories
        .filter(
          (m) =>
            m.user_id === userId &&
            m.source_site === url.searchParams.get("source_site")
        )
        .map((m) => ({
          ...m,
          ...(faults.cloud
            ? { user_id: "project:fixture", session_id: m.user_id }
            : {}),
          ...(faults.tamperRead ?? {}),
          embedding: [],
          memory_type: "semantic",
          importance: 0.5,
          status: "active",
        }))
      return send(
        200,
        faults.listBody ?? { memories: rows, count: rows.length }
      )
    }
    if (operation === "delete") {
      const id = decodeURIComponent(url.pathname.split("/").pop())
      const index = memories.findIndex(
        (m) => m.id === id && m.user_id === userId
      )
      if (index < 0) return send(404, { error: "not found" })
      const receipt =
        faults.deleteBody ??
        (faults.cloud ? { deleted: true, id } : { success: true })
      // A malformed receipt, or a stale provider, leaves the record in place.
      if (
        (receipt.success === true ||
          (receipt.deleted === true && receipt.id === id)) &&
        !faults.staleDelete
      )
        memories.splice(index, 1)
      return send(200, receipt)
    }
    send(404, { error: "unknown fixture route" })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    memories,
    calls,
    faults,
    close: () => {
      server.closeAllConnections()
      return new Promise((resolve) => server.close(resolve))
    },
  }
}

function setup(env = {}) {
  const db = new DatabaseSync(":memory:")
  const migrations = new URL("../migrations/", import.meta.url)
  for (const name of readdirSync(migrations)
    .filter((n) => n.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(new URL(name, migrations), "utf8"))
  db.exec(
    "INSERT INTO tenants(id,kind,name,created_by) VALUES('user:alice','personal','Alice','alice'),('user:bob','personal','Bob','bob'),('user:carla','personal','Carla','carla');" +
      "INSERT INTO account_profiles(tenant_id,user_id,role) VALUES('user:alice','alice','teacher'),('user:bob','bob','teacher'),('user:carla','carla','parent')"
  )
  for (const user of ["alice", "bob"])
    db.prepare(
      "INSERT INTO teacher_profiles(tenant_id,user_id,data) VALUES(?,?,?)"
    ).run("user:" + user, user, JSON.stringify({ role: "teacher" }))
  const DB = {
    async batch(statements) {
      const results = []
      for (const statement of statements) results.push(await statement.run())
      return results
    },
    prepare(sql) {
      let args = []
      return {
        bind(...values) {
          args = values
          return this
        },
        async run() {
          return {
            meta: { changes: Number(db.prepare(sql).run(...args).changes) },
          }
        },
        async first() {
          return db.prepare(sql).get(...args) || null
        },
        async all() {
          return { results: db.prepare(sql).all(...args) }
        },
      }
    },
  }
  const app = createApp(async (c) => {
    const id = c.req.header("x-test-user")
    if (!id) return null
    return {
      sessionId: "test-session",
      user: {
        id,
        email: id + "@example.test",
        emailVerified: true,
        firstName: id,
        lastName: null,
        profilePictureUrl: null,
      },
    }
  })
  return async (
    path,
    { method = "GET", data, user = "alice", csrf = true } = {}
  ) => {
    const response = await app.request(
      "http://localhost:5173/api/game-rooms" + path,
      {
        method,
        headers: {
          ...(user ? { "x-test-user": user } : {}),
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
          ...(csrf ? { "X-Amautai-Request": "1" } : {}),
        },
        ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      },
      { DB, APP_ORIGINS: "http://localhost:5173", ...env },
      { waitUntil() {}, passThroughOnException() {}, props: {} }
    )
    return { status: response.status, body: await response.json() }
  }
}
const enabled = (fixture) => ({
  ROOM_PRESET_MEMORY_ENABLED: "true",
  ATOMICMEMORY_API_URL: fixture.url,
  ATOMICMEMORY_API_KEY: "amc_test_fixture",
})
const market = { kind: "market", mode: "practice", region: "highlands" }
const builder = { kind: "builder", mode: "challenge", region: "jungle" }
const remember = (request, preset, user) =>
  request("/preset", { method: "PUT", data: preset, user })

test("room defaults are disabled by default, never contact the provider, and room creation still works", async () => {
  const fixture = await atomicMemoryFixture()
  try {
    for (const env of [
      {},
      { ATOMICMEMORY_API_URL: fixture.url, ATOMICMEMORY_API_KEY: "amc_x" },
      { ...enabled(fixture), ATOMICMEMORY_API_KEY: "" },
      { ...enabled(fixture), ATOMICMEMORY_API_URL: "http://example.com" },
      { ...enabled(fixture), ATOMICMEMORY_API_URL: "https://u:p@example.com" },
      {
        ...enabled(fixture),
        ATOMICMEMORY_API_URL: fixture.url + "?other=path",
      },
      { ...enabled(fixture), ATOMICMEMORY_API_URL: fixture.url + "#fragment" },
      {
        ...enabled(fixture),
        ATOMICMEMORY_API_URL: fixture.url + "/unexpected",
      },
    ]) {
      const request = setup(env)
      assert.deepEqual((await request("/preset")).body, { kind: "disabled" })
      assert.deepEqual(await remember(request, market), {
        status: 404,
        body: { error: "room_preset_disabled" },
      })
      const created = await request("", {
        method: "POST",
        data: { name: "2.º A", ...market },
      })
      assert.equal(created.status, 200)
      assert.equal(created.body.room.kind, "market")
    }
    assert.equal(fixture.calls.length, 0)
  } finally {
    await fixture.close()
  }
})

test("a teacher remembers, recalls and reuses typed options without room or student names", async () => {
  const fixture = await atomicMemoryFixture()
  try {
    const request = setup(enabled(fixture))
    assert.deepEqual((await request("/preset")).body, {
      kind: "enabled",
      remembered: null,
    })
    const room = await request("", {
      method: "POST",
      data: { name: "Sala privada de Rosa Quispe", ...market },
    })
    await request("/" + room.body.room.id + "/participants", {
      method: "POST",
      data: { name: "Juan Pérez" },
    })
    const saved = await remember(request, market)
    assert.equal(saved.status, 200)
    assert.deepEqual(saved.body.remembered.preset, market)
    const ingest = fixture.calls.find((c) => c.operation === "ingest")
    assert.equal(ingest.body.user_id, "amautai:user:alice:teacher:alice")
    assert.equal(ingest.body.content_class, "summary")
    assert.equal(ingest.body.skip_extraction, true)
    assert.deepEqual(ingest.body.metadata, {
      externalId:
        "amautai-room-preset-v1-" +
        crypto
          .createHash("sha256")
          .update("amautai:user:alice:teacher:alice")
          .digest("hex"),
      preset: market,
    })
    const sent = JSON.stringify(fixture.calls)
    for (const name of ["Rosa", "Quispe", "Juan", "Pérez", "Sala privada"])
      assert.equal(sent.includes(name), false, name)
    const recalled = await request("/preset")
    assert.deepEqual(recalled.body.remembered, saved.body.remembered)
    // The recalled options create a real room through the unchanged route.
    const next = await request("", {
      method: "POST",
      data: { name: "2.º B", ...recalled.body.remembered.preset },
    })
    assert.equal(next.status, 200)
    assert.deepEqual(
      {
        kind: next.body.room.kind,
        mode: next.body.room.mode,
        region: next.body.room.region,
      },
      market
    )
    // Cargo rooms are always challenges, as in room creation.
    const cargo = await remember(request, {
      kind: "cargo",
      mode: "practice",
      region: "coast",
    })
    assert.deepEqual(cargo.body.remembered.preset, {
      kind: "cargo",
      mode: "challenge",
      region: "coast",
    })
  } finally {
    await fixture.close()
  }
})

test("a correction replaces the single preset and forgetting requires a receipt and absence", async () => {
  const fixture = await atomicMemoryFixture()
  try {
    const request = setup(enabled(fixture))
    const ingests = () => fixture.calls.filter((c) => c.operation === "ingest")
    assert.equal((await remember(request, market)).status, 200)
    assert.equal((await remember(request, market)).status, 200)
    assert.equal(ingests().length, 1, "same options are not written twice")
    const corrected = await remember(request, builder)
    assert.equal(corrected.status, 200)
    assert.deepEqual(corrected.body.remembered.preset, builder)
    assert.equal(fixture.memories.length, 1)
    assert.deepEqual(fixture.memories[0].metadata.preset, builder)
    assert.equal(
      fixture.calls.filter((c) => c.operation === "delete").length,
      0,
      "correction updates by external id without deleting the previous record first"
    )
    assert.deepEqual(await request("/preset", { method: "DELETE" }), {
      status: 200,
      body: { forgotten: true },
    })
    assert.equal(fixture.memories.length, 0)
    assert.equal((await request("/preset")).body.remembered, null)
    assert.deepEqual(await request("/preset", { method: "DELETE" }), {
      status: 404,
      body: { error: "room_preset_not_found" },
    })
  } finally {
    await fixture.close()
  }
})

test("teachers never read or forget another account's preset; guards match rooms", async () => {
  const fixture = await atomicMemoryFixture()
  try {
    const request = setup(enabled(fixture))
    await remember(request, market, "alice")
    assert.equal(
      (await request("/preset", { user: "bob" })).body.remembered,
      null
    )
    const before = fixture.calls.filter((c) => c.operation === "delete").length
    assert.deepEqual(
      await request("/preset", { method: "DELETE", user: "bob" }),
      {
        status: 404,
        body: { error: "room_preset_not_found" },
      }
    )
    assert.equal(
      fixture.calls.filter((c) => c.operation === "delete").length,
      before
    )
    assert.equal(fixture.memories.length, 1)
    const subjects = new Set(
      fixture.calls.map(
        (c) =>
          c.body?.user_id ??
          new URL(c.url, "http://x").searchParams.get("user_id")
      )
    )
    assert.deepEqual([...subjects].sort(), [
      "amautai:user:alice:teacher:alice",
      "amautai:user:bob:teacher:bob",
    ])
    const calls = fixture.calls.length
    assert.deepEqual(await request("/preset", { user: "carla" }), {
      status: 409,
      body: { error: "teacher_required" },
    })
    assert.equal((await request("/preset", { user: null })).status, 401)
    assert.equal(
      (await request("/preset", { method: "PUT", data: market, csrf: false }))
        .status,
      403
    )
    assert.equal(
      (await request("/preset", { method: "DELETE", csrf: false })).status,
      403
    )
    assert.equal(fixture.calls.length, calls)
  } finally {
    await fixture.close()
  }
})

test("invalid presets, legacy games and names are rejected before any provider call", async () => {
  const fixture = await atomicMemoryFixture()
  try {
    const request = setup(enabled(fixture))
    for (const data of [
      null,
      { ...market, kind: "data" },
      { mode: "practice", region: "coast" },
      { kind: "market", region: "coast" },
      { ...market, region: "andes" },
      { ...market, name: "2.º A" },
      { ...market, studentName: "Juan" },
    ])
      assert.deepEqual(await remember(request, data), {
        status: 400,
        body: { error: "invalid_room_input" },
      })
    assert.equal(fixture.calls.length, 0)
  } finally {
    await fixture.close()
  }
})

test("provider failures and unverifiable receipts are never reported as saved or forgotten", async () => {
  const fixture = await atomicMemoryFixture()
  const unavailable = {
    status: 503,
    body: { error: "room_preset_unavailable" },
  }
  try {
    const request = setup(enabled(fixture))
    for (const fault of [
      { ingest: 500 },
      { read: 500 },
      { redirect: true },
      { dropWrites: true },
      { ingestReceipt: (r) => ({ ...r, stored_memory_ids: [] }) },
      { ingestReceipt: (r) => ({ ...r, stored_memory_ids: ["other-id"] }) },
      { ingestReceipt: () => ({ ok: true }) },
    ]) {
      Object.assign(fixture.faults, fault)
      assert.deepEqual(await remember(request, market), unavailable)
      for (const key of Object.keys(fault)) delete fixture.faults[key]
      fixture.memories.length = 0
    }
    assert.equal(
      fixture.calls.some((c) => c.url.includes("elsewhere")),
      false,
      "redirects are not followed"
    )
    // Readback outside this source or with a different preset is rejected.
    fixture.faults.tamperRead = { source_site: "another-site" }
    assert.deepEqual(await remember(request, market), unavailable)
    delete fixture.faults.tamperRead
    fixture.memories.length = 0

    assert.equal((await remember(request, market)).status, 200)
    for (const fault of [
      { delete: 500 },
      { deleteBody: {} },
      { deleteBody: { success: false } },
      { staleDelete: true },
    ]) {
      Object.assign(fixture.faults, fault)
      assert.deepEqual(
        await request("/preset", { method: "DELETE" }),
        unavailable
      )
      assert.equal(fixture.memories.length, 1, JSON.stringify(fault))
      for (const key of Object.keys(fault)) delete fixture.faults[key]
    }
    // A failed replacement preserves the previous choices.
    fixture.faults.ingest = 500
    assert.deepEqual(await remember(request, builder), unavailable)
    delete fixture.faults.ingest
    assert.deepEqual((await request("/preset")).body.remembered.preset, market)
  } finally {
    await fixture.close()
  }
})

test("all provider calls in one operation share a single deadline", async () => {
  const fixture = await atomicMemoryFixture()
  try {
    fixture.faults.delayMs = 150
    const store = atomicRoomPresets({
      enabled: "true",
      apiUrl: fixture.url,
      apiKey: "amc_test_fixture",
      timeoutMs: 250,
    })
    const subject = presetSubject({ tenantId: "demo", userId: "alice" })
    assert.equal(await store.read(subject), null)
    await assert.rejects(store.write(subject, market), {
      code: "room_preset_unavailable",
    })
  } finally {
    await fixture.close()
  }
})

test("Hosted Cloud scope projection, list lookup, and deletion receipt work together", async () => {
  const fixture = await atomicMemoryFixture()
  fixture.faults.cloud = true
  try {
    const request = setup(enabled(fixture))
    assert.equal((await remember(request, market)).status, 200)
    const id = fixture.memories[0].id
    assert.deepEqual((await request("/preset")).body.remembered.preset, market)
    assert.equal(
      (await request("/preset", { user: "bob" })).body.remembered,
      null
    )
    // Cloud deduplicates by externalId across the project, not subject.
    assert.equal((await remember(request, market, "bob")).status, 200)
    assert.equal(fixture.memories.length, 2)
    assert.notEqual(
      fixture.memories[0].metadata.externalId,
      fixture.memories[1].metadata.externalId
    )
    assert.deepEqual((await request("/preset")).body.remembered.preset, market)
    assert.equal(
      (await request("/preset", { method: "DELETE", user: "bob" })).status,
      200
    )
    assert.deepEqual((await request("/preset")).body.remembered.preset, market)
    assert.equal((await remember(request, builder)).status, 200)
    assert.equal(fixture.memories[0].id, id)
    assert.deepEqual((await request("/preset")).body.remembered.preset, builder)
    const reads = fixture.calls.filter((c) => c.operation === "read")
    for (const call of reads) {
      const url = new URL(call.url, fixture.url)
      assert.equal(url.pathname, "/v1/memories/list")
      assert.equal(url.searchParams.get("source_site"), "amautai-room-defaults")
      assert.equal(url.searchParams.get("limit"), "2")
    }
    assert.deepEqual(await request("/preset", { method: "DELETE" }), {
      status: 200,
      body: { forgotten: true },
    })
    assert.equal((await request("/preset")).body.remembered, null)
  } finally {
    await fixture.close()
  }
})

test("list responses reject foreign subjects, wrong source/id, duplicates and malformed pages", async () => {
  const fixture = await atomicMemoryFixture()
  try {
    const request = setup(enabled(fixture))
    await remember(request, market)
    const unavailable = {
      status: 503,
      body: { error: "room_preset_unavailable" },
    }
    for (const tamperRead of [
      { user_id: "another-teacher" },
      { user_id: "project:fixture", session_id: "another-teacher" },
      { user_id: "project:", session_id: "amautai:user:alice:teacher:alice" },
      { source_site: "another-source" },
      {
        metadata: { ...fixture.memories[0].metadata, externalId: "another-id" },
      },
    ]) {
      fixture.faults.tamperRead = tamperRead
      assert.deepEqual(await request("/preset"), unavailable)
    }
    delete fixture.faults.tamperRead
    const row = fixture.memories[0]
    for (const listBody of [
      {},
      { memories: [], count: 1 },
      { memories: [row], count: 0 },
      { memories: [row, row], count: 2 },
      { memories: [], count: -1 },
    ]) {
      fixture.faults.listBody = listBody
      assert.deepEqual(await request("/preset"), unavailable)
    }
    delete fixture.faults.listBody
    for (const deleteBody of [
      { deleted: false, id: row.id },
      { deleted: true, id: "another-id" },
      { deleted: true },
    ]) {
      fixture.faults.deleteBody = deleteBody
      assert.deepEqual(
        await request("/preset", { method: "DELETE" }),
        unavailable
      )
      assert.equal(fixture.memories.length, 1)
    }
  } finally {
    await fixture.close()
  }
})
