"use client";

import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Stars } from "@react-three/drei";
import * as THREE from "three";
import IslandScene from "./IslandScene";
import type { IslandLayout } from "@/lib/cloud-island";
import { generateIslandLayout } from "@/lib/island-layout";
import { MOCK_ISLAND_DATA } from "@/lib/mock-data";

type ControlState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
};

function SkyShell() {
  const geometry = useMemo(() => new THREE.SphereGeometry(260, 48, 48), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {},
        side: THREE.BackSide,
        depthWrite: false,
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
            float h = normalize(vWorldPos).y * 0.5 + 0.5;
            vec3 dusk = vec3(0.99, 0.54, 0.33);
            vec3 mid = vec3(0.49, 0.69, 0.95);
            vec3 zenith = vec3(0.06, 0.11, 0.24);
            vec3 color = h < 0.42
              ? mix(dusk, mid, h / 0.42)
              : mix(mid, zenith, (h - 0.42) / 0.58);
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    []
  );

  return <mesh geometry={geometry} material={material} renderOrder={-1} />;
}

function Balloon({
  positionRef,
  velocityRef,
}: {
  positionRef: RefObject<THREE.Vector3 | null>;
  velocityRef: RefObject<THREE.Vector3 | null>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !positionRef.current || !velocityRef.current) return;

    const bob = Math.sin(clock.elapsedTime * 1.7) * 0.3;
    groupRef.current.position.set(
      positionRef.current.x,
      positionRef.current.y + bob,
      positionRef.current.z
    );
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      -velocityRef.current.x * 0.06,
      0.08
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      velocityRef.current.z * 0.04,
      0.08
    );
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 2.8, 0]}>
        <sphereGeometry args={[2.4, 24, 24]} />
        <meshStandardMaterial color="#f97316" emissive="#7c2d12" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.2, 0.8, 1.2]} />
        <meshStandardMaterial color="#7c4a21" />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 2.2, 8]} />
        <meshStandardMaterial color="#d6c2a1" />
      </mesh>
      <mesh position={[0.6, 1.35, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 6]} />
        <meshStandardMaterial color="#d6c2a1" />
      </mesh>
      <mesh position={[-0.6, 1.35, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 6]} />
        <meshStandardMaterial color="#d6c2a1" />
      </mesh>
      <mesh position={[0, 1.35, 0.6]}>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 6]} />
        <meshStandardMaterial color="#d6c2a1" />
      </mesh>
      <mesh position={[0, 1.35, -0.6]}>
        <cylinderGeometry args={[0.08, 0.08, 2.2, 6]} />
        <meshStandardMaterial color="#d6c2a1" />
      </mesh>
    </group>
  );
}

function ExplorerScene({ layout }: { layout: IslandLayout }) {
  const { camera } = useThree();
  const balloonPosition = useRef<THREE.Vector3 | null>(new THREE.Vector3(0, 18, 36));
  const balloonVelocity = useRef<THREE.Vector3 | null>(new THREE.Vector3());
  const controls = useRef<ControlState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  useEffect(() => {
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
  }, []);

  useFrame((state, delta) => {
    if (!balloonPosition.current || !balloonVelocity.current) return;

    const direction = new THREE.Vector3(
      Number(controls.current.right) - Number(controls.current.left),
      Number(controls.current.up) - Number(controls.current.down),
      Number(controls.current.backward) - Number(controls.current.forward)
    );

    if (direction.lengthSq() > 0) {
      direction.normalize().multiplyScalar(18 * delta);
      balloonVelocity.current.lerp(direction, 0.16);
    } else {
      balloonVelocity.current.multiplyScalar(0.92);
    }

    balloonPosition.current.add(balloonVelocity.current);
    balloonPosition.current.x = THREE.MathUtils.clamp(balloonPosition.current.x, -80, 80);
    balloonPosition.current.y = THREE.MathUtils.clamp(balloonPosition.current.y, 8, 46);
    balloonPosition.current.z = THREE.MathUtils.clamp(balloonPosition.current.z, -80, 80);

    const lookAhead = balloonPosition.current.clone().add(
      new THREE.Vector3(
        balloonVelocity.current.x * 6,
        -2.5,
        balloonVelocity.current.z * 6
      )
    );

    const desiredCamera = balloonPosition.current.clone().add(
      new THREE.Vector3(0, 6 + Math.sin(state.clock.elapsedTime * 0.6) * 0.4, 16)
    );

    camera.position.lerp(desiredCamera, 0.08);
    camera.lookAt(lookAhead);
  });

  return (
    <>
      <fog attach="fog" args={["#87b8f8", 65, 180]} />
      <SkyShell />
      <Stars radius={140} depth={30} count={1800} factor={4} saturation={0} fade speed={0.35} />
      <ambientLight intensity={1.3} color="#fff1db" />
      <directionalLight position={[25, 40, 20]} intensity={2.3} color="#fff8ee" />
      <directionalLight position={[-15, 12, -12]} intensity={0.5} color="#8db8ff" />
      <hemisphereLight args={["#dbeafe", "#ffe7c2", 0.9]} />

      <group position={[0, -7, 0]}>
        <IslandScene layout={layout} />
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -7.2, 0]}>
        <circleGeometry args={[layout.radius + 12, 64]} />
        <meshStandardMaterial color="#f5dcc1" transparent opacity={0.85} />
      </mesh>

      <Balloon positionRef={balloonPosition} velocityRef={balloonVelocity} />

      <Html position={[0, 26, -18]} center>
        <div className="rounded-2xl border border-white/30 bg-[#08111fcc] px-4 py-3 text-center text-white shadow-2xl backdrop-blur-md">
          <div className="text-xs uppercase tracking-[0.35em] text-orange-200/80">Balloon Route</div>
          <div className="mt-1 text-sm text-white/80">WASD / Arrow Keys to drift</div>
          <div className="text-xs text-white/55">Space or E up, Shift or Q down</div>
        </div>
      </Html>
    </>
  );
}

interface BalloonExplorerCanvasProps {
  layout?: IslandLayout;
}

export default function BalloonExplorerCanvas({ layout }: BalloonExplorerCanvasProps) {
  const fallbackLayout = useMemo(() => generateIslandLayout(MOCK_ISLAND_DATA), []);
  const sceneLayout = layout ?? fallbackLayout;

  return (
    <Canvas
      camera={{ position: [0, 24, 42], fov: 52, near: 0.1, far: 400 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <ExplorerScene layout={sceneLayout} />
      </Suspense>
    </Canvas>
  );
}
