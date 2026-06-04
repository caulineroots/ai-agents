# -*- coding: utf-8 -*-
"""
pipeline_router.py
Varra todas as pranchas do projeto C&A, extrai dados de PDF + DXF
e decide quais precisam de chamada IA e quais nao precisam.

Saida:
  pipeline_router_report.txt
  pipeline_router_results.json
"""

import os, re, json, sys
from pathlib import Path
from collections import defaultdict

BASE    = r"C:\Users\AVELL\Downloads\Cauline Roots\Celmar\Projetos inicial\Projetos inicial"
PDF_DIR = os.path.join(BASE, "PDF")
DXF_DIR = os.path.join(BASE, "DXF")
PNG_DIR = os.path.join(BASE, "PNG")

OUT_TXT  = r"C:\Users\AVELL\Documents\Projects\AI-Agents\pipeline_router_report.txt"
OUT_JSON = r"C:\Users\AVELL\Documents\Projects\AI-Agents\pipeline_router_results.json"

SCORE_AUTO  = 6
SCORE_AUDIT = 3

RE_MEASURE = re.compile(r'\d+[,.]?\d*\s*(m[2]|ml|m\.l\.?|un|vb|m\b)', re.IGNORECASE)
RE_CEA_QNT = re.compile(r'CEA\s*[-]\s*QNT', re.IGNORECASE)
RE_QUADRO  = re.compile(r'QUADRO\s+DE\s+ACABAMENTOS', re.IGNORECASE)
RE_AREA    = re.compile(r'A\s*=\s*[\d,.]+\s*m', re.IGNORECASE)

TIPO_MAP = {
    "1": ("INT/DEC", "interior decorativo - visual complexo"),
    "2": ("INT/ILU", "iluminacao / axonometrica - visual"),
    "3": ("ARQ",     "arquitetonico - mixed"),
    "5": ("LAY",     "layout / areas - rico em dados"),
    "6": ("CVS",     "comunicacao visual - visual"),
}

def prancha_tipo(stem):
    m = re.search(r'[-_]R\d{2}-(\d)', stem)
    prefix = m.group(1) if m else "?"
    return TIPO_MAP.get(prefix, ("???", "tipo desconhecido"))


def extract_pdf(path):
    r = {"ok": False, "pages": 0, "text_lines": 0, "measure_lines": 0,
         "cea_qnt_tables": 0, "quadro_acabamentos": False,
         "area_tags": [], "tables_total": 0, "errors": []}
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            r["pages"] = len(pdf.pages)
            all_lines = []
            total_tables = 0
            for i, page in enumerate(pdf.pages):
                try:
                    text = page.extract_text(x_tolerance=2, y_tolerance=2) or ""
                    lines = [l.strip() for l in text.split("\n") if l.strip()]
                    all_lines.extend(lines)
                    tables = page.extract_tables() or []
                    total_tables += len(tables)
                    for t in tables:
                        if not t: continue
                        header = " ".join(str(c or "") for row in t[:2] for c in row)
                        if RE_CEA_QNT.search(header):
                            r["cea_qnt_tables"] += 1
                        if RE_QUADRO.search(header):
                            r["quadro_acabamentos"] = True
                except Exception as e:
                    r["errors"].append(f"pg{i+1}: {e}")
            r["text_lines"]    = len(all_lines)
            r["measure_lines"] = sum(1 for l in all_lines if RE_MEASURE.search(l))
            r["area_tags"]     = [l for l in all_lines if RE_AREA.search(l)][:5]
            r["tables_total"]  = total_tables
            r["ok"] = True
    except Exception as e:
        r["errors"].append(str(e))
    return r


