/**
 * Entity implementation for the Entity Component System
 * Represents a game object in the world
 */

import { ComponentId, ComponentType, EntityId, SceneId } from '../types';

export interface EntityDefinition {
  name: string;
  tags?: string[];
  layer?: number;
  components?: ComponentDefinition[];
  parent?: EntityId;
  active?: boolean;
}

export interface ComponentDefinition {
  type: ComponentType;
  data: any;
}

export class Entity {
  readonly id: EntityId;
  readonly name: string;
  readonly scene: SceneId;
  active: boolean;
  destroyed: boolean;
  
  // Hierarchical relationships
  parent?: EntityId;
  children: Set<EntityId> = new Set();
  
  // Component references
  components: Map<ComponentType, ComponentId> = new Map();
  
  // Metadata
  tags: Set<string> = new Set();
  layer: number;
  created: number;
  lastModified: number;
  
  // Custom properties
  properties: Record<string, any> = {};
  
  constructor(id: EntityId, name: string, scene: SceneId, options: Partial<EntityDefinition> = {}) {
    this.id = id;
    this.name = name;
    this.scene = scene;
    this.active = options.active ?? true;
    this.destroyed = false;
    this.layer = options.layer ?? 0;
    this.created = Date.now();
    this.lastModified = this.created;
    
    // Initialize tags
    if (options.tags) {
      options.tags.forEach(tag => this.tags.add(tag));
    }
    
    // Set parent if provided
    if (options.parent) {
      this.parent = options.parent;
    }
  }
  
  // Tag management
  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }
  
  addTag(tag: string): void {
    this.tags.add(tag);
    this.lastModified = Date.now();
  }
  
  removeTag(tag: string): void {
    this.tags.delete(tag);
    this.lastModified = Date.now();
  }
  
  // Component checks
  hasComponent(type: ComponentType): boolean {
    return this.components.has(type);
  }
  
  hasComponents(types: ComponentType[]): boolean {
    return types.every(type => this.components.has(type));
  }
  
  // Hierarchy methods
  addChild(childId: EntityId): void {
    this.children.add(childId);
    this.lastModified = Date.now();
  }
  
  removeChild(childId: EntityId): void {
    this.children.delete(childId);
    this.lastModified = Date.now();
  }
  
  hasChildren(): boolean {
    return this.children.size > 0;
  }
  
  isChildOf(parentId: EntityId): boolean {
    return this.parent === parentId;
  }
  
  // Utility methods
  setActive(active: boolean): void {
    this.active = active;
    this.lastModified = Date.now();
  }
  
  setProperty(key: string, value: any): void {
    this.properties[key] = value;
    this.lastModified = Date.now();
  }
  
  getProperty<T>(key: string, defaultValue?: T): T | undefined {
    return this.properties[key] !== undefined ? this.properties[key] : defaultValue;
  }
  
  // Serialization
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      scene: this.scene,
      active: this.active,
      parent: this.parent,
      children: Array.from(this.children),
      components: Array.from(this.components.entries()),
      tags: Array.from(this.tags),
      layer: this.layer,
      created: this.created,
      lastModified: this.lastModified,
      properties: { ...this.properties }
    };
  }
  
  // Clone entity (without components)
  clone(newId: EntityId): Entity {
    const clone = new Entity(newId, `${this.name}_clone`, this.scene, {
      active: this.active,
      layer: this.layer,
      tags: Array.from(this.tags)
    });
    
    // Copy properties
    clone.properties = JSON.parse(JSON.stringify(this.properties));
    
    return clone;
  }
}