/**
 * Tilemap System for Game Vibe Engine
 * Handles loading and rendering of Tiled tilemaps
 */

export interface TilemapData {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  orientation: 'orthogonal' | 'isometric' | 'staggered' | 'hexagonal';
  renderOrder: 'right-down' | 'right-up' | 'left-down' | 'left-up';
  layers: TilemapLayer[];
  tilesets: TilesetData[];
  objects?: TilemapObject[];
}

export interface TilemapLayer {
  id: number;
  name: string;
  type: 'tilelayer' | 'objectgroup' | 'imagelayer' | 'group';
  width: number;
  height: number;
  data?: number[];
  objects?: TilemapObject[];
  visible: boolean;
  opacity: number;
  offsetX: number;
  offsetY: number;
  properties?: TilemapProperty[];
}

export interface TilemapObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  properties?: TilemapProperty[];
  point?: boolean;
}

export interface TilemapProperty {
  name: string;
  type: 'string' | 'int' | 'float' | 'bool' | 'color' | 'file' | 'object';
  value: any;
}

export interface TilesetData {
  firstgid: number;
  name: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  tileCount: number;
  columns: number;
  margin: number;
  spacing: number;
  properties?: TilemapProperty[];
  tiles?: { [key: number]: TileProperties };
}

export interface TileProperties {
  id: number;
  type?: string;
  properties?: TilemapProperty[];
}

export class TilemapSystem {
  private loadedTilemaps: Map<string, TilemapData> = new Map();
  private tilesetImages: Map<string, HTMLImageElement> = new Map();

  /**
   * Load a tilemap from JSON data
   */
  async loadTilemap(name: string, jsonData: any): Promise<TilemapData> {
    try {
      const tilemap: TilemapData = {
        width: jsonData.width,
        height: jsonData.height,
        tileWidth: jsonData.tilewidth,
        tileHeight: jsonData.tileheight,
        orientation: jsonData.orientation || 'orthogonal',
        renderOrder: jsonData.renderorder || 'right-down',
        layers: this.parseLayers(jsonData.layers || []),
        tilesets: this.parseTilesets(jsonData.tilesets || []),
        objects: this.parseObjects(jsonData)
      };

      // Load tileset images
      for (const tileset of tilemap.tilesets) {
        await this.loadTilesetImage(tileset.name, tileset.image);
      }

      this.loadedTilemaps.set(name, tilemap);
      return tilemap;
    } catch (error) {
      console.error('Failed to load tilemap:', error);
      throw error;
    }
  }

  /**
   * Get a loaded tilemap by name
   */
  getTilemap(name: string): TilemapData | null {
    return this.loadedTilemaps.get(name) || null;
  }

  /**
   * Find objects in a tilemap by name or type
   */
  findObjects(tilemapName: string, predicate: (obj: TilemapObject) => boolean): TilemapObject[] {
    const tilemap = this.getTilemap(tilemapName);
    if (!tilemap) return [];

    const results: TilemapObject[] = [];

    // Check object layers
    for (const layer of tilemap.layers) {
      if (layer.type === 'objectgroup' && layer.objects) {
        for (const obj of layer.objects) {
          if (predicate(obj)) {
            results.push(obj);
          }
        }
      }
    }

    // Check standalone objects
    if (tilemap.objects) {
      for (const obj of tilemap.objects) {
        if (predicate(obj)) {
          results.push(obj);
        }
      }
    }

    return results;
  }

  /**
   * Find a single object in a tilemap
   */
  findObject(tilemapName: string, predicate: (obj: TilemapObject) => boolean): TilemapObject | null {
    const objects = this.findObjects(tilemapName, predicate);
    return objects.length > 0 ? objects[0] : null;
  }

  /**
   * Get tile ID at specific coordinates in a layer
   */
  getTileAt(tilemapName: string, layerName: string, x: number, y: number): number | null {
    const tilemap = this.getTilemap(tilemapName);
    if (!tilemap) return null;

    const layer = tilemap.layers.find(l => l.name === layerName && l.type === 'tilelayer');
    if (!layer || !layer.data) return null;

    if (x < 0 || x >= layer.width || y < 0 || y >= layer.height) return null;

    const index = y * layer.width + x;
    return layer.data[index] || null;
  }

