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

  // Send current board state
  socket.emit("boardState", chess.fen());

  // Handle move
  socket.on("move", (move) => {
    try {
      console.log("Received move:", move);

      const playerColor = socket.id === players.white ? 'w' : socket.id === players.black ? 'b' : null;

      if (!playerColor || chess.turn() !== playerColor) {
        return socket.emit("invalidMove", { reason: "Not your turn" });
      }

      // Validate move structure
      if (!move || typeof move !== "object" || !move.from || !move.to) {
        return socket.emit("invalidMove", { reason: "Malformed move data" });
      }

      const result = chess.move(move);

      if (result) {
        io.emit("move", move);
        io.emit("boardState", chess.fen());

        if (chess.isGameOver()) {
          let status = "Game Over";
          if (chess.isCheckmate()) {
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
      console.error("Error during move:", error);
      socket.emit("invalidMove", { reason: error.message || "Server error" });
    }
  });

  // Handle disconnect
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

  // Handle restart
  socket.on("restart", () => {
    if (socket.id === players.white || socket.id === players.black) {
      chess.reset();
      io.emit("boardState", chess.fen());
      io.emit("restart");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
