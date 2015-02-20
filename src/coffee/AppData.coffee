AbstractData = require './data/AbstractData'
Requester    = require './utils/Requester'
API          = require './data/API'

class AppData extends AbstractData

    callback : null

    constructor : (@callback) ->

        ###

        add all data classes here

        ###

        super()

        @getStartData()

        return null

    ###
    get app bootstrap data - embed in HTML or API endpoint
    ###
    getStartData : =>

        r = Requester.request
            url  : API.get('doodles')
            type : 'GET'

        r.done @onStartDataReceived
        r.fail => console.error "error loading api start data"

        null

    onStartDataReceived : (data) =>

        console.log "onStartDataReceived : (data) =>", data

        ###

        bootstrap data received, app ready to go

        ###

        @callback?()

        null

module.exports = AppData
