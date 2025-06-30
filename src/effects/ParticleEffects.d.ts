/**
 * Predefined particle effects for common game scenarios
 */
import { ParticleSystem } from '../core/particles/ParticleSystem';
import { Vector2 } from '../core/math/Vector2';
import { Entity } from '../core/ecs/Entity';
export declare class ParticleEffects {
    private particleSystem;
    constructor(particleSystem: ParticleSystem);
    /**
     * Create an explosion effect at the specified position
     */
    createExplosion(position: Vector2, options?: {
        color?: string;
        size?: number;
        particleCount?: number;
        duration?: number;
    }): string;
    /**
     * Create a trail effect following an entity
     */
    createTrail(entity: Entity, options?: {
        color?: string;
        emitRate?: number;
        size?: number;
        duration?: number;
    }): string;
    /**
     * Create a sparkle effect at the specified position
     */
    createSparkle(position: Vector2, options?: {
        color?: string;
        size?: number;
        particleCount?: number;
        duration?: number;
        emitRate?: number;
    }): string;
    /**
     * Create a dust effect at the specified position
     */
    createDust(position: Vector2, direction?: Vector2, options?: {
        color?: string;
        size?: number;
        particleCount?: number;
        duration?: number;
    }): string;
    /**
     * Create a water splash effect at the specified position
     */
    createWaterSplash(position: Vector2, options?: {
        color?: string;
        size?: number;
        particleCount?: number;
        duration?: number;
        emitRate?: number;
    }): string;
    /**
     * Create a fire effect at the specified position
     */
    createFire(position: Vector2, options?: {
        color?: string;
        size?: number;
        emitRate?: number;
        duration?: number;
    }): string;
    /**
     * Create a smoke effect at the specified position
     */
    createSmoke(position: Vector2, options?: {
        color?: string;
        size?: number;
        emitRate?: number;
        duration?: number;
    }): string;
    /**
     * Create a coin collect effect at the specified position
     */
    createCoinCollect(position: Vector2, options?: {
        color?: string;
        size?: number;
        particleCount?: number;
        duration?: number;
    }): string;
    /**
     * Create a level up effect at the specified position
     */
    createLevelUp(position: Vector2, options?: {
        color?: string;
        size?: number;
        particleCount?: number;
        duration?: number;
    }): string;
}
//# sourceMappingURL=ParticleEffects.d.ts.map