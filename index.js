require("dotenv").config();
// Set FFMPEG_PATH before requiring discord-player
try {
  process.env.FFMPEG_PATH = require("ffmpeg-static");
} catch (e) {
  console.log("ffmpeg-static not found, using system ffmpeg");
}

const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { Player, QueryType } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");
const axios = require("axios");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const player = new Player(client);
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

// State variables for customization
let currentVoice = "alloy";
let systemPrompt =
  "You are a helpful assistant. Always respond super concisely.";
const VALID_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const chatHistory = new Map(); // Key: channelId, Value: Array of message objects

async function setupPlayer() {
  await player.extractors.loadMulti(DefaultExtractors);
}

setupPlayer();

async function resolveSunoUrl(url) {
  if (!url.includes("suno.com") && !url.includes("suno.ai")) {
    return url;
  }

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const $ = cheerio.load(response.data);

    // Try to find the audio URL in meta tags
    const audioUrl =
      $('meta[property="og:audio"]').attr("content") ||
      $('meta[property="og:audio:secure_url"]').attr("content") ||
      $('meta[name="twitter:player:stream"]').attr("content");

    if (audioUrl) {
      return audioUrl;
    }

    throw new Error("Could not find audio URL on Suno page");
  } catch (error) {
    console.error("Error resolving Suno URL:", error.message);
    throw error;
  }
}

client.once("ready", () => {
  console.log(`Simple Suno Bot is ready! Logged in as ${client.user.tag}`);
});

