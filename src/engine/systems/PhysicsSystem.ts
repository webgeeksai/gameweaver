/**
 * Physics System for handling entity movement and collisions
 * Supports multiple physics modes for different game types
 */

import { BaseSystem } from '../core/ecs/System';
import { ComponentType, PhysicsMode } from '../core/types';
import { Entity } from '../core/ecs/Entity';
import { ComponentManager } from '../core/ecs/ComponentManager';
import { PhysicsComponent, TransformComponent, ColliderComponent } from '../core/ecs/Component';
import { Vector2 } from '../core/math/Vector2';
import { Rectangle } from '../core/math/Rectangle';
import { globalEventBus } from '../core/events/EventBus';
import { EventPriority, EventSource } from '../core/types';

export interface Collision {
  entityA: string;
  entityB: string;
  point: Vector2;
  normal: Vector2;
  penetration: number;
}

export class PhysicsSystem extends BaseSystem {
  private componentManager: ComponentManager;
  private gravity: Vector2 = new Vector2(0, 0); // Default no gravity - games can enable it explicitly
  private spatialGrid: Map<string, Set<Entity>> = new Map();
  private cellSize: number = 64;
  private debugDraw: boolean = false;
  
  constructor(componentManager: ComponentManager) {
    super(
      'PhysicsSystem',
      150, // Between transform and rendering
      [ComponentType.Transform, ComponentType.Physics]
    );
    this.componentManager = componentManager;
  }
  
  initialize(): void {
    console.log('PhysicsSystem initialized');
  }
  
  protected processEntities(entities: Entity[], deltaTime: number): void {
    try {
      // Reset spatial grid
      this.spatialGrid.clear();
      
      // Reset collision states
      this.resetCollisionStates(entities);
      
      // First pass: Update velocities and build spatial grid
      for (const entity of entities) {
        this.updatePhysics(entity, deltaTime);
        this.addToSpatialGrid(entity);
      }
      
      // Second pass: Detect and resolve collisions
      const collisions = this.detectCollisions(entities);
      this.resolveCollisions(collisions);
      
      // Third pass: Update positions
      for (const entity of entities) {
        this.updatePosition(entity, deltaTime);
      }
    } catch (error) {
      console.error("PhysicsSystem: Error in processEntities", error);
    }
  }
  
  private resetCollisionStates(entities: Entity[]): void {
    for (const entity of entities) {
      const collider = this.componentManager.getByEntity<ColliderComponent>(entity, ComponentType.Collider);
      if (collider) {
        collider.data.colliding = false;
        collider.data.collidingWith = [];
      }
      
      const physics = this.componentManager.getByEntity<PhysicsComponent>(entity, ComponentType.Physics);
      if (physics) {
        physics.data.touching = {
          up: false,
          down: false,
          left: false,
          right: false
        };
        
        // Reset grounded state (will be set again if touching ground)
        if (physics.data.mode === 'platformer') {
          physics.data.grounded = false;
        }
      }
    }
  }
  
