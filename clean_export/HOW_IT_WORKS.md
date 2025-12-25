# How This Tool Works

A comprehensive guide to understanding the Suno Bot architecture and data flow.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DISCORD PLATFORM                            │
│  ┌───────────────┐      ┌──────────────┐      ┌─────────────────┐  │
│  │  Discord User │─────▶│ Voice Channel│◀─────│  Text Channel   │  │
│  │   (Client)    │      │  (Audio I/O) │      │  (Commands)     │  │
│  └───────────────┘      └──────────────┘      └─────────────────┘  │
└────────────┬──────────────────┬──────────────────────┬──────────────┘
             │                  │                      │
             │ Commands (!play, │ Audio Stream         │ Messages
             │ !chat, !speak)   │                      │
             │                  │                      │
             ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUNO BOT (Raspberry Pi)                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     index.js (Main Process)                   │  │
│  │                                                               │  │
│  │  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │  │
│  │  │  Discord.js │    │ Discord      │    │   OpenAI       │  │  │
│  │  │   Client    │───▶│   Player     │    │   Client       │  │  │
│  │  │  (Gateway)  │    │  (Music)     │    │ (Chat & TTS)   │  │  │
│  │  └─────────────┘    └──────────────┘    └────────────────┘  │  │
│  │         │                   │                    │           │  │
│  │         │                   │                    │           │  │
│  │         │  ┌────────────────▼────────────────────▼────────┐ │  │
│  │         │  │         Global State Variables              │ │  │
│  │         │  │  • botCurrentVoice                          │ │  │
│  │         │  │  • botSystemPrompt                          │ │  │
│  │         │  │  • chatHistory (Map)                        │ │  │
│  │         │  └─────────────────────────────────────────────┘ │  │
│  │         │                                                   │  │
│  └─────────┼───────────────────────────────────────────────────┘  │
│            │                                                      │
│            │ Exposes global functions:                           │
│            │ • global.adminAddLog()                              │
│            │ • global.adminIncrementMetric()                     │
│            │                                                      │
│            ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                admin-server.js (Express Server)              │  │
│  │                                                               │  │
│  │  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │  │
│  │  │   Express   │    │   Metrics    │    │     Logs       │  │  │
│  │  │  HTTP API   │───▶│   Storage    │    │    Storage     │  │  │
│  │  │  (Port 3000)│    │  (JSON File) │    │   (In-Memory)  │  │  │
│  │  └─────────────┘    └──────────────┘    └────────────────┘  │  │
│  │         │                                                     │  │
│  └─────────┼─────────────────────────────────────────────────────┘  │
│            │                                                        │
└────────────┼────────────────────────────────────────────────────────┘
             │
             │ HTTP (Port 3000)
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ADMIN WEB INTERFACE                            │
│                       (Browser Client)                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Metrics    │  │  Bot Config  │  │   Logs & Recently Played │  │
│  │   Dashboard  │  │   Editor     │  │        Viewer            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  Auto-refresh every 5 seconds via fetch() API calls                │
└─────────────────────────────────────────────────────────────────────┘
             │
             │ HTTP Requests
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  OpenAI API  │  │  Suno.com    │  │   Discord Gateway        │  │
│  │  (GPT + TTS) │  │  (Music)     │  │   (WebSocket)            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Music Playback Flow (!play command)

```
User types: !play https://suno.com/song/xyz
                │
                ▼
┌───────────────────────────────────────┐
│  Discord.js receives message event    │
│  • Parses command and URL             │
│  • Validates user is in voice channel │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  resolveSunoUrl(url)                  │
│  • Fetch HTML from Suno               │
│  • Parse with Cheerio                 │
│  • Extract audio URL from meta tags   │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  Discord Player plays audio           │
│  • Join voice channel                 │
│  • Stream audio from URL              │
│  • Send "Now playing" message         │
└───────────┬───────────────────────────┘
            │
            ├─────────────────────────────┐
            ▼                             ▼
┌──────────────────────┐    ┌────────────────────────┐
│ adminIncrementMetric │    │    adminAddLog         │
│ • totalPlays++       │    │    • Log to array      │
│ • Add to linksPlayed │    │    • Timestamp entry   │
│ • Save to JSON file  │    │    • Keep last 500     │
└──────────────────────┘    └────────────────────────┘
            │                             │
            └──────────┬──────────────────┘
                       ▼
            ┌─────────────────────┐
            │  Data available via │
            │  /api/metrics       │
            │  /api/logs          │
            └─────────────────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │  Admin panel shows  │
            │  updated stats      │
            └─────────────────────┘
```

