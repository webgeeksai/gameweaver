/**
 * Complete Full-Fledged Browser Game Engine
 * Comprehensive implementation supporting all game behaviors and systems
 */

import { 
    UIManager, 
    AudioManager, 
    PhysicsManager, 
    BehaviorManager, 
    AnimationManager, 
    InputManager, 
    SaveManager, 
    QuestManager, 
    CombatManager, 
    SceneManager, 
    TimeManager 
} from './GameManagers';

export interface GameEntity {
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    physics: PhysicsData;
    behavior?: BehaviorData;
    tilemap?: TilemapData;
    animation?: AnimationData;
    ui?: UIData;
    audio?: AudioData;
    health?: number;
    maxHealth?: number;
    level?: number;
    experience?: number;
    inventory?: InventoryItem[];
    stats?: EntityStats;
    state?: EntityState;
    visible: boolean;
    active: boolean;
}

export interface PhysicsData {
    mode: 'static' | 'dynamic' | 'topdown' | 'platformer' | 'flying' | 'swimming';
    vx: number;
    vy: number;
    mass?: number;
    friction?: number;
    gravity?: number;
    maxSpeed?: number;
    acceleration?: number;
    jumpPower?: number;
    inWater?: boolean;
    onGround?: boolean;
}

export interface BehaviorData {
    type: string;
    properties: { [key: string]: any };
    state: { [key: string]: any };
    timers: { [key: string]: number };
    flags: { [key: string]: boolean };
}

export interface TilemapData {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
    tiles: number[];
    collisionMap?: boolean[];
    properties?: { [key: string]: any };
}

export interface AnimationData {
    currentAnimation: string;
    frame: number;
    frameTime: number;
    animations: { [key: string]: AnimationSequence };
    playing: boolean;
    loop: boolean;
    speed: number;
}

export interface AnimationSequence {
    frames: number[] | string[];
    frameRate: number;
    loop: boolean;
    onComplete?: string;
}

export interface UIData {
    type: 'healthbar' | 'minimap' | 'inventory' | 'dialogue' | 'menu' | 'notification';
    position: { x: number; y: number };
    size: { width: number; height: number };
    visible: boolean;
    properties: { [key: string]: any };
    content: any;
}

export interface AudioData {
    type: 'music' | 'sfx' | 'voice' | 'ambient';
    file: string;
    volume: number;
    loop: boolean;
    playing: boolean;
    position?: { x: number; y: number };
    radius?: number;
    fadeIn?: number;
    fadeOut?: number;
}

export interface InventoryItem {
    id: string;
    name: string;
    type: string;
    quantity: number;
    description: string;
    icon: string;
    usable: boolean;
    stackable: boolean;
    value: number;
}

export interface EntityStats {
    health: number;
    maxHealth: number;
    stamina: number;
    maxStamina: number;
    mana: number;
    maxMana: number;
    attack: number;
    defense: number;
    speed: number;
    level: number;
    experience: number;
    experienceToNext: number;
}

export interface EntityState {
    current: string;
    previous: string;
    timer: number;
    data: { [key: string]: any };
}

export interface GameWorld {
    entities: Map<string, GameEntity>;
    tilemap?: TilemapData;
    camera: Camera;
    ui: UIManager;
    audio: AudioManager;
    physics: PhysicsManager;
    behavior: BehaviorManager;
    animation: AnimationManager;
    input: InputManager;
    save: SaveManager;
    quest: QuestManager;
    combat: CombatManager;
    scene: SceneManager;
    time: TimeManager;
}

export interface Camera {
    x: number;
    y: number;
    zoom: number;
    target?: string;
    followSpeed: number;
    shake: { x: number; y: number; duration: number };
    bounds?: { x: number; y: number; width: number; height: number };
}

