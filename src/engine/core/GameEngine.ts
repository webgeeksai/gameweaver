import { EntityManager } from './ecs/EntityManager';
import { ComponentManager } from './ecs/ComponentManager';
import { SystemManager } from './ecs/SystemManager';
import { globalEventBus } from './events/EventBus';
import { EventPriority, EventSource, EngineConfig } from './types';
import { EventEmitter } from 'events';
import { TransformSystem } from '../systems/TransformSystem';
import { RenderingSystem, CanvasRenderer, Camera } from '../systems/RenderingSystem';
import { InputSystem } from '../systems/InputSystem';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { BehaviorManager } from './behavior/BehaviorManager';
import { SceneManager } from './scene/SceneManager';
import { SceneSystem } from './scene/SceneSystem';
import { Scene, SceneDefinition } from './scene/Scene';
import { Vector2 } from './math/Vector2';
import { ParticleSystem } from './particles/ParticleSystem';
import { UnifiedStateStore, EngineStateBridge } from './state';

// Canvas-like interface for different environments
export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: '2d'): CanvasRenderingContext2D | null;
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
}

export interface GameEngineOptions {
  canvas?: CanvasLike | HTMLCanvasElement;
  config?: Partial<EngineConfig>;
}

export class GameEngine extends EventEmitter {
  // Core managers
  private entityManager: EntityManager;
  private componentManager: ComponentManager;
  private systemManager: SystemManager;
  private behaviorManager: BehaviorManager;
  private sceneManager: SceneManager;
  
  // State management
  private stateStore?: UnifiedStateStore;
  private stateBridge?: EngineStateBridge;
  
  // Systems
  private transformSystem: TransformSystem;
  private renderingSystem: RenderingSystem;
  private inputSystem: InputSystem;
  private physicsSystem: PhysicsSystem;
  private sceneSystem: SceneSystem;
  private particleSystem: ParticleSystem;
  
  // Effects (removed ParticleEffects - to be re-added as needed)
  
  // Rendering
  private renderer: CanvasRenderer;
  private canvas: CanvasLike;
  
  // Game loop
  private running: boolean = false;
  private paused: boolean = false;
  private lastTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private fpsUpdateTime: number = 0;
  private animationFrameId: number = 0;
  
  // Configuration
  private config: EngineConfig;
  
  constructor(options: GameEngineOptions = {}) {
    super();
    console.log("GameEngine: Constructor called", options);
    
    // Initialize core managers
    this.entityManager = new EntityManager();
    this.componentManager = new ComponentManager();
    this.behaviorManager = new BehaviorManager();
    
    // Setup canvas
    this.canvas = options.canvas || this.createCanvas();
    console.log("GameEngine: Canvas initialized", this.canvas);
    this.renderer = new CanvasRenderer(this.canvas);
    
    // Initialize systems
    this.transformSystem = new TransformSystem(this.componentManager);
    this.renderingSystem = new RenderingSystem(this.componentManager, this.renderer);
    this.inputSystem = new InputSystem();
    this.physicsSystem = new PhysicsSystem(this.componentManager);
    this.particleSystem = new ParticleSystem(this.componentManager);
    
    // Initialize scene manager
    this.sceneManager = new SceneManager(this.entityManager, this.componentManager);
    this.sceneSystem = new SceneSystem(this.sceneManager, this.renderingSystem);
    
    // Initialize system manager
    this.systemManager = new SystemManager(this.entityManager, this.componentManager);
    
    // Effects system can be extended as needed
    
    // Register systems
    this.systemManager.register(this.sceneSystem);
    this.systemManager.register(this.transformSystem);
    this.systemManager.register(this.physicsSystem);
    this.systemManager.register(this.particleSystem);
    this.systemManager.register(this.renderingSystem);
    this.systemManager.register(this.inputSystem);
    
    // Connect systems
    this.renderingSystem.setPhysicsSystem(this.physicsSystem);
    
    // Setup input system
    this.inputSystem.setCanvas(this.canvas);
    
    // Default configuration
    this.config = this.createDefaultConfig(options.config);
    
    // Setup event listeners
    this.setupEventListeners();
    
    console.log('Game Engine initialized');
  }
  
