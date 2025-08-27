import { io } from "socket.io-client";

// Si tu server corre en otro host/puerto, ajusta aquí:
export const socket = io("http://localhost:3060", {
  autoConnect: true
});
