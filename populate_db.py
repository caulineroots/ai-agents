"""
Popula nomenclaturas_db.json com todos os itens legítimos extraídos
dos gabaritos Excel da Celmar.

Estratégia:
  - VARIATIONS: adiciona o texto como variação de um item já existente
  - NEW: cria um novo item canônico no banco
  - SKIP: ruído confirmado, ignora

Roda determinístico, sem IA, sem aprovação manual.
"""
import json
import re
import unicodedata
from pathlib import Path
from datetime import date

DB_PATH = Path(__file__).parent / "nomenclaturas_db.json"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", s.lower()).strip()


# ─── Tabela de mapeamentos ────────────────────────────────────────────────────
# Formato:
#   "Texto exato do Excel": ("variation", "id_do_item_existente")
#   "Texto exato do Excel": ("new", dict com campos do novo item)
#   "Texto exato do Excel": ("skip",)

MAPPINGS: dict[str, tuple] = {

    # ── Variações de ALVENARIA ────────────────────────────────────────────────
    "ALVENARIA (PARED.DIVISÓRIAS, ETC.)":   ("variation", "alvenaria"),
    "Alvenaria em Bloco Celular":           ("variation", "alvenaria"),
    "Alvenaria em bloco sical":             ("variation", "alvenaria"),
    "Chapisco e emboço":                    ("variation", "alvenaria"),
    "Reforço em cedrinho para paredes":     ("variation", "alvenaria"),
    "Enchimento de contrapiso (h=4cm)":     ("variation", "alvenaria"),
    "Furação mecânica de lajes para Esgotos e tubulações.": ("variation", "alvenaria"),
    "CIVIL":                                ("variation", "alvenaria"),
    "PAREDES":                              ("variation", "alvenaria"),

    # ── Variações de PINTURA ──────────────────────────────────────────────────
    "PINTURAS DE FORRO/PAREDES":            ("variation", "pintura-geral"),
    "PINTURA DE FORRO / LAJE":              ("variation", "pintura-geral"),
    "PINTURA DE PAREDE":                    ("variation", "pintura-geral"),
    "PINTURA EM SERRALHERIA":               ("variation", "pintura-geral"),
    "Pintura esmalte cor Grafite em porta metálica - Mat. + M.O.": ("variation", "pintura-geral"),
    "Pintura latex branco - Mat. + M.O. - acima do nível do forro": ("variation", "pintura-geral"),
    "Pintura latex branco - Mat. + M.O. - áreas técnicas":          ("variation", "pintura-geral"),
    "Pintura latex branco neve fosco para laje - Mat. + M.O.":      ("variation", "pintura-geral"),
    "PINTURA":                              ("variation", "pintura-geral"),

    # ── Variações de EPÓXI ────────────────────────────────────────────────────
    "PINTURA DE PISO":                      ("variation", "epoxi"),
    "Epóxi sobre cimentado - Mat. + M.O. - áreas técnicas": ("variation", "epoxi"),
    "Piso Cimentado para áreas técnicas com 5cm de espessura": ("variation", "epoxi"),

    # ── Variações de DIVISÓRIA ────────────────────────────────────────────────
    "DIVISÓRIAS":                           ("variation", "divisoria"),
    "DIVIS DIVISÓRIAS":                     ("variation", "divisoria"),
    "Portas de divisória 1,20m (dupla)":    ("variation", "divisoria"),
    "PAREDES E FORROS EM GESSO":            ("variation", "divisoria"),

    # ── Variações de DRYWALL ─────────────────────────────────────────────────
    "ADAPTAÇÃO E REFORMA DO PRÉDIO":        ("variation", "drywall"),
    "ADAPTAÇÃO DE SHELL":                   ("variation", "drywall"),

    # ── Variações de LAMINADO ─────────────────────────────────────────────────
    "Revestimento em laminado":             ("variation", "laminado"),
    "Revestimento em laminado - Mat. + M.O.": ("variation", "laminado"),
    "Painel 120cm laminado ártico TX - Mat. + M.O.": ("variation", "laminado"),
    "painel liso laminado branco":          ("variation", "laminado"),
    "revestimento em laminado":             ("variation", "laminado"),
    "Rodapé em fórmica - Mat. + M.O.":     ("variation", "laminado"),
    "Rodateto em fórmica - Mat. + M.O.":   ("variation", "laminado"),

    # ── Variações de ACM ─────────────────────────────────────────────────────
    "Revestimento em ACM Branco Brilho":    ("variation", "acm"),
    "Revestimento para marquise":           ("variation", "acm"),
    "REVESTIMENTOS DE PAREDE":             ("variation", "acm"),
    "REVESTIMENTO DE PAREDE":              ("variation", "acm"),

    # ── Variações de PORCELANATO ──────────────────────────────────────────────
    "PISO ÁREA DE VENDAS":                  ("variation", "porcelanato"),
    "PISO DA ÁREA ADM/RESERVA":            ("variation", "porcelanato"),
    "Porcelanato 1,20x0,60 - fornecido pela C&A": ("variation", "porcelanato"),
    "Assentamento de piso porcelanato":     ("variation", "porcelanato"),
    "REVESTIMENTO DE PISO":                ("variation", "porcelanato"),
    "BASE DE PISO":                        ("variation", "porcelanato"),

    # ── Variações de RODAPÉ ───────────────────────────────────────────────────
    "Rodapé MDP Branco":                   ("variation", "rodape"),
    "Rodapé Primer Tarket - 10 cm - SV":   ("variation", "rodape"),
    "Rodapé em aço inox escovado 200mm":   ("variation", "rodape"),
    "Rodapé escada dos provadores em granito branco ceará": ("variation", "rodape"),
    "Rodateto / rodapé":                    ("variation", "rodape"),
    "rodapé/rodateto em mdf branco 10mm x 10,0cm": ("variation", "rodape"),
    "Rodapé de madeira h=20cm":            ("variation", "rodape"),
    "Rodapé de madeira h=7cm":             ("variation", "rodape"),
    "rodapé em mdf branco 10mm x 5,0cm - TARKET": ("variation", "rodape"),
    "Arremates de cantos / Cantoneira alumínio": ("variation", "rodape"),
    "Arremates de cantos / Cantoneira alumínio - Mat. + M.O.": ("variation", "rodape"),
    "Arremates gerais":                     ("variation", "rodape"),

    # ── Variações de VIDRO ────────────────────────────────────────────────────
    "VIDROS E ESPELHOS":                   ("variation", "vidro"),
    "ESQUADRIAS E VIDROS ÁREA ADM.":       ("variation", "vidro"),
    "Vidro temperado hidrante c/ ferragens - Mat. + M.O.": ("variation", "vidro"),
    "Vidro blindex 10mm para guarda corpo - Mat. + M.O.": ("variation", "vidro"),
    "Visor back office com vidro":          ("variation", "vidro"),
    "Visor gerência com vidro":             ("variation", "vidro"),
    "Esquadria metálica c/ tela":           ("variation", "vidro"),
    "ESQUADRIAS":                          ("variation", "vidro"),

    # ── Variações de ESPELHO ─────────────────────────────────────────────────
    "Espelho 4mm incolor Guardian class - Mat. + M.O.":      ("variation", "espelho"),
    "Espelho 4mm incolor Guardian class - corredor provador": ("variation", "espelho"),
    "Chassis para espelhos - cabine provador":                ("variation", "espelho"),

    # ── Variações de ESTRUTURA METÁLICA ──────────────────────────────────────
    "ESCADAS/ESTRUTURAS METÁLICAS AUX":     ("variation", "estrutura-metalica"),
    "ESTRUTURA AUXILIAR":                   ("variation", "estrutura-metalica"),
    "Adequação estrutural para elevador":   ("variation", "estrutura-metalica"),
    "Adequação estrutural para escada rolante": ("variation", "estrutura-metalica"),
    "Gradil metálico para isolamento":      ("variation", "estrutura-metalica"),
    "Estrutura metálica auxiliar para porta de enrolar": ("variation", "estrutura-metalica"),
    "Perfil em aço inox escovado para caixilho dos vidros 150mm": ("variation", "estrutura-metalica"),
    "Laje pré-moldada com capa de concreto": ("variation", "estrutura-metalica"),
    "LAJE PARA SUBESTAÇÃO":                ("variation", "estrutura-metalica"),
    "MEZANINO E ESCADA":                   ("variation", "estrutura-metalica"),
    "Escada metálica - contratação direta C&A": ("variation", "estrutura-metalica"),
    "Mezanino metálico - contratação direta C&A": ("variation", "estrutura-metalica"),

    # ── Variações de PORTA ────────────────────────────────────────────────────
    "PORTAS EM MADEIRA E ACESSÓRIOS":       ("variation", "porta"),
    "Porta de enrolar - fornecimento C&A":  ("variation", "porta"),
    "Porta corta-fogo - Docas":             ("variation", "porta"),
    "Porta de ferro - C. Máquina":          ("variation", "porta"),
    "Porta de ferro - Circulação":          ("variation", "porta"),
    "Porta de ferro - Gerador":             ("variation", "porta"),
    "Porta vai vem  ártico TX - Mat. + M.O.": ("variation", "porta"),
    "Porta completa simples  ártico TX 1.00m - Mat. + M.O.": ("variation", "porta"),
    "Porta completa simples ártico TX 0.80m  - Mat. + M.O.": ("variation", "porta"),
    "Porta dupla 1.20m  ártico TX - Mat. + M.O.": ("variation", "porta"),
    "Porta de correr provador":             ("variation", "porta"),
    "Porta de madeira Dupla casa de maquina": ("variation", "porta"),
    "Portinhola branca para correio pneumático": ("variation", "porta"),
    "Portinhola de alumínio sob bancada apenas na cantina": ("variation", "porta"),
    "Passa documentos":                     ("variation", "porta"),
    "Mola para porta - Mat. + M.O.":       ("variation", "porta"),
    "Prendedor de porta - Mat. + M.O.":    ("variation", "porta"),
    "Barra de apoio para porta - Mat. + M.O. - Sanitário PNE": ("variation", "porta"),
    "Portas":                               ("variation", "porta"),
    "porta provador PNE - com dobradiça, trinco e puxador": ("variation", "porta"),
    "porta provador família - com dobradiça, trinco e puxador": ("variation", "porta"),
    "Al açapão":                            ("variation", "porta"),
    "Alçapão":                              ("variation", "porta"),

    # ── Variações de ARMÁRIO ─────────────────────────────────────────────────
    "MARCENARIA E ENXOVAL - ESTOQUE E ADM": ("variation", "armario"),
    "Armário boca de lobo - sala da gerência": ("variation", "armario"),
    "Armário suspenso - refeitório":        ("variation", "armario"),
    "Armário suspenso e bancada - sala da gerência": ("variation", "armario"),
    "Prateleira na circulação para caixa geral": ("variation", "armario"),
    "Estante sala de rack":                 ("variation", "armario"),
    "Montagem de estante modular metálica - fornecido pela C&A": ("variation", "armario"),
    "Moldura para cofre - boca de lobo":    ("variation", "armario"),
    "Bancada/ armário da copa":             ("variation", "armario"),
    "Suporte para TV, Projetor e Microondas": ("variation", "armario"),
    "RESERVAS E ADMINISTRATIVO":           ("variation", "armario"),
    "ADMINISTRATIVO E RESERVAS":           ("variation", "armario"),

    # ── Variações de BANCADA ─────────────────────────────────────────────────
    "Bancadas em granito para vestiários - Mat. + M.O.": ("variation", "bancada"),
    "Aparadores para bancada de vestiários  - Mat. + M.O.": ("variation", "bancada"),
    "Superfície para troca de roupas":      ("variation", "bancada"),

    # ── Variações de GRANITO ─────────────────────────────────────────────────
    "MARMORES E GRANITOS":                 ("variation", "granito"),
    "Nicho em granito nos box de chuveiro - Mat. + M.O.": ("variation", "granito"),
    "Soleira em granito - Mat. + M.O. (Branco Ceará)":   ("variation", "granito"),
    "Soleira em granito - Mat. + M.O. (Cinza Andorinha)": ("variation", "granito"),
    "Sóculos granito frente vitrine (largura 10cm)":      ("variation", "granito"),
    "Sóculos para bancadas":               ("variation", "granito"),
    "Rodapé escada dos provadores em granito branco ceará": ("variation", "granito"),
    "Revestimento da Escada (Degrau e espelho) em Ardósia": ("variation", "granito"),
    "ESCADA: Revestimento degrau em Ardósia": ("variation", "granito"),

    # ── Variações de PAINEL MDF ──────────────────────────────────────────────
    "PAINÉIS E FERRAGENS":                  ("variation", "painel-mdf"),
    "PAINÉIS FERRAGENS E ESPELHOS PROVADORES": ("variation", "painel-mdf"),
    "Painel wall para mezanino - contratação direta C&A": ("variation", "painel-mdf"),
    "coluna simples":                       ("variation", "painel-mdf"),
    "frontal":                              ("variation", "painel-mdf"),
    "lateral de provador branca":           ("variation", "painel-mdf"),
    "travessa":                             ("variation", "painel-mdf"),
    "régua para união de painéis":          ("variation", "painel-mdf"),
    "R guas para união de painéis":         ("variation", "painel-mdf"),
    "Réguas para união de painéis - Mat. + M.O.": ("variation", "painel-mdf"),
    "r gua para uni o de pain is":          ("variation", "painel-mdf"),
    "suporte \"l\" para lateral de provador": ("variation", "painel-mdf"),
    "fixadores de teto":                    ("variation", "painel-mdf"),
    "Fixadores de teto - Mat. + M.O.":     ("variation", "painel-mdf"),
    "cabideiro cromado (especificação em anexo)": ("variation", "painel-mdf"),
    "Nichos lounge -":                      ("variation", "painel-mdf"),
    "tubo em aço inox para provador deficiente 160,0cm": ("variation", "painel-mdf"),
    "tubo em aço inox para provador deficiente 80,0cm": ("variation", "painel-mdf"),
    "PROVADORES":                           ("variation", "painel-mdf"),
    "MARCENARIA E ENXOVAL":                ("variation", "painel-mdf"),
    "Marcenaria Pulpitre provador":         ("variation", "painel-mdf"),

    # ── Variações de TAPUME ───────────────────────────────────────────────────
    "Lona proteção - piso, marcenaria, equipamentos em geral": ("variation", "tapume"),
    "Lona transparente proteção equipamentos": ("variation", "tapume"),
    "Fornecimento e colocação de tela Telcon e Lona preta": ("variation", "tapume"),

    # ── Variações de FACHADA ─────────────────────────────────────────────────
    "FACHADAS":                             ("variation", "fachada"),
    "FACHADAS / ENTRADA LOJA / VITRIN":    ("variation", "fachada"),
    "Estrutura metálica em metalon para revestimento de fachada": ("variation", "fachada"),

    # ── Variações de FORRO ────────────────────────────────────────────────────
    "FORRO ÁREA DE VENDAS":                 ("variation", "forro"),
    "FORRO":                                ("variation", "forro"),
    "Demolição forro/sancas de gesso":      ("variation", "forro"),

    # ── Variações de IMPERMEABILIZAÇÃO ───────────────────────────────────────
    "IMPEAB/TELHADO/REV.EXT/CANTEIRO":     ("variation", "impermeabilizacao"),
    "Enchimento de Juntas de dilatação com vedaflex": ("variation", "impermeabilizacao"),
    "TRATAMENTO DE JUNTA DE DILATAÇÃO":    ("variation", "impermeabilizacao"),

    # ── Variações de HIDRÁULICA ───────────────────────────────────────────────
    "LOUÇAS E METAIS":                     ("variation", "hidraulica"),
    "Caixa para hidrantes":                ("variation", "hidraulica"),
    "Caixa para hidrantes - Mat. + M.O.": ("variation", "hidraulica"),
    "Filtro para bebedouro Aqualar":        ("variation", "hidraulica"),
    "Base de alumínio para bebedouro":      ("variation", "hidraulica"),
    "Tubo aço inox 2\" para alimentação caixa - Mat. + M.O.": ("variation", "hidraulica"),
    "Tetra-chave - Mat. + M.O.":           ("variation", "hidraulica"),

    # ── Variações de CUBA ────────────────────────────────────────────────────
    "Cuba de inox - copa":                  ("variation", "cuba"),

    # ── Variações de ELÉTRICA ─────────────────────────────────────────────────
    "LIGAÇÃO PROVISÓRIA INSTALAÇÕES ELETRICAS": ("variation", "eletrica"),
    "GERADOR/ SUBESTAÇÃO":                  ("variation", "eletrica"),
    "ELEVADOR E ESCADA ROLANTE":            ("variation", "eletrica"),
    "Prever reforço para: placas aéreas cv, trilho vitrine": ("variation", "eletrica"),

    # ── Variações de GUARDA CORPO ─────────────────────────────────────────────
    "GUARDA CORPO EM INOX":                 ("variation", "guarda-corpo"),
    "Adequação de escada / mezanino / guarda corpo existente": ("variation", "guarda-corpo"),

    # ── Variações de PISO PODOTÁTIL ──────────────────────────────────────────
    "ESCADA: Piso tátil e fita antiderrapante": ("variation", "piso-podotátil"),
    "Piso tátil (escada rolante e escada fixa) - Mat. + M.O.": ("variation", "piso-podotátil"),
    "Fita antiderrapante Safety walk 50mm para entrada da loja": ("variation", "piso-podotátil"),

    # ── Variações de TABLADO ─────────────────────────────────────────────────
    "Estrado com laminado branco para vitrine  - Mat. + M.O.": ("variation", "tablado"),

    # ── Variações de VITRINE ─────────────────────────────────────────────────
    "Vitrines":                             ("variation", "vitrine"),

    # ── NOVOS ITENS ───────────────────────────────────────────────────────────
    "LEVANTAMENTO TOPOGRAFICO": ("new", {
        "id": "levantamento-topografico",
        "canonical_name": "Levantamento Topográfico",
        "category": "civil",
        "unit": "vb",
        "has_price": False,
        "variations": [
            "Topografia (5 visitas)",
            "Levantamento topográfico",
            "LEVANTAMENTO TOPOGRAFICO",
        ],
    }),
    "Demolições e retiradas - incluir bota-fora": ("new", {
        "id": "demolicao",
        "canonical_name": "Demolições e Retiradas",
        "category": "civil",
        "unit": "vb",
        "has_price": False,
        "variations": [
            "Demolições e retiradas - incluir bota-fora",
            "Demolições e retiradas",
            "Demolição",
            "Demolicão forro/sancas",
        ],
    }),
    "Limpeza Final de obra": ("new", {
        "id": "limpeza-obra",
        "canonical_name": "Limpeza de Obra",
        "category": "outro",
        "unit": "vb",
        "has_price": False,
        "variations": [
            "Limpeza Final de obra",
            "Limpeza permanente da obra (2 operários)",
            "Serviços de Limpeza e Administração de Obra",
            "Material de limpeza e administrativo (Xerox e Plotagens)",
        ],
    }),
    "ADMINISTRAÇÃO, MOBILIZAÇÃO E LIMPEZA DA OBRA": ("new", {
        "id": "administracao-obra",
        "canonical_name": "Administração de Obra",
        "category": "outro",
        "unit": "vb",
        "has_price": False,
        "variations": [
            "ADMINISTRAÇÃO, MOBILIZAÇÃO E LIMPEZA DA OBRA",
            "Mobilização e desmobilização",
            "Loca ão de equipamentos manuais",
            "Locação de equipamentos manuais",
            "Transporte vertical e horizontal",
            "Estadias e refeições",
            "SERVICOS GERAIS (CÓPIAS, ETC.)",
            "Seguro de obra com responsabilidade civil.",
            "Extintores para a Obra e Bebedouro para funcionários",
            "ART contemplando todos os serviços + placa de obra",
            "Adicional Noturno",
            "Homem/Hora",
            "Hora Normal",
            "Hora 60%",
            "Hora 100%",
        ],
    }),
    "BDI": ("new", {
        "id": "bdi",
        "canonical_name": "BDI / Impostos",
        "category": "outro",
        "unit": "vb",
        "has_price": False,
        "variations": [
            "BDI",
            "b.d.i.",
            "Taxa de ADM",
            "imposto",
            "Serviços Gerais",
        ],
    }),
    "Locker para vestiário": ("new", {
        "id": "locker",
        "canonical_name": "Locker / Vestiário",
        "category": "marcenaria",
        "unit": "un",
        "has_price": False,
        "variations": [
            "Locker para vestiário",
            "Sapateira para vestiário",
            "Banco para vestiário",
            "Superfície para troca de roupas",
            "Lixeira para bancada da cantina",
            "Lixeira para bancada dos sanitários",
            "Lixeira para vasos sanitários",
        ],
    }),
    "MEZANINO": ("new", {
        "id": "mezanino",
        "canonical_name": "Mezanino",
        "category": "civil",
        "unit": "m2",
        "has_price": False,
        "variations": [
            "MEZANINO",
            "MEZANINOS COM ESCADA DE ACESSO",
            "MEZANINO E ESCADA",
        ],
    }),
    "Capacho nômade 3M cinza grafite - Mat. + M.O.": ("new", {
        "id": "capacho",
        "canonical_name": "Capacho",
        "category": "outro",
        "unit": "un",
        "has_price": False,
        "variations": [
            "Capacho nômade 3M cinza grafite - Mat. + M.O.",
            "Capacho nômade 3M",
        ],
    }),
    "Execução área técnica": ("new", {
        "id": "area-tecnica",
        "canonical_name": "Área Técnica",
        "category": "civil",
        "unit": "m2",
        "has_price": False,
        "variations": [
            "Execução área técnica",
            "Área técnica",
            "SALA AR COND. E CASA MÁQ. E LAJE TÉCNICA",
        ],
    }),
    "Arquibancada": ("new", {
        "id": "arquibancada",
        "canonical_name": "Arquibancada",
        "category": "marcenaria",
        "unit": "m2",
        "has_price": False,
        "variations": [
            "Arquibancada",
        ],
    }),
    "Contrapiso": ("new", {
        "id": "contrapiso",
        "canonical_name": "Contrapiso",
        "category": "civil",
        "unit": "m2",
        "has_price": False,
        "variations": [
            "Contrapiso",
            "Enchimento de contrapiso",
        ],
    }),
    "Serralheria": ("new", {
        "id": "serralheria",
        "canonical_name": "Serralheria",
        "category": "civil",
        "unit": "vb",
        "has_price": False,
        "variations": [
            "Serralheria",
            "Tubo aço inox 2\"",
            "Perfil metálico",
            "APOIO PARA INSTALAÇÕES",
        ],
    }),
    "Provador PNE": ("new", {
        "id": "provador",
        "canonical_name": "Provadores",
        "category": "marcenaria",
        "unit": "un",
        "has_price": False,
        "variations": [
            "Provador PNE",
            "PROVADORES",
            "provador",
        ],
    }),

    # ── RUÍDO / SKIP ─────────────────────────────────────────────────────────
    "#REF!":                                ("skip",),
    "A TÍTULO DE INFORMAÇÃO":               ("skip",),
    "TOTAL GERAL":                          ("skip",),
    "CUSTOS DIRETOS":                       ("skip",),
    "PREÇOS UNITÁRIOS":                     ("skip",),
    "QDE.":                                 ("skip",),
    "BLN":                                  ("skip",),
    "LOJA NOVA":                            ("skip",),
    "FULL":                                 ("skip",),
    "SHOPPING NORTE BLUMENAU":              ("skip",),
    "CELMAR CONSTRUÇÕES E INCORPORAÇÕES LTDA.": ("skip",),
    "Gerenciador:":                         ("skip",),
    "Duração da obra:":                     ("skip",),
    "Desconsiderar":                        ("skip",),
    "Loja com piso existente.":             ("skip",),
    "Engenheiro":                           ("skip",),
    "Engenheiro residente - full time":     ("skip",),
    "Técnico de segurança - full time":     ("skip",),
    "Mestre":                               ("skip",),
    "Carpinteiro":                          ("skip",),
    "Pedreiro":                             ("skip",),
    "Servente":                             ("skip",),
    "Encarregado":                          ("skip",),
    "Mês":                                  ("skip",),
    "dia":                                  ("skip",),
    "unid":                                 ("skip",),
    "vb.":                                  ("skip",),
    "adm":                                  ("skip",),
    "estoque":                              ("skip",),
    "vendas":                               ("skip",),
    "provador":                             ("skip",),
    "ÁREA DE VENDAS":                       ("skip",),
    "Área técnica":                         ("skip",),
    "Administrativo":                       ("skip",),
    "Almoxarifado":                         ("skip",),
    "ADMINISTRATIVO E RESERVAS":           ("skip",),
}


