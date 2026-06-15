import type { FolhaMedicao, ResultadoOrcamento, TokenLog } from '@/lib/orcamento/types';

export const DEMO_FOLHA: FolhaMedicao = {
  "projeto": "Projeto Demonstração",
  "itens": [
    {
      "id": 1,
      "prancha_idx": 5,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia — Ala Principal",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.91,
      "largura_m": 0.6,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Rebaixo Italiano cozinha", "qtd": 1, "unidade": "un" },
        { "nome": "Recorte cooktop", "qtd": 1, "unidade": "un" },
        { "nome": "Furo torneira", "qtd": 1, "unidade": "un" },
        { "nome": "Borda Reta Meia Esquadria", "qtd": 3.51, "unidade": "ml" },
        { "nome": "Instalacao tampo sobre base", "qtd": 2.91, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 1.746
    },
    {
      "id": 2,
      "prancha_idx": 5,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia — Ala Retorno",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 0.81,
      "largura_m": 0.6,
      "borda_ml": 1.41,
      "servicos": [
        { "nome": "Instalacao tampo sobre base", "qtd": 0.9, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.486
    },
    {
      "id": 3,
      "prancha_idx": 5,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia",
      "tipo": "rodape",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 3.51,
      "largura_m": 0.1,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Instalacao rodape", "qtd": 3.51, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.351
    },
    {
      "id": 4,
      "prancha_idx": 5,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia",
      "tipo": "outro",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.91,
      "largura_m": 0.05,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Instalacao rodape", "qtd": 2.91, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.1455
    },
    {
      "id": 5,
      "prancha_idx": 7,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Forno e Bancada",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.75,
      "largura_m": 0.6,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Borda Reta Meia Esquadria", "qtd": 1.8, "unidade": "ml" },
        { "nome": "Instalacao tampo sobre base", "qtd": 1.75, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 1.05
    },
    {
      "id": 6,
      "prancha_idx": 7,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Forno e Bancada",
      "tipo": "rodape",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.75,
      "largura_m": 0.1,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Instalacao rodape", "qtd": 1.75, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.175
    },
    {
      "id": 7,
      "prancha_idx": 7,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Forno e Bancada",
      "tipo": "outro",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.75,
      "largura_m": 0.05,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Instalacao rodape", "qtd": 1.75, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.0875
    },
    {
      "id": 8,
      "prancha_idx": 9,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Café",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 0.7,
      "largura_m": 0.35,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Borda Reta Meia Esquadria", "qtd": 1.05, "unidade": "ml" },
        { "nome": "Instalacao tampo sobre base", "qtd": 0.7, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.245
    },
    {
      "id": 9,
      "prancha_idx": 11,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Tanque",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.65,
      "largura_m": 0.6,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Rebaixo Italiano lavanderia", "qtd": 1, "unidade": "un" },
        { "nome": "Furo torneira", "qtd": 1, "unidade": "un" },
        { "nome": "Borda Reta Meia Esquadria", "qtd": 2.25, "unidade": "ml" },
        { "nome": "Instalacao tampo sobre base", "qtd": 1.65, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.99
    },
    {
      "id": 10,
      "prancha_idx": 11,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Tanque",
      "tipo": "rodape",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.65,
      "largura_m": 0.1,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Instalacao rodape", "qtd": 1.65, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.165
    },
    {
      "id": 11,
      "prancha_idx": 11,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Tanque",
      "tipo": "outro",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.65,
      "largura_m": 0.05,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Instalacao rodape", "qtd": 1.65, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.0825
    },
    {
      "id": 12,
      "prancha_idx": 12,
      "status": "parcial",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Multiuso",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.35,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Borda Reta Meia Esquadria", "qtd": 2.82, "unidade": "ml" },
        { "nome": "Instalacao tampo sobre base", "qtd": 2.47, "unidade": "ml" }
      ],
      "pendencias": [
        "Comprimento 247 cm estimado — vista GRANITO separada não encontrada na prancha"
      ],
      "area_m2": 0.8645
    },
    {
      "id": 13,
      "prancha_idx": 12,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Multiuso",
      "tipo": "rodape",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.1,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Instalacao rodape", "qtd": 2.47, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.247
    },
    {
      "id": 14,
      "prancha_idx": 12,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Multiuso",
      "tipo": "outro",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.05,
      "borda_ml": 0,
      "servicos": [
        { "nome": "Instalacao rodape", "qtd": 2.47, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.1235
    },
    {
      "id": 15,
      "prancha_idx": 13,
      "status": "confirmado",
      "ambiente": "Banheiro",
      "modulo": "Bancada Pia",
      "tipo": "tampo",
      "material": "Granito Branco Siena",
      "espessura_cm": 2,
      "comprimento_m": 1,
      "largura_m": 0.57,
      "borda_ml": 1.57,
      "servicos": [
        { "nome": "Furo cuba embutir", "qtd": 1, "unidade": "un" },
        { "nome": "Furo torneira", "qtd": 1, "unidade": "un" },
        { "nome": "Acabamento Slim", "qtd": 1.57, "unidade": "ml" },
        { "nome": "Instalacao tampo sobre base", "qtd": 1, "unidade": "ml" }
      ],
      "pendencias": [],
      "area_m2": 0.57
    }
  ]
};

export const DEMO_RESULTADO: ResultadoOrcamento = {
  "itens": [
    {
      "id": 1,
      "prancha_idx": 5,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia — Ala Principal",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.91,
      "largura_m": 0.6,
      "borda_ml": 3.51,
      "servicos": [
        {
          "nome": "Rebaixo Italiano cozinha",
          "qtd": 1,
          "unidade": "un"
        },
        {
          "nome": "Recorte cooktop",
          "qtd": 1,
          "unidade": "un"
        },
        {
          "nome": "Furo torneira",
          "qtd": 1,
          "unidade": "un"
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 3.51,
          "unidade": "ml"
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 2.91,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 1.746,
      "vlrMaterial": 1693.62,
      "vlrServicos": 2071.2,
      "vlrTotal": 3764.8199999999997,
      "detServicos": [
        {
          "nome": "Rebaixo Italiano cozinha",
          "qtd": 1,
          "unidade": "un",
          "vlrUnit": 950,
          "total": 950
        },
        {
          "nome": "Recorte cooktop",
          "qtd": 1,
          "unidade": "un",
          "vlrUnit": 50,
          "total": 50
        },
        {
          "nome": "Furo torneira",
          "qtd": 1,
          "unidade": "un",
          "vlrUnit": 20,
          "total": 20
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 3.51,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 351
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 2.91,
          "unidade": "ml",
          "vlrUnit": 120,
          "total": 349.20000000000005
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 3.51,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 351
        }
      ],
      "erros": []
    },
    {
      "id": 2,
      "prancha_idx": 5,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia — Ala Retorno",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 0.81,
      "largura_m": 0.6,
      "borda_ml": 1.41,
      "servicos": [
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 0.9,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.486,
      "vlrMaterial": 471.42,
      "vlrServicos": 249,
      "vlrTotal": 720.4200000000001,
      "detServicos": [
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 0.9,
          "unidade": "ml",
          "vlrUnit": 120,
          "total": 108
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 1.41,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 141
        }
      ],
      "erros": []
    },
    {
      "id": 3,
      "prancha_idx": 5,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia",
      "tipo": "rodape",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 3.51,
      "largura_m": 0.1,
      "borda_ml": 0,
      "servicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 3.51,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.351,
      "vlrMaterial": 340.46999999999997,
      "vlrServicos": 140.39999999999998,
      "vlrTotal": 480.86999999999995,
      "detServicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 3.51,
          "unidade": "ml",
          "vlrUnit": 40,
          "total": 140.39999999999998
        }
      ],
      "erros": []
    },
    {
      "id": 4,
      "prancha_idx": 5,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Pia",
      "tipo": "outro",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.91,
      "largura_m": 0.05,
      "borda_ml": 0,
      "servicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.91,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.1455,
      "vlrMaterial": 141.135,
      "vlrServicos": 116.4,
      "vlrTotal": 257.53499999999997,
      "detServicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.91,
          "unidade": "ml",
          "vlrUnit": 40,
          "total": 116.4
        }
      ],
      "erros": []
    },
    {
      "id": 5,
      "prancha_idx": 7,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Forno e Bancada",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.2,
      "largura_m": 0.6,
      "borda_ml": 1.8,
      "servicos": [
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 1.8,
          "unidade": "ml"
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 1.2,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.72,
      "vlrMaterial": 698.4,
      "vlrServicos": 504,
      "vlrTotal": 1202.4,
      "detServicos": [
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 1.8,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 180
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 1.2,
          "unidade": "ml",
          "vlrUnit": 120,
          "total": 144
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 1.8,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 180
        }
      ],
      "erros": []
    },
    {
      "id": 6,
      "prancha_idx": 7,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Forno e Bancada",
      "tipo": "rodape",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.2,
      "largura_m": 0.1,
      "borda_ml": 0,
      "servicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 1.2,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.12,
      "vlrMaterial": 116.39999999999999,
      "vlrServicos": 48,
      "vlrTotal": 164.39999999999998,
      "detServicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 1.2,
          "unidade": "ml",
          "vlrUnit": 40,
          "total": 48
        }
      ],
      "erros": []
    },
    {
      "id": 7,
      "prancha_idx": 7,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Forno e Bancada",
      "tipo": "outro",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 1.2,
      "largura_m": 0.05,
      "borda_ml": 0,
      "servicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 1.2,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.06,
      "vlrMaterial": 58.199999999999996,
      "vlrServicos": 48,
      "vlrTotal": 106.19999999999999,
      "detServicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 1.2,
          "unidade": "ml",
          "vlrUnit": 40,
          "total": 48
        }
      ],
      "erros": []
    },
    {
      "id": 8,
      "prancha_idx": 9,
      "status": "confirmado",
      "ambiente": "Cozinha",
      "modulo": "Mob. Café",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 0.7,
      "largura_m": 0.35,
      "borda_ml": 1.05,
      "servicos": [
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 1.05,
          "unidade": "ml"
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 0.7,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.245,
      "vlrMaterial": 237.65,
      "vlrServicos": 294,
      "vlrTotal": 531.65,
      "detServicos": [
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 1.05,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 105
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 0.7,
          "unidade": "ml",
          "vlrUnit": 120,
          "total": 84
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 1.05,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 105
        }
      ],
      "erros": []
    },
    {
      "id": 9,
      "prancha_idx": 11,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Tanque",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.6,
      "borda_ml": 3.07,
      "servicos": [
        {
          "nome": "Rebaixo Italiano lavanderia",
          "qtd": 1,
          "unidade": "un"
        },
        {
          "nome": "Furo torneira",
          "qtd": 1,
          "unidade": "un"
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 3.07,
          "unidade": "ml"
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 2.47,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 1.482,
      "vlrMaterial": 1437.54,
      "vlrServicos": 1580.4,
      "vlrTotal": 3017.94,
      "detServicos": [
        {
          "nome": "Rebaixo Italiano lavanderia",
          "qtd": 1,
          "unidade": "un",
          "vlrUnit": 650,
          "total": 650
        },
        {
          "nome": "Furo torneira",
          "qtd": 1,
          "unidade": "un",
          "vlrUnit": 20,
          "total": 20
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 3.07,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 307
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 2.47,
          "unidade": "ml",
          "vlrUnit": 120,
          "total": 296.40000000000003
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 3.07,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 307
        }
      ],
      "erros": []
    },
    {
      "id": 10,
      "prancha_idx": 11,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Tanque",
      "tipo": "rodape",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.1,
      "borda_ml": 0,
      "servicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.47,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.247,
      "vlrMaterial": 239.59,
      "vlrServicos": 98.80000000000001,
      "vlrTotal": 338.39,
      "detServicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.47,
          "unidade": "ml",
          "vlrUnit": 40,
          "total": 98.80000000000001
        }
      ],
      "erros": []
    },
    {
      "id": 11,
      "prancha_idx": 11,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Tanque",
      "tipo": "outro",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.05,
      "borda_ml": 0,
      "servicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.47,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.1235,
      "vlrMaterial": 119.795,
      "vlrServicos": 98.80000000000001,
      "vlrTotal": 218.59500000000003,
      "detServicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.47,
          "unidade": "ml",
          "vlrUnit": 40,
          "total": 98.80000000000001
        }
      ],
      "erros": []
    },
    {
      "id": 12,
      "prancha_idx": 12,
      "status": "parcial",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Multiuso",
      "tipo": "tampo",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.35,
      "borda_ml": 2.82,
      "servicos": [
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 2.82,
          "unidade": "ml"
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 2.47,
          "unidade": "ml"
        }
      ],
      "pendencias": [
        "Comprimento 247 cm estimado — vista GRANITO separada não encontrada na prancha"
      ],
      "area_m2": 0.8645,
      "vlrMaterial": 838.565,
      "vlrServicos": 860.4000000000001,
      "vlrTotal": 1698.9650000000001,
      "detServicos": [
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 2.82,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 282
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 2.47,
          "unidade": "ml",
          "vlrUnit": 120,
          "total": 296.40000000000003
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 2.82,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 282
        }
      ],
      "erros": []
    },
    {
      "id": 13,
      "prancha_idx": 12,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Multiuso",
      "tipo": "rodape",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.1,
      "borda_ml": 0,
      "servicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.47,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.247,
      "vlrMaterial": 239.59,
      "vlrServicos": 98.80000000000001,
      "vlrTotal": 338.39,
      "detServicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.47,
          "unidade": "ml",
          "vlrUnit": 40,
          "total": 98.80000000000001
        }
      ],
      "erros": []
    },
    {
      "id": 14,
      "prancha_idx": 12,
      "status": "confirmado",
      "ambiente": "Lavanderia",
      "modulo": "Mob. Multiuso",
      "tipo": "outro",
      "material": "Granito Tabaco",
      "espessura_cm": 3,
      "comprimento_m": 2.47,
      "largura_m": 0.05,
      "borda_ml": 0,
      "servicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.47,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.1235,
      "vlrMaterial": 119.795,
      "vlrServicos": 98.80000000000001,
      "vlrTotal": 218.59500000000003,
      "detServicos": [
        {
          "nome": "Instalacao rodape",
          "qtd": 2.47,
          "unidade": "ml",
          "vlrUnit": 40,
          "total": 98.80000000000001
        }
      ],
      "erros": []
    },
    {
      "id": 15,
      "prancha_idx": 13,
      "status": "confirmado",
      "ambiente": "Banheiro",
      "modulo": "Bancada Pia",
      "tipo": "tampo",
      "material": "Granito Branco Siena",
      "espessura_cm": 2,
      "comprimento_m": 1,
      "largura_m": 0.57,
      "borda_ml": 1.57,
      "servicos": [
        {
          "nome": "Furo cuba embutir",
          "qtd": 1,
          "unidade": "un"
        },
        {
          "nome": "Furo torneira",
          "qtd": 1,
          "unidade": "un"
        },
        {
          "nome": "Acabamento Slim",
          "qtd": 1.57,
          "unidade": "ml"
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 1,
          "unidade": "ml"
        }
      ],
      "pendencias": [],
      "area_m2": 0.57,
      "vlrMaterial": 433.77,
      "vlrServicos": 424.1,
      "vlrTotal": 857.87,
      "detServicos": [
        {
          "nome": "Furo cuba embutir",
          "qtd": 1,
          "unidade": "un",
          "vlrUnit": 80,
          "total": 80
        },
        {
          "nome": "Furo torneira",
          "qtd": 1,
          "unidade": "un",
          "vlrUnit": 20,
          "total": 20
        },
        {
          "nome": "Acabamento Slim",
          "qtd": 1.57,
          "unidade": "ml",
          "vlrUnit": 30,
          "total": 47.1
        },
        {
          "nome": "Instalacao tampo sobre base",
          "qtd": 1,
          "unidade": "ml",
          "vlrUnit": 120,
          "total": 120
        },
        {
          "nome": "Borda Reta Meia Esquadria",
          "qtd": 1.57,
          "unidade": "ml",
          "vlrUnit": 100,
          "total": 157
        }
      ],
      "erros": []
    }
  ],
  "totalMaterial": 7185.9400000000005,
  "totalServicos": 6731.1,
  "totalGeral": 13917.04,
  "porAmbiente": {
    "Cozinha": 7228.294999999999,
    "Lavanderia": 5830.875000000001,
    "Banheiro": 857.87
  },
  "porMaterial": {
    "Granito Tabaco (3cm)": {
      "area": 6.961,
      "valor": 6752.17
    },
    "Granito Branco Siena (2cm)": {
      "area": 0.57,
      "valor": 433.77
    }
  }
};

export const DEMO_TOKEN_LOGS: TokenLog[] = [
  {
    "stage": "Análise (1/2)",
    "usage": {
      "input_tokens": 30668,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 0,
      "cache_creation": {
        "ephemeral_5m_input_tokens": 0,
        "ephemeral_1h_input_tokens": 0
      },
      "output_tokens": 6614,
      "service_tier": "standard",
      "inference_geo": "global"
    }
  },
  {
    "stage": "Revisão + JSON (2/2)",
    "usage": {
      "input_tokens": 45626,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 0,
      "cache_creation": {
        "ephemeral_5m_input_tokens": 0,
        "ephemeral_1h_input_tokens": 0
      },
      "output_tokens": 5528,
      "service_tier": "standard",
      "inference_geo": "global"
    }
  }
];
