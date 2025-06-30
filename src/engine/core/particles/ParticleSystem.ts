/**
 * Particle System for the Game Vibe Engine
 * Provides efficient particle effects for visual feedback
 */

import { BaseSystem } from '../ecs/System';
import { ComponentType } from '../types';
import { Entity } from '../ecs/Entity';
import { ComponentManager } from '../ecs/ComponentManager';
import { Vector2 } from '../math/Vector2';
import { ObjectPool } from '../memory/ObjectPool';

export interface ParticleData {
  position: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  rotation: number;
  rotationSpeed: number;
  scale: Vector2;
  scaleRate: Vector2;
  color: string;
  alpha: number;
  alphaRate: number;
  lifetime: number;
  maxLifetime: number;
  active: boolean;
  texture: string;
}

export class Particle implements ParticleData {
  position: Vector2 = new Vector2();
  velocity: Vector2 = new Vector2();
  acceleration: Vector2 = new Vector2();
  rotation: number = 0;
  rotationSpeed: number = 0;
  scale: Vector2 = new Vector2(1, 1);
  scaleRate: Vector2 = new Vector2(0, 0);
  color: string = '#ffffff';
  alpha: number = 1;
  alphaRate: number = 0;
  lifetime: number = 0;
  maxLifetime: number = 1000;
  active: boolean = false;
  texture: string = '';
  
  reset(): void {
    this.position.set(0, 0);
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.scale.set(1, 1);
    this.scaleRate.set(0, 0);
    this.color = '#ffffff';
    this.alpha = 1;
    this.alphaRate = 0;
    this.lifetime = 0;
    this.maxLifetime = 1000;
    this.active = false;
    this.texture = '';
  }
  
  isInUse(): boolean {
    return this.active;
  }
}

export interface EmitterConfig {
  position: Vector2;
  positionVar: Vector2;
  velocity: Vector2;
  velocityVar: Vector2;
  acceleration: Vector2;
  accelerationVar: Vector2;
  rotation: number;
  rotationVar: number;
  rotationSpeed: number;
  rotationSpeedVar: number;
  scale: Vector2;
  scaleVar: Vector2;
  scaleRate: Vector2;
  scaleRateVar: Vector2;
  color: string;
  colorVar: string[];
  alpha: number;
  alphaVar: number;
  alphaRate: number;
  alphaRateVar: number;
  lifetime: number;
  lifetimeVar: number;
  emitRate: number;
  burstCount: number;
  texture: string;
  blendMode: string;
  gravity: Vector2;
}

export class ParticleEmitter {
  private particles: Particle[] = [];
  config: EmitterConfig;
  private emitTimer: number = 0;
  private active: boolean = false;
  private particlePool: ObjectPool<Particle>;
  
  constructor(config: Partial<EmitterConfig> = {}) {
    // Default configuration
    this.config = {
      position: new Vector2(0, 0),
      positionVar: new Vector2(0, 0),
      velocity: new Vector2(0, 0),
      velocityVar: new Vector2(10, 10),
      acceleration: new Vector2(0, 0),
      accelerationVar: new Vector2(0, 0),
      rotation: 0,
      rotationVar: 0,
      rotationSpeed: 0,
      rotationSpeedVar: 0,
      scale: new Vector2(1, 1),
      scaleVar: new Vector2(0, 0),
      scaleRate: new Vector2(0, 0),
      scaleRateVar: new Vector2(0, 0),
      color: '#ffffff',
      colorVar: [],
      alpha: 1,
      alphaVar: 0,
      alphaRate: 0,
      alphaRateVar: 0,
      lifetime: 1000,
      lifetimeVar: 500,
      emitRate: 10,
      burstCount: 0,
      texture: '',
      blendMode: 'source-over',
      gravity: new Vector2(0, 0),
      ...config
    };
    
    // Initialize particle pool
    this.particlePool = new ObjectPool<Particle>(
      () => new Particle(),
      (p: Particle) => p.reset(),
      100,
      1000
    );
  }
  
