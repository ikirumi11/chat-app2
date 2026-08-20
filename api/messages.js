const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {

    let filePath;

    if (req.url === "/" || req.url === "/index.html") {
        filePath = path.join(__dirname, "index.html");
    } else {
        res.writeHead(404);
        res.end("Not found");
        return;
    }

    fs.readFile(filePath, (error, data) => {

        if (error) {
            res.writeHead(500);
            res.end("Could not load page.");
            return;
        }

        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        res.end(data);
    });
});


const wss = new WebSocket.Server({
    server
});


const clients = new Map();


wss.on("connection", socket => {

    const id =
        Math.random()
        .toString(36)
        .substring(2) +
        Date.now().toString(36);


    clients.set(id, socket);


    socket.send(JSON.stringify({
        type: "connected",
        serverId: id
    }));


    socket.on("message", raw => {

        let data;

        try {
            data = JSON.parse(
                raw.toString()
            );
        } catch {
            return;
        }


        /*
         * Targeted WebRTC message.
         */

        if (data.target) {

            for (
                const [
                    clientId,
                    client
                ] of clients
            ) {

                /*
                 * We identify users using
                 * the browser's device ID.
                 */

                if (
                    client.readyState !==
                    WebSocket.OPEN
                ) {
                    continue;
                }


                /*
                 * The sender's device ID is
                 * data.from/userId.
                 *
                 * We don't actually know the
                 * client's device ID until it
                 * sends a message, so store it.
                 */

                if (
                    data.userId &&
                    client.deviceId ===
                    data.target
                ) {

                    client.send(
                        JSON.stringify(data)
                    );

                }

                if (
                    data.from &&
                    client.deviceId ===
                    data.target
                ) {

                    client.send(
                        JSON.stringify(data)
                    );

                }

            }

            return;
        }


        /*
         * Register device ID.
         */

        if (
            data.type === "register" &&
            data.userId
        ) {

            socket.deviceId =
                data.userId;

            return;
        }


        /*
         * Host announcement.
         *
         * Broadcast to everybody else.
         */

        if (
            data.type === "host"
        ) {

            socket.deviceId =
                data.userId;

            broadcastExcept(
                socket,
                data
            );

            return;
        }


        /*
         * Host stopped.
         */

        if (
            data.type === "host-stop"
        ) {

            socket.deviceId =
                data.userId;

            broadcastExcept(
                socket,
                data
            );

            return;
        }


        /*
         * Viewer is ready.
         */

        if (
            data.type === "viewer-ready"
        ) {

            socket.deviceId =
                data.userId;

            sendToDevice(
                data.target,
                data
            );

            return;
        }


        /*
         * WebRTC offer.
         */

        if (
            data.type === "offer"
        ) {

            socket.deviceId =
                data.from;

            sendToDevice(
                data.target,
                data
            );

            return;
        }


        /*
         * WebRTC answer.
         */

        if (
            data.type === "answer"
        ) {

            socket.deviceId =
                data.from;

            sendToDevice(
                data.target,
                data
            );

            return;
        }


        /*
         * ICE candidate.
         */

        if (
            data.type === "ice"
        ) {

            socket.deviceId =
                data.from;

            sendToDevice(
                data.target,
                data
            );

            return;
        }

    });


    socket.on("close", () => {

        clients.delete(id);

    });

});


function sendToDevice(
    deviceId,
    data
) {

    if (!deviceId)
        return;


    for (
        const [
            id,
            client
        ] of clients
    ) {

        if (
            client.deviceId ===
            deviceId &&
            client.readyState ===
            WebSocket.OPEN
        ) {

            client.send(
                JSON.stringify(data)
            );

            return;
        }

    }

}


function broadcastExcept(
    sender,
    data
) {

    for (
        const [
            id,
            client
        ] of clients
    ) {

        if (
            client !== sender &&
            client.readyState ===
            WebSocket.OPEN
        ) {

            client.send(
                JSON.stringify(data)
            );

        }

    }

}


server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Chat server running on port ${PORT}`
        );

    }
);