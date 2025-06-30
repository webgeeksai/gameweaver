/**
 * Message Bus System
 * 
 * Provides a centralized communication channel between all engine components
 * using a publish-subscribe pattern with typed messages.
 */

import { EventEmitter } from 'events';

// Message types
export interface Message<T = any> {
  id: string;
  type: string;
  source: string;
  target?: string;
  payload: T;
  timestamp: number;
  correlationId?: string;
  replyTo?: string;
}

export interface MessageHandler<T = any> {
  (message: Message<T>): void | Promise<void>;
}

export interface MessageFilter {
  type?: string | string[];
  source?: string | string[];
  target?: string | string[];
}

export interface MessageSubscription {
  unsubscribe(): void;
}

export interface MessageBusConfig {
  maxQueueSize: number;
  enableLogging: boolean;
  enableMetrics: boolean;
  asyncHandling: boolean;
}

// Common message types
export enum MessageType {
  // Engine messages
  ENGINE_START = 'engine:start',
  ENGINE_STOP = 'engine:stop',
  ENGINE_PAUSE = 'engine:pause',
  ENGINE_RESUME = 'engine:resume',
  ENGINE_ERROR = 'engine:error',
  
  // Entity messages
  ENTITY_CREATED = 'entity:created',
  ENTITY_UPDATED = 'entity:updated',
  ENTITY_DELETED = 'entity:deleted',
  ENTITY_SELECTED = 'entity:selected',
  
  // Component messages
  COMPONENT_ADDED = 'component:added',
  COMPONENT_UPDATED = 'component:updated',
  COMPONENT_REMOVED = 'component:removed',
  
  // Asset messages
  ASSET_LOADED = 'asset:loaded',
  ASSET_UPDATED = 'asset:updated',
  ASSET_DELETED = 'asset:deleted',
  ASSET_REQUEST = 'asset:request',
  
  // Scene messages
  SCENE_LOADED = 'scene:loaded',
  SCENE_UPDATED = 'scene:updated',
  SCENE_SAVED = 'scene:saved',
  SCENE_CHANGE = 'scene:change',
  
  // Editor messages
  EDITOR_SELECT = 'editor:select',
  EDITOR_UPDATE = 'editor:update',
  EDITOR_TOOL_CHANGE = 'editor:tool-change',
  EDITOR_MODE_CHANGE = 'editor:mode-change',
  
  // UI messages
  UI_COMMAND = 'ui:command',
  UI_STATE_CHANGE = 'ui:state-change',
  UI_NOTIFICATION = 'ui:notification',
  UI_DIALOG = 'ui:dialog',
  
  // System messages
  SYSTEM_LOG = 'system:log',
  SYSTEM_METRIC = 'system:metric',
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_REQUEST = 'system:request',
  SYSTEM_RESPONSE = 'system:response'
}

/**
 * Message Bus
 * 
 * Central communication hub for all engine components
 */
export class MessageBus extends EventEmitter {
  private subscribers: Map<string, Set<MessageHandler>> = new Map();
  private messageQueue: Message[] = [];
  private messageHistory: Message[] = [];
  private config: MessageBusConfig;
  private metrics: {
    messagesPublished: number;
    messagesDelivered: number;
    messagesDropped: number;
    averageDeliveryTime: number;
  };
  
  constructor(config?: Partial<MessageBusConfig>) {
    super();
    
    this.config = {
      maxQueueSize: 1000,
      enableLogging: false,
      enableMetrics: true,
      asyncHandling: true,
      ...config
    };
    
    this.metrics = {
      messagesPublished: 0,
      messagesDelivered: 0,
      messagesDropped: 0,
      averageDeliveryTime: 0
    };
  }
  
  /**
   * Publish a message to the bus
   */
  publish<T = any>(message: Omit<Message<T>, 'id' | 'timestamp'>): void {
    const fullMessage: Message<T> = {
      ...message,
      id: this.generateMessageId(),
      timestamp: Date.now()
    };
    
    if (this.config.enableLogging) {
      console.log(`[MessageBus] Publishing: ${fullMessage.type}`, fullMessage);
    }
    
    // Add to queue
    this.messageQueue.push(fullMessage);
    if (this.messageQueue.length > this.config.maxQueueSize) {
      const dropped = this.messageQueue.shift();
      this.metrics.messagesDropped++;
      if (this.config.enableLogging) {
        console.warn(`[MessageBus] Message dropped: ${dropped?.type}`);
      }
    }
    
    // Update metrics
    this.metrics.messagesPublished++;
    
    // Deliver message
    if (this.config.asyncHandling) {
      setImmediate(() => this.deliverMessage(fullMessage));
    } else {
      this.deliverMessage(fullMessage);
    }
    
    // Store in history
    this.messageHistory.push(fullMessage);
    if (this.messageHistory.length > 100) {
      this.messageHistory.shift();
    }
  }
  
  /**
   * Subscribe to messages
   */
  subscribe<T = any>(
    type: string | string[],
    handler: MessageHandler<T>
  ): MessageSubscription {
    const types = Array.isArray(type) ? type : [type];
    
    types.forEach(t => {
      if (!this.subscribers.has(t)) {
        this.subscribers.set(t, new Set());
      }
      this.subscribers.get(t)!.add(handler);
    });
    
    if (this.config.enableLogging) {
      console.log(`[MessageBus] Subscribed to: ${types.join(', ')}`);
    }
    
    // Return unsubscribe function
    return {
      unsubscribe: () => {
        types.forEach(t => {
          this.subscribers.get(t)?.delete(handler);
          if (this.subscribers.get(t)?.size === 0) {
            this.subscribers.delete(t);
          }
        });
      }
    };
  }
  
