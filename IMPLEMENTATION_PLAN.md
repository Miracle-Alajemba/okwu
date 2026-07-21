# Okwu — Implementation Plan

> Live Speech-to-Text Companion for the Deaf & Hard-of-Hearing  
> **Stack:** React + TypeScript + Node.js | **Timeline:** 13 days | **Solo developer**

---

## Your Hardware Reality

| Spec | Value | Impact |
|---|---|---|
| **Laptop** | HP EliteBook 840 G5 | 8th Gen Intel Core, good enough |
| **RAM** | 8GB total | ~4GB free after OS + IDE + browser. **This is our biggest constraint.** |
| **GPU** | Intel UHD 620 (integrated) | No CUDA. Supports WebGPU in Chrome (basic). |
| **Disk** | Need ~6GB free for models + deps | Check with `df -h` |

### RAM Budget (This Dictates Everything)

```
Total RAM:                    8,192 MB
─ Linux OS + services:       ~1,500 MB
─ VS Code:                     ~500 MB
─ Chrome (1-2 tabs):           ~500 MB
─ Node.js dev server:          ~200 MB
────────────────────────────────────────
Available for AI models:     ~5,400 MB
```

| Model | RAM Needed | Fits? |
|---|---|---|
| Gemma 4 E2B (Q4_K_M) | ~5,000 MB | ⚠️ Extremely tight — leaves ~400MB headroom |
| Gemma 4 E2B (Q3_K_S) | ~3,500 MB | ✅ Safer, leaves ~1,900MB headroom |
| Whisper `tiny` (in browser via Transformers.js) | ~150 MB (browser memory) | ✅ Runs in browser, not on server |

> [!IMPORTANT]
> ### The Key Insight: Run Whisper in the Browser, Gemma on the Server
> By running Whisper in the browser via **Transformers.js** (WebAssembly), we free up ALL server RAM for Gemma. This is also a better "edge/offline" story — the STT actually runs on the client device.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  BROWSER (React + TypeScript)                        │
│                                                       │
│  Mic → Web Audio API → VAD → Audio chunks            │
│         → Transformers.js (Whisper tiny, WASM/WebGPU)│
│         → Raw transcript text                        │
│         → WebSocket to backend ─────────────────┐    │
│                                                  │    │
│  ← Simplified caption ← WebSocket ──────────┐   │    │
│         → Caption overlay UI                 │   │    │
└──────────────────────────────────────────────┼───┼────┘
                                               │   │
