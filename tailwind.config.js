/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          active: "hsl(var(--primary-active))",
          subtle: "hsl(var(--primary-subtle))",
          light: "hsl(var(--primary-light))",
          muted: "hsl(var(--primary-muted))",
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
          subtle: "hsl(var(--primary-subtle))",
          light: "hsl(var(--primary-light))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Marque DressRent & Palette Neutre Dérivée
        dressrent: {
          carbon: "#12130F",
          linen: "#F7F5F0",
          petrole: {
            subtle: "#E8F2F1",
            light: "#B9DDD9",
            muted: "#337C78",
            DEFAULT: "#1E5F5C",
            hover: "#164E4B",
            active: "#0F3B39",
          },
          neutral: {
            50: "#F7F5F0",
            100: "#EFECE4",
            200: "#E2DDD1",
            300: "#C8C1B0",
            400: "#9C9482",
            500: "#736B5B",
            600: "#524C40",
            800: "#2B2B24",
            900: "#12130F",
          },
        },
        // Codes couleur métier adoucis sur fond lin validés en H0
        status: {
          reserved: "var(--status-reserved)",
          "reserved-bg": "var(--status-reserved-bg)",
          "reserved-border": "var(--status-reserved-border)",
          "in-progress": "var(--status-in-progress)",
          "in-progress-bg": "var(--status-in-progress-bg)",
          "in-progress-border": "var(--status-in-progress-border)",
          rental: "var(--status-rental)",
          "rental-bg": "var(--status-rental-bg)",
          "rental-border": "var(--status-rental-border)",
          cleaning: "var(--status-cleaning)",
          "cleaning-bg": "var(--status-cleaning-bg)",
          "cleaning-border": "var(--status-cleaning-border)",
          pressing: "var(--status-pressing)",
          "pressing-bg": "var(--status-pressing-bg)",
          "pressing-border": "var(--status-pressing-border)",
          dispute: "var(--status-dispute)",
          "dispute-bg": "var(--status-dispute-bg)",
          "dispute-border": "var(--status-dispute-border)",
          late: "var(--status-late)",
          "late-bg": "var(--status-late-bg)",
          "late-border": "var(--status-late-border)",
          completed: "var(--status-completed)",
          "completed-bg": "var(--status-completed-bg)",
          "completed-border": "var(--status-completed-border)",
          success: "var(--status-success)",
          "success-bg": "var(--status-success-bg)",
          "success-border": "var(--status-success-border)",
        },
        // Thème prestige doré (conservé pour rétrocompatibilité)
        gold: {
          50: "#fdfbf7",
          100: "#fbf7ee",
          200: "#f5ecd4",
          300: "#eddcb3",
          400: "#dfc282",
          500: "#d4a853",
          600: "#c28f3e",
          700: "#9e702f",
          800: "#7f592b",
          900: "#684a26",
          950: "#3b2713",
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
  plugins: [],
}
