"use client";

import { useRef, useMemo, useEffect, useCallback, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitalRing } from "@/lib/cloud-island";
import { tiltedOrbitPosition } from "@/lib/orbital-math";

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _tmpColor = new THREE.Color();

interface SatelliteInfo {
  orbitRadius: number;
  angleOffset: number;
  orbitalSpeed: number;
  size: number;
  categoryId: string;
  color: string;
  inclination: number;
  ascendingNode: number;
  radialOffset: number;
}

interface InstancedSatellitesProps {
  rings: OrbitalRing[];
  onSatelliteClick?: (categoryId: string) => void;
  activeCategoryId?: string | null;
}

export default memo(function InstancedSatellites({
  rings,
  onSatelliteClick,
  activeCategoryId,
}: InstancedSatellitesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera, gl } = useThree();

  // Flatten all satellites into a single array
  const satellites = useMemo<SatelliteInfo[]>(() => {
    const result: SatelliteInfo[] = [];
    for (const ring of rings) {
      for (const sat of ring.satellites) {
        result.push({
          orbitRadius: ring.orbitRadius,
          angleOffset: sat.angleOffset,
          orbitalSpeed: ring.orbitalSpeed,
          size: sat.size,
          categoryId: sat.categoryId,
          color: sat.color,
          inclination: ring.inclination,
          ascendingNode: ring.ascendingNode,
          radialOffset: sat.radialOffset,
        });
      }
    }
    return result;
  }, [rings]);

  const count = satellites.length;
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.5, 1), []);

  // Set up instance colors (re-run when active category changes)
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      _tmpColor.set(satellites[i].color);
      // Dim non-active satellites when a category is selected
      if (activeCategoryId && satellites[i].categoryId !== activeCategoryId) {
        _tmpColor.multiplyScalar(0.25);
      }
      colors[i * 3] = _tmpColor.r;
      colors[i * 3 + 1] = _tmpColor.g;
      colors[i * 3 + 2] = _tmpColor.b;
    }

    mesh.geometry.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colors, 3)
    );
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    mesh.count = count;
  }, [satellites, count, activeCategoryId]);

  // Orbital animation — update instance matrices each frame
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    const t = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const sat = satellites[i];
      const angle = sat.angleOffset + t * sat.orbitalSpeed;
      const r = sat.orbitRadius + sat.radialOffset;
      const [x, y, z] = tiltedOrbitPosition(
        angle, r, sat.inclination, sat.ascendingNode
      );

      _pos.set(x, y, z);
      // Pulse effect for active category
      const isActive = activeCategoryId === sat.categoryId;
      const pulse = isActive ? sat.size * (1.3 + Math.sin(t * 6) * 0.2) : sat.size;
      _scale.setScalar(pulse);
      _mat4.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat4);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  // ─── Raycasting ──────────────────────────────────────────────
  const pointerDown = useRef<{ x: number; y: number; time: number } | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());

  const handlePointerDown = useCallback((e: PointerEvent) => {
    pointerDown.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  }, []);

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const down = pointerDown.current;
      if (!down) return;
      pointerDown.current = null;

      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      const dt = Date.now() - down.time;
      if (dt > 400 || dx * dx + dy * dy > 625) return;

      const mesh = meshRef.current;
      if (!mesh || !onSatelliteClick) return;

      const rect = gl.domElement.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(pointer.current, camera);
      const hits = raycaster.current.intersectObject(mesh, false);
      if (hits.length > 0 && hits[0].instanceId !== undefined) {
        const sat = satellites[hits[0].instanceId];
        if (sat) onSatelliteClick(sat.categoryId);
      }
    },
    [camera, gl, onSatelliteClick, satellites]
  );

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
    };
  }, [gl, handlePointerDown, handlePointerUp]);

  useEffect(() => {
    return () => {
      geo.dispose();
    };
  }, [geo]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, undefined, count]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        vertexColors
        emissive="#ffffff"
        emissiveIntensity={0.62}
        roughness={0.18}
        metalness={0.55}
      />
    </instancedMesh>
  );
});
