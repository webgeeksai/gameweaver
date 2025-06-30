/**
 * Multi-Scene Management System
 * 
 * Advanced scene management with support for loading multiple scenes simultaneously,
 * scene transitions, and additive scene loading like Unity.
 */

import { EventEmitter } from 'events';
import { Scene, SceneDefinition } from './Scene';
import { SceneManager } from './SceneManager';
import { EntityManager } from '../ecs/EntityManager';
import { ComponentManager } from '../ecs/ComponentManager';
import { UnifiedStateStore } from '../state/UnifiedStateStore';
import { MessageBus, MessageType } from '../messaging/MessageBus';

export enum SceneLoadMode {
  Single = 'single',      // Unload all scenes and load new one
  Additive = 'additive',  // Add to existing scenes
  Replace = 'replace'     // Replace specific scene
}

export interface SceneTransition {
  type: 'fade' | 'slide' | 'zoom' | 'custom';
  duration: number;
  easing: string;
  options?: Record<string, any>;
}

export interface LoadedScene {
  scene: Scene;
  mode: SceneLoadMode;
  isPersistent: boolean;
  isActive: boolean;
  loadTime: number;
}

export interface SceneLoadOptions {
  mode?: SceneLoadMode;
  transition?: SceneTransition;
  persistent?: boolean;
  activate?: boolean;
  targetScene?: string; // For Replace mode
}

export interface MultiSceneEvents {
  'scene:loading': { sceneId: string; progress: number };
  'scene:loaded': { sceneId: string; scene: Scene };
  'scene:unloading': { sceneId: string };
  'scene:unloaded': { sceneId: string };
  'scene:activated': { sceneId: string };
  'scene:deactivated': { sceneId: string };
  'transition:start': { from: string; to: string; transition: SceneTransition };
  'transition:complete': { from: string; to: string };
}

/**
 * Multi-Scene Manager
 */
export class MultiSceneManager extends EventEmitter {
  private baseSceneManager: SceneManager;
  private loadedScenes: Map<string, LoadedScene> = new Map();
  private activeScenes: Set<string> = new Set();
  private persistentScenes: Set<string> = new Set();
  private loadingQueue: Map<string, Promise<Scene>> = new Map();
  private transitionInProgress: boolean = false;
  private stateStore?: UnifiedStateStore;
  private messageBus?: MessageBus;

  constructor(
    entityManager: EntityManager,
    componentManager: ComponentManager,
    stateStore?: UnifiedStateStore,
    messageBus?: MessageBus
  ) {
    super();
    this.baseSceneManager = new SceneManager(entityManager, componentManager);
    this.stateStore = stateStore;
    this.messageBus = messageBus;
    this.setupEventHandlers();
  }

  /**
   * Load a scene
   */
  async loadScene(
    definition: SceneDefinition,
    options: SceneLoadOptions = {}
  ): Promise<Scene> {
    const {
      mode = SceneLoadMode.Single,
      transition,
      persistent = false,
      activate = true,
      targetScene
    } = options;

    console.log(`Loading scene: ${definition.name} (mode: ${mode})`);

    // Handle loading modes
    if (mode === SceneLoadMode.Single) {
      await this.unloadAllNonPersistentScenes(transition);
    } else if (mode === SceneLoadMode.Replace && targetScene) {
      await this.unloadScene(targetScene);
    }

    // Check if already loading
    if (this.loadingQueue.has(definition.name)) {
      return this.loadingQueue.get(definition.name)!;
    }

    // Create loading promise
    const loadPromise = this.doLoadScene(definition, persistent, activate, transition);
    this.loadingQueue.set(definition.name, loadPromise);

    try {
      const scene = await loadPromise;
      return scene;
    } finally {
      this.loadingQueue.delete(definition.name);
    }
  }

