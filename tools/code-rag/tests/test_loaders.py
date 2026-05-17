from pathlib import Path

from app.config import Settings
from app.loaders import should_index


def settings_for(repo_path: Path) -> Settings:
    return Settings(d2e_repo_path=repo_path, max_file_bytes=10_000)


def test_allows_high_signal_roots(tmp_path: Path) -> None:
    repo = tmp_path
    path = repo / "services" / "api" / "main.py"
    path.parent.mkdir(parents=True)
    path.write_text("print('ok')", encoding="utf-8")

    assert should_index(path, repo, settings_for(repo))


def test_allows_top_level_source_files(tmp_path: Path) -> None:
    repo = tmp_path
    path = repo / "test.ts"
    path.write_text("export const ok = true", encoding="utf-8")

    assert should_index(path, repo, settings_for(repo))


def test_excludes_top_level_hidden_files(tmp_path: Path) -> None:
    repo = tmp_path
    path = repo / ".hidden.ts"
    path.write_text("export const secret = true", encoding="utf-8")

    assert not should_index(path, repo, settings_for(repo))


def test_excludes_env_files(tmp_path: Path) -> None:
    repo = tmp_path
    path = repo / "services" / "api" / ".env"
    path.parent.mkdir(parents=True)
    path.write_text("SECRET=value", encoding="utf-8")

    assert not should_index(path, repo, settings_for(repo))


def test_excludes_node_modules(tmp_path: Path) -> None:
    repo = tmp_path
    path = repo / "plugins" / "ui" / "node_modules" / "pkg" / "index.js"
    path.parent.mkdir(parents=True)
    path.write_text("module.exports = {}", encoding="utf-8")

    assert not should_index(path, repo, settings_for(repo))
