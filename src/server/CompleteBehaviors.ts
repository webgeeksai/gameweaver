/**
 * Complete Behavior Implementations
 * All the behaviors needed for a full-fledged gaming engine
 */

import { GameEntity, BehaviorData } from './FullGameEngine';
import { BehaviorHandler } from './GameManagers';

// ============= MOVEMENT BEHAVIORS =============

export class RPGMovementBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        if (entity.type !== 'player') return;

        const behavior = entity.behavior!;
        const speed = behavior.properties.speed || 150;
        const runMultiplier = behavior.properties.runMultiplier || 1.5;
        
        // Get input from world
        const input = world.input;
        if (!input) return;

        let moveX = 0;
        let moveY = 0;
        let isRunning = false;

        // WASD movement
        if (input.isKeyPressed('w') || input.isKeyPressed('arrowup')) moveY = -1;
        if (input.isKeyPressed('s') || input.isKeyPressed('arrowdown')) moveY = 1;
        if (input.isKeyPressed('a') || input.isKeyPressed('arrowleft')) moveX = -1;
        if (input.isKeyPressed('d') || input.isKeyPressed('arrowright')) moveX = 1;
        
        // Running (Shift)
        if (input.isKeyPressed('shift')) isRunning = true;

        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707;
            moveY *= 0.707;
        }

        // Apply movement
        const actualSpeed = speed * (isRunning ? runMultiplier : 1);
        entity.physics.vx = moveX * actualSpeed;
        entity.physics.vy = moveY * actualSpeed;

        // Update animation state
        if (entity.animation) {
            let newAnim = 'idle_down';
            if (moveX !== 0 || moveY !== 0) {
                if (Math.abs(moveX) > Math.abs(moveY)) {
                    newAnim = moveX > 0 ? 'walk_right' : 'walk_left';
                } else {
                    newAnim = moveY > 0 ? 'walk_down' : 'walk_up';
                }
            }
            entity.animation.currentAnimation = newAnim;
            entity.animation.playing = (moveX !== 0 || moveY !== 0);
        }
    }
}

export class PlatformerMovementBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const speed = behavior.properties.speed || 200;
        const jumpPower = behavior.properties.jumpPower || 400;
        const input = world.input;
        
        if (!input) return;

        // Horizontal movement
        let moveX = 0;
        if (input.isKeyPressed('a') || input.isKeyPressed('arrowleft')) moveX = -1;
        if (input.isKeyPressed('d') || input.isKeyPressed('arrowright')) moveX = 1;
        
        entity.physics.vx = moveX * speed;

        // Jumping
        if ((input.isKeyPressed(' ') || input.isKeyPressed('w')) && entity.physics.onGround) {
            entity.physics.vy = -jumpPower;
            entity.physics.onGround = false;
        }

        // Update animation
        if (entity.animation) {
            if (!entity.physics.onGround) {
                entity.animation.currentAnimation = 'jump';
            } else if (moveX !== 0) {
                entity.animation.currentAnimation = moveX > 0 ? 'walk_right' : 'walk_left';
            } else {
                entity.animation.currentAnimation = 'idle';
            }
        }
    }
}

