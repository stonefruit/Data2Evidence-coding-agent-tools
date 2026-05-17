from datetime import UTC, datetime
from time import sleep
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import ResponseHandlingException
from qdrant_client.models import PointStruct

from app.config import Settings
from app.git import current_git_sha
from app.loaders import INDEXER_POLICY_VERSION, walk_source_files
from app.store import ensure_manifest_collection, get_client


MANIFEST_POINT_ID = 1


def _upsert_manifest_with_retry(
    client: QdrantClient,
    settings: Settings,
    point: PointStruct,
) -> None:
    for attempt in range(1, 4):
        try:
            client.upsert(collection_name=settings.manifest_collection, points=[point])
            return
        except ResponseHandlingException:
            if attempt == 3:
                raise
            sleep(attempt * 2)


def write_manifest(
    client: QdrantClient,
    settings: Settings,
    *,
    git_sha: str | None,
    files: int,
    chunks: int,
    mode: str,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ensure_manifest_collection(client, settings)
    manifest = {
        "repo_path": str(settings.repo_path),
        "git_sha": git_sha,
        "collection": settings.qdrant_collection,
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
        "embedding_base_url": settings.embedding_base_url,
        "embedding_dimensions": settings.embedding_dimensions,
        "embedding_append_eos": settings.embedding_append_eos,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "max_file_bytes": settings.max_file_bytes,
        "indexer_policy_version": INDEXER_POLICY_VERSION,
        "files": files,
        "chunks": chunks,
        "mode": mode,
        "indexed_at": datetime.now(UTC).isoformat(),
    }
    if extra:
        manifest.update(extra)
    _upsert_manifest_with_retry(
        client,
        settings,
        PointStruct(id=MANIFEST_POINT_ID, vector=[0.0], payload=manifest),
    )
    return manifest


def read_manifest(
    client: QdrantClient | None = None,
    settings: Settings | None = None,
) -> dict[str, Any] | None:
    from app.config import get_settings

    settings = settings or get_settings()
    client = client or get_client(settings)
    if not client.collection_exists(settings.manifest_collection):
        return None

    records = client.retrieve(
        collection_name=settings.manifest_collection,
        ids=[MANIFEST_POINT_ID],
    )
    if not records:
        return None
    return records[0].payload or {}


def index_status(settings: Settings | None = None) -> dict[str, Any]:
    from app.config import get_settings

    settings = settings or get_settings()
    client = get_client(settings)
    manifest = read_manifest(client, settings)
    current_sha = current_git_sha(settings)
    indexed_sha = manifest.get("git_sha") if manifest else None
    return {
        "repo_path": str(settings.repo_path),
        "collection": settings.qdrant_collection,
        "manifest_collection": settings.manifest_collection,
        "current_git_sha": current_sha,
        "indexed_git_sha": indexed_sha,
        "in_sync": bool(current_sha and indexed_sha and current_sha == indexed_sha),
        "manifest": manifest,
    }


def stamp_current_manifest(settings: Settings | None = None) -> dict[str, Any]:
    from app.config import get_settings

    settings = settings or get_settings()
    client = get_client(settings)
    git_sha = current_git_sha(settings)
    if not git_sha:
        raise RuntimeError(f"Could not determine git SHA for {settings.repo_path}")
    collection_info = client.get_collection(settings.qdrant_collection)
    chunks = collection_info.points_count or 0
    files = sum(1 for _ in walk_source_files(settings))
    return write_manifest(
        client,
        settings,
        git_sha=git_sha,
        files=files,
        chunks=chunks,
        mode="stamp",
        extra={"stamped_without_reindex": True},
    )
