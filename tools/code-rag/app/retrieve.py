from dataclasses import dataclass
from typing import Any

from qdrant_client.models import FieldCondition, Filter, MatchValue

from app.config import Settings, get_settings
from app.embeddings import EmbeddingProvider
from app.store import get_client


@dataclass(frozen=True)
class RetrievedChunk:
    score: float
    path: str
    start_line: int
    end_line: int
    text: str
    metadata: dict[str, Any]


def _metadata_filter(filters: dict[str, str] | None) -> Filter | None:
    if not filters:
        return None
    return Filter(
        must=[
            FieldCondition(key=key, match=MatchValue(value=value))
            for key, value in filters.items()
            if value is not None
        ]
    )


def query(
    question: str,
    filters: dict[str, str] | None = None,
    limit: int = 8,
    settings: Settings | None = None,
) -> list[RetrievedChunk]:
    settings = settings or get_settings()
    embedder = EmbeddingProvider(settings)
    client = get_client(settings)
    vector = embedder.embed_one(question)

    hits = client.search(
        collection_name=settings.qdrant_collection,
        query_vector=vector,
        query_filter=_metadata_filter(filters),
        limit=limit,
    )

    results: list[RetrievedChunk] = []
    for hit in hits:
        payload = hit.payload or {}
        results.append(
            RetrievedChunk(
                score=hit.score,
                path=str(payload.get("path", "")),
                start_line=int(payload.get("start_line", 1)),
                end_line=int(payload.get("end_line", 1)),
                text=str(payload.get("text", "")),
                metadata=payload,
            )
        )
    return results


def format_results(results: list[RetrievedChunk]) -> str:
    lines: list[str] = []
    for index, result in enumerate(results, start=1):
        lines.append(
            f"{index}. {result.path}:{result.start_line}-{result.end_line} "
            f"(score {result.score:.3f})"
        )
        lines.append(result.text.strip())
        lines.append("")
    return "\n".join(lines).strip()
