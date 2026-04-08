import { describe, expect, it } from 'vitest'
import {
  buildBranchMembershipUpsertData,
  buildOrganizationMembershipUpsertData,
} from '@/lib/authz/oauth-membership'

describe('oauth membership upserts', () => {
  it('no sobrescribe rolId en update de membresía por sucursal', () => {
    const upsert = buildBranchMembershipUpsertData({
      userId: 'u1',
      restauranteId: 'r1',
      rolId: 'rol_admin',
      esPrincipal: true,
    })

    expect(upsert.create.rolId).toBe('rol_admin')
    expect(upsert.update).toEqual({ activo: true })
    expect('rolId' in upsert.update).toBe(false)
  })

  it('no sobrescribe rolId en update de membresía por organización', () => {
    const upsert = buildOrganizationMembershipUpsertData({
      userId: 'u1',
      organizacionId: 'o1',
      rolId: 'rol_admin',
    })

    expect(upsert.create.rolId).toBe('rol_admin')
    expect(upsert.update).toEqual({ activo: true })
    expect('rolId' in upsert.update).toBe(false)
  })
})
