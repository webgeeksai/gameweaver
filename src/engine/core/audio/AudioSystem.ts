/**
 * Audio System for the Game Vibe Engine
 * Handles sound effects, music, and spatial audio
 */

import { BaseSystem } from '../ecs/System';
import { ComponentType } from '../types';
import { Entity } from '../ecs/Entity';
import { Vector2 } from '../math/Vector2';
import { globalEventBus } from '../events/EventBus';
import { EventPriority, EventSource } from '../types';

export interface AudioSource {
  id: string;
  buffer: AudioBuffer | null;
  gain: GainNode;
  panner?: PannerNode;
  source?: AudioBufferSourceNode;
  loop: boolean;
  volume: number;
  pitch: number;
  position?: Vector2;
  playing: boolean;
  paused: boolean;
  startTime: number;
  pauseTime: number;
}

export interface AudioOptions {
  loop?: boolean;
  volume?: number;
  pitch?: number;
  position?: Vector2;
  spatial?: boolean;
}

export class AudioSystem extends BaseSystem {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private audioSources: Map<string, AudioSource> = new Map();
  private loadedBuffers: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<AudioBuffer>> = new Map();
  private listener: AudioListener | null = null;
  
  // Audio configuration
  private masterVolume: number = 1.0;
  private musicVolume: number = 0.8;
  private sfxVolume: number = 1.0;
  private spatialAudio: boolean = false;
  
  // Current music track
  private currentMusic: string | null = null;
  
  constructor() {
    super(
      'AudioSystem',
      300, // Lower priority - audio is not time-critical
      [] // No required components - audio is managed separately
    );
    
    // Initialize audio context
    this.initializeAudioContext();
  }
  
  private initializeAudioContext(): void {
    // Only initialize audio in browser environment
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
      console.log('AudioSystem: Not in browser environment, skipping audio initialization');
      return;
    }
    
    try {
      // Create audio context
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create master gain node
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.context.destination);
      
      // Get audio listener
      this.listener = this.context.listener;
      
