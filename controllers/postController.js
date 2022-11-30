const Post = require('../models/Post')
const sendgrid = require('@sendgrid/mail')

sendgrid.setApiKey(process.env.SENDGRIDAPIKEY)

exports.viewCreateScreen = function(req, res) {
  res.render('create-post')
}

exports.create = function(req, res) {
  let post = new Post(req.body, req.session.user._id)
  post.create().then(function(newId) {
    // sendgrid.send({
    //   to: 'nathan.phillips003@gmail.com',
    //   from: 'socialmediaapp@gmail.com',          // need to have sender email authenticated first
    //   subject: 'You made a new post',
    //   text: 'good job Bozo',                       // Some emails aren't displayed with html. This is like a back up.
    //   html: 'good job <strong>Bozo</strong>'       // Could have dynamic `dfdf ${} drstr`
    // })
    req.flash('success', "New post created.")
    req.session.save(()=>res.redirect(`/post/${newId}`))
  }).catch(function(errors) {
    errors.forEach(error => req.flash('errors', error))
    req.session.save(() => res.redirect('/create-post'))
  })
}


exports.apiCreatePost = function(req, res) {
  let post = new Post(req.body, req.apiUser._id)
  post.create().then(function(newId) {
    res.json(newId)                 // 
  }).catch(function(errors) {
    res.json(errors)
  })
}

exports.viewSingle = async function(req, res) {
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId)
    res.render('single-post-screen', {post: post, title: post.title})
  } catch {
    res.render('404')
  }
}

exports.viewEditScreen = async function(req, res) {
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId)
    if (post.isVisitorOwner) {
      res.render("edit-post", {post: post})
    } else {
      req.flash("errors", "You do not have permission to perform that action.")
      req.session.save(() => res.redirect("/"))
    }
  } catch {
    res.render("404")
  }
}


exports.edit = function(req, res) {
  let post = new Post(req.body, req.visitorId, req.params.id)
  post.update().then((status) => {
    // the post was successfully updated in the database
    // or user did have permission, but there were validation errors
    if (status == "success") {
      // post was updated in db
      req.flash("success", "Post successfully updated.")
      req.session.save(function() {
        res.redirect(`/post/${req.params.id}`)
      })
    } else {
      post.errors.forEach(function(error) {
        req.flash("errors", `errors are ${error}`)
      })
      req.session.save(function() {
        res.redirect(`/post/${req.params.id}/edit`)
      })
    }
  }).catch(() => {
    // a post with the requested id doesn't exist
    // or if the current visitor is not the owner of the requested post
    req.flash("errors", "You do not have permission to perform that action.")
    req.session.save(function() {
      res.redirect("/")
    })
  })
}

exports.delete = function(req, res){
  Post.delete(req.params.id, req.visitorId).then(function(){
    req.flash('success', "post deleted.")
    req.session.save(res.redirect(`/profile/${req.session.user.username}`))
  }
  ).catch(()=>{
    req.flash('errors', "You do not have permission to delete this post")
    req.session.save(()=>res.redirect('/'))
  })
}

exports.apiDelete = function(req, res){
  Post.delete(req.params.id, req.apiUser._id).then(function(){
    res.json("post deleted")
  }
  ).catch(()=>{
    res.json("You cant perform that action")
  })
}

exports.search = function(req, res) {
  Post.search(req.body.searchTerm).then(posts => {
    res.json(posts)
  }).catch(() => {
    res.json([])
  })
}