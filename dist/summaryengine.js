(function () {
    'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter$1(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    var dist = {};

    var api = {};

    var axios$2 = {exports: {}};

    var axios$1 = {exports: {}};

    var bind$2 = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };

    var bind$1 = bind$2;

    // utils is a library of generic helper functions non-specific to axios

    var toString = Object.prototype.toString;

    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return Array.isArray(val);
    }

    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    /**
     * Determine if a value is a Buffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Buffer, otherwise false
     */
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
    }

    /**
     * Determine if a value is an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    function isArrayBuffer(val) {
      return toString.call(val) === '[object ArrayBuffer]';
    }

    /**
     * Determine if a value is a FormData
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(val) {
      return toString.call(val) === '[object FormData]';
    }

    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (isArrayBuffer(val.buffer));
      }
      return result;
    }

    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }

    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }

    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    /**
     * Determine if a value is a plain Object
     *
     * @param {Object} val The value to test
     * @return {boolean} True if value is a plain Object, otherwise false
     */
    function isPlainObject(val) {
      if (toString.call(val) !== '[object Object]') {
        return false;
      }

      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }

    /**
     * Determine if a value is a Date
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    function isDate(val) {
      return toString.call(val) === '[object Date]';
    }

    /**
     * Determine if a value is a File
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    function isFile(val) {
      return toString.call(val) === '[object File]';
    }

    /**
     * Determine if a value is a Blob
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    function isBlob(val) {
      return toString.call(val) === '[object Blob]';
    }

    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * Determine if a value is a URLSearchParams object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    function isURLSearchParams(val) {
      return toString.call(val) === '[object URLSearchParams]';
    }

    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
    }

    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }

      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind$1(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }

    /**
     * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
     *
     * @param {string} content with BOM
     * @return {string} content value without BOM
     */
    function stripBOM(content) {
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return content;
    }

    var utils$9 = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isPlainObject: isPlainObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      extend: extend,
      trim: trim,
      stripBOM: stripBOM
    };

    var utils$8 = utils$9;

    function encode(val) {
      return encodeURIComponent(val).
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }

    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    var buildURL$1 = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }

      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils$8.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];

        utils$8.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils$8.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }

          utils$8.forEach(val, function parseValue(v) {
            if (utils$8.isDate(v)) {
              v = v.toISOString();
            } else if (utils$8.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });

        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }

        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }

      return url;
    };

    var utils$7 = utils$9;

    function InterceptorManager$1() {
      this.handlers = [];
    }

    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager$1.prototype.use = function use(fulfilled, rejected, options) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected,
        synchronous: options ? options.synchronous : false,
        runWhen: options ? options.runWhen : null
      });
      return this.handlers.length - 1;
    };

    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager$1.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };

    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager$1.prototype.forEach = function forEach(fn) {
      utils$7.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };

    var InterceptorManager_1 = InterceptorManager$1;

    var utils$6 = utils$9;

    var normalizeHeaderName$1 = function normalizeHeaderName(headers, normalizedName) {
      utils$6.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };

    /**
     * Update an Error with the specified config, error code, and response.
     *
     * @param {Error} error The error to update.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The error.
     */
    var enhanceError$1 = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }

      error.request = request;
      error.response = response;
      error.isAxiosError = true;

      error.toJSON = function toJSON() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code,
          status: this.response && this.response.status ? this.response.status : null
        };
      };
      return error;
    };

    var transitional = {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    };

    var createError;
    var hasRequiredCreateError;

    function requireCreateError () {
    	if (hasRequiredCreateError) return createError;
    	hasRequiredCreateError = 1;

    	var enhanceError = enhanceError$1;

    	/**
    	 * Create an Error with the specified message, config, error code, request and response.
    	 *
    	 * @param {string} message The error message.
    	 * @param {Object} config The config.
    	 * @param {string} [code] The error code (for example, 'ECONNABORTED').
    	 * @param {Object} [request] The request.
    	 * @param {Object} [response] The response.
    	 * @returns {Error} The created error.
    	 */
    	createError = function createError(message, config, code, request, response) {
    	  var error = new Error(message);
    	  return enhanceError(error, config, code, request, response);
    	};
    	return createError;
    }

    var settle;
    var hasRequiredSettle;

    function requireSettle () {
    	if (hasRequiredSettle) return settle;
    	hasRequiredSettle = 1;

    	var createError = requireCreateError();

    	/**
    	 * Resolve or reject a Promise based on response status.
    	 *
    	 * @param {Function} resolve A function that resolves the promise.
    	 * @param {Function} reject A function that rejects the promise.
    	 * @param {object} response The response.
    	 */
    	settle = function settle(resolve, reject, response) {
    	  var validateStatus = response.config.validateStatus;
    	  if (!response.status || !validateStatus || validateStatus(response.status)) {
    	    resolve(response);
    	  } else {
    	    reject(createError(
    	      'Request failed with status code ' + response.status,
    	      response.config,
    	      null,
    	      response.request,
    	      response
    	    ));
    	  }
    	};
    	return settle;
    }

    var cookies;
    var hasRequiredCookies;

    function requireCookies () {
    	if (hasRequiredCookies) return cookies;
    	hasRequiredCookies = 1;

    	var utils = utils$9;

    	cookies = (
    	  utils.isStandardBrowserEnv() ?

    	  // Standard browser envs support document.cookie
    	    (function standardBrowserEnv() {
    	      return {
    	        write: function write(name, value, expires, path, domain, secure) {
    	          var cookie = [];
    	          cookie.push(name + '=' + encodeURIComponent(value));

    	          if (utils.isNumber(expires)) {
    	            cookie.push('expires=' + new Date(expires).toGMTString());
    	          }

    	          if (utils.isString(path)) {
    	            cookie.push('path=' + path);
    	          }

    	          if (utils.isString(domain)) {
    	            cookie.push('domain=' + domain);
    	          }

    	          if (secure === true) {
    	            cookie.push('secure');
    	          }

    	          document.cookie = cookie.join('; ');
    	        },

    	        read: function read(name) {
    	          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    	          return (match ? decodeURIComponent(match[3]) : null);
    	        },

    	        remove: function remove(name) {
    	          this.write(name, '', Date.now() - 86400000);
    	        }
    	      };
    	    })() :

    	  // Non standard browser env (web workers, react-native) lack needed support.
    	    (function nonStandardBrowserEnv() {
    	      return {
    	        write: function write() {},
    	        read: function read() { return null; },
    	        remove: function remove() {}
    	      };
    	    })()
    	);
    	return cookies;
    }

    var isAbsoluteURL;
    var hasRequiredIsAbsoluteURL;

    function requireIsAbsoluteURL () {
    	if (hasRequiredIsAbsoluteURL) return isAbsoluteURL;
    	hasRequiredIsAbsoluteURL = 1;

    	/**
    	 * Determines whether the specified URL is absolute
    	 *
    	 * @param {string} url The URL to test
    	 * @returns {boolean} True if the specified URL is absolute, otherwise false
    	 */
    	isAbsoluteURL = function isAbsoluteURL(url) {
    	  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
    	  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
    	  // by any combination of letters, digits, plus, period, or hyphen.
    	  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
    	};
    	return isAbsoluteURL;
    }

    var combineURLs;
    var hasRequiredCombineURLs;

    function requireCombineURLs () {
    	if (hasRequiredCombineURLs) return combineURLs;
    	hasRequiredCombineURLs = 1;

    	/**
    	 * Creates a new URL by combining the specified URLs
    	 *
    	 * @param {string} baseURL The base URL
    	 * @param {string} relativeURL The relative URL
    	 * @returns {string} The combined URL
    	 */
    	combineURLs = function combineURLs(baseURL, relativeURL) {
    	  return relativeURL
    	    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    	    : baseURL;
    	};
    	return combineURLs;
    }

    var buildFullPath;
    var hasRequiredBuildFullPath;

    function requireBuildFullPath () {
    	if (hasRequiredBuildFullPath) return buildFullPath;
    	hasRequiredBuildFullPath = 1;

    	var isAbsoluteURL = requireIsAbsoluteURL();
    	var combineURLs = requireCombineURLs();

    	/**
    	 * Creates a new URL by combining the baseURL with the requestedURL,
    	 * only when the requestedURL is not already an absolute URL.
    	 * If the requestURL is absolute, this function returns the requestedURL untouched.
    	 *
    	 * @param {string} baseURL The base URL
    	 * @param {string} requestedURL Absolute or relative URL to combine
    	 * @returns {string} The combined full path
    	 */
    	buildFullPath = function buildFullPath(baseURL, requestedURL) {
    	  if (baseURL && !isAbsoluteURL(requestedURL)) {
    	    return combineURLs(baseURL, requestedURL);
    	  }
    	  return requestedURL;
    	};
    	return buildFullPath;
    }

    var parseHeaders;
    var hasRequiredParseHeaders;

    function requireParseHeaders () {
    	if (hasRequiredParseHeaders) return parseHeaders;
    	hasRequiredParseHeaders = 1;

    	var utils = utils$9;

    	// Headers whose duplicates are ignored by node
    	// c.f. https://nodejs.org/api/http.html#http_message_headers
    	var ignoreDuplicateOf = [
    	  'age', 'authorization', 'content-length', 'content-type', 'etag',
    	  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
    	  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
    	  'referer', 'retry-after', 'user-agent'
    	];

    	/**
    	 * Parse headers into an object
    	 *
    	 * ```
    	 * Date: Wed, 27 Aug 2014 08:58:49 GMT
    	 * Content-Type: application/json
    	 * Connection: keep-alive
    	 * Transfer-Encoding: chunked
    	 * ```
    	 *
    	 * @param {String} headers Headers needing to be parsed
    	 * @returns {Object} Headers parsed into an object
    	 */
    	parseHeaders = function parseHeaders(headers) {
    	  var parsed = {};
    	  var key;
    	  var val;
    	  var i;

    	  if (!headers) { return parsed; }

    	  utils.forEach(headers.split('\n'), function parser(line) {
    	    i = line.indexOf(':');
    	    key = utils.trim(line.substr(0, i)).toLowerCase();
    	    val = utils.trim(line.substr(i + 1));

    	    if (key) {
    	      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
    	        return;
    	      }
    	      if (key === 'set-cookie') {
    	        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
    	      } else {
    	        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
    	      }
    	    }
    	  });

    	  return parsed;
    	};
    	return parseHeaders;
    }

    var isURLSameOrigin;
    var hasRequiredIsURLSameOrigin;

    function requireIsURLSameOrigin () {
    	if (hasRequiredIsURLSameOrigin) return isURLSameOrigin;
    	hasRequiredIsURLSameOrigin = 1;

    	var utils = utils$9;

    	isURLSameOrigin = (
    	  utils.isStandardBrowserEnv() ?

    	  // Standard browser envs have full support of the APIs needed to test
    	  // whether the request URL is of the same origin as current location.
    	    (function standardBrowserEnv() {
    	      var msie = /(msie|trident)/i.test(navigator.userAgent);
    	      var urlParsingNode = document.createElement('a');
    	      var originURL;

    	      /**
    	    * Parse a URL to discover it's components
    	    *
    	    * @param {String} url The URL to be parsed
    	    * @returns {Object}
    	    */
    	      function resolveURL(url) {
    	        var href = url;

    	        if (msie) {
    	        // IE needs attribute set twice to normalize properties
    	          urlParsingNode.setAttribute('href', href);
    	          href = urlParsingNode.href;
    	        }

    	        urlParsingNode.setAttribute('href', href);

    	        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
    	        return {
    	          href: urlParsingNode.href,
    	          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
    	          host: urlParsingNode.host,
    	          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
    	          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
    	          hostname: urlParsingNode.hostname,
    	          port: urlParsingNode.port,
    	          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
    	            urlParsingNode.pathname :
    	            '/' + urlParsingNode.pathname
    	        };
    	      }

    	      originURL = resolveURL(window.location.href);

    	      /**
    	    * Determine if a URL shares the same origin as the current location
    	    *
    	    * @param {String} requestURL The URL to test
    	    * @returns {boolean} True if URL shares the same origin, otherwise false
    	    */
    	      return function isURLSameOrigin(requestURL) {
    	        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
    	        return (parsed.protocol === originURL.protocol &&
    	            parsed.host === originURL.host);
    	      };
    	    })() :

    	  // Non standard browser envs (web workers, react-native) lack needed support.
    	    (function nonStandardBrowserEnv() {
    	      return function isURLSameOrigin() {
    	        return true;
    	      };
    	    })()
    	);
    	return isURLSameOrigin;
    }

    var Cancel_1;
    var hasRequiredCancel;

    function requireCancel () {
    	if (hasRequiredCancel) return Cancel_1;
    	hasRequiredCancel = 1;

    	/**
    	 * A `Cancel` is an object that is thrown when an operation is canceled.
    	 *
    	 * @class
    	 * @param {string=} message The message.
    	 */
    	function Cancel(message) {
    	  this.message = message;
    	}

    	Cancel.prototype.toString = function toString() {
    	  return 'Cancel' + (this.message ? ': ' + this.message : '');
    	};

    	Cancel.prototype.__CANCEL__ = true;

    	Cancel_1 = Cancel;
    	return Cancel_1;
    }

    var xhr;
    var hasRequiredXhr;

    function requireXhr () {
    	if (hasRequiredXhr) return xhr;
    	hasRequiredXhr = 1;

    	var utils = utils$9;
    	var settle = requireSettle();
    	var cookies = requireCookies();
    	var buildURL = buildURL$1;
    	var buildFullPath = requireBuildFullPath();
    	var parseHeaders = requireParseHeaders();
    	var isURLSameOrigin = requireIsURLSameOrigin();
    	var createError = requireCreateError();
    	var transitionalDefaults = transitional;
    	var Cancel = requireCancel();

    	xhr = function xhrAdapter(config) {
    	  return new Promise(function dispatchXhrRequest(resolve, reject) {
    	    var requestData = config.data;
    	    var requestHeaders = config.headers;
    	    var responseType = config.responseType;
    	    var onCanceled;
    	    function done() {
    	      if (config.cancelToken) {
    	        config.cancelToken.unsubscribe(onCanceled);
    	      }

    	      if (config.signal) {
    	        config.signal.removeEventListener('abort', onCanceled);
    	      }
    	    }

    	    if (utils.isFormData(requestData)) {
    	      delete requestHeaders['Content-Type']; // Let the browser set it
    	    }

    	    var request = new XMLHttpRequest();

    	    // HTTP basic authentication
    	    if (config.auth) {
    	      var username = config.auth.username || '';
    	      var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
    	      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    	    }

    	    var fullPath = buildFullPath(config.baseURL, config.url);
    	    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

    	    // Set the request timeout in MS
    	    request.timeout = config.timeout;

    	    function onloadend() {
    	      if (!request) {
    	        return;
    	      }
    	      // Prepare the response
    	      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
    	      var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
    	        request.responseText : request.response;
    	      var response = {
    	        data: responseData,
    	        status: request.status,
    	        statusText: request.statusText,
    	        headers: responseHeaders,
    	        config: config,
    	        request: request
    	      };

    	      settle(function _resolve(value) {
    	        resolve(value);
    	        done();
    	      }, function _reject(err) {
    	        reject(err);
    	        done();
    	      }, response);

    	      // Clean up request
    	      request = null;
    	    }

    	    if ('onloadend' in request) {
    	      // Use onloadend if available
    	      request.onloadend = onloadend;
    	    } else {
    	      // Listen for ready state to emulate onloadend
    	      request.onreadystatechange = function handleLoad() {
    	        if (!request || request.readyState !== 4) {
    	          return;
    	        }

    	        // The request errored out and we didn't get a response, this will be
    	        // handled by onerror instead
    	        // With one exception: request that using file: protocol, most browsers
    	        // will return status as 0 even though it's a successful request
    	        if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
    	          return;
    	        }
    	        // readystate handler is calling before onerror or ontimeout handlers,
    	        // so we should call onloadend on the next 'tick'
    	        setTimeout(onloadend);
    	      };
    	    }

    	    // Handle browser request cancellation (as opposed to a manual cancellation)
    	    request.onabort = function handleAbort() {
    	      if (!request) {
    	        return;
    	      }

    	      reject(createError('Request aborted', config, 'ECONNABORTED', request));

    	      // Clean up request
    	      request = null;
    	    };

    	    // Handle low level network errors
    	    request.onerror = function handleError() {
    	      // Real errors are hidden from us by the browser
    	      // onerror should only fire if it's a network error
    	      reject(createError('Network Error', config, null, request));

    	      // Clean up request
    	      request = null;
    	    };

    	    // Handle timeout
    	    request.ontimeout = function handleTimeout() {
    	      var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
    	      var transitional = config.transitional || transitionalDefaults;
    	      if (config.timeoutErrorMessage) {
    	        timeoutErrorMessage = config.timeoutErrorMessage;
    	      }
    	      reject(createError(
    	        timeoutErrorMessage,
    	        config,
    	        transitional.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
    	        request));

    	      // Clean up request
    	      request = null;
    	    };

    	    // Add xsrf header
    	    // This is only done if running in a standard browser environment.
    	    // Specifically not if we're in a web worker, or react-native.
    	    if (utils.isStandardBrowserEnv()) {
    	      // Add xsrf header
    	      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
    	        cookies.read(config.xsrfCookieName) :
    	        undefined;

    	      if (xsrfValue) {
    	        requestHeaders[config.xsrfHeaderName] = xsrfValue;
    	      }
    	    }

    	    // Add headers to the request
    	    if ('setRequestHeader' in request) {
    	      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
    	        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
    	          // Remove Content-Type if data is undefined
    	          delete requestHeaders[key];
    	        } else {
    	          // Otherwise add header to the request
    	          request.setRequestHeader(key, val);
    	        }
    	      });
    	    }

    	    // Add withCredentials to request if needed
    	    if (!utils.isUndefined(config.withCredentials)) {
    	      request.withCredentials = !!config.withCredentials;
    	    }

    	    // Add responseType to request if needed
    	    if (responseType && responseType !== 'json') {
    	      request.responseType = config.responseType;
    	    }

    	    // Handle progress if needed
    	    if (typeof config.onDownloadProgress === 'function') {
    	      request.addEventListener('progress', config.onDownloadProgress);
    	    }

    	    // Not all browsers support upload events
    	    if (typeof config.onUploadProgress === 'function' && request.upload) {
    	      request.upload.addEventListener('progress', config.onUploadProgress);
    	    }

    	    if (config.cancelToken || config.signal) {
    	      // Handle cancellation
    	      // eslint-disable-next-line func-names
    	      onCanceled = function(cancel) {
    	        if (!request) {
    	          return;
    	        }
    	        reject(!cancel || (cancel && cancel.type) ? new Cancel('canceled') : cancel);
    	        request.abort();
    	        request = null;
    	      };

    	      config.cancelToken && config.cancelToken.subscribe(onCanceled);
    	      if (config.signal) {
    	        config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
    	      }
    	    }

    	    if (!requestData) {
    	      requestData = null;
    	    }

    	    // Send the request
    	    request.send(requestData);
    	  });
    	};
    	return xhr;
    }

    var utils$5 = utils$9;
    var normalizeHeaderName = normalizeHeaderName$1;
    var enhanceError = enhanceError$1;
    var transitionalDefaults = transitional;

    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    function setContentTypeIfUnset(headers, value) {
      if (!utils$5.isUndefined(headers) && utils$5.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = requireXhr();
      } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = requireXhr();
      }
      return adapter;
    }

    function stringifySafely(rawValue, parser, encoder) {
      if (utils$5.isString(rawValue)) {
        try {
          (parser || JSON.parse)(rawValue);
          return utils$5.trim(rawValue);
        } catch (e) {
          if (e.name !== 'SyntaxError') {
            throw e;
          }
        }
      }

      return (encoder || JSON.stringify)(rawValue);
    }

    var defaults$3 = {

      transitional: transitionalDefaults,

      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');

        if (utils$5.isFormData(data) ||
          utils$5.isArrayBuffer(data) ||
          utils$5.isBuffer(data) ||
          utils$5.isStream(data) ||
          utils$5.isFile(data) ||
          utils$5.isBlob(data)
        ) {
          return data;
        }
        if (utils$5.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils$5.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }
        if (utils$5.isObject(data) || (headers && headers['Content-Type'] === 'application/json')) {
          setContentTypeIfUnset(headers, 'application/json');
          return stringifySafely(data);
        }
        return data;
      }],

      transformResponse: [function transformResponse(data) {
        var transitional = this.transitional || defaults$3.transitional;
        var silentJSONParsing = transitional && transitional.silentJSONParsing;
        var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
        var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

        if (strictJSONParsing || (forcedJSONParsing && utils$5.isString(data) && data.length)) {
          try {
            return JSON.parse(data);
          } catch (e) {
            if (strictJSONParsing) {
              if (e.name === 'SyntaxError') {
                throw enhanceError(e, this, 'E_JSON_PARSE');
              }
              throw e;
            }
          }
        }

        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,
      maxBodyLength: -1,

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      },

      headers: {
        common: {
          'Accept': 'application/json, text/plain, */*'
        }
      }
    };

    utils$5.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults$3.headers[method] = {};
    });

    utils$5.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults$3.headers[method] = utils$5.merge(DEFAULT_CONTENT_TYPE);
    });

    var defaults_1 = defaults$3;

    var utils$4 = utils$9;
    var defaults$2 = defaults_1;

    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    var transformData$1 = function transformData(data, headers, fns) {
      var context = this || defaults$2;
      /*eslint no-param-reassign:0*/
      utils$4.forEach(fns, function transform(fn) {
        data = fn.call(context, data, headers);
      });

      return data;
    };

    var isCancel$1;
    var hasRequiredIsCancel;

    function requireIsCancel () {
    	if (hasRequiredIsCancel) return isCancel$1;
    	hasRequiredIsCancel = 1;

    	isCancel$1 = function isCancel(value) {
    	  return !!(value && value.__CANCEL__);
    	};
    	return isCancel$1;
    }

    var utils$3 = utils$9;
    var transformData = transformData$1;
    var isCancel = requireIsCancel();
    var defaults$1 = defaults_1;
    var Cancel = requireCancel();

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }

      if (config.signal && config.signal.aborted) {
        throw new Cancel('canceled');
      }
    }

    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    var dispatchRequest$1 = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // Ensure headers exist
      config.headers = config.headers || {};

      // Transform request data
      config.data = transformData.call(
        config,
        config.data,
        config.headers,
        config.transformRequest
      );

      // Flatten headers
      config.headers = utils$3.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );

      utils$3.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );

      var adapter = config.adapter || defaults$1.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData.call(
          config,
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData.call(
              config,
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }

        return Promise.reject(reason);
      });
    };

    var utils$2 = utils$9;

    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    var mergeConfig$2 = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};

      function getMergedValue(target, source) {
        if (utils$2.isPlainObject(target) && utils$2.isPlainObject(source)) {
          return utils$2.merge(target, source);
        } else if (utils$2.isPlainObject(source)) {
          return utils$2.merge({}, source);
        } else if (utils$2.isArray(source)) {
          return source.slice();
        }
        return source;
      }

      // eslint-disable-next-line consistent-return
      function mergeDeepProperties(prop) {
        if (!utils$2.isUndefined(config2[prop])) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (!utils$2.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function valueFromConfig2(prop) {
        if (!utils$2.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function defaultToConfig2(prop) {
        if (!utils$2.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        } else if (!utils$2.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function mergeDirectKeys(prop) {
        if (prop in config2) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      var mergeMap = {
        'url': valueFromConfig2,
        'method': valueFromConfig2,
        'data': valueFromConfig2,
        'baseURL': defaultToConfig2,
        'transformRequest': defaultToConfig2,
        'transformResponse': defaultToConfig2,
        'paramsSerializer': defaultToConfig2,
        'timeout': defaultToConfig2,
        'timeoutMessage': defaultToConfig2,
        'withCredentials': defaultToConfig2,
        'adapter': defaultToConfig2,
        'responseType': defaultToConfig2,
        'xsrfCookieName': defaultToConfig2,
        'xsrfHeaderName': defaultToConfig2,
        'onUploadProgress': defaultToConfig2,
        'onDownloadProgress': defaultToConfig2,
        'decompress': defaultToConfig2,
        'maxContentLength': defaultToConfig2,
        'maxBodyLength': defaultToConfig2,
        'transport': defaultToConfig2,
        'httpAgent': defaultToConfig2,
        'httpsAgent': defaultToConfig2,
        'cancelToken': defaultToConfig2,
        'socketPath': defaultToConfig2,
        'responseEncoding': defaultToConfig2,
        'validateStatus': mergeDirectKeys
      };

      utils$2.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
        var merge = mergeMap[prop] || mergeDeepProperties;
        var configValue = merge(prop);
        (utils$2.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
      });

      return config;
    };

    var data;
    var hasRequiredData;

    function requireData () {
    	if (hasRequiredData) return data;
    	hasRequiredData = 1;
    	data = {
    	  "version": "0.26.1"
    	};
    	return data;
    }

    var VERSION = requireData().version;

    var validators$1 = {};

    // eslint-disable-next-line func-names
    ['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
      validators$1[type] = function validator(thing) {
        return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
      };
    });

    var deprecatedWarnings = {};

    /**
     * Transitional option validator
     * @param {function|boolean?} validator - set to false if the transitional option has been removed
     * @param {string?} version - deprecated version / removed since version
     * @param {string?} message - some message with additional info
     * @returns {function}
     */
    validators$1.transitional = function transitional(validator, version, message) {
      function formatMessage(opt, desc) {
        return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
      }

      // eslint-disable-next-line func-names
      return function(value, opt, opts) {
        if (validator === false) {
          throw new Error(formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')));
        }

        if (version && !deprecatedWarnings[opt]) {
          deprecatedWarnings[opt] = true;
          // eslint-disable-next-line no-console
          console.warn(
            formatMessage(
              opt,
              ' has been deprecated since v' + version + ' and will be removed in the near future'
            )
          );
        }

        return validator ? validator(value, opt, opts) : true;
      };
    };

    /**
     * Assert object's properties type
     * @param {object} options
     * @param {object} schema
     * @param {boolean?} allowUnknown
     */

    function assertOptions(options, schema, allowUnknown) {
      if (typeof options !== 'object') {
        throw new TypeError('options must be an object');
      }
      var keys = Object.keys(options);
      var i = keys.length;
      while (i-- > 0) {
        var opt = keys[i];
        var validator = schema[opt];
        if (validator) {
          var value = options[opt];
          var result = value === undefined || validator(value, opt, options);
          if (result !== true) {
            throw new TypeError('option ' + opt + ' must be ' + result);
          }
          continue;
        }
        if (allowUnknown !== true) {
          throw Error('Unknown option ' + opt);
        }
      }
    }

    var validator$1 = {
      assertOptions: assertOptions,
      validators: validators$1
    };

    var utils$1 = utils$9;
    var buildURL = buildURL$1;
    var InterceptorManager = InterceptorManager_1;
    var dispatchRequest = dispatchRequest$1;
    var mergeConfig$1 = mergeConfig$2;
    var validator = validator$1;

    var validators = validator.validators;
    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios$1(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager()
      };
    }

    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios$1.prototype.request = function request(configOrUrl, config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof configOrUrl === 'string') {
        config = config || {};
        config.url = configOrUrl;
      } else {
        config = configOrUrl || {};
      }

      config = mergeConfig$1(this.defaults, config);

      // Set config.method
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }

      var transitional = config.transitional;

      if (transitional !== undefined) {
        validator.assertOptions(transitional, {
          silentJSONParsing: validators.transitional(validators.boolean),
          forcedJSONParsing: validators.transitional(validators.boolean),
          clarifyTimeoutError: validators.transitional(validators.boolean)
        }, false);
      }

      // filter out skipped interceptors
      var requestInterceptorChain = [];
      var synchronousRequestInterceptors = true;
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
          return;
        }

        synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      });

      var responseInterceptorChain = [];
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      });

      var promise;

      if (!synchronousRequestInterceptors) {
        var chain = [dispatchRequest, undefined];

        Array.prototype.unshift.apply(chain, requestInterceptorChain);
        chain = chain.concat(responseInterceptorChain);

        promise = Promise.resolve(config);
        while (chain.length) {
          promise = promise.then(chain.shift(), chain.shift());
        }

        return promise;
      }


      var newConfig = config;
      while (requestInterceptorChain.length) {
        var onFulfilled = requestInterceptorChain.shift();
        var onRejected = requestInterceptorChain.shift();
        try {
          newConfig = onFulfilled(newConfig);
        } catch (error) {
          onRejected(error);
          break;
        }
      }

      try {
        promise = dispatchRequest(newConfig);
      } catch (error) {
        return Promise.reject(error);
      }

      while (responseInterceptorChain.length) {
        promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
      }

      return promise;
    };

    Axios$1.prototype.getUri = function getUri(config) {
      config = mergeConfig$1(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
    };

    // Provide aliases for supported request methods
    utils$1.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios$1.prototype[method] = function(url, config) {
        return this.request(mergeConfig$1(config || {}, {
          method: method,
          url: url,
          data: (config || {}).data
        }));
      };
    });

    utils$1.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/
      Axios$1.prototype[method] = function(url, data, config) {
        return this.request(mergeConfig$1(config || {}, {
          method: method,
          url: url,
          data: data
        }));
      };
    });

    var Axios_1 = Axios$1;

    var CancelToken_1;
    var hasRequiredCancelToken;

    function requireCancelToken () {
    	if (hasRequiredCancelToken) return CancelToken_1;
    	hasRequiredCancelToken = 1;

    	var Cancel = requireCancel();

    	/**
    	 * A `CancelToken` is an object that can be used to request cancellation of an operation.
    	 *
    	 * @class
    	 * @param {Function} executor The executor function.
    	 */
    	function CancelToken(executor) {
    	  if (typeof executor !== 'function') {
    	    throw new TypeError('executor must be a function.');
    	  }

    	  var resolvePromise;

    	  this.promise = new Promise(function promiseExecutor(resolve) {
    	    resolvePromise = resolve;
    	  });

    	  var token = this;

    	  // eslint-disable-next-line func-names
    	  this.promise.then(function(cancel) {
    	    if (!token._listeners) return;

    	    var i;
    	    var l = token._listeners.length;

    	    for (i = 0; i < l; i++) {
    	      token._listeners[i](cancel);
    	    }
    	    token._listeners = null;
    	  });

    	  // eslint-disable-next-line func-names
    	  this.promise.then = function(onfulfilled) {
    	    var _resolve;
    	    // eslint-disable-next-line func-names
    	    var promise = new Promise(function(resolve) {
    	      token.subscribe(resolve);
    	      _resolve = resolve;
    	    }).then(onfulfilled);

    	    promise.cancel = function reject() {
    	      token.unsubscribe(_resolve);
    	    };

    	    return promise;
    	  };

    	  executor(function cancel(message) {
    	    if (token.reason) {
    	      // Cancellation has already been requested
    	      return;
    	    }

    	    token.reason = new Cancel(message);
    	    resolvePromise(token.reason);
    	  });
    	}

    	/**
    	 * Throws a `Cancel` if cancellation has been requested.
    	 */
    	CancelToken.prototype.throwIfRequested = function throwIfRequested() {
    	  if (this.reason) {
    	    throw this.reason;
    	  }
    	};

    	/**
    	 * Subscribe to the cancel signal
    	 */

    	CancelToken.prototype.subscribe = function subscribe(listener) {
    	  if (this.reason) {
    	    listener(this.reason);
    	    return;
    	  }

    	  if (this._listeners) {
    	    this._listeners.push(listener);
    	  } else {
    	    this._listeners = [listener];
    	  }
    	};

    	/**
    	 * Unsubscribe from the cancel signal
    	 */

    	CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
    	  if (!this._listeners) {
    	    return;
    	  }
    	  var index = this._listeners.indexOf(listener);
    	  if (index !== -1) {
    	    this._listeners.splice(index, 1);
    	  }
    	};

    	/**
    	 * Returns an object that contains a new `CancelToken` and a function that, when called,
    	 * cancels the `CancelToken`.
    	 */
    	CancelToken.source = function source() {
    	  var cancel;
    	  var token = new CancelToken(function executor(c) {
    	    cancel = c;
    	  });
    	  return {
    	    token: token,
    	    cancel: cancel
    	  };
    	};

    	CancelToken_1 = CancelToken;
    	return CancelToken_1;
    }

    var spread;
    var hasRequiredSpread;

    function requireSpread () {
    	if (hasRequiredSpread) return spread;
    	hasRequiredSpread = 1;

    	/**
    	 * Syntactic sugar for invoking a function and expanding an array for arguments.
    	 *
    	 * Common use case would be to use `Function.prototype.apply`.
    	 *
    	 *  ```js
    	 *  function f(x, y, z) {}
    	 *  var args = [1, 2, 3];
    	 *  f.apply(null, args);
    	 *  ```
    	 *
    	 * With `spread` this example can be re-written.
    	 *
    	 *  ```js
    	 *  spread(function(x, y, z) {})([1, 2, 3]);
    	 *  ```
    	 *
    	 * @param {Function} callback
    	 * @returns {Function}
    	 */
    	spread = function spread(callback) {
    	  return function wrap(arr) {
    	    return callback.apply(null, arr);
    	  };
    	};
    	return spread;
    }

    var isAxiosError;
    var hasRequiredIsAxiosError;

    function requireIsAxiosError () {
    	if (hasRequiredIsAxiosError) return isAxiosError;
    	hasRequiredIsAxiosError = 1;

    	var utils = utils$9;

    	/**
    	 * Determines whether the payload is an error thrown by Axios
    	 *
    	 * @param {*} payload The value to test
    	 * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
    	 */
    	isAxiosError = function isAxiosError(payload) {
    	  return utils.isObject(payload) && (payload.isAxiosError === true);
    	};
    	return isAxiosError;
    }

    var utils = utils$9;
    var bind = bind$2;
    var Axios = Axios_1;
    var mergeConfig = mergeConfig$2;
    var defaults = defaults_1;

    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios(defaultConfig);
      var instance = bind(Axios.prototype.request, context);

      // Copy axios.prototype to instance
      utils.extend(instance, Axios.prototype, context);

      // Copy context to instance
      utils.extend(instance, context);

      // Factory for creating new instances
      instance.create = function create(instanceConfig) {
        return createInstance(mergeConfig(defaultConfig, instanceConfig));
      };

      return instance;
    }

    // Create the default instance to be exported
    var axios = createInstance(defaults);

    // Expose Axios class to allow class inheritance
    axios.Axios = Axios;

    // Expose Cancel & CancelToken
    axios.Cancel = requireCancel();
    axios.CancelToken = requireCancelToken();
    axios.isCancel = requireIsCancel();
    axios.VERSION = requireData().version;

    // Expose all/spread
    axios.all = function all(promises) {
      return Promise.all(promises);
    };
    axios.spread = requireSpread();

    // Expose isAxiosError
    axios.isAxiosError = requireIsAxiosError();

    axios$1.exports = axios;

    // Allow use of default import syntax in TypeScript
    axios$1.exports.default = axios;

    (function (module) {
    	module.exports = axios$1.exports;
    } (axios$2));

    var common = {};

    var base = {};

    (function (exports) {
    	/* tslint:disable */
    	/* eslint-disable */
    	/**
    	 * OpenAI API
    	 * APIs for sampling from and fine-tuning language models
    	 *
    	 * The version of the OpenAPI document: 1.0.5
    	 *
    	 *
    	 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
    	 * https://openapi-generator.tech
    	 * Do not edit the class manually.
    	 */
    	Object.defineProperty(exports, "__esModule", { value: true });
    	exports.RequiredError = exports.BaseAPI = exports.COLLECTION_FORMATS = exports.BASE_PATH = void 0;
    	// Some imports not used depending on template conditions
    	// @ts-ignore
    	const axios_1 = axios$2.exports;
    	exports.BASE_PATH = "https://api.openai.com/v1".replace(/\/+$/, "");
    	/**
    	 *
    	 * @export
    	 */
    	exports.COLLECTION_FORMATS = {
    	    csv: ",",
    	    ssv: " ",
    	    tsv: "\t",
    	    pipes: "|",
    	};
    	/**
    	 *
    	 * @export
    	 * @class BaseAPI
    	 */
    	class BaseAPI {
    	    constructor(configuration, basePath = exports.BASE_PATH, axios = axios_1.default) {
    	        this.basePath = basePath;
    	        this.axios = axios;
    	        if (configuration) {
    	            this.configuration = configuration;
    	            this.basePath = configuration.basePath || this.basePath;
    	        }
    	    }
    	}
    	exports.BaseAPI = BaseAPI;
    	/**
    	 *
    	 * @export
    	 * @class RequiredError
    	 * @extends {Error}
    	 */
    	class RequiredError extends Error {
    	    constructor(field, msg) {
    	        super(msg);
    	        this.field = field;
    	        this.name = "RequiredError";
    	    }
    	}
    	exports.RequiredError = RequiredError;
    } (base));

    /* tslint:disable */
    /* eslint-disable */
    /**
     * OpenAI API
     * APIs for sampling from and fine-tuning language models
     *
     * The version of the OpenAPI document: 1.0.5
     *
     *
     * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
     * https://openapi-generator.tech
     * Do not edit the class manually.
     */
    var __awaiter = (commonjsGlobal && commonjsGlobal.__awaiter) || function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
    Object.defineProperty(common, "__esModule", { value: true });
    common.createRequestFunction = common.toPathString = common.serializeDataIfNeeded = common.setSearchParams = common.setOAuthToObject = common.setBearerAuthToObject = common.setBasicAuthToObject = common.setApiKeyToObject = common.assertParamExists = common.DUMMY_BASE_URL = void 0;
    const base_1 = base;
    /**
     *
     * @export
     */
    common.DUMMY_BASE_URL = 'https://example.com';
    /**
     *
     * @throws {RequiredError}
     * @export
     */
    common.assertParamExists = function (functionName, paramName, paramValue) {
        if (paramValue === null || paramValue === undefined) {
            throw new base_1.RequiredError(paramName, `Required parameter ${paramName} was null or undefined when calling ${functionName}.`);
        }
    };
    /**
     *
     * @export
     */
    common.setApiKeyToObject = function (object, keyParamName, configuration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (configuration && configuration.apiKey) {
                const localVarApiKeyValue = typeof configuration.apiKey === 'function'
                    ? yield configuration.apiKey(keyParamName)
                    : yield configuration.apiKey;
                object[keyParamName] = localVarApiKeyValue;
            }
        });
    };
    /**
     *
     * @export
     */
    common.setBasicAuthToObject = function (object, configuration) {
        if (configuration && (configuration.username || configuration.password)) {
            object["auth"] = { username: configuration.username, password: configuration.password };
        }
    };
    /**
     *
     * @export
     */
    common.setBearerAuthToObject = function (object, configuration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (configuration && configuration.accessToken) {
                const accessToken = typeof configuration.accessToken === 'function'
                    ? yield configuration.accessToken()
                    : yield configuration.accessToken;
                object["Authorization"] = "Bearer " + accessToken;
            }
        });
    };
    /**
     *
     * @export
     */
    common.setOAuthToObject = function (object, name, scopes, configuration) {
        return __awaiter(this, void 0, void 0, function* () {
            if (configuration && configuration.accessToken) {
                const localVarAccessTokenValue = typeof configuration.accessToken === 'function'
                    ? yield configuration.accessToken(name, scopes)
                    : yield configuration.accessToken;
                object["Authorization"] = "Bearer " + localVarAccessTokenValue;
            }
        });
    };
    /**
     *
     * @export
     */
    common.setSearchParams = function (url, ...objects) {
        const searchParams = new URLSearchParams(url.search);
        for (const object of objects) {
            for (const key in object) {
                if (Array.isArray(object[key])) {
                    searchParams.delete(key);
                    for (const item of object[key]) {
                        searchParams.append(key, item);
                    }
                }
                else {
                    searchParams.set(key, object[key]);
                }
            }
        }
        url.search = searchParams.toString();
    };
    /**
     *
     * @export
     */
    common.serializeDataIfNeeded = function (value, requestOptions, configuration) {
        const nonString = typeof value !== 'string';
        const needsSerialization = nonString && configuration && configuration.isJsonMime
            ? configuration.isJsonMime(requestOptions.headers['Content-Type'])
            : nonString;
        return needsSerialization
            ? JSON.stringify(value !== undefined ? value : {})
            : (value || "");
    };
    /**
     *
     * @export
     */
    common.toPathString = function (url) {
        return url.pathname + url.search + url.hash;
    };
    /**
     *
     * @export
     */
    common.createRequestFunction = function (axiosArgs, globalAxios, BASE_PATH, configuration) {
        return (axios = globalAxios, basePath = BASE_PATH) => {
            const axiosRequestArgs = Object.assign(Object.assign({}, axiosArgs.options), { url: ((configuration === null || configuration === void 0 ? void 0 : configuration.basePath) || basePath) + axiosArgs.url });
            return axios.request(axiosRequestArgs);
        };
    };

    (function (exports) {
    	/* tslint:disable */
    	/* eslint-disable */
    	/**
    	 * OpenAI API
    	 * APIs for sampling from and fine-tuning language models
    	 *
    	 * The version of the OpenAPI document: 1.0.5
    	 *
    	 *
    	 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
    	 * https://openapi-generator.tech
    	 * Do not edit the class manually.
    	 */
    	var __awaiter = (commonjsGlobal && commonjsGlobal.__awaiter) || function (thisArg, _arguments, P, generator) {
    	    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    	    return new (P || (P = Promise))(function (resolve, reject) {
    	        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
    	        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
    	        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
    	        step((generator = generator.apply(thisArg, _arguments || [])).next());
    	    });
    	};
    	Object.defineProperty(exports, "__esModule", { value: true });
    	exports.OpenAIApi = exports.OpenAIApiFactory = exports.OpenAIApiFp = exports.OpenAIApiAxiosParamCreator = void 0;
    	const axios_1 = axios$2.exports;
    	// Some imports not used depending on template conditions
    	// @ts-ignore
    	const common_1 = common;
    	// @ts-ignore
    	const base_1 = base;
    	/**
    	 * OpenAIApi - axios parameter creator
    	 * @export
    	 */
    	exports.OpenAIApiAxiosParamCreator = function (configuration) {
    	    return {
    	        /**
    	         *
    	         * @summary Immediately cancel a fine-tune job.
    	         * @param {string} fineTuneId The ID of the fine-tune job to cancel
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        cancelFineTune: (fineTuneId, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'fineTuneId' is not null or undefined
    	            common_1.assertParamExists('cancelFineTune', 'fineTuneId', fineTuneId);
    	            const localVarPath = `/fine-tunes/{fine_tune_id}/cancel`
    	                .replace(`{${"fine_tune_id"}}`, encodeURIComponent(String(fineTuneId)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Answers the specified question using the provided documents and examples.  The endpoint first [searches](/docs/api-reference/searches) over provided documents or files to find relevant context. The relevant context is combined with the provided examples and question to create the prompt for [completion](/docs/api-reference/completions).
    	         * @param {CreateAnswerRequest} createAnswerRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createAnswer: (createAnswerRequest, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'createAnswerRequest' is not null or undefined
    	            common_1.assertParamExists('createAnswer', 'createAnswerRequest', createAnswerRequest);
    	            const localVarPath = `/answers`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            localVarHeaderParameter['Content-Type'] = 'application/json';
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            localVarRequestOptions.data = common_1.serializeDataIfNeeded(createAnswerRequest, localVarRequestOptions, configuration);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Classifies the specified `query` using provided examples.  The endpoint first [searches](/docs/api-reference/searches) over the labeled examples to select the ones most relevant for the particular query. Then, the relevant examples are combined with the query to construct a prompt to produce the final label via the [completions](/docs/api-reference/completions) endpoint.  Labeled examples can be provided via an uploaded `file`, or explicitly listed in the request using the `examples` parameter for quick tests and small scale use cases.
    	         * @param {CreateClassificationRequest} createClassificationRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createClassification: (createClassificationRequest, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'createClassificationRequest' is not null or undefined
    	            common_1.assertParamExists('createClassification', 'createClassificationRequest', createClassificationRequest);
    	            const localVarPath = `/classifications`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            localVarHeaderParameter['Content-Type'] = 'application/json';
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            localVarRequestOptions.data = common_1.serializeDataIfNeeded(createClassificationRequest, localVarRequestOptions, configuration);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Creates a completion for the provided prompt and parameters
    	         * @param {CreateCompletionRequest} createCompletionRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createCompletion: (createCompletionRequest, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'createCompletionRequest' is not null or undefined
    	            common_1.assertParamExists('createCompletion', 'createCompletionRequest', createCompletionRequest);
    	            const localVarPath = `/completions`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            localVarHeaderParameter['Content-Type'] = 'application/json';
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            localVarRequestOptions.data = common_1.serializeDataIfNeeded(createCompletionRequest, localVarRequestOptions, configuration);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Creates a new edit for the provided input, instruction, and parameters
    	         * @param {CreateEditRequest} createEditRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createEdit: (createEditRequest, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'createEditRequest' is not null or undefined
    	            common_1.assertParamExists('createEdit', 'createEditRequest', createEditRequest);
    	            const localVarPath = `/edits`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            localVarHeaderParameter['Content-Type'] = 'application/json';
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            localVarRequestOptions.data = common_1.serializeDataIfNeeded(createEditRequest, localVarRequestOptions, configuration);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Creates an embedding vector representing the input text.
    	         * @param {CreateEmbeddingRequest} createEmbeddingRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createEmbedding: (createEmbeddingRequest, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'createEmbeddingRequest' is not null or undefined
    	            common_1.assertParamExists('createEmbedding', 'createEmbeddingRequest', createEmbeddingRequest);
    	            const localVarPath = `/embeddings`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            localVarHeaderParameter['Content-Type'] = 'application/json';
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            localVarRequestOptions.data = common_1.serializeDataIfNeeded(createEmbeddingRequest, localVarRequestOptions, configuration);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Upload a file that contains document(s) to be used across various endpoints/features. Currently, the size of all the files uploaded by one organization can be up to 1 GB. Please contact us if you need to increase the storage limit.
    	         * @param {any} file Name of the [JSON Lines](https://jsonlines.readthedocs.io/en/latest/) file to be uploaded.  If the &#x60;purpose&#x60; is set to \\\&quot;fine-tune\\\&quot;, each line is a JSON record with \\\&quot;prompt\\\&quot; and \\\&quot;completion\\\&quot; fields representing your [training examples](/docs/guides/fine-tuning/prepare-training-data).
    	         * @param {string} purpose The intended purpose of the uploaded documents.  Use \\\&quot;fine-tune\\\&quot; for [Fine-tuning](/docs/api-reference/fine-tunes). This allows us to validate the format of the uploaded file.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createFile: (file, purpose, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'file' is not null or undefined
    	            common_1.assertParamExists('createFile', 'file', file);
    	            // verify required parameter 'purpose' is not null or undefined
    	            common_1.assertParamExists('createFile', 'purpose', purpose);
    	            const localVarPath = `/files`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            const localVarFormParams = new ((configuration && configuration.formDataCtor) || FormData)();
    	            if (file !== undefined) {
    	                localVarFormParams.append('file', file);
    	            }
    	            if (purpose !== undefined) {
    	                localVarFormParams.append('purpose', purpose);
    	            }
    	            localVarHeaderParameter['Content-Type'] = 'multipart/form-data';
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), localVarFormParams.getHeaders()), headersFromBaseOptions), options.headers);
    	            localVarRequestOptions.data = localVarFormParams;
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Creates a job that fine-tunes a specified model from a given dataset.  Response includes details of the enqueued job including job status and the name of the fine-tuned models once complete.  [Learn more about Fine-tuning](/docs/guides/fine-tuning)
    	         * @param {CreateFineTuneRequest} createFineTuneRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createFineTune: (createFineTuneRequest, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'createFineTuneRequest' is not null or undefined
    	            common_1.assertParamExists('createFineTune', 'createFineTuneRequest', createFineTuneRequest);
    	            const localVarPath = `/fine-tunes`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            localVarHeaderParameter['Content-Type'] = 'application/json';
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            localVarRequestOptions.data = common_1.serializeDataIfNeeded(createFineTuneRequest, localVarRequestOptions, configuration);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary The search endpoint computes similarity scores between provided query and documents. Documents can be passed directly to the API if there are no more than 200 of them.  To go beyond the 200 document limit, documents can be processed offline and then used for efficient retrieval at query time. When `file` is set, the search endpoint searches over all the documents in the given file and returns up to the `max_rerank` number of documents. These documents will be returned along with their search scores.  The similarity score is a positive score that usually ranges from 0 to 300 (but can sometimes go higher), where a score above 200 usually means the document is semantically similar to the query.
    	         * @param {string} engineId The ID of the engine to use for this request.  You can select one of &#x60;ada&#x60;, &#x60;babbage&#x60;, &#x60;curie&#x60;, or &#x60;davinci&#x60;.
    	         * @param {CreateSearchRequest} createSearchRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createSearch: (engineId, createSearchRequest, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'engineId' is not null or undefined
    	            common_1.assertParamExists('createSearch', 'engineId', engineId);
    	            // verify required parameter 'createSearchRequest' is not null or undefined
    	            common_1.assertParamExists('createSearch', 'createSearchRequest', createSearchRequest);
    	            const localVarPath = `/engines/{engine_id}/search`
    	                .replace(`{${"engine_id"}}`, encodeURIComponent(String(engineId)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'POST' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            localVarHeaderParameter['Content-Type'] = 'application/json';
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            localVarRequestOptions.data = common_1.serializeDataIfNeeded(createSearchRequest, localVarRequestOptions, configuration);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Delete a file.
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        deleteFile: (fileId, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'fileId' is not null or undefined
    	            common_1.assertParamExists('deleteFile', 'fileId', fileId);
    	            const localVarPath = `/files/{file_id}`
    	                .replace(`{${"file_id"}}`, encodeURIComponent(String(fileId)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'DELETE' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Delete a fine-tuned model. You must have the Owner role in your organization.
    	         * @param {string} model The model to delete
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        deleteModel: (model, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'model' is not null or undefined
    	            common_1.assertParamExists('deleteModel', 'model', model);
    	            const localVarPath = `/models/{model}`
    	                .replace(`{${"model"}}`, encodeURIComponent(String(model)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'DELETE' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Returns the contents of the specified file
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        downloadFile: (fileId, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'fileId' is not null or undefined
    	            common_1.assertParamExists('downloadFile', 'fileId', fileId);
    	            const localVarPath = `/files/{file_id}/content`
    	                .replace(`{${"file_id"}}`, encodeURIComponent(String(fileId)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Lists the currently available (non-finetuned) models, and provides basic information about each one such as the owner and availability.
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        listEngines: (options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            const localVarPath = `/engines`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Returns a list of files that belong to the user\'s organization.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFiles: (options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            const localVarPath = `/files`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Get fine-grained status updates for a fine-tune job.
    	         * @param {string} fineTuneId The ID of the fine-tune job to get events for.
    	         * @param {boolean} [stream] Whether to stream events for the fine-tune job. If set to true, events will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available. The stream will terminate with a &#x60;data: [DONE]&#x60; message when the job is finished (succeeded, cancelled, or failed).  If set to false, only events generated so far will be returned.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFineTuneEvents: (fineTuneId, stream, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'fineTuneId' is not null or undefined
    	            common_1.assertParamExists('listFineTuneEvents', 'fineTuneId', fineTuneId);
    	            const localVarPath = `/fine-tunes/{fine_tune_id}/events`
    	                .replace(`{${"fine_tune_id"}}`, encodeURIComponent(String(fineTuneId)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            if (stream !== undefined) {
    	                localVarQueryParameter['stream'] = stream;
    	            }
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary List your organization\'s fine-tuning jobs
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFineTunes: (options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            const localVarPath = `/fine-tunes`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Lists the currently available models, and provides basic information about each one such as the owner and availability.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listModels: (options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            const localVarPath = `/models`;
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Retrieves a model instance, providing basic information about it such as the owner and availability.
    	         * @param {string} engineId The ID of the engine to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        retrieveEngine: (engineId, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'engineId' is not null or undefined
    	            common_1.assertParamExists('retrieveEngine', 'engineId', engineId);
    	            const localVarPath = `/engines/{engine_id}`
    	                .replace(`{${"engine_id"}}`, encodeURIComponent(String(engineId)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Returns information about a specific file.
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveFile: (fileId, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'fileId' is not null or undefined
    	            common_1.assertParamExists('retrieveFile', 'fileId', fileId);
    	            const localVarPath = `/files/{file_id}`
    	                .replace(`{${"file_id"}}`, encodeURIComponent(String(fileId)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Gets info about the fine-tune job.  [Learn more about Fine-tuning](/docs/guides/fine-tuning)
    	         * @param {string} fineTuneId The ID of the fine-tune job
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveFineTune: (fineTuneId, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'fineTuneId' is not null or undefined
    	            common_1.assertParamExists('retrieveFineTune', 'fineTuneId', fineTuneId);
    	            const localVarPath = `/fine-tunes/{fine_tune_id}`
    	                .replace(`{${"fine_tune_id"}}`, encodeURIComponent(String(fineTuneId)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	        /**
    	         *
    	         * @summary Retrieves a model instance, providing basic information about the model such as the owner and permissioning.
    	         * @param {string} model The ID of the model to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveModel: (model, options = {}) => __awaiter(this, void 0, void 0, function* () {
    	            // verify required parameter 'model' is not null or undefined
    	            common_1.assertParamExists('retrieveModel', 'model', model);
    	            const localVarPath = `/models/{model}`
    	                .replace(`{${"model"}}`, encodeURIComponent(String(model)));
    	            // use dummy base URL string because the URL constructor only accepts absolute URLs.
    	            const localVarUrlObj = new URL(localVarPath, common_1.DUMMY_BASE_URL);
    	            let baseOptions;
    	            if (configuration) {
    	                baseOptions = configuration.baseOptions;
    	            }
    	            const localVarRequestOptions = Object.assign(Object.assign({ method: 'GET' }, baseOptions), options);
    	            const localVarHeaderParameter = {};
    	            const localVarQueryParameter = {};
    	            common_1.setSearchParams(localVarUrlObj, localVarQueryParameter);
    	            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
    	            localVarRequestOptions.headers = Object.assign(Object.assign(Object.assign({}, localVarHeaderParameter), headersFromBaseOptions), options.headers);
    	            return {
    	                url: common_1.toPathString(localVarUrlObj),
    	                options: localVarRequestOptions,
    	            };
    	        }),
    	    };
    	};
    	/**
    	 * OpenAIApi - functional programming interface
    	 * @export
    	 */
    	exports.OpenAIApiFp = function (configuration) {
    	    const localVarAxiosParamCreator = exports.OpenAIApiAxiosParamCreator(configuration);
    	    return {
    	        /**
    	         *
    	         * @summary Immediately cancel a fine-tune job.
    	         * @param {string} fineTuneId The ID of the fine-tune job to cancel
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        cancelFineTune(fineTuneId, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.cancelFineTune(fineTuneId, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Answers the specified question using the provided documents and examples.  The endpoint first [searches](/docs/api-reference/searches) over provided documents or files to find relevant context. The relevant context is combined with the provided examples and question to create the prompt for [completion](/docs/api-reference/completions).
    	         * @param {CreateAnswerRequest} createAnswerRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createAnswer(createAnswerRequest, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.createAnswer(createAnswerRequest, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Classifies the specified `query` using provided examples.  The endpoint first [searches](/docs/api-reference/searches) over the labeled examples to select the ones most relevant for the particular query. Then, the relevant examples are combined with the query to construct a prompt to produce the final label via the [completions](/docs/api-reference/completions) endpoint.  Labeled examples can be provided via an uploaded `file`, or explicitly listed in the request using the `examples` parameter for quick tests and small scale use cases.
    	         * @param {CreateClassificationRequest} createClassificationRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createClassification(createClassificationRequest, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.createClassification(createClassificationRequest, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Creates a completion for the provided prompt and parameters
    	         * @param {CreateCompletionRequest} createCompletionRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createCompletion(createCompletionRequest, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.createCompletion(createCompletionRequest, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Creates a new edit for the provided input, instruction, and parameters
    	         * @param {CreateEditRequest} createEditRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createEdit(createEditRequest, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.createEdit(createEditRequest, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Creates an embedding vector representing the input text.
    	         * @param {CreateEmbeddingRequest} createEmbeddingRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createEmbedding(createEmbeddingRequest, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.createEmbedding(createEmbeddingRequest, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Upload a file that contains document(s) to be used across various endpoints/features. Currently, the size of all the files uploaded by one organization can be up to 1 GB. Please contact us if you need to increase the storage limit.
    	         * @param {any} file Name of the [JSON Lines](https://jsonlines.readthedocs.io/en/latest/) file to be uploaded.  If the &#x60;purpose&#x60; is set to \\\&quot;fine-tune\\\&quot;, each line is a JSON record with \\\&quot;prompt\\\&quot; and \\\&quot;completion\\\&quot; fields representing your [training examples](/docs/guides/fine-tuning/prepare-training-data).
    	         * @param {string} purpose The intended purpose of the uploaded documents.  Use \\\&quot;fine-tune\\\&quot; for [Fine-tuning](/docs/api-reference/fine-tunes). This allows us to validate the format of the uploaded file.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createFile(file, purpose, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.createFile(file, purpose, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Creates a job that fine-tunes a specified model from a given dataset.  Response includes details of the enqueued job including job status and the name of the fine-tuned models once complete.  [Learn more about Fine-tuning](/docs/guides/fine-tuning)
    	         * @param {CreateFineTuneRequest} createFineTuneRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createFineTune(createFineTuneRequest, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.createFineTune(createFineTuneRequest, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary The search endpoint computes similarity scores between provided query and documents. Documents can be passed directly to the API if there are no more than 200 of them.  To go beyond the 200 document limit, documents can be processed offline and then used for efficient retrieval at query time. When `file` is set, the search endpoint searches over all the documents in the given file and returns up to the `max_rerank` number of documents. These documents will be returned along with their search scores.  The similarity score is a positive score that usually ranges from 0 to 300 (but can sometimes go higher), where a score above 200 usually means the document is semantically similar to the query.
    	         * @param {string} engineId The ID of the engine to use for this request.  You can select one of &#x60;ada&#x60;, &#x60;babbage&#x60;, &#x60;curie&#x60;, or &#x60;davinci&#x60;.
    	         * @param {CreateSearchRequest} createSearchRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createSearch(engineId, createSearchRequest, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.createSearch(engineId, createSearchRequest, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Delete a file.
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        deleteFile(fileId, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.deleteFile(fileId, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Delete a fine-tuned model. You must have the Owner role in your organization.
    	         * @param {string} model The model to delete
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        deleteModel(model, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.deleteModel(model, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Returns the contents of the specified file
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        downloadFile(fileId, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.downloadFile(fileId, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Lists the currently available (non-finetuned) models, and provides basic information about each one such as the owner and availability.
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        listEngines(options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.listEngines(options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Returns a list of files that belong to the user\'s organization.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFiles(options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.listFiles(options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Get fine-grained status updates for a fine-tune job.
    	         * @param {string} fineTuneId The ID of the fine-tune job to get events for.
    	         * @param {boolean} [stream] Whether to stream events for the fine-tune job. If set to true, events will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available. The stream will terminate with a &#x60;data: [DONE]&#x60; message when the job is finished (succeeded, cancelled, or failed).  If set to false, only events generated so far will be returned.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFineTuneEvents(fineTuneId, stream, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.listFineTuneEvents(fineTuneId, stream, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary List your organization\'s fine-tuning jobs
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFineTunes(options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.listFineTunes(options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Lists the currently available models, and provides basic information about each one such as the owner and availability.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listModels(options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.listModels(options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Retrieves a model instance, providing basic information about it such as the owner and availability.
    	         * @param {string} engineId The ID of the engine to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        retrieveEngine(engineId, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.retrieveEngine(engineId, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Returns information about a specific file.
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveFile(fileId, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.retrieveFile(fileId, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Gets info about the fine-tune job.  [Learn more about Fine-tuning](/docs/guides/fine-tuning)
    	         * @param {string} fineTuneId The ID of the fine-tune job
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveFineTune(fineTuneId, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.retrieveFineTune(fineTuneId, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	        /**
    	         *
    	         * @summary Retrieves a model instance, providing basic information about the model such as the owner and permissioning.
    	         * @param {string} model The ID of the model to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveModel(model, options) {
    	            return __awaiter(this, void 0, void 0, function* () {
    	                const localVarAxiosArgs = yield localVarAxiosParamCreator.retrieveModel(model, options);
    	                return common_1.createRequestFunction(localVarAxiosArgs, axios_1.default, base_1.BASE_PATH, configuration);
    	            });
    	        },
    	    };
    	};
    	/**
    	 * OpenAIApi - factory interface
    	 * @export
    	 */
    	exports.OpenAIApiFactory = function (configuration, basePath, axios) {
    	    const localVarFp = exports.OpenAIApiFp(configuration);
    	    return {
    	        /**
    	         *
    	         * @summary Immediately cancel a fine-tune job.
    	         * @param {string} fineTuneId The ID of the fine-tune job to cancel
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        cancelFineTune(fineTuneId, options) {
    	            return localVarFp.cancelFineTune(fineTuneId, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Answers the specified question using the provided documents and examples.  The endpoint first [searches](/docs/api-reference/searches) over provided documents or files to find relevant context. The relevant context is combined with the provided examples and question to create the prompt for [completion](/docs/api-reference/completions).
    	         * @param {CreateAnswerRequest} createAnswerRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createAnswer(createAnswerRequest, options) {
    	            return localVarFp.createAnswer(createAnswerRequest, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Classifies the specified `query` using provided examples.  The endpoint first [searches](/docs/api-reference/searches) over the labeled examples to select the ones most relevant for the particular query. Then, the relevant examples are combined with the query to construct a prompt to produce the final label via the [completions](/docs/api-reference/completions) endpoint.  Labeled examples can be provided via an uploaded `file`, or explicitly listed in the request using the `examples` parameter for quick tests and small scale use cases.
    	         * @param {CreateClassificationRequest} createClassificationRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createClassification(createClassificationRequest, options) {
    	            return localVarFp.createClassification(createClassificationRequest, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Creates a completion for the provided prompt and parameters
    	         * @param {CreateCompletionRequest} createCompletionRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createCompletion(createCompletionRequest, options) {
    	            return localVarFp.createCompletion(createCompletionRequest, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Creates a new edit for the provided input, instruction, and parameters
    	         * @param {CreateEditRequest} createEditRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createEdit(createEditRequest, options) {
    	            return localVarFp.createEdit(createEditRequest, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Creates an embedding vector representing the input text.
    	         * @param {CreateEmbeddingRequest} createEmbeddingRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createEmbedding(createEmbeddingRequest, options) {
    	            return localVarFp.createEmbedding(createEmbeddingRequest, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Upload a file that contains document(s) to be used across various endpoints/features. Currently, the size of all the files uploaded by one organization can be up to 1 GB. Please contact us if you need to increase the storage limit.
    	         * @param {any} file Name of the [JSON Lines](https://jsonlines.readthedocs.io/en/latest/) file to be uploaded.  If the &#x60;purpose&#x60; is set to \\\&quot;fine-tune\\\&quot;, each line is a JSON record with \\\&quot;prompt\\\&quot; and \\\&quot;completion\\\&quot; fields representing your [training examples](/docs/guides/fine-tuning/prepare-training-data).
    	         * @param {string} purpose The intended purpose of the uploaded documents.  Use \\\&quot;fine-tune\\\&quot; for [Fine-tuning](/docs/api-reference/fine-tunes). This allows us to validate the format of the uploaded file.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createFile(file, purpose, options) {
    	            return localVarFp.createFile(file, purpose, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Creates a job that fine-tunes a specified model from a given dataset.  Response includes details of the enqueued job including job status and the name of the fine-tuned models once complete.  [Learn more about Fine-tuning](/docs/guides/fine-tuning)
    	         * @param {CreateFineTuneRequest} createFineTuneRequest
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        createFineTune(createFineTuneRequest, options) {
    	            return localVarFp.createFineTune(createFineTuneRequest, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary The search endpoint computes similarity scores between provided query and documents. Documents can be passed directly to the API if there are no more than 200 of them.  To go beyond the 200 document limit, documents can be processed offline and then used for efficient retrieval at query time. When `file` is set, the search endpoint searches over all the documents in the given file and returns up to the `max_rerank` number of documents. These documents will be returned along with their search scores.  The similarity score is a positive score that usually ranges from 0 to 300 (but can sometimes go higher), where a score above 200 usually means the document is semantically similar to the query.
    	         * @param {string} engineId The ID of the engine to use for this request.  You can select one of &#x60;ada&#x60;, &#x60;babbage&#x60;, &#x60;curie&#x60;, or &#x60;davinci&#x60;.
    	         * @param {CreateSearchRequest} createSearchRequest
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        createSearch(engineId, createSearchRequest, options) {
    	            return localVarFp.createSearch(engineId, createSearchRequest, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Delete a file.
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        deleteFile(fileId, options) {
    	            return localVarFp.deleteFile(fileId, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Delete a fine-tuned model. You must have the Owner role in your organization.
    	         * @param {string} model The model to delete
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        deleteModel(model, options) {
    	            return localVarFp.deleteModel(model, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Returns the contents of the specified file
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        downloadFile(fileId, options) {
    	            return localVarFp.downloadFile(fileId, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Lists the currently available (non-finetuned) models, and provides basic information about each one such as the owner and availability.
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        listEngines(options) {
    	            return localVarFp.listEngines(options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Returns a list of files that belong to the user\'s organization.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFiles(options) {
    	            return localVarFp.listFiles(options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Get fine-grained status updates for a fine-tune job.
    	         * @param {string} fineTuneId The ID of the fine-tune job to get events for.
    	         * @param {boolean} [stream] Whether to stream events for the fine-tune job. If set to true, events will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available. The stream will terminate with a &#x60;data: [DONE]&#x60; message when the job is finished (succeeded, cancelled, or failed).  If set to false, only events generated so far will be returned.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFineTuneEvents(fineTuneId, stream, options) {
    	            return localVarFp.listFineTuneEvents(fineTuneId, stream, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary List your organization\'s fine-tuning jobs
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listFineTunes(options) {
    	            return localVarFp.listFineTunes(options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Lists the currently available models, and provides basic information about each one such as the owner and availability.
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        listModels(options) {
    	            return localVarFp.listModels(options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Retrieves a model instance, providing basic information about it such as the owner and availability.
    	         * @param {string} engineId The ID of the engine to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @deprecated
    	         * @throws {RequiredError}
    	         */
    	        retrieveEngine(engineId, options) {
    	            return localVarFp.retrieveEngine(engineId, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Returns information about a specific file.
    	         * @param {string} fileId The ID of the file to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveFile(fileId, options) {
    	            return localVarFp.retrieveFile(fileId, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Gets info about the fine-tune job.  [Learn more about Fine-tuning](/docs/guides/fine-tuning)
    	         * @param {string} fineTuneId The ID of the fine-tune job
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveFineTune(fineTuneId, options) {
    	            return localVarFp.retrieveFineTune(fineTuneId, options).then((request) => request(axios, basePath));
    	        },
    	        /**
    	         *
    	         * @summary Retrieves a model instance, providing basic information about the model such as the owner and permissioning.
    	         * @param {string} model The ID of the model to use for this request
    	         * @param {*} [options] Override http request option.
    	         * @throws {RequiredError}
    	         */
    	        retrieveModel(model, options) {
    	            return localVarFp.retrieveModel(model, options).then((request) => request(axios, basePath));
    	        },
    	    };
    	};
    	/**
    	 * OpenAIApi - object-oriented interface
    	 * @export
    	 * @class OpenAIApi
    	 * @extends {BaseAPI}
    	 */
    	class OpenAIApi extends base_1.BaseAPI {
    	    /**
    	     *
    	     * @summary Immediately cancel a fine-tune job.
    	     * @param {string} fineTuneId The ID of the fine-tune job to cancel
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    cancelFineTune(fineTuneId, options) {
    	        return exports.OpenAIApiFp(this.configuration).cancelFineTune(fineTuneId, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Answers the specified question using the provided documents and examples.  The endpoint first [searches](/docs/api-reference/searches) over provided documents or files to find relevant context. The relevant context is combined with the provided examples and question to create the prompt for [completion](/docs/api-reference/completions).
    	     * @param {CreateAnswerRequest} createAnswerRequest
    	     * @param {*} [options] Override http request option.
    	     * @deprecated
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    createAnswer(createAnswerRequest, options) {
    	        return exports.OpenAIApiFp(this.configuration).createAnswer(createAnswerRequest, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Classifies the specified `query` using provided examples.  The endpoint first [searches](/docs/api-reference/searches) over the labeled examples to select the ones most relevant for the particular query. Then, the relevant examples are combined with the query to construct a prompt to produce the final label via the [completions](/docs/api-reference/completions) endpoint.  Labeled examples can be provided via an uploaded `file`, or explicitly listed in the request using the `examples` parameter for quick tests and small scale use cases.
    	     * @param {CreateClassificationRequest} createClassificationRequest
    	     * @param {*} [options] Override http request option.
    	     * @deprecated
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    createClassification(createClassificationRequest, options) {
    	        return exports.OpenAIApiFp(this.configuration).createClassification(createClassificationRequest, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Creates a completion for the provided prompt and parameters
    	     * @param {CreateCompletionRequest} createCompletionRequest
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    createCompletion(createCompletionRequest, options) {
    	        return exports.OpenAIApiFp(this.configuration).createCompletion(createCompletionRequest, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Creates a new edit for the provided input, instruction, and parameters
    	     * @param {CreateEditRequest} createEditRequest
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    createEdit(createEditRequest, options) {
    	        return exports.OpenAIApiFp(this.configuration).createEdit(createEditRequest, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Creates an embedding vector representing the input text.
    	     * @param {CreateEmbeddingRequest} createEmbeddingRequest
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    createEmbedding(createEmbeddingRequest, options) {
    	        return exports.OpenAIApiFp(this.configuration).createEmbedding(createEmbeddingRequest, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Upload a file that contains document(s) to be used across various endpoints/features. Currently, the size of all the files uploaded by one organization can be up to 1 GB. Please contact us if you need to increase the storage limit.
    	     * @param {any} file Name of the [JSON Lines](https://jsonlines.readthedocs.io/en/latest/) file to be uploaded.  If the &#x60;purpose&#x60; is set to \\\&quot;fine-tune\\\&quot;, each line is a JSON record with \\\&quot;prompt\\\&quot; and \\\&quot;completion\\\&quot; fields representing your [training examples](/docs/guides/fine-tuning/prepare-training-data).
    	     * @param {string} purpose The intended purpose of the uploaded documents.  Use \\\&quot;fine-tune\\\&quot; for [Fine-tuning](/docs/api-reference/fine-tunes). This allows us to validate the format of the uploaded file.
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    createFile(file, purpose, options) {
    	        return exports.OpenAIApiFp(this.configuration).createFile(file, purpose, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Creates a job that fine-tunes a specified model from a given dataset.  Response includes details of the enqueued job including job status and the name of the fine-tuned models once complete.  [Learn more about Fine-tuning](/docs/guides/fine-tuning)
    	     * @param {CreateFineTuneRequest} createFineTuneRequest
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    createFineTune(createFineTuneRequest, options) {
    	        return exports.OpenAIApiFp(this.configuration).createFineTune(createFineTuneRequest, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary The search endpoint computes similarity scores between provided query and documents. Documents can be passed directly to the API if there are no more than 200 of them.  To go beyond the 200 document limit, documents can be processed offline and then used for efficient retrieval at query time. When `file` is set, the search endpoint searches over all the documents in the given file and returns up to the `max_rerank` number of documents. These documents will be returned along with their search scores.  The similarity score is a positive score that usually ranges from 0 to 300 (but can sometimes go higher), where a score above 200 usually means the document is semantically similar to the query.
    	     * @param {string} engineId The ID of the engine to use for this request.  You can select one of &#x60;ada&#x60;, &#x60;babbage&#x60;, &#x60;curie&#x60;, or &#x60;davinci&#x60;.
    	     * @param {CreateSearchRequest} createSearchRequest
    	     * @param {*} [options] Override http request option.
    	     * @deprecated
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    createSearch(engineId, createSearchRequest, options) {
    	        return exports.OpenAIApiFp(this.configuration).createSearch(engineId, createSearchRequest, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Delete a file.
    	     * @param {string} fileId The ID of the file to use for this request
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    deleteFile(fileId, options) {
    	        return exports.OpenAIApiFp(this.configuration).deleteFile(fileId, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Delete a fine-tuned model. You must have the Owner role in your organization.
    	     * @param {string} model The model to delete
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    deleteModel(model, options) {
    	        return exports.OpenAIApiFp(this.configuration).deleteModel(model, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Returns the contents of the specified file
    	     * @param {string} fileId The ID of the file to use for this request
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    downloadFile(fileId, options) {
    	        return exports.OpenAIApiFp(this.configuration).downloadFile(fileId, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Lists the currently available (non-finetuned) models, and provides basic information about each one such as the owner and availability.
    	     * @param {*} [options] Override http request option.
    	     * @deprecated
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    listEngines(options) {
    	        return exports.OpenAIApiFp(this.configuration).listEngines(options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Returns a list of files that belong to the user\'s organization.
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    listFiles(options) {
    	        return exports.OpenAIApiFp(this.configuration).listFiles(options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Get fine-grained status updates for a fine-tune job.
    	     * @param {string} fineTuneId The ID of the fine-tune job to get events for.
    	     * @param {boolean} [stream] Whether to stream events for the fine-tune job. If set to true, events will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available. The stream will terminate with a &#x60;data: [DONE]&#x60; message when the job is finished (succeeded, cancelled, or failed).  If set to false, only events generated so far will be returned.
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    listFineTuneEvents(fineTuneId, stream, options) {
    	        return exports.OpenAIApiFp(this.configuration).listFineTuneEvents(fineTuneId, stream, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary List your organization\'s fine-tuning jobs
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    listFineTunes(options) {
    	        return exports.OpenAIApiFp(this.configuration).listFineTunes(options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Lists the currently available models, and provides basic information about each one such as the owner and availability.
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    listModels(options) {
    	        return exports.OpenAIApiFp(this.configuration).listModels(options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Retrieves a model instance, providing basic information about it such as the owner and availability.
    	     * @param {string} engineId The ID of the engine to use for this request
    	     * @param {*} [options] Override http request option.
    	     * @deprecated
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    retrieveEngine(engineId, options) {
    	        return exports.OpenAIApiFp(this.configuration).retrieveEngine(engineId, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Returns information about a specific file.
    	     * @param {string} fileId The ID of the file to use for this request
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    retrieveFile(fileId, options) {
    	        return exports.OpenAIApiFp(this.configuration).retrieveFile(fileId, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Gets info about the fine-tune job.  [Learn more about Fine-tuning](/docs/guides/fine-tuning)
    	     * @param {string} fineTuneId The ID of the fine-tune job
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    retrieveFineTune(fineTuneId, options) {
    	        return exports.OpenAIApiFp(this.configuration).retrieveFineTune(fineTuneId, options).then((request) => request(this.axios, this.basePath));
    	    }
    	    /**
    	     *
    	     * @summary Retrieves a model instance, providing basic information about the model such as the owner and permissioning.
    	     * @param {string} model The ID of the model to use for this request
    	     * @param {*} [options] Override http request option.
    	     * @throws {RequiredError}
    	     * @memberof OpenAIApi
    	     */
    	    retrieveModel(model, options) {
    	        return exports.OpenAIApiFp(this.configuration).retrieveModel(model, options).then((request) => request(this.axios, this.basePath));
    	    }
    	}
    	exports.OpenAIApi = OpenAIApi;
    } (api));

    var configuration$1 = {};

    var name = "openai";
    var version = "3.0.0";
    var description = "Node.js library for the OpenAI API";
    var keywords = [
    	"openai",
    	"open",
    	"ai",
    	"gpt-3",
    	"gpt3"
    ];
    var repository = {
    	type: "git",
    	url: "git@github.com:openai/openai-node.git"
    };
    var author = "OpenAI";
    var license = "MIT";
    var main$1 = "./dist/index.js";
    var types = "./dist/index.d.ts";
    var scripts = {
    	build: "tsc --outDir dist/"
    };
    var dependencies = {
    	axios: "^0.26.0",
    	"form-data": "^4.0.0"
    };
    var devDependencies = {
    	"@types/node": "^12.11.5",
    	typescript: "^3.6.4"
    };
    var require$$0 = {
    	name: name,
    	version: version,
    	description: description,
    	keywords: keywords,
    	repository: repository,
    	author: author,
    	license: license,
    	main: main$1,
    	types: types,
    	scripts: scripts,
    	dependencies: dependencies,
    	devDependencies: devDependencies
    };

    /* eslint-env browser */

    var browser;
    var hasRequiredBrowser;

    function requireBrowser () {
    	if (hasRequiredBrowser) return browser;
    	hasRequiredBrowser = 1;
    	browser = typeof self == 'object' ? self.FormData : window.FormData;
    	return browser;
    }

    /* tslint:disable */
    /* eslint-disable */
    /**
     * OpenAI API
     * APIs for sampling from and fine-tuning language models
     *
     * The version of the OpenAPI document: 1.0.5
     *
     *
     * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
     * https://openapi-generator.tech
     * Do not edit the class manually.
     */
    Object.defineProperty(configuration$1, "__esModule", { value: true });
    configuration$1.Configuration = void 0;
    const packageJson = require$$0;
    class Configuration {
        constructor(param = {}) {
            this.apiKey = param.apiKey;
            this.organization = param.organization;
            this.username = param.username;
            this.password = param.password;
            this.accessToken = param.accessToken;
            this.basePath = param.basePath;
            this.baseOptions = param.baseOptions;
            this.formDataCtor = param.formDataCtor;
            if (!this.baseOptions) {
                this.baseOptions = {};
            }
            this.baseOptions.headers = Object.assign({ 'User-Agent': `OpenAI/NodeJS/${packageJson.version}`, 'Authorization': `Bearer ${this.apiKey}` }, this.baseOptions.headers);
            if (this.organization) {
                this.baseOptions.headers['OpenAI-Organization'] = this.organization;
            }
            if (!this.formDataCtor) {
                this.formDataCtor = requireBrowser();
            }
        }
        /**
         * Check if the given MIME is a JSON MIME.
         * JSON MIME examples:
         *   application/json
         *   application/json; charset=UTF8
         *   APPLICATION/JSON
         *   application/vnd.company+json
         * @param mime - MIME (Multipurpose Internet Mail Extensions)
         * @return True if the given MIME is JSON, false otherwise.
         */
        isJsonMime(mime) {
            const jsonMime = new RegExp('^(application\/json|[^;/ \t]+\/[^;/ \t]+[+]json)[ \t]*(;.*)?$', 'i');
            return mime !== null && (jsonMime.test(mime) || mime.toLowerCase() === 'application/json-patch+json');
        }
    }
    configuration$1.Configuration = Configuration;

    (function (exports) {
    	/* tslint:disable */
    	/* eslint-disable */
    	/**
    	 * OpenAI API
    	 * APIs for sampling from and fine-tuning language models
    	 *
    	 * The version of the OpenAPI document: 1.0.5
    	 *
    	 *
    	 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
    	 * https://openapi-generator.tech
    	 * Do not edit the class manually.
    	 */
    	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    	    if (k2 === undefined) k2 = k;
    	    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
    	}) : (function(o, m, k, k2) {
    	    if (k2 === undefined) k2 = k;
    	    o[k2] = m[k];
    	}));
    	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
    	    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
    	};
    	Object.defineProperty(exports, "__esModule", { value: true });
    	__exportStar(api, exports);
    	__exportStar(configuration$1, exports);
    } (dist));

    var configuration = new dist.Configuration({ apiKey: summaryengine_openapi_apikey });
    var openai = new dist.OpenAIApi(configuration);
    function generateSummaryPrompt(body) {
        return "".concat(body.replace(/(<([^>]+)>)/gi, "").slice(0, 10000), "\n    Summarize in 100 words:");
    }
    function summarise(content) {
        return __awaiter$1(this, void 0, void 0, function () {
            var prompt, completion, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        prompt = generateSummaryPrompt(content);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, openai.createCompletion({
                                model: "text-davinci-002",
                                prompt: prompt,
                                temperature: 0.6,
                                max_tokens: 300,
                                top_p: 1,
                                frequency_penalty: 0.5,
                                presence_penalty: 0
                            })];
                    case 2:
                        completion = _a.sent();
                        return [2 /*return*/, completion.data.choices[0].text.trim()];
                    case 3:
                        err_1 = _a.sent();
                        console.error(err_1.data ? JSON.stringify(err_1.data, null, 2) : err_1);
                        console.log(prompt);
                        return [2 /*return*/, new Error("Error summarising content")];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }

    async function main() {
        const get_content = () => {
            if (jQuery("#titlewrap").length) { // Classic editor
                if (jQuery(".wp-editor-area").is(":visible")) { // The code editor is visible
                    console.log("Code editor is visible");
                    return jQuery(".wp-editor-area").val();
                } else { // The visual editor is visible
                    let content = tinymce.editors.content.getContent();
                    if (content.length > 0) {
                        return content;
                    }
                }
                return jQuery("#content").val(); // Last try...
            } else {
                return wp.data.select( "core/editor" ).getEditedPostContent();
            }
        };
        jQuery(async () => {
            if (jQuery("#titlewrap").length) ;
            jQuery("#summaryEngineMetaBlockSummariseButton").on("click", async () => {
                const content = get_content();
                if (!content.length) {
                    alert("Nothing to summarise yet...");
                    return;
                }
                jQuery("#summaryEngineMetaBlockSummariseButtonContainer").addClass("summaryengine-loading");
                const summarised = await summarise(content);
                jQuery("#summaryEngineSummary").val(summarised);
                jQuery("#summaryEngineMetaBlockSummariseButtonContainer").removeClass("summaryengine-loading");
            });
        });
    }

    main();

})();
//# sourceMappingURL=summaryengine.js.map
