"""Review artifacts must preserve source identity and never invent approval."""
import hashlib,json
from pathlib import Path
import fitz

ROOT=Path(__file__).parents[1]/'extraction'/'benchmarks'/'formula'

def test_all_cases_have_source_and_pending_independent_decisions():
 package=json.loads((ROOT/'review/review-package.json').read_text())
 decisions=json.loads((ROOT/'review/decisions.template.json').read_text())
 assert len(package['cases'])==16
 assert {x['id'] for x in package['cases']}=={x['id'] for x in decisions['cases']}
 assert all(x['status']=='pending_review' and x['reviewer'] is None for x in decisions['cases'])
 assert all(x['annotation_status']=='pending_review' and x['provisional_latex'] for x in package['cases'])
 with fitz.open(ROOT.parent/'reference-course.pdf') as pdf:
  for row in package['cases']:
   assert (ROOT/row['original_crop']).is_file()
   assert (ROOT/row['page_image']).is_file()
   candidate=row['candidate_crop']
   if candidate:
    image=ROOT/candidate['crop']
    assert hashlib.sha256(image.read_bytes()).hexdigest()==candidate['sha256']
    assert pdf[row['page']-1].rect.contains(fitz.Rect(candidate['bbox']))
    assert candidate['status']=='candidate_unverified'
