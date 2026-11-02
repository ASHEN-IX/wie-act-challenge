"""Offline V1/V2 evidence package. No annotation is independently approved."""
import html
import json
from pathlib import Path
import fitz
from agents.course_ingestion.extraction.layout import regions_from_pages
from agents.course_ingestion.extraction.pdf_loader import extract_pages_from_pdf_sandboxed

ROOT = Path(__file__).resolve().parent
PDF = ROOT.parent / 'reference-course.pdf'
OUT = ROOT / 'review' / 'detector-v2'
OUT.mkdir(parents=True, exist_ok=True)
old = regions_from_pages(extract_pages_from_pdf_sandboxed(str(PDF)))
new = regions_from_pages(extract_pages_from_pdf_sandboxed(str(PDF), extraction_version='2.0'))
legacy = [r for r in old if r['type'] == 'math']
revised = [r for r in new if r['type'] == 'math']
cases = json.loads((ROOT/'dataset.json').read_text())['cases']
annotations = {x['id']:x for x in json.loads((ROOT/'review/review-package.json').read_text())['cases']}

def overlap(a, b):
    return max(0, min(a[2], b[2])-max(a[0], b[0])) * max(0, min(a[3], b[3])-max(a[1], b[1]))

def mapping(r):
    options=[v for v in revised if v['page']==r['page'] and overlap(r['bbox'],v['bbox']) > 0]
    return max(options,key=lambda v:overlap(r['bbox'],v['bbox'])) if options else None

def crop(page, bbox, name):
    page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),clip=fitz.Rect(bbox),alpha=False).save(OUT/name)

rows=[]
with fitz.open(PDF) as doc:
    for page_index in range(len(doc)):
        page=doc[page_index]
        image=OUT/f'page-{page_index+1:02}.png'
        if not image.exists(): page.get_pixmap(matrix=fitz.Matrix(1,1),alpha=False).save(image)
    for r in legacy:
        v=mapping(r); ident=r['id']; page=doc[r['page']-1]
        crop(page,r['bbox'],ident+'-v1.png')
        if v:crop(page,v['bbox'],ident+'-v2.png')
        rows.append({'historical_id':ident,'page':r['page'],'old_bbox':r['bbox'],
                     'old_text':r['text'],'v2_id':v['id'] if v else None,
                     'new_bbox':v['bbox'] if v else None,'new_text':v['text'] if v else None,
                     'new_issues':v['issues'] if v else ['no_overlapping_v2_math_region'],
                     'assessment':'requires qualified mathematical review','reviewer':None})
(OUT/'census.json').write_text(json.dumps({'legacy_math':len(legacy),'v2_math':len(revised),'regions':rows},ensure_ascii=False,indent=2)+'\n')
by_id={x['historical_id']:x for x in rows}
e=html.escape

def card(r,case=None):
    ident=r['historical_id']; v2=('<img src="'+e(ident)+'-v2.png">') if r['v2_id'] else '<p>No overlapping V2 math region</p>'
    label=case['id'] if case else ident
    transcription=annotations[case['id']]['provisional_latex'] if case else None
    return f'''<section><h2>{e(label)} — page {r['page']}</h2><p><a href="page-{r['page']:02}.png">Original page</a> · <a href="../decisions.template.json">Independent review decisions</a></p><p>V1 {e(ident)} {e(str(r['old_bbox']))}; V2 {e(str(r['v2_id']))} {e(str(r['new_bbox']))}</p><div class="pair"><figure><img src="{e(ident)}-v1.png"><figcaption>Historical detector bbox</figcaption></figure><figure>{v2}<figcaption>V2 detector bbox</figcaption></figure></div><pre>V1: {e(str(r['old_text']))}\nV2: {e(str(r['new_text']))}\nProvisional: {e(str(transcription))}\nWarnings: {e(str(r['new_issues']))}</pre><p>Assessment: requires qualified mathematical review; no reviewer or approval recorded.</p></section>'''
head='''<!doctype html><meta charset="utf-8"><title>Detector V2 review</title><style>body{font:16px system-ui;margin:2rem;max-width:1200px}.pair{display:flex;gap:1rem;flex-wrap:wrap}figure{border:1px solid #ccc;padding:1rem}img{max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Detector V1 / V2 — provisional review</h1><p>Compare both images against the full page. Do not treat valid geometry, model output, or provisional text as mathematical approval. Record qualified independent decisions in the linked template.</p>'''
(OUT/'index.html').write_text(head+'<p><a href="census.html">All historical mathematics regions</a></p>'+''.join(card(by_id[c['region_id']],c) for c in cases if c['region_id'] in by_id))
(OUT/'census.html').write_text(head+''.join(card(r) for r in rows))
print('legacy',len(legacy),'v2',len(revised),'mapped',sum(bool(r['v2_id']) for r in rows),'cases',sum(c['region_id'] in by_id for c in cases))
