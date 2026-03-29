"use client";

import { Suspense, useMemo, useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import IslandScene from "./IslandScene";
import type { ArchipelagoIsland, CategoryActivity } from "@/lib/cloud-island";
import { getCategoryById } from "@/lib/aws-categories";

function SkyDome() {
  const geo = useMemo(() => new THREE.SphereGeometry(200, 32, 32), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: `
          varying vec3 vWorldPos;
          void main() {
            vWorldPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
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
      }),
    []
  );

  return <mesh geometry={geo} material={material} renderOrder={-1} />;
}

function IslandInfo({ island }: { island: ArchipelagoIsland }) {
  const topCategories = island.data.categories
    .filter((category) => category.apiCallCount > 0)
    .sort((a, b) => b.apiCallCount - a.apiCallCount)
    .slice(0, 5);

  const errorRate =
    island.data.totalApiCalls > 0
      ? ((island.data.totalErrors / island.data.totalApiCalls) * 100).toFixed(1)
      : "0.0";

  return (
    <Html
      position={[
        island.position[0],
        island.position[1] + island.layout.radius * 0.8 + 8,
        island.position[2],
      ]}
      center
      distanceFactor={40}
      style={{ pointerEvents: "none" }}
    >
      <div className="w-56 rounded-xl border border-white/15 bg-[#12121a]/90 p-3 text-white shadow-2xl backdrop-blur-md">
        <div className="mb-2 text-center">
          <div className="text-sm font-semibold text-indigo-300">{island.label}</div>
          <div className="text-[10px] text-white/30">
            {island.data.totalApiCalls.toLocaleString()} calls | {errorRate}% errors
          </div>
        </div>

        <div className="space-y-1">
          {topCategories.map((cat: CategoryActivity) => {
            const catDef = getCategoryById(cat.categoryId);
            if (!catDef) return null;
            const pct =
              island.data.totalApiCalls > 0
                ? (cat.apiCallCount / island.data.totalApiCalls) * 100
                : 0;

            return (
              <div key={cat.categoryId} className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: catDef.color }}
                />
                <div className="flex-1 text-[10px] text-white/60">{catDef.label}</div>
                <div className="w-16">
                  <div className="h-1 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: catDef.color }}
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

function ClickableIsland({
  island,
  selected,
  onSelect,
  onCategoryClick,
  disabled,
}: {
  island: ArchipelagoIsland;
  selected: boolean;
  onSelect: () => void;
  onCategoryClick?: (categoryId: string) => void;
  disabled: boolean;
}) {
  const handleClick = useCallback(
    (event: THREE.Event) => {
      if (disabled) return;
      (event as unknown as { stopPropagation: () => void }).stopPropagation();
      onSelect();
    },
    [disabled, onSelect]
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
function BalloonPilot({
  enabled,
  controlsRef,
  islands,
}: {
  enabled: boolean;
  controlsRef: React.RefObject<unknown>;
  islands: ArchipelagoIsland[];
}) {
  const { camera } = useThree();
  const balloonRef = useRef<THREE.Group | null>(null);
  const position = useRef(new THREE.Vector3(0, 13.9, 28));
  const velocity = useRef(new THREE.Vector3());
  const controls = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const bounds = useMemo(() => {
    if (islands.length === 0) return 80;
    return Math.max(
      50,
      ...islands.map((island) => Math.max(Math.abs(island.position[0]), Math.abs(island.position[2])) + island.layout.radius + 20)
    );
  }, [islands]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "KeyW" || event.code === "ArrowUp") controls.current.forward = true;
      if (event.code === "KeyS" || event.code === "ArrowDown") controls.current.backward = true;
      if (event.code === "KeyA" || event.code === "ArrowLeft") controls.current.left = true;
      if (event.code === "KeyD" || event.code === "ArrowRight") controls.current.right = true;
      if (event.code === "Space" || event.code === "KeyE") controls.current.up = true;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "KeyQ") controls.current.down = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "KeyW" || event.code === "ArrowUp") controls.current.forward = false;
      if (event.code === "KeyS" || event.code === "ArrowDown") controls.current.backward = false;
      if (event.code === "KeyA" || event.code === "ArrowLeft") controls.current.left = false;
      if (event.code === "KeyD" || event.code === "ArrowRight") controls.current.right = false;
      if (event.code === "Space" || event.code === "KeyE") controls.current.up = false;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "KeyQ") controls.current.down = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const controlsInstance = controlsRef.current as { enabled: boolean } | null;
    if (controlsInstance) {
      controlsInstance.enabled = false;
    }
  }, [enabled, controlsRef]);

  useFrame((state, delta) => {
    const controlsInstance = controlsRef.current as { enabled: boolean; target: THREE.Vector3; update: () => void } | null;

    if (!enabled) {
      if (controlsInstance) controlsInstance.enabled = true;
      if (balloonRef.current) balloonRef.current.visible = false;
      return;
    }

    if (controlsInstance) controlsInstance.enabled = false;
    if (balloonRef.current) balloonRef.current.visible = true;

    const direction = new THREE.Vector3(
      Number(controls.current.right) - Number(controls.current.left),
      Number(controls.current.up) - Number(controls.current.down),
      Number(controls.current.backward) - Number(controls.current.forward)
    );

    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(18 * delta);
      velocity.current.lerp(direction, 0.16);
    } else {
      velocity.current.multiplyScalar(0.92);
    }

    position.current.add(velocity.current);
    position.current.x = THREE.MathUtils.clamp(position.current.x, -bounds, bounds);
    position.current.y = THREE.MathUtils.clamp(position.current.y, 8, 48);
    position.current.z = THREE.MathUtils.clamp(position.current.z, -bounds, bounds);

    const bob = Math.sin(state.clock.elapsedTime * 1.7) * 0.3;
    if (balloonRef.current) {
      balloonRef.current.position.set(position.current.x, position.current.y + bob, position.current.z);
      balloonRef.current.rotation.z = THREE.MathUtils.lerp(balloonRef.current.rotation.z, -velocity.current.x * 0.06, 0.08);
      balloonRef.current.rotation.x = THREE.MathUtils.lerp(balloonRef.current.rotation.x, velocity.current.z * 0.04, 0.08);
    }

    const lookAhead = position.current.clone().add(
      new THREE.Vector3(velocity.current.x * 6.8, 2.4, velocity.current.z * 6.8)
    );
    const desiredCamera = position.current.clone().add(
      new THREE.Vector3(0, 8.2 + Math.sin(state.clock.elapsedTime * 0.6) * 0.4, 30.5)
    );

    camera.position.lerp(desiredCamera, 0.08);
    camera.lookAt(lookAhead);
  });

  return enabled ? <Balloon balloonRef={balloonRef} /> : null;
}

interface IslandCanvasProps {
  islands: ArchipelagoIsland[];
  selectedIslandId: string | null;
  onIslandSelect: (id: string | null) => void;
  onCategoryClick?: (categoryId: string) => void;
  balloonMode?: boolean;
}

export default function IslandCanvas({
  islands,
  selectedIslandId,
  onIslandSelect,
  onCategoryClick,
  balloonMode = false,
}: IslandCanvasProps) {
  const maxRadius = Math.max(20, ...islands.map((island) => island.layout.radius));
  const cameraDistance = Math.max(40, maxRadius * 2.5 + islands.length * 10);
  const controlsRef = useRef<unknown>(null);

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
      onPointerMissed={() => {
        if (!balloonMode) onIslandSelect(null);
      }}
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
            disabled={balloonMode}
          />
        ))}
      </Suspense>

      <BalloonPilot enabled={balloonMode} controlsRef={controlsRef} islands={islands} />

      <OrbitControls
        ref={controlsRef as React.RefObject<unknown>}
        enablePan={!balloonMode}
        enableZoom={false}
        enableRotate={!balloonMode}
        minDistance={10}
        maxDistance={200}
        maxPolarAngle={Math.PI * 0.75}
        target={[0, 3, 0]}
      />

      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.4} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}



















