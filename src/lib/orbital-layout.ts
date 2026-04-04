/**
 * Orbital layout algorithm - generates orbital system layout from IslandData.
 * Replaces island-layout.ts for the space concept.
 */

import type {
  IslandData,
  OrbitalLayout,
  OrbitalRing,
  OrbitalSatellite,
  CentralStar,
  SectorInfo,
} from "./cloud-island";
import { AWS_CATEGORIES } from "./aws-categories";
import { tiltedOrbitPosition } from "./orbital-math";

const BASE_INNER_RADIUS = 8;
const RING_SPACING = 6;
/** Maximum orbital speed (when satellite count = 1) */
const MAX_SPEED = 0.8;
/** Minimum orbital speed (when satellite count = MAX) */
const MIN_SPEED = 0.15;
/** Extra radius per satellite beyond the first */
const RADIUS_PER_SAT = 0.6;
const MIN_SAT_SIZE = 0.3;
const MAX_SAT_SIZE = 2.0;
const MAX_SATELLITES_PER_RING = 30;
const STAR_MIN_RADIUS = 4.0;
const STAR_MAX_RADIUS = 6.5;
const REFERENCE_MAX_CALLS = 100000;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

export function generateOrbitalLayout(data: IslandData): OrbitalLayout {
  const activityMap = new Map(
    data.categories.map((cat) => [cat.categoryId, cat])
  );
  const maxCalls = Math.max(
    1,
    ...data.categories.map((cat) => cat.apiCallCount)
  );

  // Sort categories by apiCallCount ascending → most active = outermost (more space for satellites)
  const sorted = [...AWS_CATEGORIES]
    .map((cat) => ({
      cat,
      activity: activityMap.get(cat.id),
    }))
    .sort(
      (a, b) =>
        (a.activity?.apiCallCount ?? 0) - (b.activity?.apiCallCount ?? 0)
    );

  const rings: OrbitalRing[] = [];
  const sectors: SectorInfo[] = [];

  for (let rank = 0; rank < sorted.length; rank++) {
    const { cat, activity } = sorted[rank];
    const apiCalls = activity?.apiCallCount ?? 0;
    const errors = activity?.errorCount ?? 0;
    const resourceCount = activity?.resourceCount ?? 0;
    const normalizedActivity = apiCalls / maxCalls;

    // Orbit radius grows with rank + satellite count
    const satCount = Math.max(1, Math.min(MAX_SATELLITES_PER_RING, resourceCount));
    const orbitRadius = BASE_INNER_RADIUS + rank * RING_SPACING + (satCount - 1) * RADIUS_PER_SAT;

    // Speed: fewer satellites → faster, more satellites → slower
    // Formula: lerp(MAX_SPEED, MIN_SPEED, satCount / MAX_SATELLITES_PER_RING)
    const satRatio = (satCount - 1) / (MAX_SATELLITES_PER_RING - 1);
    const orbitalSpeed = MAX_SPEED - satRatio * (MAX_SPEED - MIN_SPEED);

    // Atom-style orbital inclinations — each ring tilted differently
    const INCLINATIONS = [
      0.0,                     // ring 0: equatorial
      Math.PI * 0.25,          // ring 1: 45°
      -Math.PI * 0.35,         // ring 2: -63°
      Math.PI * 0.45,          // ring 3: 81°
      -Math.PI * 0.15,         // ring 4: -27°
      Math.PI * 0.5,           // ring 5: 90° (polar)
      -Math.PI * 0.4,          // ring 6: -72°
    ];
    const ASCENDING_NODES = [
      0,
      Math.PI * 0.3,
      Math.PI * 0.7,
      Math.PI * 1.1,
      Math.PI * 1.5,
      Math.PI * 0.5,
      Math.PI * 1.3,
    ];
    const inclination = INCLINATIONS[rank] ?? 0;
    const ascendingNode = ASCENDING_NODES[rank] ?? 0;

    // Generate satellites
    const errorRatio = apiCalls > 0 ? errors / apiCalls : 0;
    const rand = seededRandom(rank * 7919 + 42);

    // Scale down size when many satellites to prevent overlap
    const crowdFactor = 1 - (satCount - 1) / (MAX_SATELLITES_PER_RING - 1) * 0.6;
    const baseSize = (MIN_SAT_SIZE + normalizedActivity * (MAX_SAT_SIZE - MIN_SAT_SIZE)) * crowdFactor;

    // Radial spread increases with satellite count
    const radialSpread = Math.min(3.0, satCount * 0.15);

    const satellites: OrbitalSatellite[] = [];
    for (let i = 0; i < satCount; i++) {
      const baseAngle = (i / satCount) * Math.PI * 2;
      const jitter = (rand() - 0.5) * 0.3;
      // Distribute satellites at varying radial offsets (-spread ~ +spread)
      const radialOffset = (rand() - 0.5) * 2 * radialSpread;
      satellites.push({
        angleOffset: baseAngle + jitter,
        size: baseSize,
        categoryId: cat.id,
        color: cat.color,
        errorRatio,
        radialOffset,
      });
    }

    // Label position: placed on the tilted ring
    const labelAngle = (rank / sorted.length) * Math.PI * 2;
    const [lx, ly, lz] = tiltedOrbitPosition(labelAngle, orbitRadius, inclination, ascendingNode);
    const labelPosition: [number, number, number] = [lx, ly + 3, lz];

    rings.push({
      categoryId: cat.id,
      label: cat.label,
      color: cat.color,
      orbitRadius,
      rank,
      orbitalSpeed,
      satellites,
      normalizedActivity,
      apiCallCount: apiCalls,
      errorCount: errors,
      resourceCount,
      labelPosition,
      inclination,
      ascendingNode,
    });

    sectors.push({
      categoryId: cat.id,
      label: cat.label,
      color: cat.color,
      labelPosition,
      normalizedActivity,
      apiCallCount: apiCalls,
      errorCount: errors,
      resourceCount,
    });
  }

  // Central star
  const totalNormalized = Math.min(1, data.totalApiCalls / REFERENCE_MAX_CALLS);
  const healthRatio =
    data.totalApiCalls > 0
      ? 1 - data.totalErrors / data.totalApiCalls
      : 1;

  const star: CentralStar = {
    radius:
      STAR_MIN_RADIUS + totalNormalized * (STAR_MAX_RADIUS - STAR_MIN_RADIUS),
    pulseIntensity: totalNormalized,
    healthRatio,
  };

  const outerRadius =
    BASE_INNER_RADIUS + (sorted.length - 1) * RING_SPACING + RING_SPACING;

  return { star, rings, outerRadius, sectors };
}
