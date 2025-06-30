/**
 * Comprehensive RPG Behavior System
 * Implements all the behaviors needed for the full RPG demo
 */

import { Behavior, BehaviorData } from './Behavior';
import { Entity } from '../core/Entity';
import { Vector2 } from '../math/Vector2';

// ============= MOVEMENT BEHAVIORS =============

export interface RPGMovementData extends BehaviorData {
    speed: number;
    smoothMovement: boolean;
    gridBased: boolean;
    runMultiplier: number;
}

export class RPGMovement extends Behavior {
    private speed: number;
    private smoothMovement: boolean;
    private gridBased: boolean;
    private runMultiplier: number;
    private currentDirection: Vector2 = new Vector2(0, 0);
    private isRunning: boolean = false;
    private currentAnimation: string = "idle_down";

    constructor(id: string, entityId: string, data: RPGMovementData) {
        super(id, entityId, data);
        this.speed = data.speed || 150;
        this.smoothMovement = data.smoothMovement !== false;
        this.gridBased = data.gridBased || false;
        this.runMultiplier = data.runMultiplier || 1.5;
    }

    update(deltaTime: number, entity: Entity): void {
        this.handleInput(entity);
        this.updateAnimation(entity);
        this.applyMovement(entity, deltaTime);
    }

    private handleInput(entity: Entity): void {
        const inputSystem = entity.getInputSystem();
        if (!inputSystem) return;

        let moveX = 0;
        let moveY = 0;

        // WASD and Arrow key movement
        if (inputSystem.isKeyPressed('KeyW') || inputSystem.isKeyPressed('ArrowUp')) {
            moveY = -1;
        }
        if (inputSystem.isKeyPressed('KeyS') || inputSystem.isKeyPressed('ArrowDown')) {
            moveY = 1;
        }
        if (inputSystem.isKeyPressed('KeyA') || inputSystem.isKeyPressed('ArrowLeft')) {
            moveX = -1;
        }
        if (inputSystem.isKeyPressed('KeyD') || inputSystem.isKeyPressed('ArrowRight')) {
            moveX = 1;
        }

        // Running (Shift key)
        this.isRunning = inputSystem.isKeyPressed('ShiftLeft') || inputSystem.isKeyPressed('ShiftRight');

        // Normalize diagonal movement
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.707; // √2/2
            moveY *= 0.707;
        }

        this.currentDirection.set(moveX, moveY);
    }

    private updateAnimation(entity: Entity): void {
        const sprite = entity.getSpriteComponent();
        if (!sprite) return;

        let newAnimation = "idle_down";

        if (this.currentDirection.magnitude() > 0) {
            // Determine direction for animation
            if (Math.abs(this.currentDirection.x) > Math.abs(this.currentDirection.y)) {
                // Horizontal movement
                newAnimation = this.currentDirection.x > 0 ? "walk_right" : "walk_left";
            } else {
                // Vertical movement
                newAnimation = this.currentDirection.y > 0 ? "walk_down" : "walk_up";
            }
        } else {
            // Idle animation based on last direction
            if (this.currentAnimation.includes("right")) {
                newAnimation = "idle_right";
            } else if (this.currentAnimation.includes("left")) {
                newAnimation = "idle_left";
            } else if (this.currentAnimation.includes("up")) {
                newAnimation = "idle_up";
            } else {
                newAnimation = "idle_down";
            }
        }

        if (newAnimation !== this.currentAnimation) {
            this.currentAnimation = newAnimation;
            sprite.playAnimation(newAnimation);
        }
    }

    private applyMovement(entity: Entity, deltaTime: number): void {
        const physics = entity.getPhysicsComponent();
        if (!physics || this.currentDirection.magnitude() === 0) return;

        let actualSpeed = this.speed;
        if (this.isRunning) {
            actualSpeed *= this.runMultiplier;
        }

        const velocity = this.currentDirection.clone().scale(actualSpeed);
        physics.setVelocity(velocity);
    }
}

// ============= NPC BEHAVIORS =============

export interface NPCDialogueData extends BehaviorData {
    dialogues: string[];
    interactionRange: number;
    canRepeat: boolean;
    blocking?: boolean;
    shopInventory?: string[];
}

export class NPCDialogue extends Behavior {
    private dialogues: string[];
    private currentDialogueIndex: number = 0;
    private interactionRange: number;
    private canRepeat: boolean;
    private blocking: boolean;
    private shopInventory: string[];
    private isInConversation: boolean = false;

