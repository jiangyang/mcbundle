const SlackBot = require('slackbots')
const commands =require('./commands')

if (!process.env.USER && !process.env.PASS) {
  console.error('missing credentials')
  process.exit(1)
}
if (!process.env.SLACK_BOT_TOKEN) {
  console.error('missing slack bot token')
  process.exit(1)
}
if (!process.env.SLACK_BOT_ID) {
  console.error('missing slack bot id')
  process.exit(1)
}
if (!process.env.SLACK_TEAM_ID) {
  console.error('missing slack team id')
  process.exit(1)
}

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_BOT_ID = process.env.SLACK_BOT_ID
const SLACK_TEAM_ID = process.env.SLACK_TEAM_ID

let bot = new SlackBot({
  token: SLACK_BOT_TOKEN,
  name: 'Bundle McBundleShare'
})

bot.on('start', function() {
  console.log('hi')
})

bot.on('message', function(data) {
  // lift the edited message so it is just as if you re-typed it
  if (data.type === 'message' && data.subtype === 'message_changed') {
    data = data.message
  }
  if (data.type !== 'message' ||
    data.team && data.team !== SLACK_TEAM_ID ||
    data.user_team && data.user_team !== SLACK_TEAM_ID ||
    data.bot_id  && data.bot_id === SLACK_BOT_ID || 
    data.user && data.user === SLACK_BOT_ID) {
    return
  }
  let text = data.text
  let cmd = commands.mkCommand(text)
  cmd.run(bot, data.channel)
  .then(thing => {})
  .catch(err => { console.log('not good..', err) })
})

