const usersCollection = require('../db').db().collection("users")    // saves having to type in client.db().collection('users')
const validator = require("validator")                         // Helpful for email and password
const bcrypt = require('bcryptjs')               // bcryptjs is about 30% sloweer than bcrypt.
const { resolve } = require('path')

// User is called from controller with req.body as argument. data = req.body
let User = function(data) {
  this.data = data
  this.errors = []
}


// prototype functions are not saved to the database as methods to the object.

User.prototype.cleanUp = function() {
  if (typeof(this.data.username) != "string") {this.data.username = ""}
  if (typeof(this.data.email) != "string") {this.data.email = ""}
  if (typeof(this.data.password) != "string") {this.data.password = ""}

  // get rid of any bogus properties
  this.data = {
    username: this.data.username.trim().toLowerCase(),
    email: this.data.email.trim().toLowerCase(),
    password: this.data.password
  }
}

User.prototype.validate = async function() {
  if (this.data.username == "") {this.errors.push("You must provide a username.")}
  if (this.data.username != "" && !validator.isAlphanumeric(this.data.username)) {this.errors.push("Username can only contain letters and numbers.")}
  if (!validator.isEmail(this.data.email)) {this.errors.push("You must provide a valid email address.")}
  if (this.data.password == "") {this.errors.push("You must provide a password.")}
  if (this.data.password.length > 0 && this.data.password.length < 3) {this.errors.push("Password must be at least 12 characters.")}
  if (this.data.password.length > 50) {this.errors.push("Password cannot exceed 50 characters.")}        // Note bcrypt has a limit on how long the password can be
  if (this.data.username.length > 0 && this.data.username.length < 3) {this.errors.push("Username must be at least 3 characters.")}
  if (this.data.username.length > 30) {this.errors.push("Username cannot exceed 30 characters.")}

  // Only if the username and email are valid we will query the database to see if they are unique.
  if (this.data.username.length > 2 && this.data.username.length < 31 && validator.isAlphanumeric(this.data.username)) {
    let usernameExists = await usersCollection.findOne({username: this.data.username})
    if (usernameExists) {this.errors.push("That username is already taken.")}
  }

  if (validator.isEmail(this.data.email)) {
      let emailExists = await usersCollection.findOne({email: this.data.email})
      if (emailExists) {this.errors.push("That email is already being used.")}
  }
}



// This is the old confusing way of waiting for something to run before proceeding with code. Using callback functions.
// User.prototype.login = function(callback) {      // callback is the function created in userController.js
//   this.cleanUp()
//   usersCollection.findOne({username: this.data.username}, (err, attemptedUser) => {
//     if (attemptedUser && attemptedUser.password == this.data.password) {
//       callback("Congrats!")
//     } else {
//       callback("Invalid username / password.")       // The message is passed as an arg to the function in userController.js
//     }
//   })
// }

// The modern way of waiting for code to finish before starting an operation is to use promises. promisedfunction().then().catch(). Also using async/await
User.prototype.login = function() {      
  return new Promise((resolve, reject)=>{     // Note must be arrow function so not to disturb THIS
    this.cleanUp()
    usersCollection.findOne({username: this.data.username}).then((attemptedUser) => {      // findOne() and all other mongo methods return promises
      if (attemptedUser && bcrypt.compareSync(this.data.password, attemptedUser.password)) {                 // this will return the found thing or an error object
        this.data = attemptedUser
        this.avatar = "https://lwlies.com/wp-content/uploads/2017/04/avatar-2009.jpg"
        resolve("Congrats!")
      } else {
        reject("Invalid username / password.")       
      }
    }).catch(function(e){
      console.log(e)
      reject("Error with db connection. Please try again later")
    })
  })
}

User.prototype.register = function() {
  return new Promise(async (resolve, reject)=>{
    // Step #1: Validate user data
   this.cleanUp()
   await this.validate()

   // Step #2: Only if there are no validation errors 
   // then save the user data into a database
    if (!this.errors.length) {
      let salt = bcrypt.genSaltSync(10)
      this.data.password = bcrypt.hashSync(this.data.password, salt)
      await usersCollection.insertOne(this.data)                    // How does this put _id into user object? insertOne() modifies any object put into it to include the created _id
      this.avatar = "https://lwlies.com/wp-content/uploads/2017/04/avatar-2009.jpg"
      resolve()                             // If we wanted to could pass data in through arg here
    } else {
      reject(this.errors)                              // old mate passes errors array here but it seems unneccesary
    }
  })
}


User.findByUsername = function(username) {
  return new Promise(function(resolve, reject) {
    if (typeof(username) != "string") {
      reject()
      return
    }
    usersCollection.findOne({username: username}).then(function(userDoc) {
      if (userDoc) {
        userDoc = new User(userDoc)
        userDoc = {
          _id: userDoc.data._id,
          username: userDoc.data.username,
          avatar: "https://lwlies.com/wp-content/uploads/2017/04/avatar-2009.jpg"
        }
        resolve(userDoc)
      } else {
        reject()
      }
    }).catch(function() {
      reject()
    })
  })
}


User.doesEmailExist = function(email) {
  return new Promise(async function (resolve, reject){
    if (typeof(email) != "string") {
      resolve(false)
      return
    }
    let user = await usersCollection.findOne({email: email})
    if (user) {
      resolve(true)
    } else {
      resolve(false)
    }
  })
}
module.exports = User