def extract_dxf(path):
    """
    Parser linha-a-linha do DXF (formato texto par codigo/valor).
    Nao usa ezdxf — evita carregar o grafo completo (muito lento para arquivos >10MB).
    """
    r = {"ok": False, "layers": 0, "dims": 0, "blocks": 0,
         "texts": 0, "hatches": 0, "layer_names": [], "block_names": [], "errors": []}
    try:
        for enc in ("utf-8", "cp1252", "latin-1"):
            try:
                with open(path, "r", encoding=enc, errors="replace") as f:
                    lines = f.readlines()
                break
            except Exception:
                continue
        else:
            r["errors"].append("Falha ao abrir DXF")
            return r

        types_count  = defaultdict(int)
        all_layers   = set()
        block_counts = defaultdict(int)

        n = len(lines)
        i = 0
        current_entity = None

        while i < n - 1:
            code_raw  = lines[i].strip()
            value_raw = lines[i + 1].strip()
            i += 2

            if not code_raw.lstrip("-").isdigit():
                continue

            code = int(code_raw)

            if code == 0:
                current_entity = value_raw.upper()
                types_count[current_entity] += 1

            elif code == 2 and current_entity == "INSERT":
                if value_raw:
                    block_counts[value_raw] += 1

            elif code == 8:
                val = value_raw.strip()
                if val and val != "0":
                    all_layers.add(val)

        r["dims"]        = types_count.get("DIMENSION", 0)
        r["texts"]       = types_count.get("TEXT", 0) + types_count.get("MTEXT", 0)
        r["hatches"]     = types_count.get("HATCH", 0)
        r["layers"]      = len(all_layers)
        r["layer_names"] = sorted(all_layers)[:20]
        r["blocks"]      = len(block_counts)
        r["block_names"] = [
            f"{k}({v}x)"
            for k, v in sorted(block_counts.items(), key=lambda x: -x[1])[:10]
        ]
        r["ok"] = True
    except Exception as e:
        r["errors"].append(str(e))
    return r


