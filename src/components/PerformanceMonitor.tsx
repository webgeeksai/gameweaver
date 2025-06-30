import React, { useState, useEffect } from 'react';
import { BarChart, Activity } from 'lucide-react';
import { GameEngine } from '../core/GameEngine';

interface PerformanceMonitorProps {
  gameEngine: GameEngine | null;
  refreshRate?: number;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  gameEngine,
  refreshRate = 1000
}) => {
  const [fps, setFps] = useState(0);
  const [entityCount, setEntityCount] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [systemPerformance, setSystemPerformance] = useState<Record<string, number>>({});
  
  useEffect(() => {
    if (!gameEngine) return;
    
    const intervalId = setInterval(() => {
      // Update performance metrics
      setFps(gameEngine.getFPS());
      setEntityCount(gameEngine.getEntityManager().getEntityCount());
      
      // Get memory usage if available
      if (window.performance && (performance as any).memory) {
        setMemoryUsage((performance as any).memory.usedJSHeapSize);
      }
      
      // Get system performance
      const systemMetrics = gameEngine.getSystemManager().getSystemPerformance();
      const systemData: Record<string, number> = {};
      
      systemMetrics.forEach((metrics, name) => {
        systemData[name] = metrics.updateTime;
      });
      
      setSystemPerformance(systemData);
    }, refreshRate);
    
    return () => clearInterval(intervalId);
  }, [gameEngine, refreshRate]);
  
  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold text-lg flex items-center mb-3">
        <Activity className="mr-2" size={18} />
        Performance Monitor
      </h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="text-sm text-gray-500">FPS</div>
          <div className="text-2xl font-semibold">{fps}</div>
        </div>
        
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="text-sm text-gray-500">Entities</div>
          <div className="text-2xl font-semibold">{entityCount}</div>
        </div>
        
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="text-sm text-gray-500">Memory</div>
          <div className="text-2xl font-semibold">{formatMemory(memoryUsage)}</div>
        </div>
        
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="text-sm text-gray-500">Systems</div>
          <div className="text-2xl font-semibold">{Object.keys(systemPerformance).length}</div>
        </div>
      </div>
      
      <h4 className="font-medium mb-2 flex items-center">
        <BarChart className="mr-1" size={16} />
        System Performance
      </h4>
      
      <div className="space-y-2">
        {Object.entries(systemPerformance).map(([name, time]) => (
          <div key={name} className="text-sm">
            <div className="flex justify-between mb-1">
              <span>{name}</span>
              <span>{time.toFixed(2)} ms</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full" 
                style={{ width: `${Math.min(100, (time / 16.67) * 100)}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceMonitor;