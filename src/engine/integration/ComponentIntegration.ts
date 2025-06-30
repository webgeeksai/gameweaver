/**
 * Component Integration Manager
 * 
 * Orchestrates the connection between all disconnected components:
 * - Game Engine
 * - Sprite Editor
 * - Level Designer
 * - AI Assistant
 * - VS Code Extension
 */

import { GameEngine } from '../core/GameEngine';
import { UnifiedStateStore } from '../core/state/UnifiedStateStore';
import { MessageBus, getGlobalMessageBus } from '../core/messaging/MessageBus';
import { createMessageBridges, MessageBridge } from '../core/messaging/MessageBridge';
import { initializeAssetManagement, UnifiedAssetManager } from '../core/assets';
import { EventEmitter } from 'events';

export interface IntegrationConfig {
  enableHotReload?: boolean;
  enableAutoSync?: boolean;
  enableDebugLogging?: boolean;
  messageBusConfig?: {
    maxQueueSize?: number;
    enableMetrics?: boolean;
  };
}

export interface ComponentReference {
  name: string;
  component: any;
  type: 'engine' | 'editor' | 'ui' | 'extension';
  connected: boolean;
}

/**
 * Component Integration Manager
 */
export class ComponentIntegration extends EventEmitter {
  private stateStore: UnifiedStateStore;
  private messageBus: MessageBus;
  private assetManager: UnifiedAssetManager;
  private bridges: Map<string, MessageBridge> = new Map();
  private components: Map<string, ComponentReference> = new Map();
  private config: IntegrationConfig;
  private initialized: boolean = false;

  constructor(config?: IntegrationConfig) {
    super();
    
    this.config = {
      enableHotReload: true,
      enableAutoSync: true,
      enableDebugLogging: false,
      ...config
    };

    // Initialize core systems
    this.stateStore = new UnifiedStateStore();
    this.messageBus = getGlobalMessageBus({
      ...this.config.messageBusConfig,
      enableLogging: this.config.enableDebugLogging
    });

    // Initialize asset management
    const { assetManager } = initializeAssetManagement(this.stateStore);
    this.assetManager = assetManager;

    this.setupCoreListeners();
  }

  /**
   * Initialize the integration system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing Component Integration...');

    // Setup middleware for state store
    this.setupStateMiddleware();

    // Setup message bus listeners
    this.setupMessageBusListeners();

    this.initialized = true;
    this.emit('initialized');

    console.log('Component Integration initialized');
  }

  /**
   * Register a component
   */
  registerComponent(name: string, component: any, type: ComponentReference['type']): void {
    this.components.set(name, {
      name,
      component,
      type,
      connected: false
    });

    console.log(`Registered component: ${name} (${type})`);
    this.emit('component:registered', { name, type });
  }

  /**
   * Connect a game engine
   */
  connectGameEngine(engine: GameEngine): void {
    this.registerComponent('game-engine', engine, 'engine');

    // Connect engine to state store
    engine.connectStateStore(this.stateStore);

    // Create message bridges
    const engineBridges = createMessageBridges(this.messageBus, {
      engine,
      stateStore: this.stateStore
    });

    engineBridges.forEach((bridge, key) => {
      this.bridges.set(key, bridge);
    });

    // Mark as connected
    const ref = this.components.get('game-engine');
    if (ref) ref.connected = true;

    console.log('Game Engine connected');
    this.emit('engine:connected', engine);
  }

  /**
   * Connect sprite editor
   */
  connectSpriteEditor(editor: any): void {
    this.registerComponent('sprite-editor', editor, 'editor');

    // Create editor bridge
    const bridges = createMessageBridges(this.messageBus, {
      editors: [{ name: 'sprite-editor', component: editor }]
    });

    bridges.forEach((bridge, key) => {
      this.bridges.set(key, bridge);
    });

    // Setup sprite editor specific integration
    if (editor.enhanceWebviewPanel) {
      // Already enhanced sprite editor
      const ref = this.components.get('sprite-editor');
      if (ref) ref.connected = true;
    }

    console.log('Sprite Editor connected');
    this.emit('editor:connected', { name: 'sprite-editor', editor });
  }

