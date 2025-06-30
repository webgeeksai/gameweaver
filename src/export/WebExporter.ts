/**
 * Web Exporter for the Game Vibe Engine
 * Exports games to HTML5 web format
 */

import { ExportOptions, ExportResult, GameBundle, WebExportOptions, PWAOptions } from './types';
import { GameState } from '../core/types';

export class WebExporter {
  /**
   * Export game to web format
   */
  async export(gameState: GameState, options: ExportOptions): Promise<ExportResult> {
    try {
      console.log('Exporting game to web format...');
      
      // Extract web-specific options
      const webOptions = options as WebExportOptions;
      
      // 1. Generate HTML shell
      const htmlShell = this.generateHTMLShell(gameState, webOptions);
      
      // 2. Bundle game code
      const gameCode = this.bundleGameCode(gameState, webOptions);
      
      // 3. Process assets
      const processedAssets = this.processAssets(gameState.assets, webOptions);
      
      // 4. Generate PWA files if requested
      let pwaFiles = {};
      if (webOptions.pwa?.enabled) {
        pwaFiles = this.generatePWAFiles(gameState, webOptions.pwa);
      }
      
      // 5. Create bundle
      const bundle: GameBundle = {
        platform: 'web',
        files: {
          'index.html': htmlShell,
          'game.js': gameCode,
          ...processedAssets,
          ...pwaFiles
        },
        entryPoint: 'index.html',
        size: this.calculateBundleSize({
          'index.html': htmlShell,
          'game.js': gameCode,
          ...processedAssets,
          ...pwaFiles
        })
      };
      
      return {
        success: true,
        platform: 'web',
        bundle,
        size: bundle.size,
        optimizations: this.getOptimizationSummary(webOptions)
      };
      
    } catch (error) {
      console.error('Web export failed:', error);
      return {
        success: false,
        error: error.message,
        platform: 'web'
      };
    }
  }
  
  /**
   * Generate HTML shell for the game
   */
  private generateHTMLShell(gameState: GameState, options: WebExportOptions): string {
    const title = gameState.global?.gameTitle || 'Game Vibe Engine Game';
    const description = gameState.global?.description || 'A game created with Game Vibe Engine';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- Performance optimizations -->
    <link rel="preload" href="game.js" as="script">
    <link rel="preload" href="assets/atlas.png" as="image">
    
    <!-- PWA manifest -->
    ${options.pwa?.enabled ? '<link rel="manifest" href="manifest.json">' : ''}
    
    <!-- Favicon -->
    <link rel="icon" href="favicon.ico">
    
    <!-- Meta tags for social sharing -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="preview.png">
    <meta property="og:type" content="website">
    
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: Arial, sans-serif;
        }
        
        #game-container {
            position: relative;
            ${gameState.global?.pixelArt ? 'image-rendering: pixelated;' : ''}
        }
        
        #loading-screen {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            color: #fff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        
        .loading-bar {
            width: 200px;
            height: 4px;
            background: #333;
            border-radius: 2px;
            overflow: hidden;
            margin-top: 20px;
        }
        
        .loading-progress {
            height: 100%;
            background: #4CAF50;
            width: 0%;
            transition: width 0.3s ease;
        }
        
        canvas {
            display: block;
            max-width: 100%;
            max-height: 100vh;
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
            body {
                overflow: hidden;
            }
            
            canvas {
                width: 100vw !important;
                height: 100vh !important;
                object-fit: contain;
            }
        }
    </style>
</head>
<body>
    <div id="game-container">
        <div id="loading-screen">
            <h1>${title}</h1>
            <p>Loading...</p>
            <div class="loading-bar">
                <div class="loading-progress" id="loading-progress"></div>
            </div>
        </div>
        <canvas id="game-canvas"></canvas>
    </div>
    
    <!-- Game engine -->
    <script src="game.js"></script>
    
    <!-- Analytics -->
    ${options.analytics?.enabled ? this.generateAnalyticsScript(options.analytics) : ''}
    
    <!-- PWA registration -->
    ${options.pwa?.enabled ? this.generatePWAScript() : ''}
    
    <script>
        // Initialize game
        window.addEventListener('load', () => {
            const gameConfig = ${JSON.stringify(this.generateGameConfig(gameState, options))}
            const game = new GameVibeEngine(gameConfig)
            game.start()
            
            // Hide loading screen when game is ready
            game.on('ready', () => {
                document.getElementById('loading-screen').style.display = 'none'
            })
            
            // Update loading progress
            game.on('progress', (progress) => {
                document.getElementById('loading-progress').style.width = progress + '%'
            })
        })
    </script>
</body>
</html>`;
  }
  
  /**
   * Bundle game code
   */
  private bundleGameCode(gameState: GameState, options: WebExportOptions): string {
    // In a real implementation, this would bundle the game code
    // For now, return a placeholder
    return `
// Game Vibe Engine - Bundled Game Code
// Generated on ${new Date().toISOString()}

