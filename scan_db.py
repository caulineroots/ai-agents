"""Varredura de duplicatas no nomenclaturas_db.json."""
import json
import re
import unicodedata
import collections
from pathlib import Path

DB_PATH = Path(__file__).parent / "nomenclaturas_db.json"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s).lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip()


def scan():
    db = json.loads(DB_PATH.read_text(encoding="utf-8"))
    items = db["items"]

    print(f"Total de itens no banco: {len(items)}\n")
    issues = 0

    # 1. IDs duplicados
    ids = [it["id"] for it in items]
    dup_ids = [i for i, c in collections.Counter(ids).items() if c > 1]
    print(f"[1] IDs duplicados: {len(dup_ids)}")
    for d in dup_ids:
        print(f"    {d}")
        issues += 1

    # 2. canonical_name duplicados (normalizado)
    can_seen: dict[str, str] = {}
    dup_cans = []
    for it in items:
        n = norm(it.get("canonical_name", ""))
        if n in can_seen:
            dup_cans.append((n, can_seen[n], it["id"]))
        else:
            can_seen[n] = it["id"]
    print(f"\n[2] canonical_name duplicados (normalizado): {len(dup_cans)}")
    for n, a, b in dup_cans:
        print(f'    [{a}] e [{b}]  =>  "{n}"')
        issues += 1

    # 3. Variações duplicadas dentro do mesmo item
    dup_intra = 0
    for it in items:
        vars_ = it.get("variations", [])
        seen: dict[str, str] = {}
        for v in vars_:
            n = norm(v)
            if n in seen:
                print(f'[3] [{it["id"]}]: variacao "{v}" duplica "{seen[n]}"')
                dup_intra += 1
                issues += 1
            else:
                seen[n] = v
    if dup_intra == 0:
        print("\n[3] Variações duplicadas no mesmo item: Nenhuma")

    # 4. Variação que coincide com canonical de outro item
    cmap = {norm(it.get("canonical_name", "")): it["id"] for it in items}
    dup_cross = 0
    for it in items:
        for v in it.get("variations", []):
            n = norm(v)
            if n in cmap and cmap[n] != it["id"]:
                print(f'\n[4] [{it["id"]}]: variacao "{v}" == canonical de [{cmap[n]}]')
                dup_cross += 1
                issues += 1
    if dup_cross == 0:
        print("\n[4] Variações que cruzam canonical de outro item: Nenhuma")

    # 5. Variações iguais entre items diferentes
    var_map: dict[str, list[str]] = {}
    for it in items:
        for v in it.get("variations", []):
            var_map.setdefault(norm(v), []).append(it["id"])
    dup_shared = [(n, ids_) for n, ids_ in var_map.items() if len(ids_) > 1]
    print(f"\n[5] Variações iguais em items diferentes: {len(dup_shared)}")
    for n, ids_ in dup_shared:
        print(f'    "{n}"  em: {ids_}')
        issues += 1

    # 6. Variação que é substring do canonical do próprio item (redundante)
    dup_redund = 0
    for it in items:
        cn = norm(it.get("canonical_name", ""))
        for v in it.get("variations", []):
            vn = norm(v)
            if vn == cn:
                print(f'\n[6] [{it["id"]}]: variacao "{v}" == proprio canonical (redundante)')
                dup_redund += 1
                issues += 1
    if dup_redund == 0:
        print("\n[6] Variações idênticas ao próprio canonical: Nenhuma")

    print(f"\n{'='*50}")
    print(f"Total de problemas encontrados: {issues}")
    if issues == 0:
        print("Banco limpo — sem duplicatas detectadas.")


if __name__ == "__main__":
    scan()
