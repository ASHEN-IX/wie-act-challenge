import os,sys,json,time,uuid
from pathlib import Path
from dotenv import dotenv_values
root=Path(__file__).resolve().parents[3]
os.environ.update({k:v for k,v in dotenv_values(root/'apps/ai/.env').items() if v})
api=dotenv_values(root/'apps/api/.env')
os.environ['API_SERVICE_URL']='http://127.0.0.1:3001'
os.environ['INTERNAL_API_SECRET']=api['INTERNAL_API_SECRET']
os.environ['LLM_MOCK']='0'
sys.path.insert(0,str(root/'apps/ai'))
from utils import llm_client
from agents.visual_lab.planner import plan_lab
from agents.visual_lab.schemas import PlanRequest
approvals={a:{'approvalId':'report-eval-'+uuid.uuid4().hex,'task':a,'model':llm_client.agent_config(a).model,'expiresAt':time.time()+600,'maxRequests':3,'maxTokens':16000} for a in ['visual_lab_selector','visual_lab_planner']}
os.environ['LLM_APPROVALS_JSON']=json.dumps(approvals)
metrics=[]
original=llm_client.ask
import agents.visual_lab.planner as planner

def measured(agent,*args,**kwargs):
 kwargs['return_metadata']=True
 start=time.perf_counter()
 try:
  result=original(agent,*args,**kwargs)
  metrics.append({'agent':agent,'model':result.model,'tier':result.tier,'executionMode':result.execution_mode,'latencyMs':round((time.perf_counter()-start)*1000),'usage':result.usage,'cacheHit':result.cache_hit})
  return result
 except Exception as exc:
  metrics.append({'agent':agent,'latencyMs':round((time.perf_counter()-start)*1000),'errorType':type(exc).__name__})
  raise
planner.ask=measured
req=PlanRequest(mode='topic',concept='Shortest paths in a small positively weighted undirected graph')
result=plan_lab(req)
data={'scope':'live Groq Visual Lab workflow, synthetic topic, Python planning entrypoint','result':result.model_dump(),'calls':metrics,'approvedRequestLimitPerAgent':3}
# Expire approvals to exercise the actual unavailable path without provider calls.
for approval in approvals.values():approval['expiresAt']=time.time()-1
os.environ['LLM_APPROVALS_JSON']=json.dumps(approvals)
data['expiredApprovalResult']=plan_lab(req).model_dump()
path=root/'docs/submission/evidence/LIVE-INFERENCE-EVALUATION.json'
path.write_text(json.dumps(data,indent=2))
print(json.dumps({'status':result.status,'calls':metrics,'expiredStatus':data['expiredApprovalResult']['status']}))