  private createCanvas(): CanvasLike {
    console.log("GameEngine: Creating default canvas");
    
    // Check if we're in a browser environment
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      canvas.style.border = '1px solid #ccc';
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto';
      canvas.tabIndex = 0; // Make canvas focusable
      return canvas;
    } else {
      // Return a minimal canvas interface for non-browser environments
      return {
        width: 800,
        height: 600,
        getContext: () => null
      };
    }
  }
  
  private createDefaultConfig(userConfig?: Partial<EngineConfig>): EngineConfig {
    return {
      rendering: {
        width: 800,
        height: 600,
        pixelArt: false,
        backgroundColor: '#2c3e50',
        antialias: true,
        powerPreference: 'default'
      },
      physics: {
        gravity: [0, 800],
        worldBounds: true,
        bounceWorldBounds: false,
        debug: true
      },
      audio: {
        masterVolume: 1.0,
        musicVolume: 0.8,
        sfxVolume: 1.0,
        spatialAudio: false
      },
      input: {
        keyboard: true,
        mouse: true,
        touch: true,
        gamepad: false
      },
      assets: {
        baseUrl: '/assets/',
        maxCacheSize: 100 * 1024 * 1024, // 100MB
        preloadCritical: true,
        compressionEnabled: true
      },
      performance: {
        targetFPS: 60,
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        enableProfiling: true,
        objectPooling: true
      },
      debug: {
        enabled: true,
        showFPS: true,
        showMemory: true,
        showColliders: true,
        showBounds: true,
        logLevel: 'debug'
      },
      ...userConfig
    };
  }
  
  private setupEventListeners(): void {
    // Listen for engine events
    globalEventBus.on('engine.start', () => {
      console.log('Engine started');
    });
    
    // Only add resize listener in browser environment
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize.bind(this));
    }
    
    // Debug event logging
    if (this.config.debug.enabled) {
      globalEventBus.on('input.key.pressed', (event) => {
        console.log('Key pressed:', event.data?.key);
      });
      
      globalEventBus.on('collision', (event) => {
        console.log('Collision detected:', event.data);
      });
    }
  }
  
  private onResize(): void {
    // Update canvas size if needed (only for browser canvas elements)
    if ('parentElement' in this.canvas && this.canvas.parentElement && 
        typeof this.canvas.parentElement === 'object' && this.canvas.parentElement !== null &&
        'clientWidth' in this.canvas.parentElement && 'clientHeight' in this.canvas.parentElement) {
      const parent = this.canvas.parentElement as any;
      const parentWidth = parent.clientWidth;
      const parentHeight = parent.clientHeight;
      
      // Maintain aspect ratio
      const aspectRatio = this.config.rendering.width / this.config.rendering.height;
      
      let width = parentWidth;
      let height = width / aspectRatio;
      
      if (height > parentHeight) {
        height = parentHeight;
        width = height * aspectRatio;
      }
      
      if ('style' in this.canvas) {
        const styledCanvas = this.canvas as any;
        styledCanvas.style.width = `${width}px`;
        styledCanvas.style.height = `${height}px`;
      }
    }
  }
  
  // Game loop
  start(): void {
    if (this.running) return;
    
    console.log("GameEngine: Starting game loop");
    this.running = true;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    // Emit engine start event
    globalEventBus.emit({
      type: 'engine.start',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High
    });
    
    // Start game loop
    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    } else {
      // Fallback for non-browser environments
      this.animationFrameId = setTimeout(() => this.gameLoop(typeof performance !== 'undefined' ? performance.now() : Date.now()), 16) as any;
    }
  }
  
  stop(): void {
    console.log("GameEngine: Stopping game loop");
    this.running = false;
    
    // Cancel animation frame
    if (this.animationFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.animationFrameId);
      } else {
        clearTimeout(this.animationFrameId);
      }
      this.animationFrameId = 0;
    }
    
    // Emit engine stop event
    globalEventBus.emit({
      type: 'engine.stop',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High
    });
  }
  
  private gameLoop(timestamp: number): void {
    if (!this.running) return;

    // Skip processing if paused
    if (this.paused) {
      // Continue animation frame but don't update
      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
      } else {
        this.animationFrameId = setTimeout(() => this.gameLoop(typeof performance !== 'undefined' ? performance.now() : Date.now()), 16) as any;
      }
      return;
    }
    
    try {
      // Calculate delta time
      const deltaTime = Math.min((timestamp - this.lastTime) / 1000, 0.1); // Cap at 100ms
      this.lastTime = timestamp;
      
      // Update FPS counter
      this.frameCount++;
      if (timestamp - this.fpsUpdateTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.fpsUpdateTime = timestamp;
        
        // Emit FPS update event
        globalEventBus.emit({
          type: 'engine.fps',
          source: EventSource.System,
          timestamp: Date.now(),
          priority: EventPriority.Low,
          data: { fps: this.fps }
        });
        
        // Log performance stats
        if (this.config.debug.enabled) {
          console.log(`FPS: ${this.fps}, Entities: ${this.entityManager.getEntityCount()}`);
        }
      }
      
      // Process events
      globalEventBus.processEvents();
      
      // Update systems
      this.systemManager.update(deltaTime);
      
      // Render
      console.log('GameEngine: About to call systemManager.render()');
      this.systemManager.render(this.renderer);
      
      // Draw debug info if enabled
      if (this.config.debug.enabled && this.config.debug.showFPS) {
        this.drawDebugInfo();
      }
      
      // Continue game loop
      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
      } else {
        // Fallback for non-browser environments
        this.animationFrameId = setTimeout(() => this.gameLoop(typeof performance !== 'undefined' ? performance.now() : Date.now()), 16) as any;
      }
    } catch (error) {
      console.error("GameEngine: Error in game loop", error);
      this.stop();
      
      // Try to restart the game loop after a short delay
      setTimeout(() => {
        if (!this.running) {
          this.start();
        }
      }, 1000);
    }
  }
  
  private drawDebugInfo(): void {
    const ctx = this.renderer.getContext();
    
    ctx.save();
    ctx.resetTransform();
    
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    ctx.fillText(`FPS: ${this.fps}`, 10, 10);
    ctx.fillText(`Entities: ${this.entityManager.getEntityCount()}`, 10, 30);
    
    // Add scene info
    const activeScene = this.sceneManager.getActiveScene();
    if (activeScene) {
      ctx.fillText(`Scene: ${activeScene.name}`, 10, 50);
      ctx.fillText(`Scene Entities: ${activeScene.getEntityCount()}`, 10, 70);
    }
    
    // Add particle info
    ctx.fillText(`Particles: ${this.particleSystem.getTotalParticleCount()}`, 10, 90);
    ctx.fillText(`Emitters: ${this.particleSystem.getEmitterCount()}`, 10, 110);
    
    // Add input debug info
    const inputSystem = this.getInputSystem();
    ctx.fillText(`Input: Use A/D or arrows to move, Space to jump`, 10, 130);
    ctx.fillText(`Press 1, 2, or 3 to switch scenes`, 10, 150);
    
    // Add active keys
    const activeKeys = inputSystem.getActiveKeys();
    if (activeKeys.length > 0) {
      ctx.fillText(`Active Keys: ${activeKeys.join(', ')}`, 10, 170);
    }
    
    // Add mouse position
    const mousePos = inputSystem.getMousePosition();
    ctx.fillText(`Mouse: ${mousePos.x.toFixed(0)}, ${mousePos.y.toFixed(0)}`, 10, 190);
    
    // Add touch info
    const touches = inputSystem.getActiveTouches();
    if (touches.length > 0) {
      ctx.fillText(`Touches: ${touches.length}`, 10, 210);
    }
    
    ctx.restore();
  }
  
  // Public API
  getCanvas(): CanvasLike {
    return this.canvas;
  }
  
  getEntityManager(): EntityManager {
    return this.entityManager;
  }
  
  getComponentManager(): ComponentManager {
    return this.componentManager;
  }
  
  getSystemManager(): SystemManager {
    return this.systemManager;
  }
  
  getBehaviorManager(): BehaviorManager {
    return this.behaviorManager;
  }
  
  getSceneManager(): SceneManager {
    return this.sceneManager;
  }
  
  getTransformSystem(): TransformSystem {
    return this.transformSystem;
  }
  
  getRenderingSystem(): RenderingSystem {
    return this.renderingSystem;
  }
  
  getInputSystem(): InputSystem {
    return this.inputSystem;
  }
  
  getPhysicsSystem(): PhysicsSystem {
    return this.physicsSystem;
  }
  
  getSceneSystem(): SceneSystem {
    return this.sceneSystem;
  }
  
  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }
  
  
  // Scene management
  createScene(definition: SceneDefinition): Scene {
    return this.sceneManager.createScene(definition);
  }
  
  loadScene(sceneId: string): void {
    this.sceneManager.loadScene(sceneId);
  }
  
  getActiveScene(): Scene | null {
    return this.sceneManager.getActiveScene();
  }
  
  
  setCameraZoom(zoom: number): void {
    const activeScene = this.sceneManager.getActiveScene();
    if (activeScene) {
      activeScene.setCameraZoom(zoom);
    } else {
      this.renderingSystem.setCameraZoom(zoom);
    }
  }
  
  // Configuration
  getConfig(): EngineConfig {
    return this.config;
  }
  
  updateConfig(config: Partial<EngineConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      rendering: {
        ...this.config.rendering,
        ...config.rendering
      },
      physics: {
        ...this.config.physics,
        ...config.physics
      },
      audio: {
        ...this.config.audio,
        ...config.audio
      },
      input: {
        ...this.config.input,
        ...config.input
      },
      assets: {
        ...this.config.assets,
        ...config.assets
      },
      performance: {
        ...this.config.performance,
        ...config.performance
      },
      debug: {
        ...this.config.debug,
        ...config.debug
      }
    };
    
    // Apply configuration changes
    this.applyConfig();
  }
  
  private applyConfig(): void {
    // Apply rendering configuration
    if (this.canvas) {
      this.canvas.width = this.config.rendering.width;
      this.canvas.height = this.config.rendering.height;
    }
    
    // Apply physics configuration
    if (this.config.physics.gravity) {
      this.physicsSystem.setGravity(
        this.config.physics.gravity[0],
        this.config.physics.gravity[1]
      );
    }
    
    // Apply debug configuration
    this.physicsSystem.setDebugDraw(this.config.debug.showColliders);
    
    // Apply other configurations as needed
  }
  
  // Particle effects methods removed - can be re-added as extensions
  
  // Extension-specific methods
  async loadCompiledCode(compiledCode: any): Promise<void> {
    try {
      // Execute the compiled GDL code
      console.log('Loading compiled code:', compiledCode);
      this.emit('codeLoaded', compiledCode);
    } catch (error) {
      console.error('Error loading compiled code:', error);
      throw error;
    }
  }

  getScenes(): any[] {
    return this.sceneManager.getAllScenes();
  }

  getEntitiesInScene(sceneName: string): any[] {
    const scene = this.sceneManager.getSceneByName(sceneName);
    return scene ? scene.getAllEntities() : [];
  }

  getEntity(entityId: string): any {
    return this.entityManager.getAll().find((e: any) => e.id === entityId);
  }

  // Get current game state
  getState(): any {
    return {
      global: {
        gameTitle: this.config.rendering?.title || 'Game Vibe Engine Game',
        gameSize: { 
          x: this.config.rendering?.width || 800, 
          y: this.config.rendering?.height || 600 
        },
        backgroundColor: this.config.rendering?.backgroundColor || '#2c3e50',
        pixelArt: this.config.rendering?.pixelArt || false
      },
      entities: this.entityManager.getAll(),
      components: this.componentManager.getAll(),
      scenes: this.sceneManager.getAllScenes(),
      assets: [] // In a real implementation, this would be populated
    };
  }

  // State Management Integration
  
  /**
   * Connect to unified state store
   */
  connectStateStore(store: UnifiedStateStore): void {
    if (this.stateBridge) {
      this.stateBridge.disconnect();
    }

    this.stateStore = store;
    this.stateBridge = new EngineStateBridge(store, this);
    this.stateBridge.connect();

    console.log('GameEngine connected to state store');
  }

  /**
   * Disconnect from state store
   */
  disconnectStateStore(): void {
    if (this.stateBridge) {
      this.stateBridge.disconnect();
      this.stateBridge = undefined;
    }
    this.stateStore = undefined;

    console.log('GameEngine disconnected from state store');
  }

  /**
   * Get the state store
   */
  getStateStore(): UnifiedStateStore | undefined {
    return this.stateStore;
  }

  /**
   * Get FPS
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * Get delta time
   */
  getDeltaTime(): number {
    return this.running ? performance.now() - this.lastTime : 0;
  }

  /**
   * Get total engine time
   */
  getTime(): number {
    return this.lastTime;
  }

  /**
   * Check if engine is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if engine is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Set pause state
   */
  setPaused(paused: boolean): void {
    if (paused) {
      this.pause();
    } else {
      this.resume();
    }
  }

  /**
   * Pause the engine
   */
  pause(): void {
    if (this.running && !this.paused) {
      this.paused = true;
      globalEventBus.emit({
        type: 'engine.pause',
        source: EventSource.System,
        timestamp: Date.now(),
        priority: EventPriority.High
      });
      console.log('Game Engine paused');
    }
  }

  /**
   * Resume the engine
   */
  resume(): void {
    if (this.running && this.paused) {
      this.paused = false;
      this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      globalEventBus.emit({
        type: 'engine.resume',
        source: EventSource.System,
        timestamp: Date.now(),
        priority: EventPriority.High
      });
      console.log('Game Engine resumed');
    }
  }

  /**
   * Get event bus
   */
  getEventBus(): any {
    return globalEventBus;
  }

  /**
   * Set camera position
   */
  setCameraPosition(x: number, y: number): void {
    const camera = this.renderingSystem.getCamera();
    if (camera) {
      camera.position.x = x;
      camera.position.y = y;
    }
  }
}