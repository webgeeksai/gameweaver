/**
 * Rendering System for drawing sprites and visual elements
 * Handles sprite rendering, batching, and visual effects
 */

import { BaseSystem } from '../core/ecs/System';
import { ComponentType } from '../core/types';
import { Entity } from '../core/ecs/Entity';
import { ComponentManager } from '../core/ecs/ComponentManager';
import { SpriteComponent, TransformComponent } from '../core/ecs/Component';
import { Vector2 } from '../core/math/Vector2';
import { Rectangle } from '../core/math/Rectangle';
import { PhysicsSystem } from './PhysicsSystem';
import { CanvasLike } from '../core/GameEngine';

export interface Renderer {
  clear(): void;
  drawSprite(sprite: SpriteRenderData): void;
  setCamera(camera: Camera): void;
  getCanvas(): CanvasLike;
  getContext(): CanvasRenderingContext2D;
  getCamera(): Camera;
}

export interface SpriteRenderData {
  texture: string;
  position: Vector2;
  rotation: number;
  scale: Vector2;
  origin: Vector2;
  tint: number;
  alpha: number;
  flipX: boolean;
  flipY: boolean;
  bounds: Rectangle;
}

export interface Camera {
  position: Vector2;
  zoom: number;
  rotation: number;
  bounds: Rectangle;
}

export class CanvasRenderer implements Renderer {
  private canvas: CanvasLike;
  private context: CanvasRenderingContext2D;
  private camera: Camera;
  private loadedTextures: Map<string, HTMLImageElement> = new Map();
  private loadingTextures: Map<string, Promise<HTMLImageElement | null>> = new Map();
  private debugMode: boolean = false;
  
  constructor(canvas: CanvasLike) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    
    // Default camera
    this.camera = {
      position: Vector2.zero,
      zoom: 1,
      rotation: 0,
      bounds: new Rectangle(0, 0, canvas.width, canvas.height)
    };
    
