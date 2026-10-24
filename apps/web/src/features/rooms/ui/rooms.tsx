import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import type {
  CargoRegion,
  CargoParticipant,
  CargoRoom,
  RoomPreset,
} from "@amautai/contracts"
import { useAuth } from "@/features/auth"
import { useMessages } from "@/shared/i18n/use-messages"
import { familyHomePath } from "../model/family-catalog"
import { useRooms } from "../model/use-rooms"
import { BuilderPlayer } from "./builder-player"
import { FairPlayer } from "./fair-player"
import { NurseryPlayer } from "./nursery-player"
import { MarketPlayer } from "./market-player"
import { CargoPlayer } from "./cargo-player"
import { RoomPresetPanel } from "./room-preset"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { PhoneInput } from "@/shared/ui/phone-input"
import { nationalPhone, isPeruvianMobile } from "@/shared/lib/peruvian-phone"
import {
  Field,
  FieldLabel,
  FieldDescription,
} from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@workspace/ui/components/alert-dialog"
const assignmentStatusLabels = {
  pending: "En cola de envío",
  dispatching: "Enviando enlace…",
  accepted: "En cola de WhatsApp",
  sent: "Enlace enviado",
  delivered: "Enlace entregado",
  read: "Mensaje leído",
  failed: "No se pudo enviar",
  expired: "Envío vencido",
  cancelled: "Envío cancelado",
  uncertain: "Envío por confirmar",
}
const gameNames = {
  builder: "Constructores del Perú · Figuras y orientación",
  data: "La feria de los datos · Gráficos y decisiones",
  fair: "La feria del equilibrio · Igualdades y equivalencias",
  cargo: "Alimenta a tu comunidad · Multiplicación",
  market: "La ruta del mercado · Sumas y restas",
  nursery: "El vivero de las decenas · Unidades y decenas",
}
const availableGames = Object.entries(gameNames).filter(
  ([kind]) => kind !== "data"
)
const regions = { coast: "Costa", highlands: "Sierra", jungle: "Selva" }
const modes = {
  practice: "Práctica adaptativa",
  challenge: "Desafío de la sala",
}
export function Rooms() {
  const { roomId, participantId } = useParams()
  return participantId && roomId ? (
    <RoomPlayer
      key={roomId + participantId}
      roomId={roomId}
      participantId={participantId}
    />
  ) : (
    <RoomManager key={roomId ?? "list"} roomId={roomId} />
  )
}
export function RoomPlayer({
  roomId,
  participantId,
  family = false,
}: {
  roomId: string
  participantId: string
  family?: boolean
}) {
  const data = useRooms(roomId),
    { m } = useMessages()
  const backTo = family
    ? familyHomePath(data.room?.familyChildId)
    : "/panel/salas/" + roomId
  const back = (
    <Button
      nativeButton={false}
      variant="outline"
      render={<Link to={backTo} />}
    >
      {m(family ? "Mis juegos" : "Ver resultados")}
    </Button>
  )
  if (data.loadError)
    return (
      <div role="alert" className="space-y-3">
        <p>{m(data.loadError)}</p>
        <Button onClick={data.refresh}>{m("Reintentar")}</Button>
        {back}
      </div>
    )
  if (!data.room) return <p role="status">{m("Cargando el juego…")}</p>
  if (family && !data.room.familyChildId)
    return (
      <div className="space-y-3">
        <p role="alert">{m("Esta partida no pertenece a tu familia.")}</p>
        {back}
      </div>
    )
  if (data.room.kind === "data")
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">{m("Juego reemplazado")}</h1>
        <p>
          {m(
            "La feria de los datos fue reemplazada por Constructores del Perú. Los resultados anteriores se conservan."
          )}
        </p>
        {back}
      </section>
    )
  const props = { roomId, participantId, returnTo: family ? backTo : undefined }
  const nextStudent = family
    ? undefined
    : data.participants.find((p) => p.id !== participantId && !p.started)
  if (data.room.kind === "builder")
    return <BuilderPlayer {...props} nextStudent={nextStudent} />
  if (data.room.kind === "fair")
    return <FairPlayer {...props} nextStudent={nextStudent} />
  if (data.room.kind === "nursery")
    return <NurseryPlayer {...props} nextStudent={nextStudent} />
  if (data.room.kind === "market") return <MarketPlayer {...props} />
  return <CargoPlayer {...props} />
}
function RoomManager({ roomId }: { roomId?: string }) {
  const { m, formatDate, locale } = useMessages()
  const nav = useNavigate()
  const data = useRooms(roomId)
  const [region, setRegion] = useState<CargoRegion>("coast")
  const [kind, setKind] = useState<RoomPreset["kind"]>("builder")
  const [mode, setMode] = useState<CargoRoom["mode"]>("practice")
  const [name, setName] = useState("")
  const [guardianPhone, setGuardianPhone] = useState("")
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [assigning, setAssigning] = useState<CargoParticipant | null>(null)
  const [roomName, setRoomName] = useState("")
  const [creating, setCreating] = useState(false)
  const showCreate = creating || (!data.loading && !data.rooms.length)
  const [deletingRoom, setDeletingRoom] = useState<CargoRoom | null>(null)
  const [removing, setRemoving] = useState<CargoParticipant | null>(null)
  // Remount remembered options per account so nothing outlives an identity.
  const { user, tenant } = useAuth()
  const presetOwner = tenant && user ? tenant.id + ":" + user.id : null
  const preset: RoomPreset = {
    kind,
    mode: kind !== "cargo" ? mode : "challenge",
    region,
  }
  const number = new Intl.NumberFormat(locale)
  const items = (Object.keys(regions) as CargoRegion[]).map((value) => ({
    value,
    label: m(regions[value]),
  }))
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold break-words">
            {roomId
              ? data.room?.name || m("Sala de juego")
              : m("Salas de juego")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {roomId
              ? m(gameNames[data.room?.kind ?? kind])
              : m("Matemática · 2.º de Primaria")}
          </p>
        </div>
        {!roomId && data.rooms.length > 0 && (
          <Button
            variant={creating ? "outline" : "default"}
            onClick={() => setCreating(!creating)}
            aria-expanded={creating}
            aria-controls="create-room-form"
            disabled={data.busy}
          >
            {m(creating ? "Cancelar" : "Crear sala")}
          </Button>
        )}
        {roomId && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={data.busy || data.loading}
              onClick={data.refresh}
            >
              {m("Actualizar")}
            </Button>
            {data.room && (
              <Button
                variant="ghost"
                disabled={data.busy || data.loading}
                onClick={() => setDeletingRoom(data.room)}
              >
                {m("Eliminar sala")}
              </Button>
            )}
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link to="/panel/salas" />}
            >
              {m("Ver salas")}
            </Button>
          </div>
        )}
      </header>
      {(roomId || showCreate) && (
        <details className="rounded-xl border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
            {m("Objetivo de aprendizaje")}
          </summary>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">
                {m("Área curricular")}
              </dt>
              <dd>{m("Matemática")}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                {m("Nivel y grado")}
              </dt>
              <dd>{m("Primaria · 2.º grado")}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                {m("Competencia")}
              </dt>
              <dd>
                {m(
                  (data.room?.kind ?? kind) === "builder"
                    ? "Resuelve problemas de forma, movimiento y localización"
                    : (data.room?.kind ?? kind) === "data"
                      ? "Resuelve problemas de gestión de datos e incertidumbre"
                      : (data.room?.kind ?? kind) === "fair"
                        ? "Resuelve problemas de regularidad, equivalencia y cambio"
                        : "Resuelve problemas de cantidad"
                )}
              </dd>
            </div>
          </dl>
        </details>
      )}
      {!roomId && showCreate && (
        <form
          id="create-room-form"
          className="grid items-end gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            void data.create(
              region,
              (room) => nav("/panel/salas/" + room.id),
              kind,
              kind !== "cargo" ? mode : "challenge",
              roomName.trim()
            )
          }}
        >
          <Field className="min-w-0 self-start sm:col-span-2 lg:col-span-1">
            <FieldLabel htmlFor="room-name">
              {m("Nombre de la sala")}
            </FieldLabel>
            <Input
              id="room-name"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder={m("Por ejemplo: 2.º A · Matemática")}
              autoComplete="off"
              required
              maxLength={80}
              disabled={data.busy}
            />
          </Field>
          <Field className="min-w-0 sm:col-span-2 lg:col-span-2">
            <FieldLabel htmlFor="room-game">{m("Juego")}</FieldLabel>
            <Select
              items={availableGames.map(([value, label]) => ({
                value,
                label: m(label),
              }))}
              value={kind}
              onValueChange={(value) => {
                if (value) setKind(value as RoomPreset["kind"])
              }}
              disabled={data.busy}
            >
              <SelectTrigger
                id="room-game"
                className="w-full min-w-0"
                aria-describedby="room-game-objective"
              >
                <SelectValue className="truncate">
                  {m(gameNames[kind]).split(" · ")[0]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="p-1"
              >
                {availableGames.map(([value, label]) => {
                  const [title, objective] = m(label).split(" · ")
                  return (
                    <SelectItem key={value} value={value} className="py-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-medium">{title}</span>
                        <span className="text-xs text-muted-foreground">
                          {objective}
                        </span>
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <p
              id="room-game-objective"
              className="text-sm text-muted-foreground"
            >
              {m(gameNames[kind]).split(" · ")[1]}
            </p>
          </Field>
          {kind !== "cargo" && (
            <Field className="min-w-0">
              <FieldLabel htmlFor="room-mode">{m("Modalidad")}</FieldLabel>
              <Select
                items={[
                  { value: "practice", label: m("Práctica adaptativa") },
                  { value: "challenge", label: m("Desafío de la sala") },
                ]}
                value={mode}
                onValueChange={(v) => {
                  if (v) setMode(v)
                }}
                disabled={data.busy}
              >
                <SelectTrigger id="room-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="practice">
                    {m("Práctica adaptativa")}
                  </SelectItem>
                  <SelectItem value="challenge">
                    {m("Desafío de la sala")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field className="min-w-0">
            <FieldLabel htmlFor="room-region">
              {m("Contexto del juego")}
            </FieldLabel>
            <Select
              items={items}
              value={region}
              onValueChange={(value) => {
                if (value) setRegion(value)
              }}
              disabled={data.busy}
            >
              <SelectTrigger id="room-region" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {presetOwner && (
            <RoomPresetPanel
              key={presetOwner}
              current={preset}
              describe={(p) => ({
                game: m(gameNames[p.kind]).split(" · ")[0],
                mode: m(modes[p.mode]),
                region: m(regions[p.region]),
              })}
              onApply={(p) => {
                setKind(p.kind)
                setMode(p.mode)
                setRegion(p.region)
              }}
              disabled={data.busy}
            />
          )}
          <Button
            type="submit"
            className="justify-self-start"
            disabled={data.busy || data.loading || !roomName.trim()}
          >
            {m(data.busy ? "Creando sala…" : "Crear sala")}
          </Button>
        </form>
      )}
      {data.loadError && (
        <div role="alert" className="space-y-3">
          <p>{m(data.loadError)}</p>
          <Button onClick={data.refresh}>{m("Reintentar")}</Button>
        </div>
      )}
      {data.loading && <p role="status">{m("Cargando sala…")}</p>}
      {data.notice && (
        <p role="status" className="rounded-lg border p-3">
          {m(data.notice)}
        </p>
      )}
      {data.error && (
        <p role="alert" className="text-destructive">
          {m(data.error)}
        </p>
      )}
      {roomId && data.room && (
        <>
          <p className="font-medium">
            {m(regions[data.room.region])} ·{" "}
            {m("Partida continua. Tres errores terminan el intento.")}
          </p>
          {data.room.kind === "data" && (
            <p className="rounded-lg border p-4">
              {m(
                "La feria de los datos fue reemplazada por Constructores del Perú. Los resultados anteriores se conservan."
              )}
            </p>
          )}
          {data.room.kind !== "data" && (
            <form
              className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              onSubmit={(e) => {
                e.preventDefault()
                void data
                  .assign(
                    name,
                    `+51${guardianPhone}`,
                    requestKey,
                    assigning?.id
                  )
                  .then((ok) => {
                    if (ok) {
                      setName("")
                      setGuardianPhone("")
                      setAssigning(null)
                      setRequestKey(crypto.randomUUID())
                    }
                  })
              }}
            >
              <Field className="min-w-0">
                <FieldLabel htmlFor="participant-name">
                  {m("Nombre del estudiante")}
                </FieldLabel>
                <Input
                  id="participant-name"
                  autoComplete="off"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setRequestKey(crypto.randomUUID())
                  }}
                  readOnly={!!assigning}
                  placeholder={m("Por ejemplo: Juan Pérez")}
                  disabled={data.busy}
                />
              </Field>
              <Field className="min-w-0">
                <FieldLabel htmlFor="guardian-phone">
                  {m("Teléfono del padre, madre o apoderado")}
                </FieldLabel>
                <PhoneInput
                  id="guardian-phone"
                  required
                  value={guardianPhone}
                  onValueChange={(value) => {
                    setGuardianPhone(value)
                    setRequestKey(crypto.randomUUID())
                  }}
                  disabled={data.busy}
                  aria-invalid={
                    data.error === "Escribe los 9 dígitos de tu celular."
                  }
                  aria-describedby="guardian-phone-help"
                />
                {data.error === "Escribe los 9 dígitos de tu celular." && (
                  <p role="alert" className="text-sm text-destructive">
                    {m(data.error)}
                  </p>
                )}
                <FieldDescription id="guardian-phone-help">
                  {m(
                    "El apoderado recibirá por WhatsApp el enlace del juego asignado."
                  )}
                </FieldDescription>
              </Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1 lg:pt-7">
                <Button
                  type="submit"
                  disabled={
                    data.busy ||
                    data.loading ||
                    !name.trim() ||
                    !isPeruvianMobile(guardianPhone)
                  }
                >
                  {m(
                    data.busy
                      ? "Asignando…"
                      : assigning
                        ? "Asignar por WhatsApp"
                        : "Registrar y asignar juego"
                  )}
                </Button>
                {assigning && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={data.busy}
                    onClick={() => {
                      setAssigning(null)
                      setName("")
                      setGuardianPhone("")
                      setRequestKey(crypto.randomUUID())
                    }}
                  >
                    {m("Cancelar")}
                  </Button>
                )}
              </div>
            </form>
          )}
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableCaption>
                {m(
                  data.room.mode === "practice" && data.room.kind !== "cargo"
                    ? "Puntos de práctica personal; las dificultades pueden ser distintas."
                    : "Clasificación por puntos. Los empates comparten posición."
                )}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  {[
                    "Posición",
                    "Estudiante",
                    "Puntos",
                    "Estado",
                    "WhatsApp del apoderado",
                    "Acciones",
                  ].map((label) => (
                    <TableHead key={label}>{m(label)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data.participants.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      {m("Añade estudiantes para iniciar las pruebas.")}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.participants.map((p) => {
                    const rank =
                      data.participants.findIndex(
                        (other) => other.score === p.score
                      ) + 1
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          {data.room?.kind !== "cargo" &&
                          data.room?.mode === "practice"
                            ? "—"
                            : number.format(rank)}
                        </TableCell>
                        <TableCell className="max-w-72 font-medium break-words whitespace-normal">
                          {p.name}
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">
                          {number.format(p.score)}
                        </TableCell>
                        <TableCell>
                          {m(
                            p.mistakes >= 3
                              ? "Perdió"
                              : p.started
                                ? "En curso"
                                : "Pendiente"
                          )}
                        </TableCell>
                        <TableCell className="min-w-44 whitespace-normal">
                          {p.assignment ? (
                            <div className="space-y-1">
                              <p dir="ltr" className="text-sm tabular-nums">
                                {p.assignment.guardianPhone}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {m(assignmentStatusLabels[p.assignment.status])}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {m("Sin asignar por WhatsApp")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {(!p.assignment || p.assignment.expired) &&
                              data.room?.kind !== "data" && (
                                <Button
                                  variant="outline"
                                  disabled={data.busy || data.loading}
                                  onClick={() => {
                                    setAssigning(p)
                                    setName(p.name)
                                    setGuardianPhone(
                                      nationalPhone(
                                        p.assignment?.guardianPhone ?? ""
                                      )
                                    )
                                    setRequestKey(crypto.randomUUID())
                                    document
                                      .getElementById("guardian-phone")
                                      ?.focus()
                                  }}
                                >
                                  {m("Asignar por WhatsApp")}
                                </Button>
                              )}
                            {p.assignment &&
                              !p.assignment.expired &&
                              ["failed", "expired"].includes(
                                p.assignment.status
                              ) && (
                                <Button
                                  variant="outline"
                                  disabled={data.busy || data.loading}
                                  onClick={() =>
                                    void data.retryAssignment(p.id)
                                  }
                                >
                                  {m("Reintentar envío")}
                                </Button>
                              )}
                            <Button
                              nativeButton={false}
                              variant="outline"
                              disabled={
                                data.busy ||
                                data.loading ||
                                data.room?.kind === "data"
                              }
                              render={
                                <Link
                                  to={
                                    "/panel/salas/" + roomId + "/jugar/" + p.id
                                  }
                                />
                              }
                            >
                              {m(
                                p.mistakes >= 3
                                  ? "Ver puntaje"
                                  : p.started
                                    ? "Continuar prueba"
                                    : "Iniciar prueba"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={data.busy || data.loading}
                              onClick={() => setRemoving(p)}
                              aria-label={m(
                                "Eliminar participación de {{name}}",
                                { name: p.name }
                              )}
                            >
                              {m("Eliminar participación")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <AlertDialog
            open={!!removing}
            onOpenChange={(open) => {
              if (!open && !data.busy) setRemoving(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {m("Eliminar participación")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {m(
                    "Se eliminarán la participación y los puntos de {{name}} en esta sala.",
                    { name: removing?.name ?? "" }
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {data.error && (
                <p role="alert" className="text-destructive">
                  {m(data.error)}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={data.busy}>
                  {m("Cancelar")}
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={data.busy}
                  onClick={() => {
                    if (removing)
                      void data.remove(removing.id).then((ok) => {
                        if (ok) setRemoving(null)
                      })
                  }}
                >
                  {m("Eliminar participación")}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
      {!roomId && !data.loadError && (
        <div className="divide-y rounded-xl border">
          {!data.rooms.length && !data.loading ? (
            <p className="p-6 text-muted-foreground">
              {m("Todavía no creaste salas.")}
            </p>
          ) : (
            data.rooms.map((room) => (
              <div
                key={room.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0 flex-1 basis-64 break-words">
                  <p className="font-medium">
                    {room.name || m("Sala de juego")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {m(gameNames[room.kind])} · {m(regions[room.region])}
                    {room.kind !== "cargo" && (
                      <>
                        {" "}
                        ·{" "}
                        {m(
                          room.mode === "practice"
                            ? "Práctica adaptativa"
                            : "Desafío de la sala"
                        )}
                      </>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(room.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    nativeButton={false}
                    disabled={data.busy || data.loading}
                    variant="outline"
                    render={<Link to={"/panel/salas/" + room.id} />}
                  >
                    {m("Abrir sala")}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={data.busy || data.loading}
                    onClick={() => setDeletingRoom(room)}
                    aria-label={m("Eliminar sala {{name}}", {
                      name: room.name || m("Sala de juego"),
                    })}
                  >
                    {m("Eliminar sala")}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <AlertDialog
        open={!!deletingRoom}
        onOpenChange={(open) => {
          if (!open && !data.busy) setDeletingRoom(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m("Eliminar sala")}</AlertDialogTitle>
            <AlertDialogDescription>
              {m(
                "Se eliminarán la sala {{name}}, sus estudiantes y todos sus puntos. Esta acción no se puede deshacer.",
                { name: deletingRoom?.name || m("Sala de juego") }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {data.error && (
            <p role="alert" className="text-destructive">
              {m(data.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={data.busy}>
              {m("Cancelar")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={data.busy}
              onClick={() => {
                if (deletingRoom)
                  void data.deleteRoom(deletingRoom.id).then((ok) => {
                    if (ok) {
                      setDeletingRoom(null)
                      if (roomId) nav("/panel/salas")
                    }
                  })
              }}
            >
              {m(data.busy ? "Eliminando sala…" : "Eliminar sala")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
