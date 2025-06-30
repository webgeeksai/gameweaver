/**
 * Performance Profiler System
 * 
 * Comprehensive performance monitoring and profiling system for the game engine,
 * similar to Unity's Profiler window.
 */

import { EventEmitter } from 'events';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: string;
}

export interface FrameProfile {
  frameNumber: number;
  timestamp: number;
  deltaTime: number;
  fps: number;
  
  // Timing breakdown
  updateTime: number;
  renderTime: number;
  physicsTime: number;
  scriptTime: number;
  
  // System metrics
  entityCount: number;
  componentCount: number;
  drawCalls: number;
  triangleCount: number;
  textureMemory: number;
  
  // Memory
  heapUsed: number;
  heapTotal: number;
  
  // Custom markers
  markers: ProfileMarker[];
}

export interface ProfileMarker {
  name: string;
  category: string;
  startTime: number;
  duration: number;
  depth: number;
  metadata?: Record<string, any>;
}

export interface SystemProfile {
  name: string;
  averageTime: number;
  peakTime: number;
  callCount: number;
  totalTime: number;
}

export interface MemoryProfile {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  
  // Object counts
  entities: number;
  components: number;
  textures: number;
  sounds: number;
  
  // By category
  byCategory: Record<string, number>;
}

export interface ProfilerConfig {
  enabled: boolean;
  sampleRate: number; // Frames to sample (1 = every frame)
  maxFrames: number; // Max frames to keep in history
  captureMemory: boolean;
  captureGPU: boolean;
  autoStart: boolean;
}

/**
 * Performance Profiler
 */
export class PerformanceProfiler extends EventEmitter {
  private config: ProfilerConfig;
  private isRunning: boolean = false;
  private frameHistory: FrameProfile[] = [];
  private currentFrame?: FrameProfile;
  private markerStack: ProfileMarker[] = [];
  private systemProfiles: Map<string, SystemProfile> = new Map();
  private frameCount: number = 0;
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  
  // Performance tracking
  private updateStartTime: number = 0;
  private renderStartTime: number = 0;
  private physicsStartTime: number = 0;
  private scriptStartTime: number = 0;

  constructor(config?: Partial<ProfilerConfig>) {
    super();
    
    this.config = {
      enabled: true,
      sampleRate: 1,
      maxFrames: 300, // 5 seconds at 60 FPS
      captureMemory: true,
      captureGPU: false,
      autoStart: true,
      ...config
    };

    if (this.config.autoStart && this.config.enabled) {
      this.start();
    }
  }

  /**
   * Start profiling
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.frameHistory = [];
    
    console.log('Performance profiler started');
    this.emit('profiler:started');
  }

  /**
   * Stop profiling
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    console.log('Performance profiler stopped');
    this.emit('profiler:stopped');
  }

  /**
   * Begin frame profiling
   */
  beginFrame(): void {
    if (!this.isRunning || !this.config.enabled) return;

    this.frameCount++;
    
    // Check sample rate
    if (this.frameCount % this.config.sampleRate !== 0) return;

    const now = performance.now();
    const deltaTime = this.lastFrameTime ? now - this.lastFrameTime : 16.67;
    
    this.currentFrame = {
      frameNumber: this.frameCount,
      timestamp: now,
      deltaTime,
      fps: 1000 / deltaTime,
      updateTime: 0,
      renderTime: 0,
      physicsTime: 0,
      scriptTime: 0,
      entityCount: 0,
      componentCount: 0,
      drawCalls: 0,
      triangleCount: 0,
      textureMemory: 0,
      heapUsed: 0,
      heapTotal: 0,
      markers: []
    };

    this.lastFrameTime = now;
    this.markerStack = [];

    // Capture memory if enabled
    if (this.config.captureMemory && 'memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.currentFrame.heapUsed = memoryInfo.usedJSHeapSize;
      this.currentFrame.heapTotal = memoryInfo.totalJSHeapSize;
    }
  }

