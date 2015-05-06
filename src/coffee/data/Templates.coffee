TemplateModel       = require '../models/core/TemplateModel'
TemplatesCollection = require '../collections/core/TemplatesCollection'

class Templates

    templates : null
    cb        : null

    constructor : (data, callback) ->

        @cb = callback

        @parseData data
           
        null

    parseData : (data) =>

        temp = []

        for item in data.template
            temp.push new TemplateModel
                id   : item.$.id
                text : item._

        @templates = new TemplatesCollection temp

        @cb?()
        
        null        

    get : (id) =>

        t = @templates.where id : id
        t = t[0].get 'text'
        
        return $.trim t

module.exports = Templates
