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
    "viewed": false
  };

  DoodleModel.prototype._filterAttrs = function(attrs) {
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
    CHARS: 'abcdefhijklmnopqrstuvwxyz0123456789!?*()@£$%^&_-+=[]{}:;\'"\\|<>,./~`'.split('').map(function(char) {
      return encode(char);
    }),
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
    if (this.FIRST_HASHCHANGE) {
      this.FIRST_HASHCHANGE = false;
      CodeWordTransitioner.prepare([this.$logo, this.$infoBtn], this._getDoodleColourScheme());
      CodeWordTransitioner.out([this.$closeBtn], this._getDoodleColourScheme());
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
      CodeWordTransitioner["in"]([this.$infoBtn], 'offwhite-red-bg');
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
        return 'offwhite-red-bg';
      } else {
        return 'black-white-bg';
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
var AbstractViewPage, DoodlePageView,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractViewPage = require('../AbstractViewPage');

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
    return null;
  };

  DoodlePageView.prototype.showFrame = function(removeEvent) {
    var srcDir;
    if (removeEvent == null) {
      removeEvent = true;
    }
    if (removeEvent) {
      this.CD_CE().appView.transitioner.off(this.CD_CE().appView.transitioner.EVENT_TRANSITIONER_OUT_DONE, this.showFrame);
    }
    srcDir = this.model.get('colour_scheme') === 'light' ? 'shape-stream-light' : 'shape-stream';
    this.$frame.attr('src', "http://source.codedoodl.es/sample_doodles/" + srcDir + "/index.html");
    this.$frame.one('load', (function(_this) {
      return function() {
        return _this.$frame.addClass('show');
      };
    })(this));
    return null;
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



},{"../AbstractViewPage":33}],39:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL01haW4uY29mZmVlIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3B1bnljb2RlL3B1bnljb2RlLmpzIiwibm9kZV9tb2R1bGVzL2VudC9lbmNvZGUuanMiLCJub2RlX21vZHVsZXMvZW50L3JldmVyc2VkLmpzb24iLCJub2RlX21vZHVsZXMvaGFzaGlkcy9saWIvaGFzaGlkcy5qcyIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvQXBwLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvQXBwRGF0YS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL0FwcFZpZXcuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9BYnN0cmFjdENvbGxlY3Rpb24uY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9jb3JlL1RlbXBsYXRlc0NvbGxlY3Rpb24uY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9kb29kbGVzL0Rvb2RsZXNDb2xsZWN0aW9uLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvZGF0YS9BUEkuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9kYXRhL0Fic3RyYWN0RGF0YS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL2RhdGEvTG9jYWxlLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvZGF0YS9UZW1wbGF0ZXMuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvQWJzdHJhY3RNb2RlbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL21vZGVscy9jb3JlL0FQSVJvdXRlTW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvY29yZS9Mb2NhbGVzTW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvY29yZS9UZW1wbGF0ZU1vZGVsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL2Rvb2RsZS9Eb29kbGVNb2RlbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3JvdXRlci9OYXYuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9yb3V0ZXIvUm91dGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvQW5hbHl0aWNzLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvQXV0aE1hbmFnZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0ZhY2Vib29rLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvR29vZ2xlUGx1cy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL01lZGlhUXVlcmllcy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL051bWJlclV0aWxzLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvUmVxdWVzdGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvU2hhcmUuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L0Fic3RyYWN0Vmlldy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvQWJzdHJhY3RWaWV3UGFnZS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvYmFzZS9Gb290ZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L2Jhc2UvSGVhZGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9iYXNlL1ByZWxvYWRlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvYmFzZS9XcmFwcGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9kb29kbGVQYWdlL0Rvb2RsZVBhZ2VWaWV3LmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9tb2RhbHMvQWJzdHJhY3RNb2RhbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvbW9kYWxzL09yaWVudGF0aW9uTW9kYWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L21vZGFscy9fTW9kYWxNYW5hZ2VyLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBLElBQUEsa0JBQUE7O0FBQUEsR0FBQSxHQUFNLE9BQUEsQ0FBUSxPQUFSLENBQU4sQ0FBQTs7QUFLQTtBQUFBOzs7R0FMQTs7QUFBQSxPQVdBLEdBQVUsS0FYVixDQUFBOztBQUFBLElBY0EsR0FBVSxPQUFILEdBQWdCLEVBQWhCLEdBQXlCLE1BQUEsSUFBVSxRQWQxQyxDQUFBOztBQUFBLElBaUJJLENBQUMsS0FBTCxHQUFpQixJQUFBLEdBQUEsQ0FBSSxPQUFKLENBakJqQixDQUFBOztBQUFBLElBa0JJLENBQUMsS0FBSyxDQUFDLElBQVgsQ0FBQSxDQWxCQSxDQUFBOzs7Ozs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbHlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZWQSxJQUFBLHdIQUFBO0VBQUEsa0ZBQUE7O0FBQUEsU0FBQSxHQUFlLE9BQUEsQ0FBUSxtQkFBUixDQUFmLENBQUE7O0FBQUEsV0FDQSxHQUFlLE9BQUEsQ0FBUSxxQkFBUixDQURmLENBQUE7O0FBQUEsS0FFQSxHQUFlLE9BQUEsQ0FBUSxl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LENBYlQsQ0FBQTs7QUFBQSx5QkFtQkEsYUFBQSxHQUFnQixTQUFBLEdBQUE7QUFFZixRQUFBLDRCQUFBO0FBQUE7QUFBQSxTQUFBLFlBQUE7eUJBQUE7QUFBRSxNQUFBLElBQUcsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxJQUFqQjtBQUEyQixRQUFBLFNBQUEsR0FBWSxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLElBQTFCLENBQTNCO09BQUY7QUFBQSxLQUFBOztNQUVBLFNBQVMsQ0FBRSxJQUFYLENBQUE7S0FGQTtXQUlBLEtBTmU7RUFBQSxDQW5CaEIsQ0FBQTs7QUFBQSx5QkEyQkEsU0FBQSxHQUFZLFNBQUMsSUFBRCxFQUFPLEVBQVAsR0FBQTs7TUFBTyxLQUFHO0tBRXJCO0FBQUEsSUFBQSxJQUFVLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBQSxDQUFLLENBQUMsSUFBeEI7QUFBQSxZQUFBLENBQUE7S0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxJQUFkLEdBQXlCLElBQUEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxRQUFkLENBQXVCLEVBQXZCLENBRnpCLENBQUE7V0FJQSxLQU5XO0VBQUEsQ0EzQlosQ0FBQTs7c0JBQUE7O0dBSDBCLGFBSDNCLENBQUE7O0FBQUEsTUF5Q00sQ0FBQyxPQUFQLEdBQWlCLFlBekNqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIkFwcCA9IHJlcXVpcmUgJy4vQXBwJ1xuXG4jIFBST0RVQ1RJT04gRU5WSVJPTk1FTlQgLSBtYXkgd2FudCB0byB1c2Ugc2VydmVyLXNldCB2YXJpYWJsZXMgaGVyZVxuIyBJU19MSVZFID0gZG8gLT4gcmV0dXJuIGlmIHdpbmRvdy5sb2NhdGlvbi5ob3N0LmluZGV4T2YoJ2xvY2FsaG9zdCcpID4gLTEgb3Igd2luZG93LmxvY2F0aW9uLnNlYXJjaCBpcyAnP2QnIHRoZW4gZmFsc2UgZWxzZSB0cnVlXG5cbiMjI1xuXG5XSVAgLSB0aGlzIHdpbGwgaWRlYWxseSBjaGFuZ2UgdG8gb2xkIGZvcm1hdCAoYWJvdmUpIHdoZW4gY2FuIGZpZ3VyZSBpdCBvdXRcblxuIyMjXG5cbklTX0xJVkUgPSBmYWxzZVxuXG4jIE9OTFkgRVhQT1NFIEFQUCBHTE9CQUxMWSBJRiBMT0NBTCBPUiBERVYnSU5HXG52aWV3ID0gaWYgSVNfTElWRSB0aGVuIHt9IGVsc2UgKHdpbmRvdyBvciBkb2N1bWVudClcblxuIyBERUNMQVJFIE1BSU4gQVBQTElDQVRJT05cbnZpZXcuQ0RfQ0UgPSBuZXcgQXBwIElTX0xJVkVcbnZpZXcuQ0RfQ0UuaW5pdCgpXG4iLCIvKiEgaHR0cDovL210aHMuYmUvcHVueWNvZGUgdjEuMi40IGJ5IEBtYXRoaWFzICovXG47KGZ1bmN0aW9uKHJvb3QpIHtcblxuXHQvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGVzICovXG5cdHZhciBmcmVlRXhwb3J0cyA9IHR5cGVvZiBleHBvcnRzID09ICdvYmplY3QnICYmIGV4cG9ydHM7XG5cdHZhciBmcmVlTW9kdWxlID0gdHlwZW9mIG1vZHVsZSA9PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiZcblx0XHRtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cyAmJiBtb2R1bGU7XG5cdHZhciBmcmVlR2xvYmFsID0gdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWw7XG5cdGlmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCkge1xuXHRcdHJvb3QgPSBmcmVlR2xvYmFsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBgcHVueWNvZGVgIG9iamVjdC5cblx0ICogQG5hbWUgcHVueWNvZGVcblx0ICogQHR5cGUgT2JqZWN0XG5cdCAqL1xuXHR2YXIgcHVueWNvZGUsXG5cblx0LyoqIEhpZ2hlc3QgcG9zaXRpdmUgc2lnbmVkIDMyLWJpdCBmbG9hdCB2YWx1ZSAqL1xuXHRtYXhJbnQgPSAyMTQ3NDgzNjQ3LCAvLyBha2EuIDB4N0ZGRkZGRkYgb3IgMl4zMS0xXG5cblx0LyoqIEJvb3RzdHJpbmcgcGFyYW1ldGVycyAqL1xuXHRiYXNlID0gMzYsXG5cdHRNaW4gPSAxLFxuXHR0TWF4ID0gMjYsXG5cdHNrZXcgPSAzOCxcblx0ZGFtcCA9IDcwMCxcblx0aW5pdGlhbEJpYXMgPSA3Mixcblx0aW5pdGlhbE4gPSAxMjgsIC8vIDB4ODBcblx0ZGVsaW1pdGVyID0gJy0nLCAvLyAnXFx4MkQnXG5cblx0LyoqIFJlZ3VsYXIgZXhwcmVzc2lvbnMgKi9cblx0cmVnZXhQdW55Y29kZSA9IC9eeG4tLS8sXG5cdHJlZ2V4Tm9uQVNDSUkgPSAvW14gLX5dLywgLy8gdW5wcmludGFibGUgQVNDSUkgY2hhcnMgKyBub24tQVNDSUkgY2hhcnNcblx0cmVnZXhTZXBhcmF0b3JzID0gL1xceDJFfFxcdTMwMDJ8XFx1RkYwRXxcXHVGRjYxL2csIC8vIFJGQyAzNDkwIHNlcGFyYXRvcnNcblxuXHQvKiogRXJyb3IgbWVzc2FnZXMgKi9cblx0ZXJyb3JzID0ge1xuXHRcdCdvdmVyZmxvdyc6ICdPdmVyZmxvdzogaW5wdXQgbmVlZHMgd2lkZXIgaW50ZWdlcnMgdG8gcHJvY2VzcycsXG5cdFx0J25vdC1iYXNpYyc6ICdJbGxlZ2FsIGlucHV0ID49IDB4ODAgKG5vdCBhIGJhc2ljIGNvZGUgcG9pbnQpJyxcblx0XHQnaW52YWxpZC1pbnB1dCc6ICdJbnZhbGlkIGlucHV0J1xuXHR9LFxuXG5cdC8qKiBDb252ZW5pZW5jZSBzaG9ydGN1dHMgKi9cblx0YmFzZU1pbnVzVE1pbiA9IGJhc2UgLSB0TWluLFxuXHRmbG9vciA9IE1hdGguZmxvb3IsXG5cdHN0cmluZ0Zyb21DaGFyQ29kZSA9IFN0cmluZy5mcm9tQ2hhckNvZGUsXG5cblx0LyoqIFRlbXBvcmFyeSB2YXJpYWJsZSAqL1xuXHRrZXk7XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBlcnJvciB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdHlwZSBUaGUgZXJyb3IgdHlwZS5cblx0ICogQHJldHVybnMge0Vycm9yfSBUaHJvd3MgYSBgUmFuZ2VFcnJvcmAgd2l0aCB0aGUgYXBwbGljYWJsZSBlcnJvciBtZXNzYWdlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZXJyb3IodHlwZSkge1xuXHRcdHRocm93IFJhbmdlRXJyb3IoZXJyb3JzW3R5cGVdKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIGdlbmVyaWMgYEFycmF5I21hcGAgdXRpbGl0eSBmdW5jdGlvbi5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5IGFycmF5XG5cdCAqIGl0ZW0uXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gQSBuZXcgYXJyYXkgb2YgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcChhcnJheSwgZm4pIHtcblx0XHR2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXHRcdHdoaWxlIChsZW5ndGgtLSkge1xuXHRcdFx0YXJyYXlbbGVuZ3RoXSA9IGZuKGFycmF5W2xlbmd0aF0pO1xuXHRcdH1cblx0XHRyZXR1cm4gYXJyYXk7XG5cdH1cblxuXHQvKipcblx0ICogQSBzaW1wbGUgYEFycmF5I21hcGAtbGlrZSB3cmFwcGVyIHRvIHdvcmsgd2l0aCBkb21haW4gbmFtZSBzdHJpbmdzLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBkb21haW4gbmFtZS5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5XG5cdCAqIGNoYXJhY3Rlci5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBzdHJpbmcgb2YgY2hhcmFjdGVycyByZXR1cm5lZCBieSB0aGUgY2FsbGJhY2tcblx0ICogZnVuY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXBEb21haW4oc3RyaW5nLCBmbikge1xuXHRcdHJldHVybiBtYXAoc3RyaW5nLnNwbGl0KHJlZ2V4U2VwYXJhdG9ycyksIGZuKS5qb2luKCcuJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhbiBhcnJheSBjb250YWluaW5nIHRoZSBudW1lcmljIGNvZGUgcG9pbnRzIG9mIGVhY2ggVW5pY29kZVxuXHQgKiBjaGFyYWN0ZXIgaW4gdGhlIHN0cmluZy4gV2hpbGUgSmF2YVNjcmlwdCB1c2VzIFVDUy0yIGludGVybmFsbHksXG5cdCAqIHRoaXMgZnVuY3Rpb24gd2lsbCBjb252ZXJ0IGEgcGFpciBvZiBzdXJyb2dhdGUgaGFsdmVzIChlYWNoIG9mIHdoaWNoXG5cdCAqIFVDUy0yIGV4cG9zZXMgYXMgc2VwYXJhdGUgY2hhcmFjdGVycykgaW50byBhIHNpbmdsZSBjb2RlIHBvaW50LFxuXHQgKiBtYXRjaGluZyBVVEYtMTYuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZW5jb2RlYFxuXHQgKiBAc2VlIDxodHRwOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBkZWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZyBUaGUgVW5pY29kZSBpbnB1dCBzdHJpbmcgKFVDUy0yKS5cblx0ICogQHJldHVybnMge0FycmF5fSBUaGUgbmV3IGFycmF5IG9mIGNvZGUgcG9pbnRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmRlY29kZShzdHJpbmcpIHtcblx0XHR2YXIgb3V0cHV0ID0gW10sXG5cdFx0ICAgIGNvdW50ZXIgPSAwLFxuXHRcdCAgICBsZW5ndGggPSBzdHJpbmcubGVuZ3RoLFxuXHRcdCAgICB2YWx1ZSxcblx0XHQgICAgZXh0cmE7XG5cdFx0d2hpbGUgKGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdHZhbHVlID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdGlmICh2YWx1ZSA+PSAweEQ4MDAgJiYgdmFsdWUgPD0gMHhEQkZGICYmIGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdFx0Ly8gaGlnaCBzdXJyb2dhdGUsIGFuZCB0aGVyZSBpcyBhIG5leHQgY2hhcmFjdGVyXG5cdFx0XHRcdGV4dHJhID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdFx0aWYgKChleHRyYSAmIDB4RkMwMCkgPT0gMHhEQzAwKSB7IC8vIGxvdyBzdXJyb2dhdGVcblx0XHRcdFx0XHRvdXRwdXQucHVzaCgoKHZhbHVlICYgMHgzRkYpIDw8IDEwKSArIChleHRyYSAmIDB4M0ZGKSArIDB4MTAwMDApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHVubWF0Y2hlZCBzdXJyb2dhdGU7IG9ubHkgYXBwZW5kIHRoaXMgY29kZSB1bml0LCBpbiBjYXNlIHRoZSBuZXh0XG5cdFx0XHRcdFx0Ly8gY29kZSB1bml0IGlzIHRoZSBoaWdoIHN1cnJvZ2F0ZSBvZiBhIHN1cnJvZ2F0ZSBwYWlyXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0XHRcdGNvdW50ZXItLTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBzdHJpbmcgYmFzZWQgb24gYW4gYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5kZWNvZGVgXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGVuY29kZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2RlUG9pbnRzIFRoZSBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgbmV3IFVuaWNvZGUgc3RyaW5nIChVQ1MtMikuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZW5jb2RlKGFycmF5KSB7XG5cdFx0cmV0dXJuIG1hcChhcnJheSwgZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdHZhciBvdXRwdXQgPSAnJztcblx0XHRcdGlmICh2YWx1ZSA+IDB4RkZGRikge1xuXHRcdFx0XHR2YWx1ZSAtPSAweDEwMDAwO1xuXHRcdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKTtcblx0XHRcdFx0dmFsdWUgPSAweERDMDAgfCB2YWx1ZSAmIDB4M0ZGO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSk7XG5cdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgYmFzaWMgY29kZSBwb2ludCBpbnRvIGEgZGlnaXQvaW50ZWdlci5cblx0ICogQHNlZSBgZGlnaXRUb0Jhc2ljKClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb2RlUG9pbnQgVGhlIGJhc2ljIG51bWVyaWMgY29kZSBwb2ludCB2YWx1ZS5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50IChmb3IgdXNlIGluXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaW4gdGhlIHJhbmdlIGAwYCB0byBgYmFzZSAtIDFgLCBvciBgYmFzZWAgaWZcblx0ICogdGhlIGNvZGUgcG9pbnQgZG9lcyBub3QgcmVwcmVzZW50IGEgdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBiYXNpY1RvRGlnaXQoY29kZVBvaW50KSB7XG5cdFx0aWYgKGNvZGVQb2ludCAtIDQ4IDwgMTApIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSAyMjtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDY1IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA2NTtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDk3IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA5Nztcblx0XHR9XG5cdFx0cmV0dXJuIGJhc2U7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBkaWdpdC9pbnRlZ2VyIGludG8gYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAc2VlIGBiYXNpY1RvRGlnaXQoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRpZ2l0IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIGJhc2ljIGNvZGUgcG9pbnQgd2hvc2UgdmFsdWUgKHdoZW4gdXNlZCBmb3Jcblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpcyBgZGlnaXRgLCB3aGljaCBuZWVkcyB0byBiZSBpbiB0aGUgcmFuZ2Vcblx0ICogYDBgIHRvIGBiYXNlIC0gMWAuIElmIGBmbGFnYCBpcyBub24temVybywgdGhlIHVwcGVyY2FzZSBmb3JtIGlzXG5cdCAqIHVzZWQ7IGVsc2UsIHRoZSBsb3dlcmNhc2UgZm9ybSBpcyB1c2VkLiBUaGUgYmVoYXZpb3IgaXMgdW5kZWZpbmVkXG5cdCAqIGlmIGBmbGFnYCBpcyBub24temVybyBhbmQgYGRpZ2l0YCBoYXMgbm8gdXBwZXJjYXNlIGZvcm0uXG5cdCAqL1xuXHRmdW5jdGlvbiBkaWdpdFRvQmFzaWMoZGlnaXQsIGZsYWcpIHtcblx0XHQvLyAgMC4uMjUgbWFwIHRvIEFTQ0lJIGEuLnogb3IgQS4uWlxuXHRcdC8vIDI2Li4zNSBtYXAgdG8gQVNDSUkgMC4uOVxuXHRcdHJldHVybiBkaWdpdCArIDIyICsgNzUgKiAoZGlnaXQgPCAyNikgLSAoKGZsYWcgIT0gMCkgPDwgNSk7XG5cdH1cblxuXHQvKipcblx0ICogQmlhcyBhZGFwdGF0aW9uIGZ1bmN0aW9uIGFzIHBlciBzZWN0aW9uIDMuNCBvZiBSRkMgMzQ5Mi5cblx0ICogaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzQ5MiNzZWN0aW9uLTMuNFxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0ZnVuY3Rpb24gYWRhcHQoZGVsdGEsIG51bVBvaW50cywgZmlyc3RUaW1lKSB7XG5cdFx0dmFyIGsgPSAwO1xuXHRcdGRlbHRhID0gZmlyc3RUaW1lID8gZmxvb3IoZGVsdGEgLyBkYW1wKSA6IGRlbHRhID4+IDE7XG5cdFx0ZGVsdGEgKz0gZmxvb3IoZGVsdGEgLyBudW1Qb2ludHMpO1xuXHRcdGZvciAoLyogbm8gaW5pdGlhbGl6YXRpb24gKi87IGRlbHRhID4gYmFzZU1pbnVzVE1pbiAqIHRNYXggPj4gMTsgayArPSBiYXNlKSB7XG5cdFx0XHRkZWx0YSA9IGZsb29yKGRlbHRhIC8gYmFzZU1pbnVzVE1pbik7XG5cdFx0fVxuXHRcdHJldHVybiBmbG9vcihrICsgKGJhc2VNaW51c1RNaW4gKyAxKSAqIGRlbHRhIC8gKGRlbHRhICsgc2tldykpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scyB0byBhIHN0cmluZyBvZiBVbmljb2RlXG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGRlY29kZShpbnB1dCkge1xuXHRcdC8vIERvbid0IHVzZSBVQ1MtMlxuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgaW5wdXRMZW5ndGggPSBpbnB1dC5sZW5ndGgsXG5cdFx0ICAgIG91dCxcblx0XHQgICAgaSA9IDAsXG5cdFx0ICAgIG4gPSBpbml0aWFsTixcblx0XHQgICAgYmlhcyA9IGluaXRpYWxCaWFzLFxuXHRcdCAgICBiYXNpYyxcblx0XHQgICAgaixcblx0XHQgICAgaW5kZXgsXG5cdFx0ICAgIG9sZGksXG5cdFx0ICAgIHcsXG5cdFx0ICAgIGssXG5cdFx0ICAgIGRpZ2l0LFxuXHRcdCAgICB0LFxuXHRcdCAgICAvKiogQ2FjaGVkIGNhbGN1bGF0aW9uIHJlc3VsdHMgKi9cblx0XHQgICAgYmFzZU1pbnVzVDtcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHM6IGxldCBgYmFzaWNgIGJlIHRoZSBudW1iZXIgb2YgaW5wdXQgY29kZVxuXHRcdC8vIHBvaW50cyBiZWZvcmUgdGhlIGxhc3QgZGVsaW1pdGVyLCBvciBgMGAgaWYgdGhlcmUgaXMgbm9uZSwgdGhlbiBjb3B5XG5cdFx0Ly8gdGhlIGZpcnN0IGJhc2ljIGNvZGUgcG9pbnRzIHRvIHRoZSBvdXRwdXQuXG5cblx0XHRiYXNpYyA9IGlucHV0Lmxhc3RJbmRleE9mKGRlbGltaXRlcik7XG5cdFx0aWYgKGJhc2ljIDwgMCkge1xuXHRcdFx0YmFzaWMgPSAwO1xuXHRcdH1cblxuXHRcdGZvciAoaiA9IDA7IGogPCBiYXNpYzsgKytqKSB7XG5cdFx0XHQvLyBpZiBpdCdzIG5vdCBhIGJhc2ljIGNvZGUgcG9pbnRcblx0XHRcdGlmIChpbnB1dC5jaGFyQ29kZUF0KGopID49IDB4ODApIHtcblx0XHRcdFx0ZXJyb3IoJ25vdC1iYXNpYycpO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0LnB1c2goaW5wdXQuY2hhckNvZGVBdChqKSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBkZWNvZGluZyBsb29wOiBzdGFydCBqdXN0IGFmdGVyIHRoZSBsYXN0IGRlbGltaXRlciBpZiBhbnkgYmFzaWMgY29kZVxuXHRcdC8vIHBvaW50cyB3ZXJlIGNvcGllZDsgc3RhcnQgYXQgdGhlIGJlZ2lubmluZyBvdGhlcndpc2UuXG5cblx0XHRmb3IgKGluZGV4ID0gYmFzaWMgPiAwID8gYmFzaWMgKyAxIDogMDsgaW5kZXggPCBpbnB1dExlbmd0aDsgLyogbm8gZmluYWwgZXhwcmVzc2lvbiAqLykge1xuXG5cdFx0XHQvLyBgaW5kZXhgIGlzIHRoZSBpbmRleCBvZiB0aGUgbmV4dCBjaGFyYWN0ZXIgdG8gYmUgY29uc3VtZWQuXG5cdFx0XHQvLyBEZWNvZGUgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlciBpbnRvIGBkZWx0YWAsXG5cdFx0XHQvLyB3aGljaCBnZXRzIGFkZGVkIHRvIGBpYC4gVGhlIG92ZXJmbG93IGNoZWNraW5nIGlzIGVhc2llclxuXHRcdFx0Ly8gaWYgd2UgaW5jcmVhc2UgYGlgIGFzIHdlIGdvLCB0aGVuIHN1YnRyYWN0IG9mZiBpdHMgc3RhcnRpbmdcblx0XHRcdC8vIHZhbHVlIGF0IHRoZSBlbmQgdG8gb2J0YWluIGBkZWx0YWAuXG5cdFx0XHRmb3IgKG9sZGkgPSBpLCB3ID0gMSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cblx0XHRcdFx0aWYgKGluZGV4ID49IGlucHV0TGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ2ludmFsaWQtaW5wdXQnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRpZ2l0ID0gYmFzaWNUb0RpZ2l0KGlucHV0LmNoYXJDb2RlQXQoaW5kZXgrKykpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA+PSBiYXNlIHx8IGRpZ2l0ID4gZmxvb3IoKG1heEludCAtIGkpIC8gdykpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGkgKz0gZGlnaXQgKiB3O1xuXHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblxuXHRcdFx0XHRpZiAoZGlnaXQgPCB0KSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiYXNlTWludXNUID0gYmFzZSAtIHQ7XG5cdFx0XHRcdGlmICh3ID4gZmxvb3IobWF4SW50IC8gYmFzZU1pbnVzVCkpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHcgKj0gYmFzZU1pbnVzVDtcblxuXHRcdFx0fVxuXG5cdFx0XHRvdXQgPSBvdXRwdXQubGVuZ3RoICsgMTtcblx0XHRcdGJpYXMgPSBhZGFwdChpIC0gb2xkaSwgb3V0LCBvbGRpID09IDApO1xuXG5cdFx0XHQvLyBgaWAgd2FzIHN1cHBvc2VkIHRvIHdyYXAgYXJvdW5kIGZyb20gYG91dGAgdG8gYDBgLFxuXHRcdFx0Ly8gaW5jcmVtZW50aW5nIGBuYCBlYWNoIHRpbWUsIHNvIHdlJ2xsIGZpeCB0aGF0IG5vdzpcblx0XHRcdGlmIChmbG9vcihpIC8gb3V0KSA+IG1heEludCAtIG4pIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdG4gKz0gZmxvb3IoaSAvIG91dCk7XG5cdFx0XHRpICU9IG91dDtcblxuXHRcdFx0Ly8gSW5zZXJ0IGBuYCBhdCBwb3NpdGlvbiBgaWAgb2YgdGhlIG91dHB1dFxuXHRcdFx0b3V0cHV0LnNwbGljZShpKyssIDAsIG4pO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVjczJlbmNvZGUob3V0cHV0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMgdG8gYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seVxuXHQgKiBzeW1ib2xzLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzdWx0aW5nIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBlbmNvZGUoaW5wdXQpIHtcblx0XHR2YXIgbixcblx0XHQgICAgZGVsdGEsXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50LFxuXHRcdCAgICBiYXNpY0xlbmd0aCxcblx0XHQgICAgYmlhcyxcblx0XHQgICAgaixcblx0XHQgICAgbSxcblx0XHQgICAgcSxcblx0XHQgICAgayxcblx0XHQgICAgdCxcblx0XHQgICAgY3VycmVudFZhbHVlLFxuXHRcdCAgICBvdXRwdXQgPSBbXSxcblx0XHQgICAgLyoqIGBpbnB1dExlbmd0aGAgd2lsbCBob2xkIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgaW4gYGlucHV0YC4gKi9cblx0XHQgICAgaW5wdXRMZW5ndGgsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsXG5cdFx0ICAgIGJhc2VNaW51c1QsXG5cdFx0ICAgIHFNaW51c1Q7XG5cblx0XHQvLyBDb252ZXJ0IHRoZSBpbnB1dCBpbiBVQ1MtMiB0byBVbmljb2RlXG5cdFx0aW5wdXQgPSB1Y3MyZGVjb2RlKGlucHV0KTtcblxuXHRcdC8vIENhY2hlIHRoZSBsZW5ndGhcblx0XHRpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aDtcblxuXHRcdC8vIEluaXRpYWxpemUgdGhlIHN0YXRlXG5cdFx0biA9IGluaXRpYWxOO1xuXHRcdGRlbHRhID0gMDtcblx0XHRiaWFzID0gaW5pdGlhbEJpYXM7XG5cblx0XHQvLyBIYW5kbGUgdGhlIGJhc2ljIGNvZGUgcG9pbnRzXG5cdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IDB4ODApIHtcblx0XHRcdFx0b3V0cHV0LnB1c2goc3RyaW5nRnJvbUNoYXJDb2RlKGN1cnJlbnRWYWx1ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGhhbmRsZWRDUENvdW50ID0gYmFzaWNMZW5ndGggPSBvdXRwdXQubGVuZ3RoO1xuXG5cdFx0Ly8gYGhhbmRsZWRDUENvdW50YCBpcyB0aGUgbnVtYmVyIG9mIGNvZGUgcG9pbnRzIHRoYXQgaGF2ZSBiZWVuIGhhbmRsZWQ7XG5cdFx0Ly8gYGJhc2ljTGVuZ3RoYCBpcyB0aGUgbnVtYmVyIG9mIGJhc2ljIGNvZGUgcG9pbnRzLlxuXG5cdFx0Ly8gRmluaXNoIHRoZSBiYXNpYyBzdHJpbmcgLSBpZiBpdCBpcyBub3QgZW1wdHkgLSB3aXRoIGEgZGVsaW1pdGVyXG5cdFx0aWYgKGJhc2ljTGVuZ3RoKSB7XG5cdFx0XHRvdXRwdXQucHVzaChkZWxpbWl0ZXIpO1xuXHRcdH1cblxuXHRcdC8vIE1haW4gZW5jb2RpbmcgbG9vcDpcblx0XHR3aGlsZSAoaGFuZGxlZENQQ291bnQgPCBpbnB1dExlbmd0aCkge1xuXG5cdFx0XHQvLyBBbGwgbm9uLWJhc2ljIGNvZGUgcG9pbnRzIDwgbiBoYXZlIGJlZW4gaGFuZGxlZCBhbHJlYWR5LiBGaW5kIHRoZSBuZXh0XG5cdFx0XHQvLyBsYXJnZXIgb25lOlxuXHRcdFx0Zm9yIChtID0gbWF4SW50LCBqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPj0gbiAmJiBjdXJyZW50VmFsdWUgPCBtKSB7XG5cdFx0XHRcdFx0bSA9IGN1cnJlbnRWYWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbmNyZWFzZSBgZGVsdGFgIGVub3VnaCB0byBhZHZhbmNlIHRoZSBkZWNvZGVyJ3MgPG4saT4gc3RhdGUgdG8gPG0sMD4sXG5cdFx0XHQvLyBidXQgZ3VhcmQgYWdhaW5zdCBvdmVyZmxvd1xuXHRcdFx0aGFuZGxlZENQQ291bnRQbHVzT25lID0gaGFuZGxlZENQQ291bnQgKyAxO1xuXHRcdFx0aWYgKG0gLSBuID4gZmxvb3IoKG1heEludCAtIGRlbHRhKSAvIGhhbmRsZWRDUENvdW50UGx1c09uZSkpIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGRlbHRhICs9IChtIC0gbikgKiBoYW5kbGVkQ1BDb3VudFBsdXNPbmU7XG5cdFx0XHRuID0gbTtcblxuXHRcdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IG4gJiYgKytkZWx0YSA+IG1heEludCkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA9PSBuKSB7XG5cdFx0XHRcdFx0Ly8gUmVwcmVzZW50IGRlbHRhIGFzIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXJcblx0XHRcdFx0XHRmb3IgKHEgPSBkZWx0YSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cdFx0XHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblx0XHRcdFx0XHRcdGlmIChxIDwgdCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHFNaW51c1QgPSBxIC0gdDtcblx0XHRcdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKFxuXHRcdFx0XHRcdFx0XHRzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHQgKyBxTWludXNUICUgYmFzZU1pbnVzVCwgMCkpXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0cSA9IGZsb29yKHFNaW51c1QgLyBiYXNlTWludXNUKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHEsIDApKSk7XG5cdFx0XHRcdFx0YmlhcyA9IGFkYXB0KGRlbHRhLCBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsIGhhbmRsZWRDUENvdW50ID09IGJhc2ljTGVuZ3RoKTtcblx0XHRcdFx0XHRkZWx0YSA9IDA7XG5cdFx0XHRcdFx0KytoYW5kbGVkQ1BDb3VudDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQrK2RlbHRhO1xuXHRcdFx0KytuO1xuXG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgdG8gVW5pY29kZS4gT25seSB0aGVcblx0ICogUHVueWNvZGVkIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB3aWxsIGJlIGNvbnZlcnRlZCwgaS5lLiBpdCBkb2Vzbid0XG5cdCAqIG1hdHRlciBpZiB5b3UgY2FsbCBpdCBvbiBhIHN0cmluZyB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gY29udmVydGVkIHRvXG5cdCAqIFVuaWNvZGUuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBQdW55Y29kZSBkb21haW4gbmFtZSB0byBjb252ZXJ0IHRvIFVuaWNvZGUuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBVbmljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBQdW55Y29kZVxuXHQgKiBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b1VuaWNvZGUoZG9tYWluKSB7XG5cdFx0cmV0dXJuIG1hcERvbWFpbihkb21haW4sIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHJlZ2V4UHVueWNvZGUudGVzdChzdHJpbmcpXG5cdFx0XHRcdD8gZGVjb2RlKHN0cmluZy5zbGljZSg0KS50b0xvd2VyQ2FzZSgpKVxuXHRcdFx0XHQ6IHN0cmluZztcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFVuaWNvZGUgc3RyaW5nIHJlcHJlc2VudGluZyBhIGRvbWFpbiBuYW1lIHRvIFB1bnljb2RlLiBPbmx5IHRoZVxuXHQgKiBub24tQVNDSUkgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLCBpLmUuIGl0IGRvZXNuJ3Rcblx0ICogbWF0dGVyIGlmIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCdzIGFscmVhZHkgaW4gQVNDSUkuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBkb21haW4gbmFtZSB0byBjb252ZXJ0LCBhcyBhIFVuaWNvZGUgc3RyaW5nLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgUHVueWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIGRvbWFpbiBuYW1lLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9BU0NJSShkb21haW4pIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGRvbWFpbiwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhOb25BU0NJSS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyAneG4tLScgKyBlbmNvZGUoc3RyaW5nKVxuXHRcdFx0XHQ6IHN0cmluZztcblx0XHR9KTtcblx0fVxuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdC8qKiBEZWZpbmUgdGhlIHB1YmxpYyBBUEkgKi9cblx0cHVueWNvZGUgPSB7XG5cdFx0LyoqXG5cdFx0ICogQSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBjdXJyZW50IFB1bnljb2RlLmpzIHZlcnNpb24gbnVtYmVyLlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIFN0cmluZ1xuXHRcdCAqL1xuXHRcdCd2ZXJzaW9uJzogJzEuMi40Jyxcblx0XHQvKipcblx0XHQgKiBBbiBvYmplY3Qgb2YgbWV0aG9kcyB0byBjb252ZXJ0IGZyb20gSmF2YVNjcmlwdCdzIGludGVybmFsIGNoYXJhY3RlclxuXHRcdCAqIHJlcHJlc2VudGF0aW9uIChVQ1MtMikgdG8gVW5pY29kZSBjb2RlIHBvaW50cywgYW5kIGJhY2suXG5cdFx0ICogQHNlZSA8aHR0cDovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBPYmplY3Rcblx0XHQgKi9cblx0XHQndWNzMic6IHtcblx0XHRcdCdkZWNvZGUnOiB1Y3MyZGVjb2RlLFxuXHRcdFx0J2VuY29kZSc6IHVjczJlbmNvZGVcblx0XHR9LFxuXHRcdCdkZWNvZGUnOiBkZWNvZGUsXG5cdFx0J2VuY29kZSc6IGVuY29kZSxcblx0XHQndG9BU0NJSSc6IHRvQVNDSUksXG5cdFx0J3RvVW5pY29kZSc6IHRvVW5pY29kZVxuXHR9O1xuXG5cdC8qKiBFeHBvc2UgYHB1bnljb2RlYCAqL1xuXHQvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzLCBsaWtlIHIuanMsIGNoZWNrIGZvciBzcGVjaWZpYyBjb25kaXRpb24gcGF0dGVybnNcblx0Ly8gbGlrZSB0aGUgZm9sbG93aW5nOlxuXHRpZiAoXG5cdFx0dHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmXG5cdFx0dHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiZcblx0XHRkZWZpbmUuYW1kXG5cdCkge1xuXHRcdGRlZmluZSgncHVueWNvZGUnLCBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBwdW55Y29kZTtcblx0XHR9KTtcblx0fSBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiAhZnJlZUV4cG9ydHMubm9kZVR5cGUpIHtcblx0XHRpZiAoZnJlZU1vZHVsZSkgeyAvLyBpbiBOb2RlLmpzIG9yIFJpbmdvSlMgdjAuOC4wK1xuXHRcdFx0ZnJlZU1vZHVsZS5leHBvcnRzID0gcHVueWNvZGU7XG5cdFx0fSBlbHNlIHsgLy8gaW4gTmFyd2hhbCBvciBSaW5nb0pTIHYwLjcuMC1cblx0XHRcdGZvciAoa2V5IGluIHB1bnljb2RlKSB7XG5cdFx0XHRcdHB1bnljb2RlLmhhc093blByb3BlcnR5KGtleSkgJiYgKGZyZWVFeHBvcnRzW2tleV0gPSBwdW55Y29kZVtrZXldKTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7IC8vIGluIFJoaW5vIG9yIGEgd2ViIGJyb3dzZXJcblx0XHRyb290LnB1bnljb2RlID0gcHVueWNvZGU7XG5cdH1cblxufSh0aGlzKSk7XG4iLCJ2YXIgcHVueWNvZGUgPSByZXF1aXJlKCdwdW55Y29kZScpO1xudmFyIHJldkVudGl0aWVzID0gcmVxdWlyZSgnLi9yZXZlcnNlZC5qc29uJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZW5jb2RlO1xuXG5mdW5jdGlvbiBlbmNvZGUgKHN0ciwgb3B0cykge1xuICAgIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBhIFN0cmluZycpO1xuICAgIH1cbiAgICBpZiAoIW9wdHMpIG9wdHMgPSB7fTtcblxuICAgIHZhciBudW1lcmljID0gdHJ1ZTtcbiAgICBpZiAob3B0cy5uYW1lZCkgbnVtZXJpYyA9IGZhbHNlO1xuICAgIGlmIChvcHRzLm51bWVyaWMgIT09IHVuZGVmaW5lZCkgbnVtZXJpYyA9IG9wdHMubnVtZXJpYztcblxuICAgIHZhciBzcGVjaWFsID0gb3B0cy5zcGVjaWFsIHx8IHtcbiAgICAgICAgJ1wiJzogdHJ1ZSwgXCInXCI6IHRydWUsXG4gICAgICAgICc8JzogdHJ1ZSwgJz4nOiB0cnVlLFxuICAgICAgICAnJic6IHRydWVcbiAgICB9O1xuXG4gICAgdmFyIGNvZGVQb2ludHMgPSBwdW55Y29kZS51Y3MyLmRlY29kZShzdHIpO1xuICAgIHZhciBjaGFycyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29kZVBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2MgPSBjb2RlUG9pbnRzW2ldO1xuICAgICAgICB2YXIgYyA9IHB1bnljb2RlLnVjczIuZW5jb2RlKFsgY2MgXSk7XG4gICAgICAgIHZhciBlID0gcmV2RW50aXRpZXNbY2NdO1xuICAgICAgICBpZiAoZSAmJiAoY2MgPj0gMTI3IHx8IHNwZWNpYWxbY10pICYmICFudW1lcmljKSB7XG4gICAgICAgICAgICBjaGFycy5wdXNoKCcmJyArICgvOyQvLnRlc3QoZSkgPyBlIDogZSArICc7JykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGNjIDwgMzIgfHwgY2MgPj0gMTI3IHx8IHNwZWNpYWxbY10pIHtcbiAgICAgICAgICAgIGNoYXJzLnB1c2goJyYjJyArIGNjICsgJzsnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNoYXJzLnB1c2goYyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNoYXJzLmpvaW4oJycpO1xufVxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICAgIFwiOVwiOiBcIlRhYjtcIixcbiAgICBcIjEwXCI6IFwiTmV3TGluZTtcIixcbiAgICBcIjMzXCI6IFwiZXhjbDtcIixcbiAgICBcIjM0XCI6IFwicXVvdDtcIixcbiAgICBcIjM1XCI6IFwibnVtO1wiLFxuICAgIFwiMzZcIjogXCJkb2xsYXI7XCIsXG4gICAgXCIzN1wiOiBcInBlcmNudDtcIixcbiAgICBcIjM4XCI6IFwiYW1wO1wiLFxuICAgIFwiMzlcIjogXCJhcG9zO1wiLFxuICAgIFwiNDBcIjogXCJscGFyO1wiLFxuICAgIFwiNDFcIjogXCJycGFyO1wiLFxuICAgIFwiNDJcIjogXCJtaWRhc3Q7XCIsXG4gICAgXCI0M1wiOiBcInBsdXM7XCIsXG4gICAgXCI0NFwiOiBcImNvbW1hO1wiLFxuICAgIFwiNDZcIjogXCJwZXJpb2Q7XCIsXG4gICAgXCI0N1wiOiBcInNvbDtcIixcbiAgICBcIjU4XCI6IFwiY29sb247XCIsXG4gICAgXCI1OVwiOiBcInNlbWk7XCIsXG4gICAgXCI2MFwiOiBcImx0O1wiLFxuICAgIFwiNjFcIjogXCJlcXVhbHM7XCIsXG4gICAgXCI2MlwiOiBcImd0O1wiLFxuICAgIFwiNjNcIjogXCJxdWVzdDtcIixcbiAgICBcIjY0XCI6IFwiY29tbWF0O1wiLFxuICAgIFwiOTFcIjogXCJsc3FiO1wiLFxuICAgIFwiOTJcIjogXCJic29sO1wiLFxuICAgIFwiOTNcIjogXCJyc3FiO1wiLFxuICAgIFwiOTRcIjogXCJIYXQ7XCIsXG4gICAgXCI5NVwiOiBcIlVuZGVyQmFyO1wiLFxuICAgIFwiOTZcIjogXCJncmF2ZTtcIixcbiAgICBcIjEyM1wiOiBcImxjdWI7XCIsXG4gICAgXCIxMjRcIjogXCJWZXJ0aWNhbExpbmU7XCIsXG4gICAgXCIxMjVcIjogXCJyY3ViO1wiLFxuICAgIFwiMTYwXCI6IFwiTm9uQnJlYWtpbmdTcGFjZTtcIixcbiAgICBcIjE2MVwiOiBcImlleGNsO1wiLFxuICAgIFwiMTYyXCI6IFwiY2VudDtcIixcbiAgICBcIjE2M1wiOiBcInBvdW5kO1wiLFxuICAgIFwiMTY0XCI6IFwiY3VycmVuO1wiLFxuICAgIFwiMTY1XCI6IFwieWVuO1wiLFxuICAgIFwiMTY2XCI6IFwiYnJ2YmFyO1wiLFxuICAgIFwiMTY3XCI6IFwic2VjdDtcIixcbiAgICBcIjE2OFwiOiBcInVtbDtcIixcbiAgICBcIjE2OVwiOiBcImNvcHk7XCIsXG4gICAgXCIxNzBcIjogXCJvcmRmO1wiLFxuICAgIFwiMTcxXCI6IFwibGFxdW87XCIsXG4gICAgXCIxNzJcIjogXCJub3Q7XCIsXG4gICAgXCIxNzNcIjogXCJzaHk7XCIsXG4gICAgXCIxNzRcIjogXCJyZWc7XCIsXG4gICAgXCIxNzVcIjogXCJzdHJucztcIixcbiAgICBcIjE3NlwiOiBcImRlZztcIixcbiAgICBcIjE3N1wiOiBcInBtO1wiLFxuICAgIFwiMTc4XCI6IFwic3VwMjtcIixcbiAgICBcIjE3OVwiOiBcInN1cDM7XCIsXG4gICAgXCIxODBcIjogXCJEaWFjcml0aWNhbEFjdXRlO1wiLFxuICAgIFwiMTgxXCI6IFwibWljcm87XCIsXG4gICAgXCIxODJcIjogXCJwYXJhO1wiLFxuICAgIFwiMTgzXCI6IFwibWlkZG90O1wiLFxuICAgIFwiMTg0XCI6IFwiQ2VkaWxsYTtcIixcbiAgICBcIjE4NVwiOiBcInN1cDE7XCIsXG4gICAgXCIxODZcIjogXCJvcmRtO1wiLFxuICAgIFwiMTg3XCI6IFwicmFxdW87XCIsXG4gICAgXCIxODhcIjogXCJmcmFjMTQ7XCIsXG4gICAgXCIxODlcIjogXCJoYWxmO1wiLFxuICAgIFwiMTkwXCI6IFwiZnJhYzM0O1wiLFxuICAgIFwiMTkxXCI6IFwiaXF1ZXN0O1wiLFxuICAgIFwiMTkyXCI6IFwiQWdyYXZlO1wiLFxuICAgIFwiMTkzXCI6IFwiQWFjdXRlO1wiLFxuICAgIFwiMTk0XCI6IFwiQWNpcmM7XCIsXG4gICAgXCIxOTVcIjogXCJBdGlsZGU7XCIsXG4gICAgXCIxOTZcIjogXCJBdW1sO1wiLFxuICAgIFwiMTk3XCI6IFwiQXJpbmc7XCIsXG4gICAgXCIxOThcIjogXCJBRWxpZztcIixcbiAgICBcIjE5OVwiOiBcIkNjZWRpbDtcIixcbiAgICBcIjIwMFwiOiBcIkVncmF2ZTtcIixcbiAgICBcIjIwMVwiOiBcIkVhY3V0ZTtcIixcbiAgICBcIjIwMlwiOiBcIkVjaXJjO1wiLFxuICAgIFwiMjAzXCI6IFwiRXVtbDtcIixcbiAgICBcIjIwNFwiOiBcIklncmF2ZTtcIixcbiAgICBcIjIwNVwiOiBcIklhY3V0ZTtcIixcbiAgICBcIjIwNlwiOiBcIkljaXJjO1wiLFxuICAgIFwiMjA3XCI6IFwiSXVtbDtcIixcbiAgICBcIjIwOFwiOiBcIkVUSDtcIixcbiAgICBcIjIwOVwiOiBcIk50aWxkZTtcIixcbiAgICBcIjIxMFwiOiBcIk9ncmF2ZTtcIixcbiAgICBcIjIxMVwiOiBcIk9hY3V0ZTtcIixcbiAgICBcIjIxMlwiOiBcIk9jaXJjO1wiLFxuICAgIFwiMjEzXCI6IFwiT3RpbGRlO1wiLFxuICAgIFwiMjE0XCI6IFwiT3VtbDtcIixcbiAgICBcIjIxNVwiOiBcInRpbWVzO1wiLFxuICAgIFwiMjE2XCI6IFwiT3NsYXNoO1wiLFxuICAgIFwiMjE3XCI6IFwiVWdyYXZlO1wiLFxuICAgIFwiMjE4XCI6IFwiVWFjdXRlO1wiLFxuICAgIFwiMjE5XCI6IFwiVWNpcmM7XCIsXG4gICAgXCIyMjBcIjogXCJVdW1sO1wiLFxuICAgIFwiMjIxXCI6IFwiWWFjdXRlO1wiLFxuICAgIFwiMjIyXCI6IFwiVEhPUk47XCIsXG4gICAgXCIyMjNcIjogXCJzemxpZztcIixcbiAgICBcIjIyNFwiOiBcImFncmF2ZTtcIixcbiAgICBcIjIyNVwiOiBcImFhY3V0ZTtcIixcbiAgICBcIjIyNlwiOiBcImFjaXJjO1wiLFxuICAgIFwiMjI3XCI6IFwiYXRpbGRlO1wiLFxuICAgIFwiMjI4XCI6IFwiYXVtbDtcIixcbiAgICBcIjIyOVwiOiBcImFyaW5nO1wiLFxuICAgIFwiMjMwXCI6IFwiYWVsaWc7XCIsXG4gICAgXCIyMzFcIjogXCJjY2VkaWw7XCIsXG4gICAgXCIyMzJcIjogXCJlZ3JhdmU7XCIsXG4gICAgXCIyMzNcIjogXCJlYWN1dGU7XCIsXG4gICAgXCIyMzRcIjogXCJlY2lyYztcIixcbiAgICBcIjIzNVwiOiBcImV1bWw7XCIsXG4gICAgXCIyMzZcIjogXCJpZ3JhdmU7XCIsXG4gICAgXCIyMzdcIjogXCJpYWN1dGU7XCIsXG4gICAgXCIyMzhcIjogXCJpY2lyYztcIixcbiAgICBcIjIzOVwiOiBcIml1bWw7XCIsXG4gICAgXCIyNDBcIjogXCJldGg7XCIsXG4gICAgXCIyNDFcIjogXCJudGlsZGU7XCIsXG4gICAgXCIyNDJcIjogXCJvZ3JhdmU7XCIsXG4gICAgXCIyNDNcIjogXCJvYWN1dGU7XCIsXG4gICAgXCIyNDRcIjogXCJvY2lyYztcIixcbiAgICBcIjI0NVwiOiBcIm90aWxkZTtcIixcbiAgICBcIjI0NlwiOiBcIm91bWw7XCIsXG4gICAgXCIyNDdcIjogXCJkaXZpZGU7XCIsXG4gICAgXCIyNDhcIjogXCJvc2xhc2g7XCIsXG4gICAgXCIyNDlcIjogXCJ1Z3JhdmU7XCIsXG4gICAgXCIyNTBcIjogXCJ1YWN1dGU7XCIsXG4gICAgXCIyNTFcIjogXCJ1Y2lyYztcIixcbiAgICBcIjI1MlwiOiBcInV1bWw7XCIsXG4gICAgXCIyNTNcIjogXCJ5YWN1dGU7XCIsXG4gICAgXCIyNTRcIjogXCJ0aG9ybjtcIixcbiAgICBcIjI1NVwiOiBcInl1bWw7XCIsXG4gICAgXCIyNTZcIjogXCJBbWFjcjtcIixcbiAgICBcIjI1N1wiOiBcImFtYWNyO1wiLFxuICAgIFwiMjU4XCI6IFwiQWJyZXZlO1wiLFxuICAgIFwiMjU5XCI6IFwiYWJyZXZlO1wiLFxuICAgIFwiMjYwXCI6IFwiQW9nb247XCIsXG4gICAgXCIyNjFcIjogXCJhb2dvbjtcIixcbiAgICBcIjI2MlwiOiBcIkNhY3V0ZTtcIixcbiAgICBcIjI2M1wiOiBcImNhY3V0ZTtcIixcbiAgICBcIjI2NFwiOiBcIkNjaXJjO1wiLFxuICAgIFwiMjY1XCI6IFwiY2NpcmM7XCIsXG4gICAgXCIyNjZcIjogXCJDZG90O1wiLFxuICAgIFwiMjY3XCI6IFwiY2RvdDtcIixcbiAgICBcIjI2OFwiOiBcIkNjYXJvbjtcIixcbiAgICBcIjI2OVwiOiBcImNjYXJvbjtcIixcbiAgICBcIjI3MFwiOiBcIkRjYXJvbjtcIixcbiAgICBcIjI3MVwiOiBcImRjYXJvbjtcIixcbiAgICBcIjI3MlwiOiBcIkRzdHJvaztcIixcbiAgICBcIjI3M1wiOiBcImRzdHJvaztcIixcbiAgICBcIjI3NFwiOiBcIkVtYWNyO1wiLFxuICAgIFwiMjc1XCI6IFwiZW1hY3I7XCIsXG4gICAgXCIyNzhcIjogXCJFZG90O1wiLFxuICAgIFwiMjc5XCI6IFwiZWRvdDtcIixcbiAgICBcIjI4MFwiOiBcIkVvZ29uO1wiLFxuICAgIFwiMjgxXCI6IFwiZW9nb247XCIsXG4gICAgXCIyODJcIjogXCJFY2Fyb247XCIsXG4gICAgXCIyODNcIjogXCJlY2Fyb247XCIsXG4gICAgXCIyODRcIjogXCJHY2lyYztcIixcbiAgICBcIjI4NVwiOiBcImdjaXJjO1wiLFxuICAgIFwiMjg2XCI6IFwiR2JyZXZlO1wiLFxuICAgIFwiMjg3XCI6IFwiZ2JyZXZlO1wiLFxuICAgIFwiMjg4XCI6IFwiR2RvdDtcIixcbiAgICBcIjI4OVwiOiBcImdkb3Q7XCIsXG4gICAgXCIyOTBcIjogXCJHY2VkaWw7XCIsXG4gICAgXCIyOTJcIjogXCJIY2lyYztcIixcbiAgICBcIjI5M1wiOiBcImhjaXJjO1wiLFxuICAgIFwiMjk0XCI6IFwiSHN0cm9rO1wiLFxuICAgIFwiMjk1XCI6IFwiaHN0cm9rO1wiLFxuICAgIFwiMjk2XCI6IFwiSXRpbGRlO1wiLFxuICAgIFwiMjk3XCI6IFwiaXRpbGRlO1wiLFxuICAgIFwiMjk4XCI6IFwiSW1hY3I7XCIsXG4gICAgXCIyOTlcIjogXCJpbWFjcjtcIixcbiAgICBcIjMwMlwiOiBcIklvZ29uO1wiLFxuICAgIFwiMzAzXCI6IFwiaW9nb247XCIsXG4gICAgXCIzMDRcIjogXCJJZG90O1wiLFxuICAgIFwiMzA1XCI6IFwiaW5vZG90O1wiLFxuICAgIFwiMzA2XCI6IFwiSUpsaWc7XCIsXG4gICAgXCIzMDdcIjogXCJpamxpZztcIixcbiAgICBcIjMwOFwiOiBcIkpjaXJjO1wiLFxuICAgIFwiMzA5XCI6IFwiamNpcmM7XCIsXG4gICAgXCIzMTBcIjogXCJLY2VkaWw7XCIsXG4gICAgXCIzMTFcIjogXCJrY2VkaWw7XCIsXG4gICAgXCIzMTJcIjogXCJrZ3JlZW47XCIsXG4gICAgXCIzMTNcIjogXCJMYWN1dGU7XCIsXG4gICAgXCIzMTRcIjogXCJsYWN1dGU7XCIsXG4gICAgXCIzMTVcIjogXCJMY2VkaWw7XCIsXG4gICAgXCIzMTZcIjogXCJsY2VkaWw7XCIsXG4gICAgXCIzMTdcIjogXCJMY2Fyb247XCIsXG4gICAgXCIzMThcIjogXCJsY2Fyb247XCIsXG4gICAgXCIzMTlcIjogXCJMbWlkb3Q7XCIsXG4gICAgXCIzMjBcIjogXCJsbWlkb3Q7XCIsXG4gICAgXCIzMjFcIjogXCJMc3Ryb2s7XCIsXG4gICAgXCIzMjJcIjogXCJsc3Ryb2s7XCIsXG4gICAgXCIzMjNcIjogXCJOYWN1dGU7XCIsXG4gICAgXCIzMjRcIjogXCJuYWN1dGU7XCIsXG4gICAgXCIzMjVcIjogXCJOY2VkaWw7XCIsXG4gICAgXCIzMjZcIjogXCJuY2VkaWw7XCIsXG4gICAgXCIzMjdcIjogXCJOY2Fyb247XCIsXG4gICAgXCIzMjhcIjogXCJuY2Fyb247XCIsXG4gICAgXCIzMjlcIjogXCJuYXBvcztcIixcbiAgICBcIjMzMFwiOiBcIkVORztcIixcbiAgICBcIjMzMVwiOiBcImVuZztcIixcbiAgICBcIjMzMlwiOiBcIk9tYWNyO1wiLFxuICAgIFwiMzMzXCI6IFwib21hY3I7XCIsXG4gICAgXCIzMzZcIjogXCJPZGJsYWM7XCIsXG4gICAgXCIzMzdcIjogXCJvZGJsYWM7XCIsXG4gICAgXCIzMzhcIjogXCJPRWxpZztcIixcbiAgICBcIjMzOVwiOiBcIm9lbGlnO1wiLFxuICAgIFwiMzQwXCI6IFwiUmFjdXRlO1wiLFxuICAgIFwiMzQxXCI6IFwicmFjdXRlO1wiLFxuICAgIFwiMzQyXCI6IFwiUmNlZGlsO1wiLFxuICAgIFwiMzQzXCI6IFwicmNlZGlsO1wiLFxuICAgIFwiMzQ0XCI6IFwiUmNhcm9uO1wiLFxuICAgIFwiMzQ1XCI6IFwicmNhcm9uO1wiLFxuICAgIFwiMzQ2XCI6IFwiU2FjdXRlO1wiLFxuICAgIFwiMzQ3XCI6IFwic2FjdXRlO1wiLFxuICAgIFwiMzQ4XCI6IFwiU2NpcmM7XCIsXG4gICAgXCIzNDlcIjogXCJzY2lyYztcIixcbiAgICBcIjM1MFwiOiBcIlNjZWRpbDtcIixcbiAgICBcIjM1MVwiOiBcInNjZWRpbDtcIixcbiAgICBcIjM1MlwiOiBcIlNjYXJvbjtcIixcbiAgICBcIjM1M1wiOiBcInNjYXJvbjtcIixcbiAgICBcIjM1NFwiOiBcIlRjZWRpbDtcIixcbiAgICBcIjM1NVwiOiBcInRjZWRpbDtcIixcbiAgICBcIjM1NlwiOiBcIlRjYXJvbjtcIixcbiAgICBcIjM1N1wiOiBcInRjYXJvbjtcIixcbiAgICBcIjM1OFwiOiBcIlRzdHJvaztcIixcbiAgICBcIjM1OVwiOiBcInRzdHJvaztcIixcbiAgICBcIjM2MFwiOiBcIlV0aWxkZTtcIixcbiAgICBcIjM2MVwiOiBcInV0aWxkZTtcIixcbiAgICBcIjM2MlwiOiBcIlVtYWNyO1wiLFxuICAgIFwiMzYzXCI6IFwidW1hY3I7XCIsXG4gICAgXCIzNjRcIjogXCJVYnJldmU7XCIsXG4gICAgXCIzNjVcIjogXCJ1YnJldmU7XCIsXG4gICAgXCIzNjZcIjogXCJVcmluZztcIixcbiAgICBcIjM2N1wiOiBcInVyaW5nO1wiLFxuICAgIFwiMzY4XCI6IFwiVWRibGFjO1wiLFxuICAgIFwiMzY5XCI6IFwidWRibGFjO1wiLFxuICAgIFwiMzcwXCI6IFwiVW9nb247XCIsXG4gICAgXCIzNzFcIjogXCJ1b2dvbjtcIixcbiAgICBcIjM3MlwiOiBcIldjaXJjO1wiLFxuICAgIFwiMzczXCI6IFwid2NpcmM7XCIsXG4gICAgXCIzNzRcIjogXCJZY2lyYztcIixcbiAgICBcIjM3NVwiOiBcInljaXJjO1wiLFxuICAgIFwiMzc2XCI6IFwiWXVtbDtcIixcbiAgICBcIjM3N1wiOiBcIlphY3V0ZTtcIixcbiAgICBcIjM3OFwiOiBcInphY3V0ZTtcIixcbiAgICBcIjM3OVwiOiBcIlpkb3Q7XCIsXG4gICAgXCIzODBcIjogXCJ6ZG90O1wiLFxuICAgIFwiMzgxXCI6IFwiWmNhcm9uO1wiLFxuICAgIFwiMzgyXCI6IFwiemNhcm9uO1wiLFxuICAgIFwiNDAyXCI6IFwiZm5vZjtcIixcbiAgICBcIjQzN1wiOiBcImltcGVkO1wiLFxuICAgIFwiNTAxXCI6IFwiZ2FjdXRlO1wiLFxuICAgIFwiNTY3XCI6IFwiam1hdGg7XCIsXG4gICAgXCI3MTBcIjogXCJjaXJjO1wiLFxuICAgIFwiNzExXCI6IFwiSGFjZWs7XCIsXG4gICAgXCI3MjhcIjogXCJicmV2ZTtcIixcbiAgICBcIjcyOVwiOiBcImRvdDtcIixcbiAgICBcIjczMFwiOiBcInJpbmc7XCIsXG4gICAgXCI3MzFcIjogXCJvZ29uO1wiLFxuICAgIFwiNzMyXCI6IFwidGlsZGU7XCIsXG4gICAgXCI3MzNcIjogXCJEaWFjcml0aWNhbERvdWJsZUFjdXRlO1wiLFxuICAgIFwiNzg1XCI6IFwiRG93bkJyZXZlO1wiLFxuICAgIFwiOTEzXCI6IFwiQWxwaGE7XCIsXG4gICAgXCI5MTRcIjogXCJCZXRhO1wiLFxuICAgIFwiOTE1XCI6IFwiR2FtbWE7XCIsXG4gICAgXCI5MTZcIjogXCJEZWx0YTtcIixcbiAgICBcIjkxN1wiOiBcIkVwc2lsb247XCIsXG4gICAgXCI5MThcIjogXCJaZXRhO1wiLFxuICAgIFwiOTE5XCI6IFwiRXRhO1wiLFxuICAgIFwiOTIwXCI6IFwiVGhldGE7XCIsXG4gICAgXCI5MjFcIjogXCJJb3RhO1wiLFxuICAgIFwiOTIyXCI6IFwiS2FwcGE7XCIsXG4gICAgXCI5MjNcIjogXCJMYW1iZGE7XCIsXG4gICAgXCI5MjRcIjogXCJNdTtcIixcbiAgICBcIjkyNVwiOiBcIk51O1wiLFxuICAgIFwiOTI2XCI6IFwiWGk7XCIsXG4gICAgXCI5MjdcIjogXCJPbWljcm9uO1wiLFxuICAgIFwiOTI4XCI6IFwiUGk7XCIsXG4gICAgXCI5MjlcIjogXCJSaG87XCIsXG4gICAgXCI5MzFcIjogXCJTaWdtYTtcIixcbiAgICBcIjkzMlwiOiBcIlRhdTtcIixcbiAgICBcIjkzM1wiOiBcIlVwc2lsb247XCIsXG4gICAgXCI5MzRcIjogXCJQaGk7XCIsXG4gICAgXCI5MzVcIjogXCJDaGk7XCIsXG4gICAgXCI5MzZcIjogXCJQc2k7XCIsXG4gICAgXCI5MzdcIjogXCJPbWVnYTtcIixcbiAgICBcIjk0NVwiOiBcImFscGhhO1wiLFxuICAgIFwiOTQ2XCI6IFwiYmV0YTtcIixcbiAgICBcIjk0N1wiOiBcImdhbW1hO1wiLFxuICAgIFwiOTQ4XCI6IFwiZGVsdGE7XCIsXG4gICAgXCI5NDlcIjogXCJlcHNpbG9uO1wiLFxuICAgIFwiOTUwXCI6IFwiemV0YTtcIixcbiAgICBcIjk1MVwiOiBcImV0YTtcIixcbiAgICBcIjk1MlwiOiBcInRoZXRhO1wiLFxuICAgIFwiOTUzXCI6IFwiaW90YTtcIixcbiAgICBcIjk1NFwiOiBcImthcHBhO1wiLFxuICAgIFwiOTU1XCI6IFwibGFtYmRhO1wiLFxuICAgIFwiOTU2XCI6IFwibXU7XCIsXG4gICAgXCI5NTdcIjogXCJudTtcIixcbiAgICBcIjk1OFwiOiBcInhpO1wiLFxuICAgIFwiOTU5XCI6IFwib21pY3JvbjtcIixcbiAgICBcIjk2MFwiOiBcInBpO1wiLFxuICAgIFwiOTYxXCI6IFwicmhvO1wiLFxuICAgIFwiOTYyXCI6IFwidmFyc2lnbWE7XCIsXG4gICAgXCI5NjNcIjogXCJzaWdtYTtcIixcbiAgICBcIjk2NFwiOiBcInRhdTtcIixcbiAgICBcIjk2NVwiOiBcInVwc2lsb247XCIsXG4gICAgXCI5NjZcIjogXCJwaGk7XCIsXG4gICAgXCI5NjdcIjogXCJjaGk7XCIsXG4gICAgXCI5NjhcIjogXCJwc2k7XCIsXG4gICAgXCI5NjlcIjogXCJvbWVnYTtcIixcbiAgICBcIjk3N1wiOiBcInZhcnRoZXRhO1wiLFxuICAgIFwiOTc4XCI6IFwidXBzaWg7XCIsXG4gICAgXCI5ODFcIjogXCJ2YXJwaGk7XCIsXG4gICAgXCI5ODJcIjogXCJ2YXJwaTtcIixcbiAgICBcIjk4OFwiOiBcIkdhbW1hZDtcIixcbiAgICBcIjk4OVwiOiBcImdhbW1hZDtcIixcbiAgICBcIjEwMDhcIjogXCJ2YXJrYXBwYTtcIixcbiAgICBcIjEwMDlcIjogXCJ2YXJyaG87XCIsXG4gICAgXCIxMDEzXCI6IFwidmFyZXBzaWxvbjtcIixcbiAgICBcIjEwMTRcIjogXCJiZXBzaTtcIixcbiAgICBcIjEwMjVcIjogXCJJT2N5O1wiLFxuICAgIFwiMTAyNlwiOiBcIkRKY3k7XCIsXG4gICAgXCIxMDI3XCI6IFwiR0pjeTtcIixcbiAgICBcIjEwMjhcIjogXCJKdWtjeTtcIixcbiAgICBcIjEwMjlcIjogXCJEU2N5O1wiLFxuICAgIFwiMTAzMFwiOiBcIkl1a2N5O1wiLFxuICAgIFwiMTAzMVwiOiBcIllJY3k7XCIsXG4gICAgXCIxMDMyXCI6IFwiSnNlcmN5O1wiLFxuICAgIFwiMTAzM1wiOiBcIkxKY3k7XCIsXG4gICAgXCIxMDM0XCI6IFwiTkpjeTtcIixcbiAgICBcIjEwMzVcIjogXCJUU0hjeTtcIixcbiAgICBcIjEwMzZcIjogXCJLSmN5O1wiLFxuICAgIFwiMTAzOFwiOiBcIlVicmN5O1wiLFxuICAgIFwiMTAzOVwiOiBcIkRaY3k7XCIsXG4gICAgXCIxMDQwXCI6IFwiQWN5O1wiLFxuICAgIFwiMTA0MVwiOiBcIkJjeTtcIixcbiAgICBcIjEwNDJcIjogXCJWY3k7XCIsXG4gICAgXCIxMDQzXCI6IFwiR2N5O1wiLFxuICAgIFwiMTA0NFwiOiBcIkRjeTtcIixcbiAgICBcIjEwNDVcIjogXCJJRWN5O1wiLFxuICAgIFwiMTA0NlwiOiBcIlpIY3k7XCIsXG4gICAgXCIxMDQ3XCI6IFwiWmN5O1wiLFxuICAgIFwiMTA0OFwiOiBcIkljeTtcIixcbiAgICBcIjEwNDlcIjogXCJKY3k7XCIsXG4gICAgXCIxMDUwXCI6IFwiS2N5O1wiLFxuICAgIFwiMTA1MVwiOiBcIkxjeTtcIixcbiAgICBcIjEwNTJcIjogXCJNY3k7XCIsXG4gICAgXCIxMDUzXCI6IFwiTmN5O1wiLFxuICAgIFwiMTA1NFwiOiBcIk9jeTtcIixcbiAgICBcIjEwNTVcIjogXCJQY3k7XCIsXG4gICAgXCIxMDU2XCI6IFwiUmN5O1wiLFxuICAgIFwiMTA1N1wiOiBcIlNjeTtcIixcbiAgICBcIjEwNThcIjogXCJUY3k7XCIsXG4gICAgXCIxMDU5XCI6IFwiVWN5O1wiLFxuICAgIFwiMTA2MFwiOiBcIkZjeTtcIixcbiAgICBcIjEwNjFcIjogXCJLSGN5O1wiLFxuICAgIFwiMTA2MlwiOiBcIlRTY3k7XCIsXG4gICAgXCIxMDYzXCI6IFwiQ0hjeTtcIixcbiAgICBcIjEwNjRcIjogXCJTSGN5O1wiLFxuICAgIFwiMTA2NVwiOiBcIlNIQ0hjeTtcIixcbiAgICBcIjEwNjZcIjogXCJIQVJEY3k7XCIsXG4gICAgXCIxMDY3XCI6IFwiWWN5O1wiLFxuICAgIFwiMTA2OFwiOiBcIlNPRlRjeTtcIixcbiAgICBcIjEwNjlcIjogXCJFY3k7XCIsXG4gICAgXCIxMDcwXCI6IFwiWVVjeTtcIixcbiAgICBcIjEwNzFcIjogXCJZQWN5O1wiLFxuICAgIFwiMTA3MlwiOiBcImFjeTtcIixcbiAgICBcIjEwNzNcIjogXCJiY3k7XCIsXG4gICAgXCIxMDc0XCI6IFwidmN5O1wiLFxuICAgIFwiMTA3NVwiOiBcImdjeTtcIixcbiAgICBcIjEwNzZcIjogXCJkY3k7XCIsXG4gICAgXCIxMDc3XCI6IFwiaWVjeTtcIixcbiAgICBcIjEwNzhcIjogXCJ6aGN5O1wiLFxuICAgIFwiMTA3OVwiOiBcInpjeTtcIixcbiAgICBcIjEwODBcIjogXCJpY3k7XCIsXG4gICAgXCIxMDgxXCI6IFwiamN5O1wiLFxuICAgIFwiMTA4MlwiOiBcImtjeTtcIixcbiAgICBcIjEwODNcIjogXCJsY3k7XCIsXG4gICAgXCIxMDg0XCI6IFwibWN5O1wiLFxuICAgIFwiMTA4NVwiOiBcIm5jeTtcIixcbiAgICBcIjEwODZcIjogXCJvY3k7XCIsXG4gICAgXCIxMDg3XCI6IFwicGN5O1wiLFxuICAgIFwiMTA4OFwiOiBcInJjeTtcIixcbiAgICBcIjEwODlcIjogXCJzY3k7XCIsXG4gICAgXCIxMDkwXCI6IFwidGN5O1wiLFxuICAgIFwiMTA5MVwiOiBcInVjeTtcIixcbiAgICBcIjEwOTJcIjogXCJmY3k7XCIsXG4gICAgXCIxMDkzXCI6IFwia2hjeTtcIixcbiAgICBcIjEwOTRcIjogXCJ0c2N5O1wiLFxuICAgIFwiMTA5NVwiOiBcImNoY3k7XCIsXG4gICAgXCIxMDk2XCI6IFwic2hjeTtcIixcbiAgICBcIjEwOTdcIjogXCJzaGNoY3k7XCIsXG4gICAgXCIxMDk4XCI6IFwiaGFyZGN5O1wiLFxuICAgIFwiMTA5OVwiOiBcInljeTtcIixcbiAgICBcIjExMDBcIjogXCJzb2Z0Y3k7XCIsXG4gICAgXCIxMTAxXCI6IFwiZWN5O1wiLFxuICAgIFwiMTEwMlwiOiBcInl1Y3k7XCIsXG4gICAgXCIxMTAzXCI6IFwieWFjeTtcIixcbiAgICBcIjExMDVcIjogXCJpb2N5O1wiLFxuICAgIFwiMTEwNlwiOiBcImRqY3k7XCIsXG4gICAgXCIxMTA3XCI6IFwiZ2pjeTtcIixcbiAgICBcIjExMDhcIjogXCJqdWtjeTtcIixcbiAgICBcIjExMDlcIjogXCJkc2N5O1wiLFxuICAgIFwiMTExMFwiOiBcIml1a2N5O1wiLFxuICAgIFwiMTExMVwiOiBcInlpY3k7XCIsXG4gICAgXCIxMTEyXCI6IFwianNlcmN5O1wiLFxuICAgIFwiMTExM1wiOiBcImxqY3k7XCIsXG4gICAgXCIxMTE0XCI6IFwibmpjeTtcIixcbiAgICBcIjExMTVcIjogXCJ0c2hjeTtcIixcbiAgICBcIjExMTZcIjogXCJramN5O1wiLFxuICAgIFwiMTExOFwiOiBcInVicmN5O1wiLFxuICAgIFwiMTExOVwiOiBcImR6Y3k7XCIsXG4gICAgXCI4MTk0XCI6IFwiZW5zcDtcIixcbiAgICBcIjgxOTVcIjogXCJlbXNwO1wiLFxuICAgIFwiODE5NlwiOiBcImVtc3AxMztcIixcbiAgICBcIjgxOTdcIjogXCJlbXNwMTQ7XCIsXG4gICAgXCI4MTk5XCI6IFwibnVtc3A7XCIsXG4gICAgXCI4MjAwXCI6IFwicHVuY3NwO1wiLFxuICAgIFwiODIwMVwiOiBcIlRoaW5TcGFjZTtcIixcbiAgICBcIjgyMDJcIjogXCJWZXJ5VGhpblNwYWNlO1wiLFxuICAgIFwiODIwM1wiOiBcIlplcm9XaWR0aFNwYWNlO1wiLFxuICAgIFwiODIwNFwiOiBcInp3bmo7XCIsXG4gICAgXCI4MjA1XCI6IFwiendqO1wiLFxuICAgIFwiODIwNlwiOiBcImxybTtcIixcbiAgICBcIjgyMDdcIjogXCJybG07XCIsXG4gICAgXCI4MjA4XCI6IFwiaHlwaGVuO1wiLFxuICAgIFwiODIxMVwiOiBcIm5kYXNoO1wiLFxuICAgIFwiODIxMlwiOiBcIm1kYXNoO1wiLFxuICAgIFwiODIxM1wiOiBcImhvcmJhcjtcIixcbiAgICBcIjgyMTRcIjogXCJWZXJ0O1wiLFxuICAgIFwiODIxNlwiOiBcIk9wZW5DdXJseVF1b3RlO1wiLFxuICAgIFwiODIxN1wiOiBcInJzcXVvcjtcIixcbiAgICBcIjgyMThcIjogXCJzYnF1bztcIixcbiAgICBcIjgyMjBcIjogXCJPcGVuQ3VybHlEb3VibGVRdW90ZTtcIixcbiAgICBcIjgyMjFcIjogXCJyZHF1b3I7XCIsXG4gICAgXCI4MjIyXCI6IFwibGRxdW9yO1wiLFxuICAgIFwiODIyNFwiOiBcImRhZ2dlcjtcIixcbiAgICBcIjgyMjVcIjogXCJkZGFnZ2VyO1wiLFxuICAgIFwiODIyNlwiOiBcImJ1bGxldDtcIixcbiAgICBcIjgyMjlcIjogXCJubGRyO1wiLFxuICAgIFwiODIzMFwiOiBcIm1sZHI7XCIsXG4gICAgXCI4MjQwXCI6IFwicGVybWlsO1wiLFxuICAgIFwiODI0MVwiOiBcInBlcnRlbms7XCIsXG4gICAgXCI4MjQyXCI6IFwicHJpbWU7XCIsXG4gICAgXCI4MjQzXCI6IFwiUHJpbWU7XCIsXG4gICAgXCI4MjQ0XCI6IFwidHByaW1lO1wiLFxuICAgIFwiODI0NVwiOiBcImJwcmltZTtcIixcbiAgICBcIjgyNDlcIjogXCJsc2FxdW87XCIsXG4gICAgXCI4MjUwXCI6IFwicnNhcXVvO1wiLFxuICAgIFwiODI1NFwiOiBcIk92ZXJCYXI7XCIsXG4gICAgXCI4MjU3XCI6IFwiY2FyZXQ7XCIsXG4gICAgXCI4MjU5XCI6IFwiaHlidWxsO1wiLFxuICAgIFwiODI2MFwiOiBcImZyYXNsO1wiLFxuICAgIFwiODI3MVwiOiBcImJzZW1pO1wiLFxuICAgIFwiODI3OVwiOiBcInFwcmltZTtcIixcbiAgICBcIjgyODdcIjogXCJNZWRpdW1TcGFjZTtcIixcbiAgICBcIjgyODhcIjogXCJOb0JyZWFrO1wiLFxuICAgIFwiODI4OVwiOiBcIkFwcGx5RnVuY3Rpb247XCIsXG4gICAgXCI4MjkwXCI6IFwiaXQ7XCIsXG4gICAgXCI4MjkxXCI6IFwiSW52aXNpYmxlQ29tbWE7XCIsXG4gICAgXCI4MzY0XCI6IFwiZXVybztcIixcbiAgICBcIjg0MTFcIjogXCJUcmlwbGVEb3Q7XCIsXG4gICAgXCI4NDEyXCI6IFwiRG90RG90O1wiLFxuICAgIFwiODQ1MFwiOiBcIkNvcGY7XCIsXG4gICAgXCI4NDUzXCI6IFwiaW5jYXJlO1wiLFxuICAgIFwiODQ1OFwiOiBcImdzY3I7XCIsXG4gICAgXCI4NDU5XCI6IFwiSHNjcjtcIixcbiAgICBcIjg0NjBcIjogXCJQb2luY2FyZXBsYW5lO1wiLFxuICAgIFwiODQ2MVwiOiBcInF1YXRlcm5pb25zO1wiLFxuICAgIFwiODQ2MlwiOiBcInBsYW5ja2g7XCIsXG4gICAgXCI4NDYzXCI6IFwicGxhbmt2O1wiLFxuICAgIFwiODQ2NFwiOiBcIklzY3I7XCIsXG4gICAgXCI4NDY1XCI6IFwiaW1hZ3BhcnQ7XCIsXG4gICAgXCI4NDY2XCI6IFwiTHNjcjtcIixcbiAgICBcIjg0NjdcIjogXCJlbGw7XCIsXG4gICAgXCI4NDY5XCI6IFwiTm9wZjtcIixcbiAgICBcIjg0NzBcIjogXCJudW1lcm87XCIsXG4gICAgXCI4NDcxXCI6IFwiY29weXNyO1wiLFxuICAgIFwiODQ3MlwiOiBcIndwO1wiLFxuICAgIFwiODQ3M1wiOiBcInByaW1lcztcIixcbiAgICBcIjg0NzRcIjogXCJyYXRpb25hbHM7XCIsXG4gICAgXCI4NDc1XCI6IFwiUnNjcjtcIixcbiAgICBcIjg0NzZcIjogXCJSZnI7XCIsXG4gICAgXCI4NDc3XCI6IFwiUm9wZjtcIixcbiAgICBcIjg0NzhcIjogXCJyeDtcIixcbiAgICBcIjg0ODJcIjogXCJ0cmFkZTtcIixcbiAgICBcIjg0ODRcIjogXCJab3BmO1wiLFxuICAgIFwiODQ4N1wiOiBcIm1obztcIixcbiAgICBcIjg0ODhcIjogXCJaZnI7XCIsXG4gICAgXCI4NDg5XCI6IFwiaWlvdGE7XCIsXG4gICAgXCI4NDkyXCI6IFwiQnNjcjtcIixcbiAgICBcIjg0OTNcIjogXCJDZnI7XCIsXG4gICAgXCI4NDk1XCI6IFwiZXNjcjtcIixcbiAgICBcIjg0OTZcIjogXCJleHBlY3RhdGlvbjtcIixcbiAgICBcIjg0OTdcIjogXCJGc2NyO1wiLFxuICAgIFwiODQ5OVwiOiBcInBobW1hdDtcIixcbiAgICBcIjg1MDBcIjogXCJvc2NyO1wiLFxuICAgIFwiODUwMVwiOiBcImFsZXBoO1wiLFxuICAgIFwiODUwMlwiOiBcImJldGg7XCIsXG4gICAgXCI4NTAzXCI6IFwiZ2ltZWw7XCIsXG4gICAgXCI4NTA0XCI6IFwiZGFsZXRoO1wiLFxuICAgIFwiODUxN1wiOiBcIkREO1wiLFxuICAgIFwiODUxOFwiOiBcIkRpZmZlcmVudGlhbEQ7XCIsXG4gICAgXCI4NTE5XCI6IFwiZXhwb25lbnRpYWxlO1wiLFxuICAgIFwiODUyMFwiOiBcIkltYWdpbmFyeUk7XCIsXG4gICAgXCI4NTMxXCI6IFwiZnJhYzEzO1wiLFxuICAgIFwiODUzMlwiOiBcImZyYWMyMztcIixcbiAgICBcIjg1MzNcIjogXCJmcmFjMTU7XCIsXG4gICAgXCI4NTM0XCI6IFwiZnJhYzI1O1wiLFxuICAgIFwiODUzNVwiOiBcImZyYWMzNTtcIixcbiAgICBcIjg1MzZcIjogXCJmcmFjNDU7XCIsXG4gICAgXCI4NTM3XCI6IFwiZnJhYzE2O1wiLFxuICAgIFwiODUzOFwiOiBcImZyYWM1NjtcIixcbiAgICBcIjg1MzlcIjogXCJmcmFjMTg7XCIsXG4gICAgXCI4NTQwXCI6IFwiZnJhYzM4O1wiLFxuICAgIFwiODU0MVwiOiBcImZyYWM1ODtcIixcbiAgICBcIjg1NDJcIjogXCJmcmFjNzg7XCIsXG4gICAgXCI4NTkyXCI6IFwic2xhcnI7XCIsXG4gICAgXCI4NTkzXCI6IFwidXBhcnJvdztcIixcbiAgICBcIjg1OTRcIjogXCJzcmFycjtcIixcbiAgICBcIjg1OTVcIjogXCJTaG9ydERvd25BcnJvdztcIixcbiAgICBcIjg1OTZcIjogXCJsZWZ0cmlnaHRhcnJvdztcIixcbiAgICBcIjg1OTdcIjogXCJ2YXJyO1wiLFxuICAgIFwiODU5OFwiOiBcIlVwcGVyTGVmdEFycm93O1wiLFxuICAgIFwiODU5OVwiOiBcIlVwcGVyUmlnaHRBcnJvdztcIixcbiAgICBcIjg2MDBcIjogXCJzZWFycm93O1wiLFxuICAgIFwiODYwMVwiOiBcInN3YXJyb3c7XCIsXG4gICAgXCI4NjAyXCI6IFwibmxlZnRhcnJvdztcIixcbiAgICBcIjg2MDNcIjogXCJucmlnaHRhcnJvdztcIixcbiAgICBcIjg2MDVcIjogXCJyaWdodHNxdWlnYXJyb3c7XCIsXG4gICAgXCI4NjA2XCI6IFwidHdvaGVhZGxlZnRhcnJvdztcIixcbiAgICBcIjg2MDdcIjogXCJVYXJyO1wiLFxuICAgIFwiODYwOFwiOiBcInR3b2hlYWRyaWdodGFycm93O1wiLFxuICAgIFwiODYwOVwiOiBcIkRhcnI7XCIsXG4gICAgXCI4NjEwXCI6IFwibGVmdGFycm93dGFpbDtcIixcbiAgICBcIjg2MTFcIjogXCJyaWdodGFycm93dGFpbDtcIixcbiAgICBcIjg2MTJcIjogXCJtYXBzdG9sZWZ0O1wiLFxuICAgIFwiODYxM1wiOiBcIlVwVGVlQXJyb3c7XCIsXG4gICAgXCI4NjE0XCI6IFwiUmlnaHRUZWVBcnJvdztcIixcbiAgICBcIjg2MTVcIjogXCJtYXBzdG9kb3duO1wiLFxuICAgIFwiODYxN1wiOiBcImxhcnJoaztcIixcbiAgICBcIjg2MThcIjogXCJyYXJyaGs7XCIsXG4gICAgXCI4NjE5XCI6IFwibG9vcGFycm93bGVmdDtcIixcbiAgICBcIjg2MjBcIjogXCJyYXJybHA7XCIsXG4gICAgXCI4NjIxXCI6IFwibGVmdHJpZ2h0c3F1aWdhcnJvdztcIixcbiAgICBcIjg2MjJcIjogXCJubGVmdHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjI0XCI6IFwibHNoO1wiLFxuICAgIFwiODYyNVwiOiBcInJzaDtcIixcbiAgICBcIjg2MjZcIjogXCJsZHNoO1wiLFxuICAgIFwiODYyN1wiOiBcInJkc2g7XCIsXG4gICAgXCI4NjI5XCI6IFwiY3JhcnI7XCIsXG4gICAgXCI4NjMwXCI6IFwiY3VydmVhcnJvd2xlZnQ7XCIsXG4gICAgXCI4NjMxXCI6IFwiY3VydmVhcnJvd3JpZ2h0O1wiLFxuICAgIFwiODYzNFwiOiBcIm9sYXJyO1wiLFxuICAgIFwiODYzNVwiOiBcIm9yYXJyO1wiLFxuICAgIFwiODYzNlwiOiBcImxoYXJ1O1wiLFxuICAgIFwiODYzN1wiOiBcImxoYXJkO1wiLFxuICAgIFwiODYzOFwiOiBcInVwaGFycG9vbnJpZ2h0O1wiLFxuICAgIFwiODYzOVwiOiBcInVwaGFycG9vbmxlZnQ7XCIsXG4gICAgXCI4NjQwXCI6IFwiUmlnaHRWZWN0b3I7XCIsXG4gICAgXCI4NjQxXCI6IFwicmlnaHRoYXJwb29uZG93bjtcIixcbiAgICBcIjg2NDJcIjogXCJSaWdodERvd25WZWN0b3I7XCIsXG4gICAgXCI4NjQzXCI6IFwiTGVmdERvd25WZWN0b3I7XCIsXG4gICAgXCI4NjQ0XCI6IFwicmxhcnI7XCIsXG4gICAgXCI4NjQ1XCI6IFwiVXBBcnJvd0Rvd25BcnJvdztcIixcbiAgICBcIjg2NDZcIjogXCJscmFycjtcIixcbiAgICBcIjg2NDdcIjogXCJsbGFycjtcIixcbiAgICBcIjg2NDhcIjogXCJ1dWFycjtcIixcbiAgICBcIjg2NDlcIjogXCJycmFycjtcIixcbiAgICBcIjg2NTBcIjogXCJkb3duZG93bmFycm93cztcIixcbiAgICBcIjg2NTFcIjogXCJSZXZlcnNlRXF1aWxpYnJpdW07XCIsXG4gICAgXCI4NjUyXCI6IFwicmxoYXI7XCIsXG4gICAgXCI4NjUzXCI6IFwibkxlZnRhcnJvdztcIixcbiAgICBcIjg2NTRcIjogXCJuTGVmdHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjU1XCI6IFwiblJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjU2XCI6IFwiTGVmdGFycm93O1wiLFxuICAgIFwiODY1N1wiOiBcIlVwYXJyb3c7XCIsXG4gICAgXCI4NjU4XCI6IFwiUmlnaHRhcnJvdztcIixcbiAgICBcIjg2NTlcIjogXCJEb3duYXJyb3c7XCIsXG4gICAgXCI4NjYwXCI6IFwiTGVmdHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjYxXCI6IFwidkFycjtcIixcbiAgICBcIjg2NjJcIjogXCJud0FycjtcIixcbiAgICBcIjg2NjNcIjogXCJuZUFycjtcIixcbiAgICBcIjg2NjRcIjogXCJzZUFycjtcIixcbiAgICBcIjg2NjVcIjogXCJzd0FycjtcIixcbiAgICBcIjg2NjZcIjogXCJMbGVmdGFycm93O1wiLFxuICAgIFwiODY2N1wiOiBcIlJyaWdodGFycm93O1wiLFxuICAgIFwiODY2OVwiOiBcInppZ3JhcnI7XCIsXG4gICAgXCI4Njc2XCI6IFwiTGVmdEFycm93QmFyO1wiLFxuICAgIFwiODY3N1wiOiBcIlJpZ2h0QXJyb3dCYXI7XCIsXG4gICAgXCI4NjkzXCI6IFwiZHVhcnI7XCIsXG4gICAgXCI4NzAxXCI6IFwibG9hcnI7XCIsXG4gICAgXCI4NzAyXCI6IFwicm9hcnI7XCIsXG4gICAgXCI4NzAzXCI6IFwiaG9hcnI7XCIsXG4gICAgXCI4NzA0XCI6IFwiZm9yYWxsO1wiLFxuICAgIFwiODcwNVwiOiBcImNvbXBsZW1lbnQ7XCIsXG4gICAgXCI4NzA2XCI6IFwiUGFydGlhbEQ7XCIsXG4gICAgXCI4NzA3XCI6IFwiRXhpc3RzO1wiLFxuICAgIFwiODcwOFwiOiBcIk5vdEV4aXN0cztcIixcbiAgICBcIjg3MDlcIjogXCJ2YXJub3RoaW5nO1wiLFxuICAgIFwiODcxMVwiOiBcIm5hYmxhO1wiLFxuICAgIFwiODcxMlwiOiBcImlzaW52O1wiLFxuICAgIFwiODcxM1wiOiBcIm5vdGludmE7XCIsXG4gICAgXCI4NzE1XCI6IFwiU3VjaFRoYXQ7XCIsXG4gICAgXCI4NzE2XCI6IFwiTm90UmV2ZXJzZUVsZW1lbnQ7XCIsXG4gICAgXCI4NzE5XCI6IFwiUHJvZHVjdDtcIixcbiAgICBcIjg3MjBcIjogXCJDb3Byb2R1Y3Q7XCIsXG4gICAgXCI4NzIxXCI6IFwic3VtO1wiLFxuICAgIFwiODcyMlwiOiBcIm1pbnVzO1wiLFxuICAgIFwiODcyM1wiOiBcIm1wO1wiLFxuICAgIFwiODcyNFwiOiBcInBsdXNkbztcIixcbiAgICBcIjg3MjZcIjogXCJzc2V0bW47XCIsXG4gICAgXCI4NzI3XCI6IFwibG93YXN0O1wiLFxuICAgIFwiODcyOFwiOiBcIlNtYWxsQ2lyY2xlO1wiLFxuICAgIFwiODczMFwiOiBcIlNxcnQ7XCIsXG4gICAgXCI4NzMzXCI6IFwidnByb3A7XCIsXG4gICAgXCI4NzM0XCI6IFwiaW5maW47XCIsXG4gICAgXCI4NzM1XCI6IFwiYW5ncnQ7XCIsXG4gICAgXCI4NzM2XCI6IFwiYW5nbGU7XCIsXG4gICAgXCI4NzM3XCI6IFwibWVhc3VyZWRhbmdsZTtcIixcbiAgICBcIjg3MzhcIjogXCJhbmdzcGg7XCIsXG4gICAgXCI4NzM5XCI6IFwiVmVydGljYWxCYXI7XCIsXG4gICAgXCI4NzQwXCI6IFwibnNtaWQ7XCIsXG4gICAgXCI4NzQxXCI6IFwic3BhcjtcIixcbiAgICBcIjg3NDJcIjogXCJuc3BhcjtcIixcbiAgICBcIjg3NDNcIjogXCJ3ZWRnZTtcIixcbiAgICBcIjg3NDRcIjogXCJ2ZWU7XCIsXG4gICAgXCI4NzQ1XCI6IFwiY2FwO1wiLFxuICAgIFwiODc0NlwiOiBcImN1cDtcIixcbiAgICBcIjg3NDdcIjogXCJJbnRlZ3JhbDtcIixcbiAgICBcIjg3NDhcIjogXCJJbnQ7XCIsXG4gICAgXCI4NzQ5XCI6IFwidGludDtcIixcbiAgICBcIjg3NTBcIjogXCJvaW50O1wiLFxuICAgIFwiODc1MVwiOiBcIkRvdWJsZUNvbnRvdXJJbnRlZ3JhbDtcIixcbiAgICBcIjg3NTJcIjogXCJDY29uaW50O1wiLFxuICAgIFwiODc1M1wiOiBcImN3aW50O1wiLFxuICAgIFwiODc1NFwiOiBcImN3Y29uaW50O1wiLFxuICAgIFwiODc1NVwiOiBcIkNvdW50ZXJDbG9ja3dpc2VDb250b3VySW50ZWdyYWw7XCIsXG4gICAgXCI4NzU2XCI6IFwidGhlcmVmb3JlO1wiLFxuICAgIFwiODc1N1wiOiBcImJlY2F1c2U7XCIsXG4gICAgXCI4NzU4XCI6IFwicmF0aW87XCIsXG4gICAgXCI4NzU5XCI6IFwiUHJvcG9ydGlvbjtcIixcbiAgICBcIjg3NjBcIjogXCJtaW51c2Q7XCIsXG4gICAgXCI4NzYyXCI6IFwibUREb3Q7XCIsXG4gICAgXCI4NzYzXCI6IFwiaG9tdGh0O1wiLFxuICAgIFwiODc2NFwiOiBcIlRpbGRlO1wiLFxuICAgIFwiODc2NVwiOiBcImJzaW07XCIsXG4gICAgXCI4NzY2XCI6IFwibXN0cG9zO1wiLFxuICAgIFwiODc2N1wiOiBcImFjZDtcIixcbiAgICBcIjg3NjhcIjogXCJ3cmVhdGg7XCIsXG4gICAgXCI4NzY5XCI6IFwibnNpbTtcIixcbiAgICBcIjg3NzBcIjogXCJlc2ltO1wiLFxuICAgIFwiODc3MVwiOiBcIlRpbGRlRXF1YWw7XCIsXG4gICAgXCI4NzcyXCI6IFwibnNpbWVxO1wiLFxuICAgIFwiODc3M1wiOiBcIlRpbGRlRnVsbEVxdWFsO1wiLFxuICAgIFwiODc3NFwiOiBcInNpbW5lO1wiLFxuICAgIFwiODc3NVwiOiBcIk5vdFRpbGRlRnVsbEVxdWFsO1wiLFxuICAgIFwiODc3NlwiOiBcIlRpbGRlVGlsZGU7XCIsXG4gICAgXCI4Nzc3XCI6IFwiTm90VGlsZGVUaWxkZTtcIixcbiAgICBcIjg3NzhcIjogXCJhcHByb3hlcTtcIixcbiAgICBcIjg3NzlcIjogXCJhcGlkO1wiLFxuICAgIFwiODc4MFwiOiBcImJjb25nO1wiLFxuICAgIFwiODc4MVwiOiBcIkN1cENhcDtcIixcbiAgICBcIjg3ODJcIjogXCJIdW1wRG93bkh1bXA7XCIsXG4gICAgXCI4NzgzXCI6IFwiSHVtcEVxdWFsO1wiLFxuICAgIFwiODc4NFwiOiBcImVzZG90O1wiLFxuICAgIFwiODc4NVwiOiBcImVEb3Q7XCIsXG4gICAgXCI4Nzg2XCI6IFwiZmFsbGluZ2RvdHNlcTtcIixcbiAgICBcIjg3ODdcIjogXCJyaXNpbmdkb3RzZXE7XCIsXG4gICAgXCI4Nzg4XCI6IFwiY29sb25lcTtcIixcbiAgICBcIjg3ODlcIjogXCJlcWNvbG9uO1wiLFxuICAgIFwiODc5MFwiOiBcImVxY2lyYztcIixcbiAgICBcIjg3OTFcIjogXCJjaXJlO1wiLFxuICAgIFwiODc5M1wiOiBcIndlZGdlcTtcIixcbiAgICBcIjg3OTRcIjogXCJ2ZWVlcTtcIixcbiAgICBcIjg3OTZcIjogXCJ0cmllO1wiLFxuICAgIFwiODc5OVwiOiBcInF1ZXN0ZXE7XCIsXG4gICAgXCI4ODAwXCI6IFwiTm90RXF1YWw7XCIsXG4gICAgXCI4ODAxXCI6IFwiZXF1aXY7XCIsXG4gICAgXCI4ODAyXCI6IFwiTm90Q29uZ3J1ZW50O1wiLFxuICAgIFwiODgwNFwiOiBcImxlcTtcIixcbiAgICBcIjg4MDVcIjogXCJHcmVhdGVyRXF1YWw7XCIsXG4gICAgXCI4ODA2XCI6IFwiTGVzc0Z1bGxFcXVhbDtcIixcbiAgICBcIjg4MDdcIjogXCJHcmVhdGVyRnVsbEVxdWFsO1wiLFxuICAgIFwiODgwOFwiOiBcImxuZXFxO1wiLFxuICAgIFwiODgwOVwiOiBcImduZXFxO1wiLFxuICAgIFwiODgxMFwiOiBcIk5lc3RlZExlc3NMZXNzO1wiLFxuICAgIFwiODgxMVwiOiBcIk5lc3RlZEdyZWF0ZXJHcmVhdGVyO1wiLFxuICAgIFwiODgxMlwiOiBcInR3aXh0O1wiLFxuICAgIFwiODgxM1wiOiBcIk5vdEN1cENhcDtcIixcbiAgICBcIjg4MTRcIjogXCJOb3RMZXNzO1wiLFxuICAgIFwiODgxNVwiOiBcIk5vdEdyZWF0ZXI7XCIsXG4gICAgXCI4ODE2XCI6IFwiTm90TGVzc0VxdWFsO1wiLFxuICAgIFwiODgxN1wiOiBcIk5vdEdyZWF0ZXJFcXVhbDtcIixcbiAgICBcIjg4MThcIjogXCJsc2ltO1wiLFxuICAgIFwiODgxOVwiOiBcImd0cnNpbTtcIixcbiAgICBcIjg4MjBcIjogXCJOb3RMZXNzVGlsZGU7XCIsXG4gICAgXCI4ODIxXCI6IFwiTm90R3JlYXRlclRpbGRlO1wiLFxuICAgIFwiODgyMlwiOiBcImxnO1wiLFxuICAgIFwiODgyM1wiOiBcImd0cmxlc3M7XCIsXG4gICAgXCI4ODI0XCI6IFwibnRsZztcIixcbiAgICBcIjg4MjVcIjogXCJudGdsO1wiLFxuICAgIFwiODgyNlwiOiBcIlByZWNlZGVzO1wiLFxuICAgIFwiODgyN1wiOiBcIlN1Y2NlZWRzO1wiLFxuICAgIFwiODgyOFwiOiBcIlByZWNlZGVzU2xhbnRFcXVhbDtcIixcbiAgICBcIjg4MjlcIjogXCJTdWNjZWVkc1NsYW50RXF1YWw7XCIsXG4gICAgXCI4ODMwXCI6IFwicHJzaW07XCIsXG4gICAgXCI4ODMxXCI6IFwic3VjY3NpbTtcIixcbiAgICBcIjg4MzJcIjogXCJucHJlYztcIixcbiAgICBcIjg4MzNcIjogXCJuc3VjYztcIixcbiAgICBcIjg4MzRcIjogXCJzdWJzZXQ7XCIsXG4gICAgXCI4ODM1XCI6IFwic3Vwc2V0O1wiLFxuICAgIFwiODgzNlwiOiBcIm5zdWI7XCIsXG4gICAgXCI4ODM3XCI6IFwibnN1cDtcIixcbiAgICBcIjg4MzhcIjogXCJTdWJzZXRFcXVhbDtcIixcbiAgICBcIjg4MzlcIjogXCJzdXBzZXRlcTtcIixcbiAgICBcIjg4NDBcIjogXCJuc3Vic2V0ZXE7XCIsXG4gICAgXCI4ODQxXCI6IFwibnN1cHNldGVxO1wiLFxuICAgIFwiODg0MlwiOiBcInN1YnNldG5lcTtcIixcbiAgICBcIjg4NDNcIjogXCJzdXBzZXRuZXE7XCIsXG4gICAgXCI4ODQ1XCI6IFwiY3VwZG90O1wiLFxuICAgIFwiODg0NlwiOiBcInVwbHVzO1wiLFxuICAgIFwiODg0N1wiOiBcIlNxdWFyZVN1YnNldDtcIixcbiAgICBcIjg4NDhcIjogXCJTcXVhcmVTdXBlcnNldDtcIixcbiAgICBcIjg4NDlcIjogXCJTcXVhcmVTdWJzZXRFcXVhbDtcIixcbiAgICBcIjg4NTBcIjogXCJTcXVhcmVTdXBlcnNldEVxdWFsO1wiLFxuICAgIFwiODg1MVwiOiBcIlNxdWFyZUludGVyc2VjdGlvbjtcIixcbiAgICBcIjg4NTJcIjogXCJTcXVhcmVVbmlvbjtcIixcbiAgICBcIjg4NTNcIjogXCJvcGx1cztcIixcbiAgICBcIjg4NTRcIjogXCJvbWludXM7XCIsXG4gICAgXCI4ODU1XCI6IFwib3RpbWVzO1wiLFxuICAgIFwiODg1NlwiOiBcIm9zb2w7XCIsXG4gICAgXCI4ODU3XCI6IFwib2RvdDtcIixcbiAgICBcIjg4NThcIjogXCJvY2lyO1wiLFxuICAgIFwiODg1OVwiOiBcIm9hc3Q7XCIsXG4gICAgXCI4ODYxXCI6IFwib2Rhc2g7XCIsXG4gICAgXCI4ODYyXCI6IFwicGx1c2I7XCIsXG4gICAgXCI4ODYzXCI6IFwibWludXNiO1wiLFxuICAgIFwiODg2NFwiOiBcInRpbWVzYjtcIixcbiAgICBcIjg4NjVcIjogXCJzZG90YjtcIixcbiAgICBcIjg4NjZcIjogXCJ2ZGFzaDtcIixcbiAgICBcIjg4NjdcIjogXCJMZWZ0VGVlO1wiLFxuICAgIFwiODg2OFwiOiBcInRvcDtcIixcbiAgICBcIjg4NjlcIjogXCJVcFRlZTtcIixcbiAgICBcIjg4NzFcIjogXCJtb2RlbHM7XCIsXG4gICAgXCI4ODcyXCI6IFwidkRhc2g7XCIsXG4gICAgXCI4ODczXCI6IFwiVmRhc2g7XCIsXG4gICAgXCI4ODc0XCI6IFwiVnZkYXNoO1wiLFxuICAgIFwiODg3NVwiOiBcIlZEYXNoO1wiLFxuICAgIFwiODg3NlwiOiBcIm52ZGFzaDtcIixcbiAgICBcIjg4NzdcIjogXCJudkRhc2g7XCIsXG4gICAgXCI4ODc4XCI6IFwiblZkYXNoO1wiLFxuICAgIFwiODg3OVwiOiBcIm5WRGFzaDtcIixcbiAgICBcIjg4ODBcIjogXCJwcnVyZWw7XCIsXG4gICAgXCI4ODgyXCI6IFwidmx0cmk7XCIsXG4gICAgXCI4ODgzXCI6IFwidnJ0cmk7XCIsXG4gICAgXCI4ODg0XCI6IFwidHJpYW5nbGVsZWZ0ZXE7XCIsXG4gICAgXCI4ODg1XCI6IFwidHJpYW5nbGVyaWdodGVxO1wiLFxuICAgIFwiODg4NlwiOiBcIm9yaWdvZjtcIixcbiAgICBcIjg4ODdcIjogXCJpbW9mO1wiLFxuICAgIFwiODg4OFwiOiBcIm11bWFwO1wiLFxuICAgIFwiODg4OVwiOiBcImhlcmNvbjtcIixcbiAgICBcIjg4OTBcIjogXCJpbnRlcmNhbDtcIixcbiAgICBcIjg4OTFcIjogXCJ2ZWViYXI7XCIsXG4gICAgXCI4ODkzXCI6IFwiYmFydmVlO1wiLFxuICAgIFwiODg5NFwiOiBcImFuZ3J0dmI7XCIsXG4gICAgXCI4ODk1XCI6IFwibHJ0cmk7XCIsXG4gICAgXCI4ODk2XCI6IFwieHdlZGdlO1wiLFxuICAgIFwiODg5N1wiOiBcInh2ZWU7XCIsXG4gICAgXCI4ODk4XCI6IFwieGNhcDtcIixcbiAgICBcIjg4OTlcIjogXCJ4Y3VwO1wiLFxuICAgIFwiODkwMFwiOiBcImRpYW1vbmQ7XCIsXG4gICAgXCI4OTAxXCI6IFwic2RvdDtcIixcbiAgICBcIjg5MDJcIjogXCJTdGFyO1wiLFxuICAgIFwiODkwM1wiOiBcImRpdm9ueDtcIixcbiAgICBcIjg5MDRcIjogXCJib3d0aWU7XCIsXG4gICAgXCI4OTA1XCI6IFwibHRpbWVzO1wiLFxuICAgIFwiODkwNlwiOiBcInJ0aW1lcztcIixcbiAgICBcIjg5MDdcIjogXCJsdGhyZWU7XCIsXG4gICAgXCI4OTA4XCI6IFwicnRocmVlO1wiLFxuICAgIFwiODkwOVwiOiBcImJzaW1lO1wiLFxuICAgIFwiODkxMFwiOiBcImN1dmVlO1wiLFxuICAgIFwiODkxMVwiOiBcImN1d2VkO1wiLFxuICAgIFwiODkxMlwiOiBcIlN1YnNldDtcIixcbiAgICBcIjg5MTNcIjogXCJTdXBzZXQ7XCIsXG4gICAgXCI4OTE0XCI6IFwiQ2FwO1wiLFxuICAgIFwiODkxNVwiOiBcIkN1cDtcIixcbiAgICBcIjg5MTZcIjogXCJwaXRjaGZvcms7XCIsXG4gICAgXCI4OTE3XCI6IFwiZXBhcjtcIixcbiAgICBcIjg5MThcIjogXCJsdGRvdDtcIixcbiAgICBcIjg5MTlcIjogXCJndHJkb3Q7XCIsXG4gICAgXCI4OTIwXCI6IFwiTGw7XCIsXG4gICAgXCI4OTIxXCI6IFwiZ2dnO1wiLFxuICAgIFwiODkyMlwiOiBcIkxlc3NFcXVhbEdyZWF0ZXI7XCIsXG4gICAgXCI4OTIzXCI6IFwiZ3RyZXFsZXNzO1wiLFxuICAgIFwiODkyNlwiOiBcImN1cmx5ZXFwcmVjO1wiLFxuICAgIFwiODkyN1wiOiBcImN1cmx5ZXFzdWNjO1wiLFxuICAgIFwiODkyOFwiOiBcIm5wcmN1ZTtcIixcbiAgICBcIjg5MjlcIjogXCJuc2NjdWU7XCIsXG4gICAgXCI4OTMwXCI6IFwibnNxc3ViZTtcIixcbiAgICBcIjg5MzFcIjogXCJuc3FzdXBlO1wiLFxuICAgIFwiODkzNFwiOiBcImxuc2ltO1wiLFxuICAgIFwiODkzNVwiOiBcImduc2ltO1wiLFxuICAgIFwiODkzNlwiOiBcInBybnNpbTtcIixcbiAgICBcIjg5MzdcIjogXCJzdWNjbnNpbTtcIixcbiAgICBcIjg5MzhcIjogXCJudHJpYW5nbGVsZWZ0O1wiLFxuICAgIFwiODkzOVwiOiBcIm50cmlhbmdsZXJpZ2h0O1wiLFxuICAgIFwiODk0MFwiOiBcIm50cmlhbmdsZWxlZnRlcTtcIixcbiAgICBcIjg5NDFcIjogXCJudHJpYW5nbGVyaWdodGVxO1wiLFxuICAgIFwiODk0MlwiOiBcInZlbGxpcDtcIixcbiAgICBcIjg5NDNcIjogXCJjdGRvdDtcIixcbiAgICBcIjg5NDRcIjogXCJ1dGRvdDtcIixcbiAgICBcIjg5NDVcIjogXCJkdGRvdDtcIixcbiAgICBcIjg5NDZcIjogXCJkaXNpbjtcIixcbiAgICBcIjg5NDdcIjogXCJpc2luc3Y7XCIsXG4gICAgXCI4OTQ4XCI6IFwiaXNpbnM7XCIsXG4gICAgXCI4OTQ5XCI6IFwiaXNpbmRvdDtcIixcbiAgICBcIjg5NTBcIjogXCJub3RpbnZjO1wiLFxuICAgIFwiODk1MVwiOiBcIm5vdGludmI7XCIsXG4gICAgXCI4OTUzXCI6IFwiaXNpbkU7XCIsXG4gICAgXCI4OTU0XCI6IFwibmlzZDtcIixcbiAgICBcIjg5NTVcIjogXCJ4bmlzO1wiLFxuICAgIFwiODk1NlwiOiBcIm5pcztcIixcbiAgICBcIjg5NTdcIjogXCJub3RuaXZjO1wiLFxuICAgIFwiODk1OFwiOiBcIm5vdG5pdmI7XCIsXG4gICAgXCI4OTY1XCI6IFwiYmFyd2VkZ2U7XCIsXG4gICAgXCI4OTY2XCI6IFwiZG91YmxlYmFyd2VkZ2U7XCIsXG4gICAgXCI4OTY4XCI6IFwiTGVmdENlaWxpbmc7XCIsXG4gICAgXCI4OTY5XCI6IFwiUmlnaHRDZWlsaW5nO1wiLFxuICAgIFwiODk3MFwiOiBcImxmbG9vcjtcIixcbiAgICBcIjg5NzFcIjogXCJSaWdodEZsb29yO1wiLFxuICAgIFwiODk3MlwiOiBcImRyY3JvcDtcIixcbiAgICBcIjg5NzNcIjogXCJkbGNyb3A7XCIsXG4gICAgXCI4OTc0XCI6IFwidXJjcm9wO1wiLFxuICAgIFwiODk3NVwiOiBcInVsY3JvcDtcIixcbiAgICBcIjg5NzZcIjogXCJibm90O1wiLFxuICAgIFwiODk3OFwiOiBcInByb2ZsaW5lO1wiLFxuICAgIFwiODk3OVwiOiBcInByb2ZzdXJmO1wiLFxuICAgIFwiODk4MVwiOiBcInRlbHJlYztcIixcbiAgICBcIjg5ODJcIjogXCJ0YXJnZXQ7XCIsXG4gICAgXCI4OTg4XCI6IFwidWxjb3JuZXI7XCIsXG4gICAgXCI4OTg5XCI6IFwidXJjb3JuZXI7XCIsXG4gICAgXCI4OTkwXCI6IFwibGxjb3JuZXI7XCIsXG4gICAgXCI4OTkxXCI6IFwibHJjb3JuZXI7XCIsXG4gICAgXCI4OTk0XCI6IFwic2Zyb3duO1wiLFxuICAgIFwiODk5NVwiOiBcInNzbWlsZTtcIixcbiAgICBcIjkwMDVcIjogXCJjeWxjdHk7XCIsXG4gICAgXCI5MDA2XCI6IFwicHJvZmFsYXI7XCIsXG4gICAgXCI5MDE0XCI6IFwidG9wYm90O1wiLFxuICAgIFwiOTAyMVwiOiBcIm92YmFyO1wiLFxuICAgIFwiOTAyM1wiOiBcInNvbGJhcjtcIixcbiAgICBcIjkwODRcIjogXCJhbmd6YXJyO1wiLFxuICAgIFwiOTEzNlwiOiBcImxtb3VzdGFjaGU7XCIsXG4gICAgXCI5MTM3XCI6IFwicm1vdXN0YWNoZTtcIixcbiAgICBcIjkxNDBcIjogXCJ0YnJrO1wiLFxuICAgIFwiOTE0MVwiOiBcIlVuZGVyQnJhY2tldDtcIixcbiAgICBcIjkxNDJcIjogXCJiYnJrdGJyaztcIixcbiAgICBcIjkxODBcIjogXCJPdmVyUGFyZW50aGVzaXM7XCIsXG4gICAgXCI5MTgxXCI6IFwiVW5kZXJQYXJlbnRoZXNpcztcIixcbiAgICBcIjkxODJcIjogXCJPdmVyQnJhY2U7XCIsXG4gICAgXCI5MTgzXCI6IFwiVW5kZXJCcmFjZTtcIixcbiAgICBcIjkxODZcIjogXCJ0cnBleml1bTtcIixcbiAgICBcIjkxOTFcIjogXCJlbGludGVycztcIixcbiAgICBcIjkyNTFcIjogXCJibGFuaztcIixcbiAgICBcIjk0MTZcIjogXCJvUztcIixcbiAgICBcIjk0NzJcIjogXCJIb3Jpem9udGFsTGluZTtcIixcbiAgICBcIjk0NzRcIjogXCJib3h2O1wiLFxuICAgIFwiOTQ4NFwiOiBcImJveGRyO1wiLFxuICAgIFwiOTQ4OFwiOiBcImJveGRsO1wiLFxuICAgIFwiOTQ5MlwiOiBcImJveHVyO1wiLFxuICAgIFwiOTQ5NlwiOiBcImJveHVsO1wiLFxuICAgIFwiOTUwMFwiOiBcImJveHZyO1wiLFxuICAgIFwiOTUwOFwiOiBcImJveHZsO1wiLFxuICAgIFwiOTUxNlwiOiBcImJveGhkO1wiLFxuICAgIFwiOTUyNFwiOiBcImJveGh1O1wiLFxuICAgIFwiOTUzMlwiOiBcImJveHZoO1wiLFxuICAgIFwiOTU1MlwiOiBcImJveEg7XCIsXG4gICAgXCI5NTUzXCI6IFwiYm94VjtcIixcbiAgICBcIjk1NTRcIjogXCJib3hkUjtcIixcbiAgICBcIjk1NTVcIjogXCJib3hEcjtcIixcbiAgICBcIjk1NTZcIjogXCJib3hEUjtcIixcbiAgICBcIjk1NTdcIjogXCJib3hkTDtcIixcbiAgICBcIjk1NThcIjogXCJib3hEbDtcIixcbiAgICBcIjk1NTlcIjogXCJib3hETDtcIixcbiAgICBcIjk1NjBcIjogXCJib3h1UjtcIixcbiAgICBcIjk1NjFcIjogXCJib3hVcjtcIixcbiAgICBcIjk1NjJcIjogXCJib3hVUjtcIixcbiAgICBcIjk1NjNcIjogXCJib3h1TDtcIixcbiAgICBcIjk1NjRcIjogXCJib3hVbDtcIixcbiAgICBcIjk1NjVcIjogXCJib3hVTDtcIixcbiAgICBcIjk1NjZcIjogXCJib3h2UjtcIixcbiAgICBcIjk1NjdcIjogXCJib3hWcjtcIixcbiAgICBcIjk1NjhcIjogXCJib3hWUjtcIixcbiAgICBcIjk1NjlcIjogXCJib3h2TDtcIixcbiAgICBcIjk1NzBcIjogXCJib3hWbDtcIixcbiAgICBcIjk1NzFcIjogXCJib3hWTDtcIixcbiAgICBcIjk1NzJcIjogXCJib3hIZDtcIixcbiAgICBcIjk1NzNcIjogXCJib3hoRDtcIixcbiAgICBcIjk1NzRcIjogXCJib3hIRDtcIixcbiAgICBcIjk1NzVcIjogXCJib3hIdTtcIixcbiAgICBcIjk1NzZcIjogXCJib3hoVTtcIixcbiAgICBcIjk1NzdcIjogXCJib3hIVTtcIixcbiAgICBcIjk1NzhcIjogXCJib3h2SDtcIixcbiAgICBcIjk1NzlcIjogXCJib3hWaDtcIixcbiAgICBcIjk1ODBcIjogXCJib3hWSDtcIixcbiAgICBcIjk2MDBcIjogXCJ1aGJsaztcIixcbiAgICBcIjk2MDRcIjogXCJsaGJsaztcIixcbiAgICBcIjk2MDhcIjogXCJibG9jaztcIixcbiAgICBcIjk2MTdcIjogXCJibGsxNDtcIixcbiAgICBcIjk2MThcIjogXCJibGsxMjtcIixcbiAgICBcIjk2MTlcIjogXCJibGszNDtcIixcbiAgICBcIjk2MzNcIjogXCJzcXVhcmU7XCIsXG4gICAgXCI5NjQyXCI6IFwic3F1ZjtcIixcbiAgICBcIjk2NDNcIjogXCJFbXB0eVZlcnlTbWFsbFNxdWFyZTtcIixcbiAgICBcIjk2NDVcIjogXCJyZWN0O1wiLFxuICAgIFwiOTY0NlwiOiBcIm1hcmtlcjtcIixcbiAgICBcIjk2NDlcIjogXCJmbHRucztcIixcbiAgICBcIjk2NTFcIjogXCJ4dXRyaTtcIixcbiAgICBcIjk2NTJcIjogXCJ1dHJpZjtcIixcbiAgICBcIjk2NTNcIjogXCJ1dHJpO1wiLFxuICAgIFwiOTY1NlwiOiBcInJ0cmlmO1wiLFxuICAgIFwiOTY1N1wiOiBcInRyaWFuZ2xlcmlnaHQ7XCIsXG4gICAgXCI5NjYxXCI6IFwieGR0cmk7XCIsXG4gICAgXCI5NjYyXCI6IFwiZHRyaWY7XCIsXG4gICAgXCI5NjYzXCI6IFwidHJpYW5nbGVkb3duO1wiLFxuICAgIFwiOTY2NlwiOiBcImx0cmlmO1wiLFxuICAgIFwiOTY2N1wiOiBcInRyaWFuZ2xlbGVmdDtcIixcbiAgICBcIjk2NzRcIjogXCJsb3plbmdlO1wiLFxuICAgIFwiOTY3NVwiOiBcImNpcjtcIixcbiAgICBcIjk3MDhcIjogXCJ0cmlkb3Q7XCIsXG4gICAgXCI5NzExXCI6IFwieGNpcmM7XCIsXG4gICAgXCI5NzIwXCI6IFwidWx0cmk7XCIsXG4gICAgXCI5NzIxXCI6IFwidXJ0cmk7XCIsXG4gICAgXCI5NzIyXCI6IFwibGx0cmk7XCIsXG4gICAgXCI5NzIzXCI6IFwiRW1wdHlTbWFsbFNxdWFyZTtcIixcbiAgICBcIjk3MjRcIjogXCJGaWxsZWRTbWFsbFNxdWFyZTtcIixcbiAgICBcIjk3MzNcIjogXCJzdGFyZjtcIixcbiAgICBcIjk3MzRcIjogXCJzdGFyO1wiLFxuICAgIFwiOTc0MlwiOiBcInBob25lO1wiLFxuICAgIFwiOTc5MlwiOiBcImZlbWFsZTtcIixcbiAgICBcIjk3OTRcIjogXCJtYWxlO1wiLFxuICAgIFwiOTgyNFwiOiBcInNwYWRlc3VpdDtcIixcbiAgICBcIjk4MjdcIjogXCJjbHVic3VpdDtcIixcbiAgICBcIjk4MjlcIjogXCJoZWFydHN1aXQ7XCIsXG4gICAgXCI5ODMwXCI6IFwiZGlhbXM7XCIsXG4gICAgXCI5ODM0XCI6IFwic3VuZztcIixcbiAgICBcIjk4MzdcIjogXCJmbGF0O1wiLFxuICAgIFwiOTgzOFwiOiBcIm5hdHVyYWw7XCIsXG4gICAgXCI5ODM5XCI6IFwic2hhcnA7XCIsXG4gICAgXCIxMDAwM1wiOiBcImNoZWNrbWFyaztcIixcbiAgICBcIjEwMDA3XCI6IFwiY3Jvc3M7XCIsXG4gICAgXCIxMDAxNlwiOiBcIm1hbHRlc2U7XCIsXG4gICAgXCIxMDAzOFwiOiBcInNleHQ7XCIsXG4gICAgXCIxMDA3MlwiOiBcIlZlcnRpY2FsU2VwYXJhdG9yO1wiLFxuICAgIFwiMTAwOThcIjogXCJsYmJyaztcIixcbiAgICBcIjEwMDk5XCI6IFwicmJicms7XCIsXG4gICAgXCIxMDE4NFwiOiBcImJzb2xoc3ViO1wiLFxuICAgIFwiMTAxODVcIjogXCJzdXBoc29sO1wiLFxuICAgIFwiMTAyMTRcIjogXCJsb2JyaztcIixcbiAgICBcIjEwMjE1XCI6IFwicm9icms7XCIsXG4gICAgXCIxMDIxNlwiOiBcIkxlZnRBbmdsZUJyYWNrZXQ7XCIsXG4gICAgXCIxMDIxN1wiOiBcIlJpZ2h0QW5nbGVCcmFja2V0O1wiLFxuICAgIFwiMTAyMThcIjogXCJMYW5nO1wiLFxuICAgIFwiMTAyMTlcIjogXCJSYW5nO1wiLFxuICAgIFwiMTAyMjBcIjogXCJsb2FuZztcIixcbiAgICBcIjEwMjIxXCI6IFwicm9hbmc7XCIsXG4gICAgXCIxMDIyOVwiOiBcInhsYXJyO1wiLFxuICAgIFwiMTAyMzBcIjogXCJ4cmFycjtcIixcbiAgICBcIjEwMjMxXCI6IFwieGhhcnI7XCIsXG4gICAgXCIxMDIzMlwiOiBcInhsQXJyO1wiLFxuICAgIFwiMTAyMzNcIjogXCJ4ckFycjtcIixcbiAgICBcIjEwMjM0XCI6IFwieGhBcnI7XCIsXG4gICAgXCIxMDIzNlwiOiBcInhtYXA7XCIsXG4gICAgXCIxMDIzOVwiOiBcImR6aWdyYXJyO1wiLFxuICAgIFwiMTA0OThcIjogXCJudmxBcnI7XCIsXG4gICAgXCIxMDQ5OVwiOiBcIm52ckFycjtcIixcbiAgICBcIjEwNTAwXCI6IFwibnZIYXJyO1wiLFxuICAgIFwiMTA1MDFcIjogXCJNYXA7XCIsXG4gICAgXCIxMDUwOFwiOiBcImxiYXJyO1wiLFxuICAgIFwiMTA1MDlcIjogXCJyYmFycjtcIixcbiAgICBcIjEwNTEwXCI6IFwibEJhcnI7XCIsXG4gICAgXCIxMDUxMVwiOiBcInJCYXJyO1wiLFxuICAgIFwiMTA1MTJcIjogXCJSQmFycjtcIixcbiAgICBcIjEwNTEzXCI6IFwiRERvdHJhaGQ7XCIsXG4gICAgXCIxMDUxNFwiOiBcIlVwQXJyb3dCYXI7XCIsXG4gICAgXCIxMDUxNVwiOiBcIkRvd25BcnJvd0JhcjtcIixcbiAgICBcIjEwNTE4XCI6IFwiUmFycnRsO1wiLFxuICAgIFwiMTA1MjFcIjogXCJsYXRhaWw7XCIsXG4gICAgXCIxMDUyMlwiOiBcInJhdGFpbDtcIixcbiAgICBcIjEwNTIzXCI6IFwibEF0YWlsO1wiLFxuICAgIFwiMTA1MjRcIjogXCJyQXRhaWw7XCIsXG4gICAgXCIxMDUyNVwiOiBcImxhcnJmcztcIixcbiAgICBcIjEwNTI2XCI6IFwicmFycmZzO1wiLFxuICAgIFwiMTA1MjdcIjogXCJsYXJyYmZzO1wiLFxuICAgIFwiMTA1MjhcIjogXCJyYXJyYmZzO1wiLFxuICAgIFwiMTA1MzFcIjogXCJud2FyaGs7XCIsXG4gICAgXCIxMDUzMlwiOiBcIm5lYXJoaztcIixcbiAgICBcIjEwNTMzXCI6IFwic2VhcmhrO1wiLFxuICAgIFwiMTA1MzRcIjogXCJzd2FyaGs7XCIsXG4gICAgXCIxMDUzNVwiOiBcIm53bmVhcjtcIixcbiAgICBcIjEwNTM2XCI6IFwidG9lYTtcIixcbiAgICBcIjEwNTM3XCI6IFwidG9zYTtcIixcbiAgICBcIjEwNTM4XCI6IFwic3dud2FyO1wiLFxuICAgIFwiMTA1NDdcIjogXCJyYXJyYztcIixcbiAgICBcIjEwNTQ5XCI6IFwiY3VkYXJycjtcIixcbiAgICBcIjEwNTUwXCI6IFwibGRjYTtcIixcbiAgICBcIjEwNTUxXCI6IFwicmRjYTtcIixcbiAgICBcIjEwNTUyXCI6IFwiY3VkYXJybDtcIixcbiAgICBcIjEwNTUzXCI6IFwibGFycnBsO1wiLFxuICAgIFwiMTA1NTZcIjogXCJjdXJhcnJtO1wiLFxuICAgIFwiMTA1NTdcIjogXCJjdWxhcnJwO1wiLFxuICAgIFwiMTA1NjVcIjogXCJyYXJycGw7XCIsXG4gICAgXCIxMDU2OFwiOiBcImhhcnJjaXI7XCIsXG4gICAgXCIxMDU2OVwiOiBcIlVhcnJvY2lyO1wiLFxuICAgIFwiMTA1NzBcIjogXCJsdXJkc2hhcjtcIixcbiAgICBcIjEwNTcxXCI6IFwibGRydXNoYXI7XCIsXG4gICAgXCIxMDU3NFwiOiBcIkxlZnRSaWdodFZlY3RvcjtcIixcbiAgICBcIjEwNTc1XCI6IFwiUmlnaHRVcERvd25WZWN0b3I7XCIsXG4gICAgXCIxMDU3NlwiOiBcIkRvd25MZWZ0UmlnaHRWZWN0b3I7XCIsXG4gICAgXCIxMDU3N1wiOiBcIkxlZnRVcERvd25WZWN0b3I7XCIsXG4gICAgXCIxMDU3OFwiOiBcIkxlZnRWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU3OVwiOiBcIlJpZ2h0VmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODBcIjogXCJSaWdodFVwVmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODFcIjogXCJSaWdodERvd25WZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4MlwiOiBcIkRvd25MZWZ0VmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODNcIjogXCJEb3duUmlnaHRWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4NFwiOiBcIkxlZnRVcFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTg1XCI6IFwiTGVmdERvd25WZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4NlwiOiBcIkxlZnRUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU4N1wiOiBcIlJpZ2h0VGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1ODhcIjogXCJSaWdodFVwVGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1ODlcIjogXCJSaWdodERvd25UZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5MFwiOiBcIkRvd25MZWZ0VGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1OTFcIjogXCJEb3duUmlnaHRUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5MlwiOiBcIkxlZnRVcFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTkzXCI6IFwiTGVmdERvd25UZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5NFwiOiBcImxIYXI7XCIsXG4gICAgXCIxMDU5NVwiOiBcInVIYXI7XCIsXG4gICAgXCIxMDU5NlwiOiBcInJIYXI7XCIsXG4gICAgXCIxMDU5N1wiOiBcImRIYXI7XCIsXG4gICAgXCIxMDU5OFwiOiBcImx1cnVoYXI7XCIsXG4gICAgXCIxMDU5OVwiOiBcImxkcmRoYXI7XCIsXG4gICAgXCIxMDYwMFwiOiBcInJ1bHVoYXI7XCIsXG4gICAgXCIxMDYwMVwiOiBcInJkbGRoYXI7XCIsXG4gICAgXCIxMDYwMlwiOiBcImxoYXJ1bDtcIixcbiAgICBcIjEwNjAzXCI6IFwibGxoYXJkO1wiLFxuICAgIFwiMTA2MDRcIjogXCJyaGFydWw7XCIsXG4gICAgXCIxMDYwNVwiOiBcImxyaGFyZDtcIixcbiAgICBcIjEwNjA2XCI6IFwiVXBFcXVpbGlicml1bTtcIixcbiAgICBcIjEwNjA3XCI6IFwiUmV2ZXJzZVVwRXF1aWxpYnJpdW07XCIsXG4gICAgXCIxMDYwOFwiOiBcIlJvdW5kSW1wbGllcztcIixcbiAgICBcIjEwNjA5XCI6IFwiZXJhcnI7XCIsXG4gICAgXCIxMDYxMFwiOiBcInNpbXJhcnI7XCIsXG4gICAgXCIxMDYxMVwiOiBcImxhcnJzaW07XCIsXG4gICAgXCIxMDYxMlwiOiBcInJhcnJzaW07XCIsXG4gICAgXCIxMDYxM1wiOiBcInJhcnJhcDtcIixcbiAgICBcIjEwNjE0XCI6IFwibHRsYXJyO1wiLFxuICAgIFwiMTA2MTZcIjogXCJndHJhcnI7XCIsXG4gICAgXCIxMDYxN1wiOiBcInN1YnJhcnI7XCIsXG4gICAgXCIxMDYxOVwiOiBcInN1cGxhcnI7XCIsXG4gICAgXCIxMDYyMFwiOiBcImxmaXNodDtcIixcbiAgICBcIjEwNjIxXCI6IFwicmZpc2h0O1wiLFxuICAgIFwiMTA2MjJcIjogXCJ1ZmlzaHQ7XCIsXG4gICAgXCIxMDYyM1wiOiBcImRmaXNodDtcIixcbiAgICBcIjEwNjI5XCI6IFwibG9wYXI7XCIsXG4gICAgXCIxMDYzMFwiOiBcInJvcGFyO1wiLFxuICAgIFwiMTA2MzVcIjogXCJsYnJrZTtcIixcbiAgICBcIjEwNjM2XCI6IFwicmJya2U7XCIsXG4gICAgXCIxMDYzN1wiOiBcImxicmtzbHU7XCIsXG4gICAgXCIxMDYzOFwiOiBcInJicmtzbGQ7XCIsXG4gICAgXCIxMDYzOVwiOiBcImxicmtzbGQ7XCIsXG4gICAgXCIxMDY0MFwiOiBcInJicmtzbHU7XCIsXG4gICAgXCIxMDY0MVwiOiBcImxhbmdkO1wiLFxuICAgIFwiMTA2NDJcIjogXCJyYW5nZDtcIixcbiAgICBcIjEwNjQzXCI6IFwibHBhcmx0O1wiLFxuICAgIFwiMTA2NDRcIjogXCJycGFyZ3Q7XCIsXG4gICAgXCIxMDY0NVwiOiBcImd0bFBhcjtcIixcbiAgICBcIjEwNjQ2XCI6IFwibHRyUGFyO1wiLFxuICAgIFwiMTA2NTBcIjogXCJ2emlnemFnO1wiLFxuICAgIFwiMTA2NTJcIjogXCJ2YW5ncnQ7XCIsXG4gICAgXCIxMDY1M1wiOiBcImFuZ3J0dmJkO1wiLFxuICAgIFwiMTA2NjBcIjogXCJhbmdlO1wiLFxuICAgIFwiMTA2NjFcIjogXCJyYW5nZTtcIixcbiAgICBcIjEwNjYyXCI6IFwiZHdhbmdsZTtcIixcbiAgICBcIjEwNjYzXCI6IFwidXdhbmdsZTtcIixcbiAgICBcIjEwNjY0XCI6IFwiYW5nbXNkYWE7XCIsXG4gICAgXCIxMDY2NVwiOiBcImFuZ21zZGFiO1wiLFxuICAgIFwiMTA2NjZcIjogXCJhbmdtc2RhYztcIixcbiAgICBcIjEwNjY3XCI6IFwiYW5nbXNkYWQ7XCIsXG4gICAgXCIxMDY2OFwiOiBcImFuZ21zZGFlO1wiLFxuICAgIFwiMTA2NjlcIjogXCJhbmdtc2RhZjtcIixcbiAgICBcIjEwNjcwXCI6IFwiYW5nbXNkYWc7XCIsXG4gICAgXCIxMDY3MVwiOiBcImFuZ21zZGFoO1wiLFxuICAgIFwiMTA2NzJcIjogXCJiZW1wdHl2O1wiLFxuICAgIFwiMTA2NzNcIjogXCJkZW1wdHl2O1wiLFxuICAgIFwiMTA2NzRcIjogXCJjZW1wdHl2O1wiLFxuICAgIFwiMTA2NzVcIjogXCJyYWVtcHR5djtcIixcbiAgICBcIjEwNjc2XCI6IFwibGFlbXB0eXY7XCIsXG4gICAgXCIxMDY3N1wiOiBcIm9oYmFyO1wiLFxuICAgIFwiMTA2NzhcIjogXCJvbWlkO1wiLFxuICAgIFwiMTA2NzlcIjogXCJvcGFyO1wiLFxuICAgIFwiMTA2ODFcIjogXCJvcGVycDtcIixcbiAgICBcIjEwNjgzXCI6IFwib2xjcm9zcztcIixcbiAgICBcIjEwNjg0XCI6IFwib2Rzb2xkO1wiLFxuICAgIFwiMTA2ODZcIjogXCJvbGNpcjtcIixcbiAgICBcIjEwNjg3XCI6IFwib2ZjaXI7XCIsXG4gICAgXCIxMDY4OFwiOiBcIm9sdDtcIixcbiAgICBcIjEwNjg5XCI6IFwib2d0O1wiLFxuICAgIFwiMTA2OTBcIjogXCJjaXJzY2lyO1wiLFxuICAgIFwiMTA2OTFcIjogXCJjaXJFO1wiLFxuICAgIFwiMTA2OTJcIjogXCJzb2xiO1wiLFxuICAgIFwiMTA2OTNcIjogXCJic29sYjtcIixcbiAgICBcIjEwNjk3XCI6IFwiYm94Ym94O1wiLFxuICAgIFwiMTA3MDFcIjogXCJ0cmlzYjtcIixcbiAgICBcIjEwNzAyXCI6IFwicnRyaWx0cmk7XCIsXG4gICAgXCIxMDcwM1wiOiBcIkxlZnRUcmlhbmdsZUJhcjtcIixcbiAgICBcIjEwNzA0XCI6IFwiUmlnaHRUcmlhbmdsZUJhcjtcIixcbiAgICBcIjEwNzE2XCI6IFwiaWluZmluO1wiLFxuICAgIFwiMTA3MTdcIjogXCJpbmZpbnRpZTtcIixcbiAgICBcIjEwNzE4XCI6IFwibnZpbmZpbjtcIixcbiAgICBcIjEwNzIzXCI6IFwiZXBhcnNsO1wiLFxuICAgIFwiMTA3MjRcIjogXCJzbWVwYXJzbDtcIixcbiAgICBcIjEwNzI1XCI6IFwiZXF2cGFyc2w7XCIsXG4gICAgXCIxMDczMVwiOiBcImxvemY7XCIsXG4gICAgXCIxMDc0MFwiOiBcIlJ1bGVEZWxheWVkO1wiLFxuICAgIFwiMTA3NDJcIjogXCJkc29sO1wiLFxuICAgIFwiMTA3NTJcIjogXCJ4b2RvdDtcIixcbiAgICBcIjEwNzUzXCI6IFwieG9wbHVzO1wiLFxuICAgIFwiMTA3NTRcIjogXCJ4b3RpbWU7XCIsXG4gICAgXCIxMDc1NlwiOiBcInh1cGx1cztcIixcbiAgICBcIjEwNzU4XCI6IFwieHNxY3VwO1wiLFxuICAgIFwiMTA3NjRcIjogXCJxaW50O1wiLFxuICAgIFwiMTA3NjVcIjogXCJmcGFydGludDtcIixcbiAgICBcIjEwNzY4XCI6IFwiY2lyZm5pbnQ7XCIsXG4gICAgXCIxMDc2OVwiOiBcImF3aW50O1wiLFxuICAgIFwiMTA3NzBcIjogXCJycHBvbGludDtcIixcbiAgICBcIjEwNzcxXCI6IFwic2Nwb2xpbnQ7XCIsXG4gICAgXCIxMDc3MlwiOiBcIm5wb2xpbnQ7XCIsXG4gICAgXCIxMDc3M1wiOiBcInBvaW50aW50O1wiLFxuICAgIFwiMTA3NzRcIjogXCJxdWF0aW50O1wiLFxuICAgIFwiMTA3NzVcIjogXCJpbnRsYXJoaztcIixcbiAgICBcIjEwNzg2XCI6IFwicGx1c2NpcjtcIixcbiAgICBcIjEwNzg3XCI6IFwicGx1c2FjaXI7XCIsXG4gICAgXCIxMDc4OFwiOiBcInNpbXBsdXM7XCIsXG4gICAgXCIxMDc4OVwiOiBcInBsdXNkdTtcIixcbiAgICBcIjEwNzkwXCI6IFwicGx1c3NpbTtcIixcbiAgICBcIjEwNzkxXCI6IFwicGx1c3R3bztcIixcbiAgICBcIjEwNzkzXCI6IFwibWNvbW1hO1wiLFxuICAgIFwiMTA3OTRcIjogXCJtaW51c2R1O1wiLFxuICAgIFwiMTA3OTdcIjogXCJsb3BsdXM7XCIsXG4gICAgXCIxMDc5OFwiOiBcInJvcGx1cztcIixcbiAgICBcIjEwNzk5XCI6IFwiQ3Jvc3M7XCIsXG4gICAgXCIxMDgwMFwiOiBcInRpbWVzZDtcIixcbiAgICBcIjEwODAxXCI6IFwidGltZXNiYXI7XCIsXG4gICAgXCIxMDgwM1wiOiBcInNtYXNocDtcIixcbiAgICBcIjEwODA0XCI6IFwibG90aW1lcztcIixcbiAgICBcIjEwODA1XCI6IFwicm90aW1lcztcIixcbiAgICBcIjEwODA2XCI6IFwib3RpbWVzYXM7XCIsXG4gICAgXCIxMDgwN1wiOiBcIk90aW1lcztcIixcbiAgICBcIjEwODA4XCI6IFwib2RpdjtcIixcbiAgICBcIjEwODA5XCI6IFwidHJpcGx1cztcIixcbiAgICBcIjEwODEwXCI6IFwidHJpbWludXM7XCIsXG4gICAgXCIxMDgxMVwiOiBcInRyaXRpbWU7XCIsXG4gICAgXCIxMDgxMlwiOiBcImlwcm9kO1wiLFxuICAgIFwiMTA4MTVcIjogXCJhbWFsZztcIixcbiAgICBcIjEwODE2XCI6IFwiY2FwZG90O1wiLFxuICAgIFwiMTA4MThcIjogXCJuY3VwO1wiLFxuICAgIFwiMTA4MTlcIjogXCJuY2FwO1wiLFxuICAgIFwiMTA4MjBcIjogXCJjYXBhbmQ7XCIsXG4gICAgXCIxMDgyMVwiOiBcImN1cG9yO1wiLFxuICAgIFwiMTA4MjJcIjogXCJjdXBjYXA7XCIsXG4gICAgXCIxMDgyM1wiOiBcImNhcGN1cDtcIixcbiAgICBcIjEwODI0XCI6IFwiY3VwYnJjYXA7XCIsXG4gICAgXCIxMDgyNVwiOiBcImNhcGJyY3VwO1wiLFxuICAgIFwiMTA4MjZcIjogXCJjdXBjdXA7XCIsXG4gICAgXCIxMDgyN1wiOiBcImNhcGNhcDtcIixcbiAgICBcIjEwODI4XCI6IFwiY2N1cHM7XCIsXG4gICAgXCIxMDgyOVwiOiBcImNjYXBzO1wiLFxuICAgIFwiMTA4MzJcIjogXCJjY3Vwc3NtO1wiLFxuICAgIFwiMTA4MzVcIjogXCJBbmQ7XCIsXG4gICAgXCIxMDgzNlwiOiBcIk9yO1wiLFxuICAgIFwiMTA4MzdcIjogXCJhbmRhbmQ7XCIsXG4gICAgXCIxMDgzOFwiOiBcIm9yb3I7XCIsXG4gICAgXCIxMDgzOVwiOiBcIm9yc2xvcGU7XCIsXG4gICAgXCIxMDg0MFwiOiBcImFuZHNsb3BlO1wiLFxuICAgIFwiMTA4NDJcIjogXCJhbmR2O1wiLFxuICAgIFwiMTA4NDNcIjogXCJvcnY7XCIsXG4gICAgXCIxMDg0NFwiOiBcImFuZGQ7XCIsXG4gICAgXCIxMDg0NVwiOiBcIm9yZDtcIixcbiAgICBcIjEwODQ3XCI6IFwid2VkYmFyO1wiLFxuICAgIFwiMTA4NTRcIjogXCJzZG90ZTtcIixcbiAgICBcIjEwODU4XCI6IFwic2ltZG90O1wiLFxuICAgIFwiMTA4NjFcIjogXCJjb25nZG90O1wiLFxuICAgIFwiMTA4NjJcIjogXCJlYXN0ZXI7XCIsXG4gICAgXCIxMDg2M1wiOiBcImFwYWNpcjtcIixcbiAgICBcIjEwODY0XCI6IFwiYXBFO1wiLFxuICAgIFwiMTA4NjVcIjogXCJlcGx1cztcIixcbiAgICBcIjEwODY2XCI6IFwicGx1c2U7XCIsXG4gICAgXCIxMDg2N1wiOiBcIkVzaW07XCIsXG4gICAgXCIxMDg2OFwiOiBcIkNvbG9uZTtcIixcbiAgICBcIjEwODY5XCI6IFwiRXF1YWw7XCIsXG4gICAgXCIxMDg3MVwiOiBcImVERG90O1wiLFxuICAgIFwiMTA4NzJcIjogXCJlcXVpdkREO1wiLFxuICAgIFwiMTA4NzNcIjogXCJsdGNpcjtcIixcbiAgICBcIjEwODc0XCI6IFwiZ3RjaXI7XCIsXG4gICAgXCIxMDg3NVwiOiBcImx0cXVlc3Q7XCIsXG4gICAgXCIxMDg3NlwiOiBcImd0cXVlc3Q7XCIsXG4gICAgXCIxMDg3N1wiOiBcIkxlc3NTbGFudEVxdWFsO1wiLFxuICAgIFwiMTA4NzhcIjogXCJHcmVhdGVyU2xhbnRFcXVhbDtcIixcbiAgICBcIjEwODc5XCI6IFwibGVzZG90O1wiLFxuICAgIFwiMTA4ODBcIjogXCJnZXNkb3Q7XCIsXG4gICAgXCIxMDg4MVwiOiBcImxlc2RvdG87XCIsXG4gICAgXCIxMDg4MlwiOiBcImdlc2RvdG87XCIsXG4gICAgXCIxMDg4M1wiOiBcImxlc2RvdG9yO1wiLFxuICAgIFwiMTA4ODRcIjogXCJnZXNkb3RvbDtcIixcbiAgICBcIjEwODg1XCI6IFwibGVzc2FwcHJveDtcIixcbiAgICBcIjEwODg2XCI6IFwiZ3RyYXBwcm94O1wiLFxuICAgIFwiMTA4ODdcIjogXCJsbmVxO1wiLFxuICAgIFwiMTA4ODhcIjogXCJnbmVxO1wiLFxuICAgIFwiMTA4ODlcIjogXCJsbmFwcHJveDtcIixcbiAgICBcIjEwODkwXCI6IFwiZ25hcHByb3g7XCIsXG4gICAgXCIxMDg5MVwiOiBcImxlc3NlcXFndHI7XCIsXG4gICAgXCIxMDg5MlwiOiBcImd0cmVxcWxlc3M7XCIsXG4gICAgXCIxMDg5M1wiOiBcImxzaW1lO1wiLFxuICAgIFwiMTA4OTRcIjogXCJnc2ltZTtcIixcbiAgICBcIjEwODk1XCI6IFwibHNpbWc7XCIsXG4gICAgXCIxMDg5NlwiOiBcImdzaW1sO1wiLFxuICAgIFwiMTA4OTdcIjogXCJsZ0U7XCIsXG4gICAgXCIxMDg5OFwiOiBcImdsRTtcIixcbiAgICBcIjEwODk5XCI6IFwibGVzZ2VzO1wiLFxuICAgIFwiMTA5MDBcIjogXCJnZXNsZXM7XCIsXG4gICAgXCIxMDkwMVwiOiBcImVxc2xhbnRsZXNzO1wiLFxuICAgIFwiMTA5MDJcIjogXCJlcXNsYW50Z3RyO1wiLFxuICAgIFwiMTA5MDNcIjogXCJlbHNkb3Q7XCIsXG4gICAgXCIxMDkwNFwiOiBcImVnc2RvdDtcIixcbiAgICBcIjEwOTA1XCI6IFwiZWw7XCIsXG4gICAgXCIxMDkwNlwiOiBcImVnO1wiLFxuICAgIFwiMTA5MDlcIjogXCJzaW1sO1wiLFxuICAgIFwiMTA5MTBcIjogXCJzaW1nO1wiLFxuICAgIFwiMTA5MTFcIjogXCJzaW1sRTtcIixcbiAgICBcIjEwOTEyXCI6IFwic2ltZ0U7XCIsXG4gICAgXCIxMDkxM1wiOiBcIkxlc3NMZXNzO1wiLFxuICAgIFwiMTA5MTRcIjogXCJHcmVhdGVyR3JlYXRlcjtcIixcbiAgICBcIjEwOTE2XCI6IFwiZ2xqO1wiLFxuICAgIFwiMTA5MTdcIjogXCJnbGE7XCIsXG4gICAgXCIxMDkxOFwiOiBcImx0Y2M7XCIsXG4gICAgXCIxMDkxOVwiOiBcImd0Y2M7XCIsXG4gICAgXCIxMDkyMFwiOiBcImxlc2NjO1wiLFxuICAgIFwiMTA5MjFcIjogXCJnZXNjYztcIixcbiAgICBcIjEwOTIyXCI6IFwic210O1wiLFxuICAgIFwiMTA5MjNcIjogXCJsYXQ7XCIsXG4gICAgXCIxMDkyNFwiOiBcInNtdGU7XCIsXG4gICAgXCIxMDkyNVwiOiBcImxhdGU7XCIsXG4gICAgXCIxMDkyNlwiOiBcImJ1bXBFO1wiLFxuICAgIFwiMTA5MjdcIjogXCJwcmVjZXE7XCIsXG4gICAgXCIxMDkyOFwiOiBcInN1Y2NlcTtcIixcbiAgICBcIjEwOTMxXCI6IFwicHJFO1wiLFxuICAgIFwiMTA5MzJcIjogXCJzY0U7XCIsXG4gICAgXCIxMDkzM1wiOiBcInBybkU7XCIsXG4gICAgXCIxMDkzNFwiOiBcInN1Y2NuZXFxO1wiLFxuICAgIFwiMTA5MzVcIjogXCJwcmVjYXBwcm94O1wiLFxuICAgIFwiMTA5MzZcIjogXCJzdWNjYXBwcm94O1wiLFxuICAgIFwiMTA5MzdcIjogXCJwcm5hcDtcIixcbiAgICBcIjEwOTM4XCI6IFwic3VjY25hcHByb3g7XCIsXG4gICAgXCIxMDkzOVwiOiBcIlByO1wiLFxuICAgIFwiMTA5NDBcIjogXCJTYztcIixcbiAgICBcIjEwOTQxXCI6IFwic3ViZG90O1wiLFxuICAgIFwiMTA5NDJcIjogXCJzdXBkb3Q7XCIsXG4gICAgXCIxMDk0M1wiOiBcInN1YnBsdXM7XCIsXG4gICAgXCIxMDk0NFwiOiBcInN1cHBsdXM7XCIsXG4gICAgXCIxMDk0NVwiOiBcInN1Ym11bHQ7XCIsXG4gICAgXCIxMDk0NlwiOiBcInN1cG11bHQ7XCIsXG4gICAgXCIxMDk0N1wiOiBcInN1YmVkb3Q7XCIsXG4gICAgXCIxMDk0OFwiOiBcInN1cGVkb3Q7XCIsXG4gICAgXCIxMDk0OVwiOiBcInN1YnNldGVxcTtcIixcbiAgICBcIjEwOTUwXCI6IFwic3Vwc2V0ZXFxO1wiLFxuICAgIFwiMTA5NTFcIjogXCJzdWJzaW07XCIsXG4gICAgXCIxMDk1MlwiOiBcInN1cHNpbTtcIixcbiAgICBcIjEwOTU1XCI6IFwic3Vic2V0bmVxcTtcIixcbiAgICBcIjEwOTU2XCI6IFwic3Vwc2V0bmVxcTtcIixcbiAgICBcIjEwOTU5XCI6IFwiY3N1YjtcIixcbiAgICBcIjEwOTYwXCI6IFwiY3N1cDtcIixcbiAgICBcIjEwOTYxXCI6IFwiY3N1YmU7XCIsXG4gICAgXCIxMDk2MlwiOiBcImNzdXBlO1wiLFxuICAgIFwiMTA5NjNcIjogXCJzdWJzdXA7XCIsXG4gICAgXCIxMDk2NFwiOiBcInN1cHN1YjtcIixcbiAgICBcIjEwOTY1XCI6IFwic3Vic3ViO1wiLFxuICAgIFwiMTA5NjZcIjogXCJzdXBzdXA7XCIsXG4gICAgXCIxMDk2N1wiOiBcInN1cGhzdWI7XCIsXG4gICAgXCIxMDk2OFwiOiBcInN1cGRzdWI7XCIsXG4gICAgXCIxMDk2OVwiOiBcImZvcmt2O1wiLFxuICAgIFwiMTA5NzBcIjogXCJ0b3Bmb3JrO1wiLFxuICAgIFwiMTA5NzFcIjogXCJtbGNwO1wiLFxuICAgIFwiMTA5ODBcIjogXCJEb3VibGVMZWZ0VGVlO1wiLFxuICAgIFwiMTA5ODJcIjogXCJWZGFzaGw7XCIsXG4gICAgXCIxMDk4M1wiOiBcIkJhcnY7XCIsXG4gICAgXCIxMDk4NFwiOiBcInZCYXI7XCIsXG4gICAgXCIxMDk4NVwiOiBcInZCYXJ2O1wiLFxuICAgIFwiMTA5ODdcIjogXCJWYmFyO1wiLFxuICAgIFwiMTA5ODhcIjogXCJOb3Q7XCIsXG4gICAgXCIxMDk4OVwiOiBcImJOb3Q7XCIsXG4gICAgXCIxMDk5MFwiOiBcInJubWlkO1wiLFxuICAgIFwiMTA5OTFcIjogXCJjaXJtaWQ7XCIsXG4gICAgXCIxMDk5MlwiOiBcIm1pZGNpcjtcIixcbiAgICBcIjEwOTkzXCI6IFwidG9wY2lyO1wiLFxuICAgIFwiMTA5OTRcIjogXCJuaHBhcjtcIixcbiAgICBcIjEwOTk1XCI6IFwicGFyc2ltO1wiLFxuICAgIFwiMTEwMDVcIjogXCJwYXJzbDtcIixcbiAgICBcIjY0MjU2XCI6IFwiZmZsaWc7XCIsXG4gICAgXCI2NDI1N1wiOiBcImZpbGlnO1wiLFxuICAgIFwiNjQyNThcIjogXCJmbGxpZztcIixcbiAgICBcIjY0MjU5XCI6IFwiZmZpbGlnO1wiLFxuICAgIFwiNjQyNjBcIjogXCJmZmxsaWc7XCJcbn0iLCIvKlxuXG5cdEhhc2hpZHNcblx0aHR0cDovL2hhc2hpZHMub3JnL25vZGUtanNcblx0KGMpIDIwMTMgSXZhbiBBa2ltb3ZcblxuXHRodHRwczovL2dpdGh1Yi5jb20vaXZhbmFraW1vdi9oYXNoaWRzLm5vZGUuanNcblx0aGFzaGlkcyBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKi9cblxuLypqc2xpbnQgbm9kZTogdHJ1ZSwgd2hpdGU6IHRydWUsIHBsdXNwbHVzOiB0cnVlLCBub21lbjogdHJ1ZSAqL1xuXG5cInVzZSBzdHJpY3RcIjtcblxuZnVuY3Rpb24gSGFzaGlkcyhzYWx0LCBtaW5IYXNoTGVuZ3RoLCBhbHBoYWJldCkge1xuXG5cdHZhciB1bmlxdWVBbHBoYWJldCwgaSwgaiwgbGVuLCBzZXBzTGVuZ3RoLCBkaWZmLCBndWFyZENvdW50O1xuXG5cdGlmICghKHRoaXMgaW5zdGFuY2VvZiBIYXNoaWRzKSkge1xuXHRcdHJldHVybiBuZXcgSGFzaGlkcyhzYWx0LCBtaW5IYXNoTGVuZ3RoLCBhbHBoYWJldCk7XG5cdH1cblxuXHR0aGlzLnZlcnNpb24gPSBcIjEuMC4xXCI7XG5cblx0LyogaW50ZXJuYWwgc2V0dGluZ3MgKi9cblxuXHR0aGlzLm1pbkFscGhhYmV0TGVuZ3RoID0gMTY7XG5cdHRoaXMuc2VwRGl2ID0gMy41O1xuXHR0aGlzLmd1YXJkRGl2ID0gMTI7XG5cblx0LyogZXJyb3IgbWVzc2FnZXMgKi9cblxuXHR0aGlzLmVycm9yQWxwaGFiZXRMZW5ndGggPSBcImVycm9yOiBhbHBoYWJldCBtdXN0IGNvbnRhaW4gYXQgbGVhc3QgWCB1bmlxdWUgY2hhcmFjdGVyc1wiO1xuXHR0aGlzLmVycm9yQWxwaGFiZXRTcGFjZSA9IFwiZXJyb3I6IGFscGhhYmV0IGNhbm5vdCBjb250YWluIHNwYWNlc1wiO1xuXG5cdC8qIGFscGhhYmV0IHZhcnMgKi9cblxuXHR0aGlzLmFscGhhYmV0ID0gXCJhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaMTIzNDU2Nzg5MFwiO1xuXHR0aGlzLnNlcHMgPSBcImNmaGlzdHVDRkhJU1RVXCI7XG5cdHRoaXMubWluSGFzaExlbmd0aCA9IHBhcnNlSW50KG1pbkhhc2hMZW5ndGgsIDEwKSA+IDAgPyBtaW5IYXNoTGVuZ3RoIDogMDtcblx0dGhpcy5zYWx0ID0gKHR5cGVvZiBzYWx0ID09PSBcInN0cmluZ1wiKSA/IHNhbHQgOiBcIlwiO1xuXG5cdGlmICh0eXBlb2YgYWxwaGFiZXQgPT09IFwic3RyaW5nXCIpIHtcblx0XHR0aGlzLmFscGhhYmV0ID0gYWxwaGFiZXQ7XG5cdH1cblxuXHRmb3IgKHVuaXF1ZUFscGhhYmV0ID0gXCJcIiwgaSA9IDAsIGxlbiA9IHRoaXMuYWxwaGFiZXQubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXHRcdGlmICh1bmlxdWVBbHBoYWJldC5pbmRleE9mKHRoaXMuYWxwaGFiZXRbaV0pID09PSAtMSkge1xuXHRcdFx0dW5pcXVlQWxwaGFiZXQgKz0gdGhpcy5hbHBoYWJldFtpXTtcblx0XHR9XG5cdH1cblxuXHR0aGlzLmFscGhhYmV0ID0gdW5pcXVlQWxwaGFiZXQ7XG5cblx0aWYgKHRoaXMuYWxwaGFiZXQubGVuZ3RoIDwgdGhpcy5taW5BbHBoYWJldExlbmd0aCkge1xuXHRcdHRocm93IHRoaXMuZXJyb3JBbHBoYWJldExlbmd0aC5yZXBsYWNlKFwiWFwiLCB0aGlzLm1pbkFscGhhYmV0TGVuZ3RoKTtcblx0fVxuXG5cdGlmICh0aGlzLmFscGhhYmV0LnNlYXJjaChcIiBcIikgIT09IC0xKSB7XG5cdFx0dGhyb3cgdGhpcy5lcnJvckFscGhhYmV0U3BhY2U7XG5cdH1cblxuXHQvKiBzZXBzIHNob3VsZCBjb250YWluIG9ubHkgY2hhcmFjdGVycyBwcmVzZW50IGluIGFscGhhYmV0OyBhbHBoYWJldCBzaG91bGQgbm90IGNvbnRhaW5zIHNlcHMgKi9cblxuXHRmb3IgKGkgPSAwLCBsZW4gPSB0aGlzLnNlcHMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXG5cdFx0aiA9IHRoaXMuYWxwaGFiZXQuaW5kZXhPZih0aGlzLnNlcHNbaV0pO1xuXHRcdGlmIChqID09PSAtMSkge1xuXHRcdFx0dGhpcy5zZXBzID0gdGhpcy5zZXBzLnN1YnN0cigwLCBpKSArIFwiIFwiICsgdGhpcy5zZXBzLnN1YnN0cihpICsgMSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuYWxwaGFiZXQgPSB0aGlzLmFscGhhYmV0LnN1YnN0cigwLCBqKSArIFwiIFwiICsgdGhpcy5hbHBoYWJldC5zdWJzdHIoaiArIDEpO1xuXHRcdH1cblxuXHR9XG5cblx0dGhpcy5hbHBoYWJldCA9IHRoaXMuYWxwaGFiZXQucmVwbGFjZSgvIC9nLCBcIlwiKTtcblxuXHR0aGlzLnNlcHMgPSB0aGlzLnNlcHMucmVwbGFjZSgvIC9nLCBcIlwiKTtcblx0dGhpcy5zZXBzID0gdGhpcy5jb25zaXN0ZW50U2h1ZmZsZSh0aGlzLnNlcHMsIHRoaXMuc2FsdCk7XG5cblx0aWYgKCF0aGlzLnNlcHMubGVuZ3RoIHx8ICh0aGlzLmFscGhhYmV0Lmxlbmd0aCAvIHRoaXMuc2Vwcy5sZW5ndGgpID4gdGhpcy5zZXBEaXYpIHtcblxuXHRcdHNlcHNMZW5ndGggPSBNYXRoLmNlaWwodGhpcy5hbHBoYWJldC5sZW5ndGggLyB0aGlzLnNlcERpdik7XG5cblx0XHRpZiAoc2Vwc0xlbmd0aCA9PT0gMSkge1xuXHRcdFx0c2Vwc0xlbmd0aCsrO1xuXHRcdH1cblxuXHRcdGlmIChzZXBzTGVuZ3RoID4gdGhpcy5zZXBzLmxlbmd0aCkge1xuXG5cdFx0XHRkaWZmID0gc2Vwc0xlbmd0aCAtIHRoaXMuc2Vwcy5sZW5ndGg7XG5cdFx0XHR0aGlzLnNlcHMgKz0gdGhpcy5hbHBoYWJldC5zdWJzdHIoMCwgZGlmZik7XG5cdFx0XHR0aGlzLmFscGhhYmV0ID0gdGhpcy5hbHBoYWJldC5zdWJzdHIoZGlmZik7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXBzID0gdGhpcy5zZXBzLnN1YnN0cigwLCBzZXBzTGVuZ3RoKTtcblx0XHR9XG5cblx0fVxuXG5cdHRoaXMuYWxwaGFiZXQgPSB0aGlzLmNvbnNpc3RlbnRTaHVmZmxlKHRoaXMuYWxwaGFiZXQsIHRoaXMuc2FsdCk7XG5cdGd1YXJkQ291bnQgPSBNYXRoLmNlaWwodGhpcy5hbHBoYWJldC5sZW5ndGggLyB0aGlzLmd1YXJkRGl2KTtcblxuXHRpZiAodGhpcy5hbHBoYWJldC5sZW5ndGggPCAzKSB7XG5cdFx0dGhpcy5ndWFyZHMgPSB0aGlzLnNlcHMuc3Vic3RyKDAsIGd1YXJkQ291bnQpO1xuXHRcdHRoaXMuc2VwcyA9IHRoaXMuc2Vwcy5zdWJzdHIoZ3VhcmRDb3VudCk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5ndWFyZHMgPSB0aGlzLmFscGhhYmV0LnN1YnN0cigwLCBndWFyZENvdW50KTtcblx0XHR0aGlzLmFscGhhYmV0ID0gdGhpcy5hbHBoYWJldC5zdWJzdHIoZ3VhcmRDb3VudCk7XG5cdH1cblxufVxuXG5IYXNoaWRzLnByb3RvdHlwZS5lbmNvZGUgPSBmdW5jdGlvbigpIHtcblxuXHR2YXIgcmV0ID0gXCJcIixcblx0XHRpLCBsZW4sXG5cdFx0bnVtYmVycyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cblx0aWYgKCFudW1iZXJzLmxlbmd0aCkge1xuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRpZiAobnVtYmVyc1swXSBpbnN0YW5jZW9mIEFycmF5KSB7XG5cdFx0bnVtYmVycyA9IG51bWJlcnNbMF07XG5cdH1cblxuXHRmb3IgKGkgPSAwLCBsZW4gPSBudW1iZXJzLmxlbmd0aDsgaSAhPT0gbGVuOyBpKyspIHtcblx0XHRpZiAodHlwZW9mIG51bWJlcnNbaV0gIT09IFwibnVtYmVyXCIgfHwgbnVtYmVyc1tpXSAlIDEgIT09IDAgfHwgbnVtYmVyc1tpXSA8IDApIHtcblx0XHRcdHJldHVybiByZXQ7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRoaXMuX2VuY29kZShudW1iZXJzKTtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuZGVjb2RlID0gZnVuY3Rpb24oaGFzaCkge1xuXG5cdHZhciByZXQgPSBbXTtcblxuXHRpZiAoIWhhc2gubGVuZ3RoIHx8IHR5cGVvZiBoYXNoICE9PSBcInN0cmluZ1wiKSB7XG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdHJldHVybiB0aGlzLl9kZWNvZGUoaGFzaCwgdGhpcy5hbHBoYWJldCk7XG5cbn07XG5cbkhhc2hpZHMucHJvdG90eXBlLmVuY29kZUhleCA9IGZ1bmN0aW9uKHN0cikge1xuXG5cdHZhciBpLCBsZW4sIG51bWJlcnM7XG5cblx0c3RyID0gc3RyLnRvU3RyaW5nKCk7XG5cdGlmICghL15bMC05YS1mQS1GXSskLy50ZXN0KHN0cikpIHtcblx0XHRyZXR1cm4gXCJcIjtcblx0fVxuXG5cdG51bWJlcnMgPSBzdHIubWF0Y2goL1tcXHdcXFddezEsMTJ9L2cpO1xuXG5cdGZvciAoaSA9IDAsIGxlbiA9IG51bWJlcnMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXHRcdG51bWJlcnNbaV0gPSBwYXJzZUludChcIjFcIiArIG51bWJlcnNbaV0sIDE2KTtcblx0fVxuXG5cdHJldHVybiB0aGlzLmVuY29kZS5hcHBseSh0aGlzLCBudW1iZXJzKTtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuZGVjb2RlSGV4ID0gZnVuY3Rpb24oaGFzaCkge1xuXG5cdHZhciByZXQgPSBcIlwiLFxuXHRcdGksIGxlbixcblx0XHRudW1iZXJzID0gdGhpcy5kZWNvZGUoaGFzaCk7XG5cblx0Zm9yIChpID0gMCwgbGVuID0gbnVtYmVycy5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cdFx0cmV0ICs9IChudW1iZXJzW2ldKS50b1N0cmluZygxNikuc3Vic3RyKDEpO1xuXHR9XG5cblx0cmV0dXJuIHJldDtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuX2VuY29kZSA9IGZ1bmN0aW9uKG51bWJlcnMpIHtcblxuXHR2YXIgcmV0LCBsb3R0ZXJ5LCBpLCBsZW4sIG51bWJlciwgYnVmZmVyLCBsYXN0LCBzZXBzSW5kZXgsIGd1YXJkSW5kZXgsIGd1YXJkLCBoYWxmTGVuZ3RoLCBleGNlc3MsXG5cdFx0YWxwaGFiZXQgPSB0aGlzLmFscGhhYmV0LFxuXHRcdG51bWJlcnNTaXplID0gbnVtYmVycy5sZW5ndGgsXG5cdFx0bnVtYmVyc0hhc2hJbnQgPSAwO1xuXG5cdGZvciAoaSA9IDAsIGxlbiA9IG51bWJlcnMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXHRcdG51bWJlcnNIYXNoSW50ICs9IChudW1iZXJzW2ldICUgKGkgKyAxMDApKTtcblx0fVxuXG5cdGxvdHRlcnkgPSByZXQgPSBhbHBoYWJldFtudW1iZXJzSGFzaEludCAlIGFscGhhYmV0Lmxlbmd0aF07XG5cdGZvciAoaSA9IDAsIGxlbiA9IG51bWJlcnMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXG5cdFx0bnVtYmVyID0gbnVtYmVyc1tpXTtcblx0XHRidWZmZXIgPSBsb3R0ZXJ5ICsgdGhpcy5zYWx0ICsgYWxwaGFiZXQ7XG5cblx0XHRhbHBoYWJldCA9IHRoaXMuY29uc2lzdGVudFNodWZmbGUoYWxwaGFiZXQsIGJ1ZmZlci5zdWJzdHIoMCwgYWxwaGFiZXQubGVuZ3RoKSk7XG5cdFx0bGFzdCA9IHRoaXMuaGFzaChudW1iZXIsIGFscGhhYmV0KTtcblxuXHRcdHJldCArPSBsYXN0O1xuXG5cdFx0aWYgKGkgKyAxIDwgbnVtYmVyc1NpemUpIHtcblx0XHRcdG51bWJlciAlPSAobGFzdC5jaGFyQ29kZUF0KDApICsgaSk7XG5cdFx0XHRzZXBzSW5kZXggPSBudW1iZXIgJSB0aGlzLnNlcHMubGVuZ3RoO1xuXHRcdFx0cmV0ICs9IHRoaXMuc2Vwc1tzZXBzSW5kZXhdO1xuXHRcdH1cblxuXHR9XG5cblx0aWYgKHJldC5sZW5ndGggPCB0aGlzLm1pbkhhc2hMZW5ndGgpIHtcblxuXHRcdGd1YXJkSW5kZXggPSAobnVtYmVyc0hhc2hJbnQgKyByZXRbMF0uY2hhckNvZGVBdCgwKSkgJSB0aGlzLmd1YXJkcy5sZW5ndGg7XG5cdFx0Z3VhcmQgPSB0aGlzLmd1YXJkc1tndWFyZEluZGV4XTtcblxuXHRcdHJldCA9IGd1YXJkICsgcmV0O1xuXG5cdFx0aWYgKHJldC5sZW5ndGggPCB0aGlzLm1pbkhhc2hMZW5ndGgpIHtcblxuXHRcdFx0Z3VhcmRJbmRleCA9IChudW1iZXJzSGFzaEludCArIHJldFsyXS5jaGFyQ29kZUF0KDApKSAlIHRoaXMuZ3VhcmRzLmxlbmd0aDtcblx0XHRcdGd1YXJkID0gdGhpcy5ndWFyZHNbZ3VhcmRJbmRleF07XG5cblx0XHRcdHJldCArPSBndWFyZDtcblxuXHRcdH1cblxuXHR9XG5cblx0aGFsZkxlbmd0aCA9IHBhcnNlSW50KGFscGhhYmV0Lmxlbmd0aCAvIDIsIDEwKTtcblx0d2hpbGUgKHJldC5sZW5ndGggPCB0aGlzLm1pbkhhc2hMZW5ndGgpIHtcblxuXHRcdGFscGhhYmV0ID0gdGhpcy5jb25zaXN0ZW50U2h1ZmZsZShhbHBoYWJldCwgYWxwaGFiZXQpO1xuXHRcdHJldCA9IGFscGhhYmV0LnN1YnN0cihoYWxmTGVuZ3RoKSArIHJldCArIGFscGhhYmV0LnN1YnN0cigwLCBoYWxmTGVuZ3RoKTtcblxuXHRcdGV4Y2VzcyA9IHJldC5sZW5ndGggLSB0aGlzLm1pbkhhc2hMZW5ndGg7XG5cdFx0aWYgKGV4Y2VzcyA+IDApIHtcblx0XHRcdHJldCA9IHJldC5zdWJzdHIoZXhjZXNzIC8gMiwgdGhpcy5taW5IYXNoTGVuZ3RoKTtcblx0XHR9XG5cblx0fVxuXG5cdHJldHVybiByZXQ7XG5cbn07XG5cbkhhc2hpZHMucHJvdG90eXBlLl9kZWNvZGUgPSBmdW5jdGlvbihoYXNoLCBhbHBoYWJldCkge1xuXG5cdHZhciByZXQgPSBbXSxcblx0XHRpID0gMCxcblx0XHRsb3R0ZXJ5LCBsZW4sIHN1Ykhhc2gsIGJ1ZmZlcixcblx0XHRyID0gbmV3IFJlZ0V4cChcIltcIiArIHRoaXMuZ3VhcmRzICsgXCJdXCIsIFwiZ1wiKSxcblx0XHRoYXNoQnJlYWtkb3duID0gaGFzaC5yZXBsYWNlKHIsIFwiIFwiKSxcblx0XHRoYXNoQXJyYXkgPSBoYXNoQnJlYWtkb3duLnNwbGl0KFwiIFwiKTtcblxuXHRpZiAoaGFzaEFycmF5Lmxlbmd0aCA9PT0gMyB8fCBoYXNoQXJyYXkubGVuZ3RoID09PSAyKSB7XG5cdFx0aSA9IDE7XG5cdH1cblxuXHRoYXNoQnJlYWtkb3duID0gaGFzaEFycmF5W2ldO1xuXHRpZiAodHlwZW9mIGhhc2hCcmVha2Rvd25bMF0gIT09IFwidW5kZWZpbmVkXCIpIHtcblxuXHRcdGxvdHRlcnkgPSBoYXNoQnJlYWtkb3duWzBdO1xuXHRcdGhhc2hCcmVha2Rvd24gPSBoYXNoQnJlYWtkb3duLnN1YnN0cigxKTtcblxuXHRcdHIgPSBuZXcgUmVnRXhwKFwiW1wiICsgdGhpcy5zZXBzICsgXCJdXCIsIFwiZ1wiKTtcblx0XHRoYXNoQnJlYWtkb3duID0gaGFzaEJyZWFrZG93bi5yZXBsYWNlKHIsIFwiIFwiKTtcblx0XHRoYXNoQXJyYXkgPSBoYXNoQnJlYWtkb3duLnNwbGl0KFwiIFwiKTtcblxuXHRcdGZvciAoaSA9IDAsIGxlbiA9IGhhc2hBcnJheS5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cblx0XHRcdHN1Ykhhc2ggPSBoYXNoQXJyYXlbaV07XG5cdFx0XHRidWZmZXIgPSBsb3R0ZXJ5ICsgdGhpcy5zYWx0ICsgYWxwaGFiZXQ7XG5cblx0XHRcdGFscGhhYmV0ID0gdGhpcy5jb25zaXN0ZW50U2h1ZmZsZShhbHBoYWJldCwgYnVmZmVyLnN1YnN0cigwLCBhbHBoYWJldC5sZW5ndGgpKTtcblx0XHRcdHJldC5wdXNoKHRoaXMudW5oYXNoKHN1Ykhhc2gsIGFscGhhYmV0KSk7XG5cblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZW5jb2RlKHJldCkgIT09IGhhc2gpIHtcblx0XHRcdHJldCA9IFtdO1xuXHRcdH1cblxuXHR9XG5cblx0cmV0dXJuIHJldDtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuY29uc2lzdGVudFNodWZmbGUgPSBmdW5jdGlvbihhbHBoYWJldCwgc2FsdCkge1xuXG5cdHZhciBpbnRlZ2VyLCBqLCB0ZW1wLCBpLCB2LCBwO1xuXG5cdGlmICghc2FsdC5sZW5ndGgpIHtcblx0XHRyZXR1cm4gYWxwaGFiZXQ7XG5cdH1cblxuXHRmb3IgKGkgPSBhbHBoYWJldC5sZW5ndGggLSAxLCB2ID0gMCwgcCA9IDA7IGkgPiAwOyBpLS0sIHYrKykge1xuXG5cdFx0diAlPSBzYWx0Lmxlbmd0aDtcblx0XHRwICs9IGludGVnZXIgPSBzYWx0W3ZdLmNoYXJDb2RlQXQoMCk7XG5cdFx0aiA9IChpbnRlZ2VyICsgdiArIHApICUgaTtcblxuXHRcdHRlbXAgPSBhbHBoYWJldFtqXTtcblx0XHRhbHBoYWJldCA9IGFscGhhYmV0LnN1YnN0cigwLCBqKSArIGFscGhhYmV0W2ldICsgYWxwaGFiZXQuc3Vic3RyKGogKyAxKTtcblx0XHRhbHBoYWJldCA9IGFscGhhYmV0LnN1YnN0cigwLCBpKSArIHRlbXAgKyBhbHBoYWJldC5zdWJzdHIoaSArIDEpO1xuXG5cdH1cblxuXHRyZXR1cm4gYWxwaGFiZXQ7XG5cbn07XG5cbkhhc2hpZHMucHJvdG90eXBlLmhhc2ggPSBmdW5jdGlvbihpbnB1dCwgYWxwaGFiZXQpIHtcblxuXHR2YXIgaGFzaCA9IFwiXCIsXG5cdFx0YWxwaGFiZXRMZW5ndGggPSBhbHBoYWJldC5sZW5ndGg7XG5cblx0ZG8ge1xuXHRcdGhhc2ggPSBhbHBoYWJldFtpbnB1dCAlIGFscGhhYmV0TGVuZ3RoXSArIGhhc2g7XG5cdFx0aW5wdXQgPSBwYXJzZUludChpbnB1dCAvIGFscGhhYmV0TGVuZ3RoLCAxMCk7XG5cdH0gd2hpbGUgKGlucHV0KTtcblxuXHRyZXR1cm4gaGFzaDtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUudW5oYXNoID0gZnVuY3Rpb24oaW5wdXQsIGFscGhhYmV0KSB7XG5cblx0dmFyIG51bWJlciA9IDAsIHBvcywgaTtcblxuXHRmb3IgKGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcblx0XHRwb3MgPSBhbHBoYWJldC5pbmRleE9mKGlucHV0W2ldKTtcblx0XHRudW1iZXIgKz0gcG9zICogTWF0aC5wb3coYWxwaGFiZXQubGVuZ3RoLCBpbnB1dC5sZW5ndGggLSBpIC0gMSk7XG5cdH1cblxuXHRyZXR1cm4gbnVtYmVyO1xuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhhc2hpZHM7XG4iLCJBbmFseXRpY3MgICAgPSByZXF1aXJlICcuL3V0aWxzL0FuYWx5dGljcydcbkF1dGhNYW5hZ2VyICA9IHJlcXVpcmUgJy4vdXRpbHMvQXV0aE1hbmFnZXInXG5TaGFyZSAgICAgICAgPSByZXF1aXJlICcuL3V0aWxzL1NoYXJlJ1xuRmFjZWJvb2sgICAgID0gcmVxdWlyZSAnLi91dGlscy9GYWNlYm9vaydcbkdvb2dsZVBsdXMgICA9IHJlcXVpcmUgJy4vdXRpbHMvR29vZ2xlUGx1cydcblRlbXBsYXRlcyAgICA9IHJlcXVpcmUgJy4vZGF0YS9UZW1wbGF0ZXMnXG5Mb2NhbGUgICAgICAgPSByZXF1aXJlICcuL2RhdGEvTG9jYWxlJ1xuUm91dGVyICAgICAgID0gcmVxdWlyZSAnLi9yb3V0ZXIvUm91dGVyJ1xuTmF2ICAgICAgICAgID0gcmVxdWlyZSAnLi9yb3V0ZXIvTmF2J1xuQXBwRGF0YSAgICAgID0gcmVxdWlyZSAnLi9BcHBEYXRhJ1xuQXBwVmlldyAgICAgID0gcmVxdWlyZSAnLi9BcHBWaWV3J1xuTWVkaWFRdWVyaWVzID0gcmVxdWlyZSAnLi91dGlscy9NZWRpYVF1ZXJpZXMnXG5cbmNsYXNzIEFwcFxuXG4gICAgTElWRSAgICAgICA6IG51bGxcbiAgICBCQVNFX1VSTCAgIDogd2luZG93LmNvbmZpZy5ob3N0bmFtZVxuICAgIFNJVEVfVVJMICAgOiB3aW5kb3cuY29uZmlnLlNJVEVfVVJMXG4gICAgQVBJX0hPU1QgICA6IHdpbmRvdy5jb25maWcuQVBJX0hPU1RcbiAgICBsb2NhbGVDb2RlIDogd2luZG93LmNvbmZpZy5sb2NhbGVDb2RlXG4gICAgb2JqUmVhZHkgICA6IDBcblxuICAgIF90b0NsZWFuICAgOiBbJ29ialJlYWR5JywgJ3NldEZsYWdzJywgJ29iamVjdENvbXBsZXRlJywgJ2luaXQnLCAnaW5pdE9iamVjdHMnLCAnaW5pdFNES3MnLCAnaW5pdEFwcCcsICdnbycsICdjbGVhbnVwJywgJ190b0NsZWFuJ11cblxuICAgIGNvbnN0cnVjdG9yIDogKEBMSVZFKSAtPlxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBzZXRGbGFncyA6ID0+XG5cbiAgICAgICAgdWEgPSB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgICAgTWVkaWFRdWVyaWVzLnNldHVwKCk7XG5cbiAgICAgICAgQElTX0FORFJPSUQgICAgPSB1YS5pbmRleE9mKCdhbmRyb2lkJykgPiAtMVxuICAgICAgICBASVNfRklSRUZPWCAgICA9IHVhLmluZGV4T2YoJ2ZpcmVmb3gnKSA+IC0xXG4gICAgICAgIEBJU19DSFJPTUVfSU9TID0gaWYgdWEubWF0Y2goJ2NyaW9zJykgdGhlbiB0cnVlIGVsc2UgZmFsc2UgIyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xMzgwODA1M1xuXG4gICAgICAgIG51bGxcblxuICAgIG9iamVjdENvbXBsZXRlIDogPT5cblxuICAgICAgICBAb2JqUmVhZHkrK1xuICAgICAgICBAaW5pdEFwcCgpIGlmIEBvYmpSZWFkeSA+PSA0XG5cbiAgICAgICAgbnVsbFxuXG4gICAgaW5pdCA6ID0+XG5cbiAgICAgICAgQGluaXRPYmplY3RzKClcblxuICAgICAgICBudWxsXG5cbiAgICBpbml0T2JqZWN0cyA6ID0+XG5cbiAgICAgICAgQGFwcERhdGEgICA9IG5ldyBBcHBEYXRhIEBvYmplY3RDb21wbGV0ZVxuICAgICAgICBAdGVtcGxhdGVzID0gbmV3IFRlbXBsYXRlcyB3aW5kb3cuX1RFTVBMQVRFUywgQG9iamVjdENvbXBsZXRlXG4gICAgICAgIEBsb2NhbGUgICAgPSBuZXcgTG9jYWxlIHdpbmRvdy5fTE9DQUxFX1NUUklOR1MsIEBvYmplY3RDb21wbGV0ZVxuICAgICAgICBAYW5hbHl0aWNzID0gbmV3IEFuYWx5dGljcyB3aW5kb3cuX1RSQUNLSU5HLCBAb2JqZWN0Q29tcGxldGVcblxuICAgICAgICAjIGlmIG5ldyBvYmplY3RzIGFyZSBhZGRlZCBkb24ndCBmb3JnZXQgdG8gY2hhbmdlIHRoZSBgQG9iamVjdENvbXBsZXRlYCBmdW5jdGlvblxuXG4gICAgICAgIG51bGxcblxuICAgIGluaXRTREtzIDogPT5cblxuICAgICAgICBGYWNlYm9vay5sb2FkKClcbiAgICAgICAgR29vZ2xlUGx1cy5sb2FkKClcblxuICAgICAgICBudWxsXG5cbiAgICBpbml0QXBwIDogPT5cblxuICAgICAgICBAc2V0RmxhZ3MoKVxuXG4gICAgICAgICMjIyBTdGFydHMgYXBwbGljYXRpb24gIyMjXG4gICAgICAgIEBhcHBWaWV3ID0gbmV3IEFwcFZpZXdcbiAgICAgICAgQHJvdXRlciAgPSBuZXcgUm91dGVyXG4gICAgICAgIEBuYXYgICAgID0gbmV3IE5hdlxuICAgICAgICBAYXV0aCAgICA9IG5ldyBBdXRoTWFuYWdlclxuICAgICAgICBAc2hhcmUgICA9IG5ldyBTaGFyZVxuXG4gICAgICAgIEBnbygpXG5cbiAgICAgICAgQGluaXRTREtzKClcblxuICAgICAgICBudWxsXG5cbiAgICBnbyA6ID0+XG5cbiAgICAgICAgIyMjIEFmdGVyIGV2ZXJ5dGhpbmcgaXMgbG9hZGVkLCBraWNrcyBvZmYgd2Vic2l0ZSAjIyNcbiAgICAgICAgQGFwcFZpZXcucmVuZGVyKClcblxuICAgICAgICAjIyMgcmVtb3ZlIHJlZHVuZGFudCBpbml0aWFsaXNhdGlvbiBtZXRob2RzIC8gcHJvcGVydGllcyAjIyNcbiAgICAgICAgQGNsZWFudXAoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGNsZWFudXAgOiA9PlxuXG4gICAgICAgIGZvciBmbiBpbiBAX3RvQ2xlYW5cbiAgICAgICAgICAgIEBbZm5dID0gbnVsbFxuICAgICAgICAgICAgZGVsZXRlIEBbZm5dXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFwcFxuIiwiQWJzdHJhY3REYXRhICAgICAgPSByZXF1aXJlICcuL2RhdGEvQWJzdHJhY3REYXRhJ1xuUmVxdWVzdGVyICAgICAgICAgPSByZXF1aXJlICcuL3V0aWxzL1JlcXVlc3RlcidcbkFQSSAgICAgICAgICAgICAgID0gcmVxdWlyZSAnLi9kYXRhL0FQSSdcbkRvb2RsZXNDb2xsZWN0aW9uID0gcmVxdWlyZSAnLi9jb2xsZWN0aW9ucy9kb29kbGVzL0Rvb2RsZXNDb2xsZWN0aW9uJ1xuXG5jbGFzcyBBcHBEYXRhIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cbiAgICBjYWxsYmFjayA6IG51bGxcblxuICAgIERPT0RMRV9DQUNIRV9FWFBJUkVTIDogOTk5OTk5OTk5OTk5OTk5OTlcblxuICAgIGNvbnN0cnVjdG9yIDogKEBjYWxsYmFjaykgLT5cblxuICAgICAgICBzdXBlcigpXG5cbiAgICAgICAgQGRvb2RsZXMgPSBuZXcgRG9vZGxlc0NvbGxlY3Rpb25cblxuICAgICAgICBAY2hlY2tEb29kbGVDYWNoZSgpXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgIGNoZWNrRG9vZGxlQ2FjaGUgOiA9PlxuXG4gICAgICAgIGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0IG51bGwsIChjYWNoZWREYXRhKSA9PlxuXG4gICAgICAgICAgICBpZiBfLmlzRW1wdHkgY2FjaGVkRGF0YVxuICAgICAgICAgICAgICAgIHJldHVybiBAZmV0Y2hEb29kbGVzKClcblxuICAgICAgICAgICAgY2FjaGVkRG9vZGxlcyA9IFtdXG4gICAgICAgICAgICAoaWYgaW5kZXggaXNudCAnbGFzdFVwZGF0ZWQnIHRoZW4gY2FjaGVkRG9vZGxlcy5wdXNoKEpTT04ucGFyc2UoZGF0YSkpKSBmb3IgaW5kZXgsIGRhdGEgb2YgY2FjaGVkRGF0YVxuXG4gICAgICAgICAgICBpZiAoKERhdGUubm93KCkgLSBjYWNoZWREYXRhLmxhc3RVcGRhdGVkKSA+IEBET09ETEVfQ0FDSEVfRVhQSVJFUylcbiAgICAgICAgICAgICAgICBAZmV0Y2hEb29kbGVzIGNhY2hlZERvb2RsZXNcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBAc2V0RG9vZGxlcyhjYWNoZWREb29kbGVzKS5zZXRBY3RpdmVEb29kbGUoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGZldGNoRG9vZGxlcyA6IChjYWNoZWREb29kbGVzPWZhbHNlKSA9PlxuXG4gICAgICAgIHIgPSBSZXF1ZXN0ZXIucmVxdWVzdFxuICAgICAgICAgICAgdXJsICA6IEFQSS5nZXQoJ2Rvb2RsZXMnKVxuICAgICAgICAgICAgdHlwZSA6ICdHRVQnXG5cbiAgICAgICAgci5kb25lIChkYXRhKSA9PiBAb25GZXRjaERvb2RsZXNEb25lIGRhdGEsIGNhY2hlZERvb2RsZXNcbiAgICAgICAgci5mYWlsIChyZXMpID0+IGNvbnNvbGUuZXJyb3IgXCJlcnJvciBsb2FkaW5nIGFwaSBzdGFydCBkYXRhXCIsIHJlc1xuXG4gICAgICAgIG51bGxcblxuICAgIG9uRmV0Y2hEb29kbGVzRG9uZSA6IChkYXRhLCBjYWNoZWREb29kbGVzPWZhbHNlKSA9PlxuXG4gICAgICAgIGNvbnNvbGUubG9nIFwib25GZXRjaERvb2RsZXNEb25lIDogKGRhdGEpID0+XCIsIGRhdGEsIGNhY2hlZERvb2RsZXNcblxuICAgICAgICBpZiBjYWNoZWREb29kbGVzXG4gICAgICAgICAgICBAdXBkYXRlRG9vZGxlcyhfLnNodWZmbGUoZGF0YS5kb29kbGVzKSwgY2FjaGVkRG9vZGxlcykuc2V0QWN0aXZlRG9vZGxlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgQHNldERvb2RsZXMoXy5zaHVmZmxlKGRhdGEuZG9vZGxlcykpLnNldEFjdGl2ZURvb2RsZSgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgc2V0RG9vZGxlcyA6IChkb29kbGVzKSA9PlxuXG4gICAgICAgIEBkb29kbGVzLmFkZCBkb29kbGVzXG5cbiAgICAgICAgQFxuXG4gICAgdXBkYXRlRG9vZGxlcyA6IChuZXdEb29kbGVzLCBjYWNoZWREb29kbGVzKSA9PlxuXG4gICAgICAgIEBkb29kbGVzLmFkZCBjYWNoZWREb29kbGVzXG4gICAgICAgIEBkb29kbGVzLmFkZE5ldyBuZXdEb29kbGVzXG5cbiAgICAgICAgQFxuXG4gICAgc2V0QWN0aXZlRG9vZGxlIDogPT5cblxuICAgICAgICBAYWN0aXZlRG9vZGxlID0gQGRvb2RsZXMuZ2V0TmV4dERvb2RsZSgpXG4gICAgICAgIEBjYWxsYmFjaz8oKVxuXG4gICAgICAgIEB1cGRhdGVDYWNoZSgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgdXBkYXRlQ2FjaGUgOiA9PlxuXG4gICAgICAgIGNocm9tZS5zdG9yYWdlLnN5bmMuY2xlYXIgPT5cblxuICAgICAgICAgICAgbmV3Q2FjaGUgPSBsYXN0VXBkYXRlZCA6IERhdGUubm93KClcbiAgICAgICAgICAgIChuZXdDYWNoZVtwb3NpdGlvbl0gPSBKU09OLnN0cmluZ2lmeSBkb29kbGUpIGZvciBkb29kbGUsIHBvc2l0aW9uIGluIEBkb29kbGVzLm1vZGVsc1xuXG4gICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5zeW5jLnNldCBuZXdDYWNoZVxuXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBcHBEYXRhXG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuL3ZpZXcvQWJzdHJhY3RWaWV3J1xuUHJlbG9hZGVyICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvUHJlbG9hZGVyJ1xuSGVhZGVyICAgICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvSGVhZGVyJ1xuV3JhcHBlciAgICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvV3JhcHBlcidcbkZvb3RlciAgICAgICA9IHJlcXVpcmUgJy4vdmlldy9iYXNlL0Zvb3Rlcidcbk1vZGFsTWFuYWdlciA9IHJlcXVpcmUgJy4vdmlldy9tb2RhbHMvX01vZGFsTWFuYWdlcidcbk1lZGlhUXVlcmllcyA9IHJlcXVpcmUgJy4vdXRpbHMvTWVkaWFRdWVyaWVzJ1xuXG5jbGFzcyBBcHBWaWV3IGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cbiAgICB0ZW1wbGF0ZSA6ICdtYWluJ1xuXG4gICAgJHdpbmRvdyAgOiBudWxsXG4gICAgJGJvZHkgICAgOiBudWxsXG5cbiAgICB3cmFwcGVyICA6IG51bGxcbiAgICBmb290ZXIgICA6IG51bGxcblxuICAgIGRpbXMgOlxuICAgICAgICB3IDogbnVsbFxuICAgICAgICBoIDogbnVsbFxuICAgICAgICBvIDogbnVsbFxuICAgICAgICBjIDogbnVsbFxuXG4gICAgZXZlbnRzIDpcbiAgICAgICAgJ2NsaWNrIGEnIDogJ2xpbmtNYW5hZ2VyJ1xuXG4gICAgRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMgOiAnRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMnXG5cbiAgICBNT0JJTEVfV0lEVEggOiA3MDBcbiAgICBNT0JJTEUgICAgICAgOiAnbW9iaWxlJ1xuICAgIE5PTl9NT0JJTEUgICA6ICdub25fbW9iaWxlJ1xuXG4gICAgY29uc3RydWN0b3IgOiAtPlxuXG4gICAgICAgIEAkd2luZG93ID0gJCh3aW5kb3cpXG4gICAgICAgIEAkYm9keSAgID0gJCgnYm9keScpLmVxKDApXG5cbiAgICAgICAgc3VwZXIoKVxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBkaXNhYmxlVG91Y2g6ID0+XG5cbiAgICAgICAgQCR3aW5kb3cub24gJ3RvdWNobW92ZScsIEBvblRvdWNoTW92ZVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgZW5hYmxlVG91Y2g6ID0+XG5cbiAgICAgICAgQCR3aW5kb3cub2ZmICd0b3VjaG1vdmUnLCBAb25Ub3VjaE1vdmVcblxuICAgICAgICByZXR1cm5cblxuICAgIG9uVG91Y2hNb3ZlOiAoIGUgKSAtPlxuXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgcmVuZGVyIDogPT5cblxuICAgICAgICBAYmluZEV2ZW50cygpXG5cbiAgICAgICAgQHByZWxvYWRlciAgICA9IG5ldyBQcmVsb2FkZXJcbiAgICAgICAgQG1vZGFsTWFuYWdlciA9IG5ldyBNb2RhbE1hbmFnZXJcblxuICAgICAgICBAaGVhZGVyICA9IG5ldyBIZWFkZXJcbiAgICAgICAgQHdyYXBwZXIgPSBuZXcgV3JhcHBlclxuICAgICAgICBAZm9vdGVyICA9IG5ldyBGb290ZXJcblxuICAgICAgICBAXG4gICAgICAgICAgICAuYWRkQ2hpbGQgQGhlYWRlclxuICAgICAgICAgICAgLmFkZENoaWxkIEB3cmFwcGVyXG4gICAgICAgICAgICAuYWRkQ2hpbGQgQGZvb3RlclxuXG4gICAgICAgIEBvbkFsbFJlbmRlcmVkKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGJpbmRFdmVudHMgOiA9PlxuXG4gICAgICAgIEBvbiAnYWxsUmVuZGVyZWQnLCBAb25BbGxSZW5kZXJlZFxuXG4gICAgICAgIEBvblJlc2l6ZSgpXG5cbiAgICAgICAgQG9uUmVzaXplID0gXy5kZWJvdW5jZSBAb25SZXNpemUsIDMwMFxuICAgICAgICBAJHdpbmRvdy5vbiAncmVzaXplIG9yaWVudGF0aW9uY2hhbmdlJywgQG9uUmVzaXplXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBvbkFsbFJlbmRlcmVkIDogPT5cblxuICAgICAgICAjIGNvbnNvbGUubG9nIFwib25BbGxSZW5kZXJlZCA6ID0+XCJcblxuICAgICAgICBAJGJvZHkucHJlcGVuZCBAJGVsXG5cbiAgICAgICAgQGJlZ2luKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGJlZ2luIDogPT5cblxuICAgICAgICBAdHJpZ2dlciAnc3RhcnQnXG5cbiAgICAgICAgQENEX0NFKCkucm91dGVyLnN0YXJ0KClcblxuICAgICAgICBAcHJlbG9hZGVyLmhpZGUoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgb25SZXNpemUgOiA9PlxuXG4gICAgICAgIEBnZXREaW1zKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGdldERpbXMgOiA9PlxuXG4gICAgICAgIHcgPSB3aW5kb3cuaW5uZXJXaWR0aCBvciBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggb3IgZG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aFxuICAgICAgICBoID0gd2luZG93LmlubmVySGVpZ2h0IG9yIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgb3IgZG9jdW1lbnQuYm9keS5jbGllbnRIZWlnaHRcblxuICAgICAgICBAZGltcyA9XG4gICAgICAgICAgICB3IDogd1xuICAgICAgICAgICAgaCA6IGhcbiAgICAgICAgICAgIG8gOiBpZiBoID4gdyB0aGVuICdwb3J0cmFpdCcgZWxzZSAnbGFuZHNjYXBlJ1xuICAgICAgICAgICAgYyA6IGlmIHcgPD0gQE1PQklMRV9XSURUSCB0aGVuIEBNT0JJTEUgZWxzZSBATk9OX01PQklMRVxuXG4gICAgICAgIEB0cmlnZ2VyIEBFVkVOVF9VUERBVEVfRElNRU5TSU9OUywgQGRpbXNcblxuICAgICAgICByZXR1cm5cblxuICAgIGxpbmtNYW5hZ2VyIDogKGUpID0+XG5cbiAgICAgICAgaHJlZiA9ICQoZS5jdXJyZW50VGFyZ2V0KS5hdHRyKCdocmVmJylcblxuICAgICAgICByZXR1cm4gZmFsc2UgdW5sZXNzIGhyZWZcblxuICAgICAgICBAbmF2aWdhdGVUb1VybCBocmVmLCBlXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBuYXZpZ2F0ZVRvVXJsIDogKCBocmVmLCBlID0gbnVsbCApID0+XG5cbiAgICAgICAgcm91dGUgICA9IGlmIGhyZWYubWF0Y2goQENEX0NFKCkuQkFTRV9VUkwpIHRoZW4gaHJlZi5zcGxpdChAQ0RfQ0UoKS5CQVNFX1VSTClbMV0gZWxzZSBocmVmXG4gICAgICAgIHNlY3Rpb24gPSBpZiByb3V0ZS5pbmRleE9mKCcvJykgaXMgMCB0aGVuIHJvdXRlLnNwbGl0KCcvJylbMV0gZWxzZSByb3V0ZVxuXG4gICAgICAgIGlmIEBDRF9DRSgpLm5hdi5nZXRTZWN0aW9uIHNlY3Rpb25cbiAgICAgICAgICAgIGU/LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgIEBDRF9DRSgpLnJvdXRlci5uYXZpZ2F0ZVRvIHJvdXRlXG4gICAgICAgIGVsc2UgXG4gICAgICAgICAgICBAaGFuZGxlRXh0ZXJuYWxMaW5rIGhyZWZcblxuICAgICAgICByZXR1cm5cblxuICAgIGhhbmRsZUV4dGVybmFsTGluayA6IChkYXRhKSA9PiBcblxuICAgICAgICAjIyNcblxuICAgICAgICBiaW5kIHRyYWNraW5nIGV2ZW50cyBpZiBuZWNlc3NhcnlcblxuICAgICAgICAjIyNcblxuICAgICAgICByZXR1cm5cblxubW9kdWxlLmV4cG9ydHMgPSBBcHBWaWV3XG4iLCJjbGFzcyBBYnN0cmFjdENvbGxlY3Rpb24gZXh0ZW5kcyBCYWNrYm9uZS5Db2xsZWN0aW9uXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Q29sbGVjdGlvblxuIiwiVGVtcGxhdGVNb2RlbCA9IHJlcXVpcmUgJy4uLy4uL21vZGVscy9jb3JlL1RlbXBsYXRlTW9kZWwnXG5cbmNsYXNzIFRlbXBsYXRlc0NvbGxlY3Rpb24gZXh0ZW5kcyBCYWNrYm9uZS5Db2xsZWN0aW9uXG5cblx0bW9kZWwgOiBUZW1wbGF0ZU1vZGVsXG5cbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVzQ29sbGVjdGlvblxuIiwiQWJzdHJhY3RDb2xsZWN0aW9uID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RDb2xsZWN0aW9uJ1xuRG9vZGxlTW9kZWwgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vbW9kZWxzL2Rvb2RsZS9Eb29kbGVNb2RlbCdcblxuY2xhc3MgRG9vZGxlc0NvbGxlY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENvbGxlY3Rpb25cblxuICAgIG1vZGVsIDogRG9vZGxlTW9kZWxcblxuICAgIGdldERvb2RsZUJ5U2x1ZyA6IChzbHVnKSA9PlxuXG4gICAgICAgIGRvb2RsZSA9IEBmaW5kV2hlcmUgc2x1ZyA6IHNsdWdcblxuICAgICAgICBpZiAhZG9vZGxlXG4gICAgICAgICAgICBjb25zb2xlLmxvZyBcInkgdSBubyBkb29kbGU/XCJcblxuICAgICAgICByZXR1cm4gZG9vZGxlXG5cbiAgICBnZXREb29kbGVCeU5hdlNlY3Rpb24gOiAod2hpY2hTZWN0aW9uKSA9PlxuXG4gICAgICAgIHNlY3Rpb24gPSBAQ0RfQ0UoKS5uYXZbd2hpY2hTZWN0aW9uXVxuXG4gICAgICAgIGRvb2RsZSA9IEBmaW5kV2hlcmUgc2x1ZyA6IFwiI3tzZWN0aW9uLnN1Yn0vI3tzZWN0aW9uLnRlcn1cIlxuXG4gICAgICAgIGRvb2RsZVxuXG4gICAgZ2V0UHJldkRvb2RsZSA6IChkb29kbGUpID0+XG5cbiAgICAgICAgaW5kZXggPSBAaW5kZXhPZiBkb29kbGVcbiAgICAgICAgaW5kZXgtLVxuXG4gICAgICAgIGlmIGluZGV4IDwgMFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBAYXQgaW5kZXhcblxuICAgIGdldE5leHREb29kbGUgOiAoZG9vZGxlKSA9PlxuXG4gICAgICAgIGluZGV4ID0gQGluZGV4T2YgZG9vZGxlXG4gICAgICAgIGluZGV4KytcblxuICAgICAgICBpZiBpbmRleCA+IChAbGVuZ3RoLmxlbmd0aC0xKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBAYXQgaW5kZXhcblxuICAgIGFkZE5ldyA6IChkb29kbGVzKSA9PlxuXG4gICAgICAgIGZvciBkb29kbGUgaW4gZG9vZGxlc1xuICAgICAgICAgICAgaWYgIUBmaW5kV2hlcmUoIGluZGV4IDogZG9vZGxlLmluZGV4IClcbiAgICAgICAgICAgICAgICBAYWRkIGRvb2RsZVxuXG4gICAgICAgIG51bGxcblxuICAgIGdldE5leHREb29kbGUgOiA9PlxuXG4gICAgICAgIGZvciBkb29kbGUgaW4gQG1vZGVsc1xuXG4gICAgICAgICAgICBpZiAhZG9vZGxlLmdldCgndmlld2VkJylcbiAgICAgICAgICAgICAgICBkb29kbGUuc2V0KCd2aWV3ZWQnLCB0cnVlKVxuICAgICAgICAgICAgICAgIG5leHREb29kbGUgPSBkb29kbGVcbiAgICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgIGlmICFuZXh0RG9vZGxlXG4gICAgICAgICAgICBjb25zb2xlLmxvZyAnd2FhYWFhIHUgc2VlbiB0aGVtIGFsbD8hJ1xuXG4gICAgICAgIG5leHREb29kbGVcblxubW9kdWxlLmV4cG9ydHMgPSBEb29kbGVzQ29sbGVjdGlvblxuIiwiQVBJUm91dGVNb2RlbCA9IHJlcXVpcmUgJy4uL21vZGVscy9jb3JlL0FQSVJvdXRlTW9kZWwnXG5cbmNsYXNzIEFQSVxuXG5cdEBtb2RlbCA6IG5ldyBBUElSb3V0ZU1vZGVsXG5cblx0QGdldENvbnRhbnRzIDogPT5cblxuXHRcdCMjIyBhZGQgbW9yZSBpZiB3ZSB3YW5uYSB1c2UgaW4gQVBJIHN0cmluZ3MgIyMjXG5cdFx0QVBJX0hPU1QgOiBAQ0RfQ0UoKS5BUElfSE9TVFxuXG5cdEBnZXQgOiAobmFtZSwgdmFycykgPT5cblxuXHRcdHZhcnMgPSAkLmV4dGVuZCB0cnVlLCB2YXJzLCBAZ2V0Q29udGFudHMoKVxuXHRcdHJldHVybiBAc3VwcGxhbnRTdHJpbmcgQG1vZGVsLmdldChuYW1lKSwgdmFyc1xuXG5cdEBzdXBwbGFudFN0cmluZyA6IChzdHIsIHZhbHMpIC0+XG5cblx0XHRyZXR1cm4gc3RyLnJlcGxhY2UgL3t7IChbXnt9XSopIH19L2csIChhLCBiKSAtPlxuXHRcdFx0ciA9IHZhbHNbYl0gb3IgaWYgdHlwZW9mIHZhbHNbYl0gaXMgJ251bWJlcicgdGhlbiB2YWxzW2JdLnRvU3RyaW5nKCkgZWxzZSAnJ1xuXHRcdChpZiB0eXBlb2YgciBpcyBcInN0cmluZ1wiIG9yIHR5cGVvZiByIGlzIFwibnVtYmVyXCIgdGhlbiByIGVsc2UgYSlcblxuXHRAQ0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFQSVxuIiwiY2xhc3MgQWJzdHJhY3REYXRhXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0Xy5leHRlbmQgQCwgQmFja2JvbmUuRXZlbnRzXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdENEX0NFIDogPT5cblxuXHRcdHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdERhdGFcbiIsIkxvY2FsZXNNb2RlbCA9IHJlcXVpcmUgJy4uL21vZGVscy9jb3JlL0xvY2FsZXNNb2RlbCdcbkFQSSAgICAgICAgICA9IHJlcXVpcmUgJy4uL2RhdGEvQVBJJ1xuXG4jIyNcbiMgTG9jYWxlIExvYWRlciAjXG5cbkZpcmVzIGJhY2sgYW4gZXZlbnQgd2hlbiBjb21wbGV0ZVxuXG4jIyNcbmNsYXNzIExvY2FsZVxuXG4gICAgbGFuZyAgICAgOiBudWxsXG4gICAgZGF0YSAgICAgOiBudWxsXG4gICAgY2FsbGJhY2sgOiBudWxsXG4gICAgZGVmYXVsdCAgOiAnZW4tZ2InXG5cbiAgICBjb25zdHJ1Y3RvciA6IChkYXRhLCBjYikgLT5cblxuICAgICAgICAjIyMgc3RhcnQgTG9jYWxlIExvYWRlciwgZGVmaW5lIGxvY2FsZSBiYXNlZCBvbiBicm93c2VyIGxhbmd1YWdlICMjI1xuXG4gICAgICAgIEBjYWxsYmFjayA9IGNiXG5cbiAgICAgICAgQGxhbmcgPSBAZ2V0TGFuZygpXG5cbiAgICAgICAgQHBhcnNlRGF0YSBkYXRhXG5cbiAgICAgICAgbnVsbFxuICAgICAgICAgICAgXG4gICAgZ2V0TGFuZyA6ID0+XG5cbiAgICAgICAgaWYgd2luZG93LmxvY2F0aW9uLnNlYXJjaCBhbmQgd2luZG93LmxvY2F0aW9uLnNlYXJjaC5tYXRjaCgnbGFuZz0nKVxuXG4gICAgICAgICAgICBsYW5nID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaC5zcGxpdCgnbGFuZz0nKVsxXS5zcGxpdCgnJicpWzBdXG5cbiAgICAgICAgZWxzZSBpZiB3aW5kb3cuY29uZmlnLmxvY2FsZUNvZGVcblxuICAgICAgICAgICAgbGFuZyA9IHdpbmRvdy5jb25maWcubG9jYWxlQ29kZVxuXG4gICAgICAgIGVsc2VcblxuICAgICAgICAgICAgbGFuZyA9IEBkZWZhdWx0XG5cbiAgICAgICAgbGFuZ1xuXG4gICAgcGFyc2VEYXRhIDogKGRhdGEpID0+XG5cbiAgICAgICAgIyMjIEZpcmVzIGJhY2sgYW4gZXZlbnQgb25jZSBpdCdzIGNvbXBsZXRlICMjI1xuXG4gICAgICAgIEBkYXRhID0gbmV3IExvY2FsZXNNb2RlbCBkYXRhXG4gICAgICAgIEBjYWxsYmFjaz8oKVxuXG4gICAgICAgIG51bGxcblxuICAgIGdldCA6IChpZCkgPT5cblxuICAgICAgICAjIyMgZ2V0IFN0cmluZyBmcm9tIGxvY2FsZVxuICAgICAgICArIGlkIDogc3RyaW5nIGlkIG9mIHRoZSBMb2NhbGlzZWQgU3RyaW5nXG4gICAgICAgICMjI1xuXG4gICAgICAgIHJldHVybiBAZGF0YS5nZXRTdHJpbmcgaWRcblxuICAgIGdldExvY2FsZUltYWdlIDogKHVybCkgPT5cblxuICAgICAgICByZXR1cm4gd2luZG93LmNvbmZpZy5DRE4gKyBcIi9pbWFnZXMvbG9jYWxlL1wiICsgd2luZG93LmNvbmZpZy5sb2NhbGVDb2RlICsgXCIvXCIgKyB1cmxcblxubW9kdWxlLmV4cG9ydHMgPSBMb2NhbGVcbiIsIlRlbXBsYXRlTW9kZWwgICAgICAgPSByZXF1aXJlICcuLi9tb2RlbHMvY29yZS9UZW1wbGF0ZU1vZGVsJ1xuVGVtcGxhdGVzQ29sbGVjdGlvbiA9IHJlcXVpcmUgJy4uL2NvbGxlY3Rpb25zL2NvcmUvVGVtcGxhdGVzQ29sbGVjdGlvbidcblxuY2xhc3MgVGVtcGxhdGVzXG5cbiAgICB0ZW1wbGF0ZXMgOiBudWxsXG4gICAgY2IgICAgICAgIDogbnVsbFxuXG4gICAgY29uc3RydWN0b3IgOiAoZGF0YSwgY2FsbGJhY2spIC0+XG5cbiAgICAgICAgQGNiID0gY2FsbGJhY2tcblxuICAgICAgICBAcGFyc2VEYXRhIGRhdGFcbiAgICAgICAgICAgXG4gICAgICAgIG51bGxcblxuICAgIHBhcnNlRGF0YSA6IChkYXRhKSA9PlxuXG4gICAgICAgIHRlbXAgPSBbXVxuXG4gICAgICAgIGZvciBpdGVtIGluIGRhdGEudGVtcGxhdGVcbiAgICAgICAgICAgIHRlbXAucHVzaCBuZXcgVGVtcGxhdGVNb2RlbFxuICAgICAgICAgICAgICAgIGlkICAgOiBpdGVtLiQuaWRcbiAgICAgICAgICAgICAgICB0ZXh0IDogaXRlbS5fXG5cbiAgICAgICAgQHRlbXBsYXRlcyA9IG5ldyBUZW1wbGF0ZXNDb2xsZWN0aW9uIHRlbXBcblxuICAgICAgICBAY2I/KClcbiAgICAgICAgXG4gICAgICAgIG51bGwgICAgICAgIFxuXG4gICAgZ2V0IDogKGlkKSA9PlxuXG4gICAgICAgIHQgPSBAdGVtcGxhdGVzLndoZXJlIGlkIDogaWRcbiAgICAgICAgdCA9IHRbMF0uZ2V0ICd0ZXh0J1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuICQudHJpbSB0XG5cbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVzXG4iLCJjbGFzcyBBYnN0cmFjdE1vZGVsIGV4dGVuZHMgQmFja2JvbmUuRGVlcE1vZGVsXG5cblx0Y29uc3RydWN0b3IgOiAoYXR0cnMsIG9wdGlvbikgLT5cblxuXHRcdGF0dHJzID0gQF9maWx0ZXJBdHRycyBhdHRyc1xuXG5cdFx0cmV0dXJuIEJhY2tib25lLkRlZXBNb2RlbC5hcHBseSBALCBhcmd1bWVudHNcblxuXHRzZXQgOiAoYXR0cnMsIG9wdGlvbnMpIC0+XG5cblx0XHRvcHRpb25zIG9yIChvcHRpb25zID0ge30pXG5cblx0XHRhdHRycyA9IEBfZmlsdGVyQXR0cnMgYXR0cnNcblxuXHRcdG9wdGlvbnMuZGF0YSA9IEpTT04uc3RyaW5naWZ5IGF0dHJzXG5cblx0XHRyZXR1cm4gQmFja2JvbmUuRGVlcE1vZGVsLnByb3RvdHlwZS5zZXQuY2FsbCBALCBhdHRycywgb3B0aW9uc1xuXG5cdF9maWx0ZXJBdHRycyA6IChhdHRycykgPT5cblxuXHRcdGF0dHJzXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0TW9kZWxcbiIsImNsYXNzIEFQSVJvdXRlTW9kZWwgZXh0ZW5kcyBCYWNrYm9uZS5EZWVwTW9kZWxcblxuICAgIGRlZmF1bHRzIDpcblxuICAgICAgICBkb29kbGVzIDogXCJ7eyBBUElfSE9TVCB9fS9hcGkvZG9vZGxlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gQVBJUm91dGVNb2RlbFxuIiwiY2xhc3MgTG9jYWxlc01vZGVsIGV4dGVuZHMgQmFja2JvbmUuTW9kZWxcblxuICAgIGRlZmF1bHRzIDpcbiAgICAgICAgY29kZSAgICAgOiBudWxsXG4gICAgICAgIGxhbmd1YWdlIDogbnVsbFxuICAgICAgICBzdHJpbmdzICA6IG51bGxcbiAgICAgICAgICAgIFxuICAgIGdldF9sYW5ndWFnZSA6ID0+XG4gICAgICAgIHJldHVybiBAZ2V0KCdsYW5ndWFnZScpXG5cbiAgICBnZXRTdHJpbmcgOiAoaWQpID0+XG4gICAgICAgICgocmV0dXJuIGUgaWYoYSBpcyBpZCkpIGZvciBhLCBlIG9mIHZbJ3N0cmluZ3MnXSkgZm9yIGssIHYgb2YgQGdldCgnc3RyaW5ncycpXG4gICAgICAgIGNvbnNvbGUud2FybiBcIkxvY2FsZXMgLT4gbm90IGZvdW5kIHN0cmluZzogI3tpZH1cIlxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gTG9jYWxlc01vZGVsXG4iLCJjbGFzcyBUZW1wbGF0ZU1vZGVsIGV4dGVuZHMgQmFja2JvbmUuTW9kZWxcblxuXHRkZWZhdWx0cyA6IFxuXG5cdFx0aWQgICA6IFwiXCJcblx0XHR0ZXh0IDogXCJcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IFRlbXBsYXRlTW9kZWxcbiIsIkFic3RyYWN0TW9kZWwgICAgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RNb2RlbCdcbk51bWJlclV0aWxzICAgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vdXRpbHMvTnVtYmVyVXRpbHMnXG5Db2RlV29yZFRyYW5zaXRpb25lciA9IHJlcXVpcmUgJy4uLy4uL3V0aWxzL0NvZGVXb3JkVHJhbnNpdGlvbmVyJ1xuSGFzaGlkcyAgICAgICAgICAgICAgPSByZXF1aXJlICdoYXNoaWRzJ1xuXG5jbGFzcyBEb29kbGVNb2RlbCBleHRlbmRzIEFic3RyYWN0TW9kZWxcblxuICAgIGRlZmF1bHRzIDpcbiAgICAgICAgIyBmcm9tIG1hbmlmZXN0XG4gICAgICAgIFwibmFtZVwiIDogXCJcIlxuICAgICAgICBcImF1dGhvclwiIDpcbiAgICAgICAgICAgIFwibmFtZVwiICAgIDogXCJcIlxuICAgICAgICAgICAgXCJnaXRodWJcIiAgOiBcIlwiXG4gICAgICAgICAgICBcIndlYnNpdGVcIiA6IFwiXCJcbiAgICAgICAgICAgIFwidHdpdHRlclwiIDogXCJcIlxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiXCJcbiAgICAgICAgXCJ0YWdzXCIgOiBbXVxuICAgICAgICBcImludGVyYWN0aW9uXCIgOlxuICAgICAgICAgICAgXCJtb3VzZVwiICAgIDogbnVsbFxuICAgICAgICAgICAgXCJrZXlib2FyZFwiIDogbnVsbFxuICAgICAgICAgICAgXCJ0b3VjaFwiICAgIDogbnVsbFxuICAgICAgICBcImNyZWF0ZWRcIiA6IFwiXCJcbiAgICAgICAgXCJzbHVnXCIgOiBcIlwiXG4gICAgICAgIFwic2hvcnRsaW5rXCIgOiBcIlwiXG4gICAgICAgIFwiY29sb3VyX3NjaGVtZVwiIDogXCJcIlxuICAgICAgICBcImluZGV4XCI6IG51bGxcbiAgICAgICAgXCJpbmRleF9wYWRkZWRcIiA6IFwiXCJcbiAgICAgICAgIyBzaXRlLW9ubHlcbiAgICAgICAgXCJpbmRleEhUTUxcIiA6IFwiXCJcbiAgICAgICAgXCJzb3VyY2VcIiAgICA6IFwiXCJcbiAgICAgICAgXCJ1cmxcIiAgICAgICA6IFwiXCJcbiAgICAgICAgXCJzY3JhbWJsZWRcIiA6XG4gICAgICAgICAgICBcIm5hbWVcIiAgICAgICAgOiBcIlwiXG4gICAgICAgICAgICBcImF1dGhvcl9uYW1lXCIgOiBcIlwiXG4gICAgICAgIFwidmlld2VkXCIgOiBmYWxzZVxuXG4gICAgX2ZpbHRlckF0dHJzIDogKGF0dHJzKSA9PlxuXG4gICAgICAgIGlmIGF0dHJzLnNsdWdcbiAgICAgICAgICAgIGF0dHJzLnVybCA9IHdpbmRvdy5jb25maWcuU0lURV9VUkwgKyAnLycgKyB3aW5kb3cuY29uZmlnLnJvdXRlcy5ET09ETEVTICsgJy8nICsgYXR0cnMuc2x1Z1xuXG4gICAgICAgIGlmIGF0dHJzLmluZGV4XG4gICAgICAgICAgICBhdHRycy5pbmRleF9wYWRkZWQgPSBOdW1iZXJVdGlscy56ZXJvRmlsbCBhdHRycy5pbmRleCwgM1xuICAgICAgICAgICAgYXR0cnMuaW5kZXhIVE1MICAgID0gQGdldEluZGV4SFRNTCBhdHRycy5pbmRleF9wYWRkZWRcblxuICAgICAgICBpZiBhdHRycy5uYW1lIGFuZCBhdHRycy5hdXRob3IubmFtZVxuICAgICAgICAgICAgYXR0cnMuc2NyYW1ibGVkID1cbiAgICAgICAgICAgICAgICBuYW1lICAgICAgICA6IENvZGVXb3JkVHJhbnNpdGlvbmVyLmdldFNjcmFtYmxlZFdvcmQgYXR0cnMubmFtZVxuICAgICAgICAgICAgICAgIGF1dGhvcl9uYW1lIDogQ29kZVdvcmRUcmFuc2l0aW9uZXIuZ2V0U2NyYW1ibGVkV29yZCBhdHRycy5hdXRob3IubmFtZVxuXG4gICAgICAgIGF0dHJzXG5cbiAgICBnZXRJbmRleEhUTUwgOiAoaW5kZXgpID0+XG5cbiAgICAgICAgaHRtbCA9IFwiXCJcblxuICAgICAgICBmb3IgY2hhciBpbiBpbmRleC5zcGxpdCgnJylcbiAgICAgICAgICAgIGNsYXNzTmFtZSA9IGlmIGNoYXIgaXMgJzAnIHRoZW4gJ2luZGV4LWNoYXItemVybycgZWxzZSAnaW5kZXgtY2hhci1ub256ZXJvJ1xuICAgICAgICAgICAgaHRtbCArPSBcIjxzcGFuIGNsYXNzPVxcXCIje2NsYXNzTmFtZX1cXFwiPiN7Y2hhcn08L3NwYW4+XCJcblxuICAgICAgICBodG1sXG5cbiAgICBnZXRBdXRob3JIdG1sIDogPT5cblxuICAgICAgICBwb3J0Zm9saW9fbGFiZWwgPSBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwibWlzY19wb3J0Zm9saW9fbGFiZWxcIlxuXG4gICAgICAgIGF0dHJzID0gQGdldCgnYXV0aG9yJylcbiAgICAgICAgaHRtbCAgPSBcIlwiXG4gICAgICAgIGxpbmtzID0gW11cblxuICAgICAgICBodG1sICs9IFwiI3thdHRycy5uYW1lfSBcXFxcIFwiXG5cbiAgICAgICAgaWYgYXR0cnMud2Vic2l0ZSB0aGVuIGxpbmtzLnB1c2ggXCI8YSBocmVmPVxcXCIje2F0dHJzLndlYnNpdGV9XFxcIiB0YXJnZXQ9XFxcIl9ibGFua1xcXCI+I3twb3J0Zm9saW9fbGFiZWx9PC9hPiBcIlxuICAgICAgICBpZiBhdHRycy50d2l0dGVyIHRoZW4gbGlua3MucHVzaCBcIjxhIGhyZWY9XFxcImh0dHA6Ly90d2l0dGVyLmNvbS8je2F0dHJzLnR3aXR0ZXJ9XFxcIiB0YXJnZXQ9XFxcIl9ibGFua1xcXCI+dHc8L2E+XCJcbiAgICAgICAgaWYgYXR0cnMuZ2l0aHViIHRoZW4gbGlua3MucHVzaCBcIjxhIGhyZWY9XFxcImh0dHA6Ly9naXRodWIuY29tLyN7YXR0cnMuZ2l0aHVifVxcXCIgdGFyZ2V0PVxcXCJfYmxhbmtcXFwiPmdoPC9hPlwiXG5cbiAgICAgICAgaHRtbCArPSBcIiN7bGlua3Muam9pbignIFxcXFwgJyl9XCJcblxuICAgICAgICBodG1sXG5cbiAgICAjIG5vIG5lZWQgdG8gZG8gdGhpcyBmb3IgZXZlcnkgZG9vZGxlIC0gb25seSBkbyBpdCBpZiB3ZSB2aWV3IHRoZSBpbmZvIHBhbmUgZm9yIGEgcGFydGljdWxhciBkb29kbGVcbiAgICBzZXRTaG9ydGxpbmsgOiA9PlxuXG4gICAgICAgIHJldHVybiBpZiBAZ2V0ICdzaG9ydGxpbmsnXG5cbiAgICAgICAgaCA9IG5ldyBIYXNoaWRzIHdpbmRvdy5jb25maWcuc2hvcnRsaW5rcy5TQUxULCAwLCB3aW5kb3cuY29uZmlnLnNob3J0bGlua3MuQUxQSEFCRVRcbiAgICAgICAgc2hvcnRsaW5rID0gaC5lbmNvZGUgQGdldCAnaW5kZXgnXG4gICAgICAgIEBzZXQgJ3Nob3J0bGluaycsIHNob3J0bGlua1xuXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBEb29kbGVNb2RlbFxuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi4vdmlldy9BYnN0cmFjdFZpZXcnXG5Sb3V0ZXIgICAgICAgPSByZXF1aXJlICcuL1JvdXRlcidcblxuY2xhc3MgTmF2IGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cbiAgICBARVZFTlRfQ0hBTkdFX1ZJRVcgICAgIDogJ0VWRU5UX0NIQU5HRV9WSUVXJ1xuICAgIEBFVkVOVF9DSEFOR0VfU1VCX1ZJRVcgOiAnRVZFTlRfQ0hBTkdFX1NVQl9WSUVXJ1xuXG4gICAgc2VjdGlvbnMgOlxuICAgICAgICBIT01FIDogJ2luZGV4Lmh0bWwnXG5cbiAgICBjdXJyZW50ICA6IGFyZWEgOiBudWxsLCBzdWIgOiBudWxsXG4gICAgcHJldmlvdXMgOiBhcmVhIDogbnVsbCwgc3ViIDogbnVsbFxuXG4gICAgY29uc3RydWN0b3I6IC0+XG5cbiAgICAgICAgQENEX0NFKCkucm91dGVyLm9uIFJvdXRlci5FVkVOVF9IQVNIX0NIQU5HRUQsIEBjaGFuZ2VWaWV3XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlXG5cbiAgICBnZXRTZWN0aW9uIDogKHNlY3Rpb24pID0+XG5cbiAgICAgICAgaWYgc2VjdGlvbiBpcyAnJyB0aGVuIHJldHVybiB0cnVlXG5cbiAgICAgICAgZm9yIHNlY3Rpb25OYW1lLCB1cmkgb2YgQHNlY3Rpb25zXG4gICAgICAgICAgICBpZiB1cmkgaXMgc2VjdGlvbiB0aGVuIHJldHVybiBzZWN0aW9uTmFtZVxuXG4gICAgICAgIGZhbHNlXG5cbiAgICBjaGFuZ2VWaWV3OiAoYXJlYSwgc3ViLCBwYXJhbXMpID0+XG5cbiAgICAgICAgIyBjb25zb2xlLmxvZyBcImFyZWFcIixhcmVhXG4gICAgICAgICMgY29uc29sZS5sb2cgXCJzdWJcIixzdWJcbiAgICAgICAgIyBjb25zb2xlLmxvZyBcInBhcmFtc1wiLHBhcmFtc1xuXG4gICAgICAgIEBwcmV2aW91cyA9IEBjdXJyZW50XG4gICAgICAgIEBjdXJyZW50ICA9IGFyZWEgOiBhcmVhLCBzdWIgOiBzdWJcblxuICAgICAgICBpZiBAcHJldmlvdXMuYXJlYSBhbmQgQHByZXZpb3VzLmFyZWEgaXMgQGN1cnJlbnQuYXJlYVxuICAgICAgICAgICAgQHRyaWdnZXIgTmF2LkVWRU5UX0NIQU5HRV9TVUJfVklFVywgQGN1cnJlbnRcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgQHRyaWdnZXIgTmF2LkVWRU5UX0NIQU5HRV9WSUVXLCBAcHJldmlvdXMsIEBjdXJyZW50XG4gICAgICAgICAgICBAdHJpZ2dlciBOYXYuRVZFTlRfQ0hBTkdFX1NVQl9WSUVXLCBAY3VycmVudFxuXG4gICAgICAgIGlmIEBDRF9DRSgpLmFwcFZpZXcubW9kYWxNYW5hZ2VyLmlzT3BlbigpIHRoZW4gQENEX0NFKCkuYXBwVmlldy5tb2RhbE1hbmFnZXIuaGlkZU9wZW5Nb2RhbCgpXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IE5hdlxuIiwiY2xhc3MgUm91dGVyIGV4dGVuZHMgQmFja2JvbmUuUm91dGVyXG5cbiAgICBARVZFTlRfSEFTSF9DSEFOR0VEIDogJ0VWRU5UX0hBU0hfQ0hBTkdFRCdcblxuICAgIEZJUlNUX1JPVVRFIDogdHJ1ZVxuXG4gICAgcm91dGVzIDpcbiAgICAgICAgJygvKSg6YXJlYSkoLzpzdWIpKC8pJyA6ICdoYXNoQ2hhbmdlZCdcbiAgICAgICAgJyphY3Rpb25zJyAgICAgICAgICAgICA6ICduYXZpZ2F0ZVRvJ1xuXG4gICAgYXJlYSAgIDogbnVsbFxuICAgIHN1YiAgICA6IG51bGxcbiAgICBwYXJhbXMgOiBudWxsXG5cbiAgICBzdGFydCA6ID0+XG5cbiAgICAgICAgQmFja2JvbmUuaGlzdG9yeS5zdGFydCBcbiAgICAgICAgICAgIHB1c2hTdGF0ZSA6IHRydWVcbiAgICAgICAgICAgIHJvb3QgICAgICA6ICcvJ1xuXG4gICAgICAgIG51bGxcblxuICAgIGhhc2hDaGFuZ2VkIDogKEBhcmVhID0gbnVsbCwgQHN1YiA9IG51bGwpID0+XG5cbiAgICAgICAgY29uc29sZS5sb2cgXCI+PiBFVkVOVF9IQVNIX0NIQU5HRUQgQGFyZWEgPSAje0BhcmVhfSwgQHN1YiA9ICN7QHN1Yn0gPDxcIlxuXG4gICAgICAgIGlmIEBGSVJTVF9ST1VURSB0aGVuIEBGSVJTVF9ST1VURSA9IGZhbHNlXG5cbiAgICAgICAgaWYgIUBhcmVhIHRoZW4gQGFyZWEgPSBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRVxuXG4gICAgICAgIEB0cmlnZ2VyIFJvdXRlci5FVkVOVF9IQVNIX0NIQU5HRUQsIEBhcmVhLCBAc3ViLCBAcGFyYW1zXG5cbiAgICAgICAgbnVsbFxuXG4gICAgbmF2aWdhdGVUbyA6ICh3aGVyZSA9ICcnLCB0cmlnZ2VyID0gdHJ1ZSwgcmVwbGFjZSA9IGZhbHNlLCBAcGFyYW1zKSA9PlxuXG4gICAgICAgIGlmIHdoZXJlLmNoYXJBdCgwKSBpc250IFwiL1wiXG4gICAgICAgICAgICB3aGVyZSA9IFwiLyN7d2hlcmV9XCJcbiAgICAgICAgaWYgd2hlcmUuY2hhckF0KCB3aGVyZS5sZW5ndGgtMSApIGlzbnQgXCIvXCJcbiAgICAgICAgICAgIHdoZXJlID0gXCIje3doZXJlfS9cIlxuXG4gICAgICAgIGlmICF0cmlnZ2VyXG4gICAgICAgICAgICBAdHJpZ2dlciBSb3V0ZXIuRVZFTlRfSEFTSF9DSEFOR0VELCB3aGVyZSwgbnVsbCwgQHBhcmFtc1xuICAgICAgICAgICAgcmV0dXJuXG5cbiAgICAgICAgQG5hdmlnYXRlIHdoZXJlLCB0cmlnZ2VyOiB0cnVlLCByZXBsYWNlOiByZXBsYWNlXG5cbiAgICAgICAgbnVsbFxuXG4gICAgQ0RfQ0UgOiA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBSb3V0ZXJcbiIsIiMjI1xuQW5hbHl0aWNzIHdyYXBwZXJcbiMjI1xuY2xhc3MgQW5hbHl0aWNzXG5cbiAgICB0YWdzICAgIDogbnVsbFxuICAgIHN0YXJ0ZWQgOiBmYWxzZVxuXG4gICAgYXR0ZW1wdHMgICAgICAgIDogMFxuICAgIGFsbG93ZWRBdHRlbXB0cyA6IDVcblxuICAgIGNvbnN0cnVjdG9yIDogKGRhdGEsIEBjYWxsYmFjaykgLT5cblxuICAgICAgICBAcGFyc2VEYXRhIGRhdGFcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgcGFyc2VEYXRhIDogKGRhdGEpID0+XG5cbiAgICAgICAgQHRhZ3MgICAgPSBkYXRhXG4gICAgICAgIEBzdGFydGVkID0gdHJ1ZVxuICAgICAgICBAY2FsbGJhY2s/KClcblxuICAgICAgICBudWxsXG5cbiAgICAjIyNcbiAgICBAcGFyYW0gc3RyaW5nIGlkIG9mIHRoZSB0cmFja2luZyB0YWcgdG8gYmUgcHVzaGVkIG9uIEFuYWx5dGljcyBcbiAgICAjIyNcbiAgICB0cmFjayA6IChwYXJhbSkgPT5cblxuICAgICAgICByZXR1cm4gaWYgIUBzdGFydGVkXG5cbiAgICAgICAgaWYgcGFyYW1cblxuICAgICAgICAgICAgdiA9IEB0YWdzW3BhcmFtXVxuXG4gICAgICAgICAgICBpZiB2XG5cbiAgICAgICAgICAgICAgICBhcmdzID0gWydzZW5kJywgJ2V2ZW50J11cbiAgICAgICAgICAgICAgICAoIGFyZ3MucHVzaChhcmcpICkgZm9yIGFyZyBpbiB2XG5cbiAgICAgICAgICAgICAgICAjIGxvYWRpbmcgR0EgYWZ0ZXIgbWFpbiBhcHAgSlMsIHNvIGV4dGVybmFsIHNjcmlwdCBtYXkgbm90IGJlIGhlcmUgeWV0XG4gICAgICAgICAgICAgICAgaWYgd2luZG93LmdhXG4gICAgICAgICAgICAgICAgICAgIGdhLmFwcGx5IG51bGwsIGFyZ3NcbiAgICAgICAgICAgICAgICBlbHNlIGlmIEBhdHRlbXB0cyA+PSBAYWxsb3dlZEF0dGVtcHRzXG4gICAgICAgICAgICAgICAgICAgIEBzdGFydGVkID0gZmFsc2VcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgIEB0cmFjayBwYXJhbVxuICAgICAgICAgICAgICAgICAgICAgICAgQGF0dGVtcHRzKytcbiAgICAgICAgICAgICAgICAgICAgLCAyMDAwXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFuYWx5dGljc1xuIiwiQWJzdHJhY3REYXRhID0gcmVxdWlyZSAnLi4vZGF0YS9BYnN0cmFjdERhdGEnXG5GYWNlYm9vayAgICAgPSByZXF1aXJlICcuLi91dGlscy9GYWNlYm9vaydcbkdvb2dsZVBsdXMgICA9IHJlcXVpcmUgJy4uL3V0aWxzL0dvb2dsZVBsdXMnXG5cbmNsYXNzIEF1dGhNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cblx0dXNlckRhdGEgIDogbnVsbFxuXG5cdCMgQHByb2Nlc3MgdHJ1ZSBkdXJpbmcgbG9naW4gcHJvY2Vzc1xuXHRwcm9jZXNzICAgICAgOiBmYWxzZVxuXHRwcm9jZXNzVGltZXIgOiBudWxsXG5cdHByb2Nlc3NXYWl0ICA6IDUwMDBcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdXNlckRhdGEgID0gQENEX0NFKCkuYXBwRGF0YS5VU0VSXG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGxvZ2luIDogKHNlcnZpY2UsIGNiPW51bGwpID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwiKysrKyBQUk9DRVNTIFwiLEBwcm9jZXNzXG5cblx0XHRyZXR1cm4gaWYgQHByb2Nlc3NcblxuXHRcdEBzaG93TG9hZGVyKClcblx0XHRAcHJvY2VzcyA9IHRydWVcblxuXHRcdCRkYXRhRGZkID0gJC5EZWZlcnJlZCgpXG5cblx0XHRzd2l0Y2ggc2VydmljZVxuXHRcdFx0d2hlbiAnZ29vZ2xlJ1xuXHRcdFx0XHRHb29nbGVQbHVzLmxvZ2luICRkYXRhRGZkXG5cdFx0XHR3aGVuICdmYWNlYm9vaydcblx0XHRcdFx0RmFjZWJvb2subG9naW4gJGRhdGFEZmRcblxuXHRcdCRkYXRhRGZkLmRvbmUgKHJlcykgPT4gQGF1dGhTdWNjZXNzIHNlcnZpY2UsIHJlc1xuXHRcdCRkYXRhRGZkLmZhaWwgKHJlcykgPT4gQGF1dGhGYWlsIHNlcnZpY2UsIHJlc1xuXHRcdCRkYXRhRGZkLmFsd2F5cyAoKSA9PiBAYXV0aENhbGxiYWNrIGNiXG5cblx0XHQjIyNcblx0XHRVbmZvcnR1bmF0ZWx5IG5vIGNhbGxiYWNrIGlzIGZpcmVkIGlmIHVzZXIgbWFudWFsbHkgY2xvc2VzIEcrIGxvZ2luIG1vZGFsLFxuXHRcdHNvIHRoaXMgaXMgdG8gYWxsb3cgdGhlbSB0byBjbG9zZSB3aW5kb3cgYW5kIHRoZW4gc3Vic2VxdWVudGx5IHRyeSB0byBsb2cgaW4gYWdhaW4uLi5cblx0XHQjIyNcblx0XHRAcHJvY2Vzc1RpbWVyID0gc2V0VGltZW91dCBAYXV0aENhbGxiYWNrLCBAcHJvY2Vzc1dhaXRcblxuXHRcdCRkYXRhRGZkXG5cblx0YXV0aFN1Y2Nlc3MgOiAoc2VydmljZSwgZGF0YSkgPT5cblxuXHRcdCMgY29uc29sZS5sb2cgXCJsb2dpbiBjYWxsYmFjayBmb3IgI3tzZXJ2aWNlfSwgZGF0YSA9PiBcIiwgZGF0YVxuXG5cdFx0bnVsbFxuXG5cdGF1dGhGYWlsIDogKHNlcnZpY2UsIGRhdGEpID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwibG9naW4gZmFpbCBmb3IgI3tzZXJ2aWNlfSA9PiBcIiwgZGF0YVxuXG5cdFx0bnVsbFxuXG5cdGF1dGhDYWxsYmFjayA6IChjYj1udWxsKSA9PlxuXG5cdFx0cmV0dXJuIHVubGVzcyBAcHJvY2Vzc1xuXG5cdFx0Y2xlYXJUaW1lb3V0IEBwcm9jZXNzVGltZXJcblxuXHRcdEBoaWRlTG9hZGVyKClcblx0XHRAcHJvY2VzcyA9IGZhbHNlXG5cblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdCMjI1xuXHRzaG93IC8gaGlkZSBzb21lIFVJIGluZGljYXRvciB0aGF0IHdlIGFyZSB3YWl0aW5nIGZvciBzb2NpYWwgbmV0d29yayB0byByZXNwb25kXG5cdCMjI1xuXHRzaG93TG9hZGVyIDogPT5cblxuXHRcdCMgY29uc29sZS5sb2cgXCJzaG93TG9hZGVyXCJcblxuXHRcdG51bGxcblxuXHRoaWRlTG9hZGVyIDogPT5cblxuXHRcdCMgY29uc29sZS5sb2cgXCJoaWRlTG9hZGVyXCJcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRoTWFuYWdlclxuIiwiZW5jb2RlID0gcmVxdWlyZSAnZW50L2VuY29kZSdcblxuY2xhc3MgQ29kZVdvcmRUcmFuc2l0aW9uZXJcblxuXHRAY29uZmlnIDpcblx0XHRNSU5fV1JPTkdfQ0hBUlMgOiAxXG5cdFx0TUFYX1dST05HX0NIQVJTIDogN1xuXG5cdFx0TUlOX0NIQVJfSU5fREVMQVkgOiA0MFxuXHRcdE1BWF9DSEFSX0lOX0RFTEFZIDogNzBcblxuXHRcdE1JTl9DSEFSX09VVF9ERUxBWSA6IDQwXG5cdFx0TUFYX0NIQVJfT1VUX0RFTEFZIDogNzBcblxuXHRcdENIQVJTIDogJ2FiY2RlZmhpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5IT8qKClAwqMkJV4mXy0rPVtde306O1xcJ1wiXFxcXHw8PiwuL35gJy5zcGxpdCgnJykubWFwKChjaGFyKSA9PiByZXR1cm4gZW5jb2RlKGNoYXIpKVxuXG5cdFx0Q0hBUl9URU1QTEFURSA6IFwiPHNwYW4gZGF0YS1jb2RldGV4dC1jaGFyPVxcXCJ7eyBjaGFyIH19XFxcIiBkYXRhLWNvZGV0ZXh0LWNoYXItc3RhdGU9XFxcInt7IHN0YXRlIH19XFxcIj57eyBjaGFyIH19PC9zcGFuPlwiXG5cblx0QF93b3JkQ2FjaGUgOiB7fVxuXG5cdEBfZ2V0V29yZEZyb21DYWNoZSA6ICgkZWwsIGluaXRpYWxTdGF0ZT1udWxsKSA9PlxuXG5cdFx0aWQgPSAkZWwuYXR0cignZGF0YS1jb2Rld29yZC1pZCcpXG5cblx0XHRpZiBpZCBhbmQgQF93b3JkQ2FjaGVbIGlkIF1cblx0XHRcdHdvcmQgPSBAX3dvcmRDYWNoZVsgaWQgXVxuXHRcdGVsc2Vcblx0XHRcdEBfd3JhcENoYXJzICRlbCwgaW5pdGlhbFN0YXRlXG5cdFx0XHR3b3JkID0gQF9hZGRXb3JkVG9DYWNoZSAkZWxcblxuXHRcdHdvcmRcblxuXHRAX2FkZFdvcmRUb0NhY2hlIDogKCRlbCkgPT5cblxuXHRcdGNoYXJzID0gW11cblxuXHRcdCRlbC5maW5kKCdbZGF0YS1jb2RldGV4dC1jaGFyXScpLmVhY2ggKGksIGVsKSA9PlxuXHRcdFx0JGNoYXJFbCA9ICQoZWwpXG5cdFx0XHRjaGFycy5wdXNoXG5cdFx0XHRcdCRlbCAgICAgICAgOiAkY2hhckVsXG5cdFx0XHRcdHJpZ2h0Q2hhciAgOiAkY2hhckVsLmF0dHIoJ2RhdGEtY29kZXRleHQtY2hhcicpXG5cblx0XHRpZCA9IF8udW5pcXVlSWQoKVxuXHRcdCRlbC5hdHRyICdkYXRhLWNvZGV3b3JkLWlkJywgaWRcblxuXHRcdEBfd29yZENhY2hlWyBpZCBdID1cblx0XHRcdHdvcmQgICAgOiBfLnBsdWNrKGNoYXJzLCAncmlnaHRDaGFyJykuam9pbignJylcblx0XHRcdCRlbCAgICAgOiAkZWxcblx0XHRcdGNoYXJzICAgOiBjaGFyc1xuXHRcdFx0dmlzaWJsZSA6IHRydWVcblxuXHRcdEBfd29yZENhY2hlWyBpZCBdXG5cblx0QF93cmFwQ2hhcnMgOiAoJGVsLCBpbml0aWFsU3RhdGU9bnVsbCkgPT5cblxuXHRcdGNoYXJzID0gJGVsLnRleHQoKS5zcGxpdCgnJylcblx0XHRzdGF0ZSA9IGluaXRpYWxTdGF0ZSBvciAkZWwuYXR0cignZGF0YS1jb2Rld29yZC1pbml0aWFsLXN0YXRlJykgb3IgXCJcIlxuXHRcdGh0bWwgPSBbXVxuXHRcdGZvciBjaGFyIGluIGNoYXJzXG5cdFx0XHRodG1sLnB1c2ggQF9zdXBwbGFudFN0cmluZyBAY29uZmlnLkNIQVJfVEVNUExBVEUsIGNoYXIgOiBjaGFyLCBzdGF0ZTogc3RhdGVcblxuXHRcdCRlbC5odG1sIGh0bWwuam9pbignJylcblxuXHRcdG51bGxcblxuXHQjIEBwYXJhbSB0YXJnZXQgPSAncmlnaHQnLCAnd3JvbmcnLCAnZW1wdHknXG5cdEBfcHJlcGFyZVdvcmQgOiAod29yZCwgdGFyZ2V0LCBjaGFyU3RhdGU9JycpID0+XG5cblx0XHRmb3IgY2hhciwgaSBpbiB3b3JkLmNoYXJzXG5cblx0XHRcdHRhcmdldENoYXIgPSBzd2l0Y2ggdHJ1ZVxuXHRcdFx0XHR3aGVuIHRhcmdldCBpcyAncmlnaHQnIHRoZW4gY2hhci5yaWdodENoYXJcblx0XHRcdFx0d2hlbiB0YXJnZXQgaXMgJ3dyb25nJyB0aGVuIEBfZ2V0UmFuZG9tQ2hhcigpXG5cdFx0XHRcdHdoZW4gdGFyZ2V0IGlzICdlbXB0eScgdGhlbiAnJ1xuXHRcdFx0XHRlbHNlIHRhcmdldC5jaGFyQXQoaSkgb3IgJydcblxuXHRcdFx0aWYgdGFyZ2V0Q2hhciBpcyAnICcgdGhlbiB0YXJnZXRDaGFyID0gJyZuYnNwOydcblxuXHRcdFx0Y2hhci53cm9uZ0NoYXJzID0gQF9nZXRSYW5kb21Xcm9uZ0NoYXJzKClcblx0XHRcdGNoYXIudGFyZ2V0Q2hhciA9IHRhcmdldENoYXJcblx0XHRcdGNoYXIuY2hhclN0YXRlICA9IGNoYXJTdGF0ZVxuXG5cdFx0bnVsbFxuXG5cdEBfZ2V0UmFuZG9tV3JvbmdDaGFycyA6ID0+XG5cblx0XHRjaGFycyA9IFtdXG5cblx0XHRjaGFyQ291bnQgPSBfLnJhbmRvbSBAY29uZmlnLk1JTl9XUk9OR19DSEFSUywgQGNvbmZpZy5NQVhfV1JPTkdfQ0hBUlNcblxuXHRcdGZvciBpIGluIFswLi4uY2hhckNvdW50XVxuXHRcdFx0Y2hhcnMucHVzaFxuXHRcdFx0XHRjaGFyICAgICA6IEBfZ2V0UmFuZG9tQ2hhcigpXG5cdFx0XHRcdGluRGVsYXkgIDogXy5yYW5kb20gQGNvbmZpZy5NSU5fQ0hBUl9JTl9ERUxBWSwgQGNvbmZpZy5NQVhfQ0hBUl9JTl9ERUxBWVxuXHRcdFx0XHRvdXREZWxheSA6IF8ucmFuZG9tIEBjb25maWcuTUlOX0NIQVJfT1VUX0RFTEFZLCBAY29uZmlnLk1BWF9DSEFSX09VVF9ERUxBWVxuXG5cdFx0Y2hhcnNcblxuXHRAX2dldFJhbmRvbUNoYXIgOiA9PlxuXG5cdFx0Y2hhciA9IEBjb25maWcuQ0hBUlNbIF8ucmFuZG9tKDAsIEBjb25maWcuQ0hBUlMubGVuZ3RoLTEpIF1cblxuXHRcdGNoYXJcblxuXHRAX2dldExvbmdlc3RDaGFyRHVyYXRpb24gOiAoY2hhcnMpID0+XG5cblx0XHRsb25nZXN0VGltZSA9IDBcblx0XHRsb25nZXN0VGltZUlkeCA9IDBcblxuXHRcdGZvciBjaGFyLCBpIGluIGNoYXJzXG5cblx0XHRcdHRpbWUgPSAwXG5cdFx0XHQodGltZSArPSB3cm9uZ0NoYXIuaW5EZWxheSArIHdyb25nQ2hhci5vdXREZWxheSkgZm9yIHdyb25nQ2hhciBpbiBjaGFyLndyb25nQ2hhcnNcblx0XHRcdGlmIHRpbWUgPiBsb25nZXN0VGltZVxuXHRcdFx0XHRsb25nZXN0VGltZSA9IHRpbWVcblx0XHRcdFx0bG9uZ2VzdFRpbWVJZHggPSBpXG5cblx0XHRsb25nZXN0VGltZUlkeFxuXG5cdEBfYW5pbWF0ZUNoYXJzIDogKHdvcmQsIHNlcXVlbnRpYWwsIGNiKSA9PlxuXG5cdFx0YWN0aXZlQ2hhciA9IDBcblxuXHRcdGlmIHNlcXVlbnRpYWxcblx0XHRcdEBfYW5pbWF0ZUNoYXIgd29yZC5jaGFycywgYWN0aXZlQ2hhciwgdHJ1ZSwgY2Jcblx0XHRlbHNlXG5cdFx0XHRsb25nZXN0Q2hhcklkeCA9IEBfZ2V0TG9uZ2VzdENoYXJEdXJhdGlvbiB3b3JkLmNoYXJzXG5cdFx0XHRmb3IgY2hhciwgaSBpbiB3b3JkLmNoYXJzXG5cdFx0XHRcdGFyZ3MgPSBbIHdvcmQuY2hhcnMsIGksIGZhbHNlIF1cblx0XHRcdFx0aWYgaSBpcyBsb25nZXN0Q2hhcklkeCB0aGVuIGFyZ3MucHVzaCBjYlxuXHRcdFx0XHRAX2FuaW1hdGVDaGFyLmFwcGx5IEAsIGFyZ3NcblxuXHRcdG51bGxcblxuXHRAX2FuaW1hdGVDaGFyIDogKGNoYXJzLCBpZHgsIHJlY3Vyc2UsIGNiKSA9PlxuXG5cdFx0Y2hhciA9IGNoYXJzW2lkeF1cblxuXHRcdGlmIHJlY3Vyc2VcblxuXHRcdFx0QF9hbmltYXRlV3JvbmdDaGFycyBjaGFyLCA9PlxuXG5cdFx0XHRcdGlmIGlkeCBpcyBjaGFycy5sZW5ndGgtMVxuXHRcdFx0XHRcdEBfYW5pbWF0ZUNoYXJzRG9uZSBjYlxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0QF9hbmltYXRlQ2hhciBjaGFycywgaWR4KzEsIHJlY3Vyc2UsIGNiXG5cblx0XHRlbHNlXG5cblx0XHRcdGlmIHR5cGVvZiBjYiBpcyAnZnVuY3Rpb24nXG5cdFx0XHRcdEBfYW5pbWF0ZVdyb25nQ2hhcnMgY2hhciwgPT4gQF9hbmltYXRlQ2hhcnNEb25lIGNiXG5cdFx0XHRlbHNlXG5cdFx0XHRcdEBfYW5pbWF0ZVdyb25nQ2hhcnMgY2hhclxuXG5cdFx0bnVsbFxuXG5cdEBfYW5pbWF0ZVdyb25nQ2hhcnMgOiAoY2hhciwgY2IpID0+XG5cblx0XHRpZiBjaGFyLndyb25nQ2hhcnMubGVuZ3RoXG5cblx0XHRcdHdyb25nQ2hhciA9IGNoYXIud3JvbmdDaGFycy5zaGlmdCgpXG5cblx0XHRcdHNldFRpbWVvdXQgPT5cblx0XHRcdFx0Y2hhci4kZWwuaHRtbCB3cm9uZ0NoYXIuY2hhclxuXG5cdFx0XHRcdHNldFRpbWVvdXQgPT5cblx0XHRcdFx0XHRAX2FuaW1hdGVXcm9uZ0NoYXJzIGNoYXIsIGNiXG5cdFx0XHRcdCwgd3JvbmdDaGFyLm91dERlbGF5XG5cblx0XHRcdCwgd3JvbmdDaGFyLmluRGVsYXlcblxuXHRcdGVsc2VcblxuXHRcdFx0Y2hhci4kZWxcblx0XHRcdFx0LmF0dHIoJ2RhdGEtY29kZXRleHQtY2hhci1zdGF0ZScsIGNoYXIuY2hhclN0YXRlKVxuXHRcdFx0XHQuaHRtbChjaGFyLnRhcmdldENoYXIpXG5cblx0XHRcdGNiPygpXG5cblx0XHRudWxsXG5cblx0QF9hbmltYXRlQ2hhcnNEb25lIDogKGNiKSA9PlxuXG5cdFx0Y2I/KClcblxuXHRcdG51bGxcblxuXHRAX3N1cHBsYW50U3RyaW5nIDogKHN0ciwgdmFscykgPT5cblxuXHRcdHJldHVybiBzdHIucmVwbGFjZSAve3sgKFtee31dKikgfX0vZywgKGEsIGIpID0+XG5cdFx0XHRyID0gdmFsc1tiXVxuXHRcdFx0KGlmIHR5cGVvZiByIGlzIFwic3RyaW5nXCIgb3IgdHlwZW9mIHIgaXMgXCJudW1iZXJcIiB0aGVuIHIgZWxzZSBhKVxuXG5cdEB0byA6ICh0YXJnZXRUZXh0LCAkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAdG8odGFyZ2V0VGV4dCwgXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXHRcdHdvcmQudmlzaWJsZSA9IHRydWVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgdGFyZ2V0VGV4dCwgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAaW4gOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQGluKF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblx0XHR3b3JkLnZpc2libGUgPSB0cnVlXG5cblx0XHRAX3ByZXBhcmVXb3JkIHdvcmQsICdyaWdodCcsIGNoYXJTdGF0ZVxuXHRcdEBfYW5pbWF0ZUNoYXJzIHdvcmQsIHNlcXVlbnRpYWwsIGNiXG5cblx0XHRudWxsXG5cblx0QG91dCA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAb3V0KF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblx0XHRyZXR1cm4gaWYgIXdvcmQudmlzaWJsZVxuXG5cdFx0d29yZC52aXNpYmxlID0gZmFsc2VcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ2VtcHR5JywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAc2NyYW1ibGUgOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQHNjcmFtYmxlKF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblxuXHRcdHJldHVybiBpZiAhd29yZC52aXNpYmxlXG5cblx0XHRAX3ByZXBhcmVXb3JkIHdvcmQsICd3cm9uZycsIGNoYXJTdGF0ZVxuXHRcdEBfYW5pbWF0ZUNoYXJzIHdvcmQsIHNlcXVlbnRpYWwsIGNiXG5cblx0XHRudWxsXG5cblx0QHVuc2NyYW1ibGUgOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQHVuc2NyYW1ibGUoXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXG5cdFx0cmV0dXJuIGlmICF3b3JkLnZpc2libGVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ3JpZ2h0JywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAcHJlcGFyZSA6ICgkZWwsIGluaXRpYWxTdGF0ZSkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAcHJlcGFyZShfJGVsLCBpbml0aWFsU3RhdGUpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0QF9nZXRXb3JkRnJvbUNhY2hlICRlbCwgaW5pdGlhbFN0YXRlXG5cblx0XHRudWxsXG5cblx0QGdldFNjcmFtYmxlZFdvcmQgOiAod29yZCkgPT5cblxuXHRcdG5ld0NoYXJzID0gW11cblx0XHQobmV3Q2hhcnMucHVzaCBAX2dldFJhbmRvbUNoYXIoKSkgZm9yIGNoYXIgaW4gd29yZC5zcGxpdCgnJylcblxuXHRcdHJldHVybiBuZXdDaGFycy5qb2luKCcnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvZGVXb3JkVHJhbnNpdGlvbmVyXG4iLCJBYnN0cmFjdERhdGEgPSByZXF1aXJlICcuLi9kYXRhL0Fic3RyYWN0RGF0YSdcblxuIyMjXG5cbkZhY2Vib29rIFNESyB3cmFwcGVyIC0gbG9hZCBhc3luY2hyb25vdXNseSwgc29tZSBoZWxwZXIgbWV0aG9kc1xuXG4jIyNcbmNsYXNzIEZhY2Vib29rIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cblx0QHVybCAgICAgICAgIDogJy8vY29ubmVjdC5mYWNlYm9vay5uZXQvZW5fVVMvYWxsLmpzJ1xuXG5cdEBwZXJtaXNzaW9ucyA6ICdlbWFpbCdcblxuXHRAJGRhdGFEZmQgICAgOiBudWxsXG5cdEBsb2FkZWQgICAgICA6IGZhbHNlXG5cblx0QGxvYWQgOiA9PlxuXG5cdFx0IyMjXG5cdFx0VE8gRE9cblx0XHRpbmNsdWRlIHNjcmlwdCBsb2FkZXIgd2l0aCBjYWxsYmFjayB0byA6aW5pdFxuXHRcdCMjI1xuXHRcdCMgcmVxdWlyZSBbQHVybF0sIEBpbml0XG5cblx0XHRudWxsXG5cblx0QGluaXQgOiA9PlxuXG5cdFx0QGxvYWRlZCA9IHRydWVcblxuXHRcdEZCLmluaXRcblx0XHRcdGFwcElkICA6IHdpbmRvdy5jb25maWcuZmJfYXBwX2lkXG5cdFx0XHRzdGF0dXMgOiBmYWxzZVxuXHRcdFx0eGZibWwgIDogZmFsc2VcblxuXHRcdG51bGxcblxuXHRAbG9naW4gOiAoQCRkYXRhRGZkKSA9PlxuXG5cdFx0aWYgIUBsb2FkZWQgdGhlbiByZXR1cm4gQCRkYXRhRGZkLnJlamVjdCAnU0RLIG5vdCBsb2FkZWQnXG5cblx0XHRGQi5sb2dpbiAoIHJlcyApID0+XG5cblx0XHRcdGlmIHJlc1snc3RhdHVzJ10gaXMgJ2Nvbm5lY3RlZCdcblx0XHRcdFx0QGdldFVzZXJEYXRhIHJlc1snYXV0aFJlc3BvbnNlJ11bJ2FjY2Vzc1Rva2VuJ11cblx0XHRcdGVsc2Vcblx0XHRcdFx0QCRkYXRhRGZkLnJlamVjdCAnbm8gd2F5IGpvc2UnXG5cblx0XHQsIHsgc2NvcGU6IEBwZXJtaXNzaW9ucyB9XG5cblx0XHRudWxsXG5cblx0QGdldFVzZXJEYXRhIDogKHRva2VuKSA9PlxuXG5cdFx0dXNlckRhdGEgPSB7fVxuXHRcdHVzZXJEYXRhLmFjY2Vzc190b2tlbiA9IHRva2VuXG5cblx0XHQkbWVEZmQgICA9ICQuRGVmZXJyZWQoKVxuXHRcdCRwaWNEZmQgID0gJC5EZWZlcnJlZCgpXG5cblx0XHRGQi5hcGkgJy9tZScsIChyZXMpIC0+XG5cblx0XHRcdHVzZXJEYXRhLmZ1bGxfbmFtZSA9IHJlcy5uYW1lXG5cdFx0XHR1c2VyRGF0YS5zb2NpYWxfaWQgPSByZXMuaWRcblx0XHRcdHVzZXJEYXRhLmVtYWlsICAgICA9IHJlcy5lbWFpbCBvciBmYWxzZVxuXHRcdFx0JG1lRGZkLnJlc29sdmUoKVxuXG5cdFx0RkIuYXBpICcvbWUvcGljdHVyZScsIHsgJ3dpZHRoJzogJzIwMCcgfSwgKHJlcykgLT5cblxuXHRcdFx0dXNlckRhdGEucHJvZmlsZV9waWMgPSByZXMuZGF0YS51cmxcblx0XHRcdCRwaWNEZmQucmVzb2x2ZSgpXG5cblx0XHQkLndoZW4oJG1lRGZkLCAkcGljRGZkKS5kb25lID0+IEAkZGF0YURmZC5yZXNvbHZlIHVzZXJEYXRhXG5cblx0XHRudWxsXG5cblx0QHNoYXJlIDogKG9wdHMsIGNiKSA9PlxuXG5cdFx0RkIudWkge1xuXHRcdFx0bWV0aG9kICAgICAgOiBvcHRzLm1ldGhvZCBvciAnZmVlZCdcblx0XHRcdG5hbWUgICAgICAgIDogb3B0cy5uYW1lIG9yICcnXG5cdFx0XHRsaW5rICAgICAgICA6IG9wdHMubGluayBvciAnJ1xuXHRcdFx0cGljdHVyZSAgICAgOiBvcHRzLnBpY3R1cmUgb3IgJydcblx0XHRcdGNhcHRpb24gICAgIDogb3B0cy5jYXB0aW9uIG9yICcnXG5cdFx0XHRkZXNjcmlwdGlvbiA6IG9wdHMuZGVzY3JpcHRpb24gb3IgJydcblx0XHR9LCAocmVzcG9uc2UpIC0+XG5cdFx0XHRjYj8ocmVzcG9uc2UpXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gRmFjZWJvb2tcbiIsIkFic3RyYWN0RGF0YSA9IHJlcXVpcmUgJy4uL2RhdGEvQWJzdHJhY3REYXRhJ1xuXG4jIyNcblxuR29vZ2xlKyBTREsgd3JhcHBlciAtIGxvYWQgYXN5bmNocm9ub3VzbHksIHNvbWUgaGVscGVyIG1ldGhvZHNcblxuIyMjXG5jbGFzcyBHb29nbGVQbHVzIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cblx0QHVybCAgICAgIDogJ2h0dHBzOi8vYXBpcy5nb29nbGUuY29tL2pzL2NsaWVudDpwbHVzb25lLmpzJ1xuXG5cdEBwYXJhbXMgICA6XG5cdFx0J2NsaWVudGlkJyAgICAgOiBudWxsXG5cdFx0J2NhbGxiYWNrJyAgICAgOiBudWxsXG5cdFx0J3Njb3BlJyAgICAgICAgOiAnaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC91c2VyaW5mby5lbWFpbCdcblx0XHQnY29va2llcG9saWN5JyA6ICdub25lJ1xuXG5cdEAkZGF0YURmZCA6IG51bGxcblx0QGxvYWRlZCAgIDogZmFsc2VcblxuXHRAbG9hZCA6ID0+XG5cblx0XHQjIyNcblx0XHRUTyBET1xuXHRcdGluY2x1ZGUgc2NyaXB0IGxvYWRlciB3aXRoIGNhbGxiYWNrIHRvIDppbml0XG5cdFx0IyMjXG5cdFx0IyByZXF1aXJlIFtAdXJsXSwgQGluaXRcblxuXHRcdG51bGxcblxuXHRAaW5pdCA6ID0+XG5cblx0XHRAbG9hZGVkID0gdHJ1ZVxuXG5cdFx0QHBhcmFtc1snY2xpZW50aWQnXSA9IHdpbmRvdy5jb25maWcuZ3BfYXBwX2lkXG5cdFx0QHBhcmFtc1snY2FsbGJhY2snXSA9IEBsb2dpbkNhbGxiYWNrXG5cblx0XHRudWxsXG5cblx0QGxvZ2luIDogKEAkZGF0YURmZCkgPT5cblxuXHRcdGlmIEBsb2FkZWRcblx0XHRcdGdhcGkuYXV0aC5zaWduSW4gQHBhcmFtc1xuXHRcdGVsc2Vcblx0XHRcdEAkZGF0YURmZC5yZWplY3QgJ1NESyBub3QgbG9hZGVkJ1xuXG5cdFx0bnVsbFxuXG5cdEBsb2dpbkNhbGxiYWNrIDogKHJlcykgPT5cblxuXHRcdGlmIHJlc1snc3RhdHVzJ11bJ3NpZ25lZF9pbiddXG5cdFx0XHRAZ2V0VXNlckRhdGEgcmVzWydhY2Nlc3NfdG9rZW4nXVxuXHRcdGVsc2UgaWYgcmVzWydlcnJvciddWydhY2Nlc3NfZGVuaWVkJ11cblx0XHRcdEAkZGF0YURmZC5yZWplY3QgJ25vIHdheSBqb3NlJ1xuXG5cdFx0bnVsbFxuXG5cdEBnZXRVc2VyRGF0YSA6ICh0b2tlbikgPT5cblxuXHRcdGdhcGkuY2xpZW50LmxvYWQgJ3BsdXMnLCd2MScsID0+XG5cblx0XHRcdHJlcXVlc3QgPSBnYXBpLmNsaWVudC5wbHVzLnBlb3BsZS5nZXQgJ3VzZXJJZCc6ICdtZSdcblx0XHRcdHJlcXVlc3QuZXhlY3V0ZSAocmVzKSA9PlxuXG5cdFx0XHRcdHVzZXJEYXRhID1cblx0XHRcdFx0XHRhY2Nlc3NfdG9rZW4gOiB0b2tlblxuXHRcdFx0XHRcdGZ1bGxfbmFtZSAgICA6IHJlcy5kaXNwbGF5TmFtZVxuXHRcdFx0XHRcdHNvY2lhbF9pZCAgICA6IHJlcy5pZFxuXHRcdFx0XHRcdGVtYWlsICAgICAgICA6IGlmIHJlcy5lbWFpbHNbMF0gdGhlbiByZXMuZW1haWxzWzBdLnZhbHVlIGVsc2UgZmFsc2Vcblx0XHRcdFx0XHRwcm9maWxlX3BpYyAgOiByZXMuaW1hZ2UudXJsXG5cblx0XHRcdFx0QCRkYXRhRGZkLnJlc29sdmUgdXNlckRhdGFcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBHb29nbGVQbHVzXG4iLCIjICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgTWVkaWEgUXVlcmllcyBNYW5hZ2VyIFxuIyAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAgIFxuIyAgIEBhdXRob3IgOiBGw6FiaW8gQXpldmVkbyA8ZmFiaW8uYXpldmVkb0B1bml0OS5jb20+IFVOSVQ5XG4jICAgQGRhdGUgICA6IFNlcHRlbWJlciAxNFxuIyAgIFxuIyAgIEluc3RydWN0aW9ucyBhcmUgb24gL3Byb2plY3Qvc2Fzcy91dGlscy9fcmVzcG9uc2l2ZS5zY3NzLlxuXG5jbGFzcyBNZWRpYVF1ZXJpZXNcblxuICAgICMgQnJlYWtwb2ludHNcbiAgICBAU01BTEwgICAgICAgOiBcInNtYWxsXCJcbiAgICBASVBBRCAgICAgICAgOiBcImlwYWRcIlxuICAgIEBNRURJVU0gICAgICA6IFwibWVkaXVtXCJcbiAgICBATEFSR0UgICAgICAgOiBcImxhcmdlXCJcbiAgICBARVhUUkFfTEFSR0UgOiBcImV4dHJhLWxhcmdlXCJcblxuICAgIEBzZXR1cCA6ID0+XG5cbiAgICAgICAgTWVkaWFRdWVyaWVzLlNNQUxMX0JSRUFLUE9JTlQgID0ge25hbWU6IFwiU21hbGxcIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuU01BTExdfVxuICAgICAgICBNZWRpYVF1ZXJpZXMuTUVESVVNX0JSRUFLUE9JTlQgPSB7bmFtZTogXCJNZWRpdW1cIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuTUVESVVNXX1cbiAgICAgICAgTWVkaWFRdWVyaWVzLkxBUkdFX0JSRUFLUE9JTlQgID0ge25hbWU6IFwiTGFyZ2VcIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuSVBBRCwgTWVkaWFRdWVyaWVzLkxBUkdFLCBNZWRpYVF1ZXJpZXMuRVhUUkFfTEFSR0VdfVxuXG4gICAgICAgIE1lZGlhUXVlcmllcy5CUkVBS1BPSU5UUyA9IFtcbiAgICAgICAgICAgIE1lZGlhUXVlcmllcy5TTUFMTF9CUkVBS1BPSU5UXG4gICAgICAgICAgICBNZWRpYVF1ZXJpZXMuTUVESVVNX0JSRUFLUE9JTlRcbiAgICAgICAgICAgIE1lZGlhUXVlcmllcy5MQVJHRV9CUkVBS1BPSU5UXG4gICAgICAgIF1cbiAgICAgICAgcmV0dXJuXG5cbiAgICBAZ2V0RGV2aWNlU3RhdGUgOiA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5LCBcImFmdGVyXCIpLmdldFByb3BlcnR5VmFsdWUoXCJjb250ZW50XCIpO1xuXG4gICAgQGdldEJyZWFrcG9pbnQgOiA9PlxuXG4gICAgICAgIHN0YXRlID0gTWVkaWFRdWVyaWVzLmdldERldmljZVN0YXRlKClcblxuICAgICAgICBmb3IgaSBpbiBbMC4uLk1lZGlhUXVlcmllcy5CUkVBS1BPSU5UUy5sZW5ndGhdXG4gICAgICAgICAgICBpZiBNZWRpYVF1ZXJpZXMuQlJFQUtQT0lOVFNbaV0uYnJlYWtwb2ludHMuaW5kZXhPZihzdGF0ZSkgPiAtMVxuICAgICAgICAgICAgICAgIHJldHVybiBNZWRpYVF1ZXJpZXMuQlJFQUtQT0lOVFNbaV0ubmFtZVxuXG4gICAgICAgIHJldHVybiBcIlwiXG5cbiAgICBAaXNCcmVha3BvaW50IDogKGJyZWFrcG9pbnQpID0+XG5cbiAgICAgICAgZm9yIGkgaW4gWzAuLi5icmVha3BvaW50LmJyZWFrcG9pbnRzLmxlbmd0aF1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgYnJlYWtwb2ludC5icmVha3BvaW50c1tpXSA9PSBNZWRpYVF1ZXJpZXMuZ2V0RGV2aWNlU3RhdGUoKVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG5cbiAgICAgICAgcmV0dXJuIGZhbHNlXG5cbm1vZHVsZS5leHBvcnRzID0gTWVkaWFRdWVyaWVzIiwiY2xhc3MgTnVtYmVyVXRpbHNcblxuICAgIEBNQVRIX0NPUzogTWF0aC5jb3MgXG4gICAgQE1BVEhfU0lOOiBNYXRoLnNpbiBcbiAgICBATUFUSF9SQU5ET006IE1hdGgucmFuZG9tIFxuICAgIEBNQVRIX0FCUzogTWF0aC5hYnNcbiAgICBATUFUSF9BVEFOMjogTWF0aC5hdGFuMlxuXG4gICAgQGxpbWl0OihudW1iZXIsIG1pbiwgbWF4KS0+XG4gICAgICAgIHJldHVybiBNYXRoLm1pbiggTWF0aC5tYXgobWluLG51bWJlciksIG1heCApXG5cbiAgICBAZ2V0UmFuZG9tQ29sb3I6IC0+XG5cbiAgICAgICAgbGV0dGVycyA9ICcwMTIzNDU2Nzg5QUJDREVGJy5zcGxpdCgnJylcbiAgICAgICAgY29sb3IgPSAnIydcbiAgICAgICAgZm9yIGkgaW4gWzAuLi42XVxuICAgICAgICAgICAgY29sb3IgKz0gbGV0dGVyc1tNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAxNSldXG4gICAgICAgIGNvbG9yXG5cbiAgICBAZ2V0VGltZVN0YW1wRGlmZiA6IChkYXRlMSwgZGF0ZTIpIC0+XG5cbiAgICAgICAgIyBHZXQgMSBkYXkgaW4gbWlsbGlzZWNvbmRzXG4gICAgICAgIG9uZV9kYXkgPSAxMDAwKjYwKjYwKjI0XG4gICAgICAgIHRpbWUgICAgPSB7fVxuXG4gICAgICAgICMgQ29udmVydCBib3RoIGRhdGVzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICBkYXRlMV9tcyA9IGRhdGUxLmdldFRpbWUoKVxuICAgICAgICBkYXRlMl9tcyA9IGRhdGUyLmdldFRpbWUoKVxuXG4gICAgICAgICMgQ2FsY3VsYXRlIHRoZSBkaWZmZXJlbmNlIGluIG1pbGxpc2Vjb25kc1xuICAgICAgICBkaWZmZXJlbmNlX21zID0gZGF0ZTJfbXMgLSBkYXRlMV9tc1xuXG4gICAgICAgICMgdGFrZSBvdXQgbWlsbGlzZWNvbmRzXG4gICAgICAgIGRpZmZlcmVuY2VfbXMgPSBkaWZmZXJlbmNlX21zLzEwMDBcbiAgICAgICAgdGltZS5zZWNvbmRzICA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZV9tcyAlIDYwKVxuXG4gICAgICAgIGRpZmZlcmVuY2VfbXMgPSBkaWZmZXJlbmNlX21zLzYwIFxuICAgICAgICB0aW1lLm1pbnV0ZXMgID0gTWF0aC5mbG9vcihkaWZmZXJlbmNlX21zICUgNjApXG5cbiAgICAgICAgZGlmZmVyZW5jZV9tcyA9IGRpZmZlcmVuY2VfbXMvNjAgXG4gICAgICAgIHRpbWUuaG91cnMgICAgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VfbXMgJSAyNCkgIFxuXG4gICAgICAgIHRpbWUuZGF5cyAgICAgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VfbXMvMjQpXG5cbiAgICAgICAgdGltZVxuXG4gICAgQG1hcDogKCBudW0sIG1pbjEsIG1heDEsIG1pbjIsIG1heDIsIHJvdW5kID0gZmFsc2UsIGNvbnN0cmFpbk1pbiA9IHRydWUsIGNvbnN0cmFpbk1heCA9IHRydWUgKSAtPlxuICAgICAgICBpZiBjb25zdHJhaW5NaW4gYW5kIG51bSA8IG1pbjEgdGhlbiByZXR1cm4gbWluMlxuICAgICAgICBpZiBjb25zdHJhaW5NYXggYW5kIG51bSA+IG1heDEgdGhlbiByZXR1cm4gbWF4MlxuICAgICAgICBcbiAgICAgICAgbnVtMSA9IChudW0gLSBtaW4xKSAvIChtYXgxIC0gbWluMSlcbiAgICAgICAgbnVtMiA9IChudW0xICogKG1heDIgLSBtaW4yKSkgKyBtaW4yXG4gICAgICAgIGlmIHJvdW5kIHRoZW4gcmV0dXJuIE1hdGgucm91bmQobnVtMilcblxuICAgICAgICByZXR1cm4gbnVtMlxuXG4gICAgQHRvUmFkaWFuczogKCBkZWdyZWUgKSAtPlxuICAgICAgICByZXR1cm4gZGVncmVlICogKCBNYXRoLlBJIC8gMTgwIClcblxuICAgIEB0b0RlZ3JlZTogKCByYWRpYW5zICkgLT5cbiAgICAgICAgcmV0dXJuIHJhZGlhbnMgKiAoIDE4MCAvIE1hdGguUEkgKVxuXG4gICAgQGlzSW5SYW5nZTogKCBudW0sIG1pbiwgbWF4LCBjYW5CZUVxdWFsICkgLT5cbiAgICAgICAgaWYgY2FuQmVFcXVhbCB0aGVuIHJldHVybiBudW0gPj0gbWluICYmIG51bSA8PSBtYXhcbiAgICAgICAgZWxzZSByZXR1cm4gbnVtID49IG1pbiAmJiBudW0gPD0gbWF4XG5cbiAgICAjIGNvbnZlcnQgbWV0cmVzIGluIHRvIG0gLyBLTVxuICAgIEBnZXROaWNlRGlzdGFuY2U6IChtZXRyZXMpID0+XG5cbiAgICAgICAgaWYgbWV0cmVzIDwgMTAwMFxuXG4gICAgICAgICAgICByZXR1cm4gXCIje01hdGgucm91bmQobWV0cmVzKX1NXCJcblxuICAgICAgICBlbHNlXG5cbiAgICAgICAgICAgIGttID0gKG1ldHJlcy8xMDAwKS50b0ZpeGVkKDIpXG4gICAgICAgICAgICByZXR1cm4gXCIje2ttfUtNXCJcblxuICAgICMgZnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xMjY3MzM4XG4gICAgQHplcm9GaWxsOiAoIG51bWJlciwgd2lkdGggKSA9PlxuXG4gICAgICAgIHdpZHRoIC09IG51bWJlci50b1N0cmluZygpLmxlbmd0aFxuXG4gICAgICAgIGlmIHdpZHRoID4gMFxuICAgICAgICAgICAgcmV0dXJuIG5ldyBBcnJheSggd2lkdGggKyAoL1xcLi8udGVzdCggbnVtYmVyICkgPyAyIDogMSkgKS5qb2luKCAnMCcgKSArIG51bWJlclxuXG4gICAgICAgIHJldHVybiBudW1iZXIgKyBcIlwiICMgYWx3YXlzIHJldHVybiBhIHN0cmluZ1xuXG5tb2R1bGUuZXhwb3J0cyA9IE51bWJlclV0aWxzXG4iLCIjIyNcbiMgUmVxdWVzdGVyICNcblxuV3JhcHBlciBmb3IgYCQuYWpheGAgY2FsbHNcblxuIyMjXG5jbGFzcyBSZXF1ZXN0ZXJcblxuICAgIEByZXF1ZXN0cyA6IFtdXG5cbiAgICBAcmVxdWVzdDogKCBkYXRhICkgPT5cbiAgICAgICAgIyMjXG4gICAgICAgIGBkYXRhID0ge2A8YnI+XG4gICAgICAgIGAgIHVybCAgICAgICAgIDogU3RyaW5nYDxicj5cbiAgICAgICAgYCAgdHlwZSAgICAgICAgOiBcIlBPU1QvR0VUL1BVVFwiYDxicj5cbiAgICAgICAgYCAgZGF0YSAgICAgICAgOiBPYmplY3RgPGJyPlxuICAgICAgICBgICBkYXRhVHlwZSAgICA6IGpRdWVyeSBkYXRhVHlwZWA8YnI+XG4gICAgICAgIGAgIGNvbnRlbnRUeXBlIDogU3RyaW5nYDxicj5cbiAgICAgICAgYH1gXG4gICAgICAgICMjI1xuXG4gICAgICAgIHIgPSAkLmFqYXgge1xuXG4gICAgICAgICAgICB1cmwgICAgICAgICA6IGRhdGEudXJsXG4gICAgICAgICAgICB0eXBlICAgICAgICA6IGlmIGRhdGEudHlwZSB0aGVuIGRhdGEudHlwZSBlbHNlIFwiUE9TVFwiLFxuICAgICAgICAgICAgZGF0YSAgICAgICAgOiBpZiBkYXRhLmRhdGEgdGhlbiBkYXRhLmRhdGEgZWxzZSBudWxsLFxuICAgICAgICAgICAgZGF0YVR5cGUgICAgOiBpZiBkYXRhLmRhdGFUeXBlIHRoZW4gZGF0YS5kYXRhVHlwZSBlbHNlIFwianNvblwiLFxuICAgICAgICAgICAgY29udGVudFR5cGUgOiBpZiBkYXRhLmNvbnRlbnRUeXBlIHRoZW4gZGF0YS5jb250ZW50VHlwZSBlbHNlIFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCIsXG4gICAgICAgICAgICBwcm9jZXNzRGF0YSA6IGlmIGRhdGEucHJvY2Vzc0RhdGEgIT0gbnVsbCBhbmQgZGF0YS5wcm9jZXNzRGF0YSAhPSB1bmRlZmluZWQgdGhlbiBkYXRhLnByb2Nlc3NEYXRhIGVsc2UgdHJ1ZVxuXG4gICAgICAgIH1cblxuICAgICAgICByLmRvbmUgZGF0YS5kb25lXG4gICAgICAgIHIuZmFpbCBkYXRhLmZhaWxcbiAgICAgICAgXG4gICAgICAgIHJcblxuICAgIEBhZGRJbWFnZSA6IChkYXRhLCBkb25lLCBmYWlsKSA9PlxuICAgICAgICAjIyNcbiAgICAgICAgKiogVXNhZ2U6IDxicj5cbiAgICAgICAgYGRhdGEgPSBjYW52YXNzLnRvRGF0YVVSTChcImltYWdlL2pwZWdcIikuc2xpY2UoXCJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LFwiLmxlbmd0aClgPGJyPlxuICAgICAgICBgUmVxdWVzdGVyLmFkZEltYWdlIGRhdGEsIFwiem9ldHJvcGVcIiwgQGRvbmUsIEBmYWlsYFxuICAgICAgICAjIyNcblxuICAgICAgICBAcmVxdWVzdFxuICAgICAgICAgICAgdXJsICAgIDogJy9hcGkvaW1hZ2VzLydcbiAgICAgICAgICAgIHR5cGUgICA6ICdQT1NUJ1xuICAgICAgICAgICAgZGF0YSAgIDoge2ltYWdlX2Jhc2U2NCA6IGVuY29kZVVSSShkYXRhKX1cbiAgICAgICAgICAgIGRvbmUgICA6IGRvbmVcbiAgICAgICAgICAgIGZhaWwgICA6IGZhaWxcblxuICAgICAgICBudWxsXG5cbiAgICBAZGVsZXRlSW1hZ2UgOiAoaWQsIGRvbmUsIGZhaWwpID0+XG4gICAgICAgIFxuICAgICAgICBAcmVxdWVzdFxuICAgICAgICAgICAgdXJsICAgIDogJy9hcGkvaW1hZ2VzLycraWRcbiAgICAgICAgICAgIHR5cGUgICA6ICdERUxFVEUnXG4gICAgICAgICAgICBkb25lICAgOiBkb25lXG4gICAgICAgICAgICBmYWlsICAgOiBmYWlsXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcXVlc3RlclxuIiwiIyMjXG5TaGFyaW5nIGNsYXNzIGZvciBub24tU0RLIGxvYWRlZCBzb2NpYWwgbmV0d29ya3MuXG5JZiBTREsgaXMgbG9hZGVkLCBhbmQgcHJvdmlkZXMgc2hhcmUgbWV0aG9kcywgdGhlbiB1c2UgdGhhdCBjbGFzcyBpbnN0ZWFkLCBlZy4gYEZhY2Vib29rLnNoYXJlYCBpbnN0ZWFkIG9mIGBTaGFyZS5mYWNlYm9va2BcbiMjI1xuY2xhc3MgU2hhcmVcblxuICAgIHVybCA6IG51bGxcblxuICAgIGNvbnN0cnVjdG9yIDogLT5cblxuICAgICAgICBAdXJsID0gQENEX0NFKCkuU0lURV9VUkxcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgb3BlbldpbiA6ICh1cmwsIHcsIGgpID0+XG5cbiAgICAgICAgbGVmdCA9ICggc2NyZWVuLmF2YWlsV2lkdGggIC0gdyApID4+IDFcbiAgICAgICAgdG9wICA9ICggc2NyZWVuLmF2YWlsSGVpZ2h0IC0gaCApID4+IDFcblxuICAgICAgICB3aW5kb3cub3BlbiB1cmwsICcnLCAndG9wPScrdG9wKycsbGVmdD0nK2xlZnQrJyx3aWR0aD0nK3crJyxoZWlnaHQ9JytoKycsbG9jYXRpb249bm8sbWVudWJhcj1ubydcblxuICAgICAgICBudWxsXG5cbiAgICBwbHVzIDogKCB1cmwgKSA9PlxuXG4gICAgICAgIHVybCA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcblxuICAgICAgICBAb3BlbldpbiBcImh0dHBzOi8vcGx1cy5nb29nbGUuY29tL3NoYXJlP3VybD0je3VybH1cIiwgNjUwLCAzODVcblxuICAgICAgICBudWxsXG5cbiAgICBwaW50ZXJlc3QgOiAodXJsLCBtZWRpYSwgZGVzY3IpID0+XG5cbiAgICAgICAgdXJsICAgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG4gICAgICAgIG1lZGlhID0gZW5jb2RlVVJJQ29tcG9uZW50KG1lZGlhKVxuICAgICAgICBkZXNjciA9IGVuY29kZVVSSUNvbXBvbmVudChkZXNjcilcblxuICAgICAgICBAb3BlbldpbiBcImh0dHA6Ly93d3cucGludGVyZXN0LmNvbS9waW4vY3JlYXRlL2J1dHRvbi8/dXJsPSN7dXJsfSZtZWRpYT0je21lZGlhfSZkZXNjcmlwdGlvbj0je2Rlc2NyfVwiLCA3MzUsIDMxMFxuXG4gICAgICAgIG51bGxcblxuICAgIHR1bWJsciA6ICh1cmwsIG1lZGlhLCBkZXNjcikgPT5cblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgbWVkaWEgPSBlbmNvZGVVUklDb21wb25lbnQobWVkaWEpXG4gICAgICAgIGRlc2NyID0gZW5jb2RlVVJJQ29tcG9uZW50KGRlc2NyKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3d3dy50dW1ibHIuY29tL3NoYXJlL3Bob3RvP3NvdXJjZT0je21lZGlhfSZjYXB0aW9uPSN7ZGVzY3J9JmNsaWNrX3RocnU9I3t1cmx9XCIsIDQ1MCwgNDMwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgZmFjZWJvb2sgOiAoIHVybCAsIGNvcHkgPSAnJykgPT4gXG5cbiAgICAgICAgdXJsICAgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG4gICAgICAgIGRlY3NyID0gZW5jb2RlVVJJQ29tcG9uZW50KGNvcHkpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vd3d3LmZhY2Vib29rLmNvbS9zaGFyZS5waHA/dT0je3VybH0mdD0je2RlY3NyfVwiLCA2MDAsIDMwMFxuXG4gICAgICAgIG51bGxcblxuICAgIHR3aXR0ZXIgOiAoIHVybCAsIGNvcHkgPSAnJykgPT5cblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgaWYgY29weSBpcyAnJ1xuICAgICAgICAgICAgY29weSA9IEBDRF9DRSgpLmxvY2FsZS5nZXQgJ3Nlb190d2l0dGVyX2NhcmRfZGVzY3JpcHRpb24nXG4gICAgICAgICAgICBcbiAgICAgICAgZGVzY3IgPSBlbmNvZGVVUklDb21wb25lbnQoY29weSlcblxuICAgICAgICBAb3BlbldpbiBcImh0dHA6Ly90d2l0dGVyLmNvbS9pbnRlbnQvdHdlZXQvP3RleHQ9I3tkZXNjcn0mdXJsPSN7dXJsfVwiLCA2MDAsIDMwMFxuXG4gICAgICAgIG51bGxcblxuICAgIHJlbnJlbiA6ICggdXJsICkgPT4gXG5cbiAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3NoYXJlLnJlbnJlbi5jb20vc2hhcmUvYnV0dG9uc2hhcmUuZG8/bGluaz1cIiArIHVybCwgNjAwLCAzMDBcblxuICAgICAgICBudWxsXG5cbiAgICB3ZWlibyA6ICggdXJsICkgPT4gXG5cbiAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3NlcnZpY2Uud2VpYm8uY29tL3NoYXJlL3NoYXJlLnBocD91cmw9I3t1cmx9Jmxhbmd1YWdlPXpoX2NuXCIsIDYwMCwgMzAwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgQ0RfQ0UgOiA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBTaGFyZVxuIiwiY2xhc3MgQWJzdHJhY3RWaWV3IGV4dGVuZHMgQmFja2JvbmUuVmlld1xuXG5cdGVsICAgICAgICAgICA6IG51bGxcblx0aWQgICAgICAgICAgIDogbnVsbFxuXHRjaGlsZHJlbiAgICAgOiBudWxsXG5cdHRlbXBsYXRlICAgICA6IG51bGxcblx0dGVtcGxhdGVWYXJzIDogbnVsbFxuXHRcblx0aW5pdGlhbGl6ZSA6IC0+XG5cdFx0XG5cdFx0QGNoaWxkcmVuID0gW11cblxuXHRcdGlmIEB0ZW1wbGF0ZVxuXHRcdFx0dG1wSFRNTCA9IF8udGVtcGxhdGUgQENEX0NFKCkudGVtcGxhdGVzLmdldCBAdGVtcGxhdGVcblx0XHRcdEBzZXRFbGVtZW50IHRtcEhUTUwgQHRlbXBsYXRlVmFyc1xuXG5cdFx0QCRlbC5hdHRyICdpZCcsIEBpZCBpZiBAaWRcblx0XHRAJGVsLmFkZENsYXNzIEBjbGFzc05hbWUgaWYgQGNsYXNzTmFtZVxuXHRcdFxuXHRcdEBpbml0KClcblxuXHRcdEBwYXVzZWQgPSBmYWxzZVxuXG5cdFx0bnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdHVwZGF0ZSA6ID0+XG5cblx0XHRudWxsXG5cblx0cmVuZGVyIDogPT5cblxuXHRcdG51bGxcblxuXHRhZGRDaGlsZCA6IChjaGlsZCwgcHJlcGVuZCA9IGZhbHNlKSA9PlxuXG5cdFx0QGNoaWxkcmVuLnB1c2ggY2hpbGQgaWYgY2hpbGQuZWxcblx0XHR0YXJnZXQgPSBpZiBAYWRkVG9TZWxlY3RvciB0aGVuIEAkZWwuZmluZChAYWRkVG9TZWxlY3RvcikuZXEoMCkgZWxzZSBAJGVsXG5cdFx0XG5cdFx0YyA9IGlmIGNoaWxkLmVsIHRoZW4gY2hpbGQuJGVsIGVsc2UgY2hpbGRcblxuXHRcdGlmICFwcmVwZW5kIFxuXHRcdFx0dGFyZ2V0LmFwcGVuZCBjXG5cdFx0ZWxzZSBcblx0XHRcdHRhcmdldC5wcmVwZW5kIGNcblxuXHRcdEBcblxuXHRyZXBsYWNlIDogKGRvbSwgY2hpbGQpID0+XG5cblx0XHRAY2hpbGRyZW4ucHVzaCBjaGlsZCBpZiBjaGlsZC5lbFxuXHRcdGMgPSBpZiBjaGlsZC5lbCB0aGVuIGNoaWxkLiRlbCBlbHNlIGNoaWxkXG5cdFx0QCRlbC5jaGlsZHJlbihkb20pLnJlcGxhY2VXaXRoKGMpXG5cblx0XHRudWxsXG5cblx0cmVtb3ZlIDogKGNoaWxkKSA9PlxuXG5cdFx0dW5sZXNzIGNoaWxkP1xuXHRcdFx0cmV0dXJuXG5cdFx0XG5cdFx0YyA9IGlmIGNoaWxkLmVsIHRoZW4gY2hpbGQuJGVsIGVsc2UgJChjaGlsZClcblx0XHRjaGlsZC5kaXNwb3NlKCkgaWYgYyBhbmQgY2hpbGQuZGlzcG9zZVxuXG5cdFx0aWYgYyAmJiBAY2hpbGRyZW4uaW5kZXhPZihjaGlsZCkgIT0gLTFcblx0XHRcdEBjaGlsZHJlbi5zcGxpY2UoIEBjaGlsZHJlbi5pbmRleE9mKGNoaWxkKSwgMSApXG5cblx0XHRjLnJlbW92ZSgpXG5cblx0XHRudWxsXG5cblx0b25SZXNpemUgOiAoZXZlbnQpID0+XG5cblx0XHQoaWYgY2hpbGQub25SZXNpemUgdGhlbiBjaGlsZC5vblJlc2l6ZSgpKSBmb3IgY2hpbGQgaW4gQGNoaWxkcmVuXG5cblx0XHRudWxsXG5cblx0bW91c2VFbmFibGVkIDogKCBlbmFibGVkICkgPT5cblxuXHRcdEAkZWwuY3NzXG5cdFx0XHRcInBvaW50ZXItZXZlbnRzXCI6IGlmIGVuYWJsZWQgdGhlbiBcImF1dG9cIiBlbHNlIFwibm9uZVwiXG5cblx0XHRudWxsXG5cblx0Q1NTVHJhbnNsYXRlIDogKHgsIHksIHZhbHVlPSclJywgc2NhbGUpID0+XG5cblx0XHRpZiBNb2Rlcm5penIuY3NzdHJhbnNmb3JtczNkXG5cdFx0XHRzdHIgPSBcInRyYW5zbGF0ZTNkKCN7eCt2YWx1ZX0sICN7eSt2YWx1ZX0sIDApXCJcblx0XHRlbHNlXG5cdFx0XHRzdHIgPSBcInRyYW5zbGF0ZSgje3grdmFsdWV9LCAje3krdmFsdWV9KVwiXG5cblx0XHRpZiBzY2FsZSB0aGVuIHN0ciA9IFwiI3tzdHJ9IHNjYWxlKCN7c2NhbGV9KVwiXG5cblx0XHRzdHJcblxuXHR1bk11dGVBbGwgOiA9PlxuXG5cdFx0Zm9yIGNoaWxkIGluIEBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZC51bk11dGU/KClcblxuXHRcdFx0aWYgY2hpbGQuY2hpbGRyZW4ubGVuZ3RoXG5cblx0XHRcdFx0Y2hpbGQudW5NdXRlQWxsKClcblxuXHRcdG51bGxcblxuXHRtdXRlQWxsIDogPT5cblxuXHRcdGZvciBjaGlsZCBpbiBAY2hpbGRyZW5cblxuXHRcdFx0Y2hpbGQubXV0ZT8oKVxuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRjaGlsZC5tdXRlQWxsKClcblxuXHRcdG51bGxcblxuXHRyZW1vdmVBbGxDaGlsZHJlbjogPT5cblxuXHRcdEByZW1vdmUgY2hpbGQgZm9yIGNoaWxkIGluIEBjaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdHRyaWdnZXJDaGlsZHJlbiA6IChtc2csIGNoaWxkcmVuPUBjaGlsZHJlbikgPT5cblxuXHRcdGZvciBjaGlsZCwgaSBpbiBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZC50cmlnZ2VyIG1zZ1xuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRAdHJpZ2dlckNoaWxkcmVuIG1zZywgY2hpbGQuY2hpbGRyZW5cblxuXHRcdG51bGxcblxuXHRjYWxsQ2hpbGRyZW4gOiAobWV0aG9kLCBwYXJhbXMsIGNoaWxkcmVuPUBjaGlsZHJlbikgPT5cblxuXHRcdGZvciBjaGlsZCwgaSBpbiBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZFttZXRob2RdPyBwYXJhbXNcblxuXHRcdFx0aWYgY2hpbGQuY2hpbGRyZW4ubGVuZ3RoXG5cblx0XHRcdFx0QGNhbGxDaGlsZHJlbiBtZXRob2QsIHBhcmFtcywgY2hpbGQuY2hpbGRyZW5cblxuXHRcdG51bGxcblxuXHRjYWxsQ2hpbGRyZW5BbmRTZWxmIDogKG1ldGhvZCwgcGFyYW1zLCBjaGlsZHJlbj1AY2hpbGRyZW4pID0+XG5cblx0XHRAW21ldGhvZF0/IHBhcmFtc1xuXG5cdFx0Zm9yIGNoaWxkLCBpIGluIGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkW21ldGhvZF0/IHBhcmFtc1xuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRAY2FsbENoaWxkcmVuIG1ldGhvZCwgcGFyYW1zLCBjaGlsZC5jaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdHN1cHBsYW50U3RyaW5nIDogKHN0ciwgdmFscykgLT5cblxuXHRcdHJldHVybiBzdHIucmVwbGFjZSAve3sgKFtee31dKikgfX0vZywgKGEsIGIpIC0+XG5cdFx0XHRyID0gdmFsc1tiXVxuXHRcdFx0KGlmIHR5cGVvZiByIGlzIFwic3RyaW5nXCIgb3IgdHlwZW9mIHIgaXMgXCJudW1iZXJcIiB0aGVuIHIgZWxzZSBhKVxuXG5cdGRpc3Bvc2UgOiA9PlxuXG5cdFx0IyMjXG5cdFx0b3ZlcnJpZGUgb24gcGVyIHZpZXcgYmFzaXMgLSB1bmJpbmQgZXZlbnQgaGFuZGxlcnMgZXRjXG5cdFx0IyMjXG5cblx0XHRudWxsXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Vmlld1xuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi9BYnN0cmFjdFZpZXcnXG5cbmNsYXNzIEFic3RyYWN0Vmlld1BhZ2UgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuXHRfc2hvd24gICAgIDogZmFsc2Vcblx0X2xpc3RlbmluZyA6IGZhbHNlXG5cblx0c2hvdyA6IChjYikgPT5cblxuXHRcdHJldHVybiB1bmxlc3MgIUBfc2hvd25cblx0XHRAX3Nob3duID0gdHJ1ZVxuXG5cdFx0IyMjXG5cdFx0Q0hBTkdFIEhFUkUgLSAncGFnZScgdmlld3MgYXJlIGFsd2F5cyBpbiBET00gLSB0byBzYXZlIGhhdmluZyB0byByZS1pbml0aWFsaXNlIGdtYXAgZXZlbnRzIChQSVRBKS4gTm8gbG9uZ2VyIHJlcXVpcmUgOmRpc3Bvc2UgbWV0aG9kXG5cdFx0IyMjXG5cdFx0QENEX0NFKCkuYXBwVmlldy53cmFwcGVyLmFkZENoaWxkIEBcblx0XHRAY2FsbENoaWxkcmVuQW5kU2VsZiAnc2V0TGlzdGVuZXJzJywgJ29uJ1xuXG5cdFx0IyMjIHJlcGxhY2Ugd2l0aCBzb21lIHByb3BlciB0cmFuc2l0aW9uIGlmIHdlIGNhbiAjIyNcblx0XHRAJGVsLmNzcyAndmlzaWJpbGl0eScgOiAndmlzaWJsZSdcblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdGhpZGUgOiAoY2IpID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIEBfc2hvd25cblx0XHRAX3Nob3duID0gZmFsc2VcblxuXHRcdCMjI1xuXHRcdENIQU5HRSBIRVJFIC0gJ3BhZ2UnIHZpZXdzIGFyZSBhbHdheXMgaW4gRE9NIC0gdG8gc2F2ZSBoYXZpbmcgdG8gcmUtaW5pdGlhbGlzZSBnbWFwIGV2ZW50cyAoUElUQSkuIE5vIGxvbmdlciByZXF1aXJlIDpkaXNwb3NlIG1ldGhvZFxuXHRcdCMjI1xuXHRcdEBDRF9DRSgpLmFwcFZpZXcud3JhcHBlci5yZW1vdmUgQFxuXG5cdFx0IyBAY2FsbENoaWxkcmVuQW5kU2VsZiAnc2V0TGlzdGVuZXJzJywgJ29mZidcblxuXHRcdCMjIyByZXBsYWNlIHdpdGggc29tZSBwcm9wZXIgdHJhbnNpdGlvbiBpZiB3ZSBjYW4gIyMjXG5cdFx0QCRlbC5jc3MgJ3Zpc2liaWxpdHknIDogJ2hpZGRlbidcblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdGRpc3Bvc2UgOiA9PlxuXG5cdFx0QGNhbGxDaGlsZHJlbkFuZFNlbGYgJ3NldExpc3RlbmVycycsICdvZmYnXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIHNldHRpbmcgaXNudCBAX2xpc3RlbmluZ1xuXHRcdEBfbGlzdGVuaW5nID0gc2V0dGluZ1xuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Vmlld1BhZ2VcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0VmlldydcblxuY2xhc3MgRm9vdGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cbiAgICB0ZW1wbGF0ZSA6ICdzaXRlLWZvb3RlcidcblxuICAgIGNvbnN0cnVjdG9yOiAtPlxuXG4gICAgICAgIEB0ZW1wbGF0ZVZhcnMgPSBcbiAgICAgICAgXHRkZXNjIDogQENEX0NFKCkubG9jYWxlLmdldCBcImZvb3Rlcl9kZXNjXCJcblxuICAgICAgICBzdXBlcigpXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBGb290ZXJcbiIsIkFic3RyYWN0VmlldyAgICAgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuUm91dGVyICAgICAgICAgICAgICAgPSByZXF1aXJlICcuLi8uLi9yb3V0ZXIvUm91dGVyJ1xuQ29kZVdvcmRUcmFuc2l0aW9uZXIgPSByZXF1aXJlICcuLi8uLi91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lcidcblxuY2xhc3MgSGVhZGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cblx0dGVtcGxhdGUgOiAnc2l0ZS1oZWFkZXInXG5cblx0RklSU1RfSEFTSENIQU5HRSA6IHRydWVcblx0RE9PRExFX0lORk9fT1BFTiA6IGZhbHNlXG5cblx0RVZFTlRfRE9PRExFX0lORk9fT1BFTiAgIDogJ0VWRU5UX0RPT0RMRV9JTkZPX09QRU4nXG5cdEVWRU5UX0RPT0RMRV9JTkZPX0NMT1NFICA6ICdFVkVOVF9ET09ETEVfSU5GT19DTE9TRSdcblx0RVZFTlRfSE9NRV9TQ1JPTExfVE9fVE9QIDogJ0VWRU5UX0hPTUVfU0NST0xMX1RPX1RPUCdcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdGVtcGxhdGVWYXJzID1cblx0XHRcdGhvbWVfbGFiZWwgIDogQENEX0NFKCkubG9jYWxlLmdldCgnaGVhZGVyX2xvZ29fbGFiZWwnKVxuXHRcdFx0Y2xvc2VfbGFiZWwgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdoZWFkZXJfY2xvc2VfbGFiZWwnKVxuXHRcdFx0aW5mb19sYWJlbCAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdoZWFkZXJfaW5mb19sYWJlbCcpXG5cblx0XHRzdXBlcigpXG5cblx0XHRAYmluZEV2ZW50cygpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0QCRsb2dvICAgICA9IEAkZWwuZmluZCgnLmxvZ29fX2xpbmsnKVxuXHRcdEAkaW5mb0J0biAgPSBAJGVsLmZpbmQoJy5pbmZvLWJ0bicpXG5cdFx0QCRjbG9zZUJ0biA9IEAkZWwuZmluZCgnLmNsb3NlLWJ0bicpXG5cblx0XHRudWxsXG5cblx0YmluZEV2ZW50cyA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9uIEBDRF9DRSgpLmFwcFZpZXcuRVZFTlRfUFJFTE9BREVSX0hJREUsIEBhbmltYXRlVGV4dEluXG5cdFx0QENEX0NFKCkucm91dGVyLm9uIFJvdXRlci5FVkVOVF9IQVNIX0NIQU5HRUQsIEBvbkhhc2hDaGFuZ2VcblxuXHRcdEAkZWwub24gJ21vdXNlZW50ZXInLCAnW2RhdGEtY29kZXdvcmRdJywgQG9uV29yZEVudGVyXG5cdFx0QCRlbC5vbiAnbW91c2VsZWF2ZScsICdbZGF0YS1jb2Rld29yZF0nLCBAb25Xb3JkTGVhdmVcblxuXHRcdEAkaW5mb0J0bi5vbiAnY2xpY2snLCBAb25JbmZvQnRuQ2xpY2tcblx0XHRAJGNsb3NlQnRuLm9uICdjbGljaycsIEBvbkNsb3NlQnRuQ2xpY2tcblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuJHdpbmRvdy5vbiAna2V5dXAnLCBAb25LZXl1cFxuXG5cdFx0bnVsbFxuXG5cdG9uSGFzaENoYW5nZSA6ICh3aGVyZSkgPT5cblxuXHRcdGlmIEBGSVJTVF9IQVNIQ0hBTkdFXG5cdFx0XHRARklSU1RfSEFTSENIQU5HRSA9IGZhbHNlXG5cdFx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5wcmVwYXJlIFtAJGxvZ28sIEAkaW5mb0J0bl0sIEBfZ2V0RG9vZGxlQ29sb3VyU2NoZW1lKClcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLm91dCBbQCRjbG9zZUJ0bl0sIEBfZ2V0RG9vZGxlQ29sb3VyU2NoZW1lKClcblx0XHRcdHJldHVyblxuXHRcdFxuXHRcdEBvbkFyZWFDaGFuZ2Ugd2hlcmVcblxuXHRcdG51bGxcblxuXHRvbkFyZWFDaGFuZ2UgOiAoc2VjdGlvbikgPT5cblxuXHRcdEBhY3RpdmVTZWN0aW9uID0gc2VjdGlvblxuXHRcdFxuXHRcdGNvbG91ciA9IEBnZXRTZWN0aW9uQ29sb3VyIHNlY3Rpb25cblxuXHRcdEAkZWwuYXR0ciAnZGF0YS1zZWN0aW9uJywgc2VjdGlvblxuXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIuaW4gQCRsb2dvLCBjb2xvdXJcblxuXHRcdGlmIHNlY3Rpb24gaXMgQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUVcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLmluIFtAJGluZm9CdG5dLCBjb2xvdXJcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLm91dCBbQCRjbG9zZUJ0bl0sIGNvbG91clxuXHRcdGVsc2UgaWYgc2VjdGlvbiBpcyAnZG9vZGxlLWluZm8nXG5cdFx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5pbiBbQCRjbG9zZUJ0bl0sIGNvbG91clxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIuaW4gW0AkaW5mb0J0bl0sICdvZmZ3aGl0ZS1yZWQtYmcnXG5cblx0XHRudWxsXG5cblx0Z2V0U2VjdGlvbkNvbG91ciA6IChzZWN0aW9uLCB3b3JkU2VjdGlvbj1udWxsKSA9PlxuXG5cdFx0c2VjdGlvbiA9IHNlY3Rpb24gb3IgQENEX0NFKCkubmF2LmN1cnJlbnQuYXJlYSBvciAnaG9tZSdcblxuXHRcdGlmIHdvcmRTZWN0aW9uIGFuZCBzZWN0aW9uIGlzIHdvcmRTZWN0aW9uXG5cdFx0XHRpZiB3b3JkU2VjdGlvbiBpcyAnZG9vZGxlLWluZm8nXG5cdFx0XHRcdHJldHVybiAnb2Zmd2hpdGUtcmVkLWJnJ1xuXHRcdFx0ZWxzZVxuXHRcdFx0XHRyZXR1cm4gJ2JsYWNrLXdoaXRlLWJnJ1xuXG5cdFx0Y29sb3VyID0gc3dpdGNoIHNlY3Rpb25cblx0XHRcdHdoZW4gJ2hvbWUnLCAnZG9vZGxlLWluZm8nIHRoZW4gJ3JlZCdcblx0XHRcdHdoZW4gQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUUgdGhlbiBAX2dldERvb2RsZUNvbG91clNjaGVtZSgpXG5cdFx0XHRlbHNlICd3aGl0ZSdcblxuXHRcdGNvbG91clxuXG5cdF9nZXREb29kbGVDb2xvdXJTY2hlbWUgOiA9PlxuXG5cdFx0Y29sb3VyID0gaWYgQENEX0NFKCkuYXBwRGF0YS5hY3RpdmVEb29kbGUuZ2V0KCdjb2xvdXJfc2NoZW1lJykgaXMgJ2xpZ2h0JyB0aGVuICdibGFjaycgZWxzZSAnd2hpdGUnXG5cblx0XHRjb2xvdXJcblxuXHRhbmltYXRlVGV4dEluIDogPT5cblxuXHRcdEBvbkFyZWFDaGFuZ2UgQENEX0NFKCkubmF2LmN1cnJlbnQuYXJlYVxuXG5cdFx0bnVsbFxuXG5cdG9uV29yZEVudGVyIDogKGUpID0+XG5cblx0XHQkZWwgPSAkKGUuY3VycmVudFRhcmdldClcblx0XHR3b3JkU2VjdGlvbiA9ICRlbC5hdHRyKCdkYXRhLXdvcmQtc2VjdGlvbicpXG5cblx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5zY3JhbWJsZSAkZWwsIEBnZXRTZWN0aW9uQ29sb3VyKEBhY3RpdmVTZWN0aW9uLCB3b3JkU2VjdGlvbilcblxuXHRcdG51bGxcblxuXHRvbldvcmRMZWF2ZSA6IChlKSA9PlxuXG5cdFx0JGVsID0gJChlLmN1cnJlbnRUYXJnZXQpXG5cdFx0d29yZFNlY3Rpb24gPSAkZWwuYXR0cignZGF0YS13b3JkLXNlY3Rpb24nKVxuXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIudW5zY3JhbWJsZSAkZWwsIEBnZXRTZWN0aW9uQ29sb3VyKEBhY3RpdmVTZWN0aW9uLCB3b3JkU2VjdGlvbilcblxuXHRcdG51bGxcblxuXHRvbkluZm9CdG5DbGljayA6IChlKSA9PlxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRyZXR1cm4gdW5sZXNzIEBDRF9DRSgpLm5hdi5jdXJyZW50LmFyZWEgaXMgQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUVcblxuXHRcdGlmICFARE9PRExFX0lORk9fT1BFTiB0aGVuIEBzaG93RG9vZGxlSW5mbygpXG5cblx0XHRudWxsXG5cblx0b25DbG9zZUJ0bkNsaWNrIDogKGUpID0+XG5cblx0XHRpZiBARE9PRExFX0lORk9fT1BFTlxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpXG5cdFx0XHRAaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0bnVsbFxuXG5cdG9uS2V5dXAgOiAoZSkgPT5cblxuXHRcdGlmIGUua2V5Q29kZSBpcyAyNyB0aGVuIEBoaWRlRG9vZGxlSW5mbygpXG5cblx0XHRudWxsXG5cblx0c2hvd0Rvb2RsZUluZm8gOiA9PlxuXG5cdFx0cmV0dXJuIHVubGVzcyAhQERPT0RMRV9JTkZPX09QRU5cblxuXHRcdEBvbkFyZWFDaGFuZ2UgJ2Rvb2RsZS1pbmZvJ1xuXHRcdEB0cmlnZ2VyIEBFVkVOVF9ET09ETEVfSU5GT19PUEVOXG5cdFx0QERPT0RMRV9JTkZPX09QRU4gPSB0cnVlXG5cblx0XHRudWxsXG5cblx0aGlkZURvb2RsZUluZm8gOiA9PlxuXG5cdFx0cmV0dXJuIHVubGVzcyBARE9PRExFX0lORk9fT1BFTlxuXG5cdFx0QG9uQXJlYUNoYW5nZSBAQ0RfQ0UoKS5uYXYuY3VycmVudC5hcmVhXG5cdFx0QHRyaWdnZXIgQEVWRU5UX0RPT0RMRV9JTkZPX0NMT1NFXG5cdFx0QERPT0RMRV9JTkZPX09QRU4gPSBmYWxzZVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEhlYWRlclxuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuXG5jbGFzcyBQcmVsb2FkZXIgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblx0XG5cdGNiICAgICAgICAgICAgICA6IG51bGxcblx0XG5cdFRSQU5TSVRJT05fVElNRSA6IDAuNVxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEBzZXRFbGVtZW50ICQoJyNwcmVsb2FkZXInKVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRpbml0IDogPT5cblxuXHRcdG51bGxcblxuXHRzaG93IDogKEBjYikgPT5cblxuXHRcdEAkZWwuY3NzICdkaXNwbGF5JyA6ICdibG9jaydcblxuXHRcdG51bGxcblxuXHRvblNob3dDb21wbGV0ZSA6ID0+XG5cblx0XHRAY2I/KClcblxuXHRcdG51bGxcblxuXHRoaWRlIDogKEBjYikgPT5cblxuXHRcdEBvbkhpZGVDb21wbGV0ZSgpXG5cblx0XHRudWxsXG5cblx0b25IaWRlQ29tcGxldGUgOiA9PlxuXG5cdFx0QCRlbC5jc3MgJ2Rpc3BsYXknIDogJ25vbmUnXG5cdFx0QGNiPygpXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gUHJlbG9hZGVyXG4iLCJBYnN0cmFjdFZpZXcgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5Eb29kbGVQYWdlVmlldyAgICAgPSByZXF1aXJlICcuLi9kb29kbGVQYWdlL0Rvb2RsZVBhZ2VWaWV3J1xuTmF2ICAgICAgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vcm91dGVyL05hdidcblxuY2xhc3MgV3JhcHBlciBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdFZJRVdfVFlQRV9QQUdFICA6ICdwYWdlJ1xuXHRWSUVXX1RZUEVfTU9EQUwgOiAnbW9kYWwnXG5cblx0dGVtcGxhdGUgOiAnd3JhcHBlcidcblxuXHR2aWV3cyAgICAgICAgICA6IG51bGxcblx0cHJldmlvdXNWaWV3ICAgOiBudWxsXG5cdGN1cnJlbnRWaWV3ICAgIDogbnVsbFxuXHRiYWNrZ3JvdW5kVmlldyA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdmlld3MgPVxuXHRcdFx0ZG9vZGxlIDogY2xhc3NSZWYgOiBEb29kbGVQYWdlVmlldywgcm91dGUgOiBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRSwgdmlldyA6IG51bGwsIHR5cGUgOiBAVklFV19UWVBFX1BBR0VcblxuXHRcdEBjcmVhdGVDbGFzc2VzKClcblxuXHRcdHN1cGVyKClcblxuXHRcdCMgZGVjaWRlIGlmIHlvdSB3YW50IHRvIGFkZCBhbGwgY29yZSBET00gdXAgZnJvbnQsIG9yIGFkZCBvbmx5IHdoZW4gcmVxdWlyZWQsIHNlZSBjb21tZW50cyBpbiBBYnN0cmFjdFZpZXdQYWdlLmNvZmZlZVxuXHRcdCMgQGFkZENsYXNzZXMoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRjcmVhdGVDbGFzc2VzIDogPT5cblxuXHRcdChAdmlld3NbbmFtZV0udmlldyA9IG5ldyBAdmlld3NbbmFtZV0uY2xhc3NSZWYpIGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXG5cdFx0bnVsbFxuXG5cdGFkZENsYXNzZXMgOiA9PlxuXG5cdFx0IGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXHRcdCBcdGlmIGRhdGEudHlwZSBpcyBAVklFV19UWVBFX1BBR0UgdGhlbiBAYWRkQ2hpbGQgZGF0YS52aWV3XG5cblx0XHRudWxsXG5cblx0Z2V0Vmlld0J5Um91dGUgOiAocm91dGUpID0+XG5cblx0XHRmb3IgbmFtZSwgZGF0YSBvZiBAdmlld3Ncblx0XHRcdHJldHVybiBAdmlld3NbbmFtZV0gaWYgcm91dGUgaXMgQHZpZXdzW25hbWVdLnJvdXRlXG5cblx0XHRudWxsXG5cblx0Z2V0Vmlld0J5Um91dGUgOiAocm91dGUpID0+XG5cblx0XHRmb3IgbmFtZSwgZGF0YSBvZiBAdmlld3Ncblx0XHRcdHJldHVybiBAdmlld3NbbmFtZV0gaWYgcm91dGUgaXMgQHZpZXdzW25hbWVdLnJvdXRlXG5cblx0XHRpZiByb3V0ZSB0aGVuIHJldHVybiBAdmlld3MuZm91ck9oRm91clxuXG5cdFx0bnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5vbiAnc3RhcnQnLCBAc3RhcnRcblxuXHRcdG51bGxcblxuXHRzdGFydCA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9mZiAnc3RhcnQnLCBAc3RhcnRcblxuXHRcdEBiaW5kRXZlbnRzKClcblx0XHRAdXBkYXRlRGltcygpXG5cblx0XHRudWxsXG5cblx0YmluZEV2ZW50cyA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5uYXYub24gTmF2LkVWRU5UX0NIQU5HRV9WSUVXLCBAY2hhbmdlVmlld1xuXHRcdEBDRF9DRSgpLm5hdi5vbiBOYXYuRVZFTlRfQ0hBTkdFX1NVQl9WSUVXLCBAY2hhbmdlU3ViVmlld1xuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5vbiBAQ0RfQ0UoKS5hcHBWaWV3LkVWRU5UX1VQREFURV9ESU1FTlNJT05TLCBAdXBkYXRlRGltc1xuXG5cdFx0bnVsbFxuXG5cdHVwZGF0ZURpbXMgOiA9PlxuXG5cdFx0QCRlbC5jc3MgJ21pbi1oZWlnaHQnLCBAQ0RfQ0UoKS5hcHBWaWV3LmRpbXMuaFxuXG5cdFx0bnVsbFxuXG5cdGNoYW5nZVZpZXcgOiAocHJldmlvdXMsIGN1cnJlbnQpID0+XG5cblx0XHRpZiBAcGFnZVN3aXRjaERmZCBhbmQgQHBhZ2VTd2l0Y2hEZmQuc3RhdGUoKSBpc250ICdyZXNvbHZlZCdcblx0XHRcdGRvIChwcmV2aW91cywgY3VycmVudCkgPT4gQHBhZ2VTd2l0Y2hEZmQuZG9uZSA9PiBAY2hhbmdlVmlldyBwcmV2aW91cywgY3VycmVudFxuXHRcdFx0cmV0dXJuXG5cblx0XHRAcHJldmlvdXNWaWV3ID0gQGdldFZpZXdCeVJvdXRlIHByZXZpb3VzLmFyZWFcblx0XHRAY3VycmVudFZpZXcgID0gQGdldFZpZXdCeVJvdXRlIGN1cnJlbnQuYXJlYVxuXG5cdFx0aWYgIUBwcmV2aW91c1ZpZXdcblx0XHRcdEB0cmFuc2l0aW9uVmlld3MgZmFsc2UsIEBjdXJyZW50Vmlld1xuXHRcdGVsc2Vcblx0XHRcdEB0cmFuc2l0aW9uVmlld3MgQHByZXZpb3VzVmlldywgQGN1cnJlbnRWaWV3XG5cblx0XHRudWxsXG5cblx0Y2hhbmdlU3ViVmlldyA6IChjdXJyZW50KSA9PlxuXG5cdFx0QGN1cnJlbnRWaWV3LnZpZXcudHJpZ2dlciBOYXYuRVZFTlRfQ0hBTkdFX1NVQl9WSUVXLCBjdXJyZW50LnN1YlxuXG5cdFx0bnVsbFxuXG5cdHRyYW5zaXRpb25WaWV3cyA6IChmcm9tLCB0bykgPT5cblxuXHRcdEBwYWdlU3dpdGNoRGZkID0gJC5EZWZlcnJlZCgpXG5cblx0XHRpZiBmcm9tIGFuZCB0b1xuXHRcdFx0QENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIucHJlcGFyZSBmcm9tLnJvdXRlLCB0by5yb3V0ZVxuXHRcdFx0QENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIuaW4gPT4gZnJvbS52aWV3LmhpZGUgPT4gdG8udmlldy5zaG93ID0+IEBDRF9DRSgpLmFwcFZpZXcudHJhbnNpdGlvbmVyLm91dCA9PiBAcGFnZVN3aXRjaERmZC5yZXNvbHZlKClcblx0XHRlbHNlIGlmIGZyb21cblx0XHRcdGZyb20udmlldy5oaWRlIEBwYWdlU3dpdGNoRGZkLnJlc29sdmVcblx0XHRlbHNlIGlmIHRvXG5cdFx0XHR0by52aWV3LnNob3cgQHBhZ2VTd2l0Y2hEZmQucmVzb2x2ZVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFdyYXBwZXJcbiIsIkFic3RyYWN0Vmlld1BhZ2UgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXdQYWdlJ1xuXG5jbGFzcyBEb29kbGVQYWdlVmlldyBleHRlbmRzIEFic3RyYWN0Vmlld1BhZ2VcblxuXHR0ZW1wbGF0ZSA6ICdwYWdlLWRvb2RsZSdcblx0bW9kZWwgICAgOiBudWxsXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0Y29uc29sZS5sb2cgXCJpIGFtIGhhbW1cIlxuXG5cdFx0QHRlbXBsYXRlVmFycyA9IHt9XG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0QCRmcmFtZSAgICAgICA9IEAkZWwuZmluZCgnW2RhdGEtZG9vZGxlLWZyYW1lXScpXG5cdFx0QCRpbmZvQ29udGVudCA9IEAkZWwuZmluZCgnW2RhdGEtZG9vZGxlLWluZm9dJylcblxuXHRcdEAkbW91c2UgICAgPSBAJGVsLmZpbmQoJ1tkYXRhLWluZGljYXRvcj1cIm1vdXNlXCJdJylcblx0XHRAJGtleWJvYXJkID0gQCRlbC5maW5kKCdbZGF0YS1pbmRpY2F0b3I9XCJrZXlib2FyZFwiXScpXG5cdFx0QCR0b3VjaCAgICA9IEAkZWwuZmluZCgnW2RhdGEtaW5kaWNhdG9yPVwidG91Y2hcIl0nKVxuXG5cdFx0bnVsbFxuXG5cdHNldExpc3RlbmVycyA6IChzZXR0aW5nKSA9PlxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5oZWFkZXJbc2V0dGluZ10gQENEX0NFKCkuYXBwVmlldy5oZWFkZXIuRVZFTlRfRE9PRExFX0lORk9fT1BFTiwgQG9uSW5mb09wZW5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlcltzZXR0aW5nXSBAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlci5FVkVOVF9ET09ETEVfSU5GT19DTE9TRSwgQG9uSW5mb0Nsb3NlXG5cdFx0QCRlbFtzZXR0aW5nXSAnY2xpY2snLCAnW2RhdGEtc2hhcmUtYnRuXScsIEBvblNoYXJlQnRuQ2xpY2tcblxuXHRcdG51bGxcblxuXHRzaG93IDogKGNiKSA9PlxuXG5cdFx0QG1vZGVsID0gQENEX0NFKCkuYXBwRGF0YS5hY3RpdmVEb29kbGVcblxuXHRcdEBzZXR1cFVJKClcblxuXHRcdHN1cGVyXG5cblx0XHRAc2hvd0ZyYW1lIGZhbHNlXG5cblx0XHRudWxsXG5cblx0aGlkZSA6IChjYikgPT5cblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuaGVhZGVyLmhpZGVEb29kbGVJbmZvKClcblxuXHRcdHN1cGVyXG5cblx0XHRudWxsXG5cblx0c2V0dXBVSSA6ID0+XG5cblx0XHRAJGluZm9Db250ZW50Lmh0bWwgQGdldERvb2RsZUluZm9Db250ZW50KClcblxuXHRcdEAkZWwuYXR0ciAnZGF0YS1jb2xvci1zY2hlbWUnLCBAbW9kZWwuZ2V0KCdjb2xvdXJfc2NoZW1lJylcblx0XHRAJGZyYW1lLmF0dHIoJ3NyYycsICcnKS5yZW1vdmVDbGFzcygnc2hvdycpXG5cdFx0QCRtb3VzZS5hdHRyICdkaXNhYmxlZCcsICFAbW9kZWwuZ2V0KCdpbnRlcmFjdGlvbi5tb3VzZScpXG5cdFx0QCRrZXlib2FyZC5hdHRyICdkaXNhYmxlZCcsICFAbW9kZWwuZ2V0KCdpbnRlcmFjdGlvbi5rZXlib2FyZCcpXG5cdFx0QCR0b3VjaC5hdHRyICdkaXNhYmxlZCcsICFAbW9kZWwuZ2V0KCdpbnRlcmFjdGlvbi50b3VjaCcpXG5cblx0XHRudWxsXG5cblx0c2hvd0ZyYW1lIDogKHJlbW92ZUV2ZW50PXRydWUpID0+XG5cblx0XHRpZiByZW1vdmVFdmVudCB0aGVuIEBDRF9DRSgpLmFwcFZpZXcudHJhbnNpdGlvbmVyLm9mZiBAQ0RfQ0UoKS5hcHBWaWV3LnRyYW5zaXRpb25lci5FVkVOVF9UUkFOU0lUSU9ORVJfT1VUX0RPTkUsIEBzaG93RnJhbWVcblxuXHRcdCMgVEVNUCwgT0JWWlxuXHRcdHNyY0RpciA9IGlmIEBtb2RlbC5nZXQoJ2NvbG91cl9zY2hlbWUnKSBpcyAnbGlnaHQnIHRoZW4gJ3NoYXBlLXN0cmVhbS1saWdodCcgZWxzZSAnc2hhcGUtc3RyZWFtJ1xuXG5cdFx0QCRmcmFtZS5hdHRyICdzcmMnLCBcImh0dHA6Ly9zb3VyY2UuY29kZWRvb2RsLmVzL3NhbXBsZV9kb29kbGVzLyN7c3JjRGlyfS9pbmRleC5odG1sXCJcblx0XHRAJGZyYW1lLm9uZSAnbG9hZCcsID0+IEAkZnJhbWUuYWRkQ2xhc3MoJ3Nob3cnKVxuXG5cdFx0bnVsbFxuXG5cdGdldERvb2RsZUluZm9Db250ZW50IDogPT5cblxuXHRcdCMgbm8gbmVlZCB0byBkbyB0aGlzIGZvciBldmVyeSBkb29kbGUgLSBvbmx5IGRvIGl0IGlmIHdlIHZpZXcgdGhlIGluZm8gcGFuZSBmb3IgYSBwYXJ0aWN1bGFyIGRvb2RsZVxuXHRcdEBtb2RlbC5zZXRTaG9ydGxpbmsoKVxuXG5cdFx0ZG9vZGxlSW5mb1ZhcnMgPVxuXHRcdFx0aW5kZXhIVE1MICAgICAgICAgICAgICAgICAgOiBAbW9kZWwuZ2V0KCdpbmRleEhUTUwnKVxuXHRcdFx0bGFiZWxfYXV0aG9yICAgICAgICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2F1dGhvclwiXG5cdFx0XHRjb250ZW50X2F1dGhvciAgICAgICAgICAgICA6IEBtb2RlbC5nZXRBdXRob3JIdG1sKClcblx0XHRcdGxhYmVsX2Rvb2RsZV9uYW1lICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9kb29kbGVfbmFtZVwiXG5cdFx0XHRjb250ZW50X2Rvb2RsZV9uYW1lICAgICAgICA6IEBtb2RlbC5nZXQoJ25hbWUnKVxuXHRcdFx0bGFiZWxfZGVzY3JpcHRpb24gICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2Rlc2NyaXB0aW9uXCJcblx0XHRcdGNvbnRlbnRfZGVzY3JpcHRpb24gICAgICAgIDogQG1vZGVsLmdldCgnZGVzY3JpcHRpb24nKVxuXHRcdFx0bGFiZWxfdGFncyAgICAgICAgICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX3RhZ3NcIlxuXHRcdFx0Y29udGVudF90YWdzICAgICAgICAgICAgICAgOiBAbW9kZWwuZ2V0KCd0YWdzJykuam9pbignLCAnKVxuXHRcdFx0bGFiZWxfaW50ZXJhY3Rpb24gICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uXCJcblx0XHRcdGNvbnRlbnRfaW50ZXJhY3Rpb24gICAgICAgIDogQF9nZXRJbnRlcmFjdGlvbkNvbnRlbnQoKVxuXHRcdFx0bGFiZWxfc2hhcmUgICAgICAgICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX3NoYXJlXCJcblx0XHRcdHNoYXJlX3VybCAgICAgICAgICAgICAgICAgIDogQENEX0NFKCkuU0lURV9VUkwgKyAnLycgKyBAbW9kZWwuZ2V0KCdzaG9ydGxpbmsnKVxuXHRcdFx0c2hhcmVfdXJsX3RleHQgICAgICAgICAgICAgOiBAQ0RfQ0UoKS5TSVRFX1VSTC5yZXBsYWNlKCdodHRwOi8vJywgJycpICsgJy8nICsgQG1vZGVsLmdldCgnc2hvcnRsaW5rJylcblxuXHRcdGRvb2RsZUluZm9Db250ZW50ID0gXy50ZW1wbGF0ZShAQ0RfQ0UoKS50ZW1wbGF0ZXMuZ2V0KCdkb29kbGUtaW5mbycpKShkb29kbGVJbmZvVmFycylcblxuXHRcdGRvb2RsZUluZm9Db250ZW50XG5cblx0X2dldEludGVyYWN0aW9uQ29udGVudCA6ID0+XG5cblx0XHRpbnRlcmFjdGlvbnMgPSBbXVxuXG5cdFx0aWYgQG1vZGVsLmdldCgnaW50ZXJhY3Rpb24ubW91c2UnKSB0aGVuIGludGVyYWN0aW9ucy5wdXNoIEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfaW50ZXJhY3Rpb25fbW91c2VcIlxuXHRcdGlmIEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLmtleWJvYXJkJykgdGhlbiBpbnRlcmFjdGlvbnMucHVzaCBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uX2tleWJvYXJkXCJcblx0XHRpZiBAbW9kZWwuZ2V0KCdpbnRlcmFjdGlvbi50b3VjaCcpIHRoZW4gaW50ZXJhY3Rpb25zLnB1c2ggQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvbl90b3VjaFwiXG5cblx0XHRpbnRlcmFjdGlvbnMuam9pbignLCAnKSBvciBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uX25vbmVcIlxuXG5cdG9uSW5mb09wZW4gOiA9PlxuXG5cdFx0QCRlbC5hZGRDbGFzcygnc2hvdy1pbmZvJylcblxuXHRcdG51bGxcblxuXHRvbkluZm9DbG9zZSA6ID0+XG5cblx0XHRAJGVsLnJlbW92ZUNsYXNzKCdzaG93LWluZm8nKVxuXG5cdFx0bnVsbFxuXG5cdG9uU2hhcmVCdG5DbGljayA6IChlKSA9PlxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRzaGFyZU1ldGhvZCA9ICQoZS5jdXJyZW50VGFyZ2V0KS5hdHRyKCdkYXRhLXNoYXJlLWJ0bicpXG5cdFx0dXJsICAgICAgICAgPSBpZiBzaGFyZU1ldGhvZCBpcyAnZmFjZWJvb2snIHRoZW4gQENEX0NFKCkuU0lURV9VUkwgKyAnLycgKyBAbW9kZWwuZ2V0KCdzaG9ydGxpbmsnKSBlbHNlICcgJ1xuXHRcdGRlc2MgICAgICAgID0gQGdldFNoYXJlRGVzYygpXG5cblx0XHRAQ0RfQ0UoKS5zaGFyZVtzaGFyZU1ldGhvZF0gdXJsLCBkZXNjXG5cblx0XHRudWxsXG5cblx0Z2V0U2hhcmVEZXNjIDogPT5cblxuXHRcdHZhcnMgPVxuXHRcdFx0ZG9vZGxlX25hbWUgICA6IEBtb2RlbC5nZXQgJ25hbWUnXG5cdFx0XHRkb29kbGVfYXV0aG9yIDogaWYgQG1vZGVsLmdldCgnYXV0aG9yLnR3aXR0ZXInKSB0aGVuIFwiQCN7QG1vZGVsLmdldCgnYXV0aG9yLnR3aXR0ZXInKX1cIiBlbHNlIEBtb2RlbC5nZXQoJ2F1dGhvci5uYW1lJylcblx0XHRcdHNoYXJlX3VybCAgICAgOiBAQ0RfQ0UoKS5TSVRFX1VSTCArICcvJyArIEBtb2RlbC5nZXQoJ3Nob3J0bGluaycpXG5cdFx0XHRkb29kbGVfdGFncyAgIDogXy5tYXAoQG1vZGVsLmdldCgndGFncycpLCAodGFnKSAtPiAnIycgKyB0YWcpLmpvaW4oJyAnKVxuXG5cdFx0ZGVzYyA9IEBzdXBwbGFudFN0cmluZyBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdkb29kbGVfc2hhcmVfdGV4dF90bXBsJyksIHZhcnMsIGZhbHNlXG5cblx0XHRkZXNjLnJlcGxhY2UoLyZuYnNwOy9nLCAnICcpXG5cbm1vZHVsZS5leHBvcnRzID0gRG9vZGxlUGFnZVZpZXdcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0VmlldydcblxuY2xhc3MgQWJzdHJhY3RNb2RhbCBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdCR3aW5kb3cgOiBudWxsXG5cblx0IyMjIG92ZXJyaWRlIGluIGluZGl2aWR1YWwgY2xhc3NlcyAjIyNcblx0bmFtZSAgICAgOiBudWxsXG5cdHRlbXBsYXRlIDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEAkd2luZG93ID0gJCh3aW5kb3cpXG5cblx0XHRzdXBlcigpXG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LmFkZENoaWxkIEBcblx0XHRAc2V0TGlzdGVuZXJzICdvbidcblx0XHRAYW5pbWF0ZUluKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aGlkZSA6ID0+XG5cblx0XHRAYW5pbWF0ZU91dCA9PiBAQ0RfQ0UoKS5hcHBWaWV3LnJlbW92ZSBAXG5cblx0XHRudWxsXG5cblx0ZGlzcG9zZSA6ID0+XG5cblx0XHRAc2V0TGlzdGVuZXJzICdvZmYnXG5cdFx0QENEX0NFKCkuYXBwVmlldy5tb2RhbE1hbmFnZXIubW9kYWxzW0BuYW1lXS52aWV3ID0gbnVsbFxuXG5cdFx0bnVsbFxuXG5cdHNldExpc3RlbmVycyA6IChzZXR0aW5nKSA9PlxuXG5cdFx0QCR3aW5kb3dbc2V0dGluZ10gJ2tleXVwJywgQG9uS2V5VXBcblx0XHRAJCgnW2RhdGEtY2xvc2VdJylbc2V0dGluZ10gJ2NsaWNrJywgQGNsb3NlQ2xpY2tcblxuXHRcdG51bGxcblxuXHRvbktleVVwIDogKGUpID0+XG5cblx0XHRpZiBlLmtleUNvZGUgaXMgMjcgdGhlbiBAaGlkZSgpXG5cblx0XHRudWxsXG5cblx0YW5pbWF0ZUluIDogPT5cblxuXHRcdFR3ZWVuTGl0ZS50byBAJGVsLCAwLjMsIHsgJ3Zpc2liaWxpdHknOiAndmlzaWJsZScsICdvcGFjaXR5JzogMSwgZWFzZSA6IFF1YWQuZWFzZU91dCB9XG5cdFx0VHdlZW5MaXRlLnRvIEAkZWwuZmluZCgnLmlubmVyJyksIDAuMywgeyBkZWxheSA6IDAuMTUsICd0cmFuc2Zvcm0nOiAnc2NhbGUoMSknLCAndmlzaWJpbGl0eSc6ICd2aXNpYmxlJywgJ29wYWNpdHknOiAxLCBlYXNlIDogQmFjay5lYXNlT3V0IH1cblxuXHRcdG51bGxcblxuXHRhbmltYXRlT3V0IDogKGNhbGxiYWNrKSA9PlxuXG5cdFx0VHdlZW5MaXRlLnRvIEAkZWwsIDAuMywgeyBkZWxheSA6IDAuMTUsICdvcGFjaXR5JzogMCwgZWFzZSA6IFF1YWQuZWFzZU91dCwgb25Db21wbGV0ZTogY2FsbGJhY2sgfVxuXHRcdFR3ZWVuTGl0ZS50byBAJGVsLmZpbmQoJy5pbm5lcicpLCAwLjMsIHsgJ3RyYW5zZm9ybSc6ICdzY2FsZSgwLjgpJywgJ29wYWNpdHknOiAwLCBlYXNlIDogQmFjay5lYXNlSW4gfVxuXG5cdFx0bnVsbFxuXG5cdGNsb3NlQ2xpY2s6ICggZSApID0+XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KClcblxuXHRcdEBoaWRlKClcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdE1vZGFsXG4iLCJBYnN0cmFjdE1vZGFsID0gcmVxdWlyZSAnLi9BYnN0cmFjdE1vZGFsJ1xuXG5jbGFzcyBPcmllbnRhdGlvbk1vZGFsIGV4dGVuZHMgQWJzdHJhY3RNb2RhbFxuXG5cdG5hbWUgICAgIDogJ29yaWVudGF0aW9uTW9kYWwnXG5cdHRlbXBsYXRlIDogJ29yaWVudGF0aW9uLW1vZGFsJ1xuXG5cdGNiICAgICAgIDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogKEBjYikgLT5cblxuXHRcdEB0ZW1wbGF0ZVZhcnMgPSB7QG5hbWV9XG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdGhpZGUgOiAoc3RpbGxMYW5kc2NhcGU9dHJ1ZSkgPT5cblxuXHRcdEBhbmltYXRlT3V0ID0+XG5cdFx0XHRAQ0RfQ0UoKS5hcHBWaWV3LnJlbW92ZSBAXG5cdFx0XHRpZiAhc3RpbGxMYW5kc2NhcGUgdGhlbiBAY2I/KClcblxuXHRcdG51bGxcblxuXHRzZXRMaXN0ZW5lcnMgOiAoc2V0dGluZykgPT5cblxuXHRcdHN1cGVyXG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3W3NldHRpbmddICd1cGRhdGVEaW1zJywgQG9uVXBkYXRlRGltc1xuXHRcdEAkZWxbc2V0dGluZ10gJ3RvdWNoZW5kIGNsaWNrJywgQGhpZGVcblxuXHRcdG51bGxcblxuXHRvblVwZGF0ZURpbXMgOiAoZGltcykgPT5cblxuXHRcdGlmIGRpbXMubyBpcyAncG9ydHJhaXQnIHRoZW4gQGhpZGUgZmFsc2VcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBPcmllbnRhdGlvbk1vZGFsXG4iLCJBYnN0cmFjdFZpZXcgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuT3JpZW50YXRpb25Nb2RhbCA9IHJlcXVpcmUgJy4vT3JpZW50YXRpb25Nb2RhbCdcblxuY2xhc3MgTW9kYWxNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cblx0IyB3aGVuIG5ldyBtb2RhbCBjbGFzc2VzIGFyZSBjcmVhdGVkLCBhZGQgaGVyZSwgd2l0aCByZWZlcmVuY2UgdG8gY2xhc3MgbmFtZVxuXHRtb2RhbHMgOlxuXHRcdG9yaWVudGF0aW9uTW9kYWwgOiBjbGFzc1JlZiA6IE9yaWVudGF0aW9uTW9kYWwsIHZpZXcgOiBudWxsXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRpbml0IDogPT5cblxuXHRcdG51bGxcblxuXHRpc09wZW4gOiA9PlxuXG5cdFx0KCBpZiBAbW9kYWxzW25hbWVdLnZpZXcgdGhlbiByZXR1cm4gdHJ1ZSApIGZvciBuYW1lLCBtb2RhbCBvZiBAbW9kYWxzXG5cblx0XHRmYWxzZVxuXG5cdGhpZGVPcGVuTW9kYWwgOiA9PlxuXG5cdFx0KCBpZiBAbW9kYWxzW25hbWVdLnZpZXcgdGhlbiBvcGVuTW9kYWwgPSBAbW9kYWxzW25hbWVdLnZpZXcgKSBmb3IgbmFtZSwgbW9kYWwgb2YgQG1vZGFsc1xuXG5cdFx0b3Blbk1vZGFsPy5oaWRlKClcblxuXHRcdG51bGxcblxuXHRzaG93TW9kYWwgOiAobmFtZSwgY2I9bnVsbCkgPT5cblxuXHRcdHJldHVybiBpZiBAbW9kYWxzW25hbWVdLnZpZXdcblxuXHRcdEBtb2RhbHNbbmFtZV0udmlldyA9IG5ldyBAbW9kYWxzW25hbWVdLmNsYXNzUmVmIGNiXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gTW9kYWxNYW5hZ2VyXG4iXX0=
