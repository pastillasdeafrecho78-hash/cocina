#!/usr/bin/env tsx
/**
 * Script para verificar que todas las variables de entorno requeridas estén configuradas
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Cargar variables de entorno desde .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const requiredEnvVars = ['DATABASE_URL']
const optionalEnvVars = [
  'AUTH_SECRET',
  'JWT_SECRET',
  'AUTH_GOOGLE_ID',
  'AUTH_GOOGLE_SECRET',
  'AUTH_META_ID',
  'AUTH_META_SECRET',
]

interface EnvCheck {
  name: string
  exists: boolean
  value: string | undefined
  isValid: boolean
  message: string
}

function checkEnvVar(name: string, required: boolean = true): EnvCheck {
  const value = process.env[name]
  const exists = value !== undefined && value.trim() !== ''
  
  let isValid = exists
  let message = ''
  
  if (!exists) {
    message = required ? '❌ FALTANTE (requerido)' : '⚠️  No configurado (opcional)'
    isValid = !required
  } else {
    // Validaciones específicas
    switch (name) {
      case 'DATABASE_URL':
        if (!value.startsWith('postgresql://')) {
          isValid = false
          message = '❌ Formato incorrecto (debe empezar con postgresql://)'
        } else {
          isValid = true
          message = '✅ Configurado correctamente'
        }
        break
        
      case 'JWT_SECRET':
      case 'AUTH_SECRET':
        if (value.length < 32) {
          isValid = false
          message = '⚠️  Muy corto (recomendado: mínimo 32 caracteres)'
        } else if (value.includes('tu-secret-key') || value.includes('cambiar')) {
          isValid = false
          message = '⚠️  Usa el valor por defecto (cámbialo por seguridad)'
        } else {
          isValid = true
          message = '✅ Configurado correctamente'
        }
        break
        
        
      default:
        isValid = true
        message = '✅ Configurado'
    }
  }
  
  return {
    name,
    exists,
    value: exists ? (name.includes('SECRET') || name.includes('PASSWORD') ? '***' : value) : undefined,
    isValid,
    message,
  }
}

function main() {
  console.log('🔍 Verificando variables de entorno...\n')
  console.log('📁 Archivo: .env.local\n')
  
  const checks: EnvCheck[] = []
  
  // Verificar variables requeridas
  console.log('📋 Variables Requeridas:')
  console.log('─'.repeat(60))
  
  for (const varName of requiredEnvVars) {
    const check = checkEnvVar(varName, true)
    checks.push(check)
    console.log(`${check.name.padEnd(20)} ${check.message}`)
    if (check.value && !check.name.includes('SECRET')) {
      console.log(`   Valor: ${check.value}`)
    }
  }
  
  console.log('\n📋 Variables Opcionales (OAuth y sesión):')
  console.log('─'.repeat(60))
  for (const varName of optionalEnvVars) {
    const check = checkEnvVar(varName, false)
    checks.push(check)
    console.log(`${check.name.padEnd(20)} ${check.message}`)
  }

  const authSecret = process.env.AUTH_SECRET?.trim() ?? ''
  const jwtSecret = process.env.JWT_SECRET?.trim() ?? ''
  const hasSessionSecret = Boolean(authSecret || jwtSecret)
  console.log('\n🔐 Verificación de secreto de sesión:')
  if (hasSessionSecret) {
    console.log('✅ OK (AUTH_SECRET o JWT_SECRET presente)')
  } else {
    console.log('❌ FALTANTE (define AUTH_SECRET o JWT_SECRET)')
  }

  const googleId = process.env.AUTH_GOOGLE_ID?.trim() ?? ''
  const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim() ?? ''
  const metaId = process.env.AUTH_META_ID?.trim() ?? ''
  const metaSecret = process.env.AUTH_META_SECRET?.trim() ?? ''

  const googlePairValid = (!googleId && !googleSecret) || (googleId && googleSecret)
  const metaPairValid = (!metaId && !metaSecret) || (metaId && metaSecret)
  const oauthAnyProvider = (googleId && googleSecret) || (metaId && metaSecret)

  console.log('\n🔗 Verificación OAuth:')
  console.log(
    googlePairValid
      ? '✅ Google: configuración consistente'
      : '❌ Google: faltan variables (AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET)'
  )
  console.log(
    metaPairValid
      ? '✅ Meta: configuración consistente'
      : '❌ Meta: faltan variables (AUTH_META_ID + AUTH_META_SECRET)'
  )
  console.log(
    oauthAnyProvider
      ? '✅ Al menos un proveedor OAuth está habilitado'
      : '⚠️  Ningún proveedor OAuth habilitado (solo login con contraseña)'
  )
  
  // Resumen
  console.log('\n' + '═'.repeat(60))
  const allValid = checks.filter(c => !c.isValid && requiredEnvVars.includes(c.name)).length === 0
  const requiredValid = checks
    .filter(c => requiredEnvVars.includes(c.name))
    .every(c => c.isValid)
  const oauthValid = googlePairValid && metaPairValid
  const sessionSecretValid = hasSessionSecret
  
  if (allValid && requiredValid && oauthValid && sessionSecretValid) {
    console.log('✅ Todas las variables requeridas están configuradas correctamente\n')
    console.log('💡 Próximos pasos:')
    console.log('   1. Ejecuta: npm run db:generate')
    console.log('   2. Ejecuta: npm run db:migrate')
    console.log('   3. Ejecuta: npm run db:seed')
    console.log('   4. Ejecuta: npm run dev')
    console.log('\n📝 Nota: La configuración fiscal y de pagos se hace desde la UI')
    console.log('   cuando el admin inicia sesión por primera vez.\n')
    process.exit(0)
  } else {
    console.log('❌ Hay problemas con la configuración\n')
    console.log('💡 Soluciones:')
    console.log('   1. Asegúrate de tener un archivo .env.local en la raíz del proyecto')
    console.log('   2. Configura: DATABASE_URL y AUTH_SECRET (o JWT_SECRET)')
    console.log('   3. Si usas OAuth, configura pares completos Google/Meta')
    console.log('   4. Genera secretos con: https://generate-secret.vercel.app/32')
    process.exit(1)
  }
}

main()

