const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"], credentials: true } });//socket vinculado

//servir archivo estaticos
app.use(express.static(__dirname + '/public'));

// Middleware
app.use(express.json());

app.get("/", (_, res) => res.send("Trivia server OK"));

// Estructura global para manejar salas
const rooms = {};

// Función para generar código único de sala
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function roomPublicState(code) {
    const room = rooms[code];
    if (!room) return null;
    return {
        code,
        moderator: room.moderator,
        players: Object.values(room.players).map(p => ({
            nickname: p.nickname,
            score: p.score
        })),
        roundActive: room.round?.active || false,
        timeLeft: room.round?.timeLeft || 0,
        question: room.round?.active ? room.round.question : null
    };
}

// Escuchar conexiones de clientes
io.on('connection', (socket) => {
    console.log(' Un usuario se conectó:', socket.id);

    // Evento: entrar sala moderador
    socket.on('createRoom', (moderatorName) => {
        try {
            const code = generateRoomCode();
            rooms[code] = {
                hostSocketId: socket.id,
                moderator: moderatorName,
                players: {},
                questions: [],
                currentIndex: 0,
                roundActive: false,
                answered: {}

            };
            socket.join(code);
            socket.data.code = code;
            socket.data.role = 'host';
            const payload = {
                code,
                moderator: moderatorName,
                role: 'moderator'
            };
            socket.emit('roomCreated', payload);
            console.log(`🛠️ Sala creada: ${code} por ${moderatorName}`);
        } catch (error) {
            console.error('Error al crear sala:', error);
            socket.emit('error', 'No se pudo crear la sala', error);
        }
    });

    socket.on("player:join", ({ code, nickname }, cb) => {
        const safeCb = (p) => { try { cb?.(p); } catch { } };

        const room = rooms[code];
        if (!room) return safeCb({ ok: false, error: "Sala no existe" });

        // Asegurar estructura
        room.players = room.players || {};

        // Validar nickname
        const nick = String(nickname || "").trim();
        if (!nick) return safeCb({ ok: false, error: "Nickname vacío" });

        const exists = Object.values(room.players).some(
            (p) => (p.nickname || "").trim().toLowerCase() === nick.toLowerCase()
        );
        if (exists) return safeCb({ ok: false, error: "Nickname en uso" });

        // Registrar jugador
        room.players[socket.id] = { nickname: nick, score: 0 };
        socket.data.code = code;
        socket.data.nickname = nick;
        socket.join(code);

        safeCb({ ok: true });

        // Emitir estado actual de la sala (sin forzar roundActive)
        io.to(code).emit("room:update", {
            players: serializePlayers(room.players),
            roundActive: Boolean(room.roundActive),        // <-- estado real
            timeLeft: typeof room.timeLeft === "number" ? room.timeLeft : 0,
            question: room.currentQuestion || null         // <-- solo si hay pregunta
        });
    });


    socket.on("host:loadQuestions", ({ code, questions }, cb) => {
        const room = rooms[code];
        if (!room || room.hostSocketId !== socket.id) return cb?.({ ok: false });
        room.questions = questions;
        room.currentIndex = 0;
        cb?.({ ok: true, total: questions.length });
        console.log("📦 Preguntas guardadas:", questions);

    });
    socket.on("host:startGame", ({ code }) => {
        const room = rooms[code];
        if (!room) {
            socket.emit("error", `❌ La sala ${code} no existe`);
            return;
        }

        if (room.hostSocketId !== socket.id) {
            socket.emit("error", "❌ No tienes permisos para iniciar esta trivia");
            return;
        }

        if (!Array.isArray(room.questions) || room.questions.length === 0) {
            socket.emit("error", "❌ No hay preguntas cargadas");
            return;
        }

        room.currentIndex = 0;
        console.log(`🎮 Iniciando trivia en sala ${code} con ${room.questions.length} preguntas`);
        launchNextQuestion(code);
    });


    socket.on("player:answer", ({ code, answerIndex }, cb) => {
        const room = rooms[code];
        if (!room.players[socket.id]) return cb?.({ ok: false, error: "Jugador no válido" });
        if (!room.roundActive) return cb?.({ ok: false, error: "No hay ronda activa" });
        if (room.answered[socket.id]) return cb?.({ ok: false, error: "Ya respondiste" });

        const question = room.questions[room.currentIndex];
        const isCorrect = Number(answerIndex) === question.correctIndex;

        room.answered[socket.id] = { answerIndex, correct: isCorrect };
        if (isCorrect) room.players[socket.id].score += 1;

        cb?.({ ok: true, correct: isCorrect });

        const totalPlayers = Object.keys(room.players).length;
        const totalAnswered = Object.keys(room.answered).length;

        if (totalAnswered >= totalPlayers) {
            clearTimeout(room.currentTimer);
            room.currentTimer = null;
            finishRound(code);
        }
    });

    socket.on("host:endRound", ({ code }) => {
        const room = rooms[code];
        if (!room || room.hostSocketId !== socket.id) return;
        finishRound(code);
    });

    socket.on("disconnect", () => {
        const code = socket.data?.code;
        const room = rooms[code];
        if (!room) return;

        if (room.hostSocketId === socket.id) {
            io.to(code).emit("room:closed");
            delete rooms[code];
            console.log(`❌ Sala ${code} eliminada por desconexión del host`);
        } else if (room.players[socket.id]) {
            delete room.players[socket.id];
            io.to(code).emit("room:update", roomPublicState(code));
        }
    });

});

