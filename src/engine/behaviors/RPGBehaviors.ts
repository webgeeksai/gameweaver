/**
 * RPG-specific behaviors for the Game Vibe Engine
 * Provides behaviors for top-down RPG games with animations, interactions, and dialogue
 */

import { BehaviorDefinition } from '../core/behavior/Behavior';
import { ComponentType } from '../core/types';
import { Vector2 } from '../core/math/Vector2';
import { Entity } from '../core/ecs/Entity';

/**
 * Top-down player movement with animation support
 * Handles WASD/arrow key movement and directional animations
 */
export const TopDownPlayerMovement: BehaviorDefinition = {
  name: 'TopDownPlayerMovement',
  
  properties: {
    speed: 175,
    smoothing: 0.1,
    currentDirection: 'down',
    isMoving: false,
    lastDirection: 'down',
    diagonalSpeedMultiplier: 0.707,
    animations: {
      idle_down: 'misa-front',
      idle_up: 'misa-back',
      idle_left: 'misa-left', 
      idle_right: 'misa-right',
      walk_down: 'misa-front-walk',
      walk_up: 'misa-back-walk',
      walk_left: 'misa-left-walk',
      walk_right: 'misa-right-walk'
    }
  },
  
  methods: {
    handleInput: function(input: any) {
      const physics = this.getComponent(ComponentType.Physics);
      if (!physics) return;

      let velocityX = 0;
      let velocityY = 0;
      let moving = false;

      // Check input for movement
      if (input.isPressed('w') || input.isPressed('up')) {
        velocityY = -this.state.speed;
        this.state.currentDirection = 'up';
        moving = true;
      }
      if (input.isPressed('s') || input.isPressed('down')) {
        velocityY = this.state.speed;
        this.state.currentDirection = 'down';
        moving = true;
      }
      if (input.isPressed('a') || input.isPressed('left')) {
        velocityX = -this.state.speed;
        this.state.currentDirection = 'left';
        moving = true;
      }
      if (input.isPressed('d') || input.isPressed('right')) {
        velocityX = this.state.speed;
        this.state.currentDirection = 'right';
        moving = true;
      }

      // Normalize diagonal movement
      if (velocityX !== 0 && velocityY !== 0) {
        velocityX *= this.state.diagonalSpeedMultiplier;
        velocityY *= this.state.diagonalSpeedMultiplier;
      }

      // Apply velocity
      physics.data.velocity.x = velocityX;
      physics.data.velocity.y = velocityY;

      // Update movement state
      const wasMoving = this.state.isMoving;
      this.state.isMoving = moving;

      if (moving) {
        this.state.lastDirection = this.state.currentDirection;
      }

      // Update animations
      this.updateAnimation(wasMoving !== moving);
    },

    updateAnimation: function(stateChanged: boolean) {
      const sprite = this.getComponent(ComponentType.Sprite);
      if (!sprite) return;

      if (this.state.isMoving) {
        // Play walking animation
        const walkAnim = this.state.animations[`walk_${this.state.currentDirection}`];
        if (walkAnim && sprite.data.currentAnimation !== walkAnim) {
          sprite.data.currentAnimation = walkAnim;
          sprite.data.animationFrame = 0;
          sprite.data.animationTime = 0;
          sprite.data.isAnimating = true;
        }
      } else {
        // Play idle animation
        const idleAnim = this.state.animations[`idle_${this.state.lastDirection}`];
        if (idleAnim && (stateChanged || sprite.data.currentAnimation !== idleAnim)) {
          sprite.data.currentAnimation = idleAnim;
          sprite.data.animationFrame = 0;
          sprite.data.isAnimating = false;
        }
      }
    },

    setAnimations: function(animations: any) {
      this.state.animations = { ...this.state.animations, ...animations };
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be called by the behavior system with proper input handling
    // For now, this is a placeholder
  },
  
  initialize: (entity: Entity) => {
    const physics = entity.components.get(ComponentType.Physics);
    const sprite = entity.components.get(ComponentType.Sprite);
    
    if (!physics) {
      console.warn(`Entity ${entity.name} needs Physics component for TopDownPlayerMovement`);
    }
    
    if (!sprite) {
      console.warn(`Entity ${entity.name} needs Sprite component for TopDownPlayerMovement`);
    }

    // Set initial idle animation
    const behavior = entity.getBehavior('TopDownPlayerMovement');
    if (behavior && sprite) {
      behavior.methods.updateAnimation.call(behavior, true);
    }
  }
};

/**
 * Camera follow behavior for following a target entity
 */
export const CameraFollow: BehaviorDefinition = {
  name: 'CameraFollow',
  
  properties: {
    followSpeed: 0.1,
    zoom: 1.0,
    offset: { x: 0, y: 0 },
    bounds: null,
    enabled: true
  },
  
  methods: {
    setFollowSpeed: function(speed: number) {
      this.state.followSpeed = speed;
    },

    setZoom: function(zoom: number) {
      this.state.zoom = zoom;
    },

    setOffset: function(x: number, y: number) {
      this.state.offset = { x, y };
    },

    setBounds: function(x: number, y: number, width: number, height: number) {
      this.state.bounds = { x, y, width, height };
    },

    setEnabled: function(enabled: boolean) {
      this.state.enabled = enabled;
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would update the camera to follow the entity
    // Implementation would depend on the rendering system
  },
  
  initialize: (entity: Entity) => {
    const transform = entity.components.get(ComponentType.Transform);
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for CameraFollow`);
    }
  }
};

/**
 * Interaction system for handling player interactions with objects
 */
export const InteractionSystem: BehaviorDefinition = {
  name: 'InteractionSystem',
  
  properties: {
    interactionRange: 64,
    interactionKey: 'space',
    currentInteractables: [],
    selectorOffset: { x: 0, y: 32 },
    selectorSize: { width: 16, height: 16 }
  },
  
  methods: {
    setInteractionRange: function(range: number) {
      this.state.interactionRange = range;
    },

    setInteractionKey: function(key: string) {
      this.state.interactionKey = key;
    },

    checkForInteractables: function() {
      // This would check for nearby interactable entities
      // Implementation would depend on the collision/physics system
      return [];
    },

    triggerInteraction: function() {
      if (this.state.currentInteractables.length > 0) {
        const interactable = this.state.currentInteractables[0];
        const dialogueBehavior = interactable.getBehavior('DialogueInteraction');
        if (dialogueBehavior) {
          dialogueBehavior.methods.trigger.call(dialogueBehavior);
        }
      }
    },

    handleInput: function(input: any) {
      if (input.wasPressed(this.state.interactionKey)) {
        this.triggerInteraction();
      }
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // Update interaction checks
    const behavior = entity.getBehavior('InteractionSystem');
    if (behavior) {
      behavior.state.currentInteractables = behavior.methods.checkForInteractables.call(behavior);
    }
  },
  
  initialize: (entity: Entity) => {
    const transform = entity.components.get(ComponentType.Transform);
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for InteractionSystem`);
    }
  }
};

