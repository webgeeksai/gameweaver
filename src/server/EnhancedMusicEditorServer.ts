/**
 * Enhanced Music Editor Server for Game Vibe Engine
 * Full ElevenLabs integration with real audio generation, save/export, and asset management
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class EnhancedMusicEditorServer {
    private server: http.Server | null = null;
    private port: number = 3003;
    private elevenLabsApiKey: string | null = null;

    constructor() {
        this.port = this.findAvailablePort();
        this.loadApiKey();
    }

    private findAvailablePort(): number {
        return 3003 + Math.floor(Math.random() * 1000);
    }

    private loadApiKey(): void {
        try {
            // Try to get API key from VS Code settings
            const config = vscode.workspace.getConfiguration('gameVibe');
            this.elevenLabsApiKey = config.get<string>('elevenLabsApiKey') || null;
        } catch (error) {
            console.log('Could not load ElevenLabs API key from VS Code settings');
        }
    }

    async start(audioData: string, workspaceRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, audioData, workspaceRoot);
            });

            this.server.listen(this.port, () => {
                const url = `http://localhost:${this.port}`;
                console.log(`🎵 Enhanced Music Editor Server started at ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                console.error('Enhanced Music Editor Server error:', error);
                reject(error);
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('🛑 Enhanced Music Editor Server stopped');
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, audioData: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`🎵 Enhanced Music Editor Request: ${req.method} ${url}`);

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (url === '/') {
            this.serveMusicEditorHTML(res);
        } else if (url === '/api/generate-speech' && req.method === 'POST') {
            this.handleGenerateSpeech(req, res);
        } else if (url === '/api/generate-sfx' && req.method === 'POST') {
            this.handleGenerateSoundEffect(req, res);
        } else if (url === '/api/design-voice' && req.method === 'POST') {
            this.handleDesignVoice(req, res);
        } else if (url === '/api/create-voice' && req.method === 'POST') {
            this.handleCreateVoice(req, res);
        } else if (url === '/api/voices') {
            this.handleGetVoices(res);
        } else if (url === '/api/models') {
            this.handleGetModels(res);
        } else if (url === '/api/usage') {
            this.handleGetUsage(res);
        } else if (url === '/api/save-audio' && req.method === 'POST') {
            this.handleSaveAudio(req, res, workspaceRoot);
        } else if (url === '/api/generate-presets' && req.method === 'POST') {
            this.handleGeneratePresets(req, res);
        } else if (url === '/api/set-api-key' && req.method === 'POST') {
            this.handleSetApiKey(req, res);
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    private serveMusicEditorHTML(res: http.ServerResponse): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Music Editor - Browser Edition</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
            background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
            color: #f0f6fc;
            overflow: hidden;
        }

        .icon {
            font-family: 'SF Pro Icons', -apple-system, BlinkMacSystemFont, monospace;
            font-weight: 400;
            font-style: normal;
            line-height: 1;
            display: inline-block;
        }

        .music-editor {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        .header {
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border-bottom: 2px solid #30363d;
            padding: 16px 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 20px;
            font-weight: 700;
            color: #58a6ff;
        }

        .header-actions {
            display: flex;
            gap: 10px;
        }

        .header-btn {
            background: #238636;
            color: #fff;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        .header-btn:hover {
            background: #2ea043;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .header-btn.secondary {
            background: #373e47;
            color: #f0f6fc;
        }

        .header-btn.secondary:hover {
            background: #424a53;
        }

        .api-status {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #e74c3c;
        }

        .status-indicator.connected {
            background: #27ae60;
        }

        .api-key-input {
            background: #161b22;
            color: #f0f6fc;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 13px;
            width: 240px;
            transition: all 0.2s ease;
        }

        .api-key-input:focus {
            outline: none;
            border-color: #58a6ff;
            box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
            background: #21262d;
        }

        .btn {
            background: #373e47;
            color: #f0f6fc;
            border: 1px solid #424a53;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }

        .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(88, 166, 255, 0.15), transparent);
            transition: left 0.5s;
        }

        .btn:hover::before {
            left: 100%;
        }

        .btn:hover {
            background: #424a53;
            border-color: #58a6ff;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .btn:disabled {
            background: #21262d;
            color: #6e7681;
            border-color: #30363d;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .tab-nav {
            background: linear-gradient(135deg, #21262d 0%, #30363d 100%);
            border-bottom: 2px solid #424a53;
            display: flex;
            padding: 0 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .tab-button {
            background: none;
            color: #8b949e;
            border: none;
            padding: 14px 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            border-bottom: 3px solid transparent;
            font-weight: 500;
            font-size: 14px;
            position: relative;
            overflow: hidden;
        }

        .tab-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(88, 166, 255, 0.15), transparent);
            transition: left 0.5s;
        }

        .tab-button:hover::before {
            left: 100%;
        }

        .tab-button:hover {
            color: #f0f6fc;
            background: rgba(88, 166, 255, 0.1);
        }

        .tab-button.active {
            color: #58a6ff;
            border-bottom-color: #58a6ff;
            background: rgba(88, 166, 255, 0.1);
        }

        .content {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        .tab-content {
            display: none;
            flex: 1;
            flex-direction: column;
            padding: 20px;
            overflow-y: auto;
        }

        .tab-content.active { display: flex; }

        .generation-panel {
            background: linear-gradient(135deg, #21262d 0%, #30363d 100%);
            border: 1px solid #424a53;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .generation-panel h3 {
            margin: 0 0 20px 0;
            color: #58a6ff;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 13px;
            color: #8b949e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 12px 16px;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            color: #f0f6fc;
            font-size: 14px;
            font-family: inherit;
            transition: all 0.2s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
            outline: none;
            border-color: #58a6ff;
            box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
            background: #21262d;
        }

        .form-group textarea {
            resize: vertical;
            min-height: 100px;
            line-height: 1.4;
        }

        .form-row {
            display: flex;
            gap: 15px;
        }

        .form-row .form-group {
            flex: 1;
        }

        .primary-button {
            background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
            color: #fff;
            border: none;
            padding: 14px 28px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: all 0.2s ease;
            width: 100%;
            box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
            position: relative;
            overflow: hidden;
        }

        .primary-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }

        .primary-button:hover::before {
            left: 100%;
        }

        .primary-button:hover {
            background: linear-gradient(135deg, #2ea043 0%, #238636 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(35, 134, 54, 0.4);
        }

        .primary-button:disabled {
            background: #21262d;
            color: #6e7681;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .audio-library {
            background: linear-gradient(135deg, #21262d 0%, #30363d 100%);
            border: 1px solid #424a53;
            border-radius: 12px;
            padding: 24px;
            flex: 1;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .audio-library h3 {
            margin: 0 0 20px 0;
            color: #58a6ff;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .audio-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 15px;
        }

        .audio-item {
            background: #3a3a3a;
            border-radius: 6px;
            padding: 15px;
            border: 1px solid #555;
            transition: border-color 0.2s;
        }

        .audio-item:hover { border-color: #007acc; }

        .audio-item h4 {
            margin: 0 0 10px 0;
            color: #fff;
            font-size: 14px;
        }

        .audio-controls {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 10px;
        }

        .audio-controls audio {
            flex: 1;
            height: 32px;
        }

        .control-btn {
            background: #555;
            color: #fff;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            transition: background 0.2s;
        }

        .control-btn:hover { background: #666; }

        .audio-info {
            font-size: 11px;
            color: #aaa;
            margin-top: 8px;
            line-height: 1.3;
        }

        .voice-settings {
            background: #3a3a3a;
            border-radius: 6px;
            padding: 15px;
            margin: 15px 0;
        }

        .voice-settings h4 {
            margin: 0 0 12px 0;
            color: #007acc;
            font-size: 14px;
        }

        .range-control {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }

        .range-control label {
            min-width: 100px;
            font-size: 12px;
        }

        .range-control input[type="range"] {
            flex: 1;
        }

        .range-value {
            color: #007acc;
            font-weight: 500;
            min-width: 40px;
            text-align: right;
            font-size: 12px;
        }

        .voice-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
        }

        .voice-item {
            background: #3a3a3a;
            border-radius: 6px;
            padding: 15px;
            border: 1px solid #555;
            text-align: center;
            transition: border-color 0.2s;
        }

        .voice-item:hover { border-color: #007acc; }

        .voice-item h4 {
            margin: 0 0 8px 0;
            color: #fff;
            font-size: 14px;
        }

        .voice-item p {
            margin: 4px 0;
            color: #aaa;
            font-size: 11px;
        }

        .usage-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .usage-item {
            background: #3a3a3a;
            border-radius: 6px;
            padding: 20px;
            text-align: center;
            border: 1px solid #555;
        }

        .usage-item h4 {
            margin: 0 0 10px 0;
            color: #007acc;
            font-size: 14px;
        }

        .usage-value {
            font-size: 28px;
            font-weight: bold;
            color: #fff;
            margin: 5px 0;
        }

        .usage-label {
            color: #aaa;
            font-size: 11px;
        }

        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .loading-overlay.hidden { display: none; }

        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #333;
            border-top: 4px solid #007acc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .api-key-notice {
            background: #4a2c2a;
            border: 1px solid #8b4513;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
            color: #ffcc99;
        }

        .api-key-notice h4 {
            margin: 0 0 10px 0;
            color: #ff9966;
        }

        .error-message {
            background: #4a2c2a;
            border: 1px solid #e74c3c;
            border-radius: 6px;
            padding: 15px;
            margin: 15px 0;
            color: #ffcc99;
        }

        .success-message {
            background: #2a4a2a;
            border: 1px solid #27ae60;
            border-radius: 6px;
            padding: 15px;
            margin: 15px 0;
            color: #99ffcc;
        }
    </style>
</head>
<body>
    <div class="music-editor">
        <div class="header">
            <div class="header-content">
                <div class="header-title">
                    <span class="icon">♪</span> Music Editor
                    <span style="font-size: 12px; color: #8b949e; font-weight: 400;">Enhanced Edition</span>
                </div>
                <div class="api-status">
                    <div id="status-indicator" class="status-indicator"></div>
                    <span id="status-text">Checking API...</span>
                    <input type="password" id="api-key-input" class="api-key-input" placeholder="Enter ElevenLabs API Key">
                    <button class="btn" onclick="setApiKey()">Set Key</button>
                </div>
            </div>
        </div>

        <div class="tab-nav">
            <button class="tab-button active" onclick="switchTab('sound-effects')"><span class="icon">♫</span> Sound Effects</button>
            <button class="tab-button" onclick="switchTab('voice-generation')"><span class="icon">♪</span> Voice Generation</button>
            <button class="tab-button" onclick="switchTab('voice-design')"><span class="icon">♬</span> Voice Design</button>
            <button class="tab-button" onclick="switchTab('game-presets')"><span class="icon">♩</span> Game Presets</button>
            <button class="tab-button" onclick="switchTab('usage-stats')"><span class="icon">◐</span> Usage Stats</button>
        </div>

        <div class="content">
            <!-- Sound Effects Tab -->
            <div id="sound-effects" class="tab-content active">
                <div class="generation-panel">
                    <h3><span class="icon">♫</span> Generate Sound Effects</h3>
                    <div class="form-group">
                        <label for="sfx-prompt">Sound Effect Description:</label>
                        <textarea id="sfx-prompt" placeholder="Describe the sound effect in detail...

Examples:
• Retro 8-bit jump sound with a short ascending pitch
• Metallic sword clashing with reverb
• Coin collection chime with sparkle effect
• Explosion with deep bass and crackling
• Footsteps on gravel with echo">Retro 8-bit jump sound with a short ascending pitch</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="sfx-duration">Duration (seconds):</label>
                            <input type="number" id="sfx-duration" min="0.1" max="22" step="0.1" value="2.0">
                        </div>
                        <div class="form-group">
                            <label>Prompt Influence:</label>
                            <div class="range-control">
                                <input type="range" id="sfx-prompt-influence" min="0" max="1" step="0.1" value="0.7">
                                <span class="range-value">0.7</span>
                            </div>
                        </div>
                    </div>
                    <button id="generate-sfx-btn" class="primary-button" onclick="generateSoundEffect()">
                        Generate Sound Effect
                    </button>
                </div>

                <div class="audio-library">
                    <h3><span class="icon">♬</span> Generated Sound Effects</h3>
                    <div id="sfx-library" class="audio-grid">
                        <!-- Generated sound effects will appear here -->
                    </div>
                </div>
            </div>

            <!-- Voice Generation Tab -->
            <div id="voice-generation" class="tab-content">
                <div class="generation-panel">
                    <h3><span class="icon">♪</span> Text-to-Speech Generation</h3>
                    <div class="form-group">
                        <label for="tts-text">Text to Speak:</label>
                        <textarea id="tts-text" placeholder="Enter the text you want to convert to speech...">Welcome, brave adventurer! Your quest awaits in the mystical lands beyond. Gather your courage and step into destiny!</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tts-voice">Voice:</label>
                            <select id="tts-voice">
                                <option value="">Loading voices...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="tts-model">Model:</label>
                            <select id="tts-model">
                                <option value="eleven_multilingual_v2">Multilingual v2 (Recommended)</option>
                                <option value="eleven_turbo_v2_5">Turbo v2.5 (Fast)</option>
                                <option value="eleven_flash_v2_5">Flash v2.5 (Fastest)</option>
                            </select>
                        </div>
                    </div>
                    <div class="voice-settings">
                        <h4>Voice Settings</h4>
                        <div class="range-control">
                            <label>Stability:</label>
                            <input type="range" id="voice-stability" min="0" max="1" step="0.1" value="0.5">
                            <span class="range-value">0.5</span>
                        </div>
                        <div class="range-control">
                            <label>Similarity Boost:</label>
                            <input type="range" id="voice-similarity" min="0" max="1" step="0.1" value="0.8">
                            <span class="range-value">0.8</span>
                        </div>
                        <div class="range-control">
                            <label>Style Exaggeration:</label>
                            <input type="range" id="voice-style" min="0" max="1" step="0.1" value="0.0">
                            <span class="range-value">0.0</span>
                        </div>
                    </div>
                    <button id="generate-tts-btn" class="primary-button" onclick="generateSpeech()">
                        Generate Speech
                    </button>
                </div>

                <div class="audio-library">
                    <h3><span class="icon">♩</span> Generated Speech</h3>
                    <div id="tts-library" class="audio-grid">
                        <!-- Generated speech will appear here -->
                    </div>
                </div>
            </div>

            <!-- Voice Design Tab -->
            <div id="voice-design" class="tab-content">
                <div class="generation-panel">
                    <h3>Design Custom Voice</h3>
                    <div class="form-group">
                        <label for="voice-description">Voice Description:</label>
                        <textarea id="voice-description" placeholder="Describe the voice you want to create...

Examples:
• A wise old wizard with a deep, resonant voice and slight rasp
• A cheerful young fairy with a light, musical voice
• A gruff pirate captain with a rough, commanding voice
• A robotic AI with synthetic undertones
• A mysterious sorceress with an ethereal, whispered voice">A brave knight with a strong, confident voice and noble bearing</textarea>
                    </div>
                    <div class="form-group">
                        <label for="voice-preview-text">Preview Text:</label>
                        <input type="text" id="voice-preview-text" value="Greetings! I am your character speaking. This voice will bring life to your game's dialogue and narration.">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="voice-gender">Gender:</label>
                            <select id="voice-gender">
                                <option value="">Any</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="neutral">Neutral</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="voice-age">Age:</label>
                            <select id="voice-age">
                                <option value="">Any</option>
                                <option value="young">Young</option>
                                <option value="middle_aged">Middle Aged</option>
                                <option value="old">Old</option>
                            </select>
                        </div>
                    </div>
                    <button id="design-voice-btn" class="primary-button" onclick="designVoice()">
                        Design Voice
                    </button>
                </div>

                <div class="voice-previews">
                    <h3>Voice Previews</h3>
                    <div id="voice-preview-grid" class="voice-grid">
                        <!-- Voice previews will appear here -->
                    </div>
                </div>
            </div>

            <!-- Game Presets Tab -->
            <div id="game-presets" class="tab-content">
                <div class="generation-panel">
                    <h3>Generate Game Audio Presets</h3>
                    <div class="form-group">
                        <label for="game-type">Game Type:</label>
                        <select id="game-type">
                            <option value="platformer">Platformer (Jump, Coin, Defeat sounds)</option>
                            <option value="shooter">Shooter (Laser, Explosion, Reload sounds)</option>
                            <option value="puzzle">Puzzle (Click, Success, Wrong sounds)</option>
                            <option value="rpg">RPG (Sword, Magic, Treasure sounds)</option>
                            <option value="racing">Racing (Engine, Drift, Crash sounds)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="audio-style">Audio Style:</label>
                        <select id="audio-style">
                            <option value="retro">Retro 8-bit/16-bit style</option>
                            <option value="modern">Modern realistic sounds</option>
                            <option value="fantasy">Fantasy/magical sounds</option>
                            <option value="scifi">Sci-fi/futuristic sounds</option>
                        </select>
                    </div>
                    <button id="generate-presets-btn" class="primary-button" onclick="generateGamePresets()">
                        Generate Audio Pack
                    </button>
                </div>

                <div class="presets-library">
                    <h3>Game Audio Packs</h3>
                    <div id="presets-library" class="audio-grid">
                        <!-- Generated presets will appear here -->
                    </div>
                </div>
            </div>

            <!-- Usage Stats Tab -->
            <div id="usage-stats" class="tab-content">
                <div class="stats-panel">
                    <h3>ElevenLabs Usage Statistics</h3>
                    <div id="usage-info" class="usage-grid">
                        <!-- Usage info will appear here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Loading overlay -->
    <div id="loading-overlay" class="loading-overlay hidden">
        <div class="spinner"></div>
        <p id="loading-text">Generating audio...</p>
    </div>

    <script>
        class EnhancedMusicEditor {
            constructor() {
                this.apiKeySet = false;
                this.currentTab = 'sound-effects';
                this.voices = [];
                this.models = [];
                this.usageInfo = null;
                
                this.initializeRangeInputs();
                this.checkApiStatus();
                this.loadInitialData();
            }

            initializeRangeInputs() {
                // Update range value displays
                document.querySelectorAll('input[type="range"]').forEach(slider => {
                    const updateValue = () => {
                        const valueDisplay = slider.parentElement.querySelector('.range-value');
                        if (valueDisplay) {
                            valueDisplay.textContent = slider.value;
                        }
                    };
                    
                    slider.addEventListener('input', updateValue);
                    updateValue(); // Initial value
                });
            }

            async checkApiStatus() {
                try {
                    const response = await fetch('/api/voices');
                    const data = await response.json();
                    
                    if (response.ok && data.length > 0) {
                        this.setApiStatus(true, 'API Connected');
                        this.apiKeySet = true;
                    } else {
                        this.setApiStatus(false, 'API Key Required');
                    }
                } catch (error) {
                    this.setApiStatus(false, 'Connection Failed');
                }
            }

            setApiStatus(connected, message) {
                const indicator = document.getElementById('status-indicator');
                const text = document.getElementById('status-text');
                
                indicator.classList.toggle('connected', connected);
                text.textContent = message;
                
                // Enable/disable generation buttons
                const buttons = document.querySelectorAll('.primary-button');
                buttons.forEach(btn => btn.disabled = !connected);
            }

            async setApiKey() {
                const apiKey = document.getElementById('api-key-input').value.trim();
                if (!apiKey) {
                    alert('Please enter an API key');
                    return;
                }

                try {
                    this.showLoading('Setting API key...');
                    
                    const response = await fetch('/api/set-api-key', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        this.apiKeySet = true;
                        this.setApiStatus(true, 'API Connected');
                        document.getElementById('api-key-input').value = '';
                        await this.loadInitialData();
                        this.showMessage('API key set successfully!', 'success');
                    } else {
                        this.showMessage('Invalid API key: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('Error setting API key: ' + error.message, 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async loadInitialData() {
                if (!this.apiKeySet) return;

                try {
                    // Load voices, models, and usage info in parallel
                    const [voicesResponse, modelsResponse, usageResponse] = await Promise.all([
                        fetch('/api/voices'),
                        fetch('/api/models'),
                        fetch('/api/usage')
                    ]);

                    if (voicesResponse.ok) {
                        this.voices = await voicesResponse.json();
                        this.populateVoiceSelect();
                    }

                    if (modelsResponse.ok) {
                        this.models = await modelsResponse.json();
                    }

                    if (usageResponse.ok) {
                        this.usageInfo = await usageResponse.json();
                        this.displayUsageInfo();
                    }
                } catch (error) {
                    console.error('Error loading initial data:', error);
                }
            }

            populateVoiceSelect() {
                const voiceSelect = document.getElementById('tts-voice');
                voiceSelect.innerHTML = '<option value="">Select a voice...</option>';

                this.voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.voice_id;
                    option.textContent = \`\${voice.name} (\${voice.category || 'Custom'})\`;
                    voiceSelect.appendChild(option);
                });
            }

            displayUsageInfo() {
                if (!this.usageInfo) return;

                const container = document.getElementById('usage-info');
                container.innerHTML = \`
                    <div class="usage-item">
                        <h4>Characters Used</h4>
                        <div class="usage-value">\${this.usageInfo.character_count || 0}</div>
                        <div class="usage-label">of \${this.usageInfo.character_limit || 'unlimited'}</div>
                    </div>
                    <div class="usage-item">
                        <h4>Voice Generations</h4>
                        <div class="usage-value">\${this.usageInfo.voice_count || 0}</div>
                        <div class="usage-label">total this month</div>
                    </div>
                    <div class="usage-item">
                        <h4>Subscription Tier</h4>
                        <div class="usage-value">\${this.usageInfo.tier || 'Free'}</div>
                        <div class="usage-label">current plan</div>
                    </div>
                    <div class="usage-item">
                        <h4>API Requests</h4>
                        <div class="usage-value">\${this.usageInfo.api_requests || 0}</div>
                        <div class="usage-label">this session</div>
                    </div>
                \`;
            }

            switchTab(tabName) {
                // Update tab buttons
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');

                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.getElementById(tabName).classList.add('active');

                this.currentTab = tabName;
            }

            async generateSoundEffect() {
                const prompt = document.getElementById('sfx-prompt').value.trim();
                const duration = parseFloat(document.getElementById('sfx-duration').value);
                const promptInfluence = parseFloat(document.getElementById('sfx-prompt-influence').value);

                if (!prompt) {
                    this.showMessage('Please enter a sound effect description', 'error');
                    return;
                }

                try {
                    this.showLoading('Generating sound effect...');

                    const response = await fetch('/api/generate-sfx', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt, duration, promptInfluence })
                    });

                    const result = await response.json();

                    if (result.success) {
                        this.addAudioToLibrary('sfx-library', result.audio, prompt, 'Sound Effect');
                        this.showMessage('Sound effect generated successfully!', 'success');
                    } else {
                        this.showMessage('Failed to generate sound effect: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('Error generating sound effect: ' + error.message, 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async generateSpeech() {
                const text = document.getElementById('tts-text').value.trim();
                const voiceId = document.getElementById('tts-voice').value;
                const modelId = document.getElementById('tts-model').value;
                const stability = parseFloat(document.getElementById('voice-stability').value);
                const similarityBoost = parseFloat(document.getElementById('voice-similarity').value);
                const style = parseFloat(document.getElementById('voice-style').value);

                if (!text) {
                    this.showMessage('Please enter text to convert to speech', 'error');
                    return;
                }

                if (!voiceId) {
                    this.showMessage('Please select a voice', 'error');
                    return;
                }

                try {
                    this.showLoading('Generating speech...');

                    const response = await fetch('/api/generate-speech', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text,
                            voiceId,
                            modelId,
                            voiceSettings: {
                                stability,
                                similarityBoost,
                                style
                            }
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        const truncatedText = text.length > 50 ? text.substring(0, 50) + '...' : text;
                        this.addAudioToLibrary('tts-library', result.audio, truncatedText, 'Speech');
                        this.showMessage('Speech generated successfully!', 'success');
                    } else {
                        this.showMessage('Failed to generate speech: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('Error generating speech: ' + error.message, 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async designVoice() {
                const description = document.getElementById('voice-description').value.trim();
                const previewText = document.getElementById('voice-preview-text').value.trim();
                const gender = document.getElementById('voice-gender').value;
                const age = document.getElementById('voice-age').value;

                if (!description) {
                    this.showMessage('Please enter a voice description', 'error');
                    return;
                }

                try {
                    this.showLoading('Designing voice...');

                    const response = await fetch('/api/design-voice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            description,
                            text: previewText,
                            gender,
                            age
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        this.displayVoicePreviews(result.voices);
                        this.showMessage('Voice design completed!', 'success');
                    } else {
                        this.showMessage('Failed to design voice: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('Error designing voice: ' + error.message, 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async generateGamePresets() {
                const gameType = document.getElementById('game-type').value;
                const audioStyle = document.getElementById('audio-style').value;

                try {
                    this.showLoading('Generating game audio pack...');

                    const response = await fetch('/api/generate-presets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ gameType, audioStyle })
                    });

                    const result = await response.json();

                    if (result.success) {
                        this.displayGamePresets(result.presets, gameType);
                        this.showMessage('Game audio pack generated successfully!', 'success');
                    } else {
                        this.showMessage('Failed to generate game presets: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('Error generating game presets: ' + error.message, 'error');
                } finally {
                    this.hideLoading();
                }
            }

            displayVoicePreviews(voices) {
                const grid = document.getElementById('voice-preview-grid');
                grid.innerHTML = '';

                voices.forEach((voice, index) => {
                    const voiceItem = document.createElement('div');
                    voiceItem.className = 'voice-item';

                    voiceItem.innerHTML = \`
                        <h4>Voice Preview \${index + 1}</h4>
                        <div class="audio-controls">
                            <audio controls style="width: 100%;">
                                <source src="\${voice.preview_url}" type="audio/mpeg">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                        <p>Voice ID: \${voice.voice_id}</p>
                        <button class="control-btn" onclick="musicEditor.createVoice('\${voice.voice_id}', 'Custom Voice \${index + 1}')">
                            Create Voice
                        </button>
                    \`;

                    grid.appendChild(voiceItem);
                });
            }

            displayGamePresets(presets, gameType) {
                const library = document.getElementById('presets-library');
                library.innerHTML = '';

                Object.entries(presets).forEach(([key, audio]) => {
                    this.addAudioToLibrary('presets-library', audio, \`\${gameType} - \${key.replace(/_/g, ' ')}\`, 'Game Audio');
                });
            }

            addAudioToLibrary(libraryId, audio, title, type) {
                const library = document.getElementById(libraryId);
                const audioItem = document.createElement('div');
                audioItem.className = 'audio-item';

                const timestamp = new Date().toLocaleTimeString();
                
                audioItem.innerHTML = \`
                    <h4>\${title}</h4>
                    <div class="audio-controls">
                        <audio controls style="width: 100%;">
                            <source src="data:audio/mpeg;base64,\${audio.audioData}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                        <button class="control-btn" onclick="musicEditor.saveAudio('\${audio.filename}', '\${audio.audioData}', '\${title}')">
                            💾 Save
                        </button>
                    </div>
                    <div class="audio-info">
                        <strong>Type:</strong> \${type}<br>
                        <strong>Format:</strong> \${audio.format || 'mp3'}<br>
                        <strong>Generated:</strong> \${timestamp}
                        \${audio.duration ? \`<br><strong>Duration:</strong> \${audio.duration}s\` : ''}
                    </div>
                \`;

                library.appendChild(audioItem);
            }

            async saveAudio(filename, audioData, title) {
                try {
                    this.showLoading('Saving audio...');

                    const response = await fetch('/api/save-audio', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename,
                            audioData,
                            title
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        this.showMessage(\`Audio saved successfully to assets/audio/\${filename}\`, 'success');
                    } else {
                        this.showMessage('Failed to save audio: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('Error saving audio: ' + error.message, 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async createVoice(voiceId, name) {
                const customName = prompt('Enter a name for this voice:', name);
                if (!customName) return;

                try {
                    this.showLoading('Creating voice...');

                    const response = await fetch('/api/create-voice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            voiceId,
                            name: customName,
                            description: 'Custom voice created in Game Vibe Music Editor'
                        })
                    });

                    const result = await response.json();

                    if (result.success) {
                        this.showMessage(\`Voice "\${customName}" created successfully!\`, 'success');
                        await this.loadInitialData(); // Refresh voice list
                    } else {
                        this.showMessage('Failed to create voice: ' + result.error, 'error');
                    }
                } catch (error) {
                    this.showMessage('Error creating voice: ' + error.message, 'error');
                } finally {
                    this.hideLoading();
                }
            }

            showLoading(text = 'Processing...') {
                document.getElementById('loading-text').textContent = text;
                document.getElementById('loading-overlay').classList.remove('hidden');
            }

            hideLoading() {
                document.getElementById('loading-overlay').classList.add('hidden');
            }

            showMessage(message, type = 'info') {
                // Remove existing messages
                document.querySelectorAll('.error-message, .success-message').forEach(el => el.remove());

                const messageDiv = document.createElement('div');
                messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
                messageDiv.textContent = message;

                const activeTab = document.querySelector('.tab-content.active');
                if (activeTab) {
                    activeTab.insertBefore(messageDiv, activeTab.firstChild);
                }

                // Auto-remove after 5 seconds
                setTimeout(() => messageDiv.remove(), 5000);
            }
        }

        // Global instance
        let musicEditor;

        // Global functions for HTML events
        function switchTab(tabName) {
            musicEditor.switchTab(tabName);
        }

        function setApiKey() {
            musicEditor.setApiKey();
        }

        function generateSoundEffect() {
            musicEditor.generateSoundEffect();
        }

        function generateSpeech() {
            musicEditor.generateSpeech();
        }

        function designVoice() {
            musicEditor.designVoice();
        }

        function generateGamePresets() {
            musicEditor.generateGamePresets();
        }

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', () => {
            musicEditor = new EnhancedMusicEditor();
        });
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    private async handleSetApiKey(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { apiKey } = JSON.parse(body);
                
                // Test the API key by making a simple request
                const testResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
                    headers: {
                        'xi-api-key': apiKey
                    }
                });

                if (testResponse.ok) {
                    this.elevenLabsApiKey = apiKey;
                    
                    // Save to VS Code settings if possible
                    try {
                        const config = vscode.workspace.getConfiguration('gameVibe');
                        await config.update('elevenLabsApiKey', apiKey, vscode.ConfigurationTarget.Global);
                    } catch (error) {
                        console.log('Could not save API key to VS Code settings');
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid API key' }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleGenerateSpeech(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.elevenLabsApiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'API key not set' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { text, voiceId, modelId, voiceSettings } = JSON.parse(body);

                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': this.elevenLabsApiKey!,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text,
                        model_id: modelId,
                        voice_settings: voiceSettings
                    })
                });

                if (response.ok) {
                    const audioBuffer = await response.arrayBuffer();
                    const base64Audio = Buffer.from(audioBuffer).toString('base64');
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        audio: {
                            audioData: base64Audio,
                            filename: `speech_${Date.now()}.mp3`,
                            format: 'mp3'
                        }
                    }));
                } else {
                    const error = await response.text();
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleGenerateSoundEffect(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.elevenLabsApiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'API key not set' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { prompt, duration, promptInfluence } = JSON.parse(body);

                const response = await fetch('https://api.elevenlabs.io/v1/sound-effects', {
                    method: 'POST',
                    headers: {
                        'xi-api-key': this.elevenLabsApiKey!,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: prompt,
                        duration_seconds: duration,
                        prompt_influence: promptInfluence
                    })
                });

                if (response.ok) {
                    const audioBuffer = await response.arrayBuffer();
                    const base64Audio = Buffer.from(audioBuffer).toString('base64');
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        audio: {
                            audioData: base64Audio,
                            filename: `sfx_${Date.now()}.mp3`,
                            format: 'mp3',
                            duration
                        }
                    }));
                } else {
                    const error = await response.text();
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleDesignVoice(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.elevenLabsApiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'API key not set' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { description, text, gender, age } = JSON.parse(body);

                const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice', {
                    method: 'POST',
                    headers: {
                        'xi-api-key': this.elevenLabsApiKey!,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: text || "Hello, this is a voice preview for your game character.",
                        voice_description: description,
                        gender,
                        age
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        voices: result.previews || []
                    }));
                } else {
                    const error = await response.text();
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleCreateVoice(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.elevenLabsApiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'API key not set' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { voiceId, name, description } = JSON.parse(body);

                const response = await fetch('https://api.elevenlabs.io/v1/text-to-voice/create-previews', {
                    method: 'POST',
                    headers: {
                        'xi-api-key': this.elevenLabsApiKey!,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        voice_name: name,
                        voice_description: description,
                        generated_voice_id: voiceId
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        voice: result
                    }));
                } else {
                    const error = await response.text();
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleGetVoices(res: http.ServerResponse): Promise<void> {
        if (!this.elevenLabsApiKey) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
            return;
        }

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': this.elevenLabsApiKey!
                }
            });

            if (response.ok) {
                const result = await response.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result.voices || []));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
            }
        } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
        }
    }

    private async handleGetModels(res: http.ServerResponse): Promise<void> {
        if (!this.elevenLabsApiKey) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
            return;
        }

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/models', {
                headers: {
                    'xi-api-key': this.elevenLabsApiKey!
                }
            });

            if (response.ok) {
                const result = await response.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
            }
        } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
        }
    }

    private async handleGetUsage(res: http.ServerResponse): Promise<void> {
        if (!this.elevenLabsApiKey) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ character_count: 0, character_limit: 0, tier: 'No API Key' }));
            return;
        }

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
                headers: {
                    'xi-api-key': this.elevenLabsApiKey!
                }
            });

            if (response.ok) {
                const result = await response.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ character_count: 0, character_limit: 0, tier: 'Unknown' }));
            }
        } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ character_count: 0, character_limit: 0, tier: 'Error' }));
        }
    }

    private async handleSaveAudio(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { filename, audioData, title } = JSON.parse(body);

                const audioPath = path.join(workspaceRoot, 'assets', 'audio');
                if (!fs.existsSync(audioPath)) {
                    fs.mkdirSync(audioPath, { recursive: true });
                }

                // Convert base64 to buffer and save
                const buffer = Buffer.from(audioData, 'base64');
                const filePath = path.join(audioPath, filename);
                fs.writeFileSync(filePath, buffer);

                // Save metadata
                const metadataPath = path.join(audioPath, filename.replace('.mp3', '.meta.json'));
                const metadata = {
                    title,
                    filename,
                    generatedAt: new Date().toISOString(),
                    source: 'ElevenLabs'
                };
                fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: filename }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleGeneratePresets(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.elevenLabsApiKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'API key not set' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { gameType, audioStyle } = JSON.parse(body);

                // Define preset prompts based on game type and style
                const presetPrompts = this.getPresetPrompts(gameType, audioStyle);
                const presets: any = {};

                // Generate each preset
                for (const [key, prompt] of Object.entries(presetPrompts)) {
                    try {
                        const response = await fetch('https://api.elevenlabs.io/v1/sound-effects', {
                            method: 'POST',
                            headers: {
                                'xi-api-key': this.elevenLabsApiKey!,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                text: prompt,
                                duration_seconds: 2.0,
                                prompt_influence: 0.7
                            })
                        });

                        if (response.ok) {
                            const audioBuffer = await response.arrayBuffer();
                            const base64Audio = Buffer.from(audioBuffer).toString('base64');
                            
                            presets[key] = {
                                audioData: base64Audio,
                                filename: `${gameType}_${key}_${Date.now()}.mp3`,
                                format: 'mp3',
                                duration: 2.0
                            };
                        }
                    } catch (error) {
                        console.error(`Error generating preset ${key}:`, error);
                    }

                    // Small delay between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    presets
                }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private getPresetPrompts(gameType: string, audioStyle: string): Record<string, string> {
        const stylePrefix = {
            'retro': 'Retro 8-bit style',
            'modern': 'Modern realistic',
            'fantasy': 'Fantasy magical',
            'scifi': 'Sci-fi futuristic'
        }[audioStyle] || 'Retro 8-bit style';

        const presets: Record<string, Record<string, string>> = {
            platformer: {
                jump: `${stylePrefix} jump sound with ascending pitch`,
                coin: `${stylePrefix} coin collection chime`,
                powerup: `${stylePrefix} power-up sound with energy boost`,
                death: `${stylePrefix} game over defeat sound`
            },
            shooter: {
                laser: `${stylePrefix} laser gun firing sound`,
                explosion: `${stylePrefix} explosion with impact`,
                reload: `${stylePrefix} weapon reload mechanical sound`,
                shield: `${stylePrefix} energy shield activation`
            },
            puzzle: {
                click: `${stylePrefix} puzzle piece placement click`,
                success: `${stylePrefix} level complete success chime`,
                wrong: `${stylePrefix} incorrect move buzzer`,
                hint: `${stylePrefix} helpful hint notification`
            },
            rpg: {
                sword: `${stylePrefix} sword clash with metal ring`,
                magic: `${stylePrefix} magic spell casting whoosh`,
                treasure: `${stylePrefix} treasure chest opening creak`,
                levelup: `${stylePrefix} character level up fanfare`
            },
            racing: {
                engine: `${stylePrefix} race car engine revving`,
                drift: `${stylePrefix} tire screeching drift sound`,
                crash: `${stylePrefix} vehicle collision impact`,
                finish: `${stylePrefix} race finish line victory`
            }
        };

        return presets[gameType] || presets.platformer;
    }

    private serveAsset(res: http.ServerResponse, url: string, workspaceRoot: string): void {
        try {
            const assetPath = path.join(workspaceRoot, url.replace(/^\//, ''));
            if (fs.existsSync(assetPath)) {
                const ext = path.extname(assetPath).toLowerCase();
                let contentType = 'application/octet-stream';
                
                switch (ext) {
                    case '.mp3': contentType = 'audio/mpeg'; break;
                    case '.wav': contentType = 'audio/wav'; break;
                    case '.ogg': contentType = 'audio/ogg'; break;
                    case '.json': contentType = 'application/json'; break;
                }

                const content = fs.readFileSync(assetPath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            } else {
                res.writeHead(404);
                res.end('Asset not found');
            }
        } catch (error) {
            res.writeHead(500);
            res.end('Error serving asset');
        }
    }
}