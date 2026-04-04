"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitalRing } from "@/lib/cloud-island";
import { tiltedOrbitPosition } from "@/lib/orbital-math";

/** Trail particles per satellite — dense enough to overlap into a continuous streak */
const TRAIL_LENGTH = 48;
/** Angular gap between each trail particle — very tight for seamless comet tail */
const TRAIL_ANGLE_STEP = 0.012;

interface SatelliteTrailsProps {
  rings: OrbitalRing[];
}

const _tmpColor = new THREE.Color();

// ─── Custom comet-tail shader ────────────────────────────────

const cometVertexShader = /* glsl */ `
  attribute float aTrailIndex;   // 0.0 = closest to satellite, 1.0 = tail end
  attribute vec3 aColor;

  varying float vTrailIndex;
  varying vec3 vColor;

  void main() {
    vTrailIndex = aTrailIndex;
    vColor = aColor;

    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

    // Size: large near satellite, tapers to nothing — creates comet shape
    float baseSize = mix(8.0, 0.5, pow(aTrailIndex, 0.6));
    gl_PointSize = baseSize * (300.0 / -mvPos.z);

    gl_Position = projectionMatrix * mvPos;
  }
`;

const cometFragmentShader = /* glsl */ `
  varying float vTrailIndex;
  varying vec3 vColor;

  void main() {
    // Circular point with soft edge
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft radial glow — gaussian-like falloff for smooth blending
    float glow = exp(-dist * dist * 8.0);

    // Opacity fades along the trail: bright head → transparent tail
    float trailFade = 1.0 - pow(vTrailIndex, 0.5);

    // Head is bright white-hot core, gradually shifts to category color
    float headMix = smoothstep(0.0, 0.3, vTrailIndex);
    vec3 core = vec3(1.0, 0.95, 0.9);
    vec3 color = mix(core, vColor, headMix);

    // Boost brightness for Bloom pickup
    color *= mix(2.0, 1.2, vTrailIndex);

    float alpha = glow * trailFade * 0.9;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function SatelliteTrails({ rings }: SatelliteTrailsProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Count total trail particles
  const totalSatellites = useMemo(() => {
    let count = 0;
    for (const ring of rings) count += ring.satellites.length;
    return count;
  }, [rings]);

  const particleCount = totalSatellites * TRAIL_LENGTH;

  // Create geometry buffers
  const { positions, colors, trailIndices } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const trail = new Float32Array(particleCount);

    let idx = 0;
    for (const ring of rings) {
      _tmpColor.set(ring.color);
      for (let s = 0; s < ring.satellites.length; s++) {
        for (let t = 0; t < TRAIL_LENGTH; t++) {
          col[idx * 3] = _tmpColor.r;
          col[idx * 3 + 1] = _tmpColor.g;
          col[idx * 3 + 2] = _tmpColor.b;
          // Normalized trail position: 0 = head, 1 = tail end
          trail[idx] = t / (TRAIL_LENGTH - 1);
          idx++;
        }
      }
    }

    return { positions: pos, colors: col, trailIndices: trail };
  }, [rings, particleCount]);

  // Shader material (memoised)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: cometVertexShader,
        fragmentShader: cometFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  // Update trail positions each frame
  useFrame(({ clock }) => {
    const points = pointsRef.current;
    if (!points || particleCount === 0) return;

    const posAttr = points.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const t = clock.getElapsedTime();

    let idx = 0;
    for (const ring of rings) {
      for (const sat of ring.satellites) {
        const currentAngle = sat.angleOffset + t * ring.orbitalSpeed;
        for (let ti = 0; ti < TRAIL_LENGTH; ti++) {
          const trailAngle = currentAngle - (ti + 1) * TRAIL_ANGLE_STEP;
          const r = ring.orbitRadius + sat.radialOffset;
          const [tx, ty, tz] = tiltedOrbitPosition(
            trailAngle, r, ring.inclination, ring.ascendingNode
          );
          arr[idx * 3] = tx;
          arr[idx * 3 + 1] = ty;
          arr[idx * 3 + 2] = tz;
          idx++;
        }
      }
    }

    posAttr.needsUpdate = true;
  });

  if (particleCount === 0) return null;

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          usage={THREE.DynamicDrawUsage}
        />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
        <bufferAttribute
          attach="attributes-aTrailIndex"
          args={[trailIndices, 1]}
        />
      </bufferGeometry>
    </points>
  );
}
