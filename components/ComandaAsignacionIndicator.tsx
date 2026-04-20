type AsignadoLite = {
  id: string
  nombre: string
  apellido: string
} | null

function nombreCompleto(u: { nombre: string; apellido: string }) {
  return `${u.nombre} ${u.apellido}`.trim()
}

/**
 * Sin `asignadoA`: no se muestra nada (comanda libre / sin perfil asignado).
 * Mismo usuario que el perfil: badge "Contigo".
 * Otro usuario: badge con nombre (tomada por otro).
 */
export function ComandaAsignacionIndicator({
  asignadoA,
  currentUserId,
}: {
  asignadoA: AsignadoLite
  currentUserId: string | null
}) {
  if (!asignadoA) return null
  if (currentUserId && asignadoA.id === currentUserId) {
    return (
      <span
        className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/45 dark:text-emerald-100"
        title="Esta comanda está asignada a tu perfil"
      >
        Contigo
      </span>
    )
  }
  const label = nombreCompleto(asignadoA)
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
      title={`Tomada por ${label}`}
    >
      {label}
    </span>
  )
}
