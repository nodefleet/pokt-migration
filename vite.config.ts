import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: true
    },
    server: {
        port: 5173,
        open: true,
        proxy: {
            '/api/poktradar': {
                target: 'https://poktradar.io',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/poktradar/, '/api'),
                secure: true,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            }
        }
    },
    resolve: {
        alias: {
            'buffer': resolve(__dirname, 'node_modules/buffer'),
        }
    },
    optimizeDeps: {
        include: ['buffer'],
        esbuildOptions: {
            define: {
                global: 'globalThis'
            }
        }
    },
    define: {
        'process.env': {},
        global: 'globalThis',
    }
}); 