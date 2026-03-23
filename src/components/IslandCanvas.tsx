"use client";

import { Suspense, useMemo, useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
} from "@react-three/postprocessing";
import * as THREE from "three";
import IslandScene from "./IslandScene";
import type { ArchipelagoIsland } from "@/lib/cloud-island";
import type { CategoryActivity } from "@/lib/cloud-island";
import { getCategoryById } from "@/lib/aws-categories";

// ─── Sky Dome ──────────────────────────────────────────────────

function SkyDome() {
  const geo = useMemo(() => new THREE.SphereGeometry(200, 32, 32), []);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          float t = normalize(vWorldPos).y * 0.5 + 0.5;
          vec3 bottom = vec3(0.05, 0.05, 0.12);
          vec3 mid = vec3(0.12, 0.10, 0.25);
          vec3 top = vec3(0.08, 0.06, 0.18);

          vec3 color = t < 0.4
            ? mix(bottom, mid, t / 0.4)
            : mix(mid, top, (t - 0.4) / 0.6);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  return <mesh geometry={geo} material={material} renderOrder={-1} />;
}

// ─── Camera Animator ───────────────────────────────────────────

function CameraAnimator({
  target,
  controlsRef,
}: {
  target: [number, number, number] | null;
  controlsRef: React.RefObject<typeof OrbitControls extends React.ForwardRefExoticComponent<infer P> ? (P extends { ref?: React.Ref<infer T> } ? T : never) : never>;
}) {
  const { camera } = useThree();
  const targetVec = useRef(new THREE.Vector3(0, 3, 0));
  const cameraTarget = useRef(new THREE.Vector3());
  const previousTarget = useRef<[number, number, number] | null>(null);
  const animating = useRef(false);

  useFrame(() => {
    if (!target || !animating.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controls = controlsRef.current as any;
    if (!controls) return;

    // Smoothly move orbit target
    const currentTarget = controls.target as THREE.Vector3;
    currentTarget.lerp(targetVec.current, 0.05);

    // Smoothly move camera
    camera.position.lerp(cameraTarget.current, 0.05);

    controls.update();

    // Stop when close enough
    if (
      currentTarget.distanceTo(targetVec.current) < 0.1 &&
      camera.position.distanceTo(cameraTarget.current) < 0.1
    ) {
      animating.current = false;
    }
  });

  // Trigger animation when target changes
  useEffect(() => {

    if (!enabled || !target) return;

    const targetChanged =
      !previousTarget.current ||
      previousTarget.current[0] !== target[0] ||
      previousTarget.current[1] !== target[1] ||
      previousTarget.current[2] !== target[2];

    previousTarget.current = [target[0], target[1], target[2]];

    if (!targetChanged) return;

    targetVec.current.set(target[0], target[1] + 3, target[2]);
    cameraTarget.current.set(target[0] + 20, target[1] + 15, target[2] + 20);
    animating.current = true;
  }, [enabled, target]);

  return null;
}

// ─── Island Info (Html overlay above island) ───────────────────

function IslandInfo({ island }: { island: ArchipelagoIsland }) {
  const topCategories = island.data.categories
    .filter((c) => c.apiCallCount > 0)
    .sort((a, b) => b.apiCallCount - a.apiCallCount)
    .slice(0, 5);

  const errorRate =
    island.data.totalApiCalls > 0
      ? ((island.data.totalErrors / island.data.totalApiCalls) * 100).toFixed(1)
      : "0.0";

  return (
    <Html
      position={[island.position[0], island.position[1] + island.layout.radius * 0.8 + 8, island.position[2]]}
      center
      distanceFactor={40}
      style={{ pointerEvents: "none" }}
    >
      <div className="w-56 rounded-xl border border-white/15 bg-[#12121a]/90 p-3 text-white backdrop-blur-md shadow-2xl">
        {/* Header */}
        <div className="mb-2 text-center">
          <div className="text-sm font-semibold text-indigo-300">
            {island.label}
          </div>
          <div className="text-[10px] text-white/30">
            {island.data.totalApiCalls.toLocaleString()} calls | {errorRate}% errors
          </div>
        </div>

        {/* Category bars */}
        <div className="space-y-1">
          {topCategories.map((cat: CategoryActivity) => {
            const catDef = getCategoryById(cat.categoryId);
            if (!catDef) return null;
            const pct = island.data.totalApiCalls > 0
              ? (cat.apiCallCount / island.data.totalApiCalls) * 100
              : 0;
            return (
              <div key={cat.categoryId} className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: catDef.color }}
                />
                <div className="flex-1 text-[10px] text-white/60">{catDef.label}</div>
                <div className="w-16">
                  <div className="h-1 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: catDef.color,
                      }}
                    />
                  </div>
                </div>
                <div className="w-8 text-right text-[9px] text-white/40">
                  {cat.apiCallCount.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Html>
  );
}

// ─── Clickable Island Wrapper ──────────────────────────────────

function ClickableIsland({
  island,
  selected,
  onSelect,
  onCategoryClick,
}: {
  island: ArchipelagoIsland;
  selected: boolean;
  onSelect: () => void;
  onCategoryClick?: (categoryId: string) => void;
}) {
  const handleClick = useCallback(
    (e: THREE.Event) => {
      // Stop propagation so canvas background click doesn't deselect
      (e as unknown as { stopPropagation: () => void }).stopPropagation();
      onSelect();
    },
    [onSelect]
  );

  return (
    <group position={island.position} onClick={handleClick}>
      <IslandScene layout={island.layout} onCategoryClick={disabled ? undefined : onCategoryClick} />
      {selected && !disabled && <IslandInfo island={island} />}
    </group>
  );
}

function Balloon({ balloonRef }: { balloonRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={balloonRef}>
      <mesh position={[0, 3.2, 0]} scale={[1.06, 1.18, 1.06]}>
        <sphereGeometry args={[2.7, 36, 36]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.42} roughness={0.6} metalness={0.0} />
      </mesh>
      <mesh position={[0, 3.2, 0]} scale={[1.01, 1.12, 1.01]}>
        <sphereGeometry args={[2.72, 36, 36]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.16} wireframe />
      </mesh>
      <Html position={[0, 3.15, 2.86]} center transform sprite distanceFactor={10.5}>
        <svg
          width="126"
          height="68"
          viewBox="0 0 252 136"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="AWS logo"
          className="drop-shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
        >
          <text
            x="126"
            y="68"
            textAnchor="middle"
            fontSize="58"
            fontFamily="Arial, Helvetica, sans-serif"
            fill="#232F3E"
          >
            aws
          </text>
          <path
            d="M72 92C95 109 145 110 186 93"
            stroke="#FF9900"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M179 81L197 92L183 109"
            stroke="#FF9900"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Html>
      <group position={[0, 1.68, 0]}>
        {[
          [0.78, 0.32],
          [0.52, 0.64],
          [0.18, 0.82],
          [-0.18, 0.82],
          [-0.52, 0.64],
          [-0.78, 0.32],
          [0.78, -0.32],
          [0.52, -0.64],
          [0.18, -0.82],
          [-0.18, -0.82],
          [-0.52, -0.64],
          [-0.78, -0.32],
        ].map(([x, z], index) => (
          <mesh key={index} position={[x, -1.35, z]} rotation={[0.08, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 2.75, 6]} />
            <meshStandardMaterial color="#c8c3bb" />
          </mesh>
        ))}
      </group>
      <group position={[0, -0.2, 0]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[1.02, 1.08, 0.78, 18, 1, true]} />
          <meshStandardMaterial color="#2f3137" roughness={0.9} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <torusGeometry args={[1.03, 0.06, 12, 32]} />
          <meshStandardMaterial color="#6b7280" metalness={0.35} roughness={0.45} />
        </mesh>
        <mesh position={[0, -0.54, 0]}>
          <torusGeometry args={[1.0, 0.05, 12, 32]} />
          <meshStandardMaterial color="#1f2937" metalness={0.25} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[1.75, 0.18, 0.08]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
        <mesh position={[0, -0.12, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1.75, 0.18, 0.08]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
        <mesh position={[0, -0.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.9, 0.9, 0.08, 24]} />
          <meshStandardMaterial color="#3b3f46" roughness={0.78} metalness={0.12} />
        </mesh>
      </group>
      <group position={[0, 0.12, 0.18]}>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color="#f3d2b6" roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.04, 0]}>
          <capsuleGeometry args={[0.17, 0.48, 4, 8]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
        <mesh position={[0.14, 0.0, 0.1]} rotation={[0, 0, -0.48]}>
          <capsuleGeometry args={[0.045, 0.3, 4, 8]} />
          <meshStandardMaterial color="#f3d2b6" />
        </mesh>
        <mesh position={[-0.14, 0.0, 0.1]} rotation={[0, 0, 0.48]}>
          <capsuleGeometry args={[0.045, 0.3, 4, 8]} />
          <meshStandardMaterial color="#f3d2b6" />
        </mesh>
      </group>
    </group>
  );
}

// ─── Main Canvas ───────────────────────────────────────────────

interface IslandCanvasProps {
  islands: ArchipelagoIsland[];
  selectedIslandId: string | null;
  onIslandSelect: (id: string | null) => void;
  onCategoryClick?: (categoryId: string) => void;
}

export default function IslandCanvas({
  islands,
  selectedIslandId,
  onIslandSelect,
  onCategoryClick,
}: IslandCanvasProps) {
  const maxRadius = Math.max(20, ...islands.map((i) => i.layout.radius));
  const cameraDistance = Math.max(40, maxRadius * 2.5 + islands.length * 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  const selectedIsland = islands.find((i) => i.id === selectedIslandId) ?? null;

  return (
    <Canvas
      camera={{
        position: [cameraDistance * 0.7, cameraDistance * 0.5, cameraDistance * 0.7],
        fov: 45,
        near: 0.5,
        far: 500,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ width: "100%", height: "100%" }}
      onPointerMissed={() => onIslandSelect(null)}
    >
      <fog attach="fog" args={["#1a1a2e", 40, 200]} />

      <SkyDome />

      <Suspense fallback={null}>
        {islands.map((island) => (
          <ClickableIsland
            key={island.id}
            island={island}
            selected={island.id === selectedIslandId}
            onSelect={() => onIslandSelect(island.id)}
            onCategoryClick={onCategoryClick}
          />
        ))}
      </Suspense>

      <CameraAnimator
        target={selectedIsland?.position ?? null}
        controlsRef={controlsRef}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={10}
        maxDistance={200}
        maxPolarAngle={Math.PI * 0.75}
        target={[0, 3, 0]}
      />

      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
