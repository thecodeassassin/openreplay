const {
    extractRoomId,
    extractPeerId,
} = require('../utils/helper');
const {
    getAvailableRooms
} = require('../utils/helper');
const {
    EVENTS_DEFINITION,
    extractSessionInfo,
    socketConnexionTimeout,
    errorHandler,
    authorizer
} = require('../utils/assistHelper');
const {isSession, isAgent} = require("../utils/assistHelper");

const debug = process.env.debug === "1";

const findSessionSocketId = async (io, roomId, tabId) => {
    let pickFirstSession = tabId === undefined;
    const connected_sockets = await io.in(roomId).fetchSockets();
    for (let item of connected_sockets) {
        if (isSession(item.handshake.query.identity)) {
            if (pickFirstSession) {
                return item.id;
            } else if (item.tabId === tabId) {
                return item.id;
            }
        }
    }
    return null;
};

async function sessions_agents_count(io, socket) {
    let c_sessions = 0, c_agents = 0;
    const rooms = await getAvailableRooms(io);
    if (rooms.has(socket.roomId)) {
        const connected_sockets = await io.in(socket.roomId).fetchSockets();

        for (let item of connected_sockets) {
            if (isSession(item.handshake.query.identity)) {
                c_sessions++;
            } else {
                c_agents++;
            }
        }
    } else {
        c_agents = -1;
        c_sessions = -1;
    }
    return {c_sessions, c_agents};
}

async function get_all_agents_ids(io, socket) {
    let agents = [];
    const rooms = await getAvailableRooms(io);
    if (rooms.has(socket.roomId)) {
        const connected_sockets = await io.in(socket.roomId).fetchSockets();
        for (let item of connected_sockets) {
            if (isSession(item.handshake.query.identity)) {
                agents.push(item.id);
            }
        }
    }
    return agents;
}

async function onConnect(socket) {

}

