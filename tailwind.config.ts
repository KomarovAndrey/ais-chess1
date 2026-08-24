import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090d",
          900: "#0c1017",
          800: "#151b26",
          700: "#1e2633"
        },
        gold: {
          DEFAULT: "#e0b15b",
          bright: "#f3c56b",
          dim: "#b8893a"
        },
        primary: {
          DEFAULT: "#e0b15b",
          foreground: "#14110b"
        },
        secondary: {
          DEFAULT: "#3b82f6",
          foreground: "#ffffff"
        },
        background: "#0c1017",
        muted: "#151b26"
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-unbounded)", "var(--font-manrope)", "system-ui", "sans-serif"]
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem"
      },
      boxShadow: {
        glow: "0 0 40px rgba(224, 177, 91, 0.18)",
        card: "0 20px 50px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