  /**
   * Subscribe to messages with filter
   */
  subscribeWithFilter<T = any>(
    filter: MessageFilter,
    handler: MessageHandler<T>
  ): MessageSubscription {
    const wrappedHandler: MessageHandler = (message) => {
      if (this.matchesFilter(message, filter)) {
        handler(message as Message<T>);
      }
    };
    
    // Subscribe to all message types if no specific type filter
    const types = filter.type 
      ? (Array.isArray(filter.type) ? filter.type : [filter.type])
      : ['*'];
    
    return this.subscribe(types, wrappedHandler);
  }
  
  /**
   * Request-response pattern
   */
  async request<TRequest = any, TResponse = any>(
    message: Omit<Message<TRequest>, 'id' | 'timestamp' | 'replyTo'>,
    timeout: number = 5000
  ): Promise<Message<TResponse>> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateMessageId();
      const timeoutId = setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error(`Request timeout: ${message.type}`));
      }, timeout);
      
      // Subscribe to response
      const subscription = this.subscribe(MessageType.SYSTEM_RESPONSE, (response) => {
        if (response.correlationId === requestId) {
          clearTimeout(timeoutId);
          subscription.unsubscribe();
          resolve(response as Message<TResponse>);
        }
      });
      
      // Send request
      this.publish({
        ...message,
        replyTo: MessageType.SYSTEM_RESPONSE,
        correlationId: requestId
      });
    });
  }
  
  /**
   * Deliver message to subscribers
   */
  private async deliverMessage(message: Message): Promise<void> {
    const startTime = Date.now();
    
    // Get handlers for this message type
    const handlers = [
      ...(this.subscribers.get(message.type) || []),
      ...(this.subscribers.get('*') || [])
    ];
    
    // Deliver to specific target if specified
    if (message.target) {
      const targetHandlers = this.subscribers.get(`${message.target}:${message.type}`);
      if (targetHandlers) {
        handlers.push(...targetHandlers);
      }
    }
    
    // Execute handlers
    for (const handler of handlers) {
      try {
        await handler(message);
        this.metrics.messagesDelivered++;
      } catch (error) {
        console.error(`[MessageBus] Handler error for ${message.type}:`, error);
        this.emit('error', { message, error });
      }
    }
    
    // Update metrics
    const deliveryTime = Date.now() - startTime;
    this.metrics.averageDeliveryTime = 
      (this.metrics.averageDeliveryTime + deliveryTime) / 2;
    
    // Emit delivered event
    this.emit('message:delivered', message);
  }
  
  /**
   * Check if message matches filter
   */
  private matchesFilter(message: Message, filter: MessageFilter): boolean {
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(message.type)) return false;
    }
    
    if (filter.source) {
      const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
      if (!sources.includes(message.source)) return false;
    }
    
    if (filter.target) {
      const targets = Array.isArray(filter.target) ? filter.target : [filter.target];
      if (!message.target || !targets.includes(message.target)) return false;
    }
    
    return true;
  }
  
  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get message history
   */
  getHistory(filter?: MessageFilter): Message[] {
    if (!filter) return [...this.messageHistory];
    
    return this.messageHistory.filter(msg => this.matchesFilter(msg, filter));
  }
  
  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscribers.clear();
    this.messageQueue = [];
    this.messageHistory = [];
    this.removeAllListeners();
  }
  
  /**
   * Create a scoped publisher
   */
  createPublisher(source: string, defaults?: Partial<Message>): {
    publish: <T>(type: string, payload: T, options?: Partial<Message>) => void;
    request: <TReq, TRes>(type: string, payload: TReq, timeout?: number) => Promise<Message<TRes>>;
  } {
    return {
      publish: <T>(type: string, payload: T, options?: Partial<Message>) => {
        this.publish({
          type,
          source,
          payload,
          ...defaults,
          ...options
        });
      },
      
      request: <TReq, TRes>(type: string, payload: TReq, timeout?: number) => {
        return this.request<TReq, TRes>({
          type,
          source,
          payload,
          ...defaults
        }, timeout);
      }
    };
  }
  
  /**
   * Create a typed subscription
   */
  createTypedSubscription<T>(): {
    subscribe: (type: string | string[], handler: MessageHandler<T>) => MessageSubscription;
    subscribeOnce: (type: string, handler: MessageHandler<T>) => void;
  } {
    return {
      subscribe: (type, handler) => this.subscribe(type, handler),
      
      subscribeOnce: (type, handler) => {
        const subscription = this.subscribe(type, (message: Message<T>) => {
          handler(message);
          subscription.unsubscribe();
        });
      }
    };
  }
}

// Global message bus instance
let globalMessageBus: MessageBus | null = null;

/**
 * Get or create global message bus
 */
export function getGlobalMessageBus(config?: Partial<MessageBusConfig>): MessageBus {
  if (!globalMessageBus) {
    globalMessageBus = new MessageBus(config);
  }
  return globalMessageBus;
}

/**
 * Message bus hooks for React components
 */
export interface MessageBusHooks {
  useMessage<T = any>(type: string | string[], handler: MessageHandler<T>): void;
  useMessageFilter<T = any>(filter: MessageFilter, handler: MessageHandler<T>): void;
  usePublisher(source: string): ReturnType<MessageBus['createPublisher']>;
}