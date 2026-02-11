# Browser Chat UI

A lightweight browser-only chat client that calls a hosted LLM endpoint via `fetch`.

## Files

- `index.html` – chat transcript, composer, status indicator, and settings form.
- `styles.css` – mobile-friendly styling, message bubbles, loading state, and error banners.
- `app.js` – chat state/history management, rendering, request handling, and API error handling.

## Setup

1. Serve this folder locally with any static file server (for example: `python3 -m http.server 8000`).
2. Open `http://localhost:8000` in your browser.
3. In **Settings**, provide:
   - Provider: `OpenRouter`
   - Model: any free-route model (default: `meta-llama/llama-3.1-8b-instruct:free`)
   - API key: your OpenRouter key
4. Click **Save Settings**.
5. Enter a prompt and click **Send**.

## Notes

- This project uses OpenRouter's chat completions endpoint (`/api/v1/chat/completions`) from browser JavaScript.
- API errors are surfaced for invalid keys, rate limits, provider failures, empty responses, and network/CORS issues.
- Your key is saved to `localStorage` only for convenience in local testing.
- For production use, **you must supply and secure your own API key and should proxy requests through a backend** to avoid exposing credentials client-side.
