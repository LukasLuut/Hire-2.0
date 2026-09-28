# Captura das tomadas da landing

Grava as telas reais do Hire usadas na landing (`public/landing/story`) e gera `src/landing/media.gen.ts`
com as dimensões de cada tomada. Pacote separado de propósito: Playwright, sharp e ffmpeg não entram no app.

```bash
# 1. dados da apresentação (backEnd)
npm run story:images      # uma vez
npm run story:seed        # antes de cada captura (a tomada do contrato assina pelas duas partes)
npm run dev

# 2. app (frontEnd)
npm run dev

# 3. aqui
npm install
npm run setup             # baixa o Chromium do Playwright
npm run capture           # todas as tomadas
ONLY=search,profile npm run capture   # só algumas
```

Variáveis: `APP_URL` (padrão `http://localhost:5173`), `API_URL` (padrão `http://localhost:8080`).
Roteiro de cada tomada: `docs/landing/STORYBOARD.md`. Os PNGs brutos ficam em `.raw/` (fora do Git).
