import { useEffect, useState } from "react";
import { socket } from "../socket";
import './styles/moderator.css'

const ModeratorView = () => {
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [question, setQuestion] = useState("");
    const [seconds, setSeconds] = useState(15);
    const [players, setPlayers] = useState([]);
    const [scoreboard, setScoreboard] = useState([]);
    const [roundActive, setRoundActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [questions, setQuestions] = useState([]);
    const [options, setOptions] = useState(["", "", "", ""]);
    const [correctIndex, setCorrectIndex] = useState(null);

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addQuestion = () => {
        const text = (question || "").trim();
        const cleaned = options.map(o => (o || "").trim());
        const secs = parseInt(seconds, 10);

        if (!text) {
            return alert("Escribe el texto de la pregunta.");
        }
        if (cleaned.some(o => !o)) {
            return alert("Todas las opciones deben estar completas (sin espacios vacíos).");
        }
        if (correctIndex < 0 || correctIndex >= cleaned.length) {
            return alert("Selecciona la opción correcta.");
        }
        if (Number.isNaN(secs) || secs <= 0) {
            return alert("El tiempo debe ser un número mayor que 0.");
        }

        const nueva = {
            text,
            options: cleaned,
            correctIndex,
            time: secs
        };

        setQuestions(prev => [...prev, nueva]);

        // limpia el formulario
        setQuestion("");
        setOptions(Array(options.length).fill(""));
        setCorrectIndex(-1);
        setSeconds(""); // string vacío, no NaN
    };

    const sendQuestionsToServer = () => {
        socket.emit("host:loadQuestions", { code, questions }, (res) => {
            if (res.ok) {
                alert(`✅ ${res.total} preguntas enviadas`);
            } else {
                alert("❌ Error al enviar preguntas");
            }
        });
    };

    const startGame = () => {
        socket.emit("host:startGame", { code });
    };

    const createRoom = () => {
        if (!name.trim()) return alert("Nombre requerido");
        socket.emit("createRoom", name);
    };

    useEffect(() => {
        socket.on("roomCreated", ({ code }) => setCode(code));
        socket.on("room:update", (data) => {
            setPlayers(data.players || []);
            setRoundActive(data.roundActive);
            setTimeLeft(data.timeLeft);
        });
        socket.on("round:ended", ({ scoreboard }) => {
            setScoreboard(scoreboard);
            setRoundActive(false);
        });
        return () => {
            socket.off("roomCreated");
            socket.off("room:update");
            socket.off("round:ended");
        };
    }, []);


    return (
        <div className="moderator-wrapper">
            {/* Banner superior */}
            <header className="moderator-banner">
                🎉 ¡Bienvenido, Moderador! Administra tu trivia con estilo.
            </header>

            {/* Contenido centrado */}
            <div className="container py-5 d-flex justify-content-center align-items-center">
                <div className="card p-4 shadow-sm moderator-card w-100" style={{ maxWidth: '800px' }}>
                    <h2 className="mb-4 ">
                        Moderador: <strong>{name || 'Unknown'}</strong>
                    </h2>

                    {!code ? (
                        <div className="mb-4">
                            <input
                                className="form-control mb-3"
                                placeholder="Tu nombre"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                            <button className="btn btn-primary w-100" onClick={createRoom}>
                                Crear sala
                            </button>
                        </div>
                    ) : (
                        <>
                            <p >🔑 <b>Código de sala:</b> {code}</p>

                            <hr className="border-dark" />

                            <h3 className="mt-4 ">📋 Preguntas</h3>
                            {questions.map((q, idx) => (
                                <div key={idx} className="border rounded p-3 mb-3 bg-light-subtle text-dark">
                                    <p><strong>{idx + 1}. {q.text}</strong> (⏱ {q.time}s)</p>
                                    <ul className="mb-0">
                                        {q.options.map((opt, i) => (
                                            <li key={i}>
                                                {i === q.correctIndex && '✅ '}
                                                {opt}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}

                            <h4 className="mt-4">➕ Agregar nueva pregunta</h4>
                            <input
                                className="form-control mb-3 text-dark border border-dark border-opacity-50"
                                placeholder="Texto de la pregunta"
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                            />

                            {options.map((opt, idx) => (
                                <div key={idx} className="input-group mb-2 text-dark border border-dark border-opacity-50 ">
                                    <input
                                        className="form-control mb-2 text-dark"
                                        placeholder={`Opción ${idx + 1}`}
                                        value={opt}
                                        onChange={e => handleOptionChange(idx, e.target.value)}
                                    />
                                    <div className="input-group-text">
                                        <input
                                            className="form-check-input mt-0"
                                            type="radio"
                                            checked={correctIndex === idx}
                                            onChange={() => setCorrectIndex(idx)}
                                            name="correct-option"
                                        />
                                    </div>
                                </div>
                            ))}

                            <input
                                type="number"
                                className="form-control mb-3"
                                value={seconds}
                                min={1}
                                step={1}
                                onChange={e => setSeconds(e.target.value)}  // <-- guardamos string
                                placeholder="Tiempo (segundos)"
                            />

                            <button className="btn btn-success w-100 mb-4" onClick={addQuestion}>
                                Agregar pregunta
                            </button>

                            <hr className="border-light" />

                            <h3 className="text-white">🎮 Juego</h3>
                            <div className="d-grid gap-2 mb-4">
                                <button className="btn btn-outline-primary" onClick={sendQuestionsToServer}>
                                    Enviar preguntas al servidor
                                </button>
                                <button className="btn btn-outline-success" onClick={startGame}>
                                    Iniciar trivia
                                </button>
                            </div>

                            <h4 className="text-white">📊 Marcador</h4>
                            <ul className="list-group">
                                {(scoreboard.length ? scoreboard : players).map(p => (
                                    <li key={p.nickname} className="list-group-item d-flex justify-content-between">
                                        <span>{p.nickname}</span>
                                        <span><b>{p.score}</b></span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

};

export default ModeratorView;