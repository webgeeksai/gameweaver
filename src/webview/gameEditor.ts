// This file will be compiled to out/webview/gameEditor.js

declare const acquireVsCodeApi: any;
declare const Phaser: any;

// Simple GDL parser for webview
interface GDLEntity {
    name: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    properties: { [key: string]: any };
}

interface GDLScene {
    name: string;
    width: number;
    height: number;
    background?: string;
    entities: GDLEntity[];
}

class GDLParser {
    parse(gdlCode: string): GDLScene {
        const scene: GDLScene = {
            name: 'Game',
            width: 800,
            height: 600,
            entities: []
        };

        const lines = gdlCode.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));

        for (const line of lines) {
            // Parse scene properties
            if (line.startsWith('scene')) {
                this.parseScene(line, scene);
            }
            // Parse entities
            else if (line.includes('at (') && line.includes(')')) {
                const entity = this.parseEntity(line);
                if (entity) {
                    scene.entities.push(entity);
                }
            }
        }

        return scene;
    }

    private parseScene(line: string, scene: GDLScene) {
        if (line.includes('size')) {
            const sizeMatch = line.match(/size\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
            if (sizeMatch) {
                scene.width = parseInt(sizeMatch[1]);
                scene.height = parseInt(sizeMatch[2]);
            }
        }
        if (line.includes('background')) {
            const bgMatch = line.match(/background\s*["']([^"']+)["']/);
            if (bgMatch) {
                scene.background = bgMatch[1];
            }
        }
    }

    private parseEntity(line: string): GDLEntity | null {
        const nameMatch = line.match(/^(\w+)/);
        if (!nameMatch) return null;

        const name = nameMatch[1];
        
        const posMatch = line.match(/at\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (!posMatch) return null;

        const x = parseInt(posMatch[1]);
        const y = parseInt(posMatch[2]);

        let width = 32, height = 32;
        const sizeMatch = line.match(/size\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (sizeMatch) {
            width = parseInt(sizeMatch[1]);
            height = parseInt(sizeMatch[2]);
        }

        let type = 'sprite';
        if (name.includes('platform') || name.includes('ground') || name.includes('wall')) {
            type = 'platform';
        } else if (name.includes('player') || name.includes('hero')) {
            type = 'player';
        } else if (name.includes('enemy') || name.includes('monster')) {
            type = 'enemy';
        } else if (name.includes('coin') || name.includes('gem') || name.includes('pickup')) {
            type = 'collectible';
        }

        const properties: { [key: string]: any } = {};
        
        const spriteMatch = line.match(/sprite\s*["']([^"']+)["']/);
        if (spriteMatch) {
            properties.sprite = spriteMatch[1];
        }

        const colorMatch = line.match(/color\s*["']([^"']+)["']/);
        if (colorMatch) {
            properties.color = colorMatch[1];
        }

        if (line.includes('physics')) {
            properties.physics = true;
        }

        if (line.includes('gravity')) {
            properties.gravity = true;
        }

        return { name, type, x, y, width, height, properties };
    }
}

const vscode = acquireVsCodeApi();

interface GameEditorState {
    code: string;
    isRunning: boolean;
    compiledGame?: any;
}

class GameEditorWebview {
    private state: GameEditorState = {
        code: '',
        isRunning: false
    };
    
    private phaserGame?: any;
    private gdlParser = new GDLParser();
    private currentScene?: GDLScene;
    private codeEditor?: HTMLTextAreaElement;
    private loadedAssets?: { [key: string]: any };

    constructor() {
        this.initializeUI();
        this.setupEventListeners();
        this.setupMessageHandling();
        
        // Request assets early
        console.log('Requesting assets in constructor...');
        this.sendMessage('loadAssets');
    }

    private initializeUI() {
        const app = document.getElementById('app');
        if (!app) return;

        // Get DOM elements
        this.codeEditor = document.getElementById('code-editor') as HTMLTextAreaElement;
        
        // Initialize code editor as textarea for now
        if (this.codeEditor) {
            this.codeEditor.style.whiteSpace = 'pre';
            this.codeEditor.style.fontFamily = 'monospace';
            this.codeEditor.style.tabSize = '4';
        }
    }

    private setupEventListeners() {
        // Toolbar buttons
        const compileBtn = document.getElementById('compile-btn');
        const runBtn = document.getElementById('run-btn');
        const stopBtn = document.getElementById('stop-btn');

        compileBtn?.addEventListener('click', () => this.compile());
        runBtn?.addEventListener('click', () => this.run());
        stopBtn?.addEventListener('click', () => this.stop());

        // Code editor changes
        this.codeEditor?.addEventListener('input', (e) => {
            this.state.code = (e.target as HTMLTextAreaElement).value;
            this.sendMessage('updateCode', { code: this.state.code });
        });

        // Handle Ctrl+Enter to compile and run
        this.codeEditor?.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.compile();
            }
        });
    }

    private setupMessageHandling() {
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'update':
                    this.updateCode(message.code);
                    break;
                case 'gameState':
                    this.updateGameState(message.state);
                    break;
                case 'compilationResult':
                    this.handleCompilationResult(message.success, message.error, message.compiledGame);
                    break;
                case 'assetChanged':
                    this.handleAssetChanged(message.fileName, message.path);
                    break;
                case 'assetDeleted':
                    this.handleAssetDeleted(message.fileName);
                    break;
                case 'assetsLoaded':
                    this.handleAssetsLoaded(message.assets);
                    break;
            }
        });
    }

    private compile() {
        this.sendMessage('compile');
        this.showStatus('Compiling...', 'info');
    }

    private run() {
        // Parse the current GDL code directly
        try {
            this.currentScene = this.gdlParser.parse(this.state.code);
            this.startPhaserGame();
            this.updateRunningState(true);
        } catch (error) {
            this.showStatus(`GDL parse error: ${error}`, 'error');
        }
    }

    private stop() {
        this.stopPhaserGame();
        this.sendMessage('stop');
        this.updateRunningState(false);
    }

    private startPhaserGame() {
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) return;

        // Clear existing game
        this.stopPhaserGame();

        // Create Phaser game config using parsed scene
        const sceneWidth = this.currentScene?.width || 800;
        const sceneHeight = this.currentScene?.height || 600;
        
        const config = {
            type: Phaser.AUTO,
            width: sceneWidth,
            height: sceneHeight,
            parent: 'game-container',
            backgroundColor: this.currentScene?.background || '#87CEEB',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 300 },
                    debug: false
                }
            },
            scene: {
                preload: this.preload.bind(this),
                create: this.create.bind(this),
                update: this.update.bind(this)
            }
        };

        this.phaserGame = new Phaser.Game(config);
        this.showStatus('Game running', 'success');
    }

    private stopPhaserGame() {
        if (this.phaserGame) {
            this.phaserGame.destroy(true);
            this.phaserGame = null;
        }
        
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.innerHTML = '<div class="game-loading">Game stopped</div>';
        }
        
        this.showStatus('Game stopped', 'info');
    }

    private async preload() {
        const scene = this.phaserGame.scene.scenes[0];
        
        console.log('Preload called. LoadedAssets:', this.loadedAssets);
        
        // Create a simple test SVG sprite inline to test if SVG loading works at all
        const testPlayerSvg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="8" width="24" height="20" rx="4" fill="#4A90E2" stroke="#2E5C8A" stroke-width="2"/>
            <circle cx="10" cy="14" r="3" fill="white"/>
            <circle cx="22" cy="14" r="3" fill="white"/>
            <circle cx="11" cy="15" r="2" fill="black"/>
            <circle cx="23" cy="15" r="2" fill="black"/>
        </svg>`;
        
        const testPlatformSvg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="32" height="32" fill="#8B4513"/>
            <rect x="0" y="0" width="32" height="12" fill="#228B22"/>
        </svg>`;
        
        // Convert to data URIs
        const playerDataUri = 'data:image/svg+xml;base64,' + btoa(testPlayerSvg);
        const platformDataUri = 'data:image/svg+xml;base64,' + btoa(testPlatformSvg);
        
        console.log('Loading test SVG sprites...');
        scene.load.image('player', playerDataUri);
        scene.load.image('platforms', platformDataUri);
        
        // Always request asset loading from VS Code for future improvements
        this.sendMessage('loadAssets');
        
        // Load assets if available from VS Code (will override test sprites if successful)
        if (this.loadedAssets) {
            console.log('Loading assets from VS Code:', Object.keys(this.loadedAssets));
            Object.entries(this.loadedAssets).forEach(([path, assetData]) => {
                const fileName = path.split('/').pop()?.split('.')[0] || 'unknown';
                const dataUri = 'data:image/svg+xml;base64,' + btoa(assetData.content);
                console.log(`Loading sprite: ${fileName} from ${path}`);
                scene.load.image(fileName, dataUri);
            });
        }
    }

    private create() {
        const scene = this.phaserGame.scene.scenes[0];
        
        console.log('Create called. Available textures:', Object.keys(scene.textures.list));
        console.log('Current scene:', this.currentScene);
        
        if (!this.currentScene || this.currentScene.entities.length === 0) {
            // Show default demo if no GDL content
            scene.add.text(scene.cameras.main.centerX, scene.cameras.main.centerY, 
                'No GDL content found.\nEdit your .gdl file and click "Reload" to see changes.', {
                fontSize: '18px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            return;
        }

        // Create game objects from parsed GDL entities
        const gameObjects: { [key: string]: any } = {};
        const platforms: any[] = [];
        let player: any = null;

        this.currentScene.entities.forEach(entity => {
            let gameObject: any;
            
            switch (entity.type) {
                case 'player':
                    gameObject = scene.add.image(entity.x, entity.y, 'player');
                    if (!scene.textures.exists('player')) {
                        // Fallback to colored rectangle if sprite not loaded
                        gameObject = scene.add.rectangle(entity.x, entity.y, entity.width || 32, entity.height || 32, 0x0099ff);
                    }
                    scene.physics.add.existing(gameObject);
                    gameObject.body.setCollideWorldBounds(true);
                    player = gameObject;
                    scene.player = gameObject;
                    break;
                    
                case 'platform':
                    gameObject = scene.add.image(entity.x, entity.y, 'platforms');
                    if (!scene.textures.exists('platforms')) {
                        // Fallback to colored rectangle if sprite not loaded
                        const color = this.getColorFromName(entity.properties.color) || 0x00ff00;
                        gameObject = scene.add.rectangle(entity.x, entity.y, entity.width || 200, entity.height || 32, color);
                    } else {
                        gameObject.setDisplaySize(entity.width || 200, entity.height || 32);
                    }
                    scene.physics.add.existing(gameObject, true); // static body
                    platforms.push(gameObject);
                    break;
                    
                case 'enemy':
                    gameObject = scene.add.rectangle(entity.x, entity.y, entity.width || 32, entity.height || 32, 0xff0000);
                    scene.physics.add.existing(gameObject);
                    break;
                    
                case 'collectible':
                    gameObject = scene.add.rectangle(entity.x, entity.y, entity.width || 16, entity.height || 16, 0xffff00);
                    scene.physics.add.existing(gameObject, true);
                    break;
                    
                default:
                    // Generic sprite
                    const defaultColor = this.getColorFromName(entity.properties.color) || 0x999999;
                    gameObject = scene.add.rectangle(entity.x, entity.y, entity.width || 32, entity.height || 32, defaultColor);
                    if (entity.properties.physics) {
                        scene.physics.add.existing(gameObject, !entity.properties.gravity);
                    }
                    break;
            }
            
            if (gameObject) {
                gameObjects[entity.name] = gameObject;
            }
        });

        // Set up collisions between player and platforms
        if (player && platforms.length > 0) {
            platforms.forEach(platform => {
                scene.physics.add.collider(player, platform);
            });
        }

        // Add instructions
        scene.add.text(16, 16, 'Game created from GDL!\nUse arrow keys to move, space to jump.', {
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: { x: 8, y: 4 }
        });
    }

    private getColorFromName(colorName?: string): number | null {
        if (!colorName) return null;
        
        const colors: { [key: string]: number } = {
            'red': 0xff0000,
            'green': 0x00ff00,
            'blue': 0x0000ff,
            'yellow': 0xffff00,
            'orange': 0xff8800,
            'purple': 0xff00ff,
            'cyan': 0x00ffff,
            'brown': 0x8b4513,
            'gray': 0x808080,
            'grey': 0x808080,
            'black': 0x000000,
            'white': 0xffffff
        };
        
        return colors[colorName.toLowerCase()] || null;
    }

    private update() {
        // Basic update logic
        const scene = this.phaserGame?.scene?.scenes[0];
        if (!scene || !scene.player) return;

        // Simple keyboard controls for demo
        const cursors = scene.input.keyboard?.createCursorKeys();
        if (!cursors) return;

        if (cursors.left.isDown) {
            scene.player.body.setVelocityX(-160);
        } else if (cursors.right.isDown) {
            scene.player.body.setVelocityX(160);
        } else {
            scene.player.body.setVelocityX(0);
        }

        if (cursors.up.isDown && scene.player.body.touching.down) {
            scene.player.body.setVelocityY(-330);
        }
    }

    private executeCompiledGame(scene: any) {
        // This would execute the compiled GDL code in the Phaser scene
        // For now, it's a placeholder
        console.log('Executing compiled game:', this.state.compiledGame);
    }

    private updateCode(code: string) {
        this.state.code = code;
        if (this.codeEditor) {
            this.codeEditor.value = code;
        }
    }

    private updateGameState(state: any) {
        console.log('Game state updated:', state);
    }

    private handleAssetChanged(fileName: string, path: string) {
        console.log('Asset changed:', fileName, path);
        // Reload the asset in Phaser if the game is running
        if (this.phaserGame && this.state.isRunning) {
            // Trigger asset reload
            this.reloadAsset(fileName);
        }
    }

    private handleAssetDeleted(fileName: string) {
        console.log('Asset deleted:', fileName);
        // Handle asset removal
    }

    private reloadAsset(fileName: string) {
        // Implementation for hot-reloading specific assets
        console.log('Reloading asset:', fileName);
    }

    private getAssetUri(relativePath: string): string {
        // Convert relative workspace path to VS Code webview URI
        // This assumes the VS Code extension will handle the path resolution
        return relativePath;
    }

    private handleAssetsLoaded(assets: { [key: string]: any }) {
        console.log('Assets loaded:', assets);
        this.loadedAssets = assets;
        
        // If Phaser game is already running, reload with new assets
        if (this.phaserGame && this.state.isRunning) {
            this.restartPhaserGame();
        }
    }

    private restartPhaserGame() {
        if (this.phaserGame) {
            this.phaserGame.destroy(true);
        }
        this.startPhaserGame();
    }

    private handleCompilationResult(success: boolean, error?: string, compiledGame?: any) {
        if (success) {
            this.state.compiledGame = compiledGame;
            this.showStatus('Compilation successful!', 'success');
            
            // Auto-run if game is already running
            if (this.state.isRunning) {
                this.startPhaserGame();
            }
        } else {
            this.showStatus(`Compilation failed: ${error}`, 'error');
        }
    }

    private updateRunningState(isRunning: boolean) {
        this.state.isRunning = isRunning;
        
        const runBtn = document.getElementById('run-btn') as HTMLButtonElement;
        const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
        
        if (runBtn) runBtn.disabled = isRunning;
        if (stopBtn) stopBtn.disabled = !isRunning;
    }

    private showStatus(message: string, type: 'info' | 'success' | 'warning' | 'error') {
        // Create or update status bar
        let statusBar = document.querySelector('.status-bar') as HTMLElement;
        if (!statusBar) {
            statusBar = document.createElement('div');
            statusBar.className = 'status-bar';
            document.body.appendChild(statusBar);
        }

        const statusDot = `<div class="status-dot ${type === 'success' ? 'running' : type === 'error' ? 'error' : ''}"></div>`;
        statusBar.innerHTML = `
            <div class="status-item">
                ${statusDot}
                <span>${message}</span>
            </div>
            <div class="status-item">
                <span>Game Vibe Engine</span>
            </div>
        `;

        // Auto-hide after 3 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                if (statusBar.textContent?.includes(message)) {
                    statusBar.innerHTML = `
                        <div class="status-item">
                            <div class="status-dot"></div>
                            <span>Ready</span>
                        </div>
                        <div class="status-item">
                            <span>Game Vibe Engine</span>
                        </div>
                    `;
                }
            }, 3000);
        }
    }

    private sendMessage(command: string, data?: any) {
        vscode.postMessage({
            command,
            ...data
        });
    }
}

