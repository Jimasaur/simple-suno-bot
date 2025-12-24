# Simple Suno Bot - Raspberry Pi Setup Guide

This folder contains everything you need to run the bot on your Raspberry Pi (or any other server), except for the sensitive `.env` file and the `node_modules` which you will install there.

## 1. Transfer files

Move this entire folder to your Raspberry Pi.
(If you are using this for GitHub, simply upload the contents of this folder to your repository).

## 2. Prerequisites on Raspberry Pi

You need Node.js installed. We recommend Node 18 or newer.
Run this on your Pi to check if you have it:

```bash
node -v
```

If not installed, search for "Install Node.js on Raspberry Pi" (usually `sudo apt update && sudo apt install nodejs npm` works, or using `nvm` is even better).

## 3. Installation

Open a terminal inside this folder on your Pi and run:

```bash
npm install
```

This will download all the dependencies (the `node_modules` folder).
_Note: This might take a few minutes on a Pi, especially for `ffmpeg-static`._

## 4. Configuration

1. Rename `.env.example` to `.env`:
   ```bash
   mv .env.example .env
   ```
2. Open `.env` and paste your actual API keys (Diskord Token and OpenAI Key).
   ```bash
   nano .env
   ```
   (Press `Ctrl+X`, then `Y`, then `Enter` to save).

## 5. Install System Dependencies (Important for Audio)

The bot uses FFMPEG for audio. While `ffmpeg-static` is included in the dependencies, Raspberry Pi architecture (ARM) sometimes has issues with the pre-built binaries.
It is HIGHLY recommended to install ffmpeg globally on the Pi:

```bash
sudo apt update
sudo apt install ffmpeg
```

## 6. Running the Bot

To start the bot:

```bash
node index.js
```

### Keep it running (Optional)

If you want the bot to run 24/7 even after you close the terminal, install `pm2`:

```bash
sudo npm install -g pm2
pm2 start index.js --name suno-bot
pm2 save
pm2 startup
```
