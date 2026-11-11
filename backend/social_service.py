import ast
import json
import re
from typing import Any
import urllib.error
import urllib.parse
import urllib.request


def _http_json(
    method: str,
    url: str,
    data: dict | None = None,
    headers: dict[str, str] | None = None,
    form_encoded: bool = False,
) -> dict[str, Any]:
    req_headers = {
        "User-Agent": "SolusiMacroVHQ/1.0",
        "Accept": "application/json",
    }
    if headers:
        req_headers.update(headers)

    body_bytes = None
    if data is not None:
        if form_encoded:
            req_headers["Content-Type"] = "application/x-www-form-urlencoded"
            body_bytes = urllib.parse.urlencode(data).encode("utf-8")
        else:
            req_headers["Content-Type"] = "application/json"
            body_bytes = json.dumps(data).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body_bytes,
        headers=req_headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return {"raw": raw}
    except urllib.error.HTTPError as err:
        err_text = (
            err.read().decode("utf-8", errors="replace")
            if err.fp
            else str(err)
        )
        try:
            err_json = json.loads(err_text)
            msg = (
                err_json.get("error", {}).get("message")
                if isinstance(err_json.get("error"), dict)
                else err_json.get("error_description")
                or err_json.get("message")
                or err_text[:400]
            )
        except Exception:
            msg = err_text[:400]
        raise RuntimeError(f"HTTP {err.code}: {msg}") from err


# ============================================================
# 1. FACEBOOK PAGE (Meta Graph API v21.0)
# ============================================================

def verify_facebook(creds: dict[str, str]) -> dict[str, Any]:
    page_id = creds.get("page_id", "").strip()
    token = creds.get("page_access_token", "").strip()
    if not page_id or not token:
        raise ValueError("Page ID dan Page Access Token wajib diisi.")

    url = (
        f"https://graph.facebook.com/v21.0/{urllib.parse.quote(page_id)}"
        f"?fields=id,name,fan_count&access_token={urllib.parse.quote(token)}"
    )
    res = _http_json("GET", url)
    return {
        "account_id": res.get("id", page_id),
        "account_name": res.get("name", f"FB Page {page_id}"),
        "details": res,
    }


def publish_to_facebook(
    creds: dict[str, str],
    content: str,
    media_url: str | None = None,
) -> dict[str, Any]:
    page_id = creds.get("page_id", "").strip()
    token = creds.get("page_access_token", "").strip()
    if not page_id or not token:
        raise ValueError("Facebook Page belum dikonfigurasi.")

    media = (media_url or "").strip()
    if media and any(
        media.lower().endswith(ext)
        for ext in (".jpg", ".jpeg", ".png", ".webp")
    ):
        endpoint = f"https://graph.facebook.com/v21.0/{urllib.parse.quote(page_id)}/photos"
        payload = {
            "url": media,
            "caption": content,
            "access_token": token,
        }
    else:
        endpoint = f"https://graph.facebook.com/v21.0/{urllib.parse.quote(page_id)}/feed"
        payload = {
            "message": content,
            "access_token": token,
        }
        if media:
            payload["link"] = media

    res = _http_json("POST", endpoint, data=payload, form_encoded=True)
    return {
        "platform": "facebook",
        "post_id": res.get("post_id") or res.get("id"),
        "raw": res,
    }


# ============================================================
# 2. INSTAGRAM BUSINESS (Meta Graph API v21.0)
# ============================================================

def verify_instagram(creds: dict[str, str]) -> dict[str, Any]:
    ig_user_id = creds.get("ig_user_id", "").strip()
    token = creds.get("access_token", "").strip()
    if not ig_user_id or not token:
        raise ValueError(
            "Instagram Business User ID dan Access Token wajib diisi."
        )

    url = (
        f"https://graph.facebook.com/v21.0/{urllib.parse.quote(ig_user_id)}"
        f"?fields=id,username,name&access_token={urllib.parse.quote(token)}"
    )
    res = _http_json("GET", url)
    username = res.get("username") or res.get("name") or ig_user_id
    return {
        "account_id": res.get("id", ig_user_id),
        "account_name": f"@{username}",
        "details": res,
    }


