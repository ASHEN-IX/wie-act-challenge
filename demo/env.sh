# Sourced by the demo scripts. Isolated ports and database; nothing here is a secret.
export DEMO_DB=noveris_demo
export DATABASE_URL=postgresql://ednova:ednova@127.0.0.1:5433/$DEMO_DB
export PORT=3101 CORS_ORIGIN=http://localhost:3100 FRONTEND_URL=http://localhost:3100 APP_URL=http://localhost:3100
export BETTER_AUTH_URL=http://localhost:3100 AUTH_TRUSTED_ORIGINS=http://localhost:3100
export BACKEND_URL=http://localhost:3101 NEXT_PUBLIC_WS_URL=ws://localhost:3101
export AI_SERVICE_URL=http://127.0.0.1:8100 API_SERVICE_URL=http://127.0.0.1:3101
export ALLOW_DEMO_COURSES=1
export DEMO_PY=${DEMO_PY:-$HOME/.cache/pypoetry/virtualenvs/study-partner-ai-NZ-4qBXI-py3.12/bin/python}
# Synthetic class so privacy-thresholded instructor insights can show numbers (k >= 5).
export DEMO_COHORT_SIZE=12 EDNOVA_ANALYTICS_MIN_COHORT=5
