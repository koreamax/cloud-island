"use client";

import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { IslandLayout, SectorInfo } from "@/lib/cloud-island";

function seededValue(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453123;
  return x - Math.floor(x);
}

function dominantSector(layout: IslandLayout): SectorInfo | null {
  if (layout.sectors.length === 0) return null;
  return layout.sectors.reduce((best, sector) =>
    sector.apiCallCount > best.apiCallCount ? sector : best
  );
}

function effectIntensity(resourceCount: number) {
  return Math.min(1, 0.25 + resourceCount / 26);
}

function createParticles(count: number, radius: number, profile: "rain" | "petal" | "snow") {
  return Array.from({ length: count }, (_, index) => {
    const a = seededValue(index + radius);
    const b = seededValue(index + radius * 2);
    const c = seededValue(index + radius * 3);
    const d = seededValue(index + radius * 4);
    const e = seededValue(index + radius * 5);
    const f = seededValue(index + radius * 6);

    if (profile === "rain") {
      return {
        x: (a - 0.5) * radius * 2.0,
        y: b * radius * 2.8 + 1.4,
        z: (c - 0.5) * radius * 2.0,
        speed: 1.4 + d * 2.1,
        drift: (e - 0.5) * 0.04,
        size: 0.5 + f * 0.38,
      };
    }

    if (profile === "petal") {
      return {
        x: (a - 0.5) * radius * 2.2,
        y: b * radius * 2.2 + 0.9,
        z: (c - 0.5) * radius * 2.2,
        speed: 0.34 + d * 0.6,
        drift: 0.03 + e * 0.05,
        size: 0.13 + f * 0.07,
      };
    }

    return {
      x: (a - 0.5) * radius * 2.2,
      y: b * radius * 2.25 + 0.9,
      z: (c - 0.5) * radius * 2.2,
      speed: 0.3 + d * 0.42,
      drift: 0.014 + e * 0.024,
      size: 0.1 + f * 0.08,
    };
  });
}

function distributedRingPoints(count: number, radius: number, inner: number, outer: number) {
  return Array.from({ length: count }, (_, index) => {
    const baseAngle = index * 2.399963229728653;
    const jitter = (seededValue(index + 11) - 0.5) * 0.9;
    const angle = baseAngle + jitter;
    const radialMix = Math.pow(seededValue(index + 19), 0.8);
    const dist = radius * (inner + radialMix * (outer - inner));
    return [Math.cos(angle) * dist, Math.sin(angle) * dist] as const;
  });
}

