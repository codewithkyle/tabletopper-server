import gm from "./game";
import { Socket } from "./globals";

class Room {
    public id: string;
    public code: string;
    private sockets: {
        [id:string]: Socket,
    };

    constructor(code:string, id: string){
        this.code = code;
        this.id = id;
        this.sockets = {};
    }

    public addSocket(ws:Socket):void{
        this.sockets[ws.id] = ws;
    }

    public removeSocket(ws:Socket):void{
        if (ws.id in this.sockets){
            delete this.sockets[ws.id];
        }
        if (Object.keys(this.sockets).length === 0){
            gm.removeRoom(this.code);
        }
    }
}
export default Room;