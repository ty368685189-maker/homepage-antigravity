/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme")
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue,mjs}"],
  darkMode: "class", // allows toggling dark mode manually
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto", ...defaultTheme.fontFamily.sans],
        display: ["Roboto", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: "var(--primary)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        surface: "var(--color-surface)",
        "surface-soft": "var(--color-surface-soft)",
        "surface-strong": "var(--color-surface-strong)",
        border: "var(--color-border)",
        glow: "var(--color-glow)",
      }
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
