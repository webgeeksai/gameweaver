/**
 * Enhanced Sprite Editor Server for Game Vibe Engine
 * Full-featured pixel art editor with real save/export, asset management, and advanced tools
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface PixelData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

interface SpriteProject {
    name: string;
    width: number;
    height: number;
    frames: PixelData[];
    frameRate: number;
    loop: boolean;
    layers: Layer[];
    palette: string[];
}

interface Layer {
    id: string;
    name: string;
    visible: boolean;
    opacity: number;
    imageData: PixelData;
}

export class EnhancedSpriteEditorServer {
    private server: http.Server | null = null;
    private port: number = 3002;
    private currentProject: SpriteProject | null = null;
    private assets: any[] = [];

    constructor() {
        this.port = this.findAvailablePort();
    }

    private findAvailablePort(): number {
        return 3002 + Math.floor(Math.random() * 1000);
    }

    async start(spriteData: string, workspaceRoot: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Load assets on startup
            this.loadAssets(workspaceRoot);
            
            // Parse existing sprite data
            this.parseSpriteData(spriteData);

            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res, spriteData, workspaceRoot);
            });

            this.server.listen(this.port, () => {
                const url = `http://localhost:${this.port}`;
                console.log(`🎨 Enhanced Sprite Editor Server started at ${url}`);
                resolve(url);
            });

            this.server.on('error', (error) => {
                console.error('Enhanced Sprite Editor Server error:', error);
                reject(error);
            });
        });
    }

    stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            console.log('🛑 Enhanced Sprite Editor Server stopped');
        }
    }

    private async loadAssets(workspaceRoot: string): Promise<void> {
        try {
            const assetsPath = path.join(workspaceRoot, 'assets');
            this.assets = [];

            if (fs.existsSync(assetsPath)) {
                const spritesPath = path.join(assetsPath, 'sprites');
                if (fs.existsSync(spritesPath)) {
                    const files = fs.readdirSync(spritesPath);
                    for (const file of files) {
                        if (file.match(/\.(png|svg|jpg|jpeg|gif)$/i)) {
                            this.assets.push({
                                name: path.parse(file).name,
                                path: path.join('assets', 'sprites', file),
                                type: 'sprite',
                                url: `/assets/sprites/${file}`
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading assets:', error);
        }
    }

    private parseSpriteData(spriteData: string): void {
        // Initialize default project if no data
        this.currentProject = {
            name: 'NewSprite',
            width: 32,
            height: 32,
            frames: [],
            frameRate: 12,
            loop: true,
            layers: [{
                id: 'layer_0',
                name: 'Layer 1',
                visible: true,
                opacity: 1,
                imageData: {
                    width: 32,
                    height: 32,
                    data: new Uint8ClampedArray(32 * 32 * 4)
                }
            }],
            palette: [
                '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
                '#ffff00', '#ff00ff', '#00ffff', '#808080', '#c0c0c0'
            ]
        };
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse, spriteData: string, workspaceRoot: string): void {
        const url = req.url || '/';
        console.log(`🎨 Enhanced Sprite Editor Request: ${req.method} ${url}`);

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
            this.serveSpriteEditorHTML(res);
        } else if (url === '/api/project') {
            this.serveProjectData(res);
        } else if (url === '/api/assets') {
            this.serveAssetsList(res);
        } else if (url.startsWith('/api/save-sprite') && req.method === 'POST') {
            this.handleSaveSprite(req, res, workspaceRoot);
        } else if (url.startsWith('/api/export-sprite') && req.method === 'POST') {
            this.handleExportSprite(req, res, workspaceRoot);
        } else if (url.startsWith('/api/save-animation') && req.method === 'POST') {
            this.handleSaveAnimation(req, res, workspaceRoot);
        } else if (url.startsWith('/api/load-sprite') && req.method === 'POST') {
            this.handleLoadSprite(req, res, workspaceRoot);
        } else if (url.startsWith('/assets/')) {
            this.serveAsset(res, url, workspaceRoot);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }

    private serveSpriteEditorHTML(res: http.ServerResponse): void {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Sprite Editor - Browser Edition</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
            background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
            color: #f0f6fc;
            overflow: hidden;
        }

        .icon {
            font-family: 'SF Pro Icons', -apple-system, BlinkMacSystemFont, monospace;
            font-weight: 400;
            font-style: normal;
            line-height: 1;
            display: inline-block;
        }

        .sprite-editor {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

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

        .toolbar-label {
            font-size: 11px;
            font-weight: 600;
            color: #8b949e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-right: 4px;
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

        .main-content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .left-panel {
            width: 320px;
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border-right: 2px solid #30363d;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
        }

        .canvas-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: linear-gradient(135deg, #21262d 0%, #2d333b 100%);
            position: relative;
            padding: 20px;
        }

        .canvas-workspace {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at center, rgba(88, 166, 255, 0.05) 0%, transparent 50%);
            border-radius: 12px;
            border: 1px solid #30363d;
            position: relative;
            overflow: hidden;
        }

        .canvas-workspace::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                repeating-linear-gradient(
                    45deg,
                    rgba(88, 166, 255, 0.02) 0px,
                    rgba(88, 166, 255, 0.02) 1px,
                    transparent 1px,
                    transparent 10px
                );
            pointer-events: none;
        }

        .canvas-container {
            position: relative;
            border: 3px solid #424a53;
            border-radius: 8px;
            background: 
                url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="8" height="8" fill="%23373e47"/><rect x="8" y="8" width="8" height="8" fill="%23373e47"/></svg>'),
                linear-gradient(135deg, #30363d 0%, #373e47 100%);
            box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.4),
                inset 0 0 0 1px rgba(88, 166, 255, 0.1);
            transition: all 0.3s ease;
        }

        .canvas-container:hover {
            border-color: #58a6ff;
            box-shadow: 
                0 12px 40px rgba(0, 0, 0, 0.5),
                0 0 0 1px #58a6ff,
                inset 0 0 0 1px rgba(88, 166, 255, 0.2);
        }

        .canvas-container.panning {
            border-color: #f85149;
            box-shadow: 
                0 12px 40px rgba(0, 0, 0, 0.5),
                0 0 0 2px #f85149,
                inset 0 0 0 1px rgba(248, 81, 73, 0.2);
        }

        .pixel-canvas {
            position: absolute;
            top: 0;
            left: 0;
            cursor: crosshair;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        }

        .grid-overlay {
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            opacity: 0.3;
        }

        .right-panel {
            width: 320px;
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border-left: 2px solid #30363d;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
        }

        .panel {
            border-bottom: 1px solid #30363d;
            display: flex;
            flex-direction: column;
        }

        .panel-header {
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

        .panel-content {
            padding: 16px;
            max-height: 240px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #424a53 #21262d;
        }

        .panel-content::-webkit-scrollbar {
            width: 6px;
        }

        .panel-content::-webkit-scrollbar-track {
            background: #21262d;
            border-radius: 3px;
        }

        .panel-content::-webkit-scrollbar-thumb {
            background: #424a53;
            border-radius: 3px;
        }

        .panel-content::-webkit-scrollbar-thumb:hover {
            background: #58a6ff;
        }

        .color-palette {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            margin-top: 12px;
        }

        .color-swatch {
            width: 32px;
            height: 32px;
            border: 2px solid #424a53;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .color-swatch::before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 8px;
            padding: 2px;
            background: linear-gradient(135deg, transparent, rgba(88, 166, 255, 0.3));
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: xor;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .color-swatch:hover {
            border-color: #58a6ff;
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .color-swatch:hover::before {
            opacity: 1;
        }

        .color-swatch.active {
            border-color: #58a6ff;
            box-shadow: 
                0 0 0 2px rgba(88, 166, 255, 0.3),
                0 4px 12px rgba(0, 0, 0, 0.3);
            transform: scale(1.05);
        }

        .color-swatch.active::before {
            opacity: 1;
        }

        .color-picker-section {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .color-picker-section {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding: 12px;
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border: 1px solid #30363d;
            border-radius: 8px;
        }

        .current-color {
            width: 48px;
            height: 48px;
            border: 3px solid #424a53;
            border-radius: 8px;
            position: relative;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: all 0.2s ease;
        }

        .current-color:hover {
            border-color: #58a6ff;
            transform: scale(1.05);
        }

        .current-color::before {
            content: '';
            position: absolute;
            inset: -1px;
            border-radius: 6px;
            background: linear-gradient(135deg, rgba(88, 166, 255, 0.2), transparent);
            z-index: -1;
        }

        .layer-item {
            display: flex;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #333;
        }

        .layer-visibility {
            width: 16px;
            height: 16px;
            margin-right: 8px;
            cursor: pointer;
        }

        .layer-name {
            flex: 1;
            font-size: 12px;
        }

        .animation-preview {
            margin-bottom: 16px;
            display: flex;
            justify-content: center;
        }

        .preview-container {
            position: relative;
            width: 80px;
            height: 80px;
            border: 2px solid #424a53;
            border-radius: 8px;
            background: 
                url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="4" height="4" fill="%23373e47"/><rect x="4" y="4" width="4" height="4" fill="%23373e47"/></svg>'),
                linear-gradient(135deg, #21262d 0%, #30363d 100%);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .preview-container canvas {
            width: 100%;
            height: 100%;
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            image-rendering: crisp-edges;
        }

        .preview-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
            padding: 4px 8px;
            pointer-events: none;
        }

        .preview-label {
            font-size: 10px;
            color: #8b949e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .animation-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding: 12px;
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border: 1px solid #30363d;
            border-radius: 8px;
        }

        .playback-controls {
            display: flex;
            gap: 6px;
        }

        .control-btn {
            background: #373e47;
            color: #f0f6fc;
            border: 1px solid #424a53;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s ease;
        }

        .control-btn:hover {
            background: #424a53;
            border-color: #58a6ff;
            transform: translateY(-1px);
        }

        .control-btn.active {
            background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
            border-color: #2ea043;
            color: #fff;
        }

        .fps-control {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #8b949e;
        }

        .frame-timeline {
            display: flex;
            gap: 8px;
            padding: 12px;
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border: 1px solid #30363d;
            border-radius: 8px;
            overflow-x: auto;
            scrollbar-width: thin;
            scrollbar-color: #424a53 #21262d;
        }

        .frame-timeline::-webkit-scrollbar {
            height: 6px;
        }

        .frame-timeline::-webkit-scrollbar-track {
            background: #21262d;
            border-radius: 3px;
        }

        .frame-timeline::-webkit-scrollbar-thumb {
            background: #424a53;
            border-radius: 3px;
        }

        .frame-item {
            min-width: 48px;
            height: 48px;
            border: 2px solid #424a53;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            background: linear-gradient(135deg, #30363d 0%, #373e47 100%);
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }

        .frame-item::before {
            content: '';
            position: absolute;
            inset: 0;
            background: 
                url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="6" height="6"><rect width="3" height="3" fill="%23424a53"/><rect x="3" y="3" width="3" height="3" fill="%23424a53"/></svg>');
            opacity: 0.3;
        }

        .frame-item:hover {
            border-color: #58a6ff;
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .frame-item.active {
            border-color: #58a6ff;
            box-shadow: 
                0 0 0 2px rgba(88, 166, 255, 0.3),
                0 4px 12px rgba(0, 0, 0, 0.3);
            background: linear-gradient(135deg, #1f6feb 0%, #238636 100%);
        }

        .tool-options {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .option-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .option-group label {
            font-size: 11px;
            color: #ccc;
        }

        .range-input {
            width: 100%;
        }

        .asset-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .asset-item {
            display: flex;
            align-items: center;
            padding: 6px;
            border: 1px solid #3a3a3a;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .asset-item:hover {
            background: #3a3a3a;
        }

        .asset-thumbnail {
            width: 32px;
            height: 32px;
            border: 1px solid #555;
            border-radius: 2px;
            margin-right: 8px;
            background: #444;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .asset-thumbnail img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .canvas-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 0 4px;
        }

        .canvas-controls {
            display: flex;
            align-items: center;
            gap: 12px;
            background: linear-gradient(135deg, #21262d 0%, #30363d 100%);
            border: 1px solid #424a53;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .canvas-info-bar {
            display: flex;
            align-items: center;
            gap: 16px;
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border: 1px solid #30363d;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 12px;
            color: #8b949e;
        }

        .canvas-info-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .canvas-info-item .icon {
            color: #58a6ff;
        }

        .canvas-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 16px;
            padding: 0 4px;
        }

        .pixel-info {
            background: linear-gradient(135deg, #161b22 0%, #21262d 100%);
            border: 1px solid #30363d;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            color: #8b949e;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        }

        .canvas-zoom-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, #21262d 0%, #30363d 100%);
            border: 1px solid #424a53;
            padding: 6px 12px;
            border-radius: 6px;
        }

        .zoom-btn {
            background: #373e47;
            color: #f0f6fc;
            border: 1px solid #424a53;
            width: 28px;
            height: 28px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s ease;
        }

        .zoom-btn:hover {
            background: #424a53;
            border-color: #58a6ff;
        }

        .zoom-level {
            min-width: 50px;
            text-align: center;
            font-size: 12px;
            color: #8b949e;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        }

        .animation-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .input-small {
            width: 70px;
            padding: 6px 10px;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            color: #f0f6fc;
            font-size: 12px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
            text-align: center;
            transition: all 0.2s ease;
        }

        .input-small:focus {
            outline: none;
            border-color: #58a6ff;
            box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2);
            background: #21262d;
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
        }

        .loading.hidden { display: none; }

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

        .canvas-container.panning {
            cursor: grabbing !important;
        }

        .canvas-container.panning * {
            cursor: grabbing !important;
        }
    </style>
</head>
<body>
    <div class="sprite-editor">
        <div class="header">
            <div class="header-content">
                <div class="header-title">
                    <span class="icon">■</span> Sprite Editor
                    <span style="font-size: 12px; color: #8b949e; font-weight: 400;">Enhanced Edition</span>
                </div>
                <div class="header-actions">
                    <button class="header-btn secondary" onclick="newSprite()"><span class="icon">✐</span> New</button>
                    <button class="header-btn secondary" onclick="loadSprite()"><span class="icon">⌘</span> Open</button>
                    <button class="header-btn" onclick="saveSprite()"><span class="icon">▪</span> Save</button>
                    <button class="header-btn secondary" onclick="exportSprite()"><span class="icon">↗</span> Export</button>
                </div>
            </div>
        </div>
        <div class="toolbar">
            <div class="toolbar-section">
                <span class="toolbar-label">History</span>
                <button class="tool-btn" onclick="undo()"><span class="icon">↶</span> Undo</button>
                <button class="tool-btn" onclick="redo()"><span class="icon">↷</span> Redo</button>
            </div>
            <div class="toolbar-section">
                <span class="toolbar-label">Tools</span>
                <button id="brush-tool" class="tool-btn active" onclick="setTool('brush')"><span class="icon">◐</span> Brush</button>
                <button id="pencil-tool" class="tool-btn" onclick="setTool('pencil')"><span class="icon">✎</span> Pencil</button>
                <button id="eraser-tool" class="tool-btn" onclick="setTool('eraser')"><span class="icon">⌫</span> Eraser</button>
                <button id="fill-tool" class="tool-btn" onclick="setTool('fill')"><span class="icon">▪</span> Fill</button>
                <button id="eyedropper-tool" class="tool-btn" onclick="setTool('eyedropper')"><span class="icon">◌</span> Picker</button>
                <button id="pan-tool" class="tool-btn" onclick="setTool('pan')" title="Pan Tool (H)"><span class="icon">✥</span> Pan</button>
            </div>
            <div class="toolbar-section">
                <span class="toolbar-label">View</span>
                <button class="tool-btn" onclick="toggleGrid()"><span class="icon">#</span> Grid</button>
                <button class="tool-btn" onclick="zoomIn()"><span class="icon">+</span> Zoom In</button>
                <button class="tool-btn" onclick="zoomOut()"><span class="icon">−</span> Zoom Out</button>
                <button class="tool-btn" onclick="resetPan()" title="Reset Pan (R)"><span class="icon">⌂</span> Reset</button>
            </div>
        </div>

        <div class="main-content">
            <div class="left-panel">
                <div class="panel">
                    <div class="panel-header">
                        <span>Color Palette</span>
                        <button class="tool-btn" onclick="addColor()"><span class="icon">+</span></button>
                    </div>
                    <div class="panel-content">
                        <div class="color-picker-section">
                            <input type="color" id="color-picker" value="#000000" onchange="updateCurrentColor(this.value)">
                            <div id="current-color" class="current-color" style="background: #000000;"></div>
                        </div>
                        <div id="color-palette" class="color-palette">
                            <!-- Color swatches will be generated here -->
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <span>Layers</span>
                        <button class="tool-btn" onclick="addLayer()"><span class="icon">+</span></button>
                    </div>
                    <div class="panel-content">
                        <div id="layers-list">
                            <!-- Layers will be generated here -->
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <span>Tool Options</span>
                    </div>
                    <div class="panel-content">
                        <div class="tool-options">
                            <div class="option-group">
                                <label>Brush Size:</label>
                                <input type="range" id="brush-size" class="range-input" min="1" max="20" value="1" onchange="updateBrushSize(this.value)">
                                <span id="brush-size-value">1px</span>
                            </div>
                            <div class="option-group">
                                <label>Opacity:</label>
                                <input type="range" id="opacity" class="range-input" min="0" max="100" value="100" onchange="updateOpacity(this.value)">
                                <span id="opacity-value">100%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="canvas-area">
                <div class="canvas-header">
                    <div class="canvas-controls">
                        <div class="canvas-info-item">
                            <span class="icon">◆</span>
                            <span>Size:</span>
                        </div>
                        <input type="number" id="canvas-width" class="input-small" value="32" min="1" max="512" onchange="resizeCanvas()">
                        <span>×</span>
                        <input type="number" id="canvas-height" class="input-small" value="32" min="1" max="512" onchange="resizeCanvas()">
                    </div>
                    <div class="canvas-info-bar">
                        <div class="canvas-info-item">
                            <span class="icon">◐</span>
                            <span>Zoom:</span>
                            <select id="zoom-level" class="input-small" onchange="setZoom(this.value)">
                                <option value="1">100%</option>
                                <option value="2">200%</option>
                                <option value="4" selected>400%</option>
                                <option value="8">800%</option>
                                <option value="16">1600%</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="canvas-workspace">
                    <div id="canvas-container" class="canvas-container">
                        <canvas id="sprite-canvas" class="pixel-canvas"></canvas>
                        <canvas id="grid-canvas" class="grid-overlay"></canvas>
                    </div>
                </div>

                <div class="canvas-footer">
                    <div class="pixel-info">
                        <span id="pixel-info">Pixel: (0, 0)</span>
                    </div>
                    <div class="canvas-zoom-controls">
                        <button class="zoom-btn" onclick="zoomOut()" title="Zoom Out">−</button>
                        <span class="zoom-level" id="zoom-display">400%</span>
                        <button class="zoom-btn" onclick="zoomIn()" title="Zoom In">+</button>
                    </div>
                </div>
            </div>

            <div class="right-panel">
                <div class="panel">
                    <div class="panel-header">
                        <span>Animation</span>
                        <button class="tool-btn" onclick="addFrame()"><span class="icon">+</span></button>
                    </div>
                    <div class="panel-content">
                        <div class="animation-preview">
                            <div class="preview-container">
                                <canvas id="preview-canvas" width="64" height="64"></canvas>
                                <div class="preview-overlay">
                                    <span class="preview-label">Preview</span>
                                </div>
                            </div>
                        </div>
                        <div class="animation-controls">
                            <div class="playback-controls">
                                <button class="control-btn play-btn" onclick="playAnimation()"><span class="icon">▶</span></button>
                                <button class="control-btn stop-btn" onclick="stopAnimation()"><span class="icon">■</span></button>
                                <button class="control-btn loop-btn active" onclick="toggleLoop()"><span class="icon">↻</span></button>
                            </div>
                            <div class="fps-control">
                                <label>FPS:</label>
                                <input type="number" id="frame-rate" class="input-small" value="12" min="1" max="60" onchange="updateFrameRate(this.value)">
                            </div>
                        </div>
                        <div id="frame-timeline" class="frame-timeline">
                            <!-- Animation frames will be generated here -->
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <span>Assets</span>
                        <button class="tool-btn" onclick="refreshAssets()"><span class="icon">↻</span></button>
                    </div>
                    <div class="panel-content">
                        <div id="asset-list" class="asset-list">
                            <!-- Assets will be loaded here -->
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <div class="panel-header">
                        <span>Export</span>
                    </div>
                    <div class="panel-content">
                        <div class="option-group">
                            <label>Format:</label>
                            <select id="export-format" class="input-small">
                                <option value="png">PNG</option>
                                <option value="svg">SVG</option>
                                <option value="gif">GIF Animation</option>
                            </select>
                        </div>
                        <div class="option-group">
                            <label>Scale:</label>
                            <select id="export-scale" class="input-small">
                                <option value="1">1x</option>
                                <option value="2">2x</option>
                                <option value="4">4x</option>
                                <option value="8">8x</option>
                            </select>
                        </div>
                        <button class="tool-btn" onclick="quickExport()">Quick Export</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="loading" class="loading hidden">
        <div class="spinner"></div>
        <span>Processing...</span>
    </div>

    <script>
        class EnhancedSpriteEditor {
            constructor() {
                this.canvas = document.getElementById('sprite-canvas');
                this.ctx = this.canvas.getContext('2d');
                this.gridCanvas = document.getElementById('grid-canvas');
                this.gridCtx = this.gridCanvas.getContext('2d');
                
                this.width = 32;
                this.height = 32;
                this.zoom = 4;
                this.showGrid = true;
                this.currentTool = 'brush';
                this.currentColor = '#000000';
                this.brushSize = 1;
                this.opacity = 1;
                
                this.frames = [];
                this.currentFrame = 0;
                this.frameRate = 12;
                this.isPlaying = false;
                this.animationId = null;
                this.loop = true;
                
                this.layers = [];
                this.currentLayer = 0;
                
                this.palette = [
                    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
                    '#ffff00', '#ff00ff', '#00ffff', '#808080', '#c0c0c0'
                ];
                
                this.undoStack = [];
                this.redoStack = [];
                this.maxUndoStack = 50;
                
                this.isDrawing = false;
                this.lastX = 0;
                this.lastY = 0;
                
                // Panning state
                this.isPanning = false;
                this.panStartX = 0;
                this.panStartY = 0;
                this.panOffsetX = 0;
                this.panOffsetY = 0;
                
                this.initializeCanvas();
                this.setupEventListeners();
                this.initializeProject();
                this.loadAssets();
                this.render();
            }

            initializeCanvas() {
                this.resizeCanvas();
                this.ctx.imageSmoothingEnabled = false;
                this.ctx.mozImageSmoothingEnabled = false;
                this.ctx.webkitImageSmoothingEnabled = false;
                this.ctx.msImageSmoothingEnabled = false;
            }

            resizeCanvas() {
                const width = parseInt(document.getElementById('canvas-width').value);
                const height = parseInt(document.getElementById('canvas-height').value);
                
                this.width = width;
                this.height = height;
                
                const displayWidth = width * this.zoom;
                const displayHeight = height * this.zoom;
                
                this.canvas.width = width;
                this.canvas.height = height;
                this.canvas.style.width = displayWidth + 'px';
                this.canvas.style.height = displayHeight + 'px';
                
                this.gridCanvas.width = width;
                this.gridCanvas.height = height;
                this.gridCanvas.style.width = displayWidth + 'px';
                this.gridCanvas.style.height = displayHeight + 'px';
                
                this.drawGrid();
                this.render();
            }

            setupEventListeners() {
                this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
                this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
                this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
                this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
                this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
                
                // Prevent middle mouse button scrolling
                this.canvas.addEventListener('wheel', (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        // Could add zoom with wheel + ctrl here
                    }
                });
                
                document.addEventListener('keydown', (e) => this.onKeyDown(e));
            }

            initializeProject() {
                // Initialize first frame
                this.frames = [this.ctx.createImageData(this.width, this.height)];
                this.currentFrame = 0;
                
                // Initialize first layer
                this.layers = [{
                    id: 'layer_0',
                    name: 'Layer 1',
                    visible: true,
                    opacity: 1
                }];
                this.currentLayer = 0;
                
                this.updatePalette();
                this.updateLayers();
                this.updateFrameTimeline();
                this.saveState();
            }

            getPixelCoords(e) {
                const container = document.getElementById('canvas-container');
                const rect = container ? container.getBoundingClientRect() : this.canvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / this.zoom);
                const y = Math.floor((e.clientY - rect.top) / this.zoom);
                return { x, y };
            }

            getScreenCoords(e) {
                const rect = this.canvas.getBoundingClientRect();
                return {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
            }

            onMouseDown(e) {
                // Allow panning with middle mouse button or pan tool with left button
                if (e.button === 1 || (e.button === 0 && this.currentTool === 'pan')) {
                    e.preventDefault();
                    const screenCoords = this.getScreenCoords(e);
                    this.isPanning = true;
                    this.panStartX = screenCoords.x;
                    this.panStartY = screenCoords.y;
                    this.canvas.style.cursor = 'grabbing';
                    document.getElementById('canvas-container').classList.add('panning');
                    return;
                }
                
                if (e.button !== 0) return; // Only left mouse button for drawing tools
                
                const coords = this.getPixelCoords(e);
                this.isDrawing = true;
                this.lastX = coords.x;
                this.lastY = coords.y;
                
                this.performToolAction(coords.x, coords.y, e);
            }

            onMouseMove(e) {
                if (this.isPanning) {
                    const screenCoords = this.getScreenCoords(e);
                    const deltaX = screenCoords.x - this.panStartX;
                    const deltaY = screenCoords.y - this.panStartY;
                    
                    this.panOffsetX += deltaX;
                    this.panOffsetY += deltaY;
                    
                    this.panStartX = screenCoords.x;
                    this.panStartY = screenCoords.y;
                    
                    this.updateCanvasTransform();
                } else {
                    const coords = this.getPixelCoords(e);
                    document.getElementById('pixel-info').textContent = \`Pixel: (\${coords.x}, \${coords.y})\`;
                    
                    if (this.isDrawing) {
                        this.performToolAction(coords.x, coords.y, e);
                    }
                    
                    this.lastX = coords.x;
                    this.lastY = coords.y;
                }
            }

            onMouseUp(e) {
                if (this.isPanning) {
                    this.isPanning = false;
                    document.getElementById('canvas-container').classList.remove('panning');
                    if (this.currentTool === 'pan') {
                        this.canvas.style.cursor = 'grab';
                    } else {
                        // Reset cursor to default tool cursor
                        const cursors = {
                            'brush': 'crosshair',
                            'pencil': 'crosshair',
                            'eraser': 'crosshair',
                            'fill': 'crosshair',
                            'eyedropper': 'crosshair'
                        };
                        this.canvas.style.cursor = cursors[this.currentTool] || 'default';
                    }
                } else if (this.isDrawing) {
                    this.isDrawing = false;
                    this.saveState();
                }
            }

            onKeyDown(e) {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key.toLowerCase()) {
                        case 'z':
                            e.preventDefault();
                            if (e.shiftKey) {
                                this.redo();
                            } else {
                                this.undo();
                            }
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
                } else {
                    switch (e.key.toLowerCase()) {
                        case 'b': this.setTool('brush'); break;
                        case 'e': this.setTool('eraser'); break;
                        case 'f': this.setTool('fill'); break;
                        case 'i': this.setTool('eyedropper'); break;
                        case 'p': this.setTool('pencil'); break;
                        case 'h': this.setTool('pan'); break;
                        case 'g': this.toggleGrid(); break;
                        case 'r': this.resetPan(); break;
                    }
                }
            }

            performToolAction(x, y, e) {
                if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

                switch (this.currentTool) {
                    case 'brush':
                    case 'pencil':
                        this.drawPixel(x, y, this.currentColor);
                        break;
                    case 'eraser':
                        this.drawPixel(x, y, 'transparent');
                        break;
                    case 'fill':
                        if (!this.isDrawing) { // Only on mouse down
                            this.floodFill(x, y, this.currentColor);
                        }
                        break;
                    case 'eyedropper':
                        if (!this.isDrawing) { // Only on mouse down
                            const color = this.getPixelColor(x, y);
                            if (color) {
                                this.setCurrentColor(color);
                            }
                        }
                        break;
                }
            }

            drawPixel(x, y, color) {
                const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
                const brushSize = this.brushSize;
                
                for (let dy = -Math.floor(brushSize/2); dy <= Math.floor(brushSize/2); dy++) {
                    for (let dx = -Math.floor(brushSize/2); dx <= Math.floor(brushSize/2); dx++) {
                        const px = x + dx;
                        const py = y + dy;
                        
                        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                            const distance = Math.sqrt(dx*dx + dy*dy);
                            if (distance <= brushSize/2) {
                                const index = (py * this.width + px) * 4;
                                
                                if (color === 'transparent') {
                                    imageData.data[index + 3] = 0; // Alpha
                                } else {
                                    const rgb = this.hexToRgb(color);
                                    const alpha = Math.round(this.opacity * 255);
                                    
                                    imageData.data[index] = rgb.r;     // Red
                                    imageData.data[index + 1] = rgb.g; // Green
                                    imageData.data[index + 2] = rgb.b; // Blue
                                    imageData.data[index + 3] = alpha; // Alpha
                                }
                            }
                        }
                    }
                }
                
                this.ctx.putImageData(imageData, 0, 0);
                this.frames[this.currentFrame] = imageData;
            }

            floodFill(startX, startY, fillColor) {
                const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
                const startIndex = (startY * this.width + startX) * 4;
                
                const startR = imageData.data[startIndex];
                const startG = imageData.data[startIndex + 1];
                const startB = imageData.data[startIndex + 2];
                const startA = imageData.data[startIndex + 3];
                
                const fillRgb = this.hexToRgb(fillColor);
                const fillA = Math.round(this.opacity * 255);
                
                // Don't fill if already the same color
                if (startR === fillRgb.r && startG === fillRgb.g && startB === fillRgb.b && startA === fillA) {
                    return;
                }
                
                const stack = [[startX, startY]];
                const visited = new Set();
                
                while (stack.length > 0) {
                    const [x, y] = stack.pop();
                    
                    if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
                    
                    const key = \`\${x},\${y}\`;
                    if (visited.has(key)) continue;
                    visited.add(key);
                    
                    const index = (y * this.width + x) * 4;
                    
                    // Check if pixel matches start color
                    if (imageData.data[index] === startR &&
                        imageData.data[index + 1] === startG &&
                        imageData.data[index + 2] === startB &&
                        imageData.data[index + 3] === startA) {
                        
                        // Fill pixel
                        imageData.data[index] = fillRgb.r;
                        imageData.data[index + 1] = fillRgb.g;
                        imageData.data[index + 2] = fillRgb.b;
                        imageData.data[index + 3] = fillA;
                        
                        // Add neighbors to stack
                        stack.push([x + 1, y]);
                        stack.push([x - 1, y]);
                        stack.push([x, y + 1]);
                        stack.push([x, y - 1]);
                    }
                }
                
                this.ctx.putImageData(imageData, 0, 0);
                this.frames[this.currentFrame] = imageData;
            }

            getPixelColor(x, y) {
                const imageData = this.ctx.getImageData(x, y, 1, 1);
                const data = imageData.data;
                
                if (data[3] === 0) return null; // Transparent
                
                return this.rgbToHex(data[0], data[1], data[2]);
            }

            hexToRgb(hex) {
                const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }

            rgbToHex(r, g, b) {
                return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
            }

            setTool(tool) {
                this.currentTool = tool;
                document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById(tool + '-tool').classList.add('active');
                
                const cursors = {
                    'brush': 'crosshair',
                    'pencil': 'crosshair',
                    'eraser': 'crosshair',
                    'fill': 'crosshair',
                    'eyedropper': 'crosshair',
                    'pan': 'grab'
                };
                this.canvas.style.cursor = cursors[tool] || 'default';
            }

            setCurrentColor(color) {
                this.currentColor = color;
                document.getElementById('color-picker').value = color;
                document.getElementById('current-color').style.backgroundColor = color;
            }

            updatePalette() {
                const paletteContainer = document.getElementById('color-palette');
                paletteContainer.innerHTML = '';
                
                this.palette.forEach((color, index) => {
                    const swatch = document.createElement('div');
                    swatch.className = 'color-swatch';
                    swatch.style.backgroundColor = color;
                    swatch.onclick = () => this.setCurrentColor(color);
                    
                    if (color === this.currentColor) {
                        swatch.classList.add('active');
                    }
                    
                    paletteContainer.appendChild(swatch);
                });
            }

            updateLayers() {
                const layersContainer = document.getElementById('layers-list');
                layersContainer.innerHTML = '';
                
                this.layers.forEach((layer, index) => {
                    const layerItem = document.createElement('div');
                    layerItem.className = 'layer-item';
                    if (index === this.currentLayer) {
                        layerItem.style.backgroundColor = '#007acc';
                    }
                    
                    layerItem.innerHTML = \`
                        <input type="checkbox" class="layer-visibility" \${layer.visible ? 'checked' : ''} 
                               onchange="spriteEditor.toggleLayerVisibility(\${index})">
                        <span class="layer-name">\${layer.name}</span>
                    \`;
                    
                    layerItem.onclick = (e) => {
                        if (e.target.type !== 'checkbox') {
                            this.selectLayer(index);
                        }
                    };
                    
                    layersContainer.appendChild(layerItem);
                });
            }

            updateFrameTimeline() {
                const timelineContainer = document.getElementById('frame-timeline');
                timelineContainer.innerHTML = '';
                
                this.frames.forEach((frame, index) => {
                    const frameItem = document.createElement('div');
                    frameItem.className = 'frame-item';
                    if (index === this.currentFrame) {
                        frameItem.classList.add('active');
                    }
                    
                    frameItem.textContent = index + 1;
                    frameItem.onclick = () => this.selectFrame(index);
                    
                    timelineContainer.appendChild(frameItem);
                });
            }

            selectFrame(index) {
                if (index >= 0 && index < this.frames.length) {
                    this.currentFrame = index;
                    this.ctx.putImageData(this.frames[index], 0, 0);
                    this.updateFrameTimeline();
                }
            }

            selectLayer(index) {
                if (index >= 0 && index < this.layers.length) {
                    this.currentLayer = index;
                    this.updateLayers();
                }
            }

            addFrame() {
                const newFrame = this.ctx.createImageData(this.width, this.height);
                // Copy current frame
                const currentImageData = this.ctx.getImageData(0, 0, this.width, this.height);
                newFrame.data.set(currentImageData.data);
                
                this.frames.push(newFrame);
                this.currentFrame = this.frames.length - 1;
                this.updateFrameTimeline();
                this.saveState();
            }

            addLayer() {
                const newLayer = {
                    id: \`layer_\${this.layers.length}\`,
                    name: \`Layer \${this.layers.length + 1}\`,
                    visible: true,
                    opacity: 1
                };
                
                this.layers.push(newLayer);
                this.currentLayer = this.layers.length - 1;
                this.updateLayers();
                this.saveState();
            }

            toggleLayerVisibility(index) {
                if (index >= 0 && index < this.layers.length) {
                    this.layers[index].visible = !this.layers[index].visible;
                    this.render();
                }
            }

            playAnimation() {
                if (this.isPlaying) return;
                
                this.isPlaying = true;
                let frameIndex = this.currentFrame;
                
                const animate = () => {
                    if (!this.isPlaying) return;
                    
                    this.selectFrame(frameIndex);
                    frameIndex++;
                    
                    if (frameIndex >= this.frames.length) {
                        if (this.loop) {
                            frameIndex = 0;
                        } else {
                            this.stopAnimation();
                            return;
                        }
                    }
                    
                    this.animationId = setTimeout(animate, 1000 / this.frameRate);
                };
                
                animate();
            }

            stopAnimation() {
                this.isPlaying = false;
                if (this.animationId) {
                    clearTimeout(this.animationId);
                    this.animationId = null;
                }
            }

            drawGrid() {
                if (!this.showGrid) {
                    this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
                    return;
                }
                
                this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
                this.gridCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.gridCtx.lineWidth = 1;
                
                // Draw vertical lines
                for (let x = 0; x <= this.width; x++) {
                    this.gridCtx.beginPath();
                    this.gridCtx.moveTo(x, 0);
                    this.gridCtx.lineTo(x, this.height);
                    this.gridCtx.stroke();
                }
                
                // Draw horizontal lines
                for (let y = 0; y <= this.height; y++) {
                    this.gridCtx.beginPath();
                    this.gridCtx.moveTo(0, y);
                    this.gridCtx.lineTo(this.width, y);
                    this.gridCtx.stroke();
                }
            }

            toggleGrid() {
                this.showGrid = !this.showGrid;
                this.drawGrid();
            }

            setZoom(zoom) {
                this.zoom = parseInt(zoom);
                this.resizeCanvas();
            }

            zoomIn() {
                if (this.zoom < 16) {
                    this.zoom *= 2;
                    document.getElementById('zoom-level').value = this.zoom;
                    document.getElementById('zoom-display').textContent = Math.round(this.zoom * 100) + '%';
                    this.resizeCanvas();
                }
            }

            zoomOut() {
                if (this.zoom > 1) {
                    this.zoom /= 2;
                    document.getElementById('zoom-level').value = this.zoom;
                    document.getElementById('zoom-display').textContent = Math.round(this.zoom * 100) + '%';
                    this.resizeCanvas();
                }
            }

            setZoom(zoom) {
                this.zoom = parseInt(zoom);
                document.getElementById('zoom-display').textContent = Math.round(this.zoom * 100) + '%';
                this.resizeCanvas();
            }

            updateCanvasTransform() {
                const container = document.getElementById('canvas-container');
                if (container) {
                    container.style.transform = 'translate(' + this.panOffsetX + 'px, ' + this.panOffsetY + 'px)';
                }
            }

            resetPan() {
                this.panOffsetX = 0;
                this.panOffsetY = 0;
                this.updateCanvasTransform();
            }

            updatePreview() {
                const previewCanvas = document.getElementById('preview-canvas');
                if (!previewCanvas || !this.frames[this.currentFrame]) return;
                
                const previewCtx = previewCanvas.getContext('2d');
                previewCtx.clearRect(0, 0, 64, 64);
                
                // Scale current frame to preview size
                previewCtx.imageSmoothingEnabled = false;
                previewCtx.scale(64 / this.width, 64 / this.height);
                previewCtx.putImageData(this.frames[this.currentFrame], 0, 0);
                previewCtx.setTransform(1, 0, 0, 1, 0, 0);
            }

            render() {
                // Main rendering is handled by canvas operations
                this.drawGrid();
                this.updatePreview();
            }

            saveState() {
                const state = {
                    imageData: this.ctx.getImageData(0, 0, this.width, this.height),
                    frames: this.frames.map(frame => {
                        const copy = this.ctx.createImageData(frame.width, frame.height);
                        copy.data.set(frame.data);
                        return copy;
                    }),
                    currentFrame: this.currentFrame
                };
                
                this.undoStack.push(state);
                this.redoStack = [];
                
                if (this.undoStack.length > this.maxUndoStack) {
                    this.undoStack.shift();
                }
            }

            undo() {
                if (this.undoStack.length === 0) return;
                
                const currentState = {
                    imageData: this.ctx.getImageData(0, 0, this.width, this.height),
                    frames: this.frames.map(frame => {
                        const copy = this.ctx.createImageData(frame.width, frame.height);
                        copy.data.set(frame.data);
                        return copy;
                    }),
                    currentFrame: this.currentFrame
                };
                
                this.redoStack.push(currentState);
                
                const previousState = this.undoStack.pop();
                this.ctx.putImageData(previousState.imageData, 0, 0);
                this.frames = previousState.frames;
                this.currentFrame = previousState.currentFrame;
                
                this.updateFrameTimeline();
            }

            redo() {
                if (this.redoStack.length === 0) return;
                
                const currentState = {
                    imageData: this.ctx.getImageData(0, 0, this.width, this.height),
                    frames: this.frames.map(frame => {
                        const copy = this.ctx.createImageData(frame.width, frame.height);
                        copy.data.set(frame.data);
                        return copy;
                    }),
                    currentFrame: this.currentFrame
                };
                
                this.undoStack.push(currentState);
                
                const nextState = this.redoStack.pop();
                this.ctx.putImageData(nextState.imageData, 0, 0);
                this.frames = nextState.frames;
                this.currentFrame = nextState.currentFrame;
                
                this.updateFrameTimeline();
            }

            async saveSprite() {
                try {
                    this.showLoading(true);
                    
                    // Prepare sprite data
                    const spriteData = {
                        name: prompt('Sprite name:', 'MySprite') || 'MySprite',
                        width: this.width,
                        height: this.height,
                        frames: this.frames.map(frame => {
                            // Convert ImageData to base64
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = this.width;
                            tempCanvas.height = this.height;
                            const tempCtx = tempCanvas.getContext('2d');
                            tempCtx.putImageData(frame, 0, 0);
                            return tempCanvas.toDataURL();
                        }),
                        frameRate: this.frameRate,
                        layers: this.layers,
                        palette: this.palette
                    };
                    
                    const response = await fetch('/api/save-sprite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(spriteData)
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        alert('Sprite saved successfully!');
                    } else {
                        alert('Failed to save sprite: ' + result.error);
                    }
                } catch (error) {
                    alert('Error saving sprite: ' + error.message);
                } finally {
                    this.showLoading(false);
                }
            }

            async exportSprite() {
                try {
                    this.showLoading(true);
                    
                    const format = document.getElementById('export-format').value;
                    const scale = parseInt(document.getElementById('export-scale').value);
                    
                    let exportData;
                    if (format === 'gif' && this.frames.length > 1) {
                        // Export as animated GIF
                        exportData = await this.exportAnimatedGif(scale);
                    } else {
                        // Export current frame
                        exportData = await this.exportStaticImage(format, scale);
                    }
                    
                    const response = await fetch('/api/export-sprite', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            format,
                            scale,
                            data: exportData,
                            name: prompt('Export name:', 'sprite_export') || 'sprite_export'
                        })
                    });
                    
                    const result = await response.json();
                    if (result.success) {
                        alert('Sprite exported successfully!');
                    } else {
                        alert('Failed to export sprite: ' + result.error);
                    }
                } catch (error) {
                    alert('Error exporting sprite: ' + error.message);
                } finally {
                    this.showLoading(false);
                }
            }

            async exportStaticImage(format, scale) {
                const exportCanvas = document.createElement('canvas');
                exportCanvas.width = this.width * scale;
                exportCanvas.height = this.height * scale;
                const exportCtx = exportCanvas.getContext('2d');
                
                exportCtx.imageSmoothingEnabled = false;
                exportCtx.scale(scale, scale);
                exportCtx.putImageData(this.frames[this.currentFrame], 0, 0);
                
                return exportCanvas.toDataURL(\`image/\${format}\`);
            }

            async loadAssets() {
                try {
                    const response = await fetch('/api/assets');
                    const assets = await response.json();
                    
                    const assetList = document.getElementById('asset-list');
                    assetList.innerHTML = '';
                    
                    assets.forEach(asset => {
                        const item = document.createElement('div');
                        item.className = 'asset-item';
                        
                        item.innerHTML = \`
                            <div class="asset-thumbnail">
                                <img src="\${asset.url}" alt="\${asset.name}" onerror="this.style.display='none';">
                            </div>
                            <div>
                                <div style="font-size: 12px; font-weight: 500;">\${asset.name}</div>
                                <div style="font-size: 10px; color: #aaa;">\${asset.type}</div>
                            </div>
                        \`;
                        
                        item.onclick = () => this.loadAsset(asset);
                        assetList.appendChild(item);
                    });
                } catch (error) {
                    console.error('Error loading assets:', error);
                }
            }

            loadAsset(asset) {
                if (confirm(\`Load \${asset.name}? This will replace the current sprite.\`)) {
                    const img = new Image();
                    img.onload = () => {
                        this.width = img.width;
                        this.height = img.height;
                        document.getElementById('canvas-width').value = this.width;
                        document.getElementById('canvas-height').value = this.height;
                        
                        this.resizeCanvas();
                        this.ctx.drawImage(img, 0, 0);
                        
                        // Update current frame with loaded image
                        this.frames[this.currentFrame] = this.ctx.getImageData(0, 0, this.width, this.height);
                        this.saveState();
                    };
                    img.src = asset.url;
                }
            }

            showLoading(show) {
                const loading = document.getElementById('loading');
                loading.classList.toggle('hidden', !show);
            }
        }

        // Global instance
        let spriteEditor;

        // Global functions for HTML events
        function setTool(tool) { spriteEditor.setTool(tool); }
        function newSprite() { location.reload(); }
        function loadSprite() { spriteEditor.loadAssets(); }
        function saveSprite() { spriteEditor.saveSprite(); }
        function exportSprite() { spriteEditor.exportSprite(); }
        function quickExport() { spriteEditor.exportSprite(); }
        function undo() { spriteEditor.undo(); }
        function redo() { spriteEditor.redo(); }
        function toggleGrid() { spriteEditor.toggleGrid(); }
        function zoomIn() { spriteEditor.zoomIn(); }
        function zoomOut() { spriteEditor.zoomOut(); }
        function setZoom(zoom) { spriteEditor.setZoom(zoom); }
        function addColor() { 
            const color = prompt('Enter hex color:', '#ff0000');
            if (color) {
                spriteEditor.palette.push(color);
                spriteEditor.updatePalette();
            }
        }
        function addLayer() { spriteEditor.addLayer(); }
        function addFrame() { spriteEditor.addFrame(); }
        function playAnimation() { spriteEditor.playAnimation(); }
        function stopAnimation() { spriteEditor.stopAnimation(); }
        function refreshAssets() { spriteEditor.loadAssets(); }
        function updateCurrentColor(color) { spriteEditor.setCurrentColor(color); }
        function updateBrushSize(size) { 
            spriteEditor.brushSize = parseInt(size);
            document.getElementById('brush-size-value').textContent = size + 'px';
        }
        function updateOpacity(opacity) { 
            spriteEditor.opacity = parseFloat(opacity) / 100;
            document.getElementById('opacity-value').textContent = opacity + '%';
        }
        function updateFrameRate(rate) { spriteEditor.frameRate = parseInt(rate); }
        function resizeCanvas() { spriteEditor.resizeCanvas(); }
        function toggleLoop() { 
            spriteEditor.loop = !spriteEditor.loop;
            document.querySelector('.loop-btn').classList.toggle('active', spriteEditor.loop);
        }
        function resetPan() { spriteEditor.resetPan(); }

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', () => {
            spriteEditor = new EnhancedSpriteEditor();
        });
    </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    private serveProjectData(res: http.ServerResponse): void {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.currentProject));
    }

    private serveAssetsList(res: http.ServerResponse): void {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.assets));
    }

    private async handleSaveSprite(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const spriteData = JSON.parse(body);
                
                // Save to project assets
                const spritesPath = path.join(workspaceRoot, 'assets', 'sprites');
                if (!fs.existsSync(spritesPath)) {
                    fs.mkdirSync(spritesPath, { recursive: true });
                }

                // Save as PNG
                const canvas = require('canvas');
                const canvasInstance = canvas.createCanvas(spriteData.width, spriteData.height);
                const ctx = canvasInstance.getContext('2d');
                
                // Use first frame data
                if (spriteData.frames.length > 0) {
                    const img = canvas.loadImage(spriteData.frames[0]);
                    ctx.drawImage(await img, 0, 0);
                }
                
                const fileName = `${spriteData.name}.png`;
                const filePath = path.join(spritesPath, fileName);
                const buffer = canvasInstance.toBuffer('image/png');
                fs.writeFileSync(filePath, buffer);

                // Save project data as JSON
                const projectFileName = `${spriteData.name}.sprite`;
                const projectPath = path.join(spritesPath, projectFileName);
                fs.writeFileSync(projectPath, JSON.stringify(spriteData, null, 2));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: fileName }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleExportSprite(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const exportData = JSON.parse(body);
                
                const exportsPath = path.join(workspaceRoot, 'exports');
                if (!fs.existsSync(exportsPath)) {
                    fs.mkdirSync(exportsPath, { recursive: true });
                }

                const fileName = `${exportData.name}.${exportData.format}`;
                const filePath = path.join(exportsPath, fileName);
                
                // Convert base64 to buffer and save
                const base64Data = exportData.data.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(filePath, buffer);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: fileName }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleSaveAnimation(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const animationData = JSON.parse(body);
                
                const animationsPath = path.join(workspaceRoot, 'assets', 'animations');
                if (!fs.existsSync(animationsPath)) {
                    fs.mkdirSync(animationsPath, { recursive: true });
                }

                // Save animation metadata
                const fileName = `${animationData.name}_animation.json`;
                const filePath = path.join(animationsPath, fileName);
                fs.writeFileSync(filePath, JSON.stringify(animationData, null, 2));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, file: fileName }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
            }
        });
    }

    private async handleLoadSprite(req: http.IncomingMessage, res: http.ServerResponse, workspaceRoot: string): Promise<void> {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { fileName } = JSON.parse(body);
                
                const spritesPath = path.join(workspaceRoot, 'assets', 'sprites');
                const filePath = path.join(spritesPath, fileName);
                
                if (fs.existsSync(filePath)) {
                    const spriteData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, data: spriteData }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'File not found' }));
                }
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
}