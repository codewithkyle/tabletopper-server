import * as uws from "../uws/uws";
import dotenv from "dotenv";
import SocketManager from "./sockets-manager";
import { TextDecoder } from "util";

const decoder = new TextDecoder("utf-8");
dotenv.config();
const sm = new SocketManager();
const port = process.env.PORT;
let app;
if (process.env.ENV === "dev"){
    app = uws.App();
}
else {
    app = uws.SSLApp({
        key_file_name: process.env.KEY,
        cert_file_name: process.env.CERT,
    });
}

app.ws("/*", {
    compression: uws.SHARED_COMPRESSOR,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 32,
    open: (ws) => {
        sm.connect(ws);
    },
    message: (ws, message, isBinary) => {
        try{
            sm.message(ws, JSON.parse(decoder.decode(message)));
        } catch (e){
            // Log error
        }
    },
    drain: (ws) => {
        console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
    },
    close: (ws) => {
        sm.disconnect(ws);
    },
});

app.listen("0.0.0.0", port, {}, (token) => {});