# -*- coding: utf-8 -*-
"""
Teste de extração multi-fonte — Prancha 304 ARQ COPA
Output gravado em test_extracao_304_output.txt (utf-8)
"""

import os, sys, json, base64, re, io
from pathlib import Path
from collections import defaultdict
from PIL import Image

BASE = r"C:\Users\AVELL\Downloads\Cauline Roots\Celmar\Projetos inicial\Projetos inicial"
PDF_PATH = os.path.join(BASE, "PDF", "CEA-254-BLN-ARQ_R03-304-ARQ COPA.pdf")
DWG_PATH = os.path.join(BASE, "DWG", "CEA-254-BLN-ARQ_R03-304-ARQ COPA.dwg")
DXF_PATH = os.path.join(BASE, "DXF", "CEA-254-BLN-ARQ_R03-304-ARQ COPA.dxf")
PNG_PATH = os.path.join(BASE, "PNG", "CEA-254-BLN-ARQ_R03-304-ARQ COPA.png")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
OUT_FILE = r"C:\Users\AVELL\Documents\Projects\AI-Agents\test_extracao_304_output.txt"

out = open(OUT_FILE, "w", encoding="utf-8")

def p(msg=""):
    print(msg)
    out.write(msg + "\n")

SEP = "=" * 60

# ─── COMPRESS PNG → JPEG under 9MB ───────────────────────────────────────────
def compress_to_jpeg(src_path: str) -> bytes:
    """
    API Anthropic: max 8000px por dimensao, max 10MB base64 (~7.5MB raw).
    Redimensiona para max 8000px mantendo aspect ratio, entao comprime.
    """
    from PIL import Image as PILImage
    import warnings
    warnings.filterwarnings("ignore")
    PILImage.MAX_IMAGE_PIXELS = None
    img = PILImage.open(src_path).convert("RGB")
    w, h = img.size
    p(f"  Resolucao original: {w}x{h} pixels")

    # Resize para max 8000px mantendo proporcao
    MAX_DIM = 8000
    if max(w, h) > MAX_DIM:
        scale = MAX_DIM / max(w, h)
        new_w, new_h = int(w * scale), int(h * scale)
        img = img.resize((new_w, new_h), PILImage.LANCZOS)
        p(f"  Redimensionado para: {new_w}x{new_h} (max {MAX_DIM}px por dimensao, limite da API)")

    for quality in [82, 72, 62, 50]:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        data = buf.getvalue()
        b64_size = int(len(data) * 4 / 3)
        p(f"  q={quality}: {len(data)//1024}KB raw (~{b64_size//1024}KB base64)")
        if b64_size < 10_000_000:
            p(f"  OK q={quality}: {len(data)//1024}KB JPEG, resolucao {img.size[0]}x{img.size[1]}")
            return data
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=50)
    return buf.getvalue()

# ─── 1. PDF ───────────────────────────────────────────────────────────────────
p(f"\n{SEP}")
p("FONTE 1: PDF (pdfplumber)")
p(SEP)

pdf_text_lines = []
pdf_tables = []

try:
    import pdfplumber
    with pdfplumber.open(PDF_PATH) as pdf:
        p(f"  Paginas: {len(pdf.pages)}")
        for i, page in enumerate(pdf.pages):
            text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            pdf_text_lines.extend(lines)
            try:
                tables = page.extract_tables()
                for t in tables:
                    if t and any(any(c for c in row if c) for row in t):
                        pdf_tables.append({"page": i+1, "rows": t})
            except Exception as te:
                p(f"  [tabela pg{i+1} erro: {te}]")

    p(f"\n  Linhas de texto: {len(pdf_text_lines)}")
    p(f"  Tabelas: {len(pdf_tables)}")

    p("\n  [Linhas com medidas/dimensoes]:")
    measure_lines = [l for l in pdf_text_lines
                     if re.search(r'\d+[,.]?\d*\s*(m[²2]|ml|m\.l\.?|un|vb|m\b)', l, re.IGNORECASE)]
    for l in measure_lines[:25]:
        p(f"    {l}")
    if len(measure_lines) > 25:
        p(f"    ... +{len(measure_lines)-25} linhas")

    p("\n  [Tabelas]:")
    for t in pdf_tables:
        p(f"\n  -- Tabela pagina {t['page']} ({len(t['rows'])} linhas) --")
        for row in t["rows"][:8]:
            cleaned = [str(c or "").strip()[:40] for c in row]
            if any(cleaned):
                p(f"    {cleaned}")
        if len(t["rows"]) > 8:
            p(f"    ... +{len(t['rows'])-8} linhas")

    p(f"\n  RESULTADO PDF: OK - {len(pdf_text_lines)} linhas, {len(pdf_tables)} tabelas")

