/**
 * Visual behaviors for the Game Vibe Engine
 * Provides common visual effects for entities
 */

import { BehaviorDefinition } from '../core/behavior/Behavior';
import { ComponentType } from '../core/types';
import { Entity } from '../core/ecs/Entity';

/**
 * Animation behavior
 * Handles sprite animation playback
 */
export const AnimationBehavior: BehaviorDefinition = {
  name: 'AnimationBehavior',
  
  properties: {
    animations: {},
    currentAnimation: '',
    frameTime: 0,
    frameIndex: 0,
    frameDuration: 100,
    loop: true,
    paused: false
  },
  
  methods: {
    addAnimation: function(name: string, frames: number[], frameDuration: number = 100, loop: boolean = true) {
      this.state.animations[name] = {
        frames,
        frameDuration,
        loop
      };
    },
    
    play: function(name: string) {
      if (!this.state.animations[name]) {
        console.warn(`Animation ${name} does not exist`);
        return;
      }
      
      if (this.state.currentAnimation === name && !this.state.paused) {
        return;
      }
      
      this.state.currentAnimation = name;
      this.state.frameTime = 0;
      this.state.frameIndex = 0;
      this.state.frameDuration = this.state.animations[name].frameDuration;
      this.state.loop = this.state.animations[name].loop;
      this.state.paused = false;
      
      // Update sprite frame
      this.updateSpriteFrame();
    },
    
    pause: function() {
      this.state.paused = true;
    },
    
    resume: function() {
      this.state.paused = false;
    },
    
    stop: function() {
      this.state.currentAnimation = '';
      this.state.paused = true;
    },
    
    updateSpriteFrame: function() {
      const sprite = this.getComponent(ComponentType.Sprite);
      if (!sprite) return;
      
      const animation = this.state.animations[this.state.currentAnimation];
      if (!animation) return;
      
      const frame = animation.frames[this.state.frameIndex];
      sprite.data.frame = frame;
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // Get behavior
    const behavior = entity.getBehavior('AnimationBehavior');
    if (!behavior) return;
    
    // Skip if paused or no animation
    if (behavior.state.paused || !behavior.state.currentAnimation) {
      return;
    }
    
    const animation = behavior.state.animations[behavior.state.currentAnimation];
    if (!animation) return;
    
    // Update frame time
    behavior.state.frameTime += deltaTime * 1000;
    
    // Check if time to advance frame
    if (behavior.state.frameTime >= behavior.state.frameDuration) {
      behavior.state.frameTime -= behavior.state.frameDuration;
      behavior.state.frameIndex++;
      
      // Check for animation end
      if (behavior.state.frameIndex >= animation.frames.length) {
        if (behavior.state.loop) {
          behavior.state.frameIndex = 0;
        } else {
          behavior.state.frameIndex = animation.frames.length - 1;
          behavior.state.paused = true;
        }
      }
      
      // Update sprite frame
      behavior.updateSpriteFrame();
    }
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const sprite = entity.components.get(ComponentType.Sprite);
    if (!sprite) {
      console.warn(`Entity ${entity.name} needs Sprite component for AnimationBehavior`);
    }
  }
};

/**
 * Fade behavior
 * Fades entity in or out over time
 */
export const FadeBehavior: BehaviorDefinition = {
  name: 'FadeBehavior',
  
  properties: {
    targetAlpha: 1,
    startAlpha: 1,
    duration: 1000,
    elapsed: 0,
    autoDestroy: false,
    onComplete: null
  },
  
  methods: {
    fadeIn: function(duration: number = 1000) {
      const sprite = this.getComponent(ComponentType.Sprite);
      if (!sprite) return;
      
      this.state.startAlpha = sprite.data.alpha;
      this.state.targetAlpha = 1;
      this.state.duration = duration;
      this.state.elapsed = 0;
    },
    
    fadeOut: function(duration: number = 1000, autoDestroy: boolean = false) {
      const sprite = this.getComponent(ComponentType.Sprite);
      if (!sprite) return;
      
      this.state.startAlpha = sprite.data.alpha;
      this.state.targetAlpha = 0;
      this.state.duration = duration;
      this.state.elapsed = 0;
      this.state.autoDestroy = autoDestroy;
    },
    
    setOnComplete: function(callback: Function) {
      this.state.onComplete = callback;
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // Get behavior
    const behavior = entity.getBehavior('FadeBehavior');
    if (!behavior) return;
    
    // Get sprite component
    const sprite = entity.components.get(ComponentType.Sprite);
    if (!sprite) return;
    
    // Skip if already at target
    if (sprite.data.alpha === behavior.state.targetAlpha) {
      return;
    }
    
    // Update elapsed time
    behavior.state.elapsed += deltaTime * 1000;
    
    // Calculate progress
    const progress = Math.min(behavior.state.elapsed / behavior.state.duration, 1);
    
    // Update alpha
    sprite.data.alpha = behavior.state.startAlpha + (behavior.state.targetAlpha - behavior.state.startAlpha) * progress;
    
    // Check if complete
    if (progress >= 1) {
      sprite.data.alpha = behavior.state.targetAlpha;
      
      // Call onComplete callback
      if (behavior.state.onComplete) {
        behavior.state.onComplete.call(behavior);
      }
      
      // Auto-destroy if enabled
      if (behavior.state.autoDestroy && behavior.state.targetAlpha === 0) {
        // In a real implementation, this would destroy the entity
      }
    }
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const sprite = entity.components.get(ComponentType.Sprite);
    if (!sprite) {
      console.warn(`Entity ${entity.name} needs Sprite component for FadeBehavior`);
    }
  }
};

/**
 * Flash behavior
 * Makes entity flash by alternating alpha or tint
 */
export const FlashBehavior: BehaviorDefinition = {
  name: 'FlashBehavior',
  
  properties: {
    duration: 1000,
    elapsed: 0,
    frequency: 100,
    useAlpha: true,
    useTint: false,
    minAlpha: 0.2,
    maxAlpha: 1,
    tintColor: 0xffffff,
    originalTint: 0xffffff,
    active: false
  },
  
  methods: {
    startFlash: function(duration: number = 1000, frequency: number = 100) {
      const sprite = this.getComponent(ComponentType.Sprite);
      if (!sprite) return;
      
      this.state.duration = duration;
      this.state.frequency = frequency;
      this.state.elapsed = 0;
      this.state.active = true;
      
      // Store original tint if using tint
      if (this.state.useTint) {
        this.state.originalTint = sprite.data.tint;
      }
    },
    
    stopFlash: function() {
      this.state.active = false;
      
      // Restore original values
      const sprite = this.getComponent(ComponentType.Sprite);
      if (!sprite) return;
      
      if (this.state.useAlpha) {
        sprite.data.alpha = this.state.maxAlpha;
      }
      
      if (this.state.useTint) {
        sprite.data.tint = this.state.originalTint;
      }
    },
    
    setTintColor: function(color: number) {
      this.state.tintColor = color;
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // Get behavior
    const behavior = entity.getBehavior('FlashBehavior');
    if (!behavior || !behavior.state.active) return;
    
    // Get sprite component
    const sprite = entity.components.get(ComponentType.Sprite);
    if (!sprite) return;
    
    // Update elapsed time
    behavior.state.elapsed += deltaTime * 1000;
    
    // Check if complete
    if (behavior.state.elapsed >= behavior.state.duration) {
      behavior.stopFlash();
      return;
    }
    
    // Calculate flash state (on or off)
    const flashState = Math.floor(behavior.state.elapsed / behavior.state.frequency) % 2 === 0;
    
    // Apply flash effect
    if (behavior.state.useAlpha) {
      sprite.data.alpha = flashState ? behavior.state.maxAlpha : behavior.state.minAlpha;
    }
    
    if (behavior.state.useTint) {
      sprite.data.tint = flashState ? behavior.state.originalTint : behavior.state.tintColor;
    }
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const sprite = entity.components.get(ComponentType.Sprite);
    if (!sprite) {
      console.warn(`Entity ${entity.name} needs Sprite component for FlashBehavior`);
    }
  }
};