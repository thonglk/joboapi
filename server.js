// grab the packages we need
var firebase = require("firebase-admin");
var express = require('express');
var app = express();
var port = process.env.PORT || 8080;

var http = require('http');
var https = require('https');
var nodemailer = require('nodemailer');
var ses = require('nodemailer-ses-transport');
var schedule = require('node-schedule');
var Promise = require('promise');
var escape = require('escape-html');
var _ = require("underscore");
var async = require("async");
var multipart = require('connect-multiparty');
var cors = require('cors')

var CONFIG = {
    'FCM_KEY': "AAAArk3qIB4:APA91bEWFyuKiFqLt4UIrjUxLbduQCWJB4ACptTtgAovz4CKrMdonsS3jt06cfD9gGOQr3qtymBmKrsHSzGhqyJ_UWrrEbA4YheznlqYjsCBp_12bNPFSBepqg_qrxwdYxX_IcT9ne5z6s02I2mu2boy3VTN3lGPYg",
        "APIKey": 'AIzaSyATOX9rL_ULV-Q_e2kImu9wYgK2AToOteQ'
}

// TODO(DEVELOPER): Configure your email transport.
// Configure the email transport using the default SMTP transport and a GMail account.
// See: https://nodemailer.com/
// For other types of transports (Amazon SES, Sendgrid...) see https://nodemailer.com/2-0-0-beta/setup-transporter/
// var mailTransport = nodemailer.createTransport('smtps://<user>%40gmail.com:<password>@smtp.gmail.com');

var mailTransport = nodemailer.createTransport(ses({
    accessKeyId: 'AKIAJ5MPNXQ23L6UNUDA',
    secretAccessKey: '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',
    region: 'us-west-2'
}));



app.use(cors())


firebase.initializeApp({
    credential: firebase.credential.cert('adminsdk.json'),
    databaseURL: "https://jobfast-359da.firebaseio.com"
});

var firstListen;
var dataAll = {};
var db = firebase.database();
var ref = db.ref();

function init() {

    ref.on("value", function (snapshot) {
        dataAll = snapshot.val();
        dataConfig = dataAll.config;
        dataUser = dataAll.user;
        dataProfile = dataAll.profile;
        dataStore = dataAll.store;

        likeActivity = dataAll.activity.like;

        dataToken = dataAll.token;

        console.log('done');
        if (!firstListen) {
            startListeners();
            firstListen = true
            for (var i in dataProfile){
                var card = dataProfile[i]
                card.userid = i
                var Eref = db.ref('profile/'+ i)
                Eref.update(card)
            }
        }
    })


}


