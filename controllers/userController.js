const User = require('../models/User')
const Post = require('../models/Post')
const Follow = require('../models/Follow')
const jwt = require('jsonwebtoken')
const { findByUsername } = require('../models/User')
const { findByAuthorId } = require('../models/Post')

exports.doesUsernameExist = function(req, res) {
  User.findByUsername(req.body.username).then(function(){
    res.json(true)
  }).catch(function(){
    res.json(false)
  })
}

exports.doesEmailExist = async function(req, res) {
  let emailBool = await User.doesEmailExist(req.body.email)
  res.json(emailBool)
  }


exports.sharedProfileData = async function (req, res, next) {
  let isVisitorsProfile = false
  let isFollowing = false
  if (req.session.user) {
    isVisitorsProfile = req.profileUser._id.equals(req.session.user._id)
    isFollowing = await Follow.isVisitorFollowing(req.profileUser._id, req.visitorId)
  }

  req.isVisitorsProfile = isVisitorsProfile
  req.isFollowing = isFollowing

  // retrieve post follower and following counts
  // All three promises can happen synchronously and this waits for all of them to finish.
  let postCountPromise = await Post.countPostsByAuthor(req.profileUser._id)
  let followerCountPromise = await Follow.countFollowersById(req.profileUser._id)
  let followingCountPromise = await Follow.countFollowingById(req.profileUser._id)
  let [postCount, followerCount, followingCount] = await Promise.all([postCountPromise, followerCountPromise, followingCountPromise])   // The results are returned in an array which can be destructured.
  req.postCount = postCount
  req.followerCount = followerCount
  req.followingCount = followingCount
  
  next()
}

exports.mustBeLoggedIn = function (req, res, next) {
  if (req.session.user) {
    next()
  } else {
    req.flash('errors', "You must be logged in")
    req.session.save(function(){
      res.redirect('/')
    })
  }
}


// This is the old confusing way of waiting for something to run before proceeding with code. Using callback functions.
// exports.login = function(req, res) {
//   let user = new User(req.body)
//   user.login(function(result) {      // The entire function here is passed as an arg to login().. go to models/User.js 
//     res.send(result)                 // The message is sent as an arg from the User model. It is name result here.
//   })
// }

// Handling the async nature of login() using a promise.
exports.login = function(req, res) {
  console.log("usercont recieved")
  console.log(req.body)
  let user = new User(req.body)
  user.login().then(function(result){        // login() will return a promise ie either resolve or reject (defined in User.js)
    req.session.user = {username: user.data.username, avatar: user.avatar, _id: user.data._id}
    req.session.save(function(){
      res.redirect('/')
    })
  }).catch(function(e){
    req.flash('errors', e)
    req.session.save(function(){
      res.redirect('/')
    })
  })            
}

exports.apiLogin = function(req, res) {
  console.log("apiLogin recieved")
  console.log(req.body)
  let user = new User(req.body)
  user.login().then(function(result){        // login() will return a promise ie either resolve or reject (defined in User.js)
    res.json(jwt.sign({_id: user.data._id}, process.env.JWTSECRET, {expiresIn: '7d'}))    // jwt.sign({data to be passed across}, secret code, { options })
  }).catch(function(e){
    res.json("Login incorrect credentials")
  })            
}

exports.logout = function(req, res) {
  req.session.destroy(function(){       // Can't use .then here because session didn't support promises. Need to use a callback
    res.redirect('/')
  })
}

exports.register = function(req, res) {
  let user = new User(req.body)
  user.register().then(function(){
    req.session.user = {username: user.data.username, avatar: user.avatar, _id: user.data._id}
    req.session.save(function(){
      res.redirect('/')
    })
  }).catch(()=>{                                       // Brad passes regErrors as an argument here. This seems unnecessary as we already have access to them through the user variable.   
      user.errors.forEach(function(error){
        req.flash('regErrors', error)
      })
      req.session.save(function(){
        res.redirect('/')
      })
    }
  )
}
// Note could have just used async await and used   if (user.errors.length) {... else {...


exports.home = async function(req, res) {
  if (req.session.user) {

    //fetch feed of posts for current user
    let posts = await Post.getFeed(req.session.user._id)

    res.render('home-dashboard', {posts: posts})                // Note we don't need to pass user data through here like below because we make it avaliable in local middleware.
    // res.render('home-dashboard', {username: req.session.user.username, avatar: req.session.user.avatar})
  } else {
    res.render('home-guest', {errors: req.flash('errors'), regErrors: req.flash('regErrors')})
  }
}


exports.ifUserExists = function(req, res, next) {
  User.findByUsername(req.params.username).then(function(userDocument) {     // takes the user id from the url and tries to find the user document
    req.profileUser = userDocument                                // then if resolved adds a new property to the req object we named and sets that equal to the found document
    next()
  }).catch(function() {
    res.render("404")
  })
}

exports.profilePostsScreen = function(req, res) {
  // Ask post model for post by a certain user id
  Post.findByAuthorId(req.profileUser._id).then(
    function(posts){
      res.render('profile', {
        title: `Profile for ${req.profileUser.username}`,
        currentPage: "posts",
        posts: posts,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }
      })
    }
  ).catch(
    function(){
      res.render('404')
    }
  )
}

exports.profileFollowersScreen = async function (req, res) {
  try {
    let followers = await Follow.getFollowersById(req.profileUser._id)
  res.render('profile-followers', {
    currentPage: "followers",
    followers: followers,
    profileUsername: req.profileUser.username,
    profileAvatar: req.profileUser.avatar,
    isFollowing: req.isFollowing,
    isVisitorsProfile: req.isVisitorsProfile,
    counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }

  })
  } catch {
    res.render('404')
  }
}

exports.profileFollowingScreen = async function (req, res) {
  try {
    let following = await Follow.getFollowingById(req.profileUser._id)
  res.render('profile-following', {
    currentPage: "following",
    following: following,
    profileUsername: req.profileUser.username,
    profileAvatar: req.profileUser.avatar,
    isFollowing: req.isFollowing,
    isVisitorsProfile: req.isVisitorsProfile,
    counts: { postCount: req.postCount, followerCount: req.followerCount, followingCount: req.followingCount }
  })
  } catch {
    res.render('404')
  }
}

exports.apiMustBeLoggedIn = function (req, res, next) {
  try {
    req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET)
    next()
  } catch {
    res.json("Sorry, your token is invalid")
  }
}

exports.apiGetPostsByUsername = async function (req, res) {
  try {
    let authorDoc = await User.findByUsername(req.params.username)
    let posts = await Post.findByAuthorId(authorDoc._id)
    res.json(posts)
  } catch {
    res.json('Invalid User requested')

  }
}

"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2Mzg1NzNhZDc0Y2UyZjA0NWQ2NjZkYzMiLCJpYXQiOjE2Njk3MDI3MjYsImV4cCI6MTY3MDMwNzUyNn0._FmwV8-MmBBmRnLOL5W5U5cZ0cWeZru5eelfoenoSyw"