import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.config import PROJECT_ROOT, Settings


CHECKPOINT_DIR = PROJECT_ROOT / "run-state"
CHECKPOINT_PATH = CHECKPOINT_DIR / "full-index-checkpoint.json"


def checkpoint_config(settings: Settings, git_sha: str | None) -> dict[str, Any]:
    return {
        "repo_path": str(settings.repo_path),
        "git_sha": git_sha,
        "collection": settings.qdrant_collection,
        "manifest_collection": settings.manifest_collection,
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
        "embedding_base_url": settings.embedding_base_url,
        "embedding_dimensions": settings.embedding_dimensions,
        "embedding_append_eos": settings.embedding_append_eos,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "max_file_bytes": settings.max_file_bytes,
    }


def read_checkpoint(settings: Settings, git_sha: str | None) -> dict[str, Any] | None:
    if not CHECKPOINT_PATH.exists():
        return None
    try:
        checkpoint = json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if checkpoint.get("config") != checkpoint_config(settings, git_sha):
        return None
    return checkpoint


def write_checkpoint(
    settings: Settings,
    *,
    git_sha: str | None,
    completed_files: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    checkpoint = {
        "config": checkpoint_config(settings, git_sha),
        "updated_at": datetime.now(UTC).isoformat(),
        "completed_files": completed_files,
    }
    temporary_path = CHECKPOINT_PATH.with_suffix(".tmp")
    temporary_path.write_text(json.dumps(checkpoint, indent=2, sort_keys=True), encoding="utf-8")
    temporary_path.replace(CHECKPOINT_PATH)
    return checkpoint


def clear_checkpoint() -> None:
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()
