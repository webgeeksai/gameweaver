/**
 * Unified State Store for Game Vibe Engine
 * 
 * This store provides a centralized state management system that bridges
 * all components: Game Engine, Sprite Editor, Level Designer, AI Assistant,
 * VS Code Extension, and React UI.
 */

import { EventEmitter } from 'events';
import { Entity } from '../ecs/Entity';
import { Component } from '../ecs/Component';

// State types
export interface Vector2State {
  x: number;
  y: number;
}

export interface EntityState {
  id: number;
  name: string;
  tags: string[];
  sceneId: string;
  active: boolean;
  components: Map<string, any>;
}

export interface SceneState {
  id: string;
  name: string;
  active: boolean;
  entities: Set<number>;
  background: string;
  gravity: Vector2State;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AssetState {
  id: string;
  name: string;
  type: 'sprite' | 'sound' | 'level' | 'prefab' | 'other';
  path: string;
  data?: any;
  metadata: {
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
    [key: string]: any;
  };
  loaded: boolean;
  loading: boolean;
  error?: string;
}

export interface EditorState {
  activeEditor: 'sprite' | 'level' | 'code' | null;
  selectedEntityId?: number;
  selectedAssetId?: string;
  clipboard?: any;
  history: Action[];
  historyIndex: number;
}

export interface EngineState {
  running: boolean;
  paused: boolean;
  fps: number;
  deltaTime: number;
  time: number;
}

export interface UIState {
  activeTool: string;
  activePanel: string;
  zoom: number;
  camera: Vector2State;
  grid: {
    enabled: boolean;
    size: number;
    snap: boolean;
  };
}

export interface ProjectState {
  name: string;
  version: string;
  path: string;
  settings: {
    targetFPS: number;
    pixelArt: boolean;
    antiAliasing: boolean;
    [key: string]: any;
  };
}

export interface AIState {
  context: {
    recentCommands: string[];
    currentTask?: string;
    generatedCode?: string;
  };
  suggestions: string[];
  isProcessing: boolean;
}

export interface UnifiedAppState {
  project: ProjectState;
  engine: EngineState;
  scenes: Map<string, SceneState>;
  entities: Map<number, EntityState>;
  assets: Map<string, AssetState>;
  editors: EditorState;
  ui: UIState;
  ai: AIState;
}

// Action types
export interface Action {
  type: string;
  payload?: any;
  timestamp: number;
  source: 'engine' | 'ui' | 'editor' | 'ai' | 'vscode' | 'undo-redo' | string;
}

// State listener
export type StateListener = (state: UnifiedAppState, action: Action) => void;
export type Unsubscribe = () => void;

// Middleware
export type Middleware = (action: Action, next: (action: Action) => void) => void;

/**
 * Unified State Store
 * 
 * Provides centralized state management with:
 * - Redux-like action dispatch
 * - State subscriptions
 * - Middleware support
 * - State persistence
 * - Time-travel debugging
 */
export class UnifiedStateStore extends EventEmitter {
  private state: UnifiedAppState;
  private stateListeners: Set<StateListener> = new Set();
  private middleware: Middleware[] = [];
  private isDispatching: boolean = false;
  private actionQueue: Action[] = [];

  constructor(initialState?: Partial<UnifiedAppState>) {
    super();
    this.state = this.createInitialState(initialState);
  }

  /**
   * Create initial state with defaults
   */
  private createInitialState(partial?: Partial<UnifiedAppState>): UnifiedAppState {
    return {
      project: {
        name: 'Untitled Game',
        version: '1.0.0',
        path: '',
        settings: {
          targetFPS: 60,
          pixelArt: false,
          antiAliasing: true,
          ...partial?.project?.settings
        },
        ...partial?.project
      },
      engine: {
        running: false,
        paused: false,
        fps: 0,
        deltaTime: 0,
        time: 0,
        ...partial?.engine
      },
      scenes: new Map(partial?.scenes),
      entities: new Map(partial?.entities),
      assets: new Map(partial?.assets),
      editors: {
        activeEditor: null,
        history: [],
        historyIndex: -1,
        ...partial?.editors
      },
      ui: {
        activeTool: 'select',
        activePanel: 'inspector',
        zoom: 1,
        camera: { x: 0, y: 0 },
        grid: {
          enabled: true,
          size: 16,
          snap: true
        },
        ...partial?.ui
      },
      ai: {
        context: {
          recentCommands: [],
          ...partial?.ai?.context
        },
        suggestions: [],
        isProcessing: false,
        ...partial?.ai
      }
    };
  }

  /**
   * Get current state
   */
  getState(): UnifiedAppState {
    return this.state;
  }

