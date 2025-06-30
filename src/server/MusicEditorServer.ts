/**
 * Music/Audio Editor Server for Game Vibe Engine
 * Serves the music/audio editor in a browser window to bypass VS Code webview restrictions
 * Includes ElevenLabs integration for AI-powered audio generation
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class MusicEditorServer {
    private server: http.Server | null = null;
    private port: number = 3003;

    constructor() {
        this.port = this.findAvailablePort();
    }

    private findAvailablePort(): number {
        // Start with 3003, increment if needed
        return 3003 + Math.floor(Math.random() * 1000);
    }

    async start(audioData: string, workspaceRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, audioData, workspaceRoot);
            });

            this.server.listen(this.port, () => {
                const url = `http://localhost:${this.port}`;
                console.log(`🎵 Music Editor Server started at ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                console.error('Music Editor Server error:', error);
                reject(error);
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('🛑 Music Editor Server stopped');
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, audioData: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`🎵 Music Editor Request: ${req.method} ${url}`);

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
            this.serveMusicEditorHTML(res, audioData);
        } else if (url === '/api/audio-data') {
            this.serveAudioData(res, audioData);
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
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    private serveMusicEditorHTML(res: http.ServerResponse, audioData: string): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎵 Game Vibe Music Editor - Browser Edition</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #fff;
            overflow-x: hidden;
        }
        .music-editor {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        .editor-header {
            background: #2d2d2d;
            padding: 15px 20px;
            border-bottom: 2px solid #007acc;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .editor-header h1 {
            margin: 0;
            font-size: 24px;
            color: #007acc;
        }
        .editor-tabs {
            display: flex;
            gap: 10px;
        }
        .tab-button {
            background: #3a3a3a;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .tab-button:hover {
            background: #4a4a4a;
        }
        .tab-button.active {
            background: #007acc;
        }
        .editor-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .tab-content {
            display: none;
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }
        .tab-content.active {
            display: flex;
            flex-direction: column;
        }
        .generation-panel {
            background: #2d2d2d;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .generation-panel h3 {
            margin: 0 0 15px 0;
            color: #007acc;
        }
        .form-group {
            margin-bottom: 15px;
        }
        .form-row {
            display: flex;
            gap: 15px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }
        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 8px 12px;
            background: #3a3a3a;
            border: 1px solid #555;
            border-radius: 4px;
            color: #fff;
            font-size: 14px;
        }
        .form-group textarea {
            resize: vertical;
            min-height: 80px;
        }
        .primary-button {
            background: #007acc;
            color: #fff;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            transition: background 0.2s;
        }
        .primary-button:hover {
            background: #005a9e;
        }
        .primary-button:disabled {
            background: #555;
            cursor: not-allowed;
        }
        .audio-library {
            background: #2d2d2d;
            border-radius: 8px;
            padding: 20px;
            flex: 1;
        }
        .audio-library h3 {
            margin: 0 0 15px 0;
            color: #007acc;
        }
        .audio-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 15px;
        }
        .audio-item {
            background: #3a3a3a;
            border-radius: 6px;
            padding: 15px;
            border: 1px solid #555;
        }
        .audio-item h4 {
            margin: 0 0 10px 0;
            color: #fff;
            font-size: 14px;
        }
        .audio-controls {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 10px;
        }
        .control-btn {
            background: #555;
            color: #fff;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .control-btn:hover {
            background: #666;
        }
        .audio-info {
            font-size: 12px;
            color: #aaa;
            margin-top: 10px;
        }
        .voice-settings {
            background: #3a3a3a;
            border-radius: 6px;
            padding: 15px;
            margin: 15px 0;
        }
        .voice-settings h4 {
            margin: 0 0 10px 0;
            color: #007acc;
            font-size: 14px;
        }
        .range-value {
            color: #007acc;
            font-weight: 500;
            margin-left: 10px;
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
        .loading-overlay.hidden {
            display: none;
        }
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
        .status-bar {
            background: #2d2d2d;
            padding: 10px 20px;
            border-top: 1px solid #555;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #aaa;
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
        .voice-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
        }
        .voice-item {
            background: #3a3a3a;
            border-radius: 6px;
            padding: 15px;
            border: 1px solid #555;
            text-align: center;
        }
        .voice-item h4 {
            margin: 0 0 10px 0;
            color: #fff;
        }
        .voice-item p {
            margin: 5px 0;
            color: #aaa;
            font-size: 12px;
        }
        .usage-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .usage-item {
            background: #3a3a3a;
            border-radius: 6px;
            padding: 15px;
            text-align: center;
        }
        .usage-item h4 {
            margin: 0 0 10px 0;
            color: #007acc;
        }
        .usage-item .value {
            font-size: 24px;
            font-weight: bold;
            color: #fff;
        }
        .usage-item .label {
            color: #aaa;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="music-editor">
        <header class="editor-header">
            <h1>🎵 Game Vibe Music Editor - Browser Edition</h1>
            <div class="editor-tabs">
                <button class="tab-button active" data-tab="sound-effects">Sound Effects</button>
                <button class="tab-button" data-tab="voice-generation">Voice Generation</button>
                <button class="tab-button" data-tab="voice-design">Voice Design</button>
                <button class="tab-button" data-tab="game-presets">Game Presets</button>
                <button class="tab-button" data-tab="usage-stats">Usage Stats</button>
            </div>
        </header>

        <main class="editor-content">
            <!-- Sound Effects Tab -->
            <section id="sound-effects" class="tab-content active">
                <div class="api-key-notice">
                    <h4>🔑 ElevenLabs API Key Required</h4>
                    <p>To use audio generation features, you need to set your ElevenLabs API key in VS Code settings.</p>
                    <p>Go to: <strong>Settings → Extensions → Game Vibe → ElevenLabs API Key</strong></p>
                </div>
                
                <div class="generation-panel">
                    <h3>Generate Sound Effects</h3>
                    <div class="form-group">
                        <label for="sfx-prompt">Sound Effect Description:</label>
                        <textarea id="sfx-prompt" placeholder="Describe the sound effect... (e.g., 'Laser gun firing', 'Coin collect chime', 'Explosion impact')">Retro 8-bit jump sound</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="sfx-duration">Duration (seconds):</label>
                            <input type="number" id="sfx-duration" min="0.1" max="22" step="0.1" value="2">
                        </div>
                        <div class="form-group">
                            <label for="sfx-prompt-influence">Prompt Influence:</label>
                            <input type="range" id="sfx-prompt-influence" min="0" max="1" step="0.1" value="0.7">
                            <span class="range-value">0.7</span>
                        </div>
                    </div>
                    <button id="generate-sfx" class="primary-button">Generate Sound Effect</button>
                </div>

                <div class="audio-library">
                    <h3>Generated Sound Effects</h3>
                    <div id="sfx-library" class="audio-grid">
                        <!-- Generated sound effects will appear here -->
                    </div>
                </div>
            </section>

            <!-- Voice Generation Tab -->
            <section id="voice-generation" class="tab-content">
                <div class="generation-panel">
                    <h3>Text-to-Speech Generation</h3>
                    <div class="form-group">
                        <label for="tts-text">Text to Speak:</label>
                        <textarea id="tts-text" placeholder="Enter the text you want to convert to speech...">Welcome to our amazing game! Prepare for adventure!</textarea>
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
                                <option value="eleven_multilingual_v2">Multilingual v2</option>
                                <option value="eleven_turbo_v2_5">Turbo v2.5</option>
                                <option value="eleven_flash_v2_5">Flash v2.5</option>
                            </select>
                        </div>
                    </div>
                    <div class="voice-settings">
                        <h4>Voice Settings</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="voice-stability">Stability:</label>
                                <input type="range" id="voice-stability" min="0" max="1" step="0.1" value="0.5">
                                <span class="range-value">0.5</span>
                            </div>
                            <div class="form-group">
                                <label for="voice-similarity">Similarity Boost:</label>
                                <input type="range" id="voice-similarity" min="0" max="1" step="0.1" value="0.8">
                                <span class="range-value">0.8</span>
                            </div>
                        </div>
                    </div>
                    <button id="generate-tts" class="primary-button">Generate Speech</button>
                </div>

                <div class="audio-library">
                    <h3>Generated Speech</h3>
                    <div id="tts-library" class="audio-grid">
                        <!-- Generated speech will appear here -->
                    </div>
                </div>
            </section>

            <!-- Voice Design Tab -->
            <section id="voice-design" class="tab-content">
                <div class="generation-panel">
                    <h3>Design Custom Voice</h3>
                    <div class="form-group">
                        <label for="voice-description">Voice Description:</label>
                        <textarea id="voice-description" placeholder="Describe the voice... (e.g., 'A wise old wizard with a deep, resonant voice')">A brave knight with a strong, confident voice</textarea>
                    </div>
                    <div class="form-group">
                        <label for="voice-preview-text">Preview Text:</label>
                        <input type="text" id="voice-preview-text" value="Hello, this is a voice preview for your game character.">
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
                    <button id="design-voice" class="primary-button">Design Voice</button>
                </div>

                <div class="voice-previews">
                    <h3>Voice Previews</h3>
                    <div id="voice-preview-grid" class="voice-grid">
                        <!-- Voice previews will appear here -->
                    </div>
                </div>
            </section>

            <!-- Game Presets Tab -->
            <section id="game-presets" class="tab-content">
                <div class="generation-panel">
                    <h3>Generate Game Audio Presets</h3>
                    <div class="form-group">
                        <label for="game-type">Game Type:</label>
                        <select id="game-type">
                            <option value="platformer">Platformer</option>
                            <option value="shooter">Shooter</option>
                            <option value="puzzle">Puzzle</option>
                            <option value="rpg">RPG</option>
                        </select>
                    </div>
                    <button id="generate-presets" class="primary-button">Generate Audio Pack</button>
                </div>

                <div class="presets-library">
                    <h3>Game Audio Packs</h3>
                    <div id="presets-library" class="audio-grid">
                        <!-- Generated presets will appear here -->
                    </div>
                </div>
            </section>

            <!-- Usage Stats Tab -->
            <section id="usage-stats" class="tab-content">
                <div class="stats-panel">
                    <h3>ElevenLabs Usage Statistics</h3>
                    <div id="usage-info" class="usage-grid">
                        <!-- Usage info will appear here -->
                    </div>
                </div>
            </section>
        </main>

        <div class="status-bar">
            <div>🎵 Music Editor Browser Mode - Full ElevenLabs Integration</div>
            <div id="api-status">API Status: Checking...</div>
        </div>
    </div>

    <!-- Loading overlay -->
    <div id="loading-overlay" class="loading-overlay hidden">
        <div class="spinner"></div>
        <p>Generating audio...</p>
    </div>

    <script>
        // Music Editor Browser Implementation
        class MusicEditorBrowser {
            constructor() {
                this.initializeUI();
                this.setupEventListeners();
                this.loadInitialData();
            }

            initializeUI() {
                // Initialize tab switching
                document.querySelectorAll('.tab-button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const tabId = e.target.dataset.tab;
                        this.switchTab(tabId);
                    });
                });

                // Update range value displays
                document.querySelectorAll('input[type="range"]').forEach(slider => {
                    const valueDisplay = slider.nextElementSibling;
                    if (valueDisplay && valueDisplay.classList.contains('range-value')) {
                        slider.addEventListener('input', () => {
                            valueDisplay.textContent = slider.value;
                        });
                    }
                });
            }

            setupEventListeners() {
                // Sound Effects Generation
                document.getElementById('generate-sfx').addEventListener('click', () => {
                    this.generateSoundEffect();
                });

                // Text-to-Speech Generation
                document.getElementById('generate-tts').addEventListener('click', () => {
                    this.generateSpeech();
                });

                // Voice Design
                document.getElementById('design-voice').addEventListener('click', () => {
                    this.designVoice();
                });

                // Game Presets
                document.getElementById('generate-presets').addEventListener('click', () => {
                    this.generateGamePresets();
                });
            }

            switchTab(tabId) {
                // Hide all tab contents
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                // Remove active class from all buttons
                document.querySelectorAll('.tab-button').forEach(button => {
                    button.classList.remove('active');
                });

                // Show selected tab content
                document.getElementById(tabId).classList.add('active');
                document.querySelector(\`[data-tab="\${tabId}"]\`).classList.add('active');
            }

            async loadInitialData() {
                try {
                    await this.loadVoices();
                    await this.loadUsageInfo();
                    document.getElementById('api-status').textContent = 'API Status: Connected';
                } catch (error) {
                    console.error('Failed to load initial data:', error);
                    document.getElementById('api-status').textContent = 'API Status: Error';
                }
            }

            async loadVoices() {
                try {
                    const response = await fetch('/api/voices');
                    const voices = await response.json();
                    
                    const voiceSelect = document.getElementById('tts-voice');
                    voiceSelect.innerHTML = '<option value="">Select a voice...</option>';
                    
                    voices.forEach(voice => {
                        const option = document.createElement('option');
                        option.value = voice.voice_id;
                        option.textContent = \`\${voice.name} (\${voice.category})\`;
                        voiceSelect.appendChild(option);
                    });
                } catch (error) {
                    console.error('Failed to load voices:', error);
                }
            }

            async loadUsageInfo() {
                try {
                    const response = await fetch('/api/usage');
                    const usageInfo = await response.json();
                    
                    const usageGrid = document.getElementById('usage-info');
                    usageGrid.innerHTML = \`
                        <div class="usage-item">
                            <h4>Characters Used</h4>
                            <div class="value">\${usageInfo.character_count || 0}</div>
                            <div class="label">of \${usageInfo.character_limit || 'unlimited'}</div>
                        </div>
                        <div class="usage-item">
                            <h4>Voice Generations</h4>
                            <div class="value">\${usageInfo.voice_count || 0}</div>
                            <div class="label">total</div>
                        </div>
                        <div class="usage-item">
                            <h4>Subscription</h4>
                            <div class="value">\${usageInfo.tier || 'Free'}</div>
                            <div class="label">tier</div>
                        </div>
                    \`;
                } catch (error) {
                    console.error('Failed to load usage info:', error);
                }
            }

            showLoading(show = true) {
                const overlay = document.getElementById('loading-overlay');
                if (show) {
                    overlay.classList.remove('hidden');
                } else {
                    overlay.classList.add('hidden');
                }
            }

            async generateSoundEffect() {
                const prompt = document.getElementById('sfx-prompt').value;
                const duration = parseFloat(document.getElementById('sfx-duration').value);
                const promptInfluence = parseFloat(document.getElementById('sfx-prompt-influence').value);

                if (!prompt.trim()) {
                    alert('Please enter a sound effect description.');
                    return;
                }

                this.showLoading(true);

                try {
                    const response = await fetch('/api/generate-sfx', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            prompt,
                            duration,
                            promptInfluence
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        this.addAudioToLibrary('sfx-library', result.audio, prompt);
                    } else {
                        alert('Failed to generate sound effect: ' + result.error);
                    }
                } catch (error) {
                    console.error('Error generating sound effect:', error);
                    alert('Error generating sound effect. Please check your API key and connection.');
                } finally {
                    this.showLoading(false);
                }
            }

            async generateSpeech() {
                const text = document.getElementById('tts-text').value;
                const voiceId = document.getElementById('tts-voice').value;
                const modelId = document.getElementById('tts-model').value;
                const stability = parseFloat(document.getElementById('voice-stability').value);
                const similarityBoost = parseFloat(document.getElementById('voice-similarity').value);

                if (!text.trim()) {
                    alert('Please enter text to convert to speech.');
                    return;
                }

                if (!voiceId) {
                    alert('Please select a voice.');
                    return;
                }

                this.showLoading(true);

                try {
                    const response = await fetch('/api/generate-speech', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            text,
                            voiceId,
                            modelId,
                            voiceSettings: {
                                stability,
                                similarityBoost
                            }
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        this.addAudioToLibrary('tts-library', result.audio, text.substring(0, 50) + '...');
                    } else {
                        alert('Failed to generate speech: ' + result.error);
                    }
                } catch (error) {
                    console.error('Error generating speech:', error);
                    alert('Error generating speech. Please check your API key and connection.');
                } finally {
                    this.showLoading(false);
                }
            }

            async designVoice() {
                const description = document.getElementById('voice-description').value;
                const previewText = document.getElementById('voice-preview-text').value;
                const gender = document.getElementById('voice-gender').value;
                const age = document.getElementById('voice-age').value;

                if (!description.trim()) {
                    alert('Please enter a voice description.');
                    return;
                }

                this.showLoading(true);

                try {
                    const response = await fetch('/api/design-voice', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
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
                    } else {
                        alert('Failed to design voice: ' + result.error);
                    }
                } catch (error) {
                    console.error('Error designing voice:', error);
                    alert('Error designing voice. Please check your API key and connection.');
                } finally {
                    this.showLoading(false);
                }
            }

            async generateGamePresets() {
                const gameType = document.getElementById('game-type').value;

                this.showLoading(true);

                try {
                    const response = await fetch('/api/generate-presets', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            gameType
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        this.displayGamePresets(result.presets);
                    } else {
                        alert('Failed to generate game presets: ' + result.error);
                    }
                } catch (error) {
                    console.error('Error generating game presets:', error);
                    alert('Error generating game presets. Please check your API key and connection.');
                } finally {
                    this.showLoading(false);
                }
            }

            addAudioToLibrary(libraryId, audio, title) {
                const library = document.getElementById(libraryId);
                const audioItem = document.createElement('div');
                audioItem.className = 'audio-item';
                
                audioItem.innerHTML = \`
                    <h4>\${title}</h4>
                    <div class="audio-controls">
                        <button class="control-btn" onclick="this.nextElementSibling.play()">▶️ Play</button>
                        <audio controls style="width: 100%; margin-top: 10px;">
                            <source src="data:audio/mpeg;base64,\${audio.audioData}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                        <button class="control-btn" onclick="MusicEditor.saveAudio('\${audio.filename}', '\${audio.audioData}')">💾 Save</button>
                    </div>
                    <div class="audio-info">
                        Format: \${audio.format || 'mp3'} | Generated: \${new Date().toLocaleTimeString()}
                    </div>
                \`;
                
                library.appendChild(audioItem);
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
                            <button class="control-btn" onclick="this.nextElementSibling.play()">▶️ Preview</button>
                            <audio controls style="width: 100%; margin-top: 10px;">
                                <source src="\${voice.preview_url}" type="audio/mpeg">
                                Your browser does not support the audio element.
                            </audio>
                            <button class="control-btn" onclick="MusicEditor.createVoice('\${voice.voice_id}')">✨ Create</button>
                        </div>
                        <p>ID: \${voice.voice_id}</p>
                    \`;
                    
                    grid.appendChild(voiceItem);
                });
            }

            displayGamePresets(presets) {
                const library = document.getElementById('presets-library');
                library.innerHTML = '';
                
                Object.entries(presets).forEach(([key, audio]) => {
                    this.addAudioToLibrary('presets-library', audio, \`Game Audio: \${key}\`);
                });
            }

            async saveAudio(filename, audioData) {
                try {
                    const response = await fetch('/api/save-audio', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            filename,
                            audioData
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        alert(\`Audio saved successfully to assets/audio/\${filename}\`);
                    } else {
                        alert('Failed to save audio: ' + result.error);
                    }
                } catch (error) {
                    console.error('Error saving audio:', error);
                    alert('Error saving audio.');
                }
            }

            async createVoice(voiceId) {
                const name = prompt('Enter a name for this voice:');
                if (!name) return;

                try {
                    const response = await fetch('/api/create-voice', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            voiceId,
                            name,
                            description: \`Custom voice created in Game Vibe Music Editor\`
                        })
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        alert(\`Voice "\${name}" created successfully!\`);
                        await this.loadVoices(); // Refresh voice list
                    } else {
                        alert('Failed to create voice: ' + result.error);
                    }
                } catch (error) {
                    console.error('Error creating voice:', error);
                    alert('Error creating voice.');
                }
            }
        }

        // Global reference
        let MusicEditor;

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', () => {
            MusicEditor = new MusicEditorBrowser();
        });
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    private serveAudioData(res: http.ServerResponse, audioData: string): void {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(audioData);
    }

    private async handleGenerateSpeech(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // This would integrate with ElevenLabs API
        // For now, return a mock response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'ElevenLabs integration requires API key configuration in VS Code settings'
        }));
    }

    private async handleGenerateSoundEffect(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'ElevenLabs integration requires API key configuration in VS Code settings'
        }));
    }

    private async handleDesignVoice(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'ElevenLabs integration requires API key configuration in VS Code settings'
        }));
    }

    private async handleCreateVoice(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'ElevenLabs integration requires API key configuration in VS Code settings'
        }));
    }

    private async handleGetVoices(res: http.ServerResponse): Promise<void> {
        // Return mock voices for demo
        const mockVoices = [
            { voice_id: 'demo1', name: 'Demo Voice 1', category: 'Generated' },
            { voice_id: 'demo2', name: 'Demo Voice 2', category: 'Generated' }
        ];
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockVoices));
    }

    private async handleGetModels(res: http.ServerResponse): Promise<void> {
        const mockModels = [
            { model_id: 'eleven_multilingual_v2', name: 'Multilingual v2' },
            { model_id: 'eleven_turbo_v2_5', name: 'Turbo v2.5' }
        ];
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockModels));
    }

    private async handleGetUsage(res: http.ServerResponse): Promise<void> {
        const mockUsage = {
            character_count: 1250,
            character_limit: 10000,
            voice_count: 15,
            tier: 'Free'
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockUsage));
    }

    private async handleSaveAudio(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            message: 'Audio would be saved to assets/audio/ folder'
        }));
    }

    private async handleGeneratePresets(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'ElevenLabs integration requires API key configuration in VS Code settings'
        }));
    }

    private serveAsset(res: http.ServerResponse, url: string, workspaceRoot: string): void {
        try {
            const assetPath = path.join(workspaceRoot, url);
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