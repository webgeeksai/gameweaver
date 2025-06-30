/**
 * Component implementation for the Entity Component System
 * Components are pure data containers attached to entities
 */

import { ComponentId, ComponentType, EntityId } from '../types';

export interface Component {
  readonly id: ComponentId;
  readonly type: ComponentType;
  readonly entityId: EntityId;
  active: boolean;
  data: any;
}

export class BaseComponent implements Component {
  readonly id: ComponentId;
  readonly type: ComponentType;
  readonly entityId: EntityId;
  active: boolean;
  data: any;
  
  constructor(id: ComponentId, type: ComponentType, entityId: EntityId, data: any) {
    this.id = id;
    this.type = type;
    this.entityId = entityId;
    this.active = true;
    this.data = data;
  }
  
  // Serialization
  toJSON(): any {
    return {
      id: this.id,
      type: this.type,
      entityId: this.entityId,
      active: this.active,
      data: this.data
    };
  }
}

// Transform component
export interface TransformData {
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
  
  // World transform (calculated)
  worldPosition?: { x: number; y: number };
  worldRotation?: number;
  worldScale?: { x: number; y: number };
  
  // Transform matrices
  localMatrix?: number[];
  worldMatrix?: number[];
  
  // Dirty flags for optimization
  localDirty?: boolean;
  worldDirty?: boolean;
  
  // Transform hierarchy
  parentTransform?: ComponentId;
}

export class TransformComponent extends BaseComponent {
  constructor(id: ComponentId, entityId: EntityId, data: Partial<TransformData> = {}) {
    super(id, ComponentType.Transform, entityId, {
      position: data.position || { x: 0, y: 0 },
      rotation: data.rotation || 0,
      scale: data.scale || { x: 1, y: 1 },
      worldPosition: data.worldPosition || { x: 0, y: 0 },
      worldRotation: data.worldRotation || 0,
      worldScale: data.worldScale || { x: 1, y: 1 },
      localMatrix: data.localMatrix || null,
      worldMatrix: data.worldMatrix || null,
      localDirty: true,
      worldDirty: true,
      parentTransform: data.parentTransform
    });
  }
}

// Sprite component
export interface SpriteData {
  texture: string;
  frame?: string | number;
  
  // Visual properties
  tint: number;
  alpha: number;
  visible: boolean;
  
  // Flipping
  flipX: boolean;
  flipY: boolean;
  
  // Origin point (0-1 normalized)
  originX: number;
  originY: number;
  
  // Rendering
  renderOrder: number;
  blendMode: number;
  
  // Animation state
  currentAnimation?: string;
  animationTime: number;
  animationSpeed: number;
  
  // Bounds (calculated)
  bounds?: { x: number; y: number; width: number; height: number };
  boundsDirty?: boolean;
}

export class SpriteComponent extends BaseComponent {
  constructor(id: ComponentId, entityId: EntityId, data: Partial<SpriteData> = {}) {
    super(id, ComponentType.Sprite, entityId, {
      texture: data.texture || '',
      frame: data.frame,
      tint: data.tint || 0xffffff,
      alpha: data.alpha !== undefined ? data.alpha : 1,
      visible: data.visible !== undefined ? data.visible : true,
      flipX: data.flipX || false,
      flipY: data.flipY || false,
      originX: data.originX !== undefined ? data.originX : 0.5,
      originY: data.originY !== undefined ? data.originY : 0.5,
      renderOrder: data.renderOrder || 0,
      blendMode: data.blendMode || 0,
      currentAnimation: data.currentAnimation,
      animationTime: data.animationTime || 0,
      animationSpeed: data.animationSpeed || 1,
      bounds: data.bounds || { x: 0, y: 0, width: 0, height: 0 },
      boundsDirty: true
    });
  }
}

// Physics component
export interface PhysicsData {
  // Physics mode
  mode: string;
  
  // Motion properties
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  angularVelocity: number;
  angularAcceleration: number;
  
  // Physical properties
  mass: number;
  friction: number;
  bounce: number;
  drag: number;
  angularDrag: number;
  
  // Gravity
  gravity: { x: number; y: number } | null;
  gravityScale: number;
  
  // Constraints
  maxVelocity: { x: number; y: number };
  maxAngularVelocity: number;
  
