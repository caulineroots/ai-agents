"""
Teste direto da pipeline marmoraria (chamada controlada 2-call)
com as 3 páginas da Luísa Marques + camada de texto do PDF.
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import anthropic
import base64
import json
import os
import pdfplumber
import re

API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"

BASE = r"C:\Users\AVELL\Downloads\Cauline Roots\gabriel constante"

JPG_FILES = [
    r"db_Caderno_Executivo_Luísa_Marques\dB_Caderno_Executivo_Luísa_Marques (3)-09.jpg",
    r"db_Caderno_Executivo_Luísa_Marques\dB_Caderno_Executivo_Luísa_Marques (3)-10.jpg",
    r"db_Caderno_Executivo_Luísa_Marques\dB_Caderno_Executivo_Luísa_Marques (3)-11.jpg",
]
PDF_PAGES = [9, 10, 11]  # 1-indexed

# ── Prompts (cópia idêntica do route.ts) ────────────────────────────────────

PROMPT_1 = """Você é um orçamentista sênior de marmoraria analisando pranchas de projeto arquitetônico.
Analise todas as imagens em conjunto (estão em ordem).

═══════════════════════════════════════════════════════
REGRAS DE DOMÍNIO — aplique em TODOS os projetos
═══════════════════════════════════════════════════════

R1 — BANCADA COM PÉ
Se a perspectiva ou vista frontal mostra face vertical de pedra ALÉM do tampo horizontal (painel lateral de encerramento, fechamento frontal em pedra), crie 1 único item "face vertical / pé" por módulo.
Altura da face vertical: use a cota visível na vista frontal/lateral. Se não houver cota: use 0,10 m (padrão).
NUNCA use a altura total do armário (80–90 cm) como largura da face — a pedra cobre apenas a faixa exposta.
Crie apenas 1 item de face vertical por módulo, independente de o tampo ser em L.

R2 — RODAPIA — COZINHA E LAVANDERIA
Por módulo, crie 1 único item de rodapia com o comprimento total frontal do módulo × 0,05 m.
NÃO crie rodapia por ala: se o tampo é em L (ala principal + ala retorno), a rodapia usa apenas o comprimento frontal visível — não some as alas.
Comprimento frontal da rodapia = comprimento do trecho que fica de frente (ala principal), não o perímetro total.
Exceção: se o projeto indicar explicitamente ausência de rodapia.

R3 — COMPRIMENTO DA PEDRA ≠ LARGURA DO MÓDULO
Use sempre a cota da vista GRANITO ou SUPERIOR para o comprimento do granito.
Não use a largura total do módulo (pode incluir geladeira, vãos, nichos em MDF).
Se divergirem: registre os dois e use o comprimento da pedra.

R4 — TAMPO EM L: 2 itens de tampo, mas 1 rodapé e 1 rodapia
Tampos em L = 2 peças de tampo (ex: ala principal 2,10 m + ala retorno 0,81 m). Liste cada tampo separado.
Porém, rodapé de base e rodapia = 1 item cada por módulo, usando o comprimento frontal principal (não a soma das alas).

R5 — MÓDULO CAFÉ / BAR / NICHO
O tampo é apenas o trecho com pedra visível na vista superior — não a largura total do módulo.
O rodapé desses módulos só existe se houver callout explícito de pedra. Sem callout → sem rodapé (plinto é MDF).

R6 — BANHEIRO
Tampo: espessura 2 cm (Slim), profundidade padrão 0,57 m, sem rodapé em pedra (o banheiro usa plinto de MDF).
Sem Rebaixo Italiano a menos que o detalhe de granito mostre explicitamente "Rebaixo Italiano".
Serviços padrão banheiro: Acabamento Slim + Furo cuba embutir + Furo torneira + Instalacao tampo sobre base.

R7 — LAVANDERIA
Tampo: profundidade padrão 0,60 m, RI quando indicado (RI lavanderia ≠ RI cozinha — preço diferente).
Cada módulo da lavanderia = seu próprio tampo + rodapé. MOB. TANQUE e MOB. MULTIUSO frequentemente têm rodapé.

