import { v4 as uuid } from "uuid";
import { Socket } from "./globals";
import Room from "./room";
import { GenerateCode } from "./utils";

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
    }

    public disconnect(ws:Socket):void{
        if (ws.id in this.sockets){
            if (ws.room && ws.room in this.rooms){
                this.rooms[ws.room].removeSocket(ws);
            }
            delete this.sockets[ws.id];
        }
    }

    public message(ws:Socket, message):void{
        const { type, data } = message;
        switch (type){
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

    public createRoom(ws:Socket):void{
        let code;
        do {
            code = GenerateCode();
        } while (code in this.rooms)
        const room = new Room(code, uuid());
        this.rooms[code] = room;
        ws.room = code;
        this.send(ws, "room:join", {
            code: code,
            id: room.id,
        });
    }

    public removeRoom(code:string):void{
        delete this.rooms[code];
    }
}
const gm = new GameManager();
export default gm;