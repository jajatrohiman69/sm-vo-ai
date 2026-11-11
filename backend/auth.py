import hashlib
import hmac
import os
import time

from dotenv import load_dotenv

load_dotenv()

SESSION_COOKIE = "vhq_session"
SESSION_MAX_AGE = 12 * 60 * 60


def _settings() -> tuple[str, str, str] | None:
    username = os.getenv("VHQ_FOUNDER_USERNAME", "").strip()
    password = os.getenv("VHQ_FOUNDER_PASSWORD", "")
    signing_key = os.getenv("VHQ_AUTH_SECRET", "")

    if (
        not username
        or len(password) < 12
        or len(signing_key) < 32
        or password.lower().startswith("replace-")
        or signing_key.lower().startswith("replace-")
    ):
        return None

    return username, password, signing_key


def auth_is_configured() -> bool:
    return _settings() is not None


def verify_credentials(username: str, password: str) -> bool:
    settings = _settings()
    if not settings:
        return False

    expected_username, expected_password, _ = settings
    username_matches = hmac.compare_digest(
        username.encode("utf-8"),
        expected_username.encode("utf-8"),
    )
    password_matches = hmac.compare_digest(
        password.encode("utf-8"),
        expected_password.encode("utf-8"),
    )
    return username_matches and password_matches


def create_session_token() -> str:
    settings = _settings()
    if not settings:
        raise RuntimeError("Founder authentication is not configured.")

    username, _, signing_key = settings
    expires_at = int(time.time()) + SESSION_MAX_AGE
    payload = f"{username}:{expires_at}"
    signature = hmac.new(
        signing_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{expires_at}.{signature}"


def verify_session_token(token: str | None) -> bool:
    settings = _settings()
    if not settings or not token:
        return False

    try:
        expires_text, supplied_signature = token.split(".", maxsplit=1)
        expires_at = int(expires_text)
    except (ValueError, TypeError):
        return False

    if expires_at <= int(time.time()):
        return False

    username, _, signing_key = settings
    payload = f"{username}:{expires_at}"
    expected_signature = hmac.new(
        signing_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(supplied_signature, expected_signature)


def cookie_secure() -> bool:
    return os.getenv("VHQ_COOKIE_SECURE", "false").strip().lower() in {
        "1",
        "true",
        "yes",
    }
