(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var App, IS_LIVE, view;

App = require('./App');


/*

WIP - this will ideally change to old format (above) when can figure it out
 */

IS_LIVE = false;

view = IS_LIVE ? {} : window || document;

view.CD_CE = new App(IS_LIVE);

view.CD_CE.init();



},{"./App":6}],2:[function(require,module,exports){
(function (global){
/*! http://mths.be/punycode v1.2.4 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports;
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^ -~]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /\x2E|\u3002|\uFF0E|\uFF61/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		while (length--) {
			array[length] = fn(array[length]);
		}
		return array;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings.
	 * @private
	 * @param {String} domain The domain name.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		return map(string.split(regexSeparators), fn).join('.');
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <http://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols to a Punycode string of ASCII-only
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name to Unicode. Only the
	 * Punycoded parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it on a string that has already been converted to
	 * Unicode.
	 * @memberOf punycode
	 * @param {String} domain The Punycode domain name to convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(domain) {
		return mapDomain(domain, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name to Punycode. Only the
	 * non-ASCII parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it with a domain that's already in ASCII.
	 * @memberOf punycode
	 * @param {String} domain The domain name to convert, as a Unicode string.
	 * @returns {String} The Punycode representation of the given domain name.
	 */
	function toASCII(domain) {
		return mapDomain(domain, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.2.4',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <http://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],3:[function(require,module,exports){
var punycode = require('punycode');
var revEntities = require('./reversed.json');

module.exports = encode;

function encode (str, opts) {
    if (typeof str !== 'string') {
        throw new TypeError('Expected a String');
    }
    if (!opts) opts = {};

    var numeric = true;
    if (opts.named) numeric = false;
    if (opts.numeric !== undefined) numeric = opts.numeric;

    var special = opts.special || {
        '"': true, "'": true,
        '<': true, '>': true,
        '&': true
    };

    var codePoints = punycode.ucs2.decode(str);
    var chars = [];
    for (var i = 0; i < codePoints.length; i++) {
        var cc = codePoints[i];
        var c = punycode.ucs2.encode([ cc ]);
        var e = revEntities[cc];
        if (e && (cc >= 127 || special[c]) && !numeric) {
            chars.push('&' + (/;$/.test(e) ? e : e + ';'));
        }
        else if (cc < 32 || cc >= 127 || special[c]) {
            chars.push('&#' + cc + ';');
        }
        else {
            chars.push(c);
        }
    }
    return chars.join('');
}

},{"./reversed.json":4,"punycode":2}],4:[function(require,module,exports){
module.exports={
    "9": "Tab;",
    "10": "NewLine;",
    "33": "excl;",
    "34": "quot;",
    "35": "num;",
    "36": "dollar;",
    "37": "percnt;",
    "38": "amp;",
    "39": "apos;",
    "40": "lpar;",
    "41": "rpar;",
    "42": "midast;",
    "43": "plus;",
    "44": "comma;",
    "46": "period;",
    "47": "sol;",
    "58": "colon;",
    "59": "semi;",
    "60": "lt;",
    "61": "equals;",
    "62": "gt;",
    "63": "quest;",
    "64": "commat;",
    "91": "lsqb;",
    "92": "bsol;",
    "93": "rsqb;",
    "94": "Hat;",
    "95": "UnderBar;",
    "96": "grave;",
    "123": "lcub;",
    "124": "VerticalLine;",
    "125": "rcub;",
    "160": "NonBreakingSpace;",
    "161": "iexcl;",
    "162": "cent;",
    "163": "pound;",
    "164": "curren;",
    "165": "yen;",
    "166": "brvbar;",
    "167": "sect;",
    "168": "uml;",
    "169": "copy;",
    "170": "ordf;",
    "171": "laquo;",
    "172": "not;",
    "173": "shy;",
    "174": "reg;",
    "175": "strns;",
    "176": "deg;",
    "177": "pm;",
    "178": "sup2;",
    "179": "sup3;",
    "180": "DiacriticalAcute;",
    "181": "micro;",
    "182": "para;",
    "183": "middot;",
    "184": "Cedilla;",
    "185": "sup1;",
    "186": "ordm;",
    "187": "raquo;",
    "188": "frac14;",
    "189": "half;",
    "190": "frac34;",
    "191": "iquest;",
    "192": "Agrave;",
    "193": "Aacute;",
    "194": "Acirc;",
    "195": "Atilde;",
    "196": "Auml;",
    "197": "Aring;",
    "198": "AElig;",
    "199": "Ccedil;",
    "200": "Egrave;",
    "201": "Eacute;",
    "202": "Ecirc;",
    "203": "Euml;",
    "204": "Igrave;",
    "205": "Iacute;",
    "206": "Icirc;",
    "207": "Iuml;",
    "208": "ETH;",
    "209": "Ntilde;",
    "210": "Ograve;",
    "211": "Oacute;",
    "212": "Ocirc;",
    "213": "Otilde;",
    "214": "Ouml;",
    "215": "times;",
    "216": "Oslash;",
    "217": "Ugrave;",
    "218": "Uacute;",
    "219": "Ucirc;",
    "220": "Uuml;",
    "221": "Yacute;",
    "222": "THORN;",
    "223": "szlig;",
    "224": "agrave;",
    "225": "aacute;",
    "226": "acirc;",
    "227": "atilde;",
    "228": "auml;",
    "229": "aring;",
    "230": "aelig;",
    "231": "ccedil;",
    "232": "egrave;",
    "233": "eacute;",
    "234": "ecirc;",
    "235": "euml;",
    "236": "igrave;",
    "237": "iacute;",
    "238": "icirc;",
    "239": "iuml;",
    "240": "eth;",
    "241": "ntilde;",
    "242": "ograve;",
    "243": "oacute;",
    "244": "ocirc;",
    "245": "otilde;",
    "246": "ouml;",
    "247": "divide;",
    "248": "oslash;",
    "249": "ugrave;",
    "250": "uacute;",
    "251": "ucirc;",
    "252": "uuml;",
    "253": "yacute;",
    "254": "thorn;",
    "255": "yuml;",
    "256": "Amacr;",
    "257": "amacr;",
    "258": "Abreve;",
    "259": "abreve;",
    "260": "Aogon;",
    "261": "aogon;",
    "262": "Cacute;",
    "263": "cacute;",
    "264": "Ccirc;",
    "265": "ccirc;",
    "266": "Cdot;",
    "267": "cdot;",
    "268": "Ccaron;",
    "269": "ccaron;",
    "270": "Dcaron;",
    "271": "dcaron;",
    "272": "Dstrok;",
    "273": "dstrok;",
    "274": "Emacr;",
    "275": "emacr;",
    "278": "Edot;",
    "279": "edot;",
    "280": "Eogon;",
    "281": "eogon;",
    "282": "Ecaron;",
    "283": "ecaron;",
    "284": "Gcirc;",
    "285": "gcirc;",
    "286": "Gbreve;",
    "287": "gbreve;",
    "288": "Gdot;",
    "289": "gdot;",
    "290": "Gcedil;",
    "292": "Hcirc;",
    "293": "hcirc;",
    "294": "Hstrok;",
    "295": "hstrok;",
    "296": "Itilde;",
    "297": "itilde;",
    "298": "Imacr;",
    "299": "imacr;",
    "302": "Iogon;",
    "303": "iogon;",
    "304": "Idot;",
    "305": "inodot;",
    "306": "IJlig;",
    "307": "ijlig;",
    "308": "Jcirc;",
    "309": "jcirc;",
    "310": "Kcedil;",
    "311": "kcedil;",
    "312": "kgreen;",
    "313": "Lacute;",
    "314": "lacute;",
    "315": "Lcedil;",
    "316": "lcedil;",
    "317": "Lcaron;",
    "318": "lcaron;",
    "319": "Lmidot;",
    "320": "lmidot;",
    "321": "Lstrok;",
    "322": "lstrok;",
    "323": "Nacute;",
    "324": "nacute;",
    "325": "Ncedil;",
    "326": "ncedil;",
    "327": "Ncaron;",
    "328": "ncaron;",
    "329": "napos;",
    "330": "ENG;",
    "331": "eng;",
    "332": "Omacr;",
    "333": "omacr;",
    "336": "Odblac;",
    "337": "odblac;",
    "338": "OElig;",
    "339": "oelig;",
    "340": "Racute;",
    "341": "racute;",
    "342": "Rcedil;",
    "343": "rcedil;",
    "344": "Rcaron;",
    "345": "rcaron;",
    "346": "Sacute;",
    "347": "sacute;",
    "348": "Scirc;",
    "349": "scirc;",
    "350": "Scedil;",
    "351": "scedil;",
    "352": "Scaron;",
    "353": "scaron;",
    "354": "Tcedil;",
    "355": "tcedil;",
    "356": "Tcaron;",
    "357": "tcaron;",
    "358": "Tstrok;",
    "359": "tstrok;",
    "360": "Utilde;",
    "361": "utilde;",
    "362": "Umacr;",
    "363": "umacr;",
    "364": "Ubreve;",
    "365": "ubreve;",
    "366": "Uring;",
    "367": "uring;",
    "368": "Udblac;",
    "369": "udblac;",
    "370": "Uogon;",
    "371": "uogon;",
    "372": "Wcirc;",
    "373": "wcirc;",
    "374": "Ycirc;",
    "375": "ycirc;",
    "376": "Yuml;",
    "377": "Zacute;",
    "378": "zacute;",
    "379": "Zdot;",
    "380": "zdot;",
    "381": "Zcaron;",
    "382": "zcaron;",
    "402": "fnof;",
    "437": "imped;",
    "501": "gacute;",
    "567": "jmath;",
    "710": "circ;",
    "711": "Hacek;",
    "728": "breve;",
    "729": "dot;",
    "730": "ring;",
    "731": "ogon;",
    "732": "tilde;",
    "733": "DiacriticalDoubleAcute;",
    "785": "DownBreve;",
    "913": "Alpha;",
    "914": "Beta;",
    "915": "Gamma;",
    "916": "Delta;",
    "917": "Epsilon;",
    "918": "Zeta;",
    "919": "Eta;",
    "920": "Theta;",
    "921": "Iota;",
    "922": "Kappa;",
    "923": "Lambda;",
    "924": "Mu;",
    "925": "Nu;",
    "926": "Xi;",
    "927": "Omicron;",
    "928": "Pi;",
    "929": "Rho;",
    "931": "Sigma;",
    "932": "Tau;",
    "933": "Upsilon;",
    "934": "Phi;",
    "935": "Chi;",
    "936": "Psi;",
    "937": "Omega;",
    "945": "alpha;",
    "946": "beta;",
    "947": "gamma;",
    "948": "delta;",
    "949": "epsilon;",
    "950": "zeta;",
    "951": "eta;",
    "952": "theta;",
    "953": "iota;",
    "954": "kappa;",
    "955": "lambda;",
    "956": "mu;",
    "957": "nu;",
    "958": "xi;",
    "959": "omicron;",
    "960": "pi;",
    "961": "rho;",
    "962": "varsigma;",
    "963": "sigma;",
    "964": "tau;",
    "965": "upsilon;",
    "966": "phi;",
    "967": "chi;",
    "968": "psi;",
    "969": "omega;",
    "977": "vartheta;",
    "978": "upsih;",
    "981": "varphi;",
    "982": "varpi;",
    "988": "Gammad;",
    "989": "gammad;",
    "1008": "varkappa;",
    "1009": "varrho;",
    "1013": "varepsilon;",
    "1014": "bepsi;",
    "1025": "IOcy;",
    "1026": "DJcy;",
    "1027": "GJcy;",
    "1028": "Jukcy;",
    "1029": "DScy;",
    "1030": "Iukcy;",
    "1031": "YIcy;",
    "1032": "Jsercy;",
    "1033": "LJcy;",
    "1034": "NJcy;",
    "1035": "TSHcy;",
    "1036": "KJcy;",
    "1038": "Ubrcy;",
    "1039": "DZcy;",
    "1040": "Acy;",
    "1041": "Bcy;",
    "1042": "Vcy;",
    "1043": "Gcy;",
    "1044": "Dcy;",
    "1045": "IEcy;",
    "1046": "ZHcy;",
    "1047": "Zcy;",
    "1048": "Icy;",
    "1049": "Jcy;",
    "1050": "Kcy;",
    "1051": "Lcy;",
    "1052": "Mcy;",
    "1053": "Ncy;",
    "1054": "Ocy;",
    "1055": "Pcy;",
    "1056": "Rcy;",
    "1057": "Scy;",
    "1058": "Tcy;",
    "1059": "Ucy;",
    "1060": "Fcy;",
    "1061": "KHcy;",
    "1062": "TScy;",
    "1063": "CHcy;",
    "1064": "SHcy;",
    "1065": "SHCHcy;",
    "1066": "HARDcy;",
    "1067": "Ycy;",
    "1068": "SOFTcy;",
    "1069": "Ecy;",
    "1070": "YUcy;",
    "1071": "YAcy;",
    "1072": "acy;",
    "1073": "bcy;",
    "1074": "vcy;",
    "1075": "gcy;",
    "1076": "dcy;",
    "1077": "iecy;",
    "1078": "zhcy;",
    "1079": "zcy;",
    "1080": "icy;",
    "1081": "jcy;",
    "1082": "kcy;",
    "1083": "lcy;",
    "1084": "mcy;",
    "1085": "ncy;",
    "1086": "ocy;",
    "1087": "pcy;",
    "1088": "rcy;",
    "1089": "scy;",
    "1090": "tcy;",
    "1091": "ucy;",
    "1092": "fcy;",
    "1093": "khcy;",
    "1094": "tscy;",
    "1095": "chcy;",
    "1096": "shcy;",
    "1097": "shchcy;",
    "1098": "hardcy;",
    "1099": "ycy;",
    "1100": "softcy;",
    "1101": "ecy;",
    "1102": "yucy;",
    "1103": "yacy;",
    "1105": "iocy;",
    "1106": "djcy;",
    "1107": "gjcy;",
    "1108": "jukcy;",
    "1109": "dscy;",
    "1110": "iukcy;",
    "1111": "yicy;",
    "1112": "jsercy;",
    "1113": "ljcy;",
    "1114": "njcy;",
    "1115": "tshcy;",
    "1116": "kjcy;",
    "1118": "ubrcy;",
    "1119": "dzcy;",
    "8194": "ensp;",
    "8195": "emsp;",
    "8196": "emsp13;",
    "8197": "emsp14;",
    "8199": "numsp;",
    "8200": "puncsp;",
    "8201": "ThinSpace;",
    "8202": "VeryThinSpace;",
    "8203": "ZeroWidthSpace;",
    "8204": "zwnj;",
    "8205": "zwj;",
    "8206": "lrm;",
    "8207": "rlm;",
    "8208": "hyphen;",
    "8211": "ndash;",
    "8212": "mdash;",
    "8213": "horbar;",
    "8214": "Vert;",
    "8216": "OpenCurlyQuote;",
    "8217": "rsquor;",
    "8218": "sbquo;",
    "8220": "OpenCurlyDoubleQuote;",
    "8221": "rdquor;",
    "8222": "ldquor;",
    "8224": "dagger;",
    "8225": "ddagger;",
    "8226": "bullet;",
    "8229": "nldr;",
    "8230": "mldr;",
    "8240": "permil;",
    "8241": "pertenk;",
    "8242": "prime;",
    "8243": "Prime;",
    "8244": "tprime;",
    "8245": "bprime;",
    "8249": "lsaquo;",
    "8250": "rsaquo;",
    "8254": "OverBar;",
    "8257": "caret;",
    "8259": "hybull;",
    "8260": "frasl;",
    "8271": "bsemi;",
    "8279": "qprime;",
    "8287": "MediumSpace;",
    "8288": "NoBreak;",
    "8289": "ApplyFunction;",
    "8290": "it;",
    "8291": "InvisibleComma;",
    "8364": "euro;",
    "8411": "TripleDot;",
    "8412": "DotDot;",
    "8450": "Copf;",
    "8453": "incare;",
    "8458": "gscr;",
    "8459": "Hscr;",
    "8460": "Poincareplane;",
    "8461": "quaternions;",
    "8462": "planckh;",
    "8463": "plankv;",
    "8464": "Iscr;",
    "8465": "imagpart;",
    "8466": "Lscr;",
    "8467": "ell;",
    "8469": "Nopf;",
    "8470": "numero;",
    "8471": "copysr;",
    "8472": "wp;",
    "8473": "primes;",
    "8474": "rationals;",
    "8475": "Rscr;",
    "8476": "Rfr;",
    "8477": "Ropf;",
    "8478": "rx;",
    "8482": "trade;",
    "8484": "Zopf;",
    "8487": "mho;",
    "8488": "Zfr;",
    "8489": "iiota;",
    "8492": "Bscr;",
    "8493": "Cfr;",
    "8495": "escr;",
    "8496": "expectation;",
    "8497": "Fscr;",
    "8499": "phmmat;",
    "8500": "oscr;",
    "8501": "aleph;",
    "8502": "beth;",
    "8503": "gimel;",
    "8504": "daleth;",
    "8517": "DD;",
    "8518": "DifferentialD;",
    "8519": "exponentiale;",
    "8520": "ImaginaryI;",
    "8531": "frac13;",
    "8532": "frac23;",
    "8533": "frac15;",
    "8534": "frac25;",
    "8535": "frac35;",
    "8536": "frac45;",
    "8537": "frac16;",
    "8538": "frac56;",
    "8539": "frac18;",
    "8540": "frac38;",
    "8541": "frac58;",
    "8542": "frac78;",
    "8592": "slarr;",
    "8593": "uparrow;",
    "8594": "srarr;",
    "8595": "ShortDownArrow;",
    "8596": "leftrightarrow;",
    "8597": "varr;",
    "8598": "UpperLeftArrow;",
    "8599": "UpperRightArrow;",
    "8600": "searrow;",
    "8601": "swarrow;",
    "8602": "nleftarrow;",
    "8603": "nrightarrow;",
    "8605": "rightsquigarrow;",
    "8606": "twoheadleftarrow;",
    "8607": "Uarr;",
    "8608": "twoheadrightarrow;",
    "8609": "Darr;",
    "8610": "leftarrowtail;",
    "8611": "rightarrowtail;",
    "8612": "mapstoleft;",
    "8613": "UpTeeArrow;",
    "8614": "RightTeeArrow;",
    "8615": "mapstodown;",
    "8617": "larrhk;",
    "8618": "rarrhk;",
    "8619": "looparrowleft;",
    "8620": "rarrlp;",
    "8621": "leftrightsquigarrow;",
    "8622": "nleftrightarrow;",
    "8624": "lsh;",
    "8625": "rsh;",
    "8626": "ldsh;",
    "8627": "rdsh;",
    "8629": "crarr;",
    "8630": "curvearrowleft;",
    "8631": "curvearrowright;",
    "8634": "olarr;",
    "8635": "orarr;",
    "8636": "lharu;",
    "8637": "lhard;",
    "8638": "upharpoonright;",
    "8639": "upharpoonleft;",
    "8640": "RightVector;",
    "8641": "rightharpoondown;",
    "8642": "RightDownVector;",
    "8643": "LeftDownVector;",
    "8644": "rlarr;",
    "8645": "UpArrowDownArrow;",
    "8646": "lrarr;",
    "8647": "llarr;",
    "8648": "uuarr;",
    "8649": "rrarr;",
    "8650": "downdownarrows;",
    "8651": "ReverseEquilibrium;",
    "8652": "rlhar;",
    "8653": "nLeftarrow;",
    "8654": "nLeftrightarrow;",
    "8655": "nRightarrow;",
    "8656": "Leftarrow;",
    "8657": "Uparrow;",
    "8658": "Rightarrow;",
    "8659": "Downarrow;",
    "8660": "Leftrightarrow;",
    "8661": "vArr;",
    "8662": "nwArr;",
    "8663": "neArr;",
    "8664": "seArr;",
    "8665": "swArr;",
    "8666": "Lleftarrow;",
    "8667": "Rrightarrow;",
    "8669": "zigrarr;",
    "8676": "LeftArrowBar;",
    "8677": "RightArrowBar;",
    "8693": "duarr;",
    "8701": "loarr;",
    "8702": "roarr;",
    "8703": "hoarr;",
    "8704": "forall;",
    "8705": "complement;",
    "8706": "PartialD;",
    "8707": "Exists;",
    "8708": "NotExists;",
    "8709": "varnothing;",
    "8711": "nabla;",
    "8712": "isinv;",
    "8713": "notinva;",
    "8715": "SuchThat;",
    "8716": "NotReverseElement;",
    "8719": "Product;",
    "8720": "Coproduct;",
    "8721": "sum;",
    "8722": "minus;",
    "8723": "mp;",
    "8724": "plusdo;",
    "8726": "ssetmn;",
    "8727": "lowast;",
    "8728": "SmallCircle;",
    "8730": "Sqrt;",
    "8733": "vprop;",
    "8734": "infin;",
    "8735": "angrt;",
    "8736": "angle;",
    "8737": "measuredangle;",
    "8738": "angsph;",
    "8739": "VerticalBar;",
    "8740": "nsmid;",
    "8741": "spar;",
    "8742": "nspar;",
    "8743": "wedge;",
    "8744": "vee;",
    "8745": "cap;",
    "8746": "cup;",
    "8747": "Integral;",
    "8748": "Int;",
    "8749": "tint;",
    "8750": "oint;",
    "8751": "DoubleContourIntegral;",
    "8752": "Cconint;",
    "8753": "cwint;",
    "8754": "cwconint;",
    "8755": "CounterClockwiseContourIntegral;",
    "8756": "therefore;",
    "8757": "because;",
    "8758": "ratio;",
    "8759": "Proportion;",
    "8760": "minusd;",
    "8762": "mDDot;",
    "8763": "homtht;",
    "8764": "Tilde;",
    "8765": "bsim;",
    "8766": "mstpos;",
    "8767": "acd;",
    "8768": "wreath;",
    "8769": "nsim;",
    "8770": "esim;",
    "8771": "TildeEqual;",
    "8772": "nsimeq;",
    "8773": "TildeFullEqual;",
    "8774": "simne;",
    "8775": "NotTildeFullEqual;",
    "8776": "TildeTilde;",
    "8777": "NotTildeTilde;",
    "8778": "approxeq;",
    "8779": "apid;",
    "8780": "bcong;",
    "8781": "CupCap;",
    "8782": "HumpDownHump;",
    "8783": "HumpEqual;",
    "8784": "esdot;",
    "8785": "eDot;",
    "8786": "fallingdotseq;",
    "8787": "risingdotseq;",
    "8788": "coloneq;",
    "8789": "eqcolon;",
    "8790": "eqcirc;",
    "8791": "cire;",
    "8793": "wedgeq;",
    "8794": "veeeq;",
    "8796": "trie;",
    "8799": "questeq;",
    "8800": "NotEqual;",
    "8801": "equiv;",
    "8802": "NotCongruent;",
    "8804": "leq;",
    "8805": "GreaterEqual;",
    "8806": "LessFullEqual;",
    "8807": "GreaterFullEqual;",
    "8808": "lneqq;",
    "8809": "gneqq;",
    "8810": "NestedLessLess;",
    "8811": "NestedGreaterGreater;",
    "8812": "twixt;",
    "8813": "NotCupCap;",
    "8814": "NotLess;",
    "8815": "NotGreater;",
    "8816": "NotLessEqual;",
    "8817": "NotGreaterEqual;",
    "8818": "lsim;",
    "8819": "gtrsim;",
    "8820": "NotLessTilde;",
    "8821": "NotGreaterTilde;",
    "8822": "lg;",
    "8823": "gtrless;",
    "8824": "ntlg;",
    "8825": "ntgl;",
    "8826": "Precedes;",
    "8827": "Succeeds;",
    "8828": "PrecedesSlantEqual;",
    "8829": "SucceedsSlantEqual;",
    "8830": "prsim;",
    "8831": "succsim;",
    "8832": "nprec;",
    "8833": "nsucc;",
    "8834": "subset;",
    "8835": "supset;",
    "8836": "nsub;",
    "8837": "nsup;",
    "8838": "SubsetEqual;",
    "8839": "supseteq;",
    "8840": "nsubseteq;",
    "8841": "nsupseteq;",
    "8842": "subsetneq;",
    "8843": "supsetneq;",
    "8845": "cupdot;",
    "8846": "uplus;",
    "8847": "SquareSubset;",
    "8848": "SquareSuperset;",
    "8849": "SquareSubsetEqual;",
    "8850": "SquareSupersetEqual;",
    "8851": "SquareIntersection;",
    "8852": "SquareUnion;",
    "8853": "oplus;",
    "8854": "ominus;",
    "8855": "otimes;",
    "8856": "osol;",
    "8857": "odot;",
    "8858": "ocir;",
    "8859": "oast;",
    "8861": "odash;",
    "8862": "plusb;",
    "8863": "minusb;",
    "8864": "timesb;",
    "8865": "sdotb;",
    "8866": "vdash;",
    "8867": "LeftTee;",
    "8868": "top;",
    "8869": "UpTee;",
    "8871": "models;",
    "8872": "vDash;",
    "8873": "Vdash;",
    "8874": "Vvdash;",
    "8875": "VDash;",
    "8876": "nvdash;",
    "8877": "nvDash;",
    "8878": "nVdash;",
    "8879": "nVDash;",
    "8880": "prurel;",
    "8882": "vltri;",
    "8883": "vrtri;",
    "8884": "trianglelefteq;",
    "8885": "trianglerighteq;",
    "8886": "origof;",
    "8887": "imof;",
    "8888": "mumap;",
    "8889": "hercon;",
    "8890": "intercal;",
    "8891": "veebar;",
    "8893": "barvee;",
    "8894": "angrtvb;",
    "8895": "lrtri;",
    "8896": "xwedge;",
    "8897": "xvee;",
    "8898": "xcap;",
    "8899": "xcup;",
    "8900": "diamond;",
    "8901": "sdot;",
    "8902": "Star;",
    "8903": "divonx;",
    "8904": "bowtie;",
    "8905": "ltimes;",
    "8906": "rtimes;",
    "8907": "lthree;",
    "8908": "rthree;",
    "8909": "bsime;",
    "8910": "cuvee;",
    "8911": "cuwed;",
    "8912": "Subset;",
    "8913": "Supset;",
    "8914": "Cap;",
    "8915": "Cup;",
    "8916": "pitchfork;",
    "8917": "epar;",
    "8918": "ltdot;",
    "8919": "gtrdot;",
    "8920": "Ll;",
    "8921": "ggg;",
    "8922": "LessEqualGreater;",
    "8923": "gtreqless;",
    "8926": "curlyeqprec;",
    "8927": "curlyeqsucc;",
    "8928": "nprcue;",
    "8929": "nsccue;",
    "8930": "nsqsube;",
    "8931": "nsqsupe;",
    "8934": "lnsim;",
    "8935": "gnsim;",
    "8936": "prnsim;",
    "8937": "succnsim;",
    "8938": "ntriangleleft;",
    "8939": "ntriangleright;",
    "8940": "ntrianglelefteq;",
    "8941": "ntrianglerighteq;",
    "8942": "vellip;",
    "8943": "ctdot;",
    "8944": "utdot;",
    "8945": "dtdot;",
    "8946": "disin;",
    "8947": "isinsv;",
    "8948": "isins;",
    "8949": "isindot;",
    "8950": "notinvc;",
    "8951": "notinvb;",
    "8953": "isinE;",
    "8954": "nisd;",
    "8955": "xnis;",
    "8956": "nis;",
    "8957": "notnivc;",
    "8958": "notnivb;",
    "8965": "barwedge;",
    "8966": "doublebarwedge;",
    "8968": "LeftCeiling;",
    "8969": "RightCeiling;",
    "8970": "lfloor;",
    "8971": "RightFloor;",
    "8972": "drcrop;",
    "8973": "dlcrop;",
    "8974": "urcrop;",
    "8975": "ulcrop;",
    "8976": "bnot;",
    "8978": "profline;",
    "8979": "profsurf;",
    "8981": "telrec;",
    "8982": "target;",
    "8988": "ulcorner;",
    "8989": "urcorner;",
    "8990": "llcorner;",
    "8991": "lrcorner;",
    "8994": "sfrown;",
    "8995": "ssmile;",
    "9005": "cylcty;",
    "9006": "profalar;",
    "9014": "topbot;",
    "9021": "ovbar;",
    "9023": "solbar;",
    "9084": "angzarr;",
    "9136": "lmoustache;",
    "9137": "rmoustache;",
    "9140": "tbrk;",
    "9141": "UnderBracket;",
    "9142": "bbrktbrk;",
    "9180": "OverParenthesis;",
    "9181": "UnderParenthesis;",
    "9182": "OverBrace;",
    "9183": "UnderBrace;",
    "9186": "trpezium;",
    "9191": "elinters;",
    "9251": "blank;",
    "9416": "oS;",
    "9472": "HorizontalLine;",
    "9474": "boxv;",
    "9484": "boxdr;",
    "9488": "boxdl;",
    "9492": "boxur;",
    "9496": "boxul;",
    "9500": "boxvr;",
    "9508": "boxvl;",
    "9516": "boxhd;",
    "9524": "boxhu;",
    "9532": "boxvh;",
    "9552": "boxH;",
    "9553": "boxV;",
    "9554": "boxdR;",
    "9555": "boxDr;",
    "9556": "boxDR;",
    "9557": "boxdL;",
    "9558": "boxDl;",
    "9559": "boxDL;",
    "9560": "boxuR;",
    "9561": "boxUr;",
    "9562": "boxUR;",
    "9563": "boxuL;",
    "9564": "boxUl;",
    "9565": "boxUL;",
    "9566": "boxvR;",
    "9567": "boxVr;",
    "9568": "boxVR;",
    "9569": "boxvL;",
    "9570": "boxVl;",
    "9571": "boxVL;",
    "9572": "boxHd;",
    "9573": "boxhD;",
    "9574": "boxHD;",
    "9575": "boxHu;",
    "9576": "boxhU;",
    "9577": "boxHU;",
    "9578": "boxvH;",
    "9579": "boxVh;",
    "9580": "boxVH;",
    "9600": "uhblk;",
    "9604": "lhblk;",
    "9608": "block;",
    "9617": "blk14;",
    "9618": "blk12;",
    "9619": "blk34;",
    "9633": "square;",
    "9642": "squf;",
    "9643": "EmptyVerySmallSquare;",
    "9645": "rect;",
    "9646": "marker;",
    "9649": "fltns;",
    "9651": "xutri;",
    "9652": "utrif;",
    "9653": "utri;",
    "9656": "rtrif;",
    "9657": "triangleright;",
    "9661": "xdtri;",
    "9662": "dtrif;",
    "9663": "triangledown;",
    "9666": "ltrif;",
    "9667": "triangleleft;",
    "9674": "lozenge;",
    "9675": "cir;",
    "9708": "tridot;",
    "9711": "xcirc;",
    "9720": "ultri;",
    "9721": "urtri;",
    "9722": "lltri;",
    "9723": "EmptySmallSquare;",
    "9724": "FilledSmallSquare;",
    "9733": "starf;",
    "9734": "star;",
    "9742": "phone;",
    "9792": "female;",
    "9794": "male;",
    "9824": "spadesuit;",
    "9827": "clubsuit;",
    "9829": "heartsuit;",
    "9830": "diams;",
    "9834": "sung;",
    "9837": "flat;",
    "9838": "natural;",
    "9839": "sharp;",
    "10003": "checkmark;",
    "10007": "cross;",
    "10016": "maltese;",
    "10038": "sext;",
    "10072": "VerticalSeparator;",
    "10098": "lbbrk;",
    "10099": "rbbrk;",
    "10184": "bsolhsub;",
    "10185": "suphsol;",
    "10214": "lobrk;",
    "10215": "robrk;",
    "10216": "LeftAngleBracket;",
    "10217": "RightAngleBracket;",
    "10218": "Lang;",
    "10219": "Rang;",
    "10220": "loang;",
    "10221": "roang;",
    "10229": "xlarr;",
    "10230": "xrarr;",
    "10231": "xharr;",
    "10232": "xlArr;",
    "10233": "xrArr;",
    "10234": "xhArr;",
    "10236": "xmap;",
    "10239": "dzigrarr;",
    "10498": "nvlArr;",
    "10499": "nvrArr;",
    "10500": "nvHarr;",
    "10501": "Map;",
    "10508": "lbarr;",
    "10509": "rbarr;",
    "10510": "lBarr;",
    "10511": "rBarr;",
    "10512": "RBarr;",
    "10513": "DDotrahd;",
    "10514": "UpArrowBar;",
    "10515": "DownArrowBar;",
    "10518": "Rarrtl;",
    "10521": "latail;",
    "10522": "ratail;",
    "10523": "lAtail;",
    "10524": "rAtail;",
    "10525": "larrfs;",
    "10526": "rarrfs;",
    "10527": "larrbfs;",
    "10528": "rarrbfs;",
    "10531": "nwarhk;",
    "10532": "nearhk;",
    "10533": "searhk;",
    "10534": "swarhk;",
    "10535": "nwnear;",
    "10536": "toea;",
    "10537": "tosa;",
    "10538": "swnwar;",
    "10547": "rarrc;",
    "10549": "cudarrr;",
    "10550": "ldca;",
    "10551": "rdca;",
    "10552": "cudarrl;",
    "10553": "larrpl;",
    "10556": "curarrm;",
    "10557": "cularrp;",
    "10565": "rarrpl;",
    "10568": "harrcir;",
    "10569": "Uarrocir;",
    "10570": "lurdshar;",
    "10571": "ldrushar;",
    "10574": "LeftRightVector;",
    "10575": "RightUpDownVector;",
    "10576": "DownLeftRightVector;",
    "10577": "LeftUpDownVector;",
    "10578": "LeftVectorBar;",
    "10579": "RightVectorBar;",
    "10580": "RightUpVectorBar;",
    "10581": "RightDownVectorBar;",
    "10582": "DownLeftVectorBar;",
    "10583": "DownRightVectorBar;",
    "10584": "LeftUpVectorBar;",
    "10585": "LeftDownVectorBar;",
    "10586": "LeftTeeVector;",
    "10587": "RightTeeVector;",
    "10588": "RightUpTeeVector;",
    "10589": "RightDownTeeVector;",
    "10590": "DownLeftTeeVector;",
    "10591": "DownRightTeeVector;",
    "10592": "LeftUpTeeVector;",
    "10593": "LeftDownTeeVector;",
    "10594": "lHar;",
    "10595": "uHar;",
    "10596": "rHar;",
    "10597": "dHar;",
    "10598": "luruhar;",
    "10599": "ldrdhar;",
    "10600": "ruluhar;",
    "10601": "rdldhar;",
    "10602": "lharul;",
    "10603": "llhard;",
    "10604": "rharul;",
    "10605": "lrhard;",
    "10606": "UpEquilibrium;",
    "10607": "ReverseUpEquilibrium;",
    "10608": "RoundImplies;",
    "10609": "erarr;",
    "10610": "simrarr;",
    "10611": "larrsim;",
    "10612": "rarrsim;",
    "10613": "rarrap;",
    "10614": "ltlarr;",
    "10616": "gtrarr;",
    "10617": "subrarr;",
    "10619": "suplarr;",
    "10620": "lfisht;",
    "10621": "rfisht;",
    "10622": "ufisht;",
    "10623": "dfisht;",
    "10629": "lopar;",
    "10630": "ropar;",
    "10635": "lbrke;",
    "10636": "rbrke;",
    "10637": "lbrkslu;",
    "10638": "rbrksld;",
    "10639": "lbrksld;",
    "10640": "rbrkslu;",
    "10641": "langd;",
    "10642": "rangd;",
    "10643": "lparlt;",
    "10644": "rpargt;",
    "10645": "gtlPar;",
    "10646": "ltrPar;",
    "10650": "vzigzag;",
    "10652": "vangrt;",
    "10653": "angrtvbd;",
    "10660": "ange;",
    "10661": "range;",
    "10662": "dwangle;",
    "10663": "uwangle;",
    "10664": "angmsdaa;",
    "10665": "angmsdab;",
    "10666": "angmsdac;",
    "10667": "angmsdad;",
    "10668": "angmsdae;",
    "10669": "angmsdaf;",
    "10670": "angmsdag;",
    "10671": "angmsdah;",
    "10672": "bemptyv;",
    "10673": "demptyv;",
    "10674": "cemptyv;",
    "10675": "raemptyv;",
    "10676": "laemptyv;",
    "10677": "ohbar;",
    "10678": "omid;",
    "10679": "opar;",
    "10681": "operp;",
    "10683": "olcross;",
    "10684": "odsold;",
    "10686": "olcir;",
    "10687": "ofcir;",
    "10688": "olt;",
    "10689": "ogt;",
    "10690": "cirscir;",
    "10691": "cirE;",
    "10692": "solb;",
    "10693": "bsolb;",
    "10697": "boxbox;",
    "10701": "trisb;",
    "10702": "rtriltri;",
    "10703": "LeftTriangleBar;",
    "10704": "RightTriangleBar;",
    "10716": "iinfin;",
    "10717": "infintie;",
    "10718": "nvinfin;",
    "10723": "eparsl;",
    "10724": "smeparsl;",
    "10725": "eqvparsl;",
    "10731": "lozf;",
    "10740": "RuleDelayed;",
    "10742": "dsol;",
    "10752": "xodot;",
    "10753": "xoplus;",
    "10754": "xotime;",
    "10756": "xuplus;",
    "10758": "xsqcup;",
    "10764": "qint;",
    "10765": "fpartint;",
    "10768": "cirfnint;",
    "10769": "awint;",
    "10770": "rppolint;",
    "10771": "scpolint;",
    "10772": "npolint;",
    "10773": "pointint;",
    "10774": "quatint;",
    "10775": "intlarhk;",
    "10786": "pluscir;",
    "10787": "plusacir;",
    "10788": "simplus;",
    "10789": "plusdu;",
    "10790": "plussim;",
    "10791": "plustwo;",
    "10793": "mcomma;",
    "10794": "minusdu;",
    "10797": "loplus;",
    "10798": "roplus;",
    "10799": "Cross;",
    "10800": "timesd;",
    "10801": "timesbar;",
    "10803": "smashp;",
    "10804": "lotimes;",
    "10805": "rotimes;",
    "10806": "otimesas;",
    "10807": "Otimes;",
    "10808": "odiv;",
    "10809": "triplus;",
    "10810": "triminus;",
    "10811": "tritime;",
    "10812": "iprod;",
    "10815": "amalg;",
    "10816": "capdot;",
    "10818": "ncup;",
    "10819": "ncap;",
    "10820": "capand;",
    "10821": "cupor;",
    "10822": "cupcap;",
    "10823": "capcup;",
    "10824": "cupbrcap;",
    "10825": "capbrcup;",
    "10826": "cupcup;",
    "10827": "capcap;",
    "10828": "ccups;",
    "10829": "ccaps;",
    "10832": "ccupssm;",
    "10835": "And;",
    "10836": "Or;",
    "10837": "andand;",
    "10838": "oror;",
    "10839": "orslope;",
    "10840": "andslope;",
    "10842": "andv;",
    "10843": "orv;",
    "10844": "andd;",
    "10845": "ord;",
    "10847": "wedbar;",
    "10854": "sdote;",
    "10858": "simdot;",
    "10861": "congdot;",
    "10862": "easter;",
    "10863": "apacir;",
    "10864": "apE;",
    "10865": "eplus;",
    "10866": "pluse;",
    "10867": "Esim;",
    "10868": "Colone;",
    "10869": "Equal;",
    "10871": "eDDot;",
    "10872": "equivDD;",
    "10873": "ltcir;",
    "10874": "gtcir;",
    "10875": "ltquest;",
    "10876": "gtquest;",
    "10877": "LessSlantEqual;",
    "10878": "GreaterSlantEqual;",
    "10879": "lesdot;",
    "10880": "gesdot;",
    "10881": "lesdoto;",
    "10882": "gesdoto;",
    "10883": "lesdotor;",
    "10884": "gesdotol;",
    "10885": "lessapprox;",
    "10886": "gtrapprox;",
    "10887": "lneq;",
    "10888": "gneq;",
    "10889": "lnapprox;",
    "10890": "gnapprox;",
    "10891": "lesseqqgtr;",
    "10892": "gtreqqless;",
    "10893": "lsime;",
    "10894": "gsime;",
    "10895": "lsimg;",
    "10896": "gsiml;",
    "10897": "lgE;",
    "10898": "glE;",
    "10899": "lesges;",
    "10900": "gesles;",
    "10901": "eqslantless;",
    "10902": "eqslantgtr;",
    "10903": "elsdot;",
    "10904": "egsdot;",
    "10905": "el;",
    "10906": "eg;",
    "10909": "siml;",
    "10910": "simg;",
    "10911": "simlE;",
    "10912": "simgE;",
    "10913": "LessLess;",
    "10914": "GreaterGreater;",
    "10916": "glj;",
    "10917": "gla;",
    "10918": "ltcc;",
    "10919": "gtcc;",
    "10920": "lescc;",
    "10921": "gescc;",
    "10922": "smt;",
    "10923": "lat;",
    "10924": "smte;",
    "10925": "late;",
    "10926": "bumpE;",
    "10927": "preceq;",
    "10928": "succeq;",
    "10931": "prE;",
    "10932": "scE;",
    "10933": "prnE;",
    "10934": "succneqq;",
    "10935": "precapprox;",
    "10936": "succapprox;",
    "10937": "prnap;",
    "10938": "succnapprox;",
    "10939": "Pr;",
    "10940": "Sc;",
    "10941": "subdot;",
    "10942": "supdot;",
    "10943": "subplus;",
    "10944": "supplus;",
    "10945": "submult;",
    "10946": "supmult;",
    "10947": "subedot;",
    "10948": "supedot;",
    "10949": "subseteqq;",
    "10950": "supseteqq;",
    "10951": "subsim;",
    "10952": "supsim;",
    "10955": "subsetneqq;",
    "10956": "supsetneqq;",
    "10959": "csub;",
    "10960": "csup;",
    "10961": "csube;",
    "10962": "csupe;",
    "10963": "subsup;",
    "10964": "supsub;",
    "10965": "subsub;",
    "10966": "supsup;",
    "10967": "suphsub;",
    "10968": "supdsub;",
    "10969": "forkv;",
    "10970": "topfork;",
    "10971": "mlcp;",
    "10980": "DoubleLeftTee;",
    "10982": "Vdashl;",
    "10983": "Barv;",
    "10984": "vBar;",
    "10985": "vBarv;",
    "10987": "Vbar;",
    "10988": "Not;",
    "10989": "bNot;",
    "10990": "rnmid;",
    "10991": "cirmid;",
    "10992": "midcir;",
    "10993": "topcir;",
    "10994": "nhpar;",
    "10995": "parsim;",
    "11005": "parsl;",
    "64256": "fflig;",
    "64257": "filig;",
    "64258": "fllig;",
    "64259": "ffilig;",
    "64260": "ffllig;"
}
},{}],5:[function(require,module,exports){
/*

	Hashids
	http://hashids.org/node-js
	(c) 2013 Ivan Akimov

	https://github.com/ivanakimov/hashids.node.js
	hashids may be freely distributed under the MIT license.

*/

/*jslint node: true, white: true, plusplus: true, nomen: true */

"use strict";

function Hashids(salt, minHashLength, alphabet) {

	var uniqueAlphabet, i, j, len, sepsLength, diff, guardCount;

	if (!(this instanceof Hashids)) {
		return new Hashids(salt, minHashLength, alphabet);
	}

	this.version = "1.0.1";

	/* internal settings */

	this.minAlphabetLength = 16;
	this.sepDiv = 3.5;
	this.guardDiv = 12;

	/* error messages */

	this.errorAlphabetLength = "error: alphabet must contain at least X unique characters";
	this.errorAlphabetSpace = "error: alphabet cannot contain spaces";

	/* alphabet vars */

	this.alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
	this.seps = "cfhistuCFHISTU";
	this.minHashLength = parseInt(minHashLength, 10) > 0 ? minHashLength : 0;
	this.salt = (typeof salt === "string") ? salt : "";

	if (typeof alphabet === "string") {
		this.alphabet = alphabet;
	}

	for (uniqueAlphabet = "", i = 0, len = this.alphabet.length; i !== len; i++) {
		if (uniqueAlphabet.indexOf(this.alphabet[i]) === -1) {
			uniqueAlphabet += this.alphabet[i];
		}
	}

	this.alphabet = uniqueAlphabet;

	if (this.alphabet.length < this.minAlphabetLength) {
		throw this.errorAlphabetLength.replace("X", this.minAlphabetLength);
	}

	if (this.alphabet.search(" ") !== -1) {
		throw this.errorAlphabetSpace;
	}

	/* seps should contain only characters present in alphabet; alphabet should not contains seps */

	for (i = 0, len = this.seps.length; i !== len; i++) {

		j = this.alphabet.indexOf(this.seps[i]);
		if (j === -1) {
			this.seps = this.seps.substr(0, i) + " " + this.seps.substr(i + 1);
		} else {
			this.alphabet = this.alphabet.substr(0, j) + " " + this.alphabet.substr(j + 1);
		}

	}

	this.alphabet = this.alphabet.replace(/ /g, "");

	this.seps = this.seps.replace(/ /g, "");
	this.seps = this.consistentShuffle(this.seps, this.salt);

	if (!this.seps.length || (this.alphabet.length / this.seps.length) > this.sepDiv) {

		sepsLength = Math.ceil(this.alphabet.length / this.sepDiv);

		if (sepsLength === 1) {
			sepsLength++;
		}

		if (sepsLength > this.seps.length) {

			diff = sepsLength - this.seps.length;
			this.seps += this.alphabet.substr(0, diff);
			this.alphabet = this.alphabet.substr(diff);

		} else {
			this.seps = this.seps.substr(0, sepsLength);
		}

	}

	this.alphabet = this.consistentShuffle(this.alphabet, this.salt);
	guardCount = Math.ceil(this.alphabet.length / this.guardDiv);

	if (this.alphabet.length < 3) {
		this.guards = this.seps.substr(0, guardCount);
		this.seps = this.seps.substr(guardCount);
	} else {
		this.guards = this.alphabet.substr(0, guardCount);
		this.alphabet = this.alphabet.substr(guardCount);
	}

}

Hashids.prototype.encode = function() {

	var ret = "",
		i, len,
		numbers = Array.prototype.slice.call(arguments);

	if (!numbers.length) {
		return ret;
	}

	if (numbers[0] instanceof Array) {
		numbers = numbers[0];
	}

	for (i = 0, len = numbers.length; i !== len; i++) {
		if (typeof numbers[i] !== "number" || numbers[i] % 1 !== 0 || numbers[i] < 0) {
			return ret;
		}
	}

	return this._encode(numbers);

};

Hashids.prototype.decode = function(hash) {

	var ret = [];

	if (!hash.length || typeof hash !== "string") {
		return ret;
	}

	return this._decode(hash, this.alphabet);

};

Hashids.prototype.encodeHex = function(str) {

	var i, len, numbers;

	str = str.toString();
	if (!/^[0-9a-fA-F]+$/.test(str)) {
		return "";
	}

	numbers = str.match(/[\w\W]{1,12}/g);

	for (i = 0, len = numbers.length; i !== len; i++) {
		numbers[i] = parseInt("1" + numbers[i], 16);
	}

	return this.encode.apply(this, numbers);

};

Hashids.prototype.decodeHex = function(hash) {

	var ret = "",
		i, len,
		numbers = this.decode(hash);

	for (i = 0, len = numbers.length; i !== len; i++) {
		ret += (numbers[i]).toString(16).substr(1);
	}

	return ret;

};

Hashids.prototype._encode = function(numbers) {

	var ret, lottery, i, len, number, buffer, last, sepsIndex, guardIndex, guard, halfLength, excess,
		alphabet = this.alphabet,
		numbersSize = numbers.length,
		numbersHashInt = 0;

	for (i = 0, len = numbers.length; i !== len; i++) {
		numbersHashInt += (numbers[i] % (i + 100));
	}

	lottery = ret = alphabet[numbersHashInt % alphabet.length];
	for (i = 0, len = numbers.length; i !== len; i++) {

		number = numbers[i];
		buffer = lottery + this.salt + alphabet;

		alphabet = this.consistentShuffle(alphabet, buffer.substr(0, alphabet.length));
		last = this.hash(number, alphabet);

		ret += last;

		if (i + 1 < numbersSize) {
			number %= (last.charCodeAt(0) + i);
			sepsIndex = number % this.seps.length;
			ret += this.seps[sepsIndex];
		}

	}

	if (ret.length < this.minHashLength) {

		guardIndex = (numbersHashInt + ret[0].charCodeAt(0)) % this.guards.length;
		guard = this.guards[guardIndex];

		ret = guard + ret;

		if (ret.length < this.minHashLength) {

			guardIndex = (numbersHashInt + ret[2].charCodeAt(0)) % this.guards.length;
			guard = this.guards[guardIndex];

			ret += guard;

		}

	}

	halfLength = parseInt(alphabet.length / 2, 10);
	while (ret.length < this.minHashLength) {

		alphabet = this.consistentShuffle(alphabet, alphabet);
		ret = alphabet.substr(halfLength) + ret + alphabet.substr(0, halfLength);

		excess = ret.length - this.minHashLength;
		if (excess > 0) {
			ret = ret.substr(excess / 2, this.minHashLength);
		}

	}

	return ret;

};

Hashids.prototype._decode = function(hash, alphabet) {

	var ret = [],
		i = 0,
		lottery, len, subHash, buffer,
		r = new RegExp("[" + this.guards + "]", "g"),
		hashBreakdown = hash.replace(r, " "),
		hashArray = hashBreakdown.split(" ");

	if (hashArray.length === 3 || hashArray.length === 2) {
		i = 1;
	}

	hashBreakdown = hashArray[i];
	if (typeof hashBreakdown[0] !== "undefined") {

		lottery = hashBreakdown[0];
		hashBreakdown = hashBreakdown.substr(1);

		r = new RegExp("[" + this.seps + "]", "g");
		hashBreakdown = hashBreakdown.replace(r, " ");
		hashArray = hashBreakdown.split(" ");

		for (i = 0, len = hashArray.length; i !== len; i++) {

			subHash = hashArray[i];
			buffer = lottery + this.salt + alphabet;

			alphabet = this.consistentShuffle(alphabet, buffer.substr(0, alphabet.length));
			ret.push(this.unhash(subHash, alphabet));

		}

		if (this._encode(ret) !== hash) {
			ret = [];
		}

	}

	return ret;

};

Hashids.prototype.consistentShuffle = function(alphabet, salt) {

	var integer, j, temp, i, v, p;

	if (!salt.length) {
		return alphabet;
	}

	for (i = alphabet.length - 1, v = 0, p = 0; i > 0; i--, v++) {

		v %= salt.length;
		p += integer = salt[v].charCodeAt(0);
		j = (integer + v + p) % i;

		temp = alphabet[j];
		alphabet = alphabet.substr(0, j) + alphabet[i] + alphabet.substr(j + 1);
		alphabet = alphabet.substr(0, i) + temp + alphabet.substr(i + 1);

	}

	return alphabet;

};

Hashids.prototype.hash = function(input, alphabet) {

	var hash = "",
		alphabetLength = alphabet.length;

	do {
		hash = alphabet[input % alphabetLength] + hash;
		input = parseInt(input / alphabetLength, 10);
	} while (input);

	return hash;

};

Hashids.prototype.unhash = function(input, alphabet) {

	var number = 0, pos, i;

	for (i = 0; i < input.length; i++) {
		pos = alphabet.indexOf(input[i]);
		number += pos * Math.pow(alphabet.length, input.length - i - 1);
	}

	return number;

};

module.exports = Hashids;

},{}],6:[function(require,module,exports){
var Analytics, App, AppData, AppView, AuthManager, Facebook, GooglePlus, Locale, MediaQueries, Nav, Router, Share, Templates,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Analytics = require('./utils/Analytics');

AuthManager = require('./utils/AuthManager');

Share = require('./utils/Share');

Facebook = require('./utils/Facebook');

GooglePlus = require('./utils/GooglePlus');

Templates = require('./data/Templates');

Locale = require('./data/Locale');

Router = require('./router/Router');

Nav = require('./router/Nav');

AppData = require('./AppData');

AppView = require('./AppView');

MediaQueries = require('./utils/MediaQueries');

App = (function() {
  App.prototype.LIVE = null;

  App.prototype.BASE_URL = window.config.hostname;

  App.prototype.SITE_URL = window.config.SITE_URL;

  App.prototype.API_HOST = window.config.API_HOST;

  App.prototype.localeCode = window.config.localeCode;

  App.prototype.objReady = 0;

  App.prototype._toClean = ['objReady', 'setFlags', 'objectComplete', 'init', 'initObjects', 'initSDKs', 'initApp', 'go', 'cleanup', '_toClean'];

  function App(LIVE) {
    this.LIVE = LIVE;
    this.cleanup = __bind(this.cleanup, this);
    this.go = __bind(this.go, this);
    this.initApp = __bind(this.initApp, this);
    this.initSDKs = __bind(this.initSDKs, this);
    this.initObjects = __bind(this.initObjects, this);
    this.init = __bind(this.init, this);
    this.objectComplete = __bind(this.objectComplete, this);
    this.setFlags = __bind(this.setFlags, this);
    return null;
  }

  App.prototype.setFlags = function() {
    var ua;
    ua = window.navigator.userAgent.toLowerCase();
    MediaQueries.setup();
    this.IS_ANDROID = ua.indexOf('android') > -1;
    this.IS_FIREFOX = ua.indexOf('firefox') > -1;
    this.IS_CHROME_IOS = ua.match('crios') ? true : false;
    return null;
  };

  App.prototype.objectComplete = function() {
    this.objReady++;
    if (this.objReady >= 4) {
      this.initApp();
    }
    return null;
  };

  App.prototype.init = function() {
    this.initObjects();
    return null;
  };

  App.prototype.initObjects = function() {
    this.appData = new AppData(this.objectComplete);
    this.templates = new Templates(window._TEMPLATES, this.objectComplete);
    this.locale = new Locale(window._LOCALE_STRINGS, this.objectComplete);
    this.analytics = new Analytics(window._TRACKING, this.objectComplete);
    return null;
  };

  App.prototype.initSDKs = function() {
    Facebook.load();
    GooglePlus.load();
    return null;
  };

  App.prototype.initApp = function() {
    this.setFlags();

    /* Starts application */
    this.appView = new AppView;
    this.router = new Router;
    this.nav = new Nav;
    this.auth = new AuthManager;
    this.share = new Share;
    this.go();
    this.initSDKs();
    return null;
  };

  App.prototype.go = function() {

    /* After everything is loaded, kicks off website */
    this.appView.render();

    /* remove redundant initialisation methods / properties */
    this.cleanup();
    return null;
  };

  App.prototype.cleanup = function() {
    var fn, _i, _len, _ref;
    _ref = this._toClean;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      fn = _ref[_i];
      this[fn] = null;
      delete this[fn];
    }
    return null;
  };

  return App;

})();

module.exports = App;



},{"./AppData":7,"./AppView":8,"./data/Locale":14,"./data/Templates":15,"./router/Nav":21,"./router/Router":22,"./utils/Analytics":23,"./utils/AuthManager":24,"./utils/Facebook":26,"./utils/GooglePlus":27,"./utils/MediaQueries":28,"./utils/Share":31}],7:[function(require,module,exports){
var API, AbstractData, AppData, DoodlesCollection, Requester,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractData = require('./data/AbstractData');

Requester = require('./utils/Requester');

API = require('./data/API');

DoodlesCollection = require('./collections/doodles/DoodlesCollection');

AppData = (function(_super) {
  __extends(AppData, _super);

  AppData.prototype.callback = null;

  AppData.prototype.DOODLE_CACHE_EXPIRES = 99999999999999999;

  function AppData(callback) {
    this.callback = callback;
    this.updateCache = __bind(this.updateCache, this);
    this.setActiveDoodle = __bind(this.setActiveDoodle, this);
    this.updateDoodles = __bind(this.updateDoodles, this);
    this.setDoodles = __bind(this.setDoodles, this);
    this.onFetchDoodlesDone = __bind(this.onFetchDoodlesDone, this);
    this.fetchDoodles = __bind(this.fetchDoodles, this);
    this.checkDoodleCache = __bind(this.checkDoodleCache, this);
    AppData.__super__.constructor.call(this);
    this.doodles = new DoodlesCollection;
    this.checkDoodleCache();
    return null;
  }

  AppData.prototype.checkDoodleCache = function() {
    chrome.storage.sync.get(null, (function(_this) {
      return function(cachedData) {
        var cachedDoodles, data, index;
        if (_.isEmpty(cachedData)) {
          return _this.fetchDoodles();
        }
        cachedDoodles = [];
        for (index in cachedData) {
          data = cachedData[index];
          if (index !== 'lastUpdated') {
            cachedDoodles.push(JSON.parse(data));
          }
        }
        if ((Date.now() - cachedData.lastUpdated) > _this.DOODLE_CACHE_EXPIRES) {
          return _this.fetchDoodles(cachedDoodles);
        } else {
          return _this.setDoodles(cachedDoodles).setActiveDoodle();
        }
      };
    })(this));
    return null;
  };

  AppData.prototype.fetchDoodles = function(cachedDoodles) {
    var r;
    if (cachedDoodles == null) {
      cachedDoodles = false;
    }
    r = Requester.request({
      url: API.get('doodles'),
      type: 'GET'
    });
    r.done((function(_this) {
      return function(data) {
        return _this.onFetchDoodlesDone(data, cachedDoodles);
      };
    })(this));
    r.fail((function(_this) {
      return function(res) {
        return console.error("error loading api start data", res);
      };
    })(this));
    return null;
  };

  AppData.prototype.onFetchDoodlesDone = function(data, cachedDoodles) {
    if (cachedDoodles == null) {
      cachedDoodles = false;
    }
    console.log("onFetchDoodlesDone : (data) =>", data, cachedDoodles);
    if (cachedDoodles) {
      this.updateDoodles(_.shuffle(data.doodles), cachedDoodles).setActiveDoodle();
    } else {
      this.setDoodles(_.shuffle(data.doodles)).setActiveDoodle();
    }
    return null;
  };

  AppData.prototype.setDoodles = function(doodles) {
    this.doodles.add(doodles);
    return this;
  };

  AppData.prototype.updateDoodles = function(newDoodles, cachedDoodles) {
    this.doodles.add(cachedDoodles);
    this.doodles.addNew(newDoodles);
    return this;
  };

  AppData.prototype.setActiveDoodle = function() {
    this.activeDoodle = this.doodles.getNextDoodle();
    if (typeof this.callback === "function") {
      this.callback();
    }
    this.updateCache();
    return null;
  };

  AppData.prototype.updateCache = function() {
    chrome.storage.sync.clear((function(_this) {
      return function() {
        var doodle, newCache, position, _i, _len, _ref;
        newCache = {
          lastUpdated: Date.now()
        };
        _ref = _this.doodles.models;
        for (position = _i = 0, _len = _ref.length; _i < _len; position = ++_i) {
          doodle = _ref[position];
          newCache[position] = JSON.stringify(doodle);
        }
        return chrome.storage.sync.set(newCache);
      };
    })(this));
    return null;
  };

  return AppData;

})(AbstractData);

module.exports = AppData;



},{"./collections/doodles/DoodlesCollection":11,"./data/API":12,"./data/AbstractData":13,"./utils/Requester":30}],8:[function(require,module,exports){
var AbstractView, AppView, Footer, Header, MediaQueries, ModalManager, Preloader, Wrapper,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('./view/AbstractView');

Preloader = require('./view/base/Preloader');

Header = require('./view/base/Header');

Wrapper = require('./view/base/Wrapper');

Footer = require('./view/base/Footer');

ModalManager = require('./view/modals/_ModalManager');

MediaQueries = require('./utils/MediaQueries');

AppView = (function(_super) {
  __extends(AppView, _super);

  AppView.prototype.template = 'main';

  AppView.prototype.$window = null;

  AppView.prototype.$body = null;

  AppView.prototype.wrapper = null;

  AppView.prototype.footer = null;

  AppView.prototype.dims = {
    w: null,
    h: null,
    o: null,
    c: null
  };

  AppView.prototype.events = {
    'click a': 'linkManager'
  };

  AppView.prototype.EVENT_UPDATE_DIMENSIONS = 'EVENT_UPDATE_DIMENSIONS';

  AppView.prototype.MOBILE_WIDTH = 700;

  AppView.prototype.MOBILE = 'mobile';

  AppView.prototype.NON_MOBILE = 'non_mobile';

  function AppView() {
    this.handleExternalLink = __bind(this.handleExternalLink, this);
    this.navigateToUrl = __bind(this.navigateToUrl, this);
    this.linkManager = __bind(this.linkManager, this);
    this.getDims = __bind(this.getDims, this);
    this.onResize = __bind(this.onResize, this);
    this.begin = __bind(this.begin, this);
    this.onAllRendered = __bind(this.onAllRendered, this);
    this.bindEvents = __bind(this.bindEvents, this);
    this.render = __bind(this.render, this);
    this.enableTouch = __bind(this.enableTouch, this);
    this.disableTouch = __bind(this.disableTouch, this);
    this.$window = $(window);
    this.$body = $('body').eq(0);
    AppView.__super__.constructor.call(this);
    return null;
  }

  AppView.prototype.disableTouch = function() {
    this.$window.on('touchmove', this.onTouchMove);
  };

  AppView.prototype.enableTouch = function() {
    this.$window.off('touchmove', this.onTouchMove);
  };

  AppView.prototype.onTouchMove = function(e) {
    e.preventDefault();
  };

  AppView.prototype.render = function() {
    this.bindEvents();
    this.preloader = new Preloader;
    this.modalManager = new ModalManager;
    this.header = new Header;
    this.wrapper = new Wrapper;
    this.footer = new Footer;
    this.addChild(this.header).addChild(this.wrapper).addChild(this.footer);
    this.onAllRendered();
  };

  AppView.prototype.bindEvents = function() {
    this.on('allRendered', this.onAllRendered);
    this.onResize();
    this.onResize = _.debounce(this.onResize, 300);
    this.$window.on('resize orientationchange', this.onResize);
  };

  AppView.prototype.onAllRendered = function() {
    this.$body.prepend(this.$el);
    this.begin();
  };

  AppView.prototype.begin = function() {
    this.trigger('start');
    this.CD_CE().router.start();
    this.preloader.hide();
  };

  AppView.prototype.onResize = function() {
    this.getDims();
  };

  AppView.prototype.getDims = function() {
    var h, w;
    w = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
    this.dims = {
      w: w,
      h: h,
      o: h > w ? 'portrait' : 'landscape',
      c: w <= this.MOBILE_WIDTH ? this.MOBILE : this.NON_MOBILE
    };
    this.trigger(this.EVENT_UPDATE_DIMENSIONS, this.dims);
  };

  AppView.prototype.linkManager = function(e) {
    var href;
    href = $(e.currentTarget).attr('href');
    if (!href) {
      return false;
    }
    this.navigateToUrl(href, e);
  };

  AppView.prototype.navigateToUrl = function(href, e) {
    var route, section;
    if (e == null) {
      e = null;
    }
    route = href.match(this.CD_CE().BASE_URL) ? href.split(this.CD_CE().BASE_URL)[1] : href;
    section = route.indexOf('/') === 0 ? route.split('/')[1] : route;
    if (this.CD_CE().nav.getSection(section)) {
      if (e != null) {
        e.preventDefault();
      }
      this.CD_CE().router.navigateTo(route);
    } else {
      this.handleExternalLink(href);
    }
  };

  AppView.prototype.handleExternalLink = function(data) {

    /*
    
    bind tracking events if necessary
     */
  };

  return AppView;

})(AbstractView);

module.exports = AppView;



},{"./utils/MediaQueries":28,"./view/AbstractView":32,"./view/base/Footer":34,"./view/base/Header":35,"./view/base/Preloader":36,"./view/base/Wrapper":37,"./view/modals/_ModalManager":41}],9:[function(require,module,exports){
var AbstractCollection,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractCollection = (function(_super) {
  __extends(AbstractCollection, _super);

  function AbstractCollection() {
    this.CD_CE = __bind(this.CD_CE, this);
    return AbstractCollection.__super__.constructor.apply(this, arguments);
  }

  AbstractCollection.prototype.CD_CE = function() {
    return window.CD_CE;
  };

  return AbstractCollection;

})(Backbone.Collection);

module.exports = AbstractCollection;



},{}],10:[function(require,module,exports){
var TemplateModel, TemplatesCollection,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

TemplateModel = require('../../models/core/TemplateModel');

TemplatesCollection = (function(_super) {
  __extends(TemplatesCollection, _super);

  function TemplatesCollection() {
    return TemplatesCollection.__super__.constructor.apply(this, arguments);
  }

  TemplatesCollection.prototype.model = TemplateModel;

  return TemplatesCollection;

})(Backbone.Collection);

module.exports = TemplatesCollection;



},{"../../models/core/TemplateModel":19}],11:[function(require,module,exports){
var AbstractCollection, DoodleModel, DoodlesCollection,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractCollection = require('../AbstractCollection');

DoodleModel = require('../../models/doodle/DoodleModel');

DoodlesCollection = (function(_super) {
  __extends(DoodlesCollection, _super);

  function DoodlesCollection() {
    this.getNextDoodle = __bind(this.getNextDoodle, this);
    this.addNew = __bind(this.addNew, this);
    this.getNextDoodle = __bind(this.getNextDoodle, this);
    this.getPrevDoodle = __bind(this.getPrevDoodle, this);
    this.getDoodleByNavSection = __bind(this.getDoodleByNavSection, this);
    this.getDoodleBySlug = __bind(this.getDoodleBySlug, this);
    return DoodlesCollection.__super__.constructor.apply(this, arguments);
  }

  DoodlesCollection.prototype.model = DoodleModel;

  DoodlesCollection.prototype.getDoodleBySlug = function(slug) {
    var doodle;
    doodle = this.findWhere({
      slug: slug
    });
    if (!doodle) {
      console.log("y u no doodle?");
    }
    return doodle;
  };

  DoodlesCollection.prototype.getDoodleByNavSection = function(whichSection) {
    var doodle, section;
    section = this.CD_CE().nav[whichSection];
    doodle = this.findWhere({
      slug: "" + section.sub + "/" + section.ter
    });
    return doodle;
  };

  DoodlesCollection.prototype.getPrevDoodle = function(doodle) {
    var index;
    index = this.indexOf(doodle);
    index--;
    if (index < 0) {
      return false;
    } else {
      return this.at(index);
    }
  };

  DoodlesCollection.prototype.getNextDoodle = function(doodle) {
    var index;
    index = this.indexOf(doodle);
    index++;
    if (index > (this.length.length - 1)) {
      return false;
    } else {
      return this.at(index);
    }
  };

  DoodlesCollection.prototype.addNew = function(doodles) {
    var doodle, _i, _len;
    for (_i = 0, _len = doodles.length; _i < _len; _i++) {
      doodle = doodles[_i];
      if (!this.findWhere({
        index: doodle.index
      })) {
        this.add(doodle);
      }
    }
    return null;
  };

  DoodlesCollection.prototype.getNextDoodle = function() {
    var doodle, nextDoodle, _i, _len, _ref;
    _ref = this.models;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      doodle = _ref[_i];
      if (!doodle.get('viewed')) {
        doodle.set('viewed', true);
        nextDoodle = doodle;
        break;
      }
    }
    if (!nextDoodle) {
      console.log('waaaaa u seen them all?!');
      nextDoodle = _.shuffle(this.models)[0];
    }
    return nextDoodle;
  };

  return DoodlesCollection;

})(AbstractCollection);

module.exports = DoodlesCollection;



},{"../../models/doodle/DoodleModel":20,"../AbstractCollection":9}],12:[function(require,module,exports){
var API, APIRouteModel;

APIRouteModel = require('../models/core/APIRouteModel');

API = (function() {
  function API() {}

  API.model = new APIRouteModel;

  API.getContants = function() {
    return {

      /* add more if we wanna use in API strings */
      API_HOST: API.CD_CE().API_HOST
    };
  };

  API.get = function(name, vars) {
    vars = $.extend(true, vars, API.getContants());
    return API.supplantString(API.model.get(name), vars);
  };

  API.supplantString = function(str, vals) {
    return str.replace(/{{ ([^{}]*) }}/g, function(a, b) {
      var r;
      return r = vals[b] || (typeof vals[b] === 'number' ? vals[b].toString() : '');
    });
    if (typeof r === "string" || typeof r === "number") {
      return r;
    } else {
      return a;
    }
  };

  API.CD_CE = function() {
    return window.CD_CE;
  };

  return API;

})();

module.exports = API;



},{"../models/core/APIRouteModel":17}],13:[function(require,module,exports){
var AbstractData,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

AbstractData = (function() {
  function AbstractData() {
    this.CD_CE = __bind(this.CD_CE, this);
    _.extend(this, Backbone.Events);
    return null;
  }

  AbstractData.prototype.CD_CE = function() {
    return window.CD_CE;
  };

  return AbstractData;

})();

module.exports = AbstractData;



},{}],14:[function(require,module,exports){
var API, Locale, LocalesModel,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

LocalesModel = require('../models/core/LocalesModel');

API = require('../data/API');


/*
 * Locale Loader #

Fires back an event when complete
 */

Locale = (function() {
  Locale.prototype.lang = null;

  Locale.prototype.data = null;

  Locale.prototype.callback = null;

  Locale.prototype["default"] = 'en-gb';

  function Locale(data, cb) {
    this.getLocaleImage = __bind(this.getLocaleImage, this);
    this.get = __bind(this.get, this);
    this.parseData = __bind(this.parseData, this);
    this.getLang = __bind(this.getLang, this);

    /* start Locale Loader, define locale based on browser language */
    this.callback = cb;
    this.lang = this.getLang();
    this.parseData(data);
    null;
  }

  Locale.prototype.getLang = function() {
    var lang;
    if (window.location.search && window.location.search.match('lang=')) {
      lang = window.location.search.split('lang=')[1].split('&')[0];
    } else if (window.config.localeCode) {
      lang = window.config.localeCode;
    } else {
      lang = this["default"];
    }
    return lang;
  };

  Locale.prototype.parseData = function(data) {

    /* Fires back an event once it's complete */
    this.data = new LocalesModel(data);
    if (typeof this.callback === "function") {
      this.callback();
    }
    return null;
  };

  Locale.prototype.get = function(id) {

    /* get String from locale
    + id : string id of the Localised String
     */
    return this.data.getString(id);
  };

  Locale.prototype.getLocaleImage = function(url) {
    return window.config.CDN + "/images/locale/" + window.config.localeCode + "/" + url;
  };

  return Locale;

})();

module.exports = Locale;



},{"../data/API":12,"../models/core/LocalesModel":18}],15:[function(require,module,exports){
var TemplateModel, Templates, TemplatesCollection,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

TemplateModel = require('../models/core/TemplateModel');

TemplatesCollection = require('../collections/core/TemplatesCollection');

Templates = (function() {
  Templates.prototype.templates = null;

  Templates.prototype.cb = null;

  function Templates(data, callback) {
    this.get = __bind(this.get, this);
    this.parseData = __bind(this.parseData, this);
    this.cb = callback;
    this.parseData(data);
    null;
  }

  Templates.prototype.parseData = function(data) {
    var item, temp, _i, _len, _ref;
    temp = [];
    _ref = data.template;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      item = _ref[_i];
      temp.push(new TemplateModel({
        id: item.$.id,
        text: item._
      }));
    }
    this.templates = new TemplatesCollection(temp);
    if (typeof this.cb === "function") {
      this.cb();
    }
    return null;
  };

  Templates.prototype.get = function(id) {
    var t;
    t = this.templates.where({
      id: id
    });
    t = t[0].get('text');
    return $.trim(t);
  };

  return Templates;

})();

module.exports = Templates;



},{"../collections/core/TemplatesCollection":10,"../models/core/TemplateModel":19}],16:[function(require,module,exports){
var AbstractModel,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractModel = (function(_super) {
  __extends(AbstractModel, _super);

  function AbstractModel(attrs, option) {
    this.CD_CE = __bind(this.CD_CE, this);
    this._filterAttrs = __bind(this._filterAttrs, this);
    attrs = this._filterAttrs(attrs);
    return Backbone.DeepModel.apply(this, arguments);
  }

  AbstractModel.prototype.set = function(attrs, options) {
    options || (options = {});
    attrs = this._filterAttrs(attrs);
    options.data = JSON.stringify(attrs);
    return Backbone.DeepModel.prototype.set.call(this, attrs, options);
  };

  AbstractModel.prototype._filterAttrs = function(attrs) {
    return attrs;
  };

  AbstractModel.prototype.CD_CE = function() {
    return window.CD_CE;
  };

  return AbstractModel;

})(Backbone.DeepModel);

module.exports = AbstractModel;



},{}],17:[function(require,module,exports){
var APIRouteModel,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

APIRouteModel = (function(_super) {
  __extends(APIRouteModel, _super);

  function APIRouteModel() {
    return APIRouteModel.__super__.constructor.apply(this, arguments);
  }

  APIRouteModel.prototype.defaults = {
    doodles: "{{ API_HOST }}/api/doodles"
  };

  return APIRouteModel;

})(Backbone.DeepModel);

module.exports = APIRouteModel;



},{}],18:[function(require,module,exports){
var LocalesModel,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

LocalesModel = (function(_super) {
  __extends(LocalesModel, _super);

  function LocalesModel() {
    this.getString = __bind(this.getString, this);
    this.get_language = __bind(this.get_language, this);
    return LocalesModel.__super__.constructor.apply(this, arguments);
  }

  LocalesModel.prototype.defaults = {
    code: null,
    language: null,
    strings: null
  };

  LocalesModel.prototype.get_language = function() {
    return this.get('language');
  };

  LocalesModel.prototype.getString = function(id) {
    var a, e, k, v, _ref, _ref1;
    _ref = this.get('strings');
    for (k in _ref) {
      v = _ref[k];
      _ref1 = v['strings'];
      for (a in _ref1) {
        e = _ref1[a];
        if (a === id) {
          return e;
        }
      }
    }
    console.warn("Locales -> not found string: " + id);
    return null;
  };

  return LocalesModel;

})(Backbone.Model);

module.exports = LocalesModel;



},{}],19:[function(require,module,exports){
var TemplateModel,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

TemplateModel = (function(_super) {
  __extends(TemplateModel, _super);

  function TemplateModel() {
    return TemplateModel.__super__.constructor.apply(this, arguments);
  }

  TemplateModel.prototype.defaults = {
    id: "",
    text: ""
  };

  return TemplateModel;

})(Backbone.Model);

module.exports = TemplateModel;



},{}],20:[function(require,module,exports){
var AbstractModel, CodeWordTransitioner, DoodleModel, Hashids, NumberUtils,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractModel = require('../AbstractModel');

NumberUtils = require('../../utils/NumberUtils');

CodeWordTransitioner = require('../../utils/CodeWordTransitioner');

Hashids = require('hashids');

DoodleModel = (function(_super) {
  __extends(DoodleModel, _super);

  function DoodleModel() {
    this.setShortlink = __bind(this.setShortlink, this);
    this.getAuthorHtml = __bind(this.getAuthorHtml, this);
    this.getIndexHTML = __bind(this.getIndexHTML, this);
    this._filterAttrs = __bind(this._filterAttrs, this);
    return DoodleModel.__super__.constructor.apply(this, arguments);
  }

  DoodleModel.prototype.defaults = {
    "name": "",
    "author": {
      "name": "",
      "github": "",
      "website": "",
      "twitter": ""
    },
    "description": "",
    "tags": [],
    "interaction": {
      "mouse": null,
      "keyboard": null,
      "touch": null
    },
    "created": "",
    "slug": "",
    "shortlink": "",
    "colour_scheme": "",
    "index": null,
    "index_padded": "",
    "indexHTML": "",
    "source": "",
    "url": "",
    "scrambled": {
      "name": "",
      "author_name": ""
    },
    "viewed": false,
    "SAMPLE_DIR": ""
  };

  DoodleModel.prototype.SAMPLE_DOODLES = ['shape-stream', 'shape-stream-light', 'box-physics', 'stars', 'tubes'];

  DoodleModel.prototype._filterAttrs = function(attrs) {
    var sample;
    if (attrs.slug) {
      attrs.url = window.config.SITE_URL + '/' + window.config.routes.DOODLES + '/' + attrs.slug;
    }
    if (attrs.index) {
      attrs.index_padded = NumberUtils.zeroFill(attrs.index, 3);
      attrs.indexHTML = this.getIndexHTML(attrs.index_padded);
    }
    if (attrs.name && attrs.author.name) {
      attrs.scrambled = {
        name: CodeWordTransitioner.getScrambledWord(attrs.name),
        author_name: CodeWordTransitioner.getScrambledWord(attrs.author.name)
      };
    }

    /*
    GET_DUMMY_DOODLE_SCHTUFF
     */
    sample = _.shuffle(this.SAMPLE_DOODLES)[0];
    attrs.SAMPLE_DIR = sample;
    attrs.colour_scheme = sample === 'shape-stream-light' ? 'light' : 'dark';
    return attrs;
  };

  DoodleModel.prototype.getIndexHTML = function(index) {
    var char, className, html, _i, _len, _ref;
    html = "";
    _ref = index.split('');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      char = _ref[_i];
      className = char === '0' ? 'index-char-zero' : 'index-char-nonzero';
      html += "<span class=\"" + className + "\">" + char + "</span>";
    }
    return html;
  };

  DoodleModel.prototype.getAuthorHtml = function() {
    var attrs, html, links, portfolio_label;
    portfolio_label = this.CD_CE().locale.get("misc_portfolio_label");
    attrs = this.get('author');
    html = "";
    links = [];
    html += "" + attrs.name + " \\ ";
    if (attrs.website) {
      links.push("<a href=\"" + attrs.website + "\" target=\"_blank\">" + portfolio_label + "</a> ");
    }
    if (attrs.twitter) {
      links.push("<a href=\"http://twitter.com/" + attrs.twitter + "\" target=\"_blank\">tw</a>");
    }
    if (attrs.github) {
      links.push("<a href=\"http://github.com/" + attrs.github + "\" target=\"_blank\">gh</a>");
    }
    html += "" + (links.join(' \\ '));
    return html;
  };

  DoodleModel.prototype.setShortlink = function() {
    var h, shortlink;
    if (this.get('shortlink')) {
      return;
    }
    h = new Hashids(window.config.shortlinks.SALT, 0, window.config.shortlinks.ALPHABET);
    shortlink = h.encode(this.get('index'));
    this.set('shortlink', shortlink);
    return null;
  };

  return DoodleModel;

})(AbstractModel);

module.exports = DoodleModel;



},{"../../utils/CodeWordTransitioner":25,"../../utils/NumberUtils":29,"../AbstractModel":16,"hashids":5}],21:[function(require,module,exports){
var AbstractView, Nav, Router,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('../view/AbstractView');

Router = require('./Router');

Nav = (function(_super) {
  __extends(Nav, _super);

  Nav.EVENT_CHANGE_VIEW = 'EVENT_CHANGE_VIEW';

  Nav.EVENT_CHANGE_SUB_VIEW = 'EVENT_CHANGE_SUB_VIEW';

  Nav.prototype.sections = {
    HOME: 'index.html'
  };

  Nav.prototype.current = {
    area: null,
    sub: null
  };

  Nav.prototype.previous = {
    area: null,
    sub: null
  };

  function Nav() {
    this.changeView = __bind(this.changeView, this);
    this.getSection = __bind(this.getSection, this);
    this.CD_CE().router.on(Router.EVENT_HASH_CHANGED, this.changeView);
    return false;
  }

  Nav.prototype.getSection = function(section) {
    var sectionName, uri, _ref;
    if (section === '') {
      return true;
    }
    _ref = this.sections;
    for (sectionName in _ref) {
      uri = _ref[sectionName];
      if (uri === section) {
        return sectionName;
      }
    }
    return false;
  };

  Nav.prototype.changeView = function(area, sub, params) {
    this.previous = this.current;
    this.current = {
      area: area,
      sub: sub
    };
    if (this.previous.area && this.previous.area === this.current.area) {
      this.trigger(Nav.EVENT_CHANGE_SUB_VIEW, this.current);
    } else {
      this.trigger(Nav.EVENT_CHANGE_VIEW, this.previous, this.current);
      this.trigger(Nav.EVENT_CHANGE_SUB_VIEW, this.current);
    }
    if (this.CD_CE().appView.modalManager.isOpen()) {
      this.CD_CE().appView.modalManager.hideOpenModal();
    }
    return null;
  };

  return Nav;

})(AbstractView);

module.exports = Nav;



},{"../view/AbstractView":32,"./Router":22}],22:[function(require,module,exports){
var Router,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

Router = (function(_super) {
  __extends(Router, _super);

  function Router() {
    this.CD_CE = __bind(this.CD_CE, this);
    this.navigateTo = __bind(this.navigateTo, this);
    this.hashChanged = __bind(this.hashChanged, this);
    this.start = __bind(this.start, this);
    return Router.__super__.constructor.apply(this, arguments);
  }

  Router.EVENT_HASH_CHANGED = 'EVENT_HASH_CHANGED';

  Router.prototype.FIRST_ROUTE = true;

  Router.prototype.routes = {
    '(/)(:area)(/:sub)(/)': 'hashChanged',
    '*actions': 'navigateTo'
  };

  Router.prototype.area = null;

  Router.prototype.sub = null;

  Router.prototype.params = null;

  Router.prototype.start = function() {
    Backbone.history.start({
      pushState: true,
      root: '/'
    });
    return null;
  };

  Router.prototype.hashChanged = function(area, sub) {
    this.area = area != null ? area : null;
    this.sub = sub != null ? sub : null;
    console.log(">> EVENT_HASH_CHANGED @area = " + this.area + ", @sub = " + this.sub + " <<");
    if (this.FIRST_ROUTE) {
      this.FIRST_ROUTE = false;
    }
    if (!this.area) {
      this.area = this.CD_CE().nav.sections.HOME;
    }
    this.trigger(Router.EVENT_HASH_CHANGED, this.area, this.sub, this.params);
    return null;
  };

  Router.prototype.navigateTo = function(where, trigger, replace, params) {
    if (where == null) {
      where = '';
    }
    if (trigger == null) {
      trigger = true;
    }
    if (replace == null) {
      replace = false;
    }
    this.params = params;
    if (where.charAt(0) !== "/") {
      where = "/" + where;
    }
    if (where.charAt(where.length - 1) !== "/") {
      where = "" + where + "/";
    }
    if (!trigger) {
      this.trigger(Router.EVENT_HASH_CHANGED, where, null, this.params);
      return;
    }
    this.navigate(where, {
      trigger: true,
      replace: replace
    });
    return null;
  };

  Router.prototype.CD_CE = function() {
    return window.CD_CE;
  };

  return Router;

})(Backbone.Router);

module.exports = Router;



},{}],23:[function(require,module,exports){

/*
Analytics wrapper
 */
var Analytics,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Analytics = (function() {
  Analytics.prototype.tags = null;

  Analytics.prototype.started = false;

  Analytics.prototype.attempts = 0;

  Analytics.prototype.allowedAttempts = 5;

  function Analytics(data, callback) {
    this.callback = callback;
    this.track = __bind(this.track, this);
    this.parseData = __bind(this.parseData, this);
    this.parseData(data);
    return null;
  }

  Analytics.prototype.parseData = function(data) {
    this.tags = data;
    this.started = true;
    if (typeof this.callback === "function") {
      this.callback();
    }
    return null;
  };


  /*
  @param string id of the tracking tag to be pushed on Analytics
   */

  Analytics.prototype.track = function(param) {
    var arg, args, v, _i, _len;
    if (!this.started) {
      return;
    }
    if (param) {
      v = this.tags[param];
      if (v) {
        args = ['send', 'event'];
        for (_i = 0, _len = v.length; _i < _len; _i++) {
          arg = v[_i];
          args.push(arg);
        }
        if (window.ga) {
          ga.apply(null, args);
        } else if (this.attempts >= this.allowedAttempts) {
          this.started = false;
        } else {
          setTimeout((function(_this) {
            return function() {
              _this.track(param);
              return _this.attempts++;
            };
          })(this), 2000);
        }
      }
    }
    return null;
  };

  return Analytics;

})();

module.exports = Analytics;



},{}],24:[function(require,module,exports){
var AbstractData, AuthManager, Facebook, GooglePlus,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractData = require('../data/AbstractData');

Facebook = require('../utils/Facebook');

GooglePlus = require('../utils/GooglePlus');

AuthManager = (function(_super) {
  __extends(AuthManager, _super);

  AuthManager.prototype.userData = null;

  AuthManager.prototype.process = false;

  AuthManager.prototype.processTimer = null;

  AuthManager.prototype.processWait = 5000;

  function AuthManager() {
    this.hideLoader = __bind(this.hideLoader, this);
    this.showLoader = __bind(this.showLoader, this);
    this.authCallback = __bind(this.authCallback, this);
    this.authFail = __bind(this.authFail, this);
    this.authSuccess = __bind(this.authSuccess, this);
    this.login = __bind(this.login, this);
    this.userData = this.CD_CE().appData.USER;
    AuthManager.__super__.constructor.call(this);
    return null;
  }

  AuthManager.prototype.login = function(service, cb) {
    var $dataDfd;
    if (cb == null) {
      cb = null;
    }
    if (this.process) {
      return;
    }
    this.showLoader();
    this.process = true;
    $dataDfd = $.Deferred();
    switch (service) {
      case 'google':
        GooglePlus.login($dataDfd);
        break;
      case 'facebook':
        Facebook.login($dataDfd);
    }
    $dataDfd.done((function(_this) {
      return function(res) {
        return _this.authSuccess(service, res);
      };
    })(this));
    $dataDfd.fail((function(_this) {
      return function(res) {
        return _this.authFail(service, res);
      };
    })(this));
    $dataDfd.always((function(_this) {
      return function() {
        return _this.authCallback(cb);
      };
    })(this));

    /*
    		Unfortunately no callback is fired if user manually closes G+ login modal,
    		so this is to allow them to close window and then subsequently try to log in again...
     */
    this.processTimer = setTimeout(this.authCallback, this.processWait);
    return $dataDfd;
  };

  AuthManager.prototype.authSuccess = function(service, data) {
    return null;
  };

  AuthManager.prototype.authFail = function(service, data) {
    return null;
  };

  AuthManager.prototype.authCallback = function(cb) {
    if (cb == null) {
      cb = null;
    }
    if (!this.process) {
      return;
    }
    clearTimeout(this.processTimer);
    this.hideLoader();
    this.process = false;
    if (typeof cb === "function") {
      cb();
    }
    return null;
  };


  /*
  	show / hide some UI indicator that we are waiting for social network to respond
   */

  AuthManager.prototype.showLoader = function() {
    return null;
  };

  AuthManager.prototype.hideLoader = function() {
    return null;
  };

  return AuthManager;

})(AbstractData);

module.exports = AuthManager;



},{"../data/AbstractData":13,"../utils/Facebook":26,"../utils/GooglePlus":27}],25:[function(require,module,exports){
var CodeWordTransitioner, encode;

encode = require('ent/encode');

CodeWordTransitioner = (function() {
  function CodeWordTransitioner() {}

  CodeWordTransitioner.config = {
    MIN_WRONG_CHARS: 1,
    MAX_WRONG_CHARS: 7,
    MIN_CHAR_IN_DELAY: 40,
    MAX_CHAR_IN_DELAY: 70,
    MIN_CHAR_OUT_DELAY: 40,
    MAX_CHAR_OUT_DELAY: 70,
    CHARS: 'abcdefhijklmnopqrstuvwxyz0123456789!?*()@£$%^&_-+=[]{}:;\'"\\|<>,./~`'.split('').map(encode),
    CHAR_TEMPLATE: "<span data-codetext-char=\"{{ char }}\" data-codetext-char-state=\"{{ state }}\">{{ char }}</span>"
  };

  CodeWordTransitioner._wordCache = {};

  CodeWordTransitioner._getWordFromCache = function($el, initialState) {
    var id, word;
    if (initialState == null) {
      initialState = null;
    }
    id = $el.attr('data-codeword-id');
    if (id && CodeWordTransitioner._wordCache[id]) {
      word = CodeWordTransitioner._wordCache[id];
    } else {
      CodeWordTransitioner._wrapChars($el, initialState);
      word = CodeWordTransitioner._addWordToCache($el);
    }
    return word;
  };

  CodeWordTransitioner._addWordToCache = function($el) {
    var chars, id;
    chars = [];
    $el.find('[data-codetext-char]').each(function(i, el) {
      var $charEl;
      $charEl = $(el);
      return chars.push({
        $el: $charEl,
        rightChar: $charEl.attr('data-codetext-char')
      });
    });
    id = _.uniqueId();
    $el.attr('data-codeword-id', id);
    CodeWordTransitioner._wordCache[id] = {
      word: _.pluck(chars, 'rightChar').join(''),
      $el: $el,
      chars: chars,
      visible: true
    };
    return CodeWordTransitioner._wordCache[id];
  };

  CodeWordTransitioner._wrapChars = function($el, initialState) {
    var char, chars, html, state, _i, _len;
    if (initialState == null) {
      initialState = null;
    }
    chars = $el.text().split('');
    state = initialState || $el.attr('data-codeword-initial-state') || "";
    html = [];
    for (_i = 0, _len = chars.length; _i < _len; _i++) {
      char = chars[_i];
      if (char === ' ') {
        char = '&nbsp;';
      }
      html.push(CodeWordTransitioner._supplantString(CodeWordTransitioner.config.CHAR_TEMPLATE, {
        char: char,
        state: state
      }));
    }
    $el.html(html.join(''));
    return null;
  };

  CodeWordTransitioner._prepareWord = function(word, target, charState) {
    var char, i, targetChar, _i, _len, _ref;
    if (charState == null) {
      charState = '';
    }
    _ref = word.chars;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      char = _ref[i];
      targetChar = (function() {
        switch (true) {
          case target === 'right':
            return char.rightChar;
          case target === 'wrong':
            return this._getRandomChar();
          case target === 'empty':
            return '';
          default:
            return target.charAt(i) || '';
        }
      }).call(CodeWordTransitioner);
      if (targetChar === ' ') {
        targetChar = '&nbsp;';
      }
      char.wrongChars = CodeWordTransitioner._getRandomWrongChars();
      char.targetChar = targetChar;
      char.charState = charState;
    }
    return null;
  };

  CodeWordTransitioner._getRandomWrongChars = function() {
    var charCount, chars, i, _i;
    chars = [];
    charCount = _.random(CodeWordTransitioner.config.MIN_WRONG_CHARS, CodeWordTransitioner.config.MAX_WRONG_CHARS);
    for (i = _i = 0; 0 <= charCount ? _i < charCount : _i > charCount; i = 0 <= charCount ? ++_i : --_i) {
      chars.push({
        char: CodeWordTransitioner._getRandomChar(),
        inDelay: _.random(CodeWordTransitioner.config.MIN_CHAR_IN_DELAY, CodeWordTransitioner.config.MAX_CHAR_IN_DELAY),
        outDelay: _.random(CodeWordTransitioner.config.MIN_CHAR_OUT_DELAY, CodeWordTransitioner.config.MAX_CHAR_OUT_DELAY)
      });
    }
    return chars;
  };

  CodeWordTransitioner._getRandomChar = function() {
    var char;
    char = CodeWordTransitioner.config.CHARS[_.random(0, CodeWordTransitioner.config.CHARS.length - 1)];
    return char;
  };

  CodeWordTransitioner._getLongestCharDuration = function(chars) {
    var char, i, longestTime, longestTimeIdx, time, wrongChar, _i, _j, _len, _len1, _ref;
    longestTime = 0;
    longestTimeIdx = 0;
    for (i = _i = 0, _len = chars.length; _i < _len; i = ++_i) {
      char = chars[i];
      time = 0;
      _ref = char.wrongChars;
      for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
        wrongChar = _ref[_j];
        time += wrongChar.inDelay + wrongChar.outDelay;
      }
      if (time > longestTime) {
        longestTime = time;
        longestTimeIdx = i;
      }
    }
    return longestTimeIdx;
  };

  CodeWordTransitioner._animateChars = function(word, sequential, cb) {
    var activeChar, args, char, i, longestCharIdx, _i, _len, _ref;
    activeChar = 0;
    if (sequential) {
      CodeWordTransitioner._animateChar(word.chars, activeChar, true, cb);
    } else {
      longestCharIdx = CodeWordTransitioner._getLongestCharDuration(word.chars);
      _ref = word.chars;
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        char = _ref[i];
        args = [word.chars, i, false];
        if (i === longestCharIdx) {
          args.push(cb);
        }
        CodeWordTransitioner._animateChar.apply(CodeWordTransitioner, args);
      }
    }
    return null;
  };

  CodeWordTransitioner._animateChar = function(chars, idx, recurse, cb) {
    var char;
    char = chars[idx];
    if (recurse) {
      CodeWordTransitioner._animateWrongChars(char, function() {
        if (idx === chars.length - 1) {
          return CodeWordTransitioner._animateCharsDone(cb);
        } else {
          return CodeWordTransitioner._animateChar(chars, idx + 1, recurse, cb);
        }
      });
    } else {
      if (typeof cb === 'function') {
        CodeWordTransitioner._animateWrongChars(char, function() {
          return CodeWordTransitioner._animateCharsDone(cb);
        });
      } else {
        CodeWordTransitioner._animateWrongChars(char);
      }
    }
    return null;
  };

  CodeWordTransitioner._animateWrongChars = function(char, cb) {
    var wrongChar;
    if (char.wrongChars.length) {
      wrongChar = char.wrongChars.shift();
      setTimeout(function() {
        char.$el.html(wrongChar.char);
        return setTimeout(function() {
          return CodeWordTransitioner._animateWrongChars(char, cb);
        }, wrongChar.outDelay);
      }, wrongChar.inDelay);
    } else {
      char.$el.attr('data-codetext-char-state', char.charState).html(char.targetChar);
      if (typeof cb === "function") {
        cb();
      }
    }
    return null;
  };

  CodeWordTransitioner._animateCharsDone = function(cb) {
    if (typeof cb === "function") {
      cb();
    }
    return null;
  };

  CodeWordTransitioner._supplantString = function(str, vals) {
    return str.replace(/{{ ([^{}]*) }}/g, function(a, b) {
      var r;
      r = vals[b];
      if (typeof r === "string" || typeof r === "number") {
        return r;
      } else {
        return a;
      }
    });
  };

  CodeWordTransitioner.to = function(targetText, $el, charState, sequential, cb) {
    var word, _$el, _i, _len;
    if (sequential == null) {
      sequential = false;
    }
    if (cb == null) {
      cb = null;
    }
    if (_.isArray($el)) {
      for (_i = 0, _len = $el.length; _i < _len; _i++) {
        _$el = $el[_i];
        CodeWordTransitioner.to(targetText, _$el, charState, cb);
      }
      return;
    }
    word = CodeWordTransitioner._getWordFromCache($el);
    word.visible = true;
    CodeWordTransitioner._prepareWord(word, targetText, charState);
    CodeWordTransitioner._animateChars(word, sequential, cb);
    return null;
  };

  CodeWordTransitioner["in"] = function($el, charState, sequential, cb) {
    var word, _$el, _i, _len;
    if (sequential == null) {
      sequential = false;
    }
    if (cb == null) {
      cb = null;
    }
    if (_.isArray($el)) {
      for (_i = 0, _len = $el.length; _i < _len; _i++) {
        _$el = $el[_i];
        CodeWordTransitioner["in"](_$el, charState, cb);
      }
      return;
    }
    word = CodeWordTransitioner._getWordFromCache($el);
    word.visible = true;
    CodeWordTransitioner._prepareWord(word, 'right', charState);
    CodeWordTransitioner._animateChars(word, sequential, cb);
    return null;
  };

  CodeWordTransitioner.out = function($el, charState, sequential, cb) {
    var word, _$el, _i, _len;
    if (sequential == null) {
      sequential = false;
    }
    if (cb == null) {
      cb = null;
    }
    if (_.isArray($el)) {
      for (_i = 0, _len = $el.length; _i < _len; _i++) {
        _$el = $el[_i];
        CodeWordTransitioner.out(_$el, charState, cb);
      }
      return;
    }
    word = CodeWordTransitioner._getWordFromCache($el);
    if (!word.visible) {
      return;
    }
    word.visible = false;
    CodeWordTransitioner._prepareWord(word, 'empty', charState);
    CodeWordTransitioner._animateChars(word, sequential, cb);
    return null;
  };

  CodeWordTransitioner.scramble = function($el, charState, sequential, cb) {
    var word, _$el, _i, _len;
    if (sequential == null) {
      sequential = false;
    }
    if (cb == null) {
      cb = null;
    }
    if (_.isArray($el)) {
      for (_i = 0, _len = $el.length; _i < _len; _i++) {
        _$el = $el[_i];
        CodeWordTransitioner.scramble(_$el, charState, cb);
      }
      return;
    }
    word = CodeWordTransitioner._getWordFromCache($el);
    if (!word.visible) {
      return;
    }
    CodeWordTransitioner._prepareWord(word, 'wrong', charState);
    CodeWordTransitioner._animateChars(word, sequential, cb);
    return null;
  };

  CodeWordTransitioner.unscramble = function($el, charState, sequential, cb) {
    var word, _$el, _i, _len;
    if (sequential == null) {
      sequential = false;
    }
    if (cb == null) {
      cb = null;
    }
    if (_.isArray($el)) {
      for (_i = 0, _len = $el.length; _i < _len; _i++) {
        _$el = $el[_i];
        CodeWordTransitioner.unscramble(_$el, charState, cb);
      }
      return;
    }
    word = CodeWordTransitioner._getWordFromCache($el);
    if (!word.visible) {
      return;
    }
    CodeWordTransitioner._prepareWord(word, 'right', charState);
    CodeWordTransitioner._animateChars(word, sequential, cb);
    return null;
  };

  CodeWordTransitioner.prepare = function($el, initialState) {
    var _$el, _i, _len;
    if (_.isArray($el)) {
      for (_i = 0, _len = $el.length; _i < _len; _i++) {
        _$el = $el[_i];
        CodeWordTransitioner.prepare(_$el, initialState);
      }
      return;
    }
    CodeWordTransitioner._getWordFromCache($el, initialState);
    return null;
  };

  CodeWordTransitioner.getScrambledWord = function(word) {
    var char, newChars, _i, _len, _ref;
    newChars = [];
    _ref = word.split('');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      char = _ref[_i];
      newChars.push(CodeWordTransitioner._getRandomChar());
    }
    return newChars.join('');
  };

  return CodeWordTransitioner;

})();

module.exports = CodeWordTransitioner;



},{"ent/encode":3}],26:[function(require,module,exports){
var AbstractData, Facebook,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractData = require('../data/AbstractData');


/*

Facebook SDK wrapper - load asynchronously, some helper methods
 */

Facebook = (function(_super) {
  __extends(Facebook, _super);

  function Facebook() {
    return Facebook.__super__.constructor.apply(this, arguments);
  }

  Facebook.url = '//connect.facebook.net/en_US/all.js';

  Facebook.permissions = 'email';

  Facebook.$dataDfd = null;

  Facebook.loaded = false;

  Facebook.load = function() {

    /*
    		TO DO
    		include script loader with callback to :init
     */
    return null;
  };

  Facebook.init = function() {
    Facebook.loaded = true;
    FB.init({
      appId: window.config.fb_app_id,
      status: false,
      xfbml: false
    });
    return null;
  };

  Facebook.login = function($dataDfd) {
    Facebook.$dataDfd = $dataDfd;
    if (!Facebook.loaded) {
      return Facebook.$dataDfd.reject('SDK not loaded');
    }
    FB.login(function(res) {
      if (res['status'] === 'connected') {
        return Facebook.getUserData(res['authResponse']['accessToken']);
      } else {
        return Facebook.$dataDfd.reject('no way jose');
      }
    }, {
      scope: Facebook.permissions
    });
    return null;
  };

  Facebook.getUserData = function(token) {
    var $meDfd, $picDfd, userData;
    userData = {};
    userData.access_token = token;
    $meDfd = $.Deferred();
    $picDfd = $.Deferred();
    FB.api('/me', function(res) {
      userData.full_name = res.name;
      userData.social_id = res.id;
      userData.email = res.email || false;
      return $meDfd.resolve();
    });
    FB.api('/me/picture', {
      'width': '200'
    }, function(res) {
      userData.profile_pic = res.data.url;
      return $picDfd.resolve();
    });
    $.when($meDfd, $picDfd).done(function() {
      return Facebook.$dataDfd.resolve(userData);
    });
    return null;
  };

  Facebook.share = function(opts, cb) {
    FB.ui({
      method: opts.method || 'feed',
      name: opts.name || '',
      link: opts.link || '',
      picture: opts.picture || '',
      caption: opts.caption || '',
      description: opts.description || ''
    }, function(response) {
      return typeof cb === "function" ? cb(response) : void 0;
    });
    return null;
  };

  return Facebook;

})(AbstractData);

module.exports = Facebook;



},{"../data/AbstractData":13}],27:[function(require,module,exports){
var AbstractData, GooglePlus,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractData = require('../data/AbstractData');


/*

Google+ SDK wrapper - load asynchronously, some helper methods
 */

GooglePlus = (function(_super) {
  __extends(GooglePlus, _super);

  function GooglePlus() {
    return GooglePlus.__super__.constructor.apply(this, arguments);
  }

  GooglePlus.url = 'https://apis.google.com/js/client:plusone.js';

  GooglePlus.params = {
    'clientid': null,
    'callback': null,
    'scope': 'https://www.googleapis.com/auth/userinfo.email',
    'cookiepolicy': 'none'
  };

  GooglePlus.$dataDfd = null;

  GooglePlus.loaded = false;

  GooglePlus.load = function() {

    /*
    		TO DO
    		include script loader with callback to :init
     */
    return null;
  };

  GooglePlus.init = function() {
    GooglePlus.loaded = true;
    GooglePlus.params['clientid'] = window.config.gp_app_id;
    GooglePlus.params['callback'] = GooglePlus.loginCallback;
    return null;
  };

  GooglePlus.login = function($dataDfd) {
    GooglePlus.$dataDfd = $dataDfd;
    if (GooglePlus.loaded) {
      gapi.auth.signIn(GooglePlus.params);
    } else {
      GooglePlus.$dataDfd.reject('SDK not loaded');
    }
    return null;
  };

  GooglePlus.loginCallback = function(res) {
    if (res['status']['signed_in']) {
      GooglePlus.getUserData(res['access_token']);
    } else if (res['error']['access_denied']) {
      GooglePlus.$dataDfd.reject('no way jose');
    }
    return null;
  };

  GooglePlus.getUserData = function(token) {
    gapi.client.load('plus', 'v1', function() {
      var request;
      request = gapi.client.plus.people.get({
        'userId': 'me'
      });
      return request.execute(function(res) {
        var userData;
        userData = {
          access_token: token,
          full_name: res.displayName,
          social_id: res.id,
          email: res.emails[0] ? res.emails[0].value : false,
          profile_pic: res.image.url
        };
        return GooglePlus.$dataDfd.resolve(userData);
      });
    });
    return null;
  };

  return GooglePlus;

})(AbstractData);

module.exports = GooglePlus;



},{"../data/AbstractData":13}],28:[function(require,module,exports){
var MediaQueries;

MediaQueries = (function() {
  function MediaQueries() {}

  MediaQueries.SMALL = "small";

  MediaQueries.IPAD = "ipad";

  MediaQueries.MEDIUM = "medium";

  MediaQueries.LARGE = "large";

  MediaQueries.EXTRA_LARGE = "extra-large";

  MediaQueries.setup = function() {
    MediaQueries.SMALL_BREAKPOINT = {
      name: "Small",
      breakpoints: [MediaQueries.SMALL]
    };
    MediaQueries.MEDIUM_BREAKPOINT = {
      name: "Medium",
      breakpoints: [MediaQueries.MEDIUM]
    };
    MediaQueries.LARGE_BREAKPOINT = {
      name: "Large",
      breakpoints: [MediaQueries.IPAD, MediaQueries.LARGE, MediaQueries.EXTRA_LARGE]
    };
    MediaQueries.BREAKPOINTS = [MediaQueries.SMALL_BREAKPOINT, MediaQueries.MEDIUM_BREAKPOINT, MediaQueries.LARGE_BREAKPOINT];
  };

  MediaQueries.getDeviceState = function() {
    return window.getComputedStyle(document.body, "after").getPropertyValue("content");
  };

  MediaQueries.getBreakpoint = function() {
    var i, state, _i, _ref;
    state = MediaQueries.getDeviceState();
    for (i = _i = 0, _ref = MediaQueries.BREAKPOINTS.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
      if (MediaQueries.BREAKPOINTS[i].breakpoints.indexOf(state) > -1) {
        return MediaQueries.BREAKPOINTS[i].name;
      }
    }
    return "";
  };

  MediaQueries.isBreakpoint = function(breakpoint) {
    var i, _i, _ref;
    for (i = _i = 0, _ref = breakpoint.breakpoints.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
      if (breakpoint.breakpoints[i] === MediaQueries.getDeviceState()) {
        return true;
      }
    }
    return false;
  };

  return MediaQueries;

})();

module.exports = MediaQueries;



},{}],29:[function(require,module,exports){
var NumberUtils;

NumberUtils = (function() {
  function NumberUtils() {}

  NumberUtils.MATH_COS = Math.cos;

  NumberUtils.MATH_SIN = Math.sin;

  NumberUtils.MATH_RANDOM = Math.random;

  NumberUtils.MATH_ABS = Math.abs;

  NumberUtils.MATH_ATAN2 = Math.atan2;

  NumberUtils.limit = function(number, min, max) {
    return Math.min(Math.max(min, number), max);
  };

  NumberUtils.getRandomColor = function() {
    var color, i, letters, _i;
    letters = '0123456789ABCDEF'.split('');
    color = '#';
    for (i = _i = 0; _i < 6; i = ++_i) {
      color += letters[Math.round(Math.random() * 15)];
    }
    return color;
  };

  NumberUtils.getTimeStampDiff = function(date1, date2) {
    var date1_ms, date2_ms, difference_ms, one_day, time;
    one_day = 1000 * 60 * 60 * 24;
    time = {};
    date1_ms = date1.getTime();
    date2_ms = date2.getTime();
    difference_ms = date2_ms - date1_ms;
    difference_ms = difference_ms / 1000;
    time.seconds = Math.floor(difference_ms % 60);
    difference_ms = difference_ms / 60;
    time.minutes = Math.floor(difference_ms % 60);
    difference_ms = difference_ms / 60;
    time.hours = Math.floor(difference_ms % 24);
    time.days = Math.floor(difference_ms / 24);
    return time;
  };

  NumberUtils.map = function(num, min1, max1, min2, max2, round, constrainMin, constrainMax) {
    var num1, num2;
    if (round == null) {
      round = false;
    }
    if (constrainMin == null) {
      constrainMin = true;
    }
    if (constrainMax == null) {
      constrainMax = true;
    }
    if (constrainMin && num < min1) {
      return min2;
    }
    if (constrainMax && num > max1) {
      return max2;
    }
    num1 = (num - min1) / (max1 - min1);
    num2 = (num1 * (max2 - min2)) + min2;
    if (round) {
      return Math.round(num2);
    }
    return num2;
  };

  NumberUtils.toRadians = function(degree) {
    return degree * (Math.PI / 180);
  };

  NumberUtils.toDegree = function(radians) {
    return radians * (180 / Math.PI);
  };

  NumberUtils.isInRange = function(num, min, max, canBeEqual) {
    if (canBeEqual) {
      return num >= min && num <= max;
    } else {
      return num >= min && num <= max;
    }
  };

  NumberUtils.getNiceDistance = function(metres) {
    var km;
    if (metres < 1000) {
      return "" + (Math.round(metres)) + "M";
    } else {
      km = (metres / 1000).toFixed(2);
      return "" + km + "KM";
    }
  };

  NumberUtils.zeroFill = function(number, width) {
    var _ref;
    width -= number.toString().length;
    if (width > 0) {
      return new Array(width + ((_ref = /\./.test(number)) != null ? _ref : {
        2: 1
      })).join('0') + number;
    }
    return number + "";
  };

  return NumberUtils;

})();

module.exports = NumberUtils;



},{}],30:[function(require,module,exports){

/*
 * Requester #

Wrapper for `$.ajax` calls
 */
var Requester;

Requester = (function() {
  function Requester() {}

  Requester.requests = [];

  Requester.request = function(data) {

    /*
    `data = {`<br>
    `  url         : String`<br>
    `  type        : "POST/GET/PUT"`<br>
    `  data        : Object`<br>
    `  dataType    : jQuery dataType`<br>
    `  contentType : String`<br>
    `}`
     */
    var r;
    r = $.ajax({
      url: data.url,
      type: data.type ? data.type : "POST",
      data: data.data ? data.data : null,
      dataType: data.dataType ? data.dataType : "json",
      contentType: data.contentType ? data.contentType : "application/x-www-form-urlencoded; charset=UTF-8",
      processData: data.processData !== null && data.processData !== void 0 ? data.processData : true
    });
    r.done(data.done);
    r.fail(data.fail);
    return r;
  };

  Requester.addImage = function(data, done, fail) {

    /*
    ** Usage: <br>
    `data = canvass.toDataURL("image/jpeg").slice("data:image/jpeg;base64,".length)`<br>
    `Requester.addImage data, "zoetrope", @done, @fail`
     */
    Requester.request({
      url: '/api/images/',
      type: 'POST',
      data: {
        image_base64: encodeURI(data)
      },
      done: done,
      fail: fail
    });
    return null;
  };

  Requester.deleteImage = function(id, done, fail) {
    Requester.request({
      url: '/api/images/' + id,
      type: 'DELETE',
      done: done,
      fail: fail
    });
    return null;
  };

  return Requester;

})();

module.exports = Requester;



},{}],31:[function(require,module,exports){

/*
Sharing class for non-SDK loaded social networks.
If SDK is loaded, and provides share methods, then use that class instead, eg. `Facebook.share` instead of `Share.facebook`
 */
var Share,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

Share = (function() {
  Share.prototype.url = null;

  function Share() {
    this.CD_CE = __bind(this.CD_CE, this);
    this.weibo = __bind(this.weibo, this);
    this.renren = __bind(this.renren, this);
    this.twitter = __bind(this.twitter, this);
    this.facebook = __bind(this.facebook, this);
    this.tumblr = __bind(this.tumblr, this);
    this.pinterest = __bind(this.pinterest, this);
    this.plus = __bind(this.plus, this);
    this.openWin = __bind(this.openWin, this);
    this.url = this.CD_CE().SITE_URL;
    return null;
  }

  Share.prototype.openWin = function(url, w, h) {
    var left, top;
    left = (screen.availWidth - w) >> 1;
    top = (screen.availHeight - h) >> 1;
    window.open(url, '', 'top=' + top + ',left=' + left + ',width=' + w + ',height=' + h + ',location=no,menubar=no');
    return null;
  };

  Share.prototype.plus = function(url) {
    url = encodeURIComponent(url || this.url);
    this.openWin("https://plus.google.com/share?url=" + url, 650, 385);
    return null;
  };

  Share.prototype.pinterest = function(url, media, descr) {
    url = encodeURIComponent(url || this.url);
    media = encodeURIComponent(media);
    descr = encodeURIComponent(descr);
    this.openWin("http://www.pinterest.com/pin/create/button/?url=" + url + "&media=" + media + "&description=" + descr, 735, 310);
    return null;
  };

  Share.prototype.tumblr = function(url, media, descr) {
    url = encodeURIComponent(url || this.url);
    media = encodeURIComponent(media);
    descr = encodeURIComponent(descr);
    this.openWin("http://www.tumblr.com/share/photo?source=" + media + "&caption=" + descr + "&click_thru=" + url, 450, 430);
    return null;
  };

  Share.prototype.facebook = function(url, copy) {
    var decsr;
    if (copy == null) {
      copy = '';
    }
    url = encodeURIComponent(url || this.url);
    decsr = encodeURIComponent(copy);
    this.openWin("http://www.facebook.com/share.php?u=" + url + "&t=" + decsr, 600, 300);
    return null;
  };

  Share.prototype.twitter = function(url, copy) {
    var descr;
    if (copy == null) {
      copy = '';
    }
    url = encodeURIComponent(url || this.url);
    if (copy === '') {
      copy = this.CD_CE().locale.get('seo_twitter_card_description');
    }
    descr = encodeURIComponent(copy);
    this.openWin("http://twitter.com/intent/tweet/?text=" + descr + "&url=" + url, 600, 300);
    return null;
  };

  Share.prototype.renren = function(url) {
    url = encodeURIComponent(url || this.url);
    this.openWin("http://share.renren.com/share/buttonshare.do?link=" + url, 600, 300);
    return null;
  };

  Share.prototype.weibo = function(url) {
    url = encodeURIComponent(url || this.url);
    this.openWin("http://service.weibo.com/share/share.php?url=" + url + "&language=zh_cn", 600, 300);
    return null;
  };

  Share.prototype.CD_CE = function() {
    return window.CD_CE;
  };

  return Share;

})();

module.exports = Share;



},{}],32:[function(require,module,exports){
var AbstractView,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = (function(_super) {
  __extends(AbstractView, _super);

  function AbstractView() {
    this.CD_CE = __bind(this.CD_CE, this);
    this.dispose = __bind(this.dispose, this);
    this.callChildrenAndSelf = __bind(this.callChildrenAndSelf, this);
    this.callChildren = __bind(this.callChildren, this);
    this.triggerChildren = __bind(this.triggerChildren, this);
    this.removeAllChildren = __bind(this.removeAllChildren, this);
    this.muteAll = __bind(this.muteAll, this);
    this.unMuteAll = __bind(this.unMuteAll, this);
    this.CSSTranslate = __bind(this.CSSTranslate, this);
    this.mouseEnabled = __bind(this.mouseEnabled, this);
    this.onResize = __bind(this.onResize, this);
    this.remove = __bind(this.remove, this);
    this.replace = __bind(this.replace, this);
    this.addChild = __bind(this.addChild, this);
    this.render = __bind(this.render, this);
    this.update = __bind(this.update, this);
    this.init = __bind(this.init, this);
    return AbstractView.__super__.constructor.apply(this, arguments);
  }

  AbstractView.prototype.el = null;

  AbstractView.prototype.id = null;

  AbstractView.prototype.children = null;

  AbstractView.prototype.template = null;

  AbstractView.prototype.templateVars = null;

  AbstractView.prototype.initialize = function() {
    var tmpHTML;
    this.children = [];
    if (this.template) {
      tmpHTML = _.template(this.CD_CE().templates.get(this.template));
      this.setElement(tmpHTML(this.templateVars));
    }
    if (this.id) {
      this.$el.attr('id', this.id);
    }
    if (this.className) {
      this.$el.addClass(this.className);
    }
    this.init();
    this.paused = false;
    return null;
  };

  AbstractView.prototype.init = function() {
    return null;
  };

  AbstractView.prototype.update = function() {
    return null;
  };

  AbstractView.prototype.render = function() {
    return null;
  };

  AbstractView.prototype.addChild = function(child, prepend) {
    var c, target;
    if (prepend == null) {
      prepend = false;
    }
    if (child.el) {
      this.children.push(child);
    }
    target = this.addToSelector ? this.$el.find(this.addToSelector).eq(0) : this.$el;
    c = child.el ? child.$el : child;
    if (!prepend) {
      target.append(c);
    } else {
      target.prepend(c);
    }
    return this;
  };

  AbstractView.prototype.replace = function(dom, child) {
    var c;
    if (child.el) {
      this.children.push(child);
    }
    c = child.el ? child.$el : child;
    this.$el.children(dom).replaceWith(c);
    return null;
  };

  AbstractView.prototype.remove = function(child) {
    var c;
    if (child == null) {
      return;
    }
    c = child.el ? child.$el : $(child);
    if (c && child.dispose) {
      child.dispose();
    }
    if (c && this.children.indexOf(child) !== -1) {
      this.children.splice(this.children.indexOf(child), 1);
    }
    c.remove();
    return null;
  };

  AbstractView.prototype.onResize = function(event) {
    var child, _i, _len, _ref;
    _ref = this.children;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (child.onResize) {
        child.onResize();
      }
    }
    return null;
  };

  AbstractView.prototype.mouseEnabled = function(enabled) {
    this.$el.css({
      "pointer-events": enabled ? "auto" : "none"
    });
    return null;
  };

  AbstractView.prototype.CSSTranslate = function(x, y, value, scale) {
    var str;
    if (value == null) {
      value = '%';
    }
    if (Modernizr.csstransforms3d) {
      str = "translate3d(" + (x + value) + ", " + (y + value) + ", 0)";
    } else {
      str = "translate(" + (x + value) + ", " + (y + value) + ")";
    }
    if (scale) {
      str = "" + str + " scale(" + scale + ")";
    }
    return str;
  };

  AbstractView.prototype.unMuteAll = function() {
    var child, _i, _len, _ref;
    _ref = this.children;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (typeof child.unMute === "function") {
        child.unMute();
      }
      if (child.children.length) {
        child.unMuteAll();
      }
    }
    return null;
  };

  AbstractView.prototype.muteAll = function() {
    var child, _i, _len, _ref;
    _ref = this.children;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      if (typeof child.mute === "function") {
        child.mute();
      }
      if (child.children.length) {
        child.muteAll();
      }
    }
    return null;
  };

  AbstractView.prototype.removeAllChildren = function() {
    var child, _i, _len, _ref;
    _ref = this.children;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      this.remove(child);
    }
    return null;
  };

  AbstractView.prototype.triggerChildren = function(msg, children) {
    var child, i, _i, _len;
    if (children == null) {
      children = this.children;
    }
    for (i = _i = 0, _len = children.length; _i < _len; i = ++_i) {
      child = children[i];
      child.trigger(msg);
      if (child.children.length) {
        this.triggerChildren(msg, child.children);
      }
    }
    return null;
  };

  AbstractView.prototype.callChildren = function(method, params, children) {
    var child, i, _i, _len;
    if (children == null) {
      children = this.children;
    }
    for (i = _i = 0, _len = children.length; _i < _len; i = ++_i) {
      child = children[i];
      if (typeof child[method] === "function") {
        child[method](params);
      }
      if (child.children.length) {
        this.callChildren(method, params, child.children);
      }
    }
    return null;
  };

  AbstractView.prototype.callChildrenAndSelf = function(method, params, children) {
    var child, i, _i, _len;
    if (children == null) {
      children = this.children;
    }
    if (typeof this[method] === "function") {
      this[method](params);
    }
    for (i = _i = 0, _len = children.length; _i < _len; i = ++_i) {
      child = children[i];
      if (typeof child[method] === "function") {
        child[method](params);
      }
      if (child.children.length) {
        this.callChildren(method, params, child.children);
      }
    }
    return null;
  };

  AbstractView.prototype.supplantString = function(str, vals) {
    return str.replace(/{{ ([^{}]*) }}/g, function(a, b) {
      var r;
      r = vals[b];
      if (typeof r === "string" || typeof r === "number") {
        return r;
      } else {
        return a;
      }
    });
  };

  AbstractView.prototype.dispose = function() {

    /*
    		override on per view basis - unbind event handlers etc
     */
    return null;
  };

  AbstractView.prototype.CD_CE = function() {
    return window.CD_CE;
  };

  return AbstractView;

})(Backbone.View);

module.exports = AbstractView;



},{}],33:[function(require,module,exports){
var AbstractView, AbstractViewPage,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('./AbstractView');

AbstractViewPage = (function(_super) {
  __extends(AbstractViewPage, _super);

  function AbstractViewPage() {
    this.setListeners = __bind(this.setListeners, this);
    this.dispose = __bind(this.dispose, this);
    this.hide = __bind(this.hide, this);
    this.show = __bind(this.show, this);
    return AbstractViewPage.__super__.constructor.apply(this, arguments);
  }

  AbstractViewPage.prototype._shown = false;

  AbstractViewPage.prototype._listening = false;

  AbstractViewPage.prototype.show = function(cb) {
    if (!!this._shown) {
      return;
    }
    this._shown = true;

    /*
    		CHANGE HERE - 'page' views are always in DOM - to save having to re-initialise gmap events (PITA). No longer require :dispose method
     */
    this.CD_CE().appView.wrapper.addChild(this);
    this.callChildrenAndSelf('setListeners', 'on');

    /* replace with some proper transition if we can */
    this.$el.css({
      'visibility': 'visible'
    });
    if (typeof cb === "function") {
      cb();
    }
    return null;
  };

  AbstractViewPage.prototype.hide = function(cb) {
    if (!this._shown) {
      return;
    }
    this._shown = false;

    /*
    		CHANGE HERE - 'page' views are always in DOM - to save having to re-initialise gmap events (PITA). No longer require :dispose method
     */
    this.CD_CE().appView.wrapper.remove(this);

    /* replace with some proper transition if we can */
    this.$el.css({
      'visibility': 'hidden'
    });
    if (typeof cb === "function") {
      cb();
    }
    return null;
  };

  AbstractViewPage.prototype.dispose = function() {
    this.callChildrenAndSelf('setListeners', 'off');
    return null;
  };

  AbstractViewPage.prototype.setListeners = function(setting) {
    if (setting === this._listening) {
      return;
    }
    this._listening = setting;
    return null;
  };

  return AbstractViewPage;

})(AbstractView);

module.exports = AbstractViewPage;



},{"./AbstractView":32}],34:[function(require,module,exports){
var AbstractView, Footer,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('../AbstractView');

Footer = (function(_super) {
  __extends(Footer, _super);

  Footer.prototype.template = 'site-footer';

  function Footer() {
    this.templateVars = {
      desc: this.CD_CE().locale.get("footer_desc")
    };
    Footer.__super__.constructor.call(this);
    return null;
  }

  return Footer;

})(AbstractView);

module.exports = Footer;



},{"../AbstractView":32}],35:[function(require,module,exports){
var AbstractView, CodeWordTransitioner, Header, Router,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('../AbstractView');

Router = require('../../router/Router');

CodeWordTransitioner = require('../../utils/CodeWordTransitioner');

Header = (function(_super) {
  __extends(Header, _super);

  Header.prototype.template = 'site-header';

  Header.prototype.FIRST_HASHCHANGE = true;

  Header.prototype.DOODLE_INFO_OPEN = false;

  Header.prototype.EVENT_DOODLE_INFO_OPEN = 'EVENT_DOODLE_INFO_OPEN';

  Header.prototype.EVENT_DOODLE_INFO_CLOSE = 'EVENT_DOODLE_INFO_CLOSE';

  Header.prototype.EVENT_HOME_SCROLL_TO_TOP = 'EVENT_HOME_SCROLL_TO_TOP';

  function Header() {
    this.hideDoodleInfo = __bind(this.hideDoodleInfo, this);
    this.showDoodleInfo = __bind(this.showDoodleInfo, this);
    this.onKeyup = __bind(this.onKeyup, this);
    this.onCloseBtnClick = __bind(this.onCloseBtnClick, this);
    this.onInfoBtnClick = __bind(this.onInfoBtnClick, this);
    this.onWordLeave = __bind(this.onWordLeave, this);
    this.onWordEnter = __bind(this.onWordEnter, this);
    this.animateTextIn = __bind(this.animateTextIn, this);
    this._getDoodleColourScheme = __bind(this._getDoodleColourScheme, this);
    this.getSectionColour = __bind(this.getSectionColour, this);
    this.onAreaChange = __bind(this.onAreaChange, this);
    this.onHashChange = __bind(this.onHashChange, this);
    this.bindEvents = __bind(this.bindEvents, this);
    this.init = __bind(this.init, this);
    this.templateVars = {
      home_label: this.CD_CE().locale.get('header_logo_label'),
      close_label: this.CD_CE().locale.get('header_close_label'),
      info_label: this.CD_CE().locale.get('header_info_label')
    };
    Header.__super__.constructor.call(this);
    this.bindEvents();
    return null;
  }

  Header.prototype.init = function() {
    this.$logo = this.$el.find('.logo__link');
    this.$infoBtn = this.$el.find('.info-btn');
    this.$closeBtn = this.$el.find('.close-btn');
    return null;
  };

  Header.prototype.bindEvents = function() {
    this.CD_CE().appView.on(this.CD_CE().appView.EVENT_PRELOADER_HIDE, this.animateTextIn);
    this.CD_CE().router.on(Router.EVENT_HASH_CHANGED, this.onHashChange);
    this.$el.on('mouseenter', '[data-codeword]', this.onWordEnter);
    this.$el.on('mouseleave', '[data-codeword]', this.onWordLeave);
    this.$infoBtn.on('click', this.onInfoBtnClick);
    this.$closeBtn.on('click', this.onCloseBtnClick);
    this.CD_CE().appView.$window.on('keyup', this.onKeyup);
    return null;
  };

  Header.prototype.onHashChange = function(where) {
    var colorScheme;
    if (this.FIRST_HASHCHANGE) {
      this.FIRST_HASHCHANGE = false;
      colorScheme = this._getDoodleColourScheme();
      this.$logo.add(this.$infoBtn).addClass(colorScheme).attr('data-codeword-initial-state', colorScheme).find('[data-codetext-char-state]').attr('data-codetext-char-state', colorScheme);
      CodeWordTransitioner.out([this.$closeBtn], colorScheme);
      return;
    }
    this.onAreaChange(where);
    return null;
  };

  Header.prototype.onAreaChange = function(section) {
    var colour;
    this.activeSection = section;
    colour = this.getSectionColour(section);
    this.$el.attr('data-section', section);
    CodeWordTransitioner["in"](this.$logo, colour);
    if (section === this.CD_CE().nav.sections.HOME) {
      CodeWordTransitioner["in"]([this.$infoBtn], colour);
      CodeWordTransitioner.out([this.$closeBtn], colour);
    } else if (section === 'doodle-info') {
      CodeWordTransitioner["in"]([this.$closeBtn], colour);
      CodeWordTransitioner["in"]([this.$infoBtn], 'red-active');
    }
    return null;
  };

  Header.prototype.getSectionColour = function(section, wordSection) {
    var colour;
    if (wordSection == null) {
      wordSection = null;
    }
    section = section || this.CD_CE().nav.current.area || 'home';
    if (wordSection && section === wordSection) {
      if (wordSection === 'doodle-info') {
        return 'red-active';
      } else {
        return 'white-active';
      }
    }
    colour = (function() {
      switch (section) {
        case 'home':
        case 'doodle-info':
          return 'red';
        case this.CD_CE().nav.sections.HOME:
          return this._getDoodleColourScheme();
        default:
          return 'white';
      }
    }).call(this);
    return colour;
  };

  Header.prototype._getDoodleColourScheme = function() {
    var colour;
    colour = this.CD_CE().appData.activeDoodle.get('colour_scheme') === 'light' ? 'black' : 'white';
    return colour;
  };

  Header.prototype.animateTextIn = function() {
    this.onAreaChange(this.CD_CE().nav.current.area);
    return null;
  };

  Header.prototype.onWordEnter = function(e) {
    var $el, wordSection;
    $el = $(e.currentTarget);
    wordSection = $el.attr('data-word-section');
    CodeWordTransitioner.scramble($el, this.getSectionColour(this.activeSection, wordSection));
    return null;
  };

  Header.prototype.onWordLeave = function(e) {
    var $el, wordSection;
    $el = $(e.currentTarget);
    wordSection = $el.attr('data-word-section');
    CodeWordTransitioner.unscramble($el, this.getSectionColour(this.activeSection, wordSection));
    return null;
  };

  Header.prototype.onInfoBtnClick = function(e) {
    e.preventDefault();
    if (this.CD_CE().nav.current.area !== this.CD_CE().nav.sections.HOME) {
      return;
    }
    if (!this.DOODLE_INFO_OPEN) {
      this.showDoodleInfo();
    }
    return null;
  };

  Header.prototype.onCloseBtnClick = function(e) {
    if (this.DOODLE_INFO_OPEN) {
      e.preventDefault();
      e.stopPropagation();
      this.hideDoodleInfo();
    }
    return null;
  };

  Header.prototype.onKeyup = function(e) {
    if (e.keyCode === 27) {
      this.hideDoodleInfo();
    }
    return null;
  };

  Header.prototype.showDoodleInfo = function() {
    if (!!this.DOODLE_INFO_OPEN) {
      return;
    }
    this.onAreaChange('doodle-info');
    this.trigger(this.EVENT_DOODLE_INFO_OPEN);
    this.DOODLE_INFO_OPEN = true;
    return null;
  };

  Header.prototype.hideDoodleInfo = function() {
    if (!this.DOODLE_INFO_OPEN) {
      return;
    }
    this.onAreaChange(this.CD_CE().nav.current.area);
    this.trigger(this.EVENT_DOODLE_INFO_CLOSE);
    this.DOODLE_INFO_OPEN = false;
    return null;
  };

  return Header;

})(AbstractView);

module.exports = Header;



},{"../../router/Router":22,"../../utils/CodeWordTransitioner":25,"../AbstractView":32}],36:[function(require,module,exports){
var AbstractView, Preloader,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('../AbstractView');

Preloader = (function(_super) {
  __extends(Preloader, _super);

  Preloader.prototype.cb = null;

  Preloader.prototype.TRANSITION_TIME = 0.5;

  function Preloader() {
    this.onHideComplete = __bind(this.onHideComplete, this);
    this.hide = __bind(this.hide, this);
    this.onShowComplete = __bind(this.onShowComplete, this);
    this.show = __bind(this.show, this);
    this.init = __bind(this.init, this);
    this.setElement($('#preloader'));
    Preloader.__super__.constructor.call(this);
    return null;
  }

  Preloader.prototype.init = function() {
    return null;
  };

  Preloader.prototype.show = function(cb) {
    this.cb = cb;
    this.$el.css({
      'display': 'block'
    });
    return null;
  };

  Preloader.prototype.onShowComplete = function() {
    if (typeof this.cb === "function") {
      this.cb();
    }
    return null;
  };

  Preloader.prototype.hide = function(cb) {
    this.cb = cb;
    this.onHideComplete();
    return null;
  };

  Preloader.prototype.onHideComplete = function() {
    this.$el.css({
      'display': 'none'
    });
    if (typeof this.cb === "function") {
      this.cb();
    }
    return null;
  };

  return Preloader;

})(AbstractView);

module.exports = Preloader;



},{"../AbstractView":32}],37:[function(require,module,exports){
var AbstractView, DoodlePageView, Nav, Wrapper,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('../AbstractView');

DoodlePageView = require('../doodlePage/DoodlePageView');

Nav = require('../../router/Nav');

Wrapper = (function(_super) {
  __extends(Wrapper, _super);

  Wrapper.prototype.VIEW_TYPE_PAGE = 'page';

  Wrapper.prototype.VIEW_TYPE_MODAL = 'modal';

  Wrapper.prototype.template = 'wrapper';

  Wrapper.prototype.views = null;

  Wrapper.prototype.previousView = null;

  Wrapper.prototype.currentView = null;

  Wrapper.prototype.backgroundView = null;

  function Wrapper() {
    this.transitionViews = __bind(this.transitionViews, this);
    this.changeSubView = __bind(this.changeSubView, this);
    this.changeView = __bind(this.changeView, this);
    this.updateDims = __bind(this.updateDims, this);
    this.bindEvents = __bind(this.bindEvents, this);
    this.start = __bind(this.start, this);
    this.init = __bind(this.init, this);
    this.getViewByRoute = __bind(this.getViewByRoute, this);
    this.getViewByRoute = __bind(this.getViewByRoute, this);
    this.addClasses = __bind(this.addClasses, this);
    this.createClasses = __bind(this.createClasses, this);
    this.views = {
      doodle: {
        classRef: DoodlePageView,
        route: this.CD_CE().nav.sections.HOME,
        view: null,
        type: this.VIEW_TYPE_PAGE
      }
    };
    this.createClasses();
    Wrapper.__super__.constructor.call(this);
    return null;
  }

  Wrapper.prototype.createClasses = function() {
    var data, name, _ref;
    _ref = this.views;
    for (name in _ref) {
      data = _ref[name];
      this.views[name].view = new this.views[name].classRef;
    }
    return null;
  };

  Wrapper.prototype.addClasses = function() {
    var data, name, _ref, _results;
    _ref = this.views;
    _results = [];
    for (name in _ref) {
      data = _ref[name];
      if (data.type === this.VIEW_TYPE_PAGE) {
        _results.push(this.addChild(data.view));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  null;

  Wrapper.prototype.getViewByRoute = function(route) {
    var data, name, _ref;
    _ref = this.views;
    for (name in _ref) {
      data = _ref[name];
      if (route === this.views[name].route) {
        return this.views[name];
      }
    }
    return null;
  };

  Wrapper.prototype.getViewByRoute = function(route) {
    var data, name, _ref;
    _ref = this.views;
    for (name in _ref) {
      data = _ref[name];
      if (route === this.views[name].route) {
        return this.views[name];
      }
    }
    if (route) {
      return this.views.fourOhFour;
    }
    return null;
  };

  Wrapper.prototype.init = function() {
    this.CD_CE().appView.on('start', this.start);
    return null;
  };

  Wrapper.prototype.start = function() {
    this.CD_CE().appView.off('start', this.start);
    this.bindEvents();
    this.updateDims();
    return null;
  };

  Wrapper.prototype.bindEvents = function() {
    this.CD_CE().nav.on(Nav.EVENT_CHANGE_VIEW, this.changeView);
    this.CD_CE().nav.on(Nav.EVENT_CHANGE_SUB_VIEW, this.changeSubView);
    this.CD_CE().appView.on(this.CD_CE().appView.EVENT_UPDATE_DIMENSIONS, this.updateDims);
    return null;
  };

  Wrapper.prototype.updateDims = function() {
    this.$el.css('min-height', this.CD_CE().appView.dims.h);
    return null;
  };

  Wrapper.prototype.changeView = function(previous, current) {
    if (this.pageSwitchDfd && this.pageSwitchDfd.state() !== 'resolved') {
      (function(_this) {
        return (function(previous, current) {
          return _this.pageSwitchDfd.done(function() {
            return _this.changeView(previous, current);
          });
        });
      })(this)(previous, current);
      return;
    }
    this.previousView = this.getViewByRoute(previous.area);
    this.currentView = this.getViewByRoute(current.area);
    if (!this.previousView) {
      this.transitionViews(false, this.currentView);
    } else {
      this.transitionViews(this.previousView, this.currentView);
    }
    return null;
  };

  Wrapper.prototype.changeSubView = function(current) {
    this.currentView.view.trigger(Nav.EVENT_CHANGE_SUB_VIEW, current.sub);
    return null;
  };

  Wrapper.prototype.transitionViews = function(from, to) {
    this.pageSwitchDfd = $.Deferred();
    if (from && to) {
      this.CD_CE().appView.transitioner.prepare(from.route, to.route);
      this.CD_CE().appView.transitioner["in"]((function(_this) {
        return function() {
          return from.view.hide(function() {
            return to.view.show(function() {
              return _this.CD_CE().appView.transitioner.out(function() {
                return _this.pageSwitchDfd.resolve();
              });
            });
          });
        };
      })(this));
    } else if (from) {
      from.view.hide(this.pageSwitchDfd.resolve);
    } else if (to) {
      to.view.show(this.pageSwitchDfd.resolve);
    }
    return null;
  };

  return Wrapper;

})(AbstractView);

module.exports = Wrapper;



},{"../../router/Nav":21,"../AbstractView":32,"../doodlePage/DoodlePageView":38}],38:[function(require,module,exports){
var AbstractViewPage, CodeWordTransitioner, DoodlePageView,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractViewPage = require('../AbstractViewPage');

CodeWordTransitioner = require('../../utils/CodeWordTransitioner');

DoodlePageView = (function(_super) {
  __extends(DoodlePageView, _super);

  DoodlePageView.prototype.template = 'page-doodle';

  DoodlePageView.prototype.model = null;

  function DoodlePageView() {
    this.getShareDesc = __bind(this.getShareDesc, this);
    this.onShareBtnClick = __bind(this.onShareBtnClick, this);
    this.onInfoClose = __bind(this.onInfoClose, this);
    this.onInfoOpen = __bind(this.onInfoOpen, this);
    this._getInteractionContent = __bind(this._getInteractionContent, this);
    this.getDoodleInfoContent = __bind(this.getDoodleInfoContent, this);
    this.getInstructions = __bind(this.getInstructions, this);
    this.setupInstructions = __bind(this.setupInstructions, this);
    this.showDoodle = __bind(this.showDoodle, this);
    this.showFrame = __bind(this.showFrame, this);
    this.setupUI = __bind(this.setupUI, this);
    this.hide = __bind(this.hide, this);
    this.show = __bind(this.show, this);
    this.setListeners = __bind(this.setListeners, this);
    this.init = __bind(this.init, this);
    console.log("i am hamm");
    this.templateVars = {};
    DoodlePageView.__super__.constructor.call(this);
    return null;
  }

  DoodlePageView.prototype.init = function() {
    this.$frame = this.$el.find('[data-doodle-frame]');
    this.$infoContent = this.$el.find('[data-doodle-info]');
    this.$instructions = this.$el.find('[data-doodle-instructions]');
    this.$mouse = this.$el.find('[data-indicator="mouse"]');
    this.$keyboard = this.$el.find('[data-indicator="keyboard"]');
    this.$touch = this.$el.find('[data-indicator="touch"]');
    return null;
  };

  DoodlePageView.prototype.setListeners = function(setting) {
    this.CD_CE().appView.header[setting](this.CD_CE().appView.header.EVENT_DOODLE_INFO_OPEN, this.onInfoOpen);
    this.CD_CE().appView.header[setting](this.CD_CE().appView.header.EVENT_DOODLE_INFO_CLOSE, this.onInfoClose);
    this.$el[setting]('click', '[data-share-btn]', this.onShareBtnClick);
    return null;
  };

  DoodlePageView.prototype.show = function(cb) {
    this.model = this.CD_CE().appData.activeDoodle;
    this.setupUI();
    DoodlePageView.__super__.show.apply(this, arguments);
    this.showFrame(false);
    return null;
  };

  DoodlePageView.prototype.hide = function(cb) {
    this.CD_CE().appView.header.hideDoodleInfo();
    DoodlePageView.__super__.hide.apply(this, arguments);
    return null;
  };

  DoodlePageView.prototype.setupUI = function() {
    this.$infoContent.html(this.getDoodleInfoContent());
    this.$el.attr('data-color-scheme', this.model.get('colour_scheme'));
    this.$frame.attr('src', '').removeClass('show');
    this.$mouse.attr('disabled', !this.model.get('interaction.mouse'));
    this.$keyboard.attr('disabled', !this.model.get('interaction.keyboard'));
    this.$touch.attr('disabled', !this.model.get('interaction.touch'));
    this.setupInstructions();
    return null;
  };

  DoodlePageView.prototype.showFrame = function(removeEvent) {
    var SAMPLE_DIR;
    if (removeEvent == null) {
      removeEvent = true;
    }
    if (removeEvent) {
      this.CD_CE().appView.transitioner.off(this.CD_CE().appView.transitioner.EVENT_TRANSITIONER_OUT_DONE, this.showFrame);
    }
    SAMPLE_DIR = this.model.get('SAMPLE_DIR');
    this.$frame.attr('src', "http://source.codedoodl.es/sample_doodles/" + SAMPLE_DIR + "/index.html");
    this.$frame.one('load', this.showDoodle);
    return null;
  };

  DoodlePageView.prototype.showDoodle = function() {
    this.$frame.addClass('show');
    setTimeout((function(_this) {
      return function() {
        return CodeWordTransitioner.out(_this.$instructions);
      };
    })(this), 1000);
    return null;
  };

  DoodlePageView.prototype.setupInstructions = function() {
    var $newInstructions;
    $newInstructions = this.getInstructions();
    this.$instructions.replaceWith($newInstructions);
    this.$instructions = $newInstructions;
    return null;
  };

  DoodlePageView.prototype.getInstructions = function() {
    var $instructionsEl, colourScheme, text;
    text = (function() {
      switch (this.model.get('SAMPLE_DIR')) {
        case 'shape-stream':
        case 'shape-stream-light':
          return 'move your mouse';
        case 'box-physics':
          return 'click and drag';
        case 'tubes':
          return 'click and hold';
        default:
          return '';
      }
    }).call(this);
    $instructionsEl = $('<span />');
    $instructionsEl.addClass('doodle-instructions').attr('data-codeword', '').attr('data-doodle-instructions', '').text(text);
    colourScheme = this.model.get('colour_scheme') === 'light' ? 'black' : 'white';
    CodeWordTransitioner.prepare($instructionsEl, colourScheme);
    return $instructionsEl;
  };

  DoodlePageView.prototype.getDoodleInfoContent = function() {
    var doodleInfoContent, doodleInfoVars;
    this.model.setShortlink();
    doodleInfoVars = {
      indexHTML: this.model.get('indexHTML'),
      label_author: this.CD_CE().locale.get("doodle_label_author"),
      content_author: this.model.getAuthorHtml(),
      label_doodle_name: this.CD_CE().locale.get("doodle_label_doodle_name"),
      content_doodle_name: this.model.get('name'),
      label_description: this.CD_CE().locale.get("doodle_label_description"),
      content_description: this.model.get('description'),
      label_tags: this.CD_CE().locale.get("doodle_label_tags"),
      content_tags: this.model.get('tags').join(', '),
      label_interaction: this.CD_CE().locale.get("doodle_label_interaction"),
      content_interaction: this._getInteractionContent(),
      label_share: this.CD_CE().locale.get("doodle_label_share"),
      share_url: this.CD_CE().SITE_URL + '/' + this.model.get('shortlink'),
      share_url_text: this.CD_CE().SITE_URL.replace('http://', '') + '/' + this.model.get('shortlink')
    };
    doodleInfoContent = _.template(this.CD_CE().templates.get('doodle-info'))(doodleInfoVars);
    return doodleInfoContent;
  };

  DoodlePageView.prototype._getInteractionContent = function() {
    var interactions;
    interactions = [];
    if (this.model.get('interaction.mouse')) {
      interactions.push(this.CD_CE().locale.get("doodle_label_interaction_mouse"));
    }
    if (this.model.get('interaction.keyboard')) {
      interactions.push(this.CD_CE().locale.get("doodle_label_interaction_keyboard"));
    }
    if (this.model.get('interaction.touch')) {
      interactions.push(this.CD_CE().locale.get("doodle_label_interaction_touch"));
    }
    return interactions.join(', ') || this.CD_CE().locale.get("doodle_label_interaction_none");
  };

  DoodlePageView.prototype.onInfoOpen = function() {
    this.$el.addClass('show-info');
    return null;
  };

  DoodlePageView.prototype.onInfoClose = function() {
    this.$el.removeClass('show-info');
    return null;
  };

  DoodlePageView.prototype.onShareBtnClick = function(e) {
    var desc, shareMethod, url;
    e.preventDefault();
    shareMethod = $(e.currentTarget).attr('data-share-btn');
    url = shareMethod === 'facebook' ? this.CD_CE().SITE_URL + '/' + this.model.get('shortlink') : ' ';
    desc = this.getShareDesc();
    this.CD_CE().share[shareMethod](url, desc);
    return null;
  };

  DoodlePageView.prototype.getShareDesc = function() {
    var desc, vars;
    vars = {
      doodle_name: this.model.get('name'),
      doodle_author: this.model.get('author.twitter') ? "@" + (this.model.get('author.twitter')) : this.model.get('author.name'),
      share_url: this.CD_CE().SITE_URL + '/' + this.model.get('shortlink'),
      doodle_tags: _.map(this.model.get('tags'), function(tag) {
        return '#' + tag;
      }).join(' ')
    };
    desc = this.supplantString(this.CD_CE().locale.get('doodle_share_text_tmpl'), vars, false);
    return desc.replace(/&nbsp;/g, ' ');
  };

  return DoodlePageView;

})(AbstractViewPage);

module.exports = DoodlePageView;



},{"../../utils/CodeWordTransitioner":25,"../AbstractViewPage":33}],39:[function(require,module,exports){
var AbstractModal, AbstractView,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('../AbstractView');

AbstractModal = (function(_super) {
  __extends(AbstractModal, _super);

  AbstractModal.prototype.$window = null;


  /* override in individual classes */

  AbstractModal.prototype.name = null;

  AbstractModal.prototype.template = null;

  function AbstractModal() {
    this.closeClick = __bind(this.closeClick, this);
    this.animateOut = __bind(this.animateOut, this);
    this.animateIn = __bind(this.animateIn, this);
    this.onKeyUp = __bind(this.onKeyUp, this);
    this.setListeners = __bind(this.setListeners, this);
    this.dispose = __bind(this.dispose, this);
    this.hide = __bind(this.hide, this);
    this.$window = $(window);
    AbstractModal.__super__.constructor.call(this);
    this.CD_CE().appView.addChild(this);
    this.setListeners('on');
    this.animateIn();
    return null;
  }

  AbstractModal.prototype.hide = function() {
    this.animateOut((function(_this) {
      return function() {
        return _this.CD_CE().appView.remove(_this);
      };
    })(this));
    return null;
  };

  AbstractModal.prototype.dispose = function() {
    this.setListeners('off');
    this.CD_CE().appView.modalManager.modals[this.name].view = null;
    return null;
  };

  AbstractModal.prototype.setListeners = function(setting) {
    this.$window[setting]('keyup', this.onKeyUp);
    this.$('[data-close]')[setting]('click', this.closeClick);
    return null;
  };

  AbstractModal.prototype.onKeyUp = function(e) {
    if (e.keyCode === 27) {
      this.hide();
    }
    return null;
  };

  AbstractModal.prototype.animateIn = function() {
    TweenLite.to(this.$el, 0.3, {
      'visibility': 'visible',
      'opacity': 1,
      ease: Quad.easeOut
    });
    TweenLite.to(this.$el.find('.inner'), 0.3, {
      delay: 0.15,
      'transform': 'scale(1)',
      'visibility': 'visible',
      'opacity': 1,
      ease: Back.easeOut
    });
    return null;
  };

  AbstractModal.prototype.animateOut = function(callback) {
    TweenLite.to(this.$el, 0.3, {
      delay: 0.15,
      'opacity': 0,
      ease: Quad.easeOut,
      onComplete: callback
    });
    TweenLite.to(this.$el.find('.inner'), 0.3, {
      'transform': 'scale(0.8)',
      'opacity': 0,
      ease: Back.easeIn
    });
    return null;
  };

  AbstractModal.prototype.closeClick = function(e) {
    e.preventDefault();
    this.hide();
    return null;
  };

  return AbstractModal;

})(AbstractView);

module.exports = AbstractModal;



},{"../AbstractView":32}],40:[function(require,module,exports){
var AbstractModal, OrientationModal,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractModal = require('./AbstractModal');

OrientationModal = (function(_super) {
  __extends(OrientationModal, _super);

  OrientationModal.prototype.name = 'orientationModal';

  OrientationModal.prototype.template = 'orientation-modal';

  OrientationModal.prototype.cb = null;

  function OrientationModal(cb) {
    this.cb = cb;
    this.onUpdateDims = __bind(this.onUpdateDims, this);
    this.setListeners = __bind(this.setListeners, this);
    this.hide = __bind(this.hide, this);
    this.init = __bind(this.init, this);
    this.templateVars = {
      name: this.name
    };
    OrientationModal.__super__.constructor.call(this);
    return null;
  }

  OrientationModal.prototype.init = function() {
    return null;
  };

  OrientationModal.prototype.hide = function(stillLandscape) {
    if (stillLandscape == null) {
      stillLandscape = true;
    }
    this.animateOut((function(_this) {
      return function() {
        _this.CD_CE().appView.remove(_this);
        if (!stillLandscape) {
          return typeof _this.cb === "function" ? _this.cb() : void 0;
        }
      };
    })(this));
    return null;
  };

  OrientationModal.prototype.setListeners = function(setting) {
    OrientationModal.__super__.setListeners.apply(this, arguments);
    this.CD_CE().appView[setting]('updateDims', this.onUpdateDims);
    this.$el[setting]('touchend click', this.hide);
    return null;
  };

  OrientationModal.prototype.onUpdateDims = function(dims) {
    if (dims.o === 'portrait') {
      this.hide(false);
    }
    return null;
  };

  return OrientationModal;

})(AbstractModal);

module.exports = OrientationModal;



},{"./AbstractModal":39}],41:[function(require,module,exports){
var AbstractView, ModalManager, OrientationModal,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('../AbstractView');

OrientationModal = require('./OrientationModal');

ModalManager = (function(_super) {
  __extends(ModalManager, _super);

  ModalManager.prototype.modals = {
    orientationModal: {
      classRef: OrientationModal,
      view: null
    }
  };

  function ModalManager() {
    this.showModal = __bind(this.showModal, this);
    this.hideOpenModal = __bind(this.hideOpenModal, this);
    this.isOpen = __bind(this.isOpen, this);
    this.init = __bind(this.init, this);
    ModalManager.__super__.constructor.call(this);
    return null;
  }

  ModalManager.prototype.init = function() {
    return null;
  };

  ModalManager.prototype.isOpen = function() {
    var modal, name, _ref;
    _ref = this.modals;
    for (name in _ref) {
      modal = _ref[name];
      if (this.modals[name].view) {
        return true;
      }
    }
    return false;
  };

  ModalManager.prototype.hideOpenModal = function() {
    var modal, name, openModal, _ref;
    _ref = this.modals;
    for (name in _ref) {
      modal = _ref[name];
      if (this.modals[name].view) {
        openModal = this.modals[name].view;
      }
    }
    if (openModal != null) {
      openModal.hide();
    }
    return null;
  };

  ModalManager.prototype.showModal = function(name, cb) {
    if (cb == null) {
      cb = null;
    }
    if (this.modals[name].view) {
      return;
    }
    this.modals[name].view = new this.modals[name].classRef(cb);
    return null;
  };

  return ModalManager;

})(AbstractView);

module.exports = ModalManager;



},{"../AbstractView":32,"./OrientationModal":40}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL01haW4uY29mZmVlIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3B1bnljb2RlL3B1bnljb2RlLmpzIiwibm9kZV9tb2R1bGVzL2VudC9lbmNvZGUuanMiLCJub2RlX21vZHVsZXMvZW50L3JldmVyc2VkLmpzb24iLCJub2RlX21vZHVsZXMvaGFzaGlkcy9saWIvaGFzaGlkcy5qcyIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvQXBwLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvQXBwRGF0YS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL0FwcFZpZXcuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9BYnN0cmFjdENvbGxlY3Rpb24uY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9jb3JlL1RlbXBsYXRlc0NvbGxlY3Rpb24uY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9kb29kbGVzL0Rvb2RsZXNDb2xsZWN0aW9uLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvZGF0YS9BUEkuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9kYXRhL0Fic3RyYWN0RGF0YS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL2RhdGEvTG9jYWxlLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvZGF0YS9UZW1wbGF0ZXMuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvQWJzdHJhY3RNb2RlbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL21vZGVscy9jb3JlL0FQSVJvdXRlTW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvY29yZS9Mb2NhbGVzTW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvY29yZS9UZW1wbGF0ZU1vZGVsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL2Rvb2RsZS9Eb29kbGVNb2RlbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3JvdXRlci9OYXYuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9yb3V0ZXIvUm91dGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvQW5hbHl0aWNzLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvQXV0aE1hbmFnZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0ZhY2Vib29rLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvR29vZ2xlUGx1cy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL01lZGlhUXVlcmllcy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL051bWJlclV0aWxzLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvUmVxdWVzdGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvU2hhcmUuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L0Fic3RyYWN0Vmlldy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvQWJzdHJhY3RWaWV3UGFnZS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvYmFzZS9Gb290ZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L2Jhc2UvSGVhZGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9iYXNlL1ByZWxvYWRlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvYmFzZS9XcmFwcGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9kb29kbGVQYWdlL0Rvb2RsZVBhZ2VWaWV3LmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9tb2RhbHMvQWJzdHJhY3RNb2RhbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvbW9kYWxzL09yaWVudGF0aW9uTW9kYWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L21vZGFscy9fTW9kYWxNYW5hZ2VyLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBLElBQUEsa0JBQUE7O0FBQUEsR0FBQSxHQUFNLE9BQUEsQ0FBUSxPQUFSLENBQU4sQ0FBQTs7QUFLQTtBQUFBOzs7R0FMQTs7QUFBQSxPQVdBLEdBQVUsS0FYVixDQUFBOztBQUFBLElBY0EsR0FBVSxPQUFILEdBQWdCLEVBQWhCLEdBQXlCLE1BQUEsSUFBVSxRQWQxQyxDQUFBOztBQUFBLElBaUJJLENBQUMsS0FBTCxHQUFpQixJQUFBLEdBQUEsQ0FBSSxPQUFKLENBakJqQixDQUFBOztBQUFBLElBa0JJLENBQUMsS0FBSyxDQUFDLElBQVgsQ0FBQSxDQWxCQSxDQUFBOzs7Ozs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbHlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZWQSxJQUFBLHdIQUFBO0VBQUEsa0ZBQUE7O0FBQUEsU0FBQSxHQUFlLE9BQUEsQ0FBUSxtQkFBUixDQUFmLENBQUE7O0FBQUEsV0FDQSxHQUFlLE9BQUEsQ0FBUSxxQkFBUixDQURmLENBQUE7O0FBQUEsS0FFQSxHQUFlLE9BQUEsQ0FBUSxl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QSxhQUFBLEdBQWdCLFNBQUEsR0FBQTtBQUVmLFFBQUEsNEJBQUE7QUFBQTtBQUFBLFNBQUEsWUFBQTt5QkFBQTtBQUFFLE1BQUEsSUFBRyxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLElBQWpCO0FBQTJCLFFBQUEsU0FBQSxHQUFZLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBQSxDQUFLLENBQUMsSUFBMUIsQ0FBM0I7T0FBRjtBQUFBLEtBQUE7O01BRUEsU0FBUyxDQUFFLElBQVgsQ0FBQTtLQUZBO1dBSUEsS0FOZTtFQUFBLENBbkJoQixDQUFBOztBQUFBLHlCQTJCQSxTQUFBLEdBQVksU0FBQyxJQUFELEVBQU8sRUFBUCxHQUFBOztNQUFPLEtBQUc7S0FFckI7QUFBQSxJQUFBLElBQVUsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxJQUF4QjtBQUFBLFlBQUEsQ0FBQTtLQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLElBQWQsR0FBeUIsSUFBQSxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLFFBQWQsQ0FBdUIsRUFBdkIsQ0FGekIsQ0FBQTtXQUlBLEtBTlc7RUFBQSxDQTNCWixDQUFBOztzQkFBQTs7R0FIMEIsYUFIM0IsQ0FBQTs7QUFBQSxNQXlDTSxDQUFDLE9BQVAsR0FBaUIsWUF6Q2pCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiQXBwID0gcmVxdWlyZSAnLi9BcHAnXG5cbiMgUFJPRFVDVElPTiBFTlZJUk9OTUVOVCAtIG1heSB3YW50IHRvIHVzZSBzZXJ2ZXItc2V0IHZhcmlhYmxlcyBoZXJlXG4jIElTX0xJVkUgPSBkbyAtPiByZXR1cm4gaWYgd2luZG93LmxvY2F0aW9uLmhvc3QuaW5kZXhPZignbG9jYWxob3N0JykgPiAtMSBvciB3aW5kb3cubG9jYXRpb24uc2VhcmNoIGlzICc/ZCcgdGhlbiBmYWxzZSBlbHNlIHRydWVcblxuIyMjXG5cbldJUCAtIHRoaXMgd2lsbCBpZGVhbGx5IGNoYW5nZSB0byBvbGQgZm9ybWF0IChhYm92ZSkgd2hlbiBjYW4gZmlndXJlIGl0IG91dFxuXG4jIyNcblxuSVNfTElWRSA9IGZhbHNlXG5cbiMgT05MWSBFWFBPU0UgQVBQIEdMT0JBTExZIElGIExPQ0FMIE9SIERFVidJTkdcbnZpZXcgPSBpZiBJU19MSVZFIHRoZW4ge30gZWxzZSAod2luZG93IG9yIGRvY3VtZW50KVxuXG4jIERFQ0xBUkUgTUFJTiBBUFBMSUNBVElPTlxudmlldy5DRF9DRSA9IG5ldyBBcHAgSVNfTElWRVxudmlldy5DRF9DRS5pbml0KClcbiIsIi8qISBodHRwOi8vbXRocy5iZS9wdW55Y29kZSB2MS4yLjQgYnkgQG1hdGhpYXMgKi9cbjsoZnVuY3Rpb24ocm9vdCkge1xuXG5cdC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZXMgKi9cblx0dmFyIGZyZWVFeHBvcnRzID0gdHlwZW9mIGV4cG9ydHMgPT0gJ29iamVjdCcgJiYgZXhwb3J0cztcblx0dmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJlxuXHRcdG1vZHVsZS5leHBvcnRzID09IGZyZWVFeHBvcnRzICYmIG1vZHVsZTtcblx0dmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbDtcblx0aWYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsIHx8IGZyZWVHbG9iYWwud2luZG93ID09PSBmcmVlR2xvYmFsKSB7XG5cdFx0cm9vdCA9IGZyZWVHbG9iYWw7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwdW55Y29kZWAgb2JqZWN0LlxuXHQgKiBAbmFtZSBwdW55Y29kZVxuXHQgKiBAdHlwZSBPYmplY3Rcblx0ICovXG5cdHZhciBwdW55Y29kZSxcblxuXHQvKiogSGlnaGVzdCBwb3NpdGl2ZSBzaWduZWQgMzItYml0IGZsb2F0IHZhbHVlICovXG5cdG1heEludCA9IDIxNDc0ODM2NDcsIC8vIGFrYS4gMHg3RkZGRkZGRiBvciAyXjMxLTFcblxuXHQvKiogQm9vdHN0cmluZyBwYXJhbWV0ZXJzICovXG5cdGJhc2UgPSAzNixcblx0dE1pbiA9IDEsXG5cdHRNYXggPSAyNixcblx0c2tldyA9IDM4LFxuXHRkYW1wID0gNzAwLFxuXHRpbml0aWFsQmlhcyA9IDcyLFxuXHRpbml0aWFsTiA9IDEyOCwgLy8gMHg4MFxuXHRkZWxpbWl0ZXIgPSAnLScsIC8vICdcXHgyRCdcblxuXHQvKiogUmVndWxhciBleHByZXNzaW9ucyAqL1xuXHRyZWdleFB1bnljb2RlID0gL154bi0tLyxcblx0cmVnZXhOb25BU0NJSSA9IC9bXiAtfl0vLCAvLyB1bnByaW50YWJsZSBBU0NJSSBjaGFycyArIG5vbi1BU0NJSSBjaGFyc1xuXHRyZWdleFNlcGFyYXRvcnMgPSAvXFx4MkV8XFx1MzAwMnxcXHVGRjBFfFxcdUZGNjEvZywgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG5cdC8qKiBFcnJvciBtZXNzYWdlcyAqL1xuXHRlcnJvcnMgPSB7XG5cdFx0J292ZXJmbG93JzogJ092ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzJyxcblx0XHQnbm90LWJhc2ljJzogJ0lsbGVnYWwgaW5wdXQgPj0gMHg4MCAobm90IGEgYmFzaWMgY29kZSBwb2ludCknLFxuXHRcdCdpbnZhbGlkLWlucHV0JzogJ0ludmFsaWQgaW5wdXQnXG5cdH0sXG5cblx0LyoqIENvbnZlbmllbmNlIHNob3J0Y3V0cyAqL1xuXHRiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW4sXG5cdGZsb29yID0gTWF0aC5mbG9vcixcblx0c3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZSxcblxuXHQvKiogVGVtcG9yYXJ5IHZhcmlhYmxlICovXG5cdGtleTtcblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFRoZSBlcnJvciB0eXBlLlxuXHQgKiBAcmV0dXJucyB7RXJyb3J9IFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBlcnJvcih0eXBlKSB7XG5cdFx0dGhyb3cgUmFuZ2VFcnJvcihlcnJvcnNbdHlwZV0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBgQXJyYXkjbWFwYCB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnkgYXJyYXlcblx0ICogaXRlbS5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBhcnJheSBvZiB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwKGFycmF5LCBmbikge1xuXHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0d2hpbGUgKGxlbmd0aC0tKSB7XG5cdFx0XHRhcnJheVtsZW5ndGhdID0gZm4oYXJyYXlbbGVuZ3RoXSk7XG5cdFx0fVxuXHRcdHJldHVybiBhcnJheTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHNpbXBsZSBgQXJyYXkjbWFwYC1saWtlIHdyYXBwZXIgdG8gd29yayB3aXRoIGRvbWFpbiBuYW1lIHN0cmluZ3MuXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnlcblx0ICogY2hhcmFjdGVyLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IHN0cmluZyBvZiBjaGFyYWN0ZXJzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFja1xuXHQgKiBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcERvbWFpbihzdHJpbmcsIGZuKSB7XG5cdFx0cmV0dXJuIG1hcChzdHJpbmcuc3BsaXQocmVnZXhTZXBhcmF0b3JzKSwgZm4pLmpvaW4oJy4nKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIG51bWVyaWMgY29kZSBwb2ludHMgb2YgZWFjaCBVbmljb2RlXG5cdCAqIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nLiBXaGlsZSBKYXZhU2NyaXB0IHVzZXMgVUNTLTIgaW50ZXJuYWxseSxcblx0ICogdGhpcyBmdW5jdGlvbiB3aWxsIGNvbnZlcnQgYSBwYWlyIG9mIHN1cnJvZ2F0ZSBoYWx2ZXMgKGVhY2ggb2Ygd2hpY2hcblx0ICogVUNTLTIgZXhwb3NlcyBhcyBzZXBhcmF0ZSBjaGFyYWN0ZXJzKSBpbnRvIGEgc2luZ2xlIGNvZGUgcG9pbnQsXG5cdCAqIG1hdGNoaW5nIFVURi0xNi5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5lbmNvZGVgXG5cdCAqIEBzZWUgPGh0dHA6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGRlY29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nIFRoZSBVbmljb2RlIGlucHV0IHN0cmluZyAoVUNTLTIpLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IFRoZSBuZXcgYXJyYXkgb2YgY29kZSBwb2ludHMuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZGVjb2RlKHN0cmluZykge1xuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgY291bnRlciA9IDAsXG5cdFx0ICAgIGxlbmd0aCA9IHN0cmluZy5sZW5ndGgsXG5cdFx0ICAgIHZhbHVlLFxuXHRcdCAgICBleHRyYTtcblx0XHR3aGlsZSAoY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0dmFsdWUgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0aWYgKHZhbHVlID49IDB4RDgwMCAmJiB2YWx1ZSA8PSAweERCRkYgJiYgY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHQvLyBoaWdoIHN1cnJvZ2F0ZSwgYW5kIHRoZXJlIGlzIGEgbmV4dCBjaGFyYWN0ZXJcblx0XHRcdFx0ZXh0cmEgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0XHRpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHsgLy8gbG93IHN1cnJvZ2F0ZVxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKCgodmFsdWUgJiAweDNGRikgPDwgMTApICsgKGV4dHJhICYgMHgzRkYpICsgMHgxMDAwMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlIG5leHRcblx0XHRcdFx0XHQvLyBjb2RlIHVuaXQgaXMgdGhlIGhpZ2ggc3Vycm9nYXRlIG9mIGEgc3Vycm9nYXRlIHBhaXJcblx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0Y291bnRlci0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHN0cmluZyBiYXNlZCBvbiBhbiBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmRlY29kZWBcblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZW5jb2RlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGNvZGVQb2ludHMgVGhlIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBuZXcgVW5pY29kZSBzdHJpbmcgKFVDUy0yKS5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJlbmNvZGUoYXJyYXkpIHtcblx0XHRyZXR1cm4gbWFwKGFycmF5LCBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0dmFyIG91dHB1dCA9ICcnO1xuXHRcdFx0aWYgKHZhbHVlID4gMHhGRkZGKSB7XG5cdFx0XHRcdHZhbHVlIC09IDB4MTAwMDA7XG5cdFx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApO1xuXHRcdFx0XHR2YWx1ZSA9IDB4REMwMCB8IHZhbHVlICYgMHgzRkY7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBiYXNpYyBjb2RlIHBvaW50IGludG8gYSBkaWdpdC9pbnRlZ2VyLlxuXHQgKiBAc2VlIGBkaWdpdFRvQmFzaWMoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGNvZGVQb2ludCBUaGUgYmFzaWMgbnVtZXJpYyBjb2RlIHBvaW50IHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQgKGZvciB1c2UgaW5cblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpbiB0aGUgcmFuZ2UgYDBgIHRvIGBiYXNlIC0gMWAsIG9yIGBiYXNlYCBpZlxuXHQgKiB0aGUgY29kZSBwb2ludCBkb2VzIG5vdCByZXByZXNlbnQgYSB2YWx1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGJhc2ljVG9EaWdpdChjb2RlUG9pbnQpIHtcblx0XHRpZiAoY29kZVBvaW50IC0gNDggPCAxMCkge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDIyO1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gNjUgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDY1O1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gOTcgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDk3O1xuXHRcdH1cblx0XHRyZXR1cm4gYmFzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGRpZ2l0L2ludGVnZXIgaW50byBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEBzZWUgYGJhc2ljVG9EaWdpdCgpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gZGlnaXQgVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgYmFzaWMgY29kZSBwb2ludCB3aG9zZSB2YWx1ZSAod2hlbiB1c2VkIGZvclxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGlzIGBkaWdpdGAsIHdoaWNoIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZVxuXHQgKiBgMGAgdG8gYGJhc2UgLSAxYC4gSWYgYGZsYWdgIGlzIG5vbi16ZXJvLCB0aGUgdXBwZXJjYXNlIGZvcm0gaXNcblx0ICogdXNlZDsgZWxzZSwgdGhlIGxvd2VyY2FzZSBmb3JtIGlzIHVzZWQuIFRoZSBiZWhhdmlvciBpcyB1bmRlZmluZWRcblx0ICogaWYgYGZsYWdgIGlzIG5vbi16ZXJvIGFuZCBgZGlnaXRgIGhhcyBubyB1cHBlcmNhc2UgZm9ybS5cblx0ICovXG5cdGZ1bmN0aW9uIGRpZ2l0VG9CYXNpYyhkaWdpdCwgZmxhZykge1xuXHRcdC8vICAwLi4yNSBtYXAgdG8gQVNDSUkgYS4ueiBvciBBLi5aXG5cdFx0Ly8gMjYuLjM1IG1hcCB0byBBU0NJSSAwLi45XG5cdFx0cmV0dXJuIGRpZ2l0ICsgMjIgKyA3NSAqIChkaWdpdCA8IDI2KSAtICgoZmxhZyAhPSAwKSA8PCA1KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCaWFzIGFkYXB0YXRpb24gZnVuY3Rpb24gYXMgcGVyIHNlY3Rpb24gMy40IG9mIFJGQyAzNDkyLlxuXHQgKiBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzNDkyI3NlY3Rpb24tMy40XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGFwdChkZWx0YSwgbnVtUG9pbnRzLCBmaXJzdFRpbWUpIHtcblx0XHR2YXIgayA9IDA7XG5cdFx0ZGVsdGEgPSBmaXJzdFRpbWUgPyBmbG9vcihkZWx0YSAvIGRhbXApIDogZGVsdGEgPj4gMTtcblx0XHRkZWx0YSArPSBmbG9vcihkZWx0YSAvIG51bVBvaW50cyk7XG5cdFx0Zm9yICgvKiBubyBpbml0aWFsaXphdGlvbiAqLzsgZGVsdGEgPiBiYXNlTWludXNUTWluICogdE1heCA+PiAxOyBrICs9IGJhc2UpIHtcblx0XHRcdGRlbHRhID0gZmxvb3IoZGVsdGEgLyBiYXNlTWludXNUTWluKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZsb29yKGsgKyAoYmFzZU1pbnVzVE1pbiArIDEpICogZGVsdGEgLyAoZGVsdGEgKyBza2V3KSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzIHRvIGEgc3RyaW5nIG9mIFVuaWNvZGVcblx0ICogc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlKGlucHV0KSB7XG5cdFx0Ly8gRG9uJ3QgdXNlIFVDUy0yXG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aCxcblx0XHQgICAgb3V0LFxuXHRcdCAgICBpID0gMCxcblx0XHQgICAgbiA9IGluaXRpYWxOLFxuXHRcdCAgICBiaWFzID0gaW5pdGlhbEJpYXMsXG5cdFx0ICAgIGJhc2ljLFxuXHRcdCAgICBqLFxuXHRcdCAgICBpbmRleCxcblx0XHQgICAgb2xkaSxcblx0XHQgICAgdyxcblx0XHQgICAgayxcblx0XHQgICAgZGlnaXQsXG5cdFx0ICAgIHQsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBiYXNlTWludXNUO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50czogbGV0IGBiYXNpY2AgYmUgdGhlIG51bWJlciBvZiBpbnB1dCBjb2RlXG5cdFx0Ly8gcG9pbnRzIGJlZm9yZSB0aGUgbGFzdCBkZWxpbWl0ZXIsIG9yIGAwYCBpZiB0aGVyZSBpcyBub25lLCB0aGVuIGNvcHlcblx0XHQvLyB0aGUgZmlyc3QgYmFzaWMgY29kZSBwb2ludHMgdG8gdGhlIG91dHB1dC5cblxuXHRcdGJhc2ljID0gaW5wdXQubGFzdEluZGV4T2YoZGVsaW1pdGVyKTtcblx0XHRpZiAoYmFzaWMgPCAwKSB7XG5cdFx0XHRiYXNpYyA9IDA7XG5cdFx0fVxuXG5cdFx0Zm9yIChqID0gMDsgaiA8IGJhc2ljOyArK2opIHtcblx0XHRcdC8vIGlmIGl0J3Mgbm90IGEgYmFzaWMgY29kZSBwb2ludFxuXHRcdFx0aWYgKGlucHV0LmNoYXJDb2RlQXQoaikgPj0gMHg4MCkge1xuXHRcdFx0XHRlcnJvcignbm90LWJhc2ljJyk7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQucHVzaChpbnB1dC5jaGFyQ29kZUF0KGopKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGRlY29kaW5nIGxvb3A6IHN0YXJ0IGp1c3QgYWZ0ZXIgdGhlIGxhc3QgZGVsaW1pdGVyIGlmIGFueSBiYXNpYyBjb2RlXG5cdFx0Ly8gcG9pbnRzIHdlcmUgY29waWVkOyBzdGFydCBhdCB0aGUgYmVnaW5uaW5nIG90aGVyd2lzZS5cblxuXHRcdGZvciAoaW5kZXggPSBiYXNpYyA+IDAgPyBiYXNpYyArIDEgOiAwOyBpbmRleCA8IGlucHV0TGVuZ3RoOyAvKiBubyBmaW5hbCBleHByZXNzaW9uICovKSB7XG5cblx0XHRcdC8vIGBpbmRleGAgaXMgdGhlIGluZGV4IG9mIHRoZSBuZXh0IGNoYXJhY3RlciB0byBiZSBjb25zdW1lZC5cblx0XHRcdC8vIERlY29kZSBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyIGludG8gYGRlbHRhYCxcblx0XHRcdC8vIHdoaWNoIGdldHMgYWRkZWQgdG8gYGlgLiBUaGUgb3ZlcmZsb3cgY2hlY2tpbmcgaXMgZWFzaWVyXG5cdFx0XHQvLyBpZiB3ZSBpbmNyZWFzZSBgaWAgYXMgd2UgZ28sIHRoZW4gc3VidHJhY3Qgb2ZmIGl0cyBzdGFydGluZ1xuXHRcdFx0Ly8gdmFsdWUgYXQgdGhlIGVuZCB0byBvYnRhaW4gYGRlbHRhYC5cblx0XHRcdGZvciAob2xkaSA9IGksIHcgPSAxLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblxuXHRcdFx0XHRpZiAoaW5kZXggPj0gaW5wdXRMZW5ndGgpIHtcblx0XHRcdFx0XHRlcnJvcignaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGlnaXQgPSBiYXNpY1RvRGlnaXQoaW5wdXQuY2hhckNvZGVBdChpbmRleCsrKSk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0ID49IGJhc2UgfHwgZGlnaXQgPiBmbG9vcigobWF4SW50IC0gaSkgLyB3KSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aSArPSBkaWdpdCAqIHc7XG5cdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA8IHQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0aWYgKHcgPiBmbG9vcihtYXhJbnQgLyBiYXNlTWludXNUKSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dyAqPSBiYXNlTWludXNUO1xuXG5cdFx0XHR9XG5cblx0XHRcdG91dCA9IG91dHB1dC5sZW5ndGggKyAxO1xuXHRcdFx0YmlhcyA9IGFkYXB0KGkgLSBvbGRpLCBvdXQsIG9sZGkgPT0gMCk7XG5cblx0XHRcdC8vIGBpYCB3YXMgc3VwcG9zZWQgdG8gd3JhcCBhcm91bmQgZnJvbSBgb3V0YCB0byBgMGAsXG5cdFx0XHQvLyBpbmNyZW1lbnRpbmcgYG5gIGVhY2ggdGltZSwgc28gd2UnbGwgZml4IHRoYXQgbm93OlxuXHRcdFx0aWYgKGZsb29yKGkgLyBvdXQpID4gbWF4SW50IC0gbikge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0biArPSBmbG9vcihpIC8gb3V0KTtcblx0XHRcdGkgJT0gb3V0O1xuXG5cdFx0XHQvLyBJbnNlcnQgYG5gIGF0IHBvc2l0aW9uIGBpYCBvZiB0aGUgb3V0cHV0XG5cdFx0XHRvdXRwdXQuc3BsaWNlKGkrKywgMCwgbik7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdWNzMmVuY29kZShvdXRwdXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scyB0byBhIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5XG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZShpbnB1dCkge1xuXHRcdHZhciBuLFxuXHRcdCAgICBkZWx0YSxcblx0XHQgICAgaGFuZGxlZENQQ291bnQsXG5cdFx0ICAgIGJhc2ljTGVuZ3RoLFxuXHRcdCAgICBiaWFzLFxuXHRcdCAgICBqLFxuXHRcdCAgICBtLFxuXHRcdCAgICBxLFxuXHRcdCAgICBrLFxuXHRcdCAgICB0LFxuXHRcdCAgICBjdXJyZW50VmFsdWUsXG5cdFx0ICAgIG91dHB1dCA9IFtdLFxuXHRcdCAgICAvKiogYGlucHV0TGVuZ3RoYCB3aWxsIGhvbGQgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyBpbiBgaW5wdXRgLiAqL1xuXHRcdCAgICBpbnB1dExlbmd0aCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50UGx1c09uZSxcblx0XHQgICAgYmFzZU1pbnVzVCxcblx0XHQgICAgcU1pbnVzVDtcblxuXHRcdC8vIENvbnZlcnQgdGhlIGlucHV0IGluIFVDUy0yIHRvIFVuaWNvZGVcblx0XHRpbnB1dCA9IHVjczJkZWNvZGUoaW5wdXQpO1xuXG5cdFx0Ly8gQ2FjaGUgdGhlIGxlbmd0aFxuXHRcdGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSB0aGUgc3RhdGVcblx0XHRuID0gaW5pdGlhbE47XG5cdFx0ZGVsdGEgPSAwO1xuXHRcdGJpYXMgPSBpbml0aWFsQmlhcztcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHNcblx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgMHg4MCkge1xuXHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoY3VycmVudFZhbHVlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aGFuZGxlZENQQ291bnQgPSBiYXNpY0xlbmd0aCA9IG91dHB1dC5sZW5ndGg7XG5cblx0XHQvLyBgaGFuZGxlZENQQ291bnRgIGlzIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgdGhhdCBoYXZlIGJlZW4gaGFuZGxlZDtcblx0XHQvLyBgYmFzaWNMZW5ndGhgIGlzIHRoZSBudW1iZXIgb2YgYmFzaWMgY29kZSBwb2ludHMuXG5cblx0XHQvLyBGaW5pc2ggdGhlIGJhc2ljIHN0cmluZyAtIGlmIGl0IGlzIG5vdCBlbXB0eSAtIHdpdGggYSBkZWxpbWl0ZXJcblx0XHRpZiAoYmFzaWNMZW5ndGgpIHtcblx0XHRcdG91dHB1dC5wdXNoKGRlbGltaXRlcik7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBlbmNvZGluZyBsb29wOlxuXHRcdHdoaWxlIChoYW5kbGVkQ1BDb3VudCA8IGlucHV0TGVuZ3RoKSB7XG5cblx0XHRcdC8vIEFsbCBub24tYmFzaWMgY29kZSBwb2ludHMgPCBuIGhhdmUgYmVlbiBoYW5kbGVkIGFscmVhZHkuIEZpbmQgdGhlIG5leHRcblx0XHRcdC8vIGxhcmdlciBvbmU6XG5cdFx0XHRmb3IgKG0gPSBtYXhJbnQsIGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA+PSBuICYmIGN1cnJlbnRWYWx1ZSA8IG0pIHtcblx0XHRcdFx0XHRtID0gY3VycmVudFZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluY3JlYXNlIGBkZWx0YWAgZW5vdWdoIHRvIGFkdmFuY2UgdGhlIGRlY29kZXIncyA8bixpPiBzdGF0ZSB0byA8bSwwPixcblx0XHRcdC8vIGJ1dCBndWFyZCBhZ2FpbnN0IG92ZXJmbG93XG5cdFx0XHRoYW5kbGVkQ1BDb3VudFBsdXNPbmUgPSBoYW5kbGVkQ1BDb3VudCArIDE7XG5cdFx0XHRpZiAobSAtIG4gPiBmbG9vcigobWF4SW50IC0gZGVsdGEpIC8gaGFuZGxlZENQQ291bnRQbHVzT25lKSkge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsdGEgKz0gKG0gLSBuKSAqIGhhbmRsZWRDUENvdW50UGx1c09uZTtcblx0XHRcdG4gPSBtO1xuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgbiAmJiArK2RlbHRhID4gbWF4SW50KSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID09IG4pIHtcblx0XHRcdFx0XHQvLyBSZXByZXNlbnQgZGVsdGEgYXMgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlclxuXHRcdFx0XHRcdGZvciAocSA9IGRlbHRhLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblx0XHRcdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXHRcdFx0XHRcdFx0aWYgKHEgPCB0KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cU1pbnVzVCA9IHEgLSB0O1xuXHRcdFx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goXG5cdFx0XHRcdFx0XHRcdHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWModCArIHFNaW51c1QgJSBiYXNlTWludXNULCAwKSlcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRxID0gZmxvb3IocU1pbnVzVCAvIGJhc2VNaW51c1QpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWMocSwgMCkpKTtcblx0XHRcdFx0XHRiaWFzID0gYWRhcHQoZGVsdGEsIGhhbmRsZWRDUENvdW50UGx1c09uZSwgaGFuZGxlZENQQ291bnQgPT0gYmFzaWNMZW5ndGgpO1xuXHRcdFx0XHRcdGRlbHRhID0gMDtcblx0XHRcdFx0XHQrK2hhbmRsZWRDUENvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdCsrZGVsdGE7XG5cdFx0XHQrK247XG5cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dC5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSB0byBVbmljb2RlLiBPbmx5IHRoZVxuXHQgKiBQdW55Y29kZWQgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLCBpLmUuIGl0IGRvZXNuJ3Rcblx0ICogbWF0dGVyIGlmIHlvdSBjYWxsIGl0IG9uIGEgc3RyaW5nIHRoYXQgaGFzIGFscmVhZHkgYmVlbiBjb252ZXJ0ZWQgdG9cblx0ICogVW5pY29kZS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIFB1bnljb2RlIGRvbWFpbiBuYW1lIHRvIGNvbnZlcnQgdG8gVW5pY29kZS5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFVuaWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIFB1bnljb2RlXG5cdCAqIHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvVW5pY29kZShkb21haW4pIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGRvbWFpbiwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhQdW55Y29kZS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyBkZWNvZGUoc3RyaW5nLnNsaWNlKDQpLnRvTG93ZXJDYXNlKCkpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgVW5pY29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgdG8gUHVueWNvZGUuIE9ubHkgdGhlXG5cdCAqIG5vbi1BU0NJSSBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgd2lsbCBiZSBjb252ZXJ0ZWQsIGkuZS4gaXQgZG9lc24ndFxuXHQgKiBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgd2l0aCBhIGRvbWFpbiB0aGF0J3MgYWxyZWFkeSBpbiBBU0NJSS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lIHRvIGNvbnZlcnQsIGFzIGEgVW5pY29kZSBzdHJpbmcuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBQdW55Y29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gZG9tYWluIG5hbWUuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b0FTQ0lJKGRvbWFpbikge1xuXHRcdHJldHVybiBtYXBEb21haW4oZG9tYWluLCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleE5vbkFTQ0lJLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/ICd4bi0tJyArIGVuY29kZShzdHJpbmcpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqIERlZmluZSB0aGUgcHVibGljIEFQSSAqL1xuXHRwdW55Y29kZSA9IHtcblx0XHQvKipcblx0XHQgKiBBIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGN1cnJlbnQgUHVueWNvZGUuanMgdmVyc2lvbiBudW1iZXIuXG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgU3RyaW5nXG5cdFx0ICovXG5cdFx0J3ZlcnNpb24nOiAnMS4yLjQnLFxuXHRcdC8qKlxuXHRcdCAqIEFuIG9iamVjdCBvZiBtZXRob2RzIHRvIGNvbnZlcnQgZnJvbSBKYXZhU2NyaXB0J3MgaW50ZXJuYWwgY2hhcmFjdGVyXG5cdFx0ICogcmVwcmVzZW50YXRpb24gKFVDUy0yKSB0byBVbmljb2RlIGNvZGUgcG9pbnRzLCBhbmQgYmFjay5cblx0XHQgKiBAc2VlIDxodHRwOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIE9iamVjdFxuXHRcdCAqL1xuXHRcdCd1Y3MyJzoge1xuXHRcdFx0J2RlY29kZSc6IHVjczJkZWNvZGUsXG5cdFx0XHQnZW5jb2RlJzogdWNzMmVuY29kZVxuXHRcdH0sXG5cdFx0J2RlY29kZSc6IGRlY29kZSxcblx0XHQnZW5jb2RlJzogZW5jb2RlLFxuXHRcdCd0b0FTQ0lJJzogdG9BU0NJSSxcblx0XHQndG9Vbmljb2RlJzogdG9Vbmljb2RlXG5cdH07XG5cblx0LyoqIEV4cG9zZSBgcHVueWNvZGVgICovXG5cdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHQvLyBsaWtlIHRoZSBmb2xsb3dpbmc6XG5cdGlmIChcblx0XHR0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiZcblx0XHR0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJlxuXHRcdGRlZmluZS5hbWRcblx0KSB7XG5cdFx0ZGVmaW5lKCdwdW55Y29kZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHB1bnljb2RlO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmICFmcmVlRXhwb3J0cy5ub2RlVHlwZSkge1xuXHRcdGlmIChmcmVlTW9kdWxlKSB7IC8vIGluIE5vZGUuanMgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSBwdW55Y29kZTtcblx0XHR9IGVsc2UgeyAvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yIChrZXkgaW4gcHVueWNvZGUpIHtcblx0XHRcdFx0cHVueWNvZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHB1bnljb2RlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHsgLy8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdHJvb3QucHVueWNvZGUgPSBwdW55Y29kZTtcblx0fVxuXG59KHRoaXMpKTtcbiIsInZhciBwdW55Y29kZSA9IHJlcXVpcmUoJ3B1bnljb2RlJyk7XG52YXIgcmV2RW50aXRpZXMgPSByZXF1aXJlKCcuL3JldmVyc2VkLmpzb24nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBlbmNvZGU7XG5cbmZ1bmN0aW9uIGVuY29kZSAoc3RyLCBvcHRzKSB7XG4gICAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGEgU3RyaW5nJyk7XG4gICAgfVxuICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuXG4gICAgdmFyIG51bWVyaWMgPSB0cnVlO1xuICAgIGlmIChvcHRzLm5hbWVkKSBudW1lcmljID0gZmFsc2U7XG4gICAgaWYgKG9wdHMubnVtZXJpYyAhPT0gdW5kZWZpbmVkKSBudW1lcmljID0gb3B0cy5udW1lcmljO1xuXG4gICAgdmFyIHNwZWNpYWwgPSBvcHRzLnNwZWNpYWwgfHwge1xuICAgICAgICAnXCInOiB0cnVlLCBcIidcIjogdHJ1ZSxcbiAgICAgICAgJzwnOiB0cnVlLCAnPic6IHRydWUsXG4gICAgICAgICcmJzogdHJ1ZVxuICAgIH07XG5cbiAgICB2YXIgY29kZVBvaW50cyA9IHB1bnljb2RlLnVjczIuZGVjb2RlKHN0cik7XG4gICAgdmFyIGNoYXJzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2RlUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjYyA9IGNvZGVQb2ludHNbaV07XG4gICAgICAgIHZhciBjID0gcHVueWNvZGUudWNzMi5lbmNvZGUoWyBjYyBdKTtcbiAgICAgICAgdmFyIGUgPSByZXZFbnRpdGllc1tjY107XG4gICAgICAgIGlmIChlICYmIChjYyA+PSAxMjcgfHwgc3BlY2lhbFtjXSkgJiYgIW51bWVyaWMpIHtcbiAgICAgICAgICAgIGNoYXJzLnB1c2goJyYnICsgKC87JC8udGVzdChlKSA/IGUgOiBlICsgJzsnKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2MgPCAzMiB8fCBjYyA+PSAxMjcgfHwgc3BlY2lhbFtjXSkge1xuICAgICAgICAgICAgY2hhcnMucHVzaCgnJiMnICsgY2MgKyAnOycpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2hhcnMucHVzaChjKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY2hhcnMuam9pbignJyk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gICAgXCI5XCI6IFwiVGFiO1wiLFxuICAgIFwiMTBcIjogXCJOZXdMaW5lO1wiLFxuICAgIFwiMzNcIjogXCJleGNsO1wiLFxuICAgIFwiMzRcIjogXCJxdW90O1wiLFxuICAgIFwiMzVcIjogXCJudW07XCIsXG4gICAgXCIzNlwiOiBcImRvbGxhcjtcIixcbiAgICBcIjM3XCI6IFwicGVyY250O1wiLFxuICAgIFwiMzhcIjogXCJhbXA7XCIsXG4gICAgXCIzOVwiOiBcImFwb3M7XCIsXG4gICAgXCI0MFwiOiBcImxwYXI7XCIsXG4gICAgXCI0MVwiOiBcInJwYXI7XCIsXG4gICAgXCI0MlwiOiBcIm1pZGFzdDtcIixcbiAgICBcIjQzXCI6IFwicGx1cztcIixcbiAgICBcIjQ0XCI6IFwiY29tbWE7XCIsXG4gICAgXCI0NlwiOiBcInBlcmlvZDtcIixcbiAgICBcIjQ3XCI6IFwic29sO1wiLFxuICAgIFwiNThcIjogXCJjb2xvbjtcIixcbiAgICBcIjU5XCI6IFwic2VtaTtcIixcbiAgICBcIjYwXCI6IFwibHQ7XCIsXG4gICAgXCI2MVwiOiBcImVxdWFscztcIixcbiAgICBcIjYyXCI6IFwiZ3Q7XCIsXG4gICAgXCI2M1wiOiBcInF1ZXN0O1wiLFxuICAgIFwiNjRcIjogXCJjb21tYXQ7XCIsXG4gICAgXCI5MVwiOiBcImxzcWI7XCIsXG4gICAgXCI5MlwiOiBcImJzb2w7XCIsXG4gICAgXCI5M1wiOiBcInJzcWI7XCIsXG4gICAgXCI5NFwiOiBcIkhhdDtcIixcbiAgICBcIjk1XCI6IFwiVW5kZXJCYXI7XCIsXG4gICAgXCI5NlwiOiBcImdyYXZlO1wiLFxuICAgIFwiMTIzXCI6IFwibGN1YjtcIixcbiAgICBcIjEyNFwiOiBcIlZlcnRpY2FsTGluZTtcIixcbiAgICBcIjEyNVwiOiBcInJjdWI7XCIsXG4gICAgXCIxNjBcIjogXCJOb25CcmVha2luZ1NwYWNlO1wiLFxuICAgIFwiMTYxXCI6IFwiaWV4Y2w7XCIsXG4gICAgXCIxNjJcIjogXCJjZW50O1wiLFxuICAgIFwiMTYzXCI6IFwicG91bmQ7XCIsXG4gICAgXCIxNjRcIjogXCJjdXJyZW47XCIsXG4gICAgXCIxNjVcIjogXCJ5ZW47XCIsXG4gICAgXCIxNjZcIjogXCJicnZiYXI7XCIsXG4gICAgXCIxNjdcIjogXCJzZWN0O1wiLFxuICAgIFwiMTY4XCI6IFwidW1sO1wiLFxuICAgIFwiMTY5XCI6IFwiY29weTtcIixcbiAgICBcIjE3MFwiOiBcIm9yZGY7XCIsXG4gICAgXCIxNzFcIjogXCJsYXF1bztcIixcbiAgICBcIjE3MlwiOiBcIm5vdDtcIixcbiAgICBcIjE3M1wiOiBcInNoeTtcIixcbiAgICBcIjE3NFwiOiBcInJlZztcIixcbiAgICBcIjE3NVwiOiBcInN0cm5zO1wiLFxuICAgIFwiMTc2XCI6IFwiZGVnO1wiLFxuICAgIFwiMTc3XCI6IFwicG07XCIsXG4gICAgXCIxNzhcIjogXCJzdXAyO1wiLFxuICAgIFwiMTc5XCI6IFwic3VwMztcIixcbiAgICBcIjE4MFwiOiBcIkRpYWNyaXRpY2FsQWN1dGU7XCIsXG4gICAgXCIxODFcIjogXCJtaWNybztcIixcbiAgICBcIjE4MlwiOiBcInBhcmE7XCIsXG4gICAgXCIxODNcIjogXCJtaWRkb3Q7XCIsXG4gICAgXCIxODRcIjogXCJDZWRpbGxhO1wiLFxuICAgIFwiMTg1XCI6IFwic3VwMTtcIixcbiAgICBcIjE4NlwiOiBcIm9yZG07XCIsXG4gICAgXCIxODdcIjogXCJyYXF1bztcIixcbiAgICBcIjE4OFwiOiBcImZyYWMxNDtcIixcbiAgICBcIjE4OVwiOiBcImhhbGY7XCIsXG4gICAgXCIxOTBcIjogXCJmcmFjMzQ7XCIsXG4gICAgXCIxOTFcIjogXCJpcXVlc3Q7XCIsXG4gICAgXCIxOTJcIjogXCJBZ3JhdmU7XCIsXG4gICAgXCIxOTNcIjogXCJBYWN1dGU7XCIsXG4gICAgXCIxOTRcIjogXCJBY2lyYztcIixcbiAgICBcIjE5NVwiOiBcIkF0aWxkZTtcIixcbiAgICBcIjE5NlwiOiBcIkF1bWw7XCIsXG4gICAgXCIxOTdcIjogXCJBcmluZztcIixcbiAgICBcIjE5OFwiOiBcIkFFbGlnO1wiLFxuICAgIFwiMTk5XCI6IFwiQ2NlZGlsO1wiLFxuICAgIFwiMjAwXCI6IFwiRWdyYXZlO1wiLFxuICAgIFwiMjAxXCI6IFwiRWFjdXRlO1wiLFxuICAgIFwiMjAyXCI6IFwiRWNpcmM7XCIsXG4gICAgXCIyMDNcIjogXCJFdW1sO1wiLFxuICAgIFwiMjA0XCI6IFwiSWdyYXZlO1wiLFxuICAgIFwiMjA1XCI6IFwiSWFjdXRlO1wiLFxuICAgIFwiMjA2XCI6IFwiSWNpcmM7XCIsXG4gICAgXCIyMDdcIjogXCJJdW1sO1wiLFxuICAgIFwiMjA4XCI6IFwiRVRIO1wiLFxuICAgIFwiMjA5XCI6IFwiTnRpbGRlO1wiLFxuICAgIFwiMjEwXCI6IFwiT2dyYXZlO1wiLFxuICAgIFwiMjExXCI6IFwiT2FjdXRlO1wiLFxuICAgIFwiMjEyXCI6IFwiT2NpcmM7XCIsXG4gICAgXCIyMTNcIjogXCJPdGlsZGU7XCIsXG4gICAgXCIyMTRcIjogXCJPdW1sO1wiLFxuICAgIFwiMjE1XCI6IFwidGltZXM7XCIsXG4gICAgXCIyMTZcIjogXCJPc2xhc2g7XCIsXG4gICAgXCIyMTdcIjogXCJVZ3JhdmU7XCIsXG4gICAgXCIyMThcIjogXCJVYWN1dGU7XCIsXG4gICAgXCIyMTlcIjogXCJVY2lyYztcIixcbiAgICBcIjIyMFwiOiBcIlV1bWw7XCIsXG4gICAgXCIyMjFcIjogXCJZYWN1dGU7XCIsXG4gICAgXCIyMjJcIjogXCJUSE9STjtcIixcbiAgICBcIjIyM1wiOiBcInN6bGlnO1wiLFxuICAgIFwiMjI0XCI6IFwiYWdyYXZlO1wiLFxuICAgIFwiMjI1XCI6IFwiYWFjdXRlO1wiLFxuICAgIFwiMjI2XCI6IFwiYWNpcmM7XCIsXG4gICAgXCIyMjdcIjogXCJhdGlsZGU7XCIsXG4gICAgXCIyMjhcIjogXCJhdW1sO1wiLFxuICAgIFwiMjI5XCI6IFwiYXJpbmc7XCIsXG4gICAgXCIyMzBcIjogXCJhZWxpZztcIixcbiAgICBcIjIzMVwiOiBcImNjZWRpbDtcIixcbiAgICBcIjIzMlwiOiBcImVncmF2ZTtcIixcbiAgICBcIjIzM1wiOiBcImVhY3V0ZTtcIixcbiAgICBcIjIzNFwiOiBcImVjaXJjO1wiLFxuICAgIFwiMjM1XCI6IFwiZXVtbDtcIixcbiAgICBcIjIzNlwiOiBcImlncmF2ZTtcIixcbiAgICBcIjIzN1wiOiBcImlhY3V0ZTtcIixcbiAgICBcIjIzOFwiOiBcImljaXJjO1wiLFxuICAgIFwiMjM5XCI6IFwiaXVtbDtcIixcbiAgICBcIjI0MFwiOiBcImV0aDtcIixcbiAgICBcIjI0MVwiOiBcIm50aWxkZTtcIixcbiAgICBcIjI0MlwiOiBcIm9ncmF2ZTtcIixcbiAgICBcIjI0M1wiOiBcIm9hY3V0ZTtcIixcbiAgICBcIjI0NFwiOiBcIm9jaXJjO1wiLFxuICAgIFwiMjQ1XCI6IFwib3RpbGRlO1wiLFxuICAgIFwiMjQ2XCI6IFwib3VtbDtcIixcbiAgICBcIjI0N1wiOiBcImRpdmlkZTtcIixcbiAgICBcIjI0OFwiOiBcIm9zbGFzaDtcIixcbiAgICBcIjI0OVwiOiBcInVncmF2ZTtcIixcbiAgICBcIjI1MFwiOiBcInVhY3V0ZTtcIixcbiAgICBcIjI1MVwiOiBcInVjaXJjO1wiLFxuICAgIFwiMjUyXCI6IFwidXVtbDtcIixcbiAgICBcIjI1M1wiOiBcInlhY3V0ZTtcIixcbiAgICBcIjI1NFwiOiBcInRob3JuO1wiLFxuICAgIFwiMjU1XCI6IFwieXVtbDtcIixcbiAgICBcIjI1NlwiOiBcIkFtYWNyO1wiLFxuICAgIFwiMjU3XCI6IFwiYW1hY3I7XCIsXG4gICAgXCIyNThcIjogXCJBYnJldmU7XCIsXG4gICAgXCIyNTlcIjogXCJhYnJldmU7XCIsXG4gICAgXCIyNjBcIjogXCJBb2dvbjtcIixcbiAgICBcIjI2MVwiOiBcImFvZ29uO1wiLFxuICAgIFwiMjYyXCI6IFwiQ2FjdXRlO1wiLFxuICAgIFwiMjYzXCI6IFwiY2FjdXRlO1wiLFxuICAgIFwiMjY0XCI6IFwiQ2NpcmM7XCIsXG4gICAgXCIyNjVcIjogXCJjY2lyYztcIixcbiAgICBcIjI2NlwiOiBcIkNkb3Q7XCIsXG4gICAgXCIyNjdcIjogXCJjZG90O1wiLFxuICAgIFwiMjY4XCI6IFwiQ2Nhcm9uO1wiLFxuICAgIFwiMjY5XCI6IFwiY2Nhcm9uO1wiLFxuICAgIFwiMjcwXCI6IFwiRGNhcm9uO1wiLFxuICAgIFwiMjcxXCI6IFwiZGNhcm9uO1wiLFxuICAgIFwiMjcyXCI6IFwiRHN0cm9rO1wiLFxuICAgIFwiMjczXCI6IFwiZHN0cm9rO1wiLFxuICAgIFwiMjc0XCI6IFwiRW1hY3I7XCIsXG4gICAgXCIyNzVcIjogXCJlbWFjcjtcIixcbiAgICBcIjI3OFwiOiBcIkVkb3Q7XCIsXG4gICAgXCIyNzlcIjogXCJlZG90O1wiLFxuICAgIFwiMjgwXCI6IFwiRW9nb247XCIsXG4gICAgXCIyODFcIjogXCJlb2dvbjtcIixcbiAgICBcIjI4MlwiOiBcIkVjYXJvbjtcIixcbiAgICBcIjI4M1wiOiBcImVjYXJvbjtcIixcbiAgICBcIjI4NFwiOiBcIkdjaXJjO1wiLFxuICAgIFwiMjg1XCI6IFwiZ2NpcmM7XCIsXG4gICAgXCIyODZcIjogXCJHYnJldmU7XCIsXG4gICAgXCIyODdcIjogXCJnYnJldmU7XCIsXG4gICAgXCIyODhcIjogXCJHZG90O1wiLFxuICAgIFwiMjg5XCI6IFwiZ2RvdDtcIixcbiAgICBcIjI5MFwiOiBcIkdjZWRpbDtcIixcbiAgICBcIjI5MlwiOiBcIkhjaXJjO1wiLFxuICAgIFwiMjkzXCI6IFwiaGNpcmM7XCIsXG4gICAgXCIyOTRcIjogXCJIc3Ryb2s7XCIsXG4gICAgXCIyOTVcIjogXCJoc3Ryb2s7XCIsXG4gICAgXCIyOTZcIjogXCJJdGlsZGU7XCIsXG4gICAgXCIyOTdcIjogXCJpdGlsZGU7XCIsXG4gICAgXCIyOThcIjogXCJJbWFjcjtcIixcbiAgICBcIjI5OVwiOiBcImltYWNyO1wiLFxuICAgIFwiMzAyXCI6IFwiSW9nb247XCIsXG4gICAgXCIzMDNcIjogXCJpb2dvbjtcIixcbiAgICBcIjMwNFwiOiBcIklkb3Q7XCIsXG4gICAgXCIzMDVcIjogXCJpbm9kb3Q7XCIsXG4gICAgXCIzMDZcIjogXCJJSmxpZztcIixcbiAgICBcIjMwN1wiOiBcImlqbGlnO1wiLFxuICAgIFwiMzA4XCI6IFwiSmNpcmM7XCIsXG4gICAgXCIzMDlcIjogXCJqY2lyYztcIixcbiAgICBcIjMxMFwiOiBcIktjZWRpbDtcIixcbiAgICBcIjMxMVwiOiBcImtjZWRpbDtcIixcbiAgICBcIjMxMlwiOiBcImtncmVlbjtcIixcbiAgICBcIjMxM1wiOiBcIkxhY3V0ZTtcIixcbiAgICBcIjMxNFwiOiBcImxhY3V0ZTtcIixcbiAgICBcIjMxNVwiOiBcIkxjZWRpbDtcIixcbiAgICBcIjMxNlwiOiBcImxjZWRpbDtcIixcbiAgICBcIjMxN1wiOiBcIkxjYXJvbjtcIixcbiAgICBcIjMxOFwiOiBcImxjYXJvbjtcIixcbiAgICBcIjMxOVwiOiBcIkxtaWRvdDtcIixcbiAgICBcIjMyMFwiOiBcImxtaWRvdDtcIixcbiAgICBcIjMyMVwiOiBcIkxzdHJvaztcIixcbiAgICBcIjMyMlwiOiBcImxzdHJvaztcIixcbiAgICBcIjMyM1wiOiBcIk5hY3V0ZTtcIixcbiAgICBcIjMyNFwiOiBcIm5hY3V0ZTtcIixcbiAgICBcIjMyNVwiOiBcIk5jZWRpbDtcIixcbiAgICBcIjMyNlwiOiBcIm5jZWRpbDtcIixcbiAgICBcIjMyN1wiOiBcIk5jYXJvbjtcIixcbiAgICBcIjMyOFwiOiBcIm5jYXJvbjtcIixcbiAgICBcIjMyOVwiOiBcIm5hcG9zO1wiLFxuICAgIFwiMzMwXCI6IFwiRU5HO1wiLFxuICAgIFwiMzMxXCI6IFwiZW5nO1wiLFxuICAgIFwiMzMyXCI6IFwiT21hY3I7XCIsXG4gICAgXCIzMzNcIjogXCJvbWFjcjtcIixcbiAgICBcIjMzNlwiOiBcIk9kYmxhYztcIixcbiAgICBcIjMzN1wiOiBcIm9kYmxhYztcIixcbiAgICBcIjMzOFwiOiBcIk9FbGlnO1wiLFxuICAgIFwiMzM5XCI6IFwib2VsaWc7XCIsXG4gICAgXCIzNDBcIjogXCJSYWN1dGU7XCIsXG4gICAgXCIzNDFcIjogXCJyYWN1dGU7XCIsXG4gICAgXCIzNDJcIjogXCJSY2VkaWw7XCIsXG4gICAgXCIzNDNcIjogXCJyY2VkaWw7XCIsXG4gICAgXCIzNDRcIjogXCJSY2Fyb247XCIsXG4gICAgXCIzNDVcIjogXCJyY2Fyb247XCIsXG4gICAgXCIzNDZcIjogXCJTYWN1dGU7XCIsXG4gICAgXCIzNDdcIjogXCJzYWN1dGU7XCIsXG4gICAgXCIzNDhcIjogXCJTY2lyYztcIixcbiAgICBcIjM0OVwiOiBcInNjaXJjO1wiLFxuICAgIFwiMzUwXCI6IFwiU2NlZGlsO1wiLFxuICAgIFwiMzUxXCI6IFwic2NlZGlsO1wiLFxuICAgIFwiMzUyXCI6IFwiU2Nhcm9uO1wiLFxuICAgIFwiMzUzXCI6IFwic2Nhcm9uO1wiLFxuICAgIFwiMzU0XCI6IFwiVGNlZGlsO1wiLFxuICAgIFwiMzU1XCI6IFwidGNlZGlsO1wiLFxuICAgIFwiMzU2XCI6IFwiVGNhcm9uO1wiLFxuICAgIFwiMzU3XCI6IFwidGNhcm9uO1wiLFxuICAgIFwiMzU4XCI6IFwiVHN0cm9rO1wiLFxuICAgIFwiMzU5XCI6IFwidHN0cm9rO1wiLFxuICAgIFwiMzYwXCI6IFwiVXRpbGRlO1wiLFxuICAgIFwiMzYxXCI6IFwidXRpbGRlO1wiLFxuICAgIFwiMzYyXCI6IFwiVW1hY3I7XCIsXG4gICAgXCIzNjNcIjogXCJ1bWFjcjtcIixcbiAgICBcIjM2NFwiOiBcIlVicmV2ZTtcIixcbiAgICBcIjM2NVwiOiBcInVicmV2ZTtcIixcbiAgICBcIjM2NlwiOiBcIlVyaW5nO1wiLFxuICAgIFwiMzY3XCI6IFwidXJpbmc7XCIsXG4gICAgXCIzNjhcIjogXCJVZGJsYWM7XCIsXG4gICAgXCIzNjlcIjogXCJ1ZGJsYWM7XCIsXG4gICAgXCIzNzBcIjogXCJVb2dvbjtcIixcbiAgICBcIjM3MVwiOiBcInVvZ29uO1wiLFxuICAgIFwiMzcyXCI6IFwiV2NpcmM7XCIsXG4gICAgXCIzNzNcIjogXCJ3Y2lyYztcIixcbiAgICBcIjM3NFwiOiBcIlljaXJjO1wiLFxuICAgIFwiMzc1XCI6IFwieWNpcmM7XCIsXG4gICAgXCIzNzZcIjogXCJZdW1sO1wiLFxuICAgIFwiMzc3XCI6IFwiWmFjdXRlO1wiLFxuICAgIFwiMzc4XCI6IFwiemFjdXRlO1wiLFxuICAgIFwiMzc5XCI6IFwiWmRvdDtcIixcbiAgICBcIjM4MFwiOiBcInpkb3Q7XCIsXG4gICAgXCIzODFcIjogXCJaY2Fyb247XCIsXG4gICAgXCIzODJcIjogXCJ6Y2Fyb247XCIsXG4gICAgXCI0MDJcIjogXCJmbm9mO1wiLFxuICAgIFwiNDM3XCI6IFwiaW1wZWQ7XCIsXG4gICAgXCI1MDFcIjogXCJnYWN1dGU7XCIsXG4gICAgXCI1NjdcIjogXCJqbWF0aDtcIixcbiAgICBcIjcxMFwiOiBcImNpcmM7XCIsXG4gICAgXCI3MTFcIjogXCJIYWNlaztcIixcbiAgICBcIjcyOFwiOiBcImJyZXZlO1wiLFxuICAgIFwiNzI5XCI6IFwiZG90O1wiLFxuICAgIFwiNzMwXCI6IFwicmluZztcIixcbiAgICBcIjczMVwiOiBcIm9nb247XCIsXG4gICAgXCI3MzJcIjogXCJ0aWxkZTtcIixcbiAgICBcIjczM1wiOiBcIkRpYWNyaXRpY2FsRG91YmxlQWN1dGU7XCIsXG4gICAgXCI3ODVcIjogXCJEb3duQnJldmU7XCIsXG4gICAgXCI5MTNcIjogXCJBbHBoYTtcIixcbiAgICBcIjkxNFwiOiBcIkJldGE7XCIsXG4gICAgXCI5MTVcIjogXCJHYW1tYTtcIixcbiAgICBcIjkxNlwiOiBcIkRlbHRhO1wiLFxuICAgIFwiOTE3XCI6IFwiRXBzaWxvbjtcIixcbiAgICBcIjkxOFwiOiBcIlpldGE7XCIsXG4gICAgXCI5MTlcIjogXCJFdGE7XCIsXG4gICAgXCI5MjBcIjogXCJUaGV0YTtcIixcbiAgICBcIjkyMVwiOiBcIklvdGE7XCIsXG4gICAgXCI5MjJcIjogXCJLYXBwYTtcIixcbiAgICBcIjkyM1wiOiBcIkxhbWJkYTtcIixcbiAgICBcIjkyNFwiOiBcIk11O1wiLFxuICAgIFwiOTI1XCI6IFwiTnU7XCIsXG4gICAgXCI5MjZcIjogXCJYaTtcIixcbiAgICBcIjkyN1wiOiBcIk9taWNyb247XCIsXG4gICAgXCI5MjhcIjogXCJQaTtcIixcbiAgICBcIjkyOVwiOiBcIlJobztcIixcbiAgICBcIjkzMVwiOiBcIlNpZ21hO1wiLFxuICAgIFwiOTMyXCI6IFwiVGF1O1wiLFxuICAgIFwiOTMzXCI6IFwiVXBzaWxvbjtcIixcbiAgICBcIjkzNFwiOiBcIlBoaTtcIixcbiAgICBcIjkzNVwiOiBcIkNoaTtcIixcbiAgICBcIjkzNlwiOiBcIlBzaTtcIixcbiAgICBcIjkzN1wiOiBcIk9tZWdhO1wiLFxuICAgIFwiOTQ1XCI6IFwiYWxwaGE7XCIsXG4gICAgXCI5NDZcIjogXCJiZXRhO1wiLFxuICAgIFwiOTQ3XCI6IFwiZ2FtbWE7XCIsXG4gICAgXCI5NDhcIjogXCJkZWx0YTtcIixcbiAgICBcIjk0OVwiOiBcImVwc2lsb247XCIsXG4gICAgXCI5NTBcIjogXCJ6ZXRhO1wiLFxuICAgIFwiOTUxXCI6IFwiZXRhO1wiLFxuICAgIFwiOTUyXCI6IFwidGhldGE7XCIsXG4gICAgXCI5NTNcIjogXCJpb3RhO1wiLFxuICAgIFwiOTU0XCI6IFwia2FwcGE7XCIsXG4gICAgXCI5NTVcIjogXCJsYW1iZGE7XCIsXG4gICAgXCI5NTZcIjogXCJtdTtcIixcbiAgICBcIjk1N1wiOiBcIm51O1wiLFxuICAgIFwiOTU4XCI6IFwieGk7XCIsXG4gICAgXCI5NTlcIjogXCJvbWljcm9uO1wiLFxuICAgIFwiOTYwXCI6IFwicGk7XCIsXG4gICAgXCI5NjFcIjogXCJyaG87XCIsXG4gICAgXCI5NjJcIjogXCJ2YXJzaWdtYTtcIixcbiAgICBcIjk2M1wiOiBcInNpZ21hO1wiLFxuICAgIFwiOTY0XCI6IFwidGF1O1wiLFxuICAgIFwiOTY1XCI6IFwidXBzaWxvbjtcIixcbiAgICBcIjk2NlwiOiBcInBoaTtcIixcbiAgICBcIjk2N1wiOiBcImNoaTtcIixcbiAgICBcIjk2OFwiOiBcInBzaTtcIixcbiAgICBcIjk2OVwiOiBcIm9tZWdhO1wiLFxuICAgIFwiOTc3XCI6IFwidmFydGhldGE7XCIsXG4gICAgXCI5NzhcIjogXCJ1cHNpaDtcIixcbiAgICBcIjk4MVwiOiBcInZhcnBoaTtcIixcbiAgICBcIjk4MlwiOiBcInZhcnBpO1wiLFxuICAgIFwiOTg4XCI6IFwiR2FtbWFkO1wiLFxuICAgIFwiOTg5XCI6IFwiZ2FtbWFkO1wiLFxuICAgIFwiMTAwOFwiOiBcInZhcmthcHBhO1wiLFxuICAgIFwiMTAwOVwiOiBcInZhcnJobztcIixcbiAgICBcIjEwMTNcIjogXCJ2YXJlcHNpbG9uO1wiLFxuICAgIFwiMTAxNFwiOiBcImJlcHNpO1wiLFxuICAgIFwiMTAyNVwiOiBcIklPY3k7XCIsXG4gICAgXCIxMDI2XCI6IFwiREpjeTtcIixcbiAgICBcIjEwMjdcIjogXCJHSmN5O1wiLFxuICAgIFwiMTAyOFwiOiBcIkp1a2N5O1wiLFxuICAgIFwiMTAyOVwiOiBcIkRTY3k7XCIsXG4gICAgXCIxMDMwXCI6IFwiSXVrY3k7XCIsXG4gICAgXCIxMDMxXCI6IFwiWUljeTtcIixcbiAgICBcIjEwMzJcIjogXCJKc2VyY3k7XCIsXG4gICAgXCIxMDMzXCI6IFwiTEpjeTtcIixcbiAgICBcIjEwMzRcIjogXCJOSmN5O1wiLFxuICAgIFwiMTAzNVwiOiBcIlRTSGN5O1wiLFxuICAgIFwiMTAzNlwiOiBcIktKY3k7XCIsXG4gICAgXCIxMDM4XCI6IFwiVWJyY3k7XCIsXG4gICAgXCIxMDM5XCI6IFwiRFpjeTtcIixcbiAgICBcIjEwNDBcIjogXCJBY3k7XCIsXG4gICAgXCIxMDQxXCI6IFwiQmN5O1wiLFxuICAgIFwiMTA0MlwiOiBcIlZjeTtcIixcbiAgICBcIjEwNDNcIjogXCJHY3k7XCIsXG4gICAgXCIxMDQ0XCI6IFwiRGN5O1wiLFxuICAgIFwiMTA0NVwiOiBcIklFY3k7XCIsXG4gICAgXCIxMDQ2XCI6IFwiWkhjeTtcIixcbiAgICBcIjEwNDdcIjogXCJaY3k7XCIsXG4gICAgXCIxMDQ4XCI6IFwiSWN5O1wiLFxuICAgIFwiMTA0OVwiOiBcIkpjeTtcIixcbiAgICBcIjEwNTBcIjogXCJLY3k7XCIsXG4gICAgXCIxMDUxXCI6IFwiTGN5O1wiLFxuICAgIFwiMTA1MlwiOiBcIk1jeTtcIixcbiAgICBcIjEwNTNcIjogXCJOY3k7XCIsXG4gICAgXCIxMDU0XCI6IFwiT2N5O1wiLFxuICAgIFwiMTA1NVwiOiBcIlBjeTtcIixcbiAgICBcIjEwNTZcIjogXCJSY3k7XCIsXG4gICAgXCIxMDU3XCI6IFwiU2N5O1wiLFxuICAgIFwiMTA1OFwiOiBcIlRjeTtcIixcbiAgICBcIjEwNTlcIjogXCJVY3k7XCIsXG4gICAgXCIxMDYwXCI6IFwiRmN5O1wiLFxuICAgIFwiMTA2MVwiOiBcIktIY3k7XCIsXG4gICAgXCIxMDYyXCI6IFwiVFNjeTtcIixcbiAgICBcIjEwNjNcIjogXCJDSGN5O1wiLFxuICAgIFwiMTA2NFwiOiBcIlNIY3k7XCIsXG4gICAgXCIxMDY1XCI6IFwiU0hDSGN5O1wiLFxuICAgIFwiMTA2NlwiOiBcIkhBUkRjeTtcIixcbiAgICBcIjEwNjdcIjogXCJZY3k7XCIsXG4gICAgXCIxMDY4XCI6IFwiU09GVGN5O1wiLFxuICAgIFwiMTA2OVwiOiBcIkVjeTtcIixcbiAgICBcIjEwNzBcIjogXCJZVWN5O1wiLFxuICAgIFwiMTA3MVwiOiBcIllBY3k7XCIsXG4gICAgXCIxMDcyXCI6IFwiYWN5O1wiLFxuICAgIFwiMTA3M1wiOiBcImJjeTtcIixcbiAgICBcIjEwNzRcIjogXCJ2Y3k7XCIsXG4gICAgXCIxMDc1XCI6IFwiZ2N5O1wiLFxuICAgIFwiMTA3NlwiOiBcImRjeTtcIixcbiAgICBcIjEwNzdcIjogXCJpZWN5O1wiLFxuICAgIFwiMTA3OFwiOiBcInpoY3k7XCIsXG4gICAgXCIxMDc5XCI6IFwiemN5O1wiLFxuICAgIFwiMTA4MFwiOiBcImljeTtcIixcbiAgICBcIjEwODFcIjogXCJqY3k7XCIsXG4gICAgXCIxMDgyXCI6IFwia2N5O1wiLFxuICAgIFwiMTA4M1wiOiBcImxjeTtcIixcbiAgICBcIjEwODRcIjogXCJtY3k7XCIsXG4gICAgXCIxMDg1XCI6IFwibmN5O1wiLFxuICAgIFwiMTA4NlwiOiBcIm9jeTtcIixcbiAgICBcIjEwODdcIjogXCJwY3k7XCIsXG4gICAgXCIxMDg4XCI6IFwicmN5O1wiLFxuICAgIFwiMTA4OVwiOiBcInNjeTtcIixcbiAgICBcIjEwOTBcIjogXCJ0Y3k7XCIsXG4gICAgXCIxMDkxXCI6IFwidWN5O1wiLFxuICAgIFwiMTA5MlwiOiBcImZjeTtcIixcbiAgICBcIjEwOTNcIjogXCJraGN5O1wiLFxuICAgIFwiMTA5NFwiOiBcInRzY3k7XCIsXG4gICAgXCIxMDk1XCI6IFwiY2hjeTtcIixcbiAgICBcIjEwOTZcIjogXCJzaGN5O1wiLFxuICAgIFwiMTA5N1wiOiBcInNoY2hjeTtcIixcbiAgICBcIjEwOThcIjogXCJoYXJkY3k7XCIsXG4gICAgXCIxMDk5XCI6IFwieWN5O1wiLFxuICAgIFwiMTEwMFwiOiBcInNvZnRjeTtcIixcbiAgICBcIjExMDFcIjogXCJlY3k7XCIsXG4gICAgXCIxMTAyXCI6IFwieXVjeTtcIixcbiAgICBcIjExMDNcIjogXCJ5YWN5O1wiLFxuICAgIFwiMTEwNVwiOiBcImlvY3k7XCIsXG4gICAgXCIxMTA2XCI6IFwiZGpjeTtcIixcbiAgICBcIjExMDdcIjogXCJnamN5O1wiLFxuICAgIFwiMTEwOFwiOiBcImp1a2N5O1wiLFxuICAgIFwiMTEwOVwiOiBcImRzY3k7XCIsXG4gICAgXCIxMTEwXCI6IFwiaXVrY3k7XCIsXG4gICAgXCIxMTExXCI6IFwieWljeTtcIixcbiAgICBcIjExMTJcIjogXCJqc2VyY3k7XCIsXG4gICAgXCIxMTEzXCI6IFwibGpjeTtcIixcbiAgICBcIjExMTRcIjogXCJuamN5O1wiLFxuICAgIFwiMTExNVwiOiBcInRzaGN5O1wiLFxuICAgIFwiMTExNlwiOiBcImtqY3k7XCIsXG4gICAgXCIxMTE4XCI6IFwidWJyY3k7XCIsXG4gICAgXCIxMTE5XCI6IFwiZHpjeTtcIixcbiAgICBcIjgxOTRcIjogXCJlbnNwO1wiLFxuICAgIFwiODE5NVwiOiBcImVtc3A7XCIsXG4gICAgXCI4MTk2XCI6IFwiZW1zcDEzO1wiLFxuICAgIFwiODE5N1wiOiBcImVtc3AxNDtcIixcbiAgICBcIjgxOTlcIjogXCJudW1zcDtcIixcbiAgICBcIjgyMDBcIjogXCJwdW5jc3A7XCIsXG4gICAgXCI4MjAxXCI6IFwiVGhpblNwYWNlO1wiLFxuICAgIFwiODIwMlwiOiBcIlZlcnlUaGluU3BhY2U7XCIsXG4gICAgXCI4MjAzXCI6IFwiWmVyb1dpZHRoU3BhY2U7XCIsXG4gICAgXCI4MjA0XCI6IFwienduajtcIixcbiAgICBcIjgyMDVcIjogXCJ6d2o7XCIsXG4gICAgXCI4MjA2XCI6IFwibHJtO1wiLFxuICAgIFwiODIwN1wiOiBcInJsbTtcIixcbiAgICBcIjgyMDhcIjogXCJoeXBoZW47XCIsXG4gICAgXCI4MjExXCI6IFwibmRhc2g7XCIsXG4gICAgXCI4MjEyXCI6IFwibWRhc2g7XCIsXG4gICAgXCI4MjEzXCI6IFwiaG9yYmFyO1wiLFxuICAgIFwiODIxNFwiOiBcIlZlcnQ7XCIsXG4gICAgXCI4MjE2XCI6IFwiT3BlbkN1cmx5UXVvdGU7XCIsXG4gICAgXCI4MjE3XCI6IFwicnNxdW9yO1wiLFxuICAgIFwiODIxOFwiOiBcInNicXVvO1wiLFxuICAgIFwiODIyMFwiOiBcIk9wZW5DdXJseURvdWJsZVF1b3RlO1wiLFxuICAgIFwiODIyMVwiOiBcInJkcXVvcjtcIixcbiAgICBcIjgyMjJcIjogXCJsZHF1b3I7XCIsXG4gICAgXCI4MjI0XCI6IFwiZGFnZ2VyO1wiLFxuICAgIFwiODIyNVwiOiBcImRkYWdnZXI7XCIsXG4gICAgXCI4MjI2XCI6IFwiYnVsbGV0O1wiLFxuICAgIFwiODIyOVwiOiBcIm5sZHI7XCIsXG4gICAgXCI4MjMwXCI6IFwibWxkcjtcIixcbiAgICBcIjgyNDBcIjogXCJwZXJtaWw7XCIsXG4gICAgXCI4MjQxXCI6IFwicGVydGVuaztcIixcbiAgICBcIjgyNDJcIjogXCJwcmltZTtcIixcbiAgICBcIjgyNDNcIjogXCJQcmltZTtcIixcbiAgICBcIjgyNDRcIjogXCJ0cHJpbWU7XCIsXG4gICAgXCI4MjQ1XCI6IFwiYnByaW1lO1wiLFxuICAgIFwiODI0OVwiOiBcImxzYXF1bztcIixcbiAgICBcIjgyNTBcIjogXCJyc2FxdW87XCIsXG4gICAgXCI4MjU0XCI6IFwiT3ZlckJhcjtcIixcbiAgICBcIjgyNTdcIjogXCJjYXJldDtcIixcbiAgICBcIjgyNTlcIjogXCJoeWJ1bGw7XCIsXG4gICAgXCI4MjYwXCI6IFwiZnJhc2w7XCIsXG4gICAgXCI4MjcxXCI6IFwiYnNlbWk7XCIsXG4gICAgXCI4Mjc5XCI6IFwicXByaW1lO1wiLFxuICAgIFwiODI4N1wiOiBcIk1lZGl1bVNwYWNlO1wiLFxuICAgIFwiODI4OFwiOiBcIk5vQnJlYWs7XCIsXG4gICAgXCI4Mjg5XCI6IFwiQXBwbHlGdW5jdGlvbjtcIixcbiAgICBcIjgyOTBcIjogXCJpdDtcIixcbiAgICBcIjgyOTFcIjogXCJJbnZpc2libGVDb21tYTtcIixcbiAgICBcIjgzNjRcIjogXCJldXJvO1wiLFxuICAgIFwiODQxMVwiOiBcIlRyaXBsZURvdDtcIixcbiAgICBcIjg0MTJcIjogXCJEb3REb3Q7XCIsXG4gICAgXCI4NDUwXCI6IFwiQ29wZjtcIixcbiAgICBcIjg0NTNcIjogXCJpbmNhcmU7XCIsXG4gICAgXCI4NDU4XCI6IFwiZ3NjcjtcIixcbiAgICBcIjg0NTlcIjogXCJIc2NyO1wiLFxuICAgIFwiODQ2MFwiOiBcIlBvaW5jYXJlcGxhbmU7XCIsXG4gICAgXCI4NDYxXCI6IFwicXVhdGVybmlvbnM7XCIsXG4gICAgXCI4NDYyXCI6IFwicGxhbmNraDtcIixcbiAgICBcIjg0NjNcIjogXCJwbGFua3Y7XCIsXG4gICAgXCI4NDY0XCI6IFwiSXNjcjtcIixcbiAgICBcIjg0NjVcIjogXCJpbWFncGFydDtcIixcbiAgICBcIjg0NjZcIjogXCJMc2NyO1wiLFxuICAgIFwiODQ2N1wiOiBcImVsbDtcIixcbiAgICBcIjg0NjlcIjogXCJOb3BmO1wiLFxuICAgIFwiODQ3MFwiOiBcIm51bWVybztcIixcbiAgICBcIjg0NzFcIjogXCJjb3B5c3I7XCIsXG4gICAgXCI4NDcyXCI6IFwid3A7XCIsXG4gICAgXCI4NDczXCI6IFwicHJpbWVzO1wiLFxuICAgIFwiODQ3NFwiOiBcInJhdGlvbmFscztcIixcbiAgICBcIjg0NzVcIjogXCJSc2NyO1wiLFxuICAgIFwiODQ3NlwiOiBcIlJmcjtcIixcbiAgICBcIjg0NzdcIjogXCJSb3BmO1wiLFxuICAgIFwiODQ3OFwiOiBcInJ4O1wiLFxuICAgIFwiODQ4MlwiOiBcInRyYWRlO1wiLFxuICAgIFwiODQ4NFwiOiBcIlpvcGY7XCIsXG4gICAgXCI4NDg3XCI6IFwibWhvO1wiLFxuICAgIFwiODQ4OFwiOiBcIlpmcjtcIixcbiAgICBcIjg0ODlcIjogXCJpaW90YTtcIixcbiAgICBcIjg0OTJcIjogXCJCc2NyO1wiLFxuICAgIFwiODQ5M1wiOiBcIkNmcjtcIixcbiAgICBcIjg0OTVcIjogXCJlc2NyO1wiLFxuICAgIFwiODQ5NlwiOiBcImV4cGVjdGF0aW9uO1wiLFxuICAgIFwiODQ5N1wiOiBcIkZzY3I7XCIsXG4gICAgXCI4NDk5XCI6IFwicGhtbWF0O1wiLFxuICAgIFwiODUwMFwiOiBcIm9zY3I7XCIsXG4gICAgXCI4NTAxXCI6IFwiYWxlcGg7XCIsXG4gICAgXCI4NTAyXCI6IFwiYmV0aDtcIixcbiAgICBcIjg1MDNcIjogXCJnaW1lbDtcIixcbiAgICBcIjg1MDRcIjogXCJkYWxldGg7XCIsXG4gICAgXCI4NTE3XCI6IFwiREQ7XCIsXG4gICAgXCI4NTE4XCI6IFwiRGlmZmVyZW50aWFsRDtcIixcbiAgICBcIjg1MTlcIjogXCJleHBvbmVudGlhbGU7XCIsXG4gICAgXCI4NTIwXCI6IFwiSW1hZ2luYXJ5STtcIixcbiAgICBcIjg1MzFcIjogXCJmcmFjMTM7XCIsXG4gICAgXCI4NTMyXCI6IFwiZnJhYzIzO1wiLFxuICAgIFwiODUzM1wiOiBcImZyYWMxNTtcIixcbiAgICBcIjg1MzRcIjogXCJmcmFjMjU7XCIsXG4gICAgXCI4NTM1XCI6IFwiZnJhYzM1O1wiLFxuICAgIFwiODUzNlwiOiBcImZyYWM0NTtcIixcbiAgICBcIjg1MzdcIjogXCJmcmFjMTY7XCIsXG4gICAgXCI4NTM4XCI6IFwiZnJhYzU2O1wiLFxuICAgIFwiODUzOVwiOiBcImZyYWMxODtcIixcbiAgICBcIjg1NDBcIjogXCJmcmFjMzg7XCIsXG4gICAgXCI4NTQxXCI6IFwiZnJhYzU4O1wiLFxuICAgIFwiODU0MlwiOiBcImZyYWM3ODtcIixcbiAgICBcIjg1OTJcIjogXCJzbGFycjtcIixcbiAgICBcIjg1OTNcIjogXCJ1cGFycm93O1wiLFxuICAgIFwiODU5NFwiOiBcInNyYXJyO1wiLFxuICAgIFwiODU5NVwiOiBcIlNob3J0RG93bkFycm93O1wiLFxuICAgIFwiODU5NlwiOiBcImxlZnRyaWdodGFycm93O1wiLFxuICAgIFwiODU5N1wiOiBcInZhcnI7XCIsXG4gICAgXCI4NTk4XCI6IFwiVXBwZXJMZWZ0QXJyb3c7XCIsXG4gICAgXCI4NTk5XCI6IFwiVXBwZXJSaWdodEFycm93O1wiLFxuICAgIFwiODYwMFwiOiBcInNlYXJyb3c7XCIsXG4gICAgXCI4NjAxXCI6IFwic3dhcnJvdztcIixcbiAgICBcIjg2MDJcIjogXCJubGVmdGFycm93O1wiLFxuICAgIFwiODYwM1wiOiBcIm5yaWdodGFycm93O1wiLFxuICAgIFwiODYwNVwiOiBcInJpZ2h0c3F1aWdhcnJvdztcIixcbiAgICBcIjg2MDZcIjogXCJ0d29oZWFkbGVmdGFycm93O1wiLFxuICAgIFwiODYwN1wiOiBcIlVhcnI7XCIsXG4gICAgXCI4NjA4XCI6IFwidHdvaGVhZHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjA5XCI6IFwiRGFycjtcIixcbiAgICBcIjg2MTBcIjogXCJsZWZ0YXJyb3d0YWlsO1wiLFxuICAgIFwiODYxMVwiOiBcInJpZ2h0YXJyb3d0YWlsO1wiLFxuICAgIFwiODYxMlwiOiBcIm1hcHN0b2xlZnQ7XCIsXG4gICAgXCI4NjEzXCI6IFwiVXBUZWVBcnJvdztcIixcbiAgICBcIjg2MTRcIjogXCJSaWdodFRlZUFycm93O1wiLFxuICAgIFwiODYxNVwiOiBcIm1hcHN0b2Rvd247XCIsXG4gICAgXCI4NjE3XCI6IFwibGFycmhrO1wiLFxuICAgIFwiODYxOFwiOiBcInJhcnJoaztcIixcbiAgICBcIjg2MTlcIjogXCJsb29wYXJyb3dsZWZ0O1wiLFxuICAgIFwiODYyMFwiOiBcInJhcnJscDtcIixcbiAgICBcIjg2MjFcIjogXCJsZWZ0cmlnaHRzcXVpZ2Fycm93O1wiLFxuICAgIFwiODYyMlwiOiBcIm5sZWZ0cmlnaHRhcnJvdztcIixcbiAgICBcIjg2MjRcIjogXCJsc2g7XCIsXG4gICAgXCI4NjI1XCI6IFwicnNoO1wiLFxuICAgIFwiODYyNlwiOiBcImxkc2g7XCIsXG4gICAgXCI4NjI3XCI6IFwicmRzaDtcIixcbiAgICBcIjg2MjlcIjogXCJjcmFycjtcIixcbiAgICBcIjg2MzBcIjogXCJjdXJ2ZWFycm93bGVmdDtcIixcbiAgICBcIjg2MzFcIjogXCJjdXJ2ZWFycm93cmlnaHQ7XCIsXG4gICAgXCI4NjM0XCI6IFwib2xhcnI7XCIsXG4gICAgXCI4NjM1XCI6IFwib3JhcnI7XCIsXG4gICAgXCI4NjM2XCI6IFwibGhhcnU7XCIsXG4gICAgXCI4NjM3XCI6IFwibGhhcmQ7XCIsXG4gICAgXCI4NjM4XCI6IFwidXBoYXJwb29ucmlnaHQ7XCIsXG4gICAgXCI4NjM5XCI6IFwidXBoYXJwb29ubGVmdDtcIixcbiAgICBcIjg2NDBcIjogXCJSaWdodFZlY3RvcjtcIixcbiAgICBcIjg2NDFcIjogXCJyaWdodGhhcnBvb25kb3duO1wiLFxuICAgIFwiODY0MlwiOiBcIlJpZ2h0RG93blZlY3RvcjtcIixcbiAgICBcIjg2NDNcIjogXCJMZWZ0RG93blZlY3RvcjtcIixcbiAgICBcIjg2NDRcIjogXCJybGFycjtcIixcbiAgICBcIjg2NDVcIjogXCJVcEFycm93RG93bkFycm93O1wiLFxuICAgIFwiODY0NlwiOiBcImxyYXJyO1wiLFxuICAgIFwiODY0N1wiOiBcImxsYXJyO1wiLFxuICAgIFwiODY0OFwiOiBcInV1YXJyO1wiLFxuICAgIFwiODY0OVwiOiBcInJyYXJyO1wiLFxuICAgIFwiODY1MFwiOiBcImRvd25kb3duYXJyb3dzO1wiLFxuICAgIFwiODY1MVwiOiBcIlJldmVyc2VFcXVpbGlicml1bTtcIixcbiAgICBcIjg2NTJcIjogXCJybGhhcjtcIixcbiAgICBcIjg2NTNcIjogXCJuTGVmdGFycm93O1wiLFxuICAgIFwiODY1NFwiOiBcIm5MZWZ0cmlnaHRhcnJvdztcIixcbiAgICBcIjg2NTVcIjogXCJuUmlnaHRhcnJvdztcIixcbiAgICBcIjg2NTZcIjogXCJMZWZ0YXJyb3c7XCIsXG4gICAgXCI4NjU3XCI6IFwiVXBhcnJvdztcIixcbiAgICBcIjg2NThcIjogXCJSaWdodGFycm93O1wiLFxuICAgIFwiODY1OVwiOiBcIkRvd25hcnJvdztcIixcbiAgICBcIjg2NjBcIjogXCJMZWZ0cmlnaHRhcnJvdztcIixcbiAgICBcIjg2NjFcIjogXCJ2QXJyO1wiLFxuICAgIFwiODY2MlwiOiBcIm53QXJyO1wiLFxuICAgIFwiODY2M1wiOiBcIm5lQXJyO1wiLFxuICAgIFwiODY2NFwiOiBcInNlQXJyO1wiLFxuICAgIFwiODY2NVwiOiBcInN3QXJyO1wiLFxuICAgIFwiODY2NlwiOiBcIkxsZWZ0YXJyb3c7XCIsXG4gICAgXCI4NjY3XCI6IFwiUnJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjY5XCI6IFwiemlncmFycjtcIixcbiAgICBcIjg2NzZcIjogXCJMZWZ0QXJyb3dCYXI7XCIsXG4gICAgXCI4Njc3XCI6IFwiUmlnaHRBcnJvd0JhcjtcIixcbiAgICBcIjg2OTNcIjogXCJkdWFycjtcIixcbiAgICBcIjg3MDFcIjogXCJsb2FycjtcIixcbiAgICBcIjg3MDJcIjogXCJyb2FycjtcIixcbiAgICBcIjg3MDNcIjogXCJob2FycjtcIixcbiAgICBcIjg3MDRcIjogXCJmb3JhbGw7XCIsXG4gICAgXCI4NzA1XCI6IFwiY29tcGxlbWVudDtcIixcbiAgICBcIjg3MDZcIjogXCJQYXJ0aWFsRDtcIixcbiAgICBcIjg3MDdcIjogXCJFeGlzdHM7XCIsXG4gICAgXCI4NzA4XCI6IFwiTm90RXhpc3RzO1wiLFxuICAgIFwiODcwOVwiOiBcInZhcm5vdGhpbmc7XCIsXG4gICAgXCI4NzExXCI6IFwibmFibGE7XCIsXG4gICAgXCI4NzEyXCI6IFwiaXNpbnY7XCIsXG4gICAgXCI4NzEzXCI6IFwibm90aW52YTtcIixcbiAgICBcIjg3MTVcIjogXCJTdWNoVGhhdDtcIixcbiAgICBcIjg3MTZcIjogXCJOb3RSZXZlcnNlRWxlbWVudDtcIixcbiAgICBcIjg3MTlcIjogXCJQcm9kdWN0O1wiLFxuICAgIFwiODcyMFwiOiBcIkNvcHJvZHVjdDtcIixcbiAgICBcIjg3MjFcIjogXCJzdW07XCIsXG4gICAgXCI4NzIyXCI6IFwibWludXM7XCIsXG4gICAgXCI4NzIzXCI6IFwibXA7XCIsXG4gICAgXCI4NzI0XCI6IFwicGx1c2RvO1wiLFxuICAgIFwiODcyNlwiOiBcInNzZXRtbjtcIixcbiAgICBcIjg3MjdcIjogXCJsb3dhc3Q7XCIsXG4gICAgXCI4NzI4XCI6IFwiU21hbGxDaXJjbGU7XCIsXG4gICAgXCI4NzMwXCI6IFwiU3FydDtcIixcbiAgICBcIjg3MzNcIjogXCJ2cHJvcDtcIixcbiAgICBcIjg3MzRcIjogXCJpbmZpbjtcIixcbiAgICBcIjg3MzVcIjogXCJhbmdydDtcIixcbiAgICBcIjg3MzZcIjogXCJhbmdsZTtcIixcbiAgICBcIjg3MzdcIjogXCJtZWFzdXJlZGFuZ2xlO1wiLFxuICAgIFwiODczOFwiOiBcImFuZ3NwaDtcIixcbiAgICBcIjg3MzlcIjogXCJWZXJ0aWNhbEJhcjtcIixcbiAgICBcIjg3NDBcIjogXCJuc21pZDtcIixcbiAgICBcIjg3NDFcIjogXCJzcGFyO1wiLFxuICAgIFwiODc0MlwiOiBcIm5zcGFyO1wiLFxuICAgIFwiODc0M1wiOiBcIndlZGdlO1wiLFxuICAgIFwiODc0NFwiOiBcInZlZTtcIixcbiAgICBcIjg3NDVcIjogXCJjYXA7XCIsXG4gICAgXCI4NzQ2XCI6IFwiY3VwO1wiLFxuICAgIFwiODc0N1wiOiBcIkludGVncmFsO1wiLFxuICAgIFwiODc0OFwiOiBcIkludDtcIixcbiAgICBcIjg3NDlcIjogXCJ0aW50O1wiLFxuICAgIFwiODc1MFwiOiBcIm9pbnQ7XCIsXG4gICAgXCI4NzUxXCI6IFwiRG91YmxlQ29udG91ckludGVncmFsO1wiLFxuICAgIFwiODc1MlwiOiBcIkNjb25pbnQ7XCIsXG4gICAgXCI4NzUzXCI6IFwiY3dpbnQ7XCIsXG4gICAgXCI4NzU0XCI6IFwiY3djb25pbnQ7XCIsXG4gICAgXCI4NzU1XCI6IFwiQ291bnRlckNsb2Nrd2lzZUNvbnRvdXJJbnRlZ3JhbDtcIixcbiAgICBcIjg3NTZcIjogXCJ0aGVyZWZvcmU7XCIsXG4gICAgXCI4NzU3XCI6IFwiYmVjYXVzZTtcIixcbiAgICBcIjg3NThcIjogXCJyYXRpbztcIixcbiAgICBcIjg3NTlcIjogXCJQcm9wb3J0aW9uO1wiLFxuICAgIFwiODc2MFwiOiBcIm1pbnVzZDtcIixcbiAgICBcIjg3NjJcIjogXCJtRERvdDtcIixcbiAgICBcIjg3NjNcIjogXCJob210aHQ7XCIsXG4gICAgXCI4NzY0XCI6IFwiVGlsZGU7XCIsXG4gICAgXCI4NzY1XCI6IFwiYnNpbTtcIixcbiAgICBcIjg3NjZcIjogXCJtc3Rwb3M7XCIsXG4gICAgXCI4NzY3XCI6IFwiYWNkO1wiLFxuICAgIFwiODc2OFwiOiBcIndyZWF0aDtcIixcbiAgICBcIjg3NjlcIjogXCJuc2ltO1wiLFxuICAgIFwiODc3MFwiOiBcImVzaW07XCIsXG4gICAgXCI4NzcxXCI6IFwiVGlsZGVFcXVhbDtcIixcbiAgICBcIjg3NzJcIjogXCJuc2ltZXE7XCIsXG4gICAgXCI4NzczXCI6IFwiVGlsZGVGdWxsRXF1YWw7XCIsXG4gICAgXCI4Nzc0XCI6IFwic2ltbmU7XCIsXG4gICAgXCI4Nzc1XCI6IFwiTm90VGlsZGVGdWxsRXF1YWw7XCIsXG4gICAgXCI4Nzc2XCI6IFwiVGlsZGVUaWxkZTtcIixcbiAgICBcIjg3NzdcIjogXCJOb3RUaWxkZVRpbGRlO1wiLFxuICAgIFwiODc3OFwiOiBcImFwcHJveGVxO1wiLFxuICAgIFwiODc3OVwiOiBcImFwaWQ7XCIsXG4gICAgXCI4NzgwXCI6IFwiYmNvbmc7XCIsXG4gICAgXCI4NzgxXCI6IFwiQ3VwQ2FwO1wiLFxuICAgIFwiODc4MlwiOiBcIkh1bXBEb3duSHVtcDtcIixcbiAgICBcIjg3ODNcIjogXCJIdW1wRXF1YWw7XCIsXG4gICAgXCI4Nzg0XCI6IFwiZXNkb3Q7XCIsXG4gICAgXCI4Nzg1XCI6IFwiZURvdDtcIixcbiAgICBcIjg3ODZcIjogXCJmYWxsaW5nZG90c2VxO1wiLFxuICAgIFwiODc4N1wiOiBcInJpc2luZ2RvdHNlcTtcIixcbiAgICBcIjg3ODhcIjogXCJjb2xvbmVxO1wiLFxuICAgIFwiODc4OVwiOiBcImVxY29sb247XCIsXG4gICAgXCI4NzkwXCI6IFwiZXFjaXJjO1wiLFxuICAgIFwiODc5MVwiOiBcImNpcmU7XCIsXG4gICAgXCI4NzkzXCI6IFwid2VkZ2VxO1wiLFxuICAgIFwiODc5NFwiOiBcInZlZWVxO1wiLFxuICAgIFwiODc5NlwiOiBcInRyaWU7XCIsXG4gICAgXCI4Nzk5XCI6IFwicXVlc3RlcTtcIixcbiAgICBcIjg4MDBcIjogXCJOb3RFcXVhbDtcIixcbiAgICBcIjg4MDFcIjogXCJlcXVpdjtcIixcbiAgICBcIjg4MDJcIjogXCJOb3RDb25ncnVlbnQ7XCIsXG4gICAgXCI4ODA0XCI6IFwibGVxO1wiLFxuICAgIFwiODgwNVwiOiBcIkdyZWF0ZXJFcXVhbDtcIixcbiAgICBcIjg4MDZcIjogXCJMZXNzRnVsbEVxdWFsO1wiLFxuICAgIFwiODgwN1wiOiBcIkdyZWF0ZXJGdWxsRXF1YWw7XCIsXG4gICAgXCI4ODA4XCI6IFwibG5lcXE7XCIsXG4gICAgXCI4ODA5XCI6IFwiZ25lcXE7XCIsXG4gICAgXCI4ODEwXCI6IFwiTmVzdGVkTGVzc0xlc3M7XCIsXG4gICAgXCI4ODExXCI6IFwiTmVzdGVkR3JlYXRlckdyZWF0ZXI7XCIsXG4gICAgXCI4ODEyXCI6IFwidHdpeHQ7XCIsXG4gICAgXCI4ODEzXCI6IFwiTm90Q3VwQ2FwO1wiLFxuICAgIFwiODgxNFwiOiBcIk5vdExlc3M7XCIsXG4gICAgXCI4ODE1XCI6IFwiTm90R3JlYXRlcjtcIixcbiAgICBcIjg4MTZcIjogXCJOb3RMZXNzRXF1YWw7XCIsXG4gICAgXCI4ODE3XCI6IFwiTm90R3JlYXRlckVxdWFsO1wiLFxuICAgIFwiODgxOFwiOiBcImxzaW07XCIsXG4gICAgXCI4ODE5XCI6IFwiZ3Ryc2ltO1wiLFxuICAgIFwiODgyMFwiOiBcIk5vdExlc3NUaWxkZTtcIixcbiAgICBcIjg4MjFcIjogXCJOb3RHcmVhdGVyVGlsZGU7XCIsXG4gICAgXCI4ODIyXCI6IFwibGc7XCIsXG4gICAgXCI4ODIzXCI6IFwiZ3RybGVzcztcIixcbiAgICBcIjg4MjRcIjogXCJudGxnO1wiLFxuICAgIFwiODgyNVwiOiBcIm50Z2w7XCIsXG4gICAgXCI4ODI2XCI6IFwiUHJlY2VkZXM7XCIsXG4gICAgXCI4ODI3XCI6IFwiU3VjY2VlZHM7XCIsXG4gICAgXCI4ODI4XCI6IFwiUHJlY2VkZXNTbGFudEVxdWFsO1wiLFxuICAgIFwiODgyOVwiOiBcIlN1Y2NlZWRzU2xhbnRFcXVhbDtcIixcbiAgICBcIjg4MzBcIjogXCJwcnNpbTtcIixcbiAgICBcIjg4MzFcIjogXCJzdWNjc2ltO1wiLFxuICAgIFwiODgzMlwiOiBcIm5wcmVjO1wiLFxuICAgIFwiODgzM1wiOiBcIm5zdWNjO1wiLFxuICAgIFwiODgzNFwiOiBcInN1YnNldDtcIixcbiAgICBcIjg4MzVcIjogXCJzdXBzZXQ7XCIsXG4gICAgXCI4ODM2XCI6IFwibnN1YjtcIixcbiAgICBcIjg4MzdcIjogXCJuc3VwO1wiLFxuICAgIFwiODgzOFwiOiBcIlN1YnNldEVxdWFsO1wiLFxuICAgIFwiODgzOVwiOiBcInN1cHNldGVxO1wiLFxuICAgIFwiODg0MFwiOiBcIm5zdWJzZXRlcTtcIixcbiAgICBcIjg4NDFcIjogXCJuc3Vwc2V0ZXE7XCIsXG4gICAgXCI4ODQyXCI6IFwic3Vic2V0bmVxO1wiLFxuICAgIFwiODg0M1wiOiBcInN1cHNldG5lcTtcIixcbiAgICBcIjg4NDVcIjogXCJjdXBkb3Q7XCIsXG4gICAgXCI4ODQ2XCI6IFwidXBsdXM7XCIsXG4gICAgXCI4ODQ3XCI6IFwiU3F1YXJlU3Vic2V0O1wiLFxuICAgIFwiODg0OFwiOiBcIlNxdWFyZVN1cGVyc2V0O1wiLFxuICAgIFwiODg0OVwiOiBcIlNxdWFyZVN1YnNldEVxdWFsO1wiLFxuICAgIFwiODg1MFwiOiBcIlNxdWFyZVN1cGVyc2V0RXF1YWw7XCIsXG4gICAgXCI4ODUxXCI6IFwiU3F1YXJlSW50ZXJzZWN0aW9uO1wiLFxuICAgIFwiODg1MlwiOiBcIlNxdWFyZVVuaW9uO1wiLFxuICAgIFwiODg1M1wiOiBcIm9wbHVzO1wiLFxuICAgIFwiODg1NFwiOiBcIm9taW51cztcIixcbiAgICBcIjg4NTVcIjogXCJvdGltZXM7XCIsXG4gICAgXCI4ODU2XCI6IFwib3NvbDtcIixcbiAgICBcIjg4NTdcIjogXCJvZG90O1wiLFxuICAgIFwiODg1OFwiOiBcIm9jaXI7XCIsXG4gICAgXCI4ODU5XCI6IFwib2FzdDtcIixcbiAgICBcIjg4NjFcIjogXCJvZGFzaDtcIixcbiAgICBcIjg4NjJcIjogXCJwbHVzYjtcIixcbiAgICBcIjg4NjNcIjogXCJtaW51c2I7XCIsXG4gICAgXCI4ODY0XCI6IFwidGltZXNiO1wiLFxuICAgIFwiODg2NVwiOiBcInNkb3RiO1wiLFxuICAgIFwiODg2NlwiOiBcInZkYXNoO1wiLFxuICAgIFwiODg2N1wiOiBcIkxlZnRUZWU7XCIsXG4gICAgXCI4ODY4XCI6IFwidG9wO1wiLFxuICAgIFwiODg2OVwiOiBcIlVwVGVlO1wiLFxuICAgIFwiODg3MVwiOiBcIm1vZGVscztcIixcbiAgICBcIjg4NzJcIjogXCJ2RGFzaDtcIixcbiAgICBcIjg4NzNcIjogXCJWZGFzaDtcIixcbiAgICBcIjg4NzRcIjogXCJWdmRhc2g7XCIsXG4gICAgXCI4ODc1XCI6IFwiVkRhc2g7XCIsXG4gICAgXCI4ODc2XCI6IFwibnZkYXNoO1wiLFxuICAgIFwiODg3N1wiOiBcIm52RGFzaDtcIixcbiAgICBcIjg4NzhcIjogXCJuVmRhc2g7XCIsXG4gICAgXCI4ODc5XCI6IFwiblZEYXNoO1wiLFxuICAgIFwiODg4MFwiOiBcInBydXJlbDtcIixcbiAgICBcIjg4ODJcIjogXCJ2bHRyaTtcIixcbiAgICBcIjg4ODNcIjogXCJ2cnRyaTtcIixcbiAgICBcIjg4ODRcIjogXCJ0cmlhbmdsZWxlZnRlcTtcIixcbiAgICBcIjg4ODVcIjogXCJ0cmlhbmdsZXJpZ2h0ZXE7XCIsXG4gICAgXCI4ODg2XCI6IFwib3JpZ29mO1wiLFxuICAgIFwiODg4N1wiOiBcImltb2Y7XCIsXG4gICAgXCI4ODg4XCI6IFwibXVtYXA7XCIsXG4gICAgXCI4ODg5XCI6IFwiaGVyY29uO1wiLFxuICAgIFwiODg5MFwiOiBcImludGVyY2FsO1wiLFxuICAgIFwiODg5MVwiOiBcInZlZWJhcjtcIixcbiAgICBcIjg4OTNcIjogXCJiYXJ2ZWU7XCIsXG4gICAgXCI4ODk0XCI6IFwiYW5ncnR2YjtcIixcbiAgICBcIjg4OTVcIjogXCJscnRyaTtcIixcbiAgICBcIjg4OTZcIjogXCJ4d2VkZ2U7XCIsXG4gICAgXCI4ODk3XCI6IFwieHZlZTtcIixcbiAgICBcIjg4OThcIjogXCJ4Y2FwO1wiLFxuICAgIFwiODg5OVwiOiBcInhjdXA7XCIsXG4gICAgXCI4OTAwXCI6IFwiZGlhbW9uZDtcIixcbiAgICBcIjg5MDFcIjogXCJzZG90O1wiLFxuICAgIFwiODkwMlwiOiBcIlN0YXI7XCIsXG4gICAgXCI4OTAzXCI6IFwiZGl2b254O1wiLFxuICAgIFwiODkwNFwiOiBcImJvd3RpZTtcIixcbiAgICBcIjg5MDVcIjogXCJsdGltZXM7XCIsXG4gICAgXCI4OTA2XCI6IFwicnRpbWVzO1wiLFxuICAgIFwiODkwN1wiOiBcImx0aHJlZTtcIixcbiAgICBcIjg5MDhcIjogXCJydGhyZWU7XCIsXG4gICAgXCI4OTA5XCI6IFwiYnNpbWU7XCIsXG4gICAgXCI4OTEwXCI6IFwiY3V2ZWU7XCIsXG4gICAgXCI4OTExXCI6IFwiY3V3ZWQ7XCIsXG4gICAgXCI4OTEyXCI6IFwiU3Vic2V0O1wiLFxuICAgIFwiODkxM1wiOiBcIlN1cHNldDtcIixcbiAgICBcIjg5MTRcIjogXCJDYXA7XCIsXG4gICAgXCI4OTE1XCI6IFwiQ3VwO1wiLFxuICAgIFwiODkxNlwiOiBcInBpdGNoZm9yaztcIixcbiAgICBcIjg5MTdcIjogXCJlcGFyO1wiLFxuICAgIFwiODkxOFwiOiBcImx0ZG90O1wiLFxuICAgIFwiODkxOVwiOiBcImd0cmRvdDtcIixcbiAgICBcIjg5MjBcIjogXCJMbDtcIixcbiAgICBcIjg5MjFcIjogXCJnZ2c7XCIsXG4gICAgXCI4OTIyXCI6IFwiTGVzc0VxdWFsR3JlYXRlcjtcIixcbiAgICBcIjg5MjNcIjogXCJndHJlcWxlc3M7XCIsXG4gICAgXCI4OTI2XCI6IFwiY3VybHllcXByZWM7XCIsXG4gICAgXCI4OTI3XCI6IFwiY3VybHllcXN1Y2M7XCIsXG4gICAgXCI4OTI4XCI6IFwibnByY3VlO1wiLFxuICAgIFwiODkyOVwiOiBcIm5zY2N1ZTtcIixcbiAgICBcIjg5MzBcIjogXCJuc3FzdWJlO1wiLFxuICAgIFwiODkzMVwiOiBcIm5zcXN1cGU7XCIsXG4gICAgXCI4OTM0XCI6IFwibG5zaW07XCIsXG4gICAgXCI4OTM1XCI6IFwiZ25zaW07XCIsXG4gICAgXCI4OTM2XCI6IFwicHJuc2ltO1wiLFxuICAgIFwiODkzN1wiOiBcInN1Y2Nuc2ltO1wiLFxuICAgIFwiODkzOFwiOiBcIm50cmlhbmdsZWxlZnQ7XCIsXG4gICAgXCI4OTM5XCI6IFwibnRyaWFuZ2xlcmlnaHQ7XCIsXG4gICAgXCI4OTQwXCI6IFwibnRyaWFuZ2xlbGVmdGVxO1wiLFxuICAgIFwiODk0MVwiOiBcIm50cmlhbmdsZXJpZ2h0ZXE7XCIsXG4gICAgXCI4OTQyXCI6IFwidmVsbGlwO1wiLFxuICAgIFwiODk0M1wiOiBcImN0ZG90O1wiLFxuICAgIFwiODk0NFwiOiBcInV0ZG90O1wiLFxuICAgIFwiODk0NVwiOiBcImR0ZG90O1wiLFxuICAgIFwiODk0NlwiOiBcImRpc2luO1wiLFxuICAgIFwiODk0N1wiOiBcImlzaW5zdjtcIixcbiAgICBcIjg5NDhcIjogXCJpc2lucztcIixcbiAgICBcIjg5NDlcIjogXCJpc2luZG90O1wiLFxuICAgIFwiODk1MFwiOiBcIm5vdGludmM7XCIsXG4gICAgXCI4OTUxXCI6IFwibm90aW52YjtcIixcbiAgICBcIjg5NTNcIjogXCJpc2luRTtcIixcbiAgICBcIjg5NTRcIjogXCJuaXNkO1wiLFxuICAgIFwiODk1NVwiOiBcInhuaXM7XCIsXG4gICAgXCI4OTU2XCI6IFwibmlzO1wiLFxuICAgIFwiODk1N1wiOiBcIm5vdG5pdmM7XCIsXG4gICAgXCI4OTU4XCI6IFwibm90bml2YjtcIixcbiAgICBcIjg5NjVcIjogXCJiYXJ3ZWRnZTtcIixcbiAgICBcIjg5NjZcIjogXCJkb3VibGViYXJ3ZWRnZTtcIixcbiAgICBcIjg5NjhcIjogXCJMZWZ0Q2VpbGluZztcIixcbiAgICBcIjg5NjlcIjogXCJSaWdodENlaWxpbmc7XCIsXG4gICAgXCI4OTcwXCI6IFwibGZsb29yO1wiLFxuICAgIFwiODk3MVwiOiBcIlJpZ2h0Rmxvb3I7XCIsXG4gICAgXCI4OTcyXCI6IFwiZHJjcm9wO1wiLFxuICAgIFwiODk3M1wiOiBcImRsY3JvcDtcIixcbiAgICBcIjg5NzRcIjogXCJ1cmNyb3A7XCIsXG4gICAgXCI4OTc1XCI6IFwidWxjcm9wO1wiLFxuICAgIFwiODk3NlwiOiBcImJub3Q7XCIsXG4gICAgXCI4OTc4XCI6IFwicHJvZmxpbmU7XCIsXG4gICAgXCI4OTc5XCI6IFwicHJvZnN1cmY7XCIsXG4gICAgXCI4OTgxXCI6IFwidGVscmVjO1wiLFxuICAgIFwiODk4MlwiOiBcInRhcmdldDtcIixcbiAgICBcIjg5ODhcIjogXCJ1bGNvcm5lcjtcIixcbiAgICBcIjg5ODlcIjogXCJ1cmNvcm5lcjtcIixcbiAgICBcIjg5OTBcIjogXCJsbGNvcm5lcjtcIixcbiAgICBcIjg5OTFcIjogXCJscmNvcm5lcjtcIixcbiAgICBcIjg5OTRcIjogXCJzZnJvd247XCIsXG4gICAgXCI4OTk1XCI6IFwic3NtaWxlO1wiLFxuICAgIFwiOTAwNVwiOiBcImN5bGN0eTtcIixcbiAgICBcIjkwMDZcIjogXCJwcm9mYWxhcjtcIixcbiAgICBcIjkwMTRcIjogXCJ0b3Bib3Q7XCIsXG4gICAgXCI5MDIxXCI6IFwib3ZiYXI7XCIsXG4gICAgXCI5MDIzXCI6IFwic29sYmFyO1wiLFxuICAgIFwiOTA4NFwiOiBcImFuZ3phcnI7XCIsXG4gICAgXCI5MTM2XCI6IFwibG1vdXN0YWNoZTtcIixcbiAgICBcIjkxMzdcIjogXCJybW91c3RhY2hlO1wiLFxuICAgIFwiOTE0MFwiOiBcInRicms7XCIsXG4gICAgXCI5MTQxXCI6IFwiVW5kZXJCcmFja2V0O1wiLFxuICAgIFwiOTE0MlwiOiBcImJicmt0YnJrO1wiLFxuICAgIFwiOTE4MFwiOiBcIk92ZXJQYXJlbnRoZXNpcztcIixcbiAgICBcIjkxODFcIjogXCJVbmRlclBhcmVudGhlc2lzO1wiLFxuICAgIFwiOTE4MlwiOiBcIk92ZXJCcmFjZTtcIixcbiAgICBcIjkxODNcIjogXCJVbmRlckJyYWNlO1wiLFxuICAgIFwiOTE4NlwiOiBcInRycGV6aXVtO1wiLFxuICAgIFwiOTE5MVwiOiBcImVsaW50ZXJzO1wiLFxuICAgIFwiOTI1MVwiOiBcImJsYW5rO1wiLFxuICAgIFwiOTQxNlwiOiBcIm9TO1wiLFxuICAgIFwiOTQ3MlwiOiBcIkhvcml6b250YWxMaW5lO1wiLFxuICAgIFwiOTQ3NFwiOiBcImJveHY7XCIsXG4gICAgXCI5NDg0XCI6IFwiYm94ZHI7XCIsXG4gICAgXCI5NDg4XCI6IFwiYm94ZGw7XCIsXG4gICAgXCI5NDkyXCI6IFwiYm94dXI7XCIsXG4gICAgXCI5NDk2XCI6IFwiYm94dWw7XCIsXG4gICAgXCI5NTAwXCI6IFwiYm94dnI7XCIsXG4gICAgXCI5NTA4XCI6IFwiYm94dmw7XCIsXG4gICAgXCI5NTE2XCI6IFwiYm94aGQ7XCIsXG4gICAgXCI5NTI0XCI6IFwiYm94aHU7XCIsXG4gICAgXCI5NTMyXCI6IFwiYm94dmg7XCIsXG4gICAgXCI5NTUyXCI6IFwiYm94SDtcIixcbiAgICBcIjk1NTNcIjogXCJib3hWO1wiLFxuICAgIFwiOTU1NFwiOiBcImJveGRSO1wiLFxuICAgIFwiOTU1NVwiOiBcImJveERyO1wiLFxuICAgIFwiOTU1NlwiOiBcImJveERSO1wiLFxuICAgIFwiOTU1N1wiOiBcImJveGRMO1wiLFxuICAgIFwiOTU1OFwiOiBcImJveERsO1wiLFxuICAgIFwiOTU1OVwiOiBcImJveERMO1wiLFxuICAgIFwiOTU2MFwiOiBcImJveHVSO1wiLFxuICAgIFwiOTU2MVwiOiBcImJveFVyO1wiLFxuICAgIFwiOTU2MlwiOiBcImJveFVSO1wiLFxuICAgIFwiOTU2M1wiOiBcImJveHVMO1wiLFxuICAgIFwiOTU2NFwiOiBcImJveFVsO1wiLFxuICAgIFwiOTU2NVwiOiBcImJveFVMO1wiLFxuICAgIFwiOTU2NlwiOiBcImJveHZSO1wiLFxuICAgIFwiOTU2N1wiOiBcImJveFZyO1wiLFxuICAgIFwiOTU2OFwiOiBcImJveFZSO1wiLFxuICAgIFwiOTU2OVwiOiBcImJveHZMO1wiLFxuICAgIFwiOTU3MFwiOiBcImJveFZsO1wiLFxuICAgIFwiOTU3MVwiOiBcImJveFZMO1wiLFxuICAgIFwiOTU3MlwiOiBcImJveEhkO1wiLFxuICAgIFwiOTU3M1wiOiBcImJveGhEO1wiLFxuICAgIFwiOTU3NFwiOiBcImJveEhEO1wiLFxuICAgIFwiOTU3NVwiOiBcImJveEh1O1wiLFxuICAgIFwiOTU3NlwiOiBcImJveGhVO1wiLFxuICAgIFwiOTU3N1wiOiBcImJveEhVO1wiLFxuICAgIFwiOTU3OFwiOiBcImJveHZIO1wiLFxuICAgIFwiOTU3OVwiOiBcImJveFZoO1wiLFxuICAgIFwiOTU4MFwiOiBcImJveFZIO1wiLFxuICAgIFwiOTYwMFwiOiBcInVoYmxrO1wiLFxuICAgIFwiOTYwNFwiOiBcImxoYmxrO1wiLFxuICAgIFwiOTYwOFwiOiBcImJsb2NrO1wiLFxuICAgIFwiOTYxN1wiOiBcImJsazE0O1wiLFxuICAgIFwiOTYxOFwiOiBcImJsazEyO1wiLFxuICAgIFwiOTYxOVwiOiBcImJsazM0O1wiLFxuICAgIFwiOTYzM1wiOiBcInNxdWFyZTtcIixcbiAgICBcIjk2NDJcIjogXCJzcXVmO1wiLFxuICAgIFwiOTY0M1wiOiBcIkVtcHR5VmVyeVNtYWxsU3F1YXJlO1wiLFxuICAgIFwiOTY0NVwiOiBcInJlY3Q7XCIsXG4gICAgXCI5NjQ2XCI6IFwibWFya2VyO1wiLFxuICAgIFwiOTY0OVwiOiBcImZsdG5zO1wiLFxuICAgIFwiOTY1MVwiOiBcInh1dHJpO1wiLFxuICAgIFwiOTY1MlwiOiBcInV0cmlmO1wiLFxuICAgIFwiOTY1M1wiOiBcInV0cmk7XCIsXG4gICAgXCI5NjU2XCI6IFwicnRyaWY7XCIsXG4gICAgXCI5NjU3XCI6IFwidHJpYW5nbGVyaWdodDtcIixcbiAgICBcIjk2NjFcIjogXCJ4ZHRyaTtcIixcbiAgICBcIjk2NjJcIjogXCJkdHJpZjtcIixcbiAgICBcIjk2NjNcIjogXCJ0cmlhbmdsZWRvd247XCIsXG4gICAgXCI5NjY2XCI6IFwibHRyaWY7XCIsXG4gICAgXCI5NjY3XCI6IFwidHJpYW5nbGVsZWZ0O1wiLFxuICAgIFwiOTY3NFwiOiBcImxvemVuZ2U7XCIsXG4gICAgXCI5Njc1XCI6IFwiY2lyO1wiLFxuICAgIFwiOTcwOFwiOiBcInRyaWRvdDtcIixcbiAgICBcIjk3MTFcIjogXCJ4Y2lyYztcIixcbiAgICBcIjk3MjBcIjogXCJ1bHRyaTtcIixcbiAgICBcIjk3MjFcIjogXCJ1cnRyaTtcIixcbiAgICBcIjk3MjJcIjogXCJsbHRyaTtcIixcbiAgICBcIjk3MjNcIjogXCJFbXB0eVNtYWxsU3F1YXJlO1wiLFxuICAgIFwiOTcyNFwiOiBcIkZpbGxlZFNtYWxsU3F1YXJlO1wiLFxuICAgIFwiOTczM1wiOiBcInN0YXJmO1wiLFxuICAgIFwiOTczNFwiOiBcInN0YXI7XCIsXG4gICAgXCI5NzQyXCI6IFwicGhvbmU7XCIsXG4gICAgXCI5NzkyXCI6IFwiZmVtYWxlO1wiLFxuICAgIFwiOTc5NFwiOiBcIm1hbGU7XCIsXG4gICAgXCI5ODI0XCI6IFwic3BhZGVzdWl0O1wiLFxuICAgIFwiOTgyN1wiOiBcImNsdWJzdWl0O1wiLFxuICAgIFwiOTgyOVwiOiBcImhlYXJ0c3VpdDtcIixcbiAgICBcIjk4MzBcIjogXCJkaWFtcztcIixcbiAgICBcIjk4MzRcIjogXCJzdW5nO1wiLFxuICAgIFwiOTgzN1wiOiBcImZsYXQ7XCIsXG4gICAgXCI5ODM4XCI6IFwibmF0dXJhbDtcIixcbiAgICBcIjk4MzlcIjogXCJzaGFycDtcIixcbiAgICBcIjEwMDAzXCI6IFwiY2hlY2ttYXJrO1wiLFxuICAgIFwiMTAwMDdcIjogXCJjcm9zcztcIixcbiAgICBcIjEwMDE2XCI6IFwibWFsdGVzZTtcIixcbiAgICBcIjEwMDM4XCI6IFwic2V4dDtcIixcbiAgICBcIjEwMDcyXCI6IFwiVmVydGljYWxTZXBhcmF0b3I7XCIsXG4gICAgXCIxMDA5OFwiOiBcImxiYnJrO1wiLFxuICAgIFwiMTAwOTlcIjogXCJyYmJyaztcIixcbiAgICBcIjEwMTg0XCI6IFwiYnNvbGhzdWI7XCIsXG4gICAgXCIxMDE4NVwiOiBcInN1cGhzb2w7XCIsXG4gICAgXCIxMDIxNFwiOiBcImxvYnJrO1wiLFxuICAgIFwiMTAyMTVcIjogXCJyb2JyaztcIixcbiAgICBcIjEwMjE2XCI6IFwiTGVmdEFuZ2xlQnJhY2tldDtcIixcbiAgICBcIjEwMjE3XCI6IFwiUmlnaHRBbmdsZUJyYWNrZXQ7XCIsXG4gICAgXCIxMDIxOFwiOiBcIkxhbmc7XCIsXG4gICAgXCIxMDIxOVwiOiBcIlJhbmc7XCIsXG4gICAgXCIxMDIyMFwiOiBcImxvYW5nO1wiLFxuICAgIFwiMTAyMjFcIjogXCJyb2FuZztcIixcbiAgICBcIjEwMjI5XCI6IFwieGxhcnI7XCIsXG4gICAgXCIxMDIzMFwiOiBcInhyYXJyO1wiLFxuICAgIFwiMTAyMzFcIjogXCJ4aGFycjtcIixcbiAgICBcIjEwMjMyXCI6IFwieGxBcnI7XCIsXG4gICAgXCIxMDIzM1wiOiBcInhyQXJyO1wiLFxuICAgIFwiMTAyMzRcIjogXCJ4aEFycjtcIixcbiAgICBcIjEwMjM2XCI6IFwieG1hcDtcIixcbiAgICBcIjEwMjM5XCI6IFwiZHppZ3JhcnI7XCIsXG4gICAgXCIxMDQ5OFwiOiBcIm52bEFycjtcIixcbiAgICBcIjEwNDk5XCI6IFwibnZyQXJyO1wiLFxuICAgIFwiMTA1MDBcIjogXCJudkhhcnI7XCIsXG4gICAgXCIxMDUwMVwiOiBcIk1hcDtcIixcbiAgICBcIjEwNTA4XCI6IFwibGJhcnI7XCIsXG4gICAgXCIxMDUwOVwiOiBcInJiYXJyO1wiLFxuICAgIFwiMTA1MTBcIjogXCJsQmFycjtcIixcbiAgICBcIjEwNTExXCI6IFwickJhcnI7XCIsXG4gICAgXCIxMDUxMlwiOiBcIlJCYXJyO1wiLFxuICAgIFwiMTA1MTNcIjogXCJERG90cmFoZDtcIixcbiAgICBcIjEwNTE0XCI6IFwiVXBBcnJvd0JhcjtcIixcbiAgICBcIjEwNTE1XCI6IFwiRG93bkFycm93QmFyO1wiLFxuICAgIFwiMTA1MThcIjogXCJSYXJydGw7XCIsXG4gICAgXCIxMDUyMVwiOiBcImxhdGFpbDtcIixcbiAgICBcIjEwNTIyXCI6IFwicmF0YWlsO1wiLFxuICAgIFwiMTA1MjNcIjogXCJsQXRhaWw7XCIsXG4gICAgXCIxMDUyNFwiOiBcInJBdGFpbDtcIixcbiAgICBcIjEwNTI1XCI6IFwibGFycmZzO1wiLFxuICAgIFwiMTA1MjZcIjogXCJyYXJyZnM7XCIsXG4gICAgXCIxMDUyN1wiOiBcImxhcnJiZnM7XCIsXG4gICAgXCIxMDUyOFwiOiBcInJhcnJiZnM7XCIsXG4gICAgXCIxMDUzMVwiOiBcIm53YXJoaztcIixcbiAgICBcIjEwNTMyXCI6IFwibmVhcmhrO1wiLFxuICAgIFwiMTA1MzNcIjogXCJzZWFyaGs7XCIsXG4gICAgXCIxMDUzNFwiOiBcInN3YXJoaztcIixcbiAgICBcIjEwNTM1XCI6IFwibnduZWFyO1wiLFxuICAgIFwiMTA1MzZcIjogXCJ0b2VhO1wiLFxuICAgIFwiMTA1MzdcIjogXCJ0b3NhO1wiLFxuICAgIFwiMTA1MzhcIjogXCJzd253YXI7XCIsXG4gICAgXCIxMDU0N1wiOiBcInJhcnJjO1wiLFxuICAgIFwiMTA1NDlcIjogXCJjdWRhcnJyO1wiLFxuICAgIFwiMTA1NTBcIjogXCJsZGNhO1wiLFxuICAgIFwiMTA1NTFcIjogXCJyZGNhO1wiLFxuICAgIFwiMTA1NTJcIjogXCJjdWRhcnJsO1wiLFxuICAgIFwiMTA1NTNcIjogXCJsYXJycGw7XCIsXG4gICAgXCIxMDU1NlwiOiBcImN1cmFycm07XCIsXG4gICAgXCIxMDU1N1wiOiBcImN1bGFycnA7XCIsXG4gICAgXCIxMDU2NVwiOiBcInJhcnJwbDtcIixcbiAgICBcIjEwNTY4XCI6IFwiaGFycmNpcjtcIixcbiAgICBcIjEwNTY5XCI6IFwiVWFycm9jaXI7XCIsXG4gICAgXCIxMDU3MFwiOiBcImx1cmRzaGFyO1wiLFxuICAgIFwiMTA1NzFcIjogXCJsZHJ1c2hhcjtcIixcbiAgICBcIjEwNTc0XCI6IFwiTGVmdFJpZ2h0VmVjdG9yO1wiLFxuICAgIFwiMTA1NzVcIjogXCJSaWdodFVwRG93blZlY3RvcjtcIixcbiAgICBcIjEwNTc2XCI6IFwiRG93bkxlZnRSaWdodFZlY3RvcjtcIixcbiAgICBcIjEwNTc3XCI6IFwiTGVmdFVwRG93blZlY3RvcjtcIixcbiAgICBcIjEwNTc4XCI6IFwiTGVmdFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTc5XCI6IFwiUmlnaHRWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4MFwiOiBcIlJpZ2h0VXBWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4MVwiOiBcIlJpZ2h0RG93blZlY3RvckJhcjtcIixcbiAgICBcIjEwNTgyXCI6IFwiRG93bkxlZnRWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4M1wiOiBcIkRvd25SaWdodFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTg0XCI6IFwiTGVmdFVwVmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODVcIjogXCJMZWZ0RG93blZlY3RvckJhcjtcIixcbiAgICBcIjEwNTg2XCI6IFwiTGVmdFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTg3XCI6IFwiUmlnaHRUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU4OFwiOiBcIlJpZ2h0VXBUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU4OVwiOiBcIlJpZ2h0RG93blRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTkwXCI6IFwiRG93bkxlZnRUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5MVwiOiBcIkRvd25SaWdodFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTkyXCI6IFwiTGVmdFVwVGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1OTNcIjogXCJMZWZ0RG93blRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTk0XCI6IFwibEhhcjtcIixcbiAgICBcIjEwNTk1XCI6IFwidUhhcjtcIixcbiAgICBcIjEwNTk2XCI6IFwickhhcjtcIixcbiAgICBcIjEwNTk3XCI6IFwiZEhhcjtcIixcbiAgICBcIjEwNTk4XCI6IFwibHVydWhhcjtcIixcbiAgICBcIjEwNTk5XCI6IFwibGRyZGhhcjtcIixcbiAgICBcIjEwNjAwXCI6IFwicnVsdWhhcjtcIixcbiAgICBcIjEwNjAxXCI6IFwicmRsZGhhcjtcIixcbiAgICBcIjEwNjAyXCI6IFwibGhhcnVsO1wiLFxuICAgIFwiMTA2MDNcIjogXCJsbGhhcmQ7XCIsXG4gICAgXCIxMDYwNFwiOiBcInJoYXJ1bDtcIixcbiAgICBcIjEwNjA1XCI6IFwibHJoYXJkO1wiLFxuICAgIFwiMTA2MDZcIjogXCJVcEVxdWlsaWJyaXVtO1wiLFxuICAgIFwiMTA2MDdcIjogXCJSZXZlcnNlVXBFcXVpbGlicml1bTtcIixcbiAgICBcIjEwNjA4XCI6IFwiUm91bmRJbXBsaWVzO1wiLFxuICAgIFwiMTA2MDlcIjogXCJlcmFycjtcIixcbiAgICBcIjEwNjEwXCI6IFwic2ltcmFycjtcIixcbiAgICBcIjEwNjExXCI6IFwibGFycnNpbTtcIixcbiAgICBcIjEwNjEyXCI6IFwicmFycnNpbTtcIixcbiAgICBcIjEwNjEzXCI6IFwicmFycmFwO1wiLFxuICAgIFwiMTA2MTRcIjogXCJsdGxhcnI7XCIsXG4gICAgXCIxMDYxNlwiOiBcImd0cmFycjtcIixcbiAgICBcIjEwNjE3XCI6IFwic3VicmFycjtcIixcbiAgICBcIjEwNjE5XCI6IFwic3VwbGFycjtcIixcbiAgICBcIjEwNjIwXCI6IFwibGZpc2h0O1wiLFxuICAgIFwiMTA2MjFcIjogXCJyZmlzaHQ7XCIsXG4gICAgXCIxMDYyMlwiOiBcInVmaXNodDtcIixcbiAgICBcIjEwNjIzXCI6IFwiZGZpc2h0O1wiLFxuICAgIFwiMTA2MjlcIjogXCJsb3BhcjtcIixcbiAgICBcIjEwNjMwXCI6IFwicm9wYXI7XCIsXG4gICAgXCIxMDYzNVwiOiBcImxicmtlO1wiLFxuICAgIFwiMTA2MzZcIjogXCJyYnJrZTtcIixcbiAgICBcIjEwNjM3XCI6IFwibGJya3NsdTtcIixcbiAgICBcIjEwNjM4XCI6IFwicmJya3NsZDtcIixcbiAgICBcIjEwNjM5XCI6IFwibGJya3NsZDtcIixcbiAgICBcIjEwNjQwXCI6IFwicmJya3NsdTtcIixcbiAgICBcIjEwNjQxXCI6IFwibGFuZ2Q7XCIsXG4gICAgXCIxMDY0MlwiOiBcInJhbmdkO1wiLFxuICAgIFwiMTA2NDNcIjogXCJscGFybHQ7XCIsXG4gICAgXCIxMDY0NFwiOiBcInJwYXJndDtcIixcbiAgICBcIjEwNjQ1XCI6IFwiZ3RsUGFyO1wiLFxuICAgIFwiMTA2NDZcIjogXCJsdHJQYXI7XCIsXG4gICAgXCIxMDY1MFwiOiBcInZ6aWd6YWc7XCIsXG4gICAgXCIxMDY1MlwiOiBcInZhbmdydDtcIixcbiAgICBcIjEwNjUzXCI6IFwiYW5ncnR2YmQ7XCIsXG4gICAgXCIxMDY2MFwiOiBcImFuZ2U7XCIsXG4gICAgXCIxMDY2MVwiOiBcInJhbmdlO1wiLFxuICAgIFwiMTA2NjJcIjogXCJkd2FuZ2xlO1wiLFxuICAgIFwiMTA2NjNcIjogXCJ1d2FuZ2xlO1wiLFxuICAgIFwiMTA2NjRcIjogXCJhbmdtc2RhYTtcIixcbiAgICBcIjEwNjY1XCI6IFwiYW5nbXNkYWI7XCIsXG4gICAgXCIxMDY2NlwiOiBcImFuZ21zZGFjO1wiLFxuICAgIFwiMTA2NjdcIjogXCJhbmdtc2RhZDtcIixcbiAgICBcIjEwNjY4XCI6IFwiYW5nbXNkYWU7XCIsXG4gICAgXCIxMDY2OVwiOiBcImFuZ21zZGFmO1wiLFxuICAgIFwiMTA2NzBcIjogXCJhbmdtc2RhZztcIixcbiAgICBcIjEwNjcxXCI6IFwiYW5nbXNkYWg7XCIsXG4gICAgXCIxMDY3MlwiOiBcImJlbXB0eXY7XCIsXG4gICAgXCIxMDY3M1wiOiBcImRlbXB0eXY7XCIsXG4gICAgXCIxMDY3NFwiOiBcImNlbXB0eXY7XCIsXG4gICAgXCIxMDY3NVwiOiBcInJhZW1wdHl2O1wiLFxuICAgIFwiMTA2NzZcIjogXCJsYWVtcHR5djtcIixcbiAgICBcIjEwNjc3XCI6IFwib2hiYXI7XCIsXG4gICAgXCIxMDY3OFwiOiBcIm9taWQ7XCIsXG4gICAgXCIxMDY3OVwiOiBcIm9wYXI7XCIsXG4gICAgXCIxMDY4MVwiOiBcIm9wZXJwO1wiLFxuICAgIFwiMTA2ODNcIjogXCJvbGNyb3NzO1wiLFxuICAgIFwiMTA2ODRcIjogXCJvZHNvbGQ7XCIsXG4gICAgXCIxMDY4NlwiOiBcIm9sY2lyO1wiLFxuICAgIFwiMTA2ODdcIjogXCJvZmNpcjtcIixcbiAgICBcIjEwNjg4XCI6IFwib2x0O1wiLFxuICAgIFwiMTA2ODlcIjogXCJvZ3Q7XCIsXG4gICAgXCIxMDY5MFwiOiBcImNpcnNjaXI7XCIsXG4gICAgXCIxMDY5MVwiOiBcImNpckU7XCIsXG4gICAgXCIxMDY5MlwiOiBcInNvbGI7XCIsXG4gICAgXCIxMDY5M1wiOiBcImJzb2xiO1wiLFxuICAgIFwiMTA2OTdcIjogXCJib3hib3g7XCIsXG4gICAgXCIxMDcwMVwiOiBcInRyaXNiO1wiLFxuICAgIFwiMTA3MDJcIjogXCJydHJpbHRyaTtcIixcbiAgICBcIjEwNzAzXCI6IFwiTGVmdFRyaWFuZ2xlQmFyO1wiLFxuICAgIFwiMTA3MDRcIjogXCJSaWdodFRyaWFuZ2xlQmFyO1wiLFxuICAgIFwiMTA3MTZcIjogXCJpaW5maW47XCIsXG4gICAgXCIxMDcxN1wiOiBcImluZmludGllO1wiLFxuICAgIFwiMTA3MThcIjogXCJudmluZmluO1wiLFxuICAgIFwiMTA3MjNcIjogXCJlcGFyc2w7XCIsXG4gICAgXCIxMDcyNFwiOiBcInNtZXBhcnNsO1wiLFxuICAgIFwiMTA3MjVcIjogXCJlcXZwYXJzbDtcIixcbiAgICBcIjEwNzMxXCI6IFwibG96ZjtcIixcbiAgICBcIjEwNzQwXCI6IFwiUnVsZURlbGF5ZWQ7XCIsXG4gICAgXCIxMDc0MlwiOiBcImRzb2w7XCIsXG4gICAgXCIxMDc1MlwiOiBcInhvZG90O1wiLFxuICAgIFwiMTA3NTNcIjogXCJ4b3BsdXM7XCIsXG4gICAgXCIxMDc1NFwiOiBcInhvdGltZTtcIixcbiAgICBcIjEwNzU2XCI6IFwieHVwbHVzO1wiLFxuICAgIFwiMTA3NThcIjogXCJ4c3FjdXA7XCIsXG4gICAgXCIxMDc2NFwiOiBcInFpbnQ7XCIsXG4gICAgXCIxMDc2NVwiOiBcImZwYXJ0aW50O1wiLFxuICAgIFwiMTA3NjhcIjogXCJjaXJmbmludDtcIixcbiAgICBcIjEwNzY5XCI6IFwiYXdpbnQ7XCIsXG4gICAgXCIxMDc3MFwiOiBcInJwcG9saW50O1wiLFxuICAgIFwiMTA3NzFcIjogXCJzY3BvbGludDtcIixcbiAgICBcIjEwNzcyXCI6IFwibnBvbGludDtcIixcbiAgICBcIjEwNzczXCI6IFwicG9pbnRpbnQ7XCIsXG4gICAgXCIxMDc3NFwiOiBcInF1YXRpbnQ7XCIsXG4gICAgXCIxMDc3NVwiOiBcImludGxhcmhrO1wiLFxuICAgIFwiMTA3ODZcIjogXCJwbHVzY2lyO1wiLFxuICAgIFwiMTA3ODdcIjogXCJwbHVzYWNpcjtcIixcbiAgICBcIjEwNzg4XCI6IFwic2ltcGx1cztcIixcbiAgICBcIjEwNzg5XCI6IFwicGx1c2R1O1wiLFxuICAgIFwiMTA3OTBcIjogXCJwbHVzc2ltO1wiLFxuICAgIFwiMTA3OTFcIjogXCJwbHVzdHdvO1wiLFxuICAgIFwiMTA3OTNcIjogXCJtY29tbWE7XCIsXG4gICAgXCIxMDc5NFwiOiBcIm1pbnVzZHU7XCIsXG4gICAgXCIxMDc5N1wiOiBcImxvcGx1cztcIixcbiAgICBcIjEwNzk4XCI6IFwicm9wbHVzO1wiLFxuICAgIFwiMTA3OTlcIjogXCJDcm9zcztcIixcbiAgICBcIjEwODAwXCI6IFwidGltZXNkO1wiLFxuICAgIFwiMTA4MDFcIjogXCJ0aW1lc2JhcjtcIixcbiAgICBcIjEwODAzXCI6IFwic21hc2hwO1wiLFxuICAgIFwiMTA4MDRcIjogXCJsb3RpbWVzO1wiLFxuICAgIFwiMTA4MDVcIjogXCJyb3RpbWVzO1wiLFxuICAgIFwiMTA4MDZcIjogXCJvdGltZXNhcztcIixcbiAgICBcIjEwODA3XCI6IFwiT3RpbWVzO1wiLFxuICAgIFwiMTA4MDhcIjogXCJvZGl2O1wiLFxuICAgIFwiMTA4MDlcIjogXCJ0cmlwbHVzO1wiLFxuICAgIFwiMTA4MTBcIjogXCJ0cmltaW51cztcIixcbiAgICBcIjEwODExXCI6IFwidHJpdGltZTtcIixcbiAgICBcIjEwODEyXCI6IFwiaXByb2Q7XCIsXG4gICAgXCIxMDgxNVwiOiBcImFtYWxnO1wiLFxuICAgIFwiMTA4MTZcIjogXCJjYXBkb3Q7XCIsXG4gICAgXCIxMDgxOFwiOiBcIm5jdXA7XCIsXG4gICAgXCIxMDgxOVwiOiBcIm5jYXA7XCIsXG4gICAgXCIxMDgyMFwiOiBcImNhcGFuZDtcIixcbiAgICBcIjEwODIxXCI6IFwiY3Vwb3I7XCIsXG4gICAgXCIxMDgyMlwiOiBcImN1cGNhcDtcIixcbiAgICBcIjEwODIzXCI6IFwiY2FwY3VwO1wiLFxuICAgIFwiMTA4MjRcIjogXCJjdXBicmNhcDtcIixcbiAgICBcIjEwODI1XCI6IFwiY2FwYnJjdXA7XCIsXG4gICAgXCIxMDgyNlwiOiBcImN1cGN1cDtcIixcbiAgICBcIjEwODI3XCI6IFwiY2FwY2FwO1wiLFxuICAgIFwiMTA4MjhcIjogXCJjY3VwcztcIixcbiAgICBcIjEwODI5XCI6IFwiY2NhcHM7XCIsXG4gICAgXCIxMDgzMlwiOiBcImNjdXBzc207XCIsXG4gICAgXCIxMDgzNVwiOiBcIkFuZDtcIixcbiAgICBcIjEwODM2XCI6IFwiT3I7XCIsXG4gICAgXCIxMDgzN1wiOiBcImFuZGFuZDtcIixcbiAgICBcIjEwODM4XCI6IFwib3JvcjtcIixcbiAgICBcIjEwODM5XCI6IFwib3JzbG9wZTtcIixcbiAgICBcIjEwODQwXCI6IFwiYW5kc2xvcGU7XCIsXG4gICAgXCIxMDg0MlwiOiBcImFuZHY7XCIsXG4gICAgXCIxMDg0M1wiOiBcIm9ydjtcIixcbiAgICBcIjEwODQ0XCI6IFwiYW5kZDtcIixcbiAgICBcIjEwODQ1XCI6IFwib3JkO1wiLFxuICAgIFwiMTA4NDdcIjogXCJ3ZWRiYXI7XCIsXG4gICAgXCIxMDg1NFwiOiBcInNkb3RlO1wiLFxuICAgIFwiMTA4NThcIjogXCJzaW1kb3Q7XCIsXG4gICAgXCIxMDg2MVwiOiBcImNvbmdkb3Q7XCIsXG4gICAgXCIxMDg2MlwiOiBcImVhc3RlcjtcIixcbiAgICBcIjEwODYzXCI6IFwiYXBhY2lyO1wiLFxuICAgIFwiMTA4NjRcIjogXCJhcEU7XCIsXG4gICAgXCIxMDg2NVwiOiBcImVwbHVzO1wiLFxuICAgIFwiMTA4NjZcIjogXCJwbHVzZTtcIixcbiAgICBcIjEwODY3XCI6IFwiRXNpbTtcIixcbiAgICBcIjEwODY4XCI6IFwiQ29sb25lO1wiLFxuICAgIFwiMTA4NjlcIjogXCJFcXVhbDtcIixcbiAgICBcIjEwODcxXCI6IFwiZUREb3Q7XCIsXG4gICAgXCIxMDg3MlwiOiBcImVxdWl2REQ7XCIsXG4gICAgXCIxMDg3M1wiOiBcImx0Y2lyO1wiLFxuICAgIFwiMTA4NzRcIjogXCJndGNpcjtcIixcbiAgICBcIjEwODc1XCI6IFwibHRxdWVzdDtcIixcbiAgICBcIjEwODc2XCI6IFwiZ3RxdWVzdDtcIixcbiAgICBcIjEwODc3XCI6IFwiTGVzc1NsYW50RXF1YWw7XCIsXG4gICAgXCIxMDg3OFwiOiBcIkdyZWF0ZXJTbGFudEVxdWFsO1wiLFxuICAgIFwiMTA4NzlcIjogXCJsZXNkb3Q7XCIsXG4gICAgXCIxMDg4MFwiOiBcImdlc2RvdDtcIixcbiAgICBcIjEwODgxXCI6IFwibGVzZG90bztcIixcbiAgICBcIjEwODgyXCI6IFwiZ2VzZG90bztcIixcbiAgICBcIjEwODgzXCI6IFwibGVzZG90b3I7XCIsXG4gICAgXCIxMDg4NFwiOiBcImdlc2RvdG9sO1wiLFxuICAgIFwiMTA4ODVcIjogXCJsZXNzYXBwcm94O1wiLFxuICAgIFwiMTA4ODZcIjogXCJndHJhcHByb3g7XCIsXG4gICAgXCIxMDg4N1wiOiBcImxuZXE7XCIsXG4gICAgXCIxMDg4OFwiOiBcImduZXE7XCIsXG4gICAgXCIxMDg4OVwiOiBcImxuYXBwcm94O1wiLFxuICAgIFwiMTA4OTBcIjogXCJnbmFwcHJveDtcIixcbiAgICBcIjEwODkxXCI6IFwibGVzc2VxcWd0cjtcIixcbiAgICBcIjEwODkyXCI6IFwiZ3RyZXFxbGVzcztcIixcbiAgICBcIjEwODkzXCI6IFwibHNpbWU7XCIsXG4gICAgXCIxMDg5NFwiOiBcImdzaW1lO1wiLFxuICAgIFwiMTA4OTVcIjogXCJsc2ltZztcIixcbiAgICBcIjEwODk2XCI6IFwiZ3NpbWw7XCIsXG4gICAgXCIxMDg5N1wiOiBcImxnRTtcIixcbiAgICBcIjEwODk4XCI6IFwiZ2xFO1wiLFxuICAgIFwiMTA4OTlcIjogXCJsZXNnZXM7XCIsXG4gICAgXCIxMDkwMFwiOiBcImdlc2xlcztcIixcbiAgICBcIjEwOTAxXCI6IFwiZXFzbGFudGxlc3M7XCIsXG4gICAgXCIxMDkwMlwiOiBcImVxc2xhbnRndHI7XCIsXG4gICAgXCIxMDkwM1wiOiBcImVsc2RvdDtcIixcbiAgICBcIjEwOTA0XCI6IFwiZWdzZG90O1wiLFxuICAgIFwiMTA5MDVcIjogXCJlbDtcIixcbiAgICBcIjEwOTA2XCI6IFwiZWc7XCIsXG4gICAgXCIxMDkwOVwiOiBcInNpbWw7XCIsXG4gICAgXCIxMDkxMFwiOiBcInNpbWc7XCIsXG4gICAgXCIxMDkxMVwiOiBcInNpbWxFO1wiLFxuICAgIFwiMTA5MTJcIjogXCJzaW1nRTtcIixcbiAgICBcIjEwOTEzXCI6IFwiTGVzc0xlc3M7XCIsXG4gICAgXCIxMDkxNFwiOiBcIkdyZWF0ZXJHcmVhdGVyO1wiLFxuICAgIFwiMTA5MTZcIjogXCJnbGo7XCIsXG4gICAgXCIxMDkxN1wiOiBcImdsYTtcIixcbiAgICBcIjEwOTE4XCI6IFwibHRjYztcIixcbiAgICBcIjEwOTE5XCI6IFwiZ3RjYztcIixcbiAgICBcIjEwOTIwXCI6IFwibGVzY2M7XCIsXG4gICAgXCIxMDkyMVwiOiBcImdlc2NjO1wiLFxuICAgIFwiMTA5MjJcIjogXCJzbXQ7XCIsXG4gICAgXCIxMDkyM1wiOiBcImxhdDtcIixcbiAgICBcIjEwOTI0XCI6IFwic210ZTtcIixcbiAgICBcIjEwOTI1XCI6IFwibGF0ZTtcIixcbiAgICBcIjEwOTI2XCI6IFwiYnVtcEU7XCIsXG4gICAgXCIxMDkyN1wiOiBcInByZWNlcTtcIixcbiAgICBcIjEwOTI4XCI6IFwic3VjY2VxO1wiLFxuICAgIFwiMTA5MzFcIjogXCJwckU7XCIsXG4gICAgXCIxMDkzMlwiOiBcInNjRTtcIixcbiAgICBcIjEwOTMzXCI6IFwicHJuRTtcIixcbiAgICBcIjEwOTM0XCI6IFwic3VjY25lcXE7XCIsXG4gICAgXCIxMDkzNVwiOiBcInByZWNhcHByb3g7XCIsXG4gICAgXCIxMDkzNlwiOiBcInN1Y2NhcHByb3g7XCIsXG4gICAgXCIxMDkzN1wiOiBcInBybmFwO1wiLFxuICAgIFwiMTA5MzhcIjogXCJzdWNjbmFwcHJveDtcIixcbiAgICBcIjEwOTM5XCI6IFwiUHI7XCIsXG4gICAgXCIxMDk0MFwiOiBcIlNjO1wiLFxuICAgIFwiMTA5NDFcIjogXCJzdWJkb3Q7XCIsXG4gICAgXCIxMDk0MlwiOiBcInN1cGRvdDtcIixcbiAgICBcIjEwOTQzXCI6IFwic3VicGx1cztcIixcbiAgICBcIjEwOTQ0XCI6IFwic3VwcGx1cztcIixcbiAgICBcIjEwOTQ1XCI6IFwic3VibXVsdDtcIixcbiAgICBcIjEwOTQ2XCI6IFwic3VwbXVsdDtcIixcbiAgICBcIjEwOTQ3XCI6IFwic3ViZWRvdDtcIixcbiAgICBcIjEwOTQ4XCI6IFwic3VwZWRvdDtcIixcbiAgICBcIjEwOTQ5XCI6IFwic3Vic2V0ZXFxO1wiLFxuICAgIFwiMTA5NTBcIjogXCJzdXBzZXRlcXE7XCIsXG4gICAgXCIxMDk1MVwiOiBcInN1YnNpbTtcIixcbiAgICBcIjEwOTUyXCI6IFwic3Vwc2ltO1wiLFxuICAgIFwiMTA5NTVcIjogXCJzdWJzZXRuZXFxO1wiLFxuICAgIFwiMTA5NTZcIjogXCJzdXBzZXRuZXFxO1wiLFxuICAgIFwiMTA5NTlcIjogXCJjc3ViO1wiLFxuICAgIFwiMTA5NjBcIjogXCJjc3VwO1wiLFxuICAgIFwiMTA5NjFcIjogXCJjc3ViZTtcIixcbiAgICBcIjEwOTYyXCI6IFwiY3N1cGU7XCIsXG4gICAgXCIxMDk2M1wiOiBcInN1YnN1cDtcIixcbiAgICBcIjEwOTY0XCI6IFwic3Vwc3ViO1wiLFxuICAgIFwiMTA5NjVcIjogXCJzdWJzdWI7XCIsXG4gICAgXCIxMDk2NlwiOiBcInN1cHN1cDtcIixcbiAgICBcIjEwOTY3XCI6IFwic3VwaHN1YjtcIixcbiAgICBcIjEwOTY4XCI6IFwic3VwZHN1YjtcIixcbiAgICBcIjEwOTY5XCI6IFwiZm9ya3Y7XCIsXG4gICAgXCIxMDk3MFwiOiBcInRvcGZvcms7XCIsXG4gICAgXCIxMDk3MVwiOiBcIm1sY3A7XCIsXG4gICAgXCIxMDk4MFwiOiBcIkRvdWJsZUxlZnRUZWU7XCIsXG4gICAgXCIxMDk4MlwiOiBcIlZkYXNobDtcIixcbiAgICBcIjEwOTgzXCI6IFwiQmFydjtcIixcbiAgICBcIjEwOTg0XCI6IFwidkJhcjtcIixcbiAgICBcIjEwOTg1XCI6IFwidkJhcnY7XCIsXG4gICAgXCIxMDk4N1wiOiBcIlZiYXI7XCIsXG4gICAgXCIxMDk4OFwiOiBcIk5vdDtcIixcbiAgICBcIjEwOTg5XCI6IFwiYk5vdDtcIixcbiAgICBcIjEwOTkwXCI6IFwicm5taWQ7XCIsXG4gICAgXCIxMDk5MVwiOiBcImNpcm1pZDtcIixcbiAgICBcIjEwOTkyXCI6IFwibWlkY2lyO1wiLFxuICAgIFwiMTA5OTNcIjogXCJ0b3BjaXI7XCIsXG4gICAgXCIxMDk5NFwiOiBcIm5ocGFyO1wiLFxuICAgIFwiMTA5OTVcIjogXCJwYXJzaW07XCIsXG4gICAgXCIxMTAwNVwiOiBcInBhcnNsO1wiLFxuICAgIFwiNjQyNTZcIjogXCJmZmxpZztcIixcbiAgICBcIjY0MjU3XCI6IFwiZmlsaWc7XCIsXG4gICAgXCI2NDI1OFwiOiBcImZsbGlnO1wiLFxuICAgIFwiNjQyNTlcIjogXCJmZmlsaWc7XCIsXG4gICAgXCI2NDI2MFwiOiBcImZmbGxpZztcIlxufSIsIi8qXG5cblx0SGFzaGlkc1xuXHRodHRwOi8vaGFzaGlkcy5vcmcvbm9kZS1qc1xuXHQoYykgMjAxMyBJdmFuIEFraW1vdlxuXG5cdGh0dHBzOi8vZ2l0aHViLmNvbS9pdmFuYWtpbW92L2hhc2hpZHMubm9kZS5qc1xuXHRoYXNoaWRzIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG4qL1xuXG4vKmpzbGludCBub2RlOiB0cnVlLCB3aGl0ZTogdHJ1ZSwgcGx1c3BsdXM6IHRydWUsIG5vbWVuOiB0cnVlICovXG5cblwidXNlIHN0cmljdFwiO1xuXG5mdW5jdGlvbiBIYXNoaWRzKHNhbHQsIG1pbkhhc2hMZW5ndGgsIGFscGhhYmV0KSB7XG5cblx0dmFyIHVuaXF1ZUFscGhhYmV0LCBpLCBqLCBsZW4sIHNlcHNMZW5ndGgsIGRpZmYsIGd1YXJkQ291bnQ7XG5cblx0aWYgKCEodGhpcyBpbnN0YW5jZW9mIEhhc2hpZHMpKSB7XG5cdFx0cmV0dXJuIG5ldyBIYXNoaWRzKHNhbHQsIG1pbkhhc2hMZW5ndGgsIGFscGhhYmV0KTtcblx0fVxuXG5cdHRoaXMudmVyc2lvbiA9IFwiMS4wLjFcIjtcblxuXHQvKiBpbnRlcm5hbCBzZXR0aW5ncyAqL1xuXG5cdHRoaXMubWluQWxwaGFiZXRMZW5ndGggPSAxNjtcblx0dGhpcy5zZXBEaXYgPSAzLjU7XG5cdHRoaXMuZ3VhcmREaXYgPSAxMjtcblxuXHQvKiBlcnJvciBtZXNzYWdlcyAqL1xuXG5cdHRoaXMuZXJyb3JBbHBoYWJldExlbmd0aCA9IFwiZXJyb3I6IGFscGhhYmV0IG11c3QgY29udGFpbiBhdCBsZWFzdCBYIHVuaXF1ZSBjaGFyYWN0ZXJzXCI7XG5cdHRoaXMuZXJyb3JBbHBoYWJldFNwYWNlID0gXCJlcnJvcjogYWxwaGFiZXQgY2Fubm90IGNvbnRhaW4gc3BhY2VzXCI7XG5cblx0LyogYWxwaGFiZXQgdmFycyAqL1xuXG5cdHRoaXMuYWxwaGFiZXQgPSBcImFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoxMjM0NTY3ODkwXCI7XG5cdHRoaXMuc2VwcyA9IFwiY2ZoaXN0dUNGSElTVFVcIjtcblx0dGhpcy5taW5IYXNoTGVuZ3RoID0gcGFyc2VJbnQobWluSGFzaExlbmd0aCwgMTApID4gMCA/IG1pbkhhc2hMZW5ndGggOiAwO1xuXHR0aGlzLnNhbHQgPSAodHlwZW9mIHNhbHQgPT09IFwic3RyaW5nXCIpID8gc2FsdCA6IFwiXCI7XG5cblx0aWYgKHR5cGVvZiBhbHBoYWJldCA9PT0gXCJzdHJpbmdcIikge1xuXHRcdHRoaXMuYWxwaGFiZXQgPSBhbHBoYWJldDtcblx0fVxuXG5cdGZvciAodW5pcXVlQWxwaGFiZXQgPSBcIlwiLCBpID0gMCwgbGVuID0gdGhpcy5hbHBoYWJldC5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cdFx0aWYgKHVuaXF1ZUFscGhhYmV0LmluZGV4T2YodGhpcy5hbHBoYWJldFtpXSkgPT09IC0xKSB7XG5cdFx0XHR1bmlxdWVBbHBoYWJldCArPSB0aGlzLmFscGhhYmV0W2ldO1xuXHRcdH1cblx0fVxuXG5cdHRoaXMuYWxwaGFiZXQgPSB1bmlxdWVBbHBoYWJldDtcblxuXHRpZiAodGhpcy5hbHBoYWJldC5sZW5ndGggPCB0aGlzLm1pbkFscGhhYmV0TGVuZ3RoKSB7XG5cdFx0dGhyb3cgdGhpcy5lcnJvckFscGhhYmV0TGVuZ3RoLnJlcGxhY2UoXCJYXCIsIHRoaXMubWluQWxwaGFiZXRMZW5ndGgpO1xuXHR9XG5cblx0aWYgKHRoaXMuYWxwaGFiZXQuc2VhcmNoKFwiIFwiKSAhPT0gLTEpIHtcblx0XHR0aHJvdyB0aGlzLmVycm9yQWxwaGFiZXRTcGFjZTtcblx0fVxuXG5cdC8qIHNlcHMgc2hvdWxkIGNvbnRhaW4gb25seSBjaGFyYWN0ZXJzIHByZXNlbnQgaW4gYWxwaGFiZXQ7IGFscGhhYmV0IHNob3VsZCBub3QgY29udGFpbnMgc2VwcyAqL1xuXG5cdGZvciAoaSA9IDAsIGxlbiA9IHRoaXMuc2Vwcy5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cblx0XHRqID0gdGhpcy5hbHBoYWJldC5pbmRleE9mKHRoaXMuc2Vwc1tpXSk7XG5cdFx0aWYgKGogPT09IC0xKSB7XG5cdFx0XHR0aGlzLnNlcHMgPSB0aGlzLnNlcHMuc3Vic3RyKDAsIGkpICsgXCIgXCIgKyB0aGlzLnNlcHMuc3Vic3RyKGkgKyAxKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5hbHBoYWJldCA9IHRoaXMuYWxwaGFiZXQuc3Vic3RyKDAsIGopICsgXCIgXCIgKyB0aGlzLmFscGhhYmV0LnN1YnN0cihqICsgMSk7XG5cdFx0fVxuXG5cdH1cblxuXHR0aGlzLmFscGhhYmV0ID0gdGhpcy5hbHBoYWJldC5yZXBsYWNlKC8gL2csIFwiXCIpO1xuXG5cdHRoaXMuc2VwcyA9IHRoaXMuc2Vwcy5yZXBsYWNlKC8gL2csIFwiXCIpO1xuXHR0aGlzLnNlcHMgPSB0aGlzLmNvbnNpc3RlbnRTaHVmZmxlKHRoaXMuc2VwcywgdGhpcy5zYWx0KTtcblxuXHRpZiAoIXRoaXMuc2Vwcy5sZW5ndGggfHwgKHRoaXMuYWxwaGFiZXQubGVuZ3RoIC8gdGhpcy5zZXBzLmxlbmd0aCkgPiB0aGlzLnNlcERpdikge1xuXG5cdFx0c2Vwc0xlbmd0aCA9IE1hdGguY2VpbCh0aGlzLmFscGhhYmV0Lmxlbmd0aCAvIHRoaXMuc2VwRGl2KTtcblxuXHRcdGlmIChzZXBzTGVuZ3RoID09PSAxKSB7XG5cdFx0XHRzZXBzTGVuZ3RoKys7XG5cdFx0fVxuXG5cdFx0aWYgKHNlcHNMZW5ndGggPiB0aGlzLnNlcHMubGVuZ3RoKSB7XG5cblx0XHRcdGRpZmYgPSBzZXBzTGVuZ3RoIC0gdGhpcy5zZXBzLmxlbmd0aDtcblx0XHRcdHRoaXMuc2VwcyArPSB0aGlzLmFscGhhYmV0LnN1YnN0cigwLCBkaWZmKTtcblx0XHRcdHRoaXMuYWxwaGFiZXQgPSB0aGlzLmFscGhhYmV0LnN1YnN0cihkaWZmKTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNlcHMgPSB0aGlzLnNlcHMuc3Vic3RyKDAsIHNlcHNMZW5ndGgpO1xuXHRcdH1cblxuXHR9XG5cblx0dGhpcy5hbHBoYWJldCA9IHRoaXMuY29uc2lzdGVudFNodWZmbGUodGhpcy5hbHBoYWJldCwgdGhpcy5zYWx0KTtcblx0Z3VhcmRDb3VudCA9IE1hdGguY2VpbCh0aGlzLmFscGhhYmV0Lmxlbmd0aCAvIHRoaXMuZ3VhcmREaXYpO1xuXG5cdGlmICh0aGlzLmFscGhhYmV0Lmxlbmd0aCA8IDMpIHtcblx0XHR0aGlzLmd1YXJkcyA9IHRoaXMuc2Vwcy5zdWJzdHIoMCwgZ3VhcmRDb3VudCk7XG5cdFx0dGhpcy5zZXBzID0gdGhpcy5zZXBzLnN1YnN0cihndWFyZENvdW50KTtcblx0fSBlbHNlIHtcblx0XHR0aGlzLmd1YXJkcyA9IHRoaXMuYWxwaGFiZXQuc3Vic3RyKDAsIGd1YXJkQ291bnQpO1xuXHRcdHRoaXMuYWxwaGFiZXQgPSB0aGlzLmFscGhhYmV0LnN1YnN0cihndWFyZENvdW50KTtcblx0fVxuXG59XG5cbkhhc2hpZHMucHJvdG90eXBlLmVuY29kZSA9IGZ1bmN0aW9uKCkge1xuXG5cdHZhciByZXQgPSBcIlwiLFxuXHRcdGksIGxlbixcblx0XHRudW1iZXJzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuXHRpZiAoIW51bWJlcnMubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdGlmIChudW1iZXJzWzBdIGluc3RhbmNlb2YgQXJyYXkpIHtcblx0XHRudW1iZXJzID0gbnVtYmVyc1swXTtcblx0fVxuXG5cdGZvciAoaSA9IDAsIGxlbiA9IG51bWJlcnMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXHRcdGlmICh0eXBlb2YgbnVtYmVyc1tpXSAhPT0gXCJudW1iZXJcIiB8fCBudW1iZXJzW2ldICUgMSAhPT0gMCB8fCBudW1iZXJzW2ldIDwgMCkge1xuXHRcdFx0cmV0dXJuIHJldDtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdGhpcy5fZW5jb2RlKG51bWJlcnMpO1xuXG59O1xuXG5IYXNoaWRzLnByb3RvdHlwZS5kZWNvZGUgPSBmdW5jdGlvbihoYXNoKSB7XG5cblx0dmFyIHJldCA9IFtdO1xuXG5cdGlmICghaGFzaC5sZW5ndGggfHwgdHlwZW9mIGhhc2ggIT09IFwic3RyaW5nXCIpIHtcblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0cmV0dXJuIHRoaXMuX2RlY29kZShoYXNoLCB0aGlzLmFscGhhYmV0KTtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuZW5jb2RlSGV4ID0gZnVuY3Rpb24oc3RyKSB7XG5cblx0dmFyIGksIGxlbiwgbnVtYmVycztcblxuXHRzdHIgPSBzdHIudG9TdHJpbmcoKTtcblx0aWYgKCEvXlswLTlhLWZBLUZdKyQvLnRlc3Qoc3RyKSkge1xuXHRcdHJldHVybiBcIlwiO1xuXHR9XG5cblx0bnVtYmVycyA9IHN0ci5tYXRjaCgvW1xcd1xcV117MSwxMn0vZyk7XG5cblx0Zm9yIChpID0gMCwgbGVuID0gbnVtYmVycy5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cdFx0bnVtYmVyc1tpXSA9IHBhcnNlSW50KFwiMVwiICsgbnVtYmVyc1tpXSwgMTYpO1xuXHR9XG5cblx0cmV0dXJuIHRoaXMuZW5jb2RlLmFwcGx5KHRoaXMsIG51bWJlcnMpO1xuXG59O1xuXG5IYXNoaWRzLnByb3RvdHlwZS5kZWNvZGVIZXggPSBmdW5jdGlvbihoYXNoKSB7XG5cblx0dmFyIHJldCA9IFwiXCIsXG5cdFx0aSwgbGVuLFxuXHRcdG51bWJlcnMgPSB0aGlzLmRlY29kZShoYXNoKTtcblxuXHRmb3IgKGkgPSAwLCBsZW4gPSBudW1iZXJzLmxlbmd0aDsgaSAhPT0gbGVuOyBpKyspIHtcblx0XHRyZXQgKz0gKG51bWJlcnNbaV0pLnRvU3RyaW5nKDE2KS5zdWJzdHIoMSk7XG5cdH1cblxuXHRyZXR1cm4gcmV0O1xuXG59O1xuXG5IYXNoaWRzLnByb3RvdHlwZS5fZW5jb2RlID0gZnVuY3Rpb24obnVtYmVycykge1xuXG5cdHZhciByZXQsIGxvdHRlcnksIGksIGxlbiwgbnVtYmVyLCBidWZmZXIsIGxhc3QsIHNlcHNJbmRleCwgZ3VhcmRJbmRleCwgZ3VhcmQsIGhhbGZMZW5ndGgsIGV4Y2Vzcyxcblx0XHRhbHBoYWJldCA9IHRoaXMuYWxwaGFiZXQsXG5cdFx0bnVtYmVyc1NpemUgPSBudW1iZXJzLmxlbmd0aCxcblx0XHRudW1iZXJzSGFzaEludCA9IDA7XG5cblx0Zm9yIChpID0gMCwgbGVuID0gbnVtYmVycy5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cdFx0bnVtYmVyc0hhc2hJbnQgKz0gKG51bWJlcnNbaV0gJSAoaSArIDEwMCkpO1xuXHR9XG5cblx0bG90dGVyeSA9IHJldCA9IGFscGhhYmV0W251bWJlcnNIYXNoSW50ICUgYWxwaGFiZXQubGVuZ3RoXTtcblx0Zm9yIChpID0gMCwgbGVuID0gbnVtYmVycy5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cblx0XHRudW1iZXIgPSBudW1iZXJzW2ldO1xuXHRcdGJ1ZmZlciA9IGxvdHRlcnkgKyB0aGlzLnNhbHQgKyBhbHBoYWJldDtcblxuXHRcdGFscGhhYmV0ID0gdGhpcy5jb25zaXN0ZW50U2h1ZmZsZShhbHBoYWJldCwgYnVmZmVyLnN1YnN0cigwLCBhbHBoYWJldC5sZW5ndGgpKTtcblx0XHRsYXN0ID0gdGhpcy5oYXNoKG51bWJlciwgYWxwaGFiZXQpO1xuXG5cdFx0cmV0ICs9IGxhc3Q7XG5cblx0XHRpZiAoaSArIDEgPCBudW1iZXJzU2l6ZSkge1xuXHRcdFx0bnVtYmVyICU9IChsYXN0LmNoYXJDb2RlQXQoMCkgKyBpKTtcblx0XHRcdHNlcHNJbmRleCA9IG51bWJlciAlIHRoaXMuc2Vwcy5sZW5ndGg7XG5cdFx0XHRyZXQgKz0gdGhpcy5zZXBzW3NlcHNJbmRleF07XG5cdFx0fVxuXG5cdH1cblxuXHRpZiAocmV0Lmxlbmd0aCA8IHRoaXMubWluSGFzaExlbmd0aCkge1xuXG5cdFx0Z3VhcmRJbmRleCA9IChudW1iZXJzSGFzaEludCArIHJldFswXS5jaGFyQ29kZUF0KDApKSAlIHRoaXMuZ3VhcmRzLmxlbmd0aDtcblx0XHRndWFyZCA9IHRoaXMuZ3VhcmRzW2d1YXJkSW5kZXhdO1xuXG5cdFx0cmV0ID0gZ3VhcmQgKyByZXQ7XG5cblx0XHRpZiAocmV0Lmxlbmd0aCA8IHRoaXMubWluSGFzaExlbmd0aCkge1xuXG5cdFx0XHRndWFyZEluZGV4ID0gKG51bWJlcnNIYXNoSW50ICsgcmV0WzJdLmNoYXJDb2RlQXQoMCkpICUgdGhpcy5ndWFyZHMubGVuZ3RoO1xuXHRcdFx0Z3VhcmQgPSB0aGlzLmd1YXJkc1tndWFyZEluZGV4XTtcblxuXHRcdFx0cmV0ICs9IGd1YXJkO1xuXG5cdFx0fVxuXG5cdH1cblxuXHRoYWxmTGVuZ3RoID0gcGFyc2VJbnQoYWxwaGFiZXQubGVuZ3RoIC8gMiwgMTApO1xuXHR3aGlsZSAocmV0Lmxlbmd0aCA8IHRoaXMubWluSGFzaExlbmd0aCkge1xuXG5cdFx0YWxwaGFiZXQgPSB0aGlzLmNvbnNpc3RlbnRTaHVmZmxlKGFscGhhYmV0LCBhbHBoYWJldCk7XG5cdFx0cmV0ID0gYWxwaGFiZXQuc3Vic3RyKGhhbGZMZW5ndGgpICsgcmV0ICsgYWxwaGFiZXQuc3Vic3RyKDAsIGhhbGZMZW5ndGgpO1xuXG5cdFx0ZXhjZXNzID0gcmV0Lmxlbmd0aCAtIHRoaXMubWluSGFzaExlbmd0aDtcblx0XHRpZiAoZXhjZXNzID4gMCkge1xuXHRcdFx0cmV0ID0gcmV0LnN1YnN0cihleGNlc3MgLyAyLCB0aGlzLm1pbkhhc2hMZW5ndGgpO1xuXHRcdH1cblxuXHR9XG5cblx0cmV0dXJuIHJldDtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuX2RlY29kZSA9IGZ1bmN0aW9uKGhhc2gsIGFscGhhYmV0KSB7XG5cblx0dmFyIHJldCA9IFtdLFxuXHRcdGkgPSAwLFxuXHRcdGxvdHRlcnksIGxlbiwgc3ViSGFzaCwgYnVmZmVyLFxuXHRcdHIgPSBuZXcgUmVnRXhwKFwiW1wiICsgdGhpcy5ndWFyZHMgKyBcIl1cIiwgXCJnXCIpLFxuXHRcdGhhc2hCcmVha2Rvd24gPSBoYXNoLnJlcGxhY2UociwgXCIgXCIpLFxuXHRcdGhhc2hBcnJheSA9IGhhc2hCcmVha2Rvd24uc3BsaXQoXCIgXCIpO1xuXG5cdGlmIChoYXNoQXJyYXkubGVuZ3RoID09PSAzIHx8IGhhc2hBcnJheS5sZW5ndGggPT09IDIpIHtcblx0XHRpID0gMTtcblx0fVxuXG5cdGhhc2hCcmVha2Rvd24gPSBoYXNoQXJyYXlbaV07XG5cdGlmICh0eXBlb2YgaGFzaEJyZWFrZG93blswXSAhPT0gXCJ1bmRlZmluZWRcIikge1xuXG5cdFx0bG90dGVyeSA9IGhhc2hCcmVha2Rvd25bMF07XG5cdFx0aGFzaEJyZWFrZG93biA9IGhhc2hCcmVha2Rvd24uc3Vic3RyKDEpO1xuXG5cdFx0ciA9IG5ldyBSZWdFeHAoXCJbXCIgKyB0aGlzLnNlcHMgKyBcIl1cIiwgXCJnXCIpO1xuXHRcdGhhc2hCcmVha2Rvd24gPSBoYXNoQnJlYWtkb3duLnJlcGxhY2UociwgXCIgXCIpO1xuXHRcdGhhc2hBcnJheSA9IGhhc2hCcmVha2Rvd24uc3BsaXQoXCIgXCIpO1xuXG5cdFx0Zm9yIChpID0gMCwgbGVuID0gaGFzaEFycmF5Lmxlbmd0aDsgaSAhPT0gbGVuOyBpKyspIHtcblxuXHRcdFx0c3ViSGFzaCA9IGhhc2hBcnJheVtpXTtcblx0XHRcdGJ1ZmZlciA9IGxvdHRlcnkgKyB0aGlzLnNhbHQgKyBhbHBoYWJldDtcblxuXHRcdFx0YWxwaGFiZXQgPSB0aGlzLmNvbnNpc3RlbnRTaHVmZmxlKGFscGhhYmV0LCBidWZmZXIuc3Vic3RyKDAsIGFscGhhYmV0Lmxlbmd0aCkpO1xuXHRcdFx0cmV0LnB1c2godGhpcy51bmhhc2goc3ViSGFzaCwgYWxwaGFiZXQpKTtcblxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9lbmNvZGUocmV0KSAhPT0gaGFzaCkge1xuXHRcdFx0cmV0ID0gW107XG5cdFx0fVxuXG5cdH1cblxuXHRyZXR1cm4gcmV0O1xuXG59O1xuXG5IYXNoaWRzLnByb3RvdHlwZS5jb25zaXN0ZW50U2h1ZmZsZSA9IGZ1bmN0aW9uKGFscGhhYmV0LCBzYWx0KSB7XG5cblx0dmFyIGludGVnZXIsIGosIHRlbXAsIGksIHYsIHA7XG5cblx0aWYgKCFzYWx0Lmxlbmd0aCkge1xuXHRcdHJldHVybiBhbHBoYWJldDtcblx0fVxuXG5cdGZvciAoaSA9IGFscGhhYmV0Lmxlbmd0aCAtIDEsIHYgPSAwLCBwID0gMDsgaSA+IDA7IGktLSwgdisrKSB7XG5cblx0XHR2ICU9IHNhbHQubGVuZ3RoO1xuXHRcdHAgKz0gaW50ZWdlciA9IHNhbHRbdl0uY2hhckNvZGVBdCgwKTtcblx0XHRqID0gKGludGVnZXIgKyB2ICsgcCkgJSBpO1xuXG5cdFx0dGVtcCA9IGFscGhhYmV0W2pdO1xuXHRcdGFscGhhYmV0ID0gYWxwaGFiZXQuc3Vic3RyKDAsIGopICsgYWxwaGFiZXRbaV0gKyBhbHBoYWJldC5zdWJzdHIoaiArIDEpO1xuXHRcdGFscGhhYmV0ID0gYWxwaGFiZXQuc3Vic3RyKDAsIGkpICsgdGVtcCArIGFscGhhYmV0LnN1YnN0cihpICsgMSk7XG5cblx0fVxuXG5cdHJldHVybiBhbHBoYWJldDtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuaGFzaCA9IGZ1bmN0aW9uKGlucHV0LCBhbHBoYWJldCkge1xuXG5cdHZhciBoYXNoID0gXCJcIixcblx0XHRhbHBoYWJldExlbmd0aCA9IGFscGhhYmV0Lmxlbmd0aDtcblxuXHRkbyB7XG5cdFx0aGFzaCA9IGFscGhhYmV0W2lucHV0ICUgYWxwaGFiZXRMZW5ndGhdICsgaGFzaDtcblx0XHRpbnB1dCA9IHBhcnNlSW50KGlucHV0IC8gYWxwaGFiZXRMZW5ndGgsIDEwKTtcblx0fSB3aGlsZSAoaW5wdXQpO1xuXG5cdHJldHVybiBoYXNoO1xuXG59O1xuXG5IYXNoaWRzLnByb3RvdHlwZS51bmhhc2ggPSBmdW5jdGlvbihpbnB1dCwgYWxwaGFiZXQpIHtcblxuXHR2YXIgbnVtYmVyID0gMCwgcG9zLCBpO1xuXG5cdGZvciAoaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKykge1xuXHRcdHBvcyA9IGFscGhhYmV0LmluZGV4T2YoaW5wdXRbaV0pO1xuXHRcdG51bWJlciArPSBwb3MgKiBNYXRoLnBvdyhhbHBoYWJldC5sZW5ndGgsIGlucHV0Lmxlbmd0aCAtIGkgLSAxKTtcblx0fVxuXG5cdHJldHVybiBudW1iZXI7XG5cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSGFzaGlkcztcbiIsIkFuYWx5dGljcyAgICA9IHJlcXVpcmUgJy4vdXRpbHMvQW5hbHl0aWNzJ1xuQXV0aE1hbmFnZXIgID0gcmVxdWlyZSAnLi91dGlscy9BdXRoTWFuYWdlcidcblNoYXJlICAgICAgICA9IHJlcXVpcmUgJy4vdXRpbHMvU2hhcmUnXG5GYWNlYm9vayAgICAgPSByZXF1aXJlICcuL3V0aWxzL0ZhY2Vib29rJ1xuR29vZ2xlUGx1cyAgID0gcmVxdWlyZSAnLi91dGlscy9Hb29nbGVQbHVzJ1xuVGVtcGxhdGVzICAgID0gcmVxdWlyZSAnLi9kYXRhL1RlbXBsYXRlcydcbkxvY2FsZSAgICAgICA9IHJlcXVpcmUgJy4vZGF0YS9Mb2NhbGUnXG5Sb3V0ZXIgICAgICAgPSByZXF1aXJlICcuL3JvdXRlci9Sb3V0ZXInXG5OYXYgICAgICAgICAgPSByZXF1aXJlICcuL3JvdXRlci9OYXYnXG5BcHBEYXRhICAgICAgPSByZXF1aXJlICcuL0FwcERhdGEnXG5BcHBWaWV3ICAgICAgPSByZXF1aXJlICcuL0FwcFZpZXcnXG5NZWRpYVF1ZXJpZXMgPSByZXF1aXJlICcuL3V0aWxzL01lZGlhUXVlcmllcydcblxuY2xhc3MgQXBwXG5cbiAgICBMSVZFICAgICAgIDogbnVsbFxuICAgIEJBU0VfVVJMICAgOiB3aW5kb3cuY29uZmlnLmhvc3RuYW1lXG4gICAgU0lURV9VUkwgICA6IHdpbmRvdy5jb25maWcuU0lURV9VUkxcbiAgICBBUElfSE9TVCAgIDogd2luZG93LmNvbmZpZy5BUElfSE9TVFxuICAgIGxvY2FsZUNvZGUgOiB3aW5kb3cuY29uZmlnLmxvY2FsZUNvZGVcbiAgICBvYmpSZWFkeSAgIDogMFxuXG4gICAgX3RvQ2xlYW4gICA6IFsnb2JqUmVhZHknLCAnc2V0RmxhZ3MnLCAnb2JqZWN0Q29tcGxldGUnLCAnaW5pdCcsICdpbml0T2JqZWN0cycsICdpbml0U0RLcycsICdpbml0QXBwJywgJ2dvJywgJ2NsZWFudXAnLCAnX3RvQ2xlYW4nXVxuXG4gICAgY29uc3RydWN0b3IgOiAoQExJVkUpIC0+XG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgIHNldEZsYWdzIDogPT5cblxuICAgICAgICB1YSA9IHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKClcblxuICAgICAgICBNZWRpYVF1ZXJpZXMuc2V0dXAoKTtcblxuICAgICAgICBASVNfQU5EUk9JRCAgICA9IHVhLmluZGV4T2YoJ2FuZHJvaWQnKSA+IC0xXG4gICAgICAgIEBJU19GSVJFRk9YICAgID0gdWEuaW5kZXhPZignZmlyZWZveCcpID4gLTFcbiAgICAgICAgQElTX0NIUk9NRV9JT1MgPSBpZiB1YS5tYXRjaCgnY3Jpb3MnKSB0aGVuIHRydWUgZWxzZSBmYWxzZSAjIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEzODA4MDUzXG5cbiAgICAgICAgbnVsbFxuXG4gICAgb2JqZWN0Q29tcGxldGUgOiA9PlxuXG4gICAgICAgIEBvYmpSZWFkeSsrXG4gICAgICAgIEBpbml0QXBwKCkgaWYgQG9ialJlYWR5ID49IDRcblxuICAgICAgICBudWxsXG5cbiAgICBpbml0IDogPT5cblxuICAgICAgICBAaW5pdE9iamVjdHMoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGluaXRPYmplY3RzIDogPT5cblxuICAgICAgICBAYXBwRGF0YSAgID0gbmV3IEFwcERhdGEgQG9iamVjdENvbXBsZXRlXG4gICAgICAgIEB0ZW1wbGF0ZXMgPSBuZXcgVGVtcGxhdGVzIHdpbmRvdy5fVEVNUExBVEVTLCBAb2JqZWN0Q29tcGxldGVcbiAgICAgICAgQGxvY2FsZSAgICA9IG5ldyBMb2NhbGUgd2luZG93Ll9MT0NBTEVfU1RSSU5HUywgQG9iamVjdENvbXBsZXRlXG4gICAgICAgIEBhbmFseXRpY3MgPSBuZXcgQW5hbHl0aWNzIHdpbmRvdy5fVFJBQ0tJTkcsIEBvYmplY3RDb21wbGV0ZVxuXG4gICAgICAgICMgaWYgbmV3IG9iamVjdHMgYXJlIGFkZGVkIGRvbid0IGZvcmdldCB0byBjaGFuZ2UgdGhlIGBAb2JqZWN0Q29tcGxldGVgIGZ1bmN0aW9uXG5cbiAgICAgICAgbnVsbFxuXG4gICAgaW5pdFNES3MgOiA9PlxuXG4gICAgICAgIEZhY2Vib29rLmxvYWQoKVxuICAgICAgICBHb29nbGVQbHVzLmxvYWQoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGluaXRBcHAgOiA9PlxuXG4gICAgICAgIEBzZXRGbGFncygpXG5cbiAgICAgICAgIyMjIFN0YXJ0cyBhcHBsaWNhdGlvbiAjIyNcbiAgICAgICAgQGFwcFZpZXcgPSBuZXcgQXBwVmlld1xuICAgICAgICBAcm91dGVyICA9IG5ldyBSb3V0ZXJcbiAgICAgICAgQG5hdiAgICAgPSBuZXcgTmF2XG4gICAgICAgIEBhdXRoICAgID0gbmV3IEF1dGhNYW5hZ2VyXG4gICAgICAgIEBzaGFyZSAgID0gbmV3IFNoYXJlXG5cbiAgICAgICAgQGdvKClcblxuICAgICAgICBAaW5pdFNES3MoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGdvIDogPT5cblxuICAgICAgICAjIyMgQWZ0ZXIgZXZlcnl0aGluZyBpcyBsb2FkZWQsIGtpY2tzIG9mZiB3ZWJzaXRlICMjI1xuICAgICAgICBAYXBwVmlldy5yZW5kZXIoKVxuXG4gICAgICAgICMjIyByZW1vdmUgcmVkdW5kYW50IGluaXRpYWxpc2F0aW9uIG1ldGhvZHMgLyBwcm9wZXJ0aWVzICMjI1xuICAgICAgICBAY2xlYW51cCgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgY2xlYW51cCA6ID0+XG5cbiAgICAgICAgZm9yIGZuIGluIEBfdG9DbGVhblxuICAgICAgICAgICAgQFtmbl0gPSBudWxsXG4gICAgICAgICAgICBkZWxldGUgQFtmbl1cblxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQXBwXG4iLCJBYnN0cmFjdERhdGEgICAgICA9IHJlcXVpcmUgJy4vZGF0YS9BYnN0cmFjdERhdGEnXG5SZXF1ZXN0ZXIgICAgICAgICA9IHJlcXVpcmUgJy4vdXRpbHMvUmVxdWVzdGVyJ1xuQVBJICAgICAgICAgICAgICAgPSByZXF1aXJlICcuL2RhdGEvQVBJJ1xuRG9vZGxlc0NvbGxlY3Rpb24gPSByZXF1aXJlICcuL2NvbGxlY3Rpb25zL2Rvb2RsZXMvRG9vZGxlc0NvbGxlY3Rpb24nXG5cbmNsYXNzIEFwcERhdGEgZXh0ZW5kcyBBYnN0cmFjdERhdGFcblxuICAgIGNhbGxiYWNrIDogbnVsbFxuXG4gICAgRE9PRExFX0NBQ0hFX0VYUElSRVMgOiA5OTk5OTk5OTk5OTk5OTk5OVxuXG4gICAgY29uc3RydWN0b3IgOiAoQGNhbGxiYWNrKSAtPlxuXG4gICAgICAgIHN1cGVyKClcblxuICAgICAgICBAZG9vZGxlcyA9IG5ldyBEb29kbGVzQ29sbGVjdGlvblxuXG4gICAgICAgIEBjaGVja0Rvb2RsZUNhY2hlKClcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgY2hlY2tEb29kbGVDYWNoZSA6ID0+XG5cbiAgICAgICAgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQgbnVsbCwgKGNhY2hlZERhdGEpID0+XG5cbiAgICAgICAgICAgIGlmIF8uaXNFbXB0eSBjYWNoZWREYXRhXG4gICAgICAgICAgICAgICAgcmV0dXJuIEBmZXRjaERvb2RsZXMoKVxuXG4gICAgICAgICAgICBjYWNoZWREb29kbGVzID0gW11cbiAgICAgICAgICAgIChpZiBpbmRleCBpc250ICdsYXN0VXBkYXRlZCcgdGhlbiBjYWNoZWREb29kbGVzLnB1c2goSlNPTi5wYXJzZShkYXRhKSkpIGZvciBpbmRleCwgZGF0YSBvZiBjYWNoZWREYXRhXG5cbiAgICAgICAgICAgIGlmICgoRGF0ZS5ub3coKSAtIGNhY2hlZERhdGEubGFzdFVwZGF0ZWQpID4gQERPT0RMRV9DQUNIRV9FWFBJUkVTKVxuICAgICAgICAgICAgICAgIEBmZXRjaERvb2RsZXMgY2FjaGVkRG9vZGxlc1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIEBzZXREb29kbGVzKGNhY2hlZERvb2RsZXMpLnNldEFjdGl2ZURvb2RsZSgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgZmV0Y2hEb29kbGVzIDogKGNhY2hlZERvb2RsZXM9ZmFsc2UpID0+XG5cbiAgICAgICAgciA9IFJlcXVlc3Rlci5yZXF1ZXN0XG4gICAgICAgICAgICB1cmwgIDogQVBJLmdldCgnZG9vZGxlcycpXG4gICAgICAgICAgICB0eXBlIDogJ0dFVCdcblxuICAgICAgICByLmRvbmUgKGRhdGEpID0+IEBvbkZldGNoRG9vZGxlc0RvbmUgZGF0YSwgY2FjaGVkRG9vZGxlc1xuICAgICAgICByLmZhaWwgKHJlcykgPT4gY29uc29sZS5lcnJvciBcImVycm9yIGxvYWRpbmcgYXBpIHN0YXJ0IGRhdGFcIiwgcmVzXG5cbiAgICAgICAgbnVsbFxuXG4gICAgb25GZXRjaERvb2RsZXNEb25lIDogKGRhdGEsIGNhY2hlZERvb2RsZXM9ZmFsc2UpID0+XG5cbiAgICAgICAgY29uc29sZS5sb2cgXCJvbkZldGNoRG9vZGxlc0RvbmUgOiAoZGF0YSkgPT5cIiwgZGF0YSwgY2FjaGVkRG9vZGxlc1xuXG4gICAgICAgIGlmIGNhY2hlZERvb2RsZXNcbiAgICAgICAgICAgIEB1cGRhdGVEb29kbGVzKF8uc2h1ZmZsZShkYXRhLmRvb2RsZXMpLCBjYWNoZWREb29kbGVzKS5zZXRBY3RpdmVEb29kbGUoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICBAc2V0RG9vZGxlcyhfLnNodWZmbGUoZGF0YS5kb29kbGVzKSkuc2V0QWN0aXZlRG9vZGxlKClcblxuICAgICAgICBudWxsXG5cbiAgICBzZXREb29kbGVzIDogKGRvb2RsZXMpID0+XG5cbiAgICAgICAgQGRvb2RsZXMuYWRkIGRvb2RsZXNcblxuICAgICAgICBAXG5cbiAgICB1cGRhdGVEb29kbGVzIDogKG5ld0Rvb2RsZXMsIGNhY2hlZERvb2RsZXMpID0+XG5cbiAgICAgICAgQGRvb2RsZXMuYWRkIGNhY2hlZERvb2RsZXNcbiAgICAgICAgQGRvb2RsZXMuYWRkTmV3IG5ld0Rvb2RsZXNcblxuICAgICAgICBAXG5cbiAgICBzZXRBY3RpdmVEb29kbGUgOiA9PlxuXG4gICAgICAgIEBhY3RpdmVEb29kbGUgPSBAZG9vZGxlcy5nZXROZXh0RG9vZGxlKClcbiAgICAgICAgQGNhbGxiYWNrPygpXG5cbiAgICAgICAgQHVwZGF0ZUNhY2hlKClcblxuICAgICAgICBudWxsXG5cbiAgICB1cGRhdGVDYWNoZSA6ID0+XG5cbiAgICAgICAgY2hyb21lLnN0b3JhZ2Uuc3luYy5jbGVhciA9PlxuXG4gICAgICAgICAgICBuZXdDYWNoZSA9IGxhc3RVcGRhdGVkIDogRGF0ZS5ub3coKVxuICAgICAgICAgICAgKG5ld0NhY2hlW3Bvc2l0aW9uXSA9IEpTT04uc3RyaW5naWZ5IGRvb2RsZSkgZm9yIGRvb2RsZSwgcG9zaXRpb24gaW4gQGRvb2RsZXMubW9kZWxzXG5cbiAgICAgICAgICAgIGNocm9tZS5zdG9yYWdlLnN5bmMuc2V0IG5ld0NhY2hlXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFwcERhdGFcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4vdmlldy9BYnN0cmFjdFZpZXcnXG5QcmVsb2FkZXIgICAgPSByZXF1aXJlICcuL3ZpZXcvYmFzZS9QcmVsb2FkZXInXG5IZWFkZXIgICAgICAgPSByZXF1aXJlICcuL3ZpZXcvYmFzZS9IZWFkZXInXG5XcmFwcGVyICAgICAgPSByZXF1aXJlICcuL3ZpZXcvYmFzZS9XcmFwcGVyJ1xuRm9vdGVyICAgICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvRm9vdGVyJ1xuTW9kYWxNYW5hZ2VyID0gcmVxdWlyZSAnLi92aWV3L21vZGFscy9fTW9kYWxNYW5hZ2VyJ1xuTWVkaWFRdWVyaWVzID0gcmVxdWlyZSAnLi91dGlscy9NZWRpYVF1ZXJpZXMnXG5cbmNsYXNzIEFwcFZpZXcgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuICAgIHRlbXBsYXRlIDogJ21haW4nXG5cbiAgICAkd2luZG93ICA6IG51bGxcbiAgICAkYm9keSAgICA6IG51bGxcblxuICAgIHdyYXBwZXIgIDogbnVsbFxuICAgIGZvb3RlciAgIDogbnVsbFxuXG4gICAgZGltcyA6XG4gICAgICAgIHcgOiBudWxsXG4gICAgICAgIGggOiBudWxsXG4gICAgICAgIG8gOiBudWxsXG4gICAgICAgIGMgOiBudWxsXG5cbiAgICBldmVudHMgOlxuICAgICAgICAnY2xpY2sgYScgOiAnbGlua01hbmFnZXInXG5cbiAgICBFVkVOVF9VUERBVEVfRElNRU5TSU9OUyA6ICdFVkVOVF9VUERBVEVfRElNRU5TSU9OUydcblxuICAgIE1PQklMRV9XSURUSCA6IDcwMFxuICAgIE1PQklMRSAgICAgICA6ICdtb2JpbGUnXG4gICAgTk9OX01PQklMRSAgIDogJ25vbl9tb2JpbGUnXG5cbiAgICBjb25zdHJ1Y3RvciA6IC0+XG5cbiAgICAgICAgQCR3aW5kb3cgPSAkKHdpbmRvdylcbiAgICAgICAgQCRib2R5ICAgPSAkKCdib2R5JykuZXEoMClcblxuICAgICAgICBzdXBlcigpXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgIGRpc2FibGVUb3VjaDogPT5cblxuICAgICAgICBAJHdpbmRvdy5vbiAndG91Y2htb3ZlJywgQG9uVG91Y2hNb3ZlXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBlbmFibGVUb3VjaDogPT5cblxuICAgICAgICBAJHdpbmRvdy5vZmYgJ3RvdWNobW92ZScsIEBvblRvdWNoTW92ZVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgb25Ub3VjaE1vdmU6ICggZSApIC0+XG5cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICByZW5kZXIgOiA9PlxuXG4gICAgICAgIEBiaW5kRXZlbnRzKClcblxuICAgICAgICBAcHJlbG9hZGVyICAgID0gbmV3IFByZWxvYWRlclxuICAgICAgICBAbW9kYWxNYW5hZ2VyID0gbmV3IE1vZGFsTWFuYWdlclxuXG4gICAgICAgIEBoZWFkZXIgID0gbmV3IEhlYWRlclxuICAgICAgICBAd3JhcHBlciA9IG5ldyBXcmFwcGVyXG4gICAgICAgIEBmb290ZXIgID0gbmV3IEZvb3RlclxuXG4gICAgICAgIEBcbiAgICAgICAgICAgIC5hZGRDaGlsZCBAaGVhZGVyXG4gICAgICAgICAgICAuYWRkQ2hpbGQgQHdyYXBwZXJcbiAgICAgICAgICAgIC5hZGRDaGlsZCBAZm9vdGVyXG5cbiAgICAgICAgQG9uQWxsUmVuZGVyZWQoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgYmluZEV2ZW50cyA6ID0+XG5cbiAgICAgICAgQG9uICdhbGxSZW5kZXJlZCcsIEBvbkFsbFJlbmRlcmVkXG5cbiAgICAgICAgQG9uUmVzaXplKClcblxuICAgICAgICBAb25SZXNpemUgPSBfLmRlYm91bmNlIEBvblJlc2l6ZSwgMzAwXG4gICAgICAgIEAkd2luZG93Lm9uICdyZXNpemUgb3JpZW50YXRpb25jaGFuZ2UnLCBAb25SZXNpemVcblxuICAgICAgICByZXR1cm5cblxuICAgIG9uQWxsUmVuZGVyZWQgOiA9PlxuXG4gICAgICAgICMgY29uc29sZS5sb2cgXCJvbkFsbFJlbmRlcmVkIDogPT5cIlxuXG4gICAgICAgIEAkYm9keS5wcmVwZW5kIEAkZWxcblxuICAgICAgICBAYmVnaW4oKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgYmVnaW4gOiA9PlxuXG4gICAgICAgIEB0cmlnZ2VyICdzdGFydCdcblxuICAgICAgICBAQ0RfQ0UoKS5yb3V0ZXIuc3RhcnQoKVxuXG4gICAgICAgIEBwcmVsb2FkZXIuaGlkZSgpXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBvblJlc2l6ZSA6ID0+XG5cbiAgICAgICAgQGdldERpbXMoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgZ2V0RGltcyA6ID0+XG5cbiAgICAgICAgdyA9IHdpbmRvdy5pbm5lcldpZHRoIG9yIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCBvciBkb2N1bWVudC5ib2R5LmNsaWVudFdpZHRoXG4gICAgICAgIGggPSB3aW5kb3cuaW5uZXJIZWlnaHQgb3IgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCBvciBkb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodFxuXG4gICAgICAgIEBkaW1zID1cbiAgICAgICAgICAgIHcgOiB3XG4gICAgICAgICAgICBoIDogaFxuICAgICAgICAgICAgbyA6IGlmIGggPiB3IHRoZW4gJ3BvcnRyYWl0JyBlbHNlICdsYW5kc2NhcGUnXG4gICAgICAgICAgICBjIDogaWYgdyA8PSBATU9CSUxFX1dJRFRIIHRoZW4gQE1PQklMRSBlbHNlIEBOT05fTU9CSUxFXG5cbiAgICAgICAgQHRyaWdnZXIgQEVWRU5UX1VQREFURV9ESU1FTlNJT05TLCBAZGltc1xuXG4gICAgICAgIHJldHVyblxuXG4gICAgbGlua01hbmFnZXIgOiAoZSkgPT5cblxuICAgICAgICBocmVmID0gJChlLmN1cnJlbnRUYXJnZXQpLmF0dHIoJ2hyZWYnKVxuXG4gICAgICAgIHJldHVybiBmYWxzZSB1bmxlc3MgaHJlZlxuXG4gICAgICAgIEBuYXZpZ2F0ZVRvVXJsIGhyZWYsIGVcblxuICAgICAgICByZXR1cm5cblxuICAgIG5hdmlnYXRlVG9VcmwgOiAoIGhyZWYsIGUgPSBudWxsICkgPT5cblxuICAgICAgICByb3V0ZSAgID0gaWYgaHJlZi5tYXRjaChAQ0RfQ0UoKS5CQVNFX1VSTCkgdGhlbiBocmVmLnNwbGl0KEBDRF9DRSgpLkJBU0VfVVJMKVsxXSBlbHNlIGhyZWZcbiAgICAgICAgc2VjdGlvbiA9IGlmIHJvdXRlLmluZGV4T2YoJy8nKSBpcyAwIHRoZW4gcm91dGUuc3BsaXQoJy8nKVsxXSBlbHNlIHJvdXRlXG5cbiAgICAgICAgaWYgQENEX0NFKCkubmF2LmdldFNlY3Rpb24gc2VjdGlvblxuICAgICAgICAgICAgZT8ucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgICAgQENEX0NFKCkucm91dGVyLm5hdmlnYXRlVG8gcm91dGVcbiAgICAgICAgZWxzZSBcbiAgICAgICAgICAgIEBoYW5kbGVFeHRlcm5hbExpbmsgaHJlZlxuXG4gICAgICAgIHJldHVyblxuXG4gICAgaGFuZGxlRXh0ZXJuYWxMaW5rIDogKGRhdGEpID0+IFxuXG4gICAgICAgICMjI1xuXG4gICAgICAgIGJpbmQgdHJhY2tpbmcgZXZlbnRzIGlmIG5lY2Vzc2FyeVxuXG4gICAgICAgICMjI1xuXG4gICAgICAgIHJldHVyblxuXG5tb2R1bGUuZXhwb3J0cyA9IEFwcFZpZXdcbiIsImNsYXNzIEFic3RyYWN0Q29sbGVjdGlvbiBleHRlbmRzIEJhY2tib25lLkNvbGxlY3Rpb25cblxuXHRDRF9DRSA6ID0+XG5cblx0XHRyZXR1cm4gd2luZG93LkNEX0NFXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RDb2xsZWN0aW9uXG4iLCJUZW1wbGF0ZU1vZGVsID0gcmVxdWlyZSAnLi4vLi4vbW9kZWxzL2NvcmUvVGVtcGxhdGVNb2RlbCdcblxuY2xhc3MgVGVtcGxhdGVzQ29sbGVjdGlvbiBleHRlbmRzIEJhY2tib25lLkNvbGxlY3Rpb25cblxuXHRtb2RlbCA6IFRlbXBsYXRlTW9kZWxcblxubW9kdWxlLmV4cG9ydHMgPSBUZW1wbGF0ZXNDb2xsZWN0aW9uXG4iLCJBYnN0cmFjdENvbGxlY3Rpb24gPSByZXF1aXJlICcuLi9BYnN0cmFjdENvbGxlY3Rpb24nXG5Eb29kbGVNb2RlbCAgICAgICAgPSByZXF1aXJlICcuLi8uLi9tb2RlbHMvZG9vZGxlL0Rvb2RsZU1vZGVsJ1xuXG5jbGFzcyBEb29kbGVzQ29sbGVjdGlvbiBleHRlbmRzIEFic3RyYWN0Q29sbGVjdGlvblxuXG4gICAgbW9kZWwgOiBEb29kbGVNb2RlbFxuXG4gICAgZ2V0RG9vZGxlQnlTbHVnIDogKHNsdWcpID0+XG5cbiAgICAgICAgZG9vZGxlID0gQGZpbmRXaGVyZSBzbHVnIDogc2x1Z1xuXG4gICAgICAgIGlmICFkb29kbGVcbiAgICAgICAgICAgIGNvbnNvbGUubG9nIFwieSB1IG5vIGRvb2RsZT9cIlxuXG4gICAgICAgIHJldHVybiBkb29kbGVcblxuICAgIGdldERvb2RsZUJ5TmF2U2VjdGlvbiA6ICh3aGljaFNlY3Rpb24pID0+XG5cbiAgICAgICAgc2VjdGlvbiA9IEBDRF9DRSgpLm5hdlt3aGljaFNlY3Rpb25dXG5cbiAgICAgICAgZG9vZGxlID0gQGZpbmRXaGVyZSBzbHVnIDogXCIje3NlY3Rpb24uc3VifS8je3NlY3Rpb24udGVyfVwiXG5cbiAgICAgICAgZG9vZGxlXG5cbiAgICBnZXRQcmV2RG9vZGxlIDogKGRvb2RsZSkgPT5cblxuICAgICAgICBpbmRleCA9IEBpbmRleE9mIGRvb2RsZVxuICAgICAgICBpbmRleC0tXG5cbiAgICAgICAgaWYgaW5kZXggPCAwXG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgcmV0dXJuIEBhdCBpbmRleFxuXG4gICAgZ2V0TmV4dERvb2RsZSA6IChkb29kbGUpID0+XG5cbiAgICAgICAgaW5kZXggPSBAaW5kZXhPZiBkb29kbGVcbiAgICAgICAgaW5kZXgrK1xuXG4gICAgICAgIGlmIGluZGV4ID4gKEBsZW5ndGgubGVuZ3RoLTEpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgcmV0dXJuIEBhdCBpbmRleFxuXG4gICAgYWRkTmV3IDogKGRvb2RsZXMpID0+XG5cbiAgICAgICAgZm9yIGRvb2RsZSBpbiBkb29kbGVzXG4gICAgICAgICAgICBpZiAhQGZpbmRXaGVyZSggaW5kZXggOiBkb29kbGUuaW5kZXggKVxuICAgICAgICAgICAgICAgIEBhZGQgZG9vZGxlXG5cbiAgICAgICAgbnVsbFxuXG4gICAgZ2V0TmV4dERvb2RsZSA6ID0+XG5cbiAgICAgICAgZm9yIGRvb2RsZSBpbiBAbW9kZWxzXG5cbiAgICAgICAgICAgIGlmICFkb29kbGUuZ2V0KCd2aWV3ZWQnKVxuICAgICAgICAgICAgICAgIGRvb2RsZS5zZXQoJ3ZpZXdlZCcsIHRydWUpXG4gICAgICAgICAgICAgICAgbmV4dERvb2RsZSA9IGRvb2RsZVxuICAgICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgaWYgIW5leHREb29kbGVcbiAgICAgICAgICAgIGNvbnNvbGUubG9nICd3YWFhYWEgdSBzZWVuIHRoZW0gYWxsPyEnXG4gICAgICAgICAgICBuZXh0RG9vZGxlID0gXy5zaHVmZmxlKEBtb2RlbHMpWzBdXG5cbiAgICAgICAgbmV4dERvb2RsZVxuXG5tb2R1bGUuZXhwb3J0cyA9IERvb2RsZXNDb2xsZWN0aW9uXG4iLCJBUElSb3V0ZU1vZGVsID0gcmVxdWlyZSAnLi4vbW9kZWxzL2NvcmUvQVBJUm91dGVNb2RlbCdcblxuY2xhc3MgQVBJXG5cblx0QG1vZGVsIDogbmV3IEFQSVJvdXRlTW9kZWxcblxuXHRAZ2V0Q29udGFudHMgOiA9PlxuXG5cdFx0IyMjIGFkZCBtb3JlIGlmIHdlIHdhbm5hIHVzZSBpbiBBUEkgc3RyaW5ncyAjIyNcblx0XHRBUElfSE9TVCA6IEBDRF9DRSgpLkFQSV9IT1NUXG5cblx0QGdldCA6IChuYW1lLCB2YXJzKSA9PlxuXG5cdFx0dmFycyA9ICQuZXh0ZW5kIHRydWUsIHZhcnMsIEBnZXRDb250YW50cygpXG5cdFx0cmV0dXJuIEBzdXBwbGFudFN0cmluZyBAbW9kZWwuZ2V0KG5hbWUpLCB2YXJzXG5cblx0QHN1cHBsYW50U3RyaW5nIDogKHN0ciwgdmFscykgLT5cblxuXHRcdHJldHVybiBzdHIucmVwbGFjZSAve3sgKFtee31dKikgfX0vZywgKGEsIGIpIC0+XG5cdFx0XHRyID0gdmFsc1tiXSBvciBpZiB0eXBlb2YgdmFsc1tiXSBpcyAnbnVtYmVyJyB0aGVuIHZhbHNbYl0udG9TdHJpbmcoKSBlbHNlICcnXG5cdFx0KGlmIHR5cGVvZiByIGlzIFwic3RyaW5nXCIgb3IgdHlwZW9mIHIgaXMgXCJudW1iZXJcIiB0aGVuIHIgZWxzZSBhKVxuXG5cdEBDRF9DRSA6ID0+XG5cblx0XHRyZXR1cm4gd2luZG93LkNEX0NFXG5cbm1vZHVsZS5leHBvcnRzID0gQVBJXG4iLCJjbGFzcyBBYnN0cmFjdERhdGFcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRfLmV4dGVuZCBALCBCYWNrYm9uZS5FdmVudHNcblxuXHRcdHJldHVybiBudWxsXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0RGF0YVxuIiwiTG9jYWxlc01vZGVsID0gcmVxdWlyZSAnLi4vbW9kZWxzL2NvcmUvTG9jYWxlc01vZGVsJ1xuQVBJICAgICAgICAgID0gcmVxdWlyZSAnLi4vZGF0YS9BUEknXG5cbiMjI1xuIyBMb2NhbGUgTG9hZGVyICNcblxuRmlyZXMgYmFjayBhbiBldmVudCB3aGVuIGNvbXBsZXRlXG5cbiMjI1xuY2xhc3MgTG9jYWxlXG5cbiAgICBsYW5nICAgICA6IG51bGxcbiAgICBkYXRhICAgICA6IG51bGxcbiAgICBjYWxsYmFjayA6IG51bGxcbiAgICBkZWZhdWx0ICA6ICdlbi1nYidcblxuICAgIGNvbnN0cnVjdG9yIDogKGRhdGEsIGNiKSAtPlxuXG4gICAgICAgICMjIyBzdGFydCBMb2NhbGUgTG9hZGVyLCBkZWZpbmUgbG9jYWxlIGJhc2VkIG9uIGJyb3dzZXIgbGFuZ3VhZ2UgIyMjXG5cbiAgICAgICAgQGNhbGxiYWNrID0gY2JcblxuICAgICAgICBAbGFuZyA9IEBnZXRMYW5nKClcblxuICAgICAgICBAcGFyc2VEYXRhIGRhdGFcblxuICAgICAgICBudWxsXG4gICAgICAgICAgICBcbiAgICBnZXRMYW5nIDogPT5cblxuICAgICAgICBpZiB3aW5kb3cubG9jYXRpb24uc2VhcmNoIGFuZCB3aW5kb3cubG9jYXRpb24uc2VhcmNoLm1hdGNoKCdsYW5nPScpXG5cbiAgICAgICAgICAgIGxhbmcgPSB3aW5kb3cubG9jYXRpb24uc2VhcmNoLnNwbGl0KCdsYW5nPScpWzFdLnNwbGl0KCcmJylbMF1cblxuICAgICAgICBlbHNlIGlmIHdpbmRvdy5jb25maWcubG9jYWxlQ29kZVxuXG4gICAgICAgICAgICBsYW5nID0gd2luZG93LmNvbmZpZy5sb2NhbGVDb2RlXG5cbiAgICAgICAgZWxzZVxuXG4gICAgICAgICAgICBsYW5nID0gQGRlZmF1bHRcblxuICAgICAgICBsYW5nXG5cbiAgICBwYXJzZURhdGEgOiAoZGF0YSkgPT5cblxuICAgICAgICAjIyMgRmlyZXMgYmFjayBhbiBldmVudCBvbmNlIGl0J3MgY29tcGxldGUgIyMjXG5cbiAgICAgICAgQGRhdGEgPSBuZXcgTG9jYWxlc01vZGVsIGRhdGFcbiAgICAgICAgQGNhbGxiYWNrPygpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgZ2V0IDogKGlkKSA9PlxuXG4gICAgICAgICMjIyBnZXQgU3RyaW5nIGZyb20gbG9jYWxlXG4gICAgICAgICsgaWQgOiBzdHJpbmcgaWQgb2YgdGhlIExvY2FsaXNlZCBTdHJpbmdcbiAgICAgICAgIyMjXG5cbiAgICAgICAgcmV0dXJuIEBkYXRhLmdldFN0cmluZyBpZFxuXG4gICAgZ2V0TG9jYWxlSW1hZ2UgOiAodXJsKSA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuY29uZmlnLkNETiArIFwiL2ltYWdlcy9sb2NhbGUvXCIgKyB3aW5kb3cuY29uZmlnLmxvY2FsZUNvZGUgKyBcIi9cIiArIHVybFxuXG5tb2R1bGUuZXhwb3J0cyA9IExvY2FsZVxuIiwiVGVtcGxhdGVNb2RlbCAgICAgICA9IHJlcXVpcmUgJy4uL21vZGVscy9jb3JlL1RlbXBsYXRlTW9kZWwnXG5UZW1wbGF0ZXNDb2xsZWN0aW9uID0gcmVxdWlyZSAnLi4vY29sbGVjdGlvbnMvY29yZS9UZW1wbGF0ZXNDb2xsZWN0aW9uJ1xuXG5jbGFzcyBUZW1wbGF0ZXNcblxuICAgIHRlbXBsYXRlcyA6IG51bGxcbiAgICBjYiAgICAgICAgOiBudWxsXG5cbiAgICBjb25zdHJ1Y3RvciA6IChkYXRhLCBjYWxsYmFjaykgLT5cblxuICAgICAgICBAY2IgPSBjYWxsYmFja1xuXG4gICAgICAgIEBwYXJzZURhdGEgZGF0YVxuICAgICAgICAgICBcbiAgICAgICAgbnVsbFxuXG4gICAgcGFyc2VEYXRhIDogKGRhdGEpID0+XG5cbiAgICAgICAgdGVtcCA9IFtdXG5cbiAgICAgICAgZm9yIGl0ZW0gaW4gZGF0YS50ZW1wbGF0ZVxuICAgICAgICAgICAgdGVtcC5wdXNoIG5ldyBUZW1wbGF0ZU1vZGVsXG4gICAgICAgICAgICAgICAgaWQgICA6IGl0ZW0uJC5pZFxuICAgICAgICAgICAgICAgIHRleHQgOiBpdGVtLl9cblxuICAgICAgICBAdGVtcGxhdGVzID0gbmV3IFRlbXBsYXRlc0NvbGxlY3Rpb24gdGVtcFxuXG4gICAgICAgIEBjYj8oKVxuICAgICAgICBcbiAgICAgICAgbnVsbCAgICAgICAgXG5cbiAgICBnZXQgOiAoaWQpID0+XG5cbiAgICAgICAgdCA9IEB0ZW1wbGF0ZXMud2hlcmUgaWQgOiBpZFxuICAgICAgICB0ID0gdFswXS5nZXQgJ3RleHQnXG4gICAgICAgIFxuICAgICAgICByZXR1cm4gJC50cmltIHRcblxubW9kdWxlLmV4cG9ydHMgPSBUZW1wbGF0ZXNcbiIsImNsYXNzIEFic3RyYWN0TW9kZWwgZXh0ZW5kcyBCYWNrYm9uZS5EZWVwTW9kZWxcblxuXHRjb25zdHJ1Y3RvciA6IChhdHRycywgb3B0aW9uKSAtPlxuXG5cdFx0YXR0cnMgPSBAX2ZpbHRlckF0dHJzIGF0dHJzXG5cblx0XHRyZXR1cm4gQmFja2JvbmUuRGVlcE1vZGVsLmFwcGx5IEAsIGFyZ3VtZW50c1xuXG5cdHNldCA6IChhdHRycywgb3B0aW9ucykgLT5cblxuXHRcdG9wdGlvbnMgb3IgKG9wdGlvbnMgPSB7fSlcblxuXHRcdGF0dHJzID0gQF9maWx0ZXJBdHRycyBhdHRyc1xuXG5cdFx0b3B0aW9ucy5kYXRhID0gSlNPTi5zdHJpbmdpZnkgYXR0cnNcblxuXHRcdHJldHVybiBCYWNrYm9uZS5EZWVwTW9kZWwucHJvdG90eXBlLnNldC5jYWxsIEAsIGF0dHJzLCBvcHRpb25zXG5cblx0X2ZpbHRlckF0dHJzIDogKGF0dHJzKSA9PlxuXG5cdFx0YXR0cnNcblxuXHRDRF9DRSA6ID0+XG5cblx0XHRyZXR1cm4gd2luZG93LkNEX0NFXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RNb2RlbFxuIiwiY2xhc3MgQVBJUm91dGVNb2RlbCBleHRlbmRzIEJhY2tib25lLkRlZXBNb2RlbFxuXG4gICAgZGVmYXVsdHMgOlxuXG4gICAgICAgIGRvb2RsZXMgOiBcInt7IEFQSV9IT1NUIH19L2FwaS9kb29kbGVzXCJcblxubW9kdWxlLmV4cG9ydHMgPSBBUElSb3V0ZU1vZGVsXG4iLCJjbGFzcyBMb2NhbGVzTW9kZWwgZXh0ZW5kcyBCYWNrYm9uZS5Nb2RlbFxuXG4gICAgZGVmYXVsdHMgOlxuICAgICAgICBjb2RlICAgICA6IG51bGxcbiAgICAgICAgbGFuZ3VhZ2UgOiBudWxsXG4gICAgICAgIHN0cmluZ3MgIDogbnVsbFxuICAgICAgICAgICAgXG4gICAgZ2V0X2xhbmd1YWdlIDogPT5cbiAgICAgICAgcmV0dXJuIEBnZXQoJ2xhbmd1YWdlJylcblxuICAgIGdldFN0cmluZyA6IChpZCkgPT5cbiAgICAgICAgKChyZXR1cm4gZSBpZihhIGlzIGlkKSkgZm9yIGEsIGUgb2Ygdlsnc3RyaW5ncyddKSBmb3IgaywgdiBvZiBAZ2V0KCdzdHJpbmdzJylcbiAgICAgICAgY29uc29sZS53YXJuIFwiTG9jYWxlcyAtPiBub3QgZm91bmQgc3RyaW5nOiAje2lkfVwiXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBMb2NhbGVzTW9kZWxcbiIsImNsYXNzIFRlbXBsYXRlTW9kZWwgZXh0ZW5kcyBCYWNrYm9uZS5Nb2RlbFxuXG5cdGRlZmF1bHRzIDogXG5cblx0XHRpZCAgIDogXCJcIlxuXHRcdHRleHQgOiBcIlwiXG5cbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVNb2RlbFxuIiwiQWJzdHJhY3RNb2RlbCAgICAgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdE1vZGVsJ1xuTnVtYmVyVXRpbHMgICAgICAgICAgPSByZXF1aXJlICcuLi8uLi91dGlscy9OdW1iZXJVdGlscydcbkNvZGVXb3JkVHJhbnNpdGlvbmVyID0gcmVxdWlyZSAnLi4vLi4vdXRpbHMvQ29kZVdvcmRUcmFuc2l0aW9uZXInXG5IYXNoaWRzICAgICAgICAgICAgICA9IHJlcXVpcmUgJ2hhc2hpZHMnXG5cbmNsYXNzIERvb2RsZU1vZGVsIGV4dGVuZHMgQWJzdHJhY3RNb2RlbFxuXG4gICAgZGVmYXVsdHMgOlxuICAgICAgICAjIGZyb20gbWFuaWZlc3RcbiAgICAgICAgXCJuYW1lXCIgOiBcIlwiXG4gICAgICAgIFwiYXV0aG9yXCIgOlxuICAgICAgICAgICAgXCJuYW1lXCIgICAgOiBcIlwiXG4gICAgICAgICAgICBcImdpdGh1YlwiICA6IFwiXCJcbiAgICAgICAgICAgIFwid2Vic2l0ZVwiIDogXCJcIlxuICAgICAgICAgICAgXCJ0d2l0dGVyXCIgOiBcIlwiXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJcIlxuICAgICAgICBcInRhZ3NcIiA6IFtdXG4gICAgICAgIFwiaW50ZXJhY3Rpb25cIiA6XG4gICAgICAgICAgICBcIm1vdXNlXCIgICAgOiBudWxsXG4gICAgICAgICAgICBcImtleWJvYXJkXCIgOiBudWxsXG4gICAgICAgICAgICBcInRvdWNoXCIgICAgOiBudWxsXG4gICAgICAgIFwiY3JlYXRlZFwiIDogXCJcIlxuICAgICAgICBcInNsdWdcIiA6IFwiXCJcbiAgICAgICAgXCJzaG9ydGxpbmtcIiA6IFwiXCJcbiAgICAgICAgXCJjb2xvdXJfc2NoZW1lXCIgOiBcIlwiXG4gICAgICAgIFwiaW5kZXhcIjogbnVsbFxuICAgICAgICBcImluZGV4X3BhZGRlZFwiIDogXCJcIlxuICAgICAgICAjIHNpdGUtb25seVxuICAgICAgICBcImluZGV4SFRNTFwiIDogXCJcIlxuICAgICAgICBcInNvdXJjZVwiICAgIDogXCJcIlxuICAgICAgICBcInVybFwiICAgICAgIDogXCJcIlxuICAgICAgICBcInNjcmFtYmxlZFwiIDpcbiAgICAgICAgICAgIFwibmFtZVwiICAgICAgICA6IFwiXCJcbiAgICAgICAgICAgIFwiYXV0aG9yX25hbWVcIiA6IFwiXCJcbiAgICAgICAgXCJ2aWV3ZWRcIiA6IGZhbHNlXG5cbiAgICAgICAgXCJTQU1QTEVfRElSXCIgOiBcIlwiXG5cbiAgICBTQU1QTEVfRE9PRExFUyA6IFtcbiAgICAgICAgICAgICdzaGFwZS1zdHJlYW0nLFxuICAgICAgICAgICAgJ3NoYXBlLXN0cmVhbS1saWdodCcsXG4gICAgICAgICAgICAnYm94LXBoeXNpY3MnLFxuICAgICAgICAgICAgJ3N0YXJzJyxcbiAgICAgICAgICAgICd0dWJlcydcbiAgICAgICAgXVxuXG4gICAgX2ZpbHRlckF0dHJzIDogKGF0dHJzKSA9PlxuXG4gICAgICAgIGlmIGF0dHJzLnNsdWdcbiAgICAgICAgICAgIGF0dHJzLnVybCA9IHdpbmRvdy5jb25maWcuU0lURV9VUkwgKyAnLycgKyB3aW5kb3cuY29uZmlnLnJvdXRlcy5ET09ETEVTICsgJy8nICsgYXR0cnMuc2x1Z1xuXG4gICAgICAgIGlmIGF0dHJzLmluZGV4XG4gICAgICAgICAgICBhdHRycy5pbmRleF9wYWRkZWQgPSBOdW1iZXJVdGlscy56ZXJvRmlsbCBhdHRycy5pbmRleCwgM1xuICAgICAgICAgICAgYXR0cnMuaW5kZXhIVE1MICAgID0gQGdldEluZGV4SFRNTCBhdHRycy5pbmRleF9wYWRkZWRcblxuICAgICAgICBpZiBhdHRycy5uYW1lIGFuZCBhdHRycy5hdXRob3IubmFtZVxuICAgICAgICAgICAgYXR0cnMuc2NyYW1ibGVkID1cbiAgICAgICAgICAgICAgICBuYW1lICAgICAgICA6IENvZGVXb3JkVHJhbnNpdGlvbmVyLmdldFNjcmFtYmxlZFdvcmQgYXR0cnMubmFtZVxuICAgICAgICAgICAgICAgIGF1dGhvcl9uYW1lIDogQ29kZVdvcmRUcmFuc2l0aW9uZXIuZ2V0U2NyYW1ibGVkV29yZCBhdHRycy5hdXRob3IubmFtZVxuXG4gICAgICAgICMjI1xuICAgICAgICBHRVRfRFVNTVlfRE9PRExFX1NDSFRVRkZcbiAgICAgICAgIyMjXG4gICAgICAgIHNhbXBsZSA9IF8uc2h1ZmZsZShAU0FNUExFX0RPT0RMRVMpWzBdXG4gICAgICAgIGF0dHJzLlNBTVBMRV9ESVIgPSBzYW1wbGVcbiAgICAgICAgYXR0cnMuY29sb3VyX3NjaGVtZSA9IGlmIHNhbXBsZSBpcyAnc2hhcGUtc3RyZWFtLWxpZ2h0JyB0aGVuICdsaWdodCcgZWxzZSAnZGFyaydcblxuICAgICAgICBhdHRyc1xuXG4gICAgZ2V0SW5kZXhIVE1MIDogKGluZGV4KSA9PlxuXG4gICAgICAgIGh0bWwgPSBcIlwiXG5cbiAgICAgICAgZm9yIGNoYXIgaW4gaW5kZXguc3BsaXQoJycpXG4gICAgICAgICAgICBjbGFzc05hbWUgPSBpZiBjaGFyIGlzICcwJyB0aGVuICdpbmRleC1jaGFyLXplcm8nIGVsc2UgJ2luZGV4LWNoYXItbm9uemVybydcbiAgICAgICAgICAgIGh0bWwgKz0gXCI8c3BhbiBjbGFzcz1cXFwiI3tjbGFzc05hbWV9XFxcIj4je2NoYXJ9PC9zcGFuPlwiXG5cbiAgICAgICAgaHRtbFxuXG4gICAgZ2V0QXV0aG9ySHRtbCA6ID0+XG5cbiAgICAgICAgcG9ydGZvbGlvX2xhYmVsID0gQENEX0NFKCkubG9jYWxlLmdldCBcIm1pc2NfcG9ydGZvbGlvX2xhYmVsXCJcblxuICAgICAgICBhdHRycyA9IEBnZXQoJ2F1dGhvcicpXG4gICAgICAgIGh0bWwgID0gXCJcIlxuICAgICAgICBsaW5rcyA9IFtdXG5cbiAgICAgICAgaHRtbCArPSBcIiN7YXR0cnMubmFtZX0gXFxcXCBcIlxuXG4gICAgICAgIGlmIGF0dHJzLndlYnNpdGUgdGhlbiBsaW5rcy5wdXNoIFwiPGEgaHJlZj1cXFwiI3thdHRycy53ZWJzaXRlfVxcXCIgdGFyZ2V0PVxcXCJfYmxhbmtcXFwiPiN7cG9ydGZvbGlvX2xhYmVsfTwvYT4gXCJcbiAgICAgICAgaWYgYXR0cnMudHdpdHRlciB0aGVuIGxpbmtzLnB1c2ggXCI8YSBocmVmPVxcXCJodHRwOi8vdHdpdHRlci5jb20vI3thdHRycy50d2l0dGVyfVxcXCIgdGFyZ2V0PVxcXCJfYmxhbmtcXFwiPnR3PC9hPlwiXG4gICAgICAgIGlmIGF0dHJzLmdpdGh1YiB0aGVuIGxpbmtzLnB1c2ggXCI8YSBocmVmPVxcXCJodHRwOi8vZ2l0aHViLmNvbS8je2F0dHJzLmdpdGh1Yn1cXFwiIHRhcmdldD1cXFwiX2JsYW5rXFxcIj5naDwvYT5cIlxuXG4gICAgICAgIGh0bWwgKz0gXCIje2xpbmtzLmpvaW4oJyBcXFxcICcpfVwiXG5cbiAgICAgICAgaHRtbFxuXG4gICAgIyBubyBuZWVkIHRvIGRvIHRoaXMgZm9yIGV2ZXJ5IGRvb2RsZSAtIG9ubHkgZG8gaXQgaWYgd2UgdmlldyB0aGUgaW5mbyBwYW5lIGZvciBhIHBhcnRpY3VsYXIgZG9vZGxlXG4gICAgc2V0U2hvcnRsaW5rIDogPT5cblxuICAgICAgICByZXR1cm4gaWYgQGdldCAnc2hvcnRsaW5rJ1xuXG4gICAgICAgIGggPSBuZXcgSGFzaGlkcyB3aW5kb3cuY29uZmlnLnNob3J0bGlua3MuU0FMVCwgMCwgd2luZG93LmNvbmZpZy5zaG9ydGxpbmtzLkFMUEhBQkVUXG4gICAgICAgIHNob3J0bGluayA9IGguZW5jb2RlIEBnZXQgJ2luZGV4J1xuICAgICAgICBAc2V0ICdzaG9ydGxpbmsnLCBzaG9ydGxpbmtcblxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gRG9vZGxlTW9kZWxcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4uL3ZpZXcvQWJzdHJhY3RWaWV3J1xuUm91dGVyICAgICAgID0gcmVxdWlyZSAnLi9Sb3V0ZXInXG5cbmNsYXNzIE5hdiBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG4gICAgQEVWRU5UX0NIQU5HRV9WSUVXICAgICA6ICdFVkVOVF9DSEFOR0VfVklFVydcbiAgICBARVZFTlRfQ0hBTkdFX1NVQl9WSUVXIDogJ0VWRU5UX0NIQU5HRV9TVUJfVklFVydcblxuICAgIHNlY3Rpb25zIDpcbiAgICAgICAgSE9NRSA6ICdpbmRleC5odG1sJ1xuXG4gICAgY3VycmVudCAgOiBhcmVhIDogbnVsbCwgc3ViIDogbnVsbFxuICAgIHByZXZpb3VzIDogYXJlYSA6IG51bGwsIHN1YiA6IG51bGxcblxuICAgIGNvbnN0cnVjdG9yOiAtPlxuXG4gICAgICAgIEBDRF9DRSgpLnJvdXRlci5vbiBSb3V0ZXIuRVZFTlRfSEFTSF9DSEFOR0VELCBAY2hhbmdlVmlld1xuXG4gICAgICAgIHJldHVybiBmYWxzZVxuXG4gICAgZ2V0U2VjdGlvbiA6IChzZWN0aW9uKSA9PlxuXG4gICAgICAgIGlmIHNlY3Rpb24gaXMgJycgdGhlbiByZXR1cm4gdHJ1ZVxuXG4gICAgICAgIGZvciBzZWN0aW9uTmFtZSwgdXJpIG9mIEBzZWN0aW9uc1xuICAgICAgICAgICAgaWYgdXJpIGlzIHNlY3Rpb24gdGhlbiByZXR1cm4gc2VjdGlvbk5hbWVcblxuICAgICAgICBmYWxzZVxuXG4gICAgY2hhbmdlVmlldzogKGFyZWEsIHN1YiwgcGFyYW1zKSA9PlxuXG4gICAgICAgICMgY29uc29sZS5sb2cgXCJhcmVhXCIsYXJlYVxuICAgICAgICAjIGNvbnNvbGUubG9nIFwic3ViXCIsc3ViXG4gICAgICAgICMgY29uc29sZS5sb2cgXCJwYXJhbXNcIixwYXJhbXNcblxuICAgICAgICBAcHJldmlvdXMgPSBAY3VycmVudFxuICAgICAgICBAY3VycmVudCAgPSBhcmVhIDogYXJlYSwgc3ViIDogc3ViXG5cbiAgICAgICAgaWYgQHByZXZpb3VzLmFyZWEgYW5kIEBwcmV2aW91cy5hcmVhIGlzIEBjdXJyZW50LmFyZWFcbiAgICAgICAgICAgIEB0cmlnZ2VyIE5hdi5FVkVOVF9DSEFOR0VfU1VCX1ZJRVcsIEBjdXJyZW50XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIEB0cmlnZ2VyIE5hdi5FVkVOVF9DSEFOR0VfVklFVywgQHByZXZpb3VzLCBAY3VycmVudFxuICAgICAgICAgICAgQHRyaWdnZXIgTmF2LkVWRU5UX0NIQU5HRV9TVUJfVklFVywgQGN1cnJlbnRcblxuICAgICAgICBpZiBAQ0RfQ0UoKS5hcHBWaWV3Lm1vZGFsTWFuYWdlci5pc09wZW4oKSB0aGVuIEBDRF9DRSgpLmFwcFZpZXcubW9kYWxNYW5hZ2VyLmhpZGVPcGVuTW9kYWwoKVxuXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBOYXZcbiIsImNsYXNzIFJvdXRlciBleHRlbmRzIEJhY2tib25lLlJvdXRlclxuXG4gICAgQEVWRU5UX0hBU0hfQ0hBTkdFRCA6ICdFVkVOVF9IQVNIX0NIQU5HRUQnXG5cbiAgICBGSVJTVF9ST1VURSA6IHRydWVcblxuICAgIHJvdXRlcyA6XG4gICAgICAgICcoLykoOmFyZWEpKC86c3ViKSgvKScgOiAnaGFzaENoYW5nZWQnXG4gICAgICAgICcqYWN0aW9ucycgICAgICAgICAgICAgOiAnbmF2aWdhdGVUbydcblxuICAgIGFyZWEgICA6IG51bGxcbiAgICBzdWIgICAgOiBudWxsXG4gICAgcGFyYW1zIDogbnVsbFxuXG4gICAgc3RhcnQgOiA9PlxuXG4gICAgICAgIEJhY2tib25lLmhpc3Rvcnkuc3RhcnQgXG4gICAgICAgICAgICBwdXNoU3RhdGUgOiB0cnVlXG4gICAgICAgICAgICByb290ICAgICAgOiAnLydcblxuICAgICAgICBudWxsXG5cbiAgICBoYXNoQ2hhbmdlZCA6IChAYXJlYSA9IG51bGwsIEBzdWIgPSBudWxsKSA9PlxuXG4gICAgICAgIGNvbnNvbGUubG9nIFwiPj4gRVZFTlRfSEFTSF9DSEFOR0VEIEBhcmVhID0gI3tAYXJlYX0sIEBzdWIgPSAje0BzdWJ9IDw8XCJcblxuICAgICAgICBpZiBARklSU1RfUk9VVEUgdGhlbiBARklSU1RfUk9VVEUgPSBmYWxzZVxuXG4gICAgICAgIGlmICFAYXJlYSB0aGVuIEBhcmVhID0gQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUVcblxuICAgICAgICBAdHJpZ2dlciBSb3V0ZXIuRVZFTlRfSEFTSF9DSEFOR0VELCBAYXJlYSwgQHN1YiwgQHBhcmFtc1xuXG4gICAgICAgIG51bGxcblxuICAgIG5hdmlnYXRlVG8gOiAod2hlcmUgPSAnJywgdHJpZ2dlciA9IHRydWUsIHJlcGxhY2UgPSBmYWxzZSwgQHBhcmFtcykgPT5cblxuICAgICAgICBpZiB3aGVyZS5jaGFyQXQoMCkgaXNudCBcIi9cIlxuICAgICAgICAgICAgd2hlcmUgPSBcIi8je3doZXJlfVwiXG4gICAgICAgIGlmIHdoZXJlLmNoYXJBdCggd2hlcmUubGVuZ3RoLTEgKSBpc250IFwiL1wiXG4gICAgICAgICAgICB3aGVyZSA9IFwiI3t3aGVyZX0vXCJcblxuICAgICAgICBpZiAhdHJpZ2dlclxuICAgICAgICAgICAgQHRyaWdnZXIgUm91dGVyLkVWRU5UX0hBU0hfQ0hBTkdFRCwgd2hlcmUsIG51bGwsIEBwYXJhbXNcbiAgICAgICAgICAgIHJldHVyblxuXG4gICAgICAgIEBuYXZpZ2F0ZSB3aGVyZSwgdHJpZ2dlcjogdHJ1ZSwgcmVwbGFjZTogcmVwbGFjZVxuXG4gICAgICAgIG51bGxcblxuICAgIENEX0NFIDogPT5cblxuICAgICAgICByZXR1cm4gd2luZG93LkNEX0NFXG5cbm1vZHVsZS5leHBvcnRzID0gUm91dGVyXG4iLCIjIyNcbkFuYWx5dGljcyB3cmFwcGVyXG4jIyNcbmNsYXNzIEFuYWx5dGljc1xuXG4gICAgdGFncyAgICA6IG51bGxcbiAgICBzdGFydGVkIDogZmFsc2VcblxuICAgIGF0dGVtcHRzICAgICAgICA6IDBcbiAgICBhbGxvd2VkQXR0ZW1wdHMgOiA1XG5cbiAgICBjb25zdHJ1Y3RvciA6IChkYXRhLCBAY2FsbGJhY2spIC0+XG5cbiAgICAgICAgQHBhcnNlRGF0YSBkYXRhXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgIHBhcnNlRGF0YSA6IChkYXRhKSA9PlxuXG4gICAgICAgIEB0YWdzICAgID0gZGF0YVxuICAgICAgICBAc3RhcnRlZCA9IHRydWVcbiAgICAgICAgQGNhbGxiYWNrPygpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgIyMjXG4gICAgQHBhcmFtIHN0cmluZyBpZCBvZiB0aGUgdHJhY2tpbmcgdGFnIHRvIGJlIHB1c2hlZCBvbiBBbmFseXRpY3MgXG4gICAgIyMjXG4gICAgdHJhY2sgOiAocGFyYW0pID0+XG5cbiAgICAgICAgcmV0dXJuIGlmICFAc3RhcnRlZFxuXG4gICAgICAgIGlmIHBhcmFtXG5cbiAgICAgICAgICAgIHYgPSBAdGFnc1twYXJhbV1cblxuICAgICAgICAgICAgaWYgdlxuXG4gICAgICAgICAgICAgICAgYXJncyA9IFsnc2VuZCcsICdldmVudCddXG4gICAgICAgICAgICAgICAgKCBhcmdzLnB1c2goYXJnKSApIGZvciBhcmcgaW4gdlxuXG4gICAgICAgICAgICAgICAgIyBsb2FkaW5nIEdBIGFmdGVyIG1haW4gYXBwIEpTLCBzbyBleHRlcm5hbCBzY3JpcHQgbWF5IG5vdCBiZSBoZXJlIHlldFxuICAgICAgICAgICAgICAgIGlmIHdpbmRvdy5nYVxuICAgICAgICAgICAgICAgICAgICBnYS5hcHBseSBudWxsLCBhcmdzXG4gICAgICAgICAgICAgICAgZWxzZSBpZiBAYXR0ZW1wdHMgPj0gQGFsbG93ZWRBdHRlbXB0c1xuICAgICAgICAgICAgICAgICAgICBAc3RhcnRlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0ID0+XG4gICAgICAgICAgICAgICAgICAgICAgICBAdHJhY2sgcGFyYW1cbiAgICAgICAgICAgICAgICAgICAgICAgIEBhdHRlbXB0cysrXG4gICAgICAgICAgICAgICAgICAgICwgMjAwMFxuXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBbmFseXRpY3NcbiIsIkFic3RyYWN0RGF0YSA9IHJlcXVpcmUgJy4uL2RhdGEvQWJzdHJhY3REYXRhJ1xuRmFjZWJvb2sgICAgID0gcmVxdWlyZSAnLi4vdXRpbHMvRmFjZWJvb2snXG5Hb29nbGVQbHVzICAgPSByZXF1aXJlICcuLi91dGlscy9Hb29nbGVQbHVzJ1xuXG5jbGFzcyBBdXRoTWFuYWdlciBleHRlbmRzIEFic3RyYWN0RGF0YVxuXG5cdHVzZXJEYXRhICA6IG51bGxcblxuXHQjIEBwcm9jZXNzIHRydWUgZHVyaW5nIGxvZ2luIHByb2Nlc3Ncblx0cHJvY2VzcyAgICAgIDogZmFsc2Vcblx0cHJvY2Vzc1RpbWVyIDogbnVsbFxuXHRwcm9jZXNzV2FpdCAgOiA1MDAwXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0QHVzZXJEYXRhICA9IEBDRF9DRSgpLmFwcERhdGEuVVNFUlxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRsb2dpbiA6IChzZXJ2aWNlLCBjYj1udWxsKSA9PlxuXG5cdFx0IyBjb25zb2xlLmxvZyBcIisrKysgUFJPQ0VTUyBcIixAcHJvY2Vzc1xuXG5cdFx0cmV0dXJuIGlmIEBwcm9jZXNzXG5cblx0XHRAc2hvd0xvYWRlcigpXG5cdFx0QHByb2Nlc3MgPSB0cnVlXG5cblx0XHQkZGF0YURmZCA9ICQuRGVmZXJyZWQoKVxuXG5cdFx0c3dpdGNoIHNlcnZpY2Vcblx0XHRcdHdoZW4gJ2dvb2dsZSdcblx0XHRcdFx0R29vZ2xlUGx1cy5sb2dpbiAkZGF0YURmZFxuXHRcdFx0d2hlbiAnZmFjZWJvb2snXG5cdFx0XHRcdEZhY2Vib29rLmxvZ2luICRkYXRhRGZkXG5cblx0XHQkZGF0YURmZC5kb25lIChyZXMpID0+IEBhdXRoU3VjY2VzcyBzZXJ2aWNlLCByZXNcblx0XHQkZGF0YURmZC5mYWlsIChyZXMpID0+IEBhdXRoRmFpbCBzZXJ2aWNlLCByZXNcblx0XHQkZGF0YURmZC5hbHdheXMgKCkgPT4gQGF1dGhDYWxsYmFjayBjYlxuXG5cdFx0IyMjXG5cdFx0VW5mb3J0dW5hdGVseSBubyBjYWxsYmFjayBpcyBmaXJlZCBpZiB1c2VyIG1hbnVhbGx5IGNsb3NlcyBHKyBsb2dpbiBtb2RhbCxcblx0XHRzbyB0aGlzIGlzIHRvIGFsbG93IHRoZW0gdG8gY2xvc2Ugd2luZG93IGFuZCB0aGVuIHN1YnNlcXVlbnRseSB0cnkgdG8gbG9nIGluIGFnYWluLi4uXG5cdFx0IyMjXG5cdFx0QHByb2Nlc3NUaW1lciA9IHNldFRpbWVvdXQgQGF1dGhDYWxsYmFjaywgQHByb2Nlc3NXYWl0XG5cblx0XHQkZGF0YURmZFxuXG5cdGF1dGhTdWNjZXNzIDogKHNlcnZpY2UsIGRhdGEpID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwibG9naW4gY2FsbGJhY2sgZm9yICN7c2VydmljZX0sIGRhdGEgPT4gXCIsIGRhdGFcblxuXHRcdG51bGxcblxuXHRhdXRoRmFpbCA6IChzZXJ2aWNlLCBkYXRhKSA9PlxuXG5cdFx0IyBjb25zb2xlLmxvZyBcImxvZ2luIGZhaWwgZm9yICN7c2VydmljZX0gPT4gXCIsIGRhdGFcblxuXHRcdG51bGxcblxuXHRhdXRoQ2FsbGJhY2sgOiAoY2I9bnVsbCkgPT5cblxuXHRcdHJldHVybiB1bmxlc3MgQHByb2Nlc3NcblxuXHRcdGNsZWFyVGltZW91dCBAcHJvY2Vzc1RpbWVyXG5cblx0XHRAaGlkZUxvYWRlcigpXG5cdFx0QHByb2Nlc3MgPSBmYWxzZVxuXG5cdFx0Y2I/KClcblxuXHRcdG51bGxcblxuXHQjIyNcblx0c2hvdyAvIGhpZGUgc29tZSBVSSBpbmRpY2F0b3IgdGhhdCB3ZSBhcmUgd2FpdGluZyBmb3Igc29jaWFsIG5ldHdvcmsgdG8gcmVzcG9uZFxuXHQjIyNcblx0c2hvd0xvYWRlciA6ID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwic2hvd0xvYWRlclwiXG5cblx0XHRudWxsXG5cblx0aGlkZUxvYWRlciA6ID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwiaGlkZUxvYWRlclwiXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQXV0aE1hbmFnZXJcbiIsImVuY29kZSA9IHJlcXVpcmUgJ2VudC9lbmNvZGUnXG5cbmNsYXNzIENvZGVXb3JkVHJhbnNpdGlvbmVyXG5cblx0QGNvbmZpZyA6XG5cdFx0TUlOX1dST05HX0NIQVJTIDogMVxuXHRcdE1BWF9XUk9OR19DSEFSUyA6IDdcblxuXHRcdE1JTl9DSEFSX0lOX0RFTEFZIDogNDBcblx0XHRNQVhfQ0hBUl9JTl9ERUxBWSA6IDcwXG5cblx0XHRNSU5fQ0hBUl9PVVRfREVMQVkgOiA0MFxuXHRcdE1BWF9DSEFSX09VVF9ERUxBWSA6IDcwXG5cblx0XHRDSEFSUyA6ICdhYmNkZWZoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSE/KigpQMKjJCVeJl8tKz1bXXt9OjtcXCdcIlxcXFx8PD4sLi9+YCcuc3BsaXQoJycpLm1hcChlbmNvZGUpXG5cblx0XHRDSEFSX1RFTVBMQVRFIDogXCI8c3BhbiBkYXRhLWNvZGV0ZXh0LWNoYXI9XFxcInt7IGNoYXIgfX1cXFwiIGRhdGEtY29kZXRleHQtY2hhci1zdGF0ZT1cXFwie3sgc3RhdGUgfX1cXFwiPnt7IGNoYXIgfX08L3NwYW4+XCJcblxuXHRAX3dvcmRDYWNoZSA6IHt9XG5cblx0QF9nZXRXb3JkRnJvbUNhY2hlIDogKCRlbCwgaW5pdGlhbFN0YXRlPW51bGwpID0+XG5cblx0XHRpZCA9ICRlbC5hdHRyKCdkYXRhLWNvZGV3b3JkLWlkJylcblxuXHRcdGlmIGlkIGFuZCBAX3dvcmRDYWNoZVsgaWQgXVxuXHRcdFx0d29yZCA9IEBfd29yZENhY2hlWyBpZCBdXG5cdFx0ZWxzZVxuXHRcdFx0QF93cmFwQ2hhcnMgJGVsLCBpbml0aWFsU3RhdGVcblx0XHRcdHdvcmQgPSBAX2FkZFdvcmRUb0NhY2hlICRlbFxuXG5cdFx0d29yZFxuXG5cdEBfYWRkV29yZFRvQ2FjaGUgOiAoJGVsKSA9PlxuXG5cdFx0Y2hhcnMgPSBbXVxuXG5cdFx0JGVsLmZpbmQoJ1tkYXRhLWNvZGV0ZXh0LWNoYXJdJykuZWFjaCAoaSwgZWwpID0+XG5cdFx0XHQkY2hhckVsID0gJChlbClcblx0XHRcdGNoYXJzLnB1c2hcblx0XHRcdFx0JGVsICAgICAgICA6ICRjaGFyRWxcblx0XHRcdFx0cmlnaHRDaGFyICA6ICRjaGFyRWwuYXR0cignZGF0YS1jb2RldGV4dC1jaGFyJylcblxuXHRcdGlkID0gXy51bmlxdWVJZCgpXG5cdFx0JGVsLmF0dHIgJ2RhdGEtY29kZXdvcmQtaWQnLCBpZFxuXG5cdFx0QF93b3JkQ2FjaGVbIGlkIF0gPVxuXHRcdFx0d29yZCAgICA6IF8ucGx1Y2soY2hhcnMsICdyaWdodENoYXInKS5qb2luKCcnKVxuXHRcdFx0JGVsICAgICA6ICRlbFxuXHRcdFx0Y2hhcnMgICA6IGNoYXJzXG5cdFx0XHR2aXNpYmxlIDogdHJ1ZVxuXG5cdFx0QF93b3JkQ2FjaGVbIGlkIF1cblxuXHRAX3dyYXBDaGFycyA6ICgkZWwsIGluaXRpYWxTdGF0ZT1udWxsKSA9PlxuXG5cdFx0Y2hhcnMgPSAkZWwudGV4dCgpLnNwbGl0KCcnKVxuXHRcdHN0YXRlID0gaW5pdGlhbFN0YXRlIG9yICRlbC5hdHRyKCdkYXRhLWNvZGV3b3JkLWluaXRpYWwtc3RhdGUnKSBvciBcIlwiXG5cdFx0aHRtbCA9IFtdXG5cdFx0Zm9yIGNoYXIgaW4gY2hhcnNcblx0XHRcdGlmIGNoYXIgaXMgJyAnIHRoZW4gY2hhciA9ICcmbmJzcDsnXG5cdFx0XHRodG1sLnB1c2ggQF9zdXBwbGFudFN0cmluZyBAY29uZmlnLkNIQVJfVEVNUExBVEUsIGNoYXIgOiBjaGFyLCBzdGF0ZTogc3RhdGVcblxuXHRcdCRlbC5odG1sIGh0bWwuam9pbignJylcblxuXHRcdG51bGxcblxuXHQjIEBwYXJhbSB0YXJnZXQgPSAncmlnaHQnLCAnd3JvbmcnLCAnZW1wdHknXG5cdEBfcHJlcGFyZVdvcmQgOiAod29yZCwgdGFyZ2V0LCBjaGFyU3RhdGU9JycpID0+XG5cblx0XHRmb3IgY2hhciwgaSBpbiB3b3JkLmNoYXJzXG5cblx0XHRcdHRhcmdldENoYXIgPSBzd2l0Y2ggdHJ1ZVxuXHRcdFx0XHR3aGVuIHRhcmdldCBpcyAncmlnaHQnIHRoZW4gY2hhci5yaWdodENoYXJcblx0XHRcdFx0d2hlbiB0YXJnZXQgaXMgJ3dyb25nJyB0aGVuIEBfZ2V0UmFuZG9tQ2hhcigpXG5cdFx0XHRcdHdoZW4gdGFyZ2V0IGlzICdlbXB0eScgdGhlbiAnJ1xuXHRcdFx0XHRlbHNlIHRhcmdldC5jaGFyQXQoaSkgb3IgJydcblxuXHRcdFx0aWYgdGFyZ2V0Q2hhciBpcyAnICcgdGhlbiB0YXJnZXRDaGFyID0gJyZuYnNwOydcblxuXHRcdFx0Y2hhci53cm9uZ0NoYXJzID0gQF9nZXRSYW5kb21Xcm9uZ0NoYXJzKClcblx0XHRcdGNoYXIudGFyZ2V0Q2hhciA9IHRhcmdldENoYXJcblx0XHRcdGNoYXIuY2hhclN0YXRlICA9IGNoYXJTdGF0ZVxuXG5cdFx0bnVsbFxuXG5cdEBfZ2V0UmFuZG9tV3JvbmdDaGFycyA6ID0+XG5cblx0XHRjaGFycyA9IFtdXG5cblx0XHRjaGFyQ291bnQgPSBfLnJhbmRvbSBAY29uZmlnLk1JTl9XUk9OR19DSEFSUywgQGNvbmZpZy5NQVhfV1JPTkdfQ0hBUlNcblxuXHRcdGZvciBpIGluIFswLi4uY2hhckNvdW50XVxuXHRcdFx0Y2hhcnMucHVzaFxuXHRcdFx0XHRjaGFyICAgICA6IEBfZ2V0UmFuZG9tQ2hhcigpXG5cdFx0XHRcdGluRGVsYXkgIDogXy5yYW5kb20gQGNvbmZpZy5NSU5fQ0hBUl9JTl9ERUxBWSwgQGNvbmZpZy5NQVhfQ0hBUl9JTl9ERUxBWVxuXHRcdFx0XHRvdXREZWxheSA6IF8ucmFuZG9tIEBjb25maWcuTUlOX0NIQVJfT1VUX0RFTEFZLCBAY29uZmlnLk1BWF9DSEFSX09VVF9ERUxBWVxuXG5cdFx0Y2hhcnNcblxuXHRAX2dldFJhbmRvbUNoYXIgOiA9PlxuXG5cdFx0Y2hhciA9IEBjb25maWcuQ0hBUlNbIF8ucmFuZG9tKDAsIEBjb25maWcuQ0hBUlMubGVuZ3RoLTEpIF1cblxuXHRcdGNoYXJcblxuXHRAX2dldExvbmdlc3RDaGFyRHVyYXRpb24gOiAoY2hhcnMpID0+XG5cblx0XHRsb25nZXN0VGltZSA9IDBcblx0XHRsb25nZXN0VGltZUlkeCA9IDBcblxuXHRcdGZvciBjaGFyLCBpIGluIGNoYXJzXG5cblx0XHRcdHRpbWUgPSAwXG5cdFx0XHQodGltZSArPSB3cm9uZ0NoYXIuaW5EZWxheSArIHdyb25nQ2hhci5vdXREZWxheSkgZm9yIHdyb25nQ2hhciBpbiBjaGFyLndyb25nQ2hhcnNcblx0XHRcdGlmIHRpbWUgPiBsb25nZXN0VGltZVxuXHRcdFx0XHRsb25nZXN0VGltZSA9IHRpbWVcblx0XHRcdFx0bG9uZ2VzdFRpbWVJZHggPSBpXG5cblx0XHRsb25nZXN0VGltZUlkeFxuXG5cdEBfYW5pbWF0ZUNoYXJzIDogKHdvcmQsIHNlcXVlbnRpYWwsIGNiKSA9PlxuXG5cdFx0YWN0aXZlQ2hhciA9IDBcblxuXHRcdGlmIHNlcXVlbnRpYWxcblx0XHRcdEBfYW5pbWF0ZUNoYXIgd29yZC5jaGFycywgYWN0aXZlQ2hhciwgdHJ1ZSwgY2Jcblx0XHRlbHNlXG5cdFx0XHRsb25nZXN0Q2hhcklkeCA9IEBfZ2V0TG9uZ2VzdENoYXJEdXJhdGlvbiB3b3JkLmNoYXJzXG5cdFx0XHRmb3IgY2hhciwgaSBpbiB3b3JkLmNoYXJzXG5cdFx0XHRcdGFyZ3MgPSBbIHdvcmQuY2hhcnMsIGksIGZhbHNlIF1cblx0XHRcdFx0aWYgaSBpcyBsb25nZXN0Q2hhcklkeCB0aGVuIGFyZ3MucHVzaCBjYlxuXHRcdFx0XHRAX2FuaW1hdGVDaGFyLmFwcGx5IEAsIGFyZ3NcblxuXHRcdG51bGxcblxuXHRAX2FuaW1hdGVDaGFyIDogKGNoYXJzLCBpZHgsIHJlY3Vyc2UsIGNiKSA9PlxuXG5cdFx0Y2hhciA9IGNoYXJzW2lkeF1cblxuXHRcdGlmIHJlY3Vyc2VcblxuXHRcdFx0QF9hbmltYXRlV3JvbmdDaGFycyBjaGFyLCA9PlxuXG5cdFx0XHRcdGlmIGlkeCBpcyBjaGFycy5sZW5ndGgtMVxuXHRcdFx0XHRcdEBfYW5pbWF0ZUNoYXJzRG9uZSBjYlxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0QF9hbmltYXRlQ2hhciBjaGFycywgaWR4KzEsIHJlY3Vyc2UsIGNiXG5cblx0XHRlbHNlXG5cblx0XHRcdGlmIHR5cGVvZiBjYiBpcyAnZnVuY3Rpb24nXG5cdFx0XHRcdEBfYW5pbWF0ZVdyb25nQ2hhcnMgY2hhciwgPT4gQF9hbmltYXRlQ2hhcnNEb25lIGNiXG5cdFx0XHRlbHNlXG5cdFx0XHRcdEBfYW5pbWF0ZVdyb25nQ2hhcnMgY2hhclxuXG5cdFx0bnVsbFxuXG5cdEBfYW5pbWF0ZVdyb25nQ2hhcnMgOiAoY2hhciwgY2IpID0+XG5cblx0XHRpZiBjaGFyLndyb25nQ2hhcnMubGVuZ3RoXG5cblx0XHRcdHdyb25nQ2hhciA9IGNoYXIud3JvbmdDaGFycy5zaGlmdCgpXG5cblx0XHRcdHNldFRpbWVvdXQgPT5cblx0XHRcdFx0Y2hhci4kZWwuaHRtbCB3cm9uZ0NoYXIuY2hhclxuXG5cdFx0XHRcdHNldFRpbWVvdXQgPT5cblx0XHRcdFx0XHRAX2FuaW1hdGVXcm9uZ0NoYXJzIGNoYXIsIGNiXG5cdFx0XHRcdCwgd3JvbmdDaGFyLm91dERlbGF5XG5cblx0XHRcdCwgd3JvbmdDaGFyLmluRGVsYXlcblxuXHRcdGVsc2VcblxuXHRcdFx0Y2hhci4kZWxcblx0XHRcdFx0LmF0dHIoJ2RhdGEtY29kZXRleHQtY2hhci1zdGF0ZScsIGNoYXIuY2hhclN0YXRlKVxuXHRcdFx0XHQuaHRtbChjaGFyLnRhcmdldENoYXIpXG5cblx0XHRcdGNiPygpXG5cblx0XHRudWxsXG5cblx0QF9hbmltYXRlQ2hhcnNEb25lIDogKGNiKSA9PlxuXG5cdFx0Y2I/KClcblxuXHRcdG51bGxcblxuXHRAX3N1cHBsYW50U3RyaW5nIDogKHN0ciwgdmFscykgPT5cblxuXHRcdHJldHVybiBzdHIucmVwbGFjZSAve3sgKFtee31dKikgfX0vZywgKGEsIGIpID0+XG5cdFx0XHRyID0gdmFsc1tiXVxuXHRcdFx0KGlmIHR5cGVvZiByIGlzIFwic3RyaW5nXCIgb3IgdHlwZW9mIHIgaXMgXCJudW1iZXJcIiB0aGVuIHIgZWxzZSBhKVxuXG5cdEB0byA6ICh0YXJnZXRUZXh0LCAkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAdG8odGFyZ2V0VGV4dCwgXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXHRcdHdvcmQudmlzaWJsZSA9IHRydWVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgdGFyZ2V0VGV4dCwgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAaW4gOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQGluKF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblx0XHR3b3JkLnZpc2libGUgPSB0cnVlXG5cblx0XHRAX3ByZXBhcmVXb3JkIHdvcmQsICdyaWdodCcsIGNoYXJTdGF0ZVxuXHRcdEBfYW5pbWF0ZUNoYXJzIHdvcmQsIHNlcXVlbnRpYWwsIGNiXG5cblx0XHRudWxsXG5cblx0QG91dCA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAb3V0KF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblx0XHRyZXR1cm4gaWYgIXdvcmQudmlzaWJsZVxuXG5cdFx0d29yZC52aXNpYmxlID0gZmFsc2VcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ2VtcHR5JywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAc2NyYW1ibGUgOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQHNjcmFtYmxlKF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblxuXHRcdHJldHVybiBpZiAhd29yZC52aXNpYmxlXG5cblx0XHRAX3ByZXBhcmVXb3JkIHdvcmQsICd3cm9uZycsIGNoYXJTdGF0ZVxuXHRcdEBfYW5pbWF0ZUNoYXJzIHdvcmQsIHNlcXVlbnRpYWwsIGNiXG5cblx0XHRudWxsXG5cblx0QHVuc2NyYW1ibGUgOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQHVuc2NyYW1ibGUoXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXG5cdFx0cmV0dXJuIGlmICF3b3JkLnZpc2libGVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ3JpZ2h0JywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAcHJlcGFyZSA6ICgkZWwsIGluaXRpYWxTdGF0ZSkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAcHJlcGFyZShfJGVsLCBpbml0aWFsU3RhdGUpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0QF9nZXRXb3JkRnJvbUNhY2hlICRlbCwgaW5pdGlhbFN0YXRlXG5cblx0XHRudWxsXG5cblx0QGdldFNjcmFtYmxlZFdvcmQgOiAod29yZCkgPT5cblxuXHRcdG5ld0NoYXJzID0gW11cblx0XHQobmV3Q2hhcnMucHVzaCBAX2dldFJhbmRvbUNoYXIoKSkgZm9yIGNoYXIgaW4gd29yZC5zcGxpdCgnJylcblxuXHRcdHJldHVybiBuZXdDaGFycy5qb2luKCcnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvZGVXb3JkVHJhbnNpdGlvbmVyXG4iLCJBYnN0cmFjdERhdGEgPSByZXF1aXJlICcuLi9kYXRhL0Fic3RyYWN0RGF0YSdcblxuIyMjXG5cbkZhY2Vib29rIFNESyB3cmFwcGVyIC0gbG9hZCBhc3luY2hyb25vdXNseSwgc29tZSBoZWxwZXIgbWV0aG9kc1xuXG4jIyNcbmNsYXNzIEZhY2Vib29rIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cblx0QHVybCAgICAgICAgIDogJy8vY29ubmVjdC5mYWNlYm9vay5uZXQvZW5fVVMvYWxsLmpzJ1xuXG5cdEBwZXJtaXNzaW9ucyA6ICdlbWFpbCdcblxuXHRAJGRhdGFEZmQgICAgOiBudWxsXG5cdEBsb2FkZWQgICAgICA6IGZhbHNlXG5cblx0QGxvYWQgOiA9PlxuXG5cdFx0IyMjXG5cdFx0VE8gRE9cblx0XHRpbmNsdWRlIHNjcmlwdCBsb2FkZXIgd2l0aCBjYWxsYmFjayB0byA6aW5pdFxuXHRcdCMjI1xuXHRcdCMgcmVxdWlyZSBbQHVybF0sIEBpbml0XG5cblx0XHRudWxsXG5cblx0QGluaXQgOiA9PlxuXG5cdFx0QGxvYWRlZCA9IHRydWVcblxuXHRcdEZCLmluaXRcblx0XHRcdGFwcElkICA6IHdpbmRvdy5jb25maWcuZmJfYXBwX2lkXG5cdFx0XHRzdGF0dXMgOiBmYWxzZVxuXHRcdFx0eGZibWwgIDogZmFsc2VcblxuXHRcdG51bGxcblxuXHRAbG9naW4gOiAoQCRkYXRhRGZkKSA9PlxuXG5cdFx0aWYgIUBsb2FkZWQgdGhlbiByZXR1cm4gQCRkYXRhRGZkLnJlamVjdCAnU0RLIG5vdCBsb2FkZWQnXG5cblx0XHRGQi5sb2dpbiAoIHJlcyApID0+XG5cblx0XHRcdGlmIHJlc1snc3RhdHVzJ10gaXMgJ2Nvbm5lY3RlZCdcblx0XHRcdFx0QGdldFVzZXJEYXRhIHJlc1snYXV0aFJlc3BvbnNlJ11bJ2FjY2Vzc1Rva2VuJ11cblx0XHRcdGVsc2Vcblx0XHRcdFx0QCRkYXRhRGZkLnJlamVjdCAnbm8gd2F5IGpvc2UnXG5cblx0XHQsIHsgc2NvcGU6IEBwZXJtaXNzaW9ucyB9XG5cblx0XHRudWxsXG5cblx0QGdldFVzZXJEYXRhIDogKHRva2VuKSA9PlxuXG5cdFx0dXNlckRhdGEgPSB7fVxuXHRcdHVzZXJEYXRhLmFjY2Vzc190b2tlbiA9IHRva2VuXG5cblx0XHQkbWVEZmQgICA9ICQuRGVmZXJyZWQoKVxuXHRcdCRwaWNEZmQgID0gJC5EZWZlcnJlZCgpXG5cblx0XHRGQi5hcGkgJy9tZScsIChyZXMpIC0+XG5cblx0XHRcdHVzZXJEYXRhLmZ1bGxfbmFtZSA9IHJlcy5uYW1lXG5cdFx0XHR1c2VyRGF0YS5zb2NpYWxfaWQgPSByZXMuaWRcblx0XHRcdHVzZXJEYXRhLmVtYWlsICAgICA9IHJlcy5lbWFpbCBvciBmYWxzZVxuXHRcdFx0JG1lRGZkLnJlc29sdmUoKVxuXG5cdFx0RkIuYXBpICcvbWUvcGljdHVyZScsIHsgJ3dpZHRoJzogJzIwMCcgfSwgKHJlcykgLT5cblxuXHRcdFx0dXNlckRhdGEucHJvZmlsZV9waWMgPSByZXMuZGF0YS51cmxcblx0XHRcdCRwaWNEZmQucmVzb2x2ZSgpXG5cblx0XHQkLndoZW4oJG1lRGZkLCAkcGljRGZkKS5kb25lID0+IEAkZGF0YURmZC5yZXNvbHZlIHVzZXJEYXRhXG5cblx0XHRudWxsXG5cblx0QHNoYXJlIDogKG9wdHMsIGNiKSA9PlxuXG5cdFx0RkIudWkge1xuXHRcdFx0bWV0aG9kICAgICAgOiBvcHRzLm1ldGhvZCBvciAnZmVlZCdcblx0XHRcdG5hbWUgICAgICAgIDogb3B0cy5uYW1lIG9yICcnXG5cdFx0XHRsaW5rICAgICAgICA6IG9wdHMubGluayBvciAnJ1xuXHRcdFx0cGljdHVyZSAgICAgOiBvcHRzLnBpY3R1cmUgb3IgJydcblx0XHRcdGNhcHRpb24gICAgIDogb3B0cy5jYXB0aW9uIG9yICcnXG5cdFx0XHRkZXNjcmlwdGlvbiA6IG9wdHMuZGVzY3JpcHRpb24gb3IgJydcblx0XHR9LCAocmVzcG9uc2UpIC0+XG5cdFx0XHRjYj8ocmVzcG9uc2UpXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gRmFjZWJvb2tcbiIsIkFic3RyYWN0RGF0YSA9IHJlcXVpcmUgJy4uL2RhdGEvQWJzdHJhY3REYXRhJ1xuXG4jIyNcblxuR29vZ2xlKyBTREsgd3JhcHBlciAtIGxvYWQgYXN5bmNocm9ub3VzbHksIHNvbWUgaGVscGVyIG1ldGhvZHNcblxuIyMjXG5jbGFzcyBHb29nbGVQbHVzIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cblx0QHVybCAgICAgIDogJ2h0dHBzOi8vYXBpcy5nb29nbGUuY29tL2pzL2NsaWVudDpwbHVzb25lLmpzJ1xuXG5cdEBwYXJhbXMgICA6XG5cdFx0J2NsaWVudGlkJyAgICAgOiBudWxsXG5cdFx0J2NhbGxiYWNrJyAgICAgOiBudWxsXG5cdFx0J3Njb3BlJyAgICAgICAgOiAnaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC91c2VyaW5mby5lbWFpbCdcblx0XHQnY29va2llcG9saWN5JyA6ICdub25lJ1xuXG5cdEAkZGF0YURmZCA6IG51bGxcblx0QGxvYWRlZCAgIDogZmFsc2VcblxuXHRAbG9hZCA6ID0+XG5cblx0XHQjIyNcblx0XHRUTyBET1xuXHRcdGluY2x1ZGUgc2NyaXB0IGxvYWRlciB3aXRoIGNhbGxiYWNrIHRvIDppbml0XG5cdFx0IyMjXG5cdFx0IyByZXF1aXJlIFtAdXJsXSwgQGluaXRcblxuXHRcdG51bGxcblxuXHRAaW5pdCA6ID0+XG5cblx0XHRAbG9hZGVkID0gdHJ1ZVxuXG5cdFx0QHBhcmFtc1snY2xpZW50aWQnXSA9IHdpbmRvdy5jb25maWcuZ3BfYXBwX2lkXG5cdFx0QHBhcmFtc1snY2FsbGJhY2snXSA9IEBsb2dpbkNhbGxiYWNrXG5cblx0XHRudWxsXG5cblx0QGxvZ2luIDogKEAkZGF0YURmZCkgPT5cblxuXHRcdGlmIEBsb2FkZWRcblx0XHRcdGdhcGkuYXV0aC5zaWduSW4gQHBhcmFtc1xuXHRcdGVsc2Vcblx0XHRcdEAkZGF0YURmZC5yZWplY3QgJ1NESyBub3QgbG9hZGVkJ1xuXG5cdFx0bnVsbFxuXG5cdEBsb2dpbkNhbGxiYWNrIDogKHJlcykgPT5cblxuXHRcdGlmIHJlc1snc3RhdHVzJ11bJ3NpZ25lZF9pbiddXG5cdFx0XHRAZ2V0VXNlckRhdGEgcmVzWydhY2Nlc3NfdG9rZW4nXVxuXHRcdGVsc2UgaWYgcmVzWydlcnJvciddWydhY2Nlc3NfZGVuaWVkJ11cblx0XHRcdEAkZGF0YURmZC5yZWplY3QgJ25vIHdheSBqb3NlJ1xuXG5cdFx0bnVsbFxuXG5cdEBnZXRVc2VyRGF0YSA6ICh0b2tlbikgPT5cblxuXHRcdGdhcGkuY2xpZW50LmxvYWQgJ3BsdXMnLCd2MScsID0+XG5cblx0XHRcdHJlcXVlc3QgPSBnYXBpLmNsaWVudC5wbHVzLnBlb3BsZS5nZXQgJ3VzZXJJZCc6ICdtZSdcblx0XHRcdHJlcXVlc3QuZXhlY3V0ZSAocmVzKSA9PlxuXG5cdFx0XHRcdHVzZXJEYXRhID1cblx0XHRcdFx0XHRhY2Nlc3NfdG9rZW4gOiB0b2tlblxuXHRcdFx0XHRcdGZ1bGxfbmFtZSAgICA6IHJlcy5kaXNwbGF5TmFtZVxuXHRcdFx0XHRcdHNvY2lhbF9pZCAgICA6IHJlcy5pZFxuXHRcdFx0XHRcdGVtYWlsICAgICAgICA6IGlmIHJlcy5lbWFpbHNbMF0gdGhlbiByZXMuZW1haWxzWzBdLnZhbHVlIGVsc2UgZmFsc2Vcblx0XHRcdFx0XHRwcm9maWxlX3BpYyAgOiByZXMuaW1hZ2UudXJsXG5cblx0XHRcdFx0QCRkYXRhRGZkLnJlc29sdmUgdXNlckRhdGFcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBHb29nbGVQbHVzXG4iLCIjICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgTWVkaWEgUXVlcmllcyBNYW5hZ2VyIFxuIyAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAgIFxuIyAgIEBhdXRob3IgOiBGw6FiaW8gQXpldmVkbyA8ZmFiaW8uYXpldmVkb0B1bml0OS5jb20+IFVOSVQ5XG4jICAgQGRhdGUgICA6IFNlcHRlbWJlciAxNFxuIyAgIFxuIyAgIEluc3RydWN0aW9ucyBhcmUgb24gL3Byb2plY3Qvc2Fzcy91dGlscy9fcmVzcG9uc2l2ZS5zY3NzLlxuXG5jbGFzcyBNZWRpYVF1ZXJpZXNcblxuICAgICMgQnJlYWtwb2ludHNcbiAgICBAU01BTEwgICAgICAgOiBcInNtYWxsXCJcbiAgICBASVBBRCAgICAgICAgOiBcImlwYWRcIlxuICAgIEBNRURJVU0gICAgICA6IFwibWVkaXVtXCJcbiAgICBATEFSR0UgICAgICAgOiBcImxhcmdlXCJcbiAgICBARVhUUkFfTEFSR0UgOiBcImV4dHJhLWxhcmdlXCJcblxuICAgIEBzZXR1cCA6ID0+XG5cbiAgICAgICAgTWVkaWFRdWVyaWVzLlNNQUxMX0JSRUFLUE9JTlQgID0ge25hbWU6IFwiU21hbGxcIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuU01BTExdfVxuICAgICAgICBNZWRpYVF1ZXJpZXMuTUVESVVNX0JSRUFLUE9JTlQgPSB7bmFtZTogXCJNZWRpdW1cIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuTUVESVVNXX1cbiAgICAgICAgTWVkaWFRdWVyaWVzLkxBUkdFX0JSRUFLUE9JTlQgID0ge25hbWU6IFwiTGFyZ2VcIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuSVBBRCwgTWVkaWFRdWVyaWVzLkxBUkdFLCBNZWRpYVF1ZXJpZXMuRVhUUkFfTEFSR0VdfVxuXG4gICAgICAgIE1lZGlhUXVlcmllcy5CUkVBS1BPSU5UUyA9IFtcbiAgICAgICAgICAgIE1lZGlhUXVlcmllcy5TTUFMTF9CUkVBS1BPSU5UXG4gICAgICAgICAgICBNZWRpYVF1ZXJpZXMuTUVESVVNX0JSRUFLUE9JTlRcbiAgICAgICAgICAgIE1lZGlhUXVlcmllcy5MQVJHRV9CUkVBS1BPSU5UXG4gICAgICAgIF1cbiAgICAgICAgcmV0dXJuXG5cbiAgICBAZ2V0RGV2aWNlU3RhdGUgOiA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5LCBcImFmdGVyXCIpLmdldFByb3BlcnR5VmFsdWUoXCJjb250ZW50XCIpO1xuXG4gICAgQGdldEJyZWFrcG9pbnQgOiA9PlxuXG4gICAgICAgIHN0YXRlID0gTWVkaWFRdWVyaWVzLmdldERldmljZVN0YXRlKClcblxuICAgICAgICBmb3IgaSBpbiBbMC4uLk1lZGlhUXVlcmllcy5CUkVBS1BPSU5UUy5sZW5ndGhdXG4gICAgICAgICAgICBpZiBNZWRpYVF1ZXJpZXMuQlJFQUtQT0lOVFNbaV0uYnJlYWtwb2ludHMuaW5kZXhPZihzdGF0ZSkgPiAtMVxuICAgICAgICAgICAgICAgIHJldHVybiBNZWRpYVF1ZXJpZXMuQlJFQUtQT0lOVFNbaV0ubmFtZVxuXG4gICAgICAgIHJldHVybiBcIlwiXG5cbiAgICBAaXNCcmVha3BvaW50IDogKGJyZWFrcG9pbnQpID0+XG5cbiAgICAgICAgZm9yIGkgaW4gWzAuLi5icmVha3BvaW50LmJyZWFrcG9pbnRzLmxlbmd0aF1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgYnJlYWtwb2ludC5icmVha3BvaW50c1tpXSA9PSBNZWRpYVF1ZXJpZXMuZ2V0RGV2aWNlU3RhdGUoKVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG5cbiAgICAgICAgcmV0dXJuIGZhbHNlXG5cbm1vZHVsZS5leHBvcnRzID0gTWVkaWFRdWVyaWVzIiwiY2xhc3MgTnVtYmVyVXRpbHNcblxuICAgIEBNQVRIX0NPUzogTWF0aC5jb3MgXG4gICAgQE1BVEhfU0lOOiBNYXRoLnNpbiBcbiAgICBATUFUSF9SQU5ET006IE1hdGgucmFuZG9tIFxuICAgIEBNQVRIX0FCUzogTWF0aC5hYnNcbiAgICBATUFUSF9BVEFOMjogTWF0aC5hdGFuMlxuXG4gICAgQGxpbWl0OihudW1iZXIsIG1pbiwgbWF4KS0+XG4gICAgICAgIHJldHVybiBNYXRoLm1pbiggTWF0aC5tYXgobWluLG51bWJlciksIG1heCApXG5cbiAgICBAZ2V0UmFuZG9tQ29sb3I6IC0+XG5cbiAgICAgICAgbGV0dGVycyA9ICcwMTIzNDU2Nzg5QUJDREVGJy5zcGxpdCgnJylcbiAgICAgICAgY29sb3IgPSAnIydcbiAgICAgICAgZm9yIGkgaW4gWzAuLi42XVxuICAgICAgICAgICAgY29sb3IgKz0gbGV0dGVyc1tNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAxNSldXG4gICAgICAgIGNvbG9yXG5cbiAgICBAZ2V0VGltZVN0YW1wRGlmZiA6IChkYXRlMSwgZGF0ZTIpIC0+XG5cbiAgICAgICAgIyBHZXQgMSBkYXkgaW4gbWlsbGlzZWNvbmRzXG4gICAgICAgIG9uZV9kYXkgPSAxMDAwKjYwKjYwKjI0XG4gICAgICAgIHRpbWUgICAgPSB7fVxuXG4gICAgICAgICMgQ29udmVydCBib3RoIGRhdGVzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICBkYXRlMV9tcyA9IGRhdGUxLmdldFRpbWUoKVxuICAgICAgICBkYXRlMl9tcyA9IGRhdGUyLmdldFRpbWUoKVxuXG4gICAgICAgICMgQ2FsY3VsYXRlIHRoZSBkaWZmZXJlbmNlIGluIG1pbGxpc2Vjb25kc1xuICAgICAgICBkaWZmZXJlbmNlX21zID0gZGF0ZTJfbXMgLSBkYXRlMV9tc1xuXG4gICAgICAgICMgdGFrZSBvdXQgbWlsbGlzZWNvbmRzXG4gICAgICAgIGRpZmZlcmVuY2VfbXMgPSBkaWZmZXJlbmNlX21zLzEwMDBcbiAgICAgICAgdGltZS5zZWNvbmRzICA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZV9tcyAlIDYwKVxuXG4gICAgICAgIGRpZmZlcmVuY2VfbXMgPSBkaWZmZXJlbmNlX21zLzYwIFxuICAgICAgICB0aW1lLm1pbnV0ZXMgID0gTWF0aC5mbG9vcihkaWZmZXJlbmNlX21zICUgNjApXG5cbiAgICAgICAgZGlmZmVyZW5jZV9tcyA9IGRpZmZlcmVuY2VfbXMvNjAgXG4gICAgICAgIHRpbWUuaG91cnMgICAgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VfbXMgJSAyNCkgIFxuXG4gICAgICAgIHRpbWUuZGF5cyAgICAgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VfbXMvMjQpXG5cbiAgICAgICAgdGltZVxuXG4gICAgQG1hcDogKCBudW0sIG1pbjEsIG1heDEsIG1pbjIsIG1heDIsIHJvdW5kID0gZmFsc2UsIGNvbnN0cmFpbk1pbiA9IHRydWUsIGNvbnN0cmFpbk1heCA9IHRydWUgKSAtPlxuICAgICAgICBpZiBjb25zdHJhaW5NaW4gYW5kIG51bSA8IG1pbjEgdGhlbiByZXR1cm4gbWluMlxuICAgICAgICBpZiBjb25zdHJhaW5NYXggYW5kIG51bSA+IG1heDEgdGhlbiByZXR1cm4gbWF4MlxuICAgICAgICBcbiAgICAgICAgbnVtMSA9IChudW0gLSBtaW4xKSAvIChtYXgxIC0gbWluMSlcbiAgICAgICAgbnVtMiA9IChudW0xICogKG1heDIgLSBtaW4yKSkgKyBtaW4yXG4gICAgICAgIGlmIHJvdW5kIHRoZW4gcmV0dXJuIE1hdGgucm91bmQobnVtMilcblxuICAgICAgICByZXR1cm4gbnVtMlxuXG4gICAgQHRvUmFkaWFuczogKCBkZWdyZWUgKSAtPlxuICAgICAgICByZXR1cm4gZGVncmVlICogKCBNYXRoLlBJIC8gMTgwIClcblxuICAgIEB0b0RlZ3JlZTogKCByYWRpYW5zICkgLT5cbiAgICAgICAgcmV0dXJuIHJhZGlhbnMgKiAoIDE4MCAvIE1hdGguUEkgKVxuXG4gICAgQGlzSW5SYW5nZTogKCBudW0sIG1pbiwgbWF4LCBjYW5CZUVxdWFsICkgLT5cbiAgICAgICAgaWYgY2FuQmVFcXVhbCB0aGVuIHJldHVybiBudW0gPj0gbWluICYmIG51bSA8PSBtYXhcbiAgICAgICAgZWxzZSByZXR1cm4gbnVtID49IG1pbiAmJiBudW0gPD0gbWF4XG5cbiAgICAjIGNvbnZlcnQgbWV0cmVzIGluIHRvIG0gLyBLTVxuICAgIEBnZXROaWNlRGlzdGFuY2U6IChtZXRyZXMpID0+XG5cbiAgICAgICAgaWYgbWV0cmVzIDwgMTAwMFxuXG4gICAgICAgICAgICByZXR1cm4gXCIje01hdGgucm91bmQobWV0cmVzKX1NXCJcblxuICAgICAgICBlbHNlXG5cbiAgICAgICAgICAgIGttID0gKG1ldHJlcy8xMDAwKS50b0ZpeGVkKDIpXG4gICAgICAgICAgICByZXR1cm4gXCIje2ttfUtNXCJcblxuICAgICMgZnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xMjY3MzM4XG4gICAgQHplcm9GaWxsOiAoIG51bWJlciwgd2lkdGggKSA9PlxuXG4gICAgICAgIHdpZHRoIC09IG51bWJlci50b1N0cmluZygpLmxlbmd0aFxuXG4gICAgICAgIGlmIHdpZHRoID4gMFxuICAgICAgICAgICAgcmV0dXJuIG5ldyBBcnJheSggd2lkdGggKyAoL1xcLi8udGVzdCggbnVtYmVyICkgPyAyIDogMSkgKS5qb2luKCAnMCcgKSArIG51bWJlclxuXG4gICAgICAgIHJldHVybiBudW1iZXIgKyBcIlwiICMgYWx3YXlzIHJldHVybiBhIHN0cmluZ1xuXG5tb2R1bGUuZXhwb3J0cyA9IE51bWJlclV0aWxzXG4iLCIjIyNcbiMgUmVxdWVzdGVyICNcblxuV3JhcHBlciBmb3IgYCQuYWpheGAgY2FsbHNcblxuIyMjXG5jbGFzcyBSZXF1ZXN0ZXJcblxuICAgIEByZXF1ZXN0cyA6IFtdXG5cbiAgICBAcmVxdWVzdDogKCBkYXRhICkgPT5cbiAgICAgICAgIyMjXG4gICAgICAgIGBkYXRhID0ge2A8YnI+XG4gICAgICAgIGAgIHVybCAgICAgICAgIDogU3RyaW5nYDxicj5cbiAgICAgICAgYCAgdHlwZSAgICAgICAgOiBcIlBPU1QvR0VUL1BVVFwiYDxicj5cbiAgICAgICAgYCAgZGF0YSAgICAgICAgOiBPYmplY3RgPGJyPlxuICAgICAgICBgICBkYXRhVHlwZSAgICA6IGpRdWVyeSBkYXRhVHlwZWA8YnI+XG4gICAgICAgIGAgIGNvbnRlbnRUeXBlIDogU3RyaW5nYDxicj5cbiAgICAgICAgYH1gXG4gICAgICAgICMjI1xuXG4gICAgICAgIHIgPSAkLmFqYXgge1xuXG4gICAgICAgICAgICB1cmwgICAgICAgICA6IGRhdGEudXJsXG4gICAgICAgICAgICB0eXBlICAgICAgICA6IGlmIGRhdGEudHlwZSB0aGVuIGRhdGEudHlwZSBlbHNlIFwiUE9TVFwiLFxuICAgICAgICAgICAgZGF0YSAgICAgICAgOiBpZiBkYXRhLmRhdGEgdGhlbiBkYXRhLmRhdGEgZWxzZSBudWxsLFxuICAgICAgICAgICAgZGF0YVR5cGUgICAgOiBpZiBkYXRhLmRhdGFUeXBlIHRoZW4gZGF0YS5kYXRhVHlwZSBlbHNlIFwianNvblwiLFxuICAgICAgICAgICAgY29udGVudFR5cGUgOiBpZiBkYXRhLmNvbnRlbnRUeXBlIHRoZW4gZGF0YS5jb250ZW50VHlwZSBlbHNlIFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCIsXG4gICAgICAgICAgICBwcm9jZXNzRGF0YSA6IGlmIGRhdGEucHJvY2Vzc0RhdGEgIT0gbnVsbCBhbmQgZGF0YS5wcm9jZXNzRGF0YSAhPSB1bmRlZmluZWQgdGhlbiBkYXRhLnByb2Nlc3NEYXRhIGVsc2UgdHJ1ZVxuXG4gICAgICAgIH1cblxuICAgICAgICByLmRvbmUgZGF0YS5kb25lXG4gICAgICAgIHIuZmFpbCBkYXRhLmZhaWxcbiAgICAgICAgXG4gICAgICAgIHJcblxuICAgIEBhZGRJbWFnZSA6IChkYXRhLCBkb25lLCBmYWlsKSA9PlxuICAgICAgICAjIyNcbiAgICAgICAgKiogVXNhZ2U6IDxicj5cbiAgICAgICAgYGRhdGEgPSBjYW52YXNzLnRvRGF0YVVSTChcImltYWdlL2pwZWdcIikuc2xpY2UoXCJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LFwiLmxlbmd0aClgPGJyPlxuICAgICAgICBgUmVxdWVzdGVyLmFkZEltYWdlIGRhdGEsIFwiem9ldHJvcGVcIiwgQGRvbmUsIEBmYWlsYFxuICAgICAgICAjIyNcblxuICAgICAgICBAcmVxdWVzdFxuICAgICAgICAgICAgdXJsICAgIDogJy9hcGkvaW1hZ2VzLydcbiAgICAgICAgICAgIHR5cGUgICA6ICdQT1NUJ1xuICAgICAgICAgICAgZGF0YSAgIDoge2ltYWdlX2Jhc2U2NCA6IGVuY29kZVVSSShkYXRhKX1cbiAgICAgICAgICAgIGRvbmUgICA6IGRvbmVcbiAgICAgICAgICAgIGZhaWwgICA6IGZhaWxcblxuICAgICAgICBudWxsXG5cbiAgICBAZGVsZXRlSW1hZ2UgOiAoaWQsIGRvbmUsIGZhaWwpID0+XG4gICAgICAgIFxuICAgICAgICBAcmVxdWVzdFxuICAgICAgICAgICAgdXJsICAgIDogJy9hcGkvaW1hZ2VzLycraWRcbiAgICAgICAgICAgIHR5cGUgICA6ICdERUxFVEUnXG4gICAgICAgICAgICBkb25lICAgOiBkb25lXG4gICAgICAgICAgICBmYWlsICAgOiBmYWlsXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcXVlc3RlclxuIiwiIyMjXG5TaGFyaW5nIGNsYXNzIGZvciBub24tU0RLIGxvYWRlZCBzb2NpYWwgbmV0d29ya3MuXG5JZiBTREsgaXMgbG9hZGVkLCBhbmQgcHJvdmlkZXMgc2hhcmUgbWV0aG9kcywgdGhlbiB1c2UgdGhhdCBjbGFzcyBpbnN0ZWFkLCBlZy4gYEZhY2Vib29rLnNoYXJlYCBpbnN0ZWFkIG9mIGBTaGFyZS5mYWNlYm9va2BcbiMjI1xuY2xhc3MgU2hhcmVcblxuICAgIHVybCA6IG51bGxcblxuICAgIGNvbnN0cnVjdG9yIDogLT5cblxuICAgICAgICBAdXJsID0gQENEX0NFKCkuU0lURV9VUkxcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgb3BlbldpbiA6ICh1cmwsIHcsIGgpID0+XG5cbiAgICAgICAgbGVmdCA9ICggc2NyZWVuLmF2YWlsV2lkdGggIC0gdyApID4+IDFcbiAgICAgICAgdG9wICA9ICggc2NyZWVuLmF2YWlsSGVpZ2h0IC0gaCApID4+IDFcblxuICAgICAgICB3aW5kb3cub3BlbiB1cmwsICcnLCAndG9wPScrdG9wKycsbGVmdD0nK2xlZnQrJyx3aWR0aD0nK3crJyxoZWlnaHQ9JytoKycsbG9jYXRpb249bm8sbWVudWJhcj1ubydcblxuICAgICAgICBudWxsXG5cbiAgICBwbHVzIDogKCB1cmwgKSA9PlxuXG4gICAgICAgIHVybCA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcblxuICAgICAgICBAb3BlbldpbiBcImh0dHBzOi8vcGx1cy5nb29nbGUuY29tL3NoYXJlP3VybD0je3VybH1cIiwgNjUwLCAzODVcblxuICAgICAgICBudWxsXG5cbiAgICBwaW50ZXJlc3QgOiAodXJsLCBtZWRpYSwgZGVzY3IpID0+XG5cbiAgICAgICAgdXJsICAgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG4gICAgICAgIG1lZGlhID0gZW5jb2RlVVJJQ29tcG9uZW50KG1lZGlhKVxuICAgICAgICBkZXNjciA9IGVuY29kZVVSSUNvbXBvbmVudChkZXNjcilcblxuICAgICAgICBAb3BlbldpbiBcImh0dHA6Ly93d3cucGludGVyZXN0LmNvbS9waW4vY3JlYXRlL2J1dHRvbi8/dXJsPSN7dXJsfSZtZWRpYT0je21lZGlhfSZkZXNjcmlwdGlvbj0je2Rlc2NyfVwiLCA3MzUsIDMxMFxuXG4gICAgICAgIG51bGxcblxuICAgIHR1bWJsciA6ICh1cmwsIG1lZGlhLCBkZXNjcikgPT5cblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgbWVkaWEgPSBlbmNvZGVVUklDb21wb25lbnQobWVkaWEpXG4gICAgICAgIGRlc2NyID0gZW5jb2RlVVJJQ29tcG9uZW50KGRlc2NyKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3d3dy50dW1ibHIuY29tL3NoYXJlL3Bob3RvP3NvdXJjZT0je21lZGlhfSZjYXB0aW9uPSN7ZGVzY3J9JmNsaWNrX3RocnU9I3t1cmx9XCIsIDQ1MCwgNDMwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgZmFjZWJvb2sgOiAoIHVybCAsIGNvcHkgPSAnJykgPT4gXG5cbiAgICAgICAgdXJsICAgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG4gICAgICAgIGRlY3NyID0gZW5jb2RlVVJJQ29tcG9uZW50KGNvcHkpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vd3d3LmZhY2Vib29rLmNvbS9zaGFyZS5waHA/dT0je3VybH0mdD0je2RlY3NyfVwiLCA2MDAsIDMwMFxuXG4gICAgICAgIG51bGxcblxuICAgIHR3aXR0ZXIgOiAoIHVybCAsIGNvcHkgPSAnJykgPT5cblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgaWYgY29weSBpcyAnJ1xuICAgICAgICAgICAgY29weSA9IEBDRF9DRSgpLmxvY2FsZS5nZXQgJ3Nlb190d2l0dGVyX2NhcmRfZGVzY3JpcHRpb24nXG4gICAgICAgICAgICBcbiAgICAgICAgZGVzY3IgPSBlbmNvZGVVUklDb21wb25lbnQoY29weSlcblxuICAgICAgICBAb3BlbldpbiBcImh0dHA6Ly90d2l0dGVyLmNvbS9pbnRlbnQvdHdlZXQvP3RleHQ9I3tkZXNjcn0mdXJsPSN7dXJsfVwiLCA2MDAsIDMwMFxuXG4gICAgICAgIG51bGxcblxuICAgIHJlbnJlbiA6ICggdXJsICkgPT4gXG5cbiAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3NoYXJlLnJlbnJlbi5jb20vc2hhcmUvYnV0dG9uc2hhcmUuZG8/bGluaz1cIiArIHVybCwgNjAwLCAzMDBcblxuICAgICAgICBudWxsXG5cbiAgICB3ZWlibyA6ICggdXJsICkgPT4gXG5cbiAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3NlcnZpY2Uud2VpYm8uY29tL3NoYXJlL3NoYXJlLnBocD91cmw9I3t1cmx9Jmxhbmd1YWdlPXpoX2NuXCIsIDYwMCwgMzAwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgQ0RfQ0UgOiA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBTaGFyZVxuIiwiY2xhc3MgQWJzdHJhY3RWaWV3IGV4dGVuZHMgQmFja2JvbmUuVmlld1xuXG5cdGVsICAgICAgICAgICA6IG51bGxcblx0aWQgICAgICAgICAgIDogbnVsbFxuXHRjaGlsZHJlbiAgICAgOiBudWxsXG5cdHRlbXBsYXRlICAgICA6IG51bGxcblx0dGVtcGxhdGVWYXJzIDogbnVsbFxuXHRcblx0aW5pdGlhbGl6ZSA6IC0+XG5cdFx0XG5cdFx0QGNoaWxkcmVuID0gW11cblxuXHRcdGlmIEB0ZW1wbGF0ZVxuXHRcdFx0dG1wSFRNTCA9IF8udGVtcGxhdGUgQENEX0NFKCkudGVtcGxhdGVzLmdldCBAdGVtcGxhdGVcblx0XHRcdEBzZXRFbGVtZW50IHRtcEhUTUwgQHRlbXBsYXRlVmFyc1xuXG5cdFx0QCRlbC5hdHRyICdpZCcsIEBpZCBpZiBAaWRcblx0XHRAJGVsLmFkZENsYXNzIEBjbGFzc05hbWUgaWYgQGNsYXNzTmFtZVxuXHRcdFxuXHRcdEBpbml0KClcblxuXHRcdEBwYXVzZWQgPSBmYWxzZVxuXG5cdFx0bnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdHVwZGF0ZSA6ID0+XG5cblx0XHRudWxsXG5cblx0cmVuZGVyIDogPT5cblxuXHRcdG51bGxcblxuXHRhZGRDaGlsZCA6IChjaGlsZCwgcHJlcGVuZCA9IGZhbHNlKSA9PlxuXG5cdFx0QGNoaWxkcmVuLnB1c2ggY2hpbGQgaWYgY2hpbGQuZWxcblx0XHR0YXJnZXQgPSBpZiBAYWRkVG9TZWxlY3RvciB0aGVuIEAkZWwuZmluZChAYWRkVG9TZWxlY3RvcikuZXEoMCkgZWxzZSBAJGVsXG5cdFx0XG5cdFx0YyA9IGlmIGNoaWxkLmVsIHRoZW4gY2hpbGQuJGVsIGVsc2UgY2hpbGRcblxuXHRcdGlmICFwcmVwZW5kIFxuXHRcdFx0dGFyZ2V0LmFwcGVuZCBjXG5cdFx0ZWxzZSBcblx0XHRcdHRhcmdldC5wcmVwZW5kIGNcblxuXHRcdEBcblxuXHRyZXBsYWNlIDogKGRvbSwgY2hpbGQpID0+XG5cblx0XHRAY2hpbGRyZW4ucHVzaCBjaGlsZCBpZiBjaGlsZC5lbFxuXHRcdGMgPSBpZiBjaGlsZC5lbCB0aGVuIGNoaWxkLiRlbCBlbHNlIGNoaWxkXG5cdFx0QCRlbC5jaGlsZHJlbihkb20pLnJlcGxhY2VXaXRoKGMpXG5cblx0XHRudWxsXG5cblx0cmVtb3ZlIDogKGNoaWxkKSA9PlxuXG5cdFx0dW5sZXNzIGNoaWxkP1xuXHRcdFx0cmV0dXJuXG5cdFx0XG5cdFx0YyA9IGlmIGNoaWxkLmVsIHRoZW4gY2hpbGQuJGVsIGVsc2UgJChjaGlsZClcblx0XHRjaGlsZC5kaXNwb3NlKCkgaWYgYyBhbmQgY2hpbGQuZGlzcG9zZVxuXG5cdFx0aWYgYyAmJiBAY2hpbGRyZW4uaW5kZXhPZihjaGlsZCkgIT0gLTFcblx0XHRcdEBjaGlsZHJlbi5zcGxpY2UoIEBjaGlsZHJlbi5pbmRleE9mKGNoaWxkKSwgMSApXG5cblx0XHRjLnJlbW92ZSgpXG5cblx0XHRudWxsXG5cblx0b25SZXNpemUgOiAoZXZlbnQpID0+XG5cblx0XHQoaWYgY2hpbGQub25SZXNpemUgdGhlbiBjaGlsZC5vblJlc2l6ZSgpKSBmb3IgY2hpbGQgaW4gQGNoaWxkcmVuXG5cblx0XHRudWxsXG5cblx0bW91c2VFbmFibGVkIDogKCBlbmFibGVkICkgPT5cblxuXHRcdEAkZWwuY3NzXG5cdFx0XHRcInBvaW50ZXItZXZlbnRzXCI6IGlmIGVuYWJsZWQgdGhlbiBcImF1dG9cIiBlbHNlIFwibm9uZVwiXG5cblx0XHRudWxsXG5cblx0Q1NTVHJhbnNsYXRlIDogKHgsIHksIHZhbHVlPSclJywgc2NhbGUpID0+XG5cblx0XHRpZiBNb2Rlcm5penIuY3NzdHJhbnNmb3JtczNkXG5cdFx0XHRzdHIgPSBcInRyYW5zbGF0ZTNkKCN7eCt2YWx1ZX0sICN7eSt2YWx1ZX0sIDApXCJcblx0XHRlbHNlXG5cdFx0XHRzdHIgPSBcInRyYW5zbGF0ZSgje3grdmFsdWV9LCAje3krdmFsdWV9KVwiXG5cblx0XHRpZiBzY2FsZSB0aGVuIHN0ciA9IFwiI3tzdHJ9IHNjYWxlKCN7c2NhbGV9KVwiXG5cblx0XHRzdHJcblxuXHR1bk11dGVBbGwgOiA9PlxuXG5cdFx0Zm9yIGNoaWxkIGluIEBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZC51bk11dGU/KClcblxuXHRcdFx0aWYgY2hpbGQuY2hpbGRyZW4ubGVuZ3RoXG5cblx0XHRcdFx0Y2hpbGQudW5NdXRlQWxsKClcblxuXHRcdG51bGxcblxuXHRtdXRlQWxsIDogPT5cblxuXHRcdGZvciBjaGlsZCBpbiBAY2hpbGRyZW5cblxuXHRcdFx0Y2hpbGQubXV0ZT8oKVxuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRjaGlsZC5tdXRlQWxsKClcblxuXHRcdG51bGxcblxuXHRyZW1vdmVBbGxDaGlsZHJlbjogPT5cblxuXHRcdEByZW1vdmUgY2hpbGQgZm9yIGNoaWxkIGluIEBjaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdHRyaWdnZXJDaGlsZHJlbiA6IChtc2csIGNoaWxkcmVuPUBjaGlsZHJlbikgPT5cblxuXHRcdGZvciBjaGlsZCwgaSBpbiBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZC50cmlnZ2VyIG1zZ1xuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRAdHJpZ2dlckNoaWxkcmVuIG1zZywgY2hpbGQuY2hpbGRyZW5cblxuXHRcdG51bGxcblxuXHRjYWxsQ2hpbGRyZW4gOiAobWV0aG9kLCBwYXJhbXMsIGNoaWxkcmVuPUBjaGlsZHJlbikgPT5cblxuXHRcdGZvciBjaGlsZCwgaSBpbiBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZFttZXRob2RdPyBwYXJhbXNcblxuXHRcdFx0aWYgY2hpbGQuY2hpbGRyZW4ubGVuZ3RoXG5cblx0XHRcdFx0QGNhbGxDaGlsZHJlbiBtZXRob2QsIHBhcmFtcywgY2hpbGQuY2hpbGRyZW5cblxuXHRcdG51bGxcblxuXHRjYWxsQ2hpbGRyZW5BbmRTZWxmIDogKG1ldGhvZCwgcGFyYW1zLCBjaGlsZHJlbj1AY2hpbGRyZW4pID0+XG5cblx0XHRAW21ldGhvZF0/IHBhcmFtc1xuXG5cdFx0Zm9yIGNoaWxkLCBpIGluIGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkW21ldGhvZF0/IHBhcmFtc1xuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRAY2FsbENoaWxkcmVuIG1ldGhvZCwgcGFyYW1zLCBjaGlsZC5jaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdHN1cHBsYW50U3RyaW5nIDogKHN0ciwgdmFscykgLT5cblxuXHRcdHJldHVybiBzdHIucmVwbGFjZSAve3sgKFtee31dKikgfX0vZywgKGEsIGIpIC0+XG5cdFx0XHRyID0gdmFsc1tiXVxuXHRcdFx0KGlmIHR5cGVvZiByIGlzIFwic3RyaW5nXCIgb3IgdHlwZW9mIHIgaXMgXCJudW1iZXJcIiB0aGVuIHIgZWxzZSBhKVxuXG5cdGRpc3Bvc2UgOiA9PlxuXG5cdFx0IyMjXG5cdFx0b3ZlcnJpZGUgb24gcGVyIHZpZXcgYmFzaXMgLSB1bmJpbmQgZXZlbnQgaGFuZGxlcnMgZXRjXG5cdFx0IyMjXG5cblx0XHRudWxsXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Vmlld1xuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi9BYnN0cmFjdFZpZXcnXG5cbmNsYXNzIEFic3RyYWN0Vmlld1BhZ2UgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuXHRfc2hvd24gICAgIDogZmFsc2Vcblx0X2xpc3RlbmluZyA6IGZhbHNlXG5cblx0c2hvdyA6IChjYikgPT5cblxuXHRcdHJldHVybiB1bmxlc3MgIUBfc2hvd25cblx0XHRAX3Nob3duID0gdHJ1ZVxuXG5cdFx0IyMjXG5cdFx0Q0hBTkdFIEhFUkUgLSAncGFnZScgdmlld3MgYXJlIGFsd2F5cyBpbiBET00gLSB0byBzYXZlIGhhdmluZyB0byByZS1pbml0aWFsaXNlIGdtYXAgZXZlbnRzIChQSVRBKS4gTm8gbG9uZ2VyIHJlcXVpcmUgOmRpc3Bvc2UgbWV0aG9kXG5cdFx0IyMjXG5cdFx0QENEX0NFKCkuYXBwVmlldy53cmFwcGVyLmFkZENoaWxkIEBcblx0XHRAY2FsbENoaWxkcmVuQW5kU2VsZiAnc2V0TGlzdGVuZXJzJywgJ29uJ1xuXG5cdFx0IyMjIHJlcGxhY2Ugd2l0aCBzb21lIHByb3BlciB0cmFuc2l0aW9uIGlmIHdlIGNhbiAjIyNcblx0XHRAJGVsLmNzcyAndmlzaWJpbGl0eScgOiAndmlzaWJsZSdcblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdGhpZGUgOiAoY2IpID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIEBfc2hvd25cblx0XHRAX3Nob3duID0gZmFsc2VcblxuXHRcdCMjI1xuXHRcdENIQU5HRSBIRVJFIC0gJ3BhZ2UnIHZpZXdzIGFyZSBhbHdheXMgaW4gRE9NIC0gdG8gc2F2ZSBoYXZpbmcgdG8gcmUtaW5pdGlhbGlzZSBnbWFwIGV2ZW50cyAoUElUQSkuIE5vIGxvbmdlciByZXF1aXJlIDpkaXNwb3NlIG1ldGhvZFxuXHRcdCMjI1xuXHRcdEBDRF9DRSgpLmFwcFZpZXcud3JhcHBlci5yZW1vdmUgQFxuXG5cdFx0IyBAY2FsbENoaWxkcmVuQW5kU2VsZiAnc2V0TGlzdGVuZXJzJywgJ29mZidcblxuXHRcdCMjIyByZXBsYWNlIHdpdGggc29tZSBwcm9wZXIgdHJhbnNpdGlvbiBpZiB3ZSBjYW4gIyMjXG5cdFx0QCRlbC5jc3MgJ3Zpc2liaWxpdHknIDogJ2hpZGRlbidcblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdGRpc3Bvc2UgOiA9PlxuXG5cdFx0QGNhbGxDaGlsZHJlbkFuZFNlbGYgJ3NldExpc3RlbmVycycsICdvZmYnXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIHNldHRpbmcgaXNudCBAX2xpc3RlbmluZ1xuXHRcdEBfbGlzdGVuaW5nID0gc2V0dGluZ1xuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Vmlld1BhZ2VcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0VmlldydcblxuY2xhc3MgRm9vdGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cbiAgICB0ZW1wbGF0ZSA6ICdzaXRlLWZvb3RlcidcblxuICAgIGNvbnN0cnVjdG9yOiAtPlxuXG4gICAgICAgIEB0ZW1wbGF0ZVZhcnMgPSBcbiAgICAgICAgXHRkZXNjIDogQENEX0NFKCkubG9jYWxlLmdldCBcImZvb3Rlcl9kZXNjXCJcblxuICAgICAgICBzdXBlcigpXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBGb290ZXJcbiIsIkFic3RyYWN0VmlldyAgICAgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuUm91dGVyICAgICAgICAgICAgICAgPSByZXF1aXJlICcuLi8uLi9yb3V0ZXIvUm91dGVyJ1xuQ29kZVdvcmRUcmFuc2l0aW9uZXIgPSByZXF1aXJlICcuLi8uLi91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lcidcblxuY2xhc3MgSGVhZGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cblx0dGVtcGxhdGUgOiAnc2l0ZS1oZWFkZXInXG5cblx0RklSU1RfSEFTSENIQU5HRSA6IHRydWVcblx0RE9PRExFX0lORk9fT1BFTiA6IGZhbHNlXG5cblx0RVZFTlRfRE9PRExFX0lORk9fT1BFTiAgIDogJ0VWRU5UX0RPT0RMRV9JTkZPX09QRU4nXG5cdEVWRU5UX0RPT0RMRV9JTkZPX0NMT1NFICA6ICdFVkVOVF9ET09ETEVfSU5GT19DTE9TRSdcblx0RVZFTlRfSE9NRV9TQ1JPTExfVE9fVE9QIDogJ0VWRU5UX0hPTUVfU0NST0xMX1RPX1RPUCdcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdGVtcGxhdGVWYXJzID1cblx0XHRcdGhvbWVfbGFiZWwgIDogQENEX0NFKCkubG9jYWxlLmdldCgnaGVhZGVyX2xvZ29fbGFiZWwnKVxuXHRcdFx0Y2xvc2VfbGFiZWwgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdoZWFkZXJfY2xvc2VfbGFiZWwnKVxuXHRcdFx0aW5mb19sYWJlbCAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdoZWFkZXJfaW5mb19sYWJlbCcpXG5cblx0XHRzdXBlcigpXG5cblx0XHRAYmluZEV2ZW50cygpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0QCRsb2dvICAgICA9IEAkZWwuZmluZCgnLmxvZ29fX2xpbmsnKVxuXHRcdEAkaW5mb0J0biAgPSBAJGVsLmZpbmQoJy5pbmZvLWJ0bicpXG5cdFx0QCRjbG9zZUJ0biA9IEAkZWwuZmluZCgnLmNsb3NlLWJ0bicpXG5cblx0XHRudWxsXG5cblx0YmluZEV2ZW50cyA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9uIEBDRF9DRSgpLmFwcFZpZXcuRVZFTlRfUFJFTE9BREVSX0hJREUsIEBhbmltYXRlVGV4dEluXG5cdFx0QENEX0NFKCkucm91dGVyLm9uIFJvdXRlci5FVkVOVF9IQVNIX0NIQU5HRUQsIEBvbkhhc2hDaGFuZ2VcblxuXHRcdEAkZWwub24gJ21vdXNlZW50ZXInLCAnW2RhdGEtY29kZXdvcmRdJywgQG9uV29yZEVudGVyXG5cdFx0QCRlbC5vbiAnbW91c2VsZWF2ZScsICdbZGF0YS1jb2Rld29yZF0nLCBAb25Xb3JkTGVhdmVcblxuXHRcdEAkaW5mb0J0bi5vbiAnY2xpY2snLCBAb25JbmZvQnRuQ2xpY2tcblx0XHRAJGNsb3NlQnRuLm9uICdjbGljaycsIEBvbkNsb3NlQnRuQ2xpY2tcblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuJHdpbmRvdy5vbiAna2V5dXAnLCBAb25LZXl1cFxuXG5cdFx0bnVsbFxuXG5cdG9uSGFzaENoYW5nZSA6ICh3aGVyZSkgPT5cblxuXHRcdGlmIEBGSVJTVF9IQVNIQ0hBTkdFXG5cdFx0XHRARklSU1RfSEFTSENIQU5HRSA9IGZhbHNlXG5cblx0XHRcdGNvbG9yU2NoZW1lID0gQF9nZXREb29kbGVDb2xvdXJTY2hlbWUoKVxuXHRcdFx0IyBDb2RlV29yZFRyYW5zaXRpb25lci5wcmVwYXJlIFtAJGxvZ28sIEAkaW5mb0J0bl0sIEBfZ2V0RG9vZGxlQ29sb3VyU2NoZW1lKClcblx0XHRcdEAkbG9nby5hZGQoQCRpbmZvQnRuKVxuXHRcdFx0XHQuYWRkQ2xhc3MoY29sb3JTY2hlbWUpXG5cdFx0XHRcdC5hdHRyKCdkYXRhLWNvZGV3b3JkLWluaXRpYWwtc3RhdGUnLCBjb2xvclNjaGVtZSlcblx0XHRcdFx0LmZpbmQoJ1tkYXRhLWNvZGV0ZXh0LWNoYXItc3RhdGVdJylcblx0XHRcdFx0XHQuYXR0cignZGF0YS1jb2RldGV4dC1jaGFyLXN0YXRlJywgY29sb3JTY2hlbWUpXG5cblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLm91dCBbQCRjbG9zZUJ0bl0sIGNvbG9yU2NoZW1lXG5cblx0XHRcdHJldHVyblxuXHRcdFxuXHRcdEBvbkFyZWFDaGFuZ2Ugd2hlcmVcblxuXHRcdG51bGxcblxuXHRvbkFyZWFDaGFuZ2UgOiAoc2VjdGlvbikgPT5cblxuXHRcdEBhY3RpdmVTZWN0aW9uID0gc2VjdGlvblxuXHRcdFxuXHRcdGNvbG91ciA9IEBnZXRTZWN0aW9uQ29sb3VyIHNlY3Rpb25cblxuXHRcdEAkZWwuYXR0ciAnZGF0YS1zZWN0aW9uJywgc2VjdGlvblxuXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIuaW4gQCRsb2dvLCBjb2xvdXJcblxuXHRcdGlmIHNlY3Rpb24gaXMgQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUVcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLmluIFtAJGluZm9CdG5dLCBjb2xvdXJcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLm91dCBbQCRjbG9zZUJ0bl0sIGNvbG91clxuXHRcdGVsc2UgaWYgc2VjdGlvbiBpcyAnZG9vZGxlLWluZm8nXG5cdFx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5pbiBbQCRjbG9zZUJ0bl0sIGNvbG91clxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIuaW4gW0AkaW5mb0J0bl0sICdyZWQtYWN0aXZlJ1xuXG5cdFx0bnVsbFxuXG5cdGdldFNlY3Rpb25Db2xvdXIgOiAoc2VjdGlvbiwgd29yZFNlY3Rpb249bnVsbCkgPT5cblxuXHRcdHNlY3Rpb24gPSBzZWN0aW9uIG9yIEBDRF9DRSgpLm5hdi5jdXJyZW50LmFyZWEgb3IgJ2hvbWUnXG5cblx0XHRpZiB3b3JkU2VjdGlvbiBhbmQgc2VjdGlvbiBpcyB3b3JkU2VjdGlvblxuXHRcdFx0aWYgd29yZFNlY3Rpb24gaXMgJ2Rvb2RsZS1pbmZvJ1xuXHRcdFx0XHRyZXR1cm4gJ3JlZC1hY3RpdmUnXG5cdFx0XHRlbHNlXG5cdFx0XHRcdHJldHVybiAnd2hpdGUtYWN0aXZlJ1xuXG5cdFx0Y29sb3VyID0gc3dpdGNoIHNlY3Rpb25cblx0XHRcdHdoZW4gJ2hvbWUnLCAnZG9vZGxlLWluZm8nIHRoZW4gJ3JlZCdcblx0XHRcdHdoZW4gQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUUgdGhlbiBAX2dldERvb2RsZUNvbG91clNjaGVtZSgpXG5cdFx0XHRlbHNlICd3aGl0ZSdcblxuXHRcdGNvbG91clxuXG5cdF9nZXREb29kbGVDb2xvdXJTY2hlbWUgOiA9PlxuXG5cdFx0Y29sb3VyID0gaWYgQENEX0NFKCkuYXBwRGF0YS5hY3RpdmVEb29kbGUuZ2V0KCdjb2xvdXJfc2NoZW1lJykgaXMgJ2xpZ2h0JyB0aGVuICdibGFjaycgZWxzZSAnd2hpdGUnXG5cblx0XHRjb2xvdXJcblxuXHRhbmltYXRlVGV4dEluIDogPT5cblxuXHRcdEBvbkFyZWFDaGFuZ2UgQENEX0NFKCkubmF2LmN1cnJlbnQuYXJlYVxuXG5cdFx0bnVsbFxuXG5cdG9uV29yZEVudGVyIDogKGUpID0+XG5cblx0XHQkZWwgPSAkKGUuY3VycmVudFRhcmdldClcblx0XHR3b3JkU2VjdGlvbiA9ICRlbC5hdHRyKCdkYXRhLXdvcmQtc2VjdGlvbicpXG5cblx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5zY3JhbWJsZSAkZWwsIEBnZXRTZWN0aW9uQ29sb3VyKEBhY3RpdmVTZWN0aW9uLCB3b3JkU2VjdGlvbilcblxuXHRcdG51bGxcblxuXHRvbldvcmRMZWF2ZSA6IChlKSA9PlxuXG5cdFx0JGVsID0gJChlLmN1cnJlbnRUYXJnZXQpXG5cdFx0d29yZFNlY3Rpb24gPSAkZWwuYXR0cignZGF0YS13b3JkLXNlY3Rpb24nKVxuXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIudW5zY3JhbWJsZSAkZWwsIEBnZXRTZWN0aW9uQ29sb3VyKEBhY3RpdmVTZWN0aW9uLCB3b3JkU2VjdGlvbilcblxuXHRcdG51bGxcblxuXHRvbkluZm9CdG5DbGljayA6IChlKSA9PlxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRyZXR1cm4gdW5sZXNzIEBDRF9DRSgpLm5hdi5jdXJyZW50LmFyZWEgaXMgQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUVcblxuXHRcdGlmICFARE9PRExFX0lORk9fT1BFTiB0aGVuIEBzaG93RG9vZGxlSW5mbygpXG5cblx0XHRudWxsXG5cblx0b25DbG9zZUJ0bkNsaWNrIDogKGUpID0+XG5cblx0XHRpZiBARE9PRExFX0lORk9fT1BFTlxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpXG5cdFx0XHRAaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0bnVsbFxuXG5cdG9uS2V5dXAgOiAoZSkgPT5cblxuXHRcdGlmIGUua2V5Q29kZSBpcyAyNyB0aGVuIEBoaWRlRG9vZGxlSW5mbygpXG5cblx0XHRudWxsXG5cblx0c2hvd0Rvb2RsZUluZm8gOiA9PlxuXG5cdFx0cmV0dXJuIHVubGVzcyAhQERPT0RMRV9JTkZPX09QRU5cblxuXHRcdEBvbkFyZWFDaGFuZ2UgJ2Rvb2RsZS1pbmZvJ1xuXHRcdEB0cmlnZ2VyIEBFVkVOVF9ET09ETEVfSU5GT19PUEVOXG5cdFx0QERPT0RMRV9JTkZPX09QRU4gPSB0cnVlXG5cblx0XHRudWxsXG5cblx0aGlkZURvb2RsZUluZm8gOiA9PlxuXG5cdFx0cmV0dXJuIHVubGVzcyBARE9PRExFX0lORk9fT1BFTlxuXG5cdFx0QG9uQXJlYUNoYW5nZSBAQ0RfQ0UoKS5uYXYuY3VycmVudC5hcmVhXG5cdFx0QHRyaWdnZXIgQEVWRU5UX0RPT0RMRV9JTkZPX0NMT1NFXG5cdFx0QERPT0RMRV9JTkZPX09QRU4gPSBmYWxzZVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEhlYWRlclxuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuXG5jbGFzcyBQcmVsb2FkZXIgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblx0XG5cdGNiICAgICAgICAgICAgICA6IG51bGxcblx0XG5cdFRSQU5TSVRJT05fVElNRSA6IDAuNVxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEBzZXRFbGVtZW50ICQoJyNwcmVsb2FkZXInKVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRpbml0IDogPT5cblxuXHRcdG51bGxcblxuXHRzaG93IDogKEBjYikgPT5cblxuXHRcdEAkZWwuY3NzICdkaXNwbGF5JyA6ICdibG9jaydcblxuXHRcdG51bGxcblxuXHRvblNob3dDb21wbGV0ZSA6ID0+XG5cblx0XHRAY2I/KClcblxuXHRcdG51bGxcblxuXHRoaWRlIDogKEBjYikgPT5cblxuXHRcdEBvbkhpZGVDb21wbGV0ZSgpXG5cblx0XHRudWxsXG5cblx0b25IaWRlQ29tcGxldGUgOiA9PlxuXG5cdFx0QCRlbC5jc3MgJ2Rpc3BsYXknIDogJ25vbmUnXG5cdFx0QGNiPygpXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gUHJlbG9hZGVyXG4iLCJBYnN0cmFjdFZpZXcgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5Eb29kbGVQYWdlVmlldyAgICAgPSByZXF1aXJlICcuLi9kb29kbGVQYWdlL0Rvb2RsZVBhZ2VWaWV3J1xuTmF2ICAgICAgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vcm91dGVyL05hdidcblxuY2xhc3MgV3JhcHBlciBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdFZJRVdfVFlQRV9QQUdFICA6ICdwYWdlJ1xuXHRWSUVXX1RZUEVfTU9EQUwgOiAnbW9kYWwnXG5cblx0dGVtcGxhdGUgOiAnd3JhcHBlcidcblxuXHR2aWV3cyAgICAgICAgICA6IG51bGxcblx0cHJldmlvdXNWaWV3ICAgOiBudWxsXG5cdGN1cnJlbnRWaWV3ICAgIDogbnVsbFxuXHRiYWNrZ3JvdW5kVmlldyA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdmlld3MgPVxuXHRcdFx0ZG9vZGxlIDogY2xhc3NSZWYgOiBEb29kbGVQYWdlVmlldywgcm91dGUgOiBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRSwgdmlldyA6IG51bGwsIHR5cGUgOiBAVklFV19UWVBFX1BBR0VcblxuXHRcdEBjcmVhdGVDbGFzc2VzKClcblxuXHRcdHN1cGVyKClcblxuXHRcdCMgZGVjaWRlIGlmIHlvdSB3YW50IHRvIGFkZCBhbGwgY29yZSBET00gdXAgZnJvbnQsIG9yIGFkZCBvbmx5IHdoZW4gcmVxdWlyZWQsIHNlZSBjb21tZW50cyBpbiBBYnN0cmFjdFZpZXdQYWdlLmNvZmZlZVxuXHRcdCMgQGFkZENsYXNzZXMoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRjcmVhdGVDbGFzc2VzIDogPT5cblxuXHRcdChAdmlld3NbbmFtZV0udmlldyA9IG5ldyBAdmlld3NbbmFtZV0uY2xhc3NSZWYpIGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXG5cdFx0bnVsbFxuXG5cdGFkZENsYXNzZXMgOiA9PlxuXG5cdFx0IGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXHRcdCBcdGlmIGRhdGEudHlwZSBpcyBAVklFV19UWVBFX1BBR0UgdGhlbiBAYWRkQ2hpbGQgZGF0YS52aWV3XG5cblx0XHRudWxsXG5cblx0Z2V0Vmlld0J5Um91dGUgOiAocm91dGUpID0+XG5cblx0XHRmb3IgbmFtZSwgZGF0YSBvZiBAdmlld3Ncblx0XHRcdHJldHVybiBAdmlld3NbbmFtZV0gaWYgcm91dGUgaXMgQHZpZXdzW25hbWVdLnJvdXRlXG5cblx0XHRudWxsXG5cblx0Z2V0Vmlld0J5Um91dGUgOiAocm91dGUpID0+XG5cblx0XHRmb3IgbmFtZSwgZGF0YSBvZiBAdmlld3Ncblx0XHRcdHJldHVybiBAdmlld3NbbmFtZV0gaWYgcm91dGUgaXMgQHZpZXdzW25hbWVdLnJvdXRlXG5cblx0XHRpZiByb3V0ZSB0aGVuIHJldHVybiBAdmlld3MuZm91ck9oRm91clxuXG5cdFx0bnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5vbiAnc3RhcnQnLCBAc3RhcnRcblxuXHRcdG51bGxcblxuXHRzdGFydCA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9mZiAnc3RhcnQnLCBAc3RhcnRcblxuXHRcdEBiaW5kRXZlbnRzKClcblx0XHRAdXBkYXRlRGltcygpXG5cblx0XHRudWxsXG5cblx0YmluZEV2ZW50cyA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5uYXYub24gTmF2LkVWRU5UX0NIQU5HRV9WSUVXLCBAY2hhbmdlVmlld1xuXHRcdEBDRF9DRSgpLm5hdi5vbiBOYXYuRVZFTlRfQ0hBTkdFX1NVQl9WSUVXLCBAY2hhbmdlU3ViVmlld1xuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5vbiBAQ0RfQ0UoKS5hcHBWaWV3LkVWRU5UX1VQREFURV9ESU1FTlNJT05TLCBAdXBkYXRlRGltc1xuXG5cdFx0bnVsbFxuXG5cdHVwZGF0ZURpbXMgOiA9PlxuXG5cdFx0QCRlbC5jc3MgJ21pbi1oZWlnaHQnLCBAQ0RfQ0UoKS5hcHBWaWV3LmRpbXMuaFxuXG5cdFx0bnVsbFxuXG5cdGNoYW5nZVZpZXcgOiAocHJldmlvdXMsIGN1cnJlbnQpID0+XG5cblx0XHRpZiBAcGFnZVN3aXRjaERmZCBhbmQgQHBhZ2VTd2l0Y2hEZmQuc3RhdGUoKSBpc250ICdyZXNvbHZlZCdcblx0XHRcdGRvIChwcmV2aW91cywgY3VycmVudCkgPT4gQHBhZ2VTd2l0Y2hEZmQuZG9uZSA9PiBAY2hhbmdlVmlldyBwcmV2aW91cywgY3VycmVudFxuXHRcdFx0cmV0dXJuXG5cblx0XHRAcHJldmlvdXNWaWV3ID0gQGdldFZpZXdCeVJvdXRlIHByZXZpb3VzLmFyZWFcblx0XHRAY3VycmVudFZpZXcgID0gQGdldFZpZXdCeVJvdXRlIGN1cnJlbnQuYXJlYVxuXG5cdFx0aWYgIUBwcmV2aW91c1ZpZXdcblx0XHRcdEB0cmFuc2l0aW9uVmlld3MgZmFsc2UsIEBjdXJyZW50Vmlld1xuXHRcdGVsc2Vcblx0XHRcdEB0cmFuc2l0aW9uVmlld3MgQHByZXZpb3VzVmlldywgQGN1cnJlbnRWaWV3XG5cblx0XHRudWxsXG5cblx0Y2hhbmdlU3ViVmlldyA6IChjdXJyZW50KSA9PlxuXG5cdFx0QGN1cnJlbnRWaWV3LnZpZXcudHJpZ2dlciBOYXYuRVZFTlRfQ0hBTkdFX1NVQl9WSUVXLCBjdXJyZW50LnN1YlxuXG5cdFx0bnVsbFxuXG5cdHRyYW5zaXRpb25WaWV3cyA6IChmcm9tLCB0bykgPT5cblxuXHRcdEBwYWdlU3dpdGNoRGZkID0gJC5EZWZlcnJlZCgpXG5cblx0XHRpZiBmcm9tIGFuZCB0b1xuXHRcdFx0QENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIucHJlcGFyZSBmcm9tLnJvdXRlLCB0by5yb3V0ZVxuXHRcdFx0QENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIuaW4gPT4gZnJvbS52aWV3LmhpZGUgPT4gdG8udmlldy5zaG93ID0+IEBDRF9DRSgpLmFwcFZpZXcudHJhbnNpdGlvbmVyLm91dCA9PiBAcGFnZVN3aXRjaERmZC5yZXNvbHZlKClcblx0XHRlbHNlIGlmIGZyb21cblx0XHRcdGZyb20udmlldy5oaWRlIEBwYWdlU3dpdGNoRGZkLnJlc29sdmVcblx0XHRlbHNlIGlmIHRvXG5cdFx0XHR0by52aWV3LnNob3cgQHBhZ2VTd2l0Y2hEZmQucmVzb2x2ZVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFdyYXBwZXJcbiIsIkFic3RyYWN0Vmlld1BhZ2UgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXdQYWdlJ1xuQ29kZVdvcmRUcmFuc2l0aW9uZXIgPSByZXF1aXJlICcuLi8uLi91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lcidcblxuY2xhc3MgRG9vZGxlUGFnZVZpZXcgZXh0ZW5kcyBBYnN0cmFjdFZpZXdQYWdlXG5cblx0dGVtcGxhdGUgOiAncGFnZS1kb29kbGUnXG5cdG1vZGVsICAgIDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdGNvbnNvbGUubG9nIFwiaSBhbSBoYW1tXCJcblxuXHRcdEB0ZW1wbGF0ZVZhcnMgPSB7fVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRpbml0IDogPT5cblxuXHRcdEAkZnJhbWUgICAgICAgID0gQCRlbC5maW5kKCdbZGF0YS1kb29kbGUtZnJhbWVdJylcblx0XHRAJGluZm9Db250ZW50ICA9IEAkZWwuZmluZCgnW2RhdGEtZG9vZGxlLWluZm9dJylcblx0XHRAJGluc3RydWN0aW9ucyA9IEAkZWwuZmluZCgnW2RhdGEtZG9vZGxlLWluc3RydWN0aW9uc10nKVxuXG5cdFx0QCRtb3VzZSAgICA9IEAkZWwuZmluZCgnW2RhdGEtaW5kaWNhdG9yPVwibW91c2VcIl0nKVxuXHRcdEAka2V5Ym9hcmQgPSBAJGVsLmZpbmQoJ1tkYXRhLWluZGljYXRvcj1cImtleWJvYXJkXCJdJylcblx0XHRAJHRvdWNoICAgID0gQCRlbC5maW5kKCdbZGF0YS1pbmRpY2F0b3I9XCJ0b3VjaFwiXScpXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlcltzZXR0aW5nXSBAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlci5FVkVOVF9ET09ETEVfSU5GT19PUEVOLCBAb25JbmZvT3BlblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuaGVhZGVyW3NldHRpbmddIEBDRF9DRSgpLmFwcFZpZXcuaGVhZGVyLkVWRU5UX0RPT0RMRV9JTkZPX0NMT1NFLCBAb25JbmZvQ2xvc2Vcblx0XHRAJGVsW3NldHRpbmddICdjbGljaycsICdbZGF0YS1zaGFyZS1idG5dJywgQG9uU2hhcmVCdG5DbGlja1xuXG5cdFx0bnVsbFxuXG5cdHNob3cgOiAoY2IpID0+XG5cblx0XHRAbW9kZWwgPSBAQ0RfQ0UoKS5hcHBEYXRhLmFjdGl2ZURvb2RsZVxuXG5cdFx0QHNldHVwVUkoKVxuXG5cdFx0c3VwZXJcblxuXHRcdEBzaG93RnJhbWUgZmFsc2VcblxuXHRcdG51bGxcblxuXHRoaWRlIDogKGNiKSA9PlxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5oZWFkZXIuaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0c3VwZXJcblxuXHRcdG51bGxcblxuXHRzZXR1cFVJIDogPT5cblxuXHRcdEAkaW5mb0NvbnRlbnQuaHRtbCBAZ2V0RG9vZGxlSW5mb0NvbnRlbnQoKVxuXG5cdFx0QCRlbC5hdHRyICdkYXRhLWNvbG9yLXNjaGVtZScsIEBtb2RlbC5nZXQoJ2NvbG91cl9zY2hlbWUnKVxuXHRcdEAkZnJhbWUuYXR0cignc3JjJywgJycpLnJlbW92ZUNsYXNzKCdzaG93Jylcblx0XHRAJG1vdXNlLmF0dHIgJ2Rpc2FibGVkJywgIUBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLm1vdXNlJylcblx0XHRAJGtleWJvYXJkLmF0dHIgJ2Rpc2FibGVkJywgIUBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLmtleWJvYXJkJylcblx0XHRAJHRvdWNoLmF0dHIgJ2Rpc2FibGVkJywgIUBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLnRvdWNoJylcblxuXHRcdEBzZXR1cEluc3RydWN0aW9ucygpXG5cblx0XHRudWxsXG5cblx0c2hvd0ZyYW1lIDogKHJlbW92ZUV2ZW50PXRydWUpID0+XG5cblx0XHRpZiByZW1vdmVFdmVudCB0aGVuIEBDRF9DRSgpLmFwcFZpZXcudHJhbnNpdGlvbmVyLm9mZiBAQ0RfQ0UoKS5hcHBWaWV3LnRyYW5zaXRpb25lci5FVkVOVF9UUkFOU0lUSU9ORVJfT1VUX0RPTkUsIEBzaG93RnJhbWVcblxuXHRcdCMgVEVNUCwgT0JWWlxuXHRcdFNBTVBMRV9ESVIgPSBAbW9kZWwuZ2V0KCdTQU1QTEVfRElSJylcblxuXHRcdEAkZnJhbWUuYXR0ciAnc3JjJywgXCJodHRwOi8vc291cmNlLmNvZGVkb29kbC5lcy9zYW1wbGVfZG9vZGxlcy8je1NBTVBMRV9ESVJ9L2luZGV4Lmh0bWxcIlxuXHRcdEAkZnJhbWUub25lICdsb2FkJywgQHNob3dEb29kbGVcblxuXHRcdG51bGxcblxuXHRzaG93RG9vZGxlIDogPT5cblxuXHRcdEAkZnJhbWUuYWRkQ2xhc3MoJ3Nob3cnKVxuXHRcdHNldFRpbWVvdXQgPT5cblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLm91dCBAJGluc3RydWN0aW9uc1xuXHRcdCwgMTAwMFxuXG5cdFx0bnVsbFxuXG5cdHNldHVwSW5zdHJ1Y3Rpb25zIDogPT5cblxuXHRcdCRuZXdJbnN0cnVjdGlvbnMgPSBAZ2V0SW5zdHJ1Y3Rpb25zKClcblx0XHRAJGluc3RydWN0aW9ucy5yZXBsYWNlV2l0aCAkbmV3SW5zdHJ1Y3Rpb25zXG5cdFx0QCRpbnN0cnVjdGlvbnMgPSAkbmV3SW5zdHJ1Y3Rpb25zXG5cblx0XHRudWxsXG5cblx0Z2V0SW5zdHJ1Y3Rpb25zIDogPT5cblxuXHRcdCMgdGV4dCA9IEBtb2RlbC5nZXQoJ2luc3RydWN0aW9ucycpLnRvTG93ZXJDYXNlKClcblx0XHQjIFRFTVAhXG5cdFx0dGV4dCA9IHN3aXRjaCBAbW9kZWwuZ2V0KCdTQU1QTEVfRElSJylcblx0XHRcdHdoZW4gJ3NoYXBlLXN0cmVhbScsICdzaGFwZS1zdHJlYW0tbGlnaHQnIHRoZW4gJ21vdmUgeW91ciBtb3VzZSdcblx0XHRcdHdoZW4gJ2JveC1waHlzaWNzJyB0aGVuICdjbGljayBhbmQgZHJhZydcblx0XHRcdHdoZW4gJ3R1YmVzJyB0aGVuICdjbGljayBhbmQgaG9sZCdcblx0XHRcdGVsc2UgJydcblxuXHRcdCRpbnN0cnVjdGlvbnNFbCA9ICQoJzxzcGFuIC8+Jylcblx0XHQkaW5zdHJ1Y3Rpb25zRWxcblx0XHRcdC5hZGRDbGFzcygnZG9vZGxlLWluc3RydWN0aW9ucycpXG5cdFx0XHQuYXR0cignZGF0YS1jb2Rld29yZCcsICcnKVxuXHRcdFx0LmF0dHIoJ2RhdGEtZG9vZGxlLWluc3RydWN0aW9ucycsICcnKVxuXHRcdFx0LnRleHQodGV4dClcblxuXHRcdGNvbG91clNjaGVtZSA9IGlmIEBtb2RlbC5nZXQoJ2NvbG91cl9zY2hlbWUnKSBpcyAnbGlnaHQnIHRoZW4gJ2JsYWNrJyBlbHNlICd3aGl0ZSdcblx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5wcmVwYXJlICRpbnN0cnVjdGlvbnNFbCwgY29sb3VyU2NoZW1lXG5cblx0XHQkaW5zdHJ1Y3Rpb25zRWxcblxuXHRnZXREb29kbGVJbmZvQ29udGVudCA6ID0+XG5cblx0XHQjIG5vIG5lZWQgdG8gZG8gdGhpcyBmb3IgZXZlcnkgZG9vZGxlIC0gb25seSBkbyBpdCBpZiB3ZSB2aWV3IHRoZSBpbmZvIHBhbmUgZm9yIGEgcGFydGljdWxhciBkb29kbGVcblx0XHRAbW9kZWwuc2V0U2hvcnRsaW5rKClcblxuXHRcdGRvb2RsZUluZm9WYXJzID1cblx0XHRcdGluZGV4SFRNTCAgICAgICAgICAgICAgICAgIDogQG1vZGVsLmdldCgnaW5kZXhIVE1MJylcblx0XHRcdGxhYmVsX2F1dGhvciAgICAgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9hdXRob3JcIlxuXHRcdFx0Y29udGVudF9hdXRob3IgICAgICAgICAgICAgOiBAbW9kZWwuZ2V0QXV0aG9ySHRtbCgpXG5cdFx0XHRsYWJlbF9kb29kbGVfbmFtZSAgICAgICAgICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfZG9vZGxlX25hbWVcIlxuXHRcdFx0Y29udGVudF9kb29kbGVfbmFtZSAgICAgICAgOiBAbW9kZWwuZ2V0KCduYW1lJylcblx0XHRcdGxhYmVsX2Rlc2NyaXB0aW9uICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9kZXNjcmlwdGlvblwiXG5cdFx0XHRjb250ZW50X2Rlc2NyaXB0aW9uICAgICAgICA6IEBtb2RlbC5nZXQoJ2Rlc2NyaXB0aW9uJylcblx0XHRcdGxhYmVsX3RhZ3MgICAgICAgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF90YWdzXCJcblx0XHRcdGNvbnRlbnRfdGFncyAgICAgICAgICAgICAgIDogQG1vZGVsLmdldCgndGFncycpLmpvaW4oJywgJylcblx0XHRcdGxhYmVsX2ludGVyYWN0aW9uICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvblwiXG5cdFx0XHRjb250ZW50X2ludGVyYWN0aW9uICAgICAgICA6IEBfZ2V0SW50ZXJhY3Rpb25Db250ZW50KClcblx0XHRcdGxhYmVsX3NoYXJlICAgICAgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9zaGFyZVwiXG5cdFx0XHRzaGFyZV91cmwgICAgICAgICAgICAgICAgICA6IEBDRF9DRSgpLlNJVEVfVVJMICsgJy8nICsgQG1vZGVsLmdldCgnc2hvcnRsaW5rJylcblx0XHRcdHNoYXJlX3VybF90ZXh0ICAgICAgICAgICAgIDogQENEX0NFKCkuU0lURV9VUkwucmVwbGFjZSgnaHR0cDovLycsICcnKSArICcvJyArIEBtb2RlbC5nZXQoJ3Nob3J0bGluaycpXG5cblx0XHRkb29kbGVJbmZvQ29udGVudCA9IF8udGVtcGxhdGUoQENEX0NFKCkudGVtcGxhdGVzLmdldCgnZG9vZGxlLWluZm8nKSkoZG9vZGxlSW5mb1ZhcnMpXG5cblx0XHRkb29kbGVJbmZvQ29udGVudFxuXG5cdF9nZXRJbnRlcmFjdGlvbkNvbnRlbnQgOiA9PlxuXG5cdFx0aW50ZXJhY3Rpb25zID0gW11cblxuXHRcdGlmIEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLm1vdXNlJykgdGhlbiBpbnRlcmFjdGlvbnMucHVzaCBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uX21vdXNlXCJcblx0XHRpZiBAbW9kZWwuZ2V0KCdpbnRlcmFjdGlvbi5rZXlib2FyZCcpIHRoZW4gaW50ZXJhY3Rpb25zLnB1c2ggQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvbl9rZXlib2FyZFwiXG5cdFx0aWYgQG1vZGVsLmdldCgnaW50ZXJhY3Rpb24udG91Y2gnKSB0aGVuIGludGVyYWN0aW9ucy5wdXNoIEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfaW50ZXJhY3Rpb25fdG91Y2hcIlxuXG5cdFx0aW50ZXJhY3Rpb25zLmpvaW4oJywgJykgb3IgQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvbl9ub25lXCJcblxuXHRvbkluZm9PcGVuIDogPT5cblxuXHRcdEAkZWwuYWRkQ2xhc3MoJ3Nob3ctaW5mbycpXG5cblx0XHRudWxsXG5cblx0b25JbmZvQ2xvc2UgOiA9PlxuXG5cdFx0QCRlbC5yZW1vdmVDbGFzcygnc2hvdy1pbmZvJylcblxuXHRcdG51bGxcblxuXHRvblNoYXJlQnRuQ2xpY2sgOiAoZSkgPT5cblxuXHRcdGUucHJldmVudERlZmF1bHQoKVxuXG5cdFx0c2hhcmVNZXRob2QgPSAkKGUuY3VycmVudFRhcmdldCkuYXR0cignZGF0YS1zaGFyZS1idG4nKVxuXHRcdHVybCAgICAgICAgID0gaWYgc2hhcmVNZXRob2QgaXMgJ2ZhY2Vib29rJyB0aGVuIEBDRF9DRSgpLlNJVEVfVVJMICsgJy8nICsgQG1vZGVsLmdldCgnc2hvcnRsaW5rJykgZWxzZSAnICdcblx0XHRkZXNjICAgICAgICA9IEBnZXRTaGFyZURlc2MoKVxuXG5cdFx0QENEX0NFKCkuc2hhcmVbc2hhcmVNZXRob2RdIHVybCwgZGVzY1xuXG5cdFx0bnVsbFxuXG5cdGdldFNoYXJlRGVzYyA6ID0+XG5cblx0XHR2YXJzID1cblx0XHRcdGRvb2RsZV9uYW1lICAgOiBAbW9kZWwuZ2V0ICduYW1lJ1xuXHRcdFx0ZG9vZGxlX2F1dGhvciA6IGlmIEBtb2RlbC5nZXQoJ2F1dGhvci50d2l0dGVyJykgdGhlbiBcIkAje0Btb2RlbC5nZXQoJ2F1dGhvci50d2l0dGVyJyl9XCIgZWxzZSBAbW9kZWwuZ2V0KCdhdXRob3IubmFtZScpXG5cdFx0XHRzaGFyZV91cmwgICAgIDogQENEX0NFKCkuU0lURV9VUkwgKyAnLycgKyBAbW9kZWwuZ2V0KCdzaG9ydGxpbmsnKVxuXHRcdFx0ZG9vZGxlX3RhZ3MgICA6IF8ubWFwKEBtb2RlbC5nZXQoJ3RhZ3MnKSwgKHRhZykgLT4gJyMnICsgdGFnKS5qb2luKCcgJylcblxuXHRcdGRlc2MgPSBAc3VwcGxhbnRTdHJpbmcgQENEX0NFKCkubG9jYWxlLmdldCgnZG9vZGxlX3NoYXJlX3RleHRfdG1wbCcpLCB2YXJzLCBmYWxzZVxuXG5cdFx0ZGVzYy5yZXBsYWNlKC8mbmJzcDsvZywgJyAnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IERvb2RsZVBhZ2VWaWV3XG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5cbmNsYXNzIEFic3RyYWN0TW9kYWwgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuXHQkd2luZG93IDogbnVsbFxuXG5cdCMjIyBvdmVycmlkZSBpbiBpbmRpdmlkdWFsIGNsYXNzZXMgIyMjXG5cdG5hbWUgICAgIDogbnVsbFxuXHR0ZW1wbGF0ZSA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAJHdpbmRvdyA9ICQod2luZG93KVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5hZGRDaGlsZCBAXG5cdFx0QHNldExpc3RlbmVycyAnb24nXG5cdFx0QGFuaW1hdGVJbigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGhpZGUgOiA9PlxuXG5cdFx0QGFuaW1hdGVPdXQgPT4gQENEX0NFKCkuYXBwVmlldy5yZW1vdmUgQFxuXG5cdFx0bnVsbFxuXG5cdGRpc3Bvc2UgOiA9PlxuXG5cdFx0QHNldExpc3RlbmVycyAnb2ZmJ1xuXHRcdEBDRF9DRSgpLmFwcFZpZXcubW9kYWxNYW5hZ2VyLm1vZGFsc1tAbmFtZV0udmlldyA9IG51bGxcblxuXHRcdG51bGxcblxuXHRzZXRMaXN0ZW5lcnMgOiAoc2V0dGluZykgPT5cblxuXHRcdEAkd2luZG93W3NldHRpbmddICdrZXl1cCcsIEBvbktleVVwXG5cdFx0QCQoJ1tkYXRhLWNsb3NlXScpW3NldHRpbmddICdjbGljaycsIEBjbG9zZUNsaWNrXG5cblx0XHRudWxsXG5cblx0b25LZXlVcCA6IChlKSA9PlxuXG5cdFx0aWYgZS5rZXlDb2RlIGlzIDI3IHRoZW4gQGhpZGUoKVxuXG5cdFx0bnVsbFxuXG5cdGFuaW1hdGVJbiA6ID0+XG5cblx0XHRUd2VlbkxpdGUudG8gQCRlbCwgMC4zLCB7ICd2aXNpYmlsaXR5JzogJ3Zpc2libGUnLCAnb3BhY2l0eSc6IDEsIGVhc2UgOiBRdWFkLmVhc2VPdXQgfVxuXHRcdFR3ZWVuTGl0ZS50byBAJGVsLmZpbmQoJy5pbm5lcicpLCAwLjMsIHsgZGVsYXkgOiAwLjE1LCAndHJhbnNmb3JtJzogJ3NjYWxlKDEpJywgJ3Zpc2liaWxpdHknOiAndmlzaWJsZScsICdvcGFjaXR5JzogMSwgZWFzZSA6IEJhY2suZWFzZU91dCB9XG5cblx0XHRudWxsXG5cblx0YW5pbWF0ZU91dCA6IChjYWxsYmFjaykgPT5cblxuXHRcdFR3ZWVuTGl0ZS50byBAJGVsLCAwLjMsIHsgZGVsYXkgOiAwLjE1LCAnb3BhY2l0eSc6IDAsIGVhc2UgOiBRdWFkLmVhc2VPdXQsIG9uQ29tcGxldGU6IGNhbGxiYWNrIH1cblx0XHRUd2VlbkxpdGUudG8gQCRlbC5maW5kKCcuaW5uZXInKSwgMC4zLCB7ICd0cmFuc2Zvcm0nOiAnc2NhbGUoMC44KScsICdvcGFjaXR5JzogMCwgZWFzZSA6IEJhY2suZWFzZUluIH1cblxuXHRcdG51bGxcblxuXHRjbG9zZUNsaWNrOiAoIGUgKSA9PlxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRAaGlkZSgpXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RNb2RhbFxuIiwiQWJzdHJhY3RNb2RhbCA9IHJlcXVpcmUgJy4vQWJzdHJhY3RNb2RhbCdcblxuY2xhc3MgT3JpZW50YXRpb25Nb2RhbCBleHRlbmRzIEFic3RyYWN0TW9kYWxcblxuXHRuYW1lICAgICA6ICdvcmllbnRhdGlvbk1vZGFsJ1xuXHR0ZW1wbGF0ZSA6ICdvcmllbnRhdGlvbi1tb2RhbCdcblxuXHRjYiAgICAgICA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IChAY2IpIC0+XG5cblx0XHRAdGVtcGxhdGVWYXJzID0ge0BuYW1lfVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRpbml0IDogPT5cblxuXHRcdG51bGxcblxuXHRoaWRlIDogKHN0aWxsTGFuZHNjYXBlPXRydWUpID0+XG5cblx0XHRAYW5pbWF0ZU91dCA9PlxuXHRcdFx0QENEX0NFKCkuYXBwVmlldy5yZW1vdmUgQFxuXHRcdFx0aWYgIXN0aWxsTGFuZHNjYXBlIHRoZW4gQGNiPygpXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRzdXBlclxuXG5cdFx0QENEX0NFKCkuYXBwVmlld1tzZXR0aW5nXSAndXBkYXRlRGltcycsIEBvblVwZGF0ZURpbXNcblx0XHRAJGVsW3NldHRpbmddICd0b3VjaGVuZCBjbGljaycsIEBoaWRlXG5cblx0XHRudWxsXG5cblx0b25VcGRhdGVEaW1zIDogKGRpbXMpID0+XG5cblx0XHRpZiBkaW1zLm8gaXMgJ3BvcnRyYWl0JyB0aGVuIEBoaWRlIGZhbHNlXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gT3JpZW50YXRpb25Nb2RhbFxuIiwiQWJzdHJhY3RWaWV3ICAgICA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0Vmlldydcbk9yaWVudGF0aW9uTW9kYWwgPSByZXF1aXJlICcuL09yaWVudGF0aW9uTW9kYWwnXG5cbmNsYXNzIE1vZGFsTWFuYWdlciBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdCMgd2hlbiBuZXcgbW9kYWwgY2xhc3NlcyBhcmUgY3JlYXRlZCwgYWRkIGhlcmUsIHdpdGggcmVmZXJlbmNlIHRvIGNsYXNzIG5hbWVcblx0bW9kYWxzIDpcblx0XHRvcmllbnRhdGlvbk1vZGFsIDogY2xhc3NSZWYgOiBPcmllbnRhdGlvbk1vZGFsLCB2aWV3IDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdHN1cGVyKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRudWxsXG5cblx0aXNPcGVuIDogPT5cblxuXHRcdCggaWYgQG1vZGFsc1tuYW1lXS52aWV3IHRoZW4gcmV0dXJuIHRydWUgKSBmb3IgbmFtZSwgbW9kYWwgb2YgQG1vZGFsc1xuXG5cdFx0ZmFsc2VcblxuXHRoaWRlT3Blbk1vZGFsIDogPT5cblxuXHRcdCggaWYgQG1vZGFsc1tuYW1lXS52aWV3IHRoZW4gb3Blbk1vZGFsID0gQG1vZGFsc1tuYW1lXS52aWV3ICkgZm9yIG5hbWUsIG1vZGFsIG9mIEBtb2RhbHNcblxuXHRcdG9wZW5Nb2RhbD8uaGlkZSgpXG5cblx0XHRudWxsXG5cblx0c2hvd01vZGFsIDogKG5hbWUsIGNiPW51bGwpID0+XG5cblx0XHRyZXR1cm4gaWYgQG1vZGFsc1tuYW1lXS52aWV3XG5cblx0XHRAbW9kYWxzW25hbWVdLnZpZXcgPSBuZXcgQG1vZGFsc1tuYW1lXS5jbGFzc1JlZiBjYlxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGFsTWFuYWdlclxuIl19
