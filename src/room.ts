import logger from "./lumberjack.js";
import gm from "./game.js";
import type { ExitReason, Socket, Pawn } from "./globals";
import { set, batch, del, insert } from "./control-center.js";
import {randomUUID} from "crypto";

class Room {
    public id: string;
    public code: string;
    public gmId: string;
    private sockets: {
        [id:string]: Socket,
    };
    public locked:boolean;
    private map: string;
    private deadPlayers: {
        [id:string]: {
            name: string,
        }
    };
    public pawns: Array<Pawn>;

    constructor(code:string, id: string, gmId:string){
        this.code = code;
        this.id = id;
        this.gmId = gmId;
        this.sockets = {};
        this.locked = false;
        this.map = null;
        this.deadPlayers = {};
        this.pawns = [];
    }
    
    public kickPlayer(id:string):void{
        if(id in this.sockets){
            gm.send(this.sockets[id], "room:ban");
            this.removeSocket(this.sockets[id], "KICKED");
        }
    }

    public async clearMap():Promise<void>{
        this.broadcast("room:tabletop:clear");
        await logger.delete(this.code);
        await logger.touch(this.code);
        this.map = null;
        this.pawns = [];
        const op = set("games", this.code, "map", null);
        const op2 = set("games", this.code, "players", []);
        const ops = batch("games", this.code, [op, op2]);
        this.dispatch(ops);
    }

    public setMap(map:string):void{
        this.map = map;
        const op = set("games", this.code, "map", map);
        this.dispatch(op);
    }

    public spawnPlayers(resetPostions = true):void{
        const ids = [];
        this.pawns = [];
        for (const id in this.sockets){
            if (id !== this.gmId){
                ids.push(id);
                if (resetPostions){
                    const pawn:Pawn = {
                        uid: randomUUID(),
                        x: 0,
                        y: 0,
                        room: this.code,
                        playerId: id,
                        name: this.sockets[id].name,
                    };
                    this.pawns.push(pawn);
                }
            }
        }
        this.broadcast("room:tabletop:spawn:pawns", this.pawns);
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

    public resetSocket(ws:Socket, lastId: string):void{
        if (lastId in this.deadPlayers){
            ws.room = this.code;
            gm.reconnect(ws, ws.id, lastId);
            this.sockets[ws.id] = ws;
            ws.name = this.deadPlayers[ws.id].name;
            delete this.deadPlayers[ws.id];
            console.log(`Socket ${ws.id} reconnected to ${this.code}`);
            gm.send(ws, "room:join", {
                code: this.code,
                id: this.id,
            });
            this.broadcast("room:announce:reconnect", `${ws.name} has returned.`);
            if (ws.id !== this.gmId){
                const op = set("players", ws.id, "active", true);
                this.dispatch(op);
            }
            if (this.pawns.length){
                this.broadcast("room:tabletop:spawn:pawns", this.pawns);
            }
        } else {
            // Player wasn't dead...
            gm.send(ws, "core:sync:fail");
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
        if (this.map){
            this.spawnPlayers(false);
        }
    }

    public removeSocket(ws:Socket, reason: ExitReason = "UNKNOWN"):void{
        if (ws.id in this.sockets){
            this.deadPlayers[ws.id] = {
                name: ws.name,
            };
            delete this.sockets[ws.id];
            if (ws.id !== this.gmId){
                const op = set("players", ws.id, "active", false);
                this.dispatch(op);
            }
            console.log(`Socket ${ws.id} left room ${this.code}`);
        }
        switch (reason){
            case "QUIT":
                this.broadcast("room:announce:quit", `${ws.name} has left the room.`);
                break;
            case "KICKED":
                this.broadcast("room:announce:kick", `${ws.name} has been kicked from the room.`);
                break;
            case "DC":
                this.broadcast("room:announce:dc", `${ws.name} was disconnected.`);
                break;
            default:
                break;
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
            gm.send(this.sockets[this.gmId], "room:announce:lock");
        }
        else {
            gm.error(ws, "Action Failed", "Only the Game Master can lock the room.");
        }
    }

    public unlock(ws:Socket):void{
        if (ws.id === this.gmId){
            this.locked = false;
            gm.send(this.sockets[this.gmId], "room:announce:unlock");
        }
        else {
            gm.error(ws, "Action Failed", "Only the Game Master can unlock the room.");
        }
    }
}
export default Room;