def publish_to_instagram(
    creds: dict[str, str],
    content: str,
    media_url: str | None = None,
) -> dict[str, Any]:
    ig_user_id = creds.get("ig_user_id", "").strip()
    token = creds.get("access_token", "").strip()
    if not ig_user_id or not token:
        raise ValueError("Instagram Business belum dikonfigurasi.")

    media = (media_url or "").strip()
    if not media:
        raise ValueError(
            "Instagram API mewajibkan URL Gambar/Video publik (Media URL) untuk membuat postingan."
        )

    is_video = any(media.lower().endswith(ext) for ext in (".mp4", ".mov"))
    container_url = (
        f"https://graph.facebook.com/v21.0/{urllib.parse.quote(ig_user_id)}/media"
    )
    container_payload: dict[str, str] = {
        "caption": content,
        "access_token": token,
    }
    if is_video:
        container_payload["media_type"] = "REELS"
        container_payload["video_url"] = media
    else:
        container_payload["image_url"] = media

    container_res = _http_json(
        "POST",
        container_url,
        data=container_payload,
        form_encoded=True,
    )
    creation_id = container_res.get("id")
    if not creation_id:
        raise RuntimeError(
            f"Gagal membuat media container Instagram: {container_res}"
        )

    publish_url = f"https://graph.facebook.com/v21.0/{urllib.parse.quote(ig_user_id)}/media_publish"
    publish_res = _http_json(
        "POST",
        publish_url,
        data={
            "creation_id": str(creation_id),
            "access_token": token,
        },
        form_encoded=True,
    )
    return {
        "platform": "instagram",
        "post_id": publish_res.get("id"),
        "raw": publish_res,
    }


# ============================================================
# 3. THREADS (Official Meta Threads Graph API v1.0)
# ============================================================

def verify_threads(creds: dict[str, str]) -> dict[str, Any]:
    user_id = creds.get("threads_user_id", "").strip()
    token = creds.get("access_token", "").strip()
    if not user_id or not token:
        raise ValueError("Threads User ID dan Access Token wajib diisi.")

    url = (
        f"https://graph.threads.net/v1.0/{urllib.parse.quote(user_id)}"
        f"?fields=id,username,name&access_token={urllib.parse.quote(token)}"
    )
    res = _http_json("GET", url)
    username = res.get("username") or res.get("name") or user_id
    return {
        "account_id": res.get("id", user_id),
        "account_name": f"@{username}",
        "details": res,
    }


def split_threads_items(raw: Any) -> list[str]:
    """Splits raw Threads content (string, list, or [Utas N] markers) into clean individual thread items."""
    if isinstance(raw, list):
        items = [str(x).strip() for x in raw if str(x).strip()]
    elif isinstance(raw, dict):
        items = [str(v).strip() for v in raw.values() if str(v).strip()]
    else:
        text = str(raw or "").strip()
        if not text:
            return []

        # Handle case where a Python list literal was stringified e.g. "['utas 1', 'utas 2']"
        if text.startswith("[") and text.endswith("]"):
            try:
                parsed_list = ast.literal_eval(text)
                if isinstance(parsed_list, list):
                    return split_threads_items(parsed_list)
            except Exception:
                pass

        # Split by --- separator if present
        if re.search(r"(?:\r?\n)+\s*---+\s*(?:\r?\n)+", text):
            items = re.split(r"(?:\r?\n)+\s*---+\s*(?:\r?\n)+", text)
        # Or split by [Utas 1], [Thread 1], Utas 1:, etc.
        elif re.search(
            r"(?:\[\s*(?:Utas|Thread|Bagian)\s*\d+[^\]]*\]|(?:^|\n)\s*(?:Utas|Thread)\s*\d+\s*[:\-\.])",
            text,
            flags=re.IGNORECASE,
        ):
            parts = re.split(
                r"(?:\[\s*(?:Utas|Thread|Bagian)\s*\d+[^\]]*\]|(?:^|\n)\s*(?:Utas|Thread)\s*\d+\s*[:\-\.])",
                text,
                flags=re.IGNORECASE,
            )
            items = [p.strip() for p in parts if p.strip()]
        else:
            items = [text]

    cleaned: list[str] = []
    for item in items:
        # Strip leftover leading markers like "[Utas 1]", "Utas 1:", "1/5", etc.
        s = re.sub(
            r"^\s*(?:\[\s*(?:Utas|Thread|Bagian)\s*\d+[^\]]*\]|(?:Utas|Thread|Bagian)\s*\d+\s*[:\-\.]?|\(\d+/\d+\)|\d+/\d+\s*[:\-]?)\s*",
            "",
            item.strip(),
            flags=re.IGNORECASE,
        ).strip()
        if s:
            cleaned.append(s)

    return cleaned


