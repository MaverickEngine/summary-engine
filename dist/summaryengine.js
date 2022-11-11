var summaryengine = (function () {
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

    const summaries = writable([]);
    const summary_text = writable("");
    const summary_index = writable(0);
    const summary_id = writable(0);
    const submissions_left = writable(0);

    function apiPost(path, data){
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

    function apiGet(path){
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

    /* src/components/SubmissionsLeft.svelte generated by Svelte v3.52.0 */

    function create_fragment$4(ctx) {
    	let div;
    	let span0;
    	let t0;
    	let t1;
    	let span1;

    	return {
    		c() {
    			div = element("div");
    			span0 = element("span");
    			t0 = text(/*$submissions_left*/ ctx[0]);
    			t1 = space();
    			span1 = element("span");
    			span1.textContent = "submissions left";
    			attr(span0, "id", "summaryEngineSubmissionsLeft");
    			attr(span0, "class", "svelte-1ebs6qp");
    			toggle_class(span0, "zero", /*$submissions_left*/ ctx[0] === 0);
    			attr(span1, "id", "summaryEngineSubmissionsLeftLabel");
    			attr(div, "id", "summaryEngineCounter");
    			attr(div, "class", "svelte-1ebs6qp");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, span0);
    			append(span0, t0);
    			append(div, t1);
    			append(div, span1);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$submissions_left*/ 1) set_data(t0, /*$submissions_left*/ ctx[0]);

    			if (dirty & /*$submissions_left*/ 1) {
    				toggle_class(span0, "zero", /*$submissions_left*/ ctx[0] === 0);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $summaries;
    	let $submissions_left;
    	component_subscribe($$self, summaries, $$value => $$invalidate(1, $summaries = $$value));
    	component_subscribe($$self, submissions_left, $$value => $$invalidate(0, $submissions_left = $$value));
    	const max_summaries = Number(summaryengine_max_number_of_submissions_per_post);

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$summaries*/ 2) {
    			{
    				set_store_value(
    					submissions_left,
    					$submissions_left = max_summaries - $summaries.length > 0
    					? max_summaries - $summaries.length
    					: 0,
    					$submissions_left
    				);
    			} // console.log($submissions_left);
    		}
    	};

    	return [$submissions_left, $summaries];
    }

    class SubmissionsLeft extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
    	}
    }

    /* src/components/Navigation.svelte generated by Svelte v3.52.0 */

    function create_fragment$3(ctx) {
    	let div;
    	let button0;
    	let t0;
    	let button0_disabled_value;
    	let t1;
    	let button1;
    	let t2;
    	let button1_disabled_value;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			button0 = element("button");
    			t0 = text("Previous");
    			t1 = space();
    			button1 = element("button");
    			t2 = text("Next");
    			attr(button0, "id", "summaryEngineNavigatorPrev");
    			attr(button0, "type", "button");
    			attr(button0, "class", "button button-secondary svelte-7ckp25");
    			button0.disabled = button0_disabled_value = /*$summary_index*/ ctx[0] === 0;
    			attr(button1, "id", "summaryEngineNavigatorNext");
    			attr(button1, "type", "button");
    			attr(button1, "class", "button button-secondary svelte-7ckp25");
    			button1.disabled = button1_disabled_value = /*$summary_index*/ ctx[0] === /*$summaries*/ ctx[1].length - 1;
    			attr(div, "id", "summaryEngineNavigator");
    			attr(div, "class", "svelte-7ckp25");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, button0);
    			append(button0, t0);
    			append(div, t1);
    			append(div, button1);
    			append(button1, t2);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*prev*/ ctx[2]),
    					listen(button1, "click", /*next*/ ctx[3])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$summary_index*/ 1 && button0_disabled_value !== (button0_disabled_value = /*$summary_index*/ ctx[0] === 0)) {
    				button0.disabled = button0_disabled_value;
    			}

    			if (dirty & /*$summary_index, $summaries*/ 3 && button1_disabled_value !== (button1_disabled_value = /*$summary_index*/ ctx[0] === /*$summaries*/ ctx[1].length - 1)) {
    				button1.disabled = button1_disabled_value;
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

    function instance$3($$self, $$props, $$invalidate) {
    	let $summary_index;
    	let $summaries;
    	let $summary_text;
    	component_subscribe($$self, summary_index, $$value => $$invalidate(0, $summary_index = $$value));
    	component_subscribe($$self, summaries, $$value => $$invalidate(1, $summaries = $$value));
    	component_subscribe($$self, summary_text, $$value => $$invalidate(4, $summary_text = $$value));

    	const prev = () => {
    		if ($summary_index > 0) {
    			set_store_value(summary_index, $summary_index = $summary_index - 1, $summary_index);
    		}

    		set_store_value(summary_text, $summary_text = $summaries[$summary_index].summary, $summary_text);
    		save_current_summary();
    	};

    	const next = () => {
    		if ($summary_index < $summaries.length - 1) {
    			set_store_value(summary_index, $summary_index = $summary_index + 1, $summary_index);
    		}

    		set_store_value(summary_text, $summary_text = $summaries[$summary_index].summary, $summary_text);
    		save_current_summary();
    	};

    	const save_current_summary = async () => {
    		try {
    			await apiPost("summaryengine/v1/summary/" + jQuery("#post_ID").val(), {
    				summary: $summary_text,
    				summary_index: $summary_index,
    				summary_id: $summaries[$summary_index].ID
    			});
    		} catch(err) {
    			console.error(err);
    			alert(err);
    		}
    	};

    	return [$summary_index, $summaries, prev, next];
    }

    class Navigation extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});
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

    // (30:4) {#if rated}
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

    function create_fragment$2(ctx) {
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
    			attr(span0, "class", "summaryengine-rate-icon svelte-l91exy");
    			toggle_class(span0, "summaryengine-rate-icon-selected", /*rating*/ ctx[1] === 1);
    			attr(span1, "id", "summaryEngineRateBad");
    			attr(span1, "class", "summaryengine-rate-icon svelte-l91exy");
    			toggle_class(span1, "summaryengine-rate-icon-selected", /*rating*/ ctx[1] === -1);
    			attr(div0, "id", "summaryEngineRateIcons");
    			attr(div0, "class", "svelte-l91exy");
    			attr(div1, "id", "summaryEngineRate");
    			attr(div1, "class", "svelte-l91exy");
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
    					listen(span0, "click", /*click_handler*/ ctx[5]),
    					listen(span1, "click", /*click_handler_1*/ ctx[6])
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

    function instance$2($$self, $$props, $$invalidate) {
    	let $summary_index;
    	let $summaries;
    	let $summary_id;
    	component_subscribe($$self, summary_index, $$value => $$invalidate(3, $summary_index = $$value));
    	component_subscribe($$self, summaries, $$value => $$invalidate(4, $summaries = $$value));
    	component_subscribe($$self, summary_id, $$value => $$invalidate(7, $summary_id = $$value));
    	let rated = false;
    	let rating = 0;

    	const rate = async rating => {
    		// console.log("rate", rating);
    		try {
    			set_store_value(summaries, $summaries[$summary_index].rating = rating, $summaries);
    			await apiPost("summaryengine/v1/rate/" + $summary_id, { rating });
    		} catch(err) {
    			console.error(err);
    			alert(err);
    		}
    	};

    	const click_handler = () => rate(1);
    	const click_handler_1 = () => rate(-1);

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$summaries, $summary_index*/ 24) {
    			$$invalidate(0, rated = $summaries[$summary_index]?.rating && [-1, 1].includes(Number($summaries[$summary_index].rating)));
    		}

    		if ($$self.$$.dirty & /*$summaries, $summary_index*/ 24) {
    			$$invalidate(1, rating = ($summaries[$summary_index]?.rating)
    			? Number($summaries[$summary_index].rating)
    			: 0);
    		}
    	};

    	return [
    		rated,
    		rating,
    		rate,
    		$summary_index,
    		$summaries,
    		click_handler,
    		click_handler_1
    	];
    }

    class Rate extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src/components/GenerateSummary.svelte generated by Svelte v3.52.0 */

    function create_else_block(ctx) {
    	let div6;

    	return {
    		c() {
    			div6 = element("div");

    			div6.innerHTML = `<div class="screen-reader-text">Loading...</div> 
    <div class="summaryengine-spinner svelte-55i5mm"><div class="svelte-55i5mm"></div> 
        <div class="svelte-55i5mm"></div> 
        <div class="svelte-55i5mm"></div> 
        <div class="svelte-55i5mm"></div></div>`;

    			attr(div6, "id", "summaryEngineMetaBlockLoading");
    		},
    		m(target, anchor) {
    			insert(target, div6, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div6);
    		}
    	};
    }

    // (58:0) {#if !loading}
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
    			button.disabled = button_disabled_value = /*$submissions_left*/ ctx[1] === 0;
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
    			if (dirty & /*$submissions_left*/ 2 && button_disabled_value !== (button_disabled_value = /*$submissions_left*/ ctx[1] === 0)) {
    				button.disabled = button_disabled_value;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (!/*loading*/ ctx[0]) return create_if_block$1;
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
    		p(ctx, [dirty]) {
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
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $summary_text;
    	let $summaries;
    	let $summary_index;
    	let $summary_id;
    	let $submissions_left;
    	component_subscribe($$self, summary_text, $$value => $$invalidate(3, $summary_text = $$value));
    	component_subscribe($$self, summaries, $$value => $$invalidate(4, $summaries = $$value));
    	component_subscribe($$self, summary_index, $$value => $$invalidate(5, $summary_index = $$value));
    	component_subscribe($$self, summary_id, $$value => $$invalidate(6, $summary_id = $$value));
    	component_subscribe($$self, submissions_left, $$value => $$invalidate(1, $submissions_left = $$value));
    	let loading = false;

    	const get_content = () => {
    		if (jQuery("#titlewrap").length) {
    			// Classic editor
    			if (jQuery(".wp-editor-area").is(":visible")) {
    				// The code editor is visible
    				// console.log("Code editor is visible");
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
    				post_id: jQuery("#post_ID").val()
    			});

    			set_store_value(summary_id, $summary_id = response.ID, $summary_id);
    			$summaries.unshift(response);
    			set_store_value(summary_index, $summary_index = 0, $summary_index);
    			summaries.set($summaries);
    			set_store_value(summary_text, $summary_text = response.summary.trim(), $summary_text);
    			$$invalidate(0, loading = false);
    			return;
    		} catch(err) {
    			alert(err);
    			$$invalidate(0, loading = false);
    		}
    	};

    	return [loading, $submissions_left, generate_summary];
    }

    class GenerateSummary extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.52.0 */

    function create_if_block_1(ctx) {
    	let navigation;
    	let current;
    	navigation = new Navigation({});

    	return {
    		c() {
    			create_component(navigation.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(navigation, target, anchor);
    			current = true;
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

    // (40:8) {#if $summary_id > 0}
    function create_if_block(ctx) {
    	let rate;
    	let current;
    	rate = new Rate({});

    	return {
    		c() {
    			create_component(rate.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(rate, target, anchor);
    			current = true;
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

    function create_fragment(ctx) {
    	let div1;
    	let input;
    	let t0;
    	let label;
    	let t2;
    	let textarea;
    	let t3;
    	let div0;
    	let generatesummary;
    	let t4;
    	let submissionsleft;
    	let t5;
    	let t6;
    	let current;
    	let mounted;
    	let dispose;
    	generatesummary = new GenerateSummary({});
    	submissionsleft = new SubmissionsLeft({});
    	let if_block0 = /*$summaries*/ ctx[1].length > 1 && create_if_block_1();
    	let if_block1 = /*$summary_id*/ ctx[0] > 0 && create_if_block();

    	return {
    		c() {
    			div1 = element("div");
    			input = element("input");
    			t0 = space();
    			label = element("label");
    			label.textContent = "Summary";
    			t2 = space();
    			textarea = element("textarea");
    			t3 = space();
    			div0 = element("div");
    			create_component(generatesummary.$$.fragment);
    			t4 = space();
    			create_component(submissionsleft.$$.fragment);
    			t5 = space();
    			if (if_block0) if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			attr(input, "type", "hidden");
    			attr(input, "name", "summaryengine_summary_id");
    			attr(input, "id", "summaryEngineSummaryId");
    			input.value = "<?php echo esc_attr(get_post_meta($post->ID, 'summaryengine_summary_id', -1)); ?>";
    			attr(label, "class", "screen-reader-text");
    			attr(label, "for", "summary");
    			attr(textarea, "rows", "1");
    			attr(textarea, "cols", "40");
    			attr(textarea, "name", "summaryengine_summary");
    			attr(textarea, "id", "summaryEngineSummary");
    			attr(textarea, "class", "summaryengine-textarea svelte-tmklmc");
    			attr(div0, "id", "summaryEngineMetaBlockSummariseButtonContainer");
    			attr(div0, "class", "svelte-tmklmc");
    			attr(div1, "id", "summaryEngineMetaBlock");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, input);
    			append(div1, t0);
    			append(div1, label);
    			append(div1, t2);
    			append(div1, textarea);
    			set_input_value(textarea, /*$summary_text*/ ctx[2]);
    			append(div1, t3);
    			append(div1, div0);
    			mount_component(generatesummary, div0, null);
    			append(div0, t4);
    			mount_component(submissionsleft, div0, null);
    			append(div0, t5);
    			if (if_block0) if_block0.m(div0, null);
    			append(div0, t6);
    			if (if_block1) if_block1.m(div0, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*$summary_text*/ 4) {
    				set_input_value(textarea, /*$summary_text*/ ctx[2]);
    			}

    			if (/*$summaries*/ ctx[1].length > 1) {
    				if (if_block0) {
    					if (dirty & /*$summaries*/ 2) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1();
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div0, t6);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*$summary_id*/ ctx[0] > 0) {
    				if (if_block1) {
    					if (dirty & /*$summary_id*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block();
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

    function instance($$self, $$props, $$invalidate) {
    	let $summary_id;
    	let $summaries;
    	let $summary_index;
    	let $summary_text;
    	component_subscribe($$self, summary_id, $$value => $$invalidate(0, $summary_id = $$value));
    	component_subscribe($$self, summaries, $$value => $$invalidate(1, $summaries = $$value));
    	component_subscribe($$self, summary_index, $$value => $$invalidate(4, $summary_index = $$value));
    	component_subscribe($$self, summary_text, $$value => $$invalidate(2, $summary_text = $$value));
    	const post_id = jQuery("#post_ID").val();

    	onMount(async () => {
    		try {
    			// $summary_text = summaryengine_summary || '';
    			set_store_value(summaries, $summaries = await apiGet(`summaryengine/v1/post/${post_id}`), $summaries);

    			const current_summary = await apiGet(`summaryengine/v1/summary/${post_id}`);
    			set_store_value(summary_text, $summary_text = current_summary.summary, $summary_text);
    			set_store_value(summary_id, $summary_id = Number(current_summary.summary_id), $summary_id);
    			set_store_value(summary_index, $summary_index = $summaries.findIndex(summary => Number(summary.ID) === $summary_id), $summary_index);
    		} catch(e) {
    			console.error(e); // console.log({ $summary_id, $summary_index });
    		}
    	});

    	function textarea_input_handler() {
    		$summary_text = this.value;
    		summary_text.set($summary_text);
    	}

    	return [$summary_id, $summaries, $summary_text, textarea_input_handler];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    // import "./summaryengine.scss";

    const app = new App({
        target: document.getElementById('summaryEngineApp'),
    });

    // main();

    return app;

})();
//# sourceMappingURL=summaryengine.js.map
