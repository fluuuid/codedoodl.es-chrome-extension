AbstractView = require '../AbstractView'

class Header extends AbstractView

	template : 'site-header'

	constructor : ->

		@templateVars =
			desc    : @CD_CE().locale.get "header_desc"
			home    : 
				label    : 'Go to homepage'
				url      : @CD_CE().BASE_PATH + '/' + @CD_CE().nav.sections.HOME
			example : 
				label    : 'Go to example page'
				url      : @CD_CE().BASE_PATH + '/' + @CD_CE().nav.sections.EXAMPLE

		super()

		return null

module.exports = Header
