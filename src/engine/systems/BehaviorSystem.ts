/**
 * Enhanced Behavior System for the Game Vibe Engine
 * Manages and executes entity behaviors with proper input handling
 */

import { BaseSystem } from '../core/ecs/System';
import { Entity } from '../core/ecs/Entity';
import { ComponentType } from '../core/types';
import { GameEngine } from '../core/GameEngine';
import { EventBus } from '../core/events/EventBus';
import { Vector2 } from '../core/math/Vector2';

export class BehaviorSystem extends BaseSystem {
  private inputSystem: any;
  private eventBus: EventBus;
  private componentManager: any;

  constructor(engine: GameEngine) {
    super('BehaviorSystem', 2); // Run after physics
    this.inputSystem = engine.getInputSystem();
    this.componentManager = engine.getComponentManager();
    this.eventBus = EventBus.getInstance();
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const behavior = this.componentManager.getByEntity(entity, ComponentType.Behavior);
      const physics = this.componentManager.getByEntity(entity, ComponentType.Physics);
      const transform = this.componentManager.getByEntity(entity, ComponentType.Transform);

      if (!behavior || !behavior.data || !behavior.data.enabled) continue;
      if (!transform || !transform.data) {
        console.warn(`Entity ${entity.name} missing transform or transform.data`, { transform });
        continue;
      }

      switch (behavior.data.type) {
        case 'PlatformerMovement':
          this.updatePlatformerMovement(entity, behavior, physics, transform, deltaTime);
          break;
        
        case 'PatrolBehavior':
          this.updatePatrolBehavior(entity, behavior, physics, transform, deltaTime);
          break;
        
        case 'ChaseBehavior':
          this.updateChaseBehavior(entity, behavior, physics, transform, deltaTime);
          break;
        
        case 'CollectibleBehavior':
          this.updateCollectibleBehavior(entity, behavior, physics, transform, deltaTime);
          break;
      }
    }
  }

  /**
   * Enhanced platformer movement with better physics and input handling
   */
  private updatePlatformerMovement(entity: Entity, behavior: any, physics: any, transform: any, deltaTime: number): void {
    if (!physics || !transform || !physics.data || !transform.data) return;

    const config = {
      speed: 200,
      jumpPower: 400,
      acceleration: 1000,
      deceleration: 2000,
      airControl: 0.5,
      coyoteTime: 0.1,
      jumpBufferTime: 0.1,
      ...behavior.data.config
    };

    // Initialize behavior state if not present
    if (!behavior.data.state) {
      behavior.data.state = {
        coyoteTimer: 0,
        jumpBufferTimer: 0,
        lastGroundedTime: 0,
        wasGrounded: false
      };
    }

    const state = behavior.data.state;
    const isGrounded = physics.data.grounded;
    
    // Update coyote time (grace period after leaving ground)
    if (isGrounded) {
      state.coyoteTimer = config.coyoteTime;
      state.lastGroundedTime = 0;
      if (!state.wasGrounded) {
        // Just landed
        state.wasGrounded = true;
        this.eventBus.emit('player:landed', { entity: entity.id });
      }
    } else {
      state.coyoteTimer = Math.max(0, state.coyoteTimer - deltaTime);
      state.lastGroundedTime += deltaTime;
      state.wasGrounded = false;
    }

    // Update jump buffer
    state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - deltaTime);

    // Handle horizontal movement
    const leftPressed = this.inputSystem.isKeyPressed('KeyA') || this.inputSystem.isKeyPressed('ArrowLeft');
    const rightPressed = this.inputSystem.isKeyPressed('KeyD') || this.inputSystem.isKeyPressed('ArrowRight');
    const jumpPressed = this.inputSystem.isKeyPressed('Space');

    // Jump input buffering
    if (jumpPressed && state.jumpBufferTimer <= 0) {
      state.jumpBufferTimer = config.jumpBufferTime;
    }

    // Execute jump if conditions are met
    if (state.jumpBufferTimer > 0 && (isGrounded || state.coyoteTimer > 0)) {
      physics.data.velocity.y = -config.jumpPower;
      state.jumpBufferTimer = 0;
      state.coyoteTimer = 0;
      this.eventBus.emit('player:jumped', { entity: entity.id });
      
      // Create jump particle effect
      this.eventBus.emit('particles:create', {
        type: 'dust',
        position: { x: (transform.data.position?.x || 0), y: (transform.data.position?.y || 0) + 20 },
        count: 5
      });
    }

    // Horizontal movement
    const currentAcceleration = isGrounded ? config.acceleration : config.acceleration * config.airControl;
    
    if (leftPressed && !rightPressed) {
      // Move left
      physics.data.velocity.x = Math.max(
        physics.data.velocity.x - currentAcceleration * deltaTime,
        -config.speed
      );
      
      // Flip sprite
      const sprite = this.componentManager.getByEntity(entity, ComponentType.Sprite);
      if (sprite) {
        sprite.data.flipX = true;
      }
    } else if (rightPressed && !leftPressed) {
      // Move right
      physics.data.velocity.x = Math.min(
        physics.data.velocity.x + currentAcceleration * deltaTime,
        config.speed
      );
      
      // Flip sprite
      const sprite = this.componentManager.getByEntity(entity, ComponentType.Sprite);
      if (sprite) {
        sprite.data.flipX = false;
      }
    } else {
      // Apply deceleration
      const deceleration = config.deceleration * deltaTime;
      
      if (physics.data.velocity.x > 0) {
        physics.data.velocity.x = Math.max(0, physics.data.velocity.x - deceleration);
      } else if (physics.data.velocity.x < 0) {
        physics.data.velocity.x = Math.min(0, physics.data.velocity.x + deceleration);
      }
    }
  }

  /**
   * Patrol behavior for enemies
   */
  private updatePatrolBehavior(entity: Entity, behavior: any, physics: any, transform: any, deltaTime: number): void {
    if (!physics || !transform || !physics.data || !transform.data) return;

    const config = {
      speed: 50,
      patrolDistance: 100,
      pauseTime: 1.0,
      ...behavior.data.config
    };

    // Initialize behavior state
    if (!behavior.data.state) {
      const currentPosition = transform.data.position || { x: 0, y: 0 };
      behavior.data.state = {
        startPosition: { x: currentPosition.x, y: currentPosition.y },
        direction: 1, // 1 for right, -1 for left
        pauseTimer: 0,
        isPaused: false
      };
    }

    const state = behavior.data.state;
    
    if (state.isPaused) {
      // Paused at patrol endpoint
      state.pauseTimer -= deltaTime;
      physics.data.velocity.x = 0;
      
      if (state.pauseTimer <= 0) {
        state.isPaused = false;
        state.direction *= -1; // Change direction
      }
    } else {
      // Moving
      const currentPosition = transform.data.position || { x: 0, y: 0 };
      const startPosition = state.startPosition || { x: 0, y: 0 };
      const distanceFromStart = currentPosition.x - startPosition.x;
      
      // Check if reached patrol limit
      if (Math.abs(distanceFromStart) >= config.patrolDistance) {
        state.isPaused = true;
        state.pauseTimer = config.pauseTime;
        physics.data.velocity.x = 0;
      } else {
        // Continue patrol
        physics.data.velocity.x = state.direction * config.speed;
        
        // Flip sprite based on direction
        const sprite = this.componentManager.getByEntity(entity, ComponentType.Sprite);
        if (sprite) {
          sprite.data.flipX = state.direction < 0;
        }
      }
    }
  }

  /**
   * Chase behavior for enemies
   */
  private updateChaseBehavior(entity: Entity, behavior: any, physics: any, transform: any, deltaTime: number): void {
    if (!physics || !transform || !physics.data || !transform.data) return;

    const config = {
      speed: 80,
      detectionRange: 150,
      stopDistance: 30,
      ...behavior.data.config
    };

    // Find player entity (assuming it has 'player' tag)
    // In a real implementation, this would use the entity manager
    const playerEntity = this.findEntityWithTag('player');
    if (!playerEntity) return;

    const playerTransform = this.componentManager.getByEntity(playerEntity, ComponentType.Transform);
    if (!playerTransform) return;

    const playerPos = playerTransform.data.position || { x: 0, y: 0 };
    const entityPos = transform.data.position || { x: 0, y: 0 };
    const dx = playerPos.x - entityPos.x;
    const dy = playerPos.y - entityPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < config.detectionRange && distance > config.stopDistance) {
      // Chase the player
      const direction = dx > 0 ? 1 : -1;
      physics.data.velocity.x = direction * config.speed;
      
      // Flip sprite based on direction
      const sprite = this.componentManager.getByEntity(entity, ComponentType.Sprite);
      if (sprite) {
        sprite.data.flipX = direction < 0;
      }
    } else {
      // Stop chasing
      physics.data.velocity.x = 0;
    }
  }

  /**
   * Collectible behavior with bobbing animation and rotation
   */
  private updateCollectibleBehavior(entity: Entity, behavior: any, physics: any, transform: any, deltaTime: number): void {
    if (!transform || !transform.data) return;

    const config = {
      rotationSpeed: 2,
      bobHeight: 10,
      bobSpeed: 3,
      ...behavior.data.config
    };

    const state = behavior.data.state;
    
    // Update bob timer
    state.bobTimer += config.bobSpeed * deltaTime;
    
    // Apply bobbing motion
    const bobOffset = Math.sin(state.bobTimer) * config.bobHeight;
    if (transform.data.position) {
      transform.data.position.y = state.originalY + bobOffset;
    }
    
    // Apply rotation
    transform.data.rotation += config.rotationSpeed * deltaTime;
    
    // Check for collision with player
    this.checkPlayerCollision(entity);
  }

  /**
   * Check collision between entity and player
   */
  private checkPlayerCollision(entity: Entity): void {
    const playerEntity = this.findEntityWithTag('player');
    if (!playerEntity) return;

    const entityTransform = this.componentManager.getByEntity(entity, ComponentType.Transform);
    const playerTransform = this.componentManager.getByEntity(playerEntity, ComponentType.Transform);
    const entityCollider = this.componentManager.getByEntity(entity, ComponentType.Collider);
    const playerCollider = this.componentManager.getByEntity(playerEntity, ComponentType.Collider);

    if (!entityTransform || !playerTransform || !entityCollider || !playerCollider) return;

    // Simple AABB collision detection
    const entityBounds = {
      x: entityTransform.data.position.x - entityCollider.data.shape.width / 2,
      y: entityTransform.data.position.y - entityCollider.data.shape.height / 2,
      width: entityCollider.data.shape.width,
      height: entityCollider.data.shape.height
    };

    const playerBounds = {
      x: playerTransform.data.position.x - playerCollider.data.shape.width / 2,
      y: playerTransform.data.position.y - playerCollider.data.shape.height / 2,
      width: playerCollider.data.shape.width,
      height: playerCollider.data.shape.height
    };

    if (this.aabbCollision(entityBounds, playerBounds)) {
      // Collision detected
      const entityBehavior = this.componentManager.getByEntity(entity, ComponentType.Behavior);
      if (entityBehavior && entityBehavior.data.type === 'CollectibleBehavior') {
        this.collectItem(entity, playerEntity);
      }
    }
  }

  /**
   * Handle item collection
   */
  private collectItem(item: Entity, player: Entity): void {
    // Disable the collectible
    const behavior = this.componentManager.getByEntity(item, ComponentType.Behavior);
    if (behavior) {
      behavior.data.enabled = false;
    }

    // Hide the item
    const sprite = this.componentManager.getByEntity(item, ComponentType.Sprite);
    if (sprite) {
      sprite.data.visible = false;
    }

    // Create collection particle effect
    const transform = this.componentManager.getByEntity(item, ComponentType.Transform);
    if (transform) {
      this.eventBus.emit('particles:create', {
        type: 'sparkles',
        position: { x: (transform.data.position?.x || 0), y: (transform.data.position?.y || 0) },
        count: 8
      });
    }

    // Emit collection event
    this.eventBus.emit('item:collected', {
      item: item.id,
      player: player.id,
      type: 'coin'
    });
  }

  /**
   * AABB collision detection
   */
  private aabbCollision(rect1: any, rect2: any): boolean {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  }

  /**
   * Helper method to find entity with specific tag
   * TODO: This should use the actual entity manager
   */
  private findEntityWithTag(tag: string): Entity | null {
    // This is a placeholder - in a real implementation,
    // this would use the entity manager to find entities by tag
    return null;
  }

  getRequiredComponents(): ComponentType[] {
    return [ComponentType.Behavior];
  }
}