module.exports = {
    setHandlers: (io) => {
        io.use(async (socket, next) => await authorizer.check(socket, next));
        io.on('connection', async (socket) => {
            socket.on(EVENTS_DEFINITION.listen.ERROR, err => errorHandler(EVENTS_DEFINITION.listen.ERROR, err));
            debug && console.log(`WS started:${socket.id}, Query:${JSON.stringify(socket.handshake.query)}`);
            socket._connectedAt = new Date();

            let {projectKey: connProjectKey, sessionId: connSessionId, tabId:connTabId} = extractPeerId(socket.handshake.query.peerId);
            socket.peerId = socket.handshake.query.peerId;
            socket.roomId = extractRoomId(socket.peerId);
            // Set default tabId for back compatibility
            connTabId = connTabId ?? (Math.random() + 1).toString(36).substring(2);
            socket.tabId = connTabId;
            socket.sessId = connSessionId;
            socket.identity = socket.handshake.query.identity;
            debug && console.log(`connProjectKey:${connProjectKey}, connSessionId:${connSessionId}, connTabId:${connTabId}, roomId:${socket.roomId}`);

            let {c_sessions, c_agents} = await sessions_agents_count(io, socket);
            if (isSession(socket.identity)) {
                if (c_sessions > 0) {
                    const rooms = await getAvailableRooms(io);
                    for (let roomId of rooms.keys()) {
                        let {projectKey} = extractPeerId(roomId);
                        if (projectKey === connProjectKey) {
                            const connected_sockets = await io.in(roomId).fetchSockets();
                            for (let item of connected_sockets) {
                                if (item.tabId === connTabId) {
                                    debug && console.log(`session already connected, refusing new connexion`);
                                    io.to(socket.id).emit(EVENTS_DEFINITION.emit.SESSION_ALREADY_CONNECTED);
                                    return socket.disconnect();
                                }
                            }
                        }
                    }
                }
                extractSessionInfo(socket);
                if (c_agents > 0) {
                    debug && console.log(`notifying new session about agent-existence`);
                    let agents_ids = await get_all_agents_ids(io, socket);
                    io.to(socket.id).emit(EVENTS_DEFINITION.emit.AGENTS_CONNECTED, agents_ids);
                    socket.to(socket.roomId).emit(EVENTS_DEFINITION.emit.SESSION_RECONNECTED, socket.id);
                }

            } else if (c_sessions <= 0) {
                debug && console.log(`notifying new agent about no SESSIONS with peerId:${socket.peerId}`);
                io.to(socket.id).emit(EVENTS_DEFINITION.emit.NO_SESSIONS);
            }
            await socket.join(socket.roomId);
            const rooms = await getAvailableRooms(io);
            if (rooms.has(socket.roomId)) {
                debug && console.log(`${socket.id} joined room:${socket.roomId}, as:${socket.identity}, members:${rooms.get(socket.roomId).size}`);
            }
            if (isAgent(socket.identity)) {
                if (socket.handshake.query.agentInfo !== undefined) {
                    socket.handshake.query.agentInfo = JSON.parse(socket.handshake.query.agentInfo);
                    socket.agentID = socket.handshake.query.agentInfo.id;
                    // TODO: debug log
                    console.log(`agentID:${socket.agentID}, agentName:${socket.handshake.query.agentInfo.name}`)
                }
                socket.to(socket.roomId).emit(EVENTS_DEFINITION.emit.NEW_AGENT, socket.id, socket.handshake.query.agentInfo);
            }

            socket.on('disconnect', async () => {
                debug && console.log(`${socket.id} disconnected from ${socket.roomId}`);
                if (isAgent(socket.identity)) {
                    socket.to(socket.roomId).emit(EVENTS_DEFINITION.emit.AGENT_DISCONNECT, socket.id);
                }
                debug && console.log("checking for number of connected agents and sessions");
                let {c_sessions, c_agents} = await sessions_agents_count(io, socket);
                if (c_sessions === -1 && c_agents === -1) {
                    debug && console.log(`room not found: ${socket.roomId}`);
                }
                if (c_sessions === 0) {
                    debug && console.log(`notifying everyone in ${socket.roomId} about no SESSIONS`);
                    socket.to(socket.roomId).emit(EVENTS_DEFINITION.emit.NO_SESSIONS);
                }
                if (c_agents === 0) {
                    debug && console.log(`notifying everyone in ${socket.roomId} about no AGENTS`);
                    socket.to(socket.roomId).emit(EVENTS_DEFINITION.emit.NO_AGENTS);
                }
            });

            socket.on(EVENTS_DEFINITION.listen.UPDATE_EVENT, async (...args) => {
                debug && console.log(`${socket.id} sent update event.`);
                if (!isSession(socket.identity)) {
                    debug && console.log('Ignoring update event.');
                    return
                }
                // Back compatibility (add top layer with meta information)
                if (args[0]?.meta === undefined && isSession(socket.identity)) {
                    args[0] = {meta: {tabId: socket.tabId, version: 1}, data: args[0]};
                }
                Object.assign(socket.handshake.query.sessionInfo, args[0].data, {tabId: args[0]?.meta?.tabId});
                socket.to(socket.roomId).emit(EVENTS_DEFINITION.emit.UPDATE_EVENT, args[0]);
                // Update sessionInfo for all sessions in room
                const rooms = await getAvailableRooms(io);
                for (let roomId of rooms.keys()) {
                    if (roomId === socket.roomId) {
                        const connected_sockets = await io.in(roomId).fetchSockets();
                        for (let item of connected_sockets) {
                            if (isSession(item.handshake.query.identity) && item.handshake.query.sessionInfo) {
                                Object.assign(item.handshake.query.sessionInfo, args[0]?.data, {tabId: args[0]?.meta?.tabId});
                            }
                        }
                    }
                }
            });

            socket.on(EVENTS_DEFINITION.listen.CONNECT_ERROR, err => {
                errorHandler(EVENTS_DEFINITION.listen.CONNECT_ERROR, err)
                // TODO: check if agent was controlling, recording, calling, etc.
            });

            socket.on(EVENTS_DEFINITION.listen.CONNECT_FAILED, err => {
                errorHandler(EVENTS_DEFINITION.listen.CONNECT_FAILED, err)
                // TODO: check if agent was controlling, recording, calling, etc.
            });

            socket.onAny(async (eventName, ...args) => {
                if (Object.values(EVENTS_DEFINITION.listen).indexOf(eventName) >= 0) {
                    debug && console.log(`received event:${eventName}, should be handled by another listener, stopping onAny.`);
                    return
                }
                // Back compatibility (add top layer with meta information)
                if (args[0]?.meta === undefined && isSession(socket.identity)) {
                    args[0] = {meta: {tabId: socket.tabId, version: 1}, data: args[0]};
                }

                if (isSession(socket.identity)) {
                    debug && console.log(`received event:${eventName}, from:${socket.identity}, sending message to room:${socket.roomId}`);
                    socket.to(socket.roomId).emit(eventName, args[0]);
                } else {
                    /*
                    request_control | release_control | control_granted | control_rejected -> request + granted = start, release = end
                    _agent_name | call_end -> agent_name = agent called someone, call_end = call was denied or ended
                    request_recording | stop_recording | recording_accepted | recording_rejected -> request + accepted = started, stop = end

                    s_call_started, s_call_ended
                    s_control_started, s_control_ended
                    s_recording_started, s_recording_ended
                    * */

                    switch (eventName) {
                        case "s_call_started":
                            console.log(`s_call_started, agentID: ${args[0]}, sessID: ${socket.sessId}`);
                            break;
                        case "s_call_ended":
                            console.log(`s_call_ended, agentID: ${args[0]}, sessID: ${socket.sessId}`);
                            break;
                        case "s_control_started":
                            console.log(`s_control_started, agentID: ${args[0]}, sessID: ${socket.sessId}`);
                            break;
                        case "s_control_ended":
                            console.log(`s_control_ended, agentID: ${args[0]}, sessID: ${socket.sessId}`);
                            break;
                        case "s_recording_started":
                            console.log(`s_recording_started, agentID: ${args[0]}, sessID: ${socket.sessId}`);
                            break;
                        case "s_recording_ended":
                            console.log(`s_recording_ended, agentID: ${args[0]}, sessID: ${socket.sessId}`);
                            break;
                    }

                    debug && console.log(`received event:${eventName}, from:${socket.identity}, sending message to session of room:${socket.roomId}`);
                    let socketId = await findSessionSocketId(io, socket.roomId, args[0]?.meta?.tabId);
                    if (socketId === null) {
                        debug && console.log(`session not found for:${socket.roomId}`);
                        io.to(socket.id).emit(EVENTS_DEFINITION.emit.NO_SESSIONS);
                    } else {
                        debug && console.log("message sent");
                        io.to(socketId).emit(eventName, socket.id, args[0]);
                    }
                }
            });
        });
        console.log("WS server started");
        setInterval(async (io) => {
            try {
                let count = 0;
                const rooms = await getAvailableRooms(io);
                console.log(` ====== Rooms: ${rooms.size} ====== `);
                const arr = Array.from(rooms);
                const filtered = arr.filter(room => !room[1].has(room[0]));
                for (let i of filtered) {
                    let {projectKey, sessionId} = extractPeerId(i[0]);
                    if (projectKey !== null && sessionId !== null) {
                        count++;
                    }
                }
                console.log(` ====== Valid Rooms: ${count} ====== `);
                if (debug) {
                    for (let item of filtered) {
                        console.log(`Room: ${item[0]} connected: ${item[1].size}`);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }, 30000, io);

        socketConnexionTimeout(io);
    },
};