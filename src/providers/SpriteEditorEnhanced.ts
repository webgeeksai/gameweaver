/**
 * Enhanced Sprite Editor Provider with Game Engine Integration
 * 
 * This enhanced version connects the sprite editor to the game engine
 * through the unified state store and message bus.
 */

import * as vscode from 'vscode';
import { MessageBus, MessageType, getGlobalMessageBus } from '../engine/core/messaging/MessageBus';
import { EditorMessageBridge } from '../engine/core/messaging/MessageBridge';
import { UnifiedStateStore } from '../engine/core/state/UnifiedStateStore';
import { AssetType } from '../engine/core/types';

export class SpriteEditorEnhanced {
    private messageBus: MessageBus;
    private messageBridge: EditorMessageBridge;
    private stateStore?: UnifiedStateStore;
    private webviewPanel?: vscode.WebviewPanel;

    constructor(
        private provider: any, // Original SpriteEditorProvider
        messageBus?: MessageBus,
        stateStore?: UnifiedStateStore
    ) {
        this.messageBus = messageBus || getGlobalMessageBus();
        this.messageBridge = new EditorMessageBridge(this.messageBus, 'sprite-editor');
        this.stateStore = stateStore;
        
        this.setupMessageHandlers();
        this.messageBridge.connect();
    }

    /**
     * Setup message handlers for sprite editor
     */
    private setupMessageHandlers(): void {
        // Handle engine entity selection
        this.messageBridge.registerHandler(MessageType.ENTITY_SELECTED, async (data) => {
            const entityIds = data.entityIds;
            if (entityIds && entityIds.length > 0) {
                // Load sprite for selected entity
                await this.loadEntitySprite(entityIds[0]);
            }
        });

        // Handle asset updates
        this.messageBridge.registerHandler(MessageType.ASSET_UPDATED, async (data) => {
            if (data.type === AssetType.Sprite) {
                // Refresh sprite in editor
                await this.refreshSprite(data.id);
            }
        });

        // Handle requests for sprite data
        this.messageBridge.registerHandler(MessageType.ASSET_REQUEST, async (data) => {
            if (data.type === AssetType.Sprite) {
                const spriteData = await this.getSpriteData(data.id);
                this.messageBridge.sendEditorEvent(MessageType.SYSTEM_RESPONSE, {
                    correlationId: data.correlationId,
                    data: spriteData
                });
            }
        });
    }

