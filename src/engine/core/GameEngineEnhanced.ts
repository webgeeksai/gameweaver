/**
 * Enhanced Game Engine with All Advanced Features
 * 
 * Integrates all the new systems for a Unity-like experience
 */

import { GameEngine, GameEngineOptions } from './GameEngine';
import { Vector2 } from './math/Vector2';
import { ProjectManager } from '../project/ProjectManager';
import { PrefabSystem } from './prefab/PrefabSystem';
import { UndoRedoSystem } from './history/UndoRedoSystem';
import { PerformanceProfiler, getGlobalProfiler } from './profiler/PerformanceProfiler';
import { AssetPipeline } from '../assets/AssetPipeline';
import { UnifiedStateStore } from './state/UnifiedStateStore';
import { MessageBus, getGlobalMessageBus } from './messaging/MessageBus';
import { ComponentIntegration, getGlobalIntegration } from '../integration/ComponentIntegration';

export interface EnhancedEngineOptions extends GameEngineOptions {
  enableProfiler?: boolean;
  enableUndoRedo?: boolean;
  enablePrefabs?: boolean;
  enableAssetPipeline?: boolean;
  projectPath?: string;
}

/**
 * Enhanced Game Engine
 */
export class GameEngineEnhanced extends GameEngine {
  // Additional systems
  private projectManager: ProjectManager;
  private prefabSystem: PrefabSystem;
  private undoRedoSystem: UndoRedoSystem;
  private performanceProfiler: PerformanceProfiler;
  private assetPipeline: AssetPipeline;
  private integration: ComponentIntegration;

  constructor(options: EnhancedEngineOptions = {}) {
    super(options);

    // Get global instances
    const stateStore = this.getStateStore() || new UnifiedStateStore();
    const messageBus = getGlobalMessageBus();

    // Initialize project manager
    this.projectManager = new ProjectManager(stateStore, messageBus);

    // Initialize prefab system
    this.prefabSystem = new PrefabSystem(
      this.getEntityManager(),
      this.getComponentManager()
    );

    // Initialize undo/redo system
    this.undoRedoSystem = new UndoRedoSystem({
      maxStackSize: 100,
      enableMerging: true,
      enableSnapshots: true
    }, stateStore);

    // Initialize performance profiler
    this.performanceProfiler = getGlobalProfiler({
      enabled: options.enableProfiler ?? true,
      autoStart: true
    });

    // Initialize asset pipeline
    this.assetPipeline = new AssetPipeline({
      autoOptimize: true,
      generateVariants: true
    });

    // Initialize component integration
    this.integration = getGlobalIntegration({
      enableHotReload: true,
      enableAutoSync: true
    });

    // Connect engine to integration
    this.integration.connectGameEngine(this);

    // Setup enhanced features
    this.setupEnhancedFeatures(options);
  }

  /**
   * Setup enhanced features
   */
  private setupEnhancedFeatures(options: EnhancedEngineOptions): void {
    // Connect state store if not already connected
    if (!this.getStateStore()) {
      this.connectStateStore(this.integration['stateStore']);
    }

    // Load project if path provided
    if (options.projectPath) {
      this.projectManager.loadProject(options.projectPath).catch(console.error);
    }

    // Setup undo/redo integration
    if (options.enableUndoRedo !== false) {
      this.setupUndoRedoIntegration();
    }

    // Setup profiler integration
    if (options.enableProfiler !== false) {
      this.setupProfilerIntegration();
    }

    // Setup prefab integration
    if (options.enablePrefabs !== false) {
      this.setupPrefabIntegration();
    }

    // Setup asset pipeline integration
    if (options.enableAssetPipeline !== false) {
      this.setupAssetPipelineIntegration();
    }
  }

  /**
   * Setup undo/redo integration
   */
  private setupUndoRedoIntegration(): void {
    // Listen to state changes and create undo commands
    const stateStore = this.getStateStore();
    if (!stateStore) return;

    stateStore.subscribe((state, action) => {
      // Skip undo/redo actions
      if (action.source === 'undo-redo') return;

      // Create command for the action
      const command = this.undoRedoSystem.createStateCommand(
        action.type,
        action
      );

      // Execute and add to history
      this.undoRedoSystem.execute(command).catch(console.error);
    });
  }

  /**
   * Setup profiler integration
   */
  private setupProfilerIntegration(): void {
    // Override update method to include profiling
    const originalUpdate = this.update;
    this.update = (deltaTime: number) => {
      this.performanceProfiler.beginFrame();

      // Profile update phase
      const updateStart = performance.now();
      originalUpdate.call(this, deltaTime);
      this.performanceProfiler.profileUpdate(performance.now() - updateStart);

      // Set counts
      this.performanceProfiler.setEntityCount(this.getEntityManager().getEntityCount());
      this.performanceProfiler.setComponentCount(this.getComponentManager().getAll().length);

      this.performanceProfiler.endFrame();
    };
  }

