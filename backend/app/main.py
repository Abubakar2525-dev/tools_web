"""FastAPI entry point for the Backendz server-side API."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict, deque
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from .contact import DeliverySettings, deliver_inquiry, make_inquiry, validate_contact

logger = logging.getLogger("backendz.api")

# Share the root development environment with Next.js without overriding
# variables supplied by the production process or container.
load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")

MAX_BODY_BYTES = 16_384
WINDOW_SECONDS = 10 * 60
MAX_PER_WINDOW = 5


class RateLimiter:
    """Small in-memory limiter suitable for a single API process."""

    def __init__(self) -> None:
        self._hits: defaultdict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def exceeded(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= WINDOW_SECONDS:
                hits.popleft()
            hits.append(now)
            return len(hits) > MAX_PER_WINDOW


limiter = RateLimiter()
app = FastAPI(title="Backendz API", version="1.0.0")


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", maxsplit=1)[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {
        "name": "Backendz API",
        "status": "ok",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/contact")
async def contact(request: Request) -> JSONResponse:
    if limiter.exceeded(_client_ip(request)):
        return JSONResponse(
            {"ok": False, "message": "Too many submissions. Please wait a few minutes and try again."},
            status_code=429,
        )

    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse({"ok": False, "message": "Invalid request."}, status_code=413)

    raw_body = await request.body()
    if len(raw_body) > MAX_BODY_BYTES:
        return JSONResponse({"ok": False, "message": "Invalid request."}, status_code=413)

    try:
        payload: Any = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JSONResponse({"ok": False, "message": "Invalid request."}, status_code=400)

    if not isinstance(payload, dict):
        return JSONResponse({"ok": False, "message": "Invalid request."}, status_code=400)

    data, errors = validate_contact(payload)
    if errors:
        return JSONResponse({"ok": False, "errors": errors}, status_code=422)

    # Honeypot filled: acknowledge bots without delivering their payload.
    if data["website"]:
        return JSONResponse({"ok": True})

    settings = DeliverySettings.from_environment()
    if not settings.configured:
        return JSONResponse(
            {
                "ok": False,
                "code": "not_configured",
                "message": "The inquiry form is not connected to a delivery channel yet, so your message was not sent.",
            },
            status_code=503,
        )

    inquiry = make_inquiry(data)
    delivered = await asyncio.to_thread(deliver_inquiry, inquiry, settings)
    if not delivered:
        logger.error("Contact delivery failed for every configured channel")
        return JSONResponse(
            {
                "ok": False,
                "code": "delivery_failed",
                "message": "We could not deliver your message just now. Please try again shortly.",
            },
            status_code=502,
        )

    return JSONResponse({"ok": True})
