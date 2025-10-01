const express = require("express");
const app = express();
const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

let rooms = {}; // roomId -> { players: [], gameState: {} }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], gameState: null };
    }

    if (rooms[roomId].players.length >= 4) {
      socket.emit("roomFull");
      return;
    }

    rooms[roomId].players.push({ id: socket.id, name: playerName });
    socket.join(roomId);

    io.to(roomId).emit("updatePlayers", rooms[roomId].players);

    if (rooms[roomId].players.length === 4) {
      startGame(roomId);
    }
  });

  socket.on("makeMove", ({ roomId, move }) => {
    io.to(roomId).emit("moveMade", { player: socket.id, move });
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(
        (p) => p.id !== socket.id
      );
      io.to(roomId).emit("updatePlayers", rooms[roomId].players);
    }
    console.log("User disconnected:", socket.id);
  });
});

function startGame(roomId) {
  // Simplified shuffle/deal
  const deck = [];
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  for (let s of suits) {
    for (let r of ranks) {
      deck.push(r + s);
    }
  }
  deck.sort(() => Math.random() - 0.5);

  const players = rooms[roomId].players;
  players.forEach((p, i) => {
    const hand = deck.splice(0, 6);
    io.to(p.id).emit("dealCards", hand);
  });

  const trump = deck.pop();
  io.to(roomId).emit("setTrump", trump);

  rooms[roomId].gameState = {
    deck,
    trump,
    table: [],
    turn: 0,
  };

  io.to(roomId).emit("gameStarted", rooms[roomId].gameState);
}

http.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
