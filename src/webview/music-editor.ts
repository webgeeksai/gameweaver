/**
 * Music Editor Webview Script
 * Handles AI-powered audio generation interface for GameWeaver
 */

// VS Code API declaration for this module
declare const acquireVsCodeApi: () => any;

interface AudioItem {
    filename: string;
    format: string;
    audioData: string; // base64 encoded
    metadata: any;
    duration?: number;
}

interface VoiceItem {
    voice_id: string;
    name: string;
    category: string;
    description?: string;
    preview_url?: string;
}

interface ModelItem {
    model_id: string;
    name: string;
    description?: string;
    languages?: string[];
}

class MusicEditor {
    private vscode: any;
    private currentTab: string = 'sound-effects';
    private generatedAudio: Map<string, AudioItem> = new Map();
    private voices: VoiceItem[] = [];
    private models: ModelItem[] = [];
    private currentlyPlaying: HTMLAudioElement | null = null;

    constructor() {
        this.vscode = acquireVsCodeApi();
        this.initializeEventListeners();
        this.initializeUI();
        
        // Signal that webview is ready
        this.vscode.postMessage({ command: 'ready' });
    }

    private initializeEventListeners(): void {
        // Tab switching
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
            if (target.classList.contains('tab-button')) {
                this.switchTab(target.dataset.tab!);
            }
        });

        // Form submissions
        this.setupFormHandlers();
        
        // Range input updates
        this.setupRangeInputs();

        // Listen to messages from extension
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });
    }

    private initializeUI(): void {
        // Update tab states
        this.updateTabUI();
        
        // Setup initial form values
        this.setupInitialValues();
    }

    private switchTab(tabId: string): void {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        const selectedTab = document.getElementById(tabId);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Add active class to selected button
        const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }
        
        this.currentTab = tabId;
    }

    private updateTabUI(): void {
        this.switchTab(this.currentTab);
    }

    private setupFormHandlers(): void {
        // Sound effects generation
        const generateSfxButton = document.getElementById('generate-sfx');
        if (generateSfxButton) {
            generateSfxButton.addEventListener('click', () => {
                this.generateSoundEffect();
            });
        }

        // Text-to-speech generation
        const generateTtsButton = document.getElementById('generate-tts');
        if (generateTtsButton) {
            generateTtsButton.addEventListener('click', () => {
                this.generateSpeech();
            });
        }

        // Voice design
        const designVoiceButton = document.getElementById('design-voice');
        if (designVoiceButton) {
            designVoiceButton.addEventListener('click', () => {
                this.designVoice();
            });
        }

        // Game presets generation
        const generatePresetsButton = document.getElementById('generate-presets');
        if (generatePresetsButton) {
            generatePresetsButton.addEventListener('click', () => {
                this.generateGamePresets();
            });
        }
    }

    private setupRangeInputs(): void {
        document.querySelectorAll('input[type="range"]').forEach((element: Element) => {
            const input = element as HTMLInputElement;
            const updateValue = () => {
                const valueDisplay = input.parentElement?.querySelector('.range-value');
                if (valueDisplay) {
                    valueDisplay.textContent = input.value;
                }
            };
            
            input.addEventListener('input', updateValue);
            updateValue(); // Set initial value
        });
    }

    private setupInitialValues(): void {
        // Set default range values
        this.setInputValue('sfx-duration', '2');
        this.setInputValue('sfx-prompt-influence', '0.7');
        this.setInputValue('voice-stability', '0.5');
        this.setInputValue('voice-similarity', '0.8');
    }

    private setInputValue(id: string, value: string): void {
        const input = document.getElementById(id) as HTMLInputElement;
        if (input) {
            input.value = value;
            const event = new Event('input');
            input.dispatchEvent(event);
        }
    }

    private generateSoundEffect(): void {
        const prompt = (document.getElementById('sfx-prompt') as HTMLTextAreaElement)?.value;
        const duration = parseFloat((document.getElementById('sfx-duration') as HTMLInputElement)?.value || '2');
        const promptInfluence = parseFloat((document.getElementById('sfx-prompt-influence') as HTMLInputElement)?.value || '0.7');

        if (!prompt?.trim()) {
            this.showError('Please enter a sound effect description');
            return;
        }

        this.showLoading('Generating sound effect...');

        this.vscode.postMessage({
            command: 'generateSoundEffect',
            prompt: prompt.trim(),
            duration,
            promptInfluence
        });
    }

    private generateSpeech(): void {
        const text = (document.getElementById('tts-text') as HTMLTextAreaElement)?.value;
        const voiceId = (document.getElementById('tts-voice') as HTMLSelectElement)?.value;
        const modelId = (document.getElementById('tts-model') as HTMLSelectElement)?.value;
        const stability = parseFloat((document.getElementById('voice-stability') as HTMLInputElement)?.value || '0.5');
        const similarityBoost = parseFloat((document.getElementById('voice-similarity') as HTMLInputElement)?.value || '0.8');

        if (!text?.trim()) {
            this.showError('Please enter text to convert to speech');
            return;
        }

        if (!voiceId) {
            this.showError('Please select a voice');
            return;
        }

        this.showLoading('Generating speech...');

        this.vscode.postMessage({
            command: 'generateSpeech',
            text: text.trim(),
            voiceId,
            modelId,
            voiceSettings: {
                stability,
                similarityBoost
            }
        });
    }

    private designVoice(): void {
        const description = (document.getElementById('voice-description') as HTMLTextAreaElement)?.value;
        const text = (document.getElementById('voice-preview-text') as HTMLInputElement)?.value;
        const gender = (document.getElementById('voice-gender') as HTMLSelectElement)?.value;
        const age = (document.getElementById('voice-age') as HTMLSelectElement)?.value;

        if (!description?.trim()) {
            this.showError('Please enter a voice description');
            return;
        }

        this.showLoading('Designing voice...');

        this.vscode.postMessage({
            command: 'designVoice',
            description: description.trim(),
            text: text || 'Hello, this is a voice preview for your game character.',
            gender: gender || undefined,
            age: age || undefined
        });
    }

    private generateGamePresets(): void {
        const gameType = (document.getElementById('game-type') as HTMLSelectElement)?.value;

        if (!gameType) {
            this.showError('Please select a game type');
            return;
        }

        this.showLoading('Generating game audio pack...');

        this.vscode.postMessage({
            command: 'generateGamePresets',
            gameType
        });
    }

    private handleMessage(message: any): void {
        switch (message.command) {
            case 'voicesLoaded':
                this.loadVoices(message.voices);
                break;
            case 'modelsLoaded':
                this.loadModels(message.models);
                break;
            case 'speechGenerated':
                this.addGeneratedAudio('speech', message.audio);
                this.hideLoading();
                break;
            case 'soundEffectGenerated':
                this.addGeneratedAudio('soundEffect', message.audio);
                this.hideLoading();
                break;
            case 'voicesDesigned':
                this.showVoicePreviews(message.voices);
                this.hideLoading();
                break;
            case 'voiceCreated':
                this.showSuccess('Voice created successfully!');
                break;
            case 'gamePresetsGenerated':
                this.showGamePresets(message.presets);
                this.hideLoading();
                break;
            case 'usageInfoLoaded':
                this.updateUsageStats(message.usageInfo);
                break;
            case 'generationStarted':
                this.showLoading(`Generating ${message.type}...`);
                break;
            case 'generationError':
                this.showError(message.error);
                this.hideLoading();
                break;
            case 'loadError':
                this.showError(message.error);
                break;
        }
    }

    private loadVoices(voices: VoiceItem[]): void {
        this.voices = voices;
        const voiceSelect = document.getElementById('tts-voice') as HTMLSelectElement;
        
        if (voiceSelect) {
            voiceSelect.innerHTML = '<option value="">Select a voice...</option>';
            
            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voice_id;
                option.textContent = `${voice.name} (${voice.category})`;
                voiceSelect.appendChild(option);
            });
        }
    }

    private loadModels(models: ModelItem[]): void {
        this.models = models;
        const modelSelect = document.getElementById('tts-model') as HTMLSelectElement;
        
        if (modelSelect && models.length > 0) {
            modelSelect.innerHTML = '';
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.model_id;
                option.textContent = model.name || model.model_id;
                modelSelect.appendChild(option);
            });
        }
    }

    private addGeneratedAudio(type: 'speech' | 'soundEffect', audio: AudioItem): void {
        const libraryId = type === 'speech' ? 'tts-library' : 'sfx-library';
        const library = document.getElementById(libraryId);
        
        if (!library) return;

        // Store audio data
        const audioId = `${type}_${Date.now()}`;
        this.generatedAudio.set(audioId, audio);

        // Create audio item element
        const audioItem = this.createAudioItemElement(audioId, audio, type);
        library.appendChild(audioItem);

        // Remove empty state if it exists
        const emptyState = library.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
    }

    private createAudioItemElement(id: string, audio: AudioItem, type: string): HTMLElement {
        const div = document.createElement('div');
        div.className = 'audio-item';
        div.dataset.audioId = id;

        const title = audio.metadata?.prompt || audio.metadata?.text || audio.filename;
        const description = type === 'speech' 
            ? `Voice: ${audio.metadata?.voiceId || 'Unknown'}, Model: ${audio.metadata?.modelId || 'Unknown'}`
            : `Duration: ${audio.duration || 'Unknown'}s, Generated: ${new Date(audio.metadata?.generatedAt || Date.now()).toLocaleTimeString()}`;

        div.innerHTML = `
            <h4>${this.escapeHtml(title)}</h4>
            <p>${this.escapeHtml(description)}</p>
            <div class="audio-waveform"></div>
            <div class="audio-controls">
                <button class="play-button" data-action="play" data-audio-id="${id}">▶ Play</button>
                <button class="download-button" data-action="download" data-audio-id="${id}">↓ Download</button>
                <button class="save-button" data-action="save" data-audio-id="${id}">💾 Save to Assets</button>
            </div>
            <div class="audio-meta">
                Format: ${audio.format.toUpperCase()} | Size: ${this.formatFileSize(audio.audioData.length * 0.75)}
            </div>
        `;

        // Add event listeners to the buttons
        const playButton = div.querySelector('.play-button') as HTMLButtonElement;
        const downloadButton = div.querySelector('.download-button') as HTMLButtonElement;
        const saveButton = div.querySelector('.save-button') as HTMLButtonElement;

        if (playButton) {
            playButton.addEventListener('click', () => this.playAudio(id));
        }
        if (downloadButton) {
            downloadButton.addEventListener('click', () => this.downloadAudio(id));
        }
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveToAssets(id));
        }

        return div;
    }

    private showVoicePreviews(voices: any[]): void {
        const previewGrid = document.getElementById('voice-preview-grid');
        if (!previewGrid) return;

        previewGrid.innerHTML = '';

        voices.forEach((voice, index) => {
            const voiceItem = document.createElement('div');
            voiceItem.className = 'voice-preview-item';
            voiceItem.innerHTML = `
                <div class="voice-preview-info">
                    <h5>Voice Preview ${index + 1}</h5>
                    <p>Generated from description</p>
                </div>
                <div class="voice-preview-actions">
                    <button class="play-button" data-voice-id="${voice.voice_id}">▶ Preview</button>
                    <button class="create-voice-button" data-voice-id="${voice.voice_id}">Create Voice</button>
                </div>
            `;
            
            // Add event listeners
            const playButton = voiceItem.querySelector('.play-button') as HTMLButtonElement;
            const createButton = voiceItem.querySelector('.create-voice-button') as HTMLButtonElement;
            
            if (playButton) {
                playButton.addEventListener('click', () => this.playVoicePreview(voice.voice_id));
            }
            if (createButton) {
                createButton.addEventListener('click', () => this.createVoice(voice.voice_id));
            }
            
            previewGrid.appendChild(voiceItem);
        });
    }

    private showGamePresets(presets: any): void {
        const presetsLibrary = document.getElementById('presets-library');
        if (!presetsLibrary) return;

        presetsLibrary.innerHTML = '';

        Object.entries(presets).forEach(([key, audio]: [string, any]) => {
            const presetItem = this.createAudioItemElement(`preset_${key}`, audio, 'preset');
            presetsLibrary.appendChild(presetItem);
        });
    }

    private updateUsageStats(usageInfo: any): void {
        const usageGrid = document.getElementById('usage-info');
        if (!usageGrid || !usageInfo) return;

        const stats = [
            {
                title: 'Characters Used',
                value: usageInfo.character_count || 0,
                max: usageInfo.character_limit || 10000,
                unit: 'chars'
            },
            {
                title: 'Voice Clones',
                value: usageInfo.voice_count || 0,
                max: usageInfo.voice_limit || 10,
                unit: 'voices'
            },
            {
                title: 'API Calls',
                value: usageInfo.request_count || 0,
                max: usageInfo.request_limit || 1000,
                unit: 'requests'
            }
        ];

        usageGrid.innerHTML = stats.map(stat => {
            const percentage = Math.min((stat.value / stat.max) * 100, 100);
            return `
                <div class="usage-card">
                    <h4>${stat.title}</h4>
                    <div class="value">${stat.value.toLocaleString()}</div>
                    <div class="label">of ${stat.max.toLocaleString()} ${stat.unit}</div>
                    <div class="usage-progress">
                        <div class="usage-progress-bar" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    public playAudio(audioId: string): void {
        const audio = this.generatedAudio.get(audioId);
        if (!audio) return;

        // Stop currently playing audio
        if (this.currentlyPlaying) {
            this.currentlyPlaying.pause();
            this.currentlyPlaying = null;
        }

        try {
            // Create blob from base64 data
            const binaryString = atob(audio.audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: `audio/${audio.format}` });
            const audioUrl = URL.createObjectURL(blob);

            // Create and play audio element
            const audioElement = new Audio(audioUrl);
            audioElement.play();
            this.currentlyPlaying = audioElement;

            // Update button state
            const button = document.querySelector(`[data-audio-id="${audioId}"] .play-button`) as HTMLButtonElement;
            if (button) {
                button.textContent = '⏸ Playing...';
                audioElement.addEventListener('ended', () => {
                    button.textContent = '▶ Play';
                    URL.revokeObjectURL(audioUrl); // Clean up
                });
            }

            // Clean up URL if audio fails to load
            audioElement.addEventListener('error', () => {
                URL.revokeObjectURL(audioUrl);
                this.showError('Failed to play audio');
            });

        } catch (error) {
            console.error('Error playing audio:', error);
            this.showError('Failed to play audio: ' + (error as Error).message);
        }
    }

    public downloadAudio(audioId: string): void {
        const audio = this.generatedAudio.get(audioId);
        if (!audio) return;

        try {
            // Create blob from base64 data
            const binaryString = atob(audio.audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: `audio/${audio.format}` });
            const url = URL.createObjectURL(blob);

            // Create download link
            const link = document.createElement('a');
            link.href = url;
            link.download = audio.filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            this.showSuccess(`Downloaded ${audio.filename}`);
        } catch (error) {
            console.error('Error downloading audio:', error);
            this.showError('Failed to download audio: ' + (error as Error).message);
        }
    }

    public saveToAssets(audioId: string): void {
        const audio = this.generatedAudio.get(audioId);
        if (!audio) return;

        // Since prompt() is blocked, create a custom input dialog
        this.showFilenameDialog(audio.filename, (filename) => {
            if (filename && filename.trim()) {
                this.vscode.postMessage({
                    command: 'saveAudioToAssets',
                    audio,
                    filename: filename.trim()
                });
                this.showSuccess(`Saving ${filename} to assets...`);
            }
        });
    }

    public playVoicePreview(voiceId: string): void {
        // This would require the ElevenLabs API to provide preview URLs
        // For now, show a placeholder message
        this.showInfo('Voice preview playback coming soon!');
    }

    public createVoice(voiceId: string): void {
        // Create a custom dialog for voice creation
        this.showVoiceCreationDialog((name, description) => {
            if (name && name.trim()) {
                this.vscode.postMessage({
                    command: 'createVoice',
                    voiceId,
                    name: name.trim(),
                    description: description.trim()
                });
                this.showSuccess(`Creating voice "${name}"...`);
            }
        });
    }

    private showLoading(message: string): void {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.querySelector('p')!.textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    private hideLoading(): void {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    private showError(message: string): void {
        // For now, use alert. In a real implementation, use a proper toast system
        alert('Error: ' + message);
    }

    private showSuccess(message: string): void {
        // For now, use alert. In a real implementation, use a proper toast system
        alert('Success: ' + message);
    }

    private showInfo(message: string): void {
        // For now, use alert. In a real implementation, use a proper toast system
        alert('Info: ' + message);
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private showFilenameDialog(defaultName: string, callback: (filename: string) => void): void {
        // Create a simple modal dialog since prompt() is blocked
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-editor-foreground, #cccccc);
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 6px;
            padding: 20px;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">Save to Assets</h3>
            <label style="display: block; margin-bottom: 8px;">Filename:</label>
            <input type="text" id="filename-input" value="${defaultName}" style="
                width: 100%;
                padding: 8px;
                background: var(--vscode-input-background, #3c3c3c);
                color: var(--vscode-input-foreground, #cccccc);
                border: 1px solid var(--vscode-input-border, #3c3c3c);
                border-radius: 4px;
                margin-bottom: 15px;
            ">
            <div style="text-align: right;">
                <button id="cancel-btn" style="
                    margin-right: 8px;
                    padding: 6px 12px;
                    background: transparent;
                    color: var(--vscode-editor-foreground, #cccccc);
                    border: 1px solid var(--vscode-input-border, #3c3c3c);
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button id="save-btn" style="
                    padding: 6px 12px;
                    background: var(--vscode-button-background, #0e639c);
                    color: var(--vscode-button-foreground, #ffffff);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Save</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Focus the input
        const input = dialog.querySelector('#filename-input') as HTMLInputElement;
        input.focus();
        input.select();

        // Handle buttons
        dialog.querySelector('#cancel-btn')!.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        dialog.querySelector('#save-btn')!.addEventListener('click', () => {
            const filename = input.value;
            document.body.removeChild(overlay);
            callback(filename);
        });

        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const filename = input.value;
                document.body.removeChild(overlay);
                callback(filename);
            } else if (e.key === 'Escape') {
                document.body.removeChild(overlay);
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }

    private showVoiceCreationDialog(callback: (name: string, description: string) => void): void {
        // Create a modal dialog for voice creation
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-editor-foreground, #cccccc);
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 6px;
            padding: 20px;
            min-width: 400px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">Create Voice</h3>
            <label style="display: block; margin-bottom: 8px;">Voice Name:</label>
            <input type="text" id="voice-name-input" placeholder="Enter voice name..." style="
                width: 100%;
                padding: 8px;
                background: var(--vscode-input-background, #3c3c3c);
                color: var(--vscode-input-foreground, #cccccc);
                border: 1px solid var(--vscode-input-border, #3c3c3c);
                border-radius: 4px;
                margin-bottom: 15px;
            ">
            <label style="display: block; margin-bottom: 8px;">Description (optional):</label>
            <textarea id="voice-description-input" placeholder="Enter voice description..." style="
                width: 100%;
                height: 60px;
                padding: 8px;
                background: var(--vscode-input-background, #3c3c3c);
                color: var(--vscode-input-foreground, #cccccc);
                border: 1px solid var(--vscode-input-border, #3c3c3c);
                border-radius: 4px;
                margin-bottom: 15px;
                resize: vertical;
            "></textarea>
            <div style="text-align: right;">
                <button id="cancel-btn" style="
                    margin-right: 8px;
                    padding: 6px 12px;
                    background: transparent;
                    color: var(--vscode-editor-foreground, #cccccc);
                    border: 1px solid var(--vscode-input-border, #3c3c3c);
                    border-radius: 4px;
                    cursor: pointer;
                ">Cancel</button>
                <button id="create-btn" style="
                    padding: 6px 12px;
                    background: var(--vscode-button-background, #0e639c);
                    color: var(--vscode-button-foreground, #ffffff);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Create Voice</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Focus the name input
        const nameInput = dialog.querySelector('#voice-name-input') as HTMLInputElement;
        const descInput = dialog.querySelector('#voice-description-input') as HTMLTextAreaElement;
        nameInput.focus();

        // Handle buttons
        dialog.querySelector('#cancel-btn')!.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        dialog.querySelector('#create-btn')!.addEventListener('click', () => {
            const name = nameInput.value;
            const description = descInput.value;
            document.body.removeChild(overlay);
            callback(name, description);
        });

        // Handle Enter key in name input
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const name = nameInput.value;
                const description = descInput.value;
                document.body.removeChild(overlay);
                callback(name, description);
            } else if (e.key === 'Escape') {
                document.body.removeChild(overlay);
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }
}

// Global instance for use by onclick handlers
let musicEditor: MusicEditor;

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        musicEditor = new MusicEditor();
    });
} else {
    musicEditor = new MusicEditor();
}