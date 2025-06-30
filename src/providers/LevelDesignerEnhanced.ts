/**
 * Enhanced Level Designer Provider with Live Preview
 * 
 * This enhanced version adds real-time game engine preview,
 * entity manipulation, and live testing capabilities.
 */

import * as vscode from 'vscode';
import { MessageBus, MessageType, getGlobalMessageBus } from '../engine/core/messaging/MessageBus';
import { EditorMessageBridge } from '../engine/core/messaging/MessageBridge';
import { UnifiedStateStore } from '../engine/core/state/UnifiedStateStore';
import { GameEngine } from '../engine/core/GameEngine';
import { GDLCompiler } from '../engine';
import { AssetType } from '../engine/core/types';

export interface LivePreviewConfig {
  enabled: boolean;
  autoRefresh: boolean;
  refreshDelay: number;
  showGrid: boolean;
  showColliders: boolean;
  showEntityBounds: boolean;
}

export class LevelDesignerEnhanced {
  private messageBus: MessageBus;
  private messageBridge: EditorMessageBridge;
  private stateStore?: UnifiedStateStore;
  private gameEngine?: GameEngine;
  private compiler?: GDLCompiler;
  private webviewPanel?: vscode.WebviewPanel;
  private previewEngine?: GameEngine;
  private livePreviewConfig: LivePreviewConfig;
  private refreshTimer?: NodeJS.Timeout;
  private isPreviewRunning: boolean = false;

  constructor(
    private provider: any, // Original LevelDesignerProvider
    messageBus?: MessageBus,
    stateStore?: UnifiedStateStore,
    gameEngine?: GameEngine,
    compiler?: GDLCompiler
  ) {
    this.messageBus = messageBus || getGlobalMessageBus();
    this.messageBridge = new EditorMessageBridge(this.messageBus, 'level-designer');
    this.stateStore = stateStore;
    this.gameEngine = gameEngine;
    this.compiler = compiler || new GDLCompiler();
    
    this.livePreviewConfig = {
      enabled: true,
      autoRefresh: true,
      refreshDelay: 500,
      showGrid: true,
      showColliders: false,
      showEntityBounds: false
    };
    
    this.setupMessageHandlers();
    this.messageBridge.connect();
  }

  /**
   * Setup message handlers for level designer
   */
  private setupMessageHandlers(): void {
    // Handle scene updates
    this.messageBridge.registerHandler(MessageType.SCENE_UPDATED, async (data) => {
      if (this.livePreviewConfig.enabled && this.livePreviewConfig.autoRefresh) {
        await this.refreshPreview();
      }
    });

    // Handle entity updates
    this.messageBridge.registerHandler(MessageType.ENTITY_UPDATED, async (data) => {
      this.updateEntityInPreview(data.entityId, data.updates);
    });

    // Handle preview requests
    this.messageBridge.registerHandler(MessageType.SYSTEM_REQUEST, async (data) => {
      if (data.action === 'startPreview') {
        await this.startLivePreview();
      } else if (data.action === 'stopPreview') {
        await this.stopLivePreview();
      }
    });
  }