  /**
   * Load scene async (non-blocking)
   */
  loadSceneAsync(
    definition: SceneDefinition,
    options: SceneLoadOptions = {},
    onProgress?: (progress: number) => void
  ): void {
    this.loadScene(definition, options)
      .then(scene => {
        console.log(`Scene loaded async: ${scene.name}`);
      })
      .catch(error => {
        console.error(`Failed to load scene: ${definition.name}`, error);
      });

    // Simulate progress updates
    if (onProgress) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.1;
        onProgress(Math.min(progress, 1.0));
        
        if (progress >= 1.0) {
          clearInterval(interval);
        }
      }, 100);
    }
  }

  /**
   * Unload a scene
   */
  async unloadScene(sceneId: string): Promise<void> {
    const loadedScene = this.loadedScenes.get(sceneId);
    if (!loadedScene) return;

    // Check if persistent
    if (loadedScene.isPersistent) {
      console.warn(`Cannot unload persistent scene: ${sceneId}`);
      return;
    }

    console.log(`Unloading scene: ${sceneId}`);
    this.emit('scene:unloading', { sceneId });

    // Deactivate if active
    if (loadedScene.isActive) {
      this.deactivateScene(sceneId);
    }

    // Cleanup scene
    loadedScene.scene.cleanup();

    // Remove from collections
    this.loadedScenes.delete(sceneId);
    this.activeScenes.delete(sceneId);

    // Update state
    this.updateState();

    this.emit('scene:unloaded', { sceneId });

    // Notify via message bus
    this.messageBus?.publish({
      type: MessageType.SCENE_UPDATED,
      source: 'multi-scene-manager',
      payload: { action: 'unloaded', sceneId }
    });
  }

  /**
   * Unload all non-persistent scenes
   */
  async unloadAllNonPersistentScenes(transition?: SceneTransition): Promise<void> {
    const scenesToUnload = Array.from(this.loadedScenes.entries())
      .filter(([_, scene]) => !scene.isPersistent)
      .map(([id, _]) => id);

    if (transition && scenesToUnload.length > 0) {
      await this.performTransition(scenesToUnload[0], '', transition);
    }

    for (const sceneId of scenesToUnload) {
      await this.unloadScene(sceneId);
    }
  }

  /**
   * Activate a scene
   */
  activateScene(sceneId: string): void {
    const loadedScene = this.loadedScenes.get(sceneId);
    if (!loadedScene) {
      console.error(`Scene not loaded: ${sceneId}`);
      return;
    }

    if (loadedScene.isActive) return;

    console.log(`Activating scene: ${sceneId}`);
    
    loadedScene.scene.activate();
    loadedScene.isActive = true;
    this.activeScenes.add(sceneId);

    // Set as active in base manager if it's the only active scene
    if (this.activeScenes.size === 1) {
      this.baseSceneManager.setActiveScene(loadedScene.scene);
    }

    this.emit('scene:activated', { sceneId });
    this.updateState();
  }

  /**
   * Deactivate a scene
   */
  deactivateScene(sceneId: string): void {
    const loadedScene = this.loadedScenes.get(sceneId);
    if (!loadedScene || !loadedScene.isActive) return;

    console.log(`Deactivating scene: ${sceneId}`);
    
    loadedScene.scene.deactivate();
    loadedScene.isActive = false;
    this.activeScenes.delete(sceneId);

    this.emit('scene:deactivated', { sceneId });
    this.updateState();
  }

  /**
   * Set scene as persistent
   */
  setScenePersistent(sceneId: string, persistent: boolean): void {
    const loadedScene = this.loadedScenes.get(sceneId);
    if (!loadedScene) return;

    loadedScene.isPersistent = persistent;
    
    if (persistent) {
      this.persistentScenes.add(sceneId);
    } else {
      this.persistentScenes.delete(sceneId);
    }

    console.log(`Scene ${sceneId} persistence set to: ${persistent}`);
  }

  /**
   * Get all loaded scenes
   */
  getLoadedScenes(): Scene[] {
    return Array.from(this.loadedScenes.values()).map(ls => ls.scene);
  }

  /**
   * Get active scenes
   */
  getActiveScenes(): Scene[] {
    return Array.from(this.activeScenes)
      .map(id => this.loadedScenes.get(id)?.scene)
      .filter(Boolean) as Scene[];
  }

  /**
   * Get scene by name
   */
  getSceneByName(name: string): Scene | undefined {
    for (const [_, loadedScene] of this.loadedScenes) {
      if (loadedScene.scene.name === name) {
        return loadedScene.scene;
      }
    }
    return undefined;
  }

  /**
   * Merge scenes
   */
  async mergeScenes(sourceId: string, targetId: string): Promise<void> {
    const source = this.loadedScenes.get(sourceId);
    const target = this.loadedScenes.get(targetId);

    if (!source || !target) {
      throw new Error('Source or target scene not found');
    }

    console.log(`Merging scene ${sourceId} into ${targetId}`);

    // Move all entities from source to target
    const entities = source.scene.getAllEntities();
    for (const entity of entities) {
      // Transfer entity to target scene
      target.scene.addExistingEntity(entity);
    }

    // Unload source scene
    await this.unloadScene(sourceId);

    console.log(`Scene merge complete`);
  }

  /**
   * Perform scene transition
   */
  private async performTransition(
    fromSceneId: string,
    toSceneId: string,
    transition: SceneTransition
  ): Promise<void> {
    if (this.transitionInProgress) {
      console.warn('Transition already in progress');
      return;
    }

    this.transitionInProgress = true;
    
    this.emit('transition:start', {
      from: fromSceneId,
      to: toSceneId,
      transition
    });

    // Simulate transition (in real implementation would animate)
    await new Promise(resolve => setTimeout(resolve, transition.duration));

    this.emit('transition:complete', {
      from: fromSceneId,
      to: toSceneId
    });

    this.transitionInProgress = false;
  }

  /**
   * Do actual scene loading
   */
  private async doLoadScene(
    definition: SceneDefinition,
    persistent: boolean,
    activate: boolean,
    transition?: SceneTransition
  ): Promise<Scene> {
    // Emit loading event
    this.emit('scene:loading', { sceneId: definition.name, progress: 0 });

    // Create scene through base manager
    const scene = this.baseSceneManager.createScene(definition);
    
    // Initialize scene
    scene.initialize();

    // Create loaded scene entry
    const loadedScene: LoadedScene = {
      scene,
      mode: SceneLoadMode.Single,
      isPersistent: persistent,
      isActive: false,
      loadTime: Date.now()
    };

    // Store scene
    this.loadedScenes.set(scene.id, loadedScene);
    
    if (persistent) {
      this.persistentScenes.add(scene.id);
    }

    // Emit loaded event
    this.emit('scene:loaded', { sceneId: scene.id, scene });

    // Notify via message bus
    this.messageBus?.publish({
      type: MessageType.SCENE_LOADED,
      source: 'multi-scene-manager',
      payload: {
        sceneId: scene.id,
        sceneName: scene.name,
        persistent,
        entities: scene.getEntityCount()
      }
    });

    // Activate if requested
    if (activate) {
      this.activateScene(scene.id);
    }

    // Update state
    this.updateState();

    return scene;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.messageBus) return;

    // Listen for scene management commands
    this.messageBus.subscribe(MessageType.SYSTEM_REQUEST, async (message) => {
      const { action, payload } = message.payload;

      switch (action) {
        case 'loadScene':
          await this.loadScene(payload.definition, payload.options);
          break;
          
        case 'unloadScene':
          await this.unloadScene(payload.sceneId);
          break;
          
        case 'activateScene':
          this.activateScene(payload.sceneId);
          break;
          
        case 'deactivateScene':
          this.deactivateScene(payload.sceneId);
          break;
      }
    });
  }

  /**
   * Update state store
   */
  private updateState(): void {
    if (!this.stateStore) return;

    const sceneStates = new Map();
    
    for (const [id, loadedScene] of this.loadedScenes) {
      sceneStates.set(id, {
        id: loadedScene.scene.id,
        name: loadedScene.scene.name,
        active: loadedScene.isActive,
        persistent: loadedScene.isPersistent,
        entityCount: loadedScene.scene.getEntityCount(),
        loadTime: loadedScene.loadTime
      });
    }

    this.stateStore.dispatch({
      type: 'SCENES_UPDATED',
      payload: { scenes: sceneStates },
      source: 'engine',
      timestamp: Date.now()
    });
  }

  /**
   * Get statistics
   */
  getStats(): {
    loadedScenes: number;
    activeScenes: number;
    persistentScenes: number;
    totalEntities: number;
    memoryUsage: number;
  } {
    let totalEntities = 0;
    
    for (const loadedScene of this.loadedScenes.values()) {
      totalEntities += loadedScene.scene.getEntityCount();
    }

    return {
      loadedScenes: this.loadedScenes.size,
      activeScenes: this.activeScenes.size,
      persistentScenes: this.persistentScenes.size,
      totalEntities,
      memoryUsage: 0 // Would calculate actual memory usage
    };
  }

  /**
   * Export scene configuration
   */
  exportSceneConfiguration(): string {
    const config = {
      scenes: Array.from(this.loadedScenes.entries()).map(([id, ls]) => ({
        id,
        name: ls.scene.name,
        persistent: ls.isPersistent,
        active: ls.isActive,
        config: ls.scene.getConfig()
      })),
      activeScenes: Array.from(this.activeScenes),
      persistentScenes: Array.from(this.persistentScenes)
    };

    return JSON.stringify(config, null, 2);
  }
}