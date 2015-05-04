AbstractView         = require '../AbstractView'
Router               = require '../../router/Router'
CodeWordTransitioner = require '../../utils/CodeWordTransitioner'

class Header extends AbstractView

	template : 'site-header'

	FIRST_HASHCHANGE : true
	DOODLE_INFO_OPEN : false

	EVENT_DOODLE_INFO_OPEN   : 'EVENT_DOODLE_INFO_OPEN'
	EVENT_DOODLE_INFO_CLOSE  : 'EVENT_DOODLE_INFO_CLOSE'
	EVENT_HOME_SCROLL_TO_TOP : 'EVENT_HOME_SCROLL_TO_TOP'

	constructor : ->

		@templateVars =
			home    : 
				label    : @CD_CE().locale.get('header_logo_label')
				url      : @CD_CE().BASE_URL + '/' + @CD_CE().nav.sections.HOME
			about : 
				label    : @CD_CE().locale.get('header_about_label')
				url      : @CD_CE().BASE_URL + '/' + @CD_CE().nav.sections.ABOUT
				section  : @CD_CE().nav.sections.ABOUT
			contribute : 
				label    : @CD_CE().locale.get('header_contribute_label')
				url      : @CD_CE().BASE_URL + '/' + @CD_CE().nav.sections.CONTRIBUTE
				section  : @CD_CE().nav.sections.CONTRIBUTE
			close_label : @CD_CE().locale.get('header_close_label')
			info_label : @CD_CE().locale.get('header_info_label')

		super()

		@bindEvents()

		return null

	init : =>

		@$logo              = @$el.find('.logo__link')
		@$navLinkAbout      = @$el.find('.about-btn')
		@$navLinkContribute = @$el.find('.contribute-btn')
		@$infoBtn           = @$el.find('.info-btn')
		@$closeBtn          = @$el.find('.close-btn')

		null

	bindEvents : =>

		@CD_CE().appView.on @CD_CE().appView.EVENT_PRELOADER_HIDE, @animateTextIn
		@CD_CE().router.on Router.EVENT_HASH_CHANGED, @onHashChange

		@$el.on 'mouseenter', '[data-codeword]', @onWordEnter
		@$el.on 'mouseleave', '[data-codeword]', @onWordLeave

		@$infoBtn.on 'click', @onInfoBtnClick
		@$closeBtn.on 'click', @onCloseBtnClick

		@$el.on 'click', '[data-logo]', @onLogoClick

		@CD_CE().appView.$window.on 'keyup', @onKeyup

		null

	onHashChange : (where) =>

		if @FIRST_HASHCHANGE
			@FIRST_HASHCHANGE = false
			return
		
		@onAreaChange where

		null

	onAreaChange : (section) =>

		@activeSection = section
		
		colour = @getSectionColour section

		@$el.attr 'data-section', section

		CodeWordTransitioner.in @$logo, colour

		# this just for testing, tidy later
		if section is @CD_CE().nav.sections.HOME
			CodeWordTransitioner.in [@$navLinkAbout, @$navLinkContribute], colour
			CodeWordTransitioner.out [@$closeBtn, @$infoBtn], colour
		else if section is @CD_CE().nav.sections.DOODLES
			CodeWordTransitioner.in [@$closeBtn, @$infoBtn], colour
			CodeWordTransitioner.out [@$navLinkAbout, @$navLinkContribute], colour
		else if section is @CD_CE().nav.sections.ABOUT
			CodeWordTransitioner.in [@$navLinkContribute, @$closeBtn], colour
			CodeWordTransitioner.in [@$navLinkAbout], 'black-white-bg'
			CodeWordTransitioner.out [@$infoBtn], colour
		else if section is @CD_CE().nav.sections.CONTRIBUTE
			CodeWordTransitioner.in [@$navLinkAbout, @$closeBtn], colour
			CodeWordTransitioner.in [@$navLinkContribute], 'black-white-bg'
			CodeWordTransitioner.out [@$infoBtn], colour
		else if section is 'doodle-info'
			CodeWordTransitioner.in [@$closeBtn], colour
			CodeWordTransitioner.out [@$navLinkAbout, @$navLinkContribute], colour
			CodeWordTransitioner.in [@$infoBtn], 'offwhite-red-bg'
		else
			CodeWordTransitioner.in [@$closeBtn], colour
			CodeWordTransitioner.out [@$navLinkAbout, @$navLinkContribute, @$infoBtn], colour

		null

	getSectionColour : (section, wordSection=null) =>

		section = section or @CD_CE().nav.current.area or 'home'

		if wordSection and section is wordSection
			if wordSection is 'doodle-info'
				return 'offwhite-red-bg'
			else
				return 'black-white-bg'

		colour = switch section
			when 'home', 'doodle-info' then 'red'
			when @CD_CE().nav.sections.ABOUT then 'white'
			when @CD_CE().nav.sections.CONTRIBUTE then 'white'
			when @CD_CE().nav.sections.DOODLES then @_getDoodleColourScheme()
			else 'white'

		colour

	_getDoodleColourScheme : =>

		doodle = @CD_CE().appData.doodles.getDoodleByNavSection 'current'
		colour = if doodle and doodle.get('colour_scheme') is 'light' then 'black' else 'white'

		colour

	animateTextIn : =>

		@onAreaChange @CD_CE().nav.current.area

		null

	onWordEnter : (e) =>

		$el = $(e.currentTarget)
		wordSection = $el.attr('data-word-section')

		CodeWordTransitioner.scramble $el, @getSectionColour(@activeSection, wordSection)

		null

	onWordLeave : (e) =>

		$el = $(e.currentTarget)
		wordSection = $el.attr('data-word-section')

		CodeWordTransitioner.unscramble $el, @getSectionColour(@activeSection, wordSection)

		null

	onLogoClick : =>

		if @CD_CE().nav.current.area is @CD_CE().nav.sections.HOME
			@trigger @EVENT_HOME_SCROLL_TO_TOP

		null

	onInfoBtnClick : (e) =>

		e.preventDefault()

		return unless @CD_CE().nav.current.area is @CD_CE().nav.sections.DOODLES

		if !@DOODLE_INFO_OPEN then @showDoodleInfo()

		null

	onCloseBtnClick : (e) =>

		if @DOODLE_INFO_OPEN
			e.preventDefault()
			e.stopPropagation()
			@hideDoodleInfo()

		null

	onKeyup : (e) =>

		if e.keyCode is 27 and @CD_CE().nav.current.area is @CD_CE().nav.sections.DOODLES then @hideDoodleInfo()

		null

	showDoodleInfo : =>

		return unless !@DOODLE_INFO_OPEN

		@onAreaChange 'doodle-info'
		@trigger @EVENT_DOODLE_INFO_OPEN
		@DOODLE_INFO_OPEN = true

		null

	hideDoodleInfo : =>

		return unless @DOODLE_INFO_OPEN

		@onAreaChange @CD_CE().nav.current.area
		@trigger @EVENT_DOODLE_INFO_CLOSE
		@DOODLE_INFO_OPEN = false

		null

module.exports = Header
