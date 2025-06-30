/**
 * Visual Scripting System
 * 
 * Node-based visual scripting system similar to Unity's Visual Scripting
 * or Unreal's Blueprint system.
 */

import { EventEmitter } from 'events';
import { Entity } from '../core/ecs/Entity';
import { Component } from '../core/ecs/Component';

export interface ScriptNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  inputs: NodePort[];
  outputs: NodePort[];
  properties: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface NodePort {
  id: string;
  name: string;
  type: PortType;
  dataType: DataType;
  connected?: string; // Connected port ID
  value?: any;
}

export enum PortType {
  Input = 'input',
  Output = 'output'
}

export enum DataType {
  Flow = 'flow',
  Boolean = 'boolean',
  Number = 'number',
  String = 'string',
  Vector2 = 'vector2',
  Vector3 = 'vector3',
  Entity = 'entity',
  Component = 'component',
  Any = 'any'
}

export interface NodeConnection {
  id: string;
  source: { nodeId: string; portId: string };
  target: { nodeId: string; portId: string };
}

export interface VisualScript {
  id: string;
  name: string;
  description: string;
  nodes: ScriptNode[];
  connections: NodeConnection[];
  variables: ScriptVariable[];
  metadata?: Record<string, any>;
}

export interface ScriptVariable {
  name: string;
  type: DataType;
  value: any;
  isPublic: boolean;
}

export interface NodeDefinition {
  type: string;
  category: string;
  name: string;
  description: string;
  inputs: Omit<NodePort, 'id' | 'connected'>[];
  outputs: Omit<NodePort, 'id' | 'connected'>[];
  properties?: Record<string, any>;
  execute: (context: ExecutionContext, node: ScriptNode) => void | Promise<void>;
}

export interface ExecutionContext {
  entity?: Entity;
  component?: Component;
  variables: Map<string, any>;
  deltaTime: number;
  getInput: (portName: string) => any;
  setOutput: (portName: string, value: any) => void;
  executeFlow: (portName: string) => void;
}

/**
 * Node Registry
 */
export class NodeRegistry {
  private definitions: Map<string, NodeDefinition> = new Map();
  private categories: Map<string, Set<string>> = new Map();

  constructor() {
    this.registerDefaultNodes();
  }

  /**
   * Register a node definition
   */
  register(definition: NodeDefinition): void {
    this.definitions.set(definition.type, definition);
    
    // Add to category
    if (!this.categories.has(definition.category)) {
      this.categories.set(definition.category, new Set());
    }
    this.categories.get(definition.category)!.add(definition.type);
  }

  /**
   * Get node definition
   */
  getDefinition(type: string): NodeDefinition | undefined {
    return this.definitions.get(type);
  }

  /**
   * Get all definitions
   */
  getAllDefinitions(): NodeDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Get definitions by category
   */
  getByCategory(category: string): NodeDefinition[] {
    const types = this.categories.get(category);
    if (!types) return [];
    
    return Array.from(types)
      .map(type => this.definitions.get(type))
      .filter(Boolean) as NodeDefinition[];
  }

  /**
   * Register default nodes
   */
  private registerDefaultNodes(): void {
    // Event nodes
    this.register({
      type: 'event.start',
      category: 'Events',
      name: 'Start',
      description: 'Called when the script starts',
      inputs: [],
      outputs: [{ name: 'flow', type: PortType.Output, dataType: DataType.Flow }],
      execute: (ctx) => {
        ctx.executeFlow('flow');
      }
    });

    this.register({
      type: 'event.update',
      category: 'Events',
      name: 'Update',
      description: 'Called every frame',
      inputs: [],
      outputs: [
        { name: 'flow', type: PortType.Output, dataType: DataType.Flow },
        { name: 'deltaTime', type: PortType.Output, dataType: DataType.Number }
      ],
      execute: (ctx) => {
        ctx.setOutput('deltaTime', ctx.deltaTime);
        ctx.executeFlow('flow');
      }
    });

    // Logic nodes
    this.register({
      type: 'logic.if',
      category: 'Logic',
      name: 'If',
      description: 'Conditional branch',
      inputs: [
        { name: 'flow', type: PortType.Input, dataType: DataType.Flow },
        { name: 'condition', type: PortType.Input, dataType: DataType.Boolean }
      ],
      outputs: [
        { name: 'true', type: PortType.Output, dataType: DataType.Flow },
        { name: 'false', type: PortType.Output, dataType: DataType.Flow }
      ],
      execute: (ctx) => {
        const condition = ctx.getInput('condition');
        if (condition) {
          ctx.executeFlow('true');
        } else {
          ctx.executeFlow('false');
        }
      }
    });

    // Math nodes
    this.register({
      type: 'math.add',
      category: 'Math',
      name: 'Add',
      description: 'Add two numbers',
      inputs: [
        { name: 'a', type: PortType.Input, dataType: DataType.Number },
        { name: 'b', type: PortType.Input, dataType: DataType.Number }
      ],
      outputs: [
        { name: 'result', type: PortType.Output, dataType: DataType.Number }
      ],
      execute: (ctx) => {
        const a = ctx.getInput('a') || 0;
        const b = ctx.getInput('b') || 0;
        ctx.setOutput('result', a + b);
      }
    });

    // Transform nodes
    this.register({
      type: 'transform.getPosition',
      category: 'Transform',
      name: 'Get Position',
      description: 'Get entity position',
      inputs: [
        { name: 'entity', type: PortType.Input, dataType: DataType.Entity }
      ],
      outputs: [
        { name: 'position', type: PortType.Output, dataType: DataType.Vector2 }
      ],
      execute: (ctx) => {
        const entity = ctx.getInput('entity') || ctx.entity;
        if (entity) {
          const transform = entity.getComponent('transform');
          if (transform) {
            ctx.setOutput('position', transform.position);
          }
        }
      }
    });

    this.register({
      type: 'transform.setPosition',
      category: 'Transform',
      name: 'Set Position',
      description: 'Set entity position',
      inputs: [
        { name: 'flow', type: PortType.Input, dataType: DataType.Flow },
        { name: 'entity', type: PortType.Input, dataType: DataType.Entity },
        { name: 'position', type: PortType.Input, dataType: DataType.Vector2 }
      ],
      outputs: [
        { name: 'flow', type: PortType.Output, dataType: DataType.Flow }
      ],
      execute: (ctx) => {
        const entity = ctx.getInput('entity') || ctx.entity;
        const position = ctx.getInput('position');
        
        if (entity && position) {
          const transform = entity.getComponent('transform');
          if (transform) {
            transform.position = position;
          }
        }
        
        ctx.executeFlow('flow');
      }
    });
  }
}

/**
 * Script Execution Engine
 */
export class ScriptExecutor {
  private nodeRegistry: NodeRegistry;
  private runningScripts: Map<string, ScriptInstance> = new Map();

  constructor(nodeRegistry: NodeRegistry) {
    this.nodeRegistry = nodeRegistry;
  }

  /**
   * Execute a visual script
   */
  async execute(
    script: VisualScript,
    context: Partial<ExecutionContext>
  ): Promise<void> {
    const instance = new ScriptInstance(script, this.nodeRegistry);
    
    // Initialize context
    const fullContext: ExecutionContext = {
      entity: context.entity,
      component: context.component,
      variables: new Map(
        script.variables.map(v => [v.name, v.value])
      ),
      deltaTime: context.deltaTime || 0,
      getInput: () => null,
      setOutput: () => {},
      executeFlow: () => {}
    };

    // Execute start nodes
    const startNodes = script.nodes.filter(n => n.type === 'event.start');
    for (const node of startNodes) {
      await instance.executeNode(node.id, fullContext);
    }

    // Store instance for update events
    this.runningScripts.set(script.id, instance);
  }

