import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
// import resolve from '@rollup/plugin-node-resolve';
// import livereload from 'rollup-plugin-livereload';
import terser from '@rollup/plugin-terser';
import css from 'rollup-plugin-css-only';
import preprocess from 'svelte-preprocess';
import { sveltePreprocess } from 'svelte-preprocess'
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import strip from '@rollup/plugin-strip';
import typescript from '@rollup/plugin-typescript';

const production = !process.env.ROLLUP_WATCH;
const test = process.env.NODE_ENV === 'test';

let config;
if (test) {
	config = {
		plugins: [
			nodeResolve({
				browser: true,
			}),
			commonjs(),
			json()
		]
	}
} else {
	config = [
		{
			input: "src/summaryengine.js",
			output: [
				{
					sourcemap: true,
					format: 'iife',
					name: "summaryengine",
					file: production ? "dist/summaryengine.min.js" : "dist/summaryengine.js"
				},
			],
			plugins: [
				svelte({
					preprocess: sveltePreprocess(),
				}),
				css({ output: production ? "summaryengine.min.css" : "summaryengine.css" }),
				nodeResolve({
					browser: true,
				}),
				commonjs(),
				typescript(),
				json(),
				production && terser() && strip()
			]
		},
		// Reports
		{
			input: "src/summaryengine-reports.js",
			output: [
				{
					sourcemap: true,
					format: 'iife',
					name: "summaryengine_admin",
					file: production ? "dist/summaryengine-reports.min.js" : "dist/summaryengine-reports.js"
				},
			],
			plugins: [
				svelte({
					preprocess: sveltePreprocess(),
				}),
				css({ output: production ? "summaryengine-reports.min.css" : "summaryengine-reports.css" }),
				nodeResolve({
					browser: true,
				}),
				commonjs(),
				typescript(),
				json(),
				production && terser() && strip()
			]
		},
		// Review
		{
			input: "src/summaryengine-review.js",
			output: [
				{
					sourcemap: true,
					format: 'iife',
					name: "summaryengine_review",
					file: production ? "dist/summaryengine-review.min.js" : "dist/summaryengine-review.js"
				},
			],
			plugins: [
				svelte({
					preprocess: sveltePreprocess(),
				}),
				css({ output: production ? "summaryengine-review.min.css" : "summaryengine-review.css" }),
				nodeResolve({
					browser: true,
				}),
				commonjs(),
				typescript(),
				json(),
				production && terser() && strip()
			]
		},
		// Types
		{
			input: "src/summaryengine-types.js",
			output: [
				{
					sourcemap: true,
					format: 'iife',
					name: "summaryengine_types",
					file: production ? "dist/summaryengine-types.min.js" : "dist/summaryengine-types.js"
				},
			],
			plugins: [
				svelte({
					preprocess: sveltePreprocess(),
				}),
				css({ output: production ? "summaryengine-types.min.css" : "summaryengine-types.css" }),
				nodeResolve({
					browser: true,
				}),
				commonjs(),
				typescript(),
				json(),
				production && terser() && strip()
			]
		}
	];
}

export default config;
