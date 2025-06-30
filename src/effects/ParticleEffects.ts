/**
 * Predefined particle effects for common game scenarios
 */

import { ParticleSystem } from '../core/particles/ParticleSystem';
import { Vector2 } from '../core/math/Vector2';
import { Entity } from '../core/ecs/Entity';

export class ParticleEffects {
  private particleSystem: ParticleSystem;
  
  constructor(particleSystem: ParticleSystem) {
    this.particleSystem = particleSystem;
  }
  
  /**
   * Create an explosion effect at the specified position
   */
  createExplosion(position: Vector2, options: {
    color?: string,
    size?: number,
    particleCount?: number,
    duration?: number
  } = {}): string {
    const {
      color = '#ff0000',
      size = 1,
      particleCount = 50,
      duration = 500
    } = options;
    
    return this.particleSystem.createEmitter({
      position,
      positionVar: new Vector2(5 * size, 5 * size),
      velocity: new Vector2(0, 0),
      velocityVar: new Vector2(100 * size, 100 * size),
      acceleration: new Vector2(0, 0),
      scale: new Vector2(size, size),
      scaleVar: new Vector2(0.5 * size, 0.5 * size),
      scaleRate: new Vector2(-0.5, -0.5),
      scaleRateVar: new Vector2(0.2, 0.2),
      color,
      colorVar: [color, '#ffff00', '#ff8800'],
      alpha: 1,
      alphaVar: 0.2,
      alphaRate: -1,
      alphaRateVar: 0.5,
      lifetime: duration,
      lifetimeVar: duration * 0.4,
      emitRate: 0,
      burstCount: particleCount,
      blendMode: 'screen',
      gravity: new Vector2(0, 100)
    });
  }
  
  /**
   * Create a trail effect following an entity
   */
  createTrail(entity: Entity, options: {
    color?: string,
    emitRate?: number,
    size?: number,
    duration?: number
  } = {}): string {
    const {
      color = '#00ffff',
      emitRate = 20,
      size = 0.5,
      duration = 300
    } = options;
    
    return this.particleSystem.createTrail(entity, color, emitRate);
  }
  
  /**
   * Create a sparkle effect at the specified position
   */
  createSparkle(position: Vector2, options: {
    color?: string,
    size?: number,
    particleCount?: number,
    duration?: number,
    emitRate?: number
  } = {}): string {
    const {
      color = '#ffff00',
      size = 0.7,
      particleCount = 10,
      duration = 800,
      emitRate = 0
    } = options;
    
    return this.particleSystem.createEmitter({
      position,
      positionVar: new Vector2(10, 10),
      velocity: new Vector2(0, -20),
      velocityVar: new Vector2(30, 30),
      acceleration: new Vector2(0, 10),
      scale: new Vector2(size, size),
      scaleVar: new Vector2(0.3 * size, 0.3 * size),
      scaleRate: new Vector2(-0.2, -0.2),
      color,
      colorVar: [color, '#ffffff'],
      alpha: 1,
      alphaVar: 0.2,
      alphaRate: -0.5,
      lifetime: duration,
      lifetimeVar: duration * 0.3,
      emitRate,
      burstCount: particleCount,
      blendMode: 'screen',
      gravity: new Vector2(0, 20)
    });
  }
  
  /**
   * Create a dust effect at the specified position
   */
  createDust(position: Vector2, direction: Vector2 = new Vector2(0, -1), options: {
    color?: string,
    size?: number,
    particleCount?: number,
    duration?: number
  } = {}): string {
    const {
      color = '#cccccc',
      size = 0.6,
      particleCount = 8,
      duration = 600
    } = options;
    
    const normalizedDir = Vector2.normalize(direction);
    
    return this.particleSystem.createEmitter({
      position,
      positionVar: new Vector2(5, 5),
      velocity: new Vector2(normalizedDir.x * 30, normalizedDir.y * 30),
      velocityVar: new Vector2(20, 20),
      scale: new Vector2(size, size),
      scaleVar: new Vector2(0.3 * size, 0.3 * size),
      scaleRate: new Vector2(0.1, 0.1),
      color,
      colorVar: [color, '#999999', '#dddddd'],
      alpha: 0.7,
      alphaVar: 0.2,
      alphaRate: -0.8,
      lifetime: duration,
      lifetimeVar: duration * 0.5,
      emitRate: 0,
      burstCount: particleCount,
      blendMode: 'source-over',
      gravity: new Vector2(0, 10)
    });
  }
  
  /**
   * Create a water splash effect at the specified position
   */
  createWaterSplash(position: Vector2, options: {
    color?: string,
    size?: number,
    particleCount?: number,
    duration?: number,
    emitRate?: number
  } = {}): string {
    const {
      color = '#4488ff',
      size = 0.8,
      particleCount = 20,
      duration = 700,
      emitRate = 0
    } = options;
    
    return this.particleSystem.createEmitter({
      position,
      positionVar: new Vector2(5, 2),
      velocity: new Vector2(0, -80),
      velocityVar: new Vector2(40, 30),
      acceleration: new Vector2(0, 120),
      scale: new Vector2(size, size),
      scaleVar: new Vector2(0.4 * size, 0.4 * size),
      scaleRate: new Vector2(-0.3, -0.3),
      color,
      colorVar: [color, '#66aaff', '#88ccff'],
      alpha: 0.8,
      alphaVar: 0.2,
      alphaRate: -0.6,
      lifetime: duration,
      lifetimeVar: duration * 0.3,
      emitRate,
      burstCount: particleCount,
      blendMode: 'screen',
      gravity: new Vector2(0, 200)
    });
  }
  
