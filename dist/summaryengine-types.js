var summaryengine_types = (function (exports) {
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
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
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

    function apiDelete(path) {
        return new Promise((resolve, reject) => {
            wp.apiRequest({
                path,
                type: "DELETE",
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

    /* src/components/Types.svelte generated by Svelte v3.52.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[26] = list[i];
    	child_ctx[27] = list;
    	child_ctx[28] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[26] = list[i];
    	child_ctx[28] = i;
    	return child_ctx;
    }

    // (99:0) {#if has_error}
    function create_if_block_5(ctx) {
    	let div;
    	let p;
    	let t;

    	return {
    		c() {
    			div = element("div");
    			p = element("p");
    			t = text(/*error_message*/ ctx[6]);
    			attr(div, "class", "notice notice-error is-dismissible");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, p);
    			append(p, t);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*error_message*/ 64) set_data(t, /*error_message*/ ctx[6]);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (106:4) {#each $types as type, i}
    function create_each_block_1(ctx) {
    	let a;
    	let t_value = /*type*/ ctx[26].name + "";
    	let t;
    	let a_href_value;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[9](/*i*/ ctx[28]);
    	}

    	return {
    		c() {
    			a = element("a");
    			t = text(t_value);
    			attr(a, "href", a_href_value = "#type-" + /*type*/ ctx[26].ID);
    			attr(a, "class", "nav-tab");
    			toggle_class(a, "nav-tab-active", /*tab*/ ctx[1] === /*i*/ ctx[28]);
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
    			if (dirty & /*$types*/ 1 && t_value !== (t_value = /*type*/ ctx[26].name + "")) set_data(t, t_value);

    			if (dirty & /*$types*/ 1 && a_href_value !== (a_href_value = "#type-" + /*type*/ ctx[26].ID)) {
    				attr(a, "href", a_href_value);
    			}

    			if (dirty & /*tab*/ 2) {
    				toggle_class(a, "nav-tab-active", /*tab*/ ctx[1] === /*i*/ ctx[28]);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(a);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (112:4) {#if tab === i}
    function create_if_block(ctx) {
    	let div;
    	let h2;
    	let t0_value = /*type*/ ctx[26].name + "";
    	let t0;
    	let t1;
    	let t2;
    	let table;
    	let tbody;
    	let tr0;
    	let th0;
    	let t4;
    	let td0;
    	let input0;
    	let t5;
    	let tr1;
    	let th1;
    	let t7;
    	let td1;
    	let input1;
    	let t8;
    	let tr2;
    	let th2;
    	let t10;
    	let td2;
    	let input2;
    	let t11;
    	let p0;
    	let t13;
    	let tr3;
    	let th3;
    	let t15;
    	let td3;
    	let input3;
    	let t16;
    	let p1;
    	let t18;
    	let tr4;
    	let th4;
    	let t20;
    	let td4;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let option4;
    	let t26;
    	let tr5;
    	let th5;
    	let t28;
    	let td5;
    	let input4;
    	let t29;
    	let tr6;
    	let th6;
    	let t31;
    	let td6;
    	let input5;
    	let t32;
    	let t33_value = /*type*/ ctx[26].cut_at_paragraph + "";
    	let t33;
    	let t34;
    	let tr7;
    	let th7;
    	let t36;
    	let td7;
    	let input6;
    	let t37;
    	let p2;
    	let t39;
    	let tr8;
    	let th8;
    	let t41;
    	let td8;
    	let input7;
    	let t42;
    	let p3;
    	let t44;
    	let tr9;
    	let th9;
    	let t46;
    	let td9;
    	let input8;
    	let t47;
    	let p4;
    	let t49;
    	let tr10;
    	let th10;
    	let t51;
    	let td10;
    	let input9;
    	let t52;
    	let p5;
    	let t54;
    	let tr11;
    	let th11;
    	let t56;
    	let td11;
    	let input10;
    	let t57;
    	let p6;
    	let t59;
    	let t60;
    	let show_if = Number(/*type*/ ctx[26].ID) !== 1 && !/*deleting*/ ctx[4];
    	let t61;
    	let t62;
    	let if_block3_anchor;
    	let mounted;
    	let dispose;

    	function input0_input_handler() {
    		/*input0_input_handler*/ ctx[10].call(input0, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input1_input_handler() {
    		/*input1_input_handler*/ ctx[11].call(input1, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input2_input_handler() {
    		/*input2_input_handler*/ ctx[12].call(input2, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input3_input_handler() {
    		/*input3_input_handler*/ ctx[13].call(input3, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function select_change_handler() {
    		/*select_change_handler*/ ctx[14].call(select, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input4_input_handler() {
    		/*input4_input_handler*/ ctx[15].call(input4, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input5_change_handler() {
    		/*input5_change_handler*/ ctx[16].call(input5, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input6_input_handler() {
    		/*input6_input_handler*/ ctx[17].call(input6, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input7_input_handler() {
    		/*input7_input_handler*/ ctx[18].call(input7, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input8_input_handler() {
    		/*input8_input_handler*/ ctx[19].call(input8, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input9_input_handler() {
    		/*input9_input_handler*/ ctx[20].call(input9, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function input10_input_handler() {
    		/*input10_input_handler*/ ctx[21].call(input10, /*each_value*/ ctx[27], /*i*/ ctx[28]);
    	}

    	function select_block_type(ctx, dirty) {
    		if (!/*saving*/ ctx[2]) return create_if_block_4;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = show_if && create_if_block_3(ctx);
    	let if_block2 = /*deleting*/ ctx[4] && create_if_block_2();
    	let if_block3 = /*pending_delete*/ ctx[3] && create_if_block_1(ctx);

    	return {
    		c() {
    			div = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = text(" Settings");
    			t2 = space();
    			table = element("table");
    			tbody = element("tbody");
    			tr0 = element("tr");
    			th0 = element("th");
    			th0.innerHTML = `<label for="name">Name</label>`;
    			t4 = space();
    			td0 = element("td");
    			input0 = element("input");
    			t5 = space();
    			tr1 = element("tr");
    			th1 = element("th");
    			th1.innerHTML = `<label for="slug">Slug</label>`;
    			t7 = space();
    			td1 = element("td");
    			input1 = element("input");
    			t8 = space();
    			tr2 = element("tr");
    			th2 = element("th");
    			th2.textContent = "Prepend Prompt";
    			t10 = space();
    			td2 = element("td");
    			input2 = element("input");
    			t11 = space();
    			p0 = element("p");
    			p0.textContent = "The instruction to the model on what you'd like to generate, prepended.";
    			t13 = space();
    			tr3 = element("tr");
    			th3 = element("th");
    			th3.textContent = "Append Prompt";
    			t15 = space();
    			td3 = element("td");
    			input3 = element("input");
    			t16 = space();
    			p1 = element("p");
    			p1.textContent = "The instruction to the model on what you'd like to generate, appended.";
    			t18 = space();
    			tr4 = element("tr");
    			th4 = element("th");
    			th4.textContent = "OpenAPI Model";
    			t20 = space();
    			td4 = element("td");
    			select = element("select");
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
    			t26 = space();
    			tr5 = element("tr");
    			th5 = element("th");
    			th5.textContent = "OpenAI submission word limit";
    			t28 = space();
    			td5 = element("td");
    			input4 = element("input");
    			t29 = space();
    			tr6 = element("tr");
    			th6 = element("th");
    			th6.textContent = "Cut at paragraph nearest end";
    			t31 = space();
    			td6 = element("td");
    			input5 = element("input");
    			t32 = space();
    			t33 = text(t33_value);
    			t34 = space();
    			tr7 = element("tr");
    			th7 = element("th");
    			th7.textContent = "Max tokens";
    			t36 = space();
    			td7 = element("td");
    			input6 = element("input");
    			t37 = space();
    			p2 = element("p");
    			p2.textContent = "The maximum number of tokens to generate in the completion.";
    			t39 = space();
    			tr8 = element("tr");
    			th8 = element("th");
    			th8.textContent = "Temperature";
    			t41 = space();
    			td8 = element("td");
    			input7 = element("input");
    			t42 = space();
    			p3 = element("p");
    			p3.textContent = "What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both.";
    			t44 = space();
    			tr9 = element("tr");
    			th9 = element("th");
    			th9.textContent = "Top-P";
    			t46 = space();
    			td9 = element("td");
    			input8 = element("input");
    			t47 = space();
    			p4 = element("p");
    			p4.textContent = "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.";
    			t49 = space();
    			tr10 = element("tr");
    			th10 = element("th");
    			th10.textContent = "Presence penalty";
    			t51 = space();
    			td10 = element("td");
    			input9 = element("input");
    			t52 = space();
    			p5 = element("p");
    			p5.textContent = "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.";
    			t54 = space();
    			tr11 = element("tr");
    			th11 = element("th");
    			th11.textContent = "Frequency penalty";
    			t56 = space();
    			td11 = element("td");
    			input10 = element("input");
    			t57 = space();
    			p6 = element("p");
    			p6.textContent = "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.";
    			t59 = space();
    			if_block0.c();
    			t60 = space();
    			if (if_block1) if_block1.c();
    			t61 = space();
    			if (if_block2) if_block2.c();
    			t62 = space();
    			if (if_block3) if_block3.c();
    			if_block3_anchor = empty();
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
    			attr(input2, "type", "text");
    			attr(input2, "name", "openai_prompt");
    			attr(input2, "class", "regular-text");
    			input2.required = true;
    			attr(th3, "scope", "row");
    			attr(input3, "type", "text");
    			attr(input3, "name", "openai_append_prompt");
    			attr(input3, "class", "regular-text");
    			input3.required = true;
    			attr(th4, "scope", "row");
    			option0.__value = "text-davinci-003";
    			option0.value = option0.__value;
    			option1.__value = "text-davinci-002";
    			option1.value = option1.__value;
    			option2.__value = "text-curie-001";
    			option2.value = option2.__value;
    			option3.__value = "text-babbage-001";
    			option3.value = option3.__value;
    			option4.__value = "text-ada-001";
    			option4.value = option4.__value;
    			attr(select, "name", "openai_model");
    			if (/*type*/ ctx[26].openai_model === void 0) add_render_callback(select_change_handler);
    			attr(th5, "scope", "row");
    			attr(input4, "type", "number");
    			attr(input4, "name", "openai_word_limit");
    			attr(input4, "class", "regular-text");
    			attr(th6, "scope", "row");
    			attr(input5, "type", "checkbox");
    			attr(input5, "name", "cut_at_paragraph");
    			attr(th7, "scope", "row");
    			attr(input6, "type", "number");
    			attr(input6, "name", "openai_max_tokens");
    			attr(input6, "class", "regular-text");
    			attr(input6, "min", "0");
    			attr(input6, "max", "2048");
    			attr(input6, "step", "1");
    			attr(th8, "scope", "row");
    			attr(input7, "type", "number");
    			attr(input7, "name", "openai_temperature");
    			attr(input7, "class", "regular-text");
    			attr(input7, "min", "0");
    			attr(input7, "max", "1");
    			attr(input7, "step", "0.1");
    			attr(th9, "scope", "row");
    			attr(input8, "type", "number");
    			attr(input8, "name", "openai_top_p");
    			attr(input8, "class", "regular-text");
    			attr(input8, "min", "0");
    			attr(input8, "max", "1");
    			attr(input8, "step", "0.1");
    			attr(th10, "scope", "row");
    			attr(input9, "type", "number");
    			attr(input9, "name", "openai_presence_penalty");
    			attr(input9, "class", "regular-text");
    			attr(input9, "min", "-2");
    			attr(input9, "max", "2");
    			attr(input9, "step", "0.1");
    			attr(th11, "scope", "row");
    			attr(input10, "type", "number");
    			attr(input10, "name", "openai_frequency_penalty");
    			attr(input10, "class", "regular-text");
    			attr(input10, "min", "-2");
    			attr(input10, "max", "2");
    			attr(input10, "step", "0.1");
    			attr(table, "class", "form-table");
    			attr(div, "class", "tab-content");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, h2);
    			append(h2, t0);
    			append(h2, t1);
    			append(div, t2);
    			append(div, table);
    			append(table, tbody);
    			append(tbody, tr0);
    			append(tr0, th0);
    			append(tr0, t4);
    			append(tr0, td0);
    			append(td0, input0);
    			set_input_value(input0, /*type*/ ctx[26].name);
    			append(tbody, t5);
    			append(tbody, tr1);
    			append(tr1, th1);
    			append(tr1, t7);
    			append(tr1, td1);
    			append(td1, input1);
    			set_input_value(input1, /*type*/ ctx[26].slug);
    			append(tbody, t8);
    			append(tbody, tr2);
    			append(tr2, th2);
    			append(tr2, t10);
    			append(tr2, td2);
    			append(td2, input2);
    			set_input_value(input2, /*type*/ ctx[26].openai_prompt);
    			append(td2, t11);
    			append(td2, p0);
    			append(tbody, t13);
    			append(tbody, tr3);
    			append(tr3, th3);
    			append(tr3, t15);
    			append(tr3, td3);
    			append(td3, input3);
    			set_input_value(input3, /*type*/ ctx[26].openai_append_prompt);
    			append(td3, t16);
    			append(td3, p1);
    			append(tbody, t18);
    			append(tbody, tr4);
    			append(tr4, th4);
    			append(tr4, t20);
    			append(tr4, td4);
    			append(td4, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			append(select, option4);
    			select_option(select, /*type*/ ctx[26].openai_model);
    			append(tbody, t26);
    			append(tbody, tr5);
    			append(tr5, th5);
    			append(tr5, t28);
    			append(tr5, td5);
    			append(td5, input4);
    			set_input_value(input4, /*type*/ ctx[26].openai_word_limit);
    			append(tbody, t29);
    			append(tbody, tr6);
    			append(tr6, th6);
    			append(tr6, t31);
    			append(tr6, td6);
    			append(td6, input5);
    			input5.checked = /*type*/ ctx[26].cut_at_paragraph;
    			append(td6, t32);
    			append(td6, t33);
    			append(tbody, t34);
    			append(tbody, tr7);
    			append(tr7, th7);
    			append(tr7, t36);
    			append(tr7, td7);
    			append(td7, input6);
    			set_input_value(input6, /*type*/ ctx[26].openai_max_tokens);
    			append(td7, t37);
    			append(td7, p2);
    			append(tbody, t39);
    			append(tbody, tr8);
    			append(tr8, th8);
    			append(tr8, t41);
    			append(tr8, td8);
    			append(td8, input7);
    			set_input_value(input7, /*type*/ ctx[26].openai_temperature);
    			append(td8, t42);
    			append(td8, p3);
    			append(tbody, t44);
    			append(tbody, tr9);
    			append(tr9, th9);
    			append(tr9, t46);
    			append(tr9, td9);
    			append(td9, input8);
    			set_input_value(input8, /*type*/ ctx[26].openai_top_p);
    			append(td9, t47);
    			append(td9, p4);
    			append(tbody, t49);
    			append(tbody, tr10);
    			append(tr10, th10);
    			append(tr10, t51);
    			append(tr10, td10);
    			append(td10, input9);
    			set_input_value(input9, /*type*/ ctx[26].openai_presence_penalty);
    			append(td10, t52);
    			append(td10, p5);
    			append(tbody, t54);
    			append(tbody, tr11);
    			append(tr11, th11);
    			append(tr11, t56);
    			append(tr11, td11);
    			append(td11, input10);
    			set_input_value(input10, /*type*/ ctx[26].openai_frequency_penalty);
    			append(td11, t57);
    			append(td11, p6);
    			insert(target, t59, anchor);
    			if_block0.m(target, anchor);
    			insert(target, t60, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, t61, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert(target, t62, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert(target, if_block3_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", input0_input_handler),
    					listen(input1, "input", input1_input_handler),
    					listen(input2, "input", input2_input_handler),
    					listen(input3, "input", input3_input_handler),
    					listen(select, "change", select_change_handler),
    					listen(input4, "input", input4_input_handler),
    					listen(input5, "change", input5_change_handler),
    					listen(input6, "input", input6_input_handler),
    					listen(input7, "input", input7_input_handler),
    					listen(input8, "input", input8_input_handler),
    					listen(input9, "input", input9_input_handler),
    					listen(input10, "input", input10_input_handler)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*$types*/ 1 && t0_value !== (t0_value = /*type*/ ctx[26].name + "")) set_data(t0, t0_value);

    			if (dirty & /*$types*/ 1 && input0.value !== /*type*/ ctx[26].name) {
    				set_input_value(input0, /*type*/ ctx[26].name);
    			}

    			if (dirty & /*$types*/ 1 && input1.value !== /*type*/ ctx[26].slug) {
    				set_input_value(input1, /*type*/ ctx[26].slug);
    			}

    			if (dirty & /*$types*/ 1 && input2.value !== /*type*/ ctx[26].openai_prompt) {
    				set_input_value(input2, /*type*/ ctx[26].openai_prompt);
    			}

    			if (dirty & /*$types*/ 1 && input3.value !== /*type*/ ctx[26].openai_append_prompt) {
    				set_input_value(input3, /*type*/ ctx[26].openai_append_prompt);
    			}

    			if (dirty & /*$types*/ 1) {
    				select_option(select, /*type*/ ctx[26].openai_model);
    			}

    			if (dirty & /*$types*/ 1 && to_number(input4.value) !== /*type*/ ctx[26].openai_word_limit) {
    				set_input_value(input4, /*type*/ ctx[26].openai_word_limit);
    			}

    			if (dirty & /*$types*/ 1) {
    				input5.checked = /*type*/ ctx[26].cut_at_paragraph;
    			}

    			if (dirty & /*$types*/ 1 && t33_value !== (t33_value = /*type*/ ctx[26].cut_at_paragraph + "")) set_data(t33, t33_value);

    			if (dirty & /*$types*/ 1 && to_number(input6.value) !== /*type*/ ctx[26].openai_max_tokens) {
    				set_input_value(input6, /*type*/ ctx[26].openai_max_tokens);
    			}

    			if (dirty & /*$types*/ 1 && to_number(input7.value) !== /*type*/ ctx[26].openai_temperature) {
    				set_input_value(input7, /*type*/ ctx[26].openai_temperature);
    			}

    			if (dirty & /*$types*/ 1 && to_number(input8.value) !== /*type*/ ctx[26].openai_top_p) {
    				set_input_value(input8, /*type*/ ctx[26].openai_top_p);
    			}

    			if (dirty & /*$types*/ 1 && to_number(input9.value) !== /*type*/ ctx[26].openai_presence_penalty) {
    				set_input_value(input9, /*type*/ ctx[26].openai_presence_penalty);
    			}

    			if (dirty & /*$types*/ 1 && to_number(input10.value) !== /*type*/ ctx[26].openai_frequency_penalty) {
    				set_input_value(input10, /*type*/ ctx[26].openai_frequency_penalty);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(t60.parentNode, t60);
    				}
    			}

    			if (dirty & /*$types, deleting*/ 17) show_if = Number(/*type*/ ctx[26].ID) !== 1 && !/*deleting*/ ctx[4];

    			if (show_if) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(t61.parentNode, t61);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*deleting*/ ctx[4]) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block_2();
    					if_block2.c();
    					if_block2.m(t62.parentNode, t62);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*pending_delete*/ ctx[3]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(if_block3_anchor.parentNode, if_block3_anchor);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching) detach(t59);
    			if_block0.d(detaching);
    			if (detaching) detach(t60);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(t61);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach(t62);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach(if_block3_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (203:8) {:else}
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
    			if (detaching) detach(input);
    		}
    	};
    }

    // (201:8) {#if !saving}
    function create_if_block_4(ctx) {
    	let input;
    	let mounted;
    	let dispose;

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
    				dispose = listen(input, "click", function () {
    					if (is_function(/*saveType*/ ctx[7](/*type*/ ctx[26]))) /*saveType*/ ctx[7](/*type*/ ctx[26]).apply(this, arguments);
    				});

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d(detaching) {
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (206:8) {#if (Number(type.ID) !== 1) && (!deleting)}
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
    				dispose = listen(input, "click", /*click_handler_1*/ ctx[22]);
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

    // (209:8) {#if (deleting)}
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
    			if (detaching) detach(input);
    		}
    	};
    }

    // (212:8) {#if pending_delete}
    function create_if_block_1(ctx) {
    	let p;
    	let t1;
    	let input0;
    	let t2;
    	let input1;
    	let mounted;
    	let dispose;

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
    					listen(input0, "click", function () {
    						if (is_function(/*deleteType*/ ctx[8](/*type*/ ctx[26]))) /*deleteType*/ ctx[8](/*type*/ ctx[26]).apply(this, arguments);
    					}),
    					listen(input1, "click", /*click_handler_2*/ ctx[23])
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    			if (detaching) detach(t1);
    			if (detaching) detach(input0);
    			if (detaching) detach(t2);
    			if (detaching) detach(input1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (111:0) {#each $types as type, i}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let if_block = /*tab*/ ctx[1] === /*i*/ ctx[28] && create_if_block(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (/*tab*/ ctx[1] === /*i*/ ctx[28]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let t0;
    	let nav;
    	let t1;
    	let each1_anchor;
    	let if_block = /*has_error*/ ctx[5] && create_if_block_5(ctx);
    	let each_value_1 = /*$types*/ ctx[0];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*$types*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

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
    				each_blocks_1[i].m(nav, null);
    			}

    			insert(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each1_anchor, anchor);
    		},
    		p(ctx, [dirty]) {
    			if (/*has_error*/ ctx[5]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_5(ctx);
    					if_block.c();
    					if_block.m(t0.parentNode, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*$types, tab*/ 3) {
    				each_value_1 = /*$types*/ ctx[0];
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

    			if (dirty & /*pending_delete, deleteType, $types, deleting, Number, saveType, saving, tab*/ 415) {
    				each_value = /*$types*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each1_anchor.parentNode, each1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(t0);
    			if (detaching) detach(nav);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each1_anchor);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let $types;
    	component_subscribe($$self, types, $$value => $$invalidate(0, $types = $$value));
    	let tab = 0;
    	let saving = false;
    	let pending_delete = false;
    	let deleting = false;
    	let models = [];
    	let has_error = false;
    	let error_message = "";

    	const addEmptyType = () => {
    		$types.push({
    			ID: "",
    			name: 'New Type',
    			cut_at_paragraph: 1,
    			openai_frequency_penalty: 0.5,
    			openai_max_tokens: 300,
    			openai_presence_penalty: 0,
    			openai_temperature: 0.6,
    			openai_top_p: 1,
    			openai_word_limit: 750
    		});
    	};

    	onMount(async () => {
    		try {
    			models = await apiGet(`summaryengine/v1/models`);
    		} catch(e) {
    			$$invalidate(5, has_error = true);
    			$$invalidate(6, error_message = "Unable to connect to OpenAI API. Please check your API key and try again.");
    		}

    		try {
    			console.log(models);

    			set_store_value(
    				types,
    				$types = (await apiGet(`summaryengine/v1/types`)).map(type => {
    					type.ID = Number(type.ID);
    					type.cut_at_paragraph = Number(type.cut_at_paragraph);
    					type.openai_frequency_penalty = Number(type.openai_frequency_penalty);
    					type.openai_max_tokens = Number(type.openai_max_tokens);
    					type.openai_presence_penalty = Number(type.openai_presence_penalty);
    					type.openai_temperature = Number(type.openai_temperature);
    					type.openai_top_p = Number(type.openai_top_p);
    					type.openai_word_limit = Number(type.openai_word_limit);
    					return type;
    				}),
    				$types
    			);

    			addEmptyType();
    		} catch(e) {
    			console.error(e);
    		}
    	});

    	async function saveType(type) {
    		try {
    			$$invalidate(2, saving = true);
    			if (!type.name) throw "Type name is required";
    			if (!type.openai_prompt) throw "Prompt is required";
    			if (type.name === "New Type") throw "Please rename the type before saving";
    			const result = await apiPost(`summaryengine/v1/type/${type.ID}`, type);

    			if (!type.ID) {
    				type.ID = Number(result.id);
    				set_store_value(types, $types = $types.sort((a, b) => a.name < b.name ? -1 : 1), $types);
    				addEmptyType();
    				types.set($types);
    			}

    			window.scrollTo(0, 0);
    			$$invalidate(2, saving = false);
    		} catch(e) {
    			alert(e);
    			$$invalidate(2, saving = false);
    		}
    	}

    	async function deleteType(type) {
    		try {
    			$$invalidate(3, pending_delete = false);
    			$$invalidate(4, deleting = true);

    			// if (confirm("Are you sure you want to delete this type?")) {
    			await apiDelete(`summaryengine/v1/type/${type.ID}`);

    			set_store_value(types, $types = $types.filter(t => t.ID !== type.ID), $types);
    			$$invalidate(1, tab = 0);

    			// alert("Type deleted");
    			// }
    			$$invalidate(4, deleting = false);

    			window.scrollTo(0, 0);
    		} catch(e) {
    			alert(e);
    			$$invalidate(4, deleting = false);
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

    	function input2_input_handler(each_value, i) {
    		each_value[i].openai_prompt = this.value;
    		types.set($types);
    	}

    	function input3_input_handler(each_value, i) {
    		each_value[i].openai_append_prompt = this.value;
    		types.set($types);
    	}

    	function select_change_handler(each_value, i) {
    		each_value[i].openai_model = select_value(this);
    		types.set($types);
    	}

    	function input4_input_handler(each_value, i) {
    		each_value[i].openai_word_limit = to_number(this.value);
    		types.set($types);
    	}

    	function input5_change_handler(each_value, i) {
    		each_value[i].cut_at_paragraph = this.checked;
    		types.set($types);
    	}

    	function input6_input_handler(each_value, i) {
    		each_value[i].openai_max_tokens = to_number(this.value);
    		types.set($types);
    	}

    	function input7_input_handler(each_value, i) {
    		each_value[i].openai_temperature = to_number(this.value);
    		types.set($types);
    	}

    	function input8_input_handler(each_value, i) {
    		each_value[i].openai_top_p = to_number(this.value);
    		types.set($types);
    	}

    	function input9_input_handler(each_value, i) {
    		each_value[i].openai_presence_penalty = to_number(this.value);
    		types.set($types);
    	}

    	function input10_input_handler(each_value, i) {
    		each_value[i].openai_frequency_penalty = to_number(this.value);
    		types.set($types);
    	}

    	const click_handler_1 = () => $$invalidate(3, pending_delete = true);
    	const click_handler_2 = () => $$invalidate(3, pending_delete = false);

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
    		pending_delete,
    		deleting,
    		has_error,
    		error_message,
    		saveType,
    		deleteType,
    		click_handler,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		select_change_handler,
    		input4_input_handler,
    		input5_change_handler,
    		input6_input_handler,
    		input7_input_handler,
    		input8_input_handler,
    		input9_input_handler,
    		input10_input_handler,
    		click_handler_1,
    		click_handler_2
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

    exports.settings = settings;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=summaryengine-types.js.map