class GameVibeEngine {
  constructor(config) {
    this.config = config;
    this.canvas = document.getElementById('game-canvas');
    this.context = this.canvas.getContext('2d');
    this.events = {};
    this.assets = {};
    this.entities = [];
    this.running = false;
    
    // Set canvas size
    this.canvas.width = config.width || 800;
    this.canvas.height = config.height || 600;
    
    console.log('Game Vibe Engine initialized with config:', config);
  }
  
  start() {
    if (this.running) return;
    
    this.running = true;
    this.loadAssets()
      .then(() => {
        this.emit('ready');
        this.gameLoop();
      })
      .catch(error => {
        console.error('Failed to load assets:', error);
      });
  }
  
  loadAssets() {
    return new Promise((resolve) => {
      // Simulate asset loading
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        this.emit('progress', progress);
        
        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }
  
  gameLoop() {
    if (!this.running) return;
    
    // Clear canvas
    this.context.fillStyle = this.config.backgroundColor || '#000';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw something
    this.context.fillStyle = '#fff';
    this.context.font = '24px Arial';
    this.context.textAlign = 'center';
    this.context.fillText(this.config.title || 'Game Vibe Engine Game', this.canvas.width / 2, this.canvas.height / 2);
    
    // Continue loop
    requestAnimationFrame(() => this.gameLoop());
  }
  
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }
  
  emit(event, data) {
    const callbacks = this.events[event] || [];
    callbacks.forEach(callback => callback(data));
  }
}
`;
  }
  
  /**
   * Process assets for web export
   */
  private processAssets(assets: any[], options: WebExportOptions): Record<string, any> {
    // In a real implementation, this would process and optimize assets
    // For now, return a placeholder
    return {
      'assets/atlas.png': 'PLACEHOLDER_ATLAS_DATA',
      'assets/sounds.mp3': 'PLACEHOLDER_SOUND_DATA',
      'favicon.ico': 'PLACEHOLDER_FAVICON_DATA'
    };
  }
  
  /**
   * Generate PWA files
   */
  private generatePWAFiles(gameState: GameState, pwaOptions: PWAOptions): Record<string, string> {
    const title = gameState.global?.gameTitle || 'Game Vibe Engine Game';
    const description = gameState.global?.description || 'A game created with Game Vibe Engine';
    
    // Generate manifest.json
    const manifest = JSON.stringify({
      name: title,
      short_name: title.substring(0, 12),
      description: description,
      start_url: '/',
      display: 'standalone',
      orientation: 'landscape',
      theme_color: '#000000',
      background_color: '#000000',
      icons: [
        {
          src: 'icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ]
    }, null, 2);
    
    // Generate service worker
    const serviceWorker = `
// Game Vibe Engine Service Worker
// Generated on ${new Date().toISOString()}

const CACHE_NAME = '${pwaOptions.cacheName || 'game-vibe-cache'}-v${pwaOptions.version || '1.0.0'}';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/game.js',
  '/assets/atlas.png',
  '/assets/sounds.mp3',
  '/favicon.ico',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
          .then((response) => {
            // Cache new resources
            if (response.ok && event.request.method === 'GET') {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return response;
          });
      })
      .catch(() => {
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});
`;
    
    return {
      'manifest.json': manifest,
      'sw.js': serviceWorker,
      'icons/icon-192.png': 'PLACEHOLDER_ICON_192',
      'icons/icon-512.png': 'PLACEHOLDER_ICON_512'
    };
  }
  
  /**
   * Generate analytics script
   */
  private generateAnalyticsScript(analytics: any): string {
    // Simple Google Analytics script
    return `
    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${analytics.trackingId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${analytics.trackingId}');
    </script>
    `;
  }
  
  /**
   * Generate PWA registration script
   */
  private generatePWAScript(): string {
    return `
    <!-- PWA Service Worker Registration -->
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then(registration => {
              console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
              console.error('Service Worker registration failed:', error);
            });
        });
      }
    </script>
    `;
  }
  
  /**
   * Generate game configuration
   */
  private generateGameConfig(gameState: GameState, options: WebExportOptions): any {
    return {
      title: gameState.global?.gameTitle || 'Game Vibe Engine Game',
      width: gameState.global?.gameSize?.x || 800,
      height: gameState.global?.gameSize?.y || 600,
      backgroundColor: gameState.global?.backgroundColor || '#000000',
      pixelArt: gameState.global?.pixelArt || false,
      gravity: gameState.global?.gravity || [0, 800],
      debug: false
    };
  }
  
  /**
   * Calculate bundle size
   */
  private calculateBundleSize(files: Record<string, any>): number {
    let totalSize = 0;
    
    for (const [_, content] of Object.entries(files)) {
      if (typeof content === 'string') {
        totalSize += content.length;
      } else if (content instanceof ArrayBuffer) {
        totalSize += content.byteLength;
      } else {
        totalSize += JSON.stringify(content).length;
      }
    }
    
    return totalSize;
  }
  
  /**
   * Get optimization summary
   */
  private getOptimizationSummary(options: WebExportOptions): any {
    return {
      codeMinification: options.optimization !== 'none',
      assetOptimization: options.optimizeAssets,
      bundleSize: 'optimized',
      pwa: options.pwa?.enabled || false
    };
  }
}