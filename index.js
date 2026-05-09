const express = require('express')
const puppeteer = require('puppeteer')

const app = express()
app.use(express.json({ limit: '10mb' }))

function buildWatermarkOverlay() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="110">` +
    `<text x="130" y="55" font-family="sans-serif" font-size="13" fill="#444444" ` +
    `text-anchor="middle" dominant-baseline="middle" transform="rotate(-30 130 55)">` +
    `CurriculoIA.com.br</text></svg>`

  const b64 = Buffer.from(svg).toString('base64')

  const style = `
    <style>
      .wm-overlay {
        position: fixed;
        top: -20%;
        left: -20%;
        width: 140%;
        height: 140%;
        z-index: 9999;
        pointer-events: none;
        background-image: url('data:image/svg+xml;base64,${b64}');
        background-repeat: repeat;
        background-size: 260px 110px;
        opacity: 0.13;
      }
    </style>`

  return `${style}<div class="wm-overlay"></div>`
}

app.get('/health', (_req, res) => res.json({ ok: true }))

app.post('/gerar-pdf', async (req, res) => {
  console.log('[PDF] Requisição recebida')
  console.log('[PDF] HTML size:', JSON.stringify(req.body).length, 'bytes')

  let browser
  try {
    const { html, comMarcaDagua } = req.body

    if (!html || typeof html !== 'string') {
      console.error('[PDF] HTML ausente')
      return res.status(400).json({ error: 'html é obrigatório' })
    }

    const htmlFinal = comMarcaDagua
      ? html.replace('</body>', `${buildWatermarkOverlay()}</body>`)
      : html

    console.log('[PDF] Iniciando Puppeteer...')
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 794, height: 1123 })

    console.log('[PDF] Carregando HTML...')
    await page.setContent(htmlFinal, { waitUntil: 'networkidle0', timeout: 30000 })

    console.log('[PDF] Gerando PDF...')
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    console.log('[PDF] PDF gerado com sucesso, size:', pdfBytes.length)
    res.set('Content-Type', 'application/pdf')
    res.send(pdfBytes)

  } catch (err) {
    console.error('[PDF] Erro:', err)
    res.status(500).json({ error: err.message })
  } finally {
    if (browser) await browser.close()
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`PDF service rodando na porta ${PORT}`))
