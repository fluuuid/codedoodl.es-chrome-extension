class APIRouteModel extends Backbone.DeepModel

    defaults :

        doodles : "{{ API_HOST }}/api/doodles"

module.exports = APIRouteModel
