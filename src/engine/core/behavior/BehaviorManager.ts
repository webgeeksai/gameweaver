/**
 * Behavior Manager for the Game Vibe Engine
 * Manages behavior creation, application, and updates
 */

import { Entity } from '../ecs/Entity';
import { Behavior, BehaviorDefinition } from './Behavior';
import { globalEventBus } from '../events/EventBus';
import { EventPriority, EventSource } from '../types';

export class BehaviorManager {
  private behaviorRegistry: Map<string, BehaviorDefinition> = new Map();
  private entityBehaviors: Map<string, Behavior[]> = new Map();
  
  // Behavior registration
  registerBehavior(name: string, definition: BehaviorDefinition): void {
    if (this.behaviorRegistry.has(name)) {
      console.warn(`Behavior ${name} already registered. Replacing.`);
    }
    
    this.behaviorRegistry.set(name, definition);
    
    // Emit behavior registered event
    globalEventBus.emit({
      type: 'behavior.registered',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: { name }
    });
  }
  
  unregisterBehavior(name: string): void {
    if (!this.behaviorRegistry.has(name)) {
      console.warn(`Behavior ${name} not found.`);
      return;
    }
    
    this.behaviorRegistry.delete(name);
    
    // Emit behavior unregistered event
    globalEventBus.emit({
      type: 'behavior.unregistered',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: { name }
    });
  }
  
  getBehaviorDefinition(name: string): BehaviorDefinition | undefined {
    return this.behaviorRegistry.get(name);
  }
  
  getAllBehaviorDefinitions(): BehaviorDefinition[] {
    return Array.from(this.behaviorRegistry.values());
  }
  
  // Behavior application
  applyBehavior(entity: Entity, behaviorName: string, properties: Record<string, any> = {}): Behavior | null {
    const definition = this.behaviorRegistry.get(behaviorName);
    if (!definition) {
      console.error(`Behavior ${behaviorName} not found.`);
      return null;
    }
    
    // Create behavior instance
    const behavior = this.createBehavior(entity, definition, properties);
    
    // Add to entity behaviors
    if (!this.entityBehaviors.has(entity.id)) {
      this.entityBehaviors.set(entity.id, []);
    }
    
    this.entityBehaviors.get(entity.id)!.push(behavior);
    
    // Initialize behavior
    behavior.initialize();
    
    // Emit behavior applied event
    globalEventBus.emit({
      type: 'behavior.applied',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        entity: entity.id,
        behavior: behaviorName
      }
    });
    
    return behavior;
  }
  
  removeBehavior(entity: Entity, behaviorName: string): void {
    const behaviors = this.entityBehaviors.get(entity.id);
    if (!behaviors) return;
    
    const index = behaviors.findIndex(b => b.name === behaviorName);
    if (index === -1) return;
    
    // Get behavior to remove
    const behavior = behaviors[index];
    
    // Call destroy method
    behavior.destroy();
    
    // Remove from list
    behaviors.splice(index, 1);
    
    // Emit behavior removed event
    globalEventBus.emit({
      type: 'behavior.removed',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        entity: entity.id,
        behavior: behaviorName
      }
    });
  }
  
  removeAllBehaviors(entity: Entity): void {
    const behaviors = this.entityBehaviors.get(entity.id);
    if (!behaviors) return;
    
    // Call destroy on all behaviors
    for (const behavior of behaviors) {
      behavior.destroy();
    }
    
    // Clear behaviors
    this.entityBehaviors.delete(entity.id);
    
    // Emit behaviors cleared event
    globalEventBus.emit({
      type: 'behavior.cleared',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        entity: entity.id
      }
    });
  }
  
  // Behavior updates
  updateBehaviors(deltaTime: number): void {
    for (const [entityId, behaviors] of this.entityBehaviors) {
      for (const behavior of behaviors) {
        if (behavior.isActive()) {
          behavior.update(deltaTime);
        }
      }
    }
  }
  
  // Entity behavior queries
  getEntityBehaviors(entity: Entity): Behavior[] {
    return this.entityBehaviors.get(entity.id) || [];
  }
  
  hasEntityBehavior(entity: Entity, behaviorName: string): boolean {
    const behaviors = this.entityBehaviors.get(entity.id);
    if (!behaviors) return false;
    
    return behaviors.some(b => b.name === behaviorName);
  }
  
  getEntityBehavior(entity: Entity, behaviorName: string): Behavior | null {
    const behaviors = this.entityBehaviors.get(entity.id);
    if (!behaviors) return null;
    
    return behaviors.find(b => b.name === behaviorName) || null;
  }
  
  // Entity queries
  getEntitiesWithBehavior(behaviorName: string): string[] {
    const entities: string[] = [];
    
    for (const [entityId, behaviors] of this.entityBehaviors) {
      if (behaviors.some(b => b.name === behaviorName)) {
        entities.push(entityId);
      }
    }
    
    return entities;
  }
  
  // Private helpers
  private createBehavior(entity: Entity, definition: BehaviorDefinition, properties: Record<string, any>): Behavior {
    // Create behavior instance
    const behavior = new Behavior(definition.name, entity, {
      ...definition.properties,
      ...properties
    });
    
    // Add methods to behavior
    for (const [methodName, method] of Object.entries(definition.methods)) {
      (behavior as any)[methodName] = method.bind(behavior);
    }
    
    // Add update method if defined
    if (definition.update) {
      behavior.update = (deltaTime: number) => {
        definition.update!(entity, deltaTime);
      };
    }
    
    // Add initialize method if defined
    if (definition.initialize) {
      const originalInitialize = behavior.initialize;
      behavior.initialize = () => {
        originalInitialize.call(behavior);
        definition.initialize!(entity);
      };
    }
    
    // Add destroy method if defined
    if (definition.destroy) {
      const originalDestroy = behavior.destroy;
      behavior.destroy = () => {
        originalDestroy.call(behavior);
        definition.destroy!(entity);
      };
    }
    
    return behavior;
  }
}