export class VehicleMovementBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const acceleration = behavior.properties.acceleration || 300;
        const maxSpeed = behavior.properties.maxSpeed || 400;
        const turnSpeed = behavior.properties.turnSpeed || 180; // degrees per second
        const input = world.input;
        
        if (!input) return;

        // Get current rotation (stored in behavior state)
        if (!behavior.state.rotation) behavior.state.rotation = 0;
        
        let throttle = 0;
        let steering = 0;

        if (input.isKeyPressed('w') || input.isKeyPressed('arrowup')) throttle = 1;
        if (input.isKeyPressed('s') || input.isKeyPressed('arrowdown')) throttle = -1;
        if (input.isKeyPressed('a') || input.isKeyPressed('arrowleft')) steering = -1;
        if (input.isKeyPressed('d') || input.isKeyPressed('arrowright')) steering = 1;

        // Apply steering
        if (Math.abs(entity.physics.vx) > 10 || Math.abs(entity.physics.vy) > 10) {
            behavior.state.rotation += steering * turnSpeed * deltaTime;
        }

        // Apply acceleration in facing direction
        const angleRad = (behavior.state.rotation * Math.PI) / 180;
        const forwardX = Math.cos(angleRad);
        const forwardY = Math.sin(angleRad);

        entity.physics.vx += forwardX * throttle * acceleration * deltaTime;
        entity.physics.vy += forwardY * throttle * acceleration * deltaTime;

        // Limit speed
        const currentSpeed = Math.sqrt(entity.physics.vx ** 2 + entity.physics.vy ** 2);
        if (currentSpeed > maxSpeed) {
            entity.physics.vx = (entity.physics.vx / currentSpeed) * maxSpeed;
            entity.physics.vy = (entity.physics.vy / currentSpeed) * maxSpeed;
        }
    }
}

// ============= AI BEHAVIORS =============

export class NPCDialogueBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const dialogues = behavior.properties.dialogues || [];
        const interactionRange = behavior.properties.interactionRange || 64;
        const canRepeat = behavior.properties.canRepeat !== false;

        // Find player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (!player) return;

        // Check distance to player
        const distance = Math.sqrt(
            (entity.x - player.x) ** 2 + (entity.y - player.y) ** 2
        );

        if (distance <= interactionRange) {
            // Show interaction prompt
            world.ui.showInteractionPrompt = true;
            world.ui.interactionText = "Press SPACE to talk";

            // Check for interaction
            if (world.input.isKeyPressed(' ')) {
                this.startDialogue(entity, behavior, dialogues, world);
            }
        } else {
            world.ui.showInteractionPrompt = false;
        }
    }

    private startDialogue(entity: GameEntity, behavior: BehaviorData, dialogues: string[], world: any): void {
        if (!behavior.state.currentDialogue) behavior.state.currentDialogue = 0;
        if (!behavior.state.lastInteraction) behavior.state.lastInteraction = 0;

        // Prevent spam clicking
        const now = Date.now();
        if (now - behavior.state.lastInteraction < 1000) return;
        behavior.state.lastInteraction = now;

        if (behavior.state.currentDialogue < dialogues.length) {
            const dialogue = dialogues[behavior.state.currentDialogue];
            world.ui.showDialogue(entity.name, dialogue);
            behavior.state.currentDialogue++;
        } else if (behavior.properties.canRepeat) {
            behavior.state.currentDialogue = 0;
            const dialogue = dialogues[0];
            world.ui.showDialogue(entity.name, dialogue);
        } else {
            world.ui.showDialogue(entity.name, "...");
        }
    }
}

