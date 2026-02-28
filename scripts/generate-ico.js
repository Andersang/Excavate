const fs = require('fs')
const path = require('path')
let pngToIco
try {
  // Try CommonJS require first
  pngToIco = require('png-to-ico')
  if (pngToIco && typeof pngToIco.default === 'function') pngToIco = pngToIco.default
} catch (err) {
  // Fallback to dynamic import (for ESM-only packages)
  ;(async () => {
    const mod = await import('png-to-ico')
    pngToIco = mod.default ?? mod
    await generate() // call generate again after dynamic import
  })()
  return
}

async function generate() {
  const src = path.resolve(__dirname, '../resources/icon.png')
  const destDir = path.resolve(__dirname, '../build')
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

  try {
    const buffer = await pngToIco(src)
    const outPath = path.join(destDir, 'icon.ico')
    fs.writeFileSync(outPath, buffer)
    console.log('Generated ICO at', outPath)
  } catch (err) {
    console.error('Failed to generate ICO:', err)
    process.exit(1)
  }
}

generate()
