import React, { useState, useEffect, useRef } from 'react';
import { FileText, Code, Play, Settings, Layers, MessageSquare, Upload, Package } from 'lucide-react';
import { GameEngine } from './engine/core/GameEngine';
import { ComponentType } from './engine/core/types';
import { Vector2 } from './engine/core/math/Vector2';
import GDLEditor from './components/GDLEditor';
import GamePreview from './components/GamePreview';
import ChatPanel from './components/ChatPanel';
import AIAssistant from './components/AIAssistant';
import EntityInspector from './components/EntityInspector';
import SceneManager from './components/SceneManager';
import AssetManager from './components/AssetManager';
import DeploymentPanel from './components/DeploymentPanel';
import ExportPanel from './components/ExportPanel';
import { deploymentService } from './services/DeploymentService';
import { ExportManager } from './export/ExportManager';
import { ExportOptions } from './export/types';

function App() {
  const [activeTab, setActiveTab] = useState('docs');
  const [activeSidePanel, setActiveSidePanel] = useState<string | null>('chat');
  const [gameEngine, setGameEngine] = useState<GameEngine | null>(null);
  const [compiledCode, setCompiledCode] = useState<string | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | undefined>();
  const [deploymentError, setDeploymentError] = useState<string | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any | null>(null);
  const [exportError, setExportError] = useState<string | undefined>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Sample scenes for the scene manager
  const [scenes, setScenes] = useState([
    { id: 'main', name: 'Main Scene', active: true, entityCount: 9 },
    { id: 'level1', name: 'Level 1', active: false, entityCount: 15 },
    { id: 'gameover', name: 'Game Over', active: false, entityCount: 3 }
  ]);
  
  // Sample assets for the asset manager
  const [assets, setAssets] = useState([
    { id: '1', name: 'player.png', type: 'image', url: '/assets/player.png', size: 24500 },
    { id: '2', name: 'enemy.png', type: 'image', url: '/assets/enemy.png', size: 18200 },
    { id: '3', name: 'jump.mp3', type: 'audio', url: '/assets/jump.mp3', size: 45600 },
    { id: '4', name: 'level_data.json', type: 'json', url: '/assets/level_data.json', size: 2340 }
  ]);
  
  // Initialize game engine
  useEffect(() => {
    if (canvasRef.current && !gameEngine) {
      const engine = new GameEngine({ canvas: canvasRef.current });
      setGameEngine(engine);
      
      // Create some test entities
      createTestEntities(engine);
      
      // Start the engine
      engine.start();
      
      // Cleanup on unmount
      return () => {
        engine.stop();
      };
    }
  }, [canvasRef.current]);
  
  // Create some test entities to visualize
  const createTestEntities = (engine: GameEngine) => {
    const entityManager = engine.getEntityManager();
    const componentManager = engine.getComponentManager();
    
    // Create a player entity
    const player = entityManager.create({
      name: 'Player',
      tags: ['player']
    }, 'main');
    
    // Add components
    componentManager.add(player, ComponentType.Transform, {
      position: { x: 400, y: 300 },
      scale: { x: 1, y: 1 }
    });
    
    componentManager.add(player, ComponentType.Sprite, {
      texture: '#ff0000',
      bounds: { x: 0, y: 0, width: 32, height: 32 }
    });
    
    // Create some enemy entities
    for (let i = 0; i < 5; i++) {
      const enemy = entityManager.create({
        name: `Enemy${i}`,
        tags: ['enemy']
      }, 'main');
      
      // Add components
      componentManager.add(enemy, ComponentType.Transform, {
        position: { 
          x: 200 + Math.random() * 400, 
          y: 150 + Math.random() * 300 
        },
        scale: { x: 0.8, y: 0.8 }
      });
      
      componentManager.add(enemy, ComponentType.Sprite, {
        texture: '#0000ff',
        bounds: { x: 0, y: 0, width: 32, height: 32 }
      });
    }
    
    // Create some platform entities
    for (let i = 0; i < 3; i++) {
      const platform = entityManager.create({
        name: `Platform${i}`,
        tags: ['platform']
      }, 'main');
      
      // Add components
      componentManager.add(platform, ComponentType.Transform, {
        position: { 
          x: 200 + i * 200, 
          y: 450 
        },
        scale: { x: 3, y: 0.5 }
      });
      
      componentManager.add(platform, ComponentType.Sprite, {
        texture: '#00ff00',
        bounds: { x: 0, y: 0, width: 32, height: 32 }
      });
    }
  };

  // Handle GDL compilation
  const handleCompile = (result: any) => {
    if (result.success) {
      setCompiledCode(result.code);
    }
  };
  
  // Handle chat message
  const handleSendMessage = (message: string) => {
    setIsProcessingAI(true);
    
    // Simulate AI processing
    setTimeout(() => {
      setIsProcessingAI(false);
    }, 2000);
  };
  
  // Handle code generation from AI
  const handleCodeGenerated = (code: string) => {
    setCompiledCode(code);
  };
  
  // Handle entity creation from AI
  const handleEntityCreated = (entity: any) => {
    console.log('Entity created:', entity);
    // In a real implementation, this would add the entity to the game
  };
  
  // Handle scene selection
  const handleSelectScene = (sceneId: string) => {
    console.log(`Selected scene: ${sceneId}`);
    // In a real implementation, this would switch the active scene
  };
  
  // Handle scene creation
  const handleCreateScene = () => {
    const newScene = {
      id: `scene_${Date.now()}`,
      name: `New Scene ${scenes.length + 1}`,
      active: false,
      entityCount: 0
    };
    
    setScenes([...scenes, newScene]);
  };
  
  // Handle scene deletion
  const handleDeleteScene = (sceneId: string) => {
    setScenes(scenes.filter(scene => scene.id !== sceneId));
  };
  
  // Handle scene visibility toggle
  const handleToggleSceneVisibility = (sceneId: string) => {
    setScenes(scenes.map(scene => 
      scene.id === sceneId ? { ...scene, active: !scene.active } : scene
    ));
  };
  
  // Handle asset upload
  const handleUploadAsset = (file: File) => {
    // In a real implementation, this would upload the file to a server
    const newAsset = {
      id: `asset_${Date.now()}`,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 
            file.type.startsWith('audio/') ? 'audio' :
            file.type === 'application/json' ? 'json' : 'other',
      url: URL.createObjectURL(file),
      size: file.size
    };
    
    setAssets([...assets, newAsset]);
  };
  
  // Handle asset deletion
  const handleDeleteAsset = (assetId: string) => {
    setAssets(assets.filter(asset => asset.id !== assetId));
  };
  
  // Handle asset selection
  const handleSelectAsset = (asset: any) => {
    console.log(`Selected asset: ${asset.name}`);
    // In a real implementation, this would show asset details or add it to the scene
  };
  
  // Handle deployment
  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentUrl(undefined);
    setDeploymentError(undefined);
    
    try {
      const result = await deploymentService.deployGame(
        compiledCode || '',
        assets,
        {
          provider: 'netlify',
          optimizeAssets: true,
          minifyCode: true
        }
      );
      
      if (result.success) {
        setDeploymentUrl(result.url);
      } else {
        setDeploymentError(result.error);
      }
    } catch (error) {
      setDeploymentError(`Deployment failed: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };
  
  // Handle export
  const handleExport = async (options: ExportOptions) => {
    setIsExporting(true);
    setExportResult(null);
    setExportError(undefined);
    
    try {
      // Create a mock game state for export
      const gameState = {
        global: {
          gameTitle: 'My Awesome Game',
          gameSize: { x: 800, y: 600 },
          backgroundColor: '#87CEEB',
          pixelArt: true
        },
        entities: new Map(),
        components: new Map(),
        scenes: new Map(),
        assets: assets
      };
      
      // Initialize export manager
      const exportManager = new ExportManager();
      
      // Export the game
      const result = await exportManager.exportGame(gameState, options);
      
      if (result.success) {
        setExportResult(result);
      } else {
        setExportError(result.error);
      }
    } catch (error) {
      setExportError(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  // Toggle side panel
  const toggleSidePanel = (panelName: string) => {
    if (activeSidePanel === panelName) {
      setActiveSidePanel(null);
    } else {
      setActiveSidePanel(panelName);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-indigo-700 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Game Vibe Engine</h1>
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-500 transition">
              New Project
            </button>
            <button className="p-2 rounded hover:bg-indigo-600 transition">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-16 bg-gray-800 text-white flex flex-col items-center py-4">
          <button 
            className={`p-3 rounded-lg mb-4 ${activeTab === 'docs' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            onClick={() => setActiveTab('docs')}
            title="Documentation"
          >
            <FileText size={24} />
          </button>
          <button 
            className={`p-3 rounded-lg mb-4 ${activeTab === 'code' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            onClick={() => setActiveTab('code')}
            title="Code Editor"
          >
            <Code size={24} />
          </button>
          <button 
            className={`p-3 rounded-lg mb-4 ${activeTab === 'preview' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            onClick={() => setActiveTab('preview')}
            title="Game Preview"
          >
            <Play size={24} />
          </button>
          <button 
            className={`p-3 rounded-lg mb-4 ${activeTab === 'export' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            onClick={() => setActiveTab('export')}
            title="Export Game"
          >
            <Package size={24} />
          </button>
          
          <div className="flex-1"></div>
          
          <button 
            className={`p-3 rounded-lg mb-4 ${activeSidePanel === 'chat' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            onClick={() => toggleSidePanel('chat')}
            title="AI Assistant"
          >
            <MessageSquare size={24} />
          </button>
          <button 
            className={`p-3 rounded-lg mb-4 ${activeSidePanel === 'scenes' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            onClick={() => toggleSidePanel('scenes')}
            title="Scene Manager"
          >
            <Layers size={24} />
          </button>
          <button 
            className={`p-3 rounded-lg mb-4 ${activeSidePanel === 'assets' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            onClick={() => toggleSidePanel('assets')}
            title="Asset Manager"
          >
            <Upload size={24} />
          </button>
          <button 
            className={`p-3 rounded-lg mb-4 ${activeSidePanel === 'inspector' ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}
            onClick={() => toggleSidePanel('inspector')}
            title="Entity Inspector"
          >
            <Settings size={24} />
          </button>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 flex">
          {/* Main Content */}
          <div className={`${activeSidePanel ? 'w-2/3' : 'w-full'} transition-all duration-300`}>
            <div className="h-full">
              {activeTab === 'docs' && (
                <div className="bg-white rounded-lg shadow-md p-6 h-full overflow-y-auto">
                  <h2 className="text-2xl font-bold mb-4">Game Vibe Engine Documentation</h2>
                  <p className="mb-4">
                    Welcome to the Game Vibe Engine, a revolutionary web-based game development environment 
                    that allows you to create games through natural language conversations.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="border rounded-lg p-4 hover:shadow-md transition">
                      <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
                      <p>Learn the basics of creating games with natural language.</p>
                    </div>
                    <div className="border rounded-lg p-4 hover:shadow-md transition">
                      <h3 className="text-lg font-semibold mb-2">GDL Reference</h3>
                      <p>Explore the Game Description Language syntax and features.</p>
                    </div>
                    <div className="border rounded-lg p-4 hover:shadow-md transition">
                      <h3 className="text-lg font-semibold mb-2">Tutorials</h3>
                      <p>Step-by-step guides for creating different game types.</p>
                    </div>
                    <div className="border rounded-lg p-4 hover:shadow-md transition">
                      <h3 className="text-lg font-semibold mb-2">API Reference</h3>
                      <p>Detailed documentation of the engine's programming interfaces.</p>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold mt-8 mb-4">Quick Start Guide</h3>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      <strong>Describe your game</strong> - Use the AI Assistant to describe the game you want to create.
                    </li>
                    <li>
                      <strong>Refine with natural language</strong> - Iterate on your game by having a conversation with the AI.
                    </li>
                    <li>
                      <strong>Preview your game</strong> - See your game in action in the Game Preview tab.
                    </li>
                    <li>
                      <strong>Edit GDL code</strong> - Fine-tune your game by editing the Game Description Language code.
                    </li>
                    <li>
                      <strong>Export your game</strong> - Share your creation with the world by exporting it to the web.
                    </li>
                  </ol>
                </div>
              )}

              {activeTab === 'code' && (
                <div className="bg-white rounded-lg shadow-md p-6 h-full">
                  <GDLEditor onCompile={handleCompile} />
                </div>
              )}

              {activeTab === 'preview' && (
                <div className="bg-white rounded-lg shadow-md p-6 h-full">
                  <h2 className="text-2xl font-bold mb-4">Game Preview</h2>
                  <GamePreview compiledCode={compiledCode} />
                </div>
              )}
              
              {activeTab === 'export' && (
                <div className="bg-white rounded-lg shadow-md p-6 h-full overflow-y-auto">
                  <h2 className="text-2xl font-bold mb-4">Export Your Game</h2>
                  <p className="mb-6">
                    Export your game to make it accessible on the web. Choose export options and configure your build settings.
                  </p>
                  
                  <ExportPanel
                    gameState={gameEngine?.getState()}
                    onExport={handleExport}
                    isExporting={isExporting}
                    exportResult={exportResult}
                    exportError={exportError}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Side Panel */}
          {activeSidePanel && (
            <div className="w-1/3 pl-6 transition-all duration-300">
              <div className="h-full">
                {activeSidePanel === 'chat' && (
                  <AIAssistant 
                    onCodeGenerated={handleCodeGenerated}
                    onEntityCreated={handleEntityCreated}
                  />
                )}
                
                {activeSidePanel === 'scenes' && (
                  <SceneManager
                    scenes={scenes}
                    activeScene="main"
                    onSelectScene={handleSelectScene}
                    onCreateScene={handleCreateScene}
                    onDeleteScene={handleDeleteScene}
                    onToggleSceneVisibility={handleToggleSceneVisibility}
                  />
                )}
                
                {activeSidePanel === 'assets' && (
                  <AssetManager
                    assets={assets}
                    onUploadAsset={handleUploadAsset}
                    onDeleteAsset={handleDeleteAsset}
                    onSelectAsset={handleSelectAsset}
                  />
                )}
                
                {activeSidePanel === 'inspector' && (
                  <EntityInspector
                    entity={gameEngine?.getEntityManager().get('player')}
                    componentManager={gameEngine?.getComponentManager()}
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;