/**
 * Event Bus implementation for decoupled communication
 * Provides a central hub for event publishing and subscription
 */

import { EventPriority } from '../types';
import { PriorityQueue } from '../utils/PriorityQueue';

export interface GameEvent {
  type: string;
  timestamp: number;
  source: string;
  target?: string;
  data?: any;
  
  // Event flow control
  stopPropagation?: boolean;
  preventDefault?: boolean;
  
  // Priority for queued events
  priority: EventPriority;
}

export interface EventListener {
  callback: (event: GameEvent) => void;
  priority: number;
}

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, EventListener[]> = new Map();
  private eventQueue: PriorityQueue<GameEvent> = new PriorityQueue();
  private processing: boolean = false;
  private maxEventsPerFrame: number = 100;
  
  // Singleton pattern
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  // Event registration
  on(eventType: string, listener: (event: any) => void, priority: number = 0): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    const listeners = this.listeners.get(eventType)!;
    const wrappedListener = (event: GameEvent) => {
      // Call with just the data for simple callbacks
      listener(event.data || event);
    };
    
    listeners.push({ callback: wrappedListener, priority });
    
    // Sort by priority (higher priority first)
    listeners.sort((a, b) => b.priority - a.priority);
  }
  
  once(eventType: string, listener: (event: any) => void, priority: number = 0): void {
    const wrappedListener = (event: any) => {
      listener(event);
      this.off(eventType, wrappedListener);
    };
    this.on(eventType, wrappedListener, priority);
  }
  
  off(eventType: string, listener?: (event: GameEvent) => void): void {
    if (!listener) {
      // Remove all listeners for this event type
      this.listeners.delete(eventType);
      return;
    }
    
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const index = listeners.findIndex(l => l.callback === listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      // Remove empty listener arrays
      if (listeners.length === 0) {
        this.listeners.delete(eventType);
      }
    }
  }
  
  // Event emission
  emit(eventTypeOrEvent: string | GameEvent, data?: any): void {
    let event: GameEvent;
    
    if (typeof eventTypeOrEvent === 'string') {
      // Simple emit call with type and data
      event = EventBus.createEvent(eventTypeOrEvent, 'unknown', data);
    } else {
      // Full GameEvent object
      event = eventTypeOrEvent;
    }
    
    if (this.processing) {
      // Queue event if we're currently processing
      this.eventQueue.enqueue(event, event.priority);
    } else {
      this.dispatchEvent(event);
    }
  }
  
  emitImmediate(event: GameEvent): void {
    this.dispatchEvent(event);
  }
  
  // Process queued events
  processEvents(): void {
    if (this.processing) return;
    
    this.processing = true;
    let eventsProcessed = 0;
    
    while (!this.eventQueue.isEmpty() && eventsProcessed < this.maxEventsPerFrame) {
      const event = this.eventQueue.dequeue();
      this.dispatchEvent(event);
      eventsProcessed++;
    }
    
    this.processing = false;
  }
  
  private dispatchEvent(event: GameEvent): void {
    const listeners = this.listeners.get(event.type) || [];
    
    for (const listener of listeners) {
      try {
        listener.callback(event);
        
        if (event.stopPropagation) {
          break;
        }
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    }
  }
  
  // Utility methods
  hasListeners(eventType: string): boolean {
    return this.listeners.has(eventType) && this.listeners.get(eventType)!.length > 0;
  }
  
  getListenerCount(eventType: string): number {
    return this.listeners.has(eventType) ? this.listeners.get(eventType)!.length : 0;
  }
  
  getAllEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }
  
  getQueueSize(): number {
    return this.eventQueue.size();
  }
  
  clearQueue(): void {
    this.eventQueue.clear();
  }
  
  // Create a standard event
  static createEvent(
    type: string, 
    source: string, 
    data?: any, 
    priority: EventPriority = EventPriority.Normal
  ): GameEvent {
    return {
      type,
      timestamp: Date.now(),
      source,
      data,
      priority
    };
  }
}

// Global event bus instance
export const globalEventBus = EventBus.getInstance();