def classify(pdf, dxf, tipo_code):
    score = 0
    reasons = []

    if pdf["ok"]:
        if pdf["cea_qnt_tables"] > 0:
            pts = pdf["cea_qnt_tables"] * 4
            score += pts
            reasons.append(f"PDF: {pdf['cea_qnt_tables']} tab.CEA-QNT (+{pts})")
        if pdf["quadro_acabamentos"]:
            score += 3
            reasons.append("PDF: Quadro Acabamentos (+3)")
        if pdf["measure_lines"] >= 10:
            pts = min(pdf["measure_lines"] // 10, 3)
            score += pts
            reasons.append(f"PDF: {pdf['measure_lines']} linhas medidas (+{pts})")
        if pdf["area_tags"]:
            score += 1
            reasons.append("PDF: tags A=...m2 (+1)")
    else:
        reasons.append("PDF: falhou")

    if dxf["ok"]:
        if dxf["dims"] >= 20:
            pts = min(dxf["dims"] // 20, 3)
            score += pts
            reasons.append(f"DXF: {dxf['dims']} cotas (+{pts})")
        if dxf["blocks"] >= 10:
            pts = min(dxf["blocks"] // 10, 2)
            score += pts
            reasons.append(f"DXF: {dxf['blocks']} blocos (+{pts})")
        if dxf["layers"] >= 20:
            score += 1
            reasons.append(f"DXF: {dxf['layers']} layers (+1)")
    else:
        reasons.append("DXF: nao disponivel")

    if tipo_code in ("1", "2", "6"):
        score = max(0, score - 3)
        reasons.append(f"tipo {tipo_code} visual (-3)")

    if score >= SCORE_AUTO:
        cls, icon = "DIRETO", "[OK]"
    elif score >= SCORE_AUDIT:
        cls, icon = "IA_AUDITORIA", "[AU]"
    else:
        cls, icon = "IA_NECESSARIA", "[IA]"

    return score, cls, icon, "; ".join(reasons)


def main():
    out = open(OUT_TXT, "w", encoding="utf-8")

    def p(msg=""):
        safe = msg.encode("cp1252", errors="replace").decode("cp1252")
        print(safe, flush=True)
        out.write(msg + "\n")
        out.flush()

    stems = set()
    for folder in [PDF_DIR, DXF_DIR, PNG_DIR]:
        if os.path.isdir(folder):
            for f in os.listdir(folder):
                stems.add(Path(f).stem)
    stems = sorted(stems)

    p(f"Pipeline Router - C&A Projeto CEA-254-BLN")
    p(f"Total pranchas: {len(stems)}")
    p(f"Limiares: [OK]DIRETO>={SCORE_AUTO} | [AU]IA_AUDITORIA>={SCORE_AUDIT} | [IA]IA_NECESSARIA<{SCORE_AUDIT}")
    p("=" * 70)

    results = []

    for stem in stems:
        pdf_path = os.path.join(PDF_DIR, stem + ".pdf")
        dxf_path = os.path.join(DXF_DIR, stem + ".dxf")
        png_path = os.path.join(PNG_DIR, stem + ".png")

        has_pdf = os.path.isfile(pdf_path)
        has_dxf = os.path.isfile(dxf_path)
        has_png = os.path.isfile(png_path)

        tipo_code_m = re.search(r'[-_]R\d{2}-(\d)', stem)
        tipo_code   = tipo_code_m.group(1) if tipo_code_m else "?"
        tipo_label, tipo_desc = prancha_tipo(stem)

        p(f"\n{'='*70}")
        p(f"Prancha: {stem}")
        p(f"Tipo: {tipo_label} - {tipo_desc}")
        p(f"Fontes: PDF={'OK' if has_pdf else '--'} | DXF={'OK' if has_dxf else '--'} | PNG={'OK' if has_png else '--'}")

        pdf_data = extract_pdf(pdf_path) if has_pdf else {"ok": False, "errors": ["sem PDF"], "cea_qnt_tables": 0, "quadro_acabamentos": False, "measure_lines": 0, "area_tags": []}
        dxf_data = extract_dxf(dxf_path) if has_dxf else {"ok": False, "errors": ["sem DXF"], "dims": 0, "blocks": 0, "layers": 0, "texts": 0, "hatches": 0}

        if has_pdf and pdf_data["ok"]:
            p(f"PDF  : {pdf_data['text_lines']} linhas | {pdf_data['measure_lines']} c/medidas | "
              f"{pdf_data['cea_qnt_tables']} tab.CEA-QNT | quadro={'sim' if pdf_data['quadro_acabamentos'] else 'nao'} | {pdf_data['tables_total']} tabelas")
        elif has_pdf:
            p(f"PDF  : ERRO: {pdf_data['errors']}")

        if has_dxf and dxf_data["ok"]:
            p(f"DXF  : {dxf_data['layers']} layers | {dxf_data['dims']} cotas | "
              f"{dxf_data['blocks']} blocos | {dxf_data['texts']} textos | {dxf_data['hatches']} hatches")
        elif has_dxf:
            p(f"DXF  : ERRO: {dxf_data['errors']}")

        score, cls, icon, reasoning = classify(pdf_data, dxf_data, tipo_code)
        p(f"Score: {score} -> {icon} {cls}")
        p(f"Motivo: {reasoning}")

        results.append({
            "stem": stem, "tipo": tipo_label,
            "has_pdf": has_pdf, "has_dxf": has_dxf, "has_png": has_png,
            "pdf_text_lines": pdf_data.get("text_lines", 0),
            "pdf_measure_lines": pdf_data.get("measure_lines", 0),
            "pdf_cea_qnt": pdf_data.get("cea_qnt_tables", 0),
            "pdf_quadro": pdf_data.get("quadro_acabamentos", False),
            "dxf_dims": dxf_data.get("dims", 0),
            "dxf_blocks": dxf_data.get("blocks", 0),
            "dxf_layers": dxf_data.get("layers", 0),
            "score": score, "classificacao": cls, "reasoning": reasoning,
        })

    direto     = [r for r in results if r["classificacao"] == "DIRETO"]
    auditoria  = [r for r in results if r["classificacao"] == "IA_AUDITORIA"]
    necessaria = [r for r in results if r["classificacao"] == "IA_NECESSARIA"]

    p(f"\n{'='*70}")
    p("RESUMO FINAL")
    p("=" * 70)

    p(f"\n[OK] DIRETO ({len(direto)}) - extracao PDF+DXF suficiente, IA dispensavel:")
    for r in direto:
        p(f"   [{r['score']:2d}] {r['stem']}")

    p(f"\n[AU] IA_AUDITORIA ({len(auditoria)}) - dados parciais, IA confirma:")
    for r in auditoria:
        p(f"   [{r['score']:2d}] {r['stem']}")

    p(f"\n[IA] IA_NECESSARIA ({len(necessaria)}) - pouco dado estruturado, IA essencial:")
    for r in necessaria:
        p(f"   [{r['score']:2d}] {r['stem']}")

    total = len(results)
    n_ia  = len(auditoria) + len(necessaria)
    custo = n_ia * 0.05
    economia = len(direto) / total * 100 if total else 0
    p(f"\nTotal pranchas: {total}")
    p(f"Chamadas IA estimadas: {n_ia}/{total} ({100-economia:.0f}%)")
    p(f"Custo estimado IA: ~${custo:.2f}  (vs ${total*0.05:.2f} sem filtro)")
    p(f"Economia: ~{economia:.0f}% das chamadas evitadas")
    p(f"\nRelatorio: {OUT_TXT}")
    p(f"JSON: {OUT_JSON}")

    out.close()

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "total": total, "direto": len(direto),
            "ia_auditoria": len(auditoria), "ia_necessaria": len(necessaria),
            "custo_estimado_usd": round(custo, 2),
            "economia_pct": round(economia, 1),
            "pranchas": results
        }, f, ensure_ascii=False, indent=2)

    print(f"\n[Relatorio salvo em {OUT_TXT}]", flush=True)
    print(f"[JSON salvo em {OUT_JSON}]", flush=True)


if __name__ == "__main__":
    main()
