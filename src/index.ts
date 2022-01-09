import * as uws from "../uws/uws";
import dotenv from "dotenv";
import gm from "./game";
import { TextDecoder } from "util";

const decoder = new TextDecoder("utf-8");
dotenv.config();
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
        gm.connect(ws);
    },
    message: (ws, message, isBinary) => {
        try{
            gm.message(ws, JSON.parse(decoder.decode(message)));
        } catch (e){
            // Log error
        }
    },
    drain: (ws) => {
        console.log('WebSocket backpressure: ' + ws.getBufferedAmount());
    },
    close: (ws) => {
        gm.disconnect(ws);
    },
});

app.listen("0.0.0.0", port, {}, (token) => {});