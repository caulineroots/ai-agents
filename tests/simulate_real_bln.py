# -*- coding: utf-8 -*-
"""Simula a run REAL do BLN (dump colado pelo usuário) através do pipeline ATUAL
(dedup + map corrigidos) para prever os números pós-restart do serviço e separar
bug estrutural de divergência inerente (derivação por área)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from extractors.table_dedup import (
    dedup_by_fingerprint, map_rows_to_xlsx, filter_orcar_items, _parse_revisao,
)

ITEMS: list[dict] = []


def add(stem, tabela, desc, qty, un="m2", gt=None):
    rev_str, rev_num = _parse_revisao(stem)
    ITEMS.append({
        "prancha_id": stem, "revisao": rev_str, "revisao_num": rev_num,
        "tabela": tabela, "descricao": desc, "quantidade": qty, "unidade": un,
        "grand_total_tabela": gt,
    })


# Conjunto PAREDES master (idêntico entre pranchas → dedup colapsa p/ 301)
def add_paredes(stem):
    P = [
        ("ALVENARIA EM BLOCO CELULAR - 14CM", 10),
        ("ALVENARIA EM BLOCO DE CONCRETO - 14CM", 204),
        ("CERÂMICA ELIANE 20x20, COR BRANCA, LINHA FORMA WHITE BRILHANTE, COM REJUNTE BRANCO E PERFIL", 80),
        ("DIVISORIA EUCATEX DIVILUX 35 - SANITÁRIOS", 29),
        ("FECHAM. COMPARTIMENTOS: DIVISÓRIAS, REF. SISTEMA DIVILUX 35, REVEST. FORMIDUR BP PLUS COR BRANCO", 13),
        ("DRYWALL GESSO ACARTONADO RESISTENTE À UMIDADE", 98),
        ("DRYWALL GESSO RF/RF - 950mm", 15),
        ("DRYWALL GESSO ST + RFID - 825mm", 55),
        ("DRYWALL GESSO ST - 825mm", 385),
        ("DRYWALL GESSO ST/ST - 950mm", 79),
        ("DRYWALL GESSO ST/ST+RFID - 950mm", 103),
        ("VIDRO TEMPERADO 10 mm, LISO, TRANSPARENTE INCOLOR", 12),
        ("PAINEL EM MDF 18mm COM ACABAMENTO EM FÓRMICA COR BRANCO TX", 243),
        ("PAINEL EM MDF 18mm COM ACABAMENTO EM FÓRMICA COR ÁRTICO TX", 45),
    ]
    for d, q in P:
        add(stem, "PAREDES", d, q)


# Conjunto PINTURA (gelo fosca, acartonado, diário menina, látex gelo/neve)
def add_pintura(stem):
    P = [
        ("PINTURA ACRÍLICA FOSCA, COR BRANCO GELO", 371),
        ("PINTURA ACRÍLICA FOSCA, COR DIÁRIO DE MENINA FABR. CORAL", 15),
        ("PINTURA ACRÍLICA SEMI-BRILHO, COR BRANCO GELO FABRIC. SUVINIL, EM GESSO ACARTONADO", 663),
        ("PINTURA LÁTEX ACRÍLICO SEMI-BRILHO, COR BRANCO GELO, SOBRE DRYWALL", 42),
        ("PINTURA LÁTEX ACRÍLICO SEMI-BRILHO, COR BRANCO NEVE, SOBRE DRYWALL", 60),
    ]
    for d, q in P:
        add(stem, "PINTURA", d, q)


# Conjunto RODAPES (idêntico entre 312/313/341/131/331)
def add_rodapes(stem, r20=140.39):
    R = [
        ("PAINEL EM MDP BRANCO - RODAPÉ TABLADO VITRINE", 5.05),
        ("RODAPÉ DA ESCADA DOS PROVADORES EM GRANITO BRANCO CEARÁ", 16.21),
        ("RODAPÉ EM MADEIRA CURUPIXÁ OU TAUARI - 7CM", 42.5),
        ("RODAPÉ EM MADEIRA CURUPIXÁ OU TAUARI - 20CM", r20),
        ("RODAPÉ PRIMER TARKET – 10X240cm, SALÃO DE VENDAS", 131.7),
        ("RODAPÉ EM LAMINADO MELAMÍNICO REF. FORMICA PRATTAN L151", 43.68),
        ("RODAPÉ PRIMER 24006120 TARKET – 50X240mm, CABINES", 99.26),
        ("RODAPÉ EM CHAPA DE AÇO INOX ESCOVADO, H=10cm", 9.88),
    ]
    for d, q in R:
        add(stem, "RODAPES", d, q, "ml")


def add_pisos(stem):
    add(stem, "PISOS", "SOLEIRA GRANITO CINZA ANDORINHA", 1.49)  # m2 → ignorado
    add(stem, "PISOS", "ARGAMASSA IMPERMEABILIZANTE BI COMPONENTE SEMI-FLEXÍVEL (SIKATOP-100 OU VIAPLUS TOP)", 28.87)
    add(stem, "PISOS", "IMPERMEABILIZAÇÃO COM MANTA ASFÁLTICA TIPO TORODIN OU SIMILAR", 42.96)
    add(stem, "PISOS", "PISO VINÍLICO TARKETT LINHA AMBIENTA RÚSTICO PADRÃO CANELA", 914.55)
    add(stem, "PISOS", "PISO CIMENTADO LISO SOBRE BASE SELADA COM CASCORES E PINTURA EPÓXI COR CINZA CLARO", 64.69)


# ── Pranchas ────────────────────────────────────────────────────────────────
# Tapume
add("CEA-254-BLN-ARQ_R02-302 - ARQ TAPUME", "TAPUMES",
    "TAPUME COMPENSADO 6 mm ESTRUTURADO COM PONTALETES 3”x3” NA COR BRANCA", 104)

# PAREDES repetidas (vendas: 303,307,301 ; adm: 305,309)
for s in ("CEA-254-BLN-ARQ_R02-303-AREA TECNICA",
          "CEA-254-BLN-ARQ_R02-305 - ARQ SANITARIOS",
          "CEA-254-BLN-ARQ_R02-307 - ARQ DIVISORIAS",
          "CEA-254-BLN-ARQ_R03-301-ARQ CIVIL",
          "CEA-254-BLN-ARQ_R03-309-ARQ DESCOMPRESSÃO"):
    add_paredes(s)

# PINTURA repetida (vendas: 313,301 ; adm: 305,312,304,309)
for s in ("CEA-254-BLN-ARQ_R02-305 - ARQ SANITARIOS",
          "CEA-254-BLN-ARQ_R02-312 - ARQ SALA DE REUNIOES",
          "CEA-254-BLN-ARQ_R02-313 - ARQ ELEVADORES",
          "CEA-254-BLN-ARQ_R03-301-ARQ CIVIL",
          "CEA-254-BLN-ARQ_R03-304-ARQ COPA",
          "CEA-254-BLN-ARQ_R03-309-ARQ DESCOMPRESSÃO"):
    add_pintura(s)

# RODAPES repetidas (312,313,341,131,331)
for s in ("CEA-254-BLN-ARQ_R02-312 - ARQ SALA DE REUNIOES",
          "CEA-254-BLN-ARQ_R02-313 - ARQ ELEVADORES",
          "CEA-254-BLN-ARQ_R02-341 - ARQ FACHADAS E VITRINES",
          "CEA-254-BLN-ARQ_R03-331-ARQ PISO"):
    add_rodapes(s, r20=140.39)
add_rodapes("CEA-254-BLN-ARQ_R03-131-DEC PROVADORES", r20=134.03)

# PISOS repetidas (312,313,331)
for s in ("CEA-254-BLN-ARQ_R02-312 - ARQ SALA DE REUNIOES",
          "CEA-254-BLN-ARQ_R02-313 - ARQ ELEVADORES",
          "CEA-254-BLN-ARQ_R03-331-ARQ PISO"):
    add_pisos(s)

# SOLEIRAS (só 331)
add("CEA-254-BLN-ARQ_R03-331-ARQ PISO", "SOLEIRAS", "SOLEIRA EM GRANITO BRANCO CEARÁ", 22.62, "ml")
add("CEA-254-BLN-ARQ_R03-331-ARQ PISO", "SOLEIRAS", "SOLEIRA EM GRANITO CINZA ANDORINHA", 5.88, "ml")

# RFID (só 301)
add("CEA-254-BLN-ARQ_R03-301-ARQ CIVIL", "RFID_PAREDES_RFID", "RFID_GRAND_TOTAL", 158)

# PORTAS (306 e 301) — alçapão, PD034, PD037, PF
for s in ("CEA-254-BLN-ARQ_R02-306 - ARQ CAIXILHOS", "CEA-254-BLN-ARQ_R03-301-ARQ CIVIL"):
    add(s, "GERAL", "PD 034 PORTA PARA DIVISÓRIA EUCATEX COM MAÇANETA TIPO ALAVANCA - ABRIR - 1F", 3, "un")
    add(s, "GERAL", "PD 037 PORTA PARA HIDRANTE EM VIDRO FUMÊ TEMPERADO 10mm", 3, "un")
    add(s, "GERAL", "PF 017 PORTA EM CHAPA DE FERRO LISA - ABRIR - 1F - COM GRELHA CONFORME PROJETO", 2, "un")
    add(s, "GERAL", "PF 025 PORTA EM CHAPA DE FERRO LISA - ABRIR - 2F", 1, "un")
    add(s, "GERAL", "ALÇAPÃO 50x50cm PARA ACESSO AO FORRO", 14, "un")


# ── Checklist (qdeReferencia = gabarito) ─────────────────────────────────────
GAB = {
    "2.1": 104, "9.5": 204, "25.2": 10, "15.1": 81, "13.1": 30,
    "12.1": 672, "12.2": 274, "12.4": 98, "12.6": 15, "19.4": 12,
    "18.3": 1076, "18.5": 708, "18.4": 60, "18.8": 15, "18.10": 1044, "18.11": 408,
    "14.1": 914.55, "14.8": 11.4, "14.19": 5.88, "14.13": 42.5, "14.14": 135.03,
    "14.5": 131.7, "18.1": 39.61, "10.1": 42.96, "10.2": 28.87,
    "22.15": 43.68, "22.14": 99.26, "23.9": 9.88, "25.5": 5.05, "25.4": 16.21,
    "25.1": 158, "12.11": 15, "13.3": 3, "21.15": 3, "8.14": 1,
}
CHECKLIST = [{"cod": c, "descricao": c, "unidade": "m2", "qdeReferencia": q} for c, q in GAB.items()]


def main():
    items = filter_orcar_items(ITEMS)
    deduped, _ = dedup_by_fingerprint(items)
    mapped, _unmapped, _log, _pre = map_rows_to_xlsx(deduped, CHECKLIST, api_key="")
    by_cod = {m["cod"]: m for m in mapped}

    print(f"{'Cod':<7}{'Simul':>10}{'Gabarito':>10}{'Div%':>8}  Status")
    print("-" * 50)
    ok = warn = bad = 0
    for cod in sorted(GAB, key=lambda x: [int(p) for p in x.split('.')]):
        m = by_cod.get(cod)
        q = m["quantidade"] if m else 0.0
        ref = GAB[cod]
        div = abs(q - ref) / ref * 100 if ref else 0
        flag = m.get("status", "") if m else "AUSENTE"
        st = "OK" if div <= 15 else ("WARN" if div <= 35 else "BAD")
        ok += st == "OK"; warn += st == "WARN"; bad += st == "BAD"
        extra = f"  [{flag}]" if flag and flag != "confirmado" else ""
        print(f"{cod:<7}{q:>10.2f}{ref:>10.2f}{div:>7.1f}%  {st}{extra}")
    print("-" * 50)
    print(f"OK: {ok}  WARN: {warn}  BAD: {bad}")


if __name__ == "__main__":
    main()
