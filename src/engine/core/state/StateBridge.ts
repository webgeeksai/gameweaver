/**
 * State Bridge System
 * 
 * Bridges connect different parts of the application to the unified state store,
 * ensuring consistent state synchronization across all components.
 */

import { UnifiedStateStore, Action } from './UnifiedStateStore';
import { GameEngine } from '../GameEngine';
import { EventBus } from '../events/EventBus';

/**
 * Base class for all state bridges
 */
export abstract class StateBridge {
  protected store: UnifiedStateStore;
  protected connected: boolean = false;

  constructor(store: UnifiedStateStore) {
    this.store = store;
  }

  /**
   * Connect the bridge to start synchronization
   */
  abstract connect(): void;

  /**
   * Disconnect the bridge to stop synchronization
   */
  abstract disconnect(): void;

  /**
   * Check if bridge is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Engine State Bridge
 * 
 * Synchronizes game engine state with the unified store
 */
export class EngineStateBridge extends StateBridge {
  private engine: GameEngine;
  private updateInterval?: NodeJS.Timeout;
  private eventListeners: Map<string, Function> = new Map();

  constructor(store: UnifiedStateStore, engine: GameEngine) {
    super(store);
    this.engine = engine;
  }

  connect(): void {
    if (this.connected) return;

    // Listen to engine events
    const eventBus = this.engine.getEventBus();

    // Entity events
    const entityCreatedHandler = (data: any) => {
      this.store.dispatch({
        type: 'ENTITY_CREATED',
        payload: {
          id: data.entityId,
          name: data.name || `Entity_${data.entityId}`,
          tags: data.tags || [],
          sceneId: data.sceneId || 'default',
          active: true,
          components: new Map()
        },
        source: 'engine',
        timestamp: Date.now()
      });
    };
    eventBus.on('entity:created', entityCreatedHandler);
    this.eventListeners.set('entity:created', entityCreatedHandler);

    const entityDestroyedHandler = (data: any) => {
      this.store.dispatch({
        type: 'ENTITY_DELETED',
        payload: { id: data.entityId },
        source: 'engine',
        timestamp: Date.now()
      });
    };
    eventBus.on('entity:destroyed', entityDestroyedHandler);
    this.eventListeners.set('entity:destroyed', entityDestroyedHandler);

    // Component events
    const componentAddedHandler = (data: any) => {
      this.store.dispatch({
        type: 'COMPONENT_ADDED',
        payload: {
          entityId: data.entityId,
          componentType: data.componentType,
          componentData: data.componentData
        },
        source: 'engine',
        timestamp: Date.now()
      });
    };
    eventBus.on('component:added', componentAddedHandler);
    this.eventListeners.set('component:added', componentAddedHandler);

    const componentRemovedHandler = (data: any) => {
      this.store.dispatch({
        type: 'COMPONENT_REMOVED',
        payload: {
          entityId: data.entityId,
          componentType: data.componentType
        },
        source: 'engine',
        timestamp: Date.now()
      });
    };
    eventBus.on('component:removed', componentRemovedHandler);
    this.eventListeners.set('component:removed', componentRemovedHandler);

    // Scene events
    const sceneChangedHandler = (data: any) => {
      this.store.dispatch({
        type: 'SCENE_UPDATED',
        payload: {
          id: data.sceneId,
          changes: { active: true }
        },
        source: 'engine',
        timestamp: Date.now()
      });
    };
    eventBus.on('scene:changed', sceneChangedHandler);
    this.eventListeners.set('scene:changed', sceneChangedHandler);

    // Engine state updates
    this.updateInterval = setInterval(() => {
      this.store.dispatch({
        type: 'ENGINE_STATS_UPDATED',
        payload: {
          fps: this.engine.getFPS(),
          deltaTime: this.engine.getDeltaTime(),
          time: this.engine.getTime(),
          running: this.engine.isRunning(),
          paused: this.engine.isPaused()
        },
        source: 'engine',
        timestamp: Date.now()
      });
    }, 1000 / 30); // Update at 30Hz

    // Listen to store changes that affect engine
    this.store.subscribe((state, action) => {
      if (action.source === 'engine') return; // Ignore own actions

      switch (action.type) {
        case 'ENGINE_STARTED':
          if (!this.engine.isRunning()) {
            this.engine.start();
          }
          break;

        case 'ENGINE_STOPPED':
          if (this.engine.isRunning()) {
            this.engine.stop();
          }
          break;

        case 'ENGINE_PAUSED':
          this.engine.setPaused(action.payload);
          break;

        case 'ENTITY_CREATED':
          // Create entity in engine if it doesn't exist
          const entityManager = this.engine.getEntityManager();
          if (!entityManager.exists(action.payload.id)) {
            entityManager.createWithId(action.payload.id, {
              name: action.payload.name,
              tags: action.payload.tags
            }, action.payload.sceneId);
          }
          break;

        case 'ENTITY_DELETED':
          // Delete entity from engine
          this.engine.getEntityManager().destroy(action.payload.id);
          break;

        case 'COMPONENT_ADDED':
          // Add component to entity in engine
          const componentManager = this.engine.getComponentManager();
          componentManager.add(
            action.payload.entityId,
            action.payload.componentType,
            action.payload.componentData
          );
          break;

        case 'COMPONENT_REMOVED':
          // Remove component from entity in engine
          this.engine.getComponentManager().remove(
            action.payload.entityId,
            action.payload.componentType
          );
          break;
      }
    });

    this.connected = true;
  }

