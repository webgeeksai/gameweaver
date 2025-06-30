/**
 * Input System for handling keyboard, mouse, and touch input
 * Provides a unified interface for all input types
 */

import { BaseSystem } from '../core/ecs/System';
import { ComponentType } from '../core/types';
import { Entity } from '../core/ecs/Entity';
import { globalEventBus } from '../core/events/EventBus';
import { EventPriority, EventSource } from '../core/types';
import { Vector2 } from '../core/math/Vector2';
import { CanvasLike } from '../core/GameEngine';

export interface KeyState {
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
  holdTime: number;
}

export interface MouseState {
  position: Vector2;
  buttons: Map<number, boolean>;
  wheel: number;
  justClicked: Map<number, boolean>;
  justReleased: Map<number, boolean>;
}

export interface TouchState {
  id: number;
  position: Vector2;
  startPosition: Vector2;
  active: boolean;
  startTime: number;
}

export class InputSystem extends BaseSystem {
  private keyStates: Map<string, KeyState> = new Map();
  private mouseState: MouseState;
  private touchStates: Map<number, TouchState> = new Map();
  private canvas: CanvasLike | null = null;
  
  // Input configuration
  private keyMappings: Map<string, string> = new Map();
  private deadzone: number = 0.1;
  
  // Event handlers
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseWheel: (e: WheelEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundTouchCancel: (e: TouchEvent) => void;
  private boundWindowBlur: (e: Event) => void;
  private boundContextMenu: (e: Event) => void;
  
  constructor() {
    super(
      'InputSystem',
      50, // High priority - input should be processed early
      [] // No required components - this is a global system
    );
    
    this.mouseState = {
      position: Vector2.zero,
      buttons: new Map(),
      wheel: 0,
      justClicked: new Map(),
      justReleased: new Map()
    };
    
    // Bind event handlers to maintain 'this' context
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseWheel = this.onMouseWheel.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
    this.boundTouchCancel = this.onTouchCancel.bind(this);
    this.boundWindowBlur = this.onWindowBlur.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();
    
    this.setupDefaultKeyMappings();
  }
  
  initialize(): void {
    console.log('InputSystem initialized');
    this.setupEventListeners();
  }
  
  cleanup(): void {
    this.removeEventListeners();
  }
  
  protected processEntities(entities: Entity[], deltaTime: number): void {
    // Update input states
    this.updateKeyStates(deltaTime);
    this.updateMouseState();
    this.updateTouchStates(deltaTime);
    
    // Generate input events
    this.generateInputEvents();
  }
  
  private setupDefaultKeyMappings(): void {
    console.log("InputSystem: Setting up default key mappings");
    // Movement keys
    this.keyMappings.set('KeyW', 'up');
    this.keyMappings.set('KeyA', 'left');
    this.keyMappings.set('KeyS', 'down');
    this.keyMappings.set('KeyD', 'right');
    this.keyMappings.set('ArrowUp', 'up');
    this.keyMappings.set('ArrowLeft', 'left');
    this.keyMappings.set('ArrowDown', 'down');
    this.keyMappings.set('ArrowRight', 'right');
    
    // Action keys
    this.keyMappings.set('Space', 'jump');
    this.keyMappings.set('Enter', 'confirm');
    this.keyMappings.set('Escape', 'cancel');
    this.keyMappings.set('ShiftLeft', 'run');
    this.keyMappings.set('ControlLeft', 'crouch');
    
    // Number keys for scene switching
    this.keyMappings.set('Digit1', '1');
    this.keyMappings.set('Digit2', '2');
    this.keyMappings.set('Digit3', '3');
    this.keyMappings.set('1', '1'); // Also map the actual number keys
    this.keyMappings.set('2', '2');
    this.keyMappings.set('3', '3');
  }
  
  private setupEventListeners(): void {
    console.log("InputSystem: Setting up event listeners");
    
    // Only add event listeners in browser environment
    if (typeof window === 'undefined') {
      console.log("InputSystem: Not in browser environment, skipping window event listeners");
      return;
    }
    
    // Keyboard events
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    
    // Mouse events
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('wheel', this.boundMouseWheel);
    
    // Touch events
    window.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.boundTouchCancel, { passive: false });
    
    // Prevent context menu on right click
    window.addEventListener('contextmenu', this.boundContextMenu);
    
    // Focus events to handle when the window loses focus
    window.addEventListener('blur', this.boundWindowBlur);
    
    console.log("InputSystem: Event listeners set up");
  }
  
