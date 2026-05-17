from __future__ import annotations

import argparse
import json
import posixpath
import shutil
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from time import sleep
from urllib.parse import quote
from urllib.request import Request, urlopen


MANIFEST_POINT_ID = 1


def with_retries(action: str, callback, attempts: int = 5):
    for attempt in range(1, attempts + 1):
        try:
            return callback()
        except OSError as exc:
            if attempt == attempts:
                raise
            delay = attempt * 2
            print(f"{action} failed ({exc}); retrying in {delay}s")
            sleep(delay)
    raise RuntimeError(f"{action} failed unexpectedly")


def request_json(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"content-type": "application/json"} if body is not None else {}
    request = Request(url, data=data, headers=headers, method=method)
    return with_retries(
        f"{method} {url}",
        lambda: _request_json(request),
    )


def _request_json(request: Request) -> dict:
    with urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def request_text(method: str, url: str) -> str:
    request = Request(url, method=method)
    return with_retries(
        f"{method} {url}",
        lambda: _request_text(request),
    )


def _request_text(request: Request) -> str:
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def download(url: str, path: Path) -> None:
    def _download() -> None:
        with urlopen(url, timeout=300) as response:
            path.write_bytes(response.read())

    with_retries(f"download {url}", _download)


def wait_for_qdrant(qdrant_url: str) -> None:
    print("Waiting for Qdrant")
    request_text("GET", f"{qdrant_url}/healthz")


def safe_extract(tar: tarfile.TarFile, target: Path) -> None:
    target = target.resolve()
    for member in tar.getmembers():
        destination = (target / member.name).resolve()
        if target not in destination.parents and destination != target:
            raise RuntimeError(f"Refusing unsafe tar member: {member.name}")
    tar.extractall(target)


def find_metadata(extract_dir: Path) -> Path:
    matches = list(extract_dir.glob("**/metadata.json"))
    if len(matches) != 1:
        raise RuntimeError(f"Expected one metadata.json in {extract_dir}, found {len(matches)}")
    return matches[0]


def manifest_collection(collections: list[str], configured: str | None) -> str | None:
    if configured:
        return configured
    matches = [collection for collection in collections if collection.endswith("_manifest")]
    return matches[0] if matches else None


def indexed_git_sha(qdrant_url: str, collection: str | None) -> str | None:
    if not collection:
        return None
    try:
        response = request_json(
            "POST",
            f"{qdrant_url}/collections/{quote(collection)}/points",
            {"ids": [MANIFEST_POINT_ID], "with_payload": True, "with_vector": False},
        )
    except Exception as exc:
        print(f"Could not read indexed git SHA from {collection}: {exc}")
        return None

    records = response.get("result") or []
    if not records:
        return None
    payload = records[0].get("payload") or {}
    value = payload.get("git_sha")
    return value if isinstance(value, str) and value else None


def git_sha_slug(git_sha: str | None) -> str:
    if not git_sha:
        return "no-git-sha"
    safe = "".join(char for char in git_sha if char.isalnum())
    return safe[:12] or "no-git-sha"


def export_snapshot(args: argparse.Namespace) -> None:
    wait_for_qdrant(args.qdrant_url)
    snapshot_dir = Path(args.snapshot_dir)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    git_sha = indexed_git_sha(
        args.qdrant_url,
        manifest_collection(args.collections, args.manifest_collection),
    )
    git_sha_short = git_sha_slug(git_sha)
    work_dir = snapshot_dir / f"data2evidence-code-rag-qdrant-{git_sha_short}-{timestamp}"
    work_dir.mkdir(parents=True, exist_ok=True)

    snapshots = []
    for collection in args.collections:
        print(f"Creating Qdrant snapshot for {collection}")
        snapshot_info = request_json(
            "POST",
            f"{args.qdrant_url}/collections/{quote(collection)}/snapshots?wait=true",
        )["result"]
        snapshot_name = snapshot_info["name"]
        file_name = f"{collection}.snapshot"
        output_path = work_dir / file_name
        print(f"Downloading {collection} snapshot to {output_path}")
        download(
            f"{args.qdrant_url}/collections/{quote(collection)}/snapshots/{quote(snapshot_name)}",
            output_path,
        )
        snapshots.append(
            {
                "collection": collection,
                "file": file_name,
                "qdrant_snapshot_name": snapshot_name,
                "size": output_path.stat().st_size,
                "checksum": snapshot_info.get("checksum"),
            }
        )

    metadata = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "indexed_git_sha": git_sha,
        "indexed_git_sha_short": git_sha_short,
        "qdrant_url": args.qdrant_url,
        "snapshots": snapshots,
    }
    (work_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    bundle_path = snapshot_dir / f"{work_dir.name}.tgz"
    print(f"Writing bundle {bundle_path}")
    with tarfile.open(bundle_path, "w:gz") as tar:
        tar.add(work_dir, arcname=work_dir.name)
    shutil.rmtree(work_dir)
    print(bundle_path)


def import_snapshot(args: argparse.Namespace) -> None:
    wait_for_qdrant(args.qdrant_url)
    snapshot_dir = Path(args.snapshot_dir).resolve()
    qdrant_snapshot_dir = Path(args.qdrant_snapshot_dir).resolve()
    bundle = Path(args.bundle)
    if not bundle.exists():
        raise RuntimeError(f"Snapshot bundle does not exist: {bundle}")

    extract_dir = qdrant_snapshot_dir / "imported" / bundle.stem.replace(".tar", "")
    extract_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(bundle, "r:gz") as tar:
        safe_extract(tar, extract_dir)

    metadata_path = find_metadata(extract_dir)
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    root_dir = metadata_path.parent

    for snapshot in metadata["snapshots"]:
        collection = snapshot["collection"]
        snapshot_path = (root_dir / snapshot["file"]).resolve()
        relative = snapshot_path.relative_to(qdrant_snapshot_dir).as_posix()
        qdrant_path = posixpath.join("/qdrant/snapshots", relative)
        print(f"Restoring {collection} from {snapshot_path}")
        request_json(
            "PUT",
            f"{args.qdrant_url}/collections/{quote(collection)}/snapshots/recover?wait=true",
            {"location": f"file://{qdrant_path}", "priority": "snapshot"},
        )
    print("Snapshot import complete")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export/import Code RAG Qdrant snapshots.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export")
    export_parser.add_argument("--qdrant-url", default="http://localhost:6333")
    export_parser.add_argument("--snapshot-dir", default="snapshots")
    export_parser.add_argument("--manifest-collection")
    export_parser.add_argument("--collections", nargs="+", required=True)
    export_parser.set_defaults(func=export_snapshot)

    import_parser = subparsers.add_parser("import")
    import_parser.add_argument("--qdrant-url", default="http://localhost:6333")
    import_parser.add_argument("--snapshot-dir", default="snapshots")
    import_parser.add_argument("--qdrant-snapshot-dir", default="qdrant-snapshots")
    import_parser.add_argument("--bundle", required=True)
    import_parser.set_defaults(func=import_snapshot)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
