const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));

const chess = new Chess();
let players = { white: null, black: null };

app.get('/', (req, res) => {
  res.render("index", { title: "Chess Game" });
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Assign player roles
  if (!players.white) {
    players.white = socket.id;
    socket.emit("player", "w");
  } else if (!players.black) {
    players.black = socket.id;
    socket.emit("player", "b");
  } else {
    socket.emit("spectatorrole");
  }

  // Send current board to new player/spectator
  socket.emit("boardState", chess.fen());

  socket.on("move", (move) => {
    try {
      const playerColor = socket.id === players.white ? 'w' : socket.id === players.black ? 'b' : null;

      if (!playerColor || chess.turn() !== playerColor) {
        return socket.emit("invalidMove", { reason: "Not your turn" });
      }

      const result = chess.move(move);
      if (result) {
        io.emit("move", move);
        io.emit("boardState", chess.fen());

        if (chess.game_over()) {
          let status = "Game Over";
          if (chess.in_checkmate()) {
            status = `${playerColor === 'w' ? 'White' : 'Black'} wins by checkmate`;
          } else if (chess.in_stalemate()) {
            status = "Draw by stalemate";
          } else if (chess.in_draw()) {
            status = "Draw";
          } else if (chess.insufficient_material()) {
            status = "Draw by insufficient material";
          }
          io.emit("gameOver", status);
        }
      } else {
        socket.emit("invalidMove", { reason: "Illegal move" });
      }
    } catch (error) {
      console.error(error);
      socket.emit("invalidMove", { reason: "Server error" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    if (socket.id === players.white) {
      players.white = null;
      io.emit("playerLeft", "white");
    } else if (socket.id === players.black) {
      players.black = null;
      io.emit("playerLeft", "black");
    }
  });

  // Restart request
  socket.on("restart", () => {
    if (socket.id === players.white || socket.id === players.black) {
      chess.reset();
      io.emit("boardState", chess.fen());
      io.emit("restart");
    }
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