      console.log('AudioSystem: Audio context initialized');
    } catch (error) {
      console.error('AudioSystem: Failed to initialize audio context', error);
    }
  }
  
  initialize(): void {
    console.log('AudioSystem initialized');
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Listen for user interaction to unlock audio context
    const unlockAudio = () => {
      if (this.context && this.context.state === 'suspended') {
        this.context.resume().then(() => {
          console.log('AudioSystem: Audio context resumed');
        });
      }
      
      // Remove event listeners once audio is unlocked
      if (typeof document !== 'undefined') {
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
      }
    };
    
    // Only add event listeners in browser environment
    if (typeof document !== 'undefined') {
      document.addEventListener('click', unlockAudio);
      document.addEventListener('touchstart', unlockAudio);
      document.addEventListener('keydown', unlockAudio);
    }
  }
  
  protected processEntities(entities: Entity[], deltaTime: number): void {
    // Update audio sources
    this.updateAudioSources();
    
    // Update spatial audio for entities with audio components
    for (const entity of entities) {
      if (entity.hasComponent(ComponentType.Audio) && entity.hasComponent(ComponentType.Transform)) {
        this.updateEntityAudio(entity);
      }
    }
  }
  
  private updateAudioSources(): void {
    if (!this.context) return;
    
    // Check for ended sources
    for (const [id, source] of this.audioSources) {
      if (source.playing && source.source) {
        // Check if non-looping source has ended
        if (!source.loop && 
            source.startTime > 0 && 
            this.context.currentTime > source.startTime + (source.buffer?.duration || 0) / source.pitch) {
          
          // Mark as not playing
          source.playing = false;
          source.source = undefined;
          
          // Emit audio ended event
          globalEventBus.emit({
            type: 'audio.ended',
            source: EventSource.System,
            timestamp: Date.now(),
            priority: EventPriority.Normal,
            data: { id }
          });
        }
      }
    }
  }
  
  private updateEntityAudio(entity: Entity): void {
    // In a real implementation, this would update spatial audio sources
    // attached to entities based on their position
  }
  
  // Audio playback
  async play(soundId: string, options: AudioOptions = {}): Promise<string> {
    if (!this.context) {
      console.error('AudioSystem: Audio context not initialized');
      return '';
    }
    
    try {
      // Resume audio context if suspended
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      
      // Load audio buffer
      const buffer = await this.loadAudioBuffer(soundId);
      
      // Generate unique source ID
      const sourceId = `${soundId}_${Date.now()}`;
      
      // Create audio source
      const source = this.createAudioSource(sourceId, buffer, options);
      
      // Start playback
      this.startAudioSource(source);
      
      // Store audio source
      this.audioSources.set(sourceId, source);
      
      // Emit audio started event
      globalEventBus.emit({
        type: 'audio.started',
        source: EventSource.System,
        timestamp: Date.now(),
        priority: EventPriority.Normal,
        data: { id: sourceId, soundId }
      });
      
      return sourceId;
    } catch (error) {
      console.error(`AudioSystem: Failed to play sound ${soundId}`, error);
      return '';
    }
  }
  
  stop(sourceId: string): void {
    const source = this.audioSources.get(sourceId);
    if (!source || !source.source) return;
    
    // Stop audio source
    source.source.stop();
    source.playing = false;
    source.source = undefined;
    
    // Emit audio stopped event
    globalEventBus.emit({
      type: 'audio.stopped',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: { id: sourceId }
    });
  }
  
  pause(sourceId: string): void {
    if (!this.context) return;
    
    const source = this.audioSources.get(sourceId);
    if (!source || !source.playing || source.paused) return;
    
    // Store current time
    source.pauseTime = this.context.currentTime;
    
    // Stop current source
    if (source.source) {
      source.source.stop();
      source.source = undefined;
    }
    
    // Mark as paused
    source.paused = true;
    source.playing = false;
    
    // Emit audio paused event
    globalEventBus.emit({
      type: 'audio.paused',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: { id: sourceId }
    });
  }
  
  resume(sourceId: string): void {
    if (!this.context) return;
    
    const source = this.audioSources.get(sourceId);
    if (!source || !source.paused || source.playing) return;
    
    // Calculate offset
    const offset = (source.pauseTime - source.startTime) % (source.buffer?.duration || 0);
    
    // Create new source
    const newSource = this.context.createBufferSource();
    newSource.buffer = source.buffer;
    newSource.loop = source.loop;
    newSource.playbackRate.value = source.pitch;
    
    // Connect source
    if (source.panner) {
      newSource.connect(source.panner);
    } else {
      newSource.connect(source.gain);
    }
    
    // Start playback from offset
    newSource.start(0, offset);
    
    // Update source
    source.source = newSource;
    source.startTime = this.context.currentTime - offset;
    source.pauseTime = 0;
    source.paused = false;
    source.playing = true;
    
    // Emit audio resumed event
    globalEventBus.emit({
      type: 'audio.resumed',
      source: EventSource.System,
      timestamp: Date.now(),
      priority: EventPriority.Normal,
      data: { id: sourceId }
    });
  }
  
  // Music playback
  async playMusic(musicId: string, fadeTime: number = 1000): Promise<string> {
    // Stop current music if playing
    if (this.currentMusic) {
      await this.stopMusic(fadeTime);
    }
    
    // Play new music
    const sourceId = await this.play(musicId, {
      loop: true,
      volume: this.musicVolume
    });
    
    // Set as current music
    this.currentMusic = sourceId;
    
    // Fade in if requested
    if (fadeTime > 0) {
      this.fadeIn(sourceId, fadeTime);
    }
    
    return sourceId;
  }
  
  async stopMusic(fadeTime: number = 1000): Promise<void> {
    if (!this.currentMusic) return;
    
    const sourceId = this.currentMusic;
    this.currentMusic = null;
    
    // Fade out if requested
    if (fadeTime > 0) {
      await this.fadeOut(sourceId, fadeTime);
    }
    
    // Stop music
    this.stop(sourceId);
  }
  
  // Volume control
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }
  
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    
    // Update current music volume
    if (this.currentMusic) {
      this.setVolume(this.currentMusic, this.musicVolume);
    }
  }
  
  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    
    // Update all non-music sources
    for (const [id, source] of this.audioSources) {
      if (id !== this.currentMusic) {
        this.setVolume(id, this.sfxVolume);
      }
    }
  }
  
  setVolume(sourceId: string, volume: number): void {
    const source = this.audioSources.get(sourceId);
    if (!source) return;
    
    // Update volume
    source.volume = Math.max(0, Math.min(1, volume));
    source.gain.gain.value = source.volume;
  }
  
  // Audio effects
  async fadeIn(sourceId: string, duration: number = 1000): Promise<void> {
    if (!this.context) return;
    
    const source = this.audioSources.get(sourceId);
    if (!source) return;
    
    // Set initial volume to 0
    source.gain.gain.value = 0;
    
    // Fade in
    source.gain.gain.linearRampToValueAtTime(
      source.volume,
      this.context.currentTime + duration / 1000
    );
  }
  
  async fadeOut(sourceId: string, duration: number = 1000): Promise<void> {
    if (!this.context) return;
    
    const source = this.audioSources.get(sourceId);
    if (!source) return;
    
    // Get current volume
    const currentVolume = source.gain.gain.value;
    
    // Fade out
    source.gain.gain.linearRampToValueAtTime(
      0,
      this.context.currentTime + duration / 1000
    );
    
    // Wait for fade to complete
    return new Promise(resolve => {
      setTimeout(() => {
        resolve();
      }, duration);
    });
  }
  
  // Spatial audio
  setListenerPosition(position: Vector2): void {
    if (!this.context || !this.listener) return;
    
    if (this.listener.positionX) {
      // Modern API
      this.listener.positionX.value = position.x;
      this.listener.positionY.value = position.y;
      this.listener.positionZ.value = 0;
    } else {
      // Legacy API
      this.listener.setPosition(position.x, position.y, 0);
    }
  }
  
  setSourcePosition(sourceId: string, position: Vector2): void {
    if (!this.context) return;
    
    const source = this.audioSources.get(sourceId);
    if (!source || !source.panner) return;
    
    // Update position
    source.position = position;
    
    if (source.panner.positionX) {
      // Modern API
      source.panner.positionX.value = position.x;
      source.panner.positionY.value = position.y;
      source.panner.positionZ.value = 0;
    } else {
      // Legacy API
      source.panner.setPosition(position.x, position.y, 0);
    }
  }
  
  // Helper methods
  private async loadAudioBuffer(soundId: string): Promise<AudioBuffer> {
    if (!this.context) {
      throw new Error('AudioSystem: Audio context not initialized');
    }
    
    // Check if already loaded
    if (this.loadedBuffers.has(soundId)) {
      return this.loadedBuffers.get(soundId)!;
    }
    
    // Check if already loading
    if (this.loadingPromises.has(soundId)) {
      return this.loadingPromises.get(soundId)!;
    }
    
    // Start loading
    const loadPromise = this.loadAudioFile(soundId);
    this.loadingPromises.set(soundId, loadPromise);
    
    try {
      const buffer = await loadPromise;
      this.loadedBuffers.set(soundId, buffer);
      this.loadingPromises.delete(soundId);
      return buffer;
    } catch (error) {
      this.loadingPromises.delete(soundId);
      throw error;
    }
  }
  
  private async loadAudioFile(soundId: string): Promise<AudioBuffer> {
    if (!this.context) {
      throw new Error('AudioSystem: Audio context not initialized');
    }
    
    try {
      // In a real implementation, this would load the audio file from a URL
      // For now, create a simple beep sound
      return this.createBeepSound(soundId);
    } catch (error) {
      console.error(`AudioSystem: Failed to load sound ${soundId}`, error);
      throw error;
    }
  }
  
  private createBeepSound(soundId: string): Promise<AudioBuffer> {
    if (!this.context) {
      throw new Error('AudioSystem: Audio context not initialized');
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Create a 1-second buffer
        const sampleRate = this.context!.sampleRate;
        const buffer = this.context!.createBuffer(1, sampleRate, sampleRate);
        
        // Fill the buffer with a simple sine wave
        const data = buffer.getChannelData(0);
        const frequency = 440; // A4 note
        
        for (let i = 0; i < sampleRate; i++) {
          data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
          
          // Apply fade in/out
          const fadeTime = 0.1; // 100ms fade
          const fadeSamples = fadeTime * sampleRate;
          
          if (i < fadeSamples) {
            // Fade in
            data[i] *= i / fadeSamples;
          } else if (i > sampleRate - fadeSamples) {
            // Fade out
            data[i] *= (sampleRate - i) / fadeSamples;
          }
        }
        
        resolve(buffer);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  private createAudioSource(sourceId: string, buffer: AudioBuffer, options: AudioOptions): AudioSource {
    if (!this.context || !this.masterGain) {
      throw new Error('AudioSystem: Audio context not initialized');
    }
    
    // Default options
    const loop = options.loop || false;
    const volume = options.volume !== undefined ? options.volume : (loop ? this.musicVolume : this.sfxVolume);
    const pitch = options.pitch || 1.0;
    const position = options.position;
    const spatial = options.spatial || false;
    
    // Create gain node
    const gain = this.context.createGain();
    gain.gain.value = volume;
    
    // Create panner node if spatial
    let panner: PannerNode | undefined;
    if (spatial && position) {
      panner = this.context.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 100;
      panner.maxDistance = 1000;
      panner.rolloffFactor = 1;
      
      // Set position
      if (panner.positionX) {
        // Modern API
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = 0;
      } else {
        // Legacy API
        panner.setPosition(position.x, position.y, 0);
      }
      
      // Connect panner to gain
      panner.connect(gain);
      
      // Connect gain to master
      gain.connect(this.masterGain);
    } else {
      // Connect gain directly to master
      gain.connect(this.masterGain);
    }
    
    // Create audio source
    return {
      id: sourceId,
      buffer,
      gain,
      panner,
      loop,
      volume,
      pitch,
      position,
      playing: false,
      paused: false,
      startTime: 0,
      pauseTime: 0
    };
  }
  
  private startAudioSource(source: AudioSource): void {
    if (!this.context) return;
    
    // Create buffer source
    const bufferSource = this.context.createBufferSource();
    bufferSource.buffer = source.buffer;
    bufferSource.loop = source.loop;
    bufferSource.playbackRate.value = source.pitch;
    
    // Connect source
    if (source.panner) {
      bufferSource.connect(source.panner);
    } else {
      bufferSource.connect(source.gain);
    }
    
    // Start playback
    bufferSource.start();
    
    // Update source
    source.source = bufferSource;
    source.startTime = this.context.currentTime;
    source.playing = true;
    source.paused = false;
  }
  
  // Public API
  isPlaying(sourceId: string): boolean {
    const source = this.audioSources.get(sourceId);
    return source ? source.playing : false;
  }
  
  isPaused(sourceId: string): boolean {
    const source = this.audioSources.get(sourceId);
    return source ? source.paused : false;
  }
  
  getPlaybackPosition(sourceId: string): number {
    if (!this.context) return 0;
    
    const source = this.audioSources.get(sourceId);
    if (!source || !source.playing) return 0;
    
    // Calculate current position
    const elapsed = this.context.currentTime - source.startTime;
    const duration = source.buffer?.duration || 0;
    
    // Handle looping
    return source.loop ? elapsed % duration : Math.min(elapsed, duration);
  }
  
  getDuration(sourceId: string): number {
    const source = this.audioSources.get(sourceId);
    return source && source.buffer ? source.buffer.duration : 0;
  }
  
  // Cleanup
  cleanup(): void {
    // Stop all audio sources
    for (const [id, _] of this.audioSources) {
      this.stop(id);
    }
    
    // Clear collections
    this.audioSources.clear();
    this.loadedBuffers.clear();
    this.loadingPromises.clear();
    
    // Close audio context
    if (this.context && this.context.state !== 'closed') {
      this.context.close();
    }
  }
}