const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    'src/app/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    'src/contexts/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'src/lib/**/*.{ts,tsx}',
    'src/pages/**/*.{ts,tsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
        // Display serif (Tiempos Headline in production; Fraunces as the wired
        // open-source stand-in). See src/app/layout.tsx.
        display: ['var(--font-display)', ...fontFamily.serif]
      },
      // MotherMode "Editorial Warm" palette. See design-guide.txt (60-30-10:
      // bone base, ink text, mode aubergine accent, brass for luxe moments).
      colors: {
        bone: '#F5F1EB',
        ink: '#1A1816',
        mode: {
          DEFAULT: '#532B3C',
          deep: '#3D1F2D'
        },
        mushroom: '#B0A091',
        brass: '#A88B5C'
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
