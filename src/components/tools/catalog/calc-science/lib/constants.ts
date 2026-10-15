/**
 * Physical constants, CODATA 2018 (the values exact since the 2019 SI
 * redefinition are marked exact).
 */

/** Speed of light in vacuum, m/s (exact). */
export const C = 299792458;
/** Planck constant, J·s (exact). */
export const H = 6.62607015e-34;
/** Elementary charge, C (exact). */
export const E_CHARGE = 1.602176634e-19;
/** Avogadro constant, 1/mol (exact). */
export const NA = 6.02214076e23;
/** Boltzmann constant, J/K (exact). */
export const KB = 1.380649e-23;
/** Molar gas constant R = NA·kB, J/(mol·K) (exact product). */
export const R = NA * KB; // 8.31446261815324
/** Newtonian constant of gravitation, m³/(kg·s²) (CODATA 2018 recommended). */
export const G = 6.6743e-11;
/** Coulomb constant 1/(4πε0), N·m²/C² (CODATA 2018). */
export const K_COULOMB = 8.9875517923e9;
/** Standard acceleration of gravity, m/s² (exact by definition). */
export const G0 = 9.80665;
/** Standard atmosphere, Pa (exact). */
export const ATM = 101325;
/** Ion product of water at 25 °C (commonly used rounded value). */
export const KW_25C = 1.0e-14;
