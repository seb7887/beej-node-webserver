"use strict";

const httpServer = require("./server.js");
const wsServer = require("./chat-server.js");

const server = httpServer.start();
wsServer.start(server);

console.log("---------------------------------------------------------");
console.log("Point your web browser windows to: http://localhost:9000/");
console.log("---------------------------------------------------------");