  /**
   * Connect level designer
   */
  connectLevelDesigner(designer: any): void {
    this.registerComponent('level-designer', designer, 'editor');

    // Create designer bridge
    const bridges = createMessageBridges(this.messageBus, {
      editors: [{ name: 'level-designer', component: designer }]
    });

    bridges.forEach((bridge, key) => {
      this.bridges.set(key, bridge);
    });

    // Mark as connected
    const ref = this.components.get('level-designer');
    if (ref) ref.connected = true;

    console.log('Level Designer connected');
    this.emit('editor:connected', { name: 'level-designer', designer });
  }

  /**
   * Connect AI assistant
   */
  connectAIAssistant(assistant: any): void {
    this.registerComponent('ai-assistant', assistant, 'ui');

    // Setup AI-specific message handling
    this.messageBus.subscribe('ai:command', async (message) => {
      const response = await assistant.processCommand(message.payload);
      
      this.stateStore.dispatch({
        type: 'AI_RESPONSE',
        payload: response,
        source: 'ai',
        timestamp: Date.now()
      });
    });

    // Mark as connected
    const ref = this.components.get('ai-assistant');
    if (ref) ref.connected = true;

    console.log('AI Assistant connected');
    this.emit('ai:connected', assistant);
  }

  /**
   * Connect VS Code extension
   */
  connectVSCodeExtension(extension: any): void {
    this.registerComponent('vscode-extension', extension, 'extension');

    // Create VS Code bridge if needed
    const bridges = createMessageBridges(this.messageBus, {
      stateStore: this.stateStore
    });

    bridges.forEach((bridge, key) => {
      this.bridges.set(key, bridge);
    });

    // Mark as connected
    const ref = this.components.get('vscode-extension');
    if (ref) ref.connected = true;

    console.log('VS Code Extension connected');
    this.emit('extension:connected', extension);
  }

  /**
   * Setup core listeners
   */
  private setupCoreListeners(): void {
    // Listen for component lifecycle events
    this.on('component:registered', ({ name, type }) => {
      if (this.config.enableAutoSync) {
        this.syncComponent(name);
      }
    });

    // Listen for state changes
    this.stateStore.subscribe((state, action) => {
      if (this.config.enableDebugLogging) {
        console.log(`State changed: ${action.type}`, action.payload);
      }
    });
  }

  /**
   * Setup state middleware
   */
  private setupStateMiddleware(): void {
    // Logging middleware
    if (this.config.enableDebugLogging) {
      this.stateStore.use((action, next) => {
        console.log(`[State] Action: ${action.type}`, action);
        const startTime = Date.now();
        next(action);
        console.log(`[State] Completed in ${Date.now() - startTime}ms`);
      });
    }

    // Validation middleware
    this.stateStore.use((action, next) => {
      // Validate action structure
      if (!action.type || !action.source) {
        console.error('Invalid action:', action);
        return;
      }
      next(action);
    });

    // Auto-sync middleware
    if (this.config.enableAutoSync) {
      this.stateStore.use((action, next) => {
        next(action);
        // Sync relevant components after state change
        this.syncAffectedComponents(action);
      });
    }
  }

  /**
   * Setup message bus listeners
   */
  private setupMessageBusListeners(): void {
    // Listen for errors
    this.messageBus.on('error', ({ message, error }) => {
      console.error(`Message bus error for ${message.type}:`, error);
      this.emit('error', { message, error });
    });

    // Listen for metrics if enabled
    if (this.config.messageBusConfig?.enableMetrics) {
      setInterval(() => {
        const metrics = this.messageBus.getMetrics();
        this.emit('metrics', metrics);
      }, 5000);
    }
  }

  /**
   * Sync a specific component
   */
  private syncComponent(name: string): void {
    const ref = this.components.get(name);
    if (!ref || !ref.connected) return;

    const state = this.stateStore.getState();
    
    // Send sync message
    this.messageBus.publish({
      type: 'sync:request',
      source: 'integration',
      target: name,
      payload: {
        state: this.getRelevantState(name, state),
        timestamp: Date.now()
      }
    });
  }

