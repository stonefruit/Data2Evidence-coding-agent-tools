from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if len(PROJECT_ROOT.parents) > 1:
    TOOLS_REPO_ROOT = PROJECT_ROOT.parents[1]
    DEFAULT_D2E_REPO_PATH = TOOLS_REPO_ROOT.parent / "Data2Evidence"
else:
    DEFAULT_D2E_REPO_PATH = PROJECT_ROOT / "../../../Data2Evidence"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_ROOT / ".env", extra="ignore")

    d2e_repo_path: Path = Field(default=DEFAULT_D2E_REPO_PATH)
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "d2e_code_chunks"
    embedding_provider: str = "openai_compatible"
    embedding_model: str = "qwen3-embedding-0.6b-f16"
    embedding_base_url: str | None = "http://localhost:8080/v1"
    embedding_api_key: str | None = "local"
    embedding_dimensions: int = 1024
    embedding_append_eos: bool = True
    chunk_size: int = 1600
    chunk_overlap: int = 200
    max_file_bytes: int = 250_000

    @property
    def repo_path(self) -> Path:
        path = self.d2e_repo_path
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        return path.resolve()

    @property
    def manifest_collection(self) -> str:
        return f"{self.qdrant_collection}_manifest"


@lru_cache
def get_settings() -> Settings:
    return Settings()
