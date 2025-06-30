/**
 * ElevenLabs Audio Generation Service
 * Handles text-to-speech, sound effects, and voice generation for GameWeaver
 */

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface AudioGenerationOptions {
    duration?: number;
    promptInfluence?: number;
    outputFormat?: 'mp3' | 'wav';
}

export interface VoiceSettings {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
}

export interface TextToSpeechOptions {
    voiceId: string;
    modelId?: string;
    voiceSettings?: VoiceSettings;
    outputFormat?: string;
    languageCode?: string;
}

export interface VoiceDesignOptions {
    description: string;
    text?: string;
    gender?: 'male' | 'female' | 'neutral';
    age?: 'young' | 'middle_aged' | 'old';
    accent?: string;
}

export interface GeneratedAudio {
    audioBuffer: ArrayBuffer;
    filename: string;
    format: string;
    duration?: number;
    metadata?: any;
}

export interface ElevenLabsVoice {
    voice_id: string;
    name: string;
    samples?: any[];
    category: string;
    fine_tuning?: any;
    labels?: Record<string, string>;
    description?: string;
    preview_url?: string;
}

export class ElevenLabsService {
    private client: ElevenLabsClient | undefined;
    private outputPath: string;
    private isInitialized = false;

    constructor(private context: vscode.ExtensionContext) {
        this.outputPath = path.join(context.globalStorageUri?.fsPath || '', 'generated-audio');
    }