  private removeEventListeners(): void {
    // Only remove event listeners in browser environment
    if (typeof window === 'undefined') {
      return;
    }
    
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('wheel', this.boundMouseWheel);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
    window.removeEventListener('touchcancel', this.boundTouchCancel);
    window.removeEventListener('contextmenu', this.boundContextMenu);
    window.removeEventListener('blur', this.boundWindowBlur);
  }
  
  // Keyboard event handlers
  private onKeyDown(event: KeyboardEvent): void {
    console.log("InputSystem: Key down", event.code);
    const keyState = this.getKeyState(event.code);
    
    if (!keyState.pressed) {
      keyState.pressed = true;
      keyState.justPressed = true;
      keyState.holdTime = 0;
      
      const mappedKey = this.keyMappings.get(event.code) || event.code;
      console.log("InputSystem: Key just pressed", event.code, "mapped to", mappedKey);
      
      // Emit key pressed event
      globalEventBus.emit({
        type: 'input.key.pressed',
        source: EventSource.Input,
        timestamp: Date.now(),
        priority: EventPriority.High,
        data: { 
          key: mappedKey,
          originalKey: event.code
        }
      });
    }
    
    // Prevent default for game keys
    if (this.keyMappings.has(event.code)) {
      event.preventDefault();
    }
  }
  
  private onKeyUp(event: KeyboardEvent): void {
    console.log("InputSystem: Key up", event.code);
    const keyState = this.getKeyState(event.code);
    keyState.pressed = false;
    keyState.justReleased = true;
    
    const mappedKey = this.keyMappings.get(event.code) || event.code;
    
    // Emit key released event
    globalEventBus.emit({
      type: 'input.key.released',
      source: EventSource.Input,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: { 
        key: mappedKey,
        originalKey: event.code,
        holdTime: keyState.holdTime
      }
    });
  }
  
  // Handle window blur (when the window loses focus)
  private onWindowBlur(): void {
    console.log("InputSystem: Window blur - resetting all input states");
    
    // Reset all key states
    for (const [key, state] of this.keyStates) {
      if (state.pressed) {
        state.pressed = false;
        state.justReleased = true;
        state.holdTime = 0;
        
        const mappedKey = this.keyMappings.get(key) || key;
        
        // Emit key released event
        globalEventBus.emit({
          type: 'input.key.released',
          source: EventSource.Input,
          timestamp: Date.now(),
          priority: EventPriority.High,
          data: { 
            key: mappedKey,
            originalKey: key,
            holdTime: state.holdTime
          }
        });
      }
    }
    
    // Reset mouse buttons
    for (const [button, pressed] of this.mouseState.buttons) {
      if (pressed) {
        this.mouseState.buttons.set(button, false);
        this.mouseState.justReleased.set(button, true);
        
        // Emit mouse released event
        globalEventBus.emit({
          type: 'input.mouse.released',
          source: EventSource.Input,
          timestamp: Date.now(),
          priority: EventPriority.High,
          data: { 
            button,
            position: this.mouseState.position.clone()
          }
        });
      }
    }
    
    // Reset touch states
    for (const [id, touchState] of this.touchStates) {
      if (touchState.active) {
        touchState.active = false;
        
        // Emit touch ended event
        globalEventBus.emit({
          type: 'input.touch.ended',
          source: EventSource.Input,
          timestamp: Date.now(),
          priority: EventPriority.High,
          data: {
            id,
            position: touchState.position.clone(),
            startPosition: touchState.startPosition.clone(),
            duration: Date.now() - touchState.startTime
          }
        });
      }
    }
    
    this.touchStates.clear();
  }
  
