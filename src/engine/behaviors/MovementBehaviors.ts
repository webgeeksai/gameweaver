/**
 * Movement behaviors for the Game Vibe Engine
 * Provides common movement patterns for entities
 */

import { BehaviorDefinition } from '../core/behavior/Behavior';
import { ComponentType, PhysicsMode } from '../core/types';
import { Vector2 } from '../core/math/Vector2';
import { Entity } from '../core/ecs/Entity';

/**
 * Platformer movement behavior
 * Provides side-to-side movement and jumping for platformer games
 */
export const PlatformerMovement: BehaviorDefinition = {
  name: 'PlatformerMovement',
  
  properties: {
    speed: 200,
    jumpPower: 400,
    maxJumps: 2,
    currentJumps: 0,
    acceleration: 1000,
    deceleration: 2000,
    airControl: 0.5
  },
  
  methods: {
    moveLeft: function() {
      const physics = this.getComponent(ComponentType.Physics);
      if (!physics) return;
      
      const isGrounded = physics.data.grounded;
      const acceleration = this.state.acceleration * (isGrounded ? 1 : this.state.airControl);
      
      physics.data.velocity.x = Math.max(
        physics.data.velocity.x - acceleration * 0.016, 
        -this.state.speed
      );
      
      // Flip sprite if available
      const sprite = this.getComponent(ComponentType.Sprite);
      if (sprite) {
        sprite.data.flipX = true;
      }
    },
    
    moveRight: function() {
      const physics = this.getComponent(ComponentType.Physics);
      if (!physics) return;
      
      const isGrounded = physics.data.grounded;
      const acceleration = this.state.acceleration * (isGrounded ? 1 : this.state.airControl);
      
      physics.data.velocity.x = Math.min(
        physics.data.velocity.x + acceleration * 0.016, 
        this.state.speed
      );
      
      // Flip sprite if available
      const sprite = this.getComponent(ComponentType.Sprite);
      if (sprite) {
        sprite.data.flipX = false;
      }
    },
    
    jump: function() {
      const physics = this.getComponent(ComponentType.Physics);
      if (!physics) return;
      
      // Can jump if grounded or have jumps left
      if (physics.data.grounded || this.state.currentJumps < this.state.maxJumps) {
        physics.data.velocity.y = -this.state.jumpPower;
        physics.data.grounded = false;
        this.state.currentJumps++;
        
        // Emit jump event
        // In a real implementation, this would use the event bus
      }
    },
    
    stop: function() {
      const physics = this.getComponent(ComponentType.Physics);
      if (!physics) return;
      
      // Apply deceleration
      const deceleration = this.state.deceleration * 0.016;
      
      if (physics.data.velocity.x > 0) {
        physics.data.velocity.x = Math.max(0, physics.data.velocity.x - deceleration);
      } else if (physics.data.velocity.x < 0) {
        physics.data.velocity.x = Math.min(0, physics.data.velocity.x + deceleration);
      }
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be implemented with proper component access
    // For now, this is a placeholder
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const physics = entity.components.get(ComponentType.Physics);
    if (!physics) {
      console.warn(`Entity ${entity.name} needs Physics component for PlatformerMovement behavior`);
    }
  }
};

/**
 * Top-down movement behavior
 * Provides omnidirectional movement for top-down games
 */
export const TopDownMovement: BehaviorDefinition = {
  name: 'TopDownMovement',
  
  properties: {
    speed: 200,
    acceleration: 1000,
    deceleration: 2000,
    rotateToMovement: false
  },
  
  methods: {
    move: function(direction: Vector2) {
      const physics = this.getComponent(ComponentType.Physics);
      if (!physics) return;
      
      // Normalize direction
      if (direction.x !== 0 || direction.y !== 0) {
        direction = Vector2.normalize(direction);
      }
      
      // Apply acceleration
      const acceleration = this.state.acceleration * 0.016;
      physics.data.velocity.x += direction.x * acceleration;
      physics.data.velocity.y += direction.y * acceleration;
      
      // Limit speed
      const currentSpeed = Math.sqrt(
        physics.data.velocity.x * physics.data.velocity.x + 
        physics.data.velocity.y * physics.data.velocity.y
      );
      
      if (currentSpeed > this.state.speed) {
        const scale = this.state.speed / currentSpeed;
        physics.data.velocity.x *= scale;
        physics.data.velocity.y *= scale;
      }
      
      // Rotate sprite if enabled
      if (this.state.rotateToMovement && (direction.x !== 0 || direction.y !== 0)) {
        const transform = this.getComponent(ComponentType.Transform);
        if (transform) {
          transform.data.rotation = Math.atan2(direction.y, direction.x);
        }
      }
    },
    
    stop: function() {
      const physics = this.getComponent(ComponentType.Physics);
      if (!physics) return;
      
      // Apply deceleration
      const deceleration = this.state.deceleration * 0.016;
      const currentSpeed = Math.sqrt(
        physics.data.velocity.x * physics.data.velocity.x + 
        physics.data.velocity.y * physics.data.velocity.y
      );
      
      if (currentSpeed > 0) {
        const scale = Math.max(0, currentSpeed - deceleration) / currentSpeed;
        physics.data.velocity.x *= scale;
        physics.data.velocity.y *= scale;
        
        // Stop completely if very slow
        if (Math.abs(physics.data.velocity.x) < 0.1) physics.data.velocity.x = 0;
        if (Math.abs(physics.data.velocity.y) < 0.1) physics.data.velocity.y = 0;
      }
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be implemented with proper component access
    // For now, this is a placeholder
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const physics = entity.components.get(ComponentType.Physics);
    if (!physics) {
      console.warn(`Entity ${entity.name} needs Physics component for TopDownMovement behavior`);
    }
    
    // Set physics mode to topdown if possible
    // In a real implementation, this would use the component manager
  }
};

/**
 * Follow behavior
 * Makes an entity follow a target entity
 */
export const FollowBehavior: BehaviorDefinition = {
  name: 'FollowBehavior',
  
  properties: {
    targetId: '',
    speed: 100,
    minDistance: 50,
    maxDistance: 200,
    smoothing: 0.1
  },
  
  methods: {
    setTarget: function(targetId: string) {
      this.state.targetId = targetId;
    },
    
    getTargetPosition: function(): Vector2 | null {
      // In a real implementation, this would use the entity manager
      // to find the target entity and get its position
      return null;
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be implemented with proper component access
    // For now, this is a placeholder
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const transform = entity.components.get(ComponentType.Transform);
    const physics = entity.components.get(ComponentType.Physics);
    
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for FollowBehavior`);
    }
    
    if (!physics) {
      console.warn(`Entity ${entity.name} needs Physics component for FollowBehavior`);
    }
  }
};