R8 — FALLBACK OBRIGATÓRIO (nunca marque como ❓ um item que existe)
"❓ Pendente" = apenas quando a EXISTÊNCIA da peça é incerta.
"⚠️ Estimado" = peça EXISTE com certeza, mas alguma dimensão não está legível → use fallback:
  • Cozinha/Lavanderia profundidade: 0,60 m
  • Banheiro profundidade: 0,57 m
  • Altura rodapé: 0,10 m  |  Altura rodapia: 0,05 m
Nunca área = 0 para item cuja existência está confirmada. Isso causa subestimação de R$ 1.000+.

R9 — BORDA MEIA-ESQUADRIA (borda_ml)
Granito 3 cm (Tabaco, Branco): borda reta meia-esquadria no perímetro exposto do tampo.
Granito 2 cm (Siena, Slim): acabamento slim no perímetro exposto.
Estime os metros lineares das faces livres (frente + laterais não encostadas em parede). Anote como borda_ml.

═══════════════════════════════════════════════════════
ETAPA 1 — CONTEXTO
═══════════════════════════════════════════════════════
Descreva: ambientes com pedra, material(is) e espessura(s) identificados na legenda, observações gerais.

═══════════════════════════════════════════════════════
ETAPA 2 — INVENTÁRIO COMPLETO DE PEÇAS
═══════════════════════════════════════════════════════
Para cada módulo com pedra, liste TODOS os subcomponentes usando R1–R9 acima.
Por módulo considere obrigatoriamente:
• Tampo (horizontal) — pode ser 2 peças se for L (R4)
• Face vertical / pé — se visível na perspectiva ou frontal (R1)
• Rodapia 5 cm — cozinha/lavanderia (R2)
• Rodapé de base — faixa escura na base do módulo (distinto da rodapia)
• Respaldo / painel de parede — se indicado no projeto
• Prateleira / nicho — se em pedra

═══════════════════════════════════════════════════════
ETAPA 3 — DIMENSÕES
═══════════════════════════════════════════════════════
Para cada subcomponente: cota da vista GRANITO/SUPERIOR para tampos; vista FRONTAL para rodapés/saias.
Se a cota não estiver legível: aplique fallback de R8 e marque "(padrão)".

IMPORTANTE — CAMADA DE TEXTO PDF: antes de cada prancha há um bloco [CAMADA DE TEXTO PDF] com os valores
extraídos automaticamente do arquivo. Esses números são EXATOS (origem digital) — use-os como verdade
para comprimentos e larguras sempre que disponíveis. Confirme visualmente na imagem para associar cada
número ao item correto (qual peça corresponde a qual cota).

Formato — tabela markdown:
| Ambiente | Módulo | Subcomponente | Comp (m) | Larg/Alt (m) | Borda (ml) | Status | Obs |
(Status: ✅ Confirmado | ⚠️ Estimado | ❓ Pendente)"""


def build_review_prompt(output1: str) -> str:
    return f"""Você é um revisor sênior de orçamentos de marmoraria. Recebeu a análise abaixo e deve fazer uma revisão crítica com as mesmas pranchas à vista.

───────────────────
{output1}
───────────────────

## PARTE 1 — CHECKLIST R1–R9

Percorra cada regra e anote APENAS as correções necessárias (itens sem problema não precisam aparecer):

R1 — BANCADA COM PÉ: face vertical de pedra além do tampo? Máx 1 item por módulo. Altura = cota visível ou 0,10 m. Se listada com altura > 0,20 m sem cota: corrigir para 0,10 m.
R2 — RODAPIA: 1 único item por módulo (comprimento frontal, não soma de alas).
R3 — COMPRIMENTO: usar sempre cota da vista GRANITO, não largura total do módulo.
R4 — TAMPO EM L: 2 tampos, mas 1 rodapé e 1 rodapia por módulo.
R5 — CAFÉ/BAR: rodapé sem callout explícito → remover. Tampo = apenas trecho com pedra.
R6 — BANHEIRO: remover RI sem confirmação explícita no detalhe; remover rodapé em pedra.
R7 — LAVANDERIA: tampo + rodapé separados por módulo. RI lavanderia ≠ RI cozinha.
R8 — FALLBACK: peça visivelmente existente → nunca ❓. Usar ⚠️ + fallback (prof. 0,60/0,57, rodapé 0,10, rodapia 0,05).
R9 — BORDA: borda_ml em todos os tampos (3 cm → meia-esquadria; 2 cm → slim).

