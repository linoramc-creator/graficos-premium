import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0d14",
          panel: "#11151f",
          subtle: "#161b27"
        },
        ink: {
          primary: "#e7ecf3",
          secondary: "#9aa6b8",
          muted: "#5d6678"
        },
        accent: {
          gold: "#d4af37",
          danger: "#ef4444",
          ok: "#22c55e",
          warn: "#f59e0b",
          info: "#3b82f6"
        },
        border: {
          base: "#1f2937"
        }
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter", "Arial"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      boxShadow: {
        soft: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 0 24px -8px rgba(0,0,0,0.6)"
      }
    }
  },
  plugins: []
};

export default config;
