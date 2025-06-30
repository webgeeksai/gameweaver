/**
 * Behavior System for the Game Vibe Engine
 * Processes and updates entity behaviors
 */

import { BaseSystem } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { BehaviorManager } from './BehaviorManager';

export class BehaviorSystem extends BaseSystem {
  private behaviorManager: BehaviorManager;
  
  constructor(behaviorManager: BehaviorManager) {
    super(
      'BehaviorSystem',
      300, // Lower priority than physics and transform
      [] // No required components - behaviors are managed separately
    );
    this.behaviorManager = behaviorManager;
  }
  
  initialize(): void {
    console.log('BehaviorSystem initialized');
  }
  
  protected processEntities(entities: Entity[], deltaTime: number): void {
    // Update all behaviors
    this.behaviorManager.updateBehaviors(deltaTime);
  }
  
  // Public API
  getBehaviorManager(): BehaviorManager {
    return this.behaviorManager;
  }
}