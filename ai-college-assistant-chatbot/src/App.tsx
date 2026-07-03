import { useState, useRef, useEffect } from "react";
import { answerLocally } from "./localEngine";
import { askAI, loadConfig, saveConfig, hasAI, type AIConfig, type ChatTurn } from "./aiClient";

type Message = {
  id: number;
  role: "user" | "bot";
  content: string;
  time: string;
};

const QUICK_PROMPTS = [
  "Can I get CSE with rank 9000?",
  "Total cost for B.Tech with hostel and 92%",
  "Compare CSE and AIML",
  "I like electronics, which branch suits me?",
  "What is the highest placement package?",
  "Hostel rooms and mess fee",
];

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* Render lightweight markdown: **bold**, and "- " bullet lines */
function renderRich(text: string) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key} className="my-1.5 space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-blue-600" />
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      bullets.push(trimmed.replace(/^[-*]\s+/, ""));
    } else {
      flushBullets(`ul-${idx}`);
      if (trimmed) {
        blocks.push(
          <p key={`p-${idx}`} className="leading-relaxed">
            {renderInline(trimmed)}
          </p>
        );
      }
    }
  });
  flushBullets("ul-final");
  return <div className="space-y-2">{blocks}</div>;
}

function renderInline(text: string) {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function App() {
  const [config, setConfig] = useState<AIConfig>(loadConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "bot",
      content:
        "Hi! 👋 I'm the **KU College of Engineering and Technology** AI assistant. Ask me anything in your own words — admissions, cutoff ranks, fees, hostels, placements, or things like *\"Can I get CSE with rank 9000?\"* or *\"suggest a branch, I like coding\"*.",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  async function send(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || typing) return;

    const userMsg: Message = { id: Date.now(), role: "user", content: text, time: now() };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setTyping(true);

    // Build prior history for the AI (exclude the just-added user msg content duplication)
    const history: ChatTurn[] = messages
      .slice(1) // drop the initial greeting
      .map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.content }));

    let reply = "";
    try {
      if (hasAI(config)) {
        reply = await askAI(config, history, text);
      } else {
        // small delay for natural feel
        await new Promise((r) => setTimeout(r, 350 + Math.random() * 300));
        const local = answerLocally(text);
        reply = local.text + (local.bullets?.length ? "\n" + local.bullets.map((b) => "- " + b).join("\n") : "");
      }
    } catch (err) {
      const local = answerLocally(text);
      reply =
        `⚠️ *AI service error — showing offline answer instead.*\n\n` +
        local.text +
        (local.bullets?.length ? "\n" + local.bullets.map((b) => "- " + b).join("\n") : "");
    }

    const botMsg: Message = { id: Date.now() + 1, role: "bot", content: reply, time: now() };
    setMessages((prev) => [...prev, botMsg]);
    setTyping(false);
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-800 antialiased">
      {/* Header */}
      <header className="flex-none border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-slate-900 text-base font-bold tracking-tighter text-white">
              KU
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight tracking-tight text-slate-900 sm:text-base">
                KU College of Engineering and Technology
              </h1>
              <p className="text-xs font-medium text-slate-500">AI Campus Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex ${
                hasAI(config)
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                  : "bg-amber-50 text-amber-700 border border-amber-200/70"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${hasAI(config) ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              {hasAI(config) ? "AI Connected" : "Offline mode"}
            </span>
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              aria-label="Settings"
              title="Connect AI model"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Chat container */}
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full max-w-4xl flex-col border-x border-slate-200 bg-white">
          {/* Messages */}
          <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-semibold ${
                    m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-900 text-white"
                  }`}
                >
                  {m.role === "user" ? "You" : "KU"}
                </div>
                <div className={`flex max-w-[85%] flex-col sm:max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      m.role === "user"
                        ? "rounded-tr-sm bg-blue-600 text-white"
                        : "rounded-tl-sm border border-slate-200/70 bg-slate-100 text-slate-800"
                    }`}
                  >
                    {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : renderRich(m.content)}
                  </div>
                  <span className="mt-1 px-1 text-[11px] text-slate-400">{m.time}</span>
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                  KU
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-slate-200/70 bg-slate-100 px-4 py-3.5">
                  <div className="flex gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts */}
          <div className="flex-none border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-6">
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
              <span className="whitespace-nowrap text-xs font-medium text-slate-400">Try:</span>
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  disabled={typing}
                  className="flex-none rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="flex-none border-t border-slate-200 bg-white p-3.5 sm:p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2 sm:gap-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything… e.g. 'Which branch is best if I like AI?'"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-900"
              >
                <span className="hidden sm:inline">Send</span>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </main>

      {showSettings && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onSave={(c) => {
            setConfig(c);
            saveConfig(c);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Settings modal ---------------- */
function SettingsModal({
  config,
  onClose,
  onSave,
}: {
  config: AIConfig;
  onClose: () => void;
  onSave: (c: AIConfig) => void;
}) {
  const [draft, setDraft] = useState<AIConfig>(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Connect an AI model</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Add an OpenAI-compatible API key so the bot can answer <strong>any</strong> question with true language
          understanding. Without a key it uses a smart built-in offline engine. Your key is stored only in this browser.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">API Key</span>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Base URL</span>
            <input
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Model</span>
            <input
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder="gpt-4o-mini"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => onSave({ apiKey: "", baseUrl: draft.baseUrl, model: draft.model })}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Use offline mode
          </button>
          <button
            onClick={() => onSave(draft)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
}
