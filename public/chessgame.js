const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

const getPieceUnicode = (piece) => {
  const pieces = {
    p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
    P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔'
  };
  const key = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
  return pieces[key];
};

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = '';

  board.forEach((row, rowIndex) => {
    row.forEach((square, colIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowIndex + colIndex) % 2 === 0 ? "light" : "dark"
      );
      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = colIndex;

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add("piece", square.color === 'w' ? "white" : "black");
        pieceElement.innerText = getPieceUnicode(square);
        pieceElement.draggable = true;

        pieceElement.addEventListener("dragstart", (e) => {
          if ((playerRole === 'w' && square.color === 'w') ||
              (playerRole === 'b' && square.color === 'b')) {
            draggedPiece = pieceElement;
            sourceSquare = { row: rowIndex, col: colIndex };
          } else {
            e.preventDefault(); // prevent dragging opponent's piece
          }
        });

        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("dragover", (e) => e.preventDefault());

      squareElement.addEventListener("drop", () => {
        if (draggedPiece && sourceSquare) {
          const target = { row: rowIndex, col: colIndex };
          const source = String.fromCharCode(97 + sourceSquare.col) + (8 - sourceSquare.row);
          const destination = String.fromCharCode(97 + target.col) + (8 - target.row);
          const move = { from: source, to: destination, promotion: 'q' };

          socket.emit("move", move);
          draggedPiece = null;
          sourceSquare = null;
        }
      });

      boardElement.appendChild(squareElement);
    });
  });
};

socket.on("player", (role) => {
  playerRole = role;
  alert(`You are playing as ${role === 'w' ? "White" : "Black"}`);
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

socket.on("move", (move) => {
  chess.move(move);
  renderBoard();
});

socket.on("invalidMove", (data) => {
  alert("Invalid move: " + (data.reason || "unknown error"));
});

socket.on("gameOver", (result) => {
  alert(result);
});

socket.on("restart", () => {
  chess.reset();
  renderBoard();
});

socket.on("playerLeft", (color) => {
  alert(`Player playing ${color} left the game.`);
});

renderBoard();
