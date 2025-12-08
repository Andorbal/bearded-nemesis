import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:3010',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, '')
			},
			'/covers': {
				target: 'http://localhost:3010',
				changeOrigin: true
			},
			'/screenshots': {
				target: 'http://localhost:3010',
				changeOrigin: true
			}
		}
	}
});
