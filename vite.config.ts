import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
});

// Keep the configuration minimal for predictable dev server startup.
// Additional flags can be added here if the dev proxy is needed later.
