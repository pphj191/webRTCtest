const express = require('express');
const app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http); 
app.use(express.static('public'));

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
    password: 'a2022',
    database: 'webrtc_db'
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


// (EunDong) 2021.12.25  
// (EunDong) ADD: Login Page  
app.post('/auth/login', function(req, res){
    var uname = req.body.username;
    var pwd = req.body.password;
    var sql = 'SELECT telno, pwd FROM userprofile WHERE telno = ?'
    conn.query(sql, uname, function(err, results){
        if(err){
            // DB query error 발생시...
            console.log('ED: DB Query Error!')
        }
        var user = results[0];
        if (user){
            // DB에 가입자가 있으면 password 비교후 맞으면 통화연결화면
            if(pwd === user.pwd){
                req.session.displayName = user.telno;
                console.log("ED: req.session.displayName =", req.session.displayName);
                res.redirect('/');
            } else {
                res.send('User Password incorrect! <p><a href="/auth/login">Login</a></p>')    
            }           
        } else {
            // DB에 없는 가입자면 가입자 등록 url 링크 표시
            res.send('User Not Found <p><a href="/auth/login">Login</a></p>')
        }
    });
});

app.get('/auth/login',function(req, res){
    var output = `
    <h1> Login </h1>
    <form action="/auth/login" method="post">
        <p><input type="text" name="username" placeholder="username"></p>
        <p><input type="password" name="password" placeholder="password"></p>
        <p><input type="submit"></p>
    </form>
    `;
    res.send(output);
});

app.post('/auth/register',function(req, res){
    var user = {
        telno: req.body.username,
        pwd: req.body.password
    };
    var sql = 'SELECT telno FROM userprofile WHERE telno = ?'
    conn.query(sql, req.body.username, function(err, results){
        if(err){
            console.log('ED: Exist User DB user Query error!')
        }
        if(results[0]){
            // 이미 있는 가입자 번호
            res.send('Already exist Telno! <p><a href="/auth/register">Register</a></p>') 
        } else {
            var sql = 'INSERT INTO userprofile SET ?'
            conn.query(sql, user, function(err, results){
                if(err){
                    console.log('ED: New User DB Insert Error!')
                } else {
                    res.redirect('/auth/login')
                }
            });
        }
    });
});

app.get('/auth/register',function(req, res){
    var output = `
    <h1> Register </h1>
    <form action="/auth/register" method="post">
        <p><input type="text" name="username" placeholder="username"></p>
        <p><input type="password" name="password" placeholder="password"></p>
        <p><input type="submit"></p>
    </form>
    `;
    res.send(output);
});

app.get('/auth/logout', function(req, res){
    res.send(`
    <h2> ${req.session.displayName}</h2>
    <p><a href="/auth/login">Login</a></p>`);
});

app.get('/', function(req, res){
    res.render('index', {telno: req.session.displayName});
});
// (EunDong) END: Login Page  


http.listen(3000, function () {
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
