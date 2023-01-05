var summaryengine_review = (function () {
    'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
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
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
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
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
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
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
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
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
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
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
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
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
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

    function apiPost(path, data) {
        return new Promise((resolve, reject) => {
            wp.apiRequest({
                path,
                data,
                type: "POST",
            })
            .done(async (response) => {
                if (response.error) {
                    reject(response);
                }
                resolve(response);
            })
            .fail(async (response) => {
                reject(response.responseJSON?.message || response.statusText || response.responseText || response);
            });
        });
    }

    function apiGet(path) {
        return new Promise((resolve, reject) => {
            wp.apiRequest({
                path,
                type: "GET",
            })
            .done(async (response) => {
                if (response.error) {
                    reject(response);
                }
                resolve(response);
            })
            .fail(async (response) => {
                reject(response.responseJSON?.message || response.statusText || response.responseText || response);
            });
        });
    }

    function apiPut(path, data) {
        return new Promise((resolve, reject) => {
            wp.apiRequest({
                path,
                data,
                type: "PUT",
            })
            .done(async (response) => {
                if (response.error) {
                    reject(response);
                }
                resolve(response);
            })
            .fail(async (response) => {
                reject(response.responseJSON?.message || response.statusText || response.responseText || response);
            });
        });
    }

    /* src/review/components/Summarise.svelte generated by Svelte v3.52.0 */

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
    				dispose = listen(input, "click", /*summarise*/ ctx[8]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (116:8) {#if summary.summarising}
    function create_if_block_9(ctx) {
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
    			if (detaching) detach(input);
    		}
    	};
    }

    // (101:4) {#if summary.summary}
    function create_if_block_6(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*editing*/ ctx[2]) return create_if_block_7;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type_1(ctx);
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
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
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
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (110:8) {:else}
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
    			if (detaching) detach(div);
    		}
    	};
    }

    // (102:8) {#if editing}
    function create_if_block_7(ctx) {
    	let textarea;
    	let t;
    	let if_block_anchor;
    	let mounted;
    	let dispose;

    	function select_block_type_2(ctx, dirty) {
    		if (!/*saving*/ ctx[7]) return create_if_block_8;
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
    				dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[14]);
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
    			if (detaching) detach(textarea);
    			if (detaching) detach(t);
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (107:12) {:else}
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
    			if (detaching) detach(input);
    		}
    	};
    }

    // (104:12) {#if (!saving)}
    function create_if_block_8(ctx) {
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
    					listen(input0, "click", /*save*/ ctx[11]),
    					listen(input1, "click", /*click_handler*/ ctx[15])
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(input0);
    			if (detaching) detach(t);
    			if (detaching) detach(input1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (122:4) {#if hovering || just_summarised}
    function create_if_block$1(ctx) {
    	let div;
    	let if_block = /*summary*/ ctx[0]?.summary && !/*editing*/ ctx[2] && create_if_block_1$1(ctx);

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
    			if (/*summary*/ ctx[0]?.summary && !/*editing*/ ctx[2]) {
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
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    		}
    	};
    }

    // (124:12) {#if summary?.summary && !editing}
    function create_if_block_1$1(ctx) {
    	let t0;
    	let t1;
    	let input;
    	let mounted;
    	let dispose;
    	let if_block0 = !/*approved*/ ctx[5] && !/*disapproving*/ ctx[3] && create_if_block_4(ctx);

    	function select_block_type_4(ctx, dirty) {
    		if (/*disapproving*/ ctx[3]) return create_if_block_2;
    		if (!/*approving*/ ctx[4]) return create_if_block_3;
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
    				dispose = listen(input, "click", /*click_handler_1*/ ctx[16]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (!/*approved*/ ctx[5] && !/*disapproving*/ ctx[3]) {
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
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t0);

    			if (if_block1) {
    				if_block1.d(detaching);
    			}

    			if (detaching) detach(t1);
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (125:16) {#if (!approved && !disapproving)}
    function create_if_block_4(ctx) {
    	let if_block_anchor;

    	function select_block_type_3(ctx, dirty) {
    		if (/*approving*/ ctx[4]) return create_if_block_5;
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
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (128:20) {:else}
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
    				dispose = listen(input, "click", /*approve*/ ctx[9]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (126:20) {#if approving}
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
    			if (detaching) detach(input);
    		}
    	};
    }

    // (134:37) 
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
    				dispose = listen(input, "click", /*disapprove*/ ctx[10]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (132:16) {#if disapproving}
    function create_if_block_2(ctx) {
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
    			if (detaching) detach(input);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let div;
    	let t;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*summary*/ ctx[0].summary) return create_if_block_6;
    		if (/*summary*/ ctx[0].summarising) return create_if_block_9;
    		return create_else_block_3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = (/*hovering*/ ctx[1] || /*just_summarised*/ ctx[6]) && create_if_block$1(ctx);

    	return {
    		c() {
    			div = element("div");
    			if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			attr(div, "class", "summaryengine-summarise svelte-vmhuq8");
    			toggle_class(div, "is_hovering", /*hovering*/ ctx[1]);
    			toggle_class(div, "just_summarised", /*just_summarised*/ ctx[6]);
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
    					listen(div, "mouseenter", /*mouseenter_handler*/ ctx[17]),
    					listen(div, "mouseleave", /*mouseleave_handler*/ ctx[18])
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

    			if (/*hovering*/ ctx[1] || /*just_summarised*/ ctx[6]) {
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

    			if (dirty & /*hovering*/ 2) {
    				toggle_class(div, "is_hovering", /*hovering*/ ctx[1]);
    			}

    			if (dirty & /*just_summarised*/ 64) {
    				toggle_class(div, "just_summarised", /*just_summarised*/ ctx[6]);
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
    			if (detaching) detach(div);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { summary } = $$props;
    	let { type_id } = $$props;
    	let { post_id } = $$props;
    	let hovering = false;
    	let editing = false;
    	let disapproving = false;
    	let approving = false;
    	let approved;
    	let just_summarised = false;
    	let saving = false;

    	String.prototype.nl2br = function () {
    		return this.replace(/([^>])\n/g, '$1<br/>');
    	};

    	onMount(async () => {
    		try {
    			$$invalidate(0, summary.summarising = false, summary);

    			if (Number(summary.summary_details.rating) === 1) {
    				$$invalidate(5, approved = true);
    			} // } else if (Number(summary.summary_details.rating) === 0) {
    			//     unapproved = true;
    		} catch(e) {
    			console.error(e); // } else if (Number(summary.summary_details.rating) === -1) {
    		}
    	});

    	async function summarise() {
    		try {
    			$$invalidate(0, summary.summarising = true, summary);
    			const result = await apiPost(`/summaryengine/v1/summarise`, { type_id, post_id });
    			if (!result?.summary) throw "No summary returned";
    			$$invalidate(0, summary.summary = result.summary, summary);
    			$$invalidate(0, summary.summary_id = result.ID, summary);
    			$$invalidate(0, summary.summary_details = result, summary);
    			$$invalidate(0, summary.summary_details.rating = 0, summary);
    			$$invalidate(0, summary.summarising = false, summary);
    			$$invalidate(5, approved = false);
    			$$invalidate(6, just_summarised = true);
    		} catch(err) {
    			console.error(err);
    			alert("An error occured: " + err);
    			$$invalidate(0, summary.summarising = false, summary);
    		}
    	}

    	async function approve() {
    		try {
    			$$invalidate(4, approving = true);
    			await apiPost(`/summaryengine/v1/rate/${summary.summary_id}`, { rating: 1 });
    			$$invalidate(0, summary.summary_details.rating = 1, summary);
    			$$invalidate(4, approving = false);
    			$$invalidate(5, approved = true);
    			$$invalidate(6, just_summarised = false);
    		} catch(err) {
    			console.error(err);
    			alert("An error occured: " + err);
    			$$invalidate(4, approving = false);
    		}
    	}

    	async function disapprove() {
    		try {
    			$$invalidate(3, disapproving = true);
    			await apiPost(`/summaryengine/v1/rate/${summary.summary_id}`, { rating: -1 });
    			await summarise();
    			$$invalidate(3, disapproving = false);
    			$$invalidate(0, summary.summary_details.rating = 0, summary);
    			$$invalidate(6, just_summarised = false);
    			$$invalidate(5, approved = false);
    		} catch(err) {
    			console.error(err);
    			$$invalidate(3, disapproving = false);
    		}
    	}

    	async function save() {
    		try {
    			$$invalidate(7, saving = true);
    			await apiPut(`/summaryengine/v1/summary/${summary.summary_id}`, { summary: summary.summary });
    			$$invalidate(2, editing = false);
    			$$invalidate(7, saving = false);
    		} catch(err) {
    			console.error(err);
    			alert("An error occured: " + err);
    			$$invalidate(2, editing = false);
    			$$invalidate(7, saving = false);
    		}
    	}

    	function textarea_input_handler() {
    		summary.summary = this.value;
    		$$invalidate(0, summary);
    	}

    	const click_handler = () => $$invalidate(2, editing = false);
    	const click_handler_1 = () => $$invalidate(2, editing = true);
    	const mouseenter_handler = () => $$invalidate(1, hovering = true);
    	const mouseleave_handler = () => $$invalidate(1, hovering = false);

    	$$self.$$set = $$props => {
    		if ('summary' in $$props) $$invalidate(0, summary = $$props.summary);
    		if ('type_id' in $$props) $$invalidate(12, type_id = $$props.type_id);
    		if ('post_id' in $$props) $$invalidate(13, post_id = $$props.post_id);
    	};

    	return [
    		summary,
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
    		post_id,
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
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { summary: 0, type_id: 12, post_id: 13 });
    	}
    }

    /* src/review/components/Dates.svelte generated by Svelte v3.52.0 */

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
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*months*/ 1 && t_value !== (t_value = /*month*/ ctx[5].label + "")) set_data(t, t_value);

    			if (dirty & /*months*/ 1 && option_value_value !== (option_value_value = /*month*/ ctx[5].year + /*month*/ ctx[5].month + "")) {
    				option.__value = option_value_value;
    				option.value = option.__value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let div;
    	let label;
    	let t1;
    	let select;
    	let option;
    	let t3;
    	let input;
    	let mounted;
    	let dispose;
    	let each_value = /*months*/ ctx[0];
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
    			option.value = option.__value;
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
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*$selected_date*/ ctx[1]);
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
    				each_value = /*months*/ ctx[0];
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
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
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
    			const result = await apiGet(`/summaryengine/v1/post_months`);
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/review/components/Pages.svelte generated by Svelte v3.52.0 */

    function create_fragment$2(ctx) {
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
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { per_page: 8 });
    	}
    }

    /* src/review/components/Search.svelte generated by Svelte v3.52.0 */

    function create_fragment$1(ctx) {
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
    			if (dirty & /*$search*/ 1) {
    				set_input_value(input0, /*$search*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src/review/Review.svelte generated by Svelte v3.52.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    // (107:16) {#each $types as type}
    function create_each_block_2(ctx) {
    	let th;
    	let t_value = /*type*/ ctx[15].name + "";
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
    			if (dirty & /*$types*/ 4 && t_value !== (t_value = /*type*/ ctx[15].name + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(th);
    		}
    	};
    }

    // (119:20) {#each $types as type}
    function create_each_block_1(ctx) {
    	let td;
    	let summarise;
    	let current;

    	summarise = new Summarise({
    			props: {
    				type_id: /*type*/ ctx[15].ID,
    				post_id: /*post*/ ctx[12].id,
    				summary: /*post*/ ctx[12].summaries[/*type*/ ctx[15].slug]
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
    			if (dirty & /*$types*/ 4) summarise_changes.type_id = /*type*/ ctx[15].ID;
    			if (dirty & /*$posts*/ 2) summarise_changes.post_id = /*post*/ ctx[12].id;
    			if (dirty & /*$posts, $types*/ 6) summarise_changes.summary = /*post*/ ctx[12].summaries[/*type*/ ctx[15].slug];
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
    			if (detaching) detach(td);
    			destroy_component(summarise);
    		}
    	};
    }

    // (125:24) {#if !checkSummariesSet(post)}
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
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (128:28) {:else}
    function create_else_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[7](/*post*/ ctx[12]);
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
    				dispose = listen(button, "click", click_handler);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (126:28) {#if (summarising_all)}
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
    			if (detaching) detach(button);
    		}
    	};
    }

    // (114:12) {#each $posts as post}
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let a;
    	let t0_value = (/*post*/ ctx[12].post_title || "Untitled") + "";
    	let t0;
    	let a_href_value;
    	let t1;
    	let td1;
    	let t2_value = /*post*/ ctx[12].post_date + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = /*post*/ ctx[12].post_author + "";
    	let t4;
    	let t5;
    	let t6;
    	let td3;
    	let show_if = !checkSummariesSet(/*post*/ ctx[12]);
    	let t7;
    	let current;
    	let each_value_1 = /*$types*/ ctx[2];
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
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			td2 = element("td");
    			t4 = text(t4_value);
    			t5 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			td3 = element("td");
    			if (if_block) if_block.c();
    			t7 = space();
    			attr(a, "href", a_href_value = "/wp-admin/post.php?post=" + /*post*/ ctx[12].id + "&action=edit");
    		},
    		m(target, anchor) {
    			insert(target, tr, anchor);
    			append(tr, td0);
    			append(td0, a);
    			append(a, t0);
    			append(tr, t1);
    			append(tr, td1);
    			append(td1, t2);
    			append(tr, t3);
    			append(tr, td2);
    			append(td2, t4);
    			append(tr, t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tr, null);
    			}

    			append(tr, t6);
    			append(tr, td3);
    			if (if_block) if_block.m(td3, null);
    			append(tr, t7);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if ((!current || dirty & /*$posts*/ 2) && t0_value !== (t0_value = (/*post*/ ctx[12].post_title || "Untitled") + "")) set_data(t0, t0_value);

    			if (!current || dirty & /*$posts*/ 2 && a_href_value !== (a_href_value = "/wp-admin/post.php?post=" + /*post*/ ctx[12].id + "&action=edit")) {
    				attr(a, "href", a_href_value);
    			}

    			if ((!current || dirty & /*$posts*/ 2) && t2_value !== (t2_value = /*post*/ ctx[12].post_date + "")) set_data(t2, t2_value);
    			if ((!current || dirty & /*$posts*/ 2) && t4_value !== (t4_value = /*post*/ ctx[12].post_author + "")) set_data(t4, t4_value);

    			if (dirty & /*$types, $posts*/ 6) {
    				each_value_1 = /*$types*/ ctx[2];
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
    						each_blocks[i].m(tr, t6);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*$posts*/ 2) show_if = !checkSummariesSet(/*post*/ ctx[12]);

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
    			if (detaching) detach(tr);
    			destroy_each(each_blocks, detaching);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div5;
    	let div4;
    	let div0;
    	let dates;
    	let t0;
    	let div3;
    	let div1;
    	let search_1;
    	let t1;
    	let div2;
    	let pages;
    	let t2;
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t4;
    	let th1;
    	let t6;
    	let th2;
    	let t8;
    	let t9;
    	let th3;
    	let t10;
    	let tbody;
    	let current;
    	dates = new Dates({});
    	dates.$on("click", /*reset*/ ctx[6]);
    	search_1 = new Search({});
    	search_1.$on("search", /*reset*/ ctx[6]);
    	pages = new Pages({ props: { per_page } });
    	pages.$on("click", /*getPosts*/ ctx[4]);
    	pages.$on("change", /*getPosts*/ ctx[4]);
    	let each_value_2 = /*$types*/ ctx[2];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	let each_value = /*$posts*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	return {
    		c() {
    			div5 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			create_component(dates.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			div1 = element("div");
    			create_component(search_1.$$.fragment);
    			t1 = space();
    			div2 = element("div");
    			create_component(pages.$$.fragment);
    			t2 = space();
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Title";
    			t4 = space();
    			th1 = element("th");
    			th1.textContent = "Date";
    			t6 = space();
    			th2 = element("th");
    			th2.textContent = "Author";
    			t8 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t9 = space();
    			th3 = element("th");
    			t10 = space();
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
    			toggle_class(table, "loading", /*$loading*/ ctx[3]);
    			attr(div5, "id", "summaryEngineMetaBlock");
    		},
    		m(target, anchor) {
    			insert(target, div5, anchor);
    			append(div5, div4);
    			append(div4, div0);
    			mount_component(dates, div0, null);
    			append(div4, t0);
    			append(div4, div3);
    			append(div3, div1);
    			mount_component(search_1, div1, null);
    			append(div3, t1);
    			append(div3, div2);
    			mount_component(pages, div2, null);
    			append(div5, t2);
    			append(div5, table);
    			append(table, thead);
    			append(thead, tr);
    			append(tr, th0);
    			append(tr, t4);
    			append(tr, th1);
    			append(tr, t6);
    			append(tr, th2);
    			append(tr, t8);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(tr, null);
    			}

    			append(tr, t9);
    			append(tr, th3);
    			append(table, t10);
    			append(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$types*/ 4) {
    				each_value_2 = /*$types*/ ctx[2];
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(tr, t9);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_2.length;
    			}

    			if (dirty & /*summarising_all, generateAllSummaries, $posts, checkSummariesSet, $types*/ 39) {
    				each_value = /*$posts*/ ctx[1];
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

    			if (!current || dirty & /*$loading*/ 8) {
    				toggle_class(table, "loading", /*$loading*/ ctx[3]);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(dates.$$.fragment, local);
    			transition_in(search_1.$$.fragment, local);
    			transition_in(pages.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
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
    			if (detaching) detach(div5);
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
    	component_subscribe($$self, page, $$value => $$invalidate(8, $page = $$value));
    	component_subscribe($$self, posts, $$value => $$invalidate(1, $posts = $$value));
    	component_subscribe($$self, types, $$value => $$invalidate(2, $types = $$value));
    	component_subscribe($$self, loading, $$value => $$invalidate(3, $loading = $$value));
    	component_subscribe($$self, search, $$value => $$invalidate(9, $search = $$value));
    	component_subscribe($$self, selected_date, $$value => $$invalidate(10, $selected_date = $$value));
    	let summarising_all = false;

    	async function getPosts() {
    		try {
    			set_store_value(loading, $loading = true, $loading);
    			const result = await apiGet(`/summaryengine/v1/posts?date=${$selected_date}&size=${per_page}&page=${$page}&search=${$search}`);
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
    		set_store_value(types, $types = await apiGet(`/summaryengine/v1/types`), $types);
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
    				const result = await apiPost(`/summaryengine/v1/summarise`, { type_id: type.ID, post_id: post.id });
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

    	const click_handler = post => generateAllSummaries(post);

    	return [
    		summarising_all,
    		$posts,
    		$types,
    		$loading,
    		getPosts,
    		generateAllSummaries,
    		reset,
    		click_handler
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
