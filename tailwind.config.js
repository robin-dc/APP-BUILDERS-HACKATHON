/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.js', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Brand palette. Change these to restyle the whole app.
      colors: {
        cream: '#F5F2EC', // app background
        surface: '#FFFFFF', // cards
        line: '#E7E2D8', // borders, dividers
        chip: '#EFEBE3', // input / icon tiles
        ink: {
          DEFAULT: '#14263A', // primary text, user bubble, send button
          muted: '#5B6573', // secondary text
        },
        duck: {
          DEFAULT: '#FFC93C', // primary yellow (buttons, mascot)
          soft: '#FFF6DB', // highlighted card row
          pill: '#FDD866', // "BEST" pill
          beak: '#F28C28',
        },
        ok: {
          bg: '#DDF2E8',
          dot: '#22A06B',
          text: '#1D6B4B',
          wave: '#1F8A80', // translator waveform
        },
        night: {
          track: '#26394F', // splash progress track
          text: '#B8C1D6', // splash subtitle / footer
        },
        scrim:'rgba(20, 38, 58, 0.55)', // dim layer behind sheets
      },
    },
  },
  plugins: [],
};
