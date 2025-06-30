/**
 * Interaction behaviors for the Game Vibe Engine
 * Provides common interaction patterns for entities
 */

import { BehaviorDefinition } from '../core/behavior/Behavior';
import { ComponentType } from '../core/types';
import { Vector2 } from '../core/math/Vector2';
import { Entity } from '../core/ecs/Entity';

/**
 * Clickable behavior
 * Makes an entity respond to mouse clicks
 */
export const ClickableBehavior: BehaviorDefinition = {
  name: 'ClickableBehavior',
  
  properties: {
    onClick: null,
    hoverTint: 0xdddddd,
    originalTint: 0xffffff,
    isHovering: false,
    isDown: false,
    enabled: true
  },
  
  methods: {
    setOnClick: function(callback: Function) {
      this.state.onClick = callback;
    },
    
    setEnabled: function(enabled: boolean) {
      this.state.enabled = enabled;
    },
    
    isPointInside: function(point: Vector2): boolean {
      const transform = this.getComponent(ComponentType.Transform);
      const sprite = this.getComponent(ComponentType.Sprite);
      
      if (!transform || !sprite) return false;
      
      // Simple AABB check
      const halfWidth = sprite.data.bounds.width * transform.data.scale.x / 2;
      const halfHeight = sprite.data.bounds.height * transform.data.scale.y / 2;
      
      return (
        point.x >= transform.data.position.x - halfWidth &&
        point.x <= transform.data.position.x + halfWidth &&
        point.y >= transform.data.position.y - halfHeight &&
        point.y <= transform.data.position.y + halfHeight
      );
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be implemented with proper input system integration
    // For now, this is a placeholder
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const transform = entity.components.get(ComponentType.Transform);
    const sprite = entity.components.get(ComponentType.Sprite);
    
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for ClickableBehavior`);
    }
    
    if (!sprite) {
      console.warn(`Entity ${entity.name} needs Sprite component for ClickableBehavior`);
    }
    
    // Store original tint
    const behavior = entity.getBehavior('ClickableBehavior');
    if (behavior && sprite) {
      behavior.state.originalTint = sprite.data.tint;
    }
    
    // In a real implementation, this would register input event handlers
  }
};

/**
 * Draggable behavior
 * Makes an entity draggable with the mouse
 */
export const DraggableBehavior: BehaviorDefinition = {
  name: 'DraggableBehavior',
  
  properties: {
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    onDragStart: null,
    onDragEnd: null,
    onDrag: null,
    constraints: null,
    enabled: true
  },
  
  methods: {
    setOnDragStart: function(callback: Function) {
      this.state.onDragStart = callback;
    },
    
    setOnDragEnd: function(callback: Function) {
      this.state.onDragEnd = callback;
    },
    
    setOnDrag: function(callback: Function) {
      this.state.onDrag = callback;
    },
    
    setConstraints: function(bounds: { x: number, y: number, width: number, height: number }) {
      this.state.constraints = bounds;
    },
    
    startDrag: function(point: Vector2) {
      if (!this.state.enabled) return;
      
      const transform = this.getComponent(ComponentType.Transform);
      if (!transform) return;
      
      this.state.isDragging = true;
      this.state.dragOffset = {
        x: transform.data.position.x - point.x,
        y: transform.data.position.y - point.y
      };
      
      if (this.state.onDragStart) {
        this.state.onDragStart.call(this);
      }
    },
    
    endDrag: function() {
      if (!this.state.isDragging) return;
      
      this.state.isDragging = false;
      
      if (this.state.onDragEnd) {
        this.state.onDragEnd.call(this);
      }
    },
    
    drag: function(point: Vector2) {
      if (!this.state.isDragging || !this.state.enabled) return;
      
      const transform = this.getComponent(ComponentType.Transform);
      if (!transform) return;
      
      // Calculate new position
      let newX = point.x + this.state.dragOffset.x;
      let newY = point.y + this.state.dragOffset.y;
      
      // Apply constraints if set
      if (this.state.constraints) {
        const c = this.state.constraints;
        newX = Math.max(c.x, Math.min(c.x + c.width, newX));
        newY = Math.max(c.y, Math.min(c.y + c.height, newY));
      }
      
      // Update position
      transform.data.position.x = newX;
      transform.data.position.y = newY;
      transform.data.localDirty = true;
      
      if (this.state.onDrag) {
        this.state.onDrag.call(this, { x: newX, y: newY });
      }
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be implemented with proper input system integration
    // For now, this is a placeholder
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const transform = entity.components.get(ComponentType.Transform);
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for DraggableBehavior`);
    }
    
    // In a real implementation, this would register input event handlers
  }
};