export class WildCreatureBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const movePattern = behavior.properties.movePattern || 'wander';
        const speed = behavior.properties.speed || 50;
        const fleeDistance = behavior.properties.fleeDistance || 80;

        // Initialize behavior state
        if (!behavior.state.initialized) {
            behavior.state.homeX = entity.x;
            behavior.state.homeY = entity.y;
            behavior.state.wanderTimer = 0;
            behavior.state.targetX = entity.x;
            behavior.state.targetY = entity.y;
            behavior.state.patrolIndex = 0;
            behavior.state.initialized = true;
        }

        // Find player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (player) {
            const distanceToPlayer = Math.sqrt(
                (entity.x - player.x) ** 2 + (entity.y - player.y) ** 2
            );

            // Flee from player if too close
            if (distanceToPlayer <= fleeDistance && !behavior.properties.aggressive) {
                this.fleeFromPlayer(entity, player, speed * 1.5);
                return;
            }

            // Aggressive creatures chase player
            if (behavior.properties.aggressive && distanceToPlayer <= fleeDistance * 2) {
                this.chasePlayer(entity, player, speed * 1.2);
                return;
            }
        }

        // Execute movement pattern
        switch (movePattern) {
            case 'wander':
                this.wanderBehavior(entity, behavior, speed, deltaTime);
                break;
            case 'patrol':
                this.patrolBehavior(entity, behavior, speed, deltaTime);
                break;
            case 'territorial':
                this.territorialBehavior(entity, behavior, speed, deltaTime);
                break;
            case 'guard':
                this.guardBehavior(entity, behavior, speed, deltaTime);
                break;
        }
    }

    private wanderBehavior(entity: GameEntity, behavior: BehaviorData, speed: number, deltaTime: number): void {
        const wanderRadius = behavior.properties.wanderRadius || 100;
        
        behavior.state.wanderTimer -= deltaTime;
        
        if (behavior.state.wanderTimer <= 0) {
            // Pick new target
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * wanderRadius;
            behavior.state.targetX = behavior.state.homeX + Math.cos(angle) * distance;
            behavior.state.targetY = behavior.state.homeY + Math.sin(angle) * distance;
            behavior.state.wanderTimer = Math.random() * 3 + 2; // 2-5 seconds
        }

        this.moveToTarget(entity, behavior.state.targetX, behavior.state.targetY, speed);
    }

    private patrolBehavior(entity: GameEntity, behavior: BehaviorData, speed: number, deltaTime: number): void {
        const patrolPoints = behavior.properties.patrolPoints || [];
        if (patrolPoints.length === 0) return;

        const currentTarget = patrolPoints[behavior.state.patrolIndex];
        const distance = Math.sqrt(
            (entity.x - currentTarget.x) ** 2 + (entity.y - currentTarget.y) ** 2
        );

        if (distance < 16) {
            behavior.state.patrolIndex = (behavior.state.patrolIndex + 1) % patrolPoints.length;
        }

        this.moveToTarget(entity, currentTarget.x, currentTarget.y, speed);
    }

    private territorialBehavior(entity: GameEntity, behavior: BehaviorData, speed: number, deltaTime: number): void {
        const territory = behavior.properties.territory;
        if (!territory) return;

        const distanceFromCenter = Math.sqrt(
            (entity.x - territory.x) ** 2 + (entity.y - territory.y) ** 2
        );

        if (distanceFromCenter > territory.radius) {
            // Return to territory
            this.moveToTarget(entity, territory.x, territory.y, speed);
        } else {
            // Wander within territory
            this.wanderBehavior(entity, behavior, speed, deltaTime);
        }
    }

    private guardBehavior(entity: GameEntity, behavior: BehaviorData, speed: number, deltaTime: number): void {
        const guardPost = behavior.properties.guardPost || { x: behavior.state.homeX, y: behavior.state.homeY };
        const guardRadius = behavior.properties.guardRadius || 50;

        const distanceFromPost = Math.sqrt(
            (entity.x - guardPost.x) ** 2 + (entity.y - guardPost.y) ** 2
        );

        if (distanceFromPost > guardRadius) {
            this.moveToTarget(entity, guardPost.x, guardPost.y, speed);
        }
        // Otherwise stay put and watch
    }

    private fleeFromPlayer(entity: GameEntity, player: GameEntity, speed: number): void {
        const dirX = entity.x - player.x;
        const dirY = entity.y - player.y;
        const distance = Math.sqrt(dirX ** 2 + dirY ** 2);
        
        if (distance > 0) {
            entity.physics.vx = (dirX / distance) * speed;
            entity.physics.vy = (dirY / distance) * speed;
        }
    }

    private chasePlayer(entity: GameEntity, player: GameEntity, speed: number): void {
        const dirX = player.x - entity.x;
        const dirY = player.y - entity.y;
        const distance = Math.sqrt(dirX ** 2 + dirY ** 2);
        
        if (distance > 0) {
            entity.physics.vx = (dirX / distance) * speed;
            entity.physics.vy = (dirY / distance) * speed;
        }
    }

    private moveToTarget(entity: GameEntity, targetX: number, targetY: number, speed: number): void {
        const dirX = targetX - entity.x;
        const dirY = targetY - entity.y;
        const distance = Math.sqrt(dirX ** 2 + dirY ** 2);
        
        if (distance > 16) {
            entity.physics.vx = (dirX / distance) * speed;
            entity.physics.vy = (dirY / distance) * speed;
        } else {
            entity.physics.vx = 0;
            entity.physics.vy = 0;
        }
    }
}

