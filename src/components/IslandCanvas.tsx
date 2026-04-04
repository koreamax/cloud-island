"use client";

import { Suspense, useMemo, useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import OrbitalScene from "./OrbitalScene";
import type { ArchipelagoIsland, OrbitalLayout, CategoryActivity } from "@/lib/cloud-island";
import { getCategoryById } from "@/lib/aws-categories";

// ─── Space Background ─────────────────────────────────────────

function SpaceBackground() {
  const texture = useTexture("/milkyway-bg.jpg");
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = useMemo(() => new THREE.SphereGeometry(250, 64, 64), []);

  return (
    <mesh geometry={geo} renderOrder={-1}>
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── Island Info (hover tooltip) ──────────────────────────────

function IslandInfo({ island }: { island: ArchipelagoIsland }) {
  const layout = island.layout as OrbitalLayout;
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
      position={[0, layout.outerRadius * 0.3 + 6, 0]}
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

// ─── Clickable Island ─────────────────────────────────────────

function ClickableIsland({
  island,
  selected,
  onSelect,
  onCategoryClick,
  disabled,
  activeCategoryId,
}: {
  island: ArchipelagoIsland;
  selected: boolean;
  onSelect: () => void;
  onCategoryClick?: (categoryId: string) => void;
  disabled: boolean;
  activeCategoryId?: string | null;
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
      <OrbitalScene layout={island.layout as OrbitalLayout} onCategoryClick={disabled ? undefined : onCategoryClick} activeCategoryId={activeCategoryId} />
      {selected && !disabled && <IslandInfo island={island} />}
    </group>
  );
}

// ─── Balloon (space explorer) ─────────────────────────────────

function Balloon({ balloonRef }: { balloonRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={balloonRef}>
      {/* Capsule body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.6, 1.2, 8, 16]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Cockpit */}
      <mesh position={[0, 0.3, 0.5]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#60a5fa" transparent opacity={0.6} roughness={0.1} />
      </mesh>
      {/* Engine glow */}
      <mesh position={[0, -1.0, 0]}>
        <coneGeometry args={[0.3, 0.5, 8]} />
        <meshBasicMaterial color="#ff8844" transparent opacity={0.7} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Point light */}
      <pointLight color="#60a5fa" intensity={0.5} distance={10} />
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
  const position = useRef(new THREE.Vector3(0, 10, 50));
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
    const layout = islands[0]?.layout as OrbitalLayout | undefined;
    return layout ? layout.outerRadius + 30 : 80;
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
    position.current.y = THREE.MathUtils.clamp(position.current.y, -bounds * 0.5, bounds * 0.5);
    position.current.z = THREE.MathUtils.clamp(position.current.z, -bounds, bounds);

    if (balloonRef.current) {
      balloonRef.current.position.copy(position.current);
      balloonRef.current.rotation.z = THREE.MathUtils.lerp(balloonRef.current.rotation.z, -velocity.current.x * 0.06, 0.08);
      balloonRef.current.rotation.x = THREE.MathUtils.lerp(balloonRef.current.rotation.x, velocity.current.z * 0.04, 0.08);
    }

    const lookAhead = position.current.clone().add(
      new THREE.Vector3(velocity.current.x * 6.8, 2.4, velocity.current.z * 6.8)
    );
    const desiredCamera = position.current.clone().add(
      new THREE.Vector3(0, 6, 24)
    );

    camera.position.lerp(desiredCamera, 0.08);
    camera.lookAt(lookAhead);
  });

  return enabled ? <Balloon balloonRef={balloonRef} /> : null;
}

// ─── Main Canvas ──────────────────────────────────────────────

interface IslandCanvasProps {
  islands: ArchipelagoIsland[];
  selectedIslandId: string | null;
  onIslandSelect: (id: string | null) => void;
  onCategoryClick?: (categoryId: string) => void;
  balloonMode?: boolean;
  activeCategoryId?: string | null;
}

export default function IslandCanvas({
  islands,
  selectedIslandId,
  onIslandSelect,
  onCategoryClick,
  balloonMode = false,
  activeCategoryId,
}: IslandCanvasProps) {
  const outerRadius = useMemo(() => {
    if (islands.length === 0) return 40;
    const layout = islands[0]?.layout as OrbitalLayout | undefined;
    return layout?.outerRadius ?? 40;
  }, [islands]);

  const cameraDistance = outerRadius * 1.5;
  const controlsRef = useRef<unknown>(null);

  return (
    <Canvas
      camera={{
        position: [cameraDistance * 0.5, cameraDistance * 0.6, cameraDistance * 0.7],
        fov: 50,
        near: 0.1,
        far: 600,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      style={{ width: "100%", height: "100%" }}
      onPointerMissed={() => {
        if (!balloonMode) onIslandSelect(null);
      }}
    >
      <Suspense fallback={null}>
        <SpaceBackground />
      </Suspense>
      <Stars radius={200} depth={80} count={6000} factor={3} saturation={0.2} fade speed={0.5} />

      <Suspense fallback={null}>
        {islands.map((island) => (
          <ClickableIsland
            key={island.id}
            island={island}
            selected={island.id === selectedIslandId}
            onSelect={() => onIslandSelect(island.id)}
            onCategoryClick={onCategoryClick}
            disabled={balloonMode}
            activeCategoryId={activeCategoryId}
          />
        ))}
      </Suspense>

      <BalloonPilot enabled={balloonMode} controlsRef={controlsRef} islands={islands} />

      <OrbitControls
        ref={controlsRef as React.RefObject<null>}
        enablePan={!balloonMode}
        enableZoom
        enableRotate={!balloonMode}
        minDistance={10}
        maxDistance={200}
        target={[0, 0, 0]}
      />

      <EffectComposer>
        <Bloom intensity={0.8} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
