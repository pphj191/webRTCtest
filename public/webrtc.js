let socket = io();

let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let audio = document.getElementById("audio");
let video = document.getElementById("video");

let localStream;
let remoteStream;
let rtcPeerConnection;
let iceServers = {
    'iceServers': [{
        'url': 'stun:stun.services.mozilla.com'
    },
    {
        'url': 'stun:stun.l.google.com:19302'
    }
    ]
}

const streamConstraints = {
    video: false,
    // {
    //     width: {
    //         min: '640',
    //         max: '640'
    //     },
    //     height: {
    //         min: '480',
    //         max: '480'
    //     }
    // },
    audio: true,
};

let isCaller = false;

let caller = null;
let receiver = null;

$(document).ready(function () {
    showHome();
    $('#startBtn').click(function () {
        socket.emit('create', function (res) {
            console.log('send create');
            window.navigator.vibrate([200, 100, 200]);
            $('#caller_number').val();
            caller = res;
            showCreate();
            // UIkit.tooltip('#caller_code').show();
            navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
                
                addLocalStream(stream);
                isCaller = true;
                
            }).catch(function (err) {
                socket.emit('err', err);
                console.log('An error ocurred when accessing media devices', err);
            });
            
        });
    });

    $('#joinBtn').click(function () {
        showJoin();
        UIkit.tooltip('#caller_code').show();
    });

    //---------------------------------------------------------------------------------------
    //---------------------------------------------------------------------------------------
    //---------------------------------------------------------------------------------------
    for(i=1;i<10;i++){
        $('#btn_'+String(i)).click(function () {
            console.log($(this).text());
            // console.log(i);
            document.getElementById("caller_number").value=$('#caller_number').val()+$(this).text();
        });
    }
    // $('#btn_1').click(function () {
    //     document.getElementById("caller_number").value=$('#caller_number').val()+'1';
    // });
    // $('#btn_2').click(function () {
    //     document.getElementById("caller_number").value=$('#caller_number').val()+'1';
    // });

    $('#startCallBtn').click(function () {
        showCallScreen();
        const number = $('#caller_number').val();
        socket.emit('number', number);
    });

    socket.on('ready', function (code) {
        console.log('receiver ready at', code);
        receiver = code;
        createPeerConnection();
        let offerOptions = {
            offerToReceiveAudio: 1
        }
        rtcPeerConnection.createOffer(offerOptions)
            .then(desc => setLocalAndOffer(desc))
            .catch(e => console.log(e));
    });

    //---------------------------------------------------------------------------------------
    //---------------------------------------------------------------------------------------
    //---------------------------------------------------------------------------------------

    $('#joinCallBtn').click(function () {
        showCallScreen();
        const code = $('#join_code').val();
        navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
            addLocalStream(stream);
            socket.emit('join', code);
        }).catch(function (err) {
            console.log('An error ocurred when accessing media devices', err);
        });
    });
});

function showHome() {
    $('#home').show();
    $('#create').hide();
    $('#join').hide();
    $('#call').hide();
}

function showCreate() {
    $('#home').hide();
    $('#create').show();
    $('#join').hide();
    $('#call').hide();
}

function showJoin() {
    $('#home').hide();
    $('#create').hide();
    $('#join').show();
    $('#call').hide();
}

function showCallScreen() {
    $('#home').hide();
    $('#create').hide();
    $('#join').hide();
    $('#call').show();
}

socket.on('candidate', function (event) {
    var candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate
    });
    rtcPeerConnection.addIceCandidate(candidate);
});

socket.on('offer', function (param) {
    caller = param.caller;
    createPeerConnection();
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(param.event));
    rtcPeerConnection.createAnswer()
        .then(desc => setLocalAndAnswer(desc))
        .catch(e => console.log(e));
});

socket.on('answer', function (event) {
    console.log(event);
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
})

function onIceCandidate(event) {
    let id = isCaller ? receiver : caller;
    if (event.candidate) {
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            sendTo: id
        })
    }
}

function onAddStream(event) {
    remoteVideo.srcObject = event.stream;
    remoteStream = event.stream;
}

function setLocalAndOffer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    console.log('sending offer to', receiver);
    socket.emit('offer', {
        type: 'offer',
        sdp: sessionDescription,
        receiver: receiver
    });
}

function setLocalAndAnswer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    console.log('sending answer to ', caller);
    socket.emit('answer', {
        type: 'answer',
        sdp: sessionDescription,
        caller: caller
    });
}

function addLocalStream(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
}

function createPeerConnection() {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    rtcPeerConnection.onicecandidate = onIceCandidate;
    rtcPeerConnection.onaddstream = onAddStream;
    rtcPeerConnection.addStream(localStream);
}