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

/** A single island in the archipelago */
export interface ArchipelagoIsland {
  id: string;
  label: string;
  data: IslandData;
  layout: IslandLayout;
  position: [number, number, number];
}