function startListeners() {

    // listen for changes to Firebase data
    /*
     * New activity: Like or dislike
     *
     */
    var meREf = db.ref('activity/like').orderByChild('status').equalTo(0)
    meREf.on('child_added', function (snap) {
        console.log('snap', snap.key, snap.val(), 'child_added')

    });
    meREf.on('child_changed', function (snap) {
        console.log('snap', snap.key, snap.val(), 'child_changed')

    });


    // new like or unlike
    db.ref('/activity/like')
        .on('child_added', function (postSnapshot) {
                likeActivity[postSnapshot.key] = postSnapshot.val()

                var activityRef = postSnapshot.ref;
                var activity = postSnapshot.val();


                if (!activity.noti) {
                    console.log('child_add', activity)

                    // Start send notification
                    if (activity.type == 1) {

                        // Store like user
                        var job = "";
                        for (var key in activity.jobStore) {
                            job = job + dataConfig.job[key];
                            console.log(job)
                        }

                        var storeId = activity.storeId;
                        var userId = activity.userId;

                        var user = dataUser[activity.userId];
                        var lastName = getLastName(user.name || "bạn");

                        var storeName = dataStore[storeId].storeName;
                        var storePhoto = dataStore[storeId].photourl;


                        var content = dataStore[storeId].storeName + " muốn tuyển bạn vào vị trí " + job;


                        //noti in app

                        var notiId = db.ref('notification/' + userId).push().key;
                        db.ref('notification/' + userId + '/' + notiId).update({
                            createdAt: new Date().getTime(),
                            id: notiId,
                            sender: storeId,
                            senderName: storeName,
                            senderPhotourl: storePhoto,
                            text: content,
                            status: 0

                        })

                        // send noti push
                        var toTokenRef = dataToken[userId];
                        if (toTokenRef && toTokenRef.token) {
                            var toToken = toTokenRef.token
                            var title = "Việc tìm người";
                            var body = lastName + " ơi!, " + storeName + " muốn tuyển bạn vào vị trí " + job;
                            var goto = 'employer.activity';
                            sendNotificationToGivenUser(toToken, body, title, goto)


                        } else {
                            // has no token , we send email

                            var email = user.email;
                            if (email) {
                                console.log("email", email);
                                var title = dataStore[storeId].storeName + " muốn tuyển bạn vào vị trí " + job;
                                var preview = content;

                                var emailHtml = '<!DOCTYPE html> <html> <head> <meta name="viewport" content="width=device-width"> <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"> <title>Simple Transactional Email</title> </head> <body class="" style="background-color: #f6f6f6; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; margin: 0; padding: 0;" bgcolor="#f6f6f6"> <style type="text/css"> .btn-primary table td:hover { background-color: #34495e !important; } .btn-primary a:hover { background-color: #34495e !important; border-color: #34495e !important; } ></style> <table border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background-color: #f6f6f6;" bgcolor="#f6f6f6"> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> </td> <td class="container" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; display: block; max-width: 580px; width: 100% !important; margin: 0 auto; padding: 0;" valign="top"> <div class="content" style="box-sizing: border-box; display: block; max-width: 580px; margin: 0 auto; padding: 0;"> <!-- START CENTERED WHITE CONTAINER --> <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0; font-size: 16px !important;">' + preview + '</span> <table class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; border-radius: 0 !important; border-left-width: 0 !important; border-right-width: 0 !important; background-color: #fff;" bgcolor="#fff"> <!-- START MAIN CONTENT AREA --> <tr> <td class="wrapper" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; box-sizing: border-box; padding: 10px;" valign="top"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> Chào ' + lastName + ',</p> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> ' + preview + ', nhấn vào đây để xem chi tiết về công việc và đãi ngộ nhé!</p> <table border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; box-sizing: border-box;"> <tbody> <tr> <td align="left" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; padding-bottom: 15px;" valign="top"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100% !important;"> <tbody> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; border-radius: 5px; text-align: center; background-color: #3498db;" align="center" bgcolor="#3498db" valign="top"><a href="http://joboapp.com/go" target="_blank" style=" background: #1A9CC7; color: #ffffff; /* fallback for old browsers */ background: -webkit-linear-gradient(to left, #1A9CC7, #32C28F); /* Chrome 10-25, Safari 5.1-6 */ background: linear-gradient(to left, #1A9CC7, #32C28F); /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */ ; text-decoration: none; border-radius: 0px; box-sizing: border-box; cursor: pointer; display: inline-block; font-size: 16px !important; font-weight: bold; text-transform: capitalize; width: 100% !important; margin: 0; padding: 12px 25px; border: 0px solid #3498db;">Xem chi tiết!</a></td> </tr> </tbody> </table> </td> </tr> </tbody> </table> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> ' + lastName + ' có thể lướt thêm các công việc đang tuyển xung quanh bạn trên ứng dụng Jobo nữa nhé!. Nếu cần bạn cứ liên hệ mình để được giúp đỡ nha!</p> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> Chúc bạn may mắn.</p> </td> </tr> </table> </td> </tr> <!-- END MAIN CONTENT AREA --> </table> <!-- START FOOTER --> <div class="footer" style="clear: both; padding-top: 10px; text-align: center; width: 100%;" align="center"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"> <tr> <td class="content-block powered-by" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; color: #999999; text-align: center;" align="center" valign="top"> Tải Jobo tại <a href="http://joboapp.com/go" style="color: #999999; font-size: 16px !important; text-align: center; text-decoration: none;">ĐÂY</a>. </td> </tr> </table> </div> <!-- END FOOTER --> <!-- END CENTERED WHITE CONTAINER --> </div> </td> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> </td> </tr> </table> </body> </html>';
                                sendNotificationEmail(email, title, emailHtml)

                            }

                        }


                        // update like static
                        setTimeout(function () {
                            updateReActCount(userId);
                            updateReActCount(storeId)
                        }, 100);

                        //done update acitivty
                        activityRef.update({
                            noti: new Date().getTime()
                        })


                    }

                    if (activity.type == 2) {

                        // User like Store
                        var job = "";
                        for (var key in activity.jobUser) {
                            job = job + dataConfig.job[key];
                            console.log(job)
                        }

                        var storeId = activity.storeId;
                        var employerId = activity.employerId;
                        var userId = activity.userId;

                        var user = dataUser[employerId];
                        var lastName = getLastName(user.name || "bạn");

                        var storeName = dataStore[storeId].storeName;
                        var storePhoto = dataStore[storeId].photourl;


                        var content = dataStore[storeId].storeName + " muốn tuyển bạn vào vị trí " + job;


                        //noti in app

                        var notiId = db.ref('notification/' + userId).push().key;
                        db.ref('notification/' + userId + '/' + notiId).update({
                            createdAt: new Date().getTime(),
                            id: notiId,
                            sender: storeId,
                            senderName: storeName,
                            senderPhotourl: storePhoto,
                            text: content,
                            status: 0

                        })

                        // send noti push
                        var toTokenRef = dataToken[userId];
                        if (toTokenRef && toTokenRef.token) {
                            var toToken = toTokenRef.token
                            var title = "Việc tìm người";
                            var body = lastName + " ơi!, " + storeName + " muốn tuyển bạn vào vị trí " + job;
                            var goto = 'employer.activity';
                            sendNotificationToGivenUser(toToken, body, title, goto)


                        } else {
                            // has no token , we send email

                            var email = user.email;
                            if (email) {
                                console.log("email", email);
                                var title = dataStore[storeId].storeName + " muốn tuyển bạn vào vị trí " + job;
                                var preview = content;

                                var emailHtml = '<!DOCTYPE html> <html> <head> <meta name="viewport" content="width=device-width"> <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"> <title>Simple Transactional Email</title> </head> <body class="" style="background-color: #f6f6f6; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; margin: 0; padding: 0;" bgcolor="#f6f6f6"> <style type="text/css"> .btn-primary table td:hover { background-color: #34495e !important; } .btn-primary a:hover { background-color: #34495e !important; border-color: #34495e !important; } ></style> <table border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background-color: #f6f6f6;" bgcolor="#f6f6f6"> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> </td> <td class="container" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; display: block; max-width: 580px; width: 100% !important; margin: 0 auto; padding: 0;" valign="top"> <div class="content" style="box-sizing: border-box; display: block; max-width: 580px; margin: 0 auto; padding: 0;"> <!-- START CENTERED WHITE CONTAINER --> <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0; font-size: 16px !important;">' + preview + '</span> <table class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; border-radius: 0 !important; border-left-width: 0 !important; border-right-width: 0 !important; background-color: #fff;" bgcolor="#fff"> <!-- START MAIN CONTENT AREA --> <tr> <td class="wrapper" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; box-sizing: border-box; padding: 10px;" valign="top"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> Chào ' + lastName + ',</p> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> ' + preview + ', nhấn vào đây để xem chi tiết về công việc và đãi ngộ nhé!</p> <table border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; box-sizing: border-box;"> <tbody> <tr> <td align="left" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; padding-bottom: 15px;" valign="top"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100% !important;"> <tbody> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; border-radius: 5px; text-align: center; background-color: #3498db;" align="center" bgcolor="#3498db" valign="top"><a href="http://joboapp.com/go" target="_blank" style=" background: #1A9CC7; color: #ffffff; /* fallback for old browsers */ background: -webkit-linear-gradient(to left, #1A9CC7, #32C28F); /* Chrome 10-25, Safari 5.1-6 */ background: linear-gradient(to left, #1A9CC7, #32C28F); /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */ ; text-decoration: none; border-radius: 0px; box-sizing: border-box; cursor: pointer; display: inline-block; font-size: 16px !important; font-weight: bold; text-transform: capitalize; width: 100% !important; margin: 0; padding: 12px 25px; border: 0px solid #3498db;">Xem chi tiết!</a></td> </tr> </tbody> </table> </td> </tr> </tbody> </table> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> ' + lastName + ' có thể lướt thêm các công việc đang tuyển xung quanh bạn trên ứng dụng Jobo nữa nhé!. Nếu cần bạn cứ liên hệ mình để được giúp đỡ nha!</p> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> Chúc bạn may mắn.</p> </td> </tr> </table> </td> </tr> <!-- END MAIN CONTENT AREA --> </table> <!-- START FOOTER --> <div class="footer" style="clear: both; padding-top: 10px; text-align: center; width: 100%;" align="center"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"> <tr> <td class="content-block powered-by" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; color: #999999; text-align: center;" align="center" valign="top"> Tải Jobo tại <a href="http://joboapp.com/go" style="color: #999999; font-size: 16px !important; text-align: center; text-decoration: none;">ĐÂY</a>. </td> </tr> </table> </div> <!-- END FOOTER --> <!-- END CENTERED WHITE CONTAINER --> </div> </td> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> </td> </tr> </table> </body> </html>';
                                sendNotificationEmail(email, title, emailHtml)

                            }

                        }


                        // update like static
                        setTimeout(function () {
                            updateReActCount(userId);
                            updateReActCount(storeId)
                        }, 100);


                        //done update acitivty
                        activityRef.update({
                            noti: new Date().getTime()
                        })


                    }

                }
            }
        );
    console.log('New star notifier started...');
    console.log('Likes count updater started...');

    //match
    db.ref('/activity/like').on('child_changed', function (postSnapshot) {
        var activityChange = postSnapshot.val();
    })
}

function getPaginatedItems(items, page) {
    var page = page || 1,
        per_page = 5,
        offset = (page - 1) * per_page,
        paginatedItems = _.rest(items, offset).slice(0, per_page);
    return {
        page: page,
        per_page: per_page,
        total: items.length,
        total_pages: Math.ceil(items.length / per_page),
        data: paginatedItems
    };
}

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


function getLastName(fullname) {
    var str = fullname;
    var LastName;
    var res = str.split(" ");
    var resNumber = res.length;
    if (resNumber == 2) {
        LastName = res[1]
    }
    if (resNumber == 3) {
        LastName = res[2]
    }
    if (resNumber == 4) {
        LastName = res[2].concat(res[3])
    }
    if (resNumber == 5) {
        LastName = res[3].concat(res[4])
    }

    return LastName

}

function addCountJob(storeId, userId, job) {
    var jobData = dataJob[storeId]
    for (var key in job) {
        var jobdetail = jobData[key]
        if (!jobdetail.apply) {
            jobdetail.apply = {}
        }
        jobdetail.apply[userId] = true
    }
    console.log(JSON.stringify(jobData))
}


var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies

// routes will go here


app.get('/api/places', function (req, res) {
    var query = req.param('query')
    var type = req.param('type')

    var url = 'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + query + '&language=vi&type=' + type + '&components=country:vi&sensor=true&key=' + CONFIG.APIKey;

    https.get(url, function (response) {
        var body = '';
        response.on('data', function (chunk) {
            body += chunk;
        });

        response.on('end', function () {
            var places = JSON.parse(body);

            res.json(places.results);
        });
    }).on('error', function (e) {
        console.log("Got error: " + e.message);
    });
});