## PARTE 2 — JSON FINAL

Após o checklist, produza APENAS o bloco JSON abaixo — sem texto extra antes ou depois do JSON.
NÃO calcule area_m2. Informe comprimento_m e largura_m. O sistema multiplica por código.

```json
{{
  "projeto": "nome do projeto ou 'Projeto sem nome'",
  "itens": [
    {{
      "id": 1,
      "prancha_idx": null,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.10,
      "largura_m": 0.60,
      "borda_ml": 2.1,
      "servicos": [
        {{"nome":"Rebaixo Italiano cozinha","qtd":1,"unidade":"un"}},
        {{"nome":"Borda Reta Meia Esquadria","qtd":2.1,"unidade":"ml"}},
        {{"nome":"Instalacao tampo sobre base","qtd":2.1,"unidade":"ml"}}
      ],
      "pendencias": []
    }}
  ]
}}
```

MAPEAMENTO:
status: ✅ → "confirmado" | ⚠️ → "parcial" | ❓ → "aguardando" (só existência incerta)
tipo: tampo | rodape | saia | revestimento | prateleira | outro
espessura_cm: 3 para Granito Tabaco/3cm | 2 para Siena/Slim/2cm
comprimento_m: coluna "Comp" da tabela
largura_m: coluna "Larg/Alt" — fallback: tampo coz/lav → 0.60 | banheiro → 0.57 | rodapé → 0.10 | rodapia → 0.05
borda_ml: coluna "Borda (ml)" — se ausente: usar comprimento_m

