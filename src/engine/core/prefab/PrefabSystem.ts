/**
 * Prefab System
 * 
 * Unity-like prefab system for creating reusable game object templates
 * with inheritance and override support.
 */

import { EventEmitter } from 'events';
import { EntityId, ComponentType } from '../types';
import { Entity, EntityDefinition } from '../ecs/Entity';
import { EntityManager } from '../ecs/EntityManager';
import { ComponentManager } from '../ecs/ComponentManager';
import { Component } from '../ecs/Component';
import { Vector2 } from '../math/Vector2';

export interface PrefabMetadata {
  id: string;
  name: string;
  description: string;
  tags: string[];
  thumbnail?: string;
  category: string;
  author: string;
  version: string;
  createdAt: Date;
  lastModified: Date;
}

export interface PrefabComponent {
  type: ComponentType;
  data: any;
  overridable: boolean;
}

export interface PrefabDefinition {
  metadata: PrefabMetadata;
  components: PrefabComponent[];
  children?: PrefabChild[];
  defaultValues: Record<string, any>;
}

export interface PrefabChild {
  name: string;
  prefabId?: string; // If referencing another prefab
  localPosition: { x: number; y: number };
  localRotation: number;
  localScale: { x: number; y: number };
  components?: PrefabComponent[];
}

export interface PrefabInstance {
  id: string;
  prefabId: string;
  entityId: EntityId;
  overrides: PrefabOverride[];
  children: Map<string, PrefabInstance>;
}

export interface PrefabOverride {
  path: string; // e.g., "transform.position.x"
  value: any;
  componentType?: ComponentType;
}

export interface PrefabEvents {
  'prefab:created': { prefab: PrefabDefinition };
  'prefab:updated': { prefabId: string; changes: Partial<PrefabDefinition> };
  'prefab:deleted': { prefabId: string };
  'prefab:instantiated': { prefabId: string; instance: PrefabInstance };
  'prefab:applied': { instanceId: string; prefabId: string };
  'prefab:reverted': { instanceId: string };
}

/**
 * Prefab System Manager
 */
export class PrefabSystem extends EventEmitter {
  private prefabs: Map<string, PrefabDefinition> = new Map();
  private instances: Map<string, PrefabInstance> = new Map();
  private entityToPrefab: Map<EntityId, string> = new Map();
  private entityManager: EntityManager;
  private componentManager: ComponentManager;

  constructor(entityManager: EntityManager, componentManager: ComponentManager) {
    super();
    this.entityManager = entityManager;
    this.componentManager = componentManager;
  }

  /**
   * Create a new prefab from an entity
   */
  createPrefab(entity: Entity, metadata: Omit<PrefabMetadata, 'id' | 'createdAt' | 'lastModified'>): PrefabDefinition {
    const prefabId = this.generatePrefabId();
    
    // Extract components
    const components: PrefabComponent[] = [];
    const componentTypes = Object.values(ComponentType);
    
    for (const type of componentTypes) {
      const component = this.componentManager.getByEntity(entity, type);
      if (component) {
        components.push({
          type,
          data: this.cloneComponentData(component.data),
          overridable: true
        });
      }
    }

    // Create prefab definition
    const prefab: PrefabDefinition = {
      metadata: {
        ...metadata,
        id: prefabId,
        createdAt: new Date(),
        lastModified: new Date()
      },
      components,
      children: [], // TODO: Support child entities
      defaultValues: {}
    };

    // Store prefab
    this.prefabs.set(prefabId, prefab);

    // Emit event
    this.emit('prefab:created', { prefab });

    return prefab;
  }

  /**
   * Instantiate a prefab
   */
  instantiate(
    prefabId: string,
    position?: Vector2,
    rotation?: number,
    parent?: Entity
  ): Entity {
    const prefab = this.prefabs.get(prefabId);
    if (!prefab) {
      throw new Error(`Prefab not found: ${prefabId}`);
    }

    // Create entity
    const entity = this.entityManager.create({
      name: `${prefab.metadata.name}_Instance`,
      tags: [...prefab.metadata.tags, 'prefab_instance']
    }, 'default-scene');

    // Create prefab instance tracking
    const instanceId = this.generateInstanceId();
    const instance: PrefabInstance = {
      id: instanceId,
      prefabId,
      entityId: entity.id,
      overrides: [],
      children: new Map()
    };

    // Add components
    for (const prefabComp of prefab.components) {
      const componentData = this.cloneComponentData(prefabComp.data);
      
      // Apply position override for transform
      if (prefabComp.type === ComponentType.Transform && position) {
        componentData.position = { x: position.x, y: position.y };
        if (rotation !== undefined) {
          componentData.rotation = rotation;
        }
        
        // Track overrides
        if (position) {
          instance.overrides.push({
            path: 'transform.position',
            value: { x: position.x, y: position.y },
            componentType: ComponentType.Transform
          });
        }
      }

      this.componentManager.add(entity, prefabComp.type, componentData);
    }

    // Instantiate children
    if (prefab.children) {
      for (const childDef of prefab.children) {
        this.instantiateChild(entity, childDef, instance);
      }
    }

    // Store instance
    this.instances.set(instanceId, instance);
    this.entityToPrefab.set(entity.id, instanceId);

    // Emit event
    this.emit('prefab:instantiated', { prefabId, instance });

    return entity;
  }

