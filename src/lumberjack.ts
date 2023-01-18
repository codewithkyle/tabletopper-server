import { randomUUID } from "crypto";
import { existsSync, mkdirSync, rm, rmdirSync, rmSync } from "fs";
import path from "path";
import { Worker } from "worker_threads";

interface LogOp {
    op: "append" | "delete" | "touch",
    log: string,
    uid: string,
    data?: string,
}

class Lumberjack {
    private worker: Worker;
    private promises: {
        [uid: string]: Function,
    };
    private workerPromises: {
        [uid: string]: Function,
    };
    private queue: {
        [code: string]: {
            running: boolean,
            ops: Array<LogOp>,
        }
    }

    constructor(){
        const logsDir = path.join(__dirname, "logs");
        if (existsSync(logsDir)){
            rmdirSync(logsDir, { recursive: true });
        }
        this.promises = {};
        this.workerPromises = {};
        this.queue = {};
        mkdirSync(logsDir);
        this.worker = new Worker(path.join(__dirname, "log-worker.js"));
        this.worker.addListener("message", this.workerInbox.bind(this));
    }

    private workerInbox(e = null){
        const uid = e;
        if (this.workerPromises?.[uid]){
            this.workerPromises[uid]();
            delete this.workerPromises[uid];
        }
        if (this.promises?.[uid]){
            this.promises[uid]();
            delete this.promises[uid];
        }
    }

    private async flush(code:string){
        if (!(code in this.queue)){
            return;
        }
        if (!this.queue[code].running){
            this.queue[code].running = true;
            // We may need to convert the queue system to use a linked list if we noice that we are dropping operations.
            for (const op of this.queue[code].ops){
                await new Promise((resolve) => {
                    this.workerPromises[op.uid] = resolve;
                    this.worker.postMessage(op);
                });
            }
            // Since JS is a single threaded event loop if we've broken out of the queue loop we should be okay to hard reset the ops array.
            // If a new op is about to be pushed it shouldn't happen until the loop hits the event later in the execution.
            // If the new op occurs early in the event loop the for...of loop should continue spinning.
            this.queue[code].ops = [];
            this.queue[code].running = false;
        }
    }

    public error(message:string):void{
        this.worker.postMessage({
            op: "append",
            log: "error.log",
            data: message,
        });
    }

    public write(op:any, room:string):Promise<void>{
        const uid = randomUUID();
        return new Promise((resolve) => {
            this.promises[uid] = resolve;
            this.queue[room].ops.push({
                op: "append",
                log: `/logs/${room}.ndjson`,
                data: JSON.stringify(op),
                uid: uid,
            });
            this.flush(room);
        });
    }

    public delete(room:string):Promise<void>{
        const uid = randomUUID();
        return new Promise((resolve) => {
            this.promises[uid] = resolve;
            this.queue[room].ops.push({
                op: "delete",
                log: `/logs/${room}.ndjson`,
                uid: uid,
            });
            this.flush(room);
        });
    }

    public touch(room:string):Promise<void>{
        this.startQueue(room);
        const uid = randomUUID();
        return new Promise(resolve => {
            this.promises[uid] =  resolve;
            this.queue[room].ops.push({
                op: "touch",
                log: `/logs/${room}.ndjson`,
                uid: uid,
            });
            this.flush(room);
        });
    }

    private startQueue(room:string){
        if (!(room in this.queue)){
            this.queue[room] = {
                running: false,
                ops: [],
            };
        }
    }
}
const logger = new Lumberjack();
export default logger;
