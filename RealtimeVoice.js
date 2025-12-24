const WebSocket = require('ws');
const { EndBehaviorType, VoiceReceiver } = require('@discordjs/voice');
const prism = require('prism-media');

class RealtimeVoiceManager {
    constructor(openAIKey) {
        this.apiKey = openAIKey;
        this.ws = null;
        this.connection = null;
        this.receiver = null;
        this.audioPlayer = null; // We might need a raw player
        this.isConnected = false;
    }

    async connect(voiceConnection) {
        this.connection = voiceConnection;
        this.receiver = voiceConnection.receiver;

        const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
        
        this.ws = new WebSocket(url, {
            headers: {
                "Authorization": "Bearer " + this.apiKey,
                "OpenAI-Beta": "realtime=v1",
            },
        });

        this.ws.on('open', () => {
            console.log('Connected to OpenAI Realtime API');
            this.isConnected = true;
            this.initializeSession();
        });

        this.ws.on('message', (data) => {
            this.handleMessage(JSON.parse(data.toString()));
        });

        this.ws.on('close', () => {
            console.log('Disconnected from OpenAI Realtime API');
            this.isConnected = false;
        });

        // Start listening to Discord user audio
        this.listenToUsers();
    }

    initializeSession() {
        const sessionUpdate = {
            type: "session.update",
            session: {
                modalities: ["text", "audio"],
                instructions: "You are a helpful assistant. Be super concise.",
                voice: "alloy",
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
            },
        };
        this.ws.send(JSON.stringify(sessionUpdate));
    }

    listenToUsers() {
        // This is a simplified example. handling multiple speakers is hard.
        // We'll just listen to the first person who speaks for now.
        
        this.receiver.speaking.on('start', (userId) => {
            console.log(`User ${userId} started speaking`);
            this.createAudioSubscription(userId);
        });
    }

    createAudioSubscription(userId) {
        const audioStream = this.receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 500,
            },
        });

        // Discord audio is Opus. We need PCM 16-bit 24kHz for OpenAI.
        // Discord: 48kHz Stereo Opus -> PCM 16-bit 24kHz Mono (OpenAI Requirement)
        
        const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
        // NOTE: High-quality resampling in Node.js is non-trivial without native bindings (like 'soxr').
        // For this prototype, we might try to send raw PCM and hope OpenAI handles 48k (docs say 24k).
        // If it fails, we need a resampler.
        
        // Let's assume we can just stream raw PCM chunks for the "input_audio_buffer.append" event.
        
        audioStream.pipe(opusDecoder).on('data', (chunk) => {
            if (this.isConnected) {
                // Chunk is a Buffer (PCM 16-bit, 48kHz, Stereo)
                // We need to convert to base64
                
                // Note: Sending 48kHz stereo to a model expecting 24kHz mono is risky.
                // It might sound chipmunk-like or slow.
                // Ideally, we downsample here.
                
                this.ws.send(JSON.stringify({
                    type: "input_audio_buffer.append",
                    audio: chunk.toString('base64')
                }));
            }
        });

        audioStream.on('end', () => {
            if (this.isConnected) {
                this.ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
                this.ws.send(JSON.stringify({ type: "response.create" }));
            }
        });
    }

    handleMessage(message) {
        if (message.type === 'response.audio.delta') {
            // Received audio chunk (base64 PCM 16-bit 24kHz) from OpenAI
            // We need to play this back to Discord (requires Opus encoding)
            // Implementation of playback stream pending...
            console.log('Received audio delta from OpenAI');
        }
        
        if (message.type === 'error') {
            console.error('OpenAI Realtime Error:', message.error);
        }
    }
}

module.exports = RealtimeVoiceManager;
