import { randomUUID } from "crypto";
import type { Insert, Delete, Set, Unset, OPCode } from "globals";

export function insert(table:string, key:string, value:any):Insert{
    return {
        uid: randomUUID(),
        op: "INSERT",
        table: table,
        key: key,
        value: value,
        timestamp: new Date().getTime(),
    };
}

export function del(table:string, key:string):Delete{
    return {
        uid: randomUUID(),
        op: "DELETE",
        table: table,
        key: key,
        timestamp: new Date().getTime(),
    };
}

export function set(table:string, key:string, keypath:string, value:any):Set{
    return {
        uid: randomUUID(),
        op: "SET",
        table: table,
        key: key,
        keypath: keypath,
        value: value,
        timestamp: new Date().getTime(),
    };
}

export function unset(table:string, key:string, keypath:string):Unset{
    return {
        uid: randomUUID(),
        op: "UNSET",
        table: table,
        key: key,
        keypath: keypath,
        timestamp: new Date().getTime(),
    };
}

