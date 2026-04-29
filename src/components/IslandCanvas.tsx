"use client";

import { Suspense, useMemo, useRef, useCallback, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import OrbitalScene from "./OrbitalScene";
import type {
  ArchipelagoIsland,
  MultiplayerPlayerState,
  OrbitalLayout,
  CategoryActivity,
} from "@/lib/cloud-island";
import { getCategoryById } from "@/lib/aws-categories";

const BLACK_HOLE_CENTER = new THREE.Vector3(-34, 8, -560);
const BLACK_HOLE_EVENT_HORIZON = 30;
const WHITE_HOLE_CENTER = new THREE.Vector3(-118, 12, 468);
const WHITE_HOLE_FORWARD = BLACK_HOLE_CENTER.clone()
  .sub(WHITE_HOLE_CENTER)
  .normalize();
const WHITE_HOLE_QUATERNION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  WHITE_HOLE_FORWARD
);
const WHITE_HOLE_PORTAL_OFFSET = 18;
const WHITE_HOLE_EXIT_OFFSET = 8;
const WHITE_HOLE_PORTAL_POSITION = WHITE_HOLE_CENTER
  .clone()
  .add(WHITE_HOLE_FORWARD.clone().multiplyScalar(WHITE_HOLE_PORTAL_OFFSET));
const WHITE_HOLE_EXIT_POSITION = WHITE_HOLE_PORTAL_POSITION
  .clone()
  .add(WHITE_HOLE_FORWARD.clone().multiplyScalar(WHITE_HOLE_EXIT_OFFSET))
  .add(new THREE.Vector3(0, 0.2, 0));
const WHITE_HOLE_EXIT_DIRECTION = WHITE_HOLE_FORWARD.clone();

interface BalloonExploreState {
  active: boolean;
  position: THREE.Vector3;
  forward: THREE.Vector3;
}

interface BalloonStateSnapshot {
  active: boolean;
  position: [number, number, number];
  forward: [number, number, number];
}

interface BattleProjectile {
  id: string;
  team: "player" | "enemy";
  damage: number;
  targetKind: "player" | "enemy";
  start: THREE.Vector3;
  end: THREE.Vector3;
  spawnAt: number;
  duration: number;
  hitRadius: number;
}

function summarizeCombatStats(islandData: ArchipelagoIsland["data"]) {
  const totalResources = islandData.categories.reduce(
    (sum, category) => sum + category.resourceCount,
    0
  );
  const dominantCategoryCalls = islandData.categories.reduce(
    (max, category) => Math.max(max, category.apiCallCount),
    0
  );
  const errorRatio =
    islandData.totalApiCalls > 0 ? islandData.totalErrors / islandData.totalApiCalls : 0;

  const maxHp = Math.round(
    120 +
      islandData.totalApiCalls / 260 +
      totalResources * 2.8 -
      Math.min(errorRatio * 120, 26)
  );
  const attackPower =
    10 +
    islandData.totalApiCalls / 4200 +
    dominantCategoryCalls / 3200 +
    totalResources / 12 +
    errorRatio * 18;
  const cooldown = THREE.MathUtils.clamp(0.9 - totalResources / 520, 0.28, 0.92);

  return {
    maxHp: Math.max(90, maxHp),
    attackPower,
    cooldown,
  };
}

// ─── Space Background ─────────────────────────────────────────