---

### 2. Chat Flow (!chat command)

```
User types: !chat Hello bot
                │
                ▼
┌───────────────────────────────────────┐
│  Discord.js receives message          │
│  • Extract prompt after "!chat"       │
│  • Get/create channel history         │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  Build conversation context           │
│  • System prompt (configurable)       │
│  • Last 20 messages from history      │
│  • Add user's new message             │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  OpenAI API Call                      │
│  • Model: gpt-5-mini                  │
│  • Send messages array                │
│  • Receive completion                 │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  Update chat history                  │
│  • Add assistant response             │
│  • Keep last 20 messages (10 pairs)   │
│  • Store in Map by channelId          │
└───────────┬───────────────────────────┘
            │
            ├─────────────────────────────┐
            ▼                             ▼
┌──────────────────────┐    ┌────────────────────────┐
│ Send reply to user   │    │ adminIncrementMetric   │
│ • Split if >2000 chr │    │ • chatMessages++       │
│ • Discord reply()    │    │ • adminAddLog()        │
└──────────────────────┘    └────────────────────────┘
```

---

### 3. Text-to-Speech Flow (!speak command)

```
User types: !speak Hello everyone
                │
                ▼
┌───────────────────────────────────────┐
│  Discord.js receives message          │
│  • Extract text after "!speak"        │
│  • Validate user in voice channel     │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  OpenAI TTS API Call                  │
│  • Model: tts-1                       │
│  • Voice: currentVoice (configurable) │
│  • Input: user's text                 │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  Save audio to temp file              │
│  • Convert response to Buffer         │
│  • Write to tts_output.mp3            │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  Discord Player plays file            │
│  • Join voice channel                 │
│  • Play local MP3 file                │
│  • QueryType.FILE mode                │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  adminIncrementMetric('tts')          │
│  adminAddLog('TTS: ...')              │
└───────────────────────────────────────┘
```

---

### 4. Admin Panel Configuration Flow

```
Admin opens: http://192.168.68.82:3000
                │
                ▼
┌───────────────────────────────────────┐
│  Browser loads public/index.html      │
│  • Orbitron font loaded                │
│  • CSS styles applied                  │
│  • JavaScript initialized              │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  startAutoRefresh() executes          │
│  • Initial: loadMetrics()             │
│  • Initial: loadLogs()                │
│  • Initial: loadConfig()              │
│  • Then every 5 seconds               │
└───────────┬───────────────────────────┘
            │
            ├────────────┬──────────────┐
            ▼            ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │GET /api/ │  │GET /api/ │  │GET /api/ │
    │ metrics  │  │  logs    │  │ config   │
    └────┬─────┘  └────┬─────┘  └────┬─────┘
         │             │              │
         ▼             ▼              ▼
    ┌──────────────────────────────────────┐
    │  Express server (admin-server.js)    │
    │  • Returns JSON data                 │
    │  • Reads from in-memory stores       │
    │  • Reads from metrics.json file      │
    │  • Reads from global variables       │
    └───────────┬──────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │  Browser updates DOM                 │
    │  • Metric values updated             │
    │  • Logs appended                     │
    │  • Config fields populated           │
    └──────────────────────────────────────┘

Admin changes config and clicks "Save"
                │
                ▼
┌───────────────────────────────────────┐
│  POST /api/config                     │
│  • systemPrompt: "new prompt"         │
│  • currentVoice: "nova"               │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  admin-server.js updates globals      │
│  • global.botSystemPrompt = value     │
│  • global.botCurrentVoice = value     │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  index.js sync interval (1 second)    │
│  • currentVoice = global.botCurrentVoice │
│  • systemPrompt = global.botSystemPrompt │
└───────────┬───────────────────────────┘
            │
            ▼
┌───────────────────────────────────────┐
│  Next command uses new settings       │
│  • !chat uses new systemPrompt        │
│  • !speak uses new voice              │
└───────────────────────────────────────┘
```

---

## Key Components

