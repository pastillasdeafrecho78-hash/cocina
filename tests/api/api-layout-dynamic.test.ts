import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Segment config app/api', () => {
  it('fuerza rutas API como dynamic', async () => {
    const file = resolve(process.cwd(), 'app/api/layout.tsx')
    const content = readFileSync(file, 'utf8')
    expect(content).toContain("export const dynamic = 'force-dynamic'")
  })
})
