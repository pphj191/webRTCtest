const express = require('express');
const app = express();
const apphttp = express();
const fs = require('fs');

const options = { key: fs.readFileSync('./privkey.pem'), cert: fs.readFileSync('./public.pem') };

var https = require('https').Server(options, app);
var io = require('socket.io')(https);
var numberDB={}
app.use(express.static('public'));
apphttp.get('/', (req,res)=>{
    // console.log(req.hostname, "==",req.url)
    res.redirect('https://' + req.hostname + req.url);
});

io.on('connection', function (socket) {
    socket.on('create', function (callback) {
        console.log('caller at', socket.id);
        callback(socket.id);
    });

    socket.on('number', function(number){
        console.log('number from', socket.id);
        numberDB[number]=socket.id
    });

    socket.on('join', function (code) {
        console.log('receiver joined', socket.id, 'sending join status to', numberDB[code]);
        io.to(numberDB[code]).emit('ready', socket.id);
    });

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

    socket.on('err', function (event) {
        console.log('collecting erroes = ', event);
        // io.to(event.caller).emit('answer', event.sdp);
    });

});

https.listen(443, function () {
    console.log('listening on *:443');
});
apphttp.listen(80, function () {
    console.log('listening on *:80');
});