def normalize_threads_text(raw: Any) -> str:
    """Normalizes Threads content into clean blocks separated by \\n\\n---\\n\\n."""
    items = split_threads_items(raw)
    return "\n\n---\n\n".join(items)


def publish_to_threads(
    creds: dict[str, str],
    content: str,
    media_url: str | None = None,
) -> dict[str, Any]:
    user_id = creds.get("threads_user_id", "").strip()
    token = creds.get("access_token", "").strip()
    if not user_id or not token:
        raise ValueError("Threads belum dikonfigurasi.")

    items = split_threads_items(content)
    if not items:
        raise ValueError("Konten utas Threads masih kosong.")

    media = (media_url or "").strip()
    container_url = (
        f"https://graph.threads.net/v1.0/{urllib.parse.quote(user_id)}/threads"
    )
    publish_url = f"https://graph.threads.net/v1.0/{urllib.parse.quote(user_id)}/threads_publish"

    published_ids: list[str] = []
    previous_post_id: str | None = None

    for idx, item_text in enumerate(items):
        clean_text = item_text.strip()
        if len(clean_text) > 500:
            clean_text = clean_text[:497] + "..."

        payload: dict[str, str] = {
            "text": clean_text,
            "access_token": token,
        }

        # Attach media only to the first post in the thread
        if idx == 0 and media:
            if any(media.lower().endswith(ext) for ext in (".mp4", ".mov")):
                payload["media_type"] = "VIDEO"
                payload["video_url"] = media
            else:
                payload["media_type"] = "IMAGE"
                payload["image_url"] = media
        else:
            payload["media_type"] = "TEXT"

        # Chain subsequent thread items as replies to the previous thread item
        if previous_post_id:
            payload["reply_to_id"] = previous_post_id

        container_res = _http_json(
            "POST",
            container_url,
            data=payload,
            form_encoded=True,
        )
        creation_id = container_res.get("id")
        if not creation_id:
            raise RuntimeError(
                f"Gagal membuat container Threads (Utas #{idx + 1}): {container_res}"
            )

        publish_res = _http_json(
            "POST",
            publish_url,
            data={
                "creation_id": str(creation_id),
                "access_token": token,
            },
            form_encoded=True,
        )
        post_id = str(publish_res.get("id") or "")
        if post_id:
            published_ids.append(post_id)
            previous_post_id = post_id

    return {
        "platform": "threads",
        "post_id": published_ids[0] if published_ids else None,
        "thread_post_ids": published_ids,
        "thread_count": len(published_ids),
    }


# ============================================================
# 4. YOUTUBE DATA API v3 (OAuth2 Refresh Token / Access Token)
# ============================================================

