/**
 * RPG Demo Game Server
 * Enhanced server that properly renders the converted phaser-rpg-reference
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class RPGDemoGameServer {
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
                console.log(`🏰 RPG Demo Server started at ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                console.error('RPG Demo Server error:', error);
                reject(error);
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('🛑 RPG Demo Server stopped');
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, gdlContent: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`RPG Demo Server: ${req.method} ${url}`);

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (url === '/') {
            this.serveRPGDemoHTML(res, gdlContent);
        } else if (url === '/api/gdl') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(gdlContent);
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    }

    private serveAsset(res: http.ServerResponse, url: string, workspaceRoot: string): void {
        const assetPath = path.join(workspaceRoot, url);
        
        try {
            if (fs.existsSync(assetPath)) {
                const ext = path.extname(assetPath).toLowerCase();
                let contentType = 'application/octet-stream';
                
                switch (ext) {
                    case '.png': contentType = 'image/png'; break;
                    case '.jpg': case '.jpeg': contentType = 'image/jpeg'; break;
                    case '.gif': contentType = 'image/gif'; break;
                    case '.json': contentType = 'application/json'; break;
                    case '.js': contentType = 'application/javascript'; break;
                    case '.css': contentType = 'text/css'; break;
                }
                
                const data = fs.readFileSync(assetPath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Asset not found');
            }
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading asset');
        }
    }

    private serveRPGDemoHTML(res: http.ServerResponse, gdlContent: string): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RPG Demo - Game Vibe Engine</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: Arial, sans-serif;
        }
        .game-container {
            text-align: center;
        }
        canvas {
            border: 2px solid #333;
            background: #4a9;
        }
        .controls {
            margin-top: 10px;
            color: white;
            font-size: 14px;
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
    </style>
</head>
<body>
    <div class="game-container">
        <canvas id="gameCanvas" width="800" height="600"></canvas>
        <div class="controls">
            🎮 Use WASD or Arrow Keys to move • Space to interact • Shift for debug
        </div>
    </div>
    
    <div class="debug" id="debug" style="display: none;">
        <div id="debugInfo">Debug Mode</div>
    </div>

    <script>
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
                this.gameLoop();
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
                    const response = await fetch('/api/gdl');
                    const gdlContent = await response.text();
                    this.parseGDL(gdlContent);
                } catch (error) {
                    console.error('❌ Failed to load GDL:', error);
                }
            }

            parseGDL(content) {
                console.log('🔧 Parsing GDL...');
                
                // Create player entity
                this.player = {
                    name: 'Player',
                    x: 400,
                    y: 300,
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

                // Render tilemap layers
                this.renderTilemap();

                // Render player
                this.renderPlayer();

                this.ctx.restore();

                // Render UI
                if (this.debugMode) {
                    this.renderDebug();
                }
            }

            renderTilemap() {
                if (!this.tilemap || !this.assets.tileset) return;

                const tileset = this.tilemap.tilesets[0];
                const tileWidth = tileset.tilewidth || 32;
                const tileHeight = tileset.tileheight || 32;
                const tilesPerRow = Math.floor(tileset.imagewidth / tileWidth);

                // Render each layer
                this.tilemap.layers.forEach(layer => {
                    if (layer.type === 'tilelayer' && layer.visible && layer.data) {
                        for (let i = 0; i < layer.data.length; i++) {
                            const tileId = layer.data[i];
                            if (tileId === 0) continue; // Empty tile

                            const localId = tileId - tileset.firstgid;
                            const srcX = (localId % tilesPerRow) * tileWidth;
                            const srcY = Math.floor(localId / tilesPerRow) * tileHeight;

                            const destX = (i % layer.width) * tileWidth;
                            const destY = Math.floor(i / layer.width) * tileHeight;

                            this.ctx.drawImage(
                                this.assets.tileset,
                                srcX, srcY, tileWidth, tileHeight,
                                destX, destY, tileWidth, tileHeight
                            );
                        }
                    }
                });
            }

            renderPlayer() {
                if (!this.player || !this.assets.atlas) return;

                // Get current frame
                let frameName = this.player.currentAnimation;
                if (this.player.moving && this.player.animationFrame > 0) {
                    frameName += '.00' + this.player.animationFrame.toString();
                }

                const frame = this.assets.atlas.frames[frameName];
                if (!frame) {
                    // Fallback to basic frame
                    const fallbackFrame = this.assets.atlas.frames[this.player.currentAnimation];
                    if (fallbackFrame) {
                        const f = fallbackFrame.frame;
                        this.ctx.drawImage(
                            this.assets.atlas.image,
                            f.x, f.y, f.w, f.h,
                            this.player.x - f.w/2, this.player.y - f.h + 16, f.w, f.h
                        );
                    }
                    return;
                }

                const f = frame.frame;
                this.ctx.drawImage(
                    this.assets.atlas.image,
                    f.x, f.y, f.w, f.h,
                    this.player.x - f.w/2, this.player.y - f.h + 16, f.w, f.h
                );
            }

            renderDebug() {
                const debugDiv = document.getElementById('debugInfo');
                debugDiv.innerHTML = \`
                    Player: (\${this.player.x.toFixed(1)}, \${this.player.y.toFixed(1)})<br>
                    Camera: (\${this.camera.x.toFixed(1)}, \${this.camera.y.toFixed(1)})<br>
                    Facing: \${this.player.facing}<br>
                    Moving: \${this.player.moving}<br>
                    Animation: \${this.player.currentAnimation}<br>
                    Frame: \${this.player.animationFrame}
                \`;
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
        }

        // Initialize the game
        const canvas = document.getElementById('gameCanvas');
        const game = new RPGDemoEngine(canvas);
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }
}