  /**
   * Setup prefab integration
   */
  private setupPrefabIntegration(): void {
    // Add prefab commands to command palette
    const messageBus = getGlobalMessageBus();
    
    messageBus.subscribe('editor:command', (message) => {
      switch (message.payload.command) {
        case 'createPrefab':
          this.createPrefabFromEntity(message.payload.entityId);
          break;
        case 'instantiatePrefab':
          const pos = message.payload.position;
          this.instantiatePrefab(message.payload.prefabId, pos ? new Vector2(pos.x, pos.y) : undefined);
          break;
      }
    });
  }

  /**
   * Setup asset pipeline integration
   */
  private setupAssetPipelineIntegration(): void {
    // Connect asset pipeline to asset manager
    const assetManager = this.integration['assetManager'];
    if (!assetManager) return;

    // Process assets before loading
    const originalLoad = assetManager.load;
    assetManager.load = async (id: string, metadata: any) => {
      // Process through pipeline if applicable
      if (metadata.needsProcessing) {
        const processed = await this.assetPipeline.processAsset(
          metadata.path,
          metadata.data,
          metadata.type,
          metadata
        );
        metadata.data = processed.data;
        metadata.optimizationReport = processed.optimizationReport;
      }

      return originalLoad.call(assetManager, id, metadata);
    };
  }

  /**
   * Create prefab from entity
   */
  createPrefabFromEntity(entityId: string): void {
    const entity = this.getEntityManager().get(entityId as any);
    if (!entity) {
      console.error('Entity not found:', entityId);
      return;
    }

    const prefab = this.prefabSystem.createPrefab(entity, {
      name: `${entity.name}_Prefab`,
      description: 'Created from entity',
      tags: ['user-created'],
      category: 'Custom',
      author: 'User',
      version: '1.0.0'
    });

    console.log('Prefab created:', prefab.metadata.id);
  }

  /**
   * Instantiate prefab
   */
  instantiatePrefab(prefabId: string, position?: Vector2): void {
    const entity = this.prefabSystem.instantiate(
      prefabId,
      position
    );

    console.log('Prefab instantiated:', entity.id);
  }

  /**
   * Get project manager
   */
  getProjectManager(): ProjectManager {
    return this.projectManager;
  }

  /**
   * Get prefab system
   */
  getPrefabSystem(): PrefabSystem {
    return this.prefabSystem;
  }

  /**
   * Get undo/redo system
   */
  getUndoRedoSystem(): UndoRedoSystem {
    return this.undoRedoSystem;
  }

  /**
   * Get performance profiler
   */
  getPerformanceProfiler(): PerformanceProfiler {
    return this.performanceProfiler;
  }

  /**
   * Get asset pipeline
   */
  getAssetPipeline(): AssetPipeline {
    return this.assetPipeline;
  }

  /**
   * Get integration manager
   */
  getIntegration(): ComponentIntegration {
    return this.integration;
  }

  /**
   * Enhanced start method
   */
  start(): void {
    console.log('Starting enhanced game engine...');
    
    // Start profiler
    if (this.performanceProfiler.isEnabled()) {
      this.performanceProfiler.start();
    }

    // Initialize integration
    this.integration.initialize().then(() => {
      // Start base engine
      super.start();
    });
  }

  /**
   * Enhanced stop method
   */
  stop(): void {
    console.log('Stopping enhanced game engine...');
    
    // Stop profiler
    this.performanceProfiler.stop();

    // Save project if dirty
    if (this.projectManager.isProjectDirty()) {
      this.projectManager.saveProject().catch(console.error);
    }

    // Stop base engine
    super.stop();
  }

  /**
   * Save current state
   */
  async saveState(): Promise<void> {
    // Save project
    await this.projectManager.saveProject();

    // Create undo snapshot
    this.undoRedoSystem['createSnapshot']();

    console.log('State saved');
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    return this.performanceProfiler.generateReport();
  }

  /**
   * Get engine statistics
   */
  getEngineStats(): any {
    return {
      engine: {
        fps: this.getFPS(),
        entities: this.getEntityManager().getEntityCount(),
        components: this.getComponentManager().getAll().length,
        scenes: this.getSceneManager().getAllScenes().length
      },
      profiler: this.performanceProfiler.getSummary(),
      prefabs: this.prefabSystem.getStats(),
      undoRedo: this.undoRedoSystem.getStats(),
      assetPipeline: this.assetPipeline.getStats(),
      project: this.projectManager.getProjectStats()
    };
  }

  /**
   * Override update to include profiling
   */
  private update(deltaTime: number): void {
    // Implemented in setupProfilerIntegration
  }
}