  start(): void {
    this.active = true;
    
    // Emit initial burst if configured
    if (this.config.burstCount > 0) {
      this.emitBurst(this.config.burstCount);
    }
  }
  
  stop(): void {
    this.active = false;
  }
  
  update(deltaTime: number): void {
    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Update lifetime
      particle.lifetime += deltaTime * 1000;
      
      // Check if particle is dead
      if (particle.lifetime >= particle.maxLifetime) {
        this.particlePool.release(particle);
        this.particles.splice(i, 1);
        continue;
      }
      
      // Apply gravity
      particle.velocity.x += this.config.gravity.x * deltaTime;
      particle.velocity.y += this.config.gravity.y * deltaTime;
      
      // Apply acceleration
      particle.velocity.x += particle.acceleration.x * deltaTime;
      particle.velocity.y += particle.acceleration.y * deltaTime;
      
      // Update position
      particle.position.x += particle.velocity.x * deltaTime;
      particle.position.y += particle.velocity.y * deltaTime;
      
      // Update rotation
      particle.rotation += particle.rotationSpeed * deltaTime;
      
      // Update scale
      particle.scale.x += particle.scaleRate.x * deltaTime;
      particle.scale.y += particle.scaleRate.y * deltaTime;
      
      // Update alpha
      particle.alpha += particle.alphaRate * deltaTime;
      particle.alpha = Math.max(0, Math.min(1, particle.alpha));
    }
    
    // Emit new particles if active
    if (this.active && this.config.emitRate > 0) {
      this.emitTimer += deltaTime * 1000;
      const emitInterval = 1000 / this.config.emitRate;
      
      while (this.emitTimer >= emitInterval) {
        this.emitParticle();
        this.emitTimer -= emitInterval;
      }
    }
  }
  
  emitBurst(count: number): void {
    for (let i = 0; i < count; i++) {
      this.emitParticle();
    }
  }
  
  private emitParticle(): void {
    const particle = this.particlePool.acquire();
    
    // Position
    particle.position.x = this.config.position.x + (Math.random() * 2 - 1) * this.config.positionVar.x;
    particle.position.y = this.config.position.y + (Math.random() * 2 - 1) * this.config.positionVar.y;
    
    // Velocity
    particle.velocity.x = this.config.velocity.x + (Math.random() * 2 - 1) * this.config.velocityVar.x;
    particle.velocity.y = this.config.velocity.y + (Math.random() * 2 - 1) * this.config.velocityVar.y;
    
    // Acceleration
    particle.acceleration.x = this.config.acceleration.x + (Math.random() * 2 - 1) * this.config.accelerationVar.x;
    particle.acceleration.y = this.config.acceleration.y + (Math.random() * 2 - 1) * this.config.accelerationVar.y;
    
    // Rotation
    particle.rotation = this.config.rotation + (Math.random() * 2 - 1) * this.config.rotationVar;
    particle.rotationSpeed = this.config.rotationSpeed + (Math.random() * 2 - 1) * this.config.rotationSpeedVar;
    
    // Scale
    particle.scale.x = this.config.scale.x + (Math.random() * 2 - 1) * this.config.scaleVar.x;
    particle.scale.y = this.config.scale.y + (Math.random() * 2 - 1) * this.config.scaleVar.y;
    
    // Scale rate
    particle.scaleRate.x = this.config.scaleRate.x + (Math.random() * 2 - 1) * this.config.scaleRateVar.x;
    particle.scaleRate.y = this.config.scaleRate.y + (Math.random() * 2 - 1) * this.config.scaleRateVar.y;
    
    // Color
    if (this.config.colorVar.length > 0) {
      const colorIndex = Math.floor(Math.random() * this.config.colorVar.length);
      particle.color = this.config.colorVar[colorIndex];
    } else {
      particle.color = this.config.color;
    }
    
    // Alpha
    particle.alpha = this.config.alpha + (Math.random() * 2 - 1) * this.config.alphaVar;
    particle.alpha = Math.max(0, Math.min(1, particle.alpha));
    
    // Alpha rate
    particle.alphaRate = this.config.alphaRate + (Math.random() * 2 - 1) * this.config.alphaRateVar;
    
    // Lifetime
    particle.maxLifetime = this.config.lifetime + (Math.random() * 2 - 1) * this.config.lifetimeVar;
    particle.lifetime = 0;
    
    // Texture
    particle.texture = this.config.texture;
    
    // Activate
    particle.active = true;
    
    // Add to particles array
    this.particles.push(particle);
  }
  
  setPosition(position: Vector2): void {
    this.config.position = position;
  }
  
  setConfig(config: Partial<EmitterConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }
  
  getParticleCount(): number {
    return this.particles.length;
  }
  
  getParticles(): Particle[] {
    return this.particles;
  }
  
  clear(): void {
    // Release all particles back to the pool
    for (const particle of this.particles) {
      this.particlePool.release(particle);
    }
    this.particles = [];
  }
  
  isActive(): boolean {
    return this.active;
  }
  
  hasParticles(): boolean {
    return this.particles.length > 0;
  }
}

