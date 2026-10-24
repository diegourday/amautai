import { assignmentService } from "./modules/rooms/application/assignment-service.ts"
import type { AssignmentMessenger } from "./modules/rooms/application/assignment-service.ts"
import { d1Assignments } from "./modules/rooms/infrastructure/d1-assignments.ts"
import { assignmentCrypto } from "./modules/rooms/infrastructure/assignment-crypto.ts"
import { registerAssignedGameRoutes } from "./modules/rooms/http/assignment-routes.ts"
import { familyGameService } from "./modules/rooms/application/family-service.ts"
import { d1FamilyGames } from "./modules/rooms/infrastructure/d1-family-games.ts"
import { registerFamilyGameRoutes } from "./modules/rooms/http/family-routes.ts"
import { authMailer } from "./modules/auth/infrastructure/auth-mailer.ts"
import { roomService } from "./modules/rooms/application/service.ts"
import { d1Rooms } from "./modules/rooms/infrastructure/d1-rooms.ts"
import { registerRoomRoutes } from "./modules/rooms/http/routes.ts"
import { roomPresetService } from "./modules/rooms/application/preset-service.ts"
import { atomicRoomPresets } from "./modules/rooms/infrastructure/atomic-room-presets.ts"
import { educationService } from "./modules/education/application/service.ts"
import { d1Education } from "./modules/education/infrastructure/d1-education.ts"
import { registerEducationRoutes } from "./modules/education/http/routes.ts"
import { activityPreferences } from "./modules/notifications/application/activity-service.ts"
import { d1Activity } from "./modules/notifications/infrastructure/d1-activity.ts"
import { registerActivityRoutes } from "./modules/notifications/http/activity-routes.ts"
import { emailService } from "./modules/notifications/application/email-service.ts"
import { d1Email } from "./modules/notifications/infrastructure/d1-email.ts"
import { stalwartEmail } from "./modules/notifications/infrastructure/stalwart-email.ts"
import { registerEmailRoutes } from "./modules/notifications/http/email-routes.ts"
import type { WhatsAppGateway } from "./modules/notifications/application/ports.ts"
import { notificationService } from "./modules/notifications/application/service.ts"
import { dispatchNotifications } from "./modules/notifications/application/service.ts"
import { dispatchProfileWelcomes } from "./modules/profiles/application/service.ts"
import { d1Notifications } from "./modules/notifications/infrastructure/d1-notifications.ts"
import { whatsappGateway } from "./modules/notifications/infrastructure/gateway.ts"
import { verificationCrypto } from "./modules/notifications/infrastructure/crypto.ts"
import { registerNotificationRoutes } from "./modules/notifications/http/routes.ts"
import { Hono } from "hono"
import type { AppContext, AppEnv } from "./shared/http/context.ts"
import type { Identity } from "./shared/domain/identity.ts"
import { createAuthService } from "./modules/auth/application/auth-service.ts"
import { client, workosGateway } from "./modules/auth/infrastructure/workos.ts"
import { resolveWorkosSession } from "./modules/auth/infrastructure/session-verifier.ts"
import { resolveIdentity } from "./modules/auth/http/sessions.ts"
import { registerAuthRoutes } from "./modules/auth/http/routes.ts"
import {
  familyProfileService,
  profileService,
} from "./modules/profiles/application/service.ts"
import { d1Profiles } from "./modules/profiles/infrastructure/d1-profiles.ts"
import { d1FamilyProfiles } from "./modules/profiles/infrastructure/d1-family-profiles.ts"
import { registerProfileRoutes } from "./modules/profiles/http/routes.ts"
import { registerFamilyProfileRoutes } from "./modules/profiles/http/family-routes.ts"
import { createWorkspaceService } from "./modules/workspace/application/workspace-service.ts"
import { d1Workspaces } from "./modules/workspace/infrastructure/d1-workspaces.ts"
import { createProjectService } from "./modules/projects/application/project-service.ts"
import { d1Projects } from "./modules/projects/infrastructure/d1-projects.ts"
import {
  registerProjectRoutes,
  handleApiError,
} from "./modules/projects/http/routes.ts"
export function createApp(
  authenticate: (c: AppContext) => Promise<Identity | null> = (c) =>
    resolveIdentity(c, (cookie) => resolveWorkosSession(cookie, c.env)),
  provider: (c: AppContext) => Parameters<typeof workosGateway>[0] = (c) =>
    client(c.env),
  gateway: (c: AppContext) => WhatsAppGateway = (c) =>
    whatsappGateway(c.env.WHATSAPP_GATEWAY_URL, c.env.WHATSAPP_GATEWAY_TOKEN)
) {
  const app = new Hono<AppEnv>()
  const workspace = (c: AppContext) =>
    createWorkspaceService(d1Workspaces(c.env.DB))
  async function ensureTenant(c: AppContext) {
    const tenant = await workspace(c).ensure(c.get("identity"))
    c.set("tenant", tenant)
    return tenant
  }
  async function ensureTeacher(c: AppContext) {
    await ensureTenant(c)
    const profile = await d1Profiles(c.env.DB).find({
      tenantId: c.get("tenant").id,
      userId: c.get("identity").user.id,
    })
    return profile?.role === "teacher"
  }
  async function ensureParent(c: AppContext) {
    await ensureTenant(c)
    const profile = await d1Profiles(c.env.DB).find({
      tenantId: c.get("tenant").id,
      userId: c.get("identity").user.id,
    })
    return profile?.role === "parent"
  }
  const assignments = (c: AppContext) =>
    assignmentService({
      repo: d1Assignments(c.env.DB),
      rooms: d1Rooms(c.env.DB),
      crypto: assignmentCrypto(),
      id: () => crypto.randomUUID(),
    })
  registerAuthRoutes(app, {
    publicRoutes: (app) =>
      registerAssignedGameRoutes(app, {
        assignments,
        service: (c) =>
          roomService(d1Rooms(c.env.DB), () => crypto.randomUUID()),
      }),
    authenticate,
    service: (c) =>
      createAuthService(
        workosGateway(provider(c)),
        c.env.AUTH_EMAIL_MODE === "custom"
          ? authMailer(
              stalwartEmail({
                sessionUrl: c.env.EMAIL_JMAP_SESSION_URL,
                username: c.env.EMAIL_JMAP_USERNAME,
                password: c.env.EMAIL_JMAP_PASSWORD,
                from: c.env.EMAIL_FROM,
              })
            )
          : undefined
      ),
    ensureTenant,
    healthy: (c) => workspace(c).healthy(),
  })
  registerProfileRoutes(app, {
    service: (c) => profileService(d1Profiles(c.env.DB)),
    ensure: ensureTenant,
    registered(c, actor) {
      c.executionCtx.waitUntil(
        (async () => {
          const profiles = d1Profiles(c.env.DB)
          const repo = d1Notifications(c.env.DB)
          const messenger = gateway(c)
          const notifications = notificationService(repo, messenger, {
            id: () => crypto.randomUUID(),
          })
          await dispatchProfileWelcomes(
            profiles,
            notifications.welcome,
            Date.now(),
            actor
          )
          await dispatchNotifications(repo, messenger, Date.now(), {
            ...actor,
            requestKey: "account-welcome-v1",
          })
        })().catch(() => {
          // The persistent outboxes retain the welcome for the scheduled retry.
          console.info("amautai_profile_welcome_deferred")
        })
      )
    },
  })
  registerFamilyProfileRoutes(app, {
    service: (c) => familyProfileService(d1FamilyProfiles(c.env.DB)),
    ensureParent,
  })
  registerProjectRoutes(
    app,
    (c) =>
      createProjectService(d1Projects(c.env.DB), () => crypto.randomUUID()),
    async (c) => {
      await ensureTenant(c)
    }
  )
  registerEducationRoutes(app, {
    service: (c) =>
      educationService(d1Education(c.env.DB), () => crypto.randomUUID()),
    ensure: ensureTeacher,
  })
  registerFamilyGameRoutes(app, {
    service: (c) =>
      familyGameService(d1FamilyGames(c.env.DB), () => crypto.randomUUID()),
    ensureParent,
  })
  registerRoomRoutes(app, {
    assignments,
    service: (c) => roomService(d1Rooms(c.env.DB), () => crypto.randomUUID()),
    preset: (c) =>
      roomPresetService(
        atomicRoomPresets({
          enabled: c.env.ROOM_PRESET_MEMORY_ENABLED,
          apiUrl: c.env.ATOMICMEMORY_API_URL,
          apiKey: c.env.ATOMICMEMORY_API_KEY,
        }),
        d1Rooms(c.env.DB)
      ),
    ensure: ensureTenant,
  })
  registerNotificationRoutes(
    app,
    (c) =>
      notificationService(
        d1Notifications(c.env.DB),
        gateway(c),
        verificationCrypto(c.env.WORKOS_COOKIE_PASSWORD)
      ),
    async (c) => {
      await ensureTenant(c)
    }
  )
  registerEmailRoutes(app, (c) =>
    emailService(
      d1Email(c.env.DB),
      stalwartEmail({
        sessionUrl: c.env.EMAIL_JMAP_SESSION_URL,
        username: c.env.EMAIL_JMAP_USERNAME,
        password: c.env.EMAIL_JMAP_PASSWORD,
        from: c.env.EMAIL_FROM,
      }),
      verificationCrypto(c.env.WORKOS_COOKIE_PASSWORD)
    )
  )
  registerActivityRoutes(app, {
    service: (c) => activityPreferences(d1Activity(c.env.DB)),
    channels: async (c) => {
      const actor = {
        tenantId: c.get("tenant").id,
        userId: c.get("identity").user.id,
      }
      const [email, whatsapp] = await Promise.all([
        d1Email(c.env.DB).contact(actor),
        d1Notifications(c.env.DB).contact(actor),
      ])
      return {
        email: {
          configured: !!c.env.EMAIL_FROM,
          verified: c.get("identity").user.emailVerified,
          optedOut: !!email?.opted_out,
        },
        whatsapp: { registered: !!whatsapp?.phone && !!whatsapp.consent_at },
      }
    },
  })
  app.onError(handleApiError)
  app.notFound((c) => c.json({ error: "not_found" }, 404))
  return app
}

export function assignmentMessenger(
  gateway: WhatsAppGateway
): AssignmentMessenger {
  return {
    async send(a) {
      return (
        await gateway.send({
          tenantId: a.tenantId,
          userId: a.userId,
          id: a.deliveryId,
          kind: "reminder",
          phone: a.guardianPhone,
          title: "Actividad asignada",
          body: a.messageBody,
          status: "pending",
          scheduled_at: a.createdAt,
          expires_at: a.expiresAt,
          created_at: a.createdAt,
          attempts: a.attempts,
          request_key: a.requestKey,
        })
      ).status
    },
    async status(id) {
      return (await gateway.status(id))?.status ?? null
    },
  }
}
