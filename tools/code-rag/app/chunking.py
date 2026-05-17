from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from langchain_text_splitters import Language, RecursiveCharacterTextSplitter

from app.config import Settings
from app.loaders import SourceFile


LANGUAGE_BY_SUFFIX = {
    ".py": Language.PYTHON,
    ".ts": Language.TS,
    ".tsx": Language.TS,
    ".js": Language.JS,
    ".jsx": Language.JS,
    ".md": Language.MARKDOWN,
    ".html": Language.HTML,
}


@dataclass(frozen=True)
class CodeChunk:
    id: str
    content: str
    payload: dict


def module_for_path(rel_path: str) -> str:
    parts = rel_path.split("/")
    if len(parts) >= 2 and parts[0] in {"plugins", "services"}:
        return "/".join(parts[:2])
    return parts[0]


def language_for_path(path: Path) -> str:
    if path.name == "Dockerfile":
        return "dockerfile"
    suffix = path.suffix.lower().lstrip(".")
    return suffix or "text"


def _splitter_for(path: Path, settings: Settings) -> RecursiveCharacterTextSplitter:
    language = LANGUAGE_BY_SUFFIX.get(path.suffix.lower())
    if language is None:
        return RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
    return RecursiveCharacterTextSplitter.from_language(
        language=language,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )


def _line_span(text: str, chunk: str, search_start: int) -> tuple[int, int, int]:
    index = text.find(chunk, search_start)
    if index == -1:
        index = text.find(chunk)
    if index == -1:
        return 1, max(1, chunk.count("\n") + 1), search_start

    start_line = text.count("\n", 0, index) + 1
    end_line = start_line + chunk.count("\n")
    return start_line, end_line, index + len(chunk)


def chunk_file(
    source: SourceFile,
    settings: Settings,
    git_sha: str | None = None,
) -> list[CodeChunk]:
    splitter = _splitter_for(source.path, settings)
    chunks = splitter.split_text(source.text)
    content_hash = sha256(source.text.encode("utf-8")).hexdigest()
    search_start = 0
    results: list[CodeChunk] = []

    for index, content in enumerate(chunks):
        start_line, end_line, search_start = _line_span(source.text, content, search_start)
        chunk_key = f"data2evidence-code-rag:{source.rel_path}:{index}:{content_hash}"
        chunk_id = str(uuid5(NAMESPACE_URL, chunk_key))
        results.append(
            CodeChunk(
                id=chunk_id,
                content=content,
                payload={
                    "path": source.rel_path,
                    "language": language_for_path(source.path),
                    "module": module_for_path(source.rel_path),
                    "start_line": start_line,
                    "end_line": end_line,
                    "git_sha": git_sha,
                    "content_hash": content_hash,
                    "chunk_index": index,
                    "text": content,
                },
            )
        )
    return results