    // Only setup canvas if we have a valid context
    if (ctx) {
      this.context = ctx;
      this.setupCanvas();
    } else {
      // Create a null context for non-browser environments
      this.context = this.createNullContext();
    }
  }
  
  private setupCanvas(): void {
    // Set canvas size
    this.canvas.width = 800;
    this.canvas.height = 600;
    
    // Configure context
    this.context.imageSmoothingEnabled = false; // Pixel art friendly
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
  }
  
  private createNullContext(): CanvasRenderingContext2D {
    // Create a mock context for non-browser environments
    return {
      clearRect: () => {},
      fillRect: () => {},
      fillText: () => {},
      strokeRect: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      setTransform: () => {},
      fillStyle: '',
      strokeStyle: '',
      textAlign: 'center',
      textBaseline: 'middle',
      imageSmoothingEnabled: false,
      globalAlpha: 1,
      font: '16px sans-serif',
      lineWidth: 1
    } as any;
  }
  
  clear(): void {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Fill with background color
    this.context.fillStyle = '#2c3e50';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  setCamera(camera: Camera): void {
    this.camera = camera;
  }
  
  getCamera(): Camera {
    return this.camera;
  }
  
  drawSprite(spriteData: SpriteRenderData): void {
    const ctx = this.context;
    
    console.log(`CanvasRenderer: Drawing sprite ${spriteData.texture} at world pos:`, spriteData.position);
    
    // Transform world position to screen position
    const screenPos = this.worldToScreen(spriteData.position);
    console.log(`CanvasRenderer: Screen position:`, screenPos, 'Camera:', this.camera.position);
    
    // Skip if outside camera bounds (basic culling) - TEMPORARILY DISABLED FOR DEBUGGING
    // if (!this.isInView(screenPos, spriteData.bounds)) {
    //   console.log(`CanvasRenderer: Sprite ${spriteData.texture} is outside view bounds`);
    //   return;
    // }
    
    console.log(`CanvasRenderer: About to draw sprite ${spriteData.texture} at screen pos:`, screenPos, `bounds:`, spriteData.bounds);
    
    ctx.save();
    
    // Apply transformations
    ctx.translate(screenPos.x, screenPos.y);
    ctx.rotate(spriteData.rotation + this.camera.rotation);
    ctx.scale(
      spriteData.scale.x * this.camera.zoom * (spriteData.flipX ? -1 : 1),
      spriteData.scale.y * this.camera.zoom * (spriteData.flipY ? -1 : 1)
    );
    
    // Apply alpha and tint
    ctx.globalAlpha = spriteData.alpha;
    
    // Draw sprite
    if (spriteData.texture.startsWith('#')) {
      // Color rectangle
      this.drawColorRect(ctx, spriteData);
    } else if (spriteData.texture.startsWith('shape:')) {
      // Generated shape
      this.drawShape(ctx, spriteData);
    } else {
      // Texture/image
      this.drawTexture(ctx, spriteData);
    }
    
    ctx.restore();
  }
  
  private drawColorRect(ctx: CanvasRenderingContext2D, spriteData: SpriteRenderData): void {
    const bounds = spriteData.bounds;
    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;
    
    ctx.fillStyle = spriteData.texture;
    ctx.fillRect(-halfWidth, -halfHeight, bounds.width, bounds.height);
  }
  
  private drawShape(ctx: CanvasRenderingContext2D, spriteData: SpriteRenderData): void {
    const bounds = spriteData.bounds;
    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;
    
    ctx.fillStyle = '#ffffff'; // Default white, tint would be applied
    
    if (spriteData.texture.includes('circle')) {
      const radius = Math.min(bounds.width, bounds.height) / 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Default to rectangle
      ctx.fillRect(-halfWidth, -halfHeight, bounds.width, bounds.height);
    }
  }
  
  private drawTexture(ctx: CanvasRenderingContext2D, spriteData: SpriteRenderData): void {
    console.log(`CanvasRenderer: *** DRAW TEXTURE CALLED: ${spriteData.texture} ***`);
    const bounds = spriteData.bounds;
    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;
    
    // Try to determine asset URL format
    let textureUrl = spriteData.texture;
    
    // Handle different asset path formats
    if (spriteData.texture.startsWith('assets/')) {
      // Relative asset path - convert to webview resource URL
      textureUrl = `./${spriteData.texture}`;
    } else if (!spriteData.texture.startsWith('http') && !spriteData.texture.startsWith('data:') && !spriteData.texture.startsWith('/')) {
      // Assume it's a relative asset path
      textureUrl = `./assets/${spriteData.texture}`;
    }
    
    console.log(`CanvasRenderer: Texture URL resolved: ${spriteData.texture} -> ${textureUrl}`);
    
    // Check if already loaded (synchronous check)
    if (this.loadedTextures.has(textureUrl)) {
      const image = this.loadedTextures.get(textureUrl);
      if (image) {
        console.log(`CanvasRenderer: Drawing loaded texture ${textureUrl}`);
        ctx.drawImage(image, -halfWidth, -halfHeight, bounds.width, bounds.height);
        return;
      }
    }
    
    // Start loading if not already loading
    if (!this.loadingTextures.has(textureUrl)) {
      this.loadTexture(textureUrl); // Start loading for next frame
    }
    
    // Draw fallback immediately for this frame
    this.drawFallbackSprite(ctx, spriteData, halfWidth, halfHeight, bounds);
  }
  
  private drawFallbackSprite(ctx: CanvasRenderingContext2D, spriteData: SpriteRenderData, originX: number, originY: number, bounds: Rectangle): void {
    console.log(`CanvasRenderer: Drawing fallback sprite for ${spriteData.texture}, bounds:`, bounds);
    
    // Color-coded fallback sprites based on texture name
    if (spriteData.texture.includes('player')) {
      ctx.fillStyle = '#e74c3c'; // Red for player
    } else if (spriteData.texture.includes('goomba') || spriteData.texture.includes('enemy')) {
      ctx.fillStyle = '#8b4513'; // Brown for enemies
    } else if (spriteData.texture.includes('coin')) {
      ctx.fillStyle = '#f1c40f'; // Gold for coins
    } else if (spriteData.texture.includes('platform')) {
      ctx.fillStyle = '#9b59b6'; // Purple for platforms
    } else if (spriteData.texture.includes('ground')) {
      ctx.fillStyle = '#27ae60'; // Green for ground
    } else {
      ctx.fillStyle = '#3498db'; // Blue default
    }
    
    // Draw sprite centered at current transform origin (0,0)
    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;
    
    console.log(`CanvasRenderer: Drawing rect at (-${halfWidth}, -${halfHeight}) size ${bounds.width}x${bounds.height} with color ${ctx.fillStyle}`);
    ctx.fillRect(-halfWidth, -halfHeight, bounds.width, bounds.height);
    
    // Debug text is now disabled by default - can be enabled via debug mode
    if (this.debugMode) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px Arial';
      const fileName = spriteData.texture.split('/').pop() || spriteData.texture;
      ctx.fillText(fileName, 0, 0);
    }
  }
  
  private async loadTexture(url: string): Promise<HTMLImageElement | null> {
    console.log(`CanvasRenderer: *** ATTEMPTING TO LOAD TEXTURE: ${url} ***`);
    
    // Check if already loaded
    if (this.loadedTextures.has(url)) {
      console.log(`CanvasRenderer: Texture already loaded: ${url}`);
      return this.loadedTextures.get(url) || null;
    }
    
    // Check if already loading
    if (this.loadingTextures.has(url)) {
      console.log(`CanvasRenderer: Texture already loading: ${url}`);
      return this.loadingTextures.get(url) || null;
    }
    
    // Load new texture
    try {
      console.log(`CanvasRenderer: Starting new texture load: ${url}`);
      const loadPromise = new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        
        // Enable CORS for external images
        image.crossOrigin = 'anonymous';
        
        image.onload = () => {
          console.log(`CanvasRenderer: *** TEXTURE LOADED SUCCESSFULLY: ${url} ***`);
          this.loadedTextures.set(url, image);
          this.loadingTextures.delete(url);
          resolve(image);
        };
        
        image.onerror = (error) => {
          console.error(`CanvasRenderer: *** TEXTURE LOAD FAILED: ${url} ***`, error);
          this.loadingTextures.delete(url);
          resolve(null);
        };
        
        console.log(`CanvasRenderer: Setting image.src to: ${url}`);
        image.src = url;
      });
      
      this.loadingTextures.set(url, loadPromise);
      return loadPromise;
    } catch (error) {
      console.error(`CanvasRenderer: Error in loadTexture: ${url}`, error);
      return null;
    }
  }
  
  private worldToScreen(worldPos: Vector2): Vector2 {
    // Convert world coordinates to screen coordinates
    // Keep Y-axis as is (positive Y goes down in both world and screen space)
    const screenPos = new Vector2(
      (worldPos.x - this.camera.position.x) * this.camera.zoom + this.canvas.width / 2,
      (worldPos.y - this.camera.position.y) * this.camera.zoom + this.canvas.height / 2
    );
    console.log(`WorldToScreen: world(${worldPos.x}, ${worldPos.y}) -> screen(${screenPos.x}, ${screenPos.y}), camera(${this.camera.position.x}, ${this.camera.position.y})`);
    return screenPos;
  }
  
  private isInView(screenPos: Vector2, bounds: Rectangle): boolean {
    const scaledWidth = bounds.width * this.camera.zoom;
    const scaledHeight = bounds.height * this.camera.zoom;
    
    return screenPos.x + scaledWidth / 2 > 0 &&
           screenPos.x - scaledWidth / 2 < this.canvas.width &&
           screenPos.y + scaledHeight / 2 > 0 &&
           screenPos.y - scaledHeight / 2 < this.canvas.height;
  }
  
  getCanvas(): CanvasLike {
    return this.canvas;
  }
  
  getContext(): CanvasRenderingContext2D {
    return this.context;
  }
  
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
  
  getDebugMode(): boolean {
    return this.debugMode;
  }
}

