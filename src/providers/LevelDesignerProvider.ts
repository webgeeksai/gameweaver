import * as vscode from 'vscode';
import * as path from 'path';
import { LevelDesignerServer } from '../server/LevelDesignerServer';

export class LevelDesignerProvider implements vscode.CustomTextEditorProvider {
    private levelDesignerServer: LevelDesignerServer | null = null;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new LevelDesignerProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            'gameVibe.levelDesigner',
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

        // Send initial document content
        this.updateWebview(webviewPanel.webview, document);

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'updateLevel':
                        await this.updateDocument(document, message.gdlContent);
                        break;
                    case 'loadAssets':
                        await this.sendAssetList(webviewPanel);
                        break;
                    case 'loadPrefabs':
                        await this.sendPrefabList(webviewPanel);
                        break;
                    case 'savePrefab':
                        await this.savePrefab(message.prefabData);
                        break;
                    case 'exportLevel':
                        await this.exportLevel(document, message.format);
                        break;
                    case 'getEntityTemplates':
                        await this.sendEntityTemplates(webviewPanel);
                        break;
                    case 'runInBrowser':
                        await this.runInBrowser(document);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Handle document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                this.updateWebview(webviewPanel.webview, document);
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Send initial data
        await this.sendAssetList(webviewPanel);
        await this.sendPrefabList(webviewPanel);
        await this.sendEntityTemplates(webviewPanel);
    }

    private async updateDocument(document: vscode.TextDocument, gdlContent: string): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            gdlContent
        );
        await vscode.workspace.applyEdit(edit);
    }

    private updateWebview(webview: vscode.Webview, document: vscode.TextDocument) {
        webview.postMessage({
            type: 'update',
            content: document.getText()
        });
    }

    private async sendAssetList(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const assetsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets');
            const sprites: { [key: string]: string } = {};
            const sounds: string[] = [];

            // Get sprites
            try {
                const spritesPath = vscode.Uri.joinPath(assetsPath, 'sprites');
                const spriteFiles = await vscode.workspace.fs.readDirectory(spritesPath);
                
                for (const [fileName, fileType] of spriteFiles) {
                    if (fileType === vscode.FileType.File && 
                        (fileName.endsWith('.png') || fileName.endsWith('.svg'))) {
                        const filePath = vscode.Uri.joinPath(spritesPath, fileName);
                        const fileData = await vscode.workspace.fs.readFile(filePath);
                        
                        if (fileName.endsWith('.svg')) {
                            sprites[fileName] = Buffer.from(fileData).toString('utf8');
                        } else {
                            sprites[fileName] = `data:image/png;base64,${Buffer.from(fileData).toString('base64')}`;
                        }
                    }
                }
            } catch (error) {
                console.log('No sprites folder yet');
            }

            // Get sounds
            try {
                const soundsPath = vscode.Uri.joinPath(assetsPath, 'sounds');
                const soundFiles = await vscode.workspace.fs.readDirectory(soundsPath);
                sounds.push(...soundFiles.filter(([name, type]) => 
                    type === vscode.FileType.File && 
                    (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg'))
                ).map(([name]) => name));
            } catch (error) {
                console.log('No sounds folder yet');
            }

            webviewPanel.webview.postMessage({
                type: 'assetsLoaded',
                sprites: sprites,
                sounds: sounds
            });
        } catch (error) {
            console.error('Failed to load assets:', error);
        }
    }

    private async sendPrefabList(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const prefabsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'prefabs');
            const prefabs: { [key: string]: any } = {};

            try {
                await vscode.workspace.fs.createDirectory(prefabsPath);
            } catch {
                // Directory might already exist
            }

            try {
                const prefabFiles = await vscode.workspace.fs.readDirectory(prefabsPath);
                
                for (const [fileName, fileType] of prefabFiles) {
                    if (fileType === vscode.FileType.File && fileName.endsWith('.json')) {
                        const filePath = vscode.Uri.joinPath(prefabsPath, fileName);
                        const fileData = await vscode.workspace.fs.readFile(filePath);
                        const prefabData = JSON.parse(Buffer.from(fileData).toString('utf8'));
                        prefabs[fileName.replace('.json', '')] = prefabData;
                    }
                }
            } catch (error) {
                console.log('Error loading prefabs:', error);
            }

            webviewPanel.webview.postMessage({
                type: 'prefabsLoaded',
                prefabs: prefabs
            });
        } catch (error) {
            console.error('Failed to load prefabs:', error);
        }
    }

    private async savePrefab(prefabData: any): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const prefabsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'assets', 'prefabs');
            await vscode.workspace.fs.createDirectory(prefabsPath);

            const fileName = `${prefabData.name}.json`;
            const filePath = vscode.Uri.joinPath(prefabsPath, fileName);
            const content = Buffer.from(JSON.stringify(prefabData, null, 2), 'utf8');
            
            await vscode.workspace.fs.writeFile(filePath, content);
            vscode.window.showInformationMessage(`Prefab saved: ${prefabData.name}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save prefab: ${error}`);
        }
    }

    private async exportLevel(document: vscode.TextDocument, format: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;

            const levelsPath = vscode.Uri.joinPath(workspaceFolder.uri, 'levels');
            await vscode.workspace.fs.createDirectory(levelsPath);

            const baseName = path.basename(document.fileName, '.gdl');
            let exportPath: vscode.Uri;
            let content: Uint8Array;

            switch (format) {
                case 'json':
                    exportPath = vscode.Uri.joinPath(levelsPath, `${baseName}.json`);
                    // Convert GDL to JSON representation
                    const jsonData = this.gdlToJson(document.getText());
                    content = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf8');
                    break;
                case 'typescript':
                    exportPath = vscode.Uri.joinPath(levelsPath, `${baseName}.ts`);
                    // Convert GDL to TypeScript
                    const tsCode = this.gdlToTypeScript(document.getText());
                    content = Buffer.from(tsCode, 'utf8');
                    break;
                default:
                    // Export as GDL
                    exportPath = vscode.Uri.joinPath(levelsPath, `${baseName}_export.gdl`);
                    content = Buffer.from(document.getText(), 'utf8');
            }

            await vscode.workspace.fs.writeFile(exportPath, content);
            vscode.window.showInformationMessage(`Level exported to: ${exportPath.fsPath}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export level: ${error}`);
        }
    }

    private gdlToJson(gdlContent: string): any {
        // Simple GDL to JSON conversion
        // This would be more sophisticated in a real implementation
        const level: any = {
            scenes: [],
            entities: []
        };

        // Parse entities from GDL
        const entityRegex = /entity\s+(\w+)\s*\{([^}]*)\}/g;
        let match;
        
        while ((match = entityRegex.exec(gdlContent)) !== null) {
            const entityName = match[1];
            const entityContent = match[2];
            
            const entity: any = { name: entityName };
            
            // Parse transform
            const transformMatch = entityContent.match(/transform:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+)\s*\}/);
            if (transformMatch) {
                entity.transform = {
                    x: parseInt(transformMatch[1]),
                    y: parseInt(transformMatch[2])
                };
            }
            
            // Parse sprite
            const spriteMatch = entityContent.match(/sprite:\s*\{([^}]*)\}/);
            if (spriteMatch) {
                entity.sprite = {};
                const textureMatch = spriteMatch[1].match(/texture:\s*"([^"]+)"/);
                if (textureMatch) entity.sprite.texture = textureMatch[1];
                
                const widthMatch = spriteMatch[1].match(/width:\s*(\d+)/);
                if (widthMatch) entity.sprite.width = parseInt(widthMatch[1]);
                
                const heightMatch = spriteMatch[1].match(/height:\s*(\d+)/);
                if (heightMatch) entity.sprite.height = parseInt(heightMatch[1]);
            }
            
            level.entities.push(entity);
        }
        
        return level;
    }

    private gdlToTypeScript(gdlContent: string): string {
        const json = this.gdlToJson(gdlContent);
        
        let tsCode = `// Auto-generated level code
import { GameEngine } from '../engine';

export function loadLevel(engine: GameEngine) {
    const entityManager = engine.getEntityManager();
    const componentManager = engine.getComponentManager();
    
`;

        for (const entity of json.entities) {
            tsCode += `    // Create ${entity.name}\n`;
            tsCode += `    const ${entity.name.toLowerCase()}Id = entityManager.createEntity();\n`;
            
            if (entity.transform) {
                tsCode += `    componentManager.addComponent(${entity.name.toLowerCase()}Id, new TransformComponent({\n`;
                tsCode += `        position: { x: ${entity.transform.x}, y: ${entity.transform.y} }\n`;
                tsCode += `    }));\n`;
            }
            
            if (entity.sprite) {
                tsCode += `    componentManager.addComponent(${entity.name.toLowerCase()}Id, new SpriteComponent({\n`;
                tsCode += `        texture: '${entity.sprite.texture || 'default'}',\n`;
                tsCode += `        width: ${entity.sprite.width || 32},\n`;
                tsCode += `        height: ${entity.sprite.height || 32}\n`;
                tsCode += `    }));\n`;
            }
            
            tsCode += '\n';
        }
        
        tsCode += '}';
        return tsCode;
    }

    private async sendEntityTemplates(webviewPanel: vscode.WebviewPanel): Promise<void> {
        const templates = {
            'Player': {
                sprite: { texture: 'player', width: 32, height: 48, color: '#4A90E2' },
                physics: { mode: 'platformer', mass: 1, friction: 0.8 },
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
            },
            'Spike': {
                sprite: { texture: 'spike', width: 32, height: 32, color: '#8B0000' },
                physics: { mode: 'static' },
                collider: { type: 'box', width: 28, height: 16, isTrigger: true },
                behaviors: ['Hazard']
            },
            'Checkpoint': {
                sprite: { texture: 'checkpoint', width: 48, height: 64, color: '#32CD32' },
                physics: { mode: 'static' },
                collider: { type: 'box', width: 40, height: 60, isTrigger: true },
                behaviors: ['Checkpoint']
            },
            'MovingPlatform': {
                sprite: { texture: 'platform', width: 150, height: 32, color: '#8B4513' },
                physics: { mode: 'kinematic' },
                collider: { type: 'box', width: 150, height: 32 },
                behaviors: ['MovingPlatform']
            },
            'Spring': {
                sprite: { texture: 'spring', width: 32, height: 32, color: '#FF69B4' },
                physics: { mode: 'static' },
                collider: { type: 'box', width: 32, height: 32, isTrigger: true },
                behaviors: ['Spring']
            }
        };

        webviewPanel.webview.postMessage({
            type: 'templatesLoaded',
            templates: templates
        });
    }

    private async runInBrowser(document: vscode.TextDocument): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            // Stop existing server if running
            if (this.levelDesignerServer) {
                this.levelDesignerServer.stop();
            }

            // Create and start new server
            this.levelDesignerServer = new LevelDesignerServer();
            const levelContent = document.getText();
            const url = await this.levelDesignerServer.start(levelContent, workspaceFolder.uri.fsPath);

            // Open browser
            vscode.env.openExternal(vscode.Uri.parse(url));
            vscode.window.showInformationMessage(`🎨 Level Designer opened in browser: ${url}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run Level Designer in browser: ${error}`);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'levelDesigner.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'levelDesigner.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:;">
                <link href="${styleUri}" rel="stylesheet">
                <title>Game Vibe Level Designer</title>
            </head>
            <body>
                <div id="app">
                    <div class="level-designer">
                        <!-- Top Toolbar -->
                        <div class="toolbar">
                            <div class="toolbar-section">
                                <button id="select-tool" class="tool-btn active" title="Select Tool (V)">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M3 2l10 6-5 2-2 5-6-10 3-3z"/>
                                    </svg>
                                </button>
                                <button id="move-tool" class="tool-btn" title="Move Tool (W)">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M7.5 1.5L3.5 5.5L5 7L6 6V10H2L3 5L1.5 3.5L5.5 0L10 0L12.5 2.5L14 1L15.5 2.5L14 4L15.5 5.5L12 9L12 5L11 6L11 10H7V6L8 5L7.5 1.5Z"/>
                                    </svg>
                                </button>
                                <button id="rotate-tool" class="tool-btn" title="Rotate Tool (E)">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M12.48 2.48c1.69 1.69 2.15 4.17 1.39 6.27l-1.43-.7c.49-1.35.17-2.91-.96-4.04C10.35 2.88 8.79 2.56 7.44 3.05l-.7-1.43c2.1-.76 4.58-.3 6.27 1.39l.97-.97L15 3.06l-3.06 1.02-.97-.97zM3.52 13.52c-1.69-1.69-2.15-4.17-1.39-6.27l1.43.7c-.49 1.35-.17 2.91.96 4.04 1.13 1.13 2.69 1.45 4.04.96l.7 1.43c-2.1.76-4.58.3-6.27-1.39l-.97.97L1 12.94l3.06-1.02-.97.97z"/>
                                    </svg>
                                </button>
                                <button id="scale-tool" class="tool-btn" title="Scale Tool (R)">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M1 8h3l-1.5 1.5L4 11l2-2V8H7V6H6L4 4l1.5-1.5L4 1 1 4v4zm14-4l-3 3h1v2h-1v1l2 2 1.5-1.5L14 9l3-3V4zm-4 11l1.5-1.5L11 12l-2 2H8v-1H6v1H5l2 2 1.5 1.5L10 15l1-1h4v-3h-4z"/>
                                    </svg>
                                </button>
                                <button id="pan-tool" class="tool-btn" title="Pan Tool (H)">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M5.5 6.5c0-1.105.895-2 2-2s2 .895 2 2-1.105 2-2 2-2-.895-2-2zm1 0c0 .552.448 1 1 1s1-.448 1-1-.448-1-1-1-1 .448-1 1z"/>
                                        <path d="M2.5 9.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5zm1 0c0 .276.224.5.5.5s.5-.224.5-.5-.224-.5-.5-.5-.5.224-.5.5z"/>
                                        <path d="M11.5 8c.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5-1.5-.672-1.5-1.5.672-1.5 1.5-1.5zm0 1c.276 0 .5.224.5.5s-.224.5-.5.5-.5-.224-.5-.5.224-.5.5-.5z"/>
                                        <path d="M8 1c2.761 0 5 2.239 5 5v4c0 2.761-2.239 5-5 5s-5-2.239-5-5V6c0-2.761 2.239-5 5-5zm0 1c-2.209 0-4 1.791-4 4v4c0 2.209 1.791 4 4 4s4-1.791 4-4V6c0-2.209-1.791-4-4-4z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="toolbar-section">
                                <button id="grid-snap-btn" class="tool-btn toggle active" title="Grid Snap">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z"/>
                                    </svg>
                                </button>
                                <select id="grid-size" class="toolbar-select">
                                    <option value="8">8px</option>
                                    <option value="16" selected>16px</option>
                                    <option value="32">32px</option>
                                    <option value="64">64px</option>
                                </select>
                                <button id="show-grid-btn" class="tool-btn toggle active" title="Show Grid">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path fill-rule="evenodd" d="M2 2v2h2V2H2zm3 0v2h2V2H5zm3 0v2h2V2H8zm3 0v2h2V2h-2zm3 0v2h2V2h-2zm0 3v2h2V5h-2zm0 3v2h2V8h-2zm0 3v2h2v-2h-2zm0 3v2h2v-2h-2zm-3 0v2h2v-2h-2zm-3 0v2h2v-2H8zm-3 0v2h2v-2H5zm-3 0v2h2v-2H2zm0-3v2h2v-2H2zm0-3v2h2V8H2zm0-3v2h2V5H2z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="toolbar-section">
                                <button id="play-btn" class="tool-btn" title="Play Level">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M4 2v12l10-6L4 2z"/>
                                    </svg>
                                </button>
                                <button id="pause-btn" class="tool-btn" title="Pause" disabled>
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M4 2h3v12H4V2zm5 0h3v12H9V2z"/>
                                    </svg>
                                </button>
                                <button id="stop-btn" class="tool-btn" title="Stop" disabled>
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M3 3h10v10H3V3z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="toolbar-section">
                                <button id="save-btn" class="tool-btn" title="Save Level">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path fill-rule="evenodd" d="M13.353 1.146l1.5 1.5L15 3v11.5l-.5.5h-13l-.5-.5v-13l.5-.5H13l.353.146zM2 2v12h12V3.208L12.793 2H11v4H4V2H2zm3 0v3h5V2H5z"/>
                                    </svg>
                                </button>
                                <button id="export-btn" class="tool-btn" title="Export Level">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path fill-rule="evenodd" d="M7 1v7.586L4.707 6.293 3.293 7.707 8 12.414l4.707-4.707-1.414-1.414L9 8.586V1H7zm8 13v-4h-2v4H2v-4H0v4.5l.5.5h14l.5-.5V14z"/>
                                    </svg>
                                </button>
                                <button id="browser-btn" class="tool-btn" title="Run in Browser">
                                    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zM2 8c0-1.3.4-2.5 1.1-3.5L7 8.4v.6c0 .6.4 1 1 1h1v1c0 .6.4 1 1 1h2v1c0 .3-.1.6-.3.8C10.1 14.6 9.1 15 8 15c-3.9 0-7-3.1-7-7zm11.9-1c-.1-.4-.3-.8-.6-1.1L12 4.6V4c0-.6-.4-1-1-1H9c-.6 0-1 .4-1 1v1H6c-.6 0-1 .4-1 1v2.3l-.9.9c-.2-.7-.3-1.4-.3-2.2 0-3.9 3.1-7 7-7s7 3.1 7 7c0 .4 0 .7-.1 1z"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="toolbar-section flex-grow">
                                <div class="zoom-controls">
                                    <button id="zoom-out" class="tool-btn" title="Zoom Out">-</button>
                                    <span id="zoom-level" class="zoom-display">100%</span>
                                    <button id="zoom-in" class="tool-btn" title="Zoom In">+</button>
                                    <button id="zoom-fit" class="tool-btn" title="Fit to Screen">
                                        <svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M2 2h4v1H3v3H2V2zm8 0h4v4h-1V3h-3V2zM2 10h1v3h3v1H2v-4zm11 0h1v4h-4v-1h3v-3z"/>
                                        </svg>
                                    </button>
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
                                        <input type="text" id="entity-search" class="search-input" placeholder="Search...">
                                    </div>
                                    <div class="panel-content">
                                        <div class="entity-categories">
                                            <div class="category">
                                                <div class="category-header">
                                                    <span class="chevron">▼</span>
                                                    <span>Basic Entities</span>
                                                </div>
                                                <div class="category-content" id="basic-entities">
                                                    <!-- Entity templates will be populated here -->
                                                </div>
                                            </div>
                                            <div class="category">
                                                <div class="category-header">
                                                    <span class="chevron">▼</span>
                                                    <span>Prefabs</span>
                                                </div>
                                                <div class="category-content" id="prefabs">
                                                    <!-- Prefabs will be populated here -->
                                                </div>
                                            </div>
                                            <div class="category">
                                                <div class="category-header">
                                                    <span class="chevron">▼</span>
                                                    <span>Custom</span>
                                                </div>
                                                <div class="category-content">
                                                    <button id="create-custom-entity" class="create-btn">
                                                        + Create Custom Entity
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Layers Panel -->
                                <div class="panel">
                                    <div class="panel-header">
                                        <h3>Layers</h3>
                                        <button id="add-layer-btn" class="panel-btn">+</button>
                                    </div>
                                    <div class="panel-content">
                                        <div id="layers-list" class="layers-list">
                                            <div class="layer-item active" data-layer="0">
                                                <input type="checkbox" checked>
                                                <span class="layer-name">Main Layer</span>
                                                <svg class="layer-lock" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                                    <path d="M11 6V4.5C11 2.5 9.5 1 7.5 1S4 2.5 4 4.5V6H3v8h9V6h-1zM5 4.5C5 3.1 6.1 2 7.5 2S10 3.1 10 4.5V6H5V4.5z"/>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Center - Canvas Area -->
                            <div class="canvas-area">
                                <div class="canvas-container" id="canvas-container">
                                    <canvas id="grid-canvas"></canvas>
                                    <canvas id="level-canvas"></canvas>
                                    <canvas id="selection-canvas"></canvas>
                                    <div id="gizmo-container" class="gizmo-container"></div>
                                </div>
                                <!-- Mini Map -->
                                <div class="minimap" id="minimap">
                                    <canvas id="minimap-canvas"></canvas>
                                    <div class="minimap-viewport"></div>
                                </div>
                            </div>

                            <!-- Right Panel - Properties -->
                            <div class="right-panel">
                                <!-- Scene Properties -->
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
                                            <input type="number" id="scene-width" value="1920" min="320" max="10000">
                                        </div>
                                        <div class="property-group">
                                            <label>Height:</label>
                                            <input type="number" id="scene-height" value="1080" min="240" max="10000">
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

                                <!-- Entity Inspector -->
                                <div class="panel">
                                    <div class="panel-header">
                                        <h3>Entity Inspector</h3>
                                    </div>
                                    <div class="panel-content" id="entity-inspector">
                                        <div class="no-selection">
                                            <p>No entity selected</p>
                                            <p class="hint">Select an entity to view properties</p>
                                        </div>
                                    </div>
                                </div>

                                <!-- Hierarchy -->
                                <div class="panel">
                                    <div class="panel-header">
                                        <h3>Hierarchy</h3>
                                        <input type="text" id="hierarchy-search" class="search-input" placeholder="Search...">
                                    </div>
                                    <div class="panel-content">
                                        <div id="hierarchy-tree" class="hierarchy-tree">
                                            <!-- Entity hierarchy will be populated here -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Status Bar -->
                        <div class="status-bar">
                            <div class="status-item">
                                <span id="cursor-position">X: 0, Y: 0</span>
                            </div>
                            <div class="status-item">
                                <span id="entity-count">Entities: 0</span>
                            </div>
                            <div class="status-item">
                                <span id="selection-info">No selection</span>
                            </div>
                            <div class="status-item">
                                <span id="fps-counter">FPS: 60</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Context Menu -->
                <div id="context-menu" class="context-menu" style="display: none;">
                    <div class="menu-item" data-action="cut">Cut</div>
                    <div class="menu-item" data-action="copy">Copy</div>
                    <div class="menu-item" data-action="paste">Paste</div>
                    <div class="menu-separator"></div>
                    <div class="menu-item" data-action="duplicate">Duplicate</div>
                    <div class="menu-item" data-action="delete">Delete</div>
                    <div class="menu-separator"></div>
                    <div class="menu-item" data-action="bring-front">Bring to Front</div>
                    <div class="menu-item" data-action="send-back">Send to Back</div>
                    <div class="menu-separator"></div>
                    <div class="menu-item" data-action="create-prefab">Create Prefab</div>
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