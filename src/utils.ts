import dotenv from "dotenv";
dotenv.config();

export function RandomInt(min:number, max:number):number{
    return Math.floor(Math.random() * (max - min)) + min;
}

export function GenerateCode():string{
    const a = ["A", "B", "C", "D", "E", "F", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",];
    const b = [];
    for (let i = 0; i < 4; i++){
        b.push(a[RandomInt(0, a.length - 1)]);
    }
    return b.join("").toUpperCase();
}

/* Helper function converting Node.js buffer to ArrayBuffer */
function toArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

/* Either onAborted or simply finished request */
function onAbortedOrFinishedResponse(res, readStream) {
    if (res.id == -1) {
        console.log("ERROR! onAbortedOrFinishedResponse called twice for the same res!");
    } else {
        readStream.destroy();
    }
    res.id = -1;
}


/* Helper function to pipe the ReadaleStream over an Http responses */
export function pipeStreamOverResponse(res, readStream, totalSize) {
    readStream.on('data', (chunk) => {
        /* We only take standard V8 units of data */
        const ab = toArrayBuffer(chunk);

        /* Store where we are, globally, in our response */
        let lastOffset = res.getWriteOffset();

        /* Streaming a chunk returns whether that chunk was sent, and if that chunk was last */
        let [ok, done] = res.tryEnd(ab, totalSize);

        /* Did we successfully send last chunk? */
        if (done) {
            onAbortedOrFinishedResponse(res, readStream);
        } else if (!ok) {
            /* If we could not send this chunk, pause */
            readStream.pause();

            /* Save unsent chunk for when we can send it */
            res.ab = ab;
            res.abOffset = lastOffset;

            /* Register async handlers for drainage */
            res.onWritable((offset) => {
                /* Here the timeout is off, we can spend as much time before calling tryEnd we want to */

                /* On failure the timeout will start */
                let [ok, done] = res.tryEnd(res.ab.slice(offset - res.abOffset), totalSize);
                if (done) {
                    onAbortedOrFinishedResponse(res, readStream);
                } else if (ok) {
                    /* We sent a chunk and it was not the last one, so let's resume reading.
                    * Timeout is still disabled, so we can spend any amount of time waiting
                    * for more chunks to send. */
                    readStream.resume();
                }

                /* We always have to return true/false in onWritable.
                * If you did not send anything, return true for success. */
                return ok;
            });
        }

    }).on('error', () => {
        /* Todo: handle errors of the stream, probably good to simply close the response */
        console.log('Unhandled read error from Node.js, you need to handle this!');
    });

    /* If you plan to asyncronously respond later on, you MUST listen to onAborted BEFORE returning */
    res.onAborted(() => {
        onAbortedOrFinishedResponse(res, readStream);
    });
}

export function setHeaders(res):void{
    res.writeHeader("Access-Control-Allow-Origin", process.env.ORIGIN);
    res.writeHeader("Access-Control-Allow-Credentials", "true");
}