  /**
   * Dispatch an action to update state
   */
  dispatch(action: Action): void {
    // Add timestamp if not present
    if (!action.timestamp) {
      action.timestamp = Date.now();
    }

    // Queue action if already dispatching (prevent recursion)
    if (this.isDispatching) {
      this.actionQueue.push(action);
      return;
    }

    this.isDispatching = true;

    try {
      // Run middleware
      this.runMiddleware(action, (processedAction) => {
        // Update state
        const newState = this.reducer(this.state, processedAction);
        
        if (newState !== this.state) {
          this.state = newState;
          
          // Add to history (for undo/redo)
          if (this.shouldAddToHistory(processedAction)) {
            this.addToHistory(processedAction);
          }

          // Notify listeners
          this.notifyListeners(processedAction);
        }
      });
    } finally {
      this.isDispatching = false;
      
      // Process queued actions
      while (this.actionQueue.length > 0) {
        const queuedAction = this.actionQueue.shift()!;
        this.dispatch(queuedAction);
      }
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): Unsubscribe {
    this.stateListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Add middleware
   */
  use(middleware: Middleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Main reducer function
   */
  private reducer(state: UnifiedAppState, action: Action): UnifiedAppState {
    switch (action.type) {
      // Project actions
      case 'PROJECT_LOADED':
        return {
          ...state,
          project: action.payload
        };

      // Engine actions
      case 'ENGINE_STARTED':
        return {
          ...state,
          engine: { ...state.engine, running: true }
        };

      case 'ENGINE_STOPPED':
        return {
          ...state,
          engine: { ...state.engine, running: false }
        };

      case 'ENGINE_PAUSED':
        return {
          ...state,
          engine: { ...state.engine, paused: action.payload }
        };

      case 'ENGINE_STATS_UPDATED':
        return {
          ...state,
          engine: { ...state.engine, ...action.payload }
        };

      // Scene actions
      case 'SCENE_CREATED':
        const newScenes = new Map(state.scenes);
        newScenes.set(action.payload.id, action.payload);
        return { ...state, scenes: newScenes };

      case 'SCENE_UPDATED':
        const updatedScenes = new Map(state.scenes);
        const scene = updatedScenes.get(action.payload.id);
        if (scene) {
          updatedScenes.set(action.payload.id, { ...scene, ...action.payload.changes });
        }
        return { ...state, scenes: updatedScenes };

      case 'SCENE_DELETED':
        const deletedScenes = new Map(state.scenes);
        deletedScenes.delete(action.payload.id);
        return { ...state, scenes: deletedScenes };

      // Entity actions
      case 'ENTITY_CREATED':
        const newEntities = new Map(state.entities);
        newEntities.set(action.payload.id, action.payload);
        return { ...state, entities: newEntities };

      case 'ENTITY_UPDATED':
        const updatedEntities = new Map(state.entities);
        const entity = updatedEntities.get(action.payload.id);
        if (entity) {
          updatedEntities.set(action.payload.id, { ...entity, ...action.payload.changes });
        }
        return { ...state, entities: updatedEntities };

      case 'ENTITY_DELETED':
        const deletedEntities = new Map(state.entities);
        deletedEntities.delete(action.payload.id);
        return { ...state, entities: deletedEntities };

      // Component actions
      case 'COMPONENT_ADDED':
        const entitiesWithComp = new Map(state.entities);
        const entityForComp = entitiesWithComp.get(action.payload.entityId);
        if (entityForComp) {
          const components = new Map(entityForComp.components);
          components.set(action.payload.componentType, action.payload.componentData);
          entitiesWithComp.set(action.payload.entityId, {
            ...entityForComp,
            components
          });
        }
        return { ...state, entities: entitiesWithComp };

      case 'COMPONENT_REMOVED':
        const entitiesWithoutComp = new Map(state.entities);
        const entityForRemoval = entitiesWithoutComp.get(action.payload.entityId);
        if (entityForRemoval) {
          const components = new Map(entityForRemoval.components);
          components.delete(action.payload.componentType);
          entitiesWithoutComp.set(action.payload.entityId, {
            ...entityForRemoval,
            components
          });
        }
        return { ...state, entities: entitiesWithoutComp };

      // Asset actions
      case 'ASSET_ADDED':
        const newAssets = new Map(state.assets);
        newAssets.set(action.payload.id, action.payload);
        return { ...state, assets: newAssets };

      case 'ASSET_UPDATED':
        const updatedAssets = new Map(state.assets);
        const asset = updatedAssets.get(action.payload.id);
        if (asset) {
          updatedAssets.set(action.payload.id, { ...asset, ...action.payload.changes });
        }
        return { ...state, assets: updatedAssets };

      case 'ASSET_DELETED':
        const deletedAssets = new Map(state.assets);
        deletedAssets.delete(action.payload.id);
        return { ...state, assets: deletedAssets };

      case 'ASSET_LOADED':
        const loadedAssets = new Map(state.assets);
        const assetToLoad = loadedAssets.get(action.payload.id);
        if (assetToLoad) {
          loadedAssets.set(action.payload.id, {
            ...assetToLoad,
            loaded: true,
            loading: false,
            data: action.payload.data
          });
        }
        return { ...state, assets: loadedAssets };

      // Editor actions
      case 'EDITOR_CHANGED':
        return {
          ...state,
          editors: { ...state.editors, activeEditor: action.payload }
        };

      case 'ENTITY_SELECTED':
        return {
          ...state,
          editors: { ...state.editors, selectedEntityId: action.payload }
        };

      case 'ASSET_SELECTED':
        return {
          ...state,
          editors: { ...state.editors, selectedAssetId: action.payload }
        };

      // UI actions
      case 'TOOL_CHANGED':
        return {
          ...state,
          ui: { ...state.ui, activeTool: action.payload }
        };

      case 'ZOOM_CHANGED':
        return {
          ...state,
          ui: { ...state.ui, zoom: action.payload }
        };

      case 'CAMERA_MOVED':
        return {
          ...state,
          ui: { ...state.ui, camera: action.payload }
        };

      case 'GRID_SETTINGS_CHANGED':
        return {
          ...state,
          ui: { ...state.ui, grid: { ...state.ui.grid, ...action.payload } }
        };

      // Batch actions
      case 'BATCH_UPDATE':
        return action.payload.reduce((acc: UnifiedAppState, subAction: Action) => {
          return this.reducer(acc, subAction);
        }, state);

      default:
        return state;
    }
  }

  /**
   * Run middleware chain
   */
  private runMiddleware(action: Action, done: (action: Action) => void): void {
    const middlewareChain = [...this.middleware];
    
    const next = (processedAction: Action): void => {
      const middleware = middlewareChain.shift();
      if (middleware) {
        middleware(processedAction, next);
      } else {
        done(processedAction);
      }
    };

    next(action);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(action: Action): void {
    this.stateListeners.forEach(listener => {
      try {
        listener(this.state, action);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });

    // Emit event for specific action types
    this.emit(action.type, { state: this.state, action });
    this.emit('stateChanged', { state: this.state, action });
  }

  /**
   * Check if action should be added to history
   */
  private shouldAddToHistory(action: Action): boolean {
    // Don't add certain actions to history
    const excludedActions = [
      'ENGINE_STATS_UPDATED',
      'ASSET_LOADING',
      'ASSET_LOADED'
    ];
    
    return !excludedActions.includes(action.type);
  }

  /**
   * Add action to history for undo/redo
   */
  private addToHistory(action: Action): void {
    const history = [...this.state.editors.history];
    const historyIndex = this.state.editors.historyIndex;

    // Remove any actions after current index (for redo)
    history.splice(historyIndex + 1);
    
    // Add new action
    history.push(action);

    // Limit history size
    const maxHistorySize = 100;
    if (history.length > maxHistorySize) {
      history.shift();
    }

    // Update state
    this.state = {
      ...this.state,
      editors: {
        ...this.state.editors,
        history,
        historyIndex: history.length - 1
      }
    };
  }

  /**
   * Undo last action
   */
  undo(): void {
    const { history, historyIndex } = this.state.editors;
    
    if (historyIndex > 0) {
      // TODO: Implement undo by reversing actions
      console.log('Undo not yet implemented');
    }
  }

  /**
   * Redo action
   */
  redo(): void {
    const { history, historyIndex } = this.state.editors;
    
    if (historyIndex < history.length - 1) {
      // TODO: Implement redo by replaying actions
      console.log('Redo not yet implemented');
    }
  }

  /**
   * Persist state to storage
   */
  async persist(): Promise<void> {
    try {
      const serialized = this.serializeState(this.state);
      // TODO: Implement actual persistence (localStorage, file system, etc.)
      console.log('State persisted:', serialized);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Hydrate state from storage
   */
  async hydrate(): Promise<void> {
    try {
      // TODO: Implement actual hydration
      console.log('State hydrated');
    } catch (error) {
      console.error('Failed to hydrate state:', error);
    }
  }

  /**
   * Serialize state for persistence
   */
  private serializeState(state: UnifiedAppState): string {
    // Convert Maps to objects for JSON serialization
    const serializable = {
      ...state,
      scenes: Object.fromEntries(state.scenes),
      entities: Object.fromEntries(state.entities),
      assets: Object.fromEntries(state.assets)
    };
    
    return JSON.stringify(serializable, null, 2);
  }

  /**
   * Get a snapshot of the current state
   */
  getSnapshot(): UnifiedAppState {
    return JSON.parse(JSON.stringify({
      ...this.state,
      scenes: Object.fromEntries(this.state.scenes),
      entities: Object.fromEntries(this.state.entities),
      assets: Object.fromEntries(this.state.assets)
    }));
  }
}