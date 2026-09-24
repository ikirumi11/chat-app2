# DropLink

Temporary school chat with one automatic shared P2P room.

## Architecture

The Node server is a signaling and discovery server only. It keeps the active peer list in memory, sends peer IDs and WebRTC negotiation messages, and never receives the chat messages or file data.

Each browser creates direct WebRTC connections to the other browsers. Text, images and files use reliable ordered WebRTC data channels. Screen sharing and captured screen audio use direct WebRTC media connections.

There are no room codes and no accounts.

## Run

```
npm install
npm start
```

Open http://localhost:3000.

For devices on the internet, deploy the Node server on an HTTPS host so the browser can use WSS. WebRTC can need TURN on restrictive school networks; STUN servers are included for normal NAT traversal.