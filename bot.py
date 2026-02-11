import json
import os
from pathlib import Path

import requests
import tweepy

STATE_PATH = Path("state.json")

SYSTEM_PROMPT = (
    "You are an elite X growth strategist and writer. "
    "Write high-signal content that earns followers by teaching practical insights, "
    "clear opinions, and actionable frameworks. Keep it human, specific, and not clickbait."
)


def env(name: str, default: str | None = None) -> str:
    value = os.getenv(name, default)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {"since_mention_id": None, "replied_mentions": []}
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def openrouter_chat(system_prompt: str, user_prompt: str) -> str:
    api_key = env("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")

    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.8,
        },
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    text = data["choices"][0]["message"]["content"].strip()
    return text[:280].strip()


def create_clients() -> tuple[tweepy.Client, tweepy.API]:
    api_key = env("X_API_KEY")
    api_secret = env("X_API_SECRET")
    access_token = env("X_ACCESS_TOKEN")
    access_token_secret = env("X_ACCESS_TOKEN_SECRET")
    bearer_token = env("X_BEARER_TOKEN")

    client = tweepy.Client(
        bearer_token=bearer_token,
        consumer_key=api_key,
        consumer_secret=api_secret,
        access_token=access_token,
        access_token_secret=access_token_secret,
        wait_on_rate_limit=True,
    )

    auth = tweepy.OAuth1UserHandler(api_key, api_secret, access_token, access_token_secret)
    api_v1 = tweepy.API(auth, wait_on_rate_limit=True)
    return client, api_v1


def generate_main_post(niche: str, style: str) -> str:
    prompt = (
        f"Niche: {niche}\n"
        f"Style: {style}\n\n"
        "Write one X post under 280 chars that delivers real value and sparks discussion. "
        "Prefer concrete lessons, short frameworks, or contrarian-but-true insights. "
        "Do not use emojis unless essential."
    )
    return openrouter_chat(SYSTEM_PROMPT, prompt)


def generate_reply(niche: str, style: str, original_text: str, author_username: str) -> str:
    prompt = (
        f"Niche: {niche}\n"
        f"Style: {style}\n"
        f"Replying to @{author_username} who wrote: {original_text}\n\n"
        "Write a helpful, friendly reply under 260 chars that adds value and encourages engagement. "
        "No generic fluff. No hashtags unless highly relevant."
    )
    return openrouter_chat(SYSTEM_PROMPT, prompt)


def post_main_tweet(client: tweepy.Client, niche: str, style: str) -> None:
    text = generate_main_post(niche, style)
    created = client.create_tweet(text=text)
    tweet_id = created.data["id"] if created and created.data else "unknown"
    print(f"Posted main tweet: {tweet_id} | {text}")


def respond_to_mentions(
    state: dict,
    client: tweepy.Client,
    api_v1: tweepy.API,
    niche: str,
    style: str,
    max_replies: int,
) -> None:
    me = api_v1.verify_credentials()
    if not me:
        raise RuntimeError("Unable to verify X credentials.")

    my_user_id = str(me.id)
    since_id = state.get("since_mention_id")

    kwargs = {
        "id": my_user_id,
        "tweet_fields": ["author_id", "conversation_id", "created_at"],
        "expansions": ["author_id"],
        "user_fields": ["username"],
        "max_results": min(max_replies * 3, 100),
    }
    if since_id:
        kwargs["since_id"] = since_id

    mentions = client.get_users_mentions(**kwargs)
    if not mentions.data:
        print("No new mentions.")
        return

    user_map = {}
    if mentions.includes and "users" in mentions.includes:
        for u in mentions.includes["users"]:
            user_map[str(u.id)] = u.username

    replied_mentions = set(state.get("replied_mentions", []))
    latest_id = since_id
    replies_sent = 0

    for mention in sorted(mentions.data, key=lambda t: int(t.id)):
        mention_id = str(mention.id)
        latest_id = mention_id

        if mention_id in replied_mentions:
            continue

        author_id = str(mention.author_id)
        if author_id == my_user_id:
            continue

        author_username = user_map.get(author_id, "creator")
        reply_text = generate_reply(niche, style, mention.text, author_username)

        try:
            client.create_tweet(text=reply_text, in_reply_to_tweet_id=mention_id)
            replied_mentions.add(mention_id)
            replies_sent += 1
            print(f"Replied to mention {mention_id}: {reply_text}")
        except Exception as exc:
            print(f"Failed replying to {mention_id}: {exc}")

        if replies_sent >= max_replies:
            break

    state["since_mention_id"] = latest_id
    state["replied_mentions"] = sorted(replied_mentions)[-5000:]


def main() -> None:
    niche = os.getenv("BOT_NICHE", "AI productivity and creator growth")
    style = os.getenv(
        "BOT_STYLE",
        "concise, useful, slightly witty, no hashtags unless relevant",
    )
    max_replies = int(os.getenv("BOT_MAX_REPLIES_PER_RUN", "15"))

    state = load_state()
    client, api_v1 = create_clients()

    post_main_tweet(client, niche, style)
    respond_to_mentions(state, client, api_v1, niche, style, max_replies)
    save_state(state)


if __name__ == "__main__":
    main()
