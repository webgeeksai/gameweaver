// Game Preview Webview Entry Point
// This bundles the full GameEngine for use in VS Code webviews

import { GameEngine, GameEngineOptions } from '../engine';
import { EntityManager } from '../engine';
import { ComponentManager } from '../engine';
import { TransformComponent, SpriteComponent, PhysicsComponent, ColliderComponent } from '../engine';
import { ComponentType, PhysicsMode } from '../engine';

// Declare VS Code API
declare const acquireVsCodeApi: any;

interface GDLEntity {
    name: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    properties: { [key: string]: any };
}

interface GDLScene {
    name: string;
    width: number;
    height: number;
    entities: GDLEntity[];
}

class GamePreviewManager {
    private vscode: any;
    private gameEngine: GameEngine | null = null;
    private currentScene: GDLScene | null = null;
    private logLevel = 2; // info level

    constructor() {
        this.vscode = acquireVsCodeApi();
        this.setupUI();
        this.log('info', '🎮 Game Preview Manager initialized');
    }

    private log(level: 'error' | 'warn' | 'info' | 'debug', message: string, ...args: any[]) {
        const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
        if (logLevels[level] <= this.logLevel) {
            console[level]('[GameVibe]', message, ...args);
        }
    }

    private setupUI() {
        const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
        const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
        const reloadBtn = document.getElementById('reload-btn') as HTMLButtonElement;

        playBtn?.addEventListener('click', () => this.startGame());
        pauseBtn?.addEventListener('click', () => this.pauseGame());
        reloadBtn?.addEventListener('click', () => this.reloadGame());

        // Auto-start after a delay
        setTimeout(() => this.startGame(), 500);
    }

    private startGame() {
        this.log('info', '🚀 Starting game...');
        
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) {
            this.log('error', '❌ Game container not found');
            return;
        }

        // Clear container and create canvas
        gameContainer.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        canvas.style.display = 'block';
        canvas.style.border = '1px solid #ccc';
        gameContainer.appendChild(canvas);

