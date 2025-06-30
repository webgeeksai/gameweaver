/**
 * Enhanced Level Designer Server for Game Vibe Engine
 * Full-featured level editor with real sprite rendering, asset management, and complete toolset
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface Entity {
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    spriteUrl?: string;
    color: string;
    rotation: number;
    properties: Record<string, any>;
}

interface Asset {
    name: string;
    path: string;
    type: 'sprite' | 'tilemap' | 'audio';
    url: string;
    thumbnail?: string;
}

export class EnhancedLevelDesignerServer {
    private server: http.Server | null = null;
    private port: number = 3001;
    private entities: Map<string, Entity> = new Map();
    private assets: Asset[] = [];

    constructor() {
        this.port = this.findAvailablePort();
    }

    private findAvailablePort(): number {
        return 3001 + Math.floor(Math.random() * 1000);
    }

    async start(levelContent: string, workspaceRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Load assets on startup
            this.loadAssets(workspaceRoot);
            
            // Parse existing level content
            this.parseLevel(levelContent);

            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, levelContent, workspaceRoot);
            });

            this.server.listen(this.port, () => {
                const url = `http://localhost:${this.port}`;
                console.log(`🎨 Enhanced Level Designer Server started at ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                console.error('Enhanced Level Designer Server error:', error);
                reject(error);
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('🛑 Enhanced Level Designer Server stopped');
        }
    }

    private async loadAssets(workspaceRoot: string): Promise<void> {
        try {
            const assetsPath = path.join(workspaceRoot, 'assets');
            if (!fs.existsSync(assetsPath)) return;

            this.assets = [];

            // Load sprites
            const spritesPath = path.join(assetsPath, 'sprites');
            if (fs.existsSync(spritesPath)) {
                const files = fs.readdirSync(spritesPath);
                for (const file of files) {
                    if (file.match(/\.(png|svg|jpg|jpeg|gif)$/i)) {
                        this.assets.push({
                            name: path.parse(file).name,
                            path: path.join('assets', 'sprites', file),
                            type: 'sprite',
                            url: `/assets/sprites/${file}`,
                            thumbnail: `/assets/sprites/${file}`
                        });
                    }
                }
            }

            // Load tilemaps
            const tilemapsPath = path.join(assetsPath, 'tilemaps');
            if (fs.existsSync(tilemapsPath)) {
                const files = fs.readdirSync(tilemapsPath);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        this.assets.push({
                            name: path.parse(file).name,
                            path: path.join('assets', 'tilemaps', file),
                            type: 'tilemap',
                            url: `/assets/tilemaps/${file}`
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error loading assets:', error);
        }
    }

    private parseLevel(levelContent: string): void {
        try {
            this.entities.clear();
            
            if (!levelContent.trim()) return;

            // Parse GDL entities - handle nested braces properly
            const entityRegex = /entity\s+(\w+)\s*\{/g;
            let match;
            const entities: string[] = [];
            
            // Find all entity declarations
            while ((match = entityRegex.exec(levelContent)) !== null) {
                const entityName = match[1];
                const startIndex = match.index + match[0].length;
                let braceCount = 1;
                let endIndex = startIndex;
                
                // Find matching closing brace
                for (let i = startIndex; i < levelContent.length && braceCount > 0; i++) {
                    if (levelContent[i] === '{') braceCount++;
                    else if (levelContent[i] === '}') braceCount--;
                    endIndex = i;
                }
                
                if (braceCount === 0) {
                    const entityContent = levelContent.substring(startIndex, endIndex);
                    this.parseEntity(entityName, entityContent);
                }
            }

            // Also parse scene entities if this is a scene file
            const sceneRegex = /scene\s+\w+\s*\{([^}]*entities:\s*\[([^\]]*)\])?/g;
            let sceneMatch;
            while ((sceneMatch = sceneRegex.exec(levelContent)) !== null) {
                if (sceneMatch[2]) {
                    const entityList = sceneMatch[2];
                    const entityNames = entityList.match(/\w+/g) || [];
                    
                    // Create placeholder entities for scene references
                    entityNames.forEach((name, index) => {
                        const entity: Entity = {
                            id: this.generateId(),
                            name: name,
                            type: this.inferEntityType(name),
                            x: 100 + (index * 64),
                            y: 100,
                            width: 32,
                            height: 32,
                            color: this.getDefaultColor(name),
                            rotation: 0,
                            properties: { sceneReference: true }
                        };
                        this.entities.set(entity.id, entity);
                    });
                }
            }

        } catch (error) {
            console.error('Error parsing level:', error);
        }
    }

    private parseEntity(entityName: string, entityContent: string): void {
        const entity: Entity = {
            id: this.generateId(),
            name: entityName,
            type: this.inferEntityType(entityName),
            x: 100,
            y: 100,
            width: 32,
            height: 32,
            color: this.getDefaultColor(entityName),
            rotation: 0,
            properties: {}
        };

        // Parse transform component
        const transformMatch = entityContent.match(/transform:\s*\{([^}]*)\}/s);
        if (transformMatch) {
            const transform = transformMatch[1];
            const positionMatch = transform.match(/position:\s*\[([^\]]*)\]/);
            if (positionMatch) {
                const coords = positionMatch[1].split(',').map(s => parseFloat(s.trim()));
                if (coords.length >= 2) {
                    entity.x = coords[0];
                    entity.y = coords[1];
                }
            }
            const xMatch = transform.match(/x:\s*([+-]?\d*\.?\d+)/);
            const yMatch = transform.match(/y:\s*([+-]?\d*\.?\d+)/);
            if (xMatch) entity.x = parseFloat(xMatch[1]);
            if (yMatch) entity.y = parseFloat(yMatch[1]);
            
            const rotationMatch = transform.match(/rotation:\s*([+-]?\d*\.?\d+)/);
            if (rotationMatch) entity.rotation = parseFloat(rotationMatch[1]);
        }

        // Parse sprite component
        const spriteMatch = entityContent.match(/sprite:\s*\{([^}]*)\}/s);
        if (spriteMatch) {
            const sprite = spriteMatch[1];
            const textureMatch = sprite.match(/texture:\s*["']([^"']+)["']/);
            if (textureMatch) {
                entity.spriteUrl = `/assets/sprites/${textureMatch[1]}`;
            }
            const widthMatch = sprite.match(/width:\s*(\d+)/);
            const heightMatch = sprite.match(/height:\s*(\d+)/);
            if (widthMatch) entity.width = parseInt(widthMatch[1]);
            if (heightMatch) entity.height = parseInt(heightMatch[1]);
        }

        // Parse physics component
        const physicsMatch = entityContent.match(/physics:\s*\{([^}]*)\}/s);
        if (physicsMatch) {
            entity.properties.physics = true;
            const physics = physicsMatch[1];
            const bodyTypeMatch = physics.match(/bodyType:\s*["']([^"']+)["']/);
            if (bodyTypeMatch) {
                entity.properties.bodyType = bodyTypeMatch[1];
            }
        }

        // Parse collider component
        const colliderMatch = entityContent.match(/collider:\s*\{([^}]*)\}/s);
        if (colliderMatch) {
            entity.properties.collider = true;
            const collider = colliderMatch[1];
            const shapeMatch = collider.match(/shape:\s*["']([^"']+)["']/);
            if (shapeMatch) {
                entity.properties.colliderShape = shapeMatch[1];
            }
        }

        // Parse behavior components
        const behaviorMatches = entityContent.matchAll(/behavior:\s*\{([^}]*)\}/gs);
        const behaviors: string[] = [];
        for (const behaviorMatch of behaviorMatches) {
            const behavior = behaviorMatch[1];
            const typeMatch = behavior.match(/type:\s*["']([^"']+)["']/);
            if (typeMatch) {
                behaviors.push(typeMatch[1]);
            }
        }
        if (behaviors.length > 0) {
            entity.properties.behaviors = behaviors;
        }

        this.entities.set(entity.id, entity);
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, levelContent: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`🎨 Enhanced Level Designer Request: ${req.method} ${url}`);

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
            this.serveLevelDesignerHTML(res);
        } else if (url === '/api/level') {
            this.serveLevelData(res);
        } else if (url === '/api/assets') {
            this.serveAssetsList(res);
        } else if (url === '/api/entities') {
            this.serveEntitiesList(res);
        } else if (url.startsWith('/api/entity') && req.method === 'POST') {
            this.handleEntityOperation(req, res);
        } else if (url.startsWith('/api/save-level') && req.method === 'POST') {
            this.handleSaveLevel(req, res, workspaceRoot);
        } else if (url.startsWith('/api/export-level') && req.method === 'POST') {
            this.handleExportLevel(req, res, workspaceRoot);
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    private serveLevelDesignerHTML(res: http.ServerResponse): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎨 Enhanced Level Designer - Browser Edition</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
            background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
            color: #f0f6fc;
            overflow: hidden;
        }

        .level-designer {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        .toolbar {
            background: linear-gradient(135deg, #21262d 0%, #30363d 100%);
            border-bottom: 2px solid #424a53;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .toolbar-section {
            display: flex;
            align-items: center;
            gap: 8px;
            border-right: 1px solid #424a53;
            padding-right: 12px;
            margin-right: 12px;
        }

        .toolbar-section:last-child {
            border-right: none;
            margin-right: 0;
        }

        .tool-btn {
            background: #373e47;
            color: #f0f6fc;
            border: 1px solid #424a53;
            padding: 8px 14px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            position: relative;
            overflow: hidden;
        }

        .tool-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(88, 166, 255, 0.15), transparent);
            transition: left 0.5s;
        }

        .tool-btn:hover::before {
            left: 100%;
        }

        .tool-btn:hover {
            background: #424a53;
            border-color: #58a6ff;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .tool-btn.active {
            background: linear-gradient(135deg, #1f6feb 0%, #238636 100%);
            border-color: #58a6ff;
            color: #fff;
            box-shadow: 0 0 20px rgba(31, 111, 235, 0.4);
            transform: translateY(-1px);
        }

        .tool-btn:disabled {
            background: #21262d;
            color: #6e7681;
            border-color: #30363d;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .toolbar-input {
            background: #21262d;
            color: #f0f6fc;
            border: 1px solid #424a53;
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 13px;
            width: 90px;
            transition: all 0.2s ease;
        }

        .toolbar-input:focus {
            outline: none;
            border-color: #58a6ff;
            box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
            background: #30363d;
        }

        /* Enhanced Header Styles */
        .header {
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border-bottom: 2px solid #30363d;
            padding: 16px 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 20px;
            font-weight: 700;
            color: #58a6ff;
        }

        .icon {
            font-family: 'SF Pro Icons', -apple-system, BlinkMacSystemFont, monospace;
            font-weight: 400;
            font-style: normal;
            line-height: 1;
            display: inline-block;
        }

        .header-actions {
            display: flex;
            gap: 10px;
        }

        .header-btn {
            background: #238636;
            color: #fff;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }

        .header-btn:hover {
            background: #2ea043;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .header-btn.secondary {
            background: #373e47;
            color: #f0f6fc;
        }

        .header-btn.secondary:hover {
            background: #424a53;
        }

        .header-btn.danger {
            background: #da3633;
        }

        .header-btn.danger:hover {
            background: #f85149;
        }

        .main-content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .left-sidebar {
            width: 320px;
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border-right: 2px solid #30363d;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
        }

        .sidebar-section {
            border-bottom: 1px solid #30363d;
        }

        .section-header {
            background: linear-gradient(135deg, #30363d 0%, #373e47 100%);
            padding: 12px 16px;
            font-size: 13px;
            font-weight: 600;
            border-bottom: 1px solid #424a53;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #58a6ff;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .section-content {
            max-height: 250px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #424a53 #21262d;
        }

        .section-content::-webkit-scrollbar {
            width: 6px;
        }

        .section-content::-webkit-scrollbar-track {
            background: #21262d;
        }

        .section-content::-webkit-scrollbar-thumb {
            background: #424a53;
            border-radius: 3px;
        }

        .asset-item, .entity-item {
            display: flex;
            align-items: center;
            padding: 10px 16px;
            cursor: pointer;
            border-bottom: 1px solid #30363d;
            transition: all 0.2s ease;
            position: relative;
        }

        .asset-item::before, .entity-item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            width: 3px;
            height: 100%;
            background: transparent;
            transition: all 0.2s ease;
        }

        .asset-item:hover, .entity-item:hover {
            background: #30363d;
            transform: translateX(2px);
        }

        .asset-item:hover::before, .entity-item:hover::before {
            background: #58a6ff;
        }

        .asset-item.selected, .entity-item.selected {
            background: rgba(88, 166, 255, 0.1);
            border-color: #58a6ff;
        }

        .asset-item.selected::before, .entity-item.selected::before {
            background: #58a6ff;
        }

        .asset-thumbnail {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #373e47 0%, #424a53 100%);
            border-radius: 6px;
            margin-right: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            overflow: hidden;
            border: 1px solid #424a53;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .asset-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .asset-info {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .asset-name {
            font-size: 11px;
            font-weight: 500;
        }

        .asset-type {
            font-size: 10px;
            color: #aaa;
        }

        .canvas-area {
            flex: 1;
            position: relative;
            overflow: hidden;
            background: #2a2a2a;
        }

        .canvas-container {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }

        canvas {
            position: absolute;
            top: 0;
            left: 0;
            cursor: crosshair;
        }

        #grid-canvas {
            z-index: 1;
        }

        #entities-canvas {
            z-index: 2;
        }

        #selection-canvas {
            z-index: 3;
        }

        .right-sidebar {
            width: 300px;
            background: #252525;
            border-left: 1px solid #3a3a3a;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .property-group {
            margin-bottom: 12px;
        }

        .property-label {
            font-size: 11px;
            font-weight: 500;
            margin-bottom: 4px;
            color: #ccc;
        }

        .property-input {
            width: 100%;
            background: #3a3a3a;
            color: #fff;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 6px 8px;
            font-size: 12px;
        }

        .property-row {
            display: flex;
            gap: 8px;
        }

        .property-row .property-input {
            flex: 1;
        }

        .status-bar {
            background: #2d2d2d;
            border-top: 1px solid #3a3a3a;
            padding: 4px 12px;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .entity-preview {
            width: 60px;
            height: 60px;
            background: #3a3a3a;
            border-radius: 4px;
            margin: 8px 12px;
            position: relative;
            overflow: hidden;
        }

        .entity-preview img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .entity-preview .fallback {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }

        .hierarchy-tree {
            flex: 1;
            overflow-y: auto;
        }

        .error-message {
            background: #4a2c2a;
            border: 1px solid: #8b4513;
            border-radius: 4px;
            padding: 8px 12px;
            margin: 8px 12px;
            font-size: 11px;
            color: #ffcc99;
        }

        .search-input {
            background: #3a3a3a;
            color: #fff;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            margin: 8px 12px;
        }

        .minimap {
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: 150px;
            height: 100px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #555;
            border-radius: 4px;
            overflow: hidden;
        }

        .minimap canvas {
            width: 100%;
            height: 100%;
        }

        .loading {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            font-size: 14px;
        }

        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #333;
            border-top: 2px solid #007acc;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="level-designer">
        <div class="header">
            <div class="header-content">
                <div class="header-title">
                    <span class="icon">■</span> Level Designer
                    <span style="font-size: 12px; color: #8b949e; font-weight: 400;">Enhanced Edition</span>
                </div>
                <div class="header-actions">
                    <button class="header-btn secondary" onclick="loadLevel()"><span class="icon">⌘</span> Load</button>
                    <button class="header-btn" onclick="saveLevel()"><span class="icon">▪</span> Save</button>
                    <button class="header-btn secondary" onclick="exportLevel()"><span class="icon">↗</span> Export</button>
                    <button class="header-btn danger" onclick="clearLevel()"><span class="icon">×</span> Clear</button>
                </div>
            </div>
        </div>
        <div class="toolbar">
            <div class="toolbar-section">
                <span class="toolbar-label">Tools</span>
                <button id="select-tool" class="tool-btn active" title="Select Tool (V)"><span class="icon">⌖</span> Select</button>
                <button id="move-tool" class="tool-btn" title="Move Tool (W)"><span class="icon">⤢</span> Move</button>
                <button id="place-tool" class="tool-btn" title="Place Tool (E)"><span class="icon">+</span> Place</button>
                <button id="paint-tool" class="tool-btn" title="Paint Tool (B)"><span class="icon">◐</span> Paint</button>
                <button id="delete-tool" class="tool-btn" title="Delete Tool (X)"><span class="icon">⌫</span> Delete</button>
            </div>
            <div class="toolbar-section">
                <span class="toolbar-label">Grid</span>
                <button id="grid-toggle" class="tool-btn active" title="Toggle Grid (G)"><span class="icon">#</span> Grid</button>
                <input type="number" id="grid-size" class="toolbar-input" value="32" min="8" max="128" title="Grid Size">
                <button id="snap-toggle" class="tool-btn active" title="Snap to Grid (S)"><span class="icon">⌘</span> Snap</button>
            </div>
            <div class="toolbar-section">
                <span class="toolbar-label">View</span>
                <button id="zoom-out" class="tool-btn" title="Zoom Out (-)"><span class="icon">−</span></button>
                <span id="zoom-level" style="min-width: 50px; text-align: center; font-size: 12px; color: #8b949e;">100%</span>
                <button id="zoom-in" class="tool-btn" title="Zoom In (+)"><span class="icon">+</span></button>
                <button id="zoom-fit" class="tool-btn" title="Fit to Screen (0)"><span class="icon">⌄</span> Fit</button>
            </div>
            <div class="toolbar-section">
                <span class="toolbar-label">History</span>
                <button id="undo" class="tool-btn" title="Undo (Ctrl+Z)"><span class="icon">↶</span> Undo</button>
                <button id="redo" class="tool-btn" title="Redo (Ctrl+Y)"><span class="icon">↷</span> Redo</button>
            </div>
            <div class="toolbar-section">
                <span class="toolbar-label">Level</span>
                <button id="play-level" class="tool-btn" title="Test Level (F5)"><span class="icon">▶</span> Test</button>
                <button id="level-settings" class="tool-btn" title="Level Settings"><span class="icon">⚙</span> Settings</button>
            </div>
        </div>

        <div class="main-content">
            <div class="left-sidebar">
                <div class="sidebar-section">
                    <div class="section-header">
                        <span>Asset Library</span>
                        <button class="tool-btn" onclick="refreshAssets()"><span class="icon">↻</span></button>
                    </div>
                    <input type="text" id="asset-search" class="search-input" placeholder="Search assets...">
                    <div class="section-content" id="asset-library">
                        <!-- Assets will be loaded here -->
                    </div>
                </div>
                <div class="sidebar-section">
                    <div class="section-header">
                        <span>Entity Templates</span>
                    </div>
                    <div class="section-content" id="entity-templates">
                        <!-- Entity templates will be loaded here -->
                    </div>
                </div>
            </div>

            <div class="canvas-area">
                <div class="canvas-container">
                    <canvas id="grid-canvas"></canvas>
                    <canvas id="entities-canvas"></canvas>
                    <canvas id="selection-canvas"></canvas>
                </div>
                <div class="minimap">
                    <canvas id="minimap-canvas"></canvas>
                </div>
            </div>

            <div class="right-sidebar">
                <div class="sidebar-section">
                    <div class="section-header">
                        <span>Level Properties</span>
                    </div>
                    <div class="section-content" style="padding: 12px;">
                        <div class="property-group">
                            <div class="property-label">Level Name</div>
                            <input type="text" id="level-name" class="property-input" value="New Level">
                        </div>
                        <div class="property-group">
                            <div class="property-label">Dimensions</div>
                            <div class="property-row">
                                <input type="number" id="level-width" class="property-input" value="1920" placeholder="Width">
                                <input type="number" id="level-height" class="property-input" value="1080" placeholder="Height">
                            </div>
                        </div>
                        <div class="property-group">
                            <div class="property-label">Background Color</div>
                            <input type="color" id="level-background" class="property-input" value="#87CEEB">
                        </div>
                    </div>
                </div>

                <div class="sidebar-section">
                    <div class="section-header">
                        <span>Entity Inspector</span>
                    </div>
                    <div id="entity-inspector" class="section-content" style="padding: 12px;">
                        <div style="text-align: center; color: #666; padding: 20px;">
                            No entity selected
                        </div>
                    </div>
                </div>

                <div class="sidebar-section" style="flex: 1;">
                    <div class="section-header">
                        <span>Entity Hierarchy</span>
                    </div>
                    <input type="text" id="hierarchy-search" class="search-input" placeholder="Search entities...">
                    <div class="hierarchy-tree" id="entity-hierarchy">
                        <!-- Entity hierarchy will be loaded here -->
                    </div>
                </div>
            </div>
        </div>

        <div class="status-bar">
            <div>
                <span id="cursor-pos">X: 0, Y: 0</span>
                <span style="margin-left: 20px;" id="entity-count">Entities: 0</span>
            </div>
            <div>
                <span id="selection-info">No selection</span>
            </div>
        </div>
    </div>

    <div id="loading" class="loading" style="display: none;">
        <div class="spinner"></div>
        <span>Loading...</span>
    </div>

    <script>
        class EnhancedLevelDesigner {
            constructor() {
                this.entities = new Map();
                this.assets = [];
                this.selectedEntityId = null;
                this.currentTool = 'select';
                this.gridSize = 32;
                this.showGrid = true;
                this.snapToGrid = true;
                this.zoom = 1;
                this.panX = 0;
                this.panY = 0;
                this.isDragging = false;
                this.isMoving = false;
                this.dragStart = { x: 0, y: 0 };
                this.entityDragStart = { x: 0, y: 0 };
                this.imageCache = new Map();
                this.undoStack = [];
                this.redoStack = [];
                
                this.initializeCanvases();
                this.setupEventListeners();
                this.loadData();
                this.render();
            }

            initializeCanvases() {
                this.gridCanvas = document.getElementById('grid-canvas');
                this.entitiesCanvas = document.getElementById('entities-canvas');
                this.selectionCanvas = document.getElementById('selection-canvas');
                this.minimapCanvas = document.getElementById('minimap-canvas');

                this.gridCtx = this.gridCanvas.getContext('2d');
                this.entitiesCtx = this.entitiesCanvas.getContext('2d');
                this.selectionCtx = this.selectionCanvas.getContext('2d');
                this.minimapCtx = this.minimapCanvas.getContext('2d');

                this.resizeCanvases();
                window.addEventListener('resize', () => this.resizeCanvases());
            }

            resizeCanvases() {
                const container = document.querySelector('.canvas-container');
                const rect = container.getBoundingClientRect();
                
                [this.gridCanvas, this.entitiesCanvas, this.selectionCanvas].forEach(canvas => {
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    canvas.style.width = rect.width + 'px';
                    canvas.style.height = rect.height + 'px';
                });

                this.minimapCanvas.width = 150;
                this.minimapCanvas.height = 100;
                
                this.render();
            }

            setupEventListeners() {
                // Tool buttons
                document.getElementById('select-tool').addEventListener('click', () => this.setTool('select'));
                document.getElementById('move-tool').addEventListener('click', () => this.setTool('move'));
                document.getElementById('place-tool').addEventListener('click', () => this.setTool('place'));
                document.getElementById('delete-tool').addEventListener('click', () => this.setTool('delete'));

                // Grid controls
                document.getElementById('grid-toggle').addEventListener('click', () => this.toggleGrid());
                document.getElementById('grid-size').addEventListener('change', (e) => {
                    this.gridSize = parseInt(e.target.value);
                    this.render();
                });
                document.getElementById('snap-toggle').addEventListener('click', () => this.toggleSnap());

                // Zoom controls
                document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
                document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
                document.getElementById('zoom-fit').addEventListener('click', () => this.zoomFit());

                // File operations
                document.getElementById('save-level').addEventListener('click', () => this.saveLevel());
                document.getElementById('export-level').addEventListener('click', () => this.exportLevel());
                document.getElementById('play-level').addEventListener('click', () => this.playLevel());

                // Undo/Redo
                document.getElementById('undo').addEventListener('click', () => this.undo());
                document.getElementById('redo').addEventListener('click', () => this.redo());

                // Canvas events
                this.selectionCanvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
                this.selectionCanvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
                this.selectionCanvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
                this.selectionCanvas.addEventListener('wheel', (e) => this.onWheel(e));
                this.selectionCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

                // Keyboard events
                document.addEventListener('keydown', (e) => this.onKeyDown(e));
                document.addEventListener('keyup', (e) => this.onKeyUp(e));

                // Search
                document.getElementById('asset-search').addEventListener('input', (e) => this.filterAssets(e.target.value));
                document.getElementById('hierarchy-search').addEventListener('input', (e) => this.filterEntities(e.target.value));
            }

            async loadData() {
                try {
                    // Load assets
                    const assetsResponse = await fetch('/api/assets');
                    this.assets = await assetsResponse.json();
                    this.renderAssetLibrary();

                    // Load entities
                    const entitiesResponse = await fetch('/api/entities');
                    const entitiesData = await entitiesResponse.json();
                    entitiesData.forEach(entity => this.entities.set(entity.id, entity));

                    this.renderEntityHierarchy();
                    this.render();
                } catch (error) {
                    console.error('Error loading data:', error);
                }
            }

            renderAssetLibrary() {
                const container = document.getElementById('asset-library');
                container.innerHTML = '';

                this.assets.forEach(asset => {
                    const item = document.createElement('div');
                    item.className = 'asset-item';
                    item.draggable = true;
                    item.dataset.asset = JSON.stringify(asset);

                    item.innerHTML = \`
                        <div class="asset-thumbnail">
                            \${asset.type === 'sprite' ? \`<img src="\${asset.url}" alt="\${asset.name}" onerror="this.style.display='none';">\` : asset.type.charAt(0).toUpperCase()}
                        </div>
                        <div class="asset-info">
                            <div class="asset-name">\${asset.name}</div>
                            <div class="asset-type">\${asset.type}</div>
                        </div>
                    \`;

                    item.addEventListener('click', () => this.selectAsset(asset));
                    item.addEventListener('dragstart', (e) => this.onAssetDragStart(e, asset));
                    
                    container.appendChild(item);
                });
            }

            renderEntityHierarchy() {
                const container = document.getElementById('entity-hierarchy');
                container.innerHTML = '';

                this.entities.forEach(entity => {
                    const item = document.createElement('div');
                    item.className = 'entity-item';
                    if (entity.id === this.selectedEntityId) {
                        item.classList.add('selected');
                    }

                    item.innerHTML = \`
                        <div class="asset-thumbnail" style="background-color: \${entity.color};">
                            \${entity.spriteUrl ? \`<img src="\${entity.spriteUrl}" alt="\${entity.name}">\` : entity.name.charAt(0)}
                        </div>
                        <div class="asset-info">
                            <div class="asset-name">\${entity.name}</div>
                            <div class="asset-type">\${entity.type}</div>
                        </div>
                    \`;

                    item.addEventListener('click', () => this.selectEntity(entity.id));
                    container.appendChild(item);
                });

                document.getElementById('entity-count').textContent = \`Entities: \${this.entities.size}\`;
            }

            setTool(tool) {
                this.currentTool = tool;
                document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById(tool + '-tool').classList.add('active');
                
                // Update cursor
                const cursor = {
                    'select': 'default',
                    'move': 'move',
                    'place': 'crosshair',
                    'delete': 'not-allowed'
                }[tool];
                this.selectionCanvas.style.cursor = cursor;
            }

            getMousePos(e) {
                const rect = this.selectionCanvas.getBoundingClientRect();
                return {
                    x: (e.clientX - rect.left - this.panX) / this.zoom,
                    y: (e.clientY - rect.top - this.panY) / this.zoom
                };
            }

            snapToGridPos(pos) {
                if (!this.snapToGrid) return pos;
                return {
                    x: Math.round(pos.x / this.gridSize) * this.gridSize,
                    y: Math.round(pos.y / this.gridSize) * this.gridSize
                };
            }

            onMouseDown(e) {
                const pos = this.getMousePos(e);
                this.isDragging = true;
                this.dragStart = pos;

                if (this.currentTool === 'select' || this.currentTool === 'move') {
                    const entity = this.getEntityAtPos(pos);
                    if (entity) {
                        this.selectEntity(entity.id);
                        if (this.currentTool === 'move') {
                            this.isMoving = true;
                            this.entityDragStart = { x: entity.x, y: entity.y };
                        }
                    } else {
                        this.selectEntity(null);
                    }
                } else if (this.currentTool === 'place') {
                    this.placeEntity(pos);
                } else if (this.currentTool === 'delete') {
                    const entity = this.getEntityAtPos(pos);
                    if (entity) {
                        this.deleteEntity(entity.id);
                    }
                }
            }

            onMouseMove(e) {
                const pos = this.getMousePos(e);
                document.getElementById('cursor-pos').textContent = \`X: \${Math.round(pos.x)}, Y: \${Math.round(pos.y)}\`;

                if (this.isDragging && this.isMoving && this.selectedEntityId) {
                    const entity = this.entities.get(this.selectedEntityId);
                    if (entity) {
                        const snappedPos = this.snapToGridPos(pos);
                        entity.x = snappedPos.x - entity.width / 2;
                        entity.y = snappedPos.y - entity.height / 2;
                        this.render();
                    }
                }
            }

            onMouseUp(e) {
                if (this.isMoving && this.selectedEntityId) {
                    // Save state for undo
                    this.saveState();
                }
                this.isDragging = false;
                this.isMoving = false;
            }

            onWheel(e) {
                e.preventDefault();
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                this.zoom = Math.max(0.1, Math.min(5, this.zoom * zoomFactor));
                document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
                this.render();
            }

            onKeyDown(e) {
                switch (e.key.toLowerCase()) {
                    case 'v': this.setTool('select'); break;
                    case 'w': this.setTool('move'); break;
                    case 'e': this.setTool('place'); break;
                    case 'x': this.setTool('delete'); break;
                    case 'delete': 
                        if (this.selectedEntityId) {
                            this.deleteEntity(this.selectedEntityId);
                        }
                        break;
                    case 'z':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            this.undo();
                        }
                        break;
                    case 'y':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            this.redo();
                        }
                        break;
                }
            }

            onKeyUp(e) {
                // Handle key releases if needed
            }

            getEntityAtPos(pos) {
                for (const entity of this.entities.values()) {
                    if (pos.x >= entity.x && pos.x <= entity.x + entity.width &&
                        pos.y >= entity.y && pos.y <= entity.y + entity.height) {
                        return entity;
                    }
                }
                return null;
            }

            placeEntity(pos) {
                const snappedPos = this.snapToGridPos(pos);
                const entity = {
                    id: this.generateId(),
                    name: 'NewEntity',
                    type: 'sprite',
                    x: snappedPos.x - 16,
                    y: snappedPos.y - 16,
                    width: 32,
                    height: 32,
                    color: '#4A90E2',
                    rotation: 0,
                    properties: {}
                };

                this.entities.set(entity.id, entity);
                this.selectEntity(entity.id);
                this.renderEntityHierarchy();
                this.saveState();
                this.render();
            }

            deleteEntity(entityId) {
                this.entities.delete(entityId);
                if (this.selectedEntityId === entityId) {
                    this.selectEntity(null);
                }
                this.renderEntityHierarchy();
                this.saveState();
                this.render();
            }

            selectEntity(entityId) {
                this.selectedEntityId = entityId;
                this.renderEntityInspector();
                this.renderEntityHierarchy();
                this.render();
            }

            renderEntityInspector() {
                const container = document.getElementById('entity-inspector');
                
                if (!this.selectedEntityId) {
                    container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No entity selected</div>';
                    document.getElementById('selection-info').textContent = 'No selection';
                    return;
                }

                const entity = this.entities.get(this.selectedEntityId);
                if (!entity) return;

                document.getElementById('selection-info').textContent = \`Selected: \${entity.name}\`;

                container.innerHTML = \`
                    <div class="entity-preview">
                        \${entity.spriteUrl ? 
                            \`<img src="\${entity.spriteUrl}" alt="\${entity.name}">\` : 
                            \`<div class="fallback" style="background-color: \${entity.color};">\${entity.name.charAt(0)}</div>\`
                        }
                    </div>
                    <div class="property-group">
                        <div class="property-label">Name</div>
                        <input type="text" class="property-input" value="\${entity.name}" onchange="levelDesigner.updateEntityProperty('name', this.value)">
                    </div>
                    <div class="property-group">
                        <div class="property-label">Type</div>
                        <select class="property-input" onchange="levelDesigner.updateEntityProperty('type', this.value)">
                            <option value="sprite" \${entity.type === 'sprite' ? 'selected' : ''}>Sprite</option>
                            <option value="platform" \${entity.type === 'platform' ? 'selected' : ''}>Platform</option>
                            <option value="enemy" \${entity.type === 'enemy' ? 'selected' : ''}>Enemy</option>
                            <option value="collectible" \${entity.type === 'collectible' ? 'selected' : ''}>Collectible</option>
                        </select>
                    </div>
                    <div class="property-group">
                        <div class="property-label">Position</div>
                        <div class="property-row">
                            <input type="number" class="property-input" value="\${Math.round(entity.x)}" onchange="levelDesigner.updateEntityProperty('x', parseFloat(this.value))" placeholder="X">
                            <input type="number" class="property-input" value="\${Math.round(entity.y)}" onchange="levelDesigner.updateEntityProperty('y', parseFloat(this.value))" placeholder="Y">
                        </div>
                    </div>
                    <div class="property-group">
                        <div class="property-label">Size</div>
                        <div class="property-row">
                            <input type="number" class="property-input" value="\${entity.width}" onchange="levelDesigner.updateEntityProperty('width', parseFloat(this.value))" placeholder="Width">
                            <input type="number" class="property-input" value="\${entity.height}" onchange="levelDesigner.updateEntityProperty('height', parseFloat(this.value))" placeholder="Height">
                        </div>
                    </div>
                    <div class="property-group">
                        <div class="property-label">Color</div>
                        <input type="color" class="property-input" value="\${entity.color}" onchange="levelDesigner.updateEntityProperty('color', this.value)">
                    </div>
                    \${entity.spriteUrl ? \`
                        <div class="property-group">
                            <div class="property-label">Sprite URL</div>
                            <input type="text" class="property-input" value="\${entity.spriteUrl}" onchange="levelDesigner.updateEntityProperty('spriteUrl', this.value)">
                        </div>
                    \` : ''}
                \`;
            }

            updateEntityProperty(property, value) {
                if (!this.selectedEntityId) return;
                
                const entity = this.entities.get(this.selectedEntityId);
                if (!entity) return;

                entity[property] = value;
                this.renderEntityHierarchy();
                this.render();
            }

            toggleGrid() {
                this.showGrid = !this.showGrid;
                document.getElementById('grid-toggle').classList.toggle('active', this.showGrid);
                this.render();
            }

            toggleSnap() {
                this.snapToGrid = !this.snapToGrid;
                document.getElementById('snap-toggle').classList.toggle('active', this.snapToGrid);
            }

            zoomIn() {
                this.zoom = Math.min(5, this.zoom * 1.2);
                document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
                this.render();
            }

            zoomOut() {
                this.zoom = Math.max(0.1, this.zoom / 1.2);
                document.getElementById('zoom-level').textContent = Math.round(this.zoom * 100) + '%';
                this.render();
            }

            zoomFit() {
                this.zoom = 1;
                this.panX = 0;
                this.panY = 0;
                document.getElementById('zoom-level').textContent = '100%';
                this.render();
            }

            render() {
                this.renderGrid();
                this.renderEntities();
                this.renderSelection();
                this.renderMinimap();
            }

            renderGrid() {
                if (!this.showGrid) {
                    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
                    return;
                }

                this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
                this.gridCtx.strokeStyle = '#333';
                this.gridCtx.lineWidth = 1;

                const scaledGridSize = this.gridSize * this.zoom;
                const startX = (this.panX % scaledGridSize);
                const startY = (this.panY % scaledGridSize);

                this.gridCtx.beginPath();
                for (let x = startX; x < this.gridCanvas.width; x += scaledGridSize) {
                    this.gridCtx.moveTo(x, 0);
                    this.gridCtx.lineTo(x, this.gridCanvas.height);
                }
                for (let y = startY; y < this.gridCanvas.height; y += scaledGridSize) {
                    this.gridCtx.moveTo(0, y);
                    this.gridCtx.lineTo(this.gridCanvas.width, y);
                }
                this.gridCtx.stroke();
            }

            renderEntities() {
                this.entitiesCtx.clearRect(0, 0, this.entitiesCanvas.width, this.entitiesCanvas.height);
                this.entitiesCtx.save();
                this.entitiesCtx.translate(this.panX, this.panY);
                this.entitiesCtx.scale(this.zoom, this.zoom);

                this.entities.forEach(entity => {
                    if (entity.spriteUrl && this.imageCache.has(entity.spriteUrl)) {
                        const img = this.imageCache.get(entity.spriteUrl);
                        this.entitiesCtx.drawImage(img, entity.x, entity.y, entity.width, entity.height);
                    } else if (entity.spriteUrl) {
                        // Load image if not in cache
                        const img = new Image();
                        img.onload = () => {
                            this.imageCache.set(entity.spriteUrl, img);
                            this.render();
                        };
                        img.src = entity.spriteUrl;
                        
                        // Draw fallback
                        this.entitiesCtx.fillStyle = entity.color;
                        this.entitiesCtx.fillRect(entity.x, entity.y, entity.width, entity.height);
                    } else {
                        // Draw color rectangle
                        this.entitiesCtx.fillStyle = entity.color;
                        this.entitiesCtx.fillRect(entity.x, entity.y, entity.width, entity.height);
                    }

                    // Draw entity name
                    this.entitiesCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    this.entitiesCtx.font = '10px Arial';
                    this.entitiesCtx.fillText(entity.name, entity.x + 2, entity.y + 12);
                });

                this.entitiesCtx.restore();
            }

            renderSelection() {
                this.selectionCtx.clearRect(0, 0, this.selectionCanvas.width, this.selectionCanvas.height);
                
                if (!this.selectedEntityId) return;

                const entity = this.entities.get(this.selectedEntityId);
                if (!entity) return;

                this.selectionCtx.save();
                this.selectionCtx.translate(this.panX, this.panY);
                this.selectionCtx.scale(this.zoom, this.zoom);

                // Draw selection rectangle
                this.selectionCtx.strokeStyle = '#007acc';
                this.selectionCtx.lineWidth = 2;
                this.selectionCtx.setLineDash([5, 5]);
                this.selectionCtx.strokeRect(entity.x - 2, entity.y - 2, entity.width + 4, entity.height + 4);

                this.selectionCtx.restore();
            }

            renderMinimap() {
                this.minimapCtx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
                this.minimapCtx.fillStyle = '#2a2a2a';
                this.minimapCtx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);

                const scale = 0.1;
                this.minimapCtx.save();
                this.minimapCtx.scale(scale, scale);

                this.entities.forEach(entity => {
                    this.minimapCtx.fillStyle = entity.color;
                    this.minimapCtx.fillRect(entity.x, entity.y, entity.width, entity.height);
                });

                this.minimapCtx.restore();
            }

            generateId() {
                return 'entity_' + Math.random().toString(36).substr(2, 9);
            }

            saveState() {
                const state = {
                    entities: new Map(this.entities),
                    selectedEntityId: this.selectedEntityId
                };
                this.undoStack.push(state);
                this.redoStack = [];
                
                // Limit undo stack size
                if (this.undoStack.length > 50) {
                    this.undoStack.shift();
                }
            }

            undo() {
                if (this.undoStack.length === 0) return;
                
                const currentState = {
                    entities: new Map(this.entities),
                    selectedEntityId: this.selectedEntityId
                };
                this.redoStack.push(currentState);
                
                const previousState = this.undoStack.pop();
                this.entities = previousState.entities;
                this.selectedEntityId = previousState.selectedEntityId;
                
                this.renderEntityHierarchy();
                this.renderEntityInspector();
                this.render();
            }

            redo() {
                if (this.redoStack.length === 0) return;
                
                const currentState = {
                    entities: new Map(this.entities),
                    selectedEntityId: this.selectedEntityId
                };
                this.undoStack.push(currentState);
                
                const nextState = this.redoStack.pop();
                this.entities = nextState.entities;
                this.selectedEntityId = nextState.selectedEntityId;
                
                this.renderEntityHierarchy();
                this.renderEntityInspector();
                this.render();
            }

            async saveLevel() {
                try {
                    const levelData = {
                        entities: Array.from(this.entities.values()),
                        levelName: document.getElementById('level-name').value,
                        width: parseInt(document.getElementById('level-width').value),
                        height: parseInt(document.getElementById('level-height').value),
                        backgroundColor: document.getElementById('level-background').value
                    };

                    const response = await fetch('/api/save-level', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(levelData)
                    });

                    const result = await response.json();
                    if (result.success) {
                        alert('Level saved successfully!');
                    } else {
                        alert('Failed to save level: ' + result.error);
                    }
                } catch (error) {
                    alert('Error saving level: ' + error.message);
                }
            }

            async exportLevel() {
                try {
                    const levelData = {
                        entities: Array.from(this.entities.values()),
                        levelName: document.getElementById('level-name').value,
                        format: 'gdl'
                    };

                    const response = await fetch('/api/export-level', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(levelData)
                    });

                    const result = await response.json();
                    if (result.success) {
                        alert('Level exported successfully!');
                    } else {
                        alert('Failed to export level: ' + result.error);
                    }
                } catch (error) {
                    alert('Error exporting level: ' + error.message);
                }
            }

            playLevel() {
                alert('Play Level functionality would launch the game preview here');
            }

            selectAsset(asset) {
                document.querySelectorAll('.asset-item').forEach(item => item.classList.remove('selected'));
                event.currentTarget.classList.add('selected');
            }

            onAssetDragStart(e, asset) {
                e.dataTransfer.setData('application/json', JSON.stringify(asset));
            }

            filterAssets(query) {
                const items = document.querySelectorAll('.asset-item');
                items.forEach(item => {
                    const name = item.querySelector('.asset-name').textContent.toLowerCase();
                    const visible = name.includes(query.toLowerCase());
                    item.style.display = visible ? 'flex' : 'none';
                });
            }

            filterEntities(query) {
                const items = document.querySelectorAll('.entity-item');
                items.forEach(item => {
                    const name = item.querySelector('.asset-name').textContent.toLowerCase();
                    const visible = name.includes(query.toLowerCase());
                    item.style.display = visible ? 'flex' : 'none';
                });
            }
        }

        // Global reference
        let levelDesigner;

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', () => {
            levelDesigner = new EnhancedLevelDesigner();
        });

        // Global functions for HTML event handlers
        function refreshAssets() {
            levelDesigner.loadData();
        }
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    private serveAssetsList(res: http.ServerResponse): void {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.assets));
    }

    private serveEntitiesList(res: http.ServerResponse): void {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(Array.from(this.entities.values())));
    }

    private serveLevelData(res: http.ServerResponse): void {
        const gdl = this.generateGDL();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(gdl);
    }

    private generateGDL(): string {
        let gdl = '// Generated Level\n\n';
        
        this.entities.forEach(entity => {
            gdl += `entity ${entity.name} {\n`;
            gdl += `    transform: { x: ${Math.round(entity.x)}, y: ${Math.round(entity.y)} }\n`;
            gdl += `    sprite: { `;
            if (entity.spriteUrl) {
                gdl += `texture: "${entity.spriteUrl}", `;
            }
            gdl += `width: ${entity.width}, height: ${entity.height}, color: "${entity.color}" }\n`;
            if (entity.type !== 'sprite') {
                gdl += `    type: "${entity.type}"\n`;
            }
            gdl += `}\n\n`;
        });
        
        return gdl;
    }

    private async handleEntityOperation(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                
                switch (data.operation) {
                    case 'create':
                        this.entities.set(data.entity.id, data.entity);
                        break;
                    case 'update':
                        if (this.entities.has(data.entity.id)) {
                            this.entities.set(data.entity.id, { ...this.entities.get(data.entity.id), ...data.entity });
                        }
                        break;
                    case 'delete':
                        this.entities.delete(data.entityId);
                        break;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleSaveLevel(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const levelData = JSON.parse(body);
                
                // Update internal state
                this.entities.clear();
                levelData.entities.forEach((entity: Entity) => {
                    this.entities.set(entity.id, entity);
                });

                // Generate GDL
                const gdlContent = this.generateGDL();
                
                // Save to file system
                const levelsPath = path.join(workspaceRoot, 'levels');
                if (!fs.existsSync(levelsPath)) {
                    fs.mkdirSync(levelsPath, { recursive: true });
                }

                const fileName = `${levelData.levelName || 'level'}.gdl`;
                const filePath = path.join(levelsPath, fileName);
                fs.writeFileSync(filePath, gdlContent);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: fileName }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleExportLevel(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const exportData = JSON.parse(body);
                
                const fileName = `${exportData.levelName || 'exported_level'}.gdl`;
                const exportsPath = path.join(workspaceRoot, 'exports');
                if (!fs.existsSync(exportsPath)) {
                    fs.mkdirSync(exportsPath, { recursive: true });
                }

                // Update entities
                this.entities.clear();
                exportData.entities.forEach((entity: Entity) => {
                    this.entities.set(entity.id, entity);
                });

                const gdlContent = this.generateGDL();
                const filePath = path.join(exportsPath, fileName);
                fs.writeFileSync(filePath, gdlContent);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: fileName }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private serveAsset(res: http.ServerResponse, url: string, workspaceRoot: string): void {
        try {
            const assetPath = path.join(workspaceRoot, url.replace(/^\//, ''));
            if (fs.existsSync(assetPath)) {
                const ext = path.extname(assetPath).toLowerCase();
                let contentType = 'application/octet-stream';
                
                switch (ext) {
                    case '.png': contentType = 'image/png'; break;
                    case '.jpg': case '.jpeg': contentType = 'image/jpeg'; break;
                    case '.svg': contentType = 'image/svg+xml'; break;
                    case '.gif': contentType = 'image/gif'; break;
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

    private inferEntityType(name: string): string {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('player') || lowerName.includes('character')) return 'player';
        if (lowerName.includes('enemy') || lowerName.includes('monster')) return 'enemy';
        if (lowerName.includes('platform') || lowerName.includes('ground')) return 'platform';
        if (lowerName.includes('coin') || lowerName.includes('gem') || lowerName.includes('pickup')) return 'collectible';
        return 'sprite';
    }

    private getDefaultColor(name: string): string {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('player')) return '#4A90E2';
        if (lowerName.includes('enemy')) return '#E74C3C';
        if (lowerName.includes('platform')) return '#8B4513';
        if (lowerName.includes('coin')) return '#F1C40F';
        return '#9B59B6';
    }

    private generateId(): string {
        return 'entity_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}