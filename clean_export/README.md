# Synesthesia

A lightweight, feature-rich Discord bot that combines Suno music, chats using GPT-5-mini, and speaks with OpenAI's high-quality TTS voices.

## Features

*   🎵 **Play Music**: Plays songs directly from Suno.com URLs (and YouTube/Spotify).
*   🤖 **AI Chat**: Chat with **GPT-5-mini** directly in Discord.
*   🗣️ **Text-to-Speech**: The bot joins your voice channel and speaks any text using natural AI voices.
*   🎭 **Customizable Persona**: Change the bot's personality and system prompts on the fly.
*   🎙️ **Voice Selection**: Switch between OpenAI's 6 different voices.

## Setup

1.  **Prerequisites**:
    *   [Node.js](https://nodejs.org/) (v18 or higher recommended).
    *   A [Discord Bot Token](https://discord.com/developers/applications).
    *   An [OpenAI API Key](https://platform.openai.com/).
    *   A [Google GenAI Key](https://aistudio.google.com/) (for Image Generation).

2.  **Installation**:
    ```bash
    # Clone or download this folder
    cd simple-suno-bot
    npm install
    ```

3.  **Configuration**:
    Create a `.env` file in the root folder with the following:
    ```env
    DISCORD_TOKEN=your_discord_bot_token
    OPEN_AI_API_KEY=your_openai_api_key
    GOOGLE_API_KEY=your_google_api_key
    ```

4.  **Running the Bot**:
    ```bash
    node index.js
    ```

## Commands

### Music
*   `!play <url>`: Plays a song from a Suno link (e.g., `https://suno.com/song/xyz`) or other supported sources.
*   `!pause`: Pauses the current track.
*   `!resume`: Resumes playback.
*   `!skip`: Skips to the next song in the queue.
*   `!stop`: Stops music and disconnects the bot.
*   `!queue`: Displays the current list of songs.

### AI & Voice
*   `!chat <message>`: Ask GPT-5-mini a question.
    *   *Example*: `!chat What is the meaning of life?`
*   `!speak <text>`: The bot joins your voice channel and speaks the text.
    *   *Example*: `!speak Hello everyone, I am ready to party.`
*   `!setvoice <name>`: Changes the TTS voice.
    *   **Options**: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`.
    *   *Example*: `!setvoice onyx`
*   `!setpersona <prompt>`: Changes the bot's hidden system prompt (personality).
    *   *Example*: `!setpersona You are a grumpy pirate.`

### General
*   `!help`: Shows the list of available commands.

## Troubleshooting

*   **"FFmpeg not found"**: The bot uses `ffmpeg-static` automatically. If you see this, try deleting `node_modules` and running `npm install` again.
*   **"No results found"**: Ensure the Suno link is valid. Some private or redirect links might fail.
*   **Bot doesn't reply**: Check your console for errors. Make sure "Message Content Intent" is enabled in your Discord Developer Portal.