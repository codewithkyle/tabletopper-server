import logger from "./lumberjack.js";
import gm from "./game.js";
import type { ExitReason, Socket, Pawn } from "./globals";
import { set, batch, del, insert } from "./control-center.js";
import {randomUUID} from "crypto";

const COLORS = ["grey", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "light-blue", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];

class Room {
    public code: string;
    public gmId: string;
    private sockets: {
        [id:string]: Socket,
    };
    public locked:boolean;
    private deadPlayers: {
        [id:string]: {
            name: string,
        }
    };
    public showPawns: boolean;
    private mutedPlayers: {
        [id:string]: null,
    };

    constructor(code:string, gmId:string){
        this.code = code;
        this.gmId = gmId;
        this.sockets = {};
        this.locked = false;
        this.deadPlayers = {};
        this.showPawns = false;
        this.mutePlayer = {};
    }

    public mutePlayer({ playerId, muted }): void{
        if (muted){
            this.mutePlayer[playerId] = null;
        } else if (!muted && playerId in this.mutePlayer) {
            delete this.mutePlayer[playerId];
        }
    }

    public ping(data, ws):void{
        if (ws.id in this.mutePlayer) return;
        this.broadcast("room:tabletop:ping", data);
    }

    public async announceInitiative({ current, next }):Promise<void>{
        const op = set("games", this.code, "active_initiative", current.uid);
        await this.dispatch(op);
        if (current?.playerId != null){
            gm.send(this.sockets[current.playerId], "room:announce:initiative", {
                title: "You're up!",
                message: "It's your turn for combat. Good luck!",
            });
        }
        if (next.playerId != null){
            gm.send(this.sockets[next.playerId], "room:announce:initiative", {
                title: "You're on deck.",
                message: "Start planning your turn now. You're next in the initiative order.",
            });
        } else {
            this.broadcast("room:announce:initiative", {
                title: `${next.name} is on deck.`,
                message: `${next.name} is next in the initiative order.`,
            });
        }
    }
    
    public kickPlayer(id:string):void{
        if(id in this.sockets){
            gm.send(this.sockets[id], "room:ban");
            this.removeSocket(this.sockets[id], "KICKED");
        }
    }

    public async clearMap():Promise<void>{
        this.broadcast("room:tabletop:clear");
        //await logger.delete(this.code);
        //await logger.touch(this.code);
        this.showPawns = false;
        const op = set("games", this.code, "map", null);
        const op2 = set("games", this.code, "players", []);
        const op3 = set("games", this.code, "initiative", []);
        const op4 = set("games", this.code, "active_initiative", null);
        const ops = batch("games", this.code, [op, op2, op3, op4]);
        await this.dispatch(ops);
    }

    public async spawnNPC({ name, ac, hp, x, y, size }):Promise<void>{
        const id = randomUUID();
        const pawn:Pawn = {
            uid: id,
            x: x,
            y: y,
            room: this.code,
            name: name,
            ac: ac,
            hp: hp,
            fullHP: hp,
            size: size,
            rings: {
                red: false,
                orange: false,
                blue: false,
                white: false,
                purple: false,
                yellow: false,
                pink: false,
                green: false,
            },
        };
        const op = insert("pawns", id, pawn);
        console.log(`Room ${this.code} is spawning an NPC named ${name}`);
        await this.dispatch(op);
    }

    public async spawnMonster({ index, x, y, name, hp, ac, size }):Promise<void>{
        const id = randomUUID();
        const pawn:Pawn = {
            uid: id,
            x: x,
            y: y,
            hp: hp,
            ac: ac,
            room: this.code,
            monsterId: index,
            name: name,
            fullHP: hp,
            size: size,
            rings: {
                red: false,
                orange: false,
                blue: false,
                white: false,
                purple: false,
                yellow: false,
                pink: false,
                green: false,
            },
        };
        const op = insert("pawns", id, pawn);
        console.log(`Room ${this.code} is spawning a ${index}`);
        await this.dispatch(op);
    }

    public async spawnPlayers():Promise<void>{
        this.showPawns = true;
        const ids = [];
        for (const id in this.sockets){
            if (id !== this.gmId){
                ids.push(id);
                const pawn:Pawn = {
                    uid: randomUUID(),
                    x: 0,
                    y: 0,
                    room: this.code,
                    playerId: id,
                    name: this.sockets[id].name,
                    rings: {
                        red: false,
                        orange: false,
                        blue: false,
                        white: false,
                        purple: false,
                        yellow: false,
                        pink: false,
                        green: false,
                    },
                };
                await this.dispatch(insert("pawns", id, pawn));
            }
        }
        console.log(`Room ${this.code} is spawning players`);
        const op = set("games", this.code, "players", ids);
        await this.dispatch(op);
    }

    public async dispatch(op):Promise<void>{
        op.timestamp = new Date().getTime();
        await logger.write(op, this.code);
        for (const socket in this.sockets){
            gm.send(this.sockets[socket], "room:op", op);
        }
    }

    public broadcast(type: string, data = null):void{
        for (const socket in this.sockets){
            gm.send(this.sockets[socket], type, data);
        }
    }

    public async resetSocket(ws:Socket, lastId: string):Promise<void>{
        if (lastId in this.deadPlayers){
            ws.room = this.code;
            gm.reconnect(ws, ws.id, lastId);
            this.sockets[ws.id] = ws;
            ws.name = this.deadPlayers[ws.id].name;
            delete this.deadPlayers[ws.id];
            console.log(`Socket ${ws.id} reconnected to ${this.code}`);
            gm.send(ws, "room:join", {
                uid: this.code,
            });
            this.broadcast("room:announce:reconnect", `${ws.name} has returned.`);
            if (ws.id !== this.gmId){
                const op = set("players", ws.id, "active", true);
                await this.dispatch(op);
            }
        } else {
            // Player wasn't dead...
            gm.send(ws, "core:sync:fail");
        }
    }

    public async addSocket(ws:Socket, data = null):Promise<void>{
        this.sockets[ws.id] = ws;
        if (data?.token){
            await this.dispatch(data.token);
        }
        if (data?.name){
            ws.name = data.name;
            data.player.value.room = this.code;
            await this.dispatch(data.player);
        } else {
            ws.name = "Game Master";
        }
        console.log(`Socket ${ws.id} joined room ${this.code}`);
        this.broadcast("room:announce:join", `${ws.name} joined the room.`);
        if (this.showPawns){
            const pawn:Pawn = {
                uid: randomUUID(),
                x: 0,
                y: 0,
                room: this.code,
                playerId: ws.id,
                name: ws.name,
                rings: {
                    red: false,
                    orange: false,
                    blue: false,
                    white: false,
                    purple: false,
                    yellow: false,
                    pink: false,
                    green: false,
                },
            };
            await this.dispatch(insert("pawns", ws.id, pawn));
        }
        gm.send(ws, "room:join", {
            uid: this.code,
        });
    }

    public async removeSocket(ws:Socket, reason: ExitReason = "UNKNOWN"):Promise<void>{
        if (ws.id in this.sockets){
            this.deadPlayers[ws.id] = {
                name: ws.name,
            };
            delete this.sockets[ws.id];
            if (ws.id !== this.gmId){
                const op = set("players", ws.id, "active", false);
                await this.dispatch(op);
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
