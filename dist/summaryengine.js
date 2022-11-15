var summaryengine = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
        return style.sheet;
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

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
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
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { ownerNode } = info.stylesheet;
                // there is no ownerNode if it runs on jsdom.
                if (ownerNode)
                    detach(ownerNode);
            });
            managed_styles.clear();
        });
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
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
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
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
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
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
    const custom_settings = writable(summaryengine_settings);

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

    function create_fragment$5(ctx) {
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

    function instance$5($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});
    	}
    }

    /* src/components/Navigation.svelte generated by Svelte v3.52.0 */

    function create_fragment$4(ctx) {
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

    function instance$4($$self, $$props, $$invalidate) {
    	let $summary_index;
    	let $summaries;
    	let $summary_text;
    	let $custom_settings;
    	component_subscribe($$self, summary_index, $$value => $$invalidate(0, $summary_index = $$value));
    	component_subscribe($$self, summaries, $$value => $$invalidate(1, $summaries = $$value));
    	component_subscribe($$self, summary_text, $$value => $$invalidate(5, $summary_text = $$value));
    	component_subscribe($$self, custom_settings, $$value => $$invalidate(6, $custom_settings = $$value));

    	const prev = () => {
    		if ($summary_index > 0) {
    			set_store_value(summary_index, $summary_index = $summary_index - 1, $summary_index);
    		}

    		set_store_value(summary_text, $summary_text = $summaries[$summary_index].summary, $summary_text);
    		set_settings();
    		save_current_summary();
    	};

    	const next = () => {
    		if ($summary_index < $summaries.length - 1) {
    			set_store_value(summary_index, $summary_index = $summary_index + 1, $summary_index);
    		}

    		set_store_value(summary_text, $summary_text = $summaries[$summary_index].summary, $summary_text);
    		set_settings();
    		save_current_summary();
    	};

    	const set_settings = () => {
    		set_store_value(custom_settings, $custom_settings.openai_model = $summaries[$summary_index].openai_model, $custom_settings);
    		set_store_value(custom_settings, $custom_settings.openai_max_tokens = $summaries[$summary_index].max_tokens, $custom_settings);
    		set_store_value(custom_settings, $custom_settings.openai_temperature = $summaries[$summary_index].temperature, $custom_settings);
    		set_store_value(custom_settings, $custom_settings.openai_frequency_penalty = $summaries[$summary_index].frequency_penalty, $custom_settings);
    		set_store_value(custom_settings, $custom_settings.openai_presentation_penalty = $summaries[$summary_index].presence_penalty, $custom_settings);
    		set_store_value(custom_settings, $custom_settings.openai_prompt = $summaries[$summary_index].prompt, $custom_settings);
    		set_store_value(custom_settings, $custom_settings.openai_top_p = $summaries[$summary_index].top_p, $custom_settings);
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

    	set_settings();
    	return [$summary_index, $summaries, prev, next, set_settings];
    }

    class Navigation extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { set_settings: 4 });
    	}

    	get set_settings() {
    		return this.$$.ctx[4];
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
    function create_if_block$3(ctx) {
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

    function create_fragment$3(ctx) {
    	let div1;
    	let div0;
    	let span0;
    	let t1;
    	let span1;
    	let t3;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*rated*/ ctx[0]) return create_if_block$3;
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

    function instance$3($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});
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
    function create_if_block$2(ctx) {
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

    function create_fragment$2(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (!/*loading*/ ctx[0]) return create_if_block$2;
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

    function instance$2($$self, $$props, $$invalidate) {
    	let $summary_text;
    	let $summaries;
    	let $summary_index;
    	let $summary_id;
    	let $custom_settings;
    	let $submissions_left;
    	component_subscribe($$self, summary_text, $$value => $$invalidate(3, $summary_text = $$value));
    	component_subscribe($$self, summaries, $$value => $$invalidate(4, $summaries = $$value));
    	component_subscribe($$self, summary_index, $$value => $$invalidate(5, $summary_index = $$value));
    	component_subscribe($$self, summary_id, $$value => $$invalidate(6, $summary_id = $$value));
    	component_subscribe($$self, custom_settings, $$value => $$invalidate(7, $custom_settings = $$value));
    	component_subscribe($$self, submissions_left, $$value => $$invalidate(1, $submissions_left = $$value));
    	let loading = false;

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
    				settings: JSON.stringify($custom_settings)
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function slide(node, { delay = 0, duration = 400, easing = cubicOut } = {}) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => 'overflow: hidden;' +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }

    /* src/components/Settings.svelte generated by Svelte v3.52.0 */

    function create_if_block_1$1(ctx) {
    	let div1;
    	let div1_transition;
    	let current;

    	return {
    		c() {
    			div1 = element("div");
    			div1.innerHTML = `<div class="summaryEngineSettings__header"><h2>Summary Engine Settings</h2></div>`;
    			attr(div1, "id", "summaryEngineSettings");
    			attr(div1, "class", "svelte-1xxi5yx");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, slide, {}, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, slide, {}, false);
    			div1_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			if (detaching && div1_transition) div1_transition.end();
    		}
    	};
    }

    // (18:0) {#if (show_settings)}
    function create_if_block$1(ctx) {
    	let div7;
    	let div0;
    	let label0;
    	let t1;
    	let input0;
    	let t2;
    	let div1;
    	let label1;
    	let t4;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let t9;
    	let div2;
    	let label2;
    	let t11;
    	let input1;
    	let t12;
    	let div3;
    	let label3;
    	let t14;
    	let input2;
    	let t15;
    	let div4;
    	let label4;
    	let t17;
    	let input3;
    	let t18;
    	let div5;
    	let label5;
    	let t20;
    	let input4;
    	let t21;
    	let div6;
    	let label6;
    	let t23;
    	let input5;
    	let div7_transition;
    	let current;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div7 = element("div");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Custom Prompt";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "OpenAI Model";
    			t4 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Text-Davinci-002";
    			option1 = element("option");
    			option1.textContent = "Text-Curie-001";
    			option2 = element("option");
    			option2.textContent = "Text-Babbage-001";
    			option3 = element("option");
    			option3.textContent = "Text-Ada-001";
    			t9 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Max Tokens";
    			t11 = space();
    			input1 = element("input");
    			t12 = space();
    			div3 = element("div");
    			label3 = element("label");
    			label3.textContent = "Temperature";
    			t14 = space();
    			input2 = element("input");
    			t15 = space();
    			div4 = element("div");
    			label4 = element("label");
    			label4.textContent = "Top-P";
    			t17 = space();
    			input3 = element("input");
    			t18 = space();
    			div5 = element("div");
    			label5 = element("label");
    			label5.textContent = "Frequency Penalty";
    			t20 = space();
    			input4 = element("input");
    			t21 = space();
    			div6 = element("div");
    			label6 = element("label");
    			label6.textContent = "Presence Penalty";
    			t23 = space();
    			input5 = element("input");
    			attr(label0, "for", "summaryengine_openai_prompt");
    			attr(input0, "type", "text");
    			attr(input0, "name", "summaryengine_openai_prompt");
    			attr(input0, "id", "summaryengine_openai_prompt");
    			attr(div0, "class", "summaryengine-settings-section svelte-1xxi5yx");
    			attr(label1, "for", "summaryengine_openai_model");
    			option0.__value = "text-davinci-002";
    			option0.value = option0.__value;
    			option1.__value = "text-curie-001";
    			option1.value = option1.__value;
    			option2.__value = "text-babbage-001";
    			option2.value = option2.__value;
    			option3.__value = "text-ada-001";
    			option3.value = option3.__value;
    			attr(select, "name", "summaryengine_openai_model");
    			if (/*$custom_settings*/ ctx[1].openai_model === void 0) add_render_callback(() => /*select_change_handler*/ ctx[5].call(select));
    			attr(div1, "class", "summaryengine-settings-section svelte-1xxi5yx");
    			attr(label2, "for", "summaryengine_openai_max_tokens");
    			attr(input1, "type", "number");
    			attr(input1, "max", "1000");
    			attr(input1, "min", "0");
    			attr(input1, "name", "summaryengine_openai_max_tokens");
    			attr(input1, "id", "summaryengine_openai_max_tokens");
    			attr(div2, "class", "summaryengine-settings-section svelte-1xxi5yx");
    			attr(label3, "for", "summaryengine_openai_temperature");
    			attr(input2, "type", "number");
    			attr(input2, "max", "1");
    			attr(input2, "min", "0");
    			attr(input2, "step", "0.1");
    			attr(input2, "name", "summaryengine_openai_temperature");
    			attr(input2, "id", "summaryengine_openai_temperature");
    			attr(div3, "class", "summaryengine-settings-section svelte-1xxi5yx");
    			attr(label4, "for", "summaryengine_openai_top_p");
    			attr(input3, "type", "number");
    			attr(input3, "max", "1");
    			attr(input3, "min", "0");
    			attr(input3, "step", "0.1");
    			attr(input3, "name", "summaryengine_openai_top_p");
    			attr(input3, "id", "summaryengine_openai_top_p");
    			attr(div4, "class", "summaryengine-settings-section svelte-1xxi5yx");
    			attr(label5, "for", "summaryengine_openai_frequency_penalty");
    			attr(input4, "type", "number");
    			attr(input4, "max", "1");
    			attr(input4, "min", "0");
    			attr(input4, "step", "0.1");
    			attr(input4, "name", "summaryengine_openai_frequency_penalty");
    			attr(input4, "id", "summaryengine_openai_frequency_penalty");
    			attr(div5, "class", "summaryengine-settings-section svelte-1xxi5yx");
    			attr(label6, "for", "summaryengine_openai_presence_penalty");
    			attr(input5, "type", "number");
    			attr(input5, "max", "1");
    			attr(input5, "min", "0");
    			attr(input5, "step", "0.1");
    			attr(input5, "name", "summaryengine_openai_presence_penalty");
    			attr(input5, "id", "summaryengine_openai_presence_penalty");
    			attr(div6, "class", "summaryengine-settings-section svelte-1xxi5yx");
    			attr(div7, "id", "summaryEngineSettingsContainer");
    			attr(div7, "class", "svelte-1xxi5yx");
    		},
    		m(target, anchor) {
    			insert(target, div7, anchor);
    			append(div7, div0);
    			append(div0, label0);
    			append(div0, t1);
    			append(div0, input0);
    			set_input_value(input0, /*$custom_settings*/ ctx[1].openai_prompt);
    			append(div7, t2);
    			append(div7, div1);
    			append(div1, label1);
    			append(div1, t4);
    			append(div1, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			select_option(select, /*$custom_settings*/ ctx[1].openai_model);
    			append(div7, t9);
    			append(div7, div2);
    			append(div2, label2);
    			append(div2, t11);
    			append(div2, input1);
    			set_input_value(input1, /*$custom_settings*/ ctx[1].openai_max_tokens);
    			append(div7, t12);
    			append(div7, div3);
    			append(div3, label3);
    			append(div3, t14);
    			append(div3, input2);
    			set_input_value(input2, /*$custom_settings*/ ctx[1].openai_temperature);
    			append(div7, t15);
    			append(div7, div4);
    			append(div4, label4);
    			append(div4, t17);
    			append(div4, input3);
    			set_input_value(input3, /*$custom_settings*/ ctx[1].openai_top_p);
    			append(div7, t18);
    			append(div7, div5);
    			append(div5, label5);
    			append(div5, t20);
    			append(div5, input4);
    			set_input_value(input4, /*$custom_settings*/ ctx[1].openai_frequency_penalty);
    			append(div7, t21);
    			append(div7, div6);
    			append(div6, label6);
    			append(div6, t23);
    			append(div6, input5);
    			set_input_value(input5, /*$custom_settings*/ ctx[1].openai_presence_penalty);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[4]),
    					listen(select, "change", /*select_change_handler*/ ctx[5]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[6]),
    					listen(input2, "input", /*input2_input_handler*/ ctx[7]),
    					listen(input3, "input", /*input3_input_handler*/ ctx[8]),
    					listen(input4, "input", /*input4_input_handler*/ ctx[9]),
    					listen(input5, "input", /*input5_input_handler*/ ctx[10])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*$custom_settings*/ 2 && input0.value !== /*$custom_settings*/ ctx[1].openai_prompt) {
    				set_input_value(input0, /*$custom_settings*/ ctx[1].openai_prompt);
    			}

    			if (dirty & /*$custom_settings*/ 2) {
    				select_option(select, /*$custom_settings*/ ctx[1].openai_model);
    			}

    			if (dirty & /*$custom_settings*/ 2 && to_number(input1.value) !== /*$custom_settings*/ ctx[1].openai_max_tokens) {
    				set_input_value(input1, /*$custom_settings*/ ctx[1].openai_max_tokens);
    			}

    			if (dirty & /*$custom_settings*/ 2 && to_number(input2.value) !== /*$custom_settings*/ ctx[1].openai_temperature) {
    				set_input_value(input2, /*$custom_settings*/ ctx[1].openai_temperature);
    			}

    			if (dirty & /*$custom_settings*/ 2 && to_number(input3.value) !== /*$custom_settings*/ ctx[1].openai_top_p) {
    				set_input_value(input3, /*$custom_settings*/ ctx[1].openai_top_p);
    			}

    			if (dirty & /*$custom_settings*/ 2 && to_number(input4.value) !== /*$custom_settings*/ ctx[1].openai_frequency_penalty) {
    				set_input_value(input4, /*$custom_settings*/ ctx[1].openai_frequency_penalty);
    			}

    			if (dirty & /*$custom_settings*/ 2 && to_number(input5.value) !== /*$custom_settings*/ ctx[1].openai_presence_penalty) {
    				set_input_value(input5, /*$custom_settings*/ ctx[1].openai_presence_penalty);
    			}
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div7_transition) div7_transition = create_bidirectional_transition(div7, slide, {}, true);
    				div7_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div7_transition) div7_transition = create_bidirectional_transition(div7, slide, {}, false);
    			div7_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div7);
    			if (detaching && div7_transition) div7_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let div;
    	let t0;
    	let span;
    	let t1;
    	let if_block1_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*show_settings*/ ctx[0] && create_if_block_1$1();
    	let if_block1 = /*show_settings*/ ctx[0] && create_if_block$1(ctx);

    	return {
    		c() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			span = element("span");
    			t1 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			attr(span, "class", "dashicons dashicons-admin-settings summaryengine-settings-icon svelte-1xxi5yx");
    			attr(div, "id", "summaryEngineSettingsHeaderContainer");
    			attr(div, "class", "svelte-1xxi5yx");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append(div, t0);
    			append(div, span);
    			insert(target, t1, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(span, "click", /*click_handler*/ ctx[2]),
    					listen(span, "keypress", /*keypress_handler*/ ctx[3])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (/*show_settings*/ ctx[0]) {
    				if (if_block0) {
    					if (dirty & /*show_settings*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1$1();
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*show_settings*/ ctx[0]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*show_settings*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
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
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			if (detaching) detach(t1);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $custom_settings;
    	component_subscribe($$self, custom_settings, $$value => $$invalidate(1, $custom_settings = $$value));
    	let show_settings = false;
    	const click_handler = () => $$invalidate(0, show_settings = !show_settings);
    	const keypress_handler = () => $$invalidate(0, show_settings = !show_settings);

    	function input0_input_handler() {
    		$custom_settings.openai_prompt = this.value;
    		custom_settings.set($custom_settings);
    	}

    	function select_change_handler() {
    		$custom_settings.openai_model = select_value(this);
    		custom_settings.set($custom_settings);
    	}

    	function input1_input_handler() {
    		$custom_settings.openai_max_tokens = to_number(this.value);
    		custom_settings.set($custom_settings);
    	}

    	function input2_input_handler() {
    		$custom_settings.openai_temperature = to_number(this.value);
    		custom_settings.set($custom_settings);
    	}

    	function input3_input_handler() {
    		$custom_settings.openai_top_p = to_number(this.value);
    		custom_settings.set($custom_settings);
    	}

    	function input4_input_handler() {
    		$custom_settings.openai_frequency_penalty = to_number(this.value);
    		custom_settings.set($custom_settings);
    	}

    	function input5_input_handler() {
    		$custom_settings.openai_presence_penalty = to_number(this.value);
    		custom_settings.set($custom_settings);
    	}

    	return [
    		show_settings,
    		$custom_settings,
    		click_handler,
    		keypress_handler,
    		input0_input_handler,
    		select_change_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_input_handler
    	];
    }

    class Settings extends SvelteComponent {
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

    // (39:8) {#if $summary_id > 0}
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
    	let settings;
    	let t1;
    	let label;
    	let t3;
    	let textarea;
    	let t4;
    	let div0;
    	let generatesummary;
    	let t5;
    	let submissionsleft;
    	let t6;
    	let t7;
    	let current;
    	let mounted;
    	let dispose;
    	settings = new Settings({});
    	generatesummary = new GenerateSummary({});
    	submissionsleft = new SubmissionsLeft({});
    	let if_block0 = /*$summaries*/ ctx[1].length > 1 && create_if_block_1();
    	let if_block1 = /*$summary_id*/ ctx[0] > 0 && create_if_block();

    	return {
    		c() {
    			div1 = element("div");
    			input = element("input");
    			t0 = space();
    			create_component(settings.$$.fragment);
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
    			mount_component(settings, div1, null);
    			append(div1, t1);
    			append(div1, label);
    			append(div1, t3);
    			append(div1, textarea);
    			set_input_value(textarea, /*$summary_text*/ ctx[2]);
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
    					if_block0.m(div0, t7);
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
    			transition_in(settings.$$.fragment, local);
    			transition_in(generatesummary.$$.fragment, local);
    			transition_in(submissionsleft.$$.fragment, local);
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(settings.$$.fragment, local);
    			transition_out(generatesummary.$$.fragment, local);
    			transition_out(submissionsleft.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			destroy_component(settings);
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
    			set_store_value(summaries, $summaries = await apiGet(`summaryengine/v1/post/${post_id}`), $summaries);
    			const current_summary = await apiGet(`summaryengine/v1/summary/${post_id}`);
    			set_store_value(summary_text, $summary_text = current_summary.summary, $summary_text);
    			set_store_value(summary_id, $summary_id = Number(current_summary.summary_id), $summary_id);
    			set_store_value(summary_index, $summary_index = $summaries.findIndex(summary => Number(summary.ID) === $summary_id), $summary_index);
    		} catch(e) {
    			console.error(e);
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
