import { existsSync, mkdirSync, rm, rmdirSync, rmSync } from "fs";
import path from "path";
import { Worker } from "worker_threads";

class Lumberjack {
    private worker: Worker;

    constructor(){
        const logsDir = path.join(__dirname, "logs");
        if (existsSync(logsDir)){
            rmdirSync(logsDir, { recursive: true });
        }
        mkdirSync(logsDir);
        this.worker = new Worker(path.join(__dirname, "log-worker.js"));
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

    public delete(room:string):void{
        this.worker.postMessage({
            op: "delete",
            log: `/logs/${room}.ndjson`,
        })
    }

    public touch(room:string):void{
        this.worker.postMessage({
            op: "touch",
            log: `/logs/${room}.ndjson`,
        });
    }
}
const logger = new Lumberjack();
export default logger;