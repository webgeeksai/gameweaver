import * as vscode from 'vscode';
import * as path from 'path';
import { SpriteEditorServer } from '../server/SpriteEditorServer';

export class SpriteEditorProvider implements vscode.CustomTextEditorProvider {
    private spriteEditorServer: SpriteEditorServer | null = null;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new SpriteEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            'gameVibe.spriteEditor',
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        );
        return providerRegistration;
    }

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup webview options
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
                ...(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(folder => folder.uri) : [])
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'saveSprite':
                        await this.saveSprite(message.spriteData, message.fileName, message.format);
                        break;
                    case 'loadSprite':
                        await this.loadSprite(webviewPanel, message.fileName);
                        break;
                    case 'exportAnimation':
                        await this.exportAnimation(message.animationData, message.fileName);
                        break;
                    case 'createTemplate':
                        await this.createTemplate(message.templateData);
                        break;
                    case 'getAssetList':
                        await this.sendAssetList(webviewPanel);
                        break;
                    case 'runInBrowser':
                        await this.runInBrowser(message.spriteData || '');
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Send initial data
        await this.sendAssetList(webviewPanel);
    }

    private async saveSprite(spriteData: string, fileName: string, format: 'svg' | 'png'): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const assetsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'sprites');
            await vscode.workspace.fs.createDirectory(assetsPath);

            const fileExtension = format === 'svg' ? '.svg' : '.png';
            const filePath = vscode.Uri.joinPath(assetsPath, fileName + fileExtension);

            let fileContent: Uint8Array;
            if (format === 'svg') {
                fileContent = Buffer.from(spriteData, 'utf8');
            } else {
                // Convert base64 PNG to bytes
                const base64Data = spriteData.replace(/^data:image\/png;base64,/, '');
                fileContent = Buffer.from(base64Data, 'base64');
            }

            await vscode.workspace.fs.writeFile(filePath, fileContent);
            vscode.window.showInformationMessage(`Sprite saved: ${fileName}${fileExtension}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save sprite: ${error}`);
        }
    }

    private async loadSprite(webviewPanel: vscode.WebviewPanel, fileName: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const filePath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'sprites', fileName);
            const fileData = await vscode.workspace.fs.readFile(filePath);
            const content = Buffer.from(fileData).toString('utf8');

            webviewPanel.webview.postMessage({
                type: 'spriteLoaded',
                fileName: fileName,
                content: content
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load sprite: ${error}`);
        }
    }

    private async exportAnimation(animationData: any, fileName: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const animationsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'animations');
            await vscode.workspace.fs.createDirectory(animationsPath);

            // Export individual frames
            for (let i = 0; i < animationData.frames.length; i++) {
                const frameFileName = `${fileName}_frame_${i.toString().padStart(3, '0')}.svg`;
                const framePath = vscode.Uri.joinPath(animationsPath, frameFileName);
                const frameContent = Buffer.from(animationData.frames[i], 'utf8');
                await vscode.workspace.fs.writeFile(framePath, frameContent);
            }

            // Export animation metadata
            const metadataPath = vscode.Uri.joinPath(animationsPath, `${fileName}_animation.json`);
            const metadata = {
                name: fileName,
                frameCount: animationData.frames.length,
                frameRate: animationData.frameRate,
                loop: animationData.loop,
                frames: animationData.frames.map((_: any, index: number) => 
                    `${fileName}_frame_${index.toString().padStart(3, '0')}.svg`
                )
            };
            const metadataContent = Buffer.from(JSON.stringify(metadata, null, 2), 'utf8');
            await vscode.workspace.fs.writeFile(metadataPath, metadataContent);

            vscode.window.showInformationMessage(`Animation exported: ${fileName} (${animationData.frames.length} frames)`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export animation: ${error}`);
        }
    }

    private async createTemplate(templateData: any): Promise<void> {
        // Save template to templates folder for reuse
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const templatesPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'templates');
            await vscode.workspace.fs.createDirectory(templatesPath);

            const templatePath = vscode.Uri.joinPath(templatesPath, `${templateData.name}.json`);
            const content = Buffer.from(JSON.stringify(templateData, null, 2), 'utf8');
            await vscode.workspace.fs.writeFile(templatePath, content);

            vscode.window.showInformationMessage(`Template saved: ${templateData.name}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save template: ${error}`);
        }
    }

    private async sendAssetList(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const assetsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets');
            
            // Ensure assets directory exists
            try {
                await vscode.workspace.fs.createDirectory(assetsPath);
            } catch {
                // Directory might already exist
            }
            
            const sprites: string[] = [];
            const animations: string[] = [];
            const templates: string[] = [];

            try {
                const spritesPath = vscode.Uri.joinPath(assetsPath, 'sprites');
                // Try to create directory if it doesn't exist
                try {
                    await vscode.workspace.fs.createDirectory(spritesPath);
                } catch {
                    // Directory might already exist
                }
                const spriteFiles = await vscode.workspace.fs.readDirectory(spritesPath);
                sprites.push(...spriteFiles.filter(([name, type]) => 
                    type === vscode.FileType.File && (name.endsWith('.svg') || name.endsWith('.png'))
                ).map(([name]) => name));
            } catch (error) {
                // Error reading sprites
                console.log('Error reading sprites:', error);
            }

            try {
                const animationsPath = vscode.Uri.joinPath(assetsPath, 'animations');
                // Try to create directory if it doesn't exist
                try {
                    await vscode.workspace.fs.createDirectory(animationsPath);
                } catch {
                    // Directory might already exist
                }
                const animationFiles = await vscode.workspace.fs.readDirectory(animationsPath);
                animations.push(...animationFiles.filter(([name, type]) => 
                    type === vscode.FileType.File && name.endsWith('_animation.json')
                ).map(([name]) => name.replace('_animation.json', '')));
            } catch (error) {
                // Error reading animations
                console.log('Error reading animations:', error);
            }

            try {
                const templatesPath = vscode.Uri.joinPath(assetsPath, 'templates');
                // Try to create directory if it doesn't exist
                try {
                    await vscode.workspace.fs.createDirectory(templatesPath);
                } catch {
                    // Directory might already exist
                }
                const templateFiles = await vscode.workspace.fs.readDirectory(templatesPath);
                templates.push(...templateFiles.filter(([name, type]) => 
                    type === vscode.FileType.File && name.endsWith('.json')
                ).map(([name]) => name.replace('.json', '')));
            } catch (error) {
                // Error reading templates
                console.log('Error reading templates:', error);
            }

            webviewPanel.webview.postMessage({
                type: 'assetList',
                sprites: sprites,
                animations: animations,
                templates: templates
            });
        } catch (error) {
            console.error('Failed to send asset list:', error);
        }
    }

    private async runInBrowser(spriteData: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            // Stop existing server if running
            if (this.spriteEditorServer) {
                this.spriteEditorServer.stop();
            }

            // Create and start new server
            this.spriteEditorServer = new SpriteEditorServer();
            const url = await this.spriteEditorServer.start(spriteData, workspaceFolder.uri.fsPath);

            // Open browser
            vscode.env.openExternal(vscode.Uri.parse(url));
            vscode.window.showInformationMessage(`🎨 Sprite Editor opened in browser: ${url}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run Sprite Editor in browser: ${error}`);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'spriteEditor.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'spriteEditor.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:;">
                <link href="${styleUri}" rel="stylesheet">
                <title>Game Vibe Sprite Editor</title>
            </head>
            <body>
                <div id="app">
                    <div class="sprite-editor">
                        <!-- Toolbar -->
                        <div class="toolbar">
                            <div class="toolbar-section">
                                <button id="new-btn" class="tool-btn" title="New Sprite">
                                    <span class="icon">📄</span>
                                </button>
                                <button id="open-btn" class="tool-btn" title="Open Sprite">
                                    <span class="icon">📂</span>
                                </button>
                                <button id="save-btn" class="tool-btn" title="Save Sprite">
                                    <span class="icon">💾</span>
                                </button>
                                <button id="export-btn" class="tool-btn" title="Export">
                                    <span class="icon">📤</span>
                                </button>
                                <button id="browser-btn" class="tool-btn" title="Run in Browser">
                                    <span class="icon">🌐</span>
                                </button>
                            </div>
                            <div class="toolbar-section">
                                <button id="undo-btn" class="tool-btn" title="Undo">
                                    <span class="icon">↶</span>
                                </button>
                                <button id="redo-btn" class="tool-btn" title="Redo">
                                    <span class="icon">↷</span>
                                </button>
                            </div>
                            <div class="toolbar-section">
                                <button id="brush-tool" class="tool-btn active" title="Brush">
                                    <span class="icon">🖌️</span>
                                </button>
                                <button id="pencil-tool" class="tool-btn" title="Pencil">
                                    <span class="icon">✏️</span>
                                </button>
                                <button id="eraser-tool" class="tool-btn" title="Eraser">
                                    <span class="icon">🧽</span>
                                </button>
                                <button id="fill-tool" class="tool-btn" title="Fill Bucket">
                                    <span class="icon">🪣</span>
                                </button>
                                <button id="eyedropper-tool" class="tool-btn" title="Eyedropper">
                                    <span class="icon">💉</span>
                                </button>
                            </div>
                            <div class="toolbar-section">
                                <button id="rect-tool" class="tool-btn" title="Rectangle">
                                    <span class="icon">⬜</span>
                                </button>
                                <button id="circle-tool" class="tool-btn" title="Circle">
                                    <span class="icon">⭕</span>
                                </button>
                                <button id="line-tool" class="tool-btn" title="Line">
                                    <span class="icon">📏</span>
                                </button>
                                <button id="pan-tool" class="tool-btn" title="Pan Tool (H)">
                                    <span class="icon">✋</span>
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
                                        <button id="add-layer-btn" class="panel-btn">+</button>
                                    </div>
                                    <div class="panel-content">
                                        <div id="layers-list" class="layers-list">
                                            <div class="layer-item active" data-layer="0">
                                                <span class="layer-name">Layer 1</span>
                                                <input type="range" class="opacity-slider" min="0" max="100" value="100">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Color Palette -->
                                <div class="panel">
                                    <div class="panel-header">
                                        <h3>Colors</h3>
                                        <button id="add-color-btn" class="panel-btn">+</button>
                                    </div>
                                    <div class="panel-content">
                                        <div class="color-section">
                                            <div class="primary-colors">
                                                <div class="color-display">
                                                    <div id="primary-color" class="color-box" style="background: #000000;"></div>
                                                    <div id="secondary-color" class="color-box" style="background: #ffffff;"></div>
                                                </div>
                                                <input type="color" id="color-picker" value="#000000">
                                            </div>
                                            <div id="color-palette" class="color-palette">
                                                <!-- Default palette colors -->
                                                <div class="palette-color" style="background: #000000;" data-color="#000000"></div>
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
                                </div>

                                <!-- Templates -->
                                <div class="panel">
                                    <div class="panel-header">
                                        <h3>Templates</h3>
                                        <button id="save-template-btn" class="panel-btn">💾</button>
                                    </div>
                                    <div class="panel-content">
                                        <div id="templates-list" class="templates-list">
                                            <div class="template-item" data-template="character">
                                                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3QgZmlsbD0iIzAwMDBmZiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIi8+PC9zdmc+" alt="Character">
                                                <span>Character</span>
                                            </div>
                                            <div class="template-item" data-template="platform">
                                                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3QgZmlsbD0iIzAwZmYwMCIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIi8+PC9zdmc+" alt="Platform">
                                                <span>Platform</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Canvas Area -->
                            <div class="canvas-area">
                                <div class="canvas-toolbar">
                                    <div class="canvas-controls">
                                        <label>Size:</label>
                                        <select id="canvas-size">
                                            <option value="16">16x16</option>
                                            <option value="32" selected>32x32</option>
                                            <option value="64">64x64</option>
                                            <option value="128">128x128</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                        <label>Zoom:</label>
                                        <select id="zoom-level">
                                            <option value="0.5">50%</option>
                                            <option value="1">100%</option>
                                            <option value="2">200%</option>
                                            <option value="4" selected>400%</option>
                                            <option value="8">800%</option>
                                        </select>
                                        <button id="grid-toggle" class="toggle-btn active">Grid</button>
                                        <button id="onion-skin-toggle" class="toggle-btn">Onion Skin</button>
                                    </div>
                                </div>
                                <div class="canvas-container">
                                    <canvas id="sprite-canvas" width="32" height="32"></canvas>
                                    <canvas id="grid-canvas" width="32" height="32"></canvas>
                                    <canvas id="onion-canvas" width="32" height="32"></canvas>
                                </div>
                            </div>

                            <!-- Right Panel -->
                            <div class="right-panel">
                                <!-- Animation Timeline -->
                                <div class="panel">
                                    <div class="panel-header">
                                        <h3>Animation</h3>
                                        <button id="add-frame-btn" class="panel-btn">+</button>
                                    </div>
                                    <div class="panel-content">
                                        <div class="animation-controls">
                                            <button id="play-animation-btn" class="control-btn">▶️</button>
                                            <button id="stop-animation-btn" class="control-btn">⏹️</button>
                                            <label>FPS:</label>
                                            <input type="number" id="frame-rate" value="12" min="1" max="60">
                                            <label>
                                                <input type="checkbox" id="loop-animation" checked>
                                                Loop
                                            </label>
                                        </div>
                                        <div id="timeline" class="timeline">
                                            <div class="frame active" data-frame="0">
                                                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiI+PC9zdmc+" alt="Frame 1">
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
                                        <div id="tool-options" class="tool-options">
                                            <div class="option-group">
                                                <label>Brush Size:</label>
                                                <input type="range" id="brush-size" min="1" max="20" value="1">
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
                                        <button id="refresh-assets-btn" class="panel-btn">🔄</button>
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
                            </div>
                        </div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}