// ---------------------------------------------------------------------------
// OpenWebClaw — Settings page (Enhanced)
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  Palette, KeyRound, Eye, EyeOff, Bot, MessageSquare,
  Smartphone, HardDrive, Lock, Check, Globe, Settings, MessageCircle, Terminal, Sparkles,
  ChevronRight, Shield, Zap, Server, X, ShieldCheck
} from 'lucide-react';
import { getConfig, setConfig } from '../../db.js';
import { CONFIG_KEYS } from '../../config.js';
import { getStorageEstimate, requestPersistentStorage } from '../../storage.js';
import { decryptValue } from '../../crypto.js';
import { getOrchestrator, useOrchestratorStore } from '../../stores/orchestrator-store.js';
import { useThemeStore, type ThemeChoice } from '../../stores/theme-store.js';
import { useAuthStore } from '../../stores/auth-store.js';

const MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'openwebui', label: 'Open WebUI' },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

// Section Card Component
function SectionCard({
  children,
  title,
  icon: Icon,
  className = ''
}: {
  children: React.ReactNode;
  title: string;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-base-100 border border-base-300/50 overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-base-300/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-base-200 text-base-content flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const ready = useOrchestratorStore((s) => s.ready as boolean);
  const orch = getOrchestrator();

  // API Key
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Model
  const [model, setModel] = useState(orch.getModel());

  // Ollama models (fetched from server)
  const [ollamaModels, setOllamaModels] = useState<{ value: string; label: string }[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  // Provider
  const [provider, setProvider] = useState(orch.getProvider());

  // Ollama URL
  const [ollamaUrl, setOllamaUrl] = useState(orch.getOllamaUrl());
  const [ollamaUrlSaved, setOllamaUrlSaved] = useState(false);

  // OpenWebUI
  const [openWebUIModels, setOpenWebUIModels] = useState<{ value: string; label: string }[]>([]);
  const [openWebUIModelsLoading, setOpenWebUIModelsLoading] = useState(false);
  const [openWebUIUrl, setOpenWebUIUrl] = useState(orch.getOpenWebUIUrl());
  const [openWebUIKey, setOpenWebUIKey] = useState('');
  const [openWebUIKeyMasked, setOpenWebUIKeyMasked] = useState(true);
  const [openWebUIKeySaved, setOpenWebUIKeySaved] = useState(false);

  // Assistant name
  const [assistantName, setAssistantName] = useState(orch.getAssistantName());

  // Telegram
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatIds, setTelegramChatIds] = useState('');
  const [telegramSaved, setTelegramSaved] = useState(false);

  // WhatsApp
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappAccessToken, setWhatsappAccessToken] = useState('');
  const [whatsappAccessTokenMasked, setWhatsappAccessTokenMasked] = useState(true);
  const [whatsappAllowedNumbers, setWhatsappAllowedNumbers] = useState('');
  const [whatsappWebhookToken, setWhatsappWebhookToken] = useState('');
  const [whatsappSaved, setWhatsappSaved] = useState(false);

  // Storage
  const [storageUsage, setStorageUsage] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  const [isPersistent, setIsPersistent] = useState(false);
  const [storageLoading, setStorageLoading] = useState(false);

  // Theme
  const { theme, setTheme } = useThemeStore();

  // Load current values
  useEffect(() => {
    async function load() {
      // API key
      const encKey = await getConfig(CONFIG_KEYS.ANTHROPIC_API_KEY);
      if (encKey) {
        try {
          const dec = await decryptValue(encKey);
          setApiKey(dec);
        } catch {
          setApiKey('');
        }
      }

      // Provider
      const prov = await getConfig(CONFIG_KEYS.PROVIDER);
      if (prov) {
        setProvider(prov as any);
        if (prov === 'ollama') {
          try {
            const models = await orch.fetchOllamaModels();
            setOllamaModels(models);
            if (models.length === 0) {
              setOllamaError('No models returned – check your Ollama URL or server status.');
            } else {
              setOllamaError(null);
            }
          } catch (e) {
            setOllamaError(String(e));
          }
        } else if (prov === 'openwebui') {
          const models = await orch.fetchOpenWebUIModels();
          setOpenWebUIModels(models);
        }
      }

      // Ollama URL
      const ollama = await getConfig(CONFIG_KEYS.OLLAMA_URL);
      if (ollama) setOllamaUrl(ollama);

      // OpenWebUI URLs & Keys
      const owuiUrl = await getConfig(CONFIG_KEYS.OPENWEBUI_URL);
      if (owuiUrl) setOpenWebUIUrl(owuiUrl);
      const owuiKey = await getConfig(CONFIG_KEYS.OPENWEBUI_API_KEY);
      if (owuiKey) {
        try {
          setOpenWebUIKey(await decryptValue(owuiKey));
        } catch {
          setOpenWebUIKey('');
        }
      }

      // Telegram
      const token = await getConfig(CONFIG_KEYS.TELEGRAM_BOT_TOKEN);
      if (token) setTelegramToken(token);
      const chatIds = await getConfig(CONFIG_KEYS.TELEGRAM_CHAT_IDS);
      if (chatIds) {
        try {
          setTelegramChatIds(JSON.parse(chatIds).join(', '));
        } catch {
          setTelegramChatIds(chatIds);
        }
      }

      // WhatsApp
      const waPhoneId = await getConfig(CONFIG_KEYS.WHATSAPP_PHONE_NUMBER_ID);
      if (waPhoneId) setWhatsappPhoneNumberId(waPhoneId);
      const waToken = await getConfig(CONFIG_KEYS.WHATSAPP_ACCESS_TOKEN);
      if (waToken) {
        try {
          setWhatsappAccessToken(await decryptValue(waToken));
        } catch {
          setWhatsappAccessToken('');
        }
      }
      const waWebhookToken = await getConfig(CONFIG_KEYS.WHATSAPP_WEBHOOK_TOKEN);
      if (waWebhookToken) setWhatsappWebhookToken(waWebhookToken);
      const waNumbers = await getConfig(CONFIG_KEYS.WHATSAPP_ALLOWED_NUMBERS);
      if (waNumbers) {
        try {
          setWhatsappAllowedNumbers(JSON.parse(waNumbers).join(', '));
        } catch {
          setWhatsappAllowedNumbers(waNumbers);
        }
      }


      // Storage
      const est = await getStorageEstimate();
      setStorageUsage(est.usage);
      setStorageQuota(est.quota);
      if (navigator.storage?.persisted) {
        setIsPersistent(await navigator.storage.persisted());
      }
    }
    load();
  }, []);

  async function handleSaveApiKey() {
    await orch.setApiKey(apiKey.trim());
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  async function handleModelChange(value: string) {
    setModel(value);
    await orch.setModel(value);
  }

  async function handleProviderChange(value: string) {
    setProvider(value as 'anthropic' | 'ollama' | 'openwebui');
    await orch.setProvider(value as 'anthropic' | 'ollama' | 'openwebui');
    if (value === 'ollama') {
      loadOllamaModels();
    } else if (value === 'openwebui') {
      loadOpenWebUIModels();
    }
  }

  async function loadOpenWebUIModels() {
    setOpenWebUIModelsLoading(true);
    const models = await orch.fetchOpenWebUIModels();
    setOpenWebUIModels(models);
    setOpenWebUIModelsLoading(false);
  }

  async function handleOpenWebUIUrlChange(value: string) {
    setOpenWebUIUrl(value);
    await orch.setOpenWebUIUrl(value);
    loadOpenWebUIModels();
  }

  async function handleSaveOpenWebUIKey() {
    await orch.setOpenWebUIKey(openWebUIKey.trim());
    setOpenWebUIKeySaved(true);
    setTimeout(() => setOpenWebUIKeySaved(false), 2000);
    loadOpenWebUIModels();
  }

  async function loadOllamaModels() {
    setOllamaModelsLoading(true);
    try {
      const models = await orch.fetchOllamaModels();
      setOllamaModels(models);
      setOllamaError(models.length === 0 ? 'No models returned – verify URL/server.' : null);
    } catch (e) {
      setOllamaError(String(e));
    }
    setOllamaModelsLoading(false);
  }

  async function handleOllamaUrlSave() {
    await orch.setOllamaUrl(ollamaUrl.trim());
    setOllamaUrlSaved(true);
    setTimeout(() => setOllamaUrlSaved(false), 2000);
    loadOllamaModels();
  }

  async function handleNameSave() {
    await orch.setAssistantName(assistantName.trim());
  }

  async function handleTelegramSave() {
    const ids = telegramChatIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await orch.configureTelegram(telegramToken.trim(), ids);
    setTelegramSaved(true);
    setTimeout(() => setTelegramSaved(false), 2000);
  }

  async function handleWhatsAppSave() {
    const numbers = whatsappAllowedNumbers
      .split(',')
      .map((s) => s.trim().replace(/\D/g, '')) // Remove non-digits
      .filter(Boolean);
    await orch.configureWhatsApp({
      phoneNumberId: whatsappPhoneNumberId.trim(),
      accessToken: whatsappAccessToken.trim(),
      webhookVerifyToken: whatsappWebhookToken.trim() || undefined,
      allowedNumbers: numbers,
    });
    setWhatsappSaved(true);
    setTimeout(() => setWhatsappSaved(false), 2000);
  }

  // WhatsApp test state
  const [whatsappTestStatus, setWhatsappTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [whatsappTestError, setWhatsappTestError] = useState('');



  async function handleWhatsAppTest() {
    setWhatsappTestStatus('testing');
    setWhatsappTestError('');
    try {
      const result = await orch.testWhatsAppConnection();
      if (result.success) {
        setWhatsappTestStatus('success');
      } else {
        setWhatsappTestStatus('error');
        setWhatsappTestError(result.error || 'Unknown error');
      }
    } catch (err) {
      setWhatsappTestStatus('error');
      setWhatsappTestError(err instanceof Error ? err.message : String(err));
    }
    // Reset status after 5 seconds
    setTimeout(() => setWhatsappTestStatus('idle'), 5000);
  }




  // matrix removed

  async function handleRequestPersistent() {
    setStorageLoading(true);
    try {
      const granted = await requestPersistentStorage();
      setIsPersistent(granted);
      if (!granted) {
        // Re-check persistence status in case browser granted it
        if (navigator.storage?.persisted) {
          setIsPersistent(await navigator.storage.persisted());
        }
      }
    } finally {
      setStorageLoading(false);
    }
  }

  const storagePercent = storageQuota > 0 ? (storageUsage / storageQuota) * 100 : 0;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center">
          <Settings className="w-5 h-5 text-base-content" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-base-content">Settings</h2>
          <p className="text-sm text-base-content/50">Configure your AI assistant</p>
        </div>
      </div>
      {!ready && (
        <div className="alert bg-base-200 border border-base-300 text-base-content mb-4">
          <span>Initializing backend&nbsp;— some fields may be unavailable.</span>
        </div>
      )}

      {/* Theme */}
      <SectionCard title="Appearance" icon={Palette}>
        <fieldset className="fieldset">
          <legend className="fieldset-legend text-sm">Theme</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`btn btn-sm ${theme === t ? 'btn-outline' : 'btn-ghost bg-base-200/50'}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
      </SectionCard>

      {/* Provider */}
      <SectionCard title="AI Provider" icon={Bot}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              onClick={() => handleProviderChange(p.value)}
              className={`btn btn-sm justify-start ${provider === p.value ? 'btn-outline' : 'btn-ghost bg-base-200/50'}`}
            >
              <Zap className={`w-4 h-4 mr-2 ${provider === p.value ? 'text-base-content' : 'text-base-content/70'}`} />
              {p.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* API Key (Anthropic only) */}
      {provider === 'anthropic' && (
        <SectionCard title="Anthropic API Key" icon={KeyRound}>
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={apiKeyMasked ? 'password' : 'text'}
                className="input input-bordered input-sm w-full font-mono pr-10"
                placeholder="sk-ant-..."
                value={apiKey}
                autoComplete="new-password"
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                onClick={() => setApiKeyMasked(!apiKeyMasked)}
              >
                {apiKeyMasked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
          </form>

          <div className="flex items-center gap-3 mt-3">
            <button
              className="btn btn-outline btn-sm"
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim()}
            >
              <Shield className="w-4 h-4 mr-1" />
              Save Securely
            </button>
            {apiKeySaved && (
              <span className="text-base-content text-sm flex items-center gap-1 animate-in fade-in">
                <Check className="w-4 h-4" /> Encrypted &amp; Saved
              </span>
            )}
          </div>

          <p className="text-xs text-base-content/50 mt-2">
            Your API key is encrypted with AES-256-GCM and stored locally. It never leaves your browser.
          </p>
        </SectionCard>
      )}

      {/* Model */}
      <SectionCard title="Model" icon={Bot}>
        <select
          className="select select-bordered select-sm w-full"
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={(provider === 'ollama' && ollamaModelsLoading) || (provider === 'openwebui' && openWebUIModelsLoading)}
        >
          {provider === 'ollama' ? (
            ollamaModels.length > 0 ? (
              ollamaModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))
            ) : (
              <option value="">No models found</option>
            )
          ) : provider === 'openwebui' ? (
            openWebUIModels.length > 0 ? (
              openWebUIModels.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))
            ) : (
              <option value="">No models found</option>
            )
          ) : (
            MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))
          )}
        </select>
        {((provider === 'ollama' && ollamaModelsLoading) || (provider === 'openwebui' && openWebUIModelsLoading)) && (
          <span className="text-xs text-base-content/50 flex items-center gap-1">
            <span className="loading loading-spinner loading-xs" />
            Loading models...
          </span>
        )}
      </SectionCard>

      {/* Ollama URL (Ollama only) */}
      {provider === 'ollama' && (
        <SectionCard title="Ollama URL" icon={Globe}
        >
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered input-sm flex-1 font-mono"
              placeholder="http://localhost:11434"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOllamaUrlSave()}
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={handleOllamaUrlSave}
              disabled={!ollamaUrl.trim() || ollamaModelsLoading}
            >
              {ollamaModelsLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Connect
            </button>
          </div>
          {ollamaUrlSaved && (
            <span className="text-base-content text-sm flex items-center gap-1 mt-2 animate-in fade-in">
              <Check className="w-4 h-4" /> Connected
            </span>
          )}
          {ollamaError && (
            <p className="text-xs text-error mt-2">{ollamaError}</p>
          )}
          <p className="text-xs text-base-content/50 mt-2">
            URL where Ollama is running. Default: http://localhost:11434
            <br />
            <span className="text-base-content/70">Note: If running locally, ensure you start Ollama with <code className="bg-base-300 px-1 rounded">OLLAMA_ORIGINS="*"</code> to avoid CORS errors.</span>
          </p>
        </SectionCard>
      )}

      {/* OpenWebUI Config */}
      {provider === 'openwebui' && (
        <SectionCard title="Open WebUI" icon={Server}>
          <div className="space-y-4">
            <div>
              <label className="fieldset-legend text-sm mb-2">URL</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full font-mono"
                placeholder="https://example.com"
                value={openWebUIUrl}
                onChange={(e) => setOpenWebUIUrl(e.target.value)}
                onBlur={() => handleOpenWebUIUrlChange(openWebUIUrl)}
              />
              <p className="text-xs text-base-content/50 mt-1">
                URL where Open WebUI is running
              </p>
            </div>

            <div>
              <label className="fieldset-legend text-sm mb-2">API Key</label>
              <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={openWebUIKeyMasked ? 'password' : 'text'}
                    className="input input-bordered input-sm w-full font-mono pr-10"
                    placeholder="sk-..."
                    value={openWebUIKey}
                    autoComplete="new-password"
                    onChange={(e) => setOpenWebUIKey(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                    onClick={() => setOpenWebUIKeyMasked(!openWebUIKeyMasked)}
                  >
                    {openWebUIKeyMasked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                </div>
              </form>
              <div className="flex items-center gap-2 mt-2">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleSaveOpenWebUIKey}
                  disabled={!openWebUIKey.trim()}
                >
                  <Shield className="w-4 h-4 mr-1" /> Save
                </button>
                {openWebUIKeySaved && (
                  <span className="text-base-content text-sm flex items-center gap-1 animate-in fade-in">
                    <Check className="w-4 h-4" /> Saved
                  </span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Assistant Name */}
      <SectionCard title="Assistant Name" icon={MessageSquare}
      >
        <div className="flex gap-2">
          <input
            type="text"
            className="input input-bordered input-sm flex-1"
            placeholder="Momo"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            onBlur={handleNameSave}
          />
        </div>
        <p className="text-xs text-base-content/50">
          The name used for the assistant. Mention @{assistantName} to trigger a response.
        </p>
      </SectionCard>

      {/* Telegram */}
      <SectionCard title="Telegram Bot" icon={Smartphone}
      >
        <fieldset className="fieldset">
          <legend className="fieldset-legend text-sm">Bot Token</legend>
          <form onSubmit={(e) => e.preventDefault()}>
            <input
              type="password"
              className="input input-bordered input-sm w-full font-mono"
              placeholder="123456:ABC-DEF..."
              value={telegramToken}
              autoComplete="new-password"
              onChange={(e) => setTelegramToken(e.target.value)}
            />
          </form>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend text-sm">Allowed Chat IDs</legend>
          <input
            type="text"
            className="input input-bordered input-sm w-full font-mono"
            placeholder="-100123456, 789012"
            value={telegramChatIds}
            onChange={(e) => setTelegramChatIds(e.target.value)}
          />
          <p className="fieldset-label text-xs opacity-60">Comma-separated chat IDs</p>
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            className="btn btn-outline btn-sm"
            onClick={handleTelegramSave}
            disabled={!telegramToken.trim()}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Save Telegram Config
          </button>
          {telegramSaved && (
            <span className="text-base-content text-sm flex items-center gap-1 animate-in fade-in">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </SectionCard>

      {/* WhatsApp */}
      <SectionCard title="WhatsApp Business" icon={MessageCircle}
      >
        <fieldset className="fieldset">
          <legend className="fieldset-legend text-sm">Phone Number ID</legend>
          <input
            type="text"
            className="input input-bordered input-sm w-full font-mono"
            placeholder="123456789012345"
            value={whatsappPhoneNumberId}
            onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
          />
          <p className="fieldset-label text-xs opacity-60">From Meta Developer Portal</p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend text-sm">Access Token</legend>
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={whatsappAccessTokenMasked ? 'password' : 'text'}
                className="input input-bordered input-sm w-full font-mono pr-10"
                placeholder="EA..."
                value={whatsappAccessToken}
                autoComplete="new-password"
                onChange={(e) => setWhatsappAccessToken(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                onClick={() => setWhatsappAccessTokenMasked(!whatsappAccessTokenMasked)}
              >
                {whatsappAccessTokenMasked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
          </form>
          <p className="fieldset-label text-xs opacity-60">Temporary access token from Meta</p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend text-sm">Webhook Verify Token</legend>
          <input
            type="text"
            className="input input-bordered input-sm w-full font-mono"
            placeholder="my_verify_token"
            value={whatsappWebhookToken}
            onChange={(e) => setWhatsappWebhookToken(e.target.value)}
          />
          <p className="fieldset-label text-xs opacity-60">Your secret token for webhook verification</p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="fieldset-legend text-sm">Allowed Phone Numbers</legend>
          <input
            type="text"
            className="input input-bordered input-sm w-full font-mono"
            placeholder="49123456789, 436661234567"
            value={whatsappAllowedNumbers}
            onChange={(e) => setWhatsappAllowedNumbers(e.target.value)}
          />
          <p className="fieldset-label text-xs opacity-60">Comma-separated (with country code, no +)</p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="btn btn-outline btn-sm"
            onClick={handleWhatsAppSave}
            disabled={!whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim()}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Save WhatsApp Config
          </button>

          <button
            className={`btn btn-sm ${
              whatsappTestStatus === 'success' ? 'btn-outline' :
              whatsappTestStatus === 'error' ? 'btn-outline' :
              whatsappTestStatus === 'testing' ? 'btn-ghost loading' :
              'btn-outline'
            }`}
            onClick={handleWhatsAppTest}
            disabled={!whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || whatsappTestStatus === 'testing'}
          >
            {whatsappTestStatus === 'success' && <><Check className="w-4 h-4 mr-1" /> Connected</>}
            {whatsappTestStatus === 'error' && <><X className="w-4 h-4 mr-1" /> Failed</>}
            {whatsappTestStatus === 'testing' && 'Testing...'}
            {(whatsappTestStatus === 'idle' || whatsappTestStatus === 'success') && <><Zap className="w-4 h-4 mr-1" /> Test Connection</>}
          </button>

          {whatsappSaved && (
            <span className="text-base-content text-sm flex items-center gap-1 animate-in fade-in">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
        </div>

        {whatsappTestError && (
          <div className="alert bg-base-200 border border-base-300 text-base-content alert-sm mt-2">
            <span className="text-sm">{whatsappTestError}</span>
          </div>
        )}

        <details className="collapse collapse-arrow bg-base-300/30 rounded-xl mt-2">
          <summary className="collapse-title text-sm font-medium py-3">Setup Instructions</summary>
          <div className="collapse-content text-sm text-base-content/70 space-y-2 pb-4">
            <p><strong>1.</strong> Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener" className="link link-hover">Meta Developer Portal</a> and create an app</p>
            <p><strong>2.</strong> Add WhatsApp product to your app</p>
            <p><strong>3.</strong> Get Phone Number ID from WhatsApp → API Setup</p>
            <p><strong>4.</strong> Get a temporary Access Token (valid 24h) or set up a permanent one</p>
            <p><strong>5.</strong> Configure webhook URL pointing to your server</p>
            <p><strong>6.</strong> Add phone numbers that can message your bot</p>
          </div>
        </details>
      </SectionCard>


      <SectionCard title="Storage" icon={HardDrive}
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">{formatBytes(storageUsage)} used</span>
              <span className="text-base-content/50">of {formatBytes(storageQuota)}</span>
            </div>
            <div className="relative h-3 bg-base-300/50 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-base-content rounded-full transition-all duration-500"
                style={{ width: `${Math.min(storagePercent, 100)}%` }}
              />
            </div>
          </div>

          {!isPersistent ? (
            <button
              type="button"
              className="btn btn-outline btn-sm w-full sm:w-auto"
              onClick={handleRequestPersistent}
              disabled={storageLoading}
            >
              {storageLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {storageLoading ? 'Requesting...' : 'Request Persistent Storage'}
            </button>
          ) : (
            <div className="badge badge-outline badge-lg gap-2 py-3">
              <Lock className="w-4 h-4" />
              Persistent storage active
            </div>
          )}
        </div>
      </SectionCard>

      <PasswordSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change Password section (self-contained to avoid polluting main state)
// ---------------------------------------------------------------------------
function PasswordSection() {
  const changePassword = useAuthStore((s) => s.changePassword);
  const authError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Merge store error + local error
  const error = localError || authError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setSuccess(false);

    if (newPw !== confirmPw) {
      setLocalError('New passwords do not match.');
      return;
    }
    if (newPw.length < 4) {
      setLocalError('New password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(oldPw, newPw, confirmPw);
      // If no error was set, it succeeded
      if (!useAuthStore.getState().error) {
        setSuccess(true);
        setOldPw('');
        setNewPw('');
        setConfirmPw('');
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = oldPw.length >= 4 && newPw.length >= 4 && confirmPw.length >= 4 && !loading;

  return (
    <div className="rounded-xl bg-base-100 border border-base-300/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-base-300/50 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-base">Security</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Current password */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Current Password</label>
          <div className="relative">
            <input
              type={showOld ? 'text' : 'password'}
              className="input input-bordered input-sm w-full pr-10"
              placeholder="Enter current password"
              value={oldPw}
              autoComplete="current-password"
              onChange={(e) => setOldPw(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70"
              onClick={() => setShowOld(!showOld)}
              tabIndex={-1}
            >
              {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-sm font-medium mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              className="input input-bordered input-sm w-full pr-10"
              placeholder="Min. 4 characters"
              value={newPw}
              autoComplete="new-password"
              onChange={(e) => setNewPw(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70"
              onClick={() => setShowNew(!showNew)}
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm new password */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
          <input
            type="password"
            className="input input-bordered input-sm w-full"
            placeholder="Repeat new password"
            value={confirmPw}
            autoComplete="new-password"
            onChange={(e) => setConfirmPw(e.target.value)}
          />
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-base-content mt-1.5">Passwords do not match</p>
          )}
        </div>

        {/* Error / Success */}
        {error && (
          <div className="text-sm text-base-content bg-base-200 border border-base-300 rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm text-base-content bg-base-200 border border-base-300 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <Check className="w-4 h-4" /> Password changed successfully.
          </div>
        )}

        <button
          type="submit"
          className="btn btn-outline btn-sm"
          disabled={!canSubmit}
        >
          {loading ? <span className="loading loading-spinner loading-xs" /> : <Shield className="w-4 h-4" />}
          Change Password
        </button>
      </form>
    </div>
  );
}
