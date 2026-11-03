"""Offline V1/V2 evidence package. No annotation is independently approved.

Every historical mathematics region of the reference course is compared with
the V2 extraction of the same visible content:

- explicit source identity (reference PDF sha256, extraction versions);
- historical and V2 crops, geometry and verbatim text side by side;
- the V2 structural grouping label (single_expression, multiline_derivation,
  mixed_prose, structurally_ambiguous) — a structural statement, never a
  semantic or mathematical-correctness claim;
- a visible-completeness assessment (complete / clipped / mixed / ambiguous /
  review) derived from structural signals only, so a human reviewer still
  compares the crops against the original page;
- per-region review fields (status, reviewer, date, decision, notes) left
  unset for a qualified independent reviewer.

Changed regions and the 16 named benchmark cases are additionally rendered as
contact sheets (historical crop left, V2 crop right). The historical crops
under ``crops/`` are never touched; the sheets simply reference the region
crops regenerated under ``review/detector-v2/``.
"""
import hashlib
import html
import json
from pathlib import Path

import fitz
from PIL import Image, ImageDraw

from agents.course_ingestion.extraction.layout import regions_from_pages
from agents.course_ingestion.extraction.pdf_loader import extract_pages_from_pdf_sandboxed

ROOT = Path(__file__).resolve().parent
PDF = ROOT.parent / 'reference-course.pdf'
OUT = ROOT / 'review' / 'detector-v2'
OUT.mkdir(parents=True, exist_ok=True)
source_sha = 'sha256:' + hashlib.sha256(PDF.read_bytes()).hexdigest()
old = regions_from_pages(extract_pages_from_pdf_sandboxed(str(PDF)))
new = regions_from_pages(extract_pages_from_pdf_sandboxed(str(PDF), extraction_version='2.0'))
legacy = [r for r in old if r['type'] == 'math']
revised = [r for r in new if r['type'] == 'math']
cases = json.loads((ROOT/'dataset.json').read_text())['cases']
annotations = {x['id']:x for x in json.loads((ROOT/'review/review-package.json').read_text())['cases']}


def overlap(a, b):
    return max(0, min(a[2], b[2])-max(a[0], b[0])) * max(0, min(a[3], b[3])-max(a[1], b[1]))


def mapping(r):
    options = [v for v in revised if v['page']==r['page'] and overlap(r['bbox'],v['bbox']) > 0]
    return max(options, key=lambda v:overlap(r['bbox'],v['bbox'])) if options else None


def crop(page, bbox, name):
    page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),clip=fitz.Rect(bbox),alpha=False).save(OUT/name)


def content_preserved(old_text, new_text):
    """Every non-empty historical line must survive verbatim in one V2 line."""
    v2_lines = [line.strip() for line in (new_text or '').splitlines()]
    for line in (old_text or '').splitlines():
        stripped = line.strip()
        if stripped and not any(stripped in candidate for candidate in v2_lines):
            return False
    return True


def classify(v2_region, page_rect):
    """Structural completeness label of the mapped V2 region, never semantic.

    - ambiguous : the grouping could not be resolved from geometry alone;
    - mixed     : prose rows contaminate the band or were split out of it;
    - clipped   : the band boundary is flush against a page edge, so the
                  reviewer must confirm nothing sits outside the crop;
    - complete  : grouping is resolved and set aside for the text check;
    - review    : anything else — a human must compare the crops.
    """
    if v2_region is None:
        return 'review'
    issues = v2_region.get('issues') or []
    grouping = v2_region.get('mathGrouping') or ''
    if grouping == 'structurally_ambiguous' or 'math_grouping_ambiguous' in issues:
        return 'ambiguous'
    if grouping == 'mixed_prose' or 'math_prose_contamination' in issues or 'math_inline_mixed' in issues:
        return 'mixed'
    flush = (
        v2_region['bbox'][0] <= page_rect.x0 + 0.75
        or v2_region['bbox'][2] >= page_rect.x1 - 0.75
        or v2_region['bbox'][1] <= page_rect.y0 + 0.75
        or v2_region['bbox'][3] >= page_rect.y1 - 0.75
    )
    if flush:
        return 'clipped'
    if grouping in ('single_expression', 'multiline_derivation'):
        return 'complete'
    return 'review'


