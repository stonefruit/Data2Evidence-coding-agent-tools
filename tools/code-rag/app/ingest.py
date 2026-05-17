from collections.abc import Callable
from datetime import UTC, datetime
from hashlib import sha256
from time import sleep
from typing import TypeVar

from qdrant_client.http.exceptions import ResponseHandlingException
from qdrant_client.models import FieldCondition, Filter, MatchValue, PointStruct

from app.checkpoint import clear_checkpoint, read_checkpoint, write_checkpoint
from app.chunking import chunk_file
from app.config import Settings, get_settings
from app.embeddings import EmbeddingProvider
from app.git import changed_files_since, current_git_sha
from app.loaders import INDEXER_POLICY_VERSION, load_source_file, walk_source_files
from app.manifest import read_manifest, write_manifest
from app.store import ensure_collection, get_client, recreate_collection


T = TypeVar("T")


def _retry_qdrant(
    operation: Callable[[], T],
    *,
    action: str,
    progress: Callable[[str], None] | None = None,
    attempts: int = 3,
) -> T:
    for attempt in range(1, attempts + 1):
        try:
            return operation()
        except ResponseHandlingException as exc:
            if attempt == attempts:
                raise
            delay = attempt * 2
            if progress:
                progress(f"Qdrant {action} failed ({exc}); retrying in {delay}s")
            sleep(delay)
    raise RuntimeError(f"Qdrant {action} failed unexpectedly")


def delete_existing_chunks(
    client,
    settings: Settings,
    rel_path: str,
    progress: Callable[[str], None] | None = None,
) -> None:
    _retry_qdrant(
        lambda: client.delete(
            collection_name=settings.qdrant_collection,
            points_selector=Filter(
                must=[FieldCondition(key="path", match=MatchValue(value=rel_path))]
            ),
        ),
        action=f"delete for {rel_path}",
        progress=progress,
    )


def _upsert_source_file(
    client,
    settings: Settings,
    embedder: EmbeddingProvider,
    source,
    git_sha: str | None,
    progress: Callable[[str], None] | None = None,
) -> int:
    chunks = chunk_file(source, settings, git_sha=git_sha)
    delete_existing_chunks(client, settings, source.rel_path, progress=progress)
    if not chunks:
        return 0

    if progress:
        progress(f"Embedding {len(chunks)} chunk(s): {source.rel_path}")
    vectors = embedder.embed_many([chunk.content for chunk in chunks])
    points = [
        PointStruct(id=chunk.id, vector=vector, payload=chunk.payload)
        for chunk, vector in zip(chunks, vectors, strict=True)
    ]
    _retry_qdrant(
        lambda: client.upsert(collection_name=settings.qdrant_collection, points=points),
        action=f"upsert for {source.rel_path}",
        progress=progress,
    )
    return len(points)


def ingest(
    settings: Settings | None = None,
    progress: Callable[[str], None] | None = None,
    resume: bool = True,
) -> dict:
    settings = settings or get_settings()
    embedder = EmbeddingProvider(settings)
    client = get_client(settings)

    git_sha = current_git_sha(settings)
    indexed_files = 0
    indexed_chunks = 0
    sources = list(walk_source_files(settings))
    has_existing_collection = client.collection_exists(settings.qdrant_collection)
    checkpoint = read_checkpoint(settings, git_sha) if resume and has_existing_collection else None
    completed_files: dict[str, dict] = (
        dict(checkpoint.get("completed_files", {})) if checkpoint else {}
    )

    if checkpoint:
        if progress:
            progress(f"Resuming full index from checkpoint: {len(completed_files)} file(s) done")
        ensure_collection(client, settings, embedder.dimensions)
    else:
        recreate_collection(client, settings, embedder.dimensions)
        write_checkpoint(settings, git_sha=git_sha, completed_files={})

    if progress:
        progress(f"Full index starting: {len(sources)} file(s) from {settings.repo_path}")

    for index, source in enumerate(sources, start=1):
        source_hash = sha256(source.text.encode("utf-8")).hexdigest()
        completed = completed_files.get(source.rel_path)
        if completed and completed.get("content_hash") == source_hash:
            indexed_files += 1
            indexed_chunks += int(completed["chunks"])
            if progress:
                progress(f"Skipping completed {index}/{len(sources)}: {source.rel_path}")
            continue

        if progress:
            progress(f"Indexing {index}/{len(sources)}: {source.rel_path}")
        chunk_count = _upsert_source_file(
            client,
            settings,
            embedder,
            source,
            git_sha,
            progress=progress,
        )
        if chunk_count == 0:
            if progress:
                progress(f"Skipped empty file: {source.rel_path}")
            continue
        indexed_files += 1
        indexed_chunks += chunk_count
        completed_files[source.rel_path] = {
            "chunks": chunk_count,
            "content_hash": source_hash,
            "completed_at": datetime.now(UTC).isoformat(),
        }
        write_checkpoint(settings, git_sha=git_sha, completed_files=completed_files)
        if progress:
            progress(f"Indexed {source.rel_path}: {chunk_count} chunk(s)")

    manifest = write_manifest(
        client,
        settings,
        git_sha=git_sha,
        files=indexed_files,
        chunks=indexed_chunks,
        mode="full",
    )

    if progress:
        progress(f"Full index complete: {indexed_files} file(s), {indexed_chunks} chunk(s)")
    clear_checkpoint()

    return {
        "collection": settings.qdrant_collection,
        "repo_path": str(settings.repo_path),
        "git_sha": git_sha,
        "files": indexed_files,
        "chunks": indexed_chunks,
        "manifest": manifest,
    }


