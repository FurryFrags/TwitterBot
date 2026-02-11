import os
import random
import time
from datetime import datetime, timezone

import requests

POST_INTERVAL_SECONDS = 2 * 60 * 60  # 2 hours
REQUEST_TIMEOUT_SECONDS = 20


class MoltBookBot:
    def __init__(self) -> None:
        self.base_url = os.getenv("MOLTBOOK_BASE_URL", "").rstrip("/")
        self.access_token = os.getenv("MOLTBOOK_ACCESS_TOKEN", "")
        self.post_endpoint = os.getenv("MOLTBOOK_POST_ENDPOINT", "/api/v1/posts")
        self.visibility = os.getenv("MOLTBOOK_VISIBILITY", "public")

        if not self.base_url:
            raise ValueError("Missing MOLTBOOK_BASE_URL environment variable")
        if not self.access_token:
            raise ValueError("Missing MOLTBOOK_ACCESS_TOKEN environment variable")

    def build_message(self) -> str:
        quote = self.fetch_free_quote()
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        return f"{quote}\n\n#MoltBookBot • {timestamp}"

    def fetch_free_quote(self) -> str:
        local_fallbacks = [
            "Keep moving. Small progress every day compounds into big results.",
            "Consistency beats intensity. Show up and do the work.",
            "Your future is built by what you repeat today.",
            "Start where you are, use what you have, do what you can.",
            "Discipline is choosing what you want most over what you want now.",
        ]

        free_quote_api = "https://zenquotes.io/api/random"
        try:
            response = requests.get(free_quote_api, timeout=REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, list) and payload:
                quote = payload[0].get("q", "").strip()
                author = payload[0].get("a", "").strip()
                if quote and author:
                    return f'"{quote}" — {author}'
                if quote:
                    return quote
        except Exception as err:
            print(f"[warn] Quote API failed, using fallback text: {err}")

        return random.choice(local_fallbacks)

    def post_update(self, message: str) -> None:
        url = f"{self.base_url}{self.post_endpoint}"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "content": message,
            "visibility": self.visibility,
        }

        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()

    def run_forever(self) -> None:
        print("[info] MoltBook bot started. Posting every 2 hours...")
        while True:
            try:
                message = self.build_message()
                self.post_update(message)
                print(f"[ok] Posted successfully at {datetime.now(timezone.utc).isoformat()}")
            except Exception as err:
                print(f"[error] Posting failed: {err}")

            time.sleep(POST_INTERVAL_SECONDS)


if __name__ == "__main__":
    bot = MoltBookBot()
    bot.run_forever()
