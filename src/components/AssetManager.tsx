import React, { useState } from 'react';
import { FolderOpen, Image, Music, File, Upload, Trash2, Plus } from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  type: 'image' | 'audio' | 'json' | 'other';
  url: string;
  size: number;
  thumbnail?: string;
}

interface AssetManagerProps {
  assets: Asset[];
  onUploadAsset: (file: File) => void;
  onDeleteAsset: (assetId: string) => void;
  onSelectAsset: (asset: Asset) => void;
}

const AssetManager: React.FC<AssetManagerProps> = ({
  assets,
  onUploadAsset,
  onDeleteAsset,
  onSelectAsset
}) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUploadAsset(files[0]);
      // Reset the input
      e.target.value = '';
    }
  };
  
  const filteredAssets = assets.filter(asset => {
    // Apply type filter
    if (filter !== 'all' && asset.type !== filter) {
      return false;
    }
    
    // Apply search filter
    if (searchTerm && !asset.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image size={16} />;
      case 'audio':
        return <Music size={16} />;
      default:
        return <File size={16} />;
    }
  };
  
  return (
    <div className="border rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg flex items-center">
          <FolderOpen className="mr-2" size={18} />
          Assets
        </h3>
        
        <button 
          className="p-1 text-gray-500 hover:text-indigo-600 rounded flex items-center"
          title="Upload Asset"
          onClick={handleUploadClick}
        >
          <Upload size={18} />
          <span className="ml-1 text-sm">Upload</span>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,audio/*,application/json"
          />
        </button>
      </div>
      
      <div className="mb-4 flex space-x-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search assets..."
            className="w-full p-2 border rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="p-2 border rounded-md"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="image">Images</option>
          <option value="audio">Audio</option>
          <option value="json">JSON</option>
          <option value="other">Other</option>
        </select>
      </div>
      
      {filteredAssets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <Plus size={24} className="mb-2" />
          <p className="mb-1">No assets found</p>
          <p className="text-sm">Upload assets to get started</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredAssets.map(asset => (
            <div 
              key={asset.id}
              className="border rounded-lg overflow-hidden hover:border-indigo-500 cursor-pointer transition"
              onClick={() => onSelectAsset(asset)}
            >
              <div className="h-24 bg-gray-100 flex items-center justify-center">
                {asset.type === 'image' && asset.thumbnail ? (
                  <img 
                    src={asset.thumbnail} 
                    alt={asset.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-gray-400">
                    {getAssetIcon(asset.type)}
                  </div>
                )}
              </div>
              
              <div className="p-2">
                <div className="flex justify-between items-start">
                  <div className="truncate text-sm font-medium" title={asset.name}>
                    {asset.name}
                  </div>
                  <button 
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                    title="Delete Asset"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAsset(asset.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-xs text-gray-500 flex items-center mt-1">
                  {getAssetIcon(asset.type)}
                  <span className="ml-1">{formatFileSize(asset.size)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssetManager;