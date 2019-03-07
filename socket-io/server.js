const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 9000;
const publicPath = path.join(__dirname, "./public");

app.use(express.static(publicPath));

io.on("connection", () => {
  console.log("New Websocket connection");
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