// ====================================
// URL PARAMETERS =====================
// ====================================
// http://localhost:8080/api/users?userid=-KdqGLHwx-9jztJ9W1QS&job=thungan&time=weekday&distance=40&onlydistance=false
app.get('/api/users', function (req, res) {
    var userid = req.param('userid')
    var jobfilter = req.param('job');
    var timefilter = req.param('time');
    var distancefilter = req.param('distance');
    var sexfilter = req.param('sex');
    var expfilter = req.param('exp');
    var figurefilter = req.param('figure');


    var storeData = dataStore[userid];
    var mylat = storeData.location.lat;
    var mylng = storeData.location.lng;
    console.log('mylocal:', mylat, mylng)
    var usercard = [];
    for (var i in dataProfile) {
        var card = dataProfile[i];
        if (card.location) {
            var yourlat = card.location.lat;
            var yourlng = card.location.lng;
            var distance = getDistanceFromLatLonInKm(mylat, mylng, yourlat, yourlng);
            var keyAct = userid + ":" + card.userid;
            console.log('keyAct:', keyAct, distance, distancefilter, likeActivity);

            if (((likeActivity[keyAct] && likeActivity[keyAct].type == 2 && likeActivity[keyAct].status == 0) || !likeActivity[keyAct]) && (distance < distancefilter || !distancefilter ) && ((card.shift && card.shift[timefilter]) || !timefilter ) && ((card.job && card.job[jobfilter]) || !jobfilter ) && (card.sex = sexfilter || !sexfilter) && (card.experience || !expfilter) && (card.figure || !figurefilter)) {
                if (likeActivity[keyAct]) {
                    card.likeMe = true

                }
                console.log('push');
                card.name = dataUser[card.userid].name;
                card.photourl = dataUser[card.userid].photourl;
                card.distance = distance
                usercard.push(card)
            }

        }

    }

    res.send(usercard)

});


