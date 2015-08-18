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



},{"./App":5}],2:[function(require,module,exports){
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

  App.prototype.SITE_URL = window.config.SITE_URL;

  App.prototype.BASE_URL = window.config.hostname;

  App.prototype.ASSETS_URL = window.config.assets_url;

  App.prototype.DOODLES_URL = window.config.doodles_url;

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



},{"./AppData":6,"./AppView":7,"./data/Locale":13,"./data/Templates":14,"./router/Nav":20,"./router/Router":21,"./utils/Analytics":22,"./utils/AuthManager":23,"./utils/Facebook":25,"./utils/GooglePlus":26,"./utils/MediaQueries":27,"./utils/Share":30}],6:[function(require,module,exports){
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

  AppData.prototype.DOODLE_CACHE_DURATION = ((1000 * 60) * 60) * 24;

  AppData.prototype.OPTIONS = {
    autoplay: true,
    show_apps_btn: false
  };

  function AppData(callback) {
    this.callback = callback;
    this.checkOptions = __bind(this.checkOptions, this);
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
    if (!chrome.storage.sync) {
      return;
    }
    chrome.storage.sync.get(null, (function(_this) {
      return function(cachedData) {
        var cachedDoodles, data, index;
        if (_.isEmpty(cachedData)) {
          return _this.fetchDoodles();
        }
        _this.checkOptions(cachedData);
        cachedDoodles = [];
        for (index in cachedData) {
          data = cachedData[index];
          if (index !== 'lastUpdated' && !index.match(/^option_/)) {
            cachedDoodles.push(JSON.parse(data));
          }
        }
        if ((Date.now() - cachedData.lastUpdated) > _this.DOODLE_CACHE_DURATION) {
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
    var doodle, newCache, position, _i, _len, _ref;
    newCache = {
      lastUpdated: Date.now()
    };
    _ref = this.doodles.models;
    for (position = _i = 0, _len = _ref.length; _i < _len; position = ++_i) {
      doodle = _ref[position];
      newCache[position] = JSON.stringify(doodle);
    }
    chrome.storage.sync.set(newCache);
    return null;
  };

  AppData.prototype.checkOptions = function(cachedData) {
    var data, index;
    for (index in cachedData) {
      data = cachedData[index];
      if (index.match(/^option_/)) {
        this.OPTIONS[index.replace(/^option_/, '')] = data;
      }
    }
    return null;
  };

  return AppData;

})(AbstractData);

module.exports = AppData;



},{"./collections/doodles/DoodlesCollection":10,"./data/API":11,"./data/AbstractData":12,"./utils/Requester":29}],7:[function(require,module,exports){
var AbstractView, AppView, Footer, Header, MediaQueries, ModalManager, Preloader, ShowAppsBtn, Wrapper,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('./view/AbstractView');

Preloader = require('./view/base/Preloader');

Header = require('./view/base/Header');

Wrapper = require('./view/base/Wrapper');

Footer = require('./view/base/Footer');

ShowAppsBtn = require('./view/base/ShowAppsBtn');

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

  AppView.prototype.EVENT_UPDATE_DIMENSIONS = 'EVENT_UPDATE_DIMENSIONS';

  AppView.prototype.MOBILE_WIDTH = 700;

  AppView.prototype.MOBILE = 'mobile';

  AppView.prototype.NON_MOBILE = 'non_mobile';

  function AppView() {
    this.checkOptions = __bind(this.checkOptions, this);
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
    this.checkOptions();
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

  AppView.prototype.checkOptions = function() {
    if (this.CD_CE().appData.OPTIONS.show_apps_btn) {
      this.showAppsBtn = new ShowAppsBtn;
      this.addChild(this.showAppsBtn);
    }
    return null;
  };

  return AppView;

})(AbstractView);

module.exports = AppView;



},{"./utils/MediaQueries":27,"./view/AbstractView":31,"./view/base/Footer":33,"./view/base/Header":34,"./view/base/Preloader":35,"./view/base/ShowAppsBtn":36,"./view/base/Wrapper":37,"./view/modals/_ModalManager":41}],8:[function(require,module,exports){
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



},{}],9:[function(require,module,exports){
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



},{"../../models/core/TemplateModel":18}],10:[function(require,module,exports){
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



},{"../../models/doodle/DoodleModel":19,"../AbstractCollection":8}],11:[function(require,module,exports){
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



},{"../models/core/APIRouteModel":16}],12:[function(require,module,exports){
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



},{}],13:[function(require,module,exports){
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



},{"../data/API":11,"../models/core/LocalesModel":17}],14:[function(require,module,exports){
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



},{"../collections/core/TemplatesCollection":9,"../models/core/TemplateModel":18}],15:[function(require,module,exports){
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



},{}],16:[function(require,module,exports){
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



},{}],17:[function(require,module,exports){
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



},{}],18:[function(require,module,exports){
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



},{}],19:[function(require,module,exports){
var AbstractModel, CodeWordTransitioner, DoodleModel, NumberUtils,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractModel = require('../AbstractModel');

NumberUtils = require('../../utils/NumberUtils');

CodeWordTransitioner = require('../../utils/CodeWordTransitioner');

DoodleModel = (function(_super) {
  __extends(DoodleModel, _super);

  DoodleModel.prototype.defaults = {
    "id": "",
    "index": "",
    "name": "",
    "author": {
      "name": "",
      "github": "",
      "website": "",
      "twitter": ""
    },
    "instructions": "",
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

  function DoodleModel() {
    this.getAuthorHtml = __bind(this.getAuthorHtml, this);
    this.getIndexHTML = __bind(this.getIndexHTML, this);
    this._filterAttrs = __bind(this._filterAttrs, this);
    DoodleModel.__super__.constructor.apply(this, arguments);
    return null;
  }

  DoodleModel.prototype._filterAttrs = function(attrs) {
    if (attrs.slug) {
      attrs.url = window.config.hostname + '/' + window.config.routes.DOODLES + '/' + attrs.slug;
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

  return DoodleModel;

})(AbstractModel);

module.exports = DoodleModel;



},{"../../utils/CodeWordTransitioner":24,"../../utils/NumberUtils":28,"../AbstractModel":15}],20:[function(require,module,exports){
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
    console.log("area", area);
    console.log("sub", sub);
    console.log("params", params);
    this.previous = this.current;
    this.current = {
      area: area,
      sub: sub
    };
    this.trigger(Nav.EVENT_CHANGE_VIEW, this.previous, this.current);
    this.trigger(Nav.EVENT_CHANGE_SUB_VIEW, this.current);
    if (this.CD_CE().appView.modalManager.isOpen()) {
      this.CD_CE().appView.modalManager.hideOpenModal();
    }
    return null;
  };

  return Nav;

})(AbstractView);

module.exports = Nav;



},{"../view/AbstractView":31,"./Router":21}],21:[function(require,module,exports){
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



},{}],22:[function(require,module,exports){

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



},{}],23:[function(require,module,exports){
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



},{"../data/AbstractData":12,"../utils/Facebook":25,"../utils/GooglePlus":26}],24:[function(require,module,exports){
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



},{"ent/encode":3}],25:[function(require,module,exports){
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



},{"../data/AbstractData":12}],26:[function(require,module,exports){
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



},{"../data/AbstractData":12}],27:[function(require,module,exports){
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



},{}],28:[function(require,module,exports){
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



},{}],29:[function(require,module,exports){

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



},{}],30:[function(require,module,exports){

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



},{}],31:[function(require,module,exports){
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



},{}],32:[function(require,module,exports){
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



},{"./AbstractView":31}],33:[function(require,module,exports){
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



},{"../AbstractView":31}],34:[function(require,module,exports){
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
    } else {
      this.hideDoodleInfo();
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



},{"../../router/Router":21,"../../utils/CodeWordTransitioner":24,"../AbstractView":31}],35:[function(require,module,exports){
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



},{"../AbstractView":31}],36:[function(require,module,exports){
var AbstractView, CodeWordTransitioner, ShowAppsBtn,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractView = require('../AbstractView');

CodeWordTransitioner = require('../../utils/CodeWordTransitioner');

ShowAppsBtn = (function(_super) {
  __extends(ShowAppsBtn, _super);

  ShowAppsBtn.prototype.template = 'show-apps-btn';

  function ShowAppsBtn() {
    this.onClick = __bind(this.onClick, this);
    this.onWordLeave = __bind(this.onWordLeave, this);
    this.onWordEnter = __bind(this.onWordEnter, this);
    this.bindEvents = __bind(this.bindEvents, this);
    this.init = __bind(this.init, this);
    this.templateVars = {};
    ShowAppsBtn.__super__.constructor.call(this);
    return null;
  }

  ShowAppsBtn.prototype.init = function() {
    if (!this.CD_CE().appData.activeDoodle) {
      return;
    }
    this.activeColour = this.CD_CE().appData.activeDoodle.get('colour_scheme') === 'light' ? 'black' : 'white';
    CodeWordTransitioner.prepare(this.$el, this.activeColour);
    this.bindEvents();
    return null;
  };

  ShowAppsBtn.prototype.bindEvents = function() {
    this.$el.on('mouseenter', this.onWordEnter);
    this.$el.on('mouseleave', this.onWordLeave);
    this.$el.on('click', this.onClick);
    return null;
  };

  ShowAppsBtn.prototype.onWordEnter = function(e) {
    CodeWordTransitioner.scramble(this.$el, this.activeColour);
    return null;
  };

  ShowAppsBtn.prototype.onWordLeave = function(e) {
    CodeWordTransitioner.unscramble(this.$el, this.activeColour);
    return null;
  };

  ShowAppsBtn.prototype.onClick = function() {
    chrome.tabs.update({
      url: 'chrome://apps'
    });
    return null;
  };

  return ShowAppsBtn;

})(AbstractView);

module.exports = ShowAppsBtn;



},{"../../utils/CodeWordTransitioner":24,"../AbstractView":31}],37:[function(require,module,exports){
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



},{"../../router/Nav":20,"../AbstractView":31,"../doodlePage/DoodlePageView":38}],38:[function(require,module,exports){
var AbstractViewPage, CodeWordTransitioner, DoodlePageView, MediaQueries,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

AbstractViewPage = require('../AbstractViewPage');

CodeWordTransitioner = require('../../utils/CodeWordTransitioner');

MediaQueries = require('../../utils/MediaQueries');

DoodlePageView = (function(_super) {
  __extends(DoodlePageView, _super);

  DoodlePageView.prototype.template = 'page-doodle';

  DoodlePageView.prototype.model = null;

  DoodlePageView.prototype.colourScheme = null;

  DoodlePageView.prototype.refreshTimer = null;

  DoodlePageView.prototype.infoScroller = null;

  DoodlePageView.prototype.MIN_PADDING_TOP = 230;

  DoodlePageView.prototype.MIN_PADDING_BOTTOM = 85;

  function DoodlePageView() {
    this.onShowDoodleBtnClick = __bind(this.onShowDoodleBtnClick, this);
    this.onShowDoodleBtnLeave = __bind(this.onShowDoodleBtnLeave, this);
    this.onShowDoodleBtnEnter = __bind(this.onShowDoodleBtnEnter, this);
    this.showShowDoodleBtn = __bind(this.showShowDoodleBtn, this);
    this.onRandomBtnClick = __bind(this.onRandomBtnClick, this);
    this.onRefreshBtnClick = __bind(this.onRefreshBtnClick, this);
    this.onInfoContentClick = __bind(this.onInfoContentClick, this);
    this.getShareDesc = __bind(this.getShareDesc, this);
    this.onShareBtnClick = __bind(this.onShareBtnClick, this);
    this.onInfoClose = __bind(this.onInfoClose, this);
    this.onInfoOpen = __bind(this.onInfoOpen, this);
    this._getInteractionContent = __bind(this._getInteractionContent, this);
    this.getDoodleInfoContent = __bind(this.getDoodleInfoContent, this);
    this.getInstructions = __bind(this.getInstructions, this);
    this.setupInstructions = __bind(this.setupInstructions, this);
    this.hideDoodle = __bind(this.hideDoodle, this);
    this.showDoodle = __bind(this.showDoodle, this);
    this.showFrame = __bind(this.showFrame, this);
    this._setupInfoWithoutOverflow = __bind(this._setupInfoWithoutOverflow, this);
    this._setupInfoWithOverflow = __bind(this._setupInfoWithOverflow, this);
    this.setupInfoDims = __bind(this.setupInfoDims, this);
    this.setupUI = __bind(this.setupUI, this);
    this.hide = __bind(this.hide, this);
    this.show = __bind(this.show, this);
    this.onResize = __bind(this.onResize, this);
    this.setListeners = __bind(this.setListeners, this);
    this.init = __bind(this.init, this);
    this.templateVars = {
      refresh_btn_title: this.CD_CE().locale.get("doodle_refresh_btn_title"),
      random_btn_title: this.CD_CE().locale.get("doodle_random_btn_title")
    };
    DoodlePageView.__super__.constructor.call(this);
    return null;
  }

  DoodlePageView.prototype.init = function() {
    this.$frame = this.$el.find('[data-doodle-frame]');
    this.$infoContent = this.$el.find('[data-doodle-info]');
    this.$instructions = this.$el.find('[data-doodle-instructions]');
    this.$refreshBtn = this.$el.find('[data-doodle-refresh]');
    this.$randomBtn = this.$el.find('[data-doodle-random]');
    this.$showDoodleBtnPane = this.$el.find('[data-show-doodle-btn-pane]');
    this.$showDoodleBtn = this.$el.find('[data-show-doodle-btn]');
    return null;
  };

  DoodlePageView.prototype.setListeners = function(setting) {
    this.CD_CE().appView[setting](this.CD_CE().appView.EVENT_UPDATE_DIMENSIONS, this.onResize);
    this.CD_CE().appView.header[setting](this.CD_CE().appView.header.EVENT_DOODLE_INFO_OPEN, this.onInfoOpen);
    this.CD_CE().appView.header[setting](this.CD_CE().appView.header.EVENT_DOODLE_INFO_CLOSE, this.onInfoClose);
    this.$el[setting]('click', '[data-share-btn]', this.onShareBtnClick);
    this.$refreshBtn[setting]('click', this.onRefreshBtnClick);
    this.$randomBtn[setting]('click', this.onRandomBtnClick);
    return null;
  };

  DoodlePageView.prototype.onResize = function() {
    this.setupInfoDims();
    return null;
  };

  DoodlePageView.prototype.show = function(cb) {
    this.model = this.CD_CE().appData.activeDoodle;
    this.setupUI();
    DoodlePageView.__super__.show.apply(this, arguments);
    if (this.CD_CE().appData.OPTIONS.autoplay) {
      this.showFrame(false);
    } else {
      this.showShowDoodleBtn();
    }
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
    this.colourScheme = this.model.get('colour_scheme') === 'light' ? 'black' : 'white';
    this.setupInstructions();
    return null;
  };

  DoodlePageView.prototype.setupInfoDims = function() {
    var contentOffset, maxHeight, requiresOverflow, top;
    this.$doodleInfoContent = this.$el.find('[data-doodle-info-content]');
    this.$doodleInfoContent.removeClass('enable-overflow').css({
      top: ''
    }).find('.doodle-info-inner').css({
      maxHeight: ''
    });
    contentOffset = this.$doodleInfoContent.offset().top;
    requiresOverflow = (contentOffset <= this.MIN_PADDING_TOP) && (this.CD_CE().appView.dims.w >= 750);
    console.log("setupInfoDims : =>", contentOffset, requiresOverflow);
    if (requiresOverflow) {
      top = this.MIN_PADDING_TOP;
      maxHeight = this.CD_CE().appView.dims.h - this.MIN_PADDING_TOP - this.MIN_PADDING_BOTTOM;
      this._setupInfoWithOverflow(top, maxHeight);
    } else {
      this._setupInfoWithoutOverflow();
    }
    return null;
  };

  DoodlePageView.prototype._setupInfoWithOverflow = function(top, maxHeight) {
    var $infoContentInner, iScrollOpts;
    this.$doodleInfoContent.addClass('enable-overflow').css({
      top: top
    }).find('.doodle-info-inner').css({
      maxHeight: maxHeight
    });
    $infoContentInner = this.$doodleInfoContent.find('.doodle-info-inner');
    if (!Modernizr.touch) {
      iScrollOpts = {
        mouseWheel: true,
        scrollbars: true,
        interactiveScrollbars: true,
        fadeScrollbars: true,
        momentum: false,
        bounce: false,
        preventDefault: false
      };
      if (this.infoScroller) {
        this.infoScroller.refresh();
      } else {
        this.infoScroller = new IScroll($infoContentInner[0], iScrollOpts);
      }
    }
    return null;
  };

  DoodlePageView.prototype._setupInfoWithoutOverflow = function() {
    var _ref;
    this.$doodleInfoContent.removeClass('enable-overflow').css({
      top: ''
    }).find('.doodle-info-inner').css({
      maxHeight: ''
    });
    if ((_ref = this.infoScroller) != null) {
      _ref.destroy();
    }
    this.infoScroller = null;
    return null;
  };

  DoodlePageView.prototype.showFrame = function(removeEvent, delay) {
    if (removeEvent == null) {
      removeEvent = true;
    }
    if (delay == null) {
      delay = null;
    }
    if (removeEvent) {
      this.CD_CE().appView.transitioner.off(this.CD_CE().appView.transitioner.EVENT_TRANSITIONER_OUT_DONE, this.showFrame);
    }
    this.$frame.attr('src', "" + (this.CD_CE().DOODLES_URL) + "/" + (this.model.get('slug')) + "/index.html");
    this.$frame.one('load', (function(_this) {
      return function() {
        return _this.showDoodle(delay);
      };
    })(this));
    return null;
  };

  DoodlePageView.prototype.showDoodle = function(delay) {
    this.$frame.addClass('show');
    setTimeout((function(_this) {
      return function() {
        var blankInstructions;
        blankInstructions = _this.model.get('instructions').split('').map(function() {
          return ' ';
        }).join('');
        return CodeWordTransitioner.to(blankInstructions, _this.$instructions, _this.colourScheme);
      };
    })(this), delay || 1000);
    setTimeout((function(_this) {
      return function() {
        return _this.$frame.focus();
      };
    })(this), 500);
    return null;
  };

  DoodlePageView.prototype.hideDoodle = function() {
    this.$frame.removeClass('show');
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
    var $instructionsEl, colourScheme;
    $instructionsEl = $('<span />');
    $instructionsEl.addClass('doodle-instructions').attr('data-codeword', '').attr('data-doodle-instructions', '').text(this.model.get('instructions').toLowerCase());
    console.log("@model.get('instructions').toLowerCase()");
    console.log(this.model.get('instructions').toLowerCase());
    colourScheme = this.model.get('colour_scheme') === 'light' ? 'black' : 'white';
    CodeWordTransitioner.prepare($instructionsEl, this.colourScheme);
    console.log("$instructionsEl");
    console.log($instructionsEl);
    return $instructionsEl;
  };

  DoodlePageView.prototype.getDoodleInfoContent = function() {
    var doodleInfoContent, doodleInfoVars;
    doodleInfoVars = {
      indexHTML: this.model.get('indexHTML'),
      thumb: this.CD_CE().DOODLES_URL + '/' + this.model.get('slug') + '/thumb.jpg',
      label_author: this.CD_CE().locale.get("doodle_label_author"),
      content_author: this.model.getAuthorHtml(),
      label_doodle_name: this.CD_CE().locale.get("doodle_label_doodle_name"),
      content_doodle_name: this.model.get('name'),
      label_doodle_instructions: this.CD_CE().locale.get('doodle_label_instructions'),
      content_doodle_instructions: this.model.get('instructions') || this.CD_CE().locale.get('doodle_label_instructions_none'),
      label_description: this.CD_CE().locale.get("doodle_label_description"),
      content_description: this.model.get('description'),
      label_tags: this.CD_CE().locale.get("doodle_label_tags"),
      content_tags: this.model.get('tags').join(', '),
      label_interaction: this.CD_CE().locale.get("doodle_label_interaction"),
      content_interaction: this._getInteractionContent(),
      label_share: this.CD_CE().locale.get("doodle_label_share"),
      share_url: this.CD_CE().SITE_URL + '/' + this.model.get('id'),
      share_url_text: this.CD_CE().SITE_URL.replace('http://', '') + '/' + this.model.get('id'),
      mouse_enabled: this.model.get('interaction.mouse'),
      keyboard_enabled: this.model.get('interaction.keyboard'),
      touch_enabled: this.model.get('interaction.touch')
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
    this.setupInfoDims();
    this.$el.addClass('show-info');
    return null;
  };

  DoodlePageView.prototype.onInfoClose = function() {
    this.$el.removeClass('show-info');
    setTimeout((function(_this) {
      return function() {
        var _ref;
        if ((_ref = _this.infoScroller) != null) {
          _ref.destroy();
        }
        return _this.infoScroller = null;
      };
    })(this), 500);
    return null;
  };

  DoodlePageView.prototype.onShareBtnClick = function(e) {
    var desc, shareMethod, url;
    e.preventDefault();
    shareMethod = $(e.currentTarget).attr('data-share-btn');
    url = shareMethod === 'facebook' ? this.CD_CE().SITE_URL + '/' + this.model.get('id') : ' ';
    desc = this.getShareDesc();
    this.CD_CE().share[shareMethod](url, desc);
    return null;
  };

  DoodlePageView.prototype.getShareDesc = function() {
    var desc, vars;
    vars = {
      doodle_name: this.model.get('name'),
      doodle_author: this.model.get('author.twitter') ? "@" + (this.model.get('author.twitter')) : this.model.get('author.name'),
      share_url: this.CD_CE().SITE_URL + '/' + this.model.get('id'),
      doodle_tags: _.map(this.model.get('tags'), function(tag) {
        return '#' + tag;
      }).join(' ')
    };
    desc = this.supplantString(this.CD_CE().locale.get('doodle_share_text_tmpl'), vars, false);
    return desc.replace(/&nbsp;/g, ' ');
  };

  DoodlePageView.prototype.onInfoContentClick = function(e) {
    if (e.target === this.$infoContent[0]) {
      this.CD_CE().appView.header.hideDoodleInfo();
    }
    return null;
  };

  DoodlePageView.prototype.onRefreshBtnClick = function() {
    CodeWordTransitioner["in"](this.$instructions, this.colourScheme);
    this.hideDoodle();
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout((function(_this) {
      return function() {
        return _this.showFrame(false, 2000);
      };
    })(this), 1000);
    return null;
  };

  DoodlePageView.prototype.onRandomBtnClick = function() {
    window.location.reload();
    return null;
  };

  DoodlePageView.prototype.showShowDoodleBtn = function() {
    this.$showDoodleBtn.text('show `' + this.model.get('author.name') + ' \\ ' + this.model.get('name') + '`');
    this.$showDoodleBtnPane.addClass('show');
    this.showDoodleBtnColour = this.model.get('colour_scheme') === 'light' ? 'black' : 'white';
    CodeWordTransitioner.prepare(this.$showDoodleBtn, this.showDoodleBtnColour);
    this.$showDoodleBtn.on('mouseenter', this.onShowDoodleBtnEnter);
    this.$showDoodleBtn.on('mouseleave', this.onShowDoodleBtnLeave);
    this.$showDoodleBtn.on('click', this.onShowDoodleBtnClick);
    return null;
  };

  DoodlePageView.prototype.onShowDoodleBtnEnter = function(e) {
    CodeWordTransitioner.scramble(this.$showDoodleBtn, this.showDoodleBtnColour);
    return null;
  };

  DoodlePageView.prototype.onShowDoodleBtnLeave = function(e) {
    CodeWordTransitioner.unscramble(this.$showDoodleBtn, this.showDoodleBtnColour);
    return null;
  };

  DoodlePageView.prototype.onShowDoodleBtnClick = function() {
    var emptyBtnText;
    this.$showDoodleBtn.off('mouseenter', this.onShowDoodleBtnEnter);
    this.$showDoodleBtn.off('mouseleave', this.onShowDoodleBtnLeave);
    emptyBtnText = this.$showDoodleBtn.text().split('').map(function() {
      return ' ';
    }).join('');
    CodeWordTransitioner.to(emptyBtnText, this.$showDoodleBtn, this.showDoodleBtnColour + '-no-border');
    this.$showDoodleBtnPane.addClass('hide');
    setTimeout((function(_this) {
      return function() {
        return _this.showFrame(false);
      };
    })(this), 300);
    return null;
  };

  return DoodlePageView;

})(AbstractViewPage);

module.exports = DoodlePageView;



},{"../../utils/CodeWordTransitioner":24,"../../utils/MediaQueries":27,"../AbstractViewPage":32}],39:[function(require,module,exports){
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



},{"../AbstractView":31}],40:[function(require,module,exports){
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



},{"../AbstractView":31,"./OrientationModal":40}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL01haW4uY29mZmVlIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3B1bnljb2RlL3B1bnljb2RlLmpzIiwibm9kZV9tb2R1bGVzL2VudC9lbmNvZGUuanMiLCJub2RlX21vZHVsZXMvZW50L3JldmVyc2VkLmpzb24iLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL0FwcC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL0FwcERhdGEuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9BcHBWaWV3LmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvY29sbGVjdGlvbnMvQWJzdHJhY3RDb2xsZWN0aW9uLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvY29sbGVjdGlvbnMvY29yZS9UZW1wbGF0ZXNDb2xsZWN0aW9uLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvY29sbGVjdGlvbnMvZG9vZGxlcy9Eb29kbGVzQ29sbGVjdGlvbi5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL2RhdGEvQVBJLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvZGF0YS9BYnN0cmFjdERhdGEuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9kYXRhL0xvY2FsZS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL2RhdGEvVGVtcGxhdGVzLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL0Fic3RyYWN0TW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvY29yZS9BUElSb3V0ZU1vZGVsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL2NvcmUvTG9jYWxlc01vZGVsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL2NvcmUvVGVtcGxhdGVNb2RlbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL21vZGVscy9kb29kbGUvRG9vZGxlTW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9yb3V0ZXIvTmF2LmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvcm91dGVyL1JvdXRlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0FuYWx5dGljcy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0F1dGhNYW5hZ2VyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvQ29kZVdvcmRUcmFuc2l0aW9uZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9GYWNlYm9vay5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0dvb2dsZVBsdXMuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9NZWRpYVF1ZXJpZXMuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9OdW1iZXJVdGlscy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL1JlcXVlc3Rlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL1NoYXJlLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9BYnN0cmFjdFZpZXcuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L0Fic3RyYWN0Vmlld1BhZ2UuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L2Jhc2UvRm9vdGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9iYXNlL0hlYWRlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvYmFzZS9QcmVsb2FkZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L2Jhc2UvU2hvd0FwcHNCdG4uY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L2Jhc2UvV3JhcHBlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvZG9vZGxlUGFnZS9Eb29kbGVQYWdlVmlldy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvbW9kYWxzL0Fic3RyYWN0TW9kYWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L21vZGFscy9PcmllbnRhdGlvbk1vZGFsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9tb2RhbHMvX01vZGFsTWFuYWdlci5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSxJQUFBLGtCQUFBOztBQUFBLEdBQUEsR0FBTSxPQUFBLENBQVEsT0FBUixDQUFOLENBQUE7O0FBS0E7QUFBQTs7O0dBTEE7O0FBQUEsT0FXQSxHQUFVLEtBWFYsQ0FBQTs7QUFBQSxJQWNBLEdBQVUsT0FBSCxHQUFnQixFQUFoQixHQUF5QixNQUFBLElBQVUsUUFkMUMsQ0FBQTs7QUFBQSxJQWlCSSxDQUFDLEtBQUwsR0FBaUIsSUFBQSxHQUFBLENBQUksT0FBSixDQWpCakIsQ0FBQTs7QUFBQSxJQWtCSSxDQUFDLEtBQUssQ0FBQyxJQUFYLENBQUEsQ0FsQkEsQ0FBQTs7Ozs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztB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QUEsQ0FiVCxDQUFBOztBQUFBLHlCQW1CQSxhQUFBLEdBQWdCLFNBQUEsR0FBQTtBQUVmLFFBQUEsNEJBQUE7QUFBQTtBQUFBLFNBQUEsWUFBQTt5QkFBQTtBQUFFLE1BQUEsSUFBRyxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLElBQWpCO0FBQTJCLFFBQUEsU0FBQSxHQUFZLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBQSxDQUFLLENBQUMsSUFBMUIsQ0FBM0I7T0FBRjtBQUFBLEtBQUE7O01BRUEsU0FBUyxDQUFFLElBQVgsQ0FBQTtLQUZBO1dBSUEsS0FOZTtFQUFBLENBbkJoQixDQUFBOztBQUFBLHlCQTJCQSxTQUFBLEdBQVksU0FBQyxJQUFELEVBQU8sRUFBUCxHQUFBOztNQUFPLEtBQUc7S0FFckI7QUFBQSxJQUFBLElBQVUsSUFBQyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxJQUF4QjtBQUFBLFlBQUEsQ0FBQTtLQUFBO0FBQUEsSUFFQSxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLElBQWQsR0FBeUIsSUFBQSxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLFFBQWQsQ0FBdUIsRUFBdkIsQ0FGekIsQ0FBQTtXQUlBLEtBTlc7RUFBQSxDQTNCWixDQUFBOztzQkFBQTs7R0FIMEIsYUFIM0IsQ0FBQTs7QUFBQSxNQXlDTSxDQUFDLE9BQVAsR0FBaUIsWUF6Q2pCLENBQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiQXBwID0gcmVxdWlyZSAnLi9BcHAnXG5cbiMgUFJPRFVDVElPTiBFTlZJUk9OTUVOVCAtIG1heSB3YW50IHRvIHVzZSBzZXJ2ZXItc2V0IHZhcmlhYmxlcyBoZXJlXG4jIElTX0xJVkUgPSBkbyAtPiByZXR1cm4gaWYgd2luZG93LmxvY2F0aW9uLmhvc3QuaW5kZXhPZignbG9jYWxob3N0JykgPiAtMSBvciB3aW5kb3cubG9jYXRpb24uc2VhcmNoIGlzICc/ZCcgdGhlbiBmYWxzZSBlbHNlIHRydWVcblxuIyMjXG5cbldJUCAtIHRoaXMgd2lsbCBpZGVhbGx5IGNoYW5nZSB0byBvbGQgZm9ybWF0IChhYm92ZSkgd2hlbiBjYW4gZmlndXJlIGl0IG91dFxuXG4jIyNcblxuSVNfTElWRSA9IGZhbHNlXG5cbiMgT05MWSBFWFBPU0UgQVBQIEdMT0JBTExZIElGIExPQ0FMIE9SIERFVidJTkdcbnZpZXcgPSBpZiBJU19MSVZFIHRoZW4ge30gZWxzZSAod2luZG93IG9yIGRvY3VtZW50KVxuXG4jIERFQ0xBUkUgTUFJTiBBUFBMSUNBVElPTlxudmlldy5DRF9DRSA9IG5ldyBBcHAgSVNfTElWRVxudmlldy5DRF9DRS5pbml0KClcbiIsIi8qISBodHRwOi8vbXRocy5iZS9wdW55Y29kZSB2MS4yLjQgYnkgQG1hdGhpYXMgKi9cbjsoZnVuY3Rpb24ocm9vdCkge1xuXG5cdC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZXMgKi9cblx0dmFyIGZyZWVFeHBvcnRzID0gdHlwZW9mIGV4cG9ydHMgPT0gJ29iamVjdCcgJiYgZXhwb3J0cztcblx0dmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJlxuXHRcdG1vZHVsZS5leHBvcnRzID09IGZyZWVFeHBvcnRzICYmIG1vZHVsZTtcblx0dmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbDtcblx0aWYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsIHx8IGZyZWVHbG9iYWwud2luZG93ID09PSBmcmVlR2xvYmFsKSB7XG5cdFx0cm9vdCA9IGZyZWVHbG9iYWw7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwdW55Y29kZWAgb2JqZWN0LlxuXHQgKiBAbmFtZSBwdW55Y29kZVxuXHQgKiBAdHlwZSBPYmplY3Rcblx0ICovXG5cdHZhciBwdW55Y29kZSxcblxuXHQvKiogSGlnaGVzdCBwb3NpdGl2ZSBzaWduZWQgMzItYml0IGZsb2F0IHZhbHVlICovXG5cdG1heEludCA9IDIxNDc0ODM2NDcsIC8vIGFrYS4gMHg3RkZGRkZGRiBvciAyXjMxLTFcblxuXHQvKiogQm9vdHN0cmluZyBwYXJhbWV0ZXJzICovXG5cdGJhc2UgPSAzNixcblx0dE1pbiA9IDEsXG5cdHRNYXggPSAyNixcblx0c2tldyA9IDM4LFxuXHRkYW1wID0gNzAwLFxuXHRpbml0aWFsQmlhcyA9IDcyLFxuXHRpbml0aWFsTiA9IDEyOCwgLy8gMHg4MFxuXHRkZWxpbWl0ZXIgPSAnLScsIC8vICdcXHgyRCdcblxuXHQvKiogUmVndWxhciBleHByZXNzaW9ucyAqL1xuXHRyZWdleFB1bnljb2RlID0gL154bi0tLyxcblx0cmVnZXhOb25BU0NJSSA9IC9bXiAtfl0vLCAvLyB1bnByaW50YWJsZSBBU0NJSSBjaGFycyArIG5vbi1BU0NJSSBjaGFyc1xuXHRyZWdleFNlcGFyYXRvcnMgPSAvXFx4MkV8XFx1MzAwMnxcXHVGRjBFfFxcdUZGNjEvZywgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG5cdC8qKiBFcnJvciBtZXNzYWdlcyAqL1xuXHRlcnJvcnMgPSB7XG5cdFx0J292ZXJmbG93JzogJ092ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzJyxcblx0XHQnbm90LWJhc2ljJzogJ0lsbGVnYWwgaW5wdXQgPj0gMHg4MCAobm90IGEgYmFzaWMgY29kZSBwb2ludCknLFxuXHRcdCdpbnZhbGlkLWlucHV0JzogJ0ludmFsaWQgaW5wdXQnXG5cdH0sXG5cblx0LyoqIENvbnZlbmllbmNlIHNob3J0Y3V0cyAqL1xuXHRiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW4sXG5cdGZsb29yID0gTWF0aC5mbG9vcixcblx0c3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZSxcblxuXHQvKiogVGVtcG9yYXJ5IHZhcmlhYmxlICovXG5cdGtleTtcblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFRoZSBlcnJvciB0eXBlLlxuXHQgKiBAcmV0dXJucyB7RXJyb3J9IFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBlcnJvcih0eXBlKSB7XG5cdFx0dGhyb3cgUmFuZ2VFcnJvcihlcnJvcnNbdHlwZV0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBgQXJyYXkjbWFwYCB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnkgYXJyYXlcblx0ICogaXRlbS5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBhcnJheSBvZiB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwKGFycmF5LCBmbikge1xuXHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0d2hpbGUgKGxlbmd0aC0tKSB7XG5cdFx0XHRhcnJheVtsZW5ndGhdID0gZm4oYXJyYXlbbGVuZ3RoXSk7XG5cdFx0fVxuXHRcdHJldHVybiBhcnJheTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHNpbXBsZSBgQXJyYXkjbWFwYC1saWtlIHdyYXBwZXIgdG8gd29yayB3aXRoIGRvbWFpbiBuYW1lIHN0cmluZ3MuXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnlcblx0ICogY2hhcmFjdGVyLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IHN0cmluZyBvZiBjaGFyYWN0ZXJzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFja1xuXHQgKiBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcERvbWFpbihzdHJpbmcsIGZuKSB7XG5cdFx0cmV0dXJuIG1hcChzdHJpbmcuc3BsaXQocmVnZXhTZXBhcmF0b3JzKSwgZm4pLmpvaW4oJy4nKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIG51bWVyaWMgY29kZSBwb2ludHMgb2YgZWFjaCBVbmljb2RlXG5cdCAqIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nLiBXaGlsZSBKYXZhU2NyaXB0IHVzZXMgVUNTLTIgaW50ZXJuYWxseSxcblx0ICogdGhpcyBmdW5jdGlvbiB3aWxsIGNvbnZlcnQgYSBwYWlyIG9mIHN1cnJvZ2F0ZSBoYWx2ZXMgKGVhY2ggb2Ygd2hpY2hcblx0ICogVUNTLTIgZXhwb3NlcyBhcyBzZXBhcmF0ZSBjaGFyYWN0ZXJzKSBpbnRvIGEgc2luZ2xlIGNvZGUgcG9pbnQsXG5cdCAqIG1hdGNoaW5nIFVURi0xNi5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5lbmNvZGVgXG5cdCAqIEBzZWUgPGh0dHA6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGRlY29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nIFRoZSBVbmljb2RlIGlucHV0IHN0cmluZyAoVUNTLTIpLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IFRoZSBuZXcgYXJyYXkgb2YgY29kZSBwb2ludHMuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZGVjb2RlKHN0cmluZykge1xuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgY291bnRlciA9IDAsXG5cdFx0ICAgIGxlbmd0aCA9IHN0cmluZy5sZW5ndGgsXG5cdFx0ICAgIHZhbHVlLFxuXHRcdCAgICBleHRyYTtcblx0XHR3aGlsZSAoY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0dmFsdWUgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0aWYgKHZhbHVlID49IDB4RDgwMCAmJiB2YWx1ZSA8PSAweERCRkYgJiYgY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHQvLyBoaWdoIHN1cnJvZ2F0ZSwgYW5kIHRoZXJlIGlzIGEgbmV4dCBjaGFyYWN0ZXJcblx0XHRcdFx0ZXh0cmEgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0XHRpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHsgLy8gbG93IHN1cnJvZ2F0ZVxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKCgodmFsdWUgJiAweDNGRikgPDwgMTApICsgKGV4dHJhICYgMHgzRkYpICsgMHgxMDAwMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlIG5leHRcblx0XHRcdFx0XHQvLyBjb2RlIHVuaXQgaXMgdGhlIGhpZ2ggc3Vycm9nYXRlIG9mIGEgc3Vycm9nYXRlIHBhaXJcblx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0Y291bnRlci0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHN0cmluZyBiYXNlZCBvbiBhbiBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmRlY29kZWBcblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZW5jb2RlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGNvZGVQb2ludHMgVGhlIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBuZXcgVW5pY29kZSBzdHJpbmcgKFVDUy0yKS5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJlbmNvZGUoYXJyYXkpIHtcblx0XHRyZXR1cm4gbWFwKGFycmF5LCBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0dmFyIG91dHB1dCA9ICcnO1xuXHRcdFx0aWYgKHZhbHVlID4gMHhGRkZGKSB7XG5cdFx0XHRcdHZhbHVlIC09IDB4MTAwMDA7XG5cdFx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApO1xuXHRcdFx0XHR2YWx1ZSA9IDB4REMwMCB8IHZhbHVlICYgMHgzRkY7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBiYXNpYyBjb2RlIHBvaW50IGludG8gYSBkaWdpdC9pbnRlZ2VyLlxuXHQgKiBAc2VlIGBkaWdpdFRvQmFzaWMoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGNvZGVQb2ludCBUaGUgYmFzaWMgbnVtZXJpYyBjb2RlIHBvaW50IHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQgKGZvciB1c2UgaW5cblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpbiB0aGUgcmFuZ2UgYDBgIHRvIGBiYXNlIC0gMWAsIG9yIGBiYXNlYCBpZlxuXHQgKiB0aGUgY29kZSBwb2ludCBkb2VzIG5vdCByZXByZXNlbnQgYSB2YWx1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGJhc2ljVG9EaWdpdChjb2RlUG9pbnQpIHtcblx0XHRpZiAoY29kZVBvaW50IC0gNDggPCAxMCkge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDIyO1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gNjUgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDY1O1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gOTcgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDk3O1xuXHRcdH1cblx0XHRyZXR1cm4gYmFzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGRpZ2l0L2ludGVnZXIgaW50byBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEBzZWUgYGJhc2ljVG9EaWdpdCgpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gZGlnaXQgVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgYmFzaWMgY29kZSBwb2ludCB3aG9zZSB2YWx1ZSAod2hlbiB1c2VkIGZvclxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGlzIGBkaWdpdGAsIHdoaWNoIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZVxuXHQgKiBgMGAgdG8gYGJhc2UgLSAxYC4gSWYgYGZsYWdgIGlzIG5vbi16ZXJvLCB0aGUgdXBwZXJjYXNlIGZvcm0gaXNcblx0ICogdXNlZDsgZWxzZSwgdGhlIGxvd2VyY2FzZSBmb3JtIGlzIHVzZWQuIFRoZSBiZWhhdmlvciBpcyB1bmRlZmluZWRcblx0ICogaWYgYGZsYWdgIGlzIG5vbi16ZXJvIGFuZCBgZGlnaXRgIGhhcyBubyB1cHBlcmNhc2UgZm9ybS5cblx0ICovXG5cdGZ1bmN0aW9uIGRpZ2l0VG9CYXNpYyhkaWdpdCwgZmxhZykge1xuXHRcdC8vICAwLi4yNSBtYXAgdG8gQVNDSUkgYS4ueiBvciBBLi5aXG5cdFx0Ly8gMjYuLjM1IG1hcCB0byBBU0NJSSAwLi45XG5cdFx0cmV0dXJuIGRpZ2l0ICsgMjIgKyA3NSAqIChkaWdpdCA8IDI2KSAtICgoZmxhZyAhPSAwKSA8PCA1KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCaWFzIGFkYXB0YXRpb24gZnVuY3Rpb24gYXMgcGVyIHNlY3Rpb24gMy40IG9mIFJGQyAzNDkyLlxuXHQgKiBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzNDkyI3NlY3Rpb24tMy40XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGFwdChkZWx0YSwgbnVtUG9pbnRzLCBmaXJzdFRpbWUpIHtcblx0XHR2YXIgayA9IDA7XG5cdFx0ZGVsdGEgPSBmaXJzdFRpbWUgPyBmbG9vcihkZWx0YSAvIGRhbXApIDogZGVsdGEgPj4gMTtcblx0XHRkZWx0YSArPSBmbG9vcihkZWx0YSAvIG51bVBvaW50cyk7XG5cdFx0Zm9yICgvKiBubyBpbml0aWFsaXphdGlvbiAqLzsgZGVsdGEgPiBiYXNlTWludXNUTWluICogdE1heCA+PiAxOyBrICs9IGJhc2UpIHtcblx0XHRcdGRlbHRhID0gZmxvb3IoZGVsdGEgLyBiYXNlTWludXNUTWluKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZsb29yKGsgKyAoYmFzZU1pbnVzVE1pbiArIDEpICogZGVsdGEgLyAoZGVsdGEgKyBza2V3KSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzIHRvIGEgc3RyaW5nIG9mIFVuaWNvZGVcblx0ICogc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlKGlucHV0KSB7XG5cdFx0Ly8gRG9uJ3QgdXNlIFVDUy0yXG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aCxcblx0XHQgICAgb3V0LFxuXHRcdCAgICBpID0gMCxcblx0XHQgICAgbiA9IGluaXRpYWxOLFxuXHRcdCAgICBiaWFzID0gaW5pdGlhbEJpYXMsXG5cdFx0ICAgIGJhc2ljLFxuXHRcdCAgICBqLFxuXHRcdCAgICBpbmRleCxcblx0XHQgICAgb2xkaSxcblx0XHQgICAgdyxcblx0XHQgICAgayxcblx0XHQgICAgZGlnaXQsXG5cdFx0ICAgIHQsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBiYXNlTWludXNUO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50czogbGV0IGBiYXNpY2AgYmUgdGhlIG51bWJlciBvZiBpbnB1dCBjb2RlXG5cdFx0Ly8gcG9pbnRzIGJlZm9yZSB0aGUgbGFzdCBkZWxpbWl0ZXIsIG9yIGAwYCBpZiB0aGVyZSBpcyBub25lLCB0aGVuIGNvcHlcblx0XHQvLyB0aGUgZmlyc3QgYmFzaWMgY29kZSBwb2ludHMgdG8gdGhlIG91dHB1dC5cblxuXHRcdGJhc2ljID0gaW5wdXQubGFzdEluZGV4T2YoZGVsaW1pdGVyKTtcblx0XHRpZiAoYmFzaWMgPCAwKSB7XG5cdFx0XHRiYXNpYyA9IDA7XG5cdFx0fVxuXG5cdFx0Zm9yIChqID0gMDsgaiA8IGJhc2ljOyArK2opIHtcblx0XHRcdC8vIGlmIGl0J3Mgbm90IGEgYmFzaWMgY29kZSBwb2ludFxuXHRcdFx0aWYgKGlucHV0LmNoYXJDb2RlQXQoaikgPj0gMHg4MCkge1xuXHRcdFx0XHRlcnJvcignbm90LWJhc2ljJyk7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQucHVzaChpbnB1dC5jaGFyQ29kZUF0KGopKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGRlY29kaW5nIGxvb3A6IHN0YXJ0IGp1c3QgYWZ0ZXIgdGhlIGxhc3QgZGVsaW1pdGVyIGlmIGFueSBiYXNpYyBjb2RlXG5cdFx0Ly8gcG9pbnRzIHdlcmUgY29waWVkOyBzdGFydCBhdCB0aGUgYmVnaW5uaW5nIG90aGVyd2lzZS5cblxuXHRcdGZvciAoaW5kZXggPSBiYXNpYyA+IDAgPyBiYXNpYyArIDEgOiAwOyBpbmRleCA8IGlucHV0TGVuZ3RoOyAvKiBubyBmaW5hbCBleHByZXNzaW9uICovKSB7XG5cblx0XHRcdC8vIGBpbmRleGAgaXMgdGhlIGluZGV4IG9mIHRoZSBuZXh0IGNoYXJhY3RlciB0byBiZSBjb25zdW1lZC5cblx0XHRcdC8vIERlY29kZSBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyIGludG8gYGRlbHRhYCxcblx0XHRcdC8vIHdoaWNoIGdldHMgYWRkZWQgdG8gYGlgLiBUaGUgb3ZlcmZsb3cgY2hlY2tpbmcgaXMgZWFzaWVyXG5cdFx0XHQvLyBpZiB3ZSBpbmNyZWFzZSBgaWAgYXMgd2UgZ28sIHRoZW4gc3VidHJhY3Qgb2ZmIGl0cyBzdGFydGluZ1xuXHRcdFx0Ly8gdmFsdWUgYXQgdGhlIGVuZCB0byBvYnRhaW4gYGRlbHRhYC5cblx0XHRcdGZvciAob2xkaSA9IGksIHcgPSAxLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblxuXHRcdFx0XHRpZiAoaW5kZXggPj0gaW5wdXRMZW5ndGgpIHtcblx0XHRcdFx0XHRlcnJvcignaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGlnaXQgPSBiYXNpY1RvRGlnaXQoaW5wdXQuY2hhckNvZGVBdChpbmRleCsrKSk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0ID49IGJhc2UgfHwgZGlnaXQgPiBmbG9vcigobWF4SW50IC0gaSkgLyB3KSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aSArPSBkaWdpdCAqIHc7XG5cdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA8IHQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0aWYgKHcgPiBmbG9vcihtYXhJbnQgLyBiYXNlTWludXNUKSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dyAqPSBiYXNlTWludXNUO1xuXG5cdFx0XHR9XG5cblx0XHRcdG91dCA9IG91dHB1dC5sZW5ndGggKyAxO1xuXHRcdFx0YmlhcyA9IGFkYXB0KGkgLSBvbGRpLCBvdXQsIG9sZGkgPT0gMCk7XG5cblx0XHRcdC8vIGBpYCB3YXMgc3VwcG9zZWQgdG8gd3JhcCBhcm91bmQgZnJvbSBgb3V0YCB0byBgMGAsXG5cdFx0XHQvLyBpbmNyZW1lbnRpbmcgYG5gIGVhY2ggdGltZSwgc28gd2UnbGwgZml4IHRoYXQgbm93OlxuXHRcdFx0aWYgKGZsb29yKGkgLyBvdXQpID4gbWF4SW50IC0gbikge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0biArPSBmbG9vcihpIC8gb3V0KTtcblx0XHRcdGkgJT0gb3V0O1xuXG5cdFx0XHQvLyBJbnNlcnQgYG5gIGF0IHBvc2l0aW9uIGBpYCBvZiB0aGUgb3V0cHV0XG5cdFx0XHRvdXRwdXQuc3BsaWNlKGkrKywgMCwgbik7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdWNzMmVuY29kZShvdXRwdXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scyB0byBhIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5XG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZShpbnB1dCkge1xuXHRcdHZhciBuLFxuXHRcdCAgICBkZWx0YSxcblx0XHQgICAgaGFuZGxlZENQQ291bnQsXG5cdFx0ICAgIGJhc2ljTGVuZ3RoLFxuXHRcdCAgICBiaWFzLFxuXHRcdCAgICBqLFxuXHRcdCAgICBtLFxuXHRcdCAgICBxLFxuXHRcdCAgICBrLFxuXHRcdCAgICB0LFxuXHRcdCAgICBjdXJyZW50VmFsdWUsXG5cdFx0ICAgIG91dHB1dCA9IFtdLFxuXHRcdCAgICAvKiogYGlucHV0TGVuZ3RoYCB3aWxsIGhvbGQgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyBpbiBgaW5wdXRgLiAqL1xuXHRcdCAgICBpbnB1dExlbmd0aCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50UGx1c09uZSxcblx0XHQgICAgYmFzZU1pbnVzVCxcblx0XHQgICAgcU1pbnVzVDtcblxuXHRcdC8vIENvbnZlcnQgdGhlIGlucHV0IGluIFVDUy0yIHRvIFVuaWNvZGVcblx0XHRpbnB1dCA9IHVjczJkZWNvZGUoaW5wdXQpO1xuXG5cdFx0Ly8gQ2FjaGUgdGhlIGxlbmd0aFxuXHRcdGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSB0aGUgc3RhdGVcblx0XHRuID0gaW5pdGlhbE47XG5cdFx0ZGVsdGEgPSAwO1xuXHRcdGJpYXMgPSBpbml0aWFsQmlhcztcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHNcblx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgMHg4MCkge1xuXHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoY3VycmVudFZhbHVlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aGFuZGxlZENQQ291bnQgPSBiYXNpY0xlbmd0aCA9IG91dHB1dC5sZW5ndGg7XG5cblx0XHQvLyBgaGFuZGxlZENQQ291bnRgIGlzIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgdGhhdCBoYXZlIGJlZW4gaGFuZGxlZDtcblx0XHQvLyBgYmFzaWNMZW5ndGhgIGlzIHRoZSBudW1iZXIgb2YgYmFzaWMgY29kZSBwb2ludHMuXG5cblx0XHQvLyBGaW5pc2ggdGhlIGJhc2ljIHN0cmluZyAtIGlmIGl0IGlzIG5vdCBlbXB0eSAtIHdpdGggYSBkZWxpbWl0ZXJcblx0XHRpZiAoYmFzaWNMZW5ndGgpIHtcblx0XHRcdG91dHB1dC5wdXNoKGRlbGltaXRlcik7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBlbmNvZGluZyBsb29wOlxuXHRcdHdoaWxlIChoYW5kbGVkQ1BDb3VudCA8IGlucHV0TGVuZ3RoKSB7XG5cblx0XHRcdC8vIEFsbCBub24tYmFzaWMgY29kZSBwb2ludHMgPCBuIGhhdmUgYmVlbiBoYW5kbGVkIGFscmVhZHkuIEZpbmQgdGhlIG5leHRcblx0XHRcdC8vIGxhcmdlciBvbmU6XG5cdFx0XHRmb3IgKG0gPSBtYXhJbnQsIGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA+PSBuICYmIGN1cnJlbnRWYWx1ZSA8IG0pIHtcblx0XHRcdFx0XHRtID0gY3VycmVudFZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluY3JlYXNlIGBkZWx0YWAgZW5vdWdoIHRvIGFkdmFuY2UgdGhlIGRlY29kZXIncyA8bixpPiBzdGF0ZSB0byA8bSwwPixcblx0XHRcdC8vIGJ1dCBndWFyZCBhZ2FpbnN0IG92ZXJmbG93XG5cdFx0XHRoYW5kbGVkQ1BDb3VudFBsdXNPbmUgPSBoYW5kbGVkQ1BDb3VudCArIDE7XG5cdFx0XHRpZiAobSAtIG4gPiBmbG9vcigobWF4SW50IC0gZGVsdGEpIC8gaGFuZGxlZENQQ291bnRQbHVzT25lKSkge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsdGEgKz0gKG0gLSBuKSAqIGhhbmRsZWRDUENvdW50UGx1c09uZTtcblx0XHRcdG4gPSBtO1xuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgbiAmJiArK2RlbHRhID4gbWF4SW50KSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID09IG4pIHtcblx0XHRcdFx0XHQvLyBSZXByZXNlbnQgZGVsdGEgYXMgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlclxuXHRcdFx0XHRcdGZvciAocSA9IGRlbHRhLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblx0XHRcdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXHRcdFx0XHRcdFx0aWYgKHEgPCB0KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cU1pbnVzVCA9IHEgLSB0O1xuXHRcdFx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goXG5cdFx0XHRcdFx0XHRcdHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWModCArIHFNaW51c1QgJSBiYXNlTWludXNULCAwKSlcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRxID0gZmxvb3IocU1pbnVzVCAvIGJhc2VNaW51c1QpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWMocSwgMCkpKTtcblx0XHRcdFx0XHRiaWFzID0gYWRhcHQoZGVsdGEsIGhhbmRsZWRDUENvdW50UGx1c09uZSwgaGFuZGxlZENQQ291bnQgPT0gYmFzaWNMZW5ndGgpO1xuXHRcdFx0XHRcdGRlbHRhID0gMDtcblx0XHRcdFx0XHQrK2hhbmRsZWRDUENvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdCsrZGVsdGE7XG5cdFx0XHQrK247XG5cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dC5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSB0byBVbmljb2RlLiBPbmx5IHRoZVxuXHQgKiBQdW55Y29kZWQgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLCBpLmUuIGl0IGRvZXNuJ3Rcblx0ICogbWF0dGVyIGlmIHlvdSBjYWxsIGl0IG9uIGEgc3RyaW5nIHRoYXQgaGFzIGFscmVhZHkgYmVlbiBjb252ZXJ0ZWQgdG9cblx0ICogVW5pY29kZS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIFB1bnljb2RlIGRvbWFpbiBuYW1lIHRvIGNvbnZlcnQgdG8gVW5pY29kZS5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFVuaWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIFB1bnljb2RlXG5cdCAqIHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvVW5pY29kZShkb21haW4pIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGRvbWFpbiwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhQdW55Y29kZS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyBkZWNvZGUoc3RyaW5nLnNsaWNlKDQpLnRvTG93ZXJDYXNlKCkpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgVW5pY29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgdG8gUHVueWNvZGUuIE9ubHkgdGhlXG5cdCAqIG5vbi1BU0NJSSBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgd2lsbCBiZSBjb252ZXJ0ZWQsIGkuZS4gaXQgZG9lc24ndFxuXHQgKiBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgd2l0aCBhIGRvbWFpbiB0aGF0J3MgYWxyZWFkeSBpbiBBU0NJSS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lIHRvIGNvbnZlcnQsIGFzIGEgVW5pY29kZSBzdHJpbmcuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBQdW55Y29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gZG9tYWluIG5hbWUuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b0FTQ0lJKGRvbWFpbikge1xuXHRcdHJldHVybiBtYXBEb21haW4oZG9tYWluLCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleE5vbkFTQ0lJLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/ICd4bi0tJyArIGVuY29kZShzdHJpbmcpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqIERlZmluZSB0aGUgcHVibGljIEFQSSAqL1xuXHRwdW55Y29kZSA9IHtcblx0XHQvKipcblx0XHQgKiBBIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGN1cnJlbnQgUHVueWNvZGUuanMgdmVyc2lvbiBudW1iZXIuXG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgU3RyaW5nXG5cdFx0ICovXG5cdFx0J3ZlcnNpb24nOiAnMS4yLjQnLFxuXHRcdC8qKlxuXHRcdCAqIEFuIG9iamVjdCBvZiBtZXRob2RzIHRvIGNvbnZlcnQgZnJvbSBKYXZhU2NyaXB0J3MgaW50ZXJuYWwgY2hhcmFjdGVyXG5cdFx0ICogcmVwcmVzZW50YXRpb24gKFVDUy0yKSB0byBVbmljb2RlIGNvZGUgcG9pbnRzLCBhbmQgYmFjay5cblx0XHQgKiBAc2VlIDxodHRwOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIE9iamVjdFxuXHRcdCAqL1xuXHRcdCd1Y3MyJzoge1xuXHRcdFx0J2RlY29kZSc6IHVjczJkZWNvZGUsXG5cdFx0XHQnZW5jb2RlJzogdWNzMmVuY29kZVxuXHRcdH0sXG5cdFx0J2RlY29kZSc6IGRlY29kZSxcblx0XHQnZW5jb2RlJzogZW5jb2RlLFxuXHRcdCd0b0FTQ0lJJzogdG9BU0NJSSxcblx0XHQndG9Vbmljb2RlJzogdG9Vbmljb2RlXG5cdH07XG5cblx0LyoqIEV4cG9zZSBgcHVueWNvZGVgICovXG5cdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHQvLyBsaWtlIHRoZSBmb2xsb3dpbmc6XG5cdGlmIChcblx0XHR0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiZcblx0XHR0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJlxuXHRcdGRlZmluZS5hbWRcblx0KSB7XG5cdFx0ZGVmaW5lKCdwdW55Y29kZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHB1bnljb2RlO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmICFmcmVlRXhwb3J0cy5ub2RlVHlwZSkge1xuXHRcdGlmIChmcmVlTW9kdWxlKSB7IC8vIGluIE5vZGUuanMgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSBwdW55Y29kZTtcblx0XHR9IGVsc2UgeyAvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yIChrZXkgaW4gcHVueWNvZGUpIHtcblx0XHRcdFx0cHVueWNvZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHB1bnljb2RlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHsgLy8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdHJvb3QucHVueWNvZGUgPSBwdW55Y29kZTtcblx0fVxuXG59KHRoaXMpKTtcbiIsInZhciBwdW55Y29kZSA9IHJlcXVpcmUoJ3B1bnljb2RlJyk7XG52YXIgcmV2RW50aXRpZXMgPSByZXF1aXJlKCcuL3JldmVyc2VkLmpzb24nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBlbmNvZGU7XG5cbmZ1bmN0aW9uIGVuY29kZSAoc3RyLCBvcHRzKSB7XG4gICAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGEgU3RyaW5nJyk7XG4gICAgfVxuICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuXG4gICAgdmFyIG51bWVyaWMgPSB0cnVlO1xuICAgIGlmIChvcHRzLm5hbWVkKSBudW1lcmljID0gZmFsc2U7XG4gICAgaWYgKG9wdHMubnVtZXJpYyAhPT0gdW5kZWZpbmVkKSBudW1lcmljID0gb3B0cy5udW1lcmljO1xuXG4gICAgdmFyIHNwZWNpYWwgPSBvcHRzLnNwZWNpYWwgfHwge1xuICAgICAgICAnXCInOiB0cnVlLCBcIidcIjogdHJ1ZSxcbiAgICAgICAgJzwnOiB0cnVlLCAnPic6IHRydWUsXG4gICAgICAgICcmJzogdHJ1ZVxuICAgIH07XG5cbiAgICB2YXIgY29kZVBvaW50cyA9IHB1bnljb2RlLnVjczIuZGVjb2RlKHN0cik7XG4gICAgdmFyIGNoYXJzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2RlUG9pbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjYyA9IGNvZGVQb2ludHNbaV07XG4gICAgICAgIHZhciBjID0gcHVueWNvZGUudWNzMi5lbmNvZGUoWyBjYyBdKTtcbiAgICAgICAgdmFyIGUgPSByZXZFbnRpdGllc1tjY107XG4gICAgICAgIGlmIChlICYmIChjYyA+PSAxMjcgfHwgc3BlY2lhbFtjXSkgJiYgIW51bWVyaWMpIHtcbiAgICAgICAgICAgIGNoYXJzLnB1c2goJyYnICsgKC87JC8udGVzdChlKSA/IGUgOiBlICsgJzsnKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY2MgPCAzMiB8fCBjYyA+PSAxMjcgfHwgc3BlY2lhbFtjXSkge1xuICAgICAgICAgICAgY2hhcnMucHVzaCgnJiMnICsgY2MgKyAnOycpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY2hhcnMucHVzaChjKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY2hhcnMuam9pbignJyk7XG59XG4iLCJtb2R1bGUuZXhwb3J0cz17XG4gICAgXCI5XCI6IFwiVGFiO1wiLFxuICAgIFwiMTBcIjogXCJOZXdMaW5lO1wiLFxuICAgIFwiMzNcIjogXCJleGNsO1wiLFxuICAgIFwiMzRcIjogXCJxdW90O1wiLFxuICAgIFwiMzVcIjogXCJudW07XCIsXG4gICAgXCIzNlwiOiBcImRvbGxhcjtcIixcbiAgICBcIjM3XCI6IFwicGVyY250O1wiLFxuICAgIFwiMzhcIjogXCJhbXA7XCIsXG4gICAgXCIzOVwiOiBcImFwb3M7XCIsXG4gICAgXCI0MFwiOiBcImxwYXI7XCIsXG4gICAgXCI0MVwiOiBcInJwYXI7XCIsXG4gICAgXCI0MlwiOiBcIm1pZGFzdDtcIixcbiAgICBcIjQzXCI6IFwicGx1cztcIixcbiAgICBcIjQ0XCI6IFwiY29tbWE7XCIsXG4gICAgXCI0NlwiOiBcInBlcmlvZDtcIixcbiAgICBcIjQ3XCI6IFwic29sO1wiLFxuICAgIFwiNThcIjogXCJjb2xvbjtcIixcbiAgICBcIjU5XCI6IFwic2VtaTtcIixcbiAgICBcIjYwXCI6IFwibHQ7XCIsXG4gICAgXCI2MVwiOiBcImVxdWFscztcIixcbiAgICBcIjYyXCI6IFwiZ3Q7XCIsXG4gICAgXCI2M1wiOiBcInF1ZXN0O1wiLFxuICAgIFwiNjRcIjogXCJjb21tYXQ7XCIsXG4gICAgXCI5MVwiOiBcImxzcWI7XCIsXG4gICAgXCI5MlwiOiBcImJzb2w7XCIsXG4gICAgXCI5M1wiOiBcInJzcWI7XCIsXG4gICAgXCI5NFwiOiBcIkhhdDtcIixcbiAgICBcIjk1XCI6IFwiVW5kZXJCYXI7XCIsXG4gICAgXCI5NlwiOiBcImdyYXZlO1wiLFxuICAgIFwiMTIzXCI6IFwibGN1YjtcIixcbiAgICBcIjEyNFwiOiBcIlZlcnRpY2FsTGluZTtcIixcbiAgICBcIjEyNVwiOiBcInJjdWI7XCIsXG4gICAgXCIxNjBcIjogXCJOb25CcmVha2luZ1NwYWNlO1wiLFxuICAgIFwiMTYxXCI6IFwiaWV4Y2w7XCIsXG4gICAgXCIxNjJcIjogXCJjZW50O1wiLFxuICAgIFwiMTYzXCI6IFwicG91bmQ7XCIsXG4gICAgXCIxNjRcIjogXCJjdXJyZW47XCIsXG4gICAgXCIxNjVcIjogXCJ5ZW47XCIsXG4gICAgXCIxNjZcIjogXCJicnZiYXI7XCIsXG4gICAgXCIxNjdcIjogXCJzZWN0O1wiLFxuICAgIFwiMTY4XCI6IFwidW1sO1wiLFxuICAgIFwiMTY5XCI6IFwiY29weTtcIixcbiAgICBcIjE3MFwiOiBcIm9yZGY7XCIsXG4gICAgXCIxNzFcIjogXCJsYXF1bztcIixcbiAgICBcIjE3MlwiOiBcIm5vdDtcIixcbiAgICBcIjE3M1wiOiBcInNoeTtcIixcbiAgICBcIjE3NFwiOiBcInJlZztcIixcbiAgICBcIjE3NVwiOiBcInN0cm5zO1wiLFxuICAgIFwiMTc2XCI6IFwiZGVnO1wiLFxuICAgIFwiMTc3XCI6IFwicG07XCIsXG4gICAgXCIxNzhcIjogXCJzdXAyO1wiLFxuICAgIFwiMTc5XCI6IFwic3VwMztcIixcbiAgICBcIjE4MFwiOiBcIkRpYWNyaXRpY2FsQWN1dGU7XCIsXG4gICAgXCIxODFcIjogXCJtaWNybztcIixcbiAgICBcIjE4MlwiOiBcInBhcmE7XCIsXG4gICAgXCIxODNcIjogXCJtaWRkb3Q7XCIsXG4gICAgXCIxODRcIjogXCJDZWRpbGxhO1wiLFxuICAgIFwiMTg1XCI6IFwic3VwMTtcIixcbiAgICBcIjE4NlwiOiBcIm9yZG07XCIsXG4gICAgXCIxODdcIjogXCJyYXF1bztcIixcbiAgICBcIjE4OFwiOiBcImZyYWMxNDtcIixcbiAgICBcIjE4OVwiOiBcImhhbGY7XCIsXG4gICAgXCIxOTBcIjogXCJmcmFjMzQ7XCIsXG4gICAgXCIxOTFcIjogXCJpcXVlc3Q7XCIsXG4gICAgXCIxOTJcIjogXCJBZ3JhdmU7XCIsXG4gICAgXCIxOTNcIjogXCJBYWN1dGU7XCIsXG4gICAgXCIxOTRcIjogXCJBY2lyYztcIixcbiAgICBcIjE5NVwiOiBcIkF0aWxkZTtcIixcbiAgICBcIjE5NlwiOiBcIkF1bWw7XCIsXG4gICAgXCIxOTdcIjogXCJBcmluZztcIixcbiAgICBcIjE5OFwiOiBcIkFFbGlnO1wiLFxuICAgIFwiMTk5XCI6IFwiQ2NlZGlsO1wiLFxuICAgIFwiMjAwXCI6IFwiRWdyYXZlO1wiLFxuICAgIFwiMjAxXCI6IFwiRWFjdXRlO1wiLFxuICAgIFwiMjAyXCI6IFwiRWNpcmM7XCIsXG4gICAgXCIyMDNcIjogXCJFdW1sO1wiLFxuICAgIFwiMjA0XCI6IFwiSWdyYXZlO1wiLFxuICAgIFwiMjA1XCI6IFwiSWFjdXRlO1wiLFxuICAgIFwiMjA2XCI6IFwiSWNpcmM7XCIsXG4gICAgXCIyMDdcIjogXCJJdW1sO1wiLFxuICAgIFwiMjA4XCI6IFwiRVRIO1wiLFxuICAgIFwiMjA5XCI6IFwiTnRpbGRlO1wiLFxuICAgIFwiMjEwXCI6IFwiT2dyYXZlO1wiLFxuICAgIFwiMjExXCI6IFwiT2FjdXRlO1wiLFxuICAgIFwiMjEyXCI6IFwiT2NpcmM7XCIsXG4gICAgXCIyMTNcIjogXCJPdGlsZGU7XCIsXG4gICAgXCIyMTRcIjogXCJPdW1sO1wiLFxuICAgIFwiMjE1XCI6IFwidGltZXM7XCIsXG4gICAgXCIyMTZcIjogXCJPc2xhc2g7XCIsXG4gICAgXCIyMTdcIjogXCJVZ3JhdmU7XCIsXG4gICAgXCIyMThcIjogXCJVYWN1dGU7XCIsXG4gICAgXCIyMTlcIjogXCJVY2lyYztcIixcbiAgICBcIjIyMFwiOiBcIlV1bWw7XCIsXG4gICAgXCIyMjFcIjogXCJZYWN1dGU7XCIsXG4gICAgXCIyMjJcIjogXCJUSE9STjtcIixcbiAgICBcIjIyM1wiOiBcInN6bGlnO1wiLFxuICAgIFwiMjI0XCI6IFwiYWdyYXZlO1wiLFxuICAgIFwiMjI1XCI6IFwiYWFjdXRlO1wiLFxuICAgIFwiMjI2XCI6IFwiYWNpcmM7XCIsXG4gICAgXCIyMjdcIjogXCJhdGlsZGU7XCIsXG4gICAgXCIyMjhcIjogXCJhdW1sO1wiLFxuICAgIFwiMjI5XCI6IFwiYXJpbmc7XCIsXG4gICAgXCIyMzBcIjogXCJhZWxpZztcIixcbiAgICBcIjIzMVwiOiBcImNjZWRpbDtcIixcbiAgICBcIjIzMlwiOiBcImVncmF2ZTtcIixcbiAgICBcIjIzM1wiOiBcImVhY3V0ZTtcIixcbiAgICBcIjIzNFwiOiBcImVjaXJjO1wiLFxuICAgIFwiMjM1XCI6IFwiZXVtbDtcIixcbiAgICBcIjIzNlwiOiBcImlncmF2ZTtcIixcbiAgICBcIjIzN1wiOiBcImlhY3V0ZTtcIixcbiAgICBcIjIzOFwiOiBcImljaXJjO1wiLFxuICAgIFwiMjM5XCI6IFwiaXVtbDtcIixcbiAgICBcIjI0MFwiOiBcImV0aDtcIixcbiAgICBcIjI0MVwiOiBcIm50aWxkZTtcIixcbiAgICBcIjI0MlwiOiBcIm9ncmF2ZTtcIixcbiAgICBcIjI0M1wiOiBcIm9hY3V0ZTtcIixcbiAgICBcIjI0NFwiOiBcIm9jaXJjO1wiLFxuICAgIFwiMjQ1XCI6IFwib3RpbGRlO1wiLFxuICAgIFwiMjQ2XCI6IFwib3VtbDtcIixcbiAgICBcIjI0N1wiOiBcImRpdmlkZTtcIixcbiAgICBcIjI0OFwiOiBcIm9zbGFzaDtcIixcbiAgICBcIjI0OVwiOiBcInVncmF2ZTtcIixcbiAgICBcIjI1MFwiOiBcInVhY3V0ZTtcIixcbiAgICBcIjI1MVwiOiBcInVjaXJjO1wiLFxuICAgIFwiMjUyXCI6IFwidXVtbDtcIixcbiAgICBcIjI1M1wiOiBcInlhY3V0ZTtcIixcbiAgICBcIjI1NFwiOiBcInRob3JuO1wiLFxuICAgIFwiMjU1XCI6IFwieXVtbDtcIixcbiAgICBcIjI1NlwiOiBcIkFtYWNyO1wiLFxuICAgIFwiMjU3XCI6IFwiYW1hY3I7XCIsXG4gICAgXCIyNThcIjogXCJBYnJldmU7XCIsXG4gICAgXCIyNTlcIjogXCJhYnJldmU7XCIsXG4gICAgXCIyNjBcIjogXCJBb2dvbjtcIixcbiAgICBcIjI2MVwiOiBcImFvZ29uO1wiLFxuICAgIFwiMjYyXCI6IFwiQ2FjdXRlO1wiLFxuICAgIFwiMjYzXCI6IFwiY2FjdXRlO1wiLFxuICAgIFwiMjY0XCI6IFwiQ2NpcmM7XCIsXG4gICAgXCIyNjVcIjogXCJjY2lyYztcIixcbiAgICBcIjI2NlwiOiBcIkNkb3Q7XCIsXG4gICAgXCIyNjdcIjogXCJjZG90O1wiLFxuICAgIFwiMjY4XCI6IFwiQ2Nhcm9uO1wiLFxuICAgIFwiMjY5XCI6IFwiY2Nhcm9uO1wiLFxuICAgIFwiMjcwXCI6IFwiRGNhcm9uO1wiLFxuICAgIFwiMjcxXCI6IFwiZGNhcm9uO1wiLFxuICAgIFwiMjcyXCI6IFwiRHN0cm9rO1wiLFxuICAgIFwiMjczXCI6IFwiZHN0cm9rO1wiLFxuICAgIFwiMjc0XCI6IFwiRW1hY3I7XCIsXG4gICAgXCIyNzVcIjogXCJlbWFjcjtcIixcbiAgICBcIjI3OFwiOiBcIkVkb3Q7XCIsXG4gICAgXCIyNzlcIjogXCJlZG90O1wiLFxuICAgIFwiMjgwXCI6IFwiRW9nb247XCIsXG4gICAgXCIyODFcIjogXCJlb2dvbjtcIixcbiAgICBcIjI4MlwiOiBcIkVjYXJvbjtcIixcbiAgICBcIjI4M1wiOiBcImVjYXJvbjtcIixcbiAgICBcIjI4NFwiOiBcIkdjaXJjO1wiLFxuICAgIFwiMjg1XCI6IFwiZ2NpcmM7XCIsXG4gICAgXCIyODZcIjogXCJHYnJldmU7XCIsXG4gICAgXCIyODdcIjogXCJnYnJldmU7XCIsXG4gICAgXCIyODhcIjogXCJHZG90O1wiLFxuICAgIFwiMjg5XCI6IFwiZ2RvdDtcIixcbiAgICBcIjI5MFwiOiBcIkdjZWRpbDtcIixcbiAgICBcIjI5MlwiOiBcIkhjaXJjO1wiLFxuICAgIFwiMjkzXCI6IFwiaGNpcmM7XCIsXG4gICAgXCIyOTRcIjogXCJIc3Ryb2s7XCIsXG4gICAgXCIyOTVcIjogXCJoc3Ryb2s7XCIsXG4gICAgXCIyOTZcIjogXCJJdGlsZGU7XCIsXG4gICAgXCIyOTdcIjogXCJpdGlsZGU7XCIsXG4gICAgXCIyOThcIjogXCJJbWFjcjtcIixcbiAgICBcIjI5OVwiOiBcImltYWNyO1wiLFxuICAgIFwiMzAyXCI6IFwiSW9nb247XCIsXG4gICAgXCIzMDNcIjogXCJpb2dvbjtcIixcbiAgICBcIjMwNFwiOiBcIklkb3Q7XCIsXG4gICAgXCIzMDVcIjogXCJpbm9kb3Q7XCIsXG4gICAgXCIzMDZcIjogXCJJSmxpZztcIixcbiAgICBcIjMwN1wiOiBcImlqbGlnO1wiLFxuICAgIFwiMzA4XCI6IFwiSmNpcmM7XCIsXG4gICAgXCIzMDlcIjogXCJqY2lyYztcIixcbiAgICBcIjMxMFwiOiBcIktjZWRpbDtcIixcbiAgICBcIjMxMVwiOiBcImtjZWRpbDtcIixcbiAgICBcIjMxMlwiOiBcImtncmVlbjtcIixcbiAgICBcIjMxM1wiOiBcIkxhY3V0ZTtcIixcbiAgICBcIjMxNFwiOiBcImxhY3V0ZTtcIixcbiAgICBcIjMxNVwiOiBcIkxjZWRpbDtcIixcbiAgICBcIjMxNlwiOiBcImxjZWRpbDtcIixcbiAgICBcIjMxN1wiOiBcIkxjYXJvbjtcIixcbiAgICBcIjMxOFwiOiBcImxjYXJvbjtcIixcbiAgICBcIjMxOVwiOiBcIkxtaWRvdDtcIixcbiAgICBcIjMyMFwiOiBcImxtaWRvdDtcIixcbiAgICBcIjMyMVwiOiBcIkxzdHJvaztcIixcbiAgICBcIjMyMlwiOiBcImxzdHJvaztcIixcbiAgICBcIjMyM1wiOiBcIk5hY3V0ZTtcIixcbiAgICBcIjMyNFwiOiBcIm5hY3V0ZTtcIixcbiAgICBcIjMyNVwiOiBcIk5jZWRpbDtcIixcbiAgICBcIjMyNlwiOiBcIm5jZWRpbDtcIixcbiAgICBcIjMyN1wiOiBcIk5jYXJvbjtcIixcbiAgICBcIjMyOFwiOiBcIm5jYXJvbjtcIixcbiAgICBcIjMyOVwiOiBcIm5hcG9zO1wiLFxuICAgIFwiMzMwXCI6IFwiRU5HO1wiLFxuICAgIFwiMzMxXCI6IFwiZW5nO1wiLFxuICAgIFwiMzMyXCI6IFwiT21hY3I7XCIsXG4gICAgXCIzMzNcIjogXCJvbWFjcjtcIixcbiAgICBcIjMzNlwiOiBcIk9kYmxhYztcIixcbiAgICBcIjMzN1wiOiBcIm9kYmxhYztcIixcbiAgICBcIjMzOFwiOiBcIk9FbGlnO1wiLFxuICAgIFwiMzM5XCI6IFwib2VsaWc7XCIsXG4gICAgXCIzNDBcIjogXCJSYWN1dGU7XCIsXG4gICAgXCIzNDFcIjogXCJyYWN1dGU7XCIsXG4gICAgXCIzNDJcIjogXCJSY2VkaWw7XCIsXG4gICAgXCIzNDNcIjogXCJyY2VkaWw7XCIsXG4gICAgXCIzNDRcIjogXCJSY2Fyb247XCIsXG4gICAgXCIzNDVcIjogXCJyY2Fyb247XCIsXG4gICAgXCIzNDZcIjogXCJTYWN1dGU7XCIsXG4gICAgXCIzNDdcIjogXCJzYWN1dGU7XCIsXG4gICAgXCIzNDhcIjogXCJTY2lyYztcIixcbiAgICBcIjM0OVwiOiBcInNjaXJjO1wiLFxuICAgIFwiMzUwXCI6IFwiU2NlZGlsO1wiLFxuICAgIFwiMzUxXCI6IFwic2NlZGlsO1wiLFxuICAgIFwiMzUyXCI6IFwiU2Nhcm9uO1wiLFxuICAgIFwiMzUzXCI6IFwic2Nhcm9uO1wiLFxuICAgIFwiMzU0XCI6IFwiVGNlZGlsO1wiLFxuICAgIFwiMzU1XCI6IFwidGNlZGlsO1wiLFxuICAgIFwiMzU2XCI6IFwiVGNhcm9uO1wiLFxuICAgIFwiMzU3XCI6IFwidGNhcm9uO1wiLFxuICAgIFwiMzU4XCI6IFwiVHN0cm9rO1wiLFxuICAgIFwiMzU5XCI6IFwidHN0cm9rO1wiLFxuICAgIFwiMzYwXCI6IFwiVXRpbGRlO1wiLFxuICAgIFwiMzYxXCI6IFwidXRpbGRlO1wiLFxuICAgIFwiMzYyXCI6IFwiVW1hY3I7XCIsXG4gICAgXCIzNjNcIjogXCJ1bWFjcjtcIixcbiAgICBcIjM2NFwiOiBcIlVicmV2ZTtcIixcbiAgICBcIjM2NVwiOiBcInVicmV2ZTtcIixcbiAgICBcIjM2NlwiOiBcIlVyaW5nO1wiLFxuICAgIFwiMzY3XCI6IFwidXJpbmc7XCIsXG4gICAgXCIzNjhcIjogXCJVZGJsYWM7XCIsXG4gICAgXCIzNjlcIjogXCJ1ZGJsYWM7XCIsXG4gICAgXCIzNzBcIjogXCJVb2dvbjtcIixcbiAgICBcIjM3MVwiOiBcInVvZ29uO1wiLFxuICAgIFwiMzcyXCI6IFwiV2NpcmM7XCIsXG4gICAgXCIzNzNcIjogXCJ3Y2lyYztcIixcbiAgICBcIjM3NFwiOiBcIlljaXJjO1wiLFxuICAgIFwiMzc1XCI6IFwieWNpcmM7XCIsXG4gICAgXCIzNzZcIjogXCJZdW1sO1wiLFxuICAgIFwiMzc3XCI6IFwiWmFjdXRlO1wiLFxuICAgIFwiMzc4XCI6IFwiemFjdXRlO1wiLFxuICAgIFwiMzc5XCI6IFwiWmRvdDtcIixcbiAgICBcIjM4MFwiOiBcInpkb3Q7XCIsXG4gICAgXCIzODFcIjogXCJaY2Fyb247XCIsXG4gICAgXCIzODJcIjogXCJ6Y2Fyb247XCIsXG4gICAgXCI0MDJcIjogXCJmbm9mO1wiLFxuICAgIFwiNDM3XCI6IFwiaW1wZWQ7XCIsXG4gICAgXCI1MDFcIjogXCJnYWN1dGU7XCIsXG4gICAgXCI1NjdcIjogXCJqbWF0aDtcIixcbiAgICBcIjcxMFwiOiBcImNpcmM7XCIsXG4gICAgXCI3MTFcIjogXCJIYWNlaztcIixcbiAgICBcIjcyOFwiOiBcImJyZXZlO1wiLFxuICAgIFwiNzI5XCI6IFwiZG90O1wiLFxuICAgIFwiNzMwXCI6IFwicmluZztcIixcbiAgICBcIjczMVwiOiBcIm9nb247XCIsXG4gICAgXCI3MzJcIjogXCJ0aWxkZTtcIixcbiAgICBcIjczM1wiOiBcIkRpYWNyaXRpY2FsRG91YmxlQWN1dGU7XCIsXG4gICAgXCI3ODVcIjogXCJEb3duQnJldmU7XCIsXG4gICAgXCI5MTNcIjogXCJBbHBoYTtcIixcbiAgICBcIjkxNFwiOiBcIkJldGE7XCIsXG4gICAgXCI5MTVcIjogXCJHYW1tYTtcIixcbiAgICBcIjkxNlwiOiBcIkRlbHRhO1wiLFxuICAgIFwiOTE3XCI6IFwiRXBzaWxvbjtcIixcbiAgICBcIjkxOFwiOiBcIlpldGE7XCIsXG4gICAgXCI5MTlcIjogXCJFdGE7XCIsXG4gICAgXCI5MjBcIjogXCJUaGV0YTtcIixcbiAgICBcIjkyMVwiOiBcIklvdGE7XCIsXG4gICAgXCI5MjJcIjogXCJLYXBwYTtcIixcbiAgICBcIjkyM1wiOiBcIkxhbWJkYTtcIixcbiAgICBcIjkyNFwiOiBcIk11O1wiLFxuICAgIFwiOTI1XCI6IFwiTnU7XCIsXG4gICAgXCI5MjZcIjogXCJYaTtcIixcbiAgICBcIjkyN1wiOiBcIk9taWNyb247XCIsXG4gICAgXCI5MjhcIjogXCJQaTtcIixcbiAgICBcIjkyOVwiOiBcIlJobztcIixcbiAgICBcIjkzMVwiOiBcIlNpZ21hO1wiLFxuICAgIFwiOTMyXCI6IFwiVGF1O1wiLFxuICAgIFwiOTMzXCI6IFwiVXBzaWxvbjtcIixcbiAgICBcIjkzNFwiOiBcIlBoaTtcIixcbiAgICBcIjkzNVwiOiBcIkNoaTtcIixcbiAgICBcIjkzNlwiOiBcIlBzaTtcIixcbiAgICBcIjkzN1wiOiBcIk9tZWdhO1wiLFxuICAgIFwiOTQ1XCI6IFwiYWxwaGE7XCIsXG4gICAgXCI5NDZcIjogXCJiZXRhO1wiLFxuICAgIFwiOTQ3XCI6IFwiZ2FtbWE7XCIsXG4gICAgXCI5NDhcIjogXCJkZWx0YTtcIixcbiAgICBcIjk0OVwiOiBcImVwc2lsb247XCIsXG4gICAgXCI5NTBcIjogXCJ6ZXRhO1wiLFxuICAgIFwiOTUxXCI6IFwiZXRhO1wiLFxuICAgIFwiOTUyXCI6IFwidGhldGE7XCIsXG4gICAgXCI5NTNcIjogXCJpb3RhO1wiLFxuICAgIFwiOTU0XCI6IFwia2FwcGE7XCIsXG4gICAgXCI5NTVcIjogXCJsYW1iZGE7XCIsXG4gICAgXCI5NTZcIjogXCJtdTtcIixcbiAgICBcIjk1N1wiOiBcIm51O1wiLFxuICAgIFwiOTU4XCI6IFwieGk7XCIsXG4gICAgXCI5NTlcIjogXCJvbWljcm9uO1wiLFxuICAgIFwiOTYwXCI6IFwicGk7XCIsXG4gICAgXCI5NjFcIjogXCJyaG87XCIsXG4gICAgXCI5NjJcIjogXCJ2YXJzaWdtYTtcIixcbiAgICBcIjk2M1wiOiBcInNpZ21hO1wiLFxuICAgIFwiOTY0XCI6IFwidGF1O1wiLFxuICAgIFwiOTY1XCI6IFwidXBzaWxvbjtcIixcbiAgICBcIjk2NlwiOiBcInBoaTtcIixcbiAgICBcIjk2N1wiOiBcImNoaTtcIixcbiAgICBcIjk2OFwiOiBcInBzaTtcIixcbiAgICBcIjk2OVwiOiBcIm9tZWdhO1wiLFxuICAgIFwiOTc3XCI6IFwidmFydGhldGE7XCIsXG4gICAgXCI5NzhcIjogXCJ1cHNpaDtcIixcbiAgICBcIjk4MVwiOiBcInZhcnBoaTtcIixcbiAgICBcIjk4MlwiOiBcInZhcnBpO1wiLFxuICAgIFwiOTg4XCI6IFwiR2FtbWFkO1wiLFxuICAgIFwiOTg5XCI6IFwiZ2FtbWFkO1wiLFxuICAgIFwiMTAwOFwiOiBcInZhcmthcHBhO1wiLFxuICAgIFwiMTAwOVwiOiBcInZhcnJobztcIixcbiAgICBcIjEwMTNcIjogXCJ2YXJlcHNpbG9uO1wiLFxuICAgIFwiMTAxNFwiOiBcImJlcHNpO1wiLFxuICAgIFwiMTAyNVwiOiBcIklPY3k7XCIsXG4gICAgXCIxMDI2XCI6IFwiREpjeTtcIixcbiAgICBcIjEwMjdcIjogXCJHSmN5O1wiLFxuICAgIFwiMTAyOFwiOiBcIkp1a2N5O1wiLFxuICAgIFwiMTAyOVwiOiBcIkRTY3k7XCIsXG4gICAgXCIxMDMwXCI6IFwiSXVrY3k7XCIsXG4gICAgXCIxMDMxXCI6IFwiWUljeTtcIixcbiAgICBcIjEwMzJcIjogXCJKc2VyY3k7XCIsXG4gICAgXCIxMDMzXCI6IFwiTEpjeTtcIixcbiAgICBcIjEwMzRcIjogXCJOSmN5O1wiLFxuICAgIFwiMTAzNVwiOiBcIlRTSGN5O1wiLFxuICAgIFwiMTAzNlwiOiBcIktKY3k7XCIsXG4gICAgXCIxMDM4XCI6IFwiVWJyY3k7XCIsXG4gICAgXCIxMDM5XCI6IFwiRFpjeTtcIixcbiAgICBcIjEwNDBcIjogXCJBY3k7XCIsXG4gICAgXCIxMDQxXCI6IFwiQmN5O1wiLFxuICAgIFwiMTA0MlwiOiBcIlZjeTtcIixcbiAgICBcIjEwNDNcIjogXCJHY3k7XCIsXG4gICAgXCIxMDQ0XCI6IFwiRGN5O1wiLFxuICAgIFwiMTA0NVwiOiBcIklFY3k7XCIsXG4gICAgXCIxMDQ2XCI6IFwiWkhjeTtcIixcbiAgICBcIjEwNDdcIjogXCJaY3k7XCIsXG4gICAgXCIxMDQ4XCI6IFwiSWN5O1wiLFxuICAgIFwiMTA0OVwiOiBcIkpjeTtcIixcbiAgICBcIjEwNTBcIjogXCJLY3k7XCIsXG4gICAgXCIxMDUxXCI6IFwiTGN5O1wiLFxuICAgIFwiMTA1MlwiOiBcIk1jeTtcIixcbiAgICBcIjEwNTNcIjogXCJOY3k7XCIsXG4gICAgXCIxMDU0XCI6IFwiT2N5O1wiLFxuICAgIFwiMTA1NVwiOiBcIlBjeTtcIixcbiAgICBcIjEwNTZcIjogXCJSY3k7XCIsXG4gICAgXCIxMDU3XCI6IFwiU2N5O1wiLFxuICAgIFwiMTA1OFwiOiBcIlRjeTtcIixcbiAgICBcIjEwNTlcIjogXCJVY3k7XCIsXG4gICAgXCIxMDYwXCI6IFwiRmN5O1wiLFxuICAgIFwiMTA2MVwiOiBcIktIY3k7XCIsXG4gICAgXCIxMDYyXCI6IFwiVFNjeTtcIixcbiAgICBcIjEwNjNcIjogXCJDSGN5O1wiLFxuICAgIFwiMTA2NFwiOiBcIlNIY3k7XCIsXG4gICAgXCIxMDY1XCI6IFwiU0hDSGN5O1wiLFxuICAgIFwiMTA2NlwiOiBcIkhBUkRjeTtcIixcbiAgICBcIjEwNjdcIjogXCJZY3k7XCIsXG4gICAgXCIxMDY4XCI6IFwiU09GVGN5O1wiLFxuICAgIFwiMTA2OVwiOiBcIkVjeTtcIixcbiAgICBcIjEwNzBcIjogXCJZVWN5O1wiLFxuICAgIFwiMTA3MVwiOiBcIllBY3k7XCIsXG4gICAgXCIxMDcyXCI6IFwiYWN5O1wiLFxuICAgIFwiMTA3M1wiOiBcImJjeTtcIixcbiAgICBcIjEwNzRcIjogXCJ2Y3k7XCIsXG4gICAgXCIxMDc1XCI6IFwiZ2N5O1wiLFxuICAgIFwiMTA3NlwiOiBcImRjeTtcIixcbiAgICBcIjEwNzdcIjogXCJpZWN5O1wiLFxuICAgIFwiMTA3OFwiOiBcInpoY3k7XCIsXG4gICAgXCIxMDc5XCI6IFwiemN5O1wiLFxuICAgIFwiMTA4MFwiOiBcImljeTtcIixcbiAgICBcIjEwODFcIjogXCJqY3k7XCIsXG4gICAgXCIxMDgyXCI6IFwia2N5O1wiLFxuICAgIFwiMTA4M1wiOiBcImxjeTtcIixcbiAgICBcIjEwODRcIjogXCJtY3k7XCIsXG4gICAgXCIxMDg1XCI6IFwibmN5O1wiLFxuICAgIFwiMTA4NlwiOiBcIm9jeTtcIixcbiAgICBcIjEwODdcIjogXCJwY3k7XCIsXG4gICAgXCIxMDg4XCI6IFwicmN5O1wiLFxuICAgIFwiMTA4OVwiOiBcInNjeTtcIixcbiAgICBcIjEwOTBcIjogXCJ0Y3k7XCIsXG4gICAgXCIxMDkxXCI6IFwidWN5O1wiLFxuICAgIFwiMTA5MlwiOiBcImZjeTtcIixcbiAgICBcIjEwOTNcIjogXCJraGN5O1wiLFxuICAgIFwiMTA5NFwiOiBcInRzY3k7XCIsXG4gICAgXCIxMDk1XCI6IFwiY2hjeTtcIixcbiAgICBcIjEwOTZcIjogXCJzaGN5O1wiLFxuICAgIFwiMTA5N1wiOiBcInNoY2hjeTtcIixcbiAgICBcIjEwOThcIjogXCJoYXJkY3k7XCIsXG4gICAgXCIxMDk5XCI6IFwieWN5O1wiLFxuICAgIFwiMTEwMFwiOiBcInNvZnRjeTtcIixcbiAgICBcIjExMDFcIjogXCJlY3k7XCIsXG4gICAgXCIxMTAyXCI6IFwieXVjeTtcIixcbiAgICBcIjExMDNcIjogXCJ5YWN5O1wiLFxuICAgIFwiMTEwNVwiOiBcImlvY3k7XCIsXG4gICAgXCIxMTA2XCI6IFwiZGpjeTtcIixcbiAgICBcIjExMDdcIjogXCJnamN5O1wiLFxuICAgIFwiMTEwOFwiOiBcImp1a2N5O1wiLFxuICAgIFwiMTEwOVwiOiBcImRzY3k7XCIsXG4gICAgXCIxMTEwXCI6IFwiaXVrY3k7XCIsXG4gICAgXCIxMTExXCI6IFwieWljeTtcIixcbiAgICBcIjExMTJcIjogXCJqc2VyY3k7XCIsXG4gICAgXCIxMTEzXCI6IFwibGpjeTtcIixcbiAgICBcIjExMTRcIjogXCJuamN5O1wiLFxuICAgIFwiMTExNVwiOiBcInRzaGN5O1wiLFxuICAgIFwiMTExNlwiOiBcImtqY3k7XCIsXG4gICAgXCIxMTE4XCI6IFwidWJyY3k7XCIsXG4gICAgXCIxMTE5XCI6IFwiZHpjeTtcIixcbiAgICBcIjgxOTRcIjogXCJlbnNwO1wiLFxuICAgIFwiODE5NVwiOiBcImVtc3A7XCIsXG4gICAgXCI4MTk2XCI6IFwiZW1zcDEzO1wiLFxuICAgIFwiODE5N1wiOiBcImVtc3AxNDtcIixcbiAgICBcIjgxOTlcIjogXCJudW1zcDtcIixcbiAgICBcIjgyMDBcIjogXCJwdW5jc3A7XCIsXG4gICAgXCI4MjAxXCI6IFwiVGhpblNwYWNlO1wiLFxuICAgIFwiODIwMlwiOiBcIlZlcnlUaGluU3BhY2U7XCIsXG4gICAgXCI4MjAzXCI6IFwiWmVyb1dpZHRoU3BhY2U7XCIsXG4gICAgXCI4MjA0XCI6IFwienduajtcIixcbiAgICBcIjgyMDVcIjogXCJ6d2o7XCIsXG4gICAgXCI4MjA2XCI6IFwibHJtO1wiLFxuICAgIFwiODIwN1wiOiBcInJsbTtcIixcbiAgICBcIjgyMDhcIjogXCJoeXBoZW47XCIsXG4gICAgXCI4MjExXCI6IFwibmRhc2g7XCIsXG4gICAgXCI4MjEyXCI6IFwibWRhc2g7XCIsXG4gICAgXCI4MjEzXCI6IFwiaG9yYmFyO1wiLFxuICAgIFwiODIxNFwiOiBcIlZlcnQ7XCIsXG4gICAgXCI4MjE2XCI6IFwiT3BlbkN1cmx5UXVvdGU7XCIsXG4gICAgXCI4MjE3XCI6IFwicnNxdW9yO1wiLFxuICAgIFwiODIxOFwiOiBcInNicXVvO1wiLFxuICAgIFwiODIyMFwiOiBcIk9wZW5DdXJseURvdWJsZVF1b3RlO1wiLFxuICAgIFwiODIyMVwiOiBcInJkcXVvcjtcIixcbiAgICBcIjgyMjJcIjogXCJsZHF1b3I7XCIsXG4gICAgXCI4MjI0XCI6IFwiZGFnZ2VyO1wiLFxuICAgIFwiODIyNVwiOiBcImRkYWdnZXI7XCIsXG4gICAgXCI4MjI2XCI6IFwiYnVsbGV0O1wiLFxuICAgIFwiODIyOVwiOiBcIm5sZHI7XCIsXG4gICAgXCI4MjMwXCI6IFwibWxkcjtcIixcbiAgICBcIjgyNDBcIjogXCJwZXJtaWw7XCIsXG4gICAgXCI4MjQxXCI6IFwicGVydGVuaztcIixcbiAgICBcIjgyNDJcIjogXCJwcmltZTtcIixcbiAgICBcIjgyNDNcIjogXCJQcmltZTtcIixcbiAgICBcIjgyNDRcIjogXCJ0cHJpbWU7XCIsXG4gICAgXCI4MjQ1XCI6IFwiYnByaW1lO1wiLFxuICAgIFwiODI0OVwiOiBcImxzYXF1bztcIixcbiAgICBcIjgyNTBcIjogXCJyc2FxdW87XCIsXG4gICAgXCI4MjU0XCI6IFwiT3ZlckJhcjtcIixcbiAgICBcIjgyNTdcIjogXCJjYXJldDtcIixcbiAgICBcIjgyNTlcIjogXCJoeWJ1bGw7XCIsXG4gICAgXCI4MjYwXCI6IFwiZnJhc2w7XCIsXG4gICAgXCI4MjcxXCI6IFwiYnNlbWk7XCIsXG4gICAgXCI4Mjc5XCI6IFwicXByaW1lO1wiLFxuICAgIFwiODI4N1wiOiBcIk1lZGl1bVNwYWNlO1wiLFxuICAgIFwiODI4OFwiOiBcIk5vQnJlYWs7XCIsXG4gICAgXCI4Mjg5XCI6IFwiQXBwbHlGdW5jdGlvbjtcIixcbiAgICBcIjgyOTBcIjogXCJpdDtcIixcbiAgICBcIjgyOTFcIjogXCJJbnZpc2libGVDb21tYTtcIixcbiAgICBcIjgzNjRcIjogXCJldXJvO1wiLFxuICAgIFwiODQxMVwiOiBcIlRyaXBsZURvdDtcIixcbiAgICBcIjg0MTJcIjogXCJEb3REb3Q7XCIsXG4gICAgXCI4NDUwXCI6IFwiQ29wZjtcIixcbiAgICBcIjg0NTNcIjogXCJpbmNhcmU7XCIsXG4gICAgXCI4NDU4XCI6IFwiZ3NjcjtcIixcbiAgICBcIjg0NTlcIjogXCJIc2NyO1wiLFxuICAgIFwiODQ2MFwiOiBcIlBvaW5jYXJlcGxhbmU7XCIsXG4gICAgXCI4NDYxXCI6IFwicXVhdGVybmlvbnM7XCIsXG4gICAgXCI4NDYyXCI6IFwicGxhbmNraDtcIixcbiAgICBcIjg0NjNcIjogXCJwbGFua3Y7XCIsXG4gICAgXCI4NDY0XCI6IFwiSXNjcjtcIixcbiAgICBcIjg0NjVcIjogXCJpbWFncGFydDtcIixcbiAgICBcIjg0NjZcIjogXCJMc2NyO1wiLFxuICAgIFwiODQ2N1wiOiBcImVsbDtcIixcbiAgICBcIjg0NjlcIjogXCJOb3BmO1wiLFxuICAgIFwiODQ3MFwiOiBcIm51bWVybztcIixcbiAgICBcIjg0NzFcIjogXCJjb3B5c3I7XCIsXG4gICAgXCI4NDcyXCI6IFwid3A7XCIsXG4gICAgXCI4NDczXCI6IFwicHJpbWVzO1wiLFxuICAgIFwiODQ3NFwiOiBcInJhdGlvbmFscztcIixcbiAgICBcIjg0NzVcIjogXCJSc2NyO1wiLFxuICAgIFwiODQ3NlwiOiBcIlJmcjtcIixcbiAgICBcIjg0NzdcIjogXCJSb3BmO1wiLFxuICAgIFwiODQ3OFwiOiBcInJ4O1wiLFxuICAgIFwiODQ4MlwiOiBcInRyYWRlO1wiLFxuICAgIFwiODQ4NFwiOiBcIlpvcGY7XCIsXG4gICAgXCI4NDg3XCI6IFwibWhvO1wiLFxuICAgIFwiODQ4OFwiOiBcIlpmcjtcIixcbiAgICBcIjg0ODlcIjogXCJpaW90YTtcIixcbiAgICBcIjg0OTJcIjogXCJCc2NyO1wiLFxuICAgIFwiODQ5M1wiOiBcIkNmcjtcIixcbiAgICBcIjg0OTVcIjogXCJlc2NyO1wiLFxuICAgIFwiODQ5NlwiOiBcImV4cGVjdGF0aW9uO1wiLFxuICAgIFwiODQ5N1wiOiBcIkZzY3I7XCIsXG4gICAgXCI4NDk5XCI6IFwicGhtbWF0O1wiLFxuICAgIFwiODUwMFwiOiBcIm9zY3I7XCIsXG4gICAgXCI4NTAxXCI6IFwiYWxlcGg7XCIsXG4gICAgXCI4NTAyXCI6IFwiYmV0aDtcIixcbiAgICBcIjg1MDNcIjogXCJnaW1lbDtcIixcbiAgICBcIjg1MDRcIjogXCJkYWxldGg7XCIsXG4gICAgXCI4NTE3XCI6IFwiREQ7XCIsXG4gICAgXCI4NTE4XCI6IFwiRGlmZmVyZW50aWFsRDtcIixcbiAgICBcIjg1MTlcIjogXCJleHBvbmVudGlhbGU7XCIsXG4gICAgXCI4NTIwXCI6IFwiSW1hZ2luYXJ5STtcIixcbiAgICBcIjg1MzFcIjogXCJmcmFjMTM7XCIsXG4gICAgXCI4NTMyXCI6IFwiZnJhYzIzO1wiLFxuICAgIFwiODUzM1wiOiBcImZyYWMxNTtcIixcbiAgICBcIjg1MzRcIjogXCJmcmFjMjU7XCIsXG4gICAgXCI4NTM1XCI6IFwiZnJhYzM1O1wiLFxuICAgIFwiODUzNlwiOiBcImZyYWM0NTtcIixcbiAgICBcIjg1MzdcIjogXCJmcmFjMTY7XCIsXG4gICAgXCI4NTM4XCI6IFwiZnJhYzU2O1wiLFxuICAgIFwiODUzOVwiOiBcImZyYWMxODtcIixcbiAgICBcIjg1NDBcIjogXCJmcmFjMzg7XCIsXG4gICAgXCI4NTQxXCI6IFwiZnJhYzU4O1wiLFxuICAgIFwiODU0MlwiOiBcImZyYWM3ODtcIixcbiAgICBcIjg1OTJcIjogXCJzbGFycjtcIixcbiAgICBcIjg1OTNcIjogXCJ1cGFycm93O1wiLFxuICAgIFwiODU5NFwiOiBcInNyYXJyO1wiLFxuICAgIFwiODU5NVwiOiBcIlNob3J0RG93bkFycm93O1wiLFxuICAgIFwiODU5NlwiOiBcImxlZnRyaWdodGFycm93O1wiLFxuICAgIFwiODU5N1wiOiBcInZhcnI7XCIsXG4gICAgXCI4NTk4XCI6IFwiVXBwZXJMZWZ0QXJyb3c7XCIsXG4gICAgXCI4NTk5XCI6IFwiVXBwZXJSaWdodEFycm93O1wiLFxuICAgIFwiODYwMFwiOiBcInNlYXJyb3c7XCIsXG4gICAgXCI4NjAxXCI6IFwic3dhcnJvdztcIixcbiAgICBcIjg2MDJcIjogXCJubGVmdGFycm93O1wiLFxuICAgIFwiODYwM1wiOiBcIm5yaWdodGFycm93O1wiLFxuICAgIFwiODYwNVwiOiBcInJpZ2h0c3F1aWdhcnJvdztcIixcbiAgICBcIjg2MDZcIjogXCJ0d29oZWFkbGVmdGFycm93O1wiLFxuICAgIFwiODYwN1wiOiBcIlVhcnI7XCIsXG4gICAgXCI4NjA4XCI6IFwidHdvaGVhZHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjA5XCI6IFwiRGFycjtcIixcbiAgICBcIjg2MTBcIjogXCJsZWZ0YXJyb3d0YWlsO1wiLFxuICAgIFwiODYxMVwiOiBcInJpZ2h0YXJyb3d0YWlsO1wiLFxuICAgIFwiODYxMlwiOiBcIm1hcHN0b2xlZnQ7XCIsXG4gICAgXCI4NjEzXCI6IFwiVXBUZWVBcnJvdztcIixcbiAgICBcIjg2MTRcIjogXCJSaWdodFRlZUFycm93O1wiLFxuICAgIFwiODYxNVwiOiBcIm1hcHN0b2Rvd247XCIsXG4gICAgXCI4NjE3XCI6IFwibGFycmhrO1wiLFxuICAgIFwiODYxOFwiOiBcInJhcnJoaztcIixcbiAgICBcIjg2MTlcIjogXCJsb29wYXJyb3dsZWZ0O1wiLFxuICAgIFwiODYyMFwiOiBcInJhcnJscDtcIixcbiAgICBcIjg2MjFcIjogXCJsZWZ0cmlnaHRzcXVpZ2Fycm93O1wiLFxuICAgIFwiODYyMlwiOiBcIm5sZWZ0cmlnaHRhcnJvdztcIixcbiAgICBcIjg2MjRcIjogXCJsc2g7XCIsXG4gICAgXCI4NjI1XCI6IFwicnNoO1wiLFxuICAgIFwiODYyNlwiOiBcImxkc2g7XCIsXG4gICAgXCI4NjI3XCI6IFwicmRzaDtcIixcbiAgICBcIjg2MjlcIjogXCJjcmFycjtcIixcbiAgICBcIjg2MzBcIjogXCJjdXJ2ZWFycm93bGVmdDtcIixcbiAgICBcIjg2MzFcIjogXCJjdXJ2ZWFycm93cmlnaHQ7XCIsXG4gICAgXCI4NjM0XCI6IFwib2xhcnI7XCIsXG4gICAgXCI4NjM1XCI6IFwib3JhcnI7XCIsXG4gICAgXCI4NjM2XCI6IFwibGhhcnU7XCIsXG4gICAgXCI4NjM3XCI6IFwibGhhcmQ7XCIsXG4gICAgXCI4NjM4XCI6IFwidXBoYXJwb29ucmlnaHQ7XCIsXG4gICAgXCI4NjM5XCI6IFwidXBoYXJwb29ubGVmdDtcIixcbiAgICBcIjg2NDBcIjogXCJSaWdodFZlY3RvcjtcIixcbiAgICBcIjg2NDFcIjogXCJyaWdodGhhcnBvb25kb3duO1wiLFxuICAgIFwiODY0MlwiOiBcIlJpZ2h0RG93blZlY3RvcjtcIixcbiAgICBcIjg2NDNcIjogXCJMZWZ0RG93blZlY3RvcjtcIixcbiAgICBcIjg2NDRcIjogXCJybGFycjtcIixcbiAgICBcIjg2NDVcIjogXCJVcEFycm93RG93bkFycm93O1wiLFxuICAgIFwiODY0NlwiOiBcImxyYXJyO1wiLFxuICAgIFwiODY0N1wiOiBcImxsYXJyO1wiLFxuICAgIFwiODY0OFwiOiBcInV1YXJyO1wiLFxuICAgIFwiODY0OVwiOiBcInJyYXJyO1wiLFxuICAgIFwiODY1MFwiOiBcImRvd25kb3duYXJyb3dzO1wiLFxuICAgIFwiODY1MVwiOiBcIlJldmVyc2VFcXVpbGlicml1bTtcIixcbiAgICBcIjg2NTJcIjogXCJybGhhcjtcIixcbiAgICBcIjg2NTNcIjogXCJuTGVmdGFycm93O1wiLFxuICAgIFwiODY1NFwiOiBcIm5MZWZ0cmlnaHRhcnJvdztcIixcbiAgICBcIjg2NTVcIjogXCJuUmlnaHRhcnJvdztcIixcbiAgICBcIjg2NTZcIjogXCJMZWZ0YXJyb3c7XCIsXG4gICAgXCI4NjU3XCI6IFwiVXBhcnJvdztcIixcbiAgICBcIjg2NThcIjogXCJSaWdodGFycm93O1wiLFxuICAgIFwiODY1OVwiOiBcIkRvd25hcnJvdztcIixcbiAgICBcIjg2NjBcIjogXCJMZWZ0cmlnaHRhcnJvdztcIixcbiAgICBcIjg2NjFcIjogXCJ2QXJyO1wiLFxuICAgIFwiODY2MlwiOiBcIm53QXJyO1wiLFxuICAgIFwiODY2M1wiOiBcIm5lQXJyO1wiLFxuICAgIFwiODY2NFwiOiBcInNlQXJyO1wiLFxuICAgIFwiODY2NVwiOiBcInN3QXJyO1wiLFxuICAgIFwiODY2NlwiOiBcIkxsZWZ0YXJyb3c7XCIsXG4gICAgXCI4NjY3XCI6IFwiUnJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjY5XCI6IFwiemlncmFycjtcIixcbiAgICBcIjg2NzZcIjogXCJMZWZ0QXJyb3dCYXI7XCIsXG4gICAgXCI4Njc3XCI6IFwiUmlnaHRBcnJvd0JhcjtcIixcbiAgICBcIjg2OTNcIjogXCJkdWFycjtcIixcbiAgICBcIjg3MDFcIjogXCJsb2FycjtcIixcbiAgICBcIjg3MDJcIjogXCJyb2FycjtcIixcbiAgICBcIjg3MDNcIjogXCJob2FycjtcIixcbiAgICBcIjg3MDRcIjogXCJmb3JhbGw7XCIsXG4gICAgXCI4NzA1XCI6IFwiY29tcGxlbWVudDtcIixcbiAgICBcIjg3MDZcIjogXCJQYXJ0aWFsRDtcIixcbiAgICBcIjg3MDdcIjogXCJFeGlzdHM7XCIsXG4gICAgXCI4NzA4XCI6IFwiTm90RXhpc3RzO1wiLFxuICAgIFwiODcwOVwiOiBcInZhcm5vdGhpbmc7XCIsXG4gICAgXCI4NzExXCI6IFwibmFibGE7XCIsXG4gICAgXCI4NzEyXCI6IFwiaXNpbnY7XCIsXG4gICAgXCI4NzEzXCI6IFwibm90aW52YTtcIixcbiAgICBcIjg3MTVcIjogXCJTdWNoVGhhdDtcIixcbiAgICBcIjg3MTZcIjogXCJOb3RSZXZlcnNlRWxlbWVudDtcIixcbiAgICBcIjg3MTlcIjogXCJQcm9kdWN0O1wiLFxuICAgIFwiODcyMFwiOiBcIkNvcHJvZHVjdDtcIixcbiAgICBcIjg3MjFcIjogXCJzdW07XCIsXG4gICAgXCI4NzIyXCI6IFwibWludXM7XCIsXG4gICAgXCI4NzIzXCI6IFwibXA7XCIsXG4gICAgXCI4NzI0XCI6IFwicGx1c2RvO1wiLFxuICAgIFwiODcyNlwiOiBcInNzZXRtbjtcIixcbiAgICBcIjg3MjdcIjogXCJsb3dhc3Q7XCIsXG4gICAgXCI4NzI4XCI6IFwiU21hbGxDaXJjbGU7XCIsXG4gICAgXCI4NzMwXCI6IFwiU3FydDtcIixcbiAgICBcIjg3MzNcIjogXCJ2cHJvcDtcIixcbiAgICBcIjg3MzRcIjogXCJpbmZpbjtcIixcbiAgICBcIjg3MzVcIjogXCJhbmdydDtcIixcbiAgICBcIjg3MzZcIjogXCJhbmdsZTtcIixcbiAgICBcIjg3MzdcIjogXCJtZWFzdXJlZGFuZ2xlO1wiLFxuICAgIFwiODczOFwiOiBcImFuZ3NwaDtcIixcbiAgICBcIjg3MzlcIjogXCJWZXJ0aWNhbEJhcjtcIixcbiAgICBcIjg3NDBcIjogXCJuc21pZDtcIixcbiAgICBcIjg3NDFcIjogXCJzcGFyO1wiLFxuICAgIFwiODc0MlwiOiBcIm5zcGFyO1wiLFxuICAgIFwiODc0M1wiOiBcIndlZGdlO1wiLFxuICAgIFwiODc0NFwiOiBcInZlZTtcIixcbiAgICBcIjg3NDVcIjogXCJjYXA7XCIsXG4gICAgXCI4NzQ2XCI6IFwiY3VwO1wiLFxuICAgIFwiODc0N1wiOiBcIkludGVncmFsO1wiLFxuICAgIFwiODc0OFwiOiBcIkludDtcIixcbiAgICBcIjg3NDlcIjogXCJ0aW50O1wiLFxuICAgIFwiODc1MFwiOiBcIm9pbnQ7XCIsXG4gICAgXCI4NzUxXCI6IFwiRG91YmxlQ29udG91ckludGVncmFsO1wiLFxuICAgIFwiODc1MlwiOiBcIkNjb25pbnQ7XCIsXG4gICAgXCI4NzUzXCI6IFwiY3dpbnQ7XCIsXG4gICAgXCI4NzU0XCI6IFwiY3djb25pbnQ7XCIsXG4gICAgXCI4NzU1XCI6IFwiQ291bnRlckNsb2Nrd2lzZUNvbnRvdXJJbnRlZ3JhbDtcIixcbiAgICBcIjg3NTZcIjogXCJ0aGVyZWZvcmU7XCIsXG4gICAgXCI4NzU3XCI6IFwiYmVjYXVzZTtcIixcbiAgICBcIjg3NThcIjogXCJyYXRpbztcIixcbiAgICBcIjg3NTlcIjogXCJQcm9wb3J0aW9uO1wiLFxuICAgIFwiODc2MFwiOiBcIm1pbnVzZDtcIixcbiAgICBcIjg3NjJcIjogXCJtRERvdDtcIixcbiAgICBcIjg3NjNcIjogXCJob210aHQ7XCIsXG4gICAgXCI4NzY0XCI6IFwiVGlsZGU7XCIsXG4gICAgXCI4NzY1XCI6IFwiYnNpbTtcIixcbiAgICBcIjg3NjZcIjogXCJtc3Rwb3M7XCIsXG4gICAgXCI4NzY3XCI6IFwiYWNkO1wiLFxuICAgIFwiODc2OFwiOiBcIndyZWF0aDtcIixcbiAgICBcIjg3NjlcIjogXCJuc2ltO1wiLFxuICAgIFwiODc3MFwiOiBcImVzaW07XCIsXG4gICAgXCI4NzcxXCI6IFwiVGlsZGVFcXVhbDtcIixcbiAgICBcIjg3NzJcIjogXCJuc2ltZXE7XCIsXG4gICAgXCI4NzczXCI6IFwiVGlsZGVGdWxsRXF1YWw7XCIsXG4gICAgXCI4Nzc0XCI6IFwic2ltbmU7XCIsXG4gICAgXCI4Nzc1XCI6IFwiTm90VGlsZGVGdWxsRXF1YWw7XCIsXG4gICAgXCI4Nzc2XCI6IFwiVGlsZGVUaWxkZTtcIixcbiAgICBcIjg3NzdcIjogXCJOb3RUaWxkZVRpbGRlO1wiLFxuICAgIFwiODc3OFwiOiBcImFwcHJveGVxO1wiLFxuICAgIFwiODc3OVwiOiBcImFwaWQ7XCIsXG4gICAgXCI4NzgwXCI6IFwiYmNvbmc7XCIsXG4gICAgXCI4NzgxXCI6IFwiQ3VwQ2FwO1wiLFxuICAgIFwiODc4MlwiOiBcIkh1bXBEb3duSHVtcDtcIixcbiAgICBcIjg3ODNcIjogXCJIdW1wRXF1YWw7XCIsXG4gICAgXCI4Nzg0XCI6IFwiZXNkb3Q7XCIsXG4gICAgXCI4Nzg1XCI6IFwiZURvdDtcIixcbiAgICBcIjg3ODZcIjogXCJmYWxsaW5nZG90c2VxO1wiLFxuICAgIFwiODc4N1wiOiBcInJpc2luZ2RvdHNlcTtcIixcbiAgICBcIjg3ODhcIjogXCJjb2xvbmVxO1wiLFxuICAgIFwiODc4OVwiOiBcImVxY29sb247XCIsXG4gICAgXCI4NzkwXCI6IFwiZXFjaXJjO1wiLFxuICAgIFwiODc5MVwiOiBcImNpcmU7XCIsXG4gICAgXCI4NzkzXCI6IFwid2VkZ2VxO1wiLFxuICAgIFwiODc5NFwiOiBcInZlZWVxO1wiLFxuICAgIFwiODc5NlwiOiBcInRyaWU7XCIsXG4gICAgXCI4Nzk5XCI6IFwicXVlc3RlcTtcIixcbiAgICBcIjg4MDBcIjogXCJOb3RFcXVhbDtcIixcbiAgICBcIjg4MDFcIjogXCJlcXVpdjtcIixcbiAgICBcIjg4MDJcIjogXCJOb3RDb25ncnVlbnQ7XCIsXG4gICAgXCI4ODA0XCI6IFwibGVxO1wiLFxuICAgIFwiODgwNVwiOiBcIkdyZWF0ZXJFcXVhbDtcIixcbiAgICBcIjg4MDZcIjogXCJMZXNzRnVsbEVxdWFsO1wiLFxuICAgIFwiODgwN1wiOiBcIkdyZWF0ZXJGdWxsRXF1YWw7XCIsXG4gICAgXCI4ODA4XCI6IFwibG5lcXE7XCIsXG4gICAgXCI4ODA5XCI6IFwiZ25lcXE7XCIsXG4gICAgXCI4ODEwXCI6IFwiTmVzdGVkTGVzc0xlc3M7XCIsXG4gICAgXCI4ODExXCI6IFwiTmVzdGVkR3JlYXRlckdyZWF0ZXI7XCIsXG4gICAgXCI4ODEyXCI6IFwidHdpeHQ7XCIsXG4gICAgXCI4ODEzXCI6IFwiTm90Q3VwQ2FwO1wiLFxuICAgIFwiODgxNFwiOiBcIk5vdExlc3M7XCIsXG4gICAgXCI4ODE1XCI6IFwiTm90R3JlYXRlcjtcIixcbiAgICBcIjg4MTZcIjogXCJOb3RMZXNzRXF1YWw7XCIsXG4gICAgXCI4ODE3XCI6IFwiTm90R3JlYXRlckVxdWFsO1wiLFxuICAgIFwiODgxOFwiOiBcImxzaW07XCIsXG4gICAgXCI4ODE5XCI6IFwiZ3Ryc2ltO1wiLFxuICAgIFwiODgyMFwiOiBcIk5vdExlc3NUaWxkZTtcIixcbiAgICBcIjg4MjFcIjogXCJOb3RHcmVhdGVyVGlsZGU7XCIsXG4gICAgXCI4ODIyXCI6IFwibGc7XCIsXG4gICAgXCI4ODIzXCI6IFwiZ3RybGVzcztcIixcbiAgICBcIjg4MjRcIjogXCJudGxnO1wiLFxuICAgIFwiODgyNVwiOiBcIm50Z2w7XCIsXG4gICAgXCI4ODI2XCI6IFwiUHJlY2VkZXM7XCIsXG4gICAgXCI4ODI3XCI6IFwiU3VjY2VlZHM7XCIsXG4gICAgXCI4ODI4XCI6IFwiUHJlY2VkZXNTbGFudEVxdWFsO1wiLFxuICAgIFwiODgyOVwiOiBcIlN1Y2NlZWRzU2xhbnRFcXVhbDtcIixcbiAgICBcIjg4MzBcIjogXCJwcnNpbTtcIixcbiAgICBcIjg4MzFcIjogXCJzdWNjc2ltO1wiLFxuICAgIFwiODgzMlwiOiBcIm5wcmVjO1wiLFxuICAgIFwiODgzM1wiOiBcIm5zdWNjO1wiLFxuICAgIFwiODgzNFwiOiBcInN1YnNldDtcIixcbiAgICBcIjg4MzVcIjogXCJzdXBzZXQ7XCIsXG4gICAgXCI4ODM2XCI6IFwibnN1YjtcIixcbiAgICBcIjg4MzdcIjogXCJuc3VwO1wiLFxuICAgIFwiODgzOFwiOiBcIlN1YnNldEVxdWFsO1wiLFxuICAgIFwiODgzOVwiOiBcInN1cHNldGVxO1wiLFxuICAgIFwiODg0MFwiOiBcIm5zdWJzZXRlcTtcIixcbiAgICBcIjg4NDFcIjogXCJuc3Vwc2V0ZXE7XCIsXG4gICAgXCI4ODQyXCI6IFwic3Vic2V0bmVxO1wiLFxuICAgIFwiODg0M1wiOiBcInN1cHNldG5lcTtcIixcbiAgICBcIjg4NDVcIjogXCJjdXBkb3Q7XCIsXG4gICAgXCI4ODQ2XCI6IFwidXBsdXM7XCIsXG4gICAgXCI4ODQ3XCI6IFwiU3F1YXJlU3Vic2V0O1wiLFxuICAgIFwiODg0OFwiOiBcIlNxdWFyZVN1cGVyc2V0O1wiLFxuICAgIFwiODg0OVwiOiBcIlNxdWFyZVN1YnNldEVxdWFsO1wiLFxuICAgIFwiODg1MFwiOiBcIlNxdWFyZVN1cGVyc2V0RXF1YWw7XCIsXG4gICAgXCI4ODUxXCI6IFwiU3F1YXJlSW50ZXJzZWN0aW9uO1wiLFxuICAgIFwiODg1MlwiOiBcIlNxdWFyZVVuaW9uO1wiLFxuICAgIFwiODg1M1wiOiBcIm9wbHVzO1wiLFxuICAgIFwiODg1NFwiOiBcIm9taW51cztcIixcbiAgICBcIjg4NTVcIjogXCJvdGltZXM7XCIsXG4gICAgXCI4ODU2XCI6IFwib3NvbDtcIixcbiAgICBcIjg4NTdcIjogXCJvZG90O1wiLFxuICAgIFwiODg1OFwiOiBcIm9jaXI7XCIsXG4gICAgXCI4ODU5XCI6IFwib2FzdDtcIixcbiAgICBcIjg4NjFcIjogXCJvZGFzaDtcIixcbiAgICBcIjg4NjJcIjogXCJwbHVzYjtcIixcbiAgICBcIjg4NjNcIjogXCJtaW51c2I7XCIsXG4gICAgXCI4ODY0XCI6IFwidGltZXNiO1wiLFxuICAgIFwiODg2NVwiOiBcInNkb3RiO1wiLFxuICAgIFwiODg2NlwiOiBcInZkYXNoO1wiLFxuICAgIFwiODg2N1wiOiBcIkxlZnRUZWU7XCIsXG4gICAgXCI4ODY4XCI6IFwidG9wO1wiLFxuICAgIFwiODg2OVwiOiBcIlVwVGVlO1wiLFxuICAgIFwiODg3MVwiOiBcIm1vZGVscztcIixcbiAgICBcIjg4NzJcIjogXCJ2RGFzaDtcIixcbiAgICBcIjg4NzNcIjogXCJWZGFzaDtcIixcbiAgICBcIjg4NzRcIjogXCJWdmRhc2g7XCIsXG4gICAgXCI4ODc1XCI6IFwiVkRhc2g7XCIsXG4gICAgXCI4ODc2XCI6IFwibnZkYXNoO1wiLFxuICAgIFwiODg3N1wiOiBcIm52RGFzaDtcIixcbiAgICBcIjg4NzhcIjogXCJuVmRhc2g7XCIsXG4gICAgXCI4ODc5XCI6IFwiblZEYXNoO1wiLFxuICAgIFwiODg4MFwiOiBcInBydXJlbDtcIixcbiAgICBcIjg4ODJcIjogXCJ2bHRyaTtcIixcbiAgICBcIjg4ODNcIjogXCJ2cnRyaTtcIixcbiAgICBcIjg4ODRcIjogXCJ0cmlhbmdsZWxlZnRlcTtcIixcbiAgICBcIjg4ODVcIjogXCJ0cmlhbmdsZXJpZ2h0ZXE7XCIsXG4gICAgXCI4ODg2XCI6IFwib3JpZ29mO1wiLFxuICAgIFwiODg4N1wiOiBcImltb2Y7XCIsXG4gICAgXCI4ODg4XCI6IFwibXVtYXA7XCIsXG4gICAgXCI4ODg5XCI6IFwiaGVyY29uO1wiLFxuICAgIFwiODg5MFwiOiBcImludGVyY2FsO1wiLFxuICAgIFwiODg5MVwiOiBcInZlZWJhcjtcIixcbiAgICBcIjg4OTNcIjogXCJiYXJ2ZWU7XCIsXG4gICAgXCI4ODk0XCI6IFwiYW5ncnR2YjtcIixcbiAgICBcIjg4OTVcIjogXCJscnRyaTtcIixcbiAgICBcIjg4OTZcIjogXCJ4d2VkZ2U7XCIsXG4gICAgXCI4ODk3XCI6IFwieHZlZTtcIixcbiAgICBcIjg4OThcIjogXCJ4Y2FwO1wiLFxuICAgIFwiODg5OVwiOiBcInhjdXA7XCIsXG4gICAgXCI4OTAwXCI6IFwiZGlhbW9uZDtcIixcbiAgICBcIjg5MDFcIjogXCJzZG90O1wiLFxuICAgIFwiODkwMlwiOiBcIlN0YXI7XCIsXG4gICAgXCI4OTAzXCI6IFwiZGl2b254O1wiLFxuICAgIFwiODkwNFwiOiBcImJvd3RpZTtcIixcbiAgICBcIjg5MDVcIjogXCJsdGltZXM7XCIsXG4gICAgXCI4OTA2XCI6IFwicnRpbWVzO1wiLFxuICAgIFwiODkwN1wiOiBcImx0aHJlZTtcIixcbiAgICBcIjg5MDhcIjogXCJydGhyZWU7XCIsXG4gICAgXCI4OTA5XCI6IFwiYnNpbWU7XCIsXG4gICAgXCI4OTEwXCI6IFwiY3V2ZWU7XCIsXG4gICAgXCI4OTExXCI6IFwiY3V3ZWQ7XCIsXG4gICAgXCI4OTEyXCI6IFwiU3Vic2V0O1wiLFxuICAgIFwiODkxM1wiOiBcIlN1cHNldDtcIixcbiAgICBcIjg5MTRcIjogXCJDYXA7XCIsXG4gICAgXCI4OTE1XCI6IFwiQ3VwO1wiLFxuICAgIFwiODkxNlwiOiBcInBpdGNoZm9yaztcIixcbiAgICBcIjg5MTdcIjogXCJlcGFyO1wiLFxuICAgIFwiODkxOFwiOiBcImx0ZG90O1wiLFxuICAgIFwiODkxOVwiOiBcImd0cmRvdDtcIixcbiAgICBcIjg5MjBcIjogXCJMbDtcIixcbiAgICBcIjg5MjFcIjogXCJnZ2c7XCIsXG4gICAgXCI4OTIyXCI6IFwiTGVzc0VxdWFsR3JlYXRlcjtcIixcbiAgICBcIjg5MjNcIjogXCJndHJlcWxlc3M7XCIsXG4gICAgXCI4OTI2XCI6IFwiY3VybHllcXByZWM7XCIsXG4gICAgXCI4OTI3XCI6IFwiY3VybHllcXN1Y2M7XCIsXG4gICAgXCI4OTI4XCI6IFwibnByY3VlO1wiLFxuICAgIFwiODkyOVwiOiBcIm5zY2N1ZTtcIixcbiAgICBcIjg5MzBcIjogXCJuc3FzdWJlO1wiLFxuICAgIFwiODkzMVwiOiBcIm5zcXN1cGU7XCIsXG4gICAgXCI4OTM0XCI6IFwibG5zaW07XCIsXG4gICAgXCI4OTM1XCI6IFwiZ25zaW07XCIsXG4gICAgXCI4OTM2XCI6IFwicHJuc2ltO1wiLFxuICAgIFwiODkzN1wiOiBcInN1Y2Nuc2ltO1wiLFxuICAgIFwiODkzOFwiOiBcIm50cmlhbmdsZWxlZnQ7XCIsXG4gICAgXCI4OTM5XCI6IFwibnRyaWFuZ2xlcmlnaHQ7XCIsXG4gICAgXCI4OTQwXCI6IFwibnRyaWFuZ2xlbGVmdGVxO1wiLFxuICAgIFwiODk0MVwiOiBcIm50cmlhbmdsZXJpZ2h0ZXE7XCIsXG4gICAgXCI4OTQyXCI6IFwidmVsbGlwO1wiLFxuICAgIFwiODk0M1wiOiBcImN0ZG90O1wiLFxuICAgIFwiODk0NFwiOiBcInV0ZG90O1wiLFxuICAgIFwiODk0NVwiOiBcImR0ZG90O1wiLFxuICAgIFwiODk0NlwiOiBcImRpc2luO1wiLFxuICAgIFwiODk0N1wiOiBcImlzaW5zdjtcIixcbiAgICBcIjg5NDhcIjogXCJpc2lucztcIixcbiAgICBcIjg5NDlcIjogXCJpc2luZG90O1wiLFxuICAgIFwiODk1MFwiOiBcIm5vdGludmM7XCIsXG4gICAgXCI4OTUxXCI6IFwibm90aW52YjtcIixcbiAgICBcIjg5NTNcIjogXCJpc2luRTtcIixcbiAgICBcIjg5NTRcIjogXCJuaXNkO1wiLFxuICAgIFwiODk1NVwiOiBcInhuaXM7XCIsXG4gICAgXCI4OTU2XCI6IFwibmlzO1wiLFxuICAgIFwiODk1N1wiOiBcIm5vdG5pdmM7XCIsXG4gICAgXCI4OTU4XCI6IFwibm90bml2YjtcIixcbiAgICBcIjg5NjVcIjogXCJiYXJ3ZWRnZTtcIixcbiAgICBcIjg5NjZcIjogXCJkb3VibGViYXJ3ZWRnZTtcIixcbiAgICBcIjg5NjhcIjogXCJMZWZ0Q2VpbGluZztcIixcbiAgICBcIjg5NjlcIjogXCJSaWdodENlaWxpbmc7XCIsXG4gICAgXCI4OTcwXCI6IFwibGZsb29yO1wiLFxuICAgIFwiODk3MVwiOiBcIlJpZ2h0Rmxvb3I7XCIsXG4gICAgXCI4OTcyXCI6IFwiZHJjcm9wO1wiLFxuICAgIFwiODk3M1wiOiBcImRsY3JvcDtcIixcbiAgICBcIjg5NzRcIjogXCJ1cmNyb3A7XCIsXG4gICAgXCI4OTc1XCI6IFwidWxjcm9wO1wiLFxuICAgIFwiODk3NlwiOiBcImJub3Q7XCIsXG4gICAgXCI4OTc4XCI6IFwicHJvZmxpbmU7XCIsXG4gICAgXCI4OTc5XCI6IFwicHJvZnN1cmY7XCIsXG4gICAgXCI4OTgxXCI6IFwidGVscmVjO1wiLFxuICAgIFwiODk4MlwiOiBcInRhcmdldDtcIixcbiAgICBcIjg5ODhcIjogXCJ1bGNvcm5lcjtcIixcbiAgICBcIjg5ODlcIjogXCJ1cmNvcm5lcjtcIixcbiAgICBcIjg5OTBcIjogXCJsbGNvcm5lcjtcIixcbiAgICBcIjg5OTFcIjogXCJscmNvcm5lcjtcIixcbiAgICBcIjg5OTRcIjogXCJzZnJvd247XCIsXG4gICAgXCI4OTk1XCI6IFwic3NtaWxlO1wiLFxuICAgIFwiOTAwNVwiOiBcImN5bGN0eTtcIixcbiAgICBcIjkwMDZcIjogXCJwcm9mYWxhcjtcIixcbiAgICBcIjkwMTRcIjogXCJ0b3Bib3Q7XCIsXG4gICAgXCI5MDIxXCI6IFwib3ZiYXI7XCIsXG4gICAgXCI5MDIzXCI6IFwic29sYmFyO1wiLFxuICAgIFwiOTA4NFwiOiBcImFuZ3phcnI7XCIsXG4gICAgXCI5MTM2XCI6IFwibG1vdXN0YWNoZTtcIixcbiAgICBcIjkxMzdcIjogXCJybW91c3RhY2hlO1wiLFxuICAgIFwiOTE0MFwiOiBcInRicms7XCIsXG4gICAgXCI5MTQxXCI6IFwiVW5kZXJCcmFja2V0O1wiLFxuICAgIFwiOTE0MlwiOiBcImJicmt0YnJrO1wiLFxuICAgIFwiOTE4MFwiOiBcIk92ZXJQYXJlbnRoZXNpcztcIixcbiAgICBcIjkxODFcIjogXCJVbmRlclBhcmVudGhlc2lzO1wiLFxuICAgIFwiOTE4MlwiOiBcIk92ZXJCcmFjZTtcIixcbiAgICBcIjkxODNcIjogXCJVbmRlckJyYWNlO1wiLFxuICAgIFwiOTE4NlwiOiBcInRycGV6aXVtO1wiLFxuICAgIFwiOTE5MVwiOiBcImVsaW50ZXJzO1wiLFxuICAgIFwiOTI1MVwiOiBcImJsYW5rO1wiLFxuICAgIFwiOTQxNlwiOiBcIm9TO1wiLFxuICAgIFwiOTQ3MlwiOiBcIkhvcml6b250YWxMaW5lO1wiLFxuICAgIFwiOTQ3NFwiOiBcImJveHY7XCIsXG4gICAgXCI5NDg0XCI6IFwiYm94ZHI7XCIsXG4gICAgXCI5NDg4XCI6IFwiYm94ZGw7XCIsXG4gICAgXCI5NDkyXCI6IFwiYm94dXI7XCIsXG4gICAgXCI5NDk2XCI6IFwiYm94dWw7XCIsXG4gICAgXCI5NTAwXCI6IFwiYm94dnI7XCIsXG4gICAgXCI5NTA4XCI6IFwiYm94dmw7XCIsXG4gICAgXCI5NTE2XCI6IFwiYm94aGQ7XCIsXG4gICAgXCI5NTI0XCI6IFwiYm94aHU7XCIsXG4gICAgXCI5NTMyXCI6IFwiYm94dmg7XCIsXG4gICAgXCI5NTUyXCI6IFwiYm94SDtcIixcbiAgICBcIjk1NTNcIjogXCJib3hWO1wiLFxuICAgIFwiOTU1NFwiOiBcImJveGRSO1wiLFxuICAgIFwiOTU1NVwiOiBcImJveERyO1wiLFxuICAgIFwiOTU1NlwiOiBcImJveERSO1wiLFxuICAgIFwiOTU1N1wiOiBcImJveGRMO1wiLFxuICAgIFwiOTU1OFwiOiBcImJveERsO1wiLFxuICAgIFwiOTU1OVwiOiBcImJveERMO1wiLFxuICAgIFwiOTU2MFwiOiBcImJveHVSO1wiLFxuICAgIFwiOTU2MVwiOiBcImJveFVyO1wiLFxuICAgIFwiOTU2MlwiOiBcImJveFVSO1wiLFxuICAgIFwiOTU2M1wiOiBcImJveHVMO1wiLFxuICAgIFwiOTU2NFwiOiBcImJveFVsO1wiLFxuICAgIFwiOTU2NVwiOiBcImJveFVMO1wiLFxuICAgIFwiOTU2NlwiOiBcImJveHZSO1wiLFxuICAgIFwiOTU2N1wiOiBcImJveFZyO1wiLFxuICAgIFwiOTU2OFwiOiBcImJveFZSO1wiLFxuICAgIFwiOTU2OVwiOiBcImJveHZMO1wiLFxuICAgIFwiOTU3MFwiOiBcImJveFZsO1wiLFxuICAgIFwiOTU3MVwiOiBcImJveFZMO1wiLFxuICAgIFwiOTU3MlwiOiBcImJveEhkO1wiLFxuICAgIFwiOTU3M1wiOiBcImJveGhEO1wiLFxuICAgIFwiOTU3NFwiOiBcImJveEhEO1wiLFxuICAgIFwiOTU3NVwiOiBcImJveEh1O1wiLFxuICAgIFwiOTU3NlwiOiBcImJveGhVO1wiLFxuICAgIFwiOTU3N1wiOiBcImJveEhVO1wiLFxuICAgIFwiOTU3OFwiOiBcImJveHZIO1wiLFxuICAgIFwiOTU3OVwiOiBcImJveFZoO1wiLFxuICAgIFwiOTU4MFwiOiBcImJveFZIO1wiLFxuICAgIFwiOTYwMFwiOiBcInVoYmxrO1wiLFxuICAgIFwiOTYwNFwiOiBcImxoYmxrO1wiLFxuICAgIFwiOTYwOFwiOiBcImJsb2NrO1wiLFxuICAgIFwiOTYxN1wiOiBcImJsazE0O1wiLFxuICAgIFwiOTYxOFwiOiBcImJsazEyO1wiLFxuICAgIFwiOTYxOVwiOiBcImJsazM0O1wiLFxuICAgIFwiOTYzM1wiOiBcInNxdWFyZTtcIixcbiAgICBcIjk2NDJcIjogXCJzcXVmO1wiLFxuICAgIFwiOTY0M1wiOiBcIkVtcHR5VmVyeVNtYWxsU3F1YXJlO1wiLFxuICAgIFwiOTY0NVwiOiBcInJlY3Q7XCIsXG4gICAgXCI5NjQ2XCI6IFwibWFya2VyO1wiLFxuICAgIFwiOTY0OVwiOiBcImZsdG5zO1wiLFxuICAgIFwiOTY1MVwiOiBcInh1dHJpO1wiLFxuICAgIFwiOTY1MlwiOiBcInV0cmlmO1wiLFxuICAgIFwiOTY1M1wiOiBcInV0cmk7XCIsXG4gICAgXCI5NjU2XCI6IFwicnRyaWY7XCIsXG4gICAgXCI5NjU3XCI6IFwidHJpYW5nbGVyaWdodDtcIixcbiAgICBcIjk2NjFcIjogXCJ4ZHRyaTtcIixcbiAgICBcIjk2NjJcIjogXCJkdHJpZjtcIixcbiAgICBcIjk2NjNcIjogXCJ0cmlhbmdsZWRvd247XCIsXG4gICAgXCI5NjY2XCI6IFwibHRyaWY7XCIsXG4gICAgXCI5NjY3XCI6IFwidHJpYW5nbGVsZWZ0O1wiLFxuICAgIFwiOTY3NFwiOiBcImxvemVuZ2U7XCIsXG4gICAgXCI5Njc1XCI6IFwiY2lyO1wiLFxuICAgIFwiOTcwOFwiOiBcInRyaWRvdDtcIixcbiAgICBcIjk3MTFcIjogXCJ4Y2lyYztcIixcbiAgICBcIjk3MjBcIjogXCJ1bHRyaTtcIixcbiAgICBcIjk3MjFcIjogXCJ1cnRyaTtcIixcbiAgICBcIjk3MjJcIjogXCJsbHRyaTtcIixcbiAgICBcIjk3MjNcIjogXCJFbXB0eVNtYWxsU3F1YXJlO1wiLFxuICAgIFwiOTcyNFwiOiBcIkZpbGxlZFNtYWxsU3F1YXJlO1wiLFxuICAgIFwiOTczM1wiOiBcInN0YXJmO1wiLFxuICAgIFwiOTczNFwiOiBcInN0YXI7XCIsXG4gICAgXCI5NzQyXCI6IFwicGhvbmU7XCIsXG4gICAgXCI5NzkyXCI6IFwiZmVtYWxlO1wiLFxuICAgIFwiOTc5NFwiOiBcIm1hbGU7XCIsXG4gICAgXCI5ODI0XCI6IFwic3BhZGVzdWl0O1wiLFxuICAgIFwiOTgyN1wiOiBcImNsdWJzdWl0O1wiLFxuICAgIFwiOTgyOVwiOiBcImhlYXJ0c3VpdDtcIixcbiAgICBcIjk4MzBcIjogXCJkaWFtcztcIixcbiAgICBcIjk4MzRcIjogXCJzdW5nO1wiLFxuICAgIFwiOTgzN1wiOiBcImZsYXQ7XCIsXG4gICAgXCI5ODM4XCI6IFwibmF0dXJhbDtcIixcbiAgICBcIjk4MzlcIjogXCJzaGFycDtcIixcbiAgICBcIjEwMDAzXCI6IFwiY2hlY2ttYXJrO1wiLFxuICAgIFwiMTAwMDdcIjogXCJjcm9zcztcIixcbiAgICBcIjEwMDE2XCI6IFwibWFsdGVzZTtcIixcbiAgICBcIjEwMDM4XCI6IFwic2V4dDtcIixcbiAgICBcIjEwMDcyXCI6IFwiVmVydGljYWxTZXBhcmF0b3I7XCIsXG4gICAgXCIxMDA5OFwiOiBcImxiYnJrO1wiLFxuICAgIFwiMTAwOTlcIjogXCJyYmJyaztcIixcbiAgICBcIjEwMTg0XCI6IFwiYnNvbGhzdWI7XCIsXG4gICAgXCIxMDE4NVwiOiBcInN1cGhzb2w7XCIsXG4gICAgXCIxMDIxNFwiOiBcImxvYnJrO1wiLFxuICAgIFwiMTAyMTVcIjogXCJyb2JyaztcIixcbiAgICBcIjEwMjE2XCI6IFwiTGVmdEFuZ2xlQnJhY2tldDtcIixcbiAgICBcIjEwMjE3XCI6IFwiUmlnaHRBbmdsZUJyYWNrZXQ7XCIsXG4gICAgXCIxMDIxOFwiOiBcIkxhbmc7XCIsXG4gICAgXCIxMDIxOVwiOiBcIlJhbmc7XCIsXG4gICAgXCIxMDIyMFwiOiBcImxvYW5nO1wiLFxuICAgIFwiMTAyMjFcIjogXCJyb2FuZztcIixcbiAgICBcIjEwMjI5XCI6IFwieGxhcnI7XCIsXG4gICAgXCIxMDIzMFwiOiBcInhyYXJyO1wiLFxuICAgIFwiMTAyMzFcIjogXCJ4aGFycjtcIixcbiAgICBcIjEwMjMyXCI6IFwieGxBcnI7XCIsXG4gICAgXCIxMDIzM1wiOiBcInhyQXJyO1wiLFxuICAgIFwiMTAyMzRcIjogXCJ4aEFycjtcIixcbiAgICBcIjEwMjM2XCI6IFwieG1hcDtcIixcbiAgICBcIjEwMjM5XCI6IFwiZHppZ3JhcnI7XCIsXG4gICAgXCIxMDQ5OFwiOiBcIm52bEFycjtcIixcbiAgICBcIjEwNDk5XCI6IFwibnZyQXJyO1wiLFxuICAgIFwiMTA1MDBcIjogXCJudkhhcnI7XCIsXG4gICAgXCIxMDUwMVwiOiBcIk1hcDtcIixcbiAgICBcIjEwNTA4XCI6IFwibGJhcnI7XCIsXG4gICAgXCIxMDUwOVwiOiBcInJiYXJyO1wiLFxuICAgIFwiMTA1MTBcIjogXCJsQmFycjtcIixcbiAgICBcIjEwNTExXCI6IFwickJhcnI7XCIsXG4gICAgXCIxMDUxMlwiOiBcIlJCYXJyO1wiLFxuICAgIFwiMTA1MTNcIjogXCJERG90cmFoZDtcIixcbiAgICBcIjEwNTE0XCI6IFwiVXBBcnJvd0JhcjtcIixcbiAgICBcIjEwNTE1XCI6IFwiRG93bkFycm93QmFyO1wiLFxuICAgIFwiMTA1MThcIjogXCJSYXJydGw7XCIsXG4gICAgXCIxMDUyMVwiOiBcImxhdGFpbDtcIixcbiAgICBcIjEwNTIyXCI6IFwicmF0YWlsO1wiLFxuICAgIFwiMTA1MjNcIjogXCJsQXRhaWw7XCIsXG4gICAgXCIxMDUyNFwiOiBcInJBdGFpbDtcIixcbiAgICBcIjEwNTI1XCI6IFwibGFycmZzO1wiLFxuICAgIFwiMTA1MjZcIjogXCJyYXJyZnM7XCIsXG4gICAgXCIxMDUyN1wiOiBcImxhcnJiZnM7XCIsXG4gICAgXCIxMDUyOFwiOiBcInJhcnJiZnM7XCIsXG4gICAgXCIxMDUzMVwiOiBcIm53YXJoaztcIixcbiAgICBcIjEwNTMyXCI6IFwibmVhcmhrO1wiLFxuICAgIFwiMTA1MzNcIjogXCJzZWFyaGs7XCIsXG4gICAgXCIxMDUzNFwiOiBcInN3YXJoaztcIixcbiAgICBcIjEwNTM1XCI6IFwibnduZWFyO1wiLFxuICAgIFwiMTA1MzZcIjogXCJ0b2VhO1wiLFxuICAgIFwiMTA1MzdcIjogXCJ0b3NhO1wiLFxuICAgIFwiMTA1MzhcIjogXCJzd253YXI7XCIsXG4gICAgXCIxMDU0N1wiOiBcInJhcnJjO1wiLFxuICAgIFwiMTA1NDlcIjogXCJjdWRhcnJyO1wiLFxuICAgIFwiMTA1NTBcIjogXCJsZGNhO1wiLFxuICAgIFwiMTA1NTFcIjogXCJyZGNhO1wiLFxuICAgIFwiMTA1NTJcIjogXCJjdWRhcnJsO1wiLFxuICAgIFwiMTA1NTNcIjogXCJsYXJycGw7XCIsXG4gICAgXCIxMDU1NlwiOiBcImN1cmFycm07XCIsXG4gICAgXCIxMDU1N1wiOiBcImN1bGFycnA7XCIsXG4gICAgXCIxMDU2NVwiOiBcInJhcnJwbDtcIixcbiAgICBcIjEwNTY4XCI6IFwiaGFycmNpcjtcIixcbiAgICBcIjEwNTY5XCI6IFwiVWFycm9jaXI7XCIsXG4gICAgXCIxMDU3MFwiOiBcImx1cmRzaGFyO1wiLFxuICAgIFwiMTA1NzFcIjogXCJsZHJ1c2hhcjtcIixcbiAgICBcIjEwNTc0XCI6IFwiTGVmdFJpZ2h0VmVjdG9yO1wiLFxuICAgIFwiMTA1NzVcIjogXCJSaWdodFVwRG93blZlY3RvcjtcIixcbiAgICBcIjEwNTc2XCI6IFwiRG93bkxlZnRSaWdodFZlY3RvcjtcIixcbiAgICBcIjEwNTc3XCI6IFwiTGVmdFVwRG93blZlY3RvcjtcIixcbiAgICBcIjEwNTc4XCI6IFwiTGVmdFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTc5XCI6IFwiUmlnaHRWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4MFwiOiBcIlJpZ2h0VXBWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4MVwiOiBcIlJpZ2h0RG93blZlY3RvckJhcjtcIixcbiAgICBcIjEwNTgyXCI6IFwiRG93bkxlZnRWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4M1wiOiBcIkRvd25SaWdodFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTg0XCI6IFwiTGVmdFVwVmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODVcIjogXCJMZWZ0RG93blZlY3RvckJhcjtcIixcbiAgICBcIjEwNTg2XCI6IFwiTGVmdFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTg3XCI6IFwiUmlnaHRUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU4OFwiOiBcIlJpZ2h0VXBUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU4OVwiOiBcIlJpZ2h0RG93blRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTkwXCI6IFwiRG93bkxlZnRUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5MVwiOiBcIkRvd25SaWdodFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTkyXCI6IFwiTGVmdFVwVGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1OTNcIjogXCJMZWZ0RG93blRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTk0XCI6IFwibEhhcjtcIixcbiAgICBcIjEwNTk1XCI6IFwidUhhcjtcIixcbiAgICBcIjEwNTk2XCI6IFwickhhcjtcIixcbiAgICBcIjEwNTk3XCI6IFwiZEhhcjtcIixcbiAgICBcIjEwNTk4XCI6IFwibHVydWhhcjtcIixcbiAgICBcIjEwNTk5XCI6IFwibGRyZGhhcjtcIixcbiAgICBcIjEwNjAwXCI6IFwicnVsdWhhcjtcIixcbiAgICBcIjEwNjAxXCI6IFwicmRsZGhhcjtcIixcbiAgICBcIjEwNjAyXCI6IFwibGhhcnVsO1wiLFxuICAgIFwiMTA2MDNcIjogXCJsbGhhcmQ7XCIsXG4gICAgXCIxMDYwNFwiOiBcInJoYXJ1bDtcIixcbiAgICBcIjEwNjA1XCI6IFwibHJoYXJkO1wiLFxuICAgIFwiMTA2MDZcIjogXCJVcEVxdWlsaWJyaXVtO1wiLFxuICAgIFwiMTA2MDdcIjogXCJSZXZlcnNlVXBFcXVpbGlicml1bTtcIixcbiAgICBcIjEwNjA4XCI6IFwiUm91bmRJbXBsaWVzO1wiLFxuICAgIFwiMTA2MDlcIjogXCJlcmFycjtcIixcbiAgICBcIjEwNjEwXCI6IFwic2ltcmFycjtcIixcbiAgICBcIjEwNjExXCI6IFwibGFycnNpbTtcIixcbiAgICBcIjEwNjEyXCI6IFwicmFycnNpbTtcIixcbiAgICBcIjEwNjEzXCI6IFwicmFycmFwO1wiLFxuICAgIFwiMTA2MTRcIjogXCJsdGxhcnI7XCIsXG4gICAgXCIxMDYxNlwiOiBcImd0cmFycjtcIixcbiAgICBcIjEwNjE3XCI6IFwic3VicmFycjtcIixcbiAgICBcIjEwNjE5XCI6IFwic3VwbGFycjtcIixcbiAgICBcIjEwNjIwXCI6IFwibGZpc2h0O1wiLFxuICAgIFwiMTA2MjFcIjogXCJyZmlzaHQ7XCIsXG4gICAgXCIxMDYyMlwiOiBcInVmaXNodDtcIixcbiAgICBcIjEwNjIzXCI6IFwiZGZpc2h0O1wiLFxuICAgIFwiMTA2MjlcIjogXCJsb3BhcjtcIixcbiAgICBcIjEwNjMwXCI6IFwicm9wYXI7XCIsXG4gICAgXCIxMDYzNVwiOiBcImxicmtlO1wiLFxuICAgIFwiMTA2MzZcIjogXCJyYnJrZTtcIixcbiAgICBcIjEwNjM3XCI6IFwibGJya3NsdTtcIixcbiAgICBcIjEwNjM4XCI6IFwicmJya3NsZDtcIixcbiAgICBcIjEwNjM5XCI6IFwibGJya3NsZDtcIixcbiAgICBcIjEwNjQwXCI6IFwicmJya3NsdTtcIixcbiAgICBcIjEwNjQxXCI6IFwibGFuZ2Q7XCIsXG4gICAgXCIxMDY0MlwiOiBcInJhbmdkO1wiLFxuICAgIFwiMTA2NDNcIjogXCJscGFybHQ7XCIsXG4gICAgXCIxMDY0NFwiOiBcInJwYXJndDtcIixcbiAgICBcIjEwNjQ1XCI6IFwiZ3RsUGFyO1wiLFxuICAgIFwiMTA2NDZcIjogXCJsdHJQYXI7XCIsXG4gICAgXCIxMDY1MFwiOiBcInZ6aWd6YWc7XCIsXG4gICAgXCIxMDY1MlwiOiBcInZhbmdydDtcIixcbiAgICBcIjEwNjUzXCI6IFwiYW5ncnR2YmQ7XCIsXG4gICAgXCIxMDY2MFwiOiBcImFuZ2U7XCIsXG4gICAgXCIxMDY2MVwiOiBcInJhbmdlO1wiLFxuICAgIFwiMTA2NjJcIjogXCJkd2FuZ2xlO1wiLFxuICAgIFwiMTA2NjNcIjogXCJ1d2FuZ2xlO1wiLFxuICAgIFwiMTA2NjRcIjogXCJhbmdtc2RhYTtcIixcbiAgICBcIjEwNjY1XCI6IFwiYW5nbXNkYWI7XCIsXG4gICAgXCIxMDY2NlwiOiBcImFuZ21zZGFjO1wiLFxuICAgIFwiMTA2NjdcIjogXCJhbmdtc2RhZDtcIixcbiAgICBcIjEwNjY4XCI6IFwiYW5nbXNkYWU7XCIsXG4gICAgXCIxMDY2OVwiOiBcImFuZ21zZGFmO1wiLFxuICAgIFwiMTA2NzBcIjogXCJhbmdtc2RhZztcIixcbiAgICBcIjEwNjcxXCI6IFwiYW5nbXNkYWg7XCIsXG4gICAgXCIxMDY3MlwiOiBcImJlbXB0eXY7XCIsXG4gICAgXCIxMDY3M1wiOiBcImRlbXB0eXY7XCIsXG4gICAgXCIxMDY3NFwiOiBcImNlbXB0eXY7XCIsXG4gICAgXCIxMDY3NVwiOiBcInJhZW1wdHl2O1wiLFxuICAgIFwiMTA2NzZcIjogXCJsYWVtcHR5djtcIixcbiAgICBcIjEwNjc3XCI6IFwib2hiYXI7XCIsXG4gICAgXCIxMDY3OFwiOiBcIm9taWQ7XCIsXG4gICAgXCIxMDY3OVwiOiBcIm9wYXI7XCIsXG4gICAgXCIxMDY4MVwiOiBcIm9wZXJwO1wiLFxuICAgIFwiMTA2ODNcIjogXCJvbGNyb3NzO1wiLFxuICAgIFwiMTA2ODRcIjogXCJvZHNvbGQ7XCIsXG4gICAgXCIxMDY4NlwiOiBcIm9sY2lyO1wiLFxuICAgIFwiMTA2ODdcIjogXCJvZmNpcjtcIixcbiAgICBcIjEwNjg4XCI6IFwib2x0O1wiLFxuICAgIFwiMTA2ODlcIjogXCJvZ3Q7XCIsXG4gICAgXCIxMDY5MFwiOiBcImNpcnNjaXI7XCIsXG4gICAgXCIxMDY5MVwiOiBcImNpckU7XCIsXG4gICAgXCIxMDY5MlwiOiBcInNvbGI7XCIsXG4gICAgXCIxMDY5M1wiOiBcImJzb2xiO1wiLFxuICAgIFwiMTA2OTdcIjogXCJib3hib3g7XCIsXG4gICAgXCIxMDcwMVwiOiBcInRyaXNiO1wiLFxuICAgIFwiMTA3MDJcIjogXCJydHJpbHRyaTtcIixcbiAgICBcIjEwNzAzXCI6IFwiTGVmdFRyaWFuZ2xlQmFyO1wiLFxuICAgIFwiMTA3MDRcIjogXCJSaWdodFRyaWFuZ2xlQmFyO1wiLFxuICAgIFwiMTA3MTZcIjogXCJpaW5maW47XCIsXG4gICAgXCIxMDcxN1wiOiBcImluZmludGllO1wiLFxuICAgIFwiMTA3MThcIjogXCJudmluZmluO1wiLFxuICAgIFwiMTA3MjNcIjogXCJlcGFyc2w7XCIsXG4gICAgXCIxMDcyNFwiOiBcInNtZXBhcnNsO1wiLFxuICAgIFwiMTA3MjVcIjogXCJlcXZwYXJzbDtcIixcbiAgICBcIjEwNzMxXCI6IFwibG96ZjtcIixcbiAgICBcIjEwNzQwXCI6IFwiUnVsZURlbGF5ZWQ7XCIsXG4gICAgXCIxMDc0MlwiOiBcImRzb2w7XCIsXG4gICAgXCIxMDc1MlwiOiBcInhvZG90O1wiLFxuICAgIFwiMTA3NTNcIjogXCJ4b3BsdXM7XCIsXG4gICAgXCIxMDc1NFwiOiBcInhvdGltZTtcIixcbiAgICBcIjEwNzU2XCI6IFwieHVwbHVzO1wiLFxuICAgIFwiMTA3NThcIjogXCJ4c3FjdXA7XCIsXG4gICAgXCIxMDc2NFwiOiBcInFpbnQ7XCIsXG4gICAgXCIxMDc2NVwiOiBcImZwYXJ0aW50O1wiLFxuICAgIFwiMTA3NjhcIjogXCJjaXJmbmludDtcIixcbiAgICBcIjEwNzY5XCI6IFwiYXdpbnQ7XCIsXG4gICAgXCIxMDc3MFwiOiBcInJwcG9saW50O1wiLFxuICAgIFwiMTA3NzFcIjogXCJzY3BvbGludDtcIixcbiAgICBcIjEwNzcyXCI6IFwibnBvbGludDtcIixcbiAgICBcIjEwNzczXCI6IFwicG9pbnRpbnQ7XCIsXG4gICAgXCIxMDc3NFwiOiBcInF1YXRpbnQ7XCIsXG4gICAgXCIxMDc3NVwiOiBcImludGxhcmhrO1wiLFxuICAgIFwiMTA3ODZcIjogXCJwbHVzY2lyO1wiLFxuICAgIFwiMTA3ODdcIjogXCJwbHVzYWNpcjtcIixcbiAgICBcIjEwNzg4XCI6IFwic2ltcGx1cztcIixcbiAgICBcIjEwNzg5XCI6IFwicGx1c2R1O1wiLFxuICAgIFwiMTA3OTBcIjogXCJwbHVzc2ltO1wiLFxuICAgIFwiMTA3OTFcIjogXCJwbHVzdHdvO1wiLFxuICAgIFwiMTA3OTNcIjogXCJtY29tbWE7XCIsXG4gICAgXCIxMDc5NFwiOiBcIm1pbnVzZHU7XCIsXG4gICAgXCIxMDc5N1wiOiBcImxvcGx1cztcIixcbiAgICBcIjEwNzk4XCI6IFwicm9wbHVzO1wiLFxuICAgIFwiMTA3OTlcIjogXCJDcm9zcztcIixcbiAgICBcIjEwODAwXCI6IFwidGltZXNkO1wiLFxuICAgIFwiMTA4MDFcIjogXCJ0aW1lc2JhcjtcIixcbiAgICBcIjEwODAzXCI6IFwic21hc2hwO1wiLFxuICAgIFwiMTA4MDRcIjogXCJsb3RpbWVzO1wiLFxuICAgIFwiMTA4MDVcIjogXCJyb3RpbWVzO1wiLFxuICAgIFwiMTA4MDZcIjogXCJvdGltZXNhcztcIixcbiAgICBcIjEwODA3XCI6IFwiT3RpbWVzO1wiLFxuICAgIFwiMTA4MDhcIjogXCJvZGl2O1wiLFxuICAgIFwiMTA4MDlcIjogXCJ0cmlwbHVzO1wiLFxuICAgIFwiMTA4MTBcIjogXCJ0cmltaW51cztcIixcbiAgICBcIjEwODExXCI6IFwidHJpdGltZTtcIixcbiAgICBcIjEwODEyXCI6IFwiaXByb2Q7XCIsXG4gICAgXCIxMDgxNVwiOiBcImFtYWxnO1wiLFxuICAgIFwiMTA4MTZcIjogXCJjYXBkb3Q7XCIsXG4gICAgXCIxMDgxOFwiOiBcIm5jdXA7XCIsXG4gICAgXCIxMDgxOVwiOiBcIm5jYXA7XCIsXG4gICAgXCIxMDgyMFwiOiBcImNhcGFuZDtcIixcbiAgICBcIjEwODIxXCI6IFwiY3Vwb3I7XCIsXG4gICAgXCIxMDgyMlwiOiBcImN1cGNhcDtcIixcbiAgICBcIjEwODIzXCI6IFwiY2FwY3VwO1wiLFxuICAgIFwiMTA4MjRcIjogXCJjdXBicmNhcDtcIixcbiAgICBcIjEwODI1XCI6IFwiY2FwYnJjdXA7XCIsXG4gICAgXCIxMDgyNlwiOiBcImN1cGN1cDtcIixcbiAgICBcIjEwODI3XCI6IFwiY2FwY2FwO1wiLFxuICAgIFwiMTA4MjhcIjogXCJjY3VwcztcIixcbiAgICBcIjEwODI5XCI6IFwiY2NhcHM7XCIsXG4gICAgXCIxMDgzMlwiOiBcImNjdXBzc207XCIsXG4gICAgXCIxMDgzNVwiOiBcIkFuZDtcIixcbiAgICBcIjEwODM2XCI6IFwiT3I7XCIsXG4gICAgXCIxMDgzN1wiOiBcImFuZGFuZDtcIixcbiAgICBcIjEwODM4XCI6IFwib3JvcjtcIixcbiAgICBcIjEwODM5XCI6IFwib3JzbG9wZTtcIixcbiAgICBcIjEwODQwXCI6IFwiYW5kc2xvcGU7XCIsXG4gICAgXCIxMDg0MlwiOiBcImFuZHY7XCIsXG4gICAgXCIxMDg0M1wiOiBcIm9ydjtcIixcbiAgICBcIjEwODQ0XCI6IFwiYW5kZDtcIixcbiAgICBcIjEwODQ1XCI6IFwib3JkO1wiLFxuICAgIFwiMTA4NDdcIjogXCJ3ZWRiYXI7XCIsXG4gICAgXCIxMDg1NFwiOiBcInNkb3RlO1wiLFxuICAgIFwiMTA4NThcIjogXCJzaW1kb3Q7XCIsXG4gICAgXCIxMDg2MVwiOiBcImNvbmdkb3Q7XCIsXG4gICAgXCIxMDg2MlwiOiBcImVhc3RlcjtcIixcbiAgICBcIjEwODYzXCI6IFwiYXBhY2lyO1wiLFxuICAgIFwiMTA4NjRcIjogXCJhcEU7XCIsXG4gICAgXCIxMDg2NVwiOiBcImVwbHVzO1wiLFxuICAgIFwiMTA4NjZcIjogXCJwbHVzZTtcIixcbiAgICBcIjEwODY3XCI6IFwiRXNpbTtcIixcbiAgICBcIjEwODY4XCI6IFwiQ29sb25lO1wiLFxuICAgIFwiMTA4NjlcIjogXCJFcXVhbDtcIixcbiAgICBcIjEwODcxXCI6IFwiZUREb3Q7XCIsXG4gICAgXCIxMDg3MlwiOiBcImVxdWl2REQ7XCIsXG4gICAgXCIxMDg3M1wiOiBcImx0Y2lyO1wiLFxuICAgIFwiMTA4NzRcIjogXCJndGNpcjtcIixcbiAgICBcIjEwODc1XCI6IFwibHRxdWVzdDtcIixcbiAgICBcIjEwODc2XCI6IFwiZ3RxdWVzdDtcIixcbiAgICBcIjEwODc3XCI6IFwiTGVzc1NsYW50RXF1YWw7XCIsXG4gICAgXCIxMDg3OFwiOiBcIkdyZWF0ZXJTbGFudEVxdWFsO1wiLFxuICAgIFwiMTA4NzlcIjogXCJsZXNkb3Q7XCIsXG4gICAgXCIxMDg4MFwiOiBcImdlc2RvdDtcIixcbiAgICBcIjEwODgxXCI6IFwibGVzZG90bztcIixcbiAgICBcIjEwODgyXCI6IFwiZ2VzZG90bztcIixcbiAgICBcIjEwODgzXCI6IFwibGVzZG90b3I7XCIsXG4gICAgXCIxMDg4NFwiOiBcImdlc2RvdG9sO1wiLFxuICAgIFwiMTA4ODVcIjogXCJsZXNzYXBwcm94O1wiLFxuICAgIFwiMTA4ODZcIjogXCJndHJhcHByb3g7XCIsXG4gICAgXCIxMDg4N1wiOiBcImxuZXE7XCIsXG4gICAgXCIxMDg4OFwiOiBcImduZXE7XCIsXG4gICAgXCIxMDg4OVwiOiBcImxuYXBwcm94O1wiLFxuICAgIFwiMTA4OTBcIjogXCJnbmFwcHJveDtcIixcbiAgICBcIjEwODkxXCI6IFwibGVzc2VxcWd0cjtcIixcbiAgICBcIjEwODkyXCI6IFwiZ3RyZXFxbGVzcztcIixcbiAgICBcIjEwODkzXCI6IFwibHNpbWU7XCIsXG4gICAgXCIxMDg5NFwiOiBcImdzaW1lO1wiLFxuICAgIFwiMTA4OTVcIjogXCJsc2ltZztcIixcbiAgICBcIjEwODk2XCI6IFwiZ3NpbWw7XCIsXG4gICAgXCIxMDg5N1wiOiBcImxnRTtcIixcbiAgICBcIjEwODk4XCI6IFwiZ2xFO1wiLFxuICAgIFwiMTA4OTlcIjogXCJsZXNnZXM7XCIsXG4gICAgXCIxMDkwMFwiOiBcImdlc2xlcztcIixcbiAgICBcIjEwOTAxXCI6IFwiZXFzbGFudGxlc3M7XCIsXG4gICAgXCIxMDkwMlwiOiBcImVxc2xhbnRndHI7XCIsXG4gICAgXCIxMDkwM1wiOiBcImVsc2RvdDtcIixcbiAgICBcIjEwOTA0XCI6IFwiZWdzZG90O1wiLFxuICAgIFwiMTA5MDVcIjogXCJlbDtcIixcbiAgICBcIjEwOTA2XCI6IFwiZWc7XCIsXG4gICAgXCIxMDkwOVwiOiBcInNpbWw7XCIsXG4gICAgXCIxMDkxMFwiOiBcInNpbWc7XCIsXG4gICAgXCIxMDkxMVwiOiBcInNpbWxFO1wiLFxuICAgIFwiMTA5MTJcIjogXCJzaW1nRTtcIixcbiAgICBcIjEwOTEzXCI6IFwiTGVzc0xlc3M7XCIsXG4gICAgXCIxMDkxNFwiOiBcIkdyZWF0ZXJHcmVhdGVyO1wiLFxuICAgIFwiMTA5MTZcIjogXCJnbGo7XCIsXG4gICAgXCIxMDkxN1wiOiBcImdsYTtcIixcbiAgICBcIjEwOTE4XCI6IFwibHRjYztcIixcbiAgICBcIjEwOTE5XCI6IFwiZ3RjYztcIixcbiAgICBcIjEwOTIwXCI6IFwibGVzY2M7XCIsXG4gICAgXCIxMDkyMVwiOiBcImdlc2NjO1wiLFxuICAgIFwiMTA5MjJcIjogXCJzbXQ7XCIsXG4gICAgXCIxMDkyM1wiOiBcImxhdDtcIixcbiAgICBcIjEwOTI0XCI6IFwic210ZTtcIixcbiAgICBcIjEwOTI1XCI6IFwibGF0ZTtcIixcbiAgICBcIjEwOTI2XCI6IFwiYnVtcEU7XCIsXG4gICAgXCIxMDkyN1wiOiBcInByZWNlcTtcIixcbiAgICBcIjEwOTI4XCI6IFwic3VjY2VxO1wiLFxuICAgIFwiMTA5MzFcIjogXCJwckU7XCIsXG4gICAgXCIxMDkzMlwiOiBcInNjRTtcIixcbiAgICBcIjEwOTMzXCI6IFwicHJuRTtcIixcbiAgICBcIjEwOTM0XCI6IFwic3VjY25lcXE7XCIsXG4gICAgXCIxMDkzNVwiOiBcInByZWNhcHByb3g7XCIsXG4gICAgXCIxMDkzNlwiOiBcInN1Y2NhcHByb3g7XCIsXG4gICAgXCIxMDkzN1wiOiBcInBybmFwO1wiLFxuICAgIFwiMTA5MzhcIjogXCJzdWNjbmFwcHJveDtcIixcbiAgICBcIjEwOTM5XCI6IFwiUHI7XCIsXG4gICAgXCIxMDk0MFwiOiBcIlNjO1wiLFxuICAgIFwiMTA5NDFcIjogXCJzdWJkb3Q7XCIsXG4gICAgXCIxMDk0MlwiOiBcInN1cGRvdDtcIixcbiAgICBcIjEwOTQzXCI6IFwic3VicGx1cztcIixcbiAgICBcIjEwOTQ0XCI6IFwic3VwcGx1cztcIixcbiAgICBcIjEwOTQ1XCI6IFwic3VibXVsdDtcIixcbiAgICBcIjEwOTQ2XCI6IFwic3VwbXVsdDtcIixcbiAgICBcIjEwOTQ3XCI6IFwic3ViZWRvdDtcIixcbiAgICBcIjEwOTQ4XCI6IFwic3VwZWRvdDtcIixcbiAgICBcIjEwOTQ5XCI6IFwic3Vic2V0ZXFxO1wiLFxuICAgIFwiMTA5NTBcIjogXCJzdXBzZXRlcXE7XCIsXG4gICAgXCIxMDk1MVwiOiBcInN1YnNpbTtcIixcbiAgICBcIjEwOTUyXCI6IFwic3Vwc2ltO1wiLFxuICAgIFwiMTA5NTVcIjogXCJzdWJzZXRuZXFxO1wiLFxuICAgIFwiMTA5NTZcIjogXCJzdXBzZXRuZXFxO1wiLFxuICAgIFwiMTA5NTlcIjogXCJjc3ViO1wiLFxuICAgIFwiMTA5NjBcIjogXCJjc3VwO1wiLFxuICAgIFwiMTA5NjFcIjogXCJjc3ViZTtcIixcbiAgICBcIjEwOTYyXCI6IFwiY3N1cGU7XCIsXG4gICAgXCIxMDk2M1wiOiBcInN1YnN1cDtcIixcbiAgICBcIjEwOTY0XCI6IFwic3Vwc3ViO1wiLFxuICAgIFwiMTA5NjVcIjogXCJzdWJzdWI7XCIsXG4gICAgXCIxMDk2NlwiOiBcInN1cHN1cDtcIixcbiAgICBcIjEwOTY3XCI6IFwic3VwaHN1YjtcIixcbiAgICBcIjEwOTY4XCI6IFwic3VwZHN1YjtcIixcbiAgICBcIjEwOTY5XCI6IFwiZm9ya3Y7XCIsXG4gICAgXCIxMDk3MFwiOiBcInRvcGZvcms7XCIsXG4gICAgXCIxMDk3MVwiOiBcIm1sY3A7XCIsXG4gICAgXCIxMDk4MFwiOiBcIkRvdWJsZUxlZnRUZWU7XCIsXG4gICAgXCIxMDk4MlwiOiBcIlZkYXNobDtcIixcbiAgICBcIjEwOTgzXCI6IFwiQmFydjtcIixcbiAgICBcIjEwOTg0XCI6IFwidkJhcjtcIixcbiAgICBcIjEwOTg1XCI6IFwidkJhcnY7XCIsXG4gICAgXCIxMDk4N1wiOiBcIlZiYXI7XCIsXG4gICAgXCIxMDk4OFwiOiBcIk5vdDtcIixcbiAgICBcIjEwOTg5XCI6IFwiYk5vdDtcIixcbiAgICBcIjEwOTkwXCI6IFwicm5taWQ7XCIsXG4gICAgXCIxMDk5MVwiOiBcImNpcm1pZDtcIixcbiAgICBcIjEwOTkyXCI6IFwibWlkY2lyO1wiLFxuICAgIFwiMTA5OTNcIjogXCJ0b3BjaXI7XCIsXG4gICAgXCIxMDk5NFwiOiBcIm5ocGFyO1wiLFxuICAgIFwiMTA5OTVcIjogXCJwYXJzaW07XCIsXG4gICAgXCIxMTAwNVwiOiBcInBhcnNsO1wiLFxuICAgIFwiNjQyNTZcIjogXCJmZmxpZztcIixcbiAgICBcIjY0MjU3XCI6IFwiZmlsaWc7XCIsXG4gICAgXCI2NDI1OFwiOiBcImZsbGlnO1wiLFxuICAgIFwiNjQyNTlcIjogXCJmZmlsaWc7XCIsXG4gICAgXCI2NDI2MFwiOiBcImZmbGxpZztcIlxufSIsIkFuYWx5dGljcyAgICA9IHJlcXVpcmUgJy4vdXRpbHMvQW5hbHl0aWNzJ1xuQXV0aE1hbmFnZXIgID0gcmVxdWlyZSAnLi91dGlscy9BdXRoTWFuYWdlcidcblNoYXJlICAgICAgICA9IHJlcXVpcmUgJy4vdXRpbHMvU2hhcmUnXG5GYWNlYm9vayAgICAgPSByZXF1aXJlICcuL3V0aWxzL0ZhY2Vib29rJ1xuR29vZ2xlUGx1cyAgID0gcmVxdWlyZSAnLi91dGlscy9Hb29nbGVQbHVzJ1xuVGVtcGxhdGVzICAgID0gcmVxdWlyZSAnLi9kYXRhL1RlbXBsYXRlcydcbkxvY2FsZSAgICAgICA9IHJlcXVpcmUgJy4vZGF0YS9Mb2NhbGUnXG5Sb3V0ZXIgICAgICAgPSByZXF1aXJlICcuL3JvdXRlci9Sb3V0ZXInXG5OYXYgICAgICAgICAgPSByZXF1aXJlICcuL3JvdXRlci9OYXYnXG5BcHBEYXRhICAgICAgPSByZXF1aXJlICcuL0FwcERhdGEnXG5BcHBWaWV3ICAgICAgPSByZXF1aXJlICcuL0FwcFZpZXcnXG5NZWRpYVF1ZXJpZXMgPSByZXF1aXJlICcuL3V0aWxzL01lZGlhUXVlcmllcydcblxuY2xhc3MgQXBwXG5cbiAgICBMSVZFICAgICAgICA6IG51bGxcbiAgICBTSVRFX1VSTCAgICA6IHdpbmRvdy5jb25maWcuU0lURV9VUkxcbiAgICBCQVNFX1VSTCAgICA6IHdpbmRvdy5jb25maWcuaG9zdG5hbWVcbiAgICBBU1NFVFNfVVJMICA6IHdpbmRvdy5jb25maWcuYXNzZXRzX3VybFxuICAgIERPT0RMRVNfVVJMIDogd2luZG93LmNvbmZpZy5kb29kbGVzX3VybFxuICAgIEFQSV9IT1NUICAgIDogd2luZG93LmNvbmZpZy5BUElfSE9TVFxuICAgIGxvY2FsZUNvZGUgIDogd2luZG93LmNvbmZpZy5sb2NhbGVDb2RlXG4gICAgb2JqUmVhZHkgICAgOiAwXG5cbiAgICBfdG9DbGVhbiAgIDogWydvYmpSZWFkeScsICdzZXRGbGFncycsICdvYmplY3RDb21wbGV0ZScsICdpbml0JywgJ2luaXRPYmplY3RzJywgJ2luaXRTREtzJywgJ2luaXRBcHAnLCAnZ28nLCAnY2xlYW51cCcsICdfdG9DbGVhbiddXG5cbiAgICBjb25zdHJ1Y3RvciA6IChATElWRSkgLT5cblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgc2V0RmxhZ3MgOiA9PlxuXG4gICAgICAgIHVhID0gd2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKVxuXG4gICAgICAgIE1lZGlhUXVlcmllcy5zZXR1cCgpO1xuXG4gICAgICAgIEBJU19BTkRST0lEICAgID0gdWEuaW5kZXhPZignYW5kcm9pZCcpID4gLTFcbiAgICAgICAgQElTX0ZJUkVGT1ggICAgPSB1YS5pbmRleE9mKCdmaXJlZm94JykgPiAtMVxuICAgICAgICBASVNfQ0hST01FX0lPUyA9IGlmIHVhLm1hdGNoKCdjcmlvcycpIHRoZW4gdHJ1ZSBlbHNlIGZhbHNlICMgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTM4MDgwNTNcblxuICAgICAgICBudWxsXG5cbiAgICBvYmplY3RDb21wbGV0ZSA6ID0+XG5cbiAgICAgICAgQG9ialJlYWR5KytcbiAgICAgICAgQGluaXRBcHAoKSBpZiBAb2JqUmVhZHkgPj0gNFxuXG4gICAgICAgIG51bGxcblxuICAgIGluaXQgOiA9PlxuXG4gICAgICAgIEBpbml0T2JqZWN0cygpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgaW5pdE9iamVjdHMgOiA9PlxuXG4gICAgICAgIEBhcHBEYXRhICAgPSBuZXcgQXBwRGF0YSBAb2JqZWN0Q29tcGxldGVcbiAgICAgICAgQHRlbXBsYXRlcyA9IG5ldyBUZW1wbGF0ZXMgd2luZG93Ll9URU1QTEFURVMsIEBvYmplY3RDb21wbGV0ZVxuICAgICAgICBAbG9jYWxlICAgID0gbmV3IExvY2FsZSB3aW5kb3cuX0xPQ0FMRV9TVFJJTkdTLCBAb2JqZWN0Q29tcGxldGVcbiAgICAgICAgQGFuYWx5dGljcyA9IG5ldyBBbmFseXRpY3Mgd2luZG93Ll9UUkFDS0lORywgQG9iamVjdENvbXBsZXRlXG5cbiAgICAgICAgIyBpZiBuZXcgb2JqZWN0cyBhcmUgYWRkZWQgZG9uJ3QgZm9yZ2V0IHRvIGNoYW5nZSB0aGUgYEBvYmplY3RDb21wbGV0ZWAgZnVuY3Rpb25cblxuICAgICAgICBudWxsXG5cbiAgICBpbml0U0RLcyA6ID0+XG5cbiAgICAgICAgRmFjZWJvb2subG9hZCgpXG4gICAgICAgIEdvb2dsZVBsdXMubG9hZCgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgaW5pdEFwcCA6ID0+XG5cbiAgICAgICAgQHNldEZsYWdzKClcblxuICAgICAgICAjIyMgU3RhcnRzIGFwcGxpY2F0aW9uICMjI1xuICAgICAgICBAYXBwVmlldyA9IG5ldyBBcHBWaWV3XG4gICAgICAgIEByb3V0ZXIgID0gbmV3IFJvdXRlclxuICAgICAgICBAbmF2ICAgICA9IG5ldyBOYXZcbiAgICAgICAgQGF1dGggICAgPSBuZXcgQXV0aE1hbmFnZXJcbiAgICAgICAgQHNoYXJlICAgPSBuZXcgU2hhcmVcblxuICAgICAgICBAZ28oKVxuXG4gICAgICAgIEBpbml0U0RLcygpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgZ28gOiA9PlxuXG4gICAgICAgICMjIyBBZnRlciBldmVyeXRoaW5nIGlzIGxvYWRlZCwga2lja3Mgb2ZmIHdlYnNpdGUgIyMjXG4gICAgICAgIEBhcHBWaWV3LnJlbmRlcigpXG5cbiAgICAgICAgIyMjIHJlbW92ZSByZWR1bmRhbnQgaW5pdGlhbGlzYXRpb24gbWV0aG9kcyAvIHByb3BlcnRpZXMgIyMjXG4gICAgICAgIEBjbGVhbnVwKClcblxuICAgICAgICBudWxsXG5cbiAgICBjbGVhbnVwIDogPT5cblxuICAgICAgICBmb3IgZm4gaW4gQF90b0NsZWFuXG4gICAgICAgICAgICBAW2ZuXSA9IG51bGxcbiAgICAgICAgICAgIGRlbGV0ZSBAW2ZuXVxuXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBcHBcbiIsIkFic3RyYWN0RGF0YSAgICAgID0gcmVxdWlyZSAnLi9kYXRhL0Fic3RyYWN0RGF0YSdcblJlcXVlc3RlciAgICAgICAgID0gcmVxdWlyZSAnLi91dGlscy9SZXF1ZXN0ZXInXG5BUEkgICAgICAgICAgICAgICA9IHJlcXVpcmUgJy4vZGF0YS9BUEknXG5Eb29kbGVzQ29sbGVjdGlvbiA9IHJlcXVpcmUgJy4vY29sbGVjdGlvbnMvZG9vZGxlcy9Eb29kbGVzQ29sbGVjdGlvbidcblxuY2xhc3MgQXBwRGF0YSBleHRlbmRzIEFic3RyYWN0RGF0YVxuXG4gICAgY2FsbGJhY2sgOiBudWxsXG5cbiAgICBET09ETEVfQ0FDSEVfRFVSQVRJT04gOiAoKCgxMDAwICogNjApICogNjApICogMjQpICMgMjRocnNcblxuICAgIE9QVElPTlMgOlxuICAgICAgICBhdXRvcGxheSAgICAgIDogdHJ1ZVxuICAgICAgICBzaG93X2FwcHNfYnRuIDogZmFsc2VcblxuICAgIGNvbnN0cnVjdG9yIDogKEBjYWxsYmFjaykgLT5cblxuICAgICAgICBzdXBlcigpXG5cbiAgICAgICAgQGRvb2RsZXMgPSBuZXcgRG9vZGxlc0NvbGxlY3Rpb25cblxuICAgICAgICBAY2hlY2tEb29kbGVDYWNoZSgpXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgIGNoZWNrRG9vZGxlQ2FjaGUgOiA9PlxuXG4gICAgICAgIHJldHVybiB1bmxlc3MgY2hyb21lLnN0b3JhZ2Uuc3luY1xuXG4gICAgICAgIGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0IG51bGwsIChjYWNoZWREYXRhKSA9PlxuXG4gICAgICAgICAgICBpZiBfLmlzRW1wdHkgY2FjaGVkRGF0YVxuICAgICAgICAgICAgICAgIHJldHVybiBAZmV0Y2hEb29kbGVzKClcblxuICAgICAgICAgICAgQGNoZWNrT3B0aW9ucyBjYWNoZWREYXRhXG5cbiAgICAgICAgICAgIGNhY2hlZERvb2RsZXMgPSBbXVxuICAgICAgICAgICAgZm9yIGluZGV4LCBkYXRhIG9mIGNhY2hlZERhdGFcbiAgICAgICAgICAgICAgICBpZiBpbmRleCBpc250ICdsYXN0VXBkYXRlZCcgYW5kICFpbmRleC5tYXRjaCgvXm9wdGlvbl8vKVxuICAgICAgICAgICAgICAgICAgICBjYWNoZWREb29kbGVzLnB1c2goSlNPTi5wYXJzZShkYXRhKSlcblxuICAgICAgICAgICAgaWYgKChEYXRlLm5vdygpIC0gY2FjaGVkRGF0YS5sYXN0VXBkYXRlZCkgPiBARE9PRExFX0NBQ0hFX0RVUkFUSU9OKVxuICAgICAgICAgICAgICAgIEBmZXRjaERvb2RsZXMgY2FjaGVkRG9vZGxlc1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIEBzZXREb29kbGVzKGNhY2hlZERvb2RsZXMpLnNldEFjdGl2ZURvb2RsZSgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgZmV0Y2hEb29kbGVzIDogKGNhY2hlZERvb2RsZXM9ZmFsc2UpID0+XG5cbiAgICAgICAgciA9IFJlcXVlc3Rlci5yZXF1ZXN0XG4gICAgICAgICAgICB1cmwgIDogQVBJLmdldCgnZG9vZGxlcycpXG4gICAgICAgICAgICB0eXBlIDogJ0dFVCdcblxuICAgICAgICByLmRvbmUgKGRhdGEpID0+IEBvbkZldGNoRG9vZGxlc0RvbmUgZGF0YSwgY2FjaGVkRG9vZGxlc1xuICAgICAgICByLmZhaWwgKHJlcykgPT4gY29uc29sZS5lcnJvciBcImVycm9yIGxvYWRpbmcgYXBpIHN0YXJ0IGRhdGFcIiwgcmVzXG5cbiAgICAgICAgbnVsbFxuXG4gICAgb25GZXRjaERvb2RsZXNEb25lIDogKGRhdGEsIGNhY2hlZERvb2RsZXM9ZmFsc2UpID0+XG5cbiAgICAgICAgY29uc29sZS5sb2cgXCJvbkZldGNoRG9vZGxlc0RvbmUgOiAoZGF0YSkgPT5cIiwgZGF0YSwgY2FjaGVkRG9vZGxlc1xuXG4gICAgICAgIGlmIGNhY2hlZERvb2RsZXNcbiAgICAgICAgICAgIEB1cGRhdGVEb29kbGVzKF8uc2h1ZmZsZShkYXRhLmRvb2RsZXMpLCBjYWNoZWREb29kbGVzKS5zZXRBY3RpdmVEb29kbGUoKVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICBAc2V0RG9vZGxlcyhfLnNodWZmbGUoZGF0YS5kb29kbGVzKSkuc2V0QWN0aXZlRG9vZGxlKClcblxuICAgICAgICBudWxsXG5cbiAgICBzZXREb29kbGVzIDogKGRvb2RsZXMpID0+XG5cbiAgICAgICAgQGRvb2RsZXMuYWRkIGRvb2RsZXNcblxuICAgICAgICBAXG5cbiAgICB1cGRhdGVEb29kbGVzIDogKG5ld0Rvb2RsZXMsIGNhY2hlZERvb2RsZXMpID0+XG5cbiAgICAgICAgQGRvb2RsZXMuYWRkIGNhY2hlZERvb2RsZXNcbiAgICAgICAgQGRvb2RsZXMuYWRkTmV3IG5ld0Rvb2RsZXNcblxuICAgICAgICBAXG5cbiAgICBzZXRBY3RpdmVEb29kbGUgOiA9PlxuXG4gICAgICAgIEBhY3RpdmVEb29kbGUgPSBAZG9vZGxlcy5nZXROZXh0RG9vZGxlKClcbiAgICAgICAgQGNhbGxiYWNrPygpXG5cbiAgICAgICAgQHVwZGF0ZUNhY2hlKClcblxuICAgICAgICBudWxsXG5cbiAgICB1cGRhdGVDYWNoZSA6ID0+XG5cbiAgICAgICAgbmV3Q2FjaGUgPSBsYXN0VXBkYXRlZCA6IERhdGUubm93KClcbiAgICAgICAgKG5ld0NhY2hlW3Bvc2l0aW9uXSA9IEpTT04uc3RyaW5naWZ5IGRvb2RsZSkgZm9yIGRvb2RsZSwgcG9zaXRpb24gaW4gQGRvb2RsZXMubW9kZWxzXG5cbiAgICAgICAgY2hyb21lLnN0b3JhZ2Uuc3luYy5zZXQgbmV3Q2FjaGVcblxuICAgICAgICBudWxsXG5cbiAgICBjaGVja09wdGlvbnMgOiAoY2FjaGVkRGF0YSkgPT5cblxuICAgICAgICBmb3IgaW5kZXgsIGRhdGEgb2YgY2FjaGVkRGF0YVxuXG4gICAgICAgICAgICBpZiBpbmRleC5tYXRjaCgvXm9wdGlvbl8vKVxuXG4gICAgICAgICAgICAgICAgQE9QVElPTlNbIGluZGV4LnJlcGxhY2UoL15vcHRpb25fLywgJycpIF0gPSBkYXRhXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFwcERhdGFcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4vdmlldy9BYnN0cmFjdFZpZXcnXG5QcmVsb2FkZXIgICAgPSByZXF1aXJlICcuL3ZpZXcvYmFzZS9QcmVsb2FkZXInXG5IZWFkZXIgICAgICAgPSByZXF1aXJlICcuL3ZpZXcvYmFzZS9IZWFkZXInXG5XcmFwcGVyICAgICAgPSByZXF1aXJlICcuL3ZpZXcvYmFzZS9XcmFwcGVyJ1xuRm9vdGVyICAgICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvRm9vdGVyJ1xuU2hvd0FwcHNCdG4gID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvU2hvd0FwcHNCdG4nXG5Nb2RhbE1hbmFnZXIgPSByZXF1aXJlICcuL3ZpZXcvbW9kYWxzL19Nb2RhbE1hbmFnZXInXG5NZWRpYVF1ZXJpZXMgPSByZXF1aXJlICcuL3V0aWxzL01lZGlhUXVlcmllcydcblxuY2xhc3MgQXBwVmlldyBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG4gICAgdGVtcGxhdGUgOiAnbWFpbidcblxuICAgICR3aW5kb3cgIDogbnVsbFxuICAgICRib2R5ICAgIDogbnVsbFxuXG4gICAgd3JhcHBlciAgOiBudWxsXG4gICAgZm9vdGVyICAgOiBudWxsXG5cbiAgICBkaW1zIDpcbiAgICAgICAgdyA6IG51bGxcbiAgICAgICAgaCA6IG51bGxcbiAgICAgICAgbyA6IG51bGxcbiAgICAgICAgYyA6IG51bGxcblxuICAgICMgZXZlbnRzIDpcbiAgICAjICAgICAnY2xpY2sgYScgOiAnbGlua01hbmFnZXInXG5cbiAgICBFVkVOVF9VUERBVEVfRElNRU5TSU9OUyA6ICdFVkVOVF9VUERBVEVfRElNRU5TSU9OUydcblxuICAgIE1PQklMRV9XSURUSCA6IDcwMFxuICAgIE1PQklMRSAgICAgICA6ICdtb2JpbGUnXG4gICAgTk9OX01PQklMRSAgIDogJ25vbl9tb2JpbGUnXG5cbiAgICBjb25zdHJ1Y3RvciA6IC0+XG5cbiAgICAgICAgQCR3aW5kb3cgPSAkKHdpbmRvdylcbiAgICAgICAgQCRib2R5ICAgPSAkKCdib2R5JykuZXEoMClcblxuICAgICAgICBzdXBlcigpXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgIGRpc2FibGVUb3VjaDogPT5cblxuICAgICAgICBAJHdpbmRvdy5vbiAndG91Y2htb3ZlJywgQG9uVG91Y2hNb3ZlXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBlbmFibGVUb3VjaDogPT5cblxuICAgICAgICBAJHdpbmRvdy5vZmYgJ3RvdWNobW92ZScsIEBvblRvdWNoTW92ZVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgb25Ub3VjaE1vdmU6ICggZSApIC0+XG5cbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICByZW5kZXIgOiA9PlxuXG4gICAgICAgIEBiaW5kRXZlbnRzKClcblxuICAgICAgICBAcHJlbG9hZGVyICAgID0gbmV3IFByZWxvYWRlclxuICAgICAgICBAbW9kYWxNYW5hZ2VyID0gbmV3IE1vZGFsTWFuYWdlclxuXG4gICAgICAgIEBoZWFkZXIgID0gbmV3IEhlYWRlclxuICAgICAgICBAd3JhcHBlciA9IG5ldyBXcmFwcGVyXG4gICAgICAgIEBmb290ZXIgID0gbmV3IEZvb3RlclxuXG4gICAgICAgIEBcbiAgICAgICAgICAgIC5hZGRDaGlsZCBAaGVhZGVyXG4gICAgICAgICAgICAuYWRkQ2hpbGQgQHdyYXBwZXJcbiAgICAgICAgICAgIC5hZGRDaGlsZCBAZm9vdGVyXG5cbiAgICAgICAgQGNoZWNrT3B0aW9ucygpXG5cbiAgICAgICAgQG9uQWxsUmVuZGVyZWQoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgYmluZEV2ZW50cyA6ID0+XG5cbiAgICAgICAgQG9uICdhbGxSZW5kZXJlZCcsIEBvbkFsbFJlbmRlcmVkXG5cbiAgICAgICAgQG9uUmVzaXplKClcblxuICAgICAgICBAb25SZXNpemUgPSBfLmRlYm91bmNlIEBvblJlc2l6ZSwgMzAwXG4gICAgICAgIEAkd2luZG93Lm9uICdyZXNpemUgb3JpZW50YXRpb25jaGFuZ2UnLCBAb25SZXNpemVcblxuICAgICAgICByZXR1cm5cblxuICAgIG9uQWxsUmVuZGVyZWQgOiA9PlxuXG4gICAgICAgICMgY29uc29sZS5sb2cgXCJvbkFsbFJlbmRlcmVkIDogPT5cIlxuXG4gICAgICAgIEAkYm9keS5wcmVwZW5kIEAkZWxcblxuICAgICAgICBAYmVnaW4oKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgYmVnaW4gOiA9PlxuXG4gICAgICAgIEB0cmlnZ2VyICdzdGFydCdcblxuICAgICAgICBAQ0RfQ0UoKS5yb3V0ZXIuc3RhcnQoKVxuXG4gICAgICAgIEBwcmVsb2FkZXIuaGlkZSgpXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBvblJlc2l6ZSA6ID0+XG5cbiAgICAgICAgQGdldERpbXMoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgZ2V0RGltcyA6ID0+XG5cbiAgICAgICAgdyA9IHdpbmRvdy5pbm5lcldpZHRoIG9yIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCBvciBkb2N1bWVudC5ib2R5LmNsaWVudFdpZHRoXG4gICAgICAgIGggPSB3aW5kb3cuaW5uZXJIZWlnaHQgb3IgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCBvciBkb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodFxuXG4gICAgICAgIEBkaW1zID1cbiAgICAgICAgICAgIHcgOiB3XG4gICAgICAgICAgICBoIDogaFxuICAgICAgICAgICAgbyA6IGlmIGggPiB3IHRoZW4gJ3BvcnRyYWl0JyBlbHNlICdsYW5kc2NhcGUnXG4gICAgICAgICAgICBjIDogaWYgdyA8PSBATU9CSUxFX1dJRFRIIHRoZW4gQE1PQklMRSBlbHNlIEBOT05fTU9CSUxFXG5cbiAgICAgICAgQHRyaWdnZXIgQEVWRU5UX1VQREFURV9ESU1FTlNJT05TLCBAZGltc1xuXG4gICAgICAgIHJldHVyblxuXG4gICAgbGlua01hbmFnZXIgOiAoZSkgPT5cblxuICAgICAgICBocmVmID0gJChlLmN1cnJlbnRUYXJnZXQpLmF0dHIoJ2hyZWYnKVxuXG4gICAgICAgIHJldHVybiBmYWxzZSB1bmxlc3MgaHJlZlxuXG4gICAgICAgIEBuYXZpZ2F0ZVRvVXJsIGhyZWYsIGVcblxuICAgICAgICByZXR1cm5cblxuICAgIG5hdmlnYXRlVG9VcmwgOiAoIGhyZWYsIGUgPSBudWxsICkgPT5cblxuICAgICAgICByb3V0ZSAgID0gaWYgaHJlZi5tYXRjaChAQ0RfQ0UoKS5CQVNFX1VSTCkgdGhlbiBocmVmLnNwbGl0KEBDRF9DRSgpLkJBU0VfVVJMKVsxXSBlbHNlIGhyZWZcbiAgICAgICAgc2VjdGlvbiA9IGlmIHJvdXRlLmluZGV4T2YoJy8nKSBpcyAwIHRoZW4gcm91dGUuc3BsaXQoJy8nKVsxXSBlbHNlIHJvdXRlXG5cbiAgICAgICAgaWYgQENEX0NFKCkubmF2LmdldFNlY3Rpb24gc2VjdGlvblxuICAgICAgICAgICAgZT8ucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgICAgQENEX0NFKCkucm91dGVyLm5hdmlnYXRlVG8gcm91dGVcbiAgICAgICAgZWxzZSBcbiAgICAgICAgICAgIEBoYW5kbGVFeHRlcm5hbExpbmsgaHJlZlxuXG4gICAgICAgIHJldHVyblxuXG4gICAgaGFuZGxlRXh0ZXJuYWxMaW5rIDogKGRhdGEpID0+IFxuXG4gICAgICAgICMjI1xuXG4gICAgICAgIGJpbmQgdHJhY2tpbmcgZXZlbnRzIGlmIG5lY2Vzc2FyeVxuXG4gICAgICAgICMjI1xuXG4gICAgICAgIHJldHVyblxuXG4gICAgY2hlY2tPcHRpb25zIDogPT5cblxuICAgICAgICBpZiBAQ0RfQ0UoKS5hcHBEYXRhLk9QVElPTlMuc2hvd19hcHBzX2J0blxuXG4gICAgICAgICAgICBAc2hvd0FwcHNCdG4gPSBuZXcgU2hvd0FwcHNCdG5cbiAgICAgICAgICAgIEBhZGRDaGlsZCBAc2hvd0FwcHNCdG5cblxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQXBwVmlld1xuIiwiY2xhc3MgQWJzdHJhY3RDb2xsZWN0aW9uIGV4dGVuZHMgQmFja2JvbmUuQ29sbGVjdGlvblxuXG5cdENEX0NFIDogPT5cblxuXHRcdHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdENvbGxlY3Rpb25cbiIsIlRlbXBsYXRlTW9kZWwgPSByZXF1aXJlICcuLi8uLi9tb2RlbHMvY29yZS9UZW1wbGF0ZU1vZGVsJ1xuXG5jbGFzcyBUZW1wbGF0ZXNDb2xsZWN0aW9uIGV4dGVuZHMgQmFja2JvbmUuQ29sbGVjdGlvblxuXG5cdG1vZGVsIDogVGVtcGxhdGVNb2RlbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFRlbXBsYXRlc0NvbGxlY3Rpb25cbiIsIkFic3RyYWN0Q29sbGVjdGlvbiA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0Q29sbGVjdGlvbidcbkRvb2RsZU1vZGVsICAgICAgICA9IHJlcXVpcmUgJy4uLy4uL21vZGVscy9kb29kbGUvRG9vZGxlTW9kZWwnXG5cbmNsYXNzIERvb2RsZXNDb2xsZWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RDb2xsZWN0aW9uXG5cbiAgICBtb2RlbCA6IERvb2RsZU1vZGVsXG5cbiAgICBnZXREb29kbGVCeVNsdWcgOiAoc2x1ZykgPT5cblxuICAgICAgICBkb29kbGUgPSBAZmluZFdoZXJlIHNsdWcgOiBzbHVnXG5cbiAgICAgICAgaWYgIWRvb2RsZVxuICAgICAgICAgICAgY29uc29sZS5sb2cgXCJ5IHUgbm8gZG9vZGxlP1wiXG5cbiAgICAgICAgcmV0dXJuIGRvb2RsZVxuXG4gICAgZ2V0RG9vZGxlQnlOYXZTZWN0aW9uIDogKHdoaWNoU2VjdGlvbikgPT5cblxuICAgICAgICBzZWN0aW9uID0gQENEX0NFKCkubmF2W3doaWNoU2VjdGlvbl1cblxuICAgICAgICBkb29kbGUgPSBAZmluZFdoZXJlIHNsdWcgOiBcIiN7c2VjdGlvbi5zdWJ9LyN7c2VjdGlvbi50ZXJ9XCJcblxuICAgICAgICBkb29kbGVcblxuICAgIGdldFByZXZEb29kbGUgOiAoZG9vZGxlKSA9PlxuXG4gICAgICAgIGluZGV4ID0gQGluZGV4T2YgZG9vZGxlXG4gICAgICAgIGluZGV4LS1cblxuICAgICAgICBpZiBpbmRleCA8IDBcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXR1cm4gQGF0IGluZGV4XG5cbiAgICBnZXROZXh0RG9vZGxlIDogKGRvb2RsZSkgPT5cblxuICAgICAgICBpbmRleCA9IEBpbmRleE9mIGRvb2RsZVxuICAgICAgICBpbmRleCsrXG5cbiAgICAgICAgaWYgaW5kZXggPiAoQGxlbmd0aC5sZW5ndGgtMSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICBlbHNlXG4gICAgICAgICAgICByZXR1cm4gQGF0IGluZGV4XG5cbiAgICBhZGROZXcgOiAoZG9vZGxlcykgPT5cblxuICAgICAgICBmb3IgZG9vZGxlIGluIGRvb2RsZXNcbiAgICAgICAgICAgIGlmICFAZmluZFdoZXJlKCBpbmRleCA6IGRvb2RsZS5pbmRleCApXG4gICAgICAgICAgICAgICAgQGFkZCBkb29kbGVcblxuICAgICAgICBudWxsXG5cbiAgICBnZXROZXh0RG9vZGxlIDogPT5cblxuICAgICAgICBmb3IgZG9vZGxlIGluIEBtb2RlbHNcblxuICAgICAgICAgICAgaWYgIWRvb2RsZS5nZXQoJ3ZpZXdlZCcpXG4gICAgICAgICAgICAgICAgZG9vZGxlLnNldCgndmlld2VkJywgdHJ1ZSlcbiAgICAgICAgICAgICAgICBuZXh0RG9vZGxlID0gZG9vZGxlXG4gICAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICBpZiAhbmV4dERvb2RsZVxuICAgICAgICAgICAgY29uc29sZS5sb2cgJ3dhYWFhYSB1IHNlZW4gdGhlbSBhbGw/ISdcbiAgICAgICAgICAgIG5leHREb29kbGUgPSBfLnNodWZmbGUoQG1vZGVscylbMF1cblxuICAgICAgICBuZXh0RG9vZGxlXG5cbm1vZHVsZS5leHBvcnRzID0gRG9vZGxlc0NvbGxlY3Rpb25cbiIsIkFQSVJvdXRlTW9kZWwgPSByZXF1aXJlICcuLi9tb2RlbHMvY29yZS9BUElSb3V0ZU1vZGVsJ1xuXG5jbGFzcyBBUElcblxuXHRAbW9kZWwgOiBuZXcgQVBJUm91dGVNb2RlbFxuXG5cdEBnZXRDb250YW50cyA6ID0+XG5cblx0XHQjIyMgYWRkIG1vcmUgaWYgd2Ugd2FubmEgdXNlIGluIEFQSSBzdHJpbmdzICMjI1xuXHRcdEFQSV9IT1NUIDogQENEX0NFKCkuQVBJX0hPU1RcblxuXHRAZ2V0IDogKG5hbWUsIHZhcnMpID0+XG5cblx0XHR2YXJzID0gJC5leHRlbmQgdHJ1ZSwgdmFycywgQGdldENvbnRhbnRzKClcblx0XHRyZXR1cm4gQHN1cHBsYW50U3RyaW5nIEBtb2RlbC5nZXQobmFtZSksIHZhcnNcblxuXHRAc3VwcGxhbnRTdHJpbmcgOiAoc3RyLCB2YWxzKSAtPlxuXG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlIC97eyAoW157fV0qKSB9fS9nLCAoYSwgYikgLT5cblx0XHRcdHIgPSB2YWxzW2JdIG9yIGlmIHR5cGVvZiB2YWxzW2JdIGlzICdudW1iZXInIHRoZW4gdmFsc1tiXS50b1N0cmluZygpIGVsc2UgJydcblx0XHQoaWYgdHlwZW9mIHIgaXMgXCJzdHJpbmdcIiBvciB0eXBlb2YgciBpcyBcIm51bWJlclwiIHRoZW4gciBlbHNlIGEpXG5cblx0QENEX0NFIDogPT5cblxuXHRcdHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBBUElcbiIsImNsYXNzIEFic3RyYWN0RGF0YVxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdF8uZXh0ZW5kIEAsIEJhY2tib25lLkV2ZW50c1xuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRDRF9DRSA6ID0+XG5cblx0XHRyZXR1cm4gd2luZG93LkNEX0NFXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3REYXRhXG4iLCJMb2NhbGVzTW9kZWwgPSByZXF1aXJlICcuLi9tb2RlbHMvY29yZS9Mb2NhbGVzTW9kZWwnXG5BUEkgICAgICAgICAgPSByZXF1aXJlICcuLi9kYXRhL0FQSSdcblxuIyMjXG4jIExvY2FsZSBMb2FkZXIgI1xuXG5GaXJlcyBiYWNrIGFuIGV2ZW50IHdoZW4gY29tcGxldGVcblxuIyMjXG5jbGFzcyBMb2NhbGVcblxuICAgIGxhbmcgICAgIDogbnVsbFxuICAgIGRhdGEgICAgIDogbnVsbFxuICAgIGNhbGxiYWNrIDogbnVsbFxuICAgIGRlZmF1bHQgIDogJ2VuLWdiJ1xuXG4gICAgY29uc3RydWN0b3IgOiAoZGF0YSwgY2IpIC0+XG5cbiAgICAgICAgIyMjIHN0YXJ0IExvY2FsZSBMb2FkZXIsIGRlZmluZSBsb2NhbGUgYmFzZWQgb24gYnJvd3NlciBsYW5ndWFnZSAjIyNcblxuICAgICAgICBAY2FsbGJhY2sgPSBjYlxuXG4gICAgICAgIEBsYW5nID0gQGdldExhbmcoKVxuXG4gICAgICAgIEBwYXJzZURhdGEgZGF0YVxuXG4gICAgICAgIG51bGxcbiAgICAgICAgICAgIFxuICAgIGdldExhbmcgOiA9PlxuXG4gICAgICAgIGlmIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2ggYW5kIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gubWF0Y2goJ2xhbmc9JylcblxuICAgICAgICAgICAgbGFuZyA9IHdpbmRvdy5sb2NhdGlvbi5zZWFyY2guc3BsaXQoJ2xhbmc9JylbMV0uc3BsaXQoJyYnKVswXVxuXG4gICAgICAgIGVsc2UgaWYgd2luZG93LmNvbmZpZy5sb2NhbGVDb2RlXG5cbiAgICAgICAgICAgIGxhbmcgPSB3aW5kb3cuY29uZmlnLmxvY2FsZUNvZGVcblxuICAgICAgICBlbHNlXG5cbiAgICAgICAgICAgIGxhbmcgPSBAZGVmYXVsdFxuXG4gICAgICAgIGxhbmdcblxuICAgIHBhcnNlRGF0YSA6IChkYXRhKSA9PlxuXG4gICAgICAgICMjIyBGaXJlcyBiYWNrIGFuIGV2ZW50IG9uY2UgaXQncyBjb21wbGV0ZSAjIyNcblxuICAgICAgICBAZGF0YSA9IG5ldyBMb2NhbGVzTW9kZWwgZGF0YVxuICAgICAgICBAY2FsbGJhY2s/KClcblxuICAgICAgICBudWxsXG5cbiAgICBnZXQgOiAoaWQpID0+XG5cbiAgICAgICAgIyMjIGdldCBTdHJpbmcgZnJvbSBsb2NhbGVcbiAgICAgICAgKyBpZCA6IHN0cmluZyBpZCBvZiB0aGUgTG9jYWxpc2VkIFN0cmluZ1xuICAgICAgICAjIyNcblxuICAgICAgICByZXR1cm4gQGRhdGEuZ2V0U3RyaW5nIGlkXG5cbiAgICBnZXRMb2NhbGVJbWFnZSA6ICh1cmwpID0+XG5cbiAgICAgICAgcmV0dXJuIHdpbmRvdy5jb25maWcuQ0ROICsgXCIvaW1hZ2VzL2xvY2FsZS9cIiArIHdpbmRvdy5jb25maWcubG9jYWxlQ29kZSArIFwiL1wiICsgdXJsXG5cbm1vZHVsZS5leHBvcnRzID0gTG9jYWxlXG4iLCJUZW1wbGF0ZU1vZGVsICAgICAgID0gcmVxdWlyZSAnLi4vbW9kZWxzL2NvcmUvVGVtcGxhdGVNb2RlbCdcblRlbXBsYXRlc0NvbGxlY3Rpb24gPSByZXF1aXJlICcuLi9jb2xsZWN0aW9ucy9jb3JlL1RlbXBsYXRlc0NvbGxlY3Rpb24nXG5cbmNsYXNzIFRlbXBsYXRlc1xuXG4gICAgdGVtcGxhdGVzIDogbnVsbFxuICAgIGNiICAgICAgICA6IG51bGxcblxuICAgIGNvbnN0cnVjdG9yIDogKGRhdGEsIGNhbGxiYWNrKSAtPlxuXG4gICAgICAgIEBjYiA9IGNhbGxiYWNrXG5cbiAgICAgICAgQHBhcnNlRGF0YSBkYXRhXG4gICAgICAgICAgIFxuICAgICAgICBudWxsXG5cbiAgICBwYXJzZURhdGEgOiAoZGF0YSkgPT5cblxuICAgICAgICB0ZW1wID0gW11cblxuICAgICAgICBmb3IgaXRlbSBpbiBkYXRhLnRlbXBsYXRlXG4gICAgICAgICAgICB0ZW1wLnB1c2ggbmV3IFRlbXBsYXRlTW9kZWxcbiAgICAgICAgICAgICAgICBpZCAgIDogaXRlbS4kLmlkXG4gICAgICAgICAgICAgICAgdGV4dCA6IGl0ZW0uX1xuXG4gICAgICAgIEB0ZW1wbGF0ZXMgPSBuZXcgVGVtcGxhdGVzQ29sbGVjdGlvbiB0ZW1wXG5cbiAgICAgICAgQGNiPygpXG4gICAgICAgIFxuICAgICAgICBudWxsICAgICAgICBcblxuICAgIGdldCA6IChpZCkgPT5cblxuICAgICAgICB0ID0gQHRlbXBsYXRlcy53aGVyZSBpZCA6IGlkXG4gICAgICAgIHQgPSB0WzBdLmdldCAndGV4dCdcbiAgICAgICAgXG4gICAgICAgIHJldHVybiAkLnRyaW0gdFxuXG5tb2R1bGUuZXhwb3J0cyA9IFRlbXBsYXRlc1xuIiwiY2xhc3MgQWJzdHJhY3RNb2RlbCBleHRlbmRzIEJhY2tib25lLkRlZXBNb2RlbFxuXG5cdGNvbnN0cnVjdG9yIDogKGF0dHJzLCBvcHRpb24pIC0+XG5cblx0XHRhdHRycyA9IEBfZmlsdGVyQXR0cnMgYXR0cnNcblxuXHRcdHJldHVybiBCYWNrYm9uZS5EZWVwTW9kZWwuYXBwbHkgQCwgYXJndW1lbnRzXG5cblx0c2V0IDogKGF0dHJzLCBvcHRpb25zKSAtPlxuXG5cdFx0b3B0aW9ucyBvciAob3B0aW9ucyA9IHt9KVxuXG5cdFx0YXR0cnMgPSBAX2ZpbHRlckF0dHJzIGF0dHJzXG5cblx0XHRvcHRpb25zLmRhdGEgPSBKU09OLnN0cmluZ2lmeSBhdHRyc1xuXG5cdFx0cmV0dXJuIEJhY2tib25lLkRlZXBNb2RlbC5wcm90b3R5cGUuc2V0LmNhbGwgQCwgYXR0cnMsIG9wdGlvbnNcblxuXHRfZmlsdGVyQXR0cnMgOiAoYXR0cnMpID0+XG5cblx0XHRhdHRyc1xuXG5cdENEX0NFIDogPT5cblxuXHRcdHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdE1vZGVsXG4iLCJjbGFzcyBBUElSb3V0ZU1vZGVsIGV4dGVuZHMgQmFja2JvbmUuRGVlcE1vZGVsXG5cbiAgICBkZWZhdWx0cyA6XG5cbiAgICAgICAgZG9vZGxlcyA6IFwie3sgQVBJX0hPU1QgfX0vYXBpL2Rvb2RsZXNcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IEFQSVJvdXRlTW9kZWxcbiIsImNsYXNzIExvY2FsZXNNb2RlbCBleHRlbmRzIEJhY2tib25lLk1vZGVsXG5cbiAgICBkZWZhdWx0cyA6XG4gICAgICAgIGNvZGUgICAgIDogbnVsbFxuICAgICAgICBsYW5ndWFnZSA6IG51bGxcbiAgICAgICAgc3RyaW5ncyAgOiBudWxsXG4gICAgICAgICAgICBcbiAgICBnZXRfbGFuZ3VhZ2UgOiA9PlxuICAgICAgICByZXR1cm4gQGdldCgnbGFuZ3VhZ2UnKVxuXG4gICAgZ2V0U3RyaW5nIDogKGlkKSA9PlxuICAgICAgICAoKHJldHVybiBlIGlmKGEgaXMgaWQpKSBmb3IgYSwgZSBvZiB2WydzdHJpbmdzJ10pIGZvciBrLCB2IG9mIEBnZXQoJ3N0cmluZ3MnKVxuICAgICAgICBjb25zb2xlLndhcm4gXCJMb2NhbGVzIC0+IG5vdCBmb3VuZCBzdHJpbmc6ICN7aWR9XCJcbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IExvY2FsZXNNb2RlbFxuIiwiY2xhc3MgVGVtcGxhdGVNb2RlbCBleHRlbmRzIEJhY2tib25lLk1vZGVsXG5cblx0ZGVmYXVsdHMgOiBcblxuXHRcdGlkICAgOiBcIlwiXG5cdFx0dGV4dCA6IFwiXCJcblxubW9kdWxlLmV4cG9ydHMgPSBUZW1wbGF0ZU1vZGVsXG4iLCJBYnN0cmFjdE1vZGVsICAgICAgICA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0TW9kZWwnXG5OdW1iZXJVdGlscyAgICAgICAgICA9IHJlcXVpcmUgJy4uLy4uL3V0aWxzL051bWJlclV0aWxzJ1xuQ29kZVdvcmRUcmFuc2l0aW9uZXIgPSByZXF1aXJlICcuLi8uLi91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lcidcblxuY2xhc3MgRG9vZGxlTW9kZWwgZXh0ZW5kcyBBYnN0cmFjdE1vZGVsXG5cbiAgICBkZWZhdWx0cyA6XG4gICAgICAgICMgZnJvbSBtYW5pZmVzdFxuICAgICAgICBcImlkXCIgOiBcIlwiXG4gICAgICAgIFwiaW5kZXhcIjogXCJcIlxuICAgICAgICBcIm5hbWVcIiA6IFwiXCJcbiAgICAgICAgXCJhdXRob3JcIiA6XG4gICAgICAgICAgICBcIm5hbWVcIiAgICA6IFwiXCJcbiAgICAgICAgICAgIFwiZ2l0aHViXCIgIDogXCJcIlxuICAgICAgICAgICAgXCJ3ZWJzaXRlXCIgOiBcIlwiXG4gICAgICAgICAgICBcInR3aXR0ZXJcIiA6IFwiXCJcbiAgICAgICAgXCJpbnN0cnVjdGlvbnNcIjogXCJcIlxuICAgICAgICBcImRlc2NyaXB0aW9uXCI6IFwiXCJcbiAgICAgICAgXCJ0YWdzXCIgOiBbXVxuICAgICAgICBcImludGVyYWN0aW9uXCIgOlxuICAgICAgICAgICAgXCJtb3VzZVwiICAgIDogbnVsbFxuICAgICAgICAgICAgXCJrZXlib2FyZFwiIDogbnVsbFxuICAgICAgICAgICAgXCJ0b3VjaFwiICAgIDogbnVsbFxuICAgICAgICBcImNyZWF0ZWRcIiA6IFwiXCJcbiAgICAgICAgXCJzbHVnXCIgOiBcIlwiXG4gICAgICAgIFwic2hvcnRsaW5rXCIgOiBcIlwiXG4gICAgICAgIFwiY29sb3VyX3NjaGVtZVwiIDogXCJcIlxuICAgICAgICAjIHNpdGUtb25seVxuICAgICAgICBcImluZGV4X3BhZGRlZFwiIDogXCJcIlxuICAgICAgICBcImluZGV4SFRNTFwiIDogXCJcIlxuICAgICAgICBcInNvdXJjZVwiICAgIDogXCJcIlxuICAgICAgICBcInVybFwiICAgICAgIDogXCJcIlxuICAgICAgICBcInNjcmFtYmxlZFwiIDpcbiAgICAgICAgICAgIFwibmFtZVwiICAgICAgICA6IFwiXCJcbiAgICAgICAgICAgIFwiYXV0aG9yX25hbWVcIiA6IFwiXCJcbiAgICAgICAgXCJ2aWV3ZWRcIiA6IGZhbHNlXG5cbiAgICBjb25zdHJ1Y3RvciA6IC0+XG5cbiAgICAgICAgc3VwZXJcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgX2ZpbHRlckF0dHJzIDogKGF0dHJzKSA9PlxuXG4gICAgICAgIGlmIGF0dHJzLnNsdWdcbiAgICAgICAgICAgIGF0dHJzLnVybCA9IHdpbmRvdy5jb25maWcuaG9zdG5hbWUgKyAnLycgKyB3aW5kb3cuY29uZmlnLnJvdXRlcy5ET09ETEVTICsgJy8nICsgYXR0cnMuc2x1Z1xuXG4gICAgICAgIGlmIGF0dHJzLmluZGV4XG4gICAgICAgICAgICBhdHRycy5pbmRleF9wYWRkZWQgPSBOdW1iZXJVdGlscy56ZXJvRmlsbCBhdHRycy5pbmRleCwgM1xuICAgICAgICAgICAgYXR0cnMuaW5kZXhIVE1MICAgID0gQGdldEluZGV4SFRNTCBhdHRycy5pbmRleF9wYWRkZWRcblxuICAgICAgICBpZiBhdHRycy5uYW1lIGFuZCBhdHRycy5hdXRob3IubmFtZVxuICAgICAgICAgICAgYXR0cnMuc2NyYW1ibGVkID1cbiAgICAgICAgICAgICAgICBuYW1lICAgICAgICA6IENvZGVXb3JkVHJhbnNpdGlvbmVyLmdldFNjcmFtYmxlZFdvcmQgYXR0cnMubmFtZVxuICAgICAgICAgICAgICAgIGF1dGhvcl9uYW1lIDogQ29kZVdvcmRUcmFuc2l0aW9uZXIuZ2V0U2NyYW1ibGVkV29yZCBhdHRycy5hdXRob3IubmFtZVxuXG4gICAgICAgIGF0dHJzXG5cbiAgICBnZXRJbmRleEhUTUwgOiAoaW5kZXgpID0+XG5cbiAgICAgICAgaHRtbCA9IFwiXCJcblxuICAgICAgICBmb3IgY2hhciBpbiBpbmRleC5zcGxpdCgnJylcbiAgICAgICAgICAgIGNsYXNzTmFtZSA9IGlmIGNoYXIgaXMgJzAnIHRoZW4gJ2luZGV4LWNoYXItemVybycgZWxzZSAnaW5kZXgtY2hhci1ub256ZXJvJ1xuICAgICAgICAgICAgaHRtbCArPSBcIjxzcGFuIGNsYXNzPVxcXCIje2NsYXNzTmFtZX1cXFwiPiN7Y2hhcn08L3NwYW4+XCJcblxuICAgICAgICBodG1sXG5cbiAgICBnZXRBdXRob3JIdG1sIDogPT5cblxuICAgICAgICBwb3J0Zm9saW9fbGFiZWwgPSBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwibWlzY19wb3J0Zm9saW9fbGFiZWxcIlxuXG4gICAgICAgIGF0dHJzID0gQGdldCgnYXV0aG9yJylcbiAgICAgICAgaHRtbCAgPSBcIlwiXG4gICAgICAgIGxpbmtzID0gW11cblxuICAgICAgICBodG1sICs9IFwiI3thdHRycy5uYW1lfSBcXFxcIFwiXG5cbiAgICAgICAgaWYgYXR0cnMud2Vic2l0ZSB0aGVuIGxpbmtzLnB1c2ggXCI8YSBocmVmPVxcXCIje2F0dHJzLndlYnNpdGV9XFxcIiB0YXJnZXQ9XFxcIl9ibGFua1xcXCI+I3twb3J0Zm9saW9fbGFiZWx9PC9hPiBcIlxuICAgICAgICBpZiBhdHRycy50d2l0dGVyIHRoZW4gbGlua3MucHVzaCBcIjxhIGhyZWY9XFxcImh0dHA6Ly90d2l0dGVyLmNvbS8je2F0dHJzLnR3aXR0ZXJ9XFxcIiB0YXJnZXQ9XFxcIl9ibGFua1xcXCI+dHc8L2E+XCJcbiAgICAgICAgaWYgYXR0cnMuZ2l0aHViIHRoZW4gbGlua3MucHVzaCBcIjxhIGhyZWY9XFxcImh0dHA6Ly9naXRodWIuY29tLyN7YXR0cnMuZ2l0aHVifVxcXCIgdGFyZ2V0PVxcXCJfYmxhbmtcXFwiPmdoPC9hPlwiXG5cbiAgICAgICAgaHRtbCArPSBcIiN7bGlua3Muam9pbignIFxcXFwgJyl9XCJcblxuICAgICAgICBodG1sXG5cbm1vZHVsZS5leHBvcnRzID0gRG9vZGxlTW9kZWxcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4uL3ZpZXcvQWJzdHJhY3RWaWV3J1xuUm91dGVyICAgICAgID0gcmVxdWlyZSAnLi9Sb3V0ZXInXG5cbmNsYXNzIE5hdiBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG4gICAgQEVWRU5UX0NIQU5HRV9WSUVXICAgICA6ICdFVkVOVF9DSEFOR0VfVklFVydcbiAgICBARVZFTlRfQ0hBTkdFX1NVQl9WSUVXIDogJ0VWRU5UX0NIQU5HRV9TVUJfVklFVydcblxuICAgIHNlY3Rpb25zIDpcbiAgICAgICAgSE9NRSA6ICdpbmRleC5odG1sJ1xuXG4gICAgY3VycmVudCAgOiBhcmVhIDogbnVsbCwgc3ViIDogbnVsbFxuICAgIHByZXZpb3VzIDogYXJlYSA6IG51bGwsIHN1YiA6IG51bGxcblxuICAgIGNvbnN0cnVjdG9yOiAtPlxuXG4gICAgICAgIEBDRF9DRSgpLnJvdXRlci5vbiBSb3V0ZXIuRVZFTlRfSEFTSF9DSEFOR0VELCBAY2hhbmdlVmlld1xuXG4gICAgICAgIHJldHVybiBmYWxzZVxuXG4gICAgZ2V0U2VjdGlvbiA6IChzZWN0aW9uKSA9PlxuXG4gICAgICAgIGlmIHNlY3Rpb24gaXMgJycgdGhlbiByZXR1cm4gdHJ1ZVxuXG4gICAgICAgIGZvciBzZWN0aW9uTmFtZSwgdXJpIG9mIEBzZWN0aW9uc1xuICAgICAgICAgICAgaWYgdXJpIGlzIHNlY3Rpb24gdGhlbiByZXR1cm4gc2VjdGlvbk5hbWVcblxuICAgICAgICBmYWxzZVxuXG4gICAgY2hhbmdlVmlldzogKGFyZWEsIHN1YiwgcGFyYW1zKSA9PlxuXG4gICAgICAgIGNvbnNvbGUubG9nIFwiYXJlYVwiLGFyZWFcbiAgICAgICAgY29uc29sZS5sb2cgXCJzdWJcIixzdWJcbiAgICAgICAgY29uc29sZS5sb2cgXCJwYXJhbXNcIixwYXJhbXNcblxuICAgICAgICBAcHJldmlvdXMgPSBAY3VycmVudFxuICAgICAgICBAY3VycmVudCAgPSBhcmVhIDogYXJlYSwgc3ViIDogc3ViXG5cbiAgICAgICAgQHRyaWdnZXIgTmF2LkVWRU5UX0NIQU5HRV9WSUVXLCBAcHJldmlvdXMsIEBjdXJyZW50XG4gICAgICAgIEB0cmlnZ2VyIE5hdi5FVkVOVF9DSEFOR0VfU1VCX1ZJRVcsIEBjdXJyZW50XG5cbiAgICAgICAgaWYgQENEX0NFKCkuYXBwVmlldy5tb2RhbE1hbmFnZXIuaXNPcGVuKCkgdGhlbiBAQ0RfQ0UoKS5hcHBWaWV3Lm1vZGFsTWFuYWdlci5oaWRlT3Blbk1vZGFsKClcblxuICAgICAgICAjIEB0cmFja1BhZ2VWaWV3KClcblxuICAgICAgICBudWxsXG5cbiAgICAjIHRyYWNrUGFnZVZpZXcgOiA9PlxuXG4gICAgIyAgICAgcmV0dXJuIHVubGVzcyB3aW5kb3cuZ2EgYW5kIEBjaGFuZ2VWaWV3Q291bnQgPiAxXG5cbiAgICAjICAgICBnYSAnc2VuZCcsICdwYWdldmlldycsICdwYWdlJyA6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLnNwbGl0KEBDRCgpLkJBU0VfVVJMKVsxXSBvciAnLydcblxuICAgICMgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBOYXZcbiIsImNsYXNzIFJvdXRlciBleHRlbmRzIEJhY2tib25lLlJvdXRlclxuXG4gICAgQEVWRU5UX0hBU0hfQ0hBTkdFRCA6ICdFVkVOVF9IQVNIX0NIQU5HRUQnXG5cbiAgICBGSVJTVF9ST1VURSA6IHRydWVcblxuICAgIHJvdXRlcyA6XG4gICAgICAgICcoLykoOmFyZWEpKC86c3ViKSgvKScgOiAnaGFzaENoYW5nZWQnXG4gICAgICAgICcqYWN0aW9ucycgICAgICAgICAgICAgOiAnbmF2aWdhdGVUbydcblxuICAgIGFyZWEgICA6IG51bGxcbiAgICBzdWIgICAgOiBudWxsXG4gICAgcGFyYW1zIDogbnVsbFxuXG4gICAgc3RhcnQgOiA9PlxuXG4gICAgICAgIEJhY2tib25lLmhpc3Rvcnkuc3RhcnQgXG4gICAgICAgICAgICBwdXNoU3RhdGUgOiB0cnVlXG4gICAgICAgICAgICByb290ICAgICAgOiAnLydcblxuICAgICAgICBudWxsXG5cbiAgICBoYXNoQ2hhbmdlZCA6IChAYXJlYSA9IG51bGwsIEBzdWIgPSBudWxsKSA9PlxuXG4gICAgICAgIGNvbnNvbGUubG9nIFwiPj4gRVZFTlRfSEFTSF9DSEFOR0VEIEBhcmVhID0gI3tAYXJlYX0sIEBzdWIgPSAje0BzdWJ9IDw8XCJcblxuICAgICAgICBpZiBARklSU1RfUk9VVEUgdGhlbiBARklSU1RfUk9VVEUgPSBmYWxzZVxuXG4gICAgICAgIGlmICFAYXJlYSB0aGVuIEBhcmVhID0gQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUVcblxuICAgICAgICBAdHJpZ2dlciBSb3V0ZXIuRVZFTlRfSEFTSF9DSEFOR0VELCBAYXJlYSwgQHN1YiwgQHBhcmFtc1xuXG4gICAgICAgIG51bGxcblxuICAgIG5hdmlnYXRlVG8gOiAod2hlcmUgPSAnJywgdHJpZ2dlciA9IHRydWUsIHJlcGxhY2UgPSBmYWxzZSwgQHBhcmFtcykgPT5cblxuICAgICAgICBpZiB3aGVyZS5jaGFyQXQoMCkgaXNudCBcIi9cIlxuICAgICAgICAgICAgd2hlcmUgPSBcIi8je3doZXJlfVwiXG4gICAgICAgIGlmIHdoZXJlLmNoYXJBdCggd2hlcmUubGVuZ3RoLTEgKSBpc250IFwiL1wiXG4gICAgICAgICAgICB3aGVyZSA9IFwiI3t3aGVyZX0vXCJcblxuICAgICAgICBpZiAhdHJpZ2dlclxuICAgICAgICAgICAgQHRyaWdnZXIgUm91dGVyLkVWRU5UX0hBU0hfQ0hBTkdFRCwgd2hlcmUsIG51bGwsIEBwYXJhbXNcbiAgICAgICAgICAgIHJldHVyblxuXG4gICAgICAgIEBuYXZpZ2F0ZSB3aGVyZSwgdHJpZ2dlcjogdHJ1ZSwgcmVwbGFjZTogcmVwbGFjZVxuXG4gICAgICAgIG51bGxcblxuICAgIENEX0NFIDogPT5cblxuICAgICAgICByZXR1cm4gd2luZG93LkNEX0NFXG5cbm1vZHVsZS5leHBvcnRzID0gUm91dGVyXG4iLCIjIyNcbkFuYWx5dGljcyB3cmFwcGVyXG4jIyNcbmNsYXNzIEFuYWx5dGljc1xuXG4gICAgdGFncyAgICA6IG51bGxcbiAgICBzdGFydGVkIDogZmFsc2VcblxuICAgIGF0dGVtcHRzICAgICAgICA6IDBcbiAgICBhbGxvd2VkQXR0ZW1wdHMgOiA1XG5cbiAgICBjb25zdHJ1Y3RvciA6IChkYXRhLCBAY2FsbGJhY2spIC0+XG5cbiAgICAgICAgQHBhcnNlRGF0YSBkYXRhXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxuICAgIHBhcnNlRGF0YSA6IChkYXRhKSA9PlxuXG4gICAgICAgIEB0YWdzICAgID0gZGF0YVxuICAgICAgICBAc3RhcnRlZCA9IHRydWVcbiAgICAgICAgQGNhbGxiYWNrPygpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgIyMjXG4gICAgQHBhcmFtIHN0cmluZyBpZCBvZiB0aGUgdHJhY2tpbmcgdGFnIHRvIGJlIHB1c2hlZCBvbiBBbmFseXRpY3MgXG4gICAgIyMjXG4gICAgdHJhY2sgOiAocGFyYW0pID0+XG5cbiAgICAgICAgcmV0dXJuIGlmICFAc3RhcnRlZFxuXG4gICAgICAgIGlmIHBhcmFtXG5cbiAgICAgICAgICAgIHYgPSBAdGFnc1twYXJhbV1cblxuICAgICAgICAgICAgaWYgdlxuXG4gICAgICAgICAgICAgICAgYXJncyA9IFsnc2VuZCcsICdldmVudCddXG4gICAgICAgICAgICAgICAgKCBhcmdzLnB1c2goYXJnKSApIGZvciBhcmcgaW4gdlxuXG4gICAgICAgICAgICAgICAgIyBsb2FkaW5nIEdBIGFmdGVyIG1haW4gYXBwIEpTLCBzbyBleHRlcm5hbCBzY3JpcHQgbWF5IG5vdCBiZSBoZXJlIHlldFxuICAgICAgICAgICAgICAgIGlmIHdpbmRvdy5nYVxuICAgICAgICAgICAgICAgICAgICBnYS5hcHBseSBudWxsLCBhcmdzXG4gICAgICAgICAgICAgICAgZWxzZSBpZiBAYXR0ZW1wdHMgPj0gQGFsbG93ZWRBdHRlbXB0c1xuICAgICAgICAgICAgICAgICAgICBAc3RhcnRlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0ID0+XG4gICAgICAgICAgICAgICAgICAgICAgICBAdHJhY2sgcGFyYW1cbiAgICAgICAgICAgICAgICAgICAgICAgIEBhdHRlbXB0cysrXG4gICAgICAgICAgICAgICAgICAgICwgMjAwMFxuXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBbmFseXRpY3NcbiIsIkFic3RyYWN0RGF0YSA9IHJlcXVpcmUgJy4uL2RhdGEvQWJzdHJhY3REYXRhJ1xuRmFjZWJvb2sgICAgID0gcmVxdWlyZSAnLi4vdXRpbHMvRmFjZWJvb2snXG5Hb29nbGVQbHVzICAgPSByZXF1aXJlICcuLi91dGlscy9Hb29nbGVQbHVzJ1xuXG5jbGFzcyBBdXRoTWFuYWdlciBleHRlbmRzIEFic3RyYWN0RGF0YVxuXG5cdHVzZXJEYXRhICA6IG51bGxcblxuXHQjIEBwcm9jZXNzIHRydWUgZHVyaW5nIGxvZ2luIHByb2Nlc3Ncblx0cHJvY2VzcyAgICAgIDogZmFsc2Vcblx0cHJvY2Vzc1RpbWVyIDogbnVsbFxuXHRwcm9jZXNzV2FpdCAgOiA1MDAwXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0QHVzZXJEYXRhICA9IEBDRF9DRSgpLmFwcERhdGEuVVNFUlxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRsb2dpbiA6IChzZXJ2aWNlLCBjYj1udWxsKSA9PlxuXG5cdFx0IyBjb25zb2xlLmxvZyBcIisrKysgUFJPQ0VTUyBcIixAcHJvY2Vzc1xuXG5cdFx0cmV0dXJuIGlmIEBwcm9jZXNzXG5cblx0XHRAc2hvd0xvYWRlcigpXG5cdFx0QHByb2Nlc3MgPSB0cnVlXG5cblx0XHQkZGF0YURmZCA9ICQuRGVmZXJyZWQoKVxuXG5cdFx0c3dpdGNoIHNlcnZpY2Vcblx0XHRcdHdoZW4gJ2dvb2dsZSdcblx0XHRcdFx0R29vZ2xlUGx1cy5sb2dpbiAkZGF0YURmZFxuXHRcdFx0d2hlbiAnZmFjZWJvb2snXG5cdFx0XHRcdEZhY2Vib29rLmxvZ2luICRkYXRhRGZkXG5cblx0XHQkZGF0YURmZC5kb25lIChyZXMpID0+IEBhdXRoU3VjY2VzcyBzZXJ2aWNlLCByZXNcblx0XHQkZGF0YURmZC5mYWlsIChyZXMpID0+IEBhdXRoRmFpbCBzZXJ2aWNlLCByZXNcblx0XHQkZGF0YURmZC5hbHdheXMgKCkgPT4gQGF1dGhDYWxsYmFjayBjYlxuXG5cdFx0IyMjXG5cdFx0VW5mb3J0dW5hdGVseSBubyBjYWxsYmFjayBpcyBmaXJlZCBpZiB1c2VyIG1hbnVhbGx5IGNsb3NlcyBHKyBsb2dpbiBtb2RhbCxcblx0XHRzbyB0aGlzIGlzIHRvIGFsbG93IHRoZW0gdG8gY2xvc2Ugd2luZG93IGFuZCB0aGVuIHN1YnNlcXVlbnRseSB0cnkgdG8gbG9nIGluIGFnYWluLi4uXG5cdFx0IyMjXG5cdFx0QHByb2Nlc3NUaW1lciA9IHNldFRpbWVvdXQgQGF1dGhDYWxsYmFjaywgQHByb2Nlc3NXYWl0XG5cblx0XHQkZGF0YURmZFxuXG5cdGF1dGhTdWNjZXNzIDogKHNlcnZpY2UsIGRhdGEpID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwibG9naW4gY2FsbGJhY2sgZm9yICN7c2VydmljZX0sIGRhdGEgPT4gXCIsIGRhdGFcblxuXHRcdG51bGxcblxuXHRhdXRoRmFpbCA6IChzZXJ2aWNlLCBkYXRhKSA9PlxuXG5cdFx0IyBjb25zb2xlLmxvZyBcImxvZ2luIGZhaWwgZm9yICN7c2VydmljZX0gPT4gXCIsIGRhdGFcblxuXHRcdG51bGxcblxuXHRhdXRoQ2FsbGJhY2sgOiAoY2I9bnVsbCkgPT5cblxuXHRcdHJldHVybiB1bmxlc3MgQHByb2Nlc3NcblxuXHRcdGNsZWFyVGltZW91dCBAcHJvY2Vzc1RpbWVyXG5cblx0XHRAaGlkZUxvYWRlcigpXG5cdFx0QHByb2Nlc3MgPSBmYWxzZVxuXG5cdFx0Y2I/KClcblxuXHRcdG51bGxcblxuXHQjIyNcblx0c2hvdyAvIGhpZGUgc29tZSBVSSBpbmRpY2F0b3IgdGhhdCB3ZSBhcmUgd2FpdGluZyBmb3Igc29jaWFsIG5ldHdvcmsgdG8gcmVzcG9uZFxuXHQjIyNcblx0c2hvd0xvYWRlciA6ID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwic2hvd0xvYWRlclwiXG5cblx0XHRudWxsXG5cblx0aGlkZUxvYWRlciA6ID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwiaGlkZUxvYWRlclwiXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQXV0aE1hbmFnZXJcbiIsImVuY29kZSA9IHJlcXVpcmUgJ2VudC9lbmNvZGUnXG5cbmNsYXNzIENvZGVXb3JkVHJhbnNpdGlvbmVyXG5cblx0QGNvbmZpZyA6XG5cdFx0TUlOX1dST05HX0NIQVJTIDogMVxuXHRcdE1BWF9XUk9OR19DSEFSUyA6IDdcblxuXHRcdE1JTl9DSEFSX0lOX0RFTEFZIDogNDBcblx0XHRNQVhfQ0hBUl9JTl9ERUxBWSA6IDcwXG5cblx0XHRNSU5fQ0hBUl9PVVRfREVMQVkgOiA0MFxuXHRcdE1BWF9DSEFSX09VVF9ERUxBWSA6IDcwXG5cblx0XHRDSEFSUyA6ICdhYmNkZWZoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSE/KigpQMKjJCVeJl8tKz1bXXt9OjtcXCdcIlxcXFx8PD4sLi9+YCcuc3BsaXQoJycpLm1hcChlbmNvZGUpXG5cblx0XHRDSEFSX1RFTVBMQVRFIDogXCI8c3BhbiBkYXRhLWNvZGV0ZXh0LWNoYXI9XFxcInt7IGNoYXIgfX1cXFwiIGRhdGEtY29kZXRleHQtY2hhci1zdGF0ZT1cXFwie3sgc3RhdGUgfX1cXFwiPnt7IGNoYXIgfX08L3NwYW4+XCJcblxuXHRAX3dvcmRDYWNoZSA6IHt9XG5cblx0QF9nZXRXb3JkRnJvbUNhY2hlIDogKCRlbCwgaW5pdGlhbFN0YXRlPW51bGwpID0+XG5cblx0XHRpZCA9ICRlbC5hdHRyKCdkYXRhLWNvZGV3b3JkLWlkJylcblxuXHRcdGlmIGlkIGFuZCBAX3dvcmRDYWNoZVsgaWQgXVxuXHRcdFx0d29yZCA9IEBfd29yZENhY2hlWyBpZCBdXG5cdFx0ZWxzZVxuXHRcdFx0QF93cmFwQ2hhcnMgJGVsLCBpbml0aWFsU3RhdGVcblx0XHRcdHdvcmQgPSBAX2FkZFdvcmRUb0NhY2hlICRlbFxuXG5cdFx0d29yZFxuXG5cdEBfYWRkV29yZFRvQ2FjaGUgOiAoJGVsKSA9PlxuXG5cdFx0Y2hhcnMgPSBbXVxuXG5cdFx0JGVsLmZpbmQoJ1tkYXRhLWNvZGV0ZXh0LWNoYXJdJykuZWFjaCAoaSwgZWwpID0+XG5cdFx0XHQkY2hhckVsID0gJChlbClcblx0XHRcdGNoYXJzLnB1c2hcblx0XHRcdFx0JGVsICAgICAgICA6ICRjaGFyRWxcblx0XHRcdFx0cmlnaHRDaGFyICA6ICRjaGFyRWwuYXR0cignZGF0YS1jb2RldGV4dC1jaGFyJylcblxuXHRcdGlkID0gXy51bmlxdWVJZCgpXG5cdFx0JGVsLmF0dHIgJ2RhdGEtY29kZXdvcmQtaWQnLCBpZFxuXG5cdFx0QF93b3JkQ2FjaGVbIGlkIF0gPVxuXHRcdFx0d29yZCAgICA6IF8ucGx1Y2soY2hhcnMsICdyaWdodENoYXInKS5qb2luKCcnKVxuXHRcdFx0JGVsICAgICA6ICRlbFxuXHRcdFx0Y2hhcnMgICA6IGNoYXJzXG5cdFx0XHR2aXNpYmxlIDogdHJ1ZVxuXG5cdFx0QF93b3JkQ2FjaGVbIGlkIF1cblxuXHRAX3dyYXBDaGFycyA6ICgkZWwsIGluaXRpYWxTdGF0ZT1udWxsKSA9PlxuXG5cdFx0Y2hhcnMgPSAkZWwudGV4dCgpLnNwbGl0KCcnKVxuXHRcdHN0YXRlID0gaW5pdGlhbFN0YXRlIG9yICRlbC5hdHRyKCdkYXRhLWNvZGV3b3JkLWluaXRpYWwtc3RhdGUnKSBvciBcIlwiXG5cdFx0aHRtbCA9IFtdXG5cdFx0Zm9yIGNoYXIgaW4gY2hhcnNcblx0XHRcdGlmIGNoYXIgaXMgJyAnIHRoZW4gY2hhciA9ICcmbmJzcDsnXG5cdFx0XHRodG1sLnB1c2ggQF9zdXBwbGFudFN0cmluZyBAY29uZmlnLkNIQVJfVEVNUExBVEUsIGNoYXIgOiBjaGFyLCBzdGF0ZTogc3RhdGVcblxuXHRcdCRlbC5odG1sIGh0bWwuam9pbignJylcblxuXHRcdG51bGxcblxuXHQjIEBwYXJhbSB0YXJnZXQgPSAncmlnaHQnLCAnd3JvbmcnLCAnZW1wdHknXG5cdEBfcHJlcGFyZVdvcmQgOiAod29yZCwgdGFyZ2V0LCBjaGFyU3RhdGU9JycpID0+XG5cblx0XHRmb3IgY2hhciwgaSBpbiB3b3JkLmNoYXJzXG5cblx0XHRcdHRhcmdldENoYXIgPSBzd2l0Y2ggdHJ1ZVxuXHRcdFx0XHR3aGVuIHRhcmdldCBpcyAncmlnaHQnIHRoZW4gY2hhci5yaWdodENoYXJcblx0XHRcdFx0d2hlbiB0YXJnZXQgaXMgJ3dyb25nJyB0aGVuIEBfZ2V0UmFuZG9tQ2hhcigpXG5cdFx0XHRcdHdoZW4gdGFyZ2V0IGlzICdlbXB0eScgdGhlbiAnJ1xuXHRcdFx0XHRlbHNlIHRhcmdldC5jaGFyQXQoaSkgb3IgJydcblxuXHRcdFx0aWYgdGFyZ2V0Q2hhciBpcyAnICcgdGhlbiB0YXJnZXRDaGFyID0gJyZuYnNwOydcblxuXHRcdFx0Y2hhci53cm9uZ0NoYXJzID0gQF9nZXRSYW5kb21Xcm9uZ0NoYXJzKClcblx0XHRcdGNoYXIudGFyZ2V0Q2hhciA9IHRhcmdldENoYXJcblx0XHRcdGNoYXIuY2hhclN0YXRlICA9IGNoYXJTdGF0ZVxuXG5cdFx0bnVsbFxuXG5cdEBfZ2V0UmFuZG9tV3JvbmdDaGFycyA6ID0+XG5cblx0XHRjaGFycyA9IFtdXG5cblx0XHRjaGFyQ291bnQgPSBfLnJhbmRvbSBAY29uZmlnLk1JTl9XUk9OR19DSEFSUywgQGNvbmZpZy5NQVhfV1JPTkdfQ0hBUlNcblxuXHRcdGZvciBpIGluIFswLi4uY2hhckNvdW50XVxuXHRcdFx0Y2hhcnMucHVzaFxuXHRcdFx0XHRjaGFyICAgICA6IEBfZ2V0UmFuZG9tQ2hhcigpXG5cdFx0XHRcdGluRGVsYXkgIDogXy5yYW5kb20gQGNvbmZpZy5NSU5fQ0hBUl9JTl9ERUxBWSwgQGNvbmZpZy5NQVhfQ0hBUl9JTl9ERUxBWVxuXHRcdFx0XHRvdXREZWxheSA6IF8ucmFuZG9tIEBjb25maWcuTUlOX0NIQVJfT1VUX0RFTEFZLCBAY29uZmlnLk1BWF9DSEFSX09VVF9ERUxBWVxuXG5cdFx0Y2hhcnNcblxuXHRAX2dldFJhbmRvbUNoYXIgOiA9PlxuXG5cdFx0Y2hhciA9IEBjb25maWcuQ0hBUlNbIF8ucmFuZG9tKDAsIEBjb25maWcuQ0hBUlMubGVuZ3RoLTEpIF1cblxuXHRcdGNoYXJcblxuXHRAX2dldExvbmdlc3RDaGFyRHVyYXRpb24gOiAoY2hhcnMpID0+XG5cblx0XHRsb25nZXN0VGltZSA9IDBcblx0XHRsb25nZXN0VGltZUlkeCA9IDBcblxuXHRcdGZvciBjaGFyLCBpIGluIGNoYXJzXG5cblx0XHRcdHRpbWUgPSAwXG5cdFx0XHQodGltZSArPSB3cm9uZ0NoYXIuaW5EZWxheSArIHdyb25nQ2hhci5vdXREZWxheSkgZm9yIHdyb25nQ2hhciBpbiBjaGFyLndyb25nQ2hhcnNcblx0XHRcdGlmIHRpbWUgPiBsb25nZXN0VGltZVxuXHRcdFx0XHRsb25nZXN0VGltZSA9IHRpbWVcblx0XHRcdFx0bG9uZ2VzdFRpbWVJZHggPSBpXG5cblx0XHRsb25nZXN0VGltZUlkeFxuXG5cdEBfYW5pbWF0ZUNoYXJzIDogKHdvcmQsIHNlcXVlbnRpYWwsIGNiKSA9PlxuXG5cdFx0YWN0aXZlQ2hhciA9IDBcblxuXHRcdGlmIHNlcXVlbnRpYWxcblx0XHRcdEBfYW5pbWF0ZUNoYXIgd29yZC5jaGFycywgYWN0aXZlQ2hhciwgdHJ1ZSwgY2Jcblx0XHRlbHNlXG5cdFx0XHRsb25nZXN0Q2hhcklkeCA9IEBfZ2V0TG9uZ2VzdENoYXJEdXJhdGlvbiB3b3JkLmNoYXJzXG5cdFx0XHRmb3IgY2hhciwgaSBpbiB3b3JkLmNoYXJzXG5cdFx0XHRcdGFyZ3MgPSBbIHdvcmQuY2hhcnMsIGksIGZhbHNlIF1cblx0XHRcdFx0aWYgaSBpcyBsb25nZXN0Q2hhcklkeCB0aGVuIGFyZ3MucHVzaCBjYlxuXHRcdFx0XHRAX2FuaW1hdGVDaGFyLmFwcGx5IEAsIGFyZ3NcblxuXHRcdG51bGxcblxuXHRAX2FuaW1hdGVDaGFyIDogKGNoYXJzLCBpZHgsIHJlY3Vyc2UsIGNiKSA9PlxuXG5cdFx0Y2hhciA9IGNoYXJzW2lkeF1cblxuXHRcdGlmIHJlY3Vyc2VcblxuXHRcdFx0QF9hbmltYXRlV3JvbmdDaGFycyBjaGFyLCA9PlxuXG5cdFx0XHRcdGlmIGlkeCBpcyBjaGFycy5sZW5ndGgtMVxuXHRcdFx0XHRcdEBfYW5pbWF0ZUNoYXJzRG9uZSBjYlxuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0QF9hbmltYXRlQ2hhciBjaGFycywgaWR4KzEsIHJlY3Vyc2UsIGNiXG5cblx0XHRlbHNlXG5cblx0XHRcdGlmIHR5cGVvZiBjYiBpcyAnZnVuY3Rpb24nXG5cdFx0XHRcdEBfYW5pbWF0ZVdyb25nQ2hhcnMgY2hhciwgPT4gQF9hbmltYXRlQ2hhcnNEb25lIGNiXG5cdFx0XHRlbHNlXG5cdFx0XHRcdEBfYW5pbWF0ZVdyb25nQ2hhcnMgY2hhclxuXG5cdFx0bnVsbFxuXG5cdEBfYW5pbWF0ZVdyb25nQ2hhcnMgOiAoY2hhciwgY2IpID0+XG5cblx0XHRpZiBjaGFyLndyb25nQ2hhcnMubGVuZ3RoXG5cblx0XHRcdHdyb25nQ2hhciA9IGNoYXIud3JvbmdDaGFycy5zaGlmdCgpXG5cblx0XHRcdHNldFRpbWVvdXQgPT5cblx0XHRcdFx0Y2hhci4kZWwuaHRtbCB3cm9uZ0NoYXIuY2hhclxuXG5cdFx0XHRcdHNldFRpbWVvdXQgPT5cblx0XHRcdFx0XHRAX2FuaW1hdGVXcm9uZ0NoYXJzIGNoYXIsIGNiXG5cdFx0XHRcdCwgd3JvbmdDaGFyLm91dERlbGF5XG5cblx0XHRcdCwgd3JvbmdDaGFyLmluRGVsYXlcblxuXHRcdGVsc2VcblxuXHRcdFx0Y2hhci4kZWxcblx0XHRcdFx0LmF0dHIoJ2RhdGEtY29kZXRleHQtY2hhci1zdGF0ZScsIGNoYXIuY2hhclN0YXRlKVxuXHRcdFx0XHQuaHRtbChjaGFyLnRhcmdldENoYXIpXG5cblx0XHRcdGNiPygpXG5cblx0XHRudWxsXG5cblx0QF9hbmltYXRlQ2hhcnNEb25lIDogKGNiKSA9PlxuXG5cdFx0Y2I/KClcblxuXHRcdG51bGxcblxuXHRAX3N1cHBsYW50U3RyaW5nIDogKHN0ciwgdmFscykgPT5cblxuXHRcdHJldHVybiBzdHIucmVwbGFjZSAve3sgKFtee31dKikgfX0vZywgKGEsIGIpID0+XG5cdFx0XHRyID0gdmFsc1tiXVxuXHRcdFx0KGlmIHR5cGVvZiByIGlzIFwic3RyaW5nXCIgb3IgdHlwZW9mIHIgaXMgXCJudW1iZXJcIiB0aGVuIHIgZWxzZSBhKVxuXG5cdEB0byA6ICh0YXJnZXRUZXh0LCAkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAdG8odGFyZ2V0VGV4dCwgXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXHRcdHdvcmQudmlzaWJsZSA9IHRydWVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgdGFyZ2V0VGV4dCwgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAaW4gOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQGluKF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblx0XHR3b3JkLnZpc2libGUgPSB0cnVlXG5cblx0XHRAX3ByZXBhcmVXb3JkIHdvcmQsICdyaWdodCcsIGNoYXJTdGF0ZVxuXHRcdEBfYW5pbWF0ZUNoYXJzIHdvcmQsIHNlcXVlbnRpYWwsIGNiXG5cblx0XHRudWxsXG5cblx0QG91dCA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAb3V0KF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblx0XHRyZXR1cm4gaWYgIXdvcmQudmlzaWJsZVxuXG5cdFx0d29yZC52aXNpYmxlID0gZmFsc2VcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ2VtcHR5JywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAc2NyYW1ibGUgOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQHNjcmFtYmxlKF8kZWwsIGNoYXJTdGF0ZSwgY2IpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0d29yZCA9IEBfZ2V0V29yZEZyb21DYWNoZSAkZWxcblxuXHRcdHJldHVybiBpZiAhd29yZC52aXNpYmxlXG5cblx0XHRAX3ByZXBhcmVXb3JkIHdvcmQsICd3cm9uZycsIGNoYXJTdGF0ZVxuXHRcdEBfYW5pbWF0ZUNoYXJzIHdvcmQsIHNlcXVlbnRpYWwsIGNiXG5cblx0XHRudWxsXG5cblx0QHVuc2NyYW1ibGUgOiAoJGVsLCBjaGFyU3RhdGUsIHNlcXVlbnRpYWw9ZmFsc2UsIGNiPW51bGwpID0+XG5cblx0XHRpZiBfLmlzQXJyYXkgJGVsXG5cdFx0XHQoQHVuc2NyYW1ibGUoXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXG5cdFx0cmV0dXJuIGlmICF3b3JkLnZpc2libGVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ3JpZ2h0JywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAcHJlcGFyZSA6ICgkZWwsIGluaXRpYWxTdGF0ZSkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAcHJlcGFyZShfJGVsLCBpbml0aWFsU3RhdGUpKSBmb3IgXyRlbCBpbiAkZWxcblx0XHRcdHJldHVyblxuXG5cdFx0QF9nZXRXb3JkRnJvbUNhY2hlICRlbCwgaW5pdGlhbFN0YXRlXG5cblx0XHRudWxsXG5cblx0QGdldFNjcmFtYmxlZFdvcmQgOiAod29yZCkgPT5cblxuXHRcdG5ld0NoYXJzID0gW11cblx0XHQobmV3Q2hhcnMucHVzaCBAX2dldFJhbmRvbUNoYXIoKSkgZm9yIGNoYXIgaW4gd29yZC5zcGxpdCgnJylcblxuXHRcdHJldHVybiBuZXdDaGFycy5qb2luKCcnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvZGVXb3JkVHJhbnNpdGlvbmVyXG4iLCJBYnN0cmFjdERhdGEgPSByZXF1aXJlICcuLi9kYXRhL0Fic3RyYWN0RGF0YSdcblxuIyMjXG5cbkZhY2Vib29rIFNESyB3cmFwcGVyIC0gbG9hZCBhc3luY2hyb25vdXNseSwgc29tZSBoZWxwZXIgbWV0aG9kc1xuXG4jIyNcbmNsYXNzIEZhY2Vib29rIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cblx0QHVybCAgICAgICAgIDogJy8vY29ubmVjdC5mYWNlYm9vay5uZXQvZW5fVVMvYWxsLmpzJ1xuXG5cdEBwZXJtaXNzaW9ucyA6ICdlbWFpbCdcblxuXHRAJGRhdGFEZmQgICAgOiBudWxsXG5cdEBsb2FkZWQgICAgICA6IGZhbHNlXG5cblx0QGxvYWQgOiA9PlxuXG5cdFx0IyMjXG5cdFx0VE8gRE9cblx0XHRpbmNsdWRlIHNjcmlwdCBsb2FkZXIgd2l0aCBjYWxsYmFjayB0byA6aW5pdFxuXHRcdCMjI1xuXHRcdCMgcmVxdWlyZSBbQHVybF0sIEBpbml0XG5cblx0XHRudWxsXG5cblx0QGluaXQgOiA9PlxuXG5cdFx0QGxvYWRlZCA9IHRydWVcblxuXHRcdEZCLmluaXRcblx0XHRcdGFwcElkICA6IHdpbmRvdy5jb25maWcuZmJfYXBwX2lkXG5cdFx0XHRzdGF0dXMgOiBmYWxzZVxuXHRcdFx0eGZibWwgIDogZmFsc2VcblxuXHRcdG51bGxcblxuXHRAbG9naW4gOiAoQCRkYXRhRGZkKSA9PlxuXG5cdFx0aWYgIUBsb2FkZWQgdGhlbiByZXR1cm4gQCRkYXRhRGZkLnJlamVjdCAnU0RLIG5vdCBsb2FkZWQnXG5cblx0XHRGQi5sb2dpbiAoIHJlcyApID0+XG5cblx0XHRcdGlmIHJlc1snc3RhdHVzJ10gaXMgJ2Nvbm5lY3RlZCdcblx0XHRcdFx0QGdldFVzZXJEYXRhIHJlc1snYXV0aFJlc3BvbnNlJ11bJ2FjY2Vzc1Rva2VuJ11cblx0XHRcdGVsc2Vcblx0XHRcdFx0QCRkYXRhRGZkLnJlamVjdCAnbm8gd2F5IGpvc2UnXG5cblx0XHQsIHsgc2NvcGU6IEBwZXJtaXNzaW9ucyB9XG5cblx0XHRudWxsXG5cblx0QGdldFVzZXJEYXRhIDogKHRva2VuKSA9PlxuXG5cdFx0dXNlckRhdGEgPSB7fVxuXHRcdHVzZXJEYXRhLmFjY2Vzc190b2tlbiA9IHRva2VuXG5cblx0XHQkbWVEZmQgICA9ICQuRGVmZXJyZWQoKVxuXHRcdCRwaWNEZmQgID0gJC5EZWZlcnJlZCgpXG5cblx0XHRGQi5hcGkgJy9tZScsIChyZXMpIC0+XG5cblx0XHRcdHVzZXJEYXRhLmZ1bGxfbmFtZSA9IHJlcy5uYW1lXG5cdFx0XHR1c2VyRGF0YS5zb2NpYWxfaWQgPSByZXMuaWRcblx0XHRcdHVzZXJEYXRhLmVtYWlsICAgICA9IHJlcy5lbWFpbCBvciBmYWxzZVxuXHRcdFx0JG1lRGZkLnJlc29sdmUoKVxuXG5cdFx0RkIuYXBpICcvbWUvcGljdHVyZScsIHsgJ3dpZHRoJzogJzIwMCcgfSwgKHJlcykgLT5cblxuXHRcdFx0dXNlckRhdGEucHJvZmlsZV9waWMgPSByZXMuZGF0YS51cmxcblx0XHRcdCRwaWNEZmQucmVzb2x2ZSgpXG5cblx0XHQkLndoZW4oJG1lRGZkLCAkcGljRGZkKS5kb25lID0+IEAkZGF0YURmZC5yZXNvbHZlIHVzZXJEYXRhXG5cblx0XHRudWxsXG5cblx0QHNoYXJlIDogKG9wdHMsIGNiKSA9PlxuXG5cdFx0RkIudWkge1xuXHRcdFx0bWV0aG9kICAgICAgOiBvcHRzLm1ldGhvZCBvciAnZmVlZCdcblx0XHRcdG5hbWUgICAgICAgIDogb3B0cy5uYW1lIG9yICcnXG5cdFx0XHRsaW5rICAgICAgICA6IG9wdHMubGluayBvciAnJ1xuXHRcdFx0cGljdHVyZSAgICAgOiBvcHRzLnBpY3R1cmUgb3IgJydcblx0XHRcdGNhcHRpb24gICAgIDogb3B0cy5jYXB0aW9uIG9yICcnXG5cdFx0XHRkZXNjcmlwdGlvbiA6IG9wdHMuZGVzY3JpcHRpb24gb3IgJydcblx0XHR9LCAocmVzcG9uc2UpIC0+XG5cdFx0XHRjYj8ocmVzcG9uc2UpXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gRmFjZWJvb2tcbiIsIkFic3RyYWN0RGF0YSA9IHJlcXVpcmUgJy4uL2RhdGEvQWJzdHJhY3REYXRhJ1xuXG4jIyNcblxuR29vZ2xlKyBTREsgd3JhcHBlciAtIGxvYWQgYXN5bmNocm9ub3VzbHksIHNvbWUgaGVscGVyIG1ldGhvZHNcblxuIyMjXG5jbGFzcyBHb29nbGVQbHVzIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cblx0QHVybCAgICAgIDogJ2h0dHBzOi8vYXBpcy5nb29nbGUuY29tL2pzL2NsaWVudDpwbHVzb25lLmpzJ1xuXG5cdEBwYXJhbXMgICA6XG5cdFx0J2NsaWVudGlkJyAgICAgOiBudWxsXG5cdFx0J2NhbGxiYWNrJyAgICAgOiBudWxsXG5cdFx0J3Njb3BlJyAgICAgICAgOiAnaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC91c2VyaW5mby5lbWFpbCdcblx0XHQnY29va2llcG9saWN5JyA6ICdub25lJ1xuXG5cdEAkZGF0YURmZCA6IG51bGxcblx0QGxvYWRlZCAgIDogZmFsc2VcblxuXHRAbG9hZCA6ID0+XG5cblx0XHQjIyNcblx0XHRUTyBET1xuXHRcdGluY2x1ZGUgc2NyaXB0IGxvYWRlciB3aXRoIGNhbGxiYWNrIHRvIDppbml0XG5cdFx0IyMjXG5cdFx0IyByZXF1aXJlIFtAdXJsXSwgQGluaXRcblxuXHRcdG51bGxcblxuXHRAaW5pdCA6ID0+XG5cblx0XHRAbG9hZGVkID0gdHJ1ZVxuXG5cdFx0QHBhcmFtc1snY2xpZW50aWQnXSA9IHdpbmRvdy5jb25maWcuZ3BfYXBwX2lkXG5cdFx0QHBhcmFtc1snY2FsbGJhY2snXSA9IEBsb2dpbkNhbGxiYWNrXG5cblx0XHRudWxsXG5cblx0QGxvZ2luIDogKEAkZGF0YURmZCkgPT5cblxuXHRcdGlmIEBsb2FkZWRcblx0XHRcdGdhcGkuYXV0aC5zaWduSW4gQHBhcmFtc1xuXHRcdGVsc2Vcblx0XHRcdEAkZGF0YURmZC5yZWplY3QgJ1NESyBub3QgbG9hZGVkJ1xuXG5cdFx0bnVsbFxuXG5cdEBsb2dpbkNhbGxiYWNrIDogKHJlcykgPT5cblxuXHRcdGlmIHJlc1snc3RhdHVzJ11bJ3NpZ25lZF9pbiddXG5cdFx0XHRAZ2V0VXNlckRhdGEgcmVzWydhY2Nlc3NfdG9rZW4nXVxuXHRcdGVsc2UgaWYgcmVzWydlcnJvciddWydhY2Nlc3NfZGVuaWVkJ11cblx0XHRcdEAkZGF0YURmZC5yZWplY3QgJ25vIHdheSBqb3NlJ1xuXG5cdFx0bnVsbFxuXG5cdEBnZXRVc2VyRGF0YSA6ICh0b2tlbikgPT5cblxuXHRcdGdhcGkuY2xpZW50LmxvYWQgJ3BsdXMnLCd2MScsID0+XG5cblx0XHRcdHJlcXVlc3QgPSBnYXBpLmNsaWVudC5wbHVzLnBlb3BsZS5nZXQgJ3VzZXJJZCc6ICdtZSdcblx0XHRcdHJlcXVlc3QuZXhlY3V0ZSAocmVzKSA9PlxuXG5cdFx0XHRcdHVzZXJEYXRhID1cblx0XHRcdFx0XHRhY2Nlc3NfdG9rZW4gOiB0b2tlblxuXHRcdFx0XHRcdGZ1bGxfbmFtZSAgICA6IHJlcy5kaXNwbGF5TmFtZVxuXHRcdFx0XHRcdHNvY2lhbF9pZCAgICA6IHJlcy5pZFxuXHRcdFx0XHRcdGVtYWlsICAgICAgICA6IGlmIHJlcy5lbWFpbHNbMF0gdGhlbiByZXMuZW1haWxzWzBdLnZhbHVlIGVsc2UgZmFsc2Vcblx0XHRcdFx0XHRwcm9maWxlX3BpYyAgOiByZXMuaW1hZ2UudXJsXG5cblx0XHRcdFx0QCRkYXRhRGZkLnJlc29sdmUgdXNlckRhdGFcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBHb29nbGVQbHVzXG4iLCIjICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgTWVkaWEgUXVlcmllcyBNYW5hZ2VyIFxuIyAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuIyAgIFxuIyAgIEBhdXRob3IgOiBGw6FiaW8gQXpldmVkbyA8ZmFiaW8uYXpldmVkb0B1bml0OS5jb20+IFVOSVQ5XG4jICAgQGRhdGUgICA6IFNlcHRlbWJlciAxNFxuIyAgIFxuIyAgIEluc3RydWN0aW9ucyBhcmUgb24gL3Byb2plY3Qvc2Fzcy91dGlscy9fcmVzcG9uc2l2ZS5zY3NzLlxuXG5jbGFzcyBNZWRpYVF1ZXJpZXNcblxuICAgICMgQnJlYWtwb2ludHNcbiAgICBAU01BTEwgICAgICAgOiBcInNtYWxsXCJcbiAgICBASVBBRCAgICAgICAgOiBcImlwYWRcIlxuICAgIEBNRURJVU0gICAgICA6IFwibWVkaXVtXCJcbiAgICBATEFSR0UgICAgICAgOiBcImxhcmdlXCJcbiAgICBARVhUUkFfTEFSR0UgOiBcImV4dHJhLWxhcmdlXCJcblxuICAgIEBzZXR1cCA6ID0+XG5cbiAgICAgICAgTWVkaWFRdWVyaWVzLlNNQUxMX0JSRUFLUE9JTlQgID0ge25hbWU6IFwiU21hbGxcIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuU01BTExdfVxuICAgICAgICBNZWRpYVF1ZXJpZXMuTUVESVVNX0JSRUFLUE9JTlQgPSB7bmFtZTogXCJNZWRpdW1cIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuTUVESVVNXX1cbiAgICAgICAgTWVkaWFRdWVyaWVzLkxBUkdFX0JSRUFLUE9JTlQgID0ge25hbWU6IFwiTGFyZ2VcIiwgYnJlYWtwb2ludHM6IFtNZWRpYVF1ZXJpZXMuSVBBRCwgTWVkaWFRdWVyaWVzLkxBUkdFLCBNZWRpYVF1ZXJpZXMuRVhUUkFfTEFSR0VdfVxuXG4gICAgICAgIE1lZGlhUXVlcmllcy5CUkVBS1BPSU5UUyA9IFtcbiAgICAgICAgICAgIE1lZGlhUXVlcmllcy5TTUFMTF9CUkVBS1BPSU5UXG4gICAgICAgICAgICBNZWRpYVF1ZXJpZXMuTUVESVVNX0JSRUFLUE9JTlRcbiAgICAgICAgICAgIE1lZGlhUXVlcmllcy5MQVJHRV9CUkVBS1BPSU5UXG4gICAgICAgIF1cbiAgICAgICAgcmV0dXJuXG5cbiAgICBAZ2V0RGV2aWNlU3RhdGUgOiA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5LCBcImFmdGVyXCIpLmdldFByb3BlcnR5VmFsdWUoXCJjb250ZW50XCIpO1xuXG4gICAgQGdldEJyZWFrcG9pbnQgOiA9PlxuXG4gICAgICAgIHN0YXRlID0gTWVkaWFRdWVyaWVzLmdldERldmljZVN0YXRlKClcblxuICAgICAgICBmb3IgaSBpbiBbMC4uLk1lZGlhUXVlcmllcy5CUkVBS1BPSU5UUy5sZW5ndGhdXG4gICAgICAgICAgICBpZiBNZWRpYVF1ZXJpZXMuQlJFQUtQT0lOVFNbaV0uYnJlYWtwb2ludHMuaW5kZXhPZihzdGF0ZSkgPiAtMVxuICAgICAgICAgICAgICAgIHJldHVybiBNZWRpYVF1ZXJpZXMuQlJFQUtQT0lOVFNbaV0ubmFtZVxuXG4gICAgICAgIHJldHVybiBcIlwiXG5cbiAgICBAaXNCcmVha3BvaW50IDogKGJyZWFrcG9pbnQpID0+XG5cbiAgICAgICAgZm9yIGkgaW4gWzAuLi5icmVha3BvaW50LmJyZWFrcG9pbnRzLmxlbmd0aF1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgYnJlYWtwb2ludC5icmVha3BvaW50c1tpXSA9PSBNZWRpYVF1ZXJpZXMuZ2V0RGV2aWNlU3RhdGUoKVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG5cbiAgICAgICAgcmV0dXJuIGZhbHNlXG5cbm1vZHVsZS5leHBvcnRzID0gTWVkaWFRdWVyaWVzIiwiY2xhc3MgTnVtYmVyVXRpbHNcblxuICAgIEBNQVRIX0NPUzogTWF0aC5jb3MgXG4gICAgQE1BVEhfU0lOOiBNYXRoLnNpbiBcbiAgICBATUFUSF9SQU5ET006IE1hdGgucmFuZG9tIFxuICAgIEBNQVRIX0FCUzogTWF0aC5hYnNcbiAgICBATUFUSF9BVEFOMjogTWF0aC5hdGFuMlxuXG4gICAgQGxpbWl0OihudW1iZXIsIG1pbiwgbWF4KS0+XG4gICAgICAgIHJldHVybiBNYXRoLm1pbiggTWF0aC5tYXgobWluLG51bWJlciksIG1heCApXG5cbiAgICBAZ2V0UmFuZG9tQ29sb3I6IC0+XG5cbiAgICAgICAgbGV0dGVycyA9ICcwMTIzNDU2Nzg5QUJDREVGJy5zcGxpdCgnJylcbiAgICAgICAgY29sb3IgPSAnIydcbiAgICAgICAgZm9yIGkgaW4gWzAuLi42XVxuICAgICAgICAgICAgY29sb3IgKz0gbGV0dGVyc1tNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAxNSldXG4gICAgICAgIGNvbG9yXG5cbiAgICBAZ2V0VGltZVN0YW1wRGlmZiA6IChkYXRlMSwgZGF0ZTIpIC0+XG5cbiAgICAgICAgIyBHZXQgMSBkYXkgaW4gbWlsbGlzZWNvbmRzXG4gICAgICAgIG9uZV9kYXkgPSAxMDAwKjYwKjYwKjI0XG4gICAgICAgIHRpbWUgICAgPSB7fVxuXG4gICAgICAgICMgQ29udmVydCBib3RoIGRhdGVzIHRvIG1pbGxpc2Vjb25kc1xuICAgICAgICBkYXRlMV9tcyA9IGRhdGUxLmdldFRpbWUoKVxuICAgICAgICBkYXRlMl9tcyA9IGRhdGUyLmdldFRpbWUoKVxuXG4gICAgICAgICMgQ2FsY3VsYXRlIHRoZSBkaWZmZXJlbmNlIGluIG1pbGxpc2Vjb25kc1xuICAgICAgICBkaWZmZXJlbmNlX21zID0gZGF0ZTJfbXMgLSBkYXRlMV9tc1xuXG4gICAgICAgICMgdGFrZSBvdXQgbWlsbGlzZWNvbmRzXG4gICAgICAgIGRpZmZlcmVuY2VfbXMgPSBkaWZmZXJlbmNlX21zLzEwMDBcbiAgICAgICAgdGltZS5zZWNvbmRzICA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZV9tcyAlIDYwKVxuXG4gICAgICAgIGRpZmZlcmVuY2VfbXMgPSBkaWZmZXJlbmNlX21zLzYwIFxuICAgICAgICB0aW1lLm1pbnV0ZXMgID0gTWF0aC5mbG9vcihkaWZmZXJlbmNlX21zICUgNjApXG5cbiAgICAgICAgZGlmZmVyZW5jZV9tcyA9IGRpZmZlcmVuY2VfbXMvNjAgXG4gICAgICAgIHRpbWUuaG91cnMgICAgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VfbXMgJSAyNCkgIFxuXG4gICAgICAgIHRpbWUuZGF5cyAgICAgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VfbXMvMjQpXG5cbiAgICAgICAgdGltZVxuXG4gICAgQG1hcDogKCBudW0sIG1pbjEsIG1heDEsIG1pbjIsIG1heDIsIHJvdW5kID0gZmFsc2UsIGNvbnN0cmFpbk1pbiA9IHRydWUsIGNvbnN0cmFpbk1heCA9IHRydWUgKSAtPlxuICAgICAgICBpZiBjb25zdHJhaW5NaW4gYW5kIG51bSA8IG1pbjEgdGhlbiByZXR1cm4gbWluMlxuICAgICAgICBpZiBjb25zdHJhaW5NYXggYW5kIG51bSA+IG1heDEgdGhlbiByZXR1cm4gbWF4MlxuICAgICAgICBcbiAgICAgICAgbnVtMSA9IChudW0gLSBtaW4xKSAvIChtYXgxIC0gbWluMSlcbiAgICAgICAgbnVtMiA9IChudW0xICogKG1heDIgLSBtaW4yKSkgKyBtaW4yXG4gICAgICAgIGlmIHJvdW5kIHRoZW4gcmV0dXJuIE1hdGgucm91bmQobnVtMilcblxuICAgICAgICByZXR1cm4gbnVtMlxuXG4gICAgQHRvUmFkaWFuczogKCBkZWdyZWUgKSAtPlxuICAgICAgICByZXR1cm4gZGVncmVlICogKCBNYXRoLlBJIC8gMTgwIClcblxuICAgIEB0b0RlZ3JlZTogKCByYWRpYW5zICkgLT5cbiAgICAgICAgcmV0dXJuIHJhZGlhbnMgKiAoIDE4MCAvIE1hdGguUEkgKVxuXG4gICAgQGlzSW5SYW5nZTogKCBudW0sIG1pbiwgbWF4LCBjYW5CZUVxdWFsICkgLT5cbiAgICAgICAgaWYgY2FuQmVFcXVhbCB0aGVuIHJldHVybiBudW0gPj0gbWluICYmIG51bSA8PSBtYXhcbiAgICAgICAgZWxzZSByZXR1cm4gbnVtID49IG1pbiAmJiBudW0gPD0gbWF4XG5cbiAgICAjIGNvbnZlcnQgbWV0cmVzIGluIHRvIG0gLyBLTVxuICAgIEBnZXROaWNlRGlzdGFuY2U6IChtZXRyZXMpID0+XG5cbiAgICAgICAgaWYgbWV0cmVzIDwgMTAwMFxuXG4gICAgICAgICAgICByZXR1cm4gXCIje01hdGgucm91bmQobWV0cmVzKX1NXCJcblxuICAgICAgICBlbHNlXG5cbiAgICAgICAgICAgIGttID0gKG1ldHJlcy8xMDAwKS50b0ZpeGVkKDIpXG4gICAgICAgICAgICByZXR1cm4gXCIje2ttfUtNXCJcblxuICAgICMgZnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xMjY3MzM4XG4gICAgQHplcm9GaWxsOiAoIG51bWJlciwgd2lkdGggKSA9PlxuXG4gICAgICAgIHdpZHRoIC09IG51bWJlci50b1N0cmluZygpLmxlbmd0aFxuXG4gICAgICAgIGlmIHdpZHRoID4gMFxuICAgICAgICAgICAgcmV0dXJuIG5ldyBBcnJheSggd2lkdGggKyAoL1xcLi8udGVzdCggbnVtYmVyICkgPyAyIDogMSkgKS5qb2luKCAnMCcgKSArIG51bWJlclxuXG4gICAgICAgIHJldHVybiBudW1iZXIgKyBcIlwiICMgYWx3YXlzIHJldHVybiBhIHN0cmluZ1xuXG5tb2R1bGUuZXhwb3J0cyA9IE51bWJlclV0aWxzXG4iLCIjIyNcbiMgUmVxdWVzdGVyICNcblxuV3JhcHBlciBmb3IgYCQuYWpheGAgY2FsbHNcblxuIyMjXG5jbGFzcyBSZXF1ZXN0ZXJcblxuICAgIEByZXF1ZXN0cyA6IFtdXG5cbiAgICBAcmVxdWVzdDogKCBkYXRhICkgPT5cbiAgICAgICAgIyMjXG4gICAgICAgIGBkYXRhID0ge2A8YnI+XG4gICAgICAgIGAgIHVybCAgICAgICAgIDogU3RyaW5nYDxicj5cbiAgICAgICAgYCAgdHlwZSAgICAgICAgOiBcIlBPU1QvR0VUL1BVVFwiYDxicj5cbiAgICAgICAgYCAgZGF0YSAgICAgICAgOiBPYmplY3RgPGJyPlxuICAgICAgICBgICBkYXRhVHlwZSAgICA6IGpRdWVyeSBkYXRhVHlwZWA8YnI+XG4gICAgICAgIGAgIGNvbnRlbnRUeXBlIDogU3RyaW5nYDxicj5cbiAgICAgICAgYH1gXG4gICAgICAgICMjI1xuXG4gICAgICAgIHIgPSAkLmFqYXgge1xuXG4gICAgICAgICAgICB1cmwgICAgICAgICA6IGRhdGEudXJsXG4gICAgICAgICAgICB0eXBlICAgICAgICA6IGlmIGRhdGEudHlwZSB0aGVuIGRhdGEudHlwZSBlbHNlIFwiUE9TVFwiLFxuICAgICAgICAgICAgZGF0YSAgICAgICAgOiBpZiBkYXRhLmRhdGEgdGhlbiBkYXRhLmRhdGEgZWxzZSBudWxsLFxuICAgICAgICAgICAgZGF0YVR5cGUgICAgOiBpZiBkYXRhLmRhdGFUeXBlIHRoZW4gZGF0YS5kYXRhVHlwZSBlbHNlIFwianNvblwiLFxuICAgICAgICAgICAgY29udGVudFR5cGUgOiBpZiBkYXRhLmNvbnRlbnRUeXBlIHRoZW4gZGF0YS5jb250ZW50VHlwZSBlbHNlIFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCIsXG4gICAgICAgICAgICBwcm9jZXNzRGF0YSA6IGlmIGRhdGEucHJvY2Vzc0RhdGEgIT0gbnVsbCBhbmQgZGF0YS5wcm9jZXNzRGF0YSAhPSB1bmRlZmluZWQgdGhlbiBkYXRhLnByb2Nlc3NEYXRhIGVsc2UgdHJ1ZVxuXG4gICAgICAgIH1cblxuICAgICAgICByLmRvbmUgZGF0YS5kb25lXG4gICAgICAgIHIuZmFpbCBkYXRhLmZhaWxcbiAgICAgICAgXG4gICAgICAgIHJcblxuICAgIEBhZGRJbWFnZSA6IChkYXRhLCBkb25lLCBmYWlsKSA9PlxuICAgICAgICAjIyNcbiAgICAgICAgKiogVXNhZ2U6IDxicj5cbiAgICAgICAgYGRhdGEgPSBjYW52YXNzLnRvRGF0YVVSTChcImltYWdlL2pwZWdcIikuc2xpY2UoXCJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LFwiLmxlbmd0aClgPGJyPlxuICAgICAgICBgUmVxdWVzdGVyLmFkZEltYWdlIGRhdGEsIFwiem9ldHJvcGVcIiwgQGRvbmUsIEBmYWlsYFxuICAgICAgICAjIyNcblxuICAgICAgICBAcmVxdWVzdFxuICAgICAgICAgICAgdXJsICAgIDogJy9hcGkvaW1hZ2VzLydcbiAgICAgICAgICAgIHR5cGUgICA6ICdQT1NUJ1xuICAgICAgICAgICAgZGF0YSAgIDoge2ltYWdlX2Jhc2U2NCA6IGVuY29kZVVSSShkYXRhKX1cbiAgICAgICAgICAgIGRvbmUgICA6IGRvbmVcbiAgICAgICAgICAgIGZhaWwgICA6IGZhaWxcblxuICAgICAgICBudWxsXG5cbiAgICBAZGVsZXRlSW1hZ2UgOiAoaWQsIGRvbmUsIGZhaWwpID0+XG4gICAgICAgIFxuICAgICAgICBAcmVxdWVzdFxuICAgICAgICAgICAgdXJsICAgIDogJy9hcGkvaW1hZ2VzLycraWRcbiAgICAgICAgICAgIHR5cGUgICA6ICdERUxFVEUnXG4gICAgICAgICAgICBkb25lICAgOiBkb25lXG4gICAgICAgICAgICBmYWlsICAgOiBmYWlsXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFJlcXVlc3RlclxuIiwiIyMjXG5TaGFyaW5nIGNsYXNzIGZvciBub24tU0RLIGxvYWRlZCBzb2NpYWwgbmV0d29ya3MuXG5JZiBTREsgaXMgbG9hZGVkLCBhbmQgcHJvdmlkZXMgc2hhcmUgbWV0aG9kcywgdGhlbiB1c2UgdGhhdCBjbGFzcyBpbnN0ZWFkLCBlZy4gYEZhY2Vib29rLnNoYXJlYCBpbnN0ZWFkIG9mIGBTaGFyZS5mYWNlYm9va2BcbiMjI1xuY2xhc3MgU2hhcmVcblxuICAgIHVybCA6IG51bGxcblxuICAgIGNvbnN0cnVjdG9yIDogLT5cblxuICAgICAgICBAdXJsID0gQENEX0NFKCkuU0lURV9VUkxcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgb3BlbldpbiA6ICh1cmwsIHcsIGgpID0+XG5cbiAgICAgICAgbGVmdCA9ICggc2NyZWVuLmF2YWlsV2lkdGggIC0gdyApID4+IDFcbiAgICAgICAgdG9wICA9ICggc2NyZWVuLmF2YWlsSGVpZ2h0IC0gaCApID4+IDFcblxuICAgICAgICB3aW5kb3cub3BlbiB1cmwsICcnLCAndG9wPScrdG9wKycsbGVmdD0nK2xlZnQrJyx3aWR0aD0nK3crJyxoZWlnaHQ9JytoKycsbG9jYXRpb249bm8sbWVudWJhcj1ubydcblxuICAgICAgICBudWxsXG5cbiAgICBwbHVzIDogKCB1cmwgKSA9PlxuXG4gICAgICAgIHVybCA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcblxuICAgICAgICBAb3BlbldpbiBcImh0dHBzOi8vcGx1cy5nb29nbGUuY29tL3NoYXJlP3VybD0je3VybH1cIiwgNjUwLCAzODVcblxuICAgICAgICBudWxsXG5cbiAgICBwaW50ZXJlc3QgOiAodXJsLCBtZWRpYSwgZGVzY3IpID0+XG5cbiAgICAgICAgdXJsICAgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG4gICAgICAgIG1lZGlhID0gZW5jb2RlVVJJQ29tcG9uZW50KG1lZGlhKVxuICAgICAgICBkZXNjciA9IGVuY29kZVVSSUNvbXBvbmVudChkZXNjcilcblxuICAgICAgICBAb3BlbldpbiBcImh0dHA6Ly93d3cucGludGVyZXN0LmNvbS9waW4vY3JlYXRlL2J1dHRvbi8/dXJsPSN7dXJsfSZtZWRpYT0je21lZGlhfSZkZXNjcmlwdGlvbj0je2Rlc2NyfVwiLCA3MzUsIDMxMFxuXG4gICAgICAgIG51bGxcblxuICAgIHR1bWJsciA6ICh1cmwsIG1lZGlhLCBkZXNjcikgPT5cblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgbWVkaWEgPSBlbmNvZGVVUklDb21wb25lbnQobWVkaWEpXG4gICAgICAgIGRlc2NyID0gZW5jb2RlVVJJQ29tcG9uZW50KGRlc2NyKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3d3dy50dW1ibHIuY29tL3NoYXJlL3Bob3RvP3NvdXJjZT0je21lZGlhfSZjYXB0aW9uPSN7ZGVzY3J9JmNsaWNrX3RocnU9I3t1cmx9XCIsIDQ1MCwgNDMwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgZmFjZWJvb2sgOiAoIHVybCAsIGNvcHkgPSAnJykgPT4gXG5cbiAgICAgICAgdXJsICAgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG4gICAgICAgIGRlY3NyID0gZW5jb2RlVVJJQ29tcG9uZW50KGNvcHkpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vd3d3LmZhY2Vib29rLmNvbS9zaGFyZS5waHA/dT0je3VybH0mdD0je2RlY3NyfVwiLCA2MDAsIDMwMFxuXG4gICAgICAgIG51bGxcblxuICAgIHR3aXR0ZXIgOiAoIHVybCAsIGNvcHkgPSAnJykgPT5cblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgaWYgY29weSBpcyAnJ1xuICAgICAgICAgICAgY29weSA9IEBDRF9DRSgpLmxvY2FsZS5nZXQgJ3Nlb190d2l0dGVyX2NhcmRfZGVzY3JpcHRpb24nXG4gICAgICAgICAgICBcbiAgICAgICAgZGVzY3IgPSBlbmNvZGVVUklDb21wb25lbnQoY29weSlcblxuICAgICAgICBAb3BlbldpbiBcImh0dHA6Ly90d2l0dGVyLmNvbS9pbnRlbnQvdHdlZXQvP3RleHQ9I3tkZXNjcn0mdXJsPSN7dXJsfVwiLCA2MDAsIDMwMFxuXG4gICAgICAgIG51bGxcblxuICAgIHJlbnJlbiA6ICggdXJsICkgPT4gXG5cbiAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3NoYXJlLnJlbnJlbi5jb20vc2hhcmUvYnV0dG9uc2hhcmUuZG8/bGluaz1cIiArIHVybCwgNjAwLCAzMDBcblxuICAgICAgICBudWxsXG5cbiAgICB3ZWlibyA6ICggdXJsICkgPT4gXG5cbiAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3NlcnZpY2Uud2VpYm8uY29tL3NoYXJlL3NoYXJlLnBocD91cmw9I3t1cmx9Jmxhbmd1YWdlPXpoX2NuXCIsIDYwMCwgMzAwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgQ0RfQ0UgOiA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBTaGFyZVxuIiwiY2xhc3MgQWJzdHJhY3RWaWV3IGV4dGVuZHMgQmFja2JvbmUuVmlld1xuXG5cdGVsICAgICAgICAgICA6IG51bGxcblx0aWQgICAgICAgICAgIDogbnVsbFxuXHRjaGlsZHJlbiAgICAgOiBudWxsXG5cdHRlbXBsYXRlICAgICA6IG51bGxcblx0dGVtcGxhdGVWYXJzIDogbnVsbFxuXHRcblx0aW5pdGlhbGl6ZSA6IC0+XG5cdFx0XG5cdFx0QGNoaWxkcmVuID0gW11cblxuXHRcdGlmIEB0ZW1wbGF0ZVxuXHRcdFx0dG1wSFRNTCA9IF8udGVtcGxhdGUgQENEX0NFKCkudGVtcGxhdGVzLmdldCBAdGVtcGxhdGVcblx0XHRcdEBzZXRFbGVtZW50IHRtcEhUTUwgQHRlbXBsYXRlVmFyc1xuXG5cdFx0QCRlbC5hdHRyICdpZCcsIEBpZCBpZiBAaWRcblx0XHRAJGVsLmFkZENsYXNzIEBjbGFzc05hbWUgaWYgQGNsYXNzTmFtZVxuXHRcdFxuXHRcdEBpbml0KClcblxuXHRcdEBwYXVzZWQgPSBmYWxzZVxuXG5cdFx0bnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdHVwZGF0ZSA6ID0+XG5cblx0XHRudWxsXG5cblx0cmVuZGVyIDogPT5cblxuXHRcdG51bGxcblxuXHRhZGRDaGlsZCA6IChjaGlsZCwgcHJlcGVuZCA9IGZhbHNlKSA9PlxuXG5cdFx0QGNoaWxkcmVuLnB1c2ggY2hpbGQgaWYgY2hpbGQuZWxcblx0XHR0YXJnZXQgPSBpZiBAYWRkVG9TZWxlY3RvciB0aGVuIEAkZWwuZmluZChAYWRkVG9TZWxlY3RvcikuZXEoMCkgZWxzZSBAJGVsXG5cdFx0XG5cdFx0YyA9IGlmIGNoaWxkLmVsIHRoZW4gY2hpbGQuJGVsIGVsc2UgY2hpbGRcblxuXHRcdGlmICFwcmVwZW5kIFxuXHRcdFx0dGFyZ2V0LmFwcGVuZCBjXG5cdFx0ZWxzZSBcblx0XHRcdHRhcmdldC5wcmVwZW5kIGNcblxuXHRcdEBcblxuXHRyZXBsYWNlIDogKGRvbSwgY2hpbGQpID0+XG5cblx0XHRAY2hpbGRyZW4ucHVzaCBjaGlsZCBpZiBjaGlsZC5lbFxuXHRcdGMgPSBpZiBjaGlsZC5lbCB0aGVuIGNoaWxkLiRlbCBlbHNlIGNoaWxkXG5cdFx0QCRlbC5jaGlsZHJlbihkb20pLnJlcGxhY2VXaXRoKGMpXG5cblx0XHRudWxsXG5cblx0cmVtb3ZlIDogKGNoaWxkKSA9PlxuXG5cdFx0dW5sZXNzIGNoaWxkP1xuXHRcdFx0cmV0dXJuXG5cdFx0XG5cdFx0YyA9IGlmIGNoaWxkLmVsIHRoZW4gY2hpbGQuJGVsIGVsc2UgJChjaGlsZClcblx0XHRjaGlsZC5kaXNwb3NlKCkgaWYgYyBhbmQgY2hpbGQuZGlzcG9zZVxuXG5cdFx0aWYgYyAmJiBAY2hpbGRyZW4uaW5kZXhPZihjaGlsZCkgIT0gLTFcblx0XHRcdEBjaGlsZHJlbi5zcGxpY2UoIEBjaGlsZHJlbi5pbmRleE9mKGNoaWxkKSwgMSApXG5cblx0XHRjLnJlbW92ZSgpXG5cblx0XHRudWxsXG5cblx0b25SZXNpemUgOiAoZXZlbnQpID0+XG5cblx0XHQoaWYgY2hpbGQub25SZXNpemUgdGhlbiBjaGlsZC5vblJlc2l6ZSgpKSBmb3IgY2hpbGQgaW4gQGNoaWxkcmVuXG5cblx0XHRudWxsXG5cblx0bW91c2VFbmFibGVkIDogKCBlbmFibGVkICkgPT5cblxuXHRcdEAkZWwuY3NzXG5cdFx0XHRcInBvaW50ZXItZXZlbnRzXCI6IGlmIGVuYWJsZWQgdGhlbiBcImF1dG9cIiBlbHNlIFwibm9uZVwiXG5cblx0XHRudWxsXG5cblx0Q1NTVHJhbnNsYXRlIDogKHgsIHksIHZhbHVlPSclJywgc2NhbGUpID0+XG5cblx0XHRpZiBNb2Rlcm5penIuY3NzdHJhbnNmb3JtczNkXG5cdFx0XHRzdHIgPSBcInRyYW5zbGF0ZTNkKCN7eCt2YWx1ZX0sICN7eSt2YWx1ZX0sIDApXCJcblx0XHRlbHNlXG5cdFx0XHRzdHIgPSBcInRyYW5zbGF0ZSgje3grdmFsdWV9LCAje3krdmFsdWV9KVwiXG5cblx0XHRpZiBzY2FsZSB0aGVuIHN0ciA9IFwiI3tzdHJ9IHNjYWxlKCN7c2NhbGV9KVwiXG5cblx0XHRzdHJcblxuXHR1bk11dGVBbGwgOiA9PlxuXG5cdFx0Zm9yIGNoaWxkIGluIEBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZC51bk11dGU/KClcblxuXHRcdFx0aWYgY2hpbGQuY2hpbGRyZW4ubGVuZ3RoXG5cblx0XHRcdFx0Y2hpbGQudW5NdXRlQWxsKClcblxuXHRcdG51bGxcblxuXHRtdXRlQWxsIDogPT5cblxuXHRcdGZvciBjaGlsZCBpbiBAY2hpbGRyZW5cblxuXHRcdFx0Y2hpbGQubXV0ZT8oKVxuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRjaGlsZC5tdXRlQWxsKClcblxuXHRcdG51bGxcblxuXHRyZW1vdmVBbGxDaGlsZHJlbjogPT5cblxuXHRcdEByZW1vdmUgY2hpbGQgZm9yIGNoaWxkIGluIEBjaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdHRyaWdnZXJDaGlsZHJlbiA6IChtc2csIGNoaWxkcmVuPUBjaGlsZHJlbikgPT5cblxuXHRcdGZvciBjaGlsZCwgaSBpbiBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZC50cmlnZ2VyIG1zZ1xuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRAdHJpZ2dlckNoaWxkcmVuIG1zZywgY2hpbGQuY2hpbGRyZW5cblxuXHRcdG51bGxcblxuXHRjYWxsQ2hpbGRyZW4gOiAobWV0aG9kLCBwYXJhbXMsIGNoaWxkcmVuPUBjaGlsZHJlbikgPT5cblxuXHRcdGZvciBjaGlsZCwgaSBpbiBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZFttZXRob2RdPyBwYXJhbXNcblxuXHRcdFx0aWYgY2hpbGQuY2hpbGRyZW4ubGVuZ3RoXG5cblx0XHRcdFx0QGNhbGxDaGlsZHJlbiBtZXRob2QsIHBhcmFtcywgY2hpbGQuY2hpbGRyZW5cblxuXHRcdG51bGxcblxuXHRjYWxsQ2hpbGRyZW5BbmRTZWxmIDogKG1ldGhvZCwgcGFyYW1zLCBjaGlsZHJlbj1AY2hpbGRyZW4pID0+XG5cblx0XHRAW21ldGhvZF0/IHBhcmFtc1xuXG5cdFx0Zm9yIGNoaWxkLCBpIGluIGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkW21ldGhvZF0/IHBhcmFtc1xuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRAY2FsbENoaWxkcmVuIG1ldGhvZCwgcGFyYW1zLCBjaGlsZC5jaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdHN1cHBsYW50U3RyaW5nIDogKHN0ciwgdmFscykgLT5cblxuXHRcdHJldHVybiBzdHIucmVwbGFjZSAve3sgKFtee31dKikgfX0vZywgKGEsIGIpIC0+XG5cdFx0XHRyID0gdmFsc1tiXVxuXHRcdFx0KGlmIHR5cGVvZiByIGlzIFwic3RyaW5nXCIgb3IgdHlwZW9mIHIgaXMgXCJudW1iZXJcIiB0aGVuIHIgZWxzZSBhKVxuXG5cdGRpc3Bvc2UgOiA9PlxuXG5cdFx0IyMjXG5cdFx0b3ZlcnJpZGUgb24gcGVyIHZpZXcgYmFzaXMgLSB1bmJpbmQgZXZlbnQgaGFuZGxlcnMgZXRjXG5cdFx0IyMjXG5cblx0XHRudWxsXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Vmlld1xuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi9BYnN0cmFjdFZpZXcnXG5cbmNsYXNzIEFic3RyYWN0Vmlld1BhZ2UgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuXHRfc2hvd24gICAgIDogZmFsc2Vcblx0X2xpc3RlbmluZyA6IGZhbHNlXG5cblx0c2hvdyA6IChjYikgPT5cblxuXHRcdHJldHVybiB1bmxlc3MgIUBfc2hvd25cblx0XHRAX3Nob3duID0gdHJ1ZVxuXG5cdFx0IyMjXG5cdFx0Q0hBTkdFIEhFUkUgLSAncGFnZScgdmlld3MgYXJlIGFsd2F5cyBpbiBET00gLSB0byBzYXZlIGhhdmluZyB0byByZS1pbml0aWFsaXNlIGdtYXAgZXZlbnRzIChQSVRBKS4gTm8gbG9uZ2VyIHJlcXVpcmUgOmRpc3Bvc2UgbWV0aG9kXG5cdFx0IyMjXG5cdFx0QENEX0NFKCkuYXBwVmlldy53cmFwcGVyLmFkZENoaWxkIEBcblx0XHRAY2FsbENoaWxkcmVuQW5kU2VsZiAnc2V0TGlzdGVuZXJzJywgJ29uJ1xuXG5cdFx0IyMjIHJlcGxhY2Ugd2l0aCBzb21lIHByb3BlciB0cmFuc2l0aW9uIGlmIHdlIGNhbiAjIyNcblx0XHRAJGVsLmNzcyAndmlzaWJpbGl0eScgOiAndmlzaWJsZSdcblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdGhpZGUgOiAoY2IpID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIEBfc2hvd25cblx0XHRAX3Nob3duID0gZmFsc2VcblxuXHRcdCMjI1xuXHRcdENIQU5HRSBIRVJFIC0gJ3BhZ2UnIHZpZXdzIGFyZSBhbHdheXMgaW4gRE9NIC0gdG8gc2F2ZSBoYXZpbmcgdG8gcmUtaW5pdGlhbGlzZSBnbWFwIGV2ZW50cyAoUElUQSkuIE5vIGxvbmdlciByZXF1aXJlIDpkaXNwb3NlIG1ldGhvZFxuXHRcdCMjI1xuXHRcdEBDRF9DRSgpLmFwcFZpZXcud3JhcHBlci5yZW1vdmUgQFxuXG5cdFx0IyBAY2FsbENoaWxkcmVuQW5kU2VsZiAnc2V0TGlzdGVuZXJzJywgJ29mZidcblxuXHRcdCMjIyByZXBsYWNlIHdpdGggc29tZSBwcm9wZXIgdHJhbnNpdGlvbiBpZiB3ZSBjYW4gIyMjXG5cdFx0QCRlbC5jc3MgJ3Zpc2liaWxpdHknIDogJ2hpZGRlbidcblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdGRpc3Bvc2UgOiA9PlxuXG5cdFx0QGNhbGxDaGlsZHJlbkFuZFNlbGYgJ3NldExpc3RlbmVycycsICdvZmYnXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIHNldHRpbmcgaXNudCBAX2xpc3RlbmluZ1xuXHRcdEBfbGlzdGVuaW5nID0gc2V0dGluZ1xuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Vmlld1BhZ2VcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0VmlldydcblxuY2xhc3MgRm9vdGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cbiAgICB0ZW1wbGF0ZSA6ICdzaXRlLWZvb3RlcidcblxuICAgIGNvbnN0cnVjdG9yOiAtPlxuXG4gICAgICAgIEB0ZW1wbGF0ZVZhcnMgPSBcbiAgICAgICAgXHRkZXNjIDogQENEX0NFKCkubG9jYWxlLmdldCBcImZvb3Rlcl9kZXNjXCJcblxuICAgICAgICBzdXBlcigpXG5cbiAgICAgICAgcmV0dXJuIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBGb290ZXJcbiIsIkFic3RyYWN0VmlldyAgICAgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuUm91dGVyICAgICAgICAgICAgICAgPSByZXF1aXJlICcuLi8uLi9yb3V0ZXIvUm91dGVyJ1xuQ29kZVdvcmRUcmFuc2l0aW9uZXIgPSByZXF1aXJlICcuLi8uLi91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lcidcblxuY2xhc3MgSGVhZGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cblx0dGVtcGxhdGUgOiAnc2l0ZS1oZWFkZXInXG5cblx0RklSU1RfSEFTSENIQU5HRSA6IHRydWVcblx0RE9PRExFX0lORk9fT1BFTiA6IGZhbHNlXG5cblx0RVZFTlRfRE9PRExFX0lORk9fT1BFTiAgIDogJ0VWRU5UX0RPT0RMRV9JTkZPX09QRU4nXG5cdEVWRU5UX0RPT0RMRV9JTkZPX0NMT1NFICA6ICdFVkVOVF9ET09ETEVfSU5GT19DTE9TRSdcblx0RVZFTlRfSE9NRV9TQ1JPTExfVE9fVE9QIDogJ0VWRU5UX0hPTUVfU0NST0xMX1RPX1RPUCdcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdGVtcGxhdGVWYXJzID1cblx0XHRcdGhvbWVfbGFiZWwgIDogQENEX0NFKCkubG9jYWxlLmdldCgnaGVhZGVyX2xvZ29fbGFiZWwnKVxuXHRcdFx0Y2xvc2VfbGFiZWwgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdoZWFkZXJfY2xvc2VfbGFiZWwnKVxuXHRcdFx0aW5mb19sYWJlbCAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdoZWFkZXJfaW5mb19sYWJlbCcpXG5cblx0XHRzdXBlcigpXG5cblx0XHRAYmluZEV2ZW50cygpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0QCRsb2dvICAgICA9IEAkZWwuZmluZCgnLmxvZ29fX2xpbmsnKVxuXHRcdEAkaW5mb0J0biAgPSBAJGVsLmZpbmQoJy5pbmZvLWJ0bicpXG5cdFx0QCRjbG9zZUJ0biA9IEAkZWwuZmluZCgnLmNsb3NlLWJ0bicpXG5cblx0XHRudWxsXG5cblx0YmluZEV2ZW50cyA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9uIEBDRF9DRSgpLmFwcFZpZXcuRVZFTlRfUFJFTE9BREVSX0hJREUsIEBhbmltYXRlVGV4dEluXG5cdFx0QENEX0NFKCkucm91dGVyLm9uIFJvdXRlci5FVkVOVF9IQVNIX0NIQU5HRUQsIEBvbkhhc2hDaGFuZ2VcblxuXHRcdEAkZWwub24gJ21vdXNlZW50ZXInLCAnW2RhdGEtY29kZXdvcmRdJywgQG9uV29yZEVudGVyXG5cdFx0QCRlbC5vbiAnbW91c2VsZWF2ZScsICdbZGF0YS1jb2Rld29yZF0nLCBAb25Xb3JkTGVhdmVcblxuXHRcdEAkaW5mb0J0bi5vbiAnY2xpY2snLCBAb25JbmZvQnRuQ2xpY2tcblx0XHRAJGNsb3NlQnRuLm9uICdjbGljaycsIEBvbkNsb3NlQnRuQ2xpY2tcblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuJHdpbmRvdy5vbiAna2V5dXAnLCBAb25LZXl1cFxuXG5cdFx0bnVsbFxuXG5cdG9uSGFzaENoYW5nZSA6ICh3aGVyZSkgPT5cblxuXHRcdGlmIEBGSVJTVF9IQVNIQ0hBTkdFXG5cdFx0XHRARklSU1RfSEFTSENIQU5HRSA9IGZhbHNlXG5cblx0XHRcdGNvbG9yU2NoZW1lID0gQF9nZXREb29kbGVDb2xvdXJTY2hlbWUoKVxuXHRcdFx0IyBDb2RlV29yZFRyYW5zaXRpb25lci5wcmVwYXJlIFtAJGxvZ28sIEAkaW5mb0J0bl0sIEBfZ2V0RG9vZGxlQ29sb3VyU2NoZW1lKClcblx0XHRcdEAkbG9nby5hZGQoQCRpbmZvQnRuKVxuXHRcdFx0XHQuYWRkQ2xhc3MoY29sb3JTY2hlbWUpXG5cdFx0XHRcdC5hdHRyKCdkYXRhLWNvZGV3b3JkLWluaXRpYWwtc3RhdGUnLCBjb2xvclNjaGVtZSlcblx0XHRcdFx0LmZpbmQoJ1tkYXRhLWNvZGV0ZXh0LWNoYXItc3RhdGVdJylcblx0XHRcdFx0XHQuYXR0cignZGF0YS1jb2RldGV4dC1jaGFyLXN0YXRlJywgY29sb3JTY2hlbWUpXG5cblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLm91dCBbQCRjbG9zZUJ0bl0sIGNvbG9yU2NoZW1lXG5cblx0XHRcdHJldHVyblxuXHRcdFxuXHRcdEBvbkFyZWFDaGFuZ2Ugd2hlcmVcblxuXHRcdG51bGxcblxuXHRvbkFyZWFDaGFuZ2UgOiAoc2VjdGlvbikgPT5cblxuXHRcdEBhY3RpdmVTZWN0aW9uID0gc2VjdGlvblxuXHRcdFxuXHRcdGNvbG91ciA9IEBnZXRTZWN0aW9uQ29sb3VyIHNlY3Rpb25cblxuXHRcdEAkZWwuYXR0ciAnZGF0YS1zZWN0aW9uJywgc2VjdGlvblxuXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIuaW4gQCRsb2dvLCBjb2xvdXJcblxuXHRcdGlmIHNlY3Rpb24gaXMgQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUVcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLmluIFtAJGluZm9CdG5dLCBjb2xvdXJcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLm91dCBbQCRjbG9zZUJ0bl0sIGNvbG91clxuXHRcdGVsc2UgaWYgc2VjdGlvbiBpcyAnZG9vZGxlLWluZm8nXG5cdFx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5pbiBbQCRjbG9zZUJ0bl0sIGNvbG91clxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIuaW4gW0AkaW5mb0J0bl0sICdyZWQtYWN0aXZlJ1xuXG5cdFx0bnVsbFxuXG5cdGdldFNlY3Rpb25Db2xvdXIgOiAoc2VjdGlvbiwgd29yZFNlY3Rpb249bnVsbCkgPT5cblxuXHRcdHNlY3Rpb24gPSBzZWN0aW9uIG9yIEBDRF9DRSgpLm5hdi5jdXJyZW50LmFyZWEgb3IgJ2hvbWUnXG5cblx0XHRpZiB3b3JkU2VjdGlvbiBhbmQgc2VjdGlvbiBpcyB3b3JkU2VjdGlvblxuXHRcdFx0aWYgd29yZFNlY3Rpb24gaXMgJ2Rvb2RsZS1pbmZvJ1xuXHRcdFx0XHRyZXR1cm4gJ3JlZC1hY3RpdmUnXG5cdFx0XHRlbHNlXG5cdFx0XHRcdHJldHVybiAnd2hpdGUtYWN0aXZlJ1xuXG5cdFx0Y29sb3VyID0gc3dpdGNoIHNlY3Rpb25cblx0XHRcdHdoZW4gJ2hvbWUnLCAnZG9vZGxlLWluZm8nIHRoZW4gJ3JlZCdcblx0XHRcdHdoZW4gQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUUgdGhlbiBAX2dldERvb2RsZUNvbG91clNjaGVtZSgpXG5cdFx0XHRlbHNlICd3aGl0ZSdcblxuXHRcdGNvbG91clxuXG5cdF9nZXREb29kbGVDb2xvdXJTY2hlbWUgOiA9PlxuXG5cdFx0Y29sb3VyID0gaWYgQENEX0NFKCkuYXBwRGF0YS5hY3RpdmVEb29kbGUuZ2V0KCdjb2xvdXJfc2NoZW1lJykgaXMgJ2xpZ2h0JyB0aGVuICdibGFjaycgZWxzZSAnd2hpdGUnXG5cblx0XHRjb2xvdXJcblxuXHRhbmltYXRlVGV4dEluIDogPT5cblxuXHRcdEBvbkFyZWFDaGFuZ2UgQENEX0NFKCkubmF2LmN1cnJlbnQuYXJlYVxuXG5cdFx0bnVsbFxuXG5cdG9uV29yZEVudGVyIDogKGUpID0+XG5cblx0XHQkZWwgPSAkKGUuY3VycmVudFRhcmdldClcblx0XHR3b3JkU2VjdGlvbiA9ICRlbC5hdHRyKCdkYXRhLXdvcmQtc2VjdGlvbicpXG5cblx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5zY3JhbWJsZSAkZWwsIEBnZXRTZWN0aW9uQ29sb3VyKEBhY3RpdmVTZWN0aW9uLCB3b3JkU2VjdGlvbilcblxuXHRcdG51bGxcblxuXHRvbldvcmRMZWF2ZSA6IChlKSA9PlxuXG5cdFx0JGVsID0gJChlLmN1cnJlbnRUYXJnZXQpXG5cdFx0d29yZFNlY3Rpb24gPSAkZWwuYXR0cignZGF0YS13b3JkLXNlY3Rpb24nKVxuXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIudW5zY3JhbWJsZSAkZWwsIEBnZXRTZWN0aW9uQ29sb3VyKEBhY3RpdmVTZWN0aW9uLCB3b3JkU2VjdGlvbilcblxuXHRcdG51bGxcblxuXHRvbkluZm9CdG5DbGljayA6IChlKSA9PlxuXG5cdFx0ZS5wcmV2ZW50RGVmYXVsdCgpXG5cblx0XHRyZXR1cm4gdW5sZXNzIEBDRF9DRSgpLm5hdi5jdXJyZW50LmFyZWEgaXMgQENEX0NFKCkubmF2LnNlY3Rpb25zLkhPTUVcblxuXHRcdGlmICFARE9PRExFX0lORk9fT1BFTlxuXHRcdFx0QHNob3dEb29kbGVJbmZvKClcblx0XHRlbHNlXG5cdFx0XHRAaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0bnVsbFxuXG5cdG9uQ2xvc2VCdG5DbGljayA6IChlKSA9PlxuXG5cdFx0aWYgQERPT0RMRV9JTkZPX09QRU5cblx0XHRcdGUucHJldmVudERlZmF1bHQoKVxuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKVxuXHRcdFx0QGhpZGVEb29kbGVJbmZvKClcblxuXHRcdG51bGxcblxuXHRvbktleXVwIDogKGUpID0+XG5cblx0XHRpZiBlLmtleUNvZGUgaXMgMjcgdGhlbiBAaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0bnVsbFxuXG5cdHNob3dEb29kbGVJbmZvIDogPT5cblxuXHRcdHJldHVybiB1bmxlc3MgIUBET09ETEVfSU5GT19PUEVOXG5cblx0XHRAb25BcmVhQ2hhbmdlICdkb29kbGUtaW5mbydcblx0XHRAdHJpZ2dlciBARVZFTlRfRE9PRExFX0lORk9fT1BFTlxuXHRcdEBET09ETEVfSU5GT19PUEVOID0gdHJ1ZVxuXG5cdFx0bnVsbFxuXG5cdGhpZGVEb29kbGVJbmZvIDogPT5cblxuXHRcdHJldHVybiB1bmxlc3MgQERPT0RMRV9JTkZPX09QRU5cblxuXHRcdEBvbkFyZWFDaGFuZ2UgQENEX0NFKCkubmF2LmN1cnJlbnQuYXJlYVxuXHRcdEB0cmlnZ2VyIEBFVkVOVF9ET09ETEVfSU5GT19DTE9TRVxuXHRcdEBET09ETEVfSU5GT19PUEVOID0gZmFsc2VcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBIZWFkZXJcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0VmlldydcblxuY2xhc3MgUHJlbG9hZGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cdFxuXHRjYiAgICAgICAgICAgICAgOiBudWxsXG5cdFxuXHRUUkFOU0lUSU9OX1RJTUUgOiAwLjVcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAc2V0RWxlbWVudCAkKCcjcHJlbG9hZGVyJylcblxuXHRcdHN1cGVyKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRudWxsXG5cblx0c2hvdyA6IChAY2IpID0+XG5cblx0XHRAJGVsLmNzcyAnZGlzcGxheScgOiAnYmxvY2snXG5cblx0XHRudWxsXG5cblx0b25TaG93Q29tcGxldGUgOiA9PlxuXG5cdFx0QGNiPygpXG5cblx0XHRudWxsXG5cblx0aGlkZSA6IChAY2IpID0+XG5cblx0XHRAb25IaWRlQ29tcGxldGUoKVxuXG5cdFx0bnVsbFxuXG5cdG9uSGlkZUNvbXBsZXRlIDogPT5cblxuXHRcdEAkZWwuY3NzICdkaXNwbGF5JyA6ICdub25lJ1xuXHRcdEBjYj8oKVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFByZWxvYWRlclxuIiwiQWJzdHJhY3RWaWV3ICAgICAgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5Db2RlV29yZFRyYW5zaXRpb25lciA9IHJlcXVpcmUgJy4uLy4uL3V0aWxzL0NvZGVXb3JkVHJhbnNpdGlvbmVyJ1xuXG5jbGFzcyBTaG93QXBwc0J0biBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG4gICAgdGVtcGxhdGUgOiAnc2hvdy1hcHBzLWJ0bidcblxuICAgIGNvbnN0cnVjdG9yOiAtPlxuXG4gICAgICAgIEB0ZW1wbGF0ZVZhcnMgPSB7fVxuXG4gICAgICAgIHN1cGVyKClcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgaW5pdCA6ID0+XG5cbiAgICAgICAgcmV0dXJuIHVubGVzcyBAQ0RfQ0UoKS5hcHBEYXRhLmFjdGl2ZURvb2RsZVxuXG4gICAgICAgIEBhY3RpdmVDb2xvdXIgPSBpZiBAQ0RfQ0UoKS5hcHBEYXRhLmFjdGl2ZURvb2RsZS5nZXQoJ2NvbG91cl9zY2hlbWUnKSBpcyAnbGlnaHQnIHRoZW4gJ2JsYWNrJyBlbHNlICd3aGl0ZSdcblxuICAgICAgICBDb2RlV29yZFRyYW5zaXRpb25lci5wcmVwYXJlIEAkZWwsIEBhY3RpdmVDb2xvdXJcblxuICAgICAgICBAYmluZEV2ZW50cygpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgYmluZEV2ZW50cyA6ID0+XG5cbiAgICAgICAgQCRlbC5vbiAnbW91c2VlbnRlcicsIEBvbldvcmRFbnRlclxuICAgICAgICBAJGVsLm9uICdtb3VzZWxlYXZlJywgQG9uV29yZExlYXZlXG5cbiAgICAgICAgQCRlbC5vbiAnY2xpY2snLCBAb25DbGlja1xuXG4gICAgICAgIG51bGxcblxuICAgIG9uV29yZEVudGVyIDogKGUpID0+XG5cbiAgICAgICAgQ29kZVdvcmRUcmFuc2l0aW9uZXIuc2NyYW1ibGUgQCRlbCwgQGFjdGl2ZUNvbG91clxuXG4gICAgICAgIG51bGxcblxuICAgIG9uV29yZExlYXZlIDogKGUpID0+XG5cbiAgICAgICAgQ29kZVdvcmRUcmFuc2l0aW9uZXIudW5zY3JhbWJsZSBAJGVsLCBAYWN0aXZlQ29sb3VyXG5cbiAgICAgICAgbnVsbFxuXG4gICAgb25DbGljayA6ID0+XG5cbiAgICAgICAgY2hyb21lLnRhYnMudXBkYXRlIHVybDogJ2Nocm9tZTovL2FwcHMnXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFNob3dBcHBzQnRuXG4iLCJBYnN0cmFjdFZpZXcgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5Eb29kbGVQYWdlVmlldyAgICAgPSByZXF1aXJlICcuLi9kb29kbGVQYWdlL0Rvb2RsZVBhZ2VWaWV3J1xuTmF2ICAgICAgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vcm91dGVyL05hdidcblxuY2xhc3MgV3JhcHBlciBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdFZJRVdfVFlQRV9QQUdFICA6ICdwYWdlJ1xuXHRWSUVXX1RZUEVfTU9EQUwgOiAnbW9kYWwnXG5cblx0dGVtcGxhdGUgOiAnd3JhcHBlcidcblxuXHR2aWV3cyAgICAgICAgICA6IG51bGxcblx0cHJldmlvdXNWaWV3ICAgOiBudWxsXG5cdGN1cnJlbnRWaWV3ICAgIDogbnVsbFxuXHRiYWNrZ3JvdW5kVmlldyA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdmlld3MgPVxuXHRcdFx0ZG9vZGxlIDogY2xhc3NSZWYgOiBEb29kbGVQYWdlVmlldywgcm91dGUgOiBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRSwgdmlldyA6IG51bGwsIHR5cGUgOiBAVklFV19UWVBFX1BBR0VcblxuXHRcdEBjcmVhdGVDbGFzc2VzKClcblxuXHRcdHN1cGVyKClcblxuXHRcdCMgZGVjaWRlIGlmIHlvdSB3YW50IHRvIGFkZCBhbGwgY29yZSBET00gdXAgZnJvbnQsIG9yIGFkZCBvbmx5IHdoZW4gcmVxdWlyZWQsIHNlZSBjb21tZW50cyBpbiBBYnN0cmFjdFZpZXdQYWdlLmNvZmZlZVxuXHRcdCMgQGFkZENsYXNzZXMoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRjcmVhdGVDbGFzc2VzIDogPT5cblxuXHRcdChAdmlld3NbbmFtZV0udmlldyA9IG5ldyBAdmlld3NbbmFtZV0uY2xhc3NSZWYpIGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXG5cdFx0bnVsbFxuXG5cdGFkZENsYXNzZXMgOiA9PlxuXG5cdFx0IGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXHRcdCBcdGlmIGRhdGEudHlwZSBpcyBAVklFV19UWVBFX1BBR0UgdGhlbiBAYWRkQ2hpbGQgZGF0YS52aWV3XG5cblx0XHRudWxsXG5cblx0Z2V0Vmlld0J5Um91dGUgOiAocm91dGUpID0+XG5cblx0XHRmb3IgbmFtZSwgZGF0YSBvZiBAdmlld3Ncblx0XHRcdHJldHVybiBAdmlld3NbbmFtZV0gaWYgcm91dGUgaXMgQHZpZXdzW25hbWVdLnJvdXRlXG5cblx0XHRudWxsXG5cblx0Z2V0Vmlld0J5Um91dGUgOiAocm91dGUpID0+XG5cblx0XHRmb3IgbmFtZSwgZGF0YSBvZiBAdmlld3Ncblx0XHRcdHJldHVybiBAdmlld3NbbmFtZV0gaWYgcm91dGUgaXMgQHZpZXdzW25hbWVdLnJvdXRlXG5cblx0XHRpZiByb3V0ZSB0aGVuIHJldHVybiBAdmlld3MuZm91ck9oRm91clxuXG5cdFx0bnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5vbiAnc3RhcnQnLCBAc3RhcnRcblxuXHRcdG51bGxcblxuXHRzdGFydCA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9mZiAnc3RhcnQnLCBAc3RhcnRcblxuXHRcdEBiaW5kRXZlbnRzKClcblx0XHRAdXBkYXRlRGltcygpXG5cblx0XHRudWxsXG5cblx0YmluZEV2ZW50cyA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5uYXYub24gTmF2LkVWRU5UX0NIQU5HRV9WSUVXLCBAY2hhbmdlVmlld1xuXHRcdEBDRF9DRSgpLm5hdi5vbiBOYXYuRVZFTlRfQ0hBTkdFX1NVQl9WSUVXLCBAY2hhbmdlU3ViVmlld1xuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5vbiBAQ0RfQ0UoKS5hcHBWaWV3LkVWRU5UX1VQREFURV9ESU1FTlNJT05TLCBAdXBkYXRlRGltc1xuXG5cdFx0bnVsbFxuXG5cdHVwZGF0ZURpbXMgOiA9PlxuXG5cdFx0QCRlbC5jc3MgJ21pbi1oZWlnaHQnLCBAQ0RfQ0UoKS5hcHBWaWV3LmRpbXMuaFxuXG5cdFx0bnVsbFxuXG5cdGNoYW5nZVZpZXcgOiAocHJldmlvdXMsIGN1cnJlbnQpID0+XG5cblx0XHRpZiBAcGFnZVN3aXRjaERmZCBhbmQgQHBhZ2VTd2l0Y2hEZmQuc3RhdGUoKSBpc250ICdyZXNvbHZlZCdcblx0XHRcdGRvIChwcmV2aW91cywgY3VycmVudCkgPT4gQHBhZ2VTd2l0Y2hEZmQuZG9uZSA9PiBAY2hhbmdlVmlldyBwcmV2aW91cywgY3VycmVudFxuXHRcdFx0cmV0dXJuXG5cblx0XHRAcHJldmlvdXNWaWV3ID0gQGdldFZpZXdCeVJvdXRlIHByZXZpb3VzLmFyZWFcblx0XHRAY3VycmVudFZpZXcgID0gQGdldFZpZXdCeVJvdXRlIGN1cnJlbnQuYXJlYVxuXG5cdFx0aWYgIUBwcmV2aW91c1ZpZXdcblx0XHRcdEB0cmFuc2l0aW9uVmlld3MgZmFsc2UsIEBjdXJyZW50Vmlld1xuXHRcdGVsc2Vcblx0XHRcdEB0cmFuc2l0aW9uVmlld3MgQHByZXZpb3VzVmlldywgQGN1cnJlbnRWaWV3XG5cblx0XHRudWxsXG5cblx0Y2hhbmdlU3ViVmlldyA6IChjdXJyZW50KSA9PlxuXG5cdFx0QGN1cnJlbnRWaWV3LnZpZXcudHJpZ2dlciBOYXYuRVZFTlRfQ0hBTkdFX1NVQl9WSUVXLCBjdXJyZW50LnN1YlxuXG5cdFx0bnVsbFxuXG5cdHRyYW5zaXRpb25WaWV3cyA6IChmcm9tLCB0bykgPT5cblxuXHRcdEBwYWdlU3dpdGNoRGZkID0gJC5EZWZlcnJlZCgpXG5cblx0XHRpZiBmcm9tIGFuZCB0b1xuXHRcdFx0QENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIucHJlcGFyZSBmcm9tLnJvdXRlLCB0by5yb3V0ZVxuXHRcdFx0QENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIuaW4gPT4gZnJvbS52aWV3LmhpZGUgPT4gdG8udmlldy5zaG93ID0+IEBDRF9DRSgpLmFwcFZpZXcudHJhbnNpdGlvbmVyLm91dCA9PiBAcGFnZVN3aXRjaERmZC5yZXNvbHZlKClcblx0XHRlbHNlIGlmIGZyb21cblx0XHRcdGZyb20udmlldy5oaWRlIEBwYWdlU3dpdGNoRGZkLnJlc29sdmVcblx0XHRlbHNlIGlmIHRvXG5cdFx0XHR0by52aWV3LnNob3cgQHBhZ2VTd2l0Y2hEZmQucmVzb2x2ZVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IFdyYXBwZXJcbiIsIkFic3RyYWN0Vmlld1BhZ2UgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3UGFnZSdcbkNvZGVXb3JkVHJhbnNpdGlvbmVyID0gcmVxdWlyZSAnLi4vLi4vdXRpbHMvQ29kZVdvcmRUcmFuc2l0aW9uZXInXG5NZWRpYVF1ZXJpZXMgICAgICAgICA9IHJlcXVpcmUgJy4uLy4uL3V0aWxzL01lZGlhUXVlcmllcydcblxuY2xhc3MgRG9vZGxlUGFnZVZpZXcgZXh0ZW5kcyBBYnN0cmFjdFZpZXdQYWdlXG5cblx0dGVtcGxhdGUgOiAncGFnZS1kb29kbGUnXG5cdG1vZGVsICAgIDogbnVsbFxuXG5cdGNvbG91clNjaGVtZSA6IG51bGxcblx0cmVmcmVzaFRpbWVyIDogbnVsbFxuXG5cdGluZm9TY3JvbGxlciA6IG51bGxcblxuXHRNSU5fUEFERElOR19UT1AgICAgOiAyMzBcblx0TUlOX1BBRERJTkdfQk9UVE9NIDogODVcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdGVtcGxhdGVWYXJzID1cblx0XHRcdHJlZnJlc2hfYnRuX3RpdGxlIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9yZWZyZXNoX2J0bl90aXRsZVwiXG5cdFx0XHRyYW5kb21fYnRuX3RpdGxlICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfcmFuZG9tX2J0bl90aXRsZVwiXG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0QCRmcmFtZSAgICAgICAgPSBAJGVsLmZpbmQoJ1tkYXRhLWRvb2RsZS1mcmFtZV0nKVxuXHRcdEAkaW5mb0NvbnRlbnQgID0gQCRlbC5maW5kKCdbZGF0YS1kb29kbGUtaW5mb10nKVxuXHRcdEAkaW5zdHJ1Y3Rpb25zID0gQCRlbC5maW5kKCdbZGF0YS1kb29kbGUtaW5zdHJ1Y3Rpb25zXScpXG5cblx0XHRAJHJlZnJlc2hCdG4gPSBAJGVsLmZpbmQoJ1tkYXRhLWRvb2RsZS1yZWZyZXNoXScpXG5cdFx0QCRyYW5kb21CdG4gID0gQCRlbC5maW5kKCdbZGF0YS1kb29kbGUtcmFuZG9tXScpXG5cblx0XHRAJHNob3dEb29kbGVCdG5QYW5lID0gQCRlbC5maW5kKCdbZGF0YS1zaG93LWRvb2RsZS1idG4tcGFuZV0nKVxuXHRcdEAkc2hvd0Rvb2RsZUJ0biA9IEAkZWwuZmluZCgnW2RhdGEtc2hvdy1kb29kbGUtYnRuXScpXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3W3NldHRpbmddIEBDRF9DRSgpLmFwcFZpZXcuRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMsIEBvblJlc2l6ZVxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5oZWFkZXJbc2V0dGluZ10gQENEX0NFKCkuYXBwVmlldy5oZWFkZXIuRVZFTlRfRE9PRExFX0lORk9fT1BFTiwgQG9uSW5mb09wZW5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlcltzZXR0aW5nXSBAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlci5FVkVOVF9ET09ETEVfSU5GT19DTE9TRSwgQG9uSW5mb0Nsb3NlXG5cblx0XHRAJGVsW3NldHRpbmddICdjbGljaycsICdbZGF0YS1zaGFyZS1idG5dJywgQG9uU2hhcmVCdG5DbGlja1xuXHRcdCMgQCRpbmZvQ29udGVudFtzZXR0aW5nXSAnY2xpY2snLCBAb25JbmZvQ29udGVudENsaWNrXG5cblx0XHRAJHJlZnJlc2hCdG5bc2V0dGluZ10gJ2NsaWNrJywgQG9uUmVmcmVzaEJ0bkNsaWNrXG5cdFx0QCRyYW5kb21CdG5bc2V0dGluZ10gJ2NsaWNrJywgQG9uUmFuZG9tQnRuQ2xpY2tcblxuXHRcdG51bGxcblxuXHRvblJlc2l6ZSA6ID0+XG5cblx0XHRAc2V0dXBJbmZvRGltcygpXG5cblx0XHRudWxsXG5cblx0c2hvdyA6IChjYikgPT5cblxuXHRcdEBtb2RlbCA9IEBDRF9DRSgpLmFwcERhdGEuYWN0aXZlRG9vZGxlXG5cblx0XHRAc2V0dXBVSSgpXG5cblx0XHRzdXBlclxuXG5cdFx0aWYgQENEX0NFKCkuYXBwRGF0YS5PUFRJT05TLmF1dG9wbGF5XG5cdFx0XHRAc2hvd0ZyYW1lIGZhbHNlXG5cdFx0ZWxzZVxuXHRcdFx0QHNob3dTaG93RG9vZGxlQnRuKClcblxuXHRcdG51bGxcblxuXHRoaWRlIDogKGNiKSA9PlxuXG5cdFx0QENEX0NFKCkuYXBwVmlldy5oZWFkZXIuaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0c3VwZXJcblxuXHRcdG51bGxcblxuXHRzZXR1cFVJIDogPT5cblxuXHRcdEAkaW5mb0NvbnRlbnQuaHRtbCBAZ2V0RG9vZGxlSW5mb0NvbnRlbnQoKVxuXG5cdFx0QCRlbC5hdHRyICdkYXRhLWNvbG9yLXNjaGVtZScsIEBtb2RlbC5nZXQoJ2NvbG91cl9zY2hlbWUnKVxuXHRcdEAkZnJhbWUuYXR0cignc3JjJywgJycpLnJlbW92ZUNsYXNzKCdzaG93JylcblxuXHRcdEBjb2xvdXJTY2hlbWUgPSBpZiBAbW9kZWwuZ2V0KCdjb2xvdXJfc2NoZW1lJykgaXMgJ2xpZ2h0JyB0aGVuICdibGFjaycgZWxzZSAnd2hpdGUnXG5cblx0XHRAc2V0dXBJbnN0cnVjdGlvbnMoKVxuXG5cdFx0bnVsbFxuXG5cdHNldHVwSW5mb0RpbXMgOiA9PlxuXG5cdFx0QCRkb29kbGVJbmZvQ29udGVudCA9IEAkZWwuZmluZCgnW2RhdGEtZG9vZGxlLWluZm8tY29udGVudF0nKVxuXHRcdEAkZG9vZGxlSW5mb0NvbnRlbnQucmVtb3ZlQ2xhc3MoJ2VuYWJsZS1vdmVyZmxvdycpLmNzcyh7IHRvcDogJyd9KVxuXHRcdFx0LmZpbmQoJy5kb29kbGUtaW5mby1pbm5lcicpLmNzcyh7IG1heEhlaWdodDogJycgfSlcblxuXHRcdGNvbnRlbnRPZmZzZXQgPSBAJGRvb2RsZUluZm9Db250ZW50Lm9mZnNldCgpLnRvcFxuXG5cdFx0cmVxdWlyZXNPdmVyZmxvdyA9IChjb250ZW50T2Zmc2V0IDw9IEBNSU5fUEFERElOR19UT1ApIGFuZCAoQENEX0NFKCkuYXBwVmlldy5kaW1zLncgPj0gNzUwKSAjIHRoaXMgNzUwIGlzIGZyb20gdGhlIGdyaWQgYnJlYWtwb2ludHMgd2hpY2ggYXJlbid0IGF2YWlsYWJsZSB0byBNZWRpYVF1ZXJpZXMgY2xhc1xuXG5cdFx0Y29uc29sZS5sb2cgXCJzZXR1cEluZm9EaW1zIDogPT5cIiwgY29udGVudE9mZnNldCwgcmVxdWlyZXNPdmVyZmxvd1xuXG5cdFx0aWYgcmVxdWlyZXNPdmVyZmxvd1xuXG5cdFx0XHR0b3AgICAgICAgPSBATUlOX1BBRERJTkdfVE9QXG5cdFx0XHRtYXhIZWlnaHQgPSBAQ0RfQ0UoKS5hcHBWaWV3LmRpbXMuaCAtIEBNSU5fUEFERElOR19UT1AgLSBATUlOX1BBRERJTkdfQk9UVE9NXG5cblx0XHRcdEBfc2V0dXBJbmZvV2l0aE92ZXJmbG93IHRvcCwgbWF4SGVpZ2h0XG5cblx0XHRlbHNlXG5cblx0XHRcdEBfc2V0dXBJbmZvV2l0aG91dE92ZXJmbG93KClcblxuXHRcdG51bGxcblxuXHRfc2V0dXBJbmZvV2l0aE92ZXJmbG93IDogKHRvcCwgbWF4SGVpZ2h0KSA9PlxuXG5cdFx0QCRkb29kbGVJbmZvQ29udGVudC5hZGRDbGFzcygnZW5hYmxlLW92ZXJmbG93JykuY3NzKHsgdG9wOiB0b3AgfSlcblx0XHRcdC5maW5kKCcuZG9vZGxlLWluZm8taW5uZXInKS5jc3MoeyBtYXhIZWlnaHQ6IG1heEhlaWdodCB9KVxuXG5cdFx0JGluZm9Db250ZW50SW5uZXIgPSBAJGRvb2RsZUluZm9Db250ZW50LmZpbmQoJy5kb29kbGUtaW5mby1pbm5lcicpXG5cblx0XHRpZiAhTW9kZXJuaXpyLnRvdWNoXG5cblx0XHRcdGlTY3JvbGxPcHRzID0gXG5cdFx0XHRcdG1vdXNlV2hlZWwgICAgICAgICAgICA6IHRydWVcblx0XHRcdFx0c2Nyb2xsYmFycyAgICAgICAgICAgIDogdHJ1ZVxuXHRcdFx0XHRpbnRlcmFjdGl2ZVNjcm9sbGJhcnMgOiB0cnVlXG5cdFx0XHRcdGZhZGVTY3JvbGxiYXJzICAgICAgICA6IHRydWVcblx0XHRcdFx0bW9tZW50dW0gICAgICAgICAgICAgIDogZmFsc2Vcblx0XHRcdFx0Ym91bmNlICAgICAgICAgICAgICAgIDogZmFsc2Vcblx0XHRcdFx0cHJldmVudERlZmF1bHQgICAgICAgIDogZmFsc2VcblxuXHRcdFx0aWYgQGluZm9TY3JvbGxlclxuXHRcdFx0XHRAaW5mb1Njcm9sbGVyLnJlZnJlc2goKVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRAaW5mb1Njcm9sbGVyID0gbmV3IElTY3JvbGwgJGluZm9Db250ZW50SW5uZXJbMF0sIGlTY3JvbGxPcHRzXG5cblx0XHRudWxsXG5cblx0X3NldHVwSW5mb1dpdGhvdXRPdmVyZmxvdyA6ID0+XG5cblx0XHRAJGRvb2RsZUluZm9Db250ZW50LnJlbW92ZUNsYXNzKCdlbmFibGUtb3ZlcmZsb3cnKS5jc3MoeyB0b3A6ICcnIH0pXG5cdFx0XHQuZmluZCgnLmRvb2RsZS1pbmZvLWlubmVyJykuY3NzKHsgbWF4SGVpZ2h0OiAnJyB9KVxuXG5cdFx0QGluZm9TY3JvbGxlcj8uZGVzdHJveSgpXG5cdFx0QGluZm9TY3JvbGxlciA9IG51bGxcblxuXHRcdG51bGxcblxuXHRzaG93RnJhbWUgOiAocmVtb3ZlRXZlbnQ9dHJ1ZSwgZGVsYXk9bnVsbCkgPT5cblxuXHRcdGlmIHJlbW92ZUV2ZW50IHRoZW4gQENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIub2ZmIEBDRF9DRSgpLmFwcFZpZXcudHJhbnNpdGlvbmVyLkVWRU5UX1RSQU5TSVRJT05FUl9PVVRfRE9ORSwgQHNob3dGcmFtZVxuXG5cdFx0QCRmcmFtZS5hdHRyICdzcmMnLCBcIiN7QENEX0NFKCkuRE9PRExFU19VUkx9LyN7QG1vZGVsLmdldCgnc2x1ZycpfS9pbmRleC5odG1sXCJcblx0XHRAJGZyYW1lLm9uZSAnbG9hZCcsID0+IEBzaG93RG9vZGxlIGRlbGF5XG5cblx0XHRudWxsXG5cblx0c2hvd0Rvb2RsZSA6IChkZWxheSkgPT5cblxuXHRcdEAkZnJhbWUuYWRkQ2xhc3MoJ3Nob3cnKVxuXHRcdHNldFRpbWVvdXQgPT5cblx0XHRcdGJsYW5rSW5zdHJ1Y3Rpb25zID0gQG1vZGVsLmdldCgnaW5zdHJ1Y3Rpb25zJykuc3BsaXQoJycpLm1hcCgtPiByZXR1cm4gJyAnKS5qb2luKCcnKVxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIudG8gYmxhbmtJbnN0cnVjdGlvbnMsIEAkaW5zdHJ1Y3Rpb25zLCBAY29sb3VyU2NoZW1lXG5cdFx0LCBkZWxheSBvciAxMDAwXG5cblx0XHQjIGFsbG93IGZyYW1lIHRvIHRyYW5zaXRpb24gaW4gYW5kIHRoZW4gZm9jdXMgaXRcblx0XHRzZXRUaW1lb3V0ID0+XG5cdFx0XHRAJGZyYW1lLmZvY3VzKClcblx0XHQsIDUwMFxuXG5cdFx0bnVsbFxuXG5cdGhpZGVEb29kbGUgOiA9PlxuXG5cdFx0QCRmcmFtZS5yZW1vdmVDbGFzcygnc2hvdycpXG5cblx0XHRudWxsXG5cblx0c2V0dXBJbnN0cnVjdGlvbnMgOiA9PlxuXG5cdFx0JG5ld0luc3RydWN0aW9ucyA9IEBnZXRJbnN0cnVjdGlvbnMoKVxuXHRcdEAkaW5zdHJ1Y3Rpb25zLnJlcGxhY2VXaXRoICRuZXdJbnN0cnVjdGlvbnNcblx0XHRAJGluc3RydWN0aW9ucyA9ICRuZXdJbnN0cnVjdGlvbnNcblxuXHRcdG51bGxcblxuXHRnZXRJbnN0cnVjdGlvbnMgOiA9PlxuXG5cdFx0JGluc3RydWN0aW9uc0VsID0gJCgnPHNwYW4gLz4nKVxuXHRcdCRpbnN0cnVjdGlvbnNFbFxuXHRcdFx0LmFkZENsYXNzKCdkb29kbGUtaW5zdHJ1Y3Rpb25zJylcblx0XHRcdC5hdHRyKCdkYXRhLWNvZGV3b3JkJywgJycpXG5cdFx0XHQuYXR0cignZGF0YS1kb29kbGUtaW5zdHJ1Y3Rpb25zJywgJycpXG5cdFx0XHQudGV4dChAbW9kZWwuZ2V0KCdpbnN0cnVjdGlvbnMnKS50b0xvd2VyQ2FzZSgpKVxuXG5cdFx0Y29uc29sZS5sb2cgXCJAbW9kZWwuZ2V0KCdpbnN0cnVjdGlvbnMnKS50b0xvd2VyQ2FzZSgpXCJcblx0XHRjb25zb2xlLmxvZyBAbW9kZWwuZ2V0KCdpbnN0cnVjdGlvbnMnKS50b0xvd2VyQ2FzZSgpXG5cblx0XHRjb2xvdXJTY2hlbWUgPSBpZiBAbW9kZWwuZ2V0KCdjb2xvdXJfc2NoZW1lJykgaXMgJ2xpZ2h0JyB0aGVuICdibGFjaycgZWxzZSAnd2hpdGUnXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIucHJlcGFyZSAkaW5zdHJ1Y3Rpb25zRWwsIEBjb2xvdXJTY2hlbWVcblxuXHRcdGNvbnNvbGUubG9nIFwiJGluc3RydWN0aW9uc0VsXCJcblx0XHRjb25zb2xlLmxvZyAkaW5zdHJ1Y3Rpb25zRWxcblxuXHRcdCRpbnN0cnVjdGlvbnNFbFxuXG5cdGdldERvb2RsZUluZm9Db250ZW50IDogPT5cblxuXHRcdGRvb2RsZUluZm9WYXJzID1cblx0XHRcdGluZGV4SFRNTCAgICAgICAgICAgICAgICAgICA6IEBtb2RlbC5nZXQoJ2luZGV4SFRNTCcpXG5cdFx0XHR0aHVtYiAgICAgICAgICAgICAgICAgICAgICAgOiBAQ0RfQ0UoKS5ET09ETEVTX1VSTCArICcvJyArIEBtb2RlbC5nZXQoJ3NsdWcnKSArICcvdGh1bWIuanBnJ1xuXHRcdFx0bGFiZWxfYXV0aG9yICAgICAgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9hdXRob3JcIlxuXHRcdFx0Y29udGVudF9hdXRob3IgICAgICAgICAgICAgIDogQG1vZGVsLmdldEF1dGhvckh0bWwoKVxuXHRcdFx0bGFiZWxfZG9vZGxlX25hbWUgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9kb29kbGVfbmFtZVwiXG5cdFx0XHRjb250ZW50X2Rvb2RsZV9uYW1lICAgICAgICAgOiBAbW9kZWwuZ2V0KCduYW1lJylcblx0XHRcdGxhYmVsX2Rvb2RsZV9pbnN0cnVjdGlvbnMgICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQgJ2Rvb2RsZV9sYWJlbF9pbnN0cnVjdGlvbnMnXG5cdFx0XHRjb250ZW50X2Rvb2RsZV9pbnN0cnVjdGlvbnMgOiBAbW9kZWwuZ2V0KCdpbnN0cnVjdGlvbnMnKSBvciBAQ0RfQ0UoKS5sb2NhbGUuZ2V0ICdkb29kbGVfbGFiZWxfaW5zdHJ1Y3Rpb25zX25vbmUnXG5cdFx0XHRsYWJlbF9kZXNjcmlwdGlvbiAgICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2Rlc2NyaXB0aW9uXCJcblx0XHRcdGNvbnRlbnRfZGVzY3JpcHRpb24gICAgICAgICA6IEBtb2RlbC5nZXQoJ2Rlc2NyaXB0aW9uJylcblx0XHRcdGxhYmVsX3RhZ3MgICAgICAgICAgICAgICAgICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfdGFnc1wiXG5cdFx0XHRjb250ZW50X3RhZ3MgICAgICAgICAgICAgICAgOiBAbW9kZWwuZ2V0KCd0YWdzJykuam9pbignLCAnKVxuXHRcdFx0bGFiZWxfaW50ZXJhY3Rpb24gICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvblwiXG5cdFx0XHRjb250ZW50X2ludGVyYWN0aW9uICAgICAgICAgOiBAX2dldEludGVyYWN0aW9uQ29udGVudCgpXG5cdFx0XHRsYWJlbF9zaGFyZSAgICAgICAgICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX3NoYXJlXCJcblx0XHRcdHNoYXJlX3VybCAgICAgICAgICAgICAgICAgICA6IEBDRF9DRSgpLlNJVEVfVVJMICsgJy8nICsgQG1vZGVsLmdldCgnaWQnKVxuXHRcdFx0c2hhcmVfdXJsX3RleHQgICAgICAgICAgICAgIDogQENEX0NFKCkuU0lURV9VUkwucmVwbGFjZSgnaHR0cDovLycsICcnKSArICcvJyArIEBtb2RlbC5nZXQoJ2lkJylcblx0XHRcdG1vdXNlX2VuYWJsZWQgICAgICAgICAgICAgICA6IEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLm1vdXNlJylcblx0XHRcdGtleWJvYXJkX2VuYWJsZWQgICAgICAgICAgICA6IEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLmtleWJvYXJkJylcblx0XHRcdHRvdWNoX2VuYWJsZWQgICAgICAgICAgICAgICA6IEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLnRvdWNoJylcblxuXHRcdGRvb2RsZUluZm9Db250ZW50ID0gXy50ZW1wbGF0ZShAQ0RfQ0UoKS50ZW1wbGF0ZXMuZ2V0KCdkb29kbGUtaW5mbycpKShkb29kbGVJbmZvVmFycylcblxuXHRcdGRvb2RsZUluZm9Db250ZW50XG5cblx0X2dldEludGVyYWN0aW9uQ29udGVudCA6ID0+XG5cblx0XHRpbnRlcmFjdGlvbnMgPSBbXVxuXG5cdFx0aWYgQG1vZGVsLmdldCgnaW50ZXJhY3Rpb24ubW91c2UnKSB0aGVuIGludGVyYWN0aW9ucy5wdXNoIEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfaW50ZXJhY3Rpb25fbW91c2VcIlxuXHRcdGlmIEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLmtleWJvYXJkJykgdGhlbiBpbnRlcmFjdGlvbnMucHVzaCBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uX2tleWJvYXJkXCJcblx0XHRpZiBAbW9kZWwuZ2V0KCdpbnRlcmFjdGlvbi50b3VjaCcpIHRoZW4gaW50ZXJhY3Rpb25zLnB1c2ggQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvbl90b3VjaFwiXG5cblx0XHRpbnRlcmFjdGlvbnMuam9pbignLCAnKSBvciBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uX25vbmVcIlxuXG5cdG9uSW5mb09wZW4gOiA9PlxuXG5cdFx0QHNldHVwSW5mb0RpbXMoKVxuXG5cdFx0QCRlbC5hZGRDbGFzcygnc2hvdy1pbmZvJylcblxuXHRcdG51bGxcblxuXHRvbkluZm9DbG9zZSA6ID0+XG5cblx0XHRAJGVsLnJlbW92ZUNsYXNzKCdzaG93LWluZm8nKVxuXG5cdFx0c2V0VGltZW91dCA9PlxuXHRcdFx0QGluZm9TY3JvbGxlcj8uZGVzdHJveSgpXG5cdFx0XHRAaW5mb1Njcm9sbGVyID0gbnVsbFxuXHRcdCwgNTAwXG5cblx0XHRudWxsXG5cblx0b25TaGFyZUJ0bkNsaWNrIDogKGUpID0+XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KClcblxuXHRcdHNoYXJlTWV0aG9kID0gJChlLmN1cnJlbnRUYXJnZXQpLmF0dHIoJ2RhdGEtc2hhcmUtYnRuJylcblx0XHR1cmwgICAgICAgICA9IGlmIHNoYXJlTWV0aG9kIGlzICdmYWNlYm9vaycgdGhlbiBAQ0RfQ0UoKS5TSVRFX1VSTCArICcvJyArIEBtb2RlbC5nZXQoJ2lkJykgZWxzZSAnICdcblx0XHRkZXNjICAgICAgICA9IEBnZXRTaGFyZURlc2MoKVxuXG5cdFx0QENEX0NFKCkuc2hhcmVbc2hhcmVNZXRob2RdIHVybCwgZGVzY1xuXG5cdFx0bnVsbFxuXG5cdGdldFNoYXJlRGVzYyA6ID0+XG5cblx0XHR2YXJzID1cblx0XHRcdGRvb2RsZV9uYW1lICAgOiBAbW9kZWwuZ2V0ICduYW1lJ1xuXHRcdFx0ZG9vZGxlX2F1dGhvciA6IGlmIEBtb2RlbC5nZXQoJ2F1dGhvci50d2l0dGVyJykgdGhlbiBcIkAje0Btb2RlbC5nZXQoJ2F1dGhvci50d2l0dGVyJyl9XCIgZWxzZSBAbW9kZWwuZ2V0KCdhdXRob3IubmFtZScpXG5cdFx0XHRzaGFyZV91cmwgICAgIDogQENEX0NFKCkuU0lURV9VUkwgKyAnLycgKyBAbW9kZWwuZ2V0KCdpZCcpXG5cdFx0XHRkb29kbGVfdGFncyAgIDogXy5tYXAoQG1vZGVsLmdldCgndGFncycpLCAodGFnKSAtPiAnIycgKyB0YWcpLmpvaW4oJyAnKVxuXG5cdFx0ZGVzYyA9IEBzdXBwbGFudFN0cmluZyBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdkb29kbGVfc2hhcmVfdGV4dF90bXBsJyksIHZhcnMsIGZhbHNlXG5cblx0XHRkZXNjLnJlcGxhY2UoLyZuYnNwOy9nLCAnICcpXG5cblx0b25JbmZvQ29udGVudENsaWNrIDogKGUpID0+XG5cblx0XHRpZiBlLnRhcmdldCBpcyBAJGluZm9Db250ZW50WzBdIHRoZW4gQENEX0NFKCkuYXBwVmlldy5oZWFkZXIuaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0bnVsbFxuXG5cdG9uUmVmcmVzaEJ0bkNsaWNrIDogPT5cblxuXHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLmluIEAkaW5zdHJ1Y3Rpb25zLCBAY29sb3VyU2NoZW1lXG5cdFx0QGhpZGVEb29kbGUoKVxuXG5cdFx0Y2xlYXJUaW1lb3V0IEByZWZyZXNoVGltZXJcblx0XHRAcmVmcmVzaFRpbWVyID0gc2V0VGltZW91dCA9PlxuXHRcdFx0QHNob3dGcmFtZSBmYWxzZSwgMjAwMFxuXHRcdCwgMTAwMFxuXG5cdFx0bnVsbFxuXG5cdG9uUmFuZG9tQnRuQ2xpY2sgOiA9PlxuXG5cdFx0d2luZG93LmxvY2F0aW9uLnJlbG9hZCgpXG5cblx0XHRudWxsXG5cblx0c2hvd1Nob3dEb29kbGVCdG4gOiA9PlxuXG5cdFx0QCRzaG93RG9vZGxlQnRuLnRleHQgJ3Nob3cgYCcgKyBAbW9kZWwuZ2V0KCdhdXRob3IubmFtZScpICsgJyBcXFxcICcgKyBAbW9kZWwuZ2V0KCduYW1lJykgKyAnYCdcblxuXHRcdEAkc2hvd0Rvb2RsZUJ0blBhbmUuYWRkQ2xhc3MoJ3Nob3cnKVxuXHRcdEBzaG93RG9vZGxlQnRuQ29sb3VyID0gaWYgQG1vZGVsLmdldCgnY29sb3VyX3NjaGVtZScpIGlzICdsaWdodCcgdGhlbiAnYmxhY2snIGVsc2UgJ3doaXRlJ1xuXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIucHJlcGFyZSBAJHNob3dEb29kbGVCdG4sIEBzaG93RG9vZGxlQnRuQ29sb3VyXG5cblx0XHRAJHNob3dEb29kbGVCdG4ub24gJ21vdXNlZW50ZXInLCBAb25TaG93RG9vZGxlQnRuRW50ZXJcblx0XHRAJHNob3dEb29kbGVCdG4ub24gJ21vdXNlbGVhdmUnLCBAb25TaG93RG9vZGxlQnRuTGVhdmVcblx0XHRAJHNob3dEb29kbGVCdG4ub24gJ2NsaWNrJywgQG9uU2hvd0Rvb2RsZUJ0bkNsaWNrXG5cblx0XHRudWxsXG5cblx0b25TaG93RG9vZGxlQnRuRW50ZXIgOiAoZSkgPT5cblxuXHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLnNjcmFtYmxlIEAkc2hvd0Rvb2RsZUJ0biwgQHNob3dEb29kbGVCdG5Db2xvdXJcblxuXHRcdG51bGxcblxuXHRvblNob3dEb29kbGVCdG5MZWF2ZSA6IChlKSA9PlxuXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIudW5zY3JhbWJsZSBAJHNob3dEb29kbGVCdG4sIEBzaG93RG9vZGxlQnRuQ29sb3VyXG5cblx0XHRudWxsXG5cblx0b25TaG93RG9vZGxlQnRuQ2xpY2sgOiA9PlxuXG5cdFx0QCRzaG93RG9vZGxlQnRuLm9mZiAnbW91c2VlbnRlcicsIEBvblNob3dEb29kbGVCdG5FbnRlclxuXHRcdEAkc2hvd0Rvb2RsZUJ0bi5vZmYgJ21vdXNlbGVhdmUnLCBAb25TaG93RG9vZGxlQnRuTGVhdmVcblxuXHRcdGVtcHR5QnRuVGV4dCA9IEAkc2hvd0Rvb2RsZUJ0bi50ZXh0KCkuc3BsaXQoJycpLm1hcCgtPiByZXR1cm4gJyAnKS5qb2luKCcnKVxuXHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLnRvIGVtcHR5QnRuVGV4dCwgQCRzaG93RG9vZGxlQnRuLCBAc2hvd0Rvb2RsZUJ0bkNvbG91ciArICctbm8tYm9yZGVyJ1xuXG5cdFx0QCRzaG93RG9vZGxlQnRuUGFuZS5hZGRDbGFzcygnaGlkZScpXG5cblx0XHRzZXRUaW1lb3V0ID0+XG5cdFx0XHRAc2hvd0ZyYW1lIGZhbHNlXG5cdFx0LCAzMDBcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBEb29kbGVQYWdlVmlld1xuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuXG5jbGFzcyBBYnN0cmFjdE1vZGFsIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cblx0JHdpbmRvdyA6IG51bGxcblxuXHQjIyMgb3ZlcnJpZGUgaW4gaW5kaXZpZHVhbCBjbGFzc2VzICMjI1xuXHRuYW1lICAgICA6IG51bGxcblx0dGVtcGxhdGUgOiBudWxsXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0QCR3aW5kb3cgPSAkKHdpbmRvdylcblxuXHRcdHN1cGVyKClcblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuYWRkQ2hpbGQgQFxuXHRcdEBzZXRMaXN0ZW5lcnMgJ29uJ1xuXHRcdEBhbmltYXRlSW4oKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRoaWRlIDogPT5cblxuXHRcdEBhbmltYXRlT3V0ID0+IEBDRF9DRSgpLmFwcFZpZXcucmVtb3ZlIEBcblxuXHRcdG51bGxcblxuXHRkaXNwb3NlIDogPT5cblxuXHRcdEBzZXRMaXN0ZW5lcnMgJ29mZidcblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm1vZGFsTWFuYWdlci5tb2RhbHNbQG5hbWVdLnZpZXcgPSBudWxsXG5cblx0XHRudWxsXG5cblx0c2V0TGlzdGVuZXJzIDogKHNldHRpbmcpID0+XG5cblx0XHRAJHdpbmRvd1tzZXR0aW5nXSAna2V5dXAnLCBAb25LZXlVcFxuXHRcdEAkKCdbZGF0YS1jbG9zZV0nKVtzZXR0aW5nXSAnY2xpY2snLCBAY2xvc2VDbGlja1xuXG5cdFx0bnVsbFxuXG5cdG9uS2V5VXAgOiAoZSkgPT5cblxuXHRcdGlmIGUua2V5Q29kZSBpcyAyNyB0aGVuIEBoaWRlKClcblxuXHRcdG51bGxcblxuXHRhbmltYXRlSW4gOiA9PlxuXG5cdFx0VHdlZW5MaXRlLnRvIEAkZWwsIDAuMywgeyAndmlzaWJpbGl0eSc6ICd2aXNpYmxlJywgJ29wYWNpdHknOiAxLCBlYXNlIDogUXVhZC5lYXNlT3V0IH1cblx0XHRUd2VlbkxpdGUudG8gQCRlbC5maW5kKCcuaW5uZXInKSwgMC4zLCB7IGRlbGF5IDogMC4xNSwgJ3RyYW5zZm9ybSc6ICdzY2FsZSgxKScsICd2aXNpYmlsaXR5JzogJ3Zpc2libGUnLCAnb3BhY2l0eSc6IDEsIGVhc2UgOiBCYWNrLmVhc2VPdXQgfVxuXG5cdFx0bnVsbFxuXG5cdGFuaW1hdGVPdXQgOiAoY2FsbGJhY2spID0+XG5cblx0XHRUd2VlbkxpdGUudG8gQCRlbCwgMC4zLCB7IGRlbGF5IDogMC4xNSwgJ29wYWNpdHknOiAwLCBlYXNlIDogUXVhZC5lYXNlT3V0LCBvbkNvbXBsZXRlOiBjYWxsYmFjayB9XG5cdFx0VHdlZW5MaXRlLnRvIEAkZWwuZmluZCgnLmlubmVyJyksIDAuMywgeyAndHJhbnNmb3JtJzogJ3NjYWxlKDAuOCknLCAnb3BhY2l0eSc6IDAsIGVhc2UgOiBCYWNrLmVhc2VJbiB9XG5cblx0XHRudWxsXG5cblx0Y2xvc2VDbGljazogKCBlICkgPT5cblxuXHRcdGUucHJldmVudERlZmF1bHQoKVxuXG5cdFx0QGhpZGUoKVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0TW9kYWxcbiIsIkFic3RyYWN0TW9kYWwgPSByZXF1aXJlICcuL0Fic3RyYWN0TW9kYWwnXG5cbmNsYXNzIE9yaWVudGF0aW9uTW9kYWwgZXh0ZW5kcyBBYnN0cmFjdE1vZGFsXG5cblx0bmFtZSAgICAgOiAnb3JpZW50YXRpb25Nb2RhbCdcblx0dGVtcGxhdGUgOiAnb3JpZW50YXRpb24tbW9kYWwnXG5cblx0Y2IgICAgICAgOiBudWxsXG5cblx0Y29uc3RydWN0b3IgOiAoQGNiKSAtPlxuXG5cdFx0QHRlbXBsYXRlVmFycyA9IHtAbmFtZX1cblxuXHRcdHN1cGVyKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRudWxsXG5cblx0aGlkZSA6IChzdGlsbExhbmRzY2FwZT10cnVlKSA9PlxuXG5cdFx0QGFuaW1hdGVPdXQgPT5cblx0XHRcdEBDRF9DRSgpLmFwcFZpZXcucmVtb3ZlIEBcblx0XHRcdGlmICFzdGlsbExhbmRzY2FwZSB0aGVuIEBjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdHNldExpc3RlbmVycyA6IChzZXR0aW5nKSA9PlxuXG5cdFx0c3VwZXJcblxuXHRcdEBDRF9DRSgpLmFwcFZpZXdbc2V0dGluZ10gJ3VwZGF0ZURpbXMnLCBAb25VcGRhdGVEaW1zXG5cdFx0QCRlbFtzZXR0aW5nXSAndG91Y2hlbmQgY2xpY2snLCBAaGlkZVxuXG5cdFx0bnVsbFxuXG5cdG9uVXBkYXRlRGltcyA6IChkaW1zKSA9PlxuXG5cdFx0aWYgZGltcy5vIGlzICdwb3J0cmFpdCcgdGhlbiBAaGlkZSBmYWxzZVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IE9yaWVudGF0aW9uTW9kYWxcbiIsIkFic3RyYWN0VmlldyAgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5PcmllbnRhdGlvbk1vZGFsID0gcmVxdWlyZSAnLi9PcmllbnRhdGlvbk1vZGFsJ1xuXG5jbGFzcyBNb2RhbE1hbmFnZXIgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuXHQjIHdoZW4gbmV3IG1vZGFsIGNsYXNzZXMgYXJlIGNyZWF0ZWQsIGFkZCBoZXJlLCB3aXRoIHJlZmVyZW5jZSB0byBjbGFzcyBuYW1lXG5cdG1vZGFscyA6XG5cdFx0b3JpZW50YXRpb25Nb2RhbCA6IGNsYXNzUmVmIDogT3JpZW50YXRpb25Nb2RhbCwgdmlldyA6IG51bGxcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdGlzT3BlbiA6ID0+XG5cblx0XHQoIGlmIEBtb2RhbHNbbmFtZV0udmlldyB0aGVuIHJldHVybiB0cnVlICkgZm9yIG5hbWUsIG1vZGFsIG9mIEBtb2RhbHNcblxuXHRcdGZhbHNlXG5cblx0aGlkZU9wZW5Nb2RhbCA6ID0+XG5cblx0XHQoIGlmIEBtb2RhbHNbbmFtZV0udmlldyB0aGVuIG9wZW5Nb2RhbCA9IEBtb2RhbHNbbmFtZV0udmlldyApIGZvciBuYW1lLCBtb2RhbCBvZiBAbW9kYWxzXG5cblx0XHRvcGVuTW9kYWw/LmhpZGUoKVxuXG5cdFx0bnVsbFxuXG5cdHNob3dNb2RhbCA6IChuYW1lLCBjYj1udWxsKSA9PlxuXG5cdFx0cmV0dXJuIGlmIEBtb2RhbHNbbmFtZV0udmlld1xuXG5cdFx0QG1vZGFsc1tuYW1lXS52aWV3ID0gbmV3IEBtb2RhbHNbbmFtZV0uY2xhc3NSZWYgY2JcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBNb2RhbE1hbmFnZXJcbiJdfQ==
