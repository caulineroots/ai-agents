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


class LineItem(BaseModel):
    """Item de linha da planilha orçamentária inicial (subset da Fase 0).

    Backbone do pipeline scope-driven: cada item vem da planilha do cliente e é
    enriquecido nas fases seguintes (medida, verificação, preço). Aqui guardamos
    apenas o que o parser extrai do .xlsx — ver docs/arquitetura/01-modelo-de-dados.md.
    """
    item: str                       # numeração hierárquica, ex. "8.5"
    cc: str = ""                    # centro de custo, ex. "810021" (pode herdar vazio)
    descricao: str
    unidade_raw: str = ""           # unidade como escrita ("unid", "vb.", "m", "m²"…)
    qde_inicial: Optional[float] = None  # presente em ~112/233; None quando ausente
    row_ref: int                    # linha 1-based no .xlsx — para write-back preservando formato


class PlanilhaParseResult(BaseModel):
    """Resultado do parsing da planilha inicial."""
    ok: bool
    sheet: str = ""                 # aba onde o cabeçalho foi detectado
    header_row: int = 0             # linha (1-based) do cabeçalho de detalhe
    col_map: dict[str, int] = {}    # papel -> índice de coluna (0-based) detectado
    n_itens: int = 0
    n_com_medida: int = 0           # itens com qde_inicial > 0 (verificar)
    n_sem_medida: int = 0           # itens sem qde (descobrir nos desenhos)
    n_linhas_vazias: int = 0        # linhas-folha numeradas sem descrição (reservas "OMISSOS"), ignoradas
    itens: list[LineItem] = []
    erros: list[str] = []


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
