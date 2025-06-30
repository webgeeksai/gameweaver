/**
 * Level Designer Server for Game Vibe Engine
 * Serves the level designer in a browser window to bypass VS Code webview restrictions
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class LevelDesignerServer {
    private server: http.Server | null = null;
    private port: number = 3001;

    constructor() {
        this.port = this.findAvailablePort();
    }

    private findAvailablePort(): number {
        // Start with 3001, increment if needed
        return 3001 + Math.floor(Math.random() * 1000);
    }

    async start(levelContent: string, workspaceRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, levelContent, workspaceRoot);
            });

            this.server.listen(this.port, () => {
                const url = `http://localhost:${this.port}`;
                console.log(`🎨 Level Designer Server started at ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                console.error('Level Designer Server error:', error);
                reject(error);
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('🛑 Level Designer Server stopped');
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, levelContent: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`🎨 Level Designer Request: ${req.method} ${url}`);

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
            this.serveLevelDesignerHTML(res, levelContent);
        } else if (url === '/api/level') {
            this.serveLevelData(res, levelContent);
        } else if (url === '/api/assets') {
            this.serveAssetsList(res, workspaceRoot);
        } else if (url === '/api/prefabs') {
            this.servePrefabsList(res, workspaceRoot);
        } else if (url === '/api/templates') {
            this.serveTemplatesList(res);
        } else if (url.startsWith('/api/save-level') && req.method === 'POST') {
            this.handleSaveLevel(req, res);
        } else if (url.startsWith('/api/export-level') && req.method === 'POST') {
            this.handleExportLevel(req, res, workspaceRoot);
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    private serveLevelDesignerHTML(res: http.ServerResponse, levelContent: string): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎨 Game Vibe Level Designer - Browser Edition</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #fff;
            overflow: hidden;
        }
        
        .level-designer {
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
        
        .toolbar-select {
            background: #3c3c3c;
            color: white;
            border: 1px solid #555;
            padding: 4px 8px;
            border-radius: 4px;
        }
        
        .designer-content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        
        .left-panel {
            width: 300px;
            background: #252526;
            border-right: 1px solid #3e3e3e;
            overflow-y: auto;
        }
        
        .canvas-area {
            flex: 1;
            position: relative;
            background: #1e1e1e;
            overflow: hidden;
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
        
        .canvas-container {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: auto;
        }
        
        canvas {
            position: absolute;
            top: 0;
            left: 0;
            cursor: crosshair;
        }
        
        #grid-canvas {
            pointer-events: none;
            opacity: 0.3;
        }
        
        #selection-canvas {
            pointer-events: none;
        }
        
        .entity-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            margin: 4px 0;
            background: #3c3c3c;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .entity-item:hover {
            background: #404040;
        }
        
        .entity-item.active {
            background: #007acc;
        }
        
        .entity-preview {
            width: 24px;
            height: 24px;
            border: 1px solid #555;
            border-radius: 2px;
        }
        
        .property-group {
            margin: 10px 0;
        }
        
        .property-group label {
            display: block;
            margin-bottom: 4px;
            font-size: 12px;
            color: #ccc;
        }
        
        .property-group input,
        .property-group select {
            width: 100%;
            padding: 4px 8px;
            background: #3c3c3c;
            color: white;
            border: 1px solid #555;
            border-radius: 4px;
        }
        
        .status-bar {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 4px 10px;
            background: #007acc;
            font-size: 12px;
        }
        
        .minimap {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 150px;
            height: 100px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #555;
            border-radius: 4px;
        }
        
        #minimap-canvas {
            width: 100%;
            height: 100%;
        }
        
        .log {
            max-height: 100px;
            overflow-y: auto;
            background: #1a1a1a;
            padding: 10px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin-top: 10px;
        }
        
        .zoom-controls {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .zoom-display {
            padding: 4px 8px;
            background: #3c3c3c;
            border-radius: 4px;
            font-size: 12px;
            min-width: 50px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="level-designer">
        <!-- Top Toolbar -->
        <div class="toolbar">
            <div class="toolbar-section">
                <button id="select-tool" class="tool-btn active" title="Select Tool (V)">
                    ✋ Select
                </button>
                <button id="move-tool" class="tool-btn" title="Move Tool (W)">
                    ↔️ Move
                </button>
                <button id="place-tool" class="tool-btn" title="Place Tool (E)">
                    ➕ Place
                </button>
                <button id="delete-tool" class="tool-btn" title="Delete Tool (X)">
                    🗑️ Delete
                </button>
            </div>
            <div class="toolbar-section">
                <button id="grid-snap-btn" class="tool-btn active" title="Grid Snap">
                    📐 Snap
                </button>
                <select id="grid-size" class="toolbar-select">
                    <option value="16">16px</option>
                    <option value="32" selected>32px</option>
                    <option value="64">64px</option>
                </select>
                <button id="show-grid-btn" class="tool-btn active" title="Show Grid">
                    🔳 Grid
                </button>
            </div>
            <div class="toolbar-section">
                <button id="play-btn" class="tool-btn" title="Play Level">
                    ▶️ Play
                </button>
                <button id="pause-btn" class="tool-btn" title="Pause" disabled>
                    ⏸️ Pause
                </button>
                <button id="stop-btn" class="tool-btn" title="Stop" disabled>
                    ⏹️ Stop
                </button>
            </div>
            <div class="toolbar-section">
                <button id="save-btn" class="tool-btn" title="Save Level">
                    💾 Save
                </button>
                <button id="export-btn" class="tool-btn" title="Export Level">
                    📤 Export
                </button>
                <button id="open-in-vscode-btn" class="tool-btn" title="Open in VS Code">
                    📝 VS Code
                </button>
            </div>
            <div class="toolbar-section">
                <div class="zoom-controls">
                    <button id="zoom-out" class="tool-btn" title="Zoom Out">-</button>
                    <span id="zoom-level" class="zoom-display">100%</span>
                    <button id="zoom-in" class="tool-btn" title="Zoom In">+</button>
                    <button id="zoom-fit" class="tool-btn" title="Fit to Screen">🔍</button>
                </div>
            </div>
        </div>

        <!-- Main Content Area -->
        <div class="designer-content">
            <!-- Left Panel - Entity Library -->
            <div class="left-panel">
                <div class="panel">
                    <div class="panel-header">
                        <h3>Entity Library</h3>
                    </div>
                    <div class="panel-content">
                        <div id="entity-templates">
                            <!-- Entity templates will be populated here -->
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h3>Prefabs</h3>
                    </div>
                    <div class="panel-content">
                        <div id="prefabs-list">
                            <!-- Prefabs will be populated here -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Center - Canvas Area -->
            <div class="canvas-area">
                <div class="canvas-container" id="canvas-container">
                    <canvas id="grid-canvas" width="1920" height="1080"></canvas>
                    <canvas id="level-canvas" width="1920" height="1080"></canvas>
                    <canvas id="selection-canvas" width="1920" height="1080"></canvas>
                </div>
                
                <!-- Mini Map -->
                <div class="minimap">
                    <canvas id="minimap-canvas" width="150" height="100"></canvas>
                </div>
            </div>

            <!-- Right Panel - Properties -->
            <div class="right-panel">
                <div class="panel">
                    <div class="panel-header">
                        <h3>Scene Properties</h3>
                    </div>
                    <div class="panel-content">
                        <div class="property-group">
                            <label>Scene Name:</label>
                            <input type="text" id="scene-name" value="MainScene">
                        </div>
                        <div class="property-group">
                            <label>Width:</label>
                            <input type="number" id="scene-width" value="1920" min="320">
                        </div>
                        <div class="property-group">
                            <label>Height:</label>
                            <input type="number" id="scene-height" value="1080" min="240">
                        </div>
                        <div class="property-group">
                            <label>Background:</label>
                            <input type="color" id="scene-background" value="#87CEEB">
                        </div>
                        <div class="property-group">
                            <label>Gravity Y:</label>
                            <input type="number" id="scene-gravity" value="800" step="50">
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h3>Entity Inspector</h3>
                    </div>
                    <div class="panel-content" id="entity-inspector">
                        <div class="no-selection">
                            <p>No entity selected</p>
                            <p style="font-size: 11px; color: #888;">Select an entity to view properties</p>
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <h3>Debug Log</h3>
                    </div>
                    <div class="panel-content">
                        <div id="debug-log" class="log">
                            <div>🎨 Level Designer initialized</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Status Bar -->
        <div class="status-bar">
            <span id="cursor-position">X: 0, Y: 0</span>
            <span id="entity-count">Entities: 0</span>
            <span id="selection-info">No selection</span>
            <span id="tool-info">Tool: Select</span>
        </div>
    </div>

    <script>
        // Level Designer Implementation
        class LevelDesigner {
            constructor() {
                this.canvas = document.getElementById('level-canvas');
                this.ctx = this.canvas.getContext('2d');
                this.gridCanvas = document.getElementById('grid-canvas');
                this.gridCtx = this.gridCanvas.getContext('2d');
                this.selectionCanvas = document.getElementById('selection-canvas');
                this.selectionCtx = this.selectionCanvas.getContext('2d');
                
                this.entities = new Map();
                this.selectedEntity = null;
                this.currentTool = 'select';
                this.gridSize = 32;
                this.showGrid = true;
                this.gridSnap = true;
                this.zoom = 1;
                this.camera = { x: 0, y: 0 };
                this.mousePos = { x: 0, y: 0 };
                this.templates = {};
                this.prefabs = {};
                
                this.setupEventListeners();
                this.drawGrid();
                this.loadData();
                this.log('🎨 Level Designer ready');
            }
            
            log(message) {
                const logDiv = document.getElementById('debug-log');
                const time = new Date().toLocaleTimeString();
                logDiv.innerHTML += \`<div>[\${time}] \${message}</div>\`;
                logDiv.scrollTop = logDiv.scrollHeight;
                console.log(message);
            }
            
            async loadData() {
                try {
                    // Load templates
                    const templatesResponse = await fetch('/api/templates');
                    this.templates = await templatesResponse.json();
                    this.populateEntityTemplates();
                    
                    // Load prefabs
                    const prefabsResponse = await fetch('/api/prefabs');
                    this.prefabs = await prefabsResponse.json();
                    this.populatePrefabs();
                    
                    // Load level data
                    const levelResponse = await fetch('/api/level');
                    const levelData = await levelResponse.text();
                    this.parseLevel(levelData);
                    
                    this.log('✅ Data loaded successfully');
                } catch (error) {
                    this.log(\`❌ Error loading data: \${error.message}\`);
                }
            }
            
            populateEntityTemplates() {
                const container = document.getElementById('entity-templates');
                container.innerHTML = '';
                
                Object.entries(this.templates).forEach(([name, template]) => {
                    const item = document.createElement('div');
                    item.className = 'entity-item';
                    item.innerHTML = \`
                        <div class="entity-preview" style="background: \${template.sprite?.color || '#666'}"></div>
                        <span>\${name}</span>
                    \`;
                    item.addEventListener('click', () => this.selectTemplate(name));
                    container.appendChild(item);
                });
            }
            
            populatePrefabs() {
                const container = document.getElementById('prefabs-list');
                container.innerHTML = '';
                
                Object.keys(this.prefabs).forEach(name => {
                    const item = document.createElement('div');
                    item.className = 'entity-item';
                    item.innerHTML = \`
                        <div class="entity-preview" style="background: #4CAF50"></div>
                        <span>\${name}</span>
                    \`;
                    item.addEventListener('click', () => this.selectPrefab(name));
                    container.appendChild(item);
                });
            }
            
            setupEventListeners() {
                // Tool buttons
                document.getElementById('select-tool').addEventListener('click', () => this.setTool('select'));
                document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
                document.getElementById('place-tool').addEventListener('click', () => this.setTool('place'));
                document.getElementById('delete-tool').addEventListener('click', () => this.setTool('delete'));
                
                // Grid controls
                document.getElementById('grid-snap-btn').addEventListener('click', () => this.toggleGridSnap());
                document.getElementById('show-grid-btn').addEventListener('click', () => this.toggleGrid());
                document.getElementById('grid-size').addEventListener('change', (e) => this.setGridSize(parseInt(e.target.value)));
                
                // Action buttons
                document.getElementById('save-btn').addEventListener('click', () => this.saveLevel());
                document.getElementById('export-btn').addEventListener('click', () => this.exportLevel());
                document.getElementById('play-btn').addEventListener('click', () => this.playLevel());
                
                // Zoom controls
                document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
                document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
                document.getElementById('zoom-fit').addEventListener('click', () => this.zoomFit());
                
                // Canvas events
                this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
                this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
                this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
                this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
                
                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => this.handleKeyDown(e));
            }
            
            setTool(tool) {
                this.currentTool = tool;
                document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById(\`\${tool}-tool\`).classList.add('active');
                document.getElementById('tool-info').textContent = \`Tool: \${tool.charAt(0).toUpperCase() + tool.slice(1)}\`;
            }
            
            handleMouseDown(e) {
                const rect = this.canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) / this.zoom + this.camera.x;
                const y = (e.clientY - rect.top) / this.zoom + this.camera.y;
                
                if (this.gridSnap) {
                    const snappedX = Math.round(x / this.gridSize) * this.gridSize;
                    const snappedY = Math.round(y / this.gridSize) * this.gridSize;
                    this.handleToolAction(snappedX, snappedY);
                } else {
                    this.handleToolAction(x, y);
                }
            }
            
            handleMouseMove(e) {
                const rect = this.canvas.getBoundingClientRect();
                this.mousePos.x = (e.clientX - rect.left) / this.zoom + this.camera.x;
                this.mousePos.y = (e.clientY - rect.top) / this.zoom + this.camera.y;
                
                document.getElementById('cursor-position').textContent = 
                    \`X: \${Math.round(this.mousePos.x)}, Y: \${Math.round(this.mousePos.y)}\`;
            }
            
            handleToolAction(x, y) {
                switch (this.currentTool) {
                    case 'select':
                        this.selectEntityAt(x, y);
                        break;
                    case 'place':
                        this.placeEntity(x, y);
                        break;
                    case 'delete':
                        this.deleteEntityAt(x, y);
                        break;
                }
                this.render();
            }
            
            selectEntityAt(x, y) {
                // Find entity at position
                for (const [id, entity] of this.entities) {
                    if (x >= entity.x && x <= entity.x + entity.width &&
                        y >= entity.y && y <= entity.y + entity.height) {
                        this.selectedEntity = id;
                        this.showEntityInspector(entity);
                        this.log(\`Selected: \${entity.name}\`);
                        return;
                    }
                }
                this.selectedEntity = null;
                this.showEntityInspector(null);
            }
            
            placeEntity(x, y) {
                if (this.selectedTemplate) {
                    const entity = {
                        id: 'entity_' + Date.now(),
                        name: this.selectedTemplate,
                        x: x,
                        y: y,
                        width: this.templates[this.selectedTemplate].sprite?.width || 32,
                        height: this.templates[this.selectedTemplate].sprite?.height || 32,
                        template: this.selectedTemplate,
                        properties: { ...this.templates[this.selectedTemplate] }
                    };
                    this.entities.set(entity.id, entity);
                    this.log(\`Placed: \${entity.name} at (\${x}, \${y})\`);
                    this.updateEntityCount();
                }
            }
            
            deleteEntityAt(x, y) {
                for (const [id, entity] of this.entities) {
                    if (x >= entity.x && x <= entity.x + entity.width &&
                        y >= entity.y && y <= entity.y + entity.height) {
                        this.entities.delete(id);
                        this.log(\`Deleted: \${entity.name}\`);
                        this.updateEntityCount();
                        if (this.selectedEntity === id) {
                            this.selectedEntity = null;
                            this.showEntityInspector(null);
                        }
                        break;
                    }
                }
            }
            
            drawGrid() {
                if (!this.showGrid) return;
                
                this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
                this.gridCtx.strokeStyle = '#333';
                this.gridCtx.lineWidth = 1;
                
                for (let x = 0; x < this.gridCanvas.width; x += this.gridSize) {
                    this.gridCtx.beginPath();
                    this.gridCtx.moveTo(x, 0);
                    this.gridCtx.lineTo(x, this.gridCanvas.height);
                    this.gridCtx.stroke();
                }
                
                for (let y = 0; y < this.gridCanvas.height; y += this.gridSize) {
                    this.gridCtx.beginPath();
                    this.gridCtx.moveTo(0, y);
                    this.gridCtx.lineTo(this.gridCanvas.width, y);
                    this.gridCtx.stroke();
                }
            }
            
            render() {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                // Render entities
                for (const [id, entity] of this.entities) {
                    this.ctx.fillStyle = entity.properties?.sprite?.color || '#666';
                    this.ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
                    
                    // Draw border for selected entity
                    if (id === this.selectedEntity) {
                        this.ctx.strokeStyle = '#007acc';
                        this.ctx.lineWidth = 2;
                        this.ctx.strokeRect(entity.x, entity.y, entity.width, entity.height);
                    }
                    
                    // Draw entity name
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '12px Arial';
                    this.ctx.fillText(entity.name, entity.x, entity.y - 5);
                }
            }
            
            async saveLevel() {
                const levelData = this.generateGDL();
                try {
                    const response = await fetch('/api/save-level', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ levelData })
                    });
                    if (response.ok) {
                        this.log('💾 Level saved successfully');
                    } else {
                        this.log('❌ Failed to save level');
                    }
                } catch (error) {
                    this.log(\`❌ Save error: \${error.message}\`);
                }
            }
            
            generateGDL() {
                let gdl = \`scene \${document.getElementById('scene-name').value} {\\n\`;
                gdl += \`    size: [\${document.getElementById('scene-width').value}, \${document.getElementById('scene-height').value}]\\n\`;
                gdl += \`    background: "\${document.getElementById('scene-background').value}"\\n\`;
                gdl += \`    gravity: [0, \${document.getElementById('scene-gravity').value}]\\n\\n\`;
                
                for (const entity of this.entities.values()) {
                    gdl += \`    spawn \${entity.name} at [\${entity.x}, \${entity.y}]\\n\`;
                }
                
                gdl += '}';
                return gdl;
            }
            
            updateEntityCount() {
                document.getElementById('entity-count').textContent = \`Entities: \${this.entities.size}\`;
            }
            
            // Additional methods for zoom, templates, etc.
            zoomIn() { this.setZoom(this.zoom * 1.2); }
            zoomOut() { this.setZoom(this.zoom / 1.2); }
            zoomFit() { this.setZoom(1); }
            
            setZoom(zoom) {
                this.zoom = Math.max(0.1, Math.min(5, zoom));
                document.getElementById('zoom-level').textContent = \`\${Math.round(this.zoom * 100)}%\`;
            }
            
            selectTemplate(name) {
                this.selectedTemplate = name;
                this.setTool('place');
                this.log(\`Selected template: \${name}\`);
            }
            
            toggleGrid() {
                this.showGrid = !this.showGrid;
                document.getElementById('show-grid-btn').classList.toggle('active');
                this.drawGrid();
            }
            
            toggleGridSnap() {
                this.gridSnap = !this.gridSnap;
                document.getElementById('grid-snap-btn').classList.toggle('active');
            }
            
            setGridSize(size) {
                this.gridSize = size;
                this.drawGrid();
            }
            
            showEntityInspector(entity) {
                const inspector = document.getElementById('entity-inspector');
                if (!entity) {
                    inspector.innerHTML = '<div class="no-selection"><p>No entity selected</p></div>';
                    return;
                }
                
                inspector.innerHTML = \`
                    <div class="property-group">
                        <label>Name:</label>
                        <input type="text" value="\${entity.name}" readonly>
                    </div>
                    <div class="property-group">
                        <label>Position X:</label>
                        <input type="number" value="\${entity.x}">
                    </div>
                    <div class="property-group">
                        <label>Position Y:</label>
                        <input type="number" value="\${entity.y}">
                    </div>
                    <div class="property-group">
                        <label>Width:</label>
                        <input type="number" value="\${entity.width}">
                    </div>
                    <div class="property-group">
                        <label>Height:</label>
                        <input type="number" value="\${entity.height}">
                    </div>
                \`;
            }
            
            parseLevel(levelData) {
                // Simple GDL parsing for demo
                this.log('📝 Parsing level data...');
                // Implementation would parse actual GDL content
            }
            
            playLevel() {
                this.log('▶️ Playing level...');
                // Would integrate with game engine
            }
            
            handleKeyDown(e) {
                switch (e.key) {
                    case 'v': this.setTool('select'); break;
                    case 'w': this.setTool('move'); break;
                    case 'e': this.setTool('place'); break;
                    case 'x': this.setTool('delete'); break;
                    case 'Delete': 
                        if (this.selectedEntity) {
                            const entity = this.entities.get(this.selectedEntity);
                            this.entities.delete(this.selectedEntity);
                            this.log(\`Deleted: \${entity.name}\`);
                            this.selectedEntity = null;
                            this.showEntityInspector(null);
                            this.updateEntityCount();
                            this.render();
                        }
                        break;
                }
            }
        }
        
        // Initialize Level Designer
        window.addEventListener('load', () => {
            new LevelDesigner();
        });
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    private serveLevelData(res: http.ServerResponse, levelContent: string): void {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(levelContent);
    }

    private serveAssetsList(res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        return new Promise(async (resolve) => {
            try {
                const assetsPath = path.join(workspaceRoot, 'assets');
                const assets: { sprites: string[], sounds: string[] } = { sprites: [], sounds: [] };

                if (fs.existsSync(assetsPath)) {
                    const spritesPath = path.join(assetsPath, 'sprites');
                    if (fs.existsSync(spritesPath)) {
                        const files = fs.readdirSync(spritesPath);
                        assets.sprites = files.filter(f => f.endsWith('.png') || f.endsWith('.svg'));
                    }

                    const soundsPath = path.join(assetsPath, 'sounds');
                    if (fs.existsSync(soundsPath)) {
                        const files = fs.readdirSync(soundsPath);
                        assets.sounds = files.filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
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

    private servePrefabsList(res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        return new Promise(async (resolve) => {
            try {
                const prefabsPath = path.join(workspaceRoot, 'assets', 'prefabs');
                const prefabs: any = {};

                if (fs.existsSync(prefabsPath)) {
                    const files = fs.readdirSync(prefabsPath);
                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            const filePath = path.join(prefabsPath, file);
                            const content = fs.readFileSync(filePath, 'utf8');
                            const name = file.replace('.json', '');
                            prefabs[name] = JSON.parse(content);
                        }
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(prefabs));
            } catch (error) {
                res.writeHead(500);
                res.end('Error loading prefabs');
            }
            resolve();
        });
    }

    private serveTemplatesList(res: http.ServerResponse): void {
        const templates = {
            'Player': {
                sprite: { texture: 'player', width: 32, height: 48, color: '#4A90E2' },
                physics: { mode: 'platformer', mass: 1 },
                collider: { type: 'box', width: 28, height: 44 },
                behaviors: ['PlatformerMovement']
            },
            'Platform': {
                sprite: { texture: 'platform', width: 200, height: 32, color: '#654321' },
                physics: { mode: 'static' },
                collider: { type: 'box', width: 200, height: 32 }
            },
            'Enemy': {
                sprite: { texture: 'enemy', width: 32, height: 32, color: '#E74C3C' },
                physics: { mode: 'platformer', mass: 1 },
                collider: { type: 'box', width: 30, height: 30 },
                behaviors: ['PatrolBehavior']
            },
            'Coin': {
                sprite: { texture: 'coin', width: 24, height: 24, color: '#FFD700' },
                physics: { mode: 'static' },
                collider: { type: 'circle', radius: 12, isTrigger: true },
                behaviors: ['Collectible']
            }
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(templates));
    }

    private handleSaveLevel(req: http.IncomingMessage, res: http.ServerResponse): void {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Here you would save the level data
                console.log('Level saved:', data.levelData);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400);
                res.end('Invalid data');
            }
        });
    }

    private handleExportLevel(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): void {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Here you would export the level
                console.log('Level exported:', data);
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
                    case '.mp3': contentType = 'audio/mpeg'; break;
                    case '.wav': contentType = 'audio/wav'; break;
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