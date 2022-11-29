const { NoEmitOnErrorsPlugin } = require('webpack')
const Follow = require('../models/Follow')

exports.addFollow = function(req, res) {
    let follow = new Follow(req.params.username, req.visitorId)
    follow.create().then(() => {
        req.flash('success', `You are now following ${req.params.username}`)
        req.session.save(() => {
            res.redirect(`/profile/${req.params.username}`)
        })
    }).catch((errors) => {
        errors.forEach((err) => {
            req.flash('errors', err)
        })
        req.session.save(() => res.redirect('/'))
    })
}

exports.removeFollow = function(req, res) {
    let follow = new Follow(req.params.username, req.visitorId)
    follow.delete().then(() => {
        req.flash('success', `You are no longer following ${req.params.username}`)
        req.session.save(() => {
            res.redirect(`/profile/${req.params.username}`)
        })
    }).catch((errors) => {
        errors.forEach((err) => {
            req.flash('errors', err)
        })
        req.session.save(() => res.redirect('/'))
    })
}