  /**
   * Update all running scripts
   */
  async update(deltaTime: number): Promise<void> {
    for (const [scriptId, instance] of this.runningScripts) {
      await instance.update(deltaTime);
    }
  }

  /**
   * Stop a script
   */
  stop(scriptId: string): void {
    this.runningScripts.delete(scriptId);
  }

  /**
   * Stop all scripts
   */
  stopAll(): void {
    this.runningScripts.clear();
  }
}

/**
 * Script Instance
 */
class ScriptInstance {
  private script: VisualScript;
  private nodeRegistry: NodeRegistry;
  private nodeOutputs: Map<string, Map<string, any>> = new Map();
  private executionStack: string[] = [];

  constructor(script: VisualScript, nodeRegistry: NodeRegistry) {
    this.script = script;
    this.nodeRegistry = nodeRegistry;
  }

  /**
   * Execute a node
   */
  async executeNode(nodeId: string, baseContext: ExecutionContext): Promise<void> {
    const node = this.script.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Check for circular execution
    if (this.executionStack.includes(nodeId)) {
      console.warn(`Circular execution detected: ${nodeId}`);
      return;
    }

    this.executionStack.push(nodeId);

    try {
      const definition = this.nodeRegistry.getDefinition(node.type);
      if (!definition) {
        console.error(`Unknown node type: ${node.type}`);
        return;
      }

      // Create node context
      const nodeContext: ExecutionContext = {
        ...baseContext,
        getInput: (portName: string) => this.getNodeInput(node, portName),
        setOutput: (portName: string, value: any) => this.setNodeOutput(node, portName, value),
        executeFlow: (portName: string) => this.executeFlowOutput(node, portName, baseContext)
      };

      // Execute node
      await definition.execute(nodeContext, node);

    } finally {
      this.executionStack.pop();
    }
  }

  /**
   * Update script (for update events)
   */
  async update(deltaTime: number): Promise<void> {
    const updateNodes = this.script.nodes.filter(n => n.type === 'event.update');
    
    for (const node of updateNodes) {
      const context: ExecutionContext = {
        variables: new Map(this.script.variables.map(v => [v.name, v.value])),
        deltaTime,
        getInput: () => null,
        setOutput: () => {},
        executeFlow: () => {}
      };

      await this.executeNode(node.id, context);
    }
  }

  /**
   * Get input value for a node
   */
  private getNodeInput(node: ScriptNode, portName: string): any {
    const port = node.inputs.find(p => p.name === portName);
    if (!port) return null;

    // Check for connection
    const connection = this.script.connections.find(
      c => c.target.nodeId === node.id && c.target.portId === port.id
    );

    if (connection) {
      // Get value from connected output
      const sourceOutputs = this.nodeOutputs.get(connection.source.nodeId);
      if (sourceOutputs) {
        return sourceOutputs.get(connection.source.portId);
      }
    }

    // Return default value
    return port.value;
  }

  /**
   * Set output value for a node
   */
  private setNodeOutput(node: ScriptNode, portName: string, value: any): void {
    const port = node.outputs.find(p => p.name === portName);
    if (!port) return;

    if (!this.nodeOutputs.has(node.id)) {
      this.nodeOutputs.set(node.id, new Map());
    }

    this.nodeOutputs.get(node.id)!.set(port.id, value);
  }

  /**
   * Execute flow output
   */
  private executeFlowOutput(node: ScriptNode, portName: string, context: ExecutionContext): void {
    const port = node.outputs.find(p => p.name === portName && p.dataType === DataType.Flow);
    if (!port) return;

    // Find connected nodes
    const connections = this.script.connections.filter(
      c => c.source.nodeId === node.id && c.source.portId === port.id
    );

    // Execute connected nodes
    for (const connection of connections) {
      this.executeNode(connection.target.nodeId, context).catch(console.error);
    }
  }
}

/**
 * Visual Scripting System Manager
 */