// http://localhost:8080/api/employer?userid=2Ex94dTG7ffOJTIuadP5Ko4XBtd2&job=thungan&distance=40
app.get('/api/employer', function (req, res) {
    var userid = req.param('userid')
    var jobfilter = req.param('job');
    var industryfilter = req.param('industry');
    var distancefilter = req.param('distance');
    var page = req.param('p');


    var userData = dataProfile[userid];
    var mylat = userData.location.lat;
    var mylng = userData.location.lng;

    var usercard = []

    for (var i in dataStore) {
        var card = dataStore[i]
        var yourlat = card.location.lat;
        var yourlng = card.location.lng;
        var distance = getDistanceFromLatLonInKm(mylat, mylng, yourlat, yourlng);
        var keyAct = card.storeId + ":" + userid;
        console.log('keyAct:', keyAct, distance, distancefilter, likeActivity);

        if (
            ((likeActivity[keyAct] && likeActivity[keyAct].type == 1 && likeActivity[keyAct].status == 0) || !likeActivity[keyAct])
            && (distance < distancefilter || !distancefilter )
            && ((card.job && card.job[jobfilter]) || !jobfilter )
            && ((card.industry && card.industry[industryfilter]) || !industryfilter )
        ) {

            if (likeActivity[keyAct]) {
                card.likeMe = true

            }
            card.distance = distance

            console.log('push');

            usercard.push(card)
        }
    }

    return new Promise(function (resolve, reject) {
        resolve(usercard)
    }).then(function (usercard) {
            var sendData = _.shuffle(usercard);
            res.json(sendData)
        }
    )
});


// get react http://localhost:8080/api/employer/react?id=-KdPB0ie6zIADq4RkwKV

app.get('/api/employer/react', function (req, res) {
    var id = req.param('id');

    //like
    var like = [];
    var filterLike = _.where(likeActivity, {storeId: id, type: 1, status: 0});
    console.log(filterLike);
    if (filterLike) {
        for (var i in filterLike) {
            var card = dataUser[filterLike[i].userId];
            console.log(card);

            var dataReact = {
                name: card.name,
                userid: card.userid,
                photourl: card.photourl,
                likeAt: filterLike[i].createdAt,
                jobStore: filterLike[i].jobStore
            };
            like.push(dataReact)
        }
    }

//liked
    var liked = [];
    var filterLiked = _.where(likeActivity, {storeId: id, type: 2, status: 0});
    console.log(filterLiked);
    if (filterLiked) {
        for (var i in filterLiked) {
            var card = dataUser[filterLiked[i].userId];
            console.log(card);

            var dataReact = {
                name: card.name,
                userid: card.userid,
                photourl: card.photourl,

                likeAt: filterLiked[i].createdAt,
                jobUser: filterLiked[i].jobUser
            };
            liked.push(dataReact)

        }
    }


    //match
    var match = [];
    var filterMatch = _.where(likeActivity, {storeId: id, status: 1});
    console.log(filterMatch);
    if (filterMatch) {
        for (var i in filterMatch) {
            var card = dataUser[filterMatch[i].userId];
            console.log(card);

            var dataReact = {
                type: filterMatch[i].type,
                name: card.name,
                userid: card.userid,
                photourl: card.photourl,

                likeAt: filterMatch[i].createdAt,
                jobUser: filterMatch[i].jobUser,
                jobStore: filterMatch[i].jobStore,
                matchedAt: filterMatch[i].matchedAt
            };
            match.push(dataReact)
        }
    }

    var data = {
        like: like,
        liked: liked,
        match: match

    }
    var sending = JSON.stringify(data);
    res.send(sending)

})


// http://localhost:8080/api/profile?id=-KdPB0ie6zIADq4RkwKV

app.get('/api/profile', function (req, res) {
    var userid = req.param('id');
    var infoUserData = dataUser[userid];
    var profileData = dataProfile[userid];
    console.log(infoUserData, profileData)

    var userData = Object.assign(infoUserData, profileData);
    res.send(userData);

});

// ====================================
// POST PARAMETERS ====================
// ====================================

