"""Compare PDF extraction output vs Gabarito Celmar BLN.md — generates report data."""
import argparse
import json
import re
import sys
from pathlib import Path

GABARITO = Path(__file__).parent / "Gabarito Celmar BLN.md"

# Authoritative deduplicated quantities from PDF (prefer R03-301 / dedicated tabs)
PDF = {
    "2.1 Tapume": ("m2", 104, "2.1"),
    "9.5 Alvenaria bloco concreto": ("m2", 204, "9.5"),
    "25.2 Alvenaria bloco celular": ("m2", 10, "25.2"),
    "9.7 Chapisco/emboço": ("m2", None, "9.7"),
    "12.1 Drywall ST 1 face (825mm)": ("m2", 385 + 46, "12.1"),  # R03-301 QNT PAREDES
    "12.2 Drywall ST/ST 2 faces (950mm)": ("m2", 79 + 103, "12.2"),  # ST/ST + ST/ST+RFID
    "12.3 Drywall RU umidade": ("m2", 98, "12.3"),
    "12.4 Drywall RU 2 faces": ("m2", None, "12.4"),
    "12.5 Drywall RF 1 face": ("m2", None, "12.5"),
    "12.6 Drywall RF 2 faces": ("m2", 15, "12.6"),
    "12.9 Forro gesso tabicado": ("m2", 39.29 + 378.56 + 96.44 + 320.42 + 610.48, "12.9"),
    "12.11 Alçapão forro": ("un", 14, "12.11"),
    "13.1 Fecham Divilux 35": ("m2", 13 + 29, "13.1"),  # R03-301: fecham. 13 + sanitários 29
    "13.2 Porta divisória sanitário": ("un", 10, "13.2"),
    "13.3 Porta divisória alavanca": ("un", 3, "13.3"),
    "10.1 Impermeabilização manta": ("m2", 42.96, "10.1"),
    "10.2 Impermeabilização sanitários": ("m2", 28.87, "10.2"),
    "14.1 Piso vinílico SV (total)": ("m2", 914.55 + 105.22, "14.1"),
    "14.5 Rodapé Primer Tarkett SV": ("ml", 131.7, "14.5"),
    "14.6 Piso tátil": ("un", 16, "14.6"),
    # R03-331 CEA -QNT SOLEIRAS: comprimentos (2ª dimensão) somados
    "14.8 Soleira granito Branco Ceará": ("ml", 6.66 + 7.38 + 7.25 + 1.33, "14.8"),
    "14.11 Cerâmica parede/azulejo": ("m2", 80, "15.1"),
    "14.13 Rodapé madeira 7cm": ("ml", 42.5, "14.13"),
    "14.14 Rodapé madeira 20cm": ("ml", 134.03, "14.14"),
    "14.19 Soleira granito Cinza Andorinha": ("ml", 0.79 + 1.12 + 1.30 + 0.89 + 0.89 + 0.89, "14.19"),
    "18.1 Epóxi piso cimentado": ("m2", 64.69, "18.1"),
    "18.3 Pintura acrílica branco gelo": ("m2", 371, "18.3+18.5"),
    "18.4 Pintura branco neve": ("m2", 60, "18.4"),
    "18.8 Pintura Diário de Menina": ("m2", 15, "18.8"),
    "18.10 Pintura forro branco neve": ("m2", 663, "18.10+18.11"),
    "19.4 Vidro temperado vitrine": ("m2", 12, "19.4"),
    "20.2 Porta madeira 0.72": ("un", 2, "20.2"),
    "20.3 Porta madeira 0.82": ("un", 6, "20.3"),
    "21.14 Caixa hidrante": ("un", 3, "21.14"),
    "21.15 Vidro hidrante": ("un", 3, "21.15"),
    "22.3 Laminado branco provadores": ("m2", 243, "22.3"),
    "22.1 Laminado ártico provadores": ("m2", 42, "22.1"),
    "22.14 Rodapé MDF provador Tarkett": ("ml", 99.26, "22.14"),
    "22.15 Rodapé fórmica Prattan": ("ml", 43.68, "22.15"),
    "23.4 ACM branco brilho": ("m2", 52, "23.4"),
    "25.1 RFID": ("m2", 158, "25.1"),
    "25.4 Rodapé escada provadores granito": ("ml", 16.21, "25.4"),
    "25.5 Rodapé MDP vitrine": ("ml", 5.05, "25.5"),
    "25.7 Grama sintética": ("m2", 8.58, "25.7"),
    "Estantes linear": ("ml", 273.93, "14.15*"),
    "Estantes ponto": ("un", 131, "14.15*"),
    "Montagem estante metálica": ("pç", None, "14.15"),  # R03-501: 194 estantes / 26.194 peças — não mapeia 108 pç
    "14.11 Cerâmica piso ADM (P3)": ("m2", 350.88 + 11.36, "14.11"),  # R03-331 QNT PISOS
}