/**
 * Hoverable behavior
 * Makes an entity respond to mouse hover
 */
export const HoverableBehavior: BehaviorDefinition = {
  name: 'HoverableBehavior',
  
  properties: {
    isHovering: false,
    hoverTint: 0xdddddd,
    originalTint: 0xffffff,
    onHoverEnter: null,
    onHoverExit: null,
    enabled: true
  },
  
  methods: {
    setOnHoverEnter: function(callback: Function) {
      this.state.onHoverEnter = callback;
    },
    
    setOnHoverExit: function(callback: Function) {
      this.state.onHoverExit = callback;
    },
    
    setHoverTint: function(tint: number) {
      this.state.hoverTint = tint;
    },
    
    setEnabled: function(enabled: boolean) {
      this.state.enabled = enabled;
    },
    
    isPointInside: function(point: Vector2): boolean {
      const transform = this.getComponent(ComponentType.Transform);
      const sprite = this.getComponent(ComponentType.Sprite);
      
      if (!transform || !sprite) return false;
      
      // Simple AABB check
      const halfWidth = sprite.data.bounds.width * transform.data.scale.x / 2;
      const halfHeight = sprite.data.bounds.height * transform.data.scale.y / 2;
      
      return (
        point.x >= transform.data.position.x - halfWidth &&
        point.x <= transform.data.position.x + halfWidth &&
        point.y >= transform.data.position.y - halfHeight &&
        point.y <= transform.data.position.y + halfHeight
      );
    },
    
    setHovering: function(hovering: boolean) {
      if (this.state.isHovering === hovering) return;
      
      this.state.isHovering = hovering;
      
      const sprite = this.getComponent(ComponentType.Sprite);
      if (!sprite) return;
      
      if (hovering) {
        // Store original tint if not stored
        if (this.state.originalTint === 0xffffff) {
          this.state.originalTint = sprite.data.tint;
        }
        
        // Apply hover tint
        sprite.data.tint = this.state.hoverTint;
        
        // Call hover enter callback
        if (this.state.onHoverEnter) {
          this.state.onHoverEnter.call(this);
        }
      } else {
        // Restore original tint
        sprite.data.tint = this.state.originalTint;
        
        // Call hover exit callback
        if (this.state.onHoverExit) {
          this.state.onHoverExit.call(this);
        }
      }
    }
  },
  
  update: (entity: Entity, deltaTime: number) => {
    // This would be implemented with proper input system integration
    // For now, this is a placeholder
  },
  
  initialize: (entity: Entity) => {
    // Ensure entity has required components
    const transform = entity.components.get(ComponentType.Transform);
    const sprite = entity.components.get(ComponentType.Sprite);
    
    if (!transform) {
      console.warn(`Entity ${entity.name} needs Transform component for HoverableBehavior`);
    }
    
    if (!sprite) {
      console.warn(`Entity ${entity.name} needs Sprite component for HoverableBehavior`);
    }
    
    // Store original tint
    const behavior = entity.getBehavior('HoverableBehavior');
    if (behavior && sprite) {
      behavior.state.originalTint = sprite.data.tint;
    }
    
    // In a real implementation, this would register input event handlers
  }
};