  private updatePhysics(entity: Entity, deltaTime: number): void {
    const physics = this.componentManager.getByEntity<PhysicsComponent>(entity, ComponentType.Physics);
    if (!physics || physics.data.mode === 'static') return;
    
    // Apply gravity if applicable
    if (physics.data.mode !== 'topdown' && physics.data.gravity !== null) {
      const gravityForce = physics.data.gravity 
        ? new Vector2(physics.data.gravity.x, physics.data.gravity.y)
        : Vector2.multiply(this.gravity, physics.data.gravityScale || 1);
      
      physics.data.velocity.y += gravityForce.y * deltaTime;
      physics.data.velocity.x += gravityForce.x * deltaTime;
    }
    
    // Apply forces
    for (const force of physics.data.forces) {
      const acceleration = new Vector2(force.x / physics.data.mass, force.y / physics.data.mass);
      physics.data.velocity.x += acceleration.x * deltaTime;
      physics.data.velocity.y += acceleration.y * deltaTime;
    }
    
    // Apply impulses
    for (const impulse of physics.data.impulses) {
      const velocityChange = new Vector2(impulse.x / physics.data.mass, impulse.y / physics.data.mass);
      physics.data.velocity.x += velocityChange.x;
      physics.data.velocity.y += velocityChange.y;
    }
    
    // Apply drag
    physics.data.velocity.x *= Math.pow(1 - physics.data.drag, deltaTime);
    physics.data.velocity.y *= Math.pow(1 - physics.data.drag, deltaTime);
    
    // Clamp velocity
    physics.data.velocity.x = Math.max(-physics.data.maxVelocity.x, Math.min(physics.data.maxVelocity.x, physics.data.velocity.x));
    physics.data.velocity.y = Math.max(-physics.data.maxVelocity.y, Math.min(physics.data.maxVelocity.y, physics.data.velocity.y));
    
    // Clear forces and impulses
    physics.data.forces = [];
    physics.data.impulses = [];
  }
  
  private updatePosition(entity: Entity, deltaTime: number): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    const physics = this.componentManager.getByEntity<PhysicsComponent>(entity, ComponentType.Physics);
    
    if (!transform || !physics || physics.data.mode === 'static') return;
    
    // Update position based on velocity
    transform.data.position.x += physics.data.velocity.x * deltaTime;
    transform.data.position.y += physics.data.velocity.y * deltaTime;
    
