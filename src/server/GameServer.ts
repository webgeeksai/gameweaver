/**
 * Local Development Server for GameWeaver
 * Serves the game in a browser window to bypass VS Code webview restrictions
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class GameServer {
    private server: http.Server | null = null;
    private port: number = 3000;

    constructor() {
        this.port = this.findAvailablePort();
    }

    private findAvailablePort(): number {
        // Start with 3000, increment if needed
        return 3000 + Math.floor(Math.random() * 1000);
    }

    async start(gdlContent: string, workspaceRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, gdlContent, workspaceRoot);
            });

            this.server.listen(this.port, () => {
                const url = `http://localhost:${this.port}`;
                console.log(`🚀 GameServer started at ${url}`);
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
            console.log('🛑 GameServer stopped');
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, gdlContent: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`📡 Request: ${req.method} ${url}`);

        // Set CORS headers to allow all origins
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
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else if (url === '/game-engine.js') {
            this.serveGameEngine(res);
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
    <title>GameWeaver - Browser Preview</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #fff;
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
        }
        canvas {
            border: 2px solid #333;
            background: #4a9;
        }
        .debug {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            font-size: 12px;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
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
        .btn:hover {
            background: #005a9e;
        }
        .btn:disabled {
            background: #555;
            cursor: not-allowed;
        }
        .info {
            margin-top: 15px;
            padding: 10px;
            background: #2d2d2d;
            border-radius: 6px;
            font-size: 14px;
        }
        .log {
            max-height: 200px;
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
            <h1>🎮 GameWeaver - Browser Preview</h1>
            <p>Your game is running in a real browser environment (no VS Code webview restrictions!)</p>
        </div>
        
        <div class="game-container">
            <canvas id="gameCanvas" width="800" height="600"></canvas>
            <div class="controls">
                🎮 Use WASD or Arrow Keys to move • Space to interact • Shift for debug
            </div>
        </div>
        
        <div class="debug" id="debug" style="display: none;">
            <div id="debugInfo">Debug Mode</div>
        </div>
    </div>

    <script>
        // Import the Full Game Engine
        // Note: In a real implementation, this would be properly imported
        
        // Complete Game Engine Implementation for Browser
        class RPGDemoEngine {
            constructor(canvas) {
                this.canvas = canvas;
                this.ctx = canvas.getContext('2d');
                this.width = canvas.width;
                this.height = canvas.height;
                
                // Game state
                this.assets = {};
                this.entities = [];
                this.camera = { x: 0, y: 0 };
                this.debugMode = false;
                this.running = false;
                
                // Input
                this.keys = {};
                this.setupInput();
                
                // Player
                this.player = null;
                
                // Tilemap
                this.tilemap = null;
                this.tilesets = {};
                
                console.log('🏰 RPG Demo Engine initialized');
                this.init();
            }

            async init() {
                await this.loadAssets();
                await this.loadGDL();
            }

            log(message) {
                const logDiv = document.getElementById('gameLog');
                if (logDiv) {
                    const time = new Date().toLocaleTimeString();
                    logDiv.innerHTML += \`<div>[\${time}] \${message}</div>\`;
                    logDiv.scrollTop = logDiv.scrollHeight;
                }
                console.log(message);
            }

            async loadAssets() {
                console.log('📦 Loading assets...');
                
                // Load atlas
                await this.loadAtlas('/assets/atlas/atlas.json');
                
                // Load tilemap
                await this.loadTilemap('/assets/tilemaps/tuxemon-town.json');
                
                // Load tileset
                await this.loadImage('/assets/tilesets/tuxemon-sample-32px-extruded.png', 'tileset');
                
                console.log('✅ Assets loaded');
            }

            async loadAtlas(atlasPath) {
                try {
                    const response = await fetch(atlasPath);
                    const atlasData = await response.json();
                    
                    // Load the atlas image
                    const img = new Image();
                    img.src = '/assets/atlas/atlas.png';
                    await new Promise(resolve => img.onload = resolve);
                    
                    this.assets.atlas = {
                        image: img,
                        frames: atlasData.frames
                    };
                    
                    console.log('📜 Atlas loaded with', Object.keys(atlasData.frames).length, 'frames');
                } catch (error) {
                    console.error('❌ Failed to load atlas:', error);
                }
            }

            async loadTilemap(tilemapPath) {
                try {
                    const response = await fetch(tilemapPath);
                    this.tilemap = await response.json();
                    console.log('🗺️ Tilemap loaded:', this.tilemap.width + 'x' + this.tilemap.height);
                } catch (error) {
                    console.error('❌ Failed to load tilemap:', error);
                }
            }

            async loadImage(src, key) {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        this.assets[key] = img;
                        resolve(img);
                    };
                    img.onerror = reject;
                    img.src = src;
                });
            }

            async loadGDL() {
                try {
                    this.log('📡 Loading GDL content...');
                    const response = await fetch('/api/gdl');
                    const gdlText = await response.text();
                    this.log(\`📝 GDL loaded: \${gdlText.length} characters\`);
                    this.parseGDL(gdlText);
                } catch (error) {
                    this.log(\`❌ Error loading GDL: \${error.message}\`);
                }
            }

            parseGDL(content) {
                console.log('🔧 Parsing GDL...');
                
                // Find spawn point from tilemap
                let spawnX = 640, spawnY = 640; // Default center position
                
                if (this.tilemap) {
                    const objectsLayer = this.tilemap.layers.find(l => l.name === 'Objects');
                    if (objectsLayer && objectsLayer.objects) {
                        const spawnPoint = objectsLayer.objects.find(obj => obj.name === 'Spawn Point');
                        if (spawnPoint) {
                            spawnX = spawnPoint.x;
                            spawnY = spawnPoint.y;
                            console.log('🎯 Found spawn point at', spawnX, spawnY);
                        }
                    }
                }
                
                // Create player entity at spawn point
                this.player = {
                    name: 'Player',
                    x: spawnX,
                    y: spawnY,
                    width: 32,
                    height: 48,
                    facing: 'down',
                    moving: false,
                    speed: 160,
                    currentAnimation: 'misa-front',
                    animationFrame: 0,
                    animationTime: 0,
                    frameRate: 10
                };
                
                console.log('👤 Player created at', this.player.x, this.player.y);
            }

            parseEntity(block) {
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

                // Parse sprite
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

                // Parse tilemap (for RPG world)
                let tilemap = null;
                const tilemapMatch = block.match(/tilemap:\\s*\\{([^}]+)\\}/);
                if (tilemapMatch) {
                    const tilemapContent = tilemapMatch[1];
                    const widthMatch = tilemapContent.match(/width:\\s*(\\d+)/);
                    const heightMatch = tilemapContent.match(/height:\\s*(\\d+)/);
                    const tileWidthMatch = tilemapContent.match(/tileWidth:\\s*(\\d+)/);
                    const tileHeightMatch = tilemapContent.match(/tileHeight:\\s*(\\d+)/);
                    
                    if (widthMatch && heightMatch && tileWidthMatch && tileHeightMatch) {
                        tilemap = {
                            width: parseInt(widthMatch[1]),
                            height: parseInt(heightMatch[1]),
                            tileWidth: parseInt(tileWidthMatch[1]),
                            tileHeight: parseInt(tileHeightMatch[1]),
                            // For demo, create a simple pattern
                            tiles: this.generateDemoTilemap(parseInt(widthMatch[1]), parseInt(heightMatch[1]))
                        };
                    }
                }

                // Parse behavior
                let behavior = null;
                const behaviorMatch = block.match(/behavior:\\s*(\\w+)/);
                if (behaviorMatch) {
                    behavior = {
                        type: behaviorMatch[1],
                        // Parse behavior properties if needed
                    };
                }

                // Determine entity type and physics
                let type = 'sprite';
                let physics = { mode: 'static', vx: 0, vy: 0 };
                
                const lowerName = name.toLowerCase();
                if (lowerName.includes('player') || lowerName.includes('trainer') || lowerName.includes('tuxemon')) {
                    type = 'player';
                    physics = { mode: 'topdown', vx: 0, vy: 0 };
                } else if (lowerName.includes('npc') || lowerName.includes('elder') || lowerName.includes('shop') || lowerName.includes('guard')) {
                    type = 'npc';
                    physics = { mode: 'static', vx: 0, vy: 0 };
                } else if (lowerName.includes('wild') || lowerName.includes('creature')) {
                    type = 'creature';
                    physics = { mode: 'dynamic', vx: 0, vy: 0 };
                } else if (lowerName.includes('wall') || lowerName.includes('platform') || lowerName.includes('ground') || lowerName.includes('tree') || lowerName.includes('boulder')) {
                    type = 'platform';
                    physics = { mode: 'static', vx: 0, vy: 0 };
                } else if (lowerName.includes('tilemap')) {
                    type = 'tilemap';
                    physics = { mode: 'static', vx: 0, vy: 0 };
                } else if (lowerName.includes('coin') || lowerName.includes('potion') || lowerName.includes('item')) {
                    type = 'collectible';
                    physics = { mode: 'static', vx: 0, vy: 0 };
                }

                return { name, type, x, y, width, height, color, physics, tilemap, behavior };
            }

            generateDemoTilemap(width, height) {
                const tiles = [];
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        // Create a simple pattern for demo
                        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                            tiles.push(1); // Wall
                        } else if (x < 3 || y < 3 || x > width - 4 || y > height - 4) {
                            tiles.push(2); // Stone floor
                        } else if (x < 6 || y < 6 || x > width - 7 || y > height - 7) {
                            tiles.push(3); // Wood floor
                        } else {
                            tiles.push(4); // Grass
                        }
                    }
                }
                return tiles;
            }

            getTileColor(tileType) {
                const tileColors = {
                    1: '#696969', // Wall - Dark gray
                    2: '#A9A9A9', // Stone floor - Light gray  
                    3: '#8B4513', // Wood floor - Brown
                    4: '#228B22', // Grass - Green
                    5: '#4169E1', // Water - Blue
                    6: '#F5DEB3', // Sand - Beige
                    7: '#654321', // Dirt - Dark brown
                    8: '#800080', // Magic - Purple
                    9: '#FF69B4'  // Special - Pink
                };
                return tileColors[tileType] || '#999999';
            }

            createDemoEntities() {
                this.entities = [
                    { 
                        name: 'Player', type: 'player', x: 400, y: 300, 
                        width: 32, height: 32, color: '#FF0000',
                        physics: { mode: 'topdown', vx: 0, vy: 0 }
                    },
                    { 
                        name: 'Wall', type: 'platform', x: 400, y: 550, 
                        width: 200, height: 20, color: '#00FF00',
                        physics: { mode: 'static', vx: 0, vy: 0 }
                    }
                ];
                this.log('🎭 Created demo entities');
            }

            setupInput() {
                document.addEventListener('keydown', (e) => {
                    this.keys[e.code] = true;
                    
                    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                        this.debugMode = !this.debugMode;
                        document.getElementById('debug').style.display = this.debugMode ? 'block' : 'none';
                    }
                });

                document.addEventListener('keyup', (e) => {
                    this.keys[e.code] = false;
                });
            }

            start() {
                if (this.running) return;
                this.running = true;
                this.log('🚀 Game started');
                this.gameLoop();
            }

            stop() {
                this.running = false;
                this.log('⏸️ Game paused');
            }

            gameLoop() {
                let lastTime = 0;
                
                const loop = (currentTime) => {
                    const deltaTime = (currentTime - lastTime) / 1000;
                    lastTime = currentTime;

                    this.update(deltaTime);
                    this.render();

                    requestAnimationFrame(loop);
                };

                requestAnimationFrame(loop);
            }

            update(deltaTime) {
                if (!this.player) return;

                // Player movement
                let velocityX = 0;
                let velocityY = 0;
                
                if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
                    velocityX = -this.player.speed;
                    this.player.facing = 'left';
                }
                if (this.keys['KeyD'] || this.keys['ArrowRight']) {
                    velocityX = this.player.speed;
                    this.player.facing = 'right';
                }
                if (this.keys['KeyW'] || this.keys['ArrowUp']) {
                    velocityY = -this.player.speed;
                    this.player.facing = 'up';
                }
                if (this.keys['KeyS'] || this.keys['ArrowDown']) {
                    velocityY = this.player.speed;
                    this.player.facing = 'down';
                }

                // Normalize diagonal movement
                if (velocityX !== 0 && velocityY !== 0) {
                    velocityX *= 0.707;
                    velocityY *= 0.707;
                }

                this.player.moving = velocityX !== 0 || velocityY !== 0;

                // Apply movement
                this.player.x += velocityX * deltaTime;
                this.player.y += velocityY * deltaTime;

                // Update animations
                this.updatePlayerAnimation(deltaTime);

                // Update camera to follow player
                this.camera.x = this.player.x - this.width / 2;
                this.camera.y = this.player.y - this.height / 2;

                // Clamp camera to world bounds
                if (this.tilemap) {
                    const worldWidth = this.tilemap.width * this.tilemap.tilewidth;
                    const worldHeight = this.tilemap.height * this.tilemap.tileheight;
                    
                    this.camera.x = Math.max(0, Math.min(worldWidth - this.width, this.camera.x));
                    this.camera.y = Math.max(0, Math.min(worldHeight - this.height, this.camera.y));
                }
            }

            updatePlayerAnimation(deltaTime) {
                if (!this.player || !this.assets.atlas) return;

                // Determine animation based on movement and facing
                let animName = 'misa-front'; // default

                if (this.player.moving) {
                    switch (this.player.facing) {
                        case 'left': animName = 'misa-left-walk'; break;
                        case 'right': animName = 'misa-right-walk'; break;
                        case 'up': animName = 'misa-back-walk'; break;
                        case 'down': animName = 'misa-front-walk'; break;
                    }
                } else {
                    switch (this.player.facing) {
                        case 'left': animName = 'misa-left'; break;
                        case 'right': animName = 'misa-right'; break;
                        case 'up': animName = 'misa-back'; break;
                        case 'down': animName = 'misa-front'; break;
                    }
                }

                // Update animation frame
                this.player.animationTime += deltaTime * 1000;
                const frameDuration = 1000 / this.player.frameRate;

                if (this.player.animationTime >= frameDuration) {
                    this.player.animationTime = 0;
                    
                    if (this.player.moving) {
                        this.player.animationFrame = (this.player.animationFrame + 1) % 4;
                    } else {
                        this.player.animationFrame = 0;
                    }
                }

                this.player.currentAnimation = animName;
            }

            render() {
                // Clear canvas
                this.ctx.fillStyle = '#4a9';
                this.ctx.fillRect(0, 0, this.width, this.height);

                this.ctx.save();
                
                // Apply camera transform
                this.ctx.translate(-this.camera.x, -this.camera.y);

                // Render tilemap layers in proper order
                this.renderTilemapLayer('Below Player');
                this.renderTilemapLayer('World');
                
                // Render player (between World and Above Player layers)
                this.renderPlayer();
                
                // Render objects (signs, NPCs, etc.)
                this.renderObjects();
                
                // Render top layer
                this.renderTilemapLayer('Above Player');

                this.ctx.restore();

                // Render UI
                if (this.debugMode) {
                    this.renderDebug();
                }
            }

            renderTilemapLayer(layerName) {
                if (!this.tilemap || !this.assets.tileset) return;

                const tileset = this.tilemap.tilesets[0];
                const tileWidth = tileset.tilewidth || 32;
                const tileHeight = tileset.tileheight || 32;
                const margin = tileset.margin || 0;
                const spacing = tileset.spacing || 0;
                const columns = tileset.columns || 24;

                // Find the specific layer
                const layer = this.tilemap.layers.find(l => l.name === layerName);
                if (!layer || layer.type !== 'tilelayer' || !layer.visible || !layer.data) {
                    return;
                }

                console.log(\`Rendering layer: \${layerName} with \${layer.data.filter(id => id !== 0).length} non-empty tiles\`);
                console.log(\`Tileset: \${tileWidth}x\${tileHeight}, margin: \${margin}, spacing: \${spacing}, columns: \${columns}\`);
                
                // Debug: Show calculation for tile ID 126 (common in the map)
                if (layer.data.includes(126)) {
                    const localId126 = 126 - tileset.firstgid;
                    const col126 = localId126 % columns;
                    const row126 = Math.floor(localId126 / columns);
                    const srcX126 = margin + col126 * (tileWidth + spacing);
                    const srcY126 = margin + row126 * (tileHeight + spacing);
                    console.log(\`Tile 126: localId=\${localId126}, col=\${col126}, row=\${row126}, srcX=\${srcX126}, srcY=\${srcY126}\`);
                }

                for (let i = 0; i < layer.data.length; i++) {
                    const tileId = layer.data[i];
                    if (tileId === 0) continue; // Empty tile

                    const localId = tileId - tileset.firstgid;
                    
                    // Calculate source position accounting for margin and spacing
                    const col = localId % columns;
                    const row = Math.floor(localId / columns);
                    const srcX = margin + col * (tileWidth + spacing);
                    const srcY = margin + row * (tileHeight + spacing);

                    const destX = (i % layer.width) * tileWidth;
                    const destY = Math.floor(i / layer.width) * tileHeight;

                    this.ctx.drawImage(
                        this.assets.tileset,
                        srcX, srcY, tileWidth, tileHeight,
                        destX, destY, tileWidth, tileHeight
                    );
                }
            }

            renderObjects() {
                if (!this.tilemap) return;

                // Find the Objects layer
                const objectsLayer = this.tilemap.layers.find(l => l.name === 'Objects');
                if (!objectsLayer || objectsLayer.type !== 'objectgroup' || !objectsLayer.objects) {
                    return;
                }

                console.log(\`Rendering \${objectsLayer.objects.length} objects\`);

                objectsLayer.objects.forEach(obj => {
                    if (obj.name === 'Sign') {
                        // Render sign objects as simple rectangles for now
                        this.ctx.fillStyle = '#8B4513'; // Brown color for signs
                        this.ctx.fillRect(obj.x, obj.y - obj.height, obj.width, obj.height);
                        
                        // Add a simple "S" text
                        this.ctx.fillStyle = '#FFFFFF';
                        this.ctx.font = '12px Arial';
                        this.ctx.fillText('S', obj.x + obj.width/2 - 4, obj.y - obj.height/2 + 4);
                    } else if (obj.name === 'Spawn Point') {
                        // Debug: show spawn point as green dot
                        if (this.debugMode) {
                            this.ctx.fillStyle = '#00FF00';
                            this.ctx.beginPath();
                            this.ctx.arc(obj.x, obj.y, 5, 0, Math.PI * 2);
                            this.ctx.fill();
                        }
                    }
                });
            }

            renderPlayer() {
                if (!this.player || !this.assets.atlas) return;

                // Get current frame name based on movement and direction
                let frameName = this.player.currentAnimation;
                
                if (this.player.moving && this.player.animationFrame > 0) {
                    // For walking animations, use format: misa-front-walk.000, misa-front-walk.001, etc.
                    frameName += '.00' + this.player.animationFrame.toString();
                }
                
                console.log('Looking for frame:', frameName);
                const frame = this.assets.atlas.frames[frameName];
                
                if (!frame) {
                    console.log('Frame not found:', frameName);
                    console.log('Available frames:', Object.keys(this.assets.atlas.frames).slice(0, 5));
                    
                    // Fallback to basic static frame
                    const fallbackFrame = this.assets.atlas.frames[this.player.currentAnimation];
                    if (fallbackFrame) {
                        const f = fallbackFrame.frame;
                        this.ctx.drawImage(
                            this.assets.atlas.image,
                            f.x, f.y, f.w, f.h,
                            this.player.x - f.w/2, this.player.y - f.h + 16, f.w, f.h
                        );
                        console.log('Used fallback frame:', this.player.currentAnimation);
                    } else {
                        console.log('No fallback frame found for:', this.player.currentAnimation);
                        // Draw a simple colored rectangle as ultimate fallback
                        this.ctx.fillStyle = '#FF0000';
                        this.ctx.fillRect(this.player.x - 16, this.player.y - 24, 32, 48);
                        console.log('Drew red rectangle fallback at:', this.player.x, this.player.y);
                    }
                    return;
                }

                const f = frame.frame;
                this.ctx.drawImage(
                    this.assets.atlas.image,
                    f.x, f.y, f.w, f.h,
                    this.player.x - f.w/2, this.player.y - f.h + 16, f.w, f.h
                );
                console.log('Rendered frame:', frameName, 'at', this.player.x, this.player.y);
            }

            renderDebug() {
                const debugDiv = document.getElementById('debugInfo');
                if (debugDiv && this.player) {
                    debugDiv.innerHTML = \`
                        Player: (\${this.player.x.toFixed(1)}, \${this.player.y.toFixed(1)})<br>
                        Camera: (\${this.camera.x.toFixed(1)}, \${this.camera.y.toFixed(1)})<br>
                        Facing: \${this.player.facing}<br>
                        Moving: \${this.player.moving}<br>
                        Animation: \${this.player.currentAnimation}<br>
                        Frame: \${this.player.animationFrame}
                    \`;
                }
            }

            toggleDebug() {
                this.debugMode = !this.debugMode;
                this.log(\`🐛 Debug mode: \${this.debugMode ? 'ON' : 'OFF'}\`);
            }
        }

        // Initialize game when page loads
        document.addEventListener('DOMContentLoaded', async () => {
            const canvas = document.getElementById('gameCanvas');
            const game = new RPGDemoEngine(canvas);

            // Auto-start the game
            game.gameLoop();
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

    private serveGameEngine(res: http.ServerResponse): void {
        // Serve the compiled game engine if needed
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end('// Game engine would be served here');
    }
}