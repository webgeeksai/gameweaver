/**
 * System interface and base implementation for the Entity Component System
 * Systems process entities with specific component combinations
 */

import { ComponentType } from '../types';
import { Entity } from './Entity';

export interface System {
  readonly name: string;
  readonly priority: number;
  readonly requiredComponents: ComponentType[];
  readonly optionalComponents: ComponentType[];
  
  // Lifecycle
  initialize(): void;
  update(entities: Entity[], deltaTime: number): void;
  render?(entities: Entity[], renderer: any): void;
  cleanup(): void;
  
  // System queries
  getEntities(): Entity[];
  getRequiredComponents(): ComponentType[];
  
  // Performance
  getPerformanceMetrics(): SystemPerformanceMetrics;
}

export interface SystemPerformanceMetrics {
  updateTime: number;
  renderTime?: number;
  entityCount: number;
  averageUpdateTime: number;
  peakUpdateTime: number;
}

export abstract class BaseSystem implements System {
  readonly name: string;
  readonly priority: number;
  readonly requiredComponents: ComponentType[];
  readonly optionalComponents: ComponentType[];
  
  // Performance tracking
  private updateTimes: number[] = [];
  private renderTimes: number[] = [];
  private maxSamples: number = 60;
  private lastUpdateTime: number = 0;
  private lastRenderTime: number = 0;
  private peakUpdateTime: number = 0;
  private currentEntityCount: number = 0;
  
  constructor(
    name: string, 
    priority: number, 
    requiredComponents: ComponentType[] = [], 
    optionalComponents: ComponentType[] = []
  ) {
    this.name = name;
    this.priority = priority;
    this.requiredComponents = requiredComponents;
    this.optionalComponents = optionalComponents;
  }
  
  // Lifecycle methods
  initialize(): void {
    // Default implementation does nothing
  }
  
  update(entities: Entity[], deltaTime: number): void {
    const startTime = performance.now();
    this.currentEntityCount = entities.length;
    
    this.processEntities(entities, deltaTime);
    
    const endTime = performance.now();
    this.trackUpdateTime(endTime - startTime);
  }
  
  render?(entities: Entity[], renderer: any): void {
    const startTime = performance.now();
    
    this.renderEntities(entities, renderer);
    
    const endTime = performance.now();
    this.trackRenderTime(endTime - startTime);
  }
  
  cleanup(): void {
    // Default implementation does nothing
  }
  
  // Abstract method to be implemented by derived systems
  protected abstract processEntities(entities: Entity[], deltaTime: number): void;
  
  // Optional render method to be implemented by derived systems
  protected renderEntities(entities: Entity[], renderer: any): void {
    // Default implementation does nothing
  }
  
  // System queries
  getEntities(): Entity[] {
    // This is a placeholder - actual implementation will be in SystemManager
    return [];
  }
  
  getRequiredComponents(): ComponentType[] {
    return [...this.requiredComponents];
  }
  
  // Performance tracking
  private trackUpdateTime(time: number): void {
    this.lastUpdateTime = time;
    this.peakUpdateTime = Math.max(this.peakUpdateTime, time);
    
    this.updateTimes.push(time);
    if (this.updateTimes.length > this.maxSamples) {
      this.updateTimes.shift();
    }
  }
  
  private trackRenderTime(time: number): void {
    this.lastRenderTime = time;
    
    this.renderTimes.push(time);
    if (this.renderTimes.length > this.maxSamples) {
      this.renderTimes.shift();
    }
  }
  
  getPerformanceMetrics(): SystemPerformanceMetrics {
    const avgUpdateTime = this.updateTimes.length > 0
      ? this.updateTimes.reduce((sum, time) => sum + time, 0) / this.updateTimes.length
      : 0;
      
    const metrics: SystemPerformanceMetrics = {
      updateTime: this.lastUpdateTime,
      entityCount: this.currentEntityCount,
      averageUpdateTime: avgUpdateTime,
      peakUpdateTime: this.peakUpdateTime
    };
    
    if (this.renderTimes.length > 0) {
      const avgRenderTime = this.renderTimes.reduce((sum, time) => sum + time, 0) / this.renderTimes.length;
      metrics.renderTime = this.lastRenderTime;
    }
    
    return metrics;
  }
  
  resetPerformanceMetrics(): void {
    this.updateTimes = [];
    this.renderTimes = [];
    this.lastUpdateTime = 0;
    this.lastRenderTime = 0;
    this.peakUpdateTime = 0;
  }
}