    constructor(id: string, entityId: string, data: NPCDialogueData) {
        super(id, entityId, data);
        this.dialogues = data.dialogues || [];
        this.interactionRange = data.interactionRange || 64;
        this.canRepeat = data.canRepeat !== false;
        this.blocking = data.blocking || false;
        this.shopInventory = data.shopInventory || [];
    }

    update(deltaTime: number, entity: Entity): void {
        this.checkForPlayerInteraction(entity);
    }

    private checkForPlayerInteraction(entity: Entity): void {
        const player = this.findPlayerEntity(entity);
        if (!player) return;

        const distance = this.getDistanceToPlayer(entity, player);
        
        if (distance <= this.interactionRange) {
            this.showInteractionPrompt(true);
            
            if (this.isInteractionPressed()) {
                this.startDialogue();
            }
        } else {
            this.showInteractionPrompt(false);
        }
    }

    private startDialogue(): void {
        if (this.isInConversation) return;

        this.isInConversation = true;
        
        if (this.currentDialogueIndex >= this.dialogues.length) {
            if (this.canRepeat) {
                this.currentDialogueIndex = 0;
            } else {
                this.endDialogue();
                return;
            }
        }

        this.displayDialogue(this.dialogues[this.currentDialogueIndex]);
        this.currentDialogueIndex++;
    }

    private displayDialogue(text: string): void {
        // This would integrate with the UI system
        console.log(`[NPC Dialogue]: ${text}`);
        
        // Auto-advance after 3 seconds or wait for input
        setTimeout(() => {
            if (this.currentDialogueIndex >= this.dialogues.length && !this.canRepeat) {
                this.endDialogue();
            } else {
                this.isInConversation = false;
            }
        }, 3000);
    }

    private endDialogue(): void {
        this.isInConversation = false;
        console.log("[NPC Dialogue]: Conversation ended");
    }

    private findPlayerEntity(entity: Entity): Entity | null {
        // This would use the entity manager to find the player
        return null; // Placeholder
    }

    private getDistanceToPlayer(entity: Entity, player: Entity): number {
        const entityPos = entity.getTransformComponent()?.getPosition();
        const playerPos = player.getTransformComponent()?.getPosition();
        
        if (!entityPos || !playerPos) return Infinity;
        
        return entityPos.distanceTo(playerPos);
    }

    private isInteractionPressed(): boolean {
        // Check for SPACE key press
        return false; // Placeholder
    }

    private showInteractionPrompt(show: boolean): void {
        // This would show/hide the interaction UI
        if (show) {
            console.log("[Interaction]: Press SPACE to talk");
        }
    }
}

// ============= CREATURE BEHAVIORS =============

export interface WildCreatureBehaviorData extends BehaviorData {
    movePattern: 'wander' | 'patrol' | 'territorial';
    wanderRadius?: number;
    patrolPoints?: Vector2[];
    territory?: { x: number; y: number; radius: number };
    speed: number;
    fleeDistance?: number;
    encounterChance: number;
    species: string;
    level: number;
    aggressive?: boolean;
}

export class WildCreatureBehavior extends Behavior {
    private movePattern: string;
    private wanderRadius: number;
    private patrolPoints: Vector2[];
    private territory: { x: number; y: number; radius: number } | null;
    private speed: number;
    private fleeDistance: number;
    private encounterChance: number;
    private species: string;
    private level: number;
    private aggressive: boolean;
    
    private currentPatrolIndex: number = 0;
    private wanderTimer: number = 0;
    private wanderTarget: Vector2 | null = null;
    private homePosition: Vector2;
    private isFleeing: boolean = false;

    constructor(id: string, entityId: string, data: WildCreatureBehaviorData) {
        super(id, entityId, data);
        this.movePattern = data.movePattern || 'wander';
        this.wanderRadius = data.wanderRadius || 100;
        this.patrolPoints = data.patrolPoints || [];
        this.territory = data.territory || null;
        this.speed = data.speed || 50;
        this.fleeDistance = data.fleeDistance || 80;
        this.encounterChance = data.encounterChance || 0.3;
        this.species = data.species || "Unknown";
        this.level = data.level || 1;
        this.aggressive = data.aggressive || false;
        this.homePosition = new Vector2(0, 0);
    }

    update(deltaTime: number, entity: Entity): void {
        this.checkPlayerProximity(entity);
        
        if (!this.isFleeing) {
            this.executeMovementPattern(entity, deltaTime);
        } else {
            this.executeFleeBehavior(entity, deltaTime);
        }
    }

    private checkPlayerProximity(entity: Entity): void {
        const player = this.findPlayerEntity(entity);
        if (!player) return;

        const distance = this.getDistanceToPlayer(entity, player);
        
        if (distance <= this.fleeDistance && !this.aggressive) {
            this.isFleeing = true;
            this.fleeFromPlayer(entity, player);
        } else if (distance <= 32 && this.aggressive) {
            this.initiateEncounter(entity, player);
        } else if (distance > this.fleeDistance * 2) {
            this.isFleeing = false;
        }
    }

    private executeMovementPattern(entity: Entity, deltaTime: number): void {
        const physics = entity.getPhysicsComponent();
        if (!physics) return;

        switch (this.movePattern) {
            case 'wander':
                this.executeWanderPattern(entity, physics, deltaTime);
                break;
            case 'patrol':
                this.executePatrolPattern(entity, physics, deltaTime);
                break;
            case 'territorial':
                this.executeTerritorialPattern(entity, physics, deltaTime);
                break;
        }
    }

    private executeWanderPattern(entity: Entity, physics: any, deltaTime: number): void {
        this.wanderTimer -= deltaTime;
        
        if (this.wanderTimer <= 0 || !this.wanderTarget) {
            // Pick new random target within wander radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * this.wanderRadius;
            
            this.wanderTarget = new Vector2(
                this.homePosition.x + Math.cos(angle) * distance,
                this.homePosition.y + Math.sin(angle) * distance
            );
            
            this.wanderTimer = Math.random() * 3 + 2; // 2-5 seconds
        }

        this.moveTowardsTarget(entity, this.wanderTarget, physics);
    }

    private executePatrolPattern(entity: Entity, physics: any, deltaTime: number): void {
        if (this.patrolPoints.length === 0) return;

        const currentTarget = this.patrolPoints[this.currentPatrolIndex];
        const position = entity.getTransformComponent()?.getPosition();
        
        if (position && position.distanceTo(currentTarget) < 16) {
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
        }

        this.moveTowardsTarget(entity, currentTarget, physics);
    }

    private executeTerritorialPattern(entity: Entity, physics: any, deltaTime: number): void {
        if (!this.territory) return;

        const position = entity.getTransformComponent()?.getPosition();
        if (!position) return;

        const territoryCenter = new Vector2(this.territory.x, this.territory.y);
        const distanceFromCenter = position.distanceTo(territoryCenter);

        if (distanceFromCenter > this.territory.radius) {
            // Return to territory
            this.moveTowardsTarget(entity, territoryCenter, physics);
        } else {
            // Patrol within territory
            this.executeWanderPattern(entity, physics, deltaTime);
        }
    }

    private moveTowardsTarget(entity: Entity, target: Vector2, physics: any): void {
        const position = entity.getTransformComponent()?.getPosition();
        if (!position) return;

        const direction = target.clone().subtract(position).normalize();
        const velocity = direction.scale(this.speed);
        
        physics.setVelocity(velocity);
    }

    private fleeFromPlayer(entity: Entity, player: Entity): void {
        const entityPos = entity.getTransformComponent()?.getPosition();
        const playerPos = player.getTransformComponent()?.getPosition();
        const physics = entity.getPhysicsComponent();
        
        if (!entityPos || !playerPos || !physics) return;

        // Flee in opposite direction from player
        const fleeDirection = entityPos.clone().subtract(playerPos).normalize();
        const fleeVelocity = fleeDirection.scale(this.speed * 1.5);
        
        physics.setVelocity(fleeVelocity);
    }

    private initiateEncounter(entity: Entity, player: Entity): void {
        if (Math.random() < this.encounterChance) {
            console.log(`[Wild Encounter]: A wild ${this.species} (Level ${this.level}) appeared!`);
            // This would trigger the battle system
        }
    }

    private findPlayerEntity(entity: Entity): Entity | null {
        // Placeholder for finding player entity
        return null;
    }

    private getDistanceToPlayer(entity: Entity, player: Entity): number {
        const entityPos = entity.getTransformComponent()?.getPosition();
        const playerPos = player.getTransformComponent()?.getPosition();
        
        if (!entityPos || !playerPos) return Infinity;
        
        return entityPos.distanceTo(playerPos);
    }
}

// ============= INTERACTIVE BEHAVIORS =============

export interface InteractableSignData extends BehaviorData {
    text: string;
    interactionRange: number;
}

export class InteractableSign extends Behavior {
    private text: string;
    private interactionRange: number;

    constructor(id: string, entityId: string, data: InteractableSignData) {
        super(id, entityId, data);
        this.text = data.text || "This is a sign.";
        this.interactionRange = data.interactionRange || 48;
    }

