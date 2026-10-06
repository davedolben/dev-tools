#!/usr/bin/env bash

set -e

cd frontend && npm install && npm run build
cd ../backend && uv run uvicorn app:app --port 8989

