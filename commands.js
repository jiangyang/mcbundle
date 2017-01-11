const share = require('./share')
global.lock = false

class BotCommand {
  run(bot, user) {
    return Promise.reject('nose')
  }
}

class ShareBundleCommand extends BotCommand {
  // share bundle X with Y
  constructor(bundle, account) {
    super()
    this.bundle = bundle
    this.account = account
  }

  run(bot, user) {
    if (global.lock) {
      return bot.postMessage(user, 'Busy...please check back later.')
    }

    let wrap = function(b, a) {
      let sharePromise = share(b, a)
      .then(msg => {
        global.lock = false
        return Promise.resolve(':thumbsup: ' + msg)
      })
      .catch(err => {
        global.lock = false
        if (err.name === 'UserError') {
          return Promise.resolve(':thumbsdown: ' + err.message)
        } else {
          console.log('dev error', err)
          // notify developer group and send a generic error to user
          // tbl
          return Promise.resolve('Error...developers are notified.')
        }
      })

      return sharePromise.then(msg => {
        return bot.postMessage(user, msg)
      })
    }

    global.lock = true
    return wrap(this.bundle, this.account)
  }
}
exports.ShareBundleCommand = ShareBundleCommand


const HELP_TEXT = 'hello, I only share NetSuite bundle. Please direct message with `share bundle <bundle_id> with <account_id>`'
class HelpCommand extends BotCommand {
  constructor() {
    super()
  }

  run(bot, user) {
    return bot.postMessage(user, HELP_TEXT)
  }
}
exports.HelpCommand = HelpCommand

exports.mkCommand = function mkCommand (input) {
  let args = String(input).toLowerCase().split(/\s+/)
  if (args && args.length === 5 &&
    args[0] === 'share' && args[1] === 'bundle' && args[3] === 'with' &&
    (/^\d+$/.test(args[2]))) {
    return new ShareBundleCommand(args[2], args[4])
  }
  return new HelpCommand()
}