### 1. Discord.js Client
- **Purpose**: Connect to Discord gateway, handle events
- **Connections**:
  - Discord Gateway (WebSocket)
  - Voice Channels (UDP)
  - Text Channels (REST API)

### 2. Discord Player
- **Purpose**: Audio playback management
- **Extractors**:
  - Default extractors for various audio sources
  - Custom Suno URL resolver (Cheerio + Axios)
- **Features**:
  - Queue management
  - Auto-leave settings
  - Track metadata

### 3. OpenAI Client
- **Purpose**: AI chat and text-to-speech
- **APIs Used**:
  - `chat.completions.create()` - GPT-5-mini
  - `audio.speech.create()` - TTS-1
- **Configuration**: API key from .env file

### 4. Express Admin Server
- **Purpose**: Web-based monitoring and configuration
- **Port**: 3000
- **Endpoints**:
  - `GET /api/metrics` - System metrics
  - `GET /api/logs` - Recent logs
  - `GET /api/config` - Bot configuration
  - `POST /api/config` - Update configuration
  - `POST /api/clear-logs` - Clear log history
  - `POST /api/reset-metrics` - Reset all metrics

### 5. Global State Bridge
- **Purpose**: Communication between main bot and admin server
- **Mechanism**: Node.js global object
- **Functions**:
  - `global.adminAddLog(level, message)` - Add log entry
  - `global.adminIncrementMetric(type, data)` - Track metric
- **Variables**:
  - `global.botCurrentVoice` - TTS voice selection
  - `global.botSystemPrompt` - AI personality

---

## Persistent Storage

### metrics.json
```json
{
  "totalPlays": 10,
  "linksPlayed": [
    {
      "url": "https://suno.com/song/xyz",
      "title": "Track Name",
      "timestamp": "2025-12-24T19:37:01.753Z"
    }
  ],
  "chatMessages": 0,
  "ttsRequests": 0,
  "startTime": 1766604147852
}
```
- **Location**: `./metrics.json`
- **Update Frequency**: Every 60 seconds
- **Max Links Stored**: 100 (FIFO)

### Chat History (In-Memory)
```javascript
Map {
  "channelId1234" => [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" }
  ]
}
```
- **Storage**: JavaScript Map
- **Scope**: Per Discord channel
- **Max Messages**: 20 (last 10 conversation pairs)
- **Cleared**: On bot restart or !reset command

### Logs (In-Memory)
```javascript
[
  {
    timestamp: "2025-12-25T12:00:00.000Z",
    level: "info",
    message: "Bot logged in as sunobot2#2125"
  }
]
```
- **Storage**: JavaScript Array
- **Max Entries**: 500 (FIFO)
- **Levels**: info, warn, error

---

## Network Communication

### Discord Gateway (WebSocket)
- **URL**: wss://gateway.discord.gg
- **Purpose**: Real-time events (messages, voice state changes)
- **Heartbeat**: ~40 seconds
- **Intents**: Guilds, GuildVoiceStates, GuildMessages, MessageContent

### Discord Voice (UDP)
- **Purpose**: Voice channel audio streaming
- **Protocol**: UDP with encryption
- **Codec**: Opus (@discordjs/opus)
- **Transport**: RTP

### OpenAI API (HTTPS)
- **Base URL**: api.openai.com
- **Authentication**: Bearer token (API key)
- **Models**:
  - GPT-5-mini (chat)
  - TTS-1 (text-to-speech)

### Suno.com (HTTPS)
- **Purpose**: Fetch song pages and extract audio URLs
- **Method**: HTTP GET with User-Agent header
- **Parser**: Cheerio (jQuery-like HTML parsing)
- **Target**: OpenGraph meta tags

### Admin Panel (HTTP)
- **Local Network**: http://192.168.68.82:3000
- **Protocol**: HTTP (no SSL on local network)
- **CORS**: Not needed (same-origin: static files served by Express)
- **Polling**: 5-second interval

---

## Security Considerations

### Environment Variables (.env)
```
DISCORD_TOKEN=your_token_here
OPEN_AI_API_KEY=your_key_here
```
- **Protection**: .gitignore prevents commits
- **Storage**: Plain text file (chmod 600 recommended)
- **Access**: Only readable by bot process

### Admin Panel
- **Authentication**: None (local network only)
- **Recommendation**:
  - Keep behind firewall
  - Use reverse proxy with auth for external access
  - Consider adding basic auth

