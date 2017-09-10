var axios = require('axios');

module.exports = {
  makeNetworkRequest: function(request) {
    return new Promise(function(resolve, reject) {
      let options = {
        method: request.method,
        url: request.url
      }
      if (request.data) {
        options.data = request.data
      }

      if (request.auth) {
        options.auth = request.auth
      }

      axios(options)
        .then(response => {
          return resolve(response.data)
        })
        .catch(err => {
          return reject(err)
        })
    })
  },
  getTodaysDate: function() {
    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth()+1; //jan is 0
    let yyyy = today.getFullYear();

    if (dd < 10) {
      dd = '0' + dd
    }
    if (mm < 10) {
      mm = '0' + mm
    }

    return yyyy + '-' + mm + '-' + dd 
  }
}
