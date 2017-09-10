const SlackBot = require('slackbots');
let bot = new SlackBot({
  token: process.env.BOT_TOKEN,
  name: 'Confluence Decisions'
})

module.exports = {
  getUsernameFromId: function(id) {
    return new Promise(function(resolve, reject) {
      bot.getUsers().then(data => {
        data.members.forEach((user, index) => {
          if (user.id == id) {
            return resolve(user.name)
          }
        })
      })
    });
  },
  getUserRealNameFromId: function(id) {
    return new Promise(function(resolve, reject) {
      bot.getUsers().then(data => {
        data.members.forEach((user, index) => {
          if (user.id == id) {
            return resolve(user.profile.real_name_normalized)
          }
        })
      })
    });
  }
}