// Event listener for when a track starts playing
player.events.on("playerStart", (queue, track) => {
  queue.metadata.channel.send(`🎶 Now playing: **${track.title}**`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.split(" ");
  const command = args[0].toLowerCase();

  // !chat <prompt>
  if (command === "!chat") {
    const prompt = message.content.slice(6).trim();
    if (!prompt)
      return message.reply(
        "Please provide a message! Usage: `!chat Hello bot`"
      );

    try {
      await message.channel.sendTyping();

      // Get or initialize history for this channel
      if (!chatHistory.has(message.channel.id)) {
        chatHistory.set(message.channel.id, []);
      }
      const history = chatHistory.get(message.channel.id);

      // Add user message
      history.push({ role: "user", content: prompt });

      // Keep history manageable (last 10 interactions = 20 messages)
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }

      // Construct messages array with system prompt first
      const messages = [{ role: "system", content: systemPrompt }, ...history];

      const completion = await openai.chat.completions.create({
        messages: messages,
        model: "gpt-5-mini",
      });

      const reply = completion.choices[0].message.content;

      // Add assistant response to history
      history.push({ role: "assistant", content: reply });

      // Discord has a 2000 char limit, split if necessary
      if (reply.length > 2000) {
        const chunks = reply.match(/[\s\S]{1,1900}/g) || [];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(reply);
      }
    } catch (error) {
      console.error("OpenAI Error:", error);
      await message.reply(`❌ AI Error: ${error.message}`);
    }
  }

  // !reset
  if (command === "!reset") {
    chatHistory.delete(message.channel.id);
    return message.reply("🧹 Chat history for this channel has been cleared.");
  }

  // !setvoice <voice>
  if (command === "!setvoice") {
    const voice = args[1]?.toLowerCase();
    if (!VALID_VOICES.includes(voice)) {
      return message.reply(
        `Please provide a valid voice: ${VALID_VOICES.join(", ")}`
      );
    }
    currentVoice = voice;
    return message.reply(`✅ Voice set to: **${currentVoice}**`);
  }

  // !setpersona <prompt>
  if (command === "!setpersona") {
    const persona = message.content.slice(12).trim();
    if (!persona)
      return message.reply(
        "Please provide a persona description! Usage: `!setpersona You are a helpful cat.`"
      );
    systemPrompt = persona;
    return message.reply(
      `✅ Persona updated! The bot will now behave as: "${systemPrompt}"`
    );
  }

  // !play <url>
  if (command === "!play") {
    const url = args[1];
    if (!url)
      return message.reply("Please provide a Suno link or any audio URL!");

    const channel = message.member.voice.channel;
    if (!channel)
      return message.reply("You need to be in a voice channel first!");

    try {
      const resolvedUrl = await resolveSunoUrl(url);
      await player.play(channel, resolvedUrl, {
        nodeOptions: {
          leaveOnEnd: false, // Don't leave immediately when song ends
          leaveOnEmpty: true, // Leave if channel is empty
          leaveOnEmptyCooldown: 300000, // Wait 5 minutes before leaving empty channel
          leaveOnStop: false, // Don't leave when stopped manually (unless code handles it)
          selfDeaf: true,
          metadata: {
            channel: message.channel,
            author: message.author,
          },
        },
      });
    } catch (e) {
      console.error(e);
      return message.reply(`❌ Error: ${e.message}`);
    }
  }

  // !stop
  if (command === "!stop") {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply("Nothing is playing right now.");
    queue.delete();
    return message.reply("Stopped the music and left the channel.");
  }

  // !pause
  if (command === "!pause") {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply("Nothing is playing right now.");
    queue.node.setPaused(true);
    return message.reply("Paused the music.");
  }

  // !resume
  if (command === "!resume") {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply("Nothing is playing right now.");
    queue.node.setPaused(false);
    return message.reply("Resumed the music.");
  }

  // !skip
  if (command === "!skip") {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying())
      return message.reply("Nothing is playing right now.");
    queue.node.skip();
    return message.reply("Skipped the current track.");
  }

  // !queue
  if (command === "!queue") {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply("The queue is empty.");
    const tracks = queue.tracks.toArray();
    const currentTrack = queue.currentTrack;

    let response = `**Currently Playing:** ${currentTrack.title}\n\n`;
    if (tracks.length > 0) {
      response +=
        `**Up Next:**\n` +
        tracks.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
    } else {
      response += `No tracks in queue.`;
    }
    return message.reply(response);
  }

  // !speak <text>
  if (command === "!speak") {
    const text = args.slice(1).join(" ");
    if (!text) return message.reply("Please provide text to speak!");

    const channel = message.member.voice.channel;
    if (!channel) return message.reply("Join a voice channel first!");

    try {
      await message.channel.sendTyping();

      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: currentVoice, // Uses the customized voice
        input: text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      const fs = require("fs");
      const path = require("path");
      const tempFile = path.join(__dirname, "tts_output.mp3");
      fs.writeFileSync(tempFile, buffer);

      await player.play(channel, tempFile, {
        searchEngine: QueryType.FILE,
        nodeOptions: {
          selfDeaf: true,
          metadata: {
            channel: message.channel,
            author: message.author,
          },
        },
      });
    } catch (e) {
      console.error(e);
      message.reply(`❌ Error: ${e.message}`);
    }
  }

  // !help
  if (command === "!help") {
    const helpEmbed = new EmbedBuilder()
      .setTitle("Suno Bot Commands")
      .setDescription("Here are the available commands:")
      .addFields(
        {
          name: "!chat <message>",
          value: `Ask GPT-5-mini a question. (Persona: ${systemPrompt.substring(
            0,
            50
          )}...)`,
        },
        { name: "!reset", value: "Clear the chat history for this channel." },
        {
          name: "!speak <message>",
          value: `Bot joins VC and speaks your text. (Voice: ${currentVoice})`,
        },
        {
          name: "!setvoice <name>",
          value: "Change voice: alloy, echo, fable, onyx, nova, shimmer.",
        },
        {
          name: "!setpersona <prompt>",
          value: "Change how the bot behaves/thinks.",
        },
        {
          name: "!play <url>",
          value: "Plays a Suno link or direct audio URL.",
        },
        {
          name: "!stop",
          value: "Stops the music and leaves the voice channel.",
        },
        { name: "!pause/!resume/!skip", value: "Control music playback." },
        { name: "!queue", value: "Shows the current music queue." },
        { name: "!help", value: "Shows this help message." }
      )
      .setColor("#ff0055");

    return message.reply({ embeds: [helpEmbed] });
  }
});

// Player event error handling
player.events.on("error", (queue, error) =>
  console.log(`[Queue Error] ${error.message}`)
);
player.events.on("playerError", (queue, error) =>
  console.log(`[Player Error] ${error.message}`)
);

client.login(process.env.DISCORD_TOKEN);
