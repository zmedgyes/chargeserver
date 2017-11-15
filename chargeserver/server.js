var express = require('express');
var bodyParser = require('body-parser')
var request = require('request');
var async = require('async');
var mongoose = require('mongoose');
var app = express();
var geo = require('node-geo-distance');
var fs = require('fs');

var googleAPIKey = "AIzaSyBOdIvZrtOfFZeAGq2RTegybEaFEeUcltI";
var googleServerAPIKey = "AIzaSyDhY7IqIIk6jdj1wtKT-PyNIZRrsC6lM30";
var googleMapsClient = require('@google/maps').createClient({
    key: googleServerAPIKey
});
mongoose.connect('mongodb://localhost/ecarcharger', { useMongoClient: true });
var reservationSchema = new mongoose.Schema({
    chargerId: String,
    userId: String,
    from: Number,
    to:Number
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
        res.setHeader('Content-Type', 'application/json')
        res.send(body);
    })

});
app.post('/reservation/get', bodyParser.json(), function (req, res) {
    reservationModel.find(req.body, (err, data) => {
        res.setHeader('Content-Type', 'application/json')
        if (err) {
            res.write(JSON.stringify({ success: false, error: err }))
            
        }
        else {
            res.write(JSON.stringify({ success: true, data: data }))
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
            res.write(JSON.stringify({ success: false, error: err }))
          
        }
        else {
            res.write(JSON.stringify({ success: true, data: [reservation] }))
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
                res.write(JSON.stringify({ success: false, error: err }))
            }
            else {
                res.write(JSON.stringify({ success: true, data: data })) 
            }
            res.end()
        }
    )

})
app.post('/reservation/delete', bodyParser.json(), function (req, res) {
    reservationModel.deleteMany(req.body, (err) => {
        res.setHeader('Content-Type', 'application/json')
        if (err) {
            res.write(JSON.stringify({ success: false, error: err }))
        }
        else {
            res.write(JSON.stringify({ success: true, data: [] }))
        }
        res.end()
    })
})
app.post('/maps/route', bodyParser.json(), (req, res) => {
    /*var options = {
        url: "https://maps.googleapis.com/maps/api/directions/json?origin=Disneyland&destination=Universal+Studios+Hollywood4&key="+googleAPIKey,
        method: 'GET'
    }
    request(options, (err, response, body) => {
        res.setHeader('Content-Type', 'application/json')
        res.send(body);
    })*/
   /* var par = {
        dist: 100000,
        start: {
            latitude: 47.474897,
            longitude: 19.053558
        },
        end: {
            latitude: 47.952203,
            longitude: 21.720380
        }
    }*/
    var par = req.body
    bfs(par, (err, wp) => {
        var googleWaypoints = []
        for (var i = 0; i < wp.length; i++) {
            googleWaypoints.push({ lat: wp[i].latitude, lng: wp[i].longitude })
        }
        var callOptions = {
            origin: googleWaypoints[0],
            destination: googleWaypoints[googleWaypoints.length - 1],
            waypoints: googleWaypoints,
            units: "metric"
        }
        /*res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(callOptions));*/
        googleMapsClient.directions(
            callOptions,
            (err, result) => {
                res.setHeader('Content-Type', 'application/json')
                res.send(result.json);
            }
        )
    })
})
app.use('/', function (req, res) {
    res.end('server live')
})
var openChargeMapQuery = (params, callback) => {
    var url = "https://api.openchargemap.io/v2/poi/?output=json"
    for (var i in params) {
        url += "&" + i + "=" + params[i]
    }
    var options = {
        url: url,
        method: 'GET'
    }
    request(options, (err, response, body) => {
        callback(err, body)
    })
}
var startServer = () => {
    var port = 3000
    app.listen(port);
    console.log(bufferedPoints.length)
    console.log('server listening on port ' + port)
}
var bufferedPoints = []
var resultLimit = 8000
var distLimit = 1000 * 1000;
var origo = {
    latitude: 47.1801155,
    longitude: 19.5039961
}
var bufferFile = "./buffer/hu.json"
fs.access(bufferFile, (err) => {
    if (err) {
        console.log("download")
        async.series(
            [
                (callback) => {
                    async.whilst(
                        () => {
                            if (bufferedPoints.length == 0) {
                                return true;
                            }
                            if (resultLimit > bufferedPoints.length) {
                                return false;
                            }
                            return true;
                        },
                        (callback) => {
                            resultLimit = resultLimit * 2;
                            console.log(resultLimit)
                            var par = {
                                maxresults: resultLimit,
                                latitude: origo.latitude,
                                longitude: origo.longitude,
                                distance: distLimit / 1000,
                                distanceunit: "KM",
                                compact: true,
                                verbose: false
                            }
                            openChargeMapQuery(par, (err, result) => {
                                if (err) { callback(err) }
                                else {
                                    bufferedPoints = JSON.parse(result)
                                    callback()
                                }

                            })
                        },
                        (err) => {
                            async.setImmediate(callback,err)
                        }
                    )
                },
                (callback) => {
                    fs.writeFile(bufferFile, JSON.stringify(bufferedPoints),callback)
                }
            ],
            (err) => {
                if (err) { console.log(err) }
                else { startServer() }
            }
        )
    }
    else {
        console.log("fromfile")
        fs.readFile(bufferFile, 'utf8', (err, data) => {
            if (err){ console.log(err) }
            else {
                bufferedPoints = JSON.parse(data)
                startServer();
            }
        })
    }
})

