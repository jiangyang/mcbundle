const util = require('util')
const Nightmare = require('nightmare')

function DevError(msg) {
  DevError.super_.call(this)
  this.message = msg
  this.name = 'DeveloperError'
}
util.inherits(DevError, Error)

function UserError(msg) {
  UserError.super_.call(this)
  this.message = msg
  this.name = 'UserError'
}
util.inherits(UserError, Error)

function waitUpTo(t, i, gen_promise) {
  t = t < 0 ? 0 : t
  i = i < 1000 ? 1000 : i
  i = i > 30000 ? 30000 : i
  let rest = t
  let timeout = rest < i ? rest: i
  rest -= timeout
  return new Promise(function(res, rej) {
    setTimeout(function() {
      gen_promise()
      .then(res)
      .catch(err => {
        if (rest > 0) {
          return res(waitUpTo(rest, i, gen_promise))
        }
        rej(err)
      })
    }, timeout)
  })
}

// Modify these to fit your instances
const AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) Chrome/54.0.2840.71 Safari/537.36'
const LOGIN_URL = 'https://system.netsuite.com/pages/customerlogin.jsp?country=US'
const LOGOUT_URL = 'https://system.na1.netsuite.com/pages/nllogoutnoback.jsp'
const BUNDLE_URL_FRAG = 'https://system.na1.netsuite.com/app/bundler/publishbundle.nl?e=T&id='
const TWOFA_PATH = '/pages/twofactorqa.jsp'
const HOME_PATH = '/app/center/card.nl'
const BUNDLE_PUB_PATH = '/app/bundler/publishbundle.nl'

function login(nightmare) {
  let p1 = nightmare
  .useragent(AGENT)
  .goto(LOGIN_URL)
  .type('input[name=email]', process.env.USER)
  .type('input[name=password]', process.env.PASS)
  .click('input[name=submitButton]')
  .then(_ => {
    return waitUpTo(20000, 2000, function () {
      return nightmare
      .evaluate(function() { return document.location.pathname })
      .then(path => {
        console.log('expecting path: 2FA', path)
        if (path === TWOFA_PATH) return Promise.resolve()
        else return Promise.reject(new DevError('expect 2FA, but instead at path' + path))
      })
    })
  })
  .catch(x => Promise.reject(x))

  return p1.then(_ => {
    // 2fa
    return nightmare
    .wait('input[name=submitter]')
    .evaluate(function () {
      var tds = document.getElementsByTagName('td')
      for(var i = 0; i < tds.length; i++) {
        if(tds[i].textContent && tds[i].textContent.trim() === 'Question') break
      }
      var qTd = tds[i+1]
      var q = qTd.textContent.trim()
      return q
    })
    .then(q => {
      if (!q) return reject(new DevError('Fail to get security question'))
      return q
    })
    .then(question => {
      // read the question and figure out the answer
      return nightmare
        .type('input[name=answer]', 'you will need to change this to supply the answer for security question')
        .click('input[name=submitter]')
    })
    .then(_ => {
      return waitUpTo(20000, 2000, function () {
        return nightmare
        .evaluate(function() { return document.location.pathname })
        .then(path => {
          console.log('expecting path: home', path)
          if (path === HOME_PATH) return Promise.resolve()
          else return Promise.reject(new UserError('Login failure. Please try again later.'))
        })
      })
    })
  })
}

function share(nightmare, bundle, account) {
  return nightmare
  .goto(BUNDLE_URL_FRAG + bundle)
  .then(_ => {
    return waitUpTo(20000, 2000, function () {
      return nightmare
      .evaluate(function() { return document.location.pathname })
      .then(path => {
        console.log('expecting path: publish bundle', path)
        if (path === BUNDLE_PUB_PATH) return Promise.resolve()
        else return reject(new DevError('expect bundle publish page, but instead at path' + path))
      })
    })
  })
  .then(_ => {
    return nightmare.evaluate(function() {
      if (document.querySelector('input#goback')) {
        return false
      }
      return true
    })
  })
  .then(onBundlePage => {
    if (!onBundlePage) return Promise.reject(new UserError('Invalid bundle. Check bundle id.'))
    return Promise.resolve()
  })
  // get bundle info
  .then(_ => {
    return nightmare
    .wait('textarea[name=sharedcompid]')
    .evaluate(function (account) {
      var out = {
        success: true,
        share: false,
        message: ''
      }
      var level = document.querySelector('#inpt_bundlelevel1').title
      if (level !== 'Shared') {
        out.success = false
        if (level === 'Public') {
          out.message = 'Bundle ${bundle} is "Public". No need to share.'
        } else {
          out.message = 'Bundle ${bundle} is "Private" and cannot be shared.'
        }
        return out
      }
      var accounts = document.querySelector('textarea[name=sharedcompid]').value
      if (!accounts || !accounts.split(' ').length) {
        out.success = false
        out.message = 'Cannot locate existing shared accounts.'
      }
      var accts = accounts.split(' ')
      if (accts.indexOf(account) > -1) {
        out.share = false
        out.message = 'Bundle ${bundle} had been shared with account ${account} already.'
      } else {
        out.share = true
      }

      return out
    }, account)
  })
  .then(info => {
    if (info && info.message) {
      info.message = info.message.replace('${bundle}', `${bundle}`).replace('${account}', `${account}`)
    }
    if (!info || !info.success) {
      return Promise.reject(new UserError(info && info.message))
    }
    return Promise.resolve(info)
  })
  .then(info => {
    if (!info.share) return Promise.resolve(info.message)
    return nightmare
    .type('textarea[name=sharedcompid]', account + ' ')
    .click('input#save')
    .wait(5000)
    .then(_ => {
      let msg = info.message || `Bundle ${bundle} is shared with account ${account}.`
      return Promise.resolve(msg)
    })
  })
}

module.exports = function sharewrapper(bundle, account) {
  if (!process.env.USER && !process.env.PASS) {
    return Promise.reject(new DevError('missing credentials'))
  }
  if (!bundle || !account) {
    return Promise.reject(new UserError('requires bundle id and account id'))
  }
  bundle = encodeURIComponent(bundle)
  account = String(account).toUpperCase()
  console.log(`sharing bundle ${bundle} with account ${account}...`)

  const nightmare = Nightmare({
    gotoTimeout: 60000,
    waitTimeout: 30000,
    typeInterval: 20,
    show: false,
    paths: {
      userData: '/dev/null'
    }
  })

  return login(nightmare)
  .then(_ => share(nightmare, bundle, account))
  .then(msg => {
    nightmare.end().then()
    return Promise.resolve(msg)
  })
  .catch(err => {
    nightmare.end().then()
    return Promise.reject(err)
  })
}
