var summaryengine_types = (function () {
	'use strict';

	/** @returns {void} */
	function noop() {}

	const identity = (x) => x;

	/**
	 * @template T
	 * @template S
	 * @param {T} tar
	 * @param {S} src
	 * @returns {T & S}
	 */
	function assign(tar, src) {
		// @ts-ignore
		for (const k in src) tar[k] = src[k];
		return /** @type {T & S} */ (tar);
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	/**
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function run_all(fns) {
		fns.forEach(run);
	}

	/**
	 * @param {any} thing
	 * @returns {thing is Function}
	 */
	function is_function(thing) {
		return typeof thing === 'function';
	}

	/** @returns {boolean} */
	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
	}

	/** @returns {boolean} */
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
	}

	function subscribe(store, ...callbacks) {
		if (store == null) {
			for (const callback of callbacks) {
				callback(undefined);
			}
			return noop;
		}
		const unsub = store.subscribe(...callbacks);
		return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
	}

	/** @returns {void} */
	function component_subscribe(component, store, callback) {
		component.$$.on_destroy.push(subscribe(store, callback));
	}

	/** @returns {{}} */
	function exclude_internal_props(props) {
		const result = {};
		for (const k in props) if (k[0] !== '$') result[k] = props[k];
		return result;
	}

	/** @returns {{}} */
	function compute_rest_props(props, keys) {
		const rest = {};
		keys = new Set(keys);
		for (const k in props) if (!keys.has(k) && k[0] !== '$') rest[k] = props[k];
		return rest;
	}

	function set_store_value(store, ret, value) {
		store.set(value);
		return ret;
	}

	const is_client = typeof window !== 'undefined';

	/** @type {() => number} */
	let now = is_client ? () => window.performance.now() : () => Date.now();

	let raf = is_client ? (cb) => requestAnimationFrame(cb) : noop;

	const tasks = new Set();

	/**
	 * @param {number} now
	 * @returns {void}
	 */
	function run_tasks(now) {
		tasks.forEach((task) => {
			if (!task.c(now)) {
				tasks.delete(task);
				task.f();
			}
		});
		if (tasks.size !== 0) raf(run_tasks);
	}

	/**
	 * Creates a new task that runs on each raf frame
	 * until it returns a falsy value or is aborted
	 * @param {import('./private.js').TaskCallback} callback
	 * @returns {import('./private.js').Task}
	 */
	function loop(callback) {
		/** @type {import('./private.js').TaskEntry} */
		let task;
		if (tasks.size === 0) raf(run_tasks);
		return {
			promise: new Promise((fulfill) => {
				tasks.add((task = { c: callback, f: fulfill }));
			}),
			abort() {
				tasks.delete(task);
			}
		};
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append(target, node) {
		target.appendChild(node);
	}

	/**
	 * @param {Node} node
	 * @returns {ShadowRoot | Document}
	 */
	function get_root_for_style(node) {
		if (!node) return document;
		const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
		if (root && /** @type {ShadowRoot} */ (root).host) {
			return /** @type {ShadowRoot} */ (root);
		}
		return node.ownerDocument;
	}

	/**
	 * @param {Node} node
	 * @returns {CSSStyleSheet}
	 */
	function append_empty_stylesheet(node) {
		const style_element = element('style');
		// For transitions to work without 'style-src: unsafe-inline' Content Security Policy,
		// these empty tags need to be allowed with a hash as a workaround until we move to the Web Animations API.
		// Using the hash for the empty string (for an empty tag) works in all browsers except Safari.
		// So as a workaround for the workaround, when we append empty style tags we set their content to /* empty */.
		// The hash 'sha256-9OlNO0DNEeaVzHL4RZwCLsBHA8WBQ8toBp/4F5XV2nc=' will then work even in Safari.
		style_element.textContent = '/* empty */';
		append_stylesheet(get_root_for_style(node), style_element);
		return style_element.sheet;
	}

	/**
	 * @param {ShadowRoot | Document} node
	 * @param {HTMLStyleElement} style
	 * @returns {CSSStyleSheet}
	 */
	function append_stylesheet(node, style) {
		append(/** @type {Document} */ (node).head || node, style);
		return style.sheet;
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach(node) {
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
	}

	/**
	 * @returns {void} */
	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	/**
	 * @template {keyof HTMLElementTagNameMap} K
	 * @param {K} name
	 * @returns {HTMLElementTagNameMap[K]}
	 */
	function element(name) {
		return document.createElement(name);
	}

	/**
	 * @param {string} data
	 * @returns {Text}
	 */
	function text(data) {
		return document.createTextNode(data);
	}

	/**
	 * @returns {Text} */
	function space() {
		return text(' ');
	}

	/**
	 * @returns {Text} */
	function empty() {
		return text('');
	}

	/**
	 * @param {EventTarget} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @returns {() => void}
	 */
	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
	}

	/**
	 * @param {HTMLInputElement[]} group
	 * @returns {{ p(...inputs: HTMLInputElement[]): void; r(): void; }}
	 */
	function init_binding_group(group) {
		/**
		 * @type {HTMLInputElement[]} */
		let _inputs;
		return {
			/* push */ p(...inputs) {
				_inputs = inputs;
				_inputs.forEach((input) => group.push(input));
			},
			/* remove */ r() {
				_inputs.forEach((input) => group.splice(group.indexOf(input), 1));
			}
		};
	}

	/** @returns {number} */
	function to_number(value) {
		return value === '' ? null : +value;
	}

	/**
	 * @param {Element} element
	 * @returns {ChildNode[]}
	 */
	function children(element) {
		return Array.from(element.childNodes);
	}

	/**
	 * @param {Text} text
	 * @param {unknown} data
	 * @returns {void}
	 */
	function set_data(text, data) {
		data = '' + data;
		if (text.data === data) return;
		text.data = /** @type {string} */ (data);
	}

	/**
	 * @returns {void} */
	function set_input_value(input, value) {
		input.value = value == null ? '' : value;
	}

	/**
	 * @returns {void} */
	function select_option(select, value, mounting) {
		for (let i = 0; i < select.options.length; i += 1) {
			const option = select.options[i];
			if (option.__value === value) {
				option.selected = true;
				return;
			}
		}
		if (!mounting || value !== undefined) {
			select.selectedIndex = -1; // no option should be selected
		}
	}

	/**
	 * @returns {void} */
	function select_options(select, value) {
		for (let i = 0; i < select.options.length; i += 1) {
			const option = select.options[i];
			option.selected = ~value.indexOf(option.__value);
		}
	}

	function select_value(select) {
		const selected_option = select.querySelector(':checked');
		return selected_option && selected_option.__value;
	}

	function select_multiple_value(select) {
		return [].map.call(select.querySelectorAll(':checked'), (option) => option.__value);
	}

	/**
	 * @returns {void} */
	function toggle_class(element, name, toggle) {
		// The `!!` is required because an `undefined` flag means flipping the current state.
		element.classList.toggle(name, !!toggle);
	}

	/**
	 * @template T
	 * @param {string} type
	 * @param {T} [detail]
	 * @param {{ bubbles?: boolean, cancelable?: boolean }} [options]
	 * @returns {CustomEvent<T>}
	 */
	function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
		return new CustomEvent(type, { detail, bubbles, cancelable });
	}

	/**
	 * @typedef {Node & {
	 * 	claim_order?: number;
	 * 	hydrate_init?: true;
	 * 	actual_end_child?: NodeEx;
	 * 	childNodes: NodeListOf<NodeEx>;
	 * }} NodeEx
	 */

	/** @typedef {ChildNode & NodeEx} ChildNodeEx */

	/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

	/**
	 * @typedef {ChildNodeEx[] & {
	 * 	claim_info?: {
	 * 		last_index: number;
	 * 		total_claimed: number;
	 * 	};
	 * }} ChildNodeArray
	 */

	// we need to store the information for multiple documents because a Svelte application could also contain iframes
	// https://github.com/sveltejs/svelte/issues/3624
	/** @type {Map<Document | ShadowRoot, import('./private.d.ts').StyleInformation>} */
	const managed_styles = new Map();

	let active = 0;

	// https://github.com/darkskyapp/string-hash/blob/master/index.js
	/**
	 * @param {string} str
	 * @returns {number}
	 */
	function hash(str) {
		let hash = 5381;
		let i = str.length;
		while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
		return hash >>> 0;
	}

	/**
	 * @param {Document | ShadowRoot} doc
	 * @param {Element & ElementCSSInlineStyle} node
	 * @returns {{ stylesheet: any; rules: {}; }}
	 */
	function create_style_information(doc, node) {
		const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
		managed_styles.set(doc, info);
		return info;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {number} a
	 * @param {number} b
	 * @param {number} duration
	 * @param {number} delay
	 * @param {(t: number) => number} ease
	 * @param {(t: number, u: number) => string} fn
	 * @param {number} uid
	 * @returns {string}
	 */
	function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
		const step = 16.666 / duration;
		let keyframes = '{\n';
		for (let p = 0; p <= 1; p += step) {
			const t = a + (b - a) * ease(p);
			keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
		}
		const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
		const name = `__svelte_${hash(rule)}_${uid}`;
		const doc = get_root_for_style(node);
		const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
		if (!rules[name]) {
			rules[name] = true;
			stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
		}
		const animation = node.style.animation || '';
		node.style.animation = `${
		animation ? `${animation}, ` : ''
	}${name} ${duration}ms linear ${delay}ms 1 both`;
		active += 1;
		return name;
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {string} [name]
	 * @returns {void}
	 */
	function delete_rule(node, name) {
		const previous = (node.style.animation || '').split(', ');
		const next = previous.filter(
			name
				? (anim) => anim.indexOf(name) < 0 // remove specific animation
				: (anim) => anim.indexOf('__svelte') === -1 // remove all Svelte animations
		);
		const deleted = previous.length - next.length;
		if (deleted) {
			node.style.animation = next.join(', ');
			active -= deleted;
			if (!active) clear_rules();
		}
	}

	/** @returns {void} */
	function clear_rules() {
		raf(() => {
			if (active) return;
			managed_styles.forEach((info) => {
				const { ownerNode } = info.stylesheet;
				// there is no ownerNode if it runs on jsdom.
				if (ownerNode) detach(ownerNode);
			});
			managed_styles.clear();
		});
	}

	let current_component;

	/** @returns {void} */
	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error('Function called outside component initialization');
		return current_component;
	}

	/**
	 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
	 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
	 * it can be called from an external module).
	 *
	 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
	 *
	 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
	 *
	 * https://svelte.dev/docs/svelte#onmount
	 * @template T
	 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
	 * @returns {void}
	 */
	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	const dirty_components = [];
	const binding_callbacks = [];

	let render_callbacks = [];

	const flush_callbacks = [];

	const resolved_promise = /* @__PURE__ */ Promise.resolve();

	let update_scheduled = false;

	/** @returns {void} */
	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	/** @returns {void} */
	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	/** @returns {void} */
	function add_flush_callback(fn) {
		flush_callbacks.push(fn);
	}

	// flush() calls callbacks in this order:
	// 1. All beforeUpdate callbacks, in order: parents before children
	// 2. All bind:this callbacks, in reverse order: children before parents.
	// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
	//    for afterUpdates called during the initial onMount, which are called in
	//    reverse order: children before parents.
	// Since callbacks might update component values, which could trigger another
	// call to flush(), the following steps guard against this:
	// 1. During beforeUpdate, any updated components will be added to the
	//    dirty_components array and will cause a reentrant call to flush(). Because
	//    the flush index is kept outside the function, the reentrant call will pick
	//    up where the earlier call left off and go through all dirty components. The
	//    current_component value is saved and restored so that the reentrant call will
	//    not interfere with the "parent" flush() call.
	// 2. bind:this callbacks cannot trigger new flush() calls.
	// 3. During afterUpdate, any updated components will NOT have their afterUpdate
	//    callback called a second time; the seen_callbacks set, outside the flush()
	//    function, guarantees this behavior.
	const seen_callbacks = new Set();

	let flushidx = 0; // Do *not* move this inside the flush() function

	/** @returns {void} */
	function flush() {
		// Do not reenter flush while dirty components are updated, as this can
		// result in an infinite loop. Instead, let the inner flush handle it.
		// Reentrancy is ok afterwards for bindings etc.
		if (flushidx !== 0) {
			return;
		}
		const saved_component = current_component;
		do {
			// first, call beforeUpdate functions
			// and update components
			try {
				while (flushidx < dirty_components.length) {
					const component = dirty_components[flushidx];
					flushidx++;
					set_current_component(component);
					update(component.$$);
				}
			} catch (e) {
				// reset dirty state to not end up in a deadlocked state and then rethrow
				dirty_components.length = 0;
				flushidx = 0;
				throw e;
			}
			set_current_component(null);
			dirty_components.length = 0;
			flushidx = 0;
			while (binding_callbacks.length) binding_callbacks.pop()();
			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			for (let i = 0; i < render_callbacks.length; i += 1) {
				const callback = render_callbacks[i];
				if (!seen_callbacks.has(callback)) {
					// ...so guard against infinite loops
					seen_callbacks.add(callback);
					callback();
				}
			}
			render_callbacks.length = 0;
		} while (dirty_components.length);
		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}
		update_scheduled = false;
		seen_callbacks.clear();
		set_current_component(saved_component);
	}

	/** @returns {void} */
	function update($$) {
		if ($$.fragment !== null) {
			$$.update();
			run_all($$.before_update);
			const dirty = $$.dirty;
			$$.dirty = [-1];
			$$.fragment && $$.fragment.p($$.ctx, dirty);
			$$.after_update.forEach(add_render_callback);
		}
	}

	/**
	 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function flush_render_callbacks(fns) {
		const filtered = [];
		const targets = [];
		render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
		targets.forEach((c) => c());
		render_callbacks = filtered;
	}

	/**
	 * @type {Promise<void> | null}
	 */
	let promise;

	/**
	 * @returns {Promise<void>}
	 */
	function wait() {
		if (!promise) {
			promise = Promise.resolve();
			promise.then(() => {
				promise = null;
			});
		}
		return promise;
	}

	/**
	 * @param {Element} node
	 * @param {INTRO | OUTRO | boolean} direction
	 * @param {'start' | 'end'} kind
	 * @returns {void}
	 */
	function dispatch(node, direction, kind) {
		node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
	}

	const outroing = new Set();

	/**
	 * @type {Outro}
	 */
	let outros;

	/**
	 * @returns {void} */
	function group_outros() {
		outros = {
			r: 0,
			c: [],
			p: outros // parent group
		};
	}

	/**
	 * @returns {void} */
	function check_outros() {
		if (!outros.r) {
			run_all(outros.c);
		}
		outros = outros.p;
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} [local]
	 * @returns {void}
	 */
	function transition_in(block, local) {
		if (block && block.i) {
			outroing.delete(block);
			block.i(local);
		}
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} local
	 * @param {0 | 1} [detach]
	 * @param {() => void} [callback]
	 * @returns {void}
	 */
	function transition_out(block, local, detach, callback) {
		if (block && block.o) {
			if (outroing.has(block)) return;
			outroing.add(block);
			outros.c.push(() => {
				outroing.delete(block);
				if (callback) {
					if (detach) block.d(1);
					callback();
				}
			});
			block.o(local);
		} else if (callback) {
			callback();
		}
	}

	/**
	 * @type {import('../transition/public.js').TransitionConfig}
	 */
	const null_transition = { duration: 0 };

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {TransitionFn} fn
	 * @param {any} params
	 * @param {boolean} intro
	 * @returns {{ run(b: 0 | 1): void; end(): void; }}
	 */
	function create_bidirectional_transition(node, fn, params, intro) {
		/**
		 * @type {TransitionOptions} */
		const options = { direction: 'both' };
		let config = fn(node, params, options);
		let t = intro ? 0 : 1;

		/**
		 * @type {Program | null} */
		let running_program = null;

		/**
		 * @type {PendingProgram | null} */
		let pending_program = null;
		let animation_name = null;

		/** @type {boolean} */
		let original_inert_value;

		/**
		 * @returns {void} */
		function clear_animation() {
			if (animation_name) delete_rule(node, animation_name);
		}

		/**
		 * @param {PendingProgram} program
		 * @param {number} duration
		 * @returns {Program}
		 */
		function init(program, duration) {
			const d = /** @type {Program['d']} */ (program.b - t);
			duration *= Math.abs(d);
			return {
				a: t,
				b: program.b,
				d,
				duration,
				start: program.start,
				end: program.start + duration,
				group: program.group
			};
		}

		/**
		 * @param {INTRO | OUTRO} b
		 * @returns {void}
		 */
		function go(b) {
			const {
				delay = 0,
				duration = 300,
				easing = identity,
				tick = noop,
				css
			} = config || null_transition;

			/**
			 * @type {PendingProgram} */
			const program = {
				start: now() + delay,
				b
			};

			if (!b) {
				// @ts-ignore todo: improve typings
				program.group = outros;
				outros.r += 1;
			}

			if ('inert' in node) {
				if (b) {
					if (original_inert_value !== undefined) {
						// aborted/reversed outro — restore previous inert value
						node.inert = original_inert_value;
					}
				} else {
					original_inert_value = /** @type {HTMLElement} */ (node).inert;
					node.inert = true;
				}
			}

			if (running_program || pending_program) {
				pending_program = program;
			} else {
				// if this is an intro, and there's a delay, we need to do
				// an initial tick and/or apply CSS animation immediately
				if (css) {
					clear_animation();
					animation_name = create_rule(node, t, b, duration, delay, easing, css);
				}
				if (b) tick(0, 1);
				running_program = init(program, duration);
				add_render_callback(() => dispatch(node, b, 'start'));
				loop((now) => {
					if (pending_program && now > pending_program.start) {
						running_program = init(pending_program, duration);
						pending_program = null;
						dispatch(node, running_program.b, 'start');
						if (css) {
							clear_animation();
							animation_name = create_rule(
								node,
								t,
								running_program.b,
								running_program.duration,
								0,
								easing,
								config.css
							);
						}
					}
					if (running_program) {
						if (now >= running_program.end) {
							tick((t = running_program.b), 1 - t);
							dispatch(node, running_program.b, 'end');
							if (!pending_program) {
								// we're done
								if (running_program.b) {
									// intro — we can tidy up immediately
									clear_animation();
								} else {
									// outro — needs to be coordinated
									if (!--running_program.group.r) run_all(running_program.group.c);
								}
							}
							running_program = null;
						} else if (now >= running_program.start) {
							const p = now - running_program.start;
							t = running_program.a + running_program.d * easing(p / running_program.duration);
							tick(t, 1 - t);
						}
					}
					return !!(running_program || pending_program);
				});
			}
		}
		return {
			run(b) {
				if (is_function(config)) {
					wait().then(() => {
						const opts = { direction: b ? 'in' : 'out' };
						// @ts-ignore
						config = config(opts);
						go(b);
					});
				} else {
					go(b);
				}
			},
			end() {
				clear_animation();
				running_program = pending_program = null;
			}
		};
	}

	/** @typedef {1} INTRO */
	/** @typedef {0} OUTRO */
	/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
	/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

	/**
	 * @typedef {Object} Outro
	 * @property {number} r
	 * @property {Function[]} c
	 * @property {Object} p
	 */

	/**
	 * @typedef {Object} PendingProgram
	 * @property {number} start
	 * @property {INTRO|OUTRO} b
	 * @property {Outro} [group]
	 */

	/**
	 * @typedef {Object} Program
	 * @property {number} a
	 * @property {INTRO|OUTRO} b
	 * @property {1|-1} d
	 * @property {number} duration
	 * @property {number} start
	 * @property {number} end
	 * @property {Outro} [group]
	 */

	// general each functions:

	function ensure_array_like(array_like_or_iterator) {
		return array_like_or_iterator?.length !== undefined
			? array_like_or_iterator
			: Array.from(array_like_or_iterator);
	}

	/** @returns {void} */
	function bind(component, name, callback) {
		const index = component.$$.props[name];
		if (index !== undefined) {
			component.$$.bound[index] = callback;
			callback(component.$$.ctx[index]);
		}
	}

	/** @returns {void} */
	function create_component(block) {
		block && block.c();
	}

	/** @returns {void} */
	function mount_component(component, target, anchor) {
		const { fragment, after_update } = component.$$;
		fragment && fragment.m(target, anchor);
		// onMount happens before the initial afterUpdate
		add_render_callback(() => {
			const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
			// if the component was destroyed immediately
			// it will update the `$$.on_destroy` reference to `null`.
			// the destructured on_destroy may still reference to the old array
			if (component.$$.on_destroy) {
				component.$$.on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});
		after_update.forEach(add_render_callback);
	}

	/** @returns {void} */
	function destroy_component(component, detaching) {
		const $$ = component.$$;
		if ($$.fragment !== null) {
			flush_render_callbacks($$.after_update);
			run_all($$.on_destroy);
			$$.fragment && $$.fragment.d(detaching);
			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			$$.on_destroy = $$.fragment = null;
			$$.ctx = [];
		}
	}

	/** @returns {void} */
	function make_dirty(component, i) {
		if (component.$$.dirty[0] === -1) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty.fill(0);
		}
		component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
	}

	// TODO: Document the other params
	/**
	 * @param {SvelteComponent} component
	 * @param {import('./public.js').ComponentConstructorOptions} options
	 *
	 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
	 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
	 * This will be the `add_css` function from the compiled component.
	 *
	 * @returns {void}
	 */
	function init(
		component,
		options,
		instance,
		create_fragment,
		not_equal,
		props,
		append_styles = null,
		dirty = [-1]
	) {
		const parent_component = current_component;
		set_current_component(component);
		/** @type {import('./private.js').T$$} */
		const $$ = (component.$$ = {
			fragment: null,
			ctx: [],
			// state
			props,
			update: noop,
			not_equal,
			bound: blank_object(),
			// lifecycle
			on_mount: [],
			on_destroy: [],
			on_disconnect: [],
			before_update: [],
			after_update: [],
			context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
			// everything else
			callbacks: blank_object(),
			dirty,
			skip_bound: false,
			root: options.target || parent_component.$$.root
		});
		append_styles && append_styles($$.root);
		let ready = false;
		$$.ctx = instance
			? instance(component, options.props || {}, (i, ret, ...rest) => {
					const value = rest.length ? rest[0] : ret;
					if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
						if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
						if (ready) make_dirty(component, i);
					}
					return ret;
			  })
			: [];
		$$.update();
		ready = true;
		run_all($$.before_update);
		// `false` as a special case of no DOM component
		$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
		if (options.target) {
			if (options.hydrate) {
				// TODO: what is the correct type here?
				// @ts-expect-error
				const nodes = children(options.target);
				$$.fragment && $$.fragment.l(nodes);
				nodes.forEach(detach);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.c();
			}
			if (options.intro) transition_in(component.$$.fragment);
			mount_component(component, options.target, options.anchor);
			flush();
		}
		set_current_component(parent_component);
	}

	/**
	 * Base class for Svelte components. Used when dev=false.
	 *
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 */
	class SvelteComponent {
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$ = undefined;
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$set = undefined;

		/** @returns {void} */
		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}

		/**
		 * @template {Extract<keyof Events, string>} K
		 * @param {K} type
		 * @param {((e: Events[K]) => void) | null | undefined} callback
		 * @returns {() => void}
		 */
		$on(type, callback) {
			if (!is_function(callback)) {
				return noop;
			}
			const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		/**
		 * @param {Partial<Props>} props
		 * @returns {void}
		 */
		$set(props) {
			if (this.$$set && !is_empty(props)) {
				this.$$.skip_bound = true;
				this.$$set(props);
				this.$$.skip_bound = false;
			}
		}
	}

	/**
	 * @typedef {Object} CustomElementPropDefinition
	 * @property {string} [attribute]
	 * @property {boolean} [reflect]
	 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
	 */

	// generated during release, do not modify

	const PUBLIC_VERSION = '4';

	if (typeof window !== 'undefined')
		// @ts-ignore
		(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

	/*
	Adapted from https://github.com/mattdesl
	Distributed under MIT License https://github.com/mattdesl/eases/blob/master/LICENSE.md
	*/

	/**
	 * https://svelte.dev/docs/svelte-easing
	 * @param {number} t
	 * @returns {number}
	 */
	function cubicOut(t) {
		const f = t - 1.0;
		return f * f * f + 1.0;
	}

	/**
	 * Slides an element in and out.
	 *
	 * https://svelte.dev/docs/svelte-transition#slide
	 * @param {Element} node
	 * @param {import('./public').SlideParams} [params]
	 * @returns {import('./public').TransitionConfig}
	 */
	function slide(node, { delay = 0, duration = 400, easing = cubicOut, axis = 'y' } = {}) {
		const style = getComputedStyle(node);
		const opacity = +style.opacity;
		const primary_property = axis === 'y' ? 'height' : 'width';
		const primary_property_value = parseFloat(style[primary_property]);
		const secondary_properties = axis === 'y' ? ['top', 'bottom'] : ['left', 'right'];
		const capitalized_secondary_properties = secondary_properties.map(
			(e) => `${e[0].toUpperCase()}${e.slice(1)}`
		);
		const padding_start_value = parseFloat(style[`padding${capitalized_secondary_properties[0]}`]);
		const padding_end_value = parseFloat(style[`padding${capitalized_secondary_properties[1]}`]);
		const margin_start_value = parseFloat(style[`margin${capitalized_secondary_properties[0]}`]);
		const margin_end_value = parseFloat(style[`margin${capitalized_secondary_properties[1]}`]);
		const border_width_start_value = parseFloat(
			style[`border${capitalized_secondary_properties[0]}Width`]
		);
		const border_width_end_value = parseFloat(
			style[`border${capitalized_secondary_properties[1]}Width`]
		);
		return {
			delay,
			duration,
			easing,
			css: (t) =>
				'overflow: hidden;' +
				`opacity: ${Math.min(t * 20, 1) * opacity};` +
				`${primary_property}: ${t * primary_property_value}px;` +
				`padding-${secondary_properties[0]}: ${t * padding_start_value}px;` +
				`padding-${secondary_properties[1]}: ${t * padding_end_value}px;` +
				`margin-${secondary_properties[0]}: ${t * margin_start_value}px;` +
				`margin-${secondary_properties[1]}: ${t * margin_end_value}px;` +
				`border-${secondary_properties[0]}-width: ${t * border_width_start_value}px;` +
				`border-${secondary_properties[1]}-width: ${t * border_width_end_value}px;`
		};
	}

	var ajax = {};

	var hasRequiredAjax;

	function requireAjax () {
		if (hasRequiredAjax) return ajax;
		hasRequiredAjax = 1;
		Object.defineProperty(ajax, "__esModule", { value: true });
		ajax.apiPut = ajax.apiDelete = ajax.apiGet = ajax.apiPost = void 0;
		function handleError(response) {
		    if (!response.ok) {
		        const status = response.status;
		        const message = response.responseJSON?.message || response.statusText || response.responseText || response;
		        const code = response.responseJSON?.code || response.code || "";
		        return { status, code, message };
		    }
		    return response;
		}
		function apiPost(path, data, headers = {}) {
		    return new Promise((resolve, reject) => {
		        wp.apiRequest({
		            path,
		            data,
		            type: "POST",
		            headers
		        })
		            .done(async (response) => {
		            if (response.error) {
		                reject(response);
		            }
		            resolve(response);
		        })
		            .fail(async (response) => {
		            reject(handleError(response));
		        });
		    });
		}
		ajax.apiPost = apiPost;
		function apiGet(path, headers = {}) {
		    return new Promise((resolve, reject) => {
		        wp.apiRequest({
		            path,
		            type: "GET",
		            headers
		        })
		            .done(async (response) => {
		            if (response.error) {
		                reject(response);
		            }
		            resolve(response);
		        })
		            .fail(async (response) => {
		            reject(handleError(response));
		        });
		    });
		}
		ajax.apiGet = apiGet;
		function apiDelete(path, headers = {}) {
		    return new Promise((resolve, reject) => {
		        wp.apiRequest({
		            path,
		            type: "DELETE",
		            headers
		        })
		            .done(async (response) => {
		            if (response.error) {
		                reject(response);
		            }
		            resolve(response);
		        })
		            .fail(async (response) => {
		            reject(handleError(response));
		        });
		    });
		}
		ajax.apiDelete = apiDelete;
		function apiPut(path, data, headers = {}) {
		    return new Promise((resolve, reject) => {
		        wp.apiRequest({
		            path,
		            data,
		            type: "PUT",
		            headers
		        })
		            .done(async (response) => {
		            if (response.error) {
		                reject(response);
		            }
		            resolve(response);
		        })
		            .fail(async (response) => {
		            reject(handleError(response));
		        });
		    });
		}
		ajax.apiPut = apiPut;
		
		return ajax;
	}

	var ajaxExports = requireAjax();

	const subscriber_queue = [];

	/**
	 * Create a `Writable` store that allows both updating and reading by subscription.
	 *
	 * https://svelte.dev/docs/svelte-store#writable
	 * @template T
	 * @param {T} [value] initial value
	 * @param {import('./public.js').StartStopNotifier<T>} [start]
	 * @returns {import('./public.js').Writable<T>}
	 */
	function writable(value, start = noop) {
		/** @type {import('./public.js').Unsubscriber} */
		let stop;
		/** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
		const subscribers = new Set();
		/** @param {T} new_value
		 * @returns {void}
		 */
		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (stop) {
					// store is ready
					const run_queue = !subscriber_queue.length;
					for (const subscriber of subscribers) {
						subscriber[1]();
						subscriber_queue.push(subscriber, value);
					}
					if (run_queue) {
						for (let i = 0; i < subscriber_queue.length; i += 2) {
							subscriber_queue[i][0](subscriber_queue[i + 1]);
						}
						subscriber_queue.length = 0;
					}
				}
			}
		}

		/**
		 * @param {import('./public.js').Updater<T>} fn
		 * @returns {void}
		 */
		function update(fn) {
			set(fn(value));
		}

		/**
		 * @param {import('./public.js').Subscriber<T>} run
		 * @param {import('./private.js').Invalidator<T>} [invalidate]
		 * @returns {import('./public.js').Unsubscriber}
		 */
		function subscribe(run, invalidate = noop) {
			/** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
			const subscriber = [run, invalidate];
			subscribers.add(subscriber);
			if (subscribers.size === 1) {
				stop = start(set, update) || noop;
			}
			run(value);
			return () => {
				subscribers.delete(subscriber);
				if (subscribers.size === 0 && stop) {
					stop();
					stop = null;
				}
			};
		}
		return { set, update, subscribe };
	}

	const types = writable([]);

	String.prototype.slugify = function (separator = "-") {
	    return this
	        .toString()
	        .normalize('NFD')                   // split an accented letter in the base letter and the acent
	        .replace(/[\u0300-\u036f]/g, '')   // remove all previously split accents
	        .toLowerCase()
	        .trim()
	        .replace(/[^a-z0-9 ]/g, '')   // remove all chars not letters, numbers and spaces (to be replaced)
	        .replace(/\s+/g, separator);
	};

	/* src/components/FormInput.svelte generated by Svelte v4.2.19 */

	function get_each_context_2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[42] = list[i];
		return child_ctx;
	}

	function get_each_context_1$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[42] = list[i];
		return child_ctx;
	}

	function get_each_context$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[42] = list[i];
		return child_ctx;
	}

	// (49:0) {:else}
	function create_else_block$1(ctx) {
		let tr;
		let th;
		let label_1;
		let t0;
		let t1;
		let td;
		let t2;

		function select_block_type_1(ctx, dirty) {
			if (/*type*/ ctx[7] === "text") return create_if_block_2$2;
			if (/*type*/ ctx[7] === "password") return create_if_block_3$1;
			if (/*type*/ ctx[7] === "email") return create_if_block_4$1;
			if (/*type*/ ctx[7] === "url") return create_if_block_5$1;
			if (/*type*/ ctx[7] === "tel") return create_if_block_6$1;
			if (/*type*/ ctx[7] === "number") return create_if_block_7;
			if (/*type*/ ctx[7] === "range") return create_if_block_8;
			if (/*type*/ ctx[7] === "date") return create_if_block_9;
			if (/*type*/ ctx[7] === "month") return create_if_block_10;
			if (/*type*/ ctx[7] === "week") return create_if_block_11;
			if (/*type*/ ctx[7] === "time") return create_if_block_12;
			if (/*type*/ ctx[7] === "datetime-local") return create_if_block_13;
			if (/*type*/ ctx[7] === "color") return create_if_block_14;
			if (/*type*/ ctx[7] === "checkbox") return create_if_block_15;
			if (/*type*/ ctx[7] === "radio") return create_if_block_16;
			if (/*type*/ ctx[7] === "file") return create_if_block_17;
			if (/*type*/ ctx[7] === "submit") return create_if_block_18;
			if (/*type*/ ctx[7] === "reset") return create_if_block_19;
			if (/*type*/ ctx[7] === "button") return create_if_block_20;
			if (/*type*/ ctx[7] === "select") return create_if_block_21;
			if (/*type*/ ctx[7] === "textarea") return create_if_block_23;
		}

		let current_block_type = select_block_type_1(ctx);
		let if_block0 = current_block_type && current_block_type(ctx);
		let if_block1 = /*description*/ ctx[9] && create_if_block_1$2(ctx);

		return {
			c() {
				tr = element("tr");
				th = element("th");
				label_1 = element("label");
				t0 = text(/*label*/ ctx[6]);
				t1 = space();
				td = element("td");
				if (if_block0) if_block0.c();
				t2 = space();
				if (if_block1) if_block1.c();
				attr(label_1, "for", /*id*/ ctx[4]);
				attr(th, "scope", "row");
			},
			m(target, anchor) {
				insert(target, tr, anchor);
				append(tr, th);
				append(th, label_1);
				append(label_1, t0);
				append(tr, t1);
				append(tr, td);
				if (if_block0) if_block0.m(td, null);
				append(td, t2);
				if (if_block1) if_block1.m(td, null);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*label*/ 64) set_data(t0, /*label*/ ctx[6]);

				if (dirty[0] & /*id*/ 16) {
					attr(label_1, "for", /*id*/ ctx[4]);
				}

				if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if (if_block0) if_block0.d(1);
					if_block0 = current_block_type && current_block_type(ctx);

					if (if_block0) {
						if_block0.c();
						if_block0.m(td, t2);
					}
				}

				if (/*description*/ ctx[9]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block_1$2(ctx);
						if_block1.c();
						if_block1.m(td, null);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}
			},
			d(detaching) {
				if (detaching) {
					detach(tr);
				}

				if (if_block0) {
					if_block0.d();
				}

				if (if_block1) if_block1.d();
			}
		};
	}

	// (39:0) {#if type === "hidden"}
	function create_if_block$2(ctx) {
		let input;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "hidden");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler*/ ctx[21]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (308:42) 
	function create_if_block_23(ctx) {
		let textarea;
		let textarea_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				textarea = element("textarea");
				attr(textarea, "id", /*id*/ ctx[4]);
				attr(textarea, "class", textarea_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(textarea, "name", /*name*/ ctx[5]);
				textarea.required = /*required*/ ctx[10];
				textarea.readOnly = /*readonly*/ ctx[11];
				textarea.disabled = /*disabled*/ ctx[12];
				attr(textarea, "rows", /*rows*/ ctx[17]);
				attr(textarea, "cols", /*cols*/ ctx[18]);
				attr(textarea, "wrap", /*wrap*/ ctx[19]);
			},
			m(target, anchor) {
				insert(target, textarea, anchor);
				set_input_value(textarea, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[41]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(textarea, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && textarea_class_value !== (textarea_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(textarea, "class", textarea_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(textarea, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					textarea.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					textarea.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					textarea.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*rows*/ 131072) {
					attr(textarea, "rows", /*rows*/ ctx[17]);
				}

				if (dirty[0] & /*cols*/ 262144) {
					attr(textarea, "cols", /*cols*/ ctx[18]);
				}

				if (dirty[0] & /*wrap*/ 524288) {
					attr(textarea, "wrap", /*wrap*/ ctx[19]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(textarea, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(textarea);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (283:40) 
	function create_if_block_21(ctx) {
		let if_block_anchor;

		function select_block_type_2(ctx, dirty) {
			if (/*multiple*/ ctx[14]) return create_if_block_22;
			return create_else_block_1;
		}

		let current_block_type = select_block_type_2(ctx);
		let if_block = current_block_type(ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
			},
			p(ctx, dirty) {
				if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block.d(1);
					if_block = current_block_type(ctx);

					if (if_block) {
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				}
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_block.d(detaching);
			}
		};
	}

	// (274:40) 
	function create_if_block_20(ctx) {
		let input;
		let input_class_value;

		return {
			c() {
				input = element("input");
				input.value = /*label*/ ctx[6];
				attr(input, "type", "button");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.disabled = /*disabled*/ ctx[12];
			},
			m(target, anchor) {
				insert(target, input, anchor);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*label*/ 64) {
					input.value = /*label*/ ctx[6];
				}

				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}
			}
		};
	}

	// (265:39) 
	function create_if_block_19(ctx) {
		let input;
		let input_class_value;

		return {
			c() {
				input = element("input");
				input.value = /*label*/ ctx[6];
				attr(input, "type", "reset");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.disabled = /*disabled*/ ctx[12];
			},
			m(target, anchor) {
				insert(target, input, anchor);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*label*/ 64) {
					input.value = /*label*/ ctx[6];
				}

				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}
			}
		};
	}

	// (256:40) 
	function create_if_block_18(ctx) {
		let input;
		let input_class_value;

		return {
			c() {
				input = element("input");
				input.value = /*label*/ ctx[6];
				attr(input, "type", "submit");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.disabled = /*disabled*/ ctx[12];
			},
			m(target, anchor) {
				insert(target, input, anchor);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*label*/ 64) {
					input.value = /*label*/ ctx[6];
				}

				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}
			}
		};
	}

	// (245:38) 
	function create_if_block_17(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "file");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
			},
			m(target, anchor) {
				insert(target, input, anchor);

				if (!mounted) {
					dispose = listen(input, "change", /*input_change_handler_2*/ ctx[38]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (236:39) 
	function create_if_block_16(ctx) {
		let each_1_anchor;
		let each_value = ensure_array_like(/*options*/ ctx[13]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		return {
			c() {
				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m(target, anchor) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*options, value*/ 8193) {
					each_value = ensure_array_like(/*options*/ ctx[13]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}
			},
			d(detaching) {
				if (detaching) {
					detach(each_1_anchor);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (225:42) 
	function create_if_block_15(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "checkbox");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
			},
			m(target, anchor) {
				insert(target, input, anchor);
				input.checked = /*checked*/ ctx[3];

				if (!mounted) {
					dispose = listen(input, "change", /*input_change_handler*/ ctx[35]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*checked*/ 8) {
					input.checked = /*checked*/ ctx[3];
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (214:39) 
	function create_if_block_14(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "color");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_12*/ ctx[34]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (200:48) 
	function create_if_block_13(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "datetime-local");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "min", /*min*/ ctx[1]);
				attr(input, "max", /*max*/ ctx[2]);
				attr(input, "step", /*step*/ ctx[15]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_11*/ ctx[33]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*min*/ 2) {
					attr(input, "min", /*min*/ ctx[1]);
				}

				if (dirty[0] & /*max*/ 4) {
					attr(input, "max", /*max*/ ctx[2]);
				}

				if (dirty[0] & /*step*/ 32768) {
					attr(input, "step", /*step*/ ctx[15]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (186:38) 
	function create_if_block_12(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "time");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "min", /*min*/ ctx[1]);
				attr(input, "max", /*max*/ ctx[2]);
				attr(input, "step", /*step*/ ctx[15]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_10*/ ctx[32]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*min*/ 2) {
					attr(input, "min", /*min*/ ctx[1]);
				}

				if (dirty[0] & /*max*/ 4) {
					attr(input, "max", /*max*/ ctx[2]);
				}

				if (dirty[0] & /*step*/ 32768) {
					attr(input, "step", /*step*/ ctx[15]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (172:38) 
	function create_if_block_11(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "week");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "min", /*min*/ ctx[1]);
				attr(input, "max", /*max*/ ctx[2]);
				attr(input, "step", /*step*/ ctx[15]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_9*/ ctx[31]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*min*/ 2) {
					attr(input, "min", /*min*/ ctx[1]);
				}

				if (dirty[0] & /*max*/ 4) {
					attr(input, "max", /*max*/ ctx[2]);
				}

				if (dirty[0] & /*step*/ 32768) {
					attr(input, "step", /*step*/ ctx[15]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (158:39) 
	function create_if_block_10(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "month");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "min", /*min*/ ctx[1]);
				attr(input, "max", /*max*/ ctx[2]);
				attr(input, "step", /*step*/ ctx[15]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_8*/ ctx[30]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*min*/ 2) {
					attr(input, "min", /*min*/ ctx[1]);
				}

				if (dirty[0] & /*max*/ 4) {
					attr(input, "max", /*max*/ ctx[2]);
				}

				if (dirty[0] & /*step*/ 32768) {
					attr(input, "step", /*step*/ ctx[15]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (144:38) 
	function create_if_block_9(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "date");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "min", /*min*/ ctx[1]);
				attr(input, "max", /*max*/ ctx[2]);
				attr(input, "step", /*step*/ ctx[15]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_7*/ ctx[29]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*min*/ 2) {
					attr(input, "min", /*min*/ ctx[1]);
				}

				if (dirty[0] & /*max*/ 4) {
					attr(input, "max", /*max*/ ctx[2]);
				}

				if (dirty[0] & /*step*/ 32768) {
					attr(input, "step", /*step*/ ctx[15]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (130:39) 
	function create_if_block_8(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "range");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "min", /*min*/ ctx[1]);
				attr(input, "max", /*max*/ ctx[2]);
				attr(input, "step", /*step*/ ctx[15]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = [
						listen(input, "change", /*input_change_input_handler*/ ctx[28]),
						listen(input, "input", /*input_change_input_handler*/ ctx[28])
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*min*/ 2) {
					attr(input, "min", /*min*/ ctx[1]);
				}

				if (dirty[0] & /*max*/ 4) {
					attr(input, "max", /*max*/ ctx[2]);
				}

				if (dirty[0] & /*step*/ 32768) {
					attr(input, "step", /*step*/ ctx[15]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (116:40) 
	function create_if_block_7(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "number");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "min", /*min*/ ctx[1]);
				attr(input, "max", /*max*/ ctx[2]);
				attr(input, "step", /*step*/ ctx[15]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_6*/ ctx[27]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*min*/ 2) {
					attr(input, "min", /*min*/ ctx[1]);
				}

				if (dirty[0] & /*max*/ 4) {
					attr(input, "max", /*max*/ ctx[2]);
				}

				if (dirty[0] & /*step*/ 32768) {
					attr(input, "step", /*step*/ ctx[15]);
				}

				if (dirty[0] & /*value, options*/ 8193 && to_number(input.value) !== /*value*/ ctx[0]) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (104:37) 
	function create_if_block_6$1(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "tel");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "pattern", /*pattern*/ ctx[16]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_5*/ ctx[26]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*pattern*/ 65536) {
					attr(input, "pattern", /*pattern*/ ctx[16]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (92:37) 
	function create_if_block_5$1(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "url");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "pattern", /*pattern*/ ctx[16]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_4*/ ctx[25]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*pattern*/ 65536) {
					attr(input, "pattern", /*pattern*/ ctx[16]);
				}

				if (dirty[0] & /*value, options*/ 8193 && input.value !== /*value*/ ctx[0]) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (80:39) 
	function create_if_block_4$1(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "email");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "pattern", /*pattern*/ ctx[16]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_3*/ ctx[24]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*pattern*/ 65536) {
					attr(input, "pattern", /*pattern*/ ctx[16]);
				}

				if (dirty[0] & /*value, options*/ 8193 && input.value !== /*value*/ ctx[0]) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (68:42) 
	function create_if_block_3$1(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "password");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "pattern", /*pattern*/ ctx[16]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_2*/ ctx[23]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*pattern*/ 65536) {
					attr(input, "pattern", /*pattern*/ ctx[16]);
				}

				if (dirty[0] & /*value, options*/ 8193 && input.value !== /*value*/ ctx[0]) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (55:12) {#if type === "text"}
	function create_if_block_2$2(ctx) {
		let input;
		let input_class_value;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "text");
				attr(input, "id", /*id*/ ctx[4]);
				attr(input, "class", input_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(input, "name", /*name*/ ctx[5]);
				attr(input, "placeholder", /*placeholder*/ ctx[8]);
				input.required = /*required*/ ctx[10];
				input.readOnly = /*readonly*/ ctx[11];
				input.disabled = /*disabled*/ ctx[12];
				attr(input, "pattern", /*pattern*/ ctx[16]);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				set_input_value(input, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(input, "input", /*input_input_handler_1*/ ctx[22]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*id*/ 16) {
					attr(input, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && input_class_value !== (input_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(input, "class", input_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(input, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*placeholder*/ 256) {
					attr(input, "placeholder", /*placeholder*/ ctx[8]);
				}

				if (dirty[0] & /*required*/ 1024) {
					input.required = /*required*/ ctx[10];
				}

				if (dirty[0] & /*readonly*/ 2048) {
					input.readOnly = /*readonly*/ ctx[11];
				}

				if (dirty[0] & /*disabled*/ 4096) {
					input.disabled = /*disabled*/ ctx[12];
				}

				if (dirty[0] & /*pattern*/ 65536) {
					attr(input, "pattern", /*pattern*/ ctx[16]);
				}

				if (dirty[0] & /*value, options*/ 8193 && input.value !== /*value*/ ctx[0]) {
					set_input_value(input, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (296:16) {:else}
	function create_else_block_1(ctx) {
		let select;
		let select_class_value;
		let mounted;
		let dispose;
		let each_value_2 = ensure_array_like(/*options*/ ctx[13]);
		let each_blocks = [];

		for (let i = 0; i < each_value_2.length; i += 1) {
			each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
		}

		return {
			c() {
				select = element("select");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(select, "id", /*id*/ ctx[4]);
				attr(select, "class", select_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(select, "name", /*name*/ ctx[5]);
				if (/*value*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler_1*/ ctx[40].call(select));
			},
			m(target, anchor) {
				insert(target, select, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(select, null);
					}
				}

				select_option(select, /*value*/ ctx[0], true);

				if (!mounted) {
					dispose = listen(select, "change", /*select_change_handler_1*/ ctx[40]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*options*/ 8192) {
					each_value_2 = ensure_array_like(/*options*/ ctx[13]);
					let i;

					for (i = 0; i < each_value_2.length; i += 1) {
						const child_ctx = get_each_context_2(ctx, each_value_2, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block_2(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value_2.length;
				}

				if (dirty[0] & /*id*/ 16) {
					attr(select, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && select_class_value !== (select_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(select, "class", select_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(select, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					select_option(select, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(select);
				}

				destroy_each(each_blocks, detaching);
				mounted = false;
				dispose();
			}
		};
	}

	// (284:16) {#if multiple}
	function create_if_block_22(ctx) {
		let select;
		let select_class_value;
		let mounted;
		let dispose;
		let each_value_1 = ensure_array_like(/*options*/ ctx[13]);
		let each_blocks = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
		}

		return {
			c() {
				select = element("select");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(select, "id", /*id*/ ctx[4]);
				attr(select, "class", select_class_value = /*$$restProps*/ ctx[20].class || "");
				attr(select, "name", /*name*/ ctx[5]);
				select.multiple = true;
				if (/*value*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[39].call(select));
			},
			m(target, anchor) {
				insert(target, select, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(select, null);
					}
				}

				select_options(select, /*value*/ ctx[0]);

				if (!mounted) {
					dispose = listen(select, "change", /*select_change_handler*/ ctx[39]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*options*/ 8192) {
					each_value_1 = ensure_array_like(/*options*/ ctx[13]);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block_1$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value_1.length;
				}

				if (dirty[0] & /*id*/ 16) {
					attr(select, "id", /*id*/ ctx[4]);
				}

				if (dirty[0] & /*$$restProps*/ 1048576 && select_class_value !== (select_class_value = /*$$restProps*/ ctx[20].class || "")) {
					attr(select, "class", select_class_value);
				}

				if (dirty[0] & /*name*/ 32) {
					attr(select, "name", /*name*/ ctx[5]);
				}

				if (dirty[0] & /*value, options*/ 8193) {
					select_options(select, /*value*/ ctx[0]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(select);
				}

				destroy_each(each_blocks, detaching);
				mounted = false;
				dispose();
			}
		};
	}

	// (303:24) {#each options as option}
	function create_each_block_2(ctx) {
		let option_1;
		let t_value = /*option*/ ctx[42].label + "";
		let t;
		let option_1_value_value;

		return {
			c() {
				option_1 = element("option");
				t = text(t_value);
				option_1.__value = option_1_value_value = /*option*/ ctx[42].value;
				set_input_value(option_1, option_1.__value);
			},
			m(target, anchor) {
				insert(target, option_1, anchor);
				append(option_1, t);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*options*/ 8192 && t_value !== (t_value = /*option*/ ctx[42].label + "")) set_data(t, t_value);

				if (dirty[0] & /*options*/ 8192 && option_1_value_value !== (option_1_value_value = /*option*/ ctx[42].value)) {
					option_1.__value = option_1_value_value;
					set_input_value(option_1, option_1.__value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(option_1);
				}
			}
		};
	}

	// (292:24) {#each options as option}
	function create_each_block_1$1(ctx) {
		let option_1;
		let t_value = /*option*/ ctx[42].label + "";
		let t;
		let option_1_value_value;

		return {
			c() {
				option_1 = element("option");
				t = text(t_value);
				option_1.__value = option_1_value_value = /*option*/ ctx[42].value;
				set_input_value(option_1, option_1.__value);
			},
			m(target, anchor) {
				insert(target, option_1, anchor);
				append(option_1, t);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*options*/ 8192 && t_value !== (t_value = /*option*/ ctx[42].label + "")) set_data(t, t_value);

				if (dirty[0] & /*options*/ 8192 && option_1_value_value !== (option_1_value_value = /*option*/ ctx[42].value)) {
					option_1.__value = option_1_value_value;
					set_input_value(option_1, option_1.__value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(option_1);
				}
			}
		};
	}

	// (237:16) {#each options as option}
	function create_each_block$1(ctx) {
		let input;
		let input_name_value;
		let input_value_value;
		let value_has_changed = false;
		let t0;
		let t1_value = /*option*/ ctx[42].label + "";
		let t1;
		let br;
		let binding_group;
		let mounted;
		let dispose;
		binding_group = init_binding_group(/*$$binding_groups*/ ctx[37][0]);

		return {
			c() {
				input = element("input");
				t0 = text(" ");
				t1 = text(t1_value);
				br = element("br");
				attr(input, "type", "radio");
				attr(input, "name", input_name_value = /*option*/ ctx[42].name);
				input.__value = input_value_value = /*option*/ ctx[42].value;
				set_input_value(input, input.__value);
				binding_group.p(input);
			},
			m(target, anchor) {
				insert(target, input, anchor);
				input.checked = input.__value === /*value*/ ctx[0];
				insert(target, t0, anchor);
				insert(target, t1, anchor);
				insert(target, br, anchor);

				if (!mounted) {
					dispose = listen(input, "change", /*input_change_handler_1*/ ctx[36]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*options*/ 8192 && input_name_value !== (input_name_value = /*option*/ ctx[42].name)) {
					attr(input, "name", input_name_value);
				}

				if (dirty[0] & /*options*/ 8192 && input_value_value !== (input_value_value = /*option*/ ctx[42].value)) {
					input.__value = input_value_value;
					set_input_value(input, input.__value);
					value_has_changed = true;
				}

				if (value_has_changed || dirty[0] & /*value, options*/ 8193) {
					input.checked = input.__value === /*value*/ ctx[0];
				}

				if (dirty[0] & /*options*/ 8192 && t1_value !== (t1_value = /*option*/ ctx[42].label + "")) set_data(t1, t1_value);
			},
			d(detaching) {
				if (detaching) {
					detach(input);
					detach(t0);
					detach(t1);
					detach(br);
				}

				binding_group.r();
				mounted = false;
				dispose();
			}
		};
	}

	// (322:12) {#if description}
	function create_if_block_1$2(ctx) {
		let p;
		let t;

		return {
			c() {
				p = element("p");
				t = text(/*description*/ ctx[9]);
				attr(p, "class", "description");
			},
			m(target, anchor) {
				insert(target, p, anchor);
				append(p, t);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*description*/ 512) set_data(t, /*description*/ ctx[9]);
			},
			d(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	function create_fragment$2(ctx) {
		let if_block_anchor;

		function select_block_type(ctx, dirty) {
			if (/*type*/ ctx[7] === "hidden") return create_if_block$2;
			return create_else_block$1;
		}

		let current_block_type = select_block_type(ctx);
		let if_block = current_block_type(ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
			},
			p(ctx, dirty) {
				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block.d(1);
					if_block = current_block_type(ctx);

					if (if_block) {
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_block.d(detaching);
			}
		};
	}

	function parse_date(d) {
		const date = new Date(d);
		const year = date.getFullYear();
		const month = date.getMonth() + 1;
		const day = date.getDate();
		return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
	}

	function instance$2($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"id","name","label","type","value","placeholder","description","required","readonly","disabled","options","multiple","checked","min","max","step","pattern","rows","cols","wrap"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { id = null } = $$props;
		let { name = null } = $$props;
		let { label = "" } = $$props;
		let { type = "text" } = $$props;
		let { value = "" } = $$props;
		let { placeholder = "" } = $$props;
		let { description = "" } = $$props;
		let { required = false } = $$props;
		let { readonly = false } = $$props;
		let { disabled = false } = $$props;
		let { options = [] } = $$props;
		let { multiple = false } = $$props;
		let { checked = false } = $$props;
		let { min = null } = $$props;
		let { max = null } = $$props;
		let { step = null } = $$props;
		let { pattern = null } = $$props;
		let { rows = null } = $$props;
		let { cols = null } = $$props;
		let { wrap = null } = $$props;
		const $$binding_groups = [[]];

		function input_input_handler() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_1() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_2() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_3() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_4() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_5() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_6() {
			value = to_number(this.value);
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_change_input_handler() {
			value = to_number(this.value);
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_7() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_8() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_9() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_10() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_11() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_input_handler_12() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_change_handler() {
			checked = this.checked;
			$$invalidate(3, checked);
		}

		function input_change_handler_1() {
			value = this.__value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function input_change_handler_2() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function select_change_handler() {
			value = select_multiple_value(this);
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function select_change_handler_1() {
			value = select_value(this);
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		function textarea_input_handler() {
			value = this.value;
			((($$invalidate(0, value), $$invalidate(7, type)), $$invalidate(1, min)), $$invalidate(2, max));
			$$invalidate(13, options);
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(20, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('id' in $$new_props) $$invalidate(4, id = $$new_props.id);
			if ('name' in $$new_props) $$invalidate(5, name = $$new_props.name);
			if ('label' in $$new_props) $$invalidate(6, label = $$new_props.label);
			if ('type' in $$new_props) $$invalidate(7, type = $$new_props.type);
			if ('value' in $$new_props) $$invalidate(0, value = $$new_props.value);
			if ('placeholder' in $$new_props) $$invalidate(8, placeholder = $$new_props.placeholder);
			if ('description' in $$new_props) $$invalidate(9, description = $$new_props.description);
			if ('required' in $$new_props) $$invalidate(10, required = $$new_props.required);
			if ('readonly' in $$new_props) $$invalidate(11, readonly = $$new_props.readonly);
			if ('disabled' in $$new_props) $$invalidate(12, disabled = $$new_props.disabled);
			if ('options' in $$new_props) $$invalidate(13, options = $$new_props.options);
			if ('multiple' in $$new_props) $$invalidate(14, multiple = $$new_props.multiple);
			if ('checked' in $$new_props) $$invalidate(3, checked = $$new_props.checked);
			if ('min' in $$new_props) $$invalidate(1, min = $$new_props.min);
			if ('max' in $$new_props) $$invalidate(2, max = $$new_props.max);
			if ('step' in $$new_props) $$invalidate(15, step = $$new_props.step);
			if ('pattern' in $$new_props) $$invalidate(16, pattern = $$new_props.pattern);
			if ('rows' in $$new_props) $$invalidate(17, rows = $$new_props.rows);
			if ('cols' in $$new_props) $$invalidate(18, cols = $$new_props.cols);
			if ('wrap' in $$new_props) $$invalidate(19, wrap = $$new_props.wrap);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*type, value, min, max*/ 135) {
				if (type === "date" && value) {
					$$invalidate(0, value = parse_date(value));
					if (min) $$invalidate(1, min = parse_date(min));
					if (max) $$invalidate(2, max = parse_date(max));
				}
			}
		};

		return [
			value,
			min,
			max,
			checked,
			id,
			name,
			label,
			type,
			placeholder,
			description,
			required,
			readonly,
			disabled,
			options,
			multiple,
			step,
			pattern,
			rows,
			cols,
			wrap,
			$$restProps,
			input_input_handler,
			input_input_handler_1,
			input_input_handler_2,
			input_input_handler_3,
			input_input_handler_4,
			input_input_handler_5,
			input_input_handler_6,
			input_change_input_handler,
			input_input_handler_7,
			input_input_handler_8,
			input_input_handler_9,
			input_input_handler_10,
			input_input_handler_11,
			input_input_handler_12,
			input_change_handler,
			input_change_handler_1,
			$$binding_groups,
			input_change_handler_2,
			select_change_handler,
			select_change_handler_1,
			textarea_input_handler
		];
	}

	class FormInput extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance$2,
				create_fragment$2,
				safe_not_equal,
				{
					id: 4,
					name: 5,
					label: 6,
					type: 7,
					value: 0,
					placeholder: 8,
					description: 9,
					required: 10,
					readonly: 11,
					disabled: 12,
					options: 13,
					multiple: 14,
					checked: 3,
					min: 1,
					max: 2,
					step: 15,
					pattern: 16,
					rows: 17,
					cols: 18,
					wrap: 19
				},
				null,
				[-1, -1]
			);
		}
	}

	/* src/components/OpenAITypeSettings.svelte generated by Svelte v4.2.19 */

	function create_if_block_2$1(ctx) {
		let option0;
		let option1;
		let option2;
		let option3;
		let option4;

		return {
			c() {
				option0 = element("option");
				option0.textContent = "GPT-4o-mini (Recommended)";
				option1 = element("option");
				option1.textContent = "GPT-4o";
				option2 = element("option");
				option2.textContent = "GPT-4";
				option3 = element("option");
				option3.textContent = "GPT-4-turbo";
				option4 = element("option");
				option4.textContent = "gpt-3.5-turbo";
				option0.__value = "gpt-4o-mini";
				set_input_value(option0, option0.__value);
				option1.__value = "gpt-4o";
				set_input_value(option1, option1.__value);
				option2.__value = "gpt-4";
				set_input_value(option2, option2.__value);
				option3.__value = "gpt-4-turbo";
				set_input_value(option3, option3.__value);
				option4.__value = "gpt-3.5-turbo";
				set_input_value(option4, option4.__value);
			},
			m(target, anchor) {
				insert(target, option0, anchor);
				insert(target, option1, anchor);
				insert(target, option2, anchor);
				insert(target, option3, anchor);
				insert(target, option4, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(option0);
					detach(option1);
					detach(option2);
					detach(option3);
					detach(option4);
				}
			}
		};
	}

	// (37:12) {#if settings.openai_method === "complete"}
	function create_if_block_1$1(ctx) {
		let option0;
		let option1;
		let option2;
		let option3;
		let option4;

		return {
			c() {
				option0 = element("option");
				option0.textContent = "Text-Davinci-003";
				option1 = element("option");
				option1.textContent = "Text-Davinci-002";
				option2 = element("option");
				option2.textContent = "Text-Curie-001";
				option3 = element("option");
				option3.textContent = "Text-Babbage-001";
				option4 = element("option");
				option4.textContent = "Text-Ada-001";
				option0.__value = "text-davinci-003";
				set_input_value(option0, option0.__value);
				option1.__value = "text-davinci-002";
				set_input_value(option1, option1.__value);
				option2.__value = "text-curie-001";
				set_input_value(option2, option2.__value);
				option3.__value = "text-babbage-001";
				set_input_value(option3, option3.__value);
				option4.__value = "text-ada-001";
				set_input_value(option4, option4.__value);
			},
			m(target, anchor) {
				insert(target, option0, anchor);
				insert(target, option1, anchor);
				insert(target, option2, anchor);
				insert(target, option3, anchor);
				insert(target, option4, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(option0);
					detach(option1);
					detach(option2);
					detach(option3);
					detach(option4);
				}
			}
		};
	}

	// (53:0) {#if settings.openai_method === "chat"}
	function create_if_block$1(ctx) {
		let forminput;
		let updating_value;
		let current;

		function forminput_value_binding(value) {
			/*forminput_value_binding*/ ctx[5](value);
		}

		let forminput_props = {
			type: "textarea",
			label: "User description",
			description: "Describe yourself, eg. 'I am a journalist for the Daily Maverick.'",
			cols: 40,
			rows: 5
		};

		if (/*settings*/ ctx[0].openai_system !== void 0) {
			forminput_props.value = /*settings*/ ctx[0].openai_system;
		}

		forminput = new FormInput({ props: forminput_props });
		binding_callbacks.push(() => bind(forminput, 'value', forminput_value_binding));

		return {
			c() {
				create_component(forminput.$$.fragment);
			},
			m(target, anchor) {
				mount_component(forminput, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const forminput_changes = {};

				if (!updating_value && dirty & /*settings*/ 1) {
					updating_value = true;
					forminput_changes.value = /*settings*/ ctx[0].openai_system;
					add_flush_callback(() => updating_value = false);
				}

				forminput.$set(forminput_changes);
			},
			i(local) {
				if (current) return;
				transition_in(forminput.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(forminput.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(forminput, detaching);
			}
		};
	}

	function create_fragment$1(ctx) {
		let forminput0;
		let updating_value;
		let t0;
		let forminput1;
		let updating_value_1;
		let t1;
		let tr0;
		let th0;
		let t3;
		let td0;
		let select0;
		let option0;
		let option1;
		let t6;
		let tr1;
		let th1;
		let t8;
		let td1;
		let select1;
		let t9;
		let t10;
		let forminput2;
		let updating_value_2;
		let t11;
		let tr2;
		let th2;
		let t13;
		let td2;
		let input;
		let t14;
		let forminput3;
		let updating_value_3;
		let t15;
		let forminput4;
		let updating_value_4;
		let t16;
		let forminput5;
		let updating_value_5;
		let t17;
		let forminput6;
		let updating_value_6;
		let t18;
		let forminput7;
		let updating_value_7;
		let current;
		let mounted;
		let dispose;

		function forminput0_value_binding(value) {
			/*forminput0_value_binding*/ ctx[1](value);
		}

		let forminput0_props = {
			label: "Prepend prompt",
			type: "textarea",
			description: "The instruction to the model on what you'd like to generate, prepended.",
			required: true,
			cols: 40,
			rows: 5
		};

		if (/*settings*/ ctx[0].prompt !== void 0) {
			forminput0_props.value = /*settings*/ ctx[0].prompt;
		}

		forminput0 = new FormInput({ props: forminput0_props });
		binding_callbacks.push(() => bind(forminput0, 'value', forminput0_value_binding));

		function forminput1_value_binding(value) {
			/*forminput1_value_binding*/ ctx[2](value);
		}

		let forminput1_props = {
			label: "Append prompt",
			type: "textarea",
			description: "The instruction to the model on what you'd like to generate, appended.",
			required: true,
			cols: 40,
			rows: 5
		};

		if (/*settings*/ ctx[0].append_prompt !== void 0) {
			forminput1_props.value = /*settings*/ ctx[0].append_prompt;
		}

		forminput1 = new FormInput({ props: forminput1_props });
		binding_callbacks.push(() => bind(forminput1, 'value', forminput1_value_binding));

		function select_block_type(ctx, dirty) {
			if (/*settings*/ ctx[0].openai_method === "complete") return create_if_block_1$1;
			if (/*settings*/ ctx[0].openai_method === "chat") return create_if_block_2$1;
		}

		let current_block_type = select_block_type(ctx);
		let if_block0 = current_block_type && current_block_type(ctx);
		let if_block1 = /*settings*/ ctx[0].openai_method === "chat" && create_if_block$1(ctx);

		function forminput2_value_binding(value) {
			/*forminput2_value_binding*/ ctx[6](value);
		}

		let forminput2_props = {
			type: "number",
			label: "Submission word limit",
			min: 0
		};

		if (/*settings*/ ctx[0].word_limit !== void 0) {
			forminput2_props.value = /*settings*/ ctx[0].word_limit;
		}

		forminput2 = new FormInput({ props: forminput2_props });
		binding_callbacks.push(() => bind(forminput2, 'value', forminput2_value_binding));

		function forminput3_value_binding(value) {
			/*forminput3_value_binding*/ ctx[8](value);
		}

		let forminput3_props = {
			type: "number",
			label: "Max tokens",
			min: 0,
			max: 2048,
			step: 1,
			description: "The maximum number of tokens to generate in the completion."
		};

		if (/*settings*/ ctx[0].openai_max_tokens !== void 0) {
			forminput3_props.value = /*settings*/ ctx[0].openai_max_tokens;
		}

		forminput3 = new FormInput({ props: forminput3_props });
		binding_callbacks.push(() => bind(forminput3, 'value', forminput3_value_binding));

		function forminput4_value_binding(value) {
			/*forminput4_value_binding*/ ctx[9](value);
		}

		let forminput4_props = {
			type: "number",
			label: "Temperature",
			min: 0,
			max: 1,
			step: 0.1,
			description: "What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both."
		};

		if (/*settings*/ ctx[0].openai_temperature !== void 0) {
			forminput4_props.value = /*settings*/ ctx[0].openai_temperature;
		}

		forminput4 = new FormInput({ props: forminput4_props });
		binding_callbacks.push(() => bind(forminput4, 'value', forminput4_value_binding));

		function forminput5_value_binding(value) {
			/*forminput5_value_binding*/ ctx[10](value);
		}

		let forminput5_props = {
			type: "number",
			label: "Top-P",
			min: 0,
			max: 1,
			step: 0.1,
			description: "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both."
		};

		if (/*settings*/ ctx[0].openai_top_p !== void 0) {
			forminput5_props.value = /*settings*/ ctx[0].openai_top_p;
		}

		forminput5 = new FormInput({ props: forminput5_props });
		binding_callbacks.push(() => bind(forminput5, 'value', forminput5_value_binding));

		function forminput6_value_binding(value) {
			/*forminput6_value_binding*/ ctx[11](value);
		}

		let forminput6_props = {
			label: "Presence penalty",
			type: "number",
			min: -2,
			max: 2,
			step: 0.1,
			description: "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics."
		};

		if (/*settings*/ ctx[0].openai_presence_penalty !== void 0) {
			forminput6_props.value = /*settings*/ ctx[0].openai_presence_penalty;
		}

		forminput6 = new FormInput({ props: forminput6_props });
		binding_callbacks.push(() => bind(forminput6, 'value', forminput6_value_binding));

		function forminput7_value_binding(value) {
			/*forminput7_value_binding*/ ctx[12](value);
		}

		let forminput7_props = {
			label: "Frequency penalty",
			type: "number",
			min: -2,
			max: 2,
			step: 0.1,
			description: "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim."
		};

		if (/*settings*/ ctx[0].openai_frequency_penalty !== void 0) {
			forminput7_props.value = /*settings*/ ctx[0].openai_frequency_penalty;
		}

		forminput7 = new FormInput({ props: forminput7_props });
		binding_callbacks.push(() => bind(forminput7, 'value', forminput7_value_binding));

		return {
			c() {
				create_component(forminput0.$$.fragment);
				t0 = space();
				create_component(forminput1.$$.fragment);
				t1 = space();
				tr0 = element("tr");
				th0 = element("th");
				th0.textContent = "Method";
				t3 = space();
				td0 = element("td");
				select0 = element("select");
				option0 = element("option");
				option0.textContent = "Complete";
				option1 = element("option");
				option1.textContent = "Chat";
				t6 = space();
				tr1 = element("tr");
				th1 = element("th");
				th1.textContent = "OpenAI model";
				t8 = space();
				td1 = element("td");
				select1 = element("select");
				if (if_block0) if_block0.c();
				t9 = space();
				if (if_block1) if_block1.c();
				t10 = space();
				create_component(forminput2.$$.fragment);
				t11 = space();
				tr2 = element("tr");
				th2 = element("th");
				th2.textContent = "Cut at paragraph nearest end?";
				t13 = space();
				td2 = element("td");
				input = element("input");
				t14 = space();
				create_component(forminput3.$$.fragment);
				t15 = space();
				create_component(forminput4.$$.fragment);
				t16 = space();
				create_component(forminput5.$$.fragment);
				t17 = space();
				create_component(forminput6.$$.fragment);
				t18 = space();
				create_component(forminput7.$$.fragment);
				attr(th0, "scope", "row");
				option0.__value = "complete";
				set_input_value(option0, option0.__value);
				option1.__value = "chat";
				set_input_value(option1, option1.__value);
				attr(select0, "name", "openai_method");
				if (/*settings*/ ctx[0].openai_method === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[3].call(select0));
				attr(th1, "scope", "row");
				attr(select1, "name", "openai_model");
				if (/*settings*/ ctx[0].openai_model === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[4].call(select1));
				attr(th2, "scope", "row");
				attr(input, "type", "checkbox");
				attr(input, "name", "cut_at_paragraph");
			},
			m(target, anchor) {
				mount_component(forminput0, target, anchor);
				insert(target, t0, anchor);
				mount_component(forminput1, target, anchor);
				insert(target, t1, anchor);
				insert(target, tr0, anchor);
				append(tr0, th0);
				append(tr0, t3);
				append(tr0, td0);
				append(td0, select0);
				append(select0, option0);
				append(select0, option1);
				select_option(select0, /*settings*/ ctx[0].openai_method, true);
				insert(target, t6, anchor);
				insert(target, tr1, anchor);
				append(tr1, th1);
				append(tr1, t8);
				append(tr1, td1);
				append(td1, select1);
				if (if_block0) if_block0.m(select1, null);
				select_option(select1, /*settings*/ ctx[0].openai_model, true);
				insert(target, t9, anchor);
				if (if_block1) if_block1.m(target, anchor);
				insert(target, t10, anchor);
				mount_component(forminput2, target, anchor);
				insert(target, t11, anchor);
				insert(target, tr2, anchor);
				append(tr2, th2);
				append(tr2, t13);
				append(tr2, td2);
				append(td2, input);
				input.checked = /*settings*/ ctx[0].cut_at_paragraph;
				insert(target, t14, anchor);
				mount_component(forminput3, target, anchor);
				insert(target, t15, anchor);
				mount_component(forminput4, target, anchor);
				insert(target, t16, anchor);
				mount_component(forminput5, target, anchor);
				insert(target, t17, anchor);
				mount_component(forminput6, target, anchor);
				insert(target, t18, anchor);
				mount_component(forminput7, target, anchor);
				current = true;

				if (!mounted) {
					dispose = [
						listen(select0, "change", /*select0_change_handler*/ ctx[3]),
						listen(select1, "change", /*select1_change_handler*/ ctx[4]),
						listen(input, "change", /*input_change_handler*/ ctx[7])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				const forminput0_changes = {};

				if (!updating_value && dirty & /*settings*/ 1) {
					updating_value = true;
					forminput0_changes.value = /*settings*/ ctx[0].prompt;
					add_flush_callback(() => updating_value = false);
				}

				forminput0.$set(forminput0_changes);
				const forminput1_changes = {};

				if (!updating_value_1 && dirty & /*settings*/ 1) {
					updating_value_1 = true;
					forminput1_changes.value = /*settings*/ ctx[0].append_prompt;
					add_flush_callback(() => updating_value_1 = false);
				}

				forminput1.$set(forminput1_changes);

				if (dirty & /*settings*/ 1) {
					select_option(select0, /*settings*/ ctx[0].openai_method);
				}

				if (current_block_type !== (current_block_type = select_block_type(ctx))) {
					if (if_block0) if_block0.d(1);
					if_block0 = current_block_type && current_block_type(ctx);

					if (if_block0) {
						if_block0.c();
						if_block0.m(select1, null);
					}
				}

				if (dirty & /*settings*/ 1) {
					select_option(select1, /*settings*/ ctx[0].openai_model);
				}

				if (/*settings*/ ctx[0].openai_method === "chat") {
					if (if_block1) {
						if_block1.p(ctx, dirty);

						if (dirty & /*settings*/ 1) {
							transition_in(if_block1, 1);
						}
					} else {
						if_block1 = create_if_block$1(ctx);
						if_block1.c();
						transition_in(if_block1, 1);
						if_block1.m(t10.parentNode, t10);
					}
				} else if (if_block1) {
					group_outros();

					transition_out(if_block1, 1, 1, () => {
						if_block1 = null;
					});

					check_outros();
				}

				const forminput2_changes = {};

				if (!updating_value_2 && dirty & /*settings*/ 1) {
					updating_value_2 = true;
					forminput2_changes.value = /*settings*/ ctx[0].word_limit;
					add_flush_callback(() => updating_value_2 = false);
				}

				forminput2.$set(forminput2_changes);

				if (dirty & /*settings*/ 1) {
					input.checked = /*settings*/ ctx[0].cut_at_paragraph;
				}

				const forminput3_changes = {};

				if (!updating_value_3 && dirty & /*settings*/ 1) {
					updating_value_3 = true;
					forminput3_changes.value = /*settings*/ ctx[0].openai_max_tokens;
					add_flush_callback(() => updating_value_3 = false);
				}

				forminput3.$set(forminput3_changes);
				const forminput4_changes = {};

				if (!updating_value_4 && dirty & /*settings*/ 1) {
					updating_value_4 = true;
					forminput4_changes.value = /*settings*/ ctx[0].openai_temperature;
					add_flush_callback(() => updating_value_4 = false);
				}

				forminput4.$set(forminput4_changes);
				const forminput5_changes = {};

				if (!updating_value_5 && dirty & /*settings*/ 1) {
					updating_value_5 = true;
					forminput5_changes.value = /*settings*/ ctx[0].openai_top_p;
					add_flush_callback(() => updating_value_5 = false);
				}

				forminput5.$set(forminput5_changes);
				const forminput6_changes = {};

				if (!updating_value_6 && dirty & /*settings*/ 1) {
					updating_value_6 = true;
					forminput6_changes.value = /*settings*/ ctx[0].openai_presence_penalty;
					add_flush_callback(() => updating_value_6 = false);
				}

				forminput6.$set(forminput6_changes);
				const forminput7_changes = {};

				if (!updating_value_7 && dirty & /*settings*/ 1) {
					updating_value_7 = true;
					forminput7_changes.value = /*settings*/ ctx[0].openai_frequency_penalty;
					add_flush_callback(() => updating_value_7 = false);
				}

				forminput7.$set(forminput7_changes);
			},
			i(local) {
				if (current) return;
				transition_in(forminput0.$$.fragment, local);
				transition_in(forminput1.$$.fragment, local);
				transition_in(if_block1);
				transition_in(forminput2.$$.fragment, local);
				transition_in(forminput3.$$.fragment, local);
				transition_in(forminput4.$$.fragment, local);
				transition_in(forminput5.$$.fragment, local);
				transition_in(forminput6.$$.fragment, local);
				transition_in(forminput7.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(forminput0.$$.fragment, local);
				transition_out(forminput1.$$.fragment, local);
				transition_out(if_block1);
				transition_out(forminput2.$$.fragment, local);
				transition_out(forminput3.$$.fragment, local);
				transition_out(forminput4.$$.fragment, local);
				transition_out(forminput5.$$.fragment, local);
				transition_out(forminput6.$$.fragment, local);
				transition_out(forminput7.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(tr0);
					detach(t6);
					detach(tr1);
					detach(t9);
					detach(t10);
					detach(t11);
					detach(tr2);
					detach(t14);
					detach(t15);
					detach(t16);
					detach(t17);
					detach(t18);
				}

				destroy_component(forminput0, detaching);
				destroy_component(forminput1, detaching);

				if (if_block0) {
					if_block0.d();
				}

				if (if_block1) if_block1.d(detaching);
				destroy_component(forminput2, detaching);
				destroy_component(forminput3, detaching);
				destroy_component(forminput4, detaching);
				destroy_component(forminput5, detaching);
				destroy_component(forminput6, detaching);
				destroy_component(forminput7, detaching);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let { settings } = $$props;

		function forminput0_value_binding(value) {
			if ($$self.$$.not_equal(settings.prompt, value)) {
				settings.prompt = value;
				$$invalidate(0, settings);
			}
		}

		function forminput1_value_binding(value) {
			if ($$self.$$.not_equal(settings.append_prompt, value)) {
				settings.append_prompt = value;
				$$invalidate(0, settings);
			}
		}

		function select0_change_handler() {
			settings.openai_method = select_value(this);
			$$invalidate(0, settings);
		}

		function select1_change_handler() {
			settings.openai_model = select_value(this);
			$$invalidate(0, settings);
		}

		function forminput_value_binding(value) {
			if ($$self.$$.not_equal(settings.openai_system, value)) {
				settings.openai_system = value;
				$$invalidate(0, settings);
			}
		}

		function forminput2_value_binding(value) {
			if ($$self.$$.not_equal(settings.word_limit, value)) {
				settings.word_limit = value;
				$$invalidate(0, settings);
			}
		}

		function input_change_handler() {
			settings.cut_at_paragraph = this.checked;
			$$invalidate(0, settings);
		}

		function forminput3_value_binding(value) {
			if ($$self.$$.not_equal(settings.openai_max_tokens, value)) {
				settings.openai_max_tokens = value;
				$$invalidate(0, settings);
			}
		}

		function forminput4_value_binding(value) {
			if ($$self.$$.not_equal(settings.openai_temperature, value)) {
				settings.openai_temperature = value;
				$$invalidate(0, settings);
			}
		}

		function forminput5_value_binding(value) {
			if ($$self.$$.not_equal(settings.openai_top_p, value)) {
				settings.openai_top_p = value;
				$$invalidate(0, settings);
			}
		}

		function forminput6_value_binding(value) {
			if ($$self.$$.not_equal(settings.openai_presence_penalty, value)) {
				settings.openai_presence_penalty = value;
				$$invalidate(0, settings);
			}
		}

		function forminput7_value_binding(value) {
			if ($$self.$$.not_equal(settings.openai_frequency_penalty, value)) {
				settings.openai_frequency_penalty = value;
				$$invalidate(0, settings);
			}
		}

		$$self.$$set = $$props => {
			if ('settings' in $$props) $$invalidate(0, settings = $$props.settings);
		};

		return [
			settings,
			forminput0_value_binding,
			forminput1_value_binding,
			select0_change_handler,
			select1_change_handler,
			forminput_value_binding,
			forminput2_value_binding,
			input_change_handler,
			forminput3_value_binding,
			forminput4_value_binding,
			forminput5_value_binding,
			forminput6_value_binding,
			forminput7_value_binding
		];
	}

	class OpenAITypeSettings extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$1, create_fragment$1, safe_not_equal, { settings: 0 });
		}
	}

	/* src/components/Types.svelte generated by Svelte v4.2.19 */

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[21] = list[i];
		child_ctx[22] = list;
		child_ctx[23] = i;
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[21] = list[i];
		child_ctx[23] = i;
		return child_ctx;
	}

	// (114:0) {#if has_error}
	function create_if_block_6(ctx) {
		let div;
		let p;
		let t;

		return {
			c() {
				div = element("div");
				p = element("p");
				t = text(/*error_message*/ ctx[7]);
				attr(div, "class", "notice notice-error is-dismissible");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, p);
				append(p, t);
			},
			p(ctx, dirty) {
				if (dirty & /*error_message*/ 128) set_data(t, /*error_message*/ ctx[7]);
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (121:4) {#each $types as type, i}
	function create_each_block_1(ctx) {
		let a;
		let t_value = /*type*/ ctx[21].name + "";
		let t;
		let a_href_value;
		let mounted;
		let dispose;

		function click_handler() {
			return /*click_handler*/ ctx[10](/*i*/ ctx[23]);
		}

		return {
			c() {
				a = element("a");
				t = text(t_value);
				attr(a, "href", a_href_value = "#type-" + /*type*/ ctx[21].ID);
				attr(a, "class", "nav-tab");
				toggle_class(a, "nav-tab-active", /*tab*/ ctx[1] === /*i*/ ctx[23]);
			},
			m(target, anchor) {
				insert(target, a, anchor);
				append(a, t);

				if (!mounted) {
					dispose = listen(a, "click", click_handler);
					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				if (dirty & /*$types*/ 1 && t_value !== (t_value = /*type*/ ctx[21].name + "")) set_data(t, t_value);

				if (dirty & /*$types*/ 1 && a_href_value !== (a_href_value = "#type-" + /*type*/ ctx[21].ID)) {
					attr(a, "href", a_href_value);
				}

				if (dirty & /*tab*/ 2) {
					toggle_class(a, "nav-tab-active", /*tab*/ ctx[1] === /*i*/ ctx[23]);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(a);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (132:4) {#if tab === i}
	function create_if_block(ctx) {
		let div;
		let h2;
		let t0_value = /*type*/ ctx[21].name + "";
		let t0;
		let t1;
		let t2;
		let t3;
		let table;
		let tbody;
		let tr0;
		let th0;
		let t5;
		let td0;
		let input0;
		let t6;
		let tr1;
		let th1;
		let t8;
		let td1;
		let input1;
		let t9;
		let openaitypesettings;
		let updating_settings;
		let t10;
		let tr2;
		let th2;
		let t12;
		let td2;
		let textarea;
		let t13;
		let p;
		let t15;
		let t16;
		let show_if = Number(/*type*/ ctx[21].ID) !== 1 && !/*deleting*/ ctx[5];
		let t17;
		let t18;
		let if_block4_anchor;
		let current;
		let mounted;
		let dispose;
		let if_block0 = /*saved*/ ctx[3] && create_if_block_5(ctx);

		function input0_input_handler() {
			/*input0_input_handler*/ ctx[11].call(input0, /*each_value*/ ctx[22], /*i*/ ctx[23]);
		}

		function input1_input_handler() {
			/*input1_input_handler*/ ctx[12].call(input1, /*each_value*/ ctx[22], /*i*/ ctx[23]);
		}

		function openaitypesettings_settings_binding(value) {
			/*openaitypesettings_settings_binding*/ ctx[13](value, /*type*/ ctx[21], /*each_value*/ ctx[22], /*i*/ ctx[23]);
		}

		let openaitypesettings_props = {};

		if (/*type*/ ctx[21] !== void 0) {
			openaitypesettings_props.settings = /*type*/ ctx[21];
		}

		openaitypesettings = new OpenAITypeSettings({ props: openaitypesettings_props });
		binding_callbacks.push(() => bind(openaitypesettings, 'settings', openaitypesettings_settings_binding));

		function textarea_input_handler() {
			/*textarea_input_handler*/ ctx[14].call(textarea, /*each_value*/ ctx[22], /*i*/ ctx[23]);
		}

		function select_block_type(ctx, dirty) {
			if (!/*saving*/ ctx[2]) return create_if_block_4;
			return create_else_block;
		}

		let current_block_type = select_block_type(ctx);
		let if_block1 = current_block_type(ctx);
		let if_block2 = show_if && create_if_block_3(ctx);
		let if_block3 = /*deleting*/ ctx[5] && create_if_block_2();
		let if_block4 = /*pending_delete*/ ctx[4] && create_if_block_1(ctx);

		return {
			c() {
				div = element("div");
				h2 = element("h2");
				t0 = text(t0_value);
				t1 = text(" Settings");
				t2 = space();
				if (if_block0) if_block0.c();
				t3 = space();
				table = element("table");
				tbody = element("tbody");
				tr0 = element("tr");
				th0 = element("th");
				th0.innerHTML = `<label for="name">Name</label>`;
				t5 = space();
				td0 = element("td");
				input0 = element("input");
				t6 = space();
				tr1 = element("tr");
				th1 = element("th");
				th1.innerHTML = `<label for="slug">Slug</label>`;
				t8 = space();
				td1 = element("td");
				input1 = element("input");
				t9 = space();
				create_component(openaitypesettings.$$.fragment);
				t10 = space();
				tr2 = element("tr");
				th2 = element("th");
				th2.textContent = "Custom action";
				t12 = space();
				td2 = element("td");
				textarea = element("textarea");
				t13 = space();
				p = element("p");
				p.textContent = "Call a custom action based on the summary and\n                                post, eg. post to Twitter. Use [post_url] and\n                                [summary], and [summary_encoded] as variables.";
				t15 = space();
				if_block1.c();
				t16 = space();
				if (if_block2) if_block2.c();
				t17 = space();
				if (if_block3) if_block3.c();
				t18 = space();
				if (if_block4) if_block4.c();
				if_block4_anchor = empty();
				attr(th0, "scope", "row");
				attr(input0, "type", "text");
				attr(input0, "name", "name");
				attr(input0, "id", "name");
				attr(th1, "scope", "row");
				attr(input1, "type", "text");
				attr(input1, "name", "slug");
				attr(input1, "id", "slug");
				input1.readOnly = true;
				attr(th2, "scope", "row");
				attr(textarea, "name", "custom_action");
				attr(textarea, "class", "regular-text");
				attr(table, "class", "form-table");
				attr(div, "class", "tab-content");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, h2);
				append(h2, t0);
				append(h2, t1);
				append(div, t2);
				if (if_block0) if_block0.m(div, null);
				append(div, t3);
				append(div, table);
				append(table, tbody);
				append(tbody, tr0);
				append(tr0, th0);
				append(tr0, t5);
				append(tr0, td0);
				append(td0, input0);
				set_input_value(input0, /*type*/ ctx[21].name);
				append(tbody, t6);
				append(tbody, tr1);
				append(tr1, th1);
				append(tr1, t8);
				append(tr1, td1);
				append(td1, input1);
				set_input_value(input1, /*type*/ ctx[21].slug);
				append(tbody, t9);
				mount_component(openaitypesettings, tbody, null);
				append(tbody, t10);
				append(tbody, tr2);
				append(tr2, th2);
				append(tr2, t12);
				append(tr2, td2);
				append(td2, textarea);
				set_input_value(textarea, /*type*/ ctx[21].custom_action);
				append(td2, t13);
				append(td2, p);
				insert(target, t15, anchor);
				if_block1.m(target, anchor);
				insert(target, t16, anchor);
				if (if_block2) if_block2.m(target, anchor);
				insert(target, t17, anchor);
				if (if_block3) if_block3.m(target, anchor);
				insert(target, t18, anchor);
				if (if_block4) if_block4.m(target, anchor);
				insert(target, if_block4_anchor, anchor);
				current = true;

				if (!mounted) {
					dispose = [
						listen(input0, "input", input0_input_handler),
						listen(input1, "input", input1_input_handler),
						listen(textarea, "input", textarea_input_handler)
					];

					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				if ((!current || dirty & /*$types*/ 1) && t0_value !== (t0_value = /*type*/ ctx[21].name + "")) set_data(t0, t0_value);

				if (/*saved*/ ctx[3]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);

						if (dirty & /*saved*/ 8) {
							transition_in(if_block0, 1);
						}
					} else {
						if_block0 = create_if_block_5(ctx);
						if_block0.c();
						transition_in(if_block0, 1);
						if_block0.m(div, t3);
					}
				} else if (if_block0) {
					group_outros();

					transition_out(if_block0, 1, 1, () => {
						if_block0 = null;
					});

					check_outros();
				}

				if (dirty & /*$types*/ 1 && input0.value !== /*type*/ ctx[21].name) {
					set_input_value(input0, /*type*/ ctx[21].name);
				}

				if (dirty & /*$types*/ 1 && input1.value !== /*type*/ ctx[21].slug) {
					set_input_value(input1, /*type*/ ctx[21].slug);
				}

				const openaitypesettings_changes = {};

				if (!updating_settings && dirty & /*$types*/ 1) {
					updating_settings = true;
					openaitypesettings_changes.settings = /*type*/ ctx[21];
					add_flush_callback(() => updating_settings = false);
				}

				openaitypesettings.$set(openaitypesettings_changes);

				if (dirty & /*$types*/ 1) {
					set_input_value(textarea, /*type*/ ctx[21].custom_action);
				}

				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1.d(1);
					if_block1 = current_block_type(ctx);

					if (if_block1) {
						if_block1.c();
						if_block1.m(t16.parentNode, t16);
					}
				}

				if (dirty & /*$types, deleting*/ 33) show_if = Number(/*type*/ ctx[21].ID) !== 1 && !/*deleting*/ ctx[5];

				if (show_if) {
					if (if_block2) {
						if_block2.p(ctx, dirty);
					} else {
						if_block2 = create_if_block_3(ctx);
						if_block2.c();
						if_block2.m(t17.parentNode, t17);
					}
				} else if (if_block2) {
					if_block2.d(1);
					if_block2 = null;
				}

				if (/*deleting*/ ctx[5]) {
					if (if_block3) ; else {
						if_block3 = create_if_block_2();
						if_block3.c();
						if_block3.m(t18.parentNode, t18);
					}
				} else if (if_block3) {
					if_block3.d(1);
					if_block3 = null;
				}

				if (/*pending_delete*/ ctx[4]) {
					if (if_block4) {
						if_block4.p(ctx, dirty);
					} else {
						if_block4 = create_if_block_1(ctx);
						if_block4.c();
						if_block4.m(if_block4_anchor.parentNode, if_block4_anchor);
					}
				} else if (if_block4) {
					if_block4.d(1);
					if_block4 = null;
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block0);
				transition_in(openaitypesettings.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(if_block0);
				transition_out(openaitypesettings.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
					detach(t15);
					detach(t16);
					detach(t17);
					detach(t18);
					detach(if_block4_anchor);
				}

				if (if_block0) if_block0.d();
				destroy_component(openaitypesettings);
				if_block1.d(detaching);
				if (if_block2) if_block2.d(detaching);
				if (if_block3) if_block3.d(detaching);
				if (if_block4) if_block4.d(detaching);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (135:12) {#if saved}
	function create_if_block_5(ctx) {
		let div;
		let p;
		let t0_value = /*type*/ ctx[21].name + "";
		let t0;
		let t1;
		let div_transition;
		let current;

		return {
			c() {
				div = element("div");
				p = element("p");
				t0 = text(t0_value);
				t1 = text(" saved.");
				attr(div, "class", "notice notice-success is-dismissible");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, p);
				append(p, t0);
				append(p, t1);
				current = true;
			},
			p(ctx, dirty) {
				if ((!current || dirty & /*$types*/ 1) && t0_value !== (t0_value = /*type*/ ctx[21].name + "")) set_data(t0, t0_value);
			},
			i(local) {
				if (current) return;

				if (local) {
					add_render_callback(() => {
						if (!current) return;
						if (!div_transition) div_transition = create_bidirectional_transition(div, slide, {}, true);
						div_transition.run(1);
					});
				}

				current = true;
			},
			o(local) {
				if (local) {
					if (!div_transition) div_transition = create_bidirectional_transition(div, slide, {}, false);
					div_transition.run(0);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				if (detaching && div_transition) div_transition.end();
			}
		};
	}

	// (196:8) {:else}
	function create_else_block(ctx) {
		let input;

		return {
			c() {
				input = element("input");
				attr(input, "type", "submit");
				attr(input, "name", "submit");
				attr(input, "id", "submit");
				attr(input, "class", "button button-primary");
				input.value = "Saving...";
				input.disabled = true;
			},
			m(target, anchor) {
				insert(target, input, anchor);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(input);
				}
			}
		};
	}

	// (187:8) {#if !saving}
	function create_if_block_4(ctx) {
		let input;
		let mounted;
		let dispose;

		function click_handler_1() {
			return /*click_handler_1*/ ctx[15](/*type*/ ctx[21]);
		}

		return {
			c() {
				input = element("input");
				attr(input, "type", "submit");
				attr(input, "name", "submit");
				attr(input, "id", "submit");
				attr(input, "class", "button button-primary");
				input.value = "Save Changes";
			},
			m(target, anchor) {
				insert(target, input, anchor);

				if (!mounted) {
					dispose = listen(input, "click", click_handler_1);
					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (206:8) {#if Number(type.ID) !== 1 && !deleting}
	function create_if_block_3(ctx) {
		let input;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "type", "button");
				attr(input, "name", "delete");
				attr(input, "id", "delete");
				attr(input, "class", "button button-warning svelte-cf9r3l");
				input.value = "Delete";
			},
			m(target, anchor) {
				insert(target, input, anchor);

				if (!mounted) {
					dispose = listen(input, "click", /*click_handler_2*/ ctx[16]);
					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(input);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (216:8) {#if deleting}
	function create_if_block_2(ctx) {
		let input;

		return {
			c() {
				input = element("input");
				attr(input, "type", "button");
				attr(input, "name", "delete");
				attr(input, "id", "delete");
				attr(input, "class", "button button-warning svelte-cf9r3l");
				input.value = "Deleting...";
				input.disabled = true;
			},
			m(target, anchor) {
				insert(target, input, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(input);
				}
			}
		};
	}

	// (226:8) {#if pending_delete}
	function create_if_block_1(ctx) {
		let p;
		let t1;
		let input0;
		let t2;
		let input1;
		let mounted;
		let dispose;

		function click_handler_3() {
			return /*click_handler_3*/ ctx[17](/*type*/ ctx[21]);
		}

		return {
			c() {
				p = element("p");
				p.textContent = "Are you sure you want to delete this type?";
				t1 = space();
				input0 = element("input");
				t2 = space();
				input1 = element("input");
				attr(input0, "type", "button");
				attr(input0, "name", "delete");
				attr(input0, "id", "delete");
				attr(input0, "class", "button button-warning svelte-cf9r3l");
				input0.value = "Yes";
				attr(input1, "type", "button");
				attr(input1, "name", "delete");
				attr(input1, "id", "delete");
				attr(input1, "class", "button button-primary");
				input1.value = "No";
			},
			m(target, anchor) {
				insert(target, p, anchor);
				insert(target, t1, anchor);
				insert(target, input0, anchor);
				insert(target, t2, anchor);
				insert(target, input1, anchor);

				if (!mounted) {
					dispose = [
						listen(input0, "click", click_handler_3),
						listen(input1, "click", /*click_handler_4*/ ctx[18])
					];

					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d(detaching) {
				if (detaching) {
					detach(p);
					detach(t1);
					detach(input0);
					detach(t2);
					detach(input1);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (131:0) {#each $types as type, i}
	function create_each_block(ctx) {
		let if_block_anchor;
		let current;
		let if_block = /*tab*/ ctx[1] === /*i*/ ctx[23] && create_if_block(ctx);

		return {
			c() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (/*tab*/ ctx[1] === /*i*/ ctx[23]) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty & /*tab*/ 2) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if (if_block) if_block.d(detaching);
			}
		};
	}

	function create_fragment(ctx) {
		let t0;
		let nav;
		let t1;
		let each1_anchor;
		let current;
		let if_block = /*has_error*/ ctx[6] && create_if_block_6(ctx);
		let each_value_1 = ensure_array_like(/*$types*/ ctx[0]);
		let each_blocks_1 = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		let each_value = ensure_array_like(/*$types*/ ctx[0]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		return {
			c() {
				if (if_block) if_block.c();
				t0 = space();
				nav = element("nav");

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t1 = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each1_anchor = empty();
				attr(nav, "class", "nav-tab-wrapper");
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, t0, anchor);
				insert(target, nav, anchor);

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(nav, null);
					}
				}

				insert(target, t1, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each1_anchor, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				if (/*has_error*/ ctx[6]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block_6(ctx);
						if_block.c();
						if_block.m(t0.parentNode, t0);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}

				if (dirty & /*$types, tab*/ 3) {
					each_value_1 = ensure_array_like(/*$types*/ ctx[0]);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
						} else {
							each_blocks_1[i] = create_each_block_1(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].m(nav, null);
						}
					}

					for (; i < each_blocks_1.length; i += 1) {
						each_blocks_1[i].d(1);
					}

					each_blocks_1.length = each_value_1.length;
				}

				if (dirty & /*pending_delete, deleteType, $types, deleting, Number, saveType, saving, saved, tab*/ 831) {
					each_value = ensure_array_like(/*$types*/ ctx[0]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(each1_anchor.parentNode, each1_anchor);
						}
					}

					group_outros();

					for (i = each_value.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(nav);
					detach(t1);
					detach(each1_anchor);
				}

				if (if_block) if_block.d(detaching);
				destroy_each(each_blocks_1, detaching);
				destroy_each(each_blocks, detaching);
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let $types;
		component_subscribe($$self, types, $$value => $$invalidate(0, $types = $$value));
		let tab = 0;
		let saving = false;
		let saved = false;
		let pending_delete = false;
		let deleting = false;
		let models = [];
		let has_error = false;
		let error_message = "";

		const addEmptyType = () => {
			$types.push({
				ID: "",
				name: "New Type",
				cut_at_paragraph: 1,
				word_limit: 750,
				openai_method: "complete",
				openai_model: "text-davinci-003",
				openai_frequency_penalty: 0.5,
				openai_max_tokens: 300,
				openai_presence_penalty: 0,
				openai_temperature: 0.6,
				openai_top_p: 1,
				prompt: "Summarise the following text:"
			});
		};

		onMount(async () => {
			try {
				models = await ajaxExports.apiGet(`summaryengine/v1/models`);
			} catch(e) {
				$$invalidate(6, has_error = true);
				$$invalidate(7, error_message = "Unable to connect to OpenAI API. Please check your API key and try again.");
			}

			try {
				// console.log(models);
				set_store_value(
					types,
					$types = (await ajaxExports.apiGet(`summaryengine/v1/types`)).map(type => {
						type.ID = Number(type.ID);
						type.openai_method = String(type.openai_method) || "complete";
						type.cut_at_paragraph = !!type.cut_at_paragraph;
						type.openai_frequency_penalty = Number(type.openai_frequency_penalty);
						type.openai_max_tokens = Number(type.openai_max_tokens);
						type.openai_presence_penalty = Number(type.openai_presence_penalty);
						type.openai_temperature = Number(type.openai_temperature);
						type.openai_top_p = Number(type.openai_top_p);
						type.word_limit = Number(type.word_limit);
						type.prompt = String(type.prompt) || "";
						type.append_prompt = String(type.append_prompt) || "";
						return type;
					}),
					$types
				);

				console.log($types);
				addEmptyType();
			} catch(e) {
				console.error(e);
			}
		});

		async function saveType(type) {
			try {
				$$invalidate(2, saving = true);
				if (!type.name) throw "Type name is required";
				if (!type.prompt) throw "Prompt is required";
				if (type.name === "New Type") throw "Please rename the type before saving";
				type.append_prompt = type.append_prompt || "";
				type.custom_action = type.custom_action || "";
				const result = await ajaxExports.apiPost(`summaryengine/v1/type/${type.ID}`, type);

				if (!type.ID) {
					type.ID = Number(result.id);
					set_store_value(types, $types = $types.sort((a, b) => a.name < b.name ? -1 : 1), $types);
					addEmptyType();
					types.set($types);
				}

				window.scrollTo(0, 0);
				$$invalidate(2, saving = false);
				$$invalidate(3, saved = true);

				setTimeout(
					() => {
						$$invalidate(3, saved = false);
					},
					3000
				);
			} catch(e) {
				alert(e);
				$$invalidate(2, saving = false);
			}
		}

		async function deleteType(type) {
			try {
				$$invalidate(4, pending_delete = false);
				$$invalidate(5, deleting = true);
				await ajaxExports.apiDelete(`summaryengine/v1/type/${type.ID}`);
				set_store_value(types, $types = $types.filter(t => t.ID !== type.ID), $types);
				$$invalidate(1, tab = 0);
				$$invalidate(5, deleting = false);
				window.scrollTo(0, 0);
			} catch(e) {
				alert(e);
				$$invalidate(5, deleting = false);
			}
		}

		const click_handler = i => $$invalidate(1, tab = i);

		function input0_input_handler(each_value, i) {
			each_value[i].name = this.value;
			types.set($types);
		}

		function input1_input_handler(each_value, i) {
			each_value[i].slug = this.value;
			types.set($types);
		}

		function openaitypesettings_settings_binding(value, type, each_value, i) {
			each_value[i] = value;
			types.set($types);
		}

		function textarea_input_handler(each_value, i) {
			each_value[i].custom_action = this.value;
			types.set($types);
		}

		const click_handler_1 = type => saveType(type);
		const click_handler_2 = () => $$invalidate(4, pending_delete = true);
		const click_handler_3 = type => deleteType(type);
		const click_handler_4 = () => $$invalidate(4, pending_delete = false);

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*$types*/ 1) {
				$types.forEach(type => {
					type.slug = type.name.slugify();
				});
			}
		};

		return [
			$types,
			tab,
			saving,
			saved,
			pending_delete,
			deleting,
			has_error,
			error_message,
			saveType,
			deleteType,
			click_handler,
			input0_input_handler,
			input1_input_handler,
			openaitypesettings_settings_binding,
			textarea_input_handler,
			click_handler_1,
			click_handler_2,
			click_handler_3,
			click_handler_4
		];
	}

	class Types extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance, create_fragment, safe_not_equal, {});
		}
	}

	const settings = new Types({
	    target: document.getElementById('summaryEngineTypes'),
	});

	return settings;

})();
//# sourceMappingURL=summaryengine-types.js.map
