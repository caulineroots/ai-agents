import pdfplumber, os, re

base = r'C:\Users\AVELL\Downloads\Cauline Roots\gabriel constante'
pdf_file = [f for f in os.listdir(base) if f.startswith('dB_Caderno') and f.endswith('.pdf')][0]

KEYWORDS = ['granito', 'marmore', 'mármore', 'tampo', 'bancada', 'pia', 'lavanderia',
            'banheiro', 'superior', 'lateral', 'frontal', 'vista', 'mob.', 'cozinha']

with pdfplumber.open(os.path.join(base, pdf_file)) as pdf:
    print(f'Total: {len(pdf.pages)} paginas\n')
    for i, page in enumerate(pdf.pages, 1):
        text = (page.extract_text() or '').lower()
        has_granito = 'granito' in text or 'marmore' in text or 'mármore' in text
        
        # extract view/room labels
        found = []
        for kw in ['cozinha', 'lavanderia', 'banheiro', 'granito', 'vista', 'superior', 'frontal', 'lateral', 'tampo', 'bancada', 'mob.']:
            if kw in text:
                found.append(kw.upper())
        
        mark = '<<< GRANITO' if has_granito else ''
        print(f'p{i:02d}: {",".join(found[:8]):<60} {mark}')