  /**
   * Enhance the webview panel with live preview
   */
  enhanceWebviewPanel(webviewPanel: vscode.WebviewPanel): void {
    this.webviewPanel = webviewPanel;

    // Create preview engine
    this.previewEngine = new GameEngine({
      config: {
        rendering: {
          width: 800,
          height: 600,
          pixelArt: false,
          backgroundColor: '#1e1e1e',
          antialias: true,
          powerPreference: 'default'
        },
        debug: {
          enabled: true,
          showFPS: true,
          showMemory: false,
          showColliders: this.livePreviewConfig.showColliders,
          showBounds: this.livePreviewConfig.showEntityBounds,
          logLevel: 'error'
        }
      }
    });

    // Connect preview engine to state store
    if (this.stateStore) {
      this.previewEngine.connectStateStore(this.stateStore);
    }

    // Intercept messages from webview
    const originalHandler = webviewPanel.webview.onDidReceiveMessage;
    
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      // Handle level designer specific messages
      switch (message.command) {
        case 'entityAdded':
          await this.handleEntityAdded(message);
          break;
          
        case 'entityModified':
          await this.handleEntityModified(message);
          break;
          
        case 'entityDeleted':
          await this.handleEntityDeleted(message);
          break;
          
        case 'scenePropertyChanged':
          await this.handleScenePropertyChanged(message);
          break;
          
        case 'startLivePreview':
          await this.startLivePreview();
          break;
          
        case 'stopLivePreview':
          await this.stopLivePreview();
          break;
          
        case 'updatePreviewConfig':
          this.updatePreviewConfig(message.config);
          break;
          
        case 'testLevel':
          await this.testLevel();
          break;
          
        case 'requestPreviewFrame':
          await this.sendPreviewFrame();
          break;
      }

      // Also call original handler
      if (originalHandler) {
        originalHandler(message);
      }
    });

    // Enhance UI with live preview
    this.enhanceWebviewUI();
  }

  /**
   * Start live preview
   */
  private async startLivePreview(): Promise<void> {
    if (this.isPreviewRunning || !this.previewEngine) return;

    console.log('Starting live preview...');

    try {
      // Get current level content
      const levelContent = await this.getCurrentLevelContent();
      
      if (levelContent) {
        // Compile GDL to game code
        const compiled = await this.compiler!.compile(levelContent);
        
        // Load into preview engine
        await this.previewEngine.loadCompiledCode(compiled);
      }

      // Start preview engine
      this.previewEngine.start();
      this.isPreviewRunning = true;

      // Setup auto-refresh
      if (this.livePreviewConfig.autoRefresh) {
        this.startAutoRefresh();
      }

      // Notify webview
      this.webviewPanel?.webview.postMessage({
        command: 'previewStarted',
        config: this.livePreviewConfig
      });

      // Send initial frame
      await this.sendPreviewFrame();

      vscode.window.showInformationMessage('Live preview started');
    } catch (error) {
      console.error('Failed to start live preview:', error);
      vscode.window.showErrorMessage(`Failed to start preview: ${error}`);
    }
  }

  /**
   * Stop live preview
   */
  private async stopLivePreview(): Promise<void> {
    if (!this.isPreviewRunning || !this.previewEngine) return;

    console.log('Stopping live preview...');

    // Stop auto-refresh
    this.stopAutoRefresh();

    // Stop preview engine
    this.previewEngine.stop();
    this.isPreviewRunning = false;

    // Notify webview
    this.webviewPanel?.webview.postMessage({
      command: 'previewStopped'
    });

    vscode.window.showInformationMessage('Live preview stopped');
  }

  /**
   * Refresh preview with latest changes
   */
  private async refreshPreview(): Promise<void> {
    if (!this.isPreviewRunning || !this.previewEngine) return;

    try {
      const levelContent = await this.getCurrentLevelContent();
      
      if (levelContent) {
        // Compile and reload
        const compiled = await this.compiler!.compile(levelContent);
        await this.previewEngine.loadCompiledCode(compiled);
      }

      // Send updated frame
      await this.sendPreviewFrame();
    } catch (error) {
      console.error('Failed to refresh preview:', error);
    }
  }

  /**
   * Send preview frame to webview
   */
  private async sendPreviewFrame(): Promise<void> {
    if (!this.previewEngine || !this.webviewPanel) return;

    // Capture preview frame
    const canvas = this.previewEngine.getCanvas();
    let frameData: string | null = null;

    if (canvas && 'toDataURL' in canvas) {
      frameData = (canvas as any).toDataURL('image/png');
    }

    // Get engine state
    const engineState = {
      fps: this.previewEngine.getFPS(),
      entityCount: this.previewEngine.getEntityManager().getEntityCount(),
      running: this.previewEngine.isRunning(),
      paused: this.previewEngine.isPaused()
    };

    // Send to webview
    this.webviewPanel.webview.postMessage({
      command: 'previewFrame',
      frameData,
      engineState,
      timestamp: Date.now()
    });
  }

  /**
   * Handle entity addition
   */
  private async handleEntityAdded(message: any): Promise<void> {
    const { entityData, position } = message;

    // Add to state store
    if (this.stateStore) {
      this.stateStore.dispatch({
        type: 'ENTITY_CREATED',
        payload: {
          ...entityData,
          position
        },
        source: 'editor',
        timestamp: Date.now()
      });
    }

    // Notify engine
    this.messageBridge.sendEditorEvent(MessageType.ENTITY_CREATED, {
      entity: entityData,
      position
    });

    // Refresh preview
    if (this.livePreviewConfig.autoRefresh) {
      await this.refreshPreview();
    }
  }

  /**
   * Handle entity modification
   */
  private async handleEntityModified(message: any): Promise<void> {
    const { entityId, changes } = message;

    // Update in preview engine
    if (this.previewEngine && this.isPreviewRunning) {
      this.updateEntityInPreview(entityId, changes);
    }

    // Update state store
    if (this.stateStore) {
      this.stateStore.dispatch({
        type: 'ENTITY_UPDATED',
        payload: {
          entityId,
          changes
        },
        source: 'editor',
        timestamp: Date.now()
      });
    }

    // Notify engine
    this.messageBridge.sendEditorEvent(MessageType.ENTITY_UPDATED, {
      entityId,
      changes
    });
  }

  /**
   * Handle entity deletion
   */
  private async handleEntityDeleted(message: any): Promise<void> {
    const { entityId } = message;

    // Update state store
    if (this.stateStore) {
      this.stateStore.dispatch({
        type: 'ENTITY_DELETED',
        payload: { entityId },
        source: 'editor',
        timestamp: Date.now()
      });
    }

    // Notify engine
    this.messageBridge.sendEditorEvent(MessageType.ENTITY_DELETED, {
      entityId
    });

    // Refresh preview
    if (this.livePreviewConfig.autoRefresh) {
      await this.refreshPreview();
    }
  }

  /**
   * Handle scene property change
   */
  private async handleScenePropertyChanged(message: any): Promise<void> {
    const { property, value } = message;

    // Update scene in preview
    if (this.previewEngine && this.isPreviewRunning) {
      const activeScene = this.previewEngine.getActiveScene();
      if (activeScene) {
        switch (property) {
          case 'gravity':
            activeScene.setGravity(value.x, value.y);
            break;
          case 'background':
            activeScene.setBackground(value);
            break;
        }
      }
    }

    // Notify about scene update
    this.messageBridge.sendEditorEvent(MessageType.SCENE_UPDATED, {
      property,
      value
    });
  }

  /**
   * Update entity in preview engine
   */
  private updateEntityInPreview(entityId: string, changes: any): void {
    if (!this.previewEngine || !this.isPreviewRunning) return;

    const entity = this.previewEngine.getEntity(entityId);
    if (!entity) return;

    // Apply changes to entity components
    if (changes.position) {
      const transform = entity.getComponent('transform');
      if (transform) {
        transform.position.x = changes.position.x;
        transform.position.y = changes.position.y;
      }
    }

    if (changes.sprite) {
      const sprite = entity.getComponent('sprite');
      if (sprite) {
        Object.assign(sprite, changes.sprite);
      }
    }

    // Send updated frame
    this.sendPreviewFrame();
  }

  /**
   * Test level in full game mode
   */
  private async testLevel(): Promise<void> {
    if (!this.gameEngine) return;

    try {
      const levelContent = await this.getCurrentLevelContent();
      
      if (levelContent) {
        // Compile level
        const compiled = await this.compiler!.compile(levelContent);
        
        // Load into main game engine
        await this.gameEngine.loadCompiledCode(compiled);
        
        // Start game
        this.gameEngine.start();
        
        vscode.window.showInformationMessage('Level loaded in game engine');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to test level: ${error}`);
    }
  }

  /**
   * Update preview configuration
   */
  private updatePreviewConfig(config: Partial<LivePreviewConfig>): void {
    this.livePreviewConfig = { ...this.livePreviewConfig, ...config };

    // Update preview engine debug settings
    if (this.previewEngine) {
      const currentConfig = this.previewEngine.getConfig();
      this.previewEngine.updateConfig({
        debug: {
          ...currentConfig.debug,
          showColliders: this.livePreviewConfig.showColliders,
          showBounds: this.livePreviewConfig.showEntityBounds
        }
      });
    }

    // Restart auto-refresh if needed
    if (config.autoRefresh !== undefined || config.refreshDelay !== undefined) {
      this.stopAutoRefresh();
      if (this.livePreviewConfig.autoRefresh) {
        this.startAutoRefresh();
      }
    }

    // Send updated frame
    this.sendPreviewFrame();
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    if (this.refreshTimer) return;

    this.refreshTimer = setInterval(() => {
      this.sendPreviewFrame();
    }, this.livePreviewConfig.refreshDelay);
  }

  /**
   * Stop auto-refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Get current level content
   */
  private async getCurrentLevelContent(): Promise<string | null> {
    // Get from webview
    return new Promise((resolve) => {
      if (!this.webviewPanel) {
        resolve(null);
        return;
      }

      const handler = this.webviewPanel.webview.onDidReceiveMessage((msg) => {
        if (msg.command === 'levelContent') {
          handler.dispose();
          resolve(msg.content);
        }
      });

      this.webviewPanel.webview.postMessage({
        command: 'requestLevelContent'
      });

      // Timeout after 1 second
      setTimeout(() => {
        handler.dispose();
        resolve(null);
      }, 1000);
    });
  }

  /**
   * Enhance webview UI with live preview features
   */
  private enhanceWebviewUI(): void {
    this.webviewPanel?.webview.postMessage({
      command: 'enhanceUI',
      features: {
        livePreview: true,
        entityInspector: true,
        sceneProperties: true,
        playTest: true,
        debugOverlay: true
      },
      previewConfig: this.livePreviewConfig
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopAutoRefresh();
    
    if (this.previewEngine) {
      this.previewEngine.stop();
      this.previewEngine.disconnectStateStore();
      this.previewEngine = undefined;
    }
    
    this.messageBridge.disconnect();
  }
}

/**
 * Factory function to create enhanced level designer
 */
export function createEnhancedLevelDesigner(
  provider: any,
  messageBus?: MessageBus,
  stateStore?: UnifiedStateStore,
  gameEngine?: GameEngine,
  compiler?: GDLCompiler
): LevelDesignerEnhanced {
  return new LevelDesignerEnhanced(provider, messageBus, stateStore, gameEngine, compiler);
}