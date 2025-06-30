/**
 * Transform System for handling entity positioning, rotation, and scaling
 * Manages transform hierarchies and matrix calculations
 */

import { BaseSystem } from '../core/ecs/System';
import { ComponentType } from '../core/types';
import { Entity } from '../core/ecs/Entity';
import { ComponentManager } from '../core/ecs/ComponentManager';
import { TransformComponent, TransformData } from '../core/ecs/Component';
import { Vector2 } from '../core/math/Vector2';
import { Matrix3 } from '../core/math/Matrix3';

export class TransformSystem extends BaseSystem {
  private componentManager: ComponentManager;
  
  constructor(componentManager: ComponentManager) {
    super(
      'TransformSystem',
      100, // High priority - other systems depend on transforms
      [ComponentType.Transform]
    );
    this.componentManager = componentManager;
  }
  
  initialize(): void {
    console.log('TransformSystem initialized');
  }
  
  protected processEntities(entities: Entity[], deltaTime: number): void {
    // First pass: Update local transforms for root entities
    const rootEntities = entities.filter(entity => !entity.parent);
    for (const entity of rootEntities) {
      this.updateLocalTransform(entity);
    }
    
    // Second pass: Update world transforms in hierarchical order
    for (const entity of rootEntities) {
      this.updateWorldTransformHierarchy(entity, entities);
    }
  }
  
  private updateLocalTransform(entity: Entity): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform || !transform.data.localDirty) return;
    
    const data = transform.data as TransformData;
    
    // Create local transformation matrix
    const position = new Vector2(data.position.x, data.position.y);
    const scale = new Vector2(data.scale.x, data.scale.y);
    
    const localMatrix = Matrix3.fromTransform(position, data.rotation, scale);
    data.localMatrix = localMatrix.toArray();
    data.localDirty = false;
    data.worldDirty = true;
  }
  
  private updateWorldTransformHierarchy(entity: Entity, allEntities: Entity[]): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform) return;
    
    const data = transform.data as TransformData;
    
    if (data.worldDirty) {
      this.updateWorldTransform(entity);
    }
    
    // Update children
    for (const childId of entity.children) {
      const child = allEntities.find(e => e.id === childId);
      if (child) {
        const childTransform = this.componentManager.getByEntity<TransformComponent>(child, ComponentType.Transform);
        if (childTransform) {
          childTransform.data.worldDirty = true;
        }
        this.updateWorldTransformHierarchy(child, allEntities);
      }
    }
  }
  
  private updateWorldTransform(entity: Entity): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform) return;
    
    const data = transform.data as TransformData;
    
    // Get local matrix
    const localMatrix = new Matrix3();
    if (data.localMatrix) {
      localMatrix.elements.set(data.localMatrix);
    }
    
    let worldMatrix = localMatrix.clone();
    
    // If entity has a parent, multiply by parent's world matrix
    if (entity.parent) {
      const parentEntity = this.findEntityById(entity.parent);
      if (parentEntity) {
        const parentTransform = this.componentManager.getByEntity<TransformComponent>(parentEntity, ComponentType.Transform);
        if (parentTransform && parentTransform.data.worldMatrix) {
          const parentWorldMatrix = new Matrix3();
          parentWorldMatrix.elements.set(parentTransform.data.worldMatrix);
          worldMatrix = Matrix3.multiply(parentWorldMatrix, localMatrix);
        }
      }
    }
    
    // Store world matrix
    data.worldMatrix = worldMatrix.toArray();
    
    // Extract world transform properties
    const worldTranslation = worldMatrix.getTranslation();
    const worldRotation = worldMatrix.getRotation();
    const worldScale = worldMatrix.getScale();
    
    data.worldPosition = { x: worldTranslation.x, y: worldTranslation.y };
    data.worldRotation = worldRotation;
    data.worldScale = { x: worldScale.x, y: worldScale.y };
    
    data.worldDirty = false;
  }
  
  // Helper method to find entity by ID (this would normally be injected)
  private findEntityById(entityId: string): Entity | null {
    // This is a placeholder - in a real implementation, this would be provided by EntityManager
    return null;
  }
  
  // Public API for other systems
  getWorldPosition(entity: Entity): Vector2 | null {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform || !transform.data.worldPosition) return null;
    
    return new Vector2(transform.data.worldPosition.x, transform.data.worldPosition.y);
  }
  
  getWorldRotation(entity: Entity): number | null {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform || transform.data.worldRotation === undefined) return null;
    
    return transform.data.worldRotation;
  }
  
  getWorldScale(entity: Entity): Vector2 | null {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform || !transform.data.worldScale) return null;
    
    return new Vector2(transform.data.worldScale.x, transform.data.worldScale.y);
  }
  
  setPosition(entity: Entity, position: Vector2): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform) return;
    
    transform.data.position = { x: position.x, y: position.y };
    transform.data.localDirty = true;
  }
  
  setRotation(entity: Entity, rotation: number): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform) return;
    
    transform.data.rotation = rotation;
    transform.data.localDirty = true;
  }
  
  setScale(entity: Entity, scale: Vector2): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform) return;
    
    transform.data.scale = { x: scale.x, y: scale.y };
    transform.data.localDirty = true;
  }
  
  translate(entity: Entity, offset: Vector2): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform) return;
    
    transform.data.position.x += offset.x;
    transform.data.position.y += offset.y;
    transform.data.localDirty = true;
  }
  
  rotate(entity: Entity, angle: number): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    if (!transform) return;
    
    transform.data.rotation += angle;
    transform.data.localDirty = true;
  }
}