  // State flags
  grounded: boolean;
  sleeping: boolean;
  
  // Contact information
  touching: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
  
  // Forces applied this frame
  forces: Array<{ x: number; y: number }>;
  impulses: Array<{ x: number; y: number }>;
}

export class PhysicsComponent extends BaseComponent {
  constructor(id: ComponentId, entityId: EntityId, data: Partial<PhysicsData> = {}) {
    super(id, ComponentType.Physics, entityId, {
      mode: data.mode || 'dynamic',
      velocity: data.velocity || { x: 0, y: 0 },
      acceleration: data.acceleration || { x: 0, y: 0 },
      angularVelocity: data.angularVelocity || 0,
      angularAcceleration: data.angularAcceleration || 0,
      mass: data.mass !== undefined ? data.mass : 1,
      friction: data.friction !== undefined ? data.friction : 0.1,
      bounce: data.bounce !== undefined ? data.bounce : 0,
      drag: data.drag !== undefined ? data.drag : 0.01,
      angularDrag: data.angularDrag !== undefined ? data.angularDrag : 0.01,
      gravity: data.gravity,
      gravityScale: data.gravityScale !== undefined ? data.gravityScale : 1,
      maxVelocity: data.maxVelocity || { x: 1000, y: 1000 },
      maxAngularVelocity: data.maxAngularVelocity || 10,
      grounded: data.grounded || false,
      sleeping: data.sleeping || false,
      touching: data.touching || { up: false, down: false, left: false, right: false },
      forces: data.forces || [],
      impulses: data.impulses || []
    });
  }
}

// Collider component
export interface ColliderData {
  // Shape definition
  shape: {
    type: 'rectangle' | 'circle' | 'polygon';
    width?: number;
    height?: number;
    radius?: number;
    vertices?: Array<{ x: number; y: number }>;
  };
  
  // Collision layers
  category: number;
  mask: number;
  
  // Collision properties
  isSensor: boolean;
  isTrigger: boolean;
  
  // Material properties
  friction: number;
  bounce: number;
  
  // Offset from transform
  offset: { x: number; y: number };
  
  // Bounds (calculated)
  bounds?: { x: number; y: number; width: number; height: number };
  
  // Collision state
  colliding: boolean;
  collidingWith: string[];
}

export class ColliderComponent extends BaseComponent {
  constructor(id: ComponentId, entityId: EntityId, data: Partial<ColliderData> = {}) {
    super(id, ComponentType.Collider, entityId, {
      shape: data.shape || { type: 'rectangle', width: 32, height: 32 },
      category: data.category !== undefined ? data.category : 1,
      mask: data.mask !== undefined ? data.mask : 0xFFFF,
      isSensor: data.isSensor || false,
      isTrigger: data.isTrigger || false,
      friction: data.friction !== undefined ? data.friction : 0.1,
      bounce: data.bounce !== undefined ? data.bounce : 0,
      offset: data.offset || { x: 0, y: 0 },
      bounds: data.bounds,
      colliding: data.colliding || false,
      collidingWith: data.collidingWith || []
    });
  }
}

// Component factory for creating components of different types
export class ComponentFactory {
  static createComponent(
    id: ComponentId, 
    type: ComponentType, 
    entityId: EntityId, 
    data: any
  ): Component {
    switch (type) {
      case ComponentType.Transform:
        return new TransformComponent(id, entityId, data);
      case ComponentType.Sprite:
        return new SpriteComponent(id, entityId, data);
      case ComponentType.Physics:
        return new PhysicsComponent(id, entityId, data);
      case ComponentType.Collider:
        return new ColliderComponent(id, entityId, data);
      default:
        return new BaseComponent(id, type, entityId, data);
    }
  }
  
  static createDefault(
    type: ComponentType, 
    entityId: EntityId, 
    id: ComponentId
  ): Component {
    switch (type) {
      case ComponentType.Transform:
        return new TransformComponent(id, entityId);
      case ComponentType.Sprite:
        return new SpriteComponent(id, entityId);
      case ComponentType.Physics:
        return new PhysicsComponent(id, entityId);
      case ComponentType.Collider:
        return new ColliderComponent(id, entityId);
      default:
        return new BaseComponent(id, type, entityId, {});
    }
  }
}