  // Mouse event handlers
  private onMouseDown(event: MouseEvent): void {
    this.mouseState.buttons.set(event.button, true);
    this.mouseState.justClicked.set(event.button, true);
    this.updateMousePosition(event);
    
    // Emit mouse pressed event
    globalEventBus.emit({
      type: 'input.mouse.pressed',
      source: EventSource.Input,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: { 
        button: event.button,
        position: this.mouseState.position.clone(),
        worldPosition: this.screenToWorld(this.mouseState.position)
      }
    });
    
    // Focus canvas if clicked (only if it supports focus)
    if (this.canvas && event.target === (this.canvas as any) && 'focus' in this.canvas) {
      (this.canvas as any).focus();
    }
  }
  
  private onMouseUp(event: MouseEvent): void {
    this.mouseState.buttons.set(event.button, false);
    this.mouseState.justReleased.set(event.button, true);
    this.updateMousePosition(event);
    
    // Emit mouse released event
    globalEventBus.emit({
      type: 'input.mouse.released',
      source: EventSource.Input,
      timestamp: Date.now(),
      priority: EventPriority.High,
      data: { 
        button: event.button,
        position: this.mouseState.position.clone(),
        worldPosition: this.screenToWorld(this.mouseState.position)
      }
    });
  }
  
  private onMouseMove(event: MouseEvent): void {
    const oldPosition = this.mouseState.position.clone();
    this.updateMousePosition(event);
    
    // Calculate delta
    const delta = new Vector2(
      this.mouseState.position.x - oldPosition.x,
      this.mouseState.position.y - oldPosition.y
    );
    
    // Emit mouse moved event
    globalEventBus.emit({
      type: 'input.mouse.moved',
      source: EventSource.Input,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: { 
        position: this.mouseState.position.clone(),
        worldPosition: this.screenToWorld(this.mouseState.position),
        delta
      }
    });
  }
  
  private onMouseWheel(event: WheelEvent): void {
    this.mouseState.wheel = event.deltaY;
    
    // Emit mouse wheel event
    globalEventBus.emit({
      type: 'input.mouse.wheel',
      source: EventSource.Input,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: { 
        delta: event.deltaY,
        position: this.mouseState.position.clone()
      }
    });
    
    event.preventDefault();
  }
  
  private updateMousePosition(event: MouseEvent): void {
    if (this.canvas) {
      // Only use getBoundingClientRect if available (browser environment)
      if ('getBoundingClientRect' in this.canvas) {
        const htmlCanvas = this.canvas as HTMLCanvasElement;
        const rect = htmlCanvas.getBoundingClientRect();
        
        // Calculate position relative to canvas, accounting for CSS scaling
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        this.mouseState.position = new Vector2(
          (event.clientX - rect.left) * scaleX,
          (event.clientY - rect.top) * scaleY
        );
      } else {
        // Fallback for non-browser environments
        this.mouseState.position = new Vector2(event.clientX, event.clientY);
      }
    }
  }
  
  // Touch event handlers
  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const position = this.getTouchPosition(touch);
      
      this.touchStates.set(touch.identifier, {
        id: touch.identifier,
        position,
        startPosition: position.clone(),
        active: true,
        startTime: Date.now()
      });
      
