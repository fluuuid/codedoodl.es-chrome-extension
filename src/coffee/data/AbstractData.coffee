class AbstractData

	constructor : ->

		_.extend @, Backbone.Events

		return null

	CD_CE : =>

		return window.CD_CE

module.exports = AbstractData
