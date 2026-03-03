#!/usr/bin/env node

/**
 * Script simple para iniciar ngrok usando npx
 * Carga automáticamente las variables de .env.local
 */

require('dotenv').config({ path: '.env.local' })
const { spawn, exec } = require('child_process')
const http = require('http')
const https = require('https')

const authtoken = process.env.NGROK_AUTHTOKEN

if (!authtoken) {
  console.error('❌ Error: NGROK_AUTHTOKEN no está configurado en .env.local\n')
  console.log('💡 Pasos:')
  console.log('   1. Obtén tu token en: https://dashboard.ngrok.com/get-started/your-authtoken')
  console.log('   2. Agrega a .env.local: NGROK_AUTHTOKEN=tu_token_aqui\n')
  process.exit(1)
}

// Función para detener túneles existentes usando la API local de ngrok
async function stopExistingTunnels() {
  return new Promise((resolve) => {
    console.log('🔍 Verificando túneles existentes...\n')
    
    // Intentar detener túneles a través de la API local (puerto 4040 por defecto)
    const req = http.get('http://localhost:4040/api/tunnels', (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const response = JSON.parse(data)
          const tunnels = response.tunnels || []
          
          if (tunnels.length > 0) {
            console.log(`🛑 Encontrado ${tunnels.length} túnel(es) activo(s). Deteniendo...\n`)
            
            // Detener cada túnel usando la API
            const deletePromises = tunnels.map((tunnel) => {
              return new Promise((resolveDelete) => {
                const deleteReq = http.request(
                  {
                    hostname: 'localhost',
                    port: 4040,
                    path: `/api/tunnels/${tunnel.name}`,
                    method: 'DELETE',
                  },
                  (res) => {
                    if (res.statusCode === 204 || res.statusCode === 200) {
                      console.log(`   ✓ Túnel ${tunnel.name} detenido`)
                    }
                    resolveDelete()
                  }
                )
                deleteReq.on('error', () => resolveDelete())
                deleteReq.end()
              })
            })
            
            Promise.all(deletePromises).then(() => {
              console.log('✅ Túneles detenidos\n')
              setTimeout(resolve, 2000) // Esperar a que se detengan completamente
            })
          } else {
            console.log('ℹ️  No hay túneles activos\n')
            resolve()
          }
        } catch (error) {
          // Si no hay API disponible o hay error, intentar matar procesos
          console.log('⚠️  No se pudo acceder a la API de ngrok. Intentando detener procesos...\n')
          killNgrokProcesses().then(() => resolve())
        }
      })
    })

    req.on('error', () => {
      // Si no hay ngrok corriendo, intentar matar procesos por si acaso
      killNgrokProcesses().then(() => resolve())
    })

    req.setTimeout(2000, () => {
      req.destroy()
      killNgrokProcesses().then(() => resolve())
    })
  })
}

// Función alternativa: matar procesos ngrok
async function killNgrokProcesses() {
  return new Promise((resolve) => {
    // En Windows, buscar y matar procesos ngrok
    exec('tasklist /FI "IMAGENAME eq ngrok.exe"', (error, stdout) => {
      if (stdout && stdout.includes('ngrok.exe')) {
        console.log('🛑 Deteniendo procesos ngrok...\n')
        exec('taskkill /F /IM ngrok.exe /T', (error) => {
          if (!error) {
            console.log('✅ Procesos ngrok detenidos\n')
          }
          setTimeout(resolve, 1000)
        })
      } else {
        resolve()
      }
    })
  })
}

// Configurar el authtoken primero
console.log('🔐 Configurando authtoken de ngrok...\n')

const configProcess = spawn('npx', ['ngrok', 'config', 'add-authtoken', authtoken], {
  stdio: 'inherit',
  shell: true,
})

configProcess.on('close', async (code) => {
  if (code !== 0) {
    console.error('❌ Error al configurar authtoken')
    process.exit(1)
  }

  console.log('✅ Authtoken configurado\n')
  
  // Detener cualquier túnel existente local
  await stopExistingTunnels()

  console.log('🚀 Iniciando túnel ngrok...\n')
  console.log('📱 La URL pública aparecerá abajo. Úsala en tu smartphone.\n')
  console.log('💡 Presiona Ctrl+C para detener\n')
  console.log('ℹ️  Usando --pooling-enabled para permitir múltiples túneles\n')

  const ngrokProcess = spawn('npx', ['ngrok', 'http', '3000', '--pooling-enabled'], {
    stdio: 'inherit',
    shell: true,
  })

  ngrokProcess.on('close', (code) => {
    if (code !== 0) {
      console.log('\n\n❌ El túnel no se pudo iniciar.\n')
      console.log('💡 El error "already online" significa que hay un túnel activo en tu cuenta.\n')
      console.log('📋 Soluciones:\n')
      console.log('   1. Detener el túnel remoto:')
      console.log('      → Ve a: https://dashboard.ngrok.com/status/tunnels')
      console.log('      → Busca el túnel activo y haz clic en "Stop"\n')
      console.log('   2. Esperar a que expire (se cierra automáticamente después de inactividad)\n')
      console.log('   3. Usar un dominio reservado (requiere plan de pago de ngrok)\n')
    }
    process.exit(code)
  })

  // Manejar cierre
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Cerrando túnel...')
    ngrokProcess.kill()
    process.exit(0)
  })
})