export class ParticleSystem extends BaseSystem {
  private componentManager: ComponentManager;
  private emitters: Map<string, ParticleEmitter> = new Map();
  private nextEmitterId: number = 1;
  
  constructor(componentManager: ComponentManager) {
    super(
      'ParticleSystem',
      250, // Between physics and rendering
      [] // No required components - particles are managed separately
    );
    this.componentManager = componentManager;
  }
  
  initialize(): void {
    console.log('ParticleSystem initialized');
  }
  
  protected processEntities(entities: Entity[], deltaTime: number): void {
    // Update all emitters
    for (const emitter of this.emitters.values()) {
      emitter.update(deltaTime);
    }
  }
  
  protected renderEntities(entities: Entity[], renderer: any): void {
    // Render all particles
    this.renderParticles(renderer);
  }
  
  private renderParticles(renderer: any): void {
    const ctx = renderer.getContext();
    const camera = renderer.getCamera();
    
    // Save context state
    ctx.save();
    
    // For each emitter
    for (const emitter of this.emitters.values()) {
      // For each particle
      for (const particle of emitter.getParticles()) {
        // Skip inactive particles
        if (!particle.active) continue;
        
        // Calculate screen position
        const screenPos = this.worldToScreen(particle.position, camera);
        
        // Skip if outside screen
        if (this.isOutsideScreen(screenPos, particle.scale, ctx.canvas)) {
          continue;
        }
        
        // Set blend mode
        ctx.globalCompositeOperation = emitter.config.blendMode;
        
        // Set alpha
        ctx.globalAlpha = particle.alpha;
        
        // Draw particle
        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(particle.rotation);
        ctx.scale(particle.scale.x * camera.zoom, particle.scale.y * camera.zoom);
        
        if (particle.texture && particle.texture !== '') {
          // Draw textured particle
          // In a real implementation, this would use the texture manager
          ctx.fillStyle = particle.color;
          ctx.fillRect(-8, -8, 16, 16);
        } else {
          // Draw colored particle
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      }
    }
    
    // Restore context state
    ctx.restore();
  }
  
  private worldToScreen(worldPos: Vector2, camera: any): Vector2 {
    return new Vector2(
      (worldPos.x - camera.position.x) * camera.zoom + camera.bounds.width / 2,
      (worldPos.y - camera.position.y) * camera.zoom + camera.bounds.height / 2
    );
  }
  
  private isOutsideScreen(screenPos: Vector2, scale: Vector2, canvas: HTMLCanvasElement): boolean {
    const size = Math.max(scale.x, scale.y) * 16; // Approximate size
    return (
      screenPos.x + size < 0 ||
      screenPos.x - size > canvas.width ||
      screenPos.y + size < 0 ||
      screenPos.y - size > canvas.height
    );
  }
  
  // Public API
  createEmitter(config: Partial<EmitterConfig> = {}): string {
    const id = `emitter_${this.nextEmitterId++}`;
    const emitter = new ParticleEmitter(config);
    this.emitters.set(id, emitter);
    return id;
  }
  
  getEmitter(id: string): ParticleEmitter | undefined {
    return this.emitters.get(id);
  }
  
  removeEmitter(id: string): void {
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.clear();
      this.emitters.delete(id);
    }
  }
  
