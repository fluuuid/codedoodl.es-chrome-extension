class AbstractModel extends Backbone.DeepModel

	constructor : (attrs, option) ->

		attrs = @_filterAttrs attrs

		return Backbone.DeepModel.apply @, arguments

	set : (attrs, options) ->

		options or (options = {})

		attrs = @_filterAttrs attrs

		options.data = JSON.stringify attrs

		return Backbone.DeepModel.prototype.set.call @, attrs, options

	_filterAttrs : (attrs) =>

		attrs

	CD_CE : =>

		return window.CD_CE

module.exports = AbstractModel