  disconnect(): void {
    if (!this.connected) return;

    // Remove event listeners
    const eventBus = this.engine.getEventBus();
    this.eventListeners.forEach((handler, event) => {
      eventBus.off(event, handler as any);
    });
    this.eventListeners.clear();

    // Clear update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    this.connected = false;
  }
}

/**
 * React State Bridge
 * 
 * Synchronizes React component state with the unified store
 */
export class ReactStateBridge extends StateBridge {
  private reactSetState?: (state: any) => void;
  private unsubscribe?: () => void;

  setReactSetState(setState: (state: any) => void): void {
    this.reactSetState = setState;
  }

  connect(): void {
    if (this.connected) return;

    // Subscribe to state changes
    this.unsubscribe = this.store.subscribe((state, action) => {
      if (this.reactSetState) {
        // Transform state for React consumption
        const reactState = {
          project: state.project,
          engine: state.engine,
          scenes: Array.from(state.scenes.values()),
          entities: Array.from(state.entities.values()),
          assets: Array.from(state.assets.values()),
          selectedEntityId: state.editors.selectedEntityId,
          selectedAssetId: state.editors.selectedAssetId,
          activeTool: state.ui.activeTool,
          zoom: state.ui.zoom,
          camera: state.ui.camera,
          grid: state.ui.grid
        };

        this.reactSetState(reactState);
      }
    });

    this.connected = true;
  }

  disconnect(): void {
    if (!this.connected) return;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    this.connected = false;
  }

  /**
   * Dispatch action from React component
   */
  dispatch(action: Omit<Action, 'source' | 'timestamp'>): void {
    this.store.dispatch({
      ...action,
      source: 'ui',
      timestamp: Date.now()
    });
  }
}

/**
 * VS Code State Bridge
 * 
 * Synchronizes VS Code extension state with the unified store
 */
export class VSCodeStateBridge extends StateBridge {
  private vscodeApi?: any;
  private messageHandler?: (event: MessageEvent) => void;

  setVSCodeApi(api: any): void {
    this.vscodeApi = api;
  }

  connect(): void {
    if (this.connected || !this.vscodeApi) return;

    // Listen to messages from VS Code
    this.messageHandler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'stateUpdate':
          // Update store with VS Code state
          this.store.dispatch({
            type: message.action,
            payload: message.payload,
            source: 'vscode',
            timestamp: Date.now()
          });
          break;

        case 'getState':
          // Send current state to VS Code
          this.vscodeApi.postMessage({
            type: 'state',
            state: this.store.getSnapshot()
          });
          break;
      }
    };

    window.addEventListener('message', this.messageHandler);

    // Subscribe to state changes
    this.store.subscribe((state, action) => {
      if (action.source === 'vscode') return; // Ignore own actions

      // Send relevant state changes to VS Code
      this.vscodeApi.postMessage({
        type: 'stateChanged',
        action: action.type,
        payload: action.payload,
        state: this.getRelevantState(state)
      });
    });

    this.connected = true;
  }

  disconnect(): void {
    if (!this.connected) return;

    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = undefined;
    }

    this.connected = false;
  }

  /**
   * Get relevant state for VS Code
   */
  private getRelevantState(state: any): any {
    return {
      project: state.project,
      assets: Array.from(state.assets.values()),
      scenes: Array.from(state.scenes.values())
    };
  }
}

/**
 * Editor State Bridge
 * 
 * Synchronizes editor states (Sprite Editor, Level Designer) with the unified store
 */
export class EditorStateBridge extends StateBridge {
  private editorType: 'sprite' | 'level';
  private editorApi?: any;
  private updateHandler?: (data: any) => void;

  constructor(store: UnifiedStateStore, editorType: 'sprite' | 'level') {
    super(store);
    this.editorType = editorType;
  }

  setEditorApi(api: any): void {
    this.editorApi = api;
  }