    /**
     * Initialize the ElevenLabs client with API key
     */
    async initialize(): Promise<boolean> {
        try {
            // Get API key from VS Code settings or prompt user
            let apiKey = vscode.workspace.getConfiguration('gameVibe').get<string>('elevenLabsApiKey');
            
            if (!apiKey) {
                apiKey = await this.promptForApiKey();
                if (!apiKey) {
                    vscode.window.showErrorMessage('ElevenLabs API key is required for audio generation features.');
                    return false;
                }
                
                // Save API key to settings
                await vscode.workspace.getConfiguration('gameVibe').update('elevenLabsApiKey', apiKey, vscode.ConfigurationTarget.Global);
            }

            this.client = new ElevenLabsClient({
                apiKey: apiKey
            });

            // Ensure output directory exists
            await this.ensureOutputDirectory();
            
            this.isInitialized = true;
            vscode.window.showInformationMessage('ElevenLabs service initialized successfully!');
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize ElevenLabs service: ${error}`);
            return false;
        }
    }

    /**
     * Check if service is ready for use
     */
    isReady(): boolean {
        return this.isInitialized && !!this.client;
    }

    /**
     * Generate text-to-speech audio
     */
    async generateSpeech(text: string, options: TextToSpeechOptions): Promise<GeneratedAudio | null> {
        if (!this.isReady()) {
            await this.initialize();
            if (!this.isReady()) return null;
        }

        try {
            const audioStream = await this.client!.textToSpeech.convert(options.voiceId, {
                text: text,
                modelId: options.modelId || 'eleven_multilingual_v2',
                voiceSettings: options.voiceSettings,
                outputFormat: (options.outputFormat || 'mp3_44100_128') as any,
                languageCode: options.languageCode
            });

            const audioBuffer = await this.streamToBuffer(audioStream);
            const filename = `speech_${Date.now()}.${options.outputFormat || 'mp3'}`;
            const filePath = path.join(this.outputPath, filename);
            
            await fs.writeFile(filePath, Buffer.from(audioBuffer));

            return {
                audioBuffer,
                filename,
                format: options.outputFormat || 'mp3',
                metadata: {
                    text,
                    voiceId: options.voiceId,
                    modelId: options.modelId,
                    generatedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate speech: ${error}`);
            return null;
        }
    }

    /**
     * Generate sound effects from text prompt
     */
    async generateSoundEffect(prompt: string, options: AudioGenerationOptions = {}): Promise<GeneratedAudio | null> {
        if (!this.isReady()) {
            await this.initialize();
            if (!this.isReady()) return null;
        }

        try {
            const audioStream = await this.client!.textToSoundEffects.convert({
                text: prompt,
                durationSeconds: options.duration,
                promptInfluence: options.promptInfluence
            });

            const audioBuffer = await this.streamToBuffer(audioStream);
            const filename = `sfx_${Date.now()}.mp3`;
            const filePath = path.join(this.outputPath, filename);
            
            await fs.writeFile(filePath, Buffer.from(audioBuffer));

            return {
                audioBuffer,
                filename,
                format: 'mp3',
                duration: options.duration,
                metadata: {
                    prompt,
                    type: 'sound_effect',
                    generatedAt: new Date().toISOString(),
                    duration: options.duration,
                    promptInfluence: options.promptInfluence
                }
            };
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate sound effect: ${error}`);
            return null;
        }
    }

    /**
     * Design a custom voice from description
     */
    async designVoice(options: VoiceDesignOptions): Promise<ElevenLabsVoice[] | null> {
        if (!this.isReady()) {
            await this.initialize();
            if (!this.isReady()) return null;
        }

        try {
            const response = await this.client!.textToVoice.design({
                text: options.text || "Hello, this is a voice preview for your game character.",
                voiceDescription: options.description
            });

            return (response.previews || []) as unknown as ElevenLabsVoice[];
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to design voice: ${error}`);
            return null;
        }
    }

    /**
     * Create and save a voice from design
     */
    async createVoiceFromDesign(voiceId: string, name: string, description?: string): Promise<ElevenLabsVoice | null> {
        if (!this.isReady()) {
            await this.initialize();
            if (!this.isReady()) return null;
        }

        try {
            const voice = await this.client!.textToVoice.create({
                name: name,
                description: description,
                voiceId: voiceId
            } as any);

            vscode.window.showInformationMessage(`Voice "${name}" created successfully!`);
            return voice as unknown as ElevenLabsVoice;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create voice: ${error}`);
            return null;
        }
    }

    /**
     * Get available voices
     */
    async getVoices(): Promise<ElevenLabsVoice[]> {
        if (!this.isReady()) {
            await this.initialize();
            if (!this.isReady()) return [];
        }

        try {
            const response = await this.client!.voices.search({
                includeTotalCount: true,
                pageSize: 100
            });

            return (response.voices || []) as unknown as ElevenLabsVoice[];
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch voices: ${error}`);
            return [];
        }
    }

    /**
     * Get available models
     */
    async getModels(): Promise<any[]> {
        if (!this.isReady()) {
            await this.initialize();
            if (!this.isReady()) return [];
        }

        try {
            const models = await this.client!.models.list();
            return models || [];
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch models: ${error}`);
            return [];
        }
    }

    /**
     * Get user subscription info and usage
     */
    async getUsageInfo(): Promise<any> {
        if (!this.isReady()) {
            await this.initialize();
            if (!this.isReady()) return null;
        }

        try {
            const subscription = this.client!.user.subscription;
            return subscription;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch usage info: ${error}`);
            return null;
        }
    }

    /**
     * Save generated audio to game assets
     */
    async saveToGameAssets(audio: GeneratedAudio, assetPath: string): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return false;
            }

            const assetsDir = path.join(workspaceFolder.uri.fsPath, 'assets', 'audio');
            await fs.mkdir(assetsDir, { recursive: true });

            const finalPath = path.join(assetsDir, assetPath);
            await fs.writeFile(finalPath, Buffer.from(audio.audioBuffer));

            // Create metadata file
            const metadataPath = finalPath.replace(/\.[^/.]+$/, '.meta.json');
            await fs.writeFile(metadataPath, JSON.stringify(audio.metadata, null, 2));

            vscode.window.showInformationMessage(`Audio saved to ${path.relative(workspaceFolder.uri.fsPath, finalPath)}`);
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save audio to assets: ${error}`);
            return false;
        }
    }

    /**
     * Generate game-specific audio presets
     */
    async generateGameAudioPresets(gameType: string): Promise<{ [key: string]: GeneratedAudio } | null> {
        const presets: { [key: string]: GeneratedAudio } = {};

        try {
            // Define sound effects based on game type
            const soundEffectsMap: { [key: string]: string[] } = {
                platformer: [
                    'Retro 8-bit jump sound',
                    'Coin collect chime',
                    'Enemy defeat thud',
                    'Level complete fanfare'
                ],
                shooter: [
                    'Laser gun firing',
                    'Explosion impact',
                    'Shield recharge hum',
                    'Enemy destroyed blast'
                ],
                puzzle: [
                    'Puzzle piece click',
                    'Success chime',
                    'Wrong move buzz',
                    'Level complete bells'
                ],
                rpg: [
                    'Sword clash metal',
                    'Magic spell cast',
                    'Treasure chest open',
                    'Level up fanfare'
                ]
            };

            const effects = soundEffectsMap[gameType] || soundEffectsMap.platformer;

            for (const [index, prompt] of effects.entries()) {
                const audio = await this.generateSoundEffect(prompt, { duration: 2 });
                if (audio) {
                    presets[`effect_${index + 1}`] = audio;
                }
            }

            return presets;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate game audio presets: ${error}`);
            return null;
        }
    }

    // Helper methods

    private async promptForApiKey(): Promise<string | undefined> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your ElevenLabs API key',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'API key cannot be empty';
                }
                return null;
            }
        });

        return apiKey?.trim();
    }

    private async ensureOutputDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.outputPath, { recursive: true });
        } catch (error) {
            // Directory might already exist, ignore error
        }
    }

    private async streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
            }
        } finally {
            reader.releaseLock();
        }

        // Combine chunks into single ArrayBuffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    }

    /**
     * Cleanup resources
     */
    dispose(): void {
        // Cleanup if needed
        this.isInitialized = false;
    }
}