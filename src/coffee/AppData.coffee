AbstractData      = require './data/AbstractData'
Requester         = require './utils/Requester'
API               = require './data/API'
DoodlesCollection = require './collections/doodles/DoodlesCollection'

class AppData extends AbstractData

    callback : null

    constructor : (@callback) ->

        super()

        @doodles = new DoodlesCollection

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

        @doodles.add data.doodles
        @activeDoodle = @doodles.at(1)

        @callback?()

        null

module.exports = AppData