  connect(): void {
    if (this.connected || !this.editorApi) return;

    // Listen to editor updates
    this.updateHandler = (data: any) => {
      switch (data.type) {
        case 'assetUpdated':
          this.store.dispatch({
            type: 'ASSET_UPDATED',
            payload: {
              id: data.assetId,
              changes: data.changes
            },
            source: 'editor',
            timestamp: Date.now()
          });
          break;

        case 'entityUpdated':
          this.store.dispatch({
            type: 'ENTITY_UPDATED',
            payload: {
              id: data.entityId,
              changes: data.changes
            },
            source: 'editor',
            timestamp: Date.now()
          });
          break;

        case 'selectionChanged':
          this.store.dispatch({
            type: data.entityId ? 'ENTITY_SELECTED' : 'ASSET_SELECTED',
            payload: data.entityId || data.assetId,
            source: 'editor',
            timestamp: Date.now()
          });
          break;
      }
    };

    this.editorApi.on('update', this.updateHandler);

    // Subscribe to state changes
    this.store.subscribe((state, action) => {
      if (action.source === 'editor') return; // Ignore own actions

      // Send relevant updates to editor
      switch (action.type) {
        case 'ASSET_UPDATED':
          if (this.editorType === 'sprite' && action.payload.id === state.editors.selectedAssetId) {
            this.editorApi.updateAsset(action.payload);
          }
          break;

        case 'ENTITY_UPDATED':
          if (this.editorType === 'level' && action.payload.id === state.editors.selectedEntityId) {
            this.editorApi.updateEntity(action.payload);
          }
          break;

        case 'TOOL_CHANGED':
          this.editorApi.setTool(action.payload);
          break;

        case 'GRID_SETTINGS_CHANGED':
          this.editorApi.updateGridSettings(action.payload);
          break;
      }
    });

    this.connected = true;
  }

  disconnect(): void {
    if (!this.connected || !this.editorApi) return;

    if (this.updateHandler) {
      this.editorApi.off('update', this.updateHandler);
      this.updateHandler = undefined;
    }

    this.connected = false;
  }
}

/**
 * AI State Bridge
 * 
 * Synchronizes AI Assistant state with the unified store
 */
export class AIStateBridge extends StateBridge {
  private aiProcessor?: any;

  setAIProcessor(processor: any): void {
    this.aiProcessor = processor;
  }

  connect(): void {
    if (this.connected || !this.aiProcessor) return;

    // Provide state context to AI
    this.aiProcessor.setStateProvider(() => {
      const state = this.store.getState();
      return {
        entities: Array.from(state.entities.values()),
        scenes: Array.from(state.scenes.values()),
        assets: Array.from(state.assets.values()),
        currentScene: Array.from(state.scenes.values()).find(s => s.active),
        selectedEntity: state.editors.selectedEntityId 
          ? state.entities.get(state.editors.selectedEntityId)
          : null
      };
    });

    // Listen to AI commands
    this.aiProcessor.on('command', (command: any) => {
      this.store.dispatch({
        type: command.action,
        payload: command.payload,
        source: 'ai',
        timestamp: Date.now()
      });
    });

    this.connected = true;
  }

  disconnect(): void {
    if (!this.connected || !this.aiProcessor) return;

    this.aiProcessor.setStateProvider(null);
    this.aiProcessor.off('command');

    this.connected = false;
  }
}

/**
 * State Bridge Manager
 * 
 * Manages all state bridges
 */
export class StateBridgeManager {
  private store: UnifiedStateStore;
  private bridges: Map<string, StateBridge> = new Map();

  constructor(store: UnifiedStateStore) {
    this.store = store;
  }

  /**
   * Register a bridge
   */
  register(name: string, bridge: StateBridge): void {
    this.bridges.set(name, bridge);
  }

  /**
   * Get a bridge by name
   */
  get(name: string): StateBridge | undefined {
    return this.bridges.get(name);
  }

  /**
   * Connect all bridges
   */
  connectAll(): void {
    this.bridges.forEach(bridge => {
      if (!bridge.isConnected()) {
        bridge.connect();
      }
    });
  }

  /**
   * Disconnect all bridges
   */
  disconnectAll(): void {
    this.bridges.forEach(bridge => {
      if (bridge.isConnected()) {
        bridge.disconnect();
      }
    });
  }

  /**
   * Create standard bridges for the application
   */
  static createStandardBridges(store: UnifiedStateStore, engine?: GameEngine): StateBridgeManager {
    const manager = new StateBridgeManager(store);

    // Register standard bridges
    if (engine) {
      manager.register('engine', new EngineStateBridge(store, engine));
    }
    manager.register('react', new ReactStateBridge(store));
    manager.register('vscode', new VSCodeStateBridge(store));
    manager.register('spriteEditor', new EditorStateBridge(store, 'sprite'));
    manager.register('levelDesigner', new EditorStateBridge(store, 'level'));
    manager.register('ai', new AIStateBridge(store));

    return manager;
  }
}