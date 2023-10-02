const express = require("express");
const http = require('http');
const {request_logger} = require("../utils/helper");

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(request_logger("[wsapp]"));
app.enable('trust proxy');

const server = http.createServer(app);

module.exports = {
    app,
    server,
};