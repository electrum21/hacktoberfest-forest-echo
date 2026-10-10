# Stage 1: fetch the BirdNET models for on-device mode (about 67 MB, CC BY-NC-SA 4.0).
# Skip it with --build-arg FETCH_MODELS=false (on Render: set the FETCH_MODELS env var to false).
FROM python:3.11-slim AS models
ARG FETCH_MODELS=true
WORKDIR /build
COPY api/scripts/fetch_ondevice_assets.py /build/api/scripts/fetch_ondevice_assets.py
RUN mkdir -p /out && if [ "$FETCH_MODELS" = "true" ]; then \
      pip install --no-cache-dir ai-edge-litert flatbuffers numpy && \
      python /build/api/scripts/fetch_ondevice_assets.py --out /out; \
    fi

# Stage 2: the app. The build-time tools above are not included.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api /app/api
COPY web /app/web
COPY --from=models /out /app/web/models
ENV PYTHONPATH=/app/api
CMD ["sh","-c","uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
