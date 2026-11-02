"""Research-only pix2tex run; use disposable CPU container and pinned weights."""
import json, os, resource, signal, time, traceback
from pathlib import Path
from PIL import Image
import torch

ROOT=Path(os.environ.get('FORMULA_DATASET','/dataset'))
OUT=Path(os.environ.get('FORMULA_RESULTS','/eval/results.json'))
def interrupted(signum, frame): raise TimeoutError('equation exceeded 30s')
signal.signal(signal.SIGALRM,interrupted)
torch.set_num_threads(2)
torch.manual_seed(42)
report={'model':'pix2tex 0.1.4, v0.0.1 weights','device':'cpu','cases':[],'annotation_status':'pending_review','limits':{'per_case_seconds':30,'cpu_threads':2,'memory_container_bytes':3221225472},'batch_support':'sequential; no native batch measurement'}
def save(): OUT.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
try:
 start=time.perf_counter()
 from pix2tex.cli import LatexOCR
 model=LatexOCR()
 report['initialization_seconds']=round(time.perf_counter()-start,3)
 for case in json.loads((ROOT/'dataset.json').read_text())['cases']:
  start=time.perf_counter(); cpu=time.process_time(); output=None; error=None
  try:
   image=Image.open(ROOT/case['crop']).convert('RGB'); signal.alarm(30); output=model(image)
  except Exception as exc: error=f'{type(exc).__name__}: {str(exc)[:300]}'
  finally: signal.alarm(0)
  report['cases'].append({'id':case['id'],'output':output,'error':error,'seconds':round(time.perf_counter()-start,3),'cpu_seconds':round(time.process_time()-cpu,3),'max_rss_kib':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss});save()
 report['status']='completed'
except Exception as exc:
 report['status']='initialization_failed';report['error']=f'{type(exc).__name__}: {str(exc)[:400]}';report['traceback']=traceback.format_exc(limit=8)
finally:
 report['peak_rss_kib']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;save()
