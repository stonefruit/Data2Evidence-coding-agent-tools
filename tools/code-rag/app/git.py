import subprocess
from dataclasses import dataclass

from app.config import Settings


def current_git_sha(settings: Settings) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(settings.repo_path), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.strip()


@dataclass(frozen=True)
class GitFileChange:
    status: str
    path: str
    old_path: str | None = None

    @property
    def is_delete(self) -> bool:
        return self.status.startswith("D")

    @property
    def is_rename(self) -> bool:
        return self.status.startswith("R")


def changed_files_since(
    settings: Settings,
    base_sha: str,
    target_ref: str = "HEAD",
) -> list[GitFileChange]:
    result = subprocess.run(
        [
            "git",
            "-C",
            str(settings.repo_path),
            "diff",
            "--name-status",
            "--find-renames",
            base_sha,
            target_ref,
        ],
        check=True,
        capture_output=True,
        text=True,
    )

    changes: list[GitFileChange] = []
    for line in result.stdout.splitlines():
        parts = line.split("\t")
        if not parts:
            continue

        status = parts[0]
        if status.startswith("R") and len(parts) == 3:
            changes.append(GitFileChange(status=status, old_path=parts[1], path=parts[2]))
        elif len(parts) >= 2:
            changes.append(GitFileChange(status=status, path=parts[1]))
    return changes