function LightningEffect({ radius, intensity }: { radius: number; intensity: number }) {
  const cloudY = radius * (1.18 + intensity * 0.08);
  const bolts = useMemo(() => {
    const boltCount = 6 + Math.round(intensity * 2);
    return Array.from({ length: boltCount }, (_, index) => {
      const angle = seededValue(index + 101) * Math.PI * 2;
      const spread = radius * (0.34 + seededValue(index + 133) * 0.42);
      const baseX = Math.cos(angle) * spread;
      const baseZ = Math.sin(angle) * spread;
      const wiggle = 0.18 + seededValue(index + 171) * 0.22;
      return [
        new THREE.Vector3(baseX, cloudY - 0.22, baseZ),
        new THREE.Vector3(baseX + wiggle, radius * 1.02, baseZ + wiggle * 0.32),
        new THREE.Vector3(baseX - wiggle * 1.1, radius * 0.82, baseZ - wiggle * 0.48),
        new THREE.Vector3(baseX + wiggle * 0.85, radius * 0.58, baseZ + wiggle * 0.22),
        new THREE.Vector3(baseX - wiggle * 0.6, radius * 0.34, baseZ - wiggle * 0.38),
        new THREE.Vector3(baseX + wiggle * 0.22, radius * 0.16, baseZ + wiggle * 0.08),
      ];
    });
  }, [cloudY, intensity, radius]);

  const lineRefs = useRef<(THREE.Line | null)[]>([]);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lineRefs.current.forEach((line, index) => {
      if (!line) return;
      const points = bolts[index];
      const geometry = line.geometry as THREE.BufferGeometry;
      const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
      points.forEach((point, pointIndex) => {
        const sway =
          pointIndex === 0 || pointIndex === points.length - 1
            ? 0
            : Math.sin(t * (5.4 + index * 0.22) + pointIndex * 1.3) * 0.18;
        attr.setXYZ(pointIndex, point.x + sway, point.y, point.z - sway * 0.72);
      });
      attr.needsUpdate = true;
      line.visible = Math.sin(t * (8.2 + index * 0.25)) > -0.5;
    });
    if (glowRef.current) {
      glowRef.current.intensity = 4 + Math.sin(t * 8.5) * 1 + intensity * 4;
    }
  });

  return (
    <group>
      <group position={[0, cloudY, 0]}>
        <mesh position={[-4.5, -0.02, 0.2]} scale={[9.8, 1.16, 7.8]}>
          <sphereGeometry args={[0.96, 22, 22]} />
          <meshStandardMaterial color="#eef2ff" emissive="#ffffff" emissiveIntensity={0.07} />
        </mesh>
        <mesh position={[-2.45, 0.44, -0.12]} scale={[11.4, 1.34, 8.44]}>
          <sphereGeometry args={[1.08, 22, 22]} />
          <meshStandardMaterial color="#f5f7ff" emissive="#ffffff" emissiveIntensity={0.09} />
        </mesh>
        <mesh position={[-0.3, 0.72, 0.06]} scale={[12.4, 1.5, 9.08]}>
          <sphereGeometry args={[1.18, 24, 24]} />
          <meshStandardMaterial color="#f8f9ff" emissive="#ffffff" emissiveIntensity={0.1} />
        </mesh>
        <mesh position={[2.1, 0.56, -0.04]} scale={[11.2, 1.38, 8.36]}>
          <sphereGeometry args={[1.06, 22, 22]} />
          <meshStandardMaterial color="#f5f7ff" emissive="#ffffff" emissiveIntensity={0.09} />
        </mesh>
        <mesh position={[4.25, 0.1, 0.18]} scale={[9.2, 1.14, 7.4]}>
          <sphereGeometry args={[0.92, 22, 22]} />
          <meshStandardMaterial color="#edf1fe" emissive="#ffffff" emissiveIntensity={0.07} />
        </mesh>
        <mesh position={[-2.7, -0.62, 0.02]} scale={[13.6, 1.06, 8.52]}>
          <sphereGeometry args={[0.98, 22, 22]} />
          <meshStandardMaterial color="#e8ecfb" emissive="#ffffff" emissiveIntensity={0.04} />
        </mesh>
        <mesh position={[0.55, -0.74, 0]} scale={[17.8, 1.14, 9.84]}>
          <sphereGeometry args={[1.04, 22, 22]} />
          <meshStandardMaterial color="#e4e9fb" emissive="#ffffff" emissiveIntensity={0.04} />
        </mesh>
        <mesh position={[3.45, -0.6, 0.04]} scale={[12.4, 1.04, 8.04]}>
          <sphereGeometry args={[0.95, 22, 22]} />
          <meshStandardMaterial color="#e8ecfb" emissive="#ffffff" emissiveIntensity={0.04} />
        </mesh>
      </group>
      {bolts.map((points, index) => (
        <line
          key={index}
          ref={(line) => {
            lineRefs.current[index] = line;
          }}
          geometry={new THREE.BufferGeometry().setFromPoints(points)}
        >
          <lineBasicMaterial color="#ffe45e" linewidth={2} />
        </line>
      ))}
      <pointLight ref={glowRef} position={[0, radius * 0.8, 0]} color="#ffd84d" distance={42 + intensity * 18} intensity={7} />
    </group>
  );
}

