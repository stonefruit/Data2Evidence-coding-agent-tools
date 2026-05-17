from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.git import changed_files_since
from app.ingest import ingest, sync
from app.manifest import index_status
from app.manifest import read_manifest
from app.retrieve import query
from app.store import get_client


api = FastAPI(title="Data2Evidence Code RAG")


WEB_APP_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Data2Evidence Code RAG</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f7f4;
      --panel: #ffffff;
      --ink: #1f2933;
      --muted: #65717d;
      --line: #d9ded8;
      --accent: #0f766e;
      --accent-dark: #115e59;
      --soft: #e8f2ef;
      --code: #15202b;
      --code-bg: #f1f4f3;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
    }

    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }

    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 22px;
    }

    h1 {
      margin: 0 0 6px;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1.05;
      letter-spacing: 0;
    }

    .subtitle {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
    }

    .status {
      min-width: 280px;
      color: var(--muted);
      font-size: 13px;
      text-align: right;
    }

    .search-panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 10px 28px rgba(24, 38, 44, 0.08);
    }

    form {
      display: grid;
      gap: 12px;
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 650;
    }

    textarea,
    input,
    select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      font: inherit;
      outline: none;
    }

    textarea {
      min-height: 96px;
      resize: vertical;
      padding: 12px;
      font-size: 16px;
      line-height: 1.45;
    }

    input,
    select {
      height: 40px;
      padding: 0 10px;
    }

    textarea:focus,
    input:focus,
    select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--soft);
    }

    .controls {
      display: grid;
      grid-template-columns: 1fr 160px 120px 128px;
      gap: 10px;
      align-items: end;
    }

    button {
      height: 40px;
      border: 0;
      border-radius: 6px;
      background: var(--accent);
      color: white;
      font: inherit;
      font-weight: 750;
      cursor: pointer;
    }

    button:hover {
      background: var(--accent-dark);
    }

    button:disabled {
      background: #9fb7b1;
      cursor: wait;
    }

    .examples {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .example {
      height: auto;
      min-height: 30px;
      padding: 6px 9px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      font-size: 13px;
      font-weight: 600;
    }

    .results-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      margin: 22px 0 10px;
      color: var(--muted);
      font-size: 13px;
    }

    .results {
      display: grid;
      gap: 12px;
    }

    .result {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }

    .result-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: #fbfcfb;
    }

    .path {
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      font-weight: 750;
      color: var(--accent-dark);
    }

    .score {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }

    pre {
      margin: 0;
      padding: 14px;
      overflow: auto;
      max-height: 430px;
      background: var(--code-bg);
      color: var(--code);
      font-size: 13px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .empty {
      padding: 18px;
      border: 1px dashed var(--line);
      border-radius: 8px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.55);
    }

    @media (max-width: 760px) {
      header {
        display: block;
      }

      .status {
        min-width: 0;
        margin-top: 10px;
        text-align: left;
      }

      .controls {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Data2Evidence Code RAG</h1>
        <p class="subtitle">Search the Qdrant code index with the same embeddings used by the CLI.</p>
      </div>
      <div class="status" id="status">Checking index...</div>
    </header>

    <section class="search-panel">
      <form id="search-form">
        <label>
          Query
          <textarea id="question" autofocus>Where is the MCP server name and version defined?</textarea>
        </label>
        <div class="controls">
          <label>
            Module filter
            <input id="module" placeholder="plugins/functions">
          </label>
          <label>
            Language
            <input id="language" placeholder="ts, md, py">
          </label>
          <label>
            Limit
            <select id="limit">
              <option>5</option>
              <option selected>8</option>
              <option>12</option>
              <option>20</option>
            </select>
          </label>
          <button id="submit" type="submit">Search</button>
        </div>
      </form>
      <div class="examples" id="examples"></div>
    </section>

    <div class="results-head">
      <span id="summary">Ready.</span>
      <span id="timing"></span>
    </div>
    <section class="results" id="results">
      <div class="empty">Ask a question to retrieve matching chunks from Qdrant.</div>
    </section>
  </main>

  <script>
    const examples = [
      "Which package routes map /mcp and /code-suggestion to functions?",
      "What endpoint handles code-suggestion chat requests and what request fields does it take?",
      "Where does the data mapping service document AI model API keys and Azure OpenAI settings?",
      "Where are the data mapping routes and generate suggestions endpoint defined?",
      "How does the code suggestion MCP client pass dataset context to the D2E MCP server?"
    ];

    const form = document.querySelector("#search-form");
    const question = document.querySelector("#question");
    const moduleInput = document.querySelector("#module");
    const languageInput = document.querySelector("#language");
    const limit = document.querySelector("#limit");
    const button = document.querySelector("#submit");
    const results = document.querySelector("#results");
    const summary = document.querySelector("#summary");
    const timing = document.querySelector("#timing");
    const status = document.querySelector("#status");
    const examplesContainer = document.querySelector("#examples");

    function escapeHtml(value) {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function sourceUrl(source) {
      const line = source.start_line || 1;
      return `${source.path}:${line}-${source.end_line || line}`;
    }

    function renderResults(sources) {
      if (!sources.length) {
        results.innerHTML = `<div class="empty">No chunks matched that query.</div>`;
        return;
      }
      results.innerHTML = sources.map((source, index) => {
        const moduleName = source.metadata?.module ? ` · ${escapeHtml(source.metadata.module)}` : "";
        const language = source.metadata?.language ? ` · ${escapeHtml(source.metadata.language)}` : "";
        return `
          <article class="result">
            <div class="result-meta">
              <div class="path">${index + 1}. ${escapeHtml(sourceUrl(source))}</div>
              <div class="score">score ${Number(source.score).toFixed(3)}${moduleName}${language}</div>
            </div>
            <pre>${escapeHtml(source.text.trim())}</pre>
          </article>
        `;
      }).join("");
    }

    async function loadStatus() {
      try {
        const [statsResponse, statusResponse] = await Promise.all([
          fetch("/stats"),
          fetch("/status")
        ]);
        const stats = await statsResponse.json();
        const state = await statusResponse.json();
        const syncText = state.in_sync ? "in sync" : "not in sync";
        const points = stats.points ?? stats.vectors ?? "unknown";
        status.textContent = `${stats.collection}: ${points} points, ${syncText}`;
      } catch (error) {
        status.textContent = "Index status unavailable.";
      }
    }

    async function search() {
      const filters = {};
      if (moduleInput.value.trim()) filters.module = moduleInput.value.trim();
      if (languageInput.value.trim()) filters.language = languageInput.value.trim();

      const payload = {
        question: question.value.trim(),
        filters: Object.keys(filters).length ? filters : null,
        limit: Number(limit.value)
      };

      if (!payload.question) {
        question.focus();
        return;
      }

      button.disabled = true;
      summary.textContent = "Searching Qdrant...";
      timing.textContent = "";
      const started = performance.now();

      try {
        const response = await fetch("/query", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = await response.json();
        const elapsed = Math.round(performance.now() - started);
        renderResults(data.sources || []);
        summary.textContent = `${(data.sources || []).length} chunks for "${data.question}"`;
        timing.textContent = `${elapsed} ms`;
      } catch (error) {
        results.innerHTML = `<div class="empty">${escapeHtml(String(error.message || error))}</div>`;
        summary.textContent = "Search failed.";
      } finally {
        button.disabled = false;
      }
    }

    for (const text of examples) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "example";
      item.textContent = text;
      item.addEventListener("click", () => {
        question.value = text;
        search();
      });
      examplesContainer.appendChild(item);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      search();
    });

    loadStatus();
  </script>
</body>
</html>
"""


class QueryRequest(BaseModel):
    question: str
    filters: dict[str, str] | None = None
    limit: int = Field(default=8, ge=1, le=25)


@api.get("/", response_class=HTMLResponse)
def web_app() -> str:
    return WEB_APP_HTML


@api.get("/health")
def health() -> dict:
    settings = get_settings()
    return {"ok": True, "collection": settings.qdrant_collection}


@api.get("/stats")
def stats() -> dict:
    settings = get_settings()
    client = get_client(settings)
    info = client.get_collection(settings.qdrant_collection)
    return {
        "collection": settings.qdrant_collection,
        "points": info.points_count,
        "vectors": info.vectors_count,
    }


@api.get("/status")
def status() -> dict:
    return index_status()


@api.get("/changes")
def changes() -> dict:
    settings = get_settings()
    client = get_client(settings)
    manifest = read_manifest(client, settings)
    indexed_sha = manifest.get("git_sha") if manifest else None
    if not indexed_sha:
        return {"error": "no existing index manifest", "changes": []}
    return {
        "base_git_sha": indexed_sha,
        "changes": [
            {
                "status": change.status,
                "path": change.path,
                "old_path": change.old_path,
                "is_delete": change.is_delete,
                "is_rename": change.is_rename,
            }
            for change in changed_files_since(settings, indexed_sha)
        ],
    }


@api.post("/reindex")
def reindex_endpoint() -> dict:
    return ingest()


@api.post("/sync")
def sync_endpoint() -> dict:
    return sync()


@api.post("/query")
def query_endpoint(request: QueryRequest) -> dict:
    results = query(request.question, filters=request.filters, limit=request.limit)
    return {
        "question": request.question,
        "sources": [
            {
                "path": result.path,
                "start_line": result.start_line,
                "end_line": result.end_line,
                "score": result.score,
                "text": result.text,
                "metadata": result.metadata,
            }
            for result in results
        ],
    }