  /**
   * Sync components affected by an action
   */
  private syncAffectedComponents(action: any): void {
    // Determine which components need syncing based on action
    const affectedComponents = this.getAffectedComponents(action);
    
    affectedComponents.forEach(name => {
      this.syncComponent(name);
    });
  }

  /**
   * Get components affected by an action
   */
  private getAffectedComponents(action: any): string[] {
    const affected: string[] = [];

    switch (action.type) {
      case 'ENTITY_CREATED':
      case 'ENTITY_UPDATED':
      case 'ENTITY_DELETED':
        affected.push('sprite-editor', 'level-designer', 'game-engine');
        break;
        
      case 'ASSET_LOADED':
      case 'ASSET_UPDATED':
        affected.push('sprite-editor', 'game-engine');
        break;
        
      case 'SCENE_CHANGED':
        affected.push('level-designer', 'game-engine');
        break;
    }

    return affected.filter(name => {
      const ref = this.components.get(name);
      return ref && ref.connected;
    });
  }

  /**
   * Get relevant state for a component
   */
  private getRelevantState(componentName: string, state: any): any {
    // Return only the state relevant to each component
    switch (componentName) {
      case 'sprite-editor':
        return {
          assets: Array.from(state.assets.values()).filter((a: any) => a.type === 'sprite'),
          selectedEntity: state.editors.selectedEntityId
        };
        
      case 'level-designer':
        return {
          scenes: Array.from(state.scenes.values()),
          entities: Array.from(state.entities.values()),
          activeScene: Array.from(state.scenes.values()).find((s: any) => s.active)
        };
        
      case 'game-engine':
        return {
          engine: state.engine,
          scenes: state.scenes,
          entities: state.entities
        };
        
      default:
        return state;
    }
  }

  /**
   * Get integration status
   */
  getStatus(): {
    initialized: boolean;
    components: Array<{ name: string; type: string; connected: boolean }>;
    bridges: string[];
    metrics?: any;
  } {
    return {
      initialized: this.initialized,
      components: Array.from(this.components.values()).map(ref => ({
        name: ref.name,
        type: ref.type,
        connected: ref.connected
      })),
      bridges: Array.from(this.bridges.keys()),
      metrics: this.config.messageBusConfig?.enableMetrics 
        ? this.messageBus.getMetrics() 
        : undefined
    };
  }

  /**
   * Cleanup
   */
  dispose(): void {
    // Disconnect all bridges
    this.bridges.forEach(bridge => bridge.disconnect());
    this.bridges.clear();

    // Clear components
    this.components.clear();

    // Clear message bus
    this.messageBus.clear();

    this.removeAllListeners();
    console.log('Component Integration disposed');
  }
}

// Global integration instance
let globalIntegration: ComponentIntegration | null = null;

/**
 * Get or create global integration manager
 */
export function getGlobalIntegration(config?: IntegrationConfig): ComponentIntegration {
  if (!globalIntegration) {
    globalIntegration = new ComponentIntegration(config);
  }
  return globalIntegration;
}

/**
 * Create and setup complete integration
 */
export async function setupCompleteIntegration(
  components: {
    engine?: GameEngine;
    spriteEditor?: any;
    levelDesigner?: any;
    aiAssistant?: any;
    vscodeExtension?: any;
  },
  config?: IntegrationConfig
): Promise<ComponentIntegration> {
  const integration = getGlobalIntegration(config);
  
  await integration.initialize();

  // Connect all provided components
  if (components.engine) {
    integration.connectGameEngine(components.engine);
  }
  
  if (components.spriteEditor) {
    integration.connectSpriteEditor(components.spriteEditor);
  }
  
  if (components.levelDesigner) {
    integration.connectLevelDesigner(components.levelDesigner);
  }
  
  if (components.aiAssistant) {
    integration.connectAIAssistant(components.aiAssistant);
  }
  
  if (components.vscodeExtension) {
    integration.connectVSCodeExtension(components.vscodeExtension);
  }

  console.log('Complete integration setup finished');
  console.log('Status:', integration.getStatus());

  return integration;
}