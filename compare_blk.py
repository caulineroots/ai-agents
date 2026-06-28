import openpyxl

path = r'C:\Users\AVELL\Downloads\Cauline Roots\Celmar\CEA BLK\BLK_ Equalização Civil- 1ª revisão (1).xlsx'
wb = openpyxl.load_workbook(path, data_only=True)
ws = wb.active

# Parse gabarito
gab = {}
for row in ws.iter_rows(values_only=True):
    cod = row[2]
    if isinstance(cod, str) and '.' in cod:
        qty   = row[5]
        total = row[8]
        if isinstance(qty, (int, float)) and qty and cod not in gab:
            gab[cod.strip()] = {'qty': qty, 'total': total or 0, 'desc': str(row[3] or '')[:50]}

# AI results from user message
ai = {
    '1.1':  ('confirmado', 1,       'vb'),
    '1.2':  ('confirmado', 1,       'vb'),
    '1.3':  ('confirmado', 5,       'dia'),
    '2.1':  ('confirmado', 213,     'm2'),
    '2.3':  ('confirmado', 30,      'dia'),
    '3.3':  ('confirmado', 3,       'mes'),
    '4.1':  ('parcial',   3,       'mes'),
    '4.2':  ('parcial',   3,       'mes'),
    '4.5':  ('parcial',   3,       'mes'),
    '8.1':  ('confirmado', 1,       'vb'),
    '8.2':  ('confirmado', 1,       'vb'),
    '8.3':  ('confirmado', 1,       'vb'),
    '8.5':  ('aguardando', 0,      'm'),
    '8.6':  ('confirmado', 1,       'vb'),
    '8.8':  ('confirmado', 1,       'vb'),
    '8.9':  ('confirmado', 1,       'vb'),
    '8.11': ('confirmado', 1,       'vb'),
    '8.14': ('parcial',   1,       'un'),
    '8.15': ('parcial',   1,       'un'),
    '8.18': ('parcial',   1,       'un'),
    '8.19': ('parcial',   1,       'un'),
    '9.1':  ('aguardando', 0,      'm2'),
    '9.3':  ('aguardando', 0,      'vb'),
    '9.4':  ('aguardando', 0,      'vb'),
    '9.5':  ('confirmado', 266,    'm2'),
    '9.7':  ('aguardando', 0,      'm2'),
    '9.12': ('aguardando', 0,      'vb'),
    '9.13': ('aguardando', 0,      'vb'),
    '10.1': ('aguardando', 0,      'm2'),
    '10.2': ('aguardando', 0,      'm2'),
    '11.1': ('aguardando', 0,      'ml'),
    '13.1': ('confirmado', 29,     'm2'),
    '13.2': ('confirmado', 9,      'un'),
    '13.3': ('confirmado', 4,      'un'),
    '13.5': ('aguardando', 0,      'un'),
    '25.1': ('confirmado', 91,     'm2'),
    '25.2': ('confirmado', 39,     'm2'),
    '12.1': ('confirmado', 559,    'm2'),
    '12.2': ('confirmado', 388,    'm2'),
    '12.3': ('confirmado', 84,     'm2'),
    '12.4': ('aguardando', 0,      'm2'),
    '12.5': ('aguardando', 0,      'm2'),
    '12.6': ('confirmado', 33,     'm2'),
    '12.7': ('parcial',   1,       'vb'),
    '12.9': ('confirmado', 1360.37,'m2'),
    '12.11':('aguardando', 0,      'un'),
    '12.12':('aguardando', 0,      'un'),
    '12.13':('parcial',   1,       'vb'),
    '18.1': ('aguardando', 0,      'm2'),
    '18.2': ('parcial',   1,       'vb'),
    '18.3': ('confirmado', 614,    'm2'),
    '18.4': ('confirmado', 25,     'm2'),
    '18.5': ('confirmado', 683,    'm2'),
    '18.8': ('confirmado', 25,     'm2'),
    '18.10':('confirmado', 59,     'm2'),
    '18.11':('confirmado', 13,     'm2'),
    '18.12':('confirmado', 9.92,   'm2'),
    '18.18':('aguardando', 0,      'ml'),
    '14.1': ('confirmado', 977.78, 'm2'),
    '14.2': ('parcial',   977.78, 'm2'),
    '14.5': ('confirmado', 207.24, 'ml'),
    '14.6': ('parcial',   1,       'vb'),
    '14.7': ('aguardando', 0,      'ml'),
    '14.8': ('confirmado', 11.07,  'ml'),
    '14.11':('confirmado', 432.81, 'm2'),
    '14.13':('confirmado', 68.63,  'ml'),
    '14.14':('confirmado', 24,     'ml'),
    '14.16':('aguardando', 0,      'vb'),
    '14.17':('parcial',   1,       'cj'),
    '14.19':('confirmado', 2.09,   'ml'),
    '15.1': ('aguardando', 0,      'm2'),
    '15.2': ('aguardando', 0,      'm'),
    '15.3': ('aguardando', 0,      'm'),
    '16.1': ('aguardando', 0,      'm2'),
    '16.2': ('aguardando', 0,      'm2'),
    '16.3': ('aguardando', 0,      'un'),
    '16.4': ('aguardando', 0,      'un'),
    '19.1': ('aguardando', 0,      'un'),
    '19.2': ('aguardando', 0,      'un'),
    '19.4': ('aguardando', 0,      'm2'),
    '25.3': ('aguardando', 0,      'm2'),
    '25.4': ('aguardando', 0,      'ml'),
    '25.5': ('parcial',   98.83,  'ml'),
    '25.7': ('aguardando', 0,      'm2'),
    '22.14':('confirmado', 98.83,  'm'),
    '22.15':('confirmado', 68.63,  'm'),
}

