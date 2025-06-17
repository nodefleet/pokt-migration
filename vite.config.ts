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
            },
            '/api/tango': {
                target: 'https://pocket.tango.admin.poktscan.cloud',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/tango/, ''),
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
        'import.meta.env.POKTRADAR_API': JSON.stringify('https://poktradar.io/api'),
        'import.meta.env.TANGO_API': JSON.stringify('https://pocket.tango.admin.poktscan.cloud')
    },
    base: '/'
}); 