"use client";

import { memo } from "react";
import InstancedVoxels from "./InstancedVoxels";
import IslandBase from "./IslandBase";
import IslandCategoryEffects from "./IslandCategoryEffects";
import IslandDamageEffects from "./IslandDamageEffects";
import type { IslandLayout } from "@/lib/cloud-island";

interface IslandSceneProps {
  layout: IslandLayout;
  onCategoryClick?: (categoryId: string) => void;
}

export default memo(function IslandScene({
  layout,
  onCategoryClick,
}: IslandSceneProps) {
  return (
    <group>
      <IslandBase radius={layout.radius} />
      <InstancedVoxels voxels={layout.voxels} onVoxelClick={onCategoryClick} />
      <IslandDamageEffects sectors={layout.sectors} radius={layout.radius} />
      <IslandCategoryEffects layout={layout} />

      <ambientLight intensity={0.4} color="#b8c0ff" />
      <directionalLight
        position={[15, 25, 10]}
        intensity={1.2}
        color="#fff5e6"
        castShadow={false}
      />
      <directionalLight position={[-10, 15, -8]} intensity={0.3} color="#a0b4ff" />
      <hemisphereLight args={["#6366f1", "#1a1a2e", 0.4]} />
    </group>
  );
});
