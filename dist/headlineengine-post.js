(function () {
	'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	var linearScale = {exports: {}};

	(function (module, exports) {
		(function(root) {

		  function LinearScale(domain, range) {
		    if (!(this instanceof LinearScale)) {
		      return new LinearScale(domain, range);
		    }
		    this.domain = [];
		    this.range = [];

		    if (Array.isArray(domain)) {
		      this.domain = domain;
		    }
		    if (Array.isArray(range)) {
		      this.range = range;
		    }

		    var scale = function(value) {
		      if (typeof value !== 'number') {
		        return null;
		      }

		      var minValue = this.domain[0];
		      var maxValue = this.domain[1];

		      var minScale = this.range[0];
		      var maxScale = this.range[1];

		      if (minScale !== 'number' && typeof maxScale !== 'number') {
		        minScale = minValue;
		        maxScale = maxValue;
		      }

		      var ratio = (maxScale - minScale) / (maxValue - minValue);
		      const result = minScale + ratio * (value - minValue);

		      if (result === Infinity) return maxScale;
		      else if (result === -Infinity) return minScale;
		      else if (isNaN(result)) return minScale;

		      return result
		    }.bind(this);

		    scale.domain = function(value) {
		      if (Array.isArray(value)) {
		        this.domain = value;
		      }
		      return scale;
		    }.bind(this);

		    scale.range = function(value) {
		      if (Array.isArray(value)) {
		        this.range = value;
		      }
		      return scale;
		    }.bind(this);

		    return scale;
		  }

		  {
		    if (module.exports) {
		      exports = module.exports = LinearScale;
		    }
		    exports.LinearScale = LinearScale;
		  }

		})();
	} (linearScale, linearScale.exports));

	var LinearScale = linearScale.exports;

	function calc_total_score(curr, target, range) {
	    const min = Math.min(range[0], range[1]);
	    const max = Math.max(range[0], range[1]);
	    if (curr < min || curr > max) return 0;
	    if (curr === target) return 1;
	    let local_range;
	    let local_curr;
	    if (curr < target) {
	        local_range = [0, target - min];
	        local_curr = curr - min;
	    } else {
	        local_range = [max - target, 0];
	        local_curr = curr - target;
	    }
	    const scale = LinearScale(local_range, [0, 1]);
	    // console.log({curr, target, range, local_range, local_curr, scale: scale(local_curr)});
	    return scale(local_curr);
	}

	function commonjsRequire(path) {
		throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
	}

	var pluralize$1 = {exports: {}};

	/* global define */

	(function (module, exports) {
		(function (root, pluralize) {
		  /* istanbul ignore else */
		  if (typeof commonjsRequire === 'function' && 'object' === 'object' && 'object' === 'object') {
		    // Node.
		    module.exports = pluralize();
		  } else {
		    // Browser global.
		    root.pluralize = pluralize();
		  }
		})(commonjsGlobal, function () {
		  // Rule storage - pluralize and singularize need to be run sequentially,
		  // while other rules can be optimized using an object for instant lookups.
		  var pluralRules = [];
		  var singularRules = [];
		  var uncountables = {};
		  var irregularPlurals = {};
		  var irregularSingles = {};

		  /**
		   * Sanitize a pluralization rule to a usable regular expression.
		   *
		   * @param  {(RegExp|string)} rule
		   * @return {RegExp}
		   */
		  function sanitizeRule (rule) {
		    if (typeof rule === 'string') {
		      return new RegExp('^' + rule + '$', 'i');
		    }

		    return rule;
		  }

		  /**
		   * Pass in a word token to produce a function that can replicate the case on
		   * another word.
		   *
		   * @param  {string}   word
		   * @param  {string}   token
		   * @return {Function}
		   */
		  function restoreCase (word, token) {
		    // Tokens are an exact match.
		    if (word === token) return token;

		    // Lower cased words. E.g. "hello".
		    if (word === word.toLowerCase()) return token.toLowerCase();

		    // Upper cased words. E.g. "WHISKY".
		    if (word === word.toUpperCase()) return token.toUpperCase();

		    // Title cased words. E.g. "Title".
		    if (word[0] === word[0].toUpperCase()) {
		      return token.charAt(0).toUpperCase() + token.substr(1).toLowerCase();
		    }

		    // Lower cased words. E.g. "test".
		    return token.toLowerCase();
		  }

		  /**
		   * Interpolate a regexp string.
		   *
		   * @param  {string} str
		   * @param  {Array}  args
		   * @return {string}
		   */
		  function interpolate (str, args) {
		    return str.replace(/\$(\d{1,2})/g, function (match, index) {
		      return args[index] || '';
		    });
		  }

		  /**
		   * Replace a word using a rule.
		   *
		   * @param  {string} word
		   * @param  {Array}  rule
		   * @return {string}
		   */
		  function replace (word, rule) {
		    return word.replace(rule[0], function (match, index) {
		      var result = interpolate(rule[1], arguments);

		      if (match === '') {
		        return restoreCase(word[index - 1], result);
		      }

		      return restoreCase(match, result);
		    });
		  }

		  /**
		   * Sanitize a word by passing in the word and sanitization rules.
		   *
		   * @param  {string}   token
		   * @param  {string}   word
		   * @param  {Array}    rules
		   * @return {string}
		   */
		  function sanitizeWord (token, word, rules) {
		    // Empty string or doesn't need fixing.
		    if (!token.length || uncountables.hasOwnProperty(token)) {
		      return word;
		    }

		    var len = rules.length;

		    // Iterate over the sanitization rules and use the first one to match.
		    while (len--) {
		      var rule = rules[len];

		      if (rule[0].test(word)) return replace(word, rule);
		    }

		    return word;
		  }

		  /**
		   * Replace a word with the updated word.
		   *
		   * @param  {Object}   replaceMap
		   * @param  {Object}   keepMap
		   * @param  {Array}    rules
		   * @return {Function}
		   */
		  function replaceWord (replaceMap, keepMap, rules) {
		    return function (word) {
		      // Get the correct token and case restoration functions.
		      var token = word.toLowerCase();

		      // Check against the keep object map.
		      if (keepMap.hasOwnProperty(token)) {
		        return restoreCase(word, token);
		      }

		      // Check against the replacement map for a direct word replacement.
		      if (replaceMap.hasOwnProperty(token)) {
		        return restoreCase(word, replaceMap[token]);
		      }

		      // Run all the rules against the word.
		      return sanitizeWord(token, word, rules);
		    };
		  }

		  /**
		   * Check if a word is part of the map.
		   */
		  function checkWord (replaceMap, keepMap, rules, bool) {
		    return function (word) {
		      var token = word.toLowerCase();

		      if (keepMap.hasOwnProperty(token)) return true;
		      if (replaceMap.hasOwnProperty(token)) return false;

		      return sanitizeWord(token, token, rules) === token;
		    };
		  }

		  /**
		   * Pluralize or singularize a word based on the passed in count.
		   *
		   * @param  {string}  word      The word to pluralize
		   * @param  {number}  count     How many of the word exist
		   * @param  {boolean} inclusive Whether to prefix with the number (e.g. 3 ducks)
		   * @return {string}
		   */
		  function pluralize (word, count, inclusive) {
		    var pluralized = count === 1
		      ? pluralize.singular(word) : pluralize.plural(word);

		    return (inclusive ? count + ' ' : '') + pluralized;
		  }

		  /**
		   * Pluralize a word.
		   *
		   * @type {Function}
		   */
		  pluralize.plural = replaceWord(
		    irregularSingles, irregularPlurals, pluralRules
		  );

		  /**
		   * Check if a word is plural.
		   *
		   * @type {Function}
		   */
		  pluralize.isPlural = checkWord(
		    irregularSingles, irregularPlurals, pluralRules
		  );

		  /**
		   * Singularize a word.
		   *
		   * @type {Function}
		   */
		  pluralize.singular = replaceWord(
		    irregularPlurals, irregularSingles, singularRules
		  );

		  /**
		   * Check if a word is singular.
		   *
		   * @type {Function}
		   */
		  pluralize.isSingular = checkWord(
		    irregularPlurals, irregularSingles, singularRules
		  );

		  /**
		   * Add a pluralization rule to the collection.
		   *
		   * @param {(string|RegExp)} rule
		   * @param {string}          replacement
		   */
		  pluralize.addPluralRule = function (rule, replacement) {
		    pluralRules.push([sanitizeRule(rule), replacement]);
		  };

		  /**
		   * Add a singularization rule to the collection.
		   *
		   * @param {(string|RegExp)} rule
		   * @param {string}          replacement
		   */
		  pluralize.addSingularRule = function (rule, replacement) {
		    singularRules.push([sanitizeRule(rule), replacement]);
		  };

		  /**
		   * Add an uncountable word rule.
		   *
		   * @param {(string|RegExp)} word
		   */
		  pluralize.addUncountableRule = function (word) {
		    if (typeof word === 'string') {
		      uncountables[word.toLowerCase()] = true;
		      return;
		    }

		    // Set singular and plural references for the word.
		    pluralize.addPluralRule(word, '$0');
		    pluralize.addSingularRule(word, '$0');
		  };

		  /**
		   * Add an irregular word definition.
		   *
		   * @param {string} single
		   * @param {string} plural
		   */
		  pluralize.addIrregularRule = function (single, plural) {
		    plural = plural.toLowerCase();
		    single = single.toLowerCase();

		    irregularSingles[single] = plural;
		    irregularPlurals[plural] = single;
		  };

		  /**
		   * Irregular rules.
		   */
		  [
		    // Pronouns.
		    ['I', 'we'],
		    ['me', 'us'],
		    ['he', 'they'],
		    ['she', 'they'],
		    ['them', 'them'],
		    ['myself', 'ourselves'],
		    ['yourself', 'yourselves'],
		    ['itself', 'themselves'],
		    ['herself', 'themselves'],
		    ['himself', 'themselves'],
		    ['themself', 'themselves'],
		    ['is', 'are'],
		    ['was', 'were'],
		    ['has', 'have'],
		    ['this', 'these'],
		    ['that', 'those'],
		    // Words ending in with a consonant and `o`.
		    ['echo', 'echoes'],
		    ['dingo', 'dingoes'],
		    ['volcano', 'volcanoes'],
		    ['tornado', 'tornadoes'],
		    ['torpedo', 'torpedoes'],
		    // Ends with `us`.
		    ['genus', 'genera'],
		    ['viscus', 'viscera'],
		    // Ends with `ma`.
		    ['stigma', 'stigmata'],
		    ['stoma', 'stomata'],
		    ['dogma', 'dogmata'],
		    ['lemma', 'lemmata'],
		    ['schema', 'schemata'],
		    ['anathema', 'anathemata'],
		    // Other irregular rules.
		    ['ox', 'oxen'],
		    ['axe', 'axes'],
		    ['die', 'dice'],
		    ['yes', 'yeses'],
		    ['foot', 'feet'],
		    ['eave', 'eaves'],
		    ['goose', 'geese'],
		    ['tooth', 'teeth'],
		    ['quiz', 'quizzes'],
		    ['human', 'humans'],
		    ['proof', 'proofs'],
		    ['carve', 'carves'],
		    ['valve', 'valves'],
		    ['looey', 'looies'],
		    ['thief', 'thieves'],
		    ['groove', 'grooves'],
		    ['pickaxe', 'pickaxes'],
		    ['passerby', 'passersby']
		  ].forEach(function (rule) {
		    return pluralize.addIrregularRule(rule[0], rule[1]);
		  });

		  /**
		   * Pluralization rules.
		   */
		  [
		    [/s?$/i, 's'],
		    [/[^\u0000-\u007F]$/i, '$0'],
		    [/([^aeiou]ese)$/i, '$1'],
		    [/(ax|test)is$/i, '$1es'],
		    [/(alias|[^aou]us|t[lm]as|gas|ris)$/i, '$1es'],
		    [/(e[mn]u)s?$/i, '$1s'],
		    [/([^l]ias|[aeiou]las|[ejzr]as|[iu]am)$/i, '$1'],
		    [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1i'],
		    [/(alumn|alg|vertebr)(?:a|ae)$/i, '$1ae'],
		    [/(seraph|cherub)(?:im)?$/i, '$1im'],
		    [/(her|at|gr)o$/i, '$1oes'],
		    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i, '$1a'],
		    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i, '$1a'],
		    [/sis$/i, 'ses'],
		    [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, '$1$2ves'],
		    [/([^aeiouy]|qu)y$/i, '$1ies'],
		    [/([^ch][ieo][ln])ey$/i, '$1ies'],
		    [/(x|ch|ss|sh|zz)$/i, '$1es'],
		    [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, '$1ices'],
		    [/\b((?:tit)?m|l)(?:ice|ouse)$/i, '$1ice'],
		    [/(pe)(?:rson|ople)$/i, '$1ople'],
		    [/(child)(?:ren)?$/i, '$1ren'],
		    [/eaux$/i, '$0'],
		    [/m[ae]n$/i, 'men'],
		    ['thou', 'you']
		  ].forEach(function (rule) {
		    return pluralize.addPluralRule(rule[0], rule[1]);
		  });

		  /**
		   * Singularization rules.
		   */
		  [
		    [/s$/i, ''],
		    [/(ss)$/i, '$1'],
		    [/(wi|kni|(?:after|half|high|low|mid|non|night|[^\w]|^)li)ves$/i, '$1fe'],
		    [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, '$1f'],
		    [/ies$/i, 'y'],
		    [/\b([pl]|zomb|(?:neck|cross)?t|coll|faer|food|gen|goon|group|lass|talk|goal|cut)ies$/i, '$1ie'],
		    [/\b(mon|smil)ies$/i, '$1ey'],
		    [/\b((?:tit)?m|l)ice$/i, '$1ouse'],
		    [/(seraph|cherub)im$/i, '$1'],
		    [/(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|t[lm]as|gas|(?:her|at|gr)o|[aeiou]ris)(?:es)?$/i, '$1'],
		    [/(analy|diagno|parenthe|progno|synop|the|empha|cri|ne)(?:sis|ses)$/i, '$1sis'],
		    [/(movie|twelve|abuse|e[mn]u)s$/i, '$1'],
		    [/(test)(?:is|es)$/i, '$1is'],
		    [/(alumn|syllab|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1us'],
		    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|quor)a$/i, '$1um'],
		    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)a$/i, '$1on'],
		    [/(alumn|alg|vertebr)ae$/i, '$1a'],
		    [/(cod|mur|sil|vert|ind)ices$/i, '$1ex'],
		    [/(matr|append)ices$/i, '$1ix'],
		    [/(pe)(rson|ople)$/i, '$1rson'],
		    [/(child)ren$/i, '$1'],
		    [/(eau)x?$/i, '$1'],
		    [/men$/i, 'man']
		  ].forEach(function (rule) {
		    return pluralize.addSingularRule(rule[0], rule[1]);
		  });

		  /**
		   * Uncountable rules.
		   */
		  [
		    // Singular words with no plurals.
		    'adulthood',
		    'advice',
		    'agenda',
		    'aid',
		    'aircraft',
		    'alcohol',
		    'ammo',
		    'analytics',
		    'anime',
		    'athletics',
		    'audio',
		    'bison',
		    'blood',
		    'bream',
		    'buffalo',
		    'butter',
		    'carp',
		    'cash',
		    'chassis',
		    'chess',
		    'clothing',
		    'cod',
		    'commerce',
		    'cooperation',
		    'corps',
		    'debris',
		    'diabetes',
		    'digestion',
		    'elk',
		    'energy',
		    'equipment',
		    'excretion',
		    'expertise',
		    'firmware',
		    'flounder',
		    'fun',
		    'gallows',
		    'garbage',
		    'graffiti',
		    'hardware',
		    'headquarters',
		    'health',
		    'herpes',
		    'highjinks',
		    'homework',
		    'housework',
		    'information',
		    'jeans',
		    'justice',
		    'kudos',
		    'labour',
		    'literature',
		    'machinery',
		    'mackerel',
		    'mail',
		    'media',
		    'mews',
		    'moose',
		    'music',
		    'mud',
		    'manga',
		    'news',
		    'only',
		    'personnel',
		    'pike',
		    'plankton',
		    'pliers',
		    'police',
		    'pollution',
		    'premises',
		    'rain',
		    'research',
		    'rice',
		    'salmon',
		    'scissors',
		    'series',
		    'sewage',
		    'shambles',
		    'shrimp',
		    'software',
		    'species',
		    'staff',
		    'swine',
		    'tennis',
		    'traffic',
		    'transportation',
		    'trout',
		    'tuna',
		    'wealth',
		    'welfare',
		    'whiting',
		    'wildebeest',
		    'wildlife',
		    'you',
		    /pok[eé]mon$/i,
		    // Regexes.
		    /[^aeiou]ese$/i, // "chinese", "japanese"
		    /deer$/i, // "deer", "reindeer"
		    /fish$/i, // "fish", "blowfish", "angelfish"
		    /measles$/i,
		    /o[iu]s$/i, // "carnivorous"
		    /pox$/i, // "chickpox", "smallpox"
		    /sheep$/i
		  ].forEach(pluralize.addUncountableRule);

		  return pluralize;
		});
	} (pluralize$1));

	var pluralize = pluralize$1.exports;

	var normalizeStrings = {exports: {}};

	var require$$0 = {
		"105": "i",
		"192": "A",
		"193": "A",
		"194": "A",
		"195": "A",
		"196": "A",
		"197": "A",
		"199": "C",
		"200": "E",
		"201": "E",
		"202": "E",
		"203": "E",
		"204": "I",
		"205": "I",
		"206": "I",
		"207": "I",
		"209": "N",
		"210": "O",
		"211": "O",
		"212": "O",
		"213": "O",
		"214": "O",
		"216": "O",
		"217": "U",
		"218": "U",
		"219": "U",
		"220": "U",
		"221": "Y",
		"224": "a",
		"225": "a",
		"226": "a",
		"227": "a",
		"228": "a",
		"229": "a",
		"231": "c",
		"232": "e",
		"233": "e",
		"234": "e",
		"235": "e",
		"236": "i",
		"237": "i",
		"238": "i",
		"239": "i",
		"241": "n",
		"242": "o",
		"243": "o",
		"244": "o",
		"245": "o",
		"246": "o",
		"248": "o",
		"249": "u",
		"250": "u",
		"251": "u",
		"252": "u",
		"253": "y",
		"255": "y",
		"256": "A",
		"257": "a",
		"258": "A",
		"259": "a",
		"260": "A",
		"261": "a",
		"262": "C",
		"263": "c",
		"264": "C",
		"265": "c",
		"266": "C",
		"267": "c",
		"268": "C",
		"269": "c",
		"270": "D",
		"271": "d",
		"272": "D",
		"273": "d",
		"274": "E",
		"275": "e",
		"276": "E",
		"277": "e",
		"278": "E",
		"279": "e",
		"280": "E",
		"281": "e",
		"282": "E",
		"283": "e",
		"284": "G",
		"285": "g",
		"286": "G",
		"287": "g",
		"288": "G",
		"289": "g",
		"290": "G",
		"291": "g",
		"292": "H",
		"293": "h",
		"294": "H",
		"295": "h",
		"296": "I",
		"297": "i",
		"298": "I",
		"299": "i",
		"300": "I",
		"301": "i",
		"302": "I",
		"303": "i",
		"304": "I",
		"308": "J",
		"309": "j",
		"310": "K",
		"311": "k",
		"313": "L",
		"314": "l",
		"315": "L",
		"316": "l",
		"317": "L",
		"318": "l",
		"319": "L",
		"320": "l",
		"321": "L",
		"322": "l",
		"323": "N",
		"324": "n",
		"325": "N",
		"326": "n",
		"327": "N",
		"328": "n",
		"332": "O",
		"333": "o",
		"334": "O",
		"335": "o",
		"336": "O",
		"337": "o",
		"338": "O",
		"339": "o",
		"340": "R",
		"341": "r",
		"342": "R",
		"343": "r",
		"344": "R",
		"345": "r",
		"346": "S",
		"347": "s",
		"348": "S",
		"349": "s",
		"350": "S",
		"351": "s",
		"352": "S",
		"353": "s",
		"354": "T",
		"355": "t",
		"356": "T",
		"357": "t",
		"358": "T",
		"359": "t",
		"360": "U",
		"361": "u",
		"362": "U",
		"363": "u",
		"364": "U",
		"365": "u",
		"366": "U",
		"367": "u",
		"368": "U",
		"369": "u",
		"370": "U",
		"371": "u",
		"372": "W",
		"373": "w",
		"374": "Y",
		"375": "y",
		"376": "Y",
		"377": "Z",
		"378": "z",
		"379": "Z",
		"380": "z",
		"381": "Z",
		"382": "z",
		"384": "b",
		"385": "B",
		"386": "B",
		"387": "b",
		"390": "O",
		"391": "C",
		"392": "c",
		"393": "D",
		"394": "D",
		"395": "D",
		"396": "d",
		"398": "E",
		"400": "E",
		"401": "F",
		"402": "f",
		"403": "G",
		"407": "I",
		"408": "K",
		"409": "k",
		"410": "l",
		"412": "M",
		"413": "N",
		"414": "n",
		"415": "O",
		"416": "O",
		"417": "o",
		"420": "P",
		"421": "p",
		"422": "R",
		"427": "t",
		"428": "T",
		"429": "t",
		"430": "T",
		"431": "U",
		"432": "u",
		"434": "V",
		"435": "Y",
		"436": "y",
		"437": "Z",
		"438": "z",
		"461": "A",
		"462": "a",
		"463": "I",
		"464": "i",
		"465": "O",
		"466": "o",
		"467": "U",
		"468": "u",
		"477": "e",
		"484": "G",
		"485": "g",
		"486": "G",
		"487": "g",
		"488": "K",
		"489": "k",
		"490": "O",
		"491": "o",
		"500": "G",
		"501": "g",
		"504": "N",
		"505": "n",
		"512": "A",
		"513": "a",
		"514": "A",
		"515": "a",
		"516": "E",
		"517": "e",
		"518": "E",
		"519": "e",
		"520": "I",
		"521": "i",
		"522": "I",
		"523": "i",
		"524": "O",
		"525": "o",
		"526": "O",
		"527": "o",
		"528": "R",
		"529": "r",
		"530": "R",
		"531": "r",
		"532": "U",
		"533": "u",
		"534": "U",
		"535": "u",
		"536": "S",
		"537": "s",
		"538": "T",
		"539": "t",
		"542": "H",
		"543": "h",
		"544": "N",
		"545": "d",
		"548": "Z",
		"549": "z",
		"550": "A",
		"551": "a",
		"552": "E",
		"553": "e",
		"558": "O",
		"559": "o",
		"562": "Y",
		"563": "y",
		"564": "l",
		"565": "n",
		"566": "t",
		"567": "j",
		"570": "A",
		"571": "C",
		"572": "c",
		"573": "L",
		"574": "T",
		"575": "s",
		"576": "z",
		"579": "B",
		"580": "U",
		"581": "V",
		"582": "E",
		"583": "e",
		"584": "J",
		"585": "j",
		"586": "Q",
		"587": "q",
		"588": "R",
		"589": "r",
		"590": "Y",
		"591": "y",
		"592": "a",
		"593": "a",
		"595": "b",
		"596": "o",
		"597": "c",
		"598": "d",
		"599": "d",
		"600": "e",
		"603": "e",
		"604": "e",
		"605": "e",
		"606": "e",
		"607": "j",
		"608": "g",
		"609": "g",
		"610": "g",
		"613": "h",
		"614": "h",
		"616": "i",
		"618": "i",
		"619": "l",
		"620": "l",
		"621": "l",
		"623": "m",
		"624": "m",
		"625": "m",
		"626": "n",
		"627": "n",
		"628": "n",
		"629": "o",
		"633": "r",
		"634": "r",
		"635": "r",
		"636": "r",
		"637": "r",
		"638": "r",
		"639": "r",
		"640": "r",
		"641": "r",
		"642": "s",
		"647": "t",
		"648": "t",
		"649": "u",
		"651": "v",
		"652": "v",
		"653": "w",
		"654": "y",
		"655": "y",
		"656": "z",
		"657": "z",
		"663": "c",
		"665": "b",
		"666": "e",
		"667": "g",
		"668": "h",
		"669": "j",
		"670": "k",
		"671": "l",
		"672": "q",
		"686": "h",
		"688": "h",
		"690": "j",
		"691": "r",
		"692": "r",
		"694": "r",
		"695": "w",
		"696": "y",
		"737": "l",
		"738": "s",
		"739": "x",
		"780": "v",
		"829": "x",
		"851": "x",
		"867": "a",
		"868": "e",
		"869": "i",
		"870": "o",
		"871": "u",
		"872": "c",
		"873": "d",
		"874": "h",
		"875": "m",
		"876": "r",
		"877": "t",
		"878": "v",
		"879": "x",
		"7424": "a",
		"7427": "b",
		"7428": "c",
		"7429": "d",
		"7431": "e",
		"7432": "e",
		"7433": "i",
		"7434": "j",
		"7435": "k",
		"7436": "l",
		"7437": "m",
		"7438": "n",
		"7439": "o",
		"7440": "o",
		"7441": "o",
		"7442": "o",
		"7443": "o",
		"7446": "o",
		"7447": "o",
		"7448": "p",
		"7449": "r",
		"7450": "r",
		"7451": "t",
		"7452": "u",
		"7453": "u",
		"7454": "u",
		"7455": "m",
		"7456": "v",
		"7457": "w",
		"7458": "z",
		"7522": "i",
		"7523": "r",
		"7524": "u",
		"7525": "v",
		"7680": "A",
		"7681": "a",
		"7682": "B",
		"7683": "b",
		"7684": "B",
		"7685": "b",
		"7686": "B",
		"7687": "b",
		"7690": "D",
		"7691": "d",
		"7692": "D",
		"7693": "d",
		"7694": "D",
		"7695": "d",
		"7696": "D",
		"7697": "d",
		"7698": "D",
		"7699": "d",
		"7704": "E",
		"7705": "e",
		"7706": "E",
		"7707": "e",
		"7710": "F",
		"7711": "f",
		"7712": "G",
		"7713": "g",
		"7714": "H",
		"7715": "h",
		"7716": "H",
		"7717": "h",
		"7718": "H",
		"7719": "h",
		"7720": "H",
		"7721": "h",
		"7722": "H",
		"7723": "h",
		"7724": "I",
		"7725": "i",
		"7728": "K",
		"7729": "k",
		"7730": "K",
		"7731": "k",
		"7732": "K",
		"7733": "k",
		"7734": "L",
		"7735": "l",
		"7738": "L",
		"7739": "l",
		"7740": "L",
		"7741": "l",
		"7742": "M",
		"7743": "m",
		"7744": "M",
		"7745": "m",
		"7746": "M",
		"7747": "m",
		"7748": "N",
		"7749": "n",
		"7750": "N",
		"7751": "n",
		"7752": "N",
		"7753": "n",
		"7754": "N",
		"7755": "n",
		"7764": "P",
		"7765": "p",
		"7766": "P",
		"7767": "p",
		"7768": "R",
		"7769": "r",
		"7770": "R",
		"7771": "r",
		"7774": "R",
		"7775": "r",
		"7776": "S",
		"7777": "s",
		"7778": "S",
		"7779": "s",
		"7786": "T",
		"7787": "t",
		"7788": "T",
		"7789": "t",
		"7790": "T",
		"7791": "t",
		"7792": "T",
		"7793": "t",
		"7794": "U",
		"7795": "u",
		"7796": "U",
		"7797": "u",
		"7798": "U",
		"7799": "u",
		"7804": "V",
		"7805": "v",
		"7806": "V",
		"7807": "v",
		"7808": "W",
		"7809": "w",
		"7810": "W",
		"7811": "w",
		"7812": "W",
		"7813": "w",
		"7814": "W",
		"7815": "w",
		"7816": "W",
		"7817": "w",
		"7818": "X",
		"7819": "x",
		"7820": "X",
		"7821": "x",
		"7822": "Y",
		"7823": "y",
		"7824": "Z",
		"7825": "z",
		"7826": "Z",
		"7827": "z",
		"7828": "Z",
		"7829": "z",
		"7835": "s",
		"7840": "A",
		"7841": "a",
		"7842": "A",
		"7843": "a",
		"7864": "E",
		"7865": "e",
		"7866": "E",
		"7867": "e",
		"7868": "E",
		"7869": "e",
		"7880": "I",
		"7881": "i",
		"7882": "I",
		"7883": "i",
		"7884": "O",
		"7885": "o",
		"7886": "O",
		"7887": "o",
		"7908": "U",
		"7909": "u",
		"7910": "U",
		"7911": "u",
		"7922": "Y",
		"7923": "y",
		"7924": "Y",
		"7925": "y",
		"7926": "Y",
		"7927": "y",
		"7928": "Y",
		"7929": "y",
		"8305": "i",
		"8341": "h",
		"8342": "k",
		"8343": "l",
		"8344": "m",
		"8345": "n",
		"8346": "p",
		"8347": "s",
		"8348": "t",
		"8450": "c",
		"8458": "g",
		"8459": "h",
		"8460": "h",
		"8461": "h",
		"8464": "i",
		"8465": "i",
		"8466": "l",
		"8467": "l",
		"8468": "l",
		"8469": "n",
		"8472": "p",
		"8473": "p",
		"8474": "q",
		"8475": "r",
		"8476": "r",
		"8477": "r",
		"8484": "z",
		"8488": "z",
		"8492": "b",
		"8493": "c",
		"8495": "e",
		"8496": "e",
		"8497": "f",
		"8498": "F",
		"8499": "m",
		"8500": "o",
		"8506": "q",
		"8513": "g",
		"8514": "l",
		"8515": "l",
		"8516": "y",
		"8517": "d",
		"8518": "d",
		"8519": "e",
		"8520": "i",
		"8521": "j",
		"8526": "f",
		"8579": "C",
		"8580": "c",
		"8765": "s",
		"8766": "s",
		"8959": "z",
		"8999": "x",
		"9746": "x",
		"9776": "i",
		"9866": "i",
		"10005": "x",
		"10006": "x",
		"10007": "x",
		"10008": "x",
		"10625": "z",
		"10626": "z",
		"11362": "L",
		"11364": "R",
		"11365": "a",
		"11366": "t",
		"11373": "A",
		"11374": "M",
		"11375": "A",
		"11390": "S",
		"11391": "Z",
		"19904": "i",
		"42893": "H",
		"42922": "H",
		"42923": "E",
		"42924": "G",
		"42925": "L",
		"42928": "K",
		"42929": "T",
		"62937": "x"
	};

	(function (module) {
		(function(global, factory) {
		  if (module.exports) {
		    module.exports = factory(global, global.document);
		  } else {
		      global.normalize = factory(global, global.document);
		  }
		} (typeof window !== 'undefined' ? window : commonjsGlobal, function (window, document) {
		  var charmap = require$$0;
		  var regex = null;
		  var current_charmap;
		  var old_charmap;

		  function normalize(str, custom_charmap) {
		    old_charmap = current_charmap;
		    current_charmap = custom_charmap || charmap;

		    regex = (regex && old_charmap === current_charmap) ? regex : buildRegExp(current_charmap);

		    return str.replace(regex, function(charToReplace) {
		      return current_charmap[charToReplace.charCodeAt(0)] || charToReplace;
		    });
		  }

		  function buildRegExp(charmap){
		     return new RegExp('[' + Object.keys(charmap).map(function(code) {return String.fromCharCode(code); }).join(' ') + ']', 'g');
		   }

		  return normalize;
		}));
	} (normalizeStrings));

	var normalize = normalizeStrings.exports;

	var problematic = {
	  abalone: 4,
	  abare: 3,
	  abbruzzese: 4,
	  abed: 2,
	  aborigine: 5,
	  abruzzese: 4,
	  acreage: 3,
	  adame: 3,
	  adieu: 2,
	  adobe: 3,
	  anemone: 4,
	  anyone: 3,
	  apache: 3,
	  aphrodite: 4,
	  apostrophe: 4,
	  ariadne: 4,
	  cafe: 2,
	  calliope: 4,
	  catastrophe: 4,
	  chile: 2,
	  chloe: 2,
	  circe: 2,
	  coyote: 3,
	  daphne: 2,
	  epitome: 4,
	  eurydice: 4,
	  euterpe: 3,
	  every: 2,
	  everywhere: 3,
	  forever: 3,
	  gethsemane: 4,
	  guacamole: 4,
	  hermione: 4,
	  hyperbole: 4,
	  jesse: 2,
	  jukebox: 2,
	  karate: 3,
	  machete: 3,
	  maybe: 2,
	  naive: 2,
	  newlywed: 3,
	  penelope: 4,
	  people: 2,
	  persephone: 4,
	  phoebe: 2,
	  pulse: 1,
	  queue: 1,
	  recipe: 3,
	  riverbed: 3,
	  sesame: 3,
	  shoreline: 2,
	  simile: 3,
	  snuffleupagus: 5,
	  sometimes: 2,
	  syncope: 3,
	  tamale: 3,
	  waterbed: 3,
	  wednesday: 2,
	  yosemite: 4,
	  zoe: 2
	};

	var own = {}.hasOwnProperty;

	// Two expressions of occurrences which normally would be counted as two
	// syllables, but should be counted as one.
	var EXPRESSION_MONOSYLLABIC_ONE = new RegExp(
	  [
	    'awe($|d|so)',
	    'cia(?:l|$)',
	    'tia',
	    'cius',
	    'cious',
	    '[^aeiou]giu',
	    '[aeiouy][^aeiouy]ion',
	    'iou',
	    'sia$',
	    'eous$',
	    '[oa]gue$',
	    '.[^aeiuoycgltdb]{2,}ed$',
	    '.ely$',
	    '^jua',
	    'uai',
	    'eau',
	    '^busi$',
	    '(?:[aeiouy](?:' +
	      [
	        '[bcfgklmnprsvwxyz]',
	        'ch',
	        'dg',
	        'g[hn]',
	        'lch',
	        'l[lv]',
	        'mm',
	        'nch',
	        'n[cgn]',
	        'r[bcnsv]',
	        'squ',
	        's[chkls]',
	        'th'
	      ].join('|') +
	      ')ed$)',
	    '(?:[aeiouy](?:' +
	      [
	        '[bdfklmnprstvy]',
	        'ch',
	        'g[hn]',
	        'lch',
	        'l[lv]',
	        'mm',
	        'nch',
	        'nn',
	        'r[nsv]',
	        'squ',
	        's[cklst]',
	        'th'
	      ].join('|') +
	      ')es$)'
	  ].join('|'),
	  'g'
	);

	var EXPRESSION_MONOSYLLABIC_TWO = new RegExp(
	  '[aeiouy](?:' +
	    [
	      '[bcdfgklmnprstvyz]',
	      'ch',
	      'dg',
	      'g[hn]',
	      'l[lv]',
	      'mm',
	      'n[cgns]',
	      'r[cnsv]',
	      'squ',
	      's[cklst]',
	      'th'
	    ].join('|') +
	    ')e$',
	  'g'
	);

	// Four expression of occurrences which normally would be counted as one
	// syllable, but should be counted as two.
	var EXPRESSION_DOUBLE_SYLLABIC_ONE = new RegExp(
	  '(?:' +
	    [
	      '([^aeiouy])\\1l',
	      '[^aeiouy]ie(?:r|s?t)',
	      '[aeiouym]bl',
	      'eo',
	      'ism',
	      'asm',
	      'thm',
	      'dnt',
	      'snt',
	      'uity',
	      'dea',
	      'gean',
	      'oa',
	      'ua',
	      'react?',
	      'orbed', // Cancel `'.[^aeiuoycgltdb]{2,}ed$',`
	      'shred', // Cancel `'.[^aeiuoycgltdb]{2,}ed$',`
	      'eings?',
	      '[aeiouy]sh?e[rs]'
	    ].join('|') +
	    ')$',
	  'g'
	);

	var EXPRESSION_DOUBLE_SYLLABIC_TWO = new RegExp(
	  [
	    'creat(?!u)',
	    '[^gq]ua[^auieo]',
	    '[aeiou]{3}',
	    '^(?:ia|mc|coa[dglx].)',
	    '^re(app|es|im|us)',
	    '(th|d)eist'
	  ].join('|'),
	  'g'
	);

	var EXPRESSION_DOUBLE_SYLLABIC_THREE = new RegExp(
	  [
	    '[^aeiou]y[ae]',
	    '[^l]lien',
	    'riet',
	    'dien',
	    'iu',
	    'io',
	    'ii',
	    'uen',
	    '[aeilotu]real',
	    'real[aeilotu]',
	    'iell',
	    'eo[^aeiou]',
	    '[aeiou]y[aeiou]'
	  ].join('|'),
	  'g'
	);

	var EXPRESSION_DOUBLE_SYLLABIC_FOUR = /[^s]ia/;

	// Expression to match single syllable pre- and suffixes.
	var EXPRESSION_SINGLE = new RegExp(
	  [
	    '^(?:' +
	      [
	        'un',
	        'fore',
	        'ware',
	        'none?',
	        'out',
	        'post',
	        'sub',
	        'pre',
	        'pro',
	        'dis',
	        'side',
	        'some'
	      ].join('|') +
	      ')',
	    '(?:' +
	      [
	        'ly',
	        'less',
	        'some',
	        'ful',
	        'ers?',
	        'ness',
	        'cians?',
	        'ments?',
	        'ettes?',
	        'villes?',
	        'ships?',
	        'sides?',
	        'ports?',
	        'shires?',
	        '[gnst]ion(?:ed|s)?'
	      ].join('|') +
	      ')$'
	  ].join('|'),
	  'g'
	);

	// Expression to match double syllable pre- and suffixes.
	var EXPRESSION_DOUBLE = new RegExp(
	  [
	    '^' +
	      '(?:' +
	      [
	        'above',
	        'anti',
	        'ante',
	        'counter',
	        'hyper',
	        'afore',
	        'agri',
	        'infra',
	        'intra',
	        'inter',
	        'over',
	        'semi',
	        'ultra',
	        'under',
	        'extra',
	        'dia',
	        'micro',
	        'mega',
	        'kilo',
	        'pico',
	        'nano',
	        'macro',
	        'somer'
	      ].join('|') +
	      ')',
	    '(?:fully|berry|woman|women|edly|union|((?:[bcdfghjklmnpqrstvwxz])|[aeiou])ye?ing)$'
	  ].join('|'),
	  'g'
	);

	// Expression to match triple syllable suffixes.
	var EXPRESSION_TRIPLE = /(creations?|ology|ologist|onomy|onomist)$/g;

	// Wrapper to support multiple word-parts (GH-11).
	/**
	 * Syllable count
	 *
	 * @param {string} value
	 * @returns {number}
	 */
	function syllable(value) {
	  var values = normalize(String(value))
	    .toLowerCase()
	    // Remove apostrophes.
	    .replace(/['’]/g, '')
	    // Split on word boundaries.
	    .split(/\b/g);
	  var index = -1;
	  var sum = 0;

	  while (++index < values.length) {
	    // Remove non-alphabetic characters from a given value.
	    sum += one(values[index].replace(/[^a-z]/g, ''));
	  }

	  return sum
	}

	/**
	 * Get syllables in a given value.
	 *
	 * @param {string} value
	 * @returns {number}
	 */
	function one(value) {
	  var count = 0;
	  /** @type {number} */
	  var index;
	  /** @type {string} */
	  var singular;
	  /** @type {Array.<string>} */
	  var parts;
	  /** @type {ReturnType.<returnFactory>} */
	  var addOne;
	  /** @type {ReturnType.<returnFactory>} */
	  var subtractOne;

	  if (value.length === 0) {
	    return count
	  }

	  // Return early when possible.
	  if (value.length < 3) {
	    return 1
	  }

	  // If `value` is a hard to count, it might be in `problematic`.
	  if (own.call(problematic, value)) {
	    return problematic[value]
	  }

	  // Additionally, the singular word might be in `problematic`.
	  singular = pluralize(value, 1);

	  if (own.call(problematic, singular)) {
	    return problematic[singular]
	  }

	  addOne = returnFactory(1);
	  subtractOne = returnFactory(-1);

	  // Count some prefixes and suffixes, and remove their matched ranges.
	  value = value
	    .replace(EXPRESSION_TRIPLE, countFactory(3))
	    .replace(EXPRESSION_DOUBLE, countFactory(2))
	    .replace(EXPRESSION_SINGLE, countFactory(1));

	  // Count multiple consonants.
	  parts = value.split(/[^aeiouy]+/);
	  index = -1;

	  while (++index < parts.length) {
	    if (parts[index] !== '') {
	      count++;
	    }
	  }

	  // Subtract one for occurrences which should be counted as one (but are
	  // counted as two).
	  value
	    .replace(EXPRESSION_MONOSYLLABIC_ONE, subtractOne)
	    .replace(EXPRESSION_MONOSYLLABIC_TWO, subtractOne);

	  // Add one for occurrences which should be counted as two (but are counted as
	  // one).
	  value
	    .replace(EXPRESSION_DOUBLE_SYLLABIC_ONE, addOne)
	    .replace(EXPRESSION_DOUBLE_SYLLABIC_TWO, addOne)
	    .replace(EXPRESSION_DOUBLE_SYLLABIC_THREE, addOne)
	    .replace(EXPRESSION_DOUBLE_SYLLABIC_FOUR, addOne);

	  // Make sure at least on is returned.
	  return count || 1

	  /**
	   * Define scoped counters, to be used in `String#replace()` calls.
	   * The scoped counter removes the matched value from the input.
	   *
	   * @param {number} addition
	   */
	  function countFactory(addition) {
	    return counter
	    /**
	     * @returns {string}
	     */
	    function counter() {
	      count += addition;
	      return ''
	    }
	  }

	  /**
	   * This scoped counter does not remove the matched value from the input.
	   *
	   * @param {number} addition
	   */
	  function returnFactory(addition) {
	    return returner
	    /**
	     * @param {string} $0
	     * @returns {string}
	     */
	    function returner($0) {
	      count += addition;
	      return $0
	    }
	  }
	}

	// Tools to analyse a headline

	class HeadlineEngineLang {
	    static formatSentence(sentence) {
	        let s = sentence.replace(/[^a-zA-Z0-9]/g, " ").toLowerCase().trim();
	        while(s.includes("  ")) {
	            s = s.replace("  ", " ");
	        }
	        return s;
	    }

	    static wordCount(sentence) {
	        return this.formatSentence(sentence).split(" ").length;
	    }

	    static syllableCount(sentence) {        
	        return syllable(this.formatSentence(sentence));
	    }

	    static sentenceCount(sentence) {
	        return sentence.match(/[^!?.;]+/g || []).length;
	    }

	    static fleschReadingEaseScore(sentence) {
	        var wordCount = this.wordCount(sentence);
	        var sentenceCount = this.sentenceCount(sentence);
	        var syllableCount = this.syllableCount(sentence);
	        return Math.round(206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount));
	    }

	    static fleschKincaidGradeLevel(sentence) {
	        var wordCount = this.wordCount(sentence);
	        var sentenceCount = this.sentenceCount(sentence);
	        var syllableCount = this.syllableCount(sentence);
	        return Math.round(0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59);
	    }

	    static letterCount(sentence, ignoreSpaces = false) {
	        if (ignoreSpaces) {
	            return this.formatSentence(sentence).replace(/ /g, "").length;
	        }
	        return this.formatSentence(sentence).length;
	    }

	}

	// Tests
	function tests$1() {
	    const headlines = [{
	        headline: "10 This is a test  -  TITLE",
	        formatted: "10 this is a test title",
	        letters: 23,
	        words: 6,
	        sentences: 1,
	        syllables: 6,
	        fleschReadingEaseScore: 116,
	        fleschKincaidGradeLevel: -1,
	    },
	    {
	        headline: "Eight years of whistle-blower trauma; former SARS executive Johann van Loggerenberg",
	        formatted: "eight years of whistle blower trauma former sars executive johann van loggerenberg",
	        letters: 82,
	        words: 12,
	        sentences: 2,
	        syllables: 23,
	        fleschReadingEaseScore: 39,
	        fleschKincaidGradeLevel: 9,
	    },
	    {
	        headline: "This is a multi-sentence test. It has two sentences.",
	        formatted: "this is a multi sentence test it has two sentences",
	        letters: 50,
	        words: 10,
	        sentences: 2,
	        syllables: 14,
	        fleschReadingEaseScore: 83,
	        fleschKincaidGradeLevel: 3,
	    }];
	    for (let headline of headlines) {
	        console.assert(HeadlineEngineLang.formatSentence(headline.headline) === headline.formatted, `HeadlineEngineLang.formatSentence failed - expected ${headline.formatted}, got ${HeadlineEngineLang.formatSentence(headline.headline)} for "${headline.headline}"`);

	        console.assert(HeadlineEngineLang.wordCount(headline.headline) === headline.words, `HeadlineEngineLang.wordCount failed - expected ${headline.words}, got ${HeadlineEngineLang.wordCount(headline.headline)} for "${headline.headline}"`);

	        console.assert(HeadlineEngineLang.syllableCount(headline.headline) === headline.syllables, `HeadlineEngineLang.syllableCount failed - expected ${headline.syllables}, got ${HeadlineEngineLang.syllableCount(headline.headline)} for "${headline.headline}"`);

	        console.assert(HeadlineEngineLang.sentenceCount(headline.headline) === headline.sentences, `HeadlineEngineLang.sentenceCount failed - expected ${headline.sentences}, got ${HeadlineEngineLang.sentenceCount(headline.headline)} for "${headline.headline}"`);

	        console.assert(HeadlineEngineLang.fleschReadingEaseScore(headline.headline) === headline.fleschReadingEaseScore, `HeadlineEngineLang.fleschReadingEaseScore failed - expected ${headline.fleschReadingEaseScore}, got ${HeadlineEngineLang.fleschReadingEaseScore(headline.headline)} for "${headline.headline}"`);

	        console.assert(HeadlineEngineLang.fleschKincaidGradeLevel(headline.headline) === headline.fleschKincaidGradeLevel, `HeadlineEngineLang.fleschKincaidGradeLevel failed - expected ${headline.fleschKincaidGradeLevel}, got ${HeadlineEngineLang.fleschKincaidGradeLevel(headline.headline)} for "${headline.headline}"`);

	        console.assert(HeadlineEngineLang.letterCount(headline.headline) === headline.letters, `HeadlineEngineLang.letterCount failed - expected ${headline.letters}, got ${HeadlineEngineLang.letterCount(headline.headline)} for "${headline.headline}"`);
	    }
	}

	tests$1();

	let powerword_list = null;



	async function get_powerwords() {
	    if (powerword_list) return powerword_list; // Cached?
	    const headlineengine_powerwords_list = await jQuery.get(headlineengine_powerwords_api).catch(err => {
	        console.log("Could not load powerwords list");
	        return [];
	    });
	    return headlineengine_powerwords_list.map(w => w.toLowerCase());
	}

	async function calc_score(headline) {
	    powerword_list = await get_powerwords();
	    const readable_range = [headlineengine_readability_range_min || 45, headlineengine_readability_range_max || 90];
	    const readable_target = headlineengine_readability_target || 55;
	    const readable_range_min = readable_range[0];
	    const readable_range_max = readable_range[1];
	    const readability_messages = ["Good", "Too Simple", "Too Complex"];
	    const length_range = [headlineengine_length_range_min || 40, headlineengine_length_range_max || 90];
	    const length_target = headlineengine_length_target || 82;
	    const length_messages = ["Good", "Too Short", "Too Long"];

	    function readability(title) {
	        if (!title) return;
	        const ease_score = HeadlineEngineLang.fleschReadingEaseScore(title);
	        let rating = 0;
	        if (ease_score < readable_range_min) {
	            rating = 2;
	        } else if (ease_score > readable_range_max) {
	            rating = 1;
	        }
	        const score = calc_total_score(ease_score, readable_target, readable_range);
	        return {ease_score, score, rating, ease_score, message: readability_messages[rating], pass: ease_score >= readable_range_min && ease_score <= readable_range_max };
	    }

	    function length(title) {
	        if (!title) return;
	        const length = title.length;
	        let rating = 0;
	        if (length < length_range[0]) {
	            rating = 1;
	        } else if (length > length_range[1]) {
	            rating = 2;
	        }
	        const score = calc_total_score(length, length_target, length_range);
	        return { score, rating, length, message: length_messages[rating], pass: length >= length_range[0] && length <= length_range[1] };
	    }

	    function powerwords(title) {
	        if (!title) return;
	        title = title.toLowerCase().replace(/[^a-z]/g, " ");
	        const regex = new RegExp(powerword_list.map(w => `\\b${w}(ed)?(s)?\\b`).join("|"));
	        const powerwords_found = (title.match(regex, "i") || []).filter(p => (p));
	        // console.log({powerwords_found});
	        const score = powerwords_found.length ? 1 : 0;
	        return { score, rating: powerwords_found.length, words: powerwords_found, pass: powerwords_found.length > 0 };
	    }
	    
	    const length_result = length(headline);
	    const readability_result = readability(headline);
	    const powerwords_result = powerwords(headline);
	    const passes = length_result.pass + readability_result.pass + powerwords_result.pass;
	    const rating = passes >= 3 ? "good" : passes >= 1 ? "okay" : "bad";
	    const total_score = (length_result.score + readability_result.score + powerwords_result.score) / 3;
	    return {
	        length: length_result,
	        readability: readability_result,
	        powerwords: powerwords_result,
	        total_score,
	        rating
	    };
	}

	// Tests
	async function tests() {
	    const scores = [
	        {
	            val: 50,
	            target: 50,
	            range: [0, 100],
	            expected: 1
	        },
	        {
	            val: 50,
	            target: 25,
	            range: [0, 50],
	            expected: 0
	        },
	        {
	            val: 50,
	            target: 50,
	            range: [50, 100],
	            expected: 1
	        },
	        {
	            val: 75,
	            target: 50,
	            range: [0, 100],
	            expected: 0.5
	        }
	    ];
	    scores.forEach(score => {
	        console.assert(calc_total_score(score.val, score.target, score.range) === score.expected, `calc_total_score(${score.val}, ${score.target}, [${score.range[0]}, ${score.range[1]}]) !== ${score.expected}; ${calc_total_score(score.val, score.target, score.range)}`);
	    });
	    // const tests = [
	    //     {
	    //         headline: "Eight years of whistle-blower trauma; former SARS executive Johann van Loggerenberg",
	    //         length: { score: 1, rating: "good", length: 19, message: "Good", pass: true },
	    //         readability: { score: 1, rating: "good", ease_score: 55, message: "Good", pass: true },
	    //         powerwords: { score: 1, rating: 1, words: ["this", "is", "a", "test", "headline"], pass: true }
	    //     },
	    //     {
	    //         headline: "This is a test headline",
	    //         length: { score: 1, rating: "good", length: 19, message: "Good", pass: true },
	    //         readability: { score: 1, rating: "good", ease_score: 55, message: "Good", pass: true },
	    //         powerwords: { score: 1, rating: 1, words: ["this", "is", "a", "test", "headline"], pass: true }
	    //     }
	    // ];
	    // tests.forEach(async test => {
	    //     const result = await calc_score(test.headline);
	    //     console.log(result);
	    // }
	    // );
	}
	tests();

	async function main() {
	    async function display_analysis(container) {
	        const title = jQuery("#title").val();
	        if (!title) {
	            container.html("");
	            return;
	        }
	        const score = await calc_score(title);
	        const score_el = jQuery(`
        <div class='headlineengine-score'>
            <div class='headlineengine-score-value headlineengine-score-value-${score.rating}'>${ Math.floor(score.total_score * 100) }</div>
            <div class='headlineengine-score-title'>HeadlineEngine<br>Score</div>
        </div>`);
	        const analysis = jQuery(`<div class="headlineengine-analysis">
            <div class="headlineengine-analysis-readability">Readability: ${score.readability.message} (${Math.round(score.readability.ease_score)})</div>
            <div class="headlineengine-analysis-length">Length: ${score.length.message} (${score.length.length})</div>
            <div class="headlineengine-analysis-powerwords">Powerwords: ${(score.powerwords.words.length) ? score.powerwords.words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(", ") : "None" }</div>
        </div>`);
	        container.html(score_el);
	        container.append(analysis);
	    }
	    jQuery(async () => {
	        const titlewrap_el = jQuery("#titlewrap");
	        const headline_score_container_el = jQuery("<div id='headlineengine-score-container'></div>");
	        titlewrap_el.after(headline_score_container_el);
	        display_analysis(headline_score_container_el);
	        jQuery("#title").on("keyup", function(e) {
	            display_analysis(headline_score_container_el);
	        });
	    });
	    
	}

	main();

})();
//# sourceMappingURL=headlineengine-post.js.map
