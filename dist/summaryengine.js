var summaryengine = (function (exports) {
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

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
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

    /* src/components/SubmissionsLeft.svelte generated by Svelte v3.52.0 */

    function create_fragment$6(ctx) {
    	let div;
    	let span0;
    	let t0;
    	let t1;
    	let span1;

    	return {
    		c() {
    			div = element("div");
    			span0 = element("span");
    			t0 = text(/*submissions_left*/ ctx[0]);
    			t1 = space();
    			span1 = element("span");
    			span1.textContent = "submissions left";
    			attr(span0, "id", "summaryEngineSubmissionsLeft");
    			attr(span0, "class", "svelte-44y65o");
    			toggle_class(span0, "zero", /*submissions_left*/ ctx[0] === 0);
    			attr(span1, "id", "summaryEngineSubmissionsLeftLabel");
    			attr(div, "id", "summaryEngineCounter");
    			attr(div, "class", "svelte-44y65o");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, span0);
    			append(span0, t0);
    			append(div, t1);
    			append(div, span1);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*submissions_left*/ 1) set_data(t0, /*submissions_left*/ ctx[0]);

    			if (dirty & /*submissions_left*/ 1) {
    				toggle_class(span0, "zero", /*submissions_left*/ ctx[0] === 0);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { summaries = [] } = $$props;
    	let { submissions_left = 0 } = $$props;
    	const max_summaries = Number(summaryengine_max_number_of_submissions_per_post);

    	$$self.$$set = $$props => {
    		if ('summaries' in $$props) $$invalidate(1, summaries = $$props.summaries);
    		if ('submissions_left' in $$props) $$invalidate(0, submissions_left = $$props.submissions_left);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*summaries*/ 2) {
    			{
    				$$invalidate(0, submissions_left = max_summaries - summaries.length > 0
    				? max_summaries - summaries.length
    				: 0);
    			} // console.log($submissions_left);
    		}
    	};

    	return [submissions_left, summaries];
    }

    class SubmissionsLeft extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$6, safe_not_equal, { summaries: 1, submissions_left: 0 });
    	}
    }

    /* src/components/Navigation.svelte generated by Svelte v3.52.0 */

    function create_if_block$3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "Use this summary";
    			attr(button, "id", "summaryEngineNavigatorUse");
    			attr(button, "type", "button");
    			attr(button, "class", "button button-secondary svelte-nmpeoh");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*saveCurrentSummary*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$5(ctx) {
    	let div;
    	let button0;
    	let t0;
    	let button0_disabled_value;
    	let t1;
    	let button1;
    	let t2;
    	let button1_disabled_value;
    	let t3;
    	let mounted;
    	let dispose;
    	let if_block = /*summary_index*/ ctx[0] != /*current_summary_index*/ ctx[2] && create_if_block$3(ctx);

    	return {
    		c() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text("Previous");
    			t1 = space();
    			button1 = element("button");
    			t2 = text("Next");
    			t3 = space();
    			if (if_block) if_block.c();
    			attr(button0, "id", "summaryEngineNavigatorPrev");
    			attr(button0, "type", "button");
    			attr(button0, "class", "button button-secondary svelte-nmpeoh");
    			button0.disabled = button0_disabled_value = /*summary_index*/ ctx[0] === 0;
    			attr(button1, "id", "summaryEngineNavigatorNext");
    			attr(button1, "type", "button");
    			attr(button1, "class", "button button-secondary svelte-nmpeoh");
    			button1.disabled = button1_disabled_value = /*summary_index*/ ctx[0] === /*summaries*/ ctx[1].length - 1;
    			attr(div, "id", "summaryEngineNavigator");
    			attr(div, "class", "svelte-nmpeoh");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, button0);
    			append(button0, t0);
    			append(div, t1);
    			append(div, button1);
    			append(button1, t2);
    			append(div, t3);
    			if (if_block) if_block.m(div, null);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*prev*/ ctx[3]),
    					listen(button1, "click", /*next*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*summary_index*/ 1 && button0_disabled_value !== (button0_disabled_value = /*summary_index*/ ctx[0] === 0)) {
    				button0.disabled = button0_disabled_value;
    			}

    			if (dirty & /*summary_index, summaries*/ 3 && button1_disabled_value !== (button1_disabled_value = /*summary_index*/ ctx[0] === /*summaries*/ ctx[1].length - 1)) {
    				button1.disabled = button1_disabled_value;
    			}

    			if (/*summary_index*/ ctx[0] != /*current_summary_index*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { summaries = [] } = $$props;
    	let { summary_index = 0 } = $$props;
    	let { summary_text = "" } = $$props;
    	let { custom_settings = {} } = $$props;
    	let { type = {} } = $$props;
    	let current_summary_index = 0;

    	const prev = () => {
    		if (summary_index > 0) {
    			$$invalidate(0, summary_index = summary_index - 1);
    		}

    		$$invalidate(6, summary_text = summaries[summary_index].summary);
    		set_settings();
    	};

    	const next = () => {
    		if (summary_index < summaries.length - 1) {
    			$$invalidate(0, summary_index = summary_index + 1);
    		}

    		$$invalidate(6, summary_text = summaries[summary_index].summary);
    		set_settings();
    	};

    	const set_settings = () => {
    		$$invalidate(7, custom_settings.openai_model = summaries[summary_index].openai_model, custom_settings);
    		$$invalidate(7, custom_settings.openai_max_tokens = summaries[summary_index].max_tokens, custom_settings);
    		$$invalidate(7, custom_settings.openai_temperature = summaries[summary_index].temperature, custom_settings);
    		$$invalidate(7, custom_settings.openai_frequency_penalty = summaries[summary_index].frequency_penalty, custom_settings);
    		$$invalidate(7, custom_settings.openai_presentation_penalty = summaries[summary_index].presence_penalty, custom_settings);
    		$$invalidate(7, custom_settings.openai_prompt = summaries[summary_index].prompt, custom_settings);
    		$$invalidate(7, custom_settings.openai_top_p = summaries[summary_index].top_p, custom_settings);
    	};

    	const saveCurrentSummary = async () => {
    		try {
    			await apiPost("summaryengine/v1/summary/" + jQuery("#post_ID").val(), {
    				summary: summary_text,
    				summary_index,
    				summary_id: summaries[summary_index].ID,
    				type_id: type.ID
    			});

    			$$invalidate(2, current_summary_index = summary_index);
    		} catch(err) {
    			console.error(err);
    			alert(err);
    		}
    	};

    	$$self.$$set = $$props => {
    		if ('summaries' in $$props) $$invalidate(1, summaries = $$props.summaries);
    		if ('summary_index' in $$props) $$invalidate(0, summary_index = $$props.summary_index);
    		if ('summary_text' in $$props) $$invalidate(6, summary_text = $$props.summary_text);
    		if ('custom_settings' in $$props) $$invalidate(7, custom_settings = $$props.custom_settings);
    		if ('type' in $$props) $$invalidate(8, type = $$props.type);
    	};

    	set_settings();

    	return [
    		summary_index,
    		summaries,
    		current_summary_index,
    		prev,
    		next,
    		saveCurrentSummary,
    		summary_text,
    		custom_settings,
    		type,
    		set_settings
    	];
    }

    class Navigation extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$4, create_fragment$5, safe_not_equal, {
    			summaries: 1,
    			summary_index: 0,
    			summary_text: 6,
    			custom_settings: 7,
    			type: 8,
    			set_settings: 9
    		});
    	}

    	get set_settings() {
    		return this.$$.ctx[9];
    	}
    }

    /* src/components/Rate.svelte generated by Svelte v3.52.0 */

    function create_else_block$1(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "How do you rate this summary?";
    			attr(div, "id", "summaryEngineRateThanks");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    // (34:4) {#if rated}
    function create_if_block$2(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.textContent = "Thanks for your feedback!";
    			attr(div, "id", "summaryEngineRateThanks");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let span0;
    	let t1;
    	let span1;
    	let t3;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*rated*/ ctx[0]) return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			span0 = element("span");
    			span0.textContent = "👍";
    			t1 = space();
    			span1 = element("span");
    			span1.textContent = "👎";
    			t3 = space();
    			if_block.c();
    			attr(span0, "id", "summaryEngineRateGood");
    			attr(span0, "class", "summaryengine-rate-icon svelte-90ou5e");
    			toggle_class(span0, "summaryengine-rate-icon-selected", /*rating*/ ctx[1] === 1);
    			attr(span1, "id", "summaryEngineRateBad");
    			attr(span1, "class", "summaryengine-rate-icon svelte-90ou5e");
    			toggle_class(span1, "summaryengine-rate-icon-selected", /*rating*/ ctx[1] === -1);
    			attr(div0, "id", "summaryEngineRateIcons");
    			attr(div0, "class", "svelte-90ou5e");
    			attr(div1, "id", "summaryEngineRate");
    			attr(div1, "class", "svelte-90ou5e");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, span0);
    			append(div0, t1);
    			append(div0, span1);
    			append(div1, t3);
    			if_block.m(div1, null);

    			if (!mounted) {
    				dispose = [
    					listen(span0, "click", /*click_handler*/ ctx[7]),
    					listen(span1, "click", /*click_handler_1*/ ctx[8])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*rating*/ 2) {
    				toggle_class(span0, "summaryengine-rate-icon-selected", /*rating*/ ctx[1] === 1);
    			}

    			if (dirty & /*rating*/ 2) {
    				toggle_class(span1, "summaryengine-rate-icon-selected", /*rating*/ ctx[1] === -1);
    			}

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div1);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { summary_id = 0 } = $$props;
    	let { summary_index = 0 } = $$props;
    	let { summaries = [] } = $$props;
    	let { type = 0 } = $$props;
    	let rated = false;
    	let rating = 0;

    	const rate = async rating => {
    		// console.log("rate", rating);
    		try {
    			$$invalidate(3, summaries[summary_index].rating = rating, summaries);
    			await apiPost("summaryengine/v1/rate/" + summary_id, { rating, type_id: type.ID });
    		} catch(err) {
    			console.error(err);
    			alert(err);
    		}
    	};

    	const click_handler = () => rate(1);
    	const click_handler_1 = () => rate(-1);

    	$$self.$$set = $$props => {
    		if ('summary_id' in $$props) $$invalidate(4, summary_id = $$props.summary_id);
    		if ('summary_index' in $$props) $$invalidate(5, summary_index = $$props.summary_index);
    		if ('summaries' in $$props) $$invalidate(3, summaries = $$props.summaries);
    		if ('type' in $$props) $$invalidate(6, type = $$props.type);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*summaries, summary_index*/ 40) {
    			$$invalidate(0, rated = summaries[summary_index]?.rating && [-1, 1].includes(Number(summaries[summary_index].rating)));
    		}

    		if ($$self.$$.dirty & /*summaries, summary_index*/ 40) {
    			$$invalidate(1, rating = (summaries[summary_index]?.rating)
    			? Number(summaries[summary_index].rating)
    			: 0);
    		}
    	};

    	return [
    		rated,
    		rating,
    		rate,
    		summaries,
    		summary_id,
    		summary_index,
    		type,
    		click_handler,
    		click_handler_1
    	];
    }

    class Rate extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$3, create_fragment$4, safe_not_equal, {
    			summary_id: 4,
    			summary_index: 5,
    			summaries: 3,
    			type: 6
    		});
    	}
    }

    /* src/components/Spinner.svelte generated by Svelte v3.52.0 */

    function create_fragment$3(ctx) {
    	let div4;

    	return {
    		c() {
    			div4 = element("div");

    			div4.innerHTML = `<div class="svelte-haebdk"></div> 
    <div class="svelte-haebdk"></div> 
    <div class="svelte-haebdk"></div> 
    <div class="svelte-haebdk"></div>`;

    			attr(div4, "class", "summaryengine-spinner svelte-haebdk");
    		},
    		m(target, anchor) {
    			insert(target, div4, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div4);
    		}
    	};
    }

    class Spinner extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/components/GenerateSummary.svelte generated by Svelte v3.52.0 */

    function create_else_block(ctx) {
    	let div1;
    	let div0;
    	let t1;
    	let spinner;
    	let current;
    	spinner = new Spinner({});

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "Loading...";
    			t1 = space();
    			create_component(spinner.$$.fragment);
    			attr(div0, "class", "screen-reader-text");
    			attr(div1, "id", "summaryEngineMetaBlockLoading");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div1, t1);
    			mount_component(spinner, div1, null);
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
    			if (detaching) detach(div1);
    			destroy_component(spinner);
    		}
    	};
    }

    // (66:0) {#if !loading}
    function create_if_block$1(ctx) {
    	let button;
    	let t;
    	let button_disabled_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			t = text("Generate Summary");
    			attr(button, "id", "summaryEngineMetaBlockSummariseButton");
    			attr(button, "type", "button");
    			attr(button, "class", "button button-primary");
    			button.disabled = button_disabled_value = /*submissions_left*/ ctx[1] === 0;
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);
    			append(button, t);

    			if (!mounted) {
    				dispose = listen(button, "click", /*generate_summary*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*submissions_left*/ 2 && button_disabled_value !== (button_disabled_value = /*submissions_left*/ ctx[1] === 0)) {
    				button.disabled = button_disabled_value;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$1, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!/*loading*/ ctx[0]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
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
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { type } = $$props;
    	let { loading = false } = $$props;
    	let { submissions_left = 0 } = $$props;
    	let { summaries = [] } = $$props;
    	let { summary_text = "" } = $$props;
    	let { summary_id = 0 } = $$props;
    	let { summary_index = 0 } = $$props;
    	let { custom_settings = 0 } = $$props;

    	const get_content = () => {
    		if (jQuery("#titlewrap").length) {
    			// Classic editor
    			if (jQuery(".wp-editor-area").is(":visible")) {
    				// The code editor is visible
    				return jQuery(".wp-editor-area").val();
    			} else {
    				// The visual editor is visible
    				let content = tinymce.editors.content.getContent();

    				if (content.length > 0) {
    					return content;
    				}
    			}

    			return jQuery("#content").val(); // Last try...
    		} else {
    			return wp.data.select("core/editor").getEditedPostContent();
    		}
    	};

    	const strip_tags = html => {
    		let tmp = document.createElement("div");
    		tmp.innerHTML = html;
    		return tmp.textContent || tmp.innerText || "";
    	};

    	const generate_summary = async e => {
    		const content = strip_tags(get_content());

    		if (!content.length) {
    			alert("Nothing to summarise yet...");
    			return;
    		}

    		try {
    			$$invalidate(0, loading = true);

    			const response = await apiPost("summaryengine/v1/summarise", {
    				content,
    				post_id: jQuery("#post_ID").val(),
    				settings: JSON.stringify(custom_settings),
    				type_id: type.ID
    			});

    			$$invalidate(5, summary_id = response.ID);
    			summaries.unshift(response);
    			$$invalidate(6, summary_index = 0);
    			$$invalidate(3, summaries);
    			$$invalidate(4, summary_text = response.summary.trim());
    			$$invalidate(0, loading = false);
    			return;
    		} catch(err) {
    			alert(err);
    			$$invalidate(0, loading = false);
    		}
    	};

    	$$self.$$set = $$props => {
    		if ('type' in $$props) $$invalidate(7, type = $$props.type);
    		if ('loading' in $$props) $$invalidate(0, loading = $$props.loading);
    		if ('submissions_left' in $$props) $$invalidate(1, submissions_left = $$props.submissions_left);
    		if ('summaries' in $$props) $$invalidate(3, summaries = $$props.summaries);
    		if ('summary_text' in $$props) $$invalidate(4, summary_text = $$props.summary_text);
    		if ('summary_id' in $$props) $$invalidate(5, summary_id = $$props.summary_id);
    		if ('summary_index' in $$props) $$invalidate(6, summary_index = $$props.summary_index);
    		if ('custom_settings' in $$props) $$invalidate(8, custom_settings = $$props.custom_settings);
    	};

    	return [
    		loading,
    		submissions_left,
    		generate_summary,
    		summaries,
    		summary_text,
    		summary_id,
    		summary_index,
    		type,
    		custom_settings
    	];
    }

    class GenerateSummary extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			type: 7,
    			loading: 0,
    			submissions_left: 1,
    			summaries: 3,
    			summary_text: 4,
    			summary_id: 5,
    			summary_index: 6,
    			custom_settings: 8
    		});
    	}
    }

    /* src/post_edit/PostReview.svelte generated by Svelte v3.52.0 */

    function create_if_block_1(ctx) {
    	let navigation;
    	let updating_summary_text;
    	let updating_summary_id;
    	let updating_summary_index;
    	let current;

    	function navigation_summary_text_binding(value) {
    		/*navigation_summary_text_binding*/ ctx[13](value);
    	}

    	function navigation_summary_id_binding(value) {
    		/*navigation_summary_id_binding*/ ctx[14](value);
    	}

    	function navigation_summary_index_binding(value) {
    		/*navigation_summary_index_binding*/ ctx[15](value);
    	}

    	let navigation_props = {
    		summaries: /*summaries*/ ctx[1],
    		type: /*type*/ ctx[0]
    	};

    	if (/*summary_text*/ ctx[2] !== void 0) {
    		navigation_props.summary_text = /*summary_text*/ ctx[2];
    	}

    	if (/*summary_id*/ ctx[3] !== void 0) {
    		navigation_props.summary_id = /*summary_id*/ ctx[3];
    	}

    	if (/*summary_index*/ ctx[4] !== void 0) {
    		navigation_props.summary_index = /*summary_index*/ ctx[4];
    	}

    	navigation = new Navigation({ props: navigation_props });
    	binding_callbacks.push(() => bind(navigation, 'summary_text', navigation_summary_text_binding));
    	binding_callbacks.push(() => bind(navigation, 'summary_id', navigation_summary_id_binding));
    	binding_callbacks.push(() => bind(navigation, 'summary_index', navigation_summary_index_binding));

    	return {
    		c() {
    			create_component(navigation.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(navigation, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const navigation_changes = {};
    			if (dirty & /*summaries*/ 2) navigation_changes.summaries = /*summaries*/ ctx[1];
    			if (dirty & /*type*/ 1) navigation_changes.type = /*type*/ ctx[0];

    			if (!updating_summary_text && dirty & /*summary_text*/ 4) {
    				updating_summary_text = true;
    				navigation_changes.summary_text = /*summary_text*/ ctx[2];
    				add_flush_callback(() => updating_summary_text = false);
    			}

    			if (!updating_summary_id && dirty & /*summary_id*/ 8) {
    				updating_summary_id = true;
    				navigation_changes.summary_id = /*summary_id*/ ctx[3];
    				add_flush_callback(() => updating_summary_id = false);
    			}

    			if (!updating_summary_index && dirty & /*summary_index*/ 16) {
    				updating_summary_index = true;
    				navigation_changes.summary_index = /*summary_index*/ ctx[4];
    				add_flush_callback(() => updating_summary_index = false);
    			}

    			navigation.$set(navigation_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(navigation.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(navigation.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(navigation, detaching);
    		}
    	};
    }

    // (46:8) {#if summary_id > 0}
    function create_if_block(ctx) {
    	let rate;
    	let updating_summaries;
    	let current;

    	function rate_summaries_binding(value) {
    		/*rate_summaries_binding*/ ctx[16](value);
    	}

    	let rate_props = {
    		type: /*type*/ ctx[0],
    		summary_text: /*summary_text*/ ctx[2],
    		summary_id: /*summary_id*/ ctx[3],
    		summary_index: /*summary_index*/ ctx[4]
    	};

    	if (/*summaries*/ ctx[1] !== void 0) {
    		rate_props.summaries = /*summaries*/ ctx[1];
    	}

    	rate = new Rate({ props: rate_props });
    	binding_callbacks.push(() => bind(rate, 'summaries', rate_summaries_binding));

    	return {
    		c() {
    			create_component(rate.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(rate, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const rate_changes = {};
    			if (dirty & /*type*/ 1) rate_changes.type = /*type*/ ctx[0];
    			if (dirty & /*summary_text*/ 4) rate_changes.summary_text = /*summary_text*/ ctx[2];
    			if (dirty & /*summary_id*/ 8) rate_changes.summary_id = /*summary_id*/ ctx[3];
    			if (dirty & /*summary_index*/ 16) rate_changes.summary_index = /*summary_index*/ ctx[4];

    			if (!updating_summaries && dirty & /*summaries*/ 2) {
    				updating_summaries = true;
    				rate_changes.summaries = /*summaries*/ ctx[1];
    				add_flush_callback(() => updating_summaries = false);
    			}

    			rate.$set(rate_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(rate.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(rate.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(rate, detaching);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let div1;
    	let h3;
    	let t0_value = /*type*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let label;
    	let t3;
    	let textarea;
    	let t4;
    	let div0;
    	let generatesummary;
    	let updating_summary_text;
    	let updating_summary_id;
    	let updating_summary_index;
    	let updating_submissions_left;
    	let updating_summaries;
    	let t5;
    	let submissionsleft;
    	let updating_submissions_left_1;
    	let t6;
    	let t7;
    	let current;
    	let mounted;
    	let dispose;

    	function generatesummary_summary_text_binding(value) {
    		/*generatesummary_summary_text_binding*/ ctx[7](value);
    	}

    	function generatesummary_summary_id_binding(value) {
    		/*generatesummary_summary_id_binding*/ ctx[8](value);
    	}

    	function generatesummary_summary_index_binding(value) {
    		/*generatesummary_summary_index_binding*/ ctx[9](value);
    	}

    	function generatesummary_submissions_left_binding(value) {
    		/*generatesummary_submissions_left_binding*/ ctx[10](value);
    	}

    	function generatesummary_summaries_binding(value) {
    		/*generatesummary_summaries_binding*/ ctx[11](value);
    	}

    	let generatesummary_props = { type: /*type*/ ctx[0] };

    	if (/*summary_text*/ ctx[2] !== void 0) {
    		generatesummary_props.summary_text = /*summary_text*/ ctx[2];
    	}

    	if (/*summary_id*/ ctx[3] !== void 0) {
    		generatesummary_props.summary_id = /*summary_id*/ ctx[3];
    	}

    	if (/*summary_index*/ ctx[4] !== void 0) {
    		generatesummary_props.summary_index = /*summary_index*/ ctx[4];
    	}

    	if (/*submissions_left*/ ctx[5] !== void 0) {
    		generatesummary_props.submissions_left = /*submissions_left*/ ctx[5];
    	}

    	if (/*summaries*/ ctx[1] !== void 0) {
    		generatesummary_props.summaries = /*summaries*/ ctx[1];
    	}

    	generatesummary = new GenerateSummary({ props: generatesummary_props });
    	binding_callbacks.push(() => bind(generatesummary, 'summary_text', generatesummary_summary_text_binding));
    	binding_callbacks.push(() => bind(generatesummary, 'summary_id', generatesummary_summary_id_binding));
    	binding_callbacks.push(() => bind(generatesummary, 'summary_index', generatesummary_summary_index_binding));
    	binding_callbacks.push(() => bind(generatesummary, 'submissions_left', generatesummary_submissions_left_binding));
    	binding_callbacks.push(() => bind(generatesummary, 'summaries', generatesummary_summaries_binding));

    	function submissionsleft_submissions_left_binding(value) {
    		/*submissionsleft_submissions_left_binding*/ ctx[12](value);
    	}

    	let submissionsleft_props = {
    		type: /*type*/ ctx[0],
    		summaries: /*summaries*/ ctx[1]
    	};

    	if (/*submissions_left*/ ctx[5] !== void 0) {
    		submissionsleft_props.submissions_left = /*submissions_left*/ ctx[5];
    	}

    	submissionsleft = new SubmissionsLeft({ props: submissionsleft_props });
    	binding_callbacks.push(() => bind(submissionsleft, 'submissions_left', submissionsleft_submissions_left_binding));
    	let if_block0 = /*summaries*/ ctx[1].length > 1 && create_if_block_1(ctx);
    	let if_block1 = /*summary_id*/ ctx[3] > 0 && create_if_block(ctx);

    	return {
    		c() {
    			div1 = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			label = element("label");
    			label.textContent = "Summary";
    			t3 = space();
    			textarea = element("textarea");
    			t4 = space();
    			div0 = element("div");
    			create_component(generatesummary.$$.fragment);
    			t5 = space();
    			create_component(submissionsleft.$$.fragment);
    			t6 = space();
    			if (if_block0) if_block0.c();
    			t7 = space();
    			if (if_block1) if_block1.c();
    			attr(label, "class", "screen-reader-text");
    			attr(label, "for", "summary");
    			attr(textarea, "rows", "1");
    			attr(textarea, "cols", "40");
    			attr(textarea, "name", "summaryengine_summary");
    			attr(textarea, "id", "summaryEngineSummary");
    			attr(textarea, "class", "summaryengine-textarea svelte-gd1r9m");
    			attr(div0, "id", "summaryEngineMetaBlockSummariseButtonContainer");
    			attr(div0, "class", "svelte-gd1r9m");
    			attr(div1, "id", "summaryEngineMetaBlock");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, h3);
    			append(h3, t0);
    			append(div1, t1);
    			append(div1, label);
    			append(div1, t3);
    			append(div1, textarea);
    			set_input_value(textarea, /*summary_text*/ ctx[2]);
    			append(div1, t4);
    			append(div1, div0);
    			mount_component(generatesummary, div0, null);
    			append(div0, t5);
    			mount_component(submissionsleft, div0, null);
    			append(div0, t6);
    			if (if_block0) if_block0.m(div0, null);
    			append(div0, t7);
    			if (if_block1) if_block1.m(div0, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[6]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if ((!current || dirty & /*type*/ 1) && t0_value !== (t0_value = /*type*/ ctx[0].name + "")) set_data(t0, t0_value);

    			if (dirty & /*summary_text*/ 4) {
    				set_input_value(textarea, /*summary_text*/ ctx[2]);
    			}

    			const generatesummary_changes = {};
    			if (dirty & /*type*/ 1) generatesummary_changes.type = /*type*/ ctx[0];

    			if (!updating_summary_text && dirty & /*summary_text*/ 4) {
    				updating_summary_text = true;
    				generatesummary_changes.summary_text = /*summary_text*/ ctx[2];
    				add_flush_callback(() => updating_summary_text = false);
    			}

    			if (!updating_summary_id && dirty & /*summary_id*/ 8) {
    				updating_summary_id = true;
    				generatesummary_changes.summary_id = /*summary_id*/ ctx[3];
    				add_flush_callback(() => updating_summary_id = false);
    			}

    			if (!updating_summary_index && dirty & /*summary_index*/ 16) {
    				updating_summary_index = true;
    				generatesummary_changes.summary_index = /*summary_index*/ ctx[4];
    				add_flush_callback(() => updating_summary_index = false);
    			}

    			if (!updating_submissions_left && dirty & /*submissions_left*/ 32) {
    				updating_submissions_left = true;
    				generatesummary_changes.submissions_left = /*submissions_left*/ ctx[5];
    				add_flush_callback(() => updating_submissions_left = false);
    			}

    			if (!updating_summaries && dirty & /*summaries*/ 2) {
    				updating_summaries = true;
    				generatesummary_changes.summaries = /*summaries*/ ctx[1];
    				add_flush_callback(() => updating_summaries = false);
    			}

    			generatesummary.$set(generatesummary_changes);
    			const submissionsleft_changes = {};
    			if (dirty & /*type*/ 1) submissionsleft_changes.type = /*type*/ ctx[0];
    			if (dirty & /*summaries*/ 2) submissionsleft_changes.summaries = /*summaries*/ ctx[1];

    			if (!updating_submissions_left_1 && dirty & /*submissions_left*/ 32) {
    				updating_submissions_left_1 = true;
    				submissionsleft_changes.submissions_left = /*submissions_left*/ ctx[5];
    				add_flush_callback(() => updating_submissions_left_1 = false);
    			}

    			submissionsleft.$set(submissionsleft_changes);

    			if (/*summaries*/ ctx[1].length > 1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*summaries*/ 2) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div0, t7);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*summary_id*/ ctx[3] > 0) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*summary_id*/ 8) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div0, null);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(generatesummary.$$.fragment, local);
    			transition_in(submissionsleft.$$.fragment, local);
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(generatesummary.$$.fragment, local);
    			transition_out(submissionsleft.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			destroy_component(generatesummary);
    			destroy_component(submissionsleft);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const post_id = jQuery("#post_ID").val();
    	let { type } = $$props;
    	let summaries = [];
    	let summary_text = "";
    	let summary_id = 0;
    	let summary_index = 0;
    	let submissions_left = writable(0);

    	onMount(async () => {
    		try {
    			console.log(summaryengine_settings);
    			$$invalidate(1, summaries = await apiGet(`summaryengine/v1/post/${post_id}?type_id=${type.ID}`));
    			const current_summary = await apiGet(`summaryengine/v1/summary/${post_id}?type_id=${type.ID}`);
    			$$invalidate(2, summary_text = current_summary.summary);
    			$$invalidate(3, summary_id = Number(current_summary.summary_id));
    			$$invalidate(4, summary_index = summaries.findIndex(summary => Number(summary.ID) === summary_id));

    			console.log({
    				summaries,
    				summary_text,
    				summary_id,
    				summary_index
    			});
    		} catch(e) {
    			console.error(e);
    		}
    	});

    	function textarea_input_handler() {
    		summary_text = this.value;
    		$$invalidate(2, summary_text);
    	}

    	function generatesummary_summary_text_binding(value) {
    		summary_text = value;
    		$$invalidate(2, summary_text);
    	}

    	function generatesummary_summary_id_binding(value) {
    		summary_id = value;
    		$$invalidate(3, summary_id);
    	}

    	function generatesummary_summary_index_binding(value) {
    		summary_index = value;
    		$$invalidate(4, summary_index);
    	}

    	function generatesummary_submissions_left_binding(value) {
    		submissions_left = value;
    		$$invalidate(5, submissions_left);
    	}

    	function generatesummary_summaries_binding(value) {
    		summaries = value;
    		$$invalidate(1, summaries);
    	}

    	function submissionsleft_submissions_left_binding(value) {
    		submissions_left = value;
    		$$invalidate(5, submissions_left);
    	}

    	function navigation_summary_text_binding(value) {
    		summary_text = value;
    		$$invalidate(2, summary_text);
    	}

    	function navigation_summary_id_binding(value) {
    		summary_id = value;
    		$$invalidate(3, summary_id);
    	}

    	function navigation_summary_index_binding(value) {
    		summary_index = value;
    		$$invalidate(4, summary_index);
    	}

    	function rate_summaries_binding(value) {
    		summaries = value;
    		$$invalidate(1, summaries);
    	}

    	$$self.$$set = $$props => {
    		if ('type' in $$props) $$invalidate(0, type = $$props.type);
    	};

    	return [
    		type,
    		summaries,
    		summary_text,
    		summary_id,
    		summary_index,
    		submissions_left,
    		textarea_input_handler,
    		generatesummary_summary_text_binding,
    		generatesummary_summary_id_binding,
    		generatesummary_summary_index_binding,
    		generatesummary_submissions_left_binding,
    		generatesummary_summaries_binding,
    		submissionsleft_submissions_left_binding,
    		navigation_summary_text_binding,
    		navigation_summary_id_binding,
    		navigation_summary_index_binding,
    		rate_summaries_binding
    	];
    }

    class PostReview extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { type: 0 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.52.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (19:0) {#each types as type}
    function create_each_block(ctx) {
    	let postreview;
    	let current;
    	postreview = new PostReview({ props: { type: /*type*/ ctx[1] } });

    	return {
    		c() {
    			create_component(postreview.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(postreview, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const postreview_changes = {};
    			if (dirty & /*types*/ 1) postreview_changes.type = /*type*/ ctx[1];
    			postreview.$set(postreview_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(postreview.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(postreview.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(postreview, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*types*/ ctx[0];
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
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*types*/ 1) {
    				each_value = /*types*/ ctx[0];
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
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let types = [];

    	onMount(async () => {
    		try {
    			$$invalidate(0, types = await apiGet(`/summaryengine/v1/types`));
    			console.log({ types });
    		} catch(e) {
    			console.error(e);
    		}
    	});

    	return [types];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const app = new App({
        target: document.getElementById('summaryEngineApp'),
    });

    exports.app = app;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=summaryengine.js.map
