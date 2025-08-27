import { useEffect, useState } from "react";
import { socket } from "../socket";
import './styles/player.css'

function normalizePlayers(players) {
    if (!players) return [];
    if (Array.isArray(players)) return players;
    return Object.values(players).map(p => ({ nickname: p.nickname, score: p.score ?? 0 }));
}

const PlayerView = () => {
    const [nickname, setNickname] = useState("");
    const [code, setCode] = useState("");
    const [joined, setJoined] = useState(false);
    const [question, setQuestion] = useState(null);
    const [status, setStatus] = useState("");
    const [timeLeft, setTimeLeft] = useState(null);
    const [players, setPlayers] = useState([]);
    const [scoreboard, setScoreboard] = useState([]);
    const [roundActive, setRoundActive] = useState(false);
    const [selected, setSelected] = useState(null);   // índice elegido
    const [answered, setAnswered] = useState(false);  // ya envió respuesta
    const [feedback, setFeedback] = useState(null);   // { correctIndex }

    const join = () => {
        socket.emit("player:join", { code: code.trim().toUpperCase(), nickname }, (res) => {
            if (res?.ok) setJoined(true);
            else alert(res?.error);
        });
    };

    useEffect(() => {
        socket.on("room:update", (data) => {
            setPlayers(normalizePlayers(data.players));
            setRoundActive(Boolean(data.roundActive));
            if (typeof data.timeLeft === "number") setTimeLeft(data.timeLeft);

            // --- OPCIÓN B: si el backend manda la pregunta dentro del update ---
            if (typeof data.question === "object" && data.question !== null) {
                setQuestion({
                    text: data.question.text || data.question,
                    options: data.question.options || data.options || null,
                });
                setSelected(null);
                setAnswered(false);
                setFeedback(null);
            }
        });

        socket.on("round:started", ({ text, options, seconds }) => {
            setQuestion({ text, options });
            setSelected(null);

            setStatus("¡Responde ahora!");

            setTimeLeft(seconds);
            setAnswered(false);
            setRoundActive(true);
            console.log("🟡 Pregunta recibida:", { text, options, seconds });

        });

        socket.on("round:tick", ({ timeLeft }) => {
            setTimeLeft(timeLeft);
        });

        // Resultado al cerrar la ronda (correcta/incorrecta + marcador)
        socket.on("round:ended", ({ scoreboard, correctIndex }) => {
            setScoreboard(scoreboard || []);
            setFeedback(
                typeof correctIndex === "number" ? { correctIndex } : null
            );
            setRoundActive(false);
        });

        socket.on("room:closed", () => {
            alert("La sala fue cerrada");
            window.location.reload();
        });

        return () => {
            socket.off("room:update");
            socket.off("question:started");
            socket.off("round:started");
            socket.off("round:tick");
            socket.off("round:ended");
            socket.off("room:closed");
        };
    }, []);

    const sendAnswer = () => {
        if (selected === null) return alert("Selecciona una opción");
        socket.emit("player:answer", { code, answerIndex: selected }, (res) => {
            if (!res?.ok) alert(res.error);
            else {
                setAnswered(true);
                setStatus(res.correct ? "✅ Correcto" : "❌ Incorrecto");
            }
        });
    };

    return (
        <div className="container py-5 app-background">
            {!joined ? (
                <div className="card p-4 shadow-sm join-card mx-auto">
                    <h2 className="mb-3 text-center text-light">🎮 Unirse a una sala</h2>
                    <input
                        className="form-control mb-3 text-dark"
                        placeholder="Código de sala"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                    <input
                        className="form-control mb-3 text-dark"
                        placeholder="Tu nickname"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                    />
                    <button className="btn btn-primary w-100" onClick={join}>
                        Entrar
                    </button>
                </div>
            ) : (
                <div className="card p-4 shadow-sm game-card mx-auto">
                    {/* Cabecera */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h3 className="mb-0">👤 {nickname}</h3>
                        <div className="badge bg-secondary fs-6">
                            Sala: <strong>{code}</strong>
                        </div>
                    </div>

                    {/* Estado y tiempo */}
                    <div className="d-flex justify-content-between align-items-center mb-4 p-3 rounded bg-light border">
                        <span className="text-muted">
                            Estado: <b className="text-dark">{status}</b>
                        </span>
                        <span className="text-danger fw-bold">
                            ⏱ Tiempo: {timeLeft}s
                        </span>
                    </div>

                    {/* Pregunta */}
                    {roundActive && question?.text && Array.isArray(question.options) && (
                        <div className="mt-3">
                            <h4 className="mb-3">❓ Pregunta actual</h4>
                            <p className="lead">{question.text}</p>

                            <div className="mb-3">
                                {question.options.map((opt, idx) => (
                                    <div key={idx} className="form-check mb-2">
                                        <input
                                            className="form-check-input text-dark"
                                            type="radio"
                                            name="option"
                                            value={idx}
                                            checked={selected === idx}
                                            onChange={() => setSelected(idx)}
                                            disabled={answered}
                                            id={`option-${idx}`}
                                        />
                                        <label className="form-check-label" htmlFor={`option-${idx}`}>
                                            {opt}
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <button
                                className="btn btn-success w-100"
                                onClick={sendAnswer}
                                disabled={answered || selected === null}
                            >
                                Enviar respuesta
                            </button>

                            {answered && <p className="text-muted mt-2 text-center"><i>Respuesta enviada…</i></p>}
                        </div>
                    )}


                    {!roundActive && feedback && (
                        <div>
                            <p><b>✅ La ronda ha terminado.</b></p>
                            <p>Respuesta correcta: <b>{question.options[feedback.correctIndex]}</b></p>
                            <h3>📊 Marcador final</h3>
                            <ul>
                                {scoreboard.map((p, idx) => (
                                    <li key={idx}>{p.nickname}: {p.score}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {!roundActive && !feedback && (
                        <p className="text-muted"><i>Esperando a que el moderador inicie la siguiente ronda…</i></p>
                    )}
                </div>
            )}
        </div>
    );


};

export default PlayerView;