    update(deltaTime: number, entity: Entity): void {
        this.checkPlayerInteraction(entity);
    }

    private checkPlayerInteraction(entity: Entity): void {
        const player = this.findPlayerEntity(entity);
        if (!player) return;

        const distance = this.getDistanceToPlayer(entity, player);
        
        if (distance <= this.interactionRange) {
            this.showInteractionPrompt(true);
            
            if (this.isInteractionPressed()) {
                this.displaySignText();
            }
        } else {
            this.showInteractionPrompt(false);
        }
    }

    private displaySignText(): void {
        console.log(`[Sign]: ${this.text}`);
        // This would show the text in a UI panel
    }

    private findPlayerEntity(entity: Entity): Entity | null {
        return null; // Placeholder
    }

    private getDistanceToPlayer(entity: Entity, player: Entity): number {
        return 0; // Placeholder
    }

    private isInteractionPressed(): boolean {
        return false; // Placeholder
    }

    private showInteractionPrompt(show: boolean): void {
        // Placeholder for UI interaction
    }
}

// ============= COLLECTIBLE BEHAVIORS =============

export interface CollectibleItemData extends BehaviorData {
    itemType: string;
    itemName: string;
    description: string;
    amount?: number;
    collectSound?: string;
    respawnTime?: number;
    glowEffect?: boolean;
}

export class CollectibleItem extends Behavior {
    private itemType: string;
    private itemName: string;
    private description: string;
    private amount: number;
    private collectSound: string;
    private respawnTime: number;
    private glowEffect: boolean;
    private isCollected: boolean = false;
    private respawnTimer: number = 0;

    constructor(id: string, entityId: string, data: CollectibleItemData) {
        super(id, entityId, data);
        this.itemType = data.itemType || "misc";
        this.itemName = data.itemName || "Item";
        this.description = data.description || "A collectible item";
        this.amount = data.amount || 1;
        this.collectSound = data.collectSound || "pickup";
        this.respawnTime = data.respawnTime || 0;
        this.glowEffect = data.glowEffect || false;
    }

    update(deltaTime: number, entity: Entity): void {
        if (this.isCollected) {
            this.updateRespawnTimer(deltaTime, entity);
            return;
        }

        if (this.glowEffect) {
            this.updateGlowEffect(entity, deltaTime);
        }

        this.checkPlayerCollection(entity);
    }

    private checkPlayerCollection(entity: Entity): void {
        const player = this.findPlayerEntity(entity);
        if (!player) return;

        const collider = entity.getColliderComponent();
        const playerCollider = player.getColliderComponent();
        
        if (collider && playerCollider && this.checkCollision(collider, playerCollider)) {
            this.collectItem(entity, player);
        }
    }

    private collectItem(entity: Entity, player: Entity): void {
        this.isCollected = true;
        
        // Play sound
        if (this.collectSound) {
            console.log(`[Audio]: Playing ${this.collectSound}`);
        }

        // Add to player inventory
        console.log(`[Inventory]: Added ${this.amount}x ${this.itemName}`);
        
        // Hide the entity
        const sprite = entity.getSpriteComponent();
        if (sprite) {
            sprite.setVisible(false);
        }

        // Start respawn timer if applicable
        if (this.respawnTime > 0) {
            this.respawnTimer = this.respawnTime;
        }
    }

    private updateRespawnTimer(deltaTime: number, entity: Entity): void {
        if (this.respawnTime <= 0) return;

        this.respawnTimer -= deltaTime;
        
        if (this.respawnTimer <= 0) {
            this.respawnItem(entity);
        }
    }

    private respawnItem(entity: Entity): void {
        this.isCollected = false;
        
        const sprite = entity.getSpriteComponent();
        if (sprite) {
            sprite.setVisible(true);
        }
        
        console.log(`[Respawn]: ${this.itemName} has respawned`);
    }

    private updateGlowEffect(entity: Entity, deltaTime: number): void {
        const sprite = entity.getSpriteComponent();
        if (!sprite) return;

        // Simple pulsing glow effect
        const time = Date.now() * 0.003;
        const alpha = 0.7 + Math.sin(time) * 0.3;
        sprite.setAlpha(alpha);
    }

    private findPlayerEntity(entity: Entity): Entity | null {
        return null; // Placeholder
    }

    private checkCollision(collider1: any, collider2: any): boolean {
        return false; // Placeholder
    }
}

// ============= BOSS BEHAVIORS =============

