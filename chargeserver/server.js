﻿var express = require('express');
var bodyParser = require('body-parser')
var request = require('request');
var async = require('async');
var mongoose = require('mongoose');
var app = express();
mongoose.connect('mongodb://localhost/ecarcharger', { useMongoClient: true });
var reservationSchema = new mongoose.Schema({
    chargerId: String,
    userId: String,
    from: Date,
    to:Date
});
var reservationModel = mongoose.model('Reservation', reservationSchema)
app.use('/openchargemap', function (req, res) {
    var ocmBaseUrl = "https://api.openchargemap.io"
    var forward = req.originalUrl.replace(req.baseUrl, '')
    var options = {
        url: ocmBaseUrl + forward,
        method: 'GET'
    }
    request(options, (err, response, body) => {
        res.send(body);
    })

});
app.post('/reservation/get', bodyParser.json(), function (req, res) {
    reservationModel.find(req.body, (err, data) => {
        res.setHeader('Content-Type', 'application/json')
        if (err) {
            res.write(JSON.stringify({ success: true, data: data }))
        }
        else {
            res.write(JSON.stringify({ success: false, error: err }))
        }
        res.end()
    })
})
app.post('/reservation/add', bodyParser.json(), function (req, res) {
    var reservation = new reservationModel()
    for (var i in req.body) {
        reservation[i] = req.body[i]
    }
    reservation.save((err) => {
        res.setHeader('Content-Type', 'application/json')
        if (err) {
            res.write(JSON.stringify({ success: true, data: [reservation] }))
        }
        else {
            res.write(JSON.stringify({ success: false, error: err }))
        }
        res.end()
    })
})
app.post('/reservation/update', bodyParser.json(), function (req, res) {
    async.waterfall(
        [
            (callback) => {
                var id = req.body['_id']
                delete req.body['_id']
                reservationModel.updateOne({ _id: id }, req.body, callback)
            }
        ],
        (err, data) => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
                res.write(JSON.stringify({ success: true, data: data }))
            }
            else {
                res.write(JSON.stringify({ success: false, error: err }))
            }
            res.end()
        }
    )

})
app.post('/reservation/delete', bodyParser.json(), function (req, res) {
    reservationModel.deleteMany(req.body, (err) => {
        res.setHeader('Content-Type', 'application/json')
        if (err) {
            res.write(JSON.stringify({ success: true, data: [] }))
        }
        else {
            res.write(JSON.stringify({ success: false, error: err }))
        }
        res.end()
    })
})




app.listen(3000);