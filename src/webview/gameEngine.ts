// Simplified Game Engine for Webview
// This is a lightweight version of the main GameEngine for use in webviews

interface Entity {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    type: string;
    vx?: number;
    vy?: number;
    isStatic?: boolean;
    grounded?: boolean;
    sprite?: HTMLImageElement;
    spriteLoaded?: boolean;
}

class SimpleGameEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private entities: Entity[] = [];
    private player: Entity | null = null;
    private isRunning = false;
    private animationId: number | null = null;
    private keys: { [key: string]: boolean } = {};
    private spriteCache: { [key: string]: HTMLImageElement } = {};

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.setupInput();
        console.log('[GameEngine] *** NEW VERSION - About to load sprites ***');
        this.loadSprites();
        console.log('[GameEngine] Initialized with canvas:', canvas);
    }

    private loadSprites() {
        console.log('[GameEngine] *** LOADING SPRITES - START ***');
        // Load actual assets from the assets folder
        this.loadSpriteFromPath('player', './assets/sprites-rpg/spaceman.png');
        this.loadSpriteFromPath('atlas', './assets/atlas-rpg/atlas.png');
        this.loadSpriteFromPath('tileset', './assets/tilesets-rpg/tuxemon-sample-32px-extruded.png');
        
        // Create inline SVG sprites as fallbacks
        const playerSvg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="8" width="24" height="20" rx="4" fill="#4A90E2" stroke="#2E5C8A" stroke-width="2"/>
            <circle cx="10" cy="14" r="3" fill="white"/>
            <circle cx="22" cy="14" r="3" fill="white"/>
            <circle cx="11" cy="15" r="2" fill="black"/>
            <circle cx="23" cy="15" r="2" fill="black"/>
            <path d="M 10 20 Q 16 24 22 20" stroke="black" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>`;
        
        const platformSvg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="32" height="32" fill="#8B4513"/>
            <rect x="0" y="0" width="32" height="12" fill="#228B22"/>
            <path d="M 0 8 Q 4 4 8 8 T 16 8 T 24 8 T 32 8" stroke="#32CD32" stroke-width="2" fill="none"/>
        </svg>`;
        
        const collectibleSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="#FFD700" stroke="#FFA500" stroke-width="1"/>
        </svg>`;
        
        const enemySvg = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <polygon points="14,2 26,24 2,24" fill="#FF4444" stroke="#CC0000" stroke-width="2"/>
            <circle cx="10" cy="18" r="2" fill="white"/>
            <circle cx="18" cy="18" r="2" fill="white"/>
            <circle cx="10" cy="18" r="1" fill="black"/>
            <circle cx="18" cy="18" r="1" fill="black"/>
        </svg>`;

        this.createSpriteFromSVG('player', playerSvg);
        this.createSpriteFromSVG('platform', platformSvg);
        this.createSpriteFromSVG('collectible', collectibleSvg);
        this.createSpriteFromSVG('enemy', enemySvg);
        
        console.log('[GameEngine] Sprites loaded:', Object.keys(this.spriteCache));
    }

    private createSpriteFromSVG(name: string, svgString: string) {
        const img = new Image();
        const dataUrl = 'data:image/svg+xml;base64,' + btoa(svgString);
        
        img.onload = () => {
            this.spriteCache[name] = img;
            console.log(`[GameEngine] Sprite loaded: ${name}`);
        };
        
        img.onerror = (error) => {
            console.error(`[GameEngine] Failed to load sprite: ${name}`, error);
        };
        
        img.src = dataUrl;
    }

    private loadSpriteFromPath(name: string, path: string) {
        console.log(`[GameEngine] Attempting to load sprite: ${name} from ${path}`);
        const img = new Image();
        
        img.onload = () => {
            this.spriteCache[name] = img;
            console.log(`[GameEngine] Successfully loaded sprite: ${name} from ${path}`);
        };
        
        img.onerror = (error) => {
            console.warn(`[GameEngine] Failed to load sprite: ${name} from ${path}`, error);
            // Fallback to generated sprite
            console.log(`[GameEngine] Using fallback sprite for: ${name}`);
        };
        
        img.src = path;
    }

    private setupInput() {
        // Input handling
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === ' ') e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    addEntity(entity: Partial<Entity> & { type: string }): Entity {
        const newEntity: Entity = {
            id: Math.random().toString(36),
            x: entity.x || 0,
            y: entity.y || 0,
            width: entity.width || 32,
            height: entity.height || 32,
            color: entity.color || '#ffffff',
            type: entity.type,
            vx: 0,
            vy: 0,
            isStatic: entity.type === 'platform',
            grounded: false
        };

        this.entities.push(newEntity);
        
        if (entity.type === 'player') {
            this.player = newEntity;
        }

        console.log('[GameEngine] Added entity:', newEntity);
        return newEntity;
    }

    start() {
        console.log('[GameEngine] Starting game loop');
        this.isRunning = true;
        this.gameLoop();
    }

    stop() {
        console.log('[GameEngine] Stopping game loop');
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    private gameLoop = () => {
        if (!this.isRunning) return;

        this.update();
        this.render();
        
        this.animationId = requestAnimationFrame(this.gameLoop);
    }

    private update() {
        if (this.player) {
            this.updatePlayer(this.player);
        }

        // Update physics for all dynamic entities
        this.entities.forEach(entity => {
            if (!entity.isStatic) {
                this.updatePhysics(entity);
            }
        });

        // Check collisions
        this.checkCollisions();
    }

    private updatePlayer(player: Entity) {
        // Input handling
        if (this.keys['a'] || this.keys['arrowleft']) {
            player.vx = -200;
        } else if (this.keys['d'] || this.keys['arrowright']) {
            player.vx = 200;
        } else {
            player.vx = (player.vx || 0) * 0.8; // Friction
        }

        // Jumping
        if ((this.keys[' '] || this.keys['w'] || this.keys['arrowup']) && player.grounded) {
            player.vy = -400;
            player.grounded = false;
        }
    }

    private updatePhysics(entity: Entity) {
        if (!entity.vx) entity.vx = 0;
        if (!entity.vy) entity.vy = 0;

        // Apply gravity only for platformer-type games (disabled for top-down RPGs)
        // Check if this is a top-down game by entity type or properties
        const isTopDown = entity.type === 'player' && entity.id?.toLowerCase().includes('rpg');
        
        if (!isTopDown) {
            entity.vy += 800 * (1/60); // 800 pixels/second gravity
        }

        // Update position
        entity.x += entity.vx * (1/60);
        entity.y += entity.vy * (1/60);

        // World bounds
        if (entity.x < 0) entity.x = 0;
        if (entity.x + entity.width > this.canvas.width) entity.x = this.canvas.width - entity.width;
        
        // Only apply floor collision for non-top-down games
        if (!isTopDown && entity.y > this.canvas.height) {
            entity.y = this.canvas.height - entity.height;
            entity.vy = 0;
            entity.grounded = true;
        }
    }

    private checkCollisions() {
        const dynamicEntities = this.entities.filter(e => !e.isStatic);
        const staticEntities = this.entities.filter(e => e.isStatic);

        dynamicEntities.forEach(dynamic => {
            dynamic.grounded = false;
            
            staticEntities.forEach(static_ => {
                if (this.checkCollision(dynamic, static_)) {
                    this.resolveCollision(dynamic, static_);
                }
            });
        });
    }

    private checkCollision(a: Entity, b: Entity): boolean {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    private resolveCollision(dynamic: Entity, static_: Entity) {
        // Calculate overlap on both axes
        const overlapX = Math.min(dynamic.x + dynamic.width - static_.x, static_.x + static_.width - dynamic.x);
        const overlapY = Math.min(dynamic.y + dynamic.height - static_.y, static_.y + static_.height - dynamic.y);
        
        // Resolve collision on the axis with smaller overlap
        if (overlapX < overlapY) {
            // Horizontal collision
            if (dynamic.x < static_.x) {
                dynamic.x = static_.x - dynamic.width;
            } else {
                dynamic.x = static_.x + static_.width;
            }
            dynamic.vx = 0;
        } else {
            // Vertical collision
            if (dynamic.y < static_.y) {
                // Landing on top of platform
                dynamic.y = static_.y - dynamic.height;
                dynamic.vy = 0;
                dynamic.grounded = true;
            } else {
                // Hitting platform from below
                dynamic.y = static_.y + static_.height;
                dynamic.vy = 0;
            }
        }
    }

    private render() {
        // Clear canvas
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw entities
        this.entities.forEach(entity => {
            // Try to get appropriate sprite based on entity type
            let spriteName = entity.type;
            if (entity.type === 'sprite' && entity.id.includes('Star')) {
                spriteName = 'collectible';
            } else if (entity.type === 'sprite' && (entity.id.includes('Checkpoint') || entity.id.includes('Goal'))) {
                spriteName = 'collectible';
            }

            const sprite = this.spriteCache[spriteName];
            
            if (sprite && sprite.complete) {
                // Draw sprite
                this.ctx.drawImage(sprite, entity.x, entity.y, entity.width, entity.height);
            } else {
                // Fallback to colored rectangle
                this.ctx.fillStyle = entity.color;
                this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
            }

            // Debug text disabled by default
            if (false) { // Enable for debugging
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '8px Arial';
                this.ctx.fillText(entity.type, entity.x, entity.y - 5);
            }
        });

        // Draw UI
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('🎮 Game Engine Preview', 10, 25);
        this.ctx.font = '12px Arial';
        this.ctx.fillText('WASD/Arrows: Move | Space: Jump', 10, 45);
    }

    clear() {
        this.entities = [];
        this.player = null;
    }
}

// Make it available globally
(window as any).SimpleGameEngine = SimpleGameEngine;