"""Generate provisional, source-backed context-crop review evidence."""
import html
import json
from pathlib import Path
import fitz
from agents.course_ingestion.extraction.pdf_loader import _math_context_bbox, extract_pages_from_pdf_sandboxed
from agents.course_ingestion.extraction.layout import regions_from_pages

ROOT = Path(__file__).resolve().parent
PDF = ROOT.parent / 'reference-course.pdf'
OUT = ROOT / 'review' / 'remediation'
OUT.mkdir(parents=True, exist_ok=True)
fixture = json.loads((ROOT / 'dataset.json').read_text())
old = {c['id']: c for c in json.loads((ROOT / 'review' / 'review-package.json').read_text())['cases']}
rows = []
with fitz.open(PDF) as pdf:
    for case in fixture['cases']:
        page = pdf[case['page'] - 1]
        bounds = _math_context_bbox(page, case['region_bbox'])
        image = OUT / (case['id'] + '.png')
        clip = fitz.Rect(bounds)
        scale = min(2., 1600 / max(clip.width, clip.height, 1))
        page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False).save(image)
        rows.append({'id':case['id'], 'page':case['page'], 'region_id':case['region_id'],
            'old_region_bbox':case['region_bbox'], 'old_crop_bbox':case['crop_bbox'],
            'context_bbox':bounds, 'old_crop':case['crop'], 'new_crop':str(image.relative_to(ROOT)),
            'source_page':old[case['id']]['page_image'], 'deterministic_text':case['baseline_text'],
            'provisional_latex':old[case['id']]['provisional_latex'], 'warnings':old[case['id']]['notes'],
            'review_status':'pending_review', 'reviewer':None})
    extracted = regions_from_pages(extract_pages_from_pdf_sandboxed(str(PDF)))
    math = [r for r in extracted if r['type'] == 'math']
    census = [{'id':r['id'], 'page':r['page'], 'bbox':r['bbox'],
        'context_bbox':_math_context_bbox(pdf[r['page']-1], r['bbox']),
        'text':r['text'], 'review_required':True} for r in math]
(OUT/'results.json').write_text(json.dumps({'cases':rows,'math_regions':census},ensure_ascii=False,indent=2)+'\n')
e=html.escape
cards=[]
for c in rows:
    cards.append(f'''<section><h2>{e(c['id'])} — page {c['page']}</h2><p>Region {e(c['region_id'])}; old region {e(str(c['old_region_bbox']))}; old padded crop {e(str(c['old_crop_bbox']))}; context {e(str(c['context_bbox']))}</p><p><a href="../../{e(c['source_page'])}">Original page</a> · <a href="../decisions.template.json">Decision template</a></p><div class="pair"><figure><img src="../../{e(c['old_crop'])}"><figcaption>Original padded crop</figcaption></figure><figure><img src="{e(c['id'])}.png"><figcaption>New context crop; completeness unverified</figcaption></figure></div><p>{e(c['warnings'])}</p><pre>Extracted: {e(c['deterministic_text'])}\nProvisional: {e(str(c['provisional_latex']))}</pre><p>Review: pending; reviewer: not assigned</p></section>''')
(OUT/'index.html').write_text('''<!doctype html><meta charset="utf-8"><title>Source-region remediation review</title><style>body{font:16px system-ui;margin:2rem;max-width:1100px}.pair{display:flex;gap:1rem;flex-wrap:wrap}figure{border:1px solid #ccc;padding:1rem}img{max-width:100%}pre{white-space:pre-wrap}</style><h1>Formula context crops — independent review required</h1><p>These are provisional source views, not verified transcriptions. For each case compare the entire PDF page, symbols, bounds, scripts, prose intrusion and crop edges. Record accept, correct or reject with reviewer and date in the separate decision template.</p>'''+''.join(cards))
print('cases', len(rows), 'math regions',len(census),'expanded',sum(r['bbox'] != r['context_bbox'] for r in census))
