import { randomUUID } from "crypto";
import { existsSync, mkdirSync, rm, rmdirSync, rmSync } from "fs";
import path from "path";
import { Worker } from "worker_threads";

class Lumberjack {
    private worker: Worker;
    private promises: {
        [uid: string]: Function,
    };

    constructor(){
        const logsDir = path.join(__dirname, "logs");
        if (existsSync(logsDir)){
            rmdirSync(logsDir, { recursive: true });
        }
        this.promises = {};
        mkdirSync(logsDir);
        this.worker = new Worker(path.join(__dirname, "log-worker.js"));
        this.worker.addListener("message", this.workerInbox.bind(this));
    }

    private workerInbox(e = null){
        const uid = e;
        if (this.promises?.[uid]){
            this.promises[uid]();
            delete this.promises[uid];
        }
    }

    public error(message:string):void{
        this.worker.postMessage({
            op: "append",
            log: "error.log",
            data: message,
        });
    }

    public write(op, room:string):void{
        this.worker.postMessage({
            op: "append",
            log: `/logs/${room}.ndjson`,
            data: JSON.stringify(op),
        });
    }

    public delete(room:string):Promise<void>{
        const uid = randomUUID();
        return new Promise((resolve) => {
            this.promises[uid] = resolve;
            this.worker.postMessage({
                op: "delete",
                log: `/logs/${room}.ndjson`,
                uid: uid,
            });
        });
    }

    public touch(room:string):Promise<void>{
        const uid = randomUUID();
        return new Promise(resolve => {
            this.promises[uid] =  resolve;
            this.worker.postMessage({
                op: "touch",
                log: `/logs/${room}.ndjson`,
                uid: uid,
            });
        });
    }
}
const logger = new Lumberjack();
export default logger;