  /**
   * Check if a tile has a specific property
   */
  tileHasProperty(tilemapName: string, tileId: number, propertyName: string): boolean {
    const tilemap = this.getTilemap(tilemapName);
    if (!tilemap) return false;

    for (const tileset of tilemap.tilesets) {
      const localId = tileId - tileset.firstgid;
      if (localId >= 0 && localId < tileset.tileCount) {
        if (tileset.tiles && tileset.tiles[localId]) {
          const tile = tileset.tiles[localId];
          if (tile.properties) {
            return tile.properties.some(prop => prop.name === propertyName);
          }
        }
        break;
      }
    }

    return false;
  }

  /**
   * Get collision tiles from a layer
   */
  getCollisionTiles(tilemapName: string, layerName: string): Array<{x: number, y: number, tileId: number}> {
    const tilemap = this.getTilemap(tilemapName);
    if (!tilemap) return [];

    const layer = tilemap.layers.find(l => l.name === layerName && l.type === 'tilelayer');
    if (!layer || !layer.data) return [];

    const collisionTiles: Array<{x: number, y: number, tileId: number}> = [];

    for (let y = 0; y < layer.height; y++) {
      for (let x = 0; x < layer.width; x++) {
        const index = y * layer.width + x;
        const tileId = layer.data[index];
        
        if (tileId > 0 && this.tileHasProperty(tilemapName, tileId, 'collides')) {
          collisionTiles.push({ x, y, tileId });
        }
      }
    }

    return collisionTiles;
  }

  private parseLayers(layersData: any[]): TilemapLayer[] {
    return layersData.map(layer => ({
      id: layer.id,
      name: layer.name,
      type: layer.type,
      width: layer.width || 0,
      height: layer.height || 0,
      data: layer.data,
      objects: layer.objects,
      visible: layer.visible !== false,
      opacity: layer.opacity || 1,
      offsetX: layer.offsetx || 0,
      offsetY: layer.offsety || 0,
      properties: layer.properties
    }));
  }

  private parseTilesets(tilesetsData: any[]): TilesetData[] {
    return tilesetsData.map(tileset => ({
      firstgid: tileset.firstgid,
      name: tileset.name,
      image: tileset.image,
      imageWidth: tileset.imagewidth,
      imageHeight: tileset.imageheight,
      tileWidth: tileset.tilewidth,
      tileHeight: tileset.tileheight,
      tileCount: tileset.tilecount,
      columns: tileset.columns,
      margin: tileset.margin || 0,
      spacing: tileset.spacing || 0,
      properties: tileset.properties,
      tiles: tileset.tiles
    }));
  }

  private parseObjects(jsonData: any): TilemapObject[] {
    const objects: TilemapObject[] = [];

    // Extract objects from object layers
    if (jsonData.layers) {
      for (const layer of jsonData.layers) {
        if (layer.type === 'objectgroup' && layer.objects) {
          objects.push(...layer.objects.map((obj: any) => ({
            id: obj.id,
            name: obj.name || '',
            type: obj.type || '',
            x: obj.x,
            y: obj.y,
            width: obj.width || 0,
            height: obj.height || 0,
            rotation: obj.rotation || 0,
            visible: obj.visible !== false,
            properties: obj.properties || [],
            point: obj.point
          })));
        }
      }
    }

    return objects;
  }

  private async loadTilesetImage(name: string, imagePath: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.tilesetImages.set(name, img);
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error(`Failed to load tileset image: ${imagePath}`));
      };
      img.src = imagePath;
    });
  }

  /**
   * Get tileset image for rendering
   */
  getTilesetImage(name: string): HTMLImageElement | null {
    return this.tilesetImages.get(name) || null;
  }

  /**
   * Convert tile coordinates to world coordinates
   */
  tileToWorldPosition(tilemapName: string, tileX: number, tileY: number): {x: number, y: number} | null {
    const tilemap = this.getTilemap(tilemapName);
    if (!tilemap) return null;

    return {
      x: tileX * tilemap.tileWidth,
      y: tileY * tilemap.tileHeight
    };
  }

  /**
   * Convert world coordinates to tile coordinates
   */
  worldToTilePosition(tilemapName: string, worldX: number, worldY: number): {x: number, y: number} | null {
    const tilemap = this.getTilemap(tilemapName);
    if (!tilemap) return null;

    return {
      x: Math.floor(worldX / tilemap.tileWidth),
      y: Math.floor(worldY / tilemap.tileHeight)
    };
  }
}