### API Keys
- **Discord Token**: Full bot access - keep secure
- **OpenAI Key**: Metered usage - monitor billing
- **Exposure Risk**: Both exposed in .env file on server

---

## Performance & Scalability

### Current Limitations
- **Single Server**: One Raspberry Pi instance
- **Memory**: ~214 MB usage (stable)
- **Concurrent Users**: Limited by voice channel (99 max)
- **Chat History**: Per-channel, memory-based (lost on restart)

### Bottlenecks
1. **OpenAI API**: Rate limits apply
2. **Audio Streaming**: Network bandwidth
3. **File I/O**: metrics.json writes every 60s

### Optimization Opportunities
- Use Redis for distributed chat history
- Implement connection pooling for API calls
- Add caching layer for Suno URL resolution
- Compress admin panel assets

---

## Startup Sequence

```
1. Load environment variables (.env)
   ↓
2. Start admin-server.js
   • Initialize Express server
   • Load metrics.json
   • Expose global functions
   • Listen on port 3000
   ↓
3. Configure FFmpeg path
   ↓
4. Initialize Discord.js client
   • Set intents
   • Create Player instance
   • Initialize OpenAI client
   ↓
5. Setup player extractors
   • Load default extractors
   • Ready for audio playback
   ↓
6. Connect to Discord Gateway
   • Login with token
   • Receive READY event
   • Log "Bot is ready"
   ↓
7. Register event handlers
   • messageCreate (commands)
   • playerStart (track events)
   • error handlers
   ↓
8. Start sync interval (1 second)
   • Keep local vars in sync with globals
   ↓
9. Ready to receive commands
```

---

## Error Handling

### Bot Errors
```javascript
try {
  // Command execution
} catch (e) {
  console.error(e);
  if (global.adminAddLog) {
    global.adminAddLog('error', `Error: ${e.message}`);
  }
  message.reply(`❌ Error: ${e.message}`);
}
```

### Player Errors
```javascript
player.events.on("error", (queue, error) => {
  console.log(`[Queue Error] ${error.message}`);
  global.adminAddLog('error', `Queue Error: ${error.message}`);
});
```

### Admin Server Errors
```javascript
app.post('/api/config', (req, res) => {
  try {
    // Handle config update
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Monitoring & Debugging

### Console Logs
- Bot startup messages
- Error stack traces
- FFmpeg path detection
- Player events

### Admin Panel
- Real-time metrics
- Live log viewer
- Track play history
- Uptime monitoring

### Discord Feedback
- Command confirmations
- Error messages to users
- "Now playing" notifications
- Help embed

---

## Future Enhancements

### Potential Improvements
1. **Database Integration**
   - PostgreSQL for metrics
   - Persistent chat history
   - User preferences

2. **Authentication**
   - Admin panel login
   - Role-based access control
   - Discord OAuth integration

3. **Advanced Features**
   - Playlist management
   - Custom voice training
   - Multi-server support
   - Webhook notifications

4. **Performance**
   - Redis caching
   - CDN for admin assets
   - Load balancing
   - Queue sharding

5. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Error tracking (Sentry)
   - Uptime monitoring

---

## Development Setup

### Prerequisites
```bash
Node.js v20.19.6+
npm 10.8.2+
FFmpeg (system or ffmpeg-static)
Discord Bot Token
OpenAI API Key
```

### Installation
```bash
# Clone repository
git clone <repo-url>
cd clean_export

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start bot
node index.js
```

### File Structure
```
clean_export/
├── index.js              # Main bot logic
├── admin-server.js       # Admin web server
├── public/
│   └── index.html        # Admin UI
├── package.json          # Dependencies
├── .env                  # Secrets (gitignored)
├── .gitignore            # Git exclusions
└── metrics.json          # Persistent metrics (auto-generated)
```

---

## Conclusion

The Suno Bot is a modular Discord bot that combines:
- **Music playback** via discord-player
- **AI chat** via OpenAI GPT
- **Text-to-speech** via OpenAI TTS
- **Web-based admin panel** via Express

Data flows through a global state bridge that connects the Discord bot process with the admin web server, enabling real-time monitoring and configuration through a browser interface.

The architecture prioritizes simplicity and ease of deployment on resource-constrained devices like Raspberry Pi while maintaining extensibility for future enhancements.
