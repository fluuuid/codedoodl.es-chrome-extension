AbstractViewPage = require '../AbstractViewPage'
CodeWordTransitioner = require '../../utils/CodeWordTransitioner'

class DoodlePageView extends AbstractViewPage

	template : 'page-doodle'
	model    : null

	constructor : ->

		console.log "i am hamm"

		@templateVars = {}

		super()

		return null

	init : =>

		@$frame        = @$el.find('[data-doodle-frame]')
		@$infoContent  = @$el.find('[data-doodle-info]')
		@$instructions = @$el.find('[data-doodle-instructions]')

		@$mouse    = @$el.find('[data-indicator="mouse"]')
		@$keyboard = @$el.find('[data-indicator="keyboard"]')
		@$touch    = @$el.find('[data-indicator="touch"]')

		null

	setListeners : (setting) =>

		@CD_CE().appView.header[setting] @CD_CE().appView.header.EVENT_DOODLE_INFO_OPEN, @onInfoOpen
		@CD_CE().appView.header[setting] @CD_CE().appView.header.EVENT_DOODLE_INFO_CLOSE, @onInfoClose
		@$el[setting] 'click', '[data-share-btn]', @onShareBtnClick

		null

	show : (cb) =>

		@model = @CD_CE().appData.activeDoodle

		@setupUI()

		super

		@showFrame false

		null

	hide : (cb) =>

		@CD_CE().appView.header.hideDoodleInfo()

		super

		null

	setupUI : =>

		@$infoContent.html @getDoodleInfoContent()

		@$el.attr 'data-color-scheme', @model.get('colour_scheme')
		@$frame.attr('src', '').removeClass('show')
		@$mouse.attr 'disabled', !@model.get('interaction.mouse')
		@$keyboard.attr 'disabled', !@model.get('interaction.keyboard')
		@$touch.attr 'disabled', !@model.get('interaction.touch')

		@setupInstructions()

		null

	showFrame : (removeEvent=true) =>

		if removeEvent then @CD_CE().appView.transitioner.off @CD_CE().appView.transitioner.EVENT_TRANSITIONER_OUT_DONE, @showFrame

		# TEMP, OBVZ
		SAMPLE_DIR = @model.get('SAMPLE_DIR')

		@$frame.attr 'src', "http://source.codedoodl.es/sample_doodles/#{SAMPLE_DIR}/index.html"
		@$frame.one 'load', @showDoodle

		null

	showDoodle : =>

		@$frame.addClass('show')
		setTimeout =>
			CodeWordTransitioner.out @$instructions
		, 1000

		null

	setupInstructions : =>

		$newInstructions = @getInstructions()
		@$instructions.replaceWith $newInstructions
		@$instructions = $newInstructions

		null

	getInstructions : =>

		# text = @model.get('instructions').toLowerCase()
		# TEMP!
		text = switch @model.get('SAMPLE_DIR')
			when 'shape-stream', 'shape-stream-light' then 'move your mouse'
			when 'box-physics' then 'click and drag'
			when 'tubes' then 'click and hold'
			else ''

		$instructionsEl = $('<span />')
		$instructionsEl
			.addClass('doodle-instructions')
			.attr('data-codeword', '')
			.attr('data-doodle-instructions', '')
			.text(text)

		colourScheme = if @model.get('colour_scheme') is 'light' then 'black' else 'white'
		CodeWordTransitioner.prepare $instructionsEl, colourScheme

		$instructionsEl

	getDoodleInfoContent : =>

		# no need to do this for every doodle - only do it if we view the info pane for a particular doodle
		@model.setShortlink()

		doodleInfoVars =
			indexHTML                  : @model.get('indexHTML')
			label_author               : @CD_CE().locale.get "doodle_label_author"
			content_author             : @model.getAuthorHtml()
			label_doodle_name          : @CD_CE().locale.get "doodle_label_doodle_name"
			content_doodle_name        : @model.get('name')
			label_description          : @CD_CE().locale.get "doodle_label_description"
			content_description        : @model.get('description')
			label_tags                 : @CD_CE().locale.get "doodle_label_tags"
			content_tags               : @model.get('tags').join(', ')
			label_interaction          : @CD_CE().locale.get "doodle_label_interaction"
			content_interaction        : @_getInteractionContent()
			label_share                : @CD_CE().locale.get "doodle_label_share"
			share_url                  : @CD_CE().SITE_URL + '/' + @model.get('shortlink')
			share_url_text             : @CD_CE().SITE_URL.replace('http://', '') + '/' + @model.get('shortlink')

		doodleInfoContent = _.template(@CD_CE().templates.get('doodle-info'))(doodleInfoVars)

		doodleInfoContent

	_getInteractionContent : =>

		interactions = []

		if @model.get('interaction.mouse') then interactions.push @CD_CE().locale.get "doodle_label_interaction_mouse"
		if @model.get('interaction.keyboard') then interactions.push @CD_CE().locale.get "doodle_label_interaction_keyboard"
		if @model.get('interaction.touch') then interactions.push @CD_CE().locale.get "doodle_label_interaction_touch"

		interactions.join(', ') or @CD_CE().locale.get "doodle_label_interaction_none"

	onInfoOpen : =>

		@$el.addClass('show-info')

		null

	onInfoClose : =>

		@$el.removeClass('show-info')

		null

	onShareBtnClick : (e) =>

		e.preventDefault()

		shareMethod = $(e.currentTarget).attr('data-share-btn')
		url         = if shareMethod is 'facebook' then @CD_CE().SITE_URL + '/' + @model.get('shortlink') else ' '
		desc        = @getShareDesc()

		@CD_CE().share[shareMethod] url, desc

		null

	getShareDesc : =>

		vars =
			doodle_name   : @model.get 'name'
			doodle_author : if @model.get('author.twitter') then "@#{@model.get('author.twitter')}" else @model.get('author.name')
			share_url     : @CD_CE().SITE_URL + '/' + @model.get('shortlink')
			doodle_tags   : _.map(@model.get('tags'), (tag) -> '#' + tag).join(' ')

		desc = @supplantString @CD_CE().locale.get('doodle_share_text_tmpl'), vars, false

		desc.replace(/&nbsp;/g, ' ')

module.exports = DoodlePageView
