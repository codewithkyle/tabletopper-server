export type Socket = {
    id: string,
    room: string,
    send: Function,
    name: string,
};

export type OP = "INSERT" | "DELETE" | "SET" | "UNSET" | "BATCH";

export interface OPCode{
    uid: string,
    table: string,
    op: OP,
    timestamp: number,
    key: string,
}

export interface Insert extends OPCode{
    value: any,
}

export interface Delete extends OPCode{}

export interface Set extends OPCode{
    keypath: string,
    value: any,
}

export interface Unset extends OPCode{
    keypath: string,
}

export interface Batch extends OPCode{
    ops: Array<OPCode>,
}

export type ExitReason = "UNKNOWN" | "KICKED" | "DC" | "QUIT";

export type Pawn = {
    x: number,
    y: number,
    uid: string,
    playerId?: string|null,
    monsterId?: string|null,
    token?: string|null,
    name: string,
    room: string,
    hp?: number,
    ac?: number,
    rings: {
        red: boolean,
        orange: boolean,
        blue: boolean,
        white: boolean,
        purple: boolean,
        yellow: boolean,
        pink: boolean,
        green: boolean,
    },
}
