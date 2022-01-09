class Room {
    public id: string;
    public code: string;

    constructor(code:string, id: string){
        this.code = code;
        this.id = id;
    }
}
export default Room;