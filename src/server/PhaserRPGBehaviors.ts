/**
 * Phaser RPG Specific Behaviors
 * Enhanced behaviors that replicate the exact Phaser RPG functionality
 */

import { GameEntity, BehaviorData } from './FullGameEngine';
import { BehaviorHandler } from './GameManagers';

// ============= ADVANCED PLAYER MOVEMENT =============

export class PhaserRPGPlayerBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        if (entity.type !== 'player') return;

        const behavior = entity.behavior!;
        const speed = 175; // Match Phaser RPG speed
        const input = world.input;
        
        if (!input) return;

        // Store previous velocity for idle animation selection
        const prevVx = entity.physics.vx;
        const prevVy = entity.physics.vy;

        // Stop any previous movement
        entity.physics.vx = 0;
        entity.physics.vy = 0;

        let isMoving = false;
        let facing = behavior.state.facing || 'down';

        // Horizontal movement (left/right takes precedence)
        if (input.isKeyPressed('a') || input.isKeyPressed('arrowleft')) {
            entity.physics.vx = -speed;
            facing = 'left';
            isMoving = true;
        } else if (input.isKeyPressed('d') || input.isKeyPressed('arrowright')) {
            entity.physics.vx = speed;
            facing = 'right';
            isMoving = true;
        }

        // Vertical movement (only if no horizontal movement)
        if (!isMoving) {
            if (input.isKeyPressed('w') || input.isKeyPressed('arrowup')) {
                entity.physics.vy = -speed;
                facing = 'up';
                isMoving = true;
            } else if (input.isKeyPressed('s') || input.isKeyPressed('arrowdown')) {
                entity.physics.vy = speed;
                facing = 'down';
                isMoving = true;
            }
        }

        // Normalize diagonal movement
        if (entity.physics.vx !== 0 && entity.physics.vy !== 0) {
            const length = Math.sqrt(entity.physics.vx ** 2 + entity.physics.vy ** 2);
            entity.physics.vx = (entity.physics.vx / length) * speed;
            entity.physics.vy = (entity.physics.vy / length) * speed;
        }

        // Store facing direction
        behavior.state.facing = facing;

        // Update animations
        if (entity.animation) {
            if (isMoving) {
                entity.animation.currentAnimation = `walk_${facing}`;
                entity.animation.playing = true;
            } else {
                entity.animation.playing = false;
                // Set idle frame based on previous movement or current facing
                entity.animation.currentAnimation = `idle_${facing}`;
            }
        }

        // Update interaction selector position
        this.updateSelector(entity, facing);
    }

    private updateSelector(entity: GameEntity, facing: string): void {
        const behavior = entity.behavior!;
        if (!behavior.state.selector) {
            behavior.state.selector = { x: entity.x, y: entity.y, width: 16, height: 16 };
        }

        const selector = behavior.state.selector;

        switch (facing) {
            case 'left':
                selector.x = entity.x - 19;
                selector.y = entity.y + 14;
                break;
            case 'right':
                selector.x = entity.x + 35;
                selector.y = entity.y + 14;
                break;
            case 'up':
                selector.x = entity.x + 8;
                selector.y = entity.y - 18;
                break;
            case 'down':
                selector.x = entity.x + 8;
                selector.y = entity.y + 46;
                break;
        }
    }
}

// ============= INTERACTION SYSTEM =============

export class InteractableSignBehaviorEnhanced implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const signText = behavior.properties.text || "This is a sign.";

        // Find player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (!player || !player.behavior?.state.selector) return;

        // Check if player's selector overlaps with this sign
        const selector = player.behavior.state.selector;
        const isOverlapping = this.checkOverlap(
            selector.x, selector.y, selector.width, selector.height,
            entity.x, entity.y, entity.width, entity.height
        );

        if (isOverlapping) {
            // Check for space key press
            if (world.input.isKeyPressed(' ') && !world.state.isTypewriting) {
                // Prevent spam
                if (!behavior.state.lastInteraction || Date.now() - behavior.state.lastInteraction > 1000) {
                    this.startTypewriter(signText, world);
                    behavior.state.lastInteraction = Date.now();
                }
            }
        }
    }

    private checkOverlap(x1: number, y1: number, w1: number, h1: number, 
                        x2: number, y2: number, w2: number, h2: number): boolean {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }

    private startTypewriter(text: string, world: any): void {
        world.state.isTypewriting = true;
        world.ui.showTypewriter = true;
        world.ui.typewriterText = '';
        world.ui.typewriterFullText = text;
        world.ui.typewriterIndex = 0;
        world.ui.typewriterTimer = 0;
    }
}

// ============= CAMERA FOLLOWING SYSTEM =============

