/**
 * Message Bridge System
 * 
 * Provides bridges between different components and the message bus,
 * translating component-specific events to standardized messages.
 */

import { MessageBus, MessageType, Message } from './MessageBus';
import { UnifiedStateStore } from '../state/UnifiedStateStore';
import { GameEngine } from '../GameEngine';
import { EntityManager } from '../ecs/EntityManager';
import { AssetId, EntityId } from '../types';

export abstract class MessageBridge {
  protected messageBus: MessageBus;
  protected source: string;
  protected connected: boolean = false;
  
  constructor(messageBus: MessageBus, source: string) {
    this.messageBus = messageBus;
    this.source = source;
  }
  
  abstract connect(): void;
  abstract disconnect(): void;
  
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Engine Message Bridge
 * 
 * Bridges game engine events to the message bus
 */
export class EngineMessageBridge extends MessageBridge {
  private engine: GameEngine;
  private subscriptions: Array<() => void> = [];
  
  constructor(messageBus: MessageBus, engine: GameEngine) {
    super(messageBus, 'engine');
    this.engine = engine;
  }
  
  connect(): void {
    if (this.connected) return;
    
    // Listen to engine events
    const eventBus = this.engine.getEventBus();
    
    // Engine lifecycle events
    eventBus.on('engine:start', () => {
      this.messageBus.publish({
        type: MessageType.ENGINE_START,
        source: this.source,
        payload: { timestamp: Date.now() }
      });
    });
    
    eventBus.on('engine:stop', () => {
      this.messageBus.publish({
        type: MessageType.ENGINE_STOP,
        source: this.source,
        payload: { timestamp: Date.now() }
      });
    });
    
    eventBus.on('engine:pause', () => {
      this.messageBus.publish({
        type: MessageType.ENGINE_PAUSE,
        source: this.source,
        payload: { paused: true }
      });
    });
    
    eventBus.on('engine:resume', () => {
      this.messageBus.publish({
        type: MessageType.ENGINE_RESUME,
        source: this.source,
        payload: { paused: false }
      });
    });
    
    // Entity events
    eventBus.on('entity:created', (data: any) => {
      this.messageBus.publish({
        type: MessageType.ENTITY_CREATED,
        source: this.source,
        payload: {
          entityId: data.entity.id,
          components: data.entity.components,
          scene: data.scene
        }
      });
    });
    
    eventBus.on('entity:destroyed', (data: any) => {
      this.messageBus.publish({
        type: MessageType.ENTITY_DELETED,
        source: this.source,
        payload: {
          entityId: data.entityId,
          scene: data.scene
        }
      });
    });
    
    // Component events
    eventBus.on('component:added', (data: any) => {
      this.messageBus.publish({
        type: MessageType.COMPONENT_ADDED,
        source: this.source,
        payload: {
          entityId: data.entityId,
          componentType: data.componentType,
          componentData: data.component
        }
      });
    });
    
    eventBus.on('component:removed', (data: any) => {
      this.messageBus.publish({
        type: MessageType.COMPONENT_REMOVED,
        source: this.source,
        payload: {
          entityId: data.entityId,
          componentType: data.componentType
        }
      });
    });
    
    eventBus.on('component:updated', (data: any) => {
      this.messageBus.publish({
        type: MessageType.COMPONENT_UPDATED,
        source: this.source,
        payload: {
          entityId: data.entityId,
          componentType: data.componentType,
          updates: data.updates
        }
      });
    });
    
    // Scene events
    eventBus.on('scene:loaded', (data: any) => {
      this.messageBus.publish({
        type: MessageType.SCENE_LOADED,
        source: this.source,
        payload: {
          sceneId: data.sceneId,
          entities: data.entities
        }
      });
    });
    
    eventBus.on('scene:changed', (data: any) => {
      this.messageBus.publish({
        type: MessageType.SCENE_CHANGE,
        source: this.source,
        payload: {
          previousScene: data.previousScene,
          currentScene: data.currentScene
        }
      });
    });
    
    // Listen to message bus for commands
    const sub1 = this.messageBus.subscribe(MessageType.ENGINE_START, () => {
      this.engine.start();
    });
    
    const sub2 = this.messageBus.subscribe(MessageType.ENGINE_STOP, () => {
      this.engine.stop();
    });
    
    const sub3 = this.messageBus.subscribe(MessageType.ENGINE_PAUSE, () => {
      this.engine.pause();
    });
    
    const sub4 = this.messageBus.subscribe(MessageType.ENGINE_RESUME, () => {
      this.engine.resume();
    });
    
    this.subscriptions.push(
      () => sub1.unsubscribe(),
      () => sub2.unsubscribe(),
      () => sub3.unsubscribe(),
      () => sub4.unsubscribe()
    );
    
    this.connected = true;
    console.log('Engine message bridge connected');
  }
  
  disconnect(): void {
    if (!this.connected) return;
    
    // Unsubscribe from all events
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
    
    this.connected = false;
    console.log('Engine message bridge disconnected');
  }
}

/**
 * State Store Message Bridge
 * 
 * Bridges state store changes to the message bus
 */
export class StateStoreMessageBridge extends MessageBridge {
  private stateStore: UnifiedStateStore;
  private unsubscribe?: () => void;
  
  constructor(messageBus: MessageBus, stateStore: UnifiedStateStore) {
    super(messageBus, 'state-store');
    this.stateStore = stateStore;
  }
  
  connect(): void {
    if (this.connected) return;
    
    // Subscribe to state changes
    this.unsubscribe = this.stateStore.subscribe((state, action) => {
      // Map state actions to messages
      switch (action.type) {
        case 'ENTITY_SELECTED':
          this.messageBus.publish({
            type: MessageType.ENTITY_SELECTED,
            source: this.source,
            payload: {
              entityIds: action.payload.entityIds || [state.editors.selectedEntityId]
            }
          });
          break;
          
        case 'SCENE_CHANGED':
          const activeScene = Array.from(state.scenes.values()).find(s => s.active);
          this.messageBus.publish({
            type: MessageType.SCENE_CHANGE,
            source: this.source,
            payload: {
              currentScene: activeScene?.id || action.payload.sceneId
            }
          });
          break;
          
        case 'ASSET_LOADED':
          this.messageBus.publish({
            type: MessageType.ASSET_LOADED,
            source: this.source,
            payload: action.payload
          });
          break;
          
        case 'UI_MODE_CHANGED':
          this.messageBus.publish({
            type: MessageType.EDITOR_MODE_CHANGE,
            source: this.source,
            payload: {
              mode: state.editors.activeEditor || action.payload.mode
            }
          });
          break;
      }
    });
    
    // Listen to message bus for state updates
    const sub1 = this.messageBus.subscribe(MessageType.ENTITY_SELECTED, (msg) => {
      if (msg.source !== this.source) {
        this.stateStore.dispatch({
          type: 'ENTITY_SELECTED',
          payload: { entityIds: msg.payload.entityIds },
          source: msg.source as any,
          timestamp: msg.timestamp
        });
      }
    });
    
    const sub2 = this.messageBus.subscribe(MessageType.SCENE_CHANGE, (msg) => {
      if (msg.source !== this.source) {
        this.stateStore.dispatch({
          type: 'SCENE_CHANGED',
          payload: { sceneId: msg.payload.currentScene },
          source: msg.source as any,
          timestamp: msg.timestamp
        });
      }
    });
    
    this.connected = true;
    console.log('State store message bridge connected');
  }
  
  disconnect(): void {
    if (!this.connected) return;
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    
    this.connected = false;
    console.log('State store message bridge disconnected');
  }
}

/**
 * Editor Message Bridge
 * 
 * Bridges editor events (sprite editor, level designer) to the message bus
 */
export class EditorMessageBridge extends MessageBridge {
  private handlers: Map<string, (data: any) => void> = new Map();
  
  constructor(messageBus: MessageBus, editorName: string) {
    super(messageBus, `editor:${editorName}`);
  }
  
  connect(): void {
    if (this.connected) return;
    
    // Subscribe to editor-specific messages
    const sub1 = this.messageBus.subscribeWithFilter(
      { target: this.source },
      (msg) => {
        const handler = this.handlers.get(msg.type);
        if (handler) {
          handler(msg.payload);
        }
      }
    );
    
    this.connected = true;
    console.log(`${this.source} message bridge connected`);
  }
  
  disconnect(): void {
    if (!this.connected) return;
    
    this.handlers.clear();
    this.connected = false;
    console.log(`${this.source} message bridge disconnected`);
  }
  
  /**
   * Register a handler for a specific message type
   */
  registerHandler(type: string, handler: (data: any) => void): void {
    this.handlers.set(type, handler);
  }
  
  /**
   * Send an editor event
   */
  sendEditorEvent(type: MessageType, payload: any): void {
    this.messageBus.publish({
      type,
      source: this.source,
      payload
    });
  }
  
  /**
   * Request data from another component
   */
  async requestData<T>(target: string, requestType: string, payload: any): Promise<T> {
    const response = await this.messageBus.request<any, T>({
      type: requestType,
      source: this.source,
      target,
      payload
    });
    
    return response.payload;
  }
}

/**
 * Create and connect all message bridges
 */
export function createMessageBridges(
  messageBus: MessageBus,
  components: {
    engine?: GameEngine;
    stateStore?: UnifiedStateStore;
    editors?: Array<{ name: string; component: any }>;
  }
): Map<string, MessageBridge> {
  const bridges = new Map<string, MessageBridge>();
  
  // Create engine bridge
  if (components.engine) {
    const engineBridge = new EngineMessageBridge(messageBus, components.engine);
    engineBridge.connect();
    bridges.set('engine', engineBridge);
  }
  
  // Create state store bridge
  if (components.stateStore) {
    const stateBridge = new StateStoreMessageBridge(messageBus, components.stateStore);
    stateBridge.connect();
    bridges.set('state-store', stateBridge);
  }
  
  // Create editor bridges
  if (components.editors) {
    components.editors.forEach(({ name, component }) => {
      const editorBridge = new EditorMessageBridge(messageBus, name);
      editorBridge.connect();
      bridges.set(`editor:${name}`, editorBridge);
      
      // Attach bridge to component if it has a setBridge method
      if (typeof component.setMessageBridge === 'function') {
        component.setMessageBridge(editorBridge);
      }
    });
  }
  
  console.log(`Created ${bridges.size} message bridges`);
  return bridges;
}