export interface BossAIData extends BehaviorData {
    health: number;
    attackPattern: string;
    moveSpeed: number;
    attackRange: number;
    abilities: string[];
    phases: Array<{
        healthThreshold: number;
        behavior: string;
    }>;
}

export class BossAI extends Behavior {
    private maxHealth: number;
    private currentHealth: number;
    private attackPattern: string;
    private moveSpeed: number;
    private attackRange: number;
    private abilities: string[];
    private phases: Array<{ healthThreshold: number; behavior: string }>;
    private currentPhase: number = 0;
    private attackTimer: number = 0;
    private attackCooldown: number = 3000; // 3 seconds

    constructor(id: string, entityId: string, data: BossAIData) {
        super(id, entityId, data);
        this.maxHealth = data.health || 100;
        this.currentHealth = this.maxHealth;
        this.attackPattern = data.attackPattern || "basic";
        this.moveSpeed = data.moveSpeed || 80;
        this.attackRange = data.attackRange || 100;
        this.abilities = data.abilities || [];
        this.phases = data.phases || [];
    }

    update(deltaTime: number, entity: Entity): void {
        this.updatePhase();
        this.updateBehavior(entity, deltaTime);
        this.updateAttackTimer(deltaTime);
    }

    private updatePhase(): void {
        for (let i = 0; i < this.phases.length; i++) {
            if (this.currentHealth <= this.phases[i].healthThreshold && this.currentPhase !== i) {
                this.currentPhase = i;
                console.log(`[Boss]: Entering phase ${i + 1} - ${this.phases[i].behavior}`);
                break;
            }
        }
    }

    private updateBehavior(entity: Entity, deltaTime: number): void {
        const player = this.findPlayerEntity(entity);
        if (!player) return;

        const distance = this.getDistanceToPlayer(entity, player);

        if (distance <= this.attackRange && this.attackTimer <= 0) {
            this.executeAttack(entity, player);
            this.attackTimer = this.attackCooldown;
        } else if (distance > this.attackRange) {
            this.moveTowardsPlayer(entity, player);
        }
    }

    private executeAttack(entity: Entity, player: Entity): void {
        const ability = this.abilities[Math.floor(Math.random() * this.abilities.length)];
        console.log(`[Boss]: Using ${ability}!`);
        
        // Execute specific attack based on ability
        switch (ability) {
            case "Root_Strike":
                this.executeRootStrike(entity, player);
                break;
            case "Leaf_Storm":
                this.executeLeafStorm(entity, player);
                break;
            case "Regenerate":
                this.executeRegenerate(entity);
                break;
        }
    }

    private executeRootStrike(entity: Entity, player: Entity): void {
        console.log("[Boss Attack]: Root tendrils burst from the ground!");
        // Deal damage to player
    }

    private executeLeafStorm(entity: Entity, player: Entity): void {
        console.log("[Boss Attack]: A whirlwind of sharp leaves!");
        // Area of effect attack
    }

    private executeRegenerate(entity: Entity): void {
        const healAmount = Math.min(20, this.maxHealth - this.currentHealth);
        this.currentHealth += healAmount;
        console.log(`[Boss]: Regenerated ${healAmount} health!`);
    }

    private moveTowardsPlayer(entity: Entity, player: Entity): void {
        const entityPos = entity.getTransformComponent()?.getPosition();
        const playerPos = player.getTransformComponent()?.getPosition();
        const physics = entity.getPhysicsComponent();
        
        if (!entityPos || !playerPos || !physics) return;

        const direction = playerPos.clone().subtract(entityPos).normalize();
        const velocity = direction.scale(this.moveSpeed);
        
        physics.setVelocity(velocity);
    }

    private updateAttackTimer(deltaTime: number): void {
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
        }
    }

    public takeDamage(amount: number): void {
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        console.log(`[Boss]: Took ${amount} damage! Health: ${this.currentHealth}/${this.maxHealth}`);
        
        if (this.currentHealth <= 0) {
            this.onDefeat();
        }
    }

    private onDefeat(): void {
        console.log("[Boss]: Defeated!");
        // Trigger victory conditions
    }

    private findPlayerEntity(entity: Entity): Entity | null {
        return null; // Placeholder
    }

    private getDistanceToPlayer(entity: Entity, player: Entity): number {
        return 0; // Placeholder
    }
}

// Export all behaviors
export const RPGBehaviorTypes = {
    RPGMovement,
    NPCDialogue,
    WildCreatureBehavior,
    InteractableSign,
    CollectibleItem,
    BossAI
};