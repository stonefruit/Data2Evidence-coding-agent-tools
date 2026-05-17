from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams

from app.config import Settings


def get_client(settings: Settings) -> QdrantClient:
    return QdrantClient(url=settings.qdrant_url)


def ensure_collection(client: QdrantClient, settings: Settings, vector_size: int) -> None:
    if client.collection_exists(settings.qdrant_collection):
        return
    client.create_collection(
        collection_name=settings.qdrant_collection,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )


def recreate_collection(client: QdrantClient, settings: Settings, vector_size: int) -> None:
    if client.collection_exists(settings.qdrant_collection):
        client.delete_collection(settings.qdrant_collection)
    client.create_collection(
        collection_name=settings.qdrant_collection,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )


def ensure_manifest_collection(client: QdrantClient, settings: Settings) -> None:
    if client.collection_exists(settings.manifest_collection):
        return
    client.create_collection(
        collection_name=settings.manifest_collection,
        vectors_config=VectorParams(size=1, distance=Distance.COSINE),
    )
