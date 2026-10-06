import html
import os
import re
import subprocess
from functools import lru_cache
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

GITHUB_PR_RE = re.compile(r"^/([^/]+)/([^/]+)/pull/(\d+)")
MAX_HTML_BYTES = 512 * 1024
USER_AGENT = "Mozilla/5.0 (compatible; CanvasUnfurler/1.0)"


class _TitleParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.og_title: str | None = None
        self.title: str | None = None
        self._in_title = False
        self._title_parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta" and attrs.get("property") in ("og:title", "twitter:title"):
            self.og_title = self.og_title or attrs.get("content")
        elif tag == "title" and self.title is None:
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "title" and self._in_title:
            self._in_title = False
            self.title = "".join(self._title_parts)

    def handle_data(self, data):
        if self._in_title:
            self._title_parts.append(data)


def _clean(text: str | None) -> str | None:
    if not text:
        return None
    text = " ".join(html.unescape(text).split())
    return text or None


@lru_cache(maxsize=1)
def _github_token() -> str | None:
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return token
    # Fall back to the gh CLI's stored credentials so private repos work without extra setup.
    try:
        out = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True, timeout=5)
        return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


async def _fetch_title(client: httpx.AsyncClient, url: str) -> str | None:
    async with client.stream("GET", url, headers={"User-Agent": USER_AGENT}) as resp:
        if resp.status_code >= 400:
            return None
        if "html" not in resp.headers.get("content-type", ""):
            return None
        chunks = bytearray()
        async for chunk in resp.aiter_bytes():
            chunks.extend(chunk)
            if len(chunks) >= MAX_HTML_BYTES:
                break
    parser = _TitleParser()
    parser.feed(chunks.decode(resp.encoding or "utf-8", errors="replace"))
    return _clean(parser.og_title) or _clean(parser.title)


PR_GRAPHQL_QUERY = """
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      title
      state
      isDraft
      isInMergeQueue
      reviewDecision
      author { login }
      commits(last: 1) {
        nodes { commit { statusCheckRollup { state } } }
      }
    }
  }
}
"""


# EXPECTED means a required check hasn't reported yet, so it's grouped with pending.
CHECKS_STATES = {"SUCCESS": "passing", "FAILURE": "failing", "ERROR": "failing", "PENDING": "pending", "EXPECTED": "pending"}


def _pr_result(
    owner: str,
    repo: str,
    number: int,
    title: str | None,
    state: str,
    author: str | None,
    approved: bool,
    checks: str | None,
) -> dict:
    return {
        "kind": "github_pr",
        "title": title,
        "pr": {
            "owner": owner,
            "repo": repo,
            "number": number,
            "state": state,
            "author": author,
            "approved": approved,
            "checks": checks,
        },
    }


async def _fetch_github_pr_graphql(
    client: httpx.AsyncClient, token: str, owner: str, repo: str, number: int
) -> dict | None:
    resp = await client.post(
        "https://api.github.com/graphql",
        headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT},
        json={"query": PR_GRAPHQL_QUERY, "variables": {"owner": owner, "repo": repo, "number": number}},
    )
    if resp.status_code != 200:
        return None
    pr = (((resp.json().get("data") or {}).get("repository")) or {}).get("pullRequest")
    if not pr:
        return None
    if pr["state"] == "MERGED":
        state = "merged"
    elif pr["state"] == "CLOSED":
        state = "closed"
    elif pr.get("isInMergeQueue"):
        state = "queued"
    elif pr.get("isDraft"):
        state = "draft"
    else:
        state = "open"
    commits = (pr.get("commits") or {}).get("nodes") or []
    # No rollup means the head commit has no checks at all.
    rollup = (commits[0].get("commit") or {}).get("statusCheckRollup") if commits else None
    return _pr_result(
        owner,
        repo,
        number,
        pr.get("title"),
        state,
        (pr.get("author") or {}).get("login"),
        pr.get("reviewDecision") == "APPROVED",
        CHECKS_STATES.get(rollup["state"]) if rollup else None,
    )


async def _fetch_github_pr_rest(
    client: httpx.AsyncClient, token: str | None, owner: str, repo: str, number: int
) -> dict | None:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = await client.get(f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}", headers=headers)
    if resp.status_code != 200:
        return None
    pr = resp.json()
    if pr.get("merged_at"):
        state = "merged"
    elif pr.get("state") == "closed":
        state = "closed"
    elif pr.get("draft"):
        state = "draft"
    else:
        state = "open"
    return _pr_result(owner, repo, number, pr.get("title"), state, (pr.get("user") or {}).get("login"), False, None)


async def _fetch_github_pr(client: httpx.AsyncClient, owner: str, repo: str, number: int) -> dict | None:
    token = _github_token()
    # Merge queue membership, review decision, and the check rollup are only exposed through GraphQL,
    # which requires auth. Without a token we fall back to REST, and queued PRs just show as open
    # (never approved, and with no check status).
    if token and (result := await _fetch_github_pr_graphql(client, token, owner, repo, number)):
        return result
    return await _fetch_github_pr_rest(client, token, owner, repo, number)


async def unfurl(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL must be http(s)")

    async with httpx.AsyncClient(follow_redirects=True, timeout=8.0) as client:
        if parsed.netloc.lower() in ("github.com", "www.github.com"):
            if m := GITHUB_PR_RE.match(parsed.path):
                owner, repo, number = m.group(1), m.group(2), int(m.group(3))
                if result := await _fetch_github_pr(client, owner, repo, number):
                    return result
                # API failed (e.g. private repo without a token); still render as a PR card.
                return {
                    "kind": "github_pr",
                    "title": None,
                    "pr": {
                        "owner": owner,
                        "repo": repo,
                        "number": number,
                        "state": None,
                        "author": None,
                        "approved": False,
                        "checks": None,
                    },
                }

        try:
            title = await _fetch_title(client, url)
        except httpx.HTTPError:
            title = None
        return {"kind": "link", "title": title}