// Enhanced CSS injection for better styling
const style = document.createElement('style');
style.textContent = `
    .status-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
    }
    
    .status-indicator::before {
        content: '●';
        color: #666;
    }
    
    .status-indicator.status-success::before {
        color: #00ff00;
    }
    
    .status-indicator.status-error::before {
        color: #ff0000;
    }
    
    .status-indicator.status-warning::before {
        color: #ffaa00;
    }
    
    .status-indicator.status-info::before {
        color: #00aaff;
    }
    
    .console-entry {
        padding: 2px 8px;
        border-left: 2px solid transparent;
        font-family: monospace;
        font-size: 12px;
    }
    
    .console-entry.console-error {
        border-left-color: #ff0000;
        background: rgba(255, 0, 0, 0.1);
    }
    
    .console-entry.console-warning {
        border-left-color: #ffaa00;
        background: rgba(255, 170, 0, 0.1);
    }
    
    .console-entry.console-success {
        border-left-color: #00ff00;
        background: rgba(0, 255, 0, 0.1);
    }
    
    .console-time {
        color: #666;
        margin-right: 8px;
    }
    
    .toolbar-group {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .toolbar-toggle {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
    }
    
    .toggle-slider {
        width: 24px;
        height: 12px;
        background: #ccc;
        border-radius: 6px;
        position: relative;
        cursor: pointer;
    }
    
    .toggle-slider::before {
        content: '';
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: white;
        top: 1px;
        left: 1px;
        transition: transform 0.2s;
    }
    
    input[type="checkbox"]:checked + .toggle-slider {
        background: #00ff00;
    }
    
    input[type="checkbox"]:checked + .toggle-slider::before {
        transform: translateX(12px);
    }
    
    input[type="checkbox"] {
        display: none;
    }
    
    .game-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        background: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid #333;
    }
    
    .game-controls {
        display: flex;
        gap: 4px;
    }
    
    .control-btn {
        background: none;
        border: 1px solid #666;
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    
    .control-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    
    .game-console {
        height: 120px;
        border-top: 1px solid #333;
        display: flex;
        flex-direction: column;
    }
    
    .console-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid #333;
        font-size: 12px;
    }
    
    .console-output {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;
        background: rgba(0, 0, 0, 0.05);
    }
`;
document.head.appendChild(style);

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new GameEditorWebview());
} else {
    new GameEditorWebview();
}