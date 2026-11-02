"""Offline, bounded research evaluation; never used by production ingestion."""
import hashlib,json,os,resource,signal,time,traceback
from pathlib import Path
from PIL import Image
R=Path('/dataset'); M=Path('/model'); OUT=Path('/output/codeformula.results.json')
REV='ecedbe111d15c2dc60bfd4a823cbe80127b58af4'; CHECK='4b04e77af34c4e682a7ab1617628340d658f3c3dcd12456dd2a7fff805cf79d2'
result={'status':'initializing','model':'docling-project/CodeFormulaV2','revision':REV,'checkpoint_sha256':CHECK,'device':'cpu','dtype':'bfloat16','generation':{'max_new_tokens':128,'do_sample':False,'timeout_seconds':40},'cases':[]}
if OUT.exists():
 previous=json.loads(OUT.read_text())
 if previous.get('revision')!=REV or previous.get('checkpoint_sha256')!=CHECK:
  raise RuntimeError('cannot resume results from a different checkpoint')
 result['cases']=previous.get('cases',[])
def save(): OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
def timeout(*args): raise TimeoutError('40 second per-crop limit')
signal.signal(signal.SIGALRM,timeout)
try:
 h=hashlib.sha256()
 with (M/'model.safetensors').open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 if h.hexdigest()!=CHECK: raise RuntimeError('checkpoint SHA-256 mismatch')
 import torch
 torch.set_num_threads(2); torch.manual_seed(42)
 t=time.perf_counter()
 from transformers import AutoProcessor,Idefics3ForConditionalGeneration
 processor=AutoProcessor.from_pretrained(str(M),local_files_only=True,trust_remote_code=False)
 model=Idefics3ForConditionalGeneration.from_pretrained(str(M),local_files_only=True,trust_remote_code=False,use_safetensors=True,torch_dtype=torch.bfloat16,attn_implementation='eager',low_cpu_mem_usage=True).eval()
 result['initialization_seconds']=round(time.perf_counter()-t,3); result['status']='running';save()
 cases=json.loads((R/'review/review-package.json').read_text())['cases']
 tasks=[(c['id'],'original',c['original_crop']) for c in cases]+[(c['id'],'candidate',c['candidate_crop']['crop']) for c in cases if c['candidate_crop']]
 completed={(c['id'],c['crop_variant']) for c in result['cases']}
 prompt=processor.apply_chat_template([{'role':'user','content':[{'type':'image'},{'type':'text','text':'<formula>'}]}],add_generation_prompt=True)
 for id,kind,crop in tasks:
  if (id,kind) in completed: continue
  start=time.perf_counter();cpu=time.process_time(); answer=None;error=None;tokens=None;truncated=None
  try:
   signal.alarm(40)
   image=Image.open(R/crop).convert('RGB')
   inputs=processor(text=prompt,images=[image],return_tensors='pt'); inputs={k:(v.to(dtype=torch.bfloat16) if k=='pixel_values' else v) for k,v in inputs.items()}
   with torch.inference_mode():
    generated=model.generate(**inputs,max_new_tokens=128,do_sample=False,use_cache=True)
   continuation=generated[:,inputs['input_ids'].shape[1]:];tokens=int(continuation.shape[1]);truncated=tokens>=128
   answer=processor.batch_decode(continuation,skip_special_tokens=True)[0]
  except Exception as exc:error=f'{type(exc).__name__}: {str(exc)[:300]}'
  finally:signal.alarm(0)
  result['cases'].append({'id':id,'crop_variant':kind,'crop':crop,'output':answer,'error':error,'generated_tokens':tokens,'possibly_truncated':truncated,'wall_seconds':round(time.perf_counter()-start,3),'cpu_seconds':round(time.process_time()-cpu,3),'peak_rss_kib':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss});save()
 result['status']='completed'
except Exception as exc:
 result['status']='initialization_failed'; result['error']=f'{type(exc).__name__}: {str(exc)[:500]}';result['traceback']=traceback.format_exc(limit=10)
finally:
 result['peak_rss_kib']=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss;save()
