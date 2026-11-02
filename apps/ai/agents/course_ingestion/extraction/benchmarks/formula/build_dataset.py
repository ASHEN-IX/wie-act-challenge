"""Create an independently inspectable, provisional formula sample."""
import hashlib, json, sys
from pathlib import Path
import fitz
APP=Path(__file__).resolve().parents[5]
sys.path.insert(0,str(APP))
from agents.course_ingestion.extraction.pdf_loader import extract_pages_from_pdf_sandboxed
from agents.course_ingestion.extraction.layout import regions_from_pages
HERE=Path(__file__).resolve().parent
PDF=HERE.parent/'reference-course.pdf'
SAMPLES=[(0,'summation_scripts'),(1,'limits_summation'),(2,'quantifiers_inequality_mixed'),(5,'small_mixed'),(6,'integral'),(8,'multiline_mixed'),(10,'multiline_fraction'),(17,'limit_fraction'),(39,'fraction_limit'),(45,'definite_integral'),(47,'quantifiers_inequalities'),(54,'fraction_nested'),(63,'improper_integral'),(79,'mixed_text_math'),(83,'multiline_nested'),(84,'multiline_fraction')]

def main():
 regions=[x for x in regions_from_pages(extract_pages_from_pdf_sandboxed(str(PDF))) if x['type']=='math']
 output=[]
 with fitz.open(PDF) as pdf:
  for index,category in SAMPLES:
   r=regions[index]; page=pdf[r['page']-1]; box=fitz.Rect(r['bbox']); clip=(box+(-4,-4,4,4)) & page.rect
   path=HERE/'crops'/f"eq-{index:03d}.png"; page.get_pixmap(matrix=fitz.Matrix(2,2),clip=clip,alpha=False).save(path)
   output.append({'id':f'eq-{index:03d}','category':category,'document_sha256':hashlib.sha256(PDF.read_bytes()).hexdigest(),'page':r['page'],'region_id':r['id'],'region_bbox':r['bbox'],'crop_bbox':[round(x,2) for x in clip],'crop':str(path.relative_to(HERE)),'reviewer':None,'annotation_status':'pending_review','expected_expression':None,'expected_latex':r'S_n = \sum_{p=0}^{n} u_p' if index==0 else None,'baseline_text':r['text'],'recognition_output':None})
 (HERE/'dataset.json').write_text(json.dumps({'schema_version':'1.0.0','source':'reference-course.pdf','region_count':len(regions),'sampling':'purposive, not representative for accuracy','cases':output},ensure_ascii=False,indent=2)+'\n')
 print('regions',len(regions),'cases',len(output))
if __name__=='__main__':main()
