// Entrypoint do container.
//
// Algumas plataformas (Easypanel, Coolify) injetam a variável PORT no ambiente
// do container. Como o `server.js` do Next lê `process.env.PORT`, isso faria a
// aplicação subir numa porta diferente da configurada no serviço.
//
// Aqui fixamos a porta logo no início, antes de carregar o servidor, para que
// o container SEMPRE escute em 3000 — independentemente do que for injetado.

const PORT = "3000";
const HOSTNAME = "0.0.0.0";

process.env.PORT = PORT;
process.env.HOSTNAME = HOSTNAME;
process.env.NODE_ENV = "production";

require("./server.js");
