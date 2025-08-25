@echo off
echo Starting n8n server for GSTR2B automation...
echo.
echo Setting environment variables...
set N8N_PORT=5678
set N8N_HOST=127.0.0.1
set N8N_BASIC_AUTH_ACTIVE=false
set DB_SQLITE_POOL_SIZE=10
set N8N_RUNNERS_ENABLED=true
set N8N_LOG_LEVEL=info

echo.
echo Starting n8n on http://localhost:5678
echo Press Ctrl+C to stop the server
echo.

npx n8n start