GABARITO_QDE = {
    "2.1": ("m2", 0, "Tapume (zerado na proposta)"),
    "9.5": ("m2", 230, "Alvenaria bloco concreto"),
    "9.7": ("m2", 460, "Chapisco e emboço"),
    "12.1": ("m2", 672, "Drywall STD 1 face"),
    "12.2": ("m2", 274, "Drywall STD 2 faces"),
    "12.3": ("m2", 40.84, "Drywall RU 1 face"),
    "12.4": ("m2", 98, "Drywall RU 2 faces"),
    "12.5": ("m2", 3, "Drywall RF 1 face"),
    "12.6": ("m2", 15, "Drywall RF 2 faces"),
    "12.9": ("m2", 1457.44, "Forro gesso"),
    "12.11": ("un", 15, "Alçapão"),
    "12.12": ("un", 176, "Aberturas forro luminárias"),
    "13.1": ("m2", 30, "Fecham. Divilux"),
    "13.2": ("un", 10, "Porta sanitário divisória"),
    "13.3": ("un", 3, "Porta alavanca divisória"),
    "10.1": ("m2", 43.7, "Impermeabilização manta"),
    "10.2": ("m2", 28.87, "Impermeabilização sanitários"),
    "14.1": ("m2", 1024.98, "Assentamento piso vinílico"),
    "14.2": ("m2", 1024.98, "Autonivelante"),
    "14.5": ("ml", 130.84, "Rodapé Primer Tarkett"),
    "14.6": ("vb", 16, "Piso tátil"),
    "14.8": ("ml", 11.4, "Soleira Branco Ceará"),
    "14.11": ("m2", 361, "Piso cerâmico ADM"),
    "15.1": ("m2", 81, "Azulejo parede"),
    "14.13": ("ml", 42.5, "Rodapé madeira 7cm"),
    "14.14": ("ml", 140.39, "Rodapé madeira 20cm"),
    "14.19": ("ml", 5.88, "Soleira Cinza Andorinha"),
    "18.1": ("m2", 39.61, "Epóxi cimentado"),
    "18.3": ("m2", 1153, "Pintura branco gelo vendas"),
    "18.5": ("m2", 708, "Pintura branco gelo ADM"),
    "18.4": ("m2", 60, "Pintura branco neve"),
    "18.8": ("m2", 15, "Pintura Diário de Menina"),
    "18.10": ("m2", 1044, "Pintura forro vendas"),
    "18.11": ("m2", 408, "Pintura forro ADM"),
    "19.4": ("m2", 11.61, "Vidro vitrine"),
    "20.2": ("un", 2, "Porta 0.72"),
    "20.3": ("un", 6, "Porta 0.82"),
    "21.14": ("un", 3, "Caixa hidrante"),
    "21.15": ("un", 3, "Vidro hidrante"),
    "22.1": ("m2", 42, "Laminado ártico"),
    "22.3": ("m2", 243, "Laminado branco"),
    "22.14": ("m", 99.3, "Rodapé MDF provador"),
    "22.15": ("m", 43.7, "Rodapé fórmica"),
    "23.4": ("m2", 55.68, "ACM fachada"),
    "25.1": ("m2", 158, "RFID"),
    "25.4": ("ml", 16.21, "Rodapé escada provadores"),
    "25.5": ("ml", 5.05, "Rodapé MDP vitrine"),
    "25.7": ("m2", 10, "Grama sintética"),
    "14.15": ("pç", 108, "Montagem estante metálica"),
}

