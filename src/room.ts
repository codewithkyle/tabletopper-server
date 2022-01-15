import logger from "./lumberjack.js";
import gm from "./game.js";
import type { Socket } from "./globals";
import { set } from "./control-center.js";

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

    public clearPawns():void{
        const op = set("games", this.code, "players", []);
        this.dispatch(op);
    }

    public spawnPlayers():void{
        const ids = [];
        for (const id in this.sockets){
            if (id !== this.gmId){
                ids.push(id);
            }
        }
        console.log(`Room ${this.code} is spawning players`);
        const op = set("games", this.code, "players", ids);
        this.dispatch(op);
    }

    public dispatch(op):void{
        logger.write(op, this.code);
        for (const socket in this.sockets){
            gm.send(this.sockets[socket], "room:op", op);
        }
    }

    public broadcast(type: string, data = null):void{
        for (const socket in this.sockets){
            gm.send(this.sockets[socket], type, data);
        }
    }

    public addSocket(ws:Socket, data = null):void{
        this.sockets[ws.id] = ws;
        gm.send(ws, "room:join", {
            code: this.code,
            id: this.id,
        });
        if (data?.token){
            this.dispatch(data.token);
        }
        if (data?.name){
            ws.name = data.name;
            data.player.value.room = this.code;
            this.dispatch(data.player);
        } else {
            ws.name = "Game Master";
        }
        console.log(`Socket ${ws.id} joined room ${this.code}`);
        this.broadcast("room:announce:join", `${ws.name} joined the room.`);
    }

    public removeSocket(ws:Socket):void{
        if (ws.id in this.sockets){
            delete this.sockets[ws.id];
            console.log(`Socket ${ws.id} left room ${this.code}`);
        }
        this.broadcast("room:announce:leave", `${ws.name} left the room.`)
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