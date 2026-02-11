# Browser Chat UI

A lightweight browser-only chat client that calls hosted LLM endpoints via `fetch`.

## Files

- `index.html` – chat transcript, composer, status indicator, fallback notice, and settings form.
- `styles.css` – mobile-friendly styling, message bubbles, loading state, fallback notice banner, and error banners.
- `app.js` – provider abstraction, settings persistence, request handling, fallback logic, and response normalization.

## Setup

1. Serve this folder locally with any static file server (for example: `python3 -m http.server 8000`).
2. Open `http://localhost:8000` in your browser.
3. In **Settings**, provide:
   - Provider: `OpenRouter` or `Hugging Face`
   - Model: one of the listed free-tier options for the selected provider
   - API key: provider-specific API key (saved per provider)
4. Click **Save Settings**.
5. Enter a prompt and click **Send**.

## Provider + fallback behavior

- Requests are built through a `providers` config map (`openrouter`, `huggingface`) that defines endpoint, headers, payload shape, and response normalization.
- Provider responses are normalized to a shared message shape: `{ role, content }`.
- If the primary provider fails with `401`, `429`, or `5xx`, the app automatically tries the next configured provider that has a saved API key.
- When fallback is used, the UI shows a visible notice identifying the provider/model that responded.

## Known free-tier constraints

- **Rate limits**: free tiers may return `429` during spikes or after burst traffic.
- **Latency variability**: free pools can be slower than paid tiers, especially during peak times.
- **Occasional downtime**: endpoints can return transient `5xx` errors or model unavailability.
- **Quality variance**: free models/routes vary in reasoning quality, instruction-following, and output consistency.

## Notes

- API errors are surfaced for invalid keys, rate limits, provider failures, empty responses, and network/CORS issues.
- Keys and selected models are saved to `localStorage` only for convenience in local testing.
- For production use, **you must supply and secure your own API key and should proxy requests through a backend** to avoid exposing credentials client-side.