var getBufferedPointsInDistance = (point,distance, callback) => {
    var points = []
    for (var i in bufferedPoints) {
        var bufferedPoint = bufferedPoints[i]
        var coord = {
            latitude: bufferedPoint.AddressInfo.Latitude,
            longitude: bufferedPoint.AddressInfo.Longitude
        }
       var dist = parseFloat(geo.vincentySync(coord, point));
        if (dist <= distance) {
            points.push(bufferedPoint)
        }
    }
    async.setImmediate(callback, null, points)
}




var bfs = (params, callback) => {
    /*var coord1 = {
        latitude: 38.8977330,
        longitude: -77.0365310
    }

    // Washington Monument 
    var coord2 = {
        latitude: 38.8894840,
        longitude: -77.0352790
    }
    geo.vincenty(coord1, coord2, function (dist) {
        console.log(dist);
    });
    var vincentyDist = geo.vincentySync(coord1, coord2);
    */
    
    
    var lastNodes = {}
    lastNodes['start'] = {
        id: "start",
        latitude: params.start.latitude,
        longitude: params.start.longitude,
        reachableFrom:[]
    }
    var endNode = {
        id: "end",
        latitude: params.end.latitude,
        longitude: params.end.longitude,
        reachableFrom:[]
    }
    var allNodes = {
        end:endNode
    }
    var idx = 0;
    async.whilst(
        () => {
            if (Object.keys(lastNodes).length == 0) {
                console.log("CANT REACH")
                return false;
            }
            for (var i in lastNodes) {
                var dist = parseFloat(geo.vincentySync(lastNodes[i], params.end))
                if (dist <= params.dist) {
                   // console.log(dist)
                    endNode.reachableFrom.push(lastNodes[i].id)
                }
            }
            if (endNode.reachableFrom.length > 0) {
                return false;
            }
            return true;
        },
        (callback) => {
            idx++;
            //console.log("IT: "+idx)
            var tmp = {}
            async.eachSeries(
                lastNodes,
                (node, callback) => {
                    getBufferedPointsInDistance(node, params.dist, (err, data) => {
                        if (err) { callback(err) }
                        else {
                           // console.log(data.length)
                            for (var i in data) {
                                if (tmp.hasOwnProperty(data[i].ID)) {
                                    tmp[data[i].ID].reachableFrom.push(node.id)
                                }
                                else {
                                    tmp[data[i].ID] = {
                                        id: data[i].ID,
                                        latitude: data[i].AddressInfo.Latitude,
                                        longitude: data[i].AddressInfo.Longitude,
                                        reachableFrom: [node.id]
                                    }
                                }
                            }
                            callback()
                        }
                    })
                    /*var par = {
                        maxresults: 100000,
                        latitude: node.latitude,
                        longitude: node.longitude,
                        distance: params.dist/1000,
                        distanceunit: "KM",
                        compact: true,
                        verbose:false
                    }
                    openChargeMapQuery(par, (err, result) => {
                        if (err) { callback(err) }
                        else {
                            var data = JSON.parse(result)
                            console.log(data.length)
                            for (var i in data) {
                               if (tmp.hasOwnProperty(data[i].ID)) {
                                    tmp[data[i].ID].reachableFrom.push(node.id)
                                }
                                else {
                                    tmp[data[i].ID] = {
                                        id: data[i].ID,
                                        latitude: data[i].AddressInfo.Latitude,
                                        longitude: data[i].AddressInfo.Longitude,
                                        reachableFrom: [node.id]
                                    }
                                }
                            }
                            callback()
                        }
                        
                    })*/
                },
                (err) => {
                    for (var i in lastNodes) {
                        allNodes[i] = lastNodes[i]
                    }
                    lastNodes = tmp;
                    async.setImmediate(callback,err)
                }
            )
        },
        (err) => {
            for (var i in lastNodes) {
                allNodes[i] = lastNodes[i]
            }
            dijkstra(allNodes, allNodes['start'], allNodes['end'],params.dist)
            var waypoints = [allNodes['end']]
            while (waypoints[waypoints.length - 1].id != "start") {
                waypoints.push(allNodes[waypoints[waypoints.length - 1].from])
            }
            waypoints = waypoints.reverse();
            async.setImmediate(callback,err,waypoints)
        }
    )
}

var dijkstra = (points, start, end, limit) => {
    start.dist = 0;
    var activepoints = [start]
    while (!activepoints.includes(end)) {
        var tmp = []
        for (var i in activepoints) {
            for (var j in points) {
                if (!points[j].closed) {
                    var dist = parseFloat(geo.vincentySync(points[j], activepoints[i]))
                    if (dist < limit) {
                        if (points[j].dist) {
                            if ((dist + activepoints[i].dist) < points[j].dist) {
                                points[j].dist = dist + activepoints[i].dist;
                                points[j].from = activepoints[i].id
                            }
                        }
                        else {
                            points[j].dist = dist + activepoints[i].dist;
                            points[j].from = activepoints[i].id
                            tmp.push(points[j])
                        }
                    }
                }
            }
            tmp.sort((a, b) => { return a.dist - b.dist })
            activepoints[i].closed = true;
        }
        activepoints = tmp;
    }
}