export class RenderingSystem extends BaseSystem {
  private componentManager: ComponentManager;
  private renderer: Renderer;
  private camera: Camera;
  private physicsSystem: PhysicsSystem | null = null;
  
  constructor(componentManager: ComponentManager, renderer: Renderer) {
    super(
      'RenderingSystem',
      200, // Lower priority - runs after transform updates
      [ComponentType.Transform, ComponentType.Sprite]
    );
    this.componentManager = componentManager;
    this.renderer = renderer;
    
    // Default camera
    this.camera = {
      position: Vector2.zero,
      zoom: 1,
      rotation: 0,
      bounds: new Rectangle(0, 0, 800, 600)
    };
  }
  
  initialize(): void {
    console.log('RenderingSystem initialized');
    this.renderer.setCamera(this.camera);
  }
  
  setPhysicsSystem(physicsSystem: PhysicsSystem): void {
    this.physicsSystem = physicsSystem;
  }
  
  protected processEntities(entities: Entity[], deltaTime: number): void {
    // This is handled in the render method
  }
  
  protected renderEntities(entities: Entity[], renderer: any): void {
    try {
      console.log(`RenderingSystem: renderEntities called with renderer:`, renderer?.constructor?.name);
      
      // Use the passed renderer, fallback to internal renderer
      const activeRenderer = renderer || this.renderer;
      console.log(`RenderingSystem: Using renderer:`, activeRenderer?.constructor?.name);
      
      // Clear the screen
      activeRenderer.clear();
      
      // Debug: Log rendering info
      console.log(`RenderingSystem: Attempting to render ${entities.length} entities`);
      
      // Sort entities by render order
      const sortedEntities = this.sortEntitiesByRenderOrder(entities);
      
      // Render each entity
      for (const entity of sortedEntities) {
        this.renderEntity(entity, activeRenderer);
      }
      
      // Render debug information if physics system is available
      if (this.physicsSystem && this.physicsSystem.getDebugDraw()) {
        activeRenderer.renderDebug && activeRenderer.renderDebug(activeRenderer.getContext(), this.camera);
      }
    } catch (error) {
      console.error("RenderingSystem: Error in renderEntities", error);
    }
  }
  
