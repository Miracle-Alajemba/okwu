import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  simplifyTranscriptStream,
  checkGemmaHealth,
  MODEL_NAME,
} from './services/gemmaSimplifier.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  TranscriptChunk,
} from './types/index.js';

const PORT = process.env.PORT ?? 3001;

// ── Express Setup ──────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// ── Socket.IO Setup ────────────────────────────────────────────
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
  },
});

// ── REST Endpoints ─────────────────────────────────────────────

/** Health check endpoint */
app.get('/api/health', async (_req, res) => {
  const health = await checkGemmaHealth();
  res.json({
    server: true,
    ...health,
  });
});

/** Simple test endpoint — POST a text, get back simplified version */
app.post('/api/simplify', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing "text" field in request body' });
    return;
  }

  const chunk: TranscriptChunk = {
    text,
    timestamp: Date.now(),
    durationMs: 0,
  };

  let result = '';
  const stream = simplifyTranscriptStream(chunk);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await stream.next();
    if (done) {
      // The return value is the full SimplifiedCaption
      res.json(value);
      return;
    }
    result += value;
  }
});

// ── Socket.IO Connection Handler ───────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  /** Handle incoming raw transcript chunks */
  socket.on('transcript:raw', async (chunk: TranscriptChunk) => {
    console.log(
      `[Socket.IO] Received transcript: "${chunk.text.substring(0, 50)}..."`
    );

    try {
      const stream = simplifyTranscriptStream(chunk);
      let fullCaption = '';

      // Stream tokens to client as they're generated
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await stream.next();
        if (done) {
          // Send the complete caption object
          socket.emit('caption:done', value);
          console.log(
            `[Socket.IO] Caption complete: "${value.simplifiedText}" (${value.processingTimeMs}ms)`
          );
          break;
        }
        // Send each token for real-time display
        fullCaption += value;
        socket.emit('caption:token', value);
      }
    } catch (error) {
      console.error('[Socket.IO] Error processing transcript:', error);
      socket.emit('error', {
        message: 'Failed to simplify transcript',
        code: 'SIMPLIFY_ERROR',
      });
    }
  });

  /** Handle health check requests */
  socket.on('health:check', async () => {
    const health = await checkGemmaHealth();
    socket.emit('health:status', {
      server: true,
      ...health,
      modelName: MODEL_NAME,
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });
});

// ── Start Server ───────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║          👂 Okwu Server Running          ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  HTTP:      http://localhost:${PORT}       ║`);
  console.log(`  ║  WebSocket: ws://localhost:${PORT}         ║`);
  console.log(`  ║  Model:     ${MODEL_NAME.padEnd(25)}  ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');

  // Check Gemma health on startup
  checkGemmaHealth().then((health) => {
    if (!health.ollama) {
      console.warn('  ⚠️  Ollama is not running! Start it with: ollama serve');
    } else if (!health.gemmaLoaded) {
      console.warn(
        `  ⚠️  Gemma model not found! Pull it with: ollama pull ${MODEL_NAME}`
      );
    } else {
      console.log(`  ✅ Gemma model ready: ${health.modelName}`);
    }
  });
});
