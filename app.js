const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash')
const markdown = require('marked')              // shitty package that allows user to include formatting in text area. They must use html tags still though. No-one will use that.
const sanitizeHTML = require('sanitize-html')
const morgan = require('morgan');
const csrf = require('csurf')

const app = express()

// uses two ways of sending data across url, first allows req.body, second allows JSON
app.use(express.urlencoded({extended: false}))
app.use(express.json())

// API router should be placed above all middlewares that it doesn't need.
app.use('/api', require('./router-api'))

let sessionOptions = session({
    secret: "JavaScript is sooooooooo coool",
    store: MongoStore.create({client: require('./db')}),     // This changes the store from local to mongodb
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 1000 * 60 * 60 * 24, httpOnly: true}
  })
  
app.use(sessionOptions)
app.use(flash())

// All general purpose middlewares
app.use(function(req, res, next){
  // make our markdown function available within ejs templates
  res.locals.filterUserHTML = function (content) {
    return markdown.parse(content)
  }


  // Make all error and success flash messages available in all templates
  res.locals.errors = req.flash("errors")
  res.locals.success = req.flash("success")

  // make current user id available on the request object
  if (req.session.user){
    req.visitorId = req.session.user._id
  } else {
    req.visitorId = 0
  }

  // Makes the user session data available from within view templates
  res.locals.user = req.session.user
  next()
})

const router = require('./router')

app.use(express.static('public'))
app.set('views', 'views')
app.set('view engine', 'ejs')      // needs to npm install ejs

// Set app to use and expect a csrfToken with each post request it recieves
// The _csrf token is sent as hidden input with each form or axios post within the html
app.use(csrf())
app.use(function(req, res, next){
  res.locals.csrfToken = req.csrfToken()
  next()
})

app.use('/', router)
app.use(morgan('tiny'))

app.use(function(err, req, res, next) {
  if (err) {
    if (err.code == "EBADCSRFTOKEN") {
      req.flash('errors', "Cross Site Request Forgery (CSRF) detected.")
      req.session.save(res.redirect('/'))
    } else {
      res.render('404')
    }
  }
})

// The following creates a server that runs both our app and the socket.io chat
const server = require('http').createServer(app)   // Creates a server that uses our express app as its handler... http is a package included in node by default
const io = require('socket.io')(server)            // Adding socket functionality to the server

io.use(function(socket, next) {                         // allows socket to access session data
  sessionOptions(socket.request, socket.request.res, next)
})

io.on('connection', function(socket) {
  console.log('A new user connected')
  if (socket.request.session.user) {     // Only if logged in accept messages to send out
    let user = socket.request.session.user
    
    socket.emit('welcome', {username: user.username, avatar: user.avatar })
    
    socket.on('chatMessageFromBrowser', function(data){          // When socket recieves our custom event
      console.log("hit")
      socket.broadcast.emit('chatMessageFromServer', {message: sanitizeHTML(data.message, {allowedTags: [], allowedAttributes: {}}), username: user.username, avatar: "https://lwlies.com/wp-content/uploads/2017/04/avatar-2009.jpg"})    // This sends out a custom event to everyone but user. note if wrote socket.emit we would respond to our browser only. io.emit sends to everyone. 
      console.log("after broadcast")
    })
  }
})
// Socket allows the browser to listed for incoming data from server.
// Normally with axois etc the browser will just listed until it gets its expected response.


// The app is exported to db.js. The app is run from db.js. Personally don't like this.
// app was changed to server when socket.io introduced above.
module.exports = server