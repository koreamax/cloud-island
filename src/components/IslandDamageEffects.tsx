"use client";

import { memo, useMemo } from "react";
import type { SectorInfo } from "@/lib/cloud-island";

function seededValue(seed: number) {
  const x = Math.sin(seed * 91.37) * 15731.743;
  return x - Math.floor(x);
}

interface IslandDamageEffectsProps {
  sectors: SectorInfo[];
  radius: number;
}

export default memo(function IslandDamageEffects({ sectors, radius }: IslandDamageEffectsProps) {
  const damage = useMemo(() => {
    const totalCalls = sectors.reduce((sum, sector) => sum + sector.apiCallCount, 0);
    const totalErrors = sectors.reduce((sum, sector) => sum + sector.errorCount, 0);
    const ratio = totalCalls > 0 ? totalErrors / totalCalls : 0;
    return Math.min(1, ratio / 0.2);
  }, [sectors]);

  const brokenBlocks = useMemo(() => {
    const count = Math.max(0, Math.round(damage * 180));
    return Array.from({ length: count }, (_, index) => {
      const angle = seededValue(index + radius) * Math.PI * 2;
      const dist = radius * (0.04 + seededValue(index + 13) * 0.88);
      return {
        position: [
          Math.cos(angle) * dist,
          0.46 + seededValue(index + 29) * 0.72,
          Math.sin(angle) * dist,
        ] as [number, number, number],
        scale: [
          0.52 + seededValue(index + 71) * 1.18,
          0.22 + seededValue(index + 83) * 0.92,
          0.52 + seededValue(index + 97) * 1.18,
        ] as [number, number, number],
        collapsed: seededValue(index + 121) > 0.34,
      };
    });
  }, [damage, radius]);

  if (damage <= 0.01) return null;

  return (
    <group>
      {brokenBlocks.map((block, index) => (
        <mesh
          key={index}
          position={[
            block.position[0],
            block.collapsed ? block.position[1] - 0.22 - damage * 0.35 : block.position[1] + damage * 0.08,
            block.position[2],
          ]}
          scale={block.scale}
          rotation={[
            seededValue(index + 41) * 0.92,
            seededValue(index + 53) * 1.45,
            seededValue(index + 67) * 0.92,
          ]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={block.collapsed ? "#100708" : "#2a1416"} roughness={1} />
        </mesh>
      ))}
    </group>
  );
});
