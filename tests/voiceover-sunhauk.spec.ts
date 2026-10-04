// Real macOS VoiceOver session, driven with Guidepup, against the corrected (unpublished) sunhauk.com theme.
// One test per page template. Each test writes transcripts/<slug>/voiceover-transcript-<browser>.txt in the
// same layout as the NVDA transcripts of the audit (header + "### " sections + numbered phrases), so the
// retest report can ingest it unchanged.
import { voiceOverTest as test } from "@guidepup/playwright";
import { expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { release } from "node:os";

const THEME_ID = 193042743588;
const ORIGIN = "https://sunhauk.com";
const PAGES = [
  { slug: "home", path: "/", read: 220 },
  { slug: "collections_all-sunglasses", path: "/collections/all-sunglasses", read: 170 },
  { slug: "products_gift-card", path: "/products/gift-card", read: 160 },
  { slug: "pages_shipping-delivery", path: "/pages/shipping-delivery", read: 170 },
  { slug: "pages_returns-exchanges", path: "/pages/returns-exchanges", read: 170 },
];
const wanted = (process.env.VO_PAGES ?? "all").split(",").map((s) => s.trim()).filter(Boolean);
const selected = wanted.includes("all") ? PAGES : PAGES.filter((p) => wanted.includes(p.slug));
const HEADING_STEPS = Number(process.env.VO_HEADING_STEPS ?? 40);
const LANDMARK_STEPS = Number(process.env.VO_LANDMARK_STEPS ?? 12);
const TAB_STEPS = Number(process.env.VO_TAB_STEPS ?? 60);
const READ_SCALE = Number(process.env.VO_READ_SCALE ?? 1);

type Section = { title: string; phrases: string[]; end: string };
const num = (i: number) => String(i).padStart(3, " ");

test.describe("VoiceOver — sunhauk.com corrected theme (preview_theme_id=193042743588)", () => {
  for (const pg of selected) {
    test(`${pg.slug}: read-through, headings, landmarks and Tab order`, async ({ page, voiceOver, browserName }, testInfo) => {
      const url = `${ORIGIN}${pg.path}?preview_theme_id=${THEME_ID}`;
      // Shopify answers 302 → same path and sets the preview cookie; Playwright follows it in the same context.
      await page.goto(url, { waitUntil: "load" });
      await page.locator("body").waitFor();
      await page.waitForTimeout(3000);
      const theme = await page.evaluate(() => (window as any).Shopify?.theme ?? null);
      expect(theme?.id, "the corrected unpublished theme must be the one rendered").toBe(THEME_ID);

      // Third-party Attentive "Sign Up via Text for Offers" dialog (app embed, not part of the theme): it confines
      // the screen reader to its iframe. Dismiss it like a user would (its own Dismiss button), then fall back to
      // Escape and finally to removing the overlay, so the session can reach the page content.
      // Cookie-consent banner (Pandectes app, third party), shown depending on the visitor's region: decline it.
      await page.getByRole("button", { name: /^decline$/i }).first().click({ timeout: 4000 }).then(() => page.waitForTimeout(800)).catch(() => {});
      let popup = "not shown";
      const attentive = page.locator('iframe[title*="Sign Up via Text"], iframe[src*="attn.tv"]').first();
      if (await attentive.waitFor({ state: "visible", timeout: 12000 }).then(() => true).catch(() => false)) {
        popup = "shown";
        const frame = page.frameLocator('iframe[title*="Sign Up via Text"], iframe[src*="attn.tv"]').first();
        const clicked = await frame.getByRole("button", { name: /dismiss|close/i }).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
        await page.waitForTimeout(1500);
        let gone = !(await attentive.isVisible().catch(() => false));
        if (!gone) { await page.keyboard.press("Escape"); await page.waitForTimeout(1500); gone = !(await attentive.isVisible().catch(() => false)); popup += clicked ? ", dismiss click + Escape" : ", Escape"; }
        else popup += clicked ? ", closed with its Dismiss button" : ", closed";
        if (!gone) { await page.evaluate(() => document.querySelectorAll('#attentive_overlay, [id^="attentive"]').forEach((e) => e.remove())); popup += ", overlay removed (could not be closed by keyboard)"; }
      }

      await voiceOver.navigateToWebContent();
      await voiceOver.clearSpokenPhraseLog();
      await voiceOver.clearItemTextLog();

      const sections: Section[] = [];
      const say = async () => (await voiceOver.lastSpokenPhrase()).replace(/\s+/g, " ").trim();

      // Generic loop with the same stop rules as the NVDA recorder: stop when the same phrase repeats
      // three times in a row (end of content) or when the first phrase comes back (wrap-around).
      const run = async (title: string, max: number, step: () => Promise<void>, wrap: boolean) => {
        const phrases: string[] = []; let end = `límite de ${max} pasos`; let repeat = 0;
        for (let i = 1; i <= max; i++) {
          try { await step(); } catch (e) { end = `error: ${String(e).slice(0, 120)}`; break; }
          const p = await say();
          if (phrases.length && p === phrases[phrases.length - 1]) { if (++repeat >= 2) { end = "fin del contenido (frase repetida)"; break; } } else repeat = 0;
          if (wrap && phrases.length > 1 && p === phrases[0]) { end = "vuelta al principio (primer elemento repetido)"; break; }
          phrases.push(p);
        }
        sections.push({ title, phrases, end });
        return phrases;
      };

      await run("Lectura desde el principio (VO-Flecha derecha)", Math.round(pg.read * READ_SCALE), () => voiceOver.next({ capture: true }), false);

      await voiceOver.navigateToWebContent();
      await run("Navegación por encabezados (VO-Cmd-H)", HEADING_STEPS, () => voiceOver.nextHeading({ capture: true }), true);

      await voiceOver.navigateToWebContent();
      const vo: any = voiceOver;
      const landmarkCmd = vo.keyboardCommands?.findNextLandmark ?? vo.keyboardCommands?.findNextLandmarkOrItem;
      if (typeof vo.nextLandmark === "function") await run("Navegación por regiones/landmarks (VO-Cmd-L)", LANDMARK_STEPS, () => vo.nextLandmark({ capture: true }), true);
      else if (landmarkCmd) await run("Navegación por regiones/landmarks (VO-Cmd-L)", LANDMARK_STEPS, () => voiceOver.perform(landmarkCmd, { capture: true }), true);
      else sections.push({ title: "Navegación por regiones/landmarks (VO-Cmd-L)", phrases: [], end: "comando no disponible en esta versión de Guidepup" });

      await voiceOver.navigateToWebContent();
      await run("Orden de Tab (tecla Tab)", TAB_STEPS, () => voiceOver.press("Tab"), false);

      const spoken = await voiceOver.spokenPhraseLog();
      const total = sections.reduce((a, s) => a + s.phrases.length, 0);
      const lines: string[] = [
        `Lector de pantalla: VoiceOver ${voiceOver.version ?? ""} (macOS ${release()}, sesión real conducida con Guidepup)`.replace(/\s+\(/, " ("),
        `Página: ${url}`,
        `Página renderizada: ${page.url()}`,
        `Theme: ${JSON.stringify(theme)}`,
        `Navegador: ${browserName} (proyecto Playwright "${testInfo.project.name}")`,
        `Runner: GitHub Actions ${process.env.RUNNER_OS_LABEL ?? "local"}`,
        `Idioma de la voz detectado: en`,
        `Modo: sesión real`,
        `Popup de terceros (Attentive "Sign Up via Text"): ${popup}`,
        `Frases capturadas: ${total}`,
        ``,
        `Cada línea es una frase tal como la pronunció VoiceOver. Shopify inyecta su barra de vista previa en los temas no publicados; VoiceOver también la anuncia.`,
        `────────────────────────────────────────────────────────`,
        ``,
      ];
      for (const s of sections) {
        lines.push(`### ${s.title} (${s.phrases.length} frases, fin: ${s.end})`);
        s.phrases.forEach((p, i) => lines.push(`${num(i + 1)}  ${p}`));
        lines.push("");
      }
      lines.push(`### Registro completo de VoiceOver (spokenPhraseLog, ${spoken.length} entradas)`);
      spoken.forEach((p, i) => lines.push(`${num(i + 1)}  ${p.replace(/\s+/g, " ").trim()}`));

      const outDir = join(process.cwd(), "transcripts", pg.slug);
      mkdirSync(outDir, { recursive: true });
      const file = join(outDir, `voiceover-transcript-${browserName}.txt`);
      writeFileSync(file, lines.join("\n") + "\n", "utf8");
      await testInfo.attach(`voiceover-${pg.slug}-${browserName}`, { path: file, contentType: "text/plain" });
      expect(total).toBeGreaterThan(10);
    });
  }
});
