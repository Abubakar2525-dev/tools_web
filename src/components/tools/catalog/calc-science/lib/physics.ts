/**
 * Pure physics helpers used by the calculators (SI units throughout).
 */

import { C, H, E_CHARGE } from "./constants";

/* ------------------------------------------------------------------ */
/* Projectile motion (no air resistance, flat ground)                   */
/* ------------------------------------------------------------------ */

export interface Projectile {
  vx: number;
  vy: number;
  flightTime: number;
  range: number;
  maxHeight: number;
  timeToApex: number;
  impactSpeed: number;
  /** Impact angle below horizontal, radians. */
  impactAngle: number;
}

/** v0 (m/s), angle θ (rad, may be negative), launch height h0 ≥ 0 (m), g > 0. */
export function projectile(v0: number, theta: number, h0: number, g: number): Projectile {
  const vx = v0 * Math.cos(theta);
  const vy = v0 * Math.sin(theta);
  // y(t) = h0 + vy t − g t²/2 = 0 → positive root
  const flightTime = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  const timeToApex = Math.max(0, vy / g);
  const maxHeight = h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0);
  const vyImpact = vy - g * flightTime;
  return {
    vx,
    vy,
    flightTime,
    range: vx * flightTime,
    maxHeight,
    timeToApex,
    impactSpeed: Math.hypot(vx, vyImpact),
    impactAngle: Math.atan2(-vyImpact, vx),
  };
}

export function projectilePoint(v0: number, theta: number, h0: number, g: number, t: number): [number, number] {
  return [v0 * Math.cos(theta) * t, h0 + v0 * Math.sin(theta) * t - 0.5 * g * t * t];
}

/* ------------------------------------------------------------------ */
/* Waves and photons                                                    */
/* ------------------------------------------------------------------ */

/** Photon energy in joules from frequency (Hz). */
export const photonEnergy = (f: number) => H * f;
export const joulesToEV = (j: number) => j / E_CHARGE;

/** Electromagnetic band for a vacuum wavelength in meters. Boundaries are conventional, not sharp. */
export function emBand(lambda: number): string {
  if (lambda < 10e-12) return "Gamma rays";
  if (lambda < 10e-9) return "X-rays";
  if (lambda < 380e-9) return "Ultraviolet";
  if (lambda <= 750e-9) {
    const nm = lambda * 1e9;
    const color = nm < 450 ? "violet" : nm < 495 ? "blue" : nm < 570 ? "green" : nm < 590 ? "yellow" : nm < 620 ? "orange" : "red";
    return `Visible light (${color})`;
  }
  if (lambda < 1e-3) return "Infrared";
  if (lambda < 1) return "Microwaves";
  return "Radio waves";
}

/** Vacuum wavelength (m) from frequency. */
export const vacuumWavelength = (f: number) => C / f;

/* ------------------------------------------------------------------ */
/* Half-life                                                            */
/* ------------------------------------------------------------------ */

export const remaining = (n0: number, t: number, half: number) => n0 * Math.pow(0.5, t / half);
export const elapsed = (n0: number, n: number, half: number) => half * Math.log2(n0 / n);
export const halfLifeFrom = (n0: number, n: number, t: number) => t / Math.log2(n0 / n);