    /**
     * Enhance the webview panel with engine integration
     */
    enhanceWebviewPanel(webviewPanel: vscode.WebviewPanel): void {
        this.webviewPanel = webviewPanel;

        // Intercept messages from webview
        const originalHandler = webviewPanel.webview.onDidReceiveMessage;
        
        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            // Handle sprite editor specific messages
            switch (message.command) {
                case 'spriteCreated':
                    await this.handleSpriteCreated(message);
                    break;
                    
                case 'spriteModified':
                    await this.handleSpriteModified(message);
                    break;
                    
                case 'frameAdded':
                    await this.handleFrameAdded(message);
                    break;
                    
                case 'animationCreated':
                    await this.handleAnimationCreated(message);
                    break;
                    
                case 'requestEnginePreview':
                    await this.sendToEnginePreview(message.spriteData);
                    break;
                    
                case 'syncWithEngine':
                    await this.syncWithEngine();
                    break;
            }

            // Also call original handler
            if (originalHandler) {
                originalHandler(message);
            }
        });

        // Send enhanced UI to webview
        this.enhanceWebviewUI();
    }

    /**
     * Handle sprite creation
     */
    private async handleSpriteCreated(message: any): Promise<void> {
        const { spriteData, metadata } = message;

        // Create asset in state store
        if (this.stateStore) {
            this.stateStore.dispatch({
                type: 'ASSET_ADDED',
                payload: {
                    id: metadata.id,
                    name: metadata.name,
                    type: AssetType.Sprite,
                    path: metadata.path,
                    metadata: {
                        width: metadata.width,
                        height: metadata.height,
                        frameCount: metadata.frameCount,
                        ...metadata
                    },
                    loaded: true,
                    loading: false
                },
                source: 'editor',
                timestamp: Date.now()
            });
        }

        // Notify engine
        this.messageBridge.sendEditorEvent(MessageType.ASSET_LOADED, {
            id: metadata.id,
            type: AssetType.Sprite,
            data: spriteData,
            metadata
        });
    }

    /**
     * Handle sprite modification
     */
    private async handleSpriteModified(message: any): Promise<void> {
        const { spriteId, changes } = message;

        // Update asset in state store
        if (this.stateStore) {
            this.stateStore.dispatch({
                type: 'ASSET_UPDATED',
                payload: {
                    id: spriteId,
                    changes
                },
                source: 'editor',
                timestamp: Date.now()
            });
        }

        // Notify engine for hot reload
        this.messageBridge.sendEditorEvent(MessageType.ASSET_UPDATED, {
            id: spriteId,
            type: AssetType.Sprite,
            changes
        });
    }

    /**
     * Handle frame addition
     */
    private async handleFrameAdded(message: any): Promise<void> {
        const { spriteId, frameData, frameIndex } = message;

        // Update sprite metadata
        this.messageBridge.sendEditorEvent(MessageType.COMPONENT_UPDATED, {
            entityId: spriteId,
            componentType: 'sprite',
            updates: {
                frames: { [frameIndex]: frameData }
            }
        });
    }

    /**
     * Handle animation creation
     */
    private async handleAnimationCreated(message: any): Promise<void> {
        const { spriteId, animationData } = message;

        // Create animation component
        this.messageBridge.sendEditorEvent(MessageType.COMPONENT_ADDED, {
            entityId: spriteId,
            componentType: 'animation',
            componentData: animationData
        });
    }

    /**
     * Send sprite to engine preview
     */
    private async sendToEnginePreview(spriteData: any): Promise<void> {
        // Request engine to create preview entity
        const response = await this.messageBridge.requestData<any>(
            'engine',
            MessageType.SYSTEM_REQUEST,
            {
                action: 'createPreviewEntity',
                entityType: 'sprite',
                data: spriteData
            }
        );

        if (response.success) {
            vscode.window.showInformationMessage('Sprite sent to engine preview');
        }
    }

    /**
     * Sync sprite editor with engine state
     */
    private async syncWithEngine(): Promise<void> {
        if (!this.stateStore) return;

        const state = this.stateStore.getState();
        const sprites = Array.from(state.assets.values())
            .filter(asset => asset.type === AssetType.Sprite);

        // Send sprite list to webview
        this.webviewPanel?.webview.postMessage({
            command: 'updateSpriteList',
            sprites: sprites.map(sprite => ({
                id: sprite.id,
                name: sprite.name,
                path: sprite.path,
                metadata: sprite.metadata
            }))
        });

        // Get selected entity's sprite
        const selectedEntityId = state.editors.selectedEntityId;
        if (selectedEntityId) {
            const entity = state.entities.get(selectedEntityId);
            if (entity) {
                const spriteComponent = entity.components.get('sprite');
                if (spriteComponent) {
                    await this.loadEntitySprite(selectedEntityId.toString());
                }
            }
        }
    }

    /**
     * Load sprite for an entity
     */
    private async loadEntitySprite(entityId: string): Promise<void> {
        if (!this.stateStore) return;

        const state = this.stateStore.getState();
        const entity = Array.from(state.entities.values())
            .find(e => e.id.toString() === entityId);

        if (entity) {
            const spriteComponent = entity.components.get('sprite');
            if (spriteComponent && spriteComponent.assetId) {
                const sprite = state.assets.get(spriteComponent.assetId);
                if (sprite) {
                    this.webviewPanel?.webview.postMessage({
                        command: 'loadSprite',
                        spriteData: sprite.data,
                        metadata: sprite.metadata
                    });
                }
            }
        }
    }

    /**
     * Refresh sprite in editor
     */
    private async refreshSprite(spriteId: string): Promise<void> {
        if (!this.stateStore) return;

        const state = this.stateStore.getState();
        const sprite = state.assets.get(spriteId);

        if (sprite) {
            this.webviewPanel?.webview.postMessage({
                command: 'refreshSprite',
                spriteId,
                spriteData: sprite.data,
                metadata: sprite.metadata
            });
        }
    }

    /**
     * Get sprite data
     */
    private async getSpriteData(spriteId: string): Promise<any> {
        if (!this.stateStore) return null;

        const state = this.stateStore.getState();
        const sprite = state.assets.get(spriteId);

        return sprite ? {
            id: sprite.id,
            data: sprite.data,
            metadata: sprite.metadata
        } : null;
    }

    /**
     * Enhance webview UI with engine integration features
     */
    private enhanceWebviewUI(): void {
        this.webviewPanel?.webview.postMessage({
            command: 'enhanceUI',
            features: {
                enginePreview: true,
                hotReload: true,
                entitySync: true,
                animationTest: true
            }
        });
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.messageBridge.disconnect();
    }
}

/**
 * Factory function to create enhanced sprite editor
 */
export function createEnhancedSpriteEditor(
    provider: any,
    messageBus?: MessageBus,
    stateStore?: UnifiedStateStore
): SpriteEditorEnhanced {
    return new SpriteEditorEnhanced(provider, messageBus, stateStore);
}