export class VisualScriptingSystem extends EventEmitter {
  private nodeRegistry: NodeRegistry;
  private scriptExecutor: ScriptExecutor;
  private scripts: Map<string, VisualScript> = new Map();

  constructor() {
    super();
    this.nodeRegistry = new NodeRegistry();
    this.scriptExecutor = new ScriptExecutor(this.nodeRegistry);
  }

  /**
   * Register custom node
   */
  registerNode(definition: NodeDefinition): void {
    this.nodeRegistry.register(definition);
  }

  /**
   * Create a new script
   */
  createScript(name: string, description: string = ''): VisualScript {
    const script: VisualScript = {
      id: this.generateId(),
      name,
      description,
      nodes: [],
      connections: [],
      variables: []
    };

    this.scripts.set(script.id, script);
    this.emit('script:created', script);

    return script;
  }

  /**
   * Add node to script
   */
  addNode(
    scriptId: string,
    nodeType: string,
    position: { x: number; y: number }
  ): ScriptNode | null {
    const script = this.scripts.get(scriptId);
    if (!script) return null;

    const definition = this.nodeRegistry.getDefinition(nodeType);
    if (!definition) return null;

    const node: ScriptNode = {
      id: this.generateId(),
      type: nodeType,
      name: definition.name,
      position,
      inputs: definition.inputs.map(input => ({
        ...input,
        id: this.generateId()
      })),
      outputs: definition.outputs.map(output => ({
        ...output,
        id: this.generateId()
      })),
      properties: { ...definition.properties }
    };

    script.nodes.push(node);
    this.emit('node:added', { scriptId, node });

    return node;
  }

  /**
   * Connect nodes
   */
  connectNodes(
    scriptId: string,
    source: { nodeId: string; portId: string },
    target: { nodeId: string; portId: string }
  ): NodeConnection | null {
    const script = this.scripts.get(scriptId);
    if (!script) return null;

    // Validate connection
    if (!this.validateConnection(script, source, target)) {
      return null;
    }

    const connection: NodeConnection = {
      id: this.generateId(),
      source,
      target
    };

    script.connections.push(connection);
    this.emit('connection:added', { scriptId, connection });

    return connection;
  }

  /**
   * Execute script
   */
  async executeScript(
    scriptId: string,
    context?: Partial<ExecutionContext>
  ): Promise<void> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script not found: ${scriptId}`);
    }

    await this.scriptExecutor.execute(script, context || {});
  }

  /**
   * Update all running scripts
   */
  async update(deltaTime: number): Promise<void> {
    await this.scriptExecutor.update(deltaTime);
  }

  /**
   * Validate connection
   */
  private validateConnection(
    script: VisualScript,
    source: { nodeId: string; portId: string },
    target: { nodeId: string; portId: string }
  ): boolean {
    // Get nodes
    const sourceNode = script.nodes.find(n => n.id === source.nodeId);
    const targetNode = script.nodes.find(n => n.id === target.nodeId);
    
    if (!sourceNode || !targetNode) return false;

    // Get ports
    const sourcePort = sourceNode.outputs.find(p => p.id === source.portId);
    const targetPort = targetNode.inputs.find(p => p.id === target.portId);
    
    if (!sourcePort || !targetPort) return false;

    // Check data type compatibility
    if (sourcePort.dataType !== targetPort.dataType && 
        sourcePort.dataType !== DataType.Any &&
        targetPort.dataType !== DataType.Any) {
      return false;
    }

    // Check for existing connection
    const existing = script.connections.find(
      c => c.target.nodeId === target.nodeId && c.target.portId === target.portId
    );
    
    return !existing;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export script
   */
  exportScript(scriptId: string): string {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script not found: ${scriptId}`);
    }

    return JSON.stringify(script, null, 2);
  }

  /**
   * Import script
   */
  importScript(jsonData: string): VisualScript {
    const script = JSON.parse(jsonData);
    script.id = this.generateId(); // Generate new ID
    
    this.scripts.set(script.id, script);
    this.emit('script:imported', script);
    
    return script;
  }
}