except Exception as e:
    p(f"  ERRO PDF: {e}")

# ─── 2. DWG ───────────────────────────────────────────────────────────────────
p(f"\n{SEP}")
p("FONTE 2: DXF (ezdxf — convertido via ODA File Converter)")
p(SEP)

dwg_ok = False
dwg_blocks = {}
dwg_texts = []
dwg_dims = []
dwg_hatches = []
dwg_layers = []

try:
    import ezdxf
    from ezdxf.recover import readfile as recover_read

    p(f"  Lendo DXF: {DXF_PATH}")
    doc, auditor = recover_read(DXF_PATH)
    msp = doc.modelspace()

    dwg_layers = [layer.dxf.name for layer in doc.layers]
    entity_types = defaultdict(int)
    blocks_count = defaultdict(int)

    for entity in msp:
        entity_types[entity.dxftype()] += 1
        if entity.dxftype() in ("TEXT", "MTEXT"):
            try:
                txt = entity.dxf.text if entity.dxftype() == "TEXT" else entity.text
                txt = re.sub(r'\\[A-Za-z][^;]*;|[{}]', '', txt).strip()
                if txt and len(txt) > 1:
                    dwg_texts.append(txt[:120])
            except: pass
        if entity.dxftype() == "INSERT":
            try: blocks_count[entity.dxf.name] += 1
            except: pass
        if entity.dxftype() == "DIMENSION":
            try:
                val = entity.dxf.actual_measurement
                dwg_dims.append(round(val, 3))
            except: pass
        if entity.dxftype() == "HATCH":
            try:
                area = entity.dxf.get("area", None)
                if area and area > 100:  # ignorar áreas minúsculas
                    dwg_hatches.append({"layer": entity.dxf.layer, "area_m2": round(area / 1e6, 3)})
            except: pass

    dwg_blocks = dict(blocks_count)
    dwg_ok = True

    p(f"  LEITURA OK (recovery mode)")
    p(f"\n  Layers ({len(dwg_layers)}):")
    for l in sorted(dwg_layers)[:25]:
        p(f"    {l}")

    p(f"\n  Tipos de entidade:")
    for etype, count in sorted(entity_types.items(), key=lambda x: -x[1])[:15]:
        p(f"    {etype}: {count}")

    p(f"\n  Blocos (INSERT) - fixtures/simbolos:")
    for bname, count in sorted(dwg_blocks.items(), key=lambda x: -x[1])[:20]:
        p(f"    {bname}: {count}x")

    p(f"\n  Dimensoes encontradas ({len(dwg_dims)}) - primeiras 20:")
    for d in dwg_dims[:20]:
        p(f"    {d}")

    p(f"\n  Hatches (areas preenchidas):")
    for h in sorted(dwg_hatches, key=lambda x: -x["area_m2"])[:15]:
        p(f"    Layer: {h['layer']} -> {h['area_m2']} m2")

    p(f"\n  Textos/anotacoes (primeiros 40 unicos):")
    seen = set()
    cnt = 0
    for t in dwg_texts:
        if t not in seen and cnt < 40:
            seen.add(t)
            p(f"    {t}")
            cnt += 1

    p(f"\n  RESULTADO DWG: OK - {len(dwg_layers)} layers, {len(dwg_blocks)} tipos blocos, "
      f"{len(dwg_dims)} cotas, {len(dwg_hatches)} hatches")