export class FullGameEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private world!: GameWorld;
    private running: boolean = false;
    private debugMode: boolean = false;
    private keys: { [key: string]: boolean } = {};
    private lastTime: number = 0;
    private deltaTime: number = 0;
    private frameCount: number = 0;
    private fps: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.initializeWorld();
        this.setupInput();
        this.log('🎮 Full Game Engine initialized');
    }

    private initializeWorld(): void {
        this.world = {
            entities: new Map(),
            camera: {
                x: 0,
                y: 0,
                zoom: 1,
                followSpeed: 0.1,
                shake: { x: 0, y: 0, duration: 0 }
            },
            ui: new UIManager(this.canvas, this.ctx),
            audio: new AudioManager(),
            physics: new PhysicsManager(),
            behavior: new BehaviorManager(),
            animation: new AnimationManager(),
            input: new InputManager(),
            save: new SaveManager(),
            quest: new QuestManager(),
            combat: new CombatManager(),
            scene: new SceneManager(),
            time: new TimeManager()
        };
    }

    private setupInput(): void {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.world.input.handleKeyDown(e.key, e);
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.world.input.handleKeyUp(e.key, e);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            this.world.input.handleMouseDown(e);
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this.world.input.handleMouseUp(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.world.input.handleMouseMove(e);
        });
    }

    public async loadGDL(gdlContent: string): Promise<void> {
        try {
            this.log('📡 Loading comprehensive GDL content...');
            await this.parseAdvancedGDL(gdlContent);
            this.log('✅ Advanced GDL loaded successfully');
        } catch (error) {
            this.log(`❌ Error loading GDL: ${error}`);
            this.createDemoWorld();
        }
    }

    private async parseAdvancedGDL(content: string): Promise<void> {
        this.log('🔧 Parsing advanced GDL content...');
        
        // Parse scenes
        const sceneMatches = content.match(/scene\\s+(\\w+)\\s*\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)\\}/g) || [];
        
        for (const sceneBlock of sceneMatches) {
            await this.parseScene(sceneBlock);
        }

        // Parse entities within scenes
        const entityMatches = content.match(/entity\\s+(\\w+)\\s*\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}/g) || [];
        
        for (const entityBlock of entityMatches) {
            const entity = await this.parseAdvancedEntity(entityBlock);
            if (entity) {
                this.world.entities.set(entity.id, entity);
                this.log(`✅ Created advanced entity: ${entity.name}`);
            }
        }

        this.log(`🎭 Loaded ${this.world.entities.size} entities with full features`);
    }

    private async parseScene(sceneBlock: string): Promise<void> {
        const nameMatch = sceneBlock.match(/scene\\s+(\\w+)/);
        if (!nameMatch) return;

        const sceneName = nameMatch[1];
        this.world.scene.addScene(sceneName, {
            name: sceneName,
            entities: [],
            tilemap: null,
            properties: {}
        });
    }

    private async parseAdvancedEntity(block: string): Promise<GameEntity | null> {
        // Extract entity name
        const nameMatch = block.match(/entity\\s+(\\w+)/);
        if (!nameMatch) return null;
        const name = nameMatch[1];

        // Parse transform
        let x = 100, y = 300;
        const transformMatch = block.match(/transform:\\s*\\{([^}]*)\\}/);
        if (transformMatch) {
            const transformContent = transformMatch[1];
            const xMatch = transformContent.match(/x:\\s*(\\d+)/);
            const yMatch = transformContent.match(/y:\\s*(\\d+)/);
            if (xMatch) x = parseInt(xMatch[1]);
            if (yMatch) y = parseInt(yMatch[1]);
        }

        // Parse sprite with advanced features
        let width = 32, height = 32, color = '#4A90E2';
        const spriteMatch = block.match(/sprite:\\s*\\{([^}]*)\\}/);
        if (spriteMatch) {
            const spriteContent = spriteMatch[1];
            const widthMatch = spriteContent.match(/width:\\s*(\\d+)/);
            const heightMatch = spriteContent.match(/height:\\s*(\\d+)/);
            const colorMatch = spriteContent.match(/color:\\s*["']([^"']+)["']/);
            if (widthMatch) width = parseInt(widthMatch[1]);
            if (heightMatch) height = parseInt(heightMatch[1]);
            if (colorMatch) color = colorMatch[1];
        }

        // Parse physics with all modes
        const physics: PhysicsData = this.parsePhysics(block);

        // Parse behavior with full system
        const behavior = this.parseBehavior(block);

        // Parse tilemap if present
        const tilemap = this.parseTilemap(block);

        // Parse animations
        const animation = this.parseAnimation(block);

        // Parse UI elements
        const ui = this.parseUI(block);

        // Parse audio
        const audio = this.parseAudio(block);

        // Determine entity type and set defaults
        const type = this.determineEntityType(name, behavior);

        const entity: GameEntity = {
            id: `${name}_${Date.now()}`,
            name,
            type,
            x,
            y,
            width,
            height,
            color,
            physics,
            behavior,
            tilemap,
            animation,
            ui,
            audio,
            health: 100,
            maxHealth: 100,
            level: 1,
            experience: 0,
            inventory: [],
            stats: this.createDefaultStats(),
            state: { current: 'idle', previous: 'idle', timer: 0, data: {} },
            visible: true,
            active: true
        };

        return entity;
    }

    private parsePhysics(block: string): PhysicsData {
        const physicsMatch = block.match(/physics:\\s*\\{([^}]*)\\}/);
        if (!physicsMatch) {
            return { mode: 'static', vx: 0, vy: 0 };
        }

        const physicsContent = physicsMatch[1];
        const modeMatch = physicsContent.match(/mode:\\s*["']([^"']+)["']/);
        const massMatch = physicsContent.match(/mass:\\s*(\\d+(?:\\.\\d+)?)/);
        const frictionMatch = physicsContent.match(/friction:\\s*(\\d+(?:\\.\\d+)?)/);

        return {
            mode: (modeMatch?.[1] as any) || 'static',
            vx: 0,
            vy: 0,
            mass: massMatch ? parseFloat(massMatch[1]) : 1,
            friction: frictionMatch ? parseFloat(frictionMatch[1]) : 0.8,
            maxSpeed: 300,
            acceleration: 500
        };
    }

    private parseBehavior(block: string): BehaviorData | undefined {
        const behaviorMatch = block.match(/behavior:\\s*(\\w+)\\s*\\{([^}]*)\\}/);
        if (!behaviorMatch) return undefined;

        const behaviorType = behaviorMatch[1];
        const behaviorContent = behaviorMatch[2];
        
        return {
            type: behaviorType,
            properties: this.parseBehaviorProperties(behaviorContent),
            state: {},
            timers: {},
            flags: {}
        };
    }

    private parseBehaviorProperties(content: string): { [key: string]: any } {
        const properties: { [key: string]: any } = {};
        
        // Parse different property types
        const stringProps = content.match(/(\w+):\s*["']([^"']+)["']/g) || [];
        const numberProps = content.match(/(\w+):\s*(\d+(?:\.\d+)?)/g) || [];
        const booleanProps = content.match(/(\w+):\s*(true|false)/g) || [];
        const arrayProps = content.match(/(\w+):\s*\[([^\]]*)\]/g) || [];

        stringProps.forEach(prop => {
            const match = prop.match(/(\w+):\s*["']([^"']+)["']/);
            if (match) properties[match[1]] = match[2];
        });

        numberProps.forEach(prop => {
            const match = prop.match(/(\w+):\s*(\d+(?:\.\d+)?)/);
            if (match) properties[match[1]] = parseFloat(match[2]);
        });

        booleanProps.forEach(prop => {
            const match = prop.match(/(\w+):\s*(true|false)/);
            if (match) properties[match[1]] = match[2] === 'true';
        });

        arrayProps.forEach(prop => {
            const match = prop.match(/(\w+):\s*\[([^\]]*)\]/);
            if (match) {
                const items = match[2].split(',').map(item => 
                    item.trim().replace(/["']/g, '')
                );
                properties[match[1]] = items;
            }
        });

        return properties;
    }

    private parseTilemap(block: string): TilemapData | undefined {
        const tilemapMatch = block.match(/tilemap:\s*\{([^}]*)\}/);
        if (!tilemapMatch) return undefined;

        const tilemapContent = tilemapMatch[1];
        const widthMatch = tilemapContent.match(/width:\s*(\d+)/);
        const heightMatch = tilemapContent.match(/height:\s*(\d+)/);
        const tileWidthMatch = tilemapContent.match(/tileWidth:\s*(\d+)/);
        const tileHeightMatch = tilemapContent.match(/tileHeight:\s*(\d+)/);

        if (!widthMatch || !heightMatch || !tileWidthMatch || !tileHeightMatch) {
            return undefined;
        }

        const width = parseInt(widthMatch[1]);
        const height = parseInt(heightMatch[1]);

        return {
            width,
            height,
            tileWidth: parseInt(tileWidthMatch[1]),
            tileHeight: parseInt(tileHeightMatch[1]),
            tiles: this.generateTiles(width, height)
        };
    }

    private parseAnimation(block: string): AnimationData | undefined {
        const animMatch = block.match(/animations:\\s*\\{([^}]*)\\}/);
        if (!animMatch) return undefined;

        return {
            currentAnimation: 'idle',
            frame: 0,
            frameTime: 0,
            animations: {
                idle: { frames: [0], frameRate: 1, loop: true }
            },
            playing: true,
            loop: true,
            speed: 1
        };
    }

    private parseUI(block: string): UIData | undefined {
        const uiMatch = block.match(/behavior:\\s*UI(\\w+)/);
        if (!uiMatch) return undefined;

        return {
            type: uiMatch[1].toLowerCase() as any,
            position: { x: 0, y: 0 },
            size: { width: 100, height: 20 },
            visible: true,
            properties: {},
            content: null
        };
    }

    private parseAudio(block: string): AudioData | undefined {
        const audioMatch = block.match(/sound:\\s*["']([^"']+)["']/);
        if (!audioMatch) return undefined;

        return {
            type: 'sfx',
            file: audioMatch[1],
            volume: 1,
            loop: false,
            playing: false
        };
    }

    private determineEntityType(name: string, behavior?: BehaviorData): string {
        const lowerName = name.toLowerCase();
        
        if (behavior) {
            const behaviorType = behavior.type.toLowerCase();
            if (behaviorType.includes('npc') || behaviorType.includes('dialogue')) return 'npc';
            if (behaviorType.includes('creature') || behaviorType.includes('wild')) return 'creature';
            if (behaviorType.includes('collectible') || behaviorType.includes('item')) return 'collectible';
            if (behaviorType.includes('ui')) return 'ui';
        }

        if (lowerName.includes('player') || lowerName.includes('trainer')) return 'player';
        if (lowerName.includes('npc') || lowerName.includes('elder') || lowerName.includes('shop')) return 'npc';
        if (lowerName.includes('wild') || lowerName.includes('creature')) return 'creature';
        if (lowerName.includes('tilemap')) return 'tilemap';
        if (lowerName.includes('wall') || lowerName.includes('platform')) return 'platform';
        if (lowerName.includes('item') || lowerName.includes('coin') || lowerName.includes('potion')) return 'collectible';

        return 'sprite';
    }

    private createDefaultStats(): EntityStats {
        return {
            health: 100,
            maxHealth: 100,
            stamina: 100,
            maxStamina: 100,
            mana: 50,
            maxMana: 50,
            attack: 10,
            defense: 5,
            speed: 150,
            level: 1,
            experience: 0,
            experienceToNext: 100
        };
    }

    private generateTiles(width: number, height: number): number[] {
        const tiles: number[] = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                    tiles.push(1); // Wall
                } else if (x < 3 || y < 3 || x > width - 4 || y > height - 4) {
                    tiles.push(2); // Stone
                } else if (x < 6 || y < 6 || x > width - 7 || y > height - 7) {
                    tiles.push(3); // Wood
                } else {
                    tiles.push(4); // Grass
                }
            }
        }
        return tiles;
    }

    private createDemoWorld(): void {
        this.log('🎭 Creating advanced demo world...');
        
        // Create demo entities with all features
        const player: GameEntity = {
            id: 'player_1',
            name: 'Player',
            type: 'player',
            x: 400,
            y: 300,
            width: 32,
            height: 32,
            color: '#4A90E2',
            physics: { mode: 'topdown', vx: 0, vy: 0, maxSpeed: 200 },
            stats: this.createDefaultStats(),
            state: { current: 'idle', previous: 'idle', timer: 0, data: {} },
            inventory: [],
            visible: true,
            active: true
        };

        this.world.entities.set(player.id, player);
        this.world.camera.target = player.id;
    }

    public start(): void {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.log('🚀 Full Game Engine started');
        this.gameLoop();
    }

    public stop(): void {
        this.running = false;
        this.log('⏸️ Full Game Engine stopped');
    }

    private gameLoop(): void {
        if (!this.running) return;

        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1 / this.deltaTime);
        }

        this.update(this.deltaTime);
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    private update(deltaTime: number): void {
        // Update all game systems
        this.world.time.update(deltaTime);
        this.world.input.update(deltaTime);
        this.world.physics.update(this.world.entities, deltaTime);
        this.world.behavior.update(this.world.entities, deltaTime, this.world);
        this.world.animation.update(this.world.entities, deltaTime);
        this.world.audio.update(deltaTime);
        this.world.combat.update(this.world.entities, deltaTime);
        this.world.quest.update(deltaTime);
        this.updateCamera(deltaTime);
    }

    private updateCamera(deltaTime: number): void {
        if (this.world.camera.target) {
            const target = this.world.entities.get(this.world.camera.target);
            if (target) {
                const targetX = target.x - this.canvas.width / 2;
                const targetY = target.y - this.canvas.height / 2;
                
                this.world.camera.x += (targetX - this.world.camera.x) * this.world.camera.followSpeed;
                this.world.camera.y += (targetY - this.world.camera.y) * this.world.camera.followSpeed;
            }
        }

        // Update camera shake
        if (this.world.camera.shake.duration > 0) {
            this.world.camera.shake.duration -= deltaTime * 1000;
            this.world.camera.shake.x = (Math.random() - 0.5) * 10;
            this.world.camera.shake.y = (Math.random() - 0.5) * 10;
        } else {
            this.world.camera.shake.x = 0;
            this.world.camera.shake.y = 0;
        }
    }

    private render(): void {
        // Clear canvas
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply camera transform
        this.ctx.save();
        this.ctx.translate(
            -this.world.camera.x + this.world.camera.shake.x,
            -this.world.camera.y + this.world.camera.shake.y
        );
        this.ctx.scale(this.world.camera.zoom, this.world.camera.zoom);

        // Render tilemap first
        this.renderTilemaps();

        // Render entities by depth order
        const sortedEntities = Array.from(this.world.entities.values())
            .filter(entity => entity.visible)
            .sort((a, b) => {
                const order = { tilemap: 0, platform: 1, collectible: 2, npc: 3, creature: 4, player: 5 };
                return (order[a.type as keyof typeof order] || 3) - (order[b.type as keyof typeof order] || 3);
            });

        sortedEntities.forEach(entity => this.renderEntity(entity));

        this.ctx.restore();

        // Render UI last (always on top)
        this.world.ui.render(this.world.entities);
        this.renderDebugInfo();
    }

    private renderTilemaps(): void {
        for (const entity of this.world.entities.values()) {
            if (entity.type === 'tilemap' && entity.tilemap) {
                this.renderTilemap(entity);
            }
        }
    }

    private renderTilemap(entity: GameEntity): void {
        const tilemap = entity.tilemap!;
        const tileColors = {
            1: '#696969', 2: '#A9A9A9', 3: '#8B4513', 4: '#228B22'
        };

        for (let y = 0; y < tilemap.height; y++) {
            for (let x = 0; x < tilemap.width; x++) {
                const tileIndex = y * tilemap.width + x;
                const tileType = tilemap.tiles[tileIndex];
                
                if (tileType > 0) {
                    const tileX = entity.x + x * tilemap.tileWidth;
                    const tileY = entity.y + y * tilemap.tileHeight;
                    
                    this.ctx.fillStyle = tileColors[tileType as keyof typeof tileColors] || '#999';
                    this.ctx.fillRect(tileX, tileY, tilemap.tileWidth, tilemap.tileHeight);
                    
                    this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                    this.ctx.lineWidth = 0.5;
                    this.ctx.strokeRect(tileX, tileY, tilemap.tileWidth, tilemap.tileHeight);
                }
            }
        }
    }

    private renderEntity(entity: GameEntity): void {
        if (!entity.visible) return;

        this.ctx.fillStyle = entity.color;

        // Render based on entity type
        switch (entity.type) {
            case 'player':
                this.renderPlayer(entity);
                break;
            case 'npc':
                this.renderNPC(entity);
                break;
            case 'creature':
                this.renderCreature(entity);
                break;
            case 'collectible':
                this.renderCollectible(entity);
                break;
            default:
                this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
                break;
        }

        // Render debug info if enabled
        if (this.debugMode) {
            this.renderEntityDebug(entity);
        }
    }

    private renderPlayer(entity: GameEntity): void {
        // Player body
        this.ctx.fillStyle = entity.color;
        this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        
        // Simple face
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(entity.x + 8, entity.y + 8, 4, 4);
        this.ctx.fillRect(entity.x + 20, entity.y + 8, 4, 4);
        this.ctx.fillRect(entity.x + 12, entity.y + 20, 8, 2);

        // Health bar above player
        if (entity.stats) {
            this.renderHealthBar(entity.x, entity.y - 10, entity.width, 4, entity.stats.health, entity.stats.maxHealth);
        }
    }

    private renderNPC(entity: GameEntity): void {
        // NPC body
        this.ctx.fillStyle = entity.color;
        this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        
        // NPC indicator (golden exclamation mark)
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(entity.x + entity.width/2, entity.y - 8, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 8px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('!', entity.x + entity.width/2, entity.y - 5);
    }

    private renderCreature(entity: GameEntity): void {
        // Creature body
        this.ctx.fillStyle = entity.color;
        this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        
        // Simple creature eyes
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(entity.x + 4, entity.y + 4, 3, 3);
        this.ctx.fillRect(entity.x + entity.width - 7, entity.y + 4, 3, 3);

        // Movement trail effect
        if (entity.physics.vx !== 0 || entity.physics.vy !== 0) {
            this.ctx.fillStyle = entity.color + '40';
            this.ctx.fillRect(entity.x - entity.physics.vx * 0.1, entity.y - entity.physics.vy * 0.1, entity.width, entity.height);
        }
    }

    private renderCollectible(entity: GameEntity): void {
        const time = Date.now() * 0.005;
        const glowAlpha = 0.3 + Math.sin(time) * 0.2;
        
        // Glow effect
        this.ctx.fillStyle = entity.color + Math.floor(glowAlpha * 255).toString(16).padStart(2, '0');
        this.ctx.fillRect(entity.x - 2, entity.y - 2, entity.width + 4, entity.height + 4);
        
        // Main item
        this.ctx.fillStyle = entity.color;
        this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        
        // Sparkle effect
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(entity.x + entity.width/2, entity.y + entity.height/2, 2, 0, Math.PI * 2);
        this.ctx.fill();
    }

    private renderHealthBar(x: number, y: number, width: number, height: number, health: number, maxHealth: number): void {
        // Background
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(x, y, width, height);
        
        // Health
        this.ctx.fillStyle = '#00FF00';
        const healthWidth = (health / maxHealth) * width;
        this.ctx.fillRect(x, y, healthWidth, height);
        
        // Border
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);
    }

    private renderEntityDebug(entity: GameEntity): void {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(entity.name, entity.x, entity.y - 15);
        
        if (entity.behavior) {
            this.ctx.fillText(entity.behavior.type, entity.x, entity.y + entity.height + 15);
        }
        
        // Physics debug
        if (entity.physics.vx !== 0 || entity.physics.vy !== 0) {
            this.ctx.strokeStyle = '#FF00FF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(entity.x + entity.width/2, entity.y + entity.height/2);
            this.ctx.lineTo(
                entity.x + entity.width/2 + entity.physics.vx * 0.1,
                entity.y + entity.height/2 + entity.physics.vy * 0.1
            );
            this.ctx.stroke();
        }
    }

    private renderDebugInfo(): void {
        if (!this.debugMode) return;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(10, 10, 200, 120);
        
        this.ctx.fillStyle = '#00FF00';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        
        const lines = [
            `FPS: ${this.fps}`,
            `Entities: ${this.world.entities.size}`,
            `Camera: (${Math.round(this.world.camera.x)}, ${Math.round(this.world.camera.y)})`,
            `Zoom: ${this.world.camera.zoom.toFixed(2)}`,
            `Time: ${this.world.time.getFormattedTime()}`,
            `Debug Mode: ON`
        ];

        lines.forEach((line, index) => {
            this.ctx.fillText(line, 15, 25 + index * 15);
        });
    }

    public toggleDebug(): void {
        this.debugMode = !this.debugMode;
        this.log(`🐛 Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
    }

    public getWorld(): GameWorld {
        return this.world;
    }

    public getEntity(id: string): GameEntity | undefined {
        return this.world.entities.get(id);
    }

    public addEntity(entity: GameEntity): void {
        this.world.entities.set(entity.id, entity);
    }

    public removeEntity(id: string): void {
        this.world.entities.delete(id);
    }

    private log(message: string): void {
        const logDiv = document.getElementById('gameLog');
        if (logDiv) {
            const time = new Date().toLocaleTimeString();
            logDiv.innerHTML += `<div>[${time}] ${message}</div>`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        console.log('[FullGameEngine]', message);
    }
}