  /**
   * Create a fire effect at the specified position
   */
  createFire(position: Vector2, options: {
    color?: string,
    size?: number,
    emitRate?: number,
    duration?: number
  } = {}): string {
    const {
      color = '#ff3300',
      size = 1,
      emitRate = 30,
      duration = 1000
    } = options;
    
    const id = this.particleSystem.createEmitter({
      position,
      positionVar: new Vector2(5 * size, 2 * size),
      velocity: new Vector2(0, -40 * size),
      velocityVar: new Vector2(10 * size, 10 * size),
      acceleration: new Vector2(0, -10),
      scale: new Vector2(size, size),
      scaleVar: new Vector2(0.3 * size, 0.3 * size),
      scaleRate: new Vector2(-0.4, -0.4),
      color,
      colorVar: [color, '#ff8800', '#ffcc00'],
      alpha: 0.8,
      alphaVar: 0.2,
      alphaRate: -0.4,
      lifetime: duration,
      lifetimeVar: duration * 0.5,
      emitRate,
      blendMode: 'screen',
      gravity: new Vector2(0, -50)
    });
    
    const emitter = this.particleSystem.getEmitter(id);
    if (emitter) {
      emitter.start();
    }
    
    return id;
  }
  
  /**
   * Create a smoke effect at the specified position
   */
  createSmoke(position: Vector2, options: {
    color?: string,
    size?: number,
    emitRate?: number,
    duration?: number
  } = {}): string {
    const {
      color = '#888888',
      size = 1.2,
      emitRate = 15,
      duration = 2000
    } = options;
    
    const id = this.particleSystem.createEmitter({
      position,
      positionVar: new Vector2(5 * size, 2 * size),
      velocity: new Vector2(0, -20 * size),
      velocityVar: new Vector2(5 * size, 5 * size),
      acceleration: new Vector2(0, -5),
      scale: new Vector2(size * 0.5, size * 0.5),
      scaleVar: new Vector2(0.2 * size, 0.2 * size),
      scaleRate: new Vector2(0.3, 0.3),
      color,
      colorVar: [color, '#666666', '#aaaaaa'],
      alpha: 0.4,
      alphaVar: 0.1,
      alphaRate: -0.1,
      lifetime: duration,
      lifetimeVar: duration * 0.3,
      emitRate,
      blendMode: 'source-over',
      gravity: new Vector2(0, -10)
    });
    
    const emitter = this.particleSystem.getEmitter(id);
    if (emitter) {
      emitter.start();
    }
    
    return id;
  }
  
  /**
   * Create a coin collect effect at the specified position
   */
  createCoinCollect(position: Vector2, options: {
    color?: string,
    size?: number,
    particleCount?: number,
    duration?: number
  } = {}): string {
    const {
      color = '#ffcc00',
      size = 0.8,
      particleCount = 15,
      duration = 600
    } = options;
    
    return this.particleSystem.createEmitter({
      position,
      positionVar: new Vector2(5, 5),
      velocity: new Vector2(0, -60),
      velocityVar: new Vector2(40, 20),
      scale: new Vector2(size, size),
      scaleVar: new Vector2(0.3 * size, 0.3 * size),
      scaleRate: new Vector2(-0.5, -0.5),
      color,
      colorVar: [color, '#ffff00', '#ffaa00'],
      alpha: 1,
      alphaVar: 0.2,
      alphaRate: -0.8,
      lifetime: duration,
      lifetimeVar: duration * 0.3,
      emitRate: 0,
      burstCount: particleCount,
      blendMode: 'screen',
      gravity: new Vector2(0, 80)
    });
  }
  
  /**
   * Create a level up effect at the specified position
   */
  createLevelUp(position: Vector2, options: {
    color?: string,
    size?: number,
    particleCount?: number,
    duration?: number
  } = {}): string {
    const {
      color = '#00ff88',
      size = 1,
      particleCount = 30,
      duration = 1000
    } = options;
    
    return this.particleSystem.createEmitter({
      position,
      positionVar: new Vector2(20, 5),
      velocity: new Vector2(0, -80),
      velocityVar: new Vector2(30, 20),
      scale: new Vector2(size, size),
      scaleVar: new Vector2(0.5 * size, 0.5 * size),
      scaleRate: new Vector2(-0.2, -0.2),
      color,
      colorVar: [color, '#88ffaa', '#00ffff'],
      alpha: 0.9,
      alphaVar: 0.1,
      alphaRate: -0.5,
      lifetime: duration,
      lifetimeVar: duration * 0.4,
      emitRate: 0,
      burstCount: particleCount,
      blendMode: 'screen',
      gravity: new Vector2(0, 20)
    });
  }
}