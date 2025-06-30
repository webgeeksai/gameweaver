/**
 * Scene implementation for the Game Vibe Engine
 * Represents a game level or screen with its own entities and settings
 */

import { SceneId, EntityId, ComponentType } from '../types';
import { Entity, EntityDefinition } from '../ecs/Entity';
import { EntityManager } from '../ecs/EntityManager';
import { ComponentManager } from '../ecs/ComponentManager';
import { Vector2 } from '../math/Vector2';
import { Rectangle } from '../math/Rectangle';
import { Camera } from '../../systems/RenderingSystem';
import { globalEventBus } from '../events/EventBus';
import { EventPriority, EventSource } from '../types';

export interface SceneConfig {
  gravity?: [number, number];
  bounds?: [number, number, number, number];
  backgroundColor?: string;
  pixelArt?: boolean;
  camera?: Partial<Camera>;
}

export interface SceneDefinition {
  name: string;
  config?: SceneConfig;
  entities?: EntityDefinition[];
}

export class Scene {
  readonly id: SceneId;
  readonly name: string;
  
  // Scene entities
  private entities: Set<EntityId> = new Set();
  private namedEntities: Map<string, EntityId> = new Map();
  
  // Scene configuration
  private config: SceneConfig;
  private camera: Camera;
  private active: boolean = false;
  private initialized: boolean = false;
  
  // Entity management
  private entityManager: EntityManager;
  private componentManager: ComponentManager;
  
  constructor(
    id: SceneId, 
    name: string, 
    entityManager: EntityManager,
    componentManager: ComponentManager,
    config: SceneConfig = {}
  ) {
    this.id = id;
    this.name = name;
    this.entityManager = entityManager;
    this.componentManager = componentManager;
    
    // Default configuration
    this.config = {
      gravity: [0, 800],
      bounds: [0, 0, 800, 600],
      backgroundColor: '#000000',
      pixelArt: false,
      ...config
    };
    
    // Default camera
    this.camera = {
      position: new Vector2(0, 0),
      zoom: 1,
      rotation: 0,
      bounds: new Rectangle(
        this.config.bounds![0],
        this.config.bounds![1],
        this.config.bounds![2],
        this.config.bounds![3]
      )
    };
    
    // Apply camera config if provided
    if (config.camera) {
      this.camera = {
        ...this.camera,
        ...config.camera
      };
    }
  }
  
  // Scene lifecycle
  initialize(): void {
    if (this.initialized) return;
    
    // Emit scene initializing event
    globalEventBus.emit({
      type: 'scene.initializing',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: this.id,
        name: this.name
      }
    });
    
    // Initialize scene entities
    // In a real implementation, this would create entities from the scene definition
    
    this.initialized = true;
    
