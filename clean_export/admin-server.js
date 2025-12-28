/**
 * Admin Server (Express)
 * This file runs the web dashboard and API for Synesthesia.
 * It shares state with the main bot process via global variables.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = 3000;

const { GoogleGenAI } = require("@google/genai");

// Middleware
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(express.static('public'));

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

if (!process.env.GOOGLE_API_KEY) {
  console.warn("⚠️ GOOGLE_API_KEY is missing for Admin Server. Image editing API will fail.");
}

app.post('/api/edit-image', async (req, res) => {
  try {
    const { image, prompt } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ error: 'Missing image or prompt' });
    }

    // Prepare content for Gemini
    // image is expected to be a base64 string (data:image/png;base64,.....)
    // We need to strip the prefix for the API if it exists, or handle it correctly.
    // The Google GenAI SDK expects "image" to be a base64 string without prefix for inlineData? 
    // Actually, checking docs or examples, usually we send the base64 data.

    // Let's assume the client sends the full data URL. We'll strip the prefix.
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    // Determine mime type from header if possible, or default to png.
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    // Use the v1 SDK format
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]
    });

    // The response structure in v1 SDK
    // Usually response has candidates directly?
    // Let's assume response is the response object.

    if (!response || !response.candidates || response.candidates.length === 0) {
      console.log("No candidates in response:", JSON.stringify(response));
      return res.json({ success: false, error: "No response from model" });
    }

    const candidate = response.candidates[0];
    // Check if content parts exist
    if (!candidate.content || !candidate.content.parts) {
      return res.json({ success: false, error: "Invalid response format" });
    }

    const imagePart = candidate.content.parts.find(p => p.inlineData);

    if (imagePart) {
      const returnImage = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      return res.json({ success: true, image: returnImage });
    } else {
      // Fallback if it returns text (e.g. refusal or error text)
      const textPart = candidate.content.parts.find(p => p.text);
      if (textPart) {
        return res.json({ success: false, error: textPart.text });
      }
      return res.json({ success: false, error: "No image or text returned" });
    }

  } catch (error) {
    console.error("Image Edit Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Store metrics and logs
let metrics = {
  totalPlays: 0,
  linksPlayed: [],
  chatMessages: 0,
  ttsRequests: 0,
  startTime: Date.now(),
  history: {
    hourly: [],
    daily: []
  }
};

let logs = [];
const MAX_LOGS = 500;

// Preset personas library
const PRESET_PERSONAS = [
  {
    id: 'helpful',
    name: 'Helpful Assistant',
    prompt: 'You are a helpful assistant. Always respond super concisely.',
    emoji: '🤖'
  },
  {
    id: 'pirate',
    name: 'Pirate Captain',
    prompt: 'You are a jolly pirate captain. Speak like a pirate, use nautical terms, and be adventurous. Keep responses brief, matey!',
    emoji: '🏴‍☠️'
  },
  {
    id: 'cat',
    name: 'Wise Cat',
    prompt: 'You are a wise, philosophical cat. Be mysterious, occasionally mention naps or fish, and provide thoughtful but concise advice.',
    emoji: '🐱'
  },
  {
    id: 'wizard',
    name: 'Ancient Wizard',
    prompt: 'You are an ancient wizard with vast knowledge. Speak with mystical wisdom and occasional arcane references. Be brief but profound.',
    emoji: '🧙‍♂️'
  },
  {
    id: 'coach',
    name: 'Motivational Coach',
    prompt: 'You are an energetic motivational coach. Be encouraging, positive, and pump people up! Keep it punchy and inspiring.',
    emoji: '💪'
  },
  {
    id: 'scientist',
    name: 'Mad Scientist',
    prompt: 'You are an eccentric scientist obsessed with experiments and discovery. Be curious, enthusiastic about science, and respond concisely with scientific flair.',
    emoji: '🔬'
  }
];

// Load existing metrics if available
try {
  if (fs.existsSync('./metrics.json')) {
    const loaded = JSON.parse(fs.readFileSync('./metrics.json', 'utf8'));
    metrics = { ...metrics, ...loaded };
    // Ensure history exists
    if (!metrics.history) {
      metrics.history = { hourly: [], daily: [] };
    }
  }
} catch (e) {
  console.log('No existing metrics found, starting fresh');
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('error', console.error);

  ws.send(JSON.stringify({ type: 'connection', message: 'Connected to admin server' }));
});

// Broadcast to all connected WebSocket clients
function broadcastToClients(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Track metrics history
function updateMetricsHistory() {
  const now = new Date();
  const hourKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:00`;
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Update hourly stats
  let hourEntry = metrics.history.hourly.find(h => h.timestamp === hourKey);
  if (!hourEntry) {
    hourEntry = { timestamp: hourKey, plays: 0, chats: 0, tts: 0 };
    metrics.history.hourly.push(hourEntry);
  }

  // Update daily stats
  let dayEntry = metrics.history.daily.find(d => d.timestamp === dayKey);
  if (!dayEntry) {
    dayEntry = { timestamp: dayKey, plays: 0, chats: 0, tts: 0 };
    metrics.history.daily.push(dayEntry);
  }

  // Keep only last 48 hours and 30 days
  if (metrics.history.hourly.length > 48) {
    metrics.history.hourly = metrics.history.hourly.slice(-48);
  }
  if (metrics.history.daily.length > 30) {
    metrics.history.daily = metrics.history.daily.slice(-30);
  }
}

// API endpoints
app.get('/api/metrics', (req, res) => {
  res.json({
    ...metrics,
    uptime: Date.now() - metrics.startTime
  });
});

app.get('/api/metrics/history', (req, res) => {
  res.json(metrics.history);
});

app.get('/api/personas', (req, res) => {
  res.json({ personas: PRESET_PERSONAS });
});

app.get('/api/export/metrics', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="metrics-export.json"');
  res.send(JSON.stringify(metrics, null, 2));
});

app.get('/api/export/logs', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="logs-export.json"');
  res.send(JSON.stringify(logs, null, 2));
});

app.get('/api/logs', (req, res) => {
  res.json({ logs: logs.slice(-100) }); // Return last 100 logs
});

app.get('/api/config', (req, res) => {
  res.json({
    systemPrompt: global.botSystemPrompt || "You are a helpful assistant. Always respond super concisely.",
    currentVoice: global.botCurrentVoice || "alloy",
    imageGenConfig: global.imageGenConfig || { aspectRatio: "1:1", personGeneration: "allow_adult", safetyLevel: "block_only_high" }
  });
});

app.post('/api/config', (req, res) => {
  const { systemPrompt, currentVoice, imageGenConfig } = req.body;

  if (systemPrompt !== undefined) {
    global.botSystemPrompt = systemPrompt;
  }

  if (currentVoice !== undefined) {
    global.botCurrentVoice = currentVoice;
  }

  if (imageGenConfig) {
    global.imageGenConfig = { ...global.imageGenConfig, ...imageGenConfig };
  }

  res.json({
    success: true,
    systemPrompt: global.botSystemPrompt,
    currentVoice: global.botCurrentVoice,
    imageGenConfig: global.imageGenConfig
  });
});

app.post('/api/clear-logs', (req, res) => {
  logs = [];
  res.json({ success: true });
});

app.post('/api/reset-metrics', (req, res) => {
  metrics = {
    totalPlays: 0,
    linksPlayed: [],
    chatMessages: 0,
    ttsRequests: 0,
    startTime: Date.now()
  };
  saveMetrics();
  res.json({ success: true });
});

// Save metrics periodically
function saveMetrics() {
  fs.writeFileSync('./metrics.json', JSON.stringify(metrics, null, 2));
}

setInterval(saveMetrics, 60000); // Save every minute

// Expose functions for the bot to call
global.adminAddLog = (level, message) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message
  };
  logs.push(logEntry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  // Broadcast log to WebSocket clients
  broadcastToClients({
    type: 'log',
    data: logEntry
  });
};

global.adminIncrementMetric = (metric, data) => {
  const now = new Date();
  const hourKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:00`;
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Update hourly stats
  let hourEntry = metrics.history.hourly.find(h => h.timestamp === hourKey);
  if (!hourEntry) {
    hourEntry = { timestamp: hourKey, plays: 0, chats: 0, tts: 0 };
    metrics.history.hourly.push(hourEntry);
    // Keep only last 48 hours
    if (metrics.history.hourly.length > 48) {
      metrics.history.hourly = metrics.history.hourly.slice(-48);
    }
  }

  // Update daily stats
  let dayEntry = metrics.history.daily.find(d => d.timestamp === dayKey);
  if (!dayEntry) {
    dayEntry = { timestamp: dayKey, plays: 0, chats: 0, tts: 0 };
    metrics.history.daily.push(dayEntry);
    // Keep only last 30 days
    if (metrics.history.daily.length > 30) {
      metrics.history.daily = metrics.history.daily.slice(-30);
    }
  }

  switch (metric) {
    case 'play':
      metrics.totalPlays++;
      hourEntry.plays++;
      dayEntry.plays++;
      metrics.linksPlayed.push({
        url: data.url,
        title: data.title,
        timestamp: new Date().toISOString()
      });
      // Keep only last 100 links
      if (metrics.linksPlayed.length > 100) {
        metrics.linksPlayed.shift();
      }
      break;
    case 'chat':
      metrics.chatMessages++;
      hourEntry.chats++;
      dayEntry.chats++;
      break;
    case 'tts':
      metrics.ttsRequests++;
      hourEntry.tts++;
      dayEntry.tts++;
      break;
    case 'image_gen':
      if (!metrics.imageGenerations) metrics.imageGenerations = 0;
      metrics.imageGenerations++;
      // We could add robust history tracking for images too if needed
      break;
  }

  saveMetrics();

  // Broadcast metric update to WebSocket clients
  broadcastToClients({
    type: 'metric',
    data: { metric, timestamp: new Date().toISOString() }
  });
};

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin panel running at http://localhost:${PORT}`);
  global.adminAddLog('info', `Admin server started on port ${PORT}`);
});

module.exports = { app, server };