export class CameraFollowBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        if (entity.type !== 'player') return;

        const camera = world.camera;
        const targetX = entity.x - world.canvas.width / 2;
        const targetY = entity.y - world.canvas.height / 2;

        // Apply world bounds to camera
        const worldBounds = world.physics.getWorldBounds();
        const boundedX = Math.max(0, Math.min(targetX, worldBounds.width - world.canvas.width));
        const boundedY = Math.max(0, Math.min(targetY, worldBounds.height - world.canvas.height));

        // Smooth camera following
        const followSpeed = 0.1;
        camera.x += (boundedX - camera.x) * followSpeed;
        camera.y += (boundedY - camera.y) * followSpeed;
    }
}

// ============= TILEMAP LAYER BEHAVIOR =============

export class TilemapLayerBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        // This behavior handles multi-layer tilemap rendering
        // It ensures proper depth sorting and collision detection
        
        if (!entity.tilemap || entity.type !== 'tilemap') return;

        const tilemap = entity.tilemap;
        
        // Update collision data for world layer
        if ((tilemap as any).layers && (tilemap as any).layers.World) {
            this.updateCollisionLayer((tilemap as any).layers.World, entities);
        }

        // Process object layer for spawn points and interactive objects
        if ((tilemap as any).layers && (tilemap as any).layers.Objects) {
            this.processObjectLayer((tilemap as any).layers.Objects, entities, world);
        }
    }

    private updateCollisionLayer(worldLayer: any, entities: Map<string, GameEntity>): void {
        // Mark tiles with collision property
        if (worldLayer.data) {
            worldLayer.collisionTiles = new Set();
            worldLayer.data.forEach((tileId: number, index: number) => {
                // In Tuxemon tileset, certain tile IDs have collision
                if (this.tileHasCollision(tileId)) {
                    worldLayer.collisionTiles.add(index);
                }
            });
        }
    }

    private tileHasCollision(tileId: number): boolean {
        // Based on Tuxemon tileset - these tile IDs typically have collision
        const collisionTiles = [149, 150, 151, 173, 174, 175, 196, 197, 198, 199];
        return collisionTiles.includes(tileId);
    }

    private processObjectLayer(objectLayer: any, entities: Map<string, GameEntity>, world: any): void {
        if (!objectLayer.objects) return;

        objectLayer.objects.forEach((obj: any) => {
            switch (obj.type || obj.name) {
                case 'SpawnPoint':
                case 'Spawn Point':
                    this.handleSpawnPoint(obj, entities);
                    break;
                case 'Sign':
                    this.handleSignObject(obj, entities);
                    break;
            }
        });
    }

    private handleSpawnPoint(spawnObj: any, entities: Map<string, GameEntity>): void {
        // Update player spawn position
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (player && !player.behavior?.state.spawned) {
            player.x = spawnObj.x;
            player.y = spawnObj.y;
            if (player.behavior) {
                player.behavior.state.spawned = true;
            }
        }
    }

    private handleSignObject(signObj: any, entities: Map<string, GameEntity>): void {
        // Create sign entity if it doesn't exist
        const signId = `sign_${signObj.x}_${signObj.y}`;
        if (!entities.has(signId)) {
            const signEntity: GameEntity = {
                id: signId,
                name: 'Sign',
                type: 'sign',
                x: signObj.x,
                y: signObj.y,
                width: signObj.width || 32,
                height: signObj.height || 32,
                color: 'transparent',
                physics: { mode: 'static', vx: 0, vy: 0 },
                behavior: {
                    type: 'InteractableSignEnhanced',
                    properties: {
                        text: signObj.properties?.find((p: any) => p.name === 'text')?.value || 'A mysterious sign...'
                    },
                    state: {},
                    timers: {},
                    flags: {}
                },
                visible: false, // Signs are invisible collision areas
                active: true
            };
            entities.set(signId, signEntity);
        }
    }
}

// ============= TYPEWRITER UI BEHAVIOR =============

export class TypewriterUIBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        if (!world.ui.showTypewriter) return;

        const ui = world.ui;
        
        if (ui.typewriterIndex < ui.typewriterFullText.length) {
            ui.typewriterTimer += deltaTime * 1000; // Convert to milliseconds
            
            if (ui.typewriterTimer >= 100) { // 100ms per character
                ui.typewriterText += ui.typewriterFullText[ui.typewriterIndex];
                ui.typewriterIndex++;
                ui.typewriterTimer = 0;
            }
        } else {
            // Text finished, start auto-hide timer
            if (!ui.typewriterHideTimer) {
                ui.typewriterHideTimer = 1500; // 1.5 seconds
            }
            
            ui.typewriterHideTimer -= deltaTime * 1000;
            
            if (ui.typewriterHideTimer <= 0) {
                // Hide typewriter
                ui.showTypewriter = false;
                ui.typewriterText = '';
                ui.typewriterFullText = '';
                ui.typewriterIndex = 0;
                ui.typewriterTimer = 0;
                ui.typewriterHideTimer = 0;
                world.state.isTypewriting = false;
            }
        }
    }
}

// Export all behaviors
export const PhaserRPGBehaviors = {
    PhaserRPGPlayerBehavior,
    InteractableSignBehaviorEnhanced,
    CameraFollowBehavior,
    TilemapLayerBehavior,
    TypewriterUIBehavior
};