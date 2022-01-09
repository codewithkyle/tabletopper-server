import { v4 as uuid } from "uuid";
import Room from "./room";

type Socket = {
    id: string,
    room: string,
};

class SocketManager {
    private sockets: Array<Socket>;
    private rooms: Array<Room>;

    constructor(){
        this.sockets = [];
        this.rooms = [];
    }

    public connect(ws){
        ws.id = uuid();
        this.sockets.push(ws);
    }

    public disconnect(ws:Socket){
        for (let i = this.sockets.length - 1; i >= 0; i--){
            if (this.sockets[i].id === ws.id){
                this.sockets.splice(i, 1);
                break;
            }
        }
    }

    public message(ws:Socket, message){
        const { type, data } = message;
        switch (type){
            case "create:room":
                const room = new Room("abcd", uuid());
                this.rooms.push(room);
                ws.room = room.id;
                break;
            default:
                // TODO: log unexpected message types
                break;
        }
    }
}
export default SocketManager;