/**
 * Dialogue interaction behavior for NPCs and signs
 */
export const DialogueInteraction: BehaviorDefinition = {
  name: 'DialogueInteraction',
  
  properties: {
    text: 'Hello, World!',
    autoTrigger: false,
    requireInput: true,
    displayTime: 3000,
    isActive: false,
    typewriterSpeed: 50,
    onComplete: null
  },
  
  methods: {
    setText: function(text: string) {
      this.state.text = text;
    },

    setTypewriterSpeed: function(speed: number) {
      this.state.typewriterSpeed = speed;
    },

    trigger: function() {
      if (this.state.isActive) return;
      
      this.state.isActive = true;
      this.showDialogue();
      
      if (this.state.displayTime > 0 && !this.state.requireInput) {
        setTimeout(() => {
          this.hideDialogue();
        }, this.state.displayTime);
      }
    },

    showDialogue: function() {
      // This would show the dialogue UI with typewriter effect
      // Implementation would depend on the UI system
      console.log('Showing dialogue:', this.state.text);
      
      if (this.state.onComplete) {
        setTimeout(() => {
          this.state.onComplete();
          if (!this.state.requireInput) {
            this.hideDialogue();
          }
        }, this.state.text.length * this.state.typewriterSpeed);
      }
    },

    hideDialogue: function() {
      this.state.isActive = false;
      console.log('Hiding dialogue');
    },

    handleInput: function(input: any) {
      if (this.state.isActive && this.state.requireInput && input.wasPressed('space')) {
        this.hideDialogue();
      }
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // Handle input for dismissing dialogue
  },
  
  initialize: (entity: Entity) => {
    // No specific requirements for dialogue interaction
  }
};

/**
 * Animation manager for sprite atlas animations
 */
export const AnimationManager: BehaviorDefinition = {
  name: 'AnimationManager',
  
  properties: {
    animations: {},
    currentAnimation: '',
    frameRate: 10,
    loop: true,
    currentFrame: 0,
    frameTime: 0,
    isPlaying: false
  },
  
  methods: {
    addAnimation: function(name: string, frames: string[], frameRate?: number) {
      this.state.animations[name] = {
        frames: frames,
        frameRate: frameRate || this.state.frameRate,
        loop: true
      };
    },

    playAnimation: function(name: string, loop: boolean = true) {
      if (!this.state.animations[name]) {
        console.warn(`Animation '${name}' not found`);
        return;
      }

      this.state.currentAnimation = name;
      this.state.currentFrame = 0;
      this.state.frameTime = 0;
      this.state.isPlaying = true;
      this.state.loop = loop;

      // Update sprite frame
      const sprite = this.getComponent(ComponentType.Sprite);
      if (sprite) {
        const animation = this.state.animations[name];
        sprite.data.texture = animation.frames[0];
      }
    },

    stopAnimation: function() {
      this.state.isPlaying = false;
    },

    setFrame: function(frameName: string) {
      const sprite = this.getComponent(ComponentType.Sprite);
      if (sprite) {
        sprite.data.texture = frameName;
        this.state.isPlaying = false;
      }
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    const behavior = entity.getBehavior('AnimationManager');
    if (!behavior || !behavior.state.isPlaying) return;

    const animation = behavior.state.animations[behavior.state.currentAnimation];
    if (!animation) return;

    // Update frame time
    behavior.state.frameTime += deltaTime * 1000; // Convert to ms
    const frameDuration = 1000 / animation.frameRate;

    if (behavior.state.frameTime >= frameDuration) {
      behavior.state.frameTime = 0;
      behavior.state.currentFrame++;

      // Check if animation is complete
      if (behavior.state.currentFrame >= animation.frames.length) {
        if (behavior.state.loop) {
          behavior.state.currentFrame = 0;
        } else {
          behavior.state.isPlaying = false;
          behavior.state.currentFrame = animation.frames.length - 1;
        }
      }

      // Update sprite frame
      const sprite = entity.components.get(ComponentType.Sprite);
      if (sprite) {
        sprite.data.texture = animation.frames[behavior.state.currentFrame];
      }
    }
  },
  
  initialize: (entity: Entity) => {
    const sprite = entity.components.get(ComponentType.Sprite);
    if (!sprite) {
      console.warn(`Entity ${entity.name} needs Sprite component for AnimationManager`);
    }
  }
};

/**
 * Interactable sign behavior
 */
export const InteractableSign: BehaviorDefinition = {
  name: 'InteractableSign',
  
  properties: {
    message: 'Default sign message',
    interactionRange: 64,
    isPlayerNearby: false
  },
  
  methods: {
    setMessage: function(message: string) {
      this.state.message = message;
    },

    checkPlayerDistance: function() {
      // This would check distance to player entity
      // Implementation would depend on the entity system
      return false;
    },

    onInteract: function() {
      console.log('Sign interaction:', this.state.message);
      // This would trigger dialogue display
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    const behavior = entity.getBehavior('InteractableSign');
    if (behavior) {
      behavior.state.isPlayerNearby = behavior.methods.checkPlayerDistance.call(behavior);
    }
  },
  
  initialize: (entity: Entity) => {
    const transform = entity.components.get(ComponentType.Transform);
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for InteractableSign`);
    }
  }
};

/**
 * NPC Dialogue behavior for talking characters
 */
export const NPCDialogue: BehaviorDefinition = {
  name: 'NPCDialogue',
  
  properties: {
    dialogue: 'Hello there!',
    interactionRange: 64,
    cooldownTime: 1000,
    lastInteractionTime: 0
  },
  
  methods: {
    setDialogue: function(dialogue: string) {
      this.state.dialogue = dialogue;
    },

    canInteract: function(): boolean {
      const currentTime = Date.now();
      return currentTime - this.state.lastInteractionTime > this.state.cooldownTime;
    },

    onInteract: function() {
      if (!this.canInteract()) return;

      console.log('NPC says:', this.state.dialogue);
      this.state.lastInteractionTime = Date.now();
      
      // This would trigger dialogue display system
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // Could add NPC idle animations or behaviors here
  },
  
  initialize: (entity: Entity) => {
    const transform = entity.components.get(ComponentType.Transform);
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for NPCDialogue`);
    }
  }
};