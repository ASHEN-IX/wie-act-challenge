"use client";
/**
 * Three.js scene for the registered `projectile_3d` scene.
 *
 * Every position comes from `projectileTrajectory` / `projectileOutput`, the
 * same pure functions the server uses for guidance and the understanding check.
 * Nothing here is model-authored; this component only draws.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  niceExtent,
  projectileOutput,
  projectileTrajectory,
  type ProjectileValues,
} from "@study-partner/shared/visualLab/spatial-models";

const HALF_SIZE = 8; // scene units from origin to the grid edge
const FLIGHT_SECONDS = 3.2; // wall-clock length of one replay, independent of physics time

function Projectile({
  points,
  runId,
  reduceMotion,
}: {
  points: THREE.Vector3[];
  runId: number;
  reduceMotion: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const progress = useRef(0);
  const lastRun = useRef(0);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    if (lastRun.current !== runId) {
      lastRun.current = runId;
      progress.current = reduceMotion ? 1 : 0;
    }
    if (progress.current < 1)
      progress.current = Math.min(1, progress.current + delta / FLIGHT_SECONDS);
    const position = progress.current * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(position));
    mesh.current.position.lerpVectors(
      points[index],
      points[index + 1],
      position - index,
    );
  });

  return (
    <mesh ref={mesh} position={points[0]}>
      <sphereGeometry args={[0.18, 24, 24]} />
      <meshStandardMaterial
        color="#1f4d3a"
        emissive="#1f4d3a"
        emissiveIntensity={0.25}
      />
    </mesh>
  );
}

export default function SpatialScene({
  values,
  runId,
  reduceMotion,
}: {
  values: ProjectileValues;
  runId: number;
  reduceMotion: boolean;
}) {
  const scene = useMemo(() => {
    const output = projectileOutput(values);
    const extent = niceExtent(Math.max(output.range, output.maxHeight * 1.5));
    const k = HALF_SIZE / extent;
    const path = projectileTrajectory(values, 64).map(
      (p) => new THREE.Vector3(p.x * k, p.y * k, p.z * k),
    );
    return {
      extent,
      path,
      shadow: path.map((p) => new THREE.Vector3(p.x, 0.01, p.z)),
      apex: new THREE.Vector3(
        output.apex.x * k,
        output.apex.y * k,
        output.apex.z * k,
      ),
      landing: new THREE.Vector3(
        output.landing.x * k,
        0.02,
        output.landing.z * k,
      ),
    };
  }, [values]);

  return (
    <Canvas
      camera={{ position: [12, 9, 14], fov: 42 }}
      dpr={[1, 2]}
      aria-label="Interactive 3D view of the projectile path. Drag to orbit, scroll to zoom."
      role="img"
    >
      <color attach="background" args={["#f4f6f4"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 12, 6]} intensity={1.1} />
      <gridHelper args={[HALF_SIZE * 2, 16, "#9aa59f", "#cfd6d2"]} />
      <axesHelper args={[1.5]} />
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 0.1, 24]} />
        <meshStandardMaterial color="#b45309" />
      </mesh>
      <Line points={scene.path} color="#1f4d3a" lineWidth={3} />
      <Line
        points={scene.shadow}
        color="#6b7280"
        lineWidth={1.5}
        dashed
        dashSize={0.25}
        gapSize={0.2}
      />
      <Line
        points={[
          scene.apex,
          new THREE.Vector3(scene.apex.x, 0.01, scene.apex.z),
        ]}
        color="#b45309"
        lineWidth={1}
        dashed
        dashSize={0.15}
        gapSize={0.15}
      />
      <mesh position={scene.apex}>
        <octahedronGeometry args={[0.16]} />
        <meshStandardMaterial color="#b45309" />
      </mesh>
      <mesh position={scene.landing} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.4, 32]} />
        <meshBasicMaterial color="#b91c1c" side={THREE.DoubleSide} />
      </mesh>
      <Projectile
        points={scene.path}
        runId={runId}
        reduceMotion={reduceMotion}
      />
      <OrbitControls
        enableDamping
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={6}
        maxDistance={40}
      />
    </Canvas>
  );
}
