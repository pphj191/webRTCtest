const express = require('express');
const fs = require('fs');
const app = express();
const apphttp = express();

app.use(express.static('public'));

const options = { key: fs.readFileSync('./privkey.pem'), cert: fs.readFileSync('./public.pem') };
var https = require('https').Server(options, app);
var http = require('http').Server(app); 
var io = require('socket.io')(https);

apphttp.get('/', (req,res)=>{
    // console.log(req.hostname, "==",req.url)
    res.redirect('https://' + req.hostname + req.url);
});

// (EunDong) 2021.12.25  
// (EunDong) ADD: body-parser , mysql , express-session 
app.set('views', './views');
//app.set('view engine', 'ejs');
//app.engine('html', require('ejs').renderFile);
app.set('view engine', 'pug');
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

  // sessiong 정보를 DB로 관리
var session = require('express-session');
app.use(session({
    secret: 'asdfqr324113sd',
    resave: false,
    saveUninitialized: true
}));
 
var mysql = require('mysql');
var conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'webRTC'
});

conn.connect();
// (EunDong) END: body-parser , mysql , express-session 

//DB 질의로 변경하기
// let user1_phone_number = null;
// let user2_phone_number = null;
// let user1_socket_id = null;
// let user2_socket_id = null;

io.on('connection', function (socket) {  

    socket.on('create', function (callback) {
        console.log('caller at', socket.id);
        callback(socket.id); 
    });

    //////추가
    socket.on('save_number', function (phone_number) { 
        console.log('caller phone number:', phone_number);
        // if(user1_phone_number==null) {
        //     user1_phone_number = phone_number;
        //     user1_socket_id = socket.id;
        // }else{
        //     user2_phone_number = phone_number;
        //     user2_socket_id = socket.id;
        // }
        // console.log('result--> user1 number and socket id: ', user1_phone_number, user1_socket_id);
        // console.log('result--> user2 number and socket id: ', user2_phone_number, user2_socket_id);
        
        // (EunDong) 2021.12.31
        // (EunDong) 가입자 번호별 socket.id를 DB로 관리하는 로직
        var user ={
            telno: phone_number,
            socket_id: socket.id,
            status: '0'
        };
        
        var sql = 'SELECT telno FROM call_status WHERE telno = ?';
        conn.query(sql, phone_number, function(err,results){
            console.log("ED: select(exist call_status?) : ", phone_number);
            if(results[0]) {
                // call_status에 이미 존재하는 번호면...
                console.log("ED: delete call_status : ", phone_number);
                var sql = 'DELETE FROM call_status WHERE telno = ?';
                conn.query(sql, phone_number, function(err, results){
                    if(err){
                        console.log("ED: DB DELETE fail : ", phone_number);
                    } else {
                        var sql = 'INSERT INTO call_status SET ?'
                        conn.query(sql, user, function(err, results){
                            if(!err) {
                                console.log("ED: DB INSERT call_status Success: ", phone_number);
                            }
                        });
                    }
                });
            } else { 
                // call_Status 테이블에 없는 번호면 신규 insert
                var sql = 'INSERT INTO call_status SET ?'
                conn.query(sql, user, function(err, results){
                    if(!err) {
                        console.log("ED: DB INSERT call_status Success: ", phone_number);
                    }
                }); 
            }        
        });
        // (EunDong) END: socket.id DB management 
    }); 

    ////추가
    socket.on('what is socket id', function (friend_number) { 
        // if(friend_number == user1_phone_number){
        //     friend_socket_id = user1_socket_id;
        // }else{
        //     friend_socket_id = user2_socket_id;
        // }
        // io.to(socket.id).emit('tellyou', friend_socket_id);

        // (EunDong) 2022.01.01
        // (EunDong) 입력한 상대방 번호의 socket.id를 DB에서 조회하는 로직
        var friend_socket_id = null;
        console.log('ED: what is socket id? start!'); 
        var sql = 'SELECT socket_id FROM call_status WHERE telno = ?';
        conn.query(sql, friend_number, function(err, results){
            if(err) {
                console.log('ED: friend_number find socket.id query fail');  
            } else {
                //if(results[0].socket_id) {
                if(results.length === 1 ) {
                    friend_socket_id = results[0].socket_id;
                    console.log('ED tellyou socket.id : ', friend_socket_id);
                    io.to(socket.id).emit('tellyou', friend_socket_id);
                } else {
                    console.log('ED: There is no Socket.id : ', friend_number);
                }
            }
        });
        // (EunDong) END: socket.id DB management   
    }); 
    //////////

    // socket.on('join', function (code) {
    //     console.log('receiver joined', socket.id, 'sending join status to', code);
    //     io.to(code).emit('ready', socket.id); 
    // }); 

    // (EunDong) 2022.01.02  
    // (EunDong) ADD: Update call_status DB, connected_telno & is_caller 
    socket.on('join', function (friend_data) { 
        console.log('RECEIVER telno : ', friend_data.telno, ', RECEIVER socket_id: ', friend_data.socket_id);
        sql = 'SELECT telno FROM call_status WHERE socket_id = ?'
        conn.query(sql, socket.id, function(err, results){
            // 발신자의 소켓ID로 발신자의 전화번호를 찾는다. 
            if(results.length === 1){
                // 발신자의 call_status를 update 한다.
                sql_sender = 'UPDATE call_status SET status="1", connected_telno=?, is_caller="1" WHERE telno=?';
                conn.query(sql_sender, [friend_data.telno, results[0].telno], function(err, results){
                    if(err){
                        console.log('ED: SENDER call_status update error')
                    }
                });

                // 착신자의 call_status를 update 한다.
                sql_receiver = 'UPDATE call_status SET status="1", connected_telno=?, is_caller="0" WHERE telno=?';
                conn.query(sql_receiver, [results[0].telno, friend_data.telno], function(err, results){
                    if(err){
                        console.log('ED: RECEIVER call_status update error')
                    }
                });
            } else {
                console.log('ED: call_status update error')
            }
        });
        io.to(friend_data.socket_id).emit('ready', socket.id); 
    });    
    // (EunDong) END: Update call_status DB, connected_telno & is_caller                                    

    socket.on('candidate', function (event) {
        console.log('sending candiadte to', event.sendTo);
        io.to(event.sendTo).emit('candidate', event);
    });

    socket.on('offer', function (event) { 
        console.log('sending offer to', event.receiver);
        io.to(event.receiver).emit('offer', { event: event.sdp, caller: socket.id }); 
    });

    socket.on('answer', function (event) {
        console.log('sending answer to', event.caller);
        io.to(event.caller).emit('answer', event.sdp);
    });

});

var router_auth = require('./router/auth'); // router import_phj
app.use('/auth',router_auth);               // router로 내용을 이동 정리_phj

app.get('/', function(req, res){
    if (req.session.displayName == undefined){  // session 정보 없으면 redirect_phj
        res.redirect('auth/login/')
    }
    else{
        res.render('index', {telno: req.session.displayName});
    }
});
// (EunDong) END: Login Page  


https.listen(443, function () {
    console.log('listening on *:3000');

    // (EunDong) 2022.01.02  
    // (EunDong) ADD: Server Start Call_status DB initialization 
    var sql = 'DELETE FROM call_status';
    conn.query(sql, function(err, results){
        if(err){
            console.log("ED: All call_status DB DELETE fail");
        } else {
            console.log("ED: ALL call_status delete"); 
        }
    });
    // (EunDong) END: Login Page
});

apphttp.listen(80, function () {
    console.log('listening on *:80');
});