"use client";

import { memo } from "react";
import CentralStar from "./CentralStar";
import InstancedSatellites from "./InstancedSatellites";
import SatelliteTrails from "./SatelliteTrails";
import SatelliteErrors from "./SatelliteErrors";
import type { OrbitalLayout } from "@/lib/cloud-island";

interface OrbitalSceneProps {
  layout: OrbitalLayout;
  onCategoryClick?: (categoryId: string) => void;
  activeCategoryId?: string | null;
}

export default memo(function OrbitalScene({
  layout,
  onCategoryClick,
  activeCategoryId,
}: OrbitalSceneProps) {
  return (
    <group>
      <CentralStar star={layout.star} />
      <InstancedSatellites
        rings={layout.rings}
        onSatelliteClick={onCategoryClick}
        activeCategoryId={activeCategoryId}
      />
      <SatelliteTrails rings={layout.rings} />
      <SatelliteErrors rings={layout.rings} />

      {/* Ambient light for base visibility */}
      <ambientLight intensity={0.15} color="#4466aa" />
    </group>
  );
});
