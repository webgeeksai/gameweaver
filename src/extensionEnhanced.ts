/**
 * Enhanced VS Code Extension with Component Integration
 * 
 * This enhanced version integrates all components through the unified
 * messaging and state management system.
 */

import * as vscode from 'vscode';
import { GameEngine, GDLCompiler } from './engine';
import { setupCompleteIntegration, ComponentIntegration } from './engine/integration';
import { createEnhancedSpriteEditor } from './providers/SpriteEditorEnhanced';
import { SpriteEditorProvider } from './providers/SpriteEditorProvider';
import { LevelDesignerProvider } from './providers/LevelDesignerProvider';
import { AIAssistantViewProvider } from './providers/AIAssistantViewProvider';
import { GameVibeEditorProvider } from './providers/GameVibeEditorProvider';

// Global integration manager
let integration: ComponentIntegration | undefined;
let gameEngine: GameEngine | undefined;
let compiler: GDLCompiler | undefined;

export async function activateEnhanced(context: vscode.ExtensionContext) {
    console.log('🚀 Game Vibe Engine Enhanced extension activating...');

    try {
        // Initialize core components
        gameEngine = new GameEngine();
        compiler = new GDLCompiler();

        // Setup component integration
        integration = await setupCompleteIntegration({
            engine: gameEngine,
            vscodeExtension: context
        }, {
            enableHotReload: true,
            enableAutoSync: true,
            enableDebugLogging: vscode.workspace.getConfiguration('gameVibe').get('debug', false)
        });

        // Register enhanced providers
        await registerEnhancedProviders(context);

        // Register enhanced commands
        registerEnhancedCommands(context);

        // Setup status bar
        setupStatusBar(context);

        // Setup configuration listeners
        setupConfigurationListeners(context);

        console.log('✅ Game Vibe Engine Enhanced extension activated successfully!');
        
        // Show welcome message with integration status
        const status = integration.getStatus();
        vscode.window.showInformationMessage(
            `Game Vibe Engine Enhanced activated! Connected components: ${status.components.filter(c => c.connected).length}/${status.components.length}`
        );

    } catch (error) {
        console.error('Failed to activate Game Vibe Engine Enhanced:', error);
        vscode.window.showErrorMessage(`Failed to activate Game Vibe Engine: ${error}`);
    }
}

/**
 * Register enhanced providers with integration
 */
async function registerEnhancedProviders(context: vscode.ExtensionContext) {
    if (!integration || !gameEngine || !compiler) return;

    // Enhanced Game Editor Provider
    const editorProvider = new GameVibeEditorProvider(context, gameEngine, compiler);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'gameVibe.gameEditor',
            editorProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                    enableScripts: true
                },
                supportsMultipleEditorsPerDocument: false
            }
        )
    );

    // Enhanced Sprite Editor Provider
    const spriteEditorProvider = new SpriteEditorProvider(context);
    const enhancedSpriteEditor = createEnhancedSpriteEditor(
        spriteEditorProvider,
        integration['messageBus'],
        integration['stateStore']
    );
    
    // Register sprite editor
    const spriteEditorDisposable = vscode.window.registerCustomEditorProvider(
        'gameVibe.spriteEditor',
        {
            ...spriteEditorProvider,
            resolveCustomTextEditor: async (document, webviewPanel, token) => {
                await spriteEditorProvider.resolveCustomTextEditor(document, webviewPanel, token);
                enhancedSpriteEditor.enhanceWebviewPanel(webviewPanel);
            }
        },
        {
            webviewOptions: {
                retainContextWhenHidden: true,
                enableScripts: true
            },
            supportsMultipleEditorsPerDocument: false
        }
    );
    
    context.subscriptions.push(spriteEditorDisposable);
    integration.connectSpriteEditor(enhancedSpriteEditor);

    // Enhanced Level Designer Provider
    const levelDesignerProvider = new LevelDesignerProvider(context);
    const { createEnhancedLevelDesigner } = await import('./providers/LevelDesignerEnhanced');
    const enhancedLevelDesigner = createEnhancedLevelDesigner(
        levelDesignerProvider,
        integration['messageBus'],
        integration['stateStore'],
        gameEngine,
        compiler
    );
    
    const levelDesignerDisposable = vscode.window.registerCustomEditorProvider(
        'gameVibe.levelDesigner',
        {
            ...levelDesignerProvider,
            resolveCustomTextEditor: async (document, webviewPanel, token) => {
                await levelDesignerProvider.resolveCustomTextEditor(document, webviewPanel, token);
                enhancedLevelDesigner.enhanceWebviewPanel(webviewPanel);
            }
        },
        {
            webviewOptions: {
                retainContextWhenHidden: true,
                enableScripts: true
            },
            supportsMultipleEditorsPerDocument: false
        }
    );
    
    context.subscriptions.push(levelDesignerDisposable);
    integration.connectLevelDesigner(enhancedLevelDesigner);

    // Enhanced AI Assistant Provider
    const aiAssistantProvider = new AIAssistantViewProvider(context.extensionUri, gameEngine, compiler);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'gameVibe.aiAssistant',
            aiAssistantProvider
        )
    );
    integration.connectAIAssistant(aiAssistantProvider);
}

