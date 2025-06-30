/**
 * Scene System for the Game Vibe Engine
 * Manages scene updates and transitions
 */

import { BaseSystem } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { SceneManager } from './SceneManager';
import { RenderingSystem } from '../../systems/RenderingSystem';

export class SceneSystem extends BaseSystem {
  private sceneManager: SceneManager;
  private renderingSystem: RenderingSystem;
  
  constructor(sceneManager: SceneManager, renderingSystem: RenderingSystem) {
    super(
      'SceneSystem',
      50, // High priority - runs early in the update cycle
      [] // No required components - this is a global system
    );
    this.sceneManager = sceneManager;
    this.renderingSystem = renderingSystem;
  }
  
  initialize(): void {
    console.log('SceneSystem initialized');
  }
  
  protected processEntities(entities: Entity[], deltaTime: number): void {
    // Update scene transitions
    this.sceneManager.updateTransition(deltaTime);
    
    // Update active scene camera
    const activeCamera = this.sceneManager.getActiveCamera();
    if (activeCamera) {
      this.renderingSystem.setCamera(activeCamera);
    }
  }
  
  protected renderEntities(entities: Entity[], renderer: any): void {
    // Render scene transitions
    if (this.sceneManager) {
      this.sceneManager.renderTransition(renderer);
    }
  }
  
  // Public API
  getSceneManager(): SceneManager {
    return this.sceneManager;
  }
}