def already_covered(item_name: str, items_by_id: dict) -> str | None:
    n = norm(item_name)
    for it in items_by_id.values():
        if n == norm(it.get("canonical_name", "")):
            return it["id"]
        if any(n == norm(v) for v in it.get("variations", [])):
            return it["id"]
    return None


def apply_mappings():
    db = json.loads(DB_PATH.read_text(encoding="utf-8"))
    items_by_id: dict[str, dict] = {it["id"]: it for it in db["items"]}

    added_variations = 0
    added_items = 0
    skipped = 0
    errors = []

    # Primeiro passa: novos itens (para que as variações abaixo possam referenciá-los)
    for text, action in MAPPINGS.items():
        if action[0] != "new":
            continue
        new_item = dict(action[1])
        iid = new_item["id"]
        new_item.setdefault("price_key", iid.upper().replace("-", "_"))

        if iid in items_by_id:
            # Já existe — apenas mescla variações
            target = items_by_id[iid]
            for v in new_item.get("variations", []):
                if norm(v) not in [norm(x) for x in target.get("variations", [])]:
                    target.setdefault("variations", []).append(v)
                    added_variations += 1
        else:
            items_by_id[iid] = new_item
            added_items += 1

    # Segunda passa: variações em itens existentes
    for text, action in MAPPINGS.items():
        if action[0] != "variation":
            continue
        target_id = action[1]
        if target_id not in items_by_id:
            errors.append(f"Target não encontrado: {target_id!r} para {text!r}")
            continue
        target = items_by_id[target_id]
        existing_norms = [norm(v) for v in target.get("variations", [])]
        n = norm(text)
        # Também checa canonical
        if n == norm(target.get("canonical_name", "")):
            skipped += 1
            continue
        if n not in existing_norms:
            target.setdefault("variations", []).append(text)
            added_variations += 1
        else:
            skipped += 1

    db["items"] = list(items_by_id.values())
    db["last_updated"] = date.today().isoformat()
    DB_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Banco atualizado:")
    print(f"  Novos itens criados:         {added_items}")
    print(f"  Variações adicionadas:       {added_variations}")
    print(f"  Skipped (já cobertos):       {skipped}")
    print(f"  Erros:                       {len(errors)}")
    for e in errors:
        print(f"    ERRO: {e}")
    print(f"\nTotal de itens no banco: {len(db['items'])}")


if __name__ == "__main__":
    apply_mappings()
