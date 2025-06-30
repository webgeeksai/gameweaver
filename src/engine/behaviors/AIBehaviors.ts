/**
 * AI behaviors for the Game Vibe Engine
 * Provides common AI patterns for entities
 */

import { BehaviorDefinition } from '../core/behavior/Behavior';
import { ComponentType } from '../core/types';
import { Vector2 } from '../core/math/Vector2';
import { Entity } from '../core/ecs/Entity';

/**
 * Patrol behavior
 * Makes an entity patrol back and forth between two points
 */
export const PatrolBehavior: BehaviorDefinition = {
  name: 'PatrolBehavior',
  
  properties: {
    patrolDistance: 100,
    speed: 50,
    direction: 1,
    startX: 0,
    pauseTime: 1000,
    pauseRemaining: 0
  },
  
  methods: {
    setPatrolDistance: function(distance: number) {
      this.state.patrolDistance = distance;
    },
    
    setSpeed: function(speed: number) {
      this.state.speed = speed;
    },
    
    setPauseTime: function(time: number) {
      this.state.pauseTime = time;
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be implemented with proper component access
    // For now, this is a placeholder implementation
    
    // Get components
    const transform = entity.components.get(ComponentType.Transform);
    const physics = entity.components.get(ComponentType.Physics);
    
    if (!transform || !physics) return;
    
    // Get behavior state
    const behavior = entity.getBehavior('PatrolBehavior');
    if (!behavior) return;
    
    const state = behavior.state;
    
    // Check if paused
    if (state.pauseRemaining > 0) {
      state.pauseRemaining -= deltaTime * 1000;
      
      // Stop movement while paused
      physics.data.velocity.x = 0;
      return;
    }
    
    // Set patrol start position if not set
    if (state.startX === 0) {
      state.startX = transform.data.position.x;
    }
    
    // Move in current direction
    physics.data.velocity.x = state.speed * state.direction;
    
    // Check if reached patrol limit
    const distanceFromStart = Math.abs(transform.data.position.x - state.startX);
    if (distanceFromStart > state.patrolDistance) {
      // Change direction
      state.direction *= -1;
      
      // Flip sprite if available
      const sprite = entity.components.get(ComponentType.Sprite);
      if (sprite) {
        sprite.data.flipX = state.direction < 0;
      }
      
      // Pause at endpoint
      state.pauseRemaining = state.pauseTime;
    }
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const transform = entity.components.get(ComponentType.Transform);
    const physics = entity.components.get(ComponentType.Physics);
    
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for PatrolBehavior`);
    }
    
    if (!physics) {
      console.warn(`Entity ${entity.name} needs Physics component for PatrolBehavior`);
    }
    
    // Store initial position
    const behavior = entity.getBehavior('PatrolBehavior');
    if (behavior && transform) {
      behavior.state.startX = transform.data.position.x;
    }
  }
};

/**
 * Chase behavior
 * Makes an entity chase a target when in range
 */
export const ChaseBehavior: BehaviorDefinition = {
  name: 'ChaseBehavior',
  
  properties: {
    targetId: '',
    detectionRange: 200,
    chaseSpeed: 100,
    maxChaseDistance: 400,
    returnSpeed: 50,
    homePosition: null
  },
  
  methods: {
    setTarget: function(targetId: string) {
      this.state.targetId = targetId;
    },
    
    setDetectionRange: function(range: number) {
      this.state.detectionRange = range;
    },
    
    setHomePosition: function(position: Vector2) {
      this.state.homePosition = { x: position.x, y: position.y };
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be implemented with proper component access
    // For now, this is a placeholder implementation
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const transform = entity.components.get(ComponentType.Transform);
    const physics = entity.components.get(ComponentType.Physics);
    
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for ChaseBehavior`);
    }
    
    if (!physics) {
      console.warn(`Entity ${entity.name} needs Physics component for ChaseBehavior`);
    }
    
    // Store home position
    const behavior = entity.getBehavior('ChaseBehavior');
    if (behavior && transform) {
      behavior.state.homePosition = { 
        x: transform.data.position.x, 
        y: transform.data.position.y 
      };
    }
  }
};

/**
 * State Machine behavior
 * Provides a simple state machine for AI entities
 */
export const StateMachineBehavior: BehaviorDefinition = {
  name: 'StateMachineBehavior',
  
  properties: {
    states: {},
    currentState: 'idle',
    previousState: '',
    stateTime: 0
  },
  
  methods: {
    addState: function(name: string, enterFn: Function, updateFn: Function, exitFn: Function) {
      this.state.states[name] = {
        enter: enterFn,
        update: updateFn,
        exit: exitFn
      };
    },
    
    changeState: function(newState: string) {
      if (!this.state.states[newState]) {
        console.warn(`State ${newState} does not exist`);
        return;
      }
      
      // Exit current state
      const currentState = this.state.states[this.state.currentState];
      if (currentState && currentState.exit) {
        currentState.exit.call(this);
      }
      
      // Change state
      this.state.previousState = this.state.currentState;
      this.state.currentState = newState;
      this.state.stateTime = 0;
      
      // Enter new state
      const newStateObj = this.state.states[newState];
      if (newStateObj && newStateObj.enter) {
        newStateObj.enter.call(this);
      }
    },
    
    getCurrentState: function() {
      return this.state.currentState;
    },
    
    getStateTime: function() {
      return this.state.stateTime;
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // Get behavior
    const behavior = entity.getBehavior('StateMachineBehavior');
    if (!behavior) return;
    
    // Update state time
    behavior.state.stateTime += deltaTime;
    
    // Update current state
    const currentState = behavior.state.states[behavior.state.currentState];
    if (currentState && currentState.update) {
      currentState.update.call(behavior, deltaTime);
    }
  },
  
  initialize: (entity: Entity) => {
    // Add default states
    const behavior = entity.getBehavior('StateMachineBehavior');
    if (!behavior) return;
    
    // Add idle state as default if no states exist
    if (Object.keys(behavior.state.states).length === 0) {
      behavior.state.states.idle = {
        enter: function() {},
        update: function() {},
        exit: function() {}
      };
    }
  }
};