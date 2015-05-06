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
    var SAMPLE_DIR;
    if (removeEvent == null) {
      removeEvent = true;
    }
    if (removeEvent) {
      this.CD_CE().appView.transitioner.off(this.CD_CE().appView.transitioner.EVENT_TRANSITIONER_OUT_DONE, this.showFrame);
    }
    SAMPLE_DIR = this.model.get('SAMPLE_DIR');
    this.$frame.attr('src', "http://source.codedoodl.es/sample_doodles/" + SAMPLE_DIR + "/index.html");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL01haW4uY29mZmVlIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3B1bnljb2RlL3B1bnljb2RlLmpzIiwibm9kZV9tb2R1bGVzL2VudC9lbmNvZGUuanMiLCJub2RlX21vZHVsZXMvZW50L3JldmVyc2VkLmpzb24iLCJub2RlX21vZHVsZXMvaGFzaGlkcy9saWIvaGFzaGlkcy5qcyIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvQXBwLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvQXBwRGF0YS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL0FwcFZpZXcuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9BYnN0cmFjdENvbGxlY3Rpb24uY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9jb3JlL1RlbXBsYXRlc0NvbGxlY3Rpb24uY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9jb2xsZWN0aW9ucy9kb29kbGVzL0Rvb2RsZXNDb2xsZWN0aW9uLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvZGF0YS9BUEkuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9kYXRhL0Fic3RyYWN0RGF0YS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL2RhdGEvTG9jYWxlLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvZGF0YS9UZW1wbGF0ZXMuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvQWJzdHJhY3RNb2RlbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL21vZGVscy9jb3JlL0FQSVJvdXRlTW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvY29yZS9Mb2NhbGVzTW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvY29yZS9UZW1wbGF0ZU1vZGVsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL2Rvb2RsZS9Eb29kbGVNb2RlbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3JvdXRlci9OYXYuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9yb3V0ZXIvUm91dGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvQW5hbHl0aWNzLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvQXV0aE1hbmFnZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0ZhY2Vib29rLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvR29vZ2xlUGx1cy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL01lZGlhUXVlcmllcy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL051bWJlclV0aWxzLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvUmVxdWVzdGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvU2hhcmUuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L0Fic3RyYWN0Vmlldy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvQWJzdHJhY3RWaWV3UGFnZS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvYmFzZS9Gb290ZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L2Jhc2UvSGVhZGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9iYXNlL1ByZWxvYWRlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvYmFzZS9XcmFwcGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9kb29kbGVQYWdlL0Rvb2RsZVBhZ2VWaWV3LmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9tb2RhbHMvQWJzdHJhY3RNb2RhbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvbW9kYWxzL09yaWVudGF0aW9uTW9kYWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L21vZGFscy9fTW9kYWxNYW5hZ2VyLmNvZmZlZSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBLElBQUEsa0JBQUE7O0FBQUEsR0FBQSxHQUFNLE9BQUEsQ0FBUSxPQUFSLENBQU4sQ0FBQTs7QUFLQTtBQUFBOzs7R0FMQTs7QUFBQSxPQVdBLEdBQVUsS0FYVixDQUFBOztBQUFBLElBY0EsR0FBVSxPQUFILEdBQWdCLEVBQWhCLEdBQXlCLE1BQUEsSUFBVSxRQWQxQyxDQUFBOztBQUFBLElBaUJJLENBQUMsS0FBTCxHQUFpQixJQUFBLEdBQUEsQ0FBSSxPQUFKLENBakJqQixDQUFBOztBQUFBLElBa0JJLENBQUMsS0FBSyxDQUFDLElBQVgsQ0FBQSxDQWxCQSxDQUFBOzs7Ozs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbHlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZWQSxJQUFBLHdIQUFBO0VBQUEsa0ZBQUE7O0FBQUEsU0FBQSxHQUFlLE9BQUEsQ0FBUSxtQkFBUixDQUFmLENBQUE7O0FBQUEsV0FDQSxHQUFlLE9BQUEsQ0FBUSxxQkFBUixDQURmLENBQUE7O0FBQUEsS0FFQSxHQUFlLE9BQUEsQ0FBUSxlQUFSLENBRmYsQ0FBQTs7QUFBQSxRQUdBLEdBQWUsT0FBQSxDQUFRLGtCQUFSLENBSGYsQ0FBQTs7QUFBQSxVQUlBLEdBQWUsT0FBQSxDQUFRLG9CQUFSLENBSmYsQ0FBQTs7QUFBQSxTQUtBLEdBQWUsT0FBQSxDQUFRLGtCQUFSLENBTGYsQ0FBQTs7QUFBQSxNQU1BLEdBQWUsT0FBQSxDQUFRLGVBQVIsQ0FOZixDQUFBOztBQUFBLE1BT0EsR0FBZSxPQUFBLENBQVEsaUJBQVIsQ0FQZixDQUFBOztBQUFBLEdBUUEsR0FBZSxPQUFBLENBQVEsY0FBUixDQVJmLENBQUE7O0FBQUEsT0FTQSxHQUFlLE9BQUEsQ0FBUSxXQUFSLENBVGYsQ0FBQTs7QUFBQSxPQVVBLEdBQWUsT0FBQSxDQUFRLFdBQVIsQ0FWZixDQUFBOztBQUFBLFlBV0EsR0FBZSxPQUFBLENBQVEsc0JBQVIsQ0FYZixDQUFBOztBQUFBO0FBZUksZ0JBQUEsSUFBQSxHQUFhLElBQWIsQ0FBQTs7QUFBQSxnQkFDQSxRQUFBLEdBQWEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUQzQixDQUFBOztBQUFBLGdCQUVBLFFBQUEsR0FBYSxNQUFNLENBQUMsTUFBTSxDQUFDLFFBRjNCLENBQUE7O0FBQUEsZ0JBR0EsUUFBQSxHQUFhLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFIM0IsQ0FBQTs7QUFBQSxnQkFJQSxVQUFBLEdBQWEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUozQixDQUFBOztBQUFBLGdCQUtBLFFBQUEsR0FBYSxDQUxiLENBQUE7O0FBQUEsZ0JBT0EsUUFBQSxHQUFhLENBQUMsVUFBRCxFQUFhLFVBQWIsRUFBeUIsZ0JBQXpCLEVBQTJDLE1BQTNDLEVBQW1ELGFBQW5ELEVBQWtFLFVBQWxFLEVBQThFLFNBQTlFLEVBQXlGLElBQXpGLEVBQStGLFNBQS9GLEVBQTBHLFVBQTFHLENBUGIsQ0FBQTs7QUFTYyxFQUFBLGFBQUUsSUFBRixHQUFBO0FBRVYsSUFGVyxJQUFDLENBQUEsT0FBQSxJQUVaLENBQUE7QUFBQSw2Q0FBQSxDQUFBO0FBQUEsbUNBQUEsQ0FBQTtBQUFBLDZDQUFBLENBQUE7QUFBQSwrQ0FBQSxDQUFBO0FBQUEscURBQUEsQ0FBQTtBQUFBLHVDQUFBLENBQUE7QUFBQSwyREFBQSxDQUFBO0FBQUEsK0NBQUEsQ0FBQTtBQUFBLFdBQU8sSUFBUCxDQUZVO0VBQUEsQ0FUZDs7QUFBQSxnQkFhQSxRQUFBLEdBQVcsU0FBQSxHQUFBO0FBRVAsUUFBQSxFQUFBO0FBQUEsSUFBQSxFQUFBLEdBQUssTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsV0FBM0IsQ0FBQSxDQUFMLENBQUE7QUFBQSxJQUVBLFlBQVksQ0FBQyxLQUFiLENBQUEsQ0FGQSxDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsVUFBRCxHQUFpQixFQUFFLENBQUMsT0FBSCxDQUFXLFNBQVgsQ0FBQSxHQUF3QixDQUFBLENBSnpDLENBQUE7QUFBQSxJQUtBLElBQUMsQ0FBQSxVQUFELEdBQWlCLEVBQUUsQ0FBQyxPQUFILENBQVcsU0FBWCxDQUFBLEdBQXdCLENBQUEsQ0FMekMsQ0FBQTtBQUFBLElBTUEsSUFBQyxDQUFBLGFBQUQsR0FBb0IsRUFBRSxDQUFDLEtBQUgsQ0FBUyxPQUFULENBQUgsR0FBMEIsSUFBMUIsR0FBb0MsS0FOckQsQ0FBQTtXQVFBLEtBVk87RUFBQSxDQWJYLENBQUE7O0FBQUEsZ0JBeUJBLGNBQUEsR0FBaUIsU0FBQSxHQUFBO0FBRWIsSUFBQSxJQUFDLENBQUEsUUFBRCxFQUFBLENBQUE7QUFDQSxJQUFBLElBQWMsSUFBQyxDQUFBLFFBQUQsSUFBYSxDQUEzQjtBQUFBLE1BQUEsSUFBQyxDQUFBLE9BQUQsQ0FBQSxDQUFBLENBQUE7S0FEQTtXQUdBLEtBTGE7RUFBQSxDQXpCakIsQ0FBQTs7QUFBQSxnQkFnQ0EsSUFBQSxHQUFPLFNBQUEsR0FBQTtBQUVILElBQUEsSUFBQyxDQUFBLFdBQUQsQ0FBQSxDQUFBLENBQUE7V0FFQSxLQUpHO0VBQUEsQ0FoQ1AsQ0FBQTs7QUFBQSxnQkFzQ0EsV0FBQSxHQUFjLFNBQUEsR0FBQTtBQUVWLElBQUEsSUFBQyxDQUFBLE9BQUQsR0FBaUIsSUFBQSxPQUFBLENBQVEsSUFBQyxDQUFBLGNBQVQsQ0FBakIsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLFNBQUQsR0FBaUIsSUFBQSxTQUFBLENBQVUsTUFBTSxDQUFDLFVBQWpCLEVBQTZCLElBQUMsQ0FBQSxjQUE5QixDQURqQixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsTUFBRCxHQUFpQixJQUFBLE1BQUEsQ0FBTyxNQUFNLENBQUMsZUFBZCxFQUErQixJQUFDLENBQUEsY0FBaEMsQ0FGakIsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLFNBQUQsR0FBaUIsSUFBQSxTQUFBLENBQVUsTUFBTSxDQUFDLFNBQWpCLEVBQTRCLElBQUMsQ0FBQSxjQUE3QixDQUhqQixDQUFBO1dBT0EsS0FUVTtFQUFBLENBdENkLENBQUE7O0FBQUEsZ0JBaURBLFFBQUEsR0FBVyxTQUFBLEdBQUE7QUFFUCxJQUFBLFFBQVEsQ0FBQyxJQUFULENBQUEsQ0FBQSxDQUFBO0FBQUEsSUFDQSxVQUFVLENBQUMsSUFBWCxDQUFBLENBREEsQ0FBQTtXQUdBLEtBTE87RUFBQSxDQWpEWCxDQUFBOztBQUFBLGdCQXdEQSxPQUFBLEdBQVUsU0FBQSxHQUFBO0FBRU4sSUFBQSxJQUFDLENBQUEsUUFBRCxDQUFBLENBQUEsQ0FBQTtBQUVBO0FBQUEsNEJBRkE7QUFBQSxJQUdBLElBQUMsQ0FBQSxPQUFELEdBQVcsR0FBQSxDQUFBLE9BSFgsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLE1BQUQsR0FBVyxHQUFBLENBQUEsTUFKWCxDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsR0FBRCxHQUFXLEdBQUEsQ0FBQSxHQUxYLENBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxJQUFELEdBQVcsR0FBQSxDQUFBLFdBTlgsQ0FBQTtBQUFBLElBT0EsSUFBQyxDQUFBLEtBQUQsR0FBVyxHQUFBLENBQUEsS0FQWCxDQUFBO0FBQUEsSUFTQSxJQUFDLENBQUEsRUFBRCxDQUFBLENBVEEsQ0FBQTtBQUFBLElBV0EsSUFBQyxDQUFBLFFBQUQsQ0FBQSxDQVhBLENBQUE7V0FhQSxLQWZNO0VBQUEsQ0F4RFYsQ0FBQTs7QUFBQSxnQkF5RUEsRUFBQSxHQUFLLFNBQUEsR0FBQTtBQUVEO0FBQUEsdURBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFBLENBREEsQ0FBQTtBQUdBO0FBQUEsOERBSEE7QUFBQSxJQUlBLElBQUMsQ0FBQSxPQUFELENBQUEsQ0FKQSxDQUFBO1dBTUEsS0FSQztFQUFBLENBekVMLENBQUE7O0FBQUEsZ0JBbUZBLE9BQUEsR0FBVSxTQUFBLEdBQUE7QUFFTixRQUFBLGtCQUFBO0FBQUE7QUFBQSxTQUFBLDJDQUFBO29CQUFBO0FBQ0ksTUFBQSxJQUFFLENBQUEsRUFBQSxDQUFGLEdBQVEsSUFBUixDQUFBO0FBQUEsTUFDQSxNQUFBLENBQUEsSUFBUyxDQUFBLEVBQUEsQ0FEVCxDQURKO0FBQUEsS0FBQTtXQUlBLEtBTk07RUFBQSxDQW5GVixDQUFBOzthQUFBOztJQWZKLENBQUE7O0FBQUEsTUEwR00sQ0FBQyxPQUFQLEdBQWlCLEdBMUdqQixDQUFBOzs7OztBQ0FBLElBQUEsd0RBQUE7RUFBQTs7aVNBQUE7O0FBQUEsWUFBQSxHQUFvQixPQUFBLENBQVEscUJBQVIsQ0FBcEIsQ0FBQTs7QUFBQSxTQUNBLEdBQW9CLE9BQUEsQ0FBUSxtQkFBUixDQURwQixDQUFBOztBQUFBLEdBRUEsR0FBb0IsT0FBQSxDQUFRLFlBQVIsQ0FGcEIsQ0FBQTs7QUFBQSxpQkFHQSxHQUFvQixPQUFBLENBQVEseUNBQVIsQ0FIcEIsQ0FBQTs7QUFBQTtBQU9JLDRCQUFBLENBQUE7O0FBQUEsb0JBQUEsUUFBQSxHQUFXLElBQVgsQ0FBQTs7QUFBQSxvQkFFQSxvQkFBQSxHQUF1QixpQkFGdkIsQ0FBQTs7QUFJYyxFQUFBLGlCQUFFLFFBQUYsR0FBQTtBQUVWLElBRlcsSUFBQyxDQUFBLFdBQUEsUUFFWixDQUFBO0FBQUEscURBQUEsQ0FBQTtBQUFBLDZEQUFBLENBQUE7QUFBQSx5REFBQSxDQUFBO0FBQUEsbURBQUEsQ0FBQTtBQUFBLG1FQUFBLENBQUE7QUFBQSx1REFBQSxDQUFBO0FBQUEsK0RBQUEsQ0FBQTtBQUFBLElBQUEsdUNBQUEsQ0FBQSxDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsT0FBRCxHQUFXLEdBQUEsQ0FBQSxpQkFGWCxDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsZ0JBQUQsQ0FBQSxDQUpBLENBQUE7QUFNQSxXQUFPLElBQVAsQ0FSVTtFQUFBLENBSmQ7O0FBQUEsb0JBY0EsZ0JBQUEsR0FBbUIsU0FBQSxHQUFBO0FBRWYsSUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFwQixDQUF3QixJQUF4QixFQUE4QixDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxVQUFELEdBQUE7QUFFMUIsWUFBQSwwQkFBQTtBQUFBLFFBQUEsSUFBRyxDQUFDLENBQUMsT0FBRixDQUFVLFVBQVYsQ0FBSDtBQUNJLGlCQUFPLEtBQUMsQ0FBQSxZQUFELENBQUEsQ0FBUCxDQURKO1NBQUE7QUFBQSxRQUdBLGFBQUEsR0FBZ0IsRUFIaEIsQ0FBQTtBQUlBLGFBQUEsbUJBQUE7bUNBQUE7QUFBQyxVQUFBLElBQUcsS0FBQSxLQUFXLGFBQWQ7QUFBaUMsWUFBQSxhQUFhLENBQUMsSUFBZCxDQUFtQixJQUFJLENBQUMsS0FBTCxDQUFXLElBQVgsQ0FBbkIsQ0FBQSxDQUFqQztXQUFEO0FBQUEsU0FKQTtBQU1BLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFMLENBQUEsQ0FBQSxHQUFhLFVBQVUsQ0FBQyxXQUF6QixDQUFBLEdBQXdDLEtBQUMsQ0FBQSxvQkFBN0M7aUJBQ0ksS0FBQyxDQUFBLFlBQUQsQ0FBYyxhQUFkLEVBREo7U0FBQSxNQUFBO2lCQUdJLEtBQUMsQ0FBQSxVQUFELENBQVksYUFBWixDQUEwQixDQUFDLGVBQTNCLENBQUEsRUFISjtTQVIwQjtNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQTlCLENBQUEsQ0FBQTtXQWFBLEtBZmU7RUFBQSxDQWRuQixDQUFBOztBQUFBLG9CQStCQSxZQUFBLEdBQWUsU0FBQyxhQUFELEdBQUE7QUFFWCxRQUFBLENBQUE7O01BRlksZ0JBQWM7S0FFMUI7QUFBQSxJQUFBLENBQUEsR0FBSSxTQUFTLENBQUMsT0FBVixDQUNBO0FBQUEsTUFBQSxHQUFBLEVBQU8sR0FBRyxDQUFDLEdBQUosQ0FBUSxTQUFSLENBQVA7QUFBQSxNQUNBLElBQUEsRUFBTyxLQURQO0tBREEsQ0FBSixDQUFBO0FBQUEsSUFJQSxDQUFDLENBQUMsSUFBRixDQUFPLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFDLElBQUQsR0FBQTtlQUFVLEtBQUMsQ0FBQSxrQkFBRCxDQUFvQixJQUFwQixFQUEwQixhQUExQixFQUFWO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBUCxDQUpBLENBQUE7QUFBQSxJQUtBLENBQUMsQ0FBQyxJQUFGLENBQU8sQ0FBQSxTQUFBLEtBQUEsR0FBQTthQUFBLFNBQUMsR0FBRCxHQUFBO2VBQVMsT0FBTyxDQUFDLEtBQVIsQ0FBYyw4QkFBZCxFQUE4QyxHQUE5QyxFQUFUO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBUCxDQUxBLENBQUE7V0FPQSxLQVRXO0VBQUEsQ0EvQmYsQ0FBQTs7QUFBQSxvQkEwQ0Esa0JBQUEsR0FBcUIsU0FBQyxJQUFELEVBQU8sYUFBUCxHQUFBOztNQUFPLGdCQUFjO0tBRXRDO0FBQUEsSUFBQSxPQUFPLENBQUMsR0FBUixDQUFZLGdDQUFaLEVBQThDLElBQTlDLEVBQW9ELGFBQXBELENBQUEsQ0FBQTtBQUVBLElBQUEsSUFBRyxhQUFIO0FBQ0ksTUFBQSxJQUFDLENBQUEsYUFBRCxDQUFlLENBQUMsQ0FBQyxPQUFGLENBQVUsSUFBSSxDQUFDLE9BQWYsQ0FBZixFQUF3QyxhQUF4QyxDQUFzRCxDQUFDLGVBQXZELENBQUEsQ0FBQSxDQURKO0tBQUEsTUFBQTtBQUdJLE1BQUEsSUFBQyxDQUFBLFVBQUQsQ0FBWSxDQUFDLENBQUMsT0FBRixDQUFVLElBQUksQ0FBQyxPQUFmLENBQVosQ0FBb0MsQ0FBQyxlQUFyQyxDQUFBLENBQUEsQ0FISjtLQUZBO1dBT0EsS0FUaUI7RUFBQSxDQTFDckIsQ0FBQTs7QUFBQSxvQkFxREEsVUFBQSxHQUFhLFNBQUMsT0FBRCxHQUFBO0FBRVQsSUFBQSxJQUFDLENBQUEsT0FBTyxDQUFDLEdBQVQsQ0FBYSxPQUFiLENBQUEsQ0FBQTtXQUVBLEtBSlM7RUFBQSxDQXJEYixDQUFBOztBQUFBLG9CQTJEQSxhQUFBLEdBQWdCLFNBQUMsVUFBRCxFQUFhLGFBQWIsR0FBQTtBQUVaLElBQUEsSUFBQyxDQUFBLE9BQU8sQ0FBQyxHQUFULENBQWEsYUFBYixDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxPQUFPLENBQUMsTUFBVCxDQUFnQixVQUFoQixDQURBLENBQUE7V0FHQSxLQUxZO0VBQUEsQ0EzRGhCLENBQUE7O0FBQUEsb0JBa0VBLGVBQUEsR0FBa0IsU0FBQSxHQUFBO0FBRWQsSUFBQSxJQUFDLENBQUEsWUFBRCxHQUFnQixJQUFDLENBQUEsT0FBTyxDQUFDLGFBQVQsQ0FBQSxDQUFoQixDQUFBOztNQUNBLElBQUMsQ0FBQTtLQUREO0FBQUEsSUFHQSxJQUFDLENBQUEsV0FBRCxDQUFBLENBSEEsQ0FBQTtXQUtBLEtBUGM7RUFBQSxDQWxFbEIsQ0FBQTs7QUFBQSxvQkEyRUEsV0FBQSxHQUFjLFNBQUEsR0FBQTtBQUVWLElBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBcEIsQ0FBMEIsQ0FBQSxTQUFBLEtBQUEsR0FBQTthQUFBLFNBQUEsR0FBQTtBQUV0QixZQUFBLDBDQUFBO0FBQUEsUUFBQSxRQUFBLEdBQVc7QUFBQSxVQUFBLFdBQUEsRUFBYyxJQUFJLENBQUMsR0FBTCxDQUFBLENBQWQ7U0FBWCxDQUFBO0FBQ0E7QUFBQSxhQUFBLGlFQUFBO2tDQUFBO0FBQUEsVUFBQyxRQUFTLENBQUEsUUFBQSxDQUFULEdBQXFCLElBQUksQ0FBQyxTQUFMLENBQWUsTUFBZixDQUF0QixDQUFBO0FBQUEsU0FEQTtlQUdBLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQXBCLENBQXdCLFFBQXhCLEVBTHNCO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBMUIsQ0FBQSxDQUFBO1dBT0EsS0FUVTtFQUFBLENBM0VkLENBQUE7O2lCQUFBOztHQUZrQixhQUx0QixDQUFBOztBQUFBLE1BNkZNLENBQUMsT0FBUCxHQUFpQixPQTdGakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLHFGQUFBO0VBQUE7O2lTQUFBOztBQUFBLFlBQUEsR0FBZSxPQUFBLENBQVEscUJBQVIsQ0FBZixDQUFBOztBQUFBLFNBQ0EsR0FBZSxPQUFBLENBQVEsdUJBQVIsQ0FEZixDQUFBOztBQUFBLE1BRUEsR0FBZSxPQUFBLENBQVEsb0JBQVIsQ0FGZixDQUFBOztBQUFBLE9BR0EsR0FBZSxPQUFBLENBQVEscUJBQVIsQ0FIZixDQUFBOztBQUFBLE1BSUEsR0FBZSxPQUFBLENBQVEsb0JBQVIsQ0FKZixDQUFBOztBQUFBLFlBS0EsR0FBZSxPQUFBLENBQVEsNkJBQVIsQ0FMZixDQUFBOztBQUFBLFlBTUEsR0FBZSxPQUFBLENBQVEsc0JBQVIsQ0FOZixDQUFBOztBQUFBO0FBVUksNEJBQUEsQ0FBQTs7QUFBQSxvQkFBQSxRQUFBLEdBQVcsTUFBWCxDQUFBOztBQUFBLG9CQUVBLE9BQUEsR0FBVyxJQUZYLENBQUE7O0FBQUEsb0JBR0EsS0FBQSxHQUFXLElBSFgsQ0FBQTs7QUFBQSxvQkFLQSxPQUFBLEdBQVcsSUFMWCxDQUFBOztBQUFBLG9CQU1BLE1BQUEsR0FBVyxJQU5YLENBQUE7O0FBQUEsb0JBUUEsSUFBQSxHQUNJO0FBQUEsSUFBQSxDQUFBLEVBQUksSUFBSjtBQUFBLElBQ0EsQ0FBQSxFQUFJLElBREo7QUFBQSxJQUVBLENBQUEsRUFBSSxJQUZKO0FBQUEsSUFHQSxDQUFBLEVBQUksSUFISjtHQVRKLENBQUE7O0FBQUEsb0JBY0EsTUFBQSxHQUNJO0FBQUEsSUFBQSxTQUFBLEVBQVksYUFBWjtHQWZKLENBQUE7O0FBQUEsb0JBaUJBLHVCQUFBLEdBQTBCLHlCQWpCMUIsQ0FBQTs7QUFBQSxvQkFtQkEsWUFBQSxHQUFlLEdBbkJmLENBQUE7O0FBQUEsb0JBb0JBLE1BQUEsR0FBZSxRQXBCZixDQUFBOztBQUFBLG9CQXFCQSxVQUFBLEdBQWUsWUFyQmYsQ0FBQTs7QUF1QmMsRUFBQSxpQkFBQSxHQUFBO0FBRVYsbUVBQUEsQ0FBQTtBQUFBLHlEQUFBLENBQUE7QUFBQSxxREFBQSxDQUFBO0FBQUEsNkNBQUEsQ0FBQTtBQUFBLCtDQUFBLENBQUE7QUFBQSx5Q0FBQSxDQUFBO0FBQUEseURBQUEsQ0FBQTtBQUFBLG1EQUFBLENBQUE7QUFBQSwyQ0FBQSxDQUFBO0FBQUEscURBQUEsQ0FBQTtBQUFBLHVEQUFBLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxPQUFELEdBQVcsQ0FBQSxDQUFFLE1BQUYsQ0FBWCxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBRCxHQUFXLENBQUEsQ0FBRSxNQUFGLENBQVMsQ0FBQyxFQUFWLENBQWEsQ0FBYixDQURYLENBQUE7QUFBQSxJQUdBLHVDQUFBLENBSEEsQ0FBQTtBQUtBLFdBQU8sSUFBUCxDQVBVO0VBQUEsQ0F2QmQ7O0FBQUEsb0JBZ0NBLFlBQUEsR0FBYyxTQUFBLEdBQUE7QUFFVixJQUFBLElBQUMsQ0FBQSxPQUFPLENBQUMsRUFBVCxDQUFZLFdBQVosRUFBeUIsSUFBQyxDQUFBLFdBQTFCLENBQUEsQ0FGVTtFQUFBLENBaENkLENBQUE7O0FBQUEsb0JBc0NBLFdBQUEsR0FBYSxTQUFBLEdBQUE7QUFFVCxJQUFBLElBQUMsQ0FBQSxPQUFPLENBQUMsR0FBVCxDQUFhLFdBQWIsRUFBMEIsSUFBQyxDQUFBLFdBQTNCLENBQUEsQ0FGUztFQUFBLENBdENiLENBQUE7O0FBQUEsb0JBNENBLFdBQUEsR0FBYSxTQUFFLENBQUYsR0FBQTtBQUVULElBQUEsQ0FBQyxDQUFDLGNBQUYsQ0FBQSxDQUFBLENBRlM7RUFBQSxDQTVDYixDQUFBOztBQUFBLG9CQWtEQSxNQUFBLEdBQVMsU0FBQSxHQUFBO0FBRUwsSUFBQSxJQUFDLENBQUEsVUFBRCxDQUFBLENBQUEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLFNBQUQsR0FBZ0IsR0FBQSxDQUFBLFNBRmhCLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxZQUFELEdBQWdCLEdBQUEsQ0FBQSxZQUhoQixDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsTUFBRCxHQUFXLEdBQUEsQ0FBQSxNQUxYLENBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxPQUFELEdBQVcsR0FBQSxDQUFBLE9BTlgsQ0FBQTtBQUFBLElBT0EsSUFBQyxDQUFBLE1BQUQsR0FBVyxHQUFBLENBQUEsTUFQWCxDQUFBO0FBQUEsSUFTQSxJQUNJLENBQUMsUUFETCxDQUNjLElBQUMsQ0FBQSxNQURmLENBRUksQ0FBQyxRQUZMLENBRWMsSUFBQyxDQUFBLE9BRmYsQ0FHSSxDQUFDLFFBSEwsQ0FHYyxJQUFDLENBQUEsTUFIZixDQVRBLENBQUE7QUFBQSxJQWNBLElBQUMsQ0FBQSxhQUFELENBQUEsQ0FkQSxDQUZLO0VBQUEsQ0FsRFQsQ0FBQTs7QUFBQSxvQkFzRUEsVUFBQSxHQUFhLFNBQUEsR0FBQTtBQUVULElBQUEsSUFBQyxDQUFBLEVBQUQsQ0FBSSxhQUFKLEVBQW1CLElBQUMsQ0FBQSxhQUFwQixDQUFBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxRQUFELENBQUEsQ0FGQSxDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsUUFBRCxHQUFZLENBQUMsQ0FBQyxRQUFGLENBQVcsSUFBQyxDQUFBLFFBQVosRUFBc0IsR0FBdEIsQ0FKWixDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsT0FBTyxDQUFDLEVBQVQsQ0FBWSwwQkFBWixFQUF3QyxJQUFDLENBQUEsUUFBekMsQ0FMQSxDQUZTO0VBQUEsQ0F0RWIsQ0FBQTs7QUFBQSxvQkFpRkEsYUFBQSxHQUFnQixTQUFBLEdBQUE7QUFJWixJQUFBLElBQUMsQ0FBQSxLQUFLLENBQUMsT0FBUCxDQUFlLElBQUMsQ0FBQSxHQUFoQixDQUFBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FGQSxDQUpZO0VBQUEsQ0FqRmhCLENBQUE7O0FBQUEsb0JBMkZBLEtBQUEsR0FBUSxTQUFBLEdBQUE7QUFFSixJQUFBLElBQUMsQ0FBQSxPQUFELENBQVMsT0FBVCxDQUFBLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE1BQU0sQ0FBQyxLQUFoQixDQUFBLENBRkEsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLFNBQVMsQ0FBQyxJQUFYLENBQUEsQ0FKQSxDQUZJO0VBQUEsQ0EzRlIsQ0FBQTs7QUFBQSxvQkFxR0EsUUFBQSxHQUFXLFNBQUEsR0FBQTtBQUVQLElBQUEsSUFBQyxDQUFBLE9BQUQsQ0FBQSxDQUFBLENBRk87RUFBQSxDQXJHWCxDQUFBOztBQUFBLG9CQTJHQSxPQUFBLEdBQVUsU0FBQSxHQUFBO0FBRU4sUUFBQSxJQUFBO0FBQUEsSUFBQSxDQUFBLEdBQUksTUFBTSxDQUFDLFVBQVAsSUFBcUIsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUE5QyxJQUE2RCxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQS9FLENBQUE7QUFBQSxJQUNBLENBQUEsR0FBSSxNQUFNLENBQUMsV0FBUCxJQUFzQixRQUFRLENBQUMsZUFBZSxDQUFDLFlBQS9DLElBQStELFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFEakYsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLElBQUQsR0FDSTtBQUFBLE1BQUEsQ0FBQSxFQUFJLENBQUo7QUFBQSxNQUNBLENBQUEsRUFBSSxDQURKO0FBQUEsTUFFQSxDQUFBLEVBQU8sQ0FBQSxHQUFJLENBQVAsR0FBYyxVQUFkLEdBQThCLFdBRmxDO0FBQUEsTUFHQSxDQUFBLEVBQU8sQ0FBQSxJQUFLLElBQUMsQ0FBQSxZQUFULEdBQTJCLElBQUMsQ0FBQSxNQUE1QixHQUF3QyxJQUFDLENBQUEsVUFIN0M7S0FKSixDQUFBO0FBQUEsSUFTQSxJQUFDLENBQUEsT0FBRCxDQUFTLElBQUMsQ0FBQSx1QkFBVixFQUFtQyxJQUFDLENBQUEsSUFBcEMsQ0FUQSxDQUZNO0VBQUEsQ0EzR1YsQ0FBQTs7QUFBQSxvQkEwSEEsV0FBQSxHQUFjLFNBQUMsQ0FBRCxHQUFBO0FBRVYsUUFBQSxJQUFBO0FBQUEsSUFBQSxJQUFBLEdBQU8sQ0FBQSxDQUFFLENBQUMsQ0FBQyxhQUFKLENBQWtCLENBQUMsSUFBbkIsQ0FBd0IsTUFBeEIsQ0FBUCxDQUFBO0FBRUEsSUFBQSxJQUFBLENBQUEsSUFBQTtBQUFBLGFBQU8sS0FBUCxDQUFBO0tBRkE7QUFBQSxJQUlBLElBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQUFxQixDQUFyQixDQUpBLENBRlU7RUFBQSxDQTFIZCxDQUFBOztBQUFBLG9CQW9JQSxhQUFBLEdBQWdCLFNBQUUsSUFBRixFQUFRLENBQVIsR0FBQTtBQUVaLFFBQUEsY0FBQTs7TUFGb0IsSUFBSTtLQUV4QjtBQUFBLElBQUEsS0FBQSxHQUFhLElBQUksQ0FBQyxLQUFMLENBQVcsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsUUFBcEIsQ0FBSCxHQUFzQyxJQUFJLENBQUMsS0FBTCxDQUFXLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLFFBQXBCLENBQThCLENBQUEsQ0FBQSxDQUFwRSxHQUE0RSxJQUF0RixDQUFBO0FBQUEsSUFDQSxPQUFBLEdBQWEsS0FBSyxDQUFDLE9BQU4sQ0FBYyxHQUFkLENBQUEsS0FBc0IsQ0FBekIsR0FBZ0MsS0FBSyxDQUFDLEtBQU4sQ0FBWSxHQUFaLENBQWlCLENBQUEsQ0FBQSxDQUFqRCxHQUF5RCxLQURuRSxDQUFBO0FBR0EsSUFBQSxJQUFHLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLEdBQUcsQ0FBQyxVQUFiLENBQXdCLE9BQXhCLENBQUg7O1FBQ0ksQ0FBQyxDQUFFLGNBQUgsQ0FBQTtPQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsVUFBaEIsQ0FBMkIsS0FBM0IsQ0FEQSxDQURKO0tBQUEsTUFBQTtBQUlJLE1BQUEsSUFBQyxDQUFBLGtCQUFELENBQW9CLElBQXBCLENBQUEsQ0FKSjtLQUxZO0VBQUEsQ0FwSWhCLENBQUE7O0FBQUEsb0JBaUpBLGtCQUFBLEdBQXFCLFNBQUMsSUFBRCxHQUFBO0FBRWpCO0FBQUE7OztPQUZpQjtFQUFBLENBakpyQixDQUFBOztpQkFBQTs7R0FGa0IsYUFSdEIsQ0FBQTs7QUFBQSxNQXFLTSxDQUFDLE9BQVAsR0FBaUIsT0FyS2pCLENBQUE7Ozs7O0FDQUEsSUFBQSxrQkFBQTtFQUFBOztpU0FBQTs7QUFBQTtBQUVDLHVDQUFBLENBQUE7Ozs7O0dBQUE7O0FBQUEsK0JBQUEsS0FBQSxHQUFRLFNBQUEsR0FBQTtBQUVQLFdBQU8sTUFBTSxDQUFDLEtBQWQsQ0FGTztFQUFBLENBQVIsQ0FBQTs7NEJBQUE7O0dBRmdDLFFBQVEsQ0FBQyxXQUExQyxDQUFBOztBQUFBLE1BTU0sQ0FBQyxPQUFQLEdBQWlCLGtCQU5qQixDQUFBOzs7OztBQ0FBLElBQUEsa0NBQUE7RUFBQTtpU0FBQTs7QUFBQSxhQUFBLEdBQWdCLE9BQUEsQ0FBUSxpQ0FBUixDQUFoQixDQUFBOztBQUFBO0FBSUMsd0NBQUEsQ0FBQTs7OztHQUFBOztBQUFBLGdDQUFBLEtBQUEsR0FBUSxhQUFSLENBQUE7OzZCQUFBOztHQUZpQyxRQUFRLENBQUMsV0FGM0MsQ0FBQTs7QUFBQSxNQU1NLENBQUMsT0FBUCxHQUFpQixtQkFOakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLGtEQUFBO0VBQUE7O2lTQUFBOztBQUFBLGtCQUFBLEdBQXFCLE9BQUEsQ0FBUSx1QkFBUixDQUFyQixDQUFBOztBQUFBLFdBQ0EsR0FBcUIsT0FBQSxDQUFRLGlDQUFSLENBRHJCLENBQUE7O0FBQUE7QUFLSSxzQ0FBQSxDQUFBOzs7Ozs7Ozs7O0dBQUE7O0FBQUEsOEJBQUEsS0FBQSxHQUFRLFdBQVIsQ0FBQTs7QUFBQSw4QkFFQSxlQUFBLEdBQWtCLFNBQUMsSUFBRCxHQUFBO0FBRWQsUUFBQSxNQUFBO0FBQUEsSUFBQSxNQUFBLEdBQVMsSUFBQyxDQUFBLFNBQUQsQ0FBVztBQUFBLE1BQUEsSUFBQSxFQUFPLElBQVA7S0FBWCxDQUFULENBQUE7QUFFQSxJQUFBLElBQUcsQ0FBQSxNQUFIO0FBQ0ksTUFBQSxPQUFPLENBQUMsR0FBUixDQUFZLGdCQUFaLENBQUEsQ0FESjtLQUZBO0FBS0EsV0FBTyxNQUFQLENBUGM7RUFBQSxDQUZsQixDQUFBOztBQUFBLDhCQVdBLHFCQUFBLEdBQXdCLFNBQUMsWUFBRCxHQUFBO0FBRXBCLFFBQUEsZUFBQTtBQUFBLElBQUEsT0FBQSxHQUFVLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLEdBQUksQ0FBQSxZQUFBLENBQXZCLENBQUE7QUFBQSxJQUVBLE1BQUEsR0FBUyxJQUFDLENBQUEsU0FBRCxDQUFXO0FBQUEsTUFBQSxJQUFBLEVBQU8sRUFBQSxHQUFHLE9BQU8sQ0FBQyxHQUFYLEdBQWUsR0FBZixHQUFrQixPQUFPLENBQUMsR0FBakM7S0FBWCxDQUZULENBQUE7V0FJQSxPQU5vQjtFQUFBLENBWHhCLENBQUE7O0FBQUEsOEJBbUJBLGFBQUEsR0FBZ0IsU0FBQyxNQUFELEdBQUE7QUFFWixRQUFBLEtBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxJQUFDLENBQUEsT0FBRCxDQUFTLE1BQVQsQ0FBUixDQUFBO0FBQUEsSUFDQSxLQUFBLEVBREEsQ0FBQTtBQUdBLElBQUEsSUFBRyxLQUFBLEdBQVEsQ0FBWDtBQUNJLGFBQU8sS0FBUCxDQURKO0tBQUEsTUFBQTtBQUdJLGFBQU8sSUFBQyxDQUFBLEVBQUQsQ0FBSSxLQUFKLENBQVAsQ0FISjtLQUxZO0VBQUEsQ0FuQmhCLENBQUE7O0FBQUEsOEJBNkJBLGFBQUEsR0FBZ0IsU0FBQyxNQUFELEdBQUE7QUFFWixRQUFBLEtBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxJQUFDLENBQUEsT0FBRCxDQUFTLE1BQVQsQ0FBUixDQUFBO0FBQUEsSUFDQSxLQUFBLEVBREEsQ0FBQTtBQUdBLElBQUEsSUFBRyxLQUFBLEdBQVEsQ0FBQyxJQUFDLENBQUEsTUFBTSxDQUFDLE1BQVIsR0FBZSxDQUFoQixDQUFYO0FBQ0ksYUFBTyxLQUFQLENBREo7S0FBQSxNQUFBO0FBR0ksYUFBTyxJQUFDLENBQUEsRUFBRCxDQUFJLEtBQUosQ0FBUCxDQUhKO0tBTFk7RUFBQSxDQTdCaEIsQ0FBQTs7QUFBQSw4QkF1Q0EsTUFBQSxHQUFTLFNBQUMsT0FBRCxHQUFBO0FBRUwsUUFBQSxnQkFBQTtBQUFBLFNBQUEsOENBQUE7MkJBQUE7QUFDSSxNQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsU0FBRCxDQUFZO0FBQUEsUUFBQSxLQUFBLEVBQVEsTUFBTSxDQUFDLEtBQWY7T0FBWixDQUFKO0FBQ0ksUUFBQSxJQUFDLENBQUEsR0FBRCxDQUFLLE1BQUwsQ0FBQSxDQURKO09BREo7QUFBQSxLQUFBO1dBSUEsS0FOSztFQUFBLENBdkNULENBQUE7O0FBQUEsOEJBK0NBLGFBQUEsR0FBZ0IsU0FBQSxHQUFBO0FBRVosUUFBQSxrQ0FBQTtBQUFBO0FBQUEsU0FBQSwyQ0FBQTt3QkFBQTtBQUVJLE1BQUEsSUFBRyxDQUFBLE1BQU8sQ0FBQyxHQUFQLENBQVcsUUFBWCxDQUFKO0FBQ0ksUUFBQSxNQUFNLENBQUMsR0FBUCxDQUFXLFFBQVgsRUFBcUIsSUFBckIsQ0FBQSxDQUFBO0FBQUEsUUFDQSxVQUFBLEdBQWEsTUFEYixDQUFBO0FBRUEsY0FISjtPQUZKO0FBQUEsS0FBQTtBQU9BLElBQUEsSUFBRyxDQUFBLFVBQUg7QUFDSSxNQUFBLE9BQU8sQ0FBQyxHQUFSLENBQVksMEJBQVosQ0FBQSxDQUFBO0FBQUEsTUFDQSxVQUFBLEdBQWEsQ0FBQyxDQUFDLE9BQUYsQ0FBVSxJQUFDLENBQUEsTUFBWCxDQUFtQixDQUFBLENBQUEsQ0FEaEMsQ0FESjtLQVBBO1dBV0EsV0FiWTtFQUFBLENBL0NoQixDQUFBOzsyQkFBQTs7R0FGNEIsbUJBSGhDLENBQUE7O0FBQUEsTUFtRU0sQ0FBQyxPQUFQLEdBQWlCLGlCQW5FakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLGtCQUFBOztBQUFBLGFBQUEsR0FBZ0IsT0FBQSxDQUFRLDhCQUFSLENBQWhCLENBQUE7O0FBQUE7bUJBSUM7O0FBQUEsRUFBQSxHQUFDLENBQUEsS0FBRCxHQUFTLEdBQUEsQ0FBQSxhQUFULENBQUE7O0FBQUEsRUFFQSxHQUFDLENBQUEsV0FBRCxHQUFlLFNBQUEsR0FBQTtXQUVkO0FBQUE7QUFBQSxtREFBQTtBQUFBLE1BQ0EsUUFBQSxFQUFXLEdBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLFFBRHBCO01BRmM7RUFBQSxDQUZmLENBQUE7O0FBQUEsRUFPQSxHQUFDLENBQUEsR0FBRCxHQUFPLFNBQUMsSUFBRCxFQUFPLElBQVAsR0FBQTtBQUVOLElBQUEsSUFBQSxHQUFPLENBQUMsQ0FBQyxNQUFGLENBQVMsSUFBVCxFQUFlLElBQWYsRUFBcUIsR0FBQyxDQUFBLFdBQUQsQ0FBQSxDQUFyQixDQUFQLENBQUE7QUFDQSxXQUFPLEdBQUMsQ0FBQSxjQUFELENBQWdCLEdBQUMsQ0FBQSxLQUFLLENBQUMsR0FBUCxDQUFXLElBQVgsQ0FBaEIsRUFBa0MsSUFBbEMsQ0FBUCxDQUhNO0VBQUEsQ0FQUCxDQUFBOztBQUFBLEVBWUEsR0FBQyxDQUFBLGNBQUQsR0FBa0IsU0FBQyxHQUFELEVBQU0sSUFBTixHQUFBO0FBRWpCLFdBQU8sR0FBRyxDQUFDLE9BQUosQ0FBWSxpQkFBWixFQUErQixTQUFDLENBQUQsRUFBSSxDQUFKLEdBQUE7QUFDckMsVUFBQSxDQUFBO2FBQUEsQ0FBQSxHQUFJLElBQUssQ0FBQSxDQUFBLENBQUwsSUFBVyxDQUFHLE1BQUEsQ0FBQSxJQUFZLENBQUEsQ0FBQSxDQUFaLEtBQWtCLFFBQXJCLEdBQW1DLElBQUssQ0FBQSxDQUFBLENBQUUsQ0FBQyxRQUFSLENBQUEsQ0FBbkMsR0FBMkQsRUFBM0QsRUFEc0I7SUFBQSxDQUEvQixDQUFQLENBQUE7QUFFQyxJQUFBLElBQUcsTUFBQSxDQUFBLENBQUEsS0FBWSxRQUFaLElBQXdCLE1BQUEsQ0FBQSxDQUFBLEtBQVksUUFBdkM7YUFBcUQsRUFBckQ7S0FBQSxNQUFBO2FBQTRELEVBQTVEO0tBSmdCO0VBQUEsQ0FabEIsQ0FBQTs7QUFBQSxFQWtCQSxHQUFDLENBQUEsS0FBRCxHQUFTLFNBQUEsR0FBQTtBQUVSLFdBQU8sTUFBTSxDQUFDLEtBQWQsQ0FGUTtFQUFBLENBbEJULENBQUE7O2FBQUE7O0lBSkQsQ0FBQTs7QUFBQSxNQTBCTSxDQUFDLE9BQVAsR0FBaUIsR0ExQmpCLENBQUE7Ozs7O0FDQUEsSUFBQSxZQUFBO0VBQUEsa0ZBQUE7O0FBQUE7QUFFZSxFQUFBLHNCQUFBLEdBQUE7QUFFYix5Q0FBQSxDQUFBO0FBQUEsSUFBQSxDQUFDLENBQUMsTUFBRixDQUFTLElBQVQsRUFBWSxRQUFRLENBQUMsTUFBckIsQ0FBQSxDQUFBO0FBRUEsV0FBTyxJQUFQLENBSmE7RUFBQSxDQUFkOztBQUFBLHlCQU1BLEtBQUEsR0FBUSxTQUFBLEdBQUE7QUFFUCxXQUFPLE1BQU0sQ0FBQyxLQUFkLENBRk87RUFBQSxDQU5SLENBQUE7O3NCQUFBOztJQUZELENBQUE7O0FBQUEsTUFZTSxDQUFDLE9BQVAsR0FBaUIsWUFaakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLHlCQUFBO0VBQUEsa0ZBQUE7O0FBQUEsWUFBQSxHQUFlLE9BQUEsQ0FBUSw2QkFBUixDQUFmLENBQUE7O0FBQUEsR0FDQSxHQUFlLE9BQUEsQ0FBUSxhQUFSLENBRGYsQ0FBQTs7QUFHQTtBQUFBOzs7O0dBSEE7O0FBQUE7QUFXSSxtQkFBQSxJQUFBLEdBQVcsSUFBWCxDQUFBOztBQUFBLG1CQUNBLElBQUEsR0FBVyxJQURYLENBQUE7O0FBQUEsbUJBRUEsUUFBQSxHQUFXLElBRlgsQ0FBQTs7QUFBQSxtQkFHQSxVQUFBLEdBQVcsT0FIWCxDQUFBOztBQUtjLEVBQUEsZ0JBQUMsSUFBRCxFQUFPLEVBQVAsR0FBQTtBQUVWLDJEQUFBLENBQUE7QUFBQSxxQ0FBQSxDQUFBO0FBQUEsaURBQUEsQ0FBQTtBQUFBLDZDQUFBLENBQUE7QUFBQTtBQUFBLHNFQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsUUFBRCxHQUFZLEVBRlosQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLElBQUQsR0FBUSxJQUFDLENBQUEsT0FBRCxDQUFBLENBSlIsQ0FBQTtBQUFBLElBTUEsSUFBQyxDQUFBLFNBQUQsQ0FBVyxJQUFYLENBTkEsQ0FBQTtBQUFBLElBUUEsSUFSQSxDQUZVO0VBQUEsQ0FMZDs7QUFBQSxtQkFpQkEsT0FBQSxHQUFVLFNBQUEsR0FBQTtBQUVOLFFBQUEsSUFBQTtBQUFBLElBQUEsSUFBRyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQWhCLElBQTJCLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQXZCLENBQTZCLE9BQTdCLENBQTlCO0FBRUksTUFBQSxJQUFBLEdBQU8sTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBdkIsQ0FBNkIsT0FBN0IsQ0FBc0MsQ0FBQSxDQUFBLENBQUUsQ0FBQyxLQUF6QyxDQUErQyxHQUEvQyxDQUFvRCxDQUFBLENBQUEsQ0FBM0QsQ0FGSjtLQUFBLE1BSUssSUFBRyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQWpCO0FBRUQsTUFBQSxJQUFBLEdBQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFyQixDQUZDO0tBQUEsTUFBQTtBQU1ELE1BQUEsSUFBQSxHQUFPLElBQUMsQ0FBQSxTQUFBLENBQVIsQ0FOQztLQUpMO1dBWUEsS0FkTTtFQUFBLENBakJWLENBQUE7O0FBQUEsbUJBaUNBLFNBQUEsR0FBWSxTQUFDLElBQUQsR0FBQTtBQUVSO0FBQUEsZ0RBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxJQUFELEdBQVksSUFBQSxZQUFBLENBQWEsSUFBYixDQUZaLENBQUE7O01BR0EsSUFBQyxDQUFBO0tBSEQ7V0FLQSxLQVBRO0VBQUEsQ0FqQ1osQ0FBQTs7QUFBQSxtQkEwQ0EsR0FBQSxHQUFNLFNBQUMsRUFBRCxHQUFBO0FBRUY7QUFBQTs7T0FBQTtBQUlBLFdBQU8sSUFBQyxDQUFBLElBQUksQ0FBQyxTQUFOLENBQWdCLEVBQWhCLENBQVAsQ0FORTtFQUFBLENBMUNOLENBQUE7O0FBQUEsbUJBa0RBLGNBQUEsR0FBaUIsU0FBQyxHQUFELEdBQUE7QUFFYixXQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBZCxHQUFvQixpQkFBcEIsR0FBd0MsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUF0RCxHQUFtRSxHQUFuRSxHQUF5RSxHQUFoRixDQUZhO0VBQUEsQ0FsRGpCLENBQUE7O2dCQUFBOztJQVhKLENBQUE7O0FBQUEsTUFpRU0sQ0FBQyxPQUFQLEdBQWlCLE1BakVqQixDQUFBOzs7OztBQ0FBLElBQUEsNkNBQUE7RUFBQSxrRkFBQTs7QUFBQSxhQUFBLEdBQXNCLE9BQUEsQ0FBUSw4QkFBUixDQUF0QixDQUFBOztBQUFBLG1CQUNBLEdBQXNCLE9BQUEsQ0FBUSx5Q0FBUixDQUR0QixDQUFBOztBQUFBO0FBS0ksc0JBQUEsU0FBQSxHQUFZLElBQVosQ0FBQTs7QUFBQSxzQkFDQSxFQUFBLEdBQVksSUFEWixDQUFBOztBQUdjLEVBQUEsbUJBQUMsSUFBRCxFQUFPLFFBQVAsR0FBQTtBQUVWLHFDQUFBLENBQUE7QUFBQSxpREFBQSxDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsRUFBRCxHQUFNLFFBQU4sQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLFNBQUQsQ0FBVyxJQUFYLENBRkEsQ0FBQTtBQUFBLElBSUEsSUFKQSxDQUZVO0VBQUEsQ0FIZDs7QUFBQSxzQkFXQSxTQUFBLEdBQVksU0FBQyxJQUFELEdBQUE7QUFFUixRQUFBLDBCQUFBO0FBQUEsSUFBQSxJQUFBLEdBQU8sRUFBUCxDQUFBO0FBRUE7QUFBQSxTQUFBLDJDQUFBO3NCQUFBO0FBQ0ksTUFBQSxJQUFJLENBQUMsSUFBTCxDQUFjLElBQUEsYUFBQSxDQUNWO0FBQUEsUUFBQSxFQUFBLEVBQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFkO0FBQUEsUUFDQSxJQUFBLEVBQU8sSUFBSSxDQUFDLENBRFo7T0FEVSxDQUFkLENBQUEsQ0FESjtBQUFBLEtBRkE7QUFBQSxJQU9BLElBQUMsQ0FBQSxTQUFELEdBQWlCLElBQUEsbUJBQUEsQ0FBb0IsSUFBcEIsQ0FQakIsQ0FBQTs7TUFTQSxJQUFDLENBQUE7S0FURDtXQVdBLEtBYlE7RUFBQSxDQVhaLENBQUE7O0FBQUEsc0JBMEJBLEdBQUEsR0FBTSxTQUFDLEVBQUQsR0FBQTtBQUVGLFFBQUEsQ0FBQTtBQUFBLElBQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxTQUFTLENBQUMsS0FBWCxDQUFpQjtBQUFBLE1BQUEsRUFBQSxFQUFLLEVBQUw7S0FBakIsQ0FBSixDQUFBO0FBQUEsSUFDQSxDQUFBLEdBQUksQ0FBRSxDQUFBLENBQUEsQ0FBRSxDQUFDLEdBQUwsQ0FBUyxNQUFULENBREosQ0FBQTtBQUdBLFdBQU8sQ0FBQyxDQUFDLElBQUYsQ0FBTyxDQUFQLENBQVAsQ0FMRTtFQUFBLENBMUJOLENBQUE7O21CQUFBOztJQUxKLENBQUE7O0FBQUEsTUFzQ00sQ0FBQyxPQUFQLEdBQWlCLFNBdENqQixDQUFBOzs7OztBQ0FBLElBQUEsYUFBQTtFQUFBOztpU0FBQTs7QUFBQTtBQUVDLGtDQUFBLENBQUE7O0FBQWMsRUFBQSx1QkFBQyxLQUFELEVBQVEsTUFBUixHQUFBO0FBRWIseUNBQUEsQ0FBQTtBQUFBLHVEQUFBLENBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxJQUFDLENBQUEsWUFBRCxDQUFjLEtBQWQsQ0FBUixDQUFBO0FBRUEsV0FBTyxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQW5CLENBQXlCLElBQXpCLEVBQTRCLFNBQTVCLENBQVAsQ0FKYTtFQUFBLENBQWQ7O0FBQUEsMEJBTUEsR0FBQSxHQUFNLFNBQUMsS0FBRCxFQUFRLE9BQVIsR0FBQTtBQUVMLElBQUEsT0FBQSxJQUFXLENBQUMsT0FBQSxHQUFVLEVBQVgsQ0FBWCxDQUFBO0FBQUEsSUFFQSxLQUFBLEdBQVEsSUFBQyxDQUFBLFlBQUQsQ0FBYyxLQUFkLENBRlIsQ0FBQTtBQUFBLElBSUEsT0FBTyxDQUFDLElBQVIsR0FBZSxJQUFJLENBQUMsU0FBTCxDQUFlLEtBQWYsQ0FKZixDQUFBO0FBTUEsV0FBTyxRQUFRLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBakMsQ0FBc0MsSUFBdEMsRUFBeUMsS0FBekMsRUFBZ0QsT0FBaEQsQ0FBUCxDQVJLO0VBQUEsQ0FOTixDQUFBOztBQUFBLDBCQWdCQSxZQUFBLEdBQWUsU0FBQyxLQUFELEdBQUE7V0FFZCxNQUZjO0VBQUEsQ0FoQmYsQ0FBQTs7QUFBQSwwQkFvQkEsS0FBQSxHQUFRLFNBQUEsR0FBQTtBQUVQLFdBQU8sTUFBTSxDQUFDLEtBQWQsQ0FGTztFQUFBLENBcEJSLENBQUE7O3VCQUFBOztHQUYyQixRQUFRLENBQUMsVUFBckMsQ0FBQTs7QUFBQSxNQTBCTSxDQUFDLE9BQVAsR0FBaUIsYUExQmpCLENBQUE7Ozs7O0FDQUEsSUFBQSxhQUFBO0VBQUE7aVNBQUE7O0FBQUE7QUFFSSxrQ0FBQSxDQUFBOzs7O0dBQUE7O0FBQUEsMEJBQUEsUUFBQSxHQUVJO0FBQUEsSUFBQSxPQUFBLEVBQVUsNEJBQVY7R0FGSixDQUFBOzt1QkFBQTs7R0FGd0IsUUFBUSxDQUFDLFVBQXJDLENBQUE7O0FBQUEsTUFNTSxDQUFDLE9BQVAsR0FBaUIsYUFOakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLFlBQUE7RUFBQTs7aVNBQUE7O0FBQUE7QUFFSSxpQ0FBQSxDQUFBOzs7Ozs7R0FBQTs7QUFBQSx5QkFBQSxRQUFBLEdBQ0k7QUFBQSxJQUFBLElBQUEsRUFBVyxJQUFYO0FBQUEsSUFDQSxRQUFBLEVBQVcsSUFEWDtBQUFBLElBRUEsT0FBQSxFQUFXLElBRlg7R0FESixDQUFBOztBQUFBLHlCQUtBLFlBQUEsR0FBZSxTQUFBLEdBQUE7QUFDWCxXQUFPLElBQUMsQ0FBQSxHQUFELENBQUssVUFBTCxDQUFQLENBRFc7RUFBQSxDQUxmLENBQUE7O0FBQUEseUJBUUEsU0FBQSxHQUFZLFNBQUMsRUFBRCxHQUFBO0FBQ1IsUUFBQSx1QkFBQTtBQUFBO0FBQUEsU0FBQSxTQUFBO2tCQUFBO0FBQUM7QUFBQSxXQUFBLFVBQUE7cUJBQUE7QUFBQyxRQUFBLElBQVksQ0FBQSxLQUFLLEVBQWpCO0FBQUEsaUJBQU8sQ0FBUCxDQUFBO1NBQUQ7QUFBQSxPQUFEO0FBQUEsS0FBQTtBQUFBLElBQ0EsT0FBTyxDQUFDLElBQVIsQ0FBYywrQkFBQSxHQUErQixFQUE3QyxDQURBLENBQUE7V0FFQSxLQUhRO0VBQUEsQ0FSWixDQUFBOztzQkFBQTs7R0FGdUIsUUFBUSxDQUFDLE1BQXBDLENBQUE7O0FBQUEsTUFlTSxDQUFDLE9BQVAsR0FBaUIsWUFmakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLGFBQUE7RUFBQTtpU0FBQTs7QUFBQTtBQUVDLGtDQUFBLENBQUE7Ozs7R0FBQTs7QUFBQSwwQkFBQSxRQUFBLEdBRUM7QUFBQSxJQUFBLEVBQUEsRUFBTyxFQUFQO0FBQUEsSUFDQSxJQUFBLEVBQU8sRUFEUDtHQUZELENBQUE7O3VCQUFBOztHQUYyQixRQUFRLENBQUMsTUFBckMsQ0FBQTs7QUFBQSxNQU9NLENBQUMsT0FBUCxHQUFpQixhQVBqQixDQUFBOzs7OztBQ0FBLElBQUEsc0VBQUE7RUFBQTs7aVNBQUE7O0FBQUEsYUFBQSxHQUF1QixPQUFBLENBQVEsa0JBQVIsQ0FBdkIsQ0FBQTs7QUFBQSxXQUNBLEdBQXVCLE9BQUEsQ0FBUSx5QkFBUixDQUR2QixDQUFBOztBQUFBLG9CQUVBLEdBQXVCLE9BQUEsQ0FBUSxrQ0FBUixDQUZ2QixDQUFBOztBQUFBLE9BR0EsR0FBdUIsT0FBQSxDQUFRLFNBQVIsQ0FIdkIsQ0FBQTs7QUFBQTtBQU9JLGdDQUFBLENBQUE7Ozs7Ozs7O0dBQUE7O0FBQUEsd0JBQUEsUUFBQSxHQUVJO0FBQUEsSUFBQSxNQUFBLEVBQVMsRUFBVDtBQUFBLElBQ0EsUUFBQSxFQUNJO0FBQUEsTUFBQSxNQUFBLEVBQVksRUFBWjtBQUFBLE1BQ0EsUUFBQSxFQUFZLEVBRFo7QUFBQSxNQUVBLFNBQUEsRUFBWSxFQUZaO0FBQUEsTUFHQSxTQUFBLEVBQVksRUFIWjtLQUZKO0FBQUEsSUFNQSxhQUFBLEVBQWUsRUFOZjtBQUFBLElBT0EsTUFBQSxFQUFTLEVBUFQ7QUFBQSxJQVFBLGFBQUEsRUFDSTtBQUFBLE1BQUEsT0FBQSxFQUFhLElBQWI7QUFBQSxNQUNBLFVBQUEsRUFBYSxJQURiO0FBQUEsTUFFQSxPQUFBLEVBQWEsSUFGYjtLQVRKO0FBQUEsSUFZQSxTQUFBLEVBQVksRUFaWjtBQUFBLElBYUEsTUFBQSxFQUFTLEVBYlQ7QUFBQSxJQWNBLFdBQUEsRUFBYyxFQWRkO0FBQUEsSUFlQSxlQUFBLEVBQWtCLEVBZmxCO0FBQUEsSUFnQkEsT0FBQSxFQUFTLElBaEJUO0FBQUEsSUFpQkEsY0FBQSxFQUFpQixFQWpCakI7QUFBQSxJQW1CQSxXQUFBLEVBQWMsRUFuQmQ7QUFBQSxJQW9CQSxRQUFBLEVBQWMsRUFwQmQ7QUFBQSxJQXFCQSxLQUFBLEVBQWMsRUFyQmQ7QUFBQSxJQXNCQSxXQUFBLEVBQ0k7QUFBQSxNQUFBLE1BQUEsRUFBZ0IsRUFBaEI7QUFBQSxNQUNBLGFBQUEsRUFBZ0IsRUFEaEI7S0F2Qko7QUFBQSxJQXlCQSxRQUFBLEVBQVcsS0F6Qlg7QUFBQSxJQTJCQSxZQUFBLEVBQWUsRUEzQmY7R0FGSixDQUFBOztBQUFBLHdCQStCQSxjQUFBLEdBQWlCLENBQ1QsY0FEUyxFQUVULG9CQUZTLEVBR1QsYUFIUyxFQUlULE9BSlMsRUFLVCxPQUxTLENBL0JqQixDQUFBOztBQUFBLHdCQXVDQSxZQUFBLEdBQWUsU0FBQyxLQUFELEdBQUE7QUFFWCxRQUFBLE1BQUE7QUFBQSxJQUFBLElBQUcsS0FBSyxDQUFDLElBQVQ7QUFDSSxNQUFBLEtBQUssQ0FBQyxHQUFOLEdBQVksTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFkLEdBQXlCLEdBQXpCLEdBQStCLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQXBELEdBQThELEdBQTlELEdBQW9FLEtBQUssQ0FBQyxJQUF0RixDQURKO0tBQUE7QUFHQSxJQUFBLElBQUcsS0FBSyxDQUFDLEtBQVQ7QUFDSSxNQUFBLEtBQUssQ0FBQyxZQUFOLEdBQXFCLFdBQVcsQ0FBQyxRQUFaLENBQXFCLEtBQUssQ0FBQyxLQUEzQixFQUFrQyxDQUFsQyxDQUFyQixDQUFBO0FBQUEsTUFDQSxLQUFLLENBQUMsU0FBTixHQUFxQixJQUFDLENBQUEsWUFBRCxDQUFjLEtBQUssQ0FBQyxZQUFwQixDQURyQixDQURKO0tBSEE7QUFPQSxJQUFBLElBQUcsS0FBSyxDQUFDLElBQU4sSUFBZSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQS9CO0FBQ0ksTUFBQSxLQUFLLENBQUMsU0FBTixHQUNJO0FBQUEsUUFBQSxJQUFBLEVBQWMsb0JBQW9CLENBQUMsZ0JBQXJCLENBQXNDLEtBQUssQ0FBQyxJQUE1QyxDQUFkO0FBQUEsUUFDQSxXQUFBLEVBQWMsb0JBQW9CLENBQUMsZ0JBQXJCLENBQXNDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBbkQsQ0FEZDtPQURKLENBREo7S0FQQTtBQVlBO0FBQUE7O09BWkE7QUFBQSxJQWVBLE1BQUEsR0FBUyxDQUFDLENBQUMsT0FBRixDQUFVLElBQUMsQ0FBQSxjQUFYLENBQTJCLENBQUEsQ0FBQSxDQWZwQyxDQUFBO0FBQUEsSUFnQkEsS0FBSyxDQUFDLFVBQU4sR0FBbUIsTUFoQm5CLENBQUE7QUFBQSxJQWlCQSxLQUFLLENBQUMsYUFBTixHQUF5QixNQUFBLEtBQVUsb0JBQWIsR0FBdUMsT0FBdkMsR0FBb0QsTUFqQjFFLENBQUE7V0FtQkEsTUFyQlc7RUFBQSxDQXZDZixDQUFBOztBQUFBLHdCQThEQSxZQUFBLEdBQWUsU0FBQyxLQUFELEdBQUE7QUFFWCxRQUFBLHFDQUFBO0FBQUEsSUFBQSxJQUFBLEdBQU8sRUFBUCxDQUFBO0FBRUE7QUFBQSxTQUFBLDJDQUFBO3NCQUFBO0FBQ0ksTUFBQSxTQUFBLEdBQWUsSUFBQSxLQUFRLEdBQVgsR0FBb0IsaUJBQXBCLEdBQTJDLG9CQUF2RCxDQUFBO0FBQUEsTUFDQSxJQUFBLElBQVMsZ0JBQUEsR0FBZ0IsU0FBaEIsR0FBMEIsS0FBMUIsR0FBK0IsSUFBL0IsR0FBb0MsU0FEN0MsQ0FESjtBQUFBLEtBRkE7V0FNQSxLQVJXO0VBQUEsQ0E5RGYsQ0FBQTs7QUFBQSx3QkF3RUEsYUFBQSxHQUFnQixTQUFBLEdBQUE7QUFFWixRQUFBLG1DQUFBO0FBQUEsSUFBQSxlQUFBLEdBQWtCLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE1BQU0sQ0FBQyxHQUFoQixDQUFvQixzQkFBcEIsQ0FBbEIsQ0FBQTtBQUFBLElBRUEsS0FBQSxHQUFRLElBQUMsQ0FBQSxHQUFELENBQUssUUFBTCxDQUZSLENBQUE7QUFBQSxJQUdBLElBQUEsR0FBUSxFQUhSLENBQUE7QUFBQSxJQUlBLEtBQUEsR0FBUSxFQUpSLENBQUE7QUFBQSxJQU1BLElBQUEsSUFBUSxFQUFBLEdBQUcsS0FBSyxDQUFDLElBQVQsR0FBYyxNQU50QixDQUFBO0FBUUEsSUFBQSxJQUFHLEtBQUssQ0FBQyxPQUFUO0FBQXNCLE1BQUEsS0FBSyxDQUFDLElBQU4sQ0FBWSxZQUFBLEdBQVksS0FBSyxDQUFDLE9BQWxCLEdBQTBCLHVCQUExQixHQUFpRCxlQUFqRCxHQUFpRSxPQUE3RSxDQUFBLENBQXRCO0tBUkE7QUFTQSxJQUFBLElBQUcsS0FBSyxDQUFDLE9BQVQ7QUFBc0IsTUFBQSxLQUFLLENBQUMsSUFBTixDQUFZLCtCQUFBLEdBQStCLEtBQUssQ0FBQyxPQUFyQyxHQUE2Qyw2QkFBekQsQ0FBQSxDQUF0QjtLQVRBO0FBVUEsSUFBQSxJQUFHLEtBQUssQ0FBQyxNQUFUO0FBQXFCLE1BQUEsS0FBSyxDQUFDLElBQU4sQ0FBWSw4QkFBQSxHQUE4QixLQUFLLENBQUMsTUFBcEMsR0FBMkMsNkJBQXZELENBQUEsQ0FBckI7S0FWQTtBQUFBLElBWUEsSUFBQSxJQUFRLEVBQUEsR0FBRSxDQUFDLEtBQUssQ0FBQyxJQUFOLENBQVcsTUFBWCxDQUFELENBWlYsQ0FBQTtXQWNBLEtBaEJZO0VBQUEsQ0F4RWhCLENBQUE7O0FBQUEsd0JBMkZBLFlBQUEsR0FBZSxTQUFBLEdBQUE7QUFFWCxRQUFBLFlBQUE7QUFBQSxJQUFBLElBQVUsSUFBQyxDQUFBLEdBQUQsQ0FBSyxXQUFMLENBQVY7QUFBQSxZQUFBLENBQUE7S0FBQTtBQUFBLElBRUEsQ0FBQSxHQUFRLElBQUEsT0FBQSxDQUFRLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQWpDLEVBQXVDLENBQXZDLEVBQTBDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQW5FLENBRlIsQ0FBQTtBQUFBLElBR0EsU0FBQSxHQUFZLENBQUMsQ0FBQyxNQUFGLENBQVMsSUFBQyxDQUFBLEdBQUQsQ0FBSyxPQUFMLENBQVQsQ0FIWixDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsR0FBRCxDQUFLLFdBQUwsRUFBa0IsU0FBbEIsQ0FKQSxDQUFBO1dBTUEsS0FSVztFQUFBLENBM0ZmLENBQUE7O3FCQUFBOztHQUZzQixjQUwxQixDQUFBOztBQUFBLE1BNEdNLENBQUMsT0FBUCxHQUFpQixXQTVHakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLHlCQUFBO0VBQUE7O2lTQUFBOztBQUFBLFlBQUEsR0FBZSxPQUFBLENBQVEsc0JBQVIsQ0FBZixDQUFBOztBQUFBLE1BQ0EsR0FBZSxPQUFBLENBQVEsVUFBUixDQURmLENBQUE7O0FBQUE7QUFLSSx3QkFBQSxDQUFBOztBQUFBLEVBQUEsR0FBQyxDQUFBLGlCQUFELEdBQXlCLG1CQUF6QixDQUFBOztBQUFBLEVBQ0EsR0FBQyxDQUFBLHFCQUFELEdBQXlCLHVCQUR6QixDQUFBOztBQUFBLGdCQUdBLFFBQUEsR0FDSTtBQUFBLElBQUEsSUFBQSxFQUFPLFlBQVA7R0FKSixDQUFBOztBQUFBLGdCQU1BLE9BQUEsR0FBVztBQUFBLElBQUEsSUFBQSxFQUFPLElBQVA7QUFBQSxJQUFhLEdBQUEsRUFBTSxJQUFuQjtHQU5YLENBQUE7O0FBQUEsZ0JBT0EsUUFBQSxHQUFXO0FBQUEsSUFBQSxJQUFBLEVBQU8sSUFBUDtBQUFBLElBQWEsR0FBQSxFQUFNLElBQW5CO0dBUFgsQ0FBQTs7QUFTYSxFQUFBLGFBQUEsR0FBQTtBQUVULG1EQUFBLENBQUE7QUFBQSxtREFBQSxDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsRUFBaEIsQ0FBbUIsTUFBTSxDQUFDLGtCQUExQixFQUE4QyxJQUFDLENBQUEsVUFBL0MsQ0FBQSxDQUFBO0FBRUEsV0FBTyxLQUFQLENBSlM7RUFBQSxDQVRiOztBQUFBLGdCQWVBLFVBQUEsR0FBYSxTQUFDLE9BQUQsR0FBQTtBQUVULFFBQUEsc0JBQUE7QUFBQSxJQUFBLElBQUcsT0FBQSxLQUFXLEVBQWQ7QUFBc0IsYUFBTyxJQUFQLENBQXRCO0tBQUE7QUFFQTtBQUFBLFNBQUEsbUJBQUE7OEJBQUE7QUFDSSxNQUFBLElBQUcsR0FBQSxLQUFPLE9BQVY7QUFBdUIsZUFBTyxXQUFQLENBQXZCO09BREo7QUFBQSxLQUZBO1dBS0EsTUFQUztFQUFBLENBZmIsQ0FBQTs7QUFBQSxnQkF3QkEsVUFBQSxHQUFZLFNBQUMsSUFBRCxFQUFPLEdBQVAsRUFBWSxNQUFaLEdBQUE7QUFNUixJQUFBLElBQUMsQ0FBQSxRQUFELEdBQVksSUFBQyxDQUFBLE9BQWIsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLE9BQUQsR0FBWTtBQUFBLE1BQUEsSUFBQSxFQUFPLElBQVA7QUFBQSxNQUFhLEdBQUEsRUFBTSxHQUFuQjtLQURaLENBQUE7QUFHQSxJQUFBLElBQUcsSUFBQyxDQUFBLFFBQVEsQ0FBQyxJQUFWLElBQW1CLElBQUMsQ0FBQSxRQUFRLENBQUMsSUFBVixLQUFrQixJQUFDLENBQUEsT0FBTyxDQUFDLElBQWpEO0FBQ0ksTUFBQSxJQUFDLENBQUEsT0FBRCxDQUFTLEdBQUcsQ0FBQyxxQkFBYixFQUFvQyxJQUFDLENBQUEsT0FBckMsQ0FBQSxDQURKO0tBQUEsTUFBQTtBQUdJLE1BQUEsSUFBQyxDQUFBLE9BQUQsQ0FBUyxHQUFHLENBQUMsaUJBQWIsRUFBZ0MsSUFBQyxDQUFBLFFBQWpDLEVBQTJDLElBQUMsQ0FBQSxPQUE1QyxDQUFBLENBQUE7QUFBQSxNQUNBLElBQUMsQ0FBQSxPQUFELENBQVMsR0FBRyxDQUFDLHFCQUFiLEVBQW9DLElBQUMsQ0FBQSxPQUFyQyxDQURBLENBSEo7S0FIQTtBQVNBLElBQUEsSUFBRyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLE1BQTlCLENBQUEsQ0FBSDtBQUErQyxNQUFBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsYUFBOUIsQ0FBQSxDQUFBLENBQS9DO0tBVEE7V0FXQSxLQWpCUTtFQUFBLENBeEJaLENBQUE7O2FBQUE7O0dBRmMsYUFIbEIsQ0FBQTs7QUFBQSxNQWdETSxDQUFDLE9BQVAsR0FBaUIsR0FoRGpCLENBQUE7Ozs7O0FDQUEsSUFBQSxNQUFBO0VBQUE7O2lTQUFBOztBQUFBO0FBRUksMkJBQUEsQ0FBQTs7Ozs7Ozs7R0FBQTs7QUFBQSxFQUFBLE1BQUMsQ0FBQSxrQkFBRCxHQUFzQixvQkFBdEIsQ0FBQTs7QUFBQSxtQkFFQSxXQUFBLEdBQWMsSUFGZCxDQUFBOztBQUFBLG1CQUlBLE1BQUEsR0FDSTtBQUFBLElBQUEsc0JBQUEsRUFBeUIsYUFBekI7QUFBQSxJQUNBLFVBQUEsRUFBeUIsWUFEekI7R0FMSixDQUFBOztBQUFBLG1CQVFBLElBQUEsR0FBUyxJQVJULENBQUE7O0FBQUEsbUJBU0EsR0FBQSxHQUFTLElBVFQsQ0FBQTs7QUFBQSxtQkFVQSxNQUFBLEdBQVMsSUFWVCxDQUFBOztBQUFBLG1CQVlBLEtBQUEsR0FBUSxTQUFBLEdBQUE7QUFFSixJQUFBLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBakIsQ0FDSTtBQUFBLE1BQUEsU0FBQSxFQUFZLElBQVo7QUFBQSxNQUNBLElBQUEsRUFBWSxHQURaO0tBREosQ0FBQSxDQUFBO1dBSUEsS0FOSTtFQUFBLENBWlIsQ0FBQTs7QUFBQSxtQkFvQkEsV0FBQSxHQUFjLFNBQUUsSUFBRixFQUFnQixHQUFoQixHQUFBO0FBRVYsSUFGVyxJQUFDLENBQUEsc0JBQUEsT0FBTyxJQUVuQixDQUFBO0FBQUEsSUFGeUIsSUFBQyxDQUFBLG9CQUFBLE1BQU0sSUFFaEMsQ0FBQTtBQUFBLElBQUEsT0FBTyxDQUFDLEdBQVIsQ0FBYSxnQ0FBQSxHQUFnQyxJQUFDLENBQUEsSUFBakMsR0FBc0MsV0FBdEMsR0FBaUQsSUFBQyxDQUFBLEdBQWxELEdBQXNELEtBQW5FLENBQUEsQ0FBQTtBQUVBLElBQUEsSUFBRyxJQUFDLENBQUEsV0FBSjtBQUFxQixNQUFBLElBQUMsQ0FBQSxXQUFELEdBQWUsS0FBZixDQUFyQjtLQUZBO0FBSUEsSUFBQSxJQUFHLENBQUEsSUFBRSxDQUFBLElBQUw7QUFBZSxNQUFBLElBQUMsQ0FBQSxJQUFELEdBQVEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUE5QixDQUFmO0tBSkE7QUFBQSxJQU1BLElBQUMsQ0FBQSxPQUFELENBQVMsTUFBTSxDQUFDLGtCQUFoQixFQUFvQyxJQUFDLENBQUEsSUFBckMsRUFBMkMsSUFBQyxDQUFBLEdBQTVDLEVBQWlELElBQUMsQ0FBQSxNQUFsRCxDQU5BLENBQUE7V0FRQSxLQVZVO0VBQUEsQ0FwQmQsQ0FBQTs7QUFBQSxtQkFnQ0EsVUFBQSxHQUFhLFNBQUMsS0FBRCxFQUFhLE9BQWIsRUFBNkIsT0FBN0IsRUFBK0MsTUFBL0MsR0FBQTs7TUFBQyxRQUFRO0tBRWxCOztNQUZzQixVQUFVO0tBRWhDOztNQUZzQyxVQUFVO0tBRWhEO0FBQUEsSUFGdUQsSUFBQyxDQUFBLFNBQUEsTUFFeEQsQ0FBQTtBQUFBLElBQUEsSUFBRyxLQUFLLENBQUMsTUFBTixDQUFhLENBQWIsQ0FBQSxLQUFxQixHQUF4QjtBQUNJLE1BQUEsS0FBQSxHQUFTLEdBQUEsR0FBRyxLQUFaLENBREo7S0FBQTtBQUVBLElBQUEsSUFBRyxLQUFLLENBQUMsTUFBTixDQUFjLEtBQUssQ0FBQyxNQUFOLEdBQWEsQ0FBM0IsQ0FBQSxLQUFvQyxHQUF2QztBQUNJLE1BQUEsS0FBQSxHQUFRLEVBQUEsR0FBRyxLQUFILEdBQVMsR0FBakIsQ0FESjtLQUZBO0FBS0EsSUFBQSxJQUFHLENBQUEsT0FBSDtBQUNJLE1BQUEsSUFBQyxDQUFBLE9BQUQsQ0FBUyxNQUFNLENBQUMsa0JBQWhCLEVBQW9DLEtBQXBDLEVBQTJDLElBQTNDLEVBQWlELElBQUMsQ0FBQSxNQUFsRCxDQUFBLENBQUE7QUFDQSxZQUFBLENBRko7S0FMQTtBQUFBLElBU0EsSUFBQyxDQUFBLFFBQUQsQ0FBVSxLQUFWLEVBQWlCO0FBQUEsTUFBQSxPQUFBLEVBQVMsSUFBVDtBQUFBLE1BQWUsT0FBQSxFQUFTLE9BQXhCO0tBQWpCLENBVEEsQ0FBQTtXQVdBLEtBYlM7RUFBQSxDQWhDYixDQUFBOztBQUFBLG1CQStDQSxLQUFBLEdBQVEsU0FBQSxHQUFBO0FBRUosV0FBTyxNQUFNLENBQUMsS0FBZCxDQUZJO0VBQUEsQ0EvQ1IsQ0FBQTs7Z0JBQUE7O0dBRmlCLFFBQVEsQ0FBQyxPQUE5QixDQUFBOztBQUFBLE1BcURNLENBQUMsT0FBUCxHQUFpQixNQXJEakIsQ0FBQTs7Ozs7QUNBQTtBQUFBOztHQUFBO0FBQUEsSUFBQSxTQUFBO0VBQUEsa0ZBQUE7O0FBQUE7QUFLSSxzQkFBQSxJQUFBLEdBQVUsSUFBVixDQUFBOztBQUFBLHNCQUNBLE9BQUEsR0FBVSxLQURWLENBQUE7O0FBQUEsc0JBR0EsUUFBQSxHQUFrQixDQUhsQixDQUFBOztBQUFBLHNCQUlBLGVBQUEsR0FBa0IsQ0FKbEIsQ0FBQTs7QUFNYyxFQUFBLG1CQUFDLElBQUQsRUFBUSxRQUFSLEdBQUE7QUFFVixJQUZpQixJQUFDLENBQUEsV0FBQSxRQUVsQixDQUFBO0FBQUEseUNBQUEsQ0FBQTtBQUFBLGlEQUFBLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxTQUFELENBQVcsSUFBWCxDQUFBLENBQUE7QUFFQSxXQUFPLElBQVAsQ0FKVTtFQUFBLENBTmQ7O0FBQUEsc0JBWUEsU0FBQSxHQUFZLFNBQUMsSUFBRCxHQUFBO0FBRVIsSUFBQSxJQUFDLENBQUEsSUFBRCxHQUFXLElBQVgsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLE9BQUQsR0FBVyxJQURYLENBQUE7O01BRUEsSUFBQyxDQUFBO0tBRkQ7V0FJQSxLQU5RO0VBQUEsQ0FaWixDQUFBOztBQW9CQTtBQUFBOztLQXBCQTs7QUFBQSxzQkF1QkEsS0FBQSxHQUFRLFNBQUMsS0FBRCxHQUFBO0FBRUosUUFBQSxzQkFBQTtBQUFBLElBQUEsSUFBVSxDQUFBLElBQUUsQ0FBQSxPQUFaO0FBQUEsWUFBQSxDQUFBO0tBQUE7QUFFQSxJQUFBLElBQUcsS0FBSDtBQUVJLE1BQUEsQ0FBQSxHQUFJLElBQUMsQ0FBQSxJQUFLLENBQUEsS0FBQSxDQUFWLENBQUE7QUFFQSxNQUFBLElBQUcsQ0FBSDtBQUVJLFFBQUEsSUFBQSxHQUFPLENBQUMsTUFBRCxFQUFTLE9BQVQsQ0FBUCxDQUFBO0FBQ0EsYUFBQSx3Q0FBQTtzQkFBQTtBQUFBLFVBQUUsSUFBSSxDQUFDLElBQUwsQ0FBVSxHQUFWLENBQUYsQ0FBQTtBQUFBLFNBREE7QUFJQSxRQUFBLElBQUcsTUFBTSxDQUFDLEVBQVY7QUFDSSxVQUFBLEVBQUUsQ0FBQyxLQUFILENBQVMsSUFBVCxFQUFlLElBQWYsQ0FBQSxDQURKO1NBQUEsTUFFSyxJQUFHLElBQUMsQ0FBQSxRQUFELElBQWEsSUFBQyxDQUFBLGVBQWpCO0FBQ0QsVUFBQSxJQUFDLENBQUEsT0FBRCxHQUFXLEtBQVgsQ0FEQztTQUFBLE1BQUE7QUFHRCxVQUFBLFVBQUEsQ0FBVyxDQUFBLFNBQUEsS0FBQSxHQUFBO21CQUFBLFNBQUEsR0FBQTtBQUNQLGNBQUEsS0FBQyxDQUFBLEtBQUQsQ0FBTyxLQUFQLENBQUEsQ0FBQTtxQkFDQSxLQUFDLENBQUEsUUFBRCxHQUZPO1lBQUEsRUFBQTtVQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBWCxFQUdFLElBSEYsQ0FBQSxDQUhDO1NBUlQ7T0FKSjtLQUZBO1dBc0JBLEtBeEJJO0VBQUEsQ0F2QlIsQ0FBQTs7bUJBQUE7O0lBTEosQ0FBQTs7QUFBQSxNQXNETSxDQUFDLE9BQVAsR0FBaUIsU0F0RGpCLENBQUE7Ozs7O0FDQUEsSUFBQSwrQ0FBQTtFQUFBOztpU0FBQTs7QUFBQSxZQUFBLEdBQWUsT0FBQSxDQUFRLHNCQUFSLENBQWYsQ0FBQTs7QUFBQSxRQUNBLEdBQWUsT0FBQSxDQUFRLG1CQUFSLENBRGYsQ0FBQTs7QUFBQSxVQUVBLEdBQWUsT0FBQSxDQUFRLHFCQUFSLENBRmYsQ0FBQTs7QUFBQTtBQU1DLGdDQUFBLENBQUE7O0FBQUEsd0JBQUEsUUFBQSxHQUFZLElBQVosQ0FBQTs7QUFBQSx3QkFHQSxPQUFBLEdBQWUsS0FIZixDQUFBOztBQUFBLHdCQUlBLFlBQUEsR0FBZSxJQUpmLENBQUE7O0FBQUEsd0JBS0EsV0FBQSxHQUFlLElBTGYsQ0FBQTs7QUFPYyxFQUFBLHFCQUFBLEdBQUE7QUFFYixtREFBQSxDQUFBO0FBQUEsbURBQUEsQ0FBQTtBQUFBLHVEQUFBLENBQUE7QUFBQSwrQ0FBQSxDQUFBO0FBQUEscURBQUEsQ0FBQTtBQUFBLHlDQUFBLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxRQUFELEdBQWEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsT0FBTyxDQUFDLElBQTlCLENBQUE7QUFBQSxJQUVBLDJDQUFBLENBRkEsQ0FBQTtBQUlBLFdBQU8sSUFBUCxDQU5hO0VBQUEsQ0FQZDs7QUFBQSx3QkFlQSxLQUFBLEdBQVEsU0FBQyxPQUFELEVBQVUsRUFBVixHQUFBO0FBSVAsUUFBQSxRQUFBOztNQUppQixLQUFHO0tBSXBCO0FBQUEsSUFBQSxJQUFVLElBQUMsQ0FBQSxPQUFYO0FBQUEsWUFBQSxDQUFBO0tBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxVQUFELENBQUEsQ0FGQSxDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsT0FBRCxHQUFXLElBSFgsQ0FBQTtBQUFBLElBS0EsUUFBQSxHQUFXLENBQUMsQ0FBQyxRQUFGLENBQUEsQ0FMWCxDQUFBO0FBT0EsWUFBTyxPQUFQO0FBQUEsV0FDTSxRQUROO0FBRUUsUUFBQSxVQUFVLENBQUMsS0FBWCxDQUFpQixRQUFqQixDQUFBLENBRkY7QUFDTTtBQUROLFdBR00sVUFITjtBQUlFLFFBQUEsUUFBUSxDQUFDLEtBQVQsQ0FBZSxRQUFmLENBQUEsQ0FKRjtBQUFBLEtBUEE7QUFBQSxJQWFBLFFBQVEsQ0FBQyxJQUFULENBQWMsQ0FBQSxTQUFBLEtBQUEsR0FBQTthQUFBLFNBQUMsR0FBRCxHQUFBO2VBQVMsS0FBQyxDQUFBLFdBQUQsQ0FBYSxPQUFiLEVBQXNCLEdBQXRCLEVBQVQ7TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFkLENBYkEsQ0FBQTtBQUFBLElBY0EsUUFBUSxDQUFDLElBQVQsQ0FBYyxDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQyxHQUFELEdBQUE7ZUFBUyxLQUFDLENBQUEsUUFBRCxDQUFVLE9BQVYsRUFBbUIsR0FBbkIsRUFBVDtNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQWQsQ0FkQSxDQUFBO0FBQUEsSUFlQSxRQUFRLENBQUMsTUFBVCxDQUFnQixDQUFBLFNBQUEsS0FBQSxHQUFBO2FBQUEsU0FBQSxHQUFBO2VBQU0sS0FBQyxDQUFBLFlBQUQsQ0FBYyxFQUFkLEVBQU47TUFBQSxFQUFBO0lBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFoQixDQWZBLENBQUE7QUFpQkE7QUFBQTs7O09BakJBO0FBQUEsSUFxQkEsSUFBQyxDQUFBLFlBQUQsR0FBZ0IsVUFBQSxDQUFXLElBQUMsQ0FBQSxZQUFaLEVBQTBCLElBQUMsQ0FBQSxXQUEzQixDQXJCaEIsQ0FBQTtXQXVCQSxTQTNCTztFQUFBLENBZlIsQ0FBQTs7QUFBQSx3QkE0Q0EsV0FBQSxHQUFjLFNBQUMsT0FBRCxFQUFVLElBQVYsR0FBQTtXQUliLEtBSmE7RUFBQSxDQTVDZCxDQUFBOztBQUFBLHdCQWtEQSxRQUFBLEdBQVcsU0FBQyxPQUFELEVBQVUsSUFBVixHQUFBO1dBSVYsS0FKVTtFQUFBLENBbERYLENBQUE7O0FBQUEsd0JBd0RBLFlBQUEsR0FBZSxTQUFDLEVBQUQsR0FBQTs7TUFBQyxLQUFHO0tBRWxCO0FBQUEsSUFBQSxJQUFBLENBQUEsSUFBZSxDQUFBLE9BQWY7QUFBQSxZQUFBLENBQUE7S0FBQTtBQUFBLElBRUEsWUFBQSxDQUFhLElBQUMsQ0FBQSxZQUFkLENBRkEsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLFVBQUQsQ0FBQSxDQUpBLENBQUE7QUFBQSxJQUtBLElBQUMsQ0FBQSxPQUFELEdBQVcsS0FMWCxDQUFBOztNQU9BO0tBUEE7V0FTQSxLQVhjO0VBQUEsQ0F4RGYsQ0FBQTs7QUFxRUE7QUFBQTs7S0FyRUE7O0FBQUEsd0JBd0VBLFVBQUEsR0FBYSxTQUFBLEdBQUE7V0FJWixLQUpZO0VBQUEsQ0F4RWIsQ0FBQTs7QUFBQSx3QkE4RUEsVUFBQSxHQUFhLFNBQUEsR0FBQTtXQUlaLEtBSlk7RUFBQSxDQTlFYixDQUFBOztxQkFBQTs7R0FGeUIsYUFKMUIsQ0FBQTs7QUFBQSxNQTBGTSxDQUFDLE9BQVAsR0FBaUIsV0ExRmpCLENBQUE7Ozs7O0FDQUEsSUFBQSw0QkFBQTs7QUFBQSxNQUFBLEdBQVMsT0FBQSxDQUFRLFlBQVIsQ0FBVCxDQUFBOztBQUFBO29DQUlDOztBQUFBLEVBQUEsb0JBQUMsQ0FBQSxNQUFELEdBQ0M7QUFBQSxJQUFBLGVBQUEsRUFBa0IsQ0FBbEI7QUFBQSxJQUNBLGVBQUEsRUFBa0IsQ0FEbEI7QUFBQSxJQUdBLGlCQUFBLEVBQW9CLEVBSHBCO0FBQUEsSUFJQSxpQkFBQSxFQUFvQixFQUpwQjtBQUFBLElBTUEsa0JBQUEsRUFBcUIsRUFOckI7QUFBQSxJQU9BLGtCQUFBLEVBQXFCLEVBUHJCO0FBQUEsSUFTQSxLQUFBLEVBQVEsdUVBQXVFLENBQUMsS0FBeEUsQ0FBOEUsRUFBOUUsQ0FBaUYsQ0FBQyxHQUFsRixDQUFzRixTQUFDLElBQUQsR0FBQTtBQUFVLGFBQU8sTUFBQSxDQUFPLElBQVAsQ0FBUCxDQUFWO0lBQUEsQ0FBdEYsQ0FUUjtBQUFBLElBV0EsYUFBQSxFQUFnQixvR0FYaEI7R0FERCxDQUFBOztBQUFBLEVBY0Esb0JBQUMsQ0FBQSxVQUFELEdBQWMsRUFkZCxDQUFBOztBQUFBLEVBZ0JBLG9CQUFDLENBQUEsaUJBQUQsR0FBcUIsU0FBQyxHQUFELEVBQU0sWUFBTixHQUFBO0FBRXBCLFFBQUEsUUFBQTs7TUFGMEIsZUFBYTtLQUV2QztBQUFBLElBQUEsRUFBQSxHQUFLLEdBQUcsQ0FBQyxJQUFKLENBQVMsa0JBQVQsQ0FBTCxDQUFBO0FBRUEsSUFBQSxJQUFHLEVBQUEsSUFBTyxvQkFBQyxDQUFBLFVBQVksQ0FBQSxFQUFBLENBQXZCO0FBQ0MsTUFBQSxJQUFBLEdBQU8sb0JBQUMsQ0FBQSxVQUFZLENBQUEsRUFBQSxDQUFwQixDQUREO0tBQUEsTUFBQTtBQUdDLE1BQUEsb0JBQUMsQ0FBQSxVQUFELENBQVksR0FBWixFQUFpQixZQUFqQixDQUFBLENBQUE7QUFBQSxNQUNBLElBQUEsR0FBTyxvQkFBQyxDQUFBLGVBQUQsQ0FBaUIsR0FBakIsQ0FEUCxDQUhEO0tBRkE7V0FRQSxLQVZvQjtFQUFBLENBaEJyQixDQUFBOztBQUFBLEVBNEJBLG9CQUFDLENBQUEsZUFBRCxHQUFtQixTQUFDLEdBQUQsR0FBQTtBQUVsQixRQUFBLFNBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxFQUFSLENBQUE7QUFBQSxJQUVBLEdBQUcsQ0FBQyxJQUFKLENBQVMsc0JBQVQsQ0FBZ0MsQ0FBQyxJQUFqQyxDQUFzQyxTQUFDLENBQUQsRUFBSSxFQUFKLEdBQUE7QUFDckMsVUFBQSxPQUFBO0FBQUEsTUFBQSxPQUFBLEdBQVUsQ0FBQSxDQUFFLEVBQUYsQ0FBVixDQUFBO2FBQ0EsS0FBSyxDQUFDLElBQU4sQ0FDQztBQUFBLFFBQUEsR0FBQSxFQUFhLE9BQWI7QUFBQSxRQUNBLFNBQUEsRUFBYSxPQUFPLENBQUMsSUFBUixDQUFhLG9CQUFiLENBRGI7T0FERCxFQUZxQztJQUFBLENBQXRDLENBRkEsQ0FBQTtBQUFBLElBUUEsRUFBQSxHQUFLLENBQUMsQ0FBQyxRQUFGLENBQUEsQ0FSTCxDQUFBO0FBQUEsSUFTQSxHQUFHLENBQUMsSUFBSixDQUFTLGtCQUFULEVBQTZCLEVBQTdCLENBVEEsQ0FBQTtBQUFBLElBV0Esb0JBQUMsQ0FBQSxVQUFZLENBQUEsRUFBQSxDQUFiLEdBQ0M7QUFBQSxNQUFBLElBQUEsRUFBVSxDQUFDLENBQUMsS0FBRixDQUFRLEtBQVIsRUFBZSxXQUFmLENBQTJCLENBQUMsSUFBNUIsQ0FBaUMsRUFBakMsQ0FBVjtBQUFBLE1BQ0EsR0FBQSxFQUFVLEdBRFY7QUFBQSxNQUVBLEtBQUEsRUFBVSxLQUZWO0FBQUEsTUFHQSxPQUFBLEVBQVUsSUFIVjtLQVpELENBQUE7V0FpQkEsb0JBQUMsQ0FBQSxVQUFZLENBQUEsRUFBQSxFQW5CSztFQUFBLENBNUJuQixDQUFBOztBQUFBLEVBaURBLG9CQUFDLENBQUEsVUFBRCxHQUFjLFNBQUMsR0FBRCxFQUFNLFlBQU4sR0FBQTtBQUViLFFBQUEsa0NBQUE7O01BRm1CLGVBQWE7S0FFaEM7QUFBQSxJQUFBLEtBQUEsR0FBUSxHQUFHLENBQUMsSUFBSixDQUFBLENBQVUsQ0FBQyxLQUFYLENBQWlCLEVBQWpCLENBQVIsQ0FBQTtBQUFBLElBQ0EsS0FBQSxHQUFRLFlBQUEsSUFBZ0IsR0FBRyxDQUFDLElBQUosQ0FBUyw2QkFBVCxDQUFoQixJQUEyRCxFQURuRSxDQUFBO0FBQUEsSUFFQSxJQUFBLEdBQU8sRUFGUCxDQUFBO0FBR0EsU0FBQSw0Q0FBQTt1QkFBQTtBQUNDLE1BQUEsSUFBSSxDQUFDLElBQUwsQ0FBVSxvQkFBQyxDQUFBLGVBQUQsQ0FBaUIsb0JBQUMsQ0FBQSxNQUFNLENBQUMsYUFBekIsRUFBd0M7QUFBQSxRQUFBLElBQUEsRUFBTyxJQUFQO0FBQUEsUUFBYSxLQUFBLEVBQU8sS0FBcEI7T0FBeEMsQ0FBVixDQUFBLENBREQ7QUFBQSxLQUhBO0FBQUEsSUFNQSxHQUFHLENBQUMsSUFBSixDQUFTLElBQUksQ0FBQyxJQUFMLENBQVUsRUFBVixDQUFULENBTkEsQ0FBQTtXQVFBLEtBVmE7RUFBQSxDQWpEZCxDQUFBOztBQUFBLEVBOERBLG9CQUFDLENBQUEsWUFBRCxHQUFnQixTQUFDLElBQUQsRUFBTyxNQUFQLEVBQWUsU0FBZixHQUFBO0FBRWYsUUFBQSxtQ0FBQTs7TUFGOEIsWUFBVTtLQUV4QztBQUFBO0FBQUEsU0FBQSxtREFBQTtxQkFBQTtBQUVDLE1BQUEsVUFBQTtBQUFhLGdCQUFPLElBQVA7QUFBQSxlQUNQLE1BQUEsS0FBVSxPQURIO21CQUNnQixJQUFJLENBQUMsVUFEckI7QUFBQSxlQUVQLE1BQUEsS0FBVSxPQUZIO21CQUVnQixJQUFDLENBQUEsY0FBRCxDQUFBLEVBRmhCO0FBQUEsZUFHUCxNQUFBLEtBQVUsT0FISDttQkFHZ0IsR0FIaEI7QUFBQTttQkFJUCxNQUFNLENBQUMsTUFBUCxDQUFjLENBQWQsQ0FBQSxJQUFvQixHQUpiO0FBQUE7bUNBQWIsQ0FBQTtBQU1BLE1BQUEsSUFBRyxVQUFBLEtBQWMsR0FBakI7QUFBMEIsUUFBQSxVQUFBLEdBQWEsUUFBYixDQUExQjtPQU5BO0FBQUEsTUFRQSxJQUFJLENBQUMsVUFBTCxHQUFrQixvQkFBQyxDQUFBLG9CQUFELENBQUEsQ0FSbEIsQ0FBQTtBQUFBLE1BU0EsSUFBSSxDQUFDLFVBQUwsR0FBa0IsVUFUbEIsQ0FBQTtBQUFBLE1BVUEsSUFBSSxDQUFDLFNBQUwsR0FBa0IsU0FWbEIsQ0FGRDtBQUFBLEtBQUE7V0FjQSxLQWhCZTtFQUFBLENBOURoQixDQUFBOztBQUFBLEVBZ0ZBLG9CQUFDLENBQUEsb0JBQUQsR0FBd0IsU0FBQSxHQUFBO0FBRXZCLFFBQUEsdUJBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxFQUFSLENBQUE7QUFBQSxJQUVBLFNBQUEsR0FBWSxDQUFDLENBQUMsTUFBRixDQUFTLG9CQUFDLENBQUEsTUFBTSxDQUFDLGVBQWpCLEVBQWtDLG9CQUFDLENBQUEsTUFBTSxDQUFDLGVBQTFDLENBRlosQ0FBQTtBQUlBLFNBQVMsOEZBQVQsR0FBQTtBQUNDLE1BQUEsS0FBSyxDQUFDLElBQU4sQ0FDQztBQUFBLFFBQUEsSUFBQSxFQUFXLG9CQUFDLENBQUEsY0FBRCxDQUFBLENBQVg7QUFBQSxRQUNBLE9BQUEsRUFBVyxDQUFDLENBQUMsTUFBRixDQUFTLG9CQUFDLENBQUEsTUFBTSxDQUFDLGlCQUFqQixFQUFvQyxvQkFBQyxDQUFBLE1BQU0sQ0FBQyxpQkFBNUMsQ0FEWDtBQUFBLFFBRUEsUUFBQSxFQUFXLENBQUMsQ0FBQyxNQUFGLENBQVMsb0JBQUMsQ0FBQSxNQUFNLENBQUMsa0JBQWpCLEVBQXFDLG9CQUFDLENBQUEsTUFBTSxDQUFDLGtCQUE3QyxDQUZYO09BREQsQ0FBQSxDQUREO0FBQUEsS0FKQTtXQVVBLE1BWnVCO0VBQUEsQ0FoRnhCLENBQUE7O0FBQUEsRUE4RkEsb0JBQUMsQ0FBQSxjQUFELEdBQWtCLFNBQUEsR0FBQTtBQUVqQixRQUFBLElBQUE7QUFBQSxJQUFBLElBQUEsR0FBTyxvQkFBQyxDQUFBLE1BQU0sQ0FBQyxLQUFPLENBQUEsQ0FBQyxDQUFDLE1BQUYsQ0FBUyxDQUFULEVBQVksb0JBQUMsQ0FBQSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQWQsR0FBcUIsQ0FBakMsQ0FBQSxDQUF0QixDQUFBO1dBRUEsS0FKaUI7RUFBQSxDQTlGbEIsQ0FBQTs7QUFBQSxFQW9HQSxvQkFBQyxDQUFBLHVCQUFELEdBQTJCLFNBQUMsS0FBRCxHQUFBO0FBRTFCLFFBQUEsZ0ZBQUE7QUFBQSxJQUFBLFdBQUEsR0FBYyxDQUFkLENBQUE7QUFBQSxJQUNBLGNBQUEsR0FBaUIsQ0FEakIsQ0FBQTtBQUdBLFNBQUEsb0RBQUE7c0JBQUE7QUFFQyxNQUFBLElBQUEsR0FBTyxDQUFQLENBQUE7QUFDQTtBQUFBLFdBQUEsNkNBQUE7NkJBQUE7QUFBQSxRQUFDLElBQUEsSUFBUSxTQUFTLENBQUMsT0FBVixHQUFvQixTQUFTLENBQUMsUUFBdkMsQ0FBQTtBQUFBLE9BREE7QUFFQSxNQUFBLElBQUcsSUFBQSxHQUFPLFdBQVY7QUFDQyxRQUFBLFdBQUEsR0FBYyxJQUFkLENBQUE7QUFBQSxRQUNBLGNBQUEsR0FBaUIsQ0FEakIsQ0FERDtPQUpEO0FBQUEsS0FIQTtXQVdBLGVBYjBCO0VBQUEsQ0FwRzNCLENBQUE7O0FBQUEsRUFtSEEsb0JBQUMsQ0FBQSxhQUFELEdBQWlCLFNBQUMsSUFBRCxFQUFPLFVBQVAsRUFBbUIsRUFBbkIsR0FBQTtBQUVoQixRQUFBLHlEQUFBO0FBQUEsSUFBQSxVQUFBLEdBQWEsQ0FBYixDQUFBO0FBRUEsSUFBQSxJQUFHLFVBQUg7QUFDQyxNQUFBLG9CQUFDLENBQUEsWUFBRCxDQUFjLElBQUksQ0FBQyxLQUFuQixFQUEwQixVQUExQixFQUFzQyxJQUF0QyxFQUE0QyxFQUE1QyxDQUFBLENBREQ7S0FBQSxNQUFBO0FBR0MsTUFBQSxjQUFBLEdBQWlCLG9CQUFDLENBQUEsdUJBQUQsQ0FBeUIsSUFBSSxDQUFDLEtBQTlCLENBQWpCLENBQUE7QUFDQTtBQUFBLFdBQUEsbURBQUE7dUJBQUE7QUFDQyxRQUFBLElBQUEsR0FBTyxDQUFFLElBQUksQ0FBQyxLQUFQLEVBQWMsQ0FBZCxFQUFpQixLQUFqQixDQUFQLENBQUE7QUFDQSxRQUFBLElBQUcsQ0FBQSxLQUFLLGNBQVI7QUFBNEIsVUFBQSxJQUFJLENBQUMsSUFBTCxDQUFVLEVBQVYsQ0FBQSxDQUE1QjtTQURBO0FBQUEsUUFFQSxvQkFBQyxDQUFBLFlBQVksQ0FBQyxLQUFkLENBQW9CLG9CQUFwQixFQUF1QixJQUF2QixDQUZBLENBREQ7QUFBQSxPQUpEO0tBRkE7V0FXQSxLQWJnQjtFQUFBLENBbkhqQixDQUFBOztBQUFBLEVBa0lBLG9CQUFDLENBQUEsWUFBRCxHQUFnQixTQUFDLEtBQUQsRUFBUSxHQUFSLEVBQWEsT0FBYixFQUFzQixFQUF0QixHQUFBO0FBRWYsUUFBQSxJQUFBO0FBQUEsSUFBQSxJQUFBLEdBQU8sS0FBTSxDQUFBLEdBQUEsQ0FBYixDQUFBO0FBRUEsSUFBQSxJQUFHLE9BQUg7QUFFQyxNQUFBLG9CQUFDLENBQUEsa0JBQUQsQ0FBb0IsSUFBcEIsRUFBMEIsU0FBQSxHQUFBO0FBRXpCLFFBQUEsSUFBRyxHQUFBLEtBQU8sS0FBSyxDQUFDLE1BQU4sR0FBYSxDQUF2QjtpQkFDQyxvQkFBQyxDQUFBLGlCQUFELENBQW1CLEVBQW5CLEVBREQ7U0FBQSxNQUFBO2lCQUdDLG9CQUFDLENBQUEsWUFBRCxDQUFjLEtBQWQsRUFBcUIsR0FBQSxHQUFJLENBQXpCLEVBQTRCLE9BQTVCLEVBQXFDLEVBQXJDLEVBSEQ7U0FGeUI7TUFBQSxDQUExQixDQUFBLENBRkQ7S0FBQSxNQUFBO0FBV0MsTUFBQSxJQUFHLE1BQUEsQ0FBQSxFQUFBLEtBQWEsVUFBaEI7QUFDQyxRQUFBLG9CQUFDLENBQUEsa0JBQUQsQ0FBb0IsSUFBcEIsRUFBMEIsU0FBQSxHQUFBO2lCQUFHLG9CQUFDLENBQUEsaUJBQUQsQ0FBbUIsRUFBbkIsRUFBSDtRQUFBLENBQTFCLENBQUEsQ0FERDtPQUFBLE1BQUE7QUFHQyxRQUFBLG9CQUFDLENBQUEsa0JBQUQsQ0FBb0IsSUFBcEIsQ0FBQSxDQUhEO09BWEQ7S0FGQTtXQWtCQSxLQXBCZTtFQUFBLENBbEloQixDQUFBOztBQUFBLEVBd0pBLG9CQUFDLENBQUEsa0JBQUQsR0FBc0IsU0FBQyxJQUFELEVBQU8sRUFBUCxHQUFBO0FBRXJCLFFBQUEsU0FBQTtBQUFBLElBQUEsSUFBRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQW5CO0FBRUMsTUFBQSxTQUFBLEdBQVksSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFoQixDQUFBLENBQVosQ0FBQTtBQUFBLE1BRUEsVUFBQSxDQUFXLFNBQUEsR0FBQTtBQUNWLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFULENBQWMsU0FBUyxDQUFDLElBQXhCLENBQUEsQ0FBQTtlQUVBLFVBQUEsQ0FBVyxTQUFBLEdBQUE7aUJBQ1Ysb0JBQUMsQ0FBQSxrQkFBRCxDQUFvQixJQUFwQixFQUEwQixFQUExQixFQURVO1FBQUEsQ0FBWCxFQUVFLFNBQVMsQ0FBQyxRQUZaLEVBSFU7TUFBQSxDQUFYLEVBT0UsU0FBUyxDQUFDLE9BUFosQ0FGQSxDQUZEO0tBQUEsTUFBQTtBQWVDLE1BQUEsSUFBSSxDQUFDLEdBQ0osQ0FBQyxJQURGLENBQ08sMEJBRFAsRUFDbUMsSUFBSSxDQUFDLFNBRHhDLENBRUMsQ0FBQyxJQUZGLENBRU8sSUFBSSxDQUFDLFVBRlosQ0FBQSxDQUFBOztRQUlBO09BbkJEO0tBQUE7V0FxQkEsS0F2QnFCO0VBQUEsQ0F4SnRCLENBQUE7O0FBQUEsRUFpTEEsb0JBQUMsQ0FBQSxpQkFBRCxHQUFxQixTQUFDLEVBQUQsR0FBQTs7TUFFcEI7S0FBQTtXQUVBLEtBSm9CO0VBQUEsQ0FqTHJCLENBQUE7O0FBQUEsRUF1TEEsb0JBQUMsQ0FBQSxlQUFELEdBQW1CLFNBQUMsR0FBRCxFQUFNLElBQU4sR0FBQTtBQUVsQixXQUFPLEdBQUcsQ0FBQyxPQUFKLENBQVksaUJBQVosRUFBK0IsU0FBQyxDQUFELEVBQUksQ0FBSixHQUFBO0FBQ3JDLFVBQUEsQ0FBQTtBQUFBLE1BQUEsQ0FBQSxHQUFJLElBQUssQ0FBQSxDQUFBLENBQVQsQ0FBQTtBQUNDLE1BQUEsSUFBRyxNQUFBLENBQUEsQ0FBQSxLQUFZLFFBQVosSUFBd0IsTUFBQSxDQUFBLENBQUEsS0FBWSxRQUF2QztlQUFxRCxFQUFyRDtPQUFBLE1BQUE7ZUFBNEQsRUFBNUQ7T0FGb0M7SUFBQSxDQUEvQixDQUFQLENBRmtCO0VBQUEsQ0F2TG5CLENBQUE7O0FBQUEsRUE2TEEsb0JBQUMsQ0FBQSxFQUFELEdBQU0sU0FBQyxVQUFELEVBQWEsR0FBYixFQUFrQixTQUFsQixFQUE2QixVQUE3QixFQUErQyxFQUEvQyxHQUFBO0FBRUwsUUFBQSxvQkFBQTs7TUFGa0MsYUFBVztLQUU3Qzs7TUFGb0QsS0FBRztLQUV2RDtBQUFBLElBQUEsSUFBRyxDQUFDLENBQUMsT0FBRixDQUFVLEdBQVYsQ0FBSDtBQUNDLFdBQUEsMENBQUE7dUJBQUE7QUFBQSxRQUFDLG9CQUFDLENBQUEsRUFBRCxDQUFJLFVBQUosRUFBZ0IsSUFBaEIsRUFBc0IsU0FBdEIsRUFBaUMsRUFBakMsQ0FBRCxDQUFBO0FBQUEsT0FBQTtBQUNBLFlBQUEsQ0FGRDtLQUFBO0FBQUEsSUFJQSxJQUFBLEdBQU8sb0JBQUMsQ0FBQSxpQkFBRCxDQUFtQixHQUFuQixDQUpQLENBQUE7QUFBQSxJQUtBLElBQUksQ0FBQyxPQUFMLEdBQWUsSUFMZixDQUFBO0FBQUEsSUFPQSxvQkFBQyxDQUFBLFlBQUQsQ0FBYyxJQUFkLEVBQW9CLFVBQXBCLEVBQWdDLFNBQWhDLENBUEEsQ0FBQTtBQUFBLElBUUEsb0JBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQUFxQixVQUFyQixFQUFpQyxFQUFqQyxDQVJBLENBQUE7V0FVQSxLQVpLO0VBQUEsQ0E3TE4sQ0FBQTs7QUFBQSxFQTJNQSxvQkFBQyxDQUFBLElBQUEsQ0FBRCxHQUFNLFNBQUMsR0FBRCxFQUFNLFNBQU4sRUFBaUIsVUFBakIsRUFBbUMsRUFBbkMsR0FBQTtBQUVMLFFBQUEsb0JBQUE7O01BRnNCLGFBQVc7S0FFakM7O01BRndDLEtBQUc7S0FFM0M7QUFBQSxJQUFBLElBQUcsQ0FBQyxDQUFDLE9BQUYsQ0FBVSxHQUFWLENBQUg7QUFDQyxXQUFBLDBDQUFBO3VCQUFBO0FBQUEsUUFBQyxvQkFBQyxDQUFBLElBQUEsQ0FBRCxDQUFJLElBQUosRUFBVSxTQUFWLEVBQXFCLEVBQXJCLENBQUQsQ0FBQTtBQUFBLE9BQUE7QUFDQSxZQUFBLENBRkQ7S0FBQTtBQUFBLElBSUEsSUFBQSxHQUFPLG9CQUFDLENBQUEsaUJBQUQsQ0FBbUIsR0FBbkIsQ0FKUCxDQUFBO0FBQUEsSUFLQSxJQUFJLENBQUMsT0FBTCxHQUFlLElBTGYsQ0FBQTtBQUFBLElBT0Esb0JBQUMsQ0FBQSxZQUFELENBQWMsSUFBZCxFQUFvQixPQUFwQixFQUE2QixTQUE3QixDQVBBLENBQUE7QUFBQSxJQVFBLG9CQUFDLENBQUEsYUFBRCxDQUFlLElBQWYsRUFBcUIsVUFBckIsRUFBaUMsRUFBakMsQ0FSQSxDQUFBO1dBVUEsS0FaSztFQUFBLENBM01OLENBQUE7O0FBQUEsRUF5TkEsb0JBQUMsQ0FBQSxHQUFELEdBQU8sU0FBQyxHQUFELEVBQU0sU0FBTixFQUFpQixVQUFqQixFQUFtQyxFQUFuQyxHQUFBO0FBRU4sUUFBQSxvQkFBQTs7TUFGdUIsYUFBVztLQUVsQzs7TUFGeUMsS0FBRztLQUU1QztBQUFBLElBQUEsSUFBRyxDQUFDLENBQUMsT0FBRixDQUFVLEdBQVYsQ0FBSDtBQUNDLFdBQUEsMENBQUE7dUJBQUE7QUFBQSxRQUFDLG9CQUFDLENBQUEsR0FBRCxDQUFLLElBQUwsRUFBVyxTQUFYLEVBQXNCLEVBQXRCLENBQUQsQ0FBQTtBQUFBLE9BQUE7QUFDQSxZQUFBLENBRkQ7S0FBQTtBQUFBLElBSUEsSUFBQSxHQUFPLG9CQUFDLENBQUEsaUJBQUQsQ0FBbUIsR0FBbkIsQ0FKUCxDQUFBO0FBS0EsSUFBQSxJQUFVLENBQUEsSUFBSyxDQUFDLE9BQWhCO0FBQUEsWUFBQSxDQUFBO0tBTEE7QUFBQSxJQU9BLElBQUksQ0FBQyxPQUFMLEdBQWUsS0FQZixDQUFBO0FBQUEsSUFTQSxvQkFBQyxDQUFBLFlBQUQsQ0FBYyxJQUFkLEVBQW9CLE9BQXBCLEVBQTZCLFNBQTdCLENBVEEsQ0FBQTtBQUFBLElBVUEsb0JBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQUFxQixVQUFyQixFQUFpQyxFQUFqQyxDQVZBLENBQUE7V0FZQSxLQWRNO0VBQUEsQ0F6TlAsQ0FBQTs7QUFBQSxFQXlPQSxvQkFBQyxDQUFBLFFBQUQsR0FBWSxTQUFDLEdBQUQsRUFBTSxTQUFOLEVBQWlCLFVBQWpCLEVBQW1DLEVBQW5DLEdBQUE7QUFFWCxRQUFBLG9CQUFBOztNQUY0QixhQUFXO0tBRXZDOztNQUY4QyxLQUFHO0tBRWpEO0FBQUEsSUFBQSxJQUFHLENBQUMsQ0FBQyxPQUFGLENBQVUsR0FBVixDQUFIO0FBQ0MsV0FBQSwwQ0FBQTt1QkFBQTtBQUFBLFFBQUMsb0JBQUMsQ0FBQSxRQUFELENBQVUsSUFBVixFQUFnQixTQUFoQixFQUEyQixFQUEzQixDQUFELENBQUE7QUFBQSxPQUFBO0FBQ0EsWUFBQSxDQUZEO0tBQUE7QUFBQSxJQUlBLElBQUEsR0FBTyxvQkFBQyxDQUFBLGlCQUFELENBQW1CLEdBQW5CLENBSlAsQ0FBQTtBQU1BLElBQUEsSUFBVSxDQUFBLElBQUssQ0FBQyxPQUFoQjtBQUFBLFlBQUEsQ0FBQTtLQU5BO0FBQUEsSUFRQSxvQkFBQyxDQUFBLFlBQUQsQ0FBYyxJQUFkLEVBQW9CLE9BQXBCLEVBQTZCLFNBQTdCLENBUkEsQ0FBQTtBQUFBLElBU0Esb0JBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQUFxQixVQUFyQixFQUFpQyxFQUFqQyxDQVRBLENBQUE7V0FXQSxLQWJXO0VBQUEsQ0F6T1osQ0FBQTs7QUFBQSxFQXdQQSxvQkFBQyxDQUFBLFVBQUQsR0FBYyxTQUFDLEdBQUQsRUFBTSxTQUFOLEVBQWlCLFVBQWpCLEVBQW1DLEVBQW5DLEdBQUE7QUFFYixRQUFBLG9CQUFBOztNQUY4QixhQUFXO0tBRXpDOztNQUZnRCxLQUFHO0tBRW5EO0FBQUEsSUFBQSxJQUFHLENBQUMsQ0FBQyxPQUFGLENBQVUsR0FBVixDQUFIO0FBQ0MsV0FBQSwwQ0FBQTt1QkFBQTtBQUFBLFFBQUMsb0JBQUMsQ0FBQSxVQUFELENBQVksSUFBWixFQUFrQixTQUFsQixFQUE2QixFQUE3QixDQUFELENBQUE7QUFBQSxPQUFBO0FBQ0EsWUFBQSxDQUZEO0tBQUE7QUFBQSxJQUlBLElBQUEsR0FBTyxvQkFBQyxDQUFBLGlCQUFELENBQW1CLEdBQW5CLENBSlAsQ0FBQTtBQU1BLElBQUEsSUFBVSxDQUFBLElBQUssQ0FBQyxPQUFoQjtBQUFBLFlBQUEsQ0FBQTtLQU5BO0FBQUEsSUFRQSxvQkFBQyxDQUFBLFlBQUQsQ0FBYyxJQUFkLEVBQW9CLE9BQXBCLEVBQTZCLFNBQTdCLENBUkEsQ0FBQTtBQUFBLElBU0Esb0JBQUMsQ0FBQSxhQUFELENBQWUsSUFBZixFQUFxQixVQUFyQixFQUFpQyxFQUFqQyxDQVRBLENBQUE7V0FXQSxLQWJhO0VBQUEsQ0F4UGQsQ0FBQTs7QUFBQSxFQXVRQSxvQkFBQyxDQUFBLE9BQUQsR0FBVyxTQUFDLEdBQUQsRUFBTSxZQUFOLEdBQUE7QUFFVixRQUFBLGNBQUE7QUFBQSxJQUFBLElBQUcsQ0FBQyxDQUFDLE9BQUYsQ0FBVSxHQUFWLENBQUg7QUFDQyxXQUFBLDBDQUFBO3VCQUFBO0FBQUEsUUFBQyxvQkFBQyxDQUFBLE9BQUQsQ0FBUyxJQUFULEVBQWUsWUFBZixDQUFELENBQUE7QUFBQSxPQUFBO0FBQ0EsWUFBQSxDQUZEO0tBQUE7QUFBQSxJQUlBLG9CQUFDLENBQUEsaUJBQUQsQ0FBbUIsR0FBbkIsRUFBd0IsWUFBeEIsQ0FKQSxDQUFBO1dBTUEsS0FSVTtFQUFBLENBdlFYLENBQUE7O0FBQUEsRUFpUkEsb0JBQUMsQ0FBQSxnQkFBRCxHQUFvQixTQUFDLElBQUQsR0FBQTtBQUVuQixRQUFBLDhCQUFBO0FBQUEsSUFBQSxRQUFBLEdBQVcsRUFBWCxDQUFBO0FBQ0E7QUFBQSxTQUFBLDJDQUFBO3NCQUFBO0FBQUEsTUFBQyxRQUFRLENBQUMsSUFBVCxDQUFjLG9CQUFDLENBQUEsY0FBRCxDQUFBLENBQWQsQ0FBRCxDQUFBO0FBQUEsS0FEQTtBQUdBLFdBQU8sUUFBUSxDQUFDLElBQVQsQ0FBYyxFQUFkLENBQVAsQ0FMbUI7RUFBQSxDQWpScEIsQ0FBQTs7OEJBQUE7O0lBSkQsQ0FBQTs7QUFBQSxNQTRSTSxDQUFDLE9BQVAsR0FBaUIsb0JBNVJqQixDQUFBOzs7OztBQ0FBLElBQUEsc0JBQUE7RUFBQTtpU0FBQTs7QUFBQSxZQUFBLEdBQWUsT0FBQSxDQUFRLHNCQUFSLENBQWYsQ0FBQTs7QUFFQTtBQUFBOzs7R0FGQTs7QUFBQTtBQVNDLDZCQUFBLENBQUE7Ozs7R0FBQTs7QUFBQSxFQUFBLFFBQUMsQ0FBQSxHQUFELEdBQWUscUNBQWYsQ0FBQTs7QUFBQSxFQUVBLFFBQUMsQ0FBQSxXQUFELEdBQWUsT0FGZixDQUFBOztBQUFBLEVBSUEsUUFBQyxDQUFBLFFBQUQsR0FBZSxJQUpmLENBQUE7O0FBQUEsRUFLQSxRQUFDLENBQUEsTUFBRCxHQUFlLEtBTGYsQ0FBQTs7QUFBQSxFQU9BLFFBQUMsQ0FBQSxJQUFELEdBQVEsU0FBQSxHQUFBO0FBRVA7QUFBQTs7O09BQUE7V0FNQSxLQVJPO0VBQUEsQ0FQUixDQUFBOztBQUFBLEVBaUJBLFFBQUMsQ0FBQSxJQUFELEdBQVEsU0FBQSxHQUFBO0FBRVAsSUFBQSxRQUFDLENBQUEsTUFBRCxHQUFVLElBQVYsQ0FBQTtBQUFBLElBRUEsRUFBRSxDQUFDLElBQUgsQ0FDQztBQUFBLE1BQUEsS0FBQSxFQUFTLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBdkI7QUFBQSxNQUNBLE1BQUEsRUFBUyxLQURUO0FBQUEsTUFFQSxLQUFBLEVBQVMsS0FGVDtLQURELENBRkEsQ0FBQTtXQU9BLEtBVE87RUFBQSxDQWpCUixDQUFBOztBQUFBLEVBNEJBLFFBQUMsQ0FBQSxLQUFELEdBQVMsU0FBRSxRQUFGLEdBQUE7QUFFUixJQUZTLFFBQUMsQ0FBQSxXQUFBLFFBRVYsQ0FBQTtBQUFBLElBQUEsSUFBRyxDQUFBLFFBQUUsQ0FBQSxNQUFMO0FBQWlCLGFBQU8sUUFBQyxDQUFBLFFBQVEsQ0FBQyxNQUFWLENBQWlCLGdCQUFqQixDQUFQLENBQWpCO0tBQUE7QUFBQSxJQUVBLEVBQUUsQ0FBQyxLQUFILENBQVMsU0FBRSxHQUFGLEdBQUE7QUFFUixNQUFBLElBQUcsR0FBSSxDQUFBLFFBQUEsQ0FBSixLQUFpQixXQUFwQjtlQUNDLFFBQUMsQ0FBQSxXQUFELENBQWEsR0FBSSxDQUFBLGNBQUEsQ0FBZ0IsQ0FBQSxhQUFBLENBQWpDLEVBREQ7T0FBQSxNQUFBO2VBR0MsUUFBQyxDQUFBLFFBQVEsQ0FBQyxNQUFWLENBQWlCLGFBQWpCLEVBSEQ7T0FGUTtJQUFBLENBQVQsRUFPRTtBQUFBLE1BQUUsS0FBQSxFQUFPLFFBQUMsQ0FBQSxXQUFWO0tBUEYsQ0FGQSxDQUFBO1dBV0EsS0FiUTtFQUFBLENBNUJULENBQUE7O0FBQUEsRUEyQ0EsUUFBQyxDQUFBLFdBQUQsR0FBZSxTQUFDLEtBQUQsR0FBQTtBQUVkLFFBQUEseUJBQUE7QUFBQSxJQUFBLFFBQUEsR0FBVyxFQUFYLENBQUE7QUFBQSxJQUNBLFFBQVEsQ0FBQyxZQUFULEdBQXdCLEtBRHhCLENBQUE7QUFBQSxJQUdBLE1BQUEsR0FBVyxDQUFDLENBQUMsUUFBRixDQUFBLENBSFgsQ0FBQTtBQUFBLElBSUEsT0FBQSxHQUFXLENBQUMsQ0FBQyxRQUFGLENBQUEsQ0FKWCxDQUFBO0FBQUEsSUFNQSxFQUFFLENBQUMsR0FBSCxDQUFPLEtBQVAsRUFBYyxTQUFDLEdBQUQsR0FBQTtBQUViLE1BQUEsUUFBUSxDQUFDLFNBQVQsR0FBcUIsR0FBRyxDQUFDLElBQXpCLENBQUE7QUFBQSxNQUNBLFFBQVEsQ0FBQyxTQUFULEdBQXFCLEdBQUcsQ0FBQyxFQUR6QixDQUFBO0FBQUEsTUFFQSxRQUFRLENBQUMsS0FBVCxHQUFxQixHQUFHLENBQUMsS0FBSixJQUFhLEtBRmxDLENBQUE7YUFHQSxNQUFNLENBQUMsT0FBUCxDQUFBLEVBTGE7SUFBQSxDQUFkLENBTkEsQ0FBQTtBQUFBLElBYUEsRUFBRSxDQUFDLEdBQUgsQ0FBTyxhQUFQLEVBQXNCO0FBQUEsTUFBRSxPQUFBLEVBQVMsS0FBWDtLQUF0QixFQUEwQyxTQUFDLEdBQUQsR0FBQTtBQUV6QyxNQUFBLFFBQVEsQ0FBQyxXQUFULEdBQXVCLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBaEMsQ0FBQTthQUNBLE9BQU8sQ0FBQyxPQUFSLENBQUEsRUFIeUM7SUFBQSxDQUExQyxDQWJBLENBQUE7QUFBQSxJQWtCQSxDQUFDLENBQUMsSUFBRixDQUFPLE1BQVAsRUFBZSxPQUFmLENBQXVCLENBQUMsSUFBeEIsQ0FBNkIsU0FBQSxHQUFBO2FBQUcsUUFBQyxDQUFBLFFBQVEsQ0FBQyxPQUFWLENBQWtCLFFBQWxCLEVBQUg7SUFBQSxDQUE3QixDQWxCQSxDQUFBO1dBb0JBLEtBdEJjO0VBQUEsQ0EzQ2YsQ0FBQTs7QUFBQSxFQW1FQSxRQUFDLENBQUEsS0FBRCxHQUFTLFNBQUMsSUFBRCxFQUFPLEVBQVAsR0FBQTtBQUVSLElBQUEsRUFBRSxDQUFDLEVBQUgsQ0FBTTtBQUFBLE1BQ0wsTUFBQSxFQUFjLElBQUksQ0FBQyxNQUFMLElBQWUsTUFEeEI7QUFBQSxNQUVMLElBQUEsRUFBYyxJQUFJLENBQUMsSUFBTCxJQUFhLEVBRnRCO0FBQUEsTUFHTCxJQUFBLEVBQWMsSUFBSSxDQUFDLElBQUwsSUFBYSxFQUh0QjtBQUFBLE1BSUwsT0FBQSxFQUFjLElBQUksQ0FBQyxPQUFMLElBQWdCLEVBSnpCO0FBQUEsTUFLTCxPQUFBLEVBQWMsSUFBSSxDQUFDLE9BQUwsSUFBZ0IsRUFMekI7QUFBQSxNQU1MLFdBQUEsRUFBYyxJQUFJLENBQUMsV0FBTCxJQUFvQixFQU43QjtLQUFOLEVBT0csU0FBQyxRQUFELEdBQUE7d0NBQ0YsR0FBSSxtQkFERjtJQUFBLENBUEgsQ0FBQSxDQUFBO1dBVUEsS0FaUTtFQUFBLENBbkVULENBQUE7O2tCQUFBOztHQUZzQixhQVB2QixDQUFBOztBQUFBLE1BMEZNLENBQUMsT0FBUCxHQUFpQixRQTFGakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLHdCQUFBO0VBQUE7aVNBQUE7O0FBQUEsWUFBQSxHQUFlLE9BQUEsQ0FBUSxzQkFBUixDQUFmLENBQUE7O0FBRUE7QUFBQTs7O0dBRkE7O0FBQUE7QUFTQywrQkFBQSxDQUFBOzs7O0dBQUE7O0FBQUEsRUFBQSxVQUFDLENBQUEsR0FBRCxHQUFZLDhDQUFaLENBQUE7O0FBQUEsRUFFQSxVQUFDLENBQUEsTUFBRCxHQUNDO0FBQUEsSUFBQSxVQUFBLEVBQWlCLElBQWpCO0FBQUEsSUFDQSxVQUFBLEVBQWlCLElBRGpCO0FBQUEsSUFFQSxPQUFBLEVBQWlCLGdEQUZqQjtBQUFBLElBR0EsY0FBQSxFQUFpQixNQUhqQjtHQUhELENBQUE7O0FBQUEsRUFRQSxVQUFDLENBQUEsUUFBRCxHQUFZLElBUlosQ0FBQTs7QUFBQSxFQVNBLFVBQUMsQ0FBQSxNQUFELEdBQVksS0FUWixDQUFBOztBQUFBLEVBV0EsVUFBQyxDQUFBLElBQUQsR0FBUSxTQUFBLEdBQUE7QUFFUDtBQUFBOzs7T0FBQTtXQU1BLEtBUk87RUFBQSxDQVhSLENBQUE7O0FBQUEsRUFxQkEsVUFBQyxDQUFBLElBQUQsR0FBUSxTQUFBLEdBQUE7QUFFUCxJQUFBLFVBQUMsQ0FBQSxNQUFELEdBQVUsSUFBVixDQUFBO0FBQUEsSUFFQSxVQUFDLENBQUEsTUFBTyxDQUFBLFVBQUEsQ0FBUixHQUFzQixNQUFNLENBQUMsTUFBTSxDQUFDLFNBRnBDLENBQUE7QUFBQSxJQUdBLFVBQUMsQ0FBQSxNQUFPLENBQUEsVUFBQSxDQUFSLEdBQXNCLFVBQUMsQ0FBQSxhQUh2QixDQUFBO1dBS0EsS0FQTztFQUFBLENBckJSLENBQUE7O0FBQUEsRUE4QkEsVUFBQyxDQUFBLEtBQUQsR0FBUyxTQUFFLFFBQUYsR0FBQTtBQUVSLElBRlMsVUFBQyxDQUFBLFdBQUEsUUFFVixDQUFBO0FBQUEsSUFBQSxJQUFHLFVBQUMsQ0FBQSxNQUFKO0FBQ0MsTUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQVYsQ0FBaUIsVUFBQyxDQUFBLE1BQWxCLENBQUEsQ0FERDtLQUFBLE1BQUE7QUFHQyxNQUFBLFVBQUMsQ0FBQSxRQUFRLENBQUMsTUFBVixDQUFpQixnQkFBakIsQ0FBQSxDQUhEO0tBQUE7V0FLQSxLQVBRO0VBQUEsQ0E5QlQsQ0FBQTs7QUFBQSxFQXVDQSxVQUFDLENBQUEsYUFBRCxHQUFpQixTQUFDLEdBQUQsR0FBQTtBQUVoQixJQUFBLElBQUcsR0FBSSxDQUFBLFFBQUEsQ0FBVSxDQUFBLFdBQUEsQ0FBakI7QUFDQyxNQUFBLFVBQUMsQ0FBQSxXQUFELENBQWEsR0FBSSxDQUFBLGNBQUEsQ0FBakIsQ0FBQSxDQUREO0tBQUEsTUFFSyxJQUFHLEdBQUksQ0FBQSxPQUFBLENBQVMsQ0FBQSxlQUFBLENBQWhCO0FBQ0osTUFBQSxVQUFDLENBQUEsUUFBUSxDQUFDLE1BQVYsQ0FBaUIsYUFBakIsQ0FBQSxDQURJO0tBRkw7V0FLQSxLQVBnQjtFQUFBLENBdkNqQixDQUFBOztBQUFBLEVBZ0RBLFVBQUMsQ0FBQSxXQUFELEdBQWUsU0FBQyxLQUFELEdBQUE7QUFFZCxJQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBWixDQUFpQixNQUFqQixFQUF3QixJQUF4QixFQUE4QixTQUFBLEdBQUE7QUFFN0IsVUFBQSxPQUFBO0FBQUEsTUFBQSxPQUFBLEdBQVUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQXhCLENBQTRCO0FBQUEsUUFBQSxRQUFBLEVBQVUsSUFBVjtPQUE1QixDQUFWLENBQUE7YUFDQSxPQUFPLENBQUMsT0FBUixDQUFnQixTQUFDLEdBQUQsR0FBQTtBQUVmLFlBQUEsUUFBQTtBQUFBLFFBQUEsUUFBQSxHQUNDO0FBQUEsVUFBQSxZQUFBLEVBQWUsS0FBZjtBQUFBLFVBQ0EsU0FBQSxFQUFlLEdBQUcsQ0FBQyxXQURuQjtBQUFBLFVBRUEsU0FBQSxFQUFlLEdBQUcsQ0FBQyxFQUZuQjtBQUFBLFVBR0EsS0FBQSxFQUFrQixHQUFHLENBQUMsTUFBTyxDQUFBLENBQUEsQ0FBZCxHQUFzQixHQUFHLENBQUMsTUFBTyxDQUFBLENBQUEsQ0FBRSxDQUFDLEtBQXBDLEdBQStDLEtBSDlEO0FBQUEsVUFJQSxXQUFBLEVBQWUsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUp6QjtTQURELENBQUE7ZUFPQSxVQUFDLENBQUEsUUFBUSxDQUFDLE9BQVYsQ0FBa0IsUUFBbEIsRUFUZTtNQUFBLENBQWhCLEVBSDZCO0lBQUEsQ0FBOUIsQ0FBQSxDQUFBO1dBY0EsS0FoQmM7RUFBQSxDQWhEZixDQUFBOztvQkFBQTs7R0FGd0IsYUFQekIsQ0FBQTs7QUFBQSxNQTJFTSxDQUFDLE9BQVAsR0FBaUIsVUEzRWpCLENBQUE7Ozs7O0FDU0EsSUFBQSxZQUFBOztBQUFBOzRCQUdJOztBQUFBLEVBQUEsWUFBQyxDQUFBLEtBQUQsR0FBZSxPQUFmLENBQUE7O0FBQUEsRUFDQSxZQUFDLENBQUEsSUFBRCxHQUFlLE1BRGYsQ0FBQTs7QUFBQSxFQUVBLFlBQUMsQ0FBQSxNQUFELEdBQWUsUUFGZixDQUFBOztBQUFBLEVBR0EsWUFBQyxDQUFBLEtBQUQsR0FBZSxPQUhmLENBQUE7O0FBQUEsRUFJQSxZQUFDLENBQUEsV0FBRCxHQUFlLGFBSmYsQ0FBQTs7QUFBQSxFQU1BLFlBQUMsQ0FBQSxLQUFELEdBQVMsU0FBQSxHQUFBO0FBRUwsSUFBQSxZQUFZLENBQUMsZ0JBQWIsR0FBaUM7QUFBQSxNQUFDLElBQUEsRUFBTSxPQUFQO0FBQUEsTUFBZ0IsV0FBQSxFQUFhLENBQUMsWUFBWSxDQUFDLEtBQWQsQ0FBN0I7S0FBakMsQ0FBQTtBQUFBLElBQ0EsWUFBWSxDQUFDLGlCQUFiLEdBQWlDO0FBQUEsTUFBQyxJQUFBLEVBQU0sUUFBUDtBQUFBLE1BQWlCLFdBQUEsRUFBYSxDQUFDLFlBQVksQ0FBQyxNQUFkLENBQTlCO0tBRGpDLENBQUE7QUFBQSxJQUVBLFlBQVksQ0FBQyxnQkFBYixHQUFpQztBQUFBLE1BQUMsSUFBQSxFQUFNLE9BQVA7QUFBQSxNQUFnQixXQUFBLEVBQWEsQ0FBQyxZQUFZLENBQUMsSUFBZCxFQUFvQixZQUFZLENBQUMsS0FBakMsRUFBd0MsWUFBWSxDQUFDLFdBQXJELENBQTdCO0tBRmpDLENBQUE7QUFBQSxJQUlBLFlBQVksQ0FBQyxXQUFiLEdBQTJCLENBQ3ZCLFlBQVksQ0FBQyxnQkFEVSxFQUV2QixZQUFZLENBQUMsaUJBRlUsRUFHdkIsWUFBWSxDQUFDLGdCQUhVLENBSjNCLENBRks7RUFBQSxDQU5ULENBQUE7O0FBQUEsRUFtQkEsWUFBQyxDQUFBLGNBQUQsR0FBa0IsU0FBQSxHQUFBO0FBRWQsV0FBTyxNQUFNLENBQUMsZ0JBQVAsQ0FBd0IsUUFBUSxDQUFDLElBQWpDLEVBQXVDLE9BQXZDLENBQStDLENBQUMsZ0JBQWhELENBQWlFLFNBQWpFLENBQVAsQ0FGYztFQUFBLENBbkJsQixDQUFBOztBQUFBLEVBdUJBLFlBQUMsQ0FBQSxhQUFELEdBQWlCLFNBQUEsR0FBQTtBQUViLFFBQUEsa0JBQUE7QUFBQSxJQUFBLEtBQUEsR0FBUSxZQUFZLENBQUMsY0FBYixDQUFBLENBQVIsQ0FBQTtBQUVBLFNBQVMsa0hBQVQsR0FBQTtBQUNJLE1BQUEsSUFBRyxZQUFZLENBQUMsV0FBWSxDQUFBLENBQUEsQ0FBRSxDQUFDLFdBQVcsQ0FBQyxPQUF4QyxDQUFnRCxLQUFoRCxDQUFBLEdBQXlELENBQUEsQ0FBNUQ7QUFDSSxlQUFPLFlBQVksQ0FBQyxXQUFZLENBQUEsQ0FBQSxDQUFFLENBQUMsSUFBbkMsQ0FESjtPQURKO0FBQUEsS0FGQTtBQU1BLFdBQU8sRUFBUCxDQVJhO0VBQUEsQ0F2QmpCLENBQUE7O0FBQUEsRUFpQ0EsWUFBQyxDQUFBLFlBQUQsR0FBZ0IsU0FBQyxVQUFELEdBQUE7QUFFWixRQUFBLFdBQUE7QUFBQSxTQUFTLGdIQUFULEdBQUE7QUFFSSxNQUFBLElBQUcsVUFBVSxDQUFDLFdBQVksQ0FBQSxDQUFBLENBQXZCLEtBQTZCLFlBQVksQ0FBQyxjQUFiLENBQUEsQ0FBaEM7QUFDSSxlQUFPLElBQVAsQ0FESjtPQUZKO0FBQUEsS0FBQTtBQUtBLFdBQU8sS0FBUCxDQVBZO0VBQUEsQ0FqQ2hCLENBQUE7O3NCQUFBOztJQUhKLENBQUE7O0FBQUEsTUE2Q00sQ0FBQyxPQUFQLEdBQWlCLFlBN0NqQixDQUFBOzs7OztBQ1RBLElBQUEsV0FBQTs7QUFBQTsyQkFFSTs7QUFBQSxFQUFBLFdBQUMsQ0FBQSxRQUFELEdBQVcsSUFBSSxDQUFDLEdBQWhCLENBQUE7O0FBQUEsRUFDQSxXQUFDLENBQUEsUUFBRCxHQUFXLElBQUksQ0FBQyxHQURoQixDQUFBOztBQUFBLEVBRUEsV0FBQyxDQUFBLFdBQUQsR0FBYyxJQUFJLENBQUMsTUFGbkIsQ0FBQTs7QUFBQSxFQUdBLFdBQUMsQ0FBQSxRQUFELEdBQVcsSUFBSSxDQUFDLEdBSGhCLENBQUE7O0FBQUEsRUFJQSxXQUFDLENBQUEsVUFBRCxHQUFhLElBQUksQ0FBQyxLQUpsQixDQUFBOztBQUFBLEVBTUEsV0FBQyxDQUFBLEtBQUQsR0FBTyxTQUFDLE1BQUQsRUFBUyxHQUFULEVBQWMsR0FBZCxHQUFBO0FBQ0gsV0FBTyxJQUFJLENBQUMsR0FBTCxDQUFVLElBQUksQ0FBQyxHQUFMLENBQVMsR0FBVCxFQUFhLE1BQWIsQ0FBVixFQUFnQyxHQUFoQyxDQUFQLENBREc7RUFBQSxDQU5QLENBQUE7O0FBQUEsRUFTQSxXQUFDLENBQUEsY0FBRCxHQUFpQixTQUFBLEdBQUE7QUFFYixRQUFBLHFCQUFBO0FBQUEsSUFBQSxPQUFBLEdBQVUsa0JBQWtCLENBQUMsS0FBbkIsQ0FBeUIsRUFBekIsQ0FBVixDQUFBO0FBQUEsSUFDQSxLQUFBLEdBQVEsR0FEUixDQUFBO0FBRUEsU0FBUyw0QkFBVCxHQUFBO0FBQ0ksTUFBQSxLQUFBLElBQVMsT0FBUSxDQUFBLElBQUksQ0FBQyxLQUFMLENBQVcsSUFBSSxDQUFDLE1BQUwsQ0FBQSxDQUFBLEdBQWdCLEVBQTNCLENBQUEsQ0FBakIsQ0FESjtBQUFBLEtBRkE7V0FJQSxNQU5hO0VBQUEsQ0FUakIsQ0FBQTs7QUFBQSxFQWlCQSxXQUFDLENBQUEsZ0JBQUQsR0FBb0IsU0FBQyxLQUFELEVBQVEsS0FBUixHQUFBO0FBR2hCLFFBQUEsZ0RBQUE7QUFBQSxJQUFBLE9BQUEsR0FBVSxJQUFBLEdBQUssRUFBTCxHQUFRLEVBQVIsR0FBVyxFQUFyQixDQUFBO0FBQUEsSUFDQSxJQUFBLEdBQVUsRUFEVixDQUFBO0FBQUEsSUFJQSxRQUFBLEdBQVcsS0FBSyxDQUFDLE9BQU4sQ0FBQSxDQUpYLENBQUE7QUFBQSxJQUtBLFFBQUEsR0FBVyxLQUFLLENBQUMsT0FBTixDQUFBLENBTFgsQ0FBQTtBQUFBLElBUUEsYUFBQSxHQUFnQixRQUFBLEdBQVcsUUFSM0IsQ0FBQTtBQUFBLElBV0EsYUFBQSxHQUFnQixhQUFBLEdBQWMsSUFYOUIsQ0FBQTtBQUFBLElBWUEsSUFBSSxDQUFDLE9BQUwsR0FBZ0IsSUFBSSxDQUFDLEtBQUwsQ0FBVyxhQUFBLEdBQWdCLEVBQTNCLENBWmhCLENBQUE7QUFBQSxJQWNBLGFBQUEsR0FBZ0IsYUFBQSxHQUFjLEVBZDlCLENBQUE7QUFBQSxJQWVBLElBQUksQ0FBQyxPQUFMLEdBQWdCLElBQUksQ0FBQyxLQUFMLENBQVcsYUFBQSxHQUFnQixFQUEzQixDQWZoQixDQUFBO0FBQUEsSUFpQkEsYUFBQSxHQUFnQixhQUFBLEdBQWMsRUFqQjlCLENBQUE7QUFBQSxJQWtCQSxJQUFJLENBQUMsS0FBTCxHQUFnQixJQUFJLENBQUMsS0FBTCxDQUFXLGFBQUEsR0FBZ0IsRUFBM0IsQ0FsQmhCLENBQUE7QUFBQSxJQW9CQSxJQUFJLENBQUMsSUFBTCxHQUFnQixJQUFJLENBQUMsS0FBTCxDQUFXLGFBQUEsR0FBYyxFQUF6QixDQXBCaEIsQ0FBQTtXQXNCQSxLQXpCZ0I7RUFBQSxDQWpCcEIsQ0FBQTs7QUFBQSxFQTRDQSxXQUFDLENBQUEsR0FBRCxHQUFNLFNBQUUsR0FBRixFQUFPLElBQVAsRUFBYSxJQUFiLEVBQW1CLElBQW5CLEVBQXlCLElBQXpCLEVBQStCLEtBQS9CLEVBQThDLFlBQTlDLEVBQW1FLFlBQW5FLEdBQUE7QUFDRixRQUFBLFVBQUE7O01BRGlDLFFBQVE7S0FDekM7O01BRGdELGVBQWU7S0FDL0Q7O01BRHFFLGVBQWU7S0FDcEY7QUFBQSxJQUFBLElBQUcsWUFBQSxJQUFpQixHQUFBLEdBQU0sSUFBMUI7QUFBb0MsYUFBTyxJQUFQLENBQXBDO0tBQUE7QUFDQSxJQUFBLElBQUcsWUFBQSxJQUFpQixHQUFBLEdBQU0sSUFBMUI7QUFBb0MsYUFBTyxJQUFQLENBQXBDO0tBREE7QUFBQSxJQUdBLElBQUEsR0FBTyxDQUFDLEdBQUEsR0FBTSxJQUFQLENBQUEsR0FBZSxDQUFDLElBQUEsR0FBTyxJQUFSLENBSHRCLENBQUE7QUFBQSxJQUlBLElBQUEsR0FBTyxDQUFDLElBQUEsR0FBTyxDQUFDLElBQUEsR0FBTyxJQUFSLENBQVIsQ0FBQSxHQUF5QixJQUpoQyxDQUFBO0FBS0EsSUFBQSxJQUFHLEtBQUg7QUFBYyxhQUFPLElBQUksQ0FBQyxLQUFMLENBQVcsSUFBWCxDQUFQLENBQWQ7S0FMQTtBQU9BLFdBQU8sSUFBUCxDQVJFO0VBQUEsQ0E1Q04sQ0FBQTs7QUFBQSxFQXNEQSxXQUFDLENBQUEsU0FBRCxHQUFZLFNBQUUsTUFBRixHQUFBO0FBQ1IsV0FBTyxNQUFBLEdBQVMsQ0FBRSxJQUFJLENBQUMsRUFBTCxHQUFVLEdBQVosQ0FBaEIsQ0FEUTtFQUFBLENBdERaLENBQUE7O0FBQUEsRUF5REEsV0FBQyxDQUFBLFFBQUQsR0FBVyxTQUFFLE9BQUYsR0FBQTtBQUNQLFdBQU8sT0FBQSxHQUFVLENBQUUsR0FBQSxHQUFNLElBQUksQ0FBQyxFQUFiLENBQWpCLENBRE87RUFBQSxDQXpEWCxDQUFBOztBQUFBLEVBNERBLFdBQUMsQ0FBQSxTQUFELEdBQVksU0FBRSxHQUFGLEVBQU8sR0FBUCxFQUFZLEdBQVosRUFBaUIsVUFBakIsR0FBQTtBQUNSLElBQUEsSUFBRyxVQUFIO0FBQW1CLGFBQU8sR0FBQSxJQUFPLEdBQVAsSUFBYyxHQUFBLElBQU8sR0FBNUIsQ0FBbkI7S0FBQSxNQUFBO0FBQ0ssYUFBTyxHQUFBLElBQU8sR0FBUCxJQUFjLEdBQUEsSUFBTyxHQUE1QixDQURMO0tBRFE7RUFBQSxDQTVEWixDQUFBOztBQUFBLEVBaUVBLFdBQUMsQ0FBQSxlQUFELEdBQWtCLFNBQUMsTUFBRCxHQUFBO0FBRWQsUUFBQSxFQUFBO0FBQUEsSUFBQSxJQUFHLE1BQUEsR0FBUyxJQUFaO0FBRUksYUFBTyxFQUFBLEdBQUUsQ0FBQyxJQUFJLENBQUMsS0FBTCxDQUFXLE1BQVgsQ0FBRCxDQUFGLEdBQXNCLEdBQTdCLENBRko7S0FBQSxNQUFBO0FBTUksTUFBQSxFQUFBLEdBQUssQ0FBQyxNQUFBLEdBQU8sSUFBUixDQUFhLENBQUMsT0FBZCxDQUFzQixDQUF0QixDQUFMLENBQUE7QUFDQSxhQUFPLEVBQUEsR0FBRyxFQUFILEdBQU0sSUFBYixDQVBKO0tBRmM7RUFBQSxDQWpFbEIsQ0FBQTs7QUFBQSxFQTZFQSxXQUFDLENBQUEsUUFBRCxHQUFXLFNBQUUsTUFBRixFQUFVLEtBQVYsR0FBQTtBQUVQLFFBQUEsSUFBQTtBQUFBLElBQUEsS0FBQSxJQUFTLE1BQU0sQ0FBQyxRQUFQLENBQUEsQ0FBaUIsQ0FBQyxNQUEzQixDQUFBO0FBRUEsSUFBQSxJQUFHLEtBQUEsR0FBUSxDQUFYO0FBQ0ksYUFBVyxJQUFBLEtBQUEsQ0FBTyxLQUFBLEdBQVEsNkNBQXVCO0FBQUEsUUFBQSxDQUFBLEVBQUksQ0FBSjtPQUF2QixDQUFmLENBQThDLENBQUMsSUFBL0MsQ0FBcUQsR0FBckQsQ0FBSixHQUFpRSxNQUF4RSxDQURKO0tBRkE7QUFLQSxXQUFPLE1BQUEsR0FBUyxFQUFoQixDQVBPO0VBQUEsQ0E3RVgsQ0FBQTs7cUJBQUE7O0lBRkosQ0FBQTs7QUFBQSxNQXdGTSxDQUFDLE9BQVAsR0FBaUIsV0F4RmpCLENBQUE7Ozs7O0FDQUE7QUFBQTs7OztHQUFBO0FBQUEsSUFBQSxTQUFBOztBQUFBO3lCQVFJOztBQUFBLEVBQUEsU0FBQyxDQUFBLFFBQUQsR0FBWSxFQUFaLENBQUE7O0FBQUEsRUFFQSxTQUFDLENBQUEsT0FBRCxHQUFVLFNBQUUsSUFBRixHQUFBO0FBQ047QUFBQTs7Ozs7Ozs7T0FBQTtBQUFBLFFBQUEsQ0FBQTtBQUFBLElBVUEsQ0FBQSxHQUFJLENBQUMsQ0FBQyxJQUFGLENBQU87QUFBQSxNQUVQLEdBQUEsRUFBYyxJQUFJLENBQUMsR0FGWjtBQUFBLE1BR1AsSUFBQSxFQUFpQixJQUFJLENBQUMsSUFBUixHQUFrQixJQUFJLENBQUMsSUFBdkIsR0FBaUMsTUFIeEM7QUFBQSxNQUlQLElBQUEsRUFBaUIsSUFBSSxDQUFDLElBQVIsR0FBa0IsSUFBSSxDQUFDLElBQXZCLEdBQWlDLElBSnhDO0FBQUEsTUFLUCxRQUFBLEVBQWlCLElBQUksQ0FBQyxRQUFSLEdBQXNCLElBQUksQ0FBQyxRQUEzQixHQUF5QyxNQUxoRDtBQUFBLE1BTVAsV0FBQSxFQUFpQixJQUFJLENBQUMsV0FBUixHQUF5QixJQUFJLENBQUMsV0FBOUIsR0FBK0Msa0RBTnREO0FBQUEsTUFPUCxXQUFBLEVBQWlCLElBQUksQ0FBQyxXQUFMLEtBQW9CLElBQXBCLElBQTZCLElBQUksQ0FBQyxXQUFMLEtBQW9CLE1BQXBELEdBQW1FLElBQUksQ0FBQyxXQUF4RSxHQUF5RixJQVBoRztLQUFQLENBVkosQ0FBQTtBQUFBLElBcUJBLENBQUMsQ0FBQyxJQUFGLENBQU8sSUFBSSxDQUFDLElBQVosQ0FyQkEsQ0FBQTtBQUFBLElBc0JBLENBQUMsQ0FBQyxJQUFGLENBQU8sSUFBSSxDQUFDLElBQVosQ0F0QkEsQ0FBQTtXQXdCQSxFQXpCTTtFQUFBLENBRlYsQ0FBQTs7QUFBQSxFQTZCQSxTQUFDLENBQUEsUUFBRCxHQUFZLFNBQUMsSUFBRCxFQUFPLElBQVAsRUFBYSxJQUFiLEdBQUE7QUFDUjtBQUFBOzs7O09BQUE7QUFBQSxJQU1BLFNBQUMsQ0FBQSxPQUFELENBQ0k7QUFBQSxNQUFBLEdBQUEsRUFBUyxjQUFUO0FBQUEsTUFDQSxJQUFBLEVBQVMsTUFEVDtBQUFBLE1BRUEsSUFBQSxFQUFTO0FBQUEsUUFBQyxZQUFBLEVBQWUsU0FBQSxDQUFVLElBQVYsQ0FBaEI7T0FGVDtBQUFBLE1BR0EsSUFBQSxFQUFTLElBSFQ7QUFBQSxNQUlBLElBQUEsRUFBUyxJQUpUO0tBREosQ0FOQSxDQUFBO1dBYUEsS0FkUTtFQUFBLENBN0JaLENBQUE7O0FBQUEsRUE2Q0EsU0FBQyxDQUFBLFdBQUQsR0FBZSxTQUFDLEVBQUQsRUFBSyxJQUFMLEVBQVcsSUFBWCxHQUFBO0FBRVgsSUFBQSxTQUFDLENBQUEsT0FBRCxDQUNJO0FBQUEsTUFBQSxHQUFBLEVBQVMsY0FBQSxHQUFlLEVBQXhCO0FBQUEsTUFDQSxJQUFBLEVBQVMsUUFEVDtBQUFBLE1BRUEsSUFBQSxFQUFTLElBRlQ7QUFBQSxNQUdBLElBQUEsRUFBUyxJQUhUO0tBREosQ0FBQSxDQUFBO1dBTUEsS0FSVztFQUFBLENBN0NmLENBQUE7O21CQUFBOztJQVJKLENBQUE7O0FBQUEsTUErRE0sQ0FBQyxPQUFQLEdBQWlCLFNBL0RqQixDQUFBOzs7OztBQ0FBO0FBQUE7OztHQUFBO0FBQUEsSUFBQSxLQUFBO0VBQUEsa0ZBQUE7O0FBQUE7QUFNSSxrQkFBQSxHQUFBLEdBQU0sSUFBTixDQUFBOztBQUVjLEVBQUEsZUFBQSxHQUFBO0FBRVYseUNBQUEsQ0FBQTtBQUFBLHlDQUFBLENBQUE7QUFBQSwyQ0FBQSxDQUFBO0FBQUEsNkNBQUEsQ0FBQTtBQUFBLCtDQUFBLENBQUE7QUFBQSwyQ0FBQSxDQUFBO0FBQUEsaURBQUEsQ0FBQTtBQUFBLHVDQUFBLENBQUE7QUFBQSw2Q0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsR0FBRCxHQUFPLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLFFBQWhCLENBQUE7QUFFQSxXQUFPLElBQVAsQ0FKVTtFQUFBLENBRmQ7O0FBQUEsa0JBUUEsT0FBQSxHQUFVLFNBQUMsR0FBRCxFQUFNLENBQU4sRUFBUyxDQUFULEdBQUE7QUFFTixRQUFBLFNBQUE7QUFBQSxJQUFBLElBQUEsR0FBTyxDQUFFLE1BQU0sQ0FBQyxVQUFQLEdBQXFCLENBQXZCLENBQUEsSUFBOEIsQ0FBckMsQ0FBQTtBQUFBLElBQ0EsR0FBQSxHQUFPLENBQUUsTUFBTSxDQUFDLFdBQVAsR0FBcUIsQ0FBdkIsQ0FBQSxJQUE4QixDQURyQyxDQUFBO0FBQUEsSUFHQSxNQUFNLENBQUMsSUFBUCxDQUFZLEdBQVosRUFBaUIsRUFBakIsRUFBcUIsTUFBQSxHQUFPLEdBQVAsR0FBVyxRQUFYLEdBQW9CLElBQXBCLEdBQXlCLFNBQXpCLEdBQW1DLENBQW5DLEdBQXFDLFVBQXJDLEdBQWdELENBQWhELEdBQWtELHlCQUF2RSxDQUhBLENBQUE7V0FLQSxLQVBNO0VBQUEsQ0FSVixDQUFBOztBQUFBLGtCQWlCQSxJQUFBLEdBQU8sU0FBRSxHQUFGLEdBQUE7QUFFSCxJQUFBLEdBQUEsR0FBTSxrQkFBQSxDQUFtQixHQUFBLElBQU8sSUFBQyxDQUFBLEdBQTNCLENBQU4sQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE9BQUQsQ0FBVSxvQ0FBQSxHQUFvQyxHQUE5QyxFQUFxRCxHQUFyRCxFQUEwRCxHQUExRCxDQUZBLENBQUE7V0FJQSxLQU5HO0VBQUEsQ0FqQlAsQ0FBQTs7QUFBQSxrQkF5QkEsU0FBQSxHQUFZLFNBQUMsR0FBRCxFQUFNLEtBQU4sRUFBYSxLQUFiLEdBQUE7QUFFUixJQUFBLEdBQUEsR0FBUSxrQkFBQSxDQUFtQixHQUFBLElBQU8sSUFBQyxDQUFBLEdBQTNCLENBQVIsQ0FBQTtBQUFBLElBQ0EsS0FBQSxHQUFRLGtCQUFBLENBQW1CLEtBQW5CLENBRFIsQ0FBQTtBQUFBLElBRUEsS0FBQSxHQUFRLGtCQUFBLENBQW1CLEtBQW5CLENBRlIsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLE9BQUQsQ0FBVSxrREFBQSxHQUFrRCxHQUFsRCxHQUFzRCxTQUF0RCxHQUErRCxLQUEvRCxHQUFxRSxlQUFyRSxHQUFvRixLQUE5RixFQUF1RyxHQUF2RyxFQUE0RyxHQUE1RyxDQUpBLENBQUE7V0FNQSxLQVJRO0VBQUEsQ0F6QlosQ0FBQTs7QUFBQSxrQkFtQ0EsTUFBQSxHQUFTLFNBQUMsR0FBRCxFQUFNLEtBQU4sRUFBYSxLQUFiLEdBQUE7QUFFTCxJQUFBLEdBQUEsR0FBUSxrQkFBQSxDQUFtQixHQUFBLElBQU8sSUFBQyxDQUFBLEdBQTNCLENBQVIsQ0FBQTtBQUFBLElBQ0EsS0FBQSxHQUFRLGtCQUFBLENBQW1CLEtBQW5CLENBRFIsQ0FBQTtBQUFBLElBRUEsS0FBQSxHQUFRLGtCQUFBLENBQW1CLEtBQW5CLENBRlIsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLE9BQUQsQ0FBVSwyQ0FBQSxHQUEyQyxLQUEzQyxHQUFpRCxXQUFqRCxHQUE0RCxLQUE1RCxHQUFrRSxjQUFsRSxHQUFnRixHQUExRixFQUFpRyxHQUFqRyxFQUFzRyxHQUF0RyxDQUpBLENBQUE7V0FNQSxLQVJLO0VBQUEsQ0FuQ1QsQ0FBQTs7QUFBQSxrQkE2Q0EsUUFBQSxHQUFXLFNBQUUsR0FBRixFQUFRLElBQVIsR0FBQTtBQUVQLFFBQUEsS0FBQTs7TUFGZSxPQUFPO0tBRXRCO0FBQUEsSUFBQSxHQUFBLEdBQVEsa0JBQUEsQ0FBbUIsR0FBQSxJQUFPLElBQUMsQ0FBQSxHQUEzQixDQUFSLENBQUE7QUFBQSxJQUNBLEtBQUEsR0FBUSxrQkFBQSxDQUFtQixJQUFuQixDQURSLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxPQUFELENBQVUsc0NBQUEsR0FBc0MsR0FBdEMsR0FBMEMsS0FBMUMsR0FBK0MsS0FBekQsRUFBa0UsR0FBbEUsRUFBdUUsR0FBdkUsQ0FIQSxDQUFBO1dBS0EsS0FQTztFQUFBLENBN0NYLENBQUE7O0FBQUEsa0JBc0RBLE9BQUEsR0FBVSxTQUFFLEdBQUYsRUFBUSxJQUFSLEdBQUE7QUFFTixRQUFBLEtBQUE7O01BRmMsT0FBTztLQUVyQjtBQUFBLElBQUEsR0FBQSxHQUFRLGtCQUFBLENBQW1CLEdBQUEsSUFBTyxJQUFDLENBQUEsR0FBM0IsQ0FBUixDQUFBO0FBQ0EsSUFBQSxJQUFHLElBQUEsS0FBUSxFQUFYO0FBQ0ksTUFBQSxJQUFBLEdBQU8sSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsTUFBTSxDQUFDLEdBQWhCLENBQW9CLDhCQUFwQixDQUFQLENBREo7S0FEQTtBQUFBLElBSUEsS0FBQSxHQUFRLGtCQUFBLENBQW1CLElBQW5CLENBSlIsQ0FBQTtBQUFBLElBTUEsSUFBQyxDQUFBLE9BQUQsQ0FBVSx3Q0FBQSxHQUF3QyxLQUF4QyxHQUE4QyxPQUE5QyxHQUFxRCxHQUEvRCxFQUFzRSxHQUF0RSxFQUEyRSxHQUEzRSxDQU5BLENBQUE7V0FRQSxLQVZNO0VBQUEsQ0F0RFYsQ0FBQTs7QUFBQSxrQkFrRUEsTUFBQSxHQUFTLFNBQUUsR0FBRixHQUFBO0FBRUwsSUFBQSxHQUFBLEdBQU0sa0JBQUEsQ0FBbUIsR0FBQSxJQUFPLElBQUMsQ0FBQSxHQUEzQixDQUFOLENBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxPQUFELENBQVMsb0RBQUEsR0FBdUQsR0FBaEUsRUFBcUUsR0FBckUsRUFBMEUsR0FBMUUsQ0FGQSxDQUFBO1dBSUEsS0FOSztFQUFBLENBbEVULENBQUE7O0FBQUEsa0JBMEVBLEtBQUEsR0FBUSxTQUFFLEdBQUYsR0FBQTtBQUVKLElBQUEsR0FBQSxHQUFNLGtCQUFBLENBQW1CLEdBQUEsSUFBTyxJQUFDLENBQUEsR0FBM0IsQ0FBTixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsT0FBRCxDQUFVLCtDQUFBLEdBQStDLEdBQS9DLEdBQW1ELGlCQUE3RCxFQUErRSxHQUEvRSxFQUFvRixHQUFwRixDQUZBLENBQUE7V0FJQSxLQU5JO0VBQUEsQ0ExRVIsQ0FBQTs7QUFBQSxrQkFrRkEsS0FBQSxHQUFRLFNBQUEsR0FBQTtBQUVKLFdBQU8sTUFBTSxDQUFDLEtBQWQsQ0FGSTtFQUFBLENBbEZSLENBQUE7O2VBQUE7O0lBTkosQ0FBQTs7QUFBQSxNQTRGTSxDQUFDLE9BQVAsR0FBaUIsS0E1RmpCLENBQUE7Ozs7O0FDQUEsSUFBQSxZQUFBO0VBQUE7O2lTQUFBOztBQUFBO0FBRUMsaUNBQUEsQ0FBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBQUE7O0FBQUEseUJBQUEsRUFBQSxHQUFlLElBQWYsQ0FBQTs7QUFBQSx5QkFDQSxFQUFBLEdBQWUsSUFEZixDQUFBOztBQUFBLHlCQUVBLFFBQUEsR0FBZSxJQUZmLENBQUE7O0FBQUEseUJBR0EsUUFBQSxHQUFlLElBSGYsQ0FBQTs7QUFBQSx5QkFJQSxZQUFBLEdBQWUsSUFKZixDQUFBOztBQUFBLHlCQU1BLFVBQUEsR0FBYSxTQUFBLEdBQUE7QUFFWixRQUFBLE9BQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxRQUFELEdBQVksRUFBWixDQUFBO0FBRUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxRQUFKO0FBQ0MsTUFBQSxPQUFBLEdBQVUsQ0FBQyxDQUFDLFFBQUYsQ0FBVyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxTQUFTLENBQUMsR0FBbkIsQ0FBdUIsSUFBQyxDQUFBLFFBQXhCLENBQVgsQ0FBVixDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsVUFBRCxDQUFZLE9BQUEsQ0FBUSxJQUFDLENBQUEsWUFBVCxDQUFaLENBREEsQ0FERDtLQUZBO0FBTUEsSUFBQSxJQUF1QixJQUFDLENBQUEsRUFBeEI7QUFBQSxNQUFBLElBQUMsQ0FBQSxHQUFHLENBQUMsSUFBTCxDQUFVLElBQVYsRUFBZ0IsSUFBQyxDQUFBLEVBQWpCLENBQUEsQ0FBQTtLQU5BO0FBT0EsSUFBQSxJQUE0QixJQUFDLENBQUEsU0FBN0I7QUFBQSxNQUFBLElBQUMsQ0FBQSxHQUFHLENBQUMsUUFBTCxDQUFjLElBQUMsQ0FBQSxTQUFmLENBQUEsQ0FBQTtLQVBBO0FBQUEsSUFTQSxJQUFDLENBQUEsSUFBRCxDQUFBLENBVEEsQ0FBQTtBQUFBLElBV0EsSUFBQyxDQUFBLE1BQUQsR0FBVSxLQVhWLENBQUE7V0FhQSxLQWZZO0VBQUEsQ0FOYixDQUFBOztBQUFBLHlCQXVCQSxJQUFBLEdBQU8sU0FBQSxHQUFBO1dBRU4sS0FGTTtFQUFBLENBdkJQLENBQUE7O0FBQUEseUJBMkJBLE1BQUEsR0FBUyxTQUFBLEdBQUE7V0FFUixLQUZRO0VBQUEsQ0EzQlQsQ0FBQTs7QUFBQSx5QkErQkEsTUFBQSxHQUFTLFNBQUEsR0FBQTtXQUVSLEtBRlE7RUFBQSxDQS9CVCxDQUFBOztBQUFBLHlCQW1DQSxRQUFBLEdBQVcsU0FBQyxLQUFELEVBQVEsT0FBUixHQUFBO0FBRVYsUUFBQSxTQUFBOztNQUZrQixVQUFVO0tBRTVCO0FBQUEsSUFBQSxJQUF3QixLQUFLLENBQUMsRUFBOUI7QUFBQSxNQUFBLElBQUMsQ0FBQSxRQUFRLENBQUMsSUFBVixDQUFlLEtBQWYsQ0FBQSxDQUFBO0tBQUE7QUFBQSxJQUNBLE1BQUEsR0FBWSxJQUFDLENBQUEsYUFBSixHQUF1QixJQUFDLENBQUEsR0FBRyxDQUFDLElBQUwsQ0FBVSxJQUFDLENBQUEsYUFBWCxDQUF5QixDQUFDLEVBQTFCLENBQTZCLENBQTdCLENBQXZCLEdBQTRELElBQUMsQ0FBQSxHQUR0RSxDQUFBO0FBQUEsSUFHQSxDQUFBLEdBQU8sS0FBSyxDQUFDLEVBQVQsR0FBaUIsS0FBSyxDQUFDLEdBQXZCLEdBQWdDLEtBSHBDLENBQUE7QUFLQSxJQUFBLElBQUcsQ0FBQSxPQUFIO0FBQ0MsTUFBQSxNQUFNLENBQUMsTUFBUCxDQUFjLENBQWQsQ0FBQSxDQUREO0tBQUEsTUFBQTtBQUdDLE1BQUEsTUFBTSxDQUFDLE9BQVAsQ0FBZSxDQUFmLENBQUEsQ0FIRDtLQUxBO1dBVUEsS0FaVTtFQUFBLENBbkNYLENBQUE7O0FBQUEseUJBaURBLE9BQUEsR0FBVSxTQUFDLEdBQUQsRUFBTSxLQUFOLEdBQUE7QUFFVCxRQUFBLENBQUE7QUFBQSxJQUFBLElBQXdCLEtBQUssQ0FBQyxFQUE5QjtBQUFBLE1BQUEsSUFBQyxDQUFBLFFBQVEsQ0FBQyxJQUFWLENBQWUsS0FBZixDQUFBLENBQUE7S0FBQTtBQUFBLElBQ0EsQ0FBQSxHQUFPLEtBQUssQ0FBQyxFQUFULEdBQWlCLEtBQUssQ0FBQyxHQUF2QixHQUFnQyxLQURwQyxDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsR0FBRyxDQUFDLFFBQUwsQ0FBYyxHQUFkLENBQWtCLENBQUMsV0FBbkIsQ0FBK0IsQ0FBL0IsQ0FGQSxDQUFBO1dBSUEsS0FOUztFQUFBLENBakRWLENBQUE7O0FBQUEseUJBeURBLE1BQUEsR0FBUyxTQUFDLEtBQUQsR0FBQTtBQUVSLFFBQUEsQ0FBQTtBQUFBLElBQUEsSUFBTyxhQUFQO0FBQ0MsWUFBQSxDQUREO0tBQUE7QUFBQSxJQUdBLENBQUEsR0FBTyxLQUFLLENBQUMsRUFBVCxHQUFpQixLQUFLLENBQUMsR0FBdkIsR0FBZ0MsQ0FBQSxDQUFFLEtBQUYsQ0FIcEMsQ0FBQTtBQUlBLElBQUEsSUFBbUIsQ0FBQSxJQUFNLEtBQUssQ0FBQyxPQUEvQjtBQUFBLE1BQUEsS0FBSyxDQUFDLE9BQU4sQ0FBQSxDQUFBLENBQUE7S0FKQTtBQU1BLElBQUEsSUFBRyxDQUFBLElBQUssSUFBQyxDQUFBLFFBQVEsQ0FBQyxPQUFWLENBQWtCLEtBQWxCLENBQUEsS0FBNEIsQ0FBQSxDQUFwQztBQUNDLE1BQUEsSUFBQyxDQUFBLFFBQVEsQ0FBQyxNQUFWLENBQWtCLElBQUMsQ0FBQSxRQUFRLENBQUMsT0FBVixDQUFrQixLQUFsQixDQUFsQixFQUE0QyxDQUE1QyxDQUFBLENBREQ7S0FOQTtBQUFBLElBU0EsQ0FBQyxDQUFDLE1BQUYsQ0FBQSxDQVRBLENBQUE7V0FXQSxLQWJRO0VBQUEsQ0F6RFQsQ0FBQTs7QUFBQSx5QkF3RUEsUUFBQSxHQUFXLFNBQUMsS0FBRCxHQUFBO0FBRVYsUUFBQSxxQkFBQTtBQUFBO0FBQUEsU0FBQSwyQ0FBQTt1QkFBQTtBQUFDLE1BQUEsSUFBRyxLQUFLLENBQUMsUUFBVDtBQUF1QixRQUFBLEtBQUssQ0FBQyxRQUFOLENBQUEsQ0FBQSxDQUF2QjtPQUFEO0FBQUEsS0FBQTtXQUVBLEtBSlU7RUFBQSxDQXhFWCxDQUFBOztBQUFBLHlCQThFQSxZQUFBLEdBQWUsU0FBRSxPQUFGLEdBQUE7QUFFZCxJQUFBLElBQUMsQ0FBQSxHQUFHLENBQUMsR0FBTCxDQUNDO0FBQUEsTUFBQSxnQkFBQSxFQUFxQixPQUFILEdBQWdCLE1BQWhCLEdBQTRCLE1BQTlDO0tBREQsQ0FBQSxDQUFBO1dBR0EsS0FMYztFQUFBLENBOUVmLENBQUE7O0FBQUEseUJBcUZBLFlBQUEsR0FBZSxTQUFDLENBQUQsRUFBSSxDQUFKLEVBQU8sS0FBUCxFQUFrQixLQUFsQixHQUFBO0FBRWQsUUFBQSxHQUFBOztNQUZxQixRQUFNO0tBRTNCO0FBQUEsSUFBQSxJQUFHLFNBQVMsQ0FBQyxlQUFiO0FBQ0MsTUFBQSxHQUFBLEdBQU8sY0FBQSxHQUFhLENBQUMsQ0FBQSxHQUFFLEtBQUgsQ0FBYixHQUFzQixJQUF0QixHQUF5QixDQUFDLENBQUEsR0FBRSxLQUFILENBQXpCLEdBQWtDLE1BQXpDLENBREQ7S0FBQSxNQUFBO0FBR0MsTUFBQSxHQUFBLEdBQU8sWUFBQSxHQUFXLENBQUMsQ0FBQSxHQUFFLEtBQUgsQ0FBWCxHQUFvQixJQUFwQixHQUF1QixDQUFDLENBQUEsR0FBRSxLQUFILENBQXZCLEdBQWdDLEdBQXZDLENBSEQ7S0FBQTtBQUtBLElBQUEsSUFBRyxLQUFIO0FBQWMsTUFBQSxHQUFBLEdBQU0sRUFBQSxHQUFHLEdBQUgsR0FBTyxTQUFQLEdBQWdCLEtBQWhCLEdBQXNCLEdBQTVCLENBQWQ7S0FMQTtXQU9BLElBVGM7RUFBQSxDQXJGZixDQUFBOztBQUFBLHlCQWdHQSxTQUFBLEdBQVksU0FBQSxHQUFBO0FBRVgsUUFBQSxxQkFBQTtBQUFBO0FBQUEsU0FBQSwyQ0FBQTt1QkFBQTs7UUFFQyxLQUFLLENBQUM7T0FBTjtBQUVBLE1BQUEsSUFBRyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQWxCO0FBRUMsUUFBQSxLQUFLLENBQUMsU0FBTixDQUFBLENBQUEsQ0FGRDtPQUpEO0FBQUEsS0FBQTtXQVFBLEtBVlc7RUFBQSxDQWhHWixDQUFBOztBQUFBLHlCQTRHQSxPQUFBLEdBQVUsU0FBQSxHQUFBO0FBRVQsUUFBQSxxQkFBQTtBQUFBO0FBQUEsU0FBQSwyQ0FBQTt1QkFBQTs7UUFFQyxLQUFLLENBQUM7T0FBTjtBQUVBLE1BQUEsSUFBRyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQWxCO0FBRUMsUUFBQSxLQUFLLENBQUMsT0FBTixDQUFBLENBQUEsQ0FGRDtPQUpEO0FBQUEsS0FBQTtXQVFBLEtBVlM7RUFBQSxDQTVHVixDQUFBOztBQUFBLHlCQXdIQSxpQkFBQSxHQUFtQixTQUFBLEdBQUE7QUFFbEIsUUFBQSxxQkFBQTtBQUFBO0FBQUEsU0FBQSwyQ0FBQTt1QkFBQTtBQUFBLE1BQUEsSUFBQyxDQUFBLE1BQUQsQ0FBUSxLQUFSLENBQUEsQ0FBQTtBQUFBLEtBQUE7V0FFQSxLQUprQjtFQUFBLENBeEhuQixDQUFBOztBQUFBLHlCQThIQSxlQUFBLEdBQWtCLFNBQUMsR0FBRCxFQUFNLFFBQU4sR0FBQTtBQUVqQixRQUFBLGtCQUFBOztNQUZ1QixXQUFTLElBQUMsQ0FBQTtLQUVqQztBQUFBLFNBQUEsdURBQUE7MEJBQUE7QUFFQyxNQUFBLEtBQUssQ0FBQyxPQUFOLENBQWMsR0FBZCxDQUFBLENBQUE7QUFFQSxNQUFBLElBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFsQjtBQUVDLFFBQUEsSUFBQyxDQUFBLGVBQUQsQ0FBaUIsR0FBakIsRUFBc0IsS0FBSyxDQUFDLFFBQTVCLENBQUEsQ0FGRDtPQUpEO0FBQUEsS0FBQTtXQVFBLEtBVmlCO0VBQUEsQ0E5SGxCLENBQUE7O0FBQUEseUJBMElBLFlBQUEsR0FBZSxTQUFDLE1BQUQsRUFBUyxNQUFULEVBQWlCLFFBQWpCLEdBQUE7QUFFZCxRQUFBLGtCQUFBOztNQUYrQixXQUFTLElBQUMsQ0FBQTtLQUV6QztBQUFBLFNBQUEsdURBQUE7MEJBQUE7O1FBRUMsS0FBTSxDQUFBLE1BQUEsRUFBUztPQUFmO0FBRUEsTUFBQSxJQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBbEI7QUFFQyxRQUFBLElBQUMsQ0FBQSxZQUFELENBQWMsTUFBZCxFQUFzQixNQUF0QixFQUE4QixLQUFLLENBQUMsUUFBcEMsQ0FBQSxDQUZEO09BSkQ7QUFBQSxLQUFBO1dBUUEsS0FWYztFQUFBLENBMUlmLENBQUE7O0FBQUEseUJBc0pBLG1CQUFBLEdBQXNCLFNBQUMsTUFBRCxFQUFTLE1BQVQsRUFBaUIsUUFBakIsR0FBQTtBQUVyQixRQUFBLGtCQUFBOztNQUZzQyxXQUFTLElBQUMsQ0FBQTtLQUVoRDs7TUFBQSxJQUFFLENBQUEsTUFBQSxFQUFTO0tBQVg7QUFFQSxTQUFBLHVEQUFBOzBCQUFBOztRQUVDLEtBQU0sQ0FBQSxNQUFBLEVBQVM7T0FBZjtBQUVBLE1BQUEsSUFBRyxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQWxCO0FBRUMsUUFBQSxJQUFDLENBQUEsWUFBRCxDQUFjLE1BQWQsRUFBc0IsTUFBdEIsRUFBOEIsS0FBSyxDQUFDLFFBQXBDLENBQUEsQ0FGRDtPQUpEO0FBQUEsS0FGQTtXQVVBLEtBWnFCO0VBQUEsQ0F0SnRCLENBQUE7O0FBQUEseUJBb0tBLGNBQUEsR0FBaUIsU0FBQyxHQUFELEVBQU0sSUFBTixHQUFBO0FBRWhCLFdBQU8sR0FBRyxDQUFDLE9BQUosQ0FBWSxpQkFBWixFQUErQixTQUFDLENBQUQsRUFBSSxDQUFKLEdBQUE7QUFDckMsVUFBQSxDQUFBO0FBQUEsTUFBQSxDQUFBLEdBQUksSUFBSyxDQUFBLENBQUEsQ0FBVCxDQUFBO0FBQ0MsTUFBQSxJQUFHLE1BQUEsQ0FBQSxDQUFBLEtBQVksUUFBWixJQUF3QixNQUFBLENBQUEsQ0FBQSxLQUFZLFFBQXZDO2VBQXFELEVBQXJEO09BQUEsTUFBQTtlQUE0RCxFQUE1RDtPQUZvQztJQUFBLENBQS9CLENBQVAsQ0FGZ0I7RUFBQSxDQXBLakIsQ0FBQTs7QUFBQSx5QkEwS0EsT0FBQSxHQUFVLFNBQUEsR0FBQTtBQUVUO0FBQUE7O09BQUE7V0FJQSxLQU5TO0VBQUEsQ0ExS1YsQ0FBQTs7QUFBQSx5QkFrTEEsS0FBQSxHQUFRLFNBQUEsR0FBQTtBQUVQLFdBQU8sTUFBTSxDQUFDLEtBQWQsQ0FGTztFQUFBLENBbExSLENBQUE7O3NCQUFBOztHQUYwQixRQUFRLENBQUMsS0FBcEMsQ0FBQTs7QUFBQSxNQXdMTSxDQUFDLE9BQVAsR0FBaUIsWUF4TGpCLENBQUE7Ozs7O0FDQUEsSUFBQSw4QkFBQTtFQUFBOztpU0FBQTs7QUFBQSxZQUFBLEdBQWUsT0FBQSxDQUFRLGdCQUFSLENBQWYsQ0FBQTs7QUFBQTtBQUlDLHFDQUFBLENBQUE7Ozs7Ozs7O0dBQUE7O0FBQUEsNkJBQUEsTUFBQSxHQUFhLEtBQWIsQ0FBQTs7QUFBQSw2QkFDQSxVQUFBLEdBQWEsS0FEYixDQUFBOztBQUFBLDZCQUdBLElBQUEsR0FBTyxTQUFDLEVBQUQsR0FBQTtBQUVOLElBQUEsSUFBQSxDQUFBLENBQWMsSUFBRSxDQUFBLE1BQWhCO0FBQUEsWUFBQSxDQUFBO0tBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxNQUFELEdBQVUsSUFEVixDQUFBO0FBR0E7QUFBQTs7T0FIQTtBQUFBLElBTUEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUF6QixDQUFrQyxJQUFsQyxDQU5BLENBQUE7QUFBQSxJQU9BLElBQUMsQ0FBQSxtQkFBRCxDQUFxQixjQUFyQixFQUFxQyxJQUFyQyxDQVBBLENBQUE7QUFTQTtBQUFBLHVEQVRBO0FBQUEsSUFVQSxJQUFDLENBQUEsR0FBRyxDQUFDLEdBQUwsQ0FBUztBQUFBLE1BQUEsWUFBQSxFQUFlLFNBQWY7S0FBVCxDQVZBLENBQUE7O01BV0E7S0FYQTtXQWFBLEtBZk07RUFBQSxDQUhQLENBQUE7O0FBQUEsNkJBb0JBLElBQUEsR0FBTyxTQUFDLEVBQUQsR0FBQTtBQUVOLElBQUEsSUFBQSxDQUFBLElBQWUsQ0FBQSxNQUFmO0FBQUEsWUFBQSxDQUFBO0tBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxNQUFELEdBQVUsS0FEVixDQUFBO0FBR0E7QUFBQTs7T0FIQTtBQUFBLElBTUEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUF6QixDQUFnQyxJQUFoQyxDQU5BLENBQUE7QUFVQTtBQUFBLHVEQVZBO0FBQUEsSUFXQSxJQUFDLENBQUEsR0FBRyxDQUFDLEdBQUwsQ0FBUztBQUFBLE1BQUEsWUFBQSxFQUFlLFFBQWY7S0FBVCxDQVhBLENBQUE7O01BWUE7S0FaQTtXQWNBLEtBaEJNO0VBQUEsQ0FwQlAsQ0FBQTs7QUFBQSw2QkFzQ0EsT0FBQSxHQUFVLFNBQUEsR0FBQTtBQUVULElBQUEsSUFBQyxDQUFBLG1CQUFELENBQXFCLGNBQXJCLEVBQXFDLEtBQXJDLENBQUEsQ0FBQTtXQUVBLEtBSlM7RUFBQSxDQXRDVixDQUFBOztBQUFBLDZCQTRDQSxZQUFBLEdBQWUsU0FBQyxPQUFELEdBQUE7QUFFZCxJQUFBLElBQWMsT0FBQSxLQUFhLElBQUMsQ0FBQSxVQUE1QjtBQUFBLFlBQUEsQ0FBQTtLQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsVUFBRCxHQUFjLE9BRGQsQ0FBQTtXQUdBLEtBTGM7RUFBQSxDQTVDZixDQUFBOzswQkFBQTs7R0FGOEIsYUFGL0IsQ0FBQTs7QUFBQSxNQXVETSxDQUFDLE9BQVAsR0FBaUIsZ0JBdkRqQixDQUFBOzs7OztBQ0FBLElBQUEsb0JBQUE7RUFBQTtpU0FBQTs7QUFBQSxZQUFBLEdBQWUsT0FBQSxDQUFRLGlCQUFSLENBQWYsQ0FBQTs7QUFBQTtBQUlJLDJCQUFBLENBQUE7O0FBQUEsbUJBQUEsUUFBQSxHQUFXLGFBQVgsQ0FBQTs7QUFFYSxFQUFBLGdCQUFBLEdBQUE7QUFFVCxJQUFBLElBQUMsQ0FBQSxZQUFELEdBQ0M7QUFBQSxNQUFBLElBQUEsRUFBTyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0IsYUFBcEIsQ0FBUDtLQURELENBQUE7QUFBQSxJQUdBLHNDQUFBLENBSEEsQ0FBQTtBQUtBLFdBQU8sSUFBUCxDQVBTO0VBQUEsQ0FGYjs7Z0JBQUE7O0dBRmlCLGFBRnJCLENBQUE7O0FBQUEsTUFlTSxDQUFDLE9BQVAsR0FBaUIsTUFmakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLGtEQUFBO0VBQUE7O2lTQUFBOztBQUFBLFlBQUEsR0FBdUIsT0FBQSxDQUFRLGlCQUFSLENBQXZCLENBQUE7O0FBQUEsTUFDQSxHQUF1QixPQUFBLENBQVEscUJBQVIsQ0FEdkIsQ0FBQTs7QUFBQSxvQkFFQSxHQUF1QixPQUFBLENBQVEsa0NBQVIsQ0FGdkIsQ0FBQTs7QUFBQTtBQU1DLDJCQUFBLENBQUE7O0FBQUEsbUJBQUEsUUFBQSxHQUFXLGFBQVgsQ0FBQTs7QUFBQSxtQkFFQSxnQkFBQSxHQUFtQixJQUZuQixDQUFBOztBQUFBLG1CQUdBLGdCQUFBLEdBQW1CLEtBSG5CLENBQUE7O0FBQUEsbUJBS0Esc0JBQUEsR0FBMkIsd0JBTDNCLENBQUE7O0FBQUEsbUJBTUEsdUJBQUEsR0FBMkIseUJBTjNCLENBQUE7O0FBQUEsbUJBT0Esd0JBQUEsR0FBMkIsMEJBUDNCLENBQUE7O0FBU2MsRUFBQSxnQkFBQSxHQUFBO0FBRWIsMkRBQUEsQ0FBQTtBQUFBLDJEQUFBLENBQUE7QUFBQSw2Q0FBQSxDQUFBO0FBQUEsNkRBQUEsQ0FBQTtBQUFBLDJEQUFBLENBQUE7QUFBQSxxREFBQSxDQUFBO0FBQUEscURBQUEsQ0FBQTtBQUFBLHlEQUFBLENBQUE7QUFBQSwyRUFBQSxDQUFBO0FBQUEsK0RBQUEsQ0FBQTtBQUFBLHVEQUFBLENBQUE7QUFBQSx1REFBQSxDQUFBO0FBQUEsbURBQUEsQ0FBQTtBQUFBLHVDQUFBLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxZQUFELEdBQ0M7QUFBQSxNQUFBLFVBQUEsRUFBYyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0IsbUJBQXBCLENBQWQ7QUFBQSxNQUNBLFdBQUEsRUFBYyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0Isb0JBQXBCLENBRGQ7QUFBQSxNQUVBLFVBQUEsRUFBYyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0IsbUJBQXBCLENBRmQ7S0FERCxDQUFBO0FBQUEsSUFLQSxzQ0FBQSxDQUxBLENBQUE7QUFBQSxJQU9BLElBQUMsQ0FBQSxVQUFELENBQUEsQ0FQQSxDQUFBO0FBU0EsV0FBTyxJQUFQLENBWGE7RUFBQSxDQVRkOztBQUFBLG1CQXNCQSxJQUFBLEdBQU8sU0FBQSxHQUFBO0FBRU4sSUFBQSxJQUFDLENBQUEsS0FBRCxHQUFhLElBQUMsQ0FBQSxHQUFHLENBQUMsSUFBTCxDQUFVLGFBQVYsQ0FBYixDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsUUFBRCxHQUFhLElBQUMsQ0FBQSxHQUFHLENBQUMsSUFBTCxDQUFVLFdBQVYsQ0FEYixDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsU0FBRCxHQUFhLElBQUMsQ0FBQSxHQUFHLENBQUMsSUFBTCxDQUFVLFlBQVYsQ0FGYixDQUFBO1dBSUEsS0FOTTtFQUFBLENBdEJQLENBQUE7O0FBQUEsbUJBOEJBLFVBQUEsR0FBYSxTQUFBLEdBQUE7QUFFWixJQUFBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxFQUFqQixDQUFvQixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsb0JBQXJDLEVBQTJELElBQUMsQ0FBQSxhQUE1RCxDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE1BQU0sQ0FBQyxFQUFoQixDQUFtQixNQUFNLENBQUMsa0JBQTFCLEVBQThDLElBQUMsQ0FBQSxZQUEvQyxDQURBLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxHQUFHLENBQUMsRUFBTCxDQUFRLFlBQVIsRUFBc0IsaUJBQXRCLEVBQXlDLElBQUMsQ0FBQSxXQUExQyxDQUhBLENBQUE7QUFBQSxJQUlBLElBQUMsQ0FBQSxHQUFHLENBQUMsRUFBTCxDQUFRLFlBQVIsRUFBc0IsaUJBQXRCLEVBQXlDLElBQUMsQ0FBQSxXQUExQyxDQUpBLENBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxRQUFRLENBQUMsRUFBVixDQUFhLE9BQWIsRUFBc0IsSUFBQyxDQUFBLGNBQXZCLENBTkEsQ0FBQTtBQUFBLElBT0EsSUFBQyxDQUFBLFNBQVMsQ0FBQyxFQUFYLENBQWMsT0FBZCxFQUF1QixJQUFDLENBQUEsZUFBeEIsQ0FQQSxDQUFBO0FBQUEsSUFTQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQXpCLENBQTRCLE9BQTVCLEVBQXFDLElBQUMsQ0FBQSxPQUF0QyxDQVRBLENBQUE7V0FXQSxLQWJZO0VBQUEsQ0E5QmIsQ0FBQTs7QUFBQSxtQkE2Q0EsWUFBQSxHQUFlLFNBQUMsS0FBRCxHQUFBO0FBRWQsSUFBQSxJQUFHLElBQUMsQ0FBQSxnQkFBSjtBQUNDLE1BQUEsSUFBQyxDQUFBLGdCQUFELEdBQW9CLEtBQXBCLENBQUE7QUFBQSxNQUNBLG9CQUFvQixDQUFDLE9BQXJCLENBQTZCLENBQUMsSUFBQyxDQUFBLEtBQUYsRUFBUyxJQUFDLENBQUEsUUFBVixDQUE3QixFQUFrRCxJQUFDLENBQUEsc0JBQUQsQ0FBQSxDQUFsRCxDQURBLENBQUE7QUFBQSxNQUVBLG9CQUFvQixDQUFDLEdBQXJCLENBQXlCLENBQUMsSUFBQyxDQUFBLFNBQUYsQ0FBekIsRUFBdUMsSUFBQyxDQUFBLHNCQUFELENBQUEsQ0FBdkMsQ0FGQSxDQUFBO0FBR0EsWUFBQSxDQUpEO0tBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxZQUFELENBQWMsS0FBZCxDQU5BLENBQUE7V0FRQSxLQVZjO0VBQUEsQ0E3Q2YsQ0FBQTs7QUFBQSxtQkF5REEsWUFBQSxHQUFlLFNBQUMsT0FBRCxHQUFBO0FBRWQsUUFBQSxNQUFBO0FBQUEsSUFBQSxJQUFDLENBQUEsYUFBRCxHQUFpQixPQUFqQixDQUFBO0FBQUEsSUFFQSxNQUFBLEdBQVMsSUFBQyxDQUFBLGdCQUFELENBQWtCLE9BQWxCLENBRlQsQ0FBQTtBQUFBLElBSUEsSUFBQyxDQUFBLEdBQUcsQ0FBQyxJQUFMLENBQVUsY0FBVixFQUEwQixPQUExQixDQUpBLENBQUE7QUFBQSxJQU1BLG9CQUFvQixDQUFDLElBQUQsQ0FBcEIsQ0FBd0IsSUFBQyxDQUFBLEtBQXpCLEVBQWdDLE1BQWhDLENBTkEsQ0FBQTtBQVFBLElBQUEsSUFBRyxPQUFBLEtBQVcsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFwQztBQUNDLE1BQUEsb0JBQW9CLENBQUMsSUFBRCxDQUFwQixDQUF3QixDQUFDLElBQUMsQ0FBQSxRQUFGLENBQXhCLEVBQXFDLE1BQXJDLENBQUEsQ0FBQTtBQUFBLE1BQ0Esb0JBQW9CLENBQUMsR0FBckIsQ0FBeUIsQ0FBQyxJQUFDLENBQUEsU0FBRixDQUF6QixFQUF1QyxNQUF2QyxDQURBLENBREQ7S0FBQSxNQUdLLElBQUcsT0FBQSxLQUFXLGFBQWQ7QUFDSixNQUFBLG9CQUFvQixDQUFDLElBQUQsQ0FBcEIsQ0FBd0IsQ0FBQyxJQUFDLENBQUEsU0FBRixDQUF4QixFQUFzQyxNQUF0QyxDQUFBLENBQUE7QUFBQSxNQUNBLG9CQUFvQixDQUFDLElBQUQsQ0FBcEIsQ0FBd0IsQ0FBQyxJQUFDLENBQUEsUUFBRixDQUF4QixFQUFxQyxpQkFBckMsQ0FEQSxDQURJO0tBWEw7V0FlQSxLQWpCYztFQUFBLENBekRmLENBQUE7O0FBQUEsbUJBNEVBLGdCQUFBLEdBQW1CLFNBQUMsT0FBRCxFQUFVLFdBQVYsR0FBQTtBQUVsQixRQUFBLE1BQUE7O01BRjRCLGNBQVk7S0FFeEM7QUFBQSxJQUFBLE9BQUEsR0FBVSxPQUFBLElBQVcsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFoQyxJQUF3QyxNQUFsRCxDQUFBO0FBRUEsSUFBQSxJQUFHLFdBQUEsSUFBZ0IsT0FBQSxLQUFXLFdBQTlCO0FBQ0MsTUFBQSxJQUFHLFdBQUEsS0FBZSxhQUFsQjtBQUNDLGVBQU8saUJBQVAsQ0FERDtPQUFBLE1BQUE7QUFHQyxlQUFPLGdCQUFQLENBSEQ7T0FERDtLQUZBO0FBQUEsSUFRQSxNQUFBO0FBQVMsY0FBTyxPQUFQO0FBQUEsYUFDSCxNQURHO0FBQUEsYUFDSyxhQURMO2lCQUN3QixNQUR4QjtBQUFBLGFBRUgsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUZuQjtpQkFFNkIsSUFBQyxDQUFBLHNCQUFELENBQUEsRUFGN0I7QUFBQTtpQkFHSCxRQUhHO0FBQUE7aUJBUlQsQ0FBQTtXQWFBLE9BZmtCO0VBQUEsQ0E1RW5CLENBQUE7O0FBQUEsbUJBNkZBLHNCQUFBLEdBQXlCLFNBQUEsR0FBQTtBQUV4QixRQUFBLE1BQUE7QUFBQSxJQUFBLE1BQUEsR0FBWSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEdBQTlCLENBQWtDLGVBQWxDLENBQUEsS0FBc0QsT0FBekQsR0FBc0UsT0FBdEUsR0FBbUYsT0FBNUYsQ0FBQTtXQUVBLE9BSndCO0VBQUEsQ0E3RnpCLENBQUE7O0FBQUEsbUJBbUdBLGFBQUEsR0FBZ0IsU0FBQSxHQUFBO0FBRWYsSUFBQSxJQUFDLENBQUEsWUFBRCxDQUFjLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBbkMsQ0FBQSxDQUFBO1dBRUEsS0FKZTtFQUFBLENBbkdoQixDQUFBOztBQUFBLG1CQXlHQSxXQUFBLEdBQWMsU0FBQyxDQUFELEdBQUE7QUFFYixRQUFBLGdCQUFBO0FBQUEsSUFBQSxHQUFBLEdBQU0sQ0FBQSxDQUFFLENBQUMsQ0FBQyxhQUFKLENBQU4sQ0FBQTtBQUFBLElBQ0EsV0FBQSxHQUFjLEdBQUcsQ0FBQyxJQUFKLENBQVMsbUJBQVQsQ0FEZCxDQUFBO0FBQUEsSUFHQSxvQkFBb0IsQ0FBQyxRQUFyQixDQUE4QixHQUE5QixFQUFtQyxJQUFDLENBQUEsZ0JBQUQsQ0FBa0IsSUFBQyxDQUFBLGFBQW5CLEVBQWtDLFdBQWxDLENBQW5DLENBSEEsQ0FBQTtXQUtBLEtBUGE7RUFBQSxDQXpHZCxDQUFBOztBQUFBLG1CQWtIQSxXQUFBLEdBQWMsU0FBQyxDQUFELEdBQUE7QUFFYixRQUFBLGdCQUFBO0FBQUEsSUFBQSxHQUFBLEdBQU0sQ0FBQSxDQUFFLENBQUMsQ0FBQyxhQUFKLENBQU4sQ0FBQTtBQUFBLElBQ0EsV0FBQSxHQUFjLEdBQUcsQ0FBQyxJQUFKLENBQVMsbUJBQVQsQ0FEZCxDQUFBO0FBQUEsSUFHQSxvQkFBb0IsQ0FBQyxVQUFyQixDQUFnQyxHQUFoQyxFQUFxQyxJQUFDLENBQUEsZ0JBQUQsQ0FBa0IsSUFBQyxDQUFBLGFBQW5CLEVBQWtDLFdBQWxDLENBQXJDLENBSEEsQ0FBQTtXQUtBLEtBUGE7RUFBQSxDQWxIZCxDQUFBOztBQUFBLG1CQTJIQSxjQUFBLEdBQWlCLFNBQUMsQ0FBRCxHQUFBO0FBRWhCLElBQUEsQ0FBQyxDQUFDLGNBQUYsQ0FBQSxDQUFBLENBQUE7QUFFQSxJQUFBLElBQWMsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFyQixLQUE2QixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQWpFO0FBQUEsWUFBQSxDQUFBO0tBRkE7QUFJQSxJQUFBLElBQUcsQ0FBQSxJQUFFLENBQUEsZ0JBQUw7QUFBMkIsTUFBQSxJQUFDLENBQUEsY0FBRCxDQUFBLENBQUEsQ0FBM0I7S0FKQTtXQU1BLEtBUmdCO0VBQUEsQ0EzSGpCLENBQUE7O0FBQUEsbUJBcUlBLGVBQUEsR0FBa0IsU0FBQyxDQUFELEdBQUE7QUFFakIsSUFBQSxJQUFHLElBQUMsQ0FBQSxnQkFBSjtBQUNDLE1BQUEsQ0FBQyxDQUFDLGNBQUYsQ0FBQSxDQUFBLENBQUE7QUFBQSxNQUNBLENBQUMsQ0FBQyxlQUFGLENBQUEsQ0FEQSxDQUFBO0FBQUEsTUFFQSxJQUFDLENBQUEsY0FBRCxDQUFBLENBRkEsQ0FERDtLQUFBO1dBS0EsS0FQaUI7RUFBQSxDQXJJbEIsQ0FBQTs7QUFBQSxtQkE4SUEsT0FBQSxHQUFVLFNBQUMsQ0FBRCxHQUFBO0FBRVQsSUFBQSxJQUFHLENBQUMsQ0FBQyxPQUFGLEtBQWEsRUFBaEI7QUFBd0IsTUFBQSxJQUFDLENBQUEsY0FBRCxDQUFBLENBQUEsQ0FBeEI7S0FBQTtXQUVBLEtBSlM7RUFBQSxDQTlJVixDQUFBOztBQUFBLG1CQW9KQSxjQUFBLEdBQWlCLFNBQUEsR0FBQTtBQUVoQixJQUFBLElBQUEsQ0FBQSxDQUFjLElBQUUsQ0FBQSxnQkFBaEI7QUFBQSxZQUFBLENBQUE7S0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLFlBQUQsQ0FBYyxhQUFkLENBRkEsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLE9BQUQsQ0FBUyxJQUFDLENBQUEsc0JBQVYsQ0FIQSxDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsZ0JBQUQsR0FBb0IsSUFKcEIsQ0FBQTtXQU1BLEtBUmdCO0VBQUEsQ0FwSmpCLENBQUE7O0FBQUEsbUJBOEpBLGNBQUEsR0FBaUIsU0FBQSxHQUFBO0FBRWhCLElBQUEsSUFBQSxDQUFBLElBQWUsQ0FBQSxnQkFBZjtBQUFBLFlBQUEsQ0FBQTtLQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsWUFBRCxDQUFjLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBbkMsQ0FGQSxDQUFBO0FBQUEsSUFHQSxJQUFDLENBQUEsT0FBRCxDQUFTLElBQUMsQ0FBQSx1QkFBVixDQUhBLENBQUE7QUFBQSxJQUlBLElBQUMsQ0FBQSxnQkFBRCxHQUFvQixLQUpwQixDQUFBO1dBTUEsS0FSZ0I7RUFBQSxDQTlKakIsQ0FBQTs7Z0JBQUE7O0dBRm9CLGFBSnJCLENBQUE7O0FBQUEsTUE4S00sQ0FBQyxPQUFQLEdBQWlCLE1BOUtqQixDQUFBOzs7OztBQ0FBLElBQUEsdUJBQUE7RUFBQTs7aVNBQUE7O0FBQUEsWUFBQSxHQUFlLE9BQUEsQ0FBUSxpQkFBUixDQUFmLENBQUE7O0FBQUE7QUFJQyw4QkFBQSxDQUFBOztBQUFBLHNCQUFBLEVBQUEsR0FBa0IsSUFBbEIsQ0FBQTs7QUFBQSxzQkFFQSxlQUFBLEdBQWtCLEdBRmxCLENBQUE7O0FBSWMsRUFBQSxtQkFBQSxHQUFBO0FBRWIsMkRBQUEsQ0FBQTtBQUFBLHVDQUFBLENBQUE7QUFBQSwyREFBQSxDQUFBO0FBQUEsdUNBQUEsQ0FBQTtBQUFBLHVDQUFBLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxVQUFELENBQVksQ0FBQSxDQUFFLFlBQUYsQ0FBWixDQUFBLENBQUE7QUFBQSxJQUVBLHlDQUFBLENBRkEsQ0FBQTtBQUlBLFdBQU8sSUFBUCxDQU5hO0VBQUEsQ0FKZDs7QUFBQSxzQkFZQSxJQUFBLEdBQU8sU0FBQSxHQUFBO1dBRU4sS0FGTTtFQUFBLENBWlAsQ0FBQTs7QUFBQSxzQkFnQkEsSUFBQSxHQUFPLFNBQUUsRUFBRixHQUFBO0FBRU4sSUFGTyxJQUFDLENBQUEsS0FBQSxFQUVSLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxHQUFHLENBQUMsR0FBTCxDQUFTO0FBQUEsTUFBQSxTQUFBLEVBQVksT0FBWjtLQUFULENBQUEsQ0FBQTtXQUVBLEtBSk07RUFBQSxDQWhCUCxDQUFBOztBQUFBLHNCQXNCQSxjQUFBLEdBQWlCLFNBQUEsR0FBQTs7TUFFaEIsSUFBQyxDQUFBO0tBQUQ7V0FFQSxLQUpnQjtFQUFBLENBdEJqQixDQUFBOztBQUFBLHNCQTRCQSxJQUFBLEdBQU8sU0FBRSxFQUFGLEdBQUE7QUFFTixJQUZPLElBQUMsQ0FBQSxLQUFBLEVBRVIsQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLGNBQUQsQ0FBQSxDQUFBLENBQUE7V0FFQSxLQUpNO0VBQUEsQ0E1QlAsQ0FBQTs7QUFBQSxzQkFrQ0EsY0FBQSxHQUFpQixTQUFBLEdBQUE7QUFFaEIsSUFBQSxJQUFDLENBQUEsR0FBRyxDQUFDLEdBQUwsQ0FBUztBQUFBLE1BQUEsU0FBQSxFQUFZLE1BQVo7S0FBVCxDQUFBLENBQUE7O01BQ0EsSUFBQyxDQUFBO0tBREQ7V0FHQSxLQUxnQjtFQUFBLENBbENqQixDQUFBOzttQkFBQTs7R0FGdUIsYUFGeEIsQ0FBQTs7QUFBQSxNQTZDTSxDQUFDLE9BQVAsR0FBaUIsU0E3Q2pCLENBQUE7Ozs7O0FDQUEsSUFBQSwwQ0FBQTtFQUFBOztpU0FBQTs7QUFBQSxZQUFBLEdBQWtCLE9BQUEsQ0FBUSxpQkFBUixDQUFsQixDQUFBOztBQUFBLGNBQ0EsR0FBcUIsT0FBQSxDQUFRLDhCQUFSLENBRHJCLENBQUE7O0FBQUEsR0FFQSxHQUFrQixPQUFBLENBQVEsa0JBQVIsQ0FGbEIsQ0FBQTs7QUFBQTtBQU1DLDRCQUFBLENBQUE7O0FBQUEsb0JBQUEsY0FBQSxHQUFrQixNQUFsQixDQUFBOztBQUFBLG9CQUNBLGVBQUEsR0FBa0IsT0FEbEIsQ0FBQTs7QUFBQSxvQkFHQSxRQUFBLEdBQVcsU0FIWCxDQUFBOztBQUFBLG9CQUtBLEtBQUEsR0FBaUIsSUFMakIsQ0FBQTs7QUFBQSxvQkFNQSxZQUFBLEdBQWlCLElBTmpCLENBQUE7O0FBQUEsb0JBT0EsV0FBQSxHQUFpQixJQVBqQixDQUFBOztBQUFBLG9CQVFBLGNBQUEsR0FBaUIsSUFSakIsQ0FBQTs7QUFVYyxFQUFBLGlCQUFBLEdBQUE7QUFFYiw2REFBQSxDQUFBO0FBQUEseURBQUEsQ0FBQTtBQUFBLG1EQUFBLENBQUE7QUFBQSxtREFBQSxDQUFBO0FBQUEsbURBQUEsQ0FBQTtBQUFBLHlDQUFBLENBQUE7QUFBQSx1Q0FBQSxDQUFBO0FBQUEsMkRBQUEsQ0FBQTtBQUFBLDJEQUFBLENBQUE7QUFBQSxtREFBQSxDQUFBO0FBQUEseURBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLEtBQUQsR0FDQztBQUFBLE1BQUEsTUFBQSxFQUFTO0FBQUEsUUFBQSxRQUFBLEVBQVcsY0FBWDtBQUFBLFFBQTJCLEtBQUEsRUFBUSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQXpEO0FBQUEsUUFBK0QsSUFBQSxFQUFPLElBQXRFO0FBQUEsUUFBNEUsSUFBQSxFQUFPLElBQUMsQ0FBQSxjQUFwRjtPQUFUO0tBREQsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLGFBQUQsQ0FBQSxDQUhBLENBQUE7QUFBQSxJQUtBLHVDQUFBLENBTEEsQ0FBQTtBQVVBLFdBQU8sSUFBUCxDQVphO0VBQUEsQ0FWZDs7QUFBQSxvQkF3QkEsYUFBQSxHQUFnQixTQUFBLEdBQUE7QUFFZixRQUFBLGdCQUFBO0FBQUE7QUFBQSxTQUFBLFlBQUE7d0JBQUE7QUFBQSxNQUFDLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFLLENBQUMsSUFBYixHQUFvQixHQUFBLENBQUEsSUFBSyxDQUFBLEtBQU0sQ0FBQSxJQUFBLENBQUssQ0FBQyxRQUF0QyxDQUFBO0FBQUEsS0FBQTtXQUVBLEtBSmU7RUFBQSxDQXhCaEIsQ0FBQTs7QUFBQSxvQkE4QkEsVUFBQSxHQUFhLFNBQUEsR0FBQTtBQUVYLFFBQUEsMEJBQUE7QUFBQTtBQUFBO1NBQUEsWUFBQTt3QkFBQTtBQUNDLE1BQUEsSUFBRyxJQUFJLENBQUMsSUFBTCxLQUFhLElBQUMsQ0FBQSxjQUFqQjtzQkFBcUMsSUFBQyxDQUFBLFFBQUQsQ0FBVSxJQUFJLENBQUMsSUFBZixHQUFyQztPQUFBLE1BQUE7OEJBQUE7T0FERDtBQUFBO29CQUZXO0VBQUEsQ0E5QmIsQ0FBQTs7QUFBQSxFQW1DQyxJQW5DRCxDQUFBOztBQUFBLG9CQXFDQSxjQUFBLEdBQWlCLFNBQUMsS0FBRCxHQUFBO0FBRWhCLFFBQUEsZ0JBQUE7QUFBQTtBQUFBLFNBQUEsWUFBQTt3QkFBQTtBQUNDLE1BQUEsSUFBdUIsS0FBQSxLQUFTLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFLLENBQUMsS0FBN0M7QUFBQSxlQUFPLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFkLENBQUE7T0FERDtBQUFBLEtBQUE7V0FHQSxLQUxnQjtFQUFBLENBckNqQixDQUFBOztBQUFBLG9CQTRDQSxjQUFBLEdBQWlCLFNBQUMsS0FBRCxHQUFBO0FBRWhCLFFBQUEsZ0JBQUE7QUFBQTtBQUFBLFNBQUEsWUFBQTt3QkFBQTtBQUNDLE1BQUEsSUFBdUIsS0FBQSxLQUFTLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFLLENBQUMsS0FBN0M7QUFBQSxlQUFPLElBQUMsQ0FBQSxLQUFNLENBQUEsSUFBQSxDQUFkLENBQUE7T0FERDtBQUFBLEtBQUE7QUFHQSxJQUFBLElBQUcsS0FBSDtBQUFjLGFBQU8sSUFBQyxDQUFBLEtBQUssQ0FBQyxVQUFkLENBQWQ7S0FIQTtXQUtBLEtBUGdCO0VBQUEsQ0E1Q2pCLENBQUE7O0FBQUEsb0JBcURBLElBQUEsR0FBTyxTQUFBLEdBQUE7QUFFTixJQUFBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxFQUFqQixDQUFvQixPQUFwQixFQUE2QixJQUFDLENBQUEsS0FBOUIsQ0FBQSxDQUFBO1dBRUEsS0FKTTtFQUFBLENBckRQLENBQUE7O0FBQUEsb0JBMkRBLEtBQUEsR0FBUSxTQUFBLEdBQUE7QUFFUCxJQUFBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxHQUFqQixDQUFxQixPQUFyQixFQUE4QixJQUFDLENBQUEsS0FBL0IsQ0FBQSxDQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsVUFBRCxDQUFBLENBRkEsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLFVBQUQsQ0FBQSxDQUhBLENBQUE7V0FLQSxLQVBPO0VBQUEsQ0EzRFIsQ0FBQTs7QUFBQSxvQkFvRUEsVUFBQSxHQUFhLFNBQUEsR0FBQTtBQUVaLElBQUEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsR0FBRyxDQUFDLEVBQWIsQ0FBZ0IsR0FBRyxDQUFDLGlCQUFwQixFQUF1QyxJQUFDLENBQUEsVUFBeEMsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxHQUFHLENBQUMsRUFBYixDQUFnQixHQUFHLENBQUMscUJBQXBCLEVBQTJDLElBQUMsQ0FBQSxhQUE1QyxDQURBLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxFQUFqQixDQUFvQixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsdUJBQXJDLEVBQThELElBQUMsQ0FBQSxVQUEvRCxDQUhBLENBQUE7V0FLQSxLQVBZO0VBQUEsQ0FwRWIsQ0FBQTs7QUFBQSxvQkE2RUEsVUFBQSxHQUFhLFNBQUEsR0FBQTtBQUVaLElBQUEsSUFBQyxDQUFBLEdBQUcsQ0FBQyxHQUFMLENBQVMsWUFBVCxFQUF1QixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQTdDLENBQUEsQ0FBQTtXQUVBLEtBSlk7RUFBQSxDQTdFYixDQUFBOztBQUFBLG9CQW1GQSxVQUFBLEdBQWEsU0FBQyxRQUFELEVBQVcsT0FBWCxHQUFBO0FBRVosSUFBQSxJQUFHLElBQUMsQ0FBQSxhQUFELElBQW1CLElBQUMsQ0FBQSxhQUFhLENBQUMsS0FBZixDQUFBLENBQUEsS0FBNEIsVUFBbEQ7QUFDQyxNQUFHLENBQUEsU0FBQSxLQUFBLEdBQUE7ZUFBQSxDQUFBLFNBQUMsUUFBRCxFQUFXLE9BQVgsR0FBQTtpQkFBdUIsS0FBQyxDQUFBLGFBQWEsQ0FBQyxJQUFmLENBQW9CLFNBQUEsR0FBQTttQkFBRyxLQUFDLENBQUEsVUFBRCxDQUFZLFFBQVosRUFBc0IsT0FBdEIsRUFBSDtVQUFBLENBQXBCLEVBQXZCO1FBQUEsQ0FBQSxFQUFBO01BQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFILENBQUksUUFBSixFQUFjLE9BQWQsQ0FBQSxDQUFBO0FBQ0EsWUFBQSxDQUZEO0tBQUE7QUFBQSxJQUlBLElBQUMsQ0FBQSxZQUFELEdBQWdCLElBQUMsQ0FBQSxjQUFELENBQWdCLFFBQVEsQ0FBQyxJQUF6QixDQUpoQixDQUFBO0FBQUEsSUFLQSxJQUFDLENBQUEsV0FBRCxHQUFnQixJQUFDLENBQUEsY0FBRCxDQUFnQixPQUFPLENBQUMsSUFBeEIsQ0FMaEIsQ0FBQTtBQU9BLElBQUEsSUFBRyxDQUFBLElBQUUsQ0FBQSxZQUFMO0FBQ0MsTUFBQSxJQUFDLENBQUEsZUFBRCxDQUFpQixLQUFqQixFQUF3QixJQUFDLENBQUEsV0FBekIsQ0FBQSxDQUREO0tBQUEsTUFBQTtBQUdDLE1BQUEsSUFBQyxDQUFBLGVBQUQsQ0FBaUIsSUFBQyxDQUFBLFlBQWxCLEVBQWdDLElBQUMsQ0FBQSxXQUFqQyxDQUFBLENBSEQ7S0FQQTtXQVlBLEtBZFk7RUFBQSxDQW5GYixDQUFBOztBQUFBLG9CQW1HQSxhQUFBLEdBQWdCLFNBQUMsT0FBRCxHQUFBO0FBRWYsSUFBQSxJQUFDLENBQUEsV0FBVyxDQUFDLElBQUksQ0FBQyxPQUFsQixDQUEwQixHQUFHLENBQUMscUJBQTlCLEVBQXFELE9BQU8sQ0FBQyxHQUE3RCxDQUFBLENBQUE7V0FFQSxLQUplO0VBQUEsQ0FuR2hCLENBQUE7O0FBQUEsb0JBeUdBLGVBQUEsR0FBa0IsU0FBQyxJQUFELEVBQU8sRUFBUCxHQUFBO0FBRWpCLElBQUEsSUFBQyxDQUFBLGFBQUQsR0FBaUIsQ0FBQyxDQUFDLFFBQUYsQ0FBQSxDQUFqQixDQUFBO0FBRUEsSUFBQSxJQUFHLElBQUEsSUFBUyxFQUFaO0FBQ0MsTUFBQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQTlCLENBQXNDLElBQUksQ0FBQyxLQUEzQyxFQUFrRCxFQUFFLENBQUMsS0FBckQsQ0FBQSxDQUFBO0FBQUEsTUFDQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUQsQ0FBN0IsQ0FBaUMsQ0FBQSxTQUFBLEtBQUEsR0FBQTtlQUFBLFNBQUEsR0FBQTtpQkFBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQVYsQ0FBZSxTQUFBLEdBQUE7bUJBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFSLENBQWEsU0FBQSxHQUFBO3FCQUFHLEtBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsR0FBOUIsQ0FBa0MsU0FBQSxHQUFBO3VCQUFHLEtBQUMsQ0FBQSxhQUFhLENBQUMsT0FBZixDQUFBLEVBQUg7Y0FBQSxDQUFsQyxFQUFIO1lBQUEsQ0FBYixFQUFIO1VBQUEsQ0FBZixFQUFIO1FBQUEsRUFBQTtNQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBakMsQ0FEQSxDQUREO0tBQUEsTUFHSyxJQUFHLElBQUg7QUFDSixNQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBVixDQUFlLElBQUMsQ0FBQSxhQUFhLENBQUMsT0FBOUIsQ0FBQSxDQURJO0tBQUEsTUFFQSxJQUFHLEVBQUg7QUFDSixNQUFBLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBUixDQUFhLElBQUMsQ0FBQSxhQUFhLENBQUMsT0FBNUIsQ0FBQSxDQURJO0tBUEw7V0FVQSxLQVppQjtFQUFBLENBekdsQixDQUFBOztpQkFBQTs7R0FGcUIsYUFKdEIsQ0FBQTs7QUFBQSxNQTZITSxDQUFDLE9BQVAsR0FBaUIsT0E3SGpCLENBQUE7Ozs7O0FDQUEsSUFBQSxnQ0FBQTtFQUFBOztpU0FBQTs7QUFBQSxnQkFBQSxHQUFtQixPQUFBLENBQVEscUJBQVIsQ0FBbkIsQ0FBQTs7QUFBQTtBQUlDLG1DQUFBLENBQUE7O0FBQUEsMkJBQUEsUUFBQSxHQUFXLGFBQVgsQ0FBQTs7QUFBQSwyQkFDQSxLQUFBLEdBQVcsSUFEWCxDQUFBOztBQUdjLEVBQUEsd0JBQUEsR0FBQTtBQUViLHVEQUFBLENBQUE7QUFBQSw2REFBQSxDQUFBO0FBQUEscURBQUEsQ0FBQTtBQUFBLG1EQUFBLENBQUE7QUFBQSwyRUFBQSxDQUFBO0FBQUEsdUVBQUEsQ0FBQTtBQUFBLGlEQUFBLENBQUE7QUFBQSw2Q0FBQSxDQUFBO0FBQUEsdUNBQUEsQ0FBQTtBQUFBLHVDQUFBLENBQUE7QUFBQSx1REFBQSxDQUFBO0FBQUEsdUNBQUEsQ0FBQTtBQUFBLElBQUEsT0FBTyxDQUFDLEdBQVIsQ0FBWSxXQUFaLENBQUEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLFlBQUQsR0FBZ0IsRUFGaEIsQ0FBQTtBQUFBLElBSUEsOENBQUEsQ0FKQSxDQUFBO0FBTUEsV0FBTyxJQUFQLENBUmE7RUFBQSxDQUhkOztBQUFBLDJCQWFBLElBQUEsR0FBTyxTQUFBLEdBQUE7QUFFTixJQUFBLElBQUMsQ0FBQSxNQUFELEdBQWdCLElBQUMsQ0FBQSxHQUFHLENBQUMsSUFBTCxDQUFVLHFCQUFWLENBQWhCLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxZQUFELEdBQWdCLElBQUMsQ0FBQSxHQUFHLENBQUMsSUFBTCxDQUFVLG9CQUFWLENBRGhCLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxNQUFELEdBQWEsSUFBQyxDQUFBLEdBQUcsQ0FBQyxJQUFMLENBQVUsMEJBQVYsQ0FIYixDQUFBO0FBQUEsSUFJQSxJQUFDLENBQUEsU0FBRCxHQUFhLElBQUMsQ0FBQSxHQUFHLENBQUMsSUFBTCxDQUFVLDZCQUFWLENBSmIsQ0FBQTtBQUFBLElBS0EsSUFBQyxDQUFBLE1BQUQsR0FBYSxJQUFDLENBQUEsR0FBRyxDQUFDLElBQUwsQ0FBVSwwQkFBVixDQUxiLENBQUE7V0FPQSxLQVRNO0VBQUEsQ0FiUCxDQUFBOztBQUFBLDJCQXdCQSxZQUFBLEdBQWUsU0FBQyxPQUFELEdBQUE7QUFFZCxJQUFBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxNQUFPLENBQUEsT0FBQSxDQUF4QixDQUFpQyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLHNCQUF6RCxFQUFpRixJQUFDLENBQUEsVUFBbEYsQ0FBQSxDQUFBO0FBQUEsSUFDQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTyxDQUFBLE9BQUEsQ0FBeEIsQ0FBaUMsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyx1QkFBekQsRUFBa0YsSUFBQyxDQUFBLFdBQW5GLENBREEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLEdBQUksQ0FBQSxPQUFBLENBQUwsQ0FBYyxPQUFkLEVBQXVCLGtCQUF2QixFQUEyQyxJQUFDLENBQUEsZUFBNUMsQ0FGQSxDQUFBO1dBSUEsS0FOYztFQUFBLENBeEJmLENBQUE7O0FBQUEsMkJBZ0NBLElBQUEsR0FBTyxTQUFDLEVBQUQsR0FBQTtBQUVOLElBQUEsSUFBQyxDQUFBLEtBQUQsR0FBUyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsWUFBMUIsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE9BQUQsQ0FBQSxDQUZBLENBQUE7QUFBQSxJQUlBLDBDQUFBLFNBQUEsQ0FKQSxDQUFBO0FBQUEsSUFNQSxJQUFDLENBQUEsU0FBRCxDQUFXLEtBQVgsQ0FOQSxDQUFBO1dBUUEsS0FWTTtFQUFBLENBaENQLENBQUE7O0FBQUEsMkJBNENBLElBQUEsR0FBTyxTQUFDLEVBQUQsR0FBQTtBQUVOLElBQUEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxjQUF4QixDQUFBLENBQUEsQ0FBQTtBQUFBLElBRUEsMENBQUEsU0FBQSxDQUZBLENBQUE7V0FJQSxLQU5NO0VBQUEsQ0E1Q1AsQ0FBQTs7QUFBQSwyQkFvREEsT0FBQSxHQUFVLFNBQUEsR0FBQTtBQUVULElBQUEsSUFBQyxDQUFBLFlBQVksQ0FBQyxJQUFkLENBQW1CLElBQUMsQ0FBQSxvQkFBRCxDQUFBLENBQW5CLENBQUEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLEdBQUcsQ0FBQyxJQUFMLENBQVUsbUJBQVYsRUFBK0IsSUFBQyxDQUFBLEtBQUssQ0FBQyxHQUFQLENBQVcsZUFBWCxDQUEvQixDQUZBLENBQUE7QUFBQSxJQUdBLElBQUMsQ0FBQSxNQUFNLENBQUMsSUFBUixDQUFhLEtBQWIsRUFBb0IsRUFBcEIsQ0FBdUIsQ0FBQyxXQUF4QixDQUFvQyxNQUFwQyxDQUhBLENBQUE7QUFBQSxJQUlBLElBQUMsQ0FBQSxNQUFNLENBQUMsSUFBUixDQUFhLFVBQWIsRUFBeUIsQ0FBQSxJQUFFLENBQUEsS0FBSyxDQUFDLEdBQVAsQ0FBVyxtQkFBWCxDQUExQixDQUpBLENBQUE7QUFBQSxJQUtBLElBQUMsQ0FBQSxTQUFTLENBQUMsSUFBWCxDQUFnQixVQUFoQixFQUE0QixDQUFBLElBQUUsQ0FBQSxLQUFLLENBQUMsR0FBUCxDQUFXLHNCQUFYLENBQTdCLENBTEEsQ0FBQTtBQUFBLElBTUEsSUFBQyxDQUFBLE1BQU0sQ0FBQyxJQUFSLENBQWEsVUFBYixFQUF5QixDQUFBLElBQUUsQ0FBQSxLQUFLLENBQUMsR0FBUCxDQUFXLG1CQUFYLENBQTFCLENBTkEsQ0FBQTtXQVFBLEtBVlM7RUFBQSxDQXBEVixDQUFBOztBQUFBLDJCQWdFQSxTQUFBLEdBQVksU0FBQyxXQUFELEdBQUE7QUFFWCxRQUFBLFVBQUE7O01BRlksY0FBWTtLQUV4QjtBQUFBLElBQUEsSUFBRyxXQUFIO0FBQW9CLE1BQUEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxHQUE5QixDQUFrQyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLDJCQUFoRSxFQUE2RixJQUFDLENBQUEsU0FBOUYsQ0FBQSxDQUFwQjtLQUFBO0FBQUEsSUFHQSxVQUFBLEdBQWEsSUFBQyxDQUFBLEtBQUssQ0FBQyxHQUFQLENBQVcsWUFBWCxDQUhiLENBQUE7QUFBQSxJQUtBLElBQUMsQ0FBQSxNQUFNLENBQUMsSUFBUixDQUFhLEtBQWIsRUFBcUIsNENBQUEsR0FBNEMsVUFBNUMsR0FBdUQsYUFBNUUsQ0FMQSxDQUFBO0FBQUEsSUFNQSxJQUFDLENBQUEsTUFBTSxDQUFDLEdBQVIsQ0FBWSxNQUFaLEVBQW9CLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFBLEdBQUE7ZUFBRyxLQUFDLENBQUEsTUFBTSxDQUFDLFFBQVIsQ0FBaUIsTUFBakIsRUFBSDtNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQXBCLENBTkEsQ0FBQTtXQVFBLEtBVlc7RUFBQSxDQWhFWixDQUFBOztBQUFBLDJCQTRFQSxvQkFBQSxHQUF1QixTQUFBLEdBQUE7QUFHdEIsUUFBQSxpQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLEtBQUssQ0FBQyxZQUFQLENBQUEsQ0FBQSxDQUFBO0FBQUEsSUFFQSxjQUFBLEdBQ0M7QUFBQSxNQUFBLFNBQUEsRUFBNkIsSUFBQyxDQUFBLEtBQUssQ0FBQyxHQUFQLENBQVcsV0FBWCxDQUE3QjtBQUFBLE1BQ0EsWUFBQSxFQUE2QixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0IscUJBQXBCLENBRDdCO0FBQUEsTUFFQSxjQUFBLEVBQTZCLElBQUMsQ0FBQSxLQUFLLENBQUMsYUFBUCxDQUFBLENBRjdCO0FBQUEsTUFHQSxpQkFBQSxFQUE2QixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0IsMEJBQXBCLENBSDdCO0FBQUEsTUFJQSxtQkFBQSxFQUE2QixJQUFDLENBQUEsS0FBSyxDQUFDLEdBQVAsQ0FBVyxNQUFYLENBSjdCO0FBQUEsTUFLQSxpQkFBQSxFQUE2QixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0IsMEJBQXBCLENBTDdCO0FBQUEsTUFNQSxtQkFBQSxFQUE2QixJQUFDLENBQUEsS0FBSyxDQUFDLEdBQVAsQ0FBVyxhQUFYLENBTjdCO0FBQUEsTUFPQSxVQUFBLEVBQTZCLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE1BQU0sQ0FBQyxHQUFoQixDQUFvQixtQkFBcEIsQ0FQN0I7QUFBQSxNQVFBLFlBQUEsRUFBNkIsSUFBQyxDQUFBLEtBQUssQ0FBQyxHQUFQLENBQVcsTUFBWCxDQUFrQixDQUFDLElBQW5CLENBQXdCLElBQXhCLENBUjdCO0FBQUEsTUFTQSxpQkFBQSxFQUE2QixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0IsMEJBQXBCLENBVDdCO0FBQUEsTUFVQSxtQkFBQSxFQUE2QixJQUFDLENBQUEsc0JBQUQsQ0FBQSxDQVY3QjtBQUFBLE1BV0EsV0FBQSxFQUE2QixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0Isb0JBQXBCLENBWDdCO0FBQUEsTUFZQSxTQUFBLEVBQTZCLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLFFBQVQsR0FBb0IsR0FBcEIsR0FBMEIsSUFBQyxDQUFBLEtBQUssQ0FBQyxHQUFQLENBQVcsV0FBWCxDQVp2RDtBQUFBLE1BYUEsY0FBQSxFQUE2QixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxRQUFRLENBQUMsT0FBbEIsQ0FBMEIsU0FBMUIsRUFBcUMsRUFBckMsQ0FBQSxHQUEyQyxHQUEzQyxHQUFpRCxJQUFDLENBQUEsS0FBSyxDQUFDLEdBQVAsQ0FBVyxXQUFYLENBYjlFO0tBSEQsQ0FBQTtBQUFBLElBa0JBLGlCQUFBLEdBQW9CLENBQUMsQ0FBQyxRQUFGLENBQVcsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsU0FBUyxDQUFDLEdBQW5CLENBQXVCLGFBQXZCLENBQVgsQ0FBQSxDQUFrRCxjQUFsRCxDQWxCcEIsQ0FBQTtXQW9CQSxrQkF2QnNCO0VBQUEsQ0E1RXZCLENBQUE7O0FBQUEsMkJBcUdBLHNCQUFBLEdBQXlCLFNBQUEsR0FBQTtBQUV4QixRQUFBLFlBQUE7QUFBQSxJQUFBLFlBQUEsR0FBZSxFQUFmLENBQUE7QUFFQSxJQUFBLElBQUcsSUFBQyxDQUFBLEtBQUssQ0FBQyxHQUFQLENBQVcsbUJBQVgsQ0FBSDtBQUF3QyxNQUFBLFlBQVksQ0FBQyxJQUFiLENBQWtCLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE1BQU0sQ0FBQyxHQUFoQixDQUFvQixnQ0FBcEIsQ0FBbEIsQ0FBQSxDQUF4QztLQUZBO0FBR0EsSUFBQSxJQUFHLElBQUMsQ0FBQSxLQUFLLENBQUMsR0FBUCxDQUFXLHNCQUFYLENBQUg7QUFBMkMsTUFBQSxZQUFZLENBQUMsSUFBYixDQUFrQixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0IsbUNBQXBCLENBQWxCLENBQUEsQ0FBM0M7S0FIQTtBQUlBLElBQUEsSUFBRyxJQUFDLENBQUEsS0FBSyxDQUFDLEdBQVAsQ0FBVyxtQkFBWCxDQUFIO0FBQXdDLE1BQUEsWUFBWSxDQUFDLElBQWIsQ0FBa0IsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsTUFBTSxDQUFDLEdBQWhCLENBQW9CLGdDQUFwQixDQUFsQixDQUFBLENBQXhDO0tBSkE7V0FNQSxZQUFZLENBQUMsSUFBYixDQUFrQixJQUFsQixDQUFBLElBQTJCLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE1BQU0sQ0FBQyxHQUFoQixDQUFvQiwrQkFBcEIsRUFSSDtFQUFBLENBckd6QixDQUFBOztBQUFBLDJCQStHQSxVQUFBLEdBQWEsU0FBQSxHQUFBO0FBRVosSUFBQSxJQUFDLENBQUEsR0FBRyxDQUFDLFFBQUwsQ0FBYyxXQUFkLENBQUEsQ0FBQTtXQUVBLEtBSlk7RUFBQSxDQS9HYixDQUFBOztBQUFBLDJCQXFIQSxXQUFBLEdBQWMsU0FBQSxHQUFBO0FBRWIsSUFBQSxJQUFDLENBQUEsR0FBRyxDQUFDLFdBQUwsQ0FBaUIsV0FBakIsQ0FBQSxDQUFBO1dBRUEsS0FKYTtFQUFBLENBckhkLENBQUE7O0FBQUEsMkJBMkhBLGVBQUEsR0FBa0IsU0FBQyxDQUFELEdBQUE7QUFFakIsUUFBQSxzQkFBQTtBQUFBLElBQUEsQ0FBQyxDQUFDLGNBQUYsQ0FBQSxDQUFBLENBQUE7QUFBQSxJQUVBLFdBQUEsR0FBYyxDQUFBLENBQUUsQ0FBQyxDQUFDLGFBQUosQ0FBa0IsQ0FBQyxJQUFuQixDQUF3QixnQkFBeEIsQ0FGZCxDQUFBO0FBQUEsSUFHQSxHQUFBLEdBQWlCLFdBQUEsS0FBZSxVQUFsQixHQUFrQyxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxRQUFULEdBQW9CLEdBQXBCLEdBQTBCLElBQUMsQ0FBQSxLQUFLLENBQUMsR0FBUCxDQUFXLFdBQVgsQ0FBNUQsR0FBeUYsR0FIdkcsQ0FBQTtBQUFBLElBSUEsSUFBQSxHQUFjLElBQUMsQ0FBQSxZQUFELENBQUEsQ0FKZCxDQUFBO0FBQUEsSUFNQSxJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxLQUFNLENBQUEsV0FBQSxDQUFmLENBQTRCLEdBQTVCLEVBQWlDLElBQWpDLENBTkEsQ0FBQTtXQVFBLEtBVmlCO0VBQUEsQ0EzSGxCLENBQUE7O0FBQUEsMkJBdUlBLFlBQUEsR0FBZSxTQUFBLEdBQUE7QUFFZCxRQUFBLFVBQUE7QUFBQSxJQUFBLElBQUEsR0FDQztBQUFBLE1BQUEsV0FBQSxFQUFnQixJQUFDLENBQUEsS0FBSyxDQUFDLEdBQVAsQ0FBVyxNQUFYLENBQWhCO0FBQUEsTUFDQSxhQUFBLEVBQW1CLElBQUMsQ0FBQSxLQUFLLENBQUMsR0FBUCxDQUFXLGdCQUFYLENBQUgsR0FBc0MsR0FBQSxHQUFFLENBQUMsSUFBQyxDQUFBLEtBQUssQ0FBQyxHQUFQLENBQVcsZ0JBQVgsQ0FBRCxDQUF4QyxHQUE2RSxJQUFDLENBQUEsS0FBSyxDQUFDLEdBQVAsQ0FBVyxhQUFYLENBRDdGO0FBQUEsTUFFQSxTQUFBLEVBQWdCLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLFFBQVQsR0FBb0IsR0FBcEIsR0FBMEIsSUFBQyxDQUFBLEtBQUssQ0FBQyxHQUFQLENBQVcsV0FBWCxDQUYxQztBQUFBLE1BR0EsV0FBQSxFQUFnQixDQUFDLENBQUMsR0FBRixDQUFNLElBQUMsQ0FBQSxLQUFLLENBQUMsR0FBUCxDQUFXLE1BQVgsQ0FBTixFQUEwQixTQUFDLEdBQUQsR0FBQTtlQUFTLEdBQUEsR0FBTSxJQUFmO01BQUEsQ0FBMUIsQ0FBNkMsQ0FBQyxJQUE5QyxDQUFtRCxHQUFuRCxDQUhoQjtLQURELENBQUE7QUFBQSxJQU1BLElBQUEsR0FBTyxJQUFDLENBQUEsY0FBRCxDQUFnQixJQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxNQUFNLENBQUMsR0FBaEIsQ0FBb0Isd0JBQXBCLENBQWhCLEVBQStELElBQS9ELEVBQXFFLEtBQXJFLENBTlAsQ0FBQTtXQVFBLElBQUksQ0FBQyxPQUFMLENBQWEsU0FBYixFQUF3QixHQUF4QixFQVZjO0VBQUEsQ0F2SWYsQ0FBQTs7d0JBQUE7O0dBRjRCLGlCQUY3QixDQUFBOztBQUFBLE1BdUpNLENBQUMsT0FBUCxHQUFpQixjQXZKakIsQ0FBQTs7Ozs7QUNBQSxJQUFBLDJCQUFBO0VBQUE7O2lTQUFBOztBQUFBLFlBQUEsR0FBZSxPQUFBLENBQVEsaUJBQVIsQ0FBZixDQUFBOztBQUFBO0FBSUMsa0NBQUEsQ0FBQTs7QUFBQSwwQkFBQSxPQUFBLEdBQVUsSUFBVixDQUFBOztBQUVBO0FBQUEsc0NBRkE7O0FBQUEsMEJBR0EsSUFBQSxHQUFXLElBSFgsQ0FBQTs7QUFBQSwwQkFJQSxRQUFBLEdBQVcsSUFKWCxDQUFBOztBQU1jLEVBQUEsdUJBQUEsR0FBQTtBQUViLG1EQUFBLENBQUE7QUFBQSxtREFBQSxDQUFBO0FBQUEsaURBQUEsQ0FBQTtBQUFBLDZDQUFBLENBQUE7QUFBQSx1REFBQSxDQUFBO0FBQUEsNkNBQUEsQ0FBQTtBQUFBLHVDQUFBLENBQUE7QUFBQSxJQUFBLElBQUMsQ0FBQSxPQUFELEdBQVcsQ0FBQSxDQUFFLE1BQUYsQ0FBWCxDQUFBO0FBQUEsSUFFQSw2Q0FBQSxDQUZBLENBQUE7QUFBQSxJQUlBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxRQUFqQixDQUEwQixJQUExQixDQUpBLENBQUE7QUFBQSxJQUtBLElBQUMsQ0FBQSxZQUFELENBQWMsSUFBZCxDQUxBLENBQUE7QUFBQSxJQU1BLElBQUMsQ0FBQSxTQUFELENBQUEsQ0FOQSxDQUFBO0FBUUEsV0FBTyxJQUFQLENBVmE7RUFBQSxDQU5kOztBQUFBLDBCQWtCQSxJQUFBLEdBQU8sU0FBQSxHQUFBO0FBRU4sSUFBQSxJQUFDLENBQUEsVUFBRCxDQUFZLENBQUEsU0FBQSxLQUFBLEdBQUE7YUFBQSxTQUFBLEdBQUE7ZUFBRyxLQUFDLENBQUEsS0FBRCxDQUFBLENBQVEsQ0FBQyxPQUFPLENBQUMsTUFBakIsQ0FBd0IsS0FBeEIsRUFBSDtNQUFBLEVBQUE7SUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQVosQ0FBQSxDQUFBO1dBRUEsS0FKTTtFQUFBLENBbEJQLENBQUE7O0FBQUEsMEJBd0JBLE9BQUEsR0FBVSxTQUFBLEdBQUE7QUFFVCxJQUFBLElBQUMsQ0FBQSxZQUFELENBQWMsS0FBZCxDQUFBLENBQUE7QUFBQSxJQUNBLElBQUMsQ0FBQSxLQUFELENBQUEsQ0FBUSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsTUFBTyxDQUFBLElBQUMsQ0FBQSxJQUFELENBQU0sQ0FBQyxJQUE1QyxHQUFtRCxJQURuRCxDQUFBO1dBR0EsS0FMUztFQUFBLENBeEJWLENBQUE7O0FBQUEsMEJBK0JBLFlBQUEsR0FBZSxTQUFDLE9BQUQsR0FBQTtBQUVkLElBQUEsSUFBQyxDQUFBLE9BQVEsQ0FBQSxPQUFBLENBQVQsQ0FBa0IsT0FBbEIsRUFBMkIsSUFBQyxDQUFBLE9BQTVCLENBQUEsQ0FBQTtBQUFBLElBQ0EsSUFBQyxDQUFBLENBQUQsQ0FBRyxjQUFILENBQW1CLENBQUEsT0FBQSxDQUFuQixDQUE0QixPQUE1QixFQUFxQyxJQUFDLENBQUEsVUFBdEMsQ0FEQSxDQUFBO1dBR0EsS0FMYztFQUFBLENBL0JmLENBQUE7O0FBQUEsMEJBc0NBLE9BQUEsR0FBVSxTQUFDLENBQUQsR0FBQTtBQUVULElBQUEsSUFBRyxDQUFDLENBQUMsT0FBRixLQUFhLEVBQWhCO0FBQXdCLE1BQUEsSUFBQyxDQUFBLElBQUQsQ0FBQSxDQUFBLENBQXhCO0tBQUE7V0FFQSxLQUpTO0VBQUEsQ0F0Q1YsQ0FBQTs7QUFBQSwwQkE0Q0EsU0FBQSxHQUFZLFNBQUEsR0FBQTtBQUVYLElBQUEsU0FBUyxDQUFDLEVBQVYsQ0FBYSxJQUFDLENBQUEsR0FBZCxFQUFtQixHQUFuQixFQUF3QjtBQUFBLE1BQUUsWUFBQSxFQUFjLFNBQWhCO0FBQUEsTUFBMkIsU0FBQSxFQUFXLENBQXRDO0FBQUEsTUFBeUMsSUFBQSxFQUFPLElBQUksQ0FBQyxPQUFyRDtLQUF4QixDQUFBLENBQUE7QUFBQSxJQUNBLFNBQVMsQ0FBQyxFQUFWLENBQWEsSUFBQyxDQUFBLEdBQUcsQ0FBQyxJQUFMLENBQVUsUUFBVixDQUFiLEVBQWtDLEdBQWxDLEVBQXVDO0FBQUEsTUFBRSxLQUFBLEVBQVEsSUFBVjtBQUFBLE1BQWdCLFdBQUEsRUFBYSxVQUE3QjtBQUFBLE1BQXlDLFlBQUEsRUFBYyxTQUF2RDtBQUFBLE1BQWtFLFNBQUEsRUFBVyxDQUE3RTtBQUFBLE1BQWdGLElBQUEsRUFBTyxJQUFJLENBQUMsT0FBNUY7S0FBdkMsQ0FEQSxDQUFBO1dBR0EsS0FMVztFQUFBLENBNUNaLENBQUE7O0FBQUEsMEJBbURBLFVBQUEsR0FBYSxTQUFDLFFBQUQsR0FBQTtBQUVaLElBQUEsU0FBUyxDQUFDLEVBQVYsQ0FBYSxJQUFDLENBQUEsR0FBZCxFQUFtQixHQUFuQixFQUF3QjtBQUFBLE1BQUUsS0FBQSxFQUFRLElBQVY7QUFBQSxNQUFnQixTQUFBLEVBQVcsQ0FBM0I7QUFBQSxNQUE4QixJQUFBLEVBQU8sSUFBSSxDQUFDLE9BQTFDO0FBQUEsTUFBbUQsVUFBQSxFQUFZLFFBQS9EO0tBQXhCLENBQUEsQ0FBQTtBQUFBLElBQ0EsU0FBUyxDQUFDLEVBQVYsQ0FBYSxJQUFDLENBQUEsR0FBRyxDQUFDLElBQUwsQ0FBVSxRQUFWLENBQWIsRUFBa0MsR0FBbEMsRUFBdUM7QUFBQSxNQUFFLFdBQUEsRUFBYSxZQUFmO0FBQUEsTUFBNkIsU0FBQSxFQUFXLENBQXhDO0FBQUEsTUFBMkMsSUFBQSxFQUFPLElBQUksQ0FBQyxNQUF2RDtLQUF2QyxDQURBLENBQUE7V0FHQSxLQUxZO0VBQUEsQ0FuRGIsQ0FBQTs7QUFBQSwwQkEwREEsVUFBQSxHQUFZLFNBQUUsQ0FBRixHQUFBO0FBRVgsSUFBQSxDQUFDLENBQUMsY0FBRixDQUFBLENBQUEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLElBQUQsQ0FBQSxDQUZBLENBQUE7V0FJQSxLQU5XO0VBQUEsQ0ExRFosQ0FBQTs7dUJBQUE7O0dBRjJCLGFBRjVCLENBQUE7O0FBQUEsTUFzRU0sQ0FBQyxPQUFQLEdBQWlCLGFBdEVqQixDQUFBOzs7OztBQ0FBLElBQUEsK0JBQUE7RUFBQTs7aVNBQUE7O0FBQUEsYUFBQSxHQUFnQixPQUFBLENBQVEsaUJBQVIsQ0FBaEIsQ0FBQTs7QUFBQTtBQUlDLHFDQUFBLENBQUE7O0FBQUEsNkJBQUEsSUFBQSxHQUFXLGtCQUFYLENBQUE7O0FBQUEsNkJBQ0EsUUFBQSxHQUFXLG1CQURYLENBQUE7O0FBQUEsNkJBR0EsRUFBQSxHQUFXLElBSFgsQ0FBQTs7QUFLYyxFQUFBLDBCQUFFLEVBQUYsR0FBQTtBQUViLElBRmMsSUFBQyxDQUFBLEtBQUEsRUFFZixDQUFBO0FBQUEsdURBQUEsQ0FBQTtBQUFBLHVEQUFBLENBQUE7QUFBQSx1Q0FBQSxDQUFBO0FBQUEsdUNBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQyxDQUFBLFlBQUQsR0FBZ0I7QUFBQSxNQUFFLE1BQUQsSUFBQyxDQUFBLElBQUY7S0FBaEIsQ0FBQTtBQUFBLElBRUEsZ0RBQUEsQ0FGQSxDQUFBO0FBSUEsV0FBTyxJQUFQLENBTmE7RUFBQSxDQUxkOztBQUFBLDZCQWFBLElBQUEsR0FBTyxTQUFBLEdBQUE7V0FFTixLQUZNO0VBQUEsQ0FiUCxDQUFBOztBQUFBLDZCQWlCQSxJQUFBLEdBQU8sU0FBQyxjQUFELEdBQUE7O01BQUMsaUJBQWU7S0FFdEI7QUFBQSxJQUFBLElBQUMsQ0FBQSxVQUFELENBQVksQ0FBQSxTQUFBLEtBQUEsR0FBQTthQUFBLFNBQUEsR0FBQTtBQUNYLFFBQUEsS0FBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsT0FBTyxDQUFDLE1BQWpCLENBQXdCLEtBQXhCLENBQUEsQ0FBQTtBQUNBLFFBQUEsSUFBRyxDQUFBLGNBQUg7a0RBQXdCLEtBQUMsQ0FBQSxjQUF6QjtTQUZXO01BQUEsRUFBQTtJQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBWixDQUFBLENBQUE7V0FJQSxLQU5NO0VBQUEsQ0FqQlAsQ0FBQTs7QUFBQSw2QkF5QkEsWUFBQSxHQUFlLFNBQUMsT0FBRCxHQUFBO0FBRWQsSUFBQSxvREFBQSxTQUFBLENBQUEsQ0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLEtBQUQsQ0FBQSxDQUFRLENBQUMsT0FBUSxDQUFBLE9BQUEsQ0FBakIsQ0FBMEIsWUFBMUIsRUFBd0MsSUFBQyxDQUFBLFlBQXpDLENBRkEsQ0FBQTtBQUFBLElBR0EsSUFBQyxDQUFBLEdBQUksQ0FBQSxPQUFBLENBQUwsQ0FBYyxnQkFBZCxFQUFnQyxJQUFDLENBQUEsSUFBakMsQ0FIQSxDQUFBO1dBS0EsS0FQYztFQUFBLENBekJmLENBQUE7O0FBQUEsNkJBa0NBLFlBQUEsR0FBZSxTQUFDLElBQUQsR0FBQTtBQUVkLElBQUEsSUFBRyxJQUFJLENBQUMsQ0FBTCxLQUFVLFVBQWI7QUFBNkIsTUFBQSxJQUFDLENBQUEsSUFBRCxDQUFNLEtBQU4sQ0FBQSxDQUE3QjtLQUFBO1dBRUEsS0FKYztFQUFBLENBbENmLENBQUE7OzBCQUFBOztHQUY4QixjQUYvQixDQUFBOztBQUFBLE1BNENNLENBQUMsT0FBUCxHQUFpQixnQkE1Q2pCLENBQUE7Ozs7O0FDQUEsSUFBQSw0Q0FBQTtFQUFBOztpU0FBQTs7QUFBQSxZQUFBLEdBQW1CLE9BQUEsQ0FBUSxpQkFBUixDQUFuQixDQUFBOztBQUFBLGdCQUNBLEdBQW1CLE9BQUEsQ0FBUSxvQkFBUixDQURuQixDQUFBOztBQUFBO0FBTUMsaUNBQUEsQ0FBQTs7QUFBQSx5QkFBQSxNQUFBLEdBQ0M7QUFBQSxJQUFBLGdCQUFBLEVBQW1CO0FBQUEsTUFBQSxRQUFBLEVBQVcsZ0JBQVg7QUFBQSxNQUE2QixJQUFBLEVBQU8sSUFBcEM7S0FBbkI7R0FERCxDQUFBOztBQUdjLEVBQUEsc0JBQUEsR0FBQTtBQUViLGlEQUFBLENBQUE7QUFBQSx5REFBQSxDQUFBO0FBQUEsMkNBQUEsQ0FBQTtBQUFBLHVDQUFBLENBQUE7QUFBQSxJQUFBLDRDQUFBLENBQUEsQ0FBQTtBQUVBLFdBQU8sSUFBUCxDQUphO0VBQUEsQ0FIZDs7QUFBQSx5QkFTQSxJQUFBLEdBQU8sU0FBQSxHQUFBO1dBRU4sS0FGTTtFQUFBLENBVFAsQ0FBQTs7QUFBQSx5QkFhQSxNQUFBLEdBQVMsU0FBQSxHQUFBO0FBRVIsUUFBQSxpQkFBQTtBQUFBO0FBQUEsU0FBQSxZQUFBO3lCQUFBO0FBQUUsTUFBQSxJQUFHLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBQSxDQUFLLENBQUMsSUFBakI7QUFBMkIsZUFBTyxJQUFQLENBQTNCO09BQUY7QUFBQSxLQUFBO1dBRUEsTUFKUTtFQUFBLENBYlQsQ0FBQTs7QUFBQSx5QkFtQkEsYUFBQSxHQUFnQixTQUFBLEdBQUE7QUFFZixRQUFBLDRCQUFBO0FBQUE7QUFBQSxTQUFBLFlBQUE7eUJBQUE7QUFBRSxNQUFBLElBQUcsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxJQUFqQjtBQUEyQixRQUFBLFNBQUEsR0FBWSxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLElBQTFCLENBQTNCO09BQUY7QUFBQSxLQUFBOztNQUVBLFNBQVMsQ0FBRSxJQUFYLENBQUE7S0FGQTtXQUlBLEtBTmU7RUFBQSxDQW5CaEIsQ0FBQTs7QUFBQSx5QkEyQkEsU0FBQSxHQUFZLFNBQUMsSUFBRCxFQUFPLEVBQVAsR0FBQTs7TUFBTyxLQUFHO0tBRXJCO0FBQUEsSUFBQSxJQUFVLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBQSxDQUFLLENBQUMsSUFBeEI7QUFBQSxZQUFBLENBQUE7S0FBQTtBQUFBLElBRUEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxJQUFkLEdBQXlCLElBQUEsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxRQUFkLENBQXVCLEVBQXZCLENBRnpCLENBQUE7V0FJQSxLQU5XO0VBQUEsQ0EzQlosQ0FBQTs7c0JBQUE7O0dBSDBCLGFBSDNCLENBQUE7O0FBQUEsTUF5Q00sQ0FBQyxPQUFQLEdBQWlCLFlBekNqQixDQUFBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIkFwcCA9IHJlcXVpcmUgJy4vQXBwJ1xuXG4jIFBST0RVQ1RJT04gRU5WSVJPTk1FTlQgLSBtYXkgd2FudCB0byB1c2Ugc2VydmVyLXNldCB2YXJpYWJsZXMgaGVyZVxuIyBJU19MSVZFID0gZG8gLT4gcmV0dXJuIGlmIHdpbmRvdy5sb2NhdGlvbi5ob3N0LmluZGV4T2YoJ2xvY2FsaG9zdCcpID4gLTEgb3Igd2luZG93LmxvY2F0aW9uLnNlYXJjaCBpcyAnP2QnIHRoZW4gZmFsc2UgZWxzZSB0cnVlXG5cbiMjI1xuXG5XSVAgLSB0aGlzIHdpbGwgaWRlYWxseSBjaGFuZ2UgdG8gb2xkIGZvcm1hdCAoYWJvdmUpIHdoZW4gY2FuIGZpZ3VyZSBpdCBvdXRcblxuIyMjXG5cbklTX0xJVkUgPSBmYWxzZVxuXG4jIE9OTFkgRVhQT1NFIEFQUCBHTE9CQUxMWSBJRiBMT0NBTCBPUiBERVYnSU5HXG52aWV3ID0gaWYgSVNfTElWRSB0aGVuIHt9IGVsc2UgKHdpbmRvdyBvciBkb2N1bWVudClcblxuIyBERUNMQVJFIE1BSU4gQVBQTElDQVRJT05cbnZpZXcuQ0RfQ0UgPSBuZXcgQXBwIElTX0xJVkVcbnZpZXcuQ0RfQ0UuaW5pdCgpXG4iLCIvKiEgaHR0cDovL210aHMuYmUvcHVueWNvZGUgdjEuMi40IGJ5IEBtYXRoaWFzICovXG47KGZ1bmN0aW9uKHJvb3QpIHtcblxuXHQvKiogRGV0ZWN0IGZyZWUgdmFyaWFibGVzICovXG5cdHZhciBmcmVlRXhwb3J0cyA9IHR5cGVvZiBleHBvcnRzID09ICdvYmplY3QnICYmIGV4cG9ydHM7XG5cdHZhciBmcmVlTW9kdWxlID0gdHlwZW9mIG1vZHVsZSA9PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiZcblx0XHRtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cyAmJiBtb2R1bGU7XG5cdHZhciBmcmVlR2xvYmFsID0gdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWw7XG5cdGlmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCkge1xuXHRcdHJvb3QgPSBmcmVlR2xvYmFsO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBgcHVueWNvZGVgIG9iamVjdC5cblx0ICogQG5hbWUgcHVueWNvZGVcblx0ICogQHR5cGUgT2JqZWN0XG5cdCAqL1xuXHR2YXIgcHVueWNvZGUsXG5cblx0LyoqIEhpZ2hlc3QgcG9zaXRpdmUgc2lnbmVkIDMyLWJpdCBmbG9hdCB2YWx1ZSAqL1xuXHRtYXhJbnQgPSAyMTQ3NDgzNjQ3LCAvLyBha2EuIDB4N0ZGRkZGRkYgb3IgMl4zMS0xXG5cblx0LyoqIEJvb3RzdHJpbmcgcGFyYW1ldGVycyAqL1xuXHRiYXNlID0gMzYsXG5cdHRNaW4gPSAxLFxuXHR0TWF4ID0gMjYsXG5cdHNrZXcgPSAzOCxcblx0ZGFtcCA9IDcwMCxcblx0aW5pdGlhbEJpYXMgPSA3Mixcblx0aW5pdGlhbE4gPSAxMjgsIC8vIDB4ODBcblx0ZGVsaW1pdGVyID0gJy0nLCAvLyAnXFx4MkQnXG5cblx0LyoqIFJlZ3VsYXIgZXhwcmVzc2lvbnMgKi9cblx0cmVnZXhQdW55Y29kZSA9IC9eeG4tLS8sXG5cdHJlZ2V4Tm9uQVNDSUkgPSAvW14gLX5dLywgLy8gdW5wcmludGFibGUgQVNDSUkgY2hhcnMgKyBub24tQVNDSUkgY2hhcnNcblx0cmVnZXhTZXBhcmF0b3JzID0gL1xceDJFfFxcdTMwMDJ8XFx1RkYwRXxcXHVGRjYxL2csIC8vIFJGQyAzNDkwIHNlcGFyYXRvcnNcblxuXHQvKiogRXJyb3IgbWVzc2FnZXMgKi9cblx0ZXJyb3JzID0ge1xuXHRcdCdvdmVyZmxvdyc6ICdPdmVyZmxvdzogaW5wdXQgbmVlZHMgd2lkZXIgaW50ZWdlcnMgdG8gcHJvY2VzcycsXG5cdFx0J25vdC1iYXNpYyc6ICdJbGxlZ2FsIGlucHV0ID49IDB4ODAgKG5vdCBhIGJhc2ljIGNvZGUgcG9pbnQpJyxcblx0XHQnaW52YWxpZC1pbnB1dCc6ICdJbnZhbGlkIGlucHV0J1xuXHR9LFxuXG5cdC8qKiBDb252ZW5pZW5jZSBzaG9ydGN1dHMgKi9cblx0YmFzZU1pbnVzVE1pbiA9IGJhc2UgLSB0TWluLFxuXHRmbG9vciA9IE1hdGguZmxvb3IsXG5cdHN0cmluZ0Zyb21DaGFyQ29kZSA9IFN0cmluZy5mcm9tQ2hhckNvZGUsXG5cblx0LyoqIFRlbXBvcmFyeSB2YXJpYWJsZSAqL1xuXHRrZXk7XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBlcnJvciB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gdHlwZSBUaGUgZXJyb3IgdHlwZS5cblx0ICogQHJldHVybnMge0Vycm9yfSBUaHJvd3MgYSBgUmFuZ2VFcnJvcmAgd2l0aCB0aGUgYXBwbGljYWJsZSBlcnJvciBtZXNzYWdlLlxuXHQgKi9cblx0ZnVuY3Rpb24gZXJyb3IodHlwZSkge1xuXHRcdHRocm93IFJhbmdlRXJyb3IoZXJyb3JzW3R5cGVdKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIGdlbmVyaWMgYEFycmF5I21hcGAgdXRpbGl0eSBmdW5jdGlvbi5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGl0ZXJhdGUgb3Zlci5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5IGFycmF5XG5cdCAqIGl0ZW0uXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gQSBuZXcgYXJyYXkgb2YgdmFsdWVzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcChhcnJheSwgZm4pIHtcblx0XHR2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXHRcdHdoaWxlIChsZW5ndGgtLSkge1xuXHRcdFx0YXJyYXlbbGVuZ3RoXSA9IGZuKGFycmF5W2xlbmd0aF0pO1xuXHRcdH1cblx0XHRyZXR1cm4gYXJyYXk7XG5cdH1cblxuXHQvKipcblx0ICogQSBzaW1wbGUgYEFycmF5I21hcGAtbGlrZSB3cmFwcGVyIHRvIHdvcmsgd2l0aCBkb21haW4gbmFtZSBzdHJpbmdzLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBkb21haW4gbmFtZS5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRoYXQgZ2V0cyBjYWxsZWQgZm9yIGV2ZXJ5XG5cdCAqIGNoYXJhY3Rlci5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBzdHJpbmcgb2YgY2hhcmFjdGVycyByZXR1cm5lZCBieSB0aGUgY2FsbGJhY2tcblx0ICogZnVuY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXBEb21haW4oc3RyaW5nLCBmbikge1xuXHRcdHJldHVybiBtYXAoc3RyaW5nLnNwbGl0KHJlZ2V4U2VwYXJhdG9ycyksIGZuKS5qb2luKCcuJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhbiBhcnJheSBjb250YWluaW5nIHRoZSBudW1lcmljIGNvZGUgcG9pbnRzIG9mIGVhY2ggVW5pY29kZVxuXHQgKiBjaGFyYWN0ZXIgaW4gdGhlIHN0cmluZy4gV2hpbGUgSmF2YVNjcmlwdCB1c2VzIFVDUy0yIGludGVybmFsbHksXG5cdCAqIHRoaXMgZnVuY3Rpb24gd2lsbCBjb252ZXJ0IGEgcGFpciBvZiBzdXJyb2dhdGUgaGFsdmVzIChlYWNoIG9mIHdoaWNoXG5cdCAqIFVDUy0yIGV4cG9zZXMgYXMgc2VwYXJhdGUgY2hhcmFjdGVycykgaW50byBhIHNpbmdsZSBjb2RlIHBvaW50LFxuXHQgKiBtYXRjaGluZyBVVEYtMTYuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZW5jb2RlYFxuXHQgKiBAc2VlIDxodHRwOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBkZWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZyBUaGUgVW5pY29kZSBpbnB1dCBzdHJpbmcgKFVDUy0yKS5cblx0ICogQHJldHVybnMge0FycmF5fSBUaGUgbmV3IGFycmF5IG9mIGNvZGUgcG9pbnRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmRlY29kZShzdHJpbmcpIHtcblx0XHR2YXIgb3V0cHV0ID0gW10sXG5cdFx0ICAgIGNvdW50ZXIgPSAwLFxuXHRcdCAgICBsZW5ndGggPSBzdHJpbmcubGVuZ3RoLFxuXHRcdCAgICB2YWx1ZSxcblx0XHQgICAgZXh0cmE7XG5cdFx0d2hpbGUgKGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdHZhbHVlID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdGlmICh2YWx1ZSA+PSAweEQ4MDAgJiYgdmFsdWUgPD0gMHhEQkZGICYmIGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdFx0Ly8gaGlnaCBzdXJyb2dhdGUsIGFuZCB0aGVyZSBpcyBhIG5leHQgY2hhcmFjdGVyXG5cdFx0XHRcdGV4dHJhID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdFx0aWYgKChleHRyYSAmIDB4RkMwMCkgPT0gMHhEQzAwKSB7IC8vIGxvdyBzdXJyb2dhdGVcblx0XHRcdFx0XHRvdXRwdXQucHVzaCgoKHZhbHVlICYgMHgzRkYpIDw8IDEwKSArIChleHRyYSAmIDB4M0ZGKSArIDB4MTAwMDApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHVubWF0Y2hlZCBzdXJyb2dhdGU7IG9ubHkgYXBwZW5kIHRoaXMgY29kZSB1bml0LCBpbiBjYXNlIHRoZSBuZXh0XG5cdFx0XHRcdFx0Ly8gY29kZSB1bml0IGlzIHRoZSBoaWdoIHN1cnJvZ2F0ZSBvZiBhIHN1cnJvZ2F0ZSBwYWlyXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0XHRcdGNvdW50ZXItLTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBzdHJpbmcgYmFzZWQgb24gYW4gYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5kZWNvZGVgXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGVuY29kZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2RlUG9pbnRzIFRoZSBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgbmV3IFVuaWNvZGUgc3RyaW5nIChVQ1MtMikuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZW5jb2RlKGFycmF5KSB7XG5cdFx0cmV0dXJuIG1hcChhcnJheSwgZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdHZhciBvdXRwdXQgPSAnJztcblx0XHRcdGlmICh2YWx1ZSA+IDB4RkZGRikge1xuXHRcdFx0XHR2YWx1ZSAtPSAweDEwMDAwO1xuXHRcdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKTtcblx0XHRcdFx0dmFsdWUgPSAweERDMDAgfCB2YWx1ZSAmIDB4M0ZGO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSk7XG5cdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgYmFzaWMgY29kZSBwb2ludCBpbnRvIGEgZGlnaXQvaW50ZWdlci5cblx0ICogQHNlZSBgZGlnaXRUb0Jhc2ljKClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb2RlUG9pbnQgVGhlIGJhc2ljIG51bWVyaWMgY29kZSBwb2ludCB2YWx1ZS5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50IChmb3IgdXNlIGluXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaW4gdGhlIHJhbmdlIGAwYCB0byBgYmFzZSAtIDFgLCBvciBgYmFzZWAgaWZcblx0ICogdGhlIGNvZGUgcG9pbnQgZG9lcyBub3QgcmVwcmVzZW50IGEgdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBiYXNpY1RvRGlnaXQoY29kZVBvaW50KSB7XG5cdFx0aWYgKGNvZGVQb2ludCAtIDQ4IDwgMTApIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSAyMjtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDY1IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA2NTtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDk3IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA5Nztcblx0XHR9XG5cdFx0cmV0dXJuIGJhc2U7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBkaWdpdC9pbnRlZ2VyIGludG8gYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAc2VlIGBiYXNpY1RvRGlnaXQoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRpZ2l0IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIGJhc2ljIGNvZGUgcG9pbnQgd2hvc2UgdmFsdWUgKHdoZW4gdXNlZCBmb3Jcblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpcyBgZGlnaXRgLCB3aGljaCBuZWVkcyB0byBiZSBpbiB0aGUgcmFuZ2Vcblx0ICogYDBgIHRvIGBiYXNlIC0gMWAuIElmIGBmbGFnYCBpcyBub24temVybywgdGhlIHVwcGVyY2FzZSBmb3JtIGlzXG5cdCAqIHVzZWQ7IGVsc2UsIHRoZSBsb3dlcmNhc2UgZm9ybSBpcyB1c2VkLiBUaGUgYmVoYXZpb3IgaXMgdW5kZWZpbmVkXG5cdCAqIGlmIGBmbGFnYCBpcyBub24temVybyBhbmQgYGRpZ2l0YCBoYXMgbm8gdXBwZXJjYXNlIGZvcm0uXG5cdCAqL1xuXHRmdW5jdGlvbiBkaWdpdFRvQmFzaWMoZGlnaXQsIGZsYWcpIHtcblx0XHQvLyAgMC4uMjUgbWFwIHRvIEFTQ0lJIGEuLnogb3IgQS4uWlxuXHRcdC8vIDI2Li4zNSBtYXAgdG8gQVNDSUkgMC4uOVxuXHRcdHJldHVybiBkaWdpdCArIDIyICsgNzUgKiAoZGlnaXQgPCAyNikgLSAoKGZsYWcgIT0gMCkgPDwgNSk7XG5cdH1cblxuXHQvKipcblx0ICogQmlhcyBhZGFwdGF0aW9uIGZ1bmN0aW9uIGFzIHBlciBzZWN0aW9uIDMuNCBvZiBSRkMgMzQ5Mi5cblx0ICogaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzQ5MiNzZWN0aW9uLTMuNFxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0ZnVuY3Rpb24gYWRhcHQoZGVsdGEsIG51bVBvaW50cywgZmlyc3RUaW1lKSB7XG5cdFx0dmFyIGsgPSAwO1xuXHRcdGRlbHRhID0gZmlyc3RUaW1lID8gZmxvb3IoZGVsdGEgLyBkYW1wKSA6IGRlbHRhID4+IDE7XG5cdFx0ZGVsdGEgKz0gZmxvb3IoZGVsdGEgLyBudW1Qb2ludHMpO1xuXHRcdGZvciAoLyogbm8gaW5pdGlhbGl6YXRpb24gKi87IGRlbHRhID4gYmFzZU1pbnVzVE1pbiAqIHRNYXggPj4gMTsgayArPSBiYXNlKSB7XG5cdFx0XHRkZWx0YSA9IGZsb29yKGRlbHRhIC8gYmFzZU1pbnVzVE1pbik7XG5cdFx0fVxuXHRcdHJldHVybiBmbG9vcihrICsgKGJhc2VNaW51c1RNaW4gKyAxKSAqIGRlbHRhIC8gKGRlbHRhICsgc2tldykpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scyB0byBhIHN0cmluZyBvZiBVbmljb2RlXG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGRlY29kZShpbnB1dCkge1xuXHRcdC8vIERvbid0IHVzZSBVQ1MtMlxuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgaW5wdXRMZW5ndGggPSBpbnB1dC5sZW5ndGgsXG5cdFx0ICAgIG91dCxcblx0XHQgICAgaSA9IDAsXG5cdFx0ICAgIG4gPSBpbml0aWFsTixcblx0XHQgICAgYmlhcyA9IGluaXRpYWxCaWFzLFxuXHRcdCAgICBiYXNpYyxcblx0XHQgICAgaixcblx0XHQgICAgaW5kZXgsXG5cdFx0ICAgIG9sZGksXG5cdFx0ICAgIHcsXG5cdFx0ICAgIGssXG5cdFx0ICAgIGRpZ2l0LFxuXHRcdCAgICB0LFxuXHRcdCAgICAvKiogQ2FjaGVkIGNhbGN1bGF0aW9uIHJlc3VsdHMgKi9cblx0XHQgICAgYmFzZU1pbnVzVDtcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHM6IGxldCBgYmFzaWNgIGJlIHRoZSBudW1iZXIgb2YgaW5wdXQgY29kZVxuXHRcdC8vIHBvaW50cyBiZWZvcmUgdGhlIGxhc3QgZGVsaW1pdGVyLCBvciBgMGAgaWYgdGhlcmUgaXMgbm9uZSwgdGhlbiBjb3B5XG5cdFx0Ly8gdGhlIGZpcnN0IGJhc2ljIGNvZGUgcG9pbnRzIHRvIHRoZSBvdXRwdXQuXG5cblx0XHRiYXNpYyA9IGlucHV0Lmxhc3RJbmRleE9mKGRlbGltaXRlcik7XG5cdFx0aWYgKGJhc2ljIDwgMCkge1xuXHRcdFx0YmFzaWMgPSAwO1xuXHRcdH1cblxuXHRcdGZvciAoaiA9IDA7IGogPCBiYXNpYzsgKytqKSB7XG5cdFx0XHQvLyBpZiBpdCdzIG5vdCBhIGJhc2ljIGNvZGUgcG9pbnRcblx0XHRcdGlmIChpbnB1dC5jaGFyQ29kZUF0KGopID49IDB4ODApIHtcblx0XHRcdFx0ZXJyb3IoJ25vdC1iYXNpYycpO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0LnB1c2goaW5wdXQuY2hhckNvZGVBdChqKSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBkZWNvZGluZyBsb29wOiBzdGFydCBqdXN0IGFmdGVyIHRoZSBsYXN0IGRlbGltaXRlciBpZiBhbnkgYmFzaWMgY29kZVxuXHRcdC8vIHBvaW50cyB3ZXJlIGNvcGllZDsgc3RhcnQgYXQgdGhlIGJlZ2lubmluZyBvdGhlcndpc2UuXG5cblx0XHRmb3IgKGluZGV4ID0gYmFzaWMgPiAwID8gYmFzaWMgKyAxIDogMDsgaW5kZXggPCBpbnB1dExlbmd0aDsgLyogbm8gZmluYWwgZXhwcmVzc2lvbiAqLykge1xuXG5cdFx0XHQvLyBgaW5kZXhgIGlzIHRoZSBpbmRleCBvZiB0aGUgbmV4dCBjaGFyYWN0ZXIgdG8gYmUgY29uc3VtZWQuXG5cdFx0XHQvLyBEZWNvZGUgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlciBpbnRvIGBkZWx0YWAsXG5cdFx0XHQvLyB3aGljaCBnZXRzIGFkZGVkIHRvIGBpYC4gVGhlIG92ZXJmbG93IGNoZWNraW5nIGlzIGVhc2llclxuXHRcdFx0Ly8gaWYgd2UgaW5jcmVhc2UgYGlgIGFzIHdlIGdvLCB0aGVuIHN1YnRyYWN0IG9mZiBpdHMgc3RhcnRpbmdcblx0XHRcdC8vIHZhbHVlIGF0IHRoZSBlbmQgdG8gb2J0YWluIGBkZWx0YWAuXG5cdFx0XHRmb3IgKG9sZGkgPSBpLCB3ID0gMSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cblx0XHRcdFx0aWYgKGluZGV4ID49IGlucHV0TGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ2ludmFsaWQtaW5wdXQnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRpZ2l0ID0gYmFzaWNUb0RpZ2l0KGlucHV0LmNoYXJDb2RlQXQoaW5kZXgrKykpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA+PSBiYXNlIHx8IGRpZ2l0ID4gZmxvb3IoKG1heEludCAtIGkpIC8gdykpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGkgKz0gZGlnaXQgKiB3O1xuXHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblxuXHRcdFx0XHRpZiAoZGlnaXQgPCB0KSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiYXNlTWludXNUID0gYmFzZSAtIHQ7XG5cdFx0XHRcdGlmICh3ID4gZmxvb3IobWF4SW50IC8gYmFzZU1pbnVzVCkpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHcgKj0gYmFzZU1pbnVzVDtcblxuXHRcdFx0fVxuXG5cdFx0XHRvdXQgPSBvdXRwdXQubGVuZ3RoICsgMTtcblx0XHRcdGJpYXMgPSBhZGFwdChpIC0gb2xkaSwgb3V0LCBvbGRpID09IDApO1xuXG5cdFx0XHQvLyBgaWAgd2FzIHN1cHBvc2VkIHRvIHdyYXAgYXJvdW5kIGZyb20gYG91dGAgdG8gYDBgLFxuXHRcdFx0Ly8gaW5jcmVtZW50aW5nIGBuYCBlYWNoIHRpbWUsIHNvIHdlJ2xsIGZpeCB0aGF0IG5vdzpcblx0XHRcdGlmIChmbG9vcihpIC8gb3V0KSA+IG1heEludCAtIG4pIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdG4gKz0gZmxvb3IoaSAvIG91dCk7XG5cdFx0XHRpICU9IG91dDtcblxuXHRcdFx0Ly8gSW5zZXJ0IGBuYCBhdCBwb3NpdGlvbiBgaWAgb2YgdGhlIG91dHB1dFxuXHRcdFx0b3V0cHV0LnNwbGljZShpKyssIDAsIG4pO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVjczJlbmNvZGUob3V0cHV0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMgdG8gYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seVxuXHQgKiBzeW1ib2xzLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzdWx0aW5nIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBlbmNvZGUoaW5wdXQpIHtcblx0XHR2YXIgbixcblx0XHQgICAgZGVsdGEsXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50LFxuXHRcdCAgICBiYXNpY0xlbmd0aCxcblx0XHQgICAgYmlhcyxcblx0XHQgICAgaixcblx0XHQgICAgbSxcblx0XHQgICAgcSxcblx0XHQgICAgayxcblx0XHQgICAgdCxcblx0XHQgICAgY3VycmVudFZhbHVlLFxuXHRcdCAgICBvdXRwdXQgPSBbXSxcblx0XHQgICAgLyoqIGBpbnB1dExlbmd0aGAgd2lsbCBob2xkIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgaW4gYGlucHV0YC4gKi9cblx0XHQgICAgaW5wdXRMZW5ndGgsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsXG5cdFx0ICAgIGJhc2VNaW51c1QsXG5cdFx0ICAgIHFNaW51c1Q7XG5cblx0XHQvLyBDb252ZXJ0IHRoZSBpbnB1dCBpbiBVQ1MtMiB0byBVbmljb2RlXG5cdFx0aW5wdXQgPSB1Y3MyZGVjb2RlKGlucHV0KTtcblxuXHRcdC8vIENhY2hlIHRoZSBsZW5ndGhcblx0XHRpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aDtcblxuXHRcdC8vIEluaXRpYWxpemUgdGhlIHN0YXRlXG5cdFx0biA9IGluaXRpYWxOO1xuXHRcdGRlbHRhID0gMDtcblx0XHRiaWFzID0gaW5pdGlhbEJpYXM7XG5cblx0XHQvLyBIYW5kbGUgdGhlIGJhc2ljIGNvZGUgcG9pbnRzXG5cdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IDB4ODApIHtcblx0XHRcdFx0b3V0cHV0LnB1c2goc3RyaW5nRnJvbUNoYXJDb2RlKGN1cnJlbnRWYWx1ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGhhbmRsZWRDUENvdW50ID0gYmFzaWNMZW5ndGggPSBvdXRwdXQubGVuZ3RoO1xuXG5cdFx0Ly8gYGhhbmRsZWRDUENvdW50YCBpcyB0aGUgbnVtYmVyIG9mIGNvZGUgcG9pbnRzIHRoYXQgaGF2ZSBiZWVuIGhhbmRsZWQ7XG5cdFx0Ly8gYGJhc2ljTGVuZ3RoYCBpcyB0aGUgbnVtYmVyIG9mIGJhc2ljIGNvZGUgcG9pbnRzLlxuXG5cdFx0Ly8gRmluaXNoIHRoZSBiYXNpYyBzdHJpbmcgLSBpZiBpdCBpcyBub3QgZW1wdHkgLSB3aXRoIGEgZGVsaW1pdGVyXG5cdFx0aWYgKGJhc2ljTGVuZ3RoKSB7XG5cdFx0XHRvdXRwdXQucHVzaChkZWxpbWl0ZXIpO1xuXHRcdH1cblxuXHRcdC8vIE1haW4gZW5jb2RpbmcgbG9vcDpcblx0XHR3aGlsZSAoaGFuZGxlZENQQ291bnQgPCBpbnB1dExlbmd0aCkge1xuXG5cdFx0XHQvLyBBbGwgbm9uLWJhc2ljIGNvZGUgcG9pbnRzIDwgbiBoYXZlIGJlZW4gaGFuZGxlZCBhbHJlYWR5LiBGaW5kIHRoZSBuZXh0XG5cdFx0XHQvLyBsYXJnZXIgb25lOlxuXHRcdFx0Zm9yIChtID0gbWF4SW50LCBqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPj0gbiAmJiBjdXJyZW50VmFsdWUgPCBtKSB7XG5cdFx0XHRcdFx0bSA9IGN1cnJlbnRWYWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbmNyZWFzZSBgZGVsdGFgIGVub3VnaCB0byBhZHZhbmNlIHRoZSBkZWNvZGVyJ3MgPG4saT4gc3RhdGUgdG8gPG0sMD4sXG5cdFx0XHQvLyBidXQgZ3VhcmQgYWdhaW5zdCBvdmVyZmxvd1xuXHRcdFx0aGFuZGxlZENQQ291bnRQbHVzT25lID0gaGFuZGxlZENQQ291bnQgKyAxO1xuXHRcdFx0aWYgKG0gLSBuID4gZmxvb3IoKG1heEludCAtIGRlbHRhKSAvIGhhbmRsZWRDUENvdW50UGx1c09uZSkpIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGRlbHRhICs9IChtIC0gbikgKiBoYW5kbGVkQ1BDb3VudFBsdXNPbmU7XG5cdFx0XHRuID0gbTtcblxuXHRcdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IG4gJiYgKytkZWx0YSA+IG1heEludCkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA9PSBuKSB7XG5cdFx0XHRcdFx0Ly8gUmVwcmVzZW50IGRlbHRhIGFzIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXJcblx0XHRcdFx0XHRmb3IgKHEgPSBkZWx0YSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cdFx0XHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblx0XHRcdFx0XHRcdGlmIChxIDwgdCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHFNaW51c1QgPSBxIC0gdDtcblx0XHRcdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKFxuXHRcdFx0XHRcdFx0XHRzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHQgKyBxTWludXNUICUgYmFzZU1pbnVzVCwgMCkpXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0cSA9IGZsb29yKHFNaW51c1QgLyBiYXNlTWludXNUKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHEsIDApKSk7XG5cdFx0XHRcdFx0YmlhcyA9IGFkYXB0KGRlbHRhLCBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsIGhhbmRsZWRDUENvdW50ID09IGJhc2ljTGVuZ3RoKTtcblx0XHRcdFx0XHRkZWx0YSA9IDA7XG5cdFx0XHRcdFx0KytoYW5kbGVkQ1BDb3VudDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQrK2RlbHRhO1xuXHRcdFx0KytuO1xuXG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgdG8gVW5pY29kZS4gT25seSB0aGVcblx0ICogUHVueWNvZGVkIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB3aWxsIGJlIGNvbnZlcnRlZCwgaS5lLiBpdCBkb2Vzbid0XG5cdCAqIG1hdHRlciBpZiB5b3UgY2FsbCBpdCBvbiBhIHN0cmluZyB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gY29udmVydGVkIHRvXG5cdCAqIFVuaWNvZGUuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBQdW55Y29kZSBkb21haW4gbmFtZSB0byBjb252ZXJ0IHRvIFVuaWNvZGUuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBVbmljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBQdW55Y29kZVxuXHQgKiBzdHJpbmcuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b1VuaWNvZGUoZG9tYWluKSB7XG5cdFx0cmV0dXJuIG1hcERvbWFpbihkb21haW4sIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHJlZ2V4UHVueWNvZGUudGVzdChzdHJpbmcpXG5cdFx0XHRcdD8gZGVjb2RlKHN0cmluZy5zbGljZSg0KS50b0xvd2VyQ2FzZSgpKVxuXHRcdFx0XHQ6IHN0cmluZztcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFVuaWNvZGUgc3RyaW5nIHJlcHJlc2VudGluZyBhIGRvbWFpbiBuYW1lIHRvIFB1bnljb2RlLiBPbmx5IHRoZVxuXHQgKiBub24tQVNDSUkgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLCBpLmUuIGl0IGRvZXNuJ3Rcblx0ICogbWF0dGVyIGlmIHlvdSBjYWxsIGl0IHdpdGggYSBkb21haW4gdGhhdCdzIGFscmVhZHkgaW4gQVNDSUkuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBkb21haW4gbmFtZSB0byBjb252ZXJ0LCBhcyBhIFVuaWNvZGUgc3RyaW5nLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgUHVueWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIGRvbWFpbiBuYW1lLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9BU0NJSShkb21haW4pIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGRvbWFpbiwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhOb25BU0NJSS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyAneG4tLScgKyBlbmNvZGUoc3RyaW5nKVxuXHRcdFx0XHQ6IHN0cmluZztcblx0XHR9KTtcblx0fVxuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdC8qKiBEZWZpbmUgdGhlIHB1YmxpYyBBUEkgKi9cblx0cHVueWNvZGUgPSB7XG5cdFx0LyoqXG5cdFx0ICogQSBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBjdXJyZW50IFB1bnljb2RlLmpzIHZlcnNpb24gbnVtYmVyLlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIFN0cmluZ1xuXHRcdCAqL1xuXHRcdCd2ZXJzaW9uJzogJzEuMi40Jyxcblx0XHQvKipcblx0XHQgKiBBbiBvYmplY3Qgb2YgbWV0aG9kcyB0byBjb252ZXJ0IGZyb20gSmF2YVNjcmlwdCdzIGludGVybmFsIGNoYXJhY3RlclxuXHRcdCAqIHJlcHJlc2VudGF0aW9uIChVQ1MtMikgdG8gVW5pY29kZSBjb2RlIHBvaW50cywgYW5kIGJhY2suXG5cdFx0ICogQHNlZSA8aHR0cDovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBPYmplY3Rcblx0XHQgKi9cblx0XHQndWNzMic6IHtcblx0XHRcdCdkZWNvZGUnOiB1Y3MyZGVjb2RlLFxuXHRcdFx0J2VuY29kZSc6IHVjczJlbmNvZGVcblx0XHR9LFxuXHRcdCdkZWNvZGUnOiBkZWNvZGUsXG5cdFx0J2VuY29kZSc6IGVuY29kZSxcblx0XHQndG9BU0NJSSc6IHRvQVNDSUksXG5cdFx0J3RvVW5pY29kZSc6IHRvVW5pY29kZVxuXHR9O1xuXG5cdC8qKiBFeHBvc2UgYHB1bnljb2RlYCAqL1xuXHQvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzLCBsaWtlIHIuanMsIGNoZWNrIGZvciBzcGVjaWZpYyBjb25kaXRpb24gcGF0dGVybnNcblx0Ly8gbGlrZSB0aGUgZm9sbG93aW5nOlxuXHRpZiAoXG5cdFx0dHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmXG5cdFx0dHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiZcblx0XHRkZWZpbmUuYW1kXG5cdCkge1xuXHRcdGRlZmluZSgncHVueWNvZGUnLCBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBwdW55Y29kZTtcblx0XHR9KTtcblx0fSBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiAhZnJlZUV4cG9ydHMubm9kZVR5cGUpIHtcblx0XHRpZiAoZnJlZU1vZHVsZSkgeyAvLyBpbiBOb2RlLmpzIG9yIFJpbmdvSlMgdjAuOC4wK1xuXHRcdFx0ZnJlZU1vZHVsZS5leHBvcnRzID0gcHVueWNvZGU7XG5cdFx0fSBlbHNlIHsgLy8gaW4gTmFyd2hhbCBvciBSaW5nb0pTIHYwLjcuMC1cblx0XHRcdGZvciAoa2V5IGluIHB1bnljb2RlKSB7XG5cdFx0XHRcdHB1bnljb2RlLmhhc093blByb3BlcnR5KGtleSkgJiYgKGZyZWVFeHBvcnRzW2tleV0gPSBwdW55Y29kZVtrZXldKTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7IC8vIGluIFJoaW5vIG9yIGEgd2ViIGJyb3dzZXJcblx0XHRyb290LnB1bnljb2RlID0gcHVueWNvZGU7XG5cdH1cblxufSh0aGlzKSk7XG4iLCJ2YXIgcHVueWNvZGUgPSByZXF1aXJlKCdwdW55Y29kZScpO1xudmFyIHJldkVudGl0aWVzID0gcmVxdWlyZSgnLi9yZXZlcnNlZC5qc29uJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZW5jb2RlO1xuXG5mdW5jdGlvbiBlbmNvZGUgKHN0ciwgb3B0cykge1xuICAgIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBhIFN0cmluZycpO1xuICAgIH1cbiAgICBpZiAoIW9wdHMpIG9wdHMgPSB7fTtcblxuICAgIHZhciBudW1lcmljID0gdHJ1ZTtcbiAgICBpZiAob3B0cy5uYW1lZCkgbnVtZXJpYyA9IGZhbHNlO1xuICAgIGlmIChvcHRzLm51bWVyaWMgIT09IHVuZGVmaW5lZCkgbnVtZXJpYyA9IG9wdHMubnVtZXJpYztcblxuICAgIHZhciBzcGVjaWFsID0gb3B0cy5zcGVjaWFsIHx8IHtcbiAgICAgICAgJ1wiJzogdHJ1ZSwgXCInXCI6IHRydWUsXG4gICAgICAgICc8JzogdHJ1ZSwgJz4nOiB0cnVlLFxuICAgICAgICAnJic6IHRydWVcbiAgICB9O1xuXG4gICAgdmFyIGNvZGVQb2ludHMgPSBwdW55Y29kZS51Y3MyLmRlY29kZShzdHIpO1xuICAgIHZhciBjaGFycyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29kZVBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2MgPSBjb2RlUG9pbnRzW2ldO1xuICAgICAgICB2YXIgYyA9IHB1bnljb2RlLnVjczIuZW5jb2RlKFsgY2MgXSk7XG4gICAgICAgIHZhciBlID0gcmV2RW50aXRpZXNbY2NdO1xuICAgICAgICBpZiAoZSAmJiAoY2MgPj0gMTI3IHx8IHNwZWNpYWxbY10pICYmICFudW1lcmljKSB7XG4gICAgICAgICAgICBjaGFycy5wdXNoKCcmJyArICgvOyQvLnRlc3QoZSkgPyBlIDogZSArICc7JykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGNjIDwgMzIgfHwgY2MgPj0gMTI3IHx8IHNwZWNpYWxbY10pIHtcbiAgICAgICAgICAgIGNoYXJzLnB1c2goJyYjJyArIGNjICsgJzsnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNoYXJzLnB1c2goYyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNoYXJzLmpvaW4oJycpO1xufVxuIiwibW9kdWxlLmV4cG9ydHM9e1xuICAgIFwiOVwiOiBcIlRhYjtcIixcbiAgICBcIjEwXCI6IFwiTmV3TGluZTtcIixcbiAgICBcIjMzXCI6IFwiZXhjbDtcIixcbiAgICBcIjM0XCI6IFwicXVvdDtcIixcbiAgICBcIjM1XCI6IFwibnVtO1wiLFxuICAgIFwiMzZcIjogXCJkb2xsYXI7XCIsXG4gICAgXCIzN1wiOiBcInBlcmNudDtcIixcbiAgICBcIjM4XCI6IFwiYW1wO1wiLFxuICAgIFwiMzlcIjogXCJhcG9zO1wiLFxuICAgIFwiNDBcIjogXCJscGFyO1wiLFxuICAgIFwiNDFcIjogXCJycGFyO1wiLFxuICAgIFwiNDJcIjogXCJtaWRhc3Q7XCIsXG4gICAgXCI0M1wiOiBcInBsdXM7XCIsXG4gICAgXCI0NFwiOiBcImNvbW1hO1wiLFxuICAgIFwiNDZcIjogXCJwZXJpb2Q7XCIsXG4gICAgXCI0N1wiOiBcInNvbDtcIixcbiAgICBcIjU4XCI6IFwiY29sb247XCIsXG4gICAgXCI1OVwiOiBcInNlbWk7XCIsXG4gICAgXCI2MFwiOiBcImx0O1wiLFxuICAgIFwiNjFcIjogXCJlcXVhbHM7XCIsXG4gICAgXCI2MlwiOiBcImd0O1wiLFxuICAgIFwiNjNcIjogXCJxdWVzdDtcIixcbiAgICBcIjY0XCI6IFwiY29tbWF0O1wiLFxuICAgIFwiOTFcIjogXCJsc3FiO1wiLFxuICAgIFwiOTJcIjogXCJic29sO1wiLFxuICAgIFwiOTNcIjogXCJyc3FiO1wiLFxuICAgIFwiOTRcIjogXCJIYXQ7XCIsXG4gICAgXCI5NVwiOiBcIlVuZGVyQmFyO1wiLFxuICAgIFwiOTZcIjogXCJncmF2ZTtcIixcbiAgICBcIjEyM1wiOiBcImxjdWI7XCIsXG4gICAgXCIxMjRcIjogXCJWZXJ0aWNhbExpbmU7XCIsXG4gICAgXCIxMjVcIjogXCJyY3ViO1wiLFxuICAgIFwiMTYwXCI6IFwiTm9uQnJlYWtpbmdTcGFjZTtcIixcbiAgICBcIjE2MVwiOiBcImlleGNsO1wiLFxuICAgIFwiMTYyXCI6IFwiY2VudDtcIixcbiAgICBcIjE2M1wiOiBcInBvdW5kO1wiLFxuICAgIFwiMTY0XCI6IFwiY3VycmVuO1wiLFxuICAgIFwiMTY1XCI6IFwieWVuO1wiLFxuICAgIFwiMTY2XCI6IFwiYnJ2YmFyO1wiLFxuICAgIFwiMTY3XCI6IFwic2VjdDtcIixcbiAgICBcIjE2OFwiOiBcInVtbDtcIixcbiAgICBcIjE2OVwiOiBcImNvcHk7XCIsXG4gICAgXCIxNzBcIjogXCJvcmRmO1wiLFxuICAgIFwiMTcxXCI6IFwibGFxdW87XCIsXG4gICAgXCIxNzJcIjogXCJub3Q7XCIsXG4gICAgXCIxNzNcIjogXCJzaHk7XCIsXG4gICAgXCIxNzRcIjogXCJyZWc7XCIsXG4gICAgXCIxNzVcIjogXCJzdHJucztcIixcbiAgICBcIjE3NlwiOiBcImRlZztcIixcbiAgICBcIjE3N1wiOiBcInBtO1wiLFxuICAgIFwiMTc4XCI6IFwic3VwMjtcIixcbiAgICBcIjE3OVwiOiBcInN1cDM7XCIsXG4gICAgXCIxODBcIjogXCJEaWFjcml0aWNhbEFjdXRlO1wiLFxuICAgIFwiMTgxXCI6IFwibWljcm87XCIsXG4gICAgXCIxODJcIjogXCJwYXJhO1wiLFxuICAgIFwiMTgzXCI6IFwibWlkZG90O1wiLFxuICAgIFwiMTg0XCI6IFwiQ2VkaWxsYTtcIixcbiAgICBcIjE4NVwiOiBcInN1cDE7XCIsXG4gICAgXCIxODZcIjogXCJvcmRtO1wiLFxuICAgIFwiMTg3XCI6IFwicmFxdW87XCIsXG4gICAgXCIxODhcIjogXCJmcmFjMTQ7XCIsXG4gICAgXCIxODlcIjogXCJoYWxmO1wiLFxuICAgIFwiMTkwXCI6IFwiZnJhYzM0O1wiLFxuICAgIFwiMTkxXCI6IFwiaXF1ZXN0O1wiLFxuICAgIFwiMTkyXCI6IFwiQWdyYXZlO1wiLFxuICAgIFwiMTkzXCI6IFwiQWFjdXRlO1wiLFxuICAgIFwiMTk0XCI6IFwiQWNpcmM7XCIsXG4gICAgXCIxOTVcIjogXCJBdGlsZGU7XCIsXG4gICAgXCIxOTZcIjogXCJBdW1sO1wiLFxuICAgIFwiMTk3XCI6IFwiQXJpbmc7XCIsXG4gICAgXCIxOThcIjogXCJBRWxpZztcIixcbiAgICBcIjE5OVwiOiBcIkNjZWRpbDtcIixcbiAgICBcIjIwMFwiOiBcIkVncmF2ZTtcIixcbiAgICBcIjIwMVwiOiBcIkVhY3V0ZTtcIixcbiAgICBcIjIwMlwiOiBcIkVjaXJjO1wiLFxuICAgIFwiMjAzXCI6IFwiRXVtbDtcIixcbiAgICBcIjIwNFwiOiBcIklncmF2ZTtcIixcbiAgICBcIjIwNVwiOiBcIklhY3V0ZTtcIixcbiAgICBcIjIwNlwiOiBcIkljaXJjO1wiLFxuICAgIFwiMjA3XCI6IFwiSXVtbDtcIixcbiAgICBcIjIwOFwiOiBcIkVUSDtcIixcbiAgICBcIjIwOVwiOiBcIk50aWxkZTtcIixcbiAgICBcIjIxMFwiOiBcIk9ncmF2ZTtcIixcbiAgICBcIjIxMVwiOiBcIk9hY3V0ZTtcIixcbiAgICBcIjIxMlwiOiBcIk9jaXJjO1wiLFxuICAgIFwiMjEzXCI6IFwiT3RpbGRlO1wiLFxuICAgIFwiMjE0XCI6IFwiT3VtbDtcIixcbiAgICBcIjIxNVwiOiBcInRpbWVzO1wiLFxuICAgIFwiMjE2XCI6IFwiT3NsYXNoO1wiLFxuICAgIFwiMjE3XCI6IFwiVWdyYXZlO1wiLFxuICAgIFwiMjE4XCI6IFwiVWFjdXRlO1wiLFxuICAgIFwiMjE5XCI6IFwiVWNpcmM7XCIsXG4gICAgXCIyMjBcIjogXCJVdW1sO1wiLFxuICAgIFwiMjIxXCI6IFwiWWFjdXRlO1wiLFxuICAgIFwiMjIyXCI6IFwiVEhPUk47XCIsXG4gICAgXCIyMjNcIjogXCJzemxpZztcIixcbiAgICBcIjIyNFwiOiBcImFncmF2ZTtcIixcbiAgICBcIjIyNVwiOiBcImFhY3V0ZTtcIixcbiAgICBcIjIyNlwiOiBcImFjaXJjO1wiLFxuICAgIFwiMjI3XCI6IFwiYXRpbGRlO1wiLFxuICAgIFwiMjI4XCI6IFwiYXVtbDtcIixcbiAgICBcIjIyOVwiOiBcImFyaW5nO1wiLFxuICAgIFwiMjMwXCI6IFwiYWVsaWc7XCIsXG4gICAgXCIyMzFcIjogXCJjY2VkaWw7XCIsXG4gICAgXCIyMzJcIjogXCJlZ3JhdmU7XCIsXG4gICAgXCIyMzNcIjogXCJlYWN1dGU7XCIsXG4gICAgXCIyMzRcIjogXCJlY2lyYztcIixcbiAgICBcIjIzNVwiOiBcImV1bWw7XCIsXG4gICAgXCIyMzZcIjogXCJpZ3JhdmU7XCIsXG4gICAgXCIyMzdcIjogXCJpYWN1dGU7XCIsXG4gICAgXCIyMzhcIjogXCJpY2lyYztcIixcbiAgICBcIjIzOVwiOiBcIml1bWw7XCIsXG4gICAgXCIyNDBcIjogXCJldGg7XCIsXG4gICAgXCIyNDFcIjogXCJudGlsZGU7XCIsXG4gICAgXCIyNDJcIjogXCJvZ3JhdmU7XCIsXG4gICAgXCIyNDNcIjogXCJvYWN1dGU7XCIsXG4gICAgXCIyNDRcIjogXCJvY2lyYztcIixcbiAgICBcIjI0NVwiOiBcIm90aWxkZTtcIixcbiAgICBcIjI0NlwiOiBcIm91bWw7XCIsXG4gICAgXCIyNDdcIjogXCJkaXZpZGU7XCIsXG4gICAgXCIyNDhcIjogXCJvc2xhc2g7XCIsXG4gICAgXCIyNDlcIjogXCJ1Z3JhdmU7XCIsXG4gICAgXCIyNTBcIjogXCJ1YWN1dGU7XCIsXG4gICAgXCIyNTFcIjogXCJ1Y2lyYztcIixcbiAgICBcIjI1MlwiOiBcInV1bWw7XCIsXG4gICAgXCIyNTNcIjogXCJ5YWN1dGU7XCIsXG4gICAgXCIyNTRcIjogXCJ0aG9ybjtcIixcbiAgICBcIjI1NVwiOiBcInl1bWw7XCIsXG4gICAgXCIyNTZcIjogXCJBbWFjcjtcIixcbiAgICBcIjI1N1wiOiBcImFtYWNyO1wiLFxuICAgIFwiMjU4XCI6IFwiQWJyZXZlO1wiLFxuICAgIFwiMjU5XCI6IFwiYWJyZXZlO1wiLFxuICAgIFwiMjYwXCI6IFwiQW9nb247XCIsXG4gICAgXCIyNjFcIjogXCJhb2dvbjtcIixcbiAgICBcIjI2MlwiOiBcIkNhY3V0ZTtcIixcbiAgICBcIjI2M1wiOiBcImNhY3V0ZTtcIixcbiAgICBcIjI2NFwiOiBcIkNjaXJjO1wiLFxuICAgIFwiMjY1XCI6IFwiY2NpcmM7XCIsXG4gICAgXCIyNjZcIjogXCJDZG90O1wiLFxuICAgIFwiMjY3XCI6IFwiY2RvdDtcIixcbiAgICBcIjI2OFwiOiBcIkNjYXJvbjtcIixcbiAgICBcIjI2OVwiOiBcImNjYXJvbjtcIixcbiAgICBcIjI3MFwiOiBcIkRjYXJvbjtcIixcbiAgICBcIjI3MVwiOiBcImRjYXJvbjtcIixcbiAgICBcIjI3MlwiOiBcIkRzdHJvaztcIixcbiAgICBcIjI3M1wiOiBcImRzdHJvaztcIixcbiAgICBcIjI3NFwiOiBcIkVtYWNyO1wiLFxuICAgIFwiMjc1XCI6IFwiZW1hY3I7XCIsXG4gICAgXCIyNzhcIjogXCJFZG90O1wiLFxuICAgIFwiMjc5XCI6IFwiZWRvdDtcIixcbiAgICBcIjI4MFwiOiBcIkVvZ29uO1wiLFxuICAgIFwiMjgxXCI6IFwiZW9nb247XCIsXG4gICAgXCIyODJcIjogXCJFY2Fyb247XCIsXG4gICAgXCIyODNcIjogXCJlY2Fyb247XCIsXG4gICAgXCIyODRcIjogXCJHY2lyYztcIixcbiAgICBcIjI4NVwiOiBcImdjaXJjO1wiLFxuICAgIFwiMjg2XCI6IFwiR2JyZXZlO1wiLFxuICAgIFwiMjg3XCI6IFwiZ2JyZXZlO1wiLFxuICAgIFwiMjg4XCI6IFwiR2RvdDtcIixcbiAgICBcIjI4OVwiOiBcImdkb3Q7XCIsXG4gICAgXCIyOTBcIjogXCJHY2VkaWw7XCIsXG4gICAgXCIyOTJcIjogXCJIY2lyYztcIixcbiAgICBcIjI5M1wiOiBcImhjaXJjO1wiLFxuICAgIFwiMjk0XCI6IFwiSHN0cm9rO1wiLFxuICAgIFwiMjk1XCI6IFwiaHN0cm9rO1wiLFxuICAgIFwiMjk2XCI6IFwiSXRpbGRlO1wiLFxuICAgIFwiMjk3XCI6IFwiaXRpbGRlO1wiLFxuICAgIFwiMjk4XCI6IFwiSW1hY3I7XCIsXG4gICAgXCIyOTlcIjogXCJpbWFjcjtcIixcbiAgICBcIjMwMlwiOiBcIklvZ29uO1wiLFxuICAgIFwiMzAzXCI6IFwiaW9nb247XCIsXG4gICAgXCIzMDRcIjogXCJJZG90O1wiLFxuICAgIFwiMzA1XCI6IFwiaW5vZG90O1wiLFxuICAgIFwiMzA2XCI6IFwiSUpsaWc7XCIsXG4gICAgXCIzMDdcIjogXCJpamxpZztcIixcbiAgICBcIjMwOFwiOiBcIkpjaXJjO1wiLFxuICAgIFwiMzA5XCI6IFwiamNpcmM7XCIsXG4gICAgXCIzMTBcIjogXCJLY2VkaWw7XCIsXG4gICAgXCIzMTFcIjogXCJrY2VkaWw7XCIsXG4gICAgXCIzMTJcIjogXCJrZ3JlZW47XCIsXG4gICAgXCIzMTNcIjogXCJMYWN1dGU7XCIsXG4gICAgXCIzMTRcIjogXCJsYWN1dGU7XCIsXG4gICAgXCIzMTVcIjogXCJMY2VkaWw7XCIsXG4gICAgXCIzMTZcIjogXCJsY2VkaWw7XCIsXG4gICAgXCIzMTdcIjogXCJMY2Fyb247XCIsXG4gICAgXCIzMThcIjogXCJsY2Fyb247XCIsXG4gICAgXCIzMTlcIjogXCJMbWlkb3Q7XCIsXG4gICAgXCIzMjBcIjogXCJsbWlkb3Q7XCIsXG4gICAgXCIzMjFcIjogXCJMc3Ryb2s7XCIsXG4gICAgXCIzMjJcIjogXCJsc3Ryb2s7XCIsXG4gICAgXCIzMjNcIjogXCJOYWN1dGU7XCIsXG4gICAgXCIzMjRcIjogXCJuYWN1dGU7XCIsXG4gICAgXCIzMjVcIjogXCJOY2VkaWw7XCIsXG4gICAgXCIzMjZcIjogXCJuY2VkaWw7XCIsXG4gICAgXCIzMjdcIjogXCJOY2Fyb247XCIsXG4gICAgXCIzMjhcIjogXCJuY2Fyb247XCIsXG4gICAgXCIzMjlcIjogXCJuYXBvcztcIixcbiAgICBcIjMzMFwiOiBcIkVORztcIixcbiAgICBcIjMzMVwiOiBcImVuZztcIixcbiAgICBcIjMzMlwiOiBcIk9tYWNyO1wiLFxuICAgIFwiMzMzXCI6IFwib21hY3I7XCIsXG4gICAgXCIzMzZcIjogXCJPZGJsYWM7XCIsXG4gICAgXCIzMzdcIjogXCJvZGJsYWM7XCIsXG4gICAgXCIzMzhcIjogXCJPRWxpZztcIixcbiAgICBcIjMzOVwiOiBcIm9lbGlnO1wiLFxuICAgIFwiMzQwXCI6IFwiUmFjdXRlO1wiLFxuICAgIFwiMzQxXCI6IFwicmFjdXRlO1wiLFxuICAgIFwiMzQyXCI6IFwiUmNlZGlsO1wiLFxuICAgIFwiMzQzXCI6IFwicmNlZGlsO1wiLFxuICAgIFwiMzQ0XCI6IFwiUmNhcm9uO1wiLFxuICAgIFwiMzQ1XCI6IFwicmNhcm9uO1wiLFxuICAgIFwiMzQ2XCI6IFwiU2FjdXRlO1wiLFxuICAgIFwiMzQ3XCI6IFwic2FjdXRlO1wiLFxuICAgIFwiMzQ4XCI6IFwiU2NpcmM7XCIsXG4gICAgXCIzNDlcIjogXCJzY2lyYztcIixcbiAgICBcIjM1MFwiOiBcIlNjZWRpbDtcIixcbiAgICBcIjM1MVwiOiBcInNjZWRpbDtcIixcbiAgICBcIjM1MlwiOiBcIlNjYXJvbjtcIixcbiAgICBcIjM1M1wiOiBcInNjYXJvbjtcIixcbiAgICBcIjM1NFwiOiBcIlRjZWRpbDtcIixcbiAgICBcIjM1NVwiOiBcInRjZWRpbDtcIixcbiAgICBcIjM1NlwiOiBcIlRjYXJvbjtcIixcbiAgICBcIjM1N1wiOiBcInRjYXJvbjtcIixcbiAgICBcIjM1OFwiOiBcIlRzdHJvaztcIixcbiAgICBcIjM1OVwiOiBcInRzdHJvaztcIixcbiAgICBcIjM2MFwiOiBcIlV0aWxkZTtcIixcbiAgICBcIjM2MVwiOiBcInV0aWxkZTtcIixcbiAgICBcIjM2MlwiOiBcIlVtYWNyO1wiLFxuICAgIFwiMzYzXCI6IFwidW1hY3I7XCIsXG4gICAgXCIzNjRcIjogXCJVYnJldmU7XCIsXG4gICAgXCIzNjVcIjogXCJ1YnJldmU7XCIsXG4gICAgXCIzNjZcIjogXCJVcmluZztcIixcbiAgICBcIjM2N1wiOiBcInVyaW5nO1wiLFxuICAgIFwiMzY4XCI6IFwiVWRibGFjO1wiLFxuICAgIFwiMzY5XCI6IFwidWRibGFjO1wiLFxuICAgIFwiMzcwXCI6IFwiVW9nb247XCIsXG4gICAgXCIzNzFcIjogXCJ1b2dvbjtcIixcbiAgICBcIjM3MlwiOiBcIldjaXJjO1wiLFxuICAgIFwiMzczXCI6IFwid2NpcmM7XCIsXG4gICAgXCIzNzRcIjogXCJZY2lyYztcIixcbiAgICBcIjM3NVwiOiBcInljaXJjO1wiLFxuICAgIFwiMzc2XCI6IFwiWXVtbDtcIixcbiAgICBcIjM3N1wiOiBcIlphY3V0ZTtcIixcbiAgICBcIjM3OFwiOiBcInphY3V0ZTtcIixcbiAgICBcIjM3OVwiOiBcIlpkb3Q7XCIsXG4gICAgXCIzODBcIjogXCJ6ZG90O1wiLFxuICAgIFwiMzgxXCI6IFwiWmNhcm9uO1wiLFxuICAgIFwiMzgyXCI6IFwiemNhcm9uO1wiLFxuICAgIFwiNDAyXCI6IFwiZm5vZjtcIixcbiAgICBcIjQzN1wiOiBcImltcGVkO1wiLFxuICAgIFwiNTAxXCI6IFwiZ2FjdXRlO1wiLFxuICAgIFwiNTY3XCI6IFwiam1hdGg7XCIsXG4gICAgXCI3MTBcIjogXCJjaXJjO1wiLFxuICAgIFwiNzExXCI6IFwiSGFjZWs7XCIsXG4gICAgXCI3MjhcIjogXCJicmV2ZTtcIixcbiAgICBcIjcyOVwiOiBcImRvdDtcIixcbiAgICBcIjczMFwiOiBcInJpbmc7XCIsXG4gICAgXCI3MzFcIjogXCJvZ29uO1wiLFxuICAgIFwiNzMyXCI6IFwidGlsZGU7XCIsXG4gICAgXCI3MzNcIjogXCJEaWFjcml0aWNhbERvdWJsZUFjdXRlO1wiLFxuICAgIFwiNzg1XCI6IFwiRG93bkJyZXZlO1wiLFxuICAgIFwiOTEzXCI6IFwiQWxwaGE7XCIsXG4gICAgXCI5MTRcIjogXCJCZXRhO1wiLFxuICAgIFwiOTE1XCI6IFwiR2FtbWE7XCIsXG4gICAgXCI5MTZcIjogXCJEZWx0YTtcIixcbiAgICBcIjkxN1wiOiBcIkVwc2lsb247XCIsXG4gICAgXCI5MThcIjogXCJaZXRhO1wiLFxuICAgIFwiOTE5XCI6IFwiRXRhO1wiLFxuICAgIFwiOTIwXCI6IFwiVGhldGE7XCIsXG4gICAgXCI5MjFcIjogXCJJb3RhO1wiLFxuICAgIFwiOTIyXCI6IFwiS2FwcGE7XCIsXG4gICAgXCI5MjNcIjogXCJMYW1iZGE7XCIsXG4gICAgXCI5MjRcIjogXCJNdTtcIixcbiAgICBcIjkyNVwiOiBcIk51O1wiLFxuICAgIFwiOTI2XCI6IFwiWGk7XCIsXG4gICAgXCI5MjdcIjogXCJPbWljcm9uO1wiLFxuICAgIFwiOTI4XCI6IFwiUGk7XCIsXG4gICAgXCI5MjlcIjogXCJSaG87XCIsXG4gICAgXCI5MzFcIjogXCJTaWdtYTtcIixcbiAgICBcIjkzMlwiOiBcIlRhdTtcIixcbiAgICBcIjkzM1wiOiBcIlVwc2lsb247XCIsXG4gICAgXCI5MzRcIjogXCJQaGk7XCIsXG4gICAgXCI5MzVcIjogXCJDaGk7XCIsXG4gICAgXCI5MzZcIjogXCJQc2k7XCIsXG4gICAgXCI5MzdcIjogXCJPbWVnYTtcIixcbiAgICBcIjk0NVwiOiBcImFscGhhO1wiLFxuICAgIFwiOTQ2XCI6IFwiYmV0YTtcIixcbiAgICBcIjk0N1wiOiBcImdhbW1hO1wiLFxuICAgIFwiOTQ4XCI6IFwiZGVsdGE7XCIsXG4gICAgXCI5NDlcIjogXCJlcHNpbG9uO1wiLFxuICAgIFwiOTUwXCI6IFwiemV0YTtcIixcbiAgICBcIjk1MVwiOiBcImV0YTtcIixcbiAgICBcIjk1MlwiOiBcInRoZXRhO1wiLFxuICAgIFwiOTUzXCI6IFwiaW90YTtcIixcbiAgICBcIjk1NFwiOiBcImthcHBhO1wiLFxuICAgIFwiOTU1XCI6IFwibGFtYmRhO1wiLFxuICAgIFwiOTU2XCI6IFwibXU7XCIsXG4gICAgXCI5NTdcIjogXCJudTtcIixcbiAgICBcIjk1OFwiOiBcInhpO1wiLFxuICAgIFwiOTU5XCI6IFwib21pY3JvbjtcIixcbiAgICBcIjk2MFwiOiBcInBpO1wiLFxuICAgIFwiOTYxXCI6IFwicmhvO1wiLFxuICAgIFwiOTYyXCI6IFwidmFyc2lnbWE7XCIsXG4gICAgXCI5NjNcIjogXCJzaWdtYTtcIixcbiAgICBcIjk2NFwiOiBcInRhdTtcIixcbiAgICBcIjk2NVwiOiBcInVwc2lsb247XCIsXG4gICAgXCI5NjZcIjogXCJwaGk7XCIsXG4gICAgXCI5NjdcIjogXCJjaGk7XCIsXG4gICAgXCI5NjhcIjogXCJwc2k7XCIsXG4gICAgXCI5NjlcIjogXCJvbWVnYTtcIixcbiAgICBcIjk3N1wiOiBcInZhcnRoZXRhO1wiLFxuICAgIFwiOTc4XCI6IFwidXBzaWg7XCIsXG4gICAgXCI5ODFcIjogXCJ2YXJwaGk7XCIsXG4gICAgXCI5ODJcIjogXCJ2YXJwaTtcIixcbiAgICBcIjk4OFwiOiBcIkdhbW1hZDtcIixcbiAgICBcIjk4OVwiOiBcImdhbW1hZDtcIixcbiAgICBcIjEwMDhcIjogXCJ2YXJrYXBwYTtcIixcbiAgICBcIjEwMDlcIjogXCJ2YXJyaG87XCIsXG4gICAgXCIxMDEzXCI6IFwidmFyZXBzaWxvbjtcIixcbiAgICBcIjEwMTRcIjogXCJiZXBzaTtcIixcbiAgICBcIjEwMjVcIjogXCJJT2N5O1wiLFxuICAgIFwiMTAyNlwiOiBcIkRKY3k7XCIsXG4gICAgXCIxMDI3XCI6IFwiR0pjeTtcIixcbiAgICBcIjEwMjhcIjogXCJKdWtjeTtcIixcbiAgICBcIjEwMjlcIjogXCJEU2N5O1wiLFxuICAgIFwiMTAzMFwiOiBcIkl1a2N5O1wiLFxuICAgIFwiMTAzMVwiOiBcIllJY3k7XCIsXG4gICAgXCIxMDMyXCI6IFwiSnNlcmN5O1wiLFxuICAgIFwiMTAzM1wiOiBcIkxKY3k7XCIsXG4gICAgXCIxMDM0XCI6IFwiTkpjeTtcIixcbiAgICBcIjEwMzVcIjogXCJUU0hjeTtcIixcbiAgICBcIjEwMzZcIjogXCJLSmN5O1wiLFxuICAgIFwiMTAzOFwiOiBcIlVicmN5O1wiLFxuICAgIFwiMTAzOVwiOiBcIkRaY3k7XCIsXG4gICAgXCIxMDQwXCI6IFwiQWN5O1wiLFxuICAgIFwiMTA0MVwiOiBcIkJjeTtcIixcbiAgICBcIjEwNDJcIjogXCJWY3k7XCIsXG4gICAgXCIxMDQzXCI6IFwiR2N5O1wiLFxuICAgIFwiMTA0NFwiOiBcIkRjeTtcIixcbiAgICBcIjEwNDVcIjogXCJJRWN5O1wiLFxuICAgIFwiMTA0NlwiOiBcIlpIY3k7XCIsXG4gICAgXCIxMDQ3XCI6IFwiWmN5O1wiLFxuICAgIFwiMTA0OFwiOiBcIkljeTtcIixcbiAgICBcIjEwNDlcIjogXCJKY3k7XCIsXG4gICAgXCIxMDUwXCI6IFwiS2N5O1wiLFxuICAgIFwiMTA1MVwiOiBcIkxjeTtcIixcbiAgICBcIjEwNTJcIjogXCJNY3k7XCIsXG4gICAgXCIxMDUzXCI6IFwiTmN5O1wiLFxuICAgIFwiMTA1NFwiOiBcIk9jeTtcIixcbiAgICBcIjEwNTVcIjogXCJQY3k7XCIsXG4gICAgXCIxMDU2XCI6IFwiUmN5O1wiLFxuICAgIFwiMTA1N1wiOiBcIlNjeTtcIixcbiAgICBcIjEwNThcIjogXCJUY3k7XCIsXG4gICAgXCIxMDU5XCI6IFwiVWN5O1wiLFxuICAgIFwiMTA2MFwiOiBcIkZjeTtcIixcbiAgICBcIjEwNjFcIjogXCJLSGN5O1wiLFxuICAgIFwiMTA2MlwiOiBcIlRTY3k7XCIsXG4gICAgXCIxMDYzXCI6IFwiQ0hjeTtcIixcbiAgICBcIjEwNjRcIjogXCJTSGN5O1wiLFxuICAgIFwiMTA2NVwiOiBcIlNIQ0hjeTtcIixcbiAgICBcIjEwNjZcIjogXCJIQVJEY3k7XCIsXG4gICAgXCIxMDY3XCI6IFwiWWN5O1wiLFxuICAgIFwiMTA2OFwiOiBcIlNPRlRjeTtcIixcbiAgICBcIjEwNjlcIjogXCJFY3k7XCIsXG4gICAgXCIxMDcwXCI6IFwiWVVjeTtcIixcbiAgICBcIjEwNzFcIjogXCJZQWN5O1wiLFxuICAgIFwiMTA3MlwiOiBcImFjeTtcIixcbiAgICBcIjEwNzNcIjogXCJiY3k7XCIsXG4gICAgXCIxMDc0XCI6IFwidmN5O1wiLFxuICAgIFwiMTA3NVwiOiBcImdjeTtcIixcbiAgICBcIjEwNzZcIjogXCJkY3k7XCIsXG4gICAgXCIxMDc3XCI6IFwiaWVjeTtcIixcbiAgICBcIjEwNzhcIjogXCJ6aGN5O1wiLFxuICAgIFwiMTA3OVwiOiBcInpjeTtcIixcbiAgICBcIjEwODBcIjogXCJpY3k7XCIsXG4gICAgXCIxMDgxXCI6IFwiamN5O1wiLFxuICAgIFwiMTA4MlwiOiBcImtjeTtcIixcbiAgICBcIjEwODNcIjogXCJsY3k7XCIsXG4gICAgXCIxMDg0XCI6IFwibWN5O1wiLFxuICAgIFwiMTA4NVwiOiBcIm5jeTtcIixcbiAgICBcIjEwODZcIjogXCJvY3k7XCIsXG4gICAgXCIxMDg3XCI6IFwicGN5O1wiLFxuICAgIFwiMTA4OFwiOiBcInJjeTtcIixcbiAgICBcIjEwODlcIjogXCJzY3k7XCIsXG4gICAgXCIxMDkwXCI6IFwidGN5O1wiLFxuICAgIFwiMTA5MVwiOiBcInVjeTtcIixcbiAgICBcIjEwOTJcIjogXCJmY3k7XCIsXG4gICAgXCIxMDkzXCI6IFwia2hjeTtcIixcbiAgICBcIjEwOTRcIjogXCJ0c2N5O1wiLFxuICAgIFwiMTA5NVwiOiBcImNoY3k7XCIsXG4gICAgXCIxMDk2XCI6IFwic2hjeTtcIixcbiAgICBcIjEwOTdcIjogXCJzaGNoY3k7XCIsXG4gICAgXCIxMDk4XCI6IFwiaGFyZGN5O1wiLFxuICAgIFwiMTA5OVwiOiBcInljeTtcIixcbiAgICBcIjExMDBcIjogXCJzb2Z0Y3k7XCIsXG4gICAgXCIxMTAxXCI6IFwiZWN5O1wiLFxuICAgIFwiMTEwMlwiOiBcInl1Y3k7XCIsXG4gICAgXCIxMTAzXCI6IFwieWFjeTtcIixcbiAgICBcIjExMDVcIjogXCJpb2N5O1wiLFxuICAgIFwiMTEwNlwiOiBcImRqY3k7XCIsXG4gICAgXCIxMTA3XCI6IFwiZ2pjeTtcIixcbiAgICBcIjExMDhcIjogXCJqdWtjeTtcIixcbiAgICBcIjExMDlcIjogXCJkc2N5O1wiLFxuICAgIFwiMTExMFwiOiBcIml1a2N5O1wiLFxuICAgIFwiMTExMVwiOiBcInlpY3k7XCIsXG4gICAgXCIxMTEyXCI6IFwianNlcmN5O1wiLFxuICAgIFwiMTExM1wiOiBcImxqY3k7XCIsXG4gICAgXCIxMTE0XCI6IFwibmpjeTtcIixcbiAgICBcIjExMTVcIjogXCJ0c2hjeTtcIixcbiAgICBcIjExMTZcIjogXCJramN5O1wiLFxuICAgIFwiMTExOFwiOiBcInVicmN5O1wiLFxuICAgIFwiMTExOVwiOiBcImR6Y3k7XCIsXG4gICAgXCI4MTk0XCI6IFwiZW5zcDtcIixcbiAgICBcIjgxOTVcIjogXCJlbXNwO1wiLFxuICAgIFwiODE5NlwiOiBcImVtc3AxMztcIixcbiAgICBcIjgxOTdcIjogXCJlbXNwMTQ7XCIsXG4gICAgXCI4MTk5XCI6IFwibnVtc3A7XCIsXG4gICAgXCI4MjAwXCI6IFwicHVuY3NwO1wiLFxuICAgIFwiODIwMVwiOiBcIlRoaW5TcGFjZTtcIixcbiAgICBcIjgyMDJcIjogXCJWZXJ5VGhpblNwYWNlO1wiLFxuICAgIFwiODIwM1wiOiBcIlplcm9XaWR0aFNwYWNlO1wiLFxuICAgIFwiODIwNFwiOiBcInp3bmo7XCIsXG4gICAgXCI4MjA1XCI6IFwiendqO1wiLFxuICAgIFwiODIwNlwiOiBcImxybTtcIixcbiAgICBcIjgyMDdcIjogXCJybG07XCIsXG4gICAgXCI4MjA4XCI6IFwiaHlwaGVuO1wiLFxuICAgIFwiODIxMVwiOiBcIm5kYXNoO1wiLFxuICAgIFwiODIxMlwiOiBcIm1kYXNoO1wiLFxuICAgIFwiODIxM1wiOiBcImhvcmJhcjtcIixcbiAgICBcIjgyMTRcIjogXCJWZXJ0O1wiLFxuICAgIFwiODIxNlwiOiBcIk9wZW5DdXJseVF1b3RlO1wiLFxuICAgIFwiODIxN1wiOiBcInJzcXVvcjtcIixcbiAgICBcIjgyMThcIjogXCJzYnF1bztcIixcbiAgICBcIjgyMjBcIjogXCJPcGVuQ3VybHlEb3VibGVRdW90ZTtcIixcbiAgICBcIjgyMjFcIjogXCJyZHF1b3I7XCIsXG4gICAgXCI4MjIyXCI6IFwibGRxdW9yO1wiLFxuICAgIFwiODIyNFwiOiBcImRhZ2dlcjtcIixcbiAgICBcIjgyMjVcIjogXCJkZGFnZ2VyO1wiLFxuICAgIFwiODIyNlwiOiBcImJ1bGxldDtcIixcbiAgICBcIjgyMjlcIjogXCJubGRyO1wiLFxuICAgIFwiODIzMFwiOiBcIm1sZHI7XCIsXG4gICAgXCI4MjQwXCI6IFwicGVybWlsO1wiLFxuICAgIFwiODI0MVwiOiBcInBlcnRlbms7XCIsXG4gICAgXCI4MjQyXCI6IFwicHJpbWU7XCIsXG4gICAgXCI4MjQzXCI6IFwiUHJpbWU7XCIsXG4gICAgXCI4MjQ0XCI6IFwidHByaW1lO1wiLFxuICAgIFwiODI0NVwiOiBcImJwcmltZTtcIixcbiAgICBcIjgyNDlcIjogXCJsc2FxdW87XCIsXG4gICAgXCI4MjUwXCI6IFwicnNhcXVvO1wiLFxuICAgIFwiODI1NFwiOiBcIk92ZXJCYXI7XCIsXG4gICAgXCI4MjU3XCI6IFwiY2FyZXQ7XCIsXG4gICAgXCI4MjU5XCI6IFwiaHlidWxsO1wiLFxuICAgIFwiODI2MFwiOiBcImZyYXNsO1wiLFxuICAgIFwiODI3MVwiOiBcImJzZW1pO1wiLFxuICAgIFwiODI3OVwiOiBcInFwcmltZTtcIixcbiAgICBcIjgyODdcIjogXCJNZWRpdW1TcGFjZTtcIixcbiAgICBcIjgyODhcIjogXCJOb0JyZWFrO1wiLFxuICAgIFwiODI4OVwiOiBcIkFwcGx5RnVuY3Rpb247XCIsXG4gICAgXCI4MjkwXCI6IFwiaXQ7XCIsXG4gICAgXCI4MjkxXCI6IFwiSW52aXNpYmxlQ29tbWE7XCIsXG4gICAgXCI4MzY0XCI6IFwiZXVybztcIixcbiAgICBcIjg0MTFcIjogXCJUcmlwbGVEb3Q7XCIsXG4gICAgXCI4NDEyXCI6IFwiRG90RG90O1wiLFxuICAgIFwiODQ1MFwiOiBcIkNvcGY7XCIsXG4gICAgXCI4NDUzXCI6IFwiaW5jYXJlO1wiLFxuICAgIFwiODQ1OFwiOiBcImdzY3I7XCIsXG4gICAgXCI4NDU5XCI6IFwiSHNjcjtcIixcbiAgICBcIjg0NjBcIjogXCJQb2luY2FyZXBsYW5lO1wiLFxuICAgIFwiODQ2MVwiOiBcInF1YXRlcm5pb25zO1wiLFxuICAgIFwiODQ2MlwiOiBcInBsYW5ja2g7XCIsXG4gICAgXCI4NDYzXCI6IFwicGxhbmt2O1wiLFxuICAgIFwiODQ2NFwiOiBcIklzY3I7XCIsXG4gICAgXCI4NDY1XCI6IFwiaW1hZ3BhcnQ7XCIsXG4gICAgXCI4NDY2XCI6IFwiTHNjcjtcIixcbiAgICBcIjg0NjdcIjogXCJlbGw7XCIsXG4gICAgXCI4NDY5XCI6IFwiTm9wZjtcIixcbiAgICBcIjg0NzBcIjogXCJudW1lcm87XCIsXG4gICAgXCI4NDcxXCI6IFwiY29weXNyO1wiLFxuICAgIFwiODQ3MlwiOiBcIndwO1wiLFxuICAgIFwiODQ3M1wiOiBcInByaW1lcztcIixcbiAgICBcIjg0NzRcIjogXCJyYXRpb25hbHM7XCIsXG4gICAgXCI4NDc1XCI6IFwiUnNjcjtcIixcbiAgICBcIjg0NzZcIjogXCJSZnI7XCIsXG4gICAgXCI4NDc3XCI6IFwiUm9wZjtcIixcbiAgICBcIjg0NzhcIjogXCJyeDtcIixcbiAgICBcIjg0ODJcIjogXCJ0cmFkZTtcIixcbiAgICBcIjg0ODRcIjogXCJab3BmO1wiLFxuICAgIFwiODQ4N1wiOiBcIm1obztcIixcbiAgICBcIjg0ODhcIjogXCJaZnI7XCIsXG4gICAgXCI4NDg5XCI6IFwiaWlvdGE7XCIsXG4gICAgXCI4NDkyXCI6IFwiQnNjcjtcIixcbiAgICBcIjg0OTNcIjogXCJDZnI7XCIsXG4gICAgXCI4NDk1XCI6IFwiZXNjcjtcIixcbiAgICBcIjg0OTZcIjogXCJleHBlY3RhdGlvbjtcIixcbiAgICBcIjg0OTdcIjogXCJGc2NyO1wiLFxuICAgIFwiODQ5OVwiOiBcInBobW1hdDtcIixcbiAgICBcIjg1MDBcIjogXCJvc2NyO1wiLFxuICAgIFwiODUwMVwiOiBcImFsZXBoO1wiLFxuICAgIFwiODUwMlwiOiBcImJldGg7XCIsXG4gICAgXCI4NTAzXCI6IFwiZ2ltZWw7XCIsXG4gICAgXCI4NTA0XCI6IFwiZGFsZXRoO1wiLFxuICAgIFwiODUxN1wiOiBcIkREO1wiLFxuICAgIFwiODUxOFwiOiBcIkRpZmZlcmVudGlhbEQ7XCIsXG4gICAgXCI4NTE5XCI6IFwiZXhwb25lbnRpYWxlO1wiLFxuICAgIFwiODUyMFwiOiBcIkltYWdpbmFyeUk7XCIsXG4gICAgXCI4NTMxXCI6IFwiZnJhYzEzO1wiLFxuICAgIFwiODUzMlwiOiBcImZyYWMyMztcIixcbiAgICBcIjg1MzNcIjogXCJmcmFjMTU7XCIsXG4gICAgXCI4NTM0XCI6IFwiZnJhYzI1O1wiLFxuICAgIFwiODUzNVwiOiBcImZyYWMzNTtcIixcbiAgICBcIjg1MzZcIjogXCJmcmFjNDU7XCIsXG4gICAgXCI4NTM3XCI6IFwiZnJhYzE2O1wiLFxuICAgIFwiODUzOFwiOiBcImZyYWM1NjtcIixcbiAgICBcIjg1MzlcIjogXCJmcmFjMTg7XCIsXG4gICAgXCI4NTQwXCI6IFwiZnJhYzM4O1wiLFxuICAgIFwiODU0MVwiOiBcImZyYWM1ODtcIixcbiAgICBcIjg1NDJcIjogXCJmcmFjNzg7XCIsXG4gICAgXCI4NTkyXCI6IFwic2xhcnI7XCIsXG4gICAgXCI4NTkzXCI6IFwidXBhcnJvdztcIixcbiAgICBcIjg1OTRcIjogXCJzcmFycjtcIixcbiAgICBcIjg1OTVcIjogXCJTaG9ydERvd25BcnJvdztcIixcbiAgICBcIjg1OTZcIjogXCJsZWZ0cmlnaHRhcnJvdztcIixcbiAgICBcIjg1OTdcIjogXCJ2YXJyO1wiLFxuICAgIFwiODU5OFwiOiBcIlVwcGVyTGVmdEFycm93O1wiLFxuICAgIFwiODU5OVwiOiBcIlVwcGVyUmlnaHRBcnJvdztcIixcbiAgICBcIjg2MDBcIjogXCJzZWFycm93O1wiLFxuICAgIFwiODYwMVwiOiBcInN3YXJyb3c7XCIsXG4gICAgXCI4NjAyXCI6IFwibmxlZnRhcnJvdztcIixcbiAgICBcIjg2MDNcIjogXCJucmlnaHRhcnJvdztcIixcbiAgICBcIjg2MDVcIjogXCJyaWdodHNxdWlnYXJyb3c7XCIsXG4gICAgXCI4NjA2XCI6IFwidHdvaGVhZGxlZnRhcnJvdztcIixcbiAgICBcIjg2MDdcIjogXCJVYXJyO1wiLFxuICAgIFwiODYwOFwiOiBcInR3b2hlYWRyaWdodGFycm93O1wiLFxuICAgIFwiODYwOVwiOiBcIkRhcnI7XCIsXG4gICAgXCI4NjEwXCI6IFwibGVmdGFycm93dGFpbDtcIixcbiAgICBcIjg2MTFcIjogXCJyaWdodGFycm93dGFpbDtcIixcbiAgICBcIjg2MTJcIjogXCJtYXBzdG9sZWZ0O1wiLFxuICAgIFwiODYxM1wiOiBcIlVwVGVlQXJyb3c7XCIsXG4gICAgXCI4NjE0XCI6IFwiUmlnaHRUZWVBcnJvdztcIixcbiAgICBcIjg2MTVcIjogXCJtYXBzdG9kb3duO1wiLFxuICAgIFwiODYxN1wiOiBcImxhcnJoaztcIixcbiAgICBcIjg2MThcIjogXCJyYXJyaGs7XCIsXG4gICAgXCI4NjE5XCI6IFwibG9vcGFycm93bGVmdDtcIixcbiAgICBcIjg2MjBcIjogXCJyYXJybHA7XCIsXG4gICAgXCI4NjIxXCI6IFwibGVmdHJpZ2h0c3F1aWdhcnJvdztcIixcbiAgICBcIjg2MjJcIjogXCJubGVmdHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjI0XCI6IFwibHNoO1wiLFxuICAgIFwiODYyNVwiOiBcInJzaDtcIixcbiAgICBcIjg2MjZcIjogXCJsZHNoO1wiLFxuICAgIFwiODYyN1wiOiBcInJkc2g7XCIsXG4gICAgXCI4NjI5XCI6IFwiY3JhcnI7XCIsXG4gICAgXCI4NjMwXCI6IFwiY3VydmVhcnJvd2xlZnQ7XCIsXG4gICAgXCI4NjMxXCI6IFwiY3VydmVhcnJvd3JpZ2h0O1wiLFxuICAgIFwiODYzNFwiOiBcIm9sYXJyO1wiLFxuICAgIFwiODYzNVwiOiBcIm9yYXJyO1wiLFxuICAgIFwiODYzNlwiOiBcImxoYXJ1O1wiLFxuICAgIFwiODYzN1wiOiBcImxoYXJkO1wiLFxuICAgIFwiODYzOFwiOiBcInVwaGFycG9vbnJpZ2h0O1wiLFxuICAgIFwiODYzOVwiOiBcInVwaGFycG9vbmxlZnQ7XCIsXG4gICAgXCI4NjQwXCI6IFwiUmlnaHRWZWN0b3I7XCIsXG4gICAgXCI4NjQxXCI6IFwicmlnaHRoYXJwb29uZG93bjtcIixcbiAgICBcIjg2NDJcIjogXCJSaWdodERvd25WZWN0b3I7XCIsXG4gICAgXCI4NjQzXCI6IFwiTGVmdERvd25WZWN0b3I7XCIsXG4gICAgXCI4NjQ0XCI6IFwicmxhcnI7XCIsXG4gICAgXCI4NjQ1XCI6IFwiVXBBcnJvd0Rvd25BcnJvdztcIixcbiAgICBcIjg2NDZcIjogXCJscmFycjtcIixcbiAgICBcIjg2NDdcIjogXCJsbGFycjtcIixcbiAgICBcIjg2NDhcIjogXCJ1dWFycjtcIixcbiAgICBcIjg2NDlcIjogXCJycmFycjtcIixcbiAgICBcIjg2NTBcIjogXCJkb3duZG93bmFycm93cztcIixcbiAgICBcIjg2NTFcIjogXCJSZXZlcnNlRXF1aWxpYnJpdW07XCIsXG4gICAgXCI4NjUyXCI6IFwicmxoYXI7XCIsXG4gICAgXCI4NjUzXCI6IFwibkxlZnRhcnJvdztcIixcbiAgICBcIjg2NTRcIjogXCJuTGVmdHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjU1XCI6IFwiblJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjU2XCI6IFwiTGVmdGFycm93O1wiLFxuICAgIFwiODY1N1wiOiBcIlVwYXJyb3c7XCIsXG4gICAgXCI4NjU4XCI6IFwiUmlnaHRhcnJvdztcIixcbiAgICBcIjg2NTlcIjogXCJEb3duYXJyb3c7XCIsXG4gICAgXCI4NjYwXCI6IFwiTGVmdHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjYxXCI6IFwidkFycjtcIixcbiAgICBcIjg2NjJcIjogXCJud0FycjtcIixcbiAgICBcIjg2NjNcIjogXCJuZUFycjtcIixcbiAgICBcIjg2NjRcIjogXCJzZUFycjtcIixcbiAgICBcIjg2NjVcIjogXCJzd0FycjtcIixcbiAgICBcIjg2NjZcIjogXCJMbGVmdGFycm93O1wiLFxuICAgIFwiODY2N1wiOiBcIlJyaWdodGFycm93O1wiLFxuICAgIFwiODY2OVwiOiBcInppZ3JhcnI7XCIsXG4gICAgXCI4Njc2XCI6IFwiTGVmdEFycm93QmFyO1wiLFxuICAgIFwiODY3N1wiOiBcIlJpZ2h0QXJyb3dCYXI7XCIsXG4gICAgXCI4NjkzXCI6IFwiZHVhcnI7XCIsXG4gICAgXCI4NzAxXCI6IFwibG9hcnI7XCIsXG4gICAgXCI4NzAyXCI6IFwicm9hcnI7XCIsXG4gICAgXCI4NzAzXCI6IFwiaG9hcnI7XCIsXG4gICAgXCI4NzA0XCI6IFwiZm9yYWxsO1wiLFxuICAgIFwiODcwNVwiOiBcImNvbXBsZW1lbnQ7XCIsXG4gICAgXCI4NzA2XCI6IFwiUGFydGlhbEQ7XCIsXG4gICAgXCI4NzA3XCI6IFwiRXhpc3RzO1wiLFxuICAgIFwiODcwOFwiOiBcIk5vdEV4aXN0cztcIixcbiAgICBcIjg3MDlcIjogXCJ2YXJub3RoaW5nO1wiLFxuICAgIFwiODcxMVwiOiBcIm5hYmxhO1wiLFxuICAgIFwiODcxMlwiOiBcImlzaW52O1wiLFxuICAgIFwiODcxM1wiOiBcIm5vdGludmE7XCIsXG4gICAgXCI4NzE1XCI6IFwiU3VjaFRoYXQ7XCIsXG4gICAgXCI4NzE2XCI6IFwiTm90UmV2ZXJzZUVsZW1lbnQ7XCIsXG4gICAgXCI4NzE5XCI6IFwiUHJvZHVjdDtcIixcbiAgICBcIjg3MjBcIjogXCJDb3Byb2R1Y3Q7XCIsXG4gICAgXCI4NzIxXCI6IFwic3VtO1wiLFxuICAgIFwiODcyMlwiOiBcIm1pbnVzO1wiLFxuICAgIFwiODcyM1wiOiBcIm1wO1wiLFxuICAgIFwiODcyNFwiOiBcInBsdXNkbztcIixcbiAgICBcIjg3MjZcIjogXCJzc2V0bW47XCIsXG4gICAgXCI4NzI3XCI6IFwibG93YXN0O1wiLFxuICAgIFwiODcyOFwiOiBcIlNtYWxsQ2lyY2xlO1wiLFxuICAgIFwiODczMFwiOiBcIlNxcnQ7XCIsXG4gICAgXCI4NzMzXCI6IFwidnByb3A7XCIsXG4gICAgXCI4NzM0XCI6IFwiaW5maW47XCIsXG4gICAgXCI4NzM1XCI6IFwiYW5ncnQ7XCIsXG4gICAgXCI4NzM2XCI6IFwiYW5nbGU7XCIsXG4gICAgXCI4NzM3XCI6IFwibWVhc3VyZWRhbmdsZTtcIixcbiAgICBcIjg3MzhcIjogXCJhbmdzcGg7XCIsXG4gICAgXCI4NzM5XCI6IFwiVmVydGljYWxCYXI7XCIsXG4gICAgXCI4NzQwXCI6IFwibnNtaWQ7XCIsXG4gICAgXCI4NzQxXCI6IFwic3BhcjtcIixcbiAgICBcIjg3NDJcIjogXCJuc3BhcjtcIixcbiAgICBcIjg3NDNcIjogXCJ3ZWRnZTtcIixcbiAgICBcIjg3NDRcIjogXCJ2ZWU7XCIsXG4gICAgXCI4NzQ1XCI6IFwiY2FwO1wiLFxuICAgIFwiODc0NlwiOiBcImN1cDtcIixcbiAgICBcIjg3NDdcIjogXCJJbnRlZ3JhbDtcIixcbiAgICBcIjg3NDhcIjogXCJJbnQ7XCIsXG4gICAgXCI4NzQ5XCI6IFwidGludDtcIixcbiAgICBcIjg3NTBcIjogXCJvaW50O1wiLFxuICAgIFwiODc1MVwiOiBcIkRvdWJsZUNvbnRvdXJJbnRlZ3JhbDtcIixcbiAgICBcIjg3NTJcIjogXCJDY29uaW50O1wiLFxuICAgIFwiODc1M1wiOiBcImN3aW50O1wiLFxuICAgIFwiODc1NFwiOiBcImN3Y29uaW50O1wiLFxuICAgIFwiODc1NVwiOiBcIkNvdW50ZXJDbG9ja3dpc2VDb250b3VySW50ZWdyYWw7XCIsXG4gICAgXCI4NzU2XCI6IFwidGhlcmVmb3JlO1wiLFxuICAgIFwiODc1N1wiOiBcImJlY2F1c2U7XCIsXG4gICAgXCI4NzU4XCI6IFwicmF0aW87XCIsXG4gICAgXCI4NzU5XCI6IFwiUHJvcG9ydGlvbjtcIixcbiAgICBcIjg3NjBcIjogXCJtaW51c2Q7XCIsXG4gICAgXCI4NzYyXCI6IFwibUREb3Q7XCIsXG4gICAgXCI4NzYzXCI6IFwiaG9tdGh0O1wiLFxuICAgIFwiODc2NFwiOiBcIlRpbGRlO1wiLFxuICAgIFwiODc2NVwiOiBcImJzaW07XCIsXG4gICAgXCI4NzY2XCI6IFwibXN0cG9zO1wiLFxuICAgIFwiODc2N1wiOiBcImFjZDtcIixcbiAgICBcIjg3NjhcIjogXCJ3cmVhdGg7XCIsXG4gICAgXCI4NzY5XCI6IFwibnNpbTtcIixcbiAgICBcIjg3NzBcIjogXCJlc2ltO1wiLFxuICAgIFwiODc3MVwiOiBcIlRpbGRlRXF1YWw7XCIsXG4gICAgXCI4NzcyXCI6IFwibnNpbWVxO1wiLFxuICAgIFwiODc3M1wiOiBcIlRpbGRlRnVsbEVxdWFsO1wiLFxuICAgIFwiODc3NFwiOiBcInNpbW5lO1wiLFxuICAgIFwiODc3NVwiOiBcIk5vdFRpbGRlRnVsbEVxdWFsO1wiLFxuICAgIFwiODc3NlwiOiBcIlRpbGRlVGlsZGU7XCIsXG4gICAgXCI4Nzc3XCI6IFwiTm90VGlsZGVUaWxkZTtcIixcbiAgICBcIjg3NzhcIjogXCJhcHByb3hlcTtcIixcbiAgICBcIjg3NzlcIjogXCJhcGlkO1wiLFxuICAgIFwiODc4MFwiOiBcImJjb25nO1wiLFxuICAgIFwiODc4MVwiOiBcIkN1cENhcDtcIixcbiAgICBcIjg3ODJcIjogXCJIdW1wRG93bkh1bXA7XCIsXG4gICAgXCI4NzgzXCI6IFwiSHVtcEVxdWFsO1wiLFxuICAgIFwiODc4NFwiOiBcImVzZG90O1wiLFxuICAgIFwiODc4NVwiOiBcImVEb3Q7XCIsXG4gICAgXCI4Nzg2XCI6IFwiZmFsbGluZ2RvdHNlcTtcIixcbiAgICBcIjg3ODdcIjogXCJyaXNpbmdkb3RzZXE7XCIsXG4gICAgXCI4Nzg4XCI6IFwiY29sb25lcTtcIixcbiAgICBcIjg3ODlcIjogXCJlcWNvbG9uO1wiLFxuICAgIFwiODc5MFwiOiBcImVxY2lyYztcIixcbiAgICBcIjg3OTFcIjogXCJjaXJlO1wiLFxuICAgIFwiODc5M1wiOiBcIndlZGdlcTtcIixcbiAgICBcIjg3OTRcIjogXCJ2ZWVlcTtcIixcbiAgICBcIjg3OTZcIjogXCJ0cmllO1wiLFxuICAgIFwiODc5OVwiOiBcInF1ZXN0ZXE7XCIsXG4gICAgXCI4ODAwXCI6IFwiTm90RXF1YWw7XCIsXG4gICAgXCI4ODAxXCI6IFwiZXF1aXY7XCIsXG4gICAgXCI4ODAyXCI6IFwiTm90Q29uZ3J1ZW50O1wiLFxuICAgIFwiODgwNFwiOiBcImxlcTtcIixcbiAgICBcIjg4MDVcIjogXCJHcmVhdGVyRXF1YWw7XCIsXG4gICAgXCI4ODA2XCI6IFwiTGVzc0Z1bGxFcXVhbDtcIixcbiAgICBcIjg4MDdcIjogXCJHcmVhdGVyRnVsbEVxdWFsO1wiLFxuICAgIFwiODgwOFwiOiBcImxuZXFxO1wiLFxuICAgIFwiODgwOVwiOiBcImduZXFxO1wiLFxuICAgIFwiODgxMFwiOiBcIk5lc3RlZExlc3NMZXNzO1wiLFxuICAgIFwiODgxMVwiOiBcIk5lc3RlZEdyZWF0ZXJHcmVhdGVyO1wiLFxuICAgIFwiODgxMlwiOiBcInR3aXh0O1wiLFxuICAgIFwiODgxM1wiOiBcIk5vdEN1cENhcDtcIixcbiAgICBcIjg4MTRcIjogXCJOb3RMZXNzO1wiLFxuICAgIFwiODgxNVwiOiBcIk5vdEdyZWF0ZXI7XCIsXG4gICAgXCI4ODE2XCI6IFwiTm90TGVzc0VxdWFsO1wiLFxuICAgIFwiODgxN1wiOiBcIk5vdEdyZWF0ZXJFcXVhbDtcIixcbiAgICBcIjg4MThcIjogXCJsc2ltO1wiLFxuICAgIFwiODgxOVwiOiBcImd0cnNpbTtcIixcbiAgICBcIjg4MjBcIjogXCJOb3RMZXNzVGlsZGU7XCIsXG4gICAgXCI4ODIxXCI6IFwiTm90R3JlYXRlclRpbGRlO1wiLFxuICAgIFwiODgyMlwiOiBcImxnO1wiLFxuICAgIFwiODgyM1wiOiBcImd0cmxlc3M7XCIsXG4gICAgXCI4ODI0XCI6IFwibnRsZztcIixcbiAgICBcIjg4MjVcIjogXCJudGdsO1wiLFxuICAgIFwiODgyNlwiOiBcIlByZWNlZGVzO1wiLFxuICAgIFwiODgyN1wiOiBcIlN1Y2NlZWRzO1wiLFxuICAgIFwiODgyOFwiOiBcIlByZWNlZGVzU2xhbnRFcXVhbDtcIixcbiAgICBcIjg4MjlcIjogXCJTdWNjZWVkc1NsYW50RXF1YWw7XCIsXG4gICAgXCI4ODMwXCI6IFwicHJzaW07XCIsXG4gICAgXCI4ODMxXCI6IFwic3VjY3NpbTtcIixcbiAgICBcIjg4MzJcIjogXCJucHJlYztcIixcbiAgICBcIjg4MzNcIjogXCJuc3VjYztcIixcbiAgICBcIjg4MzRcIjogXCJzdWJzZXQ7XCIsXG4gICAgXCI4ODM1XCI6IFwic3Vwc2V0O1wiLFxuICAgIFwiODgzNlwiOiBcIm5zdWI7XCIsXG4gICAgXCI4ODM3XCI6IFwibnN1cDtcIixcbiAgICBcIjg4MzhcIjogXCJTdWJzZXRFcXVhbDtcIixcbiAgICBcIjg4MzlcIjogXCJzdXBzZXRlcTtcIixcbiAgICBcIjg4NDBcIjogXCJuc3Vic2V0ZXE7XCIsXG4gICAgXCI4ODQxXCI6IFwibnN1cHNldGVxO1wiLFxuICAgIFwiODg0MlwiOiBcInN1YnNldG5lcTtcIixcbiAgICBcIjg4NDNcIjogXCJzdXBzZXRuZXE7XCIsXG4gICAgXCI4ODQ1XCI6IFwiY3VwZG90O1wiLFxuICAgIFwiODg0NlwiOiBcInVwbHVzO1wiLFxuICAgIFwiODg0N1wiOiBcIlNxdWFyZVN1YnNldDtcIixcbiAgICBcIjg4NDhcIjogXCJTcXVhcmVTdXBlcnNldDtcIixcbiAgICBcIjg4NDlcIjogXCJTcXVhcmVTdWJzZXRFcXVhbDtcIixcbiAgICBcIjg4NTBcIjogXCJTcXVhcmVTdXBlcnNldEVxdWFsO1wiLFxuICAgIFwiODg1MVwiOiBcIlNxdWFyZUludGVyc2VjdGlvbjtcIixcbiAgICBcIjg4NTJcIjogXCJTcXVhcmVVbmlvbjtcIixcbiAgICBcIjg4NTNcIjogXCJvcGx1cztcIixcbiAgICBcIjg4NTRcIjogXCJvbWludXM7XCIsXG4gICAgXCI4ODU1XCI6IFwib3RpbWVzO1wiLFxuICAgIFwiODg1NlwiOiBcIm9zb2w7XCIsXG4gICAgXCI4ODU3XCI6IFwib2RvdDtcIixcbiAgICBcIjg4NThcIjogXCJvY2lyO1wiLFxuICAgIFwiODg1OVwiOiBcIm9hc3Q7XCIsXG4gICAgXCI4ODYxXCI6IFwib2Rhc2g7XCIsXG4gICAgXCI4ODYyXCI6IFwicGx1c2I7XCIsXG4gICAgXCI4ODYzXCI6IFwibWludXNiO1wiLFxuICAgIFwiODg2NFwiOiBcInRpbWVzYjtcIixcbiAgICBcIjg4NjVcIjogXCJzZG90YjtcIixcbiAgICBcIjg4NjZcIjogXCJ2ZGFzaDtcIixcbiAgICBcIjg4NjdcIjogXCJMZWZ0VGVlO1wiLFxuICAgIFwiODg2OFwiOiBcInRvcDtcIixcbiAgICBcIjg4NjlcIjogXCJVcFRlZTtcIixcbiAgICBcIjg4NzFcIjogXCJtb2RlbHM7XCIsXG4gICAgXCI4ODcyXCI6IFwidkRhc2g7XCIsXG4gICAgXCI4ODczXCI6IFwiVmRhc2g7XCIsXG4gICAgXCI4ODc0XCI6IFwiVnZkYXNoO1wiLFxuICAgIFwiODg3NVwiOiBcIlZEYXNoO1wiLFxuICAgIFwiODg3NlwiOiBcIm52ZGFzaDtcIixcbiAgICBcIjg4NzdcIjogXCJudkRhc2g7XCIsXG4gICAgXCI4ODc4XCI6IFwiblZkYXNoO1wiLFxuICAgIFwiODg3OVwiOiBcIm5WRGFzaDtcIixcbiAgICBcIjg4ODBcIjogXCJwcnVyZWw7XCIsXG4gICAgXCI4ODgyXCI6IFwidmx0cmk7XCIsXG4gICAgXCI4ODgzXCI6IFwidnJ0cmk7XCIsXG4gICAgXCI4ODg0XCI6IFwidHJpYW5nbGVsZWZ0ZXE7XCIsXG4gICAgXCI4ODg1XCI6IFwidHJpYW5nbGVyaWdodGVxO1wiLFxuICAgIFwiODg4NlwiOiBcIm9yaWdvZjtcIixcbiAgICBcIjg4ODdcIjogXCJpbW9mO1wiLFxuICAgIFwiODg4OFwiOiBcIm11bWFwO1wiLFxuICAgIFwiODg4OVwiOiBcImhlcmNvbjtcIixcbiAgICBcIjg4OTBcIjogXCJpbnRlcmNhbDtcIixcbiAgICBcIjg4OTFcIjogXCJ2ZWViYXI7XCIsXG4gICAgXCI4ODkzXCI6IFwiYmFydmVlO1wiLFxuICAgIFwiODg5NFwiOiBcImFuZ3J0dmI7XCIsXG4gICAgXCI4ODk1XCI6IFwibHJ0cmk7XCIsXG4gICAgXCI4ODk2XCI6IFwieHdlZGdlO1wiLFxuICAgIFwiODg5N1wiOiBcInh2ZWU7XCIsXG4gICAgXCI4ODk4XCI6IFwieGNhcDtcIixcbiAgICBcIjg4OTlcIjogXCJ4Y3VwO1wiLFxuICAgIFwiODkwMFwiOiBcImRpYW1vbmQ7XCIsXG4gICAgXCI4OTAxXCI6IFwic2RvdDtcIixcbiAgICBcIjg5MDJcIjogXCJTdGFyO1wiLFxuICAgIFwiODkwM1wiOiBcImRpdm9ueDtcIixcbiAgICBcIjg5MDRcIjogXCJib3d0aWU7XCIsXG4gICAgXCI4OTA1XCI6IFwibHRpbWVzO1wiLFxuICAgIFwiODkwNlwiOiBcInJ0aW1lcztcIixcbiAgICBcIjg5MDdcIjogXCJsdGhyZWU7XCIsXG4gICAgXCI4OTA4XCI6IFwicnRocmVlO1wiLFxuICAgIFwiODkwOVwiOiBcImJzaW1lO1wiLFxuICAgIFwiODkxMFwiOiBcImN1dmVlO1wiLFxuICAgIFwiODkxMVwiOiBcImN1d2VkO1wiLFxuICAgIFwiODkxMlwiOiBcIlN1YnNldDtcIixcbiAgICBcIjg5MTNcIjogXCJTdXBzZXQ7XCIsXG4gICAgXCI4OTE0XCI6IFwiQ2FwO1wiLFxuICAgIFwiODkxNVwiOiBcIkN1cDtcIixcbiAgICBcIjg5MTZcIjogXCJwaXRjaGZvcms7XCIsXG4gICAgXCI4OTE3XCI6IFwiZXBhcjtcIixcbiAgICBcIjg5MThcIjogXCJsdGRvdDtcIixcbiAgICBcIjg5MTlcIjogXCJndHJkb3Q7XCIsXG4gICAgXCI4OTIwXCI6IFwiTGw7XCIsXG4gICAgXCI4OTIxXCI6IFwiZ2dnO1wiLFxuICAgIFwiODkyMlwiOiBcIkxlc3NFcXVhbEdyZWF0ZXI7XCIsXG4gICAgXCI4OTIzXCI6IFwiZ3RyZXFsZXNzO1wiLFxuICAgIFwiODkyNlwiOiBcImN1cmx5ZXFwcmVjO1wiLFxuICAgIFwiODkyN1wiOiBcImN1cmx5ZXFzdWNjO1wiLFxuICAgIFwiODkyOFwiOiBcIm5wcmN1ZTtcIixcbiAgICBcIjg5MjlcIjogXCJuc2NjdWU7XCIsXG4gICAgXCI4OTMwXCI6IFwibnNxc3ViZTtcIixcbiAgICBcIjg5MzFcIjogXCJuc3FzdXBlO1wiLFxuICAgIFwiODkzNFwiOiBcImxuc2ltO1wiLFxuICAgIFwiODkzNVwiOiBcImduc2ltO1wiLFxuICAgIFwiODkzNlwiOiBcInBybnNpbTtcIixcbiAgICBcIjg5MzdcIjogXCJzdWNjbnNpbTtcIixcbiAgICBcIjg5MzhcIjogXCJudHJpYW5nbGVsZWZ0O1wiLFxuICAgIFwiODkzOVwiOiBcIm50cmlhbmdsZXJpZ2h0O1wiLFxuICAgIFwiODk0MFwiOiBcIm50cmlhbmdsZWxlZnRlcTtcIixcbiAgICBcIjg5NDFcIjogXCJudHJpYW5nbGVyaWdodGVxO1wiLFxuICAgIFwiODk0MlwiOiBcInZlbGxpcDtcIixcbiAgICBcIjg5NDNcIjogXCJjdGRvdDtcIixcbiAgICBcIjg5NDRcIjogXCJ1dGRvdDtcIixcbiAgICBcIjg5NDVcIjogXCJkdGRvdDtcIixcbiAgICBcIjg5NDZcIjogXCJkaXNpbjtcIixcbiAgICBcIjg5NDdcIjogXCJpc2luc3Y7XCIsXG4gICAgXCI4OTQ4XCI6IFwiaXNpbnM7XCIsXG4gICAgXCI4OTQ5XCI6IFwiaXNpbmRvdDtcIixcbiAgICBcIjg5NTBcIjogXCJub3RpbnZjO1wiLFxuICAgIFwiODk1MVwiOiBcIm5vdGludmI7XCIsXG4gICAgXCI4OTUzXCI6IFwiaXNpbkU7XCIsXG4gICAgXCI4OTU0XCI6IFwibmlzZDtcIixcbiAgICBcIjg5NTVcIjogXCJ4bmlzO1wiLFxuICAgIFwiODk1NlwiOiBcIm5pcztcIixcbiAgICBcIjg5NTdcIjogXCJub3RuaXZjO1wiLFxuICAgIFwiODk1OFwiOiBcIm5vdG5pdmI7XCIsXG4gICAgXCI4OTY1XCI6IFwiYmFyd2VkZ2U7XCIsXG4gICAgXCI4OTY2XCI6IFwiZG91YmxlYmFyd2VkZ2U7XCIsXG4gICAgXCI4OTY4XCI6IFwiTGVmdENlaWxpbmc7XCIsXG4gICAgXCI4OTY5XCI6IFwiUmlnaHRDZWlsaW5nO1wiLFxuICAgIFwiODk3MFwiOiBcImxmbG9vcjtcIixcbiAgICBcIjg5NzFcIjogXCJSaWdodEZsb29yO1wiLFxuICAgIFwiODk3MlwiOiBcImRyY3JvcDtcIixcbiAgICBcIjg5NzNcIjogXCJkbGNyb3A7XCIsXG4gICAgXCI4OTc0XCI6IFwidXJjcm9wO1wiLFxuICAgIFwiODk3NVwiOiBcInVsY3JvcDtcIixcbiAgICBcIjg5NzZcIjogXCJibm90O1wiLFxuICAgIFwiODk3OFwiOiBcInByb2ZsaW5lO1wiLFxuICAgIFwiODk3OVwiOiBcInByb2ZzdXJmO1wiLFxuICAgIFwiODk4MVwiOiBcInRlbHJlYztcIixcbiAgICBcIjg5ODJcIjogXCJ0YXJnZXQ7XCIsXG4gICAgXCI4OTg4XCI6IFwidWxjb3JuZXI7XCIsXG4gICAgXCI4OTg5XCI6IFwidXJjb3JuZXI7XCIsXG4gICAgXCI4OTkwXCI6IFwibGxjb3JuZXI7XCIsXG4gICAgXCI4OTkxXCI6IFwibHJjb3JuZXI7XCIsXG4gICAgXCI4OTk0XCI6IFwic2Zyb3duO1wiLFxuICAgIFwiODk5NVwiOiBcInNzbWlsZTtcIixcbiAgICBcIjkwMDVcIjogXCJjeWxjdHk7XCIsXG4gICAgXCI5MDA2XCI6IFwicHJvZmFsYXI7XCIsXG4gICAgXCI5MDE0XCI6IFwidG9wYm90O1wiLFxuICAgIFwiOTAyMVwiOiBcIm92YmFyO1wiLFxuICAgIFwiOTAyM1wiOiBcInNvbGJhcjtcIixcbiAgICBcIjkwODRcIjogXCJhbmd6YXJyO1wiLFxuICAgIFwiOTEzNlwiOiBcImxtb3VzdGFjaGU7XCIsXG4gICAgXCI5MTM3XCI6IFwicm1vdXN0YWNoZTtcIixcbiAgICBcIjkxNDBcIjogXCJ0YnJrO1wiLFxuICAgIFwiOTE0MVwiOiBcIlVuZGVyQnJhY2tldDtcIixcbiAgICBcIjkxNDJcIjogXCJiYnJrdGJyaztcIixcbiAgICBcIjkxODBcIjogXCJPdmVyUGFyZW50aGVzaXM7XCIsXG4gICAgXCI5MTgxXCI6IFwiVW5kZXJQYXJlbnRoZXNpcztcIixcbiAgICBcIjkxODJcIjogXCJPdmVyQnJhY2U7XCIsXG4gICAgXCI5MTgzXCI6IFwiVW5kZXJCcmFjZTtcIixcbiAgICBcIjkxODZcIjogXCJ0cnBleml1bTtcIixcbiAgICBcIjkxOTFcIjogXCJlbGludGVycztcIixcbiAgICBcIjkyNTFcIjogXCJibGFuaztcIixcbiAgICBcIjk0MTZcIjogXCJvUztcIixcbiAgICBcIjk0NzJcIjogXCJIb3Jpem9udGFsTGluZTtcIixcbiAgICBcIjk0NzRcIjogXCJib3h2O1wiLFxuICAgIFwiOTQ4NFwiOiBcImJveGRyO1wiLFxuICAgIFwiOTQ4OFwiOiBcImJveGRsO1wiLFxuICAgIFwiOTQ5MlwiOiBcImJveHVyO1wiLFxuICAgIFwiOTQ5NlwiOiBcImJveHVsO1wiLFxuICAgIFwiOTUwMFwiOiBcImJveHZyO1wiLFxuICAgIFwiOTUwOFwiOiBcImJveHZsO1wiLFxuICAgIFwiOTUxNlwiOiBcImJveGhkO1wiLFxuICAgIFwiOTUyNFwiOiBcImJveGh1O1wiLFxuICAgIFwiOTUzMlwiOiBcImJveHZoO1wiLFxuICAgIFwiOTU1MlwiOiBcImJveEg7XCIsXG4gICAgXCI5NTUzXCI6IFwiYm94VjtcIixcbiAgICBcIjk1NTRcIjogXCJib3hkUjtcIixcbiAgICBcIjk1NTVcIjogXCJib3hEcjtcIixcbiAgICBcIjk1NTZcIjogXCJib3hEUjtcIixcbiAgICBcIjk1NTdcIjogXCJib3hkTDtcIixcbiAgICBcIjk1NThcIjogXCJib3hEbDtcIixcbiAgICBcIjk1NTlcIjogXCJib3hETDtcIixcbiAgICBcIjk1NjBcIjogXCJib3h1UjtcIixcbiAgICBcIjk1NjFcIjogXCJib3hVcjtcIixcbiAgICBcIjk1NjJcIjogXCJib3hVUjtcIixcbiAgICBcIjk1NjNcIjogXCJib3h1TDtcIixcbiAgICBcIjk1NjRcIjogXCJib3hVbDtcIixcbiAgICBcIjk1NjVcIjogXCJib3hVTDtcIixcbiAgICBcIjk1NjZcIjogXCJib3h2UjtcIixcbiAgICBcIjk1NjdcIjogXCJib3hWcjtcIixcbiAgICBcIjk1NjhcIjogXCJib3hWUjtcIixcbiAgICBcIjk1NjlcIjogXCJib3h2TDtcIixcbiAgICBcIjk1NzBcIjogXCJib3hWbDtcIixcbiAgICBcIjk1NzFcIjogXCJib3hWTDtcIixcbiAgICBcIjk1NzJcIjogXCJib3hIZDtcIixcbiAgICBcIjk1NzNcIjogXCJib3hoRDtcIixcbiAgICBcIjk1NzRcIjogXCJib3hIRDtcIixcbiAgICBcIjk1NzVcIjogXCJib3hIdTtcIixcbiAgICBcIjk1NzZcIjogXCJib3hoVTtcIixcbiAgICBcIjk1NzdcIjogXCJib3hIVTtcIixcbiAgICBcIjk1NzhcIjogXCJib3h2SDtcIixcbiAgICBcIjk1NzlcIjogXCJib3hWaDtcIixcbiAgICBcIjk1ODBcIjogXCJib3hWSDtcIixcbiAgICBcIjk2MDBcIjogXCJ1aGJsaztcIixcbiAgICBcIjk2MDRcIjogXCJsaGJsaztcIixcbiAgICBcIjk2MDhcIjogXCJibG9jaztcIixcbiAgICBcIjk2MTdcIjogXCJibGsxNDtcIixcbiAgICBcIjk2MThcIjogXCJibGsxMjtcIixcbiAgICBcIjk2MTlcIjogXCJibGszNDtcIixcbiAgICBcIjk2MzNcIjogXCJzcXVhcmU7XCIsXG4gICAgXCI5NjQyXCI6IFwic3F1ZjtcIixcbiAgICBcIjk2NDNcIjogXCJFbXB0eVZlcnlTbWFsbFNxdWFyZTtcIixcbiAgICBcIjk2NDVcIjogXCJyZWN0O1wiLFxuICAgIFwiOTY0NlwiOiBcIm1hcmtlcjtcIixcbiAgICBcIjk2NDlcIjogXCJmbHRucztcIixcbiAgICBcIjk2NTFcIjogXCJ4dXRyaTtcIixcbiAgICBcIjk2NTJcIjogXCJ1dHJpZjtcIixcbiAgICBcIjk2NTNcIjogXCJ1dHJpO1wiLFxuICAgIFwiOTY1NlwiOiBcInJ0cmlmO1wiLFxuICAgIFwiOTY1N1wiOiBcInRyaWFuZ2xlcmlnaHQ7XCIsXG4gICAgXCI5NjYxXCI6IFwieGR0cmk7XCIsXG4gICAgXCI5NjYyXCI6IFwiZHRyaWY7XCIsXG4gICAgXCI5NjYzXCI6IFwidHJpYW5nbGVkb3duO1wiLFxuICAgIFwiOTY2NlwiOiBcImx0cmlmO1wiLFxuICAgIFwiOTY2N1wiOiBcInRyaWFuZ2xlbGVmdDtcIixcbiAgICBcIjk2NzRcIjogXCJsb3plbmdlO1wiLFxuICAgIFwiOTY3NVwiOiBcImNpcjtcIixcbiAgICBcIjk3MDhcIjogXCJ0cmlkb3Q7XCIsXG4gICAgXCI5NzExXCI6IFwieGNpcmM7XCIsXG4gICAgXCI5NzIwXCI6IFwidWx0cmk7XCIsXG4gICAgXCI5NzIxXCI6IFwidXJ0cmk7XCIsXG4gICAgXCI5NzIyXCI6IFwibGx0cmk7XCIsXG4gICAgXCI5NzIzXCI6IFwiRW1wdHlTbWFsbFNxdWFyZTtcIixcbiAgICBcIjk3MjRcIjogXCJGaWxsZWRTbWFsbFNxdWFyZTtcIixcbiAgICBcIjk3MzNcIjogXCJzdGFyZjtcIixcbiAgICBcIjk3MzRcIjogXCJzdGFyO1wiLFxuICAgIFwiOTc0MlwiOiBcInBob25lO1wiLFxuICAgIFwiOTc5MlwiOiBcImZlbWFsZTtcIixcbiAgICBcIjk3OTRcIjogXCJtYWxlO1wiLFxuICAgIFwiOTgyNFwiOiBcInNwYWRlc3VpdDtcIixcbiAgICBcIjk4MjdcIjogXCJjbHVic3VpdDtcIixcbiAgICBcIjk4MjlcIjogXCJoZWFydHN1aXQ7XCIsXG4gICAgXCI5ODMwXCI6IFwiZGlhbXM7XCIsXG4gICAgXCI5ODM0XCI6IFwic3VuZztcIixcbiAgICBcIjk4MzdcIjogXCJmbGF0O1wiLFxuICAgIFwiOTgzOFwiOiBcIm5hdHVyYWw7XCIsXG4gICAgXCI5ODM5XCI6IFwic2hhcnA7XCIsXG4gICAgXCIxMDAwM1wiOiBcImNoZWNrbWFyaztcIixcbiAgICBcIjEwMDA3XCI6IFwiY3Jvc3M7XCIsXG4gICAgXCIxMDAxNlwiOiBcIm1hbHRlc2U7XCIsXG4gICAgXCIxMDAzOFwiOiBcInNleHQ7XCIsXG4gICAgXCIxMDA3MlwiOiBcIlZlcnRpY2FsU2VwYXJhdG9yO1wiLFxuICAgIFwiMTAwOThcIjogXCJsYmJyaztcIixcbiAgICBcIjEwMDk5XCI6IFwicmJicms7XCIsXG4gICAgXCIxMDE4NFwiOiBcImJzb2xoc3ViO1wiLFxuICAgIFwiMTAxODVcIjogXCJzdXBoc29sO1wiLFxuICAgIFwiMTAyMTRcIjogXCJsb2JyaztcIixcbiAgICBcIjEwMjE1XCI6IFwicm9icms7XCIsXG4gICAgXCIxMDIxNlwiOiBcIkxlZnRBbmdsZUJyYWNrZXQ7XCIsXG4gICAgXCIxMDIxN1wiOiBcIlJpZ2h0QW5nbGVCcmFja2V0O1wiLFxuICAgIFwiMTAyMThcIjogXCJMYW5nO1wiLFxuICAgIFwiMTAyMTlcIjogXCJSYW5nO1wiLFxuICAgIFwiMTAyMjBcIjogXCJsb2FuZztcIixcbiAgICBcIjEwMjIxXCI6IFwicm9hbmc7XCIsXG4gICAgXCIxMDIyOVwiOiBcInhsYXJyO1wiLFxuICAgIFwiMTAyMzBcIjogXCJ4cmFycjtcIixcbiAgICBcIjEwMjMxXCI6IFwieGhhcnI7XCIsXG4gICAgXCIxMDIzMlwiOiBcInhsQXJyO1wiLFxuICAgIFwiMTAyMzNcIjogXCJ4ckFycjtcIixcbiAgICBcIjEwMjM0XCI6IFwieGhBcnI7XCIsXG4gICAgXCIxMDIzNlwiOiBcInhtYXA7XCIsXG4gICAgXCIxMDIzOVwiOiBcImR6aWdyYXJyO1wiLFxuICAgIFwiMTA0OThcIjogXCJudmxBcnI7XCIsXG4gICAgXCIxMDQ5OVwiOiBcIm52ckFycjtcIixcbiAgICBcIjEwNTAwXCI6IFwibnZIYXJyO1wiLFxuICAgIFwiMTA1MDFcIjogXCJNYXA7XCIsXG4gICAgXCIxMDUwOFwiOiBcImxiYXJyO1wiLFxuICAgIFwiMTA1MDlcIjogXCJyYmFycjtcIixcbiAgICBcIjEwNTEwXCI6IFwibEJhcnI7XCIsXG4gICAgXCIxMDUxMVwiOiBcInJCYXJyO1wiLFxuICAgIFwiMTA1MTJcIjogXCJSQmFycjtcIixcbiAgICBcIjEwNTEzXCI6IFwiRERvdHJhaGQ7XCIsXG4gICAgXCIxMDUxNFwiOiBcIlVwQXJyb3dCYXI7XCIsXG4gICAgXCIxMDUxNVwiOiBcIkRvd25BcnJvd0JhcjtcIixcbiAgICBcIjEwNTE4XCI6IFwiUmFycnRsO1wiLFxuICAgIFwiMTA1MjFcIjogXCJsYXRhaWw7XCIsXG4gICAgXCIxMDUyMlwiOiBcInJhdGFpbDtcIixcbiAgICBcIjEwNTIzXCI6IFwibEF0YWlsO1wiLFxuICAgIFwiMTA1MjRcIjogXCJyQXRhaWw7XCIsXG4gICAgXCIxMDUyNVwiOiBcImxhcnJmcztcIixcbiAgICBcIjEwNTI2XCI6IFwicmFycmZzO1wiLFxuICAgIFwiMTA1MjdcIjogXCJsYXJyYmZzO1wiLFxuICAgIFwiMTA1MjhcIjogXCJyYXJyYmZzO1wiLFxuICAgIFwiMTA1MzFcIjogXCJud2FyaGs7XCIsXG4gICAgXCIxMDUzMlwiOiBcIm5lYXJoaztcIixcbiAgICBcIjEwNTMzXCI6IFwic2VhcmhrO1wiLFxuICAgIFwiMTA1MzRcIjogXCJzd2FyaGs7XCIsXG4gICAgXCIxMDUzNVwiOiBcIm53bmVhcjtcIixcbiAgICBcIjEwNTM2XCI6IFwidG9lYTtcIixcbiAgICBcIjEwNTM3XCI6IFwidG9zYTtcIixcbiAgICBcIjEwNTM4XCI6IFwic3dud2FyO1wiLFxuICAgIFwiMTA1NDdcIjogXCJyYXJyYztcIixcbiAgICBcIjEwNTQ5XCI6IFwiY3VkYXJycjtcIixcbiAgICBcIjEwNTUwXCI6IFwibGRjYTtcIixcbiAgICBcIjEwNTUxXCI6IFwicmRjYTtcIixcbiAgICBcIjEwNTUyXCI6IFwiY3VkYXJybDtcIixcbiAgICBcIjEwNTUzXCI6IFwibGFycnBsO1wiLFxuICAgIFwiMTA1NTZcIjogXCJjdXJhcnJtO1wiLFxuICAgIFwiMTA1NTdcIjogXCJjdWxhcnJwO1wiLFxuICAgIFwiMTA1NjVcIjogXCJyYXJycGw7XCIsXG4gICAgXCIxMDU2OFwiOiBcImhhcnJjaXI7XCIsXG4gICAgXCIxMDU2OVwiOiBcIlVhcnJvY2lyO1wiLFxuICAgIFwiMTA1NzBcIjogXCJsdXJkc2hhcjtcIixcbiAgICBcIjEwNTcxXCI6IFwibGRydXNoYXI7XCIsXG4gICAgXCIxMDU3NFwiOiBcIkxlZnRSaWdodFZlY3RvcjtcIixcbiAgICBcIjEwNTc1XCI6IFwiUmlnaHRVcERvd25WZWN0b3I7XCIsXG4gICAgXCIxMDU3NlwiOiBcIkRvd25MZWZ0UmlnaHRWZWN0b3I7XCIsXG4gICAgXCIxMDU3N1wiOiBcIkxlZnRVcERvd25WZWN0b3I7XCIsXG4gICAgXCIxMDU3OFwiOiBcIkxlZnRWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU3OVwiOiBcIlJpZ2h0VmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODBcIjogXCJSaWdodFVwVmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODFcIjogXCJSaWdodERvd25WZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4MlwiOiBcIkRvd25MZWZ0VmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODNcIjogXCJEb3duUmlnaHRWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4NFwiOiBcIkxlZnRVcFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTg1XCI6IFwiTGVmdERvd25WZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4NlwiOiBcIkxlZnRUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU4N1wiOiBcIlJpZ2h0VGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1ODhcIjogXCJSaWdodFVwVGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1ODlcIjogXCJSaWdodERvd25UZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5MFwiOiBcIkRvd25MZWZ0VGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1OTFcIjogXCJEb3duUmlnaHRUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5MlwiOiBcIkxlZnRVcFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTkzXCI6IFwiTGVmdERvd25UZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5NFwiOiBcImxIYXI7XCIsXG4gICAgXCIxMDU5NVwiOiBcInVIYXI7XCIsXG4gICAgXCIxMDU5NlwiOiBcInJIYXI7XCIsXG4gICAgXCIxMDU5N1wiOiBcImRIYXI7XCIsXG4gICAgXCIxMDU5OFwiOiBcImx1cnVoYXI7XCIsXG4gICAgXCIxMDU5OVwiOiBcImxkcmRoYXI7XCIsXG4gICAgXCIxMDYwMFwiOiBcInJ1bHVoYXI7XCIsXG4gICAgXCIxMDYwMVwiOiBcInJkbGRoYXI7XCIsXG4gICAgXCIxMDYwMlwiOiBcImxoYXJ1bDtcIixcbiAgICBcIjEwNjAzXCI6IFwibGxoYXJkO1wiLFxuICAgIFwiMTA2MDRcIjogXCJyaGFydWw7XCIsXG4gICAgXCIxMDYwNVwiOiBcImxyaGFyZDtcIixcbiAgICBcIjEwNjA2XCI6IFwiVXBFcXVpbGlicml1bTtcIixcbiAgICBcIjEwNjA3XCI6IFwiUmV2ZXJzZVVwRXF1aWxpYnJpdW07XCIsXG4gICAgXCIxMDYwOFwiOiBcIlJvdW5kSW1wbGllcztcIixcbiAgICBcIjEwNjA5XCI6IFwiZXJhcnI7XCIsXG4gICAgXCIxMDYxMFwiOiBcInNpbXJhcnI7XCIsXG4gICAgXCIxMDYxMVwiOiBcImxhcnJzaW07XCIsXG4gICAgXCIxMDYxMlwiOiBcInJhcnJzaW07XCIsXG4gICAgXCIxMDYxM1wiOiBcInJhcnJhcDtcIixcbiAgICBcIjEwNjE0XCI6IFwibHRsYXJyO1wiLFxuICAgIFwiMTA2MTZcIjogXCJndHJhcnI7XCIsXG4gICAgXCIxMDYxN1wiOiBcInN1YnJhcnI7XCIsXG4gICAgXCIxMDYxOVwiOiBcInN1cGxhcnI7XCIsXG4gICAgXCIxMDYyMFwiOiBcImxmaXNodDtcIixcbiAgICBcIjEwNjIxXCI6IFwicmZpc2h0O1wiLFxuICAgIFwiMTA2MjJcIjogXCJ1ZmlzaHQ7XCIsXG4gICAgXCIxMDYyM1wiOiBcImRmaXNodDtcIixcbiAgICBcIjEwNjI5XCI6IFwibG9wYXI7XCIsXG4gICAgXCIxMDYzMFwiOiBcInJvcGFyO1wiLFxuICAgIFwiMTA2MzVcIjogXCJsYnJrZTtcIixcbiAgICBcIjEwNjM2XCI6IFwicmJya2U7XCIsXG4gICAgXCIxMDYzN1wiOiBcImxicmtzbHU7XCIsXG4gICAgXCIxMDYzOFwiOiBcInJicmtzbGQ7XCIsXG4gICAgXCIxMDYzOVwiOiBcImxicmtzbGQ7XCIsXG4gICAgXCIxMDY0MFwiOiBcInJicmtzbHU7XCIsXG4gICAgXCIxMDY0MVwiOiBcImxhbmdkO1wiLFxuICAgIFwiMTA2NDJcIjogXCJyYW5nZDtcIixcbiAgICBcIjEwNjQzXCI6IFwibHBhcmx0O1wiLFxuICAgIFwiMTA2NDRcIjogXCJycGFyZ3Q7XCIsXG4gICAgXCIxMDY0NVwiOiBcImd0bFBhcjtcIixcbiAgICBcIjEwNjQ2XCI6IFwibHRyUGFyO1wiLFxuICAgIFwiMTA2NTBcIjogXCJ2emlnemFnO1wiLFxuICAgIFwiMTA2NTJcIjogXCJ2YW5ncnQ7XCIsXG4gICAgXCIxMDY1M1wiOiBcImFuZ3J0dmJkO1wiLFxuICAgIFwiMTA2NjBcIjogXCJhbmdlO1wiLFxuICAgIFwiMTA2NjFcIjogXCJyYW5nZTtcIixcbiAgICBcIjEwNjYyXCI6IFwiZHdhbmdsZTtcIixcbiAgICBcIjEwNjYzXCI6IFwidXdhbmdsZTtcIixcbiAgICBcIjEwNjY0XCI6IFwiYW5nbXNkYWE7XCIsXG4gICAgXCIxMDY2NVwiOiBcImFuZ21zZGFiO1wiLFxuICAgIFwiMTA2NjZcIjogXCJhbmdtc2RhYztcIixcbiAgICBcIjEwNjY3XCI6IFwiYW5nbXNkYWQ7XCIsXG4gICAgXCIxMDY2OFwiOiBcImFuZ21zZGFlO1wiLFxuICAgIFwiMTA2NjlcIjogXCJhbmdtc2RhZjtcIixcbiAgICBcIjEwNjcwXCI6IFwiYW5nbXNkYWc7XCIsXG4gICAgXCIxMDY3MVwiOiBcImFuZ21zZGFoO1wiLFxuICAgIFwiMTA2NzJcIjogXCJiZW1wdHl2O1wiLFxuICAgIFwiMTA2NzNcIjogXCJkZW1wdHl2O1wiLFxuICAgIFwiMTA2NzRcIjogXCJjZW1wdHl2O1wiLFxuICAgIFwiMTA2NzVcIjogXCJyYWVtcHR5djtcIixcbiAgICBcIjEwNjc2XCI6IFwibGFlbXB0eXY7XCIsXG4gICAgXCIxMDY3N1wiOiBcIm9oYmFyO1wiLFxuICAgIFwiMTA2NzhcIjogXCJvbWlkO1wiLFxuICAgIFwiMTA2NzlcIjogXCJvcGFyO1wiLFxuICAgIFwiMTA2ODFcIjogXCJvcGVycDtcIixcbiAgICBcIjEwNjgzXCI6IFwib2xjcm9zcztcIixcbiAgICBcIjEwNjg0XCI6IFwib2Rzb2xkO1wiLFxuICAgIFwiMTA2ODZcIjogXCJvbGNpcjtcIixcbiAgICBcIjEwNjg3XCI6IFwib2ZjaXI7XCIsXG4gICAgXCIxMDY4OFwiOiBcIm9sdDtcIixcbiAgICBcIjEwNjg5XCI6IFwib2d0O1wiLFxuICAgIFwiMTA2OTBcIjogXCJjaXJzY2lyO1wiLFxuICAgIFwiMTA2OTFcIjogXCJjaXJFO1wiLFxuICAgIFwiMTA2OTJcIjogXCJzb2xiO1wiLFxuICAgIFwiMTA2OTNcIjogXCJic29sYjtcIixcbiAgICBcIjEwNjk3XCI6IFwiYm94Ym94O1wiLFxuICAgIFwiMTA3MDFcIjogXCJ0cmlzYjtcIixcbiAgICBcIjEwNzAyXCI6IFwicnRyaWx0cmk7XCIsXG4gICAgXCIxMDcwM1wiOiBcIkxlZnRUcmlhbmdsZUJhcjtcIixcbiAgICBcIjEwNzA0XCI6IFwiUmlnaHRUcmlhbmdsZUJhcjtcIixcbiAgICBcIjEwNzE2XCI6IFwiaWluZmluO1wiLFxuICAgIFwiMTA3MTdcIjogXCJpbmZpbnRpZTtcIixcbiAgICBcIjEwNzE4XCI6IFwibnZpbmZpbjtcIixcbiAgICBcIjEwNzIzXCI6IFwiZXBhcnNsO1wiLFxuICAgIFwiMTA3MjRcIjogXCJzbWVwYXJzbDtcIixcbiAgICBcIjEwNzI1XCI6IFwiZXF2cGFyc2w7XCIsXG4gICAgXCIxMDczMVwiOiBcImxvemY7XCIsXG4gICAgXCIxMDc0MFwiOiBcIlJ1bGVEZWxheWVkO1wiLFxuICAgIFwiMTA3NDJcIjogXCJkc29sO1wiLFxuICAgIFwiMTA3NTJcIjogXCJ4b2RvdDtcIixcbiAgICBcIjEwNzUzXCI6IFwieG9wbHVzO1wiLFxuICAgIFwiMTA3NTRcIjogXCJ4b3RpbWU7XCIsXG4gICAgXCIxMDc1NlwiOiBcInh1cGx1cztcIixcbiAgICBcIjEwNzU4XCI6IFwieHNxY3VwO1wiLFxuICAgIFwiMTA3NjRcIjogXCJxaW50O1wiLFxuICAgIFwiMTA3NjVcIjogXCJmcGFydGludDtcIixcbiAgICBcIjEwNzY4XCI6IFwiY2lyZm5pbnQ7XCIsXG4gICAgXCIxMDc2OVwiOiBcImF3aW50O1wiLFxuICAgIFwiMTA3NzBcIjogXCJycHBvbGludDtcIixcbiAgICBcIjEwNzcxXCI6IFwic2Nwb2xpbnQ7XCIsXG4gICAgXCIxMDc3MlwiOiBcIm5wb2xpbnQ7XCIsXG4gICAgXCIxMDc3M1wiOiBcInBvaW50aW50O1wiLFxuICAgIFwiMTA3NzRcIjogXCJxdWF0aW50O1wiLFxuICAgIFwiMTA3NzVcIjogXCJpbnRsYXJoaztcIixcbiAgICBcIjEwNzg2XCI6IFwicGx1c2NpcjtcIixcbiAgICBcIjEwNzg3XCI6IFwicGx1c2FjaXI7XCIsXG4gICAgXCIxMDc4OFwiOiBcInNpbXBsdXM7XCIsXG4gICAgXCIxMDc4OVwiOiBcInBsdXNkdTtcIixcbiAgICBcIjEwNzkwXCI6IFwicGx1c3NpbTtcIixcbiAgICBcIjEwNzkxXCI6IFwicGx1c3R3bztcIixcbiAgICBcIjEwNzkzXCI6IFwibWNvbW1hO1wiLFxuICAgIFwiMTA3OTRcIjogXCJtaW51c2R1O1wiLFxuICAgIFwiMTA3OTdcIjogXCJsb3BsdXM7XCIsXG4gICAgXCIxMDc5OFwiOiBcInJvcGx1cztcIixcbiAgICBcIjEwNzk5XCI6IFwiQ3Jvc3M7XCIsXG4gICAgXCIxMDgwMFwiOiBcInRpbWVzZDtcIixcbiAgICBcIjEwODAxXCI6IFwidGltZXNiYXI7XCIsXG4gICAgXCIxMDgwM1wiOiBcInNtYXNocDtcIixcbiAgICBcIjEwODA0XCI6IFwibG90aW1lcztcIixcbiAgICBcIjEwODA1XCI6IFwicm90aW1lcztcIixcbiAgICBcIjEwODA2XCI6IFwib3RpbWVzYXM7XCIsXG4gICAgXCIxMDgwN1wiOiBcIk90aW1lcztcIixcbiAgICBcIjEwODA4XCI6IFwib2RpdjtcIixcbiAgICBcIjEwODA5XCI6IFwidHJpcGx1cztcIixcbiAgICBcIjEwODEwXCI6IFwidHJpbWludXM7XCIsXG4gICAgXCIxMDgxMVwiOiBcInRyaXRpbWU7XCIsXG4gICAgXCIxMDgxMlwiOiBcImlwcm9kO1wiLFxuICAgIFwiMTA4MTVcIjogXCJhbWFsZztcIixcbiAgICBcIjEwODE2XCI6IFwiY2FwZG90O1wiLFxuICAgIFwiMTA4MThcIjogXCJuY3VwO1wiLFxuICAgIFwiMTA4MTlcIjogXCJuY2FwO1wiLFxuICAgIFwiMTA4MjBcIjogXCJjYXBhbmQ7XCIsXG4gICAgXCIxMDgyMVwiOiBcImN1cG9yO1wiLFxuICAgIFwiMTA4MjJcIjogXCJjdXBjYXA7XCIsXG4gICAgXCIxMDgyM1wiOiBcImNhcGN1cDtcIixcbiAgICBcIjEwODI0XCI6IFwiY3VwYnJjYXA7XCIsXG4gICAgXCIxMDgyNVwiOiBcImNhcGJyY3VwO1wiLFxuICAgIFwiMTA4MjZcIjogXCJjdXBjdXA7XCIsXG4gICAgXCIxMDgyN1wiOiBcImNhcGNhcDtcIixcbiAgICBcIjEwODI4XCI6IFwiY2N1cHM7XCIsXG4gICAgXCIxMDgyOVwiOiBcImNjYXBzO1wiLFxuICAgIFwiMTA4MzJcIjogXCJjY3Vwc3NtO1wiLFxuICAgIFwiMTA4MzVcIjogXCJBbmQ7XCIsXG4gICAgXCIxMDgzNlwiOiBcIk9yO1wiLFxuICAgIFwiMTA4MzdcIjogXCJhbmRhbmQ7XCIsXG4gICAgXCIxMDgzOFwiOiBcIm9yb3I7XCIsXG4gICAgXCIxMDgzOVwiOiBcIm9yc2xvcGU7XCIsXG4gICAgXCIxMDg0MFwiOiBcImFuZHNsb3BlO1wiLFxuICAgIFwiMTA4NDJcIjogXCJhbmR2O1wiLFxuICAgIFwiMTA4NDNcIjogXCJvcnY7XCIsXG4gICAgXCIxMDg0NFwiOiBcImFuZGQ7XCIsXG4gICAgXCIxMDg0NVwiOiBcIm9yZDtcIixcbiAgICBcIjEwODQ3XCI6IFwid2VkYmFyO1wiLFxuICAgIFwiMTA4NTRcIjogXCJzZG90ZTtcIixcbiAgICBcIjEwODU4XCI6IFwic2ltZG90O1wiLFxuICAgIFwiMTA4NjFcIjogXCJjb25nZG90O1wiLFxuICAgIFwiMTA4NjJcIjogXCJlYXN0ZXI7XCIsXG4gICAgXCIxMDg2M1wiOiBcImFwYWNpcjtcIixcbiAgICBcIjEwODY0XCI6IFwiYXBFO1wiLFxuICAgIFwiMTA4NjVcIjogXCJlcGx1cztcIixcbiAgICBcIjEwODY2XCI6IFwicGx1c2U7XCIsXG4gICAgXCIxMDg2N1wiOiBcIkVzaW07XCIsXG4gICAgXCIxMDg2OFwiOiBcIkNvbG9uZTtcIixcbiAgICBcIjEwODY5XCI6IFwiRXF1YWw7XCIsXG4gICAgXCIxMDg3MVwiOiBcImVERG90O1wiLFxuICAgIFwiMTA4NzJcIjogXCJlcXVpdkREO1wiLFxuICAgIFwiMTA4NzNcIjogXCJsdGNpcjtcIixcbiAgICBcIjEwODc0XCI6IFwiZ3RjaXI7XCIsXG4gICAgXCIxMDg3NVwiOiBcImx0cXVlc3Q7XCIsXG4gICAgXCIxMDg3NlwiOiBcImd0cXVlc3Q7XCIsXG4gICAgXCIxMDg3N1wiOiBcIkxlc3NTbGFudEVxdWFsO1wiLFxuICAgIFwiMTA4NzhcIjogXCJHcmVhdGVyU2xhbnRFcXVhbDtcIixcbiAgICBcIjEwODc5XCI6IFwibGVzZG90O1wiLFxuICAgIFwiMTA4ODBcIjogXCJnZXNkb3Q7XCIsXG4gICAgXCIxMDg4MVwiOiBcImxlc2RvdG87XCIsXG4gICAgXCIxMDg4MlwiOiBcImdlc2RvdG87XCIsXG4gICAgXCIxMDg4M1wiOiBcImxlc2RvdG9yO1wiLFxuICAgIFwiMTA4ODRcIjogXCJnZXNkb3RvbDtcIixcbiAgICBcIjEwODg1XCI6IFwibGVzc2FwcHJveDtcIixcbiAgICBcIjEwODg2XCI6IFwiZ3RyYXBwcm94O1wiLFxuICAgIFwiMTA4ODdcIjogXCJsbmVxO1wiLFxuICAgIFwiMTA4ODhcIjogXCJnbmVxO1wiLFxuICAgIFwiMTA4ODlcIjogXCJsbmFwcHJveDtcIixcbiAgICBcIjEwODkwXCI6IFwiZ25hcHByb3g7XCIsXG4gICAgXCIxMDg5MVwiOiBcImxlc3NlcXFndHI7XCIsXG4gICAgXCIxMDg5MlwiOiBcImd0cmVxcWxlc3M7XCIsXG4gICAgXCIxMDg5M1wiOiBcImxzaW1lO1wiLFxuICAgIFwiMTA4OTRcIjogXCJnc2ltZTtcIixcbiAgICBcIjEwODk1XCI6IFwibHNpbWc7XCIsXG4gICAgXCIxMDg5NlwiOiBcImdzaW1sO1wiLFxuICAgIFwiMTA4OTdcIjogXCJsZ0U7XCIsXG4gICAgXCIxMDg5OFwiOiBcImdsRTtcIixcbiAgICBcIjEwODk5XCI6IFwibGVzZ2VzO1wiLFxuICAgIFwiMTA5MDBcIjogXCJnZXNsZXM7XCIsXG4gICAgXCIxMDkwMVwiOiBcImVxc2xhbnRsZXNzO1wiLFxuICAgIFwiMTA5MDJcIjogXCJlcXNsYW50Z3RyO1wiLFxuICAgIFwiMTA5MDNcIjogXCJlbHNkb3Q7XCIsXG4gICAgXCIxMDkwNFwiOiBcImVnc2RvdDtcIixcbiAgICBcIjEwOTA1XCI6IFwiZWw7XCIsXG4gICAgXCIxMDkwNlwiOiBcImVnO1wiLFxuICAgIFwiMTA5MDlcIjogXCJzaW1sO1wiLFxuICAgIFwiMTA5MTBcIjogXCJzaW1nO1wiLFxuICAgIFwiMTA5MTFcIjogXCJzaW1sRTtcIixcbiAgICBcIjEwOTEyXCI6IFwic2ltZ0U7XCIsXG4gICAgXCIxMDkxM1wiOiBcIkxlc3NMZXNzO1wiLFxuICAgIFwiMTA5MTRcIjogXCJHcmVhdGVyR3JlYXRlcjtcIixcbiAgICBcIjEwOTE2XCI6IFwiZ2xqO1wiLFxuICAgIFwiMTA5MTdcIjogXCJnbGE7XCIsXG4gICAgXCIxMDkxOFwiOiBcImx0Y2M7XCIsXG4gICAgXCIxMDkxOVwiOiBcImd0Y2M7XCIsXG4gICAgXCIxMDkyMFwiOiBcImxlc2NjO1wiLFxuICAgIFwiMTA5MjFcIjogXCJnZXNjYztcIixcbiAgICBcIjEwOTIyXCI6IFwic210O1wiLFxuICAgIFwiMTA5MjNcIjogXCJsYXQ7XCIsXG4gICAgXCIxMDkyNFwiOiBcInNtdGU7XCIsXG4gICAgXCIxMDkyNVwiOiBcImxhdGU7XCIsXG4gICAgXCIxMDkyNlwiOiBcImJ1bXBFO1wiLFxuICAgIFwiMTA5MjdcIjogXCJwcmVjZXE7XCIsXG4gICAgXCIxMDkyOFwiOiBcInN1Y2NlcTtcIixcbiAgICBcIjEwOTMxXCI6IFwicHJFO1wiLFxuICAgIFwiMTA5MzJcIjogXCJzY0U7XCIsXG4gICAgXCIxMDkzM1wiOiBcInBybkU7XCIsXG4gICAgXCIxMDkzNFwiOiBcInN1Y2NuZXFxO1wiLFxuICAgIFwiMTA5MzVcIjogXCJwcmVjYXBwcm94O1wiLFxuICAgIFwiMTA5MzZcIjogXCJzdWNjYXBwcm94O1wiLFxuICAgIFwiMTA5MzdcIjogXCJwcm5hcDtcIixcbiAgICBcIjEwOTM4XCI6IFwic3VjY25hcHByb3g7XCIsXG4gICAgXCIxMDkzOVwiOiBcIlByO1wiLFxuICAgIFwiMTA5NDBcIjogXCJTYztcIixcbiAgICBcIjEwOTQxXCI6IFwic3ViZG90O1wiLFxuICAgIFwiMTA5NDJcIjogXCJzdXBkb3Q7XCIsXG4gICAgXCIxMDk0M1wiOiBcInN1YnBsdXM7XCIsXG4gICAgXCIxMDk0NFwiOiBcInN1cHBsdXM7XCIsXG4gICAgXCIxMDk0NVwiOiBcInN1Ym11bHQ7XCIsXG4gICAgXCIxMDk0NlwiOiBcInN1cG11bHQ7XCIsXG4gICAgXCIxMDk0N1wiOiBcInN1YmVkb3Q7XCIsXG4gICAgXCIxMDk0OFwiOiBcInN1cGVkb3Q7XCIsXG4gICAgXCIxMDk0OVwiOiBcInN1YnNldGVxcTtcIixcbiAgICBcIjEwOTUwXCI6IFwic3Vwc2V0ZXFxO1wiLFxuICAgIFwiMTA5NTFcIjogXCJzdWJzaW07XCIsXG4gICAgXCIxMDk1MlwiOiBcInN1cHNpbTtcIixcbiAgICBcIjEwOTU1XCI6IFwic3Vic2V0bmVxcTtcIixcbiAgICBcIjEwOTU2XCI6IFwic3Vwc2V0bmVxcTtcIixcbiAgICBcIjEwOTU5XCI6IFwiY3N1YjtcIixcbiAgICBcIjEwOTYwXCI6IFwiY3N1cDtcIixcbiAgICBcIjEwOTYxXCI6IFwiY3N1YmU7XCIsXG4gICAgXCIxMDk2MlwiOiBcImNzdXBlO1wiLFxuICAgIFwiMTA5NjNcIjogXCJzdWJzdXA7XCIsXG4gICAgXCIxMDk2NFwiOiBcInN1cHN1YjtcIixcbiAgICBcIjEwOTY1XCI6IFwic3Vic3ViO1wiLFxuICAgIFwiMTA5NjZcIjogXCJzdXBzdXA7XCIsXG4gICAgXCIxMDk2N1wiOiBcInN1cGhzdWI7XCIsXG4gICAgXCIxMDk2OFwiOiBcInN1cGRzdWI7XCIsXG4gICAgXCIxMDk2OVwiOiBcImZvcmt2O1wiLFxuICAgIFwiMTA5NzBcIjogXCJ0b3Bmb3JrO1wiLFxuICAgIFwiMTA5NzFcIjogXCJtbGNwO1wiLFxuICAgIFwiMTA5ODBcIjogXCJEb3VibGVMZWZ0VGVlO1wiLFxuICAgIFwiMTA5ODJcIjogXCJWZGFzaGw7XCIsXG4gICAgXCIxMDk4M1wiOiBcIkJhcnY7XCIsXG4gICAgXCIxMDk4NFwiOiBcInZCYXI7XCIsXG4gICAgXCIxMDk4NVwiOiBcInZCYXJ2O1wiLFxuICAgIFwiMTA5ODdcIjogXCJWYmFyO1wiLFxuICAgIFwiMTA5ODhcIjogXCJOb3Q7XCIsXG4gICAgXCIxMDk4OVwiOiBcImJOb3Q7XCIsXG4gICAgXCIxMDk5MFwiOiBcInJubWlkO1wiLFxuICAgIFwiMTA5OTFcIjogXCJjaXJtaWQ7XCIsXG4gICAgXCIxMDk5MlwiOiBcIm1pZGNpcjtcIixcbiAgICBcIjEwOTkzXCI6IFwidG9wY2lyO1wiLFxuICAgIFwiMTA5OTRcIjogXCJuaHBhcjtcIixcbiAgICBcIjEwOTk1XCI6IFwicGFyc2ltO1wiLFxuICAgIFwiMTEwMDVcIjogXCJwYXJzbDtcIixcbiAgICBcIjY0MjU2XCI6IFwiZmZsaWc7XCIsXG4gICAgXCI2NDI1N1wiOiBcImZpbGlnO1wiLFxuICAgIFwiNjQyNThcIjogXCJmbGxpZztcIixcbiAgICBcIjY0MjU5XCI6IFwiZmZpbGlnO1wiLFxuICAgIFwiNjQyNjBcIjogXCJmZmxsaWc7XCJcbn0iLCIvKlxuXG5cdEhhc2hpZHNcblx0aHR0cDovL2hhc2hpZHMub3JnL25vZGUtanNcblx0KGMpIDIwMTMgSXZhbiBBa2ltb3ZcblxuXHRodHRwczovL2dpdGh1Yi5jb20vaXZhbmFraW1vdi9oYXNoaWRzLm5vZGUuanNcblx0aGFzaGlkcyBtYXkgYmUgZnJlZWx5IGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cblxuKi9cblxuLypqc2xpbnQgbm9kZTogdHJ1ZSwgd2hpdGU6IHRydWUsIHBsdXNwbHVzOiB0cnVlLCBub21lbjogdHJ1ZSAqL1xuXG5cInVzZSBzdHJpY3RcIjtcblxuZnVuY3Rpb24gSGFzaGlkcyhzYWx0LCBtaW5IYXNoTGVuZ3RoLCBhbHBoYWJldCkge1xuXG5cdHZhciB1bmlxdWVBbHBoYWJldCwgaSwgaiwgbGVuLCBzZXBzTGVuZ3RoLCBkaWZmLCBndWFyZENvdW50O1xuXG5cdGlmICghKHRoaXMgaW5zdGFuY2VvZiBIYXNoaWRzKSkge1xuXHRcdHJldHVybiBuZXcgSGFzaGlkcyhzYWx0LCBtaW5IYXNoTGVuZ3RoLCBhbHBoYWJldCk7XG5cdH1cblxuXHR0aGlzLnZlcnNpb24gPSBcIjEuMC4xXCI7XG5cblx0LyogaW50ZXJuYWwgc2V0dGluZ3MgKi9cblxuXHR0aGlzLm1pbkFscGhhYmV0TGVuZ3RoID0gMTY7XG5cdHRoaXMuc2VwRGl2ID0gMy41O1xuXHR0aGlzLmd1YXJkRGl2ID0gMTI7XG5cblx0LyogZXJyb3IgbWVzc2FnZXMgKi9cblxuXHR0aGlzLmVycm9yQWxwaGFiZXRMZW5ndGggPSBcImVycm9yOiBhbHBoYWJldCBtdXN0IGNvbnRhaW4gYXQgbGVhc3QgWCB1bmlxdWUgY2hhcmFjdGVyc1wiO1xuXHR0aGlzLmVycm9yQWxwaGFiZXRTcGFjZSA9IFwiZXJyb3I6IGFscGhhYmV0IGNhbm5vdCBjb250YWluIHNwYWNlc1wiO1xuXG5cdC8qIGFscGhhYmV0IHZhcnMgKi9cblxuXHR0aGlzLmFscGhhYmV0ID0gXCJhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaMTIzNDU2Nzg5MFwiO1xuXHR0aGlzLnNlcHMgPSBcImNmaGlzdHVDRkhJU1RVXCI7XG5cdHRoaXMubWluSGFzaExlbmd0aCA9IHBhcnNlSW50KG1pbkhhc2hMZW5ndGgsIDEwKSA+IDAgPyBtaW5IYXNoTGVuZ3RoIDogMDtcblx0dGhpcy5zYWx0ID0gKHR5cGVvZiBzYWx0ID09PSBcInN0cmluZ1wiKSA/IHNhbHQgOiBcIlwiO1xuXG5cdGlmICh0eXBlb2YgYWxwaGFiZXQgPT09IFwic3RyaW5nXCIpIHtcblx0XHR0aGlzLmFscGhhYmV0ID0gYWxwaGFiZXQ7XG5cdH1cblxuXHRmb3IgKHVuaXF1ZUFscGhhYmV0ID0gXCJcIiwgaSA9IDAsIGxlbiA9IHRoaXMuYWxwaGFiZXQubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXHRcdGlmICh1bmlxdWVBbHBoYWJldC5pbmRleE9mKHRoaXMuYWxwaGFiZXRbaV0pID09PSAtMSkge1xuXHRcdFx0dW5pcXVlQWxwaGFiZXQgKz0gdGhpcy5hbHBoYWJldFtpXTtcblx0XHR9XG5cdH1cblxuXHR0aGlzLmFscGhhYmV0ID0gdW5pcXVlQWxwaGFiZXQ7XG5cblx0aWYgKHRoaXMuYWxwaGFiZXQubGVuZ3RoIDwgdGhpcy5taW5BbHBoYWJldExlbmd0aCkge1xuXHRcdHRocm93IHRoaXMuZXJyb3JBbHBoYWJldExlbmd0aC5yZXBsYWNlKFwiWFwiLCB0aGlzLm1pbkFscGhhYmV0TGVuZ3RoKTtcblx0fVxuXG5cdGlmICh0aGlzLmFscGhhYmV0LnNlYXJjaChcIiBcIikgIT09IC0xKSB7XG5cdFx0dGhyb3cgdGhpcy5lcnJvckFscGhhYmV0U3BhY2U7XG5cdH1cblxuXHQvKiBzZXBzIHNob3VsZCBjb250YWluIG9ubHkgY2hhcmFjdGVycyBwcmVzZW50IGluIGFscGhhYmV0OyBhbHBoYWJldCBzaG91bGQgbm90IGNvbnRhaW5zIHNlcHMgKi9cblxuXHRmb3IgKGkgPSAwLCBsZW4gPSB0aGlzLnNlcHMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXG5cdFx0aiA9IHRoaXMuYWxwaGFiZXQuaW5kZXhPZih0aGlzLnNlcHNbaV0pO1xuXHRcdGlmIChqID09PSAtMSkge1xuXHRcdFx0dGhpcy5zZXBzID0gdGhpcy5zZXBzLnN1YnN0cigwLCBpKSArIFwiIFwiICsgdGhpcy5zZXBzLnN1YnN0cihpICsgMSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuYWxwaGFiZXQgPSB0aGlzLmFscGhhYmV0LnN1YnN0cigwLCBqKSArIFwiIFwiICsgdGhpcy5hbHBoYWJldC5zdWJzdHIoaiArIDEpO1xuXHRcdH1cblxuXHR9XG5cblx0dGhpcy5hbHBoYWJldCA9IHRoaXMuYWxwaGFiZXQucmVwbGFjZSgvIC9nLCBcIlwiKTtcblxuXHR0aGlzLnNlcHMgPSB0aGlzLnNlcHMucmVwbGFjZSgvIC9nLCBcIlwiKTtcblx0dGhpcy5zZXBzID0gdGhpcy5jb25zaXN0ZW50U2h1ZmZsZSh0aGlzLnNlcHMsIHRoaXMuc2FsdCk7XG5cblx0aWYgKCF0aGlzLnNlcHMubGVuZ3RoIHx8ICh0aGlzLmFscGhhYmV0Lmxlbmd0aCAvIHRoaXMuc2Vwcy5sZW5ndGgpID4gdGhpcy5zZXBEaXYpIHtcblxuXHRcdHNlcHNMZW5ndGggPSBNYXRoLmNlaWwodGhpcy5hbHBoYWJldC5sZW5ndGggLyB0aGlzLnNlcERpdik7XG5cblx0XHRpZiAoc2Vwc0xlbmd0aCA9PT0gMSkge1xuXHRcdFx0c2Vwc0xlbmd0aCsrO1xuXHRcdH1cblxuXHRcdGlmIChzZXBzTGVuZ3RoID4gdGhpcy5zZXBzLmxlbmd0aCkge1xuXG5cdFx0XHRkaWZmID0gc2Vwc0xlbmd0aCAtIHRoaXMuc2Vwcy5sZW5ndGg7XG5cdFx0XHR0aGlzLnNlcHMgKz0gdGhpcy5hbHBoYWJldC5zdWJzdHIoMCwgZGlmZik7XG5cdFx0XHR0aGlzLmFscGhhYmV0ID0gdGhpcy5hbHBoYWJldC5zdWJzdHIoZGlmZik7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZXBzID0gdGhpcy5zZXBzLnN1YnN0cigwLCBzZXBzTGVuZ3RoKTtcblx0XHR9XG5cblx0fVxuXG5cdHRoaXMuYWxwaGFiZXQgPSB0aGlzLmNvbnNpc3RlbnRTaHVmZmxlKHRoaXMuYWxwaGFiZXQsIHRoaXMuc2FsdCk7XG5cdGd1YXJkQ291bnQgPSBNYXRoLmNlaWwodGhpcy5hbHBoYWJldC5sZW5ndGggLyB0aGlzLmd1YXJkRGl2KTtcblxuXHRpZiAodGhpcy5hbHBoYWJldC5sZW5ndGggPCAzKSB7XG5cdFx0dGhpcy5ndWFyZHMgPSB0aGlzLnNlcHMuc3Vic3RyKDAsIGd1YXJkQ291bnQpO1xuXHRcdHRoaXMuc2VwcyA9IHRoaXMuc2Vwcy5zdWJzdHIoZ3VhcmRDb3VudCk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5ndWFyZHMgPSB0aGlzLmFscGhhYmV0LnN1YnN0cigwLCBndWFyZENvdW50KTtcblx0XHR0aGlzLmFscGhhYmV0ID0gdGhpcy5hbHBoYWJldC5zdWJzdHIoZ3VhcmRDb3VudCk7XG5cdH1cblxufVxuXG5IYXNoaWRzLnByb3RvdHlwZS5lbmNvZGUgPSBmdW5jdGlvbigpIHtcblxuXHR2YXIgcmV0ID0gXCJcIixcblx0XHRpLCBsZW4sXG5cdFx0bnVtYmVycyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cblx0aWYgKCFudW1iZXJzLmxlbmd0aCkge1xuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRpZiAobnVtYmVyc1swXSBpbnN0YW5jZW9mIEFycmF5KSB7XG5cdFx0bnVtYmVycyA9IG51bWJlcnNbMF07XG5cdH1cblxuXHRmb3IgKGkgPSAwLCBsZW4gPSBudW1iZXJzLmxlbmd0aDsgaSAhPT0gbGVuOyBpKyspIHtcblx0XHRpZiAodHlwZW9mIG51bWJlcnNbaV0gIT09IFwibnVtYmVyXCIgfHwgbnVtYmVyc1tpXSAlIDEgIT09IDAgfHwgbnVtYmVyc1tpXSA8IDApIHtcblx0XHRcdHJldHVybiByZXQ7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRoaXMuX2VuY29kZShudW1iZXJzKTtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuZGVjb2RlID0gZnVuY3Rpb24oaGFzaCkge1xuXG5cdHZhciByZXQgPSBbXTtcblxuXHRpZiAoIWhhc2gubGVuZ3RoIHx8IHR5cGVvZiBoYXNoICE9PSBcInN0cmluZ1wiKSB7XG5cdFx0cmV0dXJuIHJldDtcblx0fVxuXG5cdHJldHVybiB0aGlzLl9kZWNvZGUoaGFzaCwgdGhpcy5hbHBoYWJldCk7XG5cbn07XG5cbkhhc2hpZHMucHJvdG90eXBlLmVuY29kZUhleCA9IGZ1bmN0aW9uKHN0cikge1xuXG5cdHZhciBpLCBsZW4sIG51bWJlcnM7XG5cblx0c3RyID0gc3RyLnRvU3RyaW5nKCk7XG5cdGlmICghL15bMC05YS1mQS1GXSskLy50ZXN0KHN0cikpIHtcblx0XHRyZXR1cm4gXCJcIjtcblx0fVxuXG5cdG51bWJlcnMgPSBzdHIubWF0Y2goL1tcXHdcXFddezEsMTJ9L2cpO1xuXG5cdGZvciAoaSA9IDAsIGxlbiA9IG51bWJlcnMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXHRcdG51bWJlcnNbaV0gPSBwYXJzZUludChcIjFcIiArIG51bWJlcnNbaV0sIDE2KTtcblx0fVxuXG5cdHJldHVybiB0aGlzLmVuY29kZS5hcHBseSh0aGlzLCBudW1iZXJzKTtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuZGVjb2RlSGV4ID0gZnVuY3Rpb24oaGFzaCkge1xuXG5cdHZhciByZXQgPSBcIlwiLFxuXHRcdGksIGxlbixcblx0XHRudW1iZXJzID0gdGhpcy5kZWNvZGUoaGFzaCk7XG5cblx0Zm9yIChpID0gMCwgbGVuID0gbnVtYmVycy5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cdFx0cmV0ICs9IChudW1iZXJzW2ldKS50b1N0cmluZygxNikuc3Vic3RyKDEpO1xuXHR9XG5cblx0cmV0dXJuIHJldDtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuX2VuY29kZSA9IGZ1bmN0aW9uKG51bWJlcnMpIHtcblxuXHR2YXIgcmV0LCBsb3R0ZXJ5LCBpLCBsZW4sIG51bWJlciwgYnVmZmVyLCBsYXN0LCBzZXBzSW5kZXgsIGd1YXJkSW5kZXgsIGd1YXJkLCBoYWxmTGVuZ3RoLCBleGNlc3MsXG5cdFx0YWxwaGFiZXQgPSB0aGlzLmFscGhhYmV0LFxuXHRcdG51bWJlcnNTaXplID0gbnVtYmVycy5sZW5ndGgsXG5cdFx0bnVtYmVyc0hhc2hJbnQgPSAwO1xuXG5cdGZvciAoaSA9IDAsIGxlbiA9IG51bWJlcnMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXHRcdG51bWJlcnNIYXNoSW50ICs9IChudW1iZXJzW2ldICUgKGkgKyAxMDApKTtcblx0fVxuXG5cdGxvdHRlcnkgPSByZXQgPSBhbHBoYWJldFtudW1iZXJzSGFzaEludCAlIGFscGhhYmV0Lmxlbmd0aF07XG5cdGZvciAoaSA9IDAsIGxlbiA9IG51bWJlcnMubGVuZ3RoOyBpICE9PSBsZW47IGkrKykge1xuXG5cdFx0bnVtYmVyID0gbnVtYmVyc1tpXTtcblx0XHRidWZmZXIgPSBsb3R0ZXJ5ICsgdGhpcy5zYWx0ICsgYWxwaGFiZXQ7XG5cblx0XHRhbHBoYWJldCA9IHRoaXMuY29uc2lzdGVudFNodWZmbGUoYWxwaGFiZXQsIGJ1ZmZlci5zdWJzdHIoMCwgYWxwaGFiZXQubGVuZ3RoKSk7XG5cdFx0bGFzdCA9IHRoaXMuaGFzaChudW1iZXIsIGFscGhhYmV0KTtcblxuXHRcdHJldCArPSBsYXN0O1xuXG5cdFx0aWYgKGkgKyAxIDwgbnVtYmVyc1NpemUpIHtcblx0XHRcdG51bWJlciAlPSAobGFzdC5jaGFyQ29kZUF0KDApICsgaSk7XG5cdFx0XHRzZXBzSW5kZXggPSBudW1iZXIgJSB0aGlzLnNlcHMubGVuZ3RoO1xuXHRcdFx0cmV0ICs9IHRoaXMuc2Vwc1tzZXBzSW5kZXhdO1xuXHRcdH1cblxuXHR9XG5cblx0aWYgKHJldC5sZW5ndGggPCB0aGlzLm1pbkhhc2hMZW5ndGgpIHtcblxuXHRcdGd1YXJkSW5kZXggPSAobnVtYmVyc0hhc2hJbnQgKyByZXRbMF0uY2hhckNvZGVBdCgwKSkgJSB0aGlzLmd1YXJkcy5sZW5ndGg7XG5cdFx0Z3VhcmQgPSB0aGlzLmd1YXJkc1tndWFyZEluZGV4XTtcblxuXHRcdHJldCA9IGd1YXJkICsgcmV0O1xuXG5cdFx0aWYgKHJldC5sZW5ndGggPCB0aGlzLm1pbkhhc2hMZW5ndGgpIHtcblxuXHRcdFx0Z3VhcmRJbmRleCA9IChudW1iZXJzSGFzaEludCArIHJldFsyXS5jaGFyQ29kZUF0KDApKSAlIHRoaXMuZ3VhcmRzLmxlbmd0aDtcblx0XHRcdGd1YXJkID0gdGhpcy5ndWFyZHNbZ3VhcmRJbmRleF07XG5cblx0XHRcdHJldCArPSBndWFyZDtcblxuXHRcdH1cblxuXHR9XG5cblx0aGFsZkxlbmd0aCA9IHBhcnNlSW50KGFscGhhYmV0Lmxlbmd0aCAvIDIsIDEwKTtcblx0d2hpbGUgKHJldC5sZW5ndGggPCB0aGlzLm1pbkhhc2hMZW5ndGgpIHtcblxuXHRcdGFscGhhYmV0ID0gdGhpcy5jb25zaXN0ZW50U2h1ZmZsZShhbHBoYWJldCwgYWxwaGFiZXQpO1xuXHRcdHJldCA9IGFscGhhYmV0LnN1YnN0cihoYWxmTGVuZ3RoKSArIHJldCArIGFscGhhYmV0LnN1YnN0cigwLCBoYWxmTGVuZ3RoKTtcblxuXHRcdGV4Y2VzcyA9IHJldC5sZW5ndGggLSB0aGlzLm1pbkhhc2hMZW5ndGg7XG5cdFx0aWYgKGV4Y2VzcyA+IDApIHtcblx0XHRcdHJldCA9IHJldC5zdWJzdHIoZXhjZXNzIC8gMiwgdGhpcy5taW5IYXNoTGVuZ3RoKTtcblx0XHR9XG5cblx0fVxuXG5cdHJldHVybiByZXQ7XG5cbn07XG5cbkhhc2hpZHMucHJvdG90eXBlLl9kZWNvZGUgPSBmdW5jdGlvbihoYXNoLCBhbHBoYWJldCkge1xuXG5cdHZhciByZXQgPSBbXSxcblx0XHRpID0gMCxcblx0XHRsb3R0ZXJ5LCBsZW4sIHN1Ykhhc2gsIGJ1ZmZlcixcblx0XHRyID0gbmV3IFJlZ0V4cChcIltcIiArIHRoaXMuZ3VhcmRzICsgXCJdXCIsIFwiZ1wiKSxcblx0XHRoYXNoQnJlYWtkb3duID0gaGFzaC5yZXBsYWNlKHIsIFwiIFwiKSxcblx0XHRoYXNoQXJyYXkgPSBoYXNoQnJlYWtkb3duLnNwbGl0KFwiIFwiKTtcblxuXHRpZiAoaGFzaEFycmF5Lmxlbmd0aCA9PT0gMyB8fCBoYXNoQXJyYXkubGVuZ3RoID09PSAyKSB7XG5cdFx0aSA9IDE7XG5cdH1cblxuXHRoYXNoQnJlYWtkb3duID0gaGFzaEFycmF5W2ldO1xuXHRpZiAodHlwZW9mIGhhc2hCcmVha2Rvd25bMF0gIT09IFwidW5kZWZpbmVkXCIpIHtcblxuXHRcdGxvdHRlcnkgPSBoYXNoQnJlYWtkb3duWzBdO1xuXHRcdGhhc2hCcmVha2Rvd24gPSBoYXNoQnJlYWtkb3duLnN1YnN0cigxKTtcblxuXHRcdHIgPSBuZXcgUmVnRXhwKFwiW1wiICsgdGhpcy5zZXBzICsgXCJdXCIsIFwiZ1wiKTtcblx0XHRoYXNoQnJlYWtkb3duID0gaGFzaEJyZWFrZG93bi5yZXBsYWNlKHIsIFwiIFwiKTtcblx0XHRoYXNoQXJyYXkgPSBoYXNoQnJlYWtkb3duLnNwbGl0KFwiIFwiKTtcblxuXHRcdGZvciAoaSA9IDAsIGxlbiA9IGhhc2hBcnJheS5sZW5ndGg7IGkgIT09IGxlbjsgaSsrKSB7XG5cblx0XHRcdHN1Ykhhc2ggPSBoYXNoQXJyYXlbaV07XG5cdFx0XHRidWZmZXIgPSBsb3R0ZXJ5ICsgdGhpcy5zYWx0ICsgYWxwaGFiZXQ7XG5cblx0XHRcdGFscGhhYmV0ID0gdGhpcy5jb25zaXN0ZW50U2h1ZmZsZShhbHBoYWJldCwgYnVmZmVyLnN1YnN0cigwLCBhbHBoYWJldC5sZW5ndGgpKTtcblx0XHRcdHJldC5wdXNoKHRoaXMudW5oYXNoKHN1Ykhhc2gsIGFscGhhYmV0KSk7XG5cblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZW5jb2RlKHJldCkgIT09IGhhc2gpIHtcblx0XHRcdHJldCA9IFtdO1xuXHRcdH1cblxuXHR9XG5cblx0cmV0dXJuIHJldDtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUuY29uc2lzdGVudFNodWZmbGUgPSBmdW5jdGlvbihhbHBoYWJldCwgc2FsdCkge1xuXG5cdHZhciBpbnRlZ2VyLCBqLCB0ZW1wLCBpLCB2LCBwO1xuXG5cdGlmICghc2FsdC5sZW5ndGgpIHtcblx0XHRyZXR1cm4gYWxwaGFiZXQ7XG5cdH1cblxuXHRmb3IgKGkgPSBhbHBoYWJldC5sZW5ndGggLSAxLCB2ID0gMCwgcCA9IDA7IGkgPiAwOyBpLS0sIHYrKykge1xuXG5cdFx0diAlPSBzYWx0Lmxlbmd0aDtcblx0XHRwICs9IGludGVnZXIgPSBzYWx0W3ZdLmNoYXJDb2RlQXQoMCk7XG5cdFx0aiA9IChpbnRlZ2VyICsgdiArIHApICUgaTtcblxuXHRcdHRlbXAgPSBhbHBoYWJldFtqXTtcblx0XHRhbHBoYWJldCA9IGFscGhhYmV0LnN1YnN0cigwLCBqKSArIGFscGhhYmV0W2ldICsgYWxwaGFiZXQuc3Vic3RyKGogKyAxKTtcblx0XHRhbHBoYWJldCA9IGFscGhhYmV0LnN1YnN0cigwLCBpKSArIHRlbXAgKyBhbHBoYWJldC5zdWJzdHIoaSArIDEpO1xuXG5cdH1cblxuXHRyZXR1cm4gYWxwaGFiZXQ7XG5cbn07XG5cbkhhc2hpZHMucHJvdG90eXBlLmhhc2ggPSBmdW5jdGlvbihpbnB1dCwgYWxwaGFiZXQpIHtcblxuXHR2YXIgaGFzaCA9IFwiXCIsXG5cdFx0YWxwaGFiZXRMZW5ndGggPSBhbHBoYWJldC5sZW5ndGg7XG5cblx0ZG8ge1xuXHRcdGhhc2ggPSBhbHBoYWJldFtpbnB1dCAlIGFscGhhYmV0TGVuZ3RoXSArIGhhc2g7XG5cdFx0aW5wdXQgPSBwYXJzZUludChpbnB1dCAvIGFscGhhYmV0TGVuZ3RoLCAxMCk7XG5cdH0gd2hpbGUgKGlucHV0KTtcblxuXHRyZXR1cm4gaGFzaDtcblxufTtcblxuSGFzaGlkcy5wcm90b3R5cGUudW5oYXNoID0gZnVuY3Rpb24oaW5wdXQsIGFscGhhYmV0KSB7XG5cblx0dmFyIG51bWJlciA9IDAsIHBvcywgaTtcblxuXHRmb3IgKGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcblx0XHRwb3MgPSBhbHBoYWJldC5pbmRleE9mKGlucHV0W2ldKTtcblx0XHRudW1iZXIgKz0gcG9zICogTWF0aC5wb3coYWxwaGFiZXQubGVuZ3RoLCBpbnB1dC5sZW5ndGggLSBpIC0gMSk7XG5cdH1cblxuXHRyZXR1cm4gbnVtYmVyO1xuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhhc2hpZHM7XG4iLCJBbmFseXRpY3MgICAgPSByZXF1aXJlICcuL3V0aWxzL0FuYWx5dGljcydcbkF1dGhNYW5hZ2VyICA9IHJlcXVpcmUgJy4vdXRpbHMvQXV0aE1hbmFnZXInXG5TaGFyZSAgICAgICAgPSByZXF1aXJlICcuL3V0aWxzL1NoYXJlJ1xuRmFjZWJvb2sgICAgID0gcmVxdWlyZSAnLi91dGlscy9GYWNlYm9vaydcbkdvb2dsZVBsdXMgICA9IHJlcXVpcmUgJy4vdXRpbHMvR29vZ2xlUGx1cydcblRlbXBsYXRlcyAgICA9IHJlcXVpcmUgJy4vZGF0YS9UZW1wbGF0ZXMnXG5Mb2NhbGUgICAgICAgPSByZXF1aXJlICcuL2RhdGEvTG9jYWxlJ1xuUm91dGVyICAgICAgID0gcmVxdWlyZSAnLi9yb3V0ZXIvUm91dGVyJ1xuTmF2ICAgICAgICAgID0gcmVxdWlyZSAnLi9yb3V0ZXIvTmF2J1xuQXBwRGF0YSAgICAgID0gcmVxdWlyZSAnLi9BcHBEYXRhJ1xuQXBwVmlldyAgICAgID0gcmVxdWlyZSAnLi9BcHBWaWV3J1xuTWVkaWFRdWVyaWVzID0gcmVxdWlyZSAnLi91dGlscy9NZWRpYVF1ZXJpZXMnXG5cbmNsYXNzIEFwcFxuXG4gICAgTElWRSAgICAgICA6IG51bGxcbiAgICBCQVNFX1VSTCAgIDogd2luZG93LmNvbmZpZy5ob3N0bmFtZVxuICAgIFNJVEVfVVJMICAgOiB3aW5kb3cuY29uZmlnLlNJVEVfVVJMXG4gICAgQVBJX0hPU1QgICA6IHdpbmRvdy5jb25maWcuQVBJX0hPU1RcbiAgICBsb2NhbGVDb2RlIDogd2luZG93LmNvbmZpZy5sb2NhbGVDb2RlXG4gICAgb2JqUmVhZHkgICA6IDBcblxuICAgIF90b0NsZWFuICAgOiBbJ29ialJlYWR5JywgJ3NldEZsYWdzJywgJ29iamVjdENvbXBsZXRlJywgJ2luaXQnLCAnaW5pdE9iamVjdHMnLCAnaW5pdFNES3MnLCAnaW5pdEFwcCcsICdnbycsICdjbGVhbnVwJywgJ190b0NsZWFuJ11cblxuICAgIGNvbnN0cnVjdG9yIDogKEBMSVZFKSAtPlxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBzZXRGbGFncyA6ID0+XG5cbiAgICAgICAgdWEgPSB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgICAgTWVkaWFRdWVyaWVzLnNldHVwKCk7XG5cbiAgICAgICAgQElTX0FORFJPSUQgICAgPSB1YS5pbmRleE9mKCdhbmRyb2lkJykgPiAtMVxuICAgICAgICBASVNfRklSRUZPWCAgICA9IHVhLmluZGV4T2YoJ2ZpcmVmb3gnKSA+IC0xXG4gICAgICAgIEBJU19DSFJPTUVfSU9TID0gaWYgdWEubWF0Y2goJ2NyaW9zJykgdGhlbiB0cnVlIGVsc2UgZmFsc2UgIyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xMzgwODA1M1xuXG4gICAgICAgIG51bGxcblxuICAgIG9iamVjdENvbXBsZXRlIDogPT5cblxuICAgICAgICBAb2JqUmVhZHkrK1xuICAgICAgICBAaW5pdEFwcCgpIGlmIEBvYmpSZWFkeSA+PSA0XG5cbiAgICAgICAgbnVsbFxuXG4gICAgaW5pdCA6ID0+XG5cbiAgICAgICAgQGluaXRPYmplY3RzKClcblxuICAgICAgICBudWxsXG5cbiAgICBpbml0T2JqZWN0cyA6ID0+XG5cbiAgICAgICAgQGFwcERhdGEgICA9IG5ldyBBcHBEYXRhIEBvYmplY3RDb21wbGV0ZVxuICAgICAgICBAdGVtcGxhdGVzID0gbmV3IFRlbXBsYXRlcyB3aW5kb3cuX1RFTVBMQVRFUywgQG9iamVjdENvbXBsZXRlXG4gICAgICAgIEBsb2NhbGUgICAgPSBuZXcgTG9jYWxlIHdpbmRvdy5fTE9DQUxFX1NUUklOR1MsIEBvYmplY3RDb21wbGV0ZVxuICAgICAgICBAYW5hbHl0aWNzID0gbmV3IEFuYWx5dGljcyB3aW5kb3cuX1RSQUNLSU5HLCBAb2JqZWN0Q29tcGxldGVcblxuICAgICAgICAjIGlmIG5ldyBvYmplY3RzIGFyZSBhZGRlZCBkb24ndCBmb3JnZXQgdG8gY2hhbmdlIHRoZSBgQG9iamVjdENvbXBsZXRlYCBmdW5jdGlvblxuXG4gICAgICAgIG51bGxcblxuICAgIGluaXRTREtzIDogPT5cblxuICAgICAgICBGYWNlYm9vay5sb2FkKClcbiAgICAgICAgR29vZ2xlUGx1cy5sb2FkKClcblxuICAgICAgICBudWxsXG5cbiAgICBpbml0QXBwIDogPT5cblxuICAgICAgICBAc2V0RmxhZ3MoKVxuXG4gICAgICAgICMjIyBTdGFydHMgYXBwbGljYXRpb24gIyMjXG4gICAgICAgIEBhcHBWaWV3ID0gbmV3IEFwcFZpZXdcbiAgICAgICAgQHJvdXRlciAgPSBuZXcgUm91dGVyXG4gICAgICAgIEBuYXYgICAgID0gbmV3IE5hdlxuICAgICAgICBAYXV0aCAgICA9IG5ldyBBdXRoTWFuYWdlclxuICAgICAgICBAc2hhcmUgICA9IG5ldyBTaGFyZVxuXG4gICAgICAgIEBnbygpXG5cbiAgICAgICAgQGluaXRTREtzKClcblxuICAgICAgICBudWxsXG5cbiAgICBnbyA6ID0+XG5cbiAgICAgICAgIyMjIEFmdGVyIGV2ZXJ5dGhpbmcgaXMgbG9hZGVkLCBraWNrcyBvZmYgd2Vic2l0ZSAjIyNcbiAgICAgICAgQGFwcFZpZXcucmVuZGVyKClcblxuICAgICAgICAjIyMgcmVtb3ZlIHJlZHVuZGFudCBpbml0aWFsaXNhdGlvbiBtZXRob2RzIC8gcHJvcGVydGllcyAjIyNcbiAgICAgICAgQGNsZWFudXAoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGNsZWFudXAgOiA9PlxuXG4gICAgICAgIGZvciBmbiBpbiBAX3RvQ2xlYW5cbiAgICAgICAgICAgIEBbZm5dID0gbnVsbFxuICAgICAgICAgICAgZGVsZXRlIEBbZm5dXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFwcFxuIiwiQWJzdHJhY3REYXRhICAgICAgPSByZXF1aXJlICcuL2RhdGEvQWJzdHJhY3REYXRhJ1xuUmVxdWVzdGVyICAgICAgICAgPSByZXF1aXJlICcuL3V0aWxzL1JlcXVlc3RlcidcbkFQSSAgICAgICAgICAgICAgID0gcmVxdWlyZSAnLi9kYXRhL0FQSSdcbkRvb2RsZXNDb2xsZWN0aW9uID0gcmVxdWlyZSAnLi9jb2xsZWN0aW9ucy9kb29kbGVzL0Rvb2RsZXNDb2xsZWN0aW9uJ1xuXG5jbGFzcyBBcHBEYXRhIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cbiAgICBjYWxsYmFjayA6IG51bGxcblxuICAgIERPT0RMRV9DQUNIRV9FWFBJUkVTIDogOTk5OTk5OTk5OTk5OTk5OTlcblxuICAgIGNvbnN0cnVjdG9yIDogKEBjYWxsYmFjaykgLT5cblxuICAgICAgICBzdXBlcigpXG5cbiAgICAgICAgQGRvb2RsZXMgPSBuZXcgRG9vZGxlc0NvbGxlY3Rpb25cblxuICAgICAgICBAY2hlY2tEb29kbGVDYWNoZSgpXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgIGNoZWNrRG9vZGxlQ2FjaGUgOiA9PlxuXG4gICAgICAgIGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0IG51bGwsIChjYWNoZWREYXRhKSA9PlxuXG4gICAgICAgICAgICBpZiBfLmlzRW1wdHkgY2FjaGVkRGF0YVxuICAgICAgICAgICAgICAgIHJldHVybiBAZmV0Y2hEb29kbGVzKClcblxuICAgICAgICAgICAgY2FjaGVkRG9vZGxlcyA9IFtdXG4gICAgICAgICAgICAoaWYgaW5kZXggaXNudCAnbGFzdFVwZGF0ZWQnIHRoZW4gY2FjaGVkRG9vZGxlcy5wdXNoKEpTT04ucGFyc2UoZGF0YSkpKSBmb3IgaW5kZXgsIGRhdGEgb2YgY2FjaGVkRGF0YVxuXG4gICAgICAgICAgICBpZiAoKERhdGUubm93KCkgLSBjYWNoZWREYXRhLmxhc3RVcGRhdGVkKSA+IEBET09ETEVfQ0FDSEVfRVhQSVJFUylcbiAgICAgICAgICAgICAgICBAZmV0Y2hEb29kbGVzIGNhY2hlZERvb2RsZXNcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBAc2V0RG9vZGxlcyhjYWNoZWREb29kbGVzKS5zZXRBY3RpdmVEb29kbGUoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGZldGNoRG9vZGxlcyA6IChjYWNoZWREb29kbGVzPWZhbHNlKSA9PlxuXG4gICAgICAgIHIgPSBSZXF1ZXN0ZXIucmVxdWVzdFxuICAgICAgICAgICAgdXJsICA6IEFQSS5nZXQoJ2Rvb2RsZXMnKVxuICAgICAgICAgICAgdHlwZSA6ICdHRVQnXG5cbiAgICAgICAgci5kb25lIChkYXRhKSA9PiBAb25GZXRjaERvb2RsZXNEb25lIGRhdGEsIGNhY2hlZERvb2RsZXNcbiAgICAgICAgci5mYWlsIChyZXMpID0+IGNvbnNvbGUuZXJyb3IgXCJlcnJvciBsb2FkaW5nIGFwaSBzdGFydCBkYXRhXCIsIHJlc1xuXG4gICAgICAgIG51bGxcblxuICAgIG9uRmV0Y2hEb29kbGVzRG9uZSA6IChkYXRhLCBjYWNoZWREb29kbGVzPWZhbHNlKSA9PlxuXG4gICAgICAgIGNvbnNvbGUubG9nIFwib25GZXRjaERvb2RsZXNEb25lIDogKGRhdGEpID0+XCIsIGRhdGEsIGNhY2hlZERvb2RsZXNcblxuICAgICAgICBpZiBjYWNoZWREb29kbGVzXG4gICAgICAgICAgICBAdXBkYXRlRG9vZGxlcyhfLnNodWZmbGUoZGF0YS5kb29kbGVzKSwgY2FjaGVkRG9vZGxlcykuc2V0QWN0aXZlRG9vZGxlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgQHNldERvb2RsZXMoXy5zaHVmZmxlKGRhdGEuZG9vZGxlcykpLnNldEFjdGl2ZURvb2RsZSgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgc2V0RG9vZGxlcyA6IChkb29kbGVzKSA9PlxuXG4gICAgICAgIEBkb29kbGVzLmFkZCBkb29kbGVzXG5cbiAgICAgICAgQFxuXG4gICAgdXBkYXRlRG9vZGxlcyA6IChuZXdEb29kbGVzLCBjYWNoZWREb29kbGVzKSA9PlxuXG4gICAgICAgIEBkb29kbGVzLmFkZCBjYWNoZWREb29kbGVzXG4gICAgICAgIEBkb29kbGVzLmFkZE5ldyBuZXdEb29kbGVzXG5cbiAgICAgICAgQFxuXG4gICAgc2V0QWN0aXZlRG9vZGxlIDogPT5cblxuICAgICAgICBAYWN0aXZlRG9vZGxlID0gQGRvb2RsZXMuZ2V0TmV4dERvb2RsZSgpXG4gICAgICAgIEBjYWxsYmFjaz8oKVxuXG4gICAgICAgIEB1cGRhdGVDYWNoZSgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgdXBkYXRlQ2FjaGUgOiA9PlxuXG4gICAgICAgIGNocm9tZS5zdG9yYWdlLnN5bmMuY2xlYXIgPT5cblxuICAgICAgICAgICAgbmV3Q2FjaGUgPSBsYXN0VXBkYXRlZCA6IERhdGUubm93KClcbiAgICAgICAgICAgIChuZXdDYWNoZVtwb3NpdGlvbl0gPSBKU09OLnN0cmluZ2lmeSBkb29kbGUpIGZvciBkb29kbGUsIHBvc2l0aW9uIGluIEBkb29kbGVzLm1vZGVsc1xuXG4gICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5zeW5jLnNldCBuZXdDYWNoZVxuXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBcHBEYXRhXG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuL3ZpZXcvQWJzdHJhY3RWaWV3J1xuUHJlbG9hZGVyICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvUHJlbG9hZGVyJ1xuSGVhZGVyICAgICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvSGVhZGVyJ1xuV3JhcHBlciAgICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvV3JhcHBlcidcbkZvb3RlciAgICAgICA9IHJlcXVpcmUgJy4vdmlldy9iYXNlL0Zvb3Rlcidcbk1vZGFsTWFuYWdlciA9IHJlcXVpcmUgJy4vdmlldy9tb2RhbHMvX01vZGFsTWFuYWdlcidcbk1lZGlhUXVlcmllcyA9IHJlcXVpcmUgJy4vdXRpbHMvTWVkaWFRdWVyaWVzJ1xuXG5jbGFzcyBBcHBWaWV3IGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cbiAgICB0ZW1wbGF0ZSA6ICdtYWluJ1xuXG4gICAgJHdpbmRvdyAgOiBudWxsXG4gICAgJGJvZHkgICAgOiBudWxsXG5cbiAgICB3cmFwcGVyICA6IG51bGxcbiAgICBmb290ZXIgICA6IG51bGxcblxuICAgIGRpbXMgOlxuICAgICAgICB3IDogbnVsbFxuICAgICAgICBoIDogbnVsbFxuICAgICAgICBvIDogbnVsbFxuICAgICAgICBjIDogbnVsbFxuXG4gICAgZXZlbnRzIDpcbiAgICAgICAgJ2NsaWNrIGEnIDogJ2xpbmtNYW5hZ2VyJ1xuXG4gICAgRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMgOiAnRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMnXG5cbiAgICBNT0JJTEVfV0lEVEggOiA3MDBcbiAgICBNT0JJTEUgICAgICAgOiAnbW9iaWxlJ1xuICAgIE5PTl9NT0JJTEUgICA6ICdub25fbW9iaWxlJ1xuXG4gICAgY29uc3RydWN0b3IgOiAtPlxuXG4gICAgICAgIEAkd2luZG93ID0gJCh3aW5kb3cpXG4gICAgICAgIEAkYm9keSAgID0gJCgnYm9keScpLmVxKDApXG5cbiAgICAgICAgc3VwZXIoKVxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBkaXNhYmxlVG91Y2g6ID0+XG5cbiAgICAgICAgQCR3aW5kb3cub24gJ3RvdWNobW92ZScsIEBvblRvdWNoTW92ZVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgZW5hYmxlVG91Y2g6ID0+XG5cbiAgICAgICAgQCR3aW5kb3cub2ZmICd0b3VjaG1vdmUnLCBAb25Ub3VjaE1vdmVcblxuICAgICAgICByZXR1cm5cblxuICAgIG9uVG91Y2hNb3ZlOiAoIGUgKSAtPlxuXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgcmVuZGVyIDogPT5cblxuICAgICAgICBAYmluZEV2ZW50cygpXG5cbiAgICAgICAgQHByZWxvYWRlciAgICA9IG5ldyBQcmVsb2FkZXJcbiAgICAgICAgQG1vZGFsTWFuYWdlciA9IG5ldyBNb2RhbE1hbmFnZXJcblxuICAgICAgICBAaGVhZGVyICA9IG5ldyBIZWFkZXJcbiAgICAgICAgQHdyYXBwZXIgPSBuZXcgV3JhcHBlclxuICAgICAgICBAZm9vdGVyICA9IG5ldyBGb290ZXJcblxuICAgICAgICBAXG4gICAgICAgICAgICAuYWRkQ2hpbGQgQGhlYWRlclxuICAgICAgICAgICAgLmFkZENoaWxkIEB3cmFwcGVyXG4gICAgICAgICAgICAuYWRkQ2hpbGQgQGZvb3RlclxuXG4gICAgICAgIEBvbkFsbFJlbmRlcmVkKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGJpbmRFdmVudHMgOiA9PlxuXG4gICAgICAgIEBvbiAnYWxsUmVuZGVyZWQnLCBAb25BbGxSZW5kZXJlZFxuXG4gICAgICAgIEBvblJlc2l6ZSgpXG5cbiAgICAgICAgQG9uUmVzaXplID0gXy5kZWJvdW5jZSBAb25SZXNpemUsIDMwMFxuICAgICAgICBAJHdpbmRvdy5vbiAncmVzaXplIG9yaWVudGF0aW9uY2hhbmdlJywgQG9uUmVzaXplXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBvbkFsbFJlbmRlcmVkIDogPT5cblxuICAgICAgICAjIGNvbnNvbGUubG9nIFwib25BbGxSZW5kZXJlZCA6ID0+XCJcblxuICAgICAgICBAJGJvZHkucHJlcGVuZCBAJGVsXG5cbiAgICAgICAgQGJlZ2luKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGJlZ2luIDogPT5cblxuICAgICAgICBAdHJpZ2dlciAnc3RhcnQnXG5cbiAgICAgICAgQENEX0NFKCkucm91dGVyLnN0YXJ0KClcblxuICAgICAgICBAcHJlbG9hZGVyLmhpZGUoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgb25SZXNpemUgOiA9PlxuXG4gICAgICAgIEBnZXREaW1zKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGdldERpbXMgOiA9PlxuXG4gICAgICAgIHcgPSB3aW5kb3cuaW5uZXJXaWR0aCBvciBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggb3IgZG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aFxuICAgICAgICBoID0gd2luZG93LmlubmVySGVpZ2h0IG9yIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgb3IgZG9jdW1lbnQuYm9keS5jbGllbnRIZWlnaHRcblxuICAgICAgICBAZGltcyA9XG4gICAgICAgICAgICB3IDogd1xuICAgICAgICAgICAgaCA6IGhcbiAgICAgICAgICAgIG8gOiBpZiBoID4gdyB0aGVuICdwb3J0cmFpdCcgZWxzZSAnbGFuZHNjYXBlJ1xuICAgICAgICAgICAgYyA6IGlmIHcgPD0gQE1PQklMRV9XSURUSCB0aGVuIEBNT0JJTEUgZWxzZSBATk9OX01PQklMRVxuXG4gICAgICAgIEB0cmlnZ2VyIEBFVkVOVF9VUERBVEVfRElNRU5TSU9OUywgQGRpbXNcblxuICAgICAgICByZXR1cm5cblxuICAgIGxpbmtNYW5hZ2VyIDogKGUpID0+XG5cbiAgICAgICAgaHJlZiA9ICQoZS5jdXJyZW50VGFyZ2V0KS5hdHRyKCdocmVmJylcblxuICAgICAgICByZXR1cm4gZmFsc2UgdW5sZXNzIGhyZWZcblxuICAgICAgICBAbmF2aWdhdGVUb1VybCBocmVmLCBlXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBuYXZpZ2F0ZVRvVXJsIDogKCBocmVmLCBlID0gbnVsbCApID0+XG5cbiAgICAgICAgcm91dGUgICA9IGlmIGhyZWYubWF0Y2goQENEX0NFKCkuQkFTRV9VUkwpIHRoZW4gaHJlZi5zcGxpdChAQ0RfQ0UoKS5CQVNFX1VSTClbMV0gZWxzZSBocmVmXG4gICAgICAgIHNlY3Rpb24gPSBpZiByb3V0ZS5pbmRleE9mKCcvJykgaXMgMCB0aGVuIHJvdXRlLnNwbGl0KCcvJylbMV0gZWxzZSByb3V0ZVxuXG4gICAgICAgIGlmIEBDRF9DRSgpLm5hdi5nZXRTZWN0aW9uIHNlY3Rpb25cbiAgICAgICAgICAgIGU/LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgIEBDRF9DRSgpLnJvdXRlci5uYXZpZ2F0ZVRvIHJvdXRlXG4gICAgICAgIGVsc2UgXG4gICAgICAgICAgICBAaGFuZGxlRXh0ZXJuYWxMaW5rIGhyZWZcblxuICAgICAgICByZXR1cm5cblxuICAgIGhhbmRsZUV4dGVybmFsTGluayA6IChkYXRhKSA9PiBcblxuICAgICAgICAjIyNcblxuICAgICAgICBiaW5kIHRyYWNraW5nIGV2ZW50cyBpZiBuZWNlc3NhcnlcblxuICAgICAgICAjIyNcblxuICAgICAgICByZXR1cm5cblxubW9kdWxlLmV4cG9ydHMgPSBBcHBWaWV3XG4iLCJjbGFzcyBBYnN0cmFjdENvbGxlY3Rpb24gZXh0ZW5kcyBCYWNrYm9uZS5Db2xsZWN0aW9uXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Q29sbGVjdGlvblxuIiwiVGVtcGxhdGVNb2RlbCA9IHJlcXVpcmUgJy4uLy4uL21vZGVscy9jb3JlL1RlbXBsYXRlTW9kZWwnXG5cbmNsYXNzIFRlbXBsYXRlc0NvbGxlY3Rpb24gZXh0ZW5kcyBCYWNrYm9uZS5Db2xsZWN0aW9uXG5cblx0bW9kZWwgOiBUZW1wbGF0ZU1vZGVsXG5cbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVzQ29sbGVjdGlvblxuIiwiQWJzdHJhY3RDb2xsZWN0aW9uID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RDb2xsZWN0aW9uJ1xuRG9vZGxlTW9kZWwgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vbW9kZWxzL2Rvb2RsZS9Eb29kbGVNb2RlbCdcblxuY2xhc3MgRG9vZGxlc0NvbGxlY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENvbGxlY3Rpb25cblxuICAgIG1vZGVsIDogRG9vZGxlTW9kZWxcblxuICAgIGdldERvb2RsZUJ5U2x1ZyA6IChzbHVnKSA9PlxuXG4gICAgICAgIGRvb2RsZSA9IEBmaW5kV2hlcmUgc2x1ZyA6IHNsdWdcblxuICAgICAgICBpZiAhZG9vZGxlXG4gICAgICAgICAgICBjb25zb2xlLmxvZyBcInkgdSBubyBkb29kbGU/XCJcblxuICAgICAgICByZXR1cm4gZG9vZGxlXG5cbiAgICBnZXREb29kbGVCeU5hdlNlY3Rpb24gOiAod2hpY2hTZWN0aW9uKSA9PlxuXG4gICAgICAgIHNlY3Rpb24gPSBAQ0RfQ0UoKS5uYXZbd2hpY2hTZWN0aW9uXVxuXG4gICAgICAgIGRvb2RsZSA9IEBmaW5kV2hlcmUgc2x1ZyA6IFwiI3tzZWN0aW9uLnN1Yn0vI3tzZWN0aW9uLnRlcn1cIlxuXG4gICAgICAgIGRvb2RsZVxuXG4gICAgZ2V0UHJldkRvb2RsZSA6IChkb29kbGUpID0+XG5cbiAgICAgICAgaW5kZXggPSBAaW5kZXhPZiBkb29kbGVcbiAgICAgICAgaW5kZXgtLVxuXG4gICAgICAgIGlmIGluZGV4IDwgMFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBAYXQgaW5kZXhcblxuICAgIGdldE5leHREb29kbGUgOiAoZG9vZGxlKSA9PlxuXG4gICAgICAgIGluZGV4ID0gQGluZGV4T2YgZG9vZGxlXG4gICAgICAgIGluZGV4KytcblxuICAgICAgICBpZiBpbmRleCA+IChAbGVuZ3RoLmxlbmd0aC0xKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBAYXQgaW5kZXhcblxuICAgIGFkZE5ldyA6IChkb29kbGVzKSA9PlxuXG4gICAgICAgIGZvciBkb29kbGUgaW4gZG9vZGxlc1xuICAgICAgICAgICAgaWYgIUBmaW5kV2hlcmUoIGluZGV4IDogZG9vZGxlLmluZGV4IClcbiAgICAgICAgICAgICAgICBAYWRkIGRvb2RsZVxuXG4gICAgICAgIG51bGxcblxuICAgIGdldE5leHREb29kbGUgOiA9PlxuXG4gICAgICAgIGZvciBkb29kbGUgaW4gQG1vZGVsc1xuXG4gICAgICAgICAgICBpZiAhZG9vZGxlLmdldCgndmlld2VkJylcbiAgICAgICAgICAgICAgICBkb29kbGUuc2V0KCd2aWV3ZWQnLCB0cnVlKVxuICAgICAgICAgICAgICAgIG5leHREb29kbGUgPSBkb29kbGVcbiAgICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgIGlmICFuZXh0RG9vZGxlXG4gICAgICAgICAgICBjb25zb2xlLmxvZyAnd2FhYWFhIHUgc2VlbiB0aGVtIGFsbD8hJ1xuICAgICAgICAgICAgbmV4dERvb2RsZSA9IF8uc2h1ZmZsZShAbW9kZWxzKVswXVxuXG4gICAgICAgIG5leHREb29kbGVcblxubW9kdWxlLmV4cG9ydHMgPSBEb29kbGVzQ29sbGVjdGlvblxuIiwiQVBJUm91dGVNb2RlbCA9IHJlcXVpcmUgJy4uL21vZGVscy9jb3JlL0FQSVJvdXRlTW9kZWwnXG5cbmNsYXNzIEFQSVxuXG5cdEBtb2RlbCA6IG5ldyBBUElSb3V0ZU1vZGVsXG5cblx0QGdldENvbnRhbnRzIDogPT5cblxuXHRcdCMjIyBhZGQgbW9yZSBpZiB3ZSB3YW5uYSB1c2UgaW4gQVBJIHN0cmluZ3MgIyMjXG5cdFx0QVBJX0hPU1QgOiBAQ0RfQ0UoKS5BUElfSE9TVFxuXG5cdEBnZXQgOiAobmFtZSwgdmFycykgPT5cblxuXHRcdHZhcnMgPSAkLmV4dGVuZCB0cnVlLCB2YXJzLCBAZ2V0Q29udGFudHMoKVxuXHRcdHJldHVybiBAc3VwcGxhbnRTdHJpbmcgQG1vZGVsLmdldChuYW1lKSwgdmFyc1xuXG5cdEBzdXBwbGFudFN0cmluZyA6IChzdHIsIHZhbHMpIC0+XG5cblx0XHRyZXR1cm4gc3RyLnJlcGxhY2UgL3t7IChbXnt9XSopIH19L2csIChhLCBiKSAtPlxuXHRcdFx0ciA9IHZhbHNbYl0gb3IgaWYgdHlwZW9mIHZhbHNbYl0gaXMgJ251bWJlcicgdGhlbiB2YWxzW2JdLnRvU3RyaW5nKCkgZWxzZSAnJ1xuXHRcdChpZiB0eXBlb2YgciBpcyBcInN0cmluZ1wiIG9yIHR5cGVvZiByIGlzIFwibnVtYmVyXCIgdGhlbiByIGVsc2UgYSlcblxuXHRAQ0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFQSVxuIiwiY2xhc3MgQWJzdHJhY3REYXRhXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0Xy5leHRlbmQgQCwgQmFja2JvbmUuRXZlbnRzXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdENEX0NFIDogPT5cblxuXHRcdHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdERhdGFcbiIsIkxvY2FsZXNNb2RlbCA9IHJlcXVpcmUgJy4uL21vZGVscy9jb3JlL0xvY2FsZXNNb2RlbCdcbkFQSSAgICAgICAgICA9IHJlcXVpcmUgJy4uL2RhdGEvQVBJJ1xuXG4jIyNcbiMgTG9jYWxlIExvYWRlciAjXG5cbkZpcmVzIGJhY2sgYW4gZXZlbnQgd2hlbiBjb21wbGV0ZVxuXG4jIyNcbmNsYXNzIExvY2FsZVxuXG4gICAgbGFuZyAgICAgOiBudWxsXG4gICAgZGF0YSAgICAgOiBudWxsXG4gICAgY2FsbGJhY2sgOiBudWxsXG4gICAgZGVmYXVsdCAgOiAnZW4tZ2InXG5cbiAgICBjb25zdHJ1Y3RvciA6IChkYXRhLCBjYikgLT5cblxuICAgICAgICAjIyMgc3RhcnQgTG9jYWxlIExvYWRlciwgZGVmaW5lIGxvY2FsZSBiYXNlZCBvbiBicm93c2VyIGxhbmd1YWdlICMjI1xuXG4gICAgICAgIEBjYWxsYmFjayA9IGNiXG5cbiAgICAgICAgQGxhbmcgPSBAZ2V0TGFuZygpXG5cbiAgICAgICAgQHBhcnNlRGF0YSBkYXRhXG5cbiAgICAgICAgbnVsbFxuICAgICAgICAgICAgXG4gICAgZ2V0TGFuZyA6ID0+XG5cbiAgICAgICAgaWYgd2luZG93LmxvY2F0aW9uLnNlYXJjaCBhbmQgd2luZG93LmxvY2F0aW9uLnNlYXJjaC5tYXRjaCgnbGFuZz0nKVxuXG4gICAgICAgICAgICBsYW5nID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaC5zcGxpdCgnbGFuZz0nKVsxXS5zcGxpdCgnJicpWzBdXG5cbiAgICAgICAgZWxzZSBpZiB3aW5kb3cuY29uZmlnLmxvY2FsZUNvZGVcblxuICAgICAgICAgICAgbGFuZyA9IHdpbmRvdy5jb25maWcubG9jYWxlQ29kZVxuXG4gICAgICAgIGVsc2VcblxuICAgICAgICAgICAgbGFuZyA9IEBkZWZhdWx0XG5cbiAgICAgICAgbGFuZ1xuXG4gICAgcGFyc2VEYXRhIDogKGRhdGEpID0+XG5cbiAgICAgICAgIyMjIEZpcmVzIGJhY2sgYW4gZXZlbnQgb25jZSBpdCdzIGNvbXBsZXRlICMjI1xuXG4gICAgICAgIEBkYXRhID0gbmV3IExvY2FsZXNNb2RlbCBkYXRhXG4gICAgICAgIEBjYWxsYmFjaz8oKVxuXG4gICAgICAgIG51bGxcblxuICAgIGdldCA6IChpZCkgPT5cblxuICAgICAgICAjIyMgZ2V0IFN0cmluZyBmcm9tIGxvY2FsZVxuICAgICAgICArIGlkIDogc3RyaW5nIGlkIG9mIHRoZSBMb2NhbGlzZWQgU3RyaW5nXG4gICAgICAgICMjI1xuXG4gICAgICAgIHJldHVybiBAZGF0YS5nZXRTdHJpbmcgaWRcblxuICAgIGdldExvY2FsZUltYWdlIDogKHVybCkgPT5cblxuICAgICAgICByZXR1cm4gd2luZG93LmNvbmZpZy5DRE4gKyBcIi9pbWFnZXMvbG9jYWxlL1wiICsgd2luZG93LmNvbmZpZy5sb2NhbGVDb2RlICsgXCIvXCIgKyB1cmxcblxubW9kdWxlLmV4cG9ydHMgPSBMb2NhbGVcbiIsIlRlbXBsYXRlTW9kZWwgICAgICAgPSByZXF1aXJlICcuLi9tb2RlbHMvY29yZS9UZW1wbGF0ZU1vZGVsJ1xuVGVtcGxhdGVzQ29sbGVjdGlvbiA9IHJlcXVpcmUgJy4uL2NvbGxlY3Rpb25zL2NvcmUvVGVtcGxhdGVzQ29sbGVjdGlvbidcblxuY2xhc3MgVGVtcGxhdGVzXG5cbiAgICB0ZW1wbGF0ZXMgOiBudWxsXG4gICAgY2IgICAgICAgIDogbnVsbFxuXG4gICAgY29uc3RydWN0b3IgOiAoZGF0YSwgY2FsbGJhY2spIC0+XG5cbiAgICAgICAgQGNiID0gY2FsbGJhY2tcblxuICAgICAgICBAcGFyc2VEYXRhIGRhdGFcbiAgICAgICAgICAgXG4gICAgICAgIG51bGxcblxuICAgIHBhcnNlRGF0YSA6IChkYXRhKSA9PlxuXG4gICAgICAgIHRlbXAgPSBbXVxuXG4gICAgICAgIGZvciBpdGVtIGluIGRhdGEudGVtcGxhdGVcbiAgICAgICAgICAgIHRlbXAucHVzaCBuZXcgVGVtcGxhdGVNb2RlbFxuICAgICAgICAgICAgICAgIGlkICAgOiBpdGVtLiQuaWRcbiAgICAgICAgICAgICAgICB0ZXh0IDogaXRlbS5fXG5cbiAgICAgICAgQHRlbXBsYXRlcyA9IG5ldyBUZW1wbGF0ZXNDb2xsZWN0aW9uIHRlbXBcblxuICAgICAgICBAY2I/KClcbiAgICAgICAgXG4gICAgICAgIG51bGwgICAgICAgIFxuXG4gICAgZ2V0IDogKGlkKSA9PlxuXG4gICAgICAgIHQgPSBAdGVtcGxhdGVzLndoZXJlIGlkIDogaWRcbiAgICAgICAgdCA9IHRbMF0uZ2V0ICd0ZXh0J1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuICQudHJpbSB0XG5cbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVzXG4iLCJjbGFzcyBBYnN0cmFjdE1vZGVsIGV4dGVuZHMgQmFja2JvbmUuRGVlcE1vZGVsXG5cblx0Y29uc3RydWN0b3IgOiAoYXR0cnMsIG9wdGlvbikgLT5cblxuXHRcdGF0dHJzID0gQF9maWx0ZXJBdHRycyBhdHRyc1xuXG5cdFx0cmV0dXJuIEJhY2tib25lLkRlZXBNb2RlbC5hcHBseSBALCBhcmd1bWVudHNcblxuXHRzZXQgOiAoYXR0cnMsIG9wdGlvbnMpIC0+XG5cblx0XHRvcHRpb25zIG9yIChvcHRpb25zID0ge30pXG5cblx0XHRhdHRycyA9IEBfZmlsdGVyQXR0cnMgYXR0cnNcblxuXHRcdG9wdGlvbnMuZGF0YSA9IEpTT04uc3RyaW5naWZ5IGF0dHJzXG5cblx0XHRyZXR1cm4gQmFja2JvbmUuRGVlcE1vZGVsLnByb3RvdHlwZS5zZXQuY2FsbCBALCBhdHRycywgb3B0aW9uc1xuXG5cdF9maWx0ZXJBdHRycyA6IChhdHRycykgPT5cblxuXHRcdGF0dHJzXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0TW9kZWxcbiIsImNsYXNzIEFQSVJvdXRlTW9kZWwgZXh0ZW5kcyBCYWNrYm9uZS5EZWVwTW9kZWxcblxuICAgIGRlZmF1bHRzIDpcblxuICAgICAgICBkb29kbGVzIDogXCJ7eyBBUElfSE9TVCB9fS9hcGkvZG9vZGxlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gQVBJUm91dGVNb2RlbFxuIiwiY2xhc3MgTG9jYWxlc01vZGVsIGV4dGVuZHMgQmFja2JvbmUuTW9kZWxcblxuICAgIGRlZmF1bHRzIDpcbiAgICAgICAgY29kZSAgICAgOiBudWxsXG4gICAgICAgIGxhbmd1YWdlIDogbnVsbFxuICAgICAgICBzdHJpbmdzICA6IG51bGxcbiAgICAgICAgICAgIFxuICAgIGdldF9sYW5ndWFnZSA6ID0+XG4gICAgICAgIHJldHVybiBAZ2V0KCdsYW5ndWFnZScpXG5cbiAgICBnZXRTdHJpbmcgOiAoaWQpID0+XG4gICAgICAgICgocmV0dXJuIGUgaWYoYSBpcyBpZCkpIGZvciBhLCBlIG9mIHZbJ3N0cmluZ3MnXSkgZm9yIGssIHYgb2YgQGdldCgnc3RyaW5ncycpXG4gICAgICAgIGNvbnNvbGUud2FybiBcIkxvY2FsZXMgLT4gbm90IGZvdW5kIHN0cmluZzogI3tpZH1cIlxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gTG9jYWxlc01vZGVsXG4iLCJjbGFzcyBUZW1wbGF0ZU1vZGVsIGV4dGVuZHMgQmFja2JvbmUuTW9kZWxcblxuXHRkZWZhdWx0cyA6IFxuXG5cdFx0aWQgICA6IFwiXCJcblx0XHR0ZXh0IDogXCJcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IFRlbXBsYXRlTW9kZWxcbiIsIkFic3RyYWN0TW9kZWwgICAgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RNb2RlbCdcbk51bWJlclV0aWxzICAgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vdXRpbHMvTnVtYmVyVXRpbHMnXG5Db2RlV29yZFRyYW5zaXRpb25lciA9IHJlcXVpcmUgJy4uLy4uL3V0aWxzL0NvZGVXb3JkVHJhbnNpdGlvbmVyJ1xuSGFzaGlkcyAgICAgICAgICAgICAgPSByZXF1aXJlICdoYXNoaWRzJ1xuXG5jbGFzcyBEb29kbGVNb2RlbCBleHRlbmRzIEFic3RyYWN0TW9kZWxcblxuICAgIGRlZmF1bHRzIDpcbiAgICAgICAgIyBmcm9tIG1hbmlmZXN0XG4gICAgICAgIFwibmFtZVwiIDogXCJcIlxuICAgICAgICBcImF1dGhvclwiIDpcbiAgICAgICAgICAgIFwibmFtZVwiICAgIDogXCJcIlxuICAgICAgICAgICAgXCJnaXRodWJcIiAgOiBcIlwiXG4gICAgICAgICAgICBcIndlYnNpdGVcIiA6IFwiXCJcbiAgICAgICAgICAgIFwidHdpdHRlclwiIDogXCJcIlxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiXCJcbiAgICAgICAgXCJ0YWdzXCIgOiBbXVxuICAgICAgICBcImludGVyYWN0aW9uXCIgOlxuICAgICAgICAgICAgXCJtb3VzZVwiICAgIDogbnVsbFxuICAgICAgICAgICAgXCJrZXlib2FyZFwiIDogbnVsbFxuICAgICAgICAgICAgXCJ0b3VjaFwiICAgIDogbnVsbFxuICAgICAgICBcImNyZWF0ZWRcIiA6IFwiXCJcbiAgICAgICAgXCJzbHVnXCIgOiBcIlwiXG4gICAgICAgIFwic2hvcnRsaW5rXCIgOiBcIlwiXG4gICAgICAgIFwiY29sb3VyX3NjaGVtZVwiIDogXCJcIlxuICAgICAgICBcImluZGV4XCI6IG51bGxcbiAgICAgICAgXCJpbmRleF9wYWRkZWRcIiA6IFwiXCJcbiAgICAgICAgIyBzaXRlLW9ubHlcbiAgICAgICAgXCJpbmRleEhUTUxcIiA6IFwiXCJcbiAgICAgICAgXCJzb3VyY2VcIiAgICA6IFwiXCJcbiAgICAgICAgXCJ1cmxcIiAgICAgICA6IFwiXCJcbiAgICAgICAgXCJzY3JhbWJsZWRcIiA6XG4gICAgICAgICAgICBcIm5hbWVcIiAgICAgICAgOiBcIlwiXG4gICAgICAgICAgICBcImF1dGhvcl9uYW1lXCIgOiBcIlwiXG4gICAgICAgIFwidmlld2VkXCIgOiBmYWxzZVxuXG4gICAgICAgIFwiU0FNUExFX0RJUlwiIDogXCJcIlxuXG4gICAgU0FNUExFX0RPT0RMRVMgOiBbXG4gICAgICAgICAgICAnc2hhcGUtc3RyZWFtJyxcbiAgICAgICAgICAgICdzaGFwZS1zdHJlYW0tbGlnaHQnLFxuICAgICAgICAgICAgJ2JveC1waHlzaWNzJyxcbiAgICAgICAgICAgICdzdGFycycsXG4gICAgICAgICAgICAndHViZXMnXG4gICAgICAgIF1cblxuICAgIF9maWx0ZXJBdHRycyA6IChhdHRycykgPT5cblxuICAgICAgICBpZiBhdHRycy5zbHVnXG4gICAgICAgICAgICBhdHRycy51cmwgPSB3aW5kb3cuY29uZmlnLlNJVEVfVVJMICsgJy8nICsgd2luZG93LmNvbmZpZy5yb3V0ZXMuRE9PRExFUyArICcvJyArIGF0dHJzLnNsdWdcblxuICAgICAgICBpZiBhdHRycy5pbmRleFxuICAgICAgICAgICAgYXR0cnMuaW5kZXhfcGFkZGVkID0gTnVtYmVyVXRpbHMuemVyb0ZpbGwgYXR0cnMuaW5kZXgsIDNcbiAgICAgICAgICAgIGF0dHJzLmluZGV4SFRNTCAgICA9IEBnZXRJbmRleEhUTUwgYXR0cnMuaW5kZXhfcGFkZGVkXG5cbiAgICAgICAgaWYgYXR0cnMubmFtZSBhbmQgYXR0cnMuYXV0aG9yLm5hbWVcbiAgICAgICAgICAgIGF0dHJzLnNjcmFtYmxlZCA9XG4gICAgICAgICAgICAgICAgbmFtZSAgICAgICAgOiBDb2RlV29yZFRyYW5zaXRpb25lci5nZXRTY3JhbWJsZWRXb3JkIGF0dHJzLm5hbWVcbiAgICAgICAgICAgICAgICBhdXRob3JfbmFtZSA6IENvZGVXb3JkVHJhbnNpdGlvbmVyLmdldFNjcmFtYmxlZFdvcmQgYXR0cnMuYXV0aG9yLm5hbWVcblxuICAgICAgICAjIyNcbiAgICAgICAgR0VUX0RVTU1ZX0RPT0RMRV9TQ0hUVUZGXG4gICAgICAgICMjI1xuICAgICAgICBzYW1wbGUgPSBfLnNodWZmbGUoQFNBTVBMRV9ET09ETEVTKVswXVxuICAgICAgICBhdHRycy5TQU1QTEVfRElSID0gc2FtcGxlXG4gICAgICAgIGF0dHJzLmNvbG91cl9zY2hlbWUgPSBpZiBzYW1wbGUgaXMgJ3NoYXBlLXN0cmVhbS1saWdodCcgdGhlbiAnbGlnaHQnIGVsc2UgJ2RhcmsnXG5cbiAgICAgICAgYXR0cnNcblxuICAgIGdldEluZGV4SFRNTCA6IChpbmRleCkgPT5cblxuICAgICAgICBodG1sID0gXCJcIlxuXG4gICAgICAgIGZvciBjaGFyIGluIGluZGV4LnNwbGl0KCcnKVxuICAgICAgICAgICAgY2xhc3NOYW1lID0gaWYgY2hhciBpcyAnMCcgdGhlbiAnaW5kZXgtY2hhci16ZXJvJyBlbHNlICdpbmRleC1jaGFyLW5vbnplcm8nXG4gICAgICAgICAgICBodG1sICs9IFwiPHNwYW4gY2xhc3M9XFxcIiN7Y2xhc3NOYW1lfVxcXCI+I3tjaGFyfTwvc3Bhbj5cIlxuXG4gICAgICAgIGh0bWxcblxuICAgIGdldEF1dGhvckh0bWwgOiA9PlxuXG4gICAgICAgIHBvcnRmb2xpb19sYWJlbCA9IEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJtaXNjX3BvcnRmb2xpb19sYWJlbFwiXG5cbiAgICAgICAgYXR0cnMgPSBAZ2V0KCdhdXRob3InKVxuICAgICAgICBodG1sICA9IFwiXCJcbiAgICAgICAgbGlua3MgPSBbXVxuXG4gICAgICAgIGh0bWwgKz0gXCIje2F0dHJzLm5hbWV9IFxcXFwgXCJcblxuICAgICAgICBpZiBhdHRycy53ZWJzaXRlIHRoZW4gbGlua3MucHVzaCBcIjxhIGhyZWY9XFxcIiN7YXR0cnMud2Vic2l0ZX1cXFwiIHRhcmdldD1cXFwiX2JsYW5rXFxcIj4je3BvcnRmb2xpb19sYWJlbH08L2E+IFwiXG4gICAgICAgIGlmIGF0dHJzLnR3aXR0ZXIgdGhlbiBsaW5rcy5wdXNoIFwiPGEgaHJlZj1cXFwiaHR0cDovL3R3aXR0ZXIuY29tLyN7YXR0cnMudHdpdHRlcn1cXFwiIHRhcmdldD1cXFwiX2JsYW5rXFxcIj50dzwvYT5cIlxuICAgICAgICBpZiBhdHRycy5naXRodWIgdGhlbiBsaW5rcy5wdXNoIFwiPGEgaHJlZj1cXFwiaHR0cDovL2dpdGh1Yi5jb20vI3thdHRycy5naXRodWJ9XFxcIiB0YXJnZXQ9XFxcIl9ibGFua1xcXCI+Z2g8L2E+XCJcblxuICAgICAgICBodG1sICs9IFwiI3tsaW5rcy5qb2luKCcgXFxcXCAnKX1cIlxuXG4gICAgICAgIGh0bWxcblxuICAgICMgbm8gbmVlZCB0byBkbyB0aGlzIGZvciBldmVyeSBkb29kbGUgLSBvbmx5IGRvIGl0IGlmIHdlIHZpZXcgdGhlIGluZm8gcGFuZSBmb3IgYSBwYXJ0aWN1bGFyIGRvb2RsZVxuICAgIHNldFNob3J0bGluayA6ID0+XG5cbiAgICAgICAgcmV0dXJuIGlmIEBnZXQgJ3Nob3J0bGluaydcblxuICAgICAgICBoID0gbmV3IEhhc2hpZHMgd2luZG93LmNvbmZpZy5zaG9ydGxpbmtzLlNBTFQsIDAsIHdpbmRvdy5jb25maWcuc2hvcnRsaW5rcy5BTFBIQUJFVFxuICAgICAgICBzaG9ydGxpbmsgPSBoLmVuY29kZSBAZ2V0ICdpbmRleCdcbiAgICAgICAgQHNldCAnc2hvcnRsaW5rJywgc2hvcnRsaW5rXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IERvb2RsZU1vZGVsXG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuLi92aWV3L0Fic3RyYWN0VmlldydcblJvdXRlciAgICAgICA9IHJlcXVpcmUgJy4vUm91dGVyJ1xuXG5jbGFzcyBOYXYgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuICAgIEBFVkVOVF9DSEFOR0VfVklFVyAgICAgOiAnRVZFTlRfQ0hBTkdFX1ZJRVcnXG4gICAgQEVWRU5UX0NIQU5HRV9TVUJfVklFVyA6ICdFVkVOVF9DSEFOR0VfU1VCX1ZJRVcnXG5cbiAgICBzZWN0aW9ucyA6XG4gICAgICAgIEhPTUUgOiAnaW5kZXguaHRtbCdcblxuICAgIGN1cnJlbnQgIDogYXJlYSA6IG51bGwsIHN1YiA6IG51bGxcbiAgICBwcmV2aW91cyA6IGFyZWEgOiBudWxsLCBzdWIgOiBudWxsXG5cbiAgICBjb25zdHJ1Y3RvcjogLT5cblxuICAgICAgICBAQ0RfQ0UoKS5yb3V0ZXIub24gUm91dGVyLkVWRU5UX0hBU0hfQ0hBTkdFRCwgQGNoYW5nZVZpZXdcblxuICAgICAgICByZXR1cm4gZmFsc2VcblxuICAgIGdldFNlY3Rpb24gOiAoc2VjdGlvbikgPT5cblxuICAgICAgICBpZiBzZWN0aW9uIGlzICcnIHRoZW4gcmV0dXJuIHRydWVcblxuICAgICAgICBmb3Igc2VjdGlvbk5hbWUsIHVyaSBvZiBAc2VjdGlvbnNcbiAgICAgICAgICAgIGlmIHVyaSBpcyBzZWN0aW9uIHRoZW4gcmV0dXJuIHNlY3Rpb25OYW1lXG5cbiAgICAgICAgZmFsc2VcblxuICAgIGNoYW5nZVZpZXc6IChhcmVhLCBzdWIsIHBhcmFtcykgPT5cblxuICAgICAgICAjIGNvbnNvbGUubG9nIFwiYXJlYVwiLGFyZWFcbiAgICAgICAgIyBjb25zb2xlLmxvZyBcInN1YlwiLHN1YlxuICAgICAgICAjIGNvbnNvbGUubG9nIFwicGFyYW1zXCIscGFyYW1zXG5cbiAgICAgICAgQHByZXZpb3VzID0gQGN1cnJlbnRcbiAgICAgICAgQGN1cnJlbnQgID0gYXJlYSA6IGFyZWEsIHN1YiA6IHN1YlxuXG4gICAgICAgIGlmIEBwcmV2aW91cy5hcmVhIGFuZCBAcHJldmlvdXMuYXJlYSBpcyBAY3VycmVudC5hcmVhXG4gICAgICAgICAgICBAdHJpZ2dlciBOYXYuRVZFTlRfQ0hBTkdFX1NVQl9WSUVXLCBAY3VycmVudFxuICAgICAgICBlbHNlXG4gICAgICAgICAgICBAdHJpZ2dlciBOYXYuRVZFTlRfQ0hBTkdFX1ZJRVcsIEBwcmV2aW91cywgQGN1cnJlbnRcbiAgICAgICAgICAgIEB0cmlnZ2VyIE5hdi5FVkVOVF9DSEFOR0VfU1VCX1ZJRVcsIEBjdXJyZW50XG5cbiAgICAgICAgaWYgQENEX0NFKCkuYXBwVmlldy5tb2RhbE1hbmFnZXIuaXNPcGVuKCkgdGhlbiBAQ0RfQ0UoKS5hcHBWaWV3Lm1vZGFsTWFuYWdlci5oaWRlT3Blbk1vZGFsKClcblxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gTmF2XG4iLCJjbGFzcyBSb3V0ZXIgZXh0ZW5kcyBCYWNrYm9uZS5Sb3V0ZXJcblxuICAgIEBFVkVOVF9IQVNIX0NIQU5HRUQgOiAnRVZFTlRfSEFTSF9DSEFOR0VEJ1xuXG4gICAgRklSU1RfUk9VVEUgOiB0cnVlXG5cbiAgICByb3V0ZXMgOlxuICAgICAgICAnKC8pKDphcmVhKSgvOnN1YikoLyknIDogJ2hhc2hDaGFuZ2VkJ1xuICAgICAgICAnKmFjdGlvbnMnICAgICAgICAgICAgIDogJ25hdmlnYXRlVG8nXG5cbiAgICBhcmVhICAgOiBudWxsXG4gICAgc3ViICAgIDogbnVsbFxuICAgIHBhcmFtcyA6IG51bGxcblxuICAgIHN0YXJ0IDogPT5cblxuICAgICAgICBCYWNrYm9uZS5oaXN0b3J5LnN0YXJ0IFxuICAgICAgICAgICAgcHVzaFN0YXRlIDogdHJ1ZVxuICAgICAgICAgICAgcm9vdCAgICAgIDogJy8nXG5cbiAgICAgICAgbnVsbFxuXG4gICAgaGFzaENoYW5nZWQgOiAoQGFyZWEgPSBudWxsLCBAc3ViID0gbnVsbCkgPT5cblxuICAgICAgICBjb25zb2xlLmxvZyBcIj4+IEVWRU5UX0hBU0hfQ0hBTkdFRCBAYXJlYSA9ICN7QGFyZWF9LCBAc3ViID0gI3tAc3VifSA8PFwiXG5cbiAgICAgICAgaWYgQEZJUlNUX1JPVVRFIHRoZW4gQEZJUlNUX1JPVVRFID0gZmFsc2VcblxuICAgICAgICBpZiAhQGFyZWEgdGhlbiBAYXJlYSA9IEBDRF9DRSgpLm5hdi5zZWN0aW9ucy5IT01FXG5cbiAgICAgICAgQHRyaWdnZXIgUm91dGVyLkVWRU5UX0hBU0hfQ0hBTkdFRCwgQGFyZWEsIEBzdWIsIEBwYXJhbXNcblxuICAgICAgICBudWxsXG5cbiAgICBuYXZpZ2F0ZVRvIDogKHdoZXJlID0gJycsIHRyaWdnZXIgPSB0cnVlLCByZXBsYWNlID0gZmFsc2UsIEBwYXJhbXMpID0+XG5cbiAgICAgICAgaWYgd2hlcmUuY2hhckF0KDApIGlzbnQgXCIvXCJcbiAgICAgICAgICAgIHdoZXJlID0gXCIvI3t3aGVyZX1cIlxuICAgICAgICBpZiB3aGVyZS5jaGFyQXQoIHdoZXJlLmxlbmd0aC0xICkgaXNudCBcIi9cIlxuICAgICAgICAgICAgd2hlcmUgPSBcIiN7d2hlcmV9L1wiXG5cbiAgICAgICAgaWYgIXRyaWdnZXJcbiAgICAgICAgICAgIEB0cmlnZ2VyIFJvdXRlci5FVkVOVF9IQVNIX0NIQU5HRUQsIHdoZXJlLCBudWxsLCBAcGFyYW1zXG4gICAgICAgICAgICByZXR1cm5cblxuICAgICAgICBAbmF2aWdhdGUgd2hlcmUsIHRyaWdnZXI6IHRydWUsIHJlcGxhY2U6IHJlcGxhY2VcblxuICAgICAgICBudWxsXG5cbiAgICBDRF9DRSA6ID0+XG5cbiAgICAgICAgcmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IFJvdXRlclxuIiwiIyMjXG5BbmFseXRpY3Mgd3JhcHBlclxuIyMjXG5jbGFzcyBBbmFseXRpY3NcblxuICAgIHRhZ3MgICAgOiBudWxsXG4gICAgc3RhcnRlZCA6IGZhbHNlXG5cbiAgICBhdHRlbXB0cyAgICAgICAgOiAwXG4gICAgYWxsb3dlZEF0dGVtcHRzIDogNVxuXG4gICAgY29uc3RydWN0b3IgOiAoZGF0YSwgQGNhbGxiYWNrKSAtPlxuXG4gICAgICAgIEBwYXJzZURhdGEgZGF0YVxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBwYXJzZURhdGEgOiAoZGF0YSkgPT5cblxuICAgICAgICBAdGFncyAgICA9IGRhdGFcbiAgICAgICAgQHN0YXJ0ZWQgPSB0cnVlXG4gICAgICAgIEBjYWxsYmFjaz8oKVxuXG4gICAgICAgIG51bGxcblxuICAgICMjI1xuICAgIEBwYXJhbSBzdHJpbmcgaWQgb2YgdGhlIHRyYWNraW5nIHRhZyB0byBiZSBwdXNoZWQgb24gQW5hbHl0aWNzIFxuICAgICMjI1xuICAgIHRyYWNrIDogKHBhcmFtKSA9PlxuXG4gICAgICAgIHJldHVybiBpZiAhQHN0YXJ0ZWRcblxuICAgICAgICBpZiBwYXJhbVxuXG4gICAgICAgICAgICB2ID0gQHRhZ3NbcGFyYW1dXG5cbiAgICAgICAgICAgIGlmIHZcblxuICAgICAgICAgICAgICAgIGFyZ3MgPSBbJ3NlbmQnLCAnZXZlbnQnXVxuICAgICAgICAgICAgICAgICggYXJncy5wdXNoKGFyZykgKSBmb3IgYXJnIGluIHZcblxuICAgICAgICAgICAgICAgICMgbG9hZGluZyBHQSBhZnRlciBtYWluIGFwcCBKUywgc28gZXh0ZXJuYWwgc2NyaXB0IG1heSBub3QgYmUgaGVyZSB5ZXRcbiAgICAgICAgICAgICAgICBpZiB3aW5kb3cuZ2FcbiAgICAgICAgICAgICAgICAgICAgZ2EuYXBwbHkgbnVsbCwgYXJnc1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgQGF0dGVtcHRzID49IEBhbGxvd2VkQXR0ZW1wdHNcbiAgICAgICAgICAgICAgICAgICAgQHN0YXJ0ZWQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCA9PlxuICAgICAgICAgICAgICAgICAgICAgICAgQHRyYWNrIHBhcmFtXG4gICAgICAgICAgICAgICAgICAgICAgICBAYXR0ZW1wdHMrK1xuICAgICAgICAgICAgICAgICAgICAsIDIwMDBcblxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQW5hbHl0aWNzXG4iLCJBYnN0cmFjdERhdGEgPSByZXF1aXJlICcuLi9kYXRhL0Fic3RyYWN0RGF0YSdcbkZhY2Vib29rICAgICA9IHJlcXVpcmUgJy4uL3V0aWxzL0ZhY2Vib29rJ1xuR29vZ2xlUGx1cyAgID0gcmVxdWlyZSAnLi4vdXRpbHMvR29vZ2xlUGx1cydcblxuY2xhc3MgQXV0aE1hbmFnZXIgZXh0ZW5kcyBBYnN0cmFjdERhdGFcblxuXHR1c2VyRGF0YSAgOiBudWxsXG5cblx0IyBAcHJvY2VzcyB0cnVlIGR1cmluZyBsb2dpbiBwcm9jZXNzXG5cdHByb2Nlc3MgICAgICA6IGZhbHNlXG5cdHByb2Nlc3NUaW1lciA6IG51bGxcblx0cHJvY2Vzc1dhaXQgIDogNTAwMFxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEB1c2VyRGF0YSAgPSBAQ0RfQ0UoKS5hcHBEYXRhLlVTRVJcblxuXHRcdHN1cGVyKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0bG9naW4gOiAoc2VydmljZSwgY2I9bnVsbCkgPT5cblxuXHRcdCMgY29uc29sZS5sb2cgXCIrKysrIFBST0NFU1MgXCIsQHByb2Nlc3NcblxuXHRcdHJldHVybiBpZiBAcHJvY2Vzc1xuXG5cdFx0QHNob3dMb2FkZXIoKVxuXHRcdEBwcm9jZXNzID0gdHJ1ZVxuXG5cdFx0JGRhdGFEZmQgPSAkLkRlZmVycmVkKClcblxuXHRcdHN3aXRjaCBzZXJ2aWNlXG5cdFx0XHR3aGVuICdnb29nbGUnXG5cdFx0XHRcdEdvb2dsZVBsdXMubG9naW4gJGRhdGFEZmRcblx0XHRcdHdoZW4gJ2ZhY2Vib29rJ1xuXHRcdFx0XHRGYWNlYm9vay5sb2dpbiAkZGF0YURmZFxuXG5cdFx0JGRhdGFEZmQuZG9uZSAocmVzKSA9PiBAYXV0aFN1Y2Nlc3Mgc2VydmljZSwgcmVzXG5cdFx0JGRhdGFEZmQuZmFpbCAocmVzKSA9PiBAYXV0aEZhaWwgc2VydmljZSwgcmVzXG5cdFx0JGRhdGFEZmQuYWx3YXlzICgpID0+IEBhdXRoQ2FsbGJhY2sgY2JcblxuXHRcdCMjI1xuXHRcdFVuZm9ydHVuYXRlbHkgbm8gY2FsbGJhY2sgaXMgZmlyZWQgaWYgdXNlciBtYW51YWxseSBjbG9zZXMgRysgbG9naW4gbW9kYWwsXG5cdFx0c28gdGhpcyBpcyB0byBhbGxvdyB0aGVtIHRvIGNsb3NlIHdpbmRvdyBhbmQgdGhlbiBzdWJzZXF1ZW50bHkgdHJ5IHRvIGxvZyBpbiBhZ2Fpbi4uLlxuXHRcdCMjI1xuXHRcdEBwcm9jZXNzVGltZXIgPSBzZXRUaW1lb3V0IEBhdXRoQ2FsbGJhY2ssIEBwcm9jZXNzV2FpdFxuXG5cdFx0JGRhdGFEZmRcblxuXHRhdXRoU3VjY2VzcyA6IChzZXJ2aWNlLCBkYXRhKSA9PlxuXG5cdFx0IyBjb25zb2xlLmxvZyBcImxvZ2luIGNhbGxiYWNrIGZvciAje3NlcnZpY2V9LCBkYXRhID0+IFwiLCBkYXRhXG5cblx0XHRudWxsXG5cblx0YXV0aEZhaWwgOiAoc2VydmljZSwgZGF0YSkgPT5cblxuXHRcdCMgY29uc29sZS5sb2cgXCJsb2dpbiBmYWlsIGZvciAje3NlcnZpY2V9ID0+IFwiLCBkYXRhXG5cblx0XHRudWxsXG5cblx0YXV0aENhbGxiYWNrIDogKGNiPW51bGwpID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIEBwcm9jZXNzXG5cblx0XHRjbGVhclRpbWVvdXQgQHByb2Nlc3NUaW1lclxuXG5cdFx0QGhpZGVMb2FkZXIoKVxuXHRcdEBwcm9jZXNzID0gZmFsc2VcblxuXHRcdGNiPygpXG5cblx0XHRudWxsXG5cblx0IyMjXG5cdHNob3cgLyBoaWRlIHNvbWUgVUkgaW5kaWNhdG9yIHRoYXQgd2UgYXJlIHdhaXRpbmcgZm9yIHNvY2lhbCBuZXR3b3JrIHRvIHJlc3BvbmRcblx0IyMjXG5cdHNob3dMb2FkZXIgOiA9PlxuXG5cdFx0IyBjb25zb2xlLmxvZyBcInNob3dMb2FkZXJcIlxuXG5cdFx0bnVsbFxuXG5cdGhpZGVMb2FkZXIgOiA9PlxuXG5cdFx0IyBjb25zb2xlLmxvZyBcImhpZGVMb2FkZXJcIlxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEF1dGhNYW5hZ2VyXG4iLCJlbmNvZGUgPSByZXF1aXJlICdlbnQvZW5jb2RlJ1xuXG5jbGFzcyBDb2RlV29yZFRyYW5zaXRpb25lclxuXG5cdEBjb25maWcgOlxuXHRcdE1JTl9XUk9OR19DSEFSUyA6IDFcblx0XHRNQVhfV1JPTkdfQ0hBUlMgOiA3XG5cblx0XHRNSU5fQ0hBUl9JTl9ERUxBWSA6IDQwXG5cdFx0TUFYX0NIQVJfSU5fREVMQVkgOiA3MFxuXG5cdFx0TUlOX0NIQVJfT1VUX0RFTEFZIDogNDBcblx0XHRNQVhfQ0hBUl9PVVRfREVMQVkgOiA3MFxuXG5cdFx0Q0hBUlMgOiAnYWJjZGVmaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkhPyooKUDCoyQlXiZfLSs9W117fTo7XFwnXCJcXFxcfDw+LC4vfmAnLnNwbGl0KCcnKS5tYXAoKGNoYXIpID0+IHJldHVybiBlbmNvZGUoY2hhcikpXG5cblx0XHRDSEFSX1RFTVBMQVRFIDogXCI8c3BhbiBkYXRhLWNvZGV0ZXh0LWNoYXI9XFxcInt7IGNoYXIgfX1cXFwiIGRhdGEtY29kZXRleHQtY2hhci1zdGF0ZT1cXFwie3sgc3RhdGUgfX1cXFwiPnt7IGNoYXIgfX08L3NwYW4+XCJcblxuXHRAX3dvcmRDYWNoZSA6IHt9XG5cblx0QF9nZXRXb3JkRnJvbUNhY2hlIDogKCRlbCwgaW5pdGlhbFN0YXRlPW51bGwpID0+XG5cblx0XHRpZCA9ICRlbC5hdHRyKCdkYXRhLWNvZGV3b3JkLWlkJylcblxuXHRcdGlmIGlkIGFuZCBAX3dvcmRDYWNoZVsgaWQgXVxuXHRcdFx0d29yZCA9IEBfd29yZENhY2hlWyBpZCBdXG5cdFx0ZWxzZVxuXHRcdFx0QF93cmFwQ2hhcnMgJGVsLCBpbml0aWFsU3RhdGVcblx0XHRcdHdvcmQgPSBAX2FkZFdvcmRUb0NhY2hlICRlbFxuXG5cdFx0d29yZFxuXG5cdEBfYWRkV29yZFRvQ2FjaGUgOiAoJGVsKSA9PlxuXG5cdFx0Y2hhcnMgPSBbXVxuXG5cdFx0JGVsLmZpbmQoJ1tkYXRhLWNvZGV0ZXh0LWNoYXJdJykuZWFjaCAoaSwgZWwpID0+XG5cdFx0XHQkY2hhckVsID0gJChlbClcblx0XHRcdGNoYXJzLnB1c2hcblx0XHRcdFx0JGVsICAgICAgICA6ICRjaGFyRWxcblx0XHRcdFx0cmlnaHRDaGFyICA6ICRjaGFyRWwuYXR0cignZGF0YS1jb2RldGV4dC1jaGFyJylcblxuXHRcdGlkID0gXy51bmlxdWVJZCgpXG5cdFx0JGVsLmF0dHIgJ2RhdGEtY29kZXdvcmQtaWQnLCBpZFxuXG5cdFx0QF93b3JkQ2FjaGVbIGlkIF0gPVxuXHRcdFx0d29yZCAgICA6IF8ucGx1Y2soY2hhcnMsICdyaWdodENoYXInKS5qb2luKCcnKVxuXHRcdFx0JGVsICAgICA6ICRlbFxuXHRcdFx0Y2hhcnMgICA6IGNoYXJzXG5cdFx0XHR2aXNpYmxlIDogdHJ1ZVxuXG5cdFx0QF93b3JkQ2FjaGVbIGlkIF1cblxuXHRAX3dyYXBDaGFycyA6ICgkZWwsIGluaXRpYWxTdGF0ZT1udWxsKSA9PlxuXG5cdFx0Y2hhcnMgPSAkZWwudGV4dCgpLnNwbGl0KCcnKVxuXHRcdHN0YXRlID0gaW5pdGlhbFN0YXRlIG9yICRlbC5hdHRyKCdkYXRhLWNvZGV3b3JkLWluaXRpYWwtc3RhdGUnKSBvciBcIlwiXG5cdFx0aHRtbCA9IFtdXG5cdFx0Zm9yIGNoYXIgaW4gY2hhcnNcblx0XHRcdGh0bWwucHVzaCBAX3N1cHBsYW50U3RyaW5nIEBjb25maWcuQ0hBUl9URU1QTEFURSwgY2hhciA6IGNoYXIsIHN0YXRlOiBzdGF0ZVxuXG5cdFx0JGVsLmh0bWwgaHRtbC5qb2luKCcnKVxuXG5cdFx0bnVsbFxuXG5cdCMgQHBhcmFtIHRhcmdldCA9ICdyaWdodCcsICd3cm9uZycsICdlbXB0eSdcblx0QF9wcmVwYXJlV29yZCA6ICh3b3JkLCB0YXJnZXQsIGNoYXJTdGF0ZT0nJykgPT5cblxuXHRcdGZvciBjaGFyLCBpIGluIHdvcmQuY2hhcnNcblxuXHRcdFx0dGFyZ2V0Q2hhciA9IHN3aXRjaCB0cnVlXG5cdFx0XHRcdHdoZW4gdGFyZ2V0IGlzICdyaWdodCcgdGhlbiBjaGFyLnJpZ2h0Q2hhclxuXHRcdFx0XHR3aGVuIHRhcmdldCBpcyAnd3JvbmcnIHRoZW4gQF9nZXRSYW5kb21DaGFyKClcblx0XHRcdFx0d2hlbiB0YXJnZXQgaXMgJ2VtcHR5JyB0aGVuICcnXG5cdFx0XHRcdGVsc2UgdGFyZ2V0LmNoYXJBdChpKSBvciAnJ1xuXG5cdFx0XHRpZiB0YXJnZXRDaGFyIGlzICcgJyB0aGVuIHRhcmdldENoYXIgPSAnJm5ic3A7J1xuXG5cdFx0XHRjaGFyLndyb25nQ2hhcnMgPSBAX2dldFJhbmRvbVdyb25nQ2hhcnMoKVxuXHRcdFx0Y2hhci50YXJnZXRDaGFyID0gdGFyZ2V0Q2hhclxuXHRcdFx0Y2hhci5jaGFyU3RhdGUgID0gY2hhclN0YXRlXG5cblx0XHRudWxsXG5cblx0QF9nZXRSYW5kb21Xcm9uZ0NoYXJzIDogPT5cblxuXHRcdGNoYXJzID0gW11cblxuXHRcdGNoYXJDb3VudCA9IF8ucmFuZG9tIEBjb25maWcuTUlOX1dST05HX0NIQVJTLCBAY29uZmlnLk1BWF9XUk9OR19DSEFSU1xuXG5cdFx0Zm9yIGkgaW4gWzAuLi5jaGFyQ291bnRdXG5cdFx0XHRjaGFycy5wdXNoXG5cdFx0XHRcdGNoYXIgICAgIDogQF9nZXRSYW5kb21DaGFyKClcblx0XHRcdFx0aW5EZWxheSAgOiBfLnJhbmRvbSBAY29uZmlnLk1JTl9DSEFSX0lOX0RFTEFZLCBAY29uZmlnLk1BWF9DSEFSX0lOX0RFTEFZXG5cdFx0XHRcdG91dERlbGF5IDogXy5yYW5kb20gQGNvbmZpZy5NSU5fQ0hBUl9PVVRfREVMQVksIEBjb25maWcuTUFYX0NIQVJfT1VUX0RFTEFZXG5cblx0XHRjaGFyc1xuXG5cdEBfZ2V0UmFuZG9tQ2hhciA6ID0+XG5cblx0XHRjaGFyID0gQGNvbmZpZy5DSEFSU1sgXy5yYW5kb20oMCwgQGNvbmZpZy5DSEFSUy5sZW5ndGgtMSkgXVxuXG5cdFx0Y2hhclxuXG5cdEBfZ2V0TG9uZ2VzdENoYXJEdXJhdGlvbiA6IChjaGFycykgPT5cblxuXHRcdGxvbmdlc3RUaW1lID0gMFxuXHRcdGxvbmdlc3RUaW1lSWR4ID0gMFxuXG5cdFx0Zm9yIGNoYXIsIGkgaW4gY2hhcnNcblxuXHRcdFx0dGltZSA9IDBcblx0XHRcdCh0aW1lICs9IHdyb25nQ2hhci5pbkRlbGF5ICsgd3JvbmdDaGFyLm91dERlbGF5KSBmb3Igd3JvbmdDaGFyIGluIGNoYXIud3JvbmdDaGFyc1xuXHRcdFx0aWYgdGltZSA+IGxvbmdlc3RUaW1lXG5cdFx0XHRcdGxvbmdlc3RUaW1lID0gdGltZVxuXHRcdFx0XHRsb25nZXN0VGltZUlkeCA9IGlcblxuXHRcdGxvbmdlc3RUaW1lSWR4XG5cblx0QF9hbmltYXRlQ2hhcnMgOiAod29yZCwgc2VxdWVudGlhbCwgY2IpID0+XG5cblx0XHRhY3RpdmVDaGFyID0gMFxuXG5cdFx0aWYgc2VxdWVudGlhbFxuXHRcdFx0QF9hbmltYXRlQ2hhciB3b3JkLmNoYXJzLCBhY3RpdmVDaGFyLCB0cnVlLCBjYlxuXHRcdGVsc2Vcblx0XHRcdGxvbmdlc3RDaGFySWR4ID0gQF9nZXRMb25nZXN0Q2hhckR1cmF0aW9uIHdvcmQuY2hhcnNcblx0XHRcdGZvciBjaGFyLCBpIGluIHdvcmQuY2hhcnNcblx0XHRcdFx0YXJncyA9IFsgd29yZC5jaGFycywgaSwgZmFsc2UgXVxuXHRcdFx0XHRpZiBpIGlzIGxvbmdlc3RDaGFySWR4IHRoZW4gYXJncy5wdXNoIGNiXG5cdFx0XHRcdEBfYW5pbWF0ZUNoYXIuYXBwbHkgQCwgYXJnc1xuXG5cdFx0bnVsbFxuXG5cdEBfYW5pbWF0ZUNoYXIgOiAoY2hhcnMsIGlkeCwgcmVjdXJzZSwgY2IpID0+XG5cblx0XHRjaGFyID0gY2hhcnNbaWR4XVxuXG5cdFx0aWYgcmVjdXJzZVxuXG5cdFx0XHRAX2FuaW1hdGVXcm9uZ0NoYXJzIGNoYXIsID0+XG5cblx0XHRcdFx0aWYgaWR4IGlzIGNoYXJzLmxlbmd0aC0xXG5cdFx0XHRcdFx0QF9hbmltYXRlQ2hhcnNEb25lIGNiXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRAX2FuaW1hdGVDaGFyIGNoYXJzLCBpZHgrMSwgcmVjdXJzZSwgY2JcblxuXHRcdGVsc2VcblxuXHRcdFx0aWYgdHlwZW9mIGNiIGlzICdmdW5jdGlvbidcblx0XHRcdFx0QF9hbmltYXRlV3JvbmdDaGFycyBjaGFyLCA9PiBAX2FuaW1hdGVDaGFyc0RvbmUgY2Jcblx0XHRcdGVsc2Vcblx0XHRcdFx0QF9hbmltYXRlV3JvbmdDaGFycyBjaGFyXG5cblx0XHRudWxsXG5cblx0QF9hbmltYXRlV3JvbmdDaGFycyA6IChjaGFyLCBjYikgPT5cblxuXHRcdGlmIGNoYXIud3JvbmdDaGFycy5sZW5ndGhcblxuXHRcdFx0d3JvbmdDaGFyID0gY2hhci53cm9uZ0NoYXJzLnNoaWZ0KClcblxuXHRcdFx0c2V0VGltZW91dCA9PlxuXHRcdFx0XHRjaGFyLiRlbC5odG1sIHdyb25nQ2hhci5jaGFyXG5cblx0XHRcdFx0c2V0VGltZW91dCA9PlxuXHRcdFx0XHRcdEBfYW5pbWF0ZVdyb25nQ2hhcnMgY2hhciwgY2Jcblx0XHRcdFx0LCB3cm9uZ0NoYXIub3V0RGVsYXlcblxuXHRcdFx0LCB3cm9uZ0NoYXIuaW5EZWxheVxuXG5cdFx0ZWxzZVxuXG5cdFx0XHRjaGFyLiRlbFxuXHRcdFx0XHQuYXR0cignZGF0YS1jb2RldGV4dC1jaGFyLXN0YXRlJywgY2hhci5jaGFyU3RhdGUpXG5cdFx0XHRcdC5odG1sKGNoYXIudGFyZ2V0Q2hhcilcblxuXHRcdFx0Y2I/KClcblxuXHRcdG51bGxcblxuXHRAX2FuaW1hdGVDaGFyc0RvbmUgOiAoY2IpID0+XG5cblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdEBfc3VwcGxhbnRTdHJpbmcgOiAoc3RyLCB2YWxzKSA9PlxuXG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlIC97eyAoW157fV0qKSB9fS9nLCAoYSwgYikgPT5cblx0XHRcdHIgPSB2YWxzW2JdXG5cdFx0XHQoaWYgdHlwZW9mIHIgaXMgXCJzdHJpbmdcIiBvciB0eXBlb2YgciBpcyBcIm51bWJlclwiIHRoZW4gciBlbHNlIGEpXG5cblx0QHRvIDogKHRhcmdldFRleHQsICRlbCwgY2hhclN0YXRlLCBzZXF1ZW50aWFsPWZhbHNlLCBjYj1udWxsKSA9PlxuXG5cdFx0aWYgXy5pc0FycmF5ICRlbFxuXHRcdFx0KEB0byh0YXJnZXRUZXh0LCBfJGVsLCBjaGFyU3RhdGUsIGNiKSkgZm9yIF8kZWwgaW4gJGVsXG5cdFx0XHRyZXR1cm5cblxuXHRcdHdvcmQgPSBAX2dldFdvcmRGcm9tQ2FjaGUgJGVsXG5cdFx0d29yZC52aXNpYmxlID0gdHJ1ZVxuXG5cdFx0QF9wcmVwYXJlV29yZCB3b3JkLCB0YXJnZXRUZXh0LCBjaGFyU3RhdGVcblx0XHRAX2FuaW1hdGVDaGFycyB3b3JkLCBzZXF1ZW50aWFsLCBjYlxuXG5cdFx0bnVsbFxuXG5cdEBpbiA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAaW4oXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXHRcdHdvcmQudmlzaWJsZSA9IHRydWVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ3JpZ2h0JywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAb3V0IDogKCRlbCwgY2hhclN0YXRlLCBzZXF1ZW50aWFsPWZhbHNlLCBjYj1udWxsKSA9PlxuXG5cdFx0aWYgXy5pc0FycmF5ICRlbFxuXHRcdFx0KEBvdXQoXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXHRcdHJldHVybiBpZiAhd29yZC52aXNpYmxlXG5cblx0XHR3b3JkLnZpc2libGUgPSBmYWxzZVxuXG5cdFx0QF9wcmVwYXJlV29yZCB3b3JkLCAnZW1wdHknLCBjaGFyU3RhdGVcblx0XHRAX2FuaW1hdGVDaGFycyB3b3JkLCBzZXF1ZW50aWFsLCBjYlxuXG5cdFx0bnVsbFxuXG5cdEBzY3JhbWJsZSA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAc2NyYW1ibGUoXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXG5cdFx0cmV0dXJuIGlmICF3b3JkLnZpc2libGVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ3dyb25nJywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAdW5zY3JhbWJsZSA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAdW5zY3JhbWJsZShfJGVsLCBjaGFyU3RhdGUsIGNiKSkgZm9yIF8kZWwgaW4gJGVsXG5cdFx0XHRyZXR1cm5cblxuXHRcdHdvcmQgPSBAX2dldFdvcmRGcm9tQ2FjaGUgJGVsXG5cblx0XHRyZXR1cm4gaWYgIXdvcmQudmlzaWJsZVxuXG5cdFx0QF9wcmVwYXJlV29yZCB3b3JkLCAncmlnaHQnLCBjaGFyU3RhdGVcblx0XHRAX2FuaW1hdGVDaGFycyB3b3JkLCBzZXF1ZW50aWFsLCBjYlxuXG5cdFx0bnVsbFxuXG5cdEBwcmVwYXJlIDogKCRlbCwgaW5pdGlhbFN0YXRlKSA9PlxuXG5cdFx0aWYgXy5pc0FycmF5ICRlbFxuXHRcdFx0KEBwcmVwYXJlKF8kZWwsIGluaXRpYWxTdGF0ZSkpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHRAX2dldFdvcmRGcm9tQ2FjaGUgJGVsLCBpbml0aWFsU3RhdGVcblxuXHRcdG51bGxcblxuXHRAZ2V0U2NyYW1ibGVkV29yZCA6ICh3b3JkKSA9PlxuXG5cdFx0bmV3Q2hhcnMgPSBbXVxuXHRcdChuZXdDaGFycy5wdXNoIEBfZ2V0UmFuZG9tQ2hhcigpKSBmb3IgY2hhciBpbiB3b3JkLnNwbGl0KCcnKVxuXG5cdFx0cmV0dXJuIG5ld0NoYXJzLmpvaW4oJycpXG5cbm1vZHVsZS5leHBvcnRzID0gQ29kZVdvcmRUcmFuc2l0aW9uZXJcbiIsIkFic3RyYWN0RGF0YSA9IHJlcXVpcmUgJy4uL2RhdGEvQWJzdHJhY3REYXRhJ1xuXG4jIyNcblxuRmFjZWJvb2sgU0RLIHdyYXBwZXIgLSBsb2FkIGFzeW5jaHJvbm91c2x5LCBzb21lIGhlbHBlciBtZXRob2RzXG5cbiMjI1xuY2xhc3MgRmFjZWJvb2sgZXh0ZW5kcyBBYnN0cmFjdERhdGFcblxuXHRAdXJsICAgICAgICAgOiAnLy9jb25uZWN0LmZhY2Vib29rLm5ldC9lbl9VUy9hbGwuanMnXG5cblx0QHBlcm1pc3Npb25zIDogJ2VtYWlsJ1xuXG5cdEAkZGF0YURmZCAgICA6IG51bGxcblx0QGxvYWRlZCAgICAgIDogZmFsc2VcblxuXHRAbG9hZCA6ID0+XG5cblx0XHQjIyNcblx0XHRUTyBET1xuXHRcdGluY2x1ZGUgc2NyaXB0IGxvYWRlciB3aXRoIGNhbGxiYWNrIHRvIDppbml0XG5cdFx0IyMjXG5cdFx0IyByZXF1aXJlIFtAdXJsXSwgQGluaXRcblxuXHRcdG51bGxcblxuXHRAaW5pdCA6ID0+XG5cblx0XHRAbG9hZGVkID0gdHJ1ZVxuXG5cdFx0RkIuaW5pdFxuXHRcdFx0YXBwSWQgIDogd2luZG93LmNvbmZpZy5mYl9hcHBfaWRcblx0XHRcdHN0YXR1cyA6IGZhbHNlXG5cdFx0XHR4ZmJtbCAgOiBmYWxzZVxuXG5cdFx0bnVsbFxuXG5cdEBsb2dpbiA6IChAJGRhdGFEZmQpID0+XG5cblx0XHRpZiAhQGxvYWRlZCB0aGVuIHJldHVybiBAJGRhdGFEZmQucmVqZWN0ICdTREsgbm90IGxvYWRlZCdcblxuXHRcdEZCLmxvZ2luICggcmVzICkgPT5cblxuXHRcdFx0aWYgcmVzWydzdGF0dXMnXSBpcyAnY29ubmVjdGVkJ1xuXHRcdFx0XHRAZ2V0VXNlckRhdGEgcmVzWydhdXRoUmVzcG9uc2UnXVsnYWNjZXNzVG9rZW4nXVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRAJGRhdGFEZmQucmVqZWN0ICdubyB3YXkgam9zZSdcblxuXHRcdCwgeyBzY29wZTogQHBlcm1pc3Npb25zIH1cblxuXHRcdG51bGxcblxuXHRAZ2V0VXNlckRhdGEgOiAodG9rZW4pID0+XG5cblx0XHR1c2VyRGF0YSA9IHt9XG5cdFx0dXNlckRhdGEuYWNjZXNzX3Rva2VuID0gdG9rZW5cblxuXHRcdCRtZURmZCAgID0gJC5EZWZlcnJlZCgpXG5cdFx0JHBpY0RmZCAgPSAkLkRlZmVycmVkKClcblxuXHRcdEZCLmFwaSAnL21lJywgKHJlcykgLT5cblxuXHRcdFx0dXNlckRhdGEuZnVsbF9uYW1lID0gcmVzLm5hbWVcblx0XHRcdHVzZXJEYXRhLnNvY2lhbF9pZCA9IHJlcy5pZFxuXHRcdFx0dXNlckRhdGEuZW1haWwgICAgID0gcmVzLmVtYWlsIG9yIGZhbHNlXG5cdFx0XHQkbWVEZmQucmVzb2x2ZSgpXG5cblx0XHRGQi5hcGkgJy9tZS9waWN0dXJlJywgeyAnd2lkdGgnOiAnMjAwJyB9LCAocmVzKSAtPlxuXG5cdFx0XHR1c2VyRGF0YS5wcm9maWxlX3BpYyA9IHJlcy5kYXRhLnVybFxuXHRcdFx0JHBpY0RmZC5yZXNvbHZlKClcblxuXHRcdCQud2hlbigkbWVEZmQsICRwaWNEZmQpLmRvbmUgPT4gQCRkYXRhRGZkLnJlc29sdmUgdXNlckRhdGFcblxuXHRcdG51bGxcblxuXHRAc2hhcmUgOiAob3B0cywgY2IpID0+XG5cblx0XHRGQi51aSB7XG5cdFx0XHRtZXRob2QgICAgICA6IG9wdHMubWV0aG9kIG9yICdmZWVkJ1xuXHRcdFx0bmFtZSAgICAgICAgOiBvcHRzLm5hbWUgb3IgJydcblx0XHRcdGxpbmsgICAgICAgIDogb3B0cy5saW5rIG9yICcnXG5cdFx0XHRwaWN0dXJlICAgICA6IG9wdHMucGljdHVyZSBvciAnJ1xuXHRcdFx0Y2FwdGlvbiAgICAgOiBvcHRzLmNhcHRpb24gb3IgJydcblx0XHRcdGRlc2NyaXB0aW9uIDogb3B0cy5kZXNjcmlwdGlvbiBvciAnJ1xuXHRcdH0sIChyZXNwb25zZSkgLT5cblx0XHRcdGNiPyhyZXNwb25zZSlcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBGYWNlYm9va1xuIiwiQWJzdHJhY3REYXRhID0gcmVxdWlyZSAnLi4vZGF0YS9BYnN0cmFjdERhdGEnXG5cbiMjI1xuXG5Hb29nbGUrIFNESyB3cmFwcGVyIC0gbG9hZCBhc3luY2hyb25vdXNseSwgc29tZSBoZWxwZXIgbWV0aG9kc1xuXG4jIyNcbmNsYXNzIEdvb2dsZVBsdXMgZXh0ZW5kcyBBYnN0cmFjdERhdGFcblxuXHRAdXJsICAgICAgOiAnaHR0cHM6Ly9hcGlzLmdvb2dsZS5jb20vanMvY2xpZW50OnBsdXNvbmUuanMnXG5cblx0QHBhcmFtcyAgIDpcblx0XHQnY2xpZW50aWQnICAgICA6IG51bGxcblx0XHQnY2FsbGJhY2snICAgICA6IG51bGxcblx0XHQnc2NvcGUnICAgICAgICA6ICdodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL3VzZXJpbmZvLmVtYWlsJ1xuXHRcdCdjb29raWVwb2xpY3knIDogJ25vbmUnXG5cblx0QCRkYXRhRGZkIDogbnVsbFxuXHRAbG9hZGVkICAgOiBmYWxzZVxuXG5cdEBsb2FkIDogPT5cblxuXHRcdCMjI1xuXHRcdFRPIERPXG5cdFx0aW5jbHVkZSBzY3JpcHQgbG9hZGVyIHdpdGggY2FsbGJhY2sgdG8gOmluaXRcblx0XHQjIyNcblx0XHQjIHJlcXVpcmUgW0B1cmxdLCBAaW5pdFxuXG5cdFx0bnVsbFxuXG5cdEBpbml0IDogPT5cblxuXHRcdEBsb2FkZWQgPSB0cnVlXG5cblx0XHRAcGFyYW1zWydjbGllbnRpZCddID0gd2luZG93LmNvbmZpZy5ncF9hcHBfaWRcblx0XHRAcGFyYW1zWydjYWxsYmFjayddID0gQGxvZ2luQ2FsbGJhY2tcblxuXHRcdG51bGxcblxuXHRAbG9naW4gOiAoQCRkYXRhRGZkKSA9PlxuXG5cdFx0aWYgQGxvYWRlZFxuXHRcdFx0Z2FwaS5hdXRoLnNpZ25JbiBAcGFyYW1zXG5cdFx0ZWxzZVxuXHRcdFx0QCRkYXRhRGZkLnJlamVjdCAnU0RLIG5vdCBsb2FkZWQnXG5cblx0XHRudWxsXG5cblx0QGxvZ2luQ2FsbGJhY2sgOiAocmVzKSA9PlxuXG5cdFx0aWYgcmVzWydzdGF0dXMnXVsnc2lnbmVkX2luJ11cblx0XHRcdEBnZXRVc2VyRGF0YSByZXNbJ2FjY2Vzc190b2tlbiddXG5cdFx0ZWxzZSBpZiByZXNbJ2Vycm9yJ11bJ2FjY2Vzc19kZW5pZWQnXVxuXHRcdFx0QCRkYXRhRGZkLnJlamVjdCAnbm8gd2F5IGpvc2UnXG5cblx0XHRudWxsXG5cblx0QGdldFVzZXJEYXRhIDogKHRva2VuKSA9PlxuXG5cdFx0Z2FwaS5jbGllbnQubG9hZCAncGx1cycsJ3YxJywgPT5cblxuXHRcdFx0cmVxdWVzdCA9IGdhcGkuY2xpZW50LnBsdXMucGVvcGxlLmdldCAndXNlcklkJzogJ21lJ1xuXHRcdFx0cmVxdWVzdC5leGVjdXRlIChyZXMpID0+XG5cblx0XHRcdFx0dXNlckRhdGEgPVxuXHRcdFx0XHRcdGFjY2Vzc190b2tlbiA6IHRva2VuXG5cdFx0XHRcdFx0ZnVsbF9uYW1lICAgIDogcmVzLmRpc3BsYXlOYW1lXG5cdFx0XHRcdFx0c29jaWFsX2lkICAgIDogcmVzLmlkXG5cdFx0XHRcdFx0ZW1haWwgICAgICAgIDogaWYgcmVzLmVtYWlsc1swXSB0aGVuIHJlcy5lbWFpbHNbMF0udmFsdWUgZWxzZSBmYWxzZVxuXHRcdFx0XHRcdHByb2ZpbGVfcGljICA6IHJlcy5pbWFnZS51cmxcblxuXHRcdFx0XHRAJGRhdGFEZmQucmVzb2x2ZSB1c2VyRGF0YVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEdvb2dsZVBsdXNcbiIsIiMgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgICBNZWRpYSBRdWVyaWVzIE1hbmFnZXIgXG4jICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgXG4jICAgQGF1dGhvciA6IEbDoWJpbyBBemV2ZWRvIDxmYWJpby5hemV2ZWRvQHVuaXQ5LmNvbT4gVU5JVDlcbiMgICBAZGF0ZSAgIDogU2VwdGVtYmVyIDE0XG4jICAgXG4jICAgSW5zdHJ1Y3Rpb25zIGFyZSBvbiAvcHJvamVjdC9zYXNzL3V0aWxzL19yZXNwb25zaXZlLnNjc3MuXG5cbmNsYXNzIE1lZGlhUXVlcmllc1xuXG4gICAgIyBCcmVha3BvaW50c1xuICAgIEBTTUFMTCAgICAgICA6IFwic21hbGxcIlxuICAgIEBJUEFEICAgICAgICA6IFwiaXBhZFwiXG4gICAgQE1FRElVTSAgICAgIDogXCJtZWRpdW1cIlxuICAgIEBMQVJHRSAgICAgICA6IFwibGFyZ2VcIlxuICAgIEBFWFRSQV9MQVJHRSA6IFwiZXh0cmEtbGFyZ2VcIlxuXG4gICAgQHNldHVwIDogPT5cblxuICAgICAgICBNZWRpYVF1ZXJpZXMuU01BTExfQlJFQUtQT0lOVCAgPSB7bmFtZTogXCJTbWFsbFwiLCBicmVha3BvaW50czogW01lZGlhUXVlcmllcy5TTUFMTF19XG4gICAgICAgIE1lZGlhUXVlcmllcy5NRURJVU1fQlJFQUtQT0lOVCA9IHtuYW1lOiBcIk1lZGl1bVwiLCBicmVha3BvaW50czogW01lZGlhUXVlcmllcy5NRURJVU1dfVxuICAgICAgICBNZWRpYVF1ZXJpZXMuTEFSR0VfQlJFQUtQT0lOVCAgPSB7bmFtZTogXCJMYXJnZVwiLCBicmVha3BvaW50czogW01lZGlhUXVlcmllcy5JUEFELCBNZWRpYVF1ZXJpZXMuTEFSR0UsIE1lZGlhUXVlcmllcy5FWFRSQV9MQVJHRV19XG5cbiAgICAgICAgTWVkaWFRdWVyaWVzLkJSRUFLUE9JTlRTID0gW1xuICAgICAgICAgICAgTWVkaWFRdWVyaWVzLlNNQUxMX0JSRUFLUE9JTlRcbiAgICAgICAgICAgIE1lZGlhUXVlcmllcy5NRURJVU1fQlJFQUtQT0lOVFxuICAgICAgICAgICAgTWVkaWFRdWVyaWVzLkxBUkdFX0JSRUFLUE9JTlRcbiAgICAgICAgXVxuICAgICAgICByZXR1cm5cblxuICAgIEBnZXREZXZpY2VTdGF0ZSA6ID0+XG5cbiAgICAgICAgcmV0dXJuIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHksIFwiYWZ0ZXJcIikuZ2V0UHJvcGVydHlWYWx1ZShcImNvbnRlbnRcIik7XG5cbiAgICBAZ2V0QnJlYWtwb2ludCA6ID0+XG5cbiAgICAgICAgc3RhdGUgPSBNZWRpYVF1ZXJpZXMuZ2V0RGV2aWNlU3RhdGUoKVxuXG4gICAgICAgIGZvciBpIGluIFswLi4uTWVkaWFRdWVyaWVzLkJSRUFLUE9JTlRTLmxlbmd0aF1cbiAgICAgICAgICAgIGlmIE1lZGlhUXVlcmllcy5CUkVBS1BPSU5UU1tpXS5icmVha3BvaW50cy5pbmRleE9mKHN0YXRlKSA+IC0xXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1lZGlhUXVlcmllcy5CUkVBS1BPSU5UU1tpXS5uYW1lXG5cbiAgICAgICAgcmV0dXJuIFwiXCJcblxuICAgIEBpc0JyZWFrcG9pbnQgOiAoYnJlYWtwb2ludCkgPT5cblxuICAgICAgICBmb3IgaSBpbiBbMC4uLmJyZWFrcG9pbnQuYnJlYWtwb2ludHMubGVuZ3RoXVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBicmVha3BvaW50LmJyZWFrcG9pbnRzW2ldID09IE1lZGlhUXVlcmllcy5nZXREZXZpY2VTdGF0ZSgpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcblxuICAgICAgICByZXR1cm4gZmFsc2VcblxubW9kdWxlLmV4cG9ydHMgPSBNZWRpYVF1ZXJpZXMiLCJjbGFzcyBOdW1iZXJVdGlsc1xuXG4gICAgQE1BVEhfQ09TOiBNYXRoLmNvcyBcbiAgICBATUFUSF9TSU46IE1hdGguc2luIFxuICAgIEBNQVRIX1JBTkRPTTogTWF0aC5yYW5kb20gXG4gICAgQE1BVEhfQUJTOiBNYXRoLmFic1xuICAgIEBNQVRIX0FUQU4yOiBNYXRoLmF0YW4yXG5cbiAgICBAbGltaXQ6KG51bWJlciwgbWluLCBtYXgpLT5cbiAgICAgICAgcmV0dXJuIE1hdGgubWluKCBNYXRoLm1heChtaW4sbnVtYmVyKSwgbWF4IClcblxuICAgIEBnZXRSYW5kb21Db2xvcjogLT5cblxuICAgICAgICBsZXR0ZXJzID0gJzAxMjM0NTY3ODlBQkNERUYnLnNwbGl0KCcnKVxuICAgICAgICBjb2xvciA9ICcjJ1xuICAgICAgICBmb3IgaSBpbiBbMC4uLjZdXG4gICAgICAgICAgICBjb2xvciArPSBsZXR0ZXJzW01hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDE1KV1cbiAgICAgICAgY29sb3JcblxuICAgIEBnZXRUaW1lU3RhbXBEaWZmIDogKGRhdGUxLCBkYXRlMikgLT5cblxuICAgICAgICAjIEdldCAxIGRheSBpbiBtaWxsaXNlY29uZHNcbiAgICAgICAgb25lX2RheSA9IDEwMDAqNjAqNjAqMjRcbiAgICAgICAgdGltZSAgICA9IHt9XG5cbiAgICAgICAgIyBDb252ZXJ0IGJvdGggZGF0ZXMgdG8gbWlsbGlzZWNvbmRzXG4gICAgICAgIGRhdGUxX21zID0gZGF0ZTEuZ2V0VGltZSgpXG4gICAgICAgIGRhdGUyX21zID0gZGF0ZTIuZ2V0VGltZSgpXG5cbiAgICAgICAgIyBDYWxjdWxhdGUgdGhlIGRpZmZlcmVuY2UgaW4gbWlsbGlzZWNvbmRzXG4gICAgICAgIGRpZmZlcmVuY2VfbXMgPSBkYXRlMl9tcyAtIGRhdGUxX21zXG5cbiAgICAgICAgIyB0YWtlIG91dCBtaWxsaXNlY29uZHNcbiAgICAgICAgZGlmZmVyZW5jZV9tcyA9IGRpZmZlcmVuY2VfbXMvMTAwMFxuICAgICAgICB0aW1lLnNlY29uZHMgID0gTWF0aC5mbG9vcihkaWZmZXJlbmNlX21zICUgNjApXG5cbiAgICAgICAgZGlmZmVyZW5jZV9tcyA9IGRpZmZlcmVuY2VfbXMvNjAgXG4gICAgICAgIHRpbWUubWludXRlcyAgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VfbXMgJSA2MClcblxuICAgICAgICBkaWZmZXJlbmNlX21zID0gZGlmZmVyZW5jZV9tcy82MCBcbiAgICAgICAgdGltZS5ob3VycyAgICA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZV9tcyAlIDI0KSAgXG5cbiAgICAgICAgdGltZS5kYXlzICAgICA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZV9tcy8yNClcblxuICAgICAgICB0aW1lXG5cbiAgICBAbWFwOiAoIG51bSwgbWluMSwgbWF4MSwgbWluMiwgbWF4Miwgcm91bmQgPSBmYWxzZSwgY29uc3RyYWluTWluID0gdHJ1ZSwgY29uc3RyYWluTWF4ID0gdHJ1ZSApIC0+XG4gICAgICAgIGlmIGNvbnN0cmFpbk1pbiBhbmQgbnVtIDwgbWluMSB0aGVuIHJldHVybiBtaW4yXG4gICAgICAgIGlmIGNvbnN0cmFpbk1heCBhbmQgbnVtID4gbWF4MSB0aGVuIHJldHVybiBtYXgyXG4gICAgICAgIFxuICAgICAgICBudW0xID0gKG51bSAtIG1pbjEpIC8gKG1heDEgLSBtaW4xKVxuICAgICAgICBudW0yID0gKG51bTEgKiAobWF4MiAtIG1pbjIpKSArIG1pbjJcbiAgICAgICAgaWYgcm91bmQgdGhlbiByZXR1cm4gTWF0aC5yb3VuZChudW0yKVxuXG4gICAgICAgIHJldHVybiBudW0yXG5cbiAgICBAdG9SYWRpYW5zOiAoIGRlZ3JlZSApIC0+XG4gICAgICAgIHJldHVybiBkZWdyZWUgKiAoIE1hdGguUEkgLyAxODAgKVxuXG4gICAgQHRvRGVncmVlOiAoIHJhZGlhbnMgKSAtPlxuICAgICAgICByZXR1cm4gcmFkaWFucyAqICggMTgwIC8gTWF0aC5QSSApXG5cbiAgICBAaXNJblJhbmdlOiAoIG51bSwgbWluLCBtYXgsIGNhbkJlRXF1YWwgKSAtPlxuICAgICAgICBpZiBjYW5CZUVxdWFsIHRoZW4gcmV0dXJuIG51bSA+PSBtaW4gJiYgbnVtIDw9IG1heFxuICAgICAgICBlbHNlIHJldHVybiBudW0gPj0gbWluICYmIG51bSA8PSBtYXhcblxuICAgICMgY29udmVydCBtZXRyZXMgaW4gdG8gbSAvIEtNXG4gICAgQGdldE5pY2VEaXN0YW5jZTogKG1ldHJlcykgPT5cblxuICAgICAgICBpZiBtZXRyZXMgPCAxMDAwXG5cbiAgICAgICAgICAgIHJldHVybiBcIiN7TWF0aC5yb3VuZChtZXRyZXMpfU1cIlxuXG4gICAgICAgIGVsc2VcblxuICAgICAgICAgICAga20gPSAobWV0cmVzLzEwMDApLnRvRml4ZWQoMilcbiAgICAgICAgICAgIHJldHVybiBcIiN7a219S01cIlxuXG4gICAgIyBmcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEyNjczMzhcbiAgICBAemVyb0ZpbGw6ICggbnVtYmVyLCB3aWR0aCApID0+XG5cbiAgICAgICAgd2lkdGggLT0gbnVtYmVyLnRvU3RyaW5nKCkubGVuZ3RoXG5cbiAgICAgICAgaWYgd2lkdGggPiAwXG4gICAgICAgICAgICByZXR1cm4gbmV3IEFycmF5KCB3aWR0aCArICgvXFwuLy50ZXN0KCBudW1iZXIgKSA/IDIgOiAxKSApLmpvaW4oICcwJyApICsgbnVtYmVyXG5cbiAgICAgICAgcmV0dXJuIG51bWJlciArIFwiXCIgIyBhbHdheXMgcmV0dXJuIGEgc3RyaW5nXG5cbm1vZHVsZS5leHBvcnRzID0gTnVtYmVyVXRpbHNcbiIsIiMjI1xuIyBSZXF1ZXN0ZXIgI1xuXG5XcmFwcGVyIGZvciBgJC5hamF4YCBjYWxsc1xuXG4jIyNcbmNsYXNzIFJlcXVlc3RlclxuXG4gICAgQHJlcXVlc3RzIDogW11cblxuICAgIEByZXF1ZXN0OiAoIGRhdGEgKSA9PlxuICAgICAgICAjIyNcbiAgICAgICAgYGRhdGEgPSB7YDxicj5cbiAgICAgICAgYCAgdXJsICAgICAgICAgOiBTdHJpbmdgPGJyPlxuICAgICAgICBgICB0eXBlICAgICAgICA6IFwiUE9TVC9HRVQvUFVUXCJgPGJyPlxuICAgICAgICBgICBkYXRhICAgICAgICA6IE9iamVjdGA8YnI+XG4gICAgICAgIGAgIGRhdGFUeXBlICAgIDogalF1ZXJ5IGRhdGFUeXBlYDxicj5cbiAgICAgICAgYCAgY29udGVudFR5cGUgOiBTdHJpbmdgPGJyPlxuICAgICAgICBgfWBcbiAgICAgICAgIyMjXG5cbiAgICAgICAgciA9ICQuYWpheCB7XG5cbiAgICAgICAgICAgIHVybCAgICAgICAgIDogZGF0YS51cmxcbiAgICAgICAgICAgIHR5cGUgICAgICAgIDogaWYgZGF0YS50eXBlIHRoZW4gZGF0YS50eXBlIGVsc2UgXCJQT1NUXCIsXG4gICAgICAgICAgICBkYXRhICAgICAgICA6IGlmIGRhdGEuZGF0YSB0aGVuIGRhdGEuZGF0YSBlbHNlIG51bGwsXG4gICAgICAgICAgICBkYXRhVHlwZSAgICA6IGlmIGRhdGEuZGF0YVR5cGUgdGhlbiBkYXRhLmRhdGFUeXBlIGVsc2UgXCJqc29uXCIsXG4gICAgICAgICAgICBjb250ZW50VHlwZSA6IGlmIGRhdGEuY29udGVudFR5cGUgdGhlbiBkYXRhLmNvbnRlbnRUeXBlIGVsc2UgXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLThcIixcbiAgICAgICAgICAgIHByb2Nlc3NEYXRhIDogaWYgZGF0YS5wcm9jZXNzRGF0YSAhPSBudWxsIGFuZCBkYXRhLnByb2Nlc3NEYXRhICE9IHVuZGVmaW5lZCB0aGVuIGRhdGEucHJvY2Vzc0RhdGEgZWxzZSB0cnVlXG5cbiAgICAgICAgfVxuXG4gICAgICAgIHIuZG9uZSBkYXRhLmRvbmVcbiAgICAgICAgci5mYWlsIGRhdGEuZmFpbFxuICAgICAgICBcbiAgICAgICAgclxuXG4gICAgQGFkZEltYWdlIDogKGRhdGEsIGRvbmUsIGZhaWwpID0+XG4gICAgICAgICMjI1xuICAgICAgICAqKiBVc2FnZTogPGJyPlxuICAgICAgICBgZGF0YSA9IGNhbnZhc3MudG9EYXRhVVJMKFwiaW1hZ2UvanBlZ1wiKS5zbGljZShcImRhdGE6aW1hZ2UvanBlZztiYXNlNjQsXCIubGVuZ3RoKWA8YnI+XG4gICAgICAgIGBSZXF1ZXN0ZXIuYWRkSW1hZ2UgZGF0YSwgXCJ6b2V0cm9wZVwiLCBAZG9uZSwgQGZhaWxgXG4gICAgICAgICMjI1xuXG4gICAgICAgIEByZXF1ZXN0XG4gICAgICAgICAgICB1cmwgICAgOiAnL2FwaS9pbWFnZXMvJ1xuICAgICAgICAgICAgdHlwZSAgIDogJ1BPU1QnXG4gICAgICAgICAgICBkYXRhICAgOiB7aW1hZ2VfYmFzZTY0IDogZW5jb2RlVVJJKGRhdGEpfVxuICAgICAgICAgICAgZG9uZSAgIDogZG9uZVxuICAgICAgICAgICAgZmFpbCAgIDogZmFpbFxuXG4gICAgICAgIG51bGxcblxuICAgIEBkZWxldGVJbWFnZSA6IChpZCwgZG9uZSwgZmFpbCkgPT5cbiAgICAgICAgXG4gICAgICAgIEByZXF1ZXN0XG4gICAgICAgICAgICB1cmwgICAgOiAnL2FwaS9pbWFnZXMvJytpZFxuICAgICAgICAgICAgdHlwZSAgIDogJ0RFTEVURSdcbiAgICAgICAgICAgIGRvbmUgICA6IGRvbmVcbiAgICAgICAgICAgIGZhaWwgICA6IGZhaWxcblxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gUmVxdWVzdGVyXG4iLCIjIyNcblNoYXJpbmcgY2xhc3MgZm9yIG5vbi1TREsgbG9hZGVkIHNvY2lhbCBuZXR3b3Jrcy5cbklmIFNESyBpcyBsb2FkZWQsIGFuZCBwcm92aWRlcyBzaGFyZSBtZXRob2RzLCB0aGVuIHVzZSB0aGF0IGNsYXNzIGluc3RlYWQsIGVnLiBgRmFjZWJvb2suc2hhcmVgIGluc3RlYWQgb2YgYFNoYXJlLmZhY2Vib29rYFxuIyMjXG5jbGFzcyBTaGFyZVxuXG4gICAgdXJsIDogbnVsbFxuXG4gICAgY29uc3RydWN0b3IgOiAtPlxuXG4gICAgICAgIEB1cmwgPSBAQ0RfQ0UoKS5TSVRFX1VSTFxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBvcGVuV2luIDogKHVybCwgdywgaCkgPT5cblxuICAgICAgICBsZWZ0ID0gKCBzY3JlZW4uYXZhaWxXaWR0aCAgLSB3ICkgPj4gMVxuICAgICAgICB0b3AgID0gKCBzY3JlZW4uYXZhaWxIZWlnaHQgLSBoICkgPj4gMVxuXG4gICAgICAgIHdpbmRvdy5vcGVuIHVybCwgJycsICd0b3A9Jyt0b3ArJyxsZWZ0PScrbGVmdCsnLHdpZHRoPScrdysnLGhlaWdodD0nK2grJyxsb2NhdGlvbj1ubyxtZW51YmFyPW5vJ1xuXG4gICAgICAgIG51bGxcblxuICAgIHBsdXMgOiAoIHVybCApID0+XG5cbiAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cHM6Ly9wbHVzLmdvb2dsZS5jb20vc2hhcmU/dXJsPSN7dXJsfVwiLCA2NTAsIDM4NVxuXG4gICAgICAgIG51bGxcblxuICAgIHBpbnRlcmVzdCA6ICh1cmwsIG1lZGlhLCBkZXNjcikgPT5cblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgbWVkaWEgPSBlbmNvZGVVUklDb21wb25lbnQobWVkaWEpXG4gICAgICAgIGRlc2NyID0gZW5jb2RlVVJJQ29tcG9uZW50KGRlc2NyKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3d3dy5waW50ZXJlc3QuY29tL3Bpbi9jcmVhdGUvYnV0dG9uLz91cmw9I3t1cmx9Jm1lZGlhPSN7bWVkaWF9JmRlc2NyaXB0aW9uPSN7ZGVzY3J9XCIsIDczNSwgMzEwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgdHVtYmxyIDogKHVybCwgbWVkaWEsIGRlc2NyKSA9PlxuXG4gICAgICAgIHVybCAgID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuICAgICAgICBtZWRpYSA9IGVuY29kZVVSSUNvbXBvbmVudChtZWRpYSlcbiAgICAgICAgZGVzY3IgPSBlbmNvZGVVUklDb21wb25lbnQoZGVzY3IpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vd3d3LnR1bWJsci5jb20vc2hhcmUvcGhvdG8/c291cmNlPSN7bWVkaWF9JmNhcHRpb249I3tkZXNjcn0mY2xpY2tfdGhydT0je3VybH1cIiwgNDUwLCA0MzBcblxuICAgICAgICBudWxsXG5cbiAgICBmYWNlYm9vayA6ICggdXJsICwgY29weSA9ICcnKSA9PiBcblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgZGVjc3IgPSBlbmNvZGVVUklDb21wb25lbnQoY29weSlcblxuICAgICAgICBAb3BlbldpbiBcImh0dHA6Ly93d3cuZmFjZWJvb2suY29tL3NoYXJlLnBocD91PSN7dXJsfSZ0PSN7ZGVjc3J9XCIsIDYwMCwgMzAwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgdHdpdHRlciA6ICggdXJsICwgY29weSA9ICcnKSA9PlxuXG4gICAgICAgIHVybCAgID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuICAgICAgICBpZiBjb3B5IGlzICcnXG4gICAgICAgICAgICBjb3B5ID0gQENEX0NFKCkubG9jYWxlLmdldCAnc2VvX3R3aXR0ZXJfY2FyZF9kZXNjcmlwdGlvbidcbiAgICAgICAgICAgIFxuICAgICAgICBkZXNjciA9IGVuY29kZVVSSUNvbXBvbmVudChjb3B5KVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3R3aXR0ZXIuY29tL2ludGVudC90d2VldC8/dGV4dD0je2Rlc2NyfSZ1cmw9I3t1cmx9XCIsIDYwMCwgMzAwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgcmVucmVuIDogKCB1cmwgKSA9PiBcblxuICAgICAgICB1cmwgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vc2hhcmUucmVucmVuLmNvbS9zaGFyZS9idXR0b25zaGFyZS5kbz9saW5rPVwiICsgdXJsLCA2MDAsIDMwMFxuXG4gICAgICAgIG51bGxcblxuICAgIHdlaWJvIDogKCB1cmwgKSA9PiBcblxuICAgICAgICB1cmwgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vc2VydmljZS53ZWliby5jb20vc2hhcmUvc2hhcmUucGhwP3VybD0je3VybH0mbGFuZ3VhZ2U9emhfY25cIiwgNjAwLCAzMDBcblxuICAgICAgICBudWxsXG5cbiAgICBDRF9DRSA6ID0+XG5cbiAgICAgICAgcmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNoYXJlXG4iLCJjbGFzcyBBYnN0cmFjdFZpZXcgZXh0ZW5kcyBCYWNrYm9uZS5WaWV3XG5cblx0ZWwgICAgICAgICAgIDogbnVsbFxuXHRpZCAgICAgICAgICAgOiBudWxsXG5cdGNoaWxkcmVuICAgICA6IG51bGxcblx0dGVtcGxhdGUgICAgIDogbnVsbFxuXHR0ZW1wbGF0ZVZhcnMgOiBudWxsXG5cdFxuXHRpbml0aWFsaXplIDogLT5cblx0XHRcblx0XHRAY2hpbGRyZW4gPSBbXVxuXG5cdFx0aWYgQHRlbXBsYXRlXG5cdFx0XHR0bXBIVE1MID0gXy50ZW1wbGF0ZSBAQ0RfQ0UoKS50ZW1wbGF0ZXMuZ2V0IEB0ZW1wbGF0ZVxuXHRcdFx0QHNldEVsZW1lbnQgdG1wSFRNTCBAdGVtcGxhdGVWYXJzXG5cblx0XHRAJGVsLmF0dHIgJ2lkJywgQGlkIGlmIEBpZFxuXHRcdEAkZWwuYWRkQ2xhc3MgQGNsYXNzTmFtZSBpZiBAY2xhc3NOYW1lXG5cdFx0XG5cdFx0QGluaXQoKVxuXG5cdFx0QHBhdXNlZCA9IGZhbHNlXG5cblx0XHRudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRudWxsXG5cblx0dXBkYXRlIDogPT5cblxuXHRcdG51bGxcblxuXHRyZW5kZXIgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdGFkZENoaWxkIDogKGNoaWxkLCBwcmVwZW5kID0gZmFsc2UpID0+XG5cblx0XHRAY2hpbGRyZW4ucHVzaCBjaGlsZCBpZiBjaGlsZC5lbFxuXHRcdHRhcmdldCA9IGlmIEBhZGRUb1NlbGVjdG9yIHRoZW4gQCRlbC5maW5kKEBhZGRUb1NlbGVjdG9yKS5lcSgwKSBlbHNlIEAkZWxcblx0XHRcblx0XHRjID0gaWYgY2hpbGQuZWwgdGhlbiBjaGlsZC4kZWwgZWxzZSBjaGlsZFxuXG5cdFx0aWYgIXByZXBlbmQgXG5cdFx0XHR0YXJnZXQuYXBwZW5kIGNcblx0XHRlbHNlIFxuXHRcdFx0dGFyZ2V0LnByZXBlbmQgY1xuXG5cdFx0QFxuXG5cdHJlcGxhY2UgOiAoZG9tLCBjaGlsZCkgPT5cblxuXHRcdEBjaGlsZHJlbi5wdXNoIGNoaWxkIGlmIGNoaWxkLmVsXG5cdFx0YyA9IGlmIGNoaWxkLmVsIHRoZW4gY2hpbGQuJGVsIGVsc2UgY2hpbGRcblx0XHRAJGVsLmNoaWxkcmVuKGRvbSkucmVwbGFjZVdpdGgoYylcblxuXHRcdG51bGxcblxuXHRyZW1vdmUgOiAoY2hpbGQpID0+XG5cblx0XHR1bmxlc3MgY2hpbGQ/XG5cdFx0XHRyZXR1cm5cblx0XHRcblx0XHRjID0gaWYgY2hpbGQuZWwgdGhlbiBjaGlsZC4kZWwgZWxzZSAkKGNoaWxkKVxuXHRcdGNoaWxkLmRpc3Bvc2UoKSBpZiBjIGFuZCBjaGlsZC5kaXNwb3NlXG5cblx0XHRpZiBjICYmIEBjaGlsZHJlbi5pbmRleE9mKGNoaWxkKSAhPSAtMVxuXHRcdFx0QGNoaWxkcmVuLnNwbGljZSggQGNoaWxkcmVuLmluZGV4T2YoY2hpbGQpLCAxIClcblxuXHRcdGMucmVtb3ZlKClcblxuXHRcdG51bGxcblxuXHRvblJlc2l6ZSA6IChldmVudCkgPT5cblxuXHRcdChpZiBjaGlsZC5vblJlc2l6ZSB0aGVuIGNoaWxkLm9uUmVzaXplKCkpIGZvciBjaGlsZCBpbiBAY2hpbGRyZW5cblxuXHRcdG51bGxcblxuXHRtb3VzZUVuYWJsZWQgOiAoIGVuYWJsZWQgKSA9PlxuXG5cdFx0QCRlbC5jc3Ncblx0XHRcdFwicG9pbnRlci1ldmVudHNcIjogaWYgZW5hYmxlZCB0aGVuIFwiYXV0b1wiIGVsc2UgXCJub25lXCJcblxuXHRcdG51bGxcblxuXHRDU1NUcmFuc2xhdGUgOiAoeCwgeSwgdmFsdWU9JyUnLCBzY2FsZSkgPT5cblxuXHRcdGlmIE1vZGVybml6ci5jc3N0cmFuc2Zvcm1zM2Rcblx0XHRcdHN0ciA9IFwidHJhbnNsYXRlM2QoI3t4K3ZhbHVlfSwgI3t5K3ZhbHVlfSwgMClcIlxuXHRcdGVsc2Vcblx0XHRcdHN0ciA9IFwidHJhbnNsYXRlKCN7eCt2YWx1ZX0sICN7eSt2YWx1ZX0pXCJcblxuXHRcdGlmIHNjYWxlIHRoZW4gc3RyID0gXCIje3N0cn0gc2NhbGUoI3tzY2FsZX0pXCJcblxuXHRcdHN0clxuXG5cdHVuTXV0ZUFsbCA6ID0+XG5cblx0XHRmb3IgY2hpbGQgaW4gQGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkLnVuTXV0ZT8oKVxuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRjaGlsZC51bk11dGVBbGwoKVxuXG5cdFx0bnVsbFxuXG5cdG11dGVBbGwgOiA9PlxuXG5cdFx0Zm9yIGNoaWxkIGluIEBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZC5tdXRlPygpXG5cblx0XHRcdGlmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aFxuXG5cdFx0XHRcdGNoaWxkLm11dGVBbGwoKVxuXG5cdFx0bnVsbFxuXG5cdHJlbW92ZUFsbENoaWxkcmVuOiA9PlxuXG5cdFx0QHJlbW92ZSBjaGlsZCBmb3IgY2hpbGQgaW4gQGNoaWxkcmVuXG5cblx0XHRudWxsXG5cblx0dHJpZ2dlckNoaWxkcmVuIDogKG1zZywgY2hpbGRyZW49QGNoaWxkcmVuKSA9PlxuXG5cdFx0Zm9yIGNoaWxkLCBpIGluIGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkLnRyaWdnZXIgbXNnXG5cblx0XHRcdGlmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aFxuXG5cdFx0XHRcdEB0cmlnZ2VyQ2hpbGRyZW4gbXNnLCBjaGlsZC5jaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdGNhbGxDaGlsZHJlbiA6IChtZXRob2QsIHBhcmFtcywgY2hpbGRyZW49QGNoaWxkcmVuKSA9PlxuXG5cdFx0Zm9yIGNoaWxkLCBpIGluIGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkW21ldGhvZF0/IHBhcmFtc1xuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRAY2FsbENoaWxkcmVuIG1ldGhvZCwgcGFyYW1zLCBjaGlsZC5jaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdGNhbGxDaGlsZHJlbkFuZFNlbGYgOiAobWV0aG9kLCBwYXJhbXMsIGNoaWxkcmVuPUBjaGlsZHJlbikgPT5cblxuXHRcdEBbbWV0aG9kXT8gcGFyYW1zXG5cblx0XHRmb3IgY2hpbGQsIGkgaW4gY2hpbGRyZW5cblxuXHRcdFx0Y2hpbGRbbWV0aG9kXT8gcGFyYW1zXG5cblx0XHRcdGlmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aFxuXG5cdFx0XHRcdEBjYWxsQ2hpbGRyZW4gbWV0aG9kLCBwYXJhbXMsIGNoaWxkLmNoaWxkcmVuXG5cblx0XHRudWxsXG5cblx0c3VwcGxhbnRTdHJpbmcgOiAoc3RyLCB2YWxzKSAtPlxuXG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlIC97eyAoW157fV0qKSB9fS9nLCAoYSwgYikgLT5cblx0XHRcdHIgPSB2YWxzW2JdXG5cdFx0XHQoaWYgdHlwZW9mIHIgaXMgXCJzdHJpbmdcIiBvciB0eXBlb2YgciBpcyBcIm51bWJlclwiIHRoZW4gciBlbHNlIGEpXG5cblx0ZGlzcG9zZSA6ID0+XG5cblx0XHQjIyNcblx0XHRvdmVycmlkZSBvbiBwZXIgdmlldyBiYXNpcyAtIHVuYmluZCBldmVudCBoYW5kbGVycyBldGNcblx0XHQjIyNcblxuXHRcdG51bGxcblxuXHRDRF9DRSA6ID0+XG5cblx0XHRyZXR1cm4gd2luZG93LkNEX0NFXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RWaWV3XG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuL0Fic3RyYWN0VmlldydcblxuY2xhc3MgQWJzdHJhY3RWaWV3UGFnZSBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdF9zaG93biAgICAgOiBmYWxzZVxuXHRfbGlzdGVuaW5nIDogZmFsc2VcblxuXHRzaG93IDogKGNiKSA9PlxuXG5cdFx0cmV0dXJuIHVubGVzcyAhQF9zaG93blxuXHRcdEBfc2hvd24gPSB0cnVlXG5cblx0XHQjIyNcblx0XHRDSEFOR0UgSEVSRSAtICdwYWdlJyB2aWV3cyBhcmUgYWx3YXlzIGluIERPTSAtIHRvIHNhdmUgaGF2aW5nIHRvIHJlLWluaXRpYWxpc2UgZ21hcCBldmVudHMgKFBJVEEpLiBObyBsb25nZXIgcmVxdWlyZSA6ZGlzcG9zZSBtZXRob2Rcblx0XHQjIyNcblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LndyYXBwZXIuYWRkQ2hpbGQgQFxuXHRcdEBjYWxsQ2hpbGRyZW5BbmRTZWxmICdzZXRMaXN0ZW5lcnMnLCAnb24nXG5cblx0XHQjIyMgcmVwbGFjZSB3aXRoIHNvbWUgcHJvcGVyIHRyYW5zaXRpb24gaWYgd2UgY2FuICMjI1xuXHRcdEAkZWwuY3NzICd2aXNpYmlsaXR5JyA6ICd2aXNpYmxlJ1xuXHRcdGNiPygpXG5cblx0XHRudWxsXG5cblx0aGlkZSA6IChjYikgPT5cblxuXHRcdHJldHVybiB1bmxlc3MgQF9zaG93blxuXHRcdEBfc2hvd24gPSBmYWxzZVxuXG5cdFx0IyMjXG5cdFx0Q0hBTkdFIEhFUkUgLSAncGFnZScgdmlld3MgYXJlIGFsd2F5cyBpbiBET00gLSB0byBzYXZlIGhhdmluZyB0byByZS1pbml0aWFsaXNlIGdtYXAgZXZlbnRzIChQSVRBKS4gTm8gbG9uZ2VyIHJlcXVpcmUgOmRpc3Bvc2UgbWV0aG9kXG5cdFx0IyMjXG5cdFx0QENEX0NFKCkuYXBwVmlldy53cmFwcGVyLnJlbW92ZSBAXG5cblx0XHQjIEBjYWxsQ2hpbGRyZW5BbmRTZWxmICdzZXRMaXN0ZW5lcnMnLCAnb2ZmJ1xuXG5cdFx0IyMjIHJlcGxhY2Ugd2l0aCBzb21lIHByb3BlciB0cmFuc2l0aW9uIGlmIHdlIGNhbiAjIyNcblx0XHRAJGVsLmNzcyAndmlzaWJpbGl0eScgOiAnaGlkZGVuJ1xuXHRcdGNiPygpXG5cblx0XHRudWxsXG5cblx0ZGlzcG9zZSA6ID0+XG5cblx0XHRAY2FsbENoaWxkcmVuQW5kU2VsZiAnc2V0TGlzdGVuZXJzJywgJ29mZidcblxuXHRcdG51bGxcblxuXHRzZXRMaXN0ZW5lcnMgOiAoc2V0dGluZykgPT5cblxuXHRcdHJldHVybiB1bmxlc3Mgc2V0dGluZyBpc250IEBfbGlzdGVuaW5nXG5cdFx0QF9saXN0ZW5pbmcgPSBzZXR0aW5nXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RWaWV3UGFnZVxuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuXG5jbGFzcyBGb290ZXIgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuICAgIHRlbXBsYXRlIDogJ3NpdGUtZm9vdGVyJ1xuXG4gICAgY29uc3RydWN0b3I6IC0+XG5cbiAgICAgICAgQHRlbXBsYXRlVmFycyA9IFxuICAgICAgICBcdGRlc2MgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZm9vdGVyX2Rlc2NcIlxuXG4gICAgICAgIHN1cGVyKClcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEZvb3RlclxuIiwiQWJzdHJhY3RWaWV3ICAgICAgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5Sb3V0ZXIgICAgICAgICAgICAgICA9IHJlcXVpcmUgJy4uLy4uL3JvdXRlci9Sb3V0ZXInXG5Db2RlV29yZFRyYW5zaXRpb25lciA9IHJlcXVpcmUgJy4uLy4uL3V0aWxzL0NvZGVXb3JkVHJhbnNpdGlvbmVyJ1xuXG5jbGFzcyBIZWFkZXIgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuXHR0ZW1wbGF0ZSA6ICdzaXRlLWhlYWRlcidcblxuXHRGSVJTVF9IQVNIQ0hBTkdFIDogdHJ1ZVxuXHRET09ETEVfSU5GT19PUEVOIDogZmFsc2VcblxuXHRFVkVOVF9ET09ETEVfSU5GT19PUEVOICAgOiAnRVZFTlRfRE9PRExFX0lORk9fT1BFTidcblx0RVZFTlRfRE9PRExFX0lORk9fQ0xPU0UgIDogJ0VWRU5UX0RPT0RMRV9JTkZPX0NMT1NFJ1xuXHRFVkVOVF9IT01FX1NDUk9MTF9UT19UT1AgOiAnRVZFTlRfSE9NRV9TQ1JPTExfVE9fVE9QJ1xuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEB0ZW1wbGF0ZVZhcnMgPVxuXHRcdFx0aG9tZV9sYWJlbCAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdoZWFkZXJfbG9nb19sYWJlbCcpXG5cdFx0XHRjbG9zZV9sYWJlbCA6IEBDRF9DRSgpLmxvY2FsZS5nZXQoJ2hlYWRlcl9jbG9zZV9sYWJlbCcpXG5cdFx0XHRpbmZvX2xhYmVsICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQoJ2hlYWRlcl9pbmZvX2xhYmVsJylcblxuXHRcdHN1cGVyKClcblxuXHRcdEBiaW5kRXZlbnRzKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRAJGxvZ28gICAgID0gQCRlbC5maW5kKCcubG9nb19fbGluaycpXG5cdFx0QCRpbmZvQnRuICA9IEAkZWwuZmluZCgnLmluZm8tYnRuJylcblx0XHRAJGNsb3NlQnRuID0gQCRlbC5maW5kKCcuY2xvc2UtYnRuJylcblxuXHRcdG51bGxcblxuXHRiaW5kRXZlbnRzIDogPT5cblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcub24gQENEX0NFKCkuYXBwVmlldy5FVkVOVF9QUkVMT0FERVJfSElERSwgQGFuaW1hdGVUZXh0SW5cblx0XHRAQ0RfQ0UoKS5yb3V0ZXIub24gUm91dGVyLkVWRU5UX0hBU0hfQ0hBTkdFRCwgQG9uSGFzaENoYW5nZVxuXG5cdFx0QCRlbC5vbiAnbW91c2VlbnRlcicsICdbZGF0YS1jb2Rld29yZF0nLCBAb25Xb3JkRW50ZXJcblx0XHRAJGVsLm9uICdtb3VzZWxlYXZlJywgJ1tkYXRhLWNvZGV3b3JkXScsIEBvbldvcmRMZWF2ZVxuXG5cdFx0QCRpbmZvQnRuLm9uICdjbGljaycsIEBvbkluZm9CdG5DbGlja1xuXHRcdEAkY2xvc2VCdG4ub24gJ2NsaWNrJywgQG9uQ2xvc2VCdG5DbGlja1xuXG5cdFx0QENEX0NFKCkuYXBwVmlldy4kd2luZG93Lm9uICdrZXl1cCcsIEBvbktleXVwXG5cblx0XHRudWxsXG5cblx0b25IYXNoQ2hhbmdlIDogKHdoZXJlKSA9PlxuXG5cdFx0aWYgQEZJUlNUX0hBU0hDSEFOR0Vcblx0XHRcdEBGSVJTVF9IQVNIQ0hBTkdFID0gZmFsc2Vcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLnByZXBhcmUgW0AkbG9nbywgQCRpbmZvQnRuXSwgQF9nZXREb29kbGVDb2xvdXJTY2hlbWUoKVxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIub3V0IFtAJGNsb3NlQnRuXSwgQF9nZXREb29kbGVDb2xvdXJTY2hlbWUoKVxuXHRcdFx0cmV0dXJuXG5cdFx0XG5cdFx0QG9uQXJlYUNoYW5nZSB3aGVyZVxuXG5cdFx0bnVsbFxuXG5cdG9uQXJlYUNoYW5nZSA6IChzZWN0aW9uKSA9PlxuXG5cdFx0QGFjdGl2ZVNlY3Rpb24gPSBzZWN0aW9uXG5cdFx0XG5cdFx0Y29sb3VyID0gQGdldFNlY3Rpb25Db2xvdXIgc2VjdGlvblxuXG5cdFx0QCRlbC5hdHRyICdkYXRhLXNlY3Rpb24nLCBzZWN0aW9uXG5cblx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5pbiBAJGxvZ28sIGNvbG91clxuXG5cdFx0aWYgc2VjdGlvbiBpcyBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRVxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIuaW4gW0AkaW5mb0J0bl0sIGNvbG91clxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIub3V0IFtAJGNsb3NlQnRuXSwgY29sb3VyXG5cdFx0ZWxzZSBpZiBzZWN0aW9uIGlzICdkb29kbGUtaW5mbydcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLmluIFtAJGNsb3NlQnRuXSwgY29sb3VyXG5cdFx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5pbiBbQCRpbmZvQnRuXSwgJ29mZndoaXRlLXJlZC1iZydcblxuXHRcdG51bGxcblxuXHRnZXRTZWN0aW9uQ29sb3VyIDogKHNlY3Rpb24sIHdvcmRTZWN0aW9uPW51bGwpID0+XG5cblx0XHRzZWN0aW9uID0gc2VjdGlvbiBvciBAQ0RfQ0UoKS5uYXYuY3VycmVudC5hcmVhIG9yICdob21lJ1xuXG5cdFx0aWYgd29yZFNlY3Rpb24gYW5kIHNlY3Rpb24gaXMgd29yZFNlY3Rpb25cblx0XHRcdGlmIHdvcmRTZWN0aW9uIGlzICdkb29kbGUtaW5mbydcblx0XHRcdFx0cmV0dXJuICdvZmZ3aGl0ZS1yZWQtYmcnXG5cdFx0XHRlbHNlXG5cdFx0XHRcdHJldHVybiAnYmxhY2std2hpdGUtYmcnXG5cblx0XHRjb2xvdXIgPSBzd2l0Y2ggc2VjdGlvblxuXHRcdFx0d2hlbiAnaG9tZScsICdkb29kbGUtaW5mbycgdGhlbiAncmVkJ1xuXHRcdFx0d2hlbiBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRSB0aGVuIEBfZ2V0RG9vZGxlQ29sb3VyU2NoZW1lKClcblx0XHRcdGVsc2UgJ3doaXRlJ1xuXG5cdFx0Y29sb3VyXG5cblx0X2dldERvb2RsZUNvbG91clNjaGVtZSA6ID0+XG5cblx0XHRjb2xvdXIgPSBpZiBAQ0RfQ0UoKS5hcHBEYXRhLmFjdGl2ZURvb2RsZS5nZXQoJ2NvbG91cl9zY2hlbWUnKSBpcyAnbGlnaHQnIHRoZW4gJ2JsYWNrJyBlbHNlICd3aGl0ZSdcblxuXHRcdGNvbG91clxuXG5cdGFuaW1hdGVUZXh0SW4gOiA9PlxuXG5cdFx0QG9uQXJlYUNoYW5nZSBAQ0RfQ0UoKS5uYXYuY3VycmVudC5hcmVhXG5cblx0XHRudWxsXG5cblx0b25Xb3JkRW50ZXIgOiAoZSkgPT5cblxuXHRcdCRlbCA9ICQoZS5jdXJyZW50VGFyZ2V0KVxuXHRcdHdvcmRTZWN0aW9uID0gJGVsLmF0dHIoJ2RhdGEtd29yZC1zZWN0aW9uJylcblxuXHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLnNjcmFtYmxlICRlbCwgQGdldFNlY3Rpb25Db2xvdXIoQGFjdGl2ZVNlY3Rpb24sIHdvcmRTZWN0aW9uKVxuXG5cdFx0bnVsbFxuXG5cdG9uV29yZExlYXZlIDogKGUpID0+XG5cblx0XHQkZWwgPSAkKGUuY3VycmVudFRhcmdldClcblx0XHR3b3JkU2VjdGlvbiA9ICRlbC5hdHRyKCdkYXRhLXdvcmQtc2VjdGlvbicpXG5cblx0XHRDb2RlV29yZFRyYW5zaXRpb25lci51bnNjcmFtYmxlICRlbCwgQGdldFNlY3Rpb25Db2xvdXIoQGFjdGl2ZVNlY3Rpb24sIHdvcmRTZWN0aW9uKVxuXG5cdFx0bnVsbFxuXG5cdG9uSW5mb0J0bkNsaWNrIDogKGUpID0+XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KClcblxuXHRcdHJldHVybiB1bmxlc3MgQENEX0NFKCkubmF2LmN1cnJlbnQuYXJlYSBpcyBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRVxuXG5cdFx0aWYgIUBET09ETEVfSU5GT19PUEVOIHRoZW4gQHNob3dEb29kbGVJbmZvKClcblxuXHRcdG51bGxcblxuXHRvbkNsb3NlQnRuQ2xpY2sgOiAoZSkgPT5cblxuXHRcdGlmIEBET09ETEVfSU5GT19PUEVOXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KClcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKClcblx0XHRcdEBoaWRlRG9vZGxlSW5mbygpXG5cblx0XHRudWxsXG5cblx0b25LZXl1cCA6IChlKSA9PlxuXG5cdFx0aWYgZS5rZXlDb2RlIGlzIDI3IHRoZW4gQGhpZGVEb29kbGVJbmZvKClcblxuXHRcdG51bGxcblxuXHRzaG93RG9vZGxlSW5mbyA6ID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzICFARE9PRExFX0lORk9fT1BFTlxuXG5cdFx0QG9uQXJlYUNoYW5nZSAnZG9vZGxlLWluZm8nXG5cdFx0QHRyaWdnZXIgQEVWRU5UX0RPT0RMRV9JTkZPX09QRU5cblx0XHRARE9PRExFX0lORk9fT1BFTiA9IHRydWVcblxuXHRcdG51bGxcblxuXHRoaWRlRG9vZGxlSW5mbyA6ID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIEBET09ETEVfSU5GT19PUEVOXG5cblx0XHRAb25BcmVhQ2hhbmdlIEBDRF9DRSgpLm5hdi5jdXJyZW50LmFyZWFcblx0XHRAdHJpZ2dlciBARVZFTlRfRE9PRExFX0lORk9fQ0xPU0Vcblx0XHRARE9PRExFX0lORk9fT1BFTiA9IGZhbHNlXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gSGVhZGVyXG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5cbmNsYXNzIFByZWxvYWRlciBleHRlbmRzIEFic3RyYWN0Vmlld1xuXHRcblx0Y2IgICAgICAgICAgICAgIDogbnVsbFxuXHRcblx0VFJBTlNJVElPTl9USU1FIDogMC41XG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0QHNldEVsZW1lbnQgJCgnI3ByZWxvYWRlcicpXG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdHNob3cgOiAoQGNiKSA9PlxuXG5cdFx0QCRlbC5jc3MgJ2Rpc3BsYXknIDogJ2Jsb2NrJ1xuXG5cdFx0bnVsbFxuXG5cdG9uU2hvd0NvbXBsZXRlIDogPT5cblxuXHRcdEBjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdGhpZGUgOiAoQGNiKSA9PlxuXG5cdFx0QG9uSGlkZUNvbXBsZXRlKClcblxuXHRcdG51bGxcblxuXHRvbkhpZGVDb21wbGV0ZSA6ID0+XG5cblx0XHRAJGVsLmNzcyAnZGlzcGxheScgOiAnbm9uZSdcblx0XHRAY2I/KClcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBQcmVsb2FkZXJcbiIsIkFic3RyYWN0VmlldyAgICA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0VmlldydcbkRvb2RsZVBhZ2VWaWV3ICAgICA9IHJlcXVpcmUgJy4uL2Rvb2RsZVBhZ2UvRG9vZGxlUGFnZVZpZXcnXG5OYXYgICAgICAgICAgICAgPSByZXF1aXJlICcuLi8uLi9yb3V0ZXIvTmF2J1xuXG5jbGFzcyBXcmFwcGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cblx0VklFV19UWVBFX1BBR0UgIDogJ3BhZ2UnXG5cdFZJRVdfVFlQRV9NT0RBTCA6ICdtb2RhbCdcblxuXHR0ZW1wbGF0ZSA6ICd3cmFwcGVyJ1xuXG5cdHZpZXdzICAgICAgICAgIDogbnVsbFxuXHRwcmV2aW91c1ZpZXcgICA6IG51bGxcblx0Y3VycmVudFZpZXcgICAgOiBudWxsXG5cdGJhY2tncm91bmRWaWV3IDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEB2aWV3cyA9XG5cdFx0XHRkb29kbGUgOiBjbGFzc1JlZiA6IERvb2RsZVBhZ2VWaWV3LCByb3V0ZSA6IEBDRF9DRSgpLm5hdi5zZWN0aW9ucy5IT01FLCB2aWV3IDogbnVsbCwgdHlwZSA6IEBWSUVXX1RZUEVfUEFHRVxuXG5cdFx0QGNyZWF0ZUNsYXNzZXMoKVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0IyBkZWNpZGUgaWYgeW91IHdhbnQgdG8gYWRkIGFsbCBjb3JlIERPTSB1cCBmcm9udCwgb3IgYWRkIG9ubHkgd2hlbiByZXF1aXJlZCwgc2VlIGNvbW1lbnRzIGluIEFic3RyYWN0Vmlld1BhZ2UuY29mZmVlXG5cdFx0IyBAYWRkQ2xhc3NlcygpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGNyZWF0ZUNsYXNzZXMgOiA9PlxuXG5cdFx0KEB2aWV3c1tuYW1lXS52aWV3ID0gbmV3IEB2aWV3c1tuYW1lXS5jbGFzc1JlZikgZm9yIG5hbWUsIGRhdGEgb2YgQHZpZXdzXG5cblx0XHRudWxsXG5cblx0YWRkQ2xhc3NlcyA6ID0+XG5cblx0XHQgZm9yIG5hbWUsIGRhdGEgb2YgQHZpZXdzXG5cdFx0IFx0aWYgZGF0YS50eXBlIGlzIEBWSUVXX1RZUEVfUEFHRSB0aGVuIEBhZGRDaGlsZCBkYXRhLnZpZXdcblxuXHRcdG51bGxcblxuXHRnZXRWaWV3QnlSb3V0ZSA6IChyb3V0ZSkgPT5cblxuXHRcdGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXHRcdFx0cmV0dXJuIEB2aWV3c1tuYW1lXSBpZiByb3V0ZSBpcyBAdmlld3NbbmFtZV0ucm91dGVcblxuXHRcdG51bGxcblxuXHRnZXRWaWV3QnlSb3V0ZSA6IChyb3V0ZSkgPT5cblxuXHRcdGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXHRcdFx0cmV0dXJuIEB2aWV3c1tuYW1lXSBpZiByb3V0ZSBpcyBAdmlld3NbbmFtZV0ucm91dGVcblxuXHRcdGlmIHJvdXRlIHRoZW4gcmV0dXJuIEB2aWV3cy5mb3VyT2hGb3VyXG5cblx0XHRudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9uICdzdGFydCcsIEBzdGFydFxuXG5cdFx0bnVsbFxuXG5cdHN0YXJ0IDogPT5cblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcub2ZmICdzdGFydCcsIEBzdGFydFxuXG5cdFx0QGJpbmRFdmVudHMoKVxuXHRcdEB1cGRhdGVEaW1zKClcblxuXHRcdG51bGxcblxuXHRiaW5kRXZlbnRzIDogPT5cblxuXHRcdEBDRF9DRSgpLm5hdi5vbiBOYXYuRVZFTlRfQ0hBTkdFX1ZJRVcsIEBjaGFuZ2VWaWV3XG5cdFx0QENEX0NFKCkubmF2Lm9uIE5hdi5FVkVOVF9DSEFOR0VfU1VCX1ZJRVcsIEBjaGFuZ2VTdWJWaWV3XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9uIEBDRF9DRSgpLmFwcFZpZXcuRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMsIEB1cGRhdGVEaW1zXG5cblx0XHRudWxsXG5cblx0dXBkYXRlRGltcyA6ID0+XG5cblx0XHRAJGVsLmNzcyAnbWluLWhlaWdodCcsIEBDRF9DRSgpLmFwcFZpZXcuZGltcy5oXG5cblx0XHRudWxsXG5cblx0Y2hhbmdlVmlldyA6IChwcmV2aW91cywgY3VycmVudCkgPT5cblxuXHRcdGlmIEBwYWdlU3dpdGNoRGZkIGFuZCBAcGFnZVN3aXRjaERmZC5zdGF0ZSgpIGlzbnQgJ3Jlc29sdmVkJ1xuXHRcdFx0ZG8gKHByZXZpb3VzLCBjdXJyZW50KSA9PiBAcGFnZVN3aXRjaERmZC5kb25lID0+IEBjaGFuZ2VWaWV3IHByZXZpb3VzLCBjdXJyZW50XG5cdFx0XHRyZXR1cm5cblxuXHRcdEBwcmV2aW91c1ZpZXcgPSBAZ2V0Vmlld0J5Um91dGUgcHJldmlvdXMuYXJlYVxuXHRcdEBjdXJyZW50VmlldyAgPSBAZ2V0Vmlld0J5Um91dGUgY3VycmVudC5hcmVhXG5cblx0XHRpZiAhQHByZXZpb3VzVmlld1xuXHRcdFx0QHRyYW5zaXRpb25WaWV3cyBmYWxzZSwgQGN1cnJlbnRWaWV3XG5cdFx0ZWxzZVxuXHRcdFx0QHRyYW5zaXRpb25WaWV3cyBAcHJldmlvdXNWaWV3LCBAY3VycmVudFZpZXdcblxuXHRcdG51bGxcblxuXHRjaGFuZ2VTdWJWaWV3IDogKGN1cnJlbnQpID0+XG5cblx0XHRAY3VycmVudFZpZXcudmlldy50cmlnZ2VyIE5hdi5FVkVOVF9DSEFOR0VfU1VCX1ZJRVcsIGN1cnJlbnQuc3ViXG5cblx0XHRudWxsXG5cblx0dHJhbnNpdGlvblZpZXdzIDogKGZyb20sIHRvKSA9PlxuXG5cdFx0QHBhZ2VTd2l0Y2hEZmQgPSAkLkRlZmVycmVkKClcblxuXHRcdGlmIGZyb20gYW5kIHRvXG5cdFx0XHRAQ0RfQ0UoKS5hcHBWaWV3LnRyYW5zaXRpb25lci5wcmVwYXJlIGZyb20ucm91dGUsIHRvLnJvdXRlXG5cdFx0XHRAQ0RfQ0UoKS5hcHBWaWV3LnRyYW5zaXRpb25lci5pbiA9PiBmcm9tLnZpZXcuaGlkZSA9PiB0by52aWV3LnNob3cgPT4gQENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIub3V0ID0+IEBwYWdlU3dpdGNoRGZkLnJlc29sdmUoKVxuXHRcdGVsc2UgaWYgZnJvbVxuXHRcdFx0ZnJvbS52aWV3LmhpZGUgQHBhZ2VTd2l0Y2hEZmQucmVzb2x2ZVxuXHRcdGVsc2UgaWYgdG9cblx0XHRcdHRvLnZpZXcuc2hvdyBAcGFnZVN3aXRjaERmZC5yZXNvbHZlXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gV3JhcHBlclxuIiwiQWJzdHJhY3RWaWV3UGFnZSA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0Vmlld1BhZ2UnXG5cbmNsYXNzIERvb2RsZVBhZ2VWaWV3IGV4dGVuZHMgQWJzdHJhY3RWaWV3UGFnZVxuXG5cdHRlbXBsYXRlIDogJ3BhZ2UtZG9vZGxlJ1xuXHRtb2RlbCAgICA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRjb25zb2xlLmxvZyBcImkgYW0gaGFtbVwiXG5cblx0XHRAdGVtcGxhdGVWYXJzID0ge31cblxuXHRcdHN1cGVyKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRAJGZyYW1lICAgICAgID0gQCRlbC5maW5kKCdbZGF0YS1kb29kbGUtZnJhbWVdJylcblx0XHRAJGluZm9Db250ZW50ID0gQCRlbC5maW5kKCdbZGF0YS1kb29kbGUtaW5mb10nKVxuXG5cdFx0QCRtb3VzZSAgICA9IEAkZWwuZmluZCgnW2RhdGEtaW5kaWNhdG9yPVwibW91c2VcIl0nKVxuXHRcdEAka2V5Ym9hcmQgPSBAJGVsLmZpbmQoJ1tkYXRhLWluZGljYXRvcj1cImtleWJvYXJkXCJdJylcblx0XHRAJHRvdWNoICAgID0gQCRlbC5maW5kKCdbZGF0YS1pbmRpY2F0b3I9XCJ0b3VjaFwiXScpXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlcltzZXR0aW5nXSBAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlci5FVkVOVF9ET09ETEVfSU5GT19PUEVOLCBAb25JbmZvT3BlblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuaGVhZGVyW3NldHRpbmddIEBDRF9DRSgpLmFwcFZpZXcuaGVhZGVyLkVWRU5UX0RPT0RMRV9JTkZPX0NMT1NFLCBAb25JbmZvQ2xvc2Vcblx0XHRAJGVsW3NldHRpbmddICdjbGljaycsICdbZGF0YS1zaGFyZS1idG5dJywgQG9uU2hhcmVCdG5DbGlja1xuXG5cdFx0bnVsbFxuXG5cdHNob3cgOiAoY2IpID0+XG5cblx0XHRAbW9kZWwgPSBAQ0RfQ0UoKS5hcHBEYXRhLmFjdGl2ZURvb2RsZVxuXG5cdFx0QHNldHVwVUkoKVxuXG5cdFx0c3VwZXJcblxuXHRcdEBzaG93RnJhbWUgZmFsc2VcblxuXHRcdG51bGxcblxuXHRoaWRlIDogKGNiKSA9PlxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5oZWFkZXIuaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0c3VwZXJcblxuXHRcdG51bGxcblxuXHRzZXR1cFVJIDogPT5cblxuXHRcdEAkaW5mb0NvbnRlbnQuaHRtbCBAZ2V0RG9vZGxlSW5mb0NvbnRlbnQoKVxuXG5cdFx0QCRlbC5hdHRyICdkYXRhLWNvbG9yLXNjaGVtZScsIEBtb2RlbC5nZXQoJ2NvbG91cl9zY2hlbWUnKVxuXHRcdEAkZnJhbWUuYXR0cignc3JjJywgJycpLnJlbW92ZUNsYXNzKCdzaG93Jylcblx0XHRAJG1vdXNlLmF0dHIgJ2Rpc2FibGVkJywgIUBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLm1vdXNlJylcblx0XHRAJGtleWJvYXJkLmF0dHIgJ2Rpc2FibGVkJywgIUBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLmtleWJvYXJkJylcblx0XHRAJHRvdWNoLmF0dHIgJ2Rpc2FibGVkJywgIUBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLnRvdWNoJylcblxuXHRcdG51bGxcblxuXHRzaG93RnJhbWUgOiAocmVtb3ZlRXZlbnQ9dHJ1ZSkgPT5cblxuXHRcdGlmIHJlbW92ZUV2ZW50IHRoZW4gQENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIub2ZmIEBDRF9DRSgpLmFwcFZpZXcudHJhbnNpdGlvbmVyLkVWRU5UX1RSQU5TSVRJT05FUl9PVVRfRE9ORSwgQHNob3dGcmFtZVxuXG5cdFx0IyBURU1QLCBPQlZaXG5cdFx0U0FNUExFX0RJUiA9IEBtb2RlbC5nZXQoJ1NBTVBMRV9ESVInKVxuXG5cdFx0QCRmcmFtZS5hdHRyICdzcmMnLCBcImh0dHA6Ly9zb3VyY2UuY29kZWRvb2RsLmVzL3NhbXBsZV9kb29kbGVzLyN7U0FNUExFX0RJUn0vaW5kZXguaHRtbFwiXG5cdFx0QCRmcmFtZS5vbmUgJ2xvYWQnLCA9PiBAJGZyYW1lLmFkZENsYXNzKCdzaG93JylcblxuXHRcdG51bGxcblxuXHRnZXREb29kbGVJbmZvQ29udGVudCA6ID0+XG5cblx0XHQjIG5vIG5lZWQgdG8gZG8gdGhpcyBmb3IgZXZlcnkgZG9vZGxlIC0gb25seSBkbyBpdCBpZiB3ZSB2aWV3IHRoZSBpbmZvIHBhbmUgZm9yIGEgcGFydGljdWxhciBkb29kbGVcblx0XHRAbW9kZWwuc2V0U2hvcnRsaW5rKClcblxuXHRcdGRvb2RsZUluZm9WYXJzID1cblx0XHRcdGluZGV4SFRNTCAgICAgICAgICAgICAgICAgIDogQG1vZGVsLmdldCgnaW5kZXhIVE1MJylcblx0XHRcdGxhYmVsX2F1dGhvciAgICAgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9hdXRob3JcIlxuXHRcdFx0Y29udGVudF9hdXRob3IgICAgICAgICAgICAgOiBAbW9kZWwuZ2V0QXV0aG9ySHRtbCgpXG5cdFx0XHRsYWJlbF9kb29kbGVfbmFtZSAgICAgICAgICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfZG9vZGxlX25hbWVcIlxuXHRcdFx0Y29udGVudF9kb29kbGVfbmFtZSAgICAgICAgOiBAbW9kZWwuZ2V0KCduYW1lJylcblx0XHRcdGxhYmVsX2Rlc2NyaXB0aW9uICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9kZXNjcmlwdGlvblwiXG5cdFx0XHRjb250ZW50X2Rlc2NyaXB0aW9uICAgICAgICA6IEBtb2RlbC5nZXQoJ2Rlc2NyaXB0aW9uJylcblx0XHRcdGxhYmVsX3RhZ3MgICAgICAgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF90YWdzXCJcblx0XHRcdGNvbnRlbnRfdGFncyAgICAgICAgICAgICAgIDogQG1vZGVsLmdldCgndGFncycpLmpvaW4oJywgJylcblx0XHRcdGxhYmVsX2ludGVyYWN0aW9uICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvblwiXG5cdFx0XHRjb250ZW50X2ludGVyYWN0aW9uICAgICAgICA6IEBfZ2V0SW50ZXJhY3Rpb25Db250ZW50KClcblx0XHRcdGxhYmVsX3NoYXJlICAgICAgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9zaGFyZVwiXG5cdFx0XHRzaGFyZV91cmwgICAgICAgICAgICAgICAgICA6IEBDRF9DRSgpLlNJVEVfVVJMICsgJy8nICsgQG1vZGVsLmdldCgnc2hvcnRsaW5rJylcblx0XHRcdHNoYXJlX3VybF90ZXh0ICAgICAgICAgICAgIDogQENEX0NFKCkuU0lURV9VUkwucmVwbGFjZSgnaHR0cDovLycsICcnKSArICcvJyArIEBtb2RlbC5nZXQoJ3Nob3J0bGluaycpXG5cblx0XHRkb29kbGVJbmZvQ29udGVudCA9IF8udGVtcGxhdGUoQENEX0NFKCkudGVtcGxhdGVzLmdldCgnZG9vZGxlLWluZm8nKSkoZG9vZGxlSW5mb1ZhcnMpXG5cblx0XHRkb29kbGVJbmZvQ29udGVudFxuXG5cdF9nZXRJbnRlcmFjdGlvbkNvbnRlbnQgOiA9PlxuXG5cdFx0aW50ZXJhY3Rpb25zID0gW11cblxuXHRcdGlmIEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLm1vdXNlJykgdGhlbiBpbnRlcmFjdGlvbnMucHVzaCBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uX21vdXNlXCJcblx0XHRpZiBAbW9kZWwuZ2V0KCdpbnRlcmFjdGlvbi5rZXlib2FyZCcpIHRoZW4gaW50ZXJhY3Rpb25zLnB1c2ggQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvbl9rZXlib2FyZFwiXG5cdFx0aWYgQG1vZGVsLmdldCgnaW50ZXJhY3Rpb24udG91Y2gnKSB0aGVuIGludGVyYWN0aW9ucy5wdXNoIEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfaW50ZXJhY3Rpb25fdG91Y2hcIlxuXG5cdFx0aW50ZXJhY3Rpb25zLmpvaW4oJywgJykgb3IgQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvbl9ub25lXCJcblxuXHRvbkluZm9PcGVuIDogPT5cblxuXHRcdEAkZWwuYWRkQ2xhc3MoJ3Nob3ctaW5mbycpXG5cblx0XHRudWxsXG5cblx0b25JbmZvQ2xvc2UgOiA9PlxuXG5cdFx0QCRlbC5yZW1vdmVDbGFzcygnc2hvdy1pbmZvJylcblxuXHRcdG51bGxcblxuXHRvblNoYXJlQnRuQ2xpY2sgOiAoZSkgPT5cblxuXHRcdGUucHJldmVudERlZmF1bHQoKVxuXG5cdFx0c2hhcmVNZXRob2QgPSAkKGUuY3VycmVudFRhcmdldCkuYXR0cignZGF0YS1zaGFyZS1idG4nKVxuXHRcdHVybCAgICAgICAgID0gaWYgc2hhcmVNZXRob2QgaXMgJ2ZhY2Vib29rJyB0aGVuIEBDRF9DRSgpLlNJVEVfVVJMICsgJy8nICsgQG1vZGVsLmdldCgnc2hvcnRsaW5rJykgZWxzZSAnICdcblx0XHRkZXNjICAgICAgICA9IEBnZXRTaGFyZURlc2MoKVxuXG5cdFx0QENEX0NFKCkuc2hhcmVbc2hhcmVNZXRob2RdIHVybCwgZGVzY1xuXG5cdFx0bnVsbFxuXG5cdGdldFNoYXJlRGVzYyA6ID0+XG5cblx0XHR2YXJzID1cblx0XHRcdGRvb2RsZV9uYW1lICAgOiBAbW9kZWwuZ2V0ICduYW1lJ1xuXHRcdFx0ZG9vZGxlX2F1dGhvciA6IGlmIEBtb2RlbC5nZXQoJ2F1dGhvci50d2l0dGVyJykgdGhlbiBcIkAje0Btb2RlbC5nZXQoJ2F1dGhvci50d2l0dGVyJyl9XCIgZWxzZSBAbW9kZWwuZ2V0KCdhdXRob3IubmFtZScpXG5cdFx0XHRzaGFyZV91cmwgICAgIDogQENEX0NFKCkuU0lURV9VUkwgKyAnLycgKyBAbW9kZWwuZ2V0KCdzaG9ydGxpbmsnKVxuXHRcdFx0ZG9vZGxlX3RhZ3MgICA6IF8ubWFwKEBtb2RlbC5nZXQoJ3RhZ3MnKSwgKHRhZykgLT4gJyMnICsgdGFnKS5qb2luKCcgJylcblxuXHRcdGRlc2MgPSBAc3VwcGxhbnRTdHJpbmcgQENEX0NFKCkubG9jYWxlLmdldCgnZG9vZGxlX3NoYXJlX3RleHRfdG1wbCcpLCB2YXJzLCBmYWxzZVxuXG5cdFx0ZGVzYy5yZXBsYWNlKC8mbmJzcDsvZywgJyAnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IERvb2RsZVBhZ2VWaWV3XG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5cbmNsYXNzIEFic3RyYWN0TW9kYWwgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuXHQkd2luZG93IDogbnVsbFxuXG5cdCMjIyBvdmVycmlkZSBpbiBpbmRpdmlkdWFsIGNsYXNzZXMgIyMjXG5cdG5hbWUgICAgIDogbnVsbFxuXHR0ZW1wbGF0ZSA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAJHdpbmRvdyA9ICQod2luZG93KVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5hZGRDaGlsZCBAXG5cdFx0QHNldExpc3RlbmVycyAnb24nXG5cdFx0QGFuaW1hdGVJbigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGhpZGUgOiA9PlxuXG5cdFx0QGFuaW1hdGVPdXQgPT4gQENEX0NFKCkuYXBwVmlldy5yZW1vdmUgQFxuXG5cdFx0bnVsbFxuXG5cdGRpc3Bvc2UgOiA9PlxuXG5cdFx0QHNldExpc3RlbmVycyAnb2ZmJ1xuXHRcdEBDRF9DRSgpLmFwcFZpZXcubW9kYWxNYW5hZ2VyLm1vZGFsc1tAbmFtZV0udmlldyA9IG51bGxcblxuXHRcdG51bGxcblxuXHRzZXRMaXN0ZW5lcnMgOiAoc2V0dGluZykgPT5cblxuXHRcdEAkd2luZG93W3NldHRpbmddICdrZXl1cCcsIEBvbktleVVwXG5cdFx0QCQoJ1tkYXRhLWNsb3NlXScpW3NldHRpbmddICdjbGljaycsIEBjbG9zZUNsaWNrXG5cblx0XHRudWxsXG5cblx0b25LZXlVcCA6IChlKSA9PlxuXG5cdFx0aWYgZS5rZXlDb2RlIGlzIDI3IHRoZW4gQGhpZGUoKVxuXG5cdFx0bnVsbFxuXG5cdGFuaW1hdGVJbiA6ID0+XG5cblx0XHRUd2VlbkxpdGUudG8gQCRlbCwgMC4zLCB7ICd2aXNpYmlsaXR5JzogJ3Zpc2libGUnLCAnb3BhY2l0eSc6IDEsIGVhc2UgOiBRdWFkLmVhc2VPdXQgfVxuXHRcdFR3ZWVuTGl0ZS50byBAJGVsLmZpbmQoJy5pbm5lcicpLCAwLjMsIHsgZGVsYXkgOiAwLjE1LCAndHJhbnNmb3JtJzogJ3NjYWxlKDEpJywgJ3Zpc2liaWxpdHknOiAndmlzaWJsZScsICdvcGFjaXR5JzogMSwgZWFzZSA6IEJhY2suZWFzZU91dCB9XG5cblx0XHRudWxsXG5cblx0YW5pbWF0ZU91dCA6IChjYWxsYmFjaykgPT5cblxuXHRcdFR3ZWVuTGl0ZS50byBAJGVsLCAwLjMsIHsgZGVsYXkgOiAwLjE1LCAnb3BhY2l0eSc6IDAsIGVhc2UgOiBRdWFkLmVhc2VPdXQsIG9uQ29tcGxldGU6IGNhbGxiYWNrIH1cblx0XHRUd2VlbkxpdGUudG8gQCRlbC5maW5kKCcuaW5uZXInKSwgMC4zLCB7ICd0cmFuc2Zvcm0nOiAnc2NhbGUoMC44KScsICdvcGFjaXR5JzogMCwgZWFzZSA6IEJhY2suZWFzZUluIH1cblxuXHRcdG51bGxcblxuXHRjbG9zZUNsaWNrOiAoIGUgKSA9PlxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRAaGlkZSgpXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RNb2RhbFxuIiwiQWJzdHJhY3RNb2RhbCA9IHJlcXVpcmUgJy4vQWJzdHJhY3RNb2RhbCdcblxuY2xhc3MgT3JpZW50YXRpb25Nb2RhbCBleHRlbmRzIEFic3RyYWN0TW9kYWxcblxuXHRuYW1lICAgICA6ICdvcmllbnRhdGlvbk1vZGFsJ1xuXHR0ZW1wbGF0ZSA6ICdvcmllbnRhdGlvbi1tb2RhbCdcblxuXHRjYiAgICAgICA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IChAY2IpIC0+XG5cblx0XHRAdGVtcGxhdGVWYXJzID0ge0BuYW1lfVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRpbml0IDogPT5cblxuXHRcdG51bGxcblxuXHRoaWRlIDogKHN0aWxsTGFuZHNjYXBlPXRydWUpID0+XG5cblx0XHRAYW5pbWF0ZU91dCA9PlxuXHRcdFx0QENEX0NFKCkuYXBwVmlldy5yZW1vdmUgQFxuXHRcdFx0aWYgIXN0aWxsTGFuZHNjYXBlIHRoZW4gQGNiPygpXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRzdXBlclxuXG5cdFx0QENEX0NFKCkuYXBwVmlld1tzZXR0aW5nXSAndXBkYXRlRGltcycsIEBvblVwZGF0ZURpbXNcblx0XHRAJGVsW3NldHRpbmddICd0b3VjaGVuZCBjbGljaycsIEBoaWRlXG5cblx0XHRudWxsXG5cblx0b25VcGRhdGVEaW1zIDogKGRpbXMpID0+XG5cblx0XHRpZiBkaW1zLm8gaXMgJ3BvcnRyYWl0JyB0aGVuIEBoaWRlIGZhbHNlXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gT3JpZW50YXRpb25Nb2RhbFxuIiwiQWJzdHJhY3RWaWV3ICAgICA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0Vmlldydcbk9yaWVudGF0aW9uTW9kYWwgPSByZXF1aXJlICcuL09yaWVudGF0aW9uTW9kYWwnXG5cbmNsYXNzIE1vZGFsTWFuYWdlciBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdCMgd2hlbiBuZXcgbW9kYWwgY2xhc3NlcyBhcmUgY3JlYXRlZCwgYWRkIGhlcmUsIHdpdGggcmVmZXJlbmNlIHRvIGNsYXNzIG5hbWVcblx0bW9kYWxzIDpcblx0XHRvcmllbnRhdGlvbk1vZGFsIDogY2xhc3NSZWYgOiBPcmllbnRhdGlvbk1vZGFsLCB2aWV3IDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdHN1cGVyKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRudWxsXG5cblx0aXNPcGVuIDogPT5cblxuXHRcdCggaWYgQG1vZGFsc1tuYW1lXS52aWV3IHRoZW4gcmV0dXJuIHRydWUgKSBmb3IgbmFtZSwgbW9kYWwgb2YgQG1vZGFsc1xuXG5cdFx0ZmFsc2VcblxuXHRoaWRlT3Blbk1vZGFsIDogPT5cblxuXHRcdCggaWYgQG1vZGFsc1tuYW1lXS52aWV3IHRoZW4gb3Blbk1vZGFsID0gQG1vZGFsc1tuYW1lXS52aWV3ICkgZm9yIG5hbWUsIG1vZGFsIG9mIEBtb2RhbHNcblxuXHRcdG9wZW5Nb2RhbD8uaGlkZSgpXG5cblx0XHRudWxsXG5cblx0c2hvd01vZGFsIDogKG5hbWUsIGNiPW51bGwpID0+XG5cblx0XHRyZXR1cm4gaWYgQG1vZGFsc1tuYW1lXS52aWV3XG5cblx0XHRAbW9kYWxzW25hbWVdLnZpZXcgPSBuZXcgQG1vZGFsc1tuYW1lXS5jbGFzc1JlZiBjYlxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IE1vZGFsTWFuYWdlclxuIl19
