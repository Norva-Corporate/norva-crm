import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "DM Sans", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        border: "var(--border)",
        accent: {
          DEFAULT: "#3B7BF5",
          hover: "#2D63D4",
          muted: "rgba(59,123,245,0.12)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "#8A99B8",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        primary: {
          DEFAULT: "#3B7BF5",
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#22C55E",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#ffffff",
        },
        sidebar: "var(--sidebar)",
        "sidebar-border": "var(--sidebar-border)",
        "sidebar-foreground": "var(--sidebar-foreground)",
        "sidebar-muted": "var(--sidebar-muted)",
      },
      borderRadius: {
        lg: "4px",
        md: "4px",
        sm: "2px",
        none: "0px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.5)",
        glow: "0 0 20px rgba(59,123,245,0.2)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
