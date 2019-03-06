/**
 * Simple NodeJS websocket demo
 *
 * https://www.npmjs.com/package/websocket
 *
 * For learning purposes only
 */

"use strict";

const websocket = require("websocket");

let wsServer;

// Maintain a list of connections so we know whom to broadcast to
let connectionList = {};

/**
 * Get the object key for a connection.
 *
 * We want to use the connection as a key to reference into connectionList,
 * but you can't use an object as a key. We make a unique key from the
 * connection remote port and IP.
 *
 * (A connection on the Internet is the unique tuple [localIP, localPort,
 * remoteIP, remotePort], but in this case, local port and IP are always the
 * same, so they're not useful as key information, and we ignore them.)
 */
function getConnectionKey(connection) {
  let socket = connection.socket; // the underlying socket
  return socket.remoteAddress + socket.remotePort;
}

/**
 * Store the user name with the connection
 *
 * Hackish. Since we don't have a "change user name" data packet, and the
 * username is transmitted with each packet, we need to check it every time
 * data arrives to see if it has changed.
 *
 * It would be far more Right to have a specific "set-username" request
 * that the client would fire. That's your homework.
 */
function storeUsername(connection, message) {
  if (message.payload && message.payload.username) {
    let k = getConnectionKey(connection);
    let cleanUsername = message.payload.username.trim();
    connectionList[k].username = cleanUsername;
  }
}

/**
 * Message type handlers
 *
 * For specific message types, do the right thing
 */
let messageHandler = {
  "chat-join": function(msg) {
    const response = {
      type: "chat-join",
      payload: {
        username: msg.payload.username.trim()
      }
    };
    broadcast(response);
  },
  "chat-message": function(msg) {
    let payload = msg.payload;
    let text = payload.message.trim();
    // ignore empty messages
    if (text === "") {
      return;
    }
    // make a new chat message to broadcast to everyone
    let response = {
      type: "chat-message",
      payload: {
        username: payload.username.trim(),
        message: text
      }
    };
    broadcast(response);
  }
};

/**
 * Broadcast a chat message to all connected clients
 *
 * @param response {Object}
 */
function broadcast(response) {
  for (let k in connectionList)
    if (connectionList.hasOwnProperty(k)) {
      let destConnection = connectionList[k].connection;
      destConnection.send(JSON.stringify(response));
    }
}

/**
 * Connection: Handle incoming messages
 *
 * This is the low-level message accepter.
 */
function onMessage(message) {
  message = JSON.parse(message.utf8Data);

  storeUsername(this, message);
  console.log(`Websocket: message: ${this.remoteAddress}:${message.type}`);

  if (message.type in messageHandler) {
    messageHandler[message.type](message, this);
  } else {
    console.log(
      `Websocket: Unknown payload type: ${this.remoteAddress}:${message.type}`
    );
  }
}

/**
 * Connection: Handle close
 */
function onClose(reason, description) {
  const k = getConnectionKey(this);

  // Get the username so we can tell everyone else
  const username = connectionList[k].username;

  delete connectionList[k];

  console.log(
    `Websocket: closed: ${this.remoteAddress}: ${reason}: ${description}`
  );

  // Tell everyone this user has left
  const response = {
    type: "chat-leave",
    payload: {
      username: username
    }
  };
  broadcast(response);
}

/**
 * Connection: Handle errors
 */
function onError(error) {
  console.log("Websocket: error: " + this.remoteAddress + ": " + error);
}

/**
 * Returns true if a particular host is in the whitelist
 */
function isWhitelisted(host) {
  const whitelist = [
    "localhost",
    "localhost:9000",
    "goat:9000",
    "192.168.1.2:9000"
  ];
  return whitelist.indexOf(host) !== -1;
}

/**
 * Server: Handle new connection requests
 *
 * This happens before the connection is opened, and gives us a chance to
 * reject the connection if it comes from an unknown host, or if it is
 * speaking the wrong protocol.
 *
 * We only allow requests from specific URLs. This prevents malicious or
 * other external websites from establishing connections.
 */
const onServerRequest = req => {
  if (!isWhitelisted(req.host)) {
    req.reject(403, "Forbidden");
    console.log(`Websocket: denying connection from ${req.host}`);
    return;
  }

  // Make sure the protocol matches
  // (Note: this should loop through all the requested protocols
  // to see if there's a match, but we know in this case we're
  // only passing one in.)
  if (req.requestedProtocols[0] != "beej-chat-protocol") {
    req.reject(400, "Unknown protocol");
    console.log("Websocket: Unknown protocol");
    return;
  }

  // Ok, we're golden. Accept and specify the protocol
  req.accept("beej-chat-protocol", req.origin);
  console.log(`Websocket: accepted connection from ${req.remoteAddress}`);
};

/**
 * Server: Handle new connections (after being accepted in onServerRequest())
 */
function onServerConnect(connection) {
  const k = getConnectionKey(connection);
  connectionList[k] = {
    connection: connection
  };
  connection.on("message", onMessage);
  connection.on("error", onError);
  connection.on("close", onClose);
}

/**
 * Server: Handle close
 *
 * This gets called from the server level when a connection closes,
 * but we don't have use for it since we're listening for closes on
 * the connection level.
 */
//function onServerClose(request) {
//}

/**
 * Start the websockets server, attached to this HTTP server
 */
function startWSServer(httpServer) {
  wsServer = new websocket.server({
    httpServer
  });
  wsServer.on("request", onServerRequest);
  wsServer.on("connect", onServerConnect);
}

exports.start = startWSServer;
