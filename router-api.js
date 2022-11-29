const apiRouter = require('express').Router()
const userController = require('./controllers/userController')
const postController = require('./controllers/postController')
const followController = require('./controllers/followController')
const cors = require('cors')
const { append } = require('domutils')


apiRouter.use(cors())       // Cross Origin Resource Sharing policy by default does not allow requests from other domains. CORS changes this.


apiRouter.post('/login', userController.apiLogin)
apiRouter.post('/create-post', userController.apiMustBeLoggedIn, postController.apiCreatePost)
apiRouter.delete('/post/:id', userController.apiMustBeLoggedIn, postController.apiDelete)
apiRouter.get('/postsByAuthor/:username', userController.apiGetPostsByUsername)     // Should create middlewares like .ifUserExists etc however this is just short demo


module.exports = apiRouter