  private sortEntitiesByRenderOrder(entities: Entity[]): Entity[] {
    return entities.sort((a, b) => {
      const spriteA = this.componentManager.getByEntity<SpriteComponent>(a, ComponentType.Sprite);
      const spriteB = this.componentManager.getByEntity<SpriteComponent>(b, ComponentType.Sprite);
      
      const orderA = spriteA?.data.renderOrder || 0;
      const orderB = spriteB?.data.renderOrder || 0;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Secondary sort by Y position for depth
      const transformA = this.componentManager.getByEntity<TransformComponent>(a, ComponentType.Transform);
      const transformB = this.componentManager.getByEntity<TransformComponent>(b, ComponentType.Transform);
      
      const yA = transformA?.data.worldPosition?.y || transformA?.data.position.y || 0;
      const yB = transformB?.data.worldPosition?.y || transformB?.data.position.y || 0;
      
      return yB - yA; // Higher Y values render first (behind)
    });
  }
  
  private renderEntity(entity: Entity, renderer?: any): void {
    const transform = this.componentManager.getByEntity<TransformComponent>(entity, ComponentType.Transform);
    const sprite = this.componentManager.getByEntity<SpriteComponent>(entity, ComponentType.Sprite);
    
    if (!transform) {
      console.log(`Entity ${entity.name} missing transform component`);
      return;
    }
    if (!sprite) {
      console.log(`Entity ${entity.name} missing sprite component`);
      return;
    }
    if (!sprite.data.visible) {
      console.log(`Entity ${entity.name} sprite not visible`);
      return;
    }
    
    console.log(`Rendering entity ${entity.name} at position:`, transform.data.position);
    
    // Use world position if available, otherwise local position
    const position = transform.data.worldPosition 
      ? new Vector2(transform.data.worldPosition.x, transform.data.worldPosition.y)
      : new Vector2(transform.data.position.x, transform.data.position.y);
    
    const rotation = transform.data.worldRotation !== undefined 
      ? transform.data.worldRotation 
      : transform.data.rotation;
    
    const scale = transform.data.worldScale
      ? new Vector2(transform.data.worldScale.x, transform.data.worldScale.y)
      : new Vector2(transform.data.scale.x, transform.data.scale.y);
    
    // Calculate bounds if not set
    let bounds = sprite.data.bounds;
    if (!bounds || sprite.data.boundsDirty) {
      bounds = this.calculateSpriteBounds(sprite);
      sprite.data.bounds = bounds;
      sprite.data.boundsDirty = false;
    }
    
    const spriteData: SpriteRenderData = {
      texture: sprite.data.texture,
      position,
      rotation,
      scale,
      origin: new Vector2(0.5, 0.5), // Always center origin for consistent positioning
      tint: sprite.data.tint || 0xffffff,
      alpha: sprite.data.alpha !== undefined ? sprite.data.alpha : 1,
      flipX: sprite.data.flipX || false,
      flipY: sprite.data.flipY || false,
      bounds: new Rectangle(bounds.x || 0, bounds.y || 0, bounds.width || 32, bounds.height || 32)
    };
    
    // Use passed renderer or fallback to internal renderer
    const activeRenderer = renderer || this.renderer;
    console.log(`RenderingSystem: About to call renderer.drawSprite, renderer type:`, activeRenderer.constructor.name);
    activeRenderer.drawSprite(spriteData);
  }
  
  private calculateSpriteBounds(sprite: SpriteComponent): { x: number; y: number; width: number; height: number } {
    // Default bounds - in a full implementation, this would be based on texture size
    return {
      x: 0,
      y: 0,
      width: sprite.data.bounds?.width || 32,
      height: sprite.data.bounds?.height || 32
    };
  }
  
  // Camera controls
  setCamera(camera: Camera): void {
    this.camera = camera;
    this.renderer.setCamera(camera);
  }
  
  getCamera(): Camera {
    return this.camera;
  }
  
  setCameraPosition(position: Vector2): void {
    this.camera.position = position;
    this.renderer.setCamera(this.camera);
  }
  
  setCameraZoom(zoom: number): void {
    this.camera.zoom = zoom;
    this.renderer.setCamera(this.camera);
  }
  
  // Debug rendering
  setDebugMode(enabled: boolean): void {
    if (this.renderer instanceof CanvasRenderer) {
      this.renderer.setDebugMode(enabled);
    }
  }
  
  getDebugMode(): boolean {
    if (this.renderer instanceof CanvasRenderer) {
      return this.renderer.getDebugMode();
    }
    return false;
  }
}