function TreeEffect({ radius, intensity }: { radius: number; intensity: number }) {
  const count = 10 + Math.round(intensity * 24);
  const trees = useMemo(
    () =>
      distributedRingPoints(count, radius, 0.76, 0.96).map(([x, z], index) => [
        x,
        0.4,
        z,
        0.95 + seededValue(index + 7) * 0.95,
      ] as const),
    [count, radius]
  );

  return (
    <group>
      {trees.map((position, index) => (
        <group key={index} position={[position[0], position[1], position[2]]} scale={position[3]}>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.09, 0.13, 0.82, 6]} />
            <meshStandardMaterial color="#7a4b1f" />
          </mesh>
          <mesh position={[0, 1.18, 0]}>
            <coneGeometry args={[0.64, 1.32, 8]} />
            <meshStandardMaterial color="#7AA116" emissive="#5d8710" emissiveIntensity={0.18} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RainEffect({ radius, color, intensity }: { radius: number; color: string; intensity: number }) {
  const dropCount = 54 + Math.round(intensity * 100);
  const drops = useMemo(() => createParticles(dropCount, radius, "rain"), [dropCount, radius]);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, index) => {
      const drop = drops[index];
      child.position.y -= drop.speed * delta * (9 + intensity * 7);
      child.position.x += drop.drift;
      if (child.position.y < 0.2) child.position.y = radius * (2.35 + intensity * 0.95);
    });
  });

  return (
    <group ref={groupRef}>
      {drops.map((drop, index) => (
        <mesh key={index} position={[drop.x, drop.y, drop.z]}>
          <cylinderGeometry args={[0.035, 0.035, drop.size + intensity * 0.24, 6]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function FlowerEffect({ radius, intensity }: { radius: number; intensity: number }) {
  const count = 16 + Math.round(intensity * 20);
  const flowers = useMemo(
    () =>
      distributedRingPoints(count, radius, 0.76, 0.96).map(([x, z], index) => [
        x,
        0.18,
        z,
        1 + seededValue(index + 31) * 0.9,
      ] as const),
    [count, radius]
  );

  return (
    <group>
      {flowers.map((position, index) => (
        <group key={index} position={[position[0], position[1], position[2]]} scale={position[3]}>
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.54, 6]} />
            <meshStandardMaterial color="#4b9b3c" />
          </mesh>
          {[[0.13, 0.5, 0], [-0.13, 0.5, 0], [0, 0.5, 0.13], [0, 0.5, -0.13], [0.1, 0.5, 0.1], [-0.1, 0.5, -0.1]].map((petal, petalIndex) => (
            <mesh key={petalIndex} position={petal as [number, number, number]}>
              <boxGeometry args={[0.12, 0.08, 0.06]} />
              <meshStandardMaterial color="#8C4FFF" emissive="#8C4FFF" emissiveIntensity={0.34} />
            </mesh>
          ))}
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color="#f5d547" emissive="#f5d547" emissiveIntensity={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SunlightEffect({ radius, intensity }: { radius: number; intensity: number }) {
  const sunY = radius * (1.08 + intensity * 0.05);
  const sunZ = -radius * 0.12;

  return (
    <group>
      <mesh position={[0, sunY, sunZ]}>
        <sphereGeometry args={[1.1 + intensity * 0.25, 24, 24]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffad5a" emissiveIntensity={1.45} />
      </mesh>
      <mesh position={[0, sunY, sunZ]}>
        <sphereGeometry args={[1.85 + intensity * 0.3, 24, 24]} />
        <meshStandardMaterial color="#ffcb7d" transparent opacity={0.16} />
      </mesh>
      <pointLight position={[0, sunY, sunZ]} color="#ffb16c" intensity={7.5 + intensity * 4.5} distance={52 + intensity * 20} />
      <directionalLight position={[0, sunY, sunZ]} intensity={1.45 + intensity * 0.9} color="#ffd39b" />
    </group>
  );
}

function PetalEffect({ radius, intensity }: { radius: number; intensity: number }) {
  const petalCount = 38 + Math.round(intensity * 62);
  const petals = useMemo(() => createParticles(petalCount, radius, "petal"), [petalCount, radius]);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, index) => {
      const petal = petals[index];
      child.position.y -= petal.speed * delta * (6.5 + intensity * 4.5);
      child.position.x += Math.sin(state.clock.elapsedTime + index) * petal.drift;
      child.rotation.z += delta * 2.3;
      if (child.position.y < 0.2) child.position.y = radius * (2.0 + intensity * 0.55);
    });
  });

  return (
    <group ref={groupRef}>
      {petals.map((petal, index) => (
        <mesh key={index} position={[petal.x, petal.y, petal.z]} rotation={[0.35, 0.2, 0.2]}>
          <boxGeometry args={[petal.size, petal.size * 0.68, petal.size * 0.18]} />
          <meshStandardMaterial color="#ff9dcb" emissive="#ff9dcb" emissiveIntensity={0.38} />
        </mesh>
      ))}
    </group>
  );
}

function SnowEffect({ radius, intensity }: { radius: number; intensity: number }) {
  const snowCount = 34 + Math.round(intensity * 72);
  const flakes = useMemo(() => createParticles(snowCount, radius, "snow"), [snowCount, radius]);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, index) => {
      const flake = flakes[index];
      child.position.y -= flake.speed * delta * (5.4 + intensity * 3.2);
      child.position.x += Math.cos(state.clock.elapsedTime + index) * flake.drift;
      child.position.z += Math.sin(state.clock.elapsedTime * 0.8 + index) * flake.drift;
      if (child.position.y < 0.2) child.position.y = radius * (2.1 + intensity * 0.55);
    });
  });

  return (
    <group ref={groupRef}>
      {flakes.map((flake, index) => (
        <mesh key={index} position={[flake.x, flake.y, flake.z]}>
          <sphereGeometry args={[flake.size + intensity * 0.04, 8, 8]} />
          <meshStandardMaterial color="#f6fbff" emissive="#d9f2ff" emissiveIntensity={0.45} />
        </mesh>
      ))}
    </group>
  );
}

function CategoryEffect({ layout }: { layout: IslandLayout }) {
  const dominant = useMemo(() => dominantSector(layout), [layout]);

  if (!dominant || dominant.apiCallCount <= 0) return null;

  const intensity = effectIntensity(dominant.resourceCount);

  switch (dominant.categoryId) {
    case "compute":
      return <LightningEffect radius={layout.radius} intensity={intensity} />;
    case "storage":
      return <TreeEffect radius={layout.radius} intensity={intensity} />;
    case "database":
      return <RainEffect radius={layout.radius} color="#4b8dff" intensity={intensity} />;
    case "networking":
      return <FlowerEffect radius={layout.radius} intensity={intensity} />;
    case "security":
      return <SunlightEffect radius={layout.radius} intensity={intensity} />;
    case "management":
      return <PetalEffect radius={layout.radius} intensity={intensity} />;
    case "aiml":
      return <SnowEffect radius={layout.radius} intensity={intensity} />;
    default:
      return null;
  }
}

export default memo(CategoryEffect);







