const dumps = require('./handlers/heap-dump');
const socket = require("./servers/websocket");
const health = require("./utils/health");
const assert = require('assert').strict;
const handlers = require("./handlers/sockets-list");

// Environment variables
const heapdump = process.env.heapdump === "1";
const HOST = process.env.LISTEN_HOST || '0.0.0.0';
const PORT = process.env.LISTEN_PORT || 9001;
assert.ok(process.env.ASSIST_KEY, 'The "ASSIST_KEY" environment variable is required');
const P_KEY = process.env.ASSIST_KEY;
const PREFIX = process.env.PREFIX || process.env.prefix || `/assist`;

const {app, server} = require('./servers/httpserver');

const healthFn = (res, req) => {
    res.statusCode = 200;
    res.end("ok!");
}

// Set health check endpoint
app.get(['/', PREFIX, `${PREFIX}/`, `${PREFIX}/${P_KEY}`, `${PREFIX}/${P_KEY}/`], healthFn);

// Set heap dump endpoint (optional)
if (heapdump) {
    console.log(`HeapSnapshot enabled. Send a request to "/heapdump/new" to generate a heapdump.`);
    app.use(`${PREFIX}/${P_KEY}/heapdump`, dumps.router);
}

// Set main endpoint (API)
app.use(`${PREFIX}/${P_KEY}`, handlers.router);

const {io} = require('./servers/ioserver');

// Set websocket handlers
socket.setHandlers(io);

// Start HTTP server
server.listen(PORT, HOST, () => {
    console.log(`WS App listening on http://${HOST}:${PORT}`);
});

// Start health check server
health.launch(HOST);