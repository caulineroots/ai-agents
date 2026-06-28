# -*- coding: utf-8 -*-
"""Valida pipeline dedup vs Gabarito BLN usando linhas típicas do run do usuário."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from extractors.table_dedup import (
    filter_orcar_items, dedup_by_fingerprint, map_rows_to_xlsx,
)

# Gabarito qdeReferencia (Gabarito Celmar BLN.md)
GABARITO = {
    "2.1": 104,      # tapume — gabarito sem qde na planilha; PDF tem 104
    "18.3": 1153,
    "18.4": 60,
    "18.5": 708,
    "18.8": 15,
    "18.10": 1044,
    "18.11": 408,
    "12.11": 15,
    "14.19": 5.88,
    "14.8": 11.4,
    "14.1": 1024.98,
    "13.1": 30,
    "15.1": 81,
    "12.1": 672,
    "12.2": 274,
    "12.4": 98,
    "12.6": 15,
    "9.5": 204,      # gab 230 — R03-301 tem 204
    "25.1": 158,
}

def stem(rev: str, num: str, name: str = "") -> str:
    return f"CEA-254-BLN-ARQ_{rev}-{num}-{name}"


def build_run_items() -> list[dict]:
    """Itens representativos do output Passo 2 do usuário."""
    items: list[dict] = []

    def add(stem_s, tab, desc, qty, un, rev=3, gt=None, zona=None):
        items.append({
            "prancha_id": stem_s, "tabela": tab, "descricao": desc,
            "quantidade": qty, "unidade": un, "revisao_num": rev,
            "grand_total_tabela": gt, "zona": zona,
        })

    # Tapume 302
    add(stem("R02", "302"), "TAPUMES", "TAPUME COMPENSADO 6 mm ESTRUTURADO COM PONTALETES", 104, "m2", rev=2)

    # Pintura duplicada — várias pranchas (305, 309, 312, 301)
    for s, rev, gelo, acart, neve, zona in [
        (stem("R03", "301", "CIVIL"), 3, 371, 663, 60, "vendas"),
        (stem("R02", "305", "SAN"), 2, 368, 666, 60, "adm"),
        (stem("R03", "309", "DESC"), 3, 371, 663, 60, "adm"),
        (stem("R02", "312", "SALA"), 2, 368, 666, 60, "adm"),
    ]:
        add(s, "PINTURA", "PINTURA ACRÍLICA FOSCA, COR BRANCO GELO", gelo, "m2", rev=rev, gt=800, zona=zona)
        add(s, "PINTURA", "PINTURA ACRÍLICA SEMI-BRILHO, COR BRANCO GELO FABRIC. SUVINIL, EM GESSO ACARTONADO", acart, "m2", rev=rev, gt=800, zona=zona)
        add(s, "PINTURA", "PINTURA LÁTEX ACRÍLICO SEMI-BRILHO, COR BRANCO NEVE, SOBRE DRYWALL", neve, "m2", rev=rev, gt=800, zona=zona)
        add(s, "PINTURA", "PINTURA ACRÍLICA FOSCA, COR DIÁRIO DE MENINA FABR. CORAL", 15, "m2", rev=rev, gt=800, zona=zona)

    # Lixo numérico (301/304/309)
    add(stem("R03", "301"), "PINTURA", "264.34", 663, "m2", rev=3)
    add(stem("R03", "304"), "PINTURA", "ACARTONADO 264.34", 663, "m2", rev=3)

    # PAREDES duplicadas — cerâmica 15.1
    for s, rev in [(stem("R03", "301"), 3), (stem("R02", "305"), 2), (stem("R03", "309"), 3)]:
        add(s, "PAREDES", "CERÂMICA ELIANE 20x20, COR BRANCA, LINHA FORMA WHITE BRILHANTE", 80, "m2", rev=rev, gt=500)
        add(s, "PAREDES", "DIVISORIA EUCATEX DIVILUX 35 - SANITÁRIOS", 29, "m2", rev=rev, gt=500)
    # 13.1 divilux: FECHAM (13) + SANITÁRIOS (29) = mesmo sistema → max, não soma
    add(stem("R03", "301"), "PAREDES",
        "FECHAM. COMPARTIMENTOS: DIVISÓRIAS, REF. SISTEMA DIVILUX 35, REVEST. FORMIDUR BP PLUS",
        13, "m2", rev=3, gt=500)

    # Drywall — 301 (faces ST somam; RU acartonado vira 12.4, não pintura)
    add(stem("R03", "301"), "PAREDES", "DRYWALL GESSO ST - 825mm", 385, "m2", rev=3, gt=500)
    add(stem("R03", "301"), "PAREDES", "DRYWALL GESSO ST + RFID - 825mm", 55, "m2", rev=3, gt=500)
    add(stem("R03", "301"), "PAREDES", "DRYWALL GESSO ST/ST - 950mm", 79, "m2", rev=3, gt=500)
    add(stem("R03", "301"), "PAREDES", "DRYWALL GESSO ST/ST+RFID - 950mm", 103, "m2", rev=3, gt=500)
    add(stem("R03", "301"), "PAREDES", "DRYWALL GESSO ACARTONADO RESISTENTE À UMIDADE", 98, "m2", rev=3, gt=500)
    add(stem("R03", "301"), "PAREDES", "DRYWALL GESSO RF/RF - 950mm", 15, "m2", rev=3, gt=500)

    # Portas / alçapão
    add(stem("R03", "301"), "GERAL", "ALÇAPÃO 50x50cm PARA ACESSO AO FORRO", 14, "un", rev=3)
    add(stem("R02", "306"), "GERAL", "ALÇAPÃO 50x50cm PARA ACESSO AO FORRO", 14, "un", rev=2)
    add(stem("R03", "301"), "GERAL", "PD 032 PORTA PARA DIVISÓRIA EUCATEX COM MAÇANETA PARA CELA SANITÁRIA", 10, "un", rev=3)
    add(stem("R02", "306"), "GERAL", "PD 032 PORTA PARA DIVISÓRIA EUCATEX COM MAÇANETA PARA CELA SANITÁRIA", 10, "un", rev=2)

    # Soleiras 331
    add(stem("R03", "331"), "SOLEIRAS", "SOLEIRA EM GRANITO CINZA ANDORINHA", 5.88, "ml", rev=3)
    # Branco Ceará: PDF soma 22,62 mas QDE é takeoff manual (3,8 a 11,4 conforme
    # revisão). Item sai como 'aguardando' p/ revisão; valor é estimativa do PDF.
    add(stem("R03", "331"), "SOLEIRAS", "SOLEIRA EM GRANITO BRANCO CEARÁ", 22.62, "ml", rev=3)
    add(stem("R02", "312"), "PISOS", "SOLEIRA GRANITO CINZA ANDORINHA", 1.49, "m2", rev=2)

    # Pisos 331
    add(stem("R03", "331"), "PISOS", "PISO VINÍLICO TARKETT LINHA AMBIENTA RÚSTICO PADRÃO CANELA", 914.55, "m2", rev=3, gt=920)
    add(stem("R02", "312"), "PISOS", "PISO VINÍLICO TARKETT LINHA AMBIENTA RÚSTICO PADRÃO CANELA", 920.12, "m2", rev=2, gt=920)

    # Rodapés — preferir 331
    add(stem("R03", "331"), "RODAPES", "RODAPÉ PRIMER TARKET – 10X240cm, SALÃO DE VENDAS", 131.7, "ml", rev=3)
    add(stem("R02", "312"), "RODAPES", "RODAPÉ PRIMER TARKET – 10X240cm, SALÃO DE VENDAS", 130.84, "ml", rev=2)

    # RFID
    add(stem("R03", "301"), "RFID_PAREDES_RFID", "RFID_GRAND_TOTAL", 158, "m2", rev=3)

    return items


def main():
    checklist = [
        {"cod": c, "descricao": c, "unidade": "m2", "qdeReferencia": q}
        for c, q in GABARITO.items()
    ]
    raw = build_run_items()
    filtered = filter_orcar_items(raw)
    deduped, _ = dedup_by_fingerprint(filtered)
    mapped, _, _, _ = map_rows_to_xlsx(deduped, checklist, "")

    print("=" * 72)
    print("VALIDAÇÃO PIPELINE vs GABARITO BLN")
    print("=" * 72)
    print(f"{'Cod':<8} {'Pipeline':>12} {'Gabarito':>12} {'Div%':>8}  Status")
    print("-" * 72)

    by_cod = {m["cod"]: m["quantidade"] for m in mapped}
    watch = ["2.1", "18.3", "18.4", "18.5", "18.8", "18.10", "18.11",
             "12.11", "14.19", "14.8", "14.1", "13.1", "15.1", "12.1", "12.2",
             "12.4", "12.6", "9.5", "25.1"]

    ok = warn = bad = 0
    for cod in watch:
        got = by_cod.get(cod, 0)
        ref = GABARITO.get(cod, 0)
        if ref <= 0:
            status = "—"
        else:
            delta = abs(got - ref) / ref * 100
            if delta <= 15:
                status = "OK"
                ok += 1
            elif delta <= 30:
                status = "WARN"
                warn += 1
            else:
                status = "BAD"
                bad += 1
            print(f"{cod:<8} {got:>12.2f} {ref:>12.2f} {delta:>7.1f}%  {status}")
            continue
        print(f"{cod:<8} {got:>12.2f} {ref:>12.2f} {'—':>8}  {status}")

    print("-" * 72)
    print(f"OK: {ok}  WARN: {warn}  BAD: {bad}")
    print()
    print("NOTA: Passo 2 mostra extração bruta por prancha.")
    print("      GLOBAL_SCAN / lixo numérico não entram no orçamento.")
    print("      PAREDES repetidas em R02+R03 são deduplicadas no Passo 3.")


if __name__ == "__main__":
    main()