    // Emit scene initialized event
    globalEventBus.emit({
      type: 'scene.initialized',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: this.id,
        name: this.name
      }
    });
  }
  
  activate(): void {
    if (this.active) return;
    
    this.active = true;
    
    // Emit scene activated event
    globalEventBus.emit({
      type: 'scene.activated',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: this.id,
        name: this.name
      }
    });
  }
  
  deactivate(): void {
    if (!this.active) return;
    
    this.active = false;
    
    // Emit scene deactivated event
    globalEventBus.emit({
      type: 'scene.deactivated',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: this.id,
        name: this.name
      }
    });
  }
  
  destroy(): void {
    // Emit scene destroying event
    globalEventBus.emit({
      type: 'scene.destroying',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: this.id,
        name: this.name
      }
    });
    
    // Destroy all entities in this scene
    this.destroyAllEntities();
    
    // Clear entity collections
    this.entities.clear();
    this.namedEntities.clear();
    
    // Emit scene destroyed event
    globalEventBus.emit({
      type: 'scene.destroyed',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: {
        scene: this.id,
        name: this.name
      }
    });
  }
  
  // Entity management
  createEntity(definition: EntityDefinition, name?: string): Entity {
    // Create entity
    const entity = this.entityManager.create(definition, this.id);
    
    // Add to scene entities
    this.entities.add(entity.id);
    
    // Store named entity
    if (name) {
      this.namedEntities.set(name, entity.id);
    }
    
    // Emit entity created event
    globalEventBus.emit({
      type: 'scene.entity.created',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        scene: this.id,
        entity: entity.id,
        name: entity.name
      }
    });
    
    return entity;
  }
  
  destroyEntity(entityId: EntityId): void {
    // Check if entity belongs to this scene
    if (!this.entities.has(entityId)) return;
    
    // Remove from scene entities
    this.entities.delete(entityId);
    
    // Remove from named entities
    for (const [name, id] of this.namedEntities.entries()) {
      if (id === entityId) {
        this.namedEntities.delete(name);
        break;
      }
    }
    
    // Destroy entity
    this.entityManager.destroy(entityId);
    
    // Emit entity destroyed event
    globalEventBus.emit({
      type: 'scene.entity.destroyed',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        scene: this.id,
        entity: entityId
      }
    });
  }
  
  destroyAllEntities(): void {
    // Destroy all entities in this scene
    for (const entityId of this.entities) {
      this.entityManager.destroy(entityId);
    }
    
    // Clear entity collections
    this.entities.clear();
    this.namedEntities.clear();
  }
  
  // Entity spawning
  spawn(entityType: string, position: Vector2, name?: string): Entity {
    // Create entity definition
    const definition: EntityDefinition = {
      name: entityType,
      tags: [entityType.toLowerCase()]
    };
    
    // Create entity
    const entity = this.createEntity(definition, name);
    
    // Add transform component
    this.componentManager.add(entity, ComponentType.Transform, {
      position: { x: position.x, y: position.y },
      rotation: 0,
      scale: { x: 1, y: 1 }
    });
    
    return entity;
  }
  
  spawnGrid(
    entityType: string, 
    rows: number, 
    cols: number, 
    position: Vector2, 
    spacing: Vector2
  ): Entity[] {
    const entities: Entity[] = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = position.x + col * spacing.x;
        const y = position.y + row * spacing.y;
        
        const entity = this.spawn(
          entityType, 
          new Vector2(x, y), 
          `${entityType}_${row}_${col}`
        );
        
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  spawnRandom(
    entityType: string, 
    count: number, 
    bounds: Rectangle
  ): Entity[] {
    const entities: Entity[] = [];
    
    for (let i = 0; i < count; i++) {
      const x = bounds.x + Math.random() * bounds.width;
      const y = bounds.y + Math.random() * bounds.height;
      
      const entity = this.spawn(
        entityType, 
        new Vector2(x, y), 
        `${entityType}_${i}`
      );
      
      entities.push(entity);
    }
    
    return entities;
  }
  
  // Entity queries
  getEntity(entityId: EntityId): Entity | undefined {
    // Check if entity belongs to this scene
    if (!this.entities.has(entityId)) return undefined;
    
    return this.entityManager.get(entityId);
  }
  
  getEntityByName(name: string): Entity | undefined {
    const entityId = this.namedEntities.get(name);
    if (!entityId) return undefined;
    
    return this.entityManager.get(entityId);
  }
  
  getAllEntities(): Entity[] {
    const entities: Entity[] = [];
    
    for (const entityId of this.entities) {
      const entity = this.entityManager.get(entityId);
      if (entity) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  findEntitiesByTag(tag: string): Entity[] {
    const entities: Entity[] = [];
    
    for (const entityId of this.entities) {
      const entity = this.entityManager.get(entityId);
      if (entity && entity.hasTag(tag)) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  findEntitiesByComponent(componentType: string): Entity[] {
    const entities: Entity[] = [];
    
    for (const entityId of this.entities) {
      const entity = this.entityManager.get(entityId);
      if (entity && entity.hasComponent(componentType as any)) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  findEntitiesInRadius(position: Vector2, radius: number, tags?: string[]): Entity[] {
    const entities: Entity[] = [];
    const radiusSquared = radius * radius;
    
    for (const entityId of this.entities) {
      const entity = this.entityManager.get(entityId);
      if (!entity) continue;
      
      // Skip entities without transform
      if (!entity.hasComponent(ComponentType.Transform)) continue;
      
      // Skip entities that don't match tags
      if (tags && tags.length > 0) {
        let hasTag = false;
        for (const tag of tags) {
          if (entity.hasTag(tag)) {
            hasTag = true;
            break;
          }
        }
        if (!hasTag) continue;
      }
      
      // Get entity position
      const transform = this.componentManager.getByEntity(entity, ComponentType.Transform);
      if (!transform) continue;
      
      // Calculate distance
      const entityPos = new Vector2(transform.data.position.x, transform.data.position.y);
      const distanceSquared = position.distanceSquared(entityPos);
      
      // Add if within radius
      if (distanceSquared <= radiusSquared) {
        entities.push(entity);
      }
    }
    
    return entities;
  }
  
  // Scene properties
  isActive(): boolean {
    return this.active;
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  getEntityCount(): number {
    return this.entities.size;
  }
  
  getConfig(): SceneConfig {
    return { ...this.config };
  }
  
  getCamera(): Camera {
    return { ...this.camera };
  }
  
  setCamera(camera: Partial<Camera>): void {
    this.camera = {
      ...this.camera,
      ...camera
    };
    
    // Emit camera updated event
    globalEventBus.emit({
      type: 'scene.camera.updated',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        scene: this.id,
        camera: this.camera
      }
    });
  }
  
  setCameraPosition(position: Vector2): void {
    this.camera.position = position;
    
    // Emit camera updated event
    globalEventBus.emit({
      type: 'scene.camera.updated',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        scene: this.id,
        camera: this.camera
      }
    });
  }
  
  setCameraZoom(zoom: number): void {
    this.camera.zoom = zoom;
    
    // Emit camera updated event
    globalEventBus.emit({
      type: 'scene.camera.updated',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        scene: this.id,
        camera: this.camera
      }
    });
  }
  
  setGravity(x: number, y: number): void {
    this.config.gravity = [x, y];
    
    // Emit scene config updated event
    globalEventBus.emit({
      type: 'scene.config.updated',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        scene: this.id,
        config: { gravity: this.config.gravity }
      }
    });
  }
  
  setBackground(color: string): void {
    this.config.backgroundColor = color;
    
    // Emit scene config updated event
    globalEventBus.emit({
      type: 'scene.config.updated',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        scene: this.id,
        config: { backgroundColor: this.config.backgroundColor }
      }
    });
  }
  
  // Cleanup scene
  cleanup(): void {
    this.deactivate();
    this.destroyAllEntities();
    console.log(`Scene ${this.name} cleaned up`);
  }
  
  // Add existing entity to scene
  addExistingEntity(entity: Entity): void {
    if (this.entities.has(entity.id)) return;
    
    // Add to scene tracking
    this.entities.add(entity.id);
    
    // Add name mapping if entity has name
    if (entity.name) {
      this.namedEntities.set(entity.name, entity.id);
    }
    
    console.log(`Added existing entity ${entity.id} to scene ${this.name}`);
  }
  
  // Scene serialization
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      active: this.active,
      initialized: this.initialized,
      config: this.config,
      camera: {
        position: { x: this.camera.position.x, y: this.camera.position.y },
        zoom: this.camera.zoom,
        rotation: this.camera.rotation,
        bounds: {
          x: this.camera.bounds.x,
          y: this.camera.bounds.y,
          width: this.camera.bounds.width,
          height: this.camera.bounds.height
        }
      },
      entities: Array.from(this.entities),
      namedEntities: Object.fromEntries(this.namedEntities)
    };
  }
}