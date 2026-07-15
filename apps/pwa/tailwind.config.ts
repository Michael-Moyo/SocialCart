import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#25D366',
          dark: '#075E54',
          light: '#DCF8C6',
          bg: '#ECE5DD',
          bubble: '#128C7E',
        },
        navy: '#0F172A',
      },
    },
  },
  plugins: [],
};

export default config;
