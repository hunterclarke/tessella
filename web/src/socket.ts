import { Socket } from "phoenix";

export function createSocket() {
  const socket = new Socket("/socket", {});
  socket.connect();
  return socket;
}
