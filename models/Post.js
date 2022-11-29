const postsCollection = require('../db').db().collection("posts")
const followsCollection = require('../db').db().collection("follows")
const ObjectID = require('mongodb').ObjectID
const User = require('./User')
const sanitizeHTML = require('sanitize-html')

//  when sorting db results it helps to create an index sometimes.. postsCollection.createIndex({title: "text", body: "text"})


let Post = function(data, userid, requestedPostId) {
  this.data = data
  this.errors = []
  this.userid = userid
  this.requestedPostId = requestedPostId
}

Post.prototype.cleanUp = function() {
  if (typeof(this.data.title) != "string") {this.data.title = ""}
  if (typeof(this.data.body) != "string") {this.data.body = ""}

  // get rid of any bogus properties
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {allowedTags: [], allowedAttributes: {}}),
    body: sanitizeHTML(this.data.body.trim(), {allowedTags: [], allowedAttributes: {}}),
    createdDate: new Date(),
    author: ObjectID(this.userid)
  }
}

Post.prototype.validate = function() {
  if (this.data.title == "") {this.errors.push("You must provide a title.")}
  if (this.data.body == "") {this.errors.push("You must provide post content.")}
}

Post.prototype.create = function() {
  return new Promise((resolve, reject) => {
    this.cleanUp()
    this.validate()
    if (!this.errors.length) {
      // save post into database
      postsCollection.insertOne(this.data).then((info) => {
        resolve(info.insertedId)          // mongo has property on returned value insertedId
      }).catch(() => {
        this.errors.push("Please try again later.")
        reject(this.errors)
      })
    } else {
      reject(this.errors)
    }
  })
}

Post.prototype.update = function(){
  return new Promise(async (resolve, reject)=>{
    try {
      let post = await Post.findSingleById(this.requestedPostId, this.userid)
      if(post.isVisitorOwner){
        let status = await this.updateDb()
        resolve(status)
      } else {
        reject()
      }
    } catch {
      reject()
    }
  })
}

Post.prototype.updateDb = function(){
  return new Promise(async (resolve, reject)=>{
    this.cleanUp()
    this.validate()
    if (!this.errors.length){
      await postsCollection.findOneAndUpdate({_id: new ObjectID(this.requestedPostId)}, {$set: {title: this.data.title, body: this.data.body}})
      resolve("success")
    } else {
      resolve("failure")
    }
  })
}

Post.reusablePostQuery = function(searchBy, visitorId, finalOperations = []) {
  return new Promise(async function(resolve, reject) {
    let aggOperations = searchBy.concat([
      // {$match: {_id: new ObjectID(id)}},
      {$lookup: {from: "users", localField: "author", foreignField: "_id", as: "authorDocument"}},
      {$project: {
        title: 1,
        body: 1,
        createdDate: 1,
        authorId: "$author",                // $ at the beginning of author means we are looking at author field not just a string of text
        author: {$arrayElemAt: ["$authorDocument", 0]}
      }}
    ]).concat(finalOperations)


    // usually would look for findOne() however we don't just need to look up a post we also need tp look up the user with matching id
    let posts = await postsCollection.aggregate(aggOperations).toArray()

    // clean up author property in each post object
    posts = posts.map(function(post) {
      post.isVisitorOwner = post.authorId.equals(visitorId)     // Will return true or false if equal

      post.authorId = undefined // This is so authorId isn't sent to frontend js via Post.search , also could use delete post.authorId but this is a slow operation.
      post.author = {
        username: post.author.username,
        avatar: "https://lwlies.com/wp-content/uploads/2017/04/avatar-2009.jpg"
      }
      return post
    })
    resolve(posts)
  })
}


Post.findSingleById = function(id, visitorId) {
  return new Promise(async function(resolve, reject) {
    if (typeof(id) != "string" || !ObjectID.isValid(id)) {       // Having the not string stops injection attacks
      reject()
      return
    }

    let posts = await Post.reusablePostQuery([
      {$match: {_id: new ObjectID(id)}},
    ], visitorId)

    if (posts.length) {
      resolve(posts[0])
    } else {
      reject()
    }
  })
}

Post.findByAuthorId = function (authorId){
  return Post.reusablePostQuery([         // does not need to await because we are returning a function (reusablePostQuery) which itself is a promise function. The 
    {$match: {author: authorId}},
    {$sort: {createdDate: -1}}
  ])
}

Post.delete = function(postIdToDelete, currentUserId){
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSingleById(postIdToDelete, currentUserId)
      if (post.isVisitorOwner) {
        await postsCollection.findOneAndDelete({_id: new ObjectID(postIdToDelete)})
        resolve()
      } else {
        reject()
      }
    } catch {
      reject()
    }
  })
}

Post.search = function(searchTerm) {
  return new Promise(async (resolve, reject) => {
    if (typeof(searchTerm) == "string") {             // requiring string prevents sq injection attacks. If empty it will be undefined also.
      let posts = await Post.reusablePostQuery([       // sort must come after project sp reusablePostQuery recoded with three arguments, middle arg (visitorId) undefined
        {$match: {$text: {$search: searchTerm}}}      // searches within the text. Note This complex task can be made easier by indexing the database to the title and body instead of just the -id.
      ], undefined, [{$sort: {score: {$meta: "textScore"}}}])   // search by relevance to the search term     // 
      resolve(posts)
    } else { 
      reject()
    }
  })
}

Post.countPostsByAuthor = function(id) {
  return new Promise(async (resolve, reject) => {
    let postCount = await postsCollection.countDocuments({author: id})      // countDocuments is a mongo method.
    resolve(postCount)
  })
}

Post.getFeed = async function(id) {
  // create an array of the user ids that the current user follows
  let followedUsers = await followsCollection.find({authorId: new ObjectID(id)}).toArray()     // find will return multiple docs in a format that makes sense to mongo. toArray makes it so that we can easily access it.
  followedUsers = followedUsers.map(function(followDoc) {     // we want to map a new array with just the followId property for each followDoc. ie for each followDoc in array map just the followedId property into a new array.
    return followDoc.followedId
  })

  // look for posts where the author is in the above array of followed users
  return Post.reusablePostQuery([
    {$match: {author: {$in: followedUsers}}},
    {$sort: {createdDate: -1}}
  ])
}


module.exports = Post