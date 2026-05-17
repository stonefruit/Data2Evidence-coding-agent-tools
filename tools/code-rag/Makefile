MODEL_DIR := ../../.models
MODEL_FILE := Qwen3-Embedding-0.6B-f16.gguf
MODEL_PATH := $(MODEL_DIR)/$(MODEL_FILE)
MODEL_URL := https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF/resolve/main/$(MODEL_FILE)
QDRANT_URL := http://qdrant:6333
QDRANT_COLLECTION := d2e_code_chunks
QDRANT_MANIFEST_COLLECTION := $(QDRANT_COLLECTION)_manifest
SNAPSHOT_DIR := snapshots

.PHONY: build changes check-embed config download-model export-snapshot import-snapshot qdrant query reindex stamp-manifest status sync test web

download-model:
	mkdir -p $(MODEL_DIR)
	curl -L --fail --continue-at - --output $(MODEL_PATH) $(MODEL_URL)

build:
	docker compose build code-rag

qdrant:
	docker compose up -d qdrant

export-snapshot: qdrant build
	docker compose run --rm code-rag python scripts/qdrant_snapshots.py export --qdrant-url $(QDRANT_URL) --snapshot-dir $(SNAPSHOT_DIR) --manifest-collection $(QDRANT_MANIFEST_COLLECTION) --collections $(QDRANT_COLLECTION) $(QDRANT_MANIFEST_COLLECTION)

import-snapshot: qdrant build
	test -n "$(bundle)"
	docker compose run --rm code-rag python scripts/qdrant_snapshots.py import --qdrant-url $(QDRANT_URL) --snapshot-dir $(SNAPSHOT_DIR) --bundle "$(bundle)"

config: build
	docker compose run --rm code-rag code-rag config

check-embed: build
	docker compose run --rm code-rag python -c "from app.config import get_settings; from app.embeddings import EmbeddingProvider; e=EmbeddingProvider(get_settings()); print(len(e.embed_one('Data2Evidence embedding smoke test')))"

sync: qdrant build
	docker compose run --rm code-rag code-rag sync

reindex: qdrant build
	docker compose run --rm code-rag code-rag reindex

stamp-manifest: qdrant build
	docker compose run --rm code-rag code-rag stamp-manifest

changes: qdrant build
	docker compose run --rm code-rag code-rag changes

status: qdrant build
	docker compose run --rm code-rag code-rag status

query: qdrant build
	docker compose run --rm code-rag code-rag query "$(q)"

web: qdrant build
	docker compose run --rm --service-ports code-rag code-rag serve --host 0.0.0.0 --port 8088

test: build
	docker compose run --rm code-rag pytest
