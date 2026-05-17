from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from app.config import Settings


ALLOWED_ROOTS = {
    "services",
    "plugins",
    "scripts",
    "internal",
}

ALLOWED_FILES = {
    "README.md",
    "env-vars.md",
    "docker-compose.yml",
    "docker-compose-local.yml",
}

ALLOWED_ROOT_SUFFIXES = {
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".properties",
    ".py",
    ".toml",
    ".ts",
    ".tsx",
    ".yaml",
    ".yml",
}

INDEXER_POLICY_VERSION = 2

EXCLUDED_DIRS = {
    ".git",
    ".idea",
    ".next",
    ".nuxt",
    ".pytest_cache",
    ".ruff_cache",
    ".turbo",
    ".venv",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "vendor",
}

EXCLUDED_NAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "poetry.lock",
    "uv.lock",
    "yarn.lock",
}

EXCLUDED_SUFFIXES = {
    ".7z",
    ".avif",
    ".bin",
    ".bmp",
    ".bz2",
    ".cert",
    ".crt",
    ".der",
    ".dll",
    ".dylib",
    ".gif",
    ".gz",
    ".har",
    ".ico",
    ".jpeg",
    ".jpg",
    ".key",
    ".lock",
    ".mp4",
    ".pdf",
    ".pem",
    ".png",
    ".pyc",
    ".so",
    ".sqlite",
    ".tar",
    ".tiff",
    ".webp",
    ".zip",
}


@dataclass(frozen=True)
class SourceFile:
    path: Path
    rel_path: str
    text: str


def should_index(path: Path, repo_path: Path, settings: Settings) -> bool:
    if not path.is_file():
        return False

    rel = path.relative_to(repo_path)
    parts = rel.parts
    name = path.name

    if any(part in EXCLUDED_DIRS for part in parts):
        return False
    if name in EXCLUDED_NAMES or name.startswith(".env"):
        return False
    if path.suffix.lower() in EXCLUDED_SUFFIXES:
        return False
    is_allowed_root_file = (
        len(parts) == 1
        and not name.startswith(".")
        and path.suffix.lower() in ALLOWED_ROOT_SUFFIXES
    )
    if (
        rel.as_posix() not in ALLOWED_FILES
        and parts[0] not in ALLOWED_ROOTS
        and not is_allowed_root_file
    ):
        return False
    if path.stat().st_size > settings.max_file_bytes:
        return False
    return True


def walk_source_files(settings: Settings) -> Iterator[SourceFile]:
    repo_path = settings.repo_path
    for path in sorted(repo_path.rglob("*")):
        if not should_index(path, repo_path, settings):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if text.strip():
            yield SourceFile(path=path, rel_path=path.relative_to(repo_path).as_posix(), text=text)


def load_source_file(rel_path: str, settings: Settings) -> SourceFile | None:
    repo_path = settings.repo_path
    path = (repo_path / rel_path).resolve()

    try:
        path.relative_to(repo_path)
    except ValueError:
        return None

    if not should_index(path, repo_path, settings):
        return None

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None

    if not text.strip():
        return None
    return SourceFile(path=path, rel_path=path.relative_to(repo_path).as_posix(), text=text)
