# -*- coding: utf-8 -*-
"""
tipos.py — tipos de domínio (TypedDict) do pipeline de extração/orçamento.

São apenas auxiliares de tipagem: em runtime continuam sendo `dict` comuns.
Documentam o contrato dos dicionários que circulam entre os módulos.
"""

from __future__ import annotations

from typing import TypedDict, NotRequired


class Item(TypedDict):
    """Linha bruta extraída de uma tabela CEA-QNT (antes do mapeamento)."""
    descricao: str
    quantidade: float
    unidade: NotRequired[str]
    tabela: NotRequired[str]
    prancha_id: NotRequired[str]
    revisao_num: NotRequired[int]
    grand_total_tabela: NotRequired[float | None]
    zona: NotRequired[str]


class MappedRow(TypedDict):
    """Linha após mapeamento descrição → código XLSX."""
    cod: str
    descricao: str
    quantidade: float
    unidade: str
    confianca: float
    fonte_pranchas: list[str]
    tabela: str
    status: NotRequired[str]


class DedupLogEntry(TypedDict):
    """Registro de uma operação de deduplicação (auditoria)."""
    tabela: str
    kept: str
    dropped: list[str]
    gt: NotRequired[float | None]
    motivo: str
