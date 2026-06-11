import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ─── Inputs ──────────────────────────────────────────────────────────────────
const ROOT    = process.cwd();
const BASE    = path.join(ROOT, 'celmar-files', 'Projetos inicial');
const PDF_DIR = path.join(BASE, 'PDF');
const PNG_DIR = path.join(BASE, 'PNG');

// Junk-heaviest pranchas (each has both PDF + PNG). ORCA_ALL=1 runs every prancha.
const SUBSET = [
  'CEA-254-BLN-ARQ_R03-301-ARQ CIVIL',
  'CEA-254-BLN-ARQ_R02-306 - ARQ CAIXILHOS',
  'CEA-254-BLN-ARQ_R03-321-ARQ FORRO',
  'CEA-254-BLN-ARQ_R03-331-ARQ PISO',
  'CEA-254-BLN-ARQ_R02-341 - ARQ FACHADAS E VITRINES',
  'CEA-254-BLN-ARQ_R03-601- CVS COMUNICAÇÃO VISUAL E SINALIZAÇÃO',
];

function buildFiles(): { files: string[]; stems: string[] } {
  const stems = process.env.ORCA_ALL === '1'
    ? fs.readdirSync(PDF_DIR).filter((f) => /\.pdf$/i.test(f)).map((f) => f.replace(/\.pdf$/i, ''))
    : SUBSET;
  const files: string[] = [];
  for (const stem of stems) {
    const pdf = path.join(PDF_DIR, `${stem}.pdf`);
    const png = path.join(PNG_DIR, `${stem}.png`);
    if (fs.existsSync(pdf)) files.push(pdf);
    if (fs.existsSync(png)) files.push(png);   // image source for the vision/IA stages
  }
  return { files, stems };
}

// ─── Independent junk detector (mirrors the Python source filter) ────────────
const JUNK_PATTERNS: { tag: string; re: RegExp; count?: number }[] = [
  { tag: 'nota_frase',   re: /N[ÃA]O PODER[ÃA]O|HAVENDO NECESSIDADE|ACOMPANHAMENTO DO MESMO|OS FORROS QUANDO|ENTREFORRO TEM ALTURA|EXPRESSAMENTE PROIBIDO/i },
  { tag: 'nota_marcador',re: /\b\d{1,2}\)\s/ },
  { tag: 'carimbo',      re: /CDA DESIGN|JO[ÃA]O BERUTTI|BR-470|DESCRI[ÇC][ÃA]O DAS REVIS|\+55 |\b\d{5}-\d{3}\b/i },
  { tag: 'grid_ocr',     re: /[A-Z]{2,4}_\d|_YQE|_YCA|CV_\d{3,}/gi, count: 2 },
  { tag: 'num_run',      re: /^(\d{1,4}([.,]\d+)?\s+){3,}/ },
  { tag: 'ref_desenho',  re: /AXONOM[EÉ]TRICA|VISTA OBSERVADOR|\bESC\.?\s*:|\bFOLHA \d{2,3}\b|VERIFICAR DETALHAMENTO|^\d{3}\s*[-–]\s/i },
  { tag: 'departamento', re: /^Departamento\b.*[áa]rea de vendas/i },
  { tag: 'quadro_areas', re: /\d+[.,]\d+\s*m²/gi, count: 3 },
  { tag: 'label_parede', re: /^PAREDE P0\d\b/i },
  { tag: 'orfao',        re: /^[A-Z]\s+[A-Z]/ },
  { tag: 'trunc_stem',   re: /^(MPERMEABILIZ|RGAMASSA|OLEIRA GRANITO|ER[ÂA]MIC)/i },
];

function classifyJunk(desc: string): string | null {
  for (const p of JUNK_PATTERNS) {
    if (p.count) {
      const m = desc.match(p.re);
      if (m && m.length >= p.count) return p.tag;
    } else if (p.re.test(desc)) {
      return p.tag;
    }
  }
  return null;
}

