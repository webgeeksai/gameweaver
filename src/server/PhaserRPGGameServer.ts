/**
 * Enhanced Game Server for Phaser RPG Demo
 * Supports advanced features like sprite atlases, layered tilemaps, and animations
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class PhaserRPGGameServer {
    private server: http.Server | null = null;
    private port: number = 3000;

    constructor() {
        this.port = this.findAvailablePort();
    }

    private findAvailablePort(): number {
        return 3000 + Math.floor(Math.random() * 1000);
    }

    async start(gdlContent: string, workspaceRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, gdlContent, workspaceRoot);
            });

            this.server.listen(this.port, () => {
                const url = `http://localhost:${this.port}`;
                console.log(`🚀 Phaser RPG GameServer started at ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                console.error('GameServer error:', error);
                reject(error);
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('🛑 Phaser RPG GameServer stopped');
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, gdlContent: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`📡 Request: ${req.method} ${url}`);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (url === '/') {
            this.serveGameHTML(res, gdlContent);
        } else if (url === '/api/gdl') {
            this.serveGDLData(res, gdlContent);
        } else if (url === '/api/tilemap') {
            this.serveTilemapData(res, workspaceRoot);
        } else if (url === '/api/atlas') {
            this.serveAtlasData(res, workspaceRoot);
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    private serveGameHTML(res: http.ServerResponse, gdlContent: string): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏰 Phaser RPG Demo - GameWeaver</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #fff;
            overflow: hidden;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        .game-container {
            background: #000;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 10px;
            text-align: center;
            position: relative;
        }
        canvas {
            border: 1px solid #555;
            background: #87CEEB;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        }
        .controls {
            margin-top: 15px;
            padding: 15px;
            background: #2d2d2d;
            border-radius: 6px;
        }
        .btn {
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            margin: 0 5px;
            border-radius: 4px;
            cursor: pointer;
        }
        .btn:hover { background: #005a9e; }
        .btn:disabled { background: #555; cursor: not-allowed; }
        .info {
            margin-top: 15px;
            padding: 10px;
            background: #2d2d2d;
            border-radius: 6px;
            font-size: 14px;
        }
        .typewriter {
            position: absolute;
            top: 16px;
            left: 16px;
            background: rgba(255, 255, 255, 0.95);
            color: #000;
            font: 18px monospace;
            padding: 20px;
            border-radius: 4px;
            max-width: 400px;
            display: none;
            z-index: 1000;
        }
        .log {
            max-height: 150px;
            overflow-y: auto;
            background: #1a1a1a;
            padding: 10px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏰 Phaser RPG Demo - Enhanced GameWeaver Engine</h1>
            <p>Complete reproduction of the Phaser RPG using our GDL and game engine</p>
        </div>
        
        <div class="game-container">
            <div class="typewriter" id="typewriter"></div>
            <canvas id="gameCanvas" width="800" height="600"></canvas>
            
            <div class="controls">
                <button id="playBtn" class="btn">▶️ Play</button>
                <button id="pauseBtn" class="btn" disabled>⏸️ Pause</button>
                <button id="reloadBtn" class="btn">🔄 Reload</button>
                <button id="debugBtn" class="btn">🐛 Debug</button>
            </div>
            
            <div class="info">
                <strong>Controls:</strong> WASD or Arrow keys to move | Space to interact with signs | ESC for menu
                <br><strong>Features:</strong> Layered tilemap, sprite animations, interaction system, camera following
            </div>
            
            <div class="log" id="gameLog">
                <div>🏰 Initializing Enhanced Phaser RPG engine...</div>
            </div>
        </div>
    </div>

    <script>
        // Enhanced Game Engine for Phaser RPG Demo
        class PhaserRPGEngine {
            constructor(canvas) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.entities = new Map();
                this.running = false;
                this.debugMode = false;
                this.keys = {};
                this.lastTime = 0;
                this.camera = { x: 0, y: 0, zoom: 1 };
                this.world = {
                    camera: this.camera,
                    canvas: canvas,
                    input: this,
                    ui: {
                        showTypewriter: false,
                        typewriterText: '',
                        typewriterFullText: '',
                        typewriterIndex: 0,
                        typewriterTimer: 0,
                        typewriterHideTimer: 0
                    },
                    state: {
                        isTypewriting: false
                    },
                    physics: {
                        getWorldBounds: () => ({ width: 800 * 25, height: 600 * 40 }) // Tilemap size
                    }
                };
                this.tilemap = null;
                this.atlas = null;
                
                this.setupInput();
                this.log('🎮 Enhanced Phaser RPG Engine initialized');
            }

            log(message) {
                const logDiv = document.getElementById('gameLog');
                const time = new Date().toLocaleTimeString();
                logDiv.innerHTML += \`<div>[\${time}] \${message}</div>\`;
                logDiv.scrollTop = logDiv.scrollHeight;
                console.log(message);
            }

            isKeyPressed(key) {
                return this.keys[key.toLowerCase()] || false;
            }

            async loadAssets() {
                try {
                    this.log('📡 Loading tilemap data...');
                    const tilemapResponse = await fetch('/api/tilemap');
                    this.tilemap = await tilemapResponse.json();
                    this.log(\`📍 Tilemap loaded: \${this.tilemap.width}x\${this.tilemap.height}\`);

                    this.log('🎨 Loading sprite atlas...');
                    const atlasResponse = await fetch('/api/atlas');
                    this.atlas = await atlasResponse.json();
                    this.log(\`🖼️ Atlas loaded with \${Object.keys(this.atlas.frames).length} frames\`);

                    this.log('📝 Loading GDL content...');
                    const gdlResponse = await fetch('/api/gdl');
                    const gdlText = await gdlResponse.text();
                    this.parseGDL(gdlText);
                } catch (error) {
                    this.log(\`❌ Error loading assets: \${error.message}\`);
                }
            }

            parseGDL(content) {
                this.log('🔧 Parsing GDL content...');
                this.entities.clear();

                // Create tilemap entity
                if (this.tilemap) {
                    const tilemapEntity = {
                        id: 'worldTilemap',
                        name: 'WorldTilemap',
                        type: 'tilemap',
                        x: 0,
                        y: 0,
                        width: this.tilemap.width * 32,
                        height: this.tilemap.height * 32,
                        color: 'transparent',
                        physics: { mode: 'static', vx: 0, vy: 0 },
                        tilemap: {
                            width: this.tilemap.width,
                            height: this.tilemap.height,
                            tileWidth: 32,
                            tileHeight: 32,
                            layers: this.processTilemapLayers()
                        },
                        behavior: {
                            type: 'TilemapLayer',
                            properties: {},
                            state: {}
                        },
                        visible: true,
                        active: true
                    };
                    this.entities.set('worldTilemap', tilemapEntity);
                }

                // Create player entity
                const spawnPoint = this.findSpawnPoint();
                const playerEntity = {
                    id: 'player',
                    name: 'Player',
                    type: 'player',
                    x: spawnPoint.x,
                    y: spawnPoint.y,
                    width: 32,
                    height: 42,
                    color: '#4169E1',
                    physics: { mode: 'topdown', vx: 0, vy: 0 },
                    behavior: {
                        type: 'PhaserRPGPlayer',
                        properties: {},
                        state: { facing: 'down', spawned: true }
                    },
                    animation: {
                        currentAnimation: 'idle_down',
                        playing: false,
                        frame: 0,
                        frameTime: 0
                    },
                    visible: true,
                    active: true
                };
                this.entities.set('player', playerEntity);

                // Process objects from tilemap
                this.processObjectLayer();

                this.log(\`✅ Created \${this.entities.size} entities\`);
            }

            processTilemapLayers() {
                const layers = {};
                
                if (this.tilemap.layers) {
                    this.tilemap.layers.forEach(layer => {
                        layers[layer.name] = {
                            name: layer.name,
                            data: layer.data,
                            width: layer.width,
                            height: layer.height,
                            opacity: layer.opacity || 1,
                            visible: layer.visible !== false
                        };
                    });
                }
                
                return layers;
            }

            findSpawnPoint() {
                // Find spawn point from object layer
                if (this.tilemap.layers) {
                    const objectLayer = this.tilemap.layers.find(l => l.name === 'Objects');
                    if (objectLayer && objectLayer.objects) {
                        const spawn = objectLayer.objects.find(obj => 
                            obj.name === 'Spawn Point' || obj.type === 'SpawnPoint'
                        );
                        if (spawn) {
                            return { x: spawn.x, y: spawn.y };
                        }
                    }
                }
                // Default spawn point
                return { x: 400, y: 300 };
            }

            processObjectLayer() {
                if (!this.tilemap.layers) return;
                
                const objectLayer = this.tilemap.layers.find(l => l.name === 'Objects');
                if (!objectLayer || !objectLayer.objects) return;

                objectLayer.objects.forEach(obj => {
                    if (obj.name === 'Sign' || obj.type === 'Sign') {
                        const signText = obj.properties?.find(p => p.name === 'text')?.value || 'A mysterious sign...';
                        const signEntity = {
                            id: \`sign_\${obj.x}_\${obj.y}\`,
                            name: 'Sign',
                            type: 'sign',
                            x: obj.x,
                            y: obj.y,
                            width: obj.width || 32,
                            height: obj.height || 32,
                            color: 'transparent',
                            physics: { mode: 'static', vx: 0, vy: 0 },
                            behavior: {
                                type: 'InteractableSignEnhanced',
                                properties: { text: signText },
                                state: {}
                            },
                            visible: false,
                            active: true
                        };
                        this.entities.set(signEntity.id, signEntity);
                    }
                });
            }

            setupInput() {
                document.addEventListener('keydown', (e) => {
                    this.keys[e.key.toLowerCase()] = true;
                    if (e.key === ' ') e.preventDefault();
                });

                document.addEventListener('keyup', (e) => {
                    this.keys[e.key.toLowerCase()] = false;
                });
            }

            start() {
                if (this.running) return;
                this.running = true;
                this.log('🚀 Phaser RPG started');
                this.lastTime = performance.now();
                this.gameLoop();
            }

            stop() {
                this.running = false;
                this.log('⏸️ Game paused');
            }

            gameLoop() {
                if (!this.running) return;

                const currentTime = performance.now();
                const deltaTime = (currentTime - this.lastTime) / 1000;
                this.lastTime = currentTime;

                this.update(deltaTime);
                this.render();
                requestAnimationFrame(() => this.gameLoop());
            }

            update(deltaTime) {
                // Update entities with behaviors
                for (const entity of this.entities.values()) {
                    if (entity.behavior && entity.active) {
                        this.updateBehavior(entity, deltaTime);
                    }
                }

                // Update UI systems
                this.updateTypewriter(deltaTime);
                this.updateCamera(deltaTime);
            }

            updateBehavior(entity, deltaTime) {
                const behaviorType = entity.behavior.type;
                
                switch (behaviorType) {
                    case 'PhaserRPGPlayer':
                        this.updatePlayerBehavior(entity, deltaTime);
                        break;
                    case 'InteractableSignEnhanced':
                        this.updateSignBehavior(entity, deltaTime);
                        break;
                    case 'TilemapLayer':
                        // Tilemap processing handled in parseGDL
                        break;
                }
            }

            updatePlayerBehavior(entity, deltaTime) {
                const speed = 175;
                const prevVx = entity.physics.vx;
                const prevVy = entity.physics.vy;

                entity.physics.vx = 0;
                entity.physics.vy = 0;

                let isMoving = false;
                let facing = entity.behavior.state.facing || 'down';

                // Horizontal movement (takes precedence)
                if (this.isKeyPressed('a') || this.isKeyPressed('arrowleft')) {
                    entity.physics.vx = -speed;
                    facing = 'left';
                    isMoving = true;
                } else if (this.isKeyPressed('d') || this.isKeyPressed('arrowright')) {
                    entity.physics.vx = speed;
                    facing = 'right';
                    isMoving = true;
                }

                // Vertical movement (only if no horizontal)
                if (!isMoving) {
                    if (this.isKeyPressed('w') || this.isKeyPressed('arrowup')) {
                        entity.physics.vy = -speed;
                        facing = 'up';
                        isMoving = true;
                    } else if (this.isKeyPressed('s') || this.isKeyPressed('arrowdown')) {
                        entity.physics.vy = speed;
                        facing = 'down';
                        isMoving = true;
                    }
                }

                // Normalize diagonal movement
                if (entity.physics.vx !== 0 && entity.physics.vy !== 0) {
                    const length = Math.sqrt(entity.physics.vx ** 2 + entity.physics.vy ** 2);
                    entity.physics.vx = (entity.physics.vx / length) * speed;
                    entity.physics.vy = (entity.physics.vy / length) * speed;
                }

                // Update position
                entity.x += entity.physics.vx * deltaTime;
                entity.y += entity.physics.vy * deltaTime;

                // Store facing direction
                entity.behavior.state.facing = facing;

                // Update selector position
                this.updateSelector(entity, facing);
            }

            updateSelector(entity, facing) {
                if (!entity.behavior.state.selector) {
                    entity.behavior.state.selector = { x: entity.x, y: entity.y, width: 16, height: 16 };
                }

                const selector = entity.behavior.state.selector;
                switch (facing) {
                    case 'left':
                        selector.x = entity.x - 19;
                        selector.y = entity.y + 14;
                        break;
                    case 'right':
                        selector.x = entity.x + 35;
                        selector.y = entity.y + 14;
                        break;
                    case 'up':
                        selector.x = entity.x + 8;
                        selector.y = entity.y - 18;
                        break;
                    case 'down':
                        selector.x = entity.x + 8;
                        selector.y = entity.y + 46;
                        break;
                }
            }

            updateSignBehavior(entity, deltaTime) {
                const player = this.entities.get('player');
                if (!player || !player.behavior?.state.selector) return;

                const selector = player.behavior.state.selector;
                const isOverlapping = this.checkOverlap(
                    selector.x, selector.y, selector.width, selector.height,
                    entity.x, entity.y, entity.width, entity.height
                );

                if (isOverlapping && this.isKeyPressed(' ') && !this.world.state.isTypewriting) {
                    if (!entity.behavior.state.lastInteraction || Date.now() - entity.behavior.state.lastInteraction > 1000) {
                        this.startTypewriter(entity.behavior.properties.text);
                        entity.behavior.state.lastInteraction = Date.now();
                    }
                }
            }

            checkOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
                return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
            }

            startTypewriter(text) {
                this.world.state.isTypewriting = true;
                this.world.ui.showTypewriter = true;
                this.world.ui.typewriterText = '';
                this.world.ui.typewriterFullText = text;
                this.world.ui.typewriterIndex = 0;
                this.world.ui.typewriterTimer = 0;
                this.world.ui.typewriterHideTimer = 0;
            }

            updateTypewriter(deltaTime) {
                if (!this.world.ui.showTypewriter) return;

                const ui = this.world.ui;
                
                if (ui.typewriterIndex < ui.typewriterFullText.length) {
                    ui.typewriterTimer += deltaTime * 1000;
                    
                    if (ui.typewriterTimer >= 100) {
                        ui.typewriterText += ui.typewriterFullText[ui.typewriterIndex];
                        ui.typewriterIndex++;
                        ui.typewriterTimer = 0;
                    }
                } else {
                    if (!ui.typewriterHideTimer) {
                        ui.typewriterHideTimer = 1500;
                    }
                    
                    ui.typewriterHideTimer -= deltaTime * 1000;
                    
                    if (ui.typewriterHideTimer <= 0) {
                        ui.showTypewriter = false;
                        ui.typewriterText = '';
                        ui.typewriterFullText = '';
                        ui.typewriterIndex = 0;
                        ui.typewriterTimer = 0;
                        ui.typewriterHideTimer = 0;
                        this.world.state.isTypewriting = false;
                    }
                }

                // Update typewriter UI
                const typewriterDiv = document.getElementById('typewriter');
                if (ui.showTypewriter) {
                    typewriterDiv.style.display = 'block';
                    typewriterDiv.textContent = ui.typewriterText;
                } else {
                    typewriterDiv.style.display = 'none';
                }
            }

            updateCamera(deltaTime) {
                const player = this.entities.get('player');
                if (!player) return;

                const targetX = player.x - this.canvas.width / 2;
                const targetY = player.y - this.canvas.height / 2;

                const worldBounds = this.world.physics.getWorldBounds();
                const boundedX = Math.max(0, Math.min(targetX, worldBounds.width - this.canvas.width));
                const boundedY = Math.max(0, Math.min(targetY, worldBounds.height - this.canvas.height));

                const followSpeed = 0.1;
                this.camera.x += (boundedX - this.camera.x) * followSpeed;
                this.camera.y += (boundedY - this.camera.y) * followSpeed;
            }

            render() {
                this.ctx.fillStyle = '#87CEEB';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

                this.ctx.save();
                this.ctx.translate(-this.camera.x, -this.camera.y);

                // Render tilemap layers in order
                const tilemapEntity = this.entities.get('worldTilemap');
                if (tilemapEntity && tilemapEntity.tilemap) {
                    this.renderTilemap(tilemapEntity);
                }

                // Render entities
                const sortedEntities = Array.from(this.entities.values())
                    .filter(e => e.visible && e.type !== 'tilemap')
                    .sort((a, b) => {
                        const order = { sign: 1, player: 2 };
                        return (order[a.type] || 3) - (order[b.type] || 3);
                    });

                for (const entity of sortedEntities) {
                    this.renderEntity(entity);
                }

                this.ctx.restore();

                // Render UI elements (fixed position)
                this.renderUI();
            }

            renderTilemap(entity) {
                const tilemap = entity.tilemap;
                if (!tilemap.layers) return;

                // Render layers in order: Below Player, World, Above Player
                const layerOrder = ['Below Player', 'World', 'Above Player'];
                
                for (const layerName of layerOrder) {
                    const layer = tilemap.layers[layerName];
                    if (!layer || !layer.visible) continue;

                    this.renderTilemapLayer(layer, tilemap.tileWidth, tilemap.tileHeight, entity.x, entity.y);
                }
            }

            renderTilemapLayer(layer, tileWidth, tileHeight, offsetX, offsetY) {
                if (!layer.data) return;

                const tilesPerRow = layer.width;
                
                for (let i = 0; i < layer.data.length; i++) {
                    const tileId = layer.data[i];
                    if (tileId === 0) continue;

                    const tileX = (i % tilesPerRow) * tileWidth + offsetX;
                    const tileY = Math.floor(i / tilesPerRow) * tileHeight + offsetY;

                    // Simple tile rendering (use colors for different tile types)
                    const tileColor = this.getTileColor(tileId);
                    this.ctx.fillStyle = tileColor;
                    this.ctx.fillRect(tileX, tileY, tileWidth, tileHeight);

                    // Add subtle tile borders
                    this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
                    this.ctx.lineWidth = 0.5;
                    this.ctx.strokeRect(tileX, tileY, tileWidth, tileHeight);
                }
            }

            getTileColor(tileId) {
                const tileColors = {
                    126: '#228B22', // Grass - Green
                    149: '#8B4513', // Wood - Brown
                    150: '#8B4513', // Wood - Brown
                    151: '#8B4513', // Wood - Brown
                    171: '#A9A9A9', // Stone - Gray
                    172: '#A9A9A9', // Stone - Gray
                    173: '#A9A9A9', // Stone - Gray
                    174: '#A9A9A9', // Stone - Gray
                    175: '#A9A9A9', // Stone - Gray
                    195: '#8B4513', // Wood - Brown
                    196: '#8B4513', // Wood - Brown
                    197: '#8B4513', // Wood - Brown
                    198: '#8B4513', // Wood - Brown
                    199: '#8B4513'  // Wood - Brown
                };
                return tileColors[tileId] || '#999999';
            }

            renderEntity(entity) {
                switch (entity.type) {
                    case 'player':
                        this.renderPlayer(entity);
                        break;
                    case 'sign':
                        if (this.debugMode) {
                            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                            this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
                        }
                        break;
                    default:
                        this.ctx.fillStyle = entity.color;
                        this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
                        break;
                }

                // Debug info
                if (this.debugMode) {
                    this.ctx.fillStyle = '#000';
                    this.ctx.font = '10px Arial';
                    this.ctx.fillText(entity.name, entity.x, entity.y - 5);

                    // Show player selector
                    if (entity.type === 'player' && entity.behavior?.state.selector) {
                        const sel = entity.behavior.state.selector;
                        this.ctx.strokeStyle = '#FF0000';
                        this.ctx.lineWidth = 2;
                        this.ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
                    }
                }
            }

            renderPlayer(entity) {
                // Simple player rendering (could be enhanced with actual sprite frames)
                this.ctx.fillStyle = entity.color;
                this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);

                // Add simple directional indicator
                const facing = entity.behavior?.state.facing || 'down';
                this.ctx.fillStyle = '#000';
                const centerX = entity.x + entity.width / 2;
                const centerY = entity.y + entity.height / 2;

                switch (facing) {
                    case 'up':
                        this.ctx.fillRect(centerX - 2, entity.y + 5, 4, 8);
                        break;
                    case 'down':
                        this.ctx.fillRect(centerX - 2, entity.y + entity.height - 13, 4, 8);
                        break;
                    case 'left':
                        this.ctx.fillRect(entity.x + 5, centerY - 2, 8, 4);
                        break;
                    case 'right':
                        this.ctx.fillRect(entity.x + entity.width - 13, centerY - 2, 8, 4);
                        break;
                }
            }

            renderUI() {
                // Game title
                this.ctx.fillStyle = '#000';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.fillText('🏰 Phaser RPG Demo - Enhanced Engine', 10, 25);
                
                // Controls
                this.ctx.font = '12px Arial';
                this.ctx.fillText('WASD: Move | SPACE: Interact | Camera follows player', 10, 45);
                
                // Entity count
                this.ctx.fillText('Entities: ' + this.entities.size, 10, 65);
                
                // Player info
                const player = this.entities.get('player');
                if (player) {
                    this.ctx.fillText('Player: (' + Math.floor(player.x) + ', ' + Math.floor(player.y) + ') facing ' + (player.behavior?.state.facing || 'unknown'), 10, 85);
                }
                
                // Camera info
                this.ctx.fillText('Camera: (' + Math.floor(this.camera.x) + ', ' + Math.floor(this.camera.y) + ')', 10, 105);
            }

            toggleDebug() {
                this.debugMode = !this.debugMode;
                this.log('🐛 Debug mode: ' + (this.debugMode ? 'ON' : 'OFF'));
            }
        }

        // Initialize game when page loads
        document.addEventListener('DOMContentLoaded', async () => {
            const canvas = document.getElementById('gameCanvas');
            const game = new PhaserRPGEngine(canvas);

            // Button handlers
            document.getElementById('playBtn').addEventListener('click', () => {
                game.start();
                document.getElementById('playBtn').disabled = true;
                document.getElementById('pauseBtn').disabled = false;
            });

            document.getElementById('pauseBtn').addEventListener('click', () => {
                game.stop();
                document.getElementById('playBtn').disabled = false;
                document.getElementById('pauseBtn').disabled = true;
            });

            document.getElementById('reloadBtn').addEventListener('click', () => {
                game.stop();
                setTimeout(async () => {
                    await game.loadAssets();
                    game.start();
                    document.getElementById('playBtn').disabled = true;
                    document.getElementById('pauseBtn').disabled = false;
                }, 500);
            });

            document.getElementById('debugBtn').addEventListener('click', () => {
                game.toggleDebug();
            });

            // Auto-load and start
            await game.loadAssets();
            setTimeout(() => {
                game.start();
                document.getElementById('playBtn').disabled = true;
                document.getElementById('pauseBtn').disabled = false;
            }, 1000);
        });
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    private serveGDLData(res: http.ServerResponse, gdlContent: string): void {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(gdlContent);
    }

    private serveTilemapData(res: http.ServerResponse, workspaceRoot: string): void {
        try {
            const tilemapPath = path.join(workspaceRoot, 'assets', 'phaser-rpg-assets', 'tilemaps', 'tuxemon-town.json');
            if (fs.existsSync(tilemapPath)) {
                const content = fs.readFileSync(tilemapPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(content);
            } else {
                res.writeHead(404);
                res.end('Tilemap not found');
            }
        } catch (error) {
            res.writeHead(500);
            res.end('Error serving tilemap');
        }
    }

    private serveAtlasData(res: http.ServerResponse, workspaceRoot: string): void {
        try {
            const atlasPath = path.join(workspaceRoot, 'assets', 'phaser-rpg-assets', 'atlas', 'atlas.json');
            if (fs.existsSync(atlasPath)) {
                const content = fs.readFileSync(atlasPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(content);
            } else {
                res.writeHead(404);
                res.end('Atlas not found');
            }
        } catch (error) {
            res.writeHead(500);
            res.end('Error serving atlas');
        }
    }

    private serveAsset(res: http.ServerResponse, url: string, workspaceRoot: string): void {
        try {
            const assetPath = path.join(workspaceRoot, url);
            if (fs.existsSync(assetPath)) {
                const ext = path.extname(assetPath).toLowerCase();
                let contentType = 'application/octet-stream';
                
                switch (ext) {
                    case '.png': contentType = 'image/png'; break;
                    case '.jpg': case '.jpeg': contentType = 'image/jpeg'; break;
                    case '.svg': contentType = 'image/svg+xml'; break;
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