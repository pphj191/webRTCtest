var express = require('express');
var router = express.Router();

var mysql = require('mysql');
var conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'webRTC'
});

conn.connect();
// (EunDong) 2021.12.25  
// (EunDong) ADD: Login Page  
router.post('/login', function(req, res){
    var uname = req.body.username;
    var pwd = req.body.password;
    var sql = 'SELECT telno, pwd FROM userprofile WHERE telno = ?'
    conn.query(sql, uname, function(err, results){
        if(err){
            // DB query error 발생시...
            console.log('ED: DB Query Error! : ',err)
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

router.get('/login',function(req, res){
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

router.post('/register',function(req, res){
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

router.get('/register',function(req, res){
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

router.get('/logout', function(req, res){
    res.send(`
    <h2> ${req.session.displayName}</h2>
    <p><a href="/auth/login">Login</a></p>`);
});

module.exports = router;