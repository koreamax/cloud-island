"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitalRing } from "@/lib/cloud-island";
import { tiltedOrbitPosition } from "@/lib/orbital-math";

const ERROR_THRESHOLD = 0.02;
const DEBRIS_PER_SATELLITE = 6;
const DEBRIS_ORBIT_RADIUS = 1.2;

interface SatelliteErrorsProps {
  rings: OrbitalRing[];
}

interface ErrorSatellite {
  orbitRadius: number;
  angleOffset: number;
  orbitalSpeed: number;
  size: number;
  errorIntensity: number;
  inclination: number;
  ascendingNode: number;
  radialOffset: number;
}

export default function SatelliteErrors({ rings }: SatelliteErrorsProps) {
  const auraRef = useRef<THREE.InstancedMesh>(null);
  const debrisRef = useRef<THREE.Points>(null);

  // Collect satellites with errors
  const errorSats = useMemo<ErrorSatellite[]>(() => {
    const result: ErrorSatellite[] = [];
    for (const ring of rings) {
      const errorRatio = ring.apiCallCount > 0 ? ring.errorCount / ring.apiCallCount : 0;
      if (errorRatio <= ERROR_THRESHOLD) continue;
      const intensity = Math.min(1, errorRatio / 0.15);

      for (const sat of ring.satellites) {
        result.push({
          orbitRadius: ring.orbitRadius,
          angleOffset: sat.angleOffset,
          orbitalSpeed: ring.orbitalSpeed,
          size: sat.size,
          errorIntensity: intensity,
          inclination: ring.inclination,
          ascendingNode: ring.ascendingNode,
          radialOffset: sat.radialOffset,
        });
      }
    }
    return result;
  }, [rings]);

  const auraCount = errorSats.length;
  const debrisCount = auraCount * DEBRIS_PER_SATELLITE;

  const auraGeo = useMemo(() => new THREE.SphereGeometry(0.5, 12, 12), []);
  const debrisPositions = useMemo(
    () => new Float32Array(debrisCount * 3),
    [debrisCount]
  );

  const _mat4 = useMemo(() => new THREE.Matrix4(), []);
  const _pos = useMemo(() => new THREE.Vector3(), []);
  const _quat = useMemo(() => new THREE.Quaternion(), []);
  const _scale = useMemo(() => new THREE.Vector3(), []);

  // Animate aura + debris
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Update aura positions
    const auraMesh = auraRef.current;
    if (auraMesh && auraCount > 0) {
      for (let i = 0; i < auraCount; i++) {
        const sat = errorSats[i];
        const angle = sat.angleOffset + t * sat.orbitalSpeed;
        const r = sat.orbitRadius + sat.radialOffset;
        const [x, y, z] = tiltedOrbitPosition(
          angle, r, sat.inclination, sat.ascendingNode
        );

        _pos.set(x, y, z);
        const pulse = sat.size * 1.8 + Math.sin(t * 4 + i) * 0.2 * sat.errorIntensity;
        _scale.setScalar(pulse);
        _mat4.compose(_pos, _quat, _scale);
        auraMesh.setMatrixAt(i, _mat4);
      }
      auraMesh.instanceMatrix.needsUpdate = true;
    }

    // Update debris positions
    const points = debrisRef.current;
    if (points && debrisCount > 0) {
      const posAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      let idx = 0;
      for (let i = 0; i < auraCount; i++) {
        const sat = errorSats[i];
        const parentAngle = sat.angleOffset + t * sat.orbitalSpeed;
        const dr = sat.orbitRadius + sat.radialOffset;
        const [px, py, pz] = tiltedOrbitPosition(
          parentAngle, dr, sat.inclination, sat.ascendingNode
        );

        for (let d = 0; d < DEBRIS_PER_SATELLITE; d++) {
          const debrisAngle = (d / DEBRIS_PER_SATELLITE) * Math.PI * 2 + t * 3;
          const r = DEBRIS_ORBIT_RADIUS * sat.size;
          arr[idx * 3] = px + Math.cos(debrisAngle) * r;
          arr[idx * 3 + 1] = py + Math.sin(debrisAngle * 0.7 + d) * r * 0.5;
          arr[idx * 3 + 2] = pz + Math.sin(debrisAngle) * r;
          idx++;
        }
      }

      posAttr.needsUpdate = true;
    }
  });

  if (auraCount === 0) return null;

  return (
    <group>
      {/* Error aura — pulsing red transparent spheres */}
      <instancedMesh
        ref={auraRef}
        args={[auraGeo, undefined, auraCount]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          color="#ff3333"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Debris field — small particles orbiting error satellites */}
      <points ref={debrisRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[debrisPositions, 3]}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          color="#ff6644"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
