/**
 * Registered 3D scenes for the spatial engine.
 *
 * A scene is a typed, deterministic function of bounded numbers. The planner may
 * only name a `sceneId` from this registry; geometry and physics are computed
 * here and in the browser from the same exported functions, never from model output.
 */
import { visualLabError, type SpatialScenario } from './types';

export interface SpatialParameterSpec {
  key: 'speed' | 'elevation' | 'heading' | 'gravity';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  description: string;
}

export interface ProjectileValues {
  speed: number;
  elevation: number;
  heading: number;
  gravity: number;
}

export interface ProjectileOutput {
  timeOfFlight: number;
  range: number;
  maxHeight: number;
  /** Landing point on the ground plane (x east, z south, metres). */
  landing: { x: number; z: number };
  apex: { x: number; y: number; z: number };
}

export interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  z: number;
}

export const PROJECTILE_3D = {
  id: 'projectile_3d',
  label: '3D projectile motion',
  concept: 'Projectile motion in three dimensions',
  objective:
    'Predict how launch speed, elevation, heading and gravity change the range, peak height and flight time of a projectile',
  parameters: [
    {
      key: 'speed',
      label: 'Launch speed',
      unit: 'm/s',
      min: 5,
      max: 50,
      step: 1,
      description: 'Speed at the moment of launch'
    },
    {
      key: 'elevation',
      label: 'Elevation angle',
      unit: '°',
      min: 5,
      max: 85,
      step: 1,
      description: 'Angle above the horizontal'
    },
    {
      key: 'heading',
      label: 'Heading',
      unit: '°',
      min: 0,
      max: 359,
      step: 1,
      description: 'Compass-style direction on the ground plane'
    },
    {
      key: 'gravity',
      label: 'Gravity',
      unit: 'm/s²',
      min: 1.5,
      max: 25,
      step: 0.1,
      description: 'Surface gravity (Moon 1.6, Mars 3.7, Earth 9.8, Jupiter 24.8)'
    }
  ] as readonly SpatialParameterSpec[],
  defaults: { speed: 25, elevation: 45, heading: 30, gravity: 9.8 } as ProjectileValues,
  guidance: {
    predictionPrompt:
      'You launch at 25 m/s. Which elevation sends the projectile farthest: 30°, 45° or 60°? Predict before you try.',
    hint: 'Keep speed and gravity fixed and only change the elevation. Compare the range at 30° and 60°, then try 45°.',
    observationPrompt:
      'Describe how the range and peak height each change when you raise the elevation, using your own numbers.'
  }
} as const;

const DEG = Math.PI / 180;

/** Ideal (no air resistance) projectile launched from and landing on level ground. */
export function projectileOutput(values: ProjectileValues): ProjectileOutput {
  const { speed, elevation, heading, gravity } = values;
  const theta = elevation * DEG;
  const phi = heading * DEG;
  const timeOfFlight = (2 * speed * Math.sin(theta)) / gravity;
  const range = (speed * speed * Math.sin(2 * theta)) / gravity;
  const maxHeight = (speed * speed * Math.sin(theta) ** 2) / (2 * gravity);
  return {
    timeOfFlight,
    range,
    maxHeight,
    landing: { x: range * Math.cos(phi), z: range * Math.sin(phi) },
    apex: { x: (range / 2) * Math.cos(phi), y: maxHeight, z: (range / 2) * Math.sin(phi) }
  };
}

/** Sampled path: pure function of the values, identical on server and client. */
export function projectileTrajectory(values: ProjectileValues, samples = 64): TrajectoryPoint[] {
  const { speed, elevation, heading, gravity } = values;
  const theta = elevation * DEG;
  const phi = heading * DEG;
  const total = (2 * speed * Math.sin(theta)) / gravity;
  const horizontal = speed * Math.cos(theta);
  return Array.from({ length: samples + 1 }, (_, index) => {
    const t = (total * index) / samples;
    const ground = horizontal * t;
    return {
      t,
      x: ground * Math.cos(phi),
      y: Math.max(0, speed * Math.sin(theta) * t - 0.5 * gravity * t * t),
      z: ground * Math.sin(phi)
    };
  });
}

/** Round a distance up to 1, 2 or 5 × 10ⁿ so scene scale and grid labels stay readable. */
export function niceExtent(distance: number): number {
  const safe = Math.max(distance, 1);
  const magnitude = 10 ** Math.floor(Math.log10(safe));
  for (const step of [1, 2, 5, 10]) if (safe <= step * magnitude) return step * magnitude;
  return 10 * magnitude;
}

export function getSpatialScene(id: unknown) {
  if (id !== PROJECTILE_3D.id)
    throw visualLabError(
      'UNSUPPORTED_MODEL',
      `Only these spatial scenes are supported: ${PROJECTILE_3D.id}`
    );
  return PROJECTILE_3D;
}

export function parseSpatialValues(value: unknown): ProjectileValues {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw visualLabError('INVALID_SCENARIO', 'Spatial values must be an object');
  const raw = value as Record<string, unknown>;
  const keys = PROJECTILE_3D.parameters.map((spec) => spec.key);
  if (Object.keys(raw).sort().join(',') !== [...keys].sort().join(','))
    throw visualLabError('INVALID_SCENARIO', `Spatial values must be exactly: ${keys.join(', ')}`);
  const result = { speed: 0, elevation: 0, heading: 0, gravity: 0 };
  for (const spec of PROJECTILE_3D.parameters) {
    const v = raw[spec.key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < spec.min || v > spec.max)
      throw visualLabError(
        'INVALID_PARAMETER',
        `${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}`
      );
    result[spec.key] = v;
  }
  return result;
}

export function parseSpatialScenario(value: unknown): SpatialScenario {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw visualLabError('INVALID_SCENARIO', 'Spatial scenario must be an object');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).sort().join(',') !== 'sceneId,values')
    throw visualLabError('INVALID_SCENARIO', 'Spatial scenario has unsupported fields');
  const scene = getSpatialScene(raw.sceneId);
  return { sceneId: scene.id, values: parseSpatialValues(raw.values) };
}

/** Authoritative output used by guidance and by the derived understanding check. */
export function spatialOutput(scenario: SpatialScenario) {
  const values = parseSpatialValues(scenario.values);
  return { scene: getSpatialScene(scenario.sceneId), values, output: projectileOutput(values) };
}
