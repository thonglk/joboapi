// grab the packages we need
var express = require('express');
var app = express();
var port = process.env.PORT || 8080;

var admin = require("firebase-admin");

admin.initializeApp({
    credential: admin.credential.cert("adminsdk.json"),
    databaseURL: "https://jobo-b8204.firebaseio.com"
});
var dataConfig = {};

var db = admin.database();
var ref = db.ref("user");
ref.on("value", function (snapshot) {
    console.log(snapshot.val());
    dataConfig = snapshot.val();
    dataJobseeker = dataConfig.jobber;
    dataEmployer = dataConfig.employer
});

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var x = R * c; // Distance in km
    var n = parseFloat(x);
    x = Math.round(n * 10) / 10;
    return x;
}
function deg2rad(deg) {
    return deg * (Math.PI / 180)
}


var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies

// routes will go here

// ====================================
// URL PARAMETERS =====================
// ====================================
// http://localhost:8080/api/users?userid=0AIoACa05uPaMXNEDsoa24XEL9v1&mylng=105.851128&mylat=21.013543&job=thungan&time=weekday&distance=40&onlydistance=false
app.get('/api/users', function (req, res) {
    var userid = req.param('userid')
    var mylng = req.param('mylng');
    var mylat = req.param('mylat');
    var jobfilter = req.param('job');
    var timefilter = req.param('time');
    var distancefilter = req.param('distance');
    var onlydistance = req.param('onlydistance')

    var usercard = [];
    for (var i in dataJobseeker){
        var card = dataJobseeker[i]
        if (card.location && card.location.location) {
            var yourlat = card.location.location.lat;
            var yourlng = card.location.location.lng;
            var distance = getDistanceFromLatLonInKm(mylat, mylng, yourlat, yourlng);


            if ((card.stars && !card.stars[userid]) && (card.disstars && !card.disstars[userid]) && distance < distancefilter) {
                card.distance = distance;
                if (onlydistance === true) {
                    usercard.push(card)

                } else {
                    if (card.interest && card.interest.time && card.interest.time[timefilter] && card.interest.job && card.interest.job[jobfilter]) {
                        usercard.push(card)

                    }
                }
            }
        }
    }

    res.send(usercard)

});

// http://localhost:8080/api/1
app.get('/api/chat', function (req, res) {
    var userid = req.param('id');

    res.send("hihi " + userid);
});

// parameter middleware that will run before the next routes
app.param('name', function (req, res, next, name) {

    // check if the user with that name exists
    // do some validations
    // add -dude to the name
    var modified = name + '-dude';

    // save name to the request
    req.name = modified;

    next();
});

// http://localhost:8080/api/users/chris
app.get('/api/users/:name', function (req, res) {
    // the user was found and is available in req.user
    res.send('What is up ' + req.name + '!');
});

// ====================================
// POST PARAMETERS ====================
// ====================================

// POST http://localhost:8080/api/users
// parameters sent with 
app.post('/api/users', function (req, res) {
    var user_id = req.body.id;
    var token = req.body.token;
    var geo = req.body.geo;

    res.send(user_id + ' ' + token + ' ' + geo);
});
app.get('/', function (req, res) {


    res.send('Admin Homepage' + dataConfig);
});

// start the server
app.listen(port);
console.log('Server started! At http://localhost:' + port);