/**
 * Register enhanced commands
 */
function registerEnhancedCommands(context: vscode.ExtensionContext) {
    if (!integration || !gameEngine) return;

    // Enhanced open editor command
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.openEditorEnhanced', async () => {
            await vscode.commands.executeCommand('gameVibe.openEditor');
            
            // Show integration panel
            await vscode.commands.executeCommand('gameVibe.showIntegrationStatus');
        })
    );

    // Show integration status
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.showIntegrationStatus', () => {
            const status = integration!.getStatus();
            
            const quickPick = vscode.window.createQuickPick();
            quickPick.title = 'Game Vibe Engine Integration Status';
            quickPick.items = [
                {
                    label: '$(check) Integration Status',
                    description: status.initialized ? 'Initialized' : 'Not initialized',
                    detail: `Components: ${status.components.filter(c => c.connected).length}/${status.components.length} connected`
                },
                ...status.components.map(comp => ({
                    label: `$(${comp.connected ? 'check' : 'x'}) ${comp.name}`,
                    description: comp.type,
                    detail: comp.connected ? 'Connected' : 'Disconnected'
                }))
            ];
            
            if (status.metrics) {
                quickPick.items = [
                    ...quickPick.items,
                    {
                        label: '$(dashboard) Message Bus Metrics',
                        description: `Published: ${status.metrics.messagesPublished}`,
                        detail: `Delivered: ${status.metrics.messagesDelivered}, Dropped: ${status.metrics.messagesDropped}`
                    }
                ];
            }
            
            quickPick.show();
        })
    );

    // Sync all components
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.syncComponents', async () => {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing components...',
                cancellable: false
            }, async () => {
                // Trigger sync through state update
                integration!['stateStore'].dispatch({
                    type: 'SYNC_REQUESTED',
                    payload: { timestamp: Date.now() },
                    source: 'vscode',
                    timestamp: Date.now()
                });
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            });
            
            vscode.window.showInformationMessage('Components synchronized');
        })
    );

    // Enable/disable hot reload
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.toggleHotReload', () => {
            const config = vscode.workspace.getConfiguration('gameVibe');
            const current = config.get('enableHotReload', true);
            config.update('enableHotReload', !current);
            
            vscode.window.showInformationMessage(
                `Hot reload ${!current ? 'enabled' : 'disabled'}`
            );
        })
    );

    // Open integrated workspace
    context.subscriptions.push(
        vscode.commands.registerCommand('gameVibe.openIntegratedWorkspace', async () => {
            // Create a new workspace with all editors open
            await vscode.commands.executeCommand('gameVibe.openEditor');
            await vscode.commands.executeCommand('workbench.action.splitEditorRight');
            await vscode.commands.executeCommand('gameVibe.openSpriteEditor');
            await vscode.commands.executeCommand('workbench.action.splitEditorDown');
            await vscode.commands.executeCommand('gameVibe.openLevelDesigner');
            
            vscode.window.showInformationMessage('Integrated workspace ready!');
        })
    );
}

/**
 * Setup status bar items
 */
function setupStatusBar(context: vscode.ExtensionContext) {
    // Integration status
    const statusItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusItem.text = '$(circuit-board) Game Vibe';
    statusItem.tooltip = 'Click to show integration status';
    statusItem.command = 'gameVibe.showIntegrationStatus';
    statusItem.show();
    context.subscriptions.push(statusItem);

    // Engine status
    const engineStatus = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        99
    );
    
    // Update engine status
    if (integration && gameEngine) {
        integration.on('engine:connected', () => {
            engineStatus.text = '$(play) Engine Ready';
            engineStatus.color = '#4CAF50';
            engineStatus.show();
        });
        
        integration['stateStore'].subscribe((state) => {
            if (state.engine.running) {
                engineStatus.text = `$(debug-start) Running (${state.engine.fps} FPS)`;
            } else if (state.engine.paused) {
                engineStatus.text = '$(debug-pause) Paused';
            } else {
                engineStatus.text = '$(debug-stop) Stopped';
            }
        });
    }
    
    context.subscriptions.push(engineStatus);
}

/**
 * Setup configuration listeners
 */
function setupConfigurationListeners(context: vscode.ExtensionContext) {
    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('gameVibe')) {
                const config = vscode.workspace.getConfiguration('gameVibe');
                
                // Update debug logging
                if (e.affectsConfiguration('gameVibe.debug')) {
                    const debug = config.get('debug', false);
                    console.log(`Debug mode: ${debug ? 'enabled' : 'disabled'}`);
                }
                
                // Update hot reload
                if (e.affectsConfiguration('gameVibe.enableHotReload')) {
                    const hotReload = config.get('enableHotReload', true);
                    if (integration) {
                        integration['config'].enableHotReload = hotReload;
                    }
                }
            }
        })
    );
}

/**
 * Deactivate enhanced extension
 */
export function deactivateEnhanced() {
    console.log('Deactivating Game Vibe Engine Enhanced...');
    
    if (integration) {
        integration.dispose();
        integration = undefined;
    }
    
    if (gameEngine) {
        gameEngine.stop();
        gameEngine = undefined;
    }
    
    compiler = undefined;
    
    console.log('Game Vibe Engine Enhanced deactivated');
}