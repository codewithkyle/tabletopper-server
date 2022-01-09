import gm from "./game";
import { Socket } from "./globals";

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

    public addSocket(ws:Socket):void{
        this.sockets[ws.id] = ws;
        gm.send(ws, "room:join", {
            code: this.code,
            id: this.id,
        });
    }

    public removeSocket(ws:Socket):void{
        if (ws.id in this.sockets){
            delete this.sockets[ws.id];
        }
        if (Object.keys(this.sockets).length === 0){
            gm.removeRoom(this.code);
        }
    }

    public updateGM(ws:Socket){
        this.gmId = ws.id;
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