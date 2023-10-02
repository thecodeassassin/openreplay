const _io = require("socket.io");
const {getCompressionConfig} = require("../utils/helper");

let io;

const newSocketIOServer = function (server, prefix) {
    io = _io(server, {
        maxHttpBufferSize: (parseFloat(process.env.maxHttpBufferSize) || 5) * 1e6,
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT"]
        },
        path: (prefix ? prefix : '') + '/socket',
        ...getCompressionConfig()
    });
}

const newUWSServer = function (server, prefix) {
    console.error('uws is not supported');
    process.exit(1);
}

const {server} = require('./httpserver');

// Init websocket server
if (process.env.uws !== "true") {
    newSocketIOServer(server);
} else {
    newUWSServer(server);
}

module.exports = {io};