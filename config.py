# -*- coding: utf-8 -*-
"""
config.py — constantes globais, mapeamentos de categoria e helpers de normalização.
"""

import os
import re
from pathlib import Path

# ─── Carrega .env.local se ANTHROPIC_API_KEY não estiver no ambiente ──────────

def _load_dotenv_local() -> None:
    """Lê .env.local do diretório do script como fallback para variáveis ausentes."""
    env_path = Path(__file__).parent / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if key and key not in os.environ:
            os.environ[key] = val

_load_dotenv_local()

# ─── Runtime config ───────────────────────────────────────────────────────────

# Usado apenas para salvar arquivos de debug (raw responses, resultados JSON).
# Se não definido, usa a pasta do próprio projeto.
BASE_DIR = os.getenv("PROJECT_BASE_DIR", str(Path(__file__).parent))
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"

PDF_SUBDIR = "PDF"
DXF_SUBDIR = "DXF"

# ─── Validação ────────────────────────────────────────────────────────────────

VALID_CATS = {
    "civil", "eletrica", "hidraulica", "marcenaria", "vidros",
    "revestimento", "pintura", "fachada", "climatizacao", "outro",
}
VALID_UNITS = {"m2", "ml", "un", "m3", "vb", "kg", "hr"}

# ─── Categoria keyword map ────────────────────────────────────────────────────

CATEGORIA_MAP: dict[str, str] = {
    "pintura": "pintura",
    "cerâmica": "revestimento", "ceramica": "revestimento",
    "porcelanato": "revestimento", "revestimento": "revestimento",
    "piso vinílico": "revestimento", "piso vini": "revestimento",
    "soleira": "revestimento", "rodapé": "revestimento", "rodape": "revestimento",
    "podotátil": "revestimento", "piso ceramico": "revestimento",
    "acm ": "revestimento", "alucobond": "revestimento",
    "impermeabilização": "civil", "impermeabilizacao": "civil",
    "drywall": "civil", "gesso": "civil", "alvenaria": "civil",
    "forro": "civil", "divisória": "civil", "divisoria": "civil",
    "guarda-corpo": "civil", "corrimão": "civil", "corrimao": "civil",
    "montante": "civil", "fechamento cortina": "marcenaria",
    "cortina de enrolar": "marcenaria", "tablado": "marcenaria",
    "painel em mdf": "marcenaria", "painel em mdp": "marcenaria",
    "painel em madeirite": "marcenaria", "painel em osb": "marcenaria",
    "painel revestido": "marcenaria", "porta": "marcenaria",
    "elétrica": "eletrica", "eletrica": "eletrica", "luminária": "eletrica",
    "antena": "eletrica", "rfid": "eletrica",
    "hidráulica": "hidraulica", "hidraulica": "hidraulica", "esgoto": "hidraulica",
    "cuba": "hidraulica", "torneira": "hidraulica",
    "marcenaria": "marcenaria", "armário": "marcenaria", "bancada": "marcenaria",
    "vidro": "vidros", "espelho": "vidros", "vidros": "vidros",
    "climatização": "climatizacao", "ar condicionado": "climatizacao",
}

# ─── Material keyword filter (shared by pdf_extractor and result_builder) ─────

_MATERIAL_KEYWORDS = re.compile(
    r"drywall|gesso|alvenar|ceram|porcelanat|piso|pint|imperm|divisor|"
    r"painel|forro|porta|vidro|espelho|granito|marmore|rodap|manta|"
    r"madeira|mdp|mdf|osb|acm|acril|latex|epoxi|revestim|soleira|"
    r"parede|bloco|concreto|tabua|formica|laminad|fachada|vitrine|"
    r"hidrante|corrimao|guardacorpo|cortin|fechamento|tablado|ripado",
    re.IGNORECASE,
)

# ─── Helpers ──────────────────────────────────────────────────────────────────


def normalize_key(desc: str) -> str:
    """Chave de deduplicação: primeiros 40 chars normalizados (remove ' / ')."""
    s = re.sub(r"\s*/\s*", " ", desc)
    return re.sub(r"\s+", " ", s.strip().upper())[:40]


def guess_categoria(descricao: str) -> str:
    d = descricao.lower()
    for kw, cat in CATEGORIA_MAP.items():
        if kw in d:
            return cat
    return "outro"
