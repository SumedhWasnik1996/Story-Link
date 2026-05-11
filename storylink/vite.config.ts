import { defineConfig } from 'vite'
import path             from 'node:path'
import electron         from 'vite-plugin-electron/simple'
import react            from '@vitejs/plugin-react'

export default defineConfig({
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, './shared'),
        },
    },
    plugins: [
        react(),
        electron({
            main: {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['electron', 'better-sqlite3']
                        }
                    }
                }
            },
            preload: {
                input: path.join(__dirname, 'electron/preload.ts'),
            }
        }),
    ],
})
