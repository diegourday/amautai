import type { RoomPreset } from "@amautai/contracts"
import { useMessages } from "@/shared/i18n/use-messages"
import { Button } from "@workspace/ui/components/button"
import { useRoomPreset } from "../model/use-room-preset"

const same = (a: RoomPreset, b: RoomPreset) =>
  a.kind === b.kind && a.mode === b.mode && a.region === b.region

/**
 * Opt-in remembered defaults for the new-room form. Recalled options are only
 * applied when the teacher asks, so an edited form is never overwritten.
 */
export function RoomPresetPanel({
  current,
  describe,
  onApply,
  disabled,
}: {
  current: RoomPreset
  describe: (preset: RoomPreset) => {
    game: string
    mode: string
    region: string
  }
  onApply: (preset: RoomPreset) => void
  disabled: boolean
}) {
  const { m } = useMessages()
  const memory = useRoomPreset()
  // Memory is optional: a server without it shows nothing and creation works.
  if (!memory.loading && !memory.loadError && !memory.enabled) return null
  const remembered = memory.remembered?.preset
  const labels = remembered && describe(remembered)
  const locked = disabled || !!memory.busy || memory.loading
  return (
    <section
      aria-labelledby="room-preset-title"
      aria-busy={memory.loading || !!memory.busy}
      className="min-w-0 space-y-3 rounded-lg border bg-muted/40 p-4 sm:col-span-2 lg:col-span-3"
    >
      <div className="space-y-1">
        <h2 id="room-preset-title" className="text-sm font-medium">
          {m("Opciones recordadas para nuevas salas")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {m(
            "Guarda el juego, la modalidad y el contexto con Atomic Memory solo para tu cuenta docente. No se guardan nombres de salas ni de estudiantes."
          )}
        </p>
      </div>
      {memory.loading ? (
        <p role="status" className="text-sm">
          {m("Cargando opciones recordadas…")}
        </p>
      ) : memory.loadError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{m(memory.loadError)}</p>
          <Button type="button" variant="outline" onClick={memory.retry}>
            {m("Reintentar")}
          </Button>
        </div>
      ) : labels ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-muted-foreground">{m("Juego")}</dt>
            <dd className="break-words">{labels.game}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">{m("Modalidad")}</dt>
            <dd className="break-words">{labels.mode}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">{m("Contexto del juego")}</dt>
            <dd className="break-words">{labels.region}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm">
          {m("Aún no recordaste opciones para nuevas salas.")}
        </p>
      )}
      {!memory.loading && !memory.loadError && (
        <div className="flex flex-wrap gap-2">
          {remembered && (
            <Button
              type="button"
              disabled={locked || same(remembered, current)}
              onClick={() => {
                onApply(remembered)
                memory.announce(
                  "Se aplicaron las opciones recordadas. Revisa el formulario antes de crear la sala."
                )
              }}
            >
              {m("Usar opciones recordadas")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={locked || (!!remembered && same(remembered, current))}
            onClick={() => void memory.remember(current)}
          >
            {m(
              memory.busy === "remember"
                ? "Guardando…"
                : remembered
                  ? "Actualizar opciones"
                  : "Recordar opciones actuales"
            )}
          </Button>
          {remembered && (
            <Button
              type="button"
              variant="ghost"
              disabled={locked}
              onClick={() => void memory.forget()}
            >
              {m(memory.busy === "forget" ? "Olvidando…" : "Olvidar")}
            </Button>
          )}
        </div>
      )}
      {remembered && same(remembered, current) && !memory.busy && (
        <p className="text-sm text-muted-foreground">
          {m("El formulario ya usa estas opciones.")}
        </p>
      )}
      {memory.notice && (
        <p role="status" className="text-sm">
          {m(memory.notice)}
        </p>
      )}
      {memory.error && (
        <p role="alert" className="text-sm text-destructive">
          {m(memory.error)}
        </p>
      )}
    </section>
  )
}