def _manifest_config_matches(manifest: dict | None, settings: Settings) -> bool:
    if not manifest:
        return False
    expected = {
        "embedding_provider": settings.embedding_provider,
        "embedding_model": settings.embedding_model,
        "embedding_dimensions": settings.embedding_dimensions,
        "embedding_append_eos": settings.embedding_append_eos,
        "chunk_size": settings.chunk_size,
        "chunk_overlap": settings.chunk_overlap,
        "max_file_bytes": settings.max_file_bytes,
        "indexer_policy_version": INDEXER_POLICY_VERSION,
    }
    return all(manifest.get(key) == value for key, value in expected.items())


def _apply_incremental_changes(
    client,
    settings: Settings,
    embedder: EmbeddingProvider,
    *,
    indexed_sha: str,
    current_sha: str,
    progress: Callable[[str], None] | None = None,
) -> dict:
    changes = changed_files_since(settings, indexed_sha, "HEAD")
    if progress:
        progress(f"Incremental sync starting: {len(changes)} changed file(s)")
    reindexed_files = 0
    reindexed_chunks = 0
    deleted_files = 0
    skipped_files = 0
    touched_paths: set[str] = set()

    for index, change in enumerate(changes, start=1):
        if progress:
            progress(f"Processing change {index}/{len(changes)}: {change.status} {change.path}")
        if change.old_path and change.old_path not in touched_paths:
            if progress:
                progress(f"Deleting chunks for renamed path: {change.old_path}")
            delete_existing_chunks(client, settings, change.old_path, progress=progress)
            touched_paths.add(change.old_path)
            deleted_files += 1

        if change.is_delete:
            if change.path not in touched_paths:
                if progress:
                    progress(f"Deleting chunks for removed file: {change.path}")
                delete_existing_chunks(client, settings, change.path, progress=progress)
                touched_paths.add(change.path)
                deleted_files += 1
            continue

        source = load_source_file(change.path, settings)
        if source is None:
            if progress:
                progress(f"Skipping non-indexable file and deleting old chunks: {change.path}")
            delete_existing_chunks(client, settings, change.path, progress=progress)
            skipped_files += 1
            continue

        chunk_count = _upsert_source_file(
            client,
            settings,
            embedder,
            source,
            current_sha,
            progress=progress,
        )
        touched_paths.add(change.path)
        if chunk_count == 0:
            if progress:
                progress(f"Skipped empty file: {change.path}")
            skipped_files += 1
            continue
        reindexed_files += 1
        reindexed_chunks += chunk_count
        if progress:
            progress(f"Reindexed {change.path}: {chunk_count} chunk(s)")

    return {
        "changed_files": len(changes),
        "reindexed_files": reindexed_files,
        "reindexed_chunks": reindexed_chunks,
        "deleted_files": deleted_files,
        "skipped_files": skipped_files,
    }


def sync(
    settings: Settings | None = None,
    progress: Callable[[str], None] | None = None,
) -> dict:
    settings = settings or get_settings()
    embedder = EmbeddingProvider(settings)
    client = get_client(settings)
    ensure_collection(client, settings, embedder.dimensions)

    manifest = read_manifest(client, settings)
    indexed_sha = manifest.get("git_sha") if manifest else None
    current_sha = current_git_sha(settings)

    if not indexed_sha:
        if progress:
            progress("No existing index manifest; running a full index.")
        return {
            "mode": "full",
            "reason": "no existing index manifest",
            "result": ingest(settings, progress=progress),
        }
    if not current_sha:
        if progress:
            progress("Could not determine target repo HEAD; running a full index.")
        return {
            "mode": "full",
            "reason": "could not determine target repo HEAD",
            "result": ingest(settings, progress=progress),
        }
    if not _manifest_config_matches(manifest, settings):
        if progress:
            progress("Embedding, chunking, or indexer config changed; running a full index.")
        return {
            "mode": "full",
            "reason": "embedding, chunking, or indexer config changed",
            "result": ingest(settings, progress=progress),
        }

    if indexed_sha == current_sha:
        if progress:
            progress(f"Index already matches HEAD {current_sha}.")
        return {
            "mode": "incremental",
            "in_sync": True,
            "git_sha": current_sha,
            "changed_files": 0,
            "reindexed_files": 0,
            "deleted_files": 0,
            "skipped_files": 0,
        }

    change_result = _apply_incremental_changes(
        client,
        settings,
        embedder,
        indexed_sha=indexed_sha,
        current_sha=current_sha,
        progress=progress,
    )

    total_files = sum(1 for _ in walk_source_files(settings))
    collection_info = client.get_collection(settings.qdrant_collection)
    total_chunks = collection_info.points_count or 0
    new_manifest = write_manifest(
        client,
        settings,
        git_sha=current_sha,
        files=total_files,
        chunks=total_chunks,
        mode="incremental",
        extra={
            "base_git_sha": indexed_sha,
            **change_result,
        },
    )

    if progress:
        progress(
            "Incremental sync complete: "
            f"{change_result['reindexed_files']} reindexed, "
            f"{change_result['deleted_files']} deleted, "
            f"{change_result['skipped_files']} skipped"
        )

    return {
        "mode": "incremental",
        "collection": settings.qdrant_collection,
        "repo_path": str(settings.repo_path),
        "base_git_sha": indexed_sha,
        "git_sha": current_sha,
        **change_result,
        "manifest": new_manifest,
    }
