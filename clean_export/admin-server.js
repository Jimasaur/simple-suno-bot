const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Store metrics and logs
let metrics = {
  totalPlays: 0,
  linksPlayed: [],
  chatMessages: 0,
  ttsRequests: 0,
  startTime: Date.now()
};

let logs = [];
const MAX_LOGS = 500;

// Load existing metrics if available
try {
  if (fs.existsSync('./metrics.json')) {
    metrics = JSON.parse(fs.readFileSync('./metrics.json', 'utf8'));
  }
} catch (e) {
  console.log('No existing metrics found, starting fresh');
}

// API endpoints
app.get('/api/metrics', (req, res) => {
  res.json({
    ...metrics,
    uptime: Date.now() - metrics.startTime
  });
});

app.get('/api/logs', (req, res) => {
  res.json({ logs: logs.slice(-100) }); // Return last 100 logs
});

app.get('/api/config', (req, res) => {
  res.json({
    systemPrompt: global.botSystemPrompt || "You are a helpful assistant. Always respond super concisely.",
    currentVoice: global.botCurrentVoice || "alloy"
  });
});

app.post('/api/config', (req, res) => {
  const { systemPrompt, currentVoice } = req.body;

  if (systemPrompt !== undefined) {
    global.botSystemPrompt = systemPrompt;
  }

  if (currentVoice !== undefined) {
    global.botCurrentVoice = currentVoice;
  }

  res.json({ success: true, systemPrompt: global.botSystemPrompt, currentVoice: global.botCurrentVoice });
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
};

global.adminIncrementMetric = (metric, data) => {
  switch(metric) {
    case 'play':
      metrics.totalPlays++;
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
      break;
    case 'tts':
      metrics.ttsRequests++;
      break;
  }
  saveMetrics();
};

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Admin panel running at http://localhost:${PORT}`);
  global.adminAddLog('info', `Admin server started on port ${PORT}`);
});

module.exports = { app };