function finishRound(code) {
    const room = rooms[code];
    if (!room) return;

    room.roundActive = false;

    const question = room.questions[room.currentIndex];
    room.currentQuestion = question;

    const results = {
        correctAnswer: question.correct,
        totalPlayers: Object.keys(room.players).length,
        totalAnswered: Object.keys(room.answered).length,
        playerResults: {},
        scoreboard: getScoreboard(room),
        currentIndex: room.currentIndex
    };

    for (const [socketId, response] of Object.entries(room.answered)) {
        const player = room.players[socketId];
        if (player) {
            results.playerResults[socketId] = {
                nickname: player.nickname,
                answerIndex: response.answerIndex,
                correct: response.correct,
                score: player.score
            };
        }
    }

    io.to(code).emit("round:ended", {
        scoreboard: buildScoreboard(rooms[code].players),
        correctIndex: question.correctIndex ?? question.correct
    });

    room.currentIndex += 1;
    setTimeout(() => launchNextQuestion(code), 2000); // 2s pausa entre preguntas
}

function serializePlayers(playersObj) {
    // Convierte {socketId: {nickname, score}} en [{nickname, score}, ...]
    return Object.values(playersObj).map(p => ({
        nickname: p.nickname,
        score: p.score ?? 0
    }));
}

function buildScoreboard(playersObj, {
    includeId = false,
    order = "desc",
    limit = null,
    rankMode = "dense"
} = {}) {
    if (!playersObj || typeof playersObj !== "object") return [];

    // 1) Pasar a arreglo y sanear
    let arr = Object.entries(playersObj).map(([id, p]) => ({
        id,
        nickname: (p?.nickname ?? "").toString(),
        score: Number.isFinite(p?.score) ? p.score : 0
    }));

    // 2) Ordenar por score (y luego nickname para estabilidad)
    const mul = order === "asc" ? 1 : -1;
    arr.sort((a, b) => {
        if (a.score !== b.score) return mul * (a.score - b.score);
        return a.nickname.localeCompare(b.nickname);
    });

    // 3) Aplicar límite (top N) si corresponde
    if (Number.isInteger(limit) && limit > 0) {
        arr = arr.slice(0, limit);
    }

    // 4) Asignar rank con manejo de empates
    if (rankMode === "competition") {
        // 1,2,2,4...
        let lastScore = null;
        let lastRank = 0;
        arr.forEach((p, i) => {
            if (p.score !== lastScore) {
                lastRank = i + 1; // posición real
                lastScore = p.score;
            }
            p.rank = lastRank;
        });
    } else {
        // "dense": 1,2,2,3...
        let lastScore = null;
        let rank = 0;
        arr.forEach((p, i) => {
            if (p.score !== lastScore) {
                rank += 1;
                lastScore = p.score;
            }
            p.rank = rank;
        });
    }

    // 5) Remover id si no se pidió
    if (!includeId) {
        arr = arr.map(({ id, ...rest }) => rest);
    }

    return arr;
}


function launchNextQuestion(code) {
    const room = rooms[code];
    if (!room) return;

    const question = room.questions[room.currentIndex];
    if (!question) {
        io.to(code).emit("game:finished", {
            scoreboard: getScoreboard(room)
        });
        console.log(`🏁 Juego terminado en sala ${code}`);
        return;
    }

    room.roundActive = true;
    room.answered = {};

    io.to(code).emit("round:started", {
        text: question.text,
        options: question.options,
        index: room.currentIndex + 1,
        total: room.questions.length,
        seconds: question.time
    });

    const endAt = Date.now() + question.time * 1000;
    const tick = setInterval(() => {
        const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        io.to(code).emit("round:tick", { timeLeft: left });

        if (left <= 0) {
            clearInterval(tick);
        }
    }, 1000);

    room.currentTimer = setTimeout(() => {
        finishRound(code);
    }, question.time * 1000);
}



function getScoreboard(room) {
    return Object.values(room.players)
        .map((p) => ({ nickname: p.nickname, score: p.score }))
        .sort((a, b) => b.score - a.score);
}

// Levantar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(` Servidor corriendo en http://localhost:${PORT}`);
});