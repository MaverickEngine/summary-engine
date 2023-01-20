var summaryengine_types = (function (exports) {
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

    /* src/components/OpenAITypeSettings.svelte generated by Svelte v3.52.0 */

    function create_fragment$1(ctx) {
    	let tr0;
    	let th0;
    	let t1;
    	let td0;
    	let input0;
    	let t2;
    	let p0;
    	let t4;
    	let tr1;
    	let th1;
    	let t6;
    	let td1;
    	let input1;
    	let t7;
    	let p1;
    	let t9;
    	let tr2;
    	let th2;
    	let t11;
    	let td2;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let option4;
    	let t17;
    	let tr3;
    	let th3;
    	let t19;
    	let td3;
    	let input2;
    	let t20;
    	let tr4;
    	let th4;
    	let t22;
    	let td4;
    	let input3;
    	let t23;
    	let tr5;
    	let th5;
    	let t25;
    	let td5;
    	let input4;
    	let t26;
    	let p2;
    	let t28;
    	let tr6;
    	let th6;
    	let t30;
    	let td6;
    	let input5;
    	let t31;
    	let p3;
    	let t33;
    	let tr7;
    	let th7;
    	let t35;
    	let td7;
    	let input6;
    	let t36;
    	let p4;
    	let t38;
    	let tr8;
    	let th8;
    	let t40;
    	let td8;
    	let input7;
    	let t41;
    	let p5;
    	let t43;
    	let tr9;
    	let th9;
    	let t45;
    	let td9;
    	let input8;
    	let t46;
    	let p6;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			tr0 = element("tr");
    			th0 = element("th");
    			th0.textContent = "Prepend Prompt";
    			t1 = space();
    			td0 = element("td");
    			input0 = element("input");
    			t2 = space();
    			p0 = element("p");
    			p0.textContent = "The instruction to the model on what you'd like to generate, prepended.";
    			t4 = space();
    			tr1 = element("tr");
    			th1 = element("th");
    			th1.textContent = "Append Prompt";
    			t6 = space();
    			td1 = element("td");
    			input1 = element("input");
    			t7 = space();
    			p1 = element("p");
    			p1.textContent = "The instruction to the model on what you'd like to generate, appended.";
    			t9 = space();
    			tr2 = element("tr");
    			th2 = element("th");
    			th2.textContent = "OpenAPI Model";
    			t11 = space();
    			td2 = element("td");
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
    			t17 = space();
    			tr3 = element("tr");
    			th3 = element("th");
    			th3.textContent = "Submission word limit";
    			t19 = space();
    			td3 = element("td");
    			input2 = element("input");
    			t20 = space();
    			tr4 = element("tr");
    			th4 = element("th");
    			th4.textContent = "Cut at paragraph nearest end?";
    			t22 = space();
    			td4 = element("td");
    			input3 = element("input");
    			t23 = space();
    			tr5 = element("tr");
    			th5 = element("th");
    			th5.textContent = "Max tokens";
    			t25 = space();
    			td5 = element("td");
    			input4 = element("input");
    			t26 = space();
    			p2 = element("p");
    			p2.textContent = "The maximum number of tokens to generate in the completion.";
    			t28 = space();
    			tr6 = element("tr");
    			th6 = element("th");
    			th6.textContent = "Temperature";
    			t30 = space();
    			td6 = element("td");
    			input5 = element("input");
    			t31 = space();
    			p3 = element("p");
    			p3.textContent = "What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both.";
    			t33 = space();
    			tr7 = element("tr");
    			th7 = element("th");
    			th7.textContent = "Top-P";
    			t35 = space();
    			td7 = element("td");
    			input6 = element("input");
    			t36 = space();
    			p4 = element("p");
    			p4.textContent = "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.";
    			t38 = space();
    			tr8 = element("tr");
    			th8 = element("th");
    			th8.textContent = "Presence penalty";
    			t40 = space();
    			td8 = element("td");
    			input7 = element("input");
    			t41 = space();
    			p5 = element("p");
    			p5.textContent = "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.";
    			t43 = space();
    			tr9 = element("tr");
    			th9 = element("th");
    			th9.textContent = "Frequency penalty";
    			t45 = space();
    			td9 = element("td");
    			input8 = element("input");
    			t46 = space();
    			p6 = element("p");
    			p6.textContent = "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.";
    			attr(th0, "scope", "row");
    			attr(input0, "type", "text");
    			attr(input0, "name", "openai_prompt");
    			attr(input0, "class", "regular-text");
    			input0.required = true;
    			attr(th1, "scope", "row");
    			attr(input1, "type", "text");
    			attr(input1, "name", "openai_append_prompt");
    			attr(input1, "class", "regular-text");
    			input1.required = true;
    			attr(th2, "scope", "row");
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
    			if (/*settings*/ ctx[0].openai_model === void 0) add_render_callback(() => /*select_change_handler*/ ctx[3].call(select));
    			attr(th3, "scope", "row");
    			attr(input2, "type", "number");
    			attr(input2, "name", "word_limit");
    			attr(input2, "class", "regular-text");
    			attr(input2, "min", "0");
    			attr(th4, "scope", "row");
    			attr(input3, "type", "checkbox");
    			attr(input3, "name", "cut_at_paragraph");
    			attr(th5, "scope", "row");
    			attr(input4, "type", "number");
    			attr(input4, "name", "openai_max_tokens");
    			attr(input4, "class", "regular-text");
    			attr(input4, "min", "0");
    			attr(input4, "max", "2048");
    			attr(input4, "step", "1");
    			attr(th6, "scope", "row");
    			attr(input5, "type", "number");
    			attr(input5, "name", "openai_temperature");
    			attr(input5, "class", "regular-text");
    			attr(input5, "min", "0");
    			attr(input5, "max", "1");
    			attr(input5, "step", "0.1");
    			attr(th7, "scope", "row");
    			attr(input6, "type", "number");
    			attr(input6, "name", "openai_top_p");
    			attr(input6, "class", "regular-text");
    			attr(input6, "min", "0");
    			attr(input6, "max", "1");
    			attr(input6, "step", "0.1");
    			attr(th8, "scope", "row");
    			attr(input7, "type", "number");
    			attr(input7, "name", "openai_presence_penalty");
    			attr(input7, "class", "regular-text");
    			attr(input7, "min", "-2");
    			attr(input7, "max", "2");
    			attr(input7, "step", "0.1");
    			attr(th9, "scope", "row");
    			attr(input8, "type", "number");
    			attr(input8, "name", "openai_frequency_penalty");
    			attr(input8, "class", "regular-text");
    			attr(input8, "min", "-2");
    			attr(input8, "max", "2");
    			attr(input8, "step", "0.1");
    		},
    		m(target, anchor) {
    			insert(target, tr0, anchor);
    			append(tr0, th0);
    			append(tr0, t1);
    			append(tr0, td0);
    			append(td0, input0);
    			set_input_value(input0, /*settings*/ ctx[0].openai_prompt);
    			append(td0, t2);
    			append(td0, p0);
    			insert(target, t4, anchor);
    			insert(target, tr1, anchor);
    			append(tr1, th1);
    			append(tr1, t6);
    			append(tr1, td1);
    			append(td1, input1);
    			set_input_value(input1, /*settings*/ ctx[0].openai_append_prompt);
    			append(td1, t7);
    			append(td1, p1);
    			insert(target, t9, anchor);
    			insert(target, tr2, anchor);
    			append(tr2, th2);
    			append(tr2, t11);
    			append(tr2, td2);
    			append(td2, select);
    			append(select, option0);
    			append(select, option1);
    			append(select, option2);
    			append(select, option3);
    			append(select, option4);
    			select_option(select, /*settings*/ ctx[0].openai_model);
    			insert(target, t17, anchor);
    			insert(target, tr3, anchor);
    			append(tr3, th3);
    			append(tr3, t19);
    			append(tr3, td3);
    			append(td3, input2);
    			set_input_value(input2, /*settings*/ ctx[0].word_limit);
    			insert(target, t20, anchor);
    			insert(target, tr4, anchor);
    			append(tr4, th4);
    			append(tr4, t22);
    			append(tr4, td4);
    			append(td4, input3);
    			input3.checked = /*settings*/ ctx[0].cut_at_paragraph;
    			insert(target, t23, anchor);
    			insert(target, tr5, anchor);
    			append(tr5, th5);
    			append(tr5, t25);
    			append(tr5, td5);
    			append(td5, input4);
    			set_input_value(input4, /*settings*/ ctx[0].openai_max_tokens);
    			append(td5, t26);
    			append(td5, p2);
    			insert(target, t28, anchor);
    			insert(target, tr6, anchor);
    			append(tr6, th6);
    			append(tr6, t30);
    			append(tr6, td6);
    			append(td6, input5);
    			set_input_value(input5, /*settings*/ ctx[0].openai_temperature);
    			append(td6, t31);
    			append(td6, p3);
    			insert(target, t33, anchor);
    			insert(target, tr7, anchor);
    			append(tr7, th7);
    			append(tr7, t35);
    			append(tr7, td7);
    			append(td7, input6);
    			set_input_value(input6, /*settings*/ ctx[0].openai_top_p);
    			append(td7, t36);
    			append(td7, p4);
    			insert(target, t38, anchor);
    			insert(target, tr8, anchor);
    			append(tr8, th8);
    			append(tr8, t40);
    			append(tr8, td8);
    			append(td8, input7);
    			set_input_value(input7, /*settings*/ ctx[0].openai_presence_penalty);
    			append(td8, t41);
    			append(td8, p5);
    			insert(target, t43, anchor);
    			insert(target, tr9, anchor);
    			append(tr9, th9);
    			append(tr9, t45);
    			append(tr9, td9);
    			append(td9, input8);
    			set_input_value(input8, /*settings*/ ctx[0].openai_frequency_penalty);
    			append(td9, t46);
    			append(td9, p6);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[1]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[2]),
    					listen(select, "change", /*select_change_handler*/ ctx[3]),
    					listen(input2, "input", /*input2_input_handler*/ ctx[4]),
    					listen(input3, "change", /*input3_change_handler*/ ctx[5]),
    					listen(input4, "input", /*input4_input_handler*/ ctx[6]),
    					listen(input5, "input", /*input5_input_handler*/ ctx[7]),
    					listen(input6, "input", /*input6_input_handler*/ ctx[8]),
    					listen(input7, "input", /*input7_input_handler*/ ctx[9]),
    					listen(input8, "input", /*input8_input_handler*/ ctx[10])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*settings*/ 1 && input0.value !== /*settings*/ ctx[0].openai_prompt) {
    				set_input_value(input0, /*settings*/ ctx[0].openai_prompt);
    			}

    			if (dirty & /*settings*/ 1 && input1.value !== /*settings*/ ctx[0].openai_append_prompt) {
    				set_input_value(input1, /*settings*/ ctx[0].openai_append_prompt);
    			}

    			if (dirty & /*settings*/ 1) {
    				select_option(select, /*settings*/ ctx[0].openai_model);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input2.value) !== /*settings*/ ctx[0].word_limit) {
    				set_input_value(input2, /*settings*/ ctx[0].word_limit);
    			}

    			if (dirty & /*settings*/ 1) {
    				input3.checked = /*settings*/ ctx[0].cut_at_paragraph;
    			}

    			if (dirty & /*settings*/ 1 && to_number(input4.value) !== /*settings*/ ctx[0].openai_max_tokens) {
    				set_input_value(input4, /*settings*/ ctx[0].openai_max_tokens);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input5.value) !== /*settings*/ ctx[0].openai_temperature) {
    				set_input_value(input5, /*settings*/ ctx[0].openai_temperature);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input6.value) !== /*settings*/ ctx[0].openai_top_p) {
    				set_input_value(input6, /*settings*/ ctx[0].openai_top_p);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input7.value) !== /*settings*/ ctx[0].openai_presence_penalty) {
    				set_input_value(input7, /*settings*/ ctx[0].openai_presence_penalty);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input8.value) !== /*settings*/ ctx[0].openai_frequency_penalty) {
    				set_input_value(input8, /*settings*/ ctx[0].openai_frequency_penalty);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(tr0);
    			if (detaching) detach(t4);
    			if (detaching) detach(tr1);
    			if (detaching) detach(t9);
    			if (detaching) detach(tr2);
    			if (detaching) detach(t17);
    			if (detaching) detach(tr3);
    			if (detaching) detach(t20);
    			if (detaching) detach(tr4);
    			if (detaching) detach(t23);
    			if (detaching) detach(tr5);
    			if (detaching) detach(t28);
    			if (detaching) detach(tr6);
    			if (detaching) detach(t33);
    			if (detaching) detach(tr7);
    			if (detaching) detach(t38);
    			if (detaching) detach(tr8);
    			if (detaching) detach(t43);
    			if (detaching) detach(tr9);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { settings } = $$props;

    	function input0_input_handler() {
    		settings.openai_prompt = this.value;
    		$$invalidate(0, settings);
    	}

    	function input1_input_handler() {
    		settings.openai_append_prompt = this.value;
    		$$invalidate(0, settings);
    	}

    	function select_change_handler() {
    		settings.openai_model = select_value(this);
    		$$invalidate(0, settings);
    	}

    	function input2_input_handler() {
    		settings.word_limit = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input3_change_handler() {
    		settings.cut_at_paragraph = this.checked;
    		$$invalidate(0, settings);
    	}

    	function input4_input_handler() {
    		settings.openai_max_tokens = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input5_input_handler() {
    		settings.openai_temperature = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input6_input_handler() {
    		settings.openai_top_p = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input7_input_handler() {
    		settings.openai_presence_penalty = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input8_input_handler() {
    		settings.openai_frequency_penalty = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	$$self.$$set = $$props => {
    		if ('settings' in $$props) $$invalidate(0, settings = $$props.settings);
    	};

    	return [
    		settings,
    		input0_input_handler,
    		input1_input_handler,
    		select_change_handler,
    		input2_input_handler,
    		input3_change_handler,
    		input4_input_handler,
    		input5_input_handler,
    		input6_input_handler,
    		input7_input_handler,
    		input8_input_handler
    	];
    }

    class OpenAITypeSettings extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { settings: 0 });
    	}
    }

    /* src/components/Types.svelte generated by Svelte v3.52.0 */

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

    // (111:0) {#if has_error}
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
    			if (detaching) detach(div);
    		}
    	};
    }

    // (118:4) {#each $types as type, i}
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
    			if (detaching) detach(a);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (124:4) {#if tab === i}
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
    			p.textContent = "Call a custom action based on the summary and post, eg. post to Twitter. Use [post_url] and [summary], and [summary_encoded] as variables.";
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
    			if (detaching) detach(div);
    			if (if_block0) if_block0.d();
    			destroy_component(openaitypesettings);
    			if (detaching) detach(t15);
    			if_block1.d(detaching);
    			if (detaching) detach(t16);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach(t17);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach(t18);
    			if (if_block4) if_block4.d(detaching);
    			if (detaching) detach(if_block4_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (127:12) {#if (saved)}
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

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};
    }

    // (155:8) {:else}
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

    // (153:8) {#if !saving}
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
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (158:8) {#if (Number(type.ID) !== 1) && (!deleting)}
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
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (161:8) {#if (deleting)}
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

    // (164:8) {#if pending_delete}
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

    // (123:0) {#each $types as type, i}
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
    	let current;
    	let if_block = /*has_error*/ ctx[6] && create_if_block_6(ctx);
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
    				each_blocks_1[i].m(nav, null);
    			}

    			insert(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
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

    			if (dirty & /*pending_delete, deleteType, $types, deleting, Number, saveType, saving, saved, tab*/ 831) {
    				each_value = /*$types*/ ctx[0];
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
    	let saved = false;
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
    			word_limit: 750,
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
    			models = await apiGet(`summaryengine/v1/models`);
    		} catch(e) {
    			$$invalidate(6, has_error = true);
    			$$invalidate(7, error_message = "Unable to connect to OpenAI API. Please check your API key and try again.");
    		}

    		try {
    			// console.log(models);
    			set_store_value(
    				types,
    				$types = (await apiGet(`summaryengine/v1/types`)).map(type => {
    					type.ID = Number(type.ID);
    					type.openai_cut_at_paragraph = Number(type.cut_at_paragraph);
    					type.openai_frequency_penalty = Number(type.openai_frequency_penalty);
    					type.openai_max_tokens = Number(type.openai_max_tokens);
    					type.openai_presence_penalty = Number(type.openai_presence_penalty);
    					type.openai_temperature = Number(type.openai_temperature);
    					type.openai_top_p = Number(type.openai_top_p);
    					type.word_limit = Number(type.word_limit);
    					type.openai_prompt = String(type.openai_prompt) || "";
    					type.openai_append_prompt = String(type.openai_append_prompt) || "";
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
    			type.openai_append_prompt = type.openai_append_prompt || "";
    			type.custom_action = type.custom_action || "";
    			const result = await apiPost(`summaryengine/v1/type/${type.ID}`, type);

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

    			// if (confirm("Are you sure you want to delete this type?")) {
    			await apiDelete(`summaryengine/v1/type/${type.ID}`);

    			set_store_value(types, $types = $types.filter(t => t.ID !== type.ID), $types);
    			$$invalidate(1, tab = 0);

    			// alert("Type deleted");
    			// }
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

    exports.settings = settings;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=summaryengine-types.js.map
