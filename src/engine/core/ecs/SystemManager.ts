/**
 * System Manager for the Entity Component System
 * Manages system registration, execution, and entity queries
 */

import { ComponentType } from '../types';
import { Entity } from './Entity';
import { System, SystemPerformanceMetrics } from './System';
import { EntityManager } from './EntityManager';
import { ComponentManager } from './ComponentManager';

export class SystemManager {
  private systems: Map<string, System> = new Map();
  private updateOrder: System[] = [];
  private renderOrder: System[] = [];
  private entityManager: EntityManager;
  private componentManager: ComponentManager;
  
  constructor(entityManager: EntityManager, componentManager: ComponentManager) {
    this.entityManager = entityManager;
    this.componentManager = componentManager;
  }
  
  // System registration
  register(system: System): void {
    if (this.systems.has(system.name)) {
      console.warn(`System ${system.name} already registered. Replacing.`);
    }
    
    console.log(`SystemManager: Registering system ${system.name}, has render: ${typeof system.render === 'function'}`);
    this.systems.set(system.name, system);
    
    // Initialize the system
    system.initialize();
    
    // Rebuild update and render order
    this.rebuildExecutionOrder();
    console.log(`SystemManager: After registering ${system.name}, renderOrder has ${this.renderOrder.length} systems`);
  }
  
  unregister(systemName: string): void {
    const system = this.systems.get(systemName);
    if (!system) return;
    
    // Cleanup system
    system.cleanup();
    
    // Remove from systems map
    this.systems.delete(systemName);
    
    // Rebuild update and render order
    this.rebuildExecutionOrder();
  }
  
  get(systemName: string): System | undefined {
    return this.systems.get(systemName);
  }
  
  getAll(): System[] {
    return Array.from(this.systems.values());
  }
  
  // System execution
  update(deltaTime: number): void {
    for (const system of this.updateOrder) {
      const entities = this.getEntitiesForSystem(system);
      system.update(entities, deltaTime);
    }
  }
  
  render(renderer: any): void {
    console.log(`SystemManager: render() called with ${this.renderOrder.length} systems`);
    for (const system of this.renderOrder) {
      if (system.render) {
        const entities = this.getEntitiesForSystem(system);
        console.log(`SystemManager: Calling ${system.name}.render() with ${entities.length} entities`);
        system.render(entities, renderer);
      }
    }
  }
  
  // System ordering
  setSystemPriority(systemName: string, priority: number): void {
    const system = this.systems.get(systemName);
    if (!system) return;
    
    // Update priority
    (system as any).priority = priority;
    
    // Rebuild execution order
    this.rebuildExecutionOrder();
  }
  
  getSystemOrder(): string[] {
    return this.updateOrder.map(system => system.name);
  }
  
  // Entity queries
  getEntitiesForSystem(system: System): Entity[] {
    const allEntities = this.entityManager.getAll();
    
    // Filter entities that have all required components
    const filteredEntities = allEntities.filter(entity => {
      // Skip inactive or destroyed entities
      if (!entity.active || entity.destroyed) {
        return false;
      }
      
      // Check if entity has all required components
      const hasAllComponents = system.requiredComponents.every(type => entity.hasComponent(type));
      
      if (system.name === 'RenderingSystem') {
        console.log(`Entity ${entity.name} - Transform: ${entity.hasComponent(ComponentType.Transform)}, Sprite: ${entity.hasComponent(ComponentType.Sprite)}, Active: ${entity.active}`);
      }
      
      return hasAllComponents;
    });
    
    if (system.name === 'RenderingSystem') {
      console.log(`RenderingSystem: Found ${filteredEntities.length} out of ${allEntities.length} total entities`);
    }
    
    return filteredEntities;
  }
  
  getSystemsForEntity(entity: Entity): System[] {
    return this.updateOrder.filter(system => {
      return system.requiredComponents.every(type => entity.hasComponent(type));
    });
  }
  
  // Performance metrics
  getSystemPerformance(): Map<string, SystemPerformanceMetrics> {
    const metrics = new Map<string, SystemPerformanceMetrics>();
    
    for (const system of this.systems.values()) {
      metrics.set(system.name, system.getPerformanceMetrics());
    }
    
    return metrics;
  }
  
  // Private methods
  private rebuildExecutionOrder(): void {
    // Sort systems by priority (higher priority first)
    const sortedSystems = Array.from(this.systems.values())
      .sort((a, b) => b.priority - a.priority);
    
    this.updateOrder = sortedSystems;
    
    // Filter systems with render method for render order
    this.renderOrder = sortedSystems.filter(system => typeof system.render === 'function');
  }
}