import { unlink, writeFile } from "fs/promises";
import path from "path";
import { parentPort } from "worker_threads";

parentPort.on("message", async (e) => {
    try {
        const { op, log, data, uid } = e;
        const location = path.join(__dirname, log);
        switch (op){
            case "touch":
                await writeFile(location, "", { encoding: "utf-8", flag: "a"});
                parentPort.postMessage(uid);
                break;
            case "append":
                await writeFile(location, data + "\n", { encoding:"utf-8", flag: "a"});
                break;
            case "delete":
                await unlink(location);
                parentPort.postMessage(uid);
                break;
            default:
                break;
        }
    } catch (e) {}
});