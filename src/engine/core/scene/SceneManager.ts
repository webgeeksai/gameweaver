/**
 * Scene Manager for the Game Vibe Engine
 * Manages scene creation, loading, and transitions
 */

import { v4 as uuidv4 } from 'uuid';
import { SceneId } from '../types';
import { Scene, SceneConfig, SceneDefinition } from './Scene';
import { EntityManager } from '../ecs/EntityManager';
import { ComponentManager } from '../ecs/ComponentManager';
import { globalEventBus } from '../events/EventBus';
import { EventPriority, EventSource } from '../types';
import { Vector2 } from '../math/Vector2';
import { Rectangle } from '../math/Rectangle';
import { Camera } from '../../systems/RenderingSystem';

export interface Transition {
  type: 'fade' | 'slide' | 'zoom' | 'none';
  duration: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export class SceneManager {
  private scenes: Map<SceneId, Scene> = new Map();
  private activeScene: SceneId | null = null;
  private sceneStack: SceneId[] = [];
  private defaultConfig: SceneConfig;
  
  // Entity management
  private entityManager: EntityManager;
  private componentManager: ComponentManager;
  
  // Transition state
  private transitioning: boolean = false;
  private transitionProgress: number = 0;
  private transitionFrom: SceneId | null = null;
  private transitionTo: SceneId | null = null;
  private currentTransition: Transition | null = null;
  
  constructor(entityManager: EntityManager, componentManager: ComponentManager) {
    this.entityManager = entityManager;
    this.componentManager = componentManager;
    
    // Default scene configuration
    this.defaultConfig = {
      gravity: [0, 800],
      bounds: [0, 0, 800, 600],
      backgroundColor: '#000000',
      pixelArt: false
    };
  }
  
  // Scene creation
  createScene(definition: SceneDefinition): Scene {
    const id = uuidv4();
    
    // Create scene
    const scene = new Scene(
      id,
      definition.name,
      this.entityManager,
      this.componentManager,
      definition.config || this.defaultConfig
    );
    
    // Add to scenes map
    this.scenes.set(id, scene);
    
    // Emit scene created event
    globalEventBus.emit({
      type: 'scene.created',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: id,
        name: definition.name
      }
    });
    
    return scene;
  }
  
  // Scene loading
  async loadScene(sceneId: SceneId, transition: Transition = { type: 'none', duration: 0 }): Promise<void> {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      console.error(`Scene ${sceneId} not found`);
      return;
    }
    
    // Check if already active
    if (this.activeScene === sceneId) {
      return;
    }
    
    // Check if already transitioning
    if (this.transitioning) {
      console.warn('Scene transition already in progress');
      return;
    }
    
    // Initialize scene if needed
    if (!scene.isInitialized()) {
      scene.initialize();
    }
    
