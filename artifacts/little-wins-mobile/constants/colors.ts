/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#21443b',
    tint: '#2e7564',

    // Core surfaces
    background: '#f8f5ed',
    foreground: '#21443b',

    // Cards / elevated surfaces
    card: '#fffdf8',
    cardForeground: '#21443b',

    // Primary action color (buttons, links, active states)
    primary: '#2e7564',
    primaryForeground: '#fffdf8',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#f1dfb2',
    secondaryForeground: '#21443b',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#eee9dd',
    mutedForeground: '#6a7b73',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f4c766',
    accentForeground: '#21443b',

    // Destructive actions (delete, error states)
    destructive: '#bd4b3d',
    destructiveForeground: '#fffdf8',

    // Borders and input outlines
    border: '#ded7c7',
    input: '#d3cbbb',
  },

  dark: {
    text: '#f8f1df',
    tint: '#f4c766',
    background: '#10211d',
    foreground: '#f8f1df',
    card: '#18312a',
    cardForeground: '#f8f1df',
    primary: '#f4c766',
    primaryForeground: '#173229',
    secondary: '#29483e',
    secondaryForeground: '#f8f1df',
    muted: '#244138',
    mutedForeground: '#b8c4b7',
    accent: '#f4c766',
    accentForeground: '#173229',
    destructive: '#e17a6a',
    destructiveForeground: '#fff8ef',
    border: '#315247',
    input: '#3d6255',
  },

  // Little Wins uses a soft, friendly radius rather than sharp utility controls.
  radius: 18,
};

export default colors;