// POST http://localhost:8080/api/users
// parameters sent with 
// app.post('/api/users', function (req, res) {
//     var user_id = req.body.id;
//     var token = req.body.token;
//     var geo = req.body.geo;
//
//     res.send(user_id + ' ' + token + ' ' + geo);
// });

app.get('/', function (req, res) {


    res.send('Admin Homepage');
});

app.get('/api/uploads', multipart(), function (req, res) {
    var file = req.files.file;
    console.log(req.body, req.files);

    res.send(file)

});


/**
 * Create file upload



 // Service


 /**
 * Update the star count.
 */
// [START post_stars_transaction]
function updateReActCount(userId) {
    var reActRef = db.ref('static/' + userId);

    var filterLiked = _.where(likeActivity, {storeId: userId, status: 0});
    var LikedCount = filterLiked.length;
    var filterLike = _.where(likeActivity, {like: userId, status: 0});
    var LikeCount = filterLike.length;
    var filterMatched = _.where(likeActivity, {liked: userId, status: 1});
    var MatchedCount = filterMatched.length;
    var filterMatch = _.where(likeActivity, {like: userId, status: 1});
    var MatchCount = filterMatch.length;
    var filterChated = _.where(likeActivity, {liked: userId, status: 2});
    var ChatedCount = filterChated.length;
    var filterChat = _.where(likeActivity, {like: userId, status: 2});
    var ChatCount = filterChat.length;

    console.log(filterLiked, LikedCount, filterLike, LikeCount);

    var post = {
        LikedCount: LikedCount,
        LikeCount: LikeCount,
        MatchedCount: MatchedCount,
        MatchCount: MatchCount,
        ChatedCount: ChatedCount,
        ChatCount: ChatCount

    }
    reActRef.update(post)


}

// [END post_stars_transaction]

/**
 * Send the new star notification push to the given email.
 */

function sendNotificationToGivenUser(toToken, body, title, goto) {

    http({
        method: "POST",
        dataType: 'jsonp',
        headers: {'Content-Type': 'application/json', 'Authorization': 'key=' + CONFIG.FCM_KEY},
        url: "https://fcm.googleapis.com/fcm/send",
        data: JSON.stringify(
            {
                "notification": {
                    "title": title || 'Thông báo mới',  //Any value
                    "body": body || 'Bạn có một thông báo mới',  //Any value
                    "sound": "default", //If you want notification sound
                    "click_action": "FCM_PLUGIN_ACTIVITY",  //Must be present for Android
                    "icon": "fcm_push_icon"  //White icon Android resource
                },
                "data": {
                    "body": body || 'Bạn có một thông báo mới',  //Any value
                    "goto": goto

                },
                "to": toToken, //Topic or single device
                "priority": "high", //If not set, notification won't be delivered on completely closed iOS app
                "restricted_package_name": "" //Optional. Set for application filtering
            }
        )
    }).success(function (data) {
        console.log("Success: " + JSON.stringify(data));
    }).error(function (data) {
        console.log("Error: " + JSON.stringify(data));
    });

}


/**
 * Send the new star notification email to the given email.
 */
function sendNotificationEmail(email, subject, bodyHtml) {
    var mailOptions = {
            from: {
                name: 'Jobo - Ứng dụng tìm việc nhanh',
                address: 'contact@joboapp.com'
            },
            to: email,
            subject: subject,
            html: bodyHtml
        }
        ;
    return mailTransport.sendMail(mailOptions).then(function () {
        console.log('New star email notification sent to: ' + email);
    });
}


//
// function sendemailNotiNewStoretoUser() {
//
//     var mylat = 21.0200221;
//     var mylng = 105.8268501;
//     console.log('mylocal:', mylat, mylng)
//     var usercard = [];
//
//     for (var i in dataUser.jobber) {
//         var card = dataUser.jobber[i];
//         var yourlat = card.location.lat;
//         var yourlng = card.location.lng;
//         var distance = getDistanceFromLatLonInKm(mylat, mylng, yourlat, yourlng);
//
//         if (distance < 6) {
//             console.log('push');
//             card.name = dataUser[card.userid].name;
//             card.photourl = dataUser[card.userid].photourl;
//             console.log(card.email)
//             usercard.push(card)
//         }
//
//     }
//
//
// }
// sendNotificationEmail(email, subject, bodyHtml)


/**
 * Send an email listing the top posts every Sunday.
 */

// start the server
init();
app.listen(port);
console.log('Server started! At http://localhost:' + port);