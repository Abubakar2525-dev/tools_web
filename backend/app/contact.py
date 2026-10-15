"""Contact-form validation and delivery without framework-specific code."""

from __future__ import annotations

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")

BUDGET_OPTIONS = {
    "Not sure yet",
    "Under $10k",
    "$10k – $25k",
    "$25k – $50k",
    "$50k – $100k",
    "$100k+",
}

SERVICE_OPTIONS = {
    "AI application development",
    "AI agent development",
    "Retrieval-augmented generation (RAG)",
    "LLM integration and engineering",
    "AI workflow automation",
    "Data engineering for AI",
    "Custom software development",
    "AI deployment, monitoring and optimization",
    "Web development",
    "WordPress development",
    "WooCommerce and e-commerce development",
    "Mobile app development",
    "SEO services",
    "Digital marketing",
    "Conversion rate optimization",
    "Content strategy and analytics",
    "Website maintenance and support",
    "Website speed optimization",
    "Security and technical support",
    "Cloud and infrastructure",
    "Not sure yet",
}


def _text(value: Any, maximum: int) -> str:
    return value.strip()[:maximum] if isinstance(value, str) else ""


def validate_contact(payload: dict[str, Any]) -> tuple[dict[str, str], dict[str, str]]:
    """Return normalized data and field errors using the browser form contract."""

    data = {
        "name": _text(payload.get("name"), 120),
        "email": _text(payload.get("email"), 200),
        "company": _text(payload.get("company"), 160),
        "service": _text(payload.get("service"), 120),
        "budget": _text(payload.get("budget"), 40),
        "details": _text(payload.get("details"), 5000),
        "website": _text(payload.get("website"), 200),
    }

    errors: dict[str, str] = {}
    if len(data["name"]) < 2:
        errors["name"] = "Enter your name."
    if not data["email"]:
        errors["email"] = "Enter your work email."
    elif not EMAIL_RE.fullmatch(data["email"]):
        errors["email"] = "Enter an email address like name@company.com."
    if data["service"] not in SERVICE_OPTIONS:
        errors["service"] = "Choose the closest match, or “Not sure yet”."
    if data["budget"] and data["budget"] not in BUDGET_OPTIONS:
        errors["budget"] = "Choose a budget range."
    if len(data["details"]) < 30:
        errors["details"] = (
            "Add a little more detail (at least 30 characters): "
            "the problem, who it affects and any constraints."
        )

    return data, errors


@dataclass(frozen=True)
class DeliverySettings:
    webhook_url: str | None
    resend_api_key: str | None
    to_email: str | None
    from_email: str

    @classmethod
    def from_environment(cls) -> "DeliverySettings":
        return cls(
            webhook_url=os.getenv("CONTACT_WEBHOOK_URL") or None,
            resend_api_key=os.getenv("RESEND_API_KEY") or None,
            to_email=os.getenv("CONTACT_TO_EMAIL") or None,
            from_email=os.getenv("CONTACT_FROM_EMAIL") or "Website <onboarding@resend.dev>",
        )

    @property
    def configured(self) -> bool:
        return bool(self.webhook_url or (self.resend_api_key and self.to_email))


def make_inquiry(data: dict[str, str]) -> dict[str, str | None]:
    return {
        "name": data["name"],
        "email": data["email"],
        "company": data["company"] or None,
        "service": data["service"],
        "budget": data["budget"] or None,
        "details": data["details"],
        "receivedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> bool:
    encoded = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=encoded,
        method="POST",
        headers={"content-type": "application/json", "user-agent": "Backendz/1.0", **(headers or {})},
    )
    try:
        with urlopen(request, timeout=10) as response:  # noqa: S310 - URL comes from trusted server config.
            return 200 <= response.status < 300
    except (HTTPError, URLError, TimeoutError):
        return False


def deliver_inquiry(inquiry: dict[str, str | None], settings: DeliverySettings) -> bool:
    """Deliver to every configured channel and succeed when at least one accepts it."""

    jobs: list[tuple[str, dict[str, Any], dict[str, str] | None]] = []
    if settings.webhook_url:
        jobs.append((settings.webhook_url, {"type": "website_inquiry", **inquiry}, None))

    if settings.resend_api_key and settings.to_email:
        text = "\n".join(
            [
                f"Name: {inquiry['name']}",
                f"Email: {inquiry['email']}",
                f"Company: {inquiry['company'] or '-'}",
                f"Service: {inquiry['service']}",
                f"Budget: {inquiry['budget'] or '-'}",
                "",
                str(inquiry["details"]),
            ]
        )
        jobs.append(
            (
                "https://api.resend.com/emails",
                {
                    "from": settings.from_email,
                    "to": [settings.to_email],
                    "reply_to": inquiry["email"],
                    "subject": f"New inquiry: {inquiry['service']} ({inquiry['name']})",
                    "text": text,
                },
                {"authorization": f"Bearer {settings.resend_api_key}"},
            )
        )

    with ThreadPoolExecutor(max_workers=max(1, len(jobs))) as executor:
        results = list(executor.map(lambda job: _post_json(*job), jobs))
    return any(results)
