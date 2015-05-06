AbstractData      = require './data/AbstractData'
Requester         = require './utils/Requester'
API               = require './data/API'
DoodlesCollection = require './collections/doodles/DoodlesCollection'

class AppData extends AbstractData

    callback : null

    DOODLE_CACHE_EXPIRES : 99999999999999999

    constructor : (@callback) ->

        super()

        @doodles = new DoodlesCollection

        @checkDoodleCache()

        return null

    checkDoodleCache : =>

        chrome.storage.sync.get null, (cachedData) =>

            if _.isEmpty cachedData
                return @fetchDoodles()

            cachedDoodles = []
            (if index isnt 'lastUpdated' then cachedDoodles.push(JSON.parse(data))) for index, data of cachedData

            if ((Date.now() - cachedData.lastUpdated) > @DOODLE_CACHE_EXPIRES)
                @fetchDoodles cachedDoodles
            else
                @setDoodles(cachedDoodles).setActiveDoodle()

        null

    fetchDoodles : (cachedDoodles=false) =>

        r = Requester.request
            url  : API.get('doodles')
            type : 'GET'

        r.done (data) => @onFetchDoodlesDone data, cachedDoodles
        r.fail (res) => console.error "error loading api start data", res

        null

    onFetchDoodlesDone : (data, cachedDoodles=false) =>

        console.log "onFetchDoodlesDone : (data) =>", data, cachedDoodles

        if cachedDoodles
            @updateDoodles(_.shuffle(data.doodles), cachedDoodles).setActiveDoodle()
        else
            @setDoodles(_.shuffle(data.doodles)).setActiveDoodle()

        null

    setDoodles : (doodles) =>

        @doodles.add doodles

        @

    updateDoodles : (newDoodles, cachedDoodles) =>

        @doodles.add cachedDoodles
        @doodles.addNew newDoodles

        @

    setActiveDoodle : =>

        @activeDoodle = @doodles.getNextDoodle()
        @callback?()

        @updateCache()

        null

    updateCache : =>

        chrome.storage.sync.clear =>

            newCache = lastUpdated : Date.now()
            (newCache[position] = JSON.stringify doodle) for doodle, position in @doodles.models

            chrome.storage.sync.set newCache

        null

module.exports = AppData
