var summaryengine = (function () {
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

	/** @returns {boolean} */
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
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
	function toggle_class(element, name, toggle) {
		// The `!!` is required because an `undefined` flag means flipping the current state.
		element.classList.toggle(name, !!toggle);
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

	function get_content() {
	    if (jQuery("#titlewrap").length) { // Classic editor
	        console.log("Classic editor");
	        if (jQuery(".wp-editor-area").is(":visible")) { // The code editor is visible
	            console.log("Code editor");
	            return jQuery(".wp-editor-area").val();
	        } else if (window.tinymce) { // The visual editor is visible
	            console.log("TinyMCE editor");
	            let content = tinymce.editors.content.getContent();
	            if (content.length > 0) {
	                return content;
	            }
	        }
	        return jQuery("#content").val(); // Last try...
	    } else { // Gutenberg editor
	        return wp.data.select( "core/editor" ).getEditedPostContent();
	    }
	}

	function strip_tags(html) {
	    let tmp = document.createElement("div");
	    tmp.innerHTML = html
	        .replace(/(<(br[^>]*)>)/ig, '\n')
	        .replace(/(<(p[^>]*)>)/ig, '\n')
	        .replace(/(<(div[^>]*)>)/ig, '\n')
	        .replace(/(<(h[1-6][^>]*)>)/ig, '\n')
	        .replace(/(<(li[^>]*)>)/ig, '\n')
	        .replace(/(<(ul[^>]*)>)/ig, '\n')
	        .replace(/(<(ol[^>]*)>)/ig, '\n')
	        .replace(/(<(blockquote[^>]*)>)/ig, '\n')
	        .replace(/(<(pre[^>]*)>)/ig, '\n')
	        .replace(/(<(hr[^>]*)>)/ig, '\n')
	        .replace(/(<(table[^>]*)>)/ig, '\n')
	        .replace(/(<(tr[^>]*)>)/ig, '\n')
	        .replace(/(<(td[^>]*)>)/ig, '\n')
	        .replace(/(<(th[^>]*)>)/ig, '\n')
	        .replace(/(<(caption[^>]*)>)/ig, '\n')
	        .replace(/(<(dl[^>]*)>)/ig, '\n')
	        .replace(/(<(dt[^>]*)>)/ig, '\n')
	        .replace(/(<(dd[^>]*)>)/ig, '\n')
	        .replace(/(<(address[^>]*)>)/ig, '\n')
	        .replace(/(<(section[^>]*)>)/ig, '\n')
	        .replace(/(<(article[^>]*)>)/ig, '\n')
	        .replace(/(<(aside[^>]*)>)/ig, '\n');
	    return tmp.textContent || tmp.innerText || "";
	}

	async function generate_summary(type) {
	    console.log("Getting content...");
	    const content = strip_tags(get_content());
	    if (!content.length) {
	        alert("Nothing to summarise yet...");
	        return;
	    }
	    console.log({ content });
	    try {
	        const data = {
	            content: content,
	            post_id: jQuery("#post_ID").val(),
	            // settings: JSON.stringify(settings),
	            type_id: type.ID,
	        };
	        console.log(data);
	        const response = (await ajaxExports.apiPost("summaryengine/v1/summarise", data)).result;
	        return response;
	    } catch (err) {
	        if (err.message) throw err.message;
	        throw err;
	    }
	}

	/* src/components/Button.svelte generated by Svelte v4.2.19 */

	function create_fragment$3(ctx) {
		let button;
		let button_class_value;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[16].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

		return {
			c() {
				button = element("button");
				if (default_slot) default_slot.c();
				attr(button, "type", /*type*/ ctx[0]);
				attr(button, "id", /*id*/ ctx[3]);
				attr(button, "title", /*title*/ ctx[1]);
				button.disabled = /*disabled*/ ctx[2];
				attr(button, "aria-label", /*aria_label*/ ctx[9]);
				attr(button, "aria-hidden", /*aria_hidden*/ ctx[10]);
				attr(button, "class", button_class_value = "button " + /*btn_class*/ ctx[11] + " " + (/*$$restProps*/ ctx[13].class || ''));
				attr(button, "style", /*style*/ ctx[12]);
				toggle_class(button, "button-primary", /*primary*/ ctx[4]);
				toggle_class(button, "button-large", /*large*/ ctx[5]);
				toggle_class(button, "button-small", /*small*/ ctx[6]);
				toggle_class(button, "delete", /*warning*/ ctx[7]);
				toggle_class(button, "button-link", /*link*/ ctx[8]);
			},
			m(target, anchor) {
				insert(target, button, anchor);

				if (default_slot) {
					default_slot.m(button, null);
				}

				current = true;

				if (!mounted) {
					dispose = listen(button, "click", /*click_handler*/ ctx[17]);
					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 32768)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[15],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[15])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null),
							null
						);
					}
				}

				if (!current || dirty & /*type*/ 1) {
					attr(button, "type", /*type*/ ctx[0]);
				}

				if (!current || dirty & /*id*/ 8) {
					attr(button, "id", /*id*/ ctx[3]);
				}

				if (!current || dirty & /*title*/ 2) {
					attr(button, "title", /*title*/ ctx[1]);
				}

				if (!current || dirty & /*disabled*/ 4) {
					button.disabled = /*disabled*/ ctx[2];
				}

				if (!current || dirty & /*aria_label*/ 512) {
					attr(button, "aria-label", /*aria_label*/ ctx[9]);
				}

				if (!current || dirty & /*aria_hidden*/ 1024) {
					attr(button, "aria-hidden", /*aria_hidden*/ ctx[10]);
				}

				if (!current || dirty & /*btn_class, $$restProps*/ 10240 && button_class_value !== (button_class_value = "button " + /*btn_class*/ ctx[11] + " " + (/*$$restProps*/ ctx[13].class || ''))) {
					attr(button, "class", button_class_value);
				}

				if (!current || dirty & /*style*/ 4096) {
					attr(button, "style", /*style*/ ctx[12]);
				}

				if (!current || dirty & /*btn_class, $$restProps, primary*/ 10256) {
					toggle_class(button, "button-primary", /*primary*/ ctx[4]);
				}

				if (!current || dirty & /*btn_class, $$restProps, large*/ 10272) {
					toggle_class(button, "button-large", /*large*/ ctx[5]);
				}

				if (!current || dirty & /*btn_class, $$restProps, small*/ 10304) {
					toggle_class(button, "button-small", /*small*/ ctx[6]);
				}

				if (!current || dirty & /*btn_class, $$restProps, warning*/ 10368) {
					toggle_class(button, "delete", /*warning*/ ctx[7]);
				}

				if (!current || dirty & /*btn_class, $$restProps, link*/ 10496) {
					toggle_class(button, "button-link", /*link*/ ctx[8]);
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(button);
				}

				if (default_slot) default_slot.d(detaching);
				mounted = false;
				dispose();
			}
		};
	}

	function instance$2($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"type","title","disabled","id","primary","large","small","warning","danger","link","aria_label","aria_hidden","btn_class"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		let { type = "button" } = $$props;
		let { title = null } = $$props;
		let { disabled = false } = $$props;
		let { id = null } = $$props;
		let { primary = false } = $$props;
		let { large = false } = $$props;
		let { small = false } = $$props;
		let { warning = false } = $$props;
		let { danger = false } = $$props;
		let { link = false } = $$props;
		let { aria_label = null } = $$props;
		let { aria_hidden = false } = $$props;
		let { btn_class = "button" } = $$props;
		let style = "";

		function click_handler(event) {
			bubble.call(this, $$self, event);
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(13, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('type' in $$new_props) $$invalidate(0, type = $$new_props.type);
			if ('title' in $$new_props) $$invalidate(1, title = $$new_props.title);
			if ('disabled' in $$new_props) $$invalidate(2, disabled = $$new_props.disabled);
			if ('id' in $$new_props) $$invalidate(3, id = $$new_props.id);
			if ('primary' in $$new_props) $$invalidate(4, primary = $$new_props.primary);
			if ('large' in $$new_props) $$invalidate(5, large = $$new_props.large);
			if ('small' in $$new_props) $$invalidate(6, small = $$new_props.small);
			if ('warning' in $$new_props) $$invalidate(7, warning = $$new_props.warning);
			if ('danger' in $$new_props) $$invalidate(14, danger = $$new_props.danger);
			if ('link' in $$new_props) $$invalidate(8, link = $$new_props.link);
			if ('aria_label' in $$new_props) $$invalidate(9, aria_label = $$new_props.aria_label);
			if ('aria_hidden' in $$new_props) $$invalidate(10, aria_hidden = $$new_props.aria_hidden);
			if ('btn_class' in $$new_props) $$invalidate(11, btn_class = $$new_props.btn_class);
			if ('$$scope' in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*warning*/ 128) {
				if (warning) {
					$$invalidate(12, style = "color: #a00; border-color: #a00;");
				}
			}

			if ($$self.$$.dirty & /*danger*/ 16384) {
				if (danger) {
					$$invalidate(12, style = "background-color: #a00; border-color: #a00; color: #fff;");
				}
			}
		};

		return [
			type,
			title,
			disabled,
			id,
			primary,
			large,
			small,
			warning,
			link,
			aria_label,
			aria_hidden,
			btn_class,
			style,
			$$restProps,
			danger,
			$$scope,
			slots,
			click_handler
		];
	}

	class Button extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$2, create_fragment$3, safe_not_equal, {
				type: 0,
				title: 1,
				disabled: 2,
				id: 3,
				primary: 4,
				large: 5,
				small: 6,
				warning: 7,
				danger: 14,
				link: 8,
				aria_label: 9,
				aria_hidden: 10,
				btn_class: 11
			});
		}
	}

	/* src/components/Spinner.svelte generated by Svelte v4.2.19 */

	function create_fragment$2(ctx) {
		let div4;

		return {
			c() {
				div4 = element("div");
				div4.innerHTML = `<div class="svelte-haebdk"></div> <div class="svelte-haebdk"></div> <div class="svelte-haebdk"></div> <div class="svelte-haebdk"></div>`;
				attr(div4, "class", "summaryengine-spinner svelte-haebdk");
			},
			m(target, anchor) {
				insert(target, div4, anchor);
			},
			p: noop,
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div4);
				}
			}
		};
	}

	class Spinner extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, null, create_fragment$2, safe_not_equal, {});
		}
	}

	/* src/components/Summary.svelte generated by Svelte v4.2.19 */

	function create_if_block_6(ctx) {
		let div;
		let spinner;
		let current;
		spinner = new Spinner({});

		return {
			c() {
				div = element("div");
				create_component(spinner.$$.fragment);
				attr(div, "class", "summaryengine-overlay svelte-tog63c");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				mount_component(spinner, div, null);
				current = true;
			},
			i(local) {
				if (current) return;
				transition_in(spinner.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(spinner.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_component(spinner);
			}
		};
	}

	// (184:8) {#if history.length > 1 && summary && summary.summary_rating !== 1}
	function create_if_block_4(ctx) {
		let div;
		let t;
		let if_block_anchor;
		let mounted;
		let dispose;
		let if_block = /*history*/ ctx[5].length > 2 && create_if_block_5(ctx);

		return {
			c() {
				div = element("div");
				t = space();
				if (if_block) if_block.c();
				if_block_anchor = empty();
				attr(div, "class", "dashicons dashicons-arrow-left-alt");
				attr(div, "role", "button");
				attr(div, "tabindex", "0");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				insert(target, t, anchor);
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);

				if (!mounted) {
					dispose = [
						listen(div, "click", /*doBack*/ ctx[11]),
						listen(div, "keypress", /*doBack*/ ctx[11])
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (/*history*/ ctx[5].length > 2) {
					if (if_block) {
						if_block.p(ctx, dirty);
					} else {
						if_block = create_if_block_5(ctx);
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},
			d(detaching) {
				if (detaching) {
					detach(div);
					detach(t);
					detach(if_block_anchor);
				}

				if (if_block) if_block.d(detaching);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (192:12) {#if history.length > 2}
	function create_if_block_5(ctx) {
		let div;
		let mounted;
		let dispose;

		return {
			c() {
				div = element("div");
				attr(div, "class", "dashicons dashicons-arrow-right-alt");
				attr(div, "role", "button");
				attr(div, "tabindex", "0");
			},
			m(target, anchor) {
				insert(target, div, anchor);

				if (!mounted) {
					dispose = [
						listen(div, "click", /*doForward*/ ctx[12]),
						listen(div, "keypress", /*doForward*/ ctx[12])
					];

					mounted = true;
				}
			},
			p: noop,
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (205:4) {:else}
	function create_else_block(ctx) {
		let label;
		let t1;
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block_1, create_if_block_2, create_if_block_3, create_else_block_1];
		const if_blocks = [];

		function select_block_type_1(ctx, dirty) {
			if (/*summary*/ ctx[1] && /*summary*/ ctx[1].summary_rating === 1 && !/*editing*/ ctx[2]) return 0;
			if (/*summary*/ ctx[1] && /*summary*/ ctx[1].summary_rating === 1 && /*editing*/ ctx[2]) return 1;
			if (/*summary*/ ctx[1] && /*summary*/ ctx[1].summary) return 2;
			return 3;
		}

		current_block_type_index = select_block_type_1(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				label = element("label");
				label.textContent = "Summary";
				t1 = space();
				if_block.c();
				if_block_anchor = empty();
				attr(label, "class", "screen-reader-text");
				attr(label, "for", "summary");
			},
			m(target, anchor) {
				insert(target, label, anchor);
				insert(target, t1, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_1(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
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
					detach(label);
					detach(t1);
					detach(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	// (203:4) {#if loading}
	function create_if_block(ctx) {
		let spinner;
		let current;
		spinner = new Spinner({});

		return {
			c() {
				create_component(spinner.$$.fragment);
			},
			m(target, anchor) {
				mount_component(spinner, target, anchor);
				current = true;
			},
			p: noop,
			i(local) {
				if (current) return;
				transition_in(spinner.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(spinner.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(spinner, detaching);
			}
		};
	}

	// (248:8) {:else}
	function create_else_block_1(ctx) {
		let div;
		let button;
		let current;

		button = new Button({
				props: {
					type: "button",
					primary: true,
					$$slots: { default: [create_default_slot_5] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*doGenerate*/ ctx[8]);

		return {
			c() {
				div = element("div");
				create_component(button.$$.fragment);
				attr(div, "class", "summaryengine-nav svelte-tog63c");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				mount_component(button, div, null);
				current = true;
			},
			p(ctx, dirty) {
				const button_changes = {};

				if (dirty & /*$$scope*/ 2097152) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_component(button);
			}
		};
	}

	// (236:45) 
	function create_if_block_3(ctx) {
		let textarea;
		let t0;
		let div;
		let button0;
		let t1;
		let button1;
		let current;
		let mounted;
		let dispose;

		button0 = new Button({
				props: {
					$$slots: { default: [create_default_slot_4] },
					$$scope: { ctx }
				}
			});

		button0.$on("click", /*doApprove*/ ctx[6]);

		button1 = new Button({
				props: {
					warning: true,
					$$slots: { default: [create_default_slot_3] },
					$$scope: { ctx }
				}
			});

		button1.$on("click", /*doReject*/ ctx[7]);

		return {
			c() {
				textarea = element("textarea");
				t0 = space();
				div = element("div");
				create_component(button0.$$.fragment);
				t1 = space();
				create_component(button1.$$.fragment);
				attr(textarea, "rows", "1");
				attr(textarea, "cols", "40");
				attr(textarea, "id", "summaryEngineSummary");
				attr(textarea, "class", "summaryengine-textarea svelte-tog63c");
				attr(div, "class", "summaryengine-nav svelte-tog63c");
			},
			m(target, anchor) {
				insert(target, textarea, anchor);
				set_input_value(textarea, /*summary*/ ctx[1].summary);
				insert(target, t0, anchor);
				insert(target, div, anchor);
				mount_component(button0, div, null);
				append(div, t1);
				mount_component(button1, div, null);
				current = true;

				if (!mounted) {
					dispose = listen(textarea, "input", /*textarea_input_handler_1*/ ctx[15]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty & /*summary*/ 2) {
					set_input_value(textarea, /*summary*/ ctx[1].summary);
				}

				const button0_changes = {};

				if (dirty & /*$$scope*/ 2097152) {
					button0_changes.$$scope = { dirty, ctx };
				}

				button0.$set(button0_changes);
				const button1_changes = {};

				if (dirty & /*$$scope*/ 2097152) {
					button1_changes.$$scope = { dirty, ctx };
				}

				button1.$set(button1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button0.$$.fragment, local);
				transition_in(button1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button0.$$.fragment, local);
				transition_out(button1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(textarea);
					detach(t0);
					detach(div);
				}

				destroy_component(button0);
				destroy_component(button1);
				mounted = false;
				dispose();
			}
		};
	}

	// (224:69) 
	function create_if_block_2(ctx) {
		let textarea;
		let t;
		let div;
		let button;
		let current;
		let mounted;
		let dispose;

		button = new Button({
				props: {
					$$slots: { default: [create_default_slot_2] },
					$$scope: { ctx }
				}
			});

		button.$on("click", /*doSave*/ ctx[10]);

		return {
			c() {
				textarea = element("textarea");
				t = space();
				div = element("div");
				create_component(button.$$.fragment);
				attr(textarea, "rows", "1");
				attr(textarea, "cols", "40");
				attr(textarea, "id", "summaryEngineSummary");
				attr(textarea, "class", "summaryengine-textarea svelte-tog63c");
				attr(div, "class", "summaryengine-nav svelte-tog63c");
			},
			m(target, anchor) {
				insert(target, textarea, anchor);
				set_input_value(textarea, /*summary*/ ctx[1].summary);
				insert(target, t, anchor);
				insert(target, div, anchor);
				mount_component(button, div, null);
				current = true;

				if (!mounted) {
					dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[14]);
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty & /*summary*/ 2) {
					set_input_value(textarea, /*summary*/ ctx[1].summary);
				}

				const button_changes = {};

				if (dirty & /*$$scope*/ 2097152) {
					button_changes.$$scope = { dirty, ctx };
				}

				button.$set(button_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(textarea);
					detach(t);
					detach(div);
				}

				destroy_component(button);
				mounted = false;
				dispose();
			}
		};
	}

	// (208:8) {#if summary && summary.summary_rating === 1 && !editing}
	function create_if_block_1(ctx) {
		let textarea;
		let textarea_value_value;
		let t0;
		let div;
		let button0;
		let t1;
		let button1;
		let current;

		button0 = new Button({
				props: {
					$$slots: { default: [create_default_slot_1] },
					$$scope: { ctx }
				}
			});

		button0.$on("click", /*click_handler*/ ctx[13]);

		button1 = new Button({
				props: {
					type: "button",
					warning: true,
					$$slots: { default: [create_default_slot] },
					$$scope: { ctx }
				}
			});

		button1.$on("click", /*doUnapprove*/ ctx[9]);

		return {
			c() {
				textarea = element("textarea");
				t0 = space();
				div = element("div");
				create_component(button0.$$.fragment);
				t1 = space();
				create_component(button1.$$.fragment);
				attr(textarea, "rows", "1");
				attr(textarea, "cols", "40");
				attr(textarea, "id", "summaryEngineSummary");
				attr(textarea, "class", "summaryengine-textarea svelte-tog63c");
				textarea.value = textarea_value_value = /*summary*/ ctx[1].summary;
				textarea.readOnly = true;
				attr(div, "class", "summaryengine-nav svelte-tog63c");
			},
			m(target, anchor) {
				insert(target, textarea, anchor);
				insert(target, t0, anchor);
				insert(target, div, anchor);
				mount_component(button0, div, null);
				append(div, t1);
				mount_component(button1, div, null);
				current = true;
			},
			p(ctx, dirty) {
				if (!current || dirty & /*summary*/ 2 && textarea_value_value !== (textarea_value_value = /*summary*/ ctx[1].summary)) {
					textarea.value = textarea_value_value;
				}

				const button0_changes = {};

				if (dirty & /*$$scope*/ 2097152) {
					button0_changes.$$scope = { dirty, ctx };
				}

				button0.$set(button0_changes);
				const button1_changes = {};

				if (dirty & /*$$scope*/ 2097152) {
					button1_changes.$$scope = { dirty, ctx };
				}

				button1.$set(button1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button0.$$.fragment, local);
				transition_in(button1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button0.$$.fragment, local);
				transition_out(button1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(textarea);
					detach(t0);
					detach(div);
				}

				destroy_component(button0);
				destroy_component(button1);
			}
		};
	}

	// (251:16) <Button type="button" on:click={doGenerate} primary={true}                     >
	function create_default_slot_5(ctx) {
		let t;

		return {
			c() {
				t = text("Generate");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (245:16) <Button on:click={doApprove}>
	function create_default_slot_4(ctx) {
		let t;

		return {
			c() {
				t = text("Approve");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (246:16) <Button on:click={doReject} warning={true}>
	function create_default_slot_3(ctx) {
		let t;

		return {
			c() {
				t = text("Reject");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (233:16) <Button on:click={doSave}>
	function create_default_slot_2(ctx) {
		let t;

		return {
			c() {
				t = text("Save");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (218:16) <Button on:click={() => (editing = true)}>
	function create_default_slot_1(ctx) {
		let t;

		return {
			c() {
				t = text("Edit");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (219:16) <Button type="button" on:click={doUnapprove} warning={true}                     >
	function create_default_slot(ctx) {
		let t;

		return {
			c() {
				t = text("Unapprove");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	function create_fragment$1(ctx) {
		let div1;
		let t0;
		let div0;
		let h4;
		let t1_value = /*type*/ ctx[0].name + "";
		let t1;
		let t2;
		let t3;
		let current_block_type_index;
		let if_block2;
		let current;
		let if_block0 = (/*loading*/ ctx[4] || /*saving*/ ctx[3]) && create_if_block_6();
		let if_block1 = /*history*/ ctx[5].length > 1 && /*summary*/ ctx[1] && /*summary*/ ctx[1].summary_rating !== 1 && create_if_block_4(ctx);
		const if_block_creators = [create_if_block, create_else_block];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*loading*/ ctx[4]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block2 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				div1 = element("div");
				if (if_block0) if_block0.c();
				t0 = space();
				div0 = element("div");
				h4 = element("h4");
				t1 = text(t1_value);
				t2 = space();
				if (if_block1) if_block1.c();
				t3 = space();
				if_block2.c();
				attr(div0, "class", "summaryengine-header svelte-tog63c");
				attr(div1, "id", "summaryEngineMetaBlock");
			},
			m(target, anchor) {
				insert(target, div1, anchor);
				if (if_block0) if_block0.m(div1, null);
				append(div1, t0);
				append(div1, div0);
				append(div0, h4);
				append(h4, t1);
				append(div0, t2);
				if (if_block1) if_block1.m(div0, null);
				append(div1, t3);
				if_blocks[current_block_type_index].m(div1, null);
				current = true;
			},
			p(ctx, [dirty]) {
				if (/*loading*/ ctx[4] || /*saving*/ ctx[3]) {
					if (if_block0) {
						if (dirty & /*loading, saving*/ 24) {
							transition_in(if_block0, 1);
						}
					} else {
						if_block0 = create_if_block_6();
						if_block0.c();
						transition_in(if_block0, 1);
						if_block0.m(div1, t0);
					}
				} else if (if_block0) {
					group_outros();

					transition_out(if_block0, 1, 1, () => {
						if_block0 = null;
					});

					check_outros();
				}

				if ((!current || dirty & /*type*/ 1) && t1_value !== (t1_value = /*type*/ ctx[0].name + "")) set_data(t1, t1_value);

				if (/*history*/ ctx[5].length > 1 && /*summary*/ ctx[1] && /*summary*/ ctx[1].summary_rating !== 1) {
					if (if_block1) {
						if_block1.p(ctx, dirty);
					} else {
						if_block1 = create_if_block_4(ctx);
						if_block1.c();
						if_block1.m(div0, null);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}

				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block2 = if_blocks[current_block_type_index];

					if (!if_block2) {
						if_block2 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block2.c();
					} else {
						if_block2.p(ctx, dirty);
					}

					transition_in(if_block2, 1);
					if_block2.m(div1, null);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block0);
				transition_in(if_block2);
				current = true;
			},
			o(local) {
				transition_out(if_block0);
				transition_out(if_block2);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div1);
				}

				if (if_block0) if_block0.d();
				if (if_block1) if_block1.d();
				if_blocks[current_block_type_index].d();
			}
		};
	}

	function _parse_summary(s) {
		return {
			summary: s.summary,
			summary_id: Number(s.summary_id),
			summary_rating: Number(s.summary_rating)
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		const post_id = jQuery("#post_ID").val();
		let { type } = $$props;
		let summary = null;
		let editing = false;
		let saving = false;
		let loading = true;
		let approved = false;
		let history = [];

		async function updateMetadata() {
			var _a, _b;

			try {
				if (!summary) return;
				$$invalidate(3, saving = true);
				const slug = type.slug;

				const meta_fields = [
					{
						key: `summaryengine_${slug}`,
						value: summary.summary
					},
					{
						key: `summaryengine_${slug}_id`,
						value: summary.summary_id
					},
					{
						key: `summaryengine_${slug}_rating`,
						value: summary.summary_rating
					}
				];

				for (let meta_field of meta_fields) {
					const el_name = document.querySelector(`input[value='${meta_field.key}']`);
					if (!el_name) continue;

					const meta_id = (_b = (_a = el_name === null || el_name === void 0
					? void 0
					: el_name.getAttribute("id")) === null || _a === void 0
					? void 0
					: _a.replace("meta-", "")) === null || _b === void 0
					? void 0
					: _b.replace("-key", "");

					const valueElement = document.getElementById(`meta-${meta_id}-value`);

					if (valueElement) {
						valueElement.innerHTML = meta_field.value.toString();
					}
				}

				$$invalidate(3, saving = false);
			} catch(err) {
				console.error(err);
				alert("An error occured: " + err);
				$$invalidate(3, saving = false);
			}
		}

		onMount(async () => {
			try {
				$$invalidate(1, summary = _parse_summary(await ajaxExports.apiGet(`summaryengine/v1/summary/${post_id}?type_id=${type.ID}`)));
				approved = Number(summary.summary_rating) === 1;
				$$invalidate(4, loading = false);

				if (summary === null || summary === void 0
				? void 0
				: summary.summary) {
					history.push(summary);
				}

				$$invalidate(5, history);
			} catch(e) {
				console.error(e);
				alert("An error occured: " + e);
				$$invalidate(4, loading = false);
			}
		});

		async function saveCurrent() {
			console.log("Save current");

			try {
				$$invalidate(3, saving = true);

				if (summary) {
					await ajaxExports.apiPut(`/summaryengine/v1/summary/${summary.summary_id}`, summary);
					updateMetadata();
				}
			} catch(err) {
				console.error(err);
				alert("An error occured: " + err);
			} finally {
				$$invalidate(3, saving = false);
			}
		}

		async function generate() {
			try {
				$$invalidate(3, saving = true);
				const response = await generate_summary(type);
				if (!response) return;

				$$invalidate(1, summary = _parse_summary({
					summary: response.summary,
					summary_id: response.ID,
					summary_rating: 0
				}));

				updateMetadata();
				history.push(summary);
				$$invalidate(5, history);
			} catch(err) {
				console.error(err);
				alert("An error occured: " + err);
			} finally {
				$$invalidate(3, saving = false);
			}
		}

		async function doApprove() {
			console.log("Approve");
			if (!summary) return;
			$$invalidate(1, summary.summary_rating = 1, summary);
			await saveCurrent();
		}

		async function doReject() {
			console.log("Reject");
			if (!summary) return;
			$$invalidate(1, summary.summary_rating = -1, summary);
			await saveCurrent();
			await generate();
		}

		async function doGenerate(e) {
			e.preventDefault();
			console.log("Generate");
			await generate();
		}

		async function doUnapprove() {
			console.log("Unapprove");
			if (!summary) return;
			$$invalidate(1, summary.summary_rating = 0, summary);
			await saveCurrent();
		}

		async function doSave() {
			console.log("Save");
			$$invalidate(2, editing = false);
			await saveCurrent();
		}

		async function doBack() {
			console.log("Back");
			$$invalidate(2, editing = false);
			if (history.length <= 1) return;
			const lastItem = history.pop();
			if (!lastItem) return;
			history.unshift(lastItem);
			$$invalidate(1, summary = history[history.length - 1]);
			await saveCurrent();
		}

		async function doForward() {
			console.log("Forward");
			$$invalidate(2, editing = false);
			if (history.length <= 1) return;
			const firstItem = history.shift();
			if (!firstItem) return;
			history.push(firstItem);
			$$invalidate(1, summary = history[history.length - 1]);
			await saveCurrent();
		}

		const click_handler = () => $$invalidate(2, editing = true);

		function textarea_input_handler() {
			summary.summary = this.value;
			$$invalidate(1, summary);
		}

		function textarea_input_handler_1() {
			summary.summary = this.value;
			$$invalidate(1, summary);
		}

		$$self.$$set = $$props => {
			if ('type' in $$props) $$invalidate(0, type = $$props.type);
		};

		updateMetadata();

		return [
			type,
			summary,
			editing,
			saving,
			loading,
			history,
			doApprove,
			doReject,
			doGenerate,
			doUnapprove,
			doSave,
			doBack,
			doForward,
			click_handler,
			textarea_input_handler,
			textarea_input_handler_1
		];
	}

	class Summary extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$1, create_fragment$1, safe_not_equal, { type: 0 });
		}
	}

	/* src/PostEdit.svelte generated by Svelte v4.2.19 */

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[1] = list[i];
		return child_ctx;
	}

	// (15:0) {#each types as type}
	function create_each_block(ctx) {
		let div;
		let summary;
		let t;
		let current;
		summary = new Summary({ props: { type: /*type*/ ctx[1] } });

		return {
			c() {
				div = element("div");
				create_component(summary.$$.fragment);
				t = space();
				attr(div, "class", "summaryengine-summary svelte-12oq5wz");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				mount_component(summary, div, null);
				append(div, t);
				current = true;
			},
			p(ctx, dirty) {
				const summary_changes = {};
				if (dirty & /*types*/ 1) summary_changes.type = /*type*/ ctx[1];
				summary.$set(summary_changes);
			},
			i(local) {
				if (current) return;
				transition_in(summary.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(summary.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_component(summary);
			}
		};
	}

	function create_fragment(ctx) {
		let each_1_anchor;
		let current;
		let each_value = ensure_array_like(/*types*/ ctx[0]);
		let each_blocks = [];

		for (let i = 0; i < each_value.length; i += 1) {
			each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

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
				current = true;
			},
			p(ctx, [dirty]) {
				if (dirty & /*types*/ 1) {
					each_value = ensure_array_like(/*types*/ ctx[0]);
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
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
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
					detach(each_1_anchor);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let types = [];

		onMount(async () => {
			try {
				$$invalidate(0, types = await ajaxExports.apiGet(`/summaryengine/v1/types`));
			} catch(e) {
				console.error(e);
			}
		});

		return [types];
	}

	class PostEdit extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance, create_fragment, safe_not_equal, {});
		}
	}

	const app = new PostEdit({
	    target: document.getElementById('summaryEngineApp'),
	});

	return app;

})();
//# sourceMappingURL=summaryengine.js.map