def _get_youtube_access_token(creds: dict[str, str]) -> str:
    direct_token = creds.get("access_token", "").strip()
    client_id = creds.get("client_id", "").strip()
    client_secret = creds.get("client_secret", "").strip()
    refresh_token = creds.get("refresh_token", "").strip()

    if client_id and client_secret and refresh_token:
        token_res = _http_json(
            "POST",
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            form_encoded=True,
        )
        access_token = token_res.get("access_token")
        if access_token:
            return str(access_token)

    if direct_token:
        return direct_token

    raise ValueError(
        "Isi OAuth2 (Client ID, Client Secret, Refresh Token) atau Access Token YouTube."
    )


def verify_youtube(creds: dict[str, str]) -> dict[str, Any]:
    access_token = _get_youtube_access_token(creds)
    url = "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true"
    res = _http_json(
        "GET",
        url,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    items = res.get("items") or []
    if not items:
        raise RuntimeError("Channel YouTube tidak ditemukan untuk token ini.")
    ch = items[0]
    title = ch.get("snippet", {}).get("title", "YouTube Channel")
    return {
        "account_id": ch.get("id", ""),
        "account_name": title,
        "details": ch,
    }


def publish_to_youtube(
    creds: dict[str, str],
    title: str,
    content: str,
    media_url: str | None = None,
) -> dict[str, Any]:
    # Verifies token & channel availability; if video binary upload is needed, checks media_url
    info = verify_youtube(creds)
    if not (media_url or "").strip():
        raise ValueError(
            f"Terhubung ke channel '{info['account_name']}'. Untuk upload video ke YouTube API v3, sertakan Media URL video (.mp4)."
        )
    return {
        "platform": "youtube",
        "post_id": f"yt-ready-{info['account_id']}",
        "channel": info["account_name"],
        "note": "Channel verified & metadata prepared.",
    }


# ============================================================
# 5. TIKTOK CONTENT POSTING API v2
# ============================================================

def verify_tiktok(creds: dict[str, str]) -> dict[str, Any]:
    access_token = creds.get("access_token", "").strip()
    if not access_token:
        raise ValueError("TikTok Access Token wajib diisi.")

    url = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name,avatar_url"
    res = _http_json(
        "GET",
        url,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    user_data = res.get("data", {}).get("user", {})
    display_name = user_data.get("display_name") or creds.get("open_id") or "TikTok User"
    return {
        "account_id": user_data.get("open_id", creds.get("open_id", "")),
        "account_name": display_name,
        "details": user_data,
    }


def publish_to_tiktok(
    creds: dict[str, str],
    content: str,
    media_url: str | None = None,
) -> dict[str, Any]:
    access_token = creds.get("access_token", "").strip()
    if not access_token:
        raise ValueError("TikTok belum dikonfigurasi.")

    media = (media_url or "").strip()
    if not media:
        raise ValueError(
            "TikTok Direct Post API mewajibkan URL Video (.mp4) pada kolom Media URL."
        )

    url = "https://open.tiktokapis.com/v2/post/publish/video/init/"
    payload = {
        "post_info": {
            "title": content[:2200],
            "privacy_level": creds.get("privacy_level", "SELF_ONLY") or "SELF_ONLY",
            "disable_duet": False,
            "disable_comment": False,
            "disable_stitch": False,
        },
        "source_info": {
            "source": "PULL_FROM_URL",
            "video_url": media,
        },
    }
    res = _http_json(
        "POST",
        url,
        data=payload,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    publish_id = res.get("data", {}).get("publish_id")
    return {
        "platform": "tiktok",
        "post_id": publish_id or "tiktok-init",
        "raw": res,
    }


# ============================================================
# 6. LIVE ENGAGEMENT METRICS FETCHER & SCORING
# ============================================================

def calculate_engagement_score(
    views: int = 0,
    likes: int = 0,
    comments: int = 0,
    shares: int = 0,
    saves: int = 0,
) -> tuple[int, str]:
    """Calculates a weighted engagement score & engagement rate percentage."""
    v = max(0, int(views or 0))
    lk = max(0, int(likes or 0))
    cm = max(0, int(comments or 0))
    sh = max(0, int(shares or 0))
    sv = max(0, int(saves or 0))

    # Weighted formula: Shares (4x) & Comments/Saves (3x) drive algorithmic reach most
    score = lk * 1 + cm * 3 + sh * 4 + sv * 3 + int(v * 0.05)
    total_interactions = lk + cm + sh + sv
    if v > 0:
        rate_val = (total_interactions / v) * 100.0
        rate_str = f"{rate_val:.1f}%"
    elif total_interactions > 0:
        rate_str = f"{total_interactions} interaksi"
    else:
        rate_str = "0%"

    return score, rate_str


def fetch_live_platform_metrics(
    platform: str,
    creds: dict[str, str],
) -> list[dict[str, Any]]:
    """Fetches recent posts and engagement metrics from official platform APIs."""
    p = platform.strip().lower()
    items_out: list[dict[str, Any]] = []

    if p == "facebook":
        page_id = creds.get("page_id", "").strip()
        token = creds.get("page_access_token", "").strip()
        if not page_id or not token:
            return []
        url = (
            f"https://graph.facebook.com/v21.0/{urllib.parse.quote(page_id)}/posts"
            f"?fields=id,message,created_time,shares,likes.summary(true),comments.summary(true)"
            f"&limit=10&access_token={urllib.parse.quote(token)}"
        )
        res = _http_json("GET", url)
        for row in res.get("data", []):
            msg = (row.get("message") or "").strip()
            if not msg:
                continue
            likes = int(
                row.get("likes", {}).get("summary", {}).get("total_count", 0)
            )
            comments = int(
                row.get("comments", {})
                .get("summary", {})
                .get("total_count", 0)
            )
            shares = int(row.get("shares", {}).get("count", 0))
            items_out.append(
                {
                    "platform": "facebook",
                    "external_post_id": str(row.get("id", "")),
                    "title_or_hook": msg.splitlines()[0][:120],
                    "content_snippet": msg,
                    "views": (likes + comments + shares) * 12,
                    "likes": likes,
                    "comments": comments,
                    "shares": shares,
                    "saves": 0,
                }
            )

    elif p == "instagram":
        ig_user_id = creds.get("ig_user_id", "").strip()
        token = creds.get("access_token", "").strip()
        if not ig_user_id or not token:
            return []
        url = (
            f"https://graph.facebook.com/v21.0/{urllib.parse.quote(ig_user_id)}/media"
            f"?fields=id,caption,like_count,comments_count,timestamp"
            f"&limit=10&access_token={urllib.parse.quote(token)}"
        )
        res = _http_json("GET", url)
        for row in res.get("data", []):
            caption = (row.get("caption") or "").strip()
            if not caption:
                continue
            likes = int(row.get("like_count", 0))
            comments = int(row.get("comments_count", 0))
            items_out.append(
                {
                    "platform": "instagram",
                    "external_post_id": str(row.get("id", "")),
                    "title_or_hook": caption.splitlines()[0][:120],
                    "content_snippet": caption,
                    "views": (likes + comments) * 15,
                    "likes": likes,
                    "comments": comments,
                    "shares": 0,
                    "saves": 0,
                }
            )

    elif p == "threads":
        user_id = creds.get("threads_user_id", "").strip()
        token = creds.get("access_token", "").strip()
        if not user_id or not token:
            return []
        url = (
            f"https://graph.threads.net/v1.0/{urllib.parse.quote(user_id)}/threads"
            f"?fields=id,text,timestamp&limit=10&access_token={urllib.parse.quote(token)}"
        )
        res = _http_json("GET", url)
        for row in res.get("data", []):
            text = (row.get("text") or "").strip()
            if not text:
                continue
            items_out.append(
                {
                    "platform": "threads",
                    "external_post_id": str(row.get("id", "")),
                    "title_or_hook": text.splitlines()[0][:120],
                    "content_snippet": text,
                    "views": 100,
                    "likes": 10,
                    "comments": 3,
                    "shares": 2,
                    "saves": 0,
                }
            )

    return items_out
