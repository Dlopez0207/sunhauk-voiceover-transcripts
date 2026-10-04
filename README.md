# VoiceOver real (macOS) para sunhauk.com — GitHub Actions

Ejecuta VoiceOver de macOS de verdad (no un emulador) en un runner `macos-15` de GitHub Actions, conducido con
Guidepup, contra el tema corregido sin publicar (`?preview_theme_id=193042743588`), y guarda la transcripción
literal de lo que VoiceOver dijo en cada página (lectura lineal, encabezados, regiones, orden de Tab) más el
vídeo del navegador.

## Cómo lanzarlo

1. Crear un repositorio (privado) con este contenido y hacer push (`package-lock.json` incluido: el workflow usa `npm ci`).
2. GitHub → Actions → "VoiceOver transcripts (sunhauk.com preview theme)" → Run workflow
   (`pages` = `all` o lista de slugs; `read_scale` = 1).
3. Al terminar, descargar los artifacts `voiceover-transcripts-macos-15-webkit` y `-chromium`:
   `transcripts/<slug>/voiceover-transcript-<browser>.txt` (+ `test-results/**/video.webm`).
4. Copiar cada `.txt` a `D:\Preference_Consulting\ADA\Webpages\Sunha\sr-voiceover\results\<slug>\` y
   regenerar el reporte (`node make-retest-report.cjs`).

Verificar siempre en la cabecera del `.txt` la línea `Theme:` con `"id":193042743588` y `"role":"unpublished"`.

## Coste

Repositorio público: gratis. Privado: los minutos macOS cuentan ×10 sobre los 2.000 min/mes del plan Free;
una ejecución completa (webkit 5 páginas + chromium 1 página) ronda 60–90 min de runner ≈ 600–900 min de cuota.

## Fuentes verificadas (3 oct 2026)

- `guidepup/setup-action` está archivada; se usa el CLI `@guidepup/setup@0.29.1` (`setup --ci`, `install`).
- `@guidepup/guidepup` 0.35.0, `@guidepup/playwright` 0.19.1, `@playwright/test` 1.63.0, Node 24.
- El CI oficial de Guidepup (`playwright-voiceover.yml`) está verde en macos-15/26 con chromium, firefox y webkit.
