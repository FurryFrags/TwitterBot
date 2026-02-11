const providers = {
  openrouter: {
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyPlaceholder: "sk-or-v1-...",
    models: [
      { id: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B Instruct (free)" },
      { id: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B Instruct (free)" },
    ],
    buildHeaders: ({ apiKey }) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Browser Chat UI",
    }),
    buildPayload: ({ model, messages }) => ({
      model,
      messages,
      stream: false,
    }),
    normalizeResponse: (payload) => {
      const content = payload?.choices?.[0]?.message?.content;

      if (Array.isArray(content)) {
        return {
          role: "assistant",
          content: content
            .map((chunk) => (typeof chunk === "string" ? chunk : chunk?.text || ""))
            .join("")
            .trim(),
        };
      }

      if (typeof content !== "string") {
        throw new Error("Provider returned an unexpected response format.");
      }

      return { role: "assistant", content };
    },
  },
  huggingface: {
    label: "Hugging Face",
    endpoint: "https://router.huggingface.co/v1/chat/completions",
    keyPlaceholder: "hf_...",
    models: [
      { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct" },
      { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct v0.3" },
    ],
    buildHeaders: ({ apiKey }) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    buildPayload: ({ model, messages }) => ({
      model,
      messages,
      stream: false,
    }),
    normalizeResponse: (payload) => {
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("Provider returned an unexpected response format.");
      }
      return { role: "assistant", content };
    },
  },
};

const providerOrder = Object.keys(providers);

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
  fallbackNotice: document.getElementById("fallbackNotice"),
};

const STORAGE_KEY = "browser-chat-settings";

bootstrap();

function bootstrap() {
  populateProviderOptions();
  restoreSettings();
  syncProviderUi();
  render();

  els.saveSettings.addEventListener("click", () => {
    persistSettings();
    setStatus("idle", "Settings saved");
    clearError();
  });

  els.provider.addEventListener("change", () => {
    syncProviderUi();
    persistSettings();
  });

  els.chatForm.addEventListener("submit", onSubmit);
}

function populateProviderOptions() {
  els.provider.innerHTML = "";
  for (const [providerId, providerConfig] of Object.entries(providers)) {
    const option = document.createElement("option");
    option.value = providerId;
    option.textContent = `${providerConfig.label} (free-tier options)`;
    els.provider.appendChild(option);
  }
}

function syncProviderUi() {
  const providerConfig = providers[els.provider.value] || providers[providerOrder[0]];
  els.apiKey.placeholder = providerConfig.keyPlaceholder;
  populateModelOptions(els.provider.value);
}

function populateModelOptions(providerId) {
  const providerConfig = providers[providerId] || providers[providerOrder[0]];
  const currentModel = els.model.value;
  els.model.innerHTML = "";

  for (const model of providerConfig.models) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label;
    els.model.appendChild(option);
  }

  const matchingModel = providerConfig.models.find((model) => model.id === currentModel);
  els.model.value = matchingModel ? matchingModel.id : providerConfig.models[0].id;
}

function restoreSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.provider && providers[saved.provider]) {
      els.provider.value = saved.provider;
    } else {
      els.provider.value = providerOrder[0];
    }

    if (saved.apiKeys && typeof saved.apiKeys === "object") {
      els.apiKey.value = saved.apiKeys[els.provider.value] || "";
    }

    populateModelOptions(els.provider.value);
    if (saved.models && typeof saved.models === "object" && saved.models[els.provider.value]) {
      const savedModel = saved.models[els.provider.value];
      const supportsSavedModel = providers[els.provider.value].models.some((model) => model.id === savedModel);
      if (supportsSavedModel) {
        els.model.value = savedModel;
      }
    }
  } catch {
    els.provider.value = providerOrder[0];
    populateModelOptions(els.provider.value);
    // Ignore malformed localStorage and continue with defaults.
  }
}

function persistSettings() {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  const apiKeys = { ...(existing.apiKeys || {}) };
  const models = { ...(existing.models || {}) };

  apiKeys[els.provider.value] = els.apiKey.value.trim();
  models[els.provider.value] = els.model.value;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      provider: els.provider.value,
      apiKeys,
      models,
    })
  );
}

function getStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
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

function setFallbackNotice(message = "") {
  els.fallbackNotice.hidden = !message;
  els.fallbackNotice.textContent = message;
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
  setFallbackNotice("");

  const text = els.message.value.trim();
  const provider = els.provider.value;
  const model = els.model.value;
  const selectedApiKey = els.apiKey.value.trim();

  if (!text) {
    setError("Please enter a message.");
    return;
  }

  if (!selectedApiKey) {
    setError("Missing API key for the selected provider.");
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
    const assistantReply = await fetchAssistantResponseWithFallback({
      primaryProvider: provider,
      primaryModel: model,
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

async function fetchAssistantResponseWithFallback({ primaryProvider, primaryModel }) {
  const settings = getStoredSettings();
  const providerSequence = [
    primaryProvider,
    ...providerOrder.filter((providerId) => providerId !== primaryProvider),
  ];

  let lastFailure = null;

  for (const providerId of providerSequence) {
    const providerConfig = providers[providerId];
    const apiKey = settings?.apiKeys?.[providerId] || "";
    if (!apiKey) {
      continue;
    }

    const model = providerId === primaryProvider
      ? primaryModel
      : settings?.models?.[providerId] || providerConfig.models[0].id;

    try {
      const message = await requestProvider({ providerId, apiKey, model });
      if (providerId !== primaryProvider) {
        setFallbackNotice(
          `Primary provider failed. Response served by ${providerConfig.label} (${model}).`
        );
      }
      return message.content;
    } catch (error) {
      lastFailure = error;
      const canFallback = [401, 429].includes(error.status) || (error.status >= 500 && error.status <= 599);
      if (!canFallback) {
        throw error;
      }
    }
  }

  throw lastFailure || new Error("No configured provider with a valid API key is available.");
}

async function requestProvider({ providerId, apiKey, model }) {
  const providerConfig = providers[providerId];

  if (!providerConfig) {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  const messages = state.history
    .filter((turn) => !turn.loading)
    .map(({ role, content }) => ({ role, content }));

  let response;
  try {
    response = await fetch(providerConfig.endpoint, {
      method: "POST",
      headers: providerConfig.buildHeaders({ apiKey }),
      body: JSON.stringify(providerConfig.buildPayload({ model, messages })),
    });
  } catch {
    throw new Error(
      "Network/CORS failure while reaching the provider. Check connectivity and whether the endpoint allows browser requests."
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    const nonJsonError = new Error(`Provider returned non-JSON response (HTTP ${response.status}).`);
    nonJsonError.status = response.status;
    throw nonJsonError;
  }

  if (!response.ok) {
    const providerMessage = payload?.error?.message || payload?.message || "Unknown provider error.";
    let errorMessage = `Provider error (${response.status}): ${providerMessage}`;

    if (response.status === 401 || response.status === 403) {
      errorMessage = "Invalid or unauthorized API key. Verify your key and model permissions.";
    } else if (response.status === 429) {
      errorMessage = "Rate limit hit on the provider. Please wait and retry.";
    }

    const providerError = new Error(errorMessage);
    providerError.status = response.status;
    throw providerError;
  }

  return providerConfig.normalizeResponse(payload);
}
