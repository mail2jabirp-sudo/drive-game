/** OSM-derived data is ODbL 1.0, separately from the MIT application code. */
export interface MapPoint { x: number; z: number }
export interface OsmRoad {
  id: string;
  sourceWayId: string;
  name: string;
  highway: string;
  oneway: 'yes' | 'no' | '-1';
  maxspeed: number | null;
  layer: number;
  bridge: boolean;
  width: number;
  widthSource: 'tag' | 'lanes' | 'estimate';
  nodeIds: string[];
  points: MapPoint[];
  tags: Record<string, string>;
}
export interface OsmBuilding {
  id: string;
  name: string;
  kind: string;
  height: number;
  heightSource: 'tag' | 'estimate';
  points: MapPoint[];
  tags: Record<string, string>;
}
export interface OsmLandmark {
  id: string;
  name: string;
  kind: string;
  x: number;
  z: number;
  tags: Record<string, string>;
}
export interface OsmWater { id: string; kind: 'area' | 'stream'; name: string; points: MapPoint[] }
export interface OsmMap {
  version: 1;
  source: { file: string; sha256: string; copyright: string; license: string; upstreamCommit: string };
  projection: { latitude: number; longitude: number; earthRadius: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roads: OsmRoad[];
  buildings: OsmBuilding[];
  landmarks: OsmLandmark[];
  water: OsmWater[];
  intersections: Array<{ id: string; x: number; z: number; roadIds: string[] }>;
  stats: Record<string, number>;
}
