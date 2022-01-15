import logger from "./lumberjack.js";
import { v4 as uuid } from "uuid";
import { Socket } from "./globals.js";
import Room from "./room.js";
import { GenerateCode } from "./utils.js";

class GameManager {
    private sockets: {
        [id:string]: Socket,
    };
    private rooms: {
        [code:string]: Room,
    }

    constructor(){
        this.sockets = {};
        this.rooms = {};
    }

    public connect(ws):void{
        ws.id = uuid();
        this.sockets[ws.id] = ws;
        this.send(ws, "core:init", {
            id: ws.id,
        });
        console.log(`Socket connected: ${ws.id}`);
    }

    public disconnect(ws:Socket):void{
        if (ws.id in this.sockets){
            if (ws.room && ws.room in this.rooms){
                this.rooms[ws.room].removeSocket(ws);
            }
            delete this.sockets[ws.id];
            console.log(`Socket disconnected: ${ws.id}`);
        }
    }

    public message(ws:Socket, message):void{
        const { type, data } = message;
        const room = this.rooms?.[ws?.room] ?? null;
        switch (type){
            case "room:tabletop:clear":
                if (room){
                    room.clearPawns();
                } else {
                    this.error(ws, "Action Failed", `Room ${ws.room} is no longer available.`);
                }
                break;
            case "room:tabletop:spawn:players":
                if (room){
                    room.spawnPlayers();
                } else {
                    this.error(ws, "Action Failed", `Room ${ws.room} is no longer available.`);
                }
                break;
            case "room:op":
                if (room){
                    room.dispatch(data);
                } else {
                    this.error(ws, "Action Failed", `Room ${ws.room} is no longer available.`);
                }
                break;
            case "room:join":
                if (room){
                    room.addSocket(ws, data);
                }
                else {
                    this.error(ws, "Failed to Join", `Room ${ws.room} is no longer available.`);
                }
                break;
            case "room:check":
                const code = data.code;
                if (code in this.rooms){
                   if (this.rooms[code].locked){
                        this.error(ws, "Room Locked", `Room ${code} is locked. Ask the Game Master to unlock the room and try again.`);
                   } else {
                        ws.room = code;
                        this.send(ws, "character:getDetails");
                   }
                } else {
                    this.error(ws, "Action Failed", `Room ${code} is no longer available.`);
                }
                break;
            case "room:unlock":
                if (room){
                    room.unlock(ws);
                } else {
                    this.error(ws, "Action Failed", "You cannot unlock a room that doesn't exist.");
                }
                break;
            case "room:lock":
                if (room){
                    room.lock(ws);
                } else {
                    this.error(ws, "Action Failed", "You cannot lock a room that doesn't exist.");
                }
                break;
            case "core:sync":
                if (data.room !== null && data.room in this.rooms && data.prevId === this.rooms[data.room].gmId){
                    this.rooms[data.room].updateGM(ws);
                }
                else if (data.room !== null && data.room in this.rooms){
                    if (this.rooms[data.room].locked){
                        this.error(ws, "Room Locked", "Failed to reconnect. Ask the Game Master to unlock the room.");
                    }
                    else {
                        this.rooms[data.room].addSocket(ws);
                    }
                }
                break;
            case "create:room":
                this.createRoom(ws); 
                break;
            default:
                // TODO: log unexpected message types
                break;
        }
    }

    public send(ws:Socket, type:string, data:any = null):void{
        ws.send(JSON.stringify({
            type: type,
            data: data,
        }));
    }

    public error(ws:Socket, title:string, message:string):void{
        this.send(ws, "core:error", {
            title: title,
            message: message,
        });
    }

    public createRoom(ws:Socket):void{
        let code;
        do {
            code = GenerateCode();
        } while (code in this.rooms)
        const room = new Room(code, uuid(), ws.id);
        room.addSocket(ws);
        this.rooms[code] = room;
        ws.room = code;
        console.log(`Socket ${ws.id} created room ${code}`);
        logger.touch(code);
    }

    public removeRoom(code:string):void{
        delete this.rooms[code];
        console.log(`Room ${code} was removed`);
        logger.delete(code);
    }
}
const gm = new GameManager();
export default gm;