    // Start transition
    if (transition.type !== 'none' && this.activeScene) {
      this.startTransition(this.activeScene, sceneId, transition);
    } else {
      // No transition, switch immediately
      this.switchScene(sceneId);
    }
  }
  
  // Scene unloading
  unloadScene(sceneId: SceneId): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      console.error(`Scene ${sceneId} not found`);
      return;
    }
    
    // Check if active
    if (this.activeScene === sceneId) {
      console.error('Cannot unload active scene');
      return;
    }
    
    // Destroy scene
    scene.destroy();
    
    // Remove from scenes map
    this.scenes.delete(sceneId);
    
    // Remove from scene stack
    const stackIndex = this.sceneStack.indexOf(sceneId);
    if (stackIndex !== -1) {
      this.sceneStack.splice(stackIndex, 1);
    }
    
    // Emit scene unloaded event
    globalEventBus.emit({
      type: 'scene.unloaded',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: sceneId,
        name: scene.name
      }
    });
  }
  
  // Scene transitions
  private startTransition(fromSceneId: SceneId, toSceneId: SceneId, transition: Transition): void {
    this.transitioning = true;
    this.transitionProgress = 0;
    this.transitionFrom = fromSceneId;
    this.transitionTo = toSceneId;
    this.currentTransition = transition;
    
    // Emit transition started event
    globalEventBus.emit({
      type: 'scene.transition.started',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        from: fromSceneId,
        to: toSceneId,
        transition
      }
    });
  }
  
  updateTransition(deltaTime: number): void {
    if (!this.transitioning || !this.currentTransition) return;
    
    // Update progress
    this.transitionProgress += deltaTime / (this.currentTransition.duration / 1000);
    
    // Check if transition complete
    if (this.transitionProgress >= 1) {
      this.completeTransition();
    }
  }
  
  private completeTransition(): void {
    if (!this.transitioning || !this.transitionTo) return;
    
    // Switch to target scene
    this.switchScene(this.transitionTo);
    
    // Reset transition state
    this.transitioning = false;
    this.transitionProgress = 0;
    this.transitionFrom = null;
    this.transitionTo = null;
    this.currentTransition = null;
    
    // Emit transition completed event
    globalEventBus.emit({
      type: 'scene.transition.completed',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: this.activeScene
      }
    });
  }
  
  private switchScene(sceneId: SceneId): void {
    // Deactivate current scene
    if (this.activeScene) {
      const currentScene = this.scenes.get(this.activeScene);
      if (currentScene) {
        currentScene.deactivate();
      }
    }
    
    // Activate new scene
    const newScene = this.scenes.get(sceneId);
    if (newScene) {
      newScene.activate();
      this.activeScene = sceneId;
      
      // Update scene stack
      const stackIndex = this.sceneStack.indexOf(sceneId);
      if (stackIndex !== -1) {
        this.sceneStack.splice(stackIndex, 1);
      }
      this.sceneStack.push(sceneId);
    }
    
    // Emit scene switched event
    globalEventBus.emit({
      type: 'scene.switched',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: sceneId,
        name: newScene?.name
      }
    });
  }
  
  // Scene stack management
  pushScene(sceneId: SceneId, transition: Transition = { type: 'none', duration: 0 }): void {
    // Load scene and add to stack
    this.loadScene(sceneId, transition);
  }
  
  popScene(transition: Transition = { type: 'none', duration: 0 }): void {
    // Remove current scene from stack
    if (this.sceneStack.length <= 1) {
      console.warn('Cannot pop last scene from stack');
      return;
    }
    
    this.sceneStack.pop(); // Remove current scene
    const previousSceneId = this.sceneStack[this.sceneStack.length - 1];
    
    // Load previous scene
    this.loadScene(previousSceneId, transition);
  }
  
  // Scene queries
  getActiveScene(): Scene | null {
    if (!this.activeScene) return null;
    return this.scenes.get(this.activeScene) || null;
  }
  
  setActiveScene(scene: Scene): void {
    // Find scene ID
    let sceneId: SceneId | null = null;
    for (const [id, s] of this.scenes) {
      if (s === scene) {
        sceneId = id;
        break;
      }
    }
    
    if (!sceneId) {
      console.error('Scene not managed by this SceneManager');
      return;
    }
    
    // Deactivate current scene
    if (this.activeScene && this.activeScene !== sceneId) {
      const currentScene = this.scenes.get(this.activeScene);
      if (currentScene) {
        currentScene.deactivate();
      }
    }
    
    // Set and activate new scene
    this.activeScene = sceneId;
    if (!scene.isActive()) {
      scene.activate();
    }
  }
  
  getActiveSceneId(): SceneId | null {
    return this.activeScene;
  }
  
  getScene(sceneId: SceneId): Scene | undefined {
    return this.scenes.get(sceneId);
  }
  
  getSceneByName(name: string): Scene | undefined {
    for (const scene of this.scenes.values()) {
      if (scene.name === name) {
        return scene;
      }
    }
    return undefined;
  }
  
  getAllScenes(): Scene[] {
    return Array.from(this.scenes.values());
  }
  
  getSceneCount(): number {
    return this.scenes.size;
  }
  
  // Scene camera access
  getActiveCamera(): Camera | null {
    const activeScene = this.getActiveScene();
    if (!activeScene) return null;
    
    return activeScene.getCamera();
  }
  
  setActiveCamera(camera: Partial<Camera>): void {
    const activeScene = this.getActiveScene();
    if (!activeScene) return;
    
    activeScene.setCamera(camera);
  }
  
  // Scene serialization
  serializeScenes(): any {
    const serialized: any = {
      activeScene: this.activeScene,
      sceneStack: [...this.sceneStack],
      scenes: {}
    };
    
    for (const [id, scene] of this.scenes) {
      serialized.scenes[id] = scene.toJSON();
    }
    
    return serialized;
  }
  
  // Scene transition rendering
  renderTransition(renderer: any): void {
    if (!this.transitioning || !this.currentTransition) return;
    
    const ctx = renderer.getContext();
    const canvas = renderer.getCanvas();
    
    // Apply easing to progress
    let easedProgress = this.transitionProgress;
    switch (this.currentTransition.easing) {
      case 'easeIn':
        easedProgress = easedProgress * easedProgress;
        break;
      case 'easeOut':
        easedProgress = 1 - (1 - easedProgress) * (1 - easedProgress);
        break;
      case 'easeInOut':
        easedProgress = easedProgress < 0.5 
          ? 2 * easedProgress * easedProgress 
          : 1 - Math.pow(-2 * easedProgress + 2, 2) / 2;
        break;
    }
    
    // Render transition effect
    switch (this.currentTransition.type) {
      case 'fade':
        ctx.fillStyle = 'black';
        ctx.globalAlpha = easedProgress;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        break;
        
      case 'slide':
        const direction = this.currentTransition.direction || 'right';
        let x = 0, y = 0;
        
        switch (direction) {
          case 'left':
            x = -canvas.width * (1 - easedProgress);
            break;
          case 'right':
            x = canvas.width * (1 - easedProgress);
            break;
          case 'up':
            y = -canvas.height * (1 - easedProgress);
            break;
          case 'down':
            y = canvas.height * (1 - easedProgress);
            break;
        }
        
        ctx.save();
        ctx.translate(x, y);
        // In a real implementation, this would render the target scene
        ctx.restore();
        break;
        
      case 'zoom':
        const scale = 1 + (easedProgress * 0.5);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        // In a real implementation, this would render the target scene
        ctx.restore();
        break;
    }
  }
}