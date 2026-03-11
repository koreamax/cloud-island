/**
 * Island layout algorithm - generates 3D voxel positions for the cloud island.
 */

import type { IslandData, IslandLayout, CloudVoxel, SectorInfo } from "./cloud-island";
import { AWS_CATEGORIES } from "./aws-categories";

const BASE_RADIUS = 5;
const MAX_EXTENSION = 10;
const MIN_LAYERS = 2;
const MAX_EXTRA_LAYERS = 6;
const VOXEL_SIZE = 1.1;
const SECTOR_COUNT = 7;
const SECTOR_ANGLE = (2 * Math.PI) / SECTOR_COUNT;
const NOISE_SCALE = 0.3;

function hash2d(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);

  const n00 = hash2d(ix, iz);
  const n10 = hash2d(ix + 1, iz);
  const n01 = hash2d(ix, iz + 1);
  const n11 = hash2d(ix + 1, iz + 1);

  const nx0 = n00 + sx * (n10 - n00);
  const nx1 = n01 + sx * (n11 - n01);
  return nx0 + sz * (nx1 - nx0);
}

export function generateIslandLayout(data: IslandData): IslandLayout {
  const voxels: CloudVoxel[] = [];
  const sectors: SectorInfo[] = [];
  const maxCalls = Math.max(1, ...data.categories.map((category) => category.apiCallCount));
  const activityMap = new Map(data.categories.map((category) => [category.categoryId, category]));

  for (let sectorIndex = 0; sectorIndex < SECTOR_COUNT; sectorIndex++) {
    const category = AWS_CATEGORIES[sectorIndex];
    const activity = activityMap.get(category.id);
    const apiCalls = activity?.apiCallCount ?? 0;
    const errors = activity?.errorCount ?? 0;
    const resourceCount = activity?.resourceCount ?? 0;
    const normalizedActivity = apiCalls / maxCalls;

    const sectorRadius = BASE_RADIUS + normalizedActivity * MAX_EXTENSION;
    const layerCount = MIN_LAYERS + Math.floor(normalizedActivity * MAX_EXTRA_LAYERS);
    const healthyRatio = apiCalls > 0 ? 1 - errors / apiCalls : 1;

    const angleStart = sectorIndex * SECTOR_ANGLE;
    const angleEnd = (sectorIndex + 1) * SECTOR_ANGLE;
    const angleMid = (angleStart + angleEnd) / 2;

    const labelRadius = sectorRadius * 0.6;
    const labelX = Math.cos(angleMid) * labelRadius;
    const labelZ = Math.sin(angleMid) * labelRadius;
    const labelY = (layerCount + 1) * VOXEL_SIZE;

    sectors.push({
      categoryId: category.id,
      label: category.label,
      color: category.color,
      labelPosition: [labelX, labelY, labelZ],
      normalizedActivity,
      apiCallCount: apiCalls,
      errorCount: errors,
      resourceCount,
    });

    const gridExtent = Math.ceil(sectorRadius / VOXEL_SIZE) + 1;

    for (let gx = -gridExtent; gx <= gridExtent; gx++) {
      for (let gz = -gridExtent; gz <= gridExtent; gz++) {
        const wx = gx * VOXEL_SIZE;
        const wz = gz * VOXEL_SIZE;
        const dist = Math.sqrt(wx * wx + wz * wz);

        if (dist < 1) continue;

        let angle = Math.atan2(wz, wx);
        if (angle < 0) angle += 2 * Math.PI;

        const start = ((angleStart % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const end = ((angleEnd % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

        const inSector = start < end ? angle >= start && angle < end : angle >= start || angle < end;
        if (!inSector) continue;

        const noise = smoothNoise(gx * 0.4, gz * 0.4) * NOISE_SCALE;
        const effectiveRadius = sectorRadius * (1 + noise);
        if (dist > effectiveRadius) continue;

        const edgeFactor = 1 - dist / effectiveRadius;
        const localLayers = Math.max(1, Math.round(layerCount * edgeFactor));

        for (let layer = 0; layer < localLayers; layer++) {
          voxels.push({
            position: [wx, layer * VOXEL_SIZE, wz],
            categoryId: category.id,
            color: category.color,
            healthyRatio,
          });
        }
      }
    }
  }

  const radius = sectors.reduce(
    (current, sector) => Math.max(current, BASE_RADIUS + sector.normalizedActivity * MAX_EXTENSION),
    0
  );

  return { voxels, sectors, radius };
}
