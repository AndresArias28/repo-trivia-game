import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/Home";
import ModeratorView from "./pages/ModeratorView";
import PlayerView from "./pages/PlayerView";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/player" element={<PlayerView />}></Route>
        <Route path="/paneladmin" element={<ModeratorView />} />
        <Route path="/" element={<Home />}></Route>
      </Routes>
    </BrowserRouter>
  );
}

export { App };