def same_geometry(a, b):
    return tuple(round(value, 2) for value in a) == tuple(round(value, 2) for value in b)


rows = []
changed = []
with fitz.open(PDF) as doc:
    page_rects = [doc[i].rect for i in range(len(doc))]
    for page_index in range(len(doc)):
        page = doc[page_index]
        image = OUT/f'page-{page_index+1:02}.png'
        if not image.exists():
            page.get_pixmap(matrix=fitz.Matrix(1,1),alpha=False).save(image)
    mapped_ids = set()
    for r in legacy:
        v = mapping(r)
        ident = r['id']
        page = doc[r['page']-1]
        crop(page, r['bbox'], ident+'-v1.png')
        if v:
            mapped_ids.add(v['id'])
            crop(page, v['bbox'], ident+'-v2.png')
        grouping = v['mathGrouping'] if v else None
        issues = v['issues'] if v else []
        assessment = classify(v, page_rects[r['page']-1])
        preserved = content_preserved(r['text'], v['text'] if v else None)
        # 'complete' still requires the historical text to survive in the V2
        # region; 'ambiguous', 'mixed' and 'clipped' describe the V2 region as
        # detected and are kept as structural observations for the reviewer.
        if v and (
            not same_geometry(r['bbox'], v['bbox']) or str(r['text']) != str(v['text'])
        ):
            change = True
        else:
            change = not v
        rows.append({'historical_id':ident,'page':r['page'],'old_bbox':r['bbox'],
                     'old_text':r['text'],'v2_id':v['id'] if v else None,
                     'new_bbox':v['bbox'] if v else None,'new_text':v['text'] if v else None,
                     'math_grouping':grouping,
                     'new_issues':issues if v else ['no_overlapping_v2_math_region'],
                     'assessment':assessment if v else 'review',
                     'content_preserved':preserved,'changed':change,
                     'review_status':'pending_review','reviewer':None,'reviewed_at':None,
                     'decision':None,'notes':None})
        if change:
            changed.append(rows[-1])
    unmapped = [v for v in revised if v['id'] not in mapped_ids]

by_id = {x['historical_id']:x for x in rows}
case_by_region = {c['region_id']:c for c in cases}
assessment_census = {a: sum(1 for r in rows if r['assessment']==a)
                     for a in ('complete','clipped','mixed','ambiguous','review')}
grouping_census = {}
for r in revised:
    grouping_census[r['mathGrouping']] = grouping_census.get(r['mathGrouping'], 0) + 1
e = html.escape

def card(r, case=None):
    ident = r['historical_id']
    v2 = ('<img src="'+e(ident)+'-v2.png">') if r['v2_id'] else '<p>No overlapping V2 math region</p>'
    label = case['id'] if case else ident
    transcription = annotations[case['id']]['provisional_latex'] if case else None
    return f'''<section><h2>{e(label)} — page {r['page']}</h2><p><a href="page-{r['page']:02}.png">Original page</a> · <a href="../decisions.template.json">Independent review decisions</a></p><p>V1 {e(ident)} {e(str(r['old_bbox']))}; V2 {e(str(r['v2_id']))} {e(str(r['new_bbox']))}</p><p>Grouping: {e(str(r['math_grouping']))} · assessment: {e(str(r['assessment']))} · changed: {e(str(r['changed']))} · historical lines preserved: {e(str(r['content_preserved']))}</p><div class="pair"><figure><img src="{e(ident)}-v1.png"><figcaption>Historical detector bbox</figcaption></figure><figure>{v2}<figcaption>V2 detector bbox</figcaption></figure></div><pre>V1: {e(str(r['old_text']))}\nV2: {e(str(r['new_text']))}\nProvisional: {e(str(transcription))}\nWarnings: {e(str(r['new_issues']))}</pre><p>The grouping and assessment statements are structural observations, not mathematical approvals. Review fields (status, reviewer, date, decision, notes) are unset and recorded in census.json.</p></section>'''