except Exception as e:
    p(f"  ERRO DXF: {e}")
    p(f"  RESULTADO DXF: FALHOU")

# ─── 3. IA VISUAL ─────────────────────────────────────────────────────────────
p(f"\n{SEP}")
p("FONTE 3: IA Visual (claude-sonnet-4-6)")
p(SEP)

ai_items = []
ai_errors = []
ai_tokens = {}

PROMPT = """Voce e um engenheiro orcamentista analisando a prancha ARQ-304 (COPA) de uma loja C&A.

TAREFA: Liste TODOS os itens que consegue identificar para orcamento.
Para cada item informe: ambiente, descricao, categoria, unidade, quantidade (se mensuravel), confianca (0-100%), fonte de onde tirou o valor.

CATEGORIAS: civil | revestimento | pintura | marcenaria | vidros | eletrica | hidraulica | climatizacao | outro

Ao final, liste:
## ERROS / LIMITACOES
O que nao conseguiu identificar ou medir com clareza.

Responda APENAS com JSON:
```json
{
  "itens": [
    {
      "ambiente": "Copa",
      "descricao": "Piso ceramico",
      "categoria": "revestimento",
      "unidade": "m2",
      "quantidade": 12.5,
      "confianca": 80,
      "fonte": "planta baixa + escala estimada"
    }
  ],
  "erros_limitacoes": [
    "Escala nao confirmada"
  ]
}
```"""

try:
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    p("  Comprimindo PNG...")
    img_bytes = compress_to_jpeg(PNG_PATH)
    img_b64 = base64.b64encode(img_bytes).decode()

    p("  Enviando para API...")
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}},
                {"type": "text", "text": PROMPT}
            ]
        }]
    )

    raw = response.content[0].text
    ai_tokens = {"input": response.usage.input_tokens, "output": response.usage.output_tokens}
    cost = ai_tokens["input"] * 3/1e6 + ai_tokens["output"] * 15/1e6

    p(f"  Tokens: in={ai_tokens['input']} out={ai_tokens['output']} custo=~${cost:.4f}")
    p("\n  [Output bruto da IA]:")
    p(raw)

    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
    if json_match:
        try:
            parsed = json.loads(json_match.group(1))
            ai_items = parsed.get("itens", [])
            ai_errors = parsed.get("erros_limitacoes", [])
            p(f"\n  JSON parseado: {len(ai_items)} itens, {len(ai_errors)} erros reportados")
        except Exception as je:
            p(f"  JSON parse error: {je}")

    p(f"\n  RESULTADO IA: OK - {len(ai_items)} itens extraidos")

except Exception as e:
    p(f"  ERRO IA: {e}")
    p(f"  RESULTADO IA: FALHOU")

# ─── RESUMO ───────────────────────────────────────────────────────────────────
p(f"\n{SEP}")
p("RESUMO FINAL")
p(SEP)
p(f"  PDF:  {'OK' if pdf_text_lines else 'FALHOU'} - {len(pdf_text_lines)} linhas texto, {len(pdf_tables)} tabelas")
p(f"  DWG:  {'OK' if dwg_ok else 'FALHOU (conversao necessaria)'}")
if dwg_ok:
    p(f"         {len(dwg_layers)} layers | {len(dwg_blocks)} tipos blocos | {len(dwg_dims)} cotas | {len(dwg_hatches)} hatches")
p(f"  IA:   {'OK' if ai_items else 'FALHOU'} - {len(ai_items)} itens, {len(ai_errors)} erros reportados pela propria IA")
if ai_tokens:
    cost = ai_tokens['input'] * 3/1e6 + ai_tokens['output'] * 15/1e6
    p(f"         Custo desta chamada: ~${cost:.4f}")

p(f"\nOutput completo salvo em: {OUT_FILE}")
out.close()
print(f"\n[Output completo salvo em {OUT_FILE}]")
