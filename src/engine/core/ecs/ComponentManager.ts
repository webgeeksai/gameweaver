/**
 * Component Manager for the Entity Component System
 * Handles component creation, destruction, and queries
 */

import { v4 as uuidv4 } from 'uuid';
import { ComponentId, ComponentType, EntityId } from '../types';
import { Component, ComponentFactory } from './Component';
import { Entity } from './Entity';
import { globalEventBus } from '../events/EventBus';
import { EventPriority, EventSource } from '../types';

export interface ComponentOperation {
  entity: Entity;
  type: ComponentType;
  data?: any;
}

export class ComponentManager {
  private components: Map<ComponentId, Component> = new Map();
  private componentPool: Map<ComponentType, Component[]> = new Map();
  private maxPoolSize: number = 50;
  
  // Component lifecycle
  add<T extends Component>(entity: Entity, type: ComponentType, data: any = {}): T {
    // Check if entity already has this component type
    if (entity.hasComponent(type)) {
      // Update existing component
      const componentId = entity.components.get(type)!;
      const component = this.components.get(componentId)!;
      
      // Merge data
      component.data = { ...component.data, ...data };
      
      // Emit component updated event
      globalEventBus.emit({
        type: 'component.updated',
        source: EventSource.System,
        timestamp: Date.now(),
        priority: EventPriority.Normal,
        data: {
          component: component.id,
          entity: entity.id,
          componentType: type
        }
      });
      
      return component as T;
    }
    
    // Create new component
    let component: Component;
    
    // Try to reuse a component from the pool
    const pool = this.componentPool.get(type) || [];
    if (pool.length > 0) {
      component = pool.pop()!;
      // Reset component
      component.active = true;
      component.data = { ...data };
    } else {
      // Create new component
      const id = uuidv4();
      component = ComponentFactory.createComponent(id, type, entity.id, data);
    }
    
    // Add to components map
    this.components.set(component.id, component);
    
    // Add reference to entity
    entity.components.set(type, component.id);
    
    // Emit component added event
    globalEventBus.emit({
      type: 'component.added',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        component: component.id,
        entity: entity.id,
        componentType: type
      }
    });
    
    return component as T;
  }
  
  remove(entity: Entity, type: ComponentType): void {
    const componentId = entity.components.get(type);
    if (!componentId) return;
    
    const component = this.components.get(componentId);
    if (!component) return;
    
    // Remove reference from entity
    entity.components.delete(type);
    
    // Remove from components map
    this.components.delete(componentId);
    
    // Add to pool if not full
    if (!this.componentPool.has(type)) {
      this.componentPool.set(type, []);
    }
    
    const pool = this.componentPool.get(type)!;
    if (pool.length < this.maxPoolSize) {
      // Reset component data
      component.active = false;
      pool.push(component);
    }
    
    // Emit component removed event
    globalEventBus.emit({
      type: 'component.removed',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: {
        component: componentId,
        entity: entity.id,
        componentType: type
      }
    });
  }
  
  get<T extends Component>(componentId: ComponentId): T | undefined {
    return this.components.get(componentId) as T | undefined;
  }
  
  getByEntity<T extends Component>(entity: Entity, type: ComponentType): T | undefined {
    const componentId = entity.components.get(type);
    if (!componentId) return undefined;
    return this.get<T>(componentId);
  }
  
  // Component queries
  getAll(): Component[] {
    return Array.from(this.components.values());
  }
  
  getAllOfType(type: ComponentType): Component[] {
    const result: Component[] = [];
    for (const component of this.components.values()) {
      if (component.type === type) {
        result.push(component);
      }
    }
    return result;
  }
  
  // Bulk operations
  addBulk(operations: ComponentOperation[]): void {
    operations.forEach(op => this.add(op.entity, op.type, op.data));
  }
  
  removeBulk(operations: ComponentOperation[]): void {
    operations.forEach(op => this.remove(op.entity, op.type));
  }
  
  // Utility methods
  getComponentCount(): number {
    return this.components.size;
  }
  
  getPoolSize(type: ComponentType): number {
    return this.componentPool.get(type)?.length || 0;
  }
  
  clearPool(type?: ComponentType): void {
    if (type) {
      this.componentPool.delete(type);
    } else {
      this.componentPool.clear();
    }
  }
  
  // Component data access helpers
  getComponentData<T>(entity: Entity, type: ComponentType): T | null {
    const component = this.getByEntity(entity, type);
    return component ? component.data as T : null;
  }
  
  setComponentData<T>(entity: Entity, type: ComponentType, data: Partial<T>): void {
    const component = this.getByEntity(entity, type);
    if (component) {
      component.data = { ...component.data, ...data };
      
      // Emit component updated event
      globalEventBus.emit({
        type: 'component.updated',
        source: EventSource.System,
        timestamp: Date.now(),
        priority: EventPriority.Normal,
        data: {
          component: component.id,
          entity: entity.id,
          componentType: type
        }
      });
    }
  }
}