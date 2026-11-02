"""Adversarial crop sanity checks; research only."""
import json, os, resource, signal, time
from pathlib import Path
from PIL import Image, ImageFilter
import torch
ROOT=Path(os.getenv('FORMULA_DATASET','/dataset')); OUT=Path('/eval/stress.json')
torch.set_num_threads(2); torch.manual_seed(42)
def timeout(signum, frame): raise TimeoutError('30 seconds')
signal.signal(signal.SIGALRM, timeout)
result={'cases':[],'device':'cpu'}
try:
 start=time.perf_counter(); from pix2tex.cli import LatexOCR
 model=LatexOCR(); result['initialization_seconds']=round(time.perf_counter()-start,3)
 first=Image.open(ROOT/'crops/eq-000.png').convert('RGB')
 variants=[('small',first.resize((max(1,first.width//4),max(1,first.height//4)))),('blurred',first.filter(ImageFilter.GaussianBlur(3))),('clipped',first.crop((0,0,first.width//2,first.height))),('blank',Image.new('RGB',(200,80),'white')),('multiline',Image.open(ROOT/'crops/eq-083.png').convert('RGB')),('malformed',None)]
 for name,img in variants:
  start=time.perf_counter();cpu=time.process_time();text=None;error=None
  try:
   if img is None: raise ValueError('invalid image input')
   signal.alarm(30);text=model(img)
  except Exception as exc:error=type(exc).__name__+': '+str(exc)[:200]
  finally:signal.alarm(0)
  result['cases'].append({'name':name,'output':text,'error':error,'seconds':round(time.perf_counter()-start,3),'cpu_seconds':round(time.process_time()-cpu,3)});OUT.write_text(json.dumps(result,indent=2)+'\n')
 result['status']='completed'
except Exception as exc:result.update(status='initialization_failed',error=repr(exc))
finally:result['peak_rss_kib']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;OUT.write_text(json.dumps(result,indent=2)+'\n')
