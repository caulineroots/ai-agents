# -*- coding: utf-8 -*-
"""
schemas.py — modelos Pydantic compartilhados pelo serviço de extração.
"""

from typing import Optional
from pydantic import BaseModel


class Divergencia(BaseModel):
    campo: str
    valor_pdf: Optional[str] = None
    valor_dxf: Optional[str] = None
    valor_ia: Optional[str] = None
    recomendacao: str


class ItemExtraido(BaseModel):
    id: int
    ambiente: str
    descricao: str
    categoria: str
    unidade: str
    quantidade: float
    confianca: int
    fonte: str
    status: str
    pendencias: list[str]


class Metadata(BaseModel):
    processado_em: str
    modelo_ia: str
    tokens_input: int
    tokens_output: int
    custo_usd: float
    ia_usada: bool
    pdf_encontrado: bool
    dxf_encontrado: bool


class ExtractionResult(BaseModel):
    prancha: str
    classificacao: str
    fontes_usadas: list[str]
    projeto: str
    cliente: str
    itens: list[ItemExtraido]
    divergencias: list[Divergencia]
    erros_ia: list[str]
    metadata: Metadata
