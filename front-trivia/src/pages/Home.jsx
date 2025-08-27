import { useState } from "react";
import ModeratorView from "./ModeratorView";
import PlayerView from "./PlayerView";
import './styles/home.css'


const Home = () => {
    const [role, setRole] = useState(null)
    // const [connected, setConnected] = useState(false);

    if (!role) {
        return (
            <div className="d-flex vh-100">
                {/* Lado izquierdo: selección de rol */}
                <div className="d-flex flex-column justify-content-center align-items-center w-50 p-5 select-role-bg">
                    <h2 className="mb-4 text-center">Aprende Jugando con este juego de Trivia en tiempo real</h2>
                    <div className="container text-center mt-5">
                        <img
                            src="../../public/pregunta.webp"
                            alt="ejemplo"
                            className="img-hover-rotate rounded shadow"
                        />
                    </div>
                    <div className="w-100 mt-4" style={{ maxWidth: '400px' }}>
                        <h2 className="mb-4 text-center">Selecciona tu rol</h2>
                        <div className="d-grid gap-3">
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={() => setRole("host")}
                            >
                                🧑‍🏫 Moderador
                            </button>
                            <button
                                className="btn btn-success btn-lg"
                                onClick={() => setRole("player")}
                            >
                                🕹️ Jugador
                            </button>
                        </div>
                    </div>
                </div>

                {/* Lado derecho: imagen */}
                <div className="w-50 role-image-bg d-none d-md-block" />
            </div>
        );
    }

    return role === "host" ? <ModeratorView /> : <PlayerView />;
};

export default Home;