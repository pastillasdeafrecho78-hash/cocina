#!/usr/bin/env node

/**
 * Script para iniciar ngrok y exponer la aplicación a internet
 * 
 * Uso:
 *   npm run tunnel
 *   o
 *   node scripts/start-tunnel.js
 */

const { exec } = require('child_process')
const ngrok = require('ngrok')
require('dotenv').config({ path: '.env.local' })

async function startTunnel() {
  console.log('🚀 Iniciando túnel ngrok...\n')

  // Verificar que existe el authtoken
  const authtoken = process.env.NGROK_AUTHTOKEN
  if (!authtoken) {
    console.error('❌ Error: NGROK_AUTHTOKEN no está configurado\n')
    console.log('💡 Pasos para configurar ngrok:')
    console.log('   1. Crea una cuenta gratuita en: https://dashboard.ngrok.com/signup')
    console.log('   2. Obtén tu authtoken en: https://dashboard.ngrok.com/get-started/your-authtoken')
    console.log('   3. Agrega a .env.local: NGROK_AUTHTOKEN=tu_token_aqui\n')
    process.exit(1)
  }

  try {
    // Iniciar ngrok en el puerto 3000
    const url = await ngrok.connect({
      addr: 3000,
      authtoken: authtoken,
    })

    console.log('✅ Túnel establecido exitosamente!\n')
    console.log('📱 URL pública (accesible desde internet):')
    console.log(`   ${url}\n`)
    console.log('💡 Usa esta URL en tu smartphone para acceder a la aplicación')
    console.log('💡 Presiona Ctrl+C para detener el túnel\n')

    // Mostrar información adicional
    console.log('🔗 URLs disponibles:')
    console.log(`   - HTTP:  ${url.replace('https://', 'http://')}`)
    console.log(`   - HTTPS: ${url}\n`)

    // Manejar cierre
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Cerrando túnel...')
      await ngrok.disconnect()
      await ngrok.kill()
      console.log('✅ Túnel cerrado')
      process.exit(0)
    })

  } catch (error) {
    console.error('❌ Error al iniciar ngrok:', error.message)
    console.log('\n💡 Soluciones:')
    console.log('   1. Verifica que Next.js esté corriendo en el puerto 3000')
    console.log('   2. Si tienes un authtoken, agrégalo a .env.local como NGROK_AUTHTOKEN')
    console.log('   3. Asegúrate de que ngrok esté instalado: npm install ngrok')
    process.exit(1)
  }
}

// Verificar que Next.js esté corriendo
exec('netstat -ano | findstr :3000', (error, stdout) => {
  if (error || !stdout) {
    console.warn('⚠️  Advertencia: No se detectó nada corriendo en el puerto 3000')
    console.warn('   Asegúrate de ejecutar "npm run dev" en otra terminal primero\n')
  }
  
  startTunnel()
})