export class EnemyAIBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const detectionRange = behavior.properties.detectionRange || 100;
        const attackRange = behavior.properties.attackRange || 32;
        const speed = behavior.properties.speed || 80;

        // Initialize state
        if (!behavior.state.currentState) {
            behavior.state.currentState = 'patrol';
            behavior.state.alertTimer = 0;
            behavior.state.attackCooldown = 0;
            behavior.state.lastSeenPlayerX = 0;
            behavior.state.lastSeenPlayerY = 0;
        }

        // Update timers
        behavior.state.alertTimer -= deltaTime;
        behavior.state.attackCooldown -= deltaTime;

        // Find player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (!player) {
            behavior.state.currentState = 'patrol';
            return;
        }

        const distanceToPlayer = Math.sqrt(
            (entity.x - player.x) ** 2 + (entity.y - player.y) ** 2
        );

        // State machine
        switch (behavior.state.currentState) {
            case 'patrol':
                this.patrolState(entity, behavior, player, distanceToPlayer, detectionRange, speed);
                break;
            case 'alert':
                this.alertState(entity, behavior, player, distanceToPlayer, attackRange, speed);
                break;
            case 'combat':
                this.combatState(entity, behavior, player, distanceToPlayer, attackRange, speed, world);
                break;
            case 'search':
                this.searchState(entity, behavior, player, distanceToPlayer, detectionRange, speed);
                break;
        }
    }

    private patrolState(entity: GameEntity, behavior: BehaviorData, player: GameEntity, distance: number, detectionRange: number, speed: number): void {
        if (distance <= detectionRange) {
            behavior.state.currentState = 'alert';
            behavior.state.alertTimer = 2.0; // 2 second alert phase
            behavior.state.lastSeenPlayerX = player.x;
            behavior.state.lastSeenPlayerY = player.y;
        } else {
            // Basic patrol (reuse patrol behavior)
            if (!behavior.properties.patrolPoints) {
                behavior.properties.patrolPoints = [
                    { x: entity.x - 50, y: entity.y },
                    { x: entity.x + 50, y: entity.y }
                ];
                behavior.state.patrolIndex = 0;
            }
            // Use patrol logic from WildCreatureBehavior
        }
    }

    private alertState(entity: GameEntity, behavior: BehaviorData, player: GameEntity, distance: number, attackRange: number, speed: number): void {
        // Face the player, show alert indicator
        entity.physics.vx = 0;
        entity.physics.vy = 0;

        if (behavior.state.alertTimer <= 0) {
            if (distance <= attackRange * 2) {
                behavior.state.currentState = 'combat';
            } else {
                behavior.state.currentState = 'search';
            }
        }
    }

    private combatState(entity: GameEntity, behavior: BehaviorData, player: GameEntity, distance: number, attackRange: number, speed: number, world: any): void {
        if (distance > attackRange * 3) {
            behavior.state.currentState = 'search';
            return;
        }

        if (distance > attackRange) {
            // Move towards player
            const dirX = player.x - entity.x;
            const dirY = player.y - entity.y;
            const dist = Math.sqrt(dirX ** 2 + dirY ** 2);
            entity.physics.vx = (dirX / dist) * speed;
            entity.physics.vy = (dirY / dist) * speed;
        } else {
            // Attack
            if (behavior.state.attackCooldown <= 0) {
                this.performAttack(entity, player, world);
                behavior.state.attackCooldown = 1.5; // 1.5 second attack cooldown
            }
        }
    }

    private searchState(entity: GameEntity, behavior: BehaviorData, player: GameEntity, distance: number, detectionRange: number, speed: number): void {
        if (distance <= detectionRange) {
            behavior.state.currentState = 'alert';
            behavior.state.alertTimer = 1.0;
            return;
        }

        // Move to last known position
        const dirX = behavior.state.lastSeenPlayerX - entity.x;
        const dirY = behavior.state.lastSeenPlayerY - entity.y;
        const dist = Math.sqrt(dirX ** 2 + dirY ** 2);

        if (dist > 16) {
            entity.physics.vx = (dirX / dist) * (speed * 0.7);
            entity.physics.vy = (dirY / dist) * (speed * 0.7);
        } else {
            // Reached last known position, return to patrol
            behavior.state.currentState = 'patrol';
        }
    }

    private performAttack(entity: GameEntity, player: GameEntity, world: any): void {
        const damage = entity.behavior!.properties.attackDamage || 10;
        
        // Deal damage to player
        if (player.stats) {
            player.stats.health = Math.max(0, player.stats.health - damage);
            
            // Show damage effect
            world.ui.showDamageNumber(player.x, player.y - 20, damage);
            world.audio.playSound('enemy_attack');
            
            // Camera shake
            world.camera.shake = { x: 0, y: 0, duration: 200 };
        }
    }
}

