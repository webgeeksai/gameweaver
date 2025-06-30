/**
 * Game Vibe Engine - Standalone Engine Package
 * 
 * This is the main entry point for the Game Vibe Engine core.
 * The engine is UI-agnostic and can be used in various environments:
 * - VS Code extensions
 * - Web applications  
 * - Node.js applications
 * - Command-line tools
 */

// Core Engine
export { GameEngine, GameEngineOptions } from './core/GameEngine';

// ECS System
export { EntityManager } from './core/ecs/EntityManager';
export { ComponentManager } from './core/ecs/ComponentManager';
export { SystemManager } from './core/ecs/SystemManager';
export { Entity, EntityDefinition } from './core/ecs/Entity';
export { 
  Component, 
  BaseComponent,
  TransformComponent,
  SpriteComponent,
  PhysicsComponent,
  ColliderComponent,
  ComponentFactory
} from './core/ecs/Component';
export { System, BaseSystem } from './core/ecs/System';

// Game Systems
export { TransformSystem } from './systems/TransformSystem';
export { RenderingSystem, CanvasRenderer, Camera } from './systems/RenderingSystem';
export { PhysicsSystem } from './systems/PhysicsSystem';
export { InputSystem } from './systems/InputSystem';
// BehaviorSystem and GameSystem temporarily excluded
// export { BehaviorSystem } from './systems/BehaviorSystem';
// export { GameSystem } from './systems/GameSystem';

// Scene Management
export { SceneManager } from './core/scene/SceneManager';
export { Scene, SceneDefinition, SceneConfig } from './core/scene/Scene';
export { SceneSystem } from './core/scene/SceneSystem';

// Behavior System
export { BehaviorManager } from './core/behavior/BehaviorManager';
export { Behavior } from './core/behavior/Behavior';

// Particle System
export { ParticleSystem } from './core/particles/ParticleSystem';

// Events
export { globalEventBus } from './core/events/EventBus';

// Math Utilities
export { Vector2 } from './core/math/Vector2';
export { Matrix3 } from './core/math/Matrix3';
export { Rectangle } from './core/math/Rectangle';

// Memory Management
export { ObjectPool } from './core/memory/ObjectPool';

// Utilities
export { IdGenerator } from './core/utils/IdGenerator';
export { PriorityQueue } from './core/utils/PriorityQueue';

// GDL Compiler (excluding AI components)
export { GDLCompiler, CompilerOptions } from './gdl/compiler';
export { GDLLexer } from './gdl/lexer';
export { GDLParser } from './gdl/parser';
export { SemanticAnalyzer } from './gdl/semantic';
export { CodeGenerator } from './gdl/codegen';
export * from './gdl/types';

// Behaviors temporarily excluded
// export * from './behaviors';

// Core Types
export * from './core/types';

// Version info
export const ENGINE_VERSION = '1.0.0';
export const ENGINE_NAME = 'Game Vibe Engine';