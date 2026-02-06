import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#f97316", // orange
          foreground: "#ffffff"
        },
        secondary: {
          DEFAULT: "#1d4ed8", // blue
          foreground: "#ffffff"
        },
        background: "#ffffff",
        muted: "#f3f4f6"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.5rem"
      }
    }
  },
  plugins: []
};

export default config;