def parse_gabarito_items():
    text = GABARITO.read_text(encoding="utf-8")
    items = []
    in_table = False
    for line in text.splitlines():
        if line.startswith("| CC | Zona |"):
            in_table = True
            continue
        if not in_table or not line.startswith("|"):
            continue
        cols = [c.strip() for c in line.split("|")[1:-1]]
        if len(cols) < 6:
            continue
        item = cols[2]
        if not re.match(r"[\dA]", item):
            continue
        desc = cols[3]
        un = cols[4]
        qde = cols[5]
        try:
            q = float(qde.replace(",", ".")) if qde else 0
        except ValueError:
            q = 0
        items.append({"cod": item, "desc": desc, "un": un, "qde": q})
    return items


def load_orcar_json(path: Path) -> dict[str, float]:
    """Carrega saída de /orcar-tabelas → {cod: quantidade}."""
    data = json.loads(path.read_text(encoding="utf-8"))
    by_cod: dict[str, float] = {}
    for it in data.get("itens", []):
        cod = it.get("cod")
        if cod:
            by_cod[cod] = by_cod.get(cod, 0.0) + float(it.get("quantidade", 0))
    return by_cod


def compare_cod(cod: str, pdf_q: float | None, g_q: float) -> tuple[str, str]:
    if pdf_q is None:
        return "MISSING", "—"
    delta_pct = abs(pdf_q - g_q) / g_q * 100 if g_q else 0
    if delta_pct <= 5:
        status = "OK"
    elif delta_pct <= 15:
        status = "CLOSE"
    else:
        status = "DIFF"
    delta = f"{pdf_q - g_q:+.2f} ({delta_pct:.1f}%)"
    return status, delta


def run_hardcoded_compare():
    items = parse_gabarito_items()
    with_qde = [i for i in items if i["qde"] > 0]
    print(f"Gabarito items with QDE>0: {len(with_qde)}")
    print("\n=== PDF vs GABARITO (hardcoded subset) ===")
    stats = {"OK": 0, "CLOSE": 0, "DIFF": 0, "MISSING": 0}
    for label, (un, pdf_q, cod) in PDF.items():
        base_cod = cod.split("+")[0].split("*")[0]
        if base_cod not in GABARITO_QDE:
            print(f"  {label}: PDF={pdf_q} | gabarito cod {cod} not mapped")
            continue
        g_un, g_q, g_desc = GABARITO_QDE[base_cod]
        status, delta = compare_cod(base_cod, pdf_q, g_q)
        stats[status] = stats.get(status, 0) + 1
        print(f"  [{status}] {label}: PDF={pdf_q} vs GAB={g_q} {g_un} | {delta}")
    print(f"\nSummary: OK={stats['OK']} CLOSE={stats['CLOSE']} DIFF={stats['DIFF']} MISSING={stats['MISSING']}")


def run_orcar_compare(orcar_path: Path):
    by_cod = load_orcar_json(orcar_path)
    print(f"Loaded {len(by_cod)} códigos from {orcar_path}")
    print("\n=== ORCAR vs GABARITO ===")
    stats = {"OK": 0, "CLOSE": 0, "DIFF": 0, "MISSING": 0}
    for cod, (g_un, g_q, g_desc) in sorted(GABARITO_QDE.items(), key=lambda x: x[0]):
        pdf_q = by_cod.get(cod)
        status, delta = compare_cod(cod, pdf_q, g_q)
        stats[status] = stats.get(status, 0) + 1
        if pdf_q is not None or g_q > 0:
            print(f"  [{status}] {cod} {g_desc[:40]}: pipeline={pdf_q} vs GAB={g_q} {g_un} | {delta}")
    print(f"\nSummary: OK={stats['OK']} CLOSE={stats['CLOSE']} DIFF={stats['DIFF']} MISSING={stats['MISSING']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compare BLN extraction vs gabarito")
    parser.add_argument(
        "--orcar-json",
        type=Path,
        help="JSON de saída do endpoint /orcar-tabelas",
    )
    args = parser.parse_args()
    if args.orcar_json:
        if not args.orcar_json.exists():
            print(f"File not found: {args.orcar_json}", file=sys.stderr)
            sys.exit(1)
        run_orcar_compare(args.orcar_json)
    else:
        run_hardcoded_compare()
