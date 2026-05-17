import json

import typer
import uvicorn

from app.config import get_settings
from app.git import changed_files_since
from app.ingest import ingest as run_ingest
from app.ingest import sync as run_sync
from app.manifest import index_status, read_manifest, stamp_current_manifest
from app.retrieve import format_results, query as run_query
from app.store import get_client


app = typer.Typer(help="Data2Evidence code RAG tooling.")


def progress(message: str) -> None:
    typer.echo(message, err=True)


@app.command()
def reindex() -> None:
    """Force a full rebuild of the Qdrant index."""
    result = run_ingest(progress=progress)
    typer.echo(json.dumps(result, indent=2))


@app.command()
def sync() -> None:
    """Bring the index up to date, using incremental updates when possible."""
    result = run_sync(progress=progress)
    typer.echo(json.dumps(result, indent=2))


@app.command()
def changes() -> None:
    """List Data2Evidence files changed since the indexed commit."""
    settings = get_settings()
    manifest = read_manifest(get_client(settings), settings)
    indexed_sha = manifest.get("git_sha") if manifest else None
    if not indexed_sha:
        typer.echo(json.dumps({"error": "no existing index manifest"}, indent=2))
        raise typer.Exit(code=1)

    result = [
        {
            "status": change.status,
            "path": change.path,
            "old_path": change.old_path,
            "is_delete": change.is_delete,
            "is_rename": change.is_rename,
        }
        for change in changed_files_since(settings, indexed_sha)
    ]
    typer.echo(json.dumps(result, indent=2))


@app.command()
def query(
    question: str,
    module: str | None = typer.Option(None, help="Filter by module, for example plugins/ui."),
    language: str | None = typer.Option(None, help="Filter by language, for example ts."),
    limit: int = typer.Option(8, min=1, max=25),
) -> None:
    """Retrieve source chunks for an engineering question."""
    filters = {
        key: value
        for key, value in {"module": module, "language": language}.items()
        if value
    }
    results = run_query(question, filters=filters or None, limit=limit)
    typer.echo(format_results(results))


@app.command()
def status() -> None:
    """Show whether the Qdrant index matches the current Data2Evidence commit."""
    typer.echo(json.dumps(index_status(), indent=2))


@app.command()
def stamp_manifest() -> None:
    """Repair the index manifest for an already-built collection."""
    try:
        result = stamp_current_manifest()
    except RuntimeError as exc:
        typer.echo(json.dumps({"error": str(exc)}, indent=2))
        raise typer.Exit(code=1) from exc
    typer.echo(json.dumps(result, indent=2))


@app.command()
def serve(
    host: str = typer.Option("127.0.0.1"),
    port: int = typer.Option(8088),
    reload: bool = typer.Option(False, help="Reload the API server when source files change."),
) -> None:
    """Run the local HTTP API and web search UI."""
    uvicorn.run("app.api:api", host=host, port=port, reload=reload)


@app.command()
def config() -> None:
    """Print resolved runtime configuration."""
    settings = get_settings()
    typer.echo(
        json.dumps(
            {
                "repo_path": str(settings.repo_path),
                "qdrant_url": settings.qdrant_url,
                "qdrant_collection": settings.qdrant_collection,
                "manifest_collection": settings.manifest_collection,
                "embedding_provider": settings.embedding_provider,
                "embedding_model": settings.embedding_model,
                "embedding_base_url": settings.embedding_base_url,
                "embedding_dimensions": settings.embedding_dimensions,
                "embedding_append_eos": settings.embedding_append_eos,
                "chunk_size": settings.chunk_size,
                "chunk_overlap": settings.chunk_overlap,
                "max_file_bytes": settings.max_file_bytes,
            },
            indent=2,
        )
    )
