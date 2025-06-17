import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'cosmjs-vendor': ['@cosmjs/proto-signing', '@cosmjs/stargate']
                }
            }
        }
    },
    server: {
        port: 5173,
        open: true
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
        'import.meta.env.POKTRADAR_API': JSON.stringify('https://poktradar.io/api')
    },
    base: '/'
}); 