        try {
            // Use zero gravity by default for all games - can be overridden later
            this.log('info', '🎮 Using zero gravity by default for all games');
            
            // Initialize the full GameEngine
            const options: GameEngineOptions = {
                canvas: canvas,
                config: {
                    rendering: {
                        width: 800,
                        height: 600,
                        backgroundColor: '#87CEEB',
                        pixelArt: false,
                        antialias: true
                    },
                    physics: {
                        gravity: [0, 0], // Zero gravity by default
                        worldBounds: true,
                        bounceWorldBounds: false,
                        debug: false
                    },
                    input: {
                        keyboard: true,
                        mouse: true,
                        touch: false
                    }
                }
            };

            this.gameEngine = new GameEngine(options);
            this.log('info', '✅ GameEngine created successfully');

            // Create game from current scene data
            this.createGameFromGDL();

            // Start the engine
            this.gameEngine.start();
            this.log('info', '🎮 Game started successfully');

            // Update button states
            const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
            const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
            if (playBtn) playBtn.disabled = true;
            if (pauseBtn) pauseBtn.disabled = false;

        } catch (error) {
            this.log('error', '❌ Error starting game:', error);
            gameContainer.innerHTML = `<div style="color: red; text-align: center; padding: 20px;">Error starting game: ${error}</div>`;
        }
    }

    private pauseGame() {
        if (this.gameEngine) {
            this.gameEngine.stop();
            this.log('info', '⏸️ Game paused');
            
            const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
            const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
            if (playBtn) playBtn.disabled = false;
            if (pauseBtn) pauseBtn.disabled = true;
        }
    }

    private reloadGame() {
        this.log('info', '🔄 Reloading game...');
        this.vscode.postMessage({ command: 'reload' });
    }

    private createGameFromGDL() {
        if (!this.gameEngine || !this.currentScene) {
            this.log('warn', '⚠️ No game engine or scene data available');
            return;
        }

        this.log('info', '🔧 Creating game from GDL data');
        this.log('debug', '📊 Scene data:', this.currentScene);

        const entityManager = this.gameEngine.getEntityManager();
        const componentManager = this.gameEngine.getComponentManager();

        this.currentScene.entities.forEach(gdlEntity => {
            this.log('debug', '🎭 Creating entity:', gdlEntity.name);
            this.log('debug', '📋 Entity properties:', gdlEntity.properties);

            // Create entity
            const entityId = entityManager.createEntity();

            // Add Transform component
            const transformId = componentManager.generateId();
            const transform = new TransformComponent(transformId, entityId, {
                position: { x: gdlEntity.x, y: gdlEntity.y },
                rotation: 0,
                scale: { x: 1, y: 1 }
            });
            componentManager.addComponent(entityId, transform);

            // Add Sprite component with proper texture paths
            const spriteId = componentManager.generateId();
            const textureData = this.getTextureForEntity(gdlEntity);
            this.log('debug', `🎨 Setting texture for ${gdlEntity.name}:`, textureData.substring(0, 50) + '...');
            const sprite = new SpriteComponent(spriteId, entityId, {
                texture: textureData,
                tint: 0xffffff,
                alpha: 1,
                visible: true,
                bounds: { 
                    x: 0, 
                    y: 0, 
                    width: gdlEntity.width, 
                    height: gdlEntity.height 
                }
            });
            componentManager.addComponent(entityId, sprite);

            // Add Physics component for dynamic entities
            const physicsId = componentManager.generateId();
            if (gdlEntity.type === 'player' || gdlEntity.type === 'enemy') {
                // Always use TopDown mode for now to avoid gravity issues
                const physicsMode = PhysicsMode.TopDown;
                this.log('info', `🎮 Using TopDown physics mode for ${gdlEntity.name}`);
                
                const physics = new PhysicsComponent(physicsId, entityId, {
                    mode: physicsMode,
                    mass: 1,
                    friction: 0.8,
                    velocity: { x: 0, y: 0 },
                    acceleration: { x: 0, y: 0 }
                });
                componentManager.addComponent(entityId, physics);
            } else if (gdlEntity.type === 'platform') {
                const physics = new PhysicsComponent(physicsId, entityId, {
                    mode: PhysicsMode.Static,
                    mass: 0,
                    friction: 1,
                    velocity: { x: 0, y: 0 },
                    acceleration: { x: 0, y: 0 }
                });
                componentManager.addComponent(entityId, physics);
            }

            // Add Collider component
            const colliderId = componentManager.generateId();
            const collider = new ColliderComponent(colliderId, entityId, {
                shape: {
                    type: 'rectangle',
                    width: gdlEntity.width,
                    height: gdlEntity.height
                },
                isTrigger: gdlEntity.type === 'collectible',
                offset: { x: 0, y: 0 }
            });
            componentManager.addComponent(entityId, collider);

            this.log('debug', '✅ Created entity:', gdlEntity.name, 'with ID:', entityId);
        });

        this.log('info', `🏁 Created ${this.currentScene.entities.length} entities from GDL`);
    }

    private getDefaultColorForType(type: string): string {
        const typeColors: { [key: string]: string } = {
            'player': '#4A90E2',
            'platform': '#2ECC71',
            'enemy': '#E74C3C',
            'collectible': '#F39C12',
            'sprite': '#95A5A6'
        };
        return typeColors[type] || '#95A5A6';
    }

    private detectGameType(): 'rpg' | 'platformer' | 'puzzle' {
        // Detect game type based on scene entities and properties
        if (!this.currentScene) return 'platformer';
        
        // Check for RPG indicators - simplified
        const hasTopDownMovement = this.currentScene.entities.some(e => 
            e.name.toLowerCase().includes('player')
        );
        
        const hasRPGEntities = this.currentScene.entities.some(e => 
            e.name.toLowerCase().includes('npc') || 
            e.name.toLowerCase().includes('sign') ||
            e.name.toLowerCase().includes('tuxemon') ||
            e.type === 'tilemap'
        );
        
        if (hasTopDownMovement || hasRPGEntities) {
            this.log('info', '🎮 Detected RPG game type - using topdown physics');
            return 'rpg';
        }
        
        // Check for puzzle game indicators
        const hasPuzzleElements = this.currentScene.entities.some(e => 
            e.name.toLowerCase().includes('block') || 
            e.name.toLowerCase().includes('switch') ||
            e.name.toLowerCase().includes('puzzle')
        );
        
        if (hasPuzzleElements) {
            this.log('info', '🧩 Detected puzzle game type');
            return 'puzzle';
        }
        
        // Default to platformer
        this.log('info', '🏃 Detected platformer game type');
        return 'platformer';
    }

    private getTextureForEntity(entity: GDLEntity): string {
        // Use color from GDL if specified (simple and safe)
        if (entity.properties && entity.properties.color) {
            this.log('debug', `🎨 Using GDL color: ${entity.properties.color} for ${entity.name}`);
            return entity.properties.color;
        }

        // Fallback to default colors by type
        const defaultColor = this.getDefaultColorForType(entity.type);
        this.log('debug', `🎨 Using default color: ${defaultColor} for ${entity.name}`);
        return defaultColor;
    }

    private createPlayerSprite(): string {
        // Test with a real PNG file from the internet
        return 'https://raw.githubusercontent.com/microsoft/vscode/main/resources/linux/code.png';
    }

    private createPlatformSprite(): string {
        const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="32" height="32" fill="#8B4513"/>
            <rect x="0" y="0" width="32" height="12" fill="#228B22"/>
            <path d="M 0 8 Q 4 4 8 8 T 16 8 T 24 8 T 32 8" stroke="#32CD32" stroke-width="2" fill="none"/>
        </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    private createEnemySprite(): string {
        const svg = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <polygon points="14,2 26,24 2,24" fill="#FF4444" stroke="#CC0000" stroke-width="2"/>
            <circle cx="10" cy="18" r="2" fill="white"/>
            <circle cx="18" cy="18" r="2" fill="white"/>
            <circle cx="10" cy="18" r="1" fill="black"/>
            <circle cx="18" cy="18" r="1" fill="black"/>
        </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    private createCollectibleSprite(): string {
        const svg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="#FFD700" stroke="#FFA500" stroke-width="1"/>
        </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    private createGenericSprite(): string {
        const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="28" height="28" rx="4" fill="#95A5A6" stroke="#7F8C8D" stroke-width="2"/>
            <circle cx="16" cy="16" r="8" fill="white" opacity="0.3"/>
        </svg>`;
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    // Method to receive GDL data from extension
    public setGDLData(gdlContent: string) {
        this.log('info', '📝 Received GDL data');
        this.log('debug', '📄 GDL content:', gdlContent);

        try {
            this.currentScene = this.parseGDL(gdlContent);
            this.log('info', '✅ GDL parsed successfully:', this.currentScene);
        } catch (error) {
            this.log('error', '❌ GDL parse error:', error);
            // Create fallback demo scene
            this.currentScene = this.createDemoScene();
        }
    }

    private parseGDL(content: string): GDLScene {
        const scene: GDLScene = { name: 'Game', width: 800, height: 600, entities: [] };
        
        // Find entity blocks using improved regex
        const entityMatches = content.match(/entity\s+(\w+)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
        this.log('debug', '🔍 Found entity blocks:', entityMatches.length);

        entityMatches.forEach(entityBlock => {
            const entity = this.parseEntityBlock(entityBlock);
            if (entity) {
                scene.entities.push(entity);
            }
        });

        // If no entities found, create demo entities
        if (scene.entities.length === 0) {
            this.log('warn', '⚠️ No entities found, creating demo scene');
            return this.createDemoScene();
        }

        return scene;
    }

    private parseEntityBlock(block: string): GDLEntity | null {
        // Extract entity name
        const nameMatch = block.match(/entity\s+(\w+)/);
        if (!nameMatch) return null;
        const name = nameMatch[1];

        // Parse transform
        let x = 100, y = 300;
        const transformMatch = block.match(/transform:\s*\{([^}]*)\}/);
        if (transformMatch) {
            const transformContent = transformMatch[1];
            const xMatch = transformContent.match(/x:\s*(\d+)/);
            const yMatch = transformContent.match(/y:\s*(\d+)/);
            if (xMatch) x = parseInt(xMatch[1]);
            if (yMatch) y = parseInt(yMatch[1]);
        }

        // Parse sprite
        let width = 32, height = 32, color = null, texture = null;
        const spriteMatch = block.match(/sprite:\s*\{([^}]*)\}/);
        if (spriteMatch) {
            const spriteContent = spriteMatch[1];
            const widthMatch = spriteContent.match(/width:\s*(\d+)/);
            const heightMatch = spriteContent.match(/height:\s*(\d+)/);
            const colorMatch = spriteContent.match(/color:\s*["']([^"']+)["']/);
            const textureMatch = spriteContent.match(/texture:\s*["']([^"']+)["']/);
            if (widthMatch) width = parseInt(widthMatch[1]);
            if (heightMatch) height = parseInt(heightMatch[1]);
            if (colorMatch) color = colorMatch[1];
            if (textureMatch) texture = textureMatch[1];
        }

        // Simple parsing - just get what we need safely
        // No complex parsing for now to avoid runtime errors

        // Determine entity type
        let type = 'sprite';
        const lowerName = name.toLowerCase();
        if (lowerName.includes('player') || lowerName.includes('hero')) {
            type = 'player';
        } else if (lowerName.includes('platform') || lowerName.includes('ground') || lowerName.includes('wall')) {
            type = 'platform';
        } else if (lowerName.includes('enemy') || lowerName.includes('monster')) {
            type = 'enemy';
        } else if (lowerName.includes('coin') || lowerName.includes('gem') || lowerName.includes('pickup')) {
            type = 'collectible';
        }

        return { 
            name, 
            type, 
            x, 
            y, 
            width, 
            height, 
            properties: { 
                color, 
                texture
            } 
        };
    }

    private createDemoScene(): GDLScene {
        return {
            name: 'Demo',
            width: 800,
            height: 600,
            entities: [
                { name: 'Player', type: 'player', x: 100, y: 400, width: 32, height: 32, properties: { color: '#4A90E2' } },
                { name: 'Ground', type: 'platform', x: 400, y: 568, width: 800, height: 64, properties: { color: '#2ECC71' } },
                { name: 'Platform1', type: 'platform', x: 300, y: 450, width: 200, height: 32, properties: { color: '#95A5A6' } }
            ]
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const gamePreview = new GamePreviewManager();
    
    // Make it globally accessible for the extension to call
    (window as any).gamePreview = gamePreview;
});

// Export for webpack
export { GamePreviewManager };