    // Mark transform as dirty
    transform.data.localDirty = true;
  }
  
  private addToSpatialGrid(entity: Entity): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    const collider = this.componentManager.getByEntity<ColliderComponent>(entity, ComponentType.Collider);
    
    if (!transform || !collider) return;
    
    // Calculate entity bounds
    const bounds = this.calculateEntityBounds(entity);
    
    // Get grid cells that this entity overlaps
    const cells = this.getCellsForBounds(bounds);
    
    // Add entity to each cell
    for (const cell of cells) {
      if (!this.spatialGrid.has(cell)) {
        this.spatialGrid.set(cell, new Set());
      }
      this.spatialGrid.get(cell)!.add(entity);
    }
  }
  
  private getCellsForBounds(bounds: Rectangle): string[] {
    const cells: string[] = [];
    
    const minCellX = Math.floor(bounds.x / this.cellSize);
    const minCellY = Math.floor(bounds.y / this.cellSize);
    const maxCellX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const maxCellY = Math.floor((bounds.y + bounds.height) / this.cellSize);
    
    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        cells.push(`${x},${y}`);
      }
    }
    
    return cells;
  }
  
  private calculateEntityBounds(entity: Entity): Rectangle {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    const collider = this.componentManager.getByEntity<ColliderComponent>(entity, ComponentType.Collider);
    
    if (!transform || !collider) {
      return new Rectangle(0, 0, 0, 0);
    }
    
    const position = new Vector2(transform.data.position.x, transform.data.position.y);
    
    // Use collider shape to determine bounds
    if (collider.data.shape.type === 'rectangle') {
      const width = collider.data.shape.width || 32;
      const height = collider.data.shape.height || 32;
      
      return new Rectangle(
        position.x - width / 2 + collider.data.offset.x,
        position.y - height / 2 + collider.data.offset.y,
        width,
        height
      );
    } else if (collider.data.shape.type === 'circle') {
      const radius = collider.data.shape.radius || 16;
      
      return new Rectangle(
        position.x - radius + collider.data.offset.x,
        position.y - radius + collider.data.offset.y,
        radius * 2,
        radius * 2
      );
    }
    
    // Default bounds
    return new Rectangle(position.x - 16, position.y - 16, 32, 32);
  }
  
  private detectCollisions(entities: Entity[]): Collision[] {
    const collisions: Collision[] = [];
    const checkedPairs = new Set<string>();
    
    // Check each entity against potential collision candidates
    for (const entity of entities) {
      const candidates = this.getPotentialCollisionCandidates(entity);
      
      for (const candidate of candidates) {
        // Skip self-collision
        if (entity.id === candidate.id) continue;
        
        // Create a unique pair ID to avoid checking the same pair twice
        const pairId = [entity.id, candidate.id].sort().join('_');
        if (checkedPairs.has(pairId)) continue;
        checkedPairs.add(pairId);
        
        // Check for collision
        const collision = this.checkCollision(entity, candidate);
        if (collision) {
          collisions.push(collision);
        }
      }
    }
    
    return collisions;
  }
  
  private getPotentialCollisionCandidates(entity: Entity): Entity[] {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    const collider = this.componentManager.getByEntity<ColliderComponent>(entity, ComponentType.Collider);
    
    if (!transform || !collider) return [];
    
    // Calculate entity bounds
    const bounds = this.calculateEntityBounds(entity);
    
    // Get grid cells that this entity overlaps
    const cells = this.getCellsForBounds(bounds);
    
    // Collect unique entities from these cells
    const candidates = new Set<Entity>();
    
    for (const cell of cells) {
      const cellEntities = this.spatialGrid.get(cell);
      if (cellEntities) {
        for (const candidate of cellEntities) {
          if (candidate.id !== entity.id) {
            candidates.add(candidate);
          }
        }
      }
    }
    
    return Array.from(candidates);
  }
  
  private checkCollision(entityA: Entity, entityB: Entity): Collision | null {
    const transformA = this.componentManager.getByEntity<TransformComponent>(entityA, ComponentType.Transform);
    const colliderA = this.componentManager.getByEntity<ColliderComponent>(entityA, ComponentType.Collider);
    
    const transformB = this.componentManager.getByEntity<TransformComponent>(entityB, ComponentType.Transform);
    const colliderB = this.componentManager.getByEntity<ColliderComponent>(entityB, ComponentType.Collider);
    
    if (!transformA || !colliderA || !transformB || !colliderB) return null;
    
    // Get entity bounds
    const boundsA = this.calculateEntityBounds(entityA);
    const boundsB = this.calculateEntityBounds(entityB);
    
    // Check for AABB intersection
    if (!boundsA.intersects(boundsB)) return null;
    
    // For now, just use simple AABB collision
    // In a full implementation, we would use more precise collision detection
    
    // Calculate collision normal and penetration
    const centerA = boundsA.center;
    const centerB = boundsB.center;
    
    const delta = new Vector2(centerB.x - centerA.x, centerB.y - centerA.y);
    
    // Calculate overlap on each axis
    const overlapX = (boundsA.width + boundsB.width) / 2 - Math.abs(delta.x);
    const overlapY = (boundsA.height + boundsB.height) / 2 - Math.abs(delta.y);
    
    // Use the smallest overlap to determine collision normal
    let normal: Vector2;
    let penetration: number;
    
    if (overlapX < overlapY) {
      normal = new Vector2(delta.x < 0 ? -1 : 1, 0);
      penetration = overlapX;
    } else {
      normal = new Vector2(0, delta.y < 0 ? -1 : 1);
      penetration = overlapY;
    }
    
    // Calculate collision point (approximate)
    const point = new Vector2(
      centerA.x + normal.x * (boundsA.width / 2),
      centerA.y + normal.y * (boundsA.height / 2)
    );
    
    return {
      entityA: entityA.id,
      entityB: entityB.id,
      point,
      normal,
      penetration
    };
  }
  
  private resolveCollisions(collisions: Collision[]): void {
    for (const collision of collisions) {
      this.resolveCollision(collision);
      
      // Emit collision event
      globalEventBus.emit({
        type: 'collision',
        source: EventSource.System,
        timestamp: Date.now(),
        priority: EventPriority.High,
        data: collision
      });
    }
  }
  
  private resolveCollision(collision: Collision): void {
    const { entityA, entityB, normal, penetration } = collision;
    
    const entityObjA = this.getEntities().find(e => e.id === entityA);
    const entityObjB = this.getEntities().find(e => e.id === entityB);
    
    if (!entityObjA || !entityObjB) return;
    
    const physicsA = this.componentManager.getByEntity<PhysicsComponent>(entityObjA, ComponentType.Physics);
    const physicsB = this.componentManager.getByEntity<PhysicsComponent>(entityObjB, ComponentType.Physics);
    
    if (!physicsA || !physicsB) return;
    
    // Skip collision resolution if both entities are static
    if (physicsA.data.mode === 'static' && physicsB.data.mode === 'static') return;
    
    // Skip collision resolution if either collider is a sensor
    const colliderA = this.componentManager.getByEntity<ColliderComponent>(entityObjA, ComponentType.Collider);
    const colliderB = this.componentManager.getByEntity<ColliderComponent>(entityObjB, ComponentType.Collider);
    
    if (!colliderA || !colliderB) return;
    
    if (colliderA.data.isSensor || colliderB.data.isSensor) {
      // Just update collision state for sensors
      this.updateCollisionState(entityObjA, entityObjB, normal);
      return;
    }
    
    // Position correction
    this.correctPosition(entityObjA, entityObjB, normal, penetration);
    
    // Velocity resolution
    this.resolveVelocity(entityObjA, entityObjB, normal);
    
    // Update collision state
    this.updateCollisionState(entityObjA, entityObjB, normal);
  }
  
  private correctPosition(entityA: Entity, entityB: Entity, normal: Vector2, penetration: number): void {
    const transformA = this.componentManager.getByEntity<TransformComponent>(entityA, ComponentType.Transform);
    const transformB = this.componentManager.getByEntity<TransformComponent>(entityB, ComponentType.Transform);
    
    const physicsA = this.componentManager.getByEntity<PhysicsComponent>(entityA, ComponentType.Physics);
    const physicsB = this.componentManager.getByEntity<PhysicsComponent>(entityB, ComponentType.Physics);
    
    if (!transformA || !transformB || !physicsA || !physicsB) return;
    
    // Calculate correction amount
    let percent = 0.2; // Penetration percentage to correct
    let correction = Vector2.multiply(normal, penetration * percent);
    
    // Apply correction based on physics modes
    if (physicsA.data.mode === 'static') {
      // A is static, move only B
      transformB.data.position.x += correction.x;
      transformB.data.position.y += correction.y;
      transformB.data.localDirty = true;
    } else if (physicsB.data.mode === 'static') {
      // B is static, move only A
      transformA.data.position.x -= correction.x;
      transformA.data.position.y -= correction.y;
      transformA.data.localDirty = true;
    } else {
      // Both dynamic, split the correction
      transformA.data.position.x -= correction.x * 0.5;
      transformA.data.position.y -= correction.y * 0.5;
      transformA.data.localDirty = true;
      
      transformB.data.position.x += correction.x * 0.5;
      transformB.data.position.y += correction.y * 0.5;
      transformB.data.localDirty = true;
    }
  }
  
  private resolveVelocity(entityA: Entity, entityB: Entity, normal: Vector2): void {
    const physicsA = this.componentManager.getByEntity<PhysicsComponent>(entityA, ComponentType.Physics);
    const physicsB = this.componentManager.getByEntity<PhysicsComponent>(entityB, ComponentType.Physics);
    
    if (!physicsA || !physicsB) return;
    
    // Skip velocity resolution for static objects
    if (physicsA.data.mode === 'static' && physicsB.data.mode === 'static') return;
    
    // Calculate relative velocity
    const relativeVelocity = new Vector2(
      physicsB.data.velocity.x - physicsA.data.velocity.x,
      physicsB.data.velocity.y - physicsA.data.velocity.y
    );
    
    // Calculate relative velocity along the normal
    const velocityAlongNormal = relativeVelocity.x * normal.x + relativeVelocity.y * normal.y;
    
    // Do not resolve if velocities are separating
    if (velocityAlongNormal > 0) return;
    
    // Calculate restitution (bounce)
    const restitution = Math.min(physicsA.data.bounce || 0, physicsB.data.bounce || 0);
    
    // Calculate impulse scalar
    let j = -(1 + restitution) * velocityAlongNormal;
    j /= (physicsA.data.mode !== 'static' ? 1 / physicsA.data.mass : 0) + 
         (physicsB.data.mode !== 'static' ? 1 / physicsB.data.mass : 0);
    
    // Apply impulse
    const impulse = new Vector2(j * normal.x, j * normal.y);
    
    if (physicsA.data.mode !== 'static') {
      physicsA.data.velocity.x -= impulse.x / physicsA.data.mass;
      physicsA.data.velocity.y -= impulse.y / physicsA.data.mass;
    }
    
    if (physicsB.data.mode !== 'static') {
      physicsB.data.velocity.x += impulse.x / physicsB.data.mass;
      physicsB.data.velocity.y += impulse.y / physicsB.data.mass;
    }
  }
  
  private updateCollisionState(entityA: Entity, entityB: Entity, normal: Vector2): void {
    const colliderA = this.componentManager.getByEntity<ColliderComponent>(entityA, ComponentType.Collider);
    const colliderB = this.componentManager.getByEntity<ColliderComponent>(entityB, ComponentType.Collider);
    
    if (!colliderA || !colliderB) return;
    
    // Update collision state
    colliderA.data.colliding = true;
    colliderB.data.colliding = true;
    
    // Add to colliding with list
    if (!colliderA.data.collidingWith.includes(entityB.id)) {
      colliderA.data.collidingWith.push(entityB.id);
    }
    
    if (!colliderB.data.collidingWith.includes(entityA.id)) {
      colliderB.data.collidingWith.push(entityA.id);
    }
    
    // Update touching flags
    const physicsA = this.componentManager.getByEntity<PhysicsComponent>(entityA, ComponentType.Physics);
    if (physicsA) {
      if (normal.y < -0.5) physicsA.data.touching.up = true;
      if (normal.y > 0.5) physicsA.data.touching.down = true;
      if (normal.x < -0.5) physicsA.data.touching.left = true;
      if (normal.x > 0.5) physicsA.data.touching.right = true;
      
      // Update grounded state for platformer physics
      if (physicsA.data.mode === 'platformer' && normal.y > 0.5) {
        physicsA.data.grounded = true;
      }
    }
    
    const physicsB = this.componentManager.getByEntity<PhysicsComponent>(entityB, ComponentType.Physics);
    if (physicsB) {
      if (normal.y > 0.5) physicsB.data.touching.up = true;
      if (normal.y < -0.5) physicsB.data.touching.down = true;
      if (normal.x > 0.5) physicsB.data.touching.left = true;
      if (normal.x < -0.5) physicsB.data.touching.right = true;
      
      // Update grounded state for platformer physics
      if (physicsB.data.mode === 'platformer' && normal.y < -0.5) {
        physicsB.data.grounded = true;
      }
    }
  }
  
  // Debug rendering
  renderDebug(ctx: CanvasRenderingContext2D, camera: any): void {
    if (!this.debugDraw) return;
    
    // Save context state
    ctx.save();
    
    // Draw spatial grid
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.lineWidth = 1;
    
    const viewportWidth = ctx.canvas.width;
    const viewportHeight = ctx.canvas.height;
    
    // Calculate visible grid cells
    const minCellX = Math.floor((camera.position.x - viewportWidth / 2) / this.cellSize);
    const minCellY = Math.floor((camera.position.y - viewportHeight / 2) / this.cellSize);
    const maxCellX = Math.ceil((camera.position.x + viewportWidth / 2) / this.cellSize);
    const maxCellY = Math.ceil((camera.position.y + viewportHeight / 2) / this.cellSize);
    
    // Draw grid lines
    for (let x = minCellX; x <= maxCellX; x++) {
      const screenX = (x * this.cellSize - camera.position.x) * camera.zoom + viewportWidth / 2;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, viewportHeight);
      ctx.stroke();
    }
    
    for (let y = minCellY; y <= maxCellY; y++) {
      const screenY = (y * this.cellSize - camera.position.y) * camera.zoom + viewportHeight / 2;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(viewportWidth, screenY);
      ctx.stroke();
    }
    
    // Draw collision shapes
    const entities = this.getEntities();
    
    for (const entity of entities) {
      const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
      const collider = this.componentManager.getByEntity<ColliderComponent>(entity, ComponentType.Collider);
      
      if (!transform || !collider) continue;
      
      const position = new Vector2(transform.data.position.x, transform.data.position.y);
      const screenX = (position.x - camera.position.x) * camera.zoom + viewportWidth / 2;
      const screenY = (position.y - camera.position.y) * camera.zoom + viewportHeight / 2;
      
      // Draw different colors based on collision state
      if (collider.data.colliding) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      } else {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
      }
      
      ctx.lineWidth = 2;
      
      // Draw shape based on type
      if (collider.data.shape.type === 'rectangle') {
        const width = collider.data.shape.width || 32;
        const height = collider.data.shape.height || 32;
        
        ctx.beginPath();
        ctx.rect(
          screenX - (width / 2) * camera.zoom,
          screenY - (height / 2) * camera.zoom,
          width * camera.zoom,
          height * camera.zoom
        );
        ctx.stroke();
      } else if (collider.data.shape.type === 'circle') {
        const radius = collider.data.shape.radius || 16;
        
        ctx.beginPath();
        ctx.arc(
          screenX,
          screenY,
          radius * camera.zoom,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      
      // Draw velocity vector for dynamic objects
      const physics = this.componentManager.getByEntity<PhysicsComponent>(entity, ComponentType.Physics);
      if (physics && physics.data.mode !== 'static') {
        const velocity = new Vector2(physics.data.velocity.x, physics.data.velocity.y);
        const speed = velocity.magnitude();
        
        if (speed > 0.1) {
          const normalizedVelocity = Vector2.normalize(velocity);
          const lineLength = Math.min(speed * 0.1, 50) * camera.zoom;
          
          ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(
            screenX + normalizedVelocity.x * lineLength,
            screenY + normalizedVelocity.y * lineLength
          );
          ctx.stroke();
        }
      }
    }
    
    // Restore context state
    ctx.restore();
  }
  
  // Public API
  setGravity(x: number, y: number): void {
    this.gravity = new Vector2(x, y);
  }
  
  applyForce(entity: Entity, force: Vector2): void {
    const physics = this.componentManager.getByEntity<PhysicsComponent>(entity, ComponentType.Physics);
    if (!physics) return;
    
    physics.data.forces.push({ x: force.x, y: force.y });
  }
  
  applyImpulse(entity: Entity, impulse: Vector2): void {
    const physics = this.componentManager.getByEntity<PhysicsComponent>(entity, ComponentType.Physics);
    if (!physics) return;
    
    physics.data.impulses.push({ x: impulse.x, y: impulse.y });
  }
  
  setVelocity(entity: Entity, velocity: Vector2): void {
    const physics = this.componentManager.getByEntity<PhysicsComponent>(entity, ComponentType.Physics);
    if (!physics) return;
    
    physics.data.velocity.x = velocity.x;
    physics.data.velocity.y = velocity.y;
  }
  
  isGrounded(entity: Entity): boolean {
    const physics = this.componentManager.getByEntity<PhysicsComponent>(entity, ComponentType.Physics);
    if (!physics) return false;
    
    return physics.data.touching.down || physics.data.grounded;
  }
  
  setDebugDraw(enabled: boolean): void {
    this.debugDraw = enabled;
  }
  
  getDebugDraw(): boolean {
    return this.debugDraw;
  }
}