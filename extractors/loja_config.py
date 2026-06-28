# -*- coding: utf-8 -*-
"""
loja_config.py — configuração por loja (números de prancha, prioridades, códigos).

Isola as regras específicas de cada projeto C&A (BLN, BLK, ...) da lógica de
dedup/mapeamento, que passa a ser genérica. Para suportar uma nova loja, basta
adicionar uma entrada em LOJA_CONFIG.
"""

from __future__ import annotations

# ─── BLN — Shopping Norte Blumenau ───────────────────────────────────────────
_BLN = {
    # Pranchas cuja pintura/forro mapeia para códigos de área administrativa.
    "adm_pranchas": frozenset({"304", "305", "312", "308", "309"}),

    # Prioridade de prancha quando a revisão empata (qual tabela master vence).
    "prancha_priority": {
        "MASTER_CIVIL": {
            "301": 100, "303": 50, "305": 40, "307": 45, "309": 35, "304": 30,
        },
        "MASTER_FORRO": {
            "321": 100, "304": 40, "309": 35, "301": 50,
        },
        "MASTER_PISO": {
            "331": 100, "313": 40, "312": 35, "131": 30,
        },
        "PORTAS": {
            "301": 100, "306": 40,
        },
    },

    # Ao agregar por código, preferir quantidades da prancha autoritativa.
    "cod_priority_prancha": {
        "18.3": "301", "18.4": "301", "18.10": "301",
        "18.5": "305", "18.8": "305", "18.11": "305",
        "12.1": "301", "12.2": "301", "12.3": "301", "12.4": "301",
        "12.5": "301", "12.6": "301", "13.1": "301", "15.1": "301",
        "12.9": "321", "12.11": "301",
        "14.1": "331", "14.8": "331", "14.19": "331", "14.11": "331",
        "13.2": "301", "13.3": "301", "20.2": "301", "20.3": "301", "21.15": "301",
    },

    # Fallback quando a prancha primária não tem linhas (ADM).
    "cod_fallback_prancha": {
        "18.5": "309", "18.8": "309", "18.11": "309",
    },

    # Soleiras: fonte única na 331, QDE é takeoff manual.
    "soleira_cods": frozenset({"14.19", "14.8"}),

    # Códigos cuja quantidade é o MÁX das linhas (mesmo sistema medido em
    # fragmentos), não a soma. Inclui soleiras + divisória divilux 13.1.
    "use_max_cods": frozenset({"14.19", "14.8", "13.1"}),

    # Tabelas cuja quantidade é dividida por zona (vendas vs ADM).
    "zone_sensitive_keys": frozenset({"PINTURA"}),
}

# BLK reaproveita a estrutura BLN por ora; ajuste quando o gabarito BLK exigir.
_BLK = dict(_BLN)

LOJA_CONFIG: dict[str, dict] = {
    "BLN": _BLN,
    "BLK": _BLK,
}

_DEFAULT_LOJA = "BLN"


def _detect_loja(obra: str | None) -> str:
    o = (obra or "").upper()
    if "BLK" in o:
        return "BLK"
    return _DEFAULT_LOJA


def get_loja_config(obra: str | None = None) -> dict:
    """Retorna a config da loja inferida de `obra` (default BLN)."""
    return LOJA_CONFIG.get(_detect_loja(obra), _BLN)


# ─── Aliases de compatibilidade (default BLN) ────────────────────────────────
ADM_PRANCHAS_BLN     = _BLN["adm_pranchas"]
PRANCHA_PRIORITY     = _BLN["prancha_priority"]
COD_PRIORITY_PRANCHA = _BLN["cod_priority_prancha"]
COD_FALLBACK_PRANCHA = _BLN["cod_fallback_prancha"]
SOLEIRA_CODS         = _BLN["soleira_cods"]
USE_MAX_CODS         = _BLN["use_max_cods"]
ZONE_SENSITIVE_KEYS  = _BLN["zone_sensitive_keys"]
