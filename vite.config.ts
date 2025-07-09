import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            // Para incluir todos los polyfills de Node.js
            include: ['buffer', 'process', 'util', 'stream', 'events', 'path', 'crypto'],
            // Opciones específicas para el polyfill de Buffer
            globals: {
                Buffer: true,
                global: true,
                process: true
            },
            // Habilitar polyfills para el entorno del navegador
            protocolImports: true
        })
    ],
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
            'crypto': resolve(__dirname, 'node_modules/crypto-browserify'),
            'stream': resolve(__dirname, 'node_modules/stream-browserify'),
            'assert': resolve(__dirname, 'node_modules/assert'),
            'http': resolve(__dirname, 'node_modules/stream-http'),
            'https': resolve(__dirname, 'node_modules/https-browserify'),
            'os': resolve(__dirname, 'node_modules/os-browserify'),
            'url': resolve(__dirname, 'node_modules/url'),
            'path': resolve(__dirname, 'node_modules/path-browserify')
        }
    },
    optimizeDeps: {
        include: ['buffer', 'process', 'util', 'events', 'path'],
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