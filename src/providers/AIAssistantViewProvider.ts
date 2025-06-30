import * as vscode from 'vscode';
import { GameEngine, GDLCompiler } from '../engine';
import { IntentRecognizer, CommandGenerator, ContextManager } from '../stubs/AIStubs';

export class AIAssistantViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'gameVibe.aiAssistant';
    
    private _view?: vscode.WebviewView;
    private intentRecognizer: IntentRecognizer;
    private commandGenerator: CommandGenerator;
    private contextManager: ContextManager;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly gameEngine: GameEngine,
        private readonly compiler: GDLCompiler
    ) {
        this.intentRecognizer = new IntentRecognizer();
        this.commandGenerator = new CommandGenerator();
        this.contextManager = new ContextManager();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleUserMessage(data.message);
                    break;
                case 'getContext':
                    this.sendContext();
                    break;
            }
        });
    }

    private async handleUserMessage(message: string) {
        try {
            // Add user message to context
            this.contextManager.addMessage('user', message);

            // Recognize intent
            const intents = await this.intentRecognizer.recognize(message, this.contextManager.getContext());
            
            // Use the highest confidence intent
            const intent = intents.length > 0 ? intents[0] : null;
            
            if (!intent) {
                throw new Error('Unable to understand the request');
            }
            
            // Generate command based on intent
            const command = await this.commandGenerator.generate(intent, this.contextManager.getContext());

            // Execute command
            const result = await this.executeCommand(command);

            // Add assistant response to context
            this.contextManager.addMessage('assistant', result.message);

            // Send response to webview
            this._view?.webview.postMessage({
                type: 'response',
                message: result.message,
                code: result.code
            });

            // If code was generated, update the active editor
            if (result.code) {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && activeEditor.document.languageId === 'gdl') {
                    const edit = new vscode.WorkspaceEdit();
                    const lastLine = activeEditor.document.lineCount - 1;
                    const lastChar = activeEditor.document.lineAt(lastLine).text.length;
                    edit.insert(activeEditor.document.uri, new vscode.Position(lastLine, lastChar), '\n' + result.code);
                    await vscode.workspace.applyEdit(edit);
                }
            }
        } catch (error) {
            this._view?.webview.postMessage({
                type: 'error',
                message: `Error: ${error}`
            });
        }
    }

    private async executeCommand(command: any): Promise<{ message: string; code?: string }> {
        switch (command.type) {
            case 'CREATE_ENTITY':
                return {
                    message: `Created ${command.entity.type} entity named "${command.entity.name}"`,
                    code: this.generateEntityCode(command.entity)
                };

            case 'ADD_BEHAVIOR':
                return {
                    message: `Added ${command.behavior} behavior to ${command.entity}`,
                    code: this.generateBehaviorCode(command.entity, command.behavior, command.params)
                };

            case 'MODIFY_PROPERTY':
                return {
                    message: `Updated ${command.property} of ${command.entity} to ${command.value}`,
                    code: this.generatePropertyCode(command.entity, command.property, command.value)
                };

            case 'CREATE_SCENE':
                return {
                    message: `Created new scene "${command.sceneName}"`,
                    code: this.generateSceneCode(command.sceneName)
                };

            default:
                return {
                    message: 'I understand what you want to do. Let me help you with that.',
                    code: command.gdlCode
                };
        }
    }

    private generateEntityCode(entity: any): string {
        return `entity ${entity.name} {
    transform: { x: ${entity.x || 0}, y: ${entity.y || 0} }
    sprite: { texture: "${entity.texture || 'default'}", width: ${entity.width || 32}, height: ${entity.height || 32} }
    physics: { mode: "${entity.physicsMode || 'kinematic'}" }
    collider: { type: "${entity.colliderType || 'box'}", width: ${entity.width || 32}, height: ${entity.height || 32} }
}`;
    }

    private generateBehaviorCode(entity: string, behavior: string, params: any): string {
        return `// Add to ${entity} entity
behavior: ${behavior} { ${Object.entries(params || {}).map(([k, v]) => `${k}: ${v}`).join(', ')} }`;
    }

    private generatePropertyCode(entity: string, property: string, value: any): string {
        return `// Update ${entity} entity
${property}: ${JSON.stringify(value)}`;
    }

    private generateSceneCode(sceneName: string): string {
        return `scene ${sceneName} {
    // Add entities here
}`;
    }

    private sendContext() {
        const context = this.contextManager.getContext();
        this._view?.webview.postMessage({
            type: 'context',
            context: context
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'aiAssistant.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'aiAssistant.js'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <link href="${styleUri}" rel="stylesheet">
                <title>AI Assistant</title>
            </head>
            <body>
                <div class="chat-container">
                    <div class="chat-header">
                        <h3>AI Game Assistant</h3>
                        <p class="subtitle">Describe what you want to create</p>
                    </div>
                    <div id="chat-messages" class="chat-messages"></div>
                    <div class="chat-input-container">
                        <textarea 
                            id="message-input" 
                            class="message-input" 
                            placeholder="e.g., 'Create a player that can jump and move left/right'"
                            rows="2"
                        ></textarea>
                        <button id="send-btn" class="send-btn">Send</button>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}