  startEmitter(id: string): void {
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.start();
    }
  }
  
  stopEmitter(id: string): void {
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.stop();
    }
  }
  
  createExplosion(position: Vector2, color: string = '#ff0000', particleCount: number = 50): string {
    const id = this.createEmitter({
      position,
      positionVar: new Vector2(5, 5),
      velocity: new Vector2(0, 0),
      velocityVar: new Vector2(100, 100),
      acceleration: new Vector2(0, 0),
      scale: new Vector2(1, 1),
      scaleVar: new Vector2(0.5, 0.5),
      scaleRate: new Vector2(-0.5, -0.5),
      scaleRateVar: new Vector2(0.2, 0.2),
      color,
      colorVar: [color, '#ffff00', '#ff8800'],
      alpha: 1,
      alphaVar: 0.2,
      alphaRate: -1,
      alphaRateVar: 0.5,
      lifetime: 500,
      lifetimeVar: 200,
      emitRate: 0,
      burstCount: particleCount,
      blendMode: 'screen',
      gravity: new Vector2(0, 100)
    });
    
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.start();
      
      // Auto-remove when all particles are gone
      const checkInterval = setInterval(() => {
        if (!emitter.hasParticles()) {
          this.removeEmitter(id);
          clearInterval(checkInterval);
        }
      }, 100);
    }
    
    return id;
  }
  
  createTrail(entity: Entity, color: string = '#00ffff', emitRate: number = 20): string {
    const transform = this.componentManager.getByEntity(entity, ComponentType.Transform);
    if (!transform) {
      console.error('Entity must have a transform component for particle trail');
      return '';
    }
    
    const position = new Vector2(transform.data.position.x, transform.data.position.y);
    
    const id = this.createEmitter({
      position,
      positionVar: new Vector2(2, 2),
      velocity: new Vector2(0, 0),
      velocityVar: new Vector2(10, 10),
      scale: new Vector2(0.5, 0.5),
      scaleVar: new Vector2(0.2, 0.2),
      scaleRate: new Vector2(-0.5, -0.5),
      color,
      alpha: 0.7,
      alphaRate: -1,
      lifetime: 300,
      lifetimeVar: 100,
      emitRate,
      blendMode: 'screen'
    });
    
    const emitter = this.emitters.get(id);
    if (emitter) {
      emitter.start();
      
      // Update position to follow entity
      const updateInterval = setInterval(() => {
        if (!this.emitters.has(id)) {
          clearInterval(updateInterval);
          return;
        }
        
        const transform = this.componentManager.getByEntity(entity, ComponentType.Transform);
        if (transform) {
          emitter.setPosition(new Vector2(transform.data.position.x, transform.data.position.y));
        }
      }, 16); // 60fps
    }
    
    return id;
  }
  
  getEmitterCount(): number {
    return this.emitters.size;
  }
  
  getTotalParticleCount(): number {
    let count = 0;
    for (const emitter of this.emitters.values()) {
      count += emitter.getParticleCount();
    }
    return count;
  }
  
  clearAll(): void {
    for (const emitter of this.emitters.values()) {
      emitter.clear();
    }
    this.emitters.clear();
  }
}