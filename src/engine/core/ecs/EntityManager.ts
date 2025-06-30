/**
 * Entity Manager for the Entity Component System
 * Handles entity creation, destruction, and queries
 */

import { v4 as uuidv4 } from 'uuid';
import { EntityId, SceneId } from '../types';
import { Entity, EntityDefinition } from './Entity';
import { globalEventBus } from '../events/EventBus';
import { EventPriority, EventSource } from '../types';

export class EntityManager {
  private entities: Map<EntityId, Entity> = new Map();
  private entityPool: Entity[] = [];
  private maxPoolSize: number = 100;
  
  // Entity lifecycle
  create(definition: EntityDefinition, scene: SceneId): Entity {
    const id = uuidv4();
    
    // Try to reuse an entity from the pool
    let entity: Entity;
    if (this.entityPool.length > 0) {
      entity = this.entityPool.pop()!;
      // Reset entity to default state
      entity.active = definition.active ?? true;
      entity.destroyed = false;
      entity.tags.clear();
      entity.children.clear();
      entity.components.clear();
      entity.properties = {};
      
      // Add tags
      if (definition.tags) {
        definition.tags.forEach(tag => entity.tags.add(tag));
      }
    } else {
      // Create a new entity
      entity = new Entity(id, definition.name, scene, definition);
    }
    
    this.entities.set(id, entity);
    
    // Emit entity created event
    globalEventBus.emit({
      type: 'entity.created',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        entity: entity.id,
        name: entity.name,
        scene: entity.scene
      }
    });
    
    return entity;
  }
  
  destroy(entityId: EntityId): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    
    // Mark as destroyed
    entity.destroyed = true;
    
    // Remove from parent
    if (entity.parent) {
      const parent = this.entities.get(entity.parent);
      if (parent) {
        parent.removeChild(entityId);
      }
    }
    
    // Destroy children
    for (const childId of entity.children) {
      this.destroy(childId);
    }
    
    // Remove from entities map
    this.entities.delete(entityId);
    
    // Add to pool if not full
    if (this.entityPool.length < this.maxPoolSize) {
      this.entityPool.push(entity);
    }
    
    // Emit entity destroyed event
    globalEventBus.emit({
      type: 'entity.destroyed',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        entity: entityId,
        name: entity.name,
        scene: entity.scene
      }
    });
  }
  
  get(entityId: EntityId): Entity | undefined {
    return this.entities.get(entityId);
  }
  
  getAll(): Entity[] {
    return Array.from(this.entities.values());
  }
  
  // Entity queries
  findByName(name: string): Entity | null {
    for (const entity of this.entities.values()) {
      if (entity.name === name) {
        return entity;
      }
    }
    return null;
  }
  
  findByTag(tag: string): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.hasTag(tag)) {
        result.push(entity);
      }
    }
    return result;
  }
  
  findByScene(sceneId: SceneId): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.scene === sceneId) {
        result.push(entity);
      }
    }
    return result;
  }
  
  findByComponent(componentType: string): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.hasComponent(componentType as any)) {
        result.push(entity);
      }
    }
    return result;
  }
  
  findByComponents(componentTypes: string[]): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.hasComponents(componentTypes as any[])) {
        result.push(entity);
      }
    }
    return result;
  }
  
  // Bulk operations
  createBulk(definitions: EntityDefinition[], scene: SceneId): Entity[] {
    return definitions.map(def => this.create(def, scene));
  }
  
  destroyBulk(entityIds: EntityId[]): void {
    entityIds.forEach(id => this.destroy(id));
  }
  
  destroyAllInScene(sceneId: SceneId): void {
    const entities = this.findByScene(sceneId);
    entities.forEach(entity => this.destroy(entity.id));
  }
  
  // Utility methods
  getEntityCount(): number {
    return this.entities.size;
  }

  /**
   * Check if an entity exists
   */
  exists(entityId: EntityId): boolean {
    return this.entities.has(entityId);
  }

  /**
   * Create an entity with a specific ID (for state synchronization)
   */
  createWithId(entityId: EntityId, definition: EntityDefinition, scene: SceneId): Entity {
    // Check if entity already exists
    if (this.entities.has(entityId)) {
      throw new Error(`Entity with ID ${entityId} already exists`);
    }

    // Create entity with specific ID
    const entity = new Entity(entityId, definition.name, scene, definition);
    this.entities.set(entityId, entity);

    // Emit entity created event
    globalEventBus.emit({
      type: 'entity.created',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        entityId: entity.id,
        name: entity.name,
        scene: entity.scene,
        tags: Array.from(entity.tags),
        definition
      }
    });

    return entity;
  }
  
  getPoolSize(): number {
    return this.entityPool.length;
  }
  
  clearPool(): void {
    this.entityPool = [];
  }
  
  // Find similar entities by name (for error recovery)
  findSimilarEntities(name: string, threshold: number = 0.7): Entity[] {
    const results: Array<{ entity: Entity; similarity: number }> = [];
    
    for (const entity of this.entities.values()) {
      const similarity = this.calculateStringSimilarity(name, entity.name);
      if (similarity >= threshold) {
        results.push({ entity, similarity });
      }
    }
    
    // Sort by similarity (highest first)
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.map(result => result.entity);
  }
  
  // Simple string similarity calculation (Levenshtein distance based)
  private calculateStringSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;
    
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    // Calculate similarity as 1 - normalized distance
    const maxLength = Math.max(a.length, b.length);
    return 1 - (matrix[b.length][a.length] / maxLength);
  }
}