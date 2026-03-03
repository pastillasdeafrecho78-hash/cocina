#!/usr/bin/env tsx
/**
 * Script para verificar que todas las variables de entorno requeridas estén configuradas
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Cargar variables de entorno desde .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
]

const optionalEnvVars: string[] = [
  // Variables opcionales - no son necesarias para empezar
  // La configuración fiscal y de pagos se hace desde la UI
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
  
  // Solo mostrar variables opcionales si hay alguna configurada
  if (optionalEnvVars.length > 0) {
    console.log('\n📋 Variables Opcionales:')
    console.log('─'.repeat(60))
    
    for (const varName of optionalEnvVars) {
      const check = checkEnvVar(varName, false)
      checks.push(check)
      console.log(`${check.name.padEnd(20)} ${check.message}`)
      if (check.value) {
        console.log(`   Valor: ${check.value}`)
      }
    }
  }
  
  // Resumen
  console.log('\n' + '═'.repeat(60))
  const allValid = checks.filter(c => !c.isValid && requiredEnvVars.includes(c.name)).length === 0
  const requiredValid = checks
    .filter(c => requiredEnvVars.includes(c.name))
    .every(c => c.isValid)
  
  if (allValid && requiredValid) {
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
    console.log('   2. Solo necesitas configurar: DATABASE_URL y JWT_SECRET')
    console.log('   3. Genera JWT_SECRET con PowerShell o: https://generate-secret.vercel.app/32')
    process.exit(1)
  }
}

main()

