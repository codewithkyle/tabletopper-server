import logger from "./lumberjack.js";
import gm from "./game.js";
import type { Socket } from "./globals";

class Room {
    public id: string;
    public code: string;
    public gmId: string;
    private sockets: {
        [id:string]: Socket,
    };
    public locked:boolean;

    constructor(code:string, id: string, gmId:string){
        this.code = code;
        this.id = id;
        this.gmId = gmId;
        this.sockets = {};
        this.locked = false;
    }

    public op(op):void{
        logger.write(op, this.code);
        for (const socket in this.sockets){
            gm.send(this.sockets[socket], "room:op", op);
        }
    }

    public addSocket(ws:Socket):void{
        this.sockets[ws.id] = ws;
        gm.send(ws, "room:join", {
            code: this.code,
            id: this.id,
        });
        console.log(`Socket ${ws.id} joined room ${this.code}`);
    }

    public removeSocket(ws:Socket):void{
        if (ws.id in this.sockets){
            delete this.sockets[ws.id];
            console.log(`Socket ${ws.id} left room ${this.code}`);
        }
        if (Object.keys(this.sockets).length === 0){
            gm.removeRoom(this.code);
        }
    }

    public updateGM(ws:Socket){
        this.gmId = ws.id;
        console.log(`Updated room ${this.code} GM to ${ws.id}`);
    }

    public lock(ws:Socket):void{
        if (ws.id === this.gmId){
            this.locked = true;
        }
        else {
            gm.error(ws, "Action Failed", "Only the Game Master can lock the room.");
        }
    }

    public unlock(ws:Socket):void{
        if (ws.id === this.gmId){
            this.locked = false;
        } else {
            gm.error(ws, "Action Failed", "Only the Game Master can unlock the room.");
        }
    }
}
export default Room;