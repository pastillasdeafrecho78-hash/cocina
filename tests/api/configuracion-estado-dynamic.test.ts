import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Segment config /api/configuracion/estado', () => {
  it('declara dynamic force-dynamic para evitar static render', async () => {
    const file = resolve(process.cwd(), 'app/api/configuracion/estado/route.ts')
    const content = readFileSync(file, 'utf8')
    expect(content).toContain("export const dynamic = 'force-dynamic'")
  })
})
