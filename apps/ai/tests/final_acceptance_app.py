"""QA process only: real application, source/FAISS services; mock only Gemini SDK.

Never import this entrypoint in production. No real provider credential is used.
"""
import os
if os.environ.get('EDNOVA_FINAL_QA') != '1' or not os.environ.get('DB_NAME', '').startswith('test_formula_final_'):
    raise RuntimeError('Isolated QA controls required')
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from google import genai
from services.api.routers import formula_recognition as transport

# Reuse previously authorized offline outputs. The model transport receives real crops.
package = Path('agents/course_ingestion/extraction/benchmarks/formula')
outputs = [json.loads(line) for line in (package / 'gemini-2.5-flash.research.jsonl').read_text().splitlines()]
by_region = {o['proposal']['source']['region_id']: o['proposal']['response'] for o in outputs if o.get('proposal')}
# The offline outputs are fixtures; map the same three source images onto the
# versioned detector identities used by newly ingested QA revisions.
for old_id, new_id in {
    'region_22d55ef3c62c7aefa2da': 'region_1e2aeb86289d9d44e7c0',
    'region_76765c6249290c3b8651': 'region_aec9301c4a673be7a909',
    'region_5ca30cfdf0504e0e00de': 'region_43d9fa3583e1890b41fa',
}.items():
    by_region[new_id] = by_region[old_id]
responses = {}
inspect_original = transport.region_inspect

def inspect(req):
    region = inspect_original(req)
    for raw_id, response in by_region.items():
        scoped = 'region_' + hashlib.sha256((req.documentId + '\x1f' + raw_id).encode()).hexdigest()[:20]
        if req.regionId == scoped:
            responses[region['cropHash']] = response
    return region
transport.region_inspect = inspect

class SDK:
    def __init__(self, **kwargs):
        if kwargs.get('api_key') != 'isolated-qa-never-sent':
            raise RuntimeError('Non-QA credential')
        self.models = self
    def generate_content(self, **kwargs):
        data = kwargs['contents'][1].inline_data.data
        response = responses.get('sha256:' + hashlib.sha256(data).hexdigest())
        if response is None:
            raise RuntimeError('No offline proposal for selected crop')
        return SimpleNamespace(text=json.dumps(response), model_version='offline-replay-not-live-gemini', usage_metadata=SimpleNamespace(total_token_count=100))
    def close(self):
        pass

genai.Client = SDK
from services.api.main import app