PRICE = {
    '9.5': 32, '9.7': 40, '9.1': 780, '10.1': 205.36, '10.2': 139.6,
    '12.1': 106.5, '12.2': 117.5, '12.3': 0, '12.4': 148.65, '12.9': 63.5,
    '12.11': 127, '12.12': 35, '14.1': 39.15, '14.2': 10.2,
    '14.5': 0, '14.8': 846.5, '14.11': 58, '14.13': 53.3, '14.14': 61.1,
    '14.19': 969.26, '15.1': 126.5, '16.1': 3015, '16.2': 3015, '16.3': 268,
    '16.4': 268, '19.1': 694.49, '19.2': 694.49, '19.4': 601.6,
    '25.1': 80, '13.2': 1112.7, '13.3': 1214.75,
}

print(f"{'COD':<8} {'STATUS':<12} {'AI QTY':>8} {'GAB QTY':>8} {'DELTA':>10} | DESCRICAO")
print("-" * 90)

total_ai = 0
total_gab_matched = 0
issues = []

for cod, (status, ai_qty, unit) in sorted(ai.items()):
    g = gab.get(cod)
    if not g:
        continue
    gab_qty = g['qty']
    delta_qty = ai_qty - gab_qty
    pct = (delta_qty / gab_qty * 100) if gab_qty else 0
    flag = ''
    if status == 'aguardando' and gab_qty > 0:
        flag = ' ← PERDIDO'
    elif abs(pct) > 20 and gab_qty > 0:
        flag = f' ← {pct:+.0f}%'
    desc = g['desc'][:35]
    print(f"{cod:<8} {status:<12} {ai_qty:>8.2f} {gab_qty:>8.2f} {delta_qty:>+10.2f} | {desc}{flag}")

print("\n\n=== ITENS COM MAIOR IMPACTO FINANCEIRO ===")
impact = []
for cod, (status, ai_qty, unit) in ai.items():
    g = gab.get(cod)
    if not g: continue
    gab_qty = g['qty']
    if ai_qty == gab_qty: continue
    price = g['total'] / gab_qty if gab_qty else 0
    delta_val = (ai_qty - gab_qty) * price
    impact.append((delta_val, cod, status, ai_qty, gab_qty, g['desc'][:45]))

impact.sort(key=lambda x: x[0])
for delta_val, cod, status, ai_qty, gab_qty, desc in impact:
    if abs(delta_val) > 1000:
        print(f"  [{cod}] {delta_val:>+12,.0f} | AI={ai_qty} vs Gab={gab_qty} | {desc}")