Serviços — nomes EXATOS:
  RI coz  → {{"nome":"Rebaixo Italiano cozinha","qtd":1,"unidade":"un"}}
  RI lav  → {{"nome":"Rebaixo Italiano lavanderia","qtd":1,"unidade":"un"}}
  Cooktop → {{"nome":"Recorte cooktop","qtd":1,"unidade":"un"}}
  Cuba    → {{"nome":"Furo cuba embutir","qtd":1,"unidade":"un"}}
  Torneira→ {{"nome":"Furo torneira","qtd":1,"unidade":"un"}}
  Dispenser→{{"nome":"Furo dispenser","qtd":1,"unidade":"un"}}
  Torre   → {{"nome":"Furo para torre de tomada","qtd":1,"unidade":"un"}}
  3cm borda→{{"nome":"Borda Reta Meia Esquadria","qtd":BORDA_ML,"unidade":"ml"}}
  2cm borda→{{"nome":"Acabamento Slim","qtd":BORDA_ML,"unidade":"ml"}}
  Tampo   → {{"nome":"Instalacao tampo sobre base","qtd":COMPRIMENTO_M,"unidade":"ml"}}
  Rodapé  → {{"nome":"Instalacao rodape","qtd":COMPRIMENTO_M,"unidade":"ml"}}"""


# ── Extrair texto das páginas do PDF ────────────────────────────────────────

def extract_page_texts(pdf_path: str, pages: list[int]) -> list[str]:
    texts = []
    with pdfplumber.open(pdf_path) as pdf:
        for p in pages:
            page = pdf.pages[p - 1]
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            text = " | ".join(w["text"] for w in words if w["text"].strip())
            texts.append(text)
    return texts


# ── Montar blocos de mensagem ────────────────────────────────────────────────

def build_blocks(jpg_paths: list[str], page_texts: list[str]) -> list[dict]:
    blocks = []
    for idx, (jpg, text) in enumerate(zip(jpg_paths, page_texts)):
        blocks.append({"type": "text", "text": f"--- Prancha {idx + 1} de {len(jpg_paths)} ---"})
        if text.strip():
            blocks.append({
                "type": "text",
                "text": f"[CAMADA DE TEXTO PDF — Prancha {idx + 1}]\n{text}"
            })
        with open(jpg, "rb") as f:
            data = base64.standard_b64encode(f.read()).decode("utf-8")
        blocks.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": data}
        })
    return blocks


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    client = anthropic.Anthropic(api_key=API_KEY)

    # Resolve paths
    pdf_files = [f for f in os.listdir(BASE) if f.startswith("dB_Caderno") and f.endswith(".pdf")]
    assert pdf_files, "PDF não encontrado"
    pdf_path = os.path.join(BASE, pdf_files[0])
    jpg_paths = [os.path.join(BASE, f) for f in JPG_FILES]

    print(f"PDF: {os.path.basename(pdf_path)}")
    print(f"Imagens: {[os.path.basename(j) for j in jpg_paths]}")

    # Extract text layer
    print("\n[1/4] Extraindo texto das páginas 15, 16, 17...")
    page_texts = extract_page_texts(pdf_path, PDF_PAGES)
    for i, t in enumerate(page_texts):
        words = t.split(" | ")
        print(f"  Prancha {i+1}: {len(words)} tokens — ex: {words[:8]}")

    # Build content blocks
    image_blocks = build_blocks(jpg_paths, page_texts)

    # Chamada 1
    print("\n[2/4] Chamada 1 — Análise inicial...")
    res1 = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        messages=[{"role": "user", "content": [*image_blocks, {"type": "text", "text": PROMPT_1}]}],
    )
    output1 = "\n".join(b.text for b in res1.content if b.type == "text")
    print(f"  Tokens in={res1.usage.input_tokens} out={res1.usage.output_tokens}")
    print("\n─── OUTPUT 1 ─────────────────────────────────────────────────────────\n")
    print(output1)

    # Chamada 2
    print("\n[3/4] Chamada 2 — Revisão + JSON...")
    res2 = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        messages=[
            {"role": "user", "content": [*image_blocks, {"type": "text", "text": PROMPT_1}]},
            {"role": "assistant", "content": output1},
            {"role": "user", "content": build_review_prompt(output1)},
        ],
    )
    output2 = "\n".join(b.text for b in res2.content if b.type == "text")
    print(f"  Tokens in={res2.usage.input_tokens} out={res2.usage.output_tokens}")
    print("\n─── OUTPUT 2 ─────────────────────────────────────────────────────────\n")
    print(output2)

    # Parse JSON
    print("\n[4/4] Parseando JSON...")
    json_match = re.findall(r"```(?:json)?\s*([\s\S]*?)```", output2)
    if json_match:
        json_raw = json_match[-1].strip()
        try:
            data = json.loads(json_raw)
            itens = data.get("itens", [])
            print(f"\n  Projeto: {data.get('projeto')}")
            print(f"  Itens:   {len(itens)}")
            for item in itens:
                c = item.get("comprimento_m", 0)
                l = item.get("largura_m", 0)
                area = round(c * l, 4)
                print(f"    [{item['status']:12s}] {item['ambiente']:<12} | {item['modulo']:<20} | {item['tipo']:<14} "
                      f"| {c:.2f}m × {l:.2f}m = {area:.4f}m²")
        except json.JSONDecodeError as e:
            print(f"  ERRO JSON: {e}")
            print(json_raw[:500])
    else:
        print("  Nenhum bloco JSON encontrado no output2.")

    # Custo total
    total_in  = res1.usage.input_tokens  + res2.usage.input_tokens
    total_out = res1.usage.output_tokens + res2.usage.output_tokens
    custo = total_in * 3/1_000_000 + total_out * 15/1_000_000
    print(f"\n  Total tokens: in={total_in} out={total_out}  custo≈${custo:.4f}")

    # Salvar
    out_path = r"C:\Users\AVELL\Documents\Projects\AI-Agents\test_marmoraria_luisa_p9-11_output.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("=== OUTPUT 1 ===\n\n")
        f.write(output1)
        f.write("\n\n=== OUTPUT 2 ===\n\n")
        f.write(output2)
    print(f"\n  Salvo em: {out_path}")


if __name__ == "__main__":
    main()
