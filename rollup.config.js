import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
// import resolve from '@rollup/plugin-node-resolve';
// import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';
import preprocess from 'svelte-preprocess';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import strip from '@rollup/plugin-strip';
import typescript from '@rollup/plugin-typescript';

const production = !process.env.ROLLUP_WATCH;
const test = process.env.NODE_ENV === 'test';

function serve() {
	let server;

	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});

			process.on('SIGTERM', toExit);
			process.on('exit', toExit);
		}
	};
}

const pkg = require('./package.json');
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
					file: "dist/summaryengine.js"
				},
			],
			plugins: [
				svelte({
					preprocess: preprocess(),
				}),
				css({ output: "summaryengine.css" }),
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
					file: "dist/summaryengine-reports.js"
				},
			],
			plugins: [
				svelte({
					preprocess: preprocess(),
				}),
				css({ output: "summaryengine-reports.css" }),
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
					file: "dist/summaryengine-review.js"
				},
			],
			plugins: [
				svelte({
					preprocess: preprocess(),
				}),
				css({ output: "summaryengine-review.css" }),
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
					file: "dist/summaryengine-types.js"
				},
			],
			plugins: [
				svelte({
					preprocess: preprocess(),
				}),
				css({ output: "summaryengine-types.css" }),
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
