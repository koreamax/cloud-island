/**
 * Core type definitions for Cloud Island (Celesta).
 * Replaces Git City's DeveloperRecord / CityBuilding types.
 */

/** Activity data for a single AWS service category */
export interface CategoryActivity {
  categoryId: string;
  apiCallCount: number;
  errorCount: number;
  resourceCount: number;
  /** Top services within this category, sorted by call count */
  topServices: { service: string; count: number }[];
  /** IAM principal breakdown */
  principals: { principal: string; count: number }[];
}

/** Aggregated island data for one AWS account */
export interface IslandData {
  accountId: string;
  dateRange: { start: string; end: string };
  categories: CategoryActivity[];
  totalApiCalls: number;
  totalErrors: number;
}

export interface SavedIslandSummary {
  accountId: string;
  label: string;
  roleArn: string;
  snapshotAt: string;
  data: IslandData;
}

export interface MultiplayerPlayerState {
  playerId: string;
  label: string;
  islandId?: string | null;
  active: boolean;
  balloonMode: boolean;
  position: [number, number, number];
  forward: [number, number, number];
  updatedAt: string;
}

/** Single voxel in the 3D cloud island */
export interface CloudVoxel {
  position: [number, number, number];
  categoryId: string;
  color: string;
  healthyRatio: number;
}

/** Complete layout output for rendering */
export interface IslandLayout {
  voxels: CloudVoxel[];
  sectors: SectorInfo[];
  radius: number;
}

/** Metadata for one sector of the island */
export interface SectorInfo {
  categoryId: string;
  label: string;
  color: string;
  labelPosition: [number, number, number];
  normalizedActivity: number;
  apiCallCount: number;
  errorCount: number;
  resourceCount: number;
}

/** A single satellite orbiting on a ring */
export interface OrbitalSatellite {
  angleOffset: number;
  size: number;
  categoryId: string;
  color: string;
  errorRatio: number;
  /** Per-satellite radial offset to prevent overlap */
  radialOffset: number;
}

/** One orbital ring (one category) */
export interface OrbitalRing {
  categoryId: string;
  label: string;
  color: string;
  orbitRadius: number;
  rank: number;
  orbitalSpeed: number;
  satellites: OrbitalSatellite[];
  normalizedActivity: number;
  apiCallCount: number;
  errorCount: number;
  resourceCount: number;
  labelPosition: [number, number, number];
  /** Tilt from XZ plane in radians (atom-style orbital inclination) */
  inclination: number;
  /** Rotation of orbital plane around Y axis in radians */
  ascendingNode: number;
}

/** Central star properties */
export interface CentralStar {
  radius: number;
  pulseIntensity: number;
  healthRatio: number;
}

/** Complete orbital layout output for rendering */
export interface OrbitalLayout {
  star: CentralStar;
  rings: OrbitalRing[];
  outerRadius: number;
  sectors: SectorInfo[];
}

/** A single island in the archipelago */
export interface ArchipelagoIsland {
  id: string;
  label: string;
  data: IslandData;
  layout: IslandLayout | OrbitalLayout;
  position: [number, number, number];
}
