import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          "bg-from": "hsl(var(--sidebar-bg-from))",
          "bg-to": "hsl(var(--sidebar-bg-to))",
          foreground: "hsl(var(--sidebar-foreground))",
          active: "hsl(var(--sidebar-active))",
          "active-foreground": "hsl(var(--sidebar-active-foreground))",
          hover: "hsl(var(--sidebar-hover))",
          border: "hsl(var(--sidebar-border))",
          muted: "hsl(var(--sidebar-muted))",
        },
        kpi: {
          "green-bg": "hsl(var(--kpi-green-bg))",
          "green-border": "hsl(var(--kpi-green-border))",
          "green-text": "hsl(var(--kpi-green-text))",
          "blue-bg": "hsl(var(--kpi-blue-bg))",
          "blue-border": "hsl(var(--kpi-blue-border))",
          "blue-text": "hsl(var(--kpi-blue-text))",
          "yellow-bg": "hsl(var(--kpi-yellow-bg))",
          "yellow-border": "hsl(var(--kpi-yellow-border))",
          "yellow-text": "hsl(var(--kpi-yellow-text))",
          "orange-bg": "hsl(var(--kpi-orange-bg))",
          "orange-border": "hsl(var(--kpi-orange-border))",
          "orange-text": "hsl(var(--kpi-orange-text))",
          "teal-bg": "hsl(var(--kpi-teal-bg))",
          "teal-border": "hsl(var(--kpi-teal-border))",
          "teal-text": "hsl(var(--kpi-teal-text))",
        },
        polizza: {
          DEFAULT: "hsl(var(--polizza))",
          foreground: "hsl(var(--polizza-foreground))",
          soft: "hsl(var(--polizza-soft))",
        },
        quietanza: {
          DEFAULT: "hsl(var(--quietanza))",
          foreground: "hsl(var(--quietanza-foreground))",
          soft: "hsl(var(--quietanza-soft))",
        },
        appendice: {
          DEFAULT: "hsl(var(--appendice))",
          foreground: "hsl(var(--appendice-foreground))",
          soft: "hsl(var(--appendice-soft))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
