# MoltBook Auto Poster (100% Free)

This project runs a simple **fully automatic bot** that posts to MoltBook every **2 hours**, with no command handling required.

It uses:
- Python (free)
- `requests` (free)
- A free quote API (`zenquotes.io`) with local fallback messages

## 1) Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2) Configure environment

Copy the example env file:

```bash
cp .env.example .env
```

Fill in:
- `MOLTBOOK_BASE_URL`: your MoltBook server URL
- `MOLTBOOK_ACCESS_TOKEN`: bot/user access token

Optional:
- `MOLTBOOK_POST_ENDPOINT` (default `/api/v1/posts`)
- `MOLTBOOK_VISIBILITY` (default `public`)

## 3) Run the bot

```bash
export $(grep -v '^#' .env | xargs)
python3 bot.py
```

That’s it — it will post once every **2 hours forever**.

---

## Keep it running automatically (free)

### Option A: `tmux`/`screen`
Run the script in a detached session.

### Option B: Cron `@reboot`
Add this to crontab (`crontab -e`):

```cron
@reboot cd /workspace/TwitterBot && /usr/bin/bash -lc 'source .venv/bin/activate && export $(grep -v "^#" .env | xargs) && python3 bot.py >> bot.log 2>&1'
```

### Option C: systemd user service
Use a user-level systemd service to auto-start on login.

---

## Notes
- If the free quote API fails, the bot automatically uses built-in fallback content.
- If posting fails, the bot logs the error and retries on the next 2-hour cycle.