  /**
   * Apply changes from instance back to prefab
   */
  applyToPrefab(entityId: EntityId): void {
    const instanceId = this.entityToPrefab.get(entityId);
    if (!instanceId) {
      throw new Error('Entity is not a prefab instance');
    }

    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    const prefab = this.prefabs.get(instance.prefabId);
    if (!prefab) {
      throw new Error('Prefab not found');
    }

    const entity = this.entityManager.get(entityId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    // Update prefab components
    const updatedComponents: PrefabComponent[] = [];
    
    for (const prefabComp of prefab.components) {
      const component = this.componentManager.getByEntity(entity, prefabComp.type);
      if (component) {
        updatedComponents.push({
          type: prefabComp.type,
          data: this.cloneComponentData(component.data),
          overridable: prefabComp.overridable
        });
      }
    }

    // Update prefab
    prefab.components = updatedComponents;
    prefab.metadata.lastModified = new Date();

    // Clear instance overrides
    instance.overrides = [];

    // Emit event
    this.emit('prefab:applied', { instanceId, prefabId: instance.prefabId });

    // Update all other instances
    this.updateAllInstances(instance.prefabId, instanceId);
  }

  /**
   * Revert instance to prefab defaults
   */
  revertToPrefab(entityId: EntityId): void {
    const instanceId = this.entityToPrefab.get(entityId);
    if (!instanceId) {
      throw new Error('Entity is not a prefab instance');
    }

    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error('Instance not found');
    }

    const prefab = this.prefabs.get(instance.prefabId);
    if (!prefab) {
      throw new Error('Prefab not found');
    }

    const entity = this.entityManager.get(entityId);
    if (!entity) {
      throw new Error('Entity not found');
    }

    // Reapply prefab components
    for (const prefabComp of prefab.components) {
      const componentData = this.cloneComponentData(prefabComp.data);
      
      // Skip overridden values
      const overrides = instance.overrides.filter(o => o.componentType === prefabComp.type);
      for (const override of overrides) {
        // Apply override logic here
        this.applyOverride(componentData, override);
      }

      // Update component
      const existing = this.componentManager.getByEntity(entity, prefabComp.type);
      if (existing) {
        // Remove old component and add new one
        this.componentManager.remove(entity, prefabComp.type);
        this.componentManager.add(entity, prefabComp.type, componentData);
      } else {
        this.componentManager.add(entity, prefabComp.type, componentData);
      }
    }

    // Emit event
    this.emit('prefab:reverted', { instanceId });
  }

  /**
   * Update prefab definition
   */
  updatePrefab(prefabId: string, changes: Partial<PrefabDefinition>): void {
    const prefab = this.prefabs.get(prefabId);
    if (!prefab) {
      throw new Error(`Prefab not found: ${prefabId}`);
    }

    // Update metadata
    if (changes.metadata) {
      prefab.metadata = {
        ...prefab.metadata,
        ...changes.metadata,
        lastModified: new Date()
      };
    }

    // Update components
    if (changes.components) {
      prefab.components = changes.components;
    }

    // Update children
    if (changes.children !== undefined) {
      prefab.children = changes.children;
    }

    // Update default values
    if (changes.defaultValues) {
      prefab.defaultValues = {
        ...prefab.defaultValues,
        ...changes.defaultValues
      };
    }

    // Emit event
    this.emit('prefab:updated', { prefabId, changes });

    // Update all instances
    this.updateAllInstances(prefabId);
  }

  /**
   * Delete a prefab
   */
  deletePrefab(prefabId: string): void {
    const prefab = this.prefabs.get(prefabId);
    if (!prefab) {
      throw new Error(`Prefab not found: ${prefabId}`);
    }

    // Check for instances
    const instances = Array.from(this.instances.values())
      .filter(inst => inst.prefabId === prefabId);
    
    if (instances.length > 0) {
      throw new Error(`Cannot delete prefab: ${instances.length} instances exist`);
    }

    // Delete prefab
    this.prefabs.delete(prefabId);

    // Emit event
    this.emit('prefab:deleted', { prefabId });
  }

  /**
   * Get all prefabs
   */
  getAllPrefabs(): PrefabDefinition[] {
    return Array.from(this.prefabs.values());
  }

  /**
   * Get prefab by ID
   */
  getPrefab(prefabId: string): PrefabDefinition | undefined {
    return this.prefabs.get(prefabId);
  }

