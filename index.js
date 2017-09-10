/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 ______    ______    ______   __  __    __    ______
 /\  == \  /\  __ \  /\__  _\ /\ \/ /   /\ \  /\__  _\
 \ \  __<  \ \ \/\ \ \/_/\ \/ \ \  _"-. \ \ \ \/_/\ \/
 \ \_____\ \ \_____\   \ \_\  \ \_\ \_\ \ \_\   \ \_\
 \/_____/  \/_____/    \/_/   \/_/\/_/  \/_/    \/_/


 This is a sample Slack Button application that provides a custom
 Slash command.

 This bot demonstrates many of the core features of Botkit:

 *
 * Authenticate users with Slack using OAuth
 * Receive messages using the slash_command event
 * Reply to Slash command both publicly and privately

 # RUN THE BOT:

 Create a Slack app. Make sure to configure at least one Slash command!

 -> https://api.slack.com/applications/new

 Run your bot from the command line:

 clientId=<my client id> clientSecret=<my client secret> PORT=3000 node bot.js

 Note: you can test your oauth authentication locally, but to use Slash commands
 in Slack, the app must be hosted at a publicly reachable IP or host.


 # EXTEND THE BOT:

 Botkit is has many features for building cool and useful bots!

 Read all about it here:

 -> http://howdy.ai/botkit

 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
'use strict';
/* Uses the slack button feature to offer a real time bot to multiple teams */
var Botkit = require('botkit');
var confluence = require('./confluence');
var slack = require('./slack');

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.PORT || !process.env.VERIFICATION_TOKEN) {
    console.log('Error: Specify CLIENT_ID, CLIENT_SECRET, VERIFICATION_TOKEN and PORT in environment');
    process.exit(1);
}

var config = {}
if (process.env.MONGODB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGODB_URI}),
        interactive_replies: true
    };
} else {
    config = {
        json_file_store: './db_slackbutton_slash_command/',
        interactive_replies: true
    };
}

var controller = Botkit.slackbot(config).configureSlackApp(
    {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        scopes: ['commands', 'bot', 'chat:write:bot'],
    }
);

controller.setupWebserver(process.env.PORT, function (err, webserver) {
    controller.createHomepageEndpoint(controller.webserver)
    controller.createWebhookEndpoints(controller.webserver);

    controller.createOauthEndpoints(controller.webserver, function (err, req, res) {
        if (err) {
            res.status(500).send('ERROR: ' + err);
        } else {
            res.send('Success!');
        }
    });
});

var bot = controller.spawn({
  token: process.env.BOT_TOKEN
})

bot.startRTM(function(err,bot,payload) {
  if (err) {
    throw new Error('Could not connect to Slack');
  }

  // // close the RTM for the sake of it in 5 seconds
  // setTimeout(function() {
  //     bot.closeRTM();
  // }, 5000);
});


controller.on('slash_command', function (slashCommand, message) {

    switch (message.command) {
        case "/decision": // send the user a list of spaces to store the decision

            // but first, let's make sure the token matches!
            if (message.token !== process.env.VERIFICATION_TOKEN) return; //just ignore it.

            // if no text was supplied, treat it as a help command
            if (message.text === "" || message.text === "help") {
                slashCommand.replyPrivate(message,
                    "I echo back what you tell me. " +
                    "Try typing `/echo hello` to see.");
                return;
            }

            let decisionTitle = message.text

            confluence.getAvailableSpaces()
              .then(spaces => {
                let slackOptions = []
                spaces.forEach(space => {
                  slackOptions.push({
                    text: space.name,
                    value: `${space.key}||${decisionTitle}`
                  })
                })
                slashCommand.replyPublic(message, {
                  title: `User wants to create a decision to memorialize this conversation`,
                  attachments: [
                    {
                      title: `Choose a space for this decision...`,
                      callback_id: `select_space_for_decision`,
                      attachment_type: `default`,
                      actions: [
                        {
                          name: `space_list`,
                          text: `Select a Space...`,
                          type: `select`,
                          options: slackOptions
                        }
                      ]
                    }
                  ]
                })
              })
              .catch(err => {
                slashCommand.replyPublicDelayed(err, `${message.user_name} has fucked up`)
              })
            break;
        default:
            slashCommand.replyPublic(message, "I'm afraid I don't know how to " + message.command + " yet.");

    }

});

controller.on('interactive_message_callback', function(bot, message) {

  switch(message.callback_id) {

    case "select_space_for_decision":
      //reply right away for a loading icon
      bot.replyInteractive(message, {
        attachments: [
          {
            title: ':spinning:'
          }
        ]
      })

      let selectedSpace = message.text.split('||')[0]

      let usersRealName = slack.getUserRealNameFromId(message.user)
        .then(author => {
          confluence.createDecision(selectedSpace, author, message)
            .then(page => {
              bot.replyInteractive(message, {
                attachments: [
                  {
                    title: `${author} created a decision in Confluence! <${page._links.base}${page._links.webui}|${page.title}> (<${page._links.base}${page._links.editui}|edit>)`
                  }
                ]
              })
            })
           .catch(err => {
             console.log(err)
           })
        })
        .catch(err => {
          console.log(err)
        })
      break;

    default:
      bot.replyInteractive(message, {
        text: "I'm not sure what to do"
      })
  }

})
