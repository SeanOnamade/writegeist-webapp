const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // Disable native optimizations for better Vercel compatibility
      optimize: false,
    },
  },
};

export default config;
