var summaryengine = (function (exports) {
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

    /* src/components/SubmissionsLeft.svelte generated by Svelte v3.52.0 */

    function create_fragment$7(ctx) {
    	let div;
    	let span0;

    	let t0_value = (/*submissions_left*/ ctx[0] === undefined
    	? "..."
    	: /*submissions_left*/ ctx[0]) + "";

    	let t0;
    	let t1;
    	let span1;

    	return {
    		c() {
    			div = element("div");
    			span0 = element("span");
    			t0 = text(t0_value);
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
    			if (dirty & /*submissions_left*/ 1 && t0_value !== (t0_value = (/*submissions_left*/ ctx[0] === undefined
    			? "..."
    			: /*submissions_left*/ ctx[0]) + "")) set_data(t0, t0_value);

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

    function instance$6($$self, $$props, $$invalidate) {
    	let { submissions_left } = $$props;

    	$$self.$$set = $$props => {
    		if ('submissions_left' in $$props) $$invalidate(0, submissions_left = $$props.submissions_left);
    	};

    	return [submissions_left];
    }

    class SubmissionsLeft extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$7, safe_not_equal, { submissions_left: 0 });
    	}
    }

    /* src/components/Navigation.svelte generated by Svelte v3.52.0 */

    function create_if_block$4(ctx) {
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

    function create_fragment$6(ctx) {
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
    	let if_block = /*summary_index*/ ctx[0] != /*current_summary_index*/ ctx[2] && create_if_block$4(ctx);

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
    					if_block = create_if_block$4(ctx);
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

    function instance$5($$self, $$props, $$invalidate) {
    	let { summaries = [] } = $$props;
    	let { summary_index = 0 } = $$props;
    	let { summary_text = "" } = $$props;
    	let { settings = {} } = $$props;
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
    		$$invalidate(7, settings.openai_model = summaries[summary_index].openai_model, settings);
    		$$invalidate(7, settings.openai_max_tokens = Number(summaries[summary_index].max_tokens), settings);
    		$$invalidate(7, settings.openai_temperature = Number(summaries[summary_index].temperature), settings);
    		$$invalidate(7, settings.openai_frequency_penalty = Number(summaries[summary_index].frequency_penalty), settings);
    		$$invalidate(7, settings.openai_presence_penalty = Number(summaries[summary_index].presence_penalty), settings);
    		$$invalidate(7, settings.openai_prompt = summaries[summary_index].prompt, settings);
    		settigns.openai_append_prompt = summaries[summary_index].append_prompt;
    		$$invalidate(7, settings.openai_top_p = Number(summaries[summary_index].top_p), settings);
    		$$invalidate(7, settings);
    		console.log(settings);
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
    		if ('settings' in $$props) $$invalidate(7, settings = $$props.settings);
    		if ('type' in $$props) $$invalidate(8, type = $$props.type);
    	};

    	return [
    		summary_index,
    		summaries,
    		current_summary_index,
    		prev,
    		next,
    		saveCurrentSummary,
    		summary_text,
    		settings,
    		type,
    		set_settings
    	];
    }

    class Navigation extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$5, create_fragment$6, safe_not_equal, {
    			summaries: 1,
    			summary_index: 0,
    			summary_text: 6,
    			settings: 7,
    			type: 8,
    			set_settings: 9
    		});
    	}

    	get set_settings() {
    		return this.$$.ctx[9];
    	}
    }

    /* src/components/Rate.svelte generated by Svelte v3.52.0 */

    function create_else_block$2(ctx) {
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

    function create_fragment$5(ctx) {
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
    		return create_else_block$2;
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

    function instance$4($$self, $$props, $$invalidate) {
    	let { summary_id = 0 } = $$props;
    	let { summary_index = 0 } = $$props;
    	let { summaries = [] } = $$props;
    	let { type = {} } = $$props;
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

    		init(this, options, instance$4, create_fragment$5, safe_not_equal, {
    			summary_id: 4,
    			summary_index: 5,
    			summaries: 3,
    			type: 6
    		});
    	}
    }

    /* src/components/Spinner.svelte generated by Svelte v3.52.0 */

    function create_fragment$4(ctx) {
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
    		init(this, options, null, create_fragment$4, safe_not_equal, {});
    	}
    }

    /* src/components/GenerateSummary.svelte generated by Svelte v3.52.0 */

    function create_else_block$1(ctx) {
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

    // (67:0) {#if !loading}
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

    function create_fragment$3(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$2, create_else_block$1];
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

    function instance$3($$self, $$props, $$invalidate) {
    	let { type } = $$props;
    	let { loading = false } = $$props;
    	let { submissions_left } = $$props;
    	let { summaries = [] } = $$props;
    	let { summary_text = "" } = $$props;
    	let { summary_id = 0 } = $$props;
    	let { summary_index = 0 } = $$props;
    	let { settings = {} } = $$props;

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
    				settings: JSON.stringify(settings),
    				type_id: type.ID
    			});

    			$$invalidate(5, summary_id = response.ID);
    			summaries.unshift(response);
    			$$invalidate(6, summary_index = 0);
    			$$invalidate(3, summaries);
    			$$invalidate(4, summary_text = response.summary.trim());
    			$$invalidate(0, loading = false);
    			$$invalidate(1, submissions_left--, submissions_left);

    			console.log({
    				summary_id,
    				summaries,
    				summary_index,
    				summary_text,
    				submissions_left
    			});

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
    		if ('settings' in $$props) $$invalidate(8, settings = $$props.settings);
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
    		settings
    	];
    }

    class GenerateSummary extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			type: 7,
    			loading: 0,
    			submissions_left: 1,
    			summaries: 3,
    			summary_text: 4,
    			summary_id: 5,
    			summary_index: 6,
    			settings: 8
    		});
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

    function create_if_block$1(ctx) {
    	let div;
    	let table;
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
    	let p2;
    	let t22;
    	let tr4;
    	let th4;
    	let t24;
    	let td4;
    	let input3;
    	let t25;
    	let p3;
    	let t27;
    	let tr5;
    	let th5;
    	let t29;
    	let td5;
    	let input4;
    	let t30;
    	let p4;
    	let t32;
    	let tr6;
    	let th6;
    	let t34;
    	let td6;
    	let input5;
    	let t35;
    	let p5;
    	let t37;
    	let tr7;
    	let th7;
    	let t39;
    	let td7;
    	let input6;
    	let t40;
    	let p6;
    	let div_transition;
    	let current;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			table = element("table");
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
    			th3.textContent = "Max tokens";
    			t19 = space();
    			td3 = element("td");
    			input2 = element("input");
    			t20 = space();
    			p2 = element("p");
    			p2.textContent = "The maximum number of tokens to generate in the completion.";
    			t22 = space();
    			tr4 = element("tr");
    			th4 = element("th");
    			th4.textContent = "Temperature";
    			t24 = space();
    			td4 = element("td");
    			input3 = element("input");
    			t25 = space();
    			p3 = element("p");
    			p3.textContent = "What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. We generally recommend altering this or top_p but not both.";
    			t27 = space();
    			tr5 = element("tr");
    			th5 = element("th");
    			th5.textContent = "Top-P";
    			t29 = space();
    			td5 = element("td");
    			input4 = element("input");
    			t30 = space();
    			p4 = element("p");
    			p4.textContent = "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or temperature but not both.";
    			t32 = space();
    			tr6 = element("tr");
    			th6 = element("th");
    			th6.textContent = "Presence penalty";
    			t34 = space();
    			td6 = element("td");
    			input5 = element("input");
    			t35 = space();
    			p5 = element("p");
    			p5.textContent = "Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.";
    			t37 = space();
    			tr7 = element("tr");
    			th7 = element("th");
    			th7.textContent = "Frequency penalty";
    			t39 = space();
    			td7 = element("td");
    			input6 = element("input");
    			t40 = space();
    			p6 = element("p");
    			p6.textContent = "Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.";
    			attr(th0, "scope", "row");
    			attr(input0, "type", "text");
    			attr(input0, "class", "regular-text");
    			input0.required = true;
    			attr(th1, "scope", "row");
    			attr(input1, "type", "text");
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
    			if (/*settings*/ ctx[0].openai_model === void 0) add_render_callback(() => /*select_change_handler*/ ctx[4].call(select));
    			attr(th3, "scope", "row");
    			attr(input2, "type", "number");
    			attr(input2, "class", "regular-text");
    			attr(input2, "min", "0");
    			attr(input2, "max", "2048");
    			attr(input2, "step", "1");
    			attr(th4, "scope", "row");
    			attr(input3, "type", "number");
    			attr(input3, "class", "regular-text");
    			attr(input3, "min", "0");
    			attr(input3, "max", "1");
    			attr(input3, "step", "0.1");
    			attr(th5, "scope", "row");
    			attr(input4, "type", "number");
    			attr(input4, "class", "regular-text");
    			attr(input4, "min", "0");
    			attr(input4, "max", "1");
    			attr(input4, "step", "0.1");
    			attr(th6, "scope", "row");
    			attr(input5, "type", "number");
    			attr(input5, "class", "regular-text");
    			attr(input5, "min", "-2");
    			attr(input5, "max", "2");
    			attr(input5, "step", "0.1");
    			attr(th7, "scope", "row");
    			attr(input6, "type", "number");
    			attr(input6, "class", "regular-text");
    			attr(input6, "min", "-2");
    			attr(input6, "max", "2");
    			attr(input6, "step", "0.1");
    			attr(table, "class", "form-table");
    			attr(div, "class", "summaryengine-settings");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, table);
    			append(table, tr0);
    			append(tr0, th0);
    			append(tr0, t1);
    			append(tr0, td0);
    			append(td0, input0);
    			set_input_value(input0, /*settings*/ ctx[0].openai_prompt);
    			append(td0, t2);
    			append(td0, p0);
    			append(table, t4);
    			append(table, tr1);
    			append(tr1, th1);
    			append(tr1, t6);
    			append(tr1, td1);
    			append(td1, input1);
    			set_input_value(input1, /*settings*/ ctx[0].openai_append_prompt);
    			append(td1, t7);
    			append(td1, p1);
    			append(table, t9);
    			append(table, tr2);
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
    			append(table, t17);
    			append(table, tr3);
    			append(tr3, th3);
    			append(tr3, t19);
    			append(tr3, td3);
    			append(td3, input2);
    			set_input_value(input2, /*settings*/ ctx[0].openai_max_tokens);
    			append(td3, t20);
    			append(td3, p2);
    			append(table, t22);
    			append(table, tr4);
    			append(tr4, th4);
    			append(tr4, t24);
    			append(tr4, td4);
    			append(td4, input3);
    			set_input_value(input3, /*settings*/ ctx[0].openai_temperature);
    			append(td4, t25);
    			append(td4, p3);
    			append(table, t27);
    			append(table, tr5);
    			append(tr5, th5);
    			append(tr5, t29);
    			append(tr5, td5);
    			append(td5, input4);
    			set_input_value(input4, /*settings*/ ctx[0].openai_top_p);
    			append(td5, t30);
    			append(td5, p4);
    			append(table, t32);
    			append(table, tr6);
    			append(tr6, th6);
    			append(tr6, t34);
    			append(tr6, td6);
    			append(td6, input5);
    			set_input_value(input5, /*settings*/ ctx[0].openai_presence_penalty);
    			append(td6, t35);
    			append(td6, p5);
    			append(table, t37);
    			append(table, tr7);
    			append(tr7, th7);
    			append(tr7, t39);
    			append(tr7, td7);
    			append(td7, input6);
    			set_input_value(input6, /*settings*/ ctx[0].openai_frequency_penalty);
    			append(td7, t40);
    			append(td7, p6);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[2]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[3]),
    					listen(select, "change", /*select_change_handler*/ ctx[4]),
    					listen(input2, "input", /*input2_input_handler*/ ctx[5]),
    					listen(input3, "input", /*input3_input_handler*/ ctx[6]),
    					listen(input4, "input", /*input4_input_handler*/ ctx[7]),
    					listen(input5, "input", /*input5_input_handler*/ ctx[8]),
    					listen(input6, "input", /*input6_input_handler*/ ctx[9])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*settings*/ 1 && input0.value !== /*settings*/ ctx[0].openai_prompt) {
    				set_input_value(input0, /*settings*/ ctx[0].openai_prompt);
    			}

    			if (dirty & /*settings*/ 1 && input1.value !== /*settings*/ ctx[0].openai_append_prompt) {
    				set_input_value(input1, /*settings*/ ctx[0].openai_append_prompt);
    			}

    			if (dirty & /*settings*/ 1) {
    				select_option(select, /*settings*/ ctx[0].openai_model);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input2.value) !== /*settings*/ ctx[0].openai_max_tokens) {
    				set_input_value(input2, /*settings*/ ctx[0].openai_max_tokens);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input3.value) !== /*settings*/ ctx[0].openai_temperature) {
    				set_input_value(input3, /*settings*/ ctx[0].openai_temperature);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input4.value) !== /*settings*/ ctx[0].openai_top_p) {
    				set_input_value(input4, /*settings*/ ctx[0].openai_top_p);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input5.value) !== /*settings*/ ctx[0].openai_presence_penalty) {
    				set_input_value(input5, /*settings*/ ctx[0].openai_presence_penalty);
    			}

    			if (dirty & /*settings*/ 1 && to_number(input6.value) !== /*settings*/ ctx[0].openai_frequency_penalty) {
    				set_input_value(input6, /*settings*/ ctx[0].openai_frequency_penalty);
    			}
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 1000 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!div_transition) div_transition = create_bidirectional_transition(div, slide, { duration: 1000 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching && div_transition) div_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let div;
    	let current;
    	let if_block = /*visible*/ ctx[1] && create_if_block$1(ctx);

    	return {
    		c() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr(div, "class", "summaryengine-settings-container");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*visible*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*visible*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
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
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { settings } = $$props;
    	let { visible = false } = $$props;

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
    		settings.openai_max_tokens = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input3_input_handler() {
    		settings.openai_temperature = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input4_input_handler() {
    		settings.openai_top_p = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input5_input_handler() {
    		settings.openai_presence_penalty = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	function input6_input_handler() {
    		settings.openai_frequency_penalty = to_number(this.value);
    		$$invalidate(0, settings);
    	}

    	$$self.$$set = $$props => {
    		if ('settings' in $$props) $$invalidate(0, settings = $$props.settings);
    		if ('visible' in $$props) $$invalidate(1, visible = $$props.visible);
    	};

    	return [
    		settings,
    		visible,
    		input0_input_handler,
    		input1_input_handler,
    		select_change_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_input_handler,
    		input6_input_handler
    	];
    }

    class Settings extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { settings: 0, visible: 1 });
    	}
    }

    /* src/post_edit/PostReview.svelte generated by Svelte v3.52.0 */

    function create_if_block_6(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "Settings";
    			attr(button, "class", "button summaryengine-settings-button svelte-1fio0o0");
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", prevent_default(/*click_handler*/ ctx[12]));
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

    // (103:4) {:else}
    function create_else_block(ctx) {
    	let settings_1;
    	let updating_settings;
    	let t0;
    	let label;
    	let t2;
    	let t3;
    	let div;
    	let generatesummary;
    	let updating_summary_text;
    	let updating_summary_id;
    	let updating_summary_index;
    	let updating_submissions_left;
    	let updating_summaries;
    	let t4;
    	let submissionsleft;
    	let updating_submissions_left_1;
    	let t5;
    	let t6;
    	let current;

    	function settings_1_settings_binding(value) {
    		/*settings_1_settings_binding*/ ctx[13](value);
    	}

    	let settings_1_props = { visible: /*settings_visible*/ ctx[7] };

    	if (/*settings*/ ctx[6] !== void 0) {
    		settings_1_props.settings = /*settings*/ ctx[6];
    	}

    	settings_1 = new Settings({ props: settings_1_props });
    	binding_callbacks.push(() => bind(settings_1, 'settings', settings_1_settings_binding));

    	function select_block_type_1(ctx, dirty) {
    		if (/*editing*/ ctx[8]) return create_if_block_3;
    		if (/*summary_id*/ ctx[3]) return create_if_block_5;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function generatesummary_summary_text_binding(value) {
    		/*generatesummary_summary_text_binding*/ ctx[17](value);
    	}

    	function generatesummary_summary_id_binding(value) {
    		/*generatesummary_summary_id_binding*/ ctx[18](value);
    	}

    	function generatesummary_summary_index_binding(value) {
    		/*generatesummary_summary_index_binding*/ ctx[19](value);
    	}

    	function generatesummary_submissions_left_binding(value) {
    		/*generatesummary_submissions_left_binding*/ ctx[20](value);
    	}

    	function generatesummary_summaries_binding(value) {
    		/*generatesummary_summaries_binding*/ ctx[21](value);
    	}

    	let generatesummary_props = {
    		type: /*type*/ ctx[0],
    		settings: /*settings*/ ctx[6]
    	};

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
    		/*submissionsleft_submissions_left_binding*/ ctx[22](value);
    	}

    	let submissionsleft_props = { summaries: /*summaries*/ ctx[1] };

    	if (/*submissions_left*/ ctx[5] !== void 0) {
    		submissionsleft_props.submissions_left = /*submissions_left*/ ctx[5];
    	}

    	submissionsleft = new SubmissionsLeft({ props: submissionsleft_props });
    	binding_callbacks.push(() => bind(submissionsleft, 'submissions_left', submissionsleft_submissions_left_binding));
    	let if_block1 = /*summaries*/ ctx[1].length > 1 && create_if_block_2(ctx);
    	let if_block2 = /*summary_id*/ ctx[3] > 0 && create_if_block_1(ctx);

    	return {
    		c() {
    			create_component(settings_1.$$.fragment);
    			t0 = space();
    			label = element("label");
    			label.textContent = "Summary";
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			div = element("div");
    			create_component(generatesummary.$$.fragment);
    			t4 = space();
    			create_component(submissionsleft.$$.fragment);
    			t5 = space();
    			if (if_block1) if_block1.c();
    			t6 = space();
    			if (if_block2) if_block2.c();
    			attr(label, "class", "screen-reader-text");
    			attr(label, "for", "summary");
    			attr(div, "id", "summaryEngineMetaBlockSummariseButtonContainer");
    			attr(div, "class", "svelte-1fio0o0");
    		},
    		m(target, anchor) {
    			mount_component(settings_1, target, anchor);
    			insert(target, t0, anchor);
    			insert(target, label, anchor);
    			insert(target, t2, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t3, anchor);
    			insert(target, div, anchor);
    			mount_component(generatesummary, div, null);
    			append(div, t4);
    			mount_component(submissionsleft, div, null);
    			append(div, t5);
    			if (if_block1) if_block1.m(div, null);
    			append(div, t6);
    			if (if_block2) if_block2.m(div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const settings_1_changes = {};
    			if (dirty & /*settings_visible*/ 128) settings_1_changes.visible = /*settings_visible*/ ctx[7];

    			if (!updating_settings && dirty & /*settings*/ 64) {
    				updating_settings = true;
    				settings_1_changes.settings = /*settings*/ ctx[6];
    				add_flush_callback(() => updating_settings = false);
    			}

    			settings_1.$set(settings_1_changes);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(t3.parentNode, t3);
    				}
    			}

    			const generatesummary_changes = {};
    			if (dirty & /*type*/ 1) generatesummary_changes.type = /*type*/ ctx[0];
    			if (dirty & /*settings*/ 64) generatesummary_changes.settings = /*settings*/ ctx[6];

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
    			if (dirty & /*summaries*/ 2) submissionsleft_changes.summaries = /*summaries*/ ctx[1];

    			if (!updating_submissions_left_1 && dirty & /*submissions_left*/ 32) {
    				updating_submissions_left_1 = true;
    				submissionsleft_changes.submissions_left = /*submissions_left*/ ctx[5];
    				add_flush_callback(() => updating_submissions_left_1 = false);
    			}

    			submissionsleft.$set(submissionsleft_changes);

    			if (/*summaries*/ ctx[1].length > 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*summaries*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(div, t6);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*summary_id*/ ctx[3] > 0) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*summary_id*/ 8) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(div, null);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(settings_1.$$.fragment, local);
    			transition_in(generatesummary.$$.fragment, local);
    			transition_in(submissionsleft.$$.fragment, local);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			current = true;
    		},
    		o(local) {
    			transition_out(settings_1.$$.fragment, local);
    			transition_out(generatesummary.$$.fragment, local);
    			transition_out(submissionsleft.$$.fragment, local);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(settings_1, detaching);
    			if (detaching) detach(t0);
    			if (detaching) detach(label);
    			if (detaching) detach(t2);

    			if (if_block0) {
    				if_block0.d(detaching);
    			}

    			if (detaching) detach(t3);
    			if (detaching) detach(div);
    			destroy_component(generatesummary);
    			destroy_component(submissionsleft);
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};
    }

    // (101:4) {#if loading}
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

    // (115:31) 
    function create_if_block_5(ctx) {
    	let textarea;
    	let t;
    	let input;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			textarea = element("textarea");
    			t = space();
    			input = element("input");
    			attr(textarea, "rows", "1");
    			attr(textarea, "cols", "40");
    			attr(textarea, "id", "summaryEngineSummary");
    			attr(textarea, "class", "summaryengine-textarea svelte-1fio0o0");
    			textarea.value = /*summary_text*/ ctx[2];
    			textarea.readOnly = true;
    			attr(input, "class", "summaryengine-button button");
    			attr(input, "type", "button");
    			attr(input, "name", "edit");
    			input.value = "Edit";
    		},
    		m(target, anchor) {
    			insert(target, textarea, anchor);
    			insert(target, t, anchor);
    			insert(target, input, anchor);

    			if (!mounted) {
    				dispose = listen(input, "click", /*click_handler_2*/ ctx[16]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*summary_text*/ 4) {
    				textarea.value = /*summary_text*/ ctx[2];
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(textarea);
    			if (detaching) detach(t);
    			if (detaching) detach(input);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (107:8) {#if editing}
    function create_if_block_3(ctx) {
    	let textarea;
    	let t;
    	let if_block_anchor;
    	let mounted;
    	let dispose;

    	function select_block_type_2(ctx, dirty) {
    		if (!/*saving*/ ctx[9]) return create_if_block_4;
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
    			attr(textarea, "cols", "40");
    			attr(textarea, "class", "summaryengine-summarise__summary-textarea svelte-1fio0o0");
    		},
    		m(target, anchor) {
    			insert(target, textarea, anchor);
    			set_input_value(textarea, /*summary_text*/ ctx[2]);
    			insert(target, t, anchor);
    			if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = listen(textarea, "input", /*textarea_input_handler*/ ctx[14]);
    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty & /*summary_text*/ 4) {
    				set_input_value(textarea, /*summary_text*/ ctx[2]);
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

    // (112:12) {:else}
    function create_else_block_1(ctx) {
    	let input;

    	return {
    		c() {
    			input = element("input");
    			attr(input, "class", "summaryengine-button button");
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

    // (109:12) {#if (!saving)}
    function create_if_block_4(ctx) {
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
    			attr(input0, "class", "summaryengine-button button");
    			attr(input0, "type", "button");
    			attr(input0, "name", "save");
    			input0.value = "Save";
    			attr(input1, "class", "summaryengine-button button");
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
    					listen(input1, "click", /*click_handler_1*/ ctx[15])
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

    // (122:12) {#if summaries.length > 1}
    function create_if_block_2(ctx) {
    	let navigation;
    	let updating_summary_text;
    	let updating_summary_index;
    	let updating_settings;
    	let current;

    	function navigation_summary_text_binding(value) {
    		/*navigation_summary_text_binding*/ ctx[23](value);
    	}

    	function navigation_summary_index_binding(value) {
    		/*navigation_summary_index_binding*/ ctx[24](value);
    	}

    	function navigation_settings_binding(value) {
    		/*navigation_settings_binding*/ ctx[25](value);
    	}

    	let navigation_props = {
    		summaries: /*summaries*/ ctx[1],
    		type: /*type*/ ctx[0]
    	};

    	if (/*summary_text*/ ctx[2] !== void 0) {
    		navigation_props.summary_text = /*summary_text*/ ctx[2];
    	}

    	if (/*summary_index*/ ctx[4] !== void 0) {
    		navigation_props.summary_index = /*summary_index*/ ctx[4];
    	}

    	if (/*settings*/ ctx[6] !== void 0) {
    		navigation_props.settings = /*settings*/ ctx[6];
    	}

    	navigation = new Navigation({ props: navigation_props });
    	binding_callbacks.push(() => bind(navigation, 'summary_text', navigation_summary_text_binding));
    	binding_callbacks.push(() => bind(navigation, 'summary_index', navigation_summary_index_binding));
    	binding_callbacks.push(() => bind(navigation, 'settings', navigation_settings_binding));

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

    			if (!updating_summary_index && dirty & /*summary_index*/ 16) {
    				updating_summary_index = true;
    				navigation_changes.summary_index = /*summary_index*/ ctx[4];
    				add_flush_callback(() => updating_summary_index = false);
    			}

    			if (!updating_settings && dirty & /*settings*/ 64) {
    				updating_settings = true;
    				navigation_changes.settings = /*settings*/ ctx[6];
    				add_flush_callback(() => updating_settings = false);
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

    // (125:12) {#if summary_id > 0}
    function create_if_block_1(ctx) {
    	let rate;
    	let updating_summaries;
    	let current;

    	function rate_summaries_binding(value) {
    		/*rate_summaries_binding*/ ctx[26](value);
    	}

    	let rate_props = {
    		type: /*type*/ ctx[0],
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
    	let div0;
    	let h3;
    	let t0_value = /*type*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let t2;
    	let current_block_type_index;
    	let if_block1;
    	let current;
    	let if_block0 = !/*loading*/ ctx[10] && create_if_block_6(ctx);
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[10]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			h3 = element("h3");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if_block1.c();
    			attr(div0, "class", "summaryengine-header svelte-1fio0o0");
    			attr(div1, "id", "summaryEngineMetaBlock");
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			append(div0, h3);
    			append(h3, t0);
    			append(div0, t1);
    			if (if_block0) if_block0.m(div0, null);
    			append(div1, t2);
    			if_blocks[current_block_type_index].m(div1, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if ((!current || dirty & /*type*/ 1) && t0_value !== (t0_value = /*type*/ ctx[0].name + "")) set_data(t0, t0_value);

    			if (!/*loading*/ ctx[10]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_6(ctx);
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
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
    				if_block1 = if_blocks[current_block_type_index];

    				if (!if_block1) {
    					if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block1.c();
    				} else {
    					if_block1.p(ctx, dirty);
    				}

    				transition_in(if_block1, 1);
    				if_block1.m(div1, null);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			if (if_block0) if_block0.d();
    			if_blocks[current_block_type_index].d();
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
    	let submissions_left;

    	let settings = {
    		openai_model: "",
    		openai_prompt: "",
    		openai_append_prompt: "",
    		openai_frequency_penalty: 0.5,
    		openai_max_tokens: 300,
    		openai_presence_penalty: 0,
    		openai_temperature: 0.6,
    		openai_top_p: 1
    	};

    	let settings_visible = false;
    	let editing = false;
    	let saving = false;
    	let loading = true;

    	function setSummarySettings(summary) {
    		$$invalidate(6, settings.openai_model = summary.openai_model, settings);
    		$$invalidate(6, settings.openai_prompt = summary.prompt, settings);
    		$$invalidate(6, settings.openai_append_prompt = summary.append_prompt, settings);
    		$$invalidate(6, settings.openai_frequency_penalty = summary.frequency_penalty, settings);
    		$$invalidate(6, settings.openai_max_tokens = summary.max_tokens, settings);
    		$$invalidate(6, settings.openai_presence_penalty = summary.presence_penalty, settings);
    		$$invalidate(6, settings.openai_temperature = summary.temperature, settings);
    		$$invalidate(6, settings.openai_top_p = summary.top_p, settings);
    	}

    	function setDefaultSettings(type) {
    		$$invalidate(6, settings.openai_model = type.openai_model, settings);
    		$$invalidate(6, settings.openai_prompt = type.openai_prompt, settings);
    		$$invalidate(6, settings.openai_append_prompt = type.openai_append_prompt, settings);
    		$$invalidate(6, settings.openai_frequency_penalty = type.openai_frequency_penalty, settings);
    		$$invalidate(6, settings.openai_max_tokens = type.openai_max_tokens, settings);
    		$$invalidate(6, settings.openai_presence_penalty = type.openai_presence_penalty, settings);
    		$$invalidate(6, settings.openai_temperature = type.openai_temperature, settings);
    		$$invalidate(6, settings.openai_top_p = type.openai_top_p, settings);
    	}

    	function calcSubmissionsLeft() {
    		// @ts-ignore
    		const max_summaries = Number(summaryengine_max_number_of_submissions_per_post || 5);

    		$$invalidate(5, submissions_left = max_summaries - summaries.length > 0
    		? max_summaries - summaries.length
    		: 0);
    	}

    	async function save() {
    		try {
    			$$invalidate(9, saving = true);
    			await apiPut(`/summaryengine/v1/summary/${summary_id}`, { summary: summary_text });
    			$$invalidate(8, editing = false);
    			$$invalidate(9, saving = false);
    		} catch(err) {
    			console.error(err);
    			alert("An error occured: " + err);
    			$$invalidate(8, editing = false);
    			$$invalidate(9, saving = false);
    		}
    	}

    	onMount(async () => {
    		try {
    			$$invalidate(1, summaries = await apiGet(`summaryengine/v1/post/${post_id}?type_id=${type.ID}`));
    			const current_summary = await apiGet(`summaryengine/v1/summary/${post_id}?type_id=${type.ID}`);
    			$$invalidate(2, summary_text = current_summary.summary);
    			$$invalidate(3, summary_id = Number(current_summary.summary_id));
    			$$invalidate(4, summary_index = summaries.findIndex(summary => Number(summary.ID) === summary_id));

    			if (summary_index > -1) {
    				setSummarySettings(summaries[summary_index]);
    			} else {
    				setDefaultSettings(type);
    			}

    			calcSubmissionsLeft();
    			$$invalidate(10, loading = false);
    		} catch(e) {
    			console.error(e);
    			alert("An error occured: " + e);
    			$$invalidate(10, loading = false);
    		}
    	});

    	const click_handler = () => $$invalidate(7, settings_visible = !settings_visible);

    	function settings_1_settings_binding(value) {
    		settings = value;
    		$$invalidate(6, settings);
    	}

    	function textarea_input_handler() {
    		summary_text = this.value;
    		$$invalidate(2, summary_text);
    	}

    	const click_handler_1 = () => $$invalidate(8, editing = false);
    	const click_handler_2 = () => $$invalidate(8, editing = true);

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

    	function navigation_summary_index_binding(value) {
    		summary_index = value;
    		$$invalidate(4, summary_index);
    	}

    	function navigation_settings_binding(value) {
    		settings = value;
    		$$invalidate(6, settings);
    	}

    	function rate_summaries_binding(value) {
    		summaries = value;
    		$$invalidate(1, summaries);
    	}

    	$$self.$$set = $$props => {
    		if ('type' in $$props) $$invalidate(0, type = $$props.type);
    	};

    	calcSubmissionsLeft();

    	return [
    		type,
    		summaries,
    		summary_text,
    		summary_id,
    		summary_index,
    		submissions_left,
    		settings,
    		settings_visible,
    		editing,
    		saving,
    		loading,
    		save,
    		click_handler,
    		settings_1_settings_binding,
    		textarea_input_handler,
    		click_handler_1,
    		click_handler_2,
    		generatesummary_summary_text_binding,
    		generatesummary_summary_id_binding,
    		generatesummary_summary_index_binding,
    		generatesummary_submissions_left_binding,
    		generatesummary_summaries_binding,
    		submissionsleft_submissions_left_binding,
    		navigation_summary_text_binding,
    		navigation_summary_index_binding,
    		navigation_settings_binding,
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

    // (18:0) {#each types as type}
    function create_each_block(ctx) {
    	let div;
    	let postreview;
    	let current;
    	postreview = new PostReview({ props: { type: /*type*/ ctx[1] } });

    	return {
    		c() {
    			div = element("div");
    			create_component(postreview.$$.fragment);
    			attr(div, "class", "summaryengine-postreview svelte-4fqltt");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(postreview, div, null);
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
    			if (detaching) detach(div);
    			destroy_component(postreview);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let t0;
    	let div;
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

    			t0 = space();
    			div = element("div");
    			div.innerHTML = `<a href="/wp-admin/admin.php?page=summaryengine">Quickly generate and review summaries for multiple articles here</a>`;
    			attr(div, "class", "summaryengine-link svelte-4fqltt");
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, t0, anchor);
    			insert(target, div, anchor);
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
    						each_blocks[i].m(t0.parentNode, t0);
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
    			if (detaching) detach(t0);
    			if (detaching) detach(div);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let types = [];

    	onMount(async () => {
    		try {
    			$$invalidate(0, types = await apiGet(`/summaryengine/v1/types`));
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