test('orçamento end-to-end: junk filtered out of final budget', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  const { files, stems } = buildFiles();
  console.log(`\n[e2e] ${stems.length} pranchas, ${files.length} files attached`);
  expect(files.length).toBeGreaterThan(0);

  await page.goto('/orcamento-construtora', { waitUntil: 'domcontentloaded' });

  // ── STEP 1 — Upload ────────────────────────────────────────────────────────
  // setInputFiles attaches the files but doesn't always trigger React's onChange
  // on a hidden input; dispatch an explicit bubbling 'change' so handleReplace fires.
  const input = page.locator('input[type="file"][accept*="pdf"]').first();
  await input.setInputFiles(files);
  await input.dispatchEvent('change');
  const proceed = page.getByRole('button', { name: /Prosseguir com \d+ prancha/ });
  await expect(proceed).toBeEnabled({ timeout: 30_000 });
  console.log('[e2e] step 1 ok — files loaded:', await proceed.textContent());
  await proceed.click();

  // ── STEP 2 — Extração (auto-runs) ──────────────────────────────────────────
  const toIA = page.getByRole('button', { name: /Analisar com IA/ });
  await expect(toIA).toBeVisible({ timeout: 4 * 60_000 });
  console.log('[e2e] step 2 ok — extraction done:', await toIA.textContent());
  await toIA.click();

  // ── STEP 3 — IA: Ler Projeto → Orquestrar → Detalhar → Ver Revisão ─────────
  await page.getByRole('button', { name: /Ler Projeto/ }).click();
  console.log('[e2e] step 3a — Ler Projeto clicked');

  const orquestrar = page.getByRole('button', { name: /Orquestrar/ });
  await expect(orquestrar).toBeEnabled({ timeout: 6 * 60_000 });
  await orquestrar.click();
  console.log('[e2e] step 3b — Orquestrar clicked');

  const detalhar = page.getByRole('button', { name: /Detalhar \(\d+\)/ });
  try {
    await expect(detalhar).toBeEnabled({ timeout: 6 * 60_000 });
    await detalhar.click();
    console.log('[e2e] step 3c — Detalhar clicked');
  } catch {
    console.log('[e2e] step 3c — no Detalhar (nothing to detail)');
  }

  const verRevisao = page.getByRole('button', { name: /Ver Revisão/ });
  await expect(verRevisao).toBeEnabled({ timeout: 10 * 60_000 });
  await verRevisao.click();
  console.log('[e2e] step 3 ok — IA done');

  // ── STEP 4 — Revisão ───────────────────────────────────────────────────────
  await page.getByRole('button', { name: /Ver Orçamento/ }).click({ timeout: 60_000 });

  // ── STEP 5 — Orçamento: scrape the table ───────────────────────────────────
  await expect(page.getByText('TOTAL GERAL')).toBeVisible({ timeout: 60_000 });
  const scraped = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const sections: { name: string; subtotal: string; items: string[] }[] = [];
    let cur: { name: string; subtotal: string; items: string[] } | null = null;
    let totalGeral = '';
    for (const row of rows) {
      const cls = row.className || '';
      const cells = Array.from(row.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
      if (cls.includes('1e3a5f')) { totalGeral = cells[cells.length - 1] || ''; continue; }
      if (cls.includes('dde6f0')) { cur = { name: cells[1] || '', subtotal: cells[cells.length - 1] || '', items: [] }; sections.push(cur); continue; }
      if (cells.length === 6 && cur) cur.items.push(cells[1] || '');
    }
    return { sections, totalGeral };
  });

  // ── Analysis ───────────────────────────────────────────────────────────────
  const allItems = scraped.sections.flatMap((s) => s.items);
  const junk = allItems.map((d) => ({ desc: d, tag: classifyJunk(d) })).filter((x) => x.tag);

  const report = {
    pranchas: stems.length,
    totalGeral: scraped.totalGeral,
    totalItems: allItems.length,
    sections: scraped.sections.map((s) => ({ name: s.name, items: s.items.length, subtotal: s.subtotal })),
    junkCount: junk.length,
    junkExamples: junk.slice(0, 25),
  };
  fs.mkdirSync(path.join(ROOT, 'e2e'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'e2e', 'junk-report.json'), JSON.stringify(report, null, 2));

  console.log('\n===== ORÇAMENTO RESULT =====');
  console.log('TOTAL GERAL:', report.totalGeral, '| total items:', report.totalItems);
  for (const s of report.sections) console.log(`  ${s.name}: ${s.items} itens — ${s.subtotal}`);
  console.log(`JUNK rows still present: ${report.junkCount}`);
  for (const j of report.junkExamples) console.log(`  [${j.tag}] ${j.desc.slice(0, 90)}`);
  console.log('============================\n');

  expect(report.totalItems).toBeGreaterThan(0);
  expect(report.junkCount, `junk rows that leaked into the budget: ${JSON.stringify(report.junkExamples, null, 2)}`).toBe(0);
});