  /**
   * End frame profiling
   */
  endFrame(): void {
    if (!this.isRunning || !this.currentFrame) return;

    // Add frame to history
    this.frameHistory.push(this.currentFrame);
    
    // Limit history size
    if (this.frameHistory.length > this.config.maxFrames) {
      this.frameHistory.shift();
    }

    // Emit frame data
    this.emit('profiler:frame', this.currentFrame);

    this.currentFrame = undefined;
  }

  /**
   * Begin profiling a section
   */
  beginSection(name: string, category: string = 'general'): void {
    if (!this.isRunning || !this.currentFrame) return;

    const marker: ProfileMarker = {
      name,
      category,
      startTime: performance.now(),
      duration: 0,
      depth: this.markerStack.length
    };

    this.markerStack.push(marker);
  }

  /**
   * End profiling a section
   */
  endSection(): void {
    if (!this.isRunning || !this.currentFrame || this.markerStack.length === 0) return;

    const marker = this.markerStack.pop()!;
    marker.duration = performance.now() - marker.startTime;
    
    this.currentFrame.markers.push(marker);

    // Update system profile
    this.updateSystemProfile(marker.name, marker.duration);
  }

  /**
   * Profile update phase
   */
  profileUpdate(duration: number): void {
    if (this.currentFrame) {
      this.currentFrame.updateTime = duration;
    }
  }

  /**
   * Profile render phase
   */
  profileRender(duration: number, drawCalls?: number, triangles?: number): void {
    if (this.currentFrame) {
      this.currentFrame.renderTime = duration;
      if (drawCalls !== undefined) this.currentFrame.drawCalls = drawCalls;
      if (triangles !== undefined) this.currentFrame.triangleCount = triangles;
    }
  }

  /**
   * Profile physics phase
   */
  profilePhysics(duration: number): void {
    if (this.currentFrame) {
      this.currentFrame.physicsTime = duration;
    }
  }

  /**
   * Profile script execution
   */
  profileScript(duration: number): void {
    if (this.currentFrame) {
      this.currentFrame.scriptTime = duration;
    }
  }

  /**
   * Set entity count
   */
  setEntityCount(count: number): void {
    if (this.currentFrame) {
      this.currentFrame.entityCount = count;
    }
  }

  /**
   * Set component count
   */
  setComponentCount(count: number): void {
    if (this.currentFrame) {
      this.currentFrame.componentCount = count;
    }
  }

  /**
   * Set texture memory usage
   */
  setTextureMemory(bytes: number): void {
    if (this.currentFrame) {
      this.currentFrame.textureMemory = bytes;
    }
  }

  /**
   * Add custom metric
   */
  addMetric(metric: PerformanceMetric): void {
    this.emit('profiler:metric', metric);
  }

  /**
   * Get current FPS
   */
  getCurrentFPS(): number {
    if (this.frameHistory.length === 0) return 0;
    
    const recentFrames = this.frameHistory.slice(-60); // Last second
    const avgDeltaTime = recentFrames.reduce((sum, frame) => sum + frame.deltaTime, 0) / recentFrames.length;
    
    return 1000 / avgDeltaTime;
  }

  /**
   * Get average frame time
   */
  getAverageFrameTime(): number {
    if (this.frameHistory.length === 0) return 0;
    
    const total = this.frameHistory.reduce((sum, frame) => sum + frame.deltaTime, 0);
    return total / this.frameHistory.length;
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    fps: number;
    frameTime: number;
    updateTime: number;
    renderTime: number;
    physicsTime: number;
    scriptTime: number;
    entityCount: number;
    drawCalls: number;
    memoryMB: number;
  } {
    const recent = this.frameHistory.slice(-60);
    if (recent.length === 0) {
      return {
        fps: 0,
        frameTime: 0,
        updateTime: 0,
        renderTime: 0,
        physicsTime: 0,
        scriptTime: 0,
        entityCount: 0,
        drawCalls: 0,
        memoryMB: 0
      };
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      fps: this.getCurrentFPS(),
      frameTime: avg(recent.map(f => f.deltaTime)),
      updateTime: avg(recent.map(f => f.updateTime)),
      renderTime: avg(recent.map(f => f.renderTime)),
      physicsTime: avg(recent.map(f => f.physicsTime)),
      scriptTime: avg(recent.map(f => f.scriptTime)),
      entityCount: recent[recent.length - 1]?.entityCount || 0,
      drawCalls: avg(recent.map(f => f.drawCalls)),
      memoryMB: (recent[recent.length - 1]?.heapUsed || 0) / (1024 * 1024)
    };
  }

