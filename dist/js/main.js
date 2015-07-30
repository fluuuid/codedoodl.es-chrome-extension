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



},{"./collections/doodles/DoodlesCollection":10,"./data/API":11,"./data/AbstractData":12,"./utils/Requester":29}],7:[function(require,module,exports){
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



},{"./utils/MediaQueries":27,"./view/AbstractView":31,"./view/base/Footer":33,"./view/base/Header":34,"./view/base/Preloader":35,"./view/base/Wrapper":36,"./view/modals/_ModalManager":40}],8:[function(require,module,exports){
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



},{"../../router/Nav":20,"../AbstractView":31,"../doodlePage/DoodlePageView":37}],37:[function(require,module,exports){
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

  return DoodlePageView;

})(AbstractViewPage);

module.exports = DoodlePageView;



},{"../../utils/CodeWordTransitioner":24,"../../utils/MediaQueries":27,"../AbstractViewPage":32}],38:[function(require,module,exports){
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



},{"../AbstractView":31}],39:[function(require,module,exports){
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



},{"./AbstractModal":38}],40:[function(require,module,exports){
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



},{"../AbstractView":31,"./OrientationModal":39}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL01haW4uY29mZmVlIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3B1bnljb2RlL3B1bnljb2RlLmpzIiwibm9kZV9tb2R1bGVzL2VudC9lbmNvZGUuanMiLCJub2RlX21vZHVsZXMvZW50L3JldmVyc2VkLmpzb24iLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL0FwcC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL0FwcERhdGEuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9BcHBWaWV3LmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvY29sbGVjdGlvbnMvQWJzdHJhY3RDb2xsZWN0aW9uLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvY29sbGVjdGlvbnMvY29yZS9UZW1wbGF0ZXNDb2xsZWN0aW9uLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvY29sbGVjdGlvbnMvZG9vZGxlcy9Eb29kbGVzQ29sbGVjdGlvbi5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL2RhdGEvQVBJLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvZGF0YS9BYnN0cmFjdERhdGEuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9kYXRhL0xvY2FsZS5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL2RhdGEvVGVtcGxhdGVzLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL0Fic3RyYWN0TW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9tb2RlbHMvY29yZS9BUElSb3V0ZU1vZGVsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL2NvcmUvTG9jYWxlc01vZGVsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvbW9kZWxzL2NvcmUvVGVtcGxhdGVNb2RlbC5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL21vZGVscy9kb29kbGUvRG9vZGxlTW9kZWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS9yb3V0ZXIvTmF2LmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvcm91dGVyL1JvdXRlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0FuYWx5dGljcy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0F1dGhNYW5hZ2VyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdXRpbHMvQ29kZVdvcmRUcmFuc2l0aW9uZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9GYWNlYm9vay5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL0dvb2dsZVBsdXMuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9NZWRpYVF1ZXJpZXMuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS91dGlscy9OdW1iZXJVdGlscy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL1JlcXVlc3Rlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3V0aWxzL1NoYXJlLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9BYnN0cmFjdFZpZXcuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L0Fic3RyYWN0Vmlld1BhZ2UuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L2Jhc2UvRm9vdGVyLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9iYXNlL0hlYWRlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvYmFzZS9QcmVsb2FkZXIuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L2Jhc2UvV3JhcHBlci5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvZG9vZGxlUGFnZS9Eb29kbGVQYWdlVmlldy5jb2ZmZWUiLCIvVXNlcnMvbmVpbGNhcnBlbnRlci9TaXRlcy9jb2RlZG9vZGwuZXMtY2hyb21lLWV4dGVuc2lvbi9zcmMvY29mZmVlL3ZpZXcvbW9kYWxzL0Fic3RyYWN0TW9kYWwuY29mZmVlIiwiL1VzZXJzL25laWxjYXJwZW50ZXIvU2l0ZXMvY29kZWRvb2RsLmVzLWNocm9tZS1leHRlbnNpb24vc3JjL2NvZmZlZS92aWV3L21vZGFscy9PcmllbnRhdGlvbk1vZGFsLmNvZmZlZSIsIi9Vc2Vycy9uZWlsY2FycGVudGVyL1NpdGVzL2NvZGVkb29kbC5lcy1jaHJvbWUtZXh0ZW5zaW9uL3NyYy9jb2ZmZWUvdmlldy9tb2RhbHMvX01vZGFsTWFuYWdlci5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSxJQUFBLGtCQUFBOztBQUFBLEdBQUEsR0FBTSxPQUFBLENBQVEsT0FBUixDQUFOLENBQUE7O0FBS0E7QUFBQTs7O0dBTEE7O0FBQUEsT0FXQSxHQUFVLEtBWFYsQ0FBQTs7QUFBQSxJQWNBLEdBQVUsT0FBSCxHQUFnQixFQUFoQixHQUF5QixNQUFBLElBQVUsUUFkMUMsQ0FBQTs7QUFBQSxJQWlCSSxDQUFDLEtBQUwsR0FBaUIsSUFBQSxHQUFBLENBQUksT0FBSixDQWpCakIsQ0FBQTs7QUFBQSxJQWtCSSxDQUFDLEtBQUssQ0FBQyxJQUFYLENBQUEsQ0FsQkEsQ0FBQTs7Ozs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2x5Q0EsSUFBQSx3SEFBQTtFQUFBLGtGQUFBOztBQUFBLFNBQUEsR0FBZSxPQUFBLENBQVEsbUJBQVIsQ0FBZixDQUFBOztBQUFBLFdBQ0EsR0FBZSxPQUFBLENBQVEscUJB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QyxDQUFBLE1BQU8sQ0FBQSxJQUFBLENBQUssQ0FBQyxJQUExQixDQUEzQjtPQUFGO0FBQUEsS0FBQTs7TUFFQSxTQUFTLENBQUUsSUFBWCxDQUFBO0tBRkE7V0FJQSxLQU5lO0VBQUEsQ0FuQmhCLENBQUE7O0FBQUEseUJBMkJBLFNBQUEsR0FBWSxTQUFDLElBQUQsRUFBTyxFQUFQLEdBQUE7O01BQU8sS0FBRztLQUVyQjtBQUFBLElBQUEsSUFBVSxJQUFDLENBQUEsTUFBTyxDQUFBLElBQUEsQ0FBSyxDQUFDLElBQXhCO0FBQUEsWUFBQSxDQUFBO0tBQUE7QUFBQSxJQUVBLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBQSxDQUFLLENBQUMsSUFBZCxHQUF5QixJQUFBLElBQUMsQ0FBQSxNQUFPLENBQUEsSUFBQSxDQUFLLENBQUMsUUFBZCxDQUF1QixFQUF2QixDQUZ6QixDQUFBO1dBSUEsS0FOVztFQUFBLENBM0JaLENBQUE7O3NCQUFBOztHQUgwQixhQUgzQixDQUFBOztBQUFBLE1BeUNNLENBQUMsT0FBUCxHQUFpQixZQXpDakIsQ0FBQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJBcHAgPSByZXF1aXJlICcuL0FwcCdcblxuIyBQUk9EVUNUSU9OIEVOVklST05NRU5UIC0gbWF5IHdhbnQgdG8gdXNlIHNlcnZlci1zZXQgdmFyaWFibGVzIGhlcmVcbiMgSVNfTElWRSA9IGRvIC0+IHJldHVybiBpZiB3aW5kb3cubG9jYXRpb24uaG9zdC5pbmRleE9mKCdsb2NhbGhvc3QnKSA+IC0xIG9yIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2ggaXMgJz9kJyB0aGVuIGZhbHNlIGVsc2UgdHJ1ZVxuXG4jIyNcblxuV0lQIC0gdGhpcyB3aWxsIGlkZWFsbHkgY2hhbmdlIHRvIG9sZCBmb3JtYXQgKGFib3ZlKSB3aGVuIGNhbiBmaWd1cmUgaXQgb3V0XG5cbiMjI1xuXG5JU19MSVZFID0gZmFsc2VcblxuIyBPTkxZIEVYUE9TRSBBUFAgR0xPQkFMTFkgSUYgTE9DQUwgT1IgREVWJ0lOR1xudmlldyA9IGlmIElTX0xJVkUgdGhlbiB7fSBlbHNlICh3aW5kb3cgb3IgZG9jdW1lbnQpXG5cbiMgREVDTEFSRSBNQUlOIEFQUExJQ0FUSU9OXG52aWV3LkNEX0NFID0gbmV3IEFwcCBJU19MSVZFXG52aWV3LkNEX0NFLmluaXQoKVxuIiwiLyohIGh0dHA6Ly9tdGhzLmJlL3B1bnljb2RlIHYxLjIuNCBieSBAbWF0aGlhcyAqL1xuOyhmdW5jdGlvbihyb290KSB7XG5cblx0LyoqIERldGVjdCBmcmVlIHZhcmlhYmxlcyAqL1xuXHR2YXIgZnJlZUV4cG9ydHMgPSB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0JyAmJiBleHBvcnRzO1xuXHR2YXIgZnJlZU1vZHVsZSA9IHR5cGVvZiBtb2R1bGUgPT0gJ29iamVjdCcgJiYgbW9kdWxlICYmXG5cdFx0bW9kdWxlLmV4cG9ydHMgPT0gZnJlZUV4cG9ydHMgJiYgbW9kdWxlO1xuXHR2YXIgZnJlZUdsb2JhbCA9IHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsO1xuXHRpZiAoZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHwgZnJlZUdsb2JhbC53aW5kb3cgPT09IGZyZWVHbG9iYWwpIHtcblx0XHRyb290ID0gZnJlZUdsb2JhbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgYHB1bnljb2RlYCBvYmplY3QuXG5cdCAqIEBuYW1lIHB1bnljb2RlXG5cdCAqIEB0eXBlIE9iamVjdFxuXHQgKi9cblx0dmFyIHB1bnljb2RlLFxuXG5cdC8qKiBIaWdoZXN0IHBvc2l0aXZlIHNpZ25lZCAzMi1iaXQgZmxvYXQgdmFsdWUgKi9cblx0bWF4SW50ID0gMjE0NzQ4MzY0NywgLy8gYWthLiAweDdGRkZGRkZGIG9yIDJeMzEtMVxuXG5cdC8qKiBCb290c3RyaW5nIHBhcmFtZXRlcnMgKi9cblx0YmFzZSA9IDM2LFxuXHR0TWluID0gMSxcblx0dE1heCA9IDI2LFxuXHRza2V3ID0gMzgsXG5cdGRhbXAgPSA3MDAsXG5cdGluaXRpYWxCaWFzID0gNzIsXG5cdGluaXRpYWxOID0gMTI4LCAvLyAweDgwXG5cdGRlbGltaXRlciA9ICctJywgLy8gJ1xceDJEJ1xuXG5cdC8qKiBSZWd1bGFyIGV4cHJlc3Npb25zICovXG5cdHJlZ2V4UHVueWNvZGUgPSAvXnhuLS0vLFxuXHRyZWdleE5vbkFTQ0lJID0gL1teIC1+XS8sIC8vIHVucHJpbnRhYmxlIEFTQ0lJIGNoYXJzICsgbm9uLUFTQ0lJIGNoYXJzXG5cdHJlZ2V4U2VwYXJhdG9ycyA9IC9cXHgyRXxcXHUzMDAyfFxcdUZGMEV8XFx1RkY2MS9nLCAvLyBSRkMgMzQ5MCBzZXBhcmF0b3JzXG5cblx0LyoqIEVycm9yIG1lc3NhZ2VzICovXG5cdGVycm9ycyA9IHtcblx0XHQnb3ZlcmZsb3cnOiAnT3ZlcmZsb3c6IGlucHV0IG5lZWRzIHdpZGVyIGludGVnZXJzIHRvIHByb2Nlc3MnLFxuXHRcdCdub3QtYmFzaWMnOiAnSWxsZWdhbCBpbnB1dCA+PSAweDgwIChub3QgYSBiYXNpYyBjb2RlIHBvaW50KScsXG5cdFx0J2ludmFsaWQtaW5wdXQnOiAnSW52YWxpZCBpbnB1dCdcblx0fSxcblxuXHQvKiogQ29udmVuaWVuY2Ugc2hvcnRjdXRzICovXG5cdGJhc2VNaW51c1RNaW4gPSBiYXNlIC0gdE1pbixcblx0Zmxvb3IgPSBNYXRoLmZsb29yLFxuXHRzdHJpbmdGcm9tQ2hhckNvZGUgPSBTdHJpbmcuZnJvbUNoYXJDb2RlLFxuXG5cdC8qKiBUZW1wb3JhcnkgdmFyaWFibGUgKi9cblx0a2V5O1xuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdC8qKlxuXHQgKiBBIGdlbmVyaWMgZXJyb3IgdXRpbGl0eSBmdW5jdGlvbi5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgVGhlIGVycm9yIHR5cGUuXG5cdCAqIEByZXR1cm5zIHtFcnJvcn0gVGhyb3dzIGEgYFJhbmdlRXJyb3JgIHdpdGggdGhlIGFwcGxpY2FibGUgZXJyb3IgbWVzc2FnZS5cblx0ICovXG5cdGZ1bmN0aW9uIGVycm9yKHR5cGUpIHtcblx0XHR0aHJvdyBSYW5nZUVycm9yKGVycm9yc1t0eXBlXSk7XG5cdH1cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGBBcnJheSNtYXBgIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBpdGVyYXRlIG92ZXIuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0aGF0IGdldHMgY2FsbGVkIGZvciBldmVyeSBhcnJheVxuXHQgKiBpdGVtLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IGFycmF5IG9mIHZhbHVlcyByZXR1cm5lZCBieSB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG5cdCAqL1xuXHRmdW5jdGlvbiBtYXAoYXJyYXksIGZuKSB7XG5cdFx0dmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcblx0XHR3aGlsZSAobGVuZ3RoLS0pIHtcblx0XHRcdGFycmF5W2xlbmd0aF0gPSBmbihhcnJheVtsZW5ndGhdKTtcblx0XHR9XG5cdFx0cmV0dXJuIGFycmF5O1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgc2ltcGxlIGBBcnJheSNtYXBgLWxpa2Ugd3JhcHBlciB0byB3b3JrIHdpdGggZG9tYWluIG5hbWUgc3RyaW5ncy5cblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRvbWFpbiBUaGUgZG9tYWluIG5hbWUuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0aGF0IGdldHMgY2FsbGVkIGZvciBldmVyeVxuXHQgKiBjaGFyYWN0ZXIuXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gQSBuZXcgc3RyaW5nIG9mIGNoYXJhY3RlcnMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrXG5cdCAqIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwRG9tYWluKHN0cmluZywgZm4pIHtcblx0XHRyZXR1cm4gbWFwKHN0cmluZy5zcGxpdChyZWdleFNlcGFyYXRvcnMpLCBmbikuam9pbignLicpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYW4gYXJyYXkgY29udGFpbmluZyB0aGUgbnVtZXJpYyBjb2RlIHBvaW50cyBvZiBlYWNoIFVuaWNvZGVcblx0ICogY2hhcmFjdGVyIGluIHRoZSBzdHJpbmcuIFdoaWxlIEphdmFTY3JpcHQgdXNlcyBVQ1MtMiBpbnRlcm5hbGx5LFxuXHQgKiB0aGlzIGZ1bmN0aW9uIHdpbGwgY29udmVydCBhIHBhaXIgb2Ygc3Vycm9nYXRlIGhhbHZlcyAoZWFjaCBvZiB3aGljaFxuXHQgKiBVQ1MtMiBleHBvc2VzIGFzIHNlcGFyYXRlIGNoYXJhY3RlcnMpIGludG8gYSBzaW5nbGUgY29kZSBwb2ludCxcblx0ICogbWF0Y2hpbmcgVVRGLTE2LlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmVuY29kZWBcblx0ICogQHNlZSA8aHR0cDovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZGVjb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmcgVGhlIFVuaWNvZGUgaW5wdXQgc3RyaW5nIChVQ1MtMikuXG5cdCAqIEByZXR1cm5zIHtBcnJheX0gVGhlIG5ldyBhcnJheSBvZiBjb2RlIHBvaW50cy5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJkZWNvZGUoc3RyaW5nKSB7XG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBjb3VudGVyID0gMCxcblx0XHQgICAgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aCxcblx0XHQgICAgdmFsdWUsXG5cdFx0ICAgIGV4dHJhO1xuXHRcdHdoaWxlIChjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHR2YWx1ZSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRpZiAodmFsdWUgPj0gMHhEODAwICYmIHZhbHVlIDw9IDB4REJGRiAmJiBjb3VudGVyIDwgbGVuZ3RoKSB7XG5cdFx0XHRcdC8vIGhpZ2ggc3Vycm9nYXRlLCBhbmQgdGhlcmUgaXMgYSBuZXh0IGNoYXJhY3RlclxuXHRcdFx0XHRleHRyYSA9IHN0cmluZy5jaGFyQ29kZUF0KGNvdW50ZXIrKyk7XG5cdFx0XHRcdGlmICgoZXh0cmEgJiAweEZDMDApID09IDB4REMwMCkgeyAvLyBsb3cgc3Vycm9nYXRlXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goKCh2YWx1ZSAmIDB4M0ZGKSA8PCAxMCkgKyAoZXh0cmEgJiAweDNGRikgKyAweDEwMDAwKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyB1bm1hdGNoZWQgc3Vycm9nYXRlOyBvbmx5IGFwcGVuZCB0aGlzIGNvZGUgdW5pdCwgaW4gY2FzZSB0aGUgbmV4dFxuXHRcdFx0XHRcdC8vIGNvZGUgdW5pdCBpcyB0aGUgaGlnaCBzdXJyb2dhdGUgb2YgYSBzdXJyb2dhdGUgcGFpclxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdFx0XHRjb3VudGVyLS07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG91dHB1dC5wdXNoKHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc3RyaW5nIGJhc2VkIG9uIGFuIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEBzZWUgYHB1bnljb2RlLnVjczIuZGVjb2RlYFxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBlbmNvZGVcblx0ICogQHBhcmFtIHtBcnJheX0gY29kZVBvaW50cyBUaGUgYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIG5ldyBVbmljb2RlIHN0cmluZyAoVUNTLTIpLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmVuY29kZShhcnJheSkge1xuXHRcdHJldHVybiBtYXAoYXJyYXksIGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHR2YXIgb3V0cHV0ID0gJyc7XG5cdFx0XHRpZiAodmFsdWUgPiAweEZGRkYpIHtcblx0XHRcdFx0dmFsdWUgLT0gMHgxMDAwMDtcblx0XHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMCk7XG5cdFx0XHRcdHZhbHVlID0gMHhEQzAwIHwgdmFsdWUgJiAweDNGRjtcblx0XHRcdH1cblx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUpO1xuXHRcdFx0cmV0dXJuIG91dHB1dDtcblx0XHR9KS5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGJhc2ljIGNvZGUgcG9pbnQgaW50byBhIGRpZ2l0L2ludGVnZXIuXG5cdCAqIEBzZWUgYGRpZ2l0VG9CYXNpYygpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gY29kZVBvaW50IFRoZSBiYXNpYyBudW1lcmljIGNvZGUgcG9pbnQgdmFsdWUuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludCAoZm9yIHVzZSBpblxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGluIHRoZSByYW5nZSBgMGAgdG8gYGJhc2UgLSAxYCwgb3IgYGJhc2VgIGlmXG5cdCAqIHRoZSBjb2RlIHBvaW50IGRvZXMgbm90IHJlcHJlc2VudCBhIHZhbHVlLlxuXHQgKi9cblx0ZnVuY3Rpb24gYmFzaWNUb0RpZ2l0KGNvZGVQb2ludCkge1xuXHRcdGlmIChjb2RlUG9pbnQgLSA0OCA8IDEwKSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gMjI7XG5cdFx0fVxuXHRcdGlmIChjb2RlUG9pbnQgLSA2NSA8IDI2KSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gNjU7XG5cdFx0fVxuXHRcdGlmIChjb2RlUG9pbnQgLSA5NyA8IDI2KSB7XG5cdFx0XHRyZXR1cm4gY29kZVBvaW50IC0gOTc7XG5cdFx0fVxuXHRcdHJldHVybiBiYXNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgZGlnaXQvaW50ZWdlciBpbnRvIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHNlZSBgYmFzaWNUb0RpZ2l0KClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBkaWdpdCBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IFRoZSBiYXNpYyBjb2RlIHBvaW50IHdob3NlIHZhbHVlICh3aGVuIHVzZWQgZm9yXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaXMgYGRpZ2l0YCwgd2hpY2ggbmVlZHMgdG8gYmUgaW4gdGhlIHJhbmdlXG5cdCAqIGAwYCB0byBgYmFzZSAtIDFgLiBJZiBgZmxhZ2AgaXMgbm9uLXplcm8sIHRoZSB1cHBlcmNhc2UgZm9ybSBpc1xuXHQgKiB1c2VkOyBlbHNlLCB0aGUgbG93ZXJjYXNlIGZvcm0gaXMgdXNlZC4gVGhlIGJlaGF2aW9yIGlzIHVuZGVmaW5lZFxuXHQgKiBpZiBgZmxhZ2AgaXMgbm9uLXplcm8gYW5kIGBkaWdpdGAgaGFzIG5vIHVwcGVyY2FzZSBmb3JtLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGlnaXRUb0Jhc2ljKGRpZ2l0LCBmbGFnKSB7XG5cdFx0Ly8gIDAuLjI1IG1hcCB0byBBU0NJSSBhLi56IG9yIEEuLlpcblx0XHQvLyAyNi4uMzUgbWFwIHRvIEFTQ0lJIDAuLjlcblx0XHRyZXR1cm4gZGlnaXQgKyAyMiArIDc1ICogKGRpZ2l0IDwgMjYpIC0gKChmbGFnICE9IDApIDw8IDUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEJpYXMgYWRhcHRhdGlvbiBmdW5jdGlvbiBhcyBwZXIgc2VjdGlvbiAzLjQgb2YgUkZDIDM0OTIuXG5cdCAqIGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM0OTIjc2VjdGlvbi0zLjRcblx0ICogQHByaXZhdGVcblx0ICovXG5cdGZ1bmN0aW9uIGFkYXB0KGRlbHRhLCBudW1Qb2ludHMsIGZpcnN0VGltZSkge1xuXHRcdHZhciBrID0gMDtcblx0XHRkZWx0YSA9IGZpcnN0VGltZSA/IGZsb29yKGRlbHRhIC8gZGFtcCkgOiBkZWx0YSA+PiAxO1xuXHRcdGRlbHRhICs9IGZsb29yKGRlbHRhIC8gbnVtUG9pbnRzKTtcblx0XHRmb3IgKC8qIG5vIGluaXRpYWxpemF0aW9uICovOyBkZWx0YSA+IGJhc2VNaW51c1RNaW4gKiB0TWF4ID4+IDE7IGsgKz0gYmFzZSkge1xuXHRcdFx0ZGVsdGEgPSBmbG9vcihkZWx0YSAvIGJhc2VNaW51c1RNaW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gZmxvb3IoayArIChiYXNlTWludXNUTWluICsgMSkgKiBkZWx0YSAvIChkZWx0YSArIHNrZXcpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMgdG8gYSBzdHJpbmcgb2YgVW5pY29kZVxuXHQgKiBzeW1ib2xzLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzdWx0aW5nIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBkZWNvZGUoaW5wdXQpIHtcblx0XHQvLyBEb24ndCB1c2UgVUNTLTJcblx0XHR2YXIgb3V0cHV0ID0gW10sXG5cdFx0ICAgIGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoLFxuXHRcdCAgICBvdXQsXG5cdFx0ICAgIGkgPSAwLFxuXHRcdCAgICBuID0gaW5pdGlhbE4sXG5cdFx0ICAgIGJpYXMgPSBpbml0aWFsQmlhcyxcblx0XHQgICAgYmFzaWMsXG5cdFx0ICAgIGosXG5cdFx0ICAgIGluZGV4LFxuXHRcdCAgICBvbGRpLFxuXHRcdCAgICB3LFxuXHRcdCAgICBrLFxuXHRcdCAgICBkaWdpdCxcblx0XHQgICAgdCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGJhc2VNaW51c1Q7XG5cblx0XHQvLyBIYW5kbGUgdGhlIGJhc2ljIGNvZGUgcG9pbnRzOiBsZXQgYGJhc2ljYCBiZSB0aGUgbnVtYmVyIG9mIGlucHV0IGNvZGVcblx0XHQvLyBwb2ludHMgYmVmb3JlIHRoZSBsYXN0IGRlbGltaXRlciwgb3IgYDBgIGlmIHRoZXJlIGlzIG5vbmUsIHRoZW4gY29weVxuXHRcdC8vIHRoZSBmaXJzdCBiYXNpYyBjb2RlIHBvaW50cyB0byB0aGUgb3V0cHV0LlxuXG5cdFx0YmFzaWMgPSBpbnB1dC5sYXN0SW5kZXhPZihkZWxpbWl0ZXIpO1xuXHRcdGlmIChiYXNpYyA8IDApIHtcblx0XHRcdGJhc2ljID0gMDtcblx0XHR9XG5cblx0XHRmb3IgKGogPSAwOyBqIDwgYmFzaWM7ICsraikge1xuXHRcdFx0Ly8gaWYgaXQncyBub3QgYSBiYXNpYyBjb2RlIHBvaW50XG5cdFx0XHRpZiAoaW5wdXQuY2hhckNvZGVBdChqKSA+PSAweDgwKSB7XG5cdFx0XHRcdGVycm9yKCdub3QtYmFzaWMnKTtcblx0XHRcdH1cblx0XHRcdG91dHB1dC5wdXNoKGlucHV0LmNoYXJDb2RlQXQoaikpO1xuXHRcdH1cblxuXHRcdC8vIE1haW4gZGVjb2RpbmcgbG9vcDogc3RhcnQganVzdCBhZnRlciB0aGUgbGFzdCBkZWxpbWl0ZXIgaWYgYW55IGJhc2ljIGNvZGVcblx0XHQvLyBwb2ludHMgd2VyZSBjb3BpZWQ7IHN0YXJ0IGF0IHRoZSBiZWdpbm5pbmcgb3RoZXJ3aXNlLlxuXG5cdFx0Zm9yIChpbmRleCA9IGJhc2ljID4gMCA/IGJhc2ljICsgMSA6IDA7IGluZGV4IDwgaW5wdXRMZW5ndGg7IC8qIG5vIGZpbmFsIGV4cHJlc3Npb24gKi8pIHtcblxuXHRcdFx0Ly8gYGluZGV4YCBpcyB0aGUgaW5kZXggb2YgdGhlIG5leHQgY2hhcmFjdGVyIHRvIGJlIGNvbnN1bWVkLlxuXHRcdFx0Ly8gRGVjb2RlIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXIgaW50byBgZGVsdGFgLFxuXHRcdFx0Ly8gd2hpY2ggZ2V0cyBhZGRlZCB0byBgaWAuIFRoZSBvdmVyZmxvdyBjaGVja2luZyBpcyBlYXNpZXJcblx0XHRcdC8vIGlmIHdlIGluY3JlYXNlIGBpYCBhcyB3ZSBnbywgdGhlbiBzdWJ0cmFjdCBvZmYgaXRzIHN0YXJ0aW5nXG5cdFx0XHQvLyB2YWx1ZSBhdCB0aGUgZW5kIHRvIG9idGFpbiBgZGVsdGFgLlxuXHRcdFx0Zm9yIChvbGRpID0gaSwgdyA9IDEsIGsgPSBiYXNlOyAvKiBubyBjb25kaXRpb24gKi87IGsgKz0gYmFzZSkge1xuXG5cdFx0XHRcdGlmIChpbmRleCA+PSBpbnB1dExlbmd0aCkge1xuXHRcdFx0XHRcdGVycm9yKCdpbnZhbGlkLWlucHV0Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRkaWdpdCA9IGJhc2ljVG9EaWdpdChpbnB1dC5jaGFyQ29kZUF0KGluZGV4KyspKTtcblxuXHRcdFx0XHRpZiAoZGlnaXQgPj0gYmFzZSB8fCBkaWdpdCA+IGZsb29yKChtYXhJbnQgLSBpKSAvIHcpKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpICs9IGRpZ2l0ICogdztcblx0XHRcdFx0dCA9IGsgPD0gYmlhcyA/IHRNaW4gOiAoayA+PSBiaWFzICsgdE1heCA/IHRNYXggOiBrIC0gYmlhcyk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0IDwgdCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRpZiAodyA+IGZsb29yKG1heEludCAvIGJhc2VNaW51c1QpKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR3ICo9IGJhc2VNaW51c1Q7XG5cblx0XHRcdH1cblxuXHRcdFx0b3V0ID0gb3V0cHV0Lmxlbmd0aCArIDE7XG5cdFx0XHRiaWFzID0gYWRhcHQoaSAtIG9sZGksIG91dCwgb2xkaSA9PSAwKTtcblxuXHRcdFx0Ly8gYGlgIHdhcyBzdXBwb3NlZCB0byB3cmFwIGFyb3VuZCBmcm9tIGBvdXRgIHRvIGAwYCxcblx0XHRcdC8vIGluY3JlbWVudGluZyBgbmAgZWFjaCB0aW1lLCBzbyB3ZSdsbCBmaXggdGhhdCBub3c6XG5cdFx0XHRpZiAoZmxvb3IoaSAvIG91dCkgPiBtYXhJbnQgLSBuKSB7XG5cdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0fVxuXG5cdFx0XHRuICs9IGZsb29yKGkgLyBvdXQpO1xuXHRcdFx0aSAlPSBvdXQ7XG5cblx0XHRcdC8vIEluc2VydCBgbmAgYXQgcG9zaXRpb24gYGlgIG9mIHRoZSBvdXRwdXRcblx0XHRcdG91dHB1dC5zcGxpY2UoaSsrLCAwLCBuKTtcblxuXHRcdH1cblxuXHRcdHJldHVybiB1Y3MyZW5jb2RlKG91dHB1dCk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzIHRvIGEgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHlcblx0ICogc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZW5jb2RlKGlucHV0KSB7XG5cdFx0dmFyIG4sXG5cdFx0ICAgIGRlbHRhLFxuXHRcdCAgICBoYW5kbGVkQ1BDb3VudCxcblx0XHQgICAgYmFzaWNMZW5ndGgsXG5cdFx0ICAgIGJpYXMsXG5cdFx0ICAgIGosXG5cdFx0ICAgIG0sXG5cdFx0ICAgIHEsXG5cdFx0ICAgIGssXG5cdFx0ICAgIHQsXG5cdFx0ICAgIGN1cnJlbnRWYWx1ZSxcblx0XHQgICAgb3V0cHV0ID0gW10sXG5cdFx0ICAgIC8qKiBgaW5wdXRMZW5ndGhgIHdpbGwgaG9sZCB0aGUgbnVtYmVyIG9mIGNvZGUgcG9pbnRzIGluIGBpbnB1dGAuICovXG5cdFx0ICAgIGlucHV0TGVuZ3RoLFxuXHRcdCAgICAvKiogQ2FjaGVkIGNhbGN1bGF0aW9uIHJlc3VsdHMgKi9cblx0XHQgICAgaGFuZGxlZENQQ291bnRQbHVzT25lLFxuXHRcdCAgICBiYXNlTWludXNULFxuXHRcdCAgICBxTWludXNUO1xuXG5cdFx0Ly8gQ29udmVydCB0aGUgaW5wdXQgaW4gVUNTLTIgdG8gVW5pY29kZVxuXHRcdGlucHV0ID0gdWNzMmRlY29kZShpbnB1dCk7XG5cblx0XHQvLyBDYWNoZSB0aGUgbGVuZ3RoXG5cdFx0aW5wdXRMZW5ndGggPSBpbnB1dC5sZW5ndGg7XG5cblx0XHQvLyBJbml0aWFsaXplIHRoZSBzdGF0ZVxuXHRcdG4gPSBpbml0aWFsTjtcblx0XHRkZWx0YSA9IDA7XG5cdFx0YmlhcyA9IGluaXRpYWxCaWFzO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50c1xuXHRcdGZvciAoaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdGlmIChjdXJyZW50VmFsdWUgPCAweDgwKSB7XG5cdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShjdXJyZW50VmFsdWUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRoYW5kbGVkQ1BDb3VudCA9IGJhc2ljTGVuZ3RoID0gb3V0cHV0Lmxlbmd0aDtcblxuXHRcdC8vIGBoYW5kbGVkQ1BDb3VudGAgaXMgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyB0aGF0IGhhdmUgYmVlbiBoYW5kbGVkO1xuXHRcdC8vIGBiYXNpY0xlbmd0aGAgaXMgdGhlIG51bWJlciBvZiBiYXNpYyBjb2RlIHBvaW50cy5cblxuXHRcdC8vIEZpbmlzaCB0aGUgYmFzaWMgc3RyaW5nIC0gaWYgaXQgaXMgbm90IGVtcHR5IC0gd2l0aCBhIGRlbGltaXRlclxuXHRcdGlmIChiYXNpY0xlbmd0aCkge1xuXHRcdFx0b3V0cHV0LnB1c2goZGVsaW1pdGVyKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGVuY29kaW5nIGxvb3A6XG5cdFx0d2hpbGUgKGhhbmRsZWRDUENvdW50IDwgaW5wdXRMZW5ndGgpIHtcblxuXHRcdFx0Ly8gQWxsIG5vbi1iYXNpYyBjb2RlIHBvaW50cyA8IG4gaGF2ZSBiZWVuIGhhbmRsZWQgYWxyZWFkeS4gRmluZCB0aGUgbmV4dFxuXHRcdFx0Ly8gbGFyZ2VyIG9uZTpcblx0XHRcdGZvciAobSA9IG1heEludCwgaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID49IG4gJiYgY3VycmVudFZhbHVlIDwgbSkge1xuXHRcdFx0XHRcdG0gPSBjdXJyZW50VmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSW5jcmVhc2UgYGRlbHRhYCBlbm91Z2ggdG8gYWR2YW5jZSB0aGUgZGVjb2RlcidzIDxuLGk+IHN0YXRlIHRvIDxtLDA+LFxuXHRcdFx0Ly8gYnV0IGd1YXJkIGFnYWluc3Qgb3ZlcmZsb3dcblx0XHRcdGhhbmRsZWRDUENvdW50UGx1c09uZSA9IGhhbmRsZWRDUENvdW50ICsgMTtcblx0XHRcdGlmIChtIC0gbiA+IGZsb29yKChtYXhJbnQgLSBkZWx0YSkgLyBoYW5kbGVkQ1BDb3VudFBsdXNPbmUpKSB7XG5cdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0fVxuXG5cdFx0XHRkZWx0YSArPSAobSAtIG4pICogaGFuZGxlZENQQ291bnRQbHVzT25lO1xuXHRcdFx0biA9IG07XG5cblx0XHRcdGZvciAoaiA9IDA7IGogPCBpbnB1dExlbmd0aDsgKytqKSB7XG5cdFx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPCBuICYmICsrZGVsdGEgPiBtYXhJbnQpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPT0gbikge1xuXHRcdFx0XHRcdC8vIFJlcHJlc2VudCBkZWx0YSBhcyBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyXG5cdFx0XHRcdFx0Zm9yIChxID0gZGVsdGEsIGsgPSBiYXNlOyAvKiBubyBjb25kaXRpb24gKi87IGsgKz0gYmFzZSkge1xuXHRcdFx0XHRcdFx0dCA9IGsgPD0gYmlhcyA/IHRNaW4gOiAoayA+PSBiaWFzICsgdE1heCA/IHRNYXggOiBrIC0gYmlhcyk7XG5cdFx0XHRcdFx0XHRpZiAocSA8IHQpIHtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRxTWludXNUID0gcSAtIHQ7XG5cdFx0XHRcdFx0XHRiYXNlTWludXNUID0gYmFzZSAtIHQ7XG5cdFx0XHRcdFx0XHRvdXRwdXQucHVzaChcblx0XHRcdFx0XHRcdFx0c3RyaW5nRnJvbUNoYXJDb2RlKGRpZ2l0VG9CYXNpYyh0ICsgcU1pbnVzVCAlIGJhc2VNaW51c1QsIDApKVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdHEgPSBmbG9vcihxTWludXNUIC8gYmFzZU1pbnVzVCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2goc3RyaW5nRnJvbUNoYXJDb2RlKGRpZ2l0VG9CYXNpYyhxLCAwKSkpO1xuXHRcdFx0XHRcdGJpYXMgPSBhZGFwdChkZWx0YSwgaGFuZGxlZENQQ291bnRQbHVzT25lLCBoYW5kbGVkQ1BDb3VudCA9PSBiYXNpY0xlbmd0aCk7XG5cdFx0XHRcdFx0ZGVsdGEgPSAwO1xuXHRcdFx0XHRcdCsraGFuZGxlZENQQ291bnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0KytkZWx0YTtcblx0XHRcdCsrbjtcblxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0LmpvaW4oJycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIHJlcHJlc2VudGluZyBhIGRvbWFpbiBuYW1lIHRvIFVuaWNvZGUuIE9ubHkgdGhlXG5cdCAqIFB1bnljb2RlZCBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgd2lsbCBiZSBjb252ZXJ0ZWQsIGkuZS4gaXQgZG9lc24ndFxuXHQgKiBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgb24gYSBzdHJpbmcgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIGNvbnZlcnRlZCB0b1xuXHQgKiBVbmljb2RlLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRvbWFpbiBUaGUgUHVueWNvZGUgZG9tYWluIG5hbWUgdG8gY29udmVydCB0byBVbmljb2RlLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgVW5pY29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gUHVueWNvZGVcblx0ICogc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9Vbmljb2RlKGRvbWFpbikge1xuXHRcdHJldHVybiBtYXBEb21haW4oZG9tYWluLCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleFB1bnljb2RlLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/IGRlY29kZShzdHJpbmcuc2xpY2UoNCkudG9Mb3dlckNhc2UoKSlcblx0XHRcdFx0OiBzdHJpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBVbmljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSB0byBQdW55Y29kZS4gT25seSB0aGVcblx0ICogbm9uLUFTQ0lJIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB3aWxsIGJlIGNvbnZlcnRlZCwgaS5lLiBpdCBkb2Vzbid0XG5cdCAqIG1hdHRlciBpZiB5b3UgY2FsbCBpdCB3aXRoIGEgZG9tYWluIHRoYXQncyBhbHJlYWR5IGluIEFTQ0lJLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGRvbWFpbiBUaGUgZG9tYWluIG5hbWUgdG8gY29udmVydCwgYXMgYSBVbmljb2RlIHN0cmluZy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFB1bnljb2RlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBnaXZlbiBkb21haW4gbmFtZS5cblx0ICovXG5cdGZ1bmN0aW9uIHRvQVNDSUkoZG9tYWluKSB7XG5cdFx0cmV0dXJuIG1hcERvbWFpbihkb21haW4sIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0cmV0dXJuIHJlZ2V4Tm9uQVNDSUkudGVzdChzdHJpbmcpXG5cdFx0XHRcdD8gJ3huLS0nICsgZW5jb2RlKHN0cmluZylcblx0XHRcdFx0OiBzdHJpbmc7XG5cdFx0fSk7XG5cdH1cblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKiogRGVmaW5lIHRoZSBwdWJsaWMgQVBJICovXG5cdHB1bnljb2RlID0ge1xuXHRcdC8qKlxuXHRcdCAqIEEgc3RyaW5nIHJlcHJlc2VudGluZyB0aGUgY3VycmVudCBQdW55Y29kZS5qcyB2ZXJzaW9uIG51bWJlci5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBTdHJpbmdcblx0XHQgKi9cblx0XHQndmVyc2lvbic6ICcxLjIuNCcsXG5cdFx0LyoqXG5cdFx0ICogQW4gb2JqZWN0IG9mIG1ldGhvZHMgdG8gY29udmVydCBmcm9tIEphdmFTY3JpcHQncyBpbnRlcm5hbCBjaGFyYWN0ZXJcblx0XHQgKiByZXByZXNlbnRhdGlvbiAoVUNTLTIpIHRvIFVuaWNvZGUgY29kZSBwb2ludHMsIGFuZCBiYWNrLlxuXHRcdCAqIEBzZWUgPGh0dHA6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgT2JqZWN0XG5cdFx0ICovXG5cdFx0J3VjczInOiB7XG5cdFx0XHQnZGVjb2RlJzogdWNzMmRlY29kZSxcblx0XHRcdCdlbmNvZGUnOiB1Y3MyZW5jb2RlXG5cdFx0fSxcblx0XHQnZGVjb2RlJzogZGVjb2RlLFxuXHRcdCdlbmNvZGUnOiBlbmNvZGUsXG5cdFx0J3RvQVNDSUknOiB0b0FTQ0lJLFxuXHRcdCd0b1VuaWNvZGUnOiB0b1VuaWNvZGVcblx0fTtcblxuXHQvKiogRXhwb3NlIGBwdW55Y29kZWAgKi9cblx0Ly8gU29tZSBBTUQgYnVpbGQgb3B0aW1pemVycywgbGlrZSByLmpzLCBjaGVjayBmb3Igc3BlY2lmaWMgY29uZGl0aW9uIHBhdHRlcm5zXG5cdC8vIGxpa2UgdGhlIGZvbGxvd2luZzpcblx0aWYgKFxuXHRcdHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJlxuXHRcdHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmXG5cdFx0ZGVmaW5lLmFtZFxuXHQpIHtcblx0XHRkZWZpbmUoJ3B1bnljb2RlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gcHVueWNvZGU7XG5cdFx0fSk7XG5cdH0gZWxzZSBpZiAoZnJlZUV4cG9ydHMgJiYgIWZyZWVFeHBvcnRzLm5vZGVUeXBlKSB7XG5cdFx0aWYgKGZyZWVNb2R1bGUpIHsgLy8gaW4gTm9kZS5qcyBvciBSaW5nb0pTIHYwLjguMCtcblx0XHRcdGZyZWVNb2R1bGUuZXhwb3J0cyA9IHB1bnljb2RlO1xuXHRcdH0gZWxzZSB7IC8vIGluIE5hcndoYWwgb3IgUmluZ29KUyB2MC43LjAtXG5cdFx0XHRmb3IgKGtleSBpbiBwdW55Y29kZSkge1xuXHRcdFx0XHRwdW55Y29kZS5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIChmcmVlRXhwb3J0c1trZXldID0gcHVueWNvZGVba2V5XSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2UgeyAvLyBpbiBSaGlubyBvciBhIHdlYiBicm93c2VyXG5cdFx0cm9vdC5wdW55Y29kZSA9IHB1bnljb2RlO1xuXHR9XG5cbn0odGhpcykpO1xuIiwidmFyIHB1bnljb2RlID0gcmVxdWlyZSgncHVueWNvZGUnKTtcbnZhciByZXZFbnRpdGllcyA9IHJlcXVpcmUoJy4vcmV2ZXJzZWQuanNvbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGVuY29kZTtcblxuZnVuY3Rpb24gZW5jb2RlIChzdHIsIG9wdHMpIHtcbiAgICBpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgYSBTdHJpbmcnKTtcbiAgICB9XG4gICAgaWYgKCFvcHRzKSBvcHRzID0ge307XG5cbiAgICB2YXIgbnVtZXJpYyA9IHRydWU7XG4gICAgaWYgKG9wdHMubmFtZWQpIG51bWVyaWMgPSBmYWxzZTtcbiAgICBpZiAob3B0cy5udW1lcmljICE9PSB1bmRlZmluZWQpIG51bWVyaWMgPSBvcHRzLm51bWVyaWM7XG5cbiAgICB2YXIgc3BlY2lhbCA9IG9wdHMuc3BlY2lhbCB8fCB7XG4gICAgICAgICdcIic6IHRydWUsIFwiJ1wiOiB0cnVlLFxuICAgICAgICAnPCc6IHRydWUsICc+JzogdHJ1ZSxcbiAgICAgICAgJyYnOiB0cnVlXG4gICAgfTtcblxuICAgIHZhciBjb2RlUG9pbnRzID0gcHVueWNvZGUudWNzMi5kZWNvZGUoc3RyKTtcbiAgICB2YXIgY2hhcnMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvZGVQb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNjID0gY29kZVBvaW50c1tpXTtcbiAgICAgICAgdmFyIGMgPSBwdW55Y29kZS51Y3MyLmVuY29kZShbIGNjIF0pO1xuICAgICAgICB2YXIgZSA9IHJldkVudGl0aWVzW2NjXTtcbiAgICAgICAgaWYgKGUgJiYgKGNjID49IDEyNyB8fCBzcGVjaWFsW2NdKSAmJiAhbnVtZXJpYykge1xuICAgICAgICAgICAgY2hhcnMucHVzaCgnJicgKyAoLzskLy50ZXN0KGUpID8gZSA6IGUgKyAnOycpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjYyA8IDMyIHx8IGNjID49IDEyNyB8fCBzcGVjaWFsW2NdKSB7XG4gICAgICAgICAgICBjaGFycy5wdXNoKCcmIycgKyBjYyArICc7Jyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjaGFycy5wdXNoKGMpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBjaGFycy5qb2luKCcnKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzPXtcbiAgICBcIjlcIjogXCJUYWI7XCIsXG4gICAgXCIxMFwiOiBcIk5ld0xpbmU7XCIsXG4gICAgXCIzM1wiOiBcImV4Y2w7XCIsXG4gICAgXCIzNFwiOiBcInF1b3Q7XCIsXG4gICAgXCIzNVwiOiBcIm51bTtcIixcbiAgICBcIjM2XCI6IFwiZG9sbGFyO1wiLFxuICAgIFwiMzdcIjogXCJwZXJjbnQ7XCIsXG4gICAgXCIzOFwiOiBcImFtcDtcIixcbiAgICBcIjM5XCI6IFwiYXBvcztcIixcbiAgICBcIjQwXCI6IFwibHBhcjtcIixcbiAgICBcIjQxXCI6IFwicnBhcjtcIixcbiAgICBcIjQyXCI6IFwibWlkYXN0O1wiLFxuICAgIFwiNDNcIjogXCJwbHVzO1wiLFxuICAgIFwiNDRcIjogXCJjb21tYTtcIixcbiAgICBcIjQ2XCI6IFwicGVyaW9kO1wiLFxuICAgIFwiNDdcIjogXCJzb2w7XCIsXG4gICAgXCI1OFwiOiBcImNvbG9uO1wiLFxuICAgIFwiNTlcIjogXCJzZW1pO1wiLFxuICAgIFwiNjBcIjogXCJsdDtcIixcbiAgICBcIjYxXCI6IFwiZXF1YWxzO1wiLFxuICAgIFwiNjJcIjogXCJndDtcIixcbiAgICBcIjYzXCI6IFwicXVlc3Q7XCIsXG4gICAgXCI2NFwiOiBcImNvbW1hdDtcIixcbiAgICBcIjkxXCI6IFwibHNxYjtcIixcbiAgICBcIjkyXCI6IFwiYnNvbDtcIixcbiAgICBcIjkzXCI6IFwicnNxYjtcIixcbiAgICBcIjk0XCI6IFwiSGF0O1wiLFxuICAgIFwiOTVcIjogXCJVbmRlckJhcjtcIixcbiAgICBcIjk2XCI6IFwiZ3JhdmU7XCIsXG4gICAgXCIxMjNcIjogXCJsY3ViO1wiLFxuICAgIFwiMTI0XCI6IFwiVmVydGljYWxMaW5lO1wiLFxuICAgIFwiMTI1XCI6IFwicmN1YjtcIixcbiAgICBcIjE2MFwiOiBcIk5vbkJyZWFraW5nU3BhY2U7XCIsXG4gICAgXCIxNjFcIjogXCJpZXhjbDtcIixcbiAgICBcIjE2MlwiOiBcImNlbnQ7XCIsXG4gICAgXCIxNjNcIjogXCJwb3VuZDtcIixcbiAgICBcIjE2NFwiOiBcImN1cnJlbjtcIixcbiAgICBcIjE2NVwiOiBcInllbjtcIixcbiAgICBcIjE2NlwiOiBcImJydmJhcjtcIixcbiAgICBcIjE2N1wiOiBcInNlY3Q7XCIsXG4gICAgXCIxNjhcIjogXCJ1bWw7XCIsXG4gICAgXCIxNjlcIjogXCJjb3B5O1wiLFxuICAgIFwiMTcwXCI6IFwib3JkZjtcIixcbiAgICBcIjE3MVwiOiBcImxhcXVvO1wiLFxuICAgIFwiMTcyXCI6IFwibm90O1wiLFxuICAgIFwiMTczXCI6IFwic2h5O1wiLFxuICAgIFwiMTc0XCI6IFwicmVnO1wiLFxuICAgIFwiMTc1XCI6IFwic3RybnM7XCIsXG4gICAgXCIxNzZcIjogXCJkZWc7XCIsXG4gICAgXCIxNzdcIjogXCJwbTtcIixcbiAgICBcIjE3OFwiOiBcInN1cDI7XCIsXG4gICAgXCIxNzlcIjogXCJzdXAzO1wiLFxuICAgIFwiMTgwXCI6IFwiRGlhY3JpdGljYWxBY3V0ZTtcIixcbiAgICBcIjE4MVwiOiBcIm1pY3JvO1wiLFxuICAgIFwiMTgyXCI6IFwicGFyYTtcIixcbiAgICBcIjE4M1wiOiBcIm1pZGRvdDtcIixcbiAgICBcIjE4NFwiOiBcIkNlZGlsbGE7XCIsXG4gICAgXCIxODVcIjogXCJzdXAxO1wiLFxuICAgIFwiMTg2XCI6IFwib3JkbTtcIixcbiAgICBcIjE4N1wiOiBcInJhcXVvO1wiLFxuICAgIFwiMTg4XCI6IFwiZnJhYzE0O1wiLFxuICAgIFwiMTg5XCI6IFwiaGFsZjtcIixcbiAgICBcIjE5MFwiOiBcImZyYWMzNDtcIixcbiAgICBcIjE5MVwiOiBcImlxdWVzdDtcIixcbiAgICBcIjE5MlwiOiBcIkFncmF2ZTtcIixcbiAgICBcIjE5M1wiOiBcIkFhY3V0ZTtcIixcbiAgICBcIjE5NFwiOiBcIkFjaXJjO1wiLFxuICAgIFwiMTk1XCI6IFwiQXRpbGRlO1wiLFxuICAgIFwiMTk2XCI6IFwiQXVtbDtcIixcbiAgICBcIjE5N1wiOiBcIkFyaW5nO1wiLFxuICAgIFwiMTk4XCI6IFwiQUVsaWc7XCIsXG4gICAgXCIxOTlcIjogXCJDY2VkaWw7XCIsXG4gICAgXCIyMDBcIjogXCJFZ3JhdmU7XCIsXG4gICAgXCIyMDFcIjogXCJFYWN1dGU7XCIsXG4gICAgXCIyMDJcIjogXCJFY2lyYztcIixcbiAgICBcIjIwM1wiOiBcIkV1bWw7XCIsXG4gICAgXCIyMDRcIjogXCJJZ3JhdmU7XCIsXG4gICAgXCIyMDVcIjogXCJJYWN1dGU7XCIsXG4gICAgXCIyMDZcIjogXCJJY2lyYztcIixcbiAgICBcIjIwN1wiOiBcIkl1bWw7XCIsXG4gICAgXCIyMDhcIjogXCJFVEg7XCIsXG4gICAgXCIyMDlcIjogXCJOdGlsZGU7XCIsXG4gICAgXCIyMTBcIjogXCJPZ3JhdmU7XCIsXG4gICAgXCIyMTFcIjogXCJPYWN1dGU7XCIsXG4gICAgXCIyMTJcIjogXCJPY2lyYztcIixcbiAgICBcIjIxM1wiOiBcIk90aWxkZTtcIixcbiAgICBcIjIxNFwiOiBcIk91bWw7XCIsXG4gICAgXCIyMTVcIjogXCJ0aW1lcztcIixcbiAgICBcIjIxNlwiOiBcIk9zbGFzaDtcIixcbiAgICBcIjIxN1wiOiBcIlVncmF2ZTtcIixcbiAgICBcIjIxOFwiOiBcIlVhY3V0ZTtcIixcbiAgICBcIjIxOVwiOiBcIlVjaXJjO1wiLFxuICAgIFwiMjIwXCI6IFwiVXVtbDtcIixcbiAgICBcIjIyMVwiOiBcIllhY3V0ZTtcIixcbiAgICBcIjIyMlwiOiBcIlRIT1JOO1wiLFxuICAgIFwiMjIzXCI6IFwic3psaWc7XCIsXG4gICAgXCIyMjRcIjogXCJhZ3JhdmU7XCIsXG4gICAgXCIyMjVcIjogXCJhYWN1dGU7XCIsXG4gICAgXCIyMjZcIjogXCJhY2lyYztcIixcbiAgICBcIjIyN1wiOiBcImF0aWxkZTtcIixcbiAgICBcIjIyOFwiOiBcImF1bWw7XCIsXG4gICAgXCIyMjlcIjogXCJhcmluZztcIixcbiAgICBcIjIzMFwiOiBcImFlbGlnO1wiLFxuICAgIFwiMjMxXCI6IFwiY2NlZGlsO1wiLFxuICAgIFwiMjMyXCI6IFwiZWdyYXZlO1wiLFxuICAgIFwiMjMzXCI6IFwiZWFjdXRlO1wiLFxuICAgIFwiMjM0XCI6IFwiZWNpcmM7XCIsXG4gICAgXCIyMzVcIjogXCJldW1sO1wiLFxuICAgIFwiMjM2XCI6IFwiaWdyYXZlO1wiLFxuICAgIFwiMjM3XCI6IFwiaWFjdXRlO1wiLFxuICAgIFwiMjM4XCI6IFwiaWNpcmM7XCIsXG4gICAgXCIyMzlcIjogXCJpdW1sO1wiLFxuICAgIFwiMjQwXCI6IFwiZXRoO1wiLFxuICAgIFwiMjQxXCI6IFwibnRpbGRlO1wiLFxuICAgIFwiMjQyXCI6IFwib2dyYXZlO1wiLFxuICAgIFwiMjQzXCI6IFwib2FjdXRlO1wiLFxuICAgIFwiMjQ0XCI6IFwib2NpcmM7XCIsXG4gICAgXCIyNDVcIjogXCJvdGlsZGU7XCIsXG4gICAgXCIyNDZcIjogXCJvdW1sO1wiLFxuICAgIFwiMjQ3XCI6IFwiZGl2aWRlO1wiLFxuICAgIFwiMjQ4XCI6IFwib3NsYXNoO1wiLFxuICAgIFwiMjQ5XCI6IFwidWdyYXZlO1wiLFxuICAgIFwiMjUwXCI6IFwidWFjdXRlO1wiLFxuICAgIFwiMjUxXCI6IFwidWNpcmM7XCIsXG4gICAgXCIyNTJcIjogXCJ1dW1sO1wiLFxuICAgIFwiMjUzXCI6IFwieWFjdXRlO1wiLFxuICAgIFwiMjU0XCI6IFwidGhvcm47XCIsXG4gICAgXCIyNTVcIjogXCJ5dW1sO1wiLFxuICAgIFwiMjU2XCI6IFwiQW1hY3I7XCIsXG4gICAgXCIyNTdcIjogXCJhbWFjcjtcIixcbiAgICBcIjI1OFwiOiBcIkFicmV2ZTtcIixcbiAgICBcIjI1OVwiOiBcImFicmV2ZTtcIixcbiAgICBcIjI2MFwiOiBcIkFvZ29uO1wiLFxuICAgIFwiMjYxXCI6IFwiYW9nb247XCIsXG4gICAgXCIyNjJcIjogXCJDYWN1dGU7XCIsXG4gICAgXCIyNjNcIjogXCJjYWN1dGU7XCIsXG4gICAgXCIyNjRcIjogXCJDY2lyYztcIixcbiAgICBcIjI2NVwiOiBcImNjaXJjO1wiLFxuICAgIFwiMjY2XCI6IFwiQ2RvdDtcIixcbiAgICBcIjI2N1wiOiBcImNkb3Q7XCIsXG4gICAgXCIyNjhcIjogXCJDY2Fyb247XCIsXG4gICAgXCIyNjlcIjogXCJjY2Fyb247XCIsXG4gICAgXCIyNzBcIjogXCJEY2Fyb247XCIsXG4gICAgXCIyNzFcIjogXCJkY2Fyb247XCIsXG4gICAgXCIyNzJcIjogXCJEc3Ryb2s7XCIsXG4gICAgXCIyNzNcIjogXCJkc3Ryb2s7XCIsXG4gICAgXCIyNzRcIjogXCJFbWFjcjtcIixcbiAgICBcIjI3NVwiOiBcImVtYWNyO1wiLFxuICAgIFwiMjc4XCI6IFwiRWRvdDtcIixcbiAgICBcIjI3OVwiOiBcImVkb3Q7XCIsXG4gICAgXCIyODBcIjogXCJFb2dvbjtcIixcbiAgICBcIjI4MVwiOiBcImVvZ29uO1wiLFxuICAgIFwiMjgyXCI6IFwiRWNhcm9uO1wiLFxuICAgIFwiMjgzXCI6IFwiZWNhcm9uO1wiLFxuICAgIFwiMjg0XCI6IFwiR2NpcmM7XCIsXG4gICAgXCIyODVcIjogXCJnY2lyYztcIixcbiAgICBcIjI4NlwiOiBcIkdicmV2ZTtcIixcbiAgICBcIjI4N1wiOiBcImdicmV2ZTtcIixcbiAgICBcIjI4OFwiOiBcIkdkb3Q7XCIsXG4gICAgXCIyODlcIjogXCJnZG90O1wiLFxuICAgIFwiMjkwXCI6IFwiR2NlZGlsO1wiLFxuICAgIFwiMjkyXCI6IFwiSGNpcmM7XCIsXG4gICAgXCIyOTNcIjogXCJoY2lyYztcIixcbiAgICBcIjI5NFwiOiBcIkhzdHJvaztcIixcbiAgICBcIjI5NVwiOiBcImhzdHJvaztcIixcbiAgICBcIjI5NlwiOiBcIkl0aWxkZTtcIixcbiAgICBcIjI5N1wiOiBcIml0aWxkZTtcIixcbiAgICBcIjI5OFwiOiBcIkltYWNyO1wiLFxuICAgIFwiMjk5XCI6IFwiaW1hY3I7XCIsXG4gICAgXCIzMDJcIjogXCJJb2dvbjtcIixcbiAgICBcIjMwM1wiOiBcImlvZ29uO1wiLFxuICAgIFwiMzA0XCI6IFwiSWRvdDtcIixcbiAgICBcIjMwNVwiOiBcImlub2RvdDtcIixcbiAgICBcIjMwNlwiOiBcIklKbGlnO1wiLFxuICAgIFwiMzA3XCI6IFwiaWpsaWc7XCIsXG4gICAgXCIzMDhcIjogXCJKY2lyYztcIixcbiAgICBcIjMwOVwiOiBcImpjaXJjO1wiLFxuICAgIFwiMzEwXCI6IFwiS2NlZGlsO1wiLFxuICAgIFwiMzExXCI6IFwia2NlZGlsO1wiLFxuICAgIFwiMzEyXCI6IFwia2dyZWVuO1wiLFxuICAgIFwiMzEzXCI6IFwiTGFjdXRlO1wiLFxuICAgIFwiMzE0XCI6IFwibGFjdXRlO1wiLFxuICAgIFwiMzE1XCI6IFwiTGNlZGlsO1wiLFxuICAgIFwiMzE2XCI6IFwibGNlZGlsO1wiLFxuICAgIFwiMzE3XCI6IFwiTGNhcm9uO1wiLFxuICAgIFwiMzE4XCI6IFwibGNhcm9uO1wiLFxuICAgIFwiMzE5XCI6IFwiTG1pZG90O1wiLFxuICAgIFwiMzIwXCI6IFwibG1pZG90O1wiLFxuICAgIFwiMzIxXCI6IFwiTHN0cm9rO1wiLFxuICAgIFwiMzIyXCI6IFwibHN0cm9rO1wiLFxuICAgIFwiMzIzXCI6IFwiTmFjdXRlO1wiLFxuICAgIFwiMzI0XCI6IFwibmFjdXRlO1wiLFxuICAgIFwiMzI1XCI6IFwiTmNlZGlsO1wiLFxuICAgIFwiMzI2XCI6IFwibmNlZGlsO1wiLFxuICAgIFwiMzI3XCI6IFwiTmNhcm9uO1wiLFxuICAgIFwiMzI4XCI6IFwibmNhcm9uO1wiLFxuICAgIFwiMzI5XCI6IFwibmFwb3M7XCIsXG4gICAgXCIzMzBcIjogXCJFTkc7XCIsXG4gICAgXCIzMzFcIjogXCJlbmc7XCIsXG4gICAgXCIzMzJcIjogXCJPbWFjcjtcIixcbiAgICBcIjMzM1wiOiBcIm9tYWNyO1wiLFxuICAgIFwiMzM2XCI6IFwiT2RibGFjO1wiLFxuICAgIFwiMzM3XCI6IFwib2RibGFjO1wiLFxuICAgIFwiMzM4XCI6IFwiT0VsaWc7XCIsXG4gICAgXCIzMzlcIjogXCJvZWxpZztcIixcbiAgICBcIjM0MFwiOiBcIlJhY3V0ZTtcIixcbiAgICBcIjM0MVwiOiBcInJhY3V0ZTtcIixcbiAgICBcIjM0MlwiOiBcIlJjZWRpbDtcIixcbiAgICBcIjM0M1wiOiBcInJjZWRpbDtcIixcbiAgICBcIjM0NFwiOiBcIlJjYXJvbjtcIixcbiAgICBcIjM0NVwiOiBcInJjYXJvbjtcIixcbiAgICBcIjM0NlwiOiBcIlNhY3V0ZTtcIixcbiAgICBcIjM0N1wiOiBcInNhY3V0ZTtcIixcbiAgICBcIjM0OFwiOiBcIlNjaXJjO1wiLFxuICAgIFwiMzQ5XCI6IFwic2NpcmM7XCIsXG4gICAgXCIzNTBcIjogXCJTY2VkaWw7XCIsXG4gICAgXCIzNTFcIjogXCJzY2VkaWw7XCIsXG4gICAgXCIzNTJcIjogXCJTY2Fyb247XCIsXG4gICAgXCIzNTNcIjogXCJzY2Fyb247XCIsXG4gICAgXCIzNTRcIjogXCJUY2VkaWw7XCIsXG4gICAgXCIzNTVcIjogXCJ0Y2VkaWw7XCIsXG4gICAgXCIzNTZcIjogXCJUY2Fyb247XCIsXG4gICAgXCIzNTdcIjogXCJ0Y2Fyb247XCIsXG4gICAgXCIzNThcIjogXCJUc3Ryb2s7XCIsXG4gICAgXCIzNTlcIjogXCJ0c3Ryb2s7XCIsXG4gICAgXCIzNjBcIjogXCJVdGlsZGU7XCIsXG4gICAgXCIzNjFcIjogXCJ1dGlsZGU7XCIsXG4gICAgXCIzNjJcIjogXCJVbWFjcjtcIixcbiAgICBcIjM2M1wiOiBcInVtYWNyO1wiLFxuICAgIFwiMzY0XCI6IFwiVWJyZXZlO1wiLFxuICAgIFwiMzY1XCI6IFwidWJyZXZlO1wiLFxuICAgIFwiMzY2XCI6IFwiVXJpbmc7XCIsXG4gICAgXCIzNjdcIjogXCJ1cmluZztcIixcbiAgICBcIjM2OFwiOiBcIlVkYmxhYztcIixcbiAgICBcIjM2OVwiOiBcInVkYmxhYztcIixcbiAgICBcIjM3MFwiOiBcIlVvZ29uO1wiLFxuICAgIFwiMzcxXCI6IFwidW9nb247XCIsXG4gICAgXCIzNzJcIjogXCJXY2lyYztcIixcbiAgICBcIjM3M1wiOiBcIndjaXJjO1wiLFxuICAgIFwiMzc0XCI6IFwiWWNpcmM7XCIsXG4gICAgXCIzNzVcIjogXCJ5Y2lyYztcIixcbiAgICBcIjM3NlwiOiBcIll1bWw7XCIsXG4gICAgXCIzNzdcIjogXCJaYWN1dGU7XCIsXG4gICAgXCIzNzhcIjogXCJ6YWN1dGU7XCIsXG4gICAgXCIzNzlcIjogXCJaZG90O1wiLFxuICAgIFwiMzgwXCI6IFwiemRvdDtcIixcbiAgICBcIjM4MVwiOiBcIlpjYXJvbjtcIixcbiAgICBcIjM4MlwiOiBcInpjYXJvbjtcIixcbiAgICBcIjQwMlwiOiBcImZub2Y7XCIsXG4gICAgXCI0MzdcIjogXCJpbXBlZDtcIixcbiAgICBcIjUwMVwiOiBcImdhY3V0ZTtcIixcbiAgICBcIjU2N1wiOiBcImptYXRoO1wiLFxuICAgIFwiNzEwXCI6IFwiY2lyYztcIixcbiAgICBcIjcxMVwiOiBcIkhhY2VrO1wiLFxuICAgIFwiNzI4XCI6IFwiYnJldmU7XCIsXG4gICAgXCI3MjlcIjogXCJkb3Q7XCIsXG4gICAgXCI3MzBcIjogXCJyaW5nO1wiLFxuICAgIFwiNzMxXCI6IFwib2dvbjtcIixcbiAgICBcIjczMlwiOiBcInRpbGRlO1wiLFxuICAgIFwiNzMzXCI6IFwiRGlhY3JpdGljYWxEb3VibGVBY3V0ZTtcIixcbiAgICBcIjc4NVwiOiBcIkRvd25CcmV2ZTtcIixcbiAgICBcIjkxM1wiOiBcIkFscGhhO1wiLFxuICAgIFwiOTE0XCI6IFwiQmV0YTtcIixcbiAgICBcIjkxNVwiOiBcIkdhbW1hO1wiLFxuICAgIFwiOTE2XCI6IFwiRGVsdGE7XCIsXG4gICAgXCI5MTdcIjogXCJFcHNpbG9uO1wiLFxuICAgIFwiOTE4XCI6IFwiWmV0YTtcIixcbiAgICBcIjkxOVwiOiBcIkV0YTtcIixcbiAgICBcIjkyMFwiOiBcIlRoZXRhO1wiLFxuICAgIFwiOTIxXCI6IFwiSW90YTtcIixcbiAgICBcIjkyMlwiOiBcIkthcHBhO1wiLFxuICAgIFwiOTIzXCI6IFwiTGFtYmRhO1wiLFxuICAgIFwiOTI0XCI6IFwiTXU7XCIsXG4gICAgXCI5MjVcIjogXCJOdTtcIixcbiAgICBcIjkyNlwiOiBcIlhpO1wiLFxuICAgIFwiOTI3XCI6IFwiT21pY3JvbjtcIixcbiAgICBcIjkyOFwiOiBcIlBpO1wiLFxuICAgIFwiOTI5XCI6IFwiUmhvO1wiLFxuICAgIFwiOTMxXCI6IFwiU2lnbWE7XCIsXG4gICAgXCI5MzJcIjogXCJUYXU7XCIsXG4gICAgXCI5MzNcIjogXCJVcHNpbG9uO1wiLFxuICAgIFwiOTM0XCI6IFwiUGhpO1wiLFxuICAgIFwiOTM1XCI6IFwiQ2hpO1wiLFxuICAgIFwiOTM2XCI6IFwiUHNpO1wiLFxuICAgIFwiOTM3XCI6IFwiT21lZ2E7XCIsXG4gICAgXCI5NDVcIjogXCJhbHBoYTtcIixcbiAgICBcIjk0NlwiOiBcImJldGE7XCIsXG4gICAgXCI5NDdcIjogXCJnYW1tYTtcIixcbiAgICBcIjk0OFwiOiBcImRlbHRhO1wiLFxuICAgIFwiOTQ5XCI6IFwiZXBzaWxvbjtcIixcbiAgICBcIjk1MFwiOiBcInpldGE7XCIsXG4gICAgXCI5NTFcIjogXCJldGE7XCIsXG4gICAgXCI5NTJcIjogXCJ0aGV0YTtcIixcbiAgICBcIjk1M1wiOiBcImlvdGE7XCIsXG4gICAgXCI5NTRcIjogXCJrYXBwYTtcIixcbiAgICBcIjk1NVwiOiBcImxhbWJkYTtcIixcbiAgICBcIjk1NlwiOiBcIm11O1wiLFxuICAgIFwiOTU3XCI6IFwibnU7XCIsXG4gICAgXCI5NThcIjogXCJ4aTtcIixcbiAgICBcIjk1OVwiOiBcIm9taWNyb247XCIsXG4gICAgXCI5NjBcIjogXCJwaTtcIixcbiAgICBcIjk2MVwiOiBcInJobztcIixcbiAgICBcIjk2MlwiOiBcInZhcnNpZ21hO1wiLFxuICAgIFwiOTYzXCI6IFwic2lnbWE7XCIsXG4gICAgXCI5NjRcIjogXCJ0YXU7XCIsXG4gICAgXCI5NjVcIjogXCJ1cHNpbG9uO1wiLFxuICAgIFwiOTY2XCI6IFwicGhpO1wiLFxuICAgIFwiOTY3XCI6IFwiY2hpO1wiLFxuICAgIFwiOTY4XCI6IFwicHNpO1wiLFxuICAgIFwiOTY5XCI6IFwib21lZ2E7XCIsXG4gICAgXCI5NzdcIjogXCJ2YXJ0aGV0YTtcIixcbiAgICBcIjk3OFwiOiBcInVwc2loO1wiLFxuICAgIFwiOTgxXCI6IFwidmFycGhpO1wiLFxuICAgIFwiOTgyXCI6IFwidmFycGk7XCIsXG4gICAgXCI5ODhcIjogXCJHYW1tYWQ7XCIsXG4gICAgXCI5ODlcIjogXCJnYW1tYWQ7XCIsXG4gICAgXCIxMDA4XCI6IFwidmFya2FwcGE7XCIsXG4gICAgXCIxMDA5XCI6IFwidmFycmhvO1wiLFxuICAgIFwiMTAxM1wiOiBcInZhcmVwc2lsb247XCIsXG4gICAgXCIxMDE0XCI6IFwiYmVwc2k7XCIsXG4gICAgXCIxMDI1XCI6IFwiSU9jeTtcIixcbiAgICBcIjEwMjZcIjogXCJESmN5O1wiLFxuICAgIFwiMTAyN1wiOiBcIkdKY3k7XCIsXG4gICAgXCIxMDI4XCI6IFwiSnVrY3k7XCIsXG4gICAgXCIxMDI5XCI6IFwiRFNjeTtcIixcbiAgICBcIjEwMzBcIjogXCJJdWtjeTtcIixcbiAgICBcIjEwMzFcIjogXCJZSWN5O1wiLFxuICAgIFwiMTAzMlwiOiBcIkpzZXJjeTtcIixcbiAgICBcIjEwMzNcIjogXCJMSmN5O1wiLFxuICAgIFwiMTAzNFwiOiBcIk5KY3k7XCIsXG4gICAgXCIxMDM1XCI6IFwiVFNIY3k7XCIsXG4gICAgXCIxMDM2XCI6IFwiS0pjeTtcIixcbiAgICBcIjEwMzhcIjogXCJVYnJjeTtcIixcbiAgICBcIjEwMzlcIjogXCJEWmN5O1wiLFxuICAgIFwiMTA0MFwiOiBcIkFjeTtcIixcbiAgICBcIjEwNDFcIjogXCJCY3k7XCIsXG4gICAgXCIxMDQyXCI6IFwiVmN5O1wiLFxuICAgIFwiMTA0M1wiOiBcIkdjeTtcIixcbiAgICBcIjEwNDRcIjogXCJEY3k7XCIsXG4gICAgXCIxMDQ1XCI6IFwiSUVjeTtcIixcbiAgICBcIjEwNDZcIjogXCJaSGN5O1wiLFxuICAgIFwiMTA0N1wiOiBcIlpjeTtcIixcbiAgICBcIjEwNDhcIjogXCJJY3k7XCIsXG4gICAgXCIxMDQ5XCI6IFwiSmN5O1wiLFxuICAgIFwiMTA1MFwiOiBcIktjeTtcIixcbiAgICBcIjEwNTFcIjogXCJMY3k7XCIsXG4gICAgXCIxMDUyXCI6IFwiTWN5O1wiLFxuICAgIFwiMTA1M1wiOiBcIk5jeTtcIixcbiAgICBcIjEwNTRcIjogXCJPY3k7XCIsXG4gICAgXCIxMDU1XCI6IFwiUGN5O1wiLFxuICAgIFwiMTA1NlwiOiBcIlJjeTtcIixcbiAgICBcIjEwNTdcIjogXCJTY3k7XCIsXG4gICAgXCIxMDU4XCI6IFwiVGN5O1wiLFxuICAgIFwiMTA1OVwiOiBcIlVjeTtcIixcbiAgICBcIjEwNjBcIjogXCJGY3k7XCIsXG4gICAgXCIxMDYxXCI6IFwiS0hjeTtcIixcbiAgICBcIjEwNjJcIjogXCJUU2N5O1wiLFxuICAgIFwiMTA2M1wiOiBcIkNIY3k7XCIsXG4gICAgXCIxMDY0XCI6IFwiU0hjeTtcIixcbiAgICBcIjEwNjVcIjogXCJTSENIY3k7XCIsXG4gICAgXCIxMDY2XCI6IFwiSEFSRGN5O1wiLFxuICAgIFwiMTA2N1wiOiBcIlljeTtcIixcbiAgICBcIjEwNjhcIjogXCJTT0ZUY3k7XCIsXG4gICAgXCIxMDY5XCI6IFwiRWN5O1wiLFxuICAgIFwiMTA3MFwiOiBcIllVY3k7XCIsXG4gICAgXCIxMDcxXCI6IFwiWUFjeTtcIixcbiAgICBcIjEwNzJcIjogXCJhY3k7XCIsXG4gICAgXCIxMDczXCI6IFwiYmN5O1wiLFxuICAgIFwiMTA3NFwiOiBcInZjeTtcIixcbiAgICBcIjEwNzVcIjogXCJnY3k7XCIsXG4gICAgXCIxMDc2XCI6IFwiZGN5O1wiLFxuICAgIFwiMTA3N1wiOiBcImllY3k7XCIsXG4gICAgXCIxMDc4XCI6IFwiemhjeTtcIixcbiAgICBcIjEwNzlcIjogXCJ6Y3k7XCIsXG4gICAgXCIxMDgwXCI6IFwiaWN5O1wiLFxuICAgIFwiMTA4MVwiOiBcImpjeTtcIixcbiAgICBcIjEwODJcIjogXCJrY3k7XCIsXG4gICAgXCIxMDgzXCI6IFwibGN5O1wiLFxuICAgIFwiMTA4NFwiOiBcIm1jeTtcIixcbiAgICBcIjEwODVcIjogXCJuY3k7XCIsXG4gICAgXCIxMDg2XCI6IFwib2N5O1wiLFxuICAgIFwiMTA4N1wiOiBcInBjeTtcIixcbiAgICBcIjEwODhcIjogXCJyY3k7XCIsXG4gICAgXCIxMDg5XCI6IFwic2N5O1wiLFxuICAgIFwiMTA5MFwiOiBcInRjeTtcIixcbiAgICBcIjEwOTFcIjogXCJ1Y3k7XCIsXG4gICAgXCIxMDkyXCI6IFwiZmN5O1wiLFxuICAgIFwiMTA5M1wiOiBcImtoY3k7XCIsXG4gICAgXCIxMDk0XCI6IFwidHNjeTtcIixcbiAgICBcIjEwOTVcIjogXCJjaGN5O1wiLFxuICAgIFwiMTA5NlwiOiBcInNoY3k7XCIsXG4gICAgXCIxMDk3XCI6IFwic2hjaGN5O1wiLFxuICAgIFwiMTA5OFwiOiBcImhhcmRjeTtcIixcbiAgICBcIjEwOTlcIjogXCJ5Y3k7XCIsXG4gICAgXCIxMTAwXCI6IFwic29mdGN5O1wiLFxuICAgIFwiMTEwMVwiOiBcImVjeTtcIixcbiAgICBcIjExMDJcIjogXCJ5dWN5O1wiLFxuICAgIFwiMTEwM1wiOiBcInlhY3k7XCIsXG4gICAgXCIxMTA1XCI6IFwiaW9jeTtcIixcbiAgICBcIjExMDZcIjogXCJkamN5O1wiLFxuICAgIFwiMTEwN1wiOiBcImdqY3k7XCIsXG4gICAgXCIxMTA4XCI6IFwianVrY3k7XCIsXG4gICAgXCIxMTA5XCI6IFwiZHNjeTtcIixcbiAgICBcIjExMTBcIjogXCJpdWtjeTtcIixcbiAgICBcIjExMTFcIjogXCJ5aWN5O1wiLFxuICAgIFwiMTExMlwiOiBcImpzZXJjeTtcIixcbiAgICBcIjExMTNcIjogXCJsamN5O1wiLFxuICAgIFwiMTExNFwiOiBcIm5qY3k7XCIsXG4gICAgXCIxMTE1XCI6IFwidHNoY3k7XCIsXG4gICAgXCIxMTE2XCI6IFwia2pjeTtcIixcbiAgICBcIjExMThcIjogXCJ1YnJjeTtcIixcbiAgICBcIjExMTlcIjogXCJkemN5O1wiLFxuICAgIFwiODE5NFwiOiBcImVuc3A7XCIsXG4gICAgXCI4MTk1XCI6IFwiZW1zcDtcIixcbiAgICBcIjgxOTZcIjogXCJlbXNwMTM7XCIsXG4gICAgXCI4MTk3XCI6IFwiZW1zcDE0O1wiLFxuICAgIFwiODE5OVwiOiBcIm51bXNwO1wiLFxuICAgIFwiODIwMFwiOiBcInB1bmNzcDtcIixcbiAgICBcIjgyMDFcIjogXCJUaGluU3BhY2U7XCIsXG4gICAgXCI4MjAyXCI6IFwiVmVyeVRoaW5TcGFjZTtcIixcbiAgICBcIjgyMDNcIjogXCJaZXJvV2lkdGhTcGFjZTtcIixcbiAgICBcIjgyMDRcIjogXCJ6d25qO1wiLFxuICAgIFwiODIwNVwiOiBcInp3ajtcIixcbiAgICBcIjgyMDZcIjogXCJscm07XCIsXG4gICAgXCI4MjA3XCI6IFwicmxtO1wiLFxuICAgIFwiODIwOFwiOiBcImh5cGhlbjtcIixcbiAgICBcIjgyMTFcIjogXCJuZGFzaDtcIixcbiAgICBcIjgyMTJcIjogXCJtZGFzaDtcIixcbiAgICBcIjgyMTNcIjogXCJob3JiYXI7XCIsXG4gICAgXCI4MjE0XCI6IFwiVmVydDtcIixcbiAgICBcIjgyMTZcIjogXCJPcGVuQ3VybHlRdW90ZTtcIixcbiAgICBcIjgyMTdcIjogXCJyc3F1b3I7XCIsXG4gICAgXCI4MjE4XCI6IFwic2JxdW87XCIsXG4gICAgXCI4MjIwXCI6IFwiT3BlbkN1cmx5RG91YmxlUXVvdGU7XCIsXG4gICAgXCI4MjIxXCI6IFwicmRxdW9yO1wiLFxuICAgIFwiODIyMlwiOiBcImxkcXVvcjtcIixcbiAgICBcIjgyMjRcIjogXCJkYWdnZXI7XCIsXG4gICAgXCI4MjI1XCI6IFwiZGRhZ2dlcjtcIixcbiAgICBcIjgyMjZcIjogXCJidWxsZXQ7XCIsXG4gICAgXCI4MjI5XCI6IFwibmxkcjtcIixcbiAgICBcIjgyMzBcIjogXCJtbGRyO1wiLFxuICAgIFwiODI0MFwiOiBcInBlcm1pbDtcIixcbiAgICBcIjgyNDFcIjogXCJwZXJ0ZW5rO1wiLFxuICAgIFwiODI0MlwiOiBcInByaW1lO1wiLFxuICAgIFwiODI0M1wiOiBcIlByaW1lO1wiLFxuICAgIFwiODI0NFwiOiBcInRwcmltZTtcIixcbiAgICBcIjgyNDVcIjogXCJicHJpbWU7XCIsXG4gICAgXCI4MjQ5XCI6IFwibHNhcXVvO1wiLFxuICAgIFwiODI1MFwiOiBcInJzYXF1bztcIixcbiAgICBcIjgyNTRcIjogXCJPdmVyQmFyO1wiLFxuICAgIFwiODI1N1wiOiBcImNhcmV0O1wiLFxuICAgIFwiODI1OVwiOiBcImh5YnVsbDtcIixcbiAgICBcIjgyNjBcIjogXCJmcmFzbDtcIixcbiAgICBcIjgyNzFcIjogXCJic2VtaTtcIixcbiAgICBcIjgyNzlcIjogXCJxcHJpbWU7XCIsXG4gICAgXCI4Mjg3XCI6IFwiTWVkaXVtU3BhY2U7XCIsXG4gICAgXCI4Mjg4XCI6IFwiTm9CcmVhaztcIixcbiAgICBcIjgyODlcIjogXCJBcHBseUZ1bmN0aW9uO1wiLFxuICAgIFwiODI5MFwiOiBcIml0O1wiLFxuICAgIFwiODI5MVwiOiBcIkludmlzaWJsZUNvbW1hO1wiLFxuICAgIFwiODM2NFwiOiBcImV1cm87XCIsXG4gICAgXCI4NDExXCI6IFwiVHJpcGxlRG90O1wiLFxuICAgIFwiODQxMlwiOiBcIkRvdERvdDtcIixcbiAgICBcIjg0NTBcIjogXCJDb3BmO1wiLFxuICAgIFwiODQ1M1wiOiBcImluY2FyZTtcIixcbiAgICBcIjg0NThcIjogXCJnc2NyO1wiLFxuICAgIFwiODQ1OVwiOiBcIkhzY3I7XCIsXG4gICAgXCI4NDYwXCI6IFwiUG9pbmNhcmVwbGFuZTtcIixcbiAgICBcIjg0NjFcIjogXCJxdWF0ZXJuaW9ucztcIixcbiAgICBcIjg0NjJcIjogXCJwbGFuY2toO1wiLFxuICAgIFwiODQ2M1wiOiBcInBsYW5rdjtcIixcbiAgICBcIjg0NjRcIjogXCJJc2NyO1wiLFxuICAgIFwiODQ2NVwiOiBcImltYWdwYXJ0O1wiLFxuICAgIFwiODQ2NlwiOiBcIkxzY3I7XCIsXG4gICAgXCI4NDY3XCI6IFwiZWxsO1wiLFxuICAgIFwiODQ2OVwiOiBcIk5vcGY7XCIsXG4gICAgXCI4NDcwXCI6IFwibnVtZXJvO1wiLFxuICAgIFwiODQ3MVwiOiBcImNvcHlzcjtcIixcbiAgICBcIjg0NzJcIjogXCJ3cDtcIixcbiAgICBcIjg0NzNcIjogXCJwcmltZXM7XCIsXG4gICAgXCI4NDc0XCI6IFwicmF0aW9uYWxzO1wiLFxuICAgIFwiODQ3NVwiOiBcIlJzY3I7XCIsXG4gICAgXCI4NDc2XCI6IFwiUmZyO1wiLFxuICAgIFwiODQ3N1wiOiBcIlJvcGY7XCIsXG4gICAgXCI4NDc4XCI6IFwicng7XCIsXG4gICAgXCI4NDgyXCI6IFwidHJhZGU7XCIsXG4gICAgXCI4NDg0XCI6IFwiWm9wZjtcIixcbiAgICBcIjg0ODdcIjogXCJtaG87XCIsXG4gICAgXCI4NDg4XCI6IFwiWmZyO1wiLFxuICAgIFwiODQ4OVwiOiBcImlpb3RhO1wiLFxuICAgIFwiODQ5MlwiOiBcIkJzY3I7XCIsXG4gICAgXCI4NDkzXCI6IFwiQ2ZyO1wiLFxuICAgIFwiODQ5NVwiOiBcImVzY3I7XCIsXG4gICAgXCI4NDk2XCI6IFwiZXhwZWN0YXRpb247XCIsXG4gICAgXCI4NDk3XCI6IFwiRnNjcjtcIixcbiAgICBcIjg0OTlcIjogXCJwaG1tYXQ7XCIsXG4gICAgXCI4NTAwXCI6IFwib3NjcjtcIixcbiAgICBcIjg1MDFcIjogXCJhbGVwaDtcIixcbiAgICBcIjg1MDJcIjogXCJiZXRoO1wiLFxuICAgIFwiODUwM1wiOiBcImdpbWVsO1wiLFxuICAgIFwiODUwNFwiOiBcImRhbGV0aDtcIixcbiAgICBcIjg1MTdcIjogXCJERDtcIixcbiAgICBcIjg1MThcIjogXCJEaWZmZXJlbnRpYWxEO1wiLFxuICAgIFwiODUxOVwiOiBcImV4cG9uZW50aWFsZTtcIixcbiAgICBcIjg1MjBcIjogXCJJbWFnaW5hcnlJO1wiLFxuICAgIFwiODUzMVwiOiBcImZyYWMxMztcIixcbiAgICBcIjg1MzJcIjogXCJmcmFjMjM7XCIsXG4gICAgXCI4NTMzXCI6IFwiZnJhYzE1O1wiLFxuICAgIFwiODUzNFwiOiBcImZyYWMyNTtcIixcbiAgICBcIjg1MzVcIjogXCJmcmFjMzU7XCIsXG4gICAgXCI4NTM2XCI6IFwiZnJhYzQ1O1wiLFxuICAgIFwiODUzN1wiOiBcImZyYWMxNjtcIixcbiAgICBcIjg1MzhcIjogXCJmcmFjNTY7XCIsXG4gICAgXCI4NTM5XCI6IFwiZnJhYzE4O1wiLFxuICAgIFwiODU0MFwiOiBcImZyYWMzODtcIixcbiAgICBcIjg1NDFcIjogXCJmcmFjNTg7XCIsXG4gICAgXCI4NTQyXCI6IFwiZnJhYzc4O1wiLFxuICAgIFwiODU5MlwiOiBcInNsYXJyO1wiLFxuICAgIFwiODU5M1wiOiBcInVwYXJyb3c7XCIsXG4gICAgXCI4NTk0XCI6IFwic3JhcnI7XCIsXG4gICAgXCI4NTk1XCI6IFwiU2hvcnREb3duQXJyb3c7XCIsXG4gICAgXCI4NTk2XCI6IFwibGVmdHJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NTk3XCI6IFwidmFycjtcIixcbiAgICBcIjg1OThcIjogXCJVcHBlckxlZnRBcnJvdztcIixcbiAgICBcIjg1OTlcIjogXCJVcHBlclJpZ2h0QXJyb3c7XCIsXG4gICAgXCI4NjAwXCI6IFwic2VhcnJvdztcIixcbiAgICBcIjg2MDFcIjogXCJzd2Fycm93O1wiLFxuICAgIFwiODYwMlwiOiBcIm5sZWZ0YXJyb3c7XCIsXG4gICAgXCI4NjAzXCI6IFwibnJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjA1XCI6IFwicmlnaHRzcXVpZ2Fycm93O1wiLFxuICAgIFwiODYwNlwiOiBcInR3b2hlYWRsZWZ0YXJyb3c7XCIsXG4gICAgXCI4NjA3XCI6IFwiVWFycjtcIixcbiAgICBcIjg2MDhcIjogXCJ0d29oZWFkcmlnaHRhcnJvdztcIixcbiAgICBcIjg2MDlcIjogXCJEYXJyO1wiLFxuICAgIFwiODYxMFwiOiBcImxlZnRhcnJvd3RhaWw7XCIsXG4gICAgXCI4NjExXCI6IFwicmlnaHRhcnJvd3RhaWw7XCIsXG4gICAgXCI4NjEyXCI6IFwibWFwc3RvbGVmdDtcIixcbiAgICBcIjg2MTNcIjogXCJVcFRlZUFycm93O1wiLFxuICAgIFwiODYxNFwiOiBcIlJpZ2h0VGVlQXJyb3c7XCIsXG4gICAgXCI4NjE1XCI6IFwibWFwc3RvZG93bjtcIixcbiAgICBcIjg2MTdcIjogXCJsYXJyaGs7XCIsXG4gICAgXCI4NjE4XCI6IFwicmFycmhrO1wiLFxuICAgIFwiODYxOVwiOiBcImxvb3BhcnJvd2xlZnQ7XCIsXG4gICAgXCI4NjIwXCI6IFwicmFycmxwO1wiLFxuICAgIFwiODYyMVwiOiBcImxlZnRyaWdodHNxdWlnYXJyb3c7XCIsXG4gICAgXCI4NjIyXCI6IFwibmxlZnRyaWdodGFycm93O1wiLFxuICAgIFwiODYyNFwiOiBcImxzaDtcIixcbiAgICBcIjg2MjVcIjogXCJyc2g7XCIsXG4gICAgXCI4NjI2XCI6IFwibGRzaDtcIixcbiAgICBcIjg2MjdcIjogXCJyZHNoO1wiLFxuICAgIFwiODYyOVwiOiBcImNyYXJyO1wiLFxuICAgIFwiODYzMFwiOiBcImN1cnZlYXJyb3dsZWZ0O1wiLFxuICAgIFwiODYzMVwiOiBcImN1cnZlYXJyb3dyaWdodDtcIixcbiAgICBcIjg2MzRcIjogXCJvbGFycjtcIixcbiAgICBcIjg2MzVcIjogXCJvcmFycjtcIixcbiAgICBcIjg2MzZcIjogXCJsaGFydTtcIixcbiAgICBcIjg2MzdcIjogXCJsaGFyZDtcIixcbiAgICBcIjg2MzhcIjogXCJ1cGhhcnBvb25yaWdodDtcIixcbiAgICBcIjg2MzlcIjogXCJ1cGhhcnBvb25sZWZ0O1wiLFxuICAgIFwiODY0MFwiOiBcIlJpZ2h0VmVjdG9yO1wiLFxuICAgIFwiODY0MVwiOiBcInJpZ2h0aGFycG9vbmRvd247XCIsXG4gICAgXCI4NjQyXCI6IFwiUmlnaHREb3duVmVjdG9yO1wiLFxuICAgIFwiODY0M1wiOiBcIkxlZnREb3duVmVjdG9yO1wiLFxuICAgIFwiODY0NFwiOiBcInJsYXJyO1wiLFxuICAgIFwiODY0NVwiOiBcIlVwQXJyb3dEb3duQXJyb3c7XCIsXG4gICAgXCI4NjQ2XCI6IFwibHJhcnI7XCIsXG4gICAgXCI4NjQ3XCI6IFwibGxhcnI7XCIsXG4gICAgXCI4NjQ4XCI6IFwidXVhcnI7XCIsXG4gICAgXCI4NjQ5XCI6IFwicnJhcnI7XCIsXG4gICAgXCI4NjUwXCI6IFwiZG93bmRvd25hcnJvd3M7XCIsXG4gICAgXCI4NjUxXCI6IFwiUmV2ZXJzZUVxdWlsaWJyaXVtO1wiLFxuICAgIFwiODY1MlwiOiBcInJsaGFyO1wiLFxuICAgIFwiODY1M1wiOiBcIm5MZWZ0YXJyb3c7XCIsXG4gICAgXCI4NjU0XCI6IFwibkxlZnRyaWdodGFycm93O1wiLFxuICAgIFwiODY1NVwiOiBcIm5SaWdodGFycm93O1wiLFxuICAgIFwiODY1NlwiOiBcIkxlZnRhcnJvdztcIixcbiAgICBcIjg2NTdcIjogXCJVcGFycm93O1wiLFxuICAgIFwiODY1OFwiOiBcIlJpZ2h0YXJyb3c7XCIsXG4gICAgXCI4NjU5XCI6IFwiRG93bmFycm93O1wiLFxuICAgIFwiODY2MFwiOiBcIkxlZnRyaWdodGFycm93O1wiLFxuICAgIFwiODY2MVwiOiBcInZBcnI7XCIsXG4gICAgXCI4NjYyXCI6IFwibndBcnI7XCIsXG4gICAgXCI4NjYzXCI6IFwibmVBcnI7XCIsXG4gICAgXCI4NjY0XCI6IFwic2VBcnI7XCIsXG4gICAgXCI4NjY1XCI6IFwic3dBcnI7XCIsXG4gICAgXCI4NjY2XCI6IFwiTGxlZnRhcnJvdztcIixcbiAgICBcIjg2NjdcIjogXCJScmlnaHRhcnJvdztcIixcbiAgICBcIjg2NjlcIjogXCJ6aWdyYXJyO1wiLFxuICAgIFwiODY3NlwiOiBcIkxlZnRBcnJvd0JhcjtcIixcbiAgICBcIjg2NzdcIjogXCJSaWdodEFycm93QmFyO1wiLFxuICAgIFwiODY5M1wiOiBcImR1YXJyO1wiLFxuICAgIFwiODcwMVwiOiBcImxvYXJyO1wiLFxuICAgIFwiODcwMlwiOiBcInJvYXJyO1wiLFxuICAgIFwiODcwM1wiOiBcImhvYXJyO1wiLFxuICAgIFwiODcwNFwiOiBcImZvcmFsbDtcIixcbiAgICBcIjg3MDVcIjogXCJjb21wbGVtZW50O1wiLFxuICAgIFwiODcwNlwiOiBcIlBhcnRpYWxEO1wiLFxuICAgIFwiODcwN1wiOiBcIkV4aXN0cztcIixcbiAgICBcIjg3MDhcIjogXCJOb3RFeGlzdHM7XCIsXG4gICAgXCI4NzA5XCI6IFwidmFybm90aGluZztcIixcbiAgICBcIjg3MTFcIjogXCJuYWJsYTtcIixcbiAgICBcIjg3MTJcIjogXCJpc2ludjtcIixcbiAgICBcIjg3MTNcIjogXCJub3RpbnZhO1wiLFxuICAgIFwiODcxNVwiOiBcIlN1Y2hUaGF0O1wiLFxuICAgIFwiODcxNlwiOiBcIk5vdFJldmVyc2VFbGVtZW50O1wiLFxuICAgIFwiODcxOVwiOiBcIlByb2R1Y3Q7XCIsXG4gICAgXCI4NzIwXCI6IFwiQ29wcm9kdWN0O1wiLFxuICAgIFwiODcyMVwiOiBcInN1bTtcIixcbiAgICBcIjg3MjJcIjogXCJtaW51cztcIixcbiAgICBcIjg3MjNcIjogXCJtcDtcIixcbiAgICBcIjg3MjRcIjogXCJwbHVzZG87XCIsXG4gICAgXCI4NzI2XCI6IFwic3NldG1uO1wiLFxuICAgIFwiODcyN1wiOiBcImxvd2FzdDtcIixcbiAgICBcIjg3MjhcIjogXCJTbWFsbENpcmNsZTtcIixcbiAgICBcIjg3MzBcIjogXCJTcXJ0O1wiLFxuICAgIFwiODczM1wiOiBcInZwcm9wO1wiLFxuICAgIFwiODczNFwiOiBcImluZmluO1wiLFxuICAgIFwiODczNVwiOiBcImFuZ3J0O1wiLFxuICAgIFwiODczNlwiOiBcImFuZ2xlO1wiLFxuICAgIFwiODczN1wiOiBcIm1lYXN1cmVkYW5nbGU7XCIsXG4gICAgXCI4NzM4XCI6IFwiYW5nc3BoO1wiLFxuICAgIFwiODczOVwiOiBcIlZlcnRpY2FsQmFyO1wiLFxuICAgIFwiODc0MFwiOiBcIm5zbWlkO1wiLFxuICAgIFwiODc0MVwiOiBcInNwYXI7XCIsXG4gICAgXCI4NzQyXCI6IFwibnNwYXI7XCIsXG4gICAgXCI4NzQzXCI6IFwid2VkZ2U7XCIsXG4gICAgXCI4NzQ0XCI6IFwidmVlO1wiLFxuICAgIFwiODc0NVwiOiBcImNhcDtcIixcbiAgICBcIjg3NDZcIjogXCJjdXA7XCIsXG4gICAgXCI4NzQ3XCI6IFwiSW50ZWdyYWw7XCIsXG4gICAgXCI4NzQ4XCI6IFwiSW50O1wiLFxuICAgIFwiODc0OVwiOiBcInRpbnQ7XCIsXG4gICAgXCI4NzUwXCI6IFwib2ludDtcIixcbiAgICBcIjg3NTFcIjogXCJEb3VibGVDb250b3VySW50ZWdyYWw7XCIsXG4gICAgXCI4NzUyXCI6IFwiQ2NvbmludDtcIixcbiAgICBcIjg3NTNcIjogXCJjd2ludDtcIixcbiAgICBcIjg3NTRcIjogXCJjd2NvbmludDtcIixcbiAgICBcIjg3NTVcIjogXCJDb3VudGVyQ2xvY2t3aXNlQ29udG91ckludGVncmFsO1wiLFxuICAgIFwiODc1NlwiOiBcInRoZXJlZm9yZTtcIixcbiAgICBcIjg3NTdcIjogXCJiZWNhdXNlO1wiLFxuICAgIFwiODc1OFwiOiBcInJhdGlvO1wiLFxuICAgIFwiODc1OVwiOiBcIlByb3BvcnRpb247XCIsXG4gICAgXCI4NzYwXCI6IFwibWludXNkO1wiLFxuICAgIFwiODc2MlwiOiBcIm1ERG90O1wiLFxuICAgIFwiODc2M1wiOiBcImhvbXRodDtcIixcbiAgICBcIjg3NjRcIjogXCJUaWxkZTtcIixcbiAgICBcIjg3NjVcIjogXCJic2ltO1wiLFxuICAgIFwiODc2NlwiOiBcIm1zdHBvcztcIixcbiAgICBcIjg3NjdcIjogXCJhY2Q7XCIsXG4gICAgXCI4NzY4XCI6IFwid3JlYXRoO1wiLFxuICAgIFwiODc2OVwiOiBcIm5zaW07XCIsXG4gICAgXCI4NzcwXCI6IFwiZXNpbTtcIixcbiAgICBcIjg3NzFcIjogXCJUaWxkZUVxdWFsO1wiLFxuICAgIFwiODc3MlwiOiBcIm5zaW1lcTtcIixcbiAgICBcIjg3NzNcIjogXCJUaWxkZUZ1bGxFcXVhbDtcIixcbiAgICBcIjg3NzRcIjogXCJzaW1uZTtcIixcbiAgICBcIjg3NzVcIjogXCJOb3RUaWxkZUZ1bGxFcXVhbDtcIixcbiAgICBcIjg3NzZcIjogXCJUaWxkZVRpbGRlO1wiLFxuICAgIFwiODc3N1wiOiBcIk5vdFRpbGRlVGlsZGU7XCIsXG4gICAgXCI4Nzc4XCI6IFwiYXBwcm94ZXE7XCIsXG4gICAgXCI4Nzc5XCI6IFwiYXBpZDtcIixcbiAgICBcIjg3ODBcIjogXCJiY29uZztcIixcbiAgICBcIjg3ODFcIjogXCJDdXBDYXA7XCIsXG4gICAgXCI4NzgyXCI6IFwiSHVtcERvd25IdW1wO1wiLFxuICAgIFwiODc4M1wiOiBcIkh1bXBFcXVhbDtcIixcbiAgICBcIjg3ODRcIjogXCJlc2RvdDtcIixcbiAgICBcIjg3ODVcIjogXCJlRG90O1wiLFxuICAgIFwiODc4NlwiOiBcImZhbGxpbmdkb3RzZXE7XCIsXG4gICAgXCI4Nzg3XCI6IFwicmlzaW5nZG90c2VxO1wiLFxuICAgIFwiODc4OFwiOiBcImNvbG9uZXE7XCIsXG4gICAgXCI4Nzg5XCI6IFwiZXFjb2xvbjtcIixcbiAgICBcIjg3OTBcIjogXCJlcWNpcmM7XCIsXG4gICAgXCI4NzkxXCI6IFwiY2lyZTtcIixcbiAgICBcIjg3OTNcIjogXCJ3ZWRnZXE7XCIsXG4gICAgXCI4Nzk0XCI6IFwidmVlZXE7XCIsXG4gICAgXCI4Nzk2XCI6IFwidHJpZTtcIixcbiAgICBcIjg3OTlcIjogXCJxdWVzdGVxO1wiLFxuICAgIFwiODgwMFwiOiBcIk5vdEVxdWFsO1wiLFxuICAgIFwiODgwMVwiOiBcImVxdWl2O1wiLFxuICAgIFwiODgwMlwiOiBcIk5vdENvbmdydWVudDtcIixcbiAgICBcIjg4MDRcIjogXCJsZXE7XCIsXG4gICAgXCI4ODA1XCI6IFwiR3JlYXRlckVxdWFsO1wiLFxuICAgIFwiODgwNlwiOiBcIkxlc3NGdWxsRXF1YWw7XCIsXG4gICAgXCI4ODA3XCI6IFwiR3JlYXRlckZ1bGxFcXVhbDtcIixcbiAgICBcIjg4MDhcIjogXCJsbmVxcTtcIixcbiAgICBcIjg4MDlcIjogXCJnbmVxcTtcIixcbiAgICBcIjg4MTBcIjogXCJOZXN0ZWRMZXNzTGVzcztcIixcbiAgICBcIjg4MTFcIjogXCJOZXN0ZWRHcmVhdGVyR3JlYXRlcjtcIixcbiAgICBcIjg4MTJcIjogXCJ0d2l4dDtcIixcbiAgICBcIjg4MTNcIjogXCJOb3RDdXBDYXA7XCIsXG4gICAgXCI4ODE0XCI6IFwiTm90TGVzcztcIixcbiAgICBcIjg4MTVcIjogXCJOb3RHcmVhdGVyO1wiLFxuICAgIFwiODgxNlwiOiBcIk5vdExlc3NFcXVhbDtcIixcbiAgICBcIjg4MTdcIjogXCJOb3RHcmVhdGVyRXF1YWw7XCIsXG4gICAgXCI4ODE4XCI6IFwibHNpbTtcIixcbiAgICBcIjg4MTlcIjogXCJndHJzaW07XCIsXG4gICAgXCI4ODIwXCI6IFwiTm90TGVzc1RpbGRlO1wiLFxuICAgIFwiODgyMVwiOiBcIk5vdEdyZWF0ZXJUaWxkZTtcIixcbiAgICBcIjg4MjJcIjogXCJsZztcIixcbiAgICBcIjg4MjNcIjogXCJndHJsZXNzO1wiLFxuICAgIFwiODgyNFwiOiBcIm50bGc7XCIsXG4gICAgXCI4ODI1XCI6IFwibnRnbDtcIixcbiAgICBcIjg4MjZcIjogXCJQcmVjZWRlcztcIixcbiAgICBcIjg4MjdcIjogXCJTdWNjZWVkcztcIixcbiAgICBcIjg4MjhcIjogXCJQcmVjZWRlc1NsYW50RXF1YWw7XCIsXG4gICAgXCI4ODI5XCI6IFwiU3VjY2VlZHNTbGFudEVxdWFsO1wiLFxuICAgIFwiODgzMFwiOiBcInByc2ltO1wiLFxuICAgIFwiODgzMVwiOiBcInN1Y2NzaW07XCIsXG4gICAgXCI4ODMyXCI6IFwibnByZWM7XCIsXG4gICAgXCI4ODMzXCI6IFwibnN1Y2M7XCIsXG4gICAgXCI4ODM0XCI6IFwic3Vic2V0O1wiLFxuICAgIFwiODgzNVwiOiBcInN1cHNldDtcIixcbiAgICBcIjg4MzZcIjogXCJuc3ViO1wiLFxuICAgIFwiODgzN1wiOiBcIm5zdXA7XCIsXG4gICAgXCI4ODM4XCI6IFwiU3Vic2V0RXF1YWw7XCIsXG4gICAgXCI4ODM5XCI6IFwic3Vwc2V0ZXE7XCIsXG4gICAgXCI4ODQwXCI6IFwibnN1YnNldGVxO1wiLFxuICAgIFwiODg0MVwiOiBcIm5zdXBzZXRlcTtcIixcbiAgICBcIjg4NDJcIjogXCJzdWJzZXRuZXE7XCIsXG4gICAgXCI4ODQzXCI6IFwic3Vwc2V0bmVxO1wiLFxuICAgIFwiODg0NVwiOiBcImN1cGRvdDtcIixcbiAgICBcIjg4NDZcIjogXCJ1cGx1cztcIixcbiAgICBcIjg4NDdcIjogXCJTcXVhcmVTdWJzZXQ7XCIsXG4gICAgXCI4ODQ4XCI6IFwiU3F1YXJlU3VwZXJzZXQ7XCIsXG4gICAgXCI4ODQ5XCI6IFwiU3F1YXJlU3Vic2V0RXF1YWw7XCIsXG4gICAgXCI4ODUwXCI6IFwiU3F1YXJlU3VwZXJzZXRFcXVhbDtcIixcbiAgICBcIjg4NTFcIjogXCJTcXVhcmVJbnRlcnNlY3Rpb247XCIsXG4gICAgXCI4ODUyXCI6IFwiU3F1YXJlVW5pb247XCIsXG4gICAgXCI4ODUzXCI6IFwib3BsdXM7XCIsXG4gICAgXCI4ODU0XCI6IFwib21pbnVzO1wiLFxuICAgIFwiODg1NVwiOiBcIm90aW1lcztcIixcbiAgICBcIjg4NTZcIjogXCJvc29sO1wiLFxuICAgIFwiODg1N1wiOiBcIm9kb3Q7XCIsXG4gICAgXCI4ODU4XCI6IFwib2NpcjtcIixcbiAgICBcIjg4NTlcIjogXCJvYXN0O1wiLFxuICAgIFwiODg2MVwiOiBcIm9kYXNoO1wiLFxuICAgIFwiODg2MlwiOiBcInBsdXNiO1wiLFxuICAgIFwiODg2M1wiOiBcIm1pbnVzYjtcIixcbiAgICBcIjg4NjRcIjogXCJ0aW1lc2I7XCIsXG4gICAgXCI4ODY1XCI6IFwic2RvdGI7XCIsXG4gICAgXCI4ODY2XCI6IFwidmRhc2g7XCIsXG4gICAgXCI4ODY3XCI6IFwiTGVmdFRlZTtcIixcbiAgICBcIjg4NjhcIjogXCJ0b3A7XCIsXG4gICAgXCI4ODY5XCI6IFwiVXBUZWU7XCIsXG4gICAgXCI4ODcxXCI6IFwibW9kZWxzO1wiLFxuICAgIFwiODg3MlwiOiBcInZEYXNoO1wiLFxuICAgIFwiODg3M1wiOiBcIlZkYXNoO1wiLFxuICAgIFwiODg3NFwiOiBcIlZ2ZGFzaDtcIixcbiAgICBcIjg4NzVcIjogXCJWRGFzaDtcIixcbiAgICBcIjg4NzZcIjogXCJudmRhc2g7XCIsXG4gICAgXCI4ODc3XCI6IFwibnZEYXNoO1wiLFxuICAgIFwiODg3OFwiOiBcIm5WZGFzaDtcIixcbiAgICBcIjg4NzlcIjogXCJuVkRhc2g7XCIsXG4gICAgXCI4ODgwXCI6IFwicHJ1cmVsO1wiLFxuICAgIFwiODg4MlwiOiBcInZsdHJpO1wiLFxuICAgIFwiODg4M1wiOiBcInZydHJpO1wiLFxuICAgIFwiODg4NFwiOiBcInRyaWFuZ2xlbGVmdGVxO1wiLFxuICAgIFwiODg4NVwiOiBcInRyaWFuZ2xlcmlnaHRlcTtcIixcbiAgICBcIjg4ODZcIjogXCJvcmlnb2Y7XCIsXG4gICAgXCI4ODg3XCI6IFwiaW1vZjtcIixcbiAgICBcIjg4ODhcIjogXCJtdW1hcDtcIixcbiAgICBcIjg4ODlcIjogXCJoZXJjb247XCIsXG4gICAgXCI4ODkwXCI6IFwiaW50ZXJjYWw7XCIsXG4gICAgXCI4ODkxXCI6IFwidmVlYmFyO1wiLFxuICAgIFwiODg5M1wiOiBcImJhcnZlZTtcIixcbiAgICBcIjg4OTRcIjogXCJhbmdydHZiO1wiLFxuICAgIFwiODg5NVwiOiBcImxydHJpO1wiLFxuICAgIFwiODg5NlwiOiBcInh3ZWRnZTtcIixcbiAgICBcIjg4OTdcIjogXCJ4dmVlO1wiLFxuICAgIFwiODg5OFwiOiBcInhjYXA7XCIsXG4gICAgXCI4ODk5XCI6IFwieGN1cDtcIixcbiAgICBcIjg5MDBcIjogXCJkaWFtb25kO1wiLFxuICAgIFwiODkwMVwiOiBcInNkb3Q7XCIsXG4gICAgXCI4OTAyXCI6IFwiU3RhcjtcIixcbiAgICBcIjg5MDNcIjogXCJkaXZvbng7XCIsXG4gICAgXCI4OTA0XCI6IFwiYm93dGllO1wiLFxuICAgIFwiODkwNVwiOiBcImx0aW1lcztcIixcbiAgICBcIjg5MDZcIjogXCJydGltZXM7XCIsXG4gICAgXCI4OTA3XCI6IFwibHRocmVlO1wiLFxuICAgIFwiODkwOFwiOiBcInJ0aHJlZTtcIixcbiAgICBcIjg5MDlcIjogXCJic2ltZTtcIixcbiAgICBcIjg5MTBcIjogXCJjdXZlZTtcIixcbiAgICBcIjg5MTFcIjogXCJjdXdlZDtcIixcbiAgICBcIjg5MTJcIjogXCJTdWJzZXQ7XCIsXG4gICAgXCI4OTEzXCI6IFwiU3Vwc2V0O1wiLFxuICAgIFwiODkxNFwiOiBcIkNhcDtcIixcbiAgICBcIjg5MTVcIjogXCJDdXA7XCIsXG4gICAgXCI4OTE2XCI6IFwicGl0Y2hmb3JrO1wiLFxuICAgIFwiODkxN1wiOiBcImVwYXI7XCIsXG4gICAgXCI4OTE4XCI6IFwibHRkb3Q7XCIsXG4gICAgXCI4OTE5XCI6IFwiZ3RyZG90O1wiLFxuICAgIFwiODkyMFwiOiBcIkxsO1wiLFxuICAgIFwiODkyMVwiOiBcImdnZztcIixcbiAgICBcIjg5MjJcIjogXCJMZXNzRXF1YWxHcmVhdGVyO1wiLFxuICAgIFwiODkyM1wiOiBcImd0cmVxbGVzcztcIixcbiAgICBcIjg5MjZcIjogXCJjdXJseWVxcHJlYztcIixcbiAgICBcIjg5MjdcIjogXCJjdXJseWVxc3VjYztcIixcbiAgICBcIjg5MjhcIjogXCJucHJjdWU7XCIsXG4gICAgXCI4OTI5XCI6IFwibnNjY3VlO1wiLFxuICAgIFwiODkzMFwiOiBcIm5zcXN1YmU7XCIsXG4gICAgXCI4OTMxXCI6IFwibnNxc3VwZTtcIixcbiAgICBcIjg5MzRcIjogXCJsbnNpbTtcIixcbiAgICBcIjg5MzVcIjogXCJnbnNpbTtcIixcbiAgICBcIjg5MzZcIjogXCJwcm5zaW07XCIsXG4gICAgXCI4OTM3XCI6IFwic3VjY25zaW07XCIsXG4gICAgXCI4OTM4XCI6IFwibnRyaWFuZ2xlbGVmdDtcIixcbiAgICBcIjg5MzlcIjogXCJudHJpYW5nbGVyaWdodDtcIixcbiAgICBcIjg5NDBcIjogXCJudHJpYW5nbGVsZWZ0ZXE7XCIsXG4gICAgXCI4OTQxXCI6IFwibnRyaWFuZ2xlcmlnaHRlcTtcIixcbiAgICBcIjg5NDJcIjogXCJ2ZWxsaXA7XCIsXG4gICAgXCI4OTQzXCI6IFwiY3Rkb3Q7XCIsXG4gICAgXCI4OTQ0XCI6IFwidXRkb3Q7XCIsXG4gICAgXCI4OTQ1XCI6IFwiZHRkb3Q7XCIsXG4gICAgXCI4OTQ2XCI6IFwiZGlzaW47XCIsXG4gICAgXCI4OTQ3XCI6IFwiaXNpbnN2O1wiLFxuICAgIFwiODk0OFwiOiBcImlzaW5zO1wiLFxuICAgIFwiODk0OVwiOiBcImlzaW5kb3Q7XCIsXG4gICAgXCI4OTUwXCI6IFwibm90aW52YztcIixcbiAgICBcIjg5NTFcIjogXCJub3RpbnZiO1wiLFxuICAgIFwiODk1M1wiOiBcImlzaW5FO1wiLFxuICAgIFwiODk1NFwiOiBcIm5pc2Q7XCIsXG4gICAgXCI4OTU1XCI6IFwieG5pcztcIixcbiAgICBcIjg5NTZcIjogXCJuaXM7XCIsXG4gICAgXCI4OTU3XCI6IFwibm90bml2YztcIixcbiAgICBcIjg5NThcIjogXCJub3RuaXZiO1wiLFxuICAgIFwiODk2NVwiOiBcImJhcndlZGdlO1wiLFxuICAgIFwiODk2NlwiOiBcImRvdWJsZWJhcndlZGdlO1wiLFxuICAgIFwiODk2OFwiOiBcIkxlZnRDZWlsaW5nO1wiLFxuICAgIFwiODk2OVwiOiBcIlJpZ2h0Q2VpbGluZztcIixcbiAgICBcIjg5NzBcIjogXCJsZmxvb3I7XCIsXG4gICAgXCI4OTcxXCI6IFwiUmlnaHRGbG9vcjtcIixcbiAgICBcIjg5NzJcIjogXCJkcmNyb3A7XCIsXG4gICAgXCI4OTczXCI6IFwiZGxjcm9wO1wiLFxuICAgIFwiODk3NFwiOiBcInVyY3JvcDtcIixcbiAgICBcIjg5NzVcIjogXCJ1bGNyb3A7XCIsXG4gICAgXCI4OTc2XCI6IFwiYm5vdDtcIixcbiAgICBcIjg5NzhcIjogXCJwcm9mbGluZTtcIixcbiAgICBcIjg5NzlcIjogXCJwcm9mc3VyZjtcIixcbiAgICBcIjg5ODFcIjogXCJ0ZWxyZWM7XCIsXG4gICAgXCI4OTgyXCI6IFwidGFyZ2V0O1wiLFxuICAgIFwiODk4OFwiOiBcInVsY29ybmVyO1wiLFxuICAgIFwiODk4OVwiOiBcInVyY29ybmVyO1wiLFxuICAgIFwiODk5MFwiOiBcImxsY29ybmVyO1wiLFxuICAgIFwiODk5MVwiOiBcImxyY29ybmVyO1wiLFxuICAgIFwiODk5NFwiOiBcInNmcm93bjtcIixcbiAgICBcIjg5OTVcIjogXCJzc21pbGU7XCIsXG4gICAgXCI5MDA1XCI6IFwiY3lsY3R5O1wiLFxuICAgIFwiOTAwNlwiOiBcInByb2ZhbGFyO1wiLFxuICAgIFwiOTAxNFwiOiBcInRvcGJvdDtcIixcbiAgICBcIjkwMjFcIjogXCJvdmJhcjtcIixcbiAgICBcIjkwMjNcIjogXCJzb2xiYXI7XCIsXG4gICAgXCI5MDg0XCI6IFwiYW5nemFycjtcIixcbiAgICBcIjkxMzZcIjogXCJsbW91c3RhY2hlO1wiLFxuICAgIFwiOTEzN1wiOiBcInJtb3VzdGFjaGU7XCIsXG4gICAgXCI5MTQwXCI6IFwidGJyaztcIixcbiAgICBcIjkxNDFcIjogXCJVbmRlckJyYWNrZXQ7XCIsXG4gICAgXCI5MTQyXCI6IFwiYmJya3Ricms7XCIsXG4gICAgXCI5MTgwXCI6IFwiT3ZlclBhcmVudGhlc2lzO1wiLFxuICAgIFwiOTE4MVwiOiBcIlVuZGVyUGFyZW50aGVzaXM7XCIsXG4gICAgXCI5MTgyXCI6IFwiT3ZlckJyYWNlO1wiLFxuICAgIFwiOTE4M1wiOiBcIlVuZGVyQnJhY2U7XCIsXG4gICAgXCI5MTg2XCI6IFwidHJwZXppdW07XCIsXG4gICAgXCI5MTkxXCI6IFwiZWxpbnRlcnM7XCIsXG4gICAgXCI5MjUxXCI6IFwiYmxhbms7XCIsXG4gICAgXCI5NDE2XCI6IFwib1M7XCIsXG4gICAgXCI5NDcyXCI6IFwiSG9yaXpvbnRhbExpbmU7XCIsXG4gICAgXCI5NDc0XCI6IFwiYm94djtcIixcbiAgICBcIjk0ODRcIjogXCJib3hkcjtcIixcbiAgICBcIjk0ODhcIjogXCJib3hkbDtcIixcbiAgICBcIjk0OTJcIjogXCJib3h1cjtcIixcbiAgICBcIjk0OTZcIjogXCJib3h1bDtcIixcbiAgICBcIjk1MDBcIjogXCJib3h2cjtcIixcbiAgICBcIjk1MDhcIjogXCJib3h2bDtcIixcbiAgICBcIjk1MTZcIjogXCJib3hoZDtcIixcbiAgICBcIjk1MjRcIjogXCJib3hodTtcIixcbiAgICBcIjk1MzJcIjogXCJib3h2aDtcIixcbiAgICBcIjk1NTJcIjogXCJib3hIO1wiLFxuICAgIFwiOTU1M1wiOiBcImJveFY7XCIsXG4gICAgXCI5NTU0XCI6IFwiYm94ZFI7XCIsXG4gICAgXCI5NTU1XCI6IFwiYm94RHI7XCIsXG4gICAgXCI5NTU2XCI6IFwiYm94RFI7XCIsXG4gICAgXCI5NTU3XCI6IFwiYm94ZEw7XCIsXG4gICAgXCI5NTU4XCI6IFwiYm94RGw7XCIsXG4gICAgXCI5NTU5XCI6IFwiYm94REw7XCIsXG4gICAgXCI5NTYwXCI6IFwiYm94dVI7XCIsXG4gICAgXCI5NTYxXCI6IFwiYm94VXI7XCIsXG4gICAgXCI5NTYyXCI6IFwiYm94VVI7XCIsXG4gICAgXCI5NTYzXCI6IFwiYm94dUw7XCIsXG4gICAgXCI5NTY0XCI6IFwiYm94VWw7XCIsXG4gICAgXCI5NTY1XCI6IFwiYm94VUw7XCIsXG4gICAgXCI5NTY2XCI6IFwiYm94dlI7XCIsXG4gICAgXCI5NTY3XCI6IFwiYm94VnI7XCIsXG4gICAgXCI5NTY4XCI6IFwiYm94VlI7XCIsXG4gICAgXCI5NTY5XCI6IFwiYm94dkw7XCIsXG4gICAgXCI5NTcwXCI6IFwiYm94Vmw7XCIsXG4gICAgXCI5NTcxXCI6IFwiYm94Vkw7XCIsXG4gICAgXCI5NTcyXCI6IFwiYm94SGQ7XCIsXG4gICAgXCI5NTczXCI6IFwiYm94aEQ7XCIsXG4gICAgXCI5NTc0XCI6IFwiYm94SEQ7XCIsXG4gICAgXCI5NTc1XCI6IFwiYm94SHU7XCIsXG4gICAgXCI5NTc2XCI6IFwiYm94aFU7XCIsXG4gICAgXCI5NTc3XCI6IFwiYm94SFU7XCIsXG4gICAgXCI5NTc4XCI6IFwiYm94dkg7XCIsXG4gICAgXCI5NTc5XCI6IFwiYm94Vmg7XCIsXG4gICAgXCI5NTgwXCI6IFwiYm94Vkg7XCIsXG4gICAgXCI5NjAwXCI6IFwidWhibGs7XCIsXG4gICAgXCI5NjA0XCI6IFwibGhibGs7XCIsXG4gICAgXCI5NjA4XCI6IFwiYmxvY2s7XCIsXG4gICAgXCI5NjE3XCI6IFwiYmxrMTQ7XCIsXG4gICAgXCI5NjE4XCI6IFwiYmxrMTI7XCIsXG4gICAgXCI5NjE5XCI6IFwiYmxrMzQ7XCIsXG4gICAgXCI5NjMzXCI6IFwic3F1YXJlO1wiLFxuICAgIFwiOTY0MlwiOiBcInNxdWY7XCIsXG4gICAgXCI5NjQzXCI6IFwiRW1wdHlWZXJ5U21hbGxTcXVhcmU7XCIsXG4gICAgXCI5NjQ1XCI6IFwicmVjdDtcIixcbiAgICBcIjk2NDZcIjogXCJtYXJrZXI7XCIsXG4gICAgXCI5NjQ5XCI6IFwiZmx0bnM7XCIsXG4gICAgXCI5NjUxXCI6IFwieHV0cmk7XCIsXG4gICAgXCI5NjUyXCI6IFwidXRyaWY7XCIsXG4gICAgXCI5NjUzXCI6IFwidXRyaTtcIixcbiAgICBcIjk2NTZcIjogXCJydHJpZjtcIixcbiAgICBcIjk2NTdcIjogXCJ0cmlhbmdsZXJpZ2h0O1wiLFxuICAgIFwiOTY2MVwiOiBcInhkdHJpO1wiLFxuICAgIFwiOTY2MlwiOiBcImR0cmlmO1wiLFxuICAgIFwiOTY2M1wiOiBcInRyaWFuZ2xlZG93bjtcIixcbiAgICBcIjk2NjZcIjogXCJsdHJpZjtcIixcbiAgICBcIjk2NjdcIjogXCJ0cmlhbmdsZWxlZnQ7XCIsXG4gICAgXCI5Njc0XCI6IFwibG96ZW5nZTtcIixcbiAgICBcIjk2NzVcIjogXCJjaXI7XCIsXG4gICAgXCI5NzA4XCI6IFwidHJpZG90O1wiLFxuICAgIFwiOTcxMVwiOiBcInhjaXJjO1wiLFxuICAgIFwiOTcyMFwiOiBcInVsdHJpO1wiLFxuICAgIFwiOTcyMVwiOiBcInVydHJpO1wiLFxuICAgIFwiOTcyMlwiOiBcImxsdHJpO1wiLFxuICAgIFwiOTcyM1wiOiBcIkVtcHR5U21hbGxTcXVhcmU7XCIsXG4gICAgXCI5NzI0XCI6IFwiRmlsbGVkU21hbGxTcXVhcmU7XCIsXG4gICAgXCI5NzMzXCI6IFwic3RhcmY7XCIsXG4gICAgXCI5NzM0XCI6IFwic3RhcjtcIixcbiAgICBcIjk3NDJcIjogXCJwaG9uZTtcIixcbiAgICBcIjk3OTJcIjogXCJmZW1hbGU7XCIsXG4gICAgXCI5Nzk0XCI6IFwibWFsZTtcIixcbiAgICBcIjk4MjRcIjogXCJzcGFkZXN1aXQ7XCIsXG4gICAgXCI5ODI3XCI6IFwiY2x1YnN1aXQ7XCIsXG4gICAgXCI5ODI5XCI6IFwiaGVhcnRzdWl0O1wiLFxuICAgIFwiOTgzMFwiOiBcImRpYW1zO1wiLFxuICAgIFwiOTgzNFwiOiBcInN1bmc7XCIsXG4gICAgXCI5ODM3XCI6IFwiZmxhdDtcIixcbiAgICBcIjk4MzhcIjogXCJuYXR1cmFsO1wiLFxuICAgIFwiOTgzOVwiOiBcInNoYXJwO1wiLFxuICAgIFwiMTAwMDNcIjogXCJjaGVja21hcms7XCIsXG4gICAgXCIxMDAwN1wiOiBcImNyb3NzO1wiLFxuICAgIFwiMTAwMTZcIjogXCJtYWx0ZXNlO1wiLFxuICAgIFwiMTAwMzhcIjogXCJzZXh0O1wiLFxuICAgIFwiMTAwNzJcIjogXCJWZXJ0aWNhbFNlcGFyYXRvcjtcIixcbiAgICBcIjEwMDk4XCI6IFwibGJicms7XCIsXG4gICAgXCIxMDA5OVwiOiBcInJiYnJrO1wiLFxuICAgIFwiMTAxODRcIjogXCJic29saHN1YjtcIixcbiAgICBcIjEwMTg1XCI6IFwic3VwaHNvbDtcIixcbiAgICBcIjEwMjE0XCI6IFwibG9icms7XCIsXG4gICAgXCIxMDIxNVwiOiBcInJvYnJrO1wiLFxuICAgIFwiMTAyMTZcIjogXCJMZWZ0QW5nbGVCcmFja2V0O1wiLFxuICAgIFwiMTAyMTdcIjogXCJSaWdodEFuZ2xlQnJhY2tldDtcIixcbiAgICBcIjEwMjE4XCI6IFwiTGFuZztcIixcbiAgICBcIjEwMjE5XCI6IFwiUmFuZztcIixcbiAgICBcIjEwMjIwXCI6IFwibG9hbmc7XCIsXG4gICAgXCIxMDIyMVwiOiBcInJvYW5nO1wiLFxuICAgIFwiMTAyMjlcIjogXCJ4bGFycjtcIixcbiAgICBcIjEwMjMwXCI6IFwieHJhcnI7XCIsXG4gICAgXCIxMDIzMVwiOiBcInhoYXJyO1wiLFxuICAgIFwiMTAyMzJcIjogXCJ4bEFycjtcIixcbiAgICBcIjEwMjMzXCI6IFwieHJBcnI7XCIsXG4gICAgXCIxMDIzNFwiOiBcInhoQXJyO1wiLFxuICAgIFwiMTAyMzZcIjogXCJ4bWFwO1wiLFxuICAgIFwiMTAyMzlcIjogXCJkemlncmFycjtcIixcbiAgICBcIjEwNDk4XCI6IFwibnZsQXJyO1wiLFxuICAgIFwiMTA0OTlcIjogXCJudnJBcnI7XCIsXG4gICAgXCIxMDUwMFwiOiBcIm52SGFycjtcIixcbiAgICBcIjEwNTAxXCI6IFwiTWFwO1wiLFxuICAgIFwiMTA1MDhcIjogXCJsYmFycjtcIixcbiAgICBcIjEwNTA5XCI6IFwicmJhcnI7XCIsXG4gICAgXCIxMDUxMFwiOiBcImxCYXJyO1wiLFxuICAgIFwiMTA1MTFcIjogXCJyQmFycjtcIixcbiAgICBcIjEwNTEyXCI6IFwiUkJhcnI7XCIsXG4gICAgXCIxMDUxM1wiOiBcIkREb3RyYWhkO1wiLFxuICAgIFwiMTA1MTRcIjogXCJVcEFycm93QmFyO1wiLFxuICAgIFwiMTA1MTVcIjogXCJEb3duQXJyb3dCYXI7XCIsXG4gICAgXCIxMDUxOFwiOiBcIlJhcnJ0bDtcIixcbiAgICBcIjEwNTIxXCI6IFwibGF0YWlsO1wiLFxuICAgIFwiMTA1MjJcIjogXCJyYXRhaWw7XCIsXG4gICAgXCIxMDUyM1wiOiBcImxBdGFpbDtcIixcbiAgICBcIjEwNTI0XCI6IFwickF0YWlsO1wiLFxuICAgIFwiMTA1MjVcIjogXCJsYXJyZnM7XCIsXG4gICAgXCIxMDUyNlwiOiBcInJhcnJmcztcIixcbiAgICBcIjEwNTI3XCI6IFwibGFycmJmcztcIixcbiAgICBcIjEwNTI4XCI6IFwicmFycmJmcztcIixcbiAgICBcIjEwNTMxXCI6IFwibndhcmhrO1wiLFxuICAgIFwiMTA1MzJcIjogXCJuZWFyaGs7XCIsXG4gICAgXCIxMDUzM1wiOiBcInNlYXJoaztcIixcbiAgICBcIjEwNTM0XCI6IFwic3dhcmhrO1wiLFxuICAgIFwiMTA1MzVcIjogXCJud25lYXI7XCIsXG4gICAgXCIxMDUzNlwiOiBcInRvZWE7XCIsXG4gICAgXCIxMDUzN1wiOiBcInRvc2E7XCIsXG4gICAgXCIxMDUzOFwiOiBcInN3bndhcjtcIixcbiAgICBcIjEwNTQ3XCI6IFwicmFycmM7XCIsXG4gICAgXCIxMDU0OVwiOiBcImN1ZGFycnI7XCIsXG4gICAgXCIxMDU1MFwiOiBcImxkY2E7XCIsXG4gICAgXCIxMDU1MVwiOiBcInJkY2E7XCIsXG4gICAgXCIxMDU1MlwiOiBcImN1ZGFycmw7XCIsXG4gICAgXCIxMDU1M1wiOiBcImxhcnJwbDtcIixcbiAgICBcIjEwNTU2XCI6IFwiY3VyYXJybTtcIixcbiAgICBcIjEwNTU3XCI6IFwiY3VsYXJycDtcIixcbiAgICBcIjEwNTY1XCI6IFwicmFycnBsO1wiLFxuICAgIFwiMTA1NjhcIjogXCJoYXJyY2lyO1wiLFxuICAgIFwiMTA1NjlcIjogXCJVYXJyb2NpcjtcIixcbiAgICBcIjEwNTcwXCI6IFwibHVyZHNoYXI7XCIsXG4gICAgXCIxMDU3MVwiOiBcImxkcnVzaGFyO1wiLFxuICAgIFwiMTA1NzRcIjogXCJMZWZ0UmlnaHRWZWN0b3I7XCIsXG4gICAgXCIxMDU3NVwiOiBcIlJpZ2h0VXBEb3duVmVjdG9yO1wiLFxuICAgIFwiMTA1NzZcIjogXCJEb3duTGVmdFJpZ2h0VmVjdG9yO1wiLFxuICAgIFwiMTA1NzdcIjogXCJMZWZ0VXBEb3duVmVjdG9yO1wiLFxuICAgIFwiMTA1NzhcIjogXCJMZWZ0VmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1NzlcIjogXCJSaWdodFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTgwXCI6IFwiUmlnaHRVcFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTgxXCI6IFwiUmlnaHREb3duVmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODJcIjogXCJEb3duTGVmdFZlY3RvckJhcjtcIixcbiAgICBcIjEwNTgzXCI6IFwiRG93blJpZ2h0VmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODRcIjogXCJMZWZ0VXBWZWN0b3JCYXI7XCIsXG4gICAgXCIxMDU4NVwiOiBcIkxlZnREb3duVmVjdG9yQmFyO1wiLFxuICAgIFwiMTA1ODZcIjogXCJMZWZ0VGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1ODdcIjogXCJSaWdodFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTg4XCI6IFwiUmlnaHRVcFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTg5XCI6IFwiUmlnaHREb3duVGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1OTBcIjogXCJEb3duTGVmdFRlZVZlY3RvcjtcIixcbiAgICBcIjEwNTkxXCI6IFwiRG93blJpZ2h0VGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1OTJcIjogXCJMZWZ0VXBUZWVWZWN0b3I7XCIsXG4gICAgXCIxMDU5M1wiOiBcIkxlZnREb3duVGVlVmVjdG9yO1wiLFxuICAgIFwiMTA1OTRcIjogXCJsSGFyO1wiLFxuICAgIFwiMTA1OTVcIjogXCJ1SGFyO1wiLFxuICAgIFwiMTA1OTZcIjogXCJySGFyO1wiLFxuICAgIFwiMTA1OTdcIjogXCJkSGFyO1wiLFxuICAgIFwiMTA1OThcIjogXCJsdXJ1aGFyO1wiLFxuICAgIFwiMTA1OTlcIjogXCJsZHJkaGFyO1wiLFxuICAgIFwiMTA2MDBcIjogXCJydWx1aGFyO1wiLFxuICAgIFwiMTA2MDFcIjogXCJyZGxkaGFyO1wiLFxuICAgIFwiMTA2MDJcIjogXCJsaGFydWw7XCIsXG4gICAgXCIxMDYwM1wiOiBcImxsaGFyZDtcIixcbiAgICBcIjEwNjA0XCI6IFwicmhhcnVsO1wiLFxuICAgIFwiMTA2MDVcIjogXCJscmhhcmQ7XCIsXG4gICAgXCIxMDYwNlwiOiBcIlVwRXF1aWxpYnJpdW07XCIsXG4gICAgXCIxMDYwN1wiOiBcIlJldmVyc2VVcEVxdWlsaWJyaXVtO1wiLFxuICAgIFwiMTA2MDhcIjogXCJSb3VuZEltcGxpZXM7XCIsXG4gICAgXCIxMDYwOVwiOiBcImVyYXJyO1wiLFxuICAgIFwiMTA2MTBcIjogXCJzaW1yYXJyO1wiLFxuICAgIFwiMTA2MTFcIjogXCJsYXJyc2ltO1wiLFxuICAgIFwiMTA2MTJcIjogXCJyYXJyc2ltO1wiLFxuICAgIFwiMTA2MTNcIjogXCJyYXJyYXA7XCIsXG4gICAgXCIxMDYxNFwiOiBcImx0bGFycjtcIixcbiAgICBcIjEwNjE2XCI6IFwiZ3RyYXJyO1wiLFxuICAgIFwiMTA2MTdcIjogXCJzdWJyYXJyO1wiLFxuICAgIFwiMTA2MTlcIjogXCJzdXBsYXJyO1wiLFxuICAgIFwiMTA2MjBcIjogXCJsZmlzaHQ7XCIsXG4gICAgXCIxMDYyMVwiOiBcInJmaXNodDtcIixcbiAgICBcIjEwNjIyXCI6IFwidWZpc2h0O1wiLFxuICAgIFwiMTA2MjNcIjogXCJkZmlzaHQ7XCIsXG4gICAgXCIxMDYyOVwiOiBcImxvcGFyO1wiLFxuICAgIFwiMTA2MzBcIjogXCJyb3BhcjtcIixcbiAgICBcIjEwNjM1XCI6IFwibGJya2U7XCIsXG4gICAgXCIxMDYzNlwiOiBcInJicmtlO1wiLFxuICAgIFwiMTA2MzdcIjogXCJsYnJrc2x1O1wiLFxuICAgIFwiMTA2MzhcIjogXCJyYnJrc2xkO1wiLFxuICAgIFwiMTA2MzlcIjogXCJsYnJrc2xkO1wiLFxuICAgIFwiMTA2NDBcIjogXCJyYnJrc2x1O1wiLFxuICAgIFwiMTA2NDFcIjogXCJsYW5nZDtcIixcbiAgICBcIjEwNjQyXCI6IFwicmFuZ2Q7XCIsXG4gICAgXCIxMDY0M1wiOiBcImxwYXJsdDtcIixcbiAgICBcIjEwNjQ0XCI6IFwicnBhcmd0O1wiLFxuICAgIFwiMTA2NDVcIjogXCJndGxQYXI7XCIsXG4gICAgXCIxMDY0NlwiOiBcImx0clBhcjtcIixcbiAgICBcIjEwNjUwXCI6IFwidnppZ3phZztcIixcbiAgICBcIjEwNjUyXCI6IFwidmFuZ3J0O1wiLFxuICAgIFwiMTA2NTNcIjogXCJhbmdydHZiZDtcIixcbiAgICBcIjEwNjYwXCI6IFwiYW5nZTtcIixcbiAgICBcIjEwNjYxXCI6IFwicmFuZ2U7XCIsXG4gICAgXCIxMDY2MlwiOiBcImR3YW5nbGU7XCIsXG4gICAgXCIxMDY2M1wiOiBcInV3YW5nbGU7XCIsXG4gICAgXCIxMDY2NFwiOiBcImFuZ21zZGFhO1wiLFxuICAgIFwiMTA2NjVcIjogXCJhbmdtc2RhYjtcIixcbiAgICBcIjEwNjY2XCI6IFwiYW5nbXNkYWM7XCIsXG4gICAgXCIxMDY2N1wiOiBcImFuZ21zZGFkO1wiLFxuICAgIFwiMTA2NjhcIjogXCJhbmdtc2RhZTtcIixcbiAgICBcIjEwNjY5XCI6IFwiYW5nbXNkYWY7XCIsXG4gICAgXCIxMDY3MFwiOiBcImFuZ21zZGFnO1wiLFxuICAgIFwiMTA2NzFcIjogXCJhbmdtc2RhaDtcIixcbiAgICBcIjEwNjcyXCI6IFwiYmVtcHR5djtcIixcbiAgICBcIjEwNjczXCI6IFwiZGVtcHR5djtcIixcbiAgICBcIjEwNjc0XCI6IFwiY2VtcHR5djtcIixcbiAgICBcIjEwNjc1XCI6IFwicmFlbXB0eXY7XCIsXG4gICAgXCIxMDY3NlwiOiBcImxhZW1wdHl2O1wiLFxuICAgIFwiMTA2NzdcIjogXCJvaGJhcjtcIixcbiAgICBcIjEwNjc4XCI6IFwib21pZDtcIixcbiAgICBcIjEwNjc5XCI6IFwib3BhcjtcIixcbiAgICBcIjEwNjgxXCI6IFwib3BlcnA7XCIsXG4gICAgXCIxMDY4M1wiOiBcIm9sY3Jvc3M7XCIsXG4gICAgXCIxMDY4NFwiOiBcIm9kc29sZDtcIixcbiAgICBcIjEwNjg2XCI6IFwib2xjaXI7XCIsXG4gICAgXCIxMDY4N1wiOiBcIm9mY2lyO1wiLFxuICAgIFwiMTA2ODhcIjogXCJvbHQ7XCIsXG4gICAgXCIxMDY4OVwiOiBcIm9ndDtcIixcbiAgICBcIjEwNjkwXCI6IFwiY2lyc2NpcjtcIixcbiAgICBcIjEwNjkxXCI6IFwiY2lyRTtcIixcbiAgICBcIjEwNjkyXCI6IFwic29sYjtcIixcbiAgICBcIjEwNjkzXCI6IFwiYnNvbGI7XCIsXG4gICAgXCIxMDY5N1wiOiBcImJveGJveDtcIixcbiAgICBcIjEwNzAxXCI6IFwidHJpc2I7XCIsXG4gICAgXCIxMDcwMlwiOiBcInJ0cmlsdHJpO1wiLFxuICAgIFwiMTA3MDNcIjogXCJMZWZ0VHJpYW5nbGVCYXI7XCIsXG4gICAgXCIxMDcwNFwiOiBcIlJpZ2h0VHJpYW5nbGVCYXI7XCIsXG4gICAgXCIxMDcxNlwiOiBcImlpbmZpbjtcIixcbiAgICBcIjEwNzE3XCI6IFwiaW5maW50aWU7XCIsXG4gICAgXCIxMDcxOFwiOiBcIm52aW5maW47XCIsXG4gICAgXCIxMDcyM1wiOiBcImVwYXJzbDtcIixcbiAgICBcIjEwNzI0XCI6IFwic21lcGFyc2w7XCIsXG4gICAgXCIxMDcyNVwiOiBcImVxdnBhcnNsO1wiLFxuICAgIFwiMTA3MzFcIjogXCJsb3pmO1wiLFxuICAgIFwiMTA3NDBcIjogXCJSdWxlRGVsYXllZDtcIixcbiAgICBcIjEwNzQyXCI6IFwiZHNvbDtcIixcbiAgICBcIjEwNzUyXCI6IFwieG9kb3Q7XCIsXG4gICAgXCIxMDc1M1wiOiBcInhvcGx1cztcIixcbiAgICBcIjEwNzU0XCI6IFwieG90aW1lO1wiLFxuICAgIFwiMTA3NTZcIjogXCJ4dXBsdXM7XCIsXG4gICAgXCIxMDc1OFwiOiBcInhzcWN1cDtcIixcbiAgICBcIjEwNzY0XCI6IFwicWludDtcIixcbiAgICBcIjEwNzY1XCI6IFwiZnBhcnRpbnQ7XCIsXG4gICAgXCIxMDc2OFwiOiBcImNpcmZuaW50O1wiLFxuICAgIFwiMTA3NjlcIjogXCJhd2ludDtcIixcbiAgICBcIjEwNzcwXCI6IFwicnBwb2xpbnQ7XCIsXG4gICAgXCIxMDc3MVwiOiBcInNjcG9saW50O1wiLFxuICAgIFwiMTA3NzJcIjogXCJucG9saW50O1wiLFxuICAgIFwiMTA3NzNcIjogXCJwb2ludGludDtcIixcbiAgICBcIjEwNzc0XCI6IFwicXVhdGludDtcIixcbiAgICBcIjEwNzc1XCI6IFwiaW50bGFyaGs7XCIsXG4gICAgXCIxMDc4NlwiOiBcInBsdXNjaXI7XCIsXG4gICAgXCIxMDc4N1wiOiBcInBsdXNhY2lyO1wiLFxuICAgIFwiMTA3ODhcIjogXCJzaW1wbHVzO1wiLFxuICAgIFwiMTA3ODlcIjogXCJwbHVzZHU7XCIsXG4gICAgXCIxMDc5MFwiOiBcInBsdXNzaW07XCIsXG4gICAgXCIxMDc5MVwiOiBcInBsdXN0d287XCIsXG4gICAgXCIxMDc5M1wiOiBcIm1jb21tYTtcIixcbiAgICBcIjEwNzk0XCI6IFwibWludXNkdTtcIixcbiAgICBcIjEwNzk3XCI6IFwibG9wbHVzO1wiLFxuICAgIFwiMTA3OThcIjogXCJyb3BsdXM7XCIsXG4gICAgXCIxMDc5OVwiOiBcIkNyb3NzO1wiLFxuICAgIFwiMTA4MDBcIjogXCJ0aW1lc2Q7XCIsXG4gICAgXCIxMDgwMVwiOiBcInRpbWVzYmFyO1wiLFxuICAgIFwiMTA4MDNcIjogXCJzbWFzaHA7XCIsXG4gICAgXCIxMDgwNFwiOiBcImxvdGltZXM7XCIsXG4gICAgXCIxMDgwNVwiOiBcInJvdGltZXM7XCIsXG4gICAgXCIxMDgwNlwiOiBcIm90aW1lc2FzO1wiLFxuICAgIFwiMTA4MDdcIjogXCJPdGltZXM7XCIsXG4gICAgXCIxMDgwOFwiOiBcIm9kaXY7XCIsXG4gICAgXCIxMDgwOVwiOiBcInRyaXBsdXM7XCIsXG4gICAgXCIxMDgxMFwiOiBcInRyaW1pbnVzO1wiLFxuICAgIFwiMTA4MTFcIjogXCJ0cml0aW1lO1wiLFxuICAgIFwiMTA4MTJcIjogXCJpcHJvZDtcIixcbiAgICBcIjEwODE1XCI6IFwiYW1hbGc7XCIsXG4gICAgXCIxMDgxNlwiOiBcImNhcGRvdDtcIixcbiAgICBcIjEwODE4XCI6IFwibmN1cDtcIixcbiAgICBcIjEwODE5XCI6IFwibmNhcDtcIixcbiAgICBcIjEwODIwXCI6IFwiY2FwYW5kO1wiLFxuICAgIFwiMTA4MjFcIjogXCJjdXBvcjtcIixcbiAgICBcIjEwODIyXCI6IFwiY3VwY2FwO1wiLFxuICAgIFwiMTA4MjNcIjogXCJjYXBjdXA7XCIsXG4gICAgXCIxMDgyNFwiOiBcImN1cGJyY2FwO1wiLFxuICAgIFwiMTA4MjVcIjogXCJjYXBicmN1cDtcIixcbiAgICBcIjEwODI2XCI6IFwiY3VwY3VwO1wiLFxuICAgIFwiMTA4MjdcIjogXCJjYXBjYXA7XCIsXG4gICAgXCIxMDgyOFwiOiBcImNjdXBzO1wiLFxuICAgIFwiMTA4MjlcIjogXCJjY2FwcztcIixcbiAgICBcIjEwODMyXCI6IFwiY2N1cHNzbTtcIixcbiAgICBcIjEwODM1XCI6IFwiQW5kO1wiLFxuICAgIFwiMTA4MzZcIjogXCJPcjtcIixcbiAgICBcIjEwODM3XCI6IFwiYW5kYW5kO1wiLFxuICAgIFwiMTA4MzhcIjogXCJvcm9yO1wiLFxuICAgIFwiMTA4MzlcIjogXCJvcnNsb3BlO1wiLFxuICAgIFwiMTA4NDBcIjogXCJhbmRzbG9wZTtcIixcbiAgICBcIjEwODQyXCI6IFwiYW5kdjtcIixcbiAgICBcIjEwODQzXCI6IFwib3J2O1wiLFxuICAgIFwiMTA4NDRcIjogXCJhbmRkO1wiLFxuICAgIFwiMTA4NDVcIjogXCJvcmQ7XCIsXG4gICAgXCIxMDg0N1wiOiBcIndlZGJhcjtcIixcbiAgICBcIjEwODU0XCI6IFwic2RvdGU7XCIsXG4gICAgXCIxMDg1OFwiOiBcInNpbWRvdDtcIixcbiAgICBcIjEwODYxXCI6IFwiY29uZ2RvdDtcIixcbiAgICBcIjEwODYyXCI6IFwiZWFzdGVyO1wiLFxuICAgIFwiMTA4NjNcIjogXCJhcGFjaXI7XCIsXG4gICAgXCIxMDg2NFwiOiBcImFwRTtcIixcbiAgICBcIjEwODY1XCI6IFwiZXBsdXM7XCIsXG4gICAgXCIxMDg2NlwiOiBcInBsdXNlO1wiLFxuICAgIFwiMTA4NjdcIjogXCJFc2ltO1wiLFxuICAgIFwiMTA4NjhcIjogXCJDb2xvbmU7XCIsXG4gICAgXCIxMDg2OVwiOiBcIkVxdWFsO1wiLFxuICAgIFwiMTA4NzFcIjogXCJlRERvdDtcIixcbiAgICBcIjEwODcyXCI6IFwiZXF1aXZERDtcIixcbiAgICBcIjEwODczXCI6IFwibHRjaXI7XCIsXG4gICAgXCIxMDg3NFwiOiBcImd0Y2lyO1wiLFxuICAgIFwiMTA4NzVcIjogXCJsdHF1ZXN0O1wiLFxuICAgIFwiMTA4NzZcIjogXCJndHF1ZXN0O1wiLFxuICAgIFwiMTA4NzdcIjogXCJMZXNzU2xhbnRFcXVhbDtcIixcbiAgICBcIjEwODc4XCI6IFwiR3JlYXRlclNsYW50RXF1YWw7XCIsXG4gICAgXCIxMDg3OVwiOiBcImxlc2RvdDtcIixcbiAgICBcIjEwODgwXCI6IFwiZ2VzZG90O1wiLFxuICAgIFwiMTA4ODFcIjogXCJsZXNkb3RvO1wiLFxuICAgIFwiMTA4ODJcIjogXCJnZXNkb3RvO1wiLFxuICAgIFwiMTA4ODNcIjogXCJsZXNkb3RvcjtcIixcbiAgICBcIjEwODg0XCI6IFwiZ2VzZG90b2w7XCIsXG4gICAgXCIxMDg4NVwiOiBcImxlc3NhcHByb3g7XCIsXG4gICAgXCIxMDg4NlwiOiBcImd0cmFwcHJveDtcIixcbiAgICBcIjEwODg3XCI6IFwibG5lcTtcIixcbiAgICBcIjEwODg4XCI6IFwiZ25lcTtcIixcbiAgICBcIjEwODg5XCI6IFwibG5hcHByb3g7XCIsXG4gICAgXCIxMDg5MFwiOiBcImduYXBwcm94O1wiLFxuICAgIFwiMTA4OTFcIjogXCJsZXNzZXFxZ3RyO1wiLFxuICAgIFwiMTA4OTJcIjogXCJndHJlcXFsZXNzO1wiLFxuICAgIFwiMTA4OTNcIjogXCJsc2ltZTtcIixcbiAgICBcIjEwODk0XCI6IFwiZ3NpbWU7XCIsXG4gICAgXCIxMDg5NVwiOiBcImxzaW1nO1wiLFxuICAgIFwiMTA4OTZcIjogXCJnc2ltbDtcIixcbiAgICBcIjEwODk3XCI6IFwibGdFO1wiLFxuICAgIFwiMTA4OThcIjogXCJnbEU7XCIsXG4gICAgXCIxMDg5OVwiOiBcImxlc2dlcztcIixcbiAgICBcIjEwOTAwXCI6IFwiZ2VzbGVzO1wiLFxuICAgIFwiMTA5MDFcIjogXCJlcXNsYW50bGVzcztcIixcbiAgICBcIjEwOTAyXCI6IFwiZXFzbGFudGd0cjtcIixcbiAgICBcIjEwOTAzXCI6IFwiZWxzZG90O1wiLFxuICAgIFwiMTA5MDRcIjogXCJlZ3Nkb3Q7XCIsXG4gICAgXCIxMDkwNVwiOiBcImVsO1wiLFxuICAgIFwiMTA5MDZcIjogXCJlZztcIixcbiAgICBcIjEwOTA5XCI6IFwic2ltbDtcIixcbiAgICBcIjEwOTEwXCI6IFwic2ltZztcIixcbiAgICBcIjEwOTExXCI6IFwic2ltbEU7XCIsXG4gICAgXCIxMDkxMlwiOiBcInNpbWdFO1wiLFxuICAgIFwiMTA5MTNcIjogXCJMZXNzTGVzcztcIixcbiAgICBcIjEwOTE0XCI6IFwiR3JlYXRlckdyZWF0ZXI7XCIsXG4gICAgXCIxMDkxNlwiOiBcImdsajtcIixcbiAgICBcIjEwOTE3XCI6IFwiZ2xhO1wiLFxuICAgIFwiMTA5MThcIjogXCJsdGNjO1wiLFxuICAgIFwiMTA5MTlcIjogXCJndGNjO1wiLFxuICAgIFwiMTA5MjBcIjogXCJsZXNjYztcIixcbiAgICBcIjEwOTIxXCI6IFwiZ2VzY2M7XCIsXG4gICAgXCIxMDkyMlwiOiBcInNtdDtcIixcbiAgICBcIjEwOTIzXCI6IFwibGF0O1wiLFxuICAgIFwiMTA5MjRcIjogXCJzbXRlO1wiLFxuICAgIFwiMTA5MjVcIjogXCJsYXRlO1wiLFxuICAgIFwiMTA5MjZcIjogXCJidW1wRTtcIixcbiAgICBcIjEwOTI3XCI6IFwicHJlY2VxO1wiLFxuICAgIFwiMTA5MjhcIjogXCJzdWNjZXE7XCIsXG4gICAgXCIxMDkzMVwiOiBcInByRTtcIixcbiAgICBcIjEwOTMyXCI6IFwic2NFO1wiLFxuICAgIFwiMTA5MzNcIjogXCJwcm5FO1wiLFxuICAgIFwiMTA5MzRcIjogXCJzdWNjbmVxcTtcIixcbiAgICBcIjEwOTM1XCI6IFwicHJlY2FwcHJveDtcIixcbiAgICBcIjEwOTM2XCI6IFwic3VjY2FwcHJveDtcIixcbiAgICBcIjEwOTM3XCI6IFwicHJuYXA7XCIsXG4gICAgXCIxMDkzOFwiOiBcInN1Y2NuYXBwcm94O1wiLFxuICAgIFwiMTA5MzlcIjogXCJQcjtcIixcbiAgICBcIjEwOTQwXCI6IFwiU2M7XCIsXG4gICAgXCIxMDk0MVwiOiBcInN1YmRvdDtcIixcbiAgICBcIjEwOTQyXCI6IFwic3VwZG90O1wiLFxuICAgIFwiMTA5NDNcIjogXCJzdWJwbHVzO1wiLFxuICAgIFwiMTA5NDRcIjogXCJzdXBwbHVzO1wiLFxuICAgIFwiMTA5NDVcIjogXCJzdWJtdWx0O1wiLFxuICAgIFwiMTA5NDZcIjogXCJzdXBtdWx0O1wiLFxuICAgIFwiMTA5NDdcIjogXCJzdWJlZG90O1wiLFxuICAgIFwiMTA5NDhcIjogXCJzdXBlZG90O1wiLFxuICAgIFwiMTA5NDlcIjogXCJzdWJzZXRlcXE7XCIsXG4gICAgXCIxMDk1MFwiOiBcInN1cHNldGVxcTtcIixcbiAgICBcIjEwOTUxXCI6IFwic3Vic2ltO1wiLFxuICAgIFwiMTA5NTJcIjogXCJzdXBzaW07XCIsXG4gICAgXCIxMDk1NVwiOiBcInN1YnNldG5lcXE7XCIsXG4gICAgXCIxMDk1NlwiOiBcInN1cHNldG5lcXE7XCIsXG4gICAgXCIxMDk1OVwiOiBcImNzdWI7XCIsXG4gICAgXCIxMDk2MFwiOiBcImNzdXA7XCIsXG4gICAgXCIxMDk2MVwiOiBcImNzdWJlO1wiLFxuICAgIFwiMTA5NjJcIjogXCJjc3VwZTtcIixcbiAgICBcIjEwOTYzXCI6IFwic3Vic3VwO1wiLFxuICAgIFwiMTA5NjRcIjogXCJzdXBzdWI7XCIsXG4gICAgXCIxMDk2NVwiOiBcInN1YnN1YjtcIixcbiAgICBcIjEwOTY2XCI6IFwic3Vwc3VwO1wiLFxuICAgIFwiMTA5NjdcIjogXCJzdXBoc3ViO1wiLFxuICAgIFwiMTA5NjhcIjogXCJzdXBkc3ViO1wiLFxuICAgIFwiMTA5NjlcIjogXCJmb3JrdjtcIixcbiAgICBcIjEwOTcwXCI6IFwidG9wZm9yaztcIixcbiAgICBcIjEwOTcxXCI6IFwibWxjcDtcIixcbiAgICBcIjEwOTgwXCI6IFwiRG91YmxlTGVmdFRlZTtcIixcbiAgICBcIjEwOTgyXCI6IFwiVmRhc2hsO1wiLFxuICAgIFwiMTA5ODNcIjogXCJCYXJ2O1wiLFxuICAgIFwiMTA5ODRcIjogXCJ2QmFyO1wiLFxuICAgIFwiMTA5ODVcIjogXCJ2QmFydjtcIixcbiAgICBcIjEwOTg3XCI6IFwiVmJhcjtcIixcbiAgICBcIjEwOTg4XCI6IFwiTm90O1wiLFxuICAgIFwiMTA5ODlcIjogXCJiTm90O1wiLFxuICAgIFwiMTA5OTBcIjogXCJybm1pZDtcIixcbiAgICBcIjEwOTkxXCI6IFwiY2lybWlkO1wiLFxuICAgIFwiMTA5OTJcIjogXCJtaWRjaXI7XCIsXG4gICAgXCIxMDk5M1wiOiBcInRvcGNpcjtcIixcbiAgICBcIjEwOTk0XCI6IFwibmhwYXI7XCIsXG4gICAgXCIxMDk5NVwiOiBcInBhcnNpbTtcIixcbiAgICBcIjExMDA1XCI6IFwicGFyc2w7XCIsXG4gICAgXCI2NDI1NlwiOiBcImZmbGlnO1wiLFxuICAgIFwiNjQyNTdcIjogXCJmaWxpZztcIixcbiAgICBcIjY0MjU4XCI6IFwiZmxsaWc7XCIsXG4gICAgXCI2NDI1OVwiOiBcImZmaWxpZztcIixcbiAgICBcIjY0MjYwXCI6IFwiZmZsbGlnO1wiXG59IiwiQW5hbHl0aWNzICAgID0gcmVxdWlyZSAnLi91dGlscy9BbmFseXRpY3MnXG5BdXRoTWFuYWdlciAgPSByZXF1aXJlICcuL3V0aWxzL0F1dGhNYW5hZ2VyJ1xuU2hhcmUgICAgICAgID0gcmVxdWlyZSAnLi91dGlscy9TaGFyZSdcbkZhY2Vib29rICAgICA9IHJlcXVpcmUgJy4vdXRpbHMvRmFjZWJvb2snXG5Hb29nbGVQbHVzICAgPSByZXF1aXJlICcuL3V0aWxzL0dvb2dsZVBsdXMnXG5UZW1wbGF0ZXMgICAgPSByZXF1aXJlICcuL2RhdGEvVGVtcGxhdGVzJ1xuTG9jYWxlICAgICAgID0gcmVxdWlyZSAnLi9kYXRhL0xvY2FsZSdcblJvdXRlciAgICAgICA9IHJlcXVpcmUgJy4vcm91dGVyL1JvdXRlcidcbk5hdiAgICAgICAgICA9IHJlcXVpcmUgJy4vcm91dGVyL05hdidcbkFwcERhdGEgICAgICA9IHJlcXVpcmUgJy4vQXBwRGF0YSdcbkFwcFZpZXcgICAgICA9IHJlcXVpcmUgJy4vQXBwVmlldydcbk1lZGlhUXVlcmllcyA9IHJlcXVpcmUgJy4vdXRpbHMvTWVkaWFRdWVyaWVzJ1xuXG5jbGFzcyBBcHBcblxuICAgIExJVkUgICAgICAgIDogbnVsbFxuICAgIFNJVEVfVVJMICAgIDogd2luZG93LmNvbmZpZy5TSVRFX1VSTFxuICAgIEJBU0VfVVJMICAgIDogd2luZG93LmNvbmZpZy5ob3N0bmFtZVxuICAgIEFTU0VUU19VUkwgIDogd2luZG93LmNvbmZpZy5hc3NldHNfdXJsXG4gICAgRE9PRExFU19VUkwgOiB3aW5kb3cuY29uZmlnLmRvb2RsZXNfdXJsXG4gICAgQVBJX0hPU1QgICAgOiB3aW5kb3cuY29uZmlnLkFQSV9IT1NUXG4gICAgbG9jYWxlQ29kZSAgOiB3aW5kb3cuY29uZmlnLmxvY2FsZUNvZGVcbiAgICBvYmpSZWFkeSAgICA6IDBcblxuICAgIF90b0NsZWFuICAgOiBbJ29ialJlYWR5JywgJ3NldEZsYWdzJywgJ29iamVjdENvbXBsZXRlJywgJ2luaXQnLCAnaW5pdE9iamVjdHMnLCAnaW5pdFNES3MnLCAnaW5pdEFwcCcsICdnbycsICdjbGVhbnVwJywgJ190b0NsZWFuJ11cblxuICAgIGNvbnN0cnVjdG9yIDogKEBMSVZFKSAtPlxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBzZXRGbGFncyA6ID0+XG5cbiAgICAgICAgdWEgPSB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpXG5cbiAgICAgICAgTWVkaWFRdWVyaWVzLnNldHVwKCk7XG5cbiAgICAgICAgQElTX0FORFJPSUQgICAgPSB1YS5pbmRleE9mKCdhbmRyb2lkJykgPiAtMVxuICAgICAgICBASVNfRklSRUZPWCAgICA9IHVhLmluZGV4T2YoJ2ZpcmVmb3gnKSA+IC0xXG4gICAgICAgIEBJU19DSFJPTUVfSU9TID0gaWYgdWEubWF0Y2goJ2NyaW9zJykgdGhlbiB0cnVlIGVsc2UgZmFsc2UgIyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xMzgwODA1M1xuXG4gICAgICAgIG51bGxcblxuICAgIG9iamVjdENvbXBsZXRlIDogPT5cblxuICAgICAgICBAb2JqUmVhZHkrK1xuICAgICAgICBAaW5pdEFwcCgpIGlmIEBvYmpSZWFkeSA+PSA0XG5cbiAgICAgICAgbnVsbFxuXG4gICAgaW5pdCA6ID0+XG5cbiAgICAgICAgQGluaXRPYmplY3RzKClcblxuICAgICAgICBudWxsXG5cbiAgICBpbml0T2JqZWN0cyA6ID0+XG5cbiAgICAgICAgQGFwcERhdGEgICA9IG5ldyBBcHBEYXRhIEBvYmplY3RDb21wbGV0ZVxuICAgICAgICBAdGVtcGxhdGVzID0gbmV3IFRlbXBsYXRlcyB3aW5kb3cuX1RFTVBMQVRFUywgQG9iamVjdENvbXBsZXRlXG4gICAgICAgIEBsb2NhbGUgICAgPSBuZXcgTG9jYWxlIHdpbmRvdy5fTE9DQUxFX1NUUklOR1MsIEBvYmplY3RDb21wbGV0ZVxuICAgICAgICBAYW5hbHl0aWNzID0gbmV3IEFuYWx5dGljcyB3aW5kb3cuX1RSQUNLSU5HLCBAb2JqZWN0Q29tcGxldGVcblxuICAgICAgICAjIGlmIG5ldyBvYmplY3RzIGFyZSBhZGRlZCBkb24ndCBmb3JnZXQgdG8gY2hhbmdlIHRoZSBgQG9iamVjdENvbXBsZXRlYCBmdW5jdGlvblxuXG4gICAgICAgIG51bGxcblxuICAgIGluaXRTREtzIDogPT5cblxuICAgICAgICBGYWNlYm9vay5sb2FkKClcbiAgICAgICAgR29vZ2xlUGx1cy5sb2FkKClcblxuICAgICAgICBudWxsXG5cbiAgICBpbml0QXBwIDogPT5cblxuICAgICAgICBAc2V0RmxhZ3MoKVxuXG4gICAgICAgICMjIyBTdGFydHMgYXBwbGljYXRpb24gIyMjXG4gICAgICAgIEBhcHBWaWV3ID0gbmV3IEFwcFZpZXdcbiAgICAgICAgQHJvdXRlciAgPSBuZXcgUm91dGVyXG4gICAgICAgIEBuYXYgICAgID0gbmV3IE5hdlxuICAgICAgICBAYXV0aCAgICA9IG5ldyBBdXRoTWFuYWdlclxuICAgICAgICBAc2hhcmUgICA9IG5ldyBTaGFyZVxuXG4gICAgICAgIEBnbygpXG5cbiAgICAgICAgQGluaXRTREtzKClcblxuICAgICAgICBudWxsXG5cbiAgICBnbyA6ID0+XG5cbiAgICAgICAgIyMjIEFmdGVyIGV2ZXJ5dGhpbmcgaXMgbG9hZGVkLCBraWNrcyBvZmYgd2Vic2l0ZSAjIyNcbiAgICAgICAgQGFwcFZpZXcucmVuZGVyKClcblxuICAgICAgICAjIyMgcmVtb3ZlIHJlZHVuZGFudCBpbml0aWFsaXNhdGlvbiBtZXRob2RzIC8gcHJvcGVydGllcyAjIyNcbiAgICAgICAgQGNsZWFudXAoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGNsZWFudXAgOiA9PlxuXG4gICAgICAgIGZvciBmbiBpbiBAX3RvQ2xlYW5cbiAgICAgICAgICAgIEBbZm5dID0gbnVsbFxuICAgICAgICAgICAgZGVsZXRlIEBbZm5dXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFwcFxuIiwiQWJzdHJhY3REYXRhICAgICAgPSByZXF1aXJlICcuL2RhdGEvQWJzdHJhY3REYXRhJ1xuUmVxdWVzdGVyICAgICAgICAgPSByZXF1aXJlICcuL3V0aWxzL1JlcXVlc3RlcidcbkFQSSAgICAgICAgICAgICAgID0gcmVxdWlyZSAnLi9kYXRhL0FQSSdcbkRvb2RsZXNDb2xsZWN0aW9uID0gcmVxdWlyZSAnLi9jb2xsZWN0aW9ucy9kb29kbGVzL0Rvb2RsZXNDb2xsZWN0aW9uJ1xuXG5jbGFzcyBBcHBEYXRhIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cbiAgICBjYWxsYmFjayA6IG51bGxcblxuICAgIERPT0RMRV9DQUNIRV9EVVJBVElPTiA6ICgoKDEwMDAgKiA2MCkgKiA2MCkgKiAyNCkgIyAyNGhyc1xuXG4gICAgY29uc3RydWN0b3IgOiAoQGNhbGxiYWNrKSAtPlxuXG4gICAgICAgIHN1cGVyKClcblxuICAgICAgICBAZG9vZGxlcyA9IG5ldyBEb29kbGVzQ29sbGVjdGlvblxuXG4gICAgICAgIEBjaGVja0Rvb2RsZUNhY2hlKClcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgY2hlY2tEb29kbGVDYWNoZSA6ID0+XG5cbiAgICAgICAgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQgbnVsbCwgKGNhY2hlZERhdGEpID0+XG5cbiAgICAgICAgICAgIGlmIF8uaXNFbXB0eSBjYWNoZWREYXRhXG4gICAgICAgICAgICAgICAgcmV0dXJuIEBmZXRjaERvb2RsZXMoKVxuXG4gICAgICAgICAgICBjYWNoZWREb29kbGVzID0gW11cbiAgICAgICAgICAgIChpZiBpbmRleCBpc250ICdsYXN0VXBkYXRlZCcgdGhlbiBjYWNoZWREb29kbGVzLnB1c2goSlNPTi5wYXJzZShkYXRhKSkpIGZvciBpbmRleCwgZGF0YSBvZiBjYWNoZWREYXRhXG5cbiAgICAgICAgICAgIGlmICgoRGF0ZS5ub3coKSAtIGNhY2hlZERhdGEubGFzdFVwZGF0ZWQpID4gQERPT0RMRV9DQUNIRV9EVVJBVElPTilcbiAgICAgICAgICAgICAgICBAZmV0Y2hEb29kbGVzIGNhY2hlZERvb2RsZXNcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICBAc2V0RG9vZGxlcyhjYWNoZWREb29kbGVzKS5zZXRBY3RpdmVEb29kbGUoKVxuXG4gICAgICAgIG51bGxcblxuICAgIGZldGNoRG9vZGxlcyA6IChjYWNoZWREb29kbGVzPWZhbHNlKSA9PlxuXG4gICAgICAgIHIgPSBSZXF1ZXN0ZXIucmVxdWVzdFxuICAgICAgICAgICAgdXJsICA6IEFQSS5nZXQoJ2Rvb2RsZXMnKVxuICAgICAgICAgICAgdHlwZSA6ICdHRVQnXG5cbiAgICAgICAgci5kb25lIChkYXRhKSA9PiBAb25GZXRjaERvb2RsZXNEb25lIGRhdGEsIGNhY2hlZERvb2RsZXNcbiAgICAgICAgci5mYWlsIChyZXMpID0+IGNvbnNvbGUuZXJyb3IgXCJlcnJvciBsb2FkaW5nIGFwaSBzdGFydCBkYXRhXCIsIHJlc1xuXG4gICAgICAgIG51bGxcblxuICAgIG9uRmV0Y2hEb29kbGVzRG9uZSA6IChkYXRhLCBjYWNoZWREb29kbGVzPWZhbHNlKSA9PlxuXG4gICAgICAgIGNvbnNvbGUubG9nIFwib25GZXRjaERvb2RsZXNEb25lIDogKGRhdGEpID0+XCIsIGRhdGEsIGNhY2hlZERvb2RsZXNcblxuICAgICAgICBpZiBjYWNoZWREb29kbGVzXG4gICAgICAgICAgICBAdXBkYXRlRG9vZGxlcyhfLnNodWZmbGUoZGF0YS5kb29kbGVzKSwgY2FjaGVkRG9vZGxlcykuc2V0QWN0aXZlRG9vZGxlKClcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgQHNldERvb2RsZXMoXy5zaHVmZmxlKGRhdGEuZG9vZGxlcykpLnNldEFjdGl2ZURvb2RsZSgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgc2V0RG9vZGxlcyA6IChkb29kbGVzKSA9PlxuXG4gICAgICAgIEBkb29kbGVzLmFkZCBkb29kbGVzXG5cbiAgICAgICAgQFxuXG4gICAgdXBkYXRlRG9vZGxlcyA6IChuZXdEb29kbGVzLCBjYWNoZWREb29kbGVzKSA9PlxuXG4gICAgICAgIEBkb29kbGVzLmFkZCBjYWNoZWREb29kbGVzXG4gICAgICAgIEBkb29kbGVzLmFkZE5ldyBuZXdEb29kbGVzXG5cbiAgICAgICAgQFxuXG4gICAgc2V0QWN0aXZlRG9vZGxlIDogPT5cblxuICAgICAgICBAYWN0aXZlRG9vZGxlID0gQGRvb2RsZXMuZ2V0TmV4dERvb2RsZSgpXG4gICAgICAgIEBjYWxsYmFjaz8oKVxuXG4gICAgICAgIEB1cGRhdGVDYWNoZSgpXG5cbiAgICAgICAgbnVsbFxuXG4gICAgdXBkYXRlQ2FjaGUgOiA9PlxuXG4gICAgICAgIGNocm9tZS5zdG9yYWdlLnN5bmMuY2xlYXIgPT5cblxuICAgICAgICAgICAgbmV3Q2FjaGUgPSBsYXN0VXBkYXRlZCA6IERhdGUubm93KClcbiAgICAgICAgICAgIChuZXdDYWNoZVtwb3NpdGlvbl0gPSBKU09OLnN0cmluZ2lmeSBkb29kbGUpIGZvciBkb29kbGUsIHBvc2l0aW9uIGluIEBkb29kbGVzLm1vZGVsc1xuXG4gICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5zeW5jLnNldCBuZXdDYWNoZVxuXG4gICAgICAgIG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBcHBEYXRhXG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuL3ZpZXcvQWJzdHJhY3RWaWV3J1xuUHJlbG9hZGVyICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvUHJlbG9hZGVyJ1xuSGVhZGVyICAgICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvSGVhZGVyJ1xuV3JhcHBlciAgICAgID0gcmVxdWlyZSAnLi92aWV3L2Jhc2UvV3JhcHBlcidcbkZvb3RlciAgICAgICA9IHJlcXVpcmUgJy4vdmlldy9iYXNlL0Zvb3Rlcidcbk1vZGFsTWFuYWdlciA9IHJlcXVpcmUgJy4vdmlldy9tb2RhbHMvX01vZGFsTWFuYWdlcidcbk1lZGlhUXVlcmllcyA9IHJlcXVpcmUgJy4vdXRpbHMvTWVkaWFRdWVyaWVzJ1xuXG5jbGFzcyBBcHBWaWV3IGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cbiAgICB0ZW1wbGF0ZSA6ICdtYWluJ1xuXG4gICAgJHdpbmRvdyAgOiBudWxsXG4gICAgJGJvZHkgICAgOiBudWxsXG5cbiAgICB3cmFwcGVyICA6IG51bGxcbiAgICBmb290ZXIgICA6IG51bGxcblxuICAgIGRpbXMgOlxuICAgICAgICB3IDogbnVsbFxuICAgICAgICBoIDogbnVsbFxuICAgICAgICBvIDogbnVsbFxuICAgICAgICBjIDogbnVsbFxuXG4gICAgZXZlbnRzIDpcbiAgICAgICAgJ2NsaWNrIGEnIDogJ2xpbmtNYW5hZ2VyJ1xuXG4gICAgRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMgOiAnRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMnXG5cbiAgICBNT0JJTEVfV0lEVEggOiA3MDBcbiAgICBNT0JJTEUgICAgICAgOiAnbW9iaWxlJ1xuICAgIE5PTl9NT0JJTEUgICA6ICdub25fbW9iaWxlJ1xuXG4gICAgY29uc3RydWN0b3IgOiAtPlxuXG4gICAgICAgIEAkd2luZG93ID0gJCh3aW5kb3cpXG4gICAgICAgIEAkYm9keSAgID0gJCgnYm9keScpLmVxKDApXG5cbiAgICAgICAgc3VwZXIoKVxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBkaXNhYmxlVG91Y2g6ID0+XG5cbiAgICAgICAgQCR3aW5kb3cub24gJ3RvdWNobW92ZScsIEBvblRvdWNoTW92ZVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgZW5hYmxlVG91Y2g6ID0+XG5cbiAgICAgICAgQCR3aW5kb3cub2ZmICd0b3VjaG1vdmUnLCBAb25Ub3VjaE1vdmVcblxuICAgICAgICByZXR1cm5cblxuICAgIG9uVG91Y2hNb3ZlOiAoIGUgKSAtPlxuXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgcmVuZGVyIDogPT5cblxuICAgICAgICBAYmluZEV2ZW50cygpXG5cbiAgICAgICAgQHByZWxvYWRlciAgICA9IG5ldyBQcmVsb2FkZXJcbiAgICAgICAgQG1vZGFsTWFuYWdlciA9IG5ldyBNb2RhbE1hbmFnZXJcblxuICAgICAgICBAaGVhZGVyICA9IG5ldyBIZWFkZXJcbiAgICAgICAgQHdyYXBwZXIgPSBuZXcgV3JhcHBlclxuICAgICAgICBAZm9vdGVyICA9IG5ldyBGb290ZXJcblxuICAgICAgICBAXG4gICAgICAgICAgICAuYWRkQ2hpbGQgQGhlYWRlclxuICAgICAgICAgICAgLmFkZENoaWxkIEB3cmFwcGVyXG4gICAgICAgICAgICAuYWRkQ2hpbGQgQGZvb3RlclxuXG4gICAgICAgIEBvbkFsbFJlbmRlcmVkKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGJpbmRFdmVudHMgOiA9PlxuXG4gICAgICAgIEBvbiAnYWxsUmVuZGVyZWQnLCBAb25BbGxSZW5kZXJlZFxuXG4gICAgICAgIEBvblJlc2l6ZSgpXG5cbiAgICAgICAgQG9uUmVzaXplID0gXy5kZWJvdW5jZSBAb25SZXNpemUsIDMwMFxuICAgICAgICBAJHdpbmRvdy5vbiAncmVzaXplIG9yaWVudGF0aW9uY2hhbmdlJywgQG9uUmVzaXplXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBvbkFsbFJlbmRlcmVkIDogPT5cblxuICAgICAgICAjIGNvbnNvbGUubG9nIFwib25BbGxSZW5kZXJlZCA6ID0+XCJcblxuICAgICAgICBAJGJvZHkucHJlcGVuZCBAJGVsXG5cbiAgICAgICAgQGJlZ2luKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGJlZ2luIDogPT5cblxuICAgICAgICBAdHJpZ2dlciAnc3RhcnQnXG5cbiAgICAgICAgQENEX0NFKCkucm91dGVyLnN0YXJ0KClcblxuICAgICAgICBAcHJlbG9hZGVyLmhpZGUoKVxuXG4gICAgICAgIHJldHVyblxuXG4gICAgb25SZXNpemUgOiA9PlxuXG4gICAgICAgIEBnZXREaW1zKClcblxuICAgICAgICByZXR1cm5cblxuICAgIGdldERpbXMgOiA9PlxuXG4gICAgICAgIHcgPSB3aW5kb3cuaW5uZXJXaWR0aCBvciBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGggb3IgZG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aFxuICAgICAgICBoID0gd2luZG93LmlubmVySGVpZ2h0IG9yIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQgb3IgZG9jdW1lbnQuYm9keS5jbGllbnRIZWlnaHRcblxuICAgICAgICBAZGltcyA9XG4gICAgICAgICAgICB3IDogd1xuICAgICAgICAgICAgaCA6IGhcbiAgICAgICAgICAgIG8gOiBpZiBoID4gdyB0aGVuICdwb3J0cmFpdCcgZWxzZSAnbGFuZHNjYXBlJ1xuICAgICAgICAgICAgYyA6IGlmIHcgPD0gQE1PQklMRV9XSURUSCB0aGVuIEBNT0JJTEUgZWxzZSBATk9OX01PQklMRVxuXG4gICAgICAgIEB0cmlnZ2VyIEBFVkVOVF9VUERBVEVfRElNRU5TSU9OUywgQGRpbXNcblxuICAgICAgICByZXR1cm5cblxuICAgIGxpbmtNYW5hZ2VyIDogKGUpID0+XG5cbiAgICAgICAgaHJlZiA9ICQoZS5jdXJyZW50VGFyZ2V0KS5hdHRyKCdocmVmJylcblxuICAgICAgICByZXR1cm4gZmFsc2UgdW5sZXNzIGhyZWZcblxuICAgICAgICBAbmF2aWdhdGVUb1VybCBocmVmLCBlXG5cbiAgICAgICAgcmV0dXJuXG5cbiAgICBuYXZpZ2F0ZVRvVXJsIDogKCBocmVmLCBlID0gbnVsbCApID0+XG5cbiAgICAgICAgcm91dGUgICA9IGlmIGhyZWYubWF0Y2goQENEX0NFKCkuQkFTRV9VUkwpIHRoZW4gaHJlZi5zcGxpdChAQ0RfQ0UoKS5CQVNFX1VSTClbMV0gZWxzZSBocmVmXG4gICAgICAgIHNlY3Rpb24gPSBpZiByb3V0ZS5pbmRleE9mKCcvJykgaXMgMCB0aGVuIHJvdXRlLnNwbGl0KCcvJylbMV0gZWxzZSByb3V0ZVxuXG4gICAgICAgIGlmIEBDRF9DRSgpLm5hdi5nZXRTZWN0aW9uIHNlY3Rpb25cbiAgICAgICAgICAgIGU/LnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgIEBDRF9DRSgpLnJvdXRlci5uYXZpZ2F0ZVRvIHJvdXRlXG4gICAgICAgIGVsc2UgXG4gICAgICAgICAgICBAaGFuZGxlRXh0ZXJuYWxMaW5rIGhyZWZcblxuICAgICAgICByZXR1cm5cblxuICAgIGhhbmRsZUV4dGVybmFsTGluayA6IChkYXRhKSA9PiBcblxuICAgICAgICAjIyNcblxuICAgICAgICBiaW5kIHRyYWNraW5nIGV2ZW50cyBpZiBuZWNlc3NhcnlcblxuICAgICAgICAjIyNcblxuICAgICAgICByZXR1cm5cblxubW9kdWxlLmV4cG9ydHMgPSBBcHBWaWV3XG4iLCJjbGFzcyBBYnN0cmFjdENvbGxlY3Rpb24gZXh0ZW5kcyBCYWNrYm9uZS5Db2xsZWN0aW9uXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0Q29sbGVjdGlvblxuIiwiVGVtcGxhdGVNb2RlbCA9IHJlcXVpcmUgJy4uLy4uL21vZGVscy9jb3JlL1RlbXBsYXRlTW9kZWwnXG5cbmNsYXNzIFRlbXBsYXRlc0NvbGxlY3Rpb24gZXh0ZW5kcyBCYWNrYm9uZS5Db2xsZWN0aW9uXG5cblx0bW9kZWwgOiBUZW1wbGF0ZU1vZGVsXG5cbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVzQ29sbGVjdGlvblxuIiwiQWJzdHJhY3RDb2xsZWN0aW9uID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RDb2xsZWN0aW9uJ1xuRG9vZGxlTW9kZWwgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vbW9kZWxzL2Rvb2RsZS9Eb29kbGVNb2RlbCdcblxuY2xhc3MgRG9vZGxlc0NvbGxlY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENvbGxlY3Rpb25cblxuICAgIG1vZGVsIDogRG9vZGxlTW9kZWxcblxuICAgIGdldERvb2RsZUJ5U2x1ZyA6IChzbHVnKSA9PlxuXG4gICAgICAgIGRvb2RsZSA9IEBmaW5kV2hlcmUgc2x1ZyA6IHNsdWdcblxuICAgICAgICBpZiAhZG9vZGxlXG4gICAgICAgICAgICBjb25zb2xlLmxvZyBcInkgdSBubyBkb29kbGU/XCJcblxuICAgICAgICByZXR1cm4gZG9vZGxlXG5cbiAgICBnZXREb29kbGVCeU5hdlNlY3Rpb24gOiAod2hpY2hTZWN0aW9uKSA9PlxuXG4gICAgICAgIHNlY3Rpb24gPSBAQ0RfQ0UoKS5uYXZbd2hpY2hTZWN0aW9uXVxuXG4gICAgICAgIGRvb2RsZSA9IEBmaW5kV2hlcmUgc2x1ZyA6IFwiI3tzZWN0aW9uLnN1Yn0vI3tzZWN0aW9uLnRlcn1cIlxuXG4gICAgICAgIGRvb2RsZVxuXG4gICAgZ2V0UHJldkRvb2RsZSA6IChkb29kbGUpID0+XG5cbiAgICAgICAgaW5kZXggPSBAaW5kZXhPZiBkb29kbGVcbiAgICAgICAgaW5kZXgtLVxuXG4gICAgICAgIGlmIGluZGV4IDwgMFxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBAYXQgaW5kZXhcblxuICAgIGdldE5leHREb29kbGUgOiAoZG9vZGxlKSA9PlxuXG4gICAgICAgIGluZGV4ID0gQGluZGV4T2YgZG9vZGxlXG4gICAgICAgIGluZGV4KytcblxuICAgICAgICBpZiBpbmRleCA+IChAbGVuZ3RoLmxlbmd0aC0xKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBAYXQgaW5kZXhcblxuICAgIGFkZE5ldyA6IChkb29kbGVzKSA9PlxuXG4gICAgICAgIGZvciBkb29kbGUgaW4gZG9vZGxlc1xuICAgICAgICAgICAgaWYgIUBmaW5kV2hlcmUoIGluZGV4IDogZG9vZGxlLmluZGV4IClcbiAgICAgICAgICAgICAgICBAYWRkIGRvb2RsZVxuXG4gICAgICAgIG51bGxcblxuICAgIGdldE5leHREb29kbGUgOiA9PlxuXG4gICAgICAgIGZvciBkb29kbGUgaW4gQG1vZGVsc1xuXG4gICAgICAgICAgICBpZiAhZG9vZGxlLmdldCgndmlld2VkJylcbiAgICAgICAgICAgICAgICBkb29kbGUuc2V0KCd2aWV3ZWQnLCB0cnVlKVxuICAgICAgICAgICAgICAgIG5leHREb29kbGUgPSBkb29kbGVcbiAgICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgIGlmICFuZXh0RG9vZGxlXG4gICAgICAgICAgICBjb25zb2xlLmxvZyAnd2FhYWFhIHUgc2VlbiB0aGVtIGFsbD8hJ1xuICAgICAgICAgICAgbmV4dERvb2RsZSA9IF8uc2h1ZmZsZShAbW9kZWxzKVswXVxuXG4gICAgICAgIG5leHREb29kbGVcblxubW9kdWxlLmV4cG9ydHMgPSBEb29kbGVzQ29sbGVjdGlvblxuIiwiQVBJUm91dGVNb2RlbCA9IHJlcXVpcmUgJy4uL21vZGVscy9jb3JlL0FQSVJvdXRlTW9kZWwnXG5cbmNsYXNzIEFQSVxuXG5cdEBtb2RlbCA6IG5ldyBBUElSb3V0ZU1vZGVsXG5cblx0QGdldENvbnRhbnRzIDogPT5cblxuXHRcdCMjIyBhZGQgbW9yZSBpZiB3ZSB3YW5uYSB1c2UgaW4gQVBJIHN0cmluZ3MgIyMjXG5cdFx0QVBJX0hPU1QgOiBAQ0RfQ0UoKS5BUElfSE9TVFxuXG5cdEBnZXQgOiAobmFtZSwgdmFycykgPT5cblxuXHRcdHZhcnMgPSAkLmV4dGVuZCB0cnVlLCB2YXJzLCBAZ2V0Q29udGFudHMoKVxuXHRcdHJldHVybiBAc3VwcGxhbnRTdHJpbmcgQG1vZGVsLmdldChuYW1lKSwgdmFyc1xuXG5cdEBzdXBwbGFudFN0cmluZyA6IChzdHIsIHZhbHMpIC0+XG5cblx0XHRyZXR1cm4gc3RyLnJlcGxhY2UgL3t7IChbXnt9XSopIH19L2csIChhLCBiKSAtPlxuXHRcdFx0ciA9IHZhbHNbYl0gb3IgaWYgdHlwZW9mIHZhbHNbYl0gaXMgJ251bWJlcicgdGhlbiB2YWxzW2JdLnRvU3RyaW5nKCkgZWxzZSAnJ1xuXHRcdChpZiB0eXBlb2YgciBpcyBcInN0cmluZ1wiIG9yIHR5cGVvZiByIGlzIFwibnVtYmVyXCIgdGhlbiByIGVsc2UgYSlcblxuXHRAQ0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFQSVxuIiwiY2xhc3MgQWJzdHJhY3REYXRhXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0Xy5leHRlbmQgQCwgQmFja2JvbmUuRXZlbnRzXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdENEX0NFIDogPT5cblxuXHRcdHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdERhdGFcbiIsIkxvY2FsZXNNb2RlbCA9IHJlcXVpcmUgJy4uL21vZGVscy9jb3JlL0xvY2FsZXNNb2RlbCdcbkFQSSAgICAgICAgICA9IHJlcXVpcmUgJy4uL2RhdGEvQVBJJ1xuXG4jIyNcbiMgTG9jYWxlIExvYWRlciAjXG5cbkZpcmVzIGJhY2sgYW4gZXZlbnQgd2hlbiBjb21wbGV0ZVxuXG4jIyNcbmNsYXNzIExvY2FsZVxuXG4gICAgbGFuZyAgICAgOiBudWxsXG4gICAgZGF0YSAgICAgOiBudWxsXG4gICAgY2FsbGJhY2sgOiBudWxsXG4gICAgZGVmYXVsdCAgOiAnZW4tZ2InXG5cbiAgICBjb25zdHJ1Y3RvciA6IChkYXRhLCBjYikgLT5cblxuICAgICAgICAjIyMgc3RhcnQgTG9jYWxlIExvYWRlciwgZGVmaW5lIGxvY2FsZSBiYXNlZCBvbiBicm93c2VyIGxhbmd1YWdlICMjI1xuXG4gICAgICAgIEBjYWxsYmFjayA9IGNiXG5cbiAgICAgICAgQGxhbmcgPSBAZ2V0TGFuZygpXG5cbiAgICAgICAgQHBhcnNlRGF0YSBkYXRhXG5cbiAgICAgICAgbnVsbFxuICAgICAgICAgICAgXG4gICAgZ2V0TGFuZyA6ID0+XG5cbiAgICAgICAgaWYgd2luZG93LmxvY2F0aW9uLnNlYXJjaCBhbmQgd2luZG93LmxvY2F0aW9uLnNlYXJjaC5tYXRjaCgnbGFuZz0nKVxuXG4gICAgICAgICAgICBsYW5nID0gd2luZG93LmxvY2F0aW9uLnNlYXJjaC5zcGxpdCgnbGFuZz0nKVsxXS5zcGxpdCgnJicpWzBdXG5cbiAgICAgICAgZWxzZSBpZiB3aW5kb3cuY29uZmlnLmxvY2FsZUNvZGVcblxuICAgICAgICAgICAgbGFuZyA9IHdpbmRvdy5jb25maWcubG9jYWxlQ29kZVxuXG4gICAgICAgIGVsc2VcblxuICAgICAgICAgICAgbGFuZyA9IEBkZWZhdWx0XG5cbiAgICAgICAgbGFuZ1xuXG4gICAgcGFyc2VEYXRhIDogKGRhdGEpID0+XG5cbiAgICAgICAgIyMjIEZpcmVzIGJhY2sgYW4gZXZlbnQgb25jZSBpdCdzIGNvbXBsZXRlICMjI1xuXG4gICAgICAgIEBkYXRhID0gbmV3IExvY2FsZXNNb2RlbCBkYXRhXG4gICAgICAgIEBjYWxsYmFjaz8oKVxuXG4gICAgICAgIG51bGxcblxuICAgIGdldCA6IChpZCkgPT5cblxuICAgICAgICAjIyMgZ2V0IFN0cmluZyBmcm9tIGxvY2FsZVxuICAgICAgICArIGlkIDogc3RyaW5nIGlkIG9mIHRoZSBMb2NhbGlzZWQgU3RyaW5nXG4gICAgICAgICMjI1xuXG4gICAgICAgIHJldHVybiBAZGF0YS5nZXRTdHJpbmcgaWRcblxuICAgIGdldExvY2FsZUltYWdlIDogKHVybCkgPT5cblxuICAgICAgICByZXR1cm4gd2luZG93LmNvbmZpZy5DRE4gKyBcIi9pbWFnZXMvbG9jYWxlL1wiICsgd2luZG93LmNvbmZpZy5sb2NhbGVDb2RlICsgXCIvXCIgKyB1cmxcblxubW9kdWxlLmV4cG9ydHMgPSBMb2NhbGVcbiIsIlRlbXBsYXRlTW9kZWwgICAgICAgPSByZXF1aXJlICcuLi9tb2RlbHMvY29yZS9UZW1wbGF0ZU1vZGVsJ1xuVGVtcGxhdGVzQ29sbGVjdGlvbiA9IHJlcXVpcmUgJy4uL2NvbGxlY3Rpb25zL2NvcmUvVGVtcGxhdGVzQ29sbGVjdGlvbidcblxuY2xhc3MgVGVtcGxhdGVzXG5cbiAgICB0ZW1wbGF0ZXMgOiBudWxsXG4gICAgY2IgICAgICAgIDogbnVsbFxuXG4gICAgY29uc3RydWN0b3IgOiAoZGF0YSwgY2FsbGJhY2spIC0+XG5cbiAgICAgICAgQGNiID0gY2FsbGJhY2tcblxuICAgICAgICBAcGFyc2VEYXRhIGRhdGFcbiAgICAgICAgICAgXG4gICAgICAgIG51bGxcblxuICAgIHBhcnNlRGF0YSA6IChkYXRhKSA9PlxuXG4gICAgICAgIHRlbXAgPSBbXVxuXG4gICAgICAgIGZvciBpdGVtIGluIGRhdGEudGVtcGxhdGVcbiAgICAgICAgICAgIHRlbXAucHVzaCBuZXcgVGVtcGxhdGVNb2RlbFxuICAgICAgICAgICAgICAgIGlkICAgOiBpdGVtLiQuaWRcbiAgICAgICAgICAgICAgICB0ZXh0IDogaXRlbS5fXG5cbiAgICAgICAgQHRlbXBsYXRlcyA9IG5ldyBUZW1wbGF0ZXNDb2xsZWN0aW9uIHRlbXBcblxuICAgICAgICBAY2I/KClcbiAgICAgICAgXG4gICAgICAgIG51bGwgICAgICAgIFxuXG4gICAgZ2V0IDogKGlkKSA9PlxuXG4gICAgICAgIHQgPSBAdGVtcGxhdGVzLndoZXJlIGlkIDogaWRcbiAgICAgICAgdCA9IHRbMF0uZ2V0ICd0ZXh0J1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuICQudHJpbSB0XG5cbm1vZHVsZS5leHBvcnRzID0gVGVtcGxhdGVzXG4iLCJjbGFzcyBBYnN0cmFjdE1vZGVsIGV4dGVuZHMgQmFja2JvbmUuRGVlcE1vZGVsXG5cblx0Y29uc3RydWN0b3IgOiAoYXR0cnMsIG9wdGlvbikgLT5cblxuXHRcdGF0dHJzID0gQF9maWx0ZXJBdHRycyBhdHRyc1xuXG5cdFx0cmV0dXJuIEJhY2tib25lLkRlZXBNb2RlbC5hcHBseSBALCBhcmd1bWVudHNcblxuXHRzZXQgOiAoYXR0cnMsIG9wdGlvbnMpIC0+XG5cblx0XHRvcHRpb25zIG9yIChvcHRpb25zID0ge30pXG5cblx0XHRhdHRycyA9IEBfZmlsdGVyQXR0cnMgYXR0cnNcblxuXHRcdG9wdGlvbnMuZGF0YSA9IEpTT04uc3RyaW5naWZ5IGF0dHJzXG5cblx0XHRyZXR1cm4gQmFja2JvbmUuRGVlcE1vZGVsLnByb3RvdHlwZS5zZXQuY2FsbCBALCBhdHRycywgb3B0aW9uc1xuXG5cdF9maWx0ZXJBdHRycyA6IChhdHRycykgPT5cblxuXHRcdGF0dHJzXG5cblx0Q0RfQ0UgOiA9PlxuXG5cdFx0cmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFic3RyYWN0TW9kZWxcbiIsImNsYXNzIEFQSVJvdXRlTW9kZWwgZXh0ZW5kcyBCYWNrYm9uZS5EZWVwTW9kZWxcblxuICAgIGRlZmF1bHRzIDpcblxuICAgICAgICBkb29kbGVzIDogXCJ7eyBBUElfSE9TVCB9fS9hcGkvZG9vZGxlc1wiXG5cbm1vZHVsZS5leHBvcnRzID0gQVBJUm91dGVNb2RlbFxuIiwiY2xhc3MgTG9jYWxlc01vZGVsIGV4dGVuZHMgQmFja2JvbmUuTW9kZWxcblxuICAgIGRlZmF1bHRzIDpcbiAgICAgICAgY29kZSAgICAgOiBudWxsXG4gICAgICAgIGxhbmd1YWdlIDogbnVsbFxuICAgICAgICBzdHJpbmdzICA6IG51bGxcbiAgICAgICAgICAgIFxuICAgIGdldF9sYW5ndWFnZSA6ID0+XG4gICAgICAgIHJldHVybiBAZ2V0KCdsYW5ndWFnZScpXG5cbiAgICBnZXRTdHJpbmcgOiAoaWQpID0+XG4gICAgICAgICgocmV0dXJuIGUgaWYoYSBpcyBpZCkpIGZvciBhLCBlIG9mIHZbJ3N0cmluZ3MnXSkgZm9yIGssIHYgb2YgQGdldCgnc3RyaW5ncycpXG4gICAgICAgIGNvbnNvbGUud2FybiBcIkxvY2FsZXMgLT4gbm90IGZvdW5kIHN0cmluZzogI3tpZH1cIlxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gTG9jYWxlc01vZGVsXG4iLCJjbGFzcyBUZW1wbGF0ZU1vZGVsIGV4dGVuZHMgQmFja2JvbmUuTW9kZWxcblxuXHRkZWZhdWx0cyA6IFxuXG5cdFx0aWQgICA6IFwiXCJcblx0XHR0ZXh0IDogXCJcIlxuXG5tb2R1bGUuZXhwb3J0cyA9IFRlbXBsYXRlTW9kZWxcbiIsIkFic3RyYWN0TW9kZWwgICAgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RNb2RlbCdcbk51bWJlclV0aWxzICAgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vdXRpbHMvTnVtYmVyVXRpbHMnXG5Db2RlV29yZFRyYW5zaXRpb25lciA9IHJlcXVpcmUgJy4uLy4uL3V0aWxzL0NvZGVXb3JkVHJhbnNpdGlvbmVyJ1xuXG5jbGFzcyBEb29kbGVNb2RlbCBleHRlbmRzIEFic3RyYWN0TW9kZWxcblxuICAgIGRlZmF1bHRzIDpcbiAgICAgICAgIyBmcm9tIG1hbmlmZXN0XG4gICAgICAgIFwiaWRcIiA6IFwiXCJcbiAgICAgICAgXCJpbmRleFwiOiBcIlwiXG4gICAgICAgIFwibmFtZVwiIDogXCJcIlxuICAgICAgICBcImF1dGhvclwiIDpcbiAgICAgICAgICAgIFwibmFtZVwiICAgIDogXCJcIlxuICAgICAgICAgICAgXCJnaXRodWJcIiAgOiBcIlwiXG4gICAgICAgICAgICBcIndlYnNpdGVcIiA6IFwiXCJcbiAgICAgICAgICAgIFwidHdpdHRlclwiIDogXCJcIlxuICAgICAgICBcImluc3RydWN0aW9uc1wiOiBcIlwiXG4gICAgICAgIFwiZGVzY3JpcHRpb25cIjogXCJcIlxuICAgICAgICBcInRhZ3NcIiA6IFtdXG4gICAgICAgIFwiaW50ZXJhY3Rpb25cIiA6XG4gICAgICAgICAgICBcIm1vdXNlXCIgICAgOiBudWxsXG4gICAgICAgICAgICBcImtleWJvYXJkXCIgOiBudWxsXG4gICAgICAgICAgICBcInRvdWNoXCIgICAgOiBudWxsXG4gICAgICAgIFwiY3JlYXRlZFwiIDogXCJcIlxuICAgICAgICBcInNsdWdcIiA6IFwiXCJcbiAgICAgICAgXCJzaG9ydGxpbmtcIiA6IFwiXCJcbiAgICAgICAgXCJjb2xvdXJfc2NoZW1lXCIgOiBcIlwiXG4gICAgICAgICMgc2l0ZS1vbmx5XG4gICAgICAgIFwiaW5kZXhfcGFkZGVkXCIgOiBcIlwiXG4gICAgICAgIFwiaW5kZXhIVE1MXCIgOiBcIlwiXG4gICAgICAgIFwic291cmNlXCIgICAgOiBcIlwiXG4gICAgICAgIFwidXJsXCIgICAgICAgOiBcIlwiXG4gICAgICAgIFwic2NyYW1ibGVkXCIgOlxuICAgICAgICAgICAgXCJuYW1lXCIgICAgICAgIDogXCJcIlxuICAgICAgICAgICAgXCJhdXRob3JfbmFtZVwiIDogXCJcIlxuICAgICAgICBcInZpZXdlZFwiIDogZmFsc2VcblxuICAgIGNvbnN0cnVjdG9yIDogLT5cblxuICAgICAgICBzdXBlclxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBfZmlsdGVyQXR0cnMgOiAoYXR0cnMpID0+XG5cbiAgICAgICAgaWYgYXR0cnMuc2x1Z1xuICAgICAgICAgICAgYXR0cnMudXJsID0gd2luZG93LmNvbmZpZy5ob3N0bmFtZSArICcvJyArIHdpbmRvdy5jb25maWcucm91dGVzLkRPT0RMRVMgKyAnLycgKyBhdHRycy5zbHVnXG5cbiAgICAgICAgaWYgYXR0cnMuaW5kZXhcbiAgICAgICAgICAgIGF0dHJzLmluZGV4X3BhZGRlZCA9IE51bWJlclV0aWxzLnplcm9GaWxsIGF0dHJzLmluZGV4LCAzXG4gICAgICAgICAgICBhdHRycy5pbmRleEhUTUwgICAgPSBAZ2V0SW5kZXhIVE1MIGF0dHJzLmluZGV4X3BhZGRlZFxuXG4gICAgICAgIGlmIGF0dHJzLm5hbWUgYW5kIGF0dHJzLmF1dGhvci5uYW1lXG4gICAgICAgICAgICBhdHRycy5zY3JhbWJsZWQgPVxuICAgICAgICAgICAgICAgIG5hbWUgICAgICAgIDogQ29kZVdvcmRUcmFuc2l0aW9uZXIuZ2V0U2NyYW1ibGVkV29yZCBhdHRycy5uYW1lXG4gICAgICAgICAgICAgICAgYXV0aG9yX25hbWUgOiBDb2RlV29yZFRyYW5zaXRpb25lci5nZXRTY3JhbWJsZWRXb3JkIGF0dHJzLmF1dGhvci5uYW1lXG5cbiAgICAgICAgYXR0cnNcblxuICAgIGdldEluZGV4SFRNTCA6IChpbmRleCkgPT5cblxuICAgICAgICBodG1sID0gXCJcIlxuXG4gICAgICAgIGZvciBjaGFyIGluIGluZGV4LnNwbGl0KCcnKVxuICAgICAgICAgICAgY2xhc3NOYW1lID0gaWYgY2hhciBpcyAnMCcgdGhlbiAnaW5kZXgtY2hhci16ZXJvJyBlbHNlICdpbmRleC1jaGFyLW5vbnplcm8nXG4gICAgICAgICAgICBodG1sICs9IFwiPHNwYW4gY2xhc3M9XFxcIiN7Y2xhc3NOYW1lfVxcXCI+I3tjaGFyfTwvc3Bhbj5cIlxuXG4gICAgICAgIGh0bWxcblxuICAgIGdldEF1dGhvckh0bWwgOiA9PlxuXG4gICAgICAgIHBvcnRmb2xpb19sYWJlbCA9IEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJtaXNjX3BvcnRmb2xpb19sYWJlbFwiXG5cbiAgICAgICAgYXR0cnMgPSBAZ2V0KCdhdXRob3InKVxuICAgICAgICBodG1sICA9IFwiXCJcbiAgICAgICAgbGlua3MgPSBbXVxuXG4gICAgICAgIGh0bWwgKz0gXCIje2F0dHJzLm5hbWV9IFxcXFwgXCJcblxuICAgICAgICBpZiBhdHRycy53ZWJzaXRlIHRoZW4gbGlua3MucHVzaCBcIjxhIGhyZWY9XFxcIiN7YXR0cnMud2Vic2l0ZX1cXFwiIHRhcmdldD1cXFwiX2JsYW5rXFxcIj4je3BvcnRmb2xpb19sYWJlbH08L2E+IFwiXG4gICAgICAgIGlmIGF0dHJzLnR3aXR0ZXIgdGhlbiBsaW5rcy5wdXNoIFwiPGEgaHJlZj1cXFwiaHR0cDovL3R3aXR0ZXIuY29tLyN7YXR0cnMudHdpdHRlcn1cXFwiIHRhcmdldD1cXFwiX2JsYW5rXFxcIj50dzwvYT5cIlxuICAgICAgICBpZiBhdHRycy5naXRodWIgdGhlbiBsaW5rcy5wdXNoIFwiPGEgaHJlZj1cXFwiaHR0cDovL2dpdGh1Yi5jb20vI3thdHRycy5naXRodWJ9XFxcIiB0YXJnZXQ9XFxcIl9ibGFua1xcXCI+Z2g8L2E+XCJcblxuICAgICAgICBodG1sICs9IFwiI3tsaW5rcy5qb2luKCcgXFxcXCAnKX1cIlxuXG4gICAgICAgIGh0bWxcblxubW9kdWxlLmV4cG9ydHMgPSBEb29kbGVNb2RlbFxuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi4vdmlldy9BYnN0cmFjdFZpZXcnXG5Sb3V0ZXIgICAgICAgPSByZXF1aXJlICcuL1JvdXRlcidcblxuY2xhc3MgTmF2IGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cbiAgICBARVZFTlRfQ0hBTkdFX1ZJRVcgICAgIDogJ0VWRU5UX0NIQU5HRV9WSUVXJ1xuICAgIEBFVkVOVF9DSEFOR0VfU1VCX1ZJRVcgOiAnRVZFTlRfQ0hBTkdFX1NVQl9WSUVXJ1xuXG4gICAgc2VjdGlvbnMgOlxuICAgICAgICBIT01FIDogJ2luZGV4Lmh0bWwnXG5cbiAgICBjdXJyZW50ICA6IGFyZWEgOiBudWxsLCBzdWIgOiBudWxsXG4gICAgcHJldmlvdXMgOiBhcmVhIDogbnVsbCwgc3ViIDogbnVsbFxuXG4gICAgY29uc3RydWN0b3I6IC0+XG5cbiAgICAgICAgQENEX0NFKCkucm91dGVyLm9uIFJvdXRlci5FVkVOVF9IQVNIX0NIQU5HRUQsIEBjaGFuZ2VWaWV3XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlXG5cbiAgICBnZXRTZWN0aW9uIDogKHNlY3Rpb24pID0+XG5cbiAgICAgICAgaWYgc2VjdGlvbiBpcyAnJyB0aGVuIHJldHVybiB0cnVlXG5cbiAgICAgICAgZm9yIHNlY3Rpb25OYW1lLCB1cmkgb2YgQHNlY3Rpb25zXG4gICAgICAgICAgICBpZiB1cmkgaXMgc2VjdGlvbiB0aGVuIHJldHVybiBzZWN0aW9uTmFtZVxuXG4gICAgICAgIGZhbHNlXG5cbiAgICBjaGFuZ2VWaWV3OiAoYXJlYSwgc3ViLCBwYXJhbXMpID0+XG5cbiAgICAgICAgY29uc29sZS5sb2cgXCJhcmVhXCIsYXJlYVxuICAgICAgICBjb25zb2xlLmxvZyBcInN1YlwiLHN1YlxuICAgICAgICBjb25zb2xlLmxvZyBcInBhcmFtc1wiLHBhcmFtc1xuXG4gICAgICAgIEBwcmV2aW91cyA9IEBjdXJyZW50XG4gICAgICAgIEBjdXJyZW50ICA9IGFyZWEgOiBhcmVhLCBzdWIgOiBzdWJcblxuICAgICAgICBAdHJpZ2dlciBOYXYuRVZFTlRfQ0hBTkdFX1ZJRVcsIEBwcmV2aW91cywgQGN1cnJlbnRcbiAgICAgICAgQHRyaWdnZXIgTmF2LkVWRU5UX0NIQU5HRV9TVUJfVklFVywgQGN1cnJlbnRcblxuICAgICAgICBpZiBAQ0RfQ0UoKS5hcHBWaWV3Lm1vZGFsTWFuYWdlci5pc09wZW4oKSB0aGVuIEBDRF9DRSgpLmFwcFZpZXcubW9kYWxNYW5hZ2VyLmhpZGVPcGVuTW9kYWwoKVxuXG4gICAgICAgICMgQHRyYWNrUGFnZVZpZXcoKVxuXG4gICAgICAgIG51bGxcblxuICAgICMgdHJhY2tQYWdlVmlldyA6ID0+XG5cbiAgICAjICAgICByZXR1cm4gdW5sZXNzIHdpbmRvdy5nYSBhbmQgQGNoYW5nZVZpZXdDb3VudCA+IDFcblxuICAgICMgICAgIGdhICdzZW5kJywgJ3BhZ2V2aWV3JywgJ3BhZ2UnIDogd2luZG93LmxvY2F0aW9uLmhyZWYuc3BsaXQoQENEKCkuQkFTRV9VUkwpWzFdIG9yICcvJ1xuXG4gICAgIyAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IE5hdlxuIiwiY2xhc3MgUm91dGVyIGV4dGVuZHMgQmFja2JvbmUuUm91dGVyXG5cbiAgICBARVZFTlRfSEFTSF9DSEFOR0VEIDogJ0VWRU5UX0hBU0hfQ0hBTkdFRCdcblxuICAgIEZJUlNUX1JPVVRFIDogdHJ1ZVxuXG4gICAgcm91dGVzIDpcbiAgICAgICAgJygvKSg6YXJlYSkoLzpzdWIpKC8pJyA6ICdoYXNoQ2hhbmdlZCdcbiAgICAgICAgJyphY3Rpb25zJyAgICAgICAgICAgICA6ICduYXZpZ2F0ZVRvJ1xuXG4gICAgYXJlYSAgIDogbnVsbFxuICAgIHN1YiAgICA6IG51bGxcbiAgICBwYXJhbXMgOiBudWxsXG5cbiAgICBzdGFydCA6ID0+XG5cbiAgICAgICAgQmFja2JvbmUuaGlzdG9yeS5zdGFydCBcbiAgICAgICAgICAgIHB1c2hTdGF0ZSA6IHRydWVcbiAgICAgICAgICAgIHJvb3QgICAgICA6ICcvJ1xuXG4gICAgICAgIG51bGxcblxuICAgIGhhc2hDaGFuZ2VkIDogKEBhcmVhID0gbnVsbCwgQHN1YiA9IG51bGwpID0+XG5cbiAgICAgICAgY29uc29sZS5sb2cgXCI+PiBFVkVOVF9IQVNIX0NIQU5HRUQgQGFyZWEgPSAje0BhcmVhfSwgQHN1YiA9ICN7QHN1Yn0gPDxcIlxuXG4gICAgICAgIGlmIEBGSVJTVF9ST1VURSB0aGVuIEBGSVJTVF9ST1VURSA9IGZhbHNlXG5cbiAgICAgICAgaWYgIUBhcmVhIHRoZW4gQGFyZWEgPSBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRVxuXG4gICAgICAgIEB0cmlnZ2VyIFJvdXRlci5FVkVOVF9IQVNIX0NIQU5HRUQsIEBhcmVhLCBAc3ViLCBAcGFyYW1zXG5cbiAgICAgICAgbnVsbFxuXG4gICAgbmF2aWdhdGVUbyA6ICh3aGVyZSA9ICcnLCB0cmlnZ2VyID0gdHJ1ZSwgcmVwbGFjZSA9IGZhbHNlLCBAcGFyYW1zKSA9PlxuXG4gICAgICAgIGlmIHdoZXJlLmNoYXJBdCgwKSBpc250IFwiL1wiXG4gICAgICAgICAgICB3aGVyZSA9IFwiLyN7d2hlcmV9XCJcbiAgICAgICAgaWYgd2hlcmUuY2hhckF0KCB3aGVyZS5sZW5ndGgtMSApIGlzbnQgXCIvXCJcbiAgICAgICAgICAgIHdoZXJlID0gXCIje3doZXJlfS9cIlxuXG4gICAgICAgIGlmICF0cmlnZ2VyXG4gICAgICAgICAgICBAdHJpZ2dlciBSb3V0ZXIuRVZFTlRfSEFTSF9DSEFOR0VELCB3aGVyZSwgbnVsbCwgQHBhcmFtc1xuICAgICAgICAgICAgcmV0dXJuXG5cbiAgICAgICAgQG5hdmlnYXRlIHdoZXJlLCB0cmlnZ2VyOiB0cnVlLCByZXBsYWNlOiByZXBsYWNlXG5cbiAgICAgICAgbnVsbFxuXG4gICAgQ0RfQ0UgOiA9PlxuXG4gICAgICAgIHJldHVybiB3aW5kb3cuQ0RfQ0VcblxubW9kdWxlLmV4cG9ydHMgPSBSb3V0ZXJcbiIsIiMjI1xuQW5hbHl0aWNzIHdyYXBwZXJcbiMjI1xuY2xhc3MgQW5hbHl0aWNzXG5cbiAgICB0YWdzICAgIDogbnVsbFxuICAgIHN0YXJ0ZWQgOiBmYWxzZVxuXG4gICAgYXR0ZW1wdHMgICAgICAgIDogMFxuICAgIGFsbG93ZWRBdHRlbXB0cyA6IDVcblxuICAgIGNvbnN0cnVjdG9yIDogKGRhdGEsIEBjYWxsYmFjaykgLT5cblxuICAgICAgICBAcGFyc2VEYXRhIGRhdGFcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG4gICAgcGFyc2VEYXRhIDogKGRhdGEpID0+XG5cbiAgICAgICAgQHRhZ3MgICAgPSBkYXRhXG4gICAgICAgIEBzdGFydGVkID0gdHJ1ZVxuICAgICAgICBAY2FsbGJhY2s/KClcblxuICAgICAgICBudWxsXG5cbiAgICAjIyNcbiAgICBAcGFyYW0gc3RyaW5nIGlkIG9mIHRoZSB0cmFja2luZyB0YWcgdG8gYmUgcHVzaGVkIG9uIEFuYWx5dGljcyBcbiAgICAjIyNcbiAgICB0cmFjayA6IChwYXJhbSkgPT5cblxuICAgICAgICByZXR1cm4gaWYgIUBzdGFydGVkXG5cbiAgICAgICAgaWYgcGFyYW1cblxuICAgICAgICAgICAgdiA9IEB0YWdzW3BhcmFtXVxuXG4gICAgICAgICAgICBpZiB2XG5cbiAgICAgICAgICAgICAgICBhcmdzID0gWydzZW5kJywgJ2V2ZW50J11cbiAgICAgICAgICAgICAgICAoIGFyZ3MucHVzaChhcmcpICkgZm9yIGFyZyBpbiB2XG5cbiAgICAgICAgICAgICAgICAjIGxvYWRpbmcgR0EgYWZ0ZXIgbWFpbiBhcHAgSlMsIHNvIGV4dGVybmFsIHNjcmlwdCBtYXkgbm90IGJlIGhlcmUgeWV0XG4gICAgICAgICAgICAgICAgaWYgd2luZG93LmdhXG4gICAgICAgICAgICAgICAgICAgIGdhLmFwcGx5IG51bGwsIGFyZ3NcbiAgICAgICAgICAgICAgICBlbHNlIGlmIEBhdHRlbXB0cyA+PSBAYWxsb3dlZEF0dGVtcHRzXG4gICAgICAgICAgICAgICAgICAgIEBzdGFydGVkID0gZmFsc2VcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQgPT5cbiAgICAgICAgICAgICAgICAgICAgICAgIEB0cmFjayBwYXJhbVxuICAgICAgICAgICAgICAgICAgICAgICAgQGF0dGVtcHRzKytcbiAgICAgICAgICAgICAgICAgICAgLCAyMDAwXG5cbiAgICAgICAgbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEFuYWx5dGljc1xuIiwiQWJzdHJhY3REYXRhID0gcmVxdWlyZSAnLi4vZGF0YS9BYnN0cmFjdERhdGEnXG5GYWNlYm9vayAgICAgPSByZXF1aXJlICcuLi91dGlscy9GYWNlYm9vaydcbkdvb2dsZVBsdXMgICA9IHJlcXVpcmUgJy4uL3V0aWxzL0dvb2dsZVBsdXMnXG5cbmNsYXNzIEF1dGhNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3REYXRhXG5cblx0dXNlckRhdGEgIDogbnVsbFxuXG5cdCMgQHByb2Nlc3MgdHJ1ZSBkdXJpbmcgbG9naW4gcHJvY2Vzc1xuXHRwcm9jZXNzICAgICAgOiBmYWxzZVxuXHRwcm9jZXNzVGltZXIgOiBudWxsXG5cdHByb2Nlc3NXYWl0ICA6IDUwMDBcblxuXHRjb25zdHJ1Y3RvciA6IC0+XG5cblx0XHRAdXNlckRhdGEgID0gQENEX0NFKCkuYXBwRGF0YS5VU0VSXG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGxvZ2luIDogKHNlcnZpY2UsIGNiPW51bGwpID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwiKysrKyBQUk9DRVNTIFwiLEBwcm9jZXNzXG5cblx0XHRyZXR1cm4gaWYgQHByb2Nlc3NcblxuXHRcdEBzaG93TG9hZGVyKClcblx0XHRAcHJvY2VzcyA9IHRydWVcblxuXHRcdCRkYXRhRGZkID0gJC5EZWZlcnJlZCgpXG5cblx0XHRzd2l0Y2ggc2VydmljZVxuXHRcdFx0d2hlbiAnZ29vZ2xlJ1xuXHRcdFx0XHRHb29nbGVQbHVzLmxvZ2luICRkYXRhRGZkXG5cdFx0XHR3aGVuICdmYWNlYm9vaydcblx0XHRcdFx0RmFjZWJvb2subG9naW4gJGRhdGFEZmRcblxuXHRcdCRkYXRhRGZkLmRvbmUgKHJlcykgPT4gQGF1dGhTdWNjZXNzIHNlcnZpY2UsIHJlc1xuXHRcdCRkYXRhRGZkLmZhaWwgKHJlcykgPT4gQGF1dGhGYWlsIHNlcnZpY2UsIHJlc1xuXHRcdCRkYXRhRGZkLmFsd2F5cyAoKSA9PiBAYXV0aENhbGxiYWNrIGNiXG5cblx0XHQjIyNcblx0XHRVbmZvcnR1bmF0ZWx5IG5vIGNhbGxiYWNrIGlzIGZpcmVkIGlmIHVzZXIgbWFudWFsbHkgY2xvc2VzIEcrIGxvZ2luIG1vZGFsLFxuXHRcdHNvIHRoaXMgaXMgdG8gYWxsb3cgdGhlbSB0byBjbG9zZSB3aW5kb3cgYW5kIHRoZW4gc3Vic2VxdWVudGx5IHRyeSB0byBsb2cgaW4gYWdhaW4uLi5cblx0XHQjIyNcblx0XHRAcHJvY2Vzc1RpbWVyID0gc2V0VGltZW91dCBAYXV0aENhbGxiYWNrLCBAcHJvY2Vzc1dhaXRcblxuXHRcdCRkYXRhRGZkXG5cblx0YXV0aFN1Y2Nlc3MgOiAoc2VydmljZSwgZGF0YSkgPT5cblxuXHRcdCMgY29uc29sZS5sb2cgXCJsb2dpbiBjYWxsYmFjayBmb3IgI3tzZXJ2aWNlfSwgZGF0YSA9PiBcIiwgZGF0YVxuXG5cdFx0bnVsbFxuXG5cdGF1dGhGYWlsIDogKHNlcnZpY2UsIGRhdGEpID0+XG5cblx0XHQjIGNvbnNvbGUubG9nIFwibG9naW4gZmFpbCBmb3IgI3tzZXJ2aWNlfSA9PiBcIiwgZGF0YVxuXG5cdFx0bnVsbFxuXG5cdGF1dGhDYWxsYmFjayA6IChjYj1udWxsKSA9PlxuXG5cdFx0cmV0dXJuIHVubGVzcyBAcHJvY2Vzc1xuXG5cdFx0Y2xlYXJUaW1lb3V0IEBwcm9jZXNzVGltZXJcblxuXHRcdEBoaWRlTG9hZGVyKClcblx0XHRAcHJvY2VzcyA9IGZhbHNlXG5cblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdCMjI1xuXHRzaG93IC8gaGlkZSBzb21lIFVJIGluZGljYXRvciB0aGF0IHdlIGFyZSB3YWl0aW5nIGZvciBzb2NpYWwgbmV0d29yayB0byByZXNwb25kXG5cdCMjI1xuXHRzaG93TG9hZGVyIDogPT5cblxuXHRcdCMgY29uc29sZS5sb2cgXCJzaG93TG9hZGVyXCJcblxuXHRcdG51bGxcblxuXHRoaWRlTG9hZGVyIDogPT5cblxuXHRcdCMgY29uc29sZS5sb2cgXCJoaWRlTG9hZGVyXCJcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBdXRoTWFuYWdlclxuIiwiZW5jb2RlID0gcmVxdWlyZSAnZW50L2VuY29kZSdcblxuY2xhc3MgQ29kZVdvcmRUcmFuc2l0aW9uZXJcblxuXHRAY29uZmlnIDpcblx0XHRNSU5fV1JPTkdfQ0hBUlMgOiAxXG5cdFx0TUFYX1dST05HX0NIQVJTIDogN1xuXG5cdFx0TUlOX0NIQVJfSU5fREVMQVkgOiA0MFxuXHRcdE1BWF9DSEFSX0lOX0RFTEFZIDogNzBcblxuXHRcdE1JTl9DSEFSX09VVF9ERUxBWSA6IDQwXG5cdFx0TUFYX0NIQVJfT1VUX0RFTEFZIDogNzBcblxuXHRcdENIQVJTIDogJ2FiY2RlZmhpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5IT8qKClAwqMkJV4mXy0rPVtde306O1xcJ1wiXFxcXHw8PiwuL35gJy5zcGxpdCgnJykubWFwKGVuY29kZSlcblxuXHRcdENIQVJfVEVNUExBVEUgOiBcIjxzcGFuIGRhdGEtY29kZXRleHQtY2hhcj1cXFwie3sgY2hhciB9fVxcXCIgZGF0YS1jb2RldGV4dC1jaGFyLXN0YXRlPVxcXCJ7eyBzdGF0ZSB9fVxcXCI+e3sgY2hhciB9fTwvc3Bhbj5cIlxuXG5cdEBfd29yZENhY2hlIDoge31cblxuXHRAX2dldFdvcmRGcm9tQ2FjaGUgOiAoJGVsLCBpbml0aWFsU3RhdGU9bnVsbCkgPT5cblxuXHRcdGlkID0gJGVsLmF0dHIoJ2RhdGEtY29kZXdvcmQtaWQnKVxuXG5cdFx0aWYgaWQgYW5kIEBfd29yZENhY2hlWyBpZCBdXG5cdFx0XHR3b3JkID0gQF93b3JkQ2FjaGVbIGlkIF1cblx0XHRlbHNlXG5cdFx0XHRAX3dyYXBDaGFycyAkZWwsIGluaXRpYWxTdGF0ZVxuXHRcdFx0d29yZCA9IEBfYWRkV29yZFRvQ2FjaGUgJGVsXG5cblx0XHR3b3JkXG5cblx0QF9hZGRXb3JkVG9DYWNoZSA6ICgkZWwpID0+XG5cblx0XHRjaGFycyA9IFtdXG5cblx0XHQkZWwuZmluZCgnW2RhdGEtY29kZXRleHQtY2hhcl0nKS5lYWNoIChpLCBlbCkgPT5cblx0XHRcdCRjaGFyRWwgPSAkKGVsKVxuXHRcdFx0Y2hhcnMucHVzaFxuXHRcdFx0XHQkZWwgICAgICAgIDogJGNoYXJFbFxuXHRcdFx0XHRyaWdodENoYXIgIDogJGNoYXJFbC5hdHRyKCdkYXRhLWNvZGV0ZXh0LWNoYXInKVxuXG5cdFx0aWQgPSBfLnVuaXF1ZUlkKClcblx0XHQkZWwuYXR0ciAnZGF0YS1jb2Rld29yZC1pZCcsIGlkXG5cblx0XHRAX3dvcmRDYWNoZVsgaWQgXSA9XG5cdFx0XHR3b3JkICAgIDogXy5wbHVjayhjaGFycywgJ3JpZ2h0Q2hhcicpLmpvaW4oJycpXG5cdFx0XHQkZWwgICAgIDogJGVsXG5cdFx0XHRjaGFycyAgIDogY2hhcnNcblx0XHRcdHZpc2libGUgOiB0cnVlXG5cblx0XHRAX3dvcmRDYWNoZVsgaWQgXVxuXG5cdEBfd3JhcENoYXJzIDogKCRlbCwgaW5pdGlhbFN0YXRlPW51bGwpID0+XG5cblx0XHRjaGFycyA9ICRlbC50ZXh0KCkuc3BsaXQoJycpXG5cdFx0c3RhdGUgPSBpbml0aWFsU3RhdGUgb3IgJGVsLmF0dHIoJ2RhdGEtY29kZXdvcmQtaW5pdGlhbC1zdGF0ZScpIG9yIFwiXCJcblx0XHRodG1sID0gW11cblx0XHRmb3IgY2hhciBpbiBjaGFyc1xuXHRcdFx0aWYgY2hhciBpcyAnICcgdGhlbiBjaGFyID0gJyZuYnNwOydcblx0XHRcdGh0bWwucHVzaCBAX3N1cHBsYW50U3RyaW5nIEBjb25maWcuQ0hBUl9URU1QTEFURSwgY2hhciA6IGNoYXIsIHN0YXRlOiBzdGF0ZVxuXG5cdFx0JGVsLmh0bWwgaHRtbC5qb2luKCcnKVxuXG5cdFx0bnVsbFxuXG5cdCMgQHBhcmFtIHRhcmdldCA9ICdyaWdodCcsICd3cm9uZycsICdlbXB0eSdcblx0QF9wcmVwYXJlV29yZCA6ICh3b3JkLCB0YXJnZXQsIGNoYXJTdGF0ZT0nJykgPT5cblxuXHRcdGZvciBjaGFyLCBpIGluIHdvcmQuY2hhcnNcblxuXHRcdFx0dGFyZ2V0Q2hhciA9IHN3aXRjaCB0cnVlXG5cdFx0XHRcdHdoZW4gdGFyZ2V0IGlzICdyaWdodCcgdGhlbiBjaGFyLnJpZ2h0Q2hhclxuXHRcdFx0XHR3aGVuIHRhcmdldCBpcyAnd3JvbmcnIHRoZW4gQF9nZXRSYW5kb21DaGFyKClcblx0XHRcdFx0d2hlbiB0YXJnZXQgaXMgJ2VtcHR5JyB0aGVuICcnXG5cdFx0XHRcdGVsc2UgdGFyZ2V0LmNoYXJBdChpKSBvciAnJ1xuXG5cdFx0XHRpZiB0YXJnZXRDaGFyIGlzICcgJyB0aGVuIHRhcmdldENoYXIgPSAnJm5ic3A7J1xuXG5cdFx0XHRjaGFyLndyb25nQ2hhcnMgPSBAX2dldFJhbmRvbVdyb25nQ2hhcnMoKVxuXHRcdFx0Y2hhci50YXJnZXRDaGFyID0gdGFyZ2V0Q2hhclxuXHRcdFx0Y2hhci5jaGFyU3RhdGUgID0gY2hhclN0YXRlXG5cblx0XHRudWxsXG5cblx0QF9nZXRSYW5kb21Xcm9uZ0NoYXJzIDogPT5cblxuXHRcdGNoYXJzID0gW11cblxuXHRcdGNoYXJDb3VudCA9IF8ucmFuZG9tIEBjb25maWcuTUlOX1dST05HX0NIQVJTLCBAY29uZmlnLk1BWF9XUk9OR19DSEFSU1xuXG5cdFx0Zm9yIGkgaW4gWzAuLi5jaGFyQ291bnRdXG5cdFx0XHRjaGFycy5wdXNoXG5cdFx0XHRcdGNoYXIgICAgIDogQF9nZXRSYW5kb21DaGFyKClcblx0XHRcdFx0aW5EZWxheSAgOiBfLnJhbmRvbSBAY29uZmlnLk1JTl9DSEFSX0lOX0RFTEFZLCBAY29uZmlnLk1BWF9DSEFSX0lOX0RFTEFZXG5cdFx0XHRcdG91dERlbGF5IDogXy5yYW5kb20gQGNvbmZpZy5NSU5fQ0hBUl9PVVRfREVMQVksIEBjb25maWcuTUFYX0NIQVJfT1VUX0RFTEFZXG5cblx0XHRjaGFyc1xuXG5cdEBfZ2V0UmFuZG9tQ2hhciA6ID0+XG5cblx0XHRjaGFyID0gQGNvbmZpZy5DSEFSU1sgXy5yYW5kb20oMCwgQGNvbmZpZy5DSEFSUy5sZW5ndGgtMSkgXVxuXG5cdFx0Y2hhclxuXG5cdEBfZ2V0TG9uZ2VzdENoYXJEdXJhdGlvbiA6IChjaGFycykgPT5cblxuXHRcdGxvbmdlc3RUaW1lID0gMFxuXHRcdGxvbmdlc3RUaW1lSWR4ID0gMFxuXG5cdFx0Zm9yIGNoYXIsIGkgaW4gY2hhcnNcblxuXHRcdFx0dGltZSA9IDBcblx0XHRcdCh0aW1lICs9IHdyb25nQ2hhci5pbkRlbGF5ICsgd3JvbmdDaGFyLm91dERlbGF5KSBmb3Igd3JvbmdDaGFyIGluIGNoYXIud3JvbmdDaGFyc1xuXHRcdFx0aWYgdGltZSA+IGxvbmdlc3RUaW1lXG5cdFx0XHRcdGxvbmdlc3RUaW1lID0gdGltZVxuXHRcdFx0XHRsb25nZXN0VGltZUlkeCA9IGlcblxuXHRcdGxvbmdlc3RUaW1lSWR4XG5cblx0QF9hbmltYXRlQ2hhcnMgOiAod29yZCwgc2VxdWVudGlhbCwgY2IpID0+XG5cblx0XHRhY3RpdmVDaGFyID0gMFxuXG5cdFx0aWYgc2VxdWVudGlhbFxuXHRcdFx0QF9hbmltYXRlQ2hhciB3b3JkLmNoYXJzLCBhY3RpdmVDaGFyLCB0cnVlLCBjYlxuXHRcdGVsc2Vcblx0XHRcdGxvbmdlc3RDaGFySWR4ID0gQF9nZXRMb25nZXN0Q2hhckR1cmF0aW9uIHdvcmQuY2hhcnNcblx0XHRcdGZvciBjaGFyLCBpIGluIHdvcmQuY2hhcnNcblx0XHRcdFx0YXJncyA9IFsgd29yZC5jaGFycywgaSwgZmFsc2UgXVxuXHRcdFx0XHRpZiBpIGlzIGxvbmdlc3RDaGFySWR4IHRoZW4gYXJncy5wdXNoIGNiXG5cdFx0XHRcdEBfYW5pbWF0ZUNoYXIuYXBwbHkgQCwgYXJnc1xuXG5cdFx0bnVsbFxuXG5cdEBfYW5pbWF0ZUNoYXIgOiAoY2hhcnMsIGlkeCwgcmVjdXJzZSwgY2IpID0+XG5cblx0XHRjaGFyID0gY2hhcnNbaWR4XVxuXG5cdFx0aWYgcmVjdXJzZVxuXG5cdFx0XHRAX2FuaW1hdGVXcm9uZ0NoYXJzIGNoYXIsID0+XG5cblx0XHRcdFx0aWYgaWR4IGlzIGNoYXJzLmxlbmd0aC0xXG5cdFx0XHRcdFx0QF9hbmltYXRlQ2hhcnNEb25lIGNiXG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRAX2FuaW1hdGVDaGFyIGNoYXJzLCBpZHgrMSwgcmVjdXJzZSwgY2JcblxuXHRcdGVsc2VcblxuXHRcdFx0aWYgdHlwZW9mIGNiIGlzICdmdW5jdGlvbidcblx0XHRcdFx0QF9hbmltYXRlV3JvbmdDaGFycyBjaGFyLCA9PiBAX2FuaW1hdGVDaGFyc0RvbmUgY2Jcblx0XHRcdGVsc2Vcblx0XHRcdFx0QF9hbmltYXRlV3JvbmdDaGFycyBjaGFyXG5cblx0XHRudWxsXG5cblx0QF9hbmltYXRlV3JvbmdDaGFycyA6IChjaGFyLCBjYikgPT5cblxuXHRcdGlmIGNoYXIud3JvbmdDaGFycy5sZW5ndGhcblxuXHRcdFx0d3JvbmdDaGFyID0gY2hhci53cm9uZ0NoYXJzLnNoaWZ0KClcblxuXHRcdFx0c2V0VGltZW91dCA9PlxuXHRcdFx0XHRjaGFyLiRlbC5odG1sIHdyb25nQ2hhci5jaGFyXG5cblx0XHRcdFx0c2V0VGltZW91dCA9PlxuXHRcdFx0XHRcdEBfYW5pbWF0ZVdyb25nQ2hhcnMgY2hhciwgY2Jcblx0XHRcdFx0LCB3cm9uZ0NoYXIub3V0RGVsYXlcblxuXHRcdFx0LCB3cm9uZ0NoYXIuaW5EZWxheVxuXG5cdFx0ZWxzZVxuXG5cdFx0XHRjaGFyLiRlbFxuXHRcdFx0XHQuYXR0cignZGF0YS1jb2RldGV4dC1jaGFyLXN0YXRlJywgY2hhci5jaGFyU3RhdGUpXG5cdFx0XHRcdC5odG1sKGNoYXIudGFyZ2V0Q2hhcilcblxuXHRcdFx0Y2I/KClcblxuXHRcdG51bGxcblxuXHRAX2FuaW1hdGVDaGFyc0RvbmUgOiAoY2IpID0+XG5cblx0XHRjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdEBfc3VwcGxhbnRTdHJpbmcgOiAoc3RyLCB2YWxzKSA9PlxuXG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlIC97eyAoW157fV0qKSB9fS9nLCAoYSwgYikgPT5cblx0XHRcdHIgPSB2YWxzW2JdXG5cdFx0XHQoaWYgdHlwZW9mIHIgaXMgXCJzdHJpbmdcIiBvciB0eXBlb2YgciBpcyBcIm51bWJlclwiIHRoZW4gciBlbHNlIGEpXG5cblx0QHRvIDogKHRhcmdldFRleHQsICRlbCwgY2hhclN0YXRlLCBzZXF1ZW50aWFsPWZhbHNlLCBjYj1udWxsKSA9PlxuXG5cdFx0aWYgXy5pc0FycmF5ICRlbFxuXHRcdFx0KEB0byh0YXJnZXRUZXh0LCBfJGVsLCBjaGFyU3RhdGUsIGNiKSkgZm9yIF8kZWwgaW4gJGVsXG5cdFx0XHRyZXR1cm5cblxuXHRcdHdvcmQgPSBAX2dldFdvcmRGcm9tQ2FjaGUgJGVsXG5cdFx0d29yZC52aXNpYmxlID0gdHJ1ZVxuXG5cdFx0QF9wcmVwYXJlV29yZCB3b3JkLCB0YXJnZXRUZXh0LCBjaGFyU3RhdGVcblx0XHRAX2FuaW1hdGVDaGFycyB3b3JkLCBzZXF1ZW50aWFsLCBjYlxuXG5cdFx0bnVsbFxuXG5cdEBpbiA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAaW4oXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXHRcdHdvcmQudmlzaWJsZSA9IHRydWVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ3JpZ2h0JywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAb3V0IDogKCRlbCwgY2hhclN0YXRlLCBzZXF1ZW50aWFsPWZhbHNlLCBjYj1udWxsKSA9PlxuXG5cdFx0aWYgXy5pc0FycmF5ICRlbFxuXHRcdFx0KEBvdXQoXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXHRcdHJldHVybiBpZiAhd29yZC52aXNpYmxlXG5cblx0XHR3b3JkLnZpc2libGUgPSBmYWxzZVxuXG5cdFx0QF9wcmVwYXJlV29yZCB3b3JkLCAnZW1wdHknLCBjaGFyU3RhdGVcblx0XHRAX2FuaW1hdGVDaGFycyB3b3JkLCBzZXF1ZW50aWFsLCBjYlxuXG5cdFx0bnVsbFxuXG5cdEBzY3JhbWJsZSA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAc2NyYW1ibGUoXyRlbCwgY2hhclN0YXRlLCBjYikpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHR3b3JkID0gQF9nZXRXb3JkRnJvbUNhY2hlICRlbFxuXG5cdFx0cmV0dXJuIGlmICF3b3JkLnZpc2libGVcblxuXHRcdEBfcHJlcGFyZVdvcmQgd29yZCwgJ3dyb25nJywgY2hhclN0YXRlXG5cdFx0QF9hbmltYXRlQ2hhcnMgd29yZCwgc2VxdWVudGlhbCwgY2JcblxuXHRcdG51bGxcblxuXHRAdW5zY3JhbWJsZSA6ICgkZWwsIGNoYXJTdGF0ZSwgc2VxdWVudGlhbD1mYWxzZSwgY2I9bnVsbCkgPT5cblxuXHRcdGlmIF8uaXNBcnJheSAkZWxcblx0XHRcdChAdW5zY3JhbWJsZShfJGVsLCBjaGFyU3RhdGUsIGNiKSkgZm9yIF8kZWwgaW4gJGVsXG5cdFx0XHRyZXR1cm5cblxuXHRcdHdvcmQgPSBAX2dldFdvcmRGcm9tQ2FjaGUgJGVsXG5cblx0XHRyZXR1cm4gaWYgIXdvcmQudmlzaWJsZVxuXG5cdFx0QF9wcmVwYXJlV29yZCB3b3JkLCAncmlnaHQnLCBjaGFyU3RhdGVcblx0XHRAX2FuaW1hdGVDaGFycyB3b3JkLCBzZXF1ZW50aWFsLCBjYlxuXG5cdFx0bnVsbFxuXG5cdEBwcmVwYXJlIDogKCRlbCwgaW5pdGlhbFN0YXRlKSA9PlxuXG5cdFx0aWYgXy5pc0FycmF5ICRlbFxuXHRcdFx0KEBwcmVwYXJlKF8kZWwsIGluaXRpYWxTdGF0ZSkpIGZvciBfJGVsIGluICRlbFxuXHRcdFx0cmV0dXJuXG5cblx0XHRAX2dldFdvcmRGcm9tQ2FjaGUgJGVsLCBpbml0aWFsU3RhdGVcblxuXHRcdG51bGxcblxuXHRAZ2V0U2NyYW1ibGVkV29yZCA6ICh3b3JkKSA9PlxuXG5cdFx0bmV3Q2hhcnMgPSBbXVxuXHRcdChuZXdDaGFycy5wdXNoIEBfZ2V0UmFuZG9tQ2hhcigpKSBmb3IgY2hhciBpbiB3b3JkLnNwbGl0KCcnKVxuXG5cdFx0cmV0dXJuIG5ld0NoYXJzLmpvaW4oJycpXG5cbm1vZHVsZS5leHBvcnRzID0gQ29kZVdvcmRUcmFuc2l0aW9uZXJcbiIsIkFic3RyYWN0RGF0YSA9IHJlcXVpcmUgJy4uL2RhdGEvQWJzdHJhY3REYXRhJ1xuXG4jIyNcblxuRmFjZWJvb2sgU0RLIHdyYXBwZXIgLSBsb2FkIGFzeW5jaHJvbm91c2x5LCBzb21lIGhlbHBlciBtZXRob2RzXG5cbiMjI1xuY2xhc3MgRmFjZWJvb2sgZXh0ZW5kcyBBYnN0cmFjdERhdGFcblxuXHRAdXJsICAgICAgICAgOiAnLy9jb25uZWN0LmZhY2Vib29rLm5ldC9lbl9VUy9hbGwuanMnXG5cblx0QHBlcm1pc3Npb25zIDogJ2VtYWlsJ1xuXG5cdEAkZGF0YURmZCAgICA6IG51bGxcblx0QGxvYWRlZCAgICAgIDogZmFsc2VcblxuXHRAbG9hZCA6ID0+XG5cblx0XHQjIyNcblx0XHRUTyBET1xuXHRcdGluY2x1ZGUgc2NyaXB0IGxvYWRlciB3aXRoIGNhbGxiYWNrIHRvIDppbml0XG5cdFx0IyMjXG5cdFx0IyByZXF1aXJlIFtAdXJsXSwgQGluaXRcblxuXHRcdG51bGxcblxuXHRAaW5pdCA6ID0+XG5cblx0XHRAbG9hZGVkID0gdHJ1ZVxuXG5cdFx0RkIuaW5pdFxuXHRcdFx0YXBwSWQgIDogd2luZG93LmNvbmZpZy5mYl9hcHBfaWRcblx0XHRcdHN0YXR1cyA6IGZhbHNlXG5cdFx0XHR4ZmJtbCAgOiBmYWxzZVxuXG5cdFx0bnVsbFxuXG5cdEBsb2dpbiA6IChAJGRhdGFEZmQpID0+XG5cblx0XHRpZiAhQGxvYWRlZCB0aGVuIHJldHVybiBAJGRhdGFEZmQucmVqZWN0ICdTREsgbm90IGxvYWRlZCdcblxuXHRcdEZCLmxvZ2luICggcmVzICkgPT5cblxuXHRcdFx0aWYgcmVzWydzdGF0dXMnXSBpcyAnY29ubmVjdGVkJ1xuXHRcdFx0XHRAZ2V0VXNlckRhdGEgcmVzWydhdXRoUmVzcG9uc2UnXVsnYWNjZXNzVG9rZW4nXVxuXHRcdFx0ZWxzZVxuXHRcdFx0XHRAJGRhdGFEZmQucmVqZWN0ICdubyB3YXkgam9zZSdcblxuXHRcdCwgeyBzY29wZTogQHBlcm1pc3Npb25zIH1cblxuXHRcdG51bGxcblxuXHRAZ2V0VXNlckRhdGEgOiAodG9rZW4pID0+XG5cblx0XHR1c2VyRGF0YSA9IHt9XG5cdFx0dXNlckRhdGEuYWNjZXNzX3Rva2VuID0gdG9rZW5cblxuXHRcdCRtZURmZCAgID0gJC5EZWZlcnJlZCgpXG5cdFx0JHBpY0RmZCAgPSAkLkRlZmVycmVkKClcblxuXHRcdEZCLmFwaSAnL21lJywgKHJlcykgLT5cblxuXHRcdFx0dXNlckRhdGEuZnVsbF9uYW1lID0gcmVzLm5hbWVcblx0XHRcdHVzZXJEYXRhLnNvY2lhbF9pZCA9IHJlcy5pZFxuXHRcdFx0dXNlckRhdGEuZW1haWwgICAgID0gcmVzLmVtYWlsIG9yIGZhbHNlXG5cdFx0XHQkbWVEZmQucmVzb2x2ZSgpXG5cblx0XHRGQi5hcGkgJy9tZS9waWN0dXJlJywgeyAnd2lkdGgnOiAnMjAwJyB9LCAocmVzKSAtPlxuXG5cdFx0XHR1c2VyRGF0YS5wcm9maWxlX3BpYyA9IHJlcy5kYXRhLnVybFxuXHRcdFx0JHBpY0RmZC5yZXNvbHZlKClcblxuXHRcdCQud2hlbigkbWVEZmQsICRwaWNEZmQpLmRvbmUgPT4gQCRkYXRhRGZkLnJlc29sdmUgdXNlckRhdGFcblxuXHRcdG51bGxcblxuXHRAc2hhcmUgOiAob3B0cywgY2IpID0+XG5cblx0XHRGQi51aSB7XG5cdFx0XHRtZXRob2QgICAgICA6IG9wdHMubWV0aG9kIG9yICdmZWVkJ1xuXHRcdFx0bmFtZSAgICAgICAgOiBvcHRzLm5hbWUgb3IgJydcblx0XHRcdGxpbmsgICAgICAgIDogb3B0cy5saW5rIG9yICcnXG5cdFx0XHRwaWN0dXJlICAgICA6IG9wdHMucGljdHVyZSBvciAnJ1xuXHRcdFx0Y2FwdGlvbiAgICAgOiBvcHRzLmNhcHRpb24gb3IgJydcblx0XHRcdGRlc2NyaXB0aW9uIDogb3B0cy5kZXNjcmlwdGlvbiBvciAnJ1xuXHRcdH0sIChyZXNwb25zZSkgLT5cblx0XHRcdGNiPyhyZXNwb25zZSlcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBGYWNlYm9va1xuIiwiQWJzdHJhY3REYXRhID0gcmVxdWlyZSAnLi4vZGF0YS9BYnN0cmFjdERhdGEnXG5cbiMjI1xuXG5Hb29nbGUrIFNESyB3cmFwcGVyIC0gbG9hZCBhc3luY2hyb25vdXNseSwgc29tZSBoZWxwZXIgbWV0aG9kc1xuXG4jIyNcbmNsYXNzIEdvb2dsZVBsdXMgZXh0ZW5kcyBBYnN0cmFjdERhdGFcblxuXHRAdXJsICAgICAgOiAnaHR0cHM6Ly9hcGlzLmdvb2dsZS5jb20vanMvY2xpZW50OnBsdXNvbmUuanMnXG5cblx0QHBhcmFtcyAgIDpcblx0XHQnY2xpZW50aWQnICAgICA6IG51bGxcblx0XHQnY2FsbGJhY2snICAgICA6IG51bGxcblx0XHQnc2NvcGUnICAgICAgICA6ICdodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL3VzZXJpbmZvLmVtYWlsJ1xuXHRcdCdjb29raWVwb2xpY3knIDogJ25vbmUnXG5cblx0QCRkYXRhRGZkIDogbnVsbFxuXHRAbG9hZGVkICAgOiBmYWxzZVxuXG5cdEBsb2FkIDogPT5cblxuXHRcdCMjI1xuXHRcdFRPIERPXG5cdFx0aW5jbHVkZSBzY3JpcHQgbG9hZGVyIHdpdGggY2FsbGJhY2sgdG8gOmluaXRcblx0XHQjIyNcblx0XHQjIHJlcXVpcmUgW0B1cmxdLCBAaW5pdFxuXG5cdFx0bnVsbFxuXG5cdEBpbml0IDogPT5cblxuXHRcdEBsb2FkZWQgPSB0cnVlXG5cblx0XHRAcGFyYW1zWydjbGllbnRpZCddID0gd2luZG93LmNvbmZpZy5ncF9hcHBfaWRcblx0XHRAcGFyYW1zWydjYWxsYmFjayddID0gQGxvZ2luQ2FsbGJhY2tcblxuXHRcdG51bGxcblxuXHRAbG9naW4gOiAoQCRkYXRhRGZkKSA9PlxuXG5cdFx0aWYgQGxvYWRlZFxuXHRcdFx0Z2FwaS5hdXRoLnNpZ25JbiBAcGFyYW1zXG5cdFx0ZWxzZVxuXHRcdFx0QCRkYXRhRGZkLnJlamVjdCAnU0RLIG5vdCBsb2FkZWQnXG5cblx0XHRudWxsXG5cblx0QGxvZ2luQ2FsbGJhY2sgOiAocmVzKSA9PlxuXG5cdFx0aWYgcmVzWydzdGF0dXMnXVsnc2lnbmVkX2luJ11cblx0XHRcdEBnZXRVc2VyRGF0YSByZXNbJ2FjY2Vzc190b2tlbiddXG5cdFx0ZWxzZSBpZiByZXNbJ2Vycm9yJ11bJ2FjY2Vzc19kZW5pZWQnXVxuXHRcdFx0QCRkYXRhRGZkLnJlamVjdCAnbm8gd2F5IGpvc2UnXG5cblx0XHRudWxsXG5cblx0QGdldFVzZXJEYXRhIDogKHRva2VuKSA9PlxuXG5cdFx0Z2FwaS5jbGllbnQubG9hZCAncGx1cycsJ3YxJywgPT5cblxuXHRcdFx0cmVxdWVzdCA9IGdhcGkuY2xpZW50LnBsdXMucGVvcGxlLmdldCAndXNlcklkJzogJ21lJ1xuXHRcdFx0cmVxdWVzdC5leGVjdXRlIChyZXMpID0+XG5cblx0XHRcdFx0dXNlckRhdGEgPVxuXHRcdFx0XHRcdGFjY2Vzc190b2tlbiA6IHRva2VuXG5cdFx0XHRcdFx0ZnVsbF9uYW1lICAgIDogcmVzLmRpc3BsYXlOYW1lXG5cdFx0XHRcdFx0c29jaWFsX2lkICAgIDogcmVzLmlkXG5cdFx0XHRcdFx0ZW1haWwgICAgICAgIDogaWYgcmVzLmVtYWlsc1swXSB0aGVuIHJlcy5lbWFpbHNbMF0udmFsdWUgZWxzZSBmYWxzZVxuXHRcdFx0XHRcdHByb2ZpbGVfcGljICA6IHJlcy5pbWFnZS51cmxcblxuXHRcdFx0XHRAJGRhdGFEZmQucmVzb2x2ZSB1c2VyRGF0YVxuXG5cdFx0bnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEdvb2dsZVBsdXNcbiIsIiMgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiMgICBNZWRpYSBRdWVyaWVzIE1hbmFnZXIgXG4jICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4jICAgXG4jICAgQGF1dGhvciA6IEbDoWJpbyBBemV2ZWRvIDxmYWJpby5hemV2ZWRvQHVuaXQ5LmNvbT4gVU5JVDlcbiMgICBAZGF0ZSAgIDogU2VwdGVtYmVyIDE0XG4jICAgXG4jICAgSW5zdHJ1Y3Rpb25zIGFyZSBvbiAvcHJvamVjdC9zYXNzL3V0aWxzL19yZXNwb25zaXZlLnNjc3MuXG5cbmNsYXNzIE1lZGlhUXVlcmllc1xuXG4gICAgIyBCcmVha3BvaW50c1xuICAgIEBTTUFMTCAgICAgICA6IFwic21hbGxcIlxuICAgIEBJUEFEICAgICAgICA6IFwiaXBhZFwiXG4gICAgQE1FRElVTSAgICAgIDogXCJtZWRpdW1cIlxuICAgIEBMQVJHRSAgICAgICA6IFwibGFyZ2VcIlxuICAgIEBFWFRSQV9MQVJHRSA6IFwiZXh0cmEtbGFyZ2VcIlxuXG4gICAgQHNldHVwIDogPT5cblxuICAgICAgICBNZWRpYVF1ZXJpZXMuU01BTExfQlJFQUtQT0lOVCAgPSB7bmFtZTogXCJTbWFsbFwiLCBicmVha3BvaW50czogW01lZGlhUXVlcmllcy5TTUFMTF19XG4gICAgICAgIE1lZGlhUXVlcmllcy5NRURJVU1fQlJFQUtQT0lOVCA9IHtuYW1lOiBcIk1lZGl1bVwiLCBicmVha3BvaW50czogW01lZGlhUXVlcmllcy5NRURJVU1dfVxuICAgICAgICBNZWRpYVF1ZXJpZXMuTEFSR0VfQlJFQUtQT0lOVCAgPSB7bmFtZTogXCJMYXJnZVwiLCBicmVha3BvaW50czogW01lZGlhUXVlcmllcy5JUEFELCBNZWRpYVF1ZXJpZXMuTEFSR0UsIE1lZGlhUXVlcmllcy5FWFRSQV9MQVJHRV19XG5cbiAgICAgICAgTWVkaWFRdWVyaWVzLkJSRUFLUE9JTlRTID0gW1xuICAgICAgICAgICAgTWVkaWFRdWVyaWVzLlNNQUxMX0JSRUFLUE9JTlRcbiAgICAgICAgICAgIE1lZGlhUXVlcmllcy5NRURJVU1fQlJFQUtQT0lOVFxuICAgICAgICAgICAgTWVkaWFRdWVyaWVzLkxBUkdFX0JSRUFLUE9JTlRcbiAgICAgICAgXVxuICAgICAgICByZXR1cm5cblxuICAgIEBnZXREZXZpY2VTdGF0ZSA6ID0+XG5cbiAgICAgICAgcmV0dXJuIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGRvY3VtZW50LmJvZHksIFwiYWZ0ZXJcIikuZ2V0UHJvcGVydHlWYWx1ZShcImNvbnRlbnRcIik7XG5cbiAgICBAZ2V0QnJlYWtwb2ludCA6ID0+XG5cbiAgICAgICAgc3RhdGUgPSBNZWRpYVF1ZXJpZXMuZ2V0RGV2aWNlU3RhdGUoKVxuXG4gICAgICAgIGZvciBpIGluIFswLi4uTWVkaWFRdWVyaWVzLkJSRUFLUE9JTlRTLmxlbmd0aF1cbiAgICAgICAgICAgIGlmIE1lZGlhUXVlcmllcy5CUkVBS1BPSU5UU1tpXS5icmVha3BvaW50cy5pbmRleE9mKHN0YXRlKSA+IC0xXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1lZGlhUXVlcmllcy5CUkVBS1BPSU5UU1tpXS5uYW1lXG5cbiAgICAgICAgcmV0dXJuIFwiXCJcblxuICAgIEBpc0JyZWFrcG9pbnQgOiAoYnJlYWtwb2ludCkgPT5cblxuICAgICAgICBmb3IgaSBpbiBbMC4uLmJyZWFrcG9pbnQuYnJlYWtwb2ludHMubGVuZ3RoXVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiBicmVha3BvaW50LmJyZWFrcG9pbnRzW2ldID09IE1lZGlhUXVlcmllcy5nZXREZXZpY2VTdGF0ZSgpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcblxuICAgICAgICByZXR1cm4gZmFsc2VcblxubW9kdWxlLmV4cG9ydHMgPSBNZWRpYVF1ZXJpZXMiLCJjbGFzcyBOdW1iZXJVdGlsc1xuXG4gICAgQE1BVEhfQ09TOiBNYXRoLmNvcyBcbiAgICBATUFUSF9TSU46IE1hdGguc2luIFxuICAgIEBNQVRIX1JBTkRPTTogTWF0aC5yYW5kb20gXG4gICAgQE1BVEhfQUJTOiBNYXRoLmFic1xuICAgIEBNQVRIX0FUQU4yOiBNYXRoLmF0YW4yXG5cbiAgICBAbGltaXQ6KG51bWJlciwgbWluLCBtYXgpLT5cbiAgICAgICAgcmV0dXJuIE1hdGgubWluKCBNYXRoLm1heChtaW4sbnVtYmVyKSwgbWF4IClcblxuICAgIEBnZXRSYW5kb21Db2xvcjogLT5cblxuICAgICAgICBsZXR0ZXJzID0gJzAxMjM0NTY3ODlBQkNERUYnLnNwbGl0KCcnKVxuICAgICAgICBjb2xvciA9ICcjJ1xuICAgICAgICBmb3IgaSBpbiBbMC4uLjZdXG4gICAgICAgICAgICBjb2xvciArPSBsZXR0ZXJzW01hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDE1KV1cbiAgICAgICAgY29sb3JcblxuICAgIEBnZXRUaW1lU3RhbXBEaWZmIDogKGRhdGUxLCBkYXRlMikgLT5cblxuICAgICAgICAjIEdldCAxIGRheSBpbiBtaWxsaXNlY29uZHNcbiAgICAgICAgb25lX2RheSA9IDEwMDAqNjAqNjAqMjRcbiAgICAgICAgdGltZSAgICA9IHt9XG5cbiAgICAgICAgIyBDb252ZXJ0IGJvdGggZGF0ZXMgdG8gbWlsbGlzZWNvbmRzXG4gICAgICAgIGRhdGUxX21zID0gZGF0ZTEuZ2V0VGltZSgpXG4gICAgICAgIGRhdGUyX21zID0gZGF0ZTIuZ2V0VGltZSgpXG5cbiAgICAgICAgIyBDYWxjdWxhdGUgdGhlIGRpZmZlcmVuY2UgaW4gbWlsbGlzZWNvbmRzXG4gICAgICAgIGRpZmZlcmVuY2VfbXMgPSBkYXRlMl9tcyAtIGRhdGUxX21zXG5cbiAgICAgICAgIyB0YWtlIG91dCBtaWxsaXNlY29uZHNcbiAgICAgICAgZGlmZmVyZW5jZV9tcyA9IGRpZmZlcmVuY2VfbXMvMTAwMFxuICAgICAgICB0aW1lLnNlY29uZHMgID0gTWF0aC5mbG9vcihkaWZmZXJlbmNlX21zICUgNjApXG5cbiAgICAgICAgZGlmZmVyZW5jZV9tcyA9IGRpZmZlcmVuY2VfbXMvNjAgXG4gICAgICAgIHRpbWUubWludXRlcyAgPSBNYXRoLmZsb29yKGRpZmZlcmVuY2VfbXMgJSA2MClcblxuICAgICAgICBkaWZmZXJlbmNlX21zID0gZGlmZmVyZW5jZV9tcy82MCBcbiAgICAgICAgdGltZS5ob3VycyAgICA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZV9tcyAlIDI0KSAgXG5cbiAgICAgICAgdGltZS5kYXlzICAgICA9IE1hdGguZmxvb3IoZGlmZmVyZW5jZV9tcy8yNClcblxuICAgICAgICB0aW1lXG5cbiAgICBAbWFwOiAoIG51bSwgbWluMSwgbWF4MSwgbWluMiwgbWF4Miwgcm91bmQgPSBmYWxzZSwgY29uc3RyYWluTWluID0gdHJ1ZSwgY29uc3RyYWluTWF4ID0gdHJ1ZSApIC0+XG4gICAgICAgIGlmIGNvbnN0cmFpbk1pbiBhbmQgbnVtIDwgbWluMSB0aGVuIHJldHVybiBtaW4yXG4gICAgICAgIGlmIGNvbnN0cmFpbk1heCBhbmQgbnVtID4gbWF4MSB0aGVuIHJldHVybiBtYXgyXG4gICAgICAgIFxuICAgICAgICBudW0xID0gKG51bSAtIG1pbjEpIC8gKG1heDEgLSBtaW4xKVxuICAgICAgICBudW0yID0gKG51bTEgKiAobWF4MiAtIG1pbjIpKSArIG1pbjJcbiAgICAgICAgaWYgcm91bmQgdGhlbiByZXR1cm4gTWF0aC5yb3VuZChudW0yKVxuXG4gICAgICAgIHJldHVybiBudW0yXG5cbiAgICBAdG9SYWRpYW5zOiAoIGRlZ3JlZSApIC0+XG4gICAgICAgIHJldHVybiBkZWdyZWUgKiAoIE1hdGguUEkgLyAxODAgKVxuXG4gICAgQHRvRGVncmVlOiAoIHJhZGlhbnMgKSAtPlxuICAgICAgICByZXR1cm4gcmFkaWFucyAqICggMTgwIC8gTWF0aC5QSSApXG5cbiAgICBAaXNJblJhbmdlOiAoIG51bSwgbWluLCBtYXgsIGNhbkJlRXF1YWwgKSAtPlxuICAgICAgICBpZiBjYW5CZUVxdWFsIHRoZW4gcmV0dXJuIG51bSA+PSBtaW4gJiYgbnVtIDw9IG1heFxuICAgICAgICBlbHNlIHJldHVybiBudW0gPj0gbWluICYmIG51bSA8PSBtYXhcblxuICAgICMgY29udmVydCBtZXRyZXMgaW4gdG8gbSAvIEtNXG4gICAgQGdldE5pY2VEaXN0YW5jZTogKG1ldHJlcykgPT5cblxuICAgICAgICBpZiBtZXRyZXMgPCAxMDAwXG5cbiAgICAgICAgICAgIHJldHVybiBcIiN7TWF0aC5yb3VuZChtZXRyZXMpfU1cIlxuXG4gICAgICAgIGVsc2VcblxuICAgICAgICAgICAga20gPSAobWV0cmVzLzEwMDApLnRvRml4ZWQoMilcbiAgICAgICAgICAgIHJldHVybiBcIiN7a219S01cIlxuXG4gICAgIyBmcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEyNjczMzhcbiAgICBAemVyb0ZpbGw6ICggbnVtYmVyLCB3aWR0aCApID0+XG5cbiAgICAgICAgd2lkdGggLT0gbnVtYmVyLnRvU3RyaW5nKCkubGVuZ3RoXG5cbiAgICAgICAgaWYgd2lkdGggPiAwXG4gICAgICAgICAgICByZXR1cm4gbmV3IEFycmF5KCB3aWR0aCArICgvXFwuLy50ZXN0KCBudW1iZXIgKSA/IDIgOiAxKSApLmpvaW4oICcwJyApICsgbnVtYmVyXG5cbiAgICAgICAgcmV0dXJuIG51bWJlciArIFwiXCIgIyBhbHdheXMgcmV0dXJuIGEgc3RyaW5nXG5cbm1vZHVsZS5leHBvcnRzID0gTnVtYmVyVXRpbHNcbiIsIiMjI1xuIyBSZXF1ZXN0ZXIgI1xuXG5XcmFwcGVyIGZvciBgJC5hamF4YCBjYWxsc1xuXG4jIyNcbmNsYXNzIFJlcXVlc3RlclxuXG4gICAgQHJlcXVlc3RzIDogW11cblxuICAgIEByZXF1ZXN0OiAoIGRhdGEgKSA9PlxuICAgICAgICAjIyNcbiAgICAgICAgYGRhdGEgPSB7YDxicj5cbiAgICAgICAgYCAgdXJsICAgICAgICAgOiBTdHJpbmdgPGJyPlxuICAgICAgICBgICB0eXBlICAgICAgICA6IFwiUE9TVC9HRVQvUFVUXCJgPGJyPlxuICAgICAgICBgICBkYXRhICAgICAgICA6IE9iamVjdGA8YnI+XG4gICAgICAgIGAgIGRhdGFUeXBlICAgIDogalF1ZXJ5IGRhdGFUeXBlYDxicj5cbiAgICAgICAgYCAgY29udGVudFR5cGUgOiBTdHJpbmdgPGJyPlxuICAgICAgICBgfWBcbiAgICAgICAgIyMjXG5cbiAgICAgICAgciA9ICQuYWpheCB7XG5cbiAgICAgICAgICAgIHVybCAgICAgICAgIDogZGF0YS51cmxcbiAgICAgICAgICAgIHR5cGUgICAgICAgIDogaWYgZGF0YS50eXBlIHRoZW4gZGF0YS50eXBlIGVsc2UgXCJQT1NUXCIsXG4gICAgICAgICAgICBkYXRhICAgICAgICA6IGlmIGRhdGEuZGF0YSB0aGVuIGRhdGEuZGF0YSBlbHNlIG51bGwsXG4gICAgICAgICAgICBkYXRhVHlwZSAgICA6IGlmIGRhdGEuZGF0YVR5cGUgdGhlbiBkYXRhLmRhdGFUeXBlIGVsc2UgXCJqc29uXCIsXG4gICAgICAgICAgICBjb250ZW50VHlwZSA6IGlmIGRhdGEuY29udGVudFR5cGUgdGhlbiBkYXRhLmNvbnRlbnRUeXBlIGVsc2UgXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLThcIixcbiAgICAgICAgICAgIHByb2Nlc3NEYXRhIDogaWYgZGF0YS5wcm9jZXNzRGF0YSAhPSBudWxsIGFuZCBkYXRhLnByb2Nlc3NEYXRhICE9IHVuZGVmaW5lZCB0aGVuIGRhdGEucHJvY2Vzc0RhdGEgZWxzZSB0cnVlXG5cbiAgICAgICAgfVxuXG4gICAgICAgIHIuZG9uZSBkYXRhLmRvbmVcbiAgICAgICAgci5mYWlsIGRhdGEuZmFpbFxuICAgICAgICBcbiAgICAgICAgclxuXG4gICAgQGFkZEltYWdlIDogKGRhdGEsIGRvbmUsIGZhaWwpID0+XG4gICAgICAgICMjI1xuICAgICAgICAqKiBVc2FnZTogPGJyPlxuICAgICAgICBgZGF0YSA9IGNhbnZhc3MudG9EYXRhVVJMKFwiaW1hZ2UvanBlZ1wiKS5zbGljZShcImRhdGE6aW1hZ2UvanBlZztiYXNlNjQsXCIubGVuZ3RoKWA8YnI+XG4gICAgICAgIGBSZXF1ZXN0ZXIuYWRkSW1hZ2UgZGF0YSwgXCJ6b2V0cm9wZVwiLCBAZG9uZSwgQGZhaWxgXG4gICAgICAgICMjI1xuXG4gICAgICAgIEByZXF1ZXN0XG4gICAgICAgICAgICB1cmwgICAgOiAnL2FwaS9pbWFnZXMvJ1xuICAgICAgICAgICAgdHlwZSAgIDogJ1BPU1QnXG4gICAgICAgICAgICBkYXRhICAgOiB7aW1hZ2VfYmFzZTY0IDogZW5jb2RlVVJJKGRhdGEpfVxuICAgICAgICAgICAgZG9uZSAgIDogZG9uZVxuICAgICAgICAgICAgZmFpbCAgIDogZmFpbFxuXG4gICAgICAgIG51bGxcblxuICAgIEBkZWxldGVJbWFnZSA6IChpZCwgZG9uZSwgZmFpbCkgPT5cbiAgICAgICAgXG4gICAgICAgIEByZXF1ZXN0XG4gICAgICAgICAgICB1cmwgICAgOiAnL2FwaS9pbWFnZXMvJytpZFxuICAgICAgICAgICAgdHlwZSAgIDogJ0RFTEVURSdcbiAgICAgICAgICAgIGRvbmUgICA6IGRvbmVcbiAgICAgICAgICAgIGZhaWwgICA6IGZhaWxcblxuICAgICAgICBudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gUmVxdWVzdGVyXG4iLCIjIyNcblNoYXJpbmcgY2xhc3MgZm9yIG5vbi1TREsgbG9hZGVkIHNvY2lhbCBuZXR3b3Jrcy5cbklmIFNESyBpcyBsb2FkZWQsIGFuZCBwcm92aWRlcyBzaGFyZSBtZXRob2RzLCB0aGVuIHVzZSB0aGF0IGNsYXNzIGluc3RlYWQsIGVnLiBgRmFjZWJvb2suc2hhcmVgIGluc3RlYWQgb2YgYFNoYXJlLmZhY2Vib29rYFxuIyMjXG5jbGFzcyBTaGFyZVxuXG4gICAgdXJsIDogbnVsbFxuXG4gICAgY29uc3RydWN0b3IgOiAtPlxuXG4gICAgICAgIEB1cmwgPSBAQ0RfQ0UoKS5TSVRFX1VSTFxuXG4gICAgICAgIHJldHVybiBudWxsXG5cbiAgICBvcGVuV2luIDogKHVybCwgdywgaCkgPT5cblxuICAgICAgICBsZWZ0ID0gKCBzY3JlZW4uYXZhaWxXaWR0aCAgLSB3ICkgPj4gMVxuICAgICAgICB0b3AgID0gKCBzY3JlZW4uYXZhaWxIZWlnaHQgLSBoICkgPj4gMVxuXG4gICAgICAgIHdpbmRvdy5vcGVuIHVybCwgJycsICd0b3A9Jyt0b3ArJyxsZWZ0PScrbGVmdCsnLHdpZHRoPScrdysnLGhlaWdodD0nK2grJyxsb2NhdGlvbj1ubyxtZW51YmFyPW5vJ1xuXG4gICAgICAgIG51bGxcblxuICAgIHBsdXMgOiAoIHVybCApID0+XG5cbiAgICAgICAgdXJsID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cHM6Ly9wbHVzLmdvb2dsZS5jb20vc2hhcmU/dXJsPSN7dXJsfVwiLCA2NTAsIDM4NVxuXG4gICAgICAgIG51bGxcblxuICAgIHBpbnRlcmVzdCA6ICh1cmwsIG1lZGlhLCBkZXNjcikgPT5cblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgbWVkaWEgPSBlbmNvZGVVUklDb21wb25lbnQobWVkaWEpXG4gICAgICAgIGRlc2NyID0gZW5jb2RlVVJJQ29tcG9uZW50KGRlc2NyKVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3d3dy5waW50ZXJlc3QuY29tL3Bpbi9jcmVhdGUvYnV0dG9uLz91cmw9I3t1cmx9Jm1lZGlhPSN7bWVkaWF9JmRlc2NyaXB0aW9uPSN7ZGVzY3J9XCIsIDczNSwgMzEwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgdHVtYmxyIDogKHVybCwgbWVkaWEsIGRlc2NyKSA9PlxuXG4gICAgICAgIHVybCAgID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuICAgICAgICBtZWRpYSA9IGVuY29kZVVSSUNvbXBvbmVudChtZWRpYSlcbiAgICAgICAgZGVzY3IgPSBlbmNvZGVVUklDb21wb25lbnQoZGVzY3IpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vd3d3LnR1bWJsci5jb20vc2hhcmUvcGhvdG8/c291cmNlPSN7bWVkaWF9JmNhcHRpb249I3tkZXNjcn0mY2xpY2tfdGhydT0je3VybH1cIiwgNDUwLCA0MzBcblxuICAgICAgICBudWxsXG5cbiAgICBmYWNlYm9vayA6ICggdXJsICwgY29weSA9ICcnKSA9PiBcblxuICAgICAgICB1cmwgICA9IGVuY29kZVVSSUNvbXBvbmVudCh1cmwgb3IgQHVybClcbiAgICAgICAgZGVjc3IgPSBlbmNvZGVVUklDb21wb25lbnQoY29weSlcblxuICAgICAgICBAb3BlbldpbiBcImh0dHA6Ly93d3cuZmFjZWJvb2suY29tL3NoYXJlLnBocD91PSN7dXJsfSZ0PSN7ZGVjc3J9XCIsIDYwMCwgMzAwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgdHdpdHRlciA6ICggdXJsICwgY29weSA9ICcnKSA9PlxuXG4gICAgICAgIHVybCAgID0gZW5jb2RlVVJJQ29tcG9uZW50KHVybCBvciBAdXJsKVxuICAgICAgICBpZiBjb3B5IGlzICcnXG4gICAgICAgICAgICBjb3B5ID0gQENEX0NFKCkubG9jYWxlLmdldCAnc2VvX3R3aXR0ZXJfY2FyZF9kZXNjcmlwdGlvbidcbiAgICAgICAgICAgIFxuICAgICAgICBkZXNjciA9IGVuY29kZVVSSUNvbXBvbmVudChjb3B5KVxuXG4gICAgICAgIEBvcGVuV2luIFwiaHR0cDovL3R3aXR0ZXIuY29tL2ludGVudC90d2VldC8/dGV4dD0je2Rlc2NyfSZ1cmw9I3t1cmx9XCIsIDYwMCwgMzAwXG5cbiAgICAgICAgbnVsbFxuXG4gICAgcmVucmVuIDogKCB1cmwgKSA9PiBcblxuICAgICAgICB1cmwgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vc2hhcmUucmVucmVuLmNvbS9zaGFyZS9idXR0b25zaGFyZS5kbz9saW5rPVwiICsgdXJsLCA2MDAsIDMwMFxuXG4gICAgICAgIG51bGxcblxuICAgIHdlaWJvIDogKCB1cmwgKSA9PiBcblxuICAgICAgICB1cmwgPSBlbmNvZGVVUklDb21wb25lbnQodXJsIG9yIEB1cmwpXG5cbiAgICAgICAgQG9wZW5XaW4gXCJodHRwOi8vc2VydmljZS53ZWliby5jb20vc2hhcmUvc2hhcmUucGhwP3VybD0je3VybH0mbGFuZ3VhZ2U9emhfY25cIiwgNjAwLCAzMDBcblxuICAgICAgICBudWxsXG5cbiAgICBDRF9DRSA6ID0+XG5cbiAgICAgICAgcmV0dXJuIHdpbmRvdy5DRF9DRVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNoYXJlXG4iLCJjbGFzcyBBYnN0cmFjdFZpZXcgZXh0ZW5kcyBCYWNrYm9uZS5WaWV3XG5cblx0ZWwgICAgICAgICAgIDogbnVsbFxuXHRpZCAgICAgICAgICAgOiBudWxsXG5cdGNoaWxkcmVuICAgICA6IG51bGxcblx0dGVtcGxhdGUgICAgIDogbnVsbFxuXHR0ZW1wbGF0ZVZhcnMgOiBudWxsXG5cdFxuXHRpbml0aWFsaXplIDogLT5cblx0XHRcblx0XHRAY2hpbGRyZW4gPSBbXVxuXG5cdFx0aWYgQHRlbXBsYXRlXG5cdFx0XHR0bXBIVE1MID0gXy50ZW1wbGF0ZSBAQ0RfQ0UoKS50ZW1wbGF0ZXMuZ2V0IEB0ZW1wbGF0ZVxuXHRcdFx0QHNldEVsZW1lbnQgdG1wSFRNTCBAdGVtcGxhdGVWYXJzXG5cblx0XHRAJGVsLmF0dHIgJ2lkJywgQGlkIGlmIEBpZFxuXHRcdEAkZWwuYWRkQ2xhc3MgQGNsYXNzTmFtZSBpZiBAY2xhc3NOYW1lXG5cdFx0XG5cdFx0QGluaXQoKVxuXG5cdFx0QHBhdXNlZCA9IGZhbHNlXG5cblx0XHRudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRudWxsXG5cblx0dXBkYXRlIDogPT5cblxuXHRcdG51bGxcblxuXHRyZW5kZXIgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdGFkZENoaWxkIDogKGNoaWxkLCBwcmVwZW5kID0gZmFsc2UpID0+XG5cblx0XHRAY2hpbGRyZW4ucHVzaCBjaGlsZCBpZiBjaGlsZC5lbFxuXHRcdHRhcmdldCA9IGlmIEBhZGRUb1NlbGVjdG9yIHRoZW4gQCRlbC5maW5kKEBhZGRUb1NlbGVjdG9yKS5lcSgwKSBlbHNlIEAkZWxcblx0XHRcblx0XHRjID0gaWYgY2hpbGQuZWwgdGhlbiBjaGlsZC4kZWwgZWxzZSBjaGlsZFxuXG5cdFx0aWYgIXByZXBlbmQgXG5cdFx0XHR0YXJnZXQuYXBwZW5kIGNcblx0XHRlbHNlIFxuXHRcdFx0dGFyZ2V0LnByZXBlbmQgY1xuXG5cdFx0QFxuXG5cdHJlcGxhY2UgOiAoZG9tLCBjaGlsZCkgPT5cblxuXHRcdEBjaGlsZHJlbi5wdXNoIGNoaWxkIGlmIGNoaWxkLmVsXG5cdFx0YyA9IGlmIGNoaWxkLmVsIHRoZW4gY2hpbGQuJGVsIGVsc2UgY2hpbGRcblx0XHRAJGVsLmNoaWxkcmVuKGRvbSkucmVwbGFjZVdpdGgoYylcblxuXHRcdG51bGxcblxuXHRyZW1vdmUgOiAoY2hpbGQpID0+XG5cblx0XHR1bmxlc3MgY2hpbGQ/XG5cdFx0XHRyZXR1cm5cblx0XHRcblx0XHRjID0gaWYgY2hpbGQuZWwgdGhlbiBjaGlsZC4kZWwgZWxzZSAkKGNoaWxkKVxuXHRcdGNoaWxkLmRpc3Bvc2UoKSBpZiBjIGFuZCBjaGlsZC5kaXNwb3NlXG5cblx0XHRpZiBjICYmIEBjaGlsZHJlbi5pbmRleE9mKGNoaWxkKSAhPSAtMVxuXHRcdFx0QGNoaWxkcmVuLnNwbGljZSggQGNoaWxkcmVuLmluZGV4T2YoY2hpbGQpLCAxIClcblxuXHRcdGMucmVtb3ZlKClcblxuXHRcdG51bGxcblxuXHRvblJlc2l6ZSA6IChldmVudCkgPT5cblxuXHRcdChpZiBjaGlsZC5vblJlc2l6ZSB0aGVuIGNoaWxkLm9uUmVzaXplKCkpIGZvciBjaGlsZCBpbiBAY2hpbGRyZW5cblxuXHRcdG51bGxcblxuXHRtb3VzZUVuYWJsZWQgOiAoIGVuYWJsZWQgKSA9PlxuXG5cdFx0QCRlbC5jc3Ncblx0XHRcdFwicG9pbnRlci1ldmVudHNcIjogaWYgZW5hYmxlZCB0aGVuIFwiYXV0b1wiIGVsc2UgXCJub25lXCJcblxuXHRcdG51bGxcblxuXHRDU1NUcmFuc2xhdGUgOiAoeCwgeSwgdmFsdWU9JyUnLCBzY2FsZSkgPT5cblxuXHRcdGlmIE1vZGVybml6ci5jc3N0cmFuc2Zvcm1zM2Rcblx0XHRcdHN0ciA9IFwidHJhbnNsYXRlM2QoI3t4K3ZhbHVlfSwgI3t5K3ZhbHVlfSwgMClcIlxuXHRcdGVsc2Vcblx0XHRcdHN0ciA9IFwidHJhbnNsYXRlKCN7eCt2YWx1ZX0sICN7eSt2YWx1ZX0pXCJcblxuXHRcdGlmIHNjYWxlIHRoZW4gc3RyID0gXCIje3N0cn0gc2NhbGUoI3tzY2FsZX0pXCJcblxuXHRcdHN0clxuXG5cdHVuTXV0ZUFsbCA6ID0+XG5cblx0XHRmb3IgY2hpbGQgaW4gQGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkLnVuTXV0ZT8oKVxuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRjaGlsZC51bk11dGVBbGwoKVxuXG5cdFx0bnVsbFxuXG5cdG11dGVBbGwgOiA9PlxuXG5cdFx0Zm9yIGNoaWxkIGluIEBjaGlsZHJlblxuXG5cdFx0XHRjaGlsZC5tdXRlPygpXG5cblx0XHRcdGlmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aFxuXG5cdFx0XHRcdGNoaWxkLm11dGVBbGwoKVxuXG5cdFx0bnVsbFxuXG5cdHJlbW92ZUFsbENoaWxkcmVuOiA9PlxuXG5cdFx0QHJlbW92ZSBjaGlsZCBmb3IgY2hpbGQgaW4gQGNoaWxkcmVuXG5cblx0XHRudWxsXG5cblx0dHJpZ2dlckNoaWxkcmVuIDogKG1zZywgY2hpbGRyZW49QGNoaWxkcmVuKSA9PlxuXG5cdFx0Zm9yIGNoaWxkLCBpIGluIGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkLnRyaWdnZXIgbXNnXG5cblx0XHRcdGlmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aFxuXG5cdFx0XHRcdEB0cmlnZ2VyQ2hpbGRyZW4gbXNnLCBjaGlsZC5jaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdGNhbGxDaGlsZHJlbiA6IChtZXRob2QsIHBhcmFtcywgY2hpbGRyZW49QGNoaWxkcmVuKSA9PlxuXG5cdFx0Zm9yIGNoaWxkLCBpIGluIGNoaWxkcmVuXG5cblx0XHRcdGNoaWxkW21ldGhvZF0/IHBhcmFtc1xuXG5cdFx0XHRpZiBjaGlsZC5jaGlsZHJlbi5sZW5ndGhcblxuXHRcdFx0XHRAY2FsbENoaWxkcmVuIG1ldGhvZCwgcGFyYW1zLCBjaGlsZC5jaGlsZHJlblxuXG5cdFx0bnVsbFxuXG5cdGNhbGxDaGlsZHJlbkFuZFNlbGYgOiAobWV0aG9kLCBwYXJhbXMsIGNoaWxkcmVuPUBjaGlsZHJlbikgPT5cblxuXHRcdEBbbWV0aG9kXT8gcGFyYW1zXG5cblx0XHRmb3IgY2hpbGQsIGkgaW4gY2hpbGRyZW5cblxuXHRcdFx0Y2hpbGRbbWV0aG9kXT8gcGFyYW1zXG5cblx0XHRcdGlmIGNoaWxkLmNoaWxkcmVuLmxlbmd0aFxuXG5cdFx0XHRcdEBjYWxsQ2hpbGRyZW4gbWV0aG9kLCBwYXJhbXMsIGNoaWxkLmNoaWxkcmVuXG5cblx0XHRudWxsXG5cblx0c3VwcGxhbnRTdHJpbmcgOiAoc3RyLCB2YWxzKSAtPlxuXG5cdFx0cmV0dXJuIHN0ci5yZXBsYWNlIC97eyAoW157fV0qKSB9fS9nLCAoYSwgYikgLT5cblx0XHRcdHIgPSB2YWxzW2JdXG5cdFx0XHQoaWYgdHlwZW9mIHIgaXMgXCJzdHJpbmdcIiBvciB0eXBlb2YgciBpcyBcIm51bWJlclwiIHRoZW4gciBlbHNlIGEpXG5cblx0ZGlzcG9zZSA6ID0+XG5cblx0XHQjIyNcblx0XHRvdmVycmlkZSBvbiBwZXIgdmlldyBiYXNpcyAtIHVuYmluZCBldmVudCBoYW5kbGVycyBldGNcblx0XHQjIyNcblxuXHRcdG51bGxcblxuXHRDRF9DRSA6ID0+XG5cblx0XHRyZXR1cm4gd2luZG93LkNEX0NFXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RWaWV3XG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuL0Fic3RyYWN0VmlldydcblxuY2xhc3MgQWJzdHJhY3RWaWV3UGFnZSBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdF9zaG93biAgICAgOiBmYWxzZVxuXHRfbGlzdGVuaW5nIDogZmFsc2VcblxuXHRzaG93IDogKGNiKSA9PlxuXG5cdFx0cmV0dXJuIHVubGVzcyAhQF9zaG93blxuXHRcdEBfc2hvd24gPSB0cnVlXG5cblx0XHQjIyNcblx0XHRDSEFOR0UgSEVSRSAtICdwYWdlJyB2aWV3cyBhcmUgYWx3YXlzIGluIERPTSAtIHRvIHNhdmUgaGF2aW5nIHRvIHJlLWluaXRpYWxpc2UgZ21hcCBldmVudHMgKFBJVEEpLiBObyBsb25nZXIgcmVxdWlyZSA6ZGlzcG9zZSBtZXRob2Rcblx0XHQjIyNcblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LndyYXBwZXIuYWRkQ2hpbGQgQFxuXHRcdEBjYWxsQ2hpbGRyZW5BbmRTZWxmICdzZXRMaXN0ZW5lcnMnLCAnb24nXG5cblx0XHQjIyMgcmVwbGFjZSB3aXRoIHNvbWUgcHJvcGVyIHRyYW5zaXRpb24gaWYgd2UgY2FuICMjI1xuXHRcdEAkZWwuY3NzICd2aXNpYmlsaXR5JyA6ICd2aXNpYmxlJ1xuXHRcdGNiPygpXG5cblx0XHRudWxsXG5cblx0aGlkZSA6IChjYikgPT5cblxuXHRcdHJldHVybiB1bmxlc3MgQF9zaG93blxuXHRcdEBfc2hvd24gPSBmYWxzZVxuXG5cdFx0IyMjXG5cdFx0Q0hBTkdFIEhFUkUgLSAncGFnZScgdmlld3MgYXJlIGFsd2F5cyBpbiBET00gLSB0byBzYXZlIGhhdmluZyB0byByZS1pbml0aWFsaXNlIGdtYXAgZXZlbnRzIChQSVRBKS4gTm8gbG9uZ2VyIHJlcXVpcmUgOmRpc3Bvc2UgbWV0aG9kXG5cdFx0IyMjXG5cdFx0QENEX0NFKCkuYXBwVmlldy53cmFwcGVyLnJlbW92ZSBAXG5cblx0XHQjIEBjYWxsQ2hpbGRyZW5BbmRTZWxmICdzZXRMaXN0ZW5lcnMnLCAnb2ZmJ1xuXG5cdFx0IyMjIHJlcGxhY2Ugd2l0aCBzb21lIHByb3BlciB0cmFuc2l0aW9uIGlmIHdlIGNhbiAjIyNcblx0XHRAJGVsLmNzcyAndmlzaWJpbGl0eScgOiAnaGlkZGVuJ1xuXHRcdGNiPygpXG5cblx0XHRudWxsXG5cblx0ZGlzcG9zZSA6ID0+XG5cblx0XHRAY2FsbENoaWxkcmVuQW5kU2VsZiAnc2V0TGlzdGVuZXJzJywgJ29mZidcblxuXHRcdG51bGxcblxuXHRzZXRMaXN0ZW5lcnMgOiAoc2V0dGluZykgPT5cblxuXHRcdHJldHVybiB1bmxlc3Mgc2V0dGluZyBpc250IEBfbGlzdGVuaW5nXG5cdFx0QF9saXN0ZW5pbmcgPSBzZXR0aW5nXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gQWJzdHJhY3RWaWV3UGFnZVxuIiwiQWJzdHJhY3RWaWV3ID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuXG5jbGFzcyBGb290ZXIgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuICAgIHRlbXBsYXRlIDogJ3NpdGUtZm9vdGVyJ1xuXG4gICAgY29uc3RydWN0b3I6IC0+XG5cbiAgICAgICAgQHRlbXBsYXRlVmFycyA9IFxuICAgICAgICBcdGRlc2MgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZm9vdGVyX2Rlc2NcIlxuXG4gICAgICAgIHN1cGVyKClcblxuICAgICAgICByZXR1cm4gbnVsbFxuXG5tb2R1bGUuZXhwb3J0cyA9IEZvb3RlclxuIiwiQWJzdHJhY3RWaWV3ICAgICAgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5Sb3V0ZXIgICAgICAgICAgICAgICA9IHJlcXVpcmUgJy4uLy4uL3JvdXRlci9Sb3V0ZXInXG5Db2RlV29yZFRyYW5zaXRpb25lciA9IHJlcXVpcmUgJy4uLy4uL3V0aWxzL0NvZGVXb3JkVHJhbnNpdGlvbmVyJ1xuXG5jbGFzcyBIZWFkZXIgZXh0ZW5kcyBBYnN0cmFjdFZpZXdcblxuXHR0ZW1wbGF0ZSA6ICdzaXRlLWhlYWRlcidcblxuXHRGSVJTVF9IQVNIQ0hBTkdFIDogdHJ1ZVxuXHRET09ETEVfSU5GT19PUEVOIDogZmFsc2VcblxuXHRFVkVOVF9ET09ETEVfSU5GT19PUEVOICAgOiAnRVZFTlRfRE9PRExFX0lORk9fT1BFTidcblx0RVZFTlRfRE9PRExFX0lORk9fQ0xPU0UgIDogJ0VWRU5UX0RPT0RMRV9JTkZPX0NMT1NFJ1xuXHRFVkVOVF9IT01FX1NDUk9MTF9UT19UT1AgOiAnRVZFTlRfSE9NRV9TQ1JPTExfVE9fVE9QJ1xuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEB0ZW1wbGF0ZVZhcnMgPVxuXHRcdFx0aG9tZV9sYWJlbCAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdoZWFkZXJfbG9nb19sYWJlbCcpXG5cdFx0XHRjbG9zZV9sYWJlbCA6IEBDRF9DRSgpLmxvY2FsZS5nZXQoJ2hlYWRlcl9jbG9zZV9sYWJlbCcpXG5cdFx0XHRpbmZvX2xhYmVsICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQoJ2hlYWRlcl9pbmZvX2xhYmVsJylcblxuXHRcdHN1cGVyKClcblxuXHRcdEBiaW5kRXZlbnRzKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRAJGxvZ28gICAgID0gQCRlbC5maW5kKCcubG9nb19fbGluaycpXG5cdFx0QCRpbmZvQnRuICA9IEAkZWwuZmluZCgnLmluZm8tYnRuJylcblx0XHRAJGNsb3NlQnRuID0gQCRlbC5maW5kKCcuY2xvc2UtYnRuJylcblxuXHRcdG51bGxcblxuXHRiaW5kRXZlbnRzIDogPT5cblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcub24gQENEX0NFKCkuYXBwVmlldy5FVkVOVF9QUkVMT0FERVJfSElERSwgQGFuaW1hdGVUZXh0SW5cblx0XHRAQ0RfQ0UoKS5yb3V0ZXIub24gUm91dGVyLkVWRU5UX0hBU0hfQ0hBTkdFRCwgQG9uSGFzaENoYW5nZVxuXG5cdFx0QCRlbC5vbiAnbW91c2VlbnRlcicsICdbZGF0YS1jb2Rld29yZF0nLCBAb25Xb3JkRW50ZXJcblx0XHRAJGVsLm9uICdtb3VzZWxlYXZlJywgJ1tkYXRhLWNvZGV3b3JkXScsIEBvbldvcmRMZWF2ZVxuXG5cdFx0QCRpbmZvQnRuLm9uICdjbGljaycsIEBvbkluZm9CdG5DbGlja1xuXHRcdEAkY2xvc2VCdG4ub24gJ2NsaWNrJywgQG9uQ2xvc2VCdG5DbGlja1xuXG5cdFx0QENEX0NFKCkuYXBwVmlldy4kd2luZG93Lm9uICdrZXl1cCcsIEBvbktleXVwXG5cblx0XHRudWxsXG5cblx0b25IYXNoQ2hhbmdlIDogKHdoZXJlKSA9PlxuXG5cdFx0aWYgQEZJUlNUX0hBU0hDSEFOR0Vcblx0XHRcdEBGSVJTVF9IQVNIQ0hBTkdFID0gZmFsc2VcblxuXHRcdFx0Y29sb3JTY2hlbWUgPSBAX2dldERvb2RsZUNvbG91clNjaGVtZSgpXG5cdFx0XHQjIENvZGVXb3JkVHJhbnNpdGlvbmVyLnByZXBhcmUgW0AkbG9nbywgQCRpbmZvQnRuXSwgQF9nZXREb29kbGVDb2xvdXJTY2hlbWUoKVxuXHRcdFx0QCRsb2dvLmFkZChAJGluZm9CdG4pXG5cdFx0XHRcdC5hZGRDbGFzcyhjb2xvclNjaGVtZSlcblx0XHRcdFx0LmF0dHIoJ2RhdGEtY29kZXdvcmQtaW5pdGlhbC1zdGF0ZScsIGNvbG9yU2NoZW1lKVxuXHRcdFx0XHQuZmluZCgnW2RhdGEtY29kZXRleHQtY2hhci1zdGF0ZV0nKVxuXHRcdFx0XHRcdC5hdHRyKCdkYXRhLWNvZGV0ZXh0LWNoYXItc3RhdGUnLCBjb2xvclNjaGVtZSlcblxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIub3V0IFtAJGNsb3NlQnRuXSwgY29sb3JTY2hlbWVcblxuXHRcdFx0cmV0dXJuXG5cdFx0XG5cdFx0QG9uQXJlYUNoYW5nZSB3aGVyZVxuXG5cdFx0bnVsbFxuXG5cdG9uQXJlYUNoYW5nZSA6IChzZWN0aW9uKSA9PlxuXG5cdFx0QGFjdGl2ZVNlY3Rpb24gPSBzZWN0aW9uXG5cdFx0XG5cdFx0Y29sb3VyID0gQGdldFNlY3Rpb25Db2xvdXIgc2VjdGlvblxuXG5cdFx0QCRlbC5hdHRyICdkYXRhLXNlY3Rpb24nLCBzZWN0aW9uXG5cblx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5pbiBAJGxvZ28sIGNvbG91clxuXG5cdFx0aWYgc2VjdGlvbiBpcyBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRVxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIuaW4gW0AkaW5mb0J0bl0sIGNvbG91clxuXHRcdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIub3V0IFtAJGNsb3NlQnRuXSwgY29sb3VyXG5cdFx0ZWxzZSBpZiBzZWN0aW9uIGlzICdkb29kbGUtaW5mbydcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLmluIFtAJGNsb3NlQnRuXSwgY29sb3VyXG5cdFx0XHRDb2RlV29yZFRyYW5zaXRpb25lci5pbiBbQCRpbmZvQnRuXSwgJ3JlZC1hY3RpdmUnXG5cblx0XHRudWxsXG5cblx0Z2V0U2VjdGlvbkNvbG91ciA6IChzZWN0aW9uLCB3b3JkU2VjdGlvbj1udWxsKSA9PlxuXG5cdFx0c2VjdGlvbiA9IHNlY3Rpb24gb3IgQENEX0NFKCkubmF2LmN1cnJlbnQuYXJlYSBvciAnaG9tZSdcblxuXHRcdGlmIHdvcmRTZWN0aW9uIGFuZCBzZWN0aW9uIGlzIHdvcmRTZWN0aW9uXG5cdFx0XHRpZiB3b3JkU2VjdGlvbiBpcyAnZG9vZGxlLWluZm8nXG5cdFx0XHRcdHJldHVybiAncmVkLWFjdGl2ZSdcblx0XHRcdGVsc2Vcblx0XHRcdFx0cmV0dXJuICd3aGl0ZS1hY3RpdmUnXG5cblx0XHRjb2xvdXIgPSBzd2l0Y2ggc2VjdGlvblxuXHRcdFx0d2hlbiAnaG9tZScsICdkb29kbGUtaW5mbycgdGhlbiAncmVkJ1xuXHRcdFx0d2hlbiBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRSB0aGVuIEBfZ2V0RG9vZGxlQ29sb3VyU2NoZW1lKClcblx0XHRcdGVsc2UgJ3doaXRlJ1xuXG5cdFx0Y29sb3VyXG5cblx0X2dldERvb2RsZUNvbG91clNjaGVtZSA6ID0+XG5cblx0XHRjb2xvdXIgPSBpZiBAQ0RfQ0UoKS5hcHBEYXRhLmFjdGl2ZURvb2RsZS5nZXQoJ2NvbG91cl9zY2hlbWUnKSBpcyAnbGlnaHQnIHRoZW4gJ2JsYWNrJyBlbHNlICd3aGl0ZSdcblxuXHRcdGNvbG91clxuXG5cdGFuaW1hdGVUZXh0SW4gOiA9PlxuXG5cdFx0QG9uQXJlYUNoYW5nZSBAQ0RfQ0UoKS5uYXYuY3VycmVudC5hcmVhXG5cblx0XHRudWxsXG5cblx0b25Xb3JkRW50ZXIgOiAoZSkgPT5cblxuXHRcdCRlbCA9ICQoZS5jdXJyZW50VGFyZ2V0KVxuXHRcdHdvcmRTZWN0aW9uID0gJGVsLmF0dHIoJ2RhdGEtd29yZC1zZWN0aW9uJylcblxuXHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLnNjcmFtYmxlICRlbCwgQGdldFNlY3Rpb25Db2xvdXIoQGFjdGl2ZVNlY3Rpb24sIHdvcmRTZWN0aW9uKVxuXG5cdFx0bnVsbFxuXG5cdG9uV29yZExlYXZlIDogKGUpID0+XG5cblx0XHQkZWwgPSAkKGUuY3VycmVudFRhcmdldClcblx0XHR3b3JkU2VjdGlvbiA9ICRlbC5hdHRyKCdkYXRhLXdvcmQtc2VjdGlvbicpXG5cblx0XHRDb2RlV29yZFRyYW5zaXRpb25lci51bnNjcmFtYmxlICRlbCwgQGdldFNlY3Rpb25Db2xvdXIoQGFjdGl2ZVNlY3Rpb24sIHdvcmRTZWN0aW9uKVxuXG5cdFx0bnVsbFxuXG5cdG9uSW5mb0J0bkNsaWNrIDogKGUpID0+XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KClcblxuXHRcdHJldHVybiB1bmxlc3MgQENEX0NFKCkubmF2LmN1cnJlbnQuYXJlYSBpcyBAQ0RfQ0UoKS5uYXYuc2VjdGlvbnMuSE9NRVxuXG5cdFx0aWYgIUBET09ETEVfSU5GT19PUEVOIHRoZW4gQHNob3dEb29kbGVJbmZvKClcblxuXHRcdG51bGxcblxuXHRvbkNsb3NlQnRuQ2xpY2sgOiAoZSkgPT5cblxuXHRcdGlmIEBET09ETEVfSU5GT19PUEVOXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KClcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKClcblx0XHRcdEBoaWRlRG9vZGxlSW5mbygpXG5cblx0XHRudWxsXG5cblx0b25LZXl1cCA6IChlKSA9PlxuXG5cdFx0aWYgZS5rZXlDb2RlIGlzIDI3IHRoZW4gQGhpZGVEb29kbGVJbmZvKClcblxuXHRcdG51bGxcblxuXHRzaG93RG9vZGxlSW5mbyA6ID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzICFARE9PRExFX0lORk9fT1BFTlxuXG5cdFx0QG9uQXJlYUNoYW5nZSAnZG9vZGxlLWluZm8nXG5cdFx0QHRyaWdnZXIgQEVWRU5UX0RPT0RMRV9JTkZPX09QRU5cblx0XHRARE9PRExFX0lORk9fT1BFTiA9IHRydWVcblxuXHRcdG51bGxcblxuXHRoaWRlRG9vZGxlSW5mbyA6ID0+XG5cblx0XHRyZXR1cm4gdW5sZXNzIEBET09ETEVfSU5GT19PUEVOXG5cblx0XHRAb25BcmVhQ2hhbmdlIEBDRF9DRSgpLm5hdi5jdXJyZW50LmFyZWFcblx0XHRAdHJpZ2dlciBARVZFTlRfRE9PRExFX0lORk9fQ0xPU0Vcblx0XHRARE9PRExFX0lORk9fT1BFTiA9IGZhbHNlXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gSGVhZGVyXG4iLCJBYnN0cmFjdFZpZXcgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXcnXG5cbmNsYXNzIFByZWxvYWRlciBleHRlbmRzIEFic3RyYWN0Vmlld1xuXHRcblx0Y2IgICAgICAgICAgICAgIDogbnVsbFxuXHRcblx0VFJBTlNJVElPTl9USU1FIDogMC41XG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0QHNldEVsZW1lbnQgJCgnI3ByZWxvYWRlcicpXG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdHNob3cgOiAoQGNiKSA9PlxuXG5cdFx0QCRlbC5jc3MgJ2Rpc3BsYXknIDogJ2Jsb2NrJ1xuXG5cdFx0bnVsbFxuXG5cdG9uU2hvd0NvbXBsZXRlIDogPT5cblxuXHRcdEBjYj8oKVxuXG5cdFx0bnVsbFxuXG5cdGhpZGUgOiAoQGNiKSA9PlxuXG5cdFx0QG9uSGlkZUNvbXBsZXRlKClcblxuXHRcdG51bGxcblxuXHRvbkhpZGVDb21wbGV0ZSA6ID0+XG5cblx0XHRAJGVsLmNzcyAnZGlzcGxheScgOiAnbm9uZSdcblx0XHRAY2I/KClcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBQcmVsb2FkZXJcbiIsIkFic3RyYWN0VmlldyAgICA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0VmlldydcbkRvb2RsZVBhZ2VWaWV3ICAgICA9IHJlcXVpcmUgJy4uL2Rvb2RsZVBhZ2UvRG9vZGxlUGFnZVZpZXcnXG5OYXYgICAgICAgICAgICAgPSByZXF1aXJlICcuLi8uLi9yb3V0ZXIvTmF2J1xuXG5jbGFzcyBXcmFwcGVyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cblx0VklFV19UWVBFX1BBR0UgIDogJ3BhZ2UnXG5cdFZJRVdfVFlQRV9NT0RBTCA6ICdtb2RhbCdcblxuXHR0ZW1wbGF0ZSA6ICd3cmFwcGVyJ1xuXG5cdHZpZXdzICAgICAgICAgIDogbnVsbFxuXHRwcmV2aW91c1ZpZXcgICA6IG51bGxcblx0Y3VycmVudFZpZXcgICAgOiBudWxsXG5cdGJhY2tncm91bmRWaWV3IDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEB2aWV3cyA9XG5cdFx0XHRkb29kbGUgOiBjbGFzc1JlZiA6IERvb2RsZVBhZ2VWaWV3LCByb3V0ZSA6IEBDRF9DRSgpLm5hdi5zZWN0aW9ucy5IT01FLCB2aWV3IDogbnVsbCwgdHlwZSA6IEBWSUVXX1RZUEVfUEFHRVxuXG5cdFx0QGNyZWF0ZUNsYXNzZXMoKVxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0IyBkZWNpZGUgaWYgeW91IHdhbnQgdG8gYWRkIGFsbCBjb3JlIERPTSB1cCBmcm9udCwgb3IgYWRkIG9ubHkgd2hlbiByZXF1aXJlZCwgc2VlIGNvbW1lbnRzIGluIEFic3RyYWN0Vmlld1BhZ2UuY29mZmVlXG5cdFx0IyBAYWRkQ2xhc3NlcygpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGNyZWF0ZUNsYXNzZXMgOiA9PlxuXG5cdFx0KEB2aWV3c1tuYW1lXS52aWV3ID0gbmV3IEB2aWV3c1tuYW1lXS5jbGFzc1JlZikgZm9yIG5hbWUsIGRhdGEgb2YgQHZpZXdzXG5cblx0XHRudWxsXG5cblx0YWRkQ2xhc3NlcyA6ID0+XG5cblx0XHQgZm9yIG5hbWUsIGRhdGEgb2YgQHZpZXdzXG5cdFx0IFx0aWYgZGF0YS50eXBlIGlzIEBWSUVXX1RZUEVfUEFHRSB0aGVuIEBhZGRDaGlsZCBkYXRhLnZpZXdcblxuXHRcdG51bGxcblxuXHRnZXRWaWV3QnlSb3V0ZSA6IChyb3V0ZSkgPT5cblxuXHRcdGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXHRcdFx0cmV0dXJuIEB2aWV3c1tuYW1lXSBpZiByb3V0ZSBpcyBAdmlld3NbbmFtZV0ucm91dGVcblxuXHRcdG51bGxcblxuXHRnZXRWaWV3QnlSb3V0ZSA6IChyb3V0ZSkgPT5cblxuXHRcdGZvciBuYW1lLCBkYXRhIG9mIEB2aWV3c1xuXHRcdFx0cmV0dXJuIEB2aWV3c1tuYW1lXSBpZiByb3V0ZSBpcyBAdmlld3NbbmFtZV0ucm91dGVcblxuXHRcdGlmIHJvdXRlIHRoZW4gcmV0dXJuIEB2aWV3cy5mb3VyT2hGb3VyXG5cblx0XHRudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9uICdzdGFydCcsIEBzdGFydFxuXG5cdFx0bnVsbFxuXG5cdHN0YXJ0IDogPT5cblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcub2ZmICdzdGFydCcsIEBzdGFydFxuXG5cdFx0QGJpbmRFdmVudHMoKVxuXHRcdEB1cGRhdGVEaW1zKClcblxuXHRcdG51bGxcblxuXHRiaW5kRXZlbnRzIDogPT5cblxuXHRcdEBDRF9DRSgpLm5hdi5vbiBOYXYuRVZFTlRfQ0hBTkdFX1ZJRVcsIEBjaGFuZ2VWaWV3XG5cdFx0QENEX0NFKCkubmF2Lm9uIE5hdi5FVkVOVF9DSEFOR0VfU1VCX1ZJRVcsIEBjaGFuZ2VTdWJWaWV3XG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3Lm9uIEBDRF9DRSgpLmFwcFZpZXcuRVZFTlRfVVBEQVRFX0RJTUVOU0lPTlMsIEB1cGRhdGVEaW1zXG5cblx0XHRudWxsXG5cblx0dXBkYXRlRGltcyA6ID0+XG5cblx0XHRAJGVsLmNzcyAnbWluLWhlaWdodCcsIEBDRF9DRSgpLmFwcFZpZXcuZGltcy5oXG5cblx0XHRudWxsXG5cblx0Y2hhbmdlVmlldyA6IChwcmV2aW91cywgY3VycmVudCkgPT5cblxuXHRcdGlmIEBwYWdlU3dpdGNoRGZkIGFuZCBAcGFnZVN3aXRjaERmZC5zdGF0ZSgpIGlzbnQgJ3Jlc29sdmVkJ1xuXHRcdFx0ZG8gKHByZXZpb3VzLCBjdXJyZW50KSA9PiBAcGFnZVN3aXRjaERmZC5kb25lID0+IEBjaGFuZ2VWaWV3IHByZXZpb3VzLCBjdXJyZW50XG5cdFx0XHRyZXR1cm5cblxuXHRcdEBwcmV2aW91c1ZpZXcgPSBAZ2V0Vmlld0J5Um91dGUgcHJldmlvdXMuYXJlYVxuXHRcdEBjdXJyZW50VmlldyAgPSBAZ2V0Vmlld0J5Um91dGUgY3VycmVudC5hcmVhXG5cblx0XHRpZiAhQHByZXZpb3VzVmlld1xuXHRcdFx0QHRyYW5zaXRpb25WaWV3cyBmYWxzZSwgQGN1cnJlbnRWaWV3XG5cdFx0ZWxzZVxuXHRcdFx0QHRyYW5zaXRpb25WaWV3cyBAcHJldmlvdXNWaWV3LCBAY3VycmVudFZpZXdcblxuXHRcdG51bGxcblxuXHRjaGFuZ2VTdWJWaWV3IDogKGN1cnJlbnQpID0+XG5cblx0XHRAY3VycmVudFZpZXcudmlldy50cmlnZ2VyIE5hdi5FVkVOVF9DSEFOR0VfU1VCX1ZJRVcsIGN1cnJlbnQuc3ViXG5cblx0XHRudWxsXG5cblx0dHJhbnNpdGlvblZpZXdzIDogKGZyb20sIHRvKSA9PlxuXG5cdFx0QHBhZ2VTd2l0Y2hEZmQgPSAkLkRlZmVycmVkKClcblxuXHRcdGlmIGZyb20gYW5kIHRvXG5cdFx0XHRAQ0RfQ0UoKS5hcHBWaWV3LnRyYW5zaXRpb25lci5wcmVwYXJlIGZyb20ucm91dGUsIHRvLnJvdXRlXG5cdFx0XHRAQ0RfQ0UoKS5hcHBWaWV3LnRyYW5zaXRpb25lci5pbiA9PiBmcm9tLnZpZXcuaGlkZSA9PiB0by52aWV3LnNob3cgPT4gQENEX0NFKCkuYXBwVmlldy50cmFuc2l0aW9uZXIub3V0ID0+IEBwYWdlU3dpdGNoRGZkLnJlc29sdmUoKVxuXHRcdGVsc2UgaWYgZnJvbVxuXHRcdFx0ZnJvbS52aWV3LmhpZGUgQHBhZ2VTd2l0Y2hEZmQucmVzb2x2ZVxuXHRcdGVsc2UgaWYgdG9cblx0XHRcdHRvLnZpZXcuc2hvdyBAcGFnZVN3aXRjaERmZC5yZXNvbHZlXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gV3JhcHBlclxuIiwiQWJzdHJhY3RWaWV3UGFnZSAgICAgPSByZXF1aXJlICcuLi9BYnN0cmFjdFZpZXdQYWdlJ1xuQ29kZVdvcmRUcmFuc2l0aW9uZXIgPSByZXF1aXJlICcuLi8uLi91dGlscy9Db2RlV29yZFRyYW5zaXRpb25lcidcbk1lZGlhUXVlcmllcyAgICAgICAgID0gcmVxdWlyZSAnLi4vLi4vdXRpbHMvTWVkaWFRdWVyaWVzJ1xuXG5jbGFzcyBEb29kbGVQYWdlVmlldyBleHRlbmRzIEFic3RyYWN0Vmlld1BhZ2VcblxuXHR0ZW1wbGF0ZSA6ICdwYWdlLWRvb2RsZSdcblx0bW9kZWwgICAgOiBudWxsXG5cblx0Y29sb3VyU2NoZW1lIDogbnVsbFxuXHRyZWZyZXNoVGltZXIgOiBudWxsXG5cblx0aW5mb1Njcm9sbGVyIDogbnVsbFxuXG5cdE1JTl9QQURESU5HX1RPUCAgICA6IDIzMFxuXHRNSU5fUEFERElOR19CT1RUT00gOiA4NVxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEB0ZW1wbGF0ZVZhcnMgPVxuXHRcdFx0cmVmcmVzaF9idG5fdGl0bGUgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX3JlZnJlc2hfYnRuX3RpdGxlXCJcblx0XHRcdHJhbmRvbV9idG5fdGl0bGUgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9yYW5kb21fYnRuX3RpdGxlXCJcblxuXHRcdHN1cGVyKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aW5pdCA6ID0+XG5cblx0XHRAJGZyYW1lICAgICAgICA9IEAkZWwuZmluZCgnW2RhdGEtZG9vZGxlLWZyYW1lXScpXG5cdFx0QCRpbmZvQ29udGVudCAgPSBAJGVsLmZpbmQoJ1tkYXRhLWRvb2RsZS1pbmZvXScpXG5cdFx0QCRpbnN0cnVjdGlvbnMgPSBAJGVsLmZpbmQoJ1tkYXRhLWRvb2RsZS1pbnN0cnVjdGlvbnNdJylcblxuXHRcdEAkcmVmcmVzaEJ0biA9IEAkZWwuZmluZCgnW2RhdGEtZG9vZGxlLXJlZnJlc2hdJylcblx0XHRAJHJhbmRvbUJ0biAgPSBAJGVsLmZpbmQoJ1tkYXRhLWRvb2RsZS1yYW5kb21dJylcblxuXHRcdG51bGxcblxuXHRzZXRMaXN0ZW5lcnMgOiAoc2V0dGluZykgPT5cblxuXHRcdEBDRF9DRSgpLmFwcFZpZXdbc2V0dGluZ10gQENEX0NFKCkuYXBwVmlldy5FVkVOVF9VUERBVEVfRElNRU5TSU9OUywgQG9uUmVzaXplXG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlcltzZXR0aW5nXSBAQ0RfQ0UoKS5hcHBWaWV3LmhlYWRlci5FVkVOVF9ET09ETEVfSU5GT19PUEVOLCBAb25JbmZvT3BlblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuaGVhZGVyW3NldHRpbmddIEBDRF9DRSgpLmFwcFZpZXcuaGVhZGVyLkVWRU5UX0RPT0RMRV9JTkZPX0NMT1NFLCBAb25JbmZvQ2xvc2VcblxuXHRcdEAkZWxbc2V0dGluZ10gJ2NsaWNrJywgJ1tkYXRhLXNoYXJlLWJ0bl0nLCBAb25TaGFyZUJ0bkNsaWNrXG5cdFx0IyBAJGluZm9Db250ZW50W3NldHRpbmddICdjbGljaycsIEBvbkluZm9Db250ZW50Q2xpY2tcblxuXHRcdEAkcmVmcmVzaEJ0bltzZXR0aW5nXSAnY2xpY2snLCBAb25SZWZyZXNoQnRuQ2xpY2tcblx0XHRAJHJhbmRvbUJ0bltzZXR0aW5nXSAnY2xpY2snLCBAb25SYW5kb21CdG5DbGlja1xuXG5cdFx0bnVsbFxuXG5cdG9uUmVzaXplIDogPT5cblxuXHRcdEBzZXR1cEluZm9EaW1zKClcblxuXHRcdG51bGxcblxuXHRzaG93IDogKGNiKSA9PlxuXG5cdFx0QG1vZGVsID0gQENEX0NFKCkuYXBwRGF0YS5hY3RpdmVEb29kbGVcblxuXHRcdEBzZXR1cFVJKClcblxuXHRcdHN1cGVyXG5cblx0XHRAc2hvd0ZyYW1lIGZhbHNlXG5cblx0XHRudWxsXG5cblx0aGlkZSA6IChjYikgPT5cblxuXHRcdEBDRF9DRSgpLmFwcFZpZXcuaGVhZGVyLmhpZGVEb29kbGVJbmZvKClcblxuXHRcdHN1cGVyXG5cblx0XHRudWxsXG5cblx0c2V0dXBVSSA6ID0+XG5cblx0XHRAJGluZm9Db250ZW50Lmh0bWwgQGdldERvb2RsZUluZm9Db250ZW50KClcblxuXHRcdEAkZWwuYXR0ciAnZGF0YS1jb2xvci1zY2hlbWUnLCBAbW9kZWwuZ2V0KCdjb2xvdXJfc2NoZW1lJylcblx0XHRAJGZyYW1lLmF0dHIoJ3NyYycsICcnKS5yZW1vdmVDbGFzcygnc2hvdycpXG5cblx0XHRAY29sb3VyU2NoZW1lID0gaWYgQG1vZGVsLmdldCgnY29sb3VyX3NjaGVtZScpIGlzICdsaWdodCcgdGhlbiAnYmxhY2snIGVsc2UgJ3doaXRlJ1xuXG5cdFx0QHNldHVwSW5zdHJ1Y3Rpb25zKClcblxuXHRcdG51bGxcblxuXHRzZXR1cEluZm9EaW1zIDogPT5cblxuXHRcdEAkZG9vZGxlSW5mb0NvbnRlbnQgPSBAJGVsLmZpbmQoJ1tkYXRhLWRvb2RsZS1pbmZvLWNvbnRlbnRdJylcblx0XHRAJGRvb2RsZUluZm9Db250ZW50LnJlbW92ZUNsYXNzKCdlbmFibGUtb3ZlcmZsb3cnKS5jc3MoeyB0b3A6ICcnfSlcblx0XHRcdC5maW5kKCcuZG9vZGxlLWluZm8taW5uZXInKS5jc3MoeyBtYXhIZWlnaHQ6ICcnIH0pXG5cblx0XHRjb250ZW50T2Zmc2V0ID0gQCRkb29kbGVJbmZvQ29udGVudC5vZmZzZXQoKS50b3BcblxuXHRcdHJlcXVpcmVzT3ZlcmZsb3cgPSAoY29udGVudE9mZnNldCA8PSBATUlOX1BBRERJTkdfVE9QKSBhbmQgKEBDRF9DRSgpLmFwcFZpZXcuZGltcy53ID49IDc1MCkgIyB0aGlzIDc1MCBpcyBmcm9tIHRoZSBncmlkIGJyZWFrcG9pbnRzIHdoaWNoIGFyZW4ndCBhdmFpbGFibGUgdG8gTWVkaWFRdWVyaWVzIGNsYXNcblxuXHRcdGNvbnNvbGUubG9nIFwic2V0dXBJbmZvRGltcyA6ID0+XCIsIGNvbnRlbnRPZmZzZXQsIHJlcXVpcmVzT3ZlcmZsb3dcblxuXHRcdGlmIHJlcXVpcmVzT3ZlcmZsb3dcblxuXHRcdFx0dG9wICAgICAgID0gQE1JTl9QQURESU5HX1RPUFxuXHRcdFx0bWF4SGVpZ2h0ID0gQENEX0NFKCkuYXBwVmlldy5kaW1zLmggLSBATUlOX1BBRERJTkdfVE9QIC0gQE1JTl9QQURESU5HX0JPVFRPTVxuXG5cdFx0XHRAX3NldHVwSW5mb1dpdGhPdmVyZmxvdyB0b3AsIG1heEhlaWdodFxuXG5cdFx0ZWxzZVxuXG5cdFx0XHRAX3NldHVwSW5mb1dpdGhvdXRPdmVyZmxvdygpXG5cblx0XHRudWxsXG5cblx0X3NldHVwSW5mb1dpdGhPdmVyZmxvdyA6ICh0b3AsIG1heEhlaWdodCkgPT5cblxuXHRcdEAkZG9vZGxlSW5mb0NvbnRlbnQuYWRkQ2xhc3MoJ2VuYWJsZS1vdmVyZmxvdycpLmNzcyh7IHRvcDogdG9wIH0pXG5cdFx0XHQuZmluZCgnLmRvb2RsZS1pbmZvLWlubmVyJykuY3NzKHsgbWF4SGVpZ2h0OiBtYXhIZWlnaHQgfSlcblxuXHRcdCRpbmZvQ29udGVudElubmVyID0gQCRkb29kbGVJbmZvQ29udGVudC5maW5kKCcuZG9vZGxlLWluZm8taW5uZXInKVxuXG5cdFx0aWYgIU1vZGVybml6ci50b3VjaFxuXG5cdFx0XHRpU2Nyb2xsT3B0cyA9IFxuXHRcdFx0XHRtb3VzZVdoZWVsICAgICAgICAgICAgOiB0cnVlXG5cdFx0XHRcdHNjcm9sbGJhcnMgICAgICAgICAgICA6IHRydWVcblx0XHRcdFx0aW50ZXJhY3RpdmVTY3JvbGxiYXJzIDogdHJ1ZVxuXHRcdFx0XHRmYWRlU2Nyb2xsYmFycyAgICAgICAgOiB0cnVlXG5cdFx0XHRcdG1vbWVudHVtICAgICAgICAgICAgICA6IGZhbHNlXG5cdFx0XHRcdGJvdW5jZSAgICAgICAgICAgICAgICA6IGZhbHNlXG5cdFx0XHRcdHByZXZlbnREZWZhdWx0ICAgICAgICA6IGZhbHNlXG5cblx0XHRcdGlmIEBpbmZvU2Nyb2xsZXJcblx0XHRcdFx0QGluZm9TY3JvbGxlci5yZWZyZXNoKClcblx0XHRcdGVsc2Vcblx0XHRcdFx0QGluZm9TY3JvbGxlciA9IG5ldyBJU2Nyb2xsICRpbmZvQ29udGVudElubmVyWzBdLCBpU2Nyb2xsT3B0c1xuXG5cdFx0bnVsbFxuXG5cdF9zZXR1cEluZm9XaXRob3V0T3ZlcmZsb3cgOiA9PlxuXG5cdFx0QCRkb29kbGVJbmZvQ29udGVudC5yZW1vdmVDbGFzcygnZW5hYmxlLW92ZXJmbG93JykuY3NzKHsgdG9wOiAnJyB9KVxuXHRcdFx0LmZpbmQoJy5kb29kbGUtaW5mby1pbm5lcicpLmNzcyh7IG1heEhlaWdodDogJycgfSlcblxuXHRcdEBpbmZvU2Nyb2xsZXI/LmRlc3Ryb3koKVxuXHRcdEBpbmZvU2Nyb2xsZXIgPSBudWxsXG5cblx0XHRudWxsXG5cblx0c2hvd0ZyYW1lIDogKHJlbW92ZUV2ZW50PXRydWUsIGRlbGF5PW51bGwpID0+XG5cblx0XHRpZiByZW1vdmVFdmVudCB0aGVuIEBDRF9DRSgpLmFwcFZpZXcudHJhbnNpdGlvbmVyLm9mZiBAQ0RfQ0UoKS5hcHBWaWV3LnRyYW5zaXRpb25lci5FVkVOVF9UUkFOU0lUSU9ORVJfT1VUX0RPTkUsIEBzaG93RnJhbWVcblxuXHRcdEAkZnJhbWUuYXR0ciAnc3JjJywgXCIje0BDRF9DRSgpLkRPT0RMRVNfVVJMfS8je0Btb2RlbC5nZXQoJ3NsdWcnKX0vaW5kZXguaHRtbFwiXG5cdFx0QCRmcmFtZS5vbmUgJ2xvYWQnLCA9PiBAc2hvd0Rvb2RsZSBkZWxheVxuXG5cdFx0bnVsbFxuXG5cdHNob3dEb29kbGUgOiAoZGVsYXkpID0+XG5cblx0XHRAJGZyYW1lLmFkZENsYXNzKCdzaG93Jylcblx0XHRzZXRUaW1lb3V0ID0+XG5cdFx0XHRibGFua0luc3RydWN0aW9ucyA9IEBtb2RlbC5nZXQoJ2luc3RydWN0aW9ucycpLnNwbGl0KCcnKS5tYXAoLT4gcmV0dXJuICcgJykuam9pbignJylcblx0XHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLnRvIGJsYW5rSW5zdHJ1Y3Rpb25zLCBAJGluc3RydWN0aW9ucywgQGNvbG91clNjaGVtZVxuXHRcdCwgZGVsYXkgb3IgMTAwMFxuXG5cdFx0bnVsbFxuXG5cdGhpZGVEb29kbGUgOiA9PlxuXG5cdFx0QCRmcmFtZS5yZW1vdmVDbGFzcygnc2hvdycpXG5cblx0XHRudWxsXG5cblx0c2V0dXBJbnN0cnVjdGlvbnMgOiA9PlxuXG5cdFx0JG5ld0luc3RydWN0aW9ucyA9IEBnZXRJbnN0cnVjdGlvbnMoKVxuXHRcdEAkaW5zdHJ1Y3Rpb25zLnJlcGxhY2VXaXRoICRuZXdJbnN0cnVjdGlvbnNcblx0XHRAJGluc3RydWN0aW9ucyA9ICRuZXdJbnN0cnVjdGlvbnNcblxuXHRcdG51bGxcblxuXHRnZXRJbnN0cnVjdGlvbnMgOiA9PlxuXG5cdFx0JGluc3RydWN0aW9uc0VsID0gJCgnPHNwYW4gLz4nKVxuXHRcdCRpbnN0cnVjdGlvbnNFbFxuXHRcdFx0LmFkZENsYXNzKCdkb29kbGUtaW5zdHJ1Y3Rpb25zJylcblx0XHRcdC5hdHRyKCdkYXRhLWNvZGV3b3JkJywgJycpXG5cdFx0XHQuYXR0cignZGF0YS1kb29kbGUtaW5zdHJ1Y3Rpb25zJywgJycpXG5cdFx0XHQudGV4dChAbW9kZWwuZ2V0KCdpbnN0cnVjdGlvbnMnKS50b0xvd2VyQ2FzZSgpKVxuXG5cdFx0Y29uc29sZS5sb2cgXCJAbW9kZWwuZ2V0KCdpbnN0cnVjdGlvbnMnKS50b0xvd2VyQ2FzZSgpXCJcblx0XHRjb25zb2xlLmxvZyBAbW9kZWwuZ2V0KCdpbnN0cnVjdGlvbnMnKS50b0xvd2VyQ2FzZSgpXG5cblx0XHRjb2xvdXJTY2hlbWUgPSBpZiBAbW9kZWwuZ2V0KCdjb2xvdXJfc2NoZW1lJykgaXMgJ2xpZ2h0JyB0aGVuICdibGFjaycgZWxzZSAnd2hpdGUnXG5cdFx0Q29kZVdvcmRUcmFuc2l0aW9uZXIucHJlcGFyZSAkaW5zdHJ1Y3Rpb25zRWwsIEBjb2xvdXJTY2hlbWVcblxuXHRcdGNvbnNvbGUubG9nIFwiJGluc3RydWN0aW9uc0VsXCJcblx0XHRjb25zb2xlLmxvZyAkaW5zdHJ1Y3Rpb25zRWxcblxuXHRcdCRpbnN0cnVjdGlvbnNFbFxuXG5cdGdldERvb2RsZUluZm9Db250ZW50IDogPT5cblxuXHRcdGRvb2RsZUluZm9WYXJzID1cblx0XHRcdGluZGV4SFRNTCAgICAgICAgICAgICAgICAgICA6IEBtb2RlbC5nZXQoJ2luZGV4SFRNTCcpXG5cdFx0XHR0aHVtYiAgICAgICAgICAgICAgICAgICAgICAgOiBAQ0RfQ0UoKS5ET09ETEVTX1VSTCArICcvJyArIEBtb2RlbC5nZXQoJ3NsdWcnKSArICcvdGh1bWIuanBnJ1xuXHRcdFx0bGFiZWxfYXV0aG9yICAgICAgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9hdXRob3JcIlxuXHRcdFx0Y29udGVudF9hdXRob3IgICAgICAgICAgICAgIDogQG1vZGVsLmdldEF1dGhvckh0bWwoKVxuXHRcdFx0bGFiZWxfZG9vZGxlX25hbWUgICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9kb29kbGVfbmFtZVwiXG5cdFx0XHRjb250ZW50X2Rvb2RsZV9uYW1lICAgICAgICAgOiBAbW9kZWwuZ2V0KCduYW1lJylcblx0XHRcdGxhYmVsX2Rvb2RsZV9pbnN0cnVjdGlvbnMgICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQgJ2Rvb2RsZV9sYWJlbF9pbnN0cnVjdGlvbnMnXG5cdFx0XHRjb250ZW50X2Rvb2RsZV9pbnN0cnVjdGlvbnMgOiBAbW9kZWwuZ2V0KCdpbnN0cnVjdGlvbnMnKSBvciBAQ0RfQ0UoKS5sb2NhbGUuZ2V0ICdkb29kbGVfbGFiZWxfaW5zdHJ1Y3Rpb25zX25vbmUnXG5cdFx0XHRsYWJlbF9kZXNjcmlwdGlvbiAgICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2Rlc2NyaXB0aW9uXCJcblx0XHRcdGNvbnRlbnRfZGVzY3JpcHRpb24gICAgICAgICA6IEBtb2RlbC5nZXQoJ2Rlc2NyaXB0aW9uJylcblx0XHRcdGxhYmVsX3RhZ3MgICAgICAgICAgICAgICAgICA6IEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfdGFnc1wiXG5cdFx0XHRjb250ZW50X3RhZ3MgICAgICAgICAgICAgICAgOiBAbW9kZWwuZ2V0KCd0YWdzJykuam9pbignLCAnKVxuXHRcdFx0bGFiZWxfaW50ZXJhY3Rpb24gICAgICAgICAgIDogQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvblwiXG5cdFx0XHRjb250ZW50X2ludGVyYWN0aW9uICAgICAgICAgOiBAX2dldEludGVyYWN0aW9uQ29udGVudCgpXG5cdFx0XHRsYWJlbF9zaGFyZSAgICAgICAgICAgICAgICAgOiBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX3NoYXJlXCJcblx0XHRcdHNoYXJlX3VybCAgICAgICAgICAgICAgICAgICA6IEBDRF9DRSgpLlNJVEVfVVJMICsgJy8nICsgQG1vZGVsLmdldCgnaWQnKVxuXHRcdFx0c2hhcmVfdXJsX3RleHQgICAgICAgICAgICAgIDogQENEX0NFKCkuU0lURV9VUkwucmVwbGFjZSgnaHR0cDovLycsICcnKSArICcvJyArIEBtb2RlbC5nZXQoJ2lkJylcblx0XHRcdG1vdXNlX2VuYWJsZWQgICAgICAgICAgICAgICA6IEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLm1vdXNlJylcblx0XHRcdGtleWJvYXJkX2VuYWJsZWQgICAgICAgICAgICA6IEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLmtleWJvYXJkJylcblx0XHRcdHRvdWNoX2VuYWJsZWQgICAgICAgICAgICAgICA6IEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLnRvdWNoJylcblxuXHRcdGRvb2RsZUluZm9Db250ZW50ID0gXy50ZW1wbGF0ZShAQ0RfQ0UoKS50ZW1wbGF0ZXMuZ2V0KCdkb29kbGUtaW5mbycpKShkb29kbGVJbmZvVmFycylcblxuXHRcdGRvb2RsZUluZm9Db250ZW50XG5cblx0X2dldEludGVyYWN0aW9uQ29udGVudCA6ID0+XG5cblx0XHRpbnRlcmFjdGlvbnMgPSBbXVxuXG5cdFx0aWYgQG1vZGVsLmdldCgnaW50ZXJhY3Rpb24ubW91c2UnKSB0aGVuIGludGVyYWN0aW9ucy5wdXNoIEBDRF9DRSgpLmxvY2FsZS5nZXQgXCJkb29kbGVfbGFiZWxfaW50ZXJhY3Rpb25fbW91c2VcIlxuXHRcdGlmIEBtb2RlbC5nZXQoJ2ludGVyYWN0aW9uLmtleWJvYXJkJykgdGhlbiBpbnRlcmFjdGlvbnMucHVzaCBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uX2tleWJvYXJkXCJcblx0XHRpZiBAbW9kZWwuZ2V0KCdpbnRlcmFjdGlvbi50b3VjaCcpIHRoZW4gaW50ZXJhY3Rpb25zLnB1c2ggQENEX0NFKCkubG9jYWxlLmdldCBcImRvb2RsZV9sYWJlbF9pbnRlcmFjdGlvbl90b3VjaFwiXG5cblx0XHRpbnRlcmFjdGlvbnMuam9pbignLCAnKSBvciBAQ0RfQ0UoKS5sb2NhbGUuZ2V0IFwiZG9vZGxlX2xhYmVsX2ludGVyYWN0aW9uX25vbmVcIlxuXG5cdG9uSW5mb09wZW4gOiA9PlxuXG5cdFx0QHNldHVwSW5mb0RpbXMoKVxuXG5cdFx0QCRlbC5hZGRDbGFzcygnc2hvdy1pbmZvJylcblxuXHRcdG51bGxcblxuXHRvbkluZm9DbG9zZSA6ID0+XG5cblx0XHRAJGVsLnJlbW92ZUNsYXNzKCdzaG93LWluZm8nKVxuXG5cdFx0c2V0VGltZW91dCA9PlxuXHRcdFx0QGluZm9TY3JvbGxlcj8uZGVzdHJveSgpXG5cdFx0XHRAaW5mb1Njcm9sbGVyID0gbnVsbFxuXHRcdCwgNTAwXG5cblx0XHRudWxsXG5cblx0b25TaGFyZUJ0bkNsaWNrIDogKGUpID0+XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KClcblxuXHRcdHNoYXJlTWV0aG9kID0gJChlLmN1cnJlbnRUYXJnZXQpLmF0dHIoJ2RhdGEtc2hhcmUtYnRuJylcblx0XHR1cmwgICAgICAgICA9IGlmIHNoYXJlTWV0aG9kIGlzICdmYWNlYm9vaycgdGhlbiBAQ0RfQ0UoKS5TSVRFX1VSTCArICcvJyArIEBtb2RlbC5nZXQoJ2lkJykgZWxzZSAnICdcblx0XHRkZXNjICAgICAgICA9IEBnZXRTaGFyZURlc2MoKVxuXG5cdFx0QENEX0NFKCkuc2hhcmVbc2hhcmVNZXRob2RdIHVybCwgZGVzY1xuXG5cdFx0bnVsbFxuXG5cdGdldFNoYXJlRGVzYyA6ID0+XG5cblx0XHR2YXJzID1cblx0XHRcdGRvb2RsZV9uYW1lICAgOiBAbW9kZWwuZ2V0ICduYW1lJ1xuXHRcdFx0ZG9vZGxlX2F1dGhvciA6IGlmIEBtb2RlbC5nZXQoJ2F1dGhvci50d2l0dGVyJykgdGhlbiBcIkAje0Btb2RlbC5nZXQoJ2F1dGhvci50d2l0dGVyJyl9XCIgZWxzZSBAbW9kZWwuZ2V0KCdhdXRob3IubmFtZScpXG5cdFx0XHRzaGFyZV91cmwgICAgIDogQENEX0NFKCkuU0lURV9VUkwgKyAnLycgKyBAbW9kZWwuZ2V0KCdpZCcpXG5cdFx0XHRkb29kbGVfdGFncyAgIDogXy5tYXAoQG1vZGVsLmdldCgndGFncycpLCAodGFnKSAtPiAnIycgKyB0YWcpLmpvaW4oJyAnKVxuXG5cdFx0ZGVzYyA9IEBzdXBwbGFudFN0cmluZyBAQ0RfQ0UoKS5sb2NhbGUuZ2V0KCdkb29kbGVfc2hhcmVfdGV4dF90bXBsJyksIHZhcnMsIGZhbHNlXG5cblx0XHRkZXNjLnJlcGxhY2UoLyZuYnNwOy9nLCAnICcpXG5cblx0b25JbmZvQ29udGVudENsaWNrIDogKGUpID0+XG5cblx0XHRpZiBlLnRhcmdldCBpcyBAJGluZm9Db250ZW50WzBdIHRoZW4gQENEX0NFKCkuYXBwVmlldy5oZWFkZXIuaGlkZURvb2RsZUluZm8oKVxuXG5cdFx0bnVsbFxuXG5cdG9uUmVmcmVzaEJ0bkNsaWNrIDogPT5cblxuXHRcdENvZGVXb3JkVHJhbnNpdGlvbmVyLmluIEAkaW5zdHJ1Y3Rpb25zLCBAY29sb3VyU2NoZW1lXG5cdFx0QGhpZGVEb29kbGUoKVxuXG5cdFx0Y2xlYXJUaW1lb3V0IEByZWZyZXNoVGltZXJcblx0XHRAcmVmcmVzaFRpbWVyID0gc2V0VGltZW91dCA9PlxuXHRcdFx0QHNob3dGcmFtZSBmYWxzZSwgMjAwMFxuXHRcdCwgMTAwMFxuXG5cdFx0bnVsbFxuXG5cdG9uUmFuZG9tQnRuQ2xpY2sgOiA9PlxuXG5cdFx0d2luZG93LmxvY2F0aW9uLnJlbG9hZCgpXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gRG9vZGxlUGFnZVZpZXdcbiIsIkFic3RyYWN0VmlldyA9IHJlcXVpcmUgJy4uL0Fic3RyYWN0VmlldydcblxuY2xhc3MgQWJzdHJhY3RNb2RhbCBleHRlbmRzIEFic3RyYWN0Vmlld1xuXG5cdCR3aW5kb3cgOiBudWxsXG5cblx0IyMjIG92ZXJyaWRlIGluIGluZGl2aWR1YWwgY2xhc3NlcyAjIyNcblx0bmFtZSAgICAgOiBudWxsXG5cdHRlbXBsYXRlIDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogLT5cblxuXHRcdEAkd2luZG93ID0gJCh3aW5kb3cpXG5cblx0XHRzdXBlcigpXG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3LmFkZENoaWxkIEBcblx0XHRAc2V0TGlzdGVuZXJzICdvbidcblx0XHRAYW5pbWF0ZUluKClcblxuXHRcdHJldHVybiBudWxsXG5cblx0aGlkZSA6ID0+XG5cblx0XHRAYW5pbWF0ZU91dCA9PiBAQ0RfQ0UoKS5hcHBWaWV3LnJlbW92ZSBAXG5cblx0XHRudWxsXG5cblx0ZGlzcG9zZSA6ID0+XG5cblx0XHRAc2V0TGlzdGVuZXJzICdvZmYnXG5cdFx0QENEX0NFKCkuYXBwVmlldy5tb2RhbE1hbmFnZXIubW9kYWxzW0BuYW1lXS52aWV3ID0gbnVsbFxuXG5cdFx0bnVsbFxuXG5cdHNldExpc3RlbmVycyA6IChzZXR0aW5nKSA9PlxuXG5cdFx0QCR3aW5kb3dbc2V0dGluZ10gJ2tleXVwJywgQG9uS2V5VXBcblx0XHRAJCgnW2RhdGEtY2xvc2VdJylbc2V0dGluZ10gJ2NsaWNrJywgQGNsb3NlQ2xpY2tcblxuXHRcdG51bGxcblxuXHRvbktleVVwIDogKGUpID0+XG5cblx0XHRpZiBlLmtleUNvZGUgaXMgMjcgdGhlbiBAaGlkZSgpXG5cblx0XHRudWxsXG5cblx0YW5pbWF0ZUluIDogPT5cblxuXHRcdFR3ZWVuTGl0ZS50byBAJGVsLCAwLjMsIHsgJ3Zpc2liaWxpdHknOiAndmlzaWJsZScsICdvcGFjaXR5JzogMSwgZWFzZSA6IFF1YWQuZWFzZU91dCB9XG5cdFx0VHdlZW5MaXRlLnRvIEAkZWwuZmluZCgnLmlubmVyJyksIDAuMywgeyBkZWxheSA6IDAuMTUsICd0cmFuc2Zvcm0nOiAnc2NhbGUoMSknLCAndmlzaWJpbGl0eSc6ICd2aXNpYmxlJywgJ29wYWNpdHknOiAxLCBlYXNlIDogQmFjay5lYXNlT3V0IH1cblxuXHRcdG51bGxcblxuXHRhbmltYXRlT3V0IDogKGNhbGxiYWNrKSA9PlxuXG5cdFx0VHdlZW5MaXRlLnRvIEAkZWwsIDAuMywgeyBkZWxheSA6IDAuMTUsICdvcGFjaXR5JzogMCwgZWFzZSA6IFF1YWQuZWFzZU91dCwgb25Db21wbGV0ZTogY2FsbGJhY2sgfVxuXHRcdFR3ZWVuTGl0ZS50byBAJGVsLmZpbmQoJy5pbm5lcicpLCAwLjMsIHsgJ3RyYW5zZm9ybSc6ICdzY2FsZSgwLjgpJywgJ29wYWNpdHknOiAwLCBlYXNlIDogQmFjay5lYXNlSW4gfVxuXG5cdFx0bnVsbFxuXG5cdGNsb3NlQ2xpY2s6ICggZSApID0+XG5cblx0XHRlLnByZXZlbnREZWZhdWx0KClcblxuXHRcdEBoaWRlKClcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBBYnN0cmFjdE1vZGFsXG4iLCJBYnN0cmFjdE1vZGFsID0gcmVxdWlyZSAnLi9BYnN0cmFjdE1vZGFsJ1xuXG5jbGFzcyBPcmllbnRhdGlvbk1vZGFsIGV4dGVuZHMgQWJzdHJhY3RNb2RhbFxuXG5cdG5hbWUgICAgIDogJ29yaWVudGF0aW9uTW9kYWwnXG5cdHRlbXBsYXRlIDogJ29yaWVudGF0aW9uLW1vZGFsJ1xuXG5cdGNiICAgICAgIDogbnVsbFxuXG5cdGNvbnN0cnVjdG9yIDogKEBjYikgLT5cblxuXHRcdEB0ZW1wbGF0ZVZhcnMgPSB7QG5hbWV9XG5cblx0XHRzdXBlcigpXG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdGluaXQgOiA9PlxuXG5cdFx0bnVsbFxuXG5cdGhpZGUgOiAoc3RpbGxMYW5kc2NhcGU9dHJ1ZSkgPT5cblxuXHRcdEBhbmltYXRlT3V0ID0+XG5cdFx0XHRAQ0RfQ0UoKS5hcHBWaWV3LnJlbW92ZSBAXG5cdFx0XHRpZiAhc3RpbGxMYW5kc2NhcGUgdGhlbiBAY2I/KClcblxuXHRcdG51bGxcblxuXHRzZXRMaXN0ZW5lcnMgOiAoc2V0dGluZykgPT5cblxuXHRcdHN1cGVyXG5cblx0XHRAQ0RfQ0UoKS5hcHBWaWV3W3NldHRpbmddICd1cGRhdGVEaW1zJywgQG9uVXBkYXRlRGltc1xuXHRcdEAkZWxbc2V0dGluZ10gJ3RvdWNoZW5kIGNsaWNrJywgQGhpZGVcblxuXHRcdG51bGxcblxuXHRvblVwZGF0ZURpbXMgOiAoZGltcykgPT5cblxuXHRcdGlmIGRpbXMubyBpcyAncG9ydHJhaXQnIHRoZW4gQGhpZGUgZmFsc2VcblxuXHRcdG51bGxcblxubW9kdWxlLmV4cG9ydHMgPSBPcmllbnRhdGlvbk1vZGFsXG4iLCJBYnN0cmFjdFZpZXcgICAgID0gcmVxdWlyZSAnLi4vQWJzdHJhY3RWaWV3J1xuT3JpZW50YXRpb25Nb2RhbCA9IHJlcXVpcmUgJy4vT3JpZW50YXRpb25Nb2RhbCdcblxuY2xhc3MgTW9kYWxNYW5hZ2VyIGV4dGVuZHMgQWJzdHJhY3RWaWV3XG5cblx0IyB3aGVuIG5ldyBtb2RhbCBjbGFzc2VzIGFyZSBjcmVhdGVkLCBhZGQgaGVyZSwgd2l0aCByZWZlcmVuY2UgdG8gY2xhc3MgbmFtZVxuXHRtb2RhbHMgOlxuXHRcdG9yaWVudGF0aW9uTW9kYWwgOiBjbGFzc1JlZiA6IE9yaWVudGF0aW9uTW9kYWwsIHZpZXcgOiBudWxsXG5cblx0Y29uc3RydWN0b3IgOiAtPlxuXG5cdFx0c3VwZXIoKVxuXG5cdFx0cmV0dXJuIG51bGxcblxuXHRpbml0IDogPT5cblxuXHRcdG51bGxcblxuXHRpc09wZW4gOiA9PlxuXG5cdFx0KCBpZiBAbW9kYWxzW25hbWVdLnZpZXcgdGhlbiByZXR1cm4gdHJ1ZSApIGZvciBuYW1lLCBtb2RhbCBvZiBAbW9kYWxzXG5cblx0XHRmYWxzZVxuXG5cdGhpZGVPcGVuTW9kYWwgOiA9PlxuXG5cdFx0KCBpZiBAbW9kYWxzW25hbWVdLnZpZXcgdGhlbiBvcGVuTW9kYWwgPSBAbW9kYWxzW25hbWVdLnZpZXcgKSBmb3IgbmFtZSwgbW9kYWwgb2YgQG1vZGFsc1xuXG5cdFx0b3Blbk1vZGFsPy5oaWRlKClcblxuXHRcdG51bGxcblxuXHRzaG93TW9kYWwgOiAobmFtZSwgY2I9bnVsbCkgPT5cblxuXHRcdHJldHVybiBpZiBAbW9kYWxzW25hbWVdLnZpZXdcblxuXHRcdEBtb2RhbHNbbmFtZV0udmlldyA9IG5ldyBAbW9kYWxzW25hbWVdLmNsYXNzUmVmIGNiXG5cblx0XHRudWxsXG5cbm1vZHVsZS5leHBvcnRzID0gTW9kYWxNYW5hZ2VyXG4iXX0=