// ============= INTERACTION BEHAVIORS =============

export class CollectibleItemBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        if (!entity.visible) {
            // Handle respawn timer
            const behavior = entity.behavior!;
            const respawnTime = behavior.properties.respawnTime || 0;
            
            if (respawnTime > 0) {
                if (!behavior.state.respawnTimer) behavior.state.respawnTimer = respawnTime;
                behavior.state.respawnTimer -= deltaTime * 1000;
                
                if (behavior.state.respawnTimer <= 0) {
                    entity.visible = true;
                    entity.active = true;
                    delete behavior.state.respawnTimer;
                }
            }
            return;
        }

        // Glow effect
        if (entity.behavior!.properties.glowEffect) {
            const time = Date.now() * 0.005;
            const glowAlpha = 0.3 + Math.sin(time) * 0.2;
            // This would be handled in rendering
        }

        // Check for collection by player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (!player) return;

        const distance = Math.sqrt(
            (entity.x - player.x) ** 2 + (entity.y - player.y) ** 2
        );

        if (distance <= 24) { // Collection range
            this.collectItem(entity, player, world);
        }
    }

    private collectItem(entity: GameEntity, player: GameEntity, world: any): void {
        const behavior = entity.behavior!;
        const itemType = behavior.properties.itemType || 'misc';
        const itemName = behavior.properties.itemName || 'Item';
        const amount = behavior.properties.amount || 1;

        // Add to player inventory
        if (player.inventory) {
            const existingItem = player.inventory.find(item => item.name === itemName);
            if (existingItem && existingItem.stackable) {
                existingItem.quantity += amount;
            } else {
                player.inventory.push({
                    id: `item_${Date.now()}`,
                    name: itemName,
                    type: itemType,
                    quantity: amount,
                    description: behavior.properties.description || '',
                    icon: '',
                    usable: true,
                    stackable: true,
                    value: behavior.properties.value || 1
                });
            }
        }

        // Play sound
        if (behavior.properties.collectSound) {
            world.audio.playSound(behavior.properties.collectSound);
        }

        // Show notification
        world.ui.showNotification(`Collected ${itemName}${amount > 1 ? ` x${amount}` : ''}`);

        // Hide item
        entity.visible = false;
        entity.active = false;

        // Start respawn timer if applicable
        const respawnTime = behavior.properties.respawnTime || 0;
        if (respawnTime > 0) {
            behavior.state.respawnTimer = respawnTime;
        }
    }
}

export class InteractableSignBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const text = behavior.properties.text || "This is a sign.";
        const interactionRange = behavior.properties.interactionRange || 48;

        // Find player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (!player) return;

        const distance = Math.sqrt(
            (entity.x - player.x) ** 2 + (entity.y - player.y) ** 2
        );

        if (distance <= interactionRange) {
            world.ui.showInteractionPrompt = true;
            world.ui.interactionText = "Press SPACE to read";

            if (world.input.isKeyPressed(' ')) {
                // Prevent spam
                if (!behavior.state.lastInteraction || Date.now() - behavior.state.lastInteraction > 1000) {
                    world.ui.showDialogue("Sign", text);
                    behavior.state.lastInteraction = Date.now();
                }
            }
        } else {
            world.ui.showInteractionPrompt = false;
        }
    }
}

export class TreasureChestBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const contents = behavior.properties.contents || [];
        const requiresKey = behavior.properties.requiresKey || false;
        const keyId = behavior.properties.keyId || 'chest_key';
        const openOnce = behavior.properties.openOnce !== false;

        // Check if already opened
        if (behavior.state.opened && openOnce) return;

        // Find player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (!player) return;

        const distance = Math.sqrt(
            (entity.x - player.x) ** 2 + (entity.y - player.y) ** 2
        );

        if (distance <= 48) {
            let canOpen = true;
            let promptText = "Press SPACE to open chest";

            if (requiresKey) {
                const hasKey = player.inventory?.some(item => item.id === keyId) || false;
                if (!hasKey) {
                    canOpen = false;
                    promptText = "Requires a key";
                }
            }

            world.ui.showInteractionPrompt = true;
            world.ui.interactionText = promptText;

            if (canOpen && world.input.isKeyPressed(' ')) {
                this.openChest(entity, player, contents, world);
            }
        } else {
            world.ui.showInteractionPrompt = false;
        }
    }

    private openChest(entity: GameEntity, player: GameEntity, contents: string[], world: any): void {
        const behavior = entity.behavior!;
        
        // Prevent spam
        if (behavior.state.lastInteraction && Date.now() - behavior.state.lastInteraction < 1000) return;
        behavior.state.lastInteraction = Date.now();

        // Mark as opened
        behavior.state.opened = true;

        // Play sound
        if (behavior.properties.openSound) {
            world.audio.playSound(behavior.properties.openSound);
        }

        // Give contents to player
        if (player.inventory) {
            contents.forEach(itemName => {
                player.inventory!.push({
                    id: `item_${Date.now()}_${Math.random()}`,
                    name: itemName,
                    type: 'treasure',
                    quantity: 1,
                    description: `Found in a treasure chest`,
                    icon: '',
                    usable: true,
                    stackable: false,
                    value: 100
                });
            });
        }

        // Show notification
        world.ui.showNotification(`Found: ${contents.join(', ')}`);

        // Change entity appearance (opened chest)
        entity.color = '#8B4513'; // Darker brown for opened chest
    }
}

// ============= ENVIRONMENT BEHAVIORS =============

