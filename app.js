const state = {
  history: [],
  waiting: false,
};

const els = {
  provider: document.getElementById("provider"),
  model: document.getElementById("model"),
  apiKey: document.getElementById("apiKey"),
  saveSettings: document.getElementById("saveSettings"),
  chatForm: document.getElementById("chatForm"),
  message: document.getElementById("message"),
  sendButton: document.getElementById("sendButton"),
  status: document.getElementById("status"),
  transcript: document.getElementById("transcript"),
  errorBanner: document.getElementById("errorBanner"),
};

const STORAGE_KEY = "browser-chat-settings";

bootstrap();

function bootstrap() {
  restoreSettings();
  render();

  els.saveSettings.addEventListener("click", () => {
    persistSettings();
    setStatus("idle", "Settings saved");
    clearError();
  });

  els.chatForm.addEventListener("submit", onSubmit);
}

function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.provider) els.provider.value = saved.provider;
    if (saved.model) els.model.value = saved.model;
    if (saved.apiKey) els.apiKey.value = saved.apiKey;
  } catch {
    // Ignore malformed localStorage and continue with defaults.
  }
}

function persistSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      provider: els.provider.value,
      model: els.model.value.trim(),
      apiKey: els.apiKey.value.trim(),
    })
  );
}

function setStatus(kind, text) {
  els.status.className = `status ${kind}`;
  els.status.textContent = text;
}

function setError(message) {
  els.errorBanner.hidden = false;
  els.errorBanner.textContent = message;
  setStatus("error", "Error");
}

function clearError() {
  els.errorBanner.hidden = true;
  els.errorBanner.textContent = "";
}

function render() {
  els.transcript.innerHTML = "";
  if (state.history.length === 0) {
    const welcome = document.createElement("p");
    welcome.className = "help-text";
    welcome.textContent = "No messages yet. Start the conversation below.";
    els.transcript.appendChild(welcome);
    return;
  }

  for (const turn of state.history) {
    const bubble = document.createElement("div");
    bubble.className = `message ${turn.role}${turn.loading ? " loading" : ""}`;
    bubble.textContent = turn.content;
    bubble.setAttribute("data-role", turn.role);
    els.transcript.appendChild(bubble);
  }

  els.transcript.scrollTop = els.transcript.scrollHeight;
}

function addMessage(role, content, loading = false) {
  state.history.push({ role, content, loading });
  render();
}

function updateLastAssistant(content, loading = false) {
  for (let i = state.history.length - 1; i >= 0; i -= 1) {
    if (state.history[i].role === "assistant") {
      state.history[i].content = content;
      state.history[i].loading = loading;
      break;
    }
  }
  render();
}

function setWaiting(waiting) {
  state.waiting = waiting;
  els.sendButton.disabled = waiting;
  els.message.disabled = waiting;
  setStatus(waiting ? "sending" : "idle", waiting ? "Sending..." : "Idle");
}

async function onSubmit(event) {
  event.preventDefault();
  clearError();

  const text = els.message.value.trim();
  const apiKey = els.apiKey.value.trim();
  const model = els.model.value.trim();

  if (!text) {
    setError("Please enter a message.");
    return;
  }

  if (!apiKey) {
    setError("Missing API key. Add your provider key in Settings.");
    return;
  }

  if (!model) {
    setError("Model is required.");
    return;
  }

  persistSettings();
  addMessage("user", text);
  addMessage("assistant", "Thinking...", true);
  els.message.value = "";

  try {
    setWaiting(true);
    const assistantReply = await fetchAssistantResponse({
      apiKey,
      model,
      provider: els.provider.value,
    });

    if (!assistantReply || !assistantReply.trim()) {
      throw new Error("Received an empty response from the model.");
    }

    updateLastAssistant(assistantReply.trim(), false);
    setStatus("idle", "Response received");
  } catch (error) {
    updateLastAssistant("I ran into an error while generating a response.", false);
    setError(error.message || "Unknown error.");
  } finally {
    setWaiting(false);
    els.message.focus();
  }
}

async function fetchAssistantResponse({ provider, apiKey, model }) {
  const messages = state.history
    .filter((turn) => !turn.loading)
    .map(({ role, content }) => ({ role, content }));

  if (provider !== "openrouter") {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  let response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "Browser Chat UI",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });
  } catch (error) {
    throw new Error(
      "Network/CORS failure while reaching the provider. Check connectivity and whether the endpoint allows browser requests."
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Provider returned non-JSON response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const providerMessage = payload?.error?.message || payload?.message || "Unknown provider error.";

    if (response.status === 401 || response.status === 403) {
      throw new Error("Invalid or unauthorized API key. Verify your key and model permissions.");
    }

    if (response.status === 429) {
      throw new Error("Rate limit hit on the provider. Please wait and retry.");
    }

    throw new Error(`Provider error (${response.status}): ${providerMessage}`);
  }

  const content = payload?.choices?.[0]?.message?.content;

  if (Array.isArray(content)) {
    return content
      .map((chunk) => (typeof chunk === "string" ? chunk : chunk?.text || ""))
      .join("")
      .trim();
  }

  if (typeof content !== "string") {
    throw new Error("Provider returned an unexpected response format.");
  }

  return content;
}