  /**
   * Check if entity is a prefab instance
   */
  isPrefabInstance(entityId: EntityId): boolean {
    return this.entityToPrefab.has(entityId);
  }

  /**
   * Get prefab instance info
   */
  getPrefabInstance(entityId: EntityId): PrefabInstance | undefined {
    const instanceId = this.entityToPrefab.get(entityId);
    if (!instanceId) return undefined;
    
    return this.instances.get(instanceId);
  }

  /**
   * Get prefab overrides for an entity
   */
  getOverrides(entityId: EntityId): PrefabOverride[] {
    const instance = this.getPrefabInstance(entityId);
    return instance ? instance.overrides : [];
  }

  /**
   * Add override to instance
   */
  addOverride(entityId: EntityId, override: PrefabOverride): void {
    const instance = this.getPrefabInstance(entityId);
    if (!instance) {
      throw new Error('Entity is not a prefab instance');
    }

    // Remove existing override for same path
    instance.overrides = instance.overrides.filter(o => o.path !== override.path);
    
    // Add new override
    instance.overrides.push(override);
  }

  /**
   * Remove override from instance
   */
  removeOverride(entityId: EntityId, path: string): void {
    const instance = this.getPrefabInstance(entityId);
    if (!instance) {
      throw new Error('Entity is not a prefab instance');
    }

    instance.overrides = instance.overrides.filter(o => o.path !== path);
  }

  /**
   * Clone component data
   */
  private cloneComponentData(data: any): any {
    return JSON.parse(JSON.stringify(data));
  }

  /**
   * Apply override to component data
   */
  private applyOverride(componentData: any, override: PrefabOverride): void {
    const pathParts = override.path.split('.');
    let target = componentData;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!target[part]) {
        target[part] = {};
      }
      target = target[part];
    }
    
    const lastPart = pathParts[pathParts.length - 1];
    target[lastPart] = override.value;
  }

  /**
   * Update all instances of a prefab
   */
  private updateAllInstances(prefabId: string, excludeInstanceId?: string): void {
    const instances = Array.from(this.instances.values())
      .filter(inst => inst.prefabId === prefabId && inst.id !== excludeInstanceId);

    for (const instance of instances) {
      const entity = this.entityManager.get(instance.entityId);
      if (entity) {
        this.revertToPrefab(instance.entityId);
      }
    }
  }

  /**
   * Instantiate child prefab
   */
  private instantiateChild(
    parent: Entity,
    childDef: PrefabChild,
    parentInstance: PrefabInstance
  ): void {
    // Implementation for instantiating child prefabs
    // This would create child entities and maintain parent-child relationships
  }

  /**
   * Generate prefab ID
   */
  private generatePrefabId(): string {
    return `prefab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate instance ID
   */
  private generateInstanceId(): string {
    return `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export prefab to JSON
   */
  exportPrefab(prefabId: string): string {
    const prefab = this.prefabs.get(prefabId);
    if (!prefab) {
      throw new Error(`Prefab not found: ${prefabId}`);
    }

    return JSON.stringify(prefab, null, 2);
  }

  /**
   * Import prefab from JSON
   */
  importPrefab(jsonData: string): PrefabDefinition {
    const data = JSON.parse(jsonData);
    
    // Validate prefab data
    if (!data.metadata || !data.components) {
      throw new Error('Invalid prefab data');
    }

    // Generate new ID
    const prefabId = this.generatePrefabId();
    data.metadata.id = prefabId;
    data.metadata.createdAt = new Date(data.metadata.createdAt);
    data.metadata.lastModified = new Date();

    // Store prefab
    this.prefabs.set(prefabId, data);

    // Emit event
    this.emit('prefab:created', { prefab: data });

    return data;
  }

  /**
   * Get prefab statistics
   */
  getStats(): {
    totalPrefabs: number;
    totalInstances: number;
    prefabsByCategory: Record<string, number>;
    mostUsedPrefabs: Array<{ prefabId: string; count: number }>;
  } {
    const stats = {
      totalPrefabs: this.prefabs.size,
      totalInstances: this.instances.size,
      prefabsByCategory: {} as Record<string, number>,
      mostUsedPrefabs: [] as Array<{ prefabId: string; count: number }>
    };

    // Count by category
    for (const prefab of this.prefabs.values()) {
      const category = prefab.metadata.category || 'Uncategorized';
      stats.prefabsByCategory[category] = (stats.prefabsByCategory[category] || 0) + 1;
    }

    // Count instances per prefab
    const instanceCounts = new Map<string, number>();
    for (const instance of this.instances.values()) {
      const count = instanceCounts.get(instance.prefabId) || 0;
      instanceCounts.set(instance.prefabId, count + 1);
    }

    // Get most used
    stats.mostUsedPrefabs = Array.from(instanceCounts.entries())
      .map(([prefabId, count]) => ({ prefabId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }
}