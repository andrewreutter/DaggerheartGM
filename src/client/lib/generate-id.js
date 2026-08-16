/** Tiny id helper with no feature-engine imports (keeps map-range / party-scale free of character-calc). */
export const generateId = () => crypto.randomUUID();