export class DoorBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const requiresKey = behavior.properties.requiresKey || false;
        const keyId = behavior.properties.keyId;
        const autoClose = behavior.properties.autoClose !== false;
        const autoCloseDelay = behavior.properties.autoCloseDelay || 3000;

        // Initialize state
        if (behavior.state.isOpen === undefined) {
            behavior.state.isOpen = false;
            behavior.state.closeTimer = 0;
        }

        // Handle auto-close
        if (behavior.state.isOpen && autoClose) {
            behavior.state.closeTimer -= deltaTime * 1000;
            if (behavior.state.closeTimer <= 0) {
                behavior.state.isOpen = false;
                entity.color = behavior.properties.closedColor || '#8B4513';
            }
        }

        // Find player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (!player) return;

        const distance = Math.sqrt(
            (entity.x - player.x) ** 2 + (entity.y - player.y) ** 2
        );

        if (distance <= 48) {
            let canOpen = true;
            let promptText = behavior.state.isOpen ? "Press SPACE to close" : "Press SPACE to open";

            if (requiresKey && !behavior.state.isOpen) {
                const hasKey = player.inventory?.some(item => item.id === keyId) || false;
                if (!hasKey) {
                    canOpen = false;
                    promptText = "Requires a key";
                }
            }

            world.ui.showInteractionPrompt = true;
            world.ui.interactionText = promptText;

            if (canOpen && world.input.isKeyPressed(' ')) {
                this.toggleDoor(entity, behavior, world);
            }
        } else {
            world.ui.showInteractionPrompt = false;
        }
    }

    private toggleDoor(entity: GameEntity, behavior: BehaviorData, world: any): void {
        // Prevent spam
        if (behavior.state.lastInteraction && Date.now() - behavior.state.lastInteraction < 500) return;
        behavior.state.lastInteraction = Date.now();

        behavior.state.isOpen = !behavior.state.isOpen;

        if (behavior.state.isOpen) {
            entity.color = behavior.properties.openColor || '#654321';
            behavior.state.closeTimer = behavior.properties.autoCloseDelay || 3000;
            world.audio.playSound('door_open');
        } else {
            entity.color = behavior.properties.closedColor || '#8B4513';
            world.audio.playSound('door_close');
        }
    }
}

export class ZoneTransitionBehavior implements BehaviorHandler {
    update(entity: GameEntity, deltaTime: number, world: any, entities: Map<string, GameEntity>): void {
        const behavior = entity.behavior!;
        const targetScene = behavior.properties.targetScene;
        const spawnPoint = behavior.properties.spawnPoint || { x: 100, y: 100 };
        const transitionType = behavior.properties.transitionType || 'fade';
        const requiredCondition = behavior.properties.requiredCondition;

        // Find player
        const player = Array.from(entities.values()).find(e => e.type === 'player');
        if (!player) return;

        // Check if player is in transition zone
        const distance = Math.sqrt(
            (entity.x - player.x) ** 2 + (entity.y - player.y) ** 2
        );

        if (distance <= 32) {
            // Check conditions
            let canTransition = true;
            if (requiredCondition) {
                canTransition = this.checkCondition(requiredCondition, player, world);
            }

            if (canTransition) {
                world.ui.showInteractionPrompt = true;
                world.ui.interactionText = "Press SPACE to enter";

                if (world.input.isKeyPressed(' ')) {
                    this.initiateTransition(targetScene, spawnPoint, transitionType, world);
                }
            } else {
                world.ui.showInteractionPrompt = true;
                world.ui.interactionText = "Cannot enter yet";
            }
        } else {
            world.ui.showInteractionPrompt = false;
        }
    }

    private checkCondition(condition: string, player: GameEntity, world: any): boolean {
        // Parse and check various conditions
        if (condition.includes('level_')) {
            const requiredLevel = parseInt(condition.split('_')[1]);
            return (player.level || 1) >= requiredLevel;
        }
        if (condition.includes('item_')) {
            const requiredItem = condition.split('_')[1];
            return player.inventory?.some(item => item.name.includes(requiredItem)) || false;
        }
        if (condition.includes('quest_')) {
            const questId = condition.split('_')[1];
            return world.quest.isQuestCompleted(questId);
        }
        return true;
    }

    private initiateTransition(targetScene: string, spawnPoint: any, transitionType: string, world: any): void {
        world.scene.transition(targetScene, spawnPoint, transitionType);
    }
}

// Export all behaviors
export const AllBehaviors = {
    RPGMovementBehavior,
    PlatformerMovementBehavior,
    VehicleMovementBehavior,
    NPCDialogueBehavior,
    WildCreatureBehavior,
    EnemyAIBehavior,
    CollectibleItemBehavior,
    InteractableSignBehavior,
    TreasureChestBehavior,
    DoorBehavior,
    ZoneTransitionBehavior
};