  /**
   * Get frame history
   */
  getFrameHistory(): FrameProfile[] {
    return [...this.frameHistory];
  }

  /**
   * Get system profiles
   */
  getSystemProfiles(): SystemProfile[] {
    return Array.from(this.systemProfiles.values())
      .sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Get memory profile
   */
  getMemoryProfile(): MemoryProfile {
    const latest = this.frameHistory[this.frameHistory.length - 1];
    
    return {
      timestamp: Date.now(),
      heapUsed: latest?.heapUsed || 0,
      heapTotal: latest?.heapTotal || 0,
      external: 0,
      arrayBuffers: 0,
      entities: latest?.entityCount || 0,
      components: latest?.componentCount || 0,
      textures: 0,
      sounds: 0,
      byCategory: {}
    };
  }

  /**
   * Clear profiler data
   */
  clear(): void {
    this.frameHistory = [];
    this.systemProfiles.clear();
    this.frameCount = 0;
    this.emit('profiler:cleared');
  }

  /**
   * Export profiler data
   */
  exportData(): string {
    const data = {
      summary: this.getSummary(),
      frameHistory: this.frameHistory.slice(-100), // Last 100 frames
      systemProfiles: this.getSystemProfiles(),
      config: this.config,
      timestamp: Date.now()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const summary = this.getSummary();
    const systems = this.getSystemProfiles();
    
    let report = '=== Performance Report ===\n\n';
    report += `Average FPS: ${summary.fps.toFixed(1)}\n`;
    report += `Frame Time: ${summary.frameTime.toFixed(2)}ms\n`;
    report += `- Update: ${summary.updateTime.toFixed(2)}ms\n`;
    report += `- Render: ${summary.renderTime.toFixed(2)}ms\n`;
    report += `- Physics: ${summary.physicsTime.toFixed(2)}ms\n`;
    report += `- Scripts: ${summary.scriptTime.toFixed(2)}ms\n\n`;
    
    report += `Entity Count: ${summary.entityCount}\n`;
    report += `Draw Calls: ${summary.drawCalls.toFixed(0)}\n`;
    report += `Memory Usage: ${summary.memoryMB.toFixed(1)}MB\n\n`;
    
    report += '=== Top Systems ===\n';
    systems.slice(0, 10).forEach(sys => {
      report += `${sys.name}: ${sys.averageTime.toFixed(2)}ms (${sys.callCount} calls)\n`;
    });
    
    return report;
  }

  /**
   * Update system profile
   */
  private updateSystemProfile(name: string, duration: number): void {
    let profile = this.systemProfiles.get(name);
    
    if (!profile) {
      profile = {
        name,
        averageTime: 0,
        peakTime: 0,
        callCount: 0,
        totalTime: 0
      };
      this.systemProfiles.set(name, profile);
    }

    profile.callCount++;
    profile.totalTime += duration;
    profile.averageTime = profile.totalTime / profile.callCount;
    profile.peakTime = Math.max(profile.peakTime, duration);
  }

  /**
   * Get profiler status
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set profiler enabled state
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (enabled && this.config.autoStart) {
      this.start();
    } else if (!enabled) {
      this.stop();
    }
  }

  /**
   * Get configuration
   */
  getConfig(): ProfilerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProfilerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let globalProfiler: PerformanceProfiler | null = null;

/**
 * Get global profiler instance
 */
export function getGlobalProfiler(config?: Partial<ProfilerConfig>): PerformanceProfiler {
  if (!globalProfiler) {
    globalProfiler = new PerformanceProfiler(config);
  }
  return globalProfiler;
}