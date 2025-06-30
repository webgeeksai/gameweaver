/**
 * Sprite Editor Server for Game Vibe Engine
 * Serves the sprite editor in a browser window to bypass VS Code webview restrictions
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class SpriteEditorServer {
    private server: http.Server | null = null;
    private port: number = 3002;

    constructor() {
        this.port = this.findAvailablePort();
    }

    private findAvailablePort(): number {
        // Start with 3002, increment if needed
        return 3002 + Math.floor(Math.random() * 1000);
    }

    async start(spriteData: string, workspaceRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, spriteData, workspaceRoot);
            });

            this.server.listen(this.port, () => {
                const url = `http://localhost:${this.port}`;
                console.log(`🎨 Sprite Editor Server started at ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                console.error('Sprite Editor Server error:', error);
                reject(error);
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('🛑 Sprite Editor Server stopped');
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, spriteData: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`🎨 Sprite Editor Request: ${req.method} ${url}`);

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (url === '/') {
            this.serveSpriteEditorHTML(res, spriteData);
        } else if (url === '/api/sprite') {
            this.serveSpriteData(res, spriteData);
        } else if (url === '/api/assets') {
            this.serveAssetsList(res, workspaceRoot);
        } else if (url === '/api/templates') {
            this.serveTemplatesList(res, workspaceRoot);
        } else if (url.startsWith('/api/save-sprite') && req.method === 'POST') {
            this.handleSaveSprite(req, res, workspaceRoot);
        } else if (url.startsWith('/api/export-sprite') && req.method === 'POST') {
            this.handleExportSprite(req, res, workspaceRoot);
        } else if (url.startsWith('/api/save-animation') && req.method === 'POST') {
            this.handleSaveAnimation(req, res, workspaceRoot);
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    private serveSpriteEditorHTML(res: http.ServerResponse, spriteData: string): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎨 Game Vibe Sprite Editor - Browser Edition</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #fff;
            overflow: hidden;
        }
        
        .sprite-editor {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .toolbar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: #2d2d2d;
            border-bottom: 1px solid #3e3e3e;
            flex-wrap: wrap;
        }
        
        .toolbar-section {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 0 10px;
            border-right: 1px solid #3e3e3e;
        }
        
        .toolbar-section:last-child {
            border-right: none;
            margin-left: auto;
        }
        
        .tool-btn {
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
        }
        
        .tool-btn:hover {
            background: #005a9e;
        }
        
        .tool-btn.active {
            background: #0e639c;
        }
        
        .tool-btn:disabled {
            background: #555;
            cursor: not-allowed;
        }
        
        .editor-content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        
        .left-panel {
            width: 250px;
            background: #252526;
            border-right: 1px solid #3e3e3e;
            overflow-y: auto;
        }
        
        .canvas-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
            position: relative;
        }
        
        .right-panel {
            width: 300px;
            background: #252526;
            border-left: 1px solid #3e3e3e;
            overflow-y: auto;
        }
        
        .panel {
            border-bottom: 1px solid #3e3e3e;
        }
        
        .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px;
            background: #2d2d2d;
            border-bottom: 1px solid #3e3e3e;
        }
        
        .panel-header h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
        }
        
        .panel-content {
            padding: 10px;
        }
        
        .canvas-toolbar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: #2d2d2d;
            border-bottom: 1px solid #3e3e3e;
        }
        
        .canvas-container {
            flex: 1;
            position: relative;
            overflow: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #333;
        }
        
        .pixel-canvas {
            position: relative;
            border: 2px solid #555;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        }
        
        canvas {
            position: absolute;
            top: 0;
            left: 0;
        }
        
        #sprite-canvas {
            background: transparent;
            cursor: crosshair;
        }
        
        #grid-canvas {
            pointer-events: none;
            opacity: 0.3;
        }
        
        .color-palette {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 4px;
            margin: 10px 0;
        }
        
        .palette-color {
            width: 24px;
            height: 24px;
            border: 2px solid #555;
            border-radius: 2px;
            cursor: pointer;
        }
        
        .palette-color.active {
            border-color: #007acc;
        }
        
        .primary-colors {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 10px 0;
        }
        
        .color-display {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .color-box {
            width: 40px;
            height: 20px;
            border: 1px solid #555;
            border-radius: 2px;
        }
        
        .layers-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .layer-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: #3c3c3c;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .layer-item.active {
            background: #007acc;
        }
        
        .timeline {
            display: flex;
            gap: 4px;
            overflow-x: auto;
            padding: 10px 0;
        }
        
        .frame {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 8px;
            background: #3c3c3c;
            border-radius: 4px;
            cursor: pointer;
            min-width: 60px;
        }
        
        .frame.active {
            background: #007acc;
        }
        
        .frame img {
            width: 32px;
            height: 32px;
            border: 1px solid #555;
            image-rendering: pixelated;
        }
        
        .tool-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .option-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .option-group label {
            font-size: 12px;
            color: #ccc;
        }
        
        .option-group input[type="range"] {
            width: 100%;
        }
        
        .templates-list {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        
        .template-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 8px;
            background: #3c3c3c;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .template-item:hover {
            background: #404040;
        }
        
        .template-item img {
            width: 32px;
            height: 32px;
            border: 1px solid #555;
            image-rendering: pixelated;
        }
        
        .asset-tabs {
            display: flex;
            border-bottom: 1px solid #3e3e3e;
            margin-bottom: 10px;
        }
        
        .asset-tab {
            background: transparent;
            color: #ccc;
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }
        
        .asset-tab.active {
            color: #007acc;
            border-bottom-color: #007acc;
        }
        
        .asset-list {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        
        .asset-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 8px;
            background: #3c3c3c;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .asset-item:hover {
            background: #404040;
        }
        
        .log {
            max-height: 150px;
            overflow-y: auto;
            background: #1a1a1a;
            padding: 10px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
        
        .animation-controls {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }
        
        .control-btn {
            background: #007acc;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .preview-area {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100px;
            background: #2d2d2d;
            border-radius: 4px;
            margin: 10px 0;
        }
        
        .preview-sprite {
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
            transform: scale(4);
        }
    </style>
</head>
<body>
    <div class="sprite-editor">
        <!-- Toolbar -->
        <div class="toolbar">
            <div class="toolbar-section">
                <button id="new-btn" class="tool-btn" title="New Sprite">
                    📄 New
                </button>
                <button id="open-btn" class="tool-btn" title="Open Sprite">
                    📂 Open
                </button>
                <button id="save-btn" class="tool-btn" title="Save Sprite">
                    💾 Save
                </button>
                <button id="export-btn" class="tool-btn" title="Export">
                    📤 Export
                </button>
            </div>
            <div class="toolbar-section">
                <button id="undo-btn" class="tool-btn" title="Undo">
                    ↶ Undo
                </button>
                <button id="redo-btn" class="tool-btn" title="Redo">
                    ↷ Redo
                </button>
            </div>
            <div class="toolbar-section">
                <button id="brush-tool" class="tool-btn active" title="Brush">
                    🖌️ Brush
                </button>
                <button id="pencil-tool" class="tool-btn" title="Pencil">
                    ✏️ Pencil
                </button>
                <button id="eraser-tool" class="tool-btn" title="Eraser">
                    🧽 Eraser
                </button>
                <button id="fill-tool" class="tool-btn" title="Fill Bucket">
                    🪣 Fill
                </button>
                <button id="eyedropper-tool" class="tool-btn" title="Eyedropper">
                    💉 Picker
                </button>
            </div>
            <div class="toolbar-section">
                <button id="rect-tool" class="tool-btn" title="Rectangle">
                    ⬜ Rect
                </button>
                <button id="circle-tool" class="tool-btn" title="Circle">
                    ⭕ Circle
                </button>
                <button id="line-tool" class="tool-btn" title="Line">
                    📏 Line
                </button>
            </div>
            <div class="toolbar-section">
                <button id="open-in-vscode-btn" class="tool-btn" title="Open in VS Code">
                    📝 VS Code
                </button>
            </div>
        </div>

        <!-- Main Content -->
        <div class="editor-content">
            <!-- Left Panel -->
            <div class="left-panel">
                <!-- Layers Panel -->
                <div class="panel">
                    <div class="panel-header">
                        <h3>Layers</h3>
                        <button id="add-layer-btn" class="tool-btn">+</button>
                    </div>
                    <div class="panel-content">
                        <div class="layers-list">
                            <div class="layer-item active" data-layer="0">
                                <span>Layer 1</span>
                                <input type="range" class="opacity-slider" min="0" max="100" value="100" style="width: 60px;">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Color Palette -->
                <div class="panel">
                    <div class="panel-header">
                        <h3>Colors</h3>
                        <button id="add-color-btn" class="tool-btn">+</button>
                    </div>
                    <div class="panel-content">
                        <div class="primary-colors">
                            <div class="color-display">
                                <div id="primary-color" class="color-box" style="background: #000000;"></div>
                                <div id="secondary-color" class="color-box" style="background: #ffffff;"></div>
                            </div>
                            <input type="color" id="color-picker" value="#000000">
                        </div>
                        <div class="color-palette">
                            <div class="palette-color active" style="background: #000000;" data-color="#000000"></div>
                            <div class="palette-color" style="background: #ffffff;" data-color="#ffffff"></div>
                            <div class="palette-color" style="background: #ff0000;" data-color="#ff0000"></div>
                            <div class="palette-color" style="background: #00ff00;" data-color="#00ff00"></div>
                            <div class="palette-color" style="background: #0000ff;" data-color="#0000ff"></div>
                            <div class="palette-color" style="background: #ffff00;" data-color="#ffff00"></div>
                            <div class="palette-color" style="background: #ff00ff;" data-color="#ff00ff"></div>
                            <div class="palette-color" style="background: #00ffff;" data-color="#00ffff"></div>
                        </div>
                    </div>
                </div>

                <!-- Templates -->
                <div class="panel">
                    <div class="panel-header">
                        <h3>Templates</h3>
                        <button id="save-template-btn" class="tool-btn">💾</button>
                    </div>
                    <div class="panel-content">
                        <div id="templates-list" class="templates-list">
                            <!-- Templates will be populated here -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Canvas Area -->
            <div class="canvas-area">
                <div class="canvas-toolbar">
                    <label>Size:</label>
                    <select id="canvas-size">
                        <option value="16">16x16</option>
                        <option value="32" selected>32x32</option>
                        <option value="64">64x64</option>
                        <option value="128">128x128</option>
                    </select>
                    <label>Zoom:</label>
                    <select id="zoom-level">
                        <option value="2">200%</option>
                        <option value="4">400%</option>
                        <option value="8" selected>800%</option>
                        <option value="16">1600%</option>
                    </select>
                    <button id="grid-toggle" class="tool-btn active">🔳 Grid</button>
                    <button id="onion-skin-toggle" class="tool-btn">👻 Onion</button>
                </div>
                <div class="canvas-container">
                    <div class="pixel-canvas" id="pixel-canvas">
                        <canvas id="sprite-canvas" width="32" height="32"></canvas>
                        <canvas id="grid-canvas" width="32" height="32"></canvas>
                        <canvas id="onion-canvas" width="32" height="32"></canvas>
                    </div>
                </div>
            </div>

            <!-- Right Panel -->
            <div class="right-panel">
                <!-- Preview -->
                <div class="panel">
                    <div class="panel-header">
                        <h3>Preview</h3>
                    </div>
                    <div class="panel-content">
                        <div class="preview-area">
                            <canvas id="preview-canvas" class="preview-sprite" width="32" height="32"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Animation Timeline -->
                <div class="panel">
                    <div class="panel-header">
                        <h3>Animation</h3>
                        <button id="add-frame-btn" class="tool-btn">+</button>
                    </div>
                    <div class="panel-content">
                        <div class="animation-controls">
                            <button id="play-animation-btn" class="control-btn">▶️</button>
                            <button id="stop-animation-btn" class="control-btn">⏹️</button>
                            <label>FPS:</label>
                            <input type="number" id="frame-rate" value="12" min="1" max="60" style="width: 50px;">
                            <label>
                                <input type="checkbox" id="loop-animation" checked>
                                Loop
                            </label>
                        </div>
                        <div class="timeline">
                            <div class="frame active" data-frame="0">
                                <canvas width="32" height="32"></canvas>
                                <span>1</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tool Options -->
                <div class="panel">
                    <div class="panel-header">
                        <h3>Tool Options</h3>
                    </div>
                    <div class="panel-content">
                        <div class="tool-options">
                            <div class="option-group">
                                <label>Brush Size:</label>
                                <input type="range" id="brush-size" min="1" max="10" value="1">
                                <span id="brush-size-value">1px</span>
                            </div>
                            <div class="option-group">
                                <label>Opacity:</label>
                                <input type="range" id="brush-opacity" min="0" max="100" value="100">
                                <span id="brush-opacity-value">100%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Asset Browser -->
                <div class="panel">
                    <div class="panel-header">
                        <h3>Assets</h3>
                        <button id="refresh-assets-btn" class="tool-btn">🔄</button>
                    </div>
                    <div class="panel-content">
                        <div class="asset-tabs">
                            <button class="asset-tab active" data-tab="sprites">Sprites</button>
                            <button class="asset-tab" data-tab="animations">Animations</button>
                        </div>
                        <div id="sprites-list" class="asset-list">
                            <!-- Sprites will be populated here -->
                        </div>
                        <div id="animations-list" class="asset-list" style="display: none;">
                            <!-- Animations will be populated here -->
                        </div>
                    </div>
                </div>

                <!-- Debug Log -->
                <div class="panel">
                    <div class="panel-header">
                        <h3>Debug Log</h3>
                    </div>
                    <div class="panel-content">
                        <div id="debug-log" class="log">
                            <div>🎨 Sprite Editor initialized</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Sprite Editor Implementation
        class SpriteEditor {
            constructor() {
                this.canvas = document.getElementById('sprite-canvas');
                this.ctx = this.canvas.getContext('2d');
                this.gridCanvas = document.getElementById('grid-canvas');
                this.gridCtx = this.gridCanvas.getContext('2d');
                this.previewCanvas = document.getElementById('preview-canvas');
                this.previewCtx = this.previewCanvas.getContext('2d');
                
                this.pixelSize = 8; // Default zoom level
                this.canvasSize = 32;
                this.currentTool = 'brush';
                this.primaryColor = '#000000';
                this.secondaryColor = '#ffffff';
                this.brushSize = 1;
                this.showGrid = true;
                this.frames = [this.createEmptyFrame()];
                this.currentFrame = 0;
                this.isDrawing = false;
                this.undoStack = [];
                this.redoStack = [];
                
                this.setupCanvas();
                this.setupEventListeners();
                this.drawGrid();
                this.updatePreview();
                this.loadAssets();
                this.log('🎨 Sprite Editor ready');
            }
            
            log(message) {
                const logDiv = document.getElementById('debug-log');
                const time = new Date().toLocaleTimeString();
                logDiv.innerHTML += \`<div>[\${time}] \${message}</div>\`;
                logDiv.scrollTop = logDiv.scrollHeight;
                console.log(message);
            }
            
            setupCanvas() {
                const container = document.getElementById('pixel-canvas');
                const size = this.canvasSize * this.pixelSize;
                
                this.canvas.width = this.canvasSize;
                this.canvas.height = this.canvasSize;
                this.canvas.style.width = size + 'px';
                this.canvas.style.height = size + 'px';
                
                this.gridCanvas.width = this.canvasSize;
                this.gridCanvas.height = this.canvasSize;
                this.gridCanvas.style.width = size + 'px';
                this.gridCanvas.style.height = size + 'px';
                
                container.style.width = size + 'px';
                container.style.height = size + 'px';
                
                // Disable image smoothing for pixel art
                this.ctx.imageSmoothingEnabled = false;
                this.gridCtx.imageSmoothingEnabled = false;
                this.previewCtx.imageSmoothingEnabled = false;
            }
            
            setupEventListeners() {
                // Tool buttons
                document.getElementById('brush-tool').addEventListener('click', () => this.setTool('brush'));
                document.getElementById('pencil-tool').addEventListener('click', () => this.setTool('pencil'));
                document.getElementById('eraser-tool').addEventListener('click', () => this.setTool('eraser'));
                document.getElementById('fill-tool').addEventListener('click', () => this.setTool('fill'));
                document.getElementById('eyedropper-tool').addEventListener('click', () => this.setTool('eyedropper'));
                
                // File operations
                document.getElementById('new-btn').addEventListener('click', () => this.newSprite());
                document.getElementById('save-btn').addEventListener('click', () => this.saveSprite());
                document.getElementById('export-btn').addEventListener('click', () => this.exportSprite());
                
                // Canvas controls
                document.getElementById('canvas-size').addEventListener('change', (e) => this.setCanvasSize(parseInt(e.target.value)));
                document.getElementById('zoom-level').addEventListener('change', (e) => this.setZoom(parseInt(e.target.value)));
                document.getElementById('grid-toggle').addEventListener('click', () => this.toggleGrid());
                
                // Color controls
                document.getElementById('color-picker').addEventListener('input', (e) => this.setPrimaryColor(e.target.value));
                document.querySelectorAll('.palette-color').forEach(color => {
                    color.addEventListener('click', (e) => this.setPrimaryColor(e.target.dataset.color));
                });
                
                // Tool options
                document.getElementById('brush-size').addEventListener('input', (e) => this.setBrushSize(parseInt(e.target.value)));
                
                // Canvas events
                this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
                this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
                this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
                this.canvas.addEventListener('mouseleave', () => this.isDrawing = false);
                
                // Animation controls
                document.getElementById('add-frame-btn').addEventListener('click', () => this.addFrame());
                document.getElementById('play-animation-btn').addEventListener('click', () => this.playAnimation());
                document.getElementById('stop-animation-btn').addEventListener('click', () => this.stopAnimation());
                
                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => this.handleKeyDown(e));
            }
            
            setTool(tool) {
                this.currentTool = tool;
                document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById(\`\${tool}-tool\`).classList.add('active');
                this.log(\`Tool changed to: \${tool}\`);
            }
            
            setPrimaryColor(color) {
                this.primaryColor = color;
                document.getElementById('primary-color').style.background = color;
                document.getElementById('color-picker').value = color;
                document.querySelectorAll('.palette-color').forEach(c => c.classList.remove('active'));
                document.querySelector(\`[data-color="\${color}"]\`)?.classList.add('active');
            }
            
            setBrushSize(size) {
                this.brushSize = size;
                document.getElementById('brush-size-value').textContent = \`\${size}px\`;
            }
            
            setCanvasSize(size) {
                this.canvasSize = size;
                this.frames = [this.createEmptyFrame()];
                this.currentFrame = 0;
                this.setupCanvas();
                this.drawGrid();
                this.render();
                this.log(\`Canvas size changed to: \${size}x\${size}\`);
            }
            
            setZoom(zoom) {
                this.pixelSize = zoom;
                this.setupCanvas();
                this.drawGrid();
                this.render();
            }
            
            toggleGrid() {
                this.showGrid = !this.showGrid;
                document.getElementById('grid-toggle').classList.toggle('active');
                this.drawGrid();
            }
            
            drawGrid() {
                this.gridCtx.clearRect(0, 0, this.canvasSize, this.canvasSize);
                
                if (!this.showGrid) return;
                
                this.gridCtx.strokeStyle = '#333';
                this.gridCtx.lineWidth = 1;
                
                for (let i = 0; i <= this.canvasSize; i++) {
                    this.gridCtx.beginPath();
                    this.gridCtx.moveTo(i, 0);
                    this.gridCtx.lineTo(i, this.canvasSize);
                    this.gridCtx.stroke();
                    
                    this.gridCtx.beginPath();
                    this.gridCtx.moveTo(0, i);
                    this.gridCtx.lineTo(this.canvasSize, i);
                    this.gridCtx.stroke();
                }
            }
            
            handleMouseDown(e) {
                this.isDrawing = true;
                const pos = this.getMousePos(e);
                this.saveState();
                this.drawPixel(pos.x, pos.y);
            }
            
            handleMouseMove(e) {
                if (!this.isDrawing) return;
                const pos = this.getMousePos(e);
                this.drawPixel(pos.x, pos.y);
            }
            
            handleMouseUp(e) {
                this.isDrawing = false;
                this.updatePreview();
            }
            
            getMousePos(e) {
                const rect = this.canvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / this.pixelSize);
                const y = Math.floor((e.clientY - rect.top) / this.pixelSize);
                return { x: Math.max(0, Math.min(x, this.canvasSize - 1)), 
                        y: Math.max(0, Math.min(y, this.canvasSize - 1)) };
            }
            
            drawPixel(x, y) {
                const frame = this.frames[this.currentFrame];
                
                switch (this.currentTool) {
                    case 'brush':
                    case 'pencil':
                        this.drawBrush(x, y, this.primaryColor);
                        break;
                    case 'eraser':
                        this.drawBrush(x, y, 'transparent');
                        break;
                    case 'fill':
                        this.floodFill(x, y, this.primaryColor);
                        break;
                    case 'eyedropper':
                        const color = this.getPixelColor(x, y);
                        if (color) this.setPrimaryColor(color);
                        break;
                }
                
                this.render();
            }
            
            drawBrush(x, y, color) {
                const frame = this.frames[this.currentFrame];
                const halfSize = Math.floor(this.brushSize / 2);
                
                for (let dx = -halfSize; dx <= halfSize; dx++) {
                    for (let dy = -halfSize; dy <= halfSize; dy++) {
                        const px = x + dx;
                        const py = y + dy;
                        if (px >= 0 && px < this.canvasSize && py >= 0 && py < this.canvasSize) {
                            const index = (py * this.canvasSize + px) * 4;
                            if (color === 'transparent') {
                                frame.data[index + 3] = 0; // Alpha = 0
                            } else {
                                const rgb = this.hexToRgb(color);
                                frame.data[index] = rgb.r;
                                frame.data[index + 1] = rgb.g;
                                frame.data[index + 2] = rgb.b;
                                frame.data[index + 3] = 255;
                            }
                        }
                    }
                }
            }
            
            floodFill(x, y, color) {
                // Simple flood fill implementation
                const frame = this.frames[this.currentFrame];
                const targetColor = this.getPixelColor(x, y);
                const fillColor = this.hexToRgb(color);
                
                if (!targetColor || this.colorsEqual(targetColor, fillColor)) return;
                
                const stack = [{x, y}];
                const visited = new Set();
                
                while (stack.length > 0) {
                    const {x: px, y: py} = stack.pop();
                    const key = \`\${px},\${py}\`;
                    
                    if (visited.has(key) || px < 0 || px >= this.canvasSize || py < 0 || py >= this.canvasSize) continue;
                    visited.add(key);
                    
                    const currentColor = this.getPixelColor(px, py);
                    if (!this.colorsEqual(currentColor, targetColor)) continue;
                    
                    const index = (py * this.canvasSize + px) * 4;
                    frame.data[index] = fillColor.r;
                    frame.data[index + 1] = fillColor.g;
                    frame.data[index + 2] = fillColor.b;
                    frame.data[index + 3] = 255;
                    
                    stack.push({x: px + 1, y: py}, {x: px - 1, y: py}, {x: px, y: py + 1}, {x: px, y: py - 1});
                }
            }
            
            getPixelColor(x, y) {
                const frame = this.frames[this.currentFrame];
                const index = (y * this.canvasSize + x) * 4;
                return {
                    r: frame.data[index],
                    g: frame.data[index + 1],
                    b: frame.data[index + 2],
                    a: frame.data[index + 3]
                };
            }
            
            hexToRgb(hex) {
                const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }
            
            colorsEqual(c1, c2) {
                return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b && c1.a === c2.a;
            }
            
            createEmptyFrame() {
                return this.ctx.createImageData(this.canvasSize, this.canvasSize);
            }
            
            render() {
                this.ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);
                this.ctx.putImageData(this.frames[this.currentFrame], 0, 0);
            }
            
            updatePreview() {
                this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
                this.previewCtx.putImageData(this.frames[this.currentFrame], 0, 0);
            }
            
            addFrame() {
                this.frames.push(this.createEmptyFrame());
                this.currentFrame = this.frames.length - 1;
                this.updateTimeline();
                this.render();
                this.log(\`Added frame \${this.frames.length}\`);
            }
            
            updateTimeline() {
                const timeline = document.querySelector('.timeline');
                timeline.innerHTML = '';
                
                this.frames.forEach((frame, index) => {
                    const frameElement = document.createElement('div');
                    frameElement.className = \`frame \${index === this.currentFrame ? 'active' : ''}\`;
                    frameElement.innerHTML = \`
                        <canvas width="32" height="32"></canvas>
                        <span>\${index + 1}</span>
                    \`;
                    
                    const canvas = frameElement.querySelector('canvas');
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    ctx.putImageData(frame, 0, 0);
                    
                    frameElement.addEventListener('click', () => {
                        this.currentFrame = index;
                        this.updateTimeline();
                        this.render();
                        this.updatePreview();
                    });
                    
                    timeline.appendChild(frameElement);
                });
            }
            
            saveState() {
                this.undoStack.push(this.frames[this.currentFrame].data.slice());
                this.redoStack = [];
            }
            
            undo() {
                if (this.undoStack.length > 0) {
                    this.redoStack.push(this.frames[this.currentFrame].data.slice());
                    const previousState = this.undoStack.pop();
                    this.frames[this.currentFrame].data.set(previousState);
                    this.render();
                    this.updatePreview();
                }
            }
            
            redo() {
                if (this.redoStack.length > 0) {
                    this.undoStack.push(this.frames[this.currentFrame].data.slice());
                    const nextState = this.redoStack.pop();
                    this.frames[this.currentFrame].data.set(nextState);
                    this.render();
                    this.updatePreview();
                }
            }
            
            newSprite() {
                this.frames = [this.createEmptyFrame()];
                this.currentFrame = 0;
                this.render();
                this.updatePreview();
                this.updateTimeline();
                this.log('🆕 New sprite created');
            }
            
            async saveSprite() {
                const spriteData = this.canvas.toDataURL();
                try {
                    const response = await fetch('/api/save-sprite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            spriteData, 
                            fileName: 'sprite_' + Date.now(),
                            format: 'png'
                        })
                    });
                    if (response.ok) {
                        this.log('💾 Sprite saved successfully');
                    } else {
                        this.log('❌ Failed to save sprite');
                    }
                } catch (error) {
                    this.log(\`❌ Save error: \${error.message}\`);
                }
            }
            
            async exportSprite() {
                // Export all frames as animation
                const animationData = {
                    frames: this.frames.map(frame => {
                        const canvas = document.createElement('canvas');
                        canvas.width = this.canvasSize;
                        canvas.height = this.canvasSize;
                        const ctx = canvas.getContext('2d');
                        ctx.putImageData(frame, 0, 0);
                        return canvas.toDataURL();
                    }),
                    frameRate: parseInt(document.getElementById('frame-rate').value),
                    loop: document.getElementById('loop-animation').checked
                };
                
                try {
                    const response = await fetch('/api/save-animation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            animationData,
                            fileName: 'animation_' + Date.now()
                        })
                    });
                    if (response.ok) {
                        this.log('📤 Animation exported successfully');
                    } else {
                        this.log('❌ Failed to export animation');
                    }
                } catch (error) {
                    this.log(\`❌ Export error: \${error.message}\`);
                }
            }
            
            async loadAssets() {
                try {
                    const response = await fetch('/api/assets');
                    const assets = await response.json();
                    this.populateAssets(assets);
                    this.log('✅ Assets loaded');
                } catch (error) {
                    this.log(\`❌ Error loading assets: \${error.message}\`);
                }
            }
            
            populateAssets(assets) {
                // Populate sprites and animations lists
                const spritesList = document.getElementById('sprites-list');
                const animationsList = document.getElementById('animations-list');
                
                spritesList.innerHTML = '';
                animationsList.innerHTML = '';
                
                assets.sprites?.forEach(sprite => {
                    const item = document.createElement('div');
                    item.className = 'asset-item';
                    item.innerHTML = \`
                        <img src="/assets/sprites/\${sprite}" alt="\${sprite}">
                        <span>\${sprite}</span>
                    \`;
                    spritesList.appendChild(item);
                });
                
                assets.animations?.forEach(animation => {
                    const item = document.createElement('div');
                    item.className = 'asset-item';
                    item.innerHTML = \`
                        <span>🎬</span>
                        <span>\${animation}</span>
                    \`;
                    animationsList.appendChild(item);
                });
            }
            
            handleKeyDown(e) {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key) {
                        case 'z': 
                            e.preventDefault();
                            this.undo();
                            break;
                        case 'y':
                            e.preventDefault();
                            this.redo();
                            break;
                        case 's':
                            e.preventDefault();
                            this.saveSprite();
                            break;
                    }
                }
                
                // Tool shortcuts
                switch (e.key) {
                    case 'b': this.setTool('brush'); break;
                    case 'p': this.setTool('pencil'); break;
                    case 'e': this.setTool('eraser'); break;
                    case 'f': this.setTool('fill'); break;
                    case 'i': this.setTool('eyedropper'); break;
                }
            }
            
            playAnimation() {
                // Simple animation preview
                if (this.frames.length > 1) {
                    this.animationPlaying = true;
                    this.animationTimer = setInterval(() => {
                        this.currentFrame = (this.currentFrame + 1) % this.frames.length;
                        this.render();
                        this.updatePreview();
                        this.updateTimeline();
                    }, 1000 / parseInt(document.getElementById('frame-rate').value));
                    this.log('▶️ Animation playing');
                }
            }
            
            stopAnimation() {
                if (this.animationTimer) {
                    clearInterval(this.animationTimer);
                    this.animationPlaying = false;
                    this.log('⏹️ Animation stopped');
                }
            }
        }
        
        // Initialize Sprite Editor
        window.addEventListener('load', () => {
            new SpriteEditor();
        });
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    private serveSpriteData(res: http.ServerResponse, spriteData: string): void {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(spriteData);
    }

    private serveAssetsList(res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        return new Promise(async (resolve) => {
            try {
                const assetsPath = path.join(workspaceRoot, 'assets');
                const assets: { sprites: string[], animations: string[], templates: string[] } = { sprites: [], animations: [], templates: [] };

                if (fs.existsSync(assetsPath)) {
                    const spritesPath = path.join(assetsPath, 'sprites');
                    if (fs.existsSync(spritesPath)) {
                        const files = fs.readdirSync(spritesPath);
                        assets.sprites = files.filter(f => f.endsWith('.png') || f.endsWith('.svg'));
                    }

                    const animationsPath = path.join(assetsPath, 'animations');
                    if (fs.existsSync(animationsPath)) {
                        const files = fs.readdirSync(animationsPath);
                        assets.animations = files.filter(f => f.endsWith('_animation.json')).map(f => f.replace('_animation.json', ''));
                    }

                    const templatesPath = path.join(assetsPath, 'templates');
                    if (fs.existsSync(templatesPath)) {
                        const files = fs.readdirSync(templatesPath);
                        assets.templates = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(assets));
            } catch (error) {
                res.writeHead(500);
                res.end('Error loading assets');
            }
            resolve();
        });
    }

    private serveTemplatesList(res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        return new Promise(async (resolve) => {
            try {
                const templatesPath = path.join(workspaceRoot, 'assets', 'templates');
                const templates: any = {};

                if (fs.existsSync(templatesPath)) {
                    const files = fs.readdirSync(templatesPath);
                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            const filePath = path.join(templatesPath, file);
                            const content = fs.readFileSync(filePath, 'utf8');
                            const name = file.replace('.json', '');
                            templates[name] = JSON.parse(content);
                        }
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(templates));
            } catch (error) {
                res.writeHead(500);
                res.end('Error loading templates');
            }
            resolve();
        });
    }

    private handleSaveSprite(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): void {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Here you would save the sprite data
                console.log('Sprite saved:', data.fileName);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400);
                res.end('Invalid data');
            }
        });
    }

    private handleExportSprite(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): void {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Here you would export the sprite
                console.log('Sprite exported:', data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400);
                res.end('Invalid data');
            }
        });
    }

    private handleSaveAnimation(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): void {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Here you would save the animation data
                console.log('Animation saved:', data.fileName);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400);
                res.end('Invalid data');
            }
        });
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