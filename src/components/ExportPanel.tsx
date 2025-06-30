import React, { useState } from 'react';
import { Package, Download, Server, Loader, Check, AlertCircle } from 'lucide-react';
import { ExportManager } from '../export/ExportManager';
import { ExportPlatform, OptimizationLevel, ExportOptions } from '../export/types';

interface ExportPanelProps {
  gameState: any;
  onExport: (options: ExportOptions) => Promise<any>;
  isExporting?: boolean;
  exportResult?: any;
  exportError?: string;
}

const ExportPanel: React.FC<ExportPanelProps> = ({
  gameState,
  onExport,
  isExporting = false,
  exportResult,
  exportError
}) => {
  const [platform, setPlatform] = useState<ExportPlatform>(ExportPlatform.Web);
  const [optimization, setOptimization] = useState<OptimizationLevel>(OptimizationLevel.Standard);
  const [optimizeAssets, setOptimizeAssets] = useState<boolean>(true);
  const [enablePWA, setEnablePWA] = useState<boolean>(true);
  const [enableAnalytics, setEnableAnalytics] = useState<boolean>(false);
  const [analyticsId, setAnalyticsId] = useState<string>('');
  const [deploy, setDeploy] = useState<boolean>(false);
  const [deployProvider, setDeployProvider] = useState<string>('netlify');
  
  // Initialize export manager
  const exportManager = new ExportManager();
  
  const handleExport = async () => {
    const options: ExportOptions = {
      platform,
      optimization,
      optimizeAssets,
      deploy,
      deployTarget: deploy ? {
        provider: deployProvider,
        config: {}
      } : undefined
    };
    
    // Add web-specific options
    if (platform === ExportPlatform.Web) {
      (options as any).pwa = {
        enabled: enablePWA,
        version: '1.0.0',
        cacheName: 'game-vibe-cache',
        offlineSupport: true
      };
      
      if (enableAnalytics && analyticsId) {
        (options as any).analytics = {
          enabled: true,
          trackingId: analyticsId,
          provider: 'google'
        };
      }
    }
    
    await onExport(options);
  };
  
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Package className="mr-2" size={20} />
        Export Game
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Export Platform
          </label>
          <select
            className="w-full p-2 border rounded-md"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as ExportPlatform)}
            disabled={isExporting}
          >
            <option value={ExportPlatform.Web}>Web (HTML5)</option>
            <option value={ExportPlatform.Mobile} disabled>Mobile (Coming Soon)</option>
            <option value={ExportPlatform.Desktop} disabled>Desktop (Coming Soon)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Optimization Level
          </label>
          <select
            className="w-full p-2 border rounded-md"
            value={optimization}
            onChange={(e) => setOptimization(e.target.value as OptimizationLevel)}
            disabled={isExporting}
          >
            <option value={OptimizationLevel.None}>None - No optimization</option>
            <option value={OptimizationLevel.Basic}>Basic - Simple optimizations</option>
            <option value={OptimizationLevel.Standard}>Standard - Recommended</option>
            <option value={OptimizationLevel.Aggressive}>Aggressive - Maximum compression</option>
          </select>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="optimize-assets"
            checked={optimizeAssets}
            onChange={(e) => setOptimizeAssets(e.target.checked)}
            disabled={isExporting}
            className="mr-2"
          />
          <label htmlFor="optimize-assets">Optimize assets (images, audio, etc.)</label>
        </div>
        
        {platform === ExportPlatform.Web && (
          <>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enable-pwa"
                checked={enablePWA}
                onChange={(e) => setEnablePWA(e.target.checked)}
                disabled={isExporting}
                className="mr-2"
              />
              <label htmlFor="enable-pwa">Enable Progressive Web App (PWA) features</label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enable-analytics"
                checked={enableAnalytics}
                onChange={(e) => setEnableAnalytics(e.target.checked)}
                disabled={isExporting}
                className="mr-2"
              />
              <label htmlFor="enable-analytics">Enable analytics</label>
            </div>
            
            {enableAnalytics && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Analytics ID
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-md"
                  placeholder="UA-XXXXXXXXX-X or G-XXXXXXXXXX"
                  value={analyticsId}
                  onChange={(e) => setAnalyticsId(e.target.value)}
                  disabled={isExporting}
                />
              </div>
            )}
          </>
        )}
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="deploy"
            checked={deploy}
            onChange={(e) => setDeploy(e.target.checked)}
            disabled={isExporting}
            className="mr-2"
          />
          <label htmlFor="deploy">Deploy to hosting provider</label>
        </div>
        
        {deploy && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deployment Provider
            </label>
            <select
              className="w-full p-2 border rounded-md"
              value={deployProvider}
              onChange={(e) => setDeployProvider(e.target.value)}
              disabled={isExporting}
            >
              <option value="netlify">Netlify</option>
              <option value="vercel" disabled>Vercel (Coming Soon)</option>
              <option value="github" disabled>GitHub Pages (Coming Soon)</option>
            </select>
          </div>
        )}
        
        <button
          className={`w-full py-2 px-4 rounded-md flex items-center justify-center ${
            isExporting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
          }`}
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader className="animate-spin mr-2" size={18} />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2" size={18} />
              Export Game
            </>
          )}
        </button>
        
        {exportResult && exportResult.success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-start">
              <Check className="text-green-500 mr-2 mt-0.5" size={18} />
              <div>
                <p className="text-green-800 font-medium">Export successful!</p>
                {exportResult.deploymentResult?.url && (
                  <div className="mt-1">
                    <p className="text-sm text-green-700">
                      Your game is now live at:
                    </p>
                    <a
                      href={exportResult.deploymentResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-500 underline break-all"
                    >
                      {exportResult.deploymentResult.url}
                    </a>
                  </div>
                )}
                {!exportResult.deploymentResult?.url && (
                  <p className="text-sm text-green-700 mt-1">
                    Game exported successfully. Size: {(exportResult.size / 1024).toFixed(2)} KB
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {exportError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start">
              <AlertCircle className="text-red-500 mr-2 mt-0.5" size={18} />
              <div>
                <p className="text-red-800 font-medium">Export failed</p>
                <p className="text-sm text-red-700 mt-1">{exportError}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportPanel;