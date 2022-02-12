import * as uws from "../uws/uws.js";
import dotenv from "dotenv";
import gm from "./game.js";
import { TextDecoder } from "util";
import path from "path";
import { createReadStream, existsSync, statSync } from "fs";
import { pipeStreamOverResponse, setHeaders } from "./utils.js";

const decoder = new TextDecoder("utf-8");
dotenv.config();
const port = process.env.PORT;
let app;
if (process.env.ENV === "dev"){
    // @ts-ignore
    app = uws.App();
}
else {
    // @ts-ignore
    app = uws.SSLApp({
        key_file_name: process.env.KEY,
        cert_file_name: process.env.CERT,
    });
}

app.ws("/*", {
    // @ts-ignore
    compression: uws.SHARED_COMPRESSOR,
    maxPayloadLength: 150 * 1024 * 1024,
    maxBackpressure: 150 * 1024 * 1024,
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
    close: (ws) => {
        gm.disconnect(ws);
    },
});

app.any("/", async (res, req) => {
    setHeaders(res);
    res.writeStatus("200 OK");
    res.end();
})

app.head("/room/:code", (res, req) => {
    const code = req.getParameter(0);
    const location = path.join(__dirname, "logs", `${code}.ndjson`);
    if (existsSync(location)){
        const totalSize = statSync(location).size;
        if (totalSize > 0){
            res.writeStatus("200 OK");
        } else {
            res.writeStatus("204 No Content");
        }
    } else {
        res.writeStatus("404 Not Found");
    }
    setHeaders(res);
    res.end();
});

app.get("/room/:code", (res, req) => {
    const code = req.getParameter(0);
    const location = path.join(__dirname, "logs", `${code}.ndjson`);
    let fail = true;
    if (existsSync(location)){
        const totalSize = statSync(location).size;
        if (totalSize > 0){
            fail = false;
            const readstream = createReadStream(location);
            pipeStreamOverResponse(res, readstream, totalSize);
        } else {
            res.writeStatus("204 No Content");
        }
    } else {
        res.writeStatus("404 Not Found");
    }
    setHeaders(res);
    if (fail){
        res.end();
    }
});

app.listen("127.0.0.1", port, {}, (token) => {});