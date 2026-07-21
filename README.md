# 👂 Okwu — Live Speech-to-Text Companion

> **Okwu** (Igbo: "word/speech") — An AI-powered live captioning app for the deaf and hard-of-hearing, running fully offline on-device.

Built for the **Build with Gemma: GDG UNN Hackathon** on Kaggle.

## 🎯 The Problem

Deaf and hard-of-hearing Nigerians navigating everyday spaces — banks, markets, lecture halls, hospitals — have no reliable way to follow spoken conversation in real time without a human interpreter. Existing captioning tools require constant internet and send raw audio to the cloud, creating privacy concerns for sensitive conversations.

## 💡 The Solution

Okwu listens to nearby speech and displays **live, simplified text captions** on screen — entirely on-device, fully offline, zero data leaves your device.

**Key differentiator:** Okwu doesn't just transcribe — it uses **Google Gemma's** language reasoning to compress fast, overlapping, or accented speech into short, easy-to-read phrases. This reduces cognitive load for deaf users compared to a wall of raw transcription text.

## 🏗️ Architecture

```
Browser (React)                    Server (Node.js)
┌──────────────┐                  ┌──────────────┐
│ Mic capture  │                  │ Express +    │
│ ↓            │                  │ Socket.IO    │
│ Whisper      │  WebSocket       │ ↓            │
│ (in-browser) │ ──────────────→  │ Gemma 4 E2B  │
│ ↓            │                  │ (via Ollama) │
│ Captions  ←  │ ←────────────── │ ↓ Simplify   │
└──────────────┘                  └──────────────┘
```

- **Whisper** runs in the browser via WebAssembly (Transformers.js) — true edge computing
- **Gemma 4 E2B** runs locally via Ollama — intelligent caption simplification
- **Zero cloud dependencies** — works in airplane mode

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + Socket.IO |
| Speech-to-Text | Whisper (via @huggingface/transformers, in-browser) |
| Caption Simplification | Gemma 4 E2B (via Ollama, local) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- [Ollama](https://ollama.com) installed
- Gemma 4 E2B model: `ollama pull gemma4:e2b`

### Run
```bash
npm install
npm run dev
```

Open `http://localhost:5173` in Chrome and allow microphone access.

## 📋 Track

**Edge & Offline** — On-device, privacy-first, works without internet.

## 👤 Team

- Miracle Alajemba (Solo)

## 📄 License

MIT
