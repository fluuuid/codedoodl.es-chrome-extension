AbstractViewPage = require '../AbstractViewPage'

class DoodlePageView extends AbstractViewPage

	template : 'page-doodle'
	model    : null

	constructor : ->

		console.log "i am hamm"

		@templateVars = {}

		super()

		return null

	init : =>

		@$frame       = @$el.find('[data-doodle-frame]')
		@$infoContent = @$el.find('[data-doodle-info]')

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

		null

	showFrame : (removeEvent=true) =>

		if removeEvent then @CD_CE().appView.transitioner.off @CD_CE().appView.transitioner.EVENT_TRANSITIONER_OUT_DONE, @showFrame

		# TEMP, OBVZ
		srcDir = if @model.get('colour_scheme') is 'light' then 'shape-stream-light' else 'shape-stream'

		# @$frame.attr 'src', "http://source.codedoodl.es/sample_doodles/#{srcDir}/index.html"
		# @$frame.one 'load', => @$frame.addClass('show')

		null

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
