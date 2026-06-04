"""
Limpa duplicatas no nomenclaturas_db.json:
  1. Remove variações com mesmo normalized form que o canonical do próprio item
  2. Remove variações duplicadas dentro do mesmo item (mantém a versão acentuada/melhor)
Salva o banco limpo e exibe resumo.
"""
import json
import re
import unicodedata
from pathlib import Path

DB_PATH = Path(__file__).parent / "nomenclaturas_db.json"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s).lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip()


def best_form(a: str, b: str) -> str:
    """Entre dois strings normalmente iguais, prefere o que tem mais caracteres especiais (acentuado)."""
    # Mais acentos = mais caracteres "unicodizados" → maior len no original
    score = lambda s: sum(1 for c in s if unicodedata.category(c).startswith("L") and ord(c) > 127)
    return a if score(a) >= score(b) else b


def clean():
    db = json.loads(DB_PATH.read_text(encoding="utf-8"))
    items = db["items"]

    total_removed = 0
    total_deduped = 0

    for it in items:
        canonical_norm = norm(it.get("canonical_name", ""))
        raw_vars = it.get("variations", [])

        # Deduplica por normalized form, preferindo a versão acentuada
        seen: dict[str, str] = {}
        for v in raw_vars:
            n = norm(v)
            if n in seen:
                seen[n] = best_form(seen[n], v)
                total_deduped += 1
            else:
                seen[n] = v

        # Remove variações idênticas ao canonical (normalized)
        before = len(seen)
        seen = {n: v for n, v in seen.items() if n != canonical_norm}
        removed = before - len(seen)
        total_removed += removed

        it["variations"] = list(seen.values())

    db["items"] = items
    DB_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Limpeza concluída:")
    print(f"  Duplicatas mescladas (com/sem acento): {total_deduped}")
    print(f"  Variações == canonical removidas:      {total_removed}")
    print(f"  Banco salvo em {DB_PATH}")


if __name__ == "__main__":
    clean()
