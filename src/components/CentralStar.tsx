"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CentralStar as CentralStarType } from "@/lib/cloud-island";

interface CentralStarProps {
  star: CentralStarType;
}

// ─── Corona ray shader ──────────────────────────────────────

const coronaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const coronaFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);
    float angle = atan(center.y, center.x);

    // Radial corona rays
    float rays = 0.0;
    for (float i = 0.0; i < 3.0; i++) {
      float freq = 6.0 + i * 4.0;
      float speed = 0.3 + i * 0.15;
      float n = noise(vec2(angle * freq + uTime * speed, dist * 3.0 + uTime * 0.2));
      rays += n * (0.4 - i * 0.1);
    }

    // Radial falloff
    float corona = (1.0 - smoothstep(0.05, 0.48, dist)) * rays;

    // Flare spikes (4 main spikes rotating slowly)
    float spikes = 0.0;
    for (float i = 0.0; i < 4.0; i++) {
      float spikeAngle = angle + i * 1.5708 + uTime * 0.1;
      float spike = pow(abs(cos(spikeAngle * 2.0)), 40.0);
      spike *= (1.0 - smoothstep(0.0, 0.45, dist));
      spikes += spike * 0.3;
    }

    float alpha = (corona + spikes) * uIntensity;
    vec3 color = uColor * 1.5;

    gl_FragColor = vec4(color, alpha * 0.7);
  }
`;

export default function CentralStar({ star }: CentralStarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const coronaRef = useRef<THREE.ShaderMaterial>(null);

  const coreColor = star.healthRatio > 0.8 ? "#FFD700" : star.healthRatio > 0.5 ? "#FFA500" : "#FF6347";
  const glowColor = star.healthRatio > 0.8 ? "#FFF5CC" : "#FFE0B2";

  const coronaMaterial = useMemo(() => {
    const c = new THREE.Color(coreColor);
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: c },
        uIntensity: { value: star.pulseIntensity * 0.8 + 0.4 },
      },
      vertexShader: coronaVertex,
      fragmentShader: coronaFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [coreColor, star.pulseIntensity]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 2) * 0.03 * star.pulseIntensity;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(pulse);
    }

    if (innerRef.current) {
      const mat = innerRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(t * 3) * 0.3 * star.pulseIntensity;
    }

    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(t * 2.5) * 0.05;
    }

    if (lightRef.current) {
      lightRef.current.intensity = 2 + Math.sin(t * 2) * 0.5 * star.pulseIntensity;
    }

    if (coronaRef.current) {
      coronaRef.current.uniforms.uTime.value = t;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Inner core sphere */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[star.radius, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={1.5}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>

      {/* Corona billboard — procedural rays */}
      <mesh rotation={[0, 0, 0]}>
        <planeGeometry args={[star.radius * 6, star.radius * 6]} />
        <shaderMaterial
          ref={coronaRef}
          attach="material"
          args={[{
            uniforms: coronaMaterial.uniforms,
            vertexShader: coronaVertex,
            fragmentShader: coronaFragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }]}
        />
      </mesh>

      {/* Second corona plane (perpendicular) */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[star.radius * 6, star.radius * 6]} />
        <shaderMaterial
          attach="material"
          args={[{
            uniforms: coronaMaterial.uniforms,
            vertexShader: coronaVertex,
            fragmentShader: coronaFragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }]}
        />
      </mesh>

      {/* Outer glow layer */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[star.radius * 1.4, 32, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Second glow layer (softer, larger) */}
      <mesh>
        <sphereGeometry args={[star.radius * 2.0, 24, 24]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Third glow (corona haze) */}
      <mesh>
        <sphereGeometry args={[star.radius * 3.0, 24, 24]} />
        <meshBasicMaterial
          color={coreColor}
          transparent
          opacity={0.025}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light for illumination */}
      <pointLight
        ref={lightRef}
        color={coreColor}
        intensity={2}
        distance={120}
        decay={1.5}
      />
    </group>
  );
}
