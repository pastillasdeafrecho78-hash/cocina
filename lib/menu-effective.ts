import { getMenuContext } from '@/lib/menu-context'
import { raise } from '@/lib/authz/http'

export async function resolveEffectiveMenu(restauranteId: string) {
  const menuCtx = await getMenuContext(restauranteId)
  if (!menuCtx) {
    raise(404, 'Sucursal no encontrada')
  }
  return menuCtx
}