      // Emit touch started event
      globalEventBus.emit({
        type: 'input.touch.started',
        source: EventSource.Input,
        timestamp: Date.now(),
        priority: EventPriority.High,
        data: {
          id: touch.identifier,
          position: position.clone(),
          worldPosition: this.screenToWorld(position)
        }
      });
    }
    
    // Focus canvas if touched (only if it supports focus)
    if (this.canvas && event.target === (this.canvas as any) && 'focus' in this.canvas) {
      (this.canvas as any).focus();
    }
  }
  
  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchState = this.touchStates.get(touch.identifier);
      
      if (touchState) {
        const oldPosition = touchState.position.clone();
        touchState.position = this.getTouchPosition(touch);
        
        // Calculate delta
        const delta = new Vector2(
          touchState.position.x - oldPosition.x,
          touchState.position.y - oldPosition.y
        );
        
        // Emit touch moved event
        globalEventBus.emit({
          type: 'input.touch.moved',
          source: EventSource.Input,
          timestamp: Date.now(),
          priority: EventPriority.Normal,
          data: {
            id: touch.identifier,
            position: touchState.position.clone(),
            worldPosition: this.screenToWorld(touchState.position),
            delta,
            startPosition: touchState.startPosition.clone()
          }
        });
      }
    }
  }
  
  private onTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchState = this.touchStates.get(touch.identifier);
      
      if (touchState) {
        touchState.active = false;
        
        // Emit touch ended event
        globalEventBus.emit({
          type: 'input.touch.ended',
          source: EventSource.Input,
          timestamp: Date.now(),
          priority: EventPriority.High,
          data: {
            id: touch.identifier,
            position: touchState.position.clone(),
            worldPosition: this.screenToWorld(touchState.position),
            startPosition: touchState.startPosition.clone(),
            duration: Date.now() - touchState.startTime
          }
        });
        
        // Remove after a frame to allow systems to process the end event
        setTimeout(() => this.touchStates.delete(touch.identifier), 16);
      }
    }
  }
  
  private onTouchCancel(event: TouchEvent): void {
    this.onTouchEnd(event);
  }
  
  private getTouchPosition(touch: Touch): Vector2 {
    if (this.canvas) {
      // Only use getBoundingClientRect if available (browser environment)
      if ('getBoundingClientRect' in this.canvas) {
        const htmlCanvas = this.canvas as HTMLCanvasElement;
        const rect = htmlCanvas.getBoundingClientRect();
        
        // Calculate position relative to canvas, accounting for CSS scaling
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return new Vector2(
          (touch.clientX - rect.left) * scaleX,
          (touch.clientY - rect.top) * scaleY
        );
      } else {
        // Fallback for non-browser environments
        return new Vector2(touch.clientX, touch.clientY);
      }
    } else {
      // No canvas available
      return new Vector2(touch.clientX, touch.clientY);
    }
  }
  
  // State update methods
  private updateKeyStates(deltaTime: number): void {
    for (const [key, state] of this.keyStates) {
      // Update hold time
      if (state.pressed) {
        state.holdTime += deltaTime;
      } else {
        state.holdTime = 0;
      }
      
      // Reset just pressed/released flags
      state.justPressed = false;
      state.justReleased = false;
    }
  }
  
  private updateMouseState(): void {
    // Reset just clicked/released flags
    this.mouseState.justClicked.clear();
    this.mouseState.justReleased.clear();
    this.mouseState.wheel = 0;
  }
  
  private updateTouchStates(deltaTime: number): void {
    // Touch states are managed by event handlers
  }
  
  private generateInputEvents(): void {
    // Generate keyboard events
    for (const [key, state] of this.keyStates) {
      if (state.pressed) {
        const mappedKey = this.keyMappings.get(key) || key;
        
        // Emit key held event
        globalEventBus.emit({
          type: 'input.key.held',
          source: EventSource.Input,
          timestamp: Date.now(),
          priority: EventPriority.Normal,
          data: { 
            key: mappedKey,
            originalKey: key,
            holdTime: state.holdTime
          }
        });
      }
    }
  }
  
  // Helper methods
  private getKeyState(key: string): KeyState {
    if (!this.keyStates.has(key)) {
      this.keyStates.set(key, {
        pressed: false,
        justPressed: false,
        justReleased: false,
        holdTime: 0
      });
    }
    return this.keyStates.get(key)!;
  }
  
  private screenToWorld(screenPos: Vector2): Vector2 {
    // This would normally use the camera system to convert screen to world coordinates
    // For now, return the screen position as-is
    return screenPos.clone();
  }
  
  // Public API
  setCanvas(canvas: CanvasLike): void {
    console.log("InputSystem: Setting canvas", canvas);
    this.canvas = canvas;
    
    // Make canvas focusable (only if it supports these properties)
    if ('tabIndex' in canvas) {
      canvas.tabIndex = 0;
    }
    
    // Focus canvas initially (only if it supports focus)
    if ('focus' in canvas && typeof canvas.focus === 'function') {
      setTimeout(() => {
        if (this.canvas && 'focus' in this.canvas) {
          (this.canvas as any).focus();
        }
      }, 100);
    }
  }
  
  isKeyDown(key: string): boolean {
    // Check direct key mapping
    const state = this.keyStates.get(key);
    if (state && state.pressed) return true;
    
    // Check mapped key
    const mappedKey = this.keyMappings.get(key) || key;
    for (const [originalKey, keyState] of this.keyStates) {
      if ((this.keyMappings.get(originalKey) === mappedKey || originalKey === mappedKey) && keyState.pressed) {
        return true;
      }
    }
    
    return false;
  }
  
  isKeyPressed(key: string): boolean {
    // Check direct key mapping
    const state = this.keyStates.get(key);
    if (state && state.justPressed) return true;
    
    // Check mapped key
    const mappedKey = this.keyMappings.get(key) || key;
    for (const [originalKey, keyState] of this.keyStates) {
      if ((this.keyMappings.get(originalKey) === mappedKey || originalKey === mappedKey) && keyState.justPressed) {
        return true;
      }
    }
    
    return false;
  }
  
  isKeyReleased(key: string): boolean {
    // Check direct key mapping
    const state = this.keyStates.get(key);
    if (state && state.justReleased) return true;
    
    // Check mapped key
    const mappedKey = this.keyMappings.get(key) || key;
    for (const [originalKey, keyState] of this.keyStates) {
      if ((this.keyMappings.get(originalKey) === mappedKey || originalKey === mappedKey) && keyState.justReleased) {
        return true;
      }
    }
    
    return false;
  }
  
  getMousePosition(): Vector2 {
    return this.mouseState.position.clone();
  }
  
  isMouseButtonDown(button: number): boolean {
    return this.mouseState.buttons.get(button) || false;
  }
  
  getActiveTouches(): TouchState[] {
    return Array.from(this.touchStates.values()).filter(touch => touch.active);
  }
  
  // Input mapping
  setKeyMapping(key: string, action: string): void {
    this.keyMappings.set(key, action);
  }
  
  removeKeyMapping(key: string): void {
    this.keyMappings.delete(key);
  }
  
  getKeyMapping(key: string): string | undefined {
    return this.keyMappings.get(key);
  }
  
  // Debug method to log all key states
  debugLogKeyStates(): void {
    console.log("Current key states:");
    for (const [key, state] of this.keyStates) {
      console.log(`${key}: pressed=${state.pressed}, justPressed=${state.justPressed}, justReleased=${state.justReleased}, holdTime=${state.holdTime}`);
    }
  }
  
  // Get all active keys
  getActiveKeys(): string[] {
    const activeKeys: string[] = [];
    for (const [key, state] of this.keyStates) {
      if (state.pressed) {
        activeKeys.push(key);
      }
    }
    return activeKeys;
  }
  
  // Clear all input states
  clearInputStates(): void {
    // Clear key states
    for (const state of this.keyStates.values()) {
      state.pressed = false;
      state.justPressed = false;
      state.justReleased = false;
      state.holdTime = 0;
    }
    
    // Clear mouse states
    this.mouseState.buttons.clear();
    this.mouseState.justClicked.clear();
    this.mouseState.justReleased.clear();
    this.mouseState.wheel = 0;
    
    // Clear touch states
    this.touchStates.clear();
  }
}