┌──────────────────────────────────────────────┼───┼────┐
│  NODE.JS BACKEND (Express + TypeScript)      │   │    │
│                                              │   │    │
│  WebSocket server ←──────────────────────────┘   │    │
│         ← receives raw transcript ───────────────┘    │
│         → Sends to Ollama (Gemma 4 E2B) for           │
│           simplification                              │
│         → Streams simplified caption back             │
│           to browser via WebSocket                    │
└───────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────┐
│  OLLAMA (Separate process)                            │
│  Running: gemma4:e2b (Q3 quantized, ~3.5GB RAM)      │
│  REST API on localhost:11434                          │
└───────────────────────────────────────────────────────┘
```

### Why This Architecture Wins

1. **Whisper in the browser** = true edge computing. Audio never leaves the device for STT. Zero server RAM cost.
2. **Gemma on the server** = the simplification (the product's core value) is powered by Gemma. Deep integration.
3. **Full JS/TS stack** = React frontend, Node.js backend, no Python anywhere.
4. **Fits in 8GB RAM** = Ollama (Gemma) uses ~3.5GB, everything else fits in the remaining ~4.5GB.
5. **Offline-capable** = Whisper runs in browser (WASM), Gemma runs locally via Ollama. No cloud APIs.

---

## Tech Stack — Complete List

### Frontend
| Package | Purpose |
|---|---|
| **React 18+** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool (fast HMR) |
| **@huggingface/transformers** | Run Whisper in-browser via WASM/WebGPU |
| **Socket.IO (client)** | Real-time WebSocket to backend |
| **Web Audio API** | Mic capture (built into browsers) |

### Backend
| Package | Purpose |
|---|---|
| **Node.js 18+** | Runtime |
| **Express** | HTTP server |
| **Socket.IO** | WebSocket server |
| **ollama** (npm) | Official Ollama JS client with streaming |
| **TypeScript + tsx** | TS execution |

### Infrastructure
| Tool | Purpose |
|---|---|
| **Ollama** | Run Gemma 4 E2B locally |
| **Git + GitHub** | Version control + open-source requirement |

---

## Proposed Changes

### Project Structure

#### [NEW] Project root at `/home/miracle-alajemba/Desktop/okwu/`

```
okwu/
├── client/                          # React + TypeScript frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.tsx                  # Main app component
│   │   ├── main.tsx                 # Entry point
│   │   ├── index.css                # Global styles + design system
│   │   ├── components/
│   │   │   ├── CaptionOverlay.tsx   # Live caption display (the core UI)
│   │   │   ├── AudioCapture.tsx     # Mic capture + VAD + chunking
│   │   │   ├── WhisperWorker.ts     # Web Worker for Whisper inference
│   │   │   ├── ConnectionStatus.tsx # Shows backend/model status
│   │   │   └── SettingsPanel.tsx    # Chunk size, font size, etc.
│   │   ├── hooks/
│   │   │   ├── useAudioCapture.ts   # Mic + VAD + chunking logic
│   │   │   ├── useWhisper.ts        # Transformers.js Whisper pipeline
│   │   │   └── useSocket.ts         # WebSocket connection to backend
│   │   ├── workers/
│   │   │   └── whisper.worker.ts    # Web Worker to run Whisper off main thread
│   │   └── types/
│   │       └── index.ts             # Shared types
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                          # Node.js + TypeScript backend
│   ├── src/
│   │   ├── index.ts                 # Express + Socket.IO server
│   │   ├── services/
│   │   │   └── gemmaSimplifier.ts   # Ollama client for Gemma simplification
│   │   └── types/
│   │       └── index.ts             # Shared types
│   ├── package.json
│   └── tsconfig.json
│
├── README.md                        # Project documentation
├── .gitignore
└── package.json                     # Root workspace package.json
```

---

### Component Breakdown

#### Frontend — `client/`

##### [NEW] `src/workers/whisper.worker.ts`
- Loads `@huggingface/transformers` Whisper `tiny` model in a Web Worker
- Receives audio chunks (Float32Array) from main thread
- Runs ASR inference via WASM/WebGPU
- Posts raw transcript text back to main thread
- **Why a Web Worker?** Whisper inference blocks the main thread — moving it to a worker keeps the UI smooth

##### [NEW] `src/hooks/useAudioCapture.ts`
- Uses `navigator.mediaDevices.getUserMedia()` to capture mic
- Implements Voice Activity Detection (VAD) to detect speech vs silence
- Chunks audio into 3-5 second segments
- Sends audio chunks to the Whisper Web Worker

##### [NEW] `src/hooks/useWhisper.ts`
- Manages the Whisper Web Worker lifecycle
- Handles model loading state (downloading model on first use, ~75MB)
- Receives raw transcripts from worker
- Sends transcripts to backend via Socket.IO

##### [NEW] `src/components/CaptionOverlay.tsx`
- **The hero UI component** — large, high-contrast text captions
- Smooth scroll as new captions arrive
- Configurable font size (accessibility-first)
- Shows raw transcript vs simplified caption (for demo comparison)
- Dark mode default with WCAG AA+ contrast

##### [NEW] `src/components/AudioCapture.tsx`
- Start/stop recording button
- Audio waveform visualizer (shows the app is "listening")
- Status indicators: mic active, whisper loading, connected to backend

#### Backend — `server/`

##### [NEW] `src/services/gemmaSimplifier.ts`
- Uses official `ollama` npm package
- Sends raw transcript to Gemma 4 E2B with the simplification system prompt
- Streams response tokens back
- Handles errors gracefully (model not loaded, Ollama not running)

##### [NEW] `src/index.ts`
- Express server with Socket.IO
- Receives raw transcripts from frontend via WebSocket
- Passes to Gemma simplifier service
- Streams simplified captions back to frontend
- Health check endpoint (for demo: confirms Ollama + Gemma are running)

---

## Open Questions

> [!IMPORTANT]
> ### Q1: Gemma quantization level
> With 8GB total RAM, we need to be aggressive. I recommend **Q3_K_S** quantization (~3.5GB) over Q4_K_M (~5GB) to leave headroom. The quality difference is minimal for short simplification tasks. **Do you agree, or do you want to try Q4 first and see if it fits?**

> [!IMPORTANT]
> ### Q2: Deployed demo hosting
> For judges to try your app live, we need it hosted somewhere. Options:
> - **Hugging Face Spaces** (free, supports Docker, but Gemma inference will be slow on free CPU tier)
> - **Streamlit Community Cloud** (free but Python-only — doesn't fit our JS stack)
> - **Render / Railway** (free tier, supports Node.js)
> - **Just show the demo video** (simplest — no hosting needed)
> 
> **My recommendation:** Deploy the frontend to **Vercel** (free) and include a clear demo video. For the backend, the video IS the demo — running locally proves the "offline" claim better than a cloud deployment anyway.

> [!IMPORTANT]
> ### Q3: Do you want real-time waveform visualization?
> It looks impressive in demos (shows the app is "alive" and listening) but adds ~1 day of work. I recommend yes — it's worth the visual impact.

---

## 13-Day Build Plan

| Day | Focus | Deliverable |
|---|---|---|
| **Day 1** (Today) | Project setup + Ollama validation | Scaffold project, install Ollama, confirm `gemma4:e2b` runs and simplifies text correctly |
| **Day 2** | Whisper-in-browser proof of concept | Transformers.js running Whisper `tiny` in a Web Worker, transcribing mic audio |
| **Day 3** | Backend + WebSocket pipeline | Node.js server receiving transcripts, calling Ollama, streaming back simplified captions |
| **Day 4** | End-to-end integration | Mic → Whisper → Gemma → captions displaying in React UI |
| **Day 5-6** | UI polish | Beautiful caption overlay, waveform visualizer, dark mode, responsive design |
| **Day 7-8** | Latency optimization + edge cases | Tune chunk sizes, handle errors, test accents, measure latency |
| **Day 9** | Side-by-side comparison mode | Show raw transcript vs Gemma-simplified caption (key demo moment) |
| **Day 10** | Testing | Quiet/noisy environments, Nigerian accent audio, latency measurements |
| **Day 11** | Demo video | Script, record, edit the 2-3 min walkthrough |
| **Day 12** | Kaggle writeup | Write submission following their template exactly |
| **Day 13** | Buffer + submission | Final fixes, submit |

---

## Verification Plan

### Automated Tests
```bash
# Backend unit tests
cd server && npm test

# Frontend build check
cd client && npm run build

# End-to-end smoke test
# Start all services, speak into mic, verify caption appears
```

### Manual Verification
- **Latency test:** Measure time from speech → caption appearance (target: <3s)
- **Offline test:** Disconnect WiFi, confirm Whisper (browser) + Gemma (Ollama) still work
- **Accent test:** Test with Nigerian-accented English audio samples
- **Noise test:** Test in a noisy environment
- **Long-running test:** Run for 15 min, check for memory leaks or degradation

### Demo Verification
- Demo video clearly shows airplane mode / offline operation
- Side-by-side comparison of raw transcript vs simplified caption
- Architecture diagram is clear and accurate in writeup
