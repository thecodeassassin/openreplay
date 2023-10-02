const express = require("express");
const {
    extractPayloadFromRequest,
    hasFilters,
    getAvailableRooms,
    extractPeerId,
    extractProjectKeyFromRequest, getValidAttributes, uniqueAutocomplete,
    extractSessionIdFromRequest,
    sortPaginate
} = require("../utils/helper");
const {isValidSession} = require("../utils/session");
const {
    isSession
} = require("../utils/assistHelper");
const router = express.Router();
const io = require("../servers/ioserver").io;

const respond = function (res, data) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({"data": data}));
}

const socketsList = async function (req, res) {
    debug && console.log("[WS]looking for all available sessions");
    let filters = await extractPayloadFromRequest(req, res);
    let withFilters = hasFilters(filters);
    let liveSessionsPerProject = {};
    let rooms = await getAvailableRooms(io);
    for (let roomId of rooms.keys()) {
        let {projectKey, sessionId} = extractPeerId(roomId);
        if (projectKey === undefined) {
            continue
        }
        liveSessionsPerProject[projectKey] = liveSessionsPerProject[projectKey] || new Set();
        if (!withFilters) {
            liveSessionsPerProject[projectKey].add(sessionId);
            continue
        }
        const connected_sockets = await io.in(roomId).fetchSockets();
        for (let item of connected_sockets) {
            if (isValidSession(item.handshake.query, filters.filter)) {
                liveSessionsPerProject[projectKey].add(sessionId);
            }
        }
    }
    let liveSessions = {};
    liveSessionsPerProject.forEach((sessions, projectId) => {
        liveSessions[projectId] = Array.from(sessions);
    });
    respond(res, liveSessions);
}

const autocomplete = async function (req, res) {
    debug && console.log("[WS]autocomplete");
    let _projectKey = extractProjectKeyFromRequest(req);
    let filters = await extractPayloadFromRequest(req);
    let results = [];
    if (filters.query && Object.keys(filters.query).length > 0) {
        let rooms = await getAvailableRooms(io);
        for (let roomId of rooms.keys()) {
            let {projectKey} = extractPeerId(roomId);
            if (projectKey === _projectKey) {
                let connected_sockets = await io.in(roomId).fetchSockets();
                for (let item of connected_sockets) {
                    if (isSession(item.handshake.query.identity) && item.handshake.query.sessionInfo) {
                        results = [...results, ...getValidAttributes(item.handshake.query.sessionInfo, filters.query)];
                    }
                }
            }
        }
    }
    respond(res, uniqueAutocomplete(results));
}

const socketsListByProject = async function (req, res) {
    debug && console.log("[WS]looking for available sessions");
    let _projectKey = extractProjectKeyFromRequest(req);
    let _sessionId = extractSessionIdFromRequest(req);
    let filters = await extractPayloadFromRequest(req, res);
    let withFilters = hasFilters(filters);
    let liveSessions = new Set();
    let rooms = await getAvailableRooms(io);
    for (let roomId of rooms.keys()) {
        let {projectKey, sessionId} = extractPeerId(roomId);
        if (projectKey === _projectKey && (_sessionId === undefined || _sessionId === sessionId)) {
            if (!withFilters) {
                liveSessions.add(sessionId);
                continue
            }
            const connected_sockets = await io.in(roomId).fetchSockets();
            for (let item of connected_sockets) {
                if (isValidSession(item.handshake.query, filters.filter)) {
                    liveSessions.add(sessionId);
                }
            }
        }
    }
    let sessions = Array.from(liveSessions);
    respond(res, _sessionId === undefined ? sortPaginate(sessions, filters)
        : sessions.length > 0 ? sessions[0]
            : null);
}

const socketsLive = async function (req, res) {
    debug && console.log("[WS]looking for all available LIVE sessions");
    let filters = await extractPayloadFromRequest(req, res);
    let withFilters = hasFilters(filters);
    let liveSessionsPerProject = {};
    let rooms = await getAvailableRooms(io);
    for (let roomId of rooms.keys()) {
        let {projectKey} = extractPeerId(roomId);
        if (projectKey === undefined) {
            continue
        }
        let connected_sockets = await io.in(roomId).fetchSockets();
        for (let item of connected_sockets) {
            if (!isSession(item.handshake.query.identity)) {
                continue
            }
            liveSessionsPerProject[projectKey] = liveSessionsPerProject[projectKey] || new Set();
            if (!withFilters) {
                liveSessionsPerProject[projectKey].add(item.handshake.query.sessionInfo);
                continue
            }
            if (isValidSession(item.handshake.query, filters.filter)) {
                liveSessionsPerProject[projectKey].add(item.handshake.query.sessionInfo);
            }
        }
    }
    let liveSessions = {};
    liveSessionsPerProject.forEach((sessions, projectId) => {
        liveSessions[projectId] = Array.from(sessions);
    });
    respond(res, sortPaginate(liveSessions, filters));
}

const socketsLiveByProject = async function (req, res) {
    debug && console.log("[WS]looking for available LIVE sessions");
    let _projectKey = extractProjectKeyFromRequest(req);
    let _sessionId = extractSessionIdFromRequest(req);
    let filters = await extractPayloadFromRequest(req, res);
    let withFilters = hasFilters(filters);
    let liveSessions = new Set();
    const sessIDs = new Set();
    let rooms = await getAvailableRooms(io);
    for (let roomId of rooms.keys()) {
        let {projectKey, sessionId} = extractPeerId(roomId);
        if (projectKey === _projectKey && (_sessionId === undefined || _sessionId === sessionId)) {
            let connected_sockets = await io.in(roomId).fetchSockets();
            for (let item of connected_sockets) {
                if (!isSession(item.handshake.query.identity)) {
                    continue
                }
                if (!withFilters) {
                    if (!sessIDs.has(item.handshake.query.sessionInfo.sessionID)) {
                        liveSessions.add(item.handshake.query.sessionInfo);
                        sessIDs.add(item.handshake.query.sessionInfo.sessionID);
                    }
                }
                if (isValidSession(item.handshake.query.sessionInfo, filters.filter) &&
                    !sessIDs.has(item.handshake.query.sessionInfo.sessionID)) {
                    liveSessions.add(item.handshake.query.sessionInfo);
                    sessIDs.add(item.handshake.query.sessionInfo.sessionID);
                }
            }
        }
    }
    let sessions = Array.from(liveSessions);
    respond(res, _sessionId === undefined ? sortPaginate(sessions, filters) : sessions.length > 0 ? sessions[0] : null);
}

router.get(`/sockets-list`, socketsList);
router.post(`/sockets-list`, socketsList);
router.get(`/sockets-list/:projectKey/autocomplete`, autocomplete);
router.get(`/sockets-list/:projectKey`, socketsListByProject);
router.post(`/sockets-list/:projectKey`, socketsListByProject);
router.get(`/sockets-list/:projectKey/:sessionId`, socketsListByProject);

router.get(`/sockets-live`, socketsLive);
router.post(`/sockets-live`, socketsLive);
router.get(`/sockets-live/:projectKey/autocomplete`, autocomplete);
router.get(`/sockets-live/:projectKey`, socketsLiveByProject);
router.post(`/sockets-live/:projectKey`, socketsLiveByProject);
router.get(`/sockets-live/:projectKey/:sessionId`, socketsLiveByProject);

module.exports = {router};