def contact_sheets(title_rows, prefix):
    """Deterministic sheets: ids in order, batches of eight stacked rows."""
    paths = []
    batches = [title_rows[i:i+8] for i in range(0, len(title_rows), 8)]
    if not batches:
        batches = []
    produced = 0
    for index, batch in enumerate(batches):
        if not batch:
            continue
        cells = []
        for ident, label in batch:
            v1 = Image.open(OUT/f'{ident}-v1.png')
            v2 = Image.open(OUT/f'{ident}-v2.png')
            cells.append((label, v1, v2))
        width, row_pad = 1180, 30
        cell_heights = [max(a.height, b.height) + row_pad for _, a, b in cells]
        sheet = Image.new('RGB', (width, sum(cell_heights) + 18), 'white')
        draw = ImageDraw.Draw(sheet)
        y = 6
        for (label, a, b), cell_h in zip(cells, cell_heights):
            height = max(a.height, b.height)
            a2 = a.resize((max(1, int(a.width*height/max(1, a.height))), height))
            b2 = b.resize((max(1, int(b.width*height/max(1, b.height))), height))
            draw.text((8, y+2), label, fill='black')
            sheet.paste(a2, (8, y+18))
            sheet.paste(b2, (width//2 + 8, y+18))
            y += cell_h
        name = f'{prefix}-{produced}.png'
        sheet.save(OUT/name)
        paths.append(name)
        produced += 1
    # Remove stale sheets beyond the freshly produced range.
    for stale in sorted(OUT.glob(f'{prefix}-*.png')):
        if stale.name not in paths:
            stale.unlink()
    return paths

sheet_rows = []
for c in cases:
    r = by_id.get(c['region_id'])
    if r and r['v2_id']:
        sheet_rows.append((r['historical_id'], f"case {c['id']} page {r['page']} — historical left / V2 right"))
known = {ident for ident, _ in sheet_rows}
for r in changed:
    if r['historical_id'] not in known:
        sheet_rows.append((r['historical_id'], f"{r['historical_id']} (page {r['page']}) changed — historical left / V2 right"))
sheets = contact_sheets(sheet_rows, 'contact-v2')

head = f'''<!doctype html><meta charset="utf-8"><title>Detector V2 review</title><style>body{{font:16px system-ui;margin:2rem;max-width:1200px}}.pair{{display:flex;gap:1rem;flex-wrap:wrap}}figure{{border:1px solid #ccc;padding:1rem}}img{{max-width:100%;height:auto}}pre{{white-space:pre-wrap;overflow-wrap:anywhere}}</style><h1>Detector V1 / V2 — provisional review</h1><p>Source {e(source_sha)} · extraction versions 1.0 (frozen historical output) and 2.0. Compare both crops against the full page. Do not treat valid geometry, model output, or provisional text as mathematical approval. Record qualified independent decisions in the linked template.</p><p>{len(legacy)} historical mathematics regions · {len(revised)} V2 mathematics regions · {len(changed)} changed · grouping census {e(json.dumps(grouping_census, sort_keys=True))} · assessments {e(json.dumps(assessment_census, sort_keys=True))}</p>'''
sheet_links = ' · '.join(f'<a href="{e(name)}">{e(name)}</a>' for name in sheets)
(OUT/'index.html').write_text(head + f'<p>Contact sheets: {sheet_links}</p>' + '<p><a href="census.html">All historical mathematics regions</a></p>' + ''.join(card(by_id[c['region_id']], c) for c in cases if c['region_id'] in by_id))
(OUT/'census.html').write_text(head + f'<p>Contact sheets: {sheet_links}</p>' + ''.join(card(r) for r in rows))
census = {'schema_version':'2.0','source_sha256':source_sha,
          'extraction_versions':{'historical':'1.0','updated':'2.0'},
          'legacy_math':len(legacy),'v2_math':len(revised),
          'grouping_census':grouping_census,
          'assessment_census':assessment_census,
          'unmapped_v2_math':[{'id':v['id'],'page':v['page'],'bbox':v['bbox'],'text':v['text']}
                              for v in unmapped],
          'regions':rows}
(OUT/'census.json').write_text(json.dumps(census, ensure_ascii=False, indent=2)+'\n')
print('legacy', len(legacy), 'v2', len(revised), 'mapped', sum(bool(r['v2_id']) for r in rows),
      'cases', sum(c['region_id'] in by_id for c in cases), 'changed', len(changed),
      'assessments', dict(sorted(assessment_census.items())),
      'grouping', dict(sorted(grouping_census.items())), 'sheets', sheets)