function SpaceBackground() {
  const texture = useTexture("/milkyway-bg.jpg");
  const backgroundTexture = useMemo(() => {
    const nextTexture = texture.clone();
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    return nextTexture;
  }, [texture]);

  const geo = useMemo(() => new THREE.SphereGeometry(1200, 96, 96), []);

  return (
    <mesh geometry={geo} renderOrder={-1}>
      <meshBasicMaterial
        map={backgroundTexture}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function FixedBackdropBlackHole() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(512, 512, 60, 512, 512, 340);
    glow.addColorStop(0, "rgba(255,250,245,0.0)");
    glow.addColorStop(0.32, "rgba(255,228,205,0.24)");
    glow.addColorStop(0.58, "rgba(255,188,150,0.16)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(512, 512);
    const ringGlow = ctx.createRadialGradient(0, 0, 120, 0, 0, 310);
    ringGlow.addColorStop(0, "rgba(255,255,255,0)");
    ringGlow.addColorStop(0.25, "rgba(255,245,236,0.96)");
    ringGlow.addColorStop(0.38, "rgba(255,223,198,0.82)");
    ringGlow.addColorStop(0.56, "rgba(255,174,132,0.48)");
    ringGlow.addColorStop(0.74, "rgba(255,115,62,0.22)");
    ringGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ringGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 310, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const beam = ctx.createLinearGradient(90, 512, 934, 512);
    beam.addColorStop(0, "rgba(255,185,135,0)");
    beam.addColorStop(0.18, "rgba(255,214,184,0.72)");
    beam.addColorStop(0.5, "rgba(255,243,232,0.96)");
    beam.addColorStop(0.82, "rgba(255,214,184,0.72)");
    beam.addColorStop(1, "rgba(255,185,135,0)");
    ctx.fillStyle = beam;
    ctx.fillRect(86, 496, 852, 30);

    const innerBeam = ctx.createLinearGradient(110, 526, 920, 526);
    innerBeam.addColorStop(0, "rgba(255,255,255,0)");
    innerBeam.addColorStop(0.35, "rgba(255,220,190,0.72)");
    innerBeam.addColorStop(0.5, "rgba(255,255,255,0.86)");
    innerBeam.addColorStop(0.65, "rgba(255,220,190,0.72)");
    innerBeam.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = innerBeam;
    ctx.fillRect(110, 520, 810, 14);

    const swirl = ctx.createRadialGradient(512, 512, 180, 512, 512, 380);
    swirl.addColorStop(0, "rgba(255,255,255,0)");
    swirl.addColorStop(0.5, "rgba(255,230,210,0.12)");
    swirl.addColorStop(0.7, "rgba(255,148,110,0.1)");
    swirl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = swirl;
    ctx.beginPath();
    ctx.arc(512, 512, 380, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(512, 512, 168, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  if (!texture) return null;

  return (
    <group position={[BLACK_HOLE_CENTER.x, BLACK_HOLE_CENTER.y, BLACK_HOLE_CENTER.z + 12.5]}>
      <mesh renderOrder={-0.5}>
        <planeGeometry args={[154, 154]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.92}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, -12.5]}>
        <sphereGeometry args={[27.5, 56, 56]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
      <BlackHoleSuction />
    </group>
  );
}

function BlackHoleSuction() {
  const particles = useMemo(
    () =>
      Array.from({ length: 44 }, (_, index) => {
        const seed = Math.sin((index + 1) * 91.173) * 43758.5453;
        const rand = (offset: number) => {
          const value = Math.sin(seed + offset * 17.13) * 43758.5453;
          return value - Math.floor(value);
        };

        return {
          radius: 18 + (index % 6) * 6 + rand(1) * 18,
          angle: rand(2) * Math.PI * 2,
          speed: 0.18 + rand(3) * 0.26,
          drift: 0.4 + rand(4) * 0.9,
          size: 0.35 + rand(5) * 0.42,
          z: -2 - rand(6) * 10,
          twinkle: 0.45 + rand(7) * 0.55,
        };
      }),
    []
  );

  return (
    <group>
      {particles.map((particle, index) => (
        <SuctionParticle key={index} {...particle} />
      ))}
    </group>
  );
}

function SuctionParticle({
  radius,
  angle,
  speed,
  drift,
  size,
  z,
  twinkle,
}: {
  radius: number;
  angle: number;
  speed: number;
  drift: number;
  size: number;
  z: number;
  twinkle: number;
}) {
  const ref = useRef<THREE.Mesh | null>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const spiral = (t * speed + angle) % (Math.PI * 2);
    const pull = (Math.sin(t * drift + angle) + 1) * 0.5;
    const currentRadius = THREE.MathUtils.lerp(radius, 9, pull);
    ref.current.position.set(
      Math.cos(spiral) * currentRadius,
      Math.sin(spiral) * currentRadius,
      z + Math.sin(t * (speed + 0.1) + angle) * 1.5
    );
    const baseOpacity = THREE.MathUtils.clamp(1 - (currentRadius - 9) / radius, 0.08, 0.82);
    const twinkleOpacity = baseOpacity * (0.72 + Math.sin(t * 6 * twinkle + angle * 2) * 0.28);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = twinkleOpacity;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial
        color="#fff6e8"
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function BackgroundRocket({
  speed,
  scale,
  bodyColor,
  lightColor,
  phase,
  path,
  tiltBias,
  logoType,
}: {
  speed: number;
  scale: number;
  bodyColor: string;
  lightColor: string;
  phase: number;
  path: {
    baseX: number;
    baseY: number;
    xA: number;
    xB: number;
    xC: number;
    xFreqA: number;
    xFreqB: number;
    yA: number;
    yB: number;
    yC: number;
    yFreqA: number;
    yFreqB: number;
    zA: number;
    zB: number;
    zC: number;
    zFreqA: number;
      zFreqB: number;
      baseZ: number;
  };
  tiltBias: number;
  logoType: "aws" | "dongguk";
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const previousPosition = useRef(new THREE.Vector3());
  const colors = useMemo(() => {
    const base = new THREE.Color(bodyColor);
    const body = base.clone().offsetHSL(0, -0.06, 0.22);
    const fin = base.clone().offsetHSL(0.08, 0.12, -0.05);
    const band = new THREE.Color(lightColor).clone().offsetHSL(0.05, 0.06, 0.08);
    return {
      body: `#${body.getHexString()}`,
      fin: `#${fin.getHexString()}`,
      band: `#${band.getHexString()}`,
    };
  }, [bodyColor, lightColor]);

  const logoTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (logoType === "aws") {
      ctx.fillStyle = "#232f3e";
      ctx.font = "bold 138px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("aws", 256, 96);

      ctx.strokeStyle = "#ff9900";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(250, 136, 90, 0.24, 2.85, false);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(330, 164);
      ctx.lineTo(366, 148);
      ctx.lineTo(346, 182);
      ctx.closePath();
      ctx.fillStyle = "#ff9900";
      ctx.fill();
    } else {
      ctx.fillStyle = "#8f857d";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "bold 72px Arial";
      ctx.fillText("dongguk", 44, 86);
      ctx.font = "52px Arial";
      ctx.fillText("UNIVERSITY", 44, 148);

      const petals = [
        { color: "#f59e0b", angle: -0.9 },
        { color: "#f97316", angle: -0.42 },
        { color: "#fbbf24", angle: 0.02 },
        { color: "#facc15", angle: 0.42 },
        { color: "#ea580c", angle: 0.86 },
      ];
      ctx.save();
      ctx.translate(398, 116);
      petals.forEach((petal) => {
        ctx.save();
        ctx.rotate(petal.angle);
        ctx.fillStyle = petal.color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(64, -18);
        ctx.quadraticCurveTo(94, 0, 64, 18);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [logoType]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + phase;
    if (!groupRef.current) return;

    const x =
      path.baseX +
      Math.cos(t * path.xFreqA) * path.xA +
      Math.sin(t * path.xFreqB) * path.xB +
      Math.cos(t * 0.11) * path.xC;
    const y =
      path.baseY +
      Math.sin(t * path.yFreqA) * path.yA +
      Math.cos(t * path.yFreqB) * path.yB +
      Math.sin(t * 0.13) * path.yC +
      Math.cos(t * 0.31) * 14;
    const z =
      Math.sin(t * path.zFreqA) * path.zA +
      Math.cos(t * path.zFreqB) * path.zB +
      Math.sin(t * 0.09) * path.zC +
      path.baseZ;
    groupRef.current.position.set(x, y, z);

    const velocity = groupRef.current.position.clone().sub(previousPosition.current);
    if (velocity.lengthSq() > 0.0001) {
      const yaw = Math.atan2(velocity.x, velocity.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        yaw - Math.PI / 2 + tiltBias,
        0.12
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -velocity.y * 0.02,
        0.12
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        -velocity.y * 0.012,
        0.1
      );
    }
    previousPosition.current.copy(groupRef.current.position);
  });

  return (
    <group ref={groupRef} scale={scale}>
      <mesh position={[6.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[1.7, 4.6, 24]} />
        <meshStandardMaterial
          color="#f9fafb"
          metalness={0.55}
          roughness={0.28}
        />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[1.65, 1.95, 10.8, 24]} />
        <meshStandardMaterial
          color={colors.body}
          metalness={0.74}
          roughness={0.22}
        />
      </mesh>
      <mesh position={[0.2, 0, 1.98]} rotation={[0, 0, 0]}>
        <planeGeometry args={[5.2, 2.6]} />
        <meshBasicMaterial map={logoTexture ?? undefined} transparent />
      </mesh>
      <mesh position={[-1.6, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.72, 0.12, 10, 40]} />
        <meshBasicMaterial color={colors.band} />
      </mesh>
      <mesh position={[-5.8, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[1.55, 1.2, 2.2, 20]} />
        <meshStandardMaterial
          color={colors.fin}
          metalness={0.76}
          roughness={0.24}
        />
      </mesh>
      {Array.from({ length: 4 }).map((_, index) => {
        const angle = (index / 4) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[-4.9, Math.cos(angle) * 1.55, Math.sin(angle) * 1.55]}
            rotation={[-angle, 0, 0]}
          >
            <boxGeometry args={[2.2, 0.28, 1.1]} />
            <meshStandardMaterial color={colors.fin} metalness={0.64} roughness={0.24} />
          </mesh>
        );
      })}
      <mesh position={[-8.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[1.2, 5.4, 24]} />
        <meshBasicMaterial
          color={lightColor}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight color={lightColor} intensity={2.8} distance={56} position={[-7.1, 0, 0]} />
    </group>
  );
}

function BackgroundSet() {
  const rockets = [
    {
      speed: 0.44,
      scale: 4.35,
      bodyColor: "#e5eef8",
      lightColor: "#ff9900",
      phase: 0,
      path: {
        baseX: -150,
        baseY: 92,
        xA: 142,
        xB: 28,
        xC: 12,
        xFreqA: 0.24,
        xFreqB: 0.14,
        yA: 64,
        yB: 26,
        yC: 16,
        yFreqA: 0.22,
        yFreqB: 0.18,
        zA: 118,
        zB: 34,
        zC: 22,
        zFreqA: 0.28,
        zFreqB: 0.16,
        baseZ: -162,
      },
      tiltBias: 0.08,
      logoType: "aws" as const,
    },
    {
      speed: 0.38,
      scale: 4.35,
      bodyColor: "#f5e9dc",
      lightColor: "#f59e0b",
      phase: 2.7,
      path: {
        baseX: 152,
        baseY: 90,
        xA: 124,
        xB: 36,
        xC: 14,
        xFreqA: 0.18,
        xFreqB: 0.21,
        yA: 58,
        yB: 30,
        yC: 18,
        yFreqA: 0.29,
        yFreqB: 0.16,
        zA: 136,
        zB: 40,
        zC: 24,
        zFreqA: 0.19,
        zFreqB: 0.24,
        baseZ: -176,
      },
      tiltBias: -0.12,
      logoType: "dongguk" as const,
    },
  ];

  return (
    <group>
      <FixedBackdropBlackHole />
      <FixedBackdropWhiteHole />
      {rockets.map((rocket) => (
        <BackgroundRocket key={`${rocket.phase}-${rocket.speed}`} {...rocket} />
      ))}
    </group>
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
  categoryInteractionDisabled,
  activeCategoryId,
}: {
  island: ArchipelagoIsland;
  selected: boolean;
  onSelect: () => void;
  onCategoryClick?: (categoryId: string) => void;
  categoryInteractionDisabled: boolean;
  activeCategoryId?: string | null;
}) {
  const handleClick = useCallback(
    (event: THREE.Event) => {
      (event as unknown as { stopPropagation: () => void }).stopPropagation();
      onSelect();
    },
    [onSelect]
  );

  return (
    <group position={island.position} onClick={handleClick}>
      <OrbitalScene
        layout={island.layout as OrbitalLayout}
        onCategoryClick={
          categoryInteractionDisabled ? () => onSelect() : onCategoryClick
        }
        activeCategoryId={activeCategoryId}
      />
      {selected && <IslandInfo island={island} />}
    </group>
  );
}

function WhiteHoleBandArc({
  radiusX,
  radiusY,
  depth,
  bow,
  color,
  opacity,
  invert = false,
}: {
  radiusX: number;
  radiusY: number;
  depth: number;
  bow: number;
  color: string;
  opacity: number;
  invert?: boolean;
}) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const startAngle = invert ? Math.PI : 0;
    const endAngle = invert ? Math.PI * 2 : Math.PI;

    for (let step = 0; step <= 84; step += 1) {
      const t = step / 84;
      const theta = THREE.MathUtils.lerp(startAngle, endAngle, t);
      const x = Math.cos(theta) * radiusX;
      const y = Math.sin(theta) * radiusY;
      const edgeLock = Math.pow(Math.sin(t * Math.PI), 0.72);
      const curvedY = y + (invert ? -1 : 1) * bow * edgeLock;
      points.push(new THREE.Vector3(x, curvedY, depth));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 144, 0.09, 10, false);
  }, [bow, depth, invert, radiusX, radiusY]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function FixedBackdropWhiteHole() {
  const apertureTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(512, 512);

    for (let ring = 0; ring < 13; ring++) {
      const radius = 44 + ring * 34;
      const gradient = ctx.createLinearGradient(-radius, 0, radius, 0);
      gradient.addColorStop(0, "rgba(255,111,60,0.9)");
      gradient.addColorStop(0.24, "rgba(255,206,109,0.88)");
      gradient.addColorStop(0.5, "rgba(181,255,250,0.92)");
      gradient.addColorStop(0.76, "rgba(100,182,255,0.86)");
      gradient.addColorStop(1, "rgba(255,78,95,0.88)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = ring === 0 ? 7 : 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, Math.PI * 0.38, Math.PI * 1.62, true);
      ctx.stroke();
    }

    for (let spoke = 0; spoke < 24; spoke++) {
      const angle = THREE.MathUtils.degToRad(186 + spoke * 7.6);
      const inner = 28;
      const outer = 470;
      const gradient = ctx.createLinearGradient(
        Math.cos(angle) * inner,
        Math.sin(angle) * inner,
        Math.cos(angle) * outer,
        Math.sin(angle) * outer
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.82)");
      gradient.addColorStop(0.4, "rgba(163,255,245,0.72)");
      gradient.addColorStop(1, "rgba(255,89,89,0.66)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = spoke % 3 === 0 ? 2.8 : 1.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }

    const halo = ctx.createRadialGradient(0, 0, 12, 0, 0, 255);
    halo.addColorStop(0, "rgba(255,255,255,1)");
    halo.addColorStop(0.2, "rgba(236,255,255,0.96)");
    halo.addColorStop(0.52, "rgba(138,235,255,0.62)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 260, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  if (!apertureTexture) return null;

  const tunnelLayers = Array.from({ length: 18 }, (_, index) => ({
    depth: 12 + index * 10,
    radiusX: 10.6 + index * 4.15,
    radiusY: 1.92 + index * 0.14,
    bow: 9.5 + index * 3.3,
    opacity: Math.max(0.16, 0.9 - index * 0.038),
    color: new THREE.Color().setHSL(index / 19, 0.82, 0.76).getStyle(),
  }));

  return (
    <group position={WHITE_HOLE_CENTER.toArray() as [number, number, number]}>
      <group quaternion={WHITE_HOLE_QUATERNION}>
        <mesh renderOrder={-0.45}>
          <circleGeometry args={[40, 128]} />
          <meshBasicMaterial
            map={apertureTexture}
            transparent
            opacity={0.82}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh position={[0, 0, -1.8]}>
          <ringGeometry args={[28, 41, 96]} />
          <meshBasicMaterial
            color="#d4fbff"
            transparent
            opacity={0.9}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh position={[0, 0, 6.5]}>
          <sphereGeometry args={[15, 42, 42]} />
          <meshBasicMaterial
            color="#fbfeff"
            transparent
            opacity={0.95}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {tunnelLayers.map((layer, index) => (
          <group key={`ring-upper-${layer.depth}-${index}`}>
            <WhiteHoleBandArc
              radiusX={layer.radiusX}
              radiusY={layer.radiusY}
              depth={layer.depth}
              bow={layer.bow}
              color={layer.color}
              opacity={layer.opacity}
            />
            <WhiteHoleBandArc
              radiusX={layer.radiusX}
              radiusY={layer.radiusY}
              depth={layer.depth}
              bow={layer.bow}
              color={layer.color}
              opacity={layer.opacity * 0.96}
              invert
            />
          </group>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, WHITE_HOLE_PORTAL_OFFSET * 0.58]} scale={[1.24, 0.28, 1]}>
          <torusGeometry args={[18, 0.12, 10, 120]} />
          <meshBasicMaterial
            color="#eefcff"
            transparent
            opacity={0.54}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
      <mesh
        position={WHITE_HOLE_PORTAL_POSITION.toArray() as [number, number, number]}
        quaternion={WHITE_HOLE_QUATERNION}
      >
        <circleGeometry args={[8.5, 48]} />
        <meshBasicMaterial
          color="#efffff"
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight color="#b3f1ff" intensity={7.5} distance={220} />
    </group>
  );
}

// ─── Balloon (space explorer) ─────────────────────────────────

function Balloon({ balloonRef }: { balloonRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={balloonRef}>
      <mesh position={[0, 0.82, 0]} scale={[1.8, 0.44, 1.8]}>
        <sphereGeometry args={[1.92, 32, 32]} />
        <meshStandardMaterial color="#ff4d4d" roughness={0.16} metalness={0.86} />
      </mesh>
      <mesh position={[0, 1.54, 0.08]} scale={[1.08, 0.34, 1.08]}>
        <sphereGeometry args={[1.36, 24, 24]} />
        <meshStandardMaterial color="#1f1f1f" metalness={0.65} roughness={0.08} transparent opacity={0.52} />
      </mesh>
      <group position={[0, 1.62, 0.34]} scale={1.06}>
        <mesh position={[0, 0.44, 0]} scale={[1.0, 1.1, 0.86]}>
          <sphereGeometry args={[0.72, 18, 18]} />
          <meshStandardMaterial color="#69f02d" roughness={0.5} metalness={0.04} />
        </mesh>
        <mesh position={[-0.22, 0.5, 0.46]} rotation={[0.2, -0.35, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial color="#24153a" emissive="#24153a" emissiveIntensity={0.28} />
        </mesh>
        <mesh position={[0.22, 0.5, 0.46]} rotation={[0.2, 0.35, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial color="#24153a" emissive="#24153a" emissiveIntensity={0.28} />
        </mesh>
        <mesh position={[0, -0.22, 0]} scale={[0.9, 0.82, 0.55]}>
          <capsuleGeometry args={[0.3, 0.72, 8, 12]} />
          <meshStandardMaterial color="#2563eb" roughness={0.62} metalness={0.08} />
        </mesh>
        <mesh position={[-0.18, -0.9, 0]} rotation={[0, 0, 0.08]}>
          <capsuleGeometry args={[0.06, 0.32, 4, 8]} />
          <meshStandardMaterial color="#69f02d" roughness={0.45} metalness={0.04} />
        </mesh>
        <mesh position={[0.18, -0.9, 0]} rotation={[0, 0, -0.08]}>
          <capsuleGeometry args={[0.06, 0.32, 4, 8]} />
          <meshStandardMaterial color="#69f02d" roughness={0.45} metalness={0.04} />
        </mesh>
      </group>
      <pointLight color="#ff6b6b" intensity={0.9} distance={16} />
    </group>
  );
}

function BalloonPilot({
  enabled,
  controlsRef,
  islands,
  stateRef,
  startIsland,
  onStateChange,
}: {
  enabled: boolean;
  controlsRef: React.RefObject<unknown>;
  islands: ArchipelagoIsland[];
  stateRef: React.RefObject<BalloonExploreState>;
  startIsland: ArchipelagoIsland | null;
  onStateChange?: (state: BalloonStateSnapshot) => void;
}) {
  const { camera } = useThree();
  const balloonRef = useRef<THREE.Group | null>(null);
  const position = useRef(new THREE.Vector3(0, 10, 50));
  const velocity = useRef(new THREE.Vector3());
  const lockedViewDir = useRef(new THREE.Vector3(0, 0, -1));
  const followOffset = useRef(new THREE.Vector3(0, 5.4, 24.5));
  const lookAheadDistance = useRef(28);
  const desiredCamera = useRef(new THREE.Vector3());
  const desiredLook = useRef(new THREE.Vector3());
  const wormholeCooldownUntil = useRef(0);
  const lastBroadcastAt = useRef(0);
  const controls = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const bounds = useMemo(() => {
    if (islands.length === 0) return 1200;

    // Build an exploration boundary from the farthest island center + its visual radius,
    // then add generous margin so movement only stops near the true edge of the scene.
    let maxReach = 0;
    for (const island of islands) {
      const layout = island.layout as OrbitalLayout | undefined;
      const radius = layout?.outerRadius ?? 40;
      const [x, y, z] = island.position;
      const centerDistance = Math.sqrt(x * x + y * y + z * z);
      maxReach = Math.max(maxReach, centerDistance + radius);
    }

    return Math.max(1200, maxReach + 700);
  }, [islands]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code === "KeyW" ||
        event.code === "ArrowUp" ||
        event.code === "KeyS" ||
        event.code === "ArrowDown" ||
        event.code === "KeyA" ||
        event.code === "ArrowLeft" ||
        event.code === "KeyD" ||
        event.code === "ArrowRight" ||
        event.code === "Space" ||
        event.code === "KeyE" ||
        event.code === "ShiftLeft" ||
        event.code === "ShiftRight" ||
        event.code === "KeyQ"
      ) {
        event.preventDefault();
      }
      if (event.repeat) return;
      if (event.code === "KeyW" || event.code === "ArrowUp") controls.current.forward = true;
      if (event.code === "KeyS" || event.code === "ArrowDown") controls.current.backward = true;
      if (event.code === "KeyA" || event.code === "ArrowLeft") controls.current.left = true;
      if (event.code === "KeyD" || event.code === "ArrowRight") controls.current.right = true;
      if (event.code === "Space" || event.code === "KeyE") controls.current.up = true;
      if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.code === "KeyQ") controls.current.down = true;
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.code === "KeyW" ||
        event.code === "ArrowUp" ||
        event.code === "KeyS" ||
        event.code === "ArrowDown" ||
        event.code === "KeyA" ||
        event.code === "ArrowLeft" ||
        event.code === "KeyD" ||
        event.code === "ArrowRight" ||
        event.code === "Space" ||
        event.code === "KeyE" ||
        event.code === "ShiftLeft" ||
        event.code === "ShiftRight" ||
        event.code === "KeyQ"
      ) {
        event.preventDefault();
      }
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

    // Enter Space Explore from the white hole exit so the player emerges into the scene.
    const startPos = WHITE_HOLE_EXIT_POSITION.clone().add(
      WHITE_HOLE_EXIT_DIRECTION.clone().multiplyScalar(8)
    );
    const startDir = WHITE_HOLE_EXIT_DIRECTION.clone();
    const startCam = startPos
      .clone()
      .add(new THREE.Vector3(0, followOffset.current.y, followOffset.current.z));
    const startLook = startPos.clone().addScaledVector(startDir, lookAheadDistance.current);
    startLook.y += 0.45;

    position.current.copy(startPos);
    velocity.current.set(0, 0, 0);
    lockedViewDir.current.copy(startDir);
    stateRef.current.active = true;
    stateRef.current.position.copy(startPos);
    stateRef.current.forward.copy(startDir);
    desiredCamera.current.copy(startCam);
    desiredLook.current.copy(startLook);

    camera.position.copy(startCam);
    camera.lookAt(startLook);

    if (balloonRef.current) {
      balloonRef.current.position.copy(startPos);
      balloonRef.current.rotation.set(0, 0, 0);
    }
  }, [enabled, controlsRef, camera, bounds, stateRef, startIsland]);

  useFrame((state, delta) => {
    const controlsInstance = controlsRef.current as { enabled: boolean; target: THREE.Vector3; update: () => void } | null;

    if (!enabled) {
      if (controlsInstance) controlsInstance.enabled = true;
      if (balloonRef.current) balloonRef.current.visible = false;
      stateRef.current.active = false;
      if (onStateChange) {
        onStateChange({
          active: false,
          position: [
            stateRef.current.position.x,
            stateRef.current.position.y,
            stateRef.current.position.z,
          ],
          forward: [
            stateRef.current.forward.x,
            stateRef.current.forward.y,
            stateRef.current.forward.z,
          ],
        });
      }
      return;
    }

    if (controlsInstance) controlsInstance.enabled = false;
    if (balloonRef.current) balloonRef.current.visible = true;
    stateRef.current.active = true;

    const direction = new THREE.Vector3();
    const forward = lockedViewDir.current.clone();
    const right = new THREE.Vector3()
      .crossVectors(forward, new THREE.Vector3(0, 1, 0))
      .normalize();
    direction
      .addScaledVector(forward, Number(controls.current.forward) - Number(controls.current.backward))
      .addScaledVector(right, Number(controls.current.right) - Number(controls.current.left))
      .addScaledVector(new THREE.Vector3(0, 1, 0), Number(controls.current.up) - Number(controls.current.down));

    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(58);
      velocity.current.lerp(direction, 1 - Math.exp(-4.8 * delta));
    } else {
      velocity.current.multiplyScalar(Math.exp(-3.2 * delta));
    }

    position.current.addScaledVector(velocity.current, delta);
    position.current.x = THREE.MathUtils.clamp(position.current.x, -bounds, bounds);
    position.current.y = THREE.MathUtils.clamp(position.current.y, -bounds * 0.9, bounds * 0.9);
    position.current.z = THREE.MathUtils.clamp(position.current.z, -bounds, bounds);

    if (
      state.clock.elapsedTime >= wormholeCooldownUntil.current &&
      position.current.distanceTo(BLACK_HOLE_CENTER) <= BLACK_HOLE_EVENT_HORIZON
    ) {
      position.current.copy(WHITE_HOLE_EXIT_POSITION);
      velocity.current.copy(WHITE_HOLE_EXIT_DIRECTION).multiplyScalar(12);
      lockedViewDir.current.copy(WHITE_HOLE_EXIT_DIRECTION);
      wormholeCooldownUntil.current = state.clock.elapsedTime + 2.4;
    }

    const yaw = Math.atan2(lockedViewDir.current.x, lockedViewDir.current.z);
    const pitch = -lockedViewDir.current.y * 0.1;
    const lateralVelocity = velocity.current.dot(right);
    const bankTarget = Math.abs(lateralVelocity) < 0.35 ? 0 : lateralVelocity * 0.015;

    if (balloonRef.current) {
      balloonRef.current.position.copy(position.current);
      balloonRef.current.rotation.y = THREE.MathUtils.damp(balloonRef.current.rotation.y, yaw, 8, delta);
      balloonRef.current.rotation.x = THREE.MathUtils.damp(balloonRef.current.rotation.x, pitch, 8, delta);
      balloonRef.current.rotation.z = THREE.MathUtils.damp(
        balloonRef.current.rotation.z,
        bankTarget,
        8,
        delta
      );
    }

    stateRef.current.position.copy(position.current);
    stateRef.current.forward.copy(lockedViewDir.current);

    if (onStateChange && state.clock.elapsedTime - lastBroadcastAt.current >= 0.25) {
      lastBroadcastAt.current = state.clock.elapsedTime;
      onStateChange({
        active: true,
        position: [position.current.x, position.current.y, position.current.z],
        forward: [
          lockedViewDir.current.x,
          lockedViewDir.current.y,
          lockedViewDir.current.z,
        ],
      });
    }

    desiredCamera.current
      .copy(position.current)
      .addScaledVector(lockedViewDir.current, -followOffset.current.z)
      .add(new THREE.Vector3(0, followOffset.current.y, 0));
    desiredLook.current
      .copy(position.current)
      .addScaledVector(lockedViewDir.current, lookAheadDistance.current);
    desiredLook.current.y += 0.45;

    camera.position.lerp(desiredCamera.current, 1 - Math.exp(-9 * delta));
    camera.lookAt(desiredLook.current);
  });

  return enabled ? <Balloon balloonRef={balloonRef} /> : null;
}

function BattleProjectileBolt({
  projectile,
}: {
  projectile: BattleProjectile;
}) {
  const ref = useRef<THREE.Mesh | null>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const elapsed = clock.elapsedTime - projectile.spawnAt;
    const t = THREE.MathUtils.clamp(elapsed / projectile.duration, 0, 1);
    ref.current.position.lerpVectors(projectile.start, projectile.end, t);
    const scale = 0.55 + Math.sin(t * Math.PI) * 1.4;
    ref.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={ref} position={projectile.start.toArray() as [number, number, number]}>
      <sphereGeometry args={[0.85, 12, 12]} />
      <meshBasicMaterial
        color={projectile.team === "player" ? "#f9d66d" : "#ff6b9f"}
        toneMapped={false}
      />
    </mesh>
  );
}

function RemoteBalloon({ player }: { player: MultiplayerPlayerState }) {
  const balloonRef = useRef<THREE.Group | null>(null);
  const forward = useMemo(
    () => new THREE.Vector3(...player.forward).normalize(),
    [player.forward]
  );
  const yaw = Math.atan2(forward.x, forward.z);
  const pitch = -forward.y * 0.1;

  useEffect(() => {
    if (!balloonRef.current) return;
    balloonRef.current.position.set(...player.position);
    balloonRef.current.rotation.set(pitch, yaw, 0);
  }, [pitch, player.position, yaw]);

  return (
    <>
      <Balloon balloonRef={balloonRef} />
      <group position={[player.position[0], player.position[1] + 4.8, player.position[2]]}>
        <Html center transform={false} occlude={false} zIndexRange={[180, 0]}>
          <div className="pointer-events-none -translate-y-4 rounded-md border border-cyan-300/30 bg-[#07111f]/88 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
            {player.label}
          </div>
        </Html>
      </group>
    </>
  );
}

function BattleHealthTag({
  label,
  hp,
  maxHp,
  colorClass,
  getWorldPosition,
  widthClass = "w-36",
  compact = true,
}: {
  label: string;
  hp: number;
  maxHp: number;
  colorClass: string;
  getWorldPosition: () => THREE.Vector3;
  widthClass?: string;
  compact?: boolean;
}) {
  const groupRef = useRef<THREE.Group | null>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(getWorldPosition());
  });

  return (
    <group ref={groupRef}>
      <Html center transform={false} occlude={false} zIndexRange={[200, 0]}>
        <div className="pointer-events-none -translate-y-6">
          <div className="inline-flex min-w-[112px] flex-col items-center gap-1 rounded-md border border-black/70 bg-black/82 px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
            {!compact && (
              <div className="max-w-[120px] truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {label}
              </div>
            )}
            <div className={`h-3 ${widthClass} overflow-hidden rounded-sm border border-white/10 bg-[#1a1d2a]`}>
              <div
                className={`h-full rounded-[2px] ${colorClass}`}
                style={{ width: `${(hp / maxHp) * 100}%` }}
              />
            </div>
            <div className="text-[10px] font-semibold leading-none text-white/90">
              {hp}/{maxHp}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

function SpaceBattleController({
  playerIsland,
  targetIsland,
  balloonStateRef,
  onBattleFinished,
}: {
  playerIsland: ArchipelagoIsland;
  targetIsland: ArchipelagoIsland;
  balloonStateRef: React.RefObject<BalloonExploreState>;
  onBattleFinished: () => void;
}) {
  const playerStats = useMemo(() => summarizeCombatStats(playerIsland.data), [playerIsland.data]);
  const enemyStats = useMemo(() => summarizeCombatStats(targetIsland.data), [targetIsland.data]);
  const [projectiles, setProjectiles] = useState<BattleProjectile[]>([]);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [playerHp, setPlayerHp] = useState(playerStats.maxHp);
  const [enemyHp, setEnemyHp] = useState(enemyStats.maxHp);
  const playerHpRef = useRef(playerStats.maxHp);
  const enemyHpRef = useRef(enemyStats.maxHp);
  const playerCooldownUntil = useRef(0.35);
  const enemyCooldownUntil = useRef(0.75);
  const resultTimeoutAt = useRef<number | null>(null);
  const targetImpactPoint = useMemo(
    () => new THREE.Vector3(...targetIsland.position).add(new THREE.Vector3(0, 6, 0)),
    [targetIsland.position]
  );
  const targetHealthPosition = useMemo(() => {
    const layout = targetIsland.layout as OrbitalLayout | undefined;
    const outerRadius = layout?.outerRadius ?? 32;
    return new THREE.Vector3(...targetIsland.position).add(
      new THREE.Vector3(0, Math.max(outerRadius * 0.52, 7.5), 0)
    );
  }, [targetIsland.layout, targetIsland.position]);

  useFrame((state) => {
    if (result) {
      if (resultTimeoutAt.current !== null && state.clock.elapsedTime >= resultTimeoutAt.current) {
        resultTimeoutAt.current = null;
        onBattleFinished();
      }
      return;
    }
    if (!balloonStateRef.current.active) return;

    const now = state.clock.elapsedTime;
    const shipOrigin = balloonStateRef.current.position.clone();
    const shipHitPoint = shipOrigin.clone().add(new THREE.Vector3(0, 0.6, 0));

    if (now >= playerCooldownUntil.current) {
      const playerDamage = Math.round(
        playerStats.attackPower * (0.92 + Math.sin(now * 2.2) * 0.18)
      );
      playerCooldownUntil.current = now + playerStats.cooldown;
      setProjectiles((prev) => [
        ...prev,
        {
          id: `p-${now}`,
          team: "player",
          damage: playerDamage,
          targetKind: "enemy",
          start: shipOrigin.clone().add(new THREE.Vector3(0, 0.6, 0)),
          end: targetImpactPoint.clone(),
          spawnAt: now,
          duration: 0.42,
          hitRadius: 8.5,
        },
      ]);
    }

    if (!result && now >= enemyCooldownUntil.current) {
      const enemyDamage = Math.round(
        enemyStats.attackPower * (0.88 + Math.abs(Math.cos(now * 1.8)) * 0.24)
      );
      enemyCooldownUntil.current = now + enemyStats.cooldown;
      setProjectiles((prev) => [
        ...prev,
        {
          id: `e-${now}`,
          team: "enemy",
          damage: enemyDamage,
          targetKind: "player",
          start: targetImpactPoint.clone(),
          end: shipHitPoint.clone(),
          spawnAt: now,
          duration: 0.62,
          hitRadius: 4.5,
        },
      ]);
    }

    setProjectiles((prev) =>
      prev.filter((projectile) => {
        const elapsed = now - projectile.spawnAt;
        if (elapsed < projectile.duration) return true;

        if (projectile.targetKind === "enemy") {
          enemyHpRef.current = Math.max(0, enemyHpRef.current - projectile.damage);
          setEnemyHp(enemyHpRef.current);
          if (enemyHpRef.current <= 0) {
            setResult("win");
            resultTimeoutAt.current = now + 2.2;
          }
          return false;
        }

        const playerHitDistance = balloonStateRef.current.position
          .clone()
          .add(new THREE.Vector3(0, 0.6, 0))
          .distanceTo(projectile.end);

        if (playerHitDistance <= projectile.hitRadius) {
          playerHpRef.current = Math.max(0, playerHpRef.current - projectile.damage);
          setPlayerHp(playerHpRef.current);
          if (playerHpRef.current <= 0) {
            setResult("lose");
            resultTimeoutAt.current = now + 2.2;
          }
        }

        return false;
      })
    );
  });

  return (
    <>
      {projectiles.map((projectile) => (
        <BattleProjectileBolt key={projectile.id} projectile={projectile} />
      ))}

      <BattleHealthTag
        label="UFO"
        hp={playerHp}
        maxHp={playerStats.maxHp}
        colorClass="bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-200"
        widthClass="w-40"
        compact
        getWorldPosition={() =>
          balloonStateRef.current.position.clone().add(new THREE.Vector3(0, 4.8, 0))
        }
      />
      <BattleHealthTag
        label={targetIsland.label}
        hp={enemyHp}
        maxHp={enemyStats.maxHp}
        colorClass="bg-gradient-to-r from-rose-400 via-orange-300 to-amber-200"
        widthClass="w-40"
        compact
        getWorldPosition={() => targetHealthPosition.clone()}
      />

      <Html fullscreen>
        <div className="pointer-events-none absolute inset-0 z-[68]">
          <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full border border-white/10 bg-[#0b0d16]/70 px-5 py-3 text-[11px] uppercase tracking-[0.32em] text-white/55 shadow-2xl backdrop-blur-md">
            {playerIsland.label} attacking {targetIsland.label}
          </div>

          {result && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`rounded-[32px] border px-16 py-10 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-md ${
                  result === "win"
                    ? "border-emerald-200/25 bg-emerald-300/14 text-emerald-50"
                    : "border-rose-200/25 bg-rose-400/14 text-rose-50"
                }`}
              >
                <div className="text-[13px] uppercase tracking-[0.55em] text-white/45">
                  Battle Result
                </div>
                <div className="mt-4 text-7xl font-black tracking-[0.18em]">
                  {result === "win" ? "WIN" : "LOSE"}
                </div>
              </div>
            </div>
          )}
        </div>
      </Html>
    </>
  );
}

function CameraFocusController({
  enabled,
  controlsRef,
  selectedIsland,
  focusActiveRef,
  focusRequestKey,
}: {
  enabled: boolean;
  controlsRef: React.RefObject<unknown>;
  selectedIsland: ArchipelagoIsland | null;
  focusActiveRef: React.RefObject<boolean>;
  focusRequestKey: number;
}) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const lastFocusKey = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !selectedIsland) {
      focusActiveRef.current = false;
      lastFocusKey.current = null;
      return;
    }

    const nextFocusKey = `${selectedIsland.id}:${focusRequestKey}`;
    if (lastFocusKey.current === nextFocusKey) return;
    lastFocusKey.current = nextFocusKey;

    const controlsInstance = controlsRef.current as {
      target: THREE.Vector3;
      update: () => void;
    } | null;

    const layout = selectedIsland.layout as OrbitalLayout | undefined;
    const focusRadius = layout?.outerRadius ?? 40;
    const islandCenter = new THREE.Vector3(...selectedIsland.position);
    const approachDirection = camera.position.clone().sub(islandCenter).normalize();
    if (approachDirection.lengthSq() < 0.0001) {
      approachDirection.set(0.62, 0.42, 0.82).normalize();
    }

    targetLookAt.current.copy(islandCenter);
    targetPosition.current
      .copy(islandCenter)
      .addScaledVector(approachDirection, Math.max(focusRadius * 2.1, 68))
      .add(new THREE.Vector3(0, Math.max(focusRadius * 0.3, 10), 0));

    focusActiveRef.current = true;

    if (controlsInstance) controlsInstance.update();
  }, [camera.position, controlsRef, enabled, focusActiveRef, focusRequestKey, selectedIsland]);

  useFrame((_, delta) => {
    if (!enabled || !selectedIsland || !focusActiveRef.current) return;

    const controlsInstance = controlsRef.current as {
      target: THREE.Vector3;
      update: () => void;
    } | null;

    camera.position.lerp(targetPosition.current, 1 - Math.exp(-4.8 * delta));
    if (controlsInstance) {
      controlsInstance.target.lerp(targetLookAt.current, 1 - Math.exp(-5.5 * delta));
      controlsInstance.update();
    } else {
      camera.lookAt(targetLookAt.current);
    }

    const cameraSettled = camera.position.distanceTo(targetPosition.current) < 0.35;
    const targetSettled =
      !controlsInstance || controlsInstance.target.distanceTo(targetLookAt.current) < 0.35;

    if (cameraSettled && targetSettled) {
      if (controlsInstance) {
        controlsInstance.target.copy(targetLookAt.current);
        controlsInstance.update();
      }
      focusActiveRef.current = false;
    }
  });

  return null;
}

// ─── Main Canvas ──────────────────────────────────────────────

interface IslandCanvasProps {
  islands: ArchipelagoIsland[];
  selectedIslandId: string | null;
  onIslandSelect: (id: string | null) => void;
  onCategoryClick?: (categoryId: string) => void;
  balloonMode?: boolean;
  activeCategoryId?: string | null;
  focusRequestKey?: number;
  playerIslandId?: string | null;
  battleActive?: boolean;
  battleSessionKey?: number;
  battlePlayerIslandId?: string | null;
  battleTargetIslandId?: string | null;
  onBattleFinished?: () => void;
  remotePlayers?: MultiplayerPlayerState[];
  onBalloonStateChange?: (state: BalloonStateSnapshot) => void;
}

export default function IslandCanvas({
  islands,
  selectedIslandId,
  onIslandSelect,
  onCategoryClick,
  balloonMode = false,
  activeCategoryId,
  focusRequestKey = 0,
  playerIslandId = null,
  battleActive = false,
  battleSessionKey = 0,
  battlePlayerIslandId = null,
  battleTargetIslandId = null,
  onBattleFinished,
  remotePlayers = [],
  onBalloonStateChange,
}: IslandCanvasProps) {
  const outerRadius = useMemo(() => {
    if (islands.length === 0) return 40;
    const layout = islands[0]?.layout as OrbitalLayout | undefined;
    return layout?.outerRadius ?? 40;
  }, [islands]);

  const cameraDistance = outerRadius * 2.15;
  const controlsRef = useRef<unknown>(null);
  const focusActiveRef = useRef(false);
  const balloonStateRef = useRef<BalloonExploreState>({
    active: false,
    position: new THREE.Vector3(0, 10, 50),
    forward: new THREE.Vector3(0, 0, -1),
  });
  const selectedIsland = useMemo(
    () => islands.find((island) => island.id === selectedIslandId) ?? null,
    [islands, selectedIslandId]
  );
  const battlePlayerIsland = useMemo(
    () => islands.find((island) => island.id === battlePlayerIslandId) ?? null,
    [battlePlayerIslandId, islands]
  );
  const exploreStartIsland = useMemo(
    () => islands.find((island) => island.id === playerIslandId) ?? null,
    [islands, playerIslandId]
  );
  const battleTargetIsland = useMemo(
    () => islands.find((island) => island.id === battleTargetIslandId) ?? null,
    [battleTargetIslandId, islands]
  );

  return (
    <Canvas
      camera={{
        position: [cameraDistance * 0.62, cameraDistance * 0.72, cameraDistance * 0.92],
        fov: 50,
        near: 0.1,
        far: 2400,
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
        <BackgroundSet />
      </Suspense>
      <Stars radius={980} depth={520} count={7000} factor={2.6} saturation={0.18} fade speed={0.38} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[24, 40, 12]} intensity={0.8} color="#dbeafe" />

      <Suspense fallback={null}>
        {islands.map((island) => (
          <ClickableIsland
            key={island.id}
            island={island}
            selected={island.id === selectedIslandId}
            onSelect={() => onIslandSelect(island.id)}
            onCategoryClick={onCategoryClick}
            categoryInteractionDisabled={balloonMode}
            activeCategoryId={activeCategoryId}
          />
        ))}
      </Suspense>

        <BalloonPilot
          enabled={balloonMode}
          controlsRef={controlsRef}
          islands={islands}
          stateRef={balloonStateRef}
          startIsland={exploreStartIsland}
          onStateChange={onBalloonStateChange}
        />

        {remotePlayers.map((player) => (
          <RemoteBalloon key={player.playerId} player={player} />
        ))}

      {balloonMode && battleActive && battlePlayerIsland && battleTargetIsland && (
        <SpaceBattleController
          key={`${battleSessionKey}-${battlePlayerIsland.id}-${battleTargetIsland.id}`}
          playerIsland={battlePlayerIsland}
          targetIsland={battleTargetIsland}
          balloonStateRef={balloonStateRef}
          onBattleFinished={onBattleFinished ?? (() => {})}
        />
      )}

      <CameraFocusController
        enabled={!balloonMode}
        controlsRef={controlsRef}
        selectedIsland={selectedIsland}
        focusActiveRef={focusActiveRef}
        focusRequestKey={focusRequestKey}
      />

      <OrbitControls
        ref={controlsRef as React.RefObject<null>}
        enablePan={!balloonMode}
        enableZoom
        enableRotate={!balloonMode}
        minDistance={18}
        maxDistance={240}
        target={[0, 0, 0]}
        onStart={() => {
          focusActiveRef.current = false;
        }}
      />

      <EffectComposer>
        <Bloom intensity={0.8} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
