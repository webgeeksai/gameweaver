import * as vscode from 'vscode';
import * as path from 'path';
import { GameEngine, GDLCompiler } from '../engine';

export class GameVibeEditorProvider implements vscode.CustomTextEditorProvider {
    private static readonly viewType = 'gameVibe.gameEditor';
    private hotReloadEnabled = true;
    private gameState: any = null;
    private webviewPanels = new Set<vscode.WebviewPanel>();
    private fileWatcher?: vscode.FileSystemWatcher;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly gameEngine: GameEngine,
        private readonly compiler: GDLCompiler
    ) {
        this.setupHotReload();
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
                vscode.Uri.joinPath(this.context.extensionUri, 'node_modules'),
                ...(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(folder => folder.uri) : [])
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Track webview panels
        this.webviewPanels.add(webviewPanel);

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'compile':
                        await this.compileGDL(document, webviewPanel);
                        break;
                    case 'run':
                        await this.runGame(webviewPanel);
                        break;
                    case 'stop':
                        this.stopGame(webviewPanel);
                        break;
                    case 'updateCode':
                        await this.updateDocument(document, message.code);
                        break;
                    case 'getGameState':
                        this.sendGameState(webviewPanel);
                        break;
                    case 'toggleHotReload':
                        this.toggleHotReload();
                        break;
                    case 'resetGame':
                        await this.resetGame(webviewPanel);
                        break;
                    case 'saveGameState':
                        this.gameState = message.state;
                        break;
                    case 'loadGameState':
                        this.sendGameState(webviewPanel);
                        break;
                    case 'loadAssets':
                        await this.loadAssets(webviewPanel);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Update webview when document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                this.updateWebview(webviewPanel, document);
                
                // Auto-compile and reload if hot reload is enabled
                if (this.hotReloadEnabled) {
                    this.debounceHotReload(document, webviewPanel);
                }
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
            this.webviewPanels.delete(webviewPanel);
        });

        this.context.subscriptions.push(changeDocumentSubscription);

        // Initial update
        this.updateWebview(webviewPanel, document);
    }

    private async compileGDL(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const gdlCode = document.getText();
            
            // Send compilation start message
            webviewPanel.webview.postMessage({
                type: 'compilationStart'
            });
            
            // Perform compilation
            const compiledCode = await this.compiler.compile(gdlCode);
            await this.gameEngine.loadCompiledCode(compiledCode);
            
            // Send compilation success message
            webviewPanel.webview.postMessage({
                type: 'compilationSuccess',
                code: compiledCode
            });
            
            vscode.window.showInformationMessage('Game compiled successfully!');
        } catch (error) {
            // Send compilation error message
            webviewPanel.webview.postMessage({
                type: 'compilationError',
                error: error instanceof Error ? error.message : String(error)
            });
            
            vscode.window.showErrorMessage(`Compilation error: ${error}`);
        }
    }

    private async runGame(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            if (!this.gameEngine.isRunning()) {
                await this.gameEngine.start();
                
                webviewPanel.webview.postMessage({
                    type: 'gameStarted'
                });
            }
        } catch (error) {
            webviewPanel.webview.postMessage({
                type: 'gameError',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private stopGame(webviewPanel: vscode.WebviewPanel): void {
        if (this.gameEngine.isRunning()) {
            this.gameEngine.stop();
            
            webviewPanel.webview.postMessage({
                type: 'gameStopped'
            });
        }
    }
    
    private async resetGame(webviewPanel: vscode.WebviewPanel): Promise<void> {
        this.stopGame(webviewPanel);
        this.gameState = null;
        
        webviewPanel.webview.postMessage({
            type: 'gameReset'
        });
        
        // Restart if it was running
        setTimeout(() => {
            this.runGame(webviewPanel);
        }, 100);
    }

    private async updateDocument(document: vscode.TextDocument, content: string): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            content
        );
        await vscode.workspace.applyEdit(edit);
    }

    private updateWebview(webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument): void {
        webviewPanel.webview.postMessage({
            type: 'update',
            code: document.getText()
        });
    }

    private sendGameState(webviewPanel: vscode.WebviewPanel): void {
        const state = this.gameState || this.gameEngine.getState();
        webviewPanel.webview.postMessage({
            type: 'gameState',
            state: state,
            hotReloadEnabled: this.hotReloadEnabled
        });
    }

    private async loadAssets(webviewPanel: vscode.WebviewPanel): Promise<void> {
        console.log('loadAssets called');
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.log('No workspace folder found');
                return;
            }
            console.log('Loading assets from workspace:', workspaceFolder.uri.fsPath);

            const assetPaths = [
                'assets/sprites/player.svg',
                'assets/sprites/platforms.svg',
                'assets/sprites/collectibles.svg',
                'assets/sprites/enemy.svg',
                'assets/sprites/background.svg'
            ];

            const assets: { [key: string]: any } = {};

            for (const assetPath of assetPaths) {
                try {
                    console.log(`Loading asset: ${assetPath}`);
                    const assetUri = vscode.Uri.joinPath(workspaceFolder.uri, assetPath);
                    const assetData = await vscode.workspace.fs.readFile(assetUri);
                    const svgText = Buffer.from(assetData).toString('utf8');
                    const webviewUri = webviewPanel.webview.asWebviewUri(assetUri);
                    
                    assets[assetPath] = {
                        uri: webviewUri.toString(),
                        content: svgText
                    };
                    console.log(`Successfully loaded asset: ${assetPath}, content length: ${svgText.length}`);
                } catch (error) {
                    console.warn(`Failed to load asset: ${assetPath}`, error);
                }
            }

            console.log('Sending assetsLoaded message with', Object.keys(assets).length, 'assets');
            webviewPanel.webview.postMessage({
                type: 'assetsLoaded',
                assets: assets
            });

        } catch (error) {
            console.error('Failed to load assets:', error);
        }
    }

    private setupHotReload(): void {
        // Watch for asset changes
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/assets/**/*');
        
        this.fileWatcher.onDidChange(uri => {
            if (this.hotReloadEnabled) {
                this.hotReloadAsset(uri);
            }
        });
        
        this.fileWatcher.onDidCreate(uri => {
            if (this.hotReloadEnabled) {
                this.hotReloadAsset(uri);
            }
        });
        
        this.fileWatcher.onDidDelete(uri => {
            if (this.hotReloadEnabled) {
                this.notifyAssetDeleted(uri);
            }
        });
    }

    private hotReloadAsset(uri: vscode.Uri): void {
        const fileName = path.basename(uri.fsPath);
        
        // Notify all webview panels about asset change
        this.webviewPanels.forEach(panel => {
            panel.webview.postMessage({
                type: 'assetChanged',
                fileName: fileName,
                path: uri.fsPath
            });
        });
    }

    private notifyAssetDeleted(uri: vscode.Uri): void {
        const fileName = path.basename(uri.fsPath);
        
        this.webviewPanels.forEach(panel => {
            panel.webview.postMessage({
                type: 'assetDeleted',
                fileName: fileName
            });
        });
    }

    private toggleHotReload(): void {
        this.hotReloadEnabled = !this.hotReloadEnabled;
        
        // Notify all panels about the change
        this.webviewPanels.forEach(panel => {
            panel.webview.postMessage({
                type: 'hotReloadToggled',
                enabled: this.hotReloadEnabled
            });
        });
        
        const message = this.hotReloadEnabled ? 'Hot reload enabled' : 'Hot reload disabled';
        vscode.window.showInformationMessage(message);
    }

    private debounceTimer?: NodeJS.Timeout;
    private debounceHotReload(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(async () => {
            try {
                await this.compileGDL(document, webviewPanel);
                
                // If game is running, reload it
                if (this.gameEngine.isRunning()) {
                    await this.resetGame(webviewPanel);
                }
            } catch (error) {
                console.error('Hot reload failed:', error);
            }
        }, 500); // 500ms debounce
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'gamePreview.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'gameEditor.css')
        );
        const phaserUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'phaser', 'dist', 'phaser.min.js')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;">
                <link href="${styleUri}" rel="stylesheet">
                <title>Game Vibe Editor</title>
            </head>
            <body>
                <div id="app">
                    <div class="editor-container">
                        <div class="toolbar">
                            <div class="toolbar-group">
                                <button id="compile-btn" class="toolbar-btn">
                                    <span class="icon">⚡</span> Compile
                                </button>
                                <button id="run-btn" class="toolbar-btn">
                                    <span class="icon">▶️</span> Run
                                </button>
                                <button id="stop-btn" class="toolbar-btn" disabled>
                                    <span class="icon">⏹️</span> Stop
                                </button>
                                <button id="reset-btn" class="toolbar-btn">
                                    <span class="icon">🔄</span> Reset
                                </button>
                            </div>
                            <div class="toolbar-group">
                                <label class="toolbar-toggle">
                                    <input type="checkbox" id="hot-reload-toggle" checked>
                                    <span class="toggle-slider"></span>
                                    <span class="toggle-label">🔥 Hot Reload</span>
                                </label>
                            </div>
                            <div class="toolbar-group">
                                <div id="status-indicator" class="status-indicator">
                                    <span class="status-text">Ready</span>
                                </div>
                            </div>
                        </div>
                        <div class="content">
                            <div class="code-panel">
                                <div id="code-editor"></div>
                            </div>
                            <div class="game-panel">
                                <div class="game-header">
                                    <span class="game-title">Game Preview</span>
                                    <div class="game-controls">
                                        <button id="fullscreen-btn" class="control-btn" title="Fullscreen">
                                            ⛶
                                        </button>
                                        <button id="screenshot-btn" class="control-btn" title="Screenshot">
                                            📷
                                        </button>
                                    </div>
                                </div>
                                <div id="game-container"></div>
                                <div id="game-console" class="game-console">
                                    <div class="console-header">
                                        <span>Console</span>
                                        <button id="clear-console-btn" class="control-btn">Clear</button>
                                    </div>
                                    <div id="console-output" class="console-output"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${phaserUri}"></script>
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