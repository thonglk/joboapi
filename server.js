// grab the packages we need
var firebase = require('firebase-admin');
// [END imports]
var nodemailer = require('nodemailer');
var ses = require('nodemailer-ses-transport');
var schedule = require('node-schedule');
var Promise = require('promise');
var escape = require('escape-html');
var _ = require("underscore");


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

var express = require('express');
var app = express();
var port = process.env.PORT || 8080;

var admin = require("firebase-admin");


admin.initializeApp({
    credential: admin.credential.cert('adminsdk.json'),
    databaseURL: "https://jobfast-359da.firebaseio.com"
});

var firstListen;
function init() {


    var dataAll = {};
    var db = admin.database();
    var ref = db.ref();
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
        }
    })
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
    var LastName;
    var str = fullname;
    var res = str.split(" ");
    var LastName = res[2]

    delete res[0];
    delete res[1];
    if (res[3]) {
        var resThree = " " + res[3]
        var resThreeAfter = res[2].concat(resThree)
        LastName = resThreeAfter
        console.log(LastName)
    }
    if (res[4]) {
        var resFour = " " + res[4]
        var resFourAfter = resThreeAfter.concat(resFour)
        LastName = resFourAfter
        console.log(LastName)
    }
    return LastName

}


var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({extended: true})); // support encoded bodies

// routes will go here

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
        var yourlat = card.location.lat;
        var yourlng = card.location.lng;
        var distance = getDistanceFromLatLonInKm(mylat, mylng, yourlat, yourlng);
        var keyAct = userid + ":" + card.userid;
        console.log('keyAct:', keyAct, distance, distancefilter, likeActivity);

        if (((likeActivity[keyAct] && likeActivity[keyAct].type == 2 && likeActivity[keyAct].status == 0) || !likeActivity[keyAct]) && (distance < distancefilter || !distancefilter ) && ((card.shift && card.shift[timefilter]) || !timefilter ) && ((card.job && card.job[jobfilter]) || !jobfilter ) && (card.sex = sexfilter || !sexfilter) && (card.experience || !expfilter) && (card.figure || !figurefilter)) {
            if(likeActivity[keyAct]){
                card.likeMe = true

            }
            console.log('push');
            card.name = dataUser[card.userid].name;
            card.photourl = dataUser[card.userid].photourl;

            usercard.push(card)
        }

    }

    res.send(usercard)

});


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

// Service


/**
 * Update the star count.
 */
// [START post_stars_transaction]
function updateReActCount(userId) {
    var reActRef = firebase.database().ref('static/' + userId);

    var filterLiked = _.where(likeActivity, {liked: userId, status: 0});
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

    $http({
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
                    "goto": goto,

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


function startListeners() {
    firebase.database().ref('/activity/like').on('child_added', function (postSnapshot) {


            var activity = postSnapshot.val();
            var activityRef = postSnapshot.ref;
            if (!activity.noti) {
                console.log('child_add', activity)
                var job = "";
                for (var key in activity.job) {
                    job = job + dataConfig.job[key];
                    console.log(job)
                }
                // Start send notification
                if (activity.type == 1) {
                    // Store like user

                    var storeId = activity.like;
                    var userId = activity.liked;

                    var user = dataUser[activity.liked];
                    var lastName = getLastName(user.name);

                    console.log(lastName);

                    // send noti push
                    var toTokenRef = dataToken[activity.liked];
                    if (toTokenRef && toTokenRef.token) {
                        var toToken = toTokenRef.token
                        var title = "Việc tìm người";
                        var body = lastName + " ơi!, " + dataStore[activity.like].storeName + " muốn tuyển bạn vào vị trí " + job;
                        var goto = 'employer.activity';
                        sendNotificationToGivenUser(toToken, body, title, goto)
                    } else {
                        // has no token , we send email

                        var email = user.email;
                        if (email) {
                            console.log("email", email);
                            var title = dataStore[activity.like].storeName + " muốn tuyển bạn vào vị trí " + job;
                            var preview = dataStore[activity.like].storeName + " muốn tuyển bạn vào vị trí " + job;
                            var emailHtml = '<!DOCTYPE html> <html> <head> <meta name="viewport" content="width=device-width"> <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"> <title>Simple Transactional Email</title> </head> <body class="" style="background-color: #f6f6f6; font-family: sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; margin: 0; padding: 0;" bgcolor="#f6f6f6"> <style type="text/css"> .btn-primary table td:hover { background-color: #34495e !important; } .btn-primary a:hover { background-color: #34495e !important; border-color: #34495e !important; } ></style> <table border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; background-color: #f6f6f6;" bgcolor="#f6f6f6"> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> </td> <td class="container" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; display: block; max-width: 580px; width: 100% !important; margin: 0 auto; padding: 0;" valign="top"> <div class="content" style="box-sizing: border-box; display: block; max-width: 580px; margin: 0 auto; padding: 0;"> <!-- START CENTERED WHITE CONTAINER --> <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0; font-size: 16px !important;">' + preview + '</span> <table class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; border-radius: 0 !important; border-left-width: 0 !important; border-right-width: 0 !important; background-color: #fff;" bgcolor="#fff"> <!-- START MAIN CONTENT AREA --> <tr> <td class="wrapper" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; box-sizing: border-box; padding: 10px;" valign="top"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> Chào ' + lastName + ',</p> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> ' + preview + ', nhấn vào đây để xem chi tiết về công việc và đãi ngộ nhé!</p> <table border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%; box-sizing: border-box;"> <tbody> <tr> <td align="left" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; padding-bottom: 15px;" valign="top"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100% !important;"> <tbody> <tr> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; border-radius: 5px; text-align: center; background-color: #3498db;" align="center" bgcolor="#3498db" valign="top"><a href="http://joboapp.com/go" target="_blank" style=" background: #1A9CC7; color: #ffffff; /* fallback for old browsers */ background: -webkit-linear-gradient(to left, #1A9CC7, #32C28F); /* Chrome 10-25, Safari 5.1-6 */ background: linear-gradient(to left, #1A9CC7, #32C28F); /* W3C, IE 10+/ Edge, Firefox 16+, Chrome 26+, Opera 12+, Safari 7+ */ ; text-decoration: none; border-radius: 0px; box-sizing: border-box; cursor: pointer; display: inline-block; font-size: 16px !important; font-weight: bold; text-transform: capitalize; width: 100% !important; margin: 0; padding: 12px 25px; border: 0px solid #3498db;">Xem chi tiết!</a></td> </tr> </tbody> </table> </td> </tr> </tbody> </table> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> ' + lastName + ' có thể lướt thêm các công việc đang tuyển xung quanh bạn trên ứng dụng Jobo nữa nhé!. Nếu cần bạn cứ liên hệ mình để được giúp đỡ nha!</p> <p style="font-family: sans-serif; font-size: 16px !important; font-weight: normal; margin: 0 0 15px;"> Chúc bạn may mắn.</p> </td> </tr> </table> </td> </tr> <!-- END MAIN CONTENT AREA --> </table> <!-- START FOOTER --> <div class="footer" style="clear: both; padding-top: 10px; text-align: center; width: 100%;" align="center"> <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;"> <tr> <td class="content-block powered-by" style="font-family: sans-serif; font-size: 16px !important; vertical-align: top; color: #999999; text-align: center;" align="center" valign="top"> Tải Jobo tại <a href="http://joboapp.com/go" style="color: #999999; font-size: 16px !important; text-align: center; text-decoration: none;">ĐÂY</a>. </td> </tr> </table> </div> <!-- END FOOTER --> <!-- END CENTERED WHITE CONTAINER --> </div> </td> <td style="font-family: sans-serif; font-size: 16px !important; vertical-align: top;" valign="top"> </td> </tr> </table> </body> </html>';
                            sendNotificationEmail(email, title, emailHtml)

                        }

                    }

                    // update like static
                    setTimeout(function () {
                        updateReActCount(userId);
                        updateReActCount(storeId)
                    }, 10);


                    //done update acitivty
                    activityRef.update({
                        noti: new Date().getTime()
                    })


                }

            }
        }


        //     var postReference = postSnapshot.ref;
        // var likedId = postSnapshot.val().liked;
        // var postId = postSnapshot.key;
        // // Update the star count.
        // // [START post_value_event_listener]
        //  postReference.child('stars').on('value', function (dataSnapshot) {
        //  updateStarCount(postReference);
        //  // [START_EXCLUDE]
        //  updateStarCount(firebase.database().ref('user-posts/' + uid + '/' + postId));
        //  // [END_EXCLUDE]
        //  }, function (error) {
        //  console.log('Failed to add "value" listener at /posts/' + postId + '/stars node:', error);
        //  });
        // // [END post_value_event_listener]
        // // Send email to author when a new star is received.
        // // [START child_event_listener_recycler]
        // postReference.child('stars').on('child_added', function (dataSnapshot) {
        //     sendNotificationToUser(uid, postId);
        // }, function (error) {
        //     console.log('Failed to add "child_added" listener at /posts/' + postId + '/stars node:', error);
        // });
        // // [END child_event_listener_recycler]

    );
    console.log('New star notifier started...');
    console.log('Likes count updater started...');

    firebase.database().ref('/activity/like').on('child_changed', function (postSnapshot) {
        var activityChange = postSnapshot.val();

    })
}


/**
 * Send an email listing the top posts every Sunday.
 */

// start the server
init();
app.listen(port);
console.log('Server started! At http://localhost:' + port);