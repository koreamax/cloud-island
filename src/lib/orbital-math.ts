/**
 * Shared math for tilted orbital positions (atom-style electron orbits).
 * Used by InstancedSatellites, SatelliteTrails, SatelliteErrors, and orbital-layout.
 */

/**
 * Compute 3D position on a tilted orbital plane.
 * Applies Rx(inclination) then Ry(ascendingNode) to a flat circle point.
 */
export function tiltedOrbitPosition(
  angle: number,
  radius: number,
  inclination: number,
  ascendingNode: number,
): [number, number, number] {
  const flatX = Math.cos(angle) * radius;
  const flatZ = Math.sin(angle) * radius;

  // Rotate around X by inclination
  const sinI = Math.sin(inclination);
  const cosI = Math.cos(inclination);
  const tiltedX = flatX;
  const tiltedY = flatZ * sinI;
  const tiltedZ = flatZ * cosI;

  // Rotate around Y by ascending node
  const sinA = Math.sin(ascendingNode);
  const cosA = Math.cos(ascendingNode);
  const x = tiltedX * cosA + tiltedZ * sinA;
  const y = tiltedY;
  const z = -tiltedX * sinA + tiltedZ * cosA;

  return [x, y, z];
}
