const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server, {
  cors: {
    origin: "*", // You can restrict this to your domain for production
    methods: ["GET", "POST"]
  }
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));

const chess = new Chess();
let players = { white: null, black: null };
let playerNames = {}; // Store socket.id → name

app.get('/', (req, res) => {
  res.render("index", { title: "Chess Game" });
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('setName', (name) => {
    playerNames[socket.id] = name;

    // Assign player roles
    if (!players.white) {
      players.white = socket.id;
      socket.emit("player", { color: "w", name });
    } else if (!players.black) {
      players.black = socket.id;
      socket.emit("player", { color: "b", name });
    } else {
      socket.emit("spectatorrole");
    }

    // Broadcast both player names
    io.emit("playerNames", {
      white: players.white ? playerNames[players.white] : null,
      black: players.black ? playerNames[players.black] : null,
    });
  });

  // Send current board
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

  socket.on("restart", () => {
    if (socket.id === players.white || socket.id === players.black) {
      chess.reset();
      io.emit("boardState", chess.fen());
      io.emit("restart");
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

    delete playerNames[socket.id];

    // Update player names after disconnect
    io.emit("playerNames", {
      white: players.white ? playerNames[players.white] : null,
      black: players.black ? playerNames[players.black] : null,
    });
  });
});

// ✅ This allows Render, Railway, etc., to set the port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
