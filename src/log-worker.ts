import { rm, writeFile } from "fs/promises";
import path from "path";
import { parentPort } from "worker_threads";

parentPort.on("message", async (e) => {
    try {
        const { op, log, data } = e;
        const location = path.join(__dirname, log);
        switch (op){
            case "touch":
                await writeFile(location, "", { encoding: "utf-8", flag: "a"});
                break;
            case "append":
                await writeFile(location, data, { encoding:"utf-8", flag: "a"});
                break;
            case "delete":
                await rm(location);
                break;
            default:
                break;
        }
    } catch (e) {}
});