/**
 * Music Editor Provider for GameWeaver
 * Provides AI-powered audio generation using ElevenLabs for games
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ElevenLabsService } from '../services/ElevenLabsService';
import { MusicEditorServer } from '../server/MusicEditorServer';

export class MusicEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new MusicEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            'gameVibe.musicEditor',
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        );
        return providerRegistration;
    }

    private elevenLabsService: ElevenLabsService;
    private musicEditorServer: MusicEditorServer | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.elevenLabsService = new ElevenLabsService(context);
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup webview options
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
                ...(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(folder => folder.uri) : [])
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Initialize ElevenLabs service
        await this.elevenLabsService.initialize();

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'generateSpeech':
                        await this.handleGenerateSpeech(webviewPanel, message);
                        break;
                    case 'generateSoundEffect':
                        await this.handleGenerateSoundEffect(webviewPanel, message);
                        break;
                    case 'designVoice':
                        await this.handleDesignVoice(webviewPanel, message);
                        break;
                    case 'createVoice':
                        await this.handleCreateVoice(webviewPanel, message);
                        break;
                    case 'loadVoices':
                        await this.handleLoadVoices(webviewPanel);
                        break;
                    case 'loadModels':
                        await this.handleLoadModels(webviewPanel);
                        break;
                    case 'saveAudioToAssets':
                        await this.handleSaveAudioToAssets(message);
                        break;
                    case 'generateGamePresets':
                        await this.handleGenerateGamePresets(webviewPanel, message);
                        break;
                    case 'previewAudio':
                        await this.handlePreviewAudio(webviewPanel, message);
                        break;
                    case 'getUsageInfo':
                        await this.handleGetUsageInfo(webviewPanel);
                        break;
                    case 'ready':
                        await this.handleWebviewReady(webviewPanel);
                        break;
                    case 'runInBrowser':
                        await this.runInBrowser(message.audioData || '');
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Watch for changes to the document
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                this.updateWebview(webviewPanel, document);
            }
        });
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        this.updateWebview(webviewPanel, document);
    }

    private async handleGenerateSpeech(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            const { text, voiceId, modelId, voiceSettings, outputFormat, languageCode } = message;
            
            webviewPanel.webview.postMessage({
                command: 'generationStarted',
                type: 'speech'
            });

            const audio = await this.elevenLabsService.generateSpeech(text, {
                voiceId,
                modelId,
                voiceSettings,
                outputFormat,
                languageCode
            });

            if (audio) {
                // Convert audio buffer to base64 for webview
                const base64Audio = Buffer.from(audio.audioBuffer).toString('base64');
                
                webviewPanel.webview.postMessage({
                    command: 'speechGenerated',
                    audio: {
                        ...audio,
                        audioData: base64Audio
                    }
                });
            } else {
                webviewPanel.webview.postMessage({
                    command: 'generationError',
                    error: 'Failed to generate speech'
                });
            }
        } catch (error) {
            webviewPanel.webview.postMessage({
                command: 'generationError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleGenerateSoundEffect(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            const { prompt, duration, promptInfluence } = message;
            
            webviewPanel.webview.postMessage({
                command: 'generationStarted',
                type: 'soundEffect'
            });

            const audio = await this.elevenLabsService.generateSoundEffect(prompt, {
                duration,
                promptInfluence
            });

            if (audio) {
                const base64Audio = Buffer.from(audio.audioBuffer).toString('base64');
                
                webviewPanel.webview.postMessage({
                    command: 'soundEffectGenerated',
                    audio: {
                        ...audio,
                        audioData: base64Audio
                    }
                });
            } else {
                webviewPanel.webview.postMessage({
                    command: 'generationError',
                    error: 'Failed to generate sound effect'
                });
            }
        } catch (error) {
            webviewPanel.webview.postMessage({
                command: 'generationError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleDesignVoice(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            const { description, text, gender, age, accent } = message;
            
            webviewPanel.webview.postMessage({
                command: 'generationStarted',
                type: 'voiceDesign'
            });

            const voices = await this.elevenLabsService.designVoice({
                description,
                text,
                gender,
                age,
                accent
            });

            webviewPanel.webview.postMessage({
                command: 'voicesDesigned',
                voices: voices || []
            });
        } catch (error) {
            webviewPanel.webview.postMessage({
                command: 'generationError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleCreateVoice(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            const { voiceId, name, description } = message;
            
            const voice = await this.elevenLabsService.createVoiceFromDesign(voiceId, name, description);

            webviewPanel.webview.postMessage({
                command: 'voiceCreated',
                voice: voice
            });
            
            // Refresh voices list
            await this.handleLoadVoices(webviewPanel);
        } catch (error) {
            webviewPanel.webview.postMessage({
                command: 'generationError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleLoadVoices(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const voices = await this.elevenLabsService.getVoices();
            
            webviewPanel.webview.postMessage({
                command: 'voicesLoaded',
                voices: voices
            });
        } catch (error) {
            webviewPanel.webview.postMessage({
                command: 'loadError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleLoadModels(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const models = await this.elevenLabsService.getModels();
            
            webviewPanel.webview.postMessage({
                command: 'modelsLoaded',
                models: models
            });
        } catch (error) {
            webviewPanel.webview.postMessage({
                command: 'loadError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleSaveAudioToAssets(message: any): Promise<void> {
        try {
            const { audio, filename } = message;
            
            // Convert base64 back to ArrayBuffer
            const audioBuffer = Uint8Array.from(atob(audio.audioData), c => c.charCodeAt(0)).buffer;
            
            const audioWithBuffer = {
                ...audio,
                audioBuffer: audioBuffer
            };

            await this.elevenLabsService.saveToGameAssets(audioWithBuffer, filename);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save audio: ${error}`);
        }
    }

    private async handleGenerateGamePresets(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            const { gameType } = message;
            
            webviewPanel.webview.postMessage({
                command: 'generationStarted',
                type: 'gamePresets'
            });

            const presets = await this.elevenLabsService.generateGameAudioPresets(gameType);

            if (presets) {
                // Convert audio buffers to base64
                const presetsWithBase64: any = {};
                for (const [key, audio] of Object.entries(presets)) {
                    const base64Audio = Buffer.from(audio.audioBuffer).toString('base64');
                    presetsWithBase64[key] = {
                        ...audio,
                        audioData: base64Audio
                    };
                }

                webviewPanel.webview.postMessage({
                    command: 'gamePresetsGenerated',
                    presets: presetsWithBase64
                });
            } else {
                webviewPanel.webview.postMessage({
                    command: 'generationError',
                    error: 'Failed to generate game presets'
                });
            }
        } catch (error) {
            webviewPanel.webview.postMessage({
                command: 'generationError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handlePreviewAudio(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        // Audio preview is handled client-side in the webview
        // This could be extended for server-side preview features
    }

    private async handleGetUsageInfo(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const usageInfo = await this.elevenLabsService.getUsageInfo();
            
            webviewPanel.webview.postMessage({
                command: 'usageInfoLoaded',
                usageInfo: usageInfo
            });
        } catch (error) {
            webviewPanel.webview.postMessage({
                command: 'loadError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async handleWebviewReady(webviewPanel: vscode.WebviewPanel): Promise<void> {
        // Initialize the webview with current data
        await this.handleLoadVoices(webviewPanel);
        await this.handleLoadModels(webviewPanel);
        await this.handleGetUsageInfo(webviewPanel);
    }

    private async runInBrowser(audioData: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            // Stop existing server if running
            if (this.musicEditorServer) {
                this.musicEditorServer.stop();
            }

            // Create and start new server
            this.musicEditorServer = new MusicEditorServer();
            const url = await this.musicEditorServer.start(audioData, workspaceFolder.uri.fsPath);

            // Open browser
            vscode.env.openExternal(vscode.Uri.parse(url));
            vscode.window.showInformationMessage(`🎵 Music Editor opened in browser: ${url}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run Music Editor in browser: ${error}`);
        }
    }

    private updateWebview(webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument): void {
        webviewPanel.webview.postMessage({
            command: 'updateDocument',
            text: document.getText()
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'music-editor.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'music-editor.js'));

        // Use a nonce to whitelist which scripts can be run
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleResetUri}" rel="stylesheet">
            <link href="${styleVSCodeUri}" rel="stylesheet">
            <link href="${styleMainUri}" rel="stylesheet">
            <title>GameWeaver Music Editor</title>
        </head>
        <body>
            <div class="music-editor">
                <header class="editor-header">
                    <h1>🎵 GameWeaver Music Editor</h1>
                    <div style="display: flex; gap: 20px; align-items: center;">
                        <div class="editor-tabs">
                            <button class="tab-button active" data-tab="sound-effects">Sound Effects</button>
                            <button class="tab-button" data-tab="voice-generation">Voice Generation</button>
                            <button class="tab-button" data-tab="voice-design">Voice Design</button>
                            <button class="tab-button" data-tab="game-presets">Game Presets</button>
                            <button class="tab-button" data-tab="usage-stats">Usage Stats</button>
                        </div>
                        <button id="browser-btn" style="background: #007acc; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;" title="Run in Browser">
                            🌐 Browser Mode
                        </button>
                    </div>
                </header>

                <main class="editor-content">
                    <!-- Sound Effects Tab -->
                    <section id="sound-effects" class="tab-content active">
                        <div class="generation-panel">
                            <h3>Generate Sound Effects</h3>
                            <div class="form-group">
                                <label for="sfx-prompt">Sound Effect Description:</label>
                                <textarea id="sfx-prompt" placeholder="Describe the sound effect... (e.g., 'Laser gun firing', 'Coin collect chime', 'Explosion impact')"></textarea>
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
                                <textarea id="tts-text" placeholder="Enter the text you want to convert to speech..."></textarea>
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
                                <textarea id="voice-description" placeholder="Describe the voice... (e.g., 'A wise old wizard with a deep, resonant voice')"></textarea>
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

                <!-- Loading overlay -->
                <div id="loading-overlay" class="loading-overlay hidden">
                    <div class="spinner"></div>
                    <p>Generating audio...</p>
                </div>
            </div>

            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}