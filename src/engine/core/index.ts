/**
 * Core module exports
 */

// Types
export * from './types';

// Math
export { Vector2 } from './math/Vector2';
export { Rectangle } from './math/Rectangle';
export { Matrix3 } from './math/Matrix3';

// Memory
export { 
  ObjectPool, 
  PoolableObject, 
  PoolStats, 
  PoolManager, 
  poolManager 
} from './memory/ObjectPool';

// Events
export { 
  EventBus, 
  GameEvent, 
  EventListener, 
  globalEventBus 
} from './events/EventBus';

// Utils
export { PriorityQueue } from './utils/PriorityQueue';

// ECS
export * from './ecs';

// Behavior
export * from './behavior';

// Scene
export * from './scene';

// Audio
export * from './audio';

// Particles
export * from './particles';

// State Management
export * from './state';

// Asset Management
export * from './assets';

// Messaging System
export * from './messaging';

// Tilemap System
export * from './tilemap';