/**
 * Behavior system for the Game Vibe Engine
 * Provides a component-based approach to entity behaviors
 */

import { Entity } from '../ecs/Entity';
import { EventBus, GameEvent } from '../events/EventBus';
import { ComponentType } from '../types';

export interface BehaviorDefinition {
  name: string;
  properties: Record<string, any>;
  methods: Record<string, Function>;
  update?: (entity: Entity, deltaTime: number) => void;
  initialize?: (entity: Entity) => void;
  destroy?: (entity: Entity) => void;
}

export class Behavior {
  readonly name: string;
  readonly entity: Entity;
  
  // State and properties
  state: Record<string, any> = {};
  
  // Event subscriptions
  private eventSubscriptions: Map<string, Function> = new Map();
  
  constructor(name: string, entity: Entity, properties: Record<string, any> = {}) {
    this.name = name;
    this.entity = entity;
    this.state = { ...properties };
  }
  
  // Behavior lifecycle
  initialize(): void {
    // Default implementation does nothing
  }
  
  update(deltaTime: number): void {
    // Default implementation does nothing
  }
  
  destroy(): void {
    // Unsubscribe from all events
    this.unsubscribeAll();
  }
  
  // Event handling
  on(eventType: string, handler: (event: GameEvent) => void, eventBus: EventBus): void {
    const boundHandler = handler.bind(this);
    this.eventSubscriptions.set(eventType, boundHandler);
    eventBus.on(eventType, boundHandler);
  }
  
  off(eventType: string, eventBus: EventBus): void {
    const handler = this.eventSubscriptions.get(eventType);
    if (handler) {
      eventBus.off(eventType, handler as any);
      this.eventSubscriptions.delete(eventType);
    }
  }
  
  unsubscribeAll(eventBus?: EventBus): void {
    if (eventBus) {
      for (const [eventType, handler] of this.eventSubscriptions) {
        eventBus.off(eventType, handler as any);
      }
    }
    this.eventSubscriptions.clear();
  }
  
  // Property access
  getProperty<T>(key: string, defaultValue?: T): T {
    return this.state[key] !== undefined ? this.state[key] : defaultValue;
  }
  
  setProperty<T>(key: string, value: T): void {
    this.state[key] = value;
  }
  
  // Entity component access helpers
  getComponent<T>(type: ComponentType): T | null {
    const componentId = this.entity.components.get(type);
    if (!componentId) return null;
    
    // This would normally use the component manager
    // For now, we'll return null as a placeholder
    return null;
  }
  
  // Utility methods
  isActive(): boolean {
    return this.entity.active;
  }
  
  toString(): string {
    return `Behavior(${this.name}, entity=${this.entity.name})`;
  }
}