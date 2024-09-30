var summaryengine_review = (function () {
	'use strict';

	/** @returns {void} */
	function noop() {}

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

	let src_url_equal_anchor;

	/**
	 * @param {string} element_src
	 * @param {string} url
	 * @returns {boolean}
	 */
	function src_url_equal(element_src, url) {
		if (element_src === url) return true;
		if (!src_url_equal_anchor) {
			src_url_equal_anchor = document.createElement('a');
		}
		// This is actually faster than doing URL(..).href
		src_url_equal_anchor.href = url;
		return element_src === src_url_equal_anchor.href;
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

	function create_slot(definition, ctx, $$scope, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, $$scope, fn) {
		return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
	}

	function get_slot_changes(definition, $$scope, dirty, fn) {
		if (definition[2] && fn) {
			const lets = definition[2](fn(dirty));
			if ($$scope.dirty === undefined) {
				return lets;
			}
			if (typeof lets === 'object') {
				const merged = [];
				const len = Math.max($$scope.dirty.length, lets.length);
				for (let i = 0; i < len; i += 1) {
					merged[i] = $$scope.dirty[i] | lets[i];
				}
				return merged;
			}
			return $$scope.dirty | lets;
		}
		return $$scope.dirty;
	}

	/** @returns {void} */
	function update_slot_base(
		slot,
		slot_definition,
		ctx,
		$$scope,
		slot_changes,
		get_slot_context_fn
	) {
		if (slot_changes) {
			const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
			slot.p(slot_context, slot_changes);
		}
	}

	/** @returns {any[] | -1} */
	function get_all_dirty_from_scope($$scope) {
		if ($$scope.ctx.length > 32) {
			const dirty = [];
			const length = $$scope.ctx.length / 32;
			for (let i = 0; i < length; i++) {
				dirty[i] = -1;
			}
			return dirty;
		}
		return -1;
	}

	function set_store_value(store, ret, value) {
		store.set(value);
		return ret;
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
	 * @template {keyof SVGElementTagNameMap} K
	 * @param {K} name
	 * @returns {SVGElement}
	 */
	function svg_element(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
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
	 * @returns {(event: any) => any} */
	function prevent_default(fn) {
		return function (event) {
			event.preventDefault();
			// @ts-ignore
			return fn.call(this, event);
		};
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
	function set_style(node, key, value, important) {
		if (value == null) {
			node.style.removeProperty(key);
		} else {
			node.style.setProperty(key, value, '');
		}
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

	function select_value(select) {
		const selected_option = select.querySelector(':checked');
		return selected_option && selected_option.__value;
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
	/** */
	class HtmlTag {
		/**
		 * @private
		 * @default false
		 */
		is_svg = false;
		/** parent for creating node */
		e = undefined;
		/** html tag nodes */
		n = undefined;
		/** target */
		t = undefined;
		/** anchor */
		a = undefined;
		constructor(is_svg = false) {
			this.is_svg = is_svg;
			this.e = this.n = null;
		}

		/**
		 * @param {string} html
		 * @returns {void}
		 */
		c(html) {
			this.h(html);
		}

		/**
		 * @param {string} html
		 * @param {HTMLElement | SVGElement} target
		 * @param {HTMLElement | SVGElement} anchor
		 * @returns {void}
		 */
		m(html, target, anchor = null) {
			if (!this.e) {
				if (this.is_svg)
					this.e = svg_element(/** @type {keyof SVGElementTagNameMap} */ (target.nodeName));
				/** #7364  target for <template> may be provided as #document-fragment(11) */ else
					this.e = element(
						/** @type {keyof HTMLElementTagNameMap} */ (
							target.nodeType === 11 ? 'TEMPLATE' : target.nodeName
						)
					);
				this.t =
					target.tagName !== 'TEMPLATE'
						? target
						: /** @type {HTMLTemplateElement} */ (target).content;
				this.c(html);
			}
			this.i(anchor);
		}

		/**
		 * @param {string} html
		 * @returns {void}
		 */
		h(html) {
			this.e.innerHTML = html;
			this.n = Array.from(
				this.e.nodeName === 'TEMPLATE' ? this.e.content.childNodes : this.e.childNodes
			);
		}

		/**
		 * @returns {void} */
		i(anchor) {
			for (let i = 0; i < this.n.length; i += 1) {
				insert(this.t, this.n[i], anchor);
			}
		}

		/**
		 * @param {string} html
		 * @returns {void}
		 */
		p(html) {
			this.d();
			this.h(html);
			this.i(this.a);
		}

		/**
		 * @returns {void} */
		d() {
			this.n.forEach(detach);
		}
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

	/**
	 * Schedules a callback to run immediately before the component is unmounted.
	 *
	 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
	 * only one that runs inside a server-side component.
	 *
	 * https://svelte.dev/docs/svelte#ondestroy
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	/**
	 * Creates an event dispatcher that can be used to dispatch [component events](https://svelte.dev/docs#template-syntax-component-directives-on-eventname).
	 * Event dispatchers are functions that can take two arguments: `name` and `detail`.
	 *
	 * Component events created with `createEventDispatcher` create a
	 * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
	 * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
	 * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
	 * property and can contain any type of data.
	 *
	 * The event dispatcher can be typed to narrow the allowed event names and the type of the `detail` argument:
	 * ```ts
	 * const dispatch = createEventDispatcher<{
	 *  loaded: never; // does not take a detail argument
	 *  change: string; // takes a detail argument of type string, which is required
	 *  optional: number | null; // takes an optional detail argument of type number
	 * }>();
	 * ```
	 *
	 * https://svelte.dev/docs/svelte#createeventdispatcher
	 * @template {Record<string, any>} [EventMap=any]
	 * @returns {import('./public.js').EventDispatcher<EventMap>}
	 */
	function createEventDispatcher() {
		const component = get_current_component();
		return (type, detail, { cancelable = false } = {}) => {
			const callbacks = component.$$.callbacks[type];
			if (callbacks) {
				// TODO are there situations where events could be dispatched
				// in a server (non-DOM) environment?
				const event = custom_event(/** @type {string} */ (type), detail, { cancelable });
				callbacks.slice().forEach((fn) => {
					fn.call(component, event);
				});
				return !event.defaultPrevented;
			}
			return true;
		};
	}

	// TODO figure out if we still want to support
	// shorthand events, or if we want to implement
	// a real bubbling mechanism
	/**
	 * @param component
	 * @param event
	 * @returns {void}
	 */
	function bubble(component, event) {
		const callbacks = component.$$.callbacks[event.type];
		if (callbacks) {
			// @ts-ignore
			callbacks.slice().forEach((fn) => fn.call(this, event));
		}
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

	const posts = writable([]);
	const types = writable([]);
	const selected_date = writable("0");
	const page = writable(1);
	const post_count = writable(0);
	const loading = writable(false);
	const search = writable("");

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

	/* src/review/components/Summarise.svelte generated by Svelte v4.2.19 */

	function create_else_block_3(ctx) {
		let input;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input, "type", "button");
				attr(input, "name", "summarise");
				input.value = "Summarise";
			},
			m(target, anchor) {
				insert(target, input, anchor);

				if (!mounted) {
					dispose = listen(input, "click", /*summarise*/ ctx[10]);
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

	// (172:34) 
	function create_if_block_10(ctx) {
		let input;

		return {
			c() {
				input = element("input");
				attr(input, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input, "type", "button");
				attr(input, "name", "summarise");
				input.value = "Summarising...";
				input.disabled = "disabled";
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

	// (128:4) {#if summary.summary}
	function create_if_block_6(ctx) {
		let t;
		let if_block1_anchor;

		function select_block_type_1(ctx, dirty) {
			if (/*editing*/ ctx[4]) return create_if_block_8;
			return create_else_block_2;
		}

		let current_block_type = select_block_type_1(ctx);
		let if_block0 = current_block_type(ctx);
		let if_block1 = /*custom_action*/ ctx[2] && create_if_block_7(ctx);

		return {
			c() {
				if_block0.c();
				t = space();
				if (if_block1) if_block1.c();
				if_block1_anchor = empty();
			},
			m(target, anchor) {
				if_block0.m(target, anchor);
				insert(target, t, anchor);
				if (if_block1) if_block1.m(target, anchor);
				insert(target, if_block1_anchor, anchor);
			},
			p(ctx, dirty) {
				if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0.d(1);
					if_block0 = current_block_type(ctx);

					if (if_block0) {
						if_block0.c();
						if_block0.m(t.parentNode, t);
					}
				}

				if (/*custom_action*/ ctx[2]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block_7(ctx);
						if_block1.c();
						if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}
			},
			d(detaching) {
				if (detaching) {
					detach(t);
					detach(if_block1_anchor);
				}

				if_block0.d(detaching);
				if (if_block1) if_block1.d(detaching);
			}
		};
	}

	// (158:8) {:else}
	function create_else_block_2(ctx) {
		let div;
		let raw_value = /*summary*/ ctx[0].summary?.nl2br() + "";

		return {
			c() {
				div = element("div");
				attr(div, "class", "summaryengine-summarise__summary svelte-vmhuq8");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				div.innerHTML = raw_value;
			},
			p(ctx, dirty) {
				if (dirty & /*summary*/ 1 && raw_value !== (raw_value = /*summary*/ ctx[0].summary?.nl2br() + "")) div.innerHTML = raw_value;		},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (129:8) {#if editing}
	function create_if_block_8(ctx) {
		let textarea;
		let t;
		let if_block_anchor;
		let mounted;
		let dispose;

		function select_block_type_2(ctx, dirty) {
			if (!/*saving*/ ctx[9]) return create_if_block_9;
			return create_else_block_1;
		}

		let current_block_type = select_block_type_2(ctx);
		let if_block = current_block_type(ctx);

		return {
			c() {
				textarea = element("textarea");
				t = space();
				if_block.c();
				if_block_anchor = empty();
				attr(textarea, "class", "summaryengine-summarise__summary-textarea svelte-vmhuq8");
			},
			m(target, anchor) {
				insert(target, textarea, anchor);
				set_input_value(textarea, /*summary*/ ctx[0].summary);
				insert(target, t, anchor);
				if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);

				if (!mounted) {
					dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[15]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty & /*summary*/ 1) {
					set_input_value(textarea, /*summary*/ ctx[0].summary);
				}

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
					detach(textarea);
					detach(t);
					detach(if_block_anchor);
				}

				if_block.d(detaching);
				mounted = false;
				dispose();
			}
		};
	}

	// (149:12) {:else}
	function create_else_block_1(ctx) {
		let input;

		return {
			c() {
				input = element("input");
				attr(input, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input, "type", "button");
				attr(input, "name", "save");
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

	// (134:12) {#if !saving}
	function create_if_block_9(ctx) {
		let input0;
		let t;
		let input1;
		let mounted;
		let dispose;

		return {
			c() {
				input0 = element("input");
				t = space();
				input1 = element("input");
				attr(input0, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input0, "type", "button");
				attr(input0, "name", "save");
				input0.value = "Save";
				attr(input1, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input1, "type", "button");
				attr(input1, "name", "cancel");
				input1.value = "Cancel";
			},
			m(target, anchor) {
				insert(target, input0, anchor);
				insert(target, t, anchor);
				insert(target, input1, anchor);

				if (!mounted) {
					dispose = [
						listen(input0, "click", /*save*/ ctx[13]),
						listen(input1, "click", /*click_handler*/ ctx[16])
					];

					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(input0);
					detach(t);
					detach(input1);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (163:8) {#if custom_action}
	function create_if_block_7(ctx) {
		let html_tag;
		let raw_value = /*custom_action*/ ctx[2].replace("[post_url]", /*post*/ ctx[1].permalink).replace("[summary_encoded]", encodeURIComponent(/*summary*/ ctx[0].summary || "")).replace("[summary]", /*summary*/ ctx[0].summary) + "";
		let html_anchor;

		return {
			c() {
				html_tag = new HtmlTag(false);
				html_anchor = empty();
				html_tag.a = html_anchor;
			},
			m(target, anchor) {
				html_tag.m(raw_value, target, anchor);
				insert(target, html_anchor, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*custom_action, post, summary*/ 7 && raw_value !== (raw_value = /*custom_action*/ ctx[2].replace("[post_url]", /*post*/ ctx[1].permalink).replace("[summary_encoded]", encodeURIComponent(/*summary*/ ctx[0].summary || "")).replace("[summary]", /*summary*/ ctx[0].summary) + "")) html_tag.p(raw_value);
			},
			d(detaching) {
				if (detaching) {
					detach(html_anchor);
					html_tag.d();
				}
			}
		};
	}

	// (189:4) {#if hovering || just_summarised}
	function create_if_block$1(ctx) {
		let div;
		let if_block = /*summary*/ ctx[0]?.summary && !/*editing*/ ctx[4] && create_if_block_1$1(ctx);

		return {
			c() {
				div = element("div");
				if (if_block) if_block.c();
				attr(div, "class", "summaryengine-actions");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				if (if_block) if_block.m(div, null);
			},
			p(ctx, dirty) {
				if (/*summary*/ ctx[0]?.summary && !/*editing*/ ctx[4]) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block_1$1(ctx);
						if_block.c();
						if_block.m(div, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				if (if_block) if_block.d();
			}
		};
	}

	// (191:12) {#if summary?.summary && !editing}
	function create_if_block_1$1(ctx) {
		let t0;
		let t1;
		let input;
		let mounted;
		let dispose;
		let if_block0 = !/*approved*/ ctx[7] && !/*disapproving*/ ctx[5] && create_if_block_4(ctx);

		function select_block_type_4(ctx, dirty) {
			if (/*disapproving*/ ctx[5]) return create_if_block_2$1;
			if (!/*approving*/ ctx[6]) return create_if_block_3;
		}

		let current_block_type = select_block_type_4(ctx);
		let if_block1 = current_block_type && current_block_type(ctx);

		return {
			c() {
				if (if_block0) if_block0.c();
				t0 = space();
				if (if_block1) if_block1.c();
				t1 = space();
				input = element("input");
				attr(input, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input, "type", "button");
				attr(input, "name", "edit");
				input.value = "Edit";
			},
			m(target, anchor) {
				if (if_block0) if_block0.m(target, anchor);
				insert(target, t0, anchor);
				if (if_block1) if_block1.m(target, anchor);
				insert(target, t1, anchor);
				insert(target, input, anchor);

				if (!mounted) {
					dispose = listen(input, "click", /*click_handler_1*/ ctx[17]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (!/*approved*/ ctx[7] && !/*disapproving*/ ctx[5]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);
					} else {
						if_block0 = create_if_block_4(ctx);
						if_block0.c();
						if_block0.m(t0.parentNode, t0);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (current_block_type === (current_block_type = select_block_type_4(ctx)) && if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if (if_block1) if_block1.d(1);
					if_block1 = current_block_type && current_block_type(ctx);

					if (if_block1) {
						if_block1.c();
						if_block1.m(t1.parentNode, t1);
					}
				}
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(input);
				}

				if (if_block0) if_block0.d(detaching);

				if (if_block1) {
					if_block1.d(detaching);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (192:16) {#if !approved && !disapproving}
	function create_if_block_4(ctx) {
		let if_block_anchor;

		function select_block_type_3(ctx, dirty) {
			if (/*approving*/ ctx[6]) return create_if_block_5;
			return create_else_block$1;
		}

		let current_block_type = select_block_type_3(ctx);
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
				if (current_block_type === (current_block_type = select_block_type_3(ctx)) && if_block) {
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

	// (201:20) {:else}
	function create_else_block$1(ctx) {
		let input;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input, "type", "button");
				attr(input, "name", "approve");
				input.value = "Approve";
			},
			m(target, anchor) {
				insert(target, input, anchor);

				if (!mounted) {
					dispose = listen(input, "click", /*approve*/ ctx[11]);
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

	// (193:20) {#if approving}
	function create_if_block_5(ctx) {
		let input;

		return {
			c() {
				input = element("input");
				attr(input, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input, "type", "button");
				attr(input, "name", "approve");
				input.value = "Approving...";
				input.disabled = "disabled";
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

	// (219:37) 
	function create_if_block_3(ctx) {
		let input;
		let mounted;
		let dispose;

		return {
			c() {
				input = element("input");
				attr(input, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input, "type", "button");
				attr(input, "name", "disapprove");
				input.value = "Reject";
			},
			m(target, anchor) {
				insert(target, input, anchor);

				if (!mounted) {
					dispose = listen(input, "click", /*disapprove*/ ctx[12]);
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

	// (211:16) {#if disapproving}
	function create_if_block_2$1(ctx) {
		let input;

		return {
			c() {
				input = element("input");
				attr(input, "class", "summaryengine-button button svelte-vmhuq8");
				attr(input, "type", "button");
				attr(input, "name", "disapprove");
				input.value = "Rejecting...";
				input.disabled = "disabled";
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

	function create_fragment$5(ctx) {
		let div;
		let t;
		let mounted;
		let dispose;

		function select_block_type(ctx, dirty) {
			if (/*summary*/ ctx[0].summary) return create_if_block_6;
			if (/*summary*/ ctx[0].summarising) return create_if_block_10;
			return create_else_block_3;
		}

		let current_block_type = select_block_type(ctx);
		let if_block0 = current_block_type(ctx);
		let if_block1 = (/*hovering*/ ctx[3] || /*just_summarised*/ ctx[8]) && create_if_block$1(ctx);

		return {
			c() {
				div = element("div");
				if_block0.c();
				t = space();
				if (if_block1) if_block1.c();
				attr(div, "class", "summaryengine-summarise svelte-vmhuq8");
				attr(div, "role", "region");
				attr(div, "aria-label", "Summary");
				toggle_class(div, "is_hovering", /*hovering*/ ctx[3]);
				toggle_class(div, "just_summarised", /*just_summarised*/ ctx[8]);
				toggle_class(div, "approved", Number(/*summary*/ ctx[0].summary_details.rating) === 1);
				toggle_class(div, "unapproved", Number(/*summary*/ ctx[0].summary_details.rating) === 0);
				toggle_class(div, "disapproved", Number(/*summary*/ ctx[0].summary_details.rating) === -1);
			},
			m(target, anchor) {
				insert(target, div, anchor);
				if_block0.m(div, null);
				append(div, t);
				if (if_block1) if_block1.m(div, null);

				if (!mounted) {
					dispose = [
						listen(div, "mouseenter", /*mouseenter_handler*/ ctx[18]),
						listen(div, "mouseleave", /*mouseleave_handler*/ ctx[19])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0.d(1);
					if_block0 = current_block_type(ctx);

					if (if_block0) {
						if_block0.c();
						if_block0.m(div, t);
					}
				}

				if (/*hovering*/ ctx[3] || /*just_summarised*/ ctx[8]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block$1(ctx);
						if_block1.c();
						if_block1.m(div, null);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				if (dirty & /*hovering*/ 8) {
					toggle_class(div, "is_hovering", /*hovering*/ ctx[3]);
				}

				if (dirty & /*just_summarised*/ 256) {
					toggle_class(div, "just_summarised", /*just_summarised*/ ctx[8]);
				}

				if (dirty & /*Number, summary*/ 1) {
					toggle_class(div, "approved", Number(/*summary*/ ctx[0].summary_details.rating) === 1);
				}

				if (dirty & /*Number, summary*/ 1) {
					toggle_class(div, "unapproved", Number(/*summary*/ ctx[0].summary_details.rating) === 0);
				}

				if (dirty & /*Number, summary*/ 1) {
					toggle_class(div, "disapproved", Number(/*summary*/ ctx[0].summary_details.rating) === -1);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				if_block0.d();
				if (if_block1) if_block1.d();
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$5($$self, $$props, $$invalidate) {
		let { summary } = $$props;
		let { type_id } = $$props;
		let { post } = $$props;
		let { custom_action } = $$props;
		let hovering = false;
		let editing = false;
		let disapproving = false;
		let approving = false;
		let approved;
		let just_summarised = false;
		let saving = false;

		String.prototype.nl2br = function () {
			return this.replace(/([^>])\n/g, "$1<br/>");
		};

		onMount(async () => {
			try {
				$$invalidate(0, summary.summarising = false, summary);

				if (Number(summary.summary_details.rating) === 1) {
					$$invalidate(7, approved = true);
				} // } else if (Number(summary.summary_details.rating) === 0) {
				//     unapproved = true;
			} catch(e) {
				console.error(
					e
				);
			}
		});

		async function summarise() {
			try {
				$$invalidate(0, summary.summarising = true, summary);
				const response = await ajaxExports.apiPost(`/summaryengine/v1/summarise`, { type_id, post_id: post.id });
				const result = response.result;

				if (!result) {
					throw new Error("No result returned from API");
				}

				if (typeof result.summary === "undefined") {
					throw new Error("Summary is undefined in the API response");
				}

				$$invalidate(0, summary.summary = result.summary, summary);
				$$invalidate(0, summary.summary_id = result.ID, summary);
				$$invalidate(0, summary.summary_details = result, summary);
				$$invalidate(0, summary.summary_details.rating = 0, summary);
				$$invalidate(0, summary.summarising = false, summary);
				$$invalidate(7, approved = false);
				$$invalidate(8, just_summarised = true);
			} catch(err) {
				console.error("Summarisation error:", err);
				alert("An error occurred while summarising: " + err.message);
				$$invalidate(0, summary.summarising = false, summary);
			}
		}

		async function approve() {
			try {
				$$invalidate(6, approving = true);
				await ajaxExports.apiPost(`/summaryengine/v1/rate/${summary.summary_id}`, { rating: 1 });
				$$invalidate(0, summary.summary_details.rating = 1, summary);
				$$invalidate(6, approving = false);
				$$invalidate(7, approved = true);
				$$invalidate(8, just_summarised = false);
			} catch(err) {
				console.error(err);
				alert("An error occured: " + err);
				$$invalidate(6, approving = false);
			}
		}

		async function disapprove() {
			try {
				$$invalidate(5, disapproving = true);
				await ajaxExports.apiPost(`/summaryengine/v1/rate/${summary.summary_id}`, { rating: -1 });
				await summarise();
				$$invalidate(5, disapproving = false);
				$$invalidate(0, summary.summary_details.rating = 0, summary);
				$$invalidate(8, just_summarised = false);
				$$invalidate(7, approved = false);
			} catch(err) {
				console.error(err);
				$$invalidate(5, disapproving = false);
			}
		}

		async function save() {
			try {
				$$invalidate(9, saving = true);
				await ajaxExports.apiPut(`/summaryengine/v1/summary/${summary.summary_id}`, { summary: summary.summary });
				$$invalidate(4, editing = false);
				$$invalidate(9, saving = false);
			} catch(err) {
				console.error(err);
				alert("An error occured: " + err);
				$$invalidate(4, editing = false);
				$$invalidate(9, saving = false);
			}
		}

		function textarea_input_handler() {
			summary.summary = this.value;
			$$invalidate(0, summary);
		}

		const click_handler = () => $$invalidate(4, editing = false);
		const click_handler_1 = () => $$invalidate(4, editing = true);
		const mouseenter_handler = () => $$invalidate(3, hovering = true);
		const mouseleave_handler = () => $$invalidate(3, hovering = false);

		$$self.$$set = $$props => {
			if ('summary' in $$props) $$invalidate(0, summary = $$props.summary);
			if ('type_id' in $$props) $$invalidate(14, type_id = $$props.type_id);
			if ('post' in $$props) $$invalidate(1, post = $$props.post);
			if ('custom_action' in $$props) $$invalidate(2, custom_action = $$props.custom_action);
		};

		return [
			summary,
			post,
			custom_action,
			hovering,
			editing,
			disapproving,
			approving,
			approved,
			just_summarised,
			saving,
			summarise,
			approve,
			disapprove,
			save,
			type_id,
			textarea_input_handler,
			click_handler,
			click_handler_1,
			mouseenter_handler,
			mouseleave_handler
		];
	}

	class Summarise extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$5, create_fragment$5, safe_not_equal, {
				summary: 0,
				type_id: 14,
				post: 1,
				custom_action: 2
			});
		}
	}

	/* src/review/components/Dates.svelte generated by Svelte v4.2.19 */

	function get_each_context$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[5] = list[i];
		return child_ctx;
	}

	// (27:8) {#each months as month}
	function create_each_block$1(ctx) {
		let option;
		let t_value = /*month*/ ctx[5].label + "";
		let t;
		let option_value_value;

		return {
			c() {
				option = element("option");
				t = text(t_value);
				option.__value = option_value_value = /*month*/ ctx[5].year + /*month*/ ctx[5].month + "";
				set_input_value(option, option.__value);
			},
			m(target, anchor) {
				insert(target, option, anchor);
				append(option, t);
			},
			p(ctx, dirty) {
				if (dirty & /*months*/ 1 && t_value !== (t_value = /*month*/ ctx[5].label + "")) set_data(t, t_value);

				if (dirty & /*months*/ 1 && option_value_value !== (option_value_value = /*month*/ ctx[5].year + /*month*/ ctx[5].month + "")) {
					option.__value = option_value_value;
					set_input_value(option, option.__value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(option);
				}
			}
		};
	}

	function create_fragment$4(ctx) {
		let div;
		let label;
		let t1;
		let select;
		let option;
		let t3;
		let input;
		let mounted;
		let dispose;
		let each_value = ensure_array_like(/*months*/ ctx[0]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
		}

		return {
			c() {
				div = element("div");
				label = element("label");
				label.textContent = "Filter by date";
				t1 = space();
				select = element("select");
				option = element("option");
				option.textContent = "All dates";

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t3 = space();
				input = element("input");
				attr(label, "for", "filter-by-date");
				attr(label, "class", "screen-reader-text");
				option.__value = "0";
				set_input_value(option, option.__value);
				attr(select, "name", "m");
				attr(select, "id", "filter-by-date");
				if (/*$selected_date*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[3].call(select));
				attr(input, "type", "submit");
				attr(input, "name", "filter_action");
				attr(input, "id", "post-query-submit");
				attr(input, "class", "button");
				input.value = "Filter";
				attr(div, "class", "alignleft actions");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, label);
				append(div, t1);
				append(div, select);
				append(select, option);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(select, null);
					}
				}

				select_option(select, /*$selected_date*/ ctx[1], true);
				append(div, t3);
				append(div, input);

				if (!mounted) {
					dispose = [
						listen(select, "change", /*select_change_handler*/ ctx[3]),
						listen(input, "click", /*click_handler*/ ctx[2])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*months*/ 1) {
					each_value = ensure_array_like(/*months*/ ctx[0]);
					let i;

					for (i = 0; i < each_value.length; i += 1) {
						const child_ctx = get_each_context$1(ctx, each_value, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
						} else {
							each_blocks[i] = create_each_block$1(child_ctx);
							each_blocks[i].c();
							each_blocks[i].m(select, null);
						}
					}

					for (; i < each_blocks.length; i += 1) {
						each_blocks[i].d(1);
					}

					each_blocks.length = each_value.length;
				}

				if (dirty & /*$selected_date, months*/ 3) {
					select_option(select, /*$selected_date*/ ctx[1]);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_each(each_blocks, detaching);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$4($$self, $$props, $$invalidate) {
		let $selected_date;
		component_subscribe($$self, selected_date, $$value => $$invalidate(1, $selected_date = $$value));
		let months = [];

		const month_labels = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December"
		];

		onMount(async () => {
			try {
				const result = await ajaxExports.apiGet(`/summaryengine/v1/post_months`);
				$$invalidate(0, months = result);

				$$invalidate(0, months = months.map(month => {
					month.label = month_labels[month.month - 1] + " " + month.year;
					return month;
				}));
			} catch(err) {
				console.error(err);
			}
		});

		function click_handler(event) {
			bubble.call(this, $$self, event);
		}

		function select_change_handler() {
			$selected_date = select_value(this);
			selected_date.set($selected_date);
			$$invalidate(0, months);
		}

		return [months, $selected_date, click_handler, select_change_handler];
	}

	class Dates extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
		}
	}

	/* src/review/components/Pages.svelte generated by Svelte v4.2.19 */

	function create_fragment$3(ctx) {
		let div;
		let span0;
		let t0;
		let t1;
		let t2_value = (/*$post_count*/ ctx[0] !== 1 ? "s" : "") + "";
		let t2;
		let t3;
		let span12;
		let button0;
		let span1;
		let t5;
		let span2;
		let button0_disabled_value;
		let t7;
		let button1;
		let span3;
		let t9;
		let span4;
		let button1_disabled_value;
		let t11;
		let span7;
		let label;
		let t13;
		let input;
		let t14;
		let span6;
		let t15;
		let span5;
		let t16;
		let t17;
		let button2;
		let span8;
		let t19;
		let span9;
		let button2_disabled_value;
		let t21;
		let button3;
		let span10;
		let span11;
		let button3_disabled_value;
		let mounted;
		let dispose;

		return {
			c() {
				div = element("div");
				span0 = element("span");
				t0 = text(/*$post_count*/ ctx[0]);
				t1 = text(" item");
				t2 = text(t2_value);
				t3 = space();
				span12 = element("span");
				button0 = element("button");
				span1 = element("span");
				span1.textContent = "First page";
				t5 = space();
				span2 = element("span");
				span2.textContent = "«";
				t7 = space();
				button1 = element("button");
				span3 = element("span");
				span3.textContent = "Previous page";
				t9 = space();
				span4 = element("span");
				span4.textContent = "‹";
				t11 = space();
				span7 = element("span");
				label = element("label");
				label.textContent = "Current Page";
				t13 = space();
				input = element("input");
				t14 = space();
				span6 = element("span");
				t15 = text("of ");
				span5 = element("span");
				t16 = text(/*page_count*/ ctx[1]);
				t17 = space();
				button2 = element("button");
				span8 = element("span");
				span8.textContent = "Next page";
				t19 = space();
				span9 = element("span");
				span9.textContent = "›";
				t21 = space();
				button3 = element("button");
				span10 = element("span");
				span10.textContent = "Last page";
				span11 = element("span");
				span11.textContent = "»";
				attr(span0, "class", "displaying-num");
				attr(span1, "class", "screen-reader-text");
				attr(span2, "aria-hidden", "true");
				attr(button0, "href", '#');
				attr(button0, "class", "first-page button");
				button0.disabled = button0_disabled_value = /*$page*/ ctx[2] === 1;
				attr(span3, "class", "screen-reader-text");
				attr(span4, "aria-hidden", "true");
				attr(button1, "href", '#');
				attr(button1, "class", "prev-page button");
				button1.disabled = button1_disabled_value = /*$page*/ ctx[2] === 1;
				attr(label, "for", "current-page-selector");
				attr(label, "class", "screen-reader-text");
				attr(input, "type", "number");
				attr(input, "class", "current-page");
				attr(input, "id", "current-page-selector");
				attr(input, "name", "paged");
				attr(input, "size", "2");
				attr(input, "aria-describedby", "table-paging");
				attr(input, "max", /*page_count*/ ctx[1]);
				attr(input, "min", "1");
				attr(span5, "class", "total-pages");
				attr(span6, "class", "tablenav-paging-text");
				attr(span7, "class", "paging-input");
				attr(span8, "class", "screen-reader-text");
				attr(span9, "aria-hidden", "true");
				attr(button2, "class", "next-page button");
				button2.disabled = button2_disabled_value = /*$page*/ ctx[2] === /*page_count*/ ctx[1];
				attr(span10, "class", "screen-reader-text");
				attr(span11, "aria-hidden", "true");
				attr(button3, "class", "last-page button");
				attr(button3, "href", '#');
				button3.disabled = button3_disabled_value = /*$page*/ ctx[2] === /*page_count*/ ctx[1];
				attr(span12, "class", "pagination-links");
				attr(div, "class", "tablenav-pages");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				append(div, span0);
				append(span0, t0);
				append(span0, t1);
				append(span0, t2);
				append(div, t3);
				append(div, span12);
				append(span12, button0);
				append(button0, span1);
				append(button0, t5);
				append(button0, span2);
				append(span12, t7);
				append(span12, button1);
				append(button1, span3);
				append(button1, t9);
				append(button1, span4);
				append(span12, t11);
				append(span12, span7);
				append(span7, label);
				append(span7, t13);
				append(span7, input);
				set_input_value(input, /*$page*/ ctx[2]);
				append(span7, t14);
				append(span7, span6);
				append(span6, t15);
				append(span6, span5);
				append(span5, t16);
				append(span12, t17);
				append(span12, button2);
				append(button2, span8);
				append(button2, t19);
				append(button2, span9);
				append(span12, t21);
				append(span12, button3);
				append(button3, span10);
				append(button3, span11);

				if (!mounted) {
					dispose = [
						listen(button0, "click", /*firstPage*/ ctx[6]),
						listen(button0, "keypress", /*firstPage*/ ctx[6]),
						listen(button0, "click", /*click_handler*/ ctx[13]),
						listen(button1, "click", /*prevPage*/ ctx[5]),
						listen(button1, "keypress", /*prevPage*/ ctx[5]),
						listen(button1, "click", /*click_handler_1*/ ctx[12]),
						listen(input, "input", /*input_input_handler*/ ctx[14]),
						listen(input, "change", /*inputPage*/ ctx[7]),
						listen(input, "change", /*change_handler*/ ctx[11]),
						listen(button2, "click", /*nextPage*/ ctx[3]),
						listen(button2, "keypress", /*nextPage*/ ctx[3]),
						listen(button2, "click", /*click_handler_2*/ ctx[10]),
						listen(button3, "click", /*lastPage*/ ctx[4]),
						listen(button3, "keypress", /*lastPage*/ ctx[4]),
						listen(button3, "click", /*click_handler_3*/ ctx[9])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*$post_count*/ 1) set_data(t0, /*$post_count*/ ctx[0]);
				if (dirty & /*$post_count*/ 1 && t2_value !== (t2_value = (/*$post_count*/ ctx[0] !== 1 ? "s" : "") + "")) set_data(t2, t2_value);

				if (dirty & /*$page*/ 4 && button0_disabled_value !== (button0_disabled_value = /*$page*/ ctx[2] === 1)) {
					button0.disabled = button0_disabled_value;
				}

				if (dirty & /*$page*/ 4 && button1_disabled_value !== (button1_disabled_value = /*$page*/ ctx[2] === 1)) {
					button1.disabled = button1_disabled_value;
				}

				if (dirty & /*page_count*/ 2) {
					attr(input, "max", /*page_count*/ ctx[1]);
				}

				if (dirty & /*$page*/ 4 && to_number(input.value) !== /*$page*/ ctx[2]) {
					set_input_value(input, /*$page*/ ctx[2]);
				}

				if (dirty & /*page_count*/ 2) set_data(t16, /*page_count*/ ctx[1]);

				if (dirty & /*$page, page_count*/ 6 && button2_disabled_value !== (button2_disabled_value = /*$page*/ ctx[2] === /*page_count*/ ctx[1])) {
					button2.disabled = button2_disabled_value;
				}

				if (dirty & /*$page, page_count*/ 6 && button3_disabled_value !== (button3_disabled_value = /*$page*/ ctx[2] === /*page_count*/ ctx[1])) {
					button3.disabled = button3_disabled_value;
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$3($$self, $$props, $$invalidate) {
		let $page;
		let $post_count;
		component_subscribe($$self, page, $$value => $$invalidate(2, $page = $$value));
		component_subscribe($$self, post_count, $$value => $$invalidate(0, $post_count = $$value));
		let { per_page = 30 } = $$props;
		let page_count = 0;

		function nextPage() {
			if ($page < page_count) {
				page.update(n => n + 1);
			}
		}

		function lastPage() {
			set_store_value(page, $page = page_count, $page);
		}

		function prevPage() {
			if ($page > 1) {
				set_store_value(page, $page--, $page);
			}
		}

		function firstPage() {
			set_store_value(page, $page = 1, $page);
		}

		function inputPage() {
			if ($page > page_count) {
				set_store_value(page, $page = page_count, $page);
			}

			if ($page < 1) {
				set_store_value(page, $page = 1, $page);
			}
		}

		function click_handler_3(event) {
			bubble.call(this, $$self, event);
		}

		function click_handler_2(event) {
			bubble.call(this, $$self, event);
		}

		function change_handler(event) {
			bubble.call(this, $$self, event);
		}

		function click_handler_1(event) {
			bubble.call(this, $$self, event);
		}

		function click_handler(event) {
			bubble.call(this, $$self, event);
		}

		function input_input_handler() {
			$page = to_number(this.value);
			page.set($page);
		}

		$$self.$$set = $$props => {
			if ('per_page' in $$props) $$invalidate(8, per_page = $$props.per_page);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*$post_count, per_page*/ 257) {
				$$invalidate(1, page_count = Math.ceil($post_count / per_page));
			}
		};

		return [
			$post_count,
			page_count,
			$page,
			nextPage,
			lastPage,
			prevPage,
			firstPage,
			inputPage,
			per_page,
			click_handler_3,
			click_handler_2,
			change_handler,
			click_handler_1,
			click_handler,
			input_input_handler
		];
	}

	class Pages extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$3, create_fragment$3, safe_not_equal, { per_page: 8 });
		}
	}

	/* src/review/components/Search.svelte generated by Svelte v4.2.19 */

	function create_fragment$2(ctx) {
		let form;
		let label;
		let t1;
		let input0;
		let t2;
		let input1;
		let mounted;
		let dispose;

		return {
			c() {
				form = element("form");
				label = element("label");
				label.textContent = "Search Articles:";
				t1 = space();
				input0 = element("input");
				t2 = space();
				input1 = element("input");
				attr(label, "class", "screen-reader-text");
				attr(label, "for", "post-search-input");
				attr(input0, "type", "search");
				attr(input0, "id", "post-search-input");
				attr(input0, "name", "s");
				attr(input1, "type", "submit");
				attr(input1, "id", "search-submit");
				attr(input1, "class", "button");
				input1.value = "Search";
				attr(form, "class", "search-box");
			},
			m(target, anchor) {
				insert(target, form, anchor);
				append(form, label);
				append(form, t1);
				append(form, input0);
				set_input_value(input0, /*$search*/ ctx[0]);
				append(form, t2);
				append(form, input1);

				if (!mounted) {
					dispose = [
						listen(input0, "input", /*input0_input_handler*/ ctx[2]),
						listen(form, "submit", prevent_default(/*submit_handler*/ ctx[3]))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (dirty & /*$search*/ 1 && input0.value !== /*$search*/ ctx[0]) {
					set_input_value(input0, /*$search*/ ctx[0]);
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(form);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		let $search;
		component_subscribe($$self, search, $$value => $$invalidate(0, $search = $$value));
		const dispatch = createEventDispatcher();

		function input0_input_handler() {
			$search = this.value;
			search.set($search);
		}

		const submit_handler = () => dispatch("search");
		return [$search, dispatch, input0_input_handler, submit_handler];
	}

	class Search extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
		}
	}

	/* src/review/components/Modal.svelte generated by Svelte v4.2.19 */
	const get_buttons_slot_changes = dirty => ({});
	const get_buttons_slot_context = ctx => ({});
	const get_header_slot_changes = dirty => ({});
	const get_header_slot_context = ctx => ({});

	function create_fragment$1(ctx) {
		let div0;
		let t0;
		let div2;
		let t1;
		let t2;
		let div1;
		let t3;
		let button;
		let current;
		let mounted;
		let dispose;
		const header_slot_template = /*#slots*/ ctx[5].header;
		const header_slot = create_slot(header_slot_template, ctx, /*$$scope*/ ctx[4], get_header_slot_context);
		const default_slot_template = /*#slots*/ ctx[5].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);
		const buttons_slot_template = /*#slots*/ ctx[5].buttons;
		const buttons_slot = create_slot(buttons_slot_template, ctx, /*$$scope*/ ctx[4], get_buttons_slot_context);

		return {
			c() {
				div0 = element("div");
				t0 = space();
				div2 = element("div");
				if (header_slot) header_slot.c();
				t1 = space();
				if (default_slot) default_slot.c();
				t2 = space();
				div1 = element("div");
				if (buttons_slot) buttons_slot.c();
				t3 = space();
				button = element("button");
				button.textContent = "Close";
				attr(div0, "class", "modal-background svelte-1yv89n5");
				attr(button, "class", "button svelte-1yv89n5");
				button.autofocus = true;
				attr(div1, "class", "modal-footer svelte-1yv89n5");
				attr(div2, "class", "modal svelte-1yv89n5");
				attr(div2, "role", "dialog");
				attr(div2, "aria-modal", "true");
			},
			m(target, anchor) {
				insert(target, div0, anchor);
				/*div0_binding*/ ctx[6](div0);
				insert(target, t0, anchor);
				insert(target, div2, anchor);

				if (header_slot) {
					header_slot.m(div2, null);
				}

				append(div2, t1);

				if (default_slot) {
					default_slot.m(div2, null);
				}

				append(div2, t2);
				append(div2, div1);

				if (buttons_slot) {
					buttons_slot.m(div1, null);
				}

				append(div1, t3);
				append(div1, button);
				/*div2_binding*/ ctx[7](div2);
				current = true;
				button.focus();

				if (!mounted) {
					dispose = [
						listen(window, "keydown", /*handle_keydown*/ ctx[3]),
						listen(div0, "click", /*close*/ ctx[2]),
						listen(div0, "keypress", /*handle_keydown*/ ctx[3]),
						listen(button, "click", /*close*/ ctx[2])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (header_slot) {
					if (header_slot.p && (!current || dirty & /*$$scope*/ 16)) {
						update_slot_base(
							header_slot,
							header_slot_template,
							ctx,
							/*$$scope*/ ctx[4],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[4])
							: get_slot_changes(header_slot_template, /*$$scope*/ ctx[4], dirty, get_header_slot_changes),
							get_header_slot_context
						);
					}
				}

				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 16)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[4],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[4])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[4], dirty, null),
							null
						);
					}
				}

				if (buttons_slot) {
					if (buttons_slot.p && (!current || dirty & /*$$scope*/ 16)) {
						update_slot_base(
							buttons_slot,
							buttons_slot_template,
							ctx,
							/*$$scope*/ ctx[4],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[4])
							: get_slot_changes(buttons_slot_template, /*$$scope*/ ctx[4], dirty, get_buttons_slot_changes),
							get_buttons_slot_context
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(header_slot, local);
				transition_in(default_slot, local);
				transition_in(buttons_slot, local);
				current = true;
			},
			o(local) {
				transition_out(header_slot, local);
				transition_out(default_slot, local);
				transition_out(buttons_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div0);
					detach(t0);
					detach(div2);
				}

				/*div0_binding*/ ctx[6](null);
				if (header_slot) header_slot.d(detaching);
				if (default_slot) default_slot.d(detaching);
				if (buttons_slot) buttons_slot.d(detaching);
				/*div2_binding*/ ctx[7](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		const dispatch = createEventDispatcher();
		const close = () => dispatch('close');
		let modal;
		let modal_background;

		const handle_keydown = e => {
			if (e.key === 'Escape') {
				close();
				return;
			}

			if (e.key === 'Tab') {
				// trap focus
				const nodes = modal.querySelectorAll('*');

				const tabbable = Array.from(nodes).filter(n => n.tabIndex >= 0);
				let index = tabbable.indexOf(document.activeElement);
				if (index === -1 && e.shiftKey) index = 0;
				index += tabbable.length + (e.shiftKey ? -1 : 1);
				index %= tabbable.length;
				tabbable[index].focus();
				e.preventDefault();
			}
		};

		const previously_focused = typeof document !== 'undefined' && document.activeElement;

		if (previously_focused) {
			onDestroy(() => {
				previously_focused.focus();
			});
		}

		function div0_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				modal_background = $$value;
				$$invalidate(1, modal_background);
			});
		}

		function div2_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				modal = $$value;
				$$invalidate(0, modal);
			});
		}

		$$self.$$set = $$props => {
			if ('$$scope' in $$props) $$invalidate(4, $$scope = $$props.$$scope);
		};

		return [
			modal,
			modal_background,
			close,
			handle_keydown,
			$$scope,
			slots,
			div0_binding,
			div2_binding
		];
	}

	class Modal extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
		}
	}

	/* src/review/Review.svelte generated by Svelte v4.2.19 */

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[18] = list[i];
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[21] = list[i];
		return child_ctx;
	}

	function get_each_context_2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[21] = list[i];
		return child_ctx;
	}

	// (108:0) {#if show_modal}
	function create_if_block_2(ctx) {
		let modal;
		let current;

		modal = new Modal({
				props: {
					$$slots: { default: [create_default_slot] },
					$$scope: { ctx }
				}
			});

		modal.$on("close", /*close_handler*/ ctx[10]);

		return {
			c() {
				create_component(modal.$$.fragment);
			},
			m(target, anchor) {
				mount_component(modal, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const modal_changes = {};

				if (dirty & /*$$scope, modal_url*/ 67108868) {
					modal_changes.$$scope = { dirty, ctx };
				}

				modal.$set(modal_changes);
			},
			i(local) {
				if (current) return;
				transition_in(modal.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(modal.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(modal, detaching);
			}
		};
	}

	// (109:4) <Modal on:close={() => (show_modal = false)}>
	function create_default_slot(ctx) {
		let iframe;
		let iframe_src_value;

		return {
			c() {
				iframe = element("iframe");
				attr(iframe, "title", "Preview");
				if (!src_url_equal(iframe.src, iframe_src_value = /*modal_url*/ ctx[2])) attr(iframe, "src", iframe_src_value);
				set_style(iframe, "width", "100%");
				set_style(iframe, "height", "80vh");
			},
			m(target, anchor) {
				insert(target, iframe, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*modal_url*/ 4 && !src_url_equal(iframe.src, iframe_src_value = /*modal_url*/ ctx[2])) {
					attr(iframe, "src", iframe_src_value);
				}
			},
			d(detaching) {
				if (detaching) {
					detach(iframe);
				}
			}
		};
	}

	// (143:16) {#each $types as type}
	function create_each_block_2(ctx) {
		let th;
		let t_value = /*type*/ ctx[21].name + "";
		let t;

		return {
			c() {
				th = element("th");
				t = text(t_value);
			},
			m(target, anchor) {
				insert(target, th, anchor);
				append(th, t);
			},
			p(ctx, dirty) {
				if (dirty & /*$types*/ 16 && t_value !== (t_value = /*type*/ ctx[21].name + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(th);
				}
			}
		};
	}

	// (167:20) {#each $types as type}
	function create_each_block_1(ctx) {
		let td;
		let summarise;
		let current;

		summarise = new Summarise({
				props: {
					type_id: /*type*/ ctx[21].ID,
					post: /*post*/ ctx[18],
					summary: /*post*/ ctx[18].summaries[/*type*/ ctx[21].slug],
					custom_action: /*type*/ ctx[21].custom_action
				}
			});

		return {
			c() {
				td = element("td");
				create_component(summarise.$$.fragment);
			},
			m(target, anchor) {
				insert(target, td, anchor);
				mount_component(summarise, td, null);
				current = true;
			},
			p(ctx, dirty) {
				const summarise_changes = {};
				if (dirty & /*$types*/ 16) summarise_changes.type_id = /*type*/ ctx[21].ID;
				if (dirty & /*$posts*/ 8) summarise_changes.post = /*post*/ ctx[18];
				if (dirty & /*$posts, $types*/ 24) summarise_changes.summary = /*post*/ ctx[18].summaries[/*type*/ ctx[21].slug];
				if (dirty & /*$types*/ 16) summarise_changes.custom_action = /*type*/ ctx[21].custom_action;
				summarise.$set(summarise_changes);
			},
			i(local) {
				if (current) return;
				transition_in(summarise.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(summarise.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(td);
				}

				destroy_component(summarise);
			}
		};
	}

	// (178:24) {#if !checkSummariesSet(post)}
	function create_if_block(ctx) {
		let if_block_anchor;

		function select_block_type(ctx, dirty) {
			if (/*summarising_all*/ ctx[0]) return create_if_block_1;
			return create_else_block;
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
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_block.d(detaching);
			}
		};
	}

	// (184:28) {:else}
	function create_else_block(ctx) {
		let button;
		let mounted;
		let dispose;

		function click_handler_1() {
			return /*click_handler_1*/ ctx[13](/*post*/ ctx[18]);
		}

		return {
			c() {
				button = element("button");
				button.textContent = "Summarise All";
				attr(button, "class", "button summaryengine-summarise-all svelte-90dff3");
			},
			m(target, anchor) {
				insert(target, button, anchor);

				if (!mounted) {
					dispose = listen(button, "click", click_handler_1);
					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
			},
			d(detaching) {
				if (detaching) {
					detach(button);
				}

				mounted = false;
				dispose();
			}
		};
	}

	// (179:28) {#if summarising_all}
	function create_if_block_1(ctx) {
		let button;

		return {
			c() {
				button = element("button");
				button.textContent = "Summarising...";
				attr(button, "class", "button summaryengine-summarise-all svelte-90dff3");
				button.disabled = "disabled";
			},
			m(target, anchor) {
				insert(target, button, anchor);
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(button);
				}
			}
		};
	}

	// (150:12) {#each $posts as post}
	function create_each_block(ctx) {
		let tr;
		let td0;
		let span1;
		let t1;
		let a;
		let t2_value = (/*post*/ ctx[18].post_title || "Untitled") + "";
		let t2;
		let a_href_value;
		let t3;
		let td1;
		let t4_value = /*post*/ ctx[18].post_date + "";
		let t4;
		let t5;
		let td2;
		let t6_value = /*post*/ ctx[18].post_author + "";
		let t6;
		let t7;
		let t8;
		let td3;
		let show_if = !checkSummariesSet(/*post*/ ctx[18]);
		let t9;
		let current;
		let mounted;
		let dispose;

		function click_handler() {
			return /*click_handler*/ ctx[11](/*post*/ ctx[18]);
		}

		function keydown_handler() {
			return /*keydown_handler*/ ctx[12](/*post*/ ctx[18]);
		}

		let each_value_1 = ensure_array_like(/*$types*/ ctx[4]);
		let each_blocks = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		let if_block = show_if && create_if_block(ctx);

		return {
			c() {
				tr = element("tr");
				td0 = element("td");
				span1 = element("span");
				span1.innerHTML = `<span class="screen-reader-text">View Post</span>`;
				t1 = space();
				a = element("a");
				t2 = text(t2_value);
				t3 = space();
				td1 = element("td");
				t4 = text(t4_value);
				t5 = space();
				td2 = element("td");
				t6 = text(t6_value);
				t7 = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t8 = space();
				td3 = element("td");
				if (if_block) if_block.c();
				t9 = space();
				attr(span1, "class", "dashicons dashicons-welcome-view-site");
				set_style(span1, "cursor", "pointer");
				attr(a, "href", a_href_value = "/wp-admin/post.php?post=" + /*post*/ ctx[18].id + "&action=edit");
			},
			m(target, anchor) {
				insert(target, tr, anchor);
				append(tr, td0);
				append(td0, span1);
				append(td0, t1);
				append(td0, a);
				append(a, t2);
				append(tr, t3);
				append(tr, td1);
				append(td1, t4);
				append(tr, t5);
				append(tr, td2);
				append(td2, t6);
				append(tr, t7);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(tr, null);
					}
				}

				append(tr, t8);
				append(tr, td3);
				if (if_block) if_block.m(td3, null);
				append(tr, t9);
				current = true;

				if (!mounted) {
					dispose = [
						listen(span1, "click", click_handler),
						listen(span1, "keydown", keydown_handler)
					];

					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				if ((!current || dirty & /*$posts*/ 8) && t2_value !== (t2_value = (/*post*/ ctx[18].post_title || "Untitled") + "")) set_data(t2, t2_value);

				if (!current || dirty & /*$posts*/ 8 && a_href_value !== (a_href_value = "/wp-admin/post.php?post=" + /*post*/ ctx[18].id + "&action=edit")) {
					attr(a, "href", a_href_value);
				}

				if ((!current || dirty & /*$posts*/ 8) && t4_value !== (t4_value = /*post*/ ctx[18].post_date + "")) set_data(t4, t4_value);
				if ((!current || dirty & /*$posts*/ 8) && t6_value !== (t6_value = /*post*/ ctx[18].post_author + "")) set_data(t6, t6_value);

				if (dirty & /*$types, $posts*/ 24) {
					each_value_1 = ensure_array_like(/*$types*/ ctx[4]);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block_1(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(tr, t8);
						}
					}

					group_outros();

					for (i = each_value_1.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}

				if (dirty & /*$posts*/ 8) show_if = !checkSummariesSet(/*post*/ ctx[18]);

				if (show_if) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block(ctx);
						if_block.c();
						if_block.m(td3, null);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value_1.length; i += 1) {
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
					detach(tr);
				}

				destroy_each(each_blocks, detaching);
				if (if_block) if_block.d();
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment(ctx) {
		let t0;
		let div5;
		let div4;
		let div0;
		let dates;
		let t1;
		let div3;
		let div1;
		let search_1;
		let t2;
		let div2;
		let pages;
		let t3;
		let table;
		let thead;
		let tr;
		let th0;
		let t5;
		let th1;
		let t7;
		let th2;
		let t9;
		let t10;
		let th3;
		let t11;
		let tbody;
		let current;
		let if_block = /*show_modal*/ ctx[1] && create_if_block_2(ctx);
		dates = new Dates({});
		dates.$on("click", /*reset*/ ctx[8]);
		search_1 = new Search({});
		search_1.$on("search", /*reset*/ ctx[8]);
		pages = new Pages({ props: { per_page } });
		pages.$on("click", /*getPosts*/ ctx[6]);
		pages.$on("change", /*getPosts*/ ctx[6]);
		let each_value_2 = ensure_array_like(/*$types*/ ctx[4]);
		let each_blocks_1 = [];

		for (let i = 0; i < each_value_2.length; i += 1) {
			each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
		}

		let each_value = ensure_array_like(/*$posts*/ ctx[3]);
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
				div5 = element("div");
				div4 = element("div");
				div0 = element("div");
				create_component(dates.$$.fragment);
				t1 = space();
				div3 = element("div");
				div1 = element("div");
				create_component(search_1.$$.fragment);
				t2 = space();
				div2 = element("div");
				create_component(pages.$$.fragment);
				t3 = space();
				table = element("table");
				thead = element("thead");
				tr = element("tr");
				th0 = element("th");
				th0.textContent = "Title";
				t5 = space();
				th1 = element("th");
				th1.textContent = "Date";
				t7 = space();
				th2 = element("th");
				th2.textContent = "Author";
				t9 = space();

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t10 = space();
				th3 = element("th");
				t11 = space();
				tbody = element("tbody");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				attr(div0, "id", "summaryEngineMetaBlockSummariseButtonContainerLeft");
				attr(div0, "class", "svelte-90dff3");
				attr(div1, "id", "summaryEngineSearchContainer");
				attr(div1, "class", "summary-engine-margin-bottom-5 svelte-90dff3");
				attr(div2, "id", "summaryEnginePagesContainer");
				attr(div3, "id", "summaryEngineMetaBlockSummariseButtonContainerRight");
				attr(div3, "class", "svelte-90dff3");
				attr(div4, "id", "summaryEngineMetaBlockSummariseButtonContainer");
				attr(div4, "class", "svelte-90dff3");
				attr(th0, "class", "summaryengine-col-10px svelte-90dff3");
				attr(th1, "class", "summaryengine-col-10px svelte-90dff3");
				attr(th2, "class", "summaryengine-col-10px svelte-90dff3");
				attr(table, "class", "wp-list-table widefat fixed striped table-view-list svelte-90dff3");
				toggle_class(table, "loading", /*$loading*/ ctx[5]);
				attr(div5, "id", "summaryEngineMetaBlock");
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, t0, anchor);
				insert(target, div5, anchor);
				append(div5, div4);
				append(div4, div0);
				mount_component(dates, div0, null);
				append(div4, t1);
				append(div4, div3);
				append(div3, div1);
				mount_component(search_1, div1, null);
				append(div3, t2);
				append(div3, div2);
				mount_component(pages, div2, null);
				append(div5, t3);
				append(div5, table);
				append(table, thead);
				append(thead, tr);
				append(tr, th0);
				append(tr, t5);
				append(tr, th1);
				append(tr, t7);
				append(tr, th2);
				append(tr, t9);

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(tr, null);
					}
				}

				append(tr, t10);
				append(tr, th3);
				append(table, t11);
				append(table, tbody);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(tbody, null);
					}
				}

				current = true;
			},
			p(ctx, [dirty]) {
				if (/*show_modal*/ ctx[1]) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty & /*show_modal*/ 2) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block_2(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(t0.parentNode, t0);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}

				if (dirty & /*$types*/ 16) {
					each_value_2 = ensure_array_like(/*$types*/ ctx[4]);
					let i;

					for (i = 0; i < each_value_2.length; i += 1) {
						const child_ctx = get_each_context_2(ctx, each_value_2, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
						} else {
							each_blocks_1[i] = create_each_block_2(child_ctx);
							each_blocks_1[i].c();
							each_blocks_1[i].m(tr, t10);
						}
					}

					for (; i < each_blocks_1.length; i += 1) {
						each_blocks_1[i].d(1);
					}

					each_blocks_1.length = each_value_2.length;
				}

				if (dirty & /*summarising_all, generateAllSummaries, $posts, checkSummariesSet, $types, showIframe*/ 665) {
					each_value = ensure_array_like(/*$posts*/ ctx[3]);
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
							each_blocks[i].m(tbody, null);
						}
					}

					group_outros();

					for (i = each_value.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}

				if (!current || dirty & /*$loading*/ 32) {
					toggle_class(table, "loading", /*$loading*/ ctx[5]);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				transition_in(dates.$$.fragment, local);
				transition_in(search_1.$$.fragment, local);
				transition_in(pages.$$.fragment, local);

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				transition_out(if_block);
				transition_out(dates.$$.fragment, local);
				transition_out(search_1.$$.fragment, local);
				transition_out(pages.$$.fragment, local);
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(div5);
				}

				if (if_block) if_block.d(detaching);
				destroy_component(dates);
				destroy_component(search_1);
				destroy_component(pages);
				destroy_each(each_blocks_1, detaching);
				destroy_each(each_blocks, detaching);
			}
		};
	}

	let per_page = 10;

	function checkSummariesSet(post) {
		let found = true;

		for (let slug in post.summaries) {
			if (!post.summaries[slug]?.summary) {
				found = false;
				break;
			}
		}

		return found;
	}

	function instance($$self, $$props, $$invalidate) {
		let $page;
		let $posts;
		let $types;
		let $loading;
		let $search;
		let $selected_date;
		component_subscribe($$self, page, $$value => $$invalidate(14, $page = $$value));
		component_subscribe($$self, posts, $$value => $$invalidate(3, $posts = $$value));
		component_subscribe($$self, types, $$value => $$invalidate(4, $types = $$value));
		component_subscribe($$self, loading, $$value => $$invalidate(5, $loading = $$value));
		component_subscribe($$self, search, $$value => $$invalidate(15, $search = $$value));
		component_subscribe($$self, selected_date, $$value => $$invalidate(16, $selected_date = $$value));
		let summarising_all = false;
		let show_modal = false;
		let modal_url = "";

		async function getPosts() {
			try {
				set_store_value(loading, $loading = true, $loading);
				const result = await ajaxExports.apiGet(`/summaryengine/v1/posts?date=${$selected_date}&size=${per_page}&page=${$page}&search=${$search}`);
				posts.set(result.posts);
				post_count.set(result.count);
				set_store_value(loading, $loading = false, $loading);
			} catch(err) {
				alert("An error occured loading the posts: " + err);
				console.error(err);
				set_store_value(loading, $loading = false, $loading);
			}
		}

		async function getTypes() {
			set_store_value(types, $types = await ajaxExports.apiGet(`/summaryengine/v1/types`), $types);
		}

		async function generateAllSummaries(post) {
			// console.log(post);
			$$invalidate(0, summarising_all = true);

			for (let type of $types) {
				const summary = post.summaries[type.slug];

				try {
					if (!summary) continue;
					if (summary.summary) continue;
					summary.summarising = true;
					posts.set($posts);
					const result = await ajaxExports.apiPost(`/summaryengine/v1/summarise`, { type_id: type.ID, post_id: post.id });
					console.log(result);
					if (!result?.summary) throw "No summary returned";
					post.summaries[type.slug].summary = result.summary;
					post.summaries[type.slug].summary_id = result.ID;
					post.summaries[type.slug].summary_details = result;
					post.summaries[type.slug].summary_details.rating = 0;

					// console.log(post);
					posts.set($posts);

					summary.summarising = false;
				} catch(err) {
					console.error(err);
					alert("An error occured: " + err);
					summary.summarising = false;
				}
			}

			$$invalidate(0, summarising_all = false);
			posts.set($posts);
		}

		onMount(async () => {
			try {
				await getTypes();
				await getPosts();
			} catch(e) {
				console.error(e);
			}
		});

		async function reset() {
			set_store_value(page, $page = 1, $page);
			await getPosts();
		}

		function showIframe(url) {
			$$invalidate(2, modal_url = url);
			$$invalidate(1, show_modal = true);
		}

		const close_handler = () => $$invalidate(1, show_modal = false);
		const click_handler = post => showIframe(post.permalink);
		const keydown_handler = post => showIframe(post.permalink);
		const click_handler_1 = post => generateAllSummaries(post);

		return [
			summarising_all,
			show_modal,
			modal_url,
			$posts,
			$types,
			$loading,
			getPosts,
			generateAllSummaries,
			reset,
			showIframe,
			close_handler,
			click_handler,
			keydown_handler,
			click_handler_1
		];
	}

	class Review extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance, create_fragment, safe_not_equal, {});
		}
	}

	const review = new Review({
	    target: document.getElementById('summaryEngineReview'),
	});

	return review;

})();
//# sourceMappingURL=summaryengine-review.js.map
