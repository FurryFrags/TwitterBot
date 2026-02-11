# Free X (Twitter) Growth Bot

This repo contains a **100% free-to-run AI bot** that:

1. Posts on X every 5 hours.
2. Replies to mentions/replies.
3. Focuses on follower growth with high-value, niche-friendly content.

It is designed for people who cannot run local commands continuously by using **GitHub Actions** as the scheduler.

## How it works

- `bot.py` runs one cycle:
  - Generates one post using a free LLM endpoint (`OpenRouter` free models).
  - Publishes to X.
  - Fetches new mentions and replies to each once.
  - Stores state in `state.json` to avoid duplicate replies.
- `.github/workflows/run-bot.yml` triggers every 5 hours.

## Cost

- Hosting/scheduling: GitHub Actions (free tier).
- AI generation: OpenRouter free models (`:free`) with API key.
- X access: X API keys (requires developer account).

## 1) Create X API credentials

Create a developer app and collect:

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`
- `X_BEARER_TOKEN`

## 2) Create OpenRouter API key

Create a key at OpenRouter and set:

- `OPENROUTER_API_KEY`

Default free model in code:

- `meta-llama/llama-3.1-8b-instruct:free`

You can change with `OPENROUTER_MODEL`.

## 3) Add GitHub repository secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

Add all keys above.

Optional:

- `BOT_NICHE` (default: `AI productivity and creator growth`)
- `BOT_STYLE` (default: `concise, useful, slightly witty, no hashtags unless relevant`)
- `BOT_MAX_REPLIES_PER_RUN` (default: `15`)

## 4) Enable workflow

Push this repo to GitHub and enable Actions. The workflow will run every 5 hours automatically.

You can also run manually from the Actions tab.

## Safety and growth notes

- Replies avoid spam by being context-aware and limited per run.
- Bot ignores its own tweets.
- Keep outputs human-like and helpful to improve follow rates.
- Rotate niche prompts occasionally and review output quality weekly.

## Local run (optional)

```bash
pip install -r requirements.txt
python bot.py
```

## Important

Follow X automation rules and local law. You are responsible for account compliance.
