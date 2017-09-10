var axios = require('axios');
var utils = require('../utils');

var Confluence = require("confluence-api");
var config = {
    username: process.env.CONFLUENCE_USERNAME,
    password: process.env.CONFLUENCE_PASSWORD,
    baseUrl:  process.env.CONFLUENCE_BASE_URL
};
var confluence = new Confluence(config);

var helpers = {
  // Make a custom request that the Node Wrapper doesnt provide
  makeCustomConfluenceRequest: function(method, uri) {
    return new Promise(function(resolve, reject) {
      axios({
        method: method,
        url: `${config.baseUrl}/rest/api/latest/${uri}`,
        auth: {
          username: `${config.username}`,
          password: `${config.password}`
        }})
        .then(response => {
          return resolve(response.data.results)
        })
        .catch(error => {
          return reject(error)
        })
    })
  },
  addLabelsToPage: function(page) {
    return new Promise(function(resolve, reject) {
      utils.makeNetworkRequest({
        method: 'post',
        url: `${page._links.self}/label`,
        data:[{
          prefix: "global",
          name: "decisions",
          label: "decisions"
        }],
        auth: {
          username: config.username,
          password: config.password
        }
      })
      .then(success => {
        return resolve(success)
      })
      .catch(err => {
        return reject(err)
      })
    });
  },
  formatDecisionPage: function(owner, message) {
    let decisionAnswer   = message.text.split('||')[1].split('?')[1]
    let decisionStatus = {
      color: 'Green',
      text: 'Decided'
    }
    let todaysDate = utils.getTodaysDate()
    let dueDate = `<time datetime="${todaysDate}" />`

    if (!decisionAnswer || decisionAnswer == '') {
      decisionStatus.color = 'Yellow'
      decisionStatus.text  = 'In progress'
      decisionAnswer = ''
      dueDate = ''
    }

    return `
      <p class="auto-cursor-target"><br /></p>
      <ac:structured-macro ac:name="details" ac:schema-version="1" ac:macro-id="3bf3d1e4-c7fd-41d9-bbdf-d38c56f79c2d">
        <ac:parameter ac:name="label" />
        <ac:rich-text-body>
          <p class="auto-cursor-target"><br /></p>
          <table>
            <tbody>
            <tr>
              <th>Status</th>
              <td>
                  <ac:structured-macro ac:name="status" ac:schema-version="1" ac:macro-id="5b52bb64-a94b-4aad-b2cc-15232b956b76">
                  <ac:parameter ac:name="colour">${decisionStatus.color}</ac:parameter>
                  <ac:parameter ac:name="title">${decisionStatus.text}</ac:parameter>
                  </ac:structured-macro>
              </td>
            </tr>
            <tr>
              <th>Stakeholders</th>
              <td>
                <ac:placeholder ac:type="mention">Add stakeholders</ac:placeholder>
              </td>
            </tr>
            <tr>
              <th>Outcome</th>
              <td>
                <ac:placeholder>What did you decide?</ac:placeholder>
                <p>${decisionAnswer}</p>
              </td>
            </tr>
            <tr>
              <th>Due date</th>
              <td>
                <ac:placeholder>When does this decision need to be made by?</ac:placeholder>
                ${dueDate}
              </td>
            </tr>
            <tr>
              <th>Owner</th>
              <td>${owner}</td>
            </tr>
          </tbody>
        </table>

        <p class="auto-cursor-target"><br /></p></ac:rich-text-body></ac:structured-macro>

        <h2>Background</h2>
        <p>Created based on <a href="https://${message.team.domain}.slack.com/archives/${message.channel}">Slack Conversation</a></p>

        <h2>Action items</h2><ac:task-list>
        <ac:task>
        <ac:task-id>1</ac:task-id>
        <ac:task-status>incomplete</ac:task-status>
        <ac:task-body><ac:placeholder ac:type="mention">Type your task here. Use &quot;@&quot; to assign a user and &quot;//&quot; to select a due date.</ac:placeholder></ac:task-body>
        </ac:task>
        </ac:task-list>`
  },
  getPageId: function(spaceKey, pageTitle) {
    return new Promise(function(resolve, reject) {
      confluence.getContentByPageTitle(spaceKey, pageTitle, function(err, data) {
        if (!err) {
          if (data.results.length) {
            return resolve(data.results[0].id)
          } else {
            return resolve(null)
          }
        } else {
          return reject(err)
        }
      })
    })
  }
}

module.exports = {
  getAvailableSpaces: function() {
    return new Promise(function(resolve, reject) {
      let currentSpaces = []
      // get the first 500 spaces that are not archived or personal
      helpers.makeCustomConfluenceRequest('get', 'space?type=global&status=current&limit=500')
        .then(spaces => {
          spaces.forEach((space, index) => {
            if (space.status === 'current') {
              currentSpaces.push(space)
            }
            if (index + 1 === spaces.length) {
              return resolve(currentSpaces)
            }
          })
        })
    });
  },
  createDecision: function(spaceKey, author, message) {
    return new Promise(function(resolve, reject) {

      let decision = message.text.split('||')[1]
      let decisionQuestion = decision.split('?')[0] + '?'

      helpers.getPageId(spaceKey, 'Decision log').then(pageId => {
        let body = helpers.formatDecisionPage(author, message)
        confluence.postContent(spaceKey, decisionQuestion, body, pageId, function(err, data) {
          if (!err) {
            helpers.addLabelsToPage(data)
            return resolve(data)
          } else {
            return reject(err)
          }
        })
      })
    });
  }
}
