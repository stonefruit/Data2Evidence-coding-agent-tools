from app.config import Settings


class EmbeddingProvider:
    def __init__(self, settings: Settings):
        self.provider = settings.embedding_provider.lower()
        self.model_name = settings.embedding_model
        self.base_url = settings.embedding_base_url
        self.api_key = settings.embedding_api_key or "local"
        self._dimensions = settings.embedding_dimensions
        self.append_eos = settings.embedding_append_eos

        if self.provider not in {"openai_compatible"}:
            raise ValueError("EMBEDDING_PROVIDER must be 'openai_compatible'")

    @property
    def client(self):
        from openai import OpenAI

        kwargs = {"api_key": self.api_key}
        if self.base_url:
            kwargs["base_url"] = self.base_url
        return OpenAI(**kwargs)

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def embed_one(self, text: str) -> list[float]:
        text = self._prepare_text(text)
        response = self.client.embeddings.create(input=text, model=self.model_name)
        return response.data[0].embedding

    def embed_many(self, texts: list[str]) -> list[list[float]]:
        texts = [self._prepare_text(text) for text in texts]
        response = self.client.embeddings.create(input=texts, model=self.model_name)
        return [item.embedding for item in response.data]

    def _prepare_text(self, text: str) -> str:
        if self.append_eos and not text.endswith("<|endoftext|>"):
            return f"{text}<|endoftext|>"
        return text
