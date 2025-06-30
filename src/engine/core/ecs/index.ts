/**
 * Entity Component System (ECS) module exports
 */

// Entity
export { Entity, EntityDefinition, ComponentDefinition } from './Entity';
export { EntityManager } from './EntityManager';

// Component
export { 
  Component, 
  BaseComponent, 
  TransformComponent, 
  SpriteComponent, 
  PhysicsComponent, 
  ColliderComponent,
  ComponentFactory 
} from './Component';
export { ComponentManager, ComponentOperation } from './ComponentManager';

// System
export { System, BaseSystem } from './System';
export { SystemManager } from './SystemManager';