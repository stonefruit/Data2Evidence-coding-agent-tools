FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md constraints.txt ./
COPY app ./app
COPY scripts ./scripts
COPY tests ./tests

ENV PIP_CONSTRAINT=/app/constraints.txt

RUN pip install --no-cache-dir ".[dev]"

EXPOSE 8088

CMD ["uvicorn", "app.api:api", "--host", "0.0.0.0", "--port", "8088"]
