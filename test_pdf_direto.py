# -*- coding: utf-8 -*-
"""
test_pdf_direto.py — Teste de envio de PDF nativo ao Claude.

Envia o arquivo PDF diretamente como documento (sem extração de texto prévia)
e pede ao Claude que extraia todos os dados para orçamento de fit-out.

Uso:
    python test_pdf_direto.py
    python test_pdf_direto.py "C:/outro/caminho.pdf"

Saída:
    test_pdf_direto_raw.txt      — resposta bruta da IA
    test_pdf_direto_result.json  — JSON parseado com os itens extraídos
"""

import sys
import base64
import json
from pathlib import Path

# Garante que o diretório do projeto está no path para importar config e ai_client
sys.path.insert(0, str(Path(__file__).parent))

from config import ANTHROPIC_KEY, MODEL
from extractors.ai_client import parse_ai_json

# ─── Arquivo de entrada ───────────────────────────────────────────────────────

DEFAULT_PDF = (
    r"C:\Users\AVELL\Downloads\Cauline Roots\Celmar"
    r"\Projetos inicial\Projetos inicial\PDF"
    r"\CEA-254-BLN-ARQ_R03-331-ARQ PISO.pdf"
)

PDF_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(DEFAULT_PDF)

# ─── Prompt ───────────────────────────────────────────────────────────────────

PROMPT = """Você é um engenheiro orçamentista experiente especializado em fit-out de lojas de varejo (C&A, Renner, Riachuelo e similares).

Analise este documento PDF de projeto executivo e extraia TODOS os dados que conseguir identificar para geração de orçamento de obra.

EXTRAIA:
1. Todos os itens de serviço e material visíveis (civil, revestimento, pintura, marcenaria, vidros, elétrica, hidráulica, climatização)
2. Quantidades quando estiverem explícitas nas tabelas, cotas ou legendas do projeto
3. Unidades corretas (m², ml, un, vb)
4. Ambiente / setor de cada item (salão de vendas, provadores, copa, sanitários, etc.)
5. Especificações de material quando mencionadas (ex: "PISO VINÍLICO TARKET", "DRYWALL RF", "AZULEJO ELIANE 20×20")

REGRAS:
- Se a quantidade estiver explícita no documento: status = "confirmado", confiança = 90-98
- Se a quantidade for estimável pelas cotas ou escala: status = "parcial", confiança = 50-80
- Se o item existe mas a quantidade não está disponível: status = "aguardando", quantidade = 0, confiança = 30
- Se encontrar tabelas CEA-QNT ou Quadro de Acabamentos: extraia TODOS os itens dessas tabelas
- Não invente quantidades — prefira "aguardando" a um número sem base

CATEGORIAS válidas: civil | revestimento | pintura | marcenaria | vidros | eletrica | hidraulica | climatizacao | fachada | outro
UNIDADES válidas: m2 | ml | un | m3 | vb | kg | hr

Responda SOMENTE com JSON válido, sem texto antes ou depois:

{
  "projeto": "nome do projeto identificado no documento",
  "cliente": "nome da rede varejista",
  "prancha": "código da prancha (ex: CEA-254-BLN-ARQ-331)",
  "itens": [
    {
      "id": 1,
      "ambiente": "Salão de Vendas",
      "descricao": "PISO VINÍLICO TARKET COR BEGE",
      "categoria": "revestimento",
      "unidade": "m2",
      "quantidade": 371.0,
      "confianca": 95,
      "fonte": "PDF_DIRETO",
      "status": "confirmado",
      "pendencias": []
    }
  ],
  "divergencias": [],
  "erros_limitacoes": []
}"""


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    if not ANTHROPIC_KEY:
        print("[ERRO] ANTHROPIC_API_KEY não configurada. Verifique .env.local")
        sys.exit(1)

    if not PDF_PATH.exists():
        print(f"[ERRO] Arquivo não encontrado: {PDF_PATH}")
        sys.exit(1)

    pdf_bytes = PDF_PATH.read_bytes()
    tamanho_mb = len(pdf_bytes) / 1_048_576
    print(f"[PDF direto] Lendo: {PDF_PATH.name} ({tamanho_mb:.1f} MB)")

    pdf_b64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    print(f"[Claude] Modelo: {MODEL}")
    print("[Claude] Enviando PDF como documento nativo (beta: pdfs-2024-09-25)…")

    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_b64,
                        },
                    },
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
        betas=["pdfs-2024-09-25"],
    )

    raw_text  = response.content[0].text
    tokens_in  = response.usage.input_tokens
    tokens_out = response.usage.output_tokens
    custo      = tokens_in * 3 / 1_000_000 + tokens_out * 15 / 1_000_000

    print(f"[Claude] Tokens: in={tokens_in:,} out={tokens_out:,} | Custo: ${custo:.4f} USD")

    # ── Salva resposta bruta ──────────────────────────────────────────────────
    raw_path = Path(__file__).parent / "test_pdf_direto_raw.txt"
    raw_path.write_text(raw_text, encoding="utf-8")
    print(f"[Salvo] {raw_path.name}")

    # ── Parse JSON ────────────────────────────────────────────────────────────
    try:
        parsed = parse_ai_json(raw_text)
        itens       = parsed.get("itens", [])
        divergencias = parsed.get("divergencias", [])
        erros        = parsed.get("erros_limitacoes", [])

        confirmados = [it for it in itens if it.get("status") == "confirmado"]
        parciais    = [it for it in itens if it.get("status") == "parcial"]
        aguardando  = [it for it in itens if it.get("status") == "aguardando"]

        print(f"[Resultado] {len(itens)} itens extraídos "
              f"({len(confirmados)} confirmados | {len(parciais)} parciais | {len(aguardando)} aguardando) "
              f"| {len(divergencias)} divergências | {len(erros)} limitações")

        # Resumo rápido por categoria
        cats: dict[str, int] = {}
        for it in itens:
            cat = it.get("categoria", "outro")
            cats[cat] = cats.get(cat, 0) + 1
        if cats:
            cat_str = " | ".join(f"{k}: {v}" for k, v in sorted(cats.items(), key=lambda x: -x[1]))
            print(f"[Categorias] {cat_str}")

        result_path = Path(__file__).parent / "test_pdf_direto_result.json"
        result_path.write_text(
            json.dumps({
                "metadata": {
                    "arquivo":     PDF_PATH.name,
                    "modelo":      MODEL,
                    "tokens_in":   tokens_in,
                    "tokens_out":  tokens_out,
                    "custo_usd":   round(custo, 5),
                    "n_itens":     len(itens),
                    "n_confirmados": len(confirmados),
                    "n_parciais":    len(parciais),
                    "n_aguardando":  len(aguardando),
                },
                **parsed,
            }, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"[Salvo] {result_path.name}")

    except ValueError as e:
        print(f"[AVISO] Falha ao parsear JSON: {e}")
        print("[AVISO] Resposta bruta salva em test_pdf_direto_raw.txt para inspeção manual")


if __name__ == "__main__":
    main()
