var gulp   = require('gulp');
var map    = require('map-stream');
var xml2js = require('xml2js').parseString;
var rext   = require('replace-ext');
var pkg    = require('../../package.json');

function parseXML() {
	
	var opts = {
		trim : true,
		explicitRoot : false
	};

	function modifyContents(file, cb) {

		xml2js(file.contents.toString('utf8'), opts, function(err, result) {
			if (err) cb(new Error(err));
				file.contents = new Buffer("window._TEMPLATES = "+JSON.stringify(result)+";");
				file.path = rext(file.path, '.js');
			});
		cb(null, file);
	}

	return map(modifyContents);
}

gulp.task('parseTemplates', function() {
	gulp.src(pkg.folders.src+'/data/templates.xml')
		.pipe(parseXML())
		.pipe(gulp.dest(pkg.folders.dest+'/data'))
});