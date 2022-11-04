import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
// import resolve from '@rollup/plugin-node-resolve';
// import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import scss from 'rollup-plugin-scss'
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
					// emitCss: false,
				}),
				scss(),
				css({ output: "summaryengine.css" }),
				nodeResolve({
					browser: true,
				}),
				commonjs(),
				typescript(),
				json(),
				!production && serve(),
				production && terser() && strip()
			]
		},
		{
			input: "src/summaryengine-admin.js",
			output: [
				{
					sourcemap: true,
					format: 'iife',
					name: "summaryengine_admin",
					file: "dist/summaryengine-admin.js"
				},
			],
			plugins: [
				nodeResolve({
					browser: true,
				}),
				commonjs(),
				!production && serve(),
				production && terser() && strip()
			]
		}
	];
}

export default config;
