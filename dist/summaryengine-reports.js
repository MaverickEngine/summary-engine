var summaryengine_admin = (function () {
    'use strict';

    function noop$1() { }
    function assign$1(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
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
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
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
     * Schedules a callback to run immediately after the component has been updated.
     *
     * The first time the callback runs will be after the initial `onMount`
     */
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    /**
     * Schedules a callback to run immediately before the component is unmounted.
     *
     * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
     * only one that runs inside a server-side component.
     *
     * https://svelte.dev/docs#run-time-svelte-ondestroy
     */
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
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

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
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
            update: noop$1,
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
            this.$destroy = noop$1;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop$1;
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

    /*!
     * Chart.js v4.0.1
     * https://www.chartjs.org
     * (c) 2022 Chart.js Contributors
     * Released under the MIT License
     */
    /**
     * @namespace Chart.helpers
     */ /**
     * An empty function that can be used, for example, for optional callback.
     */ function noop() {
    /* noop */ }
    /**
     * Returns a unique id, sequentially generated from a global variable.
     */ const uid = (()=>{
        let id = 0;
        return ()=>id++;
    })();
    /**
     * Returns true if `value` is neither null nor undefined, else returns false.
     * @param value - The value to test.
     * @since 2.7.0
     */ function isNullOrUndef(value) {
        return value === null || typeof value === 'undefined';
    }
    /**
     * Returns true if `value` is an array (including typed arrays), else returns false.
     * @param value - The value to test.
     * @function
     */ function isArray(value) {
        if (Array.isArray && Array.isArray(value)) {
            return true;
        }
        const type = Object.prototype.toString.call(value);
        if (type.slice(0, 7) === '[object' && type.slice(-6) === 'Array]') {
            return true;
        }
        return false;
    }
    /**
     * Returns true if `value` is an object (excluding null), else returns false.
     * @param value - The value to test.
     * @since 2.7.0
     */ function isObject(value) {
        return value !== null && Object.prototype.toString.call(value) === '[object Object]';
    }
    /**
     * Returns true if `value` is a finite number, else returns false
     * @param value  - The value to test.
     */ function isNumberFinite(value) {
        return (typeof value === 'number' || value instanceof Number) && isFinite(+value);
    }
    /**
     * Returns `value` if finite, else returns `defaultValue`.
     * @param value - The value to return if defined.
     * @param defaultValue - The value to return if `value` is not finite.
     */ function finiteOrDefault(value, defaultValue) {
        return isNumberFinite(value) ? value : defaultValue;
    }
    /**
     * Returns `value` if defined, else returns `defaultValue`.
     * @param value - The value to return if defined.
     * @param defaultValue - The value to return if `value` is undefined.
     */ function valueOrDefault(value, defaultValue) {
        return typeof value === 'undefined' ? defaultValue : value;
    }
    const toPercentage = (value, dimension)=>typeof value === 'string' && value.endsWith('%') ? parseFloat(value) / 100 : +value / dimension;
    const toDimension = (value, dimension)=>typeof value === 'string' && value.endsWith('%') ? parseFloat(value) / 100 * dimension : +value;
    /**
     * Calls `fn` with the given `args` in the scope defined by `thisArg` and returns the
     * value returned by `fn`. If `fn` is not a function, this method returns undefined.
     * @param fn - The function to call.
     * @param args - The arguments with which `fn` should be called.
     * @param [thisArg] - The value of `this` provided for the call to `fn`.
     */ function callback(fn, args, thisArg) {
        if (fn && typeof fn.call === 'function') {
            return fn.apply(thisArg, args);
        }
    }
    function each(loopable, fn, thisArg, reverse) {
        let i, len, keys;
        if (isArray(loopable)) {
            len = loopable.length;
            if (reverse) {
                for(i = len - 1; i >= 0; i--){
                    fn.call(thisArg, loopable[i], i);
                }
            } else {
                for(i = 0; i < len; i++){
                    fn.call(thisArg, loopable[i], i);
                }
            }
        } else if (isObject(loopable)) {
            keys = Object.keys(loopable);
            len = keys.length;
            for(i = 0; i < len; i++){
                fn.call(thisArg, loopable[keys[i]], keys[i]);
            }
        }
    }
    /**
     * Returns true if the `a0` and `a1` arrays have the same content, else returns false.
     * @param a0 - The array to compare
     * @param a1 - The array to compare
     * @private
     */ function _elementsEqual(a0, a1) {
        let i, ilen, v0, v1;
        if (!a0 || !a1 || a0.length !== a1.length) {
            return false;
        }
        for(i = 0, ilen = a0.length; i < ilen; ++i){
            v0 = a0[i];
            v1 = a1[i];
            if (v0.datasetIndex !== v1.datasetIndex || v0.index !== v1.index) {
                return false;
            }
        }
        return true;
    }
    /**
     * Returns a deep copy of `source` without keeping references on objects and arrays.
     * @param source - The value to clone.
     */ function clone$1(source) {
        if (isArray(source)) {
            return source.map(clone$1);
        }
        if (isObject(source)) {
            const target = Object.create(null);
            const keys = Object.keys(source);
            const klen = keys.length;
            let k = 0;
            for(; k < klen; ++k){
                target[keys[k]] = clone$1(source[keys[k]]);
            }
            return target;
        }
        return source;
    }
    function isValidKey(key) {
        return [
            '__proto__',
            'prototype',
            'constructor'
        ].indexOf(key) === -1;
    }
    /**
     * The default merger when Chart.helpers.merge is called without merger option.
     * Note(SB): also used by mergeConfig and mergeScaleConfig as fallback.
     * @private
     */ function _merger(key, target, source, options) {
        if (!isValidKey(key)) {
            return;
        }
        const tval = target[key];
        const sval = source[key];
        if (isObject(tval) && isObject(sval)) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            merge(tval, sval, options);
        } else {
            target[key] = clone$1(sval);
        }
    }
    function merge(target, source, options) {
        const sources = isArray(source) ? source : [
            source
        ];
        const ilen = sources.length;
        if (!isObject(target)) {
            return target;
        }
        options = options || {};
        const merger = options.merger || _merger;
        let current;
        for(let i = 0; i < ilen; ++i){
            current = sources[i];
            if (!isObject(current)) {
                continue;
            }
            const keys = Object.keys(current);
            for(let k = 0, klen = keys.length; k < klen; ++k){
                merger(keys[k], target, current, options);
            }
        }
        return target;
    }
    function mergeIf(target, source) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return merge(target, source, {
            merger: _mergerIf
        });
    }
    /**
     * Merges source[key] in target[key] only if target[key] is undefined.
     * @private
     */ function _mergerIf(key, target, source) {
        if (!isValidKey(key)) {
            return;
        }
        const tval = target[key];
        const sval = source[key];
        if (isObject(tval) && isObject(sval)) {
            mergeIf(tval, sval);
        } else if (!Object.prototype.hasOwnProperty.call(target, key)) {
            target[key] = clone$1(sval);
        }
    }
    // resolveObjectKey resolver cache
    const keyResolvers = {
        // Chart.helpers.core resolveObjectKey should resolve empty key to root object
        '': (v)=>v,
        // default resolvers
        x: (o)=>o.x,
        y: (o)=>o.y
    };
    /**
     * @private
     */ function _splitKey(key) {
        const parts = key.split('.');
        const keys = [];
        let tmp = '';
        for (const part of parts){
            tmp += part;
            if (tmp.endsWith('\\')) {
                tmp = tmp.slice(0, -1) + '.';
            } else {
                keys.push(tmp);
                tmp = '';
            }
        }
        return keys;
    }
    function _getKeyResolver(key) {
        const keys = _splitKey(key);
        return (obj)=>{
            for (const k of keys){
                if (k === '') {
                    break;
                }
                obj = obj && obj[k];
            }
            return obj;
        };
    }
    function resolveObjectKey(obj, key) {
        const resolver = keyResolvers[key] || (keyResolvers[key] = _getKeyResolver(key));
        return resolver(obj);
    }
    /**
     * @private
     */ function _capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    const defined = (value)=>typeof value !== 'undefined';
    const isFunction = (value)=>typeof value === 'function';
    // Adapted from https://stackoverflow.com/questions/31128855/comparing-ecma6-sets-for-equality#31129384
    const setsEqual = (a, b)=>{
        if (a.size !== b.size) {
            return false;
        }
        for (const item of a){
            if (!b.has(item)) {
                return false;
            }
        }
        return true;
    };
    /**
     * @param e - The event
     * @private
     */ function _isClickEvent(e) {
        return e.type === 'mouseup' || e.type === 'click' || e.type === 'contextmenu';
    }

    /**
     * @alias Chart.helpers.math
     * @namespace
     */ const PI = Math.PI;
    const TAU = 2 * PI;
    const PITAU = TAU + PI;
    const INFINITY = Number.POSITIVE_INFINITY;
    const RAD_PER_DEG = PI / 180;
    const HALF_PI = PI / 2;
    const QUARTER_PI = PI / 4;
    const TWO_THIRDS_PI = PI * 2 / 3;
    const log10 = Math.log10;
    const sign = Math.sign;
    function almostEquals(x, y, epsilon) {
        return Math.abs(x - y) < epsilon;
    }
    /**
     * Implementation of the nice number algorithm used in determining where axis labels will go
     */ function niceNum(range) {
        const roundedRange = Math.round(range);
        range = almostEquals(range, roundedRange, range / 1000) ? roundedRange : range;
        const niceRange = Math.pow(10, Math.floor(log10(range)));
        const fraction = range / niceRange;
        const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
        return niceFraction * niceRange;
    }
    /**
     * Returns an array of factors sorted from 1 to sqrt(value)
     * @private
     */ function _factorize(value) {
        const result = [];
        const sqrt = Math.sqrt(value);
        let i;
        for(i = 1; i < sqrt; i++){
            if (value % i === 0) {
                result.push(i);
                result.push(value / i);
            }
        }
        if (sqrt === (sqrt | 0)) {
            result.push(sqrt);
        }
        result.sort((a, b)=>a - b).pop();
        return result;
    }
    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
    function almostWhole(x, epsilon) {
        const rounded = Math.round(x);
        return rounded - epsilon <= x && rounded + epsilon >= x;
    }
    /**
     * @private
     */ function _setMinAndMaxByKey(array, target, property) {
        let i, ilen, value;
        for(i = 0, ilen = array.length; i < ilen; i++){
            value = array[i][property];
            if (!isNaN(value)) {
                target.min = Math.min(target.min, value);
                target.max = Math.max(target.max, value);
            }
        }
    }
    function toRadians(degrees) {
        return degrees * (PI / 180);
    }
    function toDegrees(radians) {
        return radians * (180 / PI);
    }
    /**
     * Returns the number of decimal places
     * i.e. the number of digits after the decimal point, of the value of this Number.
     * @param x - A number.
     * @returns The number of decimal places.
     * @private
     */ function _decimalPlaces(x) {
        if (!isNumberFinite(x)) {
            return;
        }
        let e = 1;
        let p = 0;
        while(Math.round(x * e) / e !== x){
            e *= 10;
            p++;
        }
        return p;
    }
    // Gets the angle from vertical upright to the point about a centre.
    function getAngleFromPoint(centrePoint, anglePoint) {
        const distanceFromXCenter = anglePoint.x - centrePoint.x;
        const distanceFromYCenter = anglePoint.y - centrePoint.y;
        const radialDistanceFromCenter = Math.sqrt(distanceFromXCenter * distanceFromXCenter + distanceFromYCenter * distanceFromYCenter);
        let angle = Math.atan2(distanceFromYCenter, distanceFromXCenter);
        if (angle < -0.5 * PI) {
            angle += TAU; // make sure the returned angle is in the range of (-PI/2, 3PI/2]
        }
        return {
            angle,
            distance: radialDistanceFromCenter
        };
    }
    function distanceBetweenPoints(pt1, pt2) {
        return Math.sqrt(Math.pow(pt2.x - pt1.x, 2) + Math.pow(pt2.y - pt1.y, 2));
    }
    /**
     * Shortest distance between angles, in either direction.
     * @private
     */ function _angleDiff(a, b) {
        return (a - b + PITAU) % TAU - PI;
    }
    /**
     * Normalize angle to be between 0 and 2*PI
     * @private
     */ function _normalizeAngle(a) {
        return (a % TAU + TAU) % TAU;
    }
    /**
     * @private
     */ function _angleBetween(angle, start, end, sameAngleIsFullCircle) {
        const a = _normalizeAngle(angle);
        const s = _normalizeAngle(start);
        const e = _normalizeAngle(end);
        const angleToStart = _normalizeAngle(s - a);
        const angleToEnd = _normalizeAngle(e - a);
        const startToAngle = _normalizeAngle(a - s);
        const endToAngle = _normalizeAngle(a - e);
        return a === s || a === e || sameAngleIsFullCircle && s === e || angleToStart > angleToEnd && startToAngle < endToAngle;
    }
    /**
     * Limit `value` between `min` and `max`
     * @param value
     * @param min
     * @param max
     * @private
     */ function _limitValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    /**
     * @param {number} value
     * @private
     */ function _int16Range(value) {
        return _limitValue(value, -32768, 32767);
    }
    /**
     * @param value
     * @param start
     * @param end
     * @param [epsilon]
     * @private
     */ function _isBetween(value, start, end, epsilon = 1e-6) {
        return value >= Math.min(start, end) - epsilon && value <= Math.max(start, end) + epsilon;
    }

    function _lookup(table, value, cmp) {
        cmp = cmp || ((index)=>table[index] < value);
        let hi = table.length - 1;
        let lo = 0;
        let mid;
        while(hi - lo > 1){
            mid = lo + hi >> 1;
            if (cmp(mid)) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return {
            lo,
            hi
        };
    }
    /**
     * Binary search
     * @param table - the table search. must be sorted!
     * @param key - property name for the value in each entry
     * @param value - value to find
     * @param last - lookup last index
     * @private
     */ const _lookupByKey = (table, key, value, last)=>_lookup(table, value, last ? (index)=>{
            const ti = table[index][key];
            return ti < value || ti === value && table[index + 1][key] === value;
        } : (index)=>table[index][key] < value);
    /**
     * Reverse binary search
     * @param table - the table search. must be sorted!
     * @param key - property name for the value in each entry
     * @param value - value to find
     * @private
     */ const _rlookupByKey = (table, key, value)=>_lookup(table, value, (index)=>table[index][key] >= value);
    /**
     * Return subset of `values` between `min` and `max` inclusive.
     * Values are assumed to be in sorted order.
     * @param values - sorted array of values
     * @param min - min value
     * @param max - max value
     */ function _filterBetween(values, min, max) {
        let start = 0;
        let end = values.length;
        while(start < end && values[start] < min){
            start++;
        }
        while(end > start && values[end - 1] > max){
            end--;
        }
        return start > 0 || end < values.length ? values.slice(start, end) : values;
    }
    const arrayEvents = [
        'push',
        'pop',
        'shift',
        'splice',
        'unshift'
    ];
    function listenArrayEvents(array, listener) {
        if (array._chartjs) {
            array._chartjs.listeners.push(listener);
            return;
        }
        Object.defineProperty(array, '_chartjs', {
            configurable: true,
            enumerable: false,
            value: {
                listeners: [
                    listener
                ]
            }
        });
        arrayEvents.forEach((key)=>{
            const method = '_onData' + _capitalize(key);
            const base = array[key];
            Object.defineProperty(array, key, {
                configurable: true,
                enumerable: false,
                value (...args) {
                    const res = base.apply(this, args);
                    array._chartjs.listeners.forEach((object)=>{
                        if (typeof object[method] === 'function') {
                            object[method](...args);
                        }
                    });
                    return res;
                }
            });
        });
    }
    function unlistenArrayEvents(array, listener) {
        const stub = array._chartjs;
        if (!stub) {
            return;
        }
        const listeners = stub.listeners;
        const index = listeners.indexOf(listener);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
        if (listeners.length > 0) {
            return;
        }
        arrayEvents.forEach((key)=>{
            delete array[key];
        });
        delete array._chartjs;
    }
    /**
     * @param items
     */ function _arrayUnique(items) {
        const set = new Set();
        let i, ilen;
        for(i = 0, ilen = items.length; i < ilen; ++i){
            set.add(items[i]);
        }
        if (set.size === ilen) {
            return items;
        }
        return Array.from(set);
    }
    /**
    * Request animation polyfill
    */ const requestAnimFrame = function() {
        if (typeof window === 'undefined') {
            return function(callback) {
                return callback();
            };
        }
        return window.requestAnimationFrame;
    }();
    /**
     * Throttles calling `fn` once per animation frame
     * Latest arguments are used on the actual call
     */ function throttled(fn, thisArg) {
        let ticking = false;
        return function(...args) {
            if (!ticking) {
                ticking = true;
                requestAnimFrame.call(window, ()=>{
                    ticking = false;
                    fn.apply(thisArg, args);
                });
            }
        };
    }
    /**
     * Debounces calling `fn` for `delay` ms
     */ function debounce(fn, delay) {
        let timeout;
        return function(...args) {
            if (delay) {
                clearTimeout(timeout);
                timeout = setTimeout(fn, delay, args);
            } else {
                fn.apply(this, args);
            }
            return delay;
        };
    }
    /**
     * Converts 'start' to 'left', 'end' to 'right' and others to 'center'
     * @private
     */ const _toLeftRightCenter = (align)=>align === 'start' ? 'left' : align === 'end' ? 'right' : 'center';
    /**
     * Returns `start`, `end` or `(start + end) / 2` depending on `align`. Defaults to `center`
     * @private
     */ const _alignStartEnd = (align, start, end)=>align === 'start' ? start : align === 'end' ? end : (start + end) / 2;
    /**
     * Returns `left`, `right` or `(left + right) / 2` depending on `align`. Defaults to `left`
     * @private
     */ const _textX = (align, left, right, rtl)=>{
        const check = rtl ? 'left' : 'right';
        return align === check ? right : align === 'center' ? (left + right) / 2 : left;
    };

    const atEdge = (t)=>t === 0 || t === 1;
    const elasticIn = (t, s, p)=>-(Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * TAU / p));
    const elasticOut = (t, s, p)=>Math.pow(2, -10 * t) * Math.sin((t - s) * TAU / p) + 1;
    /**
     * Easing functions adapted from Robert Penner's easing equations.
     * @namespace Chart.helpers.easing.effects
     * @see http://www.robertpenner.com/easing/
     */ const effects = {
        linear: (t)=>t,
        easeInQuad: (t)=>t * t,
        easeOutQuad: (t)=>-t * (t - 2),
        easeInOutQuad: (t)=>(t /= 0.5) < 1 ? 0.5 * t * t : -0.5 * (--t * (t - 2) - 1),
        easeInCubic: (t)=>t * t * t,
        easeOutCubic: (t)=>(t -= 1) * t * t + 1,
        easeInOutCubic: (t)=>(t /= 0.5) < 1 ? 0.5 * t * t * t : 0.5 * ((t -= 2) * t * t + 2),
        easeInQuart: (t)=>t * t * t * t,
        easeOutQuart: (t)=>-((t -= 1) * t * t * t - 1),
        easeInOutQuart: (t)=>(t /= 0.5) < 1 ? 0.5 * t * t * t * t : -0.5 * ((t -= 2) * t * t * t - 2),
        easeInQuint: (t)=>t * t * t * t * t,
        easeOutQuint: (t)=>(t -= 1) * t * t * t * t + 1,
        easeInOutQuint: (t)=>(t /= 0.5) < 1 ? 0.5 * t * t * t * t * t : 0.5 * ((t -= 2) * t * t * t * t + 2),
        easeInSine: (t)=>-Math.cos(t * HALF_PI) + 1,
        easeOutSine: (t)=>Math.sin(t * HALF_PI),
        easeInOutSine: (t)=>-0.5 * (Math.cos(PI * t) - 1),
        easeInExpo: (t)=>t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
        easeOutExpo: (t)=>t === 1 ? 1 : -Math.pow(2, -10 * t) + 1,
        easeInOutExpo: (t)=>atEdge(t) ? t : t < 0.5 ? 0.5 * Math.pow(2, 10 * (t * 2 - 1)) : 0.5 * (-Math.pow(2, -10 * (t * 2 - 1)) + 2),
        easeInCirc: (t)=>t >= 1 ? t : -(Math.sqrt(1 - t * t) - 1),
        easeOutCirc: (t)=>Math.sqrt(1 - (t -= 1) * t),
        easeInOutCirc: (t)=>(t /= 0.5) < 1 ? -0.5 * (Math.sqrt(1 - t * t) - 1) : 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1),
        easeInElastic: (t)=>atEdge(t) ? t : elasticIn(t, 0.075, 0.3),
        easeOutElastic: (t)=>atEdge(t) ? t : elasticOut(t, 0.075, 0.3),
        easeInOutElastic (t) {
            const s = 0.1125;
            const p = 0.45;
            return atEdge(t) ? t : t < 0.5 ? 0.5 * elasticIn(t * 2, s, p) : 0.5 + 0.5 * elasticOut(t * 2 - 1, s, p);
        },
        easeInBack (t) {
            const s = 1.70158;
            return t * t * ((s + 1) * t - s);
        },
        easeOutBack (t) {
            const s = 1.70158;
            return (t -= 1) * t * ((s + 1) * t + s) + 1;
        },
        easeInOutBack (t) {
            let s = 1.70158;
            if ((t /= 0.5) < 1) {
                return 0.5 * (t * t * (((s *= 1.525) + 1) * t - s));
            }
            return 0.5 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2);
        },
        easeInBounce: (t)=>1 - effects.easeOutBounce(1 - t),
        easeOutBounce (t) {
            const m = 7.5625;
            const d = 2.75;
            if (t < 1 / d) {
                return m * t * t;
            }
            if (t < 2 / d) {
                return m * (t -= 1.5 / d) * t + 0.75;
            }
            if (t < 2.5 / d) {
                return m * (t -= 2.25 / d) * t + 0.9375;
            }
            return m * (t -= 2.625 / d) * t + 0.984375;
        },
        easeInOutBounce: (t)=>t < 0.5 ? effects.easeInBounce(t * 2) * 0.5 : effects.easeOutBounce(t * 2 - 1) * 0.5 + 0.5
    };
    var effects$1 = effects;

    /*!
     * @kurkle/color v0.2.1
     * https://github.com/kurkle/color#readme
     * (c) 2022 Jukka Kurkela
     * Released under the MIT License
     */
    function round(v) {
      return v + 0.5 | 0;
    }
    const lim = (v, l, h) => Math.max(Math.min(v, h), l);
    function p2b(v) {
      return lim(round(v * 2.55), 0, 255);
    }
    function n2b(v) {
      return lim(round(v * 255), 0, 255);
    }
    function b2n(v) {
      return lim(round(v / 2.55) / 100, 0, 1);
    }
    function n2p(v) {
      return lim(round(v * 100), 0, 100);
    }
    const map$1 = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, a: 10, b: 11, c: 12, d: 13, e: 14, f: 15};
    const hex = [...'0123456789ABCDEF'];
    const h1 = b => hex[b & 0xF];
    const h2 = b => hex[(b & 0xF0) >> 4] + hex[b & 0xF];
    const eq = b => ((b & 0xF0) >> 4) === (b & 0xF);
    const isShort = v => eq(v.r) && eq(v.g) && eq(v.b) && eq(v.a);
    function hexParse(str) {
      var len = str.length;
      var ret;
      if (str[0] === '#') {
        if (len === 4 || len === 5) {
          ret = {
            r: 255 & map$1[str[1]] * 17,
            g: 255 & map$1[str[2]] * 17,
            b: 255 & map$1[str[3]] * 17,
            a: len === 5 ? map$1[str[4]] * 17 : 255
          };
        } else if (len === 7 || len === 9) {
          ret = {
            r: map$1[str[1]] << 4 | map$1[str[2]],
            g: map$1[str[3]] << 4 | map$1[str[4]],
            b: map$1[str[5]] << 4 | map$1[str[6]],
            a: len === 9 ? (map$1[str[7]] << 4 | map$1[str[8]]) : 255
          };
        }
      }
      return ret;
    }
    const alpha = (a, f) => a < 255 ? f(a) : '';
    function hexString(v) {
      var f = isShort(v) ? h1 : h2;
      return v
        ? '#' + f(v.r) + f(v.g) + f(v.b) + alpha(v.a, f)
        : undefined;
    }
    const HUE_RE = /^(hsla?|hwb|hsv)\(\s*([-+.e\d]+)(?:deg)?[\s,]+([-+.e\d]+)%[\s,]+([-+.e\d]+)%(?:[\s,]+([-+.e\d]+)(%)?)?\s*\)$/;
    function hsl2rgbn(h, s, l) {
      const a = s * Math.min(l, 1 - l);
      const f = (n, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return [f(0), f(8), f(4)];
    }
    function hsv2rgbn(h, s, v) {
      const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
      return [f(5), f(3), f(1)];
    }
    function hwb2rgbn(h, w, b) {
      const rgb = hsl2rgbn(h, 1, 0.5);
      let i;
      if (w + b > 1) {
        i = 1 / (w + b);
        w *= i;
        b *= i;
      }
      for (i = 0; i < 3; i++) {
        rgb[i] *= 1 - w - b;
        rgb[i] += w;
      }
      return rgb;
    }
    function hueValue(r, g, b, d, max) {
      if (r === max) {
        return ((g - b) / d) + (g < b ? 6 : 0);
      }
      if (g === max) {
        return (b - r) / d + 2;
      }
      return (r - g) / d + 4;
    }
    function rgb2hsl(v) {
      const range = 255;
      const r = v.r / range;
      const g = v.g / range;
      const b = v.b / range;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h, s, d;
      if (max !== min) {
        d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = hueValue(r, g, b, d, max);
        h = h * 60 + 0.5;
      }
      return [h | 0, s || 0, l];
    }
    function calln(f, a, b, c) {
      return (
        Array.isArray(a)
          ? f(a[0], a[1], a[2])
          : f(a, b, c)
      ).map(n2b);
    }
    function hsl2rgb(h, s, l) {
      return calln(hsl2rgbn, h, s, l);
    }
    function hwb2rgb(h, w, b) {
      return calln(hwb2rgbn, h, w, b);
    }
    function hsv2rgb(h, s, v) {
      return calln(hsv2rgbn, h, s, v);
    }
    function hue(h) {
      return (h % 360 + 360) % 360;
    }
    function hueParse(str) {
      const m = HUE_RE.exec(str);
      let a = 255;
      let v;
      if (!m) {
        return;
      }
      if (m[5] !== v) {
        a = m[6] ? p2b(+m[5]) : n2b(+m[5]);
      }
      const h = hue(+m[2]);
      const p1 = +m[3] / 100;
      const p2 = +m[4] / 100;
      if (m[1] === 'hwb') {
        v = hwb2rgb(h, p1, p2);
      } else if (m[1] === 'hsv') {
        v = hsv2rgb(h, p1, p2);
      } else {
        v = hsl2rgb(h, p1, p2);
      }
      return {
        r: v[0],
        g: v[1],
        b: v[2],
        a: a
      };
    }
    function rotate(v, deg) {
      var h = rgb2hsl(v);
      h[0] = hue(h[0] + deg);
      h = hsl2rgb(h);
      v.r = h[0];
      v.g = h[1];
      v.b = h[2];
    }
    function hslString(v) {
      if (!v) {
        return;
      }
      const a = rgb2hsl(v);
      const h = a[0];
      const s = n2p(a[1]);
      const l = n2p(a[2]);
      return v.a < 255
        ? `hsla(${h}, ${s}%, ${l}%, ${b2n(v.a)})`
        : `hsl(${h}, ${s}%, ${l}%)`;
    }
    const map = {
      x: 'dark',
      Z: 'light',
      Y: 're',
      X: 'blu',
      W: 'gr',
      V: 'medium',
      U: 'slate',
      A: 'ee',
      T: 'ol',
      S: 'or',
      B: 'ra',
      C: 'lateg',
      D: 'ights',
      R: 'in',
      Q: 'turquois',
      E: 'hi',
      P: 'ro',
      O: 'al',
      N: 'le',
      M: 'de',
      L: 'yello',
      F: 'en',
      K: 'ch',
      G: 'arks',
      H: 'ea',
      I: 'ightg',
      J: 'wh'
    };
    const names$1 = {
      OiceXe: 'f0f8ff',
      antiquewEte: 'faebd7',
      aqua: 'ffff',
      aquamarRe: '7fffd4',
      azuY: 'f0ffff',
      beige: 'f5f5dc',
      bisque: 'ffe4c4',
      black: '0',
      blanKedOmond: 'ffebcd',
      Xe: 'ff',
      XeviTet: '8a2be2',
      bPwn: 'a52a2a',
      burlywood: 'deb887',
      caMtXe: '5f9ea0',
      KartYuse: '7fff00',
      KocTate: 'd2691e',
      cSO: 'ff7f50',
      cSnflowerXe: '6495ed',
      cSnsilk: 'fff8dc',
      crimson: 'dc143c',
      cyan: 'ffff',
      xXe: '8b',
      xcyan: '8b8b',
      xgTMnPd: 'b8860b',
      xWay: 'a9a9a9',
      xgYF: '6400',
      xgYy: 'a9a9a9',
      xkhaki: 'bdb76b',
      xmagFta: '8b008b',
      xTivegYF: '556b2f',
      xSange: 'ff8c00',
      xScEd: '9932cc',
      xYd: '8b0000',
      xsOmon: 'e9967a',
      xsHgYF: '8fbc8f',
      xUXe: '483d8b',
      xUWay: '2f4f4f',
      xUgYy: '2f4f4f',
      xQe: 'ced1',
      xviTet: '9400d3',
      dAppRk: 'ff1493',
      dApskyXe: 'bfff',
      dimWay: '696969',
      dimgYy: '696969',
      dodgerXe: '1e90ff',
      fiYbrick: 'b22222',
      flSOwEte: 'fffaf0',
      foYstWAn: '228b22',
      fuKsia: 'ff00ff',
      gaRsbSo: 'dcdcdc',
      ghostwEte: 'f8f8ff',
      gTd: 'ffd700',
      gTMnPd: 'daa520',
      Way: '808080',
      gYF: '8000',
      gYFLw: 'adff2f',
      gYy: '808080',
      honeyMw: 'f0fff0',
      hotpRk: 'ff69b4',
      RdianYd: 'cd5c5c',
      Rdigo: '4b0082',
      ivSy: 'fffff0',
      khaki: 'f0e68c',
      lavFMr: 'e6e6fa',
      lavFMrXsh: 'fff0f5',
      lawngYF: '7cfc00',
      NmoncEffon: 'fffacd',
      ZXe: 'add8e6',
      ZcSO: 'f08080',
      Zcyan: 'e0ffff',
      ZgTMnPdLw: 'fafad2',
      ZWay: 'd3d3d3',
      ZgYF: '90ee90',
      ZgYy: 'd3d3d3',
      ZpRk: 'ffb6c1',
      ZsOmon: 'ffa07a',
      ZsHgYF: '20b2aa',
      ZskyXe: '87cefa',
      ZUWay: '778899',
      ZUgYy: '778899',
      ZstAlXe: 'b0c4de',
      ZLw: 'ffffe0',
      lime: 'ff00',
      limegYF: '32cd32',
      lRF: 'faf0e6',
      magFta: 'ff00ff',
      maPon: '800000',
      VaquamarRe: '66cdaa',
      VXe: 'cd',
      VScEd: 'ba55d3',
      VpurpN: '9370db',
      VsHgYF: '3cb371',
      VUXe: '7b68ee',
      VsprRggYF: 'fa9a',
      VQe: '48d1cc',
      VviTetYd: 'c71585',
      midnightXe: '191970',
      mRtcYam: 'f5fffa',
      mistyPse: 'ffe4e1',
      moccasR: 'ffe4b5',
      navajowEte: 'ffdead',
      navy: '80',
      Tdlace: 'fdf5e6',
      Tive: '808000',
      TivedBb: '6b8e23',
      Sange: 'ffa500',
      SangeYd: 'ff4500',
      ScEd: 'da70d6',
      pOegTMnPd: 'eee8aa',
      pOegYF: '98fb98',
      pOeQe: 'afeeee',
      pOeviTetYd: 'db7093',
      papayawEp: 'ffefd5',
      pHKpuff: 'ffdab9',
      peru: 'cd853f',
      pRk: 'ffc0cb',
      plum: 'dda0dd',
      powMrXe: 'b0e0e6',
      purpN: '800080',
      YbeccapurpN: '663399',
      Yd: 'ff0000',
      Psybrown: 'bc8f8f',
      PyOXe: '4169e1',
      saddNbPwn: '8b4513',
      sOmon: 'fa8072',
      sandybPwn: 'f4a460',
      sHgYF: '2e8b57',
      sHshell: 'fff5ee',
      siFna: 'a0522d',
      silver: 'c0c0c0',
      skyXe: '87ceeb',
      UXe: '6a5acd',
      UWay: '708090',
      UgYy: '708090',
      snow: 'fffafa',
      sprRggYF: 'ff7f',
      stAlXe: '4682b4',
      tan: 'd2b48c',
      teO: '8080',
      tEstN: 'd8bfd8',
      tomato: 'ff6347',
      Qe: '40e0d0',
      viTet: 'ee82ee',
      JHt: 'f5deb3',
      wEte: 'ffffff',
      wEtesmoke: 'f5f5f5',
      Lw: 'ffff00',
      LwgYF: '9acd32'
    };
    function unpack() {
      const unpacked = {};
      const keys = Object.keys(names$1);
      const tkeys = Object.keys(map);
      let i, j, k, ok, nk;
      for (i = 0; i < keys.length; i++) {
        ok = nk = keys[i];
        for (j = 0; j < tkeys.length; j++) {
          k = tkeys[j];
          nk = nk.replace(k, map[k]);
        }
        k = parseInt(names$1[ok], 16);
        unpacked[nk] = [k >> 16 & 0xFF, k >> 8 & 0xFF, k & 0xFF];
      }
      return unpacked;
    }
    let names;
    function nameParse(str) {
      if (!names) {
        names = unpack();
        names.transparent = [0, 0, 0, 0];
      }
      const a = names[str.toLowerCase()];
      return a && {
        r: a[0],
        g: a[1],
        b: a[2],
        a: a.length === 4 ? a[3] : 255
      };
    }
    const RGB_RE = /^rgba?\(\s*([-+.\d]+)(%)?[\s,]+([-+.e\d]+)(%)?[\s,]+([-+.e\d]+)(%)?(?:[\s,/]+([-+.e\d]+)(%)?)?\s*\)$/;
    function rgbParse(str) {
      const m = RGB_RE.exec(str);
      let a = 255;
      let r, g, b;
      if (!m) {
        return;
      }
      if (m[7] !== r) {
        const v = +m[7];
        a = m[8] ? p2b(v) : lim(v * 255, 0, 255);
      }
      r = +m[1];
      g = +m[3];
      b = +m[5];
      r = 255 & (m[2] ? p2b(r) : lim(r, 0, 255));
      g = 255 & (m[4] ? p2b(g) : lim(g, 0, 255));
      b = 255 & (m[6] ? p2b(b) : lim(b, 0, 255));
      return {
        r: r,
        g: g,
        b: b,
        a: a
      };
    }
    function rgbString(v) {
      return v && (
        v.a < 255
          ? `rgba(${v.r}, ${v.g}, ${v.b}, ${b2n(v.a)})`
          : `rgb(${v.r}, ${v.g}, ${v.b})`
      );
    }
    const to = v => v <= 0.0031308 ? v * 12.92 : Math.pow(v, 1.0 / 2.4) * 1.055 - 0.055;
    const from = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    function interpolate$1(rgb1, rgb2, t) {
      const r = from(b2n(rgb1.r));
      const g = from(b2n(rgb1.g));
      const b = from(b2n(rgb1.b));
      return {
        r: n2b(to(r + t * (from(b2n(rgb2.r)) - r))),
        g: n2b(to(g + t * (from(b2n(rgb2.g)) - g))),
        b: n2b(to(b + t * (from(b2n(rgb2.b)) - b))),
        a: rgb1.a + t * (rgb2.a - rgb1.a)
      };
    }
    function modHSL(v, i, ratio) {
      if (v) {
        let tmp = rgb2hsl(v);
        tmp[i] = Math.max(0, Math.min(tmp[i] + tmp[i] * ratio, i === 0 ? 360 : 1));
        tmp = hsl2rgb(tmp);
        v.r = tmp[0];
        v.g = tmp[1];
        v.b = tmp[2];
      }
    }
    function clone(v, proto) {
      return v ? Object.assign(proto || {}, v) : v;
    }
    function fromObject(input) {
      var v = {r: 0, g: 0, b: 0, a: 255};
      if (Array.isArray(input)) {
        if (input.length >= 3) {
          v = {r: input[0], g: input[1], b: input[2], a: 255};
          if (input.length > 3) {
            v.a = n2b(input[3]);
          }
        }
      } else {
        v = clone(input, {r: 0, g: 0, b: 0, a: 1});
        v.a = n2b(v.a);
      }
      return v;
    }
    function functionParse(str) {
      if (str.charAt(0) === 'r') {
        return rgbParse(str);
      }
      return hueParse(str);
    }
    class Color {
      constructor(input) {
        if (input instanceof Color) {
          return input;
        }
        const type = typeof input;
        let v;
        if (type === 'object') {
          v = fromObject(input);
        } else if (type === 'string') {
          v = hexParse(input) || nameParse(input) || functionParse(input);
        }
        this._rgb = v;
        this._valid = !!v;
      }
      get valid() {
        return this._valid;
      }
      get rgb() {
        var v = clone(this._rgb);
        if (v) {
          v.a = b2n(v.a);
        }
        return v;
      }
      set rgb(obj) {
        this._rgb = fromObject(obj);
      }
      rgbString() {
        return this._valid ? rgbString(this._rgb) : undefined;
      }
      hexString() {
        return this._valid ? hexString(this._rgb) : undefined;
      }
      hslString() {
        return this._valid ? hslString(this._rgb) : undefined;
      }
      mix(color, weight) {
        if (color) {
          const c1 = this.rgb;
          const c2 = color.rgb;
          let w2;
          const p = weight === w2 ? 0.5 : weight;
          const w = 2 * p - 1;
          const a = c1.a - c2.a;
          const w1 = ((w * a === -1 ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
          w2 = 1 - w1;
          c1.r = 0xFF & w1 * c1.r + w2 * c2.r + 0.5;
          c1.g = 0xFF & w1 * c1.g + w2 * c2.g + 0.5;
          c1.b = 0xFF & w1 * c1.b + w2 * c2.b + 0.5;
          c1.a = p * c1.a + (1 - p) * c2.a;
          this.rgb = c1;
        }
        return this;
      }
      interpolate(color, t) {
        if (color) {
          this._rgb = interpolate$1(this._rgb, color._rgb, t);
        }
        return this;
      }
      clone() {
        return new Color(this.rgb);
      }
      alpha(a) {
        this._rgb.a = n2b(a);
        return this;
      }
      clearer(ratio) {
        const rgb = this._rgb;
        rgb.a *= 1 - ratio;
        return this;
      }
      greyscale() {
        const rgb = this._rgb;
        const val = round(rgb.r * 0.3 + rgb.g * 0.59 + rgb.b * 0.11);
        rgb.r = rgb.g = rgb.b = val;
        return this;
      }
      opaquer(ratio) {
        const rgb = this._rgb;
        rgb.a *= 1 + ratio;
        return this;
      }
      negate() {
        const v = this._rgb;
        v.r = 255 - v.r;
        v.g = 255 - v.g;
        v.b = 255 - v.b;
        return this;
      }
      lighten(ratio) {
        modHSL(this._rgb, 2, ratio);
        return this;
      }
      darken(ratio) {
        modHSL(this._rgb, 2, -ratio);
        return this;
      }
      saturate(ratio) {
        modHSL(this._rgb, 1, ratio);
        return this;
      }
      desaturate(ratio) {
        modHSL(this._rgb, 1, -ratio);
        return this;
      }
      rotate(deg) {
        rotate(this._rgb, deg);
        return this;
      }
    }
    function index_esm(input) {
      return new Color(input);
    }

    function isPatternOrGradient(value) {
        if (value && typeof value === 'object') {
            const type = value.toString();
            return type === '[object CanvasPattern]' || type === '[object CanvasGradient]';
        }
        return false;
    }
    function color(value) {
        return isPatternOrGradient(value) ? value : index_esm(value);
    }
    function getHoverColor(value) {
        return isPatternOrGradient(value) ? value : index_esm(value).saturate(0.5).darken(0.1).hexString();
    }

    const numbers = [
        'x',
        'y',
        'borderWidth',
        'radius',
        'tension'
    ];
    const colors = [
        'color',
        'borderColor',
        'backgroundColor'
    ];
    function applyAnimationsDefaults(defaults) {
        defaults.set('animation', {
            delay: undefined,
            duration: 1000,
            easing: 'easeOutQuart',
            fn: undefined,
            from: undefined,
            loop: undefined,
            to: undefined,
            type: undefined
        });
        defaults.describe('animation', {
            _fallback: false,
            _indexable: false,
            _scriptable: (name)=>name !== 'onProgress' && name !== 'onComplete' && name !== 'fn'
        });
        defaults.set('animations', {
            colors: {
                type: 'color',
                properties: colors
            },
            numbers: {
                type: 'number',
                properties: numbers
            }
        });
        defaults.describe('animations', {
            _fallback: 'animation'
        });
        defaults.set('transitions', {
            active: {
                animation: {
                    duration: 400
                }
            },
            resize: {
                animation: {
                    duration: 0
                }
            },
            show: {
                animations: {
                    colors: {
                        from: 'transparent'
                    },
                    visible: {
                        type: 'boolean',
                        duration: 0
                    }
                }
            },
            hide: {
                animations: {
                    colors: {
                        to: 'transparent'
                    },
                    visible: {
                        type: 'boolean',
                        easing: 'linear',
                        fn: (v)=>v | 0
                    }
                }
            }
        });
    }

    function applyLayoutsDefaults(defaults) {
        defaults.set('layout', {
            autoPadding: true,
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            }
        });
    }

    const intlCache = new Map();
    function getNumberFormat(locale, options) {
        options = options || {};
        const cacheKey = locale + JSON.stringify(options);
        let formatter = intlCache.get(cacheKey);
        if (!formatter) {
            formatter = new Intl.NumberFormat(locale, options);
            intlCache.set(cacheKey, formatter);
        }
        return formatter;
    }
    function formatNumber(num, locale, options) {
        return getNumberFormat(locale, options).format(num);
    }

    const formatters$2 = {
     values (value) {
            return isArray(value) ?  (value) : '' + value;
        },
     numeric (tickValue, index, ticks) {
            if (tickValue === 0) {
                return '0';
            }
            const locale = this.chart.options.locale;
            let notation;
            let delta = tickValue;
            if (ticks.length > 1) {
                const maxTick = Math.max(Math.abs(ticks[0].value), Math.abs(ticks[ticks.length - 1].value));
                if (maxTick < 1e-4 || maxTick > 1e+15) {
                    notation = 'scientific';
                }
                delta = calculateDelta(tickValue, ticks);
            }
            const logDelta = log10(Math.abs(delta));
            const numDecimal = Math.max(Math.min(-1 * Math.floor(logDelta), 20), 0);
            const options = {
                notation,
                minimumFractionDigits: numDecimal,
                maximumFractionDigits: numDecimal
            };
            Object.assign(options, this.options.ticks.format);
            return formatNumber(tickValue, locale, options);
        },
     logarithmic (tickValue, index, ticks) {
            if (tickValue === 0) {
                return '0';
            }
            const remain = ticks[index].significand || tickValue / Math.pow(10, Math.floor(log10(tickValue)));
            if ([
                1,
                2,
                3,
                5,
                10,
                15
            ].includes(remain) || index > 0.8 * ticks.length) {
                return formatters$2.numeric.call(this, tickValue, index, ticks);
            }
            return '';
        }
    };
    function calculateDelta(tickValue, ticks) {
        let delta = ticks.length > 3 ? ticks[2].value - ticks[1].value : ticks[1].value - ticks[0].value;
        if (Math.abs(delta) >= 1 && tickValue !== Math.floor(tickValue)) {
            delta = tickValue - Math.floor(tickValue);
        }
        return delta;
    }
     var Ticks = {
        formatters: formatters$2
    };

    function applyScaleDefaults(defaults) {
        defaults.set('scale', {
            display: true,
            offset: false,
            reverse: false,
            beginAtZero: false,
     bounds: 'ticks',
     grace: 0,
            grid: {
                display: true,
                lineWidth: 1,
                drawOnChartArea: true,
                drawTicks: true,
                tickLength: 8,
                tickWidth: (_ctx, options)=>options.lineWidth,
                tickColor: (_ctx, options)=>options.color,
                offset: false
            },
            border: {
                display: true,
                dash: [],
                dashOffset: 0.0,
                width: 1
            },
            title: {
                display: false,
                text: '',
                padding: {
                    top: 4,
                    bottom: 4
                }
            },
            ticks: {
                minRotation: 0,
                maxRotation: 50,
                mirror: false,
                textStrokeWidth: 0,
                textStrokeColor: '',
                padding: 3,
                display: true,
                autoSkip: true,
                autoSkipPadding: 3,
                labelOffset: 0,
                callback: Ticks.formatters.values,
                minor: {},
                major: {},
                align: 'center',
                crossAlign: 'near',
                showLabelBackdrop: false,
                backdropColor: 'rgba(255, 255, 255, 0.75)',
                backdropPadding: 2
            }
        });
        defaults.route('scale.ticks', 'color', '', 'color');
        defaults.route('scale.grid', 'color', '', 'borderColor');
        defaults.route('scale.border', 'color', '', 'borderColor');
        defaults.route('scale.title', 'color', '', 'color');
        defaults.describe('scale', {
            _fallback: false,
            _scriptable: (name)=>!name.startsWith('before') && !name.startsWith('after') && name !== 'callback' && name !== 'parser',
            _indexable: (name)=>name !== 'borderDash' && name !== 'tickBorderDash' && name !== 'dash'
        });
        defaults.describe('scales', {
            _fallback: 'scale'
        });
        defaults.describe('scale.ticks', {
            _scriptable: (name)=>name !== 'backdropPadding' && name !== 'callback',
            _indexable: (name)=>name !== 'backdropPadding'
        });
    }

    const overrides = Object.create(null);
    const descriptors = Object.create(null);
     function getScope$1(node, key) {
        if (!key) {
            return node;
        }
        const keys = key.split('.');
        for(let i = 0, n = keys.length; i < n; ++i){
            const k = keys[i];
            node = node[k] || (node[k] = Object.create(null));
        }
        return node;
    }
    function set(root, scope, values) {
        if (typeof scope === 'string') {
            return merge(getScope$1(root, scope), values);
        }
        return merge(getScope$1(root, ''), scope);
    }
     class Defaults {
        constructor(_descriptors, _appliers){
            this.animation = undefined;
            this.backgroundColor = 'rgba(0,0,0,0.1)';
            this.borderColor = 'rgba(0,0,0,0.1)';
            this.color = '#666';
            this.datasets = {};
            this.devicePixelRatio = (context)=>context.chart.platform.getDevicePixelRatio();
            this.elements = {};
            this.events = [
                'mousemove',
                'mouseout',
                'click',
                'touchstart',
                'touchmove'
            ];
            this.font = {
                family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                size: 12,
                style: 'normal',
                lineHeight: 1.2,
                weight: null
            };
            this.hover = {};
            this.hoverBackgroundColor = (ctx, options)=>getHoverColor(options.backgroundColor);
            this.hoverBorderColor = (ctx, options)=>getHoverColor(options.borderColor);
            this.hoverColor = (ctx, options)=>getHoverColor(options.color);
            this.indexAxis = 'x';
            this.interaction = {
                mode: 'nearest',
                intersect: true,
                includeInvisible: false
            };
            this.maintainAspectRatio = true;
            this.onHover = null;
            this.onClick = null;
            this.parsing = true;
            this.plugins = {};
            this.responsive = true;
            this.scale = undefined;
            this.scales = {};
            this.showLine = true;
            this.drawActiveElementsOnTop = true;
            this.describe(_descriptors);
            this.apply(_appliers);
        }
     set(scope, values) {
            return set(this, scope, values);
        }
     get(scope) {
            return getScope$1(this, scope);
        }
     describe(scope, values) {
            return set(descriptors, scope, values);
        }
        override(scope, values) {
            return set(overrides, scope, values);
        }
     route(scope, name, targetScope, targetName) {
            const scopeObject = getScope$1(this, scope);
            const targetScopeObject = getScope$1(this, targetScope);
            const privateName = '_' + name;
            Object.defineProperties(scopeObject, {
                [privateName]: {
                    value: scopeObject[name],
                    writable: true
                },
                [name]: {
                    enumerable: true,
                    get () {
                        const local = this[privateName];
                        const target = targetScopeObject[targetName];
                        if (isObject(local)) {
                            return Object.assign({}, target, local);
                        }
                        return valueOrDefault(local, target);
                    },
                    set (value) {
                        this[privateName] = value;
                    }
                }
            });
        }
        apply(appliers) {
            appliers.forEach((apply)=>apply(this));
        }
    }
    var defaults = /* #__PURE__ */ new Defaults({
        _scriptable: (name)=>!name.startsWith('on'),
        _indexable: (name)=>name !== 'events',
        hover: {
            _fallback: 'interaction'
        },
        interaction: {
            _scriptable: false,
            _indexable: false
        }
    }, [
        applyAnimationsDefaults,
        applyLayoutsDefaults,
        applyScaleDefaults
    ]);

    function toFontString(font) {
        if (!font || isNullOrUndef(font.size) || isNullOrUndef(font.family)) {
            return null;
        }
        return (font.style ? font.style + ' ' : '') + (font.weight ? font.weight + ' ' : '') + font.size + 'px ' + font.family;
    }
     function _measureText(ctx, data, gc, longest, string) {
        let textWidth = data[string];
        if (!textWidth) {
            textWidth = data[string] = ctx.measureText(string).width;
            gc.push(string);
        }
        if (textWidth > longest) {
            longest = textWidth;
        }
        return longest;
    }
     function _alignPixel(chart, pixel, width) {
        const devicePixelRatio = chart.currentDevicePixelRatio;
        const halfWidth = width !== 0 ? Math.max(width / 2, 0.5) : 0;
        return Math.round((pixel - halfWidth) * devicePixelRatio) / devicePixelRatio + halfWidth;
    }
     function clearCanvas(canvas, ctx) {
        ctx = ctx || canvas.getContext('2d');
        ctx.save();
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
    function drawPoint(ctx, options, x, y) {
        drawPointLegend(ctx, options, x, y, null);
    }
    function drawPointLegend(ctx, options, x, y, w) {
        let type, xOffset, yOffset, size, cornerRadius, width, xOffsetW, yOffsetW;
        const style = options.pointStyle;
        const rotation = options.rotation;
        const radius = options.radius;
        let rad = (rotation || 0) * RAD_PER_DEG;
        if (style && typeof style === 'object') {
            type = style.toString();
            if (type === '[object HTMLImageElement]' || type === '[object HTMLCanvasElement]') {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rad);
                ctx.drawImage(style, -style.width / 2, -style.height / 2, style.width, style.height);
                ctx.restore();
                return;
            }
        }
        if (isNaN(radius) || radius <= 0) {
            return;
        }
        ctx.beginPath();
        switch(style){
            default:
                if (w) {
                    ctx.ellipse(x, y, w / 2, radius, 0, 0, TAU);
                } else {
                    ctx.arc(x, y, radius, 0, TAU);
                }
                ctx.closePath();
                break;
            case 'triangle':
                width = w ? w / 2 : radius;
                ctx.moveTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
                rad += TWO_THIRDS_PI;
                ctx.lineTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
                rad += TWO_THIRDS_PI;
                ctx.lineTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
                ctx.closePath();
                break;
            case 'rectRounded':
                cornerRadius = radius * 0.516;
                size = radius - cornerRadius;
                xOffset = Math.cos(rad + QUARTER_PI) * size;
                xOffsetW = Math.cos(rad + QUARTER_PI) * (w ? w / 2 - cornerRadius : size);
                yOffset = Math.sin(rad + QUARTER_PI) * size;
                yOffsetW = Math.sin(rad + QUARTER_PI) * (w ? w / 2 - cornerRadius : size);
                ctx.arc(x - xOffsetW, y - yOffset, cornerRadius, rad - PI, rad - HALF_PI);
                ctx.arc(x + yOffsetW, y - xOffset, cornerRadius, rad - HALF_PI, rad);
                ctx.arc(x + xOffsetW, y + yOffset, cornerRadius, rad, rad + HALF_PI);
                ctx.arc(x - yOffsetW, y + xOffset, cornerRadius, rad + HALF_PI, rad + PI);
                ctx.closePath();
                break;
            case 'rect':
                if (!rotation) {
                    size = Math.SQRT1_2 * radius;
                    width = w ? w / 2 : size;
                    ctx.rect(x - width, y - size, 2 * width, 2 * size);
                    break;
                }
                rad += QUARTER_PI;
             case 'rectRot':
                xOffsetW = Math.cos(rad) * (w ? w / 2 : radius);
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                yOffsetW = Math.sin(rad) * (w ? w / 2 : radius);
                ctx.moveTo(x - xOffsetW, y - yOffset);
                ctx.lineTo(x + yOffsetW, y - xOffset);
                ctx.lineTo(x + xOffsetW, y + yOffset);
                ctx.lineTo(x - yOffsetW, y + xOffset);
                ctx.closePath();
                break;
            case 'crossRot':
                rad += QUARTER_PI;
             case 'cross':
                xOffsetW = Math.cos(rad) * (w ? w / 2 : radius);
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                yOffsetW = Math.sin(rad) * (w ? w / 2 : radius);
                ctx.moveTo(x - xOffsetW, y - yOffset);
                ctx.lineTo(x + xOffsetW, y + yOffset);
                ctx.moveTo(x + yOffsetW, y - xOffset);
                ctx.lineTo(x - yOffsetW, y + xOffset);
                break;
            case 'star':
                xOffsetW = Math.cos(rad) * (w ? w / 2 : radius);
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                yOffsetW = Math.sin(rad) * (w ? w / 2 : radius);
                ctx.moveTo(x - xOffsetW, y - yOffset);
                ctx.lineTo(x + xOffsetW, y + yOffset);
                ctx.moveTo(x + yOffsetW, y - xOffset);
                ctx.lineTo(x - yOffsetW, y + xOffset);
                rad += QUARTER_PI;
                xOffsetW = Math.cos(rad) * (w ? w / 2 : radius);
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                yOffsetW = Math.sin(rad) * (w ? w / 2 : radius);
                ctx.moveTo(x - xOffsetW, y - yOffset);
                ctx.lineTo(x + xOffsetW, y + yOffset);
                ctx.moveTo(x + yOffsetW, y - xOffset);
                ctx.lineTo(x - yOffsetW, y + xOffset);
                break;
            case 'line':
                xOffset = w ? w / 2 : Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                ctx.moveTo(x - xOffset, y - yOffset);
                ctx.lineTo(x + xOffset, y + yOffset);
                break;
            case 'dash':
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(rad) * (w ? w / 2 : radius), y + Math.sin(rad) * radius);
                break;
        }
        ctx.fill();
        if (options.borderWidth > 0) {
            ctx.stroke();
        }
    }
     function _isPointInArea(point, area, margin) {
        margin = margin || 0.5;
        return !area || point && point.x > area.left - margin && point.x < area.right + margin && point.y > area.top - margin && point.y < area.bottom + margin;
    }
    function clipArea(ctx, area) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
        ctx.clip();
    }
    function unclipArea(ctx) {
        ctx.restore();
    }
     function _steppedLineTo(ctx, previous, target, flip, mode) {
        if (!previous) {
            return ctx.lineTo(target.x, target.y);
        }
        if (mode === 'middle') {
            const midpoint = (previous.x + target.x) / 2.0;
            ctx.lineTo(midpoint, previous.y);
            ctx.lineTo(midpoint, target.y);
        } else if (mode === 'after' !== !!flip) {
            ctx.lineTo(previous.x, target.y);
        } else {
            ctx.lineTo(target.x, previous.y);
        }
        ctx.lineTo(target.x, target.y);
    }
     function _bezierCurveTo(ctx, previous, target, flip) {
        if (!previous) {
            return ctx.lineTo(target.x, target.y);
        }
        ctx.bezierCurveTo(flip ? previous.cp1x : previous.cp2x, flip ? previous.cp1y : previous.cp2y, flip ? target.cp2x : target.cp1x, flip ? target.cp2y : target.cp1y, target.x, target.y);
    }
     function renderText(ctx, text, x, y, font, opts = {}) {
        const lines = isArray(text) ? text : [
            text
        ];
        const stroke = opts.strokeWidth > 0 && opts.strokeColor !== '';
        let i, line;
        ctx.save();
        ctx.font = font.string;
        setRenderOpts(ctx, opts);
        for(i = 0; i < lines.length; ++i){
            line = lines[i];
            if (opts.backdrop) {
                drawBackdrop(ctx, opts.backdrop);
            }
            if (stroke) {
                if (opts.strokeColor) {
                    ctx.strokeStyle = opts.strokeColor;
                }
                if (!isNullOrUndef(opts.strokeWidth)) {
                    ctx.lineWidth = opts.strokeWidth;
                }
                ctx.strokeText(line, x, y, opts.maxWidth);
            }
            ctx.fillText(line, x, y, opts.maxWidth);
            decorateText(ctx, x, y, line, opts);
            y += font.lineHeight;
        }
        ctx.restore();
    }
    function setRenderOpts(ctx, opts) {
        if (opts.translation) {
            ctx.translate(opts.translation[0], opts.translation[1]);
        }
        if (!isNullOrUndef(opts.rotation)) {
            ctx.rotate(opts.rotation);
        }
        if (opts.color) {
            ctx.fillStyle = opts.color;
        }
        if (opts.textAlign) {
            ctx.textAlign = opts.textAlign;
        }
        if (opts.textBaseline) {
            ctx.textBaseline = opts.textBaseline;
        }
    }
    function decorateText(ctx, x, y, line, opts) {
        if (opts.strikethrough || opts.underline) {
     const metrics = ctx.measureText(line);
            const left = x - metrics.actualBoundingBoxLeft;
            const right = x + metrics.actualBoundingBoxRight;
            const top = y - metrics.actualBoundingBoxAscent;
            const bottom = y + metrics.actualBoundingBoxDescent;
            const yDecoration = opts.strikethrough ? (top + bottom) / 2 : bottom;
            ctx.strokeStyle = ctx.fillStyle;
            ctx.beginPath();
            ctx.lineWidth = opts.decorationWidth || 2;
            ctx.moveTo(left, yDecoration);
            ctx.lineTo(right, yDecoration);
            ctx.stroke();
        }
    }
    function drawBackdrop(ctx, opts) {
        const oldColor = ctx.fillStyle;
        ctx.fillStyle = opts.color;
        ctx.fillRect(opts.left, opts.top, opts.width, opts.height);
        ctx.fillStyle = oldColor;
    }
     function addRoundedRectPath(ctx, rect) {
        const { x , y , w , h , radius  } = rect;
        ctx.arc(x + radius.topLeft, y + radius.topLeft, radius.topLeft, -HALF_PI, PI, true);
        ctx.lineTo(x, y + h - radius.bottomLeft);
        ctx.arc(x + radius.bottomLeft, y + h - radius.bottomLeft, radius.bottomLeft, PI, HALF_PI, true);
        ctx.lineTo(x + w - radius.bottomRight, y + h);
        ctx.arc(x + w - radius.bottomRight, y + h - radius.bottomRight, radius.bottomRight, HALF_PI, 0, true);
        ctx.lineTo(x + w, y + radius.topRight);
        ctx.arc(x + w - radius.topRight, y + radius.topRight, radius.topRight, 0, -HALF_PI, true);
        ctx.lineTo(x + radius.topLeft, y);
    }

    const LINE_HEIGHT = /^(normal|(\d+(?:\.\d+)?)(px|em|%)?)$/;
    const FONT_STYLE = /^(normal|italic|initial|inherit|unset|(oblique( -?[0-9]?[0-9]deg)?))$/;
    /**
     * @alias Chart.helpers.options
     * @namespace
     */ /**
     * Converts the given line height `value` in pixels for a specific font `size`.
     * @param value - The lineHeight to parse (eg. 1.6, '14px', '75%', '1.6em').
     * @param size - The font size (in pixels) used to resolve relative `value`.
     * @returns The effective line height in pixels (size * 1.2 if value is invalid).
     * @see https://developer.mozilla.org/en-US/docs/Web/CSS/line-height
     * @since 2.7.0
     */ function toLineHeight(value, size) {
        const matches = ('' + value).match(LINE_HEIGHT);
        if (!matches || matches[1] === 'normal') {
            return size * 1.2;
        }
        value = +matches[2];
        switch(matches[3]){
            case 'px':
                return value;
            case '%':
                value /= 100;
                break;
        }
        return size * value;
    }
    const numberOrZero = (v)=>+v || 0;
    function _readValueToProps(value, props) {
        const ret = {};
        const objProps = isObject(props);
        const keys = objProps ? Object.keys(props) : props;
        const read = isObject(value) ? objProps ? (prop)=>valueOrDefault(value[prop], value[props[prop]]) : (prop)=>value[prop] : ()=>value;
        for (const prop of keys){
            ret[prop] = numberOrZero(read(prop));
        }
        return ret;
    }
    /**
     * Converts the given value into a TRBL object.
     * @param value - If a number, set the value to all TRBL component,
     *  else, if an object, use defined properties and sets undefined ones to 0.
     *  x / y are shorthands for same value for left/right and top/bottom.
     * @returns The padding values (top, right, bottom, left)
     * @since 3.0.0
     */ function toTRBL(value) {
        return _readValueToProps(value, {
            top: 'y',
            right: 'x',
            bottom: 'y',
            left: 'x'
        });
    }
    /**
     * Converts the given value into a TRBL corners object (similar with css border-radius).
     * @param value - If a number, set the value to all TRBL corner components,
     *  else, if an object, use defined properties and sets undefined ones to 0.
     * @returns The TRBL corner values (topLeft, topRight, bottomLeft, bottomRight)
     * @since 3.0.0
     */ function toTRBLCorners(value) {
        return _readValueToProps(value, [
            'topLeft',
            'topRight',
            'bottomLeft',
            'bottomRight'
        ]);
    }
    /**
     * Converts the given value into a padding object with pre-computed width/height.
     * @param value - If a number, set the value to all TRBL component,
     *  else, if an object, use defined properties and sets undefined ones to 0.
     *  x / y are shorthands for same value for left/right and top/bottom.
     * @returns The padding values (top, right, bottom, left, width, height)
     * @since 2.7.0
     */ function toPadding(value) {
        const obj = toTRBL(value);
        obj.width = obj.left + obj.right;
        obj.height = obj.top + obj.bottom;
        return obj;
    }
    /**
     * Parses font options and returns the font object.
     * @param options - A object that contains font options to be parsed.
     * @param fallback - A object that contains fallback font options.
     * @return The font object.
     * @private
     */ function toFont(options, fallback) {
        options = options || {};
        fallback = fallback || defaults.font;
        let size = valueOrDefault(options.size, fallback.size);
        if (typeof size === 'string') {
            size = parseInt(size, 10);
        }
        let style = valueOrDefault(options.style, fallback.style);
        if (style && !('' + style).match(FONT_STYLE)) {
            console.warn('Invalid font style specified: "' + style + '"');
            style = undefined;
        }
        const font = {
            family: valueOrDefault(options.family, fallback.family),
            lineHeight: toLineHeight(valueOrDefault(options.lineHeight, fallback.lineHeight), size),
            size,
            style,
            weight: valueOrDefault(options.weight, fallback.weight),
            string: ''
        };
        font.string = toFontString(font);
        return font;
    }
    /**
     * Evaluates the given `inputs` sequentially and returns the first defined value.
     * @param inputs - An array of values, falling back to the last value.
     * @param context - If defined and the current value is a function, the value
     * is called with `context` as first argument and the result becomes the new input.
     * @param index - If defined and the current value is an array, the value
     * at `index` become the new input.
     * @param info - object to return information about resolution in
     * @param info.cacheable - Will be set to `false` if option is not cacheable.
     * @since 2.7.0
     */ function resolve(inputs, context, index, info) {
        let cacheable = true;
        let i, ilen, value;
        for(i = 0, ilen = inputs.length; i < ilen; ++i){
            value = inputs[i];
            if (value === undefined) {
                continue;
            }
            if (context !== undefined && typeof value === 'function') {
                value = value(context);
                cacheable = false;
            }
            if (index !== undefined && isArray(value)) {
                value = value[index % value.length];
                cacheable = false;
            }
            if (value !== undefined) {
                if (info && !cacheable) {
                    info.cacheable = false;
                }
                return value;
            }
        }
    }
    /**
     * @param minmax
     * @param grace
     * @param beginAtZero
     * @private
     */ function _addGrace(minmax, grace, beginAtZero) {
        const { min , max  } = minmax;
        const change = toDimension(grace, (max - min) / 2);
        const keepZero = (value, add)=>beginAtZero && value === 0 ? 0 : value + add;
        return {
            min: keepZero(min, -Math.abs(change)),
            max: keepZero(max, change)
        };
    }
    /**
     * Create a context inheriting parentContext
     * @param parentContext
     * @param context
     * @returns
     */ function createContext(parentContext, context) {
        return Object.assign(Object.create(parentContext), context);
    }

    function _createResolver(scopes, prefixes = [
        ''
    ], rootScopes = scopes, fallback, getTarget = ()=>scopes[0]) {
        if (!defined(fallback)) {
            fallback = _resolve('_fallback', scopes);
        }
        const cache = {
            [Symbol.toStringTag]: 'Object',
            _cacheable: true,
            _scopes: scopes,
            _rootScopes: rootScopes,
            _fallback: fallback,
            _getTarget: getTarget,
            override: (scope)=>_createResolver([
                    scope,
                    ...scopes
                ], prefixes, rootScopes, fallback)
        };
        return new Proxy(cache, {
     deleteProperty (target, prop) {
                delete target[prop];
                delete target._keys;
                delete scopes[0][prop];
                return true;
            },
     get (target, prop) {
                return _cached(target, prop, ()=>_resolveWithPrefixes(prop, prefixes, scopes, target));
            },
     getOwnPropertyDescriptor (target, prop) {
                return Reflect.getOwnPropertyDescriptor(target._scopes[0], prop);
            },
     getPrototypeOf () {
                return Reflect.getPrototypeOf(scopes[0]);
            },
     has (target, prop) {
                return getKeysFromAllScopes(target).includes(prop);
            },
     ownKeys (target) {
                return getKeysFromAllScopes(target);
            },
     set (target, prop, value) {
                const storage = target._storage || (target._storage = getTarget());
                target[prop] = storage[prop] = value;
                delete target._keys;
                return true;
            }
        });
    }
     function _attachContext(proxy, context, subProxy, descriptorDefaults) {
        const cache = {
            _cacheable: false,
            _proxy: proxy,
            _context: context,
            _subProxy: subProxy,
            _stack: new Set(),
            _descriptors: _descriptors(proxy, descriptorDefaults),
            setContext: (ctx)=>_attachContext(proxy, ctx, subProxy, descriptorDefaults),
            override: (scope)=>_attachContext(proxy.override(scope), context, subProxy, descriptorDefaults)
        };
        return new Proxy(cache, {
     deleteProperty (target, prop) {
                delete target[prop];
                delete proxy[prop];
                return true;
            },
     get (target, prop, receiver) {
                return _cached(target, prop, ()=>_resolveWithContext(target, prop, receiver));
            },
     getOwnPropertyDescriptor (target, prop) {
                return target._descriptors.allKeys ? Reflect.has(proxy, prop) ? {
                    enumerable: true,
                    configurable: true
                } : undefined : Reflect.getOwnPropertyDescriptor(proxy, prop);
            },
     getPrototypeOf () {
                return Reflect.getPrototypeOf(proxy);
            },
     has (target, prop) {
                return Reflect.has(proxy, prop);
            },
     ownKeys () {
                return Reflect.ownKeys(proxy);
            },
     set (target, prop, value) {
                proxy[prop] = value;
                delete target[prop];
                return true;
            }
        });
    }
     function _descriptors(proxy, defaults = {
        scriptable: true,
        indexable: true
    }) {
        const { _scriptable =defaults.scriptable , _indexable =defaults.indexable , _allKeys =defaults.allKeys  } = proxy;
        return {
            allKeys: _allKeys,
            scriptable: _scriptable,
            indexable: _indexable,
            isScriptable: isFunction(_scriptable) ? _scriptable : ()=>_scriptable,
            isIndexable: isFunction(_indexable) ? _indexable : ()=>_indexable
        };
    }
    const readKey = (prefix, name)=>prefix ? prefix + _capitalize(name) : name;
    const needsSubResolver = (prop, value)=>isObject(value) && prop !== 'adapters' && (Object.getPrototypeOf(value) === null || value.constructor === Object);
    function _cached(target, prop, resolve) {
        if (Object.prototype.hasOwnProperty.call(target, prop)) {
            return target[prop];
        }
        const value = resolve();
        target[prop] = value;
        return value;
    }
    function _resolveWithContext(target, prop, receiver) {
        const { _proxy , _context , _subProxy , _descriptors: descriptors  } = target;
        let value = _proxy[prop];
        if (isFunction(value) && descriptors.isScriptable(prop)) {
            value = _resolveScriptable(prop, value, target, receiver);
        }
        if (isArray(value) && value.length) {
            value = _resolveArray(prop, value, target, descriptors.isIndexable);
        }
        if (needsSubResolver(prop, value)) {
            value = _attachContext(value, _context, _subProxy && _subProxy[prop], descriptors);
        }
        return value;
    }
    function _resolveScriptable(prop, value, target, receiver) {
        const { _proxy , _context , _subProxy , _stack  } = target;
        if (_stack.has(prop)) {
            throw new Error('Recursion detected: ' + Array.from(_stack).join('->') + '->' + prop);
        }
        _stack.add(prop);
        value = value(_context, _subProxy || receiver);
        _stack.delete(prop);
        if (needsSubResolver(prop, value)) {
            value = createSubResolver(_proxy._scopes, _proxy, prop, value);
        }
        return value;
    }
    function _resolveArray(prop, value, target, isIndexable) {
        const { _proxy , _context , _subProxy , _descriptors: descriptors  } = target;
        if (defined(_context.index) && isIndexable(prop)) {
            value = value[_context.index % value.length];
        } else if (isObject(value[0])) {
            const arr = value;
            const scopes = _proxy._scopes.filter((s)=>s !== arr);
            value = [];
            for (const item of arr){
                const resolver = createSubResolver(scopes, _proxy, prop, item);
                value.push(_attachContext(resolver, _context, _subProxy && _subProxy[prop], descriptors));
            }
        }
        return value;
    }
    function resolveFallback(fallback, prop, value) {
        return isFunction(fallback) ? fallback(prop, value) : fallback;
    }
    const getScope = (key, parent)=>key === true ? parent : typeof key === 'string' ? resolveObjectKey(parent, key) : undefined;
    function addScopes(set, parentScopes, key, parentFallback, value) {
        for (const parent of parentScopes){
            const scope = getScope(key, parent);
            if (scope) {
                set.add(scope);
                const fallback = resolveFallback(scope._fallback, key, value);
                if (defined(fallback) && fallback !== key && fallback !== parentFallback) {
                    return fallback;
                }
            } else if (scope === false && defined(parentFallback) && key !== parentFallback) {
                return null;
            }
        }
        return false;
    }
    function createSubResolver(parentScopes, resolver, prop, value) {
        const rootScopes = resolver._rootScopes;
        const fallback = resolveFallback(resolver._fallback, prop, value);
        const allScopes = [
            ...parentScopes,
            ...rootScopes
        ];
        const set = new Set();
        set.add(value);
        let key = addScopesFromKey(set, allScopes, prop, fallback || prop, value);
        if (key === null) {
            return false;
        }
        if (defined(fallback) && fallback !== prop) {
            key = addScopesFromKey(set, allScopes, fallback, key, value);
            if (key === null) {
                return false;
            }
        }
        return _createResolver(Array.from(set), [
            ''
        ], rootScopes, fallback, ()=>subGetTarget(resolver, prop, value));
    }
    function addScopesFromKey(set, allScopes, key, fallback, item) {
        while(key){
            key = addScopes(set, allScopes, key, fallback, item);
        }
        return key;
    }
    function subGetTarget(resolver, prop, value) {
        const parent = resolver._getTarget();
        if (!(prop in parent)) {
            parent[prop] = {};
        }
        const target = parent[prop];
        if (isArray(target) && isObject(value)) {
            return value;
        }
        return target || {};
    }
    function _resolveWithPrefixes(prop, prefixes, scopes, proxy) {
        let value;
        for (const prefix of prefixes){
            value = _resolve(readKey(prefix, prop), scopes);
            if (defined(value)) {
                return needsSubResolver(prop, value) ? createSubResolver(scopes, proxy, prop, value) : value;
            }
        }
    }
    function _resolve(key, scopes) {
        for (const scope of scopes){
            if (!scope) {
                continue;
            }
            const value = scope[key];
            if (defined(value)) {
                return value;
            }
        }
    }
    function getKeysFromAllScopes(target) {
        let keys = target._keys;
        if (!keys) {
            keys = target._keys = resolveKeysFromAllScopes(target._scopes);
        }
        return keys;
    }
    function resolveKeysFromAllScopes(scopes) {
        const set = new Set();
        for (const scope of scopes){
            for (const key of Object.keys(scope).filter((k)=>!k.startsWith('_'))){
                set.add(key);
            }
        }
        return Array.from(set);
    }

    const EPSILON = Number.EPSILON || 1e-14;
    const getPoint = (points, i)=>i < points.length && !points[i].skip && points[i];
    const getValueAxis = (indexAxis)=>indexAxis === 'x' ? 'y' : 'x';
    function splineCurve(firstPoint, middlePoint, afterPoint, t) {
        // Props to Rob Spencer at scaled innovation for his post on splining between points
        // http://scaledinnovation.com/analytics/splines/aboutSplines.html
        // This function must also respect "skipped" points
        const previous = firstPoint.skip ? middlePoint : firstPoint;
        const current = middlePoint;
        const next = afterPoint.skip ? middlePoint : afterPoint;
        const d01 = distanceBetweenPoints(current, previous);
        const d12 = distanceBetweenPoints(next, current);
        let s01 = d01 / (d01 + d12);
        let s12 = d12 / (d01 + d12);
        // If all points are the same, s01 & s02 will be inf
        s01 = isNaN(s01) ? 0 : s01;
        s12 = isNaN(s12) ? 0 : s12;
        const fa = t * s01; // scaling factor for triangle Ta
        const fb = t * s12;
        return {
            previous: {
                x: current.x - fa * (next.x - previous.x),
                y: current.y - fa * (next.y - previous.y)
            },
            next: {
                x: current.x + fb * (next.x - previous.x),
                y: current.y + fb * (next.y - previous.y)
            }
        };
    }
    /**
     * Adjust tangents to ensure monotonic properties
     */ function monotoneAdjust(points, deltaK, mK) {
        const pointsLen = points.length;
        let alphaK, betaK, tauK, squaredMagnitude, pointCurrent;
        let pointAfter = getPoint(points, 0);
        for(let i = 0; i < pointsLen - 1; ++i){
            pointCurrent = pointAfter;
            pointAfter = getPoint(points, i + 1);
            if (!pointCurrent || !pointAfter) {
                continue;
            }
            if (almostEquals(deltaK[i], 0, EPSILON)) {
                mK[i] = mK[i + 1] = 0;
                continue;
            }
            alphaK = mK[i] / deltaK[i];
            betaK = mK[i + 1] / deltaK[i];
            squaredMagnitude = Math.pow(alphaK, 2) + Math.pow(betaK, 2);
            if (squaredMagnitude <= 9) {
                continue;
            }
            tauK = 3 / Math.sqrt(squaredMagnitude);
            mK[i] = alphaK * tauK * deltaK[i];
            mK[i + 1] = betaK * tauK * deltaK[i];
        }
    }
    function monotoneCompute(points, mK, indexAxis = 'x') {
        const valueAxis = getValueAxis(indexAxis);
        const pointsLen = points.length;
        let delta, pointBefore, pointCurrent;
        let pointAfter = getPoint(points, 0);
        for(let i = 0; i < pointsLen; ++i){
            pointBefore = pointCurrent;
            pointCurrent = pointAfter;
            pointAfter = getPoint(points, i + 1);
            if (!pointCurrent) {
                continue;
            }
            const iPixel = pointCurrent[indexAxis];
            const vPixel = pointCurrent[valueAxis];
            if (pointBefore) {
                delta = (iPixel - pointBefore[indexAxis]) / 3;
                pointCurrent[`cp1${indexAxis}`] = iPixel - delta;
                pointCurrent[`cp1${valueAxis}`] = vPixel - delta * mK[i];
            }
            if (pointAfter) {
                delta = (pointAfter[indexAxis] - iPixel) / 3;
                pointCurrent[`cp2${indexAxis}`] = iPixel + delta;
                pointCurrent[`cp2${valueAxis}`] = vPixel + delta * mK[i];
            }
        }
    }
    /**
     * This function calculates Bézier control points in a similar way than |splineCurve|,
     * but preserves monotonicity of the provided data and ensures no local extremums are added
     * between the dataset discrete points due to the interpolation.
     * See : https://en.wikipedia.org/wiki/Monotone_cubic_interpolation
     */ function splineCurveMonotone(points, indexAxis = 'x') {
        const valueAxis = getValueAxis(indexAxis);
        const pointsLen = points.length;
        const deltaK = Array(pointsLen).fill(0);
        const mK = Array(pointsLen);
        // Calculate slopes (deltaK) and initialize tangents (mK)
        let i, pointBefore, pointCurrent;
        let pointAfter = getPoint(points, 0);
        for(i = 0; i < pointsLen; ++i){
            pointBefore = pointCurrent;
            pointCurrent = pointAfter;
            pointAfter = getPoint(points, i + 1);
            if (!pointCurrent) {
                continue;
            }
            if (pointAfter) {
                const slopeDelta = pointAfter[indexAxis] - pointCurrent[indexAxis];
                // In the case of two points that appear at the same x pixel, slopeDeltaX is 0
                deltaK[i] = slopeDelta !== 0 ? (pointAfter[valueAxis] - pointCurrent[valueAxis]) / slopeDelta : 0;
            }
            mK[i] = !pointBefore ? deltaK[i] : !pointAfter ? deltaK[i - 1] : sign(deltaK[i - 1]) !== sign(deltaK[i]) ? 0 : (deltaK[i - 1] + deltaK[i]) / 2;
        }
        monotoneAdjust(points, deltaK, mK);
        monotoneCompute(points, mK, indexAxis);
    }
    function capControlPoint(pt, min, max) {
        return Math.max(Math.min(pt, max), min);
    }
    function capBezierPoints(points, area) {
        let i, ilen, point, inArea, inAreaPrev;
        let inAreaNext = _isPointInArea(points[0], area);
        for(i = 0, ilen = points.length; i < ilen; ++i){
            inAreaPrev = inArea;
            inArea = inAreaNext;
            inAreaNext = i < ilen - 1 && _isPointInArea(points[i + 1], area);
            if (!inArea) {
                continue;
            }
            point = points[i];
            if (inAreaPrev) {
                point.cp1x = capControlPoint(point.cp1x, area.left, area.right);
                point.cp1y = capControlPoint(point.cp1y, area.top, area.bottom);
            }
            if (inAreaNext) {
                point.cp2x = capControlPoint(point.cp2x, area.left, area.right);
                point.cp2y = capControlPoint(point.cp2y, area.top, area.bottom);
            }
        }
    }
    /**
     * @private
     */ function _updateBezierControlPoints(points, options, area, loop, indexAxis) {
        let i, ilen, point, controlPoints;
        // Only consider points that are drawn in case the spanGaps option is used
        if (options.spanGaps) {
            points = points.filter((pt)=>!pt.skip);
        }
        if (options.cubicInterpolationMode === 'monotone') {
            splineCurveMonotone(points, indexAxis);
        } else {
            let prev = loop ? points[points.length - 1] : points[0];
            for(i = 0, ilen = points.length; i < ilen; ++i){
                point = points[i];
                controlPoints = splineCurve(prev, point, points[Math.min(i + 1, ilen - (loop ? 0 : 1)) % ilen], options.tension);
                point.cp1x = controlPoints.previous.x;
                point.cp1y = controlPoints.previous.y;
                point.cp2x = controlPoints.next.x;
                point.cp2y = controlPoints.next.y;
                prev = point;
            }
        }
        if (options.capBezierPoints) {
            capBezierPoints(points, area);
        }
    }

    /**
     * Note: typedefs are auto-exported, so use a made-up `dom` namespace where
     * necessary to avoid duplicates with `export * from './helpers`; see
     * https://github.com/microsoft/TypeScript/issues/46011
     * @typedef { import("../core/core.controller").default } dom.Chart
     * @typedef { import('../../types').ChartEvent } ChartEvent
     */ /**
     * @private
     */ function _isDomSupported() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }
    /**
     * @private
     */ function _getParentNode(domNode) {
        let parent = domNode.parentNode;
        if (parent && parent.toString() === '[object ShadowRoot]') {
            parent = parent.host;
        }
        return parent;
    }
    /**
     * convert max-width/max-height values that may be percentages into a number
     * @private
     */ function parseMaxStyle(styleValue, node, parentProperty) {
        let valueInPixels;
        if (typeof styleValue === 'string') {
            valueInPixels = parseInt(styleValue, 10);
            if (styleValue.indexOf('%') !== -1) {
                // percentage * size in dimension
                valueInPixels = valueInPixels / 100 * node.parentNode[parentProperty];
            }
        } else {
            valueInPixels = styleValue;
        }
        return valueInPixels;
    }
    const getComputedStyle = (element)=>element.ownerDocument.defaultView.getComputedStyle(element, null);
    function getStyle(el, property) {
        return getComputedStyle(el).getPropertyValue(property);
    }
    const positions = [
        'top',
        'right',
        'bottom',
        'left'
    ];
    function getPositionedStyle(styles, style, suffix) {
        const result = {};
        suffix = suffix ? '-' + suffix : '';
        for(let i = 0; i < 4; i++){
            const pos = positions[i];
            result[pos] = parseFloat(styles[style + '-' + pos + suffix]) || 0;
        }
        result.width = result.left + result.right;
        result.height = result.top + result.bottom;
        return result;
    }
    const useOffsetPos = (x, y, target)=>(x > 0 || y > 0) && (!target || !target.shadowRoot);
    /**
     * @param e
     * @param canvas
     * @returns Canvas position
     */ function getCanvasPosition(e, canvas) {
        const touches = e.touches;
        const source = touches && touches.length ? touches[0] : e;
        const { offsetX , offsetY  } = source;
        let box = false;
        let x, y;
        if (useOffsetPos(offsetX, offsetY, e.target)) {
            x = offsetX;
            y = offsetY;
        } else {
            const rect = canvas.getBoundingClientRect();
            x = source.clientX - rect.left;
            y = source.clientY - rect.top;
            box = true;
        }
        return {
            x,
            y,
            box
        };
    }
    /**
     * Gets an event's x, y coordinates, relative to the chart area
     * @param event
     * @param chart
     * @returns x and y coordinates of the event
     */ function getRelativePosition(event, chart) {
        if ('native' in event) {
            return event;
        }
        const { canvas , currentDevicePixelRatio  } = chart;
        const style = getComputedStyle(canvas);
        const borderBox = style.boxSizing === 'border-box';
        const paddings = getPositionedStyle(style, 'padding');
        const borders = getPositionedStyle(style, 'border', 'width');
        const { x , y , box  } = getCanvasPosition(event, canvas);
        const xOffset = paddings.left + (box && borders.left);
        const yOffset = paddings.top + (box && borders.top);
        let { width , height  } = chart;
        if (borderBox) {
            width -= paddings.width + borders.width;
            height -= paddings.height + borders.height;
        }
        return {
            x: Math.round((x - xOffset) / width * canvas.width / currentDevicePixelRatio),
            y: Math.round((y - yOffset) / height * canvas.height / currentDevicePixelRatio)
        };
    }
    function getContainerSize(canvas, width, height) {
        let maxWidth, maxHeight;
        if (width === undefined || height === undefined) {
            const container = _getParentNode(canvas);
            if (!container) {
                width = canvas.clientWidth;
                height = canvas.clientHeight;
            } else {
                const rect = container.getBoundingClientRect(); // this is the border box of the container
                const containerStyle = getComputedStyle(container);
                const containerBorder = getPositionedStyle(containerStyle, 'border', 'width');
                const containerPadding = getPositionedStyle(containerStyle, 'padding');
                width = rect.width - containerPadding.width - containerBorder.width;
                height = rect.height - containerPadding.height - containerBorder.height;
                maxWidth = parseMaxStyle(containerStyle.maxWidth, container, 'clientWidth');
                maxHeight = parseMaxStyle(containerStyle.maxHeight, container, 'clientHeight');
            }
        }
        return {
            width,
            height,
            maxWidth: maxWidth || INFINITY,
            maxHeight: maxHeight || INFINITY
        };
    }
    const round1 = (v)=>Math.round(v * 10) / 10;
    // eslint-disable-next-line complexity
    function getMaximumSize(canvas, bbWidth, bbHeight, aspectRatio) {
        const style = getComputedStyle(canvas);
        const margins = getPositionedStyle(style, 'margin');
        const maxWidth = parseMaxStyle(style.maxWidth, canvas, 'clientWidth') || INFINITY;
        const maxHeight = parseMaxStyle(style.maxHeight, canvas, 'clientHeight') || INFINITY;
        const containerSize = getContainerSize(canvas, bbWidth, bbHeight);
        let { width , height  } = containerSize;
        if (style.boxSizing === 'content-box') {
            const borders = getPositionedStyle(style, 'border', 'width');
            const paddings = getPositionedStyle(style, 'padding');
            width -= paddings.width + borders.width;
            height -= paddings.height + borders.height;
        }
        width = Math.max(0, width - margins.width);
        height = Math.max(0, aspectRatio ? Math.floor(width / aspectRatio) : height - margins.height);
        width = round1(Math.min(width, maxWidth, containerSize.maxWidth));
        height = round1(Math.min(height, maxHeight, containerSize.maxHeight));
        if (width && !height) {
            // https://github.com/chartjs/Chart.js/issues/4659
            // If the canvas has width, but no height, default to aspectRatio of 2 (canvas default)
            height = round1(width / 2);
        }
        const maintainHeight = bbWidth !== undefined || bbHeight !== undefined;
        if (maintainHeight && aspectRatio && containerSize.height && height > containerSize.height) {
            height = containerSize.height;
            width = round1(Math.floor(height * aspectRatio));
        }
        return {
            width,
            height
        };
    }
    /**
     * @param chart
     * @param forceRatio
     * @param forceStyle
     * @returns True if the canvas context size or transformation has changed.
     */ function retinaScale(chart, forceRatio, forceStyle) {
        const pixelRatio = forceRatio || 1;
        const deviceHeight = Math.floor(chart.height * pixelRatio);
        const deviceWidth = Math.floor(chart.width * pixelRatio);
        chart.height = deviceHeight / pixelRatio;
        chart.width = deviceWidth / pixelRatio;
        const canvas = chart.canvas;
        // If no style has been set on the canvas, the render size is used as display size,
        // making the chart visually bigger, so let's enforce it to the "correct" values.
        // See https://github.com/chartjs/Chart.js/issues/3575
        if (canvas.style && (forceStyle || !canvas.style.height && !canvas.style.width)) {
            canvas.style.height = `${chart.height}px`;
            canvas.style.width = `${chart.width}px`;
        }
        if (chart.currentDevicePixelRatio !== pixelRatio || canvas.height !== deviceHeight || canvas.width !== deviceWidth) {
            chart.currentDevicePixelRatio = pixelRatio;
            canvas.height = deviceHeight;
            canvas.width = deviceWidth;
            chart.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            return true;
        }
        return false;
    }
    /**
     * Detects support for options object argument in addEventListener.
     * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#Safely_detecting_option_support
     * @private
     */ const supportsEventListenerOptions = function() {
        let passiveSupported = false;
        try {
            const options = {
                get passive () {
                    passiveSupported = true;
                    return false;
                }
            };
            window.addEventListener('test', null, options);
            window.removeEventListener('test', null, options);
        } catch (e) {
        // continue regardless of error
        }
        return passiveSupported;
    }();
    /**
     * The "used" size is the final value of a dimension property after all calculations have
     * been performed. This method uses the computed style of `element` but returns undefined
     * if the computed style is not expressed in pixels. That can happen in some cases where
     * `element` has a size relative to its parent and this last one is not yet displayed,
     * for example because of `display: none` on a parent node.
     * @see https://developer.mozilla.org/en-US/docs/Web/CSS/used_value
     * @returns Size in pixels or undefined if unknown.
     */ function readUsedSize(element, property) {
        const value = getStyle(element, property);
        const matches = value && value.match(/^(\d+)(\.\d+)?px$/);
        return matches ? +matches[1] : undefined;
    }

    /**
     * @private
     */ function _pointInLine(p1, p2, t, mode) {
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y)
        };
    }
    /**
     * @private
     */ function _steppedInterpolation(p1, p2, t, mode) {
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: mode === 'middle' ? t < 0.5 ? p1.y : p2.y : mode === 'after' ? t < 1 ? p1.y : p2.y : t > 0 ? p2.y : p1.y
        };
    }
    /**
     * @private
     */ function _bezierInterpolation(p1, p2, t, mode) {
        const cp1 = {
            x: p1.cp2x,
            y: p1.cp2y
        };
        const cp2 = {
            x: p2.cp1x,
            y: p2.cp1y
        };
        const a = _pointInLine(p1, cp1, t);
        const b = _pointInLine(cp1, cp2, t);
        const c = _pointInLine(cp2, p2, t);
        const d = _pointInLine(a, b, t);
        const e = _pointInLine(b, c, t);
        return _pointInLine(d, e, t);
    }

    const getRightToLeftAdapter = function(rectX, width) {
        return {
            x (x) {
                return rectX + rectX + width - x;
            },
            setWidth (w) {
                width = w;
            },
            textAlign (align) {
                if (align === 'center') {
                    return align;
                }
                return align === 'right' ? 'left' : 'right';
            },
            xPlus (x, value) {
                return x - value;
            },
            leftForLtr (x, itemWidth) {
                return x - itemWidth;
            }
        };
    };
    const getLeftToRightAdapter = function() {
        return {
            x (x) {
                return x;
            },
            setWidth (w) {},
            textAlign (align) {
                return align;
            },
            xPlus (x, value) {
                return x + value;
            },
            leftForLtr (x, _itemWidth) {
                return x;
            }
        };
    };
    function getRtlAdapter(rtl, rectX, width) {
        return rtl ? getRightToLeftAdapter(rectX, width) : getLeftToRightAdapter();
    }
    function overrideTextDirection(ctx, direction) {
        let style, original;
        if (direction === 'ltr' || direction === 'rtl') {
            style = ctx.canvas.style;
            original = [
                style.getPropertyValue('direction'),
                style.getPropertyPriority('direction'), 
            ];
            style.setProperty('direction', direction, 'important');
            ctx.prevTextDirection = original;
        }
    }
    function restoreTextDirection(ctx, original) {
        if (original !== undefined) {
            delete ctx.prevTextDirection;
            ctx.canvas.style.setProperty('direction', original[0], original[1]);
        }
    }

    function propertyFn(property) {
        if (property === 'angle') {
            return {
                between: _angleBetween,
                compare: _angleDiff,
                normalize: _normalizeAngle
            };
        }
        return {
            between: _isBetween,
            compare: (a, b)=>a - b,
            normalize: (x)=>x
        };
    }
    function normalizeSegment({ start , end , count , loop , style  }) {
        return {
            start: start % count,
            end: end % count,
            loop: loop && (end - start + 1) % count === 0,
            style
        };
    }
    function getSegment(segment, points, bounds) {
        const { property , start: startBound , end: endBound  } = bounds;
        const { between , normalize  } = propertyFn(property);
        const count = points.length;
        let { start , end , loop  } = segment;
        let i, ilen;
        if (loop) {
            start += count;
            end += count;
            for(i = 0, ilen = count; i < ilen; ++i){
                if (!between(normalize(points[start % count][property]), startBound, endBound)) {
                    break;
                }
                start--;
                end--;
            }
            start %= count;
            end %= count;
        }
        if (end < start) {
            end += count;
        }
        return {
            start,
            end,
            loop,
            style: segment.style
        };
    }
     function _boundSegment(segment, points, bounds) {
        if (!bounds) {
            return [
                segment
            ];
        }
        const { property , start: startBound , end: endBound  } = bounds;
        const count = points.length;
        const { compare , between , normalize  } = propertyFn(property);
        const { start , end , loop , style  } = getSegment(segment, points, bounds);
        const result = [];
        let inside = false;
        let subStart = null;
        let value, point, prevValue;
        const startIsBefore = ()=>between(startBound, prevValue, value) && compare(startBound, prevValue) !== 0;
        const endIsBefore = ()=>compare(endBound, value) === 0 || between(endBound, prevValue, value);
        const shouldStart = ()=>inside || startIsBefore();
        const shouldStop = ()=>!inside || endIsBefore();
        for(let i = start, prev = start; i <= end; ++i){
            point = points[i % count];
            if (point.skip) {
                continue;
            }
            value = normalize(point[property]);
            if (value === prevValue) {
                continue;
            }
            inside = between(value, startBound, endBound);
            if (subStart === null && shouldStart()) {
                subStart = compare(value, startBound) === 0 ? i : prev;
            }
            if (subStart !== null && shouldStop()) {
                result.push(normalizeSegment({
                    start: subStart,
                    end: i,
                    loop,
                    count,
                    style
                }));
                subStart = null;
            }
            prev = i;
            prevValue = value;
        }
        if (subStart !== null) {
            result.push(normalizeSegment({
                start: subStart,
                end,
                loop,
                count,
                style
            }));
        }
        return result;
    }
     function _boundSegments(line, bounds) {
        const result = [];
        const segments = line.segments;
        for(let i = 0; i < segments.length; i++){
            const sub = _boundSegment(segments[i], line.points, bounds);
            if (sub.length) {
                result.push(...sub);
            }
        }
        return result;
    }
     function findStartAndEnd(points, count, loop, spanGaps) {
        let start = 0;
        let end = count - 1;
        if (loop && !spanGaps) {
            while(start < count && !points[start].skip){
                start++;
            }
        }
        while(start < count && points[start].skip){
            start++;
        }
        start %= count;
        if (loop) {
            end += start;
        }
        while(end > start && points[end % count].skip){
            end--;
        }
        end %= count;
        return {
            start,
            end
        };
    }
     function solidSegments(points, start, max, loop) {
        const count = points.length;
        const result = [];
        let last = start;
        let prev = points[start];
        let end;
        for(end = start + 1; end <= max; ++end){
            const cur = points[end % count];
            if (cur.skip || cur.stop) {
                if (!prev.skip) {
                    loop = false;
                    result.push({
                        start: start % count,
                        end: (end - 1) % count,
                        loop
                    });
                    start = last = cur.stop ? end : null;
                }
            } else {
                last = end;
                if (prev.skip) {
                    start = end;
                }
            }
            prev = cur;
        }
        if (last !== null) {
            result.push({
                start: start % count,
                end: last % count,
                loop
            });
        }
        return result;
    }
     function _computeSegments(line, segmentOptions) {
        const points = line.points;
        const spanGaps = line.options.spanGaps;
        const count = points.length;
        if (!count) {
            return [];
        }
        const loop = !!line._loop;
        const { start , end  } = findStartAndEnd(points, count, loop, spanGaps);
        if (spanGaps === true) {
            return splitByStyles(line, [
                {
                    start,
                    end,
                    loop
                }
            ], points, segmentOptions);
        }
        const max = end < start ? end + count : end;
        const completeLoop = !!line._fullLoop && start === 0 && end === count - 1;
        return splitByStyles(line, solidSegments(points, start, max, completeLoop), points, segmentOptions);
    }
     function splitByStyles(line, segments, points, segmentOptions) {
        if (!segmentOptions || !segmentOptions.setContext || !points) {
            return segments;
        }
        return doSplitByStyles(line, segments, points, segmentOptions);
    }
     function doSplitByStyles(line, segments, points, segmentOptions) {
        const chartContext = line._chart.getContext();
        const baseStyle = readStyle(line.options);
        const { _datasetIndex: datasetIndex , options: { spanGaps  }  } = line;
        const count = points.length;
        const result = [];
        let prevStyle = baseStyle;
        let start = segments[0].start;
        let i = start;
        function addStyle(s, e, l, st) {
            const dir = spanGaps ? -1 : 1;
            if (s === e) {
                return;
            }
            s += count;
            while(points[s % count].skip){
                s -= dir;
            }
            while(points[e % count].skip){
                e += dir;
            }
            if (s % count !== e % count) {
                result.push({
                    start: s % count,
                    end: e % count,
                    loop: l,
                    style: st
                });
                prevStyle = st;
                start = e % count;
            }
        }
        for (const segment of segments){
            start = spanGaps ? start : segment.start;
            let prev = points[start % count];
            let style;
            for(i = start + 1; i <= segment.end; i++){
                const pt = points[i % count];
                style = readStyle(segmentOptions.setContext(createContext(chartContext, {
                    type: 'segment',
                    p0: prev,
                    p1: pt,
                    p0DataIndex: (i - 1) % count,
                    p1DataIndex: i % count,
                    datasetIndex
                })));
                if (styleChanged(style, prevStyle)) {
                    addStyle(start, i - 1, segment.loop, prevStyle);
                }
                prev = pt;
                prevStyle = style;
            }
            if (start < i - 1) {
                addStyle(start, i - 1, segment.loop, prevStyle);
            }
        }
        return result;
    }
    function readStyle(options) {
        return {
            backgroundColor: options.backgroundColor,
            borderCapStyle: options.borderCapStyle,
            borderDash: options.borderDash,
            borderDashOffset: options.borderDashOffset,
            borderJoinStyle: options.borderJoinStyle,
            borderWidth: options.borderWidth,
            borderColor: options.borderColor
        };
    }
    function styleChanged(style, prevStyle) {
        return prevStyle && JSON.stringify(style) !== JSON.stringify(prevStyle);
    }

    /*!
     * Chart.js v4.0.1
     * https://www.chartjs.org
     * (c) 2022 Chart.js Contributors
     * Released under the MIT License
     */

    class Animator {
        constructor(){
            this._request = null;
            this._charts = new Map();
            this._running = false;
            this._lastDate = undefined;
        }
     _notify(chart, anims, date, type) {
            const callbacks = anims.listeners[type];
            const numSteps = anims.duration;
            callbacks.forEach((fn)=>fn({
                    chart,
                    initial: anims.initial,
                    numSteps,
                    currentStep: Math.min(date - anims.start, numSteps)
                }));
        }
     _refresh() {
            if (this._request) {
                return;
            }
            this._running = true;
            this._request = requestAnimFrame.call(window, ()=>{
                this._update();
                this._request = null;
                if (this._running) {
                    this._refresh();
                }
            });
        }
     _update(date = Date.now()) {
            let remaining = 0;
            this._charts.forEach((anims, chart)=>{
                if (!anims.running || !anims.items.length) {
                    return;
                }
                const items = anims.items;
                let i = items.length - 1;
                let draw = false;
                let item;
                for(; i >= 0; --i){
                    item = items[i];
                    if (item._active) {
                        if (item._total > anims.duration) {
                            anims.duration = item._total;
                        }
                        item.tick(date);
                        draw = true;
                    } else {
                        items[i] = items[items.length - 1];
                        items.pop();
                    }
                }
                if (draw) {
                    chart.draw();
                    this._notify(chart, anims, date, 'progress');
                }
                if (!items.length) {
                    anims.running = false;
                    this._notify(chart, anims, date, 'complete');
                    anims.initial = false;
                }
                remaining += items.length;
            });
            this._lastDate = date;
            if (remaining === 0) {
                this._running = false;
            }
        }
     _getAnims(chart) {
            const charts = this._charts;
            let anims = charts.get(chart);
            if (!anims) {
                anims = {
                    running: false,
                    initial: true,
                    items: [],
                    listeners: {
                        complete: [],
                        progress: []
                    }
                };
                charts.set(chart, anims);
            }
            return anims;
        }
     listen(chart, event, cb) {
            this._getAnims(chart).listeners[event].push(cb);
        }
     add(chart, items) {
            if (!items || !items.length) {
                return;
            }
            this._getAnims(chart).items.push(...items);
        }
     has(chart) {
            return this._getAnims(chart).items.length > 0;
        }
     start(chart) {
            const anims = this._charts.get(chart);
            if (!anims) {
                return;
            }
            anims.running = true;
            anims.start = Date.now();
            anims.duration = anims.items.reduce((acc, cur)=>Math.max(acc, cur._duration), 0);
            this._refresh();
        }
        running(chart) {
            if (!this._running) {
                return false;
            }
            const anims = this._charts.get(chart);
            if (!anims || !anims.running || !anims.items.length) {
                return false;
            }
            return true;
        }
     stop(chart) {
            const anims = this._charts.get(chart);
            if (!anims || !anims.items.length) {
                return;
            }
            const items = anims.items;
            let i = items.length - 1;
            for(; i >= 0; --i){
                items[i].cancel();
            }
            anims.items = [];
            this._notify(chart, anims, Date.now(), 'complete');
        }
     remove(chart) {
            return this._charts.delete(chart);
        }
    }
    var animator = /* #__PURE__ */ new Animator();

    const transparent = 'transparent';
    const interpolators = {
        boolean (from, to, factor) {
            return factor > 0.5 ? to : from;
        },
     color (from, to, factor) {
            const c0 = color(from || transparent);
            const c1 = c0.valid && color(to || transparent);
            return c1 && c1.valid ? c1.mix(c0, factor).hexString() : to;
        },
        number (from, to, factor) {
            return from + (to - from) * factor;
        }
    };
    class Animation {
        constructor(cfg, target, prop, to){
            const currentValue = target[prop];
            to = resolve([
                cfg.to,
                to,
                currentValue,
                cfg.from
            ]);
            const from = resolve([
                cfg.from,
                currentValue,
                to
            ]);
            this._active = true;
            this._fn = cfg.fn || interpolators[cfg.type || typeof from];
            this._easing = effects$1[cfg.easing] || effects$1.linear;
            this._start = Math.floor(Date.now() + (cfg.delay || 0));
            this._duration = this._total = Math.floor(cfg.duration);
            this._loop = !!cfg.loop;
            this._target = target;
            this._prop = prop;
            this._from = from;
            this._to = to;
            this._promises = undefined;
        }
        active() {
            return this._active;
        }
        update(cfg, to, date) {
            if (this._active) {
                this._notify(false);
                const currentValue = this._target[this._prop];
                const elapsed = date - this._start;
                const remain = this._duration - elapsed;
                this._start = date;
                this._duration = Math.floor(Math.max(remain, cfg.duration));
                this._total += elapsed;
                this._loop = !!cfg.loop;
                this._to = resolve([
                    cfg.to,
                    to,
                    currentValue,
                    cfg.from
                ]);
                this._from = resolve([
                    cfg.from,
                    currentValue,
                    to
                ]);
            }
        }
        cancel() {
            if (this._active) {
                this.tick(Date.now());
                this._active = false;
                this._notify(false);
            }
        }
        tick(date) {
            const elapsed = date - this._start;
            const duration = this._duration;
            const prop = this._prop;
            const from = this._from;
            const loop = this._loop;
            const to = this._to;
            let factor;
            this._active = from !== to && (loop || elapsed < duration);
            if (!this._active) {
                this._target[prop] = to;
                this._notify(true);
                return;
            }
            if (elapsed < 0) {
                this._target[prop] = from;
                return;
            }
            factor = elapsed / duration % 2;
            factor = loop && factor > 1 ? 2 - factor : factor;
            factor = this._easing(Math.min(1, Math.max(0, factor)));
            this._target[prop] = this._fn(from, to, factor);
        }
        wait() {
            const promises = this._promises || (this._promises = []);
            return new Promise((res, rej)=>{
                promises.push({
                    res,
                    rej
                });
            });
        }
        _notify(resolved) {
            const method = resolved ? 'res' : 'rej';
            const promises = this._promises || [];
            for(let i = 0; i < promises.length; i++){
                promises[i][method]();
            }
        }
    }

    class Animations {
        constructor(chart, config){
            this._chart = chart;
            this._properties = new Map();
            this.configure(config);
        }
        configure(config) {
            if (!isObject(config)) {
                return;
            }
            const animationOptions = Object.keys(defaults.animation);
            const animatedProps = this._properties;
            Object.getOwnPropertyNames(config).forEach((key)=>{
                const cfg = config[key];
                if (!isObject(cfg)) {
                    return;
                }
                const resolved = {};
                for (const option of animationOptions){
                    resolved[option] = cfg[option];
                }
                (isArray(cfg.properties) && cfg.properties || [
                    key
                ]).forEach((prop)=>{
                    if (prop === key || !animatedProps.has(prop)) {
                        animatedProps.set(prop, resolved);
                    }
                });
            });
        }
     _animateOptions(target, values) {
            const newOptions = values.options;
            const options = resolveTargetOptions(target, newOptions);
            if (!options) {
                return [];
            }
            const animations = this._createAnimations(options, newOptions);
            if (newOptions.$shared) {
                awaitAll(target.options.$animations, newOptions).then(()=>{
                    target.options = newOptions;
                }, ()=>{
                });
            }
            return animations;
        }
     _createAnimations(target, values) {
            const animatedProps = this._properties;
            const animations = [];
            const running = target.$animations || (target.$animations = {});
            const props = Object.keys(values);
            const date = Date.now();
            let i;
            for(i = props.length - 1; i >= 0; --i){
                const prop = props[i];
                if (prop.charAt(0) === '$') {
                    continue;
                }
                if (prop === 'options') {
                    animations.push(...this._animateOptions(target, values));
                    continue;
                }
                const value = values[prop];
                let animation = running[prop];
                const cfg = animatedProps.get(prop);
                if (animation) {
                    if (cfg && animation.active()) {
                        animation.update(cfg, value, date);
                        continue;
                    } else {
                        animation.cancel();
                    }
                }
                if (!cfg || !cfg.duration) {
                    target[prop] = value;
                    continue;
                }
                running[prop] = animation = new Animation(cfg, target, prop, value);
                animations.push(animation);
            }
            return animations;
        }
     update(target, values) {
            if (this._properties.size === 0) {
                Object.assign(target, values);
                return;
            }
            const animations = this._createAnimations(target, values);
            if (animations.length) {
                animator.add(this._chart, animations);
                return true;
            }
        }
    }function awaitAll(animations, properties) {
        const running = [];
        const keys = Object.keys(properties);
        for(let i = 0; i < keys.length; i++){
            const anim = animations[keys[i]];
            if (anim && anim.active()) {
                running.push(anim.wait());
            }
        }
        return Promise.all(running);
    }
    function resolveTargetOptions(target, newOptions) {
        if (!newOptions) {
            return;
        }
        let options = target.options;
        if (!options) {
            target.options = newOptions;
            return;
        }
        if (options.$shared) {
            target.options = options = Object.assign({}, options, {
                $shared: false,
                $animations: {}
            });
        }
        return options;
    }

    function scaleClip(scale, allowedOverflow) {
        const opts = scale && scale.options || {};
        const reverse = opts.reverse;
        const min = opts.min === undefined ? allowedOverflow : 0;
        const max = opts.max === undefined ? allowedOverflow : 0;
        return {
            start: reverse ? max : min,
            end: reverse ? min : max
        };
    }
    function defaultClip(xScale, yScale, allowedOverflow) {
        if (allowedOverflow === false) {
            return false;
        }
        const x = scaleClip(xScale, allowedOverflow);
        const y = scaleClip(yScale, allowedOverflow);
        return {
            top: y.end,
            right: x.end,
            bottom: y.start,
            left: x.start
        };
    }
    function toClip(value) {
        let t, r, b, l;
        if (isObject(value)) {
            t = value.top;
            r = value.right;
            b = value.bottom;
            l = value.left;
        } else {
            t = r = b = l = value;
        }
        return {
            top: t,
            right: r,
            bottom: b,
            left: l,
            disabled: value === false
        };
    }
    function getSortedDatasetIndices(chart, filterVisible) {
        const keys = [];
        const metasets = chart._getSortedDatasetMetas(filterVisible);
        let i, ilen;
        for(i = 0, ilen = metasets.length; i < ilen; ++i){
            keys.push(metasets[i].index);
        }
        return keys;
    }
    function applyStack(stack, value, dsIndex, options = {}) {
        const keys = stack.keys;
        const singleMode = options.mode === 'single';
        let i, ilen, datasetIndex, otherValue;
        if (value === null) {
            return;
        }
        for(i = 0, ilen = keys.length; i < ilen; ++i){
            datasetIndex = +keys[i];
            if (datasetIndex === dsIndex) {
                if (options.all) {
                    continue;
                }
                break;
            }
            otherValue = stack.values[datasetIndex];
            if (isNumberFinite(otherValue) && (singleMode || value === 0 || sign(value) === sign(otherValue))) {
                value += otherValue;
            }
        }
        return value;
    }
    function convertObjectDataToArray(data) {
        const keys = Object.keys(data);
        const adata = new Array(keys.length);
        let i, ilen, key;
        for(i = 0, ilen = keys.length; i < ilen; ++i){
            key = keys[i];
            adata[i] = {
                x: key,
                y: data[key]
            };
        }
        return adata;
    }
    function isStacked(scale, meta) {
        const stacked = scale && scale.options.stacked;
        return stacked || stacked === undefined && meta.stack !== undefined;
    }
    function getStackKey(indexScale, valueScale, meta) {
        return `${indexScale.id}.${valueScale.id}.${meta.stack || meta.type}`;
    }
    function getUserBounds(scale) {
        const { min , max , minDefined , maxDefined  } = scale.getUserBounds();
        return {
            min: minDefined ? min : Number.NEGATIVE_INFINITY,
            max: maxDefined ? max : Number.POSITIVE_INFINITY
        };
    }
    function getOrCreateStack(stacks, stackKey, indexValue) {
        const subStack = stacks[stackKey] || (stacks[stackKey] = {});
        return subStack[indexValue] || (subStack[indexValue] = {});
    }
    function getLastIndexInStack(stack, vScale, positive, type) {
        for (const meta of vScale.getMatchingVisibleMetas(type).reverse()){
            const value = stack[meta.index];
            if (positive && value > 0 || !positive && value < 0) {
                return meta.index;
            }
        }
        return null;
    }
    function updateStacks(controller, parsed) {
        const { chart , _cachedMeta: meta  } = controller;
        const stacks = chart._stacks || (chart._stacks = {});
        const { iScale , vScale , index: datasetIndex  } = meta;
        const iAxis = iScale.axis;
        const vAxis = vScale.axis;
        const key = getStackKey(iScale, vScale, meta);
        const ilen = parsed.length;
        let stack;
        for(let i = 0; i < ilen; ++i){
            const item = parsed[i];
            const { [iAxis]: index , [vAxis]: value  } = item;
            const itemStacks = item._stacks || (item._stacks = {});
            stack = itemStacks[vAxis] = getOrCreateStack(stacks, key, index);
            stack[datasetIndex] = value;
            stack._top = getLastIndexInStack(stack, vScale, true, meta.type);
            stack._bottom = getLastIndexInStack(stack, vScale, false, meta.type);
        }
    }
    function getFirstScaleId(chart, axis) {
        const scales = chart.scales;
        return Object.keys(scales).filter((key)=>scales[key].axis === axis).shift();
    }
    function createDatasetContext(parent, index) {
        return createContext(parent, {
            active: false,
            dataset: undefined,
            datasetIndex: index,
            index,
            mode: 'default',
            type: 'dataset'
        });
    }
    function createDataContext(parent, index, element) {
        return createContext(parent, {
            active: false,
            dataIndex: index,
            parsed: undefined,
            raw: undefined,
            element,
            index,
            mode: 'default',
            type: 'data'
        });
    }
    function clearStacks(meta, items) {
        const datasetIndex = meta.controller.index;
        const axis = meta.vScale && meta.vScale.axis;
        if (!axis) {
            return;
        }
        items = items || meta._parsed;
        for (const parsed of items){
            const stacks = parsed._stacks;
            if (!stacks || stacks[axis] === undefined || stacks[axis][datasetIndex] === undefined) {
                return;
            }
            delete stacks[axis][datasetIndex];
        }
    }
    const isDirectUpdateMode = (mode)=>mode === 'reset' || mode === 'none';
    const cloneIfNotShared = (cached, shared)=>shared ? cached : Object.assign({}, cached);
    const createStack = (canStack, meta, chart)=>canStack && !meta.hidden && meta._stacked && {
            keys: getSortedDatasetIndices(chart, true),
            values: null
        };
    class DatasetController {
     static defaults = {};
     static datasetElementType = null;
     static dataElementType = null;
     constructor(chart, datasetIndex){
            this.chart = chart;
            this._ctx = chart.ctx;
            this.index = datasetIndex;
            this._cachedDataOpts = {};
            this._cachedMeta = this.getMeta();
            this._type = this._cachedMeta.type;
            this.options = undefined;
             this._parsing = false;
            this._data = undefined;
            this._objectData = undefined;
            this._sharedOptions = undefined;
            this._drawStart = undefined;
            this._drawCount = undefined;
            this.enableOptionSharing = false;
            this.supportsDecimation = false;
            this.$context = undefined;
            this._syncList = [];
            this.datasetElementType = new.target.datasetElementType;
            this.dataElementType = new.target.dataElementType;
            this.initialize();
        }
        initialize() {
            const meta = this._cachedMeta;
            this.configure();
            this.linkScales();
            meta._stacked = isStacked(meta.vScale, meta);
            this.addElements();
            if (this.options.fill && !this.chart.isPluginEnabled('filler')) {
                console.warn("Tried to use the 'fill' option without the 'Filler' plugin enabled. Please import and register the 'Filler' plugin and make sure it is not disabled in the options");
            }
        }
        updateIndex(datasetIndex) {
            if (this.index !== datasetIndex) {
                clearStacks(this._cachedMeta);
            }
            this.index = datasetIndex;
        }
        linkScales() {
            const chart = this.chart;
            const meta = this._cachedMeta;
            const dataset = this.getDataset();
            const chooseId = (axis, x, y, r)=>axis === 'x' ? x : axis === 'r' ? r : y;
            const xid = meta.xAxisID = valueOrDefault(dataset.xAxisID, getFirstScaleId(chart, 'x'));
            const yid = meta.yAxisID = valueOrDefault(dataset.yAxisID, getFirstScaleId(chart, 'y'));
            const rid = meta.rAxisID = valueOrDefault(dataset.rAxisID, getFirstScaleId(chart, 'r'));
            const indexAxis = meta.indexAxis;
            const iid = meta.iAxisID = chooseId(indexAxis, xid, yid, rid);
            const vid = meta.vAxisID = chooseId(indexAxis, yid, xid, rid);
            meta.xScale = this.getScaleForId(xid);
            meta.yScale = this.getScaleForId(yid);
            meta.rScale = this.getScaleForId(rid);
            meta.iScale = this.getScaleForId(iid);
            meta.vScale = this.getScaleForId(vid);
        }
        getDataset() {
            return this.chart.data.datasets[this.index];
        }
        getMeta() {
            return this.chart.getDatasetMeta(this.index);
        }
     getScaleForId(scaleID) {
            return this.chart.scales[scaleID];
        }
     _getOtherScale(scale) {
            const meta = this._cachedMeta;
            return scale === meta.iScale ? meta.vScale : meta.iScale;
        }
        reset() {
            this._update('reset');
        }
     _destroy() {
            const meta = this._cachedMeta;
            if (this._data) {
                unlistenArrayEvents(this._data, this);
            }
            if (meta._stacked) {
                clearStacks(meta);
            }
        }
     _dataCheck() {
            const dataset = this.getDataset();
            const data = dataset.data || (dataset.data = []);
            const _data = this._data;
            if (isObject(data)) {
                this._data = convertObjectDataToArray(data);
            } else if (_data !== data) {
                if (_data) {
                    unlistenArrayEvents(_data, this);
                    const meta = this._cachedMeta;
                    clearStacks(meta);
                    meta._parsed = [];
                }
                if (data && Object.isExtensible(data)) {
                    listenArrayEvents(data, this);
                }
                this._syncList = [];
                this._data = data;
            }
        }
        addElements() {
            const meta = this._cachedMeta;
            this._dataCheck();
            if (this.datasetElementType) {
                meta.dataset = new this.datasetElementType();
            }
        }
        buildOrUpdateElements(resetNewElements) {
            const meta = this._cachedMeta;
            const dataset = this.getDataset();
            let stackChanged = false;
            this._dataCheck();
            const oldStacked = meta._stacked;
            meta._stacked = isStacked(meta.vScale, meta);
            if (meta.stack !== dataset.stack) {
                stackChanged = true;
                clearStacks(meta);
                meta.stack = dataset.stack;
            }
            this._resyncElements(resetNewElements);
            if (stackChanged || oldStacked !== meta._stacked) {
                updateStacks(this, meta._parsed);
            }
        }
     configure() {
            const config = this.chart.config;
            const scopeKeys = config.datasetScopeKeys(this._type);
            const scopes = config.getOptionScopes(this.getDataset(), scopeKeys, true);
            this.options = config.createResolver(scopes, this.getContext());
            this._parsing = this.options.parsing;
            this._cachedDataOpts = {};
        }
     parse(start, count) {
            const { _cachedMeta: meta , _data: data  } = this;
            const { iScale , _stacked  } = meta;
            const iAxis = iScale.axis;
            let sorted = start === 0 && count === data.length ? true : meta._sorted;
            let prev = start > 0 && meta._parsed[start - 1];
            let i, cur, parsed;
            if (this._parsing === false) {
                meta._parsed = data;
                meta._sorted = true;
                parsed = data;
            } else {
                if (isArray(data[start])) {
                    parsed = this.parseArrayData(meta, data, start, count);
                } else if (isObject(data[start])) {
                    parsed = this.parseObjectData(meta, data, start, count);
                } else {
                    parsed = this.parsePrimitiveData(meta, data, start, count);
                }
                const isNotInOrderComparedToPrev = ()=>cur[iAxis] === null || prev && cur[iAxis] < prev[iAxis];
                for(i = 0; i < count; ++i){
                    meta._parsed[i + start] = cur = parsed[i];
                    if (sorted) {
                        if (isNotInOrderComparedToPrev()) {
                            sorted = false;
                        }
                        prev = cur;
                    }
                }
                meta._sorted = sorted;
            }
            if (_stacked) {
                updateStacks(this, parsed);
            }
        }
     parsePrimitiveData(meta, data, start, count) {
            const { iScale , vScale  } = meta;
            const iAxis = iScale.axis;
            const vAxis = vScale.axis;
            const labels = iScale.getLabels();
            const singleScale = iScale === vScale;
            const parsed = new Array(count);
            let i, ilen, index;
            for(i = 0, ilen = count; i < ilen; ++i){
                index = i + start;
                parsed[i] = {
                    [iAxis]: singleScale || iScale.parse(labels[index], index),
                    [vAxis]: vScale.parse(data[index], index)
                };
            }
            return parsed;
        }
     parseArrayData(meta, data, start, count) {
            const { xScale , yScale  } = meta;
            const parsed = new Array(count);
            let i, ilen, index, item;
            for(i = 0, ilen = count; i < ilen; ++i){
                index = i + start;
                item = data[index];
                parsed[i] = {
                    x: xScale.parse(item[0], index),
                    y: yScale.parse(item[1], index)
                };
            }
            return parsed;
        }
     parseObjectData(meta, data, start, count) {
            const { xScale , yScale  } = meta;
            const { xAxisKey ='x' , yAxisKey ='y'  } = this._parsing;
            const parsed = new Array(count);
            let i, ilen, index, item;
            for(i = 0, ilen = count; i < ilen; ++i){
                index = i + start;
                item = data[index];
                parsed[i] = {
                    x: xScale.parse(resolveObjectKey(item, xAxisKey), index),
                    y: yScale.parse(resolveObjectKey(item, yAxisKey), index)
                };
            }
            return parsed;
        }
     getParsed(index) {
            return this._cachedMeta._parsed[index];
        }
     getDataElement(index) {
            return this._cachedMeta.data[index];
        }
     applyStack(scale, parsed, mode) {
            const chart = this.chart;
            const meta = this._cachedMeta;
            const value = parsed[scale.axis];
            const stack = {
                keys: getSortedDatasetIndices(chart, true),
                values: parsed._stacks[scale.axis]
            };
            return applyStack(stack, value, meta.index, {
                mode
            });
        }
     updateRangeFromParsed(range, scale, parsed, stack) {
            const parsedValue = parsed[scale.axis];
            let value = parsedValue === null ? NaN : parsedValue;
            const values = stack && parsed._stacks[scale.axis];
            if (stack && values) {
                stack.values = values;
                value = applyStack(stack, parsedValue, this._cachedMeta.index);
            }
            range.min = Math.min(range.min, value);
            range.max = Math.max(range.max, value);
        }
     getMinMax(scale, canStack) {
            const meta = this._cachedMeta;
            const _parsed = meta._parsed;
            const sorted = meta._sorted && scale === meta.iScale;
            const ilen = _parsed.length;
            const otherScale = this._getOtherScale(scale);
            const stack = createStack(canStack, meta, this.chart);
            const range = {
                min: Number.POSITIVE_INFINITY,
                max: Number.NEGATIVE_INFINITY
            };
            const { min: otherMin , max: otherMax  } = getUserBounds(otherScale);
            let i, parsed;
            function _skip() {
                parsed = _parsed[i];
                const otherValue = parsed[otherScale.axis];
                return !isNumberFinite(parsed[scale.axis]) || otherMin > otherValue || otherMax < otherValue;
            }
            for(i = 0; i < ilen; ++i){
                if (_skip()) {
                    continue;
                }
                this.updateRangeFromParsed(range, scale, parsed, stack);
                if (sorted) {
                    break;
                }
            }
            if (sorted) {
                for(i = ilen - 1; i >= 0; --i){
                    if (_skip()) {
                        continue;
                    }
                    this.updateRangeFromParsed(range, scale, parsed, stack);
                    break;
                }
            }
            return range;
        }
        getAllParsedValues(scale) {
            const parsed = this._cachedMeta._parsed;
            const values = [];
            let i, ilen, value;
            for(i = 0, ilen = parsed.length; i < ilen; ++i){
                value = parsed[i][scale.axis];
                if (isNumberFinite(value)) {
                    values.push(value);
                }
            }
            return values;
        }
     getMaxOverflow() {
            return false;
        }
     getLabelAndValue(index) {
            const meta = this._cachedMeta;
            const iScale = meta.iScale;
            const vScale = meta.vScale;
            const parsed = this.getParsed(index);
            return {
                label: iScale ? '' + iScale.getLabelForValue(parsed[iScale.axis]) : '',
                value: vScale ? '' + vScale.getLabelForValue(parsed[vScale.axis]) : ''
            };
        }
     _update(mode) {
            const meta = this._cachedMeta;
            this.update(mode || 'default');
            meta._clip = toClip(valueOrDefault(this.options.clip, defaultClip(meta.xScale, meta.yScale, this.getMaxOverflow())));
        }
     update(mode) {}
        draw() {
            const ctx = this._ctx;
            const chart = this.chart;
            const meta = this._cachedMeta;
            const elements = meta.data || [];
            const area = chart.chartArea;
            const active = [];
            const start = this._drawStart || 0;
            const count = this._drawCount || elements.length - start;
            const drawActiveElementsOnTop = this.options.drawActiveElementsOnTop;
            let i;
            if (meta.dataset) {
                meta.dataset.draw(ctx, area, start, count);
            }
            for(i = start; i < start + count; ++i){
                const element = elements[i];
                if (element.hidden) {
                    continue;
                }
                if (element.active && drawActiveElementsOnTop) {
                    active.push(element);
                } else {
                    element.draw(ctx, area);
                }
            }
            for(i = 0; i < active.length; ++i){
                active[i].draw(ctx, area);
            }
        }
     getStyle(index, active) {
            const mode = active ? 'active' : 'default';
            return index === undefined && this._cachedMeta.dataset ? this.resolveDatasetElementOptions(mode) : this.resolveDataElementOptions(index || 0, mode);
        }
     getContext(index, active, mode) {
            const dataset = this.getDataset();
            let context;
            if (index >= 0 && index < this._cachedMeta.data.length) {
                const element = this._cachedMeta.data[index];
                context = element.$context || (element.$context = createDataContext(this.getContext(), index, element));
                context.parsed = this.getParsed(index);
                context.raw = dataset.data[index];
                context.index = context.dataIndex = index;
            } else {
                context = this.$context || (this.$context = createDatasetContext(this.chart.getContext(), this.index));
                context.dataset = dataset;
                context.index = context.datasetIndex = this.index;
            }
            context.active = !!active;
            context.mode = mode;
            return context;
        }
     resolveDatasetElementOptions(mode) {
            return this._resolveElementOptions(this.datasetElementType.id, mode);
        }
     resolveDataElementOptions(index, mode) {
            return this._resolveElementOptions(this.dataElementType.id, mode, index);
        }
     _resolveElementOptions(elementType, mode = 'default', index) {
            const active = mode === 'active';
            const cache = this._cachedDataOpts;
            const cacheKey = elementType + '-' + mode;
            const cached = cache[cacheKey];
            const sharing = this.enableOptionSharing && defined(index);
            if (cached) {
                return cloneIfNotShared(cached, sharing);
            }
            const config = this.chart.config;
            const scopeKeys = config.datasetElementScopeKeys(this._type, elementType);
            const prefixes = active ? [
                `${elementType}Hover`,
                'hover',
                elementType,
                ''
            ] : [
                elementType,
                ''
            ];
            const scopes = config.getOptionScopes(this.getDataset(), scopeKeys);
            const names = Object.keys(defaults.elements[elementType]);
            const context = ()=>this.getContext(index, active);
            const values = config.resolveNamedOptions(scopes, names, context, prefixes);
            if (values.$shared) {
                values.$shared = sharing;
                cache[cacheKey] = Object.freeze(cloneIfNotShared(values, sharing));
            }
            return values;
        }
     _resolveAnimations(index, transition, active) {
            const chart = this.chart;
            const cache = this._cachedDataOpts;
            const cacheKey = `animation-${transition}`;
            const cached = cache[cacheKey];
            if (cached) {
                return cached;
            }
            let options;
            if (chart.options.animation !== false) {
                const config = this.chart.config;
                const scopeKeys = config.datasetAnimationScopeKeys(this._type, transition);
                const scopes = config.getOptionScopes(this.getDataset(), scopeKeys);
                options = config.createResolver(scopes, this.getContext(index, active, transition));
            }
            const animations = new Animations(chart, options && options.animations);
            if (options && options._cacheable) {
                cache[cacheKey] = Object.freeze(animations);
            }
            return animations;
        }
     getSharedOptions(options) {
            if (!options.$shared) {
                return;
            }
            return this._sharedOptions || (this._sharedOptions = Object.assign({}, options));
        }
     includeOptions(mode, sharedOptions) {
            return !sharedOptions || isDirectUpdateMode(mode) || this.chart._animationsDisabled;
        }
     _getSharedOptions(start, mode) {
            const firstOpts = this.resolveDataElementOptions(start, mode);
            const previouslySharedOptions = this._sharedOptions;
            const sharedOptions = this.getSharedOptions(firstOpts);
            const includeOptions = this.includeOptions(mode, sharedOptions) || sharedOptions !== previouslySharedOptions;
            this.updateSharedOptions(sharedOptions, mode, firstOpts);
            return {
                sharedOptions,
                includeOptions
            };
        }
     updateElement(element, index, properties, mode) {
            if (isDirectUpdateMode(mode)) {
                Object.assign(element, properties);
            } else {
                this._resolveAnimations(index, mode).update(element, properties);
            }
        }
     updateSharedOptions(sharedOptions, mode, newOptions) {
            if (sharedOptions && !isDirectUpdateMode(mode)) {
                this._resolveAnimations(undefined, mode).update(sharedOptions, newOptions);
            }
        }
     _setStyle(element, index, mode, active) {
            element.active = active;
            const options = this.getStyle(index, active);
            this._resolveAnimations(index, mode, active).update(element, {
                options: !active && this.getSharedOptions(options) || options
            });
        }
        removeHoverStyle(element, datasetIndex, index) {
            this._setStyle(element, index, 'active', false);
        }
        setHoverStyle(element, datasetIndex, index) {
            this._setStyle(element, index, 'active', true);
        }
     _removeDatasetHoverStyle() {
            const element = this._cachedMeta.dataset;
            if (element) {
                this._setStyle(element, undefined, 'active', false);
            }
        }
     _setDatasetHoverStyle() {
            const element = this._cachedMeta.dataset;
            if (element) {
                this._setStyle(element, undefined, 'active', true);
            }
        }
     _resyncElements(resetNewElements) {
            const data = this._data;
            const elements = this._cachedMeta.data;
            for (const [method, arg1, arg2] of this._syncList){
                this[method](arg1, arg2);
            }
            this._syncList = [];
            const numMeta = elements.length;
            const numData = data.length;
            const count = Math.min(numData, numMeta);
            if (count) {
                this.parse(0, count);
            }
            if (numData > numMeta) {
                this._insertElements(numMeta, numData - numMeta, resetNewElements);
            } else if (numData < numMeta) {
                this._removeElements(numData, numMeta - numData);
            }
        }
     _insertElements(start, count, resetNewElements = true) {
            const meta = this._cachedMeta;
            const data = meta.data;
            const end = start + count;
            let i;
            const move = (arr)=>{
                arr.length += count;
                for(i = arr.length - 1; i >= end; i--){
                    arr[i] = arr[i - count];
                }
            };
            move(data);
            for(i = start; i < end; ++i){
                data[i] = new this.dataElementType();
            }
            if (this._parsing) {
                move(meta._parsed);
            }
            this.parse(start, count);
            if (resetNewElements) {
                this.updateElements(data, start, count, 'reset');
            }
        }
        updateElements(element, start, count, mode) {}
     _removeElements(start, count) {
            const meta = this._cachedMeta;
            if (this._parsing) {
                const removed = meta._parsed.splice(start, count);
                if (meta._stacked) {
                    clearStacks(meta, removed);
                }
            }
            meta.data.splice(start, count);
        }
     _sync(args) {
            if (this._parsing) {
                this._syncList.push(args);
            } else {
                const [method, arg1, arg2] = args;
                this[method](arg1, arg2);
            }
            this.chart._dataChanges.push([
                this.index,
                ...args
            ]);
        }
        _onDataPush() {
            const count = arguments.length;
            this._sync([
                '_insertElements',
                this.getDataset().data.length - count,
                count
            ]);
        }
        _onDataPop() {
            this._sync([
                '_removeElements',
                this._cachedMeta.data.length - 1,
                1
            ]);
        }
        _onDataShift() {
            this._sync([
                '_removeElements',
                0,
                1
            ]);
        }
        _onDataSplice(start, count) {
            if (count) {
                this._sync([
                    '_removeElements',
                    start,
                    count
                ]);
            }
            const newCount = arguments.length - 2;
            if (newCount) {
                this._sync([
                    '_insertElements',
                    start,
                    newCount
                ]);
            }
        }
        _onDataUnshift() {
            this._sync([
                '_insertElements',
                0,
                arguments.length
            ]);
        }
    }

    function getAllScaleValues(scale, type) {
        if (!scale._cache.$bar) {
            const visibleMetas = scale.getMatchingVisibleMetas(type);
            let values = [];
            for(let i = 0, ilen = visibleMetas.length; i < ilen; i++){
                values = values.concat(visibleMetas[i].controller.getAllParsedValues(scale));
            }
            scale._cache.$bar = _arrayUnique(values.sort((a, b)=>a - b));
        }
        return scale._cache.$bar;
    }
     function computeMinSampleSize(meta) {
        const scale = meta.iScale;
        const values = getAllScaleValues(scale, meta.type);
        let min = scale._length;
        let i, ilen, curr, prev;
        const updateMinAndPrev = ()=>{
            if (curr === 32767 || curr === -32768) {
                return;
            }
            if (defined(prev)) {
                min = Math.min(min, Math.abs(curr - prev) || min);
            }
            prev = curr;
        };
        for(i = 0, ilen = values.length; i < ilen; ++i){
            curr = scale.getPixelForValue(values[i]);
            updateMinAndPrev();
        }
        prev = undefined;
        for(i = 0, ilen = scale.ticks.length; i < ilen; ++i){
            curr = scale.getPixelForTick(i);
            updateMinAndPrev();
        }
        return min;
    }
     function computeFitCategoryTraits(index, ruler, options, stackCount) {
        const thickness = options.barThickness;
        let size, ratio;
        if (isNullOrUndef(thickness)) {
            size = ruler.min * options.categoryPercentage;
            ratio = options.barPercentage;
        } else {
            size = thickness * stackCount;
            ratio = 1;
        }
        return {
            chunk: size / stackCount,
            ratio,
            start: ruler.pixels[index] - size / 2
        };
    }
     function computeFlexCategoryTraits(index, ruler, options, stackCount) {
        const pixels = ruler.pixels;
        const curr = pixels[index];
        let prev = index > 0 ? pixels[index - 1] : null;
        let next = index < pixels.length - 1 ? pixels[index + 1] : null;
        const percent = options.categoryPercentage;
        if (prev === null) {
            prev = curr - (next === null ? ruler.end - ruler.start : next - curr);
        }
        if (next === null) {
            next = curr + curr - prev;
        }
        const start = curr - (curr - Math.min(prev, next)) / 2 * percent;
        const size = Math.abs(next - prev) / 2 * percent;
        return {
            chunk: size / stackCount,
            ratio: options.barPercentage,
            start
        };
    }
    function parseFloatBar(entry, item, vScale, i) {
        const startValue = vScale.parse(entry[0], i);
        const endValue = vScale.parse(entry[1], i);
        const min = Math.min(startValue, endValue);
        const max = Math.max(startValue, endValue);
        let barStart = min;
        let barEnd = max;
        if (Math.abs(min) > Math.abs(max)) {
            barStart = max;
            barEnd = min;
        }
        item[vScale.axis] = barEnd;
        item._custom = {
            barStart,
            barEnd,
            start: startValue,
            end: endValue,
            min,
            max
        };
    }
    function parseValue(entry, item, vScale, i) {
        if (isArray(entry)) {
            parseFloatBar(entry, item, vScale, i);
        } else {
            item[vScale.axis] = vScale.parse(entry, i);
        }
        return item;
    }
    function parseArrayOrPrimitive(meta, data, start, count) {
        const iScale = meta.iScale;
        const vScale = meta.vScale;
        const labels = iScale.getLabels();
        const singleScale = iScale === vScale;
        const parsed = [];
        let i, ilen, item, entry;
        for(i = start, ilen = start + count; i < ilen; ++i){
            entry = data[i];
            item = {};
            item[iScale.axis] = singleScale || iScale.parse(labels[i], i);
            parsed.push(parseValue(entry, item, vScale, i));
        }
        return parsed;
    }
    function isFloatBar(custom) {
        return custom && custom.barStart !== undefined && custom.barEnd !== undefined;
    }
    function barSign(size, vScale, actualBase) {
        if (size !== 0) {
            return sign(size);
        }
        return (vScale.isHorizontal() ? 1 : -1) * (vScale.min >= actualBase ? 1 : -1);
    }
    function borderProps(properties) {
        let reverse, start, end, top, bottom;
        if (properties.horizontal) {
            reverse = properties.base > properties.x;
            start = 'left';
            end = 'right';
        } else {
            reverse = properties.base < properties.y;
            start = 'bottom';
            end = 'top';
        }
        if (reverse) {
            top = 'end';
            bottom = 'start';
        } else {
            top = 'start';
            bottom = 'end';
        }
        return {
            start,
            end,
            reverse,
            top,
            bottom
        };
    }
    function setBorderSkipped(properties, options, stack, index) {
        let edge = options.borderSkipped;
        const res = {};
        if (!edge) {
            properties.borderSkipped = res;
            return;
        }
        if (edge === true) {
            properties.borderSkipped = {
                top: true,
                right: true,
                bottom: true,
                left: true
            };
            return;
        }
        const { start , end , reverse , top , bottom  } = borderProps(properties);
        if (edge === 'middle' && stack) {
            properties.enableBorderRadius = true;
            if ((stack._top || 0) === index) {
                edge = top;
            } else if ((stack._bottom || 0) === index) {
                edge = bottom;
            } else {
                res[parseEdge(bottom, start, end, reverse)] = true;
                edge = top;
            }
        }
        res[parseEdge(edge, start, end, reverse)] = true;
        properties.borderSkipped = res;
    }
    function parseEdge(edge, a, b, reverse) {
        if (reverse) {
            edge = swap(edge, a, b);
            edge = startEnd(edge, b, a);
        } else {
            edge = startEnd(edge, a, b);
        }
        return edge;
    }
    function swap(orig, v1, v2) {
        return orig === v1 ? v2 : orig === v2 ? v1 : orig;
    }
    function startEnd(v, start, end) {
        return v === 'start' ? start : v === 'end' ? end : v;
    }
    function setInflateAmount(properties, { inflateAmount  }, ratio) {
        properties.inflateAmount = inflateAmount === 'auto' ? ratio === 1 ? 0.33 : 0 : inflateAmount;
    }
    class BarController extends DatasetController {
        static id = 'bar';
     static defaults = {
            datasetElementType: false,
            dataElementType: 'bar',
            categoryPercentage: 0.8,
            barPercentage: 0.9,
            grouped: true,
            animations: {
                numbers: {
                    type: 'number',
                    properties: [
                        'x',
                        'y',
                        'base',
                        'width',
                        'height'
                    ]
                }
            }
        };
     static overrides = {
            scales: {
                _index_: {
                    type: 'category',
                    offset: true,
                    grid: {
                        offset: true
                    }
                },
                _value_: {
                    type: 'linear',
                    beginAtZero: true
                }
            }
        };
     parsePrimitiveData(meta, data, start, count) {
            return parseArrayOrPrimitive(meta, data, start, count);
        }
     parseArrayData(meta, data, start, count) {
            return parseArrayOrPrimitive(meta, data, start, count);
        }
     parseObjectData(meta, data, start, count) {
            const { iScale , vScale  } = meta;
            const { xAxisKey ='x' , yAxisKey ='y'  } = this._parsing;
            const iAxisKey = iScale.axis === 'x' ? xAxisKey : yAxisKey;
            const vAxisKey = vScale.axis === 'x' ? xAxisKey : yAxisKey;
            const parsed = [];
            let i, ilen, item, obj;
            for(i = start, ilen = start + count; i < ilen; ++i){
                obj = data[i];
                item = {};
                item[iScale.axis] = iScale.parse(resolveObjectKey(obj, iAxisKey), i);
                parsed.push(parseValue(resolveObjectKey(obj, vAxisKey), item, vScale, i));
            }
            return parsed;
        }
     updateRangeFromParsed(range, scale, parsed, stack) {
            super.updateRangeFromParsed(range, scale, parsed, stack);
            const custom = parsed._custom;
            if (custom && scale === this._cachedMeta.vScale) {
                range.min = Math.min(range.min, custom.min);
                range.max = Math.max(range.max, custom.max);
            }
        }
     getMaxOverflow() {
            return 0;
        }
     getLabelAndValue(index) {
            const meta = this._cachedMeta;
            const { iScale , vScale  } = meta;
            const parsed = this.getParsed(index);
            const custom = parsed._custom;
            const value = isFloatBar(custom) ? '[' + custom.start + ', ' + custom.end + ']' : '' + vScale.getLabelForValue(parsed[vScale.axis]);
            return {
                label: '' + iScale.getLabelForValue(parsed[iScale.axis]),
                value
            };
        }
        initialize() {
            this.enableOptionSharing = true;
            super.initialize();
            const meta = this._cachedMeta;
            meta.stack = this.getDataset().stack;
        }
        update(mode) {
            const meta = this._cachedMeta;
            this.updateElements(meta.data, 0, meta.data.length, mode);
        }
        updateElements(bars, start, count, mode) {
            const reset = mode === 'reset';
            const { index , _cachedMeta: { vScale  }  } = this;
            const base = vScale.getBasePixel();
            const horizontal = vScale.isHorizontal();
            const ruler = this._getRuler();
            const { sharedOptions , includeOptions  } = this._getSharedOptions(start, mode);
            for(let i = start; i < start + count; i++){
                const parsed = this.getParsed(i);
                const vpixels = reset || isNullOrUndef(parsed[vScale.axis]) ? {
                    base,
                    head: base
                } : this._calculateBarValuePixels(i);
                const ipixels = this._calculateBarIndexPixels(i, ruler);
                const stack = (parsed._stacks || {})[vScale.axis];
                const properties = {
                    horizontal,
                    base: vpixels.base,
                    enableBorderRadius: !stack || isFloatBar(parsed._custom) || index === stack._top || index === stack._bottom,
                    x: horizontal ? vpixels.head : ipixels.center,
                    y: horizontal ? ipixels.center : vpixels.head,
                    height: horizontal ? ipixels.size : Math.abs(vpixels.size),
                    width: horizontal ? Math.abs(vpixels.size) : ipixels.size
                };
                if (includeOptions) {
                    properties.options = sharedOptions || this.resolveDataElementOptions(i, bars[i].active ? 'active' : mode);
                }
                const options = properties.options || bars[i].options;
                setBorderSkipped(properties, options, stack, index);
                setInflateAmount(properties, options, ruler.ratio);
                this.updateElement(bars[i], i, properties, mode);
            }
        }
     _getStacks(last, dataIndex) {
            const { iScale  } = this._cachedMeta;
            const metasets = iScale.getMatchingVisibleMetas(this._type).filter((meta)=>meta.controller.options.grouped);
            const stacked = iScale.options.stacked;
            const stacks = [];
            const skipNull = (meta)=>{
                const parsed = meta.controller.getParsed(dataIndex);
                const val = parsed && parsed[meta.vScale.axis];
                if (isNullOrUndef(val) || isNaN(val)) {
                    return true;
                }
            };
            for (const meta of metasets){
                if (dataIndex !== undefined && skipNull(meta)) {
                    continue;
                }
                if (stacked === false || stacks.indexOf(meta.stack) === -1 || stacked === undefined && meta.stack === undefined) {
                    stacks.push(meta.stack);
                }
                if (meta.index === last) {
                    break;
                }
            }
            if (!stacks.length) {
                stacks.push(undefined);
            }
            return stacks;
        }
     _getStackCount(index) {
            return this._getStacks(undefined, index).length;
        }
     _getStackIndex(datasetIndex, name, dataIndex) {
            const stacks = this._getStacks(datasetIndex, dataIndex);
            const index = name !== undefined ? stacks.indexOf(name) : -1;
            return index === -1 ? stacks.length - 1 : index;
        }
     _getRuler() {
            const opts = this.options;
            const meta = this._cachedMeta;
            const iScale = meta.iScale;
            const pixels = [];
            let i, ilen;
            for(i = 0, ilen = meta.data.length; i < ilen; ++i){
                pixels.push(iScale.getPixelForValue(this.getParsed(i)[iScale.axis], i));
            }
            const barThickness = opts.barThickness;
            const min = barThickness || computeMinSampleSize(meta);
            return {
                min,
                pixels,
                start: iScale._startPixel,
                end: iScale._endPixel,
                stackCount: this._getStackCount(),
                scale: iScale,
                grouped: opts.grouped,
                ratio: barThickness ? 1 : opts.categoryPercentage * opts.barPercentage
            };
        }
     _calculateBarValuePixels(index) {
            const { _cachedMeta: { vScale , _stacked  } , options: { base: baseValue , minBarLength  }  } = this;
            const actualBase = baseValue || 0;
            const parsed = this.getParsed(index);
            const custom = parsed._custom;
            const floating = isFloatBar(custom);
            let value = parsed[vScale.axis];
            let start = 0;
            let length = _stacked ? this.applyStack(vScale, parsed, _stacked) : value;
            let head, size;
            if (length !== value) {
                start = length - value;
                length = value;
            }
            if (floating) {
                value = custom.barStart;
                length = custom.barEnd - custom.barStart;
                if (value !== 0 && sign(value) !== sign(custom.barEnd)) {
                    start = 0;
                }
                start += value;
            }
            const startValue = !isNullOrUndef(baseValue) && !floating ? baseValue : start;
            let base = vScale.getPixelForValue(startValue);
            if (this.chart.getDataVisibility(index)) {
                head = vScale.getPixelForValue(start + length);
            } else {
                head = base;
            }
            size = head - base;
            if (Math.abs(size) < minBarLength) {
                size = barSign(size, vScale, actualBase) * minBarLength;
                if (value === actualBase) {
                    base -= size / 2;
                }
                const startPixel = vScale.getPixelForDecimal(0);
                const endPixel = vScale.getPixelForDecimal(1);
                const min = Math.min(startPixel, endPixel);
                const max = Math.max(startPixel, endPixel);
                base = Math.max(Math.min(base, max), min);
                head = base + size;
            }
            if (base === vScale.getPixelForValue(actualBase)) {
                const halfGrid = sign(size) * vScale.getLineWidthForValue(actualBase) / 2;
                base += halfGrid;
                size -= halfGrid;
            }
            return {
                size,
                base,
                head,
                center: head + size / 2
            };
        }
     _calculateBarIndexPixels(index, ruler) {
            const scale = ruler.scale;
            const options = this.options;
            const skipNull = options.skipNull;
            const maxBarThickness = valueOrDefault(options.maxBarThickness, Infinity);
            let center, size;
            if (ruler.grouped) {
                const stackCount = skipNull ? this._getStackCount(index) : ruler.stackCount;
                const range = options.barThickness === 'flex' ? computeFlexCategoryTraits(index, ruler, options, stackCount) : computeFitCategoryTraits(index, ruler, options, stackCount);
                const stackIndex = this._getStackIndex(this.index, this._cachedMeta.stack, skipNull ? index : undefined);
                center = range.start + range.chunk * stackIndex + range.chunk / 2;
                size = Math.min(maxBarThickness, range.chunk * range.ratio);
            } else {
                center = scale.getPixelForValue(this.getParsed(index)[scale.axis], index);
                size = Math.min(maxBarThickness, ruler.min * ruler.ratio);
            }
            return {
                base: center - size / 2,
                head: center + size / 2,
                center,
                size
            };
        }
        draw() {
            const meta = this._cachedMeta;
            const vScale = meta.vScale;
            const rects = meta.data;
            const ilen = rects.length;
            let i = 0;
            for(; i < ilen; ++i){
                if (this.getParsed(i)[vScale.axis] !== null) {
                    rects[i].draw(this._ctx);
                }
            }
        }
    }

    function getRatioAndOffset(rotation, circumference, cutout) {
        let ratioX = 1;
        let ratioY = 1;
        let offsetX = 0;
        let offsetY = 0;
        if (circumference < TAU) {
            const startAngle = rotation;
            const endAngle = startAngle + circumference;
            const startX = Math.cos(startAngle);
            const startY = Math.sin(startAngle);
            const endX = Math.cos(endAngle);
            const endY = Math.sin(endAngle);
            const calcMax = (angle, a, b)=>_angleBetween(angle, startAngle, endAngle, true) ? 1 : Math.max(a, a * cutout, b, b * cutout);
            const calcMin = (angle, a, b)=>_angleBetween(angle, startAngle, endAngle, true) ? -1 : Math.min(a, a * cutout, b, b * cutout);
            const maxX = calcMax(0, startX, endX);
            const maxY = calcMax(HALF_PI, startY, endY);
            const minX = calcMin(PI, startX, endX);
            const minY = calcMin(PI + HALF_PI, startY, endY);
            ratioX = (maxX - minX) / 2;
            ratioY = (maxY - minY) / 2;
            offsetX = -(maxX + minX) / 2;
            offsetY = -(maxY + minY) / 2;
        }
        return {
            ratioX,
            ratioY,
            offsetX,
            offsetY
        };
    }
    class DoughnutController extends DatasetController {
        static id = 'doughnut';
     static defaults = {
            datasetElementType: false,
            dataElementType: 'arc',
            animation: {
                animateRotate: true,
                animateScale: false
            },
            animations: {
                numbers: {
                    type: 'number',
                    properties: [
                        'circumference',
                        'endAngle',
                        'innerRadius',
                        'outerRadius',
                        'startAngle',
                        'x',
                        'y',
                        'offset',
                        'borderWidth',
                        'spacing'
                    ]
                }
            },
            cutout: '50%',
            rotation: 0,
            circumference: 360,
            radius: '100%',
            spacing: 0,
            indexAxis: 'r'
        };
        static descriptors = {
            _scriptable: (name)=>name !== 'spacing',
            _indexable: (name)=>name !== 'spacing'
        };
     static overrides = {
            aspectRatio: 1,
            plugins: {
                legend: {
                    labels: {
                        generateLabels (chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                const { labels: { pointStyle , color  }  } = chart.legend.options;
                                return data.labels.map((label, i)=>{
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);
                                    return {
                                        text: label,
                                        fillStyle: style.backgroundColor,
                                        strokeStyle: style.borderColor,
                                        fontColor: color,
                                        lineWidth: style.borderWidth,
                                        pointStyle: pointStyle,
                                        hidden: !chart.getDataVisibility(i),
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    },
                    onClick (e, legendItem, legend) {
                        legend.chart.toggleDataVisibility(legendItem.index);
                        legend.chart.update();
                    }
                }
            }
        };
        constructor(chart, datasetIndex){
            super(chart, datasetIndex);
            this.enableOptionSharing = true;
            this.innerRadius = undefined;
            this.outerRadius = undefined;
            this.offsetX = undefined;
            this.offsetY = undefined;
        }
        linkScales() {}
     parse(start, count) {
            const data = this.getDataset().data;
            const meta = this._cachedMeta;
            if (this._parsing === false) {
                meta._parsed = data;
            } else {
                let getter = (i)=>+data[i];
                if (isObject(data[start])) {
                    const { key ='value'  } = this._parsing;
                    getter = (i)=>+resolveObjectKey(data[i], key);
                }
                let i, ilen;
                for(i = start, ilen = start + count; i < ilen; ++i){
                    meta._parsed[i] = getter(i);
                }
            }
        }
     _getRotation() {
            return toRadians(this.options.rotation - 90);
        }
     _getCircumference() {
            return toRadians(this.options.circumference);
        }
     _getRotationExtents() {
            let min = TAU;
            let max = -TAU;
            for(let i = 0; i < this.chart.data.datasets.length; ++i){
                if (this.chart.isDatasetVisible(i) && this.chart.getDatasetMeta(i).type === this._type) {
                    const controller = this.chart.getDatasetMeta(i).controller;
                    const rotation = controller._getRotation();
                    const circumference = controller._getCircumference();
                    min = Math.min(min, rotation);
                    max = Math.max(max, rotation + circumference);
                }
            }
            return {
                rotation: min,
                circumference: max - min
            };
        }
     update(mode) {
            const chart = this.chart;
            const { chartArea  } = chart;
            const meta = this._cachedMeta;
            const arcs = meta.data;
            const spacing = this.getMaxBorderWidth() + this.getMaxOffset(arcs) + this.options.spacing;
            const maxSize = Math.max((Math.min(chartArea.width, chartArea.height) - spacing) / 2, 0);
            const cutout = Math.min(toPercentage(this.options.cutout, maxSize), 1);
            const chartWeight = this._getRingWeight(this.index);
            const { circumference , rotation  } = this._getRotationExtents();
            const { ratioX , ratioY , offsetX , offsetY  } = getRatioAndOffset(rotation, circumference, cutout);
            const maxWidth = (chartArea.width - spacing) / ratioX;
            const maxHeight = (chartArea.height - spacing) / ratioY;
            const maxRadius = Math.max(Math.min(maxWidth, maxHeight) / 2, 0);
            const outerRadius = toDimension(this.options.radius, maxRadius);
            const innerRadius = Math.max(outerRadius * cutout, 0);
            const radiusLength = (outerRadius - innerRadius) / this._getVisibleDatasetWeightTotal();
            this.offsetX = offsetX * outerRadius;
            this.offsetY = offsetY * outerRadius;
            meta.total = this.calculateTotal();
            this.outerRadius = outerRadius - radiusLength * this._getRingWeightOffset(this.index);
            this.innerRadius = Math.max(this.outerRadius - radiusLength * chartWeight, 0);
            this.updateElements(arcs, 0, arcs.length, mode);
        }
     _circumference(i, reset) {
            const opts = this.options;
            const meta = this._cachedMeta;
            const circumference = this._getCircumference();
            if (reset && opts.animation.animateRotate || !this.chart.getDataVisibility(i) || meta._parsed[i] === null || meta.data[i].hidden) {
                return 0;
            }
            return this.calculateCircumference(meta._parsed[i] * circumference / TAU);
        }
        updateElements(arcs, start, count, mode) {
            const reset = mode === 'reset';
            const chart = this.chart;
            const chartArea = chart.chartArea;
            const opts = chart.options;
            const animationOpts = opts.animation;
            const centerX = (chartArea.left + chartArea.right) / 2;
            const centerY = (chartArea.top + chartArea.bottom) / 2;
            const animateScale = reset && animationOpts.animateScale;
            const innerRadius = animateScale ? 0 : this.innerRadius;
            const outerRadius = animateScale ? 0 : this.outerRadius;
            const { sharedOptions , includeOptions  } = this._getSharedOptions(start, mode);
            let startAngle = this._getRotation();
            let i;
            for(i = 0; i < start; ++i){
                startAngle += this._circumference(i, reset);
            }
            for(i = start; i < start + count; ++i){
                const circumference = this._circumference(i, reset);
                const arc = arcs[i];
                const properties = {
                    x: centerX + this.offsetX,
                    y: centerY + this.offsetY,
                    startAngle,
                    endAngle: startAngle + circumference,
                    circumference,
                    outerRadius,
                    innerRadius
                };
                if (includeOptions) {
                    properties.options = sharedOptions || this.resolveDataElementOptions(i, arc.active ? 'active' : mode);
                }
                startAngle += circumference;
                this.updateElement(arc, i, properties, mode);
            }
        }
        calculateTotal() {
            const meta = this._cachedMeta;
            const metaData = meta.data;
            let total = 0;
            let i;
            for(i = 0; i < metaData.length; i++){
                const value = meta._parsed[i];
                if (value !== null && !isNaN(value) && this.chart.getDataVisibility(i) && !metaData[i].hidden) {
                    total += Math.abs(value);
                }
            }
            return total;
        }
        calculateCircumference(value) {
            const total = this._cachedMeta.total;
            if (total > 0 && !isNaN(value)) {
                return TAU * (Math.abs(value) / total);
            }
            return 0;
        }
        getLabelAndValue(index) {
            const meta = this._cachedMeta;
            const chart = this.chart;
            const labels = chart.data.labels || [];
            const value = formatNumber(meta._parsed[index], chart.options.locale);
            return {
                label: labels[index] || '',
                value
            };
        }
        getMaxBorderWidth(arcs) {
            let max = 0;
            const chart = this.chart;
            let i, ilen, meta, controller, options;
            if (!arcs) {
                for(i = 0, ilen = chart.data.datasets.length; i < ilen; ++i){
                    if (chart.isDatasetVisible(i)) {
                        meta = chart.getDatasetMeta(i);
                        arcs = meta.data;
                        controller = meta.controller;
                        break;
                    }
                }
            }
            if (!arcs) {
                return 0;
            }
            for(i = 0, ilen = arcs.length; i < ilen; ++i){
                options = controller.resolveDataElementOptions(i);
                if (options.borderAlign !== 'inner') {
                    max = Math.max(max, options.borderWidth || 0, options.hoverBorderWidth || 0);
                }
            }
            return max;
        }
        getMaxOffset(arcs) {
            let max = 0;
            for(let i = 0, ilen = arcs.length; i < ilen; ++i){
                const options = this.resolveDataElementOptions(i);
                max = Math.max(max, options.offset || 0, options.hoverOffset || 0);
            }
            return max;
        }
     _getRingWeightOffset(datasetIndex) {
            let ringWeightOffset = 0;
            for(let i = 0; i < datasetIndex; ++i){
                if (this.chart.isDatasetVisible(i)) {
                    ringWeightOffset += this._getRingWeight(i);
                }
            }
            return ringWeightOffset;
        }
     _getRingWeight(datasetIndex) {
            return Math.max(valueOrDefault(this.chart.data.datasets[datasetIndex].weight, 1), 0);
        }
     _getVisibleDatasetWeightTotal() {
            return this._getRingWeightOffset(this.chart.data.datasets.length) || 1;
        }
    }

    class PieController extends DoughnutController {
        static id = 'pie';
     static defaults = {
            cutout: 0,
            rotation: 0,
            circumference: 360,
            radius: '100%'
        };
    }

    /**
     * @namespace Chart._adapters
     * @since 2.8.0
     * @private
     */ function abstract() {
        throw new Error('This method is not implemented: Check that a complete date adapter is provided.');
    }
    /**
     * Date adapter (current used by the time scale)
     * @namespace Chart._adapters._date
     * @memberof Chart._adapters
     * @private
     */ class DateAdapterBase {
        /**
       * Override default date adapter methods.
       * Accepts type parameter to define options type.
       * @example
       * Chart._adapters._date.override<{myAdapterOption: string}>({
       *   init() {
       *     console.log(this.options.myAdapterOption);
       *   }
       * })
       */ static override(members) {
            Object.assign(DateAdapterBase.prototype, members);
        }
        constructor(options){
            this.options = options || {};
        }
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        init() {}
        formats() {
            return abstract();
        }
        parse() {
            return abstract();
        }
        format() {
            return abstract();
        }
        add() {
            return abstract();
        }
        diff() {
            return abstract();
        }
        startOf() {
            return abstract();
        }
        endOf() {
            return abstract();
        }
    }
    var adapters = {
        _date: DateAdapterBase
    };

    function binarySearch(metaset, axis, value, intersect) {
        const { controller , data , _sorted  } = metaset;
        const iScale = controller._cachedMeta.iScale;
        if (iScale && axis === iScale.axis && axis !== 'r' && _sorted && data.length) {
            const lookupMethod = iScale._reversePixels ? _rlookupByKey : _lookupByKey;
            if (!intersect) {
                return lookupMethod(data, axis, value);
            } else if (controller._sharedOptions) {
                const el = data[0];
                const range = typeof el.getRange === 'function' && el.getRange(axis);
                if (range) {
                    const start = lookupMethod(data, axis, value - range);
                    const end = lookupMethod(data, axis, value + range);
                    return {
                        lo: start.lo,
                        hi: end.hi
                    };
                }
            }
        }
        return {
            lo: 0,
            hi: data.length - 1
        };
    }
     function evaluateInteractionItems(chart, axis, position, handler, intersect) {
        const metasets = chart.getSortedVisibleDatasetMetas();
        const value = position[axis];
        for(let i = 0, ilen = metasets.length; i < ilen; ++i){
            const { index , data  } = metasets[i];
            const { lo , hi  } = binarySearch(metasets[i], axis, value, intersect);
            for(let j = lo; j <= hi; ++j){
                const element = data[j];
                if (!element.skip) {
                    handler(element, index, j);
                }
            }
        }
    }
     function getDistanceMetricForAxis(axis) {
        const useX = axis.indexOf('x') !== -1;
        const useY = axis.indexOf('y') !== -1;
        return function(pt1, pt2) {
            const deltaX = useX ? Math.abs(pt1.x - pt2.x) : 0;
            const deltaY = useY ? Math.abs(pt1.y - pt2.y) : 0;
            return Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
        };
    }
     function getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) {
        const items = [];
        if (!includeInvisible && !chart.isPointInArea(position)) {
            return items;
        }
        const evaluationFunc = function(element, datasetIndex, index) {
            if (!includeInvisible && !_isPointInArea(element, chart.chartArea, 0)) {
                return;
            }
            if (element.inRange(position.x, position.y, useFinalPosition)) {
                items.push({
                    element,
                    datasetIndex,
                    index
                });
            }
        };
        evaluateInteractionItems(chart, axis, position, evaluationFunc, true);
        return items;
    }
     function getNearestRadialItems(chart, position, axis, useFinalPosition) {
        let items = [];
        function evaluationFunc(element, datasetIndex, index) {
            const { startAngle , endAngle  } = element.getProps([
                'startAngle',
                'endAngle'
            ], useFinalPosition);
            const { angle  } = getAngleFromPoint(element, {
                x: position.x,
                y: position.y
            });
            if (_angleBetween(angle, startAngle, endAngle)) {
                items.push({
                    element,
                    datasetIndex,
                    index
                });
            }
        }
        evaluateInteractionItems(chart, axis, position, evaluationFunc);
        return items;
    }
     function getNearestCartesianItems(chart, position, axis, intersect, useFinalPosition, includeInvisible) {
        let items = [];
        const distanceMetric = getDistanceMetricForAxis(axis);
        let minDistance = Number.POSITIVE_INFINITY;
        function evaluationFunc(element, datasetIndex, index) {
            const inRange = element.inRange(position.x, position.y, useFinalPosition);
            if (intersect && !inRange) {
                return;
            }
            const center = element.getCenterPoint(useFinalPosition);
            const pointInArea = !!includeInvisible || chart.isPointInArea(center);
            if (!pointInArea && !inRange) {
                return;
            }
            const distance = distanceMetric(position, center);
            if (distance < minDistance) {
                items = [
                    {
                        element,
                        datasetIndex,
                        index
                    }
                ];
                minDistance = distance;
            } else if (distance === minDistance) {
                items.push({
                    element,
                    datasetIndex,
                    index
                });
            }
        }
        evaluateInteractionItems(chart, axis, position, evaluationFunc);
        return items;
    }
     function getNearestItems(chart, position, axis, intersect, useFinalPosition, includeInvisible) {
        if (!includeInvisible && !chart.isPointInArea(position)) {
            return [];
        }
        return axis === 'r' && !intersect ? getNearestRadialItems(chart, position, axis, useFinalPosition) : getNearestCartesianItems(chart, position, axis, intersect, useFinalPosition, includeInvisible);
    }
     function getAxisItems(chart, position, axis, intersect, useFinalPosition) {
        const items = [];
        const rangeMethod = axis === 'x' ? 'inXRange' : 'inYRange';
        let intersectsItem = false;
        evaluateInteractionItems(chart, axis, position, (element, datasetIndex, index)=>{
            if (element[rangeMethod](position[axis], useFinalPosition)) {
                items.push({
                    element,
                    datasetIndex,
                    index
                });
                intersectsItem = intersectsItem || element.inRange(position.x, position.y, useFinalPosition);
            }
        });
        if (intersect && !intersectsItem) {
            return [];
        }
        return items;
    }
     var Interaction = {
        evaluateInteractionItems,
        modes: {
     index (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                const axis = options.axis || 'x';
                const includeInvisible = options.includeInvisible || false;
                const items = options.intersect ? getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) : getNearestItems(chart, position, axis, false, useFinalPosition, includeInvisible);
                const elements = [];
                if (!items.length) {
                    return [];
                }
                chart.getSortedVisibleDatasetMetas().forEach((meta)=>{
                    const index = items[0].index;
                    const element = meta.data[index];
                    if (element && !element.skip) {
                        elements.push({
                            element,
                            datasetIndex: meta.index,
                            index
                        });
                    }
                });
                return elements;
            },
     dataset (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                const axis = options.axis || 'xy';
                const includeInvisible = options.includeInvisible || false;
                let items = options.intersect ? getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) : getNearestItems(chart, position, axis, false, useFinalPosition, includeInvisible);
                if (items.length > 0) {
                    const datasetIndex = items[0].datasetIndex;
                    const data = chart.getDatasetMeta(datasetIndex).data;
                    items = [];
                    for(let i = 0; i < data.length; ++i){
                        items.push({
                            element: data[i],
                            datasetIndex,
                            index: i
                        });
                    }
                }
                return items;
            },
     point (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                const axis = options.axis || 'xy';
                const includeInvisible = options.includeInvisible || false;
                return getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible);
            },
     nearest (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                const axis = options.axis || 'xy';
                const includeInvisible = options.includeInvisible || false;
                return getNearestItems(chart, position, axis, options.intersect, useFinalPosition, includeInvisible);
            },
     x (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                return getAxisItems(chart, position, 'x', options.intersect, useFinalPosition);
            },
     y (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                return getAxisItems(chart, position, 'y', options.intersect, useFinalPosition);
            }
        }
    };

    const STATIC_POSITIONS = [
        'left',
        'top',
        'right',
        'bottom'
    ];
    function filterByPosition(array, position) {
        return array.filter((v)=>v.pos === position);
    }
    function filterDynamicPositionByAxis(array, axis) {
        return array.filter((v)=>STATIC_POSITIONS.indexOf(v.pos) === -1 && v.box.axis === axis);
    }
    function sortByWeight(array, reverse) {
        return array.sort((a, b)=>{
            const v0 = reverse ? b : a;
            const v1 = reverse ? a : b;
            return v0.weight === v1.weight ? v0.index - v1.index : v0.weight - v1.weight;
        });
    }
    function wrapBoxes(boxes) {
        const layoutBoxes = [];
        let i, ilen, box, pos, stack, stackWeight;
        for(i = 0, ilen = (boxes || []).length; i < ilen; ++i){
            box = boxes[i];
            ({ position: pos , options: { stack , stackWeight =1  }  } = box);
            layoutBoxes.push({
                index: i,
                box,
                pos,
                horizontal: box.isHorizontal(),
                weight: box.weight,
                stack: stack && pos + stack,
                stackWeight
            });
        }
        return layoutBoxes;
    }
    function buildStacks(layouts) {
        const stacks = {};
        for (const wrap of layouts){
            const { stack , pos , stackWeight  } = wrap;
            if (!stack || !STATIC_POSITIONS.includes(pos)) {
                continue;
            }
            const _stack = stacks[stack] || (stacks[stack] = {
                count: 0,
                placed: 0,
                weight: 0,
                size: 0
            });
            _stack.count++;
            _stack.weight += stackWeight;
        }
        return stacks;
    }
     function setLayoutDims(layouts, params) {
        const stacks = buildStacks(layouts);
        const { vBoxMaxWidth , hBoxMaxHeight  } = params;
        let i, ilen, layout;
        for(i = 0, ilen = layouts.length; i < ilen; ++i){
            layout = layouts[i];
            const { fullSize  } = layout.box;
            const stack = stacks[layout.stack];
            const factor = stack && layout.stackWeight / stack.weight;
            if (layout.horizontal) {
                layout.width = factor ? factor * vBoxMaxWidth : fullSize && params.availableWidth;
                layout.height = hBoxMaxHeight;
            } else {
                layout.width = vBoxMaxWidth;
                layout.height = factor ? factor * hBoxMaxHeight : fullSize && params.availableHeight;
            }
        }
        return stacks;
    }
    function buildLayoutBoxes(boxes) {
        const layoutBoxes = wrapBoxes(boxes);
        const fullSize = sortByWeight(layoutBoxes.filter((wrap)=>wrap.box.fullSize), true);
        const left = sortByWeight(filterByPosition(layoutBoxes, 'left'), true);
        const right = sortByWeight(filterByPosition(layoutBoxes, 'right'));
        const top = sortByWeight(filterByPosition(layoutBoxes, 'top'), true);
        const bottom = sortByWeight(filterByPosition(layoutBoxes, 'bottom'));
        const centerHorizontal = filterDynamicPositionByAxis(layoutBoxes, 'x');
        const centerVertical = filterDynamicPositionByAxis(layoutBoxes, 'y');
        return {
            fullSize,
            leftAndTop: left.concat(top),
            rightAndBottom: right.concat(centerVertical).concat(bottom).concat(centerHorizontal),
            chartArea: filterByPosition(layoutBoxes, 'chartArea'),
            vertical: left.concat(right).concat(centerVertical),
            horizontal: top.concat(bottom).concat(centerHorizontal)
        };
    }
    function getCombinedMax(maxPadding, chartArea, a, b) {
        return Math.max(maxPadding[a], chartArea[a]) + Math.max(maxPadding[b], chartArea[b]);
    }
    function updateMaxPadding(maxPadding, boxPadding) {
        maxPadding.top = Math.max(maxPadding.top, boxPadding.top);
        maxPadding.left = Math.max(maxPadding.left, boxPadding.left);
        maxPadding.bottom = Math.max(maxPadding.bottom, boxPadding.bottom);
        maxPadding.right = Math.max(maxPadding.right, boxPadding.right);
    }
    function updateDims(chartArea, params, layout, stacks) {
        const { pos , box  } = layout;
        const maxPadding = chartArea.maxPadding;
        if (!isObject(pos)) {
            if (layout.size) {
                chartArea[pos] -= layout.size;
            }
            const stack = stacks[layout.stack] || {
                size: 0,
                count: 1
            };
            stack.size = Math.max(stack.size, layout.horizontal ? box.height : box.width);
            layout.size = stack.size / stack.count;
            chartArea[pos] += layout.size;
        }
        if (box.getPadding) {
            updateMaxPadding(maxPadding, box.getPadding());
        }
        const newWidth = Math.max(0, params.outerWidth - getCombinedMax(maxPadding, chartArea, 'left', 'right'));
        const newHeight = Math.max(0, params.outerHeight - getCombinedMax(maxPadding, chartArea, 'top', 'bottom'));
        const widthChanged = newWidth !== chartArea.w;
        const heightChanged = newHeight !== chartArea.h;
        chartArea.w = newWidth;
        chartArea.h = newHeight;
        return layout.horizontal ? {
            same: widthChanged,
            other: heightChanged
        } : {
            same: heightChanged,
            other: widthChanged
        };
    }
    function handleMaxPadding(chartArea) {
        const maxPadding = chartArea.maxPadding;
        function updatePos(pos) {
            const change = Math.max(maxPadding[pos] - chartArea[pos], 0);
            chartArea[pos] += change;
            return change;
        }
        chartArea.y += updatePos('top');
        chartArea.x += updatePos('left');
        updatePos('right');
        updatePos('bottom');
    }
    function getMargins(horizontal, chartArea) {
        const maxPadding = chartArea.maxPadding;
        function marginForPositions(positions) {
            const margin = {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0
            };
            positions.forEach((pos)=>{
                margin[pos] = Math.max(chartArea[pos], maxPadding[pos]);
            });
            return margin;
        }
        return horizontal ? marginForPositions([
            'left',
            'right'
        ]) : marginForPositions([
            'top',
            'bottom'
        ]);
    }
    function fitBoxes(boxes, chartArea, params, stacks) {
        const refitBoxes = [];
        let i, ilen, layout, box, refit, changed;
        for(i = 0, ilen = boxes.length, refit = 0; i < ilen; ++i){
            layout = boxes[i];
            box = layout.box;
            box.update(layout.width || chartArea.w, layout.height || chartArea.h, getMargins(layout.horizontal, chartArea));
            const { same , other  } = updateDims(chartArea, params, layout, stacks);
            refit |= same && refitBoxes.length;
            changed = changed || other;
            if (!box.fullSize) {
                refitBoxes.push(layout);
            }
        }
        return refit && fitBoxes(refitBoxes, chartArea, params, stacks) || changed;
    }
    function setBoxDims(box, left, top, width, height) {
        box.top = top;
        box.left = left;
        box.right = left + width;
        box.bottom = top + height;
        box.width = width;
        box.height = height;
    }
    function placeBoxes(boxes, chartArea, params, stacks) {
        const userPadding = params.padding;
        let { x , y  } = chartArea;
        for (const layout of boxes){
            const box = layout.box;
            const stack = stacks[layout.stack] || {
                count: 1,
                placed: 0,
                weight: 1
            };
            const weight = layout.stackWeight / stack.weight || 1;
            if (layout.horizontal) {
                const width = chartArea.w * weight;
                const height = stack.size || box.height;
                if (defined(stack.start)) {
                    y = stack.start;
                }
                if (box.fullSize) {
                    setBoxDims(box, userPadding.left, y, params.outerWidth - userPadding.right - userPadding.left, height);
                } else {
                    setBoxDims(box, chartArea.left + stack.placed, y, width, height);
                }
                stack.start = y;
                stack.placed += width;
                y = box.bottom;
            } else {
                const height1 = chartArea.h * weight;
                const width1 = stack.size || box.width;
                if (defined(stack.start)) {
                    x = stack.start;
                }
                if (box.fullSize) {
                    setBoxDims(box, x, userPadding.top, width1, params.outerHeight - userPadding.bottom - userPadding.top);
                } else {
                    setBoxDims(box, x, chartArea.top + stack.placed, width1, height1);
                }
                stack.start = x;
                stack.placed += height1;
                x = box.right;
            }
        }
        chartArea.x = x;
        chartArea.y = y;
    }
    var layouts = {
     addBox (chart, item) {
            if (!chart.boxes) {
                chart.boxes = [];
            }
            item.fullSize = item.fullSize || false;
            item.position = item.position || 'top';
            item.weight = item.weight || 0;
            item._layers = item._layers || function() {
                return [
                    {
                        z: 0,
                        draw (chartArea) {
                            item.draw(chartArea);
                        }
                    }
                ];
            };
            chart.boxes.push(item);
        },
     removeBox (chart, layoutItem) {
            const index = chart.boxes ? chart.boxes.indexOf(layoutItem) : -1;
            if (index !== -1) {
                chart.boxes.splice(index, 1);
            }
        },
     configure (chart, item, options) {
            item.fullSize = options.fullSize;
            item.position = options.position;
            item.weight = options.weight;
        },
     update (chart, width, height, minPadding) {
            if (!chart) {
                return;
            }
            const padding = toPadding(chart.options.layout.padding);
            const availableWidth = Math.max(width - padding.width, 0);
            const availableHeight = Math.max(height - padding.height, 0);
            const boxes = buildLayoutBoxes(chart.boxes);
            const verticalBoxes = boxes.vertical;
            const horizontalBoxes = boxes.horizontal;
            each(chart.boxes, (box)=>{
                if (typeof box.beforeLayout === 'function') {
                    box.beforeLayout();
                }
            });
            const visibleVerticalBoxCount = verticalBoxes.reduce((total, wrap)=>wrap.box.options && wrap.box.options.display === false ? total : total + 1, 0) || 1;
            const params = Object.freeze({
                outerWidth: width,
                outerHeight: height,
                padding,
                availableWidth,
                availableHeight,
                vBoxMaxWidth: availableWidth / 2 / visibleVerticalBoxCount,
                hBoxMaxHeight: availableHeight / 2
            });
            const maxPadding = Object.assign({}, padding);
            updateMaxPadding(maxPadding, toPadding(minPadding));
            const chartArea = Object.assign({
                maxPadding,
                w: availableWidth,
                h: availableHeight,
                x: padding.left,
                y: padding.top
            }, padding);
            const stacks = setLayoutDims(verticalBoxes.concat(horizontalBoxes), params);
            fitBoxes(boxes.fullSize, chartArea, params, stacks);
            fitBoxes(verticalBoxes, chartArea, params, stacks);
            if (fitBoxes(horizontalBoxes, chartArea, params, stacks)) {
                fitBoxes(verticalBoxes, chartArea, params, stacks);
            }
            handleMaxPadding(chartArea);
            placeBoxes(boxes.leftAndTop, chartArea, params, stacks);
            chartArea.x += chartArea.w;
            chartArea.y += chartArea.h;
            placeBoxes(boxes.rightAndBottom, chartArea, params, stacks);
            chart.chartArea = {
                left: chartArea.left,
                top: chartArea.top,
                right: chartArea.left + chartArea.w,
                bottom: chartArea.top + chartArea.h,
                height: chartArea.h,
                width: chartArea.w
            };
            each(boxes.chartArea, (layout)=>{
                const box = layout.box;
                Object.assign(box, chart.chartArea);
                box.update(chartArea.w, chartArea.h, {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0
                });
            });
        }
    };

    class BasePlatform {
     acquireContext(canvas, aspectRatio) {}
     releaseContext(context) {
            return false;
        }
     addEventListener(chart, type, listener) {}
     removeEventListener(chart, type, listener) {}
     getDevicePixelRatio() {
            return 1;
        }
     getMaximumSize(element, width, height, aspectRatio) {
            width = Math.max(0, width || element.width);
            height = height || element.height;
            return {
                width,
                height: Math.max(0, aspectRatio ? Math.floor(width / aspectRatio) : height)
            };
        }
     isAttached(canvas) {
            return true;
        }
     updateConfig(config) {
        }
    }

    class BasicPlatform extends BasePlatform {
        acquireContext(item) {
            return item && item.getContext && item.getContext('2d') || null;
        }
        updateConfig(config) {
            config.options.animation = false;
        }
    }

    const EXPANDO_KEY = '$chartjs';
     const EVENT_TYPES = {
        touchstart: 'mousedown',
        touchmove: 'mousemove',
        touchend: 'mouseup',
        pointerenter: 'mouseenter',
        pointerdown: 'mousedown',
        pointermove: 'mousemove',
        pointerup: 'mouseup',
        pointerleave: 'mouseout',
        pointerout: 'mouseout'
    };
    const isNullOrEmpty = (value)=>value === null || value === '';
     function initCanvas(canvas, aspectRatio) {
        const style = canvas.style;
        const renderHeight = canvas.getAttribute('height');
        const renderWidth = canvas.getAttribute('width');
        canvas[EXPANDO_KEY] = {
            initial: {
                height: renderHeight,
                width: renderWidth,
                style: {
                    display: style.display,
                    height: style.height,
                    width: style.width
                }
            }
        };
        style.display = style.display || 'block';
        style.boxSizing = style.boxSizing || 'border-box';
        if (isNullOrEmpty(renderWidth)) {
            const displayWidth = readUsedSize(canvas, 'width');
            if (displayWidth !== undefined) {
                canvas.width = displayWidth;
            }
        }
        if (isNullOrEmpty(renderHeight)) {
            if (canvas.style.height === '') {
                canvas.height = canvas.width / (aspectRatio || 2);
            } else {
                const displayHeight = readUsedSize(canvas, 'height');
                if (displayHeight !== undefined) {
                    canvas.height = displayHeight;
                }
            }
        }
        return canvas;
    }
    const eventListenerOptions = supportsEventListenerOptions ? {
        passive: true
    } : false;
    function addListener(node, type, listener) {
        node.addEventListener(type, listener, eventListenerOptions);
    }
    function removeListener(chart, type, listener) {
        chart.canvas.removeEventListener(type, listener, eventListenerOptions);
    }
    function fromNativeEvent(event, chart) {
        const type = EVENT_TYPES[event.type] || event.type;
        const { x , y  } = getRelativePosition(event, chart);
        return {
            type,
            chart,
            native: event,
            x: x !== undefined ? x : null,
            y: y !== undefined ? y : null
        };
    }
    function nodeListContains(nodeList, canvas) {
        for (const node of nodeList){
            if (node === canvas || node.contains(canvas)) {
                return true;
            }
        }
    }
    function createAttachObserver(chart, type, listener) {
        const canvas = chart.canvas;
        const observer = new MutationObserver((entries)=>{
            let trigger = false;
            for (const entry of entries){
                trigger = trigger || nodeListContains(entry.addedNodes, canvas);
                trigger = trigger && !nodeListContains(entry.removedNodes, canvas);
            }
            if (trigger) {
                listener();
            }
        });
        observer.observe(document, {
            childList: true,
            subtree: true
        });
        return observer;
    }
    function createDetachObserver(chart, type, listener) {
        const canvas = chart.canvas;
        const observer = new MutationObserver((entries)=>{
            let trigger = false;
            for (const entry of entries){
                trigger = trigger || nodeListContains(entry.removedNodes, canvas);
                trigger = trigger && !nodeListContains(entry.addedNodes, canvas);
            }
            if (trigger) {
                listener();
            }
        });
        observer.observe(document, {
            childList: true,
            subtree: true
        });
        return observer;
    }
    const drpListeningCharts = new Map();
    let oldDevicePixelRatio = 0;
    function onWindowResize() {
        const dpr = window.devicePixelRatio;
        if (dpr === oldDevicePixelRatio) {
            return;
        }
        oldDevicePixelRatio = dpr;
        drpListeningCharts.forEach((resize, chart)=>{
            if (chart.currentDevicePixelRatio !== dpr) {
                resize();
            }
        });
    }
    function listenDevicePixelRatioChanges(chart, resize) {
        if (!drpListeningCharts.size) {
            window.addEventListener('resize', onWindowResize);
        }
        drpListeningCharts.set(chart, resize);
    }
    function unlistenDevicePixelRatioChanges(chart) {
        drpListeningCharts.delete(chart);
        if (!drpListeningCharts.size) {
            window.removeEventListener('resize', onWindowResize);
        }
    }
    function createResizeObserver(chart, type, listener) {
        const canvas = chart.canvas;
        const container = canvas && _getParentNode(canvas);
        if (!container) {
            return;
        }
        const resize = throttled((width, height)=>{
            const w = container.clientWidth;
            listener(width, height);
            if (w < container.clientWidth) {
                listener();
            }
        }, window);
        const observer = new ResizeObserver((entries)=>{
            const entry = entries[0];
            const width = entry.contentRect.width;
            const height = entry.contentRect.height;
            if (width === 0 && height === 0) {
                return;
            }
            resize(width, height);
        });
        observer.observe(container);
        listenDevicePixelRatioChanges(chart, resize);
        return observer;
    }
    function releaseObserver(chart, type, observer) {
        if (observer) {
            observer.disconnect();
        }
        if (type === 'resize') {
            unlistenDevicePixelRatioChanges(chart);
        }
    }
    function createProxyAndListen(chart, type, listener) {
        const canvas = chart.canvas;
        const proxy = throttled((event)=>{
            if (chart.ctx !== null) {
                listener(fromNativeEvent(event, chart));
            }
        }, chart);
        addListener(canvas, type, proxy);
        return proxy;
    }
     class DomPlatform extends BasePlatform {
     acquireContext(canvas, aspectRatio) {
            const context = canvas && canvas.getContext && canvas.getContext('2d');
            if (context && context.canvas === canvas) {
                initCanvas(canvas, aspectRatio);
                return context;
            }
            return null;
        }
     releaseContext(context) {
            const canvas = context.canvas;
            if (!canvas[EXPANDO_KEY]) {
                return false;
            }
            const initial = canvas[EXPANDO_KEY].initial;
            [
                'height',
                'width'
            ].forEach((prop)=>{
                const value = initial[prop];
                if (isNullOrUndef(value)) {
                    canvas.removeAttribute(prop);
                } else {
                    canvas.setAttribute(prop, value);
                }
            });
            const style = initial.style || {};
            Object.keys(style).forEach((key)=>{
                canvas.style[key] = style[key];
            });
            canvas.width = canvas.width;
            delete canvas[EXPANDO_KEY];
            return true;
        }
     addEventListener(chart, type, listener) {
            this.removeEventListener(chart, type);
            const proxies = chart.$proxies || (chart.$proxies = {});
            const handlers = {
                attach: createAttachObserver,
                detach: createDetachObserver,
                resize: createResizeObserver
            };
            const handler = handlers[type] || createProxyAndListen;
            proxies[type] = handler(chart, type, listener);
        }
     removeEventListener(chart, type) {
            const proxies = chart.$proxies || (chart.$proxies = {});
            const proxy = proxies[type];
            if (!proxy) {
                return;
            }
            const handlers = {
                attach: releaseObserver,
                detach: releaseObserver,
                resize: releaseObserver
            };
            const handler = handlers[type] || removeListener;
            handler(chart, type, proxy);
            proxies[type] = undefined;
        }
        getDevicePixelRatio() {
            return window.devicePixelRatio;
        }
     getMaximumSize(canvas, width, height, aspectRatio) {
            return getMaximumSize(canvas, width, height, aspectRatio);
        }
     isAttached(canvas) {
            const container = _getParentNode(canvas);
            return !!(container && container.isConnected);
        }
    }

    function _detectPlatform(canvas) {
        if (!_isDomSupported() || typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
            return BasicPlatform;
        }
        return DomPlatform;
    }

    class Element$1 {
        static defaults = {};
        static defaultRoutes = undefined;
        active = false;
        tooltipPosition(useFinalPosition) {
            const { x , y  } = this.getProps([
                'x',
                'y'
            ], useFinalPosition);
            return {
                x,
                y
            };
        }
        hasValue() {
            return isNumber(this.x) && isNumber(this.y);
        }
        getProps(props, final) {
            const anims = this.$animations;
            if (!final || !anims) {
                // let's not create an object, if not needed
                return this;
            }
            const ret = {};
            props.forEach((prop)=>{
                ret[prop] = anims[prop] && anims[prop].active() ? anims[prop]._to : this[prop];
            });
            return ret;
        }
    }

    function autoSkip(scale, ticks) {
        const tickOpts = scale.options.ticks;
        const determinedMaxTicks = determineMaxTicks(scale);
        const ticksLimit = Math.min(tickOpts.maxTicksLimit || determinedMaxTicks, determinedMaxTicks);
        const majorIndices = tickOpts.major.enabled ? getMajorIndices(ticks) : [];
        const numMajorIndices = majorIndices.length;
        const first = majorIndices[0];
        const last = majorIndices[numMajorIndices - 1];
        const newTicks = [];
        if (numMajorIndices > ticksLimit) {
            skipMajors(ticks, newTicks, majorIndices, numMajorIndices / ticksLimit);
            return newTicks;
        }
        const spacing = calculateSpacing(majorIndices, ticks, ticksLimit);
        if (numMajorIndices > 0) {
            let i, ilen;
            const avgMajorSpacing = numMajorIndices > 1 ? Math.round((last - first) / (numMajorIndices - 1)) : null;
            skip(ticks, newTicks, spacing, isNullOrUndef(avgMajorSpacing) ? 0 : first - avgMajorSpacing, first);
            for(i = 0, ilen = numMajorIndices - 1; i < ilen; i++){
                skip(ticks, newTicks, spacing, majorIndices[i], majorIndices[i + 1]);
            }
            skip(ticks, newTicks, spacing, last, isNullOrUndef(avgMajorSpacing) ? ticks.length : last + avgMajorSpacing);
            return newTicks;
        }
        skip(ticks, newTicks, spacing);
        return newTicks;
    }
    function determineMaxTicks(scale) {
        const offset = scale.options.offset;
        const tickLength = scale._tickSize();
        const maxScale = scale._length / tickLength + (offset ? 0 : 1);
        const maxChart = scale._maxLength / tickLength;
        return Math.floor(Math.min(maxScale, maxChart));
    }
     function calculateSpacing(majorIndices, ticks, ticksLimit) {
        const evenMajorSpacing = getEvenSpacing(majorIndices);
        const spacing = ticks.length / ticksLimit;
        if (!evenMajorSpacing) {
            return Math.max(spacing, 1);
        }
        const factors = _factorize(evenMajorSpacing);
        for(let i = 0, ilen = factors.length - 1; i < ilen; i++){
            const factor = factors[i];
            if (factor > spacing) {
                return factor;
            }
        }
        return Math.max(spacing, 1);
    }
     function getMajorIndices(ticks) {
        const result = [];
        let i, ilen;
        for(i = 0, ilen = ticks.length; i < ilen; i++){
            if (ticks[i].major) {
                result.push(i);
            }
        }
        return result;
    }
     function skipMajors(ticks, newTicks, majorIndices, spacing) {
        let count = 0;
        let next = majorIndices[0];
        let i;
        spacing = Math.ceil(spacing);
        for(i = 0; i < ticks.length; i++){
            if (i === next) {
                newTicks.push(ticks[i]);
                count++;
                next = majorIndices[count * spacing];
            }
        }
    }
     function skip(ticks, newTicks, spacing, majorStart, majorEnd) {
        const start = valueOrDefault(majorStart, 0);
        const end = Math.min(valueOrDefault(majorEnd, ticks.length), ticks.length);
        let count = 0;
        let length, i, next;
        spacing = Math.ceil(spacing);
        if (majorEnd) {
            length = majorEnd - majorStart;
            spacing = length / Math.floor(length / spacing);
        }
        next = start;
        while(next < 0){
            count++;
            next = Math.round(start + count * spacing);
        }
        for(i = Math.max(start, 0); i < end; i++){
            if (i === next) {
                newTicks.push(ticks[i]);
                count++;
                next = Math.round(start + count * spacing);
            }
        }
    }
     function getEvenSpacing(arr) {
        const len = arr.length;
        let i, diff;
        if (len < 2) {
            return false;
        }
        for(diff = arr[0], i = 1; i < len; ++i){
            if (arr[i] - arr[i - 1] !== diff) {
                return false;
            }
        }
        return diff;
    }

    const reverseAlign = (align)=>align === 'left' ? 'right' : align === 'right' ? 'left' : align;
    const offsetFromEdge = (scale, edge, offset)=>edge === 'top' || edge === 'left' ? scale[edge] + offset : scale[edge] - offset;
     function sample(arr, numItems) {
        const result = [];
        const increment = arr.length / numItems;
        const len = arr.length;
        let i = 0;
        for(; i < len; i += increment){
            result.push(arr[Math.floor(i)]);
        }
        return result;
    }
     function getPixelForGridLine(scale, index, offsetGridLines) {
        const length = scale.ticks.length;
        const validIndex = Math.min(index, length - 1);
        const start = scale._startPixel;
        const end = scale._endPixel;
        const epsilon = 1e-6;
        let lineValue = scale.getPixelForTick(validIndex);
        let offset;
        if (offsetGridLines) {
            if (length === 1) {
                offset = Math.max(lineValue - start, end - lineValue);
            } else if (index === 0) {
                offset = (scale.getPixelForTick(1) - lineValue) / 2;
            } else {
                offset = (lineValue - scale.getPixelForTick(validIndex - 1)) / 2;
            }
            lineValue += validIndex < index ? offset : -offset;
            if (lineValue < start - epsilon || lineValue > end + epsilon) {
                return;
            }
        }
        return lineValue;
    }
     function garbageCollect(caches, length) {
        each(caches, (cache)=>{
            const gc = cache.gc;
            const gcLen = gc.length / 2;
            let i;
            if (gcLen > length) {
                for(i = 0; i < gcLen; ++i){
                    delete cache.data[gc[i]];
                }
                gc.splice(0, gcLen);
            }
        });
    }
     function getTickMarkLength(options) {
        return options.drawTicks ? options.tickLength : 0;
    }
     function getTitleHeight(options, fallback) {
        if (!options.display) {
            return 0;
        }
        const font = toFont(options.font, fallback);
        const padding = toPadding(options.padding);
        const lines = isArray(options.text) ? options.text.length : 1;
        return lines * font.lineHeight + padding.height;
    }
    function createScaleContext(parent, scale) {
        return createContext(parent, {
            scale,
            type: 'scale'
        });
    }
    function createTickContext(parent, index, tick) {
        return createContext(parent, {
            tick,
            index,
            type: 'tick'
        });
    }
    function titleAlign(align, position, reverse) {
        let ret = _toLeftRightCenter(align);
        if (reverse && position !== 'right' || !reverse && position === 'right') {
            ret = reverseAlign(ret);
        }
        return ret;
    }
    function titleArgs(scale, offset, position, align) {
        const { top , left , bottom , right , chart  } = scale;
        const { chartArea , scales  } = chart;
        let rotation = 0;
        let maxWidth, titleX, titleY;
        const height = bottom - top;
        const width = right - left;
        if (scale.isHorizontal()) {
            titleX = _alignStartEnd(align, left, right);
            if (isObject(position)) {
                const positionAxisID = Object.keys(position)[0];
                const value = position[positionAxisID];
                titleY = scales[positionAxisID].getPixelForValue(value) + height - offset;
            } else if (position === 'center') {
                titleY = (chartArea.bottom + chartArea.top) / 2 + height - offset;
            } else {
                titleY = offsetFromEdge(scale, position, offset);
            }
            maxWidth = right - left;
        } else {
            if (isObject(position)) {
                const positionAxisID1 = Object.keys(position)[0];
                const value1 = position[positionAxisID1];
                titleX = scales[positionAxisID1].getPixelForValue(value1) - width + offset;
            } else if (position === 'center') {
                titleX = (chartArea.left + chartArea.right) / 2 - width + offset;
            } else {
                titleX = offsetFromEdge(scale, position, offset);
            }
            titleY = _alignStartEnd(align, bottom, top);
            rotation = position === 'left' ? -HALF_PI : HALF_PI;
        }
        return {
            titleX,
            titleY,
            maxWidth,
            rotation
        };
    }
    class Scale extends Element$1 {
        constructor(cfg){
            super();
             this.id = cfg.id;
             this.type = cfg.type;
             this.options = undefined;
             this.ctx = cfg.ctx;
             this.chart = cfg.chart;
             this.top = undefined;
             this.bottom = undefined;
             this.left = undefined;
             this.right = undefined;
             this.width = undefined;
             this.height = undefined;
            this._margins = {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            };
             this.maxWidth = undefined;
             this.maxHeight = undefined;
             this.paddingTop = undefined;
             this.paddingBottom = undefined;
             this.paddingLeft = undefined;
             this.paddingRight = undefined;
             this.axis = undefined;
             this.labelRotation = undefined;
            this.min = undefined;
            this.max = undefined;
            this._range = undefined;
             this.ticks = [];
             this._gridLineItems = null;
             this._labelItems = null;
             this._labelSizes = null;
            this._length = 0;
            this._maxLength = 0;
            this._longestTextCache = {};
             this._startPixel = undefined;
             this._endPixel = undefined;
            this._reversePixels = false;
            this._userMax = undefined;
            this._userMin = undefined;
            this._suggestedMax = undefined;
            this._suggestedMin = undefined;
            this._ticksLength = 0;
            this._borderValue = 0;
            this._cache = {};
            this._dataLimitsCached = false;
            this.$context = undefined;
        }
     init(options) {
            this.options = options.setContext(this.getContext());
            this.axis = options.axis;
            this._userMin = this.parse(options.min);
            this._userMax = this.parse(options.max);
            this._suggestedMin = this.parse(options.suggestedMin);
            this._suggestedMax = this.parse(options.suggestedMax);
        }
     parse(raw, index) {
            return raw;
        }
     getUserBounds() {
            let { _userMin , _userMax , _suggestedMin , _suggestedMax  } = this;
            _userMin = finiteOrDefault(_userMin, Number.POSITIVE_INFINITY);
            _userMax = finiteOrDefault(_userMax, Number.NEGATIVE_INFINITY);
            _suggestedMin = finiteOrDefault(_suggestedMin, Number.POSITIVE_INFINITY);
            _suggestedMax = finiteOrDefault(_suggestedMax, Number.NEGATIVE_INFINITY);
            return {
                min: finiteOrDefault(_userMin, _suggestedMin),
                max: finiteOrDefault(_userMax, _suggestedMax),
                minDefined: isNumberFinite(_userMin),
                maxDefined: isNumberFinite(_userMax)
            };
        }
     getMinMax(canStack) {
            let { min , max , minDefined , maxDefined  } = this.getUserBounds();
            let range;
            if (minDefined && maxDefined) {
                return {
                    min,
                    max
                };
            }
            const metas = this.getMatchingVisibleMetas();
            for(let i = 0, ilen = metas.length; i < ilen; ++i){
                range = metas[i].controller.getMinMax(this, canStack);
                if (!minDefined) {
                    min = Math.min(min, range.min);
                }
                if (!maxDefined) {
                    max = Math.max(max, range.max);
                }
            }
            min = maxDefined && min > max ? max : min;
            max = minDefined && min > max ? min : max;
            return {
                min: finiteOrDefault(min, finiteOrDefault(max, min)),
                max: finiteOrDefault(max, finiteOrDefault(min, max))
            };
        }
     getPadding() {
            return {
                left: this.paddingLeft || 0,
                top: this.paddingTop || 0,
                right: this.paddingRight || 0,
                bottom: this.paddingBottom || 0
            };
        }
     getTicks() {
            return this.ticks;
        }
     getLabels() {
            const data = this.chart.data;
            return this.options.labels || (this.isHorizontal() ? data.xLabels : data.yLabels) || data.labels || [];
        }
        beforeLayout() {
            this._cache = {};
            this._dataLimitsCached = false;
        }
        beforeUpdate() {
            callback(this.options.beforeUpdate, [
                this
            ]);
        }
     update(maxWidth, maxHeight, margins) {
            const { beginAtZero , grace , ticks: tickOpts  } = this.options;
            const sampleSize = tickOpts.sampleSize;
            this.beforeUpdate();
            this.maxWidth = maxWidth;
            this.maxHeight = maxHeight;
            this._margins = margins = Object.assign({
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            }, margins);
            this.ticks = null;
            this._labelSizes = null;
            this._gridLineItems = null;
            this._labelItems = null;
            this.beforeSetDimensions();
            this.setDimensions();
            this.afterSetDimensions();
            this._maxLength = this.isHorizontal() ? this.width + margins.left + margins.right : this.height + margins.top + margins.bottom;
            if (!this._dataLimitsCached) {
                this.beforeDataLimits();
                this.determineDataLimits();
                this.afterDataLimits();
                this._range = _addGrace(this, grace, beginAtZero);
                this._dataLimitsCached = true;
            }
            this.beforeBuildTicks();
            this.ticks = this.buildTicks() || [];
            this.afterBuildTicks();
            const samplingEnabled = sampleSize < this.ticks.length;
            this._convertTicksToLabels(samplingEnabled ? sample(this.ticks, sampleSize) : this.ticks);
            this.configure();
            this.beforeCalculateLabelRotation();
            this.calculateLabelRotation();
            this.afterCalculateLabelRotation();
            if (tickOpts.display && (tickOpts.autoSkip || tickOpts.source === 'auto')) {
                this.ticks = autoSkip(this, this.ticks);
                this._labelSizes = null;
                this.afterAutoSkip();
            }
            if (samplingEnabled) {
                this._convertTicksToLabels(this.ticks);
            }
            this.beforeFit();
            this.fit();
            this.afterFit();
            this.afterUpdate();
        }
     configure() {
            let reversePixels = this.options.reverse;
            let startPixel, endPixel;
            if (this.isHorizontal()) {
                startPixel = this.left;
                endPixel = this.right;
            } else {
                startPixel = this.top;
                endPixel = this.bottom;
                reversePixels = !reversePixels;
            }
            this._startPixel = startPixel;
            this._endPixel = endPixel;
            this._reversePixels = reversePixels;
            this._length = endPixel - startPixel;
            this._alignToPixels = this.options.alignToPixels;
        }
        afterUpdate() {
            callback(this.options.afterUpdate, [
                this
            ]);
        }
        beforeSetDimensions() {
            callback(this.options.beforeSetDimensions, [
                this
            ]);
        }
        setDimensions() {
            if (this.isHorizontal()) {
                this.width = this.maxWidth;
                this.left = 0;
                this.right = this.width;
            } else {
                this.height = this.maxHeight;
                this.top = 0;
                this.bottom = this.height;
            }
            this.paddingLeft = 0;
            this.paddingTop = 0;
            this.paddingRight = 0;
            this.paddingBottom = 0;
        }
        afterSetDimensions() {
            callback(this.options.afterSetDimensions, [
                this
            ]);
        }
        _callHooks(name) {
            this.chart.notifyPlugins(name, this.getContext());
            callback(this.options[name], [
                this
            ]);
        }
        beforeDataLimits() {
            this._callHooks('beforeDataLimits');
        }
        determineDataLimits() {}
        afterDataLimits() {
            this._callHooks('afterDataLimits');
        }
        beforeBuildTicks() {
            this._callHooks('beforeBuildTicks');
        }
     buildTicks() {
            return [];
        }
        afterBuildTicks() {
            this._callHooks('afterBuildTicks');
        }
        beforeTickToLabelConversion() {
            callback(this.options.beforeTickToLabelConversion, [
                this
            ]);
        }
     generateTickLabels(ticks) {
            const tickOpts = this.options.ticks;
            let i, ilen, tick;
            for(i = 0, ilen = ticks.length; i < ilen; i++){
                tick = ticks[i];
                tick.label = callback(tickOpts.callback, [
                    tick.value,
                    i,
                    ticks
                ], this);
            }
        }
        afterTickToLabelConversion() {
            callback(this.options.afterTickToLabelConversion, [
                this
            ]);
        }
        beforeCalculateLabelRotation() {
            callback(this.options.beforeCalculateLabelRotation, [
                this
            ]);
        }
        calculateLabelRotation() {
            const options = this.options;
            const tickOpts = options.ticks;
            const numTicks = this.ticks.length;
            const minRotation = tickOpts.minRotation || 0;
            const maxRotation = tickOpts.maxRotation;
            let labelRotation = minRotation;
            let tickWidth, maxHeight, maxLabelDiagonal;
            if (!this._isVisible() || !tickOpts.display || minRotation >= maxRotation || numTicks <= 1 || !this.isHorizontal()) {
                this.labelRotation = minRotation;
                return;
            }
            const labelSizes = this._getLabelSizes();
            const maxLabelWidth = labelSizes.widest.width;
            const maxLabelHeight = labelSizes.highest.height;
            const maxWidth = _limitValue(this.chart.width - maxLabelWidth, 0, this.maxWidth);
            tickWidth = options.offset ? this.maxWidth / numTicks : maxWidth / (numTicks - 1);
            if (maxLabelWidth + 6 > tickWidth) {
                tickWidth = maxWidth / (numTicks - (options.offset ? 0.5 : 1));
                maxHeight = this.maxHeight - getTickMarkLength(options.grid) - tickOpts.padding - getTitleHeight(options.title, this.chart.options.font);
                maxLabelDiagonal = Math.sqrt(maxLabelWidth * maxLabelWidth + maxLabelHeight * maxLabelHeight);
                labelRotation = toDegrees(Math.min(Math.asin(_limitValue((labelSizes.highest.height + 6) / tickWidth, -1, 1)), Math.asin(_limitValue(maxHeight / maxLabelDiagonal, -1, 1)) - Math.asin(_limitValue(maxLabelHeight / maxLabelDiagonal, -1, 1))));
                labelRotation = Math.max(minRotation, Math.min(maxRotation, labelRotation));
            }
            this.labelRotation = labelRotation;
        }
        afterCalculateLabelRotation() {
            callback(this.options.afterCalculateLabelRotation, [
                this
            ]);
        }
        afterAutoSkip() {}
        beforeFit() {
            callback(this.options.beforeFit, [
                this
            ]);
        }
        fit() {
            const minSize = {
                width: 0,
                height: 0
            };
            const { chart , options: { ticks: tickOpts , title: titleOpts , grid: gridOpts  }  } = this;
            const display = this._isVisible();
            const isHorizontal = this.isHorizontal();
            if (display) {
                const titleHeight = getTitleHeight(titleOpts, chart.options.font);
                if (isHorizontal) {
                    minSize.width = this.maxWidth;
                    minSize.height = getTickMarkLength(gridOpts) + titleHeight;
                } else {
                    minSize.height = this.maxHeight;
                    minSize.width = getTickMarkLength(gridOpts) + titleHeight;
                }
                if (tickOpts.display && this.ticks.length) {
                    const { first , last , widest , highest  } = this._getLabelSizes();
                    const tickPadding = tickOpts.padding * 2;
                    const angleRadians = toRadians(this.labelRotation);
                    const cos = Math.cos(angleRadians);
                    const sin = Math.sin(angleRadians);
                    if (isHorizontal) {
                        const labelHeight = tickOpts.mirror ? 0 : sin * widest.width + cos * highest.height;
                        minSize.height = Math.min(this.maxHeight, minSize.height + labelHeight + tickPadding);
                    } else {
                        const labelWidth = tickOpts.mirror ? 0 : cos * widest.width + sin * highest.height;
                        minSize.width = Math.min(this.maxWidth, minSize.width + labelWidth + tickPadding);
                    }
                    this._calculatePadding(first, last, sin, cos);
                }
            }
            this._handleMargins();
            if (isHorizontal) {
                this.width = this._length = chart.width - this._margins.left - this._margins.right;
                this.height = minSize.height;
            } else {
                this.width = minSize.width;
                this.height = this._length = chart.height - this._margins.top - this._margins.bottom;
            }
        }
        _calculatePadding(first, last, sin, cos) {
            const { ticks: { align , padding  } , position  } = this.options;
            const isRotated = this.labelRotation !== 0;
            const labelsBelowTicks = position !== 'top' && this.axis === 'x';
            if (this.isHorizontal()) {
                const offsetLeft = this.getPixelForTick(0) - this.left;
                const offsetRight = this.right - this.getPixelForTick(this.ticks.length - 1);
                let paddingLeft = 0;
                let paddingRight = 0;
                if (isRotated) {
                    if (labelsBelowTicks) {
                        paddingLeft = cos * first.width;
                        paddingRight = sin * last.height;
                    } else {
                        paddingLeft = sin * first.height;
                        paddingRight = cos * last.width;
                    }
                } else if (align === 'start') {
                    paddingRight = last.width;
                } else if (align === 'end') {
                    paddingLeft = first.width;
                } else if (align !== 'inner') {
                    paddingLeft = first.width / 2;
                    paddingRight = last.width / 2;
                }
                this.paddingLeft = Math.max((paddingLeft - offsetLeft + padding) * this.width / (this.width - offsetLeft), 0);
                this.paddingRight = Math.max((paddingRight - offsetRight + padding) * this.width / (this.width - offsetRight), 0);
            } else {
                let paddingTop = last.height / 2;
                let paddingBottom = first.height / 2;
                if (align === 'start') {
                    paddingTop = 0;
                    paddingBottom = first.height;
                } else if (align === 'end') {
                    paddingTop = last.height;
                    paddingBottom = 0;
                }
                this.paddingTop = paddingTop + padding;
                this.paddingBottom = paddingBottom + padding;
            }
        }
     _handleMargins() {
            if (this._margins) {
                this._margins.left = Math.max(this.paddingLeft, this._margins.left);
                this._margins.top = Math.max(this.paddingTop, this._margins.top);
                this._margins.right = Math.max(this.paddingRight, this._margins.right);
                this._margins.bottom = Math.max(this.paddingBottom, this._margins.bottom);
            }
        }
        afterFit() {
            callback(this.options.afterFit, [
                this
            ]);
        }
     isHorizontal() {
            const { axis , position  } = this.options;
            return position === 'top' || position === 'bottom' || axis === 'x';
        }
     isFullSize() {
            return this.options.fullSize;
        }
     _convertTicksToLabels(ticks) {
            this.beforeTickToLabelConversion();
            this.generateTickLabels(ticks);
            let i, ilen;
            for(i = 0, ilen = ticks.length; i < ilen; i++){
                if (isNullOrUndef(ticks[i].label)) {
                    ticks.splice(i, 1);
                    ilen--;
                    i--;
                }
            }
            this.afterTickToLabelConversion();
        }
     _getLabelSizes() {
            let labelSizes = this._labelSizes;
            if (!labelSizes) {
                const sampleSize = this.options.ticks.sampleSize;
                let ticks = this.ticks;
                if (sampleSize < ticks.length) {
                    ticks = sample(ticks, sampleSize);
                }
                this._labelSizes = labelSizes = this._computeLabelSizes(ticks, ticks.length);
            }
            return labelSizes;
        }
     _computeLabelSizes(ticks, length) {
            const { ctx , _longestTextCache: caches  } = this;
            const widths = [];
            const heights = [];
            let widestLabelSize = 0;
            let highestLabelSize = 0;
            let i, j, jlen, label, tickFont, fontString, cache, lineHeight, width, height, nestedLabel;
            for(i = 0; i < length; ++i){
                label = ticks[i].label;
                tickFont = this._resolveTickFontOptions(i);
                ctx.font = fontString = tickFont.string;
                cache = caches[fontString] = caches[fontString] || {
                    data: {},
                    gc: []
                };
                lineHeight = tickFont.lineHeight;
                width = height = 0;
                if (!isNullOrUndef(label) && !isArray(label)) {
                    width = _measureText(ctx, cache.data, cache.gc, width, label);
                    height = lineHeight;
                } else if (isArray(label)) {
                    for(j = 0, jlen = label.length; j < jlen; ++j){
                        nestedLabel = label[j];
                        if (!isNullOrUndef(nestedLabel) && !isArray(nestedLabel)) {
                            width = _measureText(ctx, cache.data, cache.gc, width, nestedLabel);
                            height += lineHeight;
                        }
                    }
                }
                widths.push(width);
                heights.push(height);
                widestLabelSize = Math.max(width, widestLabelSize);
                highestLabelSize = Math.max(height, highestLabelSize);
            }
            garbageCollect(caches, length);
            const widest = widths.indexOf(widestLabelSize);
            const highest = heights.indexOf(highestLabelSize);
            const valueAt = (idx)=>({
                    width: widths[idx] || 0,
                    height: heights[idx] || 0
                });
            return {
                first: valueAt(0),
                last: valueAt(length - 1),
                widest: valueAt(widest),
                highest: valueAt(highest),
                widths,
                heights
            };
        }
     getLabelForValue(value) {
            return value;
        }
     getPixelForValue(value, index) {
            return NaN;
        }
     getValueForPixel(pixel) {}
     getPixelForTick(index) {
            const ticks = this.ticks;
            if (index < 0 || index > ticks.length - 1) {
                return null;
            }
            return this.getPixelForValue(ticks[index].value);
        }
     getPixelForDecimal(decimal) {
            if (this._reversePixels) {
                decimal = 1 - decimal;
            }
            const pixel = this._startPixel + decimal * this._length;
            return _int16Range(this._alignToPixels ? _alignPixel(this.chart, pixel, 0) : pixel);
        }
     getDecimalForPixel(pixel) {
            const decimal = (pixel - this._startPixel) / this._length;
            return this._reversePixels ? 1 - decimal : decimal;
        }
     getBasePixel() {
            return this.getPixelForValue(this.getBaseValue());
        }
     getBaseValue() {
            const { min , max  } = this;
            return min < 0 && max < 0 ? max : min > 0 && max > 0 ? min : 0;
        }
     getContext(index) {
            const ticks = this.ticks || [];
            if (index >= 0 && index < ticks.length) {
                const tick = ticks[index];
                return tick.$context || (tick.$context = createTickContext(this.getContext(), index, tick));
            }
            return this.$context || (this.$context = createScaleContext(this.chart.getContext(), this));
        }
     _tickSize() {
            const optionTicks = this.options.ticks;
            const rot = toRadians(this.labelRotation);
            const cos = Math.abs(Math.cos(rot));
            const sin = Math.abs(Math.sin(rot));
            const labelSizes = this._getLabelSizes();
            const padding = optionTicks.autoSkipPadding || 0;
            const w = labelSizes ? labelSizes.widest.width + padding : 0;
            const h = labelSizes ? labelSizes.highest.height + padding : 0;
            return this.isHorizontal() ? h * cos > w * sin ? w / cos : h / sin : h * sin < w * cos ? h / cos : w / sin;
        }
     _isVisible() {
            const display = this.options.display;
            if (display !== 'auto') {
                return !!display;
            }
            return this.getMatchingVisibleMetas().length > 0;
        }
     _computeGridLineItems(chartArea) {
            const axis = this.axis;
            const chart = this.chart;
            const options = this.options;
            const { grid , position , border  } = options;
            const offset = grid.offset;
            const isHorizontal = this.isHorizontal();
            const ticks = this.ticks;
            const ticksLength = ticks.length + (offset ? 1 : 0);
            const tl = getTickMarkLength(grid);
            const items = [];
            const borderOpts = border.setContext(this.getContext());
            const axisWidth = borderOpts.display ? borderOpts.width : 0;
            const axisHalfWidth = axisWidth / 2;
            const alignBorderValue = function(pixel) {
                return _alignPixel(chart, pixel, axisWidth);
            };
            let borderValue, i, lineValue, alignedLineValue;
            let tx1, ty1, tx2, ty2, x1, y1, x2, y2;
            if (position === 'top') {
                borderValue = alignBorderValue(this.bottom);
                ty1 = this.bottom - tl;
                ty2 = borderValue - axisHalfWidth;
                y1 = alignBorderValue(chartArea.top) + axisHalfWidth;
                y2 = chartArea.bottom;
            } else if (position === 'bottom') {
                borderValue = alignBorderValue(this.top);
                y1 = chartArea.top;
                y2 = alignBorderValue(chartArea.bottom) - axisHalfWidth;
                ty1 = borderValue + axisHalfWidth;
                ty2 = this.top + tl;
            } else if (position === 'left') {
                borderValue = alignBorderValue(this.right);
                tx1 = this.right - tl;
                tx2 = borderValue - axisHalfWidth;
                x1 = alignBorderValue(chartArea.left) + axisHalfWidth;
                x2 = chartArea.right;
            } else if (position === 'right') {
                borderValue = alignBorderValue(this.left);
                x1 = chartArea.left;
                x2 = alignBorderValue(chartArea.right) - axisHalfWidth;
                tx1 = borderValue + axisHalfWidth;
                tx2 = this.left + tl;
            } else if (axis === 'x') {
                if (position === 'center') {
                    borderValue = alignBorderValue((chartArea.top + chartArea.bottom) / 2 + 0.5);
                } else if (isObject(position)) {
                    const positionAxisID = Object.keys(position)[0];
                    const value = position[positionAxisID];
                    borderValue = alignBorderValue(this.chart.scales[positionAxisID].getPixelForValue(value));
                }
                y1 = chartArea.top;
                y2 = chartArea.bottom;
                ty1 = borderValue + axisHalfWidth;
                ty2 = ty1 + tl;
            } else if (axis === 'y') {
                if (position === 'center') {
                    borderValue = alignBorderValue((chartArea.left + chartArea.right) / 2);
                } else if (isObject(position)) {
                    const positionAxisID1 = Object.keys(position)[0];
                    const value1 = position[positionAxisID1];
                    borderValue = alignBorderValue(this.chart.scales[positionAxisID1].getPixelForValue(value1));
                }
                tx1 = borderValue - axisHalfWidth;
                tx2 = tx1 - tl;
                x1 = chartArea.left;
                x2 = chartArea.right;
            }
            const limit = valueOrDefault(options.ticks.maxTicksLimit, ticksLength);
            const step = Math.max(1, Math.ceil(ticksLength / limit));
            for(i = 0; i < ticksLength; i += step){
                const context = this.getContext(i);
                const optsAtIndex = grid.setContext(context);
                const optsAtIndexBorder = border.setContext(context);
                const lineWidth = optsAtIndex.lineWidth;
                const lineColor = optsAtIndex.color;
                const borderDash = optsAtIndexBorder.dash || [];
                const borderDashOffset = optsAtIndexBorder.dashOffset;
                const tickWidth = optsAtIndex.tickWidth;
                const tickColor = optsAtIndex.tickColor;
                const tickBorderDash = optsAtIndex.tickBorderDash || [];
                const tickBorderDashOffset = optsAtIndex.tickBorderDashOffset;
                lineValue = getPixelForGridLine(this, i, offset);
                if (lineValue === undefined) {
                    continue;
                }
                alignedLineValue = _alignPixel(chart, lineValue, lineWidth);
                if (isHorizontal) {
                    tx1 = tx2 = x1 = x2 = alignedLineValue;
                } else {
                    ty1 = ty2 = y1 = y2 = alignedLineValue;
                }
                items.push({
                    tx1,
                    ty1,
                    tx2,
                    ty2,
                    x1,
                    y1,
                    x2,
                    y2,
                    width: lineWidth,
                    color: lineColor,
                    borderDash,
                    borderDashOffset,
                    tickWidth,
                    tickColor,
                    tickBorderDash,
                    tickBorderDashOffset
                });
            }
            this._ticksLength = ticksLength;
            this._borderValue = borderValue;
            return items;
        }
     _computeLabelItems(chartArea) {
            const axis = this.axis;
            const options = this.options;
            const { position , ticks: optionTicks  } = options;
            const isHorizontal = this.isHorizontal();
            const ticks = this.ticks;
            const { align , crossAlign , padding , mirror  } = optionTicks;
            const tl = getTickMarkLength(options.grid);
            const tickAndPadding = tl + padding;
            const hTickAndPadding = mirror ? -padding : tickAndPadding;
            const rotation = -toRadians(this.labelRotation);
            const items = [];
            let i, ilen, tick, label, x, y, textAlign, pixel, font, lineHeight, lineCount, textOffset;
            let textBaseline = 'middle';
            if (position === 'top') {
                y = this.bottom - hTickAndPadding;
                textAlign = this._getXAxisLabelAlignment();
            } else if (position === 'bottom') {
                y = this.top + hTickAndPadding;
                textAlign = this._getXAxisLabelAlignment();
            } else if (position === 'left') {
                const ret = this._getYAxisLabelAlignment(tl);
                textAlign = ret.textAlign;
                x = ret.x;
            } else if (position === 'right') {
                const ret1 = this._getYAxisLabelAlignment(tl);
                textAlign = ret1.textAlign;
                x = ret1.x;
            } else if (axis === 'x') {
                if (position === 'center') {
                    y = (chartArea.top + chartArea.bottom) / 2 + tickAndPadding;
                } else if (isObject(position)) {
                    const positionAxisID = Object.keys(position)[0];
                    const value = position[positionAxisID];
                    y = this.chart.scales[positionAxisID].getPixelForValue(value) + tickAndPadding;
                }
                textAlign = this._getXAxisLabelAlignment();
            } else if (axis === 'y') {
                if (position === 'center') {
                    x = (chartArea.left + chartArea.right) / 2 - tickAndPadding;
                } else if (isObject(position)) {
                    const positionAxisID1 = Object.keys(position)[0];
                    const value1 = position[positionAxisID1];
                    x = this.chart.scales[positionAxisID1].getPixelForValue(value1);
                }
                textAlign = this._getYAxisLabelAlignment(tl).textAlign;
            }
            if (axis === 'y') {
                if (align === 'start') {
                    textBaseline = 'top';
                } else if (align === 'end') {
                    textBaseline = 'bottom';
                }
            }
            const labelSizes = this._getLabelSizes();
            for(i = 0, ilen = ticks.length; i < ilen; ++i){
                tick = ticks[i];
                label = tick.label;
                const optsAtIndex = optionTicks.setContext(this.getContext(i));
                pixel = this.getPixelForTick(i) + optionTicks.labelOffset;
                font = this._resolveTickFontOptions(i);
                lineHeight = font.lineHeight;
                lineCount = isArray(label) ? label.length : 1;
                const halfCount = lineCount / 2;
                const color = optsAtIndex.color;
                const strokeColor = optsAtIndex.textStrokeColor;
                const strokeWidth = optsAtIndex.textStrokeWidth;
                let tickTextAlign = textAlign;
                if (isHorizontal) {
                    x = pixel;
                    if (textAlign === 'inner') {
                        if (i === ilen - 1) {
                            tickTextAlign = !this.options.reverse ? 'right' : 'left';
                        } else if (i === 0) {
                            tickTextAlign = !this.options.reverse ? 'left' : 'right';
                        } else {
                            tickTextAlign = 'center';
                        }
                    }
                    if (position === 'top') {
                        if (crossAlign === 'near' || rotation !== 0) {
                            textOffset = -lineCount * lineHeight + lineHeight / 2;
                        } else if (crossAlign === 'center') {
                            textOffset = -labelSizes.highest.height / 2 - halfCount * lineHeight + lineHeight;
                        } else {
                            textOffset = -labelSizes.highest.height + lineHeight / 2;
                        }
                    } else {
                        if (crossAlign === 'near' || rotation !== 0) {
                            textOffset = lineHeight / 2;
                        } else if (crossAlign === 'center') {
                            textOffset = labelSizes.highest.height / 2 - halfCount * lineHeight;
                        } else {
                            textOffset = labelSizes.highest.height - lineCount * lineHeight;
                        }
                    }
                    if (mirror) {
                        textOffset *= -1;
                    }
                    if (rotation !== 0 && !optsAtIndex.showLabelBackdrop) {
                        x += lineHeight / 2 * Math.sin(rotation);
                    }
                } else {
                    y = pixel;
                    textOffset = (1 - lineCount) * lineHeight / 2;
                }
                let backdrop;
                if (optsAtIndex.showLabelBackdrop) {
                    const labelPadding = toPadding(optsAtIndex.backdropPadding);
                    const height = labelSizes.heights[i];
                    const width = labelSizes.widths[i];
                    let top = textOffset - labelPadding.top;
                    let left = 0 - labelPadding.left;
                    switch(textBaseline){
                        case 'middle':
                            top -= height / 2;
                            break;
                        case 'bottom':
                            top -= height;
                            break;
                    }
                    switch(textAlign){
                        case 'center':
                            left -= width / 2;
                            break;
                        case 'right':
                            left -= width;
                            break;
                    }
                    backdrop = {
                        left,
                        top,
                        width: width + labelPadding.width,
                        height: height + labelPadding.height,
                        color: optsAtIndex.backdropColor
                    };
                }
                items.push({
                    rotation,
                    label,
                    font,
                    color,
                    strokeColor,
                    strokeWidth,
                    textOffset,
                    textAlign: tickTextAlign,
                    textBaseline,
                    translation: [
                        x,
                        y
                    ],
                    backdrop
                });
            }
            return items;
        }
        _getXAxisLabelAlignment() {
            const { position , ticks  } = this.options;
            const rotation = -toRadians(this.labelRotation);
            if (rotation) {
                return position === 'top' ? 'left' : 'right';
            }
            let align = 'center';
            if (ticks.align === 'start') {
                align = 'left';
            } else if (ticks.align === 'end') {
                align = 'right';
            } else if (ticks.align === 'inner') {
                align = 'inner';
            }
            return align;
        }
        _getYAxisLabelAlignment(tl) {
            const { position , ticks: { crossAlign , mirror , padding  }  } = this.options;
            const labelSizes = this._getLabelSizes();
            const tickAndPadding = tl + padding;
            const widest = labelSizes.widest.width;
            let textAlign;
            let x;
            if (position === 'left') {
                if (mirror) {
                    x = this.right + padding;
                    if (crossAlign === 'near') {
                        textAlign = 'left';
                    } else if (crossAlign === 'center') {
                        textAlign = 'center';
                        x += widest / 2;
                    } else {
                        textAlign = 'right';
                        x += widest;
                    }
                } else {
                    x = this.right - tickAndPadding;
                    if (crossAlign === 'near') {
                        textAlign = 'right';
                    } else if (crossAlign === 'center') {
                        textAlign = 'center';
                        x -= widest / 2;
                    } else {
                        textAlign = 'left';
                        x = this.left;
                    }
                }
            } else if (position === 'right') {
                if (mirror) {
                    x = this.left + padding;
                    if (crossAlign === 'near') {
                        textAlign = 'right';
                    } else if (crossAlign === 'center') {
                        textAlign = 'center';
                        x -= widest / 2;
                    } else {
                        textAlign = 'left';
                        x -= widest;
                    }
                } else {
                    x = this.left + tickAndPadding;
                    if (crossAlign === 'near') {
                        textAlign = 'left';
                    } else if (crossAlign === 'center') {
                        textAlign = 'center';
                        x += widest / 2;
                    } else {
                        textAlign = 'right';
                        x = this.right;
                    }
                }
            } else {
                textAlign = 'right';
            }
            return {
                textAlign,
                x
            };
        }
     _computeLabelArea() {
            if (this.options.ticks.mirror) {
                return;
            }
            const chart = this.chart;
            const position = this.options.position;
            if (position === 'left' || position === 'right') {
                return {
                    top: 0,
                    left: this.left,
                    bottom: chart.height,
                    right: this.right
                };
            }
            if (position === 'top' || position === 'bottom') {
                return {
                    top: this.top,
                    left: 0,
                    bottom: this.bottom,
                    right: chart.width
                };
            }
        }
     drawBackground() {
            const { ctx , options: { backgroundColor  } , left , top , width , height  } = this;
            if (backgroundColor) {
                ctx.save();
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(left, top, width, height);
                ctx.restore();
            }
        }
        getLineWidthForValue(value) {
            const grid = this.options.grid;
            if (!this._isVisible() || !grid.display) {
                return 0;
            }
            const ticks = this.ticks;
            const index = ticks.findIndex((t)=>t.value === value);
            if (index >= 0) {
                const opts = grid.setContext(this.getContext(index));
                return opts.lineWidth;
            }
            return 0;
        }
     drawGrid(chartArea) {
            const grid = this.options.grid;
            const ctx = this.ctx;
            const items = this._gridLineItems || (this._gridLineItems = this._computeGridLineItems(chartArea));
            let i, ilen;
            const drawLine = (p1, p2, style)=>{
                if (!style.width || !style.color) {
                    return;
                }
                ctx.save();
                ctx.lineWidth = style.width;
                ctx.strokeStyle = style.color;
                ctx.setLineDash(style.borderDash || []);
                ctx.lineDashOffset = style.borderDashOffset;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
                ctx.restore();
            };
            if (grid.display) {
                for(i = 0, ilen = items.length; i < ilen; ++i){
                    const item = items[i];
                    if (grid.drawOnChartArea) {
                        drawLine({
                            x: item.x1,
                            y: item.y1
                        }, {
                            x: item.x2,
                            y: item.y2
                        }, item);
                    }
                    if (grid.drawTicks) {
                        drawLine({
                            x: item.tx1,
                            y: item.ty1
                        }, {
                            x: item.tx2,
                            y: item.ty2
                        }, {
                            color: item.tickColor,
                            width: item.tickWidth,
                            borderDash: item.tickBorderDash,
                            borderDashOffset: item.tickBorderDashOffset
                        });
                    }
                }
            }
        }
     drawBorder() {
            const { chart , ctx , options: { border , grid  }  } = this;
            const borderOpts = border.setContext(this.getContext());
            const axisWidth = border.display ? borderOpts.width : 0;
            if (!axisWidth) {
                return;
            }
            const lastLineWidth = grid.setContext(this.getContext(0)).lineWidth;
            const borderValue = this._borderValue;
            let x1, x2, y1, y2;
            if (this.isHorizontal()) {
                x1 = _alignPixel(chart, this.left, axisWidth) - axisWidth / 2;
                x2 = _alignPixel(chart, this.right, lastLineWidth) + lastLineWidth / 2;
                y1 = y2 = borderValue;
            } else {
                y1 = _alignPixel(chart, this.top, axisWidth) - axisWidth / 2;
                y2 = _alignPixel(chart, this.bottom, lastLineWidth) + lastLineWidth / 2;
                x1 = x2 = borderValue;
            }
            ctx.save();
            ctx.lineWidth = borderOpts.width;
            ctx.strokeStyle = borderOpts.color;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
        }
     drawLabels(chartArea) {
            const optionTicks = this.options.ticks;
            if (!optionTicks.display) {
                return;
            }
            const ctx = this.ctx;
            const area = this._computeLabelArea();
            if (area) {
                clipArea(ctx, area);
            }
            const items = this._labelItems || (this._labelItems = this._computeLabelItems(chartArea));
            let i, ilen;
            for(i = 0, ilen = items.length; i < ilen; ++i){
                const item = items[i];
                const tickFont = item.font;
                const label = item.label;
                let y = item.textOffset;
                renderText(ctx, label, 0, y, tickFont, item);
            }
            if (area) {
                unclipArea(ctx);
            }
        }
     drawTitle() {
            const { ctx , options: { position , title , reverse  }  } = this;
            if (!title.display) {
                return;
            }
            const font = toFont(title.font);
            const padding = toPadding(title.padding);
            const align = title.align;
            let offset = font.lineHeight / 2;
            if (position === 'bottom' || position === 'center' || isObject(position)) {
                offset += padding.bottom;
                if (isArray(title.text)) {
                    offset += font.lineHeight * (title.text.length - 1);
                }
            } else {
                offset += padding.top;
            }
            const { titleX , titleY , maxWidth , rotation  } = titleArgs(this, offset, position, align);
            renderText(ctx, title.text, 0, 0, font, {
                color: title.color,
                maxWidth,
                rotation,
                textAlign: titleAlign(align, position, reverse),
                textBaseline: 'middle',
                translation: [
                    titleX,
                    titleY
                ]
            });
        }
        draw(chartArea) {
            if (!this._isVisible()) {
                return;
            }
            this.drawBackground();
            this.drawGrid(chartArea);
            this.drawBorder();
            this.drawTitle();
            this.drawLabels(chartArea);
        }
     _layers() {
            const opts = this.options;
            const tz = opts.ticks && opts.ticks.z || 0;
            const gz = valueOrDefault(opts.grid && opts.grid.z, -1);
            const bz = valueOrDefault(opts.border && opts.border.z, 0);
            if (!this._isVisible() || this.draw !== Scale.prototype.draw) {
                return [
                    {
                        z: tz,
                        draw: (chartArea)=>{
                            this.draw(chartArea);
                        }
                    }
                ];
            }
            return [
                {
                    z: gz,
                    draw: (chartArea)=>{
                        this.drawBackground();
                        this.drawGrid(chartArea);
                        this.drawTitle();
                    }
                },
                {
                    z: bz,
                    draw: ()=>{
                        this.drawBorder();
                    }
                },
                {
                    z: tz,
                    draw: (chartArea)=>{
                        this.drawLabels(chartArea);
                    }
                }
            ];
        }
     getMatchingVisibleMetas(type) {
            const metas = this.chart.getSortedVisibleDatasetMetas();
            const axisID = this.axis + 'AxisID';
            const result = [];
            let i, ilen;
            for(i = 0, ilen = metas.length; i < ilen; ++i){
                const meta = metas[i];
                if (meta[axisID] === this.id && (!type || meta.type === type)) {
                    result.push(meta);
                }
            }
            return result;
        }
     _resolveTickFontOptions(index) {
            const opts = this.options.ticks.setContext(this.getContext(index));
            return toFont(opts.font);
        }
     _maxDigits() {
            const fontSize = this._resolveTickFontOptions(0).lineHeight;
            return (this.isHorizontal() ? this.width : this.height) / fontSize;
        }
    }

    class TypedRegistry {
        constructor(type, scope, override){
            this.type = type;
            this.scope = scope;
            this.override = override;
            this.items = Object.create(null);
        }
        isForType(type) {
            return Object.prototype.isPrototypeOf.call(this.type.prototype, type.prototype);
        }
     register(item) {
            const proto = Object.getPrototypeOf(item);
            let parentScope;
            if (isIChartComponent(proto)) {
                parentScope = this.register(proto);
            }
            const items = this.items;
            const id = item.id;
            const scope = this.scope + '.' + id;
            if (!id) {
                throw new Error('class does not have id: ' + item);
            }
            if (id in items) {
                return scope;
            }
            items[id] = item;
            registerDefaults(item, scope, parentScope);
            if (this.override) {
                defaults.override(item.id, item.overrides);
            }
            return scope;
        }
     get(id) {
            return this.items[id];
        }
     unregister(item) {
            const items = this.items;
            const id = item.id;
            const scope = this.scope;
            if (id in items) {
                delete items[id];
            }
            if (scope && id in defaults[scope]) {
                delete defaults[scope][id];
                if (this.override) {
                    delete overrides[id];
                }
            }
        }
    }function registerDefaults(item, scope, parentScope) {
        const itemDefaults = merge(Object.create(null), [
            parentScope ? defaults.get(parentScope) : {},
            defaults.get(scope),
            item.defaults
        ]);
        defaults.set(scope, itemDefaults);
        if (item.defaultRoutes) {
            routeDefaults(scope, item.defaultRoutes);
        }
        if (item.descriptors) {
            defaults.describe(scope, item.descriptors);
        }
    }
    function routeDefaults(scope, routes) {
        Object.keys(routes).forEach((property)=>{
            const propertyParts = property.split('.');
            const sourceName = propertyParts.pop();
            const sourceScope = [
                scope
            ].concat(propertyParts).join('.');
            const parts = routes[property].split('.');
            const targetName = parts.pop();
            const targetScope = parts.join('.');
            defaults.route(sourceScope, sourceName, targetScope, targetName);
        });
    }
    function isIChartComponent(proto) {
        return 'id' in proto && 'defaults' in proto;
    }

    class Registry {
        constructor(){
            this.controllers = new TypedRegistry(DatasetController, 'datasets', true);
            this.elements = new TypedRegistry(Element$1, 'elements');
            this.plugins = new TypedRegistry(Object, 'plugins');
            this.scales = new TypedRegistry(Scale, 'scales');
            this._typedRegistries = [
                this.controllers,
                this.scales,
                this.elements
            ];
        }
     add(...args) {
            this._each('register', args);
        }
        remove(...args) {
            this._each('unregister', args);
        }
     addControllers(...args) {
            this._each('register', args, this.controllers);
        }
     addElements(...args) {
            this._each('register', args, this.elements);
        }
     addPlugins(...args) {
            this._each('register', args, this.plugins);
        }
     addScales(...args) {
            this._each('register', args, this.scales);
        }
     getController(id) {
            return this._get(id, this.controllers, 'controller');
        }
     getElement(id) {
            return this._get(id, this.elements, 'element');
        }
     getPlugin(id) {
            return this._get(id, this.plugins, 'plugin');
        }
     getScale(id) {
            return this._get(id, this.scales, 'scale');
        }
     removeControllers(...args) {
            this._each('unregister', args, this.controllers);
        }
     removeElements(...args) {
            this._each('unregister', args, this.elements);
        }
     removePlugins(...args) {
            this._each('unregister', args, this.plugins);
        }
     removeScales(...args) {
            this._each('unregister', args, this.scales);
        }
     _each(method, args, typedRegistry) {
            [
                ...args
            ].forEach((arg)=>{
                const reg = typedRegistry || this._getRegistryForType(arg);
                if (typedRegistry || reg.isForType(arg) || reg === this.plugins && arg.id) {
                    this._exec(method, reg, arg);
                } else {
                    each(arg, (item)=>{
                        const itemReg = typedRegistry || this._getRegistryForType(item);
                        this._exec(method, itemReg, item);
                    });
                }
            });
        }
     _exec(method, registry, component) {
            const camelMethod = _capitalize(method);
            callback(component['before' + camelMethod], [], component);
            registry[method](component);
            callback(component['after' + camelMethod], [], component);
        }
     _getRegistryForType(type) {
            for(let i = 0; i < this._typedRegistries.length; i++){
                const reg = this._typedRegistries[i];
                if (reg.isForType(type)) {
                    return reg;
                }
            }
            return this.plugins;
        }
     _get(id, typedRegistry, type) {
            const item = typedRegistry.get(id);
            if (item === undefined) {
                throw new Error('"' + id + '" is not a registered ' + type + '.');
            }
            return item;
        }
    }
    var registry = /* #__PURE__ */ new Registry();

    class PluginService {
        constructor(){
            this._init = [];
        }
     notify(chart, hook, args, filter) {
            if (hook === 'beforeInit') {
                this._init = this._createDescriptors(chart, true);
                this._notify(this._init, chart, 'install');
            }
            const descriptors = filter ? this._descriptors(chart).filter(filter) : this._descriptors(chart);
            const result = this._notify(descriptors, chart, hook, args);
            if (hook === 'afterDestroy') {
                this._notify(descriptors, chart, 'stop');
                this._notify(this._init, chart, 'uninstall');
            }
            return result;
        }
     _notify(descriptors, chart, hook, args) {
            args = args || {};
            for (const descriptor of descriptors){
                const plugin = descriptor.plugin;
                const method = plugin[hook];
                const params = [
                    chart,
                    args,
                    descriptor.options
                ];
                if (callback(method, params, plugin) === false && args.cancelable) {
                    return false;
                }
            }
            return true;
        }
        invalidate() {
            if (!isNullOrUndef(this._cache)) {
                this._oldCache = this._cache;
                this._cache = undefined;
            }
        }
     _descriptors(chart) {
            if (this._cache) {
                return this._cache;
            }
            const descriptors = this._cache = this._createDescriptors(chart);
            this._notifyStateChanges(chart);
            return descriptors;
        }
        _createDescriptors(chart, all) {
            const config = chart && chart.config;
            const options = valueOrDefault(config.options && config.options.plugins, {});
            const plugins = allPlugins(config);
            return options === false && !all ? [] : createDescriptors(chart, plugins, options, all);
        }
     _notifyStateChanges(chart) {
            const previousDescriptors = this._oldCache || [];
            const descriptors = this._cache;
            const diff = (a, b)=>a.filter((x)=>!b.some((y)=>x.plugin.id === y.plugin.id));
            this._notify(diff(previousDescriptors, descriptors), chart, 'stop');
            this._notify(diff(descriptors, previousDescriptors), chart, 'start');
        }
    } function allPlugins(config) {
        const localIds = {};
        const plugins = [];
        const keys = Object.keys(registry.plugins.items);
        for(let i = 0; i < keys.length; i++){
            plugins.push(registry.getPlugin(keys[i]));
        }
        const local = config.plugins || [];
        for(let i1 = 0; i1 < local.length; i1++){
            const plugin = local[i1];
            if (plugins.indexOf(plugin) === -1) {
                plugins.push(plugin);
                localIds[plugin.id] = true;
            }
        }
        return {
            plugins,
            localIds
        };
    }
    function getOpts(options, all) {
        if (!all && options === false) {
            return null;
        }
        if (options === true) {
            return {};
        }
        return options;
    }
    function createDescriptors(chart, { plugins , localIds  }, options, all) {
        const result = [];
        const context = chart.getContext();
        for (const plugin of plugins){
            const id = plugin.id;
            const opts = getOpts(options[id], all);
            if (opts === null) {
                continue;
            }
            result.push({
                plugin,
                options: pluginOpts(chart.config, {
                    plugin,
                    local: localIds[id]
                }, opts, context)
            });
        }
        return result;
    }
    function pluginOpts(config, { plugin , local  }, opts, context) {
        const keys = config.pluginScopeKeys(plugin);
        const scopes = config.getOptionScopes(opts, keys);
        if (local && plugin.defaults) {
            scopes.push(plugin.defaults);
        }
        return config.createResolver(scopes, context, [
            ''
        ], {
            scriptable: false,
            indexable: false,
            allKeys: true
        });
    }

    function getIndexAxis(type, options) {
        const datasetDefaults = defaults.datasets[type] || {};
        const datasetOptions = (options.datasets || {})[type] || {};
        return datasetOptions.indexAxis || options.indexAxis || datasetDefaults.indexAxis || 'x';
    }
    function getAxisFromDefaultScaleID(id, indexAxis) {
        let axis = id;
        if (id === '_index_') {
            axis = indexAxis;
        } else if (id === '_value_') {
            axis = indexAxis === 'x' ? 'y' : 'x';
        }
        return axis;
    }
    function getDefaultScaleIDFromAxis(axis, indexAxis) {
        return axis === indexAxis ? '_index_' : '_value_';
    }
    function axisFromPosition(position) {
        if (position === 'top' || position === 'bottom') {
            return 'x';
        }
        if (position === 'left' || position === 'right') {
            return 'y';
        }
    }
    function determineAxis(id, scaleOptions) {
        if (id === 'x' || id === 'y' || id === 'r') {
            return id;
        }
        id = scaleOptions.axis || axisFromPosition(scaleOptions.position) || id.length > 1 && determineAxis(id[0].toLowerCase(), scaleOptions);
        if (id) {
            return id;
        }
        throw new Error(`Cannot determine type of '${name}' axis. Please provide 'axis' or 'position' option.`);
    }
    function mergeScaleConfig(config, options) {
        const chartDefaults = overrides[config.type] || {
            scales: {}
        };
        const configScales = options.scales || {};
        const chartIndexAxis = getIndexAxis(config.type, options);
        const scales = Object.create(null);
        Object.keys(configScales).forEach((id)=>{
            const scaleConf = configScales[id];
            if (!isObject(scaleConf)) {
                return console.error(`Invalid scale configuration for scale: ${id}`);
            }
            if (scaleConf._proxy) {
                return console.warn(`Ignoring resolver passed as options for scale: ${id}`);
            }
            const axis = determineAxis(id, scaleConf);
            const defaultId = getDefaultScaleIDFromAxis(axis, chartIndexAxis);
            const defaultScaleOptions = chartDefaults.scales || {};
            scales[id] = mergeIf(Object.create(null), [
                {
                    axis
                },
                scaleConf,
                defaultScaleOptions[axis],
                defaultScaleOptions[defaultId]
            ]);
        });
        config.data.datasets.forEach((dataset)=>{
            const type = dataset.type || config.type;
            const indexAxis = dataset.indexAxis || getIndexAxis(type, options);
            const datasetDefaults = overrides[type] || {};
            const defaultScaleOptions = datasetDefaults.scales || {};
            Object.keys(defaultScaleOptions).forEach((defaultID)=>{
                const axis = getAxisFromDefaultScaleID(defaultID, indexAxis);
                const id = dataset[axis + 'AxisID'] || axis;
                scales[id] = scales[id] || Object.create(null);
                mergeIf(scales[id], [
                    {
                        axis
                    },
                    configScales[id],
                    defaultScaleOptions[defaultID]
                ]);
            });
        });
        Object.keys(scales).forEach((key)=>{
            const scale = scales[key];
            mergeIf(scale, [
                defaults.scales[scale.type],
                defaults.scale
            ]);
        });
        return scales;
    }
    function initOptions(config) {
        const options = config.options || (config.options = {});
        options.plugins = valueOrDefault(options.plugins, {});
        options.scales = mergeScaleConfig(config, options);
    }
    function initData(data) {
        data = data || {};
        data.datasets = data.datasets || [];
        data.labels = data.labels || [];
        return data;
    }
    function initConfig(config) {
        config = config || {};
        config.data = initData(config.data);
        initOptions(config);
        return config;
    }
    const keyCache = new Map();
    const keysCached = new Set();
    function cachedKeys(cacheKey, generate) {
        let keys = keyCache.get(cacheKey);
        if (!keys) {
            keys = generate();
            keyCache.set(cacheKey, keys);
            keysCached.add(keys);
        }
        return keys;
    }
    const addIfFound = (set, obj, key)=>{
        const opts = resolveObjectKey(obj, key);
        if (opts !== undefined) {
            set.add(opts);
        }
    };
    class Config {
        constructor(config){
            this._config = initConfig(config);
            this._scopeCache = new Map();
            this._resolverCache = new Map();
        }
        get platform() {
            return this._config.platform;
        }
        get type() {
            return this._config.type;
        }
        set type(type) {
            this._config.type = type;
        }
        get data() {
            return this._config.data;
        }
        set data(data) {
            this._config.data = initData(data);
        }
        get options() {
            return this._config.options;
        }
        set options(options) {
            this._config.options = options;
        }
        get plugins() {
            return this._config.plugins;
        }
        update() {
            const config = this._config;
            this.clearCache();
            initOptions(config);
        }
        clearCache() {
            this._scopeCache.clear();
            this._resolverCache.clear();
        }
     datasetScopeKeys(datasetType) {
            return cachedKeys(datasetType, ()=>[
                    [
                        `datasets.${datasetType}`,
                        ''
                    ]
                ]);
        }
     datasetAnimationScopeKeys(datasetType, transition) {
            return cachedKeys(`${datasetType}.transition.${transition}`, ()=>[
                    [
                        `datasets.${datasetType}.transitions.${transition}`,
                        `transitions.${transition}`,
                    ],
                    [
                        `datasets.${datasetType}`,
                        ''
                    ]
                ]);
        }
     datasetElementScopeKeys(datasetType, elementType) {
            return cachedKeys(`${datasetType}-${elementType}`, ()=>[
                    [
                        `datasets.${datasetType}.elements.${elementType}`,
                        `datasets.${datasetType}`,
                        `elements.${elementType}`,
                        ''
                    ]
                ]);
        }
     pluginScopeKeys(plugin) {
            const id = plugin.id;
            const type = this.type;
            return cachedKeys(`${type}-plugin-${id}`, ()=>[
                    [
                        `plugins.${id}`,
                        ...plugin.additionalOptionScopes || [],
                    ]
                ]);
        }
     _cachedScopes(mainScope, resetCache) {
            const _scopeCache = this._scopeCache;
            let cache = _scopeCache.get(mainScope);
            if (!cache || resetCache) {
                cache = new Map();
                _scopeCache.set(mainScope, cache);
            }
            return cache;
        }
     getOptionScopes(mainScope, keyLists, resetCache) {
            const { options , type  } = this;
            const cache = this._cachedScopes(mainScope, resetCache);
            const cached = cache.get(keyLists);
            if (cached) {
                return cached;
            }
            const scopes = new Set();
            keyLists.forEach((keys)=>{
                if (mainScope) {
                    scopes.add(mainScope);
                    keys.forEach((key)=>addIfFound(scopes, mainScope, key));
                }
                keys.forEach((key)=>addIfFound(scopes, options, key));
                keys.forEach((key)=>addIfFound(scopes, overrides[type] || {}, key));
                keys.forEach((key)=>addIfFound(scopes, defaults, key));
                keys.forEach((key)=>addIfFound(scopes, descriptors, key));
            });
            const array = Array.from(scopes);
            if (array.length === 0) {
                array.push(Object.create(null));
            }
            if (keysCached.has(keyLists)) {
                cache.set(keyLists, array);
            }
            return array;
        }
     chartOptionScopes() {
            const { options , type  } = this;
            return [
                options,
                overrides[type] || {},
                defaults.datasets[type] || {},
                {
                    type
                },
                defaults,
                descriptors
            ];
        }
     resolveNamedOptions(scopes, names, context, prefixes = [
            ''
        ]) {
            const result = {
                $shared: true
            };
            const { resolver , subPrefixes  } = getResolver(this._resolverCache, scopes, prefixes);
            let options = resolver;
            if (needContext(resolver, names)) {
                result.$shared = false;
                context = isFunction(context) ? context() : context;
                const subResolver = this.createResolver(scopes, context, subPrefixes);
                options = _attachContext(resolver, context, subResolver);
            }
            for (const prop of names){
                result[prop] = options[prop];
            }
            return result;
        }
     createResolver(scopes, context, prefixes = [
            ''
        ], descriptorDefaults) {
            const { resolver  } = getResolver(this._resolverCache, scopes, prefixes);
            return isObject(context) ? _attachContext(resolver, context, undefined, descriptorDefaults) : resolver;
        }
    }function getResolver(resolverCache, scopes, prefixes) {
        let cache = resolverCache.get(scopes);
        if (!cache) {
            cache = new Map();
            resolverCache.set(scopes, cache);
        }
        const cacheKey = prefixes.join();
        let cached = cache.get(cacheKey);
        if (!cached) {
            const resolver = _createResolver(scopes, prefixes);
            cached = {
                resolver,
                subPrefixes: prefixes.filter((p)=>!p.toLowerCase().includes('hover'))
            };
            cache.set(cacheKey, cached);
        }
        return cached;
    }
    const hasFunction = (value)=>isObject(value) && Object.getOwnPropertyNames(value).reduce((acc, key)=>acc || isFunction(value[key]), false);
    function needContext(proxy, names) {
        const { isScriptable , isIndexable  } = _descriptors(proxy);
        for (const prop of names){
            const scriptable = isScriptable(prop);
            const indexable = isIndexable(prop);
            const value = (indexable || scriptable) && proxy[prop];
            if (scriptable && (isFunction(value) || hasFunction(value)) || indexable && isArray(value)) {
                return true;
            }
        }
        return false;
    }

    var version = "4.0.1";

    const KNOWN_POSITIONS = [
        'top',
        'bottom',
        'left',
        'right',
        'chartArea'
    ];
    function positionIsHorizontal(position, axis) {
        return position === 'top' || position === 'bottom' || KNOWN_POSITIONS.indexOf(position) === -1 && axis === 'x';
    }
    function compare2Level(l1, l2) {
        return function(a, b) {
            return a[l1] === b[l1] ? a[l2] - b[l2] : a[l1] - b[l1];
        };
    }
    function onAnimationsComplete(context) {
        const chart = context.chart;
        const animationOptions = chart.options.animation;
        chart.notifyPlugins('afterRender');
        callback(animationOptions && animationOptions.onComplete, [
            context
        ], chart);
    }
    function onAnimationProgress(context) {
        const chart = context.chart;
        const animationOptions = chart.options.animation;
        callback(animationOptions && animationOptions.onProgress, [
            context
        ], chart);
    }
     function getCanvas(item) {
        if (_isDomSupported() && typeof item === 'string') {
            item = document.getElementById(item);
        } else if (item && item.length) {
            item = item[0];
        }
        if (item && item.canvas) {
            item = item.canvas;
        }
        return item;
    }
    const instances = {};
    const getChart = (key)=>{
        const canvas = getCanvas(key);
        return Object.values(instances).filter((c)=>c.canvas === canvas).pop();
    };
    function moveNumericKeys(obj, start, move) {
        const keys = Object.keys(obj);
        for (const key of keys){
            const intKey = +key;
            if (intKey >= start) {
                const value = obj[key];
                delete obj[key];
                if (move > 0 || intKey > start) {
                    obj[intKey + move] = value;
                }
            }
        }
    }
     function determineLastEvent(e, lastEvent, inChartArea, isClick) {
        if (!inChartArea || e.type === 'mouseout') {
            return null;
        }
        if (isClick) {
            return lastEvent;
        }
        return e;
    }
    function getDatasetArea(meta) {
        const { xScale , yScale  } = meta;
        if (xScale && yScale) {
            return {
                left: xScale.left,
                right: xScale.right,
                top: yScale.top,
                bottom: yScale.bottom
            };
        }
    }
    class Chart$1 {
        static defaults = defaults;
        static instances = instances;
        static overrides = overrides;
        static registry = registry;
        static version = version;
        static getChart = getChart;
        static register(...items) {
            registry.add(...items);
            invalidatePlugins();
        }
        static unregister(...items) {
            registry.remove(...items);
            invalidatePlugins();
        }
        constructor(item, userConfig){
            const config = this.config = new Config(userConfig);
            const initialCanvas = getCanvas(item);
            const existingChart = getChart(initialCanvas);
            if (existingChart) {
                throw new Error('Canvas is already in use. Chart with ID \'' + existingChart.id + '\'' + ' must be destroyed before the canvas with ID \'' + existingChart.canvas.id + '\' can be reused.');
            }
            const options = config.createResolver(config.chartOptionScopes(), this.getContext());
            this.platform = new (config.platform || _detectPlatform(initialCanvas))();
            this.platform.updateConfig(config);
            const context = this.platform.acquireContext(initialCanvas, options.aspectRatio);
            const canvas = context && context.canvas;
            const height = canvas && canvas.height;
            const width = canvas && canvas.width;
            this.id = uid();
            this.ctx = context;
            this.canvas = canvas;
            this.width = width;
            this.height = height;
            this._options = options;
            this._aspectRatio = this.aspectRatio;
            this._layers = [];
            this._metasets = [];
            this._stacks = undefined;
            this.boxes = [];
            this.currentDevicePixelRatio = undefined;
            this.chartArea = undefined;
            this._active = [];
            this._lastEvent = undefined;
            this._listeners = {};
             this._responsiveListeners = undefined;
            this._sortedMetasets = [];
            this.scales = {};
            this._plugins = new PluginService();
            this.$proxies = {};
            this._hiddenIndices = {};
            this.attached = false;
            this._animationsDisabled = undefined;
            this.$context = undefined;
            this._doResize = debounce((mode)=>this.update(mode), options.resizeDelay || 0);
            this._dataChanges = [];
            instances[this.id] = this;
            if (!context || !canvas) {
                console.error("Failed to create chart: can't acquire context from the given item");
                return;
            }
            animator.listen(this, 'complete', onAnimationsComplete);
            animator.listen(this, 'progress', onAnimationProgress);
            this._initialize();
            if (this.attached) {
                this.update();
            }
        }
        get aspectRatio() {
            const { options: { aspectRatio , maintainAspectRatio  } , width , height , _aspectRatio  } = this;
            if (!isNullOrUndef(aspectRatio)) {
                return aspectRatio;
            }
            if (maintainAspectRatio && _aspectRatio) {
                return _aspectRatio;
            }
            return height ? width / height : null;
        }
        get data() {
            return this.config.data;
        }
        set data(data) {
            this.config.data = data;
        }
        get options() {
            return this._options;
        }
        set options(options) {
            this.config.options = options;
        }
        get registry() {
            return registry;
        }
     _initialize() {
            this.notifyPlugins('beforeInit');
            if (this.options.responsive) {
                this.resize();
            } else {
                retinaScale(this, this.options.devicePixelRatio);
            }
            this.bindEvents();
            this.notifyPlugins('afterInit');
            return this;
        }
        clear() {
            clearCanvas(this.canvas, this.ctx);
            return this;
        }
        stop() {
            animator.stop(this);
            return this;
        }
     resize(width, height) {
            if (!animator.running(this)) {
                this._resize(width, height);
            } else {
                this._resizeBeforeDraw = {
                    width,
                    height
                };
            }
        }
        _resize(width, height) {
            const options = this.options;
            const canvas = this.canvas;
            const aspectRatio = options.maintainAspectRatio && this.aspectRatio;
            const newSize = this.platform.getMaximumSize(canvas, width, height, aspectRatio);
            const newRatio = options.devicePixelRatio || this.platform.getDevicePixelRatio();
            const mode = this.width ? 'resize' : 'attach';
            this.width = newSize.width;
            this.height = newSize.height;
            this._aspectRatio = this.aspectRatio;
            if (!retinaScale(this, newRatio, true)) {
                return;
            }
            this.notifyPlugins('resize', {
                size: newSize
            });
            callback(options.onResize, [
                this,
                newSize
            ], this);
            if (this.attached) {
                if (this._doResize(mode)) {
                    this.render();
                }
            }
        }
        ensureScalesHaveIDs() {
            const options = this.options;
            const scalesOptions = options.scales || {};
            each(scalesOptions, (axisOptions, axisID)=>{
                axisOptions.id = axisID;
            });
        }
     buildOrUpdateScales() {
            const options = this.options;
            const scaleOpts = options.scales;
            const scales = this.scales;
            const updated = Object.keys(scales).reduce((obj, id)=>{
                obj[id] = false;
                return obj;
            }, {});
            let items = [];
            if (scaleOpts) {
                items = items.concat(Object.keys(scaleOpts).map((id)=>{
                    const scaleOptions = scaleOpts[id];
                    const axis = determineAxis(id, scaleOptions);
                    const isRadial = axis === 'r';
                    const isHorizontal = axis === 'x';
                    return {
                        options: scaleOptions,
                        dposition: isRadial ? 'chartArea' : isHorizontal ? 'bottom' : 'left',
                        dtype: isRadial ? 'radialLinear' : isHorizontal ? 'category' : 'linear'
                    };
                }));
            }
            each(items, (item)=>{
                const scaleOptions = item.options;
                const id = scaleOptions.id;
                const axis = determineAxis(id, scaleOptions);
                const scaleType = valueOrDefault(scaleOptions.type, item.dtype);
                if (scaleOptions.position === undefined || positionIsHorizontal(scaleOptions.position, axis) !== positionIsHorizontal(item.dposition)) {
                    scaleOptions.position = item.dposition;
                }
                updated[id] = true;
                let scale = null;
                if (id in scales && scales[id].type === scaleType) {
                    scale = scales[id];
                } else {
                    const scaleClass = registry.getScale(scaleType);
                    scale = new scaleClass({
                        id,
                        type: scaleType,
                        ctx: this.ctx,
                        chart: this
                    });
                    scales[scale.id] = scale;
                }
                scale.init(scaleOptions, options);
            });
            each(updated, (hasUpdated, id)=>{
                if (!hasUpdated) {
                    delete scales[id];
                }
            });
            each(scales, (scale)=>{
                layouts.configure(this, scale, scale.options);
                layouts.addBox(this, scale);
            });
        }
     _updateMetasets() {
            const metasets = this._metasets;
            const numData = this.data.datasets.length;
            const numMeta = metasets.length;
            metasets.sort((a, b)=>a.index - b.index);
            if (numMeta > numData) {
                for(let i = numData; i < numMeta; ++i){
                    this._destroyDatasetMeta(i);
                }
                metasets.splice(numData, numMeta - numData);
            }
            this._sortedMetasets = metasets.slice(0).sort(compare2Level('order', 'index'));
        }
     _removeUnreferencedMetasets() {
            const { _metasets: metasets , data: { datasets  }  } = this;
            if (metasets.length > datasets.length) {
                delete this._stacks;
            }
            metasets.forEach((meta, index)=>{
                if (datasets.filter((x)=>x === meta._dataset).length === 0) {
                    this._destroyDatasetMeta(index);
                }
            });
        }
        buildOrUpdateControllers() {
            const newControllers = [];
            const datasets = this.data.datasets;
            let i, ilen;
            this._removeUnreferencedMetasets();
            for(i = 0, ilen = datasets.length; i < ilen; i++){
                const dataset = datasets[i];
                let meta = this.getDatasetMeta(i);
                const type = dataset.type || this.config.type;
                if (meta.type && meta.type !== type) {
                    this._destroyDatasetMeta(i);
                    meta = this.getDatasetMeta(i);
                }
                meta.type = type;
                meta.indexAxis = dataset.indexAxis || getIndexAxis(type, this.options);
                meta.order = dataset.order || 0;
                meta.index = i;
                meta.label = '' + dataset.label;
                meta.visible = this.isDatasetVisible(i);
                if (meta.controller) {
                    meta.controller.updateIndex(i);
                    meta.controller.linkScales();
                } else {
                    const ControllerClass = registry.getController(type);
                    const { datasetElementType , dataElementType  } = defaults.datasets[type];
                    Object.assign(ControllerClass, {
                        dataElementType: registry.getElement(dataElementType),
                        datasetElementType: datasetElementType && registry.getElement(datasetElementType)
                    });
                    meta.controller = new ControllerClass(this, i);
                    newControllers.push(meta.controller);
                }
            }
            this._updateMetasets();
            return newControllers;
        }
     _resetElements() {
            each(this.data.datasets, (dataset, datasetIndex)=>{
                this.getDatasetMeta(datasetIndex).controller.reset();
            }, this);
        }
     reset() {
            this._resetElements();
            this.notifyPlugins('reset');
        }
        update(mode) {
            const config = this.config;
            config.update();
            const options = this._options = config.createResolver(config.chartOptionScopes(), this.getContext());
            const animsDisabled = this._animationsDisabled = !options.animation;
            this._updateScales();
            this._checkEventBindings();
            this._updateHiddenIndices();
            this._plugins.invalidate();
            if (this.notifyPlugins('beforeUpdate', {
                mode,
                cancelable: true
            }) === false) {
                return;
            }
            const newControllers = this.buildOrUpdateControllers();
            this.notifyPlugins('beforeElementsUpdate');
            let minPadding = 0;
            for(let i = 0, ilen = this.data.datasets.length; i < ilen; i++){
                const { controller  } = this.getDatasetMeta(i);
                const reset = !animsDisabled && newControllers.indexOf(controller) === -1;
                controller.buildOrUpdateElements(reset);
                minPadding = Math.max(+controller.getMaxOverflow(), minPadding);
            }
            minPadding = this._minPadding = options.layout.autoPadding ? minPadding : 0;
            this._updateLayout(minPadding);
            if (!animsDisabled) {
                each(newControllers, (controller)=>{
                    controller.reset();
                });
            }
            this._updateDatasets(mode);
            this.notifyPlugins('afterUpdate', {
                mode
            });
            this._layers.sort(compare2Level('z', '_idx'));
            const { _active , _lastEvent  } = this;
            if (_lastEvent) {
                this._eventHandler(_lastEvent, true);
            } else if (_active.length) {
                this._updateHoverStyles(_active, _active, true);
            }
            this.render();
        }
     _updateScales() {
            each(this.scales, (scale)=>{
                layouts.removeBox(this, scale);
            });
            this.ensureScalesHaveIDs();
            this.buildOrUpdateScales();
        }
     _checkEventBindings() {
            const options = this.options;
            const existingEvents = new Set(Object.keys(this._listeners));
            const newEvents = new Set(options.events);
            if (!setsEqual(existingEvents, newEvents) || !!this._responsiveListeners !== options.responsive) {
                this.unbindEvents();
                this.bindEvents();
            }
        }
     _updateHiddenIndices() {
            const { _hiddenIndices  } = this;
            const changes = this._getUniformDataChanges() || [];
            for (const { method , start , count  } of changes){
                const move = method === '_removeElements' ? -count : count;
                moveNumericKeys(_hiddenIndices, start, move);
            }
        }
     _getUniformDataChanges() {
            const _dataChanges = this._dataChanges;
            if (!_dataChanges || !_dataChanges.length) {
                return;
            }
            this._dataChanges = [];
            const datasetCount = this.data.datasets.length;
            const makeSet = (idx)=>new Set(_dataChanges.filter((c)=>c[0] === idx).map((c, i)=>i + ',' + c.splice(1).join(',')));
            const changeSet = makeSet(0);
            for(let i = 1; i < datasetCount; i++){
                if (!setsEqual(changeSet, makeSet(i))) {
                    return;
                }
            }
            return Array.from(changeSet).map((c)=>c.split(',')).map((a)=>({
                    method: a[1],
                    start: +a[2],
                    count: +a[3]
                }));
        }
     _updateLayout(minPadding) {
            if (this.notifyPlugins('beforeLayout', {
                cancelable: true
            }) === false) {
                return;
            }
            layouts.update(this, this.width, this.height, minPadding);
            const area = this.chartArea;
            const noArea = area.width <= 0 || area.height <= 0;
            this._layers = [];
            each(this.boxes, (box)=>{
                if (noArea && box.position === 'chartArea') {
                    return;
                }
                if (box.configure) {
                    box.configure();
                }
                this._layers.push(...box._layers());
            }, this);
            this._layers.forEach((item, index)=>{
                item._idx = index;
            });
            this.notifyPlugins('afterLayout');
        }
     _updateDatasets(mode) {
            if (this.notifyPlugins('beforeDatasetsUpdate', {
                mode,
                cancelable: true
            }) === false) {
                return;
            }
            for(let i = 0, ilen = this.data.datasets.length; i < ilen; ++i){
                this.getDatasetMeta(i).controller.configure();
            }
            for(let i1 = 0, ilen1 = this.data.datasets.length; i1 < ilen1; ++i1){
                this._updateDataset(i1, isFunction(mode) ? mode({
                    datasetIndex: i1
                }) : mode);
            }
            this.notifyPlugins('afterDatasetsUpdate', {
                mode
            });
        }
     _updateDataset(index, mode) {
            const meta = this.getDatasetMeta(index);
            const args = {
                meta,
                index,
                mode,
                cancelable: true
            };
            if (this.notifyPlugins('beforeDatasetUpdate', args) === false) {
                return;
            }
            meta.controller._update(mode);
            args.cancelable = false;
            this.notifyPlugins('afterDatasetUpdate', args);
        }
        render() {
            if (this.notifyPlugins('beforeRender', {
                cancelable: true
            }) === false) {
                return;
            }
            if (animator.has(this)) {
                if (this.attached && !animator.running(this)) {
                    animator.start(this);
                }
            } else {
                this.draw();
                onAnimationsComplete({
                    chart: this
                });
            }
        }
        draw() {
            let i;
            if (this._resizeBeforeDraw) {
                const { width , height  } = this._resizeBeforeDraw;
                this._resize(width, height);
                this._resizeBeforeDraw = null;
            }
            this.clear();
            if (this.width <= 0 || this.height <= 0) {
                return;
            }
            if (this.notifyPlugins('beforeDraw', {
                cancelable: true
            }) === false) {
                return;
            }
            const layers = this._layers;
            for(i = 0; i < layers.length && layers[i].z <= 0; ++i){
                layers[i].draw(this.chartArea);
            }
            this._drawDatasets();
            for(; i < layers.length; ++i){
                layers[i].draw(this.chartArea);
            }
            this.notifyPlugins('afterDraw');
        }
     _getSortedDatasetMetas(filterVisible) {
            const metasets = this._sortedMetasets;
            const result = [];
            let i, ilen;
            for(i = 0, ilen = metasets.length; i < ilen; ++i){
                const meta = metasets[i];
                if (!filterVisible || meta.visible) {
                    result.push(meta);
                }
            }
            return result;
        }
     getSortedVisibleDatasetMetas() {
            return this._getSortedDatasetMetas(true);
        }
     _drawDatasets() {
            if (this.notifyPlugins('beforeDatasetsDraw', {
                cancelable: true
            }) === false) {
                return;
            }
            const metasets = this.getSortedVisibleDatasetMetas();
            for(let i = metasets.length - 1; i >= 0; --i){
                this._drawDataset(metasets[i]);
            }
            this.notifyPlugins('afterDatasetsDraw');
        }
     _drawDataset(meta) {
            const ctx = this.ctx;
            const clip = meta._clip;
            const useClip = !clip.disabled;
            const area = getDatasetArea(meta) || this.chartArea;
            const args = {
                meta,
                index: meta.index,
                cancelable: true
            };
            if (this.notifyPlugins('beforeDatasetDraw', args) === false) {
                return;
            }
            if (useClip) {
                clipArea(ctx, {
                    left: clip.left === false ? 0 : area.left - clip.left,
                    right: clip.right === false ? this.width : area.right + clip.right,
                    top: clip.top === false ? 0 : area.top - clip.top,
                    bottom: clip.bottom === false ? this.height : area.bottom + clip.bottom
                });
            }
            meta.controller.draw();
            if (useClip) {
                unclipArea(ctx);
            }
            args.cancelable = false;
            this.notifyPlugins('afterDatasetDraw', args);
        }
     isPointInArea(point) {
            return _isPointInArea(point, this.chartArea, this._minPadding);
        }
        getElementsAtEventForMode(e, mode, options, useFinalPosition) {
            const method = Interaction.modes[mode];
            if (typeof method === 'function') {
                return method(this, e, options, useFinalPosition);
            }
            return [];
        }
        getDatasetMeta(datasetIndex) {
            const dataset = this.data.datasets[datasetIndex];
            const metasets = this._metasets;
            let meta = metasets.filter((x)=>x && x._dataset === dataset).pop();
            if (!meta) {
                meta = {
                    type: null,
                    data: [],
                    dataset: null,
                    controller: null,
                    hidden: null,
                    xAxisID: null,
                    yAxisID: null,
                    order: dataset && dataset.order || 0,
                    index: datasetIndex,
                    _dataset: dataset,
                    _parsed: [],
                    _sorted: false
                };
                metasets.push(meta);
            }
            return meta;
        }
        getContext() {
            return this.$context || (this.$context = createContext(null, {
                chart: this,
                type: 'chart'
            }));
        }
        getVisibleDatasetCount() {
            return this.getSortedVisibleDatasetMetas().length;
        }
        isDatasetVisible(datasetIndex) {
            const dataset = this.data.datasets[datasetIndex];
            if (!dataset) {
                return false;
            }
            const meta = this.getDatasetMeta(datasetIndex);
            return typeof meta.hidden === 'boolean' ? !meta.hidden : !dataset.hidden;
        }
        setDatasetVisibility(datasetIndex, visible) {
            const meta = this.getDatasetMeta(datasetIndex);
            meta.hidden = !visible;
        }
        toggleDataVisibility(index) {
            this._hiddenIndices[index] = !this._hiddenIndices[index];
        }
        getDataVisibility(index) {
            return !this._hiddenIndices[index];
        }
     _updateVisibility(datasetIndex, dataIndex, visible) {
            const mode = visible ? 'show' : 'hide';
            const meta = this.getDatasetMeta(datasetIndex);
            const anims = meta.controller._resolveAnimations(undefined, mode);
            if (defined(dataIndex)) {
                meta.data[dataIndex].hidden = !visible;
                this.update();
            } else {
                this.setDatasetVisibility(datasetIndex, visible);
                anims.update(meta, {
                    visible
                });
                this.update((ctx)=>ctx.datasetIndex === datasetIndex ? mode : undefined);
            }
        }
        hide(datasetIndex, dataIndex) {
            this._updateVisibility(datasetIndex, dataIndex, false);
        }
        show(datasetIndex, dataIndex) {
            this._updateVisibility(datasetIndex, dataIndex, true);
        }
     _destroyDatasetMeta(datasetIndex) {
            const meta = this._metasets[datasetIndex];
            if (meta && meta.controller) {
                meta.controller._destroy();
            }
            delete this._metasets[datasetIndex];
        }
        _stop() {
            let i, ilen;
            this.stop();
            animator.remove(this);
            for(i = 0, ilen = this.data.datasets.length; i < ilen; ++i){
                this._destroyDatasetMeta(i);
            }
        }
        destroy() {
            this.notifyPlugins('beforeDestroy');
            const { canvas , ctx  } = this;
            this._stop();
            this.config.clearCache();
            if (canvas) {
                this.unbindEvents();
                clearCanvas(canvas, ctx);
                this.platform.releaseContext(ctx);
                this.canvas = null;
                this.ctx = null;
            }
            delete instances[this.id];
            this.notifyPlugins('afterDestroy');
        }
        toBase64Image(...args) {
            return this.canvas.toDataURL(...args);
        }
     bindEvents() {
            this.bindUserEvents();
            if (this.options.responsive) {
                this.bindResponsiveEvents();
            } else {
                this.attached = true;
            }
        }
     bindUserEvents() {
            const listeners = this._listeners;
            const platform = this.platform;
            const _add = (type, listener)=>{
                platform.addEventListener(this, type, listener);
                listeners[type] = listener;
            };
            const listener = (e, x, y)=>{
                e.offsetX = x;
                e.offsetY = y;
                this._eventHandler(e);
            };
            each(this.options.events, (type)=>_add(type, listener));
        }
     bindResponsiveEvents() {
            if (!this._responsiveListeners) {
                this._responsiveListeners = {};
            }
            const listeners = this._responsiveListeners;
            const platform = this.platform;
            const _add = (type, listener)=>{
                platform.addEventListener(this, type, listener);
                listeners[type] = listener;
            };
            const _remove = (type, listener)=>{
                if (listeners[type]) {
                    platform.removeEventListener(this, type, listener);
                    delete listeners[type];
                }
            };
            const listener = (width, height)=>{
                if (this.canvas) {
                    this.resize(width, height);
                }
            };
            let detached;
            const attached = ()=>{
                _remove('attach', attached);
                this.attached = true;
                this.resize();
                _add('resize', listener);
                _add('detach', detached);
            };
            detached = ()=>{
                this.attached = false;
                _remove('resize', listener);
                this._stop();
                this._resize(0, 0);
                _add('attach', attached);
            };
            if (platform.isAttached(this.canvas)) {
                attached();
            } else {
                detached();
            }
        }
     unbindEvents() {
            each(this._listeners, (listener, type)=>{
                this.platform.removeEventListener(this, type, listener);
            });
            this._listeners = {};
            each(this._responsiveListeners, (listener, type)=>{
                this.platform.removeEventListener(this, type, listener);
            });
            this._responsiveListeners = undefined;
        }
        updateHoverStyle(items, mode, enabled) {
            const prefix = enabled ? 'set' : 'remove';
            let meta, item, i, ilen;
            if (mode === 'dataset') {
                meta = this.getDatasetMeta(items[0].datasetIndex);
                meta.controller['_' + prefix + 'DatasetHoverStyle']();
            }
            for(i = 0, ilen = items.length; i < ilen; ++i){
                item = items[i];
                const controller = item && this.getDatasetMeta(item.datasetIndex).controller;
                if (controller) {
                    controller[prefix + 'HoverStyle'](item.element, item.datasetIndex, item.index);
                }
            }
        }
     getActiveElements() {
            return this._active || [];
        }
     setActiveElements(activeElements) {
            const lastActive = this._active || [];
            const active = activeElements.map(({ datasetIndex , index  })=>{
                const meta = this.getDatasetMeta(datasetIndex);
                if (!meta) {
                    throw new Error('No dataset found at index ' + datasetIndex);
                }
                return {
                    datasetIndex,
                    element: meta.data[index],
                    index
                };
            });
            const changed = !_elementsEqual(active, lastActive);
            if (changed) {
                this._active = active;
                this._lastEvent = null;
                this._updateHoverStyles(active, lastActive);
            }
        }
     notifyPlugins(hook, args, filter) {
            return this._plugins.notify(this, hook, args, filter);
        }
     isPluginEnabled(pluginId) {
            return this._plugins._cache.filter((p)=>p.plugin.id === pluginId).length === 1;
        }
     _updateHoverStyles(active, lastActive, replay) {
            const hoverOptions = this.options.hover;
            const diff = (a, b)=>a.filter((x)=>!b.some((y)=>x.datasetIndex === y.datasetIndex && x.index === y.index));
            const deactivated = diff(lastActive, active);
            const activated = replay ? active : diff(active, lastActive);
            if (deactivated.length) {
                this.updateHoverStyle(deactivated, hoverOptions.mode, false);
            }
            if (activated.length && hoverOptions.mode) {
                this.updateHoverStyle(activated, hoverOptions.mode, true);
            }
        }
     _eventHandler(e, replay) {
            const args = {
                event: e,
                replay,
                cancelable: true,
                inChartArea: this.isPointInArea(e)
            };
            const eventFilter = (plugin)=>(plugin.options.events || this.options.events).includes(e.native.type);
            if (this.notifyPlugins('beforeEvent', args, eventFilter) === false) {
                return;
            }
            const changed = this._handleEvent(e, replay, args.inChartArea);
            args.cancelable = false;
            this.notifyPlugins('afterEvent', args, eventFilter);
            if (changed || args.changed) {
                this.render();
            }
            return this;
        }
     _handleEvent(e, replay, inChartArea) {
            const { _active: lastActive = [] , options  } = this;
            const useFinalPosition = replay;
            const active = this._getActiveElements(e, lastActive, inChartArea, useFinalPosition);
            const isClick = _isClickEvent(e);
            const lastEvent = determineLastEvent(e, this._lastEvent, inChartArea, isClick);
            if (inChartArea) {
                this._lastEvent = null;
                callback(options.onHover, [
                    e,
                    active,
                    this
                ], this);
                if (isClick) {
                    callback(options.onClick, [
                        e,
                        active,
                        this
                    ], this);
                }
            }
            const changed = !_elementsEqual(active, lastActive);
            if (changed || replay) {
                this._active = active;
                this._updateHoverStyles(active, lastActive, replay);
            }
            this._lastEvent = lastEvent;
            return changed;
        }
     _getActiveElements(e, lastActive, inChartArea, useFinalPosition) {
            if (e.type === 'mouseout') {
                return [];
            }
            if (!inChartArea) {
                return lastActive;
            }
            const hoverOptions = this.options.hover;
            return this.getElementsAtEventForMode(e, hoverOptions.mode, hoverOptions, useFinalPosition);
        }
    }
    function invalidatePlugins() {
        return each(Chart$1.instances, (chart)=>chart._plugins.invalidate());
    }
    var Chart$1$1 = Chart$1;

    function clipArc(ctx, element, endAngle) {
        const { startAngle , pixelMargin , x , y , outerRadius , innerRadius  } = element;
        let angleMargin = pixelMargin / outerRadius;
        // Draw an inner border by clipping the arc and drawing a double-width border
        // Enlarge the clipping arc by 0.33 pixels to eliminate glitches between borders
        ctx.beginPath();
        ctx.arc(x, y, outerRadius, startAngle - angleMargin, endAngle + angleMargin);
        if (innerRadius > pixelMargin) {
            angleMargin = pixelMargin / innerRadius;
            ctx.arc(x, y, innerRadius, endAngle + angleMargin, startAngle - angleMargin, true);
        } else {
            ctx.arc(x, y, pixelMargin, endAngle + HALF_PI, startAngle - HALF_PI);
        }
        ctx.closePath();
        ctx.clip();
    }
    function toRadiusCorners(value) {
        return _readValueToProps(value, [
            'outerStart',
            'outerEnd',
            'innerStart',
            'innerEnd'
        ]);
    }
    /**
     * Parse border radius from the provided options
     */ function parseBorderRadius$1(arc, innerRadius, outerRadius, angleDelta) {
        const o = toRadiusCorners(arc.options.borderRadius);
        const halfThickness = (outerRadius - innerRadius) / 2;
        const innerLimit = Math.min(halfThickness, angleDelta * innerRadius / 2);
        // Outer limits are complicated. We want to compute the available angular distance at
        // a radius of outerRadius - borderRadius because for small angular distances, this term limits.
        // We compute at r = outerRadius - borderRadius because this circle defines the center of the border corners.
        //
        // If the borderRadius is large, that value can become negative.
        // This causes the outer borders to lose their radius entirely, which is rather unexpected. To solve that, if borderRadius > outerRadius
        // we know that the thickness term will dominate and compute the limits at that point
        const computeOuterLimit = (val)=>{
            const outerArcLimit = (outerRadius - Math.min(halfThickness, val)) * angleDelta / 2;
            return _limitValue(val, 0, Math.min(halfThickness, outerArcLimit));
        };
        return {
            outerStart: computeOuterLimit(o.outerStart),
            outerEnd: computeOuterLimit(o.outerEnd),
            innerStart: _limitValue(o.innerStart, 0, innerLimit),
            innerEnd: _limitValue(o.innerEnd, 0, innerLimit)
        };
    }
    /**
     * Convert (r, 𝜃) to (x, y)
     */ function rThetaToXY(r, theta, x, y) {
        return {
            x: x + r * Math.cos(theta),
            y: y + r * Math.sin(theta)
        };
    }
    /**
     * Path the arc, respecting border radius by separating into left and right halves.
     *
     *   Start      End
     *
     *    1--->a--->2    Outer
     *   /           \
     *   8           3
     *   |           |
     *   |           |
     *   7           4
     *   \           /
     *    6<---b<---5    Inner
     */ function pathArc(ctx, element, offset, spacing, end, circular) {
        const { x , y , startAngle: start , pixelMargin , innerRadius: innerR  } = element;
        const outerRadius = Math.max(element.outerRadius + spacing + offset - pixelMargin, 0);
        const innerRadius = innerR > 0 ? innerR + spacing + offset + pixelMargin : 0;
        let spacingOffset = 0;
        const alpha = end - start;
        if (spacing) {
            // When spacing is present, it is the same for all items
            // So we adjust the start and end angle of the arc such that
            // the distance is the same as it would be without the spacing
            const noSpacingInnerRadius = innerR > 0 ? innerR - spacing : 0;
            const noSpacingOuterRadius = outerRadius > 0 ? outerRadius - spacing : 0;
            const avNogSpacingRadius = (noSpacingInnerRadius + noSpacingOuterRadius) / 2;
            const adjustedAngle = avNogSpacingRadius !== 0 ? alpha * avNogSpacingRadius / (avNogSpacingRadius + spacing) : alpha;
            spacingOffset = (alpha - adjustedAngle) / 2;
        }
        const beta = Math.max(0.001, alpha * outerRadius - offset / PI) / outerRadius;
        const angleOffset = (alpha - beta) / 2;
        const startAngle = start + angleOffset + spacingOffset;
        const endAngle = end - angleOffset - spacingOffset;
        const { outerStart , outerEnd , innerStart , innerEnd  } = parseBorderRadius$1(element, innerRadius, outerRadius, endAngle - startAngle);
        const outerStartAdjustedRadius = outerRadius - outerStart;
        const outerEndAdjustedRadius = outerRadius - outerEnd;
        const outerStartAdjustedAngle = startAngle + outerStart / outerStartAdjustedRadius;
        const outerEndAdjustedAngle = endAngle - outerEnd / outerEndAdjustedRadius;
        const innerStartAdjustedRadius = innerRadius + innerStart;
        const innerEndAdjustedRadius = innerRadius + innerEnd;
        const innerStartAdjustedAngle = startAngle + innerStart / innerStartAdjustedRadius;
        const innerEndAdjustedAngle = endAngle - innerEnd / innerEndAdjustedRadius;
        ctx.beginPath();
        if (circular) {
            // The first arc segments from point 1 to point a to point 2
            const outerMidAdjustedAngle = (outerStartAdjustedAngle + outerEndAdjustedAngle) / 2;
            ctx.arc(x, y, outerRadius, outerStartAdjustedAngle, outerMidAdjustedAngle);
            ctx.arc(x, y, outerRadius, outerMidAdjustedAngle, outerEndAdjustedAngle);
            // The corner segment from point 2 to point 3
            if (outerEnd > 0) {
                const pCenter = rThetaToXY(outerEndAdjustedRadius, outerEndAdjustedAngle, x, y);
                ctx.arc(pCenter.x, pCenter.y, outerEnd, outerEndAdjustedAngle, endAngle + HALF_PI);
            }
            // The line from point 3 to point 4
            const p4 = rThetaToXY(innerEndAdjustedRadius, endAngle, x, y);
            ctx.lineTo(p4.x, p4.y);
            // The corner segment from point 4 to point 5
            if (innerEnd > 0) {
                const pCenter1 = rThetaToXY(innerEndAdjustedRadius, innerEndAdjustedAngle, x, y);
                ctx.arc(pCenter1.x, pCenter1.y, innerEnd, endAngle + HALF_PI, innerEndAdjustedAngle + Math.PI);
            }
            // The inner arc from point 5 to point b to point 6
            const innerMidAdjustedAngle = (endAngle - innerEnd / innerRadius + (startAngle + innerStart / innerRadius)) / 2;
            ctx.arc(x, y, innerRadius, endAngle - innerEnd / innerRadius, innerMidAdjustedAngle, true);
            ctx.arc(x, y, innerRadius, innerMidAdjustedAngle, startAngle + innerStart / innerRadius, true);
            // The corner segment from point 6 to point 7
            if (innerStart > 0) {
                const pCenter2 = rThetaToXY(innerStartAdjustedRadius, innerStartAdjustedAngle, x, y);
                ctx.arc(pCenter2.x, pCenter2.y, innerStart, innerStartAdjustedAngle + Math.PI, startAngle - HALF_PI);
            }
            // The line from point 7 to point 8
            const p8 = rThetaToXY(outerStartAdjustedRadius, startAngle, x, y);
            ctx.lineTo(p8.x, p8.y);
            // The corner segment from point 8 to point 1
            if (outerStart > 0) {
                const pCenter3 = rThetaToXY(outerStartAdjustedRadius, outerStartAdjustedAngle, x, y);
                ctx.arc(pCenter3.x, pCenter3.y, outerStart, startAngle - HALF_PI, outerStartAdjustedAngle);
            }
        } else {
            ctx.moveTo(x, y);
            const outerStartX = Math.cos(outerStartAdjustedAngle) * outerRadius + x;
            const outerStartY = Math.sin(outerStartAdjustedAngle) * outerRadius + y;
            ctx.lineTo(outerStartX, outerStartY);
            const outerEndX = Math.cos(outerEndAdjustedAngle) * outerRadius + x;
            const outerEndY = Math.sin(outerEndAdjustedAngle) * outerRadius + y;
            ctx.lineTo(outerEndX, outerEndY);
        }
        ctx.closePath();
    }
    function drawArc(ctx, element, offset, spacing, circular) {
        const { fullCircles , startAngle , circumference  } = element;
        let endAngle = element.endAngle;
        if (fullCircles) {
            pathArc(ctx, element, offset, spacing, endAngle, circular);
            for(let i = 0; i < fullCircles; ++i){
                ctx.fill();
            }
            if (!isNaN(circumference)) {
                endAngle = startAngle + (circumference % TAU || TAU);
            }
        }
        pathArc(ctx, element, offset, spacing, endAngle, circular);
        ctx.fill();
        return endAngle;
    }
    function drawBorder(ctx, element, offset, spacing, circular) {
        const { fullCircles , startAngle , circumference , options  } = element;
        const { borderWidth , borderJoinStyle  } = options;
        const inner = options.borderAlign === 'inner';
        if (!borderWidth) {
            return;
        }
        if (inner) {
            ctx.lineWidth = borderWidth * 2;
            ctx.lineJoin = borderJoinStyle || 'round';
        } else {
            ctx.lineWidth = borderWidth;
            ctx.lineJoin = borderJoinStyle || 'bevel';
        }
        let endAngle = element.endAngle;
        if (fullCircles) {
            pathArc(ctx, element, offset, spacing, endAngle, circular);
            for(let i = 0; i < fullCircles; ++i){
                ctx.stroke();
            }
            if (!isNaN(circumference)) {
                endAngle = startAngle + (circumference % TAU || TAU);
            }
        }
        if (inner) {
            clipArc(ctx, element, endAngle);
        }
        if (!fullCircles) {
            pathArc(ctx, element, offset, spacing, endAngle, circular);
            ctx.stroke();
        }
    }
    class ArcElement extends Element$1 {
        static id = 'arc';
        static defaults = {
            borderAlign: 'center',
            borderColor: '#fff',
            borderJoinStyle: undefined,
            borderRadius: 0,
            borderWidth: 2,
            offset: 0,
            spacing: 0,
            angle: undefined,
            circular: true
        };
        static defaultRoutes = {
            backgroundColor: 'backgroundColor'
        };
        constructor(cfg){
            super();
            this.options = undefined;
            this.circumference = undefined;
            this.startAngle = undefined;
            this.endAngle = undefined;
            this.innerRadius = undefined;
            this.outerRadius = undefined;
            this.pixelMargin = 0;
            this.fullCircles = 0;
            if (cfg) {
                Object.assign(this, cfg);
            }
        }
        inRange(chartX, chartY, useFinalPosition) {
            const point = this.getProps([
                'x',
                'y'
            ], useFinalPosition);
            const { angle , distance  } = getAngleFromPoint(point, {
                x: chartX,
                y: chartY
            });
            const { startAngle , endAngle , innerRadius , outerRadius , circumference  } = this.getProps([
                'startAngle',
                'endAngle',
                'innerRadius',
                'outerRadius',
                'circumference'
            ], useFinalPosition);
            const rAdjust = this.options.spacing / 2;
            const _circumference = valueOrDefault(circumference, endAngle - startAngle);
            const betweenAngles = _circumference >= TAU || _angleBetween(angle, startAngle, endAngle);
            const withinRadius = _isBetween(distance, innerRadius + rAdjust, outerRadius + rAdjust);
            return betweenAngles && withinRadius;
        }
        getCenterPoint(useFinalPosition) {
            const { x , y , startAngle , endAngle , innerRadius , outerRadius  } = this.getProps([
                'x',
                'y',
                'startAngle',
                'endAngle',
                'innerRadius',
                'outerRadius',
                'circumference', 
            ], useFinalPosition);
            const { offset , spacing  } = this.options;
            const halfAngle = (startAngle + endAngle) / 2;
            const halfRadius = (innerRadius + outerRadius + spacing + offset) / 2;
            return {
                x: x + Math.cos(halfAngle) * halfRadius,
                y: y + Math.sin(halfAngle) * halfRadius
            };
        }
        tooltipPosition(useFinalPosition) {
            return this.getCenterPoint(useFinalPosition);
        }
        draw(ctx) {
            const { options , circumference  } = this;
            const offset = (options.offset || 0) / 4;
            const spacing = (options.spacing || 0) / 2;
            const circular = options.circular;
            this.pixelMargin = options.borderAlign === 'inner' ? 0.33 : 0;
            this.fullCircles = circumference > TAU ? Math.floor(circumference / TAU) : 0;
            if (circumference === 0 || this.innerRadius < 0 || this.outerRadius < 0) {
                return;
            }
            ctx.save();
            const halfAngle = (this.startAngle + this.endAngle) / 2;
            ctx.translate(Math.cos(halfAngle) * offset, Math.sin(halfAngle) * offset);
            const fix = 1 - Math.sin(Math.min(PI, circumference || 0));
            const radiusOffset = offset * fix;
            ctx.fillStyle = options.backgroundColor;
            ctx.strokeStyle = options.borderColor;
            drawArc(ctx, this, radiusOffset, spacing, circular);
            drawBorder(ctx, this, radiusOffset, spacing, circular);
            ctx.restore();
        }
    }

    function setStyle(ctx, options, style = options) {
        ctx.lineCap = valueOrDefault(style.borderCapStyle, options.borderCapStyle);
        ctx.setLineDash(valueOrDefault(style.borderDash, options.borderDash));
        ctx.lineDashOffset = valueOrDefault(style.borderDashOffset, options.borderDashOffset);
        ctx.lineJoin = valueOrDefault(style.borderJoinStyle, options.borderJoinStyle);
        ctx.lineWidth = valueOrDefault(style.borderWidth, options.borderWidth);
        ctx.strokeStyle = valueOrDefault(style.borderColor, options.borderColor);
    }
    function lineTo(ctx, previous, target) {
        ctx.lineTo(target.x, target.y);
    }
    function getLineMethod(options) {
        if (options.stepped) {
            return _steppedLineTo;
        }
        if (options.tension || options.cubicInterpolationMode === 'monotone') {
            return _bezierCurveTo;
        }
        return lineTo;
    }
    function pathVars(points, segment, params = {}) {
        const count = points.length;
        const { start: paramsStart = 0 , end: paramsEnd = count - 1  } = params;
        const { start: segmentStart , end: segmentEnd  } = segment;
        const start = Math.max(paramsStart, segmentStart);
        const end = Math.min(paramsEnd, segmentEnd);
        const outside = paramsStart < segmentStart && paramsEnd < segmentStart || paramsStart > segmentEnd && paramsEnd > segmentEnd;
        return {
            count,
            start,
            loop: segment.loop,
            ilen: end < start && !outside ? count + end - start : end - start
        };
    }
     function pathSegment(ctx, line, segment, params) {
        const { points , options  } = line;
        const { count , start , loop , ilen  } = pathVars(points, segment, params);
        const lineMethod = getLineMethod(options);
        let { move =true , reverse  } = params || {};
        let i, point, prev;
        for(i = 0; i <= ilen; ++i){
            point = points[(start + (reverse ? ilen - i : i)) % count];
            if (point.skip) {
                continue;
            } else if (move) {
                ctx.moveTo(point.x, point.y);
                move = false;
            } else {
                lineMethod(ctx, prev, point, reverse, options.stepped);
            }
            prev = point;
        }
        if (loop) {
            point = points[(start + (reverse ? ilen : 0)) % count];
            lineMethod(ctx, prev, point, reverse, options.stepped);
        }
        return !!loop;
    }
     function fastPathSegment(ctx, line, segment, params) {
        const points = line.points;
        const { count , start , ilen  } = pathVars(points, segment, params);
        const { move =true , reverse  } = params || {};
        let avgX = 0;
        let countX = 0;
        let i, point, prevX, minY, maxY, lastY;
        const pointIndex = (index)=>(start + (reverse ? ilen - index : index)) % count;
        const drawX = ()=>{
            if (minY !== maxY) {
                ctx.lineTo(avgX, maxY);
                ctx.lineTo(avgX, minY);
                ctx.lineTo(avgX, lastY);
            }
        };
        if (move) {
            point = points[pointIndex(0)];
            ctx.moveTo(point.x, point.y);
        }
        for(i = 0; i <= ilen; ++i){
            point = points[pointIndex(i)];
            if (point.skip) {
                continue;
            }
            const x = point.x;
            const y = point.y;
            const truncX = x | 0;
            if (truncX === prevX) {
                if (y < minY) {
                    minY = y;
                } else if (y > maxY) {
                    maxY = y;
                }
                avgX = (countX * avgX + x) / ++countX;
            } else {
                drawX();
                ctx.lineTo(x, y);
                prevX = truncX;
                countX = 0;
                minY = maxY = y;
            }
            lastY = y;
        }
        drawX();
    }
     function _getSegmentMethod(line) {
        const opts = line.options;
        const borderDash = opts.borderDash && opts.borderDash.length;
        const useFastPath = !line._decimated && !line._loop && !opts.tension && opts.cubicInterpolationMode !== 'monotone' && !opts.stepped && !borderDash;
        return useFastPath ? fastPathSegment : pathSegment;
    }
     function _getInterpolationMethod(options) {
        if (options.stepped) {
            return _steppedInterpolation;
        }
        if (options.tension || options.cubicInterpolationMode === 'monotone') {
            return _bezierInterpolation;
        }
        return _pointInLine;
    }
    function strokePathWithCache(ctx, line, start, count) {
        let path = line._path;
        if (!path) {
            path = line._path = new Path2D();
            if (line.path(path, start, count)) {
                path.closePath();
            }
        }
        setStyle(ctx, line.options);
        ctx.stroke(path);
    }
    function strokePathDirect(ctx, line, start, count) {
        const { segments , options  } = line;
        const segmentMethod = _getSegmentMethod(line);
        for (const segment of segments){
            setStyle(ctx, options, segment.style);
            ctx.beginPath();
            if (segmentMethod(ctx, line, segment, {
                start,
                end: start + count - 1
            })) {
                ctx.closePath();
            }
            ctx.stroke();
        }
    }
    const usePath2D = typeof Path2D === 'function';
    function draw(ctx, line, start, count) {
        if (usePath2D && !line.options.segment) {
            strokePathWithCache(ctx, line, start, count);
        } else {
            strokePathDirect(ctx, line, start, count);
        }
    }
    class LineElement extends Element$1 {
        static id = 'line';
     static defaults = {
            borderCapStyle: 'butt',
            borderDash: [],
            borderDashOffset: 0,
            borderJoinStyle: 'miter',
            borderWidth: 3,
            capBezierPoints: true,
            cubicInterpolationMode: 'default',
            fill: false,
            spanGaps: false,
            stepped: false,
            tension: 0
        };
     static defaultRoutes = {
            backgroundColor: 'backgroundColor',
            borderColor: 'borderColor'
        };
        static descriptors = {
            _scriptable: true,
            _indexable: (name)=>name !== 'borderDash' && name !== 'fill'
        };
        constructor(cfg){
            super();
            this.animated = true;
            this.options = undefined;
            this._chart = undefined;
            this._loop = undefined;
            this._fullLoop = undefined;
            this._path = undefined;
            this._points = undefined;
            this._segments = undefined;
            this._decimated = false;
            this._pointsUpdated = false;
            this._datasetIndex = undefined;
            if (cfg) {
                Object.assign(this, cfg);
            }
        }
        updateControlPoints(chartArea, indexAxis) {
            const options = this.options;
            if ((options.tension || options.cubicInterpolationMode === 'monotone') && !options.stepped && !this._pointsUpdated) {
                const loop = options.spanGaps ? this._loop : this._fullLoop;
                _updateBezierControlPoints(this._points, options, chartArea, loop, indexAxis);
                this._pointsUpdated = true;
            }
        }
        set points(points) {
            this._points = points;
            delete this._segments;
            delete this._path;
            this._pointsUpdated = false;
        }
        get points() {
            return this._points;
        }
        get segments() {
            return this._segments || (this._segments = _computeSegments(this, this.options.segment));
        }
     first() {
            const segments = this.segments;
            const points = this.points;
            return segments.length && points[segments[0].start];
        }
     last() {
            const segments = this.segments;
            const points = this.points;
            const count = segments.length;
            return count && points[segments[count - 1].end];
        }
     interpolate(point, property) {
            const options = this.options;
            const value = point[property];
            const points = this.points;
            const segments = _boundSegments(this, {
                property,
                start: value,
                end: value
            });
            if (!segments.length) {
                return;
            }
            const result = [];
            const _interpolate = _getInterpolationMethod(options);
            let i, ilen;
            for(i = 0, ilen = segments.length; i < ilen; ++i){
                const { start , end  } = segments[i];
                const p1 = points[start];
                const p2 = points[end];
                if (p1 === p2) {
                    result.push(p1);
                    continue;
                }
                const t = Math.abs((value - p1[property]) / (p2[property] - p1[property]));
                const interpolated = _interpolate(p1, p2, t, options.stepped);
                interpolated[property] = point[property];
                result.push(interpolated);
            }
            return result.length === 1 ? result[0] : result;
        }
     pathSegment(ctx, segment, params) {
            const segmentMethod = _getSegmentMethod(this);
            return segmentMethod(ctx, this, segment, params);
        }
     path(ctx, start, count) {
            const segments = this.segments;
            const segmentMethod = _getSegmentMethod(this);
            let loop = this._loop;
            start = start || 0;
            count = count || this.points.length - start;
            for (const segment of segments){
                loop &= segmentMethod(ctx, this, segment, {
                    start,
                    end: start + count - 1
                });
            }
            return !!loop;
        }
     draw(ctx, chartArea, start, count) {
            const options = this.options || {};
            const points = this.points || [];
            if (points.length && options.borderWidth) {
                ctx.save();
                draw(ctx, this, start, count);
                ctx.restore();
            }
            if (this.animated) {
                this._pointsUpdated = false;
                this._path = undefined;
            }
        }
    }

    function inRange$1(el, pos, axis, useFinalPosition) {
        const options = el.options;
        const { [axis]: value  } = el.getProps([
            axis
        ], useFinalPosition);
        return Math.abs(pos - value) < options.radius + options.hitRadius;
    }
    class PointElement extends Element$1 {
        static id = 'point';
        /**
       * @type {any}
       */ static defaults = {
            borderWidth: 1,
            hitRadius: 1,
            hoverBorderWidth: 1,
            hoverRadius: 4,
            pointStyle: 'circle',
            radius: 3,
            rotation: 0
        };
        /**
       * @type {any}
       */ static defaultRoutes = {
            backgroundColor: 'backgroundColor',
            borderColor: 'borderColor'
        };
        constructor(cfg){
            super();
            this.options = undefined;
            this.parsed = undefined;
            this.skip = undefined;
            this.stop = undefined;
            if (cfg) {
                Object.assign(this, cfg);
            }
        }
        inRange(mouseX, mouseY, useFinalPosition) {
            const options = this.options;
            const { x , y  } = this.getProps([
                'x',
                'y'
            ], useFinalPosition);
            return Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2) < Math.pow(options.hitRadius + options.radius, 2);
        }
        inXRange(mouseX, useFinalPosition) {
            return inRange$1(this, mouseX, 'x', useFinalPosition);
        }
        inYRange(mouseY, useFinalPosition) {
            return inRange$1(this, mouseY, 'y', useFinalPosition);
        }
        getCenterPoint(useFinalPosition) {
            const { x , y  } = this.getProps([
                'x',
                'y'
            ], useFinalPosition);
            return {
                x,
                y
            };
        }
        size(options) {
            options = options || this.options || {};
            let radius = options.radius || 0;
            radius = Math.max(radius, radius && options.hoverRadius || 0);
            const borderWidth = radius && options.borderWidth || 0;
            return (radius + borderWidth) * 2;
        }
        draw(ctx, area) {
            const options = this.options;
            if (this.skip || options.radius < 0.1 || !_isPointInArea(this, area, this.size(options) / 2)) {
                return;
            }
            ctx.strokeStyle = options.borderColor;
            ctx.lineWidth = options.borderWidth;
            ctx.fillStyle = options.backgroundColor;
            drawPoint(ctx, options, this.x, this.y);
        }
        getRange() {
            const options = this.options || {};
            // @ts-expect-error Fallbacks should never be hit in practice
            return options.radius + options.hitRadius;
        }
    }

    function getBarBounds(bar, useFinalPosition) {
        const { x , y , base , width , height  } =  bar.getProps([
            'x',
            'y',
            'base',
            'width',
            'height'
        ], useFinalPosition);
        let left, right, top, bottom, half;
        if (bar.horizontal) {
            half = height / 2;
            left = Math.min(x, base);
            right = Math.max(x, base);
            top = y - half;
            bottom = y + half;
        } else {
            half = width / 2;
            left = x - half;
            right = x + half;
            top = Math.min(y, base);
            bottom = Math.max(y, base);
        }
        return {
            left,
            top,
            right,
            bottom
        };
    }
    function skipOrLimit(skip, value, min, max) {
        return skip ? 0 : _limitValue(value, min, max);
    }
    function parseBorderWidth(bar, maxW, maxH) {
        const value = bar.options.borderWidth;
        const skip = bar.borderSkipped;
        const o = toTRBL(value);
        return {
            t: skipOrLimit(skip.top, o.top, 0, maxH),
            r: skipOrLimit(skip.right, o.right, 0, maxW),
            b: skipOrLimit(skip.bottom, o.bottom, 0, maxH),
            l: skipOrLimit(skip.left, o.left, 0, maxW)
        };
    }
    function parseBorderRadius(bar, maxW, maxH) {
        const { enableBorderRadius  } = bar.getProps([
            'enableBorderRadius'
        ]);
        const value = bar.options.borderRadius;
        const o = toTRBLCorners(value);
        const maxR = Math.min(maxW, maxH);
        const skip = bar.borderSkipped;
        const enableBorder = enableBorderRadius || isObject(value);
        return {
            topLeft: skipOrLimit(!enableBorder || skip.top || skip.left, o.topLeft, 0, maxR),
            topRight: skipOrLimit(!enableBorder || skip.top || skip.right, o.topRight, 0, maxR),
            bottomLeft: skipOrLimit(!enableBorder || skip.bottom || skip.left, o.bottomLeft, 0, maxR),
            bottomRight: skipOrLimit(!enableBorder || skip.bottom || skip.right, o.bottomRight, 0, maxR)
        };
    }
    function boundingRects(bar) {
        const bounds = getBarBounds(bar);
        const width = bounds.right - bounds.left;
        const height = bounds.bottom - bounds.top;
        const border = parseBorderWidth(bar, width / 2, height / 2);
        const radius = parseBorderRadius(bar, width / 2, height / 2);
        return {
            outer: {
                x: bounds.left,
                y: bounds.top,
                w: width,
                h: height,
                radius
            },
            inner: {
                x: bounds.left + border.l,
                y: bounds.top + border.t,
                w: width - border.l - border.r,
                h: height - border.t - border.b,
                radius: {
                    topLeft: Math.max(0, radius.topLeft - Math.max(border.t, border.l)),
                    topRight: Math.max(0, radius.topRight - Math.max(border.t, border.r)),
                    bottomLeft: Math.max(0, radius.bottomLeft - Math.max(border.b, border.l)),
                    bottomRight: Math.max(0, radius.bottomRight - Math.max(border.b, border.r))
                }
            }
        };
    }
    function inRange(bar, x, y, useFinalPosition) {
        const skipX = x === null;
        const skipY = y === null;
        const skipBoth = skipX && skipY;
        const bounds = bar && !skipBoth && getBarBounds(bar, useFinalPosition);
        return bounds && (skipX || _isBetween(x, bounds.left, bounds.right)) && (skipY || _isBetween(y, bounds.top, bounds.bottom));
    }
    function hasRadius(radius) {
        return radius.topLeft || radius.topRight || radius.bottomLeft || radius.bottomRight;
    }
     function addNormalRectPath(ctx, rect) {
        ctx.rect(rect.x, rect.y, rect.w, rect.h);
    }
    function inflateRect(rect, amount, refRect = {}) {
        const x = rect.x !== refRect.x ? -amount : 0;
        const y = rect.y !== refRect.y ? -amount : 0;
        const w = (rect.x + rect.w !== refRect.x + refRect.w ? amount : 0) - x;
        const h = (rect.y + rect.h !== refRect.y + refRect.h ? amount : 0) - y;
        return {
            x: rect.x + x,
            y: rect.y + y,
            w: rect.w + w,
            h: rect.h + h,
            radius: rect.radius
        };
    }
    class BarElement extends Element$1 {
        static id = 'bar';
     static defaults = {
            borderSkipped: 'start',
            borderWidth: 0,
            borderRadius: 0,
            inflateAmount: 'auto',
            pointStyle: undefined
        };
     static defaultRoutes = {
            backgroundColor: 'backgroundColor',
            borderColor: 'borderColor'
        };
        constructor(cfg){
            super();
            this.options = undefined;
            this.horizontal = undefined;
            this.base = undefined;
            this.width = undefined;
            this.height = undefined;
            this.inflateAmount = undefined;
            if (cfg) {
                Object.assign(this, cfg);
            }
        }
        draw(ctx) {
            const { inflateAmount , options: { borderColor , backgroundColor  }  } = this;
            const { inner , outer  } = boundingRects(this);
            const addRectPath = hasRadius(outer.radius) ? addRoundedRectPath : addNormalRectPath;
            ctx.save();
            if (outer.w !== inner.w || outer.h !== inner.h) {
                ctx.beginPath();
                addRectPath(ctx, inflateRect(outer, inflateAmount, inner));
                ctx.clip();
                addRectPath(ctx, inflateRect(inner, -inflateAmount, outer));
                ctx.fillStyle = borderColor;
                ctx.fill('evenodd');
            }
            ctx.beginPath();
            addRectPath(ctx, inflateRect(inner, inflateAmount));
            ctx.fillStyle = backgroundColor;
            ctx.fill();
            ctx.restore();
        }
        inRange(mouseX, mouseY, useFinalPosition) {
            return inRange(this, mouseX, mouseY, useFinalPosition);
        }
        inXRange(mouseX, useFinalPosition) {
            return inRange(this, mouseX, null, useFinalPosition);
        }
        inYRange(mouseY, useFinalPosition) {
            return inRange(this, null, mouseY, useFinalPosition);
        }
        getCenterPoint(useFinalPosition) {
            const { x , y , base , horizontal  } =  this.getProps([
                'x',
                'y',
                'base',
                'horizontal'
            ], useFinalPosition);
            return {
                x: horizontal ? (x + base) / 2 : x,
                y: horizontal ? y : (y + base) / 2
            };
        }
        getRange(axis) {
            return axis === 'x' ? this.width / 2 : this.height / 2;
        }
    }

    const BORDER_COLORS = [
        'rgb(54, 162, 235)',
        'rgb(255, 99, 132)',
        'rgb(255, 159, 64)',
        'rgb(255, 205, 86)',
        'rgb(75, 192, 192)',
        'rgb(153, 102, 255)',
        'rgb(201, 203, 207)' // grey
    ];
    // Border colors with 50% transparency
    const BACKGROUND_COLORS = /* #__PURE__ */ BORDER_COLORS.map((color)=>color.replace('rgb(', 'rgba(').replace(')', ', 0.5)'));
    function getBorderColor(i) {
        return BORDER_COLORS[i % BORDER_COLORS.length];
    }
    function getBackgroundColor(i) {
        return BACKGROUND_COLORS[i % BACKGROUND_COLORS.length];
    }
    function createDefaultDatasetColorizer() {
        return (dataset, i)=>{
            dataset.borderColor = getBorderColor(i);
            dataset.backgroundColor = getBackgroundColor(i);
        };
    }
    function createDoughnutDatasetColorizer() {
        let i = 0;
        return (dataset)=>{
            dataset.backgroundColor = dataset.data.map(()=>getBorderColor(i++));
        };
    }
    function createPolarAreaDatasetColorizer() {
        let i = 0;
        return (dataset)=>{
            dataset.backgroundColor = dataset.data.map(()=>getBackgroundColor(i++));
        };
    }
    function getColorizer(type) {
        if (type === 'doughnut' || type === 'pie') {
            return createDoughnutDatasetColorizer();
        } else if (type === 'polarArea') {
            return createPolarAreaDatasetColorizer();
        }
        return createDefaultDatasetColorizer();
    }
    function containsColorsDefinitions(descriptors) {
        let k;
        for(k in descriptors){
            if (descriptors[k].borderColor || descriptors[k].backgroundColor) {
                return true;
            }
        }
        return false;
    }
    var plugin_colors = {
        id: 'colors',
        defaults: {
            enabled: true
        },
        beforeLayout (chart, _args, options) {
            if (!options.enabled) {
                return;
            }
            const { type , options: { elements  } , data: { datasets  }  } = chart.config;
            if (containsColorsDefinitions(datasets) || elements && containsColorsDefinitions(elements)) {
                return;
            }
            const colorizer = getColorizer(type);
            datasets.forEach(colorizer);
        }
    };

    const getBoxSize = (labelOpts, fontSize)=>{
        let { boxHeight =fontSize , boxWidth =fontSize  } = labelOpts;
        if (labelOpts.usePointStyle) {
            boxHeight = Math.min(boxHeight, fontSize);
            boxWidth = labelOpts.pointStyleWidth || Math.min(boxWidth, fontSize);
        }
        return {
            boxWidth,
            boxHeight,
            itemHeight: Math.max(fontSize, boxHeight)
        };
    };
    const itemsEqual = (a, b)=>a !== null && b !== null && a.datasetIndex === b.datasetIndex && a.index === b.index;
    class Legend extends Element$1 {
     constructor(config){
            super();
            this._added = false;
            this.legendHitBoxes = [];
     this._hoveredItem = null;
            this.doughnutMode = false;
            this.chart = config.chart;
            this.options = config.options;
            this.ctx = config.ctx;
            this.legendItems = undefined;
            this.columnSizes = undefined;
            this.lineWidths = undefined;
            this.maxHeight = undefined;
            this.maxWidth = undefined;
            this.top = undefined;
            this.bottom = undefined;
            this.left = undefined;
            this.right = undefined;
            this.height = undefined;
            this.width = undefined;
            this._margins = undefined;
            this.position = undefined;
            this.weight = undefined;
            this.fullSize = undefined;
        }
        update(maxWidth, maxHeight, margins) {
            this.maxWidth = maxWidth;
            this.maxHeight = maxHeight;
            this._margins = margins;
            this.setDimensions();
            this.buildLabels();
            this.fit();
        }
        setDimensions() {
            if (this.isHorizontal()) {
                this.width = this.maxWidth;
                this.left = this._margins.left;
                this.right = this.width;
            } else {
                this.height = this.maxHeight;
                this.top = this._margins.top;
                this.bottom = this.height;
            }
        }
        buildLabels() {
            const labelOpts = this.options.labels || {};
            let legendItems = callback(labelOpts.generateLabels, [
                this.chart
            ], this) || [];
            if (labelOpts.filter) {
                legendItems = legendItems.filter((item)=>labelOpts.filter(item, this.chart.data));
            }
            if (labelOpts.sort) {
                legendItems = legendItems.sort((a, b)=>labelOpts.sort(a, b, this.chart.data));
            }
            if (this.options.reverse) {
                legendItems.reverse();
            }
            this.legendItems = legendItems;
        }
        fit() {
            const { options , ctx  } = this;
            if (!options.display) {
                this.width = this.height = 0;
                return;
            }
            const labelOpts = options.labels;
            const labelFont = toFont(labelOpts.font);
            const fontSize = labelFont.size;
            const titleHeight = this._computeTitleHeight();
            const { boxWidth , itemHeight  } = getBoxSize(labelOpts, fontSize);
            let width, height;
            ctx.font = labelFont.string;
            if (this.isHorizontal()) {
                width = this.maxWidth;
                height = this._fitRows(titleHeight, fontSize, boxWidth, itemHeight) + 10;
            } else {
                height = this.maxHeight;
                width = this._fitCols(titleHeight, labelFont, boxWidth, itemHeight) + 10;
            }
            this.width = Math.min(width, options.maxWidth || this.maxWidth);
            this.height = Math.min(height, options.maxHeight || this.maxHeight);
        }
     _fitRows(titleHeight, fontSize, boxWidth, itemHeight) {
            const { ctx , maxWidth , options: { labels: { padding  }  }  } = this;
            const hitboxes = this.legendHitBoxes = [];
            const lineWidths = this.lineWidths = [
                0
            ];
            const lineHeight = itemHeight + padding;
            let totalHeight = titleHeight;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            let row = -1;
            let top = -lineHeight;
            this.legendItems.forEach((legendItem, i)=>{
                const itemWidth = boxWidth + fontSize / 2 + ctx.measureText(legendItem.text).width;
                if (i === 0 || lineWidths[lineWidths.length - 1] + itemWidth + 2 * padding > maxWidth) {
                    totalHeight += lineHeight;
                    lineWidths[lineWidths.length - (i > 0 ? 0 : 1)] = 0;
                    top += lineHeight;
                    row++;
                }
                hitboxes[i] = {
                    left: 0,
                    top,
                    row,
                    width: itemWidth,
                    height: itemHeight
                };
                lineWidths[lineWidths.length - 1] += itemWidth + padding;
            });
            return totalHeight;
        }
        _fitCols(titleHeight, labelFont, boxWidth, _itemHeight) {
            const { ctx , maxHeight , options: { labels: { padding  }  }  } = this;
            const hitboxes = this.legendHitBoxes = [];
            const columnSizes = this.columnSizes = [];
            const heightLimit = maxHeight - titleHeight;
            let totalWidth = padding;
            let currentColWidth = 0;
            let currentColHeight = 0;
            let left = 0;
            let col = 0;
            this.legendItems.forEach((legendItem, i)=>{
                const { itemWidth , itemHeight  } = calculateItemSize(boxWidth, labelFont, ctx, legendItem, _itemHeight);
                if (i > 0 && currentColHeight + itemHeight + 2 * padding > heightLimit) {
                    totalWidth += currentColWidth + padding;
                    columnSizes.push({
                        width: currentColWidth,
                        height: currentColHeight
                    });
                    left += currentColWidth + padding;
                    col++;
                    currentColWidth = currentColHeight = 0;
                }
                hitboxes[i] = {
                    left,
                    top: currentColHeight,
                    col,
                    width: itemWidth,
                    height: itemHeight
                };
                currentColWidth = Math.max(currentColWidth, itemWidth);
                currentColHeight += itemHeight + padding;
            });
            totalWidth += currentColWidth;
            columnSizes.push({
                width: currentColWidth,
                height: currentColHeight
            });
            return totalWidth;
        }
        adjustHitBoxes() {
            if (!this.options.display) {
                return;
            }
            const titleHeight = this._computeTitleHeight();
            const { legendHitBoxes: hitboxes , options: { align , labels: { padding  } , rtl  }  } = this;
            const rtlHelper = getRtlAdapter(rtl, this.left, this.width);
            if (this.isHorizontal()) {
                let row = 0;
                let left = _alignStartEnd(align, this.left + padding, this.right - this.lineWidths[row]);
                for (const hitbox of hitboxes){
                    if (row !== hitbox.row) {
                        row = hitbox.row;
                        left = _alignStartEnd(align, this.left + padding, this.right - this.lineWidths[row]);
                    }
                    hitbox.top += this.top + titleHeight + padding;
                    hitbox.left = rtlHelper.leftForLtr(rtlHelper.x(left), hitbox.width);
                    left += hitbox.width + padding;
                }
            } else {
                let col = 0;
                let top = _alignStartEnd(align, this.top + titleHeight + padding, this.bottom - this.columnSizes[col].height);
                for (const hitbox1 of hitboxes){
                    if (hitbox1.col !== col) {
                        col = hitbox1.col;
                        top = _alignStartEnd(align, this.top + titleHeight + padding, this.bottom - this.columnSizes[col].height);
                    }
                    hitbox1.top = top;
                    hitbox1.left += this.left + padding;
                    hitbox1.left = rtlHelper.leftForLtr(rtlHelper.x(hitbox1.left), hitbox1.width);
                    top += hitbox1.height + padding;
                }
            }
        }
        isHorizontal() {
            return this.options.position === 'top' || this.options.position === 'bottom';
        }
        draw() {
            if (this.options.display) {
                const ctx = this.ctx;
                clipArea(ctx, this);
                this._draw();
                unclipArea(ctx);
            }
        }
     _draw() {
            const { options: opts , columnSizes , lineWidths , ctx  } = this;
            const { align , labels: labelOpts  } = opts;
            const defaultColor = defaults.color;
            const rtlHelper = getRtlAdapter(opts.rtl, this.left, this.width);
            const labelFont = toFont(labelOpts.font);
            const { padding  } = labelOpts;
            const fontSize = labelFont.size;
            const halfFontSize = fontSize / 2;
            let cursor;
            this.drawTitle();
            ctx.textAlign = rtlHelper.textAlign('left');
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 0.5;
            ctx.font = labelFont.string;
            const { boxWidth , boxHeight , itemHeight  } = getBoxSize(labelOpts, fontSize);
            const drawLegendBox = function(x, y, legendItem) {
                if (isNaN(boxWidth) || boxWidth <= 0 || isNaN(boxHeight) || boxHeight < 0) {
                    return;
                }
                ctx.save();
                const lineWidth = valueOrDefault(legendItem.lineWidth, 1);
                ctx.fillStyle = valueOrDefault(legendItem.fillStyle, defaultColor);
                ctx.lineCap = valueOrDefault(legendItem.lineCap, 'butt');
                ctx.lineDashOffset = valueOrDefault(legendItem.lineDashOffset, 0);
                ctx.lineJoin = valueOrDefault(legendItem.lineJoin, 'miter');
                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = valueOrDefault(legendItem.strokeStyle, defaultColor);
                ctx.setLineDash(valueOrDefault(legendItem.lineDash, []));
                if (labelOpts.usePointStyle) {
                    const drawOptions = {
                        radius: boxHeight * Math.SQRT2 / 2,
                        pointStyle: legendItem.pointStyle,
                        rotation: legendItem.rotation,
                        borderWidth: lineWidth
                    };
                    const centerX = rtlHelper.xPlus(x, boxWidth / 2);
                    const centerY = y + halfFontSize;
                    drawPointLegend(ctx, drawOptions, centerX, centerY, labelOpts.pointStyleWidth && boxWidth);
                } else {
                    const yBoxTop = y + Math.max((fontSize - boxHeight) / 2, 0);
                    const xBoxLeft = rtlHelper.leftForLtr(x, boxWidth);
                    const borderRadius = toTRBLCorners(legendItem.borderRadius);
                    ctx.beginPath();
                    if (Object.values(borderRadius).some((v)=>v !== 0)) {
                        addRoundedRectPath(ctx, {
                            x: xBoxLeft,
                            y: yBoxTop,
                            w: boxWidth,
                            h: boxHeight,
                            radius: borderRadius
                        });
                    } else {
                        ctx.rect(xBoxLeft, yBoxTop, boxWidth, boxHeight);
                    }
                    ctx.fill();
                    if (lineWidth !== 0) {
                        ctx.stroke();
                    }
                }
                ctx.restore();
            };
            const fillText = function(x, y, legendItem) {
                renderText(ctx, legendItem.text, x, y + itemHeight / 2, labelFont, {
                    strikethrough: legendItem.hidden,
                    textAlign: rtlHelper.textAlign(legendItem.textAlign)
                });
            };
            const isHorizontal = this.isHorizontal();
            const titleHeight = this._computeTitleHeight();
            if (isHorizontal) {
                cursor = {
                    x: _alignStartEnd(align, this.left + padding, this.right - lineWidths[0]),
                    y: this.top + padding + titleHeight,
                    line: 0
                };
            } else {
                cursor = {
                    x: this.left + padding,
                    y: _alignStartEnd(align, this.top + titleHeight + padding, this.bottom - columnSizes[0].height),
                    line: 0
                };
            }
            overrideTextDirection(this.ctx, opts.textDirection);
            const lineHeight = itemHeight + padding;
            this.legendItems.forEach((legendItem, i)=>{
                ctx.strokeStyle = legendItem.fontColor;
                ctx.fillStyle = legendItem.fontColor;
                const textWidth = ctx.measureText(legendItem.text).width;
                const textAlign = rtlHelper.textAlign(legendItem.textAlign || (legendItem.textAlign = labelOpts.textAlign));
                const width = boxWidth + halfFontSize + textWidth;
                let x = cursor.x;
                let y = cursor.y;
                rtlHelper.setWidth(this.width);
                if (isHorizontal) {
                    if (i > 0 && x + width + padding > this.right) {
                        y = cursor.y += lineHeight;
                        cursor.line++;
                        x = cursor.x = _alignStartEnd(align, this.left + padding, this.right - lineWidths[cursor.line]);
                    }
                } else if (i > 0 && y + lineHeight > this.bottom) {
                    x = cursor.x = x + columnSizes[cursor.line].width + padding;
                    cursor.line++;
                    y = cursor.y = _alignStartEnd(align, this.top + titleHeight + padding, this.bottom - columnSizes[cursor.line].height);
                }
                const realX = rtlHelper.x(x);
                drawLegendBox(realX, y, legendItem);
                x = _textX(textAlign, x + boxWidth + halfFontSize, isHorizontal ? x + width : this.right, opts.rtl);
                fillText(rtlHelper.x(x), y, legendItem);
                if (isHorizontal) {
                    cursor.x += width + padding;
                } else if (typeof legendItem.text !== 'string') {
                    const fontLineHeight = labelFont.lineHeight;
                    cursor.y += calculateLegendItemHeight(legendItem, fontLineHeight);
                } else {
                    cursor.y += lineHeight;
                }
            });
            restoreTextDirection(this.ctx, opts.textDirection);
        }
     drawTitle() {
            const opts = this.options;
            const titleOpts = opts.title;
            const titleFont = toFont(titleOpts.font);
            const titlePadding = toPadding(titleOpts.padding);
            if (!titleOpts.display) {
                return;
            }
            const rtlHelper = getRtlAdapter(opts.rtl, this.left, this.width);
            const ctx = this.ctx;
            const position = titleOpts.position;
            const halfFontSize = titleFont.size / 2;
            const topPaddingPlusHalfFontSize = titlePadding.top + halfFontSize;
            let y;
            let left = this.left;
            let maxWidth = this.width;
            if (this.isHorizontal()) {
                maxWidth = Math.max(...this.lineWidths);
                y = this.top + topPaddingPlusHalfFontSize;
                left = _alignStartEnd(opts.align, left, this.right - maxWidth);
            } else {
                const maxHeight = this.columnSizes.reduce((acc, size)=>Math.max(acc, size.height), 0);
                y = topPaddingPlusHalfFontSize + _alignStartEnd(opts.align, this.top, this.bottom - maxHeight - opts.labels.padding - this._computeTitleHeight());
            }
            const x = _alignStartEnd(position, left, left + maxWidth);
            ctx.textAlign = rtlHelper.textAlign(_toLeftRightCenter(position));
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = titleOpts.color;
            ctx.fillStyle = titleOpts.color;
            ctx.font = titleFont.string;
            renderText(ctx, titleOpts.text, x, y, titleFont);
        }
     _computeTitleHeight() {
            const titleOpts = this.options.title;
            const titleFont = toFont(titleOpts.font);
            const titlePadding = toPadding(titleOpts.padding);
            return titleOpts.display ? titleFont.lineHeight + titlePadding.height : 0;
        }
     _getLegendItemAt(x, y) {
            let i, hitBox, lh;
            if (_isBetween(x, this.left, this.right) && _isBetween(y, this.top, this.bottom)) {
                lh = this.legendHitBoxes;
                for(i = 0; i < lh.length; ++i){
                    hitBox = lh[i];
                    if (_isBetween(x, hitBox.left, hitBox.left + hitBox.width) && _isBetween(y, hitBox.top, hitBox.top + hitBox.height)) {
                        return this.legendItems[i];
                    }
                }
            }
            return null;
        }
     handleEvent(e) {
            const opts = this.options;
            if (!isListened(e.type, opts)) {
                return;
            }
            const hoveredItem = this._getLegendItemAt(e.x, e.y);
            if (e.type === 'mousemove' || e.type === 'mouseout') {
                const previous = this._hoveredItem;
                const sameItem = itemsEqual(previous, hoveredItem);
                if (previous && !sameItem) {
                    callback(opts.onLeave, [
                        e,
                        previous,
                        this
                    ], this);
                }
                this._hoveredItem = hoveredItem;
                if (hoveredItem && !sameItem) {
                    callback(opts.onHover, [
                        e,
                        hoveredItem,
                        this
                    ], this);
                }
            } else if (hoveredItem) {
                callback(opts.onClick, [
                    e,
                    hoveredItem,
                    this
                ], this);
            }
        }
    }
    function calculateItemSize(boxWidth, labelFont, ctx, legendItem, _itemHeight) {
        const itemWidth = calculateItemWidth(legendItem, boxWidth, labelFont, ctx);
        const itemHeight = calculateItemHeight(_itemHeight, legendItem, labelFont.lineHeight);
        return {
            itemWidth,
            itemHeight
        };
    }
    function calculateItemWidth(legendItem, boxWidth, labelFont, ctx) {
        let legendItemText = legendItem.text;
        if (legendItemText && typeof legendItemText !== 'string') {
            legendItemText = legendItemText.reduce((a, b)=>a.length > b.length ? a : b);
        }
        return boxWidth + labelFont.size / 2 + ctx.measureText(legendItemText).width;
    }
    function calculateItemHeight(_itemHeight, legendItem, fontLineHeight) {
        let itemHeight = _itemHeight;
        if (typeof legendItem.text !== 'string') {
            itemHeight = calculateLegendItemHeight(legendItem, fontLineHeight);
        }
        return itemHeight;
    }
    function calculateLegendItemHeight(legendItem, fontLineHeight) {
        const labelHeight = legendItem.text ? legendItem.text.length + 0.5 : 0;
        return fontLineHeight * labelHeight;
    }
    function isListened(type, opts) {
        if ((type === 'mousemove' || type === 'mouseout') && (opts.onHover || opts.onLeave)) {
            return true;
        }
        if (opts.onClick && (type === 'click' || type === 'mouseup')) {
            return true;
        }
        return false;
    }
    var plugin_legend = {
        id: 'legend',
     _element: Legend,
        start (chart, _args, options) {
            const legend = chart.legend = new Legend({
                ctx: chart.ctx,
                options,
                chart
            });
            layouts.configure(chart, legend, options);
            layouts.addBox(chart, legend);
        },
        stop (chart) {
            layouts.removeBox(chart, chart.legend);
            delete chart.legend;
        },
        beforeUpdate (chart, _args, options) {
            const legend = chart.legend;
            layouts.configure(chart, legend, options);
            legend.options = options;
        },
        afterUpdate (chart) {
            const legend = chart.legend;
            legend.buildLabels();
            legend.adjustHitBoxes();
        },
        afterEvent (chart, args) {
            if (!args.replay) {
                chart.legend.handleEvent(args.event);
            }
        },
        defaults: {
            display: true,
            position: 'top',
            align: 'center',
            fullSize: true,
            reverse: false,
            weight: 1000,
            onClick (e, legendItem, legend) {
                const index = legendItem.datasetIndex;
                const ci = legend.chart;
                if (ci.isDatasetVisible(index)) {
                    ci.hide(index);
                    legendItem.hidden = true;
                } else {
                    ci.show(index);
                    legendItem.hidden = false;
                }
            },
            onHover: null,
            onLeave: null,
            labels: {
                color: (ctx)=>ctx.chart.options.color,
                boxWidth: 40,
                padding: 10,
                generateLabels (chart) {
                    const datasets = chart.data.datasets;
                    const { labels: { usePointStyle , pointStyle , textAlign , color , useBorderRadius , borderRadius  }  } = chart.legend.options;
                    return chart._getSortedDatasetMetas().map((meta)=>{
                        const style = meta.controller.getStyle(usePointStyle ? 0 : undefined);
                        const borderWidth = toPadding(style.borderWidth);
                        return {
                            text: datasets[meta.index].label,
                            fillStyle: style.backgroundColor,
                            fontColor: color,
                            hidden: !meta.visible,
                            lineCap: style.borderCapStyle,
                            lineDash: style.borderDash,
                            lineDashOffset: style.borderDashOffset,
                            lineJoin: style.borderJoinStyle,
                            lineWidth: (borderWidth.width + borderWidth.height) / 4,
                            strokeStyle: style.borderColor,
                            pointStyle: pointStyle || style.pointStyle,
                            rotation: style.rotation,
                            textAlign: textAlign || style.textAlign,
                            borderRadius: useBorderRadius && (borderRadius || style.borderRadius),
                            datasetIndex: meta.index
                        };
                    }, this);
                }
            },
            title: {
                color: (ctx)=>ctx.chart.options.color,
                display: false,
                position: 'center',
                text: ''
            }
        },
        descriptors: {
            _scriptable: (name)=>!name.startsWith('on'),
            labels: {
                _scriptable: (name)=>![
                        'generateLabels',
                        'filter',
                        'sort'
                    ].includes(name)
            }
        }
    };

    class Title extends Element$1 {
     constructor(config){
            super();
            this.chart = config.chart;
            this.options = config.options;
            this.ctx = config.ctx;
            this._padding = undefined;
            this.top = undefined;
            this.bottom = undefined;
            this.left = undefined;
            this.right = undefined;
            this.width = undefined;
            this.height = undefined;
            this.position = undefined;
            this.weight = undefined;
            this.fullSize = undefined;
        }
        update(maxWidth, maxHeight) {
            const opts = this.options;
            this.left = 0;
            this.top = 0;
            if (!opts.display) {
                this.width = this.height = this.right = this.bottom = 0;
                return;
            }
            this.width = this.right = maxWidth;
            this.height = this.bottom = maxHeight;
            const lineCount = isArray(opts.text) ? opts.text.length : 1;
            this._padding = toPadding(opts.padding);
            const textSize = lineCount * toFont(opts.font).lineHeight + this._padding.height;
            if (this.isHorizontal()) {
                this.height = textSize;
            } else {
                this.width = textSize;
            }
        }
        isHorizontal() {
            const pos = this.options.position;
            return pos === 'top' || pos === 'bottom';
        }
        _drawArgs(offset) {
            const { top , left , bottom , right , options  } = this;
            const align = options.align;
            let rotation = 0;
            let maxWidth, titleX, titleY;
            if (this.isHorizontal()) {
                titleX = _alignStartEnd(align, left, right);
                titleY = top + offset;
                maxWidth = right - left;
            } else {
                if (options.position === 'left') {
                    titleX = left + offset;
                    titleY = _alignStartEnd(align, bottom, top);
                    rotation = PI * -0.5;
                } else {
                    titleX = right - offset;
                    titleY = _alignStartEnd(align, top, bottom);
                    rotation = PI * 0.5;
                }
                maxWidth = bottom - top;
            }
            return {
                titleX,
                titleY,
                maxWidth,
                rotation
            };
        }
        draw() {
            const ctx = this.ctx;
            const opts = this.options;
            if (!opts.display) {
                return;
            }
            const fontOpts = toFont(opts.font);
            const lineHeight = fontOpts.lineHeight;
            const offset = lineHeight / 2 + this._padding.top;
            const { titleX , titleY , maxWidth , rotation  } = this._drawArgs(offset);
            renderText(ctx, opts.text, 0, 0, fontOpts, {
                color: opts.color,
                maxWidth,
                rotation,
                textAlign: _toLeftRightCenter(opts.align),
                textBaseline: 'middle',
                translation: [
                    titleX,
                    titleY
                ]
            });
        }
    }
    function createTitle(chart, titleOpts) {
        const title = new Title({
            ctx: chart.ctx,
            options: titleOpts,
            chart
        });
        layouts.configure(chart, title, titleOpts);
        layouts.addBox(chart, title);
        chart.titleBlock = title;
    }
    var plugin_title = {
        id: 'title',
     _element: Title,
        start (chart, _args, options) {
            createTitle(chart, options);
        },
        stop (chart) {
            const titleBlock = chart.titleBlock;
            layouts.removeBox(chart, titleBlock);
            delete chart.titleBlock;
        },
        beforeUpdate (chart, _args, options) {
            const title = chart.titleBlock;
            layouts.configure(chart, title, options);
            title.options = options;
        },
        defaults: {
            align: 'center',
            display: false,
            font: {
                weight: 'bold'
            },
            fullSize: true,
            padding: 10,
            position: 'top',
            text: '',
            weight: 2000
        },
        defaultRoutes: {
            color: 'color'
        },
        descriptors: {
            _scriptable: true,
            _indexable: false
        }
    };

    const positioners = {
     average (items) {
            if (!items.length) {
                return false;
            }
            let i, len;
            let x = 0;
            let y = 0;
            let count = 0;
            for(i = 0, len = items.length; i < len; ++i){
                const el = items[i].element;
                if (el && el.hasValue()) {
                    const pos = el.tooltipPosition();
                    x += pos.x;
                    y += pos.y;
                    ++count;
                }
            }
            return {
                x: x / count,
                y: y / count
            };
        },
     nearest (items, eventPosition) {
            if (!items.length) {
                return false;
            }
            let x = eventPosition.x;
            let y = eventPosition.y;
            let minDistance = Number.POSITIVE_INFINITY;
            let i, len, nearestElement;
            for(i = 0, len = items.length; i < len; ++i){
                const el = items[i].element;
                if (el && el.hasValue()) {
                    const center = el.getCenterPoint();
                    const d = distanceBetweenPoints(eventPosition, center);
                    if (d < minDistance) {
                        minDistance = d;
                        nearestElement = el;
                    }
                }
            }
            if (nearestElement) {
                const tp = nearestElement.tooltipPosition();
                x = tp.x;
                y = tp.y;
            }
            return {
                x,
                y
            };
        }
    };
    function pushOrConcat(base, toPush) {
        if (toPush) {
            if (isArray(toPush)) {
                Array.prototype.push.apply(base, toPush);
            } else {
                base.push(toPush);
            }
        }
        return base;
    }
     function splitNewlines(str) {
        if ((typeof str === 'string' || str instanceof String) && str.indexOf('\n') > -1) {
            return str.split('\n');
        }
        return str;
    }
     function createTooltipItem(chart, item) {
        const { element , datasetIndex , index  } = item;
        const controller = chart.getDatasetMeta(datasetIndex).controller;
        const { label , value  } = controller.getLabelAndValue(index);
        return {
            chart,
            label,
            parsed: controller.getParsed(index),
            raw: chart.data.datasets[datasetIndex].data[index],
            formattedValue: value,
            dataset: controller.getDataset(),
            dataIndex: index,
            datasetIndex,
            element
        };
    }
     function getTooltipSize(tooltip, options) {
        const ctx = tooltip.chart.ctx;
        const { body , footer , title  } = tooltip;
        const { boxWidth , boxHeight  } = options;
        const bodyFont = toFont(options.bodyFont);
        const titleFont = toFont(options.titleFont);
        const footerFont = toFont(options.footerFont);
        const titleLineCount = title.length;
        const footerLineCount = footer.length;
        const bodyLineItemCount = body.length;
        const padding = toPadding(options.padding);
        let height = padding.height;
        let width = 0;
        let combinedBodyLength = body.reduce((count, bodyItem)=>count + bodyItem.before.length + bodyItem.lines.length + bodyItem.after.length, 0);
        combinedBodyLength += tooltip.beforeBody.length + tooltip.afterBody.length;
        if (titleLineCount) {
            height += titleLineCount * titleFont.lineHeight + (titleLineCount - 1) * options.titleSpacing + options.titleMarginBottom;
        }
        if (combinedBodyLength) {
            const bodyLineHeight = options.displayColors ? Math.max(boxHeight, bodyFont.lineHeight) : bodyFont.lineHeight;
            height += bodyLineItemCount * bodyLineHeight + (combinedBodyLength - bodyLineItemCount) * bodyFont.lineHeight + (combinedBodyLength - 1) * options.bodySpacing;
        }
        if (footerLineCount) {
            height += options.footerMarginTop + footerLineCount * footerFont.lineHeight + (footerLineCount - 1) * options.footerSpacing;
        }
        let widthPadding = 0;
        const maxLineWidth = function(line) {
            width = Math.max(width, ctx.measureText(line).width + widthPadding);
        };
        ctx.save();
        ctx.font = titleFont.string;
        each(tooltip.title, maxLineWidth);
        ctx.font = bodyFont.string;
        each(tooltip.beforeBody.concat(tooltip.afterBody), maxLineWidth);
        widthPadding = options.displayColors ? boxWidth + 2 + options.boxPadding : 0;
        each(body, (bodyItem)=>{
            each(bodyItem.before, maxLineWidth);
            each(bodyItem.lines, maxLineWidth);
            each(bodyItem.after, maxLineWidth);
        });
        widthPadding = 0;
        ctx.font = footerFont.string;
        each(tooltip.footer, maxLineWidth);
        ctx.restore();
        width += padding.width;
        return {
            width,
            height
        };
    }
    function determineYAlign(chart, size) {
        const { y , height  } = size;
        if (y < height / 2) {
            return 'top';
        } else if (y > chart.height - height / 2) {
            return 'bottom';
        }
        return 'center';
    }
    function doesNotFitWithAlign(xAlign, chart, options, size) {
        const { x , width  } = size;
        const caret = options.caretSize + options.caretPadding;
        if (xAlign === 'left' && x + width + caret > chart.width) {
            return true;
        }
        if (xAlign === 'right' && x - width - caret < 0) {
            return true;
        }
    }
    function determineXAlign(chart, options, size, yAlign) {
        const { x , width  } = size;
        const { width: chartWidth , chartArea: { left , right  }  } = chart;
        let xAlign = 'center';
        if (yAlign === 'center') {
            xAlign = x <= (left + right) / 2 ? 'left' : 'right';
        } else if (x <= width / 2) {
            xAlign = 'left';
        } else if (x >= chartWidth - width / 2) {
            xAlign = 'right';
        }
        if (doesNotFitWithAlign(xAlign, chart, options, size)) {
            xAlign = 'center';
        }
        return xAlign;
    }
     function determineAlignment(chart, options, size) {
        const yAlign = size.yAlign || options.yAlign || determineYAlign(chart, size);
        return {
            xAlign: size.xAlign || options.xAlign || determineXAlign(chart, options, size, yAlign),
            yAlign
        };
    }
    function alignX(size, xAlign) {
        let { x , width  } = size;
        if (xAlign === 'right') {
            x -= width;
        } else if (xAlign === 'center') {
            x -= width / 2;
        }
        return x;
    }
    function alignY(size, yAlign, paddingAndSize) {
        let { y , height  } = size;
        if (yAlign === 'top') {
            y += paddingAndSize;
        } else if (yAlign === 'bottom') {
            y -= height + paddingAndSize;
        } else {
            y -= height / 2;
        }
        return y;
    }
     function getBackgroundPoint(options, size, alignment, chart) {
        const { caretSize , caretPadding , cornerRadius  } = options;
        const { xAlign , yAlign  } = alignment;
        const paddingAndSize = caretSize + caretPadding;
        const { topLeft , topRight , bottomLeft , bottomRight  } = toTRBLCorners(cornerRadius);
        let x = alignX(size, xAlign);
        const y = alignY(size, yAlign, paddingAndSize);
        if (yAlign === 'center') {
            if (xAlign === 'left') {
                x += paddingAndSize;
            } else if (xAlign === 'right') {
                x -= paddingAndSize;
            }
        } else if (xAlign === 'left') {
            x -= Math.max(topLeft, bottomLeft) + caretSize;
        } else if (xAlign === 'right') {
            x += Math.max(topRight, bottomRight) + caretSize;
        }
        return {
            x: _limitValue(x, 0, chart.width - size.width),
            y: _limitValue(y, 0, chart.height - size.height)
        };
    }
    function getAlignedX(tooltip, align, options) {
        const padding = toPadding(options.padding);
        return align === 'center' ? tooltip.x + tooltip.width / 2 : align === 'right' ? tooltip.x + tooltip.width - padding.right : tooltip.x + padding.left;
    }
     function getBeforeAfterBodyLines(callback) {
        return pushOrConcat([], splitNewlines(callback));
    }
    function createTooltipContext(parent, tooltip, tooltipItems) {
        return createContext(parent, {
            tooltip,
            tooltipItems,
            type: 'tooltip'
        });
    }
    function overrideCallbacks(callbacks, context) {
        const override = context && context.dataset && context.dataset.tooltip && context.dataset.tooltip.callbacks;
        return override ? callbacks.override(override) : callbacks;
    }
    const defaultCallbacks = {
        beforeTitle: noop,
        title (tooltipItems) {
            if (tooltipItems.length > 0) {
                const item = tooltipItems[0];
                const labels = item.chart.data.labels;
                const labelCount = labels ? labels.length : 0;
                if (this && this.options && this.options.mode === 'dataset') {
                    return item.dataset.label || '';
                } else if (item.label) {
                    return item.label;
                } else if (labelCount > 0 && item.dataIndex < labelCount) {
                    return labels[item.dataIndex];
                }
            }
            return '';
        },
        afterTitle: noop,
        beforeBody: noop,
        beforeLabel: noop,
        label (tooltipItem) {
            if (this && this.options && this.options.mode === 'dataset') {
                return tooltipItem.label + ': ' + tooltipItem.formattedValue || tooltipItem.formattedValue;
            }
            let label = tooltipItem.dataset.label || '';
            if (label) {
                label += ': ';
            }
            const value = tooltipItem.formattedValue;
            if (!isNullOrUndef(value)) {
                label += value;
            }
            return label;
        },
        labelColor (tooltipItem) {
            const meta = tooltipItem.chart.getDatasetMeta(tooltipItem.datasetIndex);
            const options = meta.controller.getStyle(tooltipItem.dataIndex);
            return {
                borderColor: options.borderColor,
                backgroundColor: options.backgroundColor,
                borderWidth: options.borderWidth,
                borderDash: options.borderDash,
                borderDashOffset: options.borderDashOffset,
                borderRadius: 0
            };
        },
        labelTextColor () {
            return this.options.bodyColor;
        },
        labelPointStyle (tooltipItem) {
            const meta = tooltipItem.chart.getDatasetMeta(tooltipItem.datasetIndex);
            const options = meta.controller.getStyle(tooltipItem.dataIndex);
            return {
                pointStyle: options.pointStyle,
                rotation: options.rotation
            };
        },
        afterLabel: noop,
        afterBody: noop,
        beforeFooter: noop,
        footer: noop,
        afterFooter: noop
    };
     function invokeCallbackWithFallback(callbacks, name, ctx, arg) {
        const result = callbacks[name].call(ctx, arg);
        if (typeof result === 'undefined') {
            return defaultCallbacks[name].call(ctx, arg);
        }
        return result;
    }
    class Tooltip extends Element$1 {
     static positioners = positioners;
        constructor(config){
            super();
            this.opacity = 0;
            this._active = [];
            this._eventPosition = undefined;
            this._size = undefined;
            this._cachedAnimations = undefined;
            this._tooltipItems = [];
            this.$animations = undefined;
            this.$context = undefined;
            this.chart = config.chart;
            this.options = config.options;
            this.dataPoints = undefined;
            this.title = undefined;
            this.beforeBody = undefined;
            this.body = undefined;
            this.afterBody = undefined;
            this.footer = undefined;
            this.xAlign = undefined;
            this.yAlign = undefined;
            this.x = undefined;
            this.y = undefined;
            this.height = undefined;
            this.width = undefined;
            this.caretX = undefined;
            this.caretY = undefined;
            this.labelColors = undefined;
            this.labelPointStyles = undefined;
            this.labelTextColors = undefined;
        }
        initialize(options) {
            this.options = options;
            this._cachedAnimations = undefined;
            this.$context = undefined;
        }
     _resolveAnimations() {
            const cached = this._cachedAnimations;
            if (cached) {
                return cached;
            }
            const chart = this.chart;
            const options = this.options.setContext(this.getContext());
            const opts = options.enabled && chart.options.animation && options.animations;
            const animations = new Animations(this.chart, opts);
            if (opts._cacheable) {
                this._cachedAnimations = Object.freeze(animations);
            }
            return animations;
        }
     getContext() {
            return this.$context || (this.$context = createTooltipContext(this.chart.getContext(), this, this._tooltipItems));
        }
        getTitle(context, options) {
            const { callbacks  } = options;
            const beforeTitle = invokeCallbackWithFallback(callbacks, 'beforeTitle', this, context);
            const title = invokeCallbackWithFallback(callbacks, 'title', this, context);
            const afterTitle = invokeCallbackWithFallback(callbacks, 'afterTitle', this, context);
            let lines = [];
            lines = pushOrConcat(lines, splitNewlines(beforeTitle));
            lines = pushOrConcat(lines, splitNewlines(title));
            lines = pushOrConcat(lines, splitNewlines(afterTitle));
            return lines;
        }
        getBeforeBody(tooltipItems, options) {
            return getBeforeAfterBodyLines(invokeCallbackWithFallback(options.callbacks, 'beforeBody', this, tooltipItems));
        }
        getBody(tooltipItems, options) {
            const { callbacks  } = options;
            const bodyItems = [];
            each(tooltipItems, (context)=>{
                const bodyItem = {
                    before: [],
                    lines: [],
                    after: []
                };
                const scoped = overrideCallbacks(callbacks, context);
                pushOrConcat(bodyItem.before, splitNewlines(invokeCallbackWithFallback(scoped, 'beforeLabel', this, context)));
                pushOrConcat(bodyItem.lines, invokeCallbackWithFallback(scoped, 'label', this, context));
                pushOrConcat(bodyItem.after, splitNewlines(invokeCallbackWithFallback(scoped, 'afterLabel', this, context)));
                bodyItems.push(bodyItem);
            });
            return bodyItems;
        }
        getAfterBody(tooltipItems, options) {
            return getBeforeAfterBodyLines(invokeCallbackWithFallback(options.callbacks, 'afterBody', this, tooltipItems));
        }
        getFooter(tooltipItems, options) {
            const { callbacks  } = options;
            const beforeFooter = invokeCallbackWithFallback(callbacks, 'beforeFooter', this, tooltipItems);
            const footer = invokeCallbackWithFallback(callbacks, 'footer', this, tooltipItems);
            const afterFooter = invokeCallbackWithFallback(callbacks, 'afterFooter', this, tooltipItems);
            let lines = [];
            lines = pushOrConcat(lines, splitNewlines(beforeFooter));
            lines = pushOrConcat(lines, splitNewlines(footer));
            lines = pushOrConcat(lines, splitNewlines(afterFooter));
            return lines;
        }
     _createItems(options) {
            const active = this._active;
            const data = this.chart.data;
            const labelColors = [];
            const labelPointStyles = [];
            const labelTextColors = [];
            let tooltipItems = [];
            let i, len;
            for(i = 0, len = active.length; i < len; ++i){
                tooltipItems.push(createTooltipItem(this.chart, active[i]));
            }
            if (options.filter) {
                tooltipItems = tooltipItems.filter((element, index, array)=>options.filter(element, index, array, data));
            }
            if (options.itemSort) {
                tooltipItems = tooltipItems.sort((a, b)=>options.itemSort(a, b, data));
            }
            each(tooltipItems, (context)=>{
                const scoped = overrideCallbacks(options.callbacks, context);
                labelColors.push(invokeCallbackWithFallback(scoped, 'labelColor', this, context));
                labelPointStyles.push(invokeCallbackWithFallback(scoped, 'labelPointStyle', this, context));
                labelTextColors.push(invokeCallbackWithFallback(scoped, 'labelTextColor', this, context));
            });
            this.labelColors = labelColors;
            this.labelPointStyles = labelPointStyles;
            this.labelTextColors = labelTextColors;
            this.dataPoints = tooltipItems;
            return tooltipItems;
        }
        update(changed, replay) {
            const options = this.options.setContext(this.getContext());
            const active = this._active;
            let properties;
            let tooltipItems = [];
            if (!active.length) {
                if (this.opacity !== 0) {
                    properties = {
                        opacity: 0
                    };
                }
            } else {
                const position = positioners[options.position].call(this, active, this._eventPosition);
                tooltipItems = this._createItems(options);
                this.title = this.getTitle(tooltipItems, options);
                this.beforeBody = this.getBeforeBody(tooltipItems, options);
                this.body = this.getBody(tooltipItems, options);
                this.afterBody = this.getAfterBody(tooltipItems, options);
                this.footer = this.getFooter(tooltipItems, options);
                const size = this._size = getTooltipSize(this, options);
                const positionAndSize = Object.assign({}, position, size);
                const alignment = determineAlignment(this.chart, options, positionAndSize);
                const backgroundPoint = getBackgroundPoint(options, positionAndSize, alignment, this.chart);
                this.xAlign = alignment.xAlign;
                this.yAlign = alignment.yAlign;
                properties = {
                    opacity: 1,
                    x: backgroundPoint.x,
                    y: backgroundPoint.y,
                    width: size.width,
                    height: size.height,
                    caretX: position.x,
                    caretY: position.y
                };
            }
            this._tooltipItems = tooltipItems;
            this.$context = undefined;
            if (properties) {
                this._resolveAnimations().update(this, properties);
            }
            if (changed && options.external) {
                options.external.call(this, {
                    chart: this.chart,
                    tooltip: this,
                    replay
                });
            }
        }
        drawCaret(tooltipPoint, ctx, size, options) {
            const caretPosition = this.getCaretPosition(tooltipPoint, size, options);
            ctx.lineTo(caretPosition.x1, caretPosition.y1);
            ctx.lineTo(caretPosition.x2, caretPosition.y2);
            ctx.lineTo(caretPosition.x3, caretPosition.y3);
        }
        getCaretPosition(tooltipPoint, size, options) {
            const { xAlign , yAlign  } = this;
            const { caretSize , cornerRadius  } = options;
            const { topLeft , topRight , bottomLeft , bottomRight  } = toTRBLCorners(cornerRadius);
            const { x: ptX , y: ptY  } = tooltipPoint;
            const { width , height  } = size;
            let x1, x2, x3, y1, y2, y3;
            if (yAlign === 'center') {
                y2 = ptY + height / 2;
                if (xAlign === 'left') {
                    x1 = ptX;
                    x2 = x1 - caretSize;
                    y1 = y2 + caretSize;
                    y3 = y2 - caretSize;
                } else {
                    x1 = ptX + width;
                    x2 = x1 + caretSize;
                    y1 = y2 - caretSize;
                    y3 = y2 + caretSize;
                }
                x3 = x1;
            } else {
                if (xAlign === 'left') {
                    x2 = ptX + Math.max(topLeft, bottomLeft) + caretSize;
                } else if (xAlign === 'right') {
                    x2 = ptX + width - Math.max(topRight, bottomRight) - caretSize;
                } else {
                    x2 = this.caretX;
                }
                if (yAlign === 'top') {
                    y1 = ptY;
                    y2 = y1 - caretSize;
                    x1 = x2 - caretSize;
                    x3 = x2 + caretSize;
                } else {
                    y1 = ptY + height;
                    y2 = y1 + caretSize;
                    x1 = x2 + caretSize;
                    x3 = x2 - caretSize;
                }
                y3 = y1;
            }
            return {
                x1,
                x2,
                x3,
                y1,
                y2,
                y3
            };
        }
        drawTitle(pt, ctx, options) {
            const title = this.title;
            const length = title.length;
            let titleFont, titleSpacing, i;
            if (length) {
                const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
                pt.x = getAlignedX(this, options.titleAlign, options);
                ctx.textAlign = rtlHelper.textAlign(options.titleAlign);
                ctx.textBaseline = 'middle';
                titleFont = toFont(options.titleFont);
                titleSpacing = options.titleSpacing;
                ctx.fillStyle = options.titleColor;
                ctx.font = titleFont.string;
                for(i = 0; i < length; ++i){
                    ctx.fillText(title[i], rtlHelper.x(pt.x), pt.y + titleFont.lineHeight / 2);
                    pt.y += titleFont.lineHeight + titleSpacing;
                    if (i + 1 === length) {
                        pt.y += options.titleMarginBottom - titleSpacing;
                    }
                }
            }
        }
     _drawColorBox(ctx, pt, i, rtlHelper, options) {
            const labelColors = this.labelColors[i];
            const labelPointStyle = this.labelPointStyles[i];
            const { boxHeight , boxWidth , boxPadding  } = options;
            const bodyFont = toFont(options.bodyFont);
            const colorX = getAlignedX(this, 'left', options);
            const rtlColorX = rtlHelper.x(colorX);
            const yOffSet = boxHeight < bodyFont.lineHeight ? (bodyFont.lineHeight - boxHeight) / 2 : 0;
            const colorY = pt.y + yOffSet;
            if (options.usePointStyle) {
                const drawOptions = {
                    radius: Math.min(boxWidth, boxHeight) / 2,
                    pointStyle: labelPointStyle.pointStyle,
                    rotation: labelPointStyle.rotation,
                    borderWidth: 1
                };
                const centerX = rtlHelper.leftForLtr(rtlColorX, boxWidth) + boxWidth / 2;
                const centerY = colorY + boxHeight / 2;
                ctx.strokeStyle = options.multiKeyBackground;
                ctx.fillStyle = options.multiKeyBackground;
                drawPoint(ctx, drawOptions, centerX, centerY);
                ctx.strokeStyle = labelColors.borderColor;
                ctx.fillStyle = labelColors.backgroundColor;
                drawPoint(ctx, drawOptions, centerX, centerY);
            } else {
                ctx.lineWidth = isObject(labelColors.borderWidth) ? Math.max(...Object.values(labelColors.borderWidth)) : labelColors.borderWidth || 1;
                ctx.strokeStyle = labelColors.borderColor;
                ctx.setLineDash(labelColors.borderDash || []);
                ctx.lineDashOffset = labelColors.borderDashOffset || 0;
                const outerX = rtlHelper.leftForLtr(rtlColorX, boxWidth - boxPadding);
                const innerX = rtlHelper.leftForLtr(rtlHelper.xPlus(rtlColorX, 1), boxWidth - boxPadding - 2);
                const borderRadius = toTRBLCorners(labelColors.borderRadius);
                if (Object.values(borderRadius).some((v)=>v !== 0)) {
                    ctx.beginPath();
                    ctx.fillStyle = options.multiKeyBackground;
                    addRoundedRectPath(ctx, {
                        x: outerX,
                        y: colorY,
                        w: boxWidth,
                        h: boxHeight,
                        radius: borderRadius
                    });
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = labelColors.backgroundColor;
                    ctx.beginPath();
                    addRoundedRectPath(ctx, {
                        x: innerX,
                        y: colorY + 1,
                        w: boxWidth - 2,
                        h: boxHeight - 2,
                        radius: borderRadius
                    });
                    ctx.fill();
                } else {
                    ctx.fillStyle = options.multiKeyBackground;
                    ctx.fillRect(outerX, colorY, boxWidth, boxHeight);
                    ctx.strokeRect(outerX, colorY, boxWidth, boxHeight);
                    ctx.fillStyle = labelColors.backgroundColor;
                    ctx.fillRect(innerX, colorY + 1, boxWidth - 2, boxHeight - 2);
                }
            }
            ctx.fillStyle = this.labelTextColors[i];
        }
        drawBody(pt, ctx, options) {
            const { body  } = this;
            const { bodySpacing , bodyAlign , displayColors , boxHeight , boxWidth , boxPadding  } = options;
            const bodyFont = toFont(options.bodyFont);
            let bodyLineHeight = bodyFont.lineHeight;
            let xLinePadding = 0;
            const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
            const fillLineOfText = function(line) {
                ctx.fillText(line, rtlHelper.x(pt.x + xLinePadding), pt.y + bodyLineHeight / 2);
                pt.y += bodyLineHeight + bodySpacing;
            };
            const bodyAlignForCalculation = rtlHelper.textAlign(bodyAlign);
            let bodyItem, textColor, lines, i, j, ilen, jlen;
            ctx.textAlign = bodyAlign;
            ctx.textBaseline = 'middle';
            ctx.font = bodyFont.string;
            pt.x = getAlignedX(this, bodyAlignForCalculation, options);
            ctx.fillStyle = options.bodyColor;
            each(this.beforeBody, fillLineOfText);
            xLinePadding = displayColors && bodyAlignForCalculation !== 'right' ? bodyAlign === 'center' ? boxWidth / 2 + boxPadding : boxWidth + 2 + boxPadding : 0;
            for(i = 0, ilen = body.length; i < ilen; ++i){
                bodyItem = body[i];
                textColor = this.labelTextColors[i];
                ctx.fillStyle = textColor;
                each(bodyItem.before, fillLineOfText);
                lines = bodyItem.lines;
                if (displayColors && lines.length) {
                    this._drawColorBox(ctx, pt, i, rtlHelper, options);
                    bodyLineHeight = Math.max(bodyFont.lineHeight, boxHeight);
                }
                for(j = 0, jlen = lines.length; j < jlen; ++j){
                    fillLineOfText(lines[j]);
                    bodyLineHeight = bodyFont.lineHeight;
                }
                each(bodyItem.after, fillLineOfText);
            }
            xLinePadding = 0;
            bodyLineHeight = bodyFont.lineHeight;
            each(this.afterBody, fillLineOfText);
            pt.y -= bodySpacing;
        }
        drawFooter(pt, ctx, options) {
            const footer = this.footer;
            const length = footer.length;
            let footerFont, i;
            if (length) {
                const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
                pt.x = getAlignedX(this, options.footerAlign, options);
                pt.y += options.footerMarginTop;
                ctx.textAlign = rtlHelper.textAlign(options.footerAlign);
                ctx.textBaseline = 'middle';
                footerFont = toFont(options.footerFont);
                ctx.fillStyle = options.footerColor;
                ctx.font = footerFont.string;
                for(i = 0; i < length; ++i){
                    ctx.fillText(footer[i], rtlHelper.x(pt.x), pt.y + footerFont.lineHeight / 2);
                    pt.y += footerFont.lineHeight + options.footerSpacing;
                }
            }
        }
        drawBackground(pt, ctx, tooltipSize, options) {
            const { xAlign , yAlign  } = this;
            const { x , y  } = pt;
            const { width , height  } = tooltipSize;
            const { topLeft , topRight , bottomLeft , bottomRight  } = toTRBLCorners(options.cornerRadius);
            ctx.fillStyle = options.backgroundColor;
            ctx.strokeStyle = options.borderColor;
            ctx.lineWidth = options.borderWidth;
            ctx.beginPath();
            ctx.moveTo(x + topLeft, y);
            if (yAlign === 'top') {
                this.drawCaret(pt, ctx, tooltipSize, options);
            }
            ctx.lineTo(x + width - topRight, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + topRight);
            if (yAlign === 'center' && xAlign === 'right') {
                this.drawCaret(pt, ctx, tooltipSize, options);
            }
            ctx.lineTo(x + width, y + height - bottomRight);
            ctx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);
            if (yAlign === 'bottom') {
                this.drawCaret(pt, ctx, tooltipSize, options);
            }
            ctx.lineTo(x + bottomLeft, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);
            if (yAlign === 'center' && xAlign === 'left') {
                this.drawCaret(pt, ctx, tooltipSize, options);
            }
            ctx.lineTo(x, y + topLeft);
            ctx.quadraticCurveTo(x, y, x + topLeft, y);
            ctx.closePath();
            ctx.fill();
            if (options.borderWidth > 0) {
                ctx.stroke();
            }
        }
     _updateAnimationTarget(options) {
            const chart = this.chart;
            const anims = this.$animations;
            const animX = anims && anims.x;
            const animY = anims && anims.y;
            if (animX || animY) {
                const position = positioners[options.position].call(this, this._active, this._eventPosition);
                if (!position) {
                    return;
                }
                const size = this._size = getTooltipSize(this, options);
                const positionAndSize = Object.assign({}, position, this._size);
                const alignment = determineAlignment(chart, options, positionAndSize);
                const point = getBackgroundPoint(options, positionAndSize, alignment, chart);
                if (animX._to !== point.x || animY._to !== point.y) {
                    this.xAlign = alignment.xAlign;
                    this.yAlign = alignment.yAlign;
                    this.width = size.width;
                    this.height = size.height;
                    this.caretX = position.x;
                    this.caretY = position.y;
                    this._resolveAnimations().update(this, point);
                }
            }
        }
     _willRender() {
            return !!this.opacity;
        }
        draw(ctx) {
            const options = this.options.setContext(this.getContext());
            let opacity = this.opacity;
            if (!opacity) {
                return;
            }
            this._updateAnimationTarget(options);
            const tooltipSize = {
                width: this.width,
                height: this.height
            };
            const pt = {
                x: this.x,
                y: this.y
            };
            opacity = Math.abs(opacity) < 1e-3 ? 0 : opacity;
            const padding = toPadding(options.padding);
            const hasTooltipContent = this.title.length || this.beforeBody.length || this.body.length || this.afterBody.length || this.footer.length;
            if (options.enabled && hasTooltipContent) {
                ctx.save();
                ctx.globalAlpha = opacity;
                this.drawBackground(pt, ctx, tooltipSize, options);
                overrideTextDirection(ctx, options.textDirection);
                pt.y += padding.top;
                this.drawTitle(pt, ctx, options);
                this.drawBody(pt, ctx, options);
                this.drawFooter(pt, ctx, options);
                restoreTextDirection(ctx, options.textDirection);
                ctx.restore();
            }
        }
     getActiveElements() {
            return this._active || [];
        }
     setActiveElements(activeElements, eventPosition) {
            const lastActive = this._active;
            const active = activeElements.map(({ datasetIndex , index  })=>{
                const meta = this.chart.getDatasetMeta(datasetIndex);
                if (!meta) {
                    throw new Error('Cannot find a dataset at index ' + datasetIndex);
                }
                return {
                    datasetIndex,
                    element: meta.data[index],
                    index
                };
            });
            const changed = !_elementsEqual(lastActive, active);
            const positionChanged = this._positionChanged(active, eventPosition);
            if (changed || positionChanged) {
                this._active = active;
                this._eventPosition = eventPosition;
                this._ignoreReplayEvents = true;
                this.update(true);
            }
        }
     handleEvent(e, replay, inChartArea = true) {
            if (replay && this._ignoreReplayEvents) {
                return false;
            }
            this._ignoreReplayEvents = false;
            const options = this.options;
            const lastActive = this._active || [];
            const active = this._getActiveElements(e, lastActive, replay, inChartArea);
            const positionChanged = this._positionChanged(active, e);
            const changed = replay || !_elementsEqual(active, lastActive) || positionChanged;
            if (changed) {
                this._active = active;
                if (options.enabled || options.external) {
                    this._eventPosition = {
                        x: e.x,
                        y: e.y
                    };
                    this.update(true, replay);
                }
            }
            return changed;
        }
     _getActiveElements(e, lastActive, replay, inChartArea) {
            const options = this.options;
            if (e.type === 'mouseout') {
                return [];
            }
            if (!inChartArea) {
                return lastActive;
            }
            const active = this.chart.getElementsAtEventForMode(e, options.mode, options, replay);
            if (options.reverse) {
                active.reverse();
            }
            return active;
        }
     _positionChanged(active, e) {
            const { caretX , caretY , options  } = this;
            const position = positioners[options.position].call(this, active, e);
            return position !== false && (caretX !== position.x || caretY !== position.y);
        }
    }
    var plugin_tooltip = {
        id: 'tooltip',
        _element: Tooltip,
        positioners,
        afterInit (chart, _args, options) {
            if (options) {
                chart.tooltip = new Tooltip({
                    chart,
                    options
                });
            }
        },
        beforeUpdate (chart, _args, options) {
            if (chart.tooltip) {
                chart.tooltip.initialize(options);
            }
        },
        reset (chart, _args, options) {
            if (chart.tooltip) {
                chart.tooltip.initialize(options);
            }
        },
        afterDraw (chart) {
            const tooltip = chart.tooltip;
            if (tooltip && tooltip._willRender()) {
                const args = {
                    tooltip
                };
                if (chart.notifyPlugins('beforeTooltipDraw', {
                    ...args,
                    cancelable: true
                }) === false) {
                    return;
                }
                tooltip.draw(chart.ctx);
                chart.notifyPlugins('afterTooltipDraw', args);
            }
        },
        afterEvent (chart, args) {
            if (chart.tooltip) {
                const useFinalPosition = args.replay;
                if (chart.tooltip.handleEvent(args.event, useFinalPosition, args.inChartArea)) {
                    args.changed = true;
                }
            }
        },
        defaults: {
            enabled: true,
            external: null,
            position: 'average',
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            titleFont: {
                weight: 'bold'
            },
            titleSpacing: 2,
            titleMarginBottom: 6,
            titleAlign: 'left',
            bodyColor: '#fff',
            bodySpacing: 2,
            bodyFont: {},
            bodyAlign: 'left',
            footerColor: '#fff',
            footerSpacing: 2,
            footerMarginTop: 6,
            footerFont: {
                weight: 'bold'
            },
            footerAlign: 'left',
            padding: 6,
            caretPadding: 2,
            caretSize: 5,
            cornerRadius: 6,
            boxHeight: (ctx, opts)=>opts.bodyFont.size,
            boxWidth: (ctx, opts)=>opts.bodyFont.size,
            multiKeyBackground: '#fff',
            displayColors: true,
            boxPadding: 0,
            borderColor: 'rgba(0,0,0,0)',
            borderWidth: 0,
            animation: {
                duration: 400,
                easing: 'easeOutQuart'
            },
            animations: {
                numbers: {
                    type: 'number',
                    properties: [
                        'x',
                        'y',
                        'width',
                        'height',
                        'caretX',
                        'caretY'
                    ]
                },
                opacity: {
                    easing: 'linear',
                    duration: 200
                }
            },
            callbacks: defaultCallbacks
        },
        defaultRoutes: {
            bodyFont: 'font',
            footerFont: 'font',
            titleFont: 'font'
        },
        descriptors: {
            _scriptable: (name)=>name !== 'filter' && name !== 'itemSort' && name !== 'external',
            _indexable: false,
            callbacks: {
                _scriptable: false,
                _indexable: false
            },
            animation: {
                _fallback: false
            },
            animations: {
                _fallback: 'animation'
            }
        },
        additionalOptionScopes: [
            'interaction'
        ]
    };

    const addIfString = (labels, raw, index, addedLabels)=>{
        if (typeof raw === 'string') {
            index = labels.push(raw) - 1;
            addedLabels.unshift({
                index,
                label: raw
            });
        } else if (isNaN(raw)) {
            index = null;
        }
        return index;
    };
    function findOrAddLabel(labels, raw, index, addedLabels) {
        const first = labels.indexOf(raw);
        if (first === -1) {
            return addIfString(labels, raw, index, addedLabels);
        }
        const last = labels.lastIndexOf(raw);
        return first !== last ? index : first;
    }
    const validIndex = (index, max)=>index === null ? null : _limitValue(Math.round(index), 0, max);
    function _getLabelForValue(value) {
        const labels = this.getLabels();
        if (value >= 0 && value < labels.length) {
            return labels[value];
        }
        return value;
    }
    class CategoryScale extends Scale {
        static id = 'category';
     static defaults = {
            ticks: {
                callback: _getLabelForValue
            }
        };
        constructor(cfg){
            super(cfg);
             this._startValue = undefined;
            this._valueRange = 0;
            this._addedLabels = [];
        }
        init(scaleOptions) {
            const added = this._addedLabels;
            if (added.length) {
                const labels = this.getLabels();
                for (const { index , label  } of added){
                    if (labels[index] === label) {
                        labels.splice(index, 1);
                    }
                }
                this._addedLabels = [];
            }
            super.init(scaleOptions);
        }
        parse(raw, index) {
            if (isNullOrUndef(raw)) {
                return null;
            }
            const labels = this.getLabels();
            index = isFinite(index) && labels[index] === raw ? index : findOrAddLabel(labels, raw, valueOrDefault(index, raw), this._addedLabels);
            return validIndex(index, labels.length - 1);
        }
        determineDataLimits() {
            const { minDefined , maxDefined  } = this.getUserBounds();
            let { min , max  } = this.getMinMax(true);
            if (this.options.bounds === 'ticks') {
                if (!minDefined) {
                    min = 0;
                }
                if (!maxDefined) {
                    max = this.getLabels().length - 1;
                }
            }
            this.min = min;
            this.max = max;
        }
        buildTicks() {
            const min = this.min;
            const max = this.max;
            const offset = this.options.offset;
            const ticks = [];
            let labels = this.getLabels();
            labels = min === 0 && max === labels.length - 1 ? labels : labels.slice(min, max + 1);
            this._valueRange = Math.max(labels.length - (offset ? 0 : 1), 1);
            this._startValue = this.min - (offset ? 0.5 : 0);
            for(let value = min; value <= max; value++){
                ticks.push({
                    value
                });
            }
            return ticks;
        }
        getLabelForValue(value) {
            return _getLabelForValue.call(this, value);
        }
     configure() {
            super.configure();
            if (!this.isHorizontal()) {
                this._reversePixels = !this._reversePixels;
            }
        }
        getPixelForValue(value) {
            if (typeof value !== 'number') {
                value = this.parse(value);
            }
            return value === null ? NaN : this.getPixelForDecimal((value - this._startValue) / this._valueRange);
        }
        getPixelForTick(index) {
            const ticks = this.ticks;
            if (index < 0 || index > ticks.length - 1) {
                return null;
            }
            return this.getPixelForValue(ticks[index].value);
        }
        getValueForPixel(pixel) {
            return Math.round(this._startValue + this.getDecimalForPixel(pixel) * this._valueRange);
        }
        getBasePixel() {
            return this.bottom;
        }
    }

    function generateTicks$1(generationOptions, dataRange) {
        const ticks = [];
        const MIN_SPACING = 1e-14;
        const { bounds , step , min , max , precision , count , maxTicks , maxDigits , includeBounds  } = generationOptions;
        const unit = step || 1;
        const maxSpaces = maxTicks - 1;
        const { min: rmin , max: rmax  } = dataRange;
        const minDefined = !isNullOrUndef(min);
        const maxDefined = !isNullOrUndef(max);
        const countDefined = !isNullOrUndef(count);
        const minSpacing = (rmax - rmin) / (maxDigits + 1);
        let spacing = niceNum((rmax - rmin) / maxSpaces / unit) * unit;
        let factor, niceMin, niceMax, numSpaces;
        if (spacing < MIN_SPACING && !minDefined && !maxDefined) {
            return [
                {
                    value: rmin
                },
                {
                    value: rmax
                }
            ];
        }
        numSpaces = Math.ceil(rmax / spacing) - Math.floor(rmin / spacing);
        if (numSpaces > maxSpaces) {
            spacing = niceNum(numSpaces * spacing / maxSpaces / unit) * unit;
        }
        if (!isNullOrUndef(precision)) {
            factor = Math.pow(10, precision);
            spacing = Math.ceil(spacing * factor) / factor;
        }
        if (bounds === 'ticks') {
            niceMin = Math.floor(rmin / spacing) * spacing;
            niceMax = Math.ceil(rmax / spacing) * spacing;
        } else {
            niceMin = rmin;
            niceMax = rmax;
        }
        if (minDefined && maxDefined && step && almostWhole((max - min) / step, spacing / 1000)) {
            numSpaces = Math.round(Math.min((max - min) / spacing, maxTicks));
            spacing = (max - min) / numSpaces;
            niceMin = min;
            niceMax = max;
        } else if (countDefined) {
            niceMin = minDefined ? min : niceMin;
            niceMax = maxDefined ? max : niceMax;
            numSpaces = count - 1;
            spacing = (niceMax - niceMin) / numSpaces;
        } else {
            numSpaces = (niceMax - niceMin) / spacing;
            if (almostEquals(numSpaces, Math.round(numSpaces), spacing / 1000)) {
                numSpaces = Math.round(numSpaces);
            } else {
                numSpaces = Math.ceil(numSpaces);
            }
        }
        const decimalPlaces = Math.max(_decimalPlaces(spacing), _decimalPlaces(niceMin));
        factor = Math.pow(10, isNullOrUndef(precision) ? decimalPlaces : precision);
        niceMin = Math.round(niceMin * factor) / factor;
        niceMax = Math.round(niceMax * factor) / factor;
        let j = 0;
        if (minDefined) {
            if (includeBounds && niceMin !== min) {
                ticks.push({
                    value: min
                });
                if (niceMin < min) {
                    j++;
                }
                if (almostEquals(Math.round((niceMin + j * spacing) * factor) / factor, min, relativeLabelSize(min, minSpacing, generationOptions))) {
                    j++;
                }
            } else if (niceMin < min) {
                j++;
            }
        }
        for(; j < numSpaces; ++j){
            ticks.push({
                value: Math.round((niceMin + j * spacing) * factor) / factor
            });
        }
        if (maxDefined && includeBounds && niceMax !== max) {
            if (ticks.length && almostEquals(ticks[ticks.length - 1].value, max, relativeLabelSize(max, minSpacing, generationOptions))) {
                ticks[ticks.length - 1].value = max;
            } else {
                ticks.push({
                    value: max
                });
            }
        } else if (!maxDefined || niceMax === max) {
            ticks.push({
                value: niceMax
            });
        }
        return ticks;
    }
    function relativeLabelSize(value, minSpacing, { horizontal , minRotation  }) {
        const rad = toRadians(minRotation);
        const ratio = (horizontal ? Math.sin(rad) : Math.cos(rad)) || 0.001;
        const length = 0.75 * minSpacing * ('' + value).length;
        return Math.min(minSpacing / ratio, length);
    }
    class LinearScaleBase extends Scale {
        constructor(cfg){
            super(cfg);
             this.start = undefined;
             this.end = undefined;
             this._startValue = undefined;
             this._endValue = undefined;
            this._valueRange = 0;
        }
        parse(raw, index) {
            if (isNullOrUndef(raw)) {
                return null;
            }
            if ((typeof raw === 'number' || raw instanceof Number) && !isFinite(+raw)) {
                return null;
            }
            return +raw;
        }
        handleTickRangeOptions() {
            const { beginAtZero  } = this.options;
            const { minDefined , maxDefined  } = this.getUserBounds();
            let { min , max  } = this;
            const setMin = (v)=>min = minDefined ? min : v;
            const setMax = (v)=>max = maxDefined ? max : v;
            if (beginAtZero) {
                const minSign = sign(min);
                const maxSign = sign(max);
                if (minSign < 0 && maxSign < 0) {
                    setMax(0);
                } else if (minSign > 0 && maxSign > 0) {
                    setMin(0);
                }
            }
            if (min === max) {
                let offset = max === 0 ? 1 : Math.abs(max * 0.05);
                setMax(max + offset);
                if (!beginAtZero) {
                    setMin(min - offset);
                }
            }
            this.min = min;
            this.max = max;
        }
        getTickLimit() {
            const tickOpts = this.options.ticks;
            let { maxTicksLimit , stepSize  } = tickOpts;
            let maxTicks;
            if (stepSize) {
                maxTicks = Math.ceil(this.max / stepSize) - Math.floor(this.min / stepSize) + 1;
                if (maxTicks > 1000) {
                    console.warn(`scales.${this.id}.ticks.stepSize: ${stepSize} would result generating up to ${maxTicks} ticks. Limiting to 1000.`);
                    maxTicks = 1000;
                }
            } else {
                maxTicks = this.computeTickLimit();
                maxTicksLimit = maxTicksLimit || 11;
            }
            if (maxTicksLimit) {
                maxTicks = Math.min(maxTicksLimit, maxTicks);
            }
            return maxTicks;
        }
     computeTickLimit() {
            return Number.POSITIVE_INFINITY;
        }
        buildTicks() {
            const opts = this.options;
            const tickOpts = opts.ticks;
            let maxTicks = this.getTickLimit();
            maxTicks = Math.max(2, maxTicks);
            const numericGeneratorOptions = {
                maxTicks,
                bounds: opts.bounds,
                min: opts.min,
                max: opts.max,
                precision: tickOpts.precision,
                step: tickOpts.stepSize,
                count: tickOpts.count,
                maxDigits: this._maxDigits(),
                horizontal: this.isHorizontal(),
                minRotation: tickOpts.minRotation || 0,
                includeBounds: tickOpts.includeBounds !== false
            };
            const dataRange = this._range || this;
            const ticks = generateTicks$1(numericGeneratorOptions, dataRange);
            if (opts.bounds === 'ticks') {
                _setMinAndMaxByKey(ticks, this, 'value');
            }
            if (opts.reverse) {
                ticks.reverse();
                this.start = this.max;
                this.end = this.min;
            } else {
                this.start = this.min;
                this.end = this.max;
            }
            return ticks;
        }
     configure() {
            const ticks = this.ticks;
            let start = this.min;
            let end = this.max;
            super.configure();
            if (this.options.offset && ticks.length) {
                const offset = (end - start) / Math.max(ticks.length - 1, 1) / 2;
                start -= offset;
                end += offset;
            }
            this._startValue = start;
            this._endValue = end;
            this._valueRange = end - start;
        }
        getLabelForValue(value) {
            return formatNumber(value, this.chart.options.locale, this.options.ticks.format);
        }
    }

    class LinearScale extends LinearScaleBase {
        static id = 'linear';
     static defaults = {
            ticks: {
                callback: Ticks.formatters.numeric
            }
        };
        determineDataLimits() {
            const { min , max  } = this.getMinMax(true);
            this.min = isNumberFinite(min) ? min : 0;
            this.max = isNumberFinite(max) ? max : 1;
            this.handleTickRangeOptions();
        }
     computeTickLimit() {
            const horizontal = this.isHorizontal();
            const length = horizontal ? this.width : this.height;
            const minRotation = toRadians(this.options.ticks.minRotation);
            const ratio = (horizontal ? Math.sin(minRotation) : Math.cos(minRotation)) || 0.001;
            const tickFont = this._resolveTickFontOptions(0);
            return Math.ceil(length / Math.min(40, tickFont.lineHeight / ratio));
        }
        getPixelForValue(value) {
            return value === null ? NaN : this.getPixelForDecimal((value - this._startValue) / this._valueRange);
        }
        getValueForPixel(pixel) {
            return this._startValue + this.getDecimalForPixel(pixel) * this._valueRange;
        }
    }

    const INTERVALS = {
        millisecond: {
            common: true,
            size: 1,
            steps: 1000
        },
        second: {
            common: true,
            size: 1000,
            steps: 60
        },
        minute: {
            common: true,
            size: 60000,
            steps: 60
        },
        hour: {
            common: true,
            size: 3600000,
            steps: 24
        },
        day: {
            common: true,
            size: 86400000,
            steps: 30
        },
        week: {
            common: false,
            size: 604800000,
            steps: 4
        },
        month: {
            common: true,
            size: 2.628e9,
            steps: 12
        },
        quarter: {
            common: false,
            size: 7.884e9,
            steps: 4
        },
        year: {
            common: true,
            size: 3.154e10
        }
    };
     const UNITS =  /* #__PURE__ */ Object.keys(INTERVALS);
     function sorter(a, b) {
        return a - b;
    }
     function parse$1(scale, input) {
        if (isNullOrUndef(input)) {
            return null;
        }
        const adapter = scale._adapter;
        const { parser , round , isoWeekday  } = scale._parseOpts;
        let value = input;
        if (typeof parser === 'function') {
            value = parser(value);
        }
        if (!isNumberFinite(value)) {
            value = typeof parser === 'string' ? adapter.parse(value,  (parser)) : adapter.parse(value);
        }
        if (value === null) {
            return null;
        }
        if (round) {
            value = round === 'week' && (isNumber(isoWeekday) || isoWeekday === true) ? adapter.startOf(value, 'isoWeek', isoWeekday) : adapter.startOf(value, round);
        }
        return +value;
    }
     function determineUnitForAutoTicks(minUnit, min, max, capacity) {
        const ilen = UNITS.length;
        for(let i = UNITS.indexOf(minUnit); i < ilen - 1; ++i){
            const interval = INTERVALS[UNITS[i]];
            const factor = interval.steps ? interval.steps : Number.MAX_SAFE_INTEGER;
            if (interval.common && Math.ceil((max - min) / (factor * interval.size)) <= capacity) {
                return UNITS[i];
            }
        }
        return UNITS[ilen - 1];
    }
     function determineUnitForFormatting(scale, numTicks, minUnit, min, max) {
        for(let i = UNITS.length - 1; i >= UNITS.indexOf(minUnit); i--){
            const unit = UNITS[i];
            if (INTERVALS[unit].common && scale._adapter.diff(max, min, unit) >= numTicks - 1) {
                return unit;
            }
        }
        return UNITS[minUnit ? UNITS.indexOf(minUnit) : 0];
    }
     function determineMajorUnit(unit) {
        for(let i = UNITS.indexOf(unit) + 1, ilen = UNITS.length; i < ilen; ++i){
            if (INTERVALS[UNITS[i]].common) {
                return UNITS[i];
            }
        }
    }
     function addTick(ticks, time, timestamps) {
        if (!timestamps) {
            ticks[time] = true;
        } else if (timestamps.length) {
            const { lo , hi  } = _lookup(timestamps, time);
            const timestamp = timestamps[lo] >= time ? timestamps[lo] : timestamps[hi];
            ticks[timestamp] = true;
        }
    }
     function setMajorTicks(scale, ticks, map, majorUnit) {
        const adapter = scale._adapter;
        const first = +adapter.startOf(ticks[0].value, majorUnit);
        const last = ticks[ticks.length - 1].value;
        let major, index;
        for(major = first; major <= last; major = +adapter.add(major, 1, majorUnit)){
            index = map[major];
            if (index >= 0) {
                ticks[index].major = true;
            }
        }
        return ticks;
    }
     function ticksFromTimestamps(scale, values, majorUnit) {
        const ticks = [];
         const map = {};
        const ilen = values.length;
        let i, value;
        for(i = 0; i < ilen; ++i){
            value = values[i];
            map[value] = i;
            ticks.push({
                value,
                major: false
            });
        }
        return ilen === 0 || !majorUnit ? ticks : setMajorTicks(scale, ticks, map, majorUnit);
    }
    class TimeScale extends Scale {
        static id = 'time';
     static defaults = {
     bounds: 'data',
            adapters: {},
            time: {
                parser: false,
                unit: false,
                round: false,
                isoWeekday: false,
                minUnit: 'millisecond',
                displayFormats: {}
            },
            ticks: {
     source: 'auto',
                callback: false,
                major: {
                    enabled: false
                }
            }
        };
     constructor(props){
            super(props);
             this._cache = {
                data: [],
                labels: [],
                all: []
            };
             this._unit = 'day';
             this._majorUnit = undefined;
            this._offsets = {};
            this._normalized = false;
            this._parseOpts = undefined;
        }
        init(scaleOpts, opts = {}) {
            const time = scaleOpts.time || (scaleOpts.time = {});
             const adapter = this._adapter = new adapters._date(scaleOpts.adapters.date);
            adapter.init(opts);
            mergeIf(time.displayFormats, adapter.formats());
            this._parseOpts = {
                parser: time.parser,
                round: time.round,
                isoWeekday: time.isoWeekday
            };
            super.init(scaleOpts);
            this._normalized = opts.normalized;
        }
     parse(raw, index) {
            if (raw === undefined) {
                return null;
            }
            return parse$1(this, raw);
        }
        beforeLayout() {
            super.beforeLayout();
            this._cache = {
                data: [],
                labels: [],
                all: []
            };
        }
        determineDataLimits() {
            const options = this.options;
            const adapter = this._adapter;
            const unit = options.time.unit || 'day';
            let { min , max , minDefined , maxDefined  } = this.getUserBounds();
     function _applyBounds(bounds) {
                if (!minDefined && !isNaN(bounds.min)) {
                    min = Math.min(min, bounds.min);
                }
                if (!maxDefined && !isNaN(bounds.max)) {
                    max = Math.max(max, bounds.max);
                }
            }
            if (!minDefined || !maxDefined) {
                _applyBounds(this._getLabelBounds());
                if (options.bounds !== 'ticks' || options.ticks.source !== 'labels') {
                    _applyBounds(this.getMinMax(false));
                }
            }
            min = isNumberFinite(min) && !isNaN(min) ? min : +adapter.startOf(Date.now(), unit);
            max = isNumberFinite(max) && !isNaN(max) ? max : +adapter.endOf(Date.now(), unit) + 1;
            this.min = Math.min(min, max - 1);
            this.max = Math.max(min + 1, max);
        }
     _getLabelBounds() {
            const arr = this.getLabelTimestamps();
            let min = Number.POSITIVE_INFINITY;
            let max = Number.NEGATIVE_INFINITY;
            if (arr.length) {
                min = arr[0];
                max = arr[arr.length - 1];
            }
            return {
                min,
                max
            };
        }
     buildTicks() {
            const options = this.options;
            const timeOpts = options.time;
            const tickOpts = options.ticks;
            const timestamps = tickOpts.source === 'labels' ? this.getLabelTimestamps() : this._generate();
            if (options.bounds === 'ticks' && timestamps.length) {
                this.min = this._userMin || timestamps[0];
                this.max = this._userMax || timestamps[timestamps.length - 1];
            }
            const min = this.min;
            const max = this.max;
            const ticks = _filterBetween(timestamps, min, max);
            this._unit = timeOpts.unit || (tickOpts.autoSkip ? determineUnitForAutoTicks(timeOpts.minUnit, this.min, this.max, this._getLabelCapacity(min)) : determineUnitForFormatting(this, ticks.length, timeOpts.minUnit, this.min, this.max));
            this._majorUnit = !tickOpts.major.enabled || this._unit === 'year' ? undefined : determineMajorUnit(this._unit);
            this.initOffsets(timestamps);
            if (options.reverse) {
                ticks.reverse();
            }
            return ticksFromTimestamps(this, ticks, this._majorUnit);
        }
        afterAutoSkip() {
            if (this.options.offsetAfterAutoskip) {
                this.initOffsets(this.ticks.map((tick)=>+tick.value));
            }
        }
     initOffsets(timestamps = []) {
            let start = 0;
            let end = 0;
            let first, last;
            if (this.options.offset && timestamps.length) {
                first = this.getDecimalForValue(timestamps[0]);
                if (timestamps.length === 1) {
                    start = 1 - first;
                } else {
                    start = (this.getDecimalForValue(timestamps[1]) - first) / 2;
                }
                last = this.getDecimalForValue(timestamps[timestamps.length - 1]);
                if (timestamps.length === 1) {
                    end = last;
                } else {
                    end = (last - this.getDecimalForValue(timestamps[timestamps.length - 2])) / 2;
                }
            }
            const limit = timestamps.length < 3 ? 0.5 : 0.25;
            start = _limitValue(start, 0, limit);
            end = _limitValue(end, 0, limit);
            this._offsets = {
                start,
                end,
                factor: 1 / (start + 1 + end)
            };
        }
     _generate() {
            const adapter = this._adapter;
            const min = this.min;
            const max = this.max;
            const options = this.options;
            const timeOpts = options.time;
            const minor = timeOpts.unit || determineUnitForAutoTicks(timeOpts.minUnit, min, max, this._getLabelCapacity(min));
            const stepSize = valueOrDefault(options.ticks.stepSize, 1);
            const weekday = minor === 'week' ? timeOpts.isoWeekday : false;
            const hasWeekday = isNumber(weekday) || weekday === true;
            const ticks = {};
            let first = min;
            let time, count;
            if (hasWeekday) {
                first = +adapter.startOf(first, 'isoWeek', weekday);
            }
            first = +adapter.startOf(first, hasWeekday ? 'day' : minor);
            if (adapter.diff(max, min, minor) > 100000 * stepSize) {
                throw new Error(min + ' and ' + max + ' are too far apart with stepSize of ' + stepSize + ' ' + minor);
            }
            const timestamps = options.ticks.source === 'data' && this.getDataTimestamps();
            for(time = first, count = 0; time < max; time = +adapter.add(time, stepSize, minor), count++){
                addTick(ticks, time, timestamps);
            }
            if (time === max || options.bounds === 'ticks' || count === 1) {
                addTick(ticks, time, timestamps);
            }
            return Object.keys(ticks).sort((a, b)=>a - b).map((x)=>+x);
        }
     getLabelForValue(value) {
            const adapter = this._adapter;
            const timeOpts = this.options.time;
            if (timeOpts.tooltipFormat) {
                return adapter.format(value, timeOpts.tooltipFormat);
            }
            return adapter.format(value, timeOpts.displayFormats.datetime);
        }
     _tickFormatFunction(time, index, ticks, format) {
            const options = this.options;
            const formatter = options.ticks.callback;
            if (formatter) {
                return callback(formatter, [
                    time,
                    index,
                    ticks
                ], this);
            }
            const formats = options.time.displayFormats;
            const unit = this._unit;
            const majorUnit = this._majorUnit;
            const minorFormat = unit && formats[unit];
            const majorFormat = majorUnit && formats[majorUnit];
            const tick = ticks[index];
            const major = majorUnit && majorFormat && tick && tick.major;
            return this._adapter.format(time, format || (major ? majorFormat : minorFormat));
        }
     generateTickLabels(ticks) {
            let i, ilen, tick;
            for(i = 0, ilen = ticks.length; i < ilen; ++i){
                tick = ticks[i];
                tick.label = this._tickFormatFunction(tick.value, i, ticks);
            }
        }
     getDecimalForValue(value) {
            return value === null ? NaN : (value - this.min) / (this.max - this.min);
        }
     getPixelForValue(value) {
            const offsets = this._offsets;
            const pos = this.getDecimalForValue(value);
            return this.getPixelForDecimal((offsets.start + pos) * offsets.factor);
        }
     getValueForPixel(pixel) {
            const offsets = this._offsets;
            const pos = this.getDecimalForPixel(pixel) / offsets.factor - offsets.end;
            return this.min + pos * (this.max - this.min);
        }
     _getLabelSize(label) {
            const ticksOpts = this.options.ticks;
            const tickLabelWidth = this.ctx.measureText(label).width;
            const angle = toRadians(this.isHorizontal() ? ticksOpts.maxRotation : ticksOpts.minRotation);
            const cosRotation = Math.cos(angle);
            const sinRotation = Math.sin(angle);
            const tickFontSize = this._resolveTickFontOptions(0).size;
            return {
                w: tickLabelWidth * cosRotation + tickFontSize * sinRotation,
                h: tickLabelWidth * sinRotation + tickFontSize * cosRotation
            };
        }
     _getLabelCapacity(exampleTime) {
            const timeOpts = this.options.time;
            const displayFormats = timeOpts.displayFormats;
            const format = displayFormats[timeOpts.unit] || displayFormats.millisecond;
            const exampleLabel = this._tickFormatFunction(exampleTime, 0, ticksFromTimestamps(this, [
                exampleTime
            ], this._majorUnit), format);
            const size = this._getLabelSize(exampleLabel);
            const capacity = Math.floor(this.isHorizontal() ? this.width / size.w : this.height / size.h) - 1;
            return capacity > 0 ? capacity : 1;
        }
     getDataTimestamps() {
            let timestamps = this._cache.data || [];
            let i, ilen;
            if (timestamps.length) {
                return timestamps;
            }
            const metas = this.getMatchingVisibleMetas();
            if (this._normalized && metas.length) {
                return this._cache.data = metas[0].controller.getAllParsedValues(this);
            }
            for(i = 0, ilen = metas.length; i < ilen; ++i){
                timestamps = timestamps.concat(metas[i].controller.getAllParsedValues(this));
            }
            return this._cache.data = this.normalize(timestamps);
        }
     getLabelTimestamps() {
            const timestamps = this._cache.labels || [];
            let i, ilen;
            if (timestamps.length) {
                return timestamps;
            }
            const labels = this.getLabels();
            for(i = 0, ilen = labels.length; i < ilen; ++i){
                timestamps.push(parse$1(this, labels[i]));
            }
            return this._cache.labels = this._normalized ? timestamps : this.normalize(timestamps);
        }
     normalize(values) {
            return _arrayUnique(values.sort(sorter));
        }
    }

    function interpolate(table, val, reverse) {
        let lo = 0;
        let hi = table.length - 1;
        let prevSource, nextSource, prevTarget, nextTarget;
        if (reverse) {
            if (val >= table[lo].pos && val <= table[hi].pos) {
                ({ lo , hi  } = _lookupByKey(table, 'pos', val));
            }
            ({ pos: prevSource , time: prevTarget  } = table[lo]);
            ({ pos: nextSource , time: nextTarget  } = table[hi]);
        } else {
            if (val >= table[lo].time && val <= table[hi].time) {
                ({ lo , hi  } = _lookupByKey(table, 'time', val));
            }
            ({ time: prevSource , pos: prevTarget  } = table[lo]);
            ({ time: nextSource , pos: nextTarget  } = table[hi]);
        }
        const span = nextSource - prevSource;
        return span ? prevTarget + (nextTarget - prevTarget) * (val - prevSource) / span : prevTarget;
    }
    class TimeSeriesScale extends TimeScale {
        static id = 'timeseries';
     static defaults = TimeScale.defaults;
     constructor(props){
            super(props);
             this._table = [];
             this._minPos = undefined;
             this._tableRange = undefined;
        }
     initOffsets() {
            const timestamps = this._getTimestampsForTable();
            const table = this._table = this.buildLookupTable(timestamps);
            this._minPos = interpolate(table, this.min);
            this._tableRange = interpolate(table, this.max) - this._minPos;
            super.initOffsets(timestamps);
        }
     buildLookupTable(timestamps) {
            const { min , max  } = this;
            const items = [];
            const table = [];
            let i, ilen, prev, curr, next;
            for(i = 0, ilen = timestamps.length; i < ilen; ++i){
                curr = timestamps[i];
                if (curr >= min && curr <= max) {
                    items.push(curr);
                }
            }
            if (items.length < 2) {
                return [
                    {
                        time: min,
                        pos: 0
                    },
                    {
                        time: max,
                        pos: 1
                    }
                ];
            }
            for(i = 0, ilen = items.length; i < ilen; ++i){
                next = items[i + 1];
                prev = items[i - 1];
                curr = items[i];
                if (Math.round((next + prev) / 2) !== curr) {
                    table.push({
                        time: curr,
                        pos: i / (ilen - 1)
                    });
                }
            }
            return table;
        }
     _getTimestampsForTable() {
            let timestamps = this._cache.all || [];
            if (timestamps.length) {
                return timestamps;
            }
            const data = this.getDataTimestamps();
            const label = this.getLabelTimestamps();
            if (data.length && label.length) {
                timestamps = this.normalize(data.concat(label));
            } else {
                timestamps = data.length ? data : label;
            }
            timestamps = this._cache.all = timestamps;
            return timestamps;
        }
     getDecimalForValue(value) {
            return (interpolate(this._table, value) - this._minPos) / this._tableRange;
        }
     getValueForPixel(pixel) {
            const offsets = this._offsets;
            const decimal = this.getDecimalForPixel(pixel) / offsets.factor - offsets.end;
            return interpolate(this._table, decimal * this._tableRange + this._minPos, true);
        }
    }

    const eventPrefix = /^on/;
    const events = [];
    Object.keys(globalThis).forEach(key => {
        if (eventPrefix.test(key)) {
            events.push(key.replace(eventPrefix, ''));
        }
    });
    function useForwardEvents(getRef) {
        const component = current_component;
        const destructors = [];
        function forward(e) {
            bubble(component, e);
        }
        onMount(() => {
            const ref = getRef();
            events.forEach(ref instanceof Element
                ? event => destructors.push(listen(ref, event, forward))
                : event => destructors.push(ref.$on(event, forward)));
        });
        onDestroy(() => {
            while (destructors.length) {
                destructors.pop()();
            }
        });
    }

    /* node_modules/svelte-chartjs/Chart.svelte generated by Svelte v3.52.0 */

    function create_fragment$5(ctx) {
    	let canvas;
    	let canvas_levels = [/*props*/ ctx[1]];
    	let canvas_data = {};

    	for (let i = 0; i < canvas_levels.length; i += 1) {
    		canvas_data = assign$1(canvas_data, canvas_levels[i]);
    	}

    	return {
    		c() {
    			canvas = element("canvas");
    			set_attributes(canvas, canvas_data);
    		},
    		m(target, anchor) {
    			insert(target, canvas, anchor);
    			/*canvas_binding*/ ctx[8](canvas);
    		},
    		p(ctx, [dirty]) {
    			set_attributes(canvas, canvas_data = get_spread_update(canvas_levels, [/*props*/ ctx[1]]));
    		},
    		i: noop$1,
    		o: noop$1,
    		d(detaching) {
    			if (detaching) detach(canvas);
    			/*canvas_binding*/ ctx[8](null);
    		}
    	};
    }

    function clean(props) {
    	// eslint-disable-next-line @typescript-eslint/no-unused-vars
    	let { data, type, options, plugins, children, $$scope, $$slots, ...rest } = props;

    	return rest;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { type } = $$props;
    	let { data = { datasets: [] } } = $$props;
    	let { options = {} } = $$props;
    	let { plugins = [] } = $$props;
    	let { updateMode = undefined } = $$props;
    	let { chart = null } = $$props;
    	let canvasRef;
    	let props = clean($$props);

    	onMount(() => {
    		$$invalidate(2, chart = new Chart$1$1(canvasRef, { type, data, options, plugins }));
    	});

    	afterUpdate(() => {
    		if (!chart) return;
    		$$invalidate(2, chart.data = data, chart);
    		Object.assign(chart.options, options);
    		chart.update(updateMode);
    	});

    	onDestroy(() => {
    		if (chart) chart.destroy();
    		$$invalidate(2, chart = null);
    	});

    	useForwardEvents(() => canvasRef);

    	function canvas_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			canvasRef = $$value;
    			$$invalidate(0, canvasRef);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(9, $$props = assign$1(assign$1({}, $$props), exclude_internal_props($$new_props)));
    		if ('type' in $$new_props) $$invalidate(3, type = $$new_props.type);
    		if ('data' in $$new_props) $$invalidate(4, data = $$new_props.data);
    		if ('options' in $$new_props) $$invalidate(5, options = $$new_props.options);
    		if ('plugins' in $$new_props) $$invalidate(6, plugins = $$new_props.plugins);
    		if ('updateMode' in $$new_props) $$invalidate(7, updateMode = $$new_props.updateMode);
    		if ('chart' in $$new_props) $$invalidate(2, chart = $$new_props.chart);
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		canvasRef,
    		props,
    		chart,
    		type,
    		data,
    		options,
    		plugins,
    		updateMode,
    		canvas_binding
    	];
    }

    class Chart extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
    			type: 3,
    			data: 4,
    			options: 5,
    			plugins: 6,
    			updateMode: 7,
    			chart: 2
    		});
    	}
    }

    /* node_modules/svelte-chartjs/Pie.svelte generated by Svelte v3.52.0 */

    function create_fragment$4(ctx) {
    	let chart_1;
    	let updating_chart;
    	let current;
    	const chart_1_spread_levels = [{ type: "pie" }, /*props*/ ctx[1]];

    	function chart_1_chart_binding(value) {
    		/*chart_1_chart_binding*/ ctx[4](value);
    	}

    	let chart_1_props = {};

    	for (let i = 0; i < chart_1_spread_levels.length; i += 1) {
    		chart_1_props = assign$1(chart_1_props, chart_1_spread_levels[i]);
    	}

    	if (/*chart*/ ctx[0] !== void 0) {
    		chart_1_props.chart = /*chart*/ ctx[0];
    	}

    	chart_1 = new Chart({ props: chart_1_props });
    	/*chart_1_binding*/ ctx[3](chart_1);
    	binding_callbacks.push(() => bind(chart_1, 'chart', chart_1_chart_binding));

    	return {
    		c() {
    			create_component(chart_1.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(chart_1, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const chart_1_changes = (dirty & /*props*/ 2)
    			? get_spread_update(chart_1_spread_levels, [chart_1_spread_levels[0], get_spread_object(/*props*/ ctx[1])])
    			: {};

    			if (!updating_chart && dirty & /*chart*/ 1) {
    				updating_chart = true;
    				chart_1_changes.chart = /*chart*/ ctx[0];
    				add_flush_callback(() => updating_chart = false);
    			}

    			chart_1.$set(chart_1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(chart_1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(chart_1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			/*chart_1_binding*/ ctx[3](null);
    			destroy_component(chart_1, detaching);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	Chart$1$1.register(PieController);
    	let { chart = null } = $$props;
    	let props;
    	let baseChartRef;
    	useForwardEvents(() => baseChartRef);

    	function chart_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			baseChartRef = $$value;
    			$$invalidate(2, baseChartRef);
    		});
    	}

    	function chart_1_chart_binding(value) {
    		chart = value;
    		$$invalidate(0, chart);
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(5, $$props = assign$1(assign$1({}, $$props), exclude_internal_props($$new_props)));
    		if ('chart' in $$new_props) $$invalidate(0, chart = $$new_props.chart);
    	};

    	$$self.$$.update = () => {
    		$$invalidate(1, props = $$props);
    	};

    	$$props = exclude_internal_props($$props);
    	return [chart, props, baseChartRef, chart_1_binding, chart_1_chart_binding];
    }

    class Pie extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { chart: 0 });
    	}
    }

    /* node_modules/svelte-chartjs/Bar.svelte generated by Svelte v3.52.0 */

    function create_fragment$3(ctx) {
    	let chart_1;
    	let updating_chart;
    	let current;
    	const chart_1_spread_levels = [{ type: "bar" }, /*props*/ ctx[1]];

    	function chart_1_chart_binding(value) {
    		/*chart_1_chart_binding*/ ctx[4](value);
    	}

    	let chart_1_props = {};

    	for (let i = 0; i < chart_1_spread_levels.length; i += 1) {
    		chart_1_props = assign$1(chart_1_props, chart_1_spread_levels[i]);
    	}

    	if (/*chart*/ ctx[0] !== void 0) {
    		chart_1_props.chart = /*chart*/ ctx[0];
    	}

    	chart_1 = new Chart({ props: chart_1_props });
    	/*chart_1_binding*/ ctx[3](chart_1);
    	binding_callbacks.push(() => bind(chart_1, 'chart', chart_1_chart_binding));

    	return {
    		c() {
    			create_component(chart_1.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(chart_1, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const chart_1_changes = (dirty & /*props*/ 2)
    			? get_spread_update(chart_1_spread_levels, [chart_1_spread_levels[0], get_spread_object(/*props*/ ctx[1])])
    			: {};

    			if (!updating_chart && dirty & /*chart*/ 1) {
    				updating_chart = true;
    				chart_1_changes.chart = /*chart*/ ctx[0];
    				add_flush_callback(() => updating_chart = false);
    			}

    			chart_1.$set(chart_1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(chart_1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(chart_1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			/*chart_1_binding*/ ctx[3](null);
    			destroy_component(chart_1, detaching);
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	Chart$1$1.register(BarController);
    	let { chart = null } = $$props;
    	let props;
    	let baseChartRef;
    	useForwardEvents(() => baseChartRef);

    	function chart_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			baseChartRef = $$value;
    			$$invalidate(2, baseChartRef);
    		});
    	}

    	function chart_1_chart_binding(value) {
    		chart = value;
    		$$invalidate(0, chart);
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(5, $$props = assign$1(assign$1({}, $$props), exclude_internal_props($$new_props)));
    		if ('chart' in $$new_props) $$invalidate(0, chart = $$new_props.chart);
    	};

    	$$self.$$.update = () => {
    		$$invalidate(1, props = $$props);
    	};

    	$$props = exclude_internal_props($$props);
    	return [chart, props, baseChartRef, chart_1_binding, chart_1_chart_binding];
    }

    class Bar extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { chart: 0 });
    	}
    }

    function toInteger(dirtyNumber) {
      if (dirtyNumber === null || dirtyNumber === true || dirtyNumber === false) {
        return NaN;
      }

      var number = Number(dirtyNumber);

      if (isNaN(number)) {
        return number;
      }

      return number < 0 ? Math.ceil(number) : Math.floor(number);
    }

    function requiredArgs(required, args) {
      if (args.length < required) {
        throw new TypeError(required + ' argument' + (required > 1 ? 's' : '') + ' required, but only ' + args.length + ' present');
      }
    }

    function _typeof$y(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$y = function _typeof(obj) { return typeof obj; }; } else { _typeof$y = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$y(obj); }
    /**
     * @name toDate
     * @category Common Helpers
     * @summary Convert the given argument to an instance of Date.
     *
     * @description
     * Convert the given argument to an instance of Date.
     *
     * If the argument is an instance of Date, the function returns its clone.
     *
     * If the argument is a number, it is treated as a timestamp.
     *
     * If the argument is none of the above, the function returns Invalid Date.
     *
     * **Note**: *all* Date arguments passed to any *date-fns* function is processed by `toDate`.
     *
     * @param {Date|Number} argument - the value to convert
     * @returns {Date} the parsed date in the local time zone
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // Clone the date:
     * const result = toDate(new Date(2014, 1, 11, 11, 30, 30))
     * //=> Tue Feb 11 2014 11:30:30
     *
     * @example
     * // Convert the timestamp to date:
     * const result = toDate(1392098430000)
     * //=> Tue Feb 11 2014 11:30:30
     */

    function toDate(argument) {
      requiredArgs(1, arguments);
      var argStr = Object.prototype.toString.call(argument); // Clone the date

      if (argument instanceof Date || _typeof$y(argument) === 'object' && argStr === '[object Date]') {
        // Prevent the date to lose the milliseconds when passed to new Date() in IE10
        return new Date(argument.getTime());
      } else if (typeof argument === 'number' || argStr === '[object Number]') {
        return new Date(argument);
      } else {
        if ((typeof argument === 'string' || argStr === '[object String]') && typeof console !== 'undefined') {
          // eslint-disable-next-line no-console
          console.warn("Starting with v2.0.0-beta.1 date-fns doesn't accept strings as date arguments. Please use `parseISO` to parse strings. See: https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#string-arguments"); // eslint-disable-next-line no-console

          console.warn(new Error().stack);
        }

        return new Date(NaN);
      }
    }

    /**
     * @name addDays
     * @category Day Helpers
     * @summary Add the specified number of days to the given date.
     *
     * @description
     * Add the specified number of days to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of days to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} - the new date with the days added
     * @throws {TypeError} - 2 arguments required
     *
     * @example
     * // Add 10 days to 1 September 2014:
     * const result = addDays(new Date(2014, 8, 1), 10)
     * //=> Thu Sep 11 2014 00:00:00
     */

    function addDays(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var date = toDate(dirtyDate);
      var amount = toInteger(dirtyAmount);

      if (isNaN(amount)) {
        return new Date(NaN);
      }

      if (!amount) {
        // If 0 days, no-op to avoid changing times in the hour before end of DST
        return date;
      }

      date.setDate(date.getDate() + amount);
      return date;
    }

    /**
     * @name addMonths
     * @category Month Helpers
     * @summary Add the specified number of months to the given date.
     *
     * @description
     * Add the specified number of months to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of months to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the months added
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Add 5 months to 1 September 2014:
     * const result = addMonths(new Date(2014, 8, 1), 5)
     * //=> Sun Feb 01 2015 00:00:00
     */

    function addMonths(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var date = toDate(dirtyDate);
      var amount = toInteger(dirtyAmount);

      if (isNaN(amount)) {
        return new Date(NaN);
      }

      if (!amount) {
        // If 0 months, no-op to avoid changing times in the hour before end of DST
        return date;
      }

      var dayOfMonth = date.getDate(); // The JS Date object supports date math by accepting out-of-bounds values for
      // month, day, etc. For example, new Date(2020, 0, 0) returns 31 Dec 2019 and
      // new Date(2020, 13, 1) returns 1 Feb 2021.  This is *almost* the behavior we
      // want except that dates will wrap around the end of a month, meaning that
      // new Date(2020, 13, 31) will return 3 Mar 2021 not 28 Feb 2021 as desired. So
      // we'll default to the end of the desired month by adding 1 to the desired
      // month and using a date of 0 to back up one day to the end of the desired
      // month.

      var endOfDesiredMonth = new Date(date.getTime());
      endOfDesiredMonth.setMonth(date.getMonth() + amount + 1, 0);
      var daysInMonth = endOfDesiredMonth.getDate();

      if (dayOfMonth >= daysInMonth) {
        // If we're already at the end of the month, then this is the correct date
        // and we're done.
        return endOfDesiredMonth;
      } else {
        // Otherwise, we now know that setting the original day-of-month value won't
        // cause an overflow, so set the desired day-of-month. Note that we can't
        // just set the date of `endOfDesiredMonth` because that object may have had
        // its time changed in the unusual case where where a DST transition was on
        // the last day of the month and its local time was in the hour skipped or
        // repeated next to a DST transition.  So we use `date` instead which is
        // guaranteed to still have the original time.
        date.setFullYear(endOfDesiredMonth.getFullYear(), endOfDesiredMonth.getMonth(), dayOfMonth);
        return date;
      }
    }

    /**
     * @name addMilliseconds
     * @category Millisecond Helpers
     * @summary Add the specified number of milliseconds to the given date.
     *
     * @description
     * Add the specified number of milliseconds to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of milliseconds to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the milliseconds added
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Add 750 milliseconds to 10 July 2014 12:45:30.000:
     * const result = addMilliseconds(new Date(2014, 6, 10, 12, 45, 30, 0), 750)
     * //=> Thu Jul 10 2014 12:45:30.750
     */

    function addMilliseconds(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var timestamp = toDate(dirtyDate).getTime();
      var amount = toInteger(dirtyAmount);
      return new Date(timestamp + amount);
    }

    var MILLISECONDS_IN_HOUR = 3600000;
    /**
     * @name addHours
     * @category Hour Helpers
     * @summary Add the specified number of hours to the given date.
     *
     * @description
     * Add the specified number of hours to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of hours to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the hours added
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Add 2 hours to 10 July 2014 23:00:00:
     * const result = addHours(new Date(2014, 6, 10, 23, 0), 2)
     * //=> Fri Jul 11 2014 01:00:00
     */

    function addHours(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var amount = toInteger(dirtyAmount);
      return addMilliseconds(dirtyDate, amount * MILLISECONDS_IN_HOUR);
    }

    var defaultOptions = {};
    function getDefaultOptions() {
      return defaultOptions;
    }

    /**
     * @name startOfWeek
     * @category Week Helpers
     * @summary Return the start of a week for the given date.
     *
     * @description
     * Return the start of a week for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @param {Object} [options] - an object with options.
     * @param {Locale} [options.locale=defaultLocale] - the locale object. See [Locale]{@link https://date-fns.org/docs/Locale}
     * @param {0|1|2|3|4|5|6} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)
     * @returns {Date} the start of a week
     * @throws {TypeError} 1 argument required
     * @throws {RangeError} `options.weekStartsOn` must be between 0 and 6
     *
     * @example
     * // The start of a week for 2 September 2014 11:55:00:
     * const result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0))
     * //=> Sun Aug 31 2014 00:00:00
     *
     * @example
     * // If the week starts on Monday, the start of the week for 2 September 2014 11:55:00:
     * const result = startOfWeek(new Date(2014, 8, 2, 11, 55, 0), { weekStartsOn: 1 })
     * //=> Mon Sep 01 2014 00:00:00
     */

    function startOfWeek(dirtyDate, options) {
      var _ref, _ref2, _ref3, _options$weekStartsOn, _options$locale, _options$locale$optio, _defaultOptions$local, _defaultOptions$local2;

      requiredArgs(1, arguments);
      var defaultOptions = getDefaultOptions();
      var weekStartsOn = toInteger((_ref = (_ref2 = (_ref3 = (_options$weekStartsOn = options === null || options === void 0 ? void 0 : options.weekStartsOn) !== null && _options$weekStartsOn !== void 0 ? _options$weekStartsOn : options === null || options === void 0 ? void 0 : (_options$locale = options.locale) === null || _options$locale === void 0 ? void 0 : (_options$locale$optio = _options$locale.options) === null || _options$locale$optio === void 0 ? void 0 : _options$locale$optio.weekStartsOn) !== null && _ref3 !== void 0 ? _ref3 : defaultOptions.weekStartsOn) !== null && _ref2 !== void 0 ? _ref2 : (_defaultOptions$local = defaultOptions.locale) === null || _defaultOptions$local === void 0 ? void 0 : (_defaultOptions$local2 = _defaultOptions$local.options) === null || _defaultOptions$local2 === void 0 ? void 0 : _defaultOptions$local2.weekStartsOn) !== null && _ref !== void 0 ? _ref : 0); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

      if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
        throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
      }

      var date = toDate(dirtyDate);
      var day = date.getDay();
      var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
      date.setDate(date.getDate() - diff);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    /**
     * Google Chrome as of 67.0.3396.87 introduced timezones with offset that includes seconds.
     * They usually appear for dates that denote time before the timezones were introduced
     * (e.g. for 'Europe/Prague' timezone the offset is GMT+00:57:44 before 1 October 1891
     * and GMT+01:00:00 after that date)
     *
     * Date#getTimezoneOffset returns the offset in minutes and would return 57 for the example above,
     * which would lead to incorrect calculations.
     *
     * This function returns the timezone offset in milliseconds that takes seconds in account.
     */
    function getTimezoneOffsetInMilliseconds(date) {
      var utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()));
      utcDate.setUTCFullYear(date.getFullYear());
      return date.getTime() - utcDate.getTime();
    }

    /**
     * @name startOfDay
     * @category Day Helpers
     * @summary Return the start of a day for the given date.
     *
     * @description
     * Return the start of a day for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the start of a day
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The start of a day for 2 September 2014 11:55:00:
     * const result = startOfDay(new Date(2014, 8, 2, 11, 55, 0))
     * //=> Tue Sep 02 2014 00:00:00
     */

    function startOfDay(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    var MILLISECONDS_IN_DAY$1 = 86400000;
    /**
     * @name differenceInCalendarDays
     * @category Day Helpers
     * @summary Get the number of calendar days between the given dates.
     *
     * @description
     * Get the number of calendar days between the given dates. This means that the times are removed
     * from the dates and then the difference in days is calculated.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of calendar days
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many calendar days are between
     * // 2 July 2011 23:00:00 and 2 July 2012 00:00:00?
     * const result = differenceInCalendarDays(
     *   new Date(2012, 6, 2, 0, 0),
     *   new Date(2011, 6, 2, 23, 0)
     * )
     * //=> 366
     * // How many calendar days are between
     * // 2 July 2011 23:59:00 and 3 July 2011 00:01:00?
     * const result = differenceInCalendarDays(
     *   new Date(2011, 6, 3, 0, 1),
     *   new Date(2011, 6, 2, 23, 59)
     * )
     * //=> 1
     */

    function differenceInCalendarDays(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var startOfDayLeft = startOfDay(dirtyDateLeft);
      var startOfDayRight = startOfDay(dirtyDateRight);
      var timestampLeft = startOfDayLeft.getTime() - getTimezoneOffsetInMilliseconds(startOfDayLeft);
      var timestampRight = startOfDayRight.getTime() - getTimezoneOffsetInMilliseconds(startOfDayRight); // Round the number of days to the nearest integer
      // because the number of milliseconds in a day is not constant
      // (e.g. it's different in the day of the daylight saving time clock shift)

      return Math.round((timestampLeft - timestampRight) / MILLISECONDS_IN_DAY$1);
    }

    var MILLISECONDS_IN_MINUTE = 60000;
    /**
     * @name addMinutes
     * @category Minute Helpers
     * @summary Add the specified number of minutes to the given date.
     *
     * @description
     * Add the specified number of minutes to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of minutes to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the minutes added
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Add 30 minutes to 10 July 2014 12:00:00:
     * const result = addMinutes(new Date(2014, 6, 10, 12, 0), 30)
     * //=> Thu Jul 10 2014 12:30:00
     */

    function addMinutes(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var amount = toInteger(dirtyAmount);
      return addMilliseconds(dirtyDate, amount * MILLISECONDS_IN_MINUTE);
    }

    /**
     * @name addQuarters
     * @category Quarter Helpers
     * @summary Add the specified number of year quarters to the given date.
     *
     * @description
     * Add the specified number of year quarters to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of quarters to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the quarters added
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Add 1 quarter to 1 September 2014:
     * const result = addQuarters(new Date(2014, 8, 1), 1)
     * //=> Mon Dec 01 2014 00:00:00
     */

    function addQuarters(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var amount = toInteger(dirtyAmount);
      var months = amount * 3;
      return addMonths(dirtyDate, months);
    }

    /**
     * @name addSeconds
     * @category Second Helpers
     * @summary Add the specified number of seconds to the given date.
     *
     * @description
     * Add the specified number of seconds to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of seconds to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the seconds added
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Add 30 seconds to 10 July 2014 12:45:00:
     * const result = addSeconds(new Date(2014, 6, 10, 12, 45, 0), 30)
     * //=> Thu Jul 10 2014 12:45:30
     */

    function addSeconds(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var amount = toInteger(dirtyAmount);
      return addMilliseconds(dirtyDate, amount * 1000);
    }

    /**
     * @name addWeeks
     * @category Week Helpers
     * @summary Add the specified number of weeks to the given date.
     *
     * @description
     * Add the specified number of week to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of weeks to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the weeks added
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Add 4 weeks to 1 September 2014:
     * const result = addWeeks(new Date(2014, 8, 1), 4)
     * //=> Mon Sep 29 2014 00:00:00
     */

    function addWeeks(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var amount = toInteger(dirtyAmount);
      var days = amount * 7;
      return addDays(dirtyDate, days);
    }

    /**
     * @name addYears
     * @category Year Helpers
     * @summary Add the specified number of years to the given date.
     *
     * @description
     * Add the specified number of years to the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of years to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the years added
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Add 5 years to 1 September 2014:
     * const result = addYears(new Date(2014, 8, 1), 5)
     * //=> Sun Sep 01 2019 00:00:00
     */

    function addYears(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var amount = toInteger(dirtyAmount);
      return addMonths(dirtyDate, amount * 12);
    }

    /**
     * @name compareAsc
     * @category Common Helpers
     * @summary Compare the two dates and return -1, 0 or 1.
     *
     * @description
     * Compare the two dates and return 1 if the first date is after the second,
     * -1 if the first date is before the second or 0 if dates are equal.
     *
     * @param {Date|Number} dateLeft - the first date to compare
     * @param {Date|Number} dateRight - the second date to compare
     * @returns {Number} the result of the comparison
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Compare 11 February 1987 and 10 July 1989:
     * const result = compareAsc(new Date(1987, 1, 11), new Date(1989, 6, 10))
     * //=> -1
     *
     * @example
     * // Sort the array of dates:
     * const result = [
     *   new Date(1995, 6, 2),
     *   new Date(1987, 1, 11),
     *   new Date(1989, 6, 10)
     * ].sort(compareAsc)
     * //=> [
     * //   Wed Feb 11 1987 00:00:00,
     * //   Mon Jul 10 1989 00:00:00,
     * //   Sun Jul 02 1995 00:00:00
     * // ]
     */

    function compareAsc(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      var diff = dateLeft.getTime() - dateRight.getTime();

      if (diff < 0) {
        return -1;
      } else if (diff > 0) {
        return 1; // Return 0 if diff is 0; return NaN if diff is NaN
      } else {
        return diff;
      }
    }

    /**
     * Days in 1 week.
     *
     * @name daysInWeek
     * @constant
     * @type {number}
     * @default
     */
    /**
     * Milliseconds in 1 minute
     *
     * @name millisecondsInMinute
     * @constant
     * @type {number}
     * @default
     */

    var millisecondsInMinute = 60000;
    /**
     * Milliseconds in 1 hour
     *
     * @name millisecondsInHour
     * @constant
     * @type {number}
     * @default
     */

    var millisecondsInHour = 3600000;
    /**
     * Milliseconds in 1 second
     *
     * @name millisecondsInSecond
     * @constant
     * @type {number}
     * @default
     */

    var millisecondsInSecond = 1000;

    function _typeof$x(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$x = function _typeof(obj) { return typeof obj; }; } else { _typeof$x = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$x(obj); }
    /**
     * @name isDate
     * @category Common Helpers
     * @summary Is the given value a date?
     *
     * @description
     * Returns true if the given value is an instance of Date. The function works for dates transferred across iframes.
     *
     * @param {*} value - the value to check
     * @returns {boolean} true if the given value is a date
     * @throws {TypeError} 1 arguments required
     *
     * @example
     * // For a valid date:
     * const result = isDate(new Date())
     * //=> true
     *
     * @example
     * // For an invalid date:
     * const result = isDate(new Date(NaN))
     * //=> true
     *
     * @example
     * // For some value:
     * const result = isDate('2014-02-31')
     * //=> false
     *
     * @example
     * // For an object:
     * const result = isDate({})
     * //=> false
     */

    function isDate(value) {
      requiredArgs(1, arguments);
      return value instanceof Date || _typeof$x(value) === 'object' && Object.prototype.toString.call(value) === '[object Date]';
    }

    /**
     * @name isValid
     * @category Common Helpers
     * @summary Is the given date valid?
     *
     * @description
     * Returns false if argument is Invalid Date and true otherwise.
     * Argument is converted to Date using `toDate`. See [toDate]{@link https://date-fns.org/docs/toDate}
     * Invalid Date is a Date, whose time value is NaN.
     *
     * Time value of Date: http://es5.github.io/#x15.9.1.1
     *
     * @param {*} date - the date to check
     * @returns {Boolean} the date is valid
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // For the valid date:
     * const result = isValid(new Date(2014, 1, 31))
     * //=> true
     *
     * @example
     * // For the value, convertable into a date:
     * const result = isValid(1393804800000)
     * //=> true
     *
     * @example
     * // For the invalid date:
     * const result = isValid(new Date(''))
     * //=> false
     */

    function isValid(dirtyDate) {
      requiredArgs(1, arguments);

      if (!isDate(dirtyDate) && typeof dirtyDate !== 'number') {
        return false;
      }

      var date = toDate(dirtyDate);
      return !isNaN(Number(date));
    }

    /**
     * @name differenceInCalendarMonths
     * @category Month Helpers
     * @summary Get the number of calendar months between the given dates.
     *
     * @description
     * Get the number of calendar months between the given dates.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of calendar months
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many calendar months are between 31 January 2014 and 1 September 2014?
     * const result = differenceInCalendarMonths(
     *   new Date(2014, 8, 1),
     *   new Date(2014, 0, 31)
     * )
     * //=> 8
     */

    function differenceInCalendarMonths(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      var yearDiff = dateLeft.getFullYear() - dateRight.getFullYear();
      var monthDiff = dateLeft.getMonth() - dateRight.getMonth();
      return yearDiff * 12 + monthDiff;
    }

    /**
     * @name differenceInCalendarYears
     * @category Year Helpers
     * @summary Get the number of calendar years between the given dates.
     *
     * @description
     * Get the number of calendar years between the given dates.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of calendar years
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many calendar years are between 31 December 2013 and 11 February 2015?
     * const result = differenceInCalendarYears(
     *   new Date(2015, 1, 11),
     *   new Date(2013, 11, 31)
     * )
     * //=> 2
     */

    function differenceInCalendarYears(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      return dateLeft.getFullYear() - dateRight.getFullYear();
    }

    // for accurate equality comparisons of UTC timestamps that end up
    // having the same representation in local time, e.g. one hour before
    // DST ends vs. the instant that DST ends.

    function compareLocalAsc(dateLeft, dateRight) {
      var diff = dateLeft.getFullYear() - dateRight.getFullYear() || dateLeft.getMonth() - dateRight.getMonth() || dateLeft.getDate() - dateRight.getDate() || dateLeft.getHours() - dateRight.getHours() || dateLeft.getMinutes() - dateRight.getMinutes() || dateLeft.getSeconds() - dateRight.getSeconds() || dateLeft.getMilliseconds() - dateRight.getMilliseconds();

      if (diff < 0) {
        return -1;
      } else if (diff > 0) {
        return 1; // Return 0 if diff is 0; return NaN if diff is NaN
      } else {
        return diff;
      }
    }
    /**
     * @name differenceInDays
     * @category Day Helpers
     * @summary Get the number of full days between the given dates.
     *
     * @description
     * Get the number of full day periods between two dates. Fractional days are
     * truncated towards zero.
     *
     * One "full day" is the distance between a local time in one day to the same
     * local time on the next or previous day. A full day can sometimes be less than
     * or more than 24 hours if a daylight savings change happens between two dates.
     *
     * To ignore DST and only measure exact 24-hour periods, use this instead:
     * `Math.floor(differenceInHours(dateLeft, dateRight)/24)|0`.
     *
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of full days according to the local timezone
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many full days are between
     * // 2 July 2011 23:00:00 and 2 July 2012 00:00:00?
     * const result = differenceInDays(
     *   new Date(2012, 6, 2, 0, 0),
     *   new Date(2011, 6, 2, 23, 0)
     * )
     * //=> 365
     * // How many full days are between
     * // 2 July 2011 23:59:00 and 3 July 2011 00:01:00?
     * const result = differenceInDays(
     *   new Date(2011, 6, 3, 0, 1),
     *   new Date(2011, 6, 2, 23, 59)
     * )
     * //=> 0
     * // How many full days are between
     * // 1 March 2020 0:00 and 1 June 2020 0:00 ?
     * // Note: because local time is used, the
     * // result will always be 92 days, even in
     * // time zones where DST starts and the
     * // period has only 92*24-1 hours.
     * const result = differenceInDays(
     *   new Date(2020, 5, 1),
     *   new Date(2020, 2, 1)
     * )
    //=> 92
     */


    function differenceInDays(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      var sign = compareLocalAsc(dateLeft, dateRight);
      var difference = Math.abs(differenceInCalendarDays(dateLeft, dateRight));
      dateLeft.setDate(dateLeft.getDate() - sign * difference); // Math.abs(diff in full days - diff in calendar days) === 1 if last calendar day is not full
      // If so, result must be decreased by 1 in absolute value

      var isLastDayNotFull = Number(compareLocalAsc(dateLeft, dateRight) === -sign);
      var result = sign * (difference - isLastDayNotFull); // Prevent negative zero

      return result === 0 ? 0 : result;
    }

    /**
     * @name differenceInMilliseconds
     * @category Millisecond Helpers
     * @summary Get the number of milliseconds between the given dates.
     *
     * @description
     * Get the number of milliseconds between the given dates.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of milliseconds
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many milliseconds are between
     * // 2 July 2014 12:30:20.600 and 2 July 2014 12:30:21.700?
     * const result = differenceInMilliseconds(
     *   new Date(2014, 6, 2, 12, 30, 21, 700),
     *   new Date(2014, 6, 2, 12, 30, 20, 600)
     * )
     * //=> 1100
     */

    function differenceInMilliseconds(dateLeft, dateRight) {
      requiredArgs(2, arguments);
      return toDate(dateLeft).getTime() - toDate(dateRight).getTime();
    }

    var roundingMap = {
      ceil: Math.ceil,
      round: Math.round,
      floor: Math.floor,
      trunc: function trunc(value) {
        return value < 0 ? Math.ceil(value) : Math.floor(value);
      } // Math.trunc is not supported by IE

    };
    var defaultRoundingMethod = 'trunc';
    function getRoundingMethod(method) {
      return method ? roundingMap[method] : roundingMap[defaultRoundingMethod];
    }

    /**
     * @name differenceInHours
     * @category Hour Helpers
     * @summary Get the number of hours between the given dates.
     *
     * @description
     * Get the number of hours between the given dates.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @param {Object} [options] - an object with options.
     * @param {String} [options.roundingMethod='trunc'] - a rounding method (`ceil`, `floor`, `round` or `trunc`)
     * @returns {Number} the number of hours
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many hours are between 2 July 2014 06:50:00 and 2 July 2014 19:00:00?
     * const result = differenceInHours(
     *   new Date(2014, 6, 2, 19, 0),
     *   new Date(2014, 6, 2, 6, 50)
     * )
     * //=> 12
     */

    function differenceInHours(dateLeft, dateRight, options) {
      requiredArgs(2, arguments);
      var diff = differenceInMilliseconds(dateLeft, dateRight) / millisecondsInHour;
      return getRoundingMethod(options === null || options === void 0 ? void 0 : options.roundingMethod)(diff);
    }

    /**
     * @name differenceInMinutes
     * @category Minute Helpers
     * @summary Get the number of minutes between the given dates.
     *
     * @description
     * Get the signed number of full (rounded towards 0) minutes between the given dates.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @param {Object} [options] - an object with options.
     * @param {String} [options.roundingMethod='trunc'] - a rounding method (`ceil`, `floor`, `round` or `trunc`)
     * @returns {Number} the number of minutes
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many minutes are between 2 July 2014 12:07:59 and 2 July 2014 12:20:00?
     * const result = differenceInMinutes(
     *   new Date(2014, 6, 2, 12, 20, 0),
     *   new Date(2014, 6, 2, 12, 7, 59)
     * )
     * //=> 12
     *
     * @example
     * // How many minutes are between 10:01:59 and 10:00:00
     * const result = differenceInMinutes(
     *   new Date(2000, 0, 1, 10, 0, 0),
     *   new Date(2000, 0, 1, 10, 1, 59)
     * )
     * //=> -1
     */

    function differenceInMinutes(dateLeft, dateRight, options) {
      requiredArgs(2, arguments);
      var diff = differenceInMilliseconds(dateLeft, dateRight) / millisecondsInMinute;
      return getRoundingMethod(options === null || options === void 0 ? void 0 : options.roundingMethod)(diff);
    }

    /**
     * @name endOfDay
     * @category Day Helpers
     * @summary Return the end of a day for the given date.
     *
     * @description
     * Return the end of a day for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the end of a day
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The end of a day for 2 September 2014 11:55:00:
     * const result = endOfDay(new Date(2014, 8, 2, 11, 55, 0))
     * //=> Tue Sep 02 2014 23:59:59.999
     */

    function endOfDay(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setHours(23, 59, 59, 999);
      return date;
    }

    /**
     * @name endOfMonth
     * @category Month Helpers
     * @summary Return the end of a month for the given date.
     *
     * @description
     * Return the end of a month for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the end of a month
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The end of a month for 2 September 2014 11:55:00:
     * const result = endOfMonth(new Date(2014, 8, 2, 11, 55, 0))
     * //=> Tue Sep 30 2014 23:59:59.999
     */

    function endOfMonth(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var month = date.getMonth();
      date.setFullYear(date.getFullYear(), month + 1, 0);
      date.setHours(23, 59, 59, 999);
      return date;
    }

    /**
     * @name isLastDayOfMonth
     * @category Month Helpers
     * @summary Is the given date the last day of a month?
     *
     * @description
     * Is the given date the last day of a month?
     *
     * @param {Date|Number} date - the date to check
     * @returns {Boolean} the date is the last day of a month
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // Is 28 February 2014 the last day of a month?
     * const result = isLastDayOfMonth(new Date(2014, 1, 28))
     * //=> true
     */

    function isLastDayOfMonth(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      return endOfDay(date).getTime() === endOfMonth(date).getTime();
    }

    /**
     * @name differenceInMonths
     * @category Month Helpers
     * @summary Get the number of full months between the given dates.
     *
     * @description
     * Get the number of full months between the given dates using trunc as a default rounding method.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of full months
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many full months are between 31 January 2014 and 1 September 2014?
     * const result = differenceInMonths(new Date(2014, 8, 1), new Date(2014, 0, 31))
     * //=> 7
     */

    function differenceInMonths(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      var sign = compareAsc(dateLeft, dateRight);
      var difference = Math.abs(differenceInCalendarMonths(dateLeft, dateRight));
      var result; // Check for the difference of less than month

      if (difference < 1) {
        result = 0;
      } else {
        if (dateLeft.getMonth() === 1 && dateLeft.getDate() > 27) {
          // This will check if the date is end of Feb and assign a higher end of month date
          // to compare it with Jan
          dateLeft.setDate(30);
        }

        dateLeft.setMonth(dateLeft.getMonth() - sign * difference); // Math.abs(diff in full months - diff in calendar months) === 1 if last calendar month is not full
        // If so, result must be decreased by 1 in absolute value

        var isLastMonthNotFull = compareAsc(dateLeft, dateRight) === -sign; // Check for cases of one full calendar month

        if (isLastDayOfMonth(toDate(dirtyDateLeft)) && difference === 1 && compareAsc(dirtyDateLeft, dateRight) === 1) {
          isLastMonthNotFull = false;
        }

        result = sign * (difference - Number(isLastMonthNotFull));
      } // Prevent negative zero


      return result === 0 ? 0 : result;
    }

    /**
     * @name differenceInQuarters
     * @category Quarter Helpers
     * @summary Get the number of quarters between the given dates.
     *
     * @description
     * Get the number of quarters between the given dates.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @param {Object} [options] - an object with options.
     * @param {String} [options.roundingMethod='trunc'] - a rounding method (`ceil`, `floor`, `round` or `trunc`)
     * @returns {Number} the number of full quarters
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many full quarters are between 31 December 2013 and 2 July 2014?
     * const result = differenceInQuarters(new Date(2014, 6, 2), new Date(2013, 11, 31))
     * //=> 2
     */

    function differenceInQuarters(dateLeft, dateRight, options) {
      requiredArgs(2, arguments);
      var diff = differenceInMonths(dateLeft, dateRight) / 3;
      return getRoundingMethod(options === null || options === void 0 ? void 0 : options.roundingMethod)(diff);
    }

    /**
     * @name differenceInSeconds
     * @category Second Helpers
     * @summary Get the number of seconds between the given dates.
     *
     * @description
     * Get the number of seconds between the given dates.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @param {Object} [options] - an object with options.
     * @param {String} [options.roundingMethod='trunc'] - a rounding method (`ceil`, `floor`, `round` or `trunc`)
     * @returns {Number} the number of seconds
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many seconds are between
     * // 2 July 2014 12:30:07.999 and 2 July 2014 12:30:20.000?
     * const result = differenceInSeconds(
     *   new Date(2014, 6, 2, 12, 30, 20, 0),
     *   new Date(2014, 6, 2, 12, 30, 7, 999)
     * )
     * //=> 12
     */

    function differenceInSeconds(dateLeft, dateRight, options) {
      requiredArgs(2, arguments);
      var diff = differenceInMilliseconds(dateLeft, dateRight) / 1000;
      return getRoundingMethod(options === null || options === void 0 ? void 0 : options.roundingMethod)(diff);
    }

    /**
     * @name differenceInWeeks
     * @category Week Helpers
     * @summary Get the number of full weeks between the given dates.
     *
     * @description
     * Get the number of full weeks between two dates. Fractional weeks are
     * truncated towards zero by default.
     *
     * One "full week" is the distance between a local time in one day to the same
     * local time 7 days earlier or later. A full week can sometimes be less than
     * or more than 7*24 hours if a daylight savings change happens between two dates.
     *
     * To ignore DST and only measure exact 7*24-hour periods, use this instead:
     * `Math.floor(differenceInHours(dateLeft, dateRight)/(7*24))|0`.
     *
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @param {Object} [options] - an object with options.
     * @param {String} [options.roundingMethod='trunc'] - a rounding method (`ceil`, `floor`, `round` or `trunc`)
     * @returns {Number} the number of full weeks
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many full weeks are between 5 July 2014 and 20 July 2014?
     * const result = differenceInWeeks(new Date(2014, 6, 20), new Date(2014, 6, 5))
     * //=> 2
     *
     * // How many full weeks are between
     * // 1 March 2020 0:00 and 6 June 2020 0:00 ?
     * // Note: because local time is used, the
     * // result will always be 8 weeks (54 days),
     * // even if DST starts and the period has
     * // only 54*24-1 hours.
     * const result = differenceInWeeks(
     *   new Date(2020, 5, 1),
     *   new Date(2020, 2, 6)
     * )
     * //=> 8
     */

    function differenceInWeeks(dateLeft, dateRight, options) {
      requiredArgs(2, arguments);
      var diff = differenceInDays(dateLeft, dateRight) / 7;
      return getRoundingMethod(options === null || options === void 0 ? void 0 : options.roundingMethod)(diff);
    }

    /**
     * @name differenceInYears
     * @category Year Helpers
     * @summary Get the number of full years between the given dates.
     *
     * @description
     * Get the number of full years between the given dates.
     *
     * @param {Date|Number} dateLeft - the later date
     * @param {Date|Number} dateRight - the earlier date
     * @returns {Number} the number of full years
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // How many full years are between 31 December 2013 and 11 February 2015?
     * const result = differenceInYears(new Date(2015, 1, 11), new Date(2013, 11, 31))
     * //=> 1
     */

    function differenceInYears(dirtyDateLeft, dirtyDateRight) {
      requiredArgs(2, arguments);
      var dateLeft = toDate(dirtyDateLeft);
      var dateRight = toDate(dirtyDateRight);
      var sign = compareAsc(dateLeft, dateRight);
      var difference = Math.abs(differenceInCalendarYears(dateLeft, dateRight)); // Set both dates to a valid leap year for accurate comparison when dealing
      // with leap days

      dateLeft.setFullYear(1584);
      dateRight.setFullYear(1584); // Math.abs(diff in full years - diff in calendar years) === 1 if last calendar year is not full
      // If so, result must be decreased by 1 in absolute value

      var isLastYearNotFull = compareAsc(dateLeft, dateRight) === -sign;
      var result = sign * (difference - Number(isLastYearNotFull)); // Prevent negative zero

      return result === 0 ? 0 : result;
    }

    /**
     * @name startOfMinute
     * @category Minute Helpers
     * @summary Return the start of a minute for the given date.
     *
     * @description
     * Return the start of a minute for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the start of a minute
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The start of a minute for 1 December 2014 22:15:45.400:
     * const result = startOfMinute(new Date(2014, 11, 1, 22, 15, 45, 400))
     * //=> Mon Dec 01 2014 22:15:00
     */

    function startOfMinute(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setSeconds(0, 0);
      return date;
    }

    /**
     * @name startOfQuarter
     * @category Quarter Helpers
     * @summary Return the start of a year quarter for the given date.
     *
     * @description
     * Return the start of a year quarter for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the start of a quarter
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The start of a quarter for 2 September 2014 11:55:00:
     * const result = startOfQuarter(new Date(2014, 8, 2, 11, 55, 0))
     * //=> Tue Jul 01 2014 00:00:00
     */

    function startOfQuarter(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var currentMonth = date.getMonth();
      var month = currentMonth - currentMonth % 3;
      date.setMonth(month, 1);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    /**
     * @name startOfMonth
     * @category Month Helpers
     * @summary Return the start of a month for the given date.
     *
     * @description
     * Return the start of a month for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the start of a month
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The start of a month for 2 September 2014 11:55:00:
     * const result = startOfMonth(new Date(2014, 8, 2, 11, 55, 0))
     * //=> Mon Sep 01 2014 00:00:00
     */

    function startOfMonth(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    /**
     * @name endOfYear
     * @category Year Helpers
     * @summary Return the end of a year for the given date.
     *
     * @description
     * Return the end of a year for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the end of a year
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The end of a year for 2 September 2014 11:55:00:
     * const result = endOfYear(new Date(2014, 8, 2, 11, 55, 00))
     * //=> Wed Dec 31 2014 23:59:59.999
     */

    function endOfYear(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var year = date.getFullYear();
      date.setFullYear(year + 1, 0, 0);
      date.setHours(23, 59, 59, 999);
      return date;
    }

    /**
     * @name startOfYear
     * @category Year Helpers
     * @summary Return the start of a year for the given date.
     *
     * @description
     * Return the start of a year for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the start of a year
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The start of a year for 2 September 2014 11:55:00:
     * const result = startOfYear(new Date(2014, 8, 2, 11, 55, 00))
     * //=> Wed Jan 01 2014 00:00:00
     */

    function startOfYear(dirtyDate) {
      requiredArgs(1, arguments);
      var cleanDate = toDate(dirtyDate);
      var date = new Date(0);
      date.setFullYear(cleanDate.getFullYear(), 0, 1);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    /**
     * @name endOfHour
     * @category Hour Helpers
     * @summary Return the end of an hour for the given date.
     *
     * @description
     * Return the end of an hour for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the end of an hour
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The end of an hour for 2 September 2014 11:55:00:
     * const result = endOfHour(new Date(2014, 8, 2, 11, 55))
     * //=> Tue Sep 02 2014 11:59:59.999
     */

    function endOfHour(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setMinutes(59, 59, 999);
      return date;
    }

    /**
     * @name endOfWeek
     * @category Week Helpers
     * @summary Return the end of a week for the given date.
     *
     * @description
     * Return the end of a week for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @param {Object} [options] - an object with options.
     * @param {Locale} [options.locale=defaultLocale] - the locale object. See [Locale]{@link https://date-fns.org/docs/Locale}
     * @param {0|1|2|3|4|5|6} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)
     * @returns {Date} the end of a week
     * @throws {TypeError} 1 argument required
     * @throws {RangeError} `options.weekStartsOn` must be between 0 and 6
     *
     * @example
     * // The end of a week for 2 September 2014 11:55:00:
     * const result = endOfWeek(new Date(2014, 8, 2, 11, 55, 0))
     * //=> Sat Sep 06 2014 23:59:59.999
     *
     * @example
     * // If the week starts on Monday, the end of the week for 2 September 2014 11:55:00:
     * const result = endOfWeek(new Date(2014, 8, 2, 11, 55, 0), { weekStartsOn: 1 })
     * //=> Sun Sep 07 2014 23:59:59.999
     */
    function endOfWeek(dirtyDate, options) {
      var _ref, _ref2, _ref3, _options$weekStartsOn, _options$locale, _options$locale$optio, _defaultOptions$local, _defaultOptions$local2;

      requiredArgs(1, arguments);
      var defaultOptions = getDefaultOptions();
      var weekStartsOn = toInteger((_ref = (_ref2 = (_ref3 = (_options$weekStartsOn = options === null || options === void 0 ? void 0 : options.weekStartsOn) !== null && _options$weekStartsOn !== void 0 ? _options$weekStartsOn : options === null || options === void 0 ? void 0 : (_options$locale = options.locale) === null || _options$locale === void 0 ? void 0 : (_options$locale$optio = _options$locale.options) === null || _options$locale$optio === void 0 ? void 0 : _options$locale$optio.weekStartsOn) !== null && _ref3 !== void 0 ? _ref3 : defaultOptions.weekStartsOn) !== null && _ref2 !== void 0 ? _ref2 : (_defaultOptions$local = defaultOptions.locale) === null || _defaultOptions$local === void 0 ? void 0 : (_defaultOptions$local2 = _defaultOptions$local.options) === null || _defaultOptions$local2 === void 0 ? void 0 : _defaultOptions$local2.weekStartsOn) !== null && _ref !== void 0 ? _ref : 0); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

      if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
        throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
      }

      var date = toDate(dirtyDate);
      var day = date.getDay();
      var diff = (day < weekStartsOn ? -7 : 0) + 6 - (day - weekStartsOn);
      date.setDate(date.getDate() + diff);
      date.setHours(23, 59, 59, 999);
      return date;
    }

    /**
     * @name endOfMinute
     * @category Minute Helpers
     * @summary Return the end of a minute for the given date.
     *
     * @description
     * Return the end of a minute for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the end of a minute
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The end of a minute for 1 December 2014 22:15:45.400:
     * const result = endOfMinute(new Date(2014, 11, 1, 22, 15, 45, 400))
     * //=> Mon Dec 01 2014 22:15:59.999
     */

    function endOfMinute(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setSeconds(59, 999);
      return date;
    }

    /**
     * @name endOfQuarter
     * @category Quarter Helpers
     * @summary Return the end of a year quarter for the given date.
     *
     * @description
     * Return the end of a year quarter for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the end of a quarter
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The end of a quarter for 2 September 2014 11:55:00:
     * const result = endOfQuarter(new Date(2014, 8, 2, 11, 55, 0))
     * //=> Tue Sep 30 2014 23:59:59.999
     */

    function endOfQuarter(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var currentMonth = date.getMonth();
      var month = currentMonth - currentMonth % 3 + 3;
      date.setMonth(month, 0);
      date.setHours(23, 59, 59, 999);
      return date;
    }

    /**
     * @name endOfSecond
     * @category Second Helpers
     * @summary Return the end of a second for the given date.
     *
     * @description
     * Return the end of a second for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the end of a second
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The end of a second for 1 December 2014 22:15:45.400:
     * const result = endOfSecond(new Date(2014, 11, 1, 22, 15, 45, 400))
     * //=> Mon Dec 01 2014 22:15:45.999
     */

    function endOfSecond(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setMilliseconds(999);
      return date;
    }

    /**
     * @name subMilliseconds
     * @category Millisecond Helpers
     * @summary Subtract the specified number of milliseconds from the given date.
     *
     * @description
     * Subtract the specified number of milliseconds from the given date.
     *
     * @param {Date|Number} date - the date to be changed
     * @param {Number} amount - the amount of milliseconds to be subtracted. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
     * @returns {Date} the new date with the milliseconds subtracted
     * @throws {TypeError} 2 arguments required
     *
     * @example
     * // Subtract 750 milliseconds from 10 July 2014 12:45:30.000:
     * const result = subMilliseconds(new Date(2014, 6, 10, 12, 45, 30, 0), 750)
     * //=> Thu Jul 10 2014 12:45:29.250
     */

    function subMilliseconds(dirtyDate, dirtyAmount) {
      requiredArgs(2, arguments);
      var amount = toInteger(dirtyAmount);
      return addMilliseconds(dirtyDate, -amount);
    }

    var MILLISECONDS_IN_DAY = 86400000;
    function getUTCDayOfYear(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var timestamp = date.getTime();
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
      var startOfYearTimestamp = date.getTime();
      var difference = timestamp - startOfYearTimestamp;
      return Math.floor(difference / MILLISECONDS_IN_DAY) + 1;
    }

    function startOfUTCISOWeek(dirtyDate) {
      requiredArgs(1, arguments);
      var weekStartsOn = 1;
      var date = toDate(dirtyDate);
      var day = date.getUTCDay();
      var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
      date.setUTCDate(date.getUTCDate() - diff);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    }

    function getUTCISOWeekYear(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var year = date.getUTCFullYear();
      var fourthOfJanuaryOfNextYear = new Date(0);
      fourthOfJanuaryOfNextYear.setUTCFullYear(year + 1, 0, 4);
      fourthOfJanuaryOfNextYear.setUTCHours(0, 0, 0, 0);
      var startOfNextYear = startOfUTCISOWeek(fourthOfJanuaryOfNextYear);
      var fourthOfJanuaryOfThisYear = new Date(0);
      fourthOfJanuaryOfThisYear.setUTCFullYear(year, 0, 4);
      fourthOfJanuaryOfThisYear.setUTCHours(0, 0, 0, 0);
      var startOfThisYear = startOfUTCISOWeek(fourthOfJanuaryOfThisYear);

      if (date.getTime() >= startOfNextYear.getTime()) {
        return year + 1;
      } else if (date.getTime() >= startOfThisYear.getTime()) {
        return year;
      } else {
        return year - 1;
      }
    }

    function startOfUTCISOWeekYear(dirtyDate) {
      requiredArgs(1, arguments);
      var year = getUTCISOWeekYear(dirtyDate);
      var fourthOfJanuary = new Date(0);
      fourthOfJanuary.setUTCFullYear(year, 0, 4);
      fourthOfJanuary.setUTCHours(0, 0, 0, 0);
      var date = startOfUTCISOWeek(fourthOfJanuary);
      return date;
    }

    var MILLISECONDS_IN_WEEK$1 = 604800000;
    function getUTCISOWeek(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var diff = startOfUTCISOWeek(date).getTime() - startOfUTCISOWeekYear(date).getTime(); // Round the number of days to the nearest integer
      // because the number of milliseconds in a week is not constant
      // (e.g. it's different in the week of the daylight saving time clock shift)

      return Math.round(diff / MILLISECONDS_IN_WEEK$1) + 1;
    }

    function startOfUTCWeek(dirtyDate, options) {
      var _ref, _ref2, _ref3, _options$weekStartsOn, _options$locale, _options$locale$optio, _defaultOptions$local, _defaultOptions$local2;

      requiredArgs(1, arguments);
      var defaultOptions = getDefaultOptions();
      var weekStartsOn = toInteger((_ref = (_ref2 = (_ref3 = (_options$weekStartsOn = options === null || options === void 0 ? void 0 : options.weekStartsOn) !== null && _options$weekStartsOn !== void 0 ? _options$weekStartsOn : options === null || options === void 0 ? void 0 : (_options$locale = options.locale) === null || _options$locale === void 0 ? void 0 : (_options$locale$optio = _options$locale.options) === null || _options$locale$optio === void 0 ? void 0 : _options$locale$optio.weekStartsOn) !== null && _ref3 !== void 0 ? _ref3 : defaultOptions.weekStartsOn) !== null && _ref2 !== void 0 ? _ref2 : (_defaultOptions$local = defaultOptions.locale) === null || _defaultOptions$local === void 0 ? void 0 : (_defaultOptions$local2 = _defaultOptions$local.options) === null || _defaultOptions$local2 === void 0 ? void 0 : _defaultOptions$local2.weekStartsOn) !== null && _ref !== void 0 ? _ref : 0); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

      if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
        throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
      }

      var date = toDate(dirtyDate);
      var day = date.getUTCDay();
      var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
      date.setUTCDate(date.getUTCDate() - diff);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    }

    function getUTCWeekYear(dirtyDate, options) {
      var _ref, _ref2, _ref3, _options$firstWeekCon, _options$locale, _options$locale$optio, _defaultOptions$local, _defaultOptions$local2;

      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var year = date.getUTCFullYear();
      var defaultOptions = getDefaultOptions();
      var firstWeekContainsDate = toInteger((_ref = (_ref2 = (_ref3 = (_options$firstWeekCon = options === null || options === void 0 ? void 0 : options.firstWeekContainsDate) !== null && _options$firstWeekCon !== void 0 ? _options$firstWeekCon : options === null || options === void 0 ? void 0 : (_options$locale = options.locale) === null || _options$locale === void 0 ? void 0 : (_options$locale$optio = _options$locale.options) === null || _options$locale$optio === void 0 ? void 0 : _options$locale$optio.firstWeekContainsDate) !== null && _ref3 !== void 0 ? _ref3 : defaultOptions.firstWeekContainsDate) !== null && _ref2 !== void 0 ? _ref2 : (_defaultOptions$local = defaultOptions.locale) === null || _defaultOptions$local === void 0 ? void 0 : (_defaultOptions$local2 = _defaultOptions$local.options) === null || _defaultOptions$local2 === void 0 ? void 0 : _defaultOptions$local2.firstWeekContainsDate) !== null && _ref !== void 0 ? _ref : 1); // Test if weekStartsOn is between 1 and 7 _and_ is not NaN

      if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
        throw new RangeError('firstWeekContainsDate must be between 1 and 7 inclusively');
      }

      var firstWeekOfNextYear = new Date(0);
      firstWeekOfNextYear.setUTCFullYear(year + 1, 0, firstWeekContainsDate);
      firstWeekOfNextYear.setUTCHours(0, 0, 0, 0);
      var startOfNextYear = startOfUTCWeek(firstWeekOfNextYear, options);
      var firstWeekOfThisYear = new Date(0);
      firstWeekOfThisYear.setUTCFullYear(year, 0, firstWeekContainsDate);
      firstWeekOfThisYear.setUTCHours(0, 0, 0, 0);
      var startOfThisYear = startOfUTCWeek(firstWeekOfThisYear, options);

      if (date.getTime() >= startOfNextYear.getTime()) {
        return year + 1;
      } else if (date.getTime() >= startOfThisYear.getTime()) {
        return year;
      } else {
        return year - 1;
      }
    }

    function startOfUTCWeekYear(dirtyDate, options) {
      var _ref, _ref2, _ref3, _options$firstWeekCon, _options$locale, _options$locale$optio, _defaultOptions$local, _defaultOptions$local2;

      requiredArgs(1, arguments);
      var defaultOptions = getDefaultOptions();
      var firstWeekContainsDate = toInteger((_ref = (_ref2 = (_ref3 = (_options$firstWeekCon = options === null || options === void 0 ? void 0 : options.firstWeekContainsDate) !== null && _options$firstWeekCon !== void 0 ? _options$firstWeekCon : options === null || options === void 0 ? void 0 : (_options$locale = options.locale) === null || _options$locale === void 0 ? void 0 : (_options$locale$optio = _options$locale.options) === null || _options$locale$optio === void 0 ? void 0 : _options$locale$optio.firstWeekContainsDate) !== null && _ref3 !== void 0 ? _ref3 : defaultOptions.firstWeekContainsDate) !== null && _ref2 !== void 0 ? _ref2 : (_defaultOptions$local = defaultOptions.locale) === null || _defaultOptions$local === void 0 ? void 0 : (_defaultOptions$local2 = _defaultOptions$local.options) === null || _defaultOptions$local2 === void 0 ? void 0 : _defaultOptions$local2.firstWeekContainsDate) !== null && _ref !== void 0 ? _ref : 1);
      var year = getUTCWeekYear(dirtyDate, options);
      var firstWeek = new Date(0);
      firstWeek.setUTCFullYear(year, 0, firstWeekContainsDate);
      firstWeek.setUTCHours(0, 0, 0, 0);
      var date = startOfUTCWeek(firstWeek, options);
      return date;
    }

    var MILLISECONDS_IN_WEEK = 604800000;
    function getUTCWeek(dirtyDate, options) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      var diff = startOfUTCWeek(date, options).getTime() - startOfUTCWeekYear(date, options).getTime(); // Round the number of days to the nearest integer
      // because the number of milliseconds in a week is not constant
      // (e.g. it's different in the week of the daylight saving time clock shift)

      return Math.round(diff / MILLISECONDS_IN_WEEK) + 1;
    }

    function addLeadingZeros(number, targetLength) {
      var sign = number < 0 ? '-' : '';
      var output = Math.abs(number).toString();

      while (output.length < targetLength) {
        output = '0' + output;
      }

      return sign + output;
    }

    /*
     * |     | Unit                           |     | Unit                           |
     * |-----|--------------------------------|-----|--------------------------------|
     * |  a  | AM, PM                         |  A* |                                |
     * |  d  | Day of month                   |  D  |                                |
     * |  h  | Hour [1-12]                    |  H  | Hour [0-23]                    |
     * |  m  | Minute                         |  M  | Month                          |
     * |  s  | Second                         |  S  | Fraction of second             |
     * |  y  | Year (abs)                     |  Y  |                                |
     *
     * Letters marked by * are not implemented but reserved by Unicode standard.
     */

    var formatters$1 = {
      // Year
      y: function y(date, token) {
        // From http://www.unicode.org/reports/tr35/tr35-31/tr35-dates.html#Date_Format_tokens
        // | Year     |     y | yy |   yyy |  yyyy | yyyyy |
        // |----------|-------|----|-------|-------|-------|
        // | AD 1     |     1 | 01 |   001 |  0001 | 00001 |
        // | AD 12    |    12 | 12 |   012 |  0012 | 00012 |
        // | AD 123   |   123 | 23 |   123 |  0123 | 00123 |
        // | AD 1234  |  1234 | 34 |  1234 |  1234 | 01234 |
        // | AD 12345 | 12345 | 45 | 12345 | 12345 | 12345 |
        var signedYear = date.getUTCFullYear(); // Returns 1 for 1 BC (which is year 0 in JavaScript)

        var year = signedYear > 0 ? signedYear : 1 - signedYear;
        return addLeadingZeros(token === 'yy' ? year % 100 : year, token.length);
      },
      // Month
      M: function M(date, token) {
        var month = date.getUTCMonth();
        return token === 'M' ? String(month + 1) : addLeadingZeros(month + 1, 2);
      },
      // Day of the month
      d: function d(date, token) {
        return addLeadingZeros(date.getUTCDate(), token.length);
      },
      // AM or PM
      a: function a(date, token) {
        var dayPeriodEnumValue = date.getUTCHours() / 12 >= 1 ? 'pm' : 'am';

        switch (token) {
          case 'a':
          case 'aa':
            return dayPeriodEnumValue.toUpperCase();

          case 'aaa':
            return dayPeriodEnumValue;

          case 'aaaaa':
            return dayPeriodEnumValue[0];

          case 'aaaa':
          default:
            return dayPeriodEnumValue === 'am' ? 'a.m.' : 'p.m.';
        }
      },
      // Hour [1-12]
      h: function h(date, token) {
        return addLeadingZeros(date.getUTCHours() % 12 || 12, token.length);
      },
      // Hour [0-23]
      H: function H(date, token) {
        return addLeadingZeros(date.getUTCHours(), token.length);
      },
      // Minute
      m: function m(date, token) {
        return addLeadingZeros(date.getUTCMinutes(), token.length);
      },
      // Second
      s: function s(date, token) {
        return addLeadingZeros(date.getUTCSeconds(), token.length);
      },
      // Fraction of second
      S: function S(date, token) {
        var numberOfDigits = token.length;
        var milliseconds = date.getUTCMilliseconds();
        var fractionalSeconds = Math.floor(milliseconds * Math.pow(10, numberOfDigits - 3));
        return addLeadingZeros(fractionalSeconds, token.length);
      }
    };

    var dayPeriodEnum = {
      am: 'am',
      pm: 'pm',
      midnight: 'midnight',
      noon: 'noon',
      morning: 'morning',
      afternoon: 'afternoon',
      evening: 'evening',
      night: 'night'
    };

    /*
     * |     | Unit                           |     | Unit                           |
     * |-----|--------------------------------|-----|--------------------------------|
     * |  a  | AM, PM                         |  A* | Milliseconds in day            |
     * |  b  | AM, PM, noon, midnight         |  B  | Flexible day period            |
     * |  c  | Stand-alone local day of week  |  C* | Localized hour w/ day period   |
     * |  d  | Day of month                   |  D  | Day of year                    |
     * |  e  | Local day of week              |  E  | Day of week                    |
     * |  f  |                                |  F* | Day of week in month           |
     * |  g* | Modified Julian day            |  G  | Era                            |
     * |  h  | Hour [1-12]                    |  H  | Hour [0-23]                    |
     * |  i! | ISO day of week                |  I! | ISO week of year               |
     * |  j* | Localized hour w/ day period   |  J* | Localized hour w/o day period  |
     * |  k  | Hour [1-24]                    |  K  | Hour [0-11]                    |
     * |  l* | (deprecated)                   |  L  | Stand-alone month              |
     * |  m  | Minute                         |  M  | Month                          |
     * |  n  |                                |  N  |                                |
     * |  o! | Ordinal number modifier        |  O  | Timezone (GMT)                 |
     * |  p! | Long localized time            |  P! | Long localized date            |
     * |  q  | Stand-alone quarter            |  Q  | Quarter                        |
     * |  r* | Related Gregorian year         |  R! | ISO week-numbering year        |
     * |  s  | Second                         |  S  | Fraction of second             |
     * |  t! | Seconds timestamp              |  T! | Milliseconds timestamp         |
     * |  u  | Extended year                  |  U* | Cyclic year                    |
     * |  v* | Timezone (generic non-locat.)  |  V* | Timezone (location)            |
     * |  w  | Local week of year             |  W* | Week of month                  |
     * |  x  | Timezone (ISO-8601 w/o Z)      |  X  | Timezone (ISO-8601)            |
     * |  y  | Year (abs)                     |  Y  | Local week-numbering year      |
     * |  z  | Timezone (specific non-locat.) |  Z* | Timezone (aliases)             |
     *
     * Letters marked by * are not implemented but reserved by Unicode standard.
     *
     * Letters marked by ! are non-standard, but implemented by date-fns:
     * - `o` modifies the previous token to turn it into an ordinal (see `format` docs)
     * - `i` is ISO day of week. For `i` and `ii` is returns numeric ISO week days,
     *   i.e. 7 for Sunday, 1 for Monday, etc.
     * - `I` is ISO week of year, as opposed to `w` which is local week of year.
     * - `R` is ISO week-numbering year, as opposed to `Y` which is local week-numbering year.
     *   `R` is supposed to be used in conjunction with `I` and `i`
     *   for universal ISO week-numbering date, whereas
     *   `Y` is supposed to be used in conjunction with `w` and `e`
     *   for week-numbering date specific to the locale.
     * - `P` is long localized date format
     * - `p` is long localized time format
     */
    var formatters = {
      // Era
      G: function G(date, token, localize) {
        var era = date.getUTCFullYear() > 0 ? 1 : 0;

        switch (token) {
          // AD, BC
          case 'G':
          case 'GG':
          case 'GGG':
            return localize.era(era, {
              width: 'abbreviated'
            });
          // A, B

          case 'GGGGG':
            return localize.era(era, {
              width: 'narrow'
            });
          // Anno Domini, Before Christ

          case 'GGGG':
          default:
            return localize.era(era, {
              width: 'wide'
            });
        }
      },
      // Year
      y: function y(date, token, localize) {
        // Ordinal number
        if (token === 'yo') {
          var signedYear = date.getUTCFullYear(); // Returns 1 for 1 BC (which is year 0 in JavaScript)

          var year = signedYear > 0 ? signedYear : 1 - signedYear;
          return localize.ordinalNumber(year, {
            unit: 'year'
          });
        }

        return formatters$1.y(date, token);
      },
      // Local week-numbering year
      Y: function Y(date, token, localize, options) {
        var signedWeekYear = getUTCWeekYear(date, options); // Returns 1 for 1 BC (which is year 0 in JavaScript)

        var weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear; // Two digit year

        if (token === 'YY') {
          var twoDigitYear = weekYear % 100;
          return addLeadingZeros(twoDigitYear, 2);
        } // Ordinal number


        if (token === 'Yo') {
          return localize.ordinalNumber(weekYear, {
            unit: 'year'
          });
        } // Padding


        return addLeadingZeros(weekYear, token.length);
      },
      // ISO week-numbering year
      R: function R(date, token) {
        var isoWeekYear = getUTCISOWeekYear(date); // Padding

        return addLeadingZeros(isoWeekYear, token.length);
      },
      // Extended year. This is a single number designating the year of this calendar system.
      // The main difference between `y` and `u` localizers are B.C. years:
      // | Year | `y` | `u` |
      // |------|-----|-----|
      // | AC 1 |   1 |   1 |
      // | BC 1 |   1 |   0 |
      // | BC 2 |   2 |  -1 |
      // Also `yy` always returns the last two digits of a year,
      // while `uu` pads single digit years to 2 characters and returns other years unchanged.
      u: function u(date, token) {
        var year = date.getUTCFullYear();
        return addLeadingZeros(year, token.length);
      },
      // Quarter
      Q: function Q(date, token, localize) {
        var quarter = Math.ceil((date.getUTCMonth() + 1) / 3);

        switch (token) {
          // 1, 2, 3, 4
          case 'Q':
            return String(quarter);
          // 01, 02, 03, 04

          case 'QQ':
            return addLeadingZeros(quarter, 2);
          // 1st, 2nd, 3rd, 4th

          case 'Qo':
            return localize.ordinalNumber(quarter, {
              unit: 'quarter'
            });
          // Q1, Q2, Q3, Q4

          case 'QQQ':
            return localize.quarter(quarter, {
              width: 'abbreviated',
              context: 'formatting'
            });
          // 1, 2, 3, 4 (narrow quarter; could be not numerical)

          case 'QQQQQ':
            return localize.quarter(quarter, {
              width: 'narrow',
              context: 'formatting'
            });
          // 1st quarter, 2nd quarter, ...

          case 'QQQQ':
          default:
            return localize.quarter(quarter, {
              width: 'wide',
              context: 'formatting'
            });
        }
      },
      // Stand-alone quarter
      q: function q(date, token, localize) {
        var quarter = Math.ceil((date.getUTCMonth() + 1) / 3);

        switch (token) {
          // 1, 2, 3, 4
          case 'q':
            return String(quarter);
          // 01, 02, 03, 04

          case 'qq':
            return addLeadingZeros(quarter, 2);
          // 1st, 2nd, 3rd, 4th

          case 'qo':
            return localize.ordinalNumber(quarter, {
              unit: 'quarter'
            });
          // Q1, Q2, Q3, Q4

          case 'qqq':
            return localize.quarter(quarter, {
              width: 'abbreviated',
              context: 'standalone'
            });
          // 1, 2, 3, 4 (narrow quarter; could be not numerical)

          case 'qqqqq':
            return localize.quarter(quarter, {
              width: 'narrow',
              context: 'standalone'
            });
          // 1st quarter, 2nd quarter, ...

          case 'qqqq':
          default:
            return localize.quarter(quarter, {
              width: 'wide',
              context: 'standalone'
            });
        }
      },
      // Month
      M: function M(date, token, localize) {
        var month = date.getUTCMonth();

        switch (token) {
          case 'M':
          case 'MM':
            return formatters$1.M(date, token);
          // 1st, 2nd, ..., 12th

          case 'Mo':
            return localize.ordinalNumber(month + 1, {
              unit: 'month'
            });
          // Jan, Feb, ..., Dec

          case 'MMM':
            return localize.month(month, {
              width: 'abbreviated',
              context: 'formatting'
            });
          // J, F, ..., D

          case 'MMMMM':
            return localize.month(month, {
              width: 'narrow',
              context: 'formatting'
            });
          // January, February, ..., December

          case 'MMMM':
          default:
            return localize.month(month, {
              width: 'wide',
              context: 'formatting'
            });
        }
      },
      // Stand-alone month
      L: function L(date, token, localize) {
        var month = date.getUTCMonth();

        switch (token) {
          // 1, 2, ..., 12
          case 'L':
            return String(month + 1);
          // 01, 02, ..., 12

          case 'LL':
            return addLeadingZeros(month + 1, 2);
          // 1st, 2nd, ..., 12th

          case 'Lo':
            return localize.ordinalNumber(month + 1, {
              unit: 'month'
            });
          // Jan, Feb, ..., Dec

          case 'LLL':
            return localize.month(month, {
              width: 'abbreviated',
              context: 'standalone'
            });
          // J, F, ..., D

          case 'LLLLL':
            return localize.month(month, {
              width: 'narrow',
              context: 'standalone'
            });
          // January, February, ..., December

          case 'LLLL':
          default:
            return localize.month(month, {
              width: 'wide',
              context: 'standalone'
            });
        }
      },
      // Local week of year
      w: function w(date, token, localize, options) {
        var week = getUTCWeek(date, options);

        if (token === 'wo') {
          return localize.ordinalNumber(week, {
            unit: 'week'
          });
        }

        return addLeadingZeros(week, token.length);
      },
      // ISO week of year
      I: function I(date, token, localize) {
        var isoWeek = getUTCISOWeek(date);

        if (token === 'Io') {
          return localize.ordinalNumber(isoWeek, {
            unit: 'week'
          });
        }

        return addLeadingZeros(isoWeek, token.length);
      },
      // Day of the month
      d: function d(date, token, localize) {
        if (token === 'do') {
          return localize.ordinalNumber(date.getUTCDate(), {
            unit: 'date'
          });
        }

        return formatters$1.d(date, token);
      },
      // Day of year
      D: function D(date, token, localize) {
        var dayOfYear = getUTCDayOfYear(date);

        if (token === 'Do') {
          return localize.ordinalNumber(dayOfYear, {
            unit: 'dayOfYear'
          });
        }

        return addLeadingZeros(dayOfYear, token.length);
      },
      // Day of week
      E: function E(date, token, localize) {
        var dayOfWeek = date.getUTCDay();

        switch (token) {
          // Tue
          case 'E':
          case 'EE':
          case 'EEE':
            return localize.day(dayOfWeek, {
              width: 'abbreviated',
              context: 'formatting'
            });
          // T

          case 'EEEEE':
            return localize.day(dayOfWeek, {
              width: 'narrow',
              context: 'formatting'
            });
          // Tu

          case 'EEEEEE':
            return localize.day(dayOfWeek, {
              width: 'short',
              context: 'formatting'
            });
          // Tuesday

          case 'EEEE':
          default:
            return localize.day(dayOfWeek, {
              width: 'wide',
              context: 'formatting'
            });
        }
      },
      // Local day of week
      e: function e(date, token, localize, options) {
        var dayOfWeek = date.getUTCDay();
        var localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;

        switch (token) {
          // Numerical value (Nth day of week with current locale or weekStartsOn)
          case 'e':
            return String(localDayOfWeek);
          // Padded numerical value

          case 'ee':
            return addLeadingZeros(localDayOfWeek, 2);
          // 1st, 2nd, ..., 7th

          case 'eo':
            return localize.ordinalNumber(localDayOfWeek, {
              unit: 'day'
            });

          case 'eee':
            return localize.day(dayOfWeek, {
              width: 'abbreviated',
              context: 'formatting'
            });
          // T

          case 'eeeee':
            return localize.day(dayOfWeek, {
              width: 'narrow',
              context: 'formatting'
            });
          // Tu

          case 'eeeeee':
            return localize.day(dayOfWeek, {
              width: 'short',
              context: 'formatting'
            });
          // Tuesday

          case 'eeee':
          default:
            return localize.day(dayOfWeek, {
              width: 'wide',
              context: 'formatting'
            });
        }
      },
      // Stand-alone local day of week
      c: function c(date, token, localize, options) {
        var dayOfWeek = date.getUTCDay();
        var localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;

        switch (token) {
          // Numerical value (same as in `e`)
          case 'c':
            return String(localDayOfWeek);
          // Padded numerical value

          case 'cc':
            return addLeadingZeros(localDayOfWeek, token.length);
          // 1st, 2nd, ..., 7th

          case 'co':
            return localize.ordinalNumber(localDayOfWeek, {
              unit: 'day'
            });

          case 'ccc':
            return localize.day(dayOfWeek, {
              width: 'abbreviated',
              context: 'standalone'
            });
          // T

          case 'ccccc':
            return localize.day(dayOfWeek, {
              width: 'narrow',
              context: 'standalone'
            });
          // Tu

          case 'cccccc':
            return localize.day(dayOfWeek, {
              width: 'short',
              context: 'standalone'
            });
          // Tuesday

          case 'cccc':
          default:
            return localize.day(dayOfWeek, {
              width: 'wide',
              context: 'standalone'
            });
        }
      },
      // ISO day of week
      i: function i(date, token, localize) {
        var dayOfWeek = date.getUTCDay();
        var isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

        switch (token) {
          // 2
          case 'i':
            return String(isoDayOfWeek);
          // 02

          case 'ii':
            return addLeadingZeros(isoDayOfWeek, token.length);
          // 2nd

          case 'io':
            return localize.ordinalNumber(isoDayOfWeek, {
              unit: 'day'
            });
          // Tue

          case 'iii':
            return localize.day(dayOfWeek, {
              width: 'abbreviated',
              context: 'formatting'
            });
          // T

          case 'iiiii':
            return localize.day(dayOfWeek, {
              width: 'narrow',
              context: 'formatting'
            });
          // Tu

          case 'iiiiii':
            return localize.day(dayOfWeek, {
              width: 'short',
              context: 'formatting'
            });
          // Tuesday

          case 'iiii':
          default:
            return localize.day(dayOfWeek, {
              width: 'wide',
              context: 'formatting'
            });
        }
      },
      // AM or PM
      a: function a(date, token, localize) {
        var hours = date.getUTCHours();
        var dayPeriodEnumValue = hours / 12 >= 1 ? 'pm' : 'am';

        switch (token) {
          case 'a':
          case 'aa':
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'abbreviated',
              context: 'formatting'
            });

          case 'aaa':
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'abbreviated',
              context: 'formatting'
            }).toLowerCase();

          case 'aaaaa':
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'narrow',
              context: 'formatting'
            });

          case 'aaaa':
          default:
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'wide',
              context: 'formatting'
            });
        }
      },
      // AM, PM, midnight, noon
      b: function b(date, token, localize) {
        var hours = date.getUTCHours();
        var dayPeriodEnumValue;

        if (hours === 12) {
          dayPeriodEnumValue = dayPeriodEnum.noon;
        } else if (hours === 0) {
          dayPeriodEnumValue = dayPeriodEnum.midnight;
        } else {
          dayPeriodEnumValue = hours / 12 >= 1 ? 'pm' : 'am';
        }

        switch (token) {
          case 'b':
          case 'bb':
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'abbreviated',
              context: 'formatting'
            });

          case 'bbb':
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'abbreviated',
              context: 'formatting'
            }).toLowerCase();

          case 'bbbbb':
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'narrow',
              context: 'formatting'
            });

          case 'bbbb':
          default:
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'wide',
              context: 'formatting'
            });
        }
      },
      // in the morning, in the afternoon, in the evening, at night
      B: function B(date, token, localize) {
        var hours = date.getUTCHours();
        var dayPeriodEnumValue;

        if (hours >= 17) {
          dayPeriodEnumValue = dayPeriodEnum.evening;
        } else if (hours >= 12) {
          dayPeriodEnumValue = dayPeriodEnum.afternoon;
        } else if (hours >= 4) {
          dayPeriodEnumValue = dayPeriodEnum.morning;
        } else {
          dayPeriodEnumValue = dayPeriodEnum.night;
        }

        switch (token) {
          case 'B':
          case 'BB':
          case 'BBB':
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'abbreviated',
              context: 'formatting'
            });

          case 'BBBBB':
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'narrow',
              context: 'formatting'
            });

          case 'BBBB':
          default:
            return localize.dayPeriod(dayPeriodEnumValue, {
              width: 'wide',
              context: 'formatting'
            });
        }
      },
      // Hour [1-12]
      h: function h(date, token, localize) {
        if (token === 'ho') {
          var hours = date.getUTCHours() % 12;
          if (hours === 0) hours = 12;
          return localize.ordinalNumber(hours, {
            unit: 'hour'
          });
        }

        return formatters$1.h(date, token);
      },
      // Hour [0-23]
      H: function H(date, token, localize) {
        if (token === 'Ho') {
          return localize.ordinalNumber(date.getUTCHours(), {
            unit: 'hour'
          });
        }

        return formatters$1.H(date, token);
      },
      // Hour [0-11]
      K: function K(date, token, localize) {
        var hours = date.getUTCHours() % 12;

        if (token === 'Ko') {
          return localize.ordinalNumber(hours, {
            unit: 'hour'
          });
        }

        return addLeadingZeros(hours, token.length);
      },
      // Hour [1-24]
      k: function k(date, token, localize) {
        var hours = date.getUTCHours();
        if (hours === 0) hours = 24;

        if (token === 'ko') {
          return localize.ordinalNumber(hours, {
            unit: 'hour'
          });
        }

        return addLeadingZeros(hours, token.length);
      },
      // Minute
      m: function m(date, token, localize) {
        if (token === 'mo') {
          return localize.ordinalNumber(date.getUTCMinutes(), {
            unit: 'minute'
          });
        }

        return formatters$1.m(date, token);
      },
      // Second
      s: function s(date, token, localize) {
        if (token === 'so') {
          return localize.ordinalNumber(date.getUTCSeconds(), {
            unit: 'second'
          });
        }

        return formatters$1.s(date, token);
      },
      // Fraction of second
      S: function S(date, token) {
        return formatters$1.S(date, token);
      },
      // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
      X: function X(date, token, _localize, options) {
        var originalDate = options._originalDate || date;
        var timezoneOffset = originalDate.getTimezoneOffset();

        if (timezoneOffset === 0) {
          return 'Z';
        }

        switch (token) {
          // Hours and optional minutes
          case 'X':
            return formatTimezoneWithOptionalMinutes(timezoneOffset);
          // Hours, minutes and optional seconds without `:` delimiter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `XX`

          case 'XXXX':
          case 'XX':
            // Hours and minutes without `:` delimiter
            return formatTimezone(timezoneOffset);
          // Hours, minutes and optional seconds with `:` delimiter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `XXX`

          case 'XXXXX':
          case 'XXX': // Hours and minutes with `:` delimiter

          default:
            return formatTimezone(timezoneOffset, ':');
        }
      },
      // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
      x: function x(date, token, _localize, options) {
        var originalDate = options._originalDate || date;
        var timezoneOffset = originalDate.getTimezoneOffset();

        switch (token) {
          // Hours and optional minutes
          case 'x':
            return formatTimezoneWithOptionalMinutes(timezoneOffset);
          // Hours, minutes and optional seconds without `:` delimiter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `xx`

          case 'xxxx':
          case 'xx':
            // Hours and minutes without `:` delimiter
            return formatTimezone(timezoneOffset);
          // Hours, minutes and optional seconds with `:` delimiter
          // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
          // so this token always has the same output as `xxx`

          case 'xxxxx':
          case 'xxx': // Hours and minutes with `:` delimiter

          default:
            return formatTimezone(timezoneOffset, ':');
        }
      },
      // Timezone (GMT)
      O: function O(date, token, _localize, options) {
        var originalDate = options._originalDate || date;
        var timezoneOffset = originalDate.getTimezoneOffset();

        switch (token) {
          // Short
          case 'O':
          case 'OO':
          case 'OOO':
            return 'GMT' + formatTimezoneShort(timezoneOffset, ':');
          // Long

          case 'OOOO':
          default:
            return 'GMT' + formatTimezone(timezoneOffset, ':');
        }
      },
      // Timezone (specific non-location)
      z: function z(date, token, _localize, options) {
        var originalDate = options._originalDate || date;
        var timezoneOffset = originalDate.getTimezoneOffset();

        switch (token) {
          // Short
          case 'z':
          case 'zz':
          case 'zzz':
            return 'GMT' + formatTimezoneShort(timezoneOffset, ':');
          // Long

          case 'zzzz':
          default:
            return 'GMT' + formatTimezone(timezoneOffset, ':');
        }
      },
      // Seconds timestamp
      t: function t(date, token, _localize, options) {
        var originalDate = options._originalDate || date;
        var timestamp = Math.floor(originalDate.getTime() / 1000);
        return addLeadingZeros(timestamp, token.length);
      },
      // Milliseconds timestamp
      T: function T(date, token, _localize, options) {
        var originalDate = options._originalDate || date;
        var timestamp = originalDate.getTime();
        return addLeadingZeros(timestamp, token.length);
      }
    };

    function formatTimezoneShort(offset, dirtyDelimiter) {
      var sign = offset > 0 ? '-' : '+';
      var absOffset = Math.abs(offset);
      var hours = Math.floor(absOffset / 60);
      var minutes = absOffset % 60;

      if (minutes === 0) {
        return sign + String(hours);
      }

      var delimiter = dirtyDelimiter || '';
      return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
    }

    function formatTimezoneWithOptionalMinutes(offset, dirtyDelimiter) {
      if (offset % 60 === 0) {
        var sign = offset > 0 ? '-' : '+';
        return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
      }

      return formatTimezone(offset, dirtyDelimiter);
    }

    function formatTimezone(offset, dirtyDelimiter) {
      var delimiter = dirtyDelimiter || '';
      var sign = offset > 0 ? '-' : '+';
      var absOffset = Math.abs(offset);
      var hours = addLeadingZeros(Math.floor(absOffset / 60), 2);
      var minutes = addLeadingZeros(absOffset % 60, 2);
      return sign + hours + delimiter + minutes;
    }

    var dateLongFormatter = function dateLongFormatter(pattern, formatLong) {
      switch (pattern) {
        case 'P':
          return formatLong.date({
            width: 'short'
          });

        case 'PP':
          return formatLong.date({
            width: 'medium'
          });

        case 'PPP':
          return formatLong.date({
            width: 'long'
          });

        case 'PPPP':
        default:
          return formatLong.date({
            width: 'full'
          });
      }
    };

    var timeLongFormatter = function timeLongFormatter(pattern, formatLong) {
      switch (pattern) {
        case 'p':
          return formatLong.time({
            width: 'short'
          });

        case 'pp':
          return formatLong.time({
            width: 'medium'
          });

        case 'ppp':
          return formatLong.time({
            width: 'long'
          });

        case 'pppp':
        default:
          return formatLong.time({
            width: 'full'
          });
      }
    };

    var dateTimeLongFormatter = function dateTimeLongFormatter(pattern, formatLong) {
      var matchResult = pattern.match(/(P+)(p+)?/) || [];
      var datePattern = matchResult[1];
      var timePattern = matchResult[2];

      if (!timePattern) {
        return dateLongFormatter(pattern, formatLong);
      }

      var dateTimeFormat;

      switch (datePattern) {
        case 'P':
          dateTimeFormat = formatLong.dateTime({
            width: 'short'
          });
          break;

        case 'PP':
          dateTimeFormat = formatLong.dateTime({
            width: 'medium'
          });
          break;

        case 'PPP':
          dateTimeFormat = formatLong.dateTime({
            width: 'long'
          });
          break;

        case 'PPPP':
        default:
          dateTimeFormat = formatLong.dateTime({
            width: 'full'
          });
          break;
      }

      return dateTimeFormat.replace('{{date}}', dateLongFormatter(datePattern, formatLong)).replace('{{time}}', timeLongFormatter(timePattern, formatLong));
    };

    var longFormatters = {
      p: timeLongFormatter,
      P: dateTimeLongFormatter
    };

    var protectedDayOfYearTokens = ['D', 'DD'];
    var protectedWeekYearTokens = ['YY', 'YYYY'];
    function isProtectedDayOfYearToken(token) {
      return protectedDayOfYearTokens.indexOf(token) !== -1;
    }
    function isProtectedWeekYearToken(token) {
      return protectedWeekYearTokens.indexOf(token) !== -1;
    }
    function throwProtectedError(token, format, input) {
      if (token === 'YYYY') {
        throw new RangeError("Use `yyyy` instead of `YYYY` (in `".concat(format, "`) for formatting years to the input `").concat(input, "`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md"));
      } else if (token === 'YY') {
        throw new RangeError("Use `yy` instead of `YY` (in `".concat(format, "`) for formatting years to the input `").concat(input, "`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md"));
      } else if (token === 'D') {
        throw new RangeError("Use `d` instead of `D` (in `".concat(format, "`) for formatting days of the month to the input `").concat(input, "`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md"));
      } else if (token === 'DD') {
        throw new RangeError("Use `dd` instead of `DD` (in `".concat(format, "`) for formatting days of the month to the input `").concat(input, "`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md"));
      }
    }

    var formatDistanceLocale = {
      lessThanXSeconds: {
        one: 'less than a second',
        other: 'less than {{count}} seconds'
      },
      xSeconds: {
        one: '1 second',
        other: '{{count}} seconds'
      },
      halfAMinute: 'half a minute',
      lessThanXMinutes: {
        one: 'less than a minute',
        other: 'less than {{count}} minutes'
      },
      xMinutes: {
        one: '1 minute',
        other: '{{count}} minutes'
      },
      aboutXHours: {
        one: 'about 1 hour',
        other: 'about {{count}} hours'
      },
      xHours: {
        one: '1 hour',
        other: '{{count}} hours'
      },
      xDays: {
        one: '1 day',
        other: '{{count}} days'
      },
      aboutXWeeks: {
        one: 'about 1 week',
        other: 'about {{count}} weeks'
      },
      xWeeks: {
        one: '1 week',
        other: '{{count}} weeks'
      },
      aboutXMonths: {
        one: 'about 1 month',
        other: 'about {{count}} months'
      },
      xMonths: {
        one: '1 month',
        other: '{{count}} months'
      },
      aboutXYears: {
        one: 'about 1 year',
        other: 'about {{count}} years'
      },
      xYears: {
        one: '1 year',
        other: '{{count}} years'
      },
      overXYears: {
        one: 'over 1 year',
        other: 'over {{count}} years'
      },
      almostXYears: {
        one: 'almost 1 year',
        other: 'almost {{count}} years'
      }
    };

    var formatDistance = function formatDistance(token, count, options) {
      var result;
      var tokenValue = formatDistanceLocale[token];

      if (typeof tokenValue === 'string') {
        result = tokenValue;
      } else if (count === 1) {
        result = tokenValue.one;
      } else {
        result = tokenValue.other.replace('{{count}}', count.toString());
      }

      if (options !== null && options !== void 0 && options.addSuffix) {
        if (options.comparison && options.comparison > 0) {
          return 'in ' + result;
        } else {
          return result + ' ago';
        }
      }

      return result;
    };

    function buildFormatLongFn(args) {
      return function () {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        // TODO: Remove String()
        var width = options.width ? String(options.width) : args.defaultWidth;
        var format = args.formats[width] || args.formats[args.defaultWidth];
        return format;
      };
    }

    var dateFormats = {
      full: 'EEEE, MMMM do, y',
      long: 'MMMM do, y',
      medium: 'MMM d, y',
      short: 'MM/dd/yyyy'
    };
    var timeFormats = {
      full: 'h:mm:ss a zzzz',
      long: 'h:mm:ss a z',
      medium: 'h:mm:ss a',
      short: 'h:mm a'
    };
    var dateTimeFormats = {
      full: "{{date}} 'at' {{time}}",
      long: "{{date}} 'at' {{time}}",
      medium: '{{date}}, {{time}}',
      short: '{{date}}, {{time}}'
    };
    var formatLong = {
      date: buildFormatLongFn({
        formats: dateFormats,
        defaultWidth: 'full'
      }),
      time: buildFormatLongFn({
        formats: timeFormats,
        defaultWidth: 'full'
      }),
      dateTime: buildFormatLongFn({
        formats: dateTimeFormats,
        defaultWidth: 'full'
      })
    };

    var formatRelativeLocale = {
      lastWeek: "'last' eeee 'at' p",
      yesterday: "'yesterday at' p",
      today: "'today at' p",
      tomorrow: "'tomorrow at' p",
      nextWeek: "eeee 'at' p",
      other: 'P'
    };

    var formatRelative = function formatRelative(token, _date, _baseDate, _options) {
      return formatRelativeLocale[token];
    };

    function buildLocalizeFn(args) {
      return function (dirtyIndex, options) {
        var context = options !== null && options !== void 0 && options.context ? String(options.context) : 'standalone';
        var valuesArray;

        if (context === 'formatting' && args.formattingValues) {
          var defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
          var width = options !== null && options !== void 0 && options.width ? String(options.width) : defaultWidth;
          valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
        } else {
          var _defaultWidth = args.defaultWidth;

          var _width = options !== null && options !== void 0 && options.width ? String(options.width) : args.defaultWidth;

          valuesArray = args.values[_width] || args.values[_defaultWidth];
        }

        var index = args.argumentCallback ? args.argumentCallback(dirtyIndex) : dirtyIndex; // @ts-ignore: For some reason TypeScript just don't want to match it, no matter how hard we try. I challenge you to try to remove it!

        return valuesArray[index];
      };
    }

    var eraValues = {
      narrow: ['B', 'A'],
      abbreviated: ['BC', 'AD'],
      wide: ['Before Christ', 'Anno Domini']
    };
    var quarterValues = {
      narrow: ['1', '2', '3', '4'],
      abbreviated: ['Q1', 'Q2', 'Q3', 'Q4'],
      wide: ['1st quarter', '2nd quarter', '3rd quarter', '4th quarter']
    }; // Note: in English, the names of days of the week and months are capitalized.
    // If you are making a new locale based on this one, check if the same is true for the language you're working on.
    // Generally, formatted dates should look like they are in the middle of a sentence,
    // e.g. in Spanish language the weekdays and months should be in the lowercase.

    var monthValues$3 = {
      narrow: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
      abbreviated: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      wide: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    };
    var dayValues$1 = {
      narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      short: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
      abbreviated: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      wide: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    };
    var dayPeriodValues = {
      narrow: {
        am: 'a',
        pm: 'p',
        midnight: 'mi',
        noon: 'n',
        morning: 'morning',
        afternoon: 'afternoon',
        evening: 'evening',
        night: 'night'
      },
      abbreviated: {
        am: 'AM',
        pm: 'PM',
        midnight: 'midnight',
        noon: 'noon',
        morning: 'morning',
        afternoon: 'afternoon',
        evening: 'evening',
        night: 'night'
      },
      wide: {
        am: 'a.m.',
        pm: 'p.m.',
        midnight: 'midnight',
        noon: 'noon',
        morning: 'morning',
        afternoon: 'afternoon',
        evening: 'evening',
        night: 'night'
      }
    };
    var formattingDayPeriodValues = {
      narrow: {
        am: 'a',
        pm: 'p',
        midnight: 'mi',
        noon: 'n',
        morning: 'in the morning',
        afternoon: 'in the afternoon',
        evening: 'in the evening',
        night: 'at night'
      },
      abbreviated: {
        am: 'AM',
        pm: 'PM',
        midnight: 'midnight',
        noon: 'noon',
        morning: 'in the morning',
        afternoon: 'in the afternoon',
        evening: 'in the evening',
        night: 'at night'
      },
      wide: {
        am: 'a.m.',
        pm: 'p.m.',
        midnight: 'midnight',
        noon: 'noon',
        morning: 'in the morning',
        afternoon: 'in the afternoon',
        evening: 'in the evening',
        night: 'at night'
      }
    };

    var ordinalNumber = function ordinalNumber(dirtyNumber, _options) {
      var number = Number(dirtyNumber); // If ordinal numbers depend on context, for example,
      // if they are different for different grammatical genders,
      // use `options.unit`.
      //
      // `unit` can be 'year', 'quarter', 'month', 'week', 'date', 'dayOfYear',
      // 'day', 'hour', 'minute', 'second'.

      var rem100 = number % 100;

      if (rem100 > 20 || rem100 < 10) {
        switch (rem100 % 10) {
          case 1:
            return number + 'st';

          case 2:
            return number + 'nd';

          case 3:
            return number + 'rd';
        }
      }

      return number + 'th';
    };

    var localize = {
      ordinalNumber: ordinalNumber,
      era: buildLocalizeFn({
        values: eraValues,
        defaultWidth: 'wide'
      }),
      quarter: buildLocalizeFn({
        values: quarterValues,
        defaultWidth: 'wide',
        argumentCallback: function argumentCallback(quarter) {
          return quarter - 1;
        }
      }),
      month: buildLocalizeFn({
        values: monthValues$3,
        defaultWidth: 'wide'
      }),
      day: buildLocalizeFn({
        values: dayValues$1,
        defaultWidth: 'wide'
      }),
      dayPeriod: buildLocalizeFn({
        values: dayPeriodValues,
        defaultWidth: 'wide',
        formattingValues: formattingDayPeriodValues,
        defaultFormattingWidth: 'wide'
      })
    };

    function buildMatchFn(args) {
      return function (string) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var width = options.width;
        var matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
        var matchResult = string.match(matchPattern);

        if (!matchResult) {
          return null;
        }

        var matchedString = matchResult[0];
        var parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
        var key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, function (pattern) {
          return pattern.test(matchedString);
        }) : findKey(parsePatterns, function (pattern) {
          return pattern.test(matchedString);
        });
        var value;
        value = args.valueCallback ? args.valueCallback(key) : key;
        value = options.valueCallback ? options.valueCallback(value) : value;
        var rest = string.slice(matchedString.length);
        return {
          value: value,
          rest: rest
        };
      };
    }

    function findKey(object, predicate) {
      for (var key in object) {
        if (object.hasOwnProperty(key) && predicate(object[key])) {
          return key;
        }
      }

      return undefined;
    }

    function findIndex(array, predicate) {
      for (var key = 0; key < array.length; key++) {
        if (predicate(array[key])) {
          return key;
        }
      }

      return undefined;
    }

    function buildMatchPatternFn(args) {
      return function (string) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var matchResult = string.match(args.matchPattern);
        if (!matchResult) return null;
        var matchedString = matchResult[0];
        var parseResult = string.match(args.parsePattern);
        if (!parseResult) return null;
        var value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
        value = options.valueCallback ? options.valueCallback(value) : value;
        var rest = string.slice(matchedString.length);
        return {
          value: value,
          rest: rest
        };
      };
    }

    var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
    var parseOrdinalNumberPattern = /\d+/i;
    var matchEraPatterns = {
      narrow: /^(b|a)/i,
      abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
      wide: /^(before christ|before common era|anno domini|common era)/i
    };
    var parseEraPatterns = {
      any: [/^b/i, /^(a|c)/i]
    };
    var matchQuarterPatterns = {
      narrow: /^[1234]/i,
      abbreviated: /^q[1234]/i,
      wide: /^[1234](th|st|nd|rd)? quarter/i
    };
    var parseQuarterPatterns = {
      any: [/1/i, /2/i, /3/i, /4/i]
    };
    var matchMonthPatterns = {
      narrow: /^[jfmasond]/i,
      abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
      wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
    };
    var parseMonthPatterns = {
      narrow: [/^j/i, /^f/i, /^m/i, /^a/i, /^m/i, /^j/i, /^j/i, /^a/i, /^s/i, /^o/i, /^n/i, /^d/i],
      any: [/^ja/i, /^f/i, /^mar/i, /^ap/i, /^may/i, /^jun/i, /^jul/i, /^au/i, /^s/i, /^o/i, /^n/i, /^d/i]
    };
    var matchDayPatterns = {
      narrow: /^[smtwf]/i,
      short: /^(su|mo|tu|we|th|fr|sa)/i,
      abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
      wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
    };
    var parseDayPatterns = {
      narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
      any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
    };
    var matchDayPeriodPatterns = {
      narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
      any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
    };
    var parseDayPeriodPatterns = {
      any: {
        am: /^a/i,
        pm: /^p/i,
        midnight: /^mi/i,
        noon: /^no/i,
        morning: /morning/i,
        afternoon: /afternoon/i,
        evening: /evening/i,
        night: /night/i
      }
    };
    var match = {
      ordinalNumber: buildMatchPatternFn({
        matchPattern: matchOrdinalNumberPattern,
        parsePattern: parseOrdinalNumberPattern,
        valueCallback: function valueCallback(value) {
          return parseInt(value, 10);
        }
      }),
      era: buildMatchFn({
        matchPatterns: matchEraPatterns,
        defaultMatchWidth: 'wide',
        parsePatterns: parseEraPatterns,
        defaultParseWidth: 'any'
      }),
      quarter: buildMatchFn({
        matchPatterns: matchQuarterPatterns,
        defaultMatchWidth: 'wide',
        parsePatterns: parseQuarterPatterns,
        defaultParseWidth: 'any',
        valueCallback: function valueCallback(index) {
          return index + 1;
        }
      }),
      month: buildMatchFn({
        matchPatterns: matchMonthPatterns,
        defaultMatchWidth: 'wide',
        parsePatterns: parseMonthPatterns,
        defaultParseWidth: 'any'
      }),
      day: buildMatchFn({
        matchPatterns: matchDayPatterns,
        defaultMatchWidth: 'wide',
        parsePatterns: parseDayPatterns,
        defaultParseWidth: 'any'
      }),
      dayPeriod: buildMatchFn({
        matchPatterns: matchDayPeriodPatterns,
        defaultMatchWidth: 'any',
        parsePatterns: parseDayPeriodPatterns,
        defaultParseWidth: 'any'
      })
    };

    /**
     * @type {Locale}
     * @category Locales
     * @summary English locale (United States).
     * @language English
     * @iso-639-2 eng
     * @author Sasha Koss [@kossnocorp]{@link https://github.com/kossnocorp}
     * @author Lesha Koss [@leshakoss]{@link https://github.com/leshakoss}
     */
    var locale = {
      code: 'en-US',
      formatDistance: formatDistance,
      formatLong: formatLong,
      formatRelative: formatRelative,
      localize: localize,
      match: match,
      options: {
        weekStartsOn: 0
        /* Sunday */
        ,
        firstWeekContainsDate: 1
      }
    };

    // - [yYQqMLwIdDecihHKkms]o matches any available ordinal number token
    //   (one of the certain letters followed by `o`)
    // - (\w)\1* matches any sequences of the same letter
    // - '' matches two quote characters in a row
    // - '(''|[^'])+('|$) matches anything surrounded by two quote characters ('),
    //   except a single quote symbol, which ends the sequence.
    //   Two quote characters do not end the sequence.
    //   If there is no matching single quote
    //   then the sequence will continue until the end of the string.
    // - . matches any single character unmatched by previous parts of the RegExps

    var formattingTokensRegExp$1 = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g; // This RegExp catches symbols escaped by quotes, and also
    // sequences of symbols P, p, and the combinations like `PPPPPPPppppp`

    var longFormattingTokensRegExp$1 = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
    var escapedStringRegExp$1 = /^'([^]*?)'?$/;
    var doubleQuoteRegExp$1 = /''/g;
    var unescapedLatinCharacterRegExp$1 = /[a-zA-Z]/;
    /**
     * @name format
     * @category Common Helpers
     * @summary Format the date.
     *
     * @description
     * Return the formatted date string in the given format. The result may vary by locale.
     *
     * > ⚠️ Please note that the `format` tokens differ from Moment.js and other libraries.
     * > See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     *
     * The characters wrapped between two single quotes characters (') are escaped.
     * Two single quotes in a row, whether inside or outside a quoted sequence, represent a 'real' single quote.
     * (see the last example)
     *
     * Format of the string is based on Unicode Technical Standard #35:
     * https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
     * with a few additions (see note 7 below the table).
     *
     * Accepted patterns:
     * | Unit                            | Pattern | Result examples                   | Notes |
     * |---------------------------------|---------|-----------------------------------|-------|
     * | Era                             | G..GGG  | AD, BC                            |       |
     * |                                 | GGGG    | Anno Domini, Before Christ        | 2     |
     * |                                 | GGGGG   | A, B                              |       |
     * | Calendar year                   | y       | 44, 1, 1900, 2017                 | 5     |
     * |                                 | yo      | 44th, 1st, 0th, 17th              | 5,7   |
     * |                                 | yy      | 44, 01, 00, 17                    | 5     |
     * |                                 | yyy     | 044, 001, 1900, 2017              | 5     |
     * |                                 | yyyy    | 0044, 0001, 1900, 2017            | 5     |
     * |                                 | yyyyy   | ...                               | 3,5   |
     * | Local week-numbering year       | Y       | 44, 1, 1900, 2017                 | 5     |
     * |                                 | Yo      | 44th, 1st, 1900th, 2017th         | 5,7   |
     * |                                 | YY      | 44, 01, 00, 17                    | 5,8   |
     * |                                 | YYY     | 044, 001, 1900, 2017              | 5     |
     * |                                 | YYYY    | 0044, 0001, 1900, 2017            | 5,8   |
     * |                                 | YYYYY   | ...                               | 3,5   |
     * | ISO week-numbering year         | R       | -43, 0, 1, 1900, 2017             | 5,7   |
     * |                                 | RR      | -43, 00, 01, 1900, 2017           | 5,7   |
     * |                                 | RRR     | -043, 000, 001, 1900, 2017        | 5,7   |
     * |                                 | RRRR    | -0043, 0000, 0001, 1900, 2017     | 5,7   |
     * |                                 | RRRRR   | ...                               | 3,5,7 |
     * | Extended year                   | u       | -43, 0, 1, 1900, 2017             | 5     |
     * |                                 | uu      | -43, 01, 1900, 2017               | 5     |
     * |                                 | uuu     | -043, 001, 1900, 2017             | 5     |
     * |                                 | uuuu    | -0043, 0001, 1900, 2017           | 5     |
     * |                                 | uuuuu   | ...                               | 3,5   |
     * | Quarter (formatting)            | Q       | 1, 2, 3, 4                        |       |
     * |                                 | Qo      | 1st, 2nd, 3rd, 4th                | 7     |
     * |                                 | QQ      | 01, 02, 03, 04                    |       |
     * |                                 | QQQ     | Q1, Q2, Q3, Q4                    |       |
     * |                                 | QQQQ    | 1st quarter, 2nd quarter, ...     | 2     |
     * |                                 | QQQQQ   | 1, 2, 3, 4                        | 4     |
     * | Quarter (stand-alone)           | q       | 1, 2, 3, 4                        |       |
     * |                                 | qo      | 1st, 2nd, 3rd, 4th                | 7     |
     * |                                 | qq      | 01, 02, 03, 04                    |       |
     * |                                 | qqq     | Q1, Q2, Q3, Q4                    |       |
     * |                                 | qqqq    | 1st quarter, 2nd quarter, ...     | 2     |
     * |                                 | qqqqq   | 1, 2, 3, 4                        | 4     |
     * | Month (formatting)              | M       | 1, 2, ..., 12                     |       |
     * |                                 | Mo      | 1st, 2nd, ..., 12th               | 7     |
     * |                                 | MM      | 01, 02, ..., 12                   |       |
     * |                                 | MMM     | Jan, Feb, ..., Dec                |       |
     * |                                 | MMMM    | January, February, ..., December  | 2     |
     * |                                 | MMMMM   | J, F, ..., D                      |       |
     * | Month (stand-alone)             | L       | 1, 2, ..., 12                     |       |
     * |                                 | Lo      | 1st, 2nd, ..., 12th               | 7     |
     * |                                 | LL      | 01, 02, ..., 12                   |       |
     * |                                 | LLL     | Jan, Feb, ..., Dec                |       |
     * |                                 | LLLL    | January, February, ..., December  | 2     |
     * |                                 | LLLLL   | J, F, ..., D                      |       |
     * | Local week of year              | w       | 1, 2, ..., 53                     |       |
     * |                                 | wo      | 1st, 2nd, ..., 53th               | 7     |
     * |                                 | ww      | 01, 02, ..., 53                   |       |
     * | ISO week of year                | I       | 1, 2, ..., 53                     | 7     |
     * |                                 | Io      | 1st, 2nd, ..., 53th               | 7     |
     * |                                 | II      | 01, 02, ..., 53                   | 7     |
     * | Day of month                    | d       | 1, 2, ..., 31                     |       |
     * |                                 | do      | 1st, 2nd, ..., 31st               | 7     |
     * |                                 | dd      | 01, 02, ..., 31                   |       |
     * | Day of year                     | D       | 1, 2, ..., 365, 366               | 9     |
     * |                                 | Do      | 1st, 2nd, ..., 365th, 366th       | 7     |
     * |                                 | DD      | 01, 02, ..., 365, 366             | 9     |
     * |                                 | DDD     | 001, 002, ..., 365, 366           |       |
     * |                                 | DDDD    | ...                               | 3     |
     * | Day of week (formatting)        | E..EEE  | Mon, Tue, Wed, ..., Sun           |       |
     * |                                 | EEEE    | Monday, Tuesday, ..., Sunday      | 2     |
     * |                                 | EEEEE   | M, T, W, T, F, S, S               |       |
     * |                                 | EEEEEE  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
     * | ISO day of week (formatting)    | i       | 1, 2, 3, ..., 7                   | 7     |
     * |                                 | io      | 1st, 2nd, ..., 7th                | 7     |
     * |                                 | ii      | 01, 02, ..., 07                   | 7     |
     * |                                 | iii     | Mon, Tue, Wed, ..., Sun           | 7     |
     * |                                 | iiii    | Monday, Tuesday, ..., Sunday      | 2,7   |
     * |                                 | iiiii   | M, T, W, T, F, S, S               | 7     |
     * |                                 | iiiiii  | Mo, Tu, We, Th, Fr, Sa, Su        | 7     |
     * | Local day of week (formatting)  | e       | 2, 3, 4, ..., 1                   |       |
     * |                                 | eo      | 2nd, 3rd, ..., 1st                | 7     |
     * |                                 | ee      | 02, 03, ..., 01                   |       |
     * |                                 | eee     | Mon, Tue, Wed, ..., Sun           |       |
     * |                                 | eeee    | Monday, Tuesday, ..., Sunday      | 2     |
     * |                                 | eeeee   | M, T, W, T, F, S, S               |       |
     * |                                 | eeeeee  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
     * | Local day of week (stand-alone) | c       | 2, 3, 4, ..., 1                   |       |
     * |                                 | co      | 2nd, 3rd, ..., 1st                | 7     |
     * |                                 | cc      | 02, 03, ..., 01                   |       |
     * |                                 | ccc     | Mon, Tue, Wed, ..., Sun           |       |
     * |                                 | cccc    | Monday, Tuesday, ..., Sunday      | 2     |
     * |                                 | ccccc   | M, T, W, T, F, S, S               |       |
     * |                                 | cccccc  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
     * | AM, PM                          | a..aa   | AM, PM                            |       |
     * |                                 | aaa     | am, pm                            |       |
     * |                                 | aaaa    | a.m., p.m.                        | 2     |
     * |                                 | aaaaa   | a, p                              |       |
     * | AM, PM, noon, midnight          | b..bb   | AM, PM, noon, midnight            |       |
     * |                                 | bbb     | am, pm, noon, midnight            |       |
     * |                                 | bbbb    | a.m., p.m., noon, midnight        | 2     |
     * |                                 | bbbbb   | a, p, n, mi                       |       |
     * | Flexible day period             | B..BBB  | at night, in the morning, ...     |       |
     * |                                 | BBBB    | at night, in the morning, ...     | 2     |
     * |                                 | BBBBB   | at night, in the morning, ...     |       |
     * | Hour [1-12]                     | h       | 1, 2, ..., 11, 12                 |       |
     * |                                 | ho      | 1st, 2nd, ..., 11th, 12th         | 7     |
     * |                                 | hh      | 01, 02, ..., 11, 12               |       |
     * | Hour [0-23]                     | H       | 0, 1, 2, ..., 23                  |       |
     * |                                 | Ho      | 0th, 1st, 2nd, ..., 23rd          | 7     |
     * |                                 | HH      | 00, 01, 02, ..., 23               |       |
     * | Hour [0-11]                     | K       | 1, 2, ..., 11, 0                  |       |
     * |                                 | Ko      | 1st, 2nd, ..., 11th, 0th          | 7     |
     * |                                 | KK      | 01, 02, ..., 11, 00               |       |
     * | Hour [1-24]                     | k       | 24, 1, 2, ..., 23                 |       |
     * |                                 | ko      | 24th, 1st, 2nd, ..., 23rd         | 7     |
     * |                                 | kk      | 24, 01, 02, ..., 23               |       |
     * | Minute                          | m       | 0, 1, ..., 59                     |       |
     * |                                 | mo      | 0th, 1st, ..., 59th               | 7     |
     * |                                 | mm      | 00, 01, ..., 59                   |       |
     * | Second                          | s       | 0, 1, ..., 59                     |       |
     * |                                 | so      | 0th, 1st, ..., 59th               | 7     |
     * |                                 | ss      | 00, 01, ..., 59                   |       |
     * | Fraction of second              | S       | 0, 1, ..., 9                      |       |
     * |                                 | SS      | 00, 01, ..., 99                   |       |
     * |                                 | SSS     | 000, 001, ..., 999                |       |
     * |                                 | SSSS    | ...                               | 3     |
     * | Timezone (ISO-8601 w/ Z)        | X       | -08, +0530, Z                     |       |
     * |                                 | XX      | -0800, +0530, Z                   |       |
     * |                                 | XXX     | -08:00, +05:30, Z                 |       |
     * |                                 | XXXX    | -0800, +0530, Z, +123456          | 2     |
     * |                                 | XXXXX   | -08:00, +05:30, Z, +12:34:56      |       |
     * | Timezone (ISO-8601 w/o Z)       | x       | -08, +0530, +00                   |       |
     * |                                 | xx      | -0800, +0530, +0000               |       |
     * |                                 | xxx     | -08:00, +05:30, +00:00            | 2     |
     * |                                 | xxxx    | -0800, +0530, +0000, +123456      |       |
     * |                                 | xxxxx   | -08:00, +05:30, +00:00, +12:34:56 |       |
     * | Timezone (GMT)                  | O...OOO | GMT-8, GMT+5:30, GMT+0            |       |
     * |                                 | OOOO    | GMT-08:00, GMT+05:30, GMT+00:00   | 2     |
     * | Timezone (specific non-locat.)  | z...zzz | GMT-8, GMT+5:30, GMT+0            | 6     |
     * |                                 | zzzz    | GMT-08:00, GMT+05:30, GMT+00:00   | 2,6   |
     * | Seconds timestamp               | t       | 512969520                         | 7     |
     * |                                 | tt      | ...                               | 3,7   |
     * | Milliseconds timestamp          | T       | 512969520900                      | 7     |
     * |                                 | TT      | ...                               | 3,7   |
     * | Long localized date             | P       | 04/29/1453                        | 7     |
     * |                                 | PP      | Apr 29, 1453                      | 7     |
     * |                                 | PPP     | April 29th, 1453                  | 7     |
     * |                                 | PPPP    | Friday, April 29th, 1453          | 2,7   |
     * | Long localized time             | p       | 12:00 AM                          | 7     |
     * |                                 | pp      | 12:00:00 AM                       | 7     |
     * |                                 | ppp     | 12:00:00 AM GMT+2                 | 7     |
     * |                                 | pppp    | 12:00:00 AM GMT+02:00             | 2,7   |
     * | Combination of date and time    | Pp      | 04/29/1453, 12:00 AM              | 7     |
     * |                                 | PPpp    | Apr 29, 1453, 12:00:00 AM         | 7     |
     * |                                 | PPPppp  | April 29th, 1453 at ...           | 7     |
     * |                                 | PPPPpppp| Friday, April 29th, 1453 at ...   | 2,7   |
     * Notes:
     * 1. "Formatting" units (e.g. formatting quarter) in the default en-US locale
     *    are the same as "stand-alone" units, but are different in some languages.
     *    "Formatting" units are declined according to the rules of the language
     *    in the context of a date. "Stand-alone" units are always nominative singular:
     *
     *    `format(new Date(2017, 10, 6), 'do LLLL', {locale: cs}) //=> '6. listopad'`
     *
     *    `format(new Date(2017, 10, 6), 'do MMMM', {locale: cs}) //=> '6. listopadu'`
     *
     * 2. Any sequence of the identical letters is a pattern, unless it is escaped by
     *    the single quote characters (see below).
     *    If the sequence is longer than listed in table (e.g. `EEEEEEEEEEE`)
     *    the output will be the same as default pattern for this unit, usually
     *    the longest one (in case of ISO weekdays, `EEEE`). Default patterns for units
     *    are marked with "2" in the last column of the table.
     *
     *    `format(new Date(2017, 10, 6), 'MMM') //=> 'Nov'`
     *
     *    `format(new Date(2017, 10, 6), 'MMMM') //=> 'November'`
     *
     *    `format(new Date(2017, 10, 6), 'MMMMM') //=> 'N'`
     *
     *    `format(new Date(2017, 10, 6), 'MMMMMM') //=> 'November'`
     *
     *    `format(new Date(2017, 10, 6), 'MMMMMMM') //=> 'November'`
     *
     * 3. Some patterns could be unlimited length (such as `yyyyyyyy`).
     *    The output will be padded with zeros to match the length of the pattern.
     *
     *    `format(new Date(2017, 10, 6), 'yyyyyyyy') //=> '00002017'`
     *
     * 4. `QQQQQ` and `qqqqq` could be not strictly numerical in some locales.
     *    These tokens represent the shortest form of the quarter.
     *
     * 5. The main difference between `y` and `u` patterns are B.C. years:
     *
     *    | Year | `y` | `u` |
     *    |------|-----|-----|
     *    | AC 1 |   1 |   1 |
     *    | BC 1 |   1 |   0 |
     *    | BC 2 |   2 |  -1 |
     *
     *    Also `yy` always returns the last two digits of a year,
     *    while `uu` pads single digit years to 2 characters and returns other years unchanged:
     *
     *    | Year | `yy` | `uu` |
     *    |------|------|------|
     *    | 1    |   01 |   01 |
     *    | 14   |   14 |   14 |
     *    | 376  |   76 |  376 |
     *    | 1453 |   53 | 1453 |
     *
     *    The same difference is true for local and ISO week-numbering years (`Y` and `R`),
     *    except local week-numbering years are dependent on `options.weekStartsOn`
     *    and `options.firstWeekContainsDate` (compare [getISOWeekYear]{@link https://date-fns.org/docs/getISOWeekYear}
     *    and [getWeekYear]{@link https://date-fns.org/docs/getWeekYear}).
     *
     * 6. Specific non-location timezones are currently unavailable in `date-fns`,
     *    so right now these tokens fall back to GMT timezones.
     *
     * 7. These patterns are not in the Unicode Technical Standard #35:
     *    - `i`: ISO day of week
     *    - `I`: ISO week of year
     *    - `R`: ISO week-numbering year
     *    - `t`: seconds timestamp
     *    - `T`: milliseconds timestamp
     *    - `o`: ordinal number modifier
     *    - `P`: long localized date
     *    - `p`: long localized time
     *
     * 8. `YY` and `YYYY` tokens represent week-numbering years but they are often confused with years.
     *    You should enable `options.useAdditionalWeekYearTokens` to use them. See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     *
     * 9. `D` and `DD` tokens represent days of the year but they are often confused with days of the month.
     *    You should enable `options.useAdditionalDayOfYearTokens` to use them. See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     *
     * @param {Date|Number} date - the original date
     * @param {String} format - the string of tokens
     * @param {Object} [options] - an object with options.
     * @param {Locale} [options.locale=defaultLocale] - the locale object. See [Locale]{@link https://date-fns.org/docs/Locale}
     * @param {0|1|2|3|4|5|6} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)
     * @param {Number} [options.firstWeekContainsDate=1] - the day of January, which is
     * @param {Boolean} [options.useAdditionalWeekYearTokens=false] - if true, allows usage of the week-numbering year tokens `YY` and `YYYY`;
     *   see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @param {Boolean} [options.useAdditionalDayOfYearTokens=false] - if true, allows usage of the day of year tokens `D` and `DD`;
     *   see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @returns {String} the formatted date string
     * @throws {TypeError} 2 arguments required
     * @throws {RangeError} `date` must not be Invalid Date
     * @throws {RangeError} `options.locale` must contain `localize` property
     * @throws {RangeError} `options.locale` must contain `formatLong` property
     * @throws {RangeError} `options.weekStartsOn` must be between 0 and 6
     * @throws {RangeError} `options.firstWeekContainsDate` must be between 1 and 7
     * @throws {RangeError} use `yyyy` instead of `YYYY` for formatting years using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @throws {RangeError} use `yy` instead of `YY` for formatting years using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @throws {RangeError} use `d` instead of `D` for formatting days of the month using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @throws {RangeError} use `dd` instead of `DD` for formatting days of the month using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @throws {RangeError} format string contains an unescaped latin alphabet character
     *
     * @example
     * // Represent 11 February 2014 in middle-endian format:
     * const result = format(new Date(2014, 1, 11), 'MM/dd/yyyy')
     * //=> '02/11/2014'
     *
     * @example
     * // Represent 2 July 2014 in Esperanto:
     * import { eoLocale } from 'date-fns/locale/eo'
     * const result = format(new Date(2014, 6, 2), "do 'de' MMMM yyyy", {
     *   locale: eoLocale
     * })
     * //=> '2-a de julio 2014'
     *
     * @example
     * // Escape string by single quote characters:
     * const result = format(new Date(2014, 6, 2, 15), "h 'o''clock'")
     * //=> "3 o'clock"
     */

    function format(dirtyDate, dirtyFormatStr, options) {
      var _ref, _options$locale, _ref2, _ref3, _ref4, _options$firstWeekCon, _options$locale2, _options$locale2$opti, _defaultOptions$local, _defaultOptions$local2, _ref5, _ref6, _ref7, _options$weekStartsOn, _options$locale3, _options$locale3$opti, _defaultOptions$local3, _defaultOptions$local4;

      requiredArgs(2, arguments);
      var formatStr = String(dirtyFormatStr);
      var defaultOptions = getDefaultOptions();
      var locale$1 = (_ref = (_options$locale = options === null || options === void 0 ? void 0 : options.locale) !== null && _options$locale !== void 0 ? _options$locale : defaultOptions.locale) !== null && _ref !== void 0 ? _ref : locale;
      var firstWeekContainsDate = toInteger((_ref2 = (_ref3 = (_ref4 = (_options$firstWeekCon = options === null || options === void 0 ? void 0 : options.firstWeekContainsDate) !== null && _options$firstWeekCon !== void 0 ? _options$firstWeekCon : options === null || options === void 0 ? void 0 : (_options$locale2 = options.locale) === null || _options$locale2 === void 0 ? void 0 : (_options$locale2$opti = _options$locale2.options) === null || _options$locale2$opti === void 0 ? void 0 : _options$locale2$opti.firstWeekContainsDate) !== null && _ref4 !== void 0 ? _ref4 : defaultOptions.firstWeekContainsDate) !== null && _ref3 !== void 0 ? _ref3 : (_defaultOptions$local = defaultOptions.locale) === null || _defaultOptions$local === void 0 ? void 0 : (_defaultOptions$local2 = _defaultOptions$local.options) === null || _defaultOptions$local2 === void 0 ? void 0 : _defaultOptions$local2.firstWeekContainsDate) !== null && _ref2 !== void 0 ? _ref2 : 1); // Test if weekStartsOn is between 1 and 7 _and_ is not NaN

      if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
        throw new RangeError('firstWeekContainsDate must be between 1 and 7 inclusively');
      }

      var weekStartsOn = toInteger((_ref5 = (_ref6 = (_ref7 = (_options$weekStartsOn = options === null || options === void 0 ? void 0 : options.weekStartsOn) !== null && _options$weekStartsOn !== void 0 ? _options$weekStartsOn : options === null || options === void 0 ? void 0 : (_options$locale3 = options.locale) === null || _options$locale3 === void 0 ? void 0 : (_options$locale3$opti = _options$locale3.options) === null || _options$locale3$opti === void 0 ? void 0 : _options$locale3$opti.weekStartsOn) !== null && _ref7 !== void 0 ? _ref7 : defaultOptions.weekStartsOn) !== null && _ref6 !== void 0 ? _ref6 : (_defaultOptions$local3 = defaultOptions.locale) === null || _defaultOptions$local3 === void 0 ? void 0 : (_defaultOptions$local4 = _defaultOptions$local3.options) === null || _defaultOptions$local4 === void 0 ? void 0 : _defaultOptions$local4.weekStartsOn) !== null && _ref5 !== void 0 ? _ref5 : 0); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

      if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
        throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
      }

      if (!locale$1.localize) {
        throw new RangeError('locale must contain localize property');
      }

      if (!locale$1.formatLong) {
        throw new RangeError('locale must contain formatLong property');
      }

      var originalDate = toDate(dirtyDate);

      if (!isValid(originalDate)) {
        throw new RangeError('Invalid time value');
      } // Convert the date in system timezone to the same date in UTC+00:00 timezone.
      // This ensures that when UTC functions will be implemented, locales will be compatible with them.
      // See an issue about UTC functions: https://github.com/date-fns/date-fns/issues/376


      var timezoneOffset = getTimezoneOffsetInMilliseconds(originalDate);
      var utcDate = subMilliseconds(originalDate, timezoneOffset);
      var formatterOptions = {
        firstWeekContainsDate: firstWeekContainsDate,
        weekStartsOn: weekStartsOn,
        locale: locale$1,
        _originalDate: originalDate
      };
      var result = formatStr.match(longFormattingTokensRegExp$1).map(function (substring) {
        var firstCharacter = substring[0];

        if (firstCharacter === 'p' || firstCharacter === 'P') {
          var longFormatter = longFormatters[firstCharacter];
          return longFormatter(substring, locale$1.formatLong);
        }

        return substring;
      }).join('').match(formattingTokensRegExp$1).map(function (substring) {
        // Replace two single quote characters with one single quote character
        if (substring === "''") {
          return "'";
        }

        var firstCharacter = substring[0];

        if (firstCharacter === "'") {
          return cleanEscapedString$1(substring);
        }

        var formatter = formatters[firstCharacter];

        if (formatter) {
          if (!(options !== null && options !== void 0 && options.useAdditionalWeekYearTokens) && isProtectedWeekYearToken(substring)) {
            throwProtectedError(substring, dirtyFormatStr, String(dirtyDate));
          }

          if (!(options !== null && options !== void 0 && options.useAdditionalDayOfYearTokens) && isProtectedDayOfYearToken(substring)) {
            throwProtectedError(substring, dirtyFormatStr, String(dirtyDate));
          }

          return formatter(utcDate, substring, locale$1.localize, formatterOptions);
        }

        if (firstCharacter.match(unescapedLatinCharacterRegExp$1)) {
          throw new RangeError('Format string contains an unescaped latin alphabet character `' + firstCharacter + '`');
        }

        return substring;
      }).join('');
      return result;
    }

    function cleanEscapedString$1(input) {
      var matched = input.match(escapedStringRegExp$1);

      if (!matched) {
        return input;
      }

      return matched[1].replace(doubleQuoteRegExp$1, "'");
    }

    function assign(target, object) {
      if (target == null) {
        throw new TypeError('assign requires that input parameter not be null or undefined');
      }

      for (var property in object) {
        if (Object.prototype.hasOwnProperty.call(object, property)) {
          target[property] = object[property];
        }
      }

      return target;
    }

    function _typeof$w(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$w = function _typeof(obj) { return typeof obj; }; } else { _typeof$w = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$w(obj); }

    function _inherits$v(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$v(subClass, superClass); }

    function _setPrototypeOf$v(o, p) { _setPrototypeOf$v = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$v(o, p); }

    function _createSuper$v(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$v(); return function _createSuperInternal() { var Super = _getPrototypeOf$v(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$v(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$v(this, result); }; }

    function _possibleConstructorReturn$v(self, call) { if (call && (_typeof$w(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$v(self); }

    function _assertThisInitialized$v(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$v() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$v(o) { _getPrototypeOf$v = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$v(o); }

    function _classCallCheck$w(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$w(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$w(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$w(Constructor.prototype, protoProps); if (staticProps) _defineProperties$w(Constructor, staticProps); return Constructor; }

    function _defineProperty$v(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var TIMEZONE_UNIT_PRIORITY = 10;
    var Setter = /*#__PURE__*/function () {
      function Setter() {
        _classCallCheck$w(this, Setter);

        _defineProperty$v(this, "subPriority", 0);
      }

      _createClass$w(Setter, [{
        key: "validate",
        value: function validate(_utcDate, _options) {
          return true;
        }
      }]);

      return Setter;
    }();
    var ValueSetter = /*#__PURE__*/function (_Setter) {
      _inherits$v(ValueSetter, _Setter);

      var _super = _createSuper$v(ValueSetter);

      function ValueSetter(value, validateValue, setValue, priority, subPriority) {
        var _this;

        _classCallCheck$w(this, ValueSetter);

        _this = _super.call(this);
        _this.value = value;
        _this.validateValue = validateValue;
        _this.setValue = setValue;
        _this.priority = priority;

        if (subPriority) {
          _this.subPriority = subPriority;
        }

        return _this;
      }

      _createClass$w(ValueSetter, [{
        key: "validate",
        value: function validate(utcDate, options) {
          return this.validateValue(utcDate, this.value, options);
        }
      }, {
        key: "set",
        value: function set(utcDate, flags, options) {
          return this.setValue(utcDate, flags, this.value, options);
        }
      }]);

      return ValueSetter;
    }(Setter);
    var DateToSystemTimezoneSetter = /*#__PURE__*/function (_Setter2) {
      _inherits$v(DateToSystemTimezoneSetter, _Setter2);

      var _super2 = _createSuper$v(DateToSystemTimezoneSetter);

      function DateToSystemTimezoneSetter() {
        var _this2;

        _classCallCheck$w(this, DateToSystemTimezoneSetter);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this2 = _super2.call.apply(_super2, [this].concat(args));

        _defineProperty$v(_assertThisInitialized$v(_this2), "priority", TIMEZONE_UNIT_PRIORITY);

        _defineProperty$v(_assertThisInitialized$v(_this2), "subPriority", -1);

        return _this2;
      }

      _createClass$w(DateToSystemTimezoneSetter, [{
        key: "set",
        value: function set(date, flags) {
          if (flags.timestampIsSet) {
            return date;
          }

          var convertedDate = new Date(0);
          convertedDate.setFullYear(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
          convertedDate.setHours(date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
          return convertedDate;
        }
      }]);

      return DateToSystemTimezoneSetter;
    }(Setter);

    function _classCallCheck$v(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$v(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$v(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$v(Constructor.prototype, protoProps); if (staticProps) _defineProperties$v(Constructor, staticProps); return Constructor; }
    var Parser = /*#__PURE__*/function () {
      function Parser() {
        _classCallCheck$v(this, Parser);
      }

      _createClass$v(Parser, [{
        key: "run",
        value: function run(dateString, token, match, options) {
          var result = this.parse(dateString, token, match, options);

          if (!result) {
            return null;
          }

          return {
            setter: new ValueSetter(result.value, this.validate, this.set, this.priority, this.subPriority),
            rest: result.rest
          };
        }
      }, {
        key: "validate",
        value: function validate(_utcDate, _value, _options) {
          return true;
        }
      }]);

      return Parser;
    }();

    function _typeof$v(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$v = function _typeof(obj) { return typeof obj; }; } else { _typeof$v = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$v(obj); }

    function _classCallCheck$u(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$u(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$u(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$u(Constructor.prototype, protoProps); if (staticProps) _defineProperties$u(Constructor, staticProps); return Constructor; }

    function _inherits$u(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$u(subClass, superClass); }

    function _setPrototypeOf$u(o, p) { _setPrototypeOf$u = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$u(o, p); }

    function _createSuper$u(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$u(); return function _createSuperInternal() { var Super = _getPrototypeOf$u(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$u(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$u(this, result); }; }

    function _possibleConstructorReturn$u(self, call) { if (call && (_typeof$v(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$u(self); }

    function _assertThisInitialized$u(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$u() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$u(o) { _getPrototypeOf$u = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$u(o); }

    function _defineProperty$u(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var EraParser = /*#__PURE__*/function (_Parser) {
      _inherits$u(EraParser, _Parser);

      var _super = _createSuper$u(EraParser);

      function EraParser() {
        var _this;

        _classCallCheck$u(this, EraParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$u(_assertThisInitialized$u(_this), "priority", 140);

        _defineProperty$u(_assertThisInitialized$u(_this), "incompatibleTokens", ['R', 'u', 't', 'T']);

        return _this;
      }

      _createClass$u(EraParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            // AD, BC
            case 'G':
            case 'GG':
            case 'GGG':
              return match.era(dateString, {
                width: 'abbreviated'
              }) || match.era(dateString, {
                width: 'narrow'
              });
            // A, B

            case 'GGGGG':
              return match.era(dateString, {
                width: 'narrow'
              });
            // Anno Domini, Before Christ

            case 'GGGG':
            default:
              return match.era(dateString, {
                width: 'wide'
              }) || match.era(dateString, {
                width: 'abbreviated'
              }) || match.era(dateString, {
                width: 'narrow'
              });
          }
        }
      }, {
        key: "set",
        value: function set(date, flags, value) {
          flags.era = value;
          date.setUTCFullYear(value, 0, 1);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return EraParser;
    }(Parser);

    var numericPatterns = {
      month: /^(1[0-2]|0?\d)/,
      // 0 to 12
      date: /^(3[0-1]|[0-2]?\d)/,
      // 0 to 31
      dayOfYear: /^(36[0-6]|3[0-5]\d|[0-2]?\d?\d)/,
      // 0 to 366
      week: /^(5[0-3]|[0-4]?\d)/,
      // 0 to 53
      hour23h: /^(2[0-3]|[0-1]?\d)/,
      // 0 to 23
      hour24h: /^(2[0-4]|[0-1]?\d)/,
      // 0 to 24
      hour11h: /^(1[0-1]|0?\d)/,
      // 0 to 11
      hour12h: /^(1[0-2]|0?\d)/,
      // 0 to 12
      minute: /^[0-5]?\d/,
      // 0 to 59
      second: /^[0-5]?\d/,
      // 0 to 59
      singleDigit: /^\d/,
      // 0 to 9
      twoDigits: /^\d{1,2}/,
      // 0 to 99
      threeDigits: /^\d{1,3}/,
      // 0 to 999
      fourDigits: /^\d{1,4}/,
      // 0 to 9999
      anyDigitsSigned: /^-?\d+/,
      singleDigitSigned: /^-?\d/,
      // 0 to 9, -0 to -9
      twoDigitsSigned: /^-?\d{1,2}/,
      // 0 to 99, -0 to -99
      threeDigitsSigned: /^-?\d{1,3}/,
      // 0 to 999, -0 to -999
      fourDigitsSigned: /^-?\d{1,4}/ // 0 to 9999, -0 to -9999

    };
    var timezonePatterns = {
      basicOptionalMinutes: /^([+-])(\d{2})(\d{2})?|Z/,
      basic: /^([+-])(\d{2})(\d{2})|Z/,
      basicOptionalSeconds: /^([+-])(\d{2})(\d{2})((\d{2}))?|Z/,
      extended: /^([+-])(\d{2}):(\d{2})|Z/,
      extendedOptionalSeconds: /^([+-])(\d{2}):(\d{2})(:(\d{2}))?|Z/
    };

    function mapValue(parseFnResult, mapFn) {
      if (!parseFnResult) {
        return parseFnResult;
      }

      return {
        value: mapFn(parseFnResult.value),
        rest: parseFnResult.rest
      };
    }
    function parseNumericPattern(pattern, dateString) {
      var matchResult = dateString.match(pattern);

      if (!matchResult) {
        return null;
      }

      return {
        value: parseInt(matchResult[0], 10),
        rest: dateString.slice(matchResult[0].length)
      };
    }
    function parseTimezonePattern(pattern, dateString) {
      var matchResult = dateString.match(pattern);

      if (!matchResult) {
        return null;
      } // Input is 'Z'


      if (matchResult[0] === 'Z') {
        return {
          value: 0,
          rest: dateString.slice(1)
        };
      }

      var sign = matchResult[1] === '+' ? 1 : -1;
      var hours = matchResult[2] ? parseInt(matchResult[2], 10) : 0;
      var minutes = matchResult[3] ? parseInt(matchResult[3], 10) : 0;
      var seconds = matchResult[5] ? parseInt(matchResult[5], 10) : 0;
      return {
        value: sign * (hours * millisecondsInHour + minutes * millisecondsInMinute + seconds * millisecondsInSecond),
        rest: dateString.slice(matchResult[0].length)
      };
    }
    function parseAnyDigitsSigned(dateString) {
      return parseNumericPattern(numericPatterns.anyDigitsSigned, dateString);
    }
    function parseNDigits(n, dateString) {
      switch (n) {
        case 1:
          return parseNumericPattern(numericPatterns.singleDigit, dateString);

        case 2:
          return parseNumericPattern(numericPatterns.twoDigits, dateString);

        case 3:
          return parseNumericPattern(numericPatterns.threeDigits, dateString);

        case 4:
          return parseNumericPattern(numericPatterns.fourDigits, dateString);

        default:
          return parseNumericPattern(new RegExp('^\\d{1,' + n + '}'), dateString);
      }
    }
    function parseNDigitsSigned(n, dateString) {
      switch (n) {
        case 1:
          return parseNumericPattern(numericPatterns.singleDigitSigned, dateString);

        case 2:
          return parseNumericPattern(numericPatterns.twoDigitsSigned, dateString);

        case 3:
          return parseNumericPattern(numericPatterns.threeDigitsSigned, dateString);

        case 4:
          return parseNumericPattern(numericPatterns.fourDigitsSigned, dateString);

        default:
          return parseNumericPattern(new RegExp('^-?\\d{1,' + n + '}'), dateString);
      }
    }
    function dayPeriodEnumToHours(dayPeriod) {
      switch (dayPeriod) {
        case 'morning':
          return 4;

        case 'evening':
          return 17;

        case 'pm':
        case 'noon':
        case 'afternoon':
          return 12;

        case 'am':
        case 'midnight':
        case 'night':
        default:
          return 0;
      }
    }
    function normalizeTwoDigitYear(twoDigitYear, currentYear) {
      var isCommonEra = currentYear > 0; // Absolute number of the current year:
      // 1 -> 1 AC
      // 0 -> 1 BC
      // -1 -> 2 BC

      var absCurrentYear = isCommonEra ? currentYear : 1 - currentYear;
      var result;

      if (absCurrentYear <= 50) {
        result = twoDigitYear || 100;
      } else {
        var rangeEnd = absCurrentYear + 50;
        var rangeEndCentury = Math.floor(rangeEnd / 100) * 100;
        var isPreviousCentury = twoDigitYear >= rangeEnd % 100;
        result = twoDigitYear + rangeEndCentury - (isPreviousCentury ? 100 : 0);
      }

      return isCommonEra ? result : 1 - result;
    }
    function isLeapYearIndex$1(year) {
      return year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
    }

    function _typeof$u(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$u = function _typeof(obj) { return typeof obj; }; } else { _typeof$u = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$u(obj); }

    function _classCallCheck$t(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$t(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$t(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$t(Constructor.prototype, protoProps); if (staticProps) _defineProperties$t(Constructor, staticProps); return Constructor; }

    function _inherits$t(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$t(subClass, superClass); }

    function _setPrototypeOf$t(o, p) { _setPrototypeOf$t = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$t(o, p); }

    function _createSuper$t(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$t(); return function _createSuperInternal() { var Super = _getPrototypeOf$t(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$t(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$t(this, result); }; }

    function _possibleConstructorReturn$t(self, call) { if (call && (_typeof$u(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$t(self); }

    function _assertThisInitialized$t(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$t() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$t(o) { _getPrototypeOf$t = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$t(o); }

    function _defineProperty$t(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    // From http://www.unicode.org/reports/tr35/tr35-31/tr35-dates.html#Date_Format_Patterns
    // | Year     |     y | yy |   yyy |  yyyy | yyyyy |
    // |----------|-------|----|-------|-------|-------|
    // | AD 1     |     1 | 01 |   001 |  0001 | 00001 |
    // | AD 12    |    12 | 12 |   012 |  0012 | 00012 |
    // | AD 123   |   123 | 23 |   123 |  0123 | 00123 |
    // | AD 1234  |  1234 | 34 |  1234 |  1234 | 01234 |
    // | AD 12345 | 12345 | 45 | 12345 | 12345 | 12345 |
    var YearParser = /*#__PURE__*/function (_Parser) {
      _inherits$t(YearParser, _Parser);

      var _super = _createSuper$t(YearParser);

      function YearParser() {
        var _this;

        _classCallCheck$t(this, YearParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$t(_assertThisInitialized$t(_this), "priority", 130);

        _defineProperty$t(_assertThisInitialized$t(_this), "incompatibleTokens", ['Y', 'R', 'u', 'w', 'I', 'i', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$t(YearParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          var valueCallback = function valueCallback(year) {
            return {
              year: year,
              isTwoDigitYear: token === 'yy'
            };
          };

          switch (token) {
            case 'y':
              return mapValue(parseNDigits(4, dateString), valueCallback);

            case 'yo':
              return mapValue(match.ordinalNumber(dateString, {
                unit: 'year'
              }), valueCallback);

            default:
              return mapValue(parseNDigits(token.length, dateString), valueCallback);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value.isTwoDigitYear || value.year > 0;
        }
      }, {
        key: "set",
        value: function set(date, flags, value) {
          var currentYear = date.getUTCFullYear();

          if (value.isTwoDigitYear) {
            var normalizedTwoDigitYear = normalizeTwoDigitYear(value.year, currentYear);
            date.setUTCFullYear(normalizedTwoDigitYear, 0, 1);
            date.setUTCHours(0, 0, 0, 0);
            return date;
          }

          var year = !('era' in flags) || flags.era === 1 ? value.year : 1 - value.year;
          date.setUTCFullYear(year, 0, 1);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return YearParser;
    }(Parser);

    function _typeof$t(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$t = function _typeof(obj) { return typeof obj; }; } else { _typeof$t = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$t(obj); }

    function _classCallCheck$s(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$s(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$s(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$s(Constructor.prototype, protoProps); if (staticProps) _defineProperties$s(Constructor, staticProps); return Constructor; }

    function _inherits$s(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$s(subClass, superClass); }

    function _setPrototypeOf$s(o, p) { _setPrototypeOf$s = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$s(o, p); }

    function _createSuper$s(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$s(); return function _createSuperInternal() { var Super = _getPrototypeOf$s(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$s(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$s(this, result); }; }

    function _possibleConstructorReturn$s(self, call) { if (call && (_typeof$t(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$s(self); }

    function _assertThisInitialized$s(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$s() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$s(o) { _getPrototypeOf$s = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$s(o); }

    function _defineProperty$s(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    // Local week-numbering year
    var LocalWeekYearParser = /*#__PURE__*/function (_Parser) {
      _inherits$s(LocalWeekYearParser, _Parser);

      var _super = _createSuper$s(LocalWeekYearParser);

      function LocalWeekYearParser() {
        var _this;

        _classCallCheck$s(this, LocalWeekYearParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$s(_assertThisInitialized$s(_this), "priority", 130);

        _defineProperty$s(_assertThisInitialized$s(_this), "incompatibleTokens", ['y', 'R', 'u', 'Q', 'q', 'M', 'L', 'I', 'd', 'D', 'i', 't', 'T']);

        return _this;
      }

      _createClass$s(LocalWeekYearParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          var valueCallback = function valueCallback(year) {
            return {
              year: year,
              isTwoDigitYear: token === 'YY'
            };
          };

          switch (token) {
            case 'Y':
              return mapValue(parseNDigits(4, dateString), valueCallback);

            case 'Yo':
              return mapValue(match.ordinalNumber(dateString, {
                unit: 'year'
              }), valueCallback);

            default:
              return mapValue(parseNDigits(token.length, dateString), valueCallback);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value.isTwoDigitYear || value.year > 0;
        }
      }, {
        key: "set",
        value: function set(date, flags, value, options) {
          var currentYear = getUTCWeekYear(date, options);

          if (value.isTwoDigitYear) {
            var normalizedTwoDigitYear = normalizeTwoDigitYear(value.year, currentYear);
            date.setUTCFullYear(normalizedTwoDigitYear, 0, options.firstWeekContainsDate);
            date.setUTCHours(0, 0, 0, 0);
            return startOfUTCWeek(date, options);
          }

          var year = !('era' in flags) || flags.era === 1 ? value.year : 1 - value.year;
          date.setUTCFullYear(year, 0, options.firstWeekContainsDate);
          date.setUTCHours(0, 0, 0, 0);
          return startOfUTCWeek(date, options);
        }
      }]);

      return LocalWeekYearParser;
    }(Parser);

    function _typeof$s(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$s = function _typeof(obj) { return typeof obj; }; } else { _typeof$s = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$s(obj); }

    function _classCallCheck$r(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$r(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$r(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$r(Constructor.prototype, protoProps); if (staticProps) _defineProperties$r(Constructor, staticProps); return Constructor; }

    function _inherits$r(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$r(subClass, superClass); }

    function _setPrototypeOf$r(o, p) { _setPrototypeOf$r = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$r(o, p); }

    function _createSuper$r(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$r(); return function _createSuperInternal() { var Super = _getPrototypeOf$r(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$r(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$r(this, result); }; }

    function _possibleConstructorReturn$r(self, call) { if (call && (_typeof$s(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$r(self); }

    function _assertThisInitialized$r(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$r() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$r(o) { _getPrototypeOf$r = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$r(o); }

    function _defineProperty$r(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var ISOWeekYearParser = /*#__PURE__*/function (_Parser) {
      _inherits$r(ISOWeekYearParser, _Parser);

      var _super = _createSuper$r(ISOWeekYearParser);

      function ISOWeekYearParser() {
        var _this;

        _classCallCheck$r(this, ISOWeekYearParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$r(_assertThisInitialized$r(_this), "priority", 130);

        _defineProperty$r(_assertThisInitialized$r(_this), "incompatibleTokens", ['G', 'y', 'Y', 'u', 'Q', 'q', 'M', 'L', 'w', 'd', 'D', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$r(ISOWeekYearParser, [{
        key: "parse",
        value: function parse(dateString, token) {
          if (token === 'R') {
            return parseNDigitsSigned(4, dateString);
          }

          return parseNDigitsSigned(token.length, dateString);
        }
      }, {
        key: "set",
        value: function set(_date, _flags, value) {
          var firstWeekOfYear = new Date(0);
          firstWeekOfYear.setUTCFullYear(value, 0, 4);
          firstWeekOfYear.setUTCHours(0, 0, 0, 0);
          return startOfUTCISOWeek(firstWeekOfYear);
        }
      }]);

      return ISOWeekYearParser;
    }(Parser);

    function _typeof$r(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$r = function _typeof(obj) { return typeof obj; }; } else { _typeof$r = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$r(obj); }

    function _classCallCheck$q(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$q(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$q(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$q(Constructor.prototype, protoProps); if (staticProps) _defineProperties$q(Constructor, staticProps); return Constructor; }

    function _inherits$q(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$q(subClass, superClass); }

    function _setPrototypeOf$q(o, p) { _setPrototypeOf$q = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$q(o, p); }

    function _createSuper$q(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$q(); return function _createSuperInternal() { var Super = _getPrototypeOf$q(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$q(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$q(this, result); }; }

    function _possibleConstructorReturn$q(self, call) { if (call && (_typeof$r(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$q(self); }

    function _assertThisInitialized$q(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$q() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$q(o) { _getPrototypeOf$q = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$q(o); }

    function _defineProperty$q(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var ExtendedYearParser = /*#__PURE__*/function (_Parser) {
      _inherits$q(ExtendedYearParser, _Parser);

      var _super = _createSuper$q(ExtendedYearParser);

      function ExtendedYearParser() {
        var _this;

        _classCallCheck$q(this, ExtendedYearParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$q(_assertThisInitialized$q(_this), "priority", 130);

        _defineProperty$q(_assertThisInitialized$q(_this), "incompatibleTokens", ['G', 'y', 'Y', 'R', 'w', 'I', 'i', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$q(ExtendedYearParser, [{
        key: "parse",
        value: function parse(dateString, token) {
          if (token === 'u') {
            return parseNDigitsSigned(4, dateString);
          }

          return parseNDigitsSigned(token.length, dateString);
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCFullYear(value, 0, 1);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return ExtendedYearParser;
    }(Parser);

    function _typeof$q(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$q = function _typeof(obj) { return typeof obj; }; } else { _typeof$q = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$q(obj); }

    function _classCallCheck$p(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$p(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$p(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$p(Constructor.prototype, protoProps); if (staticProps) _defineProperties$p(Constructor, staticProps); return Constructor; }

    function _inherits$p(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$p(subClass, superClass); }

    function _setPrototypeOf$p(o, p) { _setPrototypeOf$p = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$p(o, p); }

    function _createSuper$p(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$p(); return function _createSuperInternal() { var Super = _getPrototypeOf$p(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$p(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$p(this, result); }; }

    function _possibleConstructorReturn$p(self, call) { if (call && (_typeof$q(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$p(self); }

    function _assertThisInitialized$p(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$p() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$p(o) { _getPrototypeOf$p = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$p(o); }

    function _defineProperty$p(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var QuarterParser = /*#__PURE__*/function (_Parser) {
      _inherits$p(QuarterParser, _Parser);

      var _super = _createSuper$p(QuarterParser);

      function QuarterParser() {
        var _this;

        _classCallCheck$p(this, QuarterParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$p(_assertThisInitialized$p(_this), "priority", 120);

        _defineProperty$p(_assertThisInitialized$p(_this), "incompatibleTokens", ['Y', 'R', 'q', 'M', 'L', 'w', 'I', 'd', 'D', 'i', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$p(QuarterParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            // 1, 2, 3, 4
            case 'Q':
            case 'QQ':
              // 01, 02, 03, 04
              return parseNDigits(token.length, dateString);
            // 1st, 2nd, 3rd, 4th

            case 'Qo':
              return match.ordinalNumber(dateString, {
                unit: 'quarter'
              });
            // Q1, Q2, Q3, Q4

            case 'QQQ':
              return match.quarter(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.quarter(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // 1, 2, 3, 4 (narrow quarter; could be not numerical)

            case 'QQQQQ':
              return match.quarter(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // 1st quarter, 2nd quarter, ...

            case 'QQQQ':
            default:
              return match.quarter(dateString, {
                width: 'wide',
                context: 'formatting'
              }) || match.quarter(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.quarter(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 1 && value <= 4;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCMonth((value - 1) * 3, 1);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return QuarterParser;
    }(Parser);

    function _typeof$p(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$p = function _typeof(obj) { return typeof obj; }; } else { _typeof$p = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$p(obj); }

    function _classCallCheck$o(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$o(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$o(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$o(Constructor.prototype, protoProps); if (staticProps) _defineProperties$o(Constructor, staticProps); return Constructor; }

    function _inherits$o(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$o(subClass, superClass); }

    function _setPrototypeOf$o(o, p) { _setPrototypeOf$o = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$o(o, p); }

    function _createSuper$o(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$o(); return function _createSuperInternal() { var Super = _getPrototypeOf$o(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$o(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$o(this, result); }; }

    function _possibleConstructorReturn$o(self, call) { if (call && (_typeof$p(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$o(self); }

    function _assertThisInitialized$o(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$o() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$o(o) { _getPrototypeOf$o = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$o(o); }

    function _defineProperty$o(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var StandAloneQuarterParser = /*#__PURE__*/function (_Parser) {
      _inherits$o(StandAloneQuarterParser, _Parser);

      var _super = _createSuper$o(StandAloneQuarterParser);

      function StandAloneQuarterParser() {
        var _this;

        _classCallCheck$o(this, StandAloneQuarterParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$o(_assertThisInitialized$o(_this), "priority", 120);

        _defineProperty$o(_assertThisInitialized$o(_this), "incompatibleTokens", ['Y', 'R', 'Q', 'M', 'L', 'w', 'I', 'd', 'D', 'i', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$o(StandAloneQuarterParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            // 1, 2, 3, 4
            case 'q':
            case 'qq':
              // 01, 02, 03, 04
              return parseNDigits(token.length, dateString);
            // 1st, 2nd, 3rd, 4th

            case 'qo':
              return match.ordinalNumber(dateString, {
                unit: 'quarter'
              });
            // Q1, Q2, Q3, Q4

            case 'qqq':
              return match.quarter(dateString, {
                width: 'abbreviated',
                context: 'standalone'
              }) || match.quarter(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
            // 1, 2, 3, 4 (narrow quarter; could be not numerical)

            case 'qqqqq':
              return match.quarter(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
            // 1st quarter, 2nd quarter, ...

            case 'qqqq':
            default:
              return match.quarter(dateString, {
                width: 'wide',
                context: 'standalone'
              }) || match.quarter(dateString, {
                width: 'abbreviated',
                context: 'standalone'
              }) || match.quarter(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 1 && value <= 4;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCMonth((value - 1) * 3, 1);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return StandAloneQuarterParser;
    }(Parser);

    function _typeof$o(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$o = function _typeof(obj) { return typeof obj; }; } else { _typeof$o = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$o(obj); }

    function _classCallCheck$n(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$n(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$n(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$n(Constructor.prototype, protoProps); if (staticProps) _defineProperties$n(Constructor, staticProps); return Constructor; }

    function _inherits$n(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$n(subClass, superClass); }

    function _setPrototypeOf$n(o, p) { _setPrototypeOf$n = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$n(o, p); }

    function _createSuper$n(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$n(); return function _createSuperInternal() { var Super = _getPrototypeOf$n(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$n(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$n(this, result); }; }

    function _possibleConstructorReturn$n(self, call) { if (call && (_typeof$o(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$n(self); }

    function _assertThisInitialized$n(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$n() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$n(o) { _getPrototypeOf$n = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$n(o); }

    function _defineProperty$n(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var MonthParser = /*#__PURE__*/function (_Parser) {
      _inherits$n(MonthParser, _Parser);

      var _super = _createSuper$n(MonthParser);

      function MonthParser() {
        var _this;

        _classCallCheck$n(this, MonthParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$n(_assertThisInitialized$n(_this), "incompatibleTokens", ['Y', 'R', 'q', 'Q', 'L', 'w', 'I', 'D', 'i', 'e', 'c', 't', 'T']);

        _defineProperty$n(_assertThisInitialized$n(_this), "priority", 110);

        return _this;
      }

      _createClass$n(MonthParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          var valueCallback = function valueCallback(value) {
            return value - 1;
          };

          switch (token) {
            // 1, 2, ..., 12
            case 'M':
              return mapValue(parseNumericPattern(numericPatterns.month, dateString), valueCallback);
            // 01, 02, ..., 12

            case 'MM':
              return mapValue(parseNDigits(2, dateString), valueCallback);
            // 1st, 2nd, ..., 12th

            case 'Mo':
              return mapValue(match.ordinalNumber(dateString, {
                unit: 'month'
              }), valueCallback);
            // Jan, Feb, ..., Dec

            case 'MMM':
              return match.month(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.month(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // J, F, ..., D

            case 'MMMMM':
              return match.month(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // January, February, ..., December

            case 'MMMM':
            default:
              return match.month(dateString, {
                width: 'wide',
                context: 'formatting'
              }) || match.month(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.month(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 11;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCMonth(value, 1);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return MonthParser;
    }(Parser);

    function _typeof$n(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$n = function _typeof(obj) { return typeof obj; }; } else { _typeof$n = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$n(obj); }

    function _classCallCheck$m(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$m(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$m(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$m(Constructor.prototype, protoProps); if (staticProps) _defineProperties$m(Constructor, staticProps); return Constructor; }

    function _inherits$m(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$m(subClass, superClass); }

    function _setPrototypeOf$m(o, p) { _setPrototypeOf$m = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$m(o, p); }

    function _createSuper$m(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$m(); return function _createSuperInternal() { var Super = _getPrototypeOf$m(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$m(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$m(this, result); }; }

    function _possibleConstructorReturn$m(self, call) { if (call && (_typeof$n(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$m(self); }

    function _assertThisInitialized$m(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$m() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$m(o) { _getPrototypeOf$m = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$m(o); }

    function _defineProperty$m(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var StandAloneMonthParser = /*#__PURE__*/function (_Parser) {
      _inherits$m(StandAloneMonthParser, _Parser);

      var _super = _createSuper$m(StandAloneMonthParser);

      function StandAloneMonthParser() {
        var _this;

        _classCallCheck$m(this, StandAloneMonthParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$m(_assertThisInitialized$m(_this), "priority", 110);

        _defineProperty$m(_assertThisInitialized$m(_this), "incompatibleTokens", ['Y', 'R', 'q', 'Q', 'M', 'w', 'I', 'D', 'i', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$m(StandAloneMonthParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          var valueCallback = function valueCallback(value) {
            return value - 1;
          };

          switch (token) {
            // 1, 2, ..., 12
            case 'L':
              return mapValue(parseNumericPattern(numericPatterns.month, dateString), valueCallback);
            // 01, 02, ..., 12

            case 'LL':
              return mapValue(parseNDigits(2, dateString), valueCallback);
            // 1st, 2nd, ..., 12th

            case 'Lo':
              return mapValue(match.ordinalNumber(dateString, {
                unit: 'month'
              }), valueCallback);
            // Jan, Feb, ..., Dec

            case 'LLL':
              return match.month(dateString, {
                width: 'abbreviated',
                context: 'standalone'
              }) || match.month(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
            // J, F, ..., D

            case 'LLLLL':
              return match.month(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
            // January, February, ..., December

            case 'LLLL':
            default:
              return match.month(dateString, {
                width: 'wide',
                context: 'standalone'
              }) || match.month(dateString, {
                width: 'abbreviated',
                context: 'standalone'
              }) || match.month(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 11;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCMonth(value, 1);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return StandAloneMonthParser;
    }(Parser);

    function setUTCWeek(dirtyDate, dirtyWeek, options) {
      requiredArgs(2, arguments);
      var date = toDate(dirtyDate);
      var week = toInteger(dirtyWeek);
      var diff = getUTCWeek(date, options) - week;
      date.setUTCDate(date.getUTCDate() - diff * 7);
      return date;
    }

    function _typeof$m(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$m = function _typeof(obj) { return typeof obj; }; } else { _typeof$m = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$m(obj); }

    function _classCallCheck$l(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$l(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$l(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$l(Constructor.prototype, protoProps); if (staticProps) _defineProperties$l(Constructor, staticProps); return Constructor; }

    function _inherits$l(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$l(subClass, superClass); }

    function _setPrototypeOf$l(o, p) { _setPrototypeOf$l = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$l(o, p); }

    function _createSuper$l(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$l(); return function _createSuperInternal() { var Super = _getPrototypeOf$l(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$l(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$l(this, result); }; }

    function _possibleConstructorReturn$l(self, call) { if (call && (_typeof$m(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$l(self); }

    function _assertThisInitialized$l(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$l() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$l(o) { _getPrototypeOf$l = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$l(o); }

    function _defineProperty$l(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var LocalWeekParser = /*#__PURE__*/function (_Parser) {
      _inherits$l(LocalWeekParser, _Parser);

      var _super = _createSuper$l(LocalWeekParser);

      function LocalWeekParser() {
        var _this;

        _classCallCheck$l(this, LocalWeekParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$l(_assertThisInitialized$l(_this), "priority", 100);

        _defineProperty$l(_assertThisInitialized$l(_this), "incompatibleTokens", ['y', 'R', 'u', 'q', 'Q', 'M', 'L', 'I', 'd', 'D', 'i', 't', 'T']);

        return _this;
      }

      _createClass$l(LocalWeekParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'w':
              return parseNumericPattern(numericPatterns.week, dateString);

            case 'wo':
              return match.ordinalNumber(dateString, {
                unit: 'week'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 1 && value <= 53;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value, options) {
          return startOfUTCWeek(setUTCWeek(date, value, options), options);
        }
      }]);

      return LocalWeekParser;
    }(Parser);

    function setUTCISOWeek(dirtyDate, dirtyISOWeek) {
      requiredArgs(2, arguments);
      var date = toDate(dirtyDate);
      var isoWeek = toInteger(dirtyISOWeek);
      var diff = getUTCISOWeek(date) - isoWeek;
      date.setUTCDate(date.getUTCDate() - diff * 7);
      return date;
    }

    function _typeof$l(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$l = function _typeof(obj) { return typeof obj; }; } else { _typeof$l = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$l(obj); }

    function _classCallCheck$k(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$k(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$k(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$k(Constructor.prototype, protoProps); if (staticProps) _defineProperties$k(Constructor, staticProps); return Constructor; }

    function _inherits$k(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$k(subClass, superClass); }

    function _setPrototypeOf$k(o, p) { _setPrototypeOf$k = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$k(o, p); }

    function _createSuper$k(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$k(); return function _createSuperInternal() { var Super = _getPrototypeOf$k(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$k(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$k(this, result); }; }

    function _possibleConstructorReturn$k(self, call) { if (call && (_typeof$l(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$k(self); }

    function _assertThisInitialized$k(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$k() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$k(o) { _getPrototypeOf$k = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$k(o); }

    function _defineProperty$k(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var ISOWeekParser = /*#__PURE__*/function (_Parser) {
      _inherits$k(ISOWeekParser, _Parser);

      var _super = _createSuper$k(ISOWeekParser);

      function ISOWeekParser() {
        var _this;

        _classCallCheck$k(this, ISOWeekParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$k(_assertThisInitialized$k(_this), "priority", 100);

        _defineProperty$k(_assertThisInitialized$k(_this), "incompatibleTokens", ['y', 'Y', 'u', 'q', 'Q', 'M', 'L', 'w', 'd', 'D', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$k(ISOWeekParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'I':
              return parseNumericPattern(numericPatterns.week, dateString);

            case 'Io':
              return match.ordinalNumber(dateString, {
                unit: 'week'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 1 && value <= 53;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          return startOfUTCISOWeek(setUTCISOWeek(date, value));
        }
      }]);

      return ISOWeekParser;
    }(Parser);

    function _typeof$k(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$k = function _typeof(obj) { return typeof obj; }; } else { _typeof$k = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$k(obj); }

    function _classCallCheck$j(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$j(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$j(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$j(Constructor.prototype, protoProps); if (staticProps) _defineProperties$j(Constructor, staticProps); return Constructor; }

    function _inherits$j(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$j(subClass, superClass); }

    function _setPrototypeOf$j(o, p) { _setPrototypeOf$j = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$j(o, p); }

    function _createSuper$j(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$j(); return function _createSuperInternal() { var Super = _getPrototypeOf$j(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$j(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$j(this, result); }; }

    function _possibleConstructorReturn$j(self, call) { if (call && (_typeof$k(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$j(self); }

    function _assertThisInitialized$j(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$j() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$j(o) { _getPrototypeOf$j = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$j(o); }

    function _defineProperty$j(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var DAYS_IN_MONTH_LEAP_YEAR = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Day of the month

    var DateParser = /*#__PURE__*/function (_Parser) {
      _inherits$j(DateParser, _Parser);

      var _super = _createSuper$j(DateParser);

      function DateParser() {
        var _this;

        _classCallCheck$j(this, DateParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$j(_assertThisInitialized$j(_this), "priority", 90);

        _defineProperty$j(_assertThisInitialized$j(_this), "subPriority", 1);

        _defineProperty$j(_assertThisInitialized$j(_this), "incompatibleTokens", ['Y', 'R', 'q', 'Q', 'w', 'I', 'D', 'i', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$j(DateParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'd':
              return parseNumericPattern(numericPatterns.date, dateString);

            case 'do':
              return match.ordinalNumber(dateString, {
                unit: 'date'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(date, value) {
          var year = date.getUTCFullYear();
          var isLeapYear = isLeapYearIndex$1(year);
          var month = date.getUTCMonth();

          if (isLeapYear) {
            return value >= 1 && value <= DAYS_IN_MONTH_LEAP_YEAR[month];
          } else {
            return value >= 1 && value <= DAYS_IN_MONTH[month];
          }
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCDate(value);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return DateParser;
    }(Parser);

    function _typeof$j(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$j = function _typeof(obj) { return typeof obj; }; } else { _typeof$j = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$j(obj); }

    function _classCallCheck$i(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$i(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$i(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$i(Constructor.prototype, protoProps); if (staticProps) _defineProperties$i(Constructor, staticProps); return Constructor; }

    function _inherits$i(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$i(subClass, superClass); }

    function _setPrototypeOf$i(o, p) { _setPrototypeOf$i = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$i(o, p); }

    function _createSuper$i(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$i(); return function _createSuperInternal() { var Super = _getPrototypeOf$i(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$i(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$i(this, result); }; }

    function _possibleConstructorReturn$i(self, call) { if (call && (_typeof$j(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$i(self); }

    function _assertThisInitialized$i(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$i() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$i(o) { _getPrototypeOf$i = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$i(o); }

    function _defineProperty$i(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var DayOfYearParser = /*#__PURE__*/function (_Parser) {
      _inherits$i(DayOfYearParser, _Parser);

      var _super = _createSuper$i(DayOfYearParser);

      function DayOfYearParser() {
        var _this;

        _classCallCheck$i(this, DayOfYearParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$i(_assertThisInitialized$i(_this), "priority", 90);

        _defineProperty$i(_assertThisInitialized$i(_this), "subpriority", 1);

        _defineProperty$i(_assertThisInitialized$i(_this), "incompatibleTokens", ['Y', 'R', 'q', 'Q', 'M', 'L', 'w', 'I', 'd', 'E', 'i', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$i(DayOfYearParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'D':
            case 'DD':
              return parseNumericPattern(numericPatterns.dayOfYear, dateString);

            case 'Do':
              return match.ordinalNumber(dateString, {
                unit: 'date'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(date, value) {
          var year = date.getUTCFullYear();
          var isLeapYear = isLeapYearIndex$1(year);

          if (isLeapYear) {
            return value >= 1 && value <= 366;
          } else {
            return value >= 1 && value <= 365;
          }
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCMonth(0, value);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return DayOfYearParser;
    }(Parser);

    function setUTCDay(dirtyDate, dirtyDay, options) {
      var _ref, _ref2, _ref3, _options$weekStartsOn, _options$locale, _options$locale$optio, _defaultOptions$local, _defaultOptions$local2;

      requiredArgs(2, arguments);
      var defaultOptions = getDefaultOptions();
      var weekStartsOn = toInteger((_ref = (_ref2 = (_ref3 = (_options$weekStartsOn = options === null || options === void 0 ? void 0 : options.weekStartsOn) !== null && _options$weekStartsOn !== void 0 ? _options$weekStartsOn : options === null || options === void 0 ? void 0 : (_options$locale = options.locale) === null || _options$locale === void 0 ? void 0 : (_options$locale$optio = _options$locale.options) === null || _options$locale$optio === void 0 ? void 0 : _options$locale$optio.weekStartsOn) !== null && _ref3 !== void 0 ? _ref3 : defaultOptions.weekStartsOn) !== null && _ref2 !== void 0 ? _ref2 : (_defaultOptions$local = defaultOptions.locale) === null || _defaultOptions$local === void 0 ? void 0 : (_defaultOptions$local2 = _defaultOptions$local.options) === null || _defaultOptions$local2 === void 0 ? void 0 : _defaultOptions$local2.weekStartsOn) !== null && _ref !== void 0 ? _ref : 0); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

      if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
        throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
      }

      var date = toDate(dirtyDate);
      var day = toInteger(dirtyDay);
      var currentDay = date.getUTCDay();
      var remainder = day % 7;
      var dayIndex = (remainder + 7) % 7;
      var diff = (dayIndex < weekStartsOn ? 7 : 0) + day - currentDay;
      date.setUTCDate(date.getUTCDate() + diff);
      return date;
    }

    function _typeof$i(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$i = function _typeof(obj) { return typeof obj; }; } else { _typeof$i = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$i(obj); }

    function _classCallCheck$h(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$h(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$h(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$h(Constructor.prototype, protoProps); if (staticProps) _defineProperties$h(Constructor, staticProps); return Constructor; }

    function _inherits$h(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$h(subClass, superClass); }

    function _setPrototypeOf$h(o, p) { _setPrototypeOf$h = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$h(o, p); }

    function _createSuper$h(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$h(); return function _createSuperInternal() { var Super = _getPrototypeOf$h(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$h(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$h(this, result); }; }

    function _possibleConstructorReturn$h(self, call) { if (call && (_typeof$i(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$h(self); }

    function _assertThisInitialized$h(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$h() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$h(o) { _getPrototypeOf$h = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$h(o); }

    function _defineProperty$h(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var DayParser = /*#__PURE__*/function (_Parser) {
      _inherits$h(DayParser, _Parser);

      var _super = _createSuper$h(DayParser);

      function DayParser() {
        var _this;

        _classCallCheck$h(this, DayParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$h(_assertThisInitialized$h(_this), "priority", 90);

        _defineProperty$h(_assertThisInitialized$h(_this), "incompatibleTokens", ['D', 'i', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$h(DayParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            // Tue
            case 'E':
            case 'EE':
            case 'EEE':
              return match.day(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // T

            case 'EEEEE':
              return match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // Tu

            case 'EEEEEE':
              return match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // Tuesday

            case 'EEEE':
            default:
              return match.day(dateString, {
                width: 'wide',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 6;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value, options) {
          date = setUTCDay(date, value, options);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return DayParser;
    }(Parser);

    function _typeof$h(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$h = function _typeof(obj) { return typeof obj; }; } else { _typeof$h = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$h(obj); }

    function _classCallCheck$g(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$g(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$g(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$g(Constructor.prototype, protoProps); if (staticProps) _defineProperties$g(Constructor, staticProps); return Constructor; }

    function _inherits$g(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$g(subClass, superClass); }

    function _setPrototypeOf$g(o, p) { _setPrototypeOf$g = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$g(o, p); }

    function _createSuper$g(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$g(); return function _createSuperInternal() { var Super = _getPrototypeOf$g(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$g(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$g(this, result); }; }

    function _possibleConstructorReturn$g(self, call) { if (call && (_typeof$h(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$g(self); }

    function _assertThisInitialized$g(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$g() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$g(o) { _getPrototypeOf$g = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$g(o); }

    function _defineProperty$g(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var LocalDayParser = /*#__PURE__*/function (_Parser) {
      _inherits$g(LocalDayParser, _Parser);

      var _super = _createSuper$g(LocalDayParser);

      function LocalDayParser() {
        var _this;

        _classCallCheck$g(this, LocalDayParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$g(_assertThisInitialized$g(_this), "priority", 90);

        _defineProperty$g(_assertThisInitialized$g(_this), "incompatibleTokens", ['y', 'R', 'u', 'q', 'Q', 'M', 'L', 'I', 'd', 'D', 'E', 'i', 'c', 't', 'T']);

        return _this;
      }

      _createClass$g(LocalDayParser, [{
        key: "parse",
        value: function parse(dateString, token, match, options) {
          var valueCallback = function valueCallback(value) {
            var wholeWeekDays = Math.floor((value - 1) / 7) * 7;
            return (value + options.weekStartsOn + 6) % 7 + wholeWeekDays;
          };

          switch (token) {
            // 3
            case 'e':
            case 'ee':
              // 03
              return mapValue(parseNDigits(token.length, dateString), valueCallback);
            // 3rd

            case 'eo':
              return mapValue(match.ordinalNumber(dateString, {
                unit: 'day'
              }), valueCallback);
            // Tue

            case 'eee':
              return match.day(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // T

            case 'eeeee':
              return match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // Tu

            case 'eeeeee':
              return match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
            // Tuesday

            case 'eeee':
            default:
              return match.day(dateString, {
                width: 'wide',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 6;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value, options) {
          date = setUTCDay(date, value, options);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return LocalDayParser;
    }(Parser);

    function _typeof$g(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$g = function _typeof(obj) { return typeof obj; }; } else { _typeof$g = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$g(obj); }

    function _classCallCheck$f(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$f(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$f(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$f(Constructor.prototype, protoProps); if (staticProps) _defineProperties$f(Constructor, staticProps); return Constructor; }

    function _inherits$f(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$f(subClass, superClass); }

    function _setPrototypeOf$f(o, p) { _setPrototypeOf$f = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$f(o, p); }

    function _createSuper$f(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$f(); return function _createSuperInternal() { var Super = _getPrototypeOf$f(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$f(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$f(this, result); }; }

    function _possibleConstructorReturn$f(self, call) { if (call && (_typeof$g(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$f(self); }

    function _assertThisInitialized$f(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$f() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$f(o) { _getPrototypeOf$f = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$f(o); }

    function _defineProperty$f(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var StandAloneLocalDayParser = /*#__PURE__*/function (_Parser) {
      _inherits$f(StandAloneLocalDayParser, _Parser);

      var _super = _createSuper$f(StandAloneLocalDayParser);

      function StandAloneLocalDayParser() {
        var _this;

        _classCallCheck$f(this, StandAloneLocalDayParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$f(_assertThisInitialized$f(_this), "priority", 90);

        _defineProperty$f(_assertThisInitialized$f(_this), "incompatibleTokens", ['y', 'R', 'u', 'q', 'Q', 'M', 'L', 'I', 'd', 'D', 'E', 'i', 'e', 't', 'T']);

        return _this;
      }

      _createClass$f(StandAloneLocalDayParser, [{
        key: "parse",
        value: function parse(dateString, token, match, options) {
          var valueCallback = function valueCallback(value) {
            var wholeWeekDays = Math.floor((value - 1) / 7) * 7;
            return (value + options.weekStartsOn + 6) % 7 + wholeWeekDays;
          };

          switch (token) {
            // 3
            case 'c':
            case 'cc':
              // 03
              return mapValue(parseNDigits(token.length, dateString), valueCallback);
            // 3rd

            case 'co':
              return mapValue(match.ordinalNumber(dateString, {
                unit: 'day'
              }), valueCallback);
            // Tue

            case 'ccc':
              return match.day(dateString, {
                width: 'abbreviated',
                context: 'standalone'
              }) || match.day(dateString, {
                width: 'short',
                context: 'standalone'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
            // T

            case 'ccccc':
              return match.day(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
            // Tu

            case 'cccccc':
              return match.day(dateString, {
                width: 'short',
                context: 'standalone'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
            // Tuesday

            case 'cccc':
            default:
              return match.day(dateString, {
                width: 'wide',
                context: 'standalone'
              }) || match.day(dateString, {
                width: 'abbreviated',
                context: 'standalone'
              }) || match.day(dateString, {
                width: 'short',
                context: 'standalone'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'standalone'
              });
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 6;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value, options) {
          date = setUTCDay(date, value, options);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return StandAloneLocalDayParser;
    }(Parser);

    function setUTCISODay(dirtyDate, dirtyDay) {
      requiredArgs(2, arguments);
      var day = toInteger(dirtyDay);

      if (day % 7 === 0) {
        day = day - 7;
      }

      var weekStartsOn = 1;
      var date = toDate(dirtyDate);
      var currentDay = date.getUTCDay();
      var remainder = day % 7;
      var dayIndex = (remainder + 7) % 7;
      var diff = (dayIndex < weekStartsOn ? 7 : 0) + day - currentDay;
      date.setUTCDate(date.getUTCDate() + diff);
      return date;
    }

    function _typeof$f(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$f = function _typeof(obj) { return typeof obj; }; } else { _typeof$f = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$f(obj); }

    function _classCallCheck$e(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$e(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$e(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$e(Constructor.prototype, protoProps); if (staticProps) _defineProperties$e(Constructor, staticProps); return Constructor; }

    function _inherits$e(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$e(subClass, superClass); }

    function _setPrototypeOf$e(o, p) { _setPrototypeOf$e = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$e(o, p); }

    function _createSuper$e(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$e(); return function _createSuperInternal() { var Super = _getPrototypeOf$e(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$e(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$e(this, result); }; }

    function _possibleConstructorReturn$e(self, call) { if (call && (_typeof$f(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$e(self); }

    function _assertThisInitialized$e(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$e() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$e(o) { _getPrototypeOf$e = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$e(o); }

    function _defineProperty$e(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var ISODayParser = /*#__PURE__*/function (_Parser) {
      _inherits$e(ISODayParser, _Parser);

      var _super = _createSuper$e(ISODayParser);

      function ISODayParser() {
        var _this;

        _classCallCheck$e(this, ISODayParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$e(_assertThisInitialized$e(_this), "priority", 90);

        _defineProperty$e(_assertThisInitialized$e(_this), "incompatibleTokens", ['y', 'Y', 'u', 'q', 'Q', 'M', 'L', 'w', 'd', 'D', 'E', 'e', 'c', 't', 'T']);

        return _this;
      }

      _createClass$e(ISODayParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          var valueCallback = function valueCallback(value) {
            if (value === 0) {
              return 7;
            }

            return value;
          };

          switch (token) {
            // 2
            case 'i':
            case 'ii':
              // 02
              return parseNDigits(token.length, dateString);
            // 2nd

            case 'io':
              return match.ordinalNumber(dateString, {
                unit: 'day'
              });
            // Tue

            case 'iii':
              return mapValue(match.day(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              }), valueCallback);
            // T

            case 'iiiii':
              return mapValue(match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              }), valueCallback);
            // Tu

            case 'iiiiii':
              return mapValue(match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              }), valueCallback);
            // Tuesday

            case 'iiii':
            default:
              return mapValue(match.day(dateString, {
                width: 'wide',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'short',
                context: 'formatting'
              }) || match.day(dateString, {
                width: 'narrow',
                context: 'formatting'
              }), valueCallback);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 1 && value <= 7;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date = setUTCISODay(date, value);
          date.setUTCHours(0, 0, 0, 0);
          return date;
        }
      }]);

      return ISODayParser;
    }(Parser);

    function _typeof$e(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$e = function _typeof(obj) { return typeof obj; }; } else { _typeof$e = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$e(obj); }

    function _classCallCheck$d(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$d(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$d(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$d(Constructor.prototype, protoProps); if (staticProps) _defineProperties$d(Constructor, staticProps); return Constructor; }

    function _inherits$d(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$d(subClass, superClass); }

    function _setPrototypeOf$d(o, p) { _setPrototypeOf$d = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$d(o, p); }

    function _createSuper$d(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$d(); return function _createSuperInternal() { var Super = _getPrototypeOf$d(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$d(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$d(this, result); }; }

    function _possibleConstructorReturn$d(self, call) { if (call && (_typeof$e(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$d(self); }

    function _assertThisInitialized$d(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$d() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$d(o) { _getPrototypeOf$d = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$d(o); }

    function _defineProperty$d(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var AMPMParser = /*#__PURE__*/function (_Parser) {
      _inherits$d(AMPMParser, _Parser);

      var _super = _createSuper$d(AMPMParser);

      function AMPMParser() {
        var _this;

        _classCallCheck$d(this, AMPMParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$d(_assertThisInitialized$d(_this), "priority", 80);

        _defineProperty$d(_assertThisInitialized$d(_this), "incompatibleTokens", ['b', 'B', 'H', 'k', 't', 'T']);

        return _this;
      }

      _createClass$d(AMPMParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'a':
            case 'aa':
            case 'aaa':
              return match.dayPeriod(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });

            case 'aaaaa':
              return match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });

            case 'aaaa':
            default:
              return match.dayPeriod(dateString, {
                width: 'wide',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
          }
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCHours(dayPeriodEnumToHours(value), 0, 0, 0);
          return date;
        }
      }]);

      return AMPMParser;
    }(Parser);

    function _typeof$d(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$d = function _typeof(obj) { return typeof obj; }; } else { _typeof$d = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$d(obj); }

    function _classCallCheck$c(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$c(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$c(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$c(Constructor.prototype, protoProps); if (staticProps) _defineProperties$c(Constructor, staticProps); return Constructor; }

    function _inherits$c(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$c(subClass, superClass); }

    function _setPrototypeOf$c(o, p) { _setPrototypeOf$c = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$c(o, p); }

    function _createSuper$c(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$c(); return function _createSuperInternal() { var Super = _getPrototypeOf$c(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$c(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$c(this, result); }; }

    function _possibleConstructorReturn$c(self, call) { if (call && (_typeof$d(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$c(self); }

    function _assertThisInitialized$c(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$c() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$c(o) { _getPrototypeOf$c = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$c(o); }

    function _defineProperty$c(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var AMPMMidnightParser = /*#__PURE__*/function (_Parser) {
      _inherits$c(AMPMMidnightParser, _Parser);

      var _super = _createSuper$c(AMPMMidnightParser);

      function AMPMMidnightParser() {
        var _this;

        _classCallCheck$c(this, AMPMMidnightParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$c(_assertThisInitialized$c(_this), "priority", 80);

        _defineProperty$c(_assertThisInitialized$c(_this), "incompatibleTokens", ['a', 'B', 'H', 'k', 't', 'T']);

        return _this;
      }

      _createClass$c(AMPMMidnightParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'b':
            case 'bb':
            case 'bbb':
              return match.dayPeriod(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });

            case 'bbbbb':
              return match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });

            case 'bbbb':
            default:
              return match.dayPeriod(dateString, {
                width: 'wide',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
          }
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCHours(dayPeriodEnumToHours(value), 0, 0, 0);
          return date;
        }
      }]);

      return AMPMMidnightParser;
    }(Parser);

    function _typeof$c(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$c = function _typeof(obj) { return typeof obj; }; } else { _typeof$c = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$c(obj); }

    function _classCallCheck$b(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$b(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$b(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$b(Constructor.prototype, protoProps); if (staticProps) _defineProperties$b(Constructor, staticProps); return Constructor; }

    function _inherits$b(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$b(subClass, superClass); }

    function _setPrototypeOf$b(o, p) { _setPrototypeOf$b = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$b(o, p); }

    function _createSuper$b(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$b(); return function _createSuperInternal() { var Super = _getPrototypeOf$b(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$b(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$b(this, result); }; }

    function _possibleConstructorReturn$b(self, call) { if (call && (_typeof$c(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$b(self); }

    function _assertThisInitialized$b(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$b() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$b(o) { _getPrototypeOf$b = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$b(o); }

    function _defineProperty$b(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var DayPeriodParser = /*#__PURE__*/function (_Parser) {
      _inherits$b(DayPeriodParser, _Parser);

      var _super = _createSuper$b(DayPeriodParser);

      function DayPeriodParser() {
        var _this;

        _classCallCheck$b(this, DayPeriodParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$b(_assertThisInitialized$b(_this), "priority", 80);

        _defineProperty$b(_assertThisInitialized$b(_this), "incompatibleTokens", ['a', 'b', 't', 'T']);

        return _this;
      }

      _createClass$b(DayPeriodParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'B':
            case 'BB':
            case 'BBB':
              return match.dayPeriod(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });

            case 'BBBBB':
              return match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });

            case 'BBBB':
            default:
              return match.dayPeriod(dateString, {
                width: 'wide',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'abbreviated',
                context: 'formatting'
              }) || match.dayPeriod(dateString, {
                width: 'narrow',
                context: 'formatting'
              });
          }
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCHours(dayPeriodEnumToHours(value), 0, 0, 0);
          return date;
        }
      }]);

      return DayPeriodParser;
    }(Parser);

    function _typeof$b(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$b = function _typeof(obj) { return typeof obj; }; } else { _typeof$b = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$b(obj); }

    function _classCallCheck$a(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$a(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$a(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$a(Constructor.prototype, protoProps); if (staticProps) _defineProperties$a(Constructor, staticProps); return Constructor; }

    function _inherits$a(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$a(subClass, superClass); }

    function _setPrototypeOf$a(o, p) { _setPrototypeOf$a = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$a(o, p); }

    function _createSuper$a(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$a(); return function _createSuperInternal() { var Super = _getPrototypeOf$a(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$a(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$a(this, result); }; }

    function _possibleConstructorReturn$a(self, call) { if (call && (_typeof$b(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$a(self); }

    function _assertThisInitialized$a(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$a() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$a(o) { _getPrototypeOf$a = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$a(o); }

    function _defineProperty$a(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var Hour1to12Parser = /*#__PURE__*/function (_Parser) {
      _inherits$a(Hour1to12Parser, _Parser);

      var _super = _createSuper$a(Hour1to12Parser);

      function Hour1to12Parser() {
        var _this;

        _classCallCheck$a(this, Hour1to12Parser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$a(_assertThisInitialized$a(_this), "priority", 70);

        _defineProperty$a(_assertThisInitialized$a(_this), "incompatibleTokens", ['H', 'K', 'k', 't', 'T']);

        return _this;
      }

      _createClass$a(Hour1to12Parser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'h':
              return parseNumericPattern(numericPatterns.hour12h, dateString);

            case 'ho':
              return match.ordinalNumber(dateString, {
                unit: 'hour'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 1 && value <= 12;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          var isPM = date.getUTCHours() >= 12;

          if (isPM && value < 12) {
            date.setUTCHours(value + 12, 0, 0, 0);
          } else if (!isPM && value === 12) {
            date.setUTCHours(0, 0, 0, 0);
          } else {
            date.setUTCHours(value, 0, 0, 0);
          }

          return date;
        }
      }]);

      return Hour1to12Parser;
    }(Parser);

    function _typeof$a(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$a = function _typeof(obj) { return typeof obj; }; } else { _typeof$a = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$a(obj); }

    function _classCallCheck$9(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$9(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$9(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$9(Constructor.prototype, protoProps); if (staticProps) _defineProperties$9(Constructor, staticProps); return Constructor; }

    function _inherits$9(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$9(subClass, superClass); }

    function _setPrototypeOf$9(o, p) { _setPrototypeOf$9 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$9(o, p); }

    function _createSuper$9(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$9(); return function _createSuperInternal() { var Super = _getPrototypeOf$9(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$9(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$9(this, result); }; }

    function _possibleConstructorReturn$9(self, call) { if (call && (_typeof$a(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$9(self); }

    function _assertThisInitialized$9(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$9() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$9(o) { _getPrototypeOf$9 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$9(o); }

    function _defineProperty$9(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var Hour0to23Parser = /*#__PURE__*/function (_Parser) {
      _inherits$9(Hour0to23Parser, _Parser);

      var _super = _createSuper$9(Hour0to23Parser);

      function Hour0to23Parser() {
        var _this;

        _classCallCheck$9(this, Hour0to23Parser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$9(_assertThisInitialized$9(_this), "priority", 70);

        _defineProperty$9(_assertThisInitialized$9(_this), "incompatibleTokens", ['a', 'b', 'h', 'K', 'k', 't', 'T']);

        return _this;
      }

      _createClass$9(Hour0to23Parser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'H':
              return parseNumericPattern(numericPatterns.hour23h, dateString);

            case 'Ho':
              return match.ordinalNumber(dateString, {
                unit: 'hour'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 23;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCHours(value, 0, 0, 0);
          return date;
        }
      }]);

      return Hour0to23Parser;
    }(Parser);

    function _typeof$9(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$9 = function _typeof(obj) { return typeof obj; }; } else { _typeof$9 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$9(obj); }

    function _classCallCheck$8(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$8(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$8(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$8(Constructor.prototype, protoProps); if (staticProps) _defineProperties$8(Constructor, staticProps); return Constructor; }

    function _inherits$8(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$8(subClass, superClass); }

    function _setPrototypeOf$8(o, p) { _setPrototypeOf$8 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$8(o, p); }

    function _createSuper$8(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$8(); return function _createSuperInternal() { var Super = _getPrototypeOf$8(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$8(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$8(this, result); }; }

    function _possibleConstructorReturn$8(self, call) { if (call && (_typeof$9(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$8(self); }

    function _assertThisInitialized$8(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$8() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$8(o) { _getPrototypeOf$8 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$8(o); }

    function _defineProperty$8(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var Hour0To11Parser = /*#__PURE__*/function (_Parser) {
      _inherits$8(Hour0To11Parser, _Parser);

      var _super = _createSuper$8(Hour0To11Parser);

      function Hour0To11Parser() {
        var _this;

        _classCallCheck$8(this, Hour0To11Parser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$8(_assertThisInitialized$8(_this), "priority", 70);

        _defineProperty$8(_assertThisInitialized$8(_this), "incompatibleTokens", ['h', 'H', 'k', 't', 'T']);

        return _this;
      }

      _createClass$8(Hour0To11Parser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'K':
              return parseNumericPattern(numericPatterns.hour11h, dateString);

            case 'Ko':
              return match.ordinalNumber(dateString, {
                unit: 'hour'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 11;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          var isPM = date.getUTCHours() >= 12;

          if (isPM && value < 12) {
            date.setUTCHours(value + 12, 0, 0, 0);
          } else {
            date.setUTCHours(value, 0, 0, 0);
          }

          return date;
        }
      }]);

      return Hour0To11Parser;
    }(Parser);

    function _typeof$8(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$8 = function _typeof(obj) { return typeof obj; }; } else { _typeof$8 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$8(obj); }

    function _classCallCheck$7(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$7(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$7(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$7(Constructor.prototype, protoProps); if (staticProps) _defineProperties$7(Constructor, staticProps); return Constructor; }

    function _inherits$7(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$7(subClass, superClass); }

    function _setPrototypeOf$7(o, p) { _setPrototypeOf$7 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$7(o, p); }

    function _createSuper$7(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$7(); return function _createSuperInternal() { var Super = _getPrototypeOf$7(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$7(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$7(this, result); }; }

    function _possibleConstructorReturn$7(self, call) { if (call && (_typeof$8(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$7(self); }

    function _assertThisInitialized$7(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$7() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$7(o) { _getPrototypeOf$7 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$7(o); }

    function _defineProperty$7(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var Hour1To24Parser = /*#__PURE__*/function (_Parser) {
      _inherits$7(Hour1To24Parser, _Parser);

      var _super = _createSuper$7(Hour1To24Parser);

      function Hour1To24Parser() {
        var _this;

        _classCallCheck$7(this, Hour1To24Parser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$7(_assertThisInitialized$7(_this), "priority", 70);

        _defineProperty$7(_assertThisInitialized$7(_this), "incompatibleTokens", ['a', 'b', 'h', 'H', 'K', 't', 'T']);

        return _this;
      }

      _createClass$7(Hour1To24Parser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'k':
              return parseNumericPattern(numericPatterns.hour24h, dateString);

            case 'ko':
              return match.ordinalNumber(dateString, {
                unit: 'hour'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 1 && value <= 24;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          var hours = value <= 24 ? value % 24 : value;
          date.setUTCHours(hours, 0, 0, 0);
          return date;
        }
      }]);

      return Hour1To24Parser;
    }(Parser);

    function _typeof$7(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$7 = function _typeof(obj) { return typeof obj; }; } else { _typeof$7 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$7(obj); }

    function _classCallCheck$6(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$6(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$6(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$6(Constructor.prototype, protoProps); if (staticProps) _defineProperties$6(Constructor, staticProps); return Constructor; }

    function _inherits$6(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$6(subClass, superClass); }

    function _setPrototypeOf$6(o, p) { _setPrototypeOf$6 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$6(o, p); }

    function _createSuper$6(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$6(); return function _createSuperInternal() { var Super = _getPrototypeOf$6(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$6(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$6(this, result); }; }

    function _possibleConstructorReturn$6(self, call) { if (call && (_typeof$7(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$6(self); }

    function _assertThisInitialized$6(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$6() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$6(o) { _getPrototypeOf$6 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$6(o); }

    function _defineProperty$6(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var MinuteParser = /*#__PURE__*/function (_Parser) {
      _inherits$6(MinuteParser, _Parser);

      var _super = _createSuper$6(MinuteParser);

      function MinuteParser() {
        var _this;

        _classCallCheck$6(this, MinuteParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$6(_assertThisInitialized$6(_this), "priority", 60);

        _defineProperty$6(_assertThisInitialized$6(_this), "incompatibleTokens", ['t', 'T']);

        return _this;
      }

      _createClass$6(MinuteParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 'm':
              return parseNumericPattern(numericPatterns.minute, dateString);

            case 'mo':
              return match.ordinalNumber(dateString, {
                unit: 'minute'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 59;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCMinutes(value, 0, 0);
          return date;
        }
      }]);

      return MinuteParser;
    }(Parser);

    function _typeof$6(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$6 = function _typeof(obj) { return typeof obj; }; } else { _typeof$6 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$6(obj); }

    function _classCallCheck$5(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$5(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$5(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$5(Constructor.prototype, protoProps); if (staticProps) _defineProperties$5(Constructor, staticProps); return Constructor; }

    function _inherits$5(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$5(subClass, superClass); }

    function _setPrototypeOf$5(o, p) { _setPrototypeOf$5 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$5(o, p); }

    function _createSuper$5(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$5(); return function _createSuperInternal() { var Super = _getPrototypeOf$5(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$5(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$5(this, result); }; }

    function _possibleConstructorReturn$5(self, call) { if (call && (_typeof$6(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$5(self); }

    function _assertThisInitialized$5(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$5() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$5(o) { _getPrototypeOf$5 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$5(o); }

    function _defineProperty$5(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var SecondParser = /*#__PURE__*/function (_Parser) {
      _inherits$5(SecondParser, _Parser);

      var _super = _createSuper$5(SecondParser);

      function SecondParser() {
        var _this;

        _classCallCheck$5(this, SecondParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$5(_assertThisInitialized$5(_this), "priority", 50);

        _defineProperty$5(_assertThisInitialized$5(_this), "incompatibleTokens", ['t', 'T']);

        return _this;
      }

      _createClass$5(SecondParser, [{
        key: "parse",
        value: function parse(dateString, token, match) {
          switch (token) {
            case 's':
              return parseNumericPattern(numericPatterns.second, dateString);

            case 'so':
              return match.ordinalNumber(dateString, {
                unit: 'second'
              });

            default:
              return parseNDigits(token.length, dateString);
          }
        }
      }, {
        key: "validate",
        value: function validate(_date, value) {
          return value >= 0 && value <= 59;
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCSeconds(value, 0);
          return date;
        }
      }]);

      return SecondParser;
    }(Parser);

    function _typeof$5(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$5 = function _typeof(obj) { return typeof obj; }; } else { _typeof$5 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$5(obj); }

    function _classCallCheck$4(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$4(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$4(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$4(Constructor.prototype, protoProps); if (staticProps) _defineProperties$4(Constructor, staticProps); return Constructor; }

    function _inherits$4(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$4(subClass, superClass); }

    function _setPrototypeOf$4(o, p) { _setPrototypeOf$4 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$4(o, p); }

    function _createSuper$4(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$4(); return function _createSuperInternal() { var Super = _getPrototypeOf$4(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$4(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$4(this, result); }; }

    function _possibleConstructorReturn$4(self, call) { if (call && (_typeof$5(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$4(self); }

    function _assertThisInitialized$4(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$4() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$4(o) { _getPrototypeOf$4 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$4(o); }

    function _defineProperty$4(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var FractionOfSecondParser = /*#__PURE__*/function (_Parser) {
      _inherits$4(FractionOfSecondParser, _Parser);

      var _super = _createSuper$4(FractionOfSecondParser);

      function FractionOfSecondParser() {
        var _this;

        _classCallCheck$4(this, FractionOfSecondParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$4(_assertThisInitialized$4(_this), "priority", 30);

        _defineProperty$4(_assertThisInitialized$4(_this), "incompatibleTokens", ['t', 'T']);

        return _this;
      }

      _createClass$4(FractionOfSecondParser, [{
        key: "parse",
        value: function parse(dateString, token) {
          var valueCallback = function valueCallback(value) {
            return Math.floor(value * Math.pow(10, -token.length + 3));
          };

          return mapValue(parseNDigits(token.length, dateString), valueCallback);
        }
      }, {
        key: "set",
        value: function set(date, _flags, value) {
          date.setUTCMilliseconds(value);
          return date;
        }
      }]);

      return FractionOfSecondParser;
    }(Parser);

    function _typeof$4(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$4 = function _typeof(obj) { return typeof obj; }; } else { _typeof$4 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$4(obj); }

    function _classCallCheck$3(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$3(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$3(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$3(Constructor.prototype, protoProps); if (staticProps) _defineProperties$3(Constructor, staticProps); return Constructor; }

    function _inherits$3(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$3(subClass, superClass); }

    function _setPrototypeOf$3(o, p) { _setPrototypeOf$3 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$3(o, p); }

    function _createSuper$3(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$3(); return function _createSuperInternal() { var Super = _getPrototypeOf$3(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$3(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$3(this, result); }; }

    function _possibleConstructorReturn$3(self, call) { if (call && (_typeof$4(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$3(self); }

    function _assertThisInitialized$3(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$3() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$3(o) { _getPrototypeOf$3 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$3(o); }

    function _defineProperty$3(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var ISOTimezoneWithZParser = /*#__PURE__*/function (_Parser) {
      _inherits$3(ISOTimezoneWithZParser, _Parser);

      var _super = _createSuper$3(ISOTimezoneWithZParser);

      function ISOTimezoneWithZParser() {
        var _this;

        _classCallCheck$3(this, ISOTimezoneWithZParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$3(_assertThisInitialized$3(_this), "priority", 10);

        _defineProperty$3(_assertThisInitialized$3(_this), "incompatibleTokens", ['t', 'T', 'x']);

        return _this;
      }

      _createClass$3(ISOTimezoneWithZParser, [{
        key: "parse",
        value: function parse(dateString, token) {
          switch (token) {
            case 'X':
              return parseTimezonePattern(timezonePatterns.basicOptionalMinutes, dateString);

            case 'XX':
              return parseTimezonePattern(timezonePatterns.basic, dateString);

            case 'XXXX':
              return parseTimezonePattern(timezonePatterns.basicOptionalSeconds, dateString);

            case 'XXXXX':
              return parseTimezonePattern(timezonePatterns.extendedOptionalSeconds, dateString);

            case 'XXX':
            default:
              return parseTimezonePattern(timezonePatterns.extended, dateString);
          }
        }
      }, {
        key: "set",
        value: function set(date, flags, value) {
          if (flags.timestampIsSet) {
            return date;
          }

          return new Date(date.getTime() - value);
        }
      }]);

      return ISOTimezoneWithZParser;
    }(Parser);

    function _typeof$3(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$3 = function _typeof(obj) { return typeof obj; }; } else { _typeof$3 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$3(obj); }

    function _classCallCheck$2(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$2(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$2(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$2(Constructor.prototype, protoProps); if (staticProps) _defineProperties$2(Constructor, staticProps); return Constructor; }

    function _inherits$2(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$2(subClass, superClass); }

    function _setPrototypeOf$2(o, p) { _setPrototypeOf$2 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$2(o, p); }

    function _createSuper$2(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$2(); return function _createSuperInternal() { var Super = _getPrototypeOf$2(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$2(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$2(this, result); }; }

    function _possibleConstructorReturn$2(self, call) { if (call && (_typeof$3(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$2(self); }

    function _assertThisInitialized$2(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$2() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$2(o) { _getPrototypeOf$2 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$2(o); }

    function _defineProperty$2(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

    var ISOTimezoneParser = /*#__PURE__*/function (_Parser) {
      _inherits$2(ISOTimezoneParser, _Parser);

      var _super = _createSuper$2(ISOTimezoneParser);

      function ISOTimezoneParser() {
        var _this;

        _classCallCheck$2(this, ISOTimezoneParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$2(_assertThisInitialized$2(_this), "priority", 10);

        _defineProperty$2(_assertThisInitialized$2(_this), "incompatibleTokens", ['t', 'T', 'X']);

        return _this;
      }

      _createClass$2(ISOTimezoneParser, [{
        key: "parse",
        value: function parse(dateString, token) {
          switch (token) {
            case 'x':
              return parseTimezonePattern(timezonePatterns.basicOptionalMinutes, dateString);

            case 'xx':
              return parseTimezonePattern(timezonePatterns.basic, dateString);

            case 'xxxx':
              return parseTimezonePattern(timezonePatterns.basicOptionalSeconds, dateString);

            case 'xxxxx':
              return parseTimezonePattern(timezonePatterns.extendedOptionalSeconds, dateString);

            case 'xxx':
            default:
              return parseTimezonePattern(timezonePatterns.extended, dateString);
          }
        }
      }, {
        key: "set",
        value: function set(date, flags, value) {
          if (flags.timestampIsSet) {
            return date;
          }

          return new Date(date.getTime() - value);
        }
      }]);

      return ISOTimezoneParser;
    }(Parser);

    function _typeof$2(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$2 = function _typeof(obj) { return typeof obj; }; } else { _typeof$2 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$2(obj); }

    function _classCallCheck$1(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties$1(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass$1(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties$1(Constructor.prototype, protoProps); if (staticProps) _defineProperties$1(Constructor, staticProps); return Constructor; }

    function _inherits$1(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf$1(subClass, superClass); }

    function _setPrototypeOf$1(o, p) { _setPrototypeOf$1 = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf$1(o, p); }

    function _createSuper$1(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct$1(); return function _createSuperInternal() { var Super = _getPrototypeOf$1(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf$1(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn$1(this, result); }; }

    function _possibleConstructorReturn$1(self, call) { if (call && (_typeof$2(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized$1(self); }

    function _assertThisInitialized$1(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct$1() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf$1(o) { _getPrototypeOf$1 = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf$1(o); }

    function _defineProperty$1(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var TimestampSecondsParser = /*#__PURE__*/function (_Parser) {
      _inherits$1(TimestampSecondsParser, _Parser);

      var _super = _createSuper$1(TimestampSecondsParser);

      function TimestampSecondsParser() {
        var _this;

        _classCallCheck$1(this, TimestampSecondsParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty$1(_assertThisInitialized$1(_this), "priority", 40);

        _defineProperty$1(_assertThisInitialized$1(_this), "incompatibleTokens", '*');

        return _this;
      }

      _createClass$1(TimestampSecondsParser, [{
        key: "parse",
        value: function parse(dateString) {
          return parseAnyDigitsSigned(dateString);
        }
      }, {
        key: "set",
        value: function set(_date, _flags, value) {
          return [new Date(value * 1000), {
            timestampIsSet: true
          }];
        }
      }]);

      return TimestampSecondsParser;
    }(Parser);

    function _typeof$1(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof$1 = function _typeof(obj) { return typeof obj; }; } else { _typeof$1 = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof$1(obj); }

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

    function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

    function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

    function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

    function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

    function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = _getPrototypeOf(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = _getPrototypeOf(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return _possibleConstructorReturn(this, result); }; }

    function _possibleConstructorReturn(self, call) { if (call && (_typeof$1(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

    function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

    function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); return true; } catch (e) { return false; } }

    function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

    function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
    var TimestampMillisecondsParser = /*#__PURE__*/function (_Parser) {
      _inherits(TimestampMillisecondsParser, _Parser);

      var _super = _createSuper(TimestampMillisecondsParser);

      function TimestampMillisecondsParser() {
        var _this;

        _classCallCheck(this, TimestampMillisecondsParser);

        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        _this = _super.call.apply(_super, [this].concat(args));

        _defineProperty(_assertThisInitialized(_this), "priority", 20);

        _defineProperty(_assertThisInitialized(_this), "incompatibleTokens", '*');

        return _this;
      }

      _createClass(TimestampMillisecondsParser, [{
        key: "parse",
        value: function parse(dateString) {
          return parseAnyDigitsSigned(dateString);
        }
      }, {
        key: "set",
        value: function set(_date, _flags, value) {
          return [new Date(value), {
            timestampIsSet: true
          }];
        }
      }]);

      return TimestampMillisecondsParser;
    }(Parser);

    /*
     * |     | Unit                           |     | Unit                           |
     * |-----|--------------------------------|-----|--------------------------------|
     * |  a  | AM, PM                         |  A* | Milliseconds in day            |
     * |  b  | AM, PM, noon, midnight         |  B  | Flexible day period            |
     * |  c  | Stand-alone local day of week  |  C* | Localized hour w/ day period   |
     * |  d  | Day of month                   |  D  | Day of year                    |
     * |  e  | Local day of week              |  E  | Day of week                    |
     * |  f  |                                |  F* | Day of week in month           |
     * |  g* | Modified Julian day            |  G  | Era                            |
     * |  h  | Hour [1-12]                    |  H  | Hour [0-23]                    |
     * |  i! | ISO day of week                |  I! | ISO week of year               |
     * |  j* | Localized hour w/ day period   |  J* | Localized hour w/o day period  |
     * |  k  | Hour [1-24]                    |  K  | Hour [0-11]                    |
     * |  l* | (deprecated)                   |  L  | Stand-alone month              |
     * |  m  | Minute                         |  M  | Month                          |
     * |  n  |                                |  N  |                                |
     * |  o! | Ordinal number modifier        |  O* | Timezone (GMT)                 |
     * |  p  |                                |  P  |                                |
     * |  q  | Stand-alone quarter            |  Q  | Quarter                        |
     * |  r* | Related Gregorian year         |  R! | ISO week-numbering year        |
     * |  s  | Second                         |  S  | Fraction of second             |
     * |  t! | Seconds timestamp              |  T! | Milliseconds timestamp         |
     * |  u  | Extended year                  |  U* | Cyclic year                    |
     * |  v* | Timezone (generic non-locat.)  |  V* | Timezone (location)            |
     * |  w  | Local week of year             |  W* | Week of month                  |
     * |  x  | Timezone (ISO-8601 w/o Z)      |  X  | Timezone (ISO-8601)            |
     * |  y  | Year (abs)                     |  Y  | Local week-numbering year      |
     * |  z* | Timezone (specific non-locat.) |  Z* | Timezone (aliases)             |
     *
     * Letters marked by * are not implemented but reserved by Unicode standard.
     *
     * Letters marked by ! are non-standard, but implemented by date-fns:
     * - `o` modifies the previous token to turn it into an ordinal (see `parse` docs)
     * - `i` is ISO day of week. For `i` and `ii` is returns numeric ISO week days,
     *   i.e. 7 for Sunday, 1 for Monday, etc.
     * - `I` is ISO week of year, as opposed to `w` which is local week of year.
     * - `R` is ISO week-numbering year, as opposed to `Y` which is local week-numbering year.
     *   `R` is supposed to be used in conjunction with `I` and `i`
     *   for universal ISO week-numbering date, whereas
     *   `Y` is supposed to be used in conjunction with `w` and `e`
     *   for week-numbering date specific to the locale.
     */

    var parsers = {
      G: new EraParser(),
      y: new YearParser(),
      Y: new LocalWeekYearParser(),
      R: new ISOWeekYearParser(),
      u: new ExtendedYearParser(),
      Q: new QuarterParser(),
      q: new StandAloneQuarterParser(),
      M: new MonthParser(),
      L: new StandAloneMonthParser(),
      w: new LocalWeekParser(),
      I: new ISOWeekParser(),
      d: new DateParser(),
      D: new DayOfYearParser(),
      E: new DayParser(),
      e: new LocalDayParser(),
      c: new StandAloneLocalDayParser(),
      i: new ISODayParser(),
      a: new AMPMParser(),
      b: new AMPMMidnightParser(),
      B: new DayPeriodParser(),
      h: new Hour1to12Parser(),
      H: new Hour0to23Parser(),
      K: new Hour0To11Parser(),
      k: new Hour1To24Parser(),
      m: new MinuteParser(),
      s: new SecondParser(),
      S: new FractionOfSecondParser(),
      X: new ISOTimezoneWithZParser(),
      x: new ISOTimezoneParser(),
      t: new TimestampSecondsParser(),
      T: new TimestampMillisecondsParser()
    };

    function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

    function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }

    function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

    function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
    // - [yYQqMLwIdDecihHKkms]o matches any available ordinal number token
    //   (one of the certain letters followed by `o`)
    // - (\w)\1* matches any sequences of the same letter
    // - '' matches two quote characters in a row
    // - '(''|[^'])+('|$) matches anything surrounded by two quote characters ('),
    //   except a single quote symbol, which ends the sequence.
    //   Two quote characters do not end the sequence.
    //   If there is no matching single quote
    //   then the sequence will continue until the end of the string.
    // - . matches any single character unmatched by previous parts of the RegExps

    var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g; // This RegExp catches symbols escaped by quotes, and also
    // sequences of symbols P, p, and the combinations like `PPPPPPPppppp`

    var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
    var escapedStringRegExp = /^'([^]*?)'?$/;
    var doubleQuoteRegExp = /''/g;
    var notWhitespaceRegExp = /\S/;
    var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
    /**
     * @name parse
     * @category Common Helpers
     * @summary Parse the date.
     *
     * @description
     * Return the date parsed from string using the given format string.
     *
     * > ⚠️ Please note that the `format` tokens differ from Moment.js and other libraries.
     * > See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     *
     * The characters in the format string wrapped between two single quotes characters (') are escaped.
     * Two single quotes in a row, whether inside or outside a quoted sequence, represent a 'real' single quote.
     *
     * Format of the format string is based on Unicode Technical Standard #35:
     * https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
     * with a few additions (see note 5 below the table).
     *
     * Not all tokens are compatible. Combinations that don't make sense or could lead to bugs are prohibited
     * and will throw `RangeError`. For example usage of 24-hour format token with AM/PM token will throw an exception:
     *
     * ```javascript
     * parse('23 AM', 'HH a', new Date())
     * //=> RangeError: The format string mustn't contain `HH` and `a` at the same time
     * ```
     *
     * See the compatibility table: https://docs.google.com/spreadsheets/d/e/2PACX-1vQOPU3xUhplll6dyoMmVUXHKl_8CRDs6_ueLmex3SoqwhuolkuN3O05l4rqx5h1dKX8eb46Ul-CCSrq/pubhtml?gid=0&single=true
     *
     * Accepted format string patterns:
     * | Unit                            |Prior| Pattern | Result examples                   | Notes |
     * |---------------------------------|-----|---------|-----------------------------------|-------|
     * | Era                             | 140 | G..GGG  | AD, BC                            |       |
     * |                                 |     | GGGG    | Anno Domini, Before Christ        | 2     |
     * |                                 |     | GGGGG   | A, B                              |       |
     * | Calendar year                   | 130 | y       | 44, 1, 1900, 2017, 9999           | 4     |
     * |                                 |     | yo      | 44th, 1st, 1900th, 9999999th      | 4,5   |
     * |                                 |     | yy      | 44, 01, 00, 17                    | 4     |
     * |                                 |     | yyy     | 044, 001, 123, 999                | 4     |
     * |                                 |     | yyyy    | 0044, 0001, 1900, 2017            | 4     |
     * |                                 |     | yyyyy   | ...                               | 2,4   |
     * | Local week-numbering year       | 130 | Y       | 44, 1, 1900, 2017, 9000           | 4     |
     * |                                 |     | Yo      | 44th, 1st, 1900th, 9999999th      | 4,5   |
     * |                                 |     | YY      | 44, 01, 00, 17                    | 4,6   |
     * |                                 |     | YYY     | 044, 001, 123, 999                | 4     |
     * |                                 |     | YYYY    | 0044, 0001, 1900, 2017            | 4,6   |
     * |                                 |     | YYYYY   | ...                               | 2,4   |
     * | ISO week-numbering year         | 130 | R       | -43, 1, 1900, 2017, 9999, -9999   | 4,5   |
     * |                                 |     | RR      | -43, 01, 00, 17                   | 4,5   |
     * |                                 |     | RRR     | -043, 001, 123, 999, -999         | 4,5   |
     * |                                 |     | RRRR    | -0043, 0001, 2017, 9999, -9999    | 4,5   |
     * |                                 |     | RRRRR   | ...                               | 2,4,5 |
     * | Extended year                   | 130 | u       | -43, 1, 1900, 2017, 9999, -999    | 4     |
     * |                                 |     | uu      | -43, 01, 99, -99                  | 4     |
     * |                                 |     | uuu     | -043, 001, 123, 999, -999         | 4     |
     * |                                 |     | uuuu    | -0043, 0001, 2017, 9999, -9999    | 4     |
     * |                                 |     | uuuuu   | ...                               | 2,4   |
     * | Quarter (formatting)            | 120 | Q       | 1, 2, 3, 4                        |       |
     * |                                 |     | Qo      | 1st, 2nd, 3rd, 4th                | 5     |
     * |                                 |     | QQ      | 01, 02, 03, 04                    |       |
     * |                                 |     | QQQ     | Q1, Q2, Q3, Q4                    |       |
     * |                                 |     | QQQQ    | 1st quarter, 2nd quarter, ...     | 2     |
     * |                                 |     | QQQQQ   | 1, 2, 3, 4                        | 4     |
     * | Quarter (stand-alone)           | 120 | q       | 1, 2, 3, 4                        |       |
     * |                                 |     | qo      | 1st, 2nd, 3rd, 4th                | 5     |
     * |                                 |     | qq      | 01, 02, 03, 04                    |       |
     * |                                 |     | qqq     | Q1, Q2, Q3, Q4                    |       |
     * |                                 |     | qqqq    | 1st quarter, 2nd quarter, ...     | 2     |
     * |                                 |     | qqqqq   | 1, 2, 3, 4                        | 3     |
     * | Month (formatting)              | 110 | M       | 1, 2, ..., 12                     |       |
     * |                                 |     | Mo      | 1st, 2nd, ..., 12th               | 5     |
     * |                                 |     | MM      | 01, 02, ..., 12                   |       |
     * |                                 |     | MMM     | Jan, Feb, ..., Dec                |       |
     * |                                 |     | MMMM    | January, February, ..., December  | 2     |
     * |                                 |     | MMMMM   | J, F, ..., D                      |       |
     * | Month (stand-alone)             | 110 | L       | 1, 2, ..., 12                     |       |
     * |                                 |     | Lo      | 1st, 2nd, ..., 12th               | 5     |
     * |                                 |     | LL      | 01, 02, ..., 12                   |       |
     * |                                 |     | LLL     | Jan, Feb, ..., Dec                |       |
     * |                                 |     | LLLL    | January, February, ..., December  | 2     |
     * |                                 |     | LLLLL   | J, F, ..., D                      |       |
     * | Local week of year              | 100 | w       | 1, 2, ..., 53                     |       |
     * |                                 |     | wo      | 1st, 2nd, ..., 53th               | 5     |
     * |                                 |     | ww      | 01, 02, ..., 53                   |       |
     * | ISO week of year                | 100 | I       | 1, 2, ..., 53                     | 5     |
     * |                                 |     | Io      | 1st, 2nd, ..., 53th               | 5     |
     * |                                 |     | II      | 01, 02, ..., 53                   | 5     |
     * | Day of month                    |  90 | d       | 1, 2, ..., 31                     |       |
     * |                                 |     | do      | 1st, 2nd, ..., 31st               | 5     |
     * |                                 |     | dd      | 01, 02, ..., 31                   |       |
     * | Day of year                     |  90 | D       | 1, 2, ..., 365, 366               | 7     |
     * |                                 |     | Do      | 1st, 2nd, ..., 365th, 366th       | 5     |
     * |                                 |     | DD      | 01, 02, ..., 365, 366             | 7     |
     * |                                 |     | DDD     | 001, 002, ..., 365, 366           |       |
     * |                                 |     | DDDD    | ...                               | 2     |
     * | Day of week (formatting)        |  90 | E..EEE  | Mon, Tue, Wed, ..., Sun           |       |
     * |                                 |     | EEEE    | Monday, Tuesday, ..., Sunday      | 2     |
     * |                                 |     | EEEEE   | M, T, W, T, F, S, S               |       |
     * |                                 |     | EEEEEE  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
     * | ISO day of week (formatting)    |  90 | i       | 1, 2, 3, ..., 7                   | 5     |
     * |                                 |     | io      | 1st, 2nd, ..., 7th                | 5     |
     * |                                 |     | ii      | 01, 02, ..., 07                   | 5     |
     * |                                 |     | iii     | Mon, Tue, Wed, ..., Sun           | 5     |
     * |                                 |     | iiii    | Monday, Tuesday, ..., Sunday      | 2,5   |
     * |                                 |     | iiiii   | M, T, W, T, F, S, S               | 5     |
     * |                                 |     | iiiiii  | Mo, Tu, We, Th, Fr, Sa, Su        | 5     |
     * | Local day of week (formatting)  |  90 | e       | 2, 3, 4, ..., 1                   |       |
     * |                                 |     | eo      | 2nd, 3rd, ..., 1st                | 5     |
     * |                                 |     | ee      | 02, 03, ..., 01                   |       |
     * |                                 |     | eee     | Mon, Tue, Wed, ..., Sun           |       |
     * |                                 |     | eeee    | Monday, Tuesday, ..., Sunday      | 2     |
     * |                                 |     | eeeee   | M, T, W, T, F, S, S               |       |
     * |                                 |     | eeeeee  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
     * | Local day of week (stand-alone) |  90 | c       | 2, 3, 4, ..., 1                   |       |
     * |                                 |     | co      | 2nd, 3rd, ..., 1st                | 5     |
     * |                                 |     | cc      | 02, 03, ..., 01                   |       |
     * |                                 |     | ccc     | Mon, Tue, Wed, ..., Sun           |       |
     * |                                 |     | cccc    | Monday, Tuesday, ..., Sunday      | 2     |
     * |                                 |     | ccccc   | M, T, W, T, F, S, S               |       |
     * |                                 |     | cccccc  | Mo, Tu, We, Th, Fr, Sa, Su        |       |
     * | AM, PM                          |  80 | a..aaa  | AM, PM                            |       |
     * |                                 |     | aaaa    | a.m., p.m.                        | 2     |
     * |                                 |     | aaaaa   | a, p                              |       |
     * | AM, PM, noon, midnight          |  80 | b..bbb  | AM, PM, noon, midnight            |       |
     * |                                 |     | bbbb    | a.m., p.m., noon, midnight        | 2     |
     * |                                 |     | bbbbb   | a, p, n, mi                       |       |
     * | Flexible day period             |  80 | B..BBB  | at night, in the morning, ...     |       |
     * |                                 |     | BBBB    | at night, in the morning, ...     | 2     |
     * |                                 |     | BBBBB   | at night, in the morning, ...     |       |
     * | Hour [1-12]                     |  70 | h       | 1, 2, ..., 11, 12                 |       |
     * |                                 |     | ho      | 1st, 2nd, ..., 11th, 12th         | 5     |
     * |                                 |     | hh      | 01, 02, ..., 11, 12               |       |
     * | Hour [0-23]                     |  70 | H       | 0, 1, 2, ..., 23                  |       |
     * |                                 |     | Ho      | 0th, 1st, 2nd, ..., 23rd          | 5     |
     * |                                 |     | HH      | 00, 01, 02, ..., 23               |       |
     * | Hour [0-11]                     |  70 | K       | 1, 2, ..., 11, 0                  |       |
     * |                                 |     | Ko      | 1st, 2nd, ..., 11th, 0th          | 5     |
     * |                                 |     | KK      | 01, 02, ..., 11, 00               |       |
     * | Hour [1-24]                     |  70 | k       | 24, 1, 2, ..., 23                 |       |
     * |                                 |     | ko      | 24th, 1st, 2nd, ..., 23rd         | 5     |
     * |                                 |     | kk      | 24, 01, 02, ..., 23               |       |
     * | Minute                          |  60 | m       | 0, 1, ..., 59                     |       |
     * |                                 |     | mo      | 0th, 1st, ..., 59th               | 5     |
     * |                                 |     | mm      | 00, 01, ..., 59                   |       |
     * | Second                          |  50 | s       | 0, 1, ..., 59                     |       |
     * |                                 |     | so      | 0th, 1st, ..., 59th               | 5     |
     * |                                 |     | ss      | 00, 01, ..., 59                   |       |
     * | Seconds timestamp               |  40 | t       | 512969520                         |       |
     * |                                 |     | tt      | ...                               | 2     |
     * | Fraction of second              |  30 | S       | 0, 1, ..., 9                      |       |
     * |                                 |     | SS      | 00, 01, ..., 99                   |       |
     * |                                 |     | SSS     | 000, 001, ..., 999                |       |
     * |                                 |     | SSSS    | ...                               | 2     |
     * | Milliseconds timestamp          |  20 | T       | 512969520900                      |       |
     * |                                 |     | TT      | ...                               | 2     |
     * | Timezone (ISO-8601 w/ Z)        |  10 | X       | -08, +0530, Z                     |       |
     * |                                 |     | XX      | -0800, +0530, Z                   |       |
     * |                                 |     | XXX     | -08:00, +05:30, Z                 |       |
     * |                                 |     | XXXX    | -0800, +0530, Z, +123456          | 2     |
     * |                                 |     | XXXXX   | -08:00, +05:30, Z, +12:34:56      |       |
     * | Timezone (ISO-8601 w/o Z)       |  10 | x       | -08, +0530, +00                   |       |
     * |                                 |     | xx      | -0800, +0530, +0000               |       |
     * |                                 |     | xxx     | -08:00, +05:30, +00:00            | 2     |
     * |                                 |     | xxxx    | -0800, +0530, +0000, +123456      |       |
     * |                                 |     | xxxxx   | -08:00, +05:30, +00:00, +12:34:56 |       |
     * | Long localized date             |  NA | P       | 05/29/1453                        | 5,8   |
     * |                                 |     | PP      | May 29, 1453                      |       |
     * |                                 |     | PPP     | May 29th, 1453                    |       |
     * |                                 |     | PPPP    | Sunday, May 29th, 1453            | 2,5,8 |
     * | Long localized time             |  NA | p       | 12:00 AM                          | 5,8   |
     * |                                 |     | pp      | 12:00:00 AM                       |       |
     * | Combination of date and time    |  NA | Pp      | 05/29/1453, 12:00 AM              |       |
     * |                                 |     | PPpp    | May 29, 1453, 12:00:00 AM         |       |
     * |                                 |     | PPPpp   | May 29th, 1453 at ...             |       |
     * |                                 |     | PPPPpp  | Sunday, May 29th, 1453 at ...     | 2,5,8 |
     * Notes:
     * 1. "Formatting" units (e.g. formatting quarter) in the default en-US locale
     *    are the same as "stand-alone" units, but are different in some languages.
     *    "Formatting" units are declined according to the rules of the language
     *    in the context of a date. "Stand-alone" units are always nominative singular.
     *    In `format` function, they will produce different result:
     *
     *    `format(new Date(2017, 10, 6), 'do LLLL', {locale: cs}) //=> '6. listopad'`
     *
     *    `format(new Date(2017, 10, 6), 'do MMMM', {locale: cs}) //=> '6. listopadu'`
     *
     *    `parse` will try to match both formatting and stand-alone units interchangably.
     *
     * 2. Any sequence of the identical letters is a pattern, unless it is escaped by
     *    the single quote characters (see below).
     *    If the sequence is longer than listed in table:
     *    - for numerical units (`yyyyyyyy`) `parse` will try to match a number
     *      as wide as the sequence
     *    - for text units (`MMMMMMMM`) `parse` will try to match the widest variation of the unit.
     *      These variations are marked with "2" in the last column of the table.
     *
     * 3. `QQQQQ` and `qqqqq` could be not strictly numerical in some locales.
     *    These tokens represent the shortest form of the quarter.
     *
     * 4. The main difference between `y` and `u` patterns are B.C. years:
     *
     *    | Year | `y` | `u` |
     *    |------|-----|-----|
     *    | AC 1 |   1 |   1 |
     *    | BC 1 |   1 |   0 |
     *    | BC 2 |   2 |  -1 |
     *
     *    Also `yy` will try to guess the century of two digit year by proximity with `referenceDate`:
     *
     *    `parse('50', 'yy', new Date(2018, 0, 1)) //=> Sat Jan 01 2050 00:00:00`
     *
     *    `parse('75', 'yy', new Date(2018, 0, 1)) //=> Wed Jan 01 1975 00:00:00`
     *
     *    while `uu` will just assign the year as is:
     *
     *    `parse('50', 'uu', new Date(2018, 0, 1)) //=> Sat Jan 01 0050 00:00:00`
     *
     *    `parse('75', 'uu', new Date(2018, 0, 1)) //=> Tue Jan 01 0075 00:00:00`
     *
     *    The same difference is true for local and ISO week-numbering years (`Y` and `R`),
     *    except local week-numbering years are dependent on `options.weekStartsOn`
     *    and `options.firstWeekContainsDate` (compare [setISOWeekYear]{@link https://date-fns.org/docs/setISOWeekYear}
     *    and [setWeekYear]{@link https://date-fns.org/docs/setWeekYear}).
     *
     * 5. These patterns are not in the Unicode Technical Standard #35:
     *    - `i`: ISO day of week
     *    - `I`: ISO week of year
     *    - `R`: ISO week-numbering year
     *    - `o`: ordinal number modifier
     *    - `P`: long localized date
     *    - `p`: long localized time
     *
     * 6. `YY` and `YYYY` tokens represent week-numbering years but they are often confused with years.
     *    You should enable `options.useAdditionalWeekYearTokens` to use them. See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     *
     * 7. `D` and `DD` tokens represent days of the year but they are ofthen confused with days of the month.
     *    You should enable `options.useAdditionalDayOfYearTokens` to use them. See: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     *
     * 8. `P+` tokens do not have a defined priority since they are merely aliases to other tokens based
     *    on the given locale.
     *
     *    using `en-US` locale: `P` => `MM/dd/yyyy`
     *    using `en-US` locale: `p` => `hh:mm a`
     *    using `pt-BR` locale: `P` => `dd/MM/yyyy`
     *    using `pt-BR` locale: `p` => `HH:mm`
     *
     * Values will be assigned to the date in the descending order of its unit's priority.
     * Units of an equal priority overwrite each other in the order of appearance.
     *
     * If no values of higher priority are parsed (e.g. when parsing string 'January 1st' without a year),
     * the values will be taken from 3rd argument `referenceDate` which works as a context of parsing.
     *
     * `referenceDate` must be passed for correct work of the function.
     * If you're not sure which `referenceDate` to supply, create a new instance of Date:
     * `parse('02/11/2014', 'MM/dd/yyyy', new Date())`
     * In this case parsing will be done in the context of the current date.
     * If `referenceDate` is `Invalid Date` or a value not convertible to valid `Date`,
     * then `Invalid Date` will be returned.
     *
     * The result may vary by locale.
     *
     * If `formatString` matches with `dateString` but does not provides tokens, `referenceDate` will be returned.
     *
     * If parsing failed, `Invalid Date` will be returned.
     * Invalid Date is a Date, whose time value is NaN.
     * Time value of Date: http://es5.github.io/#x15.9.1.1
     *
     * @param {String} dateString - the string to parse
     * @param {String} formatString - the string of tokens
     * @param {Date|Number} referenceDate - defines values missing from the parsed dateString
     * @param {Object} [options] - an object with options.
     * @param {Locale} [options.locale=defaultLocale] - the locale object. See [Locale]{@link https://date-fns.org/docs/Locale}
     * @param {0|1|2|3|4|5|6} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)
     * @param {1|2|3|4|5|6|7} [options.firstWeekContainsDate=1] - the day of January, which is always in the first week of the year
     * @param {Boolean} [options.useAdditionalWeekYearTokens=false] - if true, allows usage of the week-numbering year tokens `YY` and `YYYY`;
     *   see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @param {Boolean} [options.useAdditionalDayOfYearTokens=false] - if true, allows usage of the day of year tokens `D` and `DD`;
     *   see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @returns {Date} the parsed date
     * @throws {TypeError} 3 arguments required
     * @throws {RangeError} `options.weekStartsOn` must be between 0 and 6
     * @throws {RangeError} `options.firstWeekContainsDate` must be between 1 and 7
     * @throws {RangeError} `options.locale` must contain `match` property
     * @throws {RangeError} use `yyyy` instead of `YYYY` for formatting years using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @throws {RangeError} use `yy` instead of `YY` for formatting years using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @throws {RangeError} use `d` instead of `D` for formatting days of the month using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @throws {RangeError} use `dd` instead of `DD` for formatting days of the month using [format provided] to the input [input provided]; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md
     * @throws {RangeError} format string contains an unescaped latin alphabet character
     *
     * @example
     * // Parse 11 February 2014 from middle-endian format:
     * var result = parse('02/11/2014', 'MM/dd/yyyy', new Date())
     * //=> Tue Feb 11 2014 00:00:00
     *
     * @example
     * // Parse 28th of February in Esperanto locale in the context of 2010 year:
     * import eo from 'date-fns/locale/eo'
     * var result = parse('28-a de februaro', "do 'de' MMMM", new Date(2010, 0, 1), {
     *   locale: eo
     * })
     * //=> Sun Feb 28 2010 00:00:00
     */

    function parse(dirtyDateString, dirtyFormatString, dirtyReferenceDate, options) {
      var _ref, _options$locale, _ref2, _ref3, _ref4, _options$firstWeekCon, _options$locale2, _options$locale2$opti, _defaultOptions$local, _defaultOptions$local2, _ref5, _ref6, _ref7, _options$weekStartsOn, _options$locale3, _options$locale3$opti, _defaultOptions$local3, _defaultOptions$local4;

      requiredArgs(3, arguments);
      var dateString = String(dirtyDateString);
      var formatString = String(dirtyFormatString);
      var defaultOptions = getDefaultOptions();
      var locale$1 = (_ref = (_options$locale = options === null || options === void 0 ? void 0 : options.locale) !== null && _options$locale !== void 0 ? _options$locale : defaultOptions.locale) !== null && _ref !== void 0 ? _ref : locale;

      if (!locale$1.match) {
        throw new RangeError('locale must contain match property');
      }

      var firstWeekContainsDate = toInteger((_ref2 = (_ref3 = (_ref4 = (_options$firstWeekCon = options === null || options === void 0 ? void 0 : options.firstWeekContainsDate) !== null && _options$firstWeekCon !== void 0 ? _options$firstWeekCon : options === null || options === void 0 ? void 0 : (_options$locale2 = options.locale) === null || _options$locale2 === void 0 ? void 0 : (_options$locale2$opti = _options$locale2.options) === null || _options$locale2$opti === void 0 ? void 0 : _options$locale2$opti.firstWeekContainsDate) !== null && _ref4 !== void 0 ? _ref4 : defaultOptions.firstWeekContainsDate) !== null && _ref3 !== void 0 ? _ref3 : (_defaultOptions$local = defaultOptions.locale) === null || _defaultOptions$local === void 0 ? void 0 : (_defaultOptions$local2 = _defaultOptions$local.options) === null || _defaultOptions$local2 === void 0 ? void 0 : _defaultOptions$local2.firstWeekContainsDate) !== null && _ref2 !== void 0 ? _ref2 : 1); // Test if weekStartsOn is between 1 and 7 _and_ is not NaN

      if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
        throw new RangeError('firstWeekContainsDate must be between 1 and 7 inclusively');
      }

      var weekStartsOn = toInteger((_ref5 = (_ref6 = (_ref7 = (_options$weekStartsOn = options === null || options === void 0 ? void 0 : options.weekStartsOn) !== null && _options$weekStartsOn !== void 0 ? _options$weekStartsOn : options === null || options === void 0 ? void 0 : (_options$locale3 = options.locale) === null || _options$locale3 === void 0 ? void 0 : (_options$locale3$opti = _options$locale3.options) === null || _options$locale3$opti === void 0 ? void 0 : _options$locale3$opti.weekStartsOn) !== null && _ref7 !== void 0 ? _ref7 : defaultOptions.weekStartsOn) !== null && _ref6 !== void 0 ? _ref6 : (_defaultOptions$local3 = defaultOptions.locale) === null || _defaultOptions$local3 === void 0 ? void 0 : (_defaultOptions$local4 = _defaultOptions$local3.options) === null || _defaultOptions$local4 === void 0 ? void 0 : _defaultOptions$local4.weekStartsOn) !== null && _ref5 !== void 0 ? _ref5 : 0); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

      if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
        throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
      }

      if (formatString === '') {
        if (dateString === '') {
          return toDate(dirtyReferenceDate);
        } else {
          return new Date(NaN);
        }
      }

      var subFnOptions = {
        firstWeekContainsDate: firstWeekContainsDate,
        weekStartsOn: weekStartsOn,
        locale: locale$1
      }; // If timezone isn't specified, it will be set to the system timezone

      var setters = [new DateToSystemTimezoneSetter()];
      var tokens = formatString.match(longFormattingTokensRegExp).map(function (substring) {
        var firstCharacter = substring[0];

        if (firstCharacter in longFormatters) {
          var longFormatter = longFormatters[firstCharacter];
          return longFormatter(substring, locale$1.formatLong);
        }

        return substring;
      }).join('').match(formattingTokensRegExp);
      var usedTokens = [];

      var _iterator = _createForOfIteratorHelper(tokens),
          _step;

      try {
        var _loop = function _loop() {
          var token = _step.value;

          if (!(options !== null && options !== void 0 && options.useAdditionalWeekYearTokens) && isProtectedWeekYearToken(token)) {
            throwProtectedError(token, formatString, dirtyDateString);
          }

          if (!(options !== null && options !== void 0 && options.useAdditionalDayOfYearTokens) && isProtectedDayOfYearToken(token)) {
            throwProtectedError(token, formatString, dirtyDateString);
          }

          var firstCharacter = token[0];
          var parser = parsers[firstCharacter];

          if (parser) {
            var incompatibleTokens = parser.incompatibleTokens;

            if (Array.isArray(incompatibleTokens)) {
              var incompatibleToken = usedTokens.find(function (usedToken) {
                return incompatibleTokens.includes(usedToken.token) || usedToken.token === firstCharacter;
              });

              if (incompatibleToken) {
                throw new RangeError("The format string mustn't contain `".concat(incompatibleToken.fullToken, "` and `").concat(token, "` at the same time"));
              }
            } else if (parser.incompatibleTokens === '*' && usedTokens.length > 0) {
              throw new RangeError("The format string mustn't contain `".concat(token, "` and any other token at the same time"));
            }

            usedTokens.push({
              token: firstCharacter,
              fullToken: token
            });
            var parseResult = parser.run(dateString, token, locale$1.match, subFnOptions);

            if (!parseResult) {
              return {
                v: new Date(NaN)
              };
            }

            setters.push(parseResult.setter);
            dateString = parseResult.rest;
          } else {
            if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
              throw new RangeError('Format string contains an unescaped latin alphabet character `' + firstCharacter + '`');
            } // Replace two single quote characters with one single quote character


            if (token === "''") {
              token = "'";
            } else if (firstCharacter === "'") {
              token = cleanEscapedString(token);
            } // Cut token from string, or, if string doesn't match the token, return Invalid Date


            if (dateString.indexOf(token) === 0) {
              dateString = dateString.slice(token.length);
            } else {
              return {
                v: new Date(NaN)
              };
            }
          }
        };

        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var _ret = _loop();

          if (_typeof(_ret) === "object") return _ret.v;
        } // Check if the remaining input contains something other than whitespace

      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }

      if (dateString.length > 0 && notWhitespaceRegExp.test(dateString)) {
        return new Date(NaN);
      }

      var uniquePrioritySetters = setters.map(function (setter) {
        return setter.priority;
      }).sort(function (a, b) {
        return b - a;
      }).filter(function (priority, index, array) {
        return array.indexOf(priority) === index;
      }).map(function (priority) {
        return setters.filter(function (setter) {
          return setter.priority === priority;
        }).sort(function (a, b) {
          return b.subPriority - a.subPriority;
        });
      }).map(function (setterArray) {
        return setterArray[0];
      });
      var date = toDate(dirtyReferenceDate);

      if (isNaN(date.getTime())) {
        return new Date(NaN);
      } // Convert the date in system timezone to the same date in UTC+00:00 timezone.


      var utcDate = subMilliseconds(date, getTimezoneOffsetInMilliseconds(date));
      var flags = {};

      var _iterator2 = _createForOfIteratorHelper(uniquePrioritySetters),
          _step2;

      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var setter = _step2.value;

          if (!setter.validate(utcDate, subFnOptions)) {
            return new Date(NaN);
          }

          var result = setter.set(utcDate, flags, subFnOptions); // Result is tuple (date, flags)

          if (Array.isArray(result)) {
            utcDate = result[0];
            assign(flags, result[1]); // Result is date
          } else {
            utcDate = result;
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }

      return utcDate;
    }

    function cleanEscapedString(input) {
      return input.match(escapedStringRegExp)[1].replace(doubleQuoteRegExp, "'");
    }

    /**
     * @name startOfHour
     * @category Hour Helpers
     * @summary Return the start of an hour for the given date.
     *
     * @description
     * Return the start of an hour for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the start of an hour
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The start of an hour for 2 September 2014 11:55:00:
     * const result = startOfHour(new Date(2014, 8, 2, 11, 55))
     * //=> Tue Sep 02 2014 11:00:00
     */

    function startOfHour(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setMinutes(0, 0, 0);
      return date;
    }

    /**
     * @name startOfSecond
     * @category Second Helpers
     * @summary Return the start of a second for the given date.
     *
     * @description
     * Return the start of a second for the given date.
     * The result will be in the local timezone.
     *
     * @param {Date|Number} date - the original date
     * @returns {Date} the start of a second
     * @throws {TypeError} 1 argument required
     *
     * @example
     * // The start of a second for 1 December 2014 22:15:45.400:
     * const result = startOfSecond(new Date(2014, 11, 1, 22, 15, 45, 400))
     * //=> Mon Dec 01 2014 22:15:45.000
     */

    function startOfSecond(dirtyDate) {
      requiredArgs(1, arguments);
      var date = toDate(dirtyDate);
      date.setMilliseconds(0);
      return date;
    }

    /**
     * @name parseISO
     * @category Common Helpers
     * @summary Parse ISO string
     *
     * @description
     * Parse the given string in ISO 8601 format and return an instance of Date.
     *
     * Function accepts complete ISO 8601 formats as well as partial implementations.
     * ISO 8601: http://en.wikipedia.org/wiki/ISO_8601
     *
     * If the argument isn't a string, the function cannot parse the string or
     * the values are invalid, it returns Invalid Date.
     *
     * @param {String} argument - the value to convert
     * @param {Object} [options] - an object with options.
     * @param {0|1|2} [options.additionalDigits=2] - the additional number of digits in the extended year format
     * @returns {Date} the parsed date in the local time zone
     * @throws {TypeError} 1 argument required
     * @throws {RangeError} `options.additionalDigits` must be 0, 1 or 2
     *
     * @example
     * // Convert string '2014-02-11T11:30:30' to date:
     * const result = parseISO('2014-02-11T11:30:30')
     * //=> Tue Feb 11 2014 11:30:30
     *
     * @example
     * // Convert string '+02014101' to date,
     * // if the additional number of digits in the extended year format is 1:
     * const result = parseISO('+02014101', { additionalDigits: 1 })
     * //=> Fri Apr 11 2014 00:00:00
     */

    function parseISO(argument, options) {
      var _options$additionalDi;

      requiredArgs(1, arguments);
      var additionalDigits = toInteger((_options$additionalDi = options === null || options === void 0 ? void 0 : options.additionalDigits) !== null && _options$additionalDi !== void 0 ? _options$additionalDi : 2);

      if (additionalDigits !== 2 && additionalDigits !== 1 && additionalDigits !== 0) {
        throw new RangeError('additionalDigits must be 0, 1 or 2');
      }

      if (!(typeof argument === 'string' || Object.prototype.toString.call(argument) === '[object String]')) {
        return new Date(NaN);
      }

      var dateStrings = splitDateString(argument);
      var date;

      if (dateStrings.date) {
        var parseYearResult = parseYear(dateStrings.date, additionalDigits);
        date = parseDate(parseYearResult.restDateString, parseYearResult.year);
      }

      if (!date || isNaN(date.getTime())) {
        return new Date(NaN);
      }

      var timestamp = date.getTime();
      var time = 0;
      var offset;

      if (dateStrings.time) {
        time = parseTime(dateStrings.time);

        if (isNaN(time)) {
          return new Date(NaN);
        }
      }

      if (dateStrings.timezone) {
        offset = parseTimezone(dateStrings.timezone);

        if (isNaN(offset)) {
          return new Date(NaN);
        }
      } else {
        var dirtyDate = new Date(timestamp + time); // js parsed string assuming it's in UTC timezone
        // but we need it to be parsed in our timezone
        // so we use utc values to build date in our timezone.
        // Year values from 0 to 99 map to the years 1900 to 1999
        // so set year explicitly with setFullYear.

        var result = new Date(0);
        result.setFullYear(dirtyDate.getUTCFullYear(), dirtyDate.getUTCMonth(), dirtyDate.getUTCDate());
        result.setHours(dirtyDate.getUTCHours(), dirtyDate.getUTCMinutes(), dirtyDate.getUTCSeconds(), dirtyDate.getUTCMilliseconds());
        return result;
      }

      return new Date(timestamp + time + offset);
    }
    var patterns = {
      dateTimeDelimiter: /[T ]/,
      timeZoneDelimiter: /[Z ]/i,
      timezone: /([Z+-].*)$/
    };
    var dateRegex = /^-?(?:(\d{3})|(\d{2})(?:-?(\d{2}))?|W(\d{2})(?:-?(\d{1}))?|)$/;
    var timeRegex = /^(\d{2}(?:[.,]\d*)?)(?::?(\d{2}(?:[.,]\d*)?))?(?::?(\d{2}(?:[.,]\d*)?))?$/;
    var timezoneRegex = /^([+-])(\d{2})(?::?(\d{2}))?$/;

    function splitDateString(dateString) {
      var dateStrings = {};
      var array = dateString.split(patterns.dateTimeDelimiter);
      var timeString; // The regex match should only return at maximum two array elements.
      // [date], [time], or [date, time].

      if (array.length > 2) {
        return dateStrings;
      }

      if (/:/.test(array[0])) {
        timeString = array[0];
      } else {
        dateStrings.date = array[0];
        timeString = array[1];

        if (patterns.timeZoneDelimiter.test(dateStrings.date)) {
          dateStrings.date = dateString.split(patterns.timeZoneDelimiter)[0];
          timeString = dateString.substr(dateStrings.date.length, dateString.length);
        }
      }

      if (timeString) {
        var token = patterns.timezone.exec(timeString);

        if (token) {
          dateStrings.time = timeString.replace(token[1], '');
          dateStrings.timezone = token[1];
        } else {
          dateStrings.time = timeString;
        }
      }

      return dateStrings;
    }

    function parseYear(dateString, additionalDigits) {
      var regex = new RegExp('^(?:(\\d{4}|[+-]\\d{' + (4 + additionalDigits) + '})|(\\d{2}|[+-]\\d{' + (2 + additionalDigits) + '})$)');
      var captures = dateString.match(regex); // Invalid ISO-formatted year

      if (!captures) return {
        year: NaN,
        restDateString: ''
      };
      var year = captures[1] ? parseInt(captures[1]) : null;
      var century = captures[2] ? parseInt(captures[2]) : null; // either year or century is null, not both

      return {
        year: century === null ? year : century * 100,
        restDateString: dateString.slice((captures[1] || captures[2]).length)
      };
    }

    function parseDate(dateString, year) {
      // Invalid ISO-formatted year
      if (year === null) return new Date(NaN);
      var captures = dateString.match(dateRegex); // Invalid ISO-formatted string

      if (!captures) return new Date(NaN);
      var isWeekDate = !!captures[4];
      var dayOfYear = parseDateUnit(captures[1]);
      var month = parseDateUnit(captures[2]) - 1;
      var day = parseDateUnit(captures[3]);
      var week = parseDateUnit(captures[4]);
      var dayOfWeek = parseDateUnit(captures[5]) - 1;

      if (isWeekDate) {
        if (!validateWeekDate(year, week, dayOfWeek)) {
          return new Date(NaN);
        }

        return dayOfISOWeekYear(year, week, dayOfWeek);
      } else {
        var date = new Date(0);

        if (!validateDate(year, month, day) || !validateDayOfYearDate(year, dayOfYear)) {
          return new Date(NaN);
        }

        date.setUTCFullYear(year, month, Math.max(dayOfYear, day));
        return date;
      }
    }

    function parseDateUnit(value) {
      return value ? parseInt(value) : 1;
    }

    function parseTime(timeString) {
      var captures = timeString.match(timeRegex);
      if (!captures) return NaN; // Invalid ISO-formatted time

      var hours = parseTimeUnit(captures[1]);
      var minutes = parseTimeUnit(captures[2]);
      var seconds = parseTimeUnit(captures[3]);

      if (!validateTime(hours, minutes, seconds)) {
        return NaN;
      }

      return hours * millisecondsInHour + minutes * millisecondsInMinute + seconds * 1000;
    }

    function parseTimeUnit(value) {
      return value && parseFloat(value.replace(',', '.')) || 0;
    }

    function parseTimezone(timezoneString) {
      if (timezoneString === 'Z') return 0;
      var captures = timezoneString.match(timezoneRegex);
      if (!captures) return 0;
      var sign = captures[1] === '+' ? -1 : 1;
      var hours = parseInt(captures[2]);
      var minutes = captures[3] && parseInt(captures[3]) || 0;

      if (!validateTimezone(hours, minutes)) {
        return NaN;
      }

      return sign * (hours * millisecondsInHour + minutes * millisecondsInMinute);
    }

    function dayOfISOWeekYear(isoWeekYear, week, day) {
      var date = new Date(0);
      date.setUTCFullYear(isoWeekYear, 0, 4);
      var fourthOfJanuaryDay = date.getUTCDay() || 7;
      var diff = (week - 1) * 7 + day + 1 - fourthOfJanuaryDay;
      date.setUTCDate(date.getUTCDate() + diff);
      return date;
    } // Validation functions
    // February is null to handle the leap year (using ||)


    var daysInMonths = [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    function isLeapYearIndex(year) {
      return year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
    }

    function validateDate(year, month, date) {
      return month >= 0 && month <= 11 && date >= 1 && date <= (daysInMonths[month] || (isLeapYearIndex(year) ? 29 : 28));
    }

    function validateDayOfYearDate(year, dayOfYear) {
      return dayOfYear >= 1 && dayOfYear <= (isLeapYearIndex(year) ? 366 : 365);
    }

    function validateWeekDate(_year, week, day) {
      return week >= 1 && week <= 53 && day >= 0 && day <= 6;
    }

    function validateTime(hours, minutes, seconds) {
      if (hours === 24) {
        return minutes === 0 && seconds === 0;
      }

      return seconds >= 0 && seconds < 60 && minutes >= 0 && minutes < 60 && hours >= 0 && hours < 25;
    }

    function validateTimezone(_hours, minutes) {
      return minutes >= 0 && minutes <= 59;
    }

    /*!
     * chartjs-adapter-date-fns v2.0.1
     * https://www.chartjs.org
     * (c) 2022 chartjs-adapter-date-fns Contributors
     * Released under the MIT license
     */

    const FORMATS = {
      datetime: 'MMM d, yyyy, h:mm:ss aaaa',
      millisecond: 'h:mm:ss.SSS aaaa',
      second: 'h:mm:ss aaaa',
      minute: 'h:mm aaaa',
      hour: 'ha',
      day: 'MMM d',
      week: 'PP',
      month: 'MMM yyyy',
      quarter: 'qqq - yyyy',
      year: 'yyyy'
    };

    adapters._date.override({
      _id: 'date-fns', // DEBUG

      formats: function() {
        return FORMATS;
      },

      parse: function(value, fmt) {
        if (value === null || typeof value === 'undefined') {
          return null;
        }
        const type = typeof value;
        if (type === 'number' || value instanceof Date) {
          value = toDate(value);
        } else if (type === 'string') {
          if (typeof fmt === 'string') {
            value = parse(value, fmt, new Date(), this.options);
          } else {
            value = parseISO(value, this.options);
          }
        }
        return isValid(value) ? value.getTime() : null;
      },

      format: function(time, fmt) {
        return format(time, fmt, this.options);
      },

      add: function(time, amount, unit) {
        switch (unit) {
        case 'millisecond': return addMilliseconds(time, amount);
        case 'second': return addSeconds(time, amount);
        case 'minute': return addMinutes(time, amount);
        case 'hour': return addHours(time, amount);
        case 'day': return addDays(time, amount);
        case 'week': return addWeeks(time, amount);
        case 'month': return addMonths(time, amount);
        case 'quarter': return addQuarters(time, amount);
        case 'year': return addYears(time, amount);
        default: return time;
        }
      },

      diff: function(max, min, unit) {
        switch (unit) {
        case 'millisecond': return differenceInMilliseconds(max, min);
        case 'second': return differenceInSeconds(max, min);
        case 'minute': return differenceInMinutes(max, min);
        case 'hour': return differenceInHours(max, min);
        case 'day': return differenceInDays(max, min);
        case 'week': return differenceInWeeks(max, min);
        case 'month': return differenceInMonths(max, min);
        case 'quarter': return differenceInQuarters(max, min);
        case 'year': return differenceInYears(max, min);
        default: return 0;
        }
      },

      startOf: function(time, unit, weekday) {
        switch (unit) {
        case 'second': return startOfSecond(time);
        case 'minute': return startOfMinute(time);
        case 'hour': return startOfHour(time);
        case 'day': return startOfDay(time);
        case 'week': return startOfWeek(time);
        case 'isoWeek': return startOfWeek(time, {weekStartsOn: +weekday});
        case 'month': return startOfMonth(time);
        case 'quarter': return startOfQuarter(time);
        case 'year': return startOfYear(time);
        default: return time;
        }
      },

      endOf: function(time, unit) {
        switch (unit) {
        case 'second': return endOfSecond(time);
        case 'minute': return endOfMinute(time);
        case 'hour': return endOfHour(time);
        case 'day': return endOfDay(time);
        case 'week': return endOfWeek(time);
        case 'month': return endOfMonth(time);
        case 'quarter': return endOfQuarter(time);
        case 'year': return endOfYear(time);
        default: return time;
        }
      }
    });

    // If you are making a new locale based on this one, check if the same is true for the language you're working on.
    // Generally, formatted dates should look like they are in the middle of a sentence,
    // e.g. in Spanish language the weekdays and months should be in the lowercase.

    var monthValues$2 = {
      narrow: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
      abbreviated: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
      wide: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    }; // https://st.unicode.org/cldr-apps/v#/de/Gregorian/

    ({
      narrow: monthValues$2.narrow,
      abbreviated: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],
      wide: monthValues$2.wide
    });

    // If you are making a new locale based on this one, check if the same is true for the language you're working on.
    // Generally, formatted dates should look like they are in the middle of a sentence,
    // e.g. in Spanish language the weekdays and months should be in the lowercase.

    var monthValues$1 = {
      narrow: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
      abbreviated: ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
      wide: ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    }; // https://st.unicode.org/cldr-apps/v#/de_AT/Gregorian/

    ({
      narrow: monthValues$1.narrow,
      abbreviated: ['Jän.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],
      wide: monthValues$1.wide
    });

    var monthValues = {
      narrow: ['T', 'H', 'M', 'H', 'T', 'K', 'H', 'E', 'S', 'L', 'M', 'J'],
      abbreviated: ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'],
      wide: ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu']
    };
    ({
      narrow: monthValues.narrow,
      abbreviated: monthValues.abbreviated,
      wide: ['tammikuuta', 'helmikuuta', 'maaliskuuta', 'huhtikuuta', 'toukokuuta', 'kesäkuuta', 'heinäkuuta', 'elokuuta', 'syyskuuta', 'lokakuuta', 'marraskuuta', 'joulukuuta']
    });
    var dayValues = {
      narrow: ['S', 'M', 'T', 'K', 'T', 'P', 'L'],
      short: ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'],
      abbreviated: ['sunn.', 'maan.', 'tiis.', 'kesk.', 'torst.', 'perj.', 'la'],
      wide: ['sunnuntai', 'maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai']
    };
    ({
      narrow: dayValues.narrow,
      short: dayValues.short,
      abbreviated: dayValues.abbreviated,
      wide: ['sunnuntaina', 'maanantaina', 'tiistaina', 'keskiviikkona', 'torstaina', 'perjantaina', 'lauantaina']
    });

    /* src/reports/components/DayChart.svelte generated by Svelte v3.52.0 */

    function create_fragment$2(ctx) {
    	let div;
    	let bar;
    	let current;

    	bar = new Bar({
    			props: {
    				data: { datasets: /*datasets*/ ctx[0] },
    				width: 600,
    				height: 300,
    				options: {
    					responsive: true,
    					// maintainAspectRatio: false,
    					scales: {
    						x: {
    							type: 'time',
    							time: {
    								unit: 'day',
    								displayFormats: { day: 'MMM d' }
    							},
    							adapters: { date: { locale: locale } }
    						}
    					}, // y: {
    					//     min: 0,
    					
    				}, //     max: 10,
    				
    			}
    		});

    	return {
    		c() {
    			div = element("div");
    			create_component(bar.$$.fragment);
    			attr(div, "class", "chart");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(bar, div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const bar_changes = {};
    			if (dirty & /*datasets*/ 1) bar_changes.data = { datasets: /*datasets*/ ctx[0] };
    			bar.$set(bar_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(bar.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(bar.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(bar);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
    	Chart$1$1.register(plugin_title, plugin_tooltip, plugin_legend, LineElement, BarElement, LinearScale, PointElement, CategoryScale, plugin_colors, TimeScale);

    	const day_map = d => {
    		return { x: d.date, y: d.count };
    	};

    	let { datasets = [] } = $$props;

    	//onMount
    	onMount(async () => {
    		const report = await apiGet(`summaryengine/v1/report/by_period`);

    		$$invalidate(0, datasets = [
    			{
    				label: 'Good',
    				data: report.filter(d => Number(d.rating) === 1).map(day_map)
    			},
    			{
    				label: 'Bad',
    				data: report.filter(d => Number(d.rating) === -1).map(day_map)
    			},
    			{
    				label: 'Unrated',
    				data: report.filter(d => Number(d.rating) === 0).map(day_map)
    			}
    		]);
    	});

    	$$self.$$set = $$props => {
    		if ('datasets' in $$props) $$invalidate(0, datasets = $$props.datasets);
    	};

    	return [datasets];
    }

    class DayChart extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { datasets: 0 });
    	}
    }

    /* src/reports/components/PieChart.svelte generated by Svelte v3.52.0 */

    function create_fragment$1(ctx) {
    	let div;
    	let pie;
    	let current;

    	pie = new Pie({
    			props: {
    				data: {
    					labels: ['Good', 'Bad', 'Unrated'],
    					datasets: [
    						{
    							data: [/*good*/ ctx[0], /*bad*/ ctx[1], /*unrated*/ ctx[2]]
    						}
    					]
    				},
    				options: { responsive: true }
    			}
    		});

    	return {
    		c() {
    			div = element("div");
    			create_component(pie.$$.fragment);
    			attr(div, "class", "chart");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			mount_component(pie, div, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const pie_changes = {};

    			if (dirty & /*good, bad, unrated*/ 7) pie_changes.data = {
    				labels: ['Good', 'Bad', 'Unrated'],
    				datasets: [
    					{
    						data: [/*good*/ ctx[0], /*bad*/ ctx[1], /*unrated*/ ctx[2]]
    					}
    				]
    			};

    			pie.$set(pie_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(pie.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(pie.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(pie);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	Chart$1$1.register(plugin_title, plugin_tooltip, plugin_legend, ArcElement, CategoryScale, plugin_colors);
    	let { good = 10 } = $$props;
    	let { bad = 20 } = $$props;
    	let { unrated = 30 } = $$props;

    	$$self.$$set = $$props => {
    		if ('good' in $$props) $$invalidate(0, good = $$props.good);
    		if ('bad' in $$props) $$invalidate(1, bad = $$props.bad);
    		if ('unrated' in $$props) $$invalidate(2, unrated = $$props.unrated);
    	};

    	return [good, bad, unrated];
    }

    class PieChart extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { good: 0, bad: 1, unrated: 2 });
    	}
    }

    /* src/reports/Reports.svelte generated by Svelte v3.52.0 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (50:8) {#each good_summaries as summary}
    function create_each_block_1(ctx) {
    	let tr;
    	let td0;
    	let a;
    	let t0_value = /*summary*/ ctx[6].post_title + "";
    	let t0;
    	let a_href_value;
    	let t1;
    	let td1;
    	let t2_value = /*summary*/ ctx[6].summary + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = /*summary*/ ctx[6].prompt + "";
    	let t4;
    	let t5;
    	let td3;
    	let t6_value = /*summary*/ ctx[6].user + "";
    	let t6;
    	let t7;

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
    			td3 = element("td");
    			t6 = text(t6_value);
    			t7 = space();
    			attr(a, "href", a_href_value = /*summary*/ ctx[6].post_permalink);
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
    			append(tr, td3);
    			append(td3, t6);
    			append(tr, t7);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*good_summaries*/ 1 && t0_value !== (t0_value = /*summary*/ ctx[6].post_title + "")) set_data(t0, t0_value);

    			if (dirty & /*good_summaries*/ 1 && a_href_value !== (a_href_value = /*summary*/ ctx[6].post_permalink)) {
    				attr(a, "href", a_href_value);
    			}

    			if (dirty & /*good_summaries*/ 1 && t2_value !== (t2_value = /*summary*/ ctx[6].summary + "")) set_data(t2, t2_value);
    			if (dirty & /*good_summaries*/ 1 && t4_value !== (t4_value = /*summary*/ ctx[6].prompt + "")) set_data(t4, t4_value);
    			if (dirty & /*good_summaries*/ 1 && t6_value !== (t6_value = /*summary*/ ctx[6].user + "")) set_data(t6, t6_value);
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    		}
    	};
    }

    // (72:8) {#each bad_summaries as summary}
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let a;
    	let t0_value = /*summary*/ ctx[6].post_title + "";
    	let t0;
    	let a_href_value;
    	let t1;
    	let td1;
    	let t2_value = /*summary*/ ctx[6].summary + "";
    	let t2;
    	let t3;
    	let td2;
    	let t4_value = /*summary*/ ctx[6].prompt + "";
    	let t4;
    	let t5;
    	let td3;
    	let t6_value = /*summary*/ ctx[6].user + "";
    	let t6;
    	let t7;

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
    			td3 = element("td");
    			t6 = text(t6_value);
    			t7 = space();
    			attr(a, "href", a_href_value = /*summary*/ ctx[6].post_permalink);
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
    			append(tr, td3);
    			append(td3, t6);
    			append(tr, t7);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*bad_summaries*/ 2 && t0_value !== (t0_value = /*summary*/ ctx[6].post_title + "")) set_data(t0, t0_value);

    			if (dirty & /*bad_summaries*/ 2 && a_href_value !== (a_href_value = /*summary*/ ctx[6].post_permalink)) {
    				attr(a, "href", a_href_value);
    			}

    			if (dirty & /*bad_summaries*/ 2 && t2_value !== (t2_value = /*summary*/ ctx[6].summary + "")) set_data(t2, t2_value);
    			if (dirty & /*bad_summaries*/ 2 && t4_value !== (t4_value = /*summary*/ ctx[6].prompt + "")) set_data(t4, t4_value);
    			if (dirty & /*bad_summaries*/ 2 && t6_value !== (t6_value = /*summary*/ ctx[6].user + "")) set_data(t6, t6_value);
    		},
    		d(detaching) {
    			if (detaching) detach(tr);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div2;
    	let div0;
    	let h30;
    	let t1;
    	let daychart;
    	let t2;
    	let div1;
    	let h31;
    	let t4;
    	let piechart;
    	let t5;
    	let h32;
    	let t7;
    	let table0;
    	let thead0;
    	let t15;
    	let tbody0;
    	let t16;
    	let h33;
    	let t18;
    	let table1;
    	let thead1;
    	let t26;
    	let tbody1;
    	let current;
    	daychart = new DayChart({});

    	piechart = new PieChart({
    			props: {
    				good: /*counts*/ ctx[2]?.find(/*func*/ ctx[3]).count || 0,
    				bad: /*counts*/ ctx[2]?.find(/*func_1*/ ctx[4]).count || 0,
    				unrated: /*counts*/ ctx[2]?.find(/*func_2*/ ctx[5]).count || 0
    			}
    		});

    	let each_value_1 = /*good_summaries*/ ctx[0];
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*bad_summaries*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div2 = element("div");
    			div0 = element("div");
    			h30 = element("h3");
    			h30.textContent = "Day Chart";
    			t1 = space();
    			create_component(daychart.$$.fragment);
    			t2 = space();
    			div1 = element("div");
    			h31 = element("h3");
    			h31.textContent = "Ratings";
    			t4 = space();
    			create_component(piechart.$$.fragment);
    			t5 = space();
    			h32 = element("h3");
    			h32.textContent = "Good Summaries";
    			t7 = space();
    			table0 = element("table");
    			thead0 = element("thead");

    			thead0.innerHTML = `<tr><th>Post Title</th> 
            <th>Summary</th> 
            <th>Prompt</th> 
            <th>User</th></tr>`;

    			t15 = space();
    			tbody0 = element("tbody");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t16 = space();
    			h33 = element("h3");
    			h33.textContent = "Bad Summaries";
    			t18 = space();
    			table1 = element("table");
    			thead1 = element("thead");

    			thead1.innerHTML = `<tr><th>Post Title</th> 
            <th>Summary</th> 
            <th>Prompt</th> 
            <th>User</th></tr>`;

    			t26 = space();
    			tbody1 = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div0, "id", "summaryEngineDayChart");
    			attr(div0, "class", "svelte-dmhftc");
    			attr(div1, "id", "summaryEnginePieChart");
    			attr(div1, "class", "svelte-dmhftc");
    			attr(div2, "id", "summaryEngineGraphs");
    			attr(div2, "class", "svelte-dmhftc");
    			attr(table0, "class", "wp-list-table widefat fixed striped table-view-list");
    			attr(table1, "class", "wp-list-table widefat fixed striped table-view-list");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div0, h30);
    			append(div0, t1);
    			mount_component(daychart, div0, null);
    			append(div2, t2);
    			append(div2, div1);
    			append(div1, h31);
    			append(div1, t4);
    			mount_component(piechart, div1, null);
    			insert(target, t5, anchor);
    			insert(target, h32, anchor);
    			insert(target, t7, anchor);
    			insert(target, table0, anchor);
    			append(table0, thead0);
    			append(table0, t15);
    			append(table0, tbody0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(tbody0, null);
    			}

    			insert(target, t16, anchor);
    			insert(target, h33, anchor);
    			insert(target, t18, anchor);
    			insert(target, table1, anchor);
    			append(table1, thead1);
    			append(table1, t26);
    			append(table1, tbody1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody1, null);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const piechart_changes = {};
    			if (dirty & /*counts*/ 4) piechart_changes.good = /*counts*/ ctx[2]?.find(/*func*/ ctx[3]).count || 0;
    			if (dirty & /*counts*/ 4) piechart_changes.bad = /*counts*/ ctx[2]?.find(/*func_1*/ ctx[4]).count || 0;
    			if (dirty & /*counts*/ 4) piechart_changes.unrated = /*counts*/ ctx[2]?.find(/*func_2*/ ctx[5]).count || 0;
    			piechart.$set(piechart_changes);

    			if (dirty & /*good_summaries*/ 1) {
    				each_value_1 = /*good_summaries*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(tbody0, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*bad_summaries*/ 2) {
    				each_value = /*bad_summaries*/ ctx[1];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(daychart.$$.fragment, local);
    			transition_in(piechart.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(daychart.$$.fragment, local);
    			transition_out(piechart.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div2);
    			destroy_component(daychart);
    			destroy_component(piechart);
    			if (detaching) detach(t5);
    			if (detaching) detach(h32);
    			if (detaching) detach(t7);
    			if (detaching) detach(table0);
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach(t16);
    			if (detaching) detach(h33);
    			if (detaching) detach(t18);
    			if (detaching) detach(table1);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let good_summaries = [];
    	let bad_summaries = [];
    	let counts;

    	onMount(async () => {
    		try {
    			const reports = await apiGet(`summaryengine/v1/reports`);
    			$$invalidate(0, good_summaries = reports.good_summaries);
    			$$invalidate(1, bad_summaries = reports.bad_summaries);
    			$$invalidate(2, counts = reports.counts);
    		} catch(e) {
    			console.error(e);
    		}
    	});

    	const func = d => Number(d.rating) === 1;
    	const func_1 = d => Number(d.rating) === -1;
    	const func_2 = d => Number(d.rating) === 0;
    	return [good_summaries, bad_summaries, counts, func, func_1, func_2];
    }

    class Reports extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, {});
    	}
    }

    const reports = new Reports({
        target: document.getElementById('summaryEngineReports'),
    });

    return reports;

})();
//# sourceMappingURL=summaryengine-reports.js.map
