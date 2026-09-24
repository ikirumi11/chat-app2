const http=require("http");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const WebSocket=require("ws");

const PORT=Number(process.env.PORT||3000);
const ROOT=path.join(__dirname,"public");
const peers=new Map();
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".ico":"image/x-icon"};

function cleanProfile(p){
  const name=String(p&&p.name||"Guest").replace(/\s+/g," ").trim().slice(0,28)||"Guest";
  const avatar=typeof(p&&p.avatar)==="string"&&p.avatar.length<900000?p.avatar:"";
  const avatarIndex=Math.max(1,Math.min(8,Number(p&&p.avatarIndex)||1));
  return {name,avatar,avatarIndex,sharing:!!(p&&p.sharing)};
}
function send(ws,msg){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg))}
function broadcast(msg,except){
  const raw=JSON.stringify(msg);
  for(const p of peers.values())if(p.ws!==except&&p.ws.readyState===WebSocket.OPEN)p.ws.send(raw)
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://"+(req.headers.host||"localhost"));
  if(url.pathname==="/health"){res.writeHead(200,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});return res.end(JSON.stringify({ok:true,peers:peers.size}))}
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==="/")pathname="/index.html";
  const file=path.normalize(path.join(__dirname,pathname));
  if(!file.startsWith(__dirname)){res.writeHead(403);return res.end("Forbidden")}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});return res.end("Not found")}
    res.writeHead(200,{"content-type":mime[path.extname(file)]||"application/octet-stream","cache-control":pathname==="/index.html"?"no-store":"public, max-age=3600"});
    res.end(data)
  })
});

const wss=new WebSocket.Server({noServer:true});
server.on("upgrade",(req,socket,head)=>{
  const url=new URL(req.url,"http://"+(req.headers.host||"localhost"));
  if(url.pathname!=="/signal")return socket.destroy();
  wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,req))
});

wss.on("connection",ws=>{
  const id=crypto.randomUUID();
  const item={id,ws,profile:{name:"Guest",avatar:"",avatarIndex:1,sharing:false}};
  peers.set(id,item);

  ws.on("message",raw=>{
    let msg;try{msg=JSON.parse(raw.toString())}catch{return}
    if(msg.type==="join"){
      item.profile=cleanProfile(msg.profile);
      const list=Array.from(peers.values()).filter(p=>p.id!==id).map(p=>({id:p.id,profile:p.profile}));
      send(ws,{type:"welcome",id:id,peers:list});
      broadcast({type:"peer-joined",id:id,profile:item.profile},ws);
      return;
    }
    if(msg.type==="profile"){
      item.profile=cleanProfile(msg.profile);
      broadcast({type:"peer-profile",id:id,profile:item.profile},ws);
      return;
    }
    if(["offer","answer","ice","screen-offer","screen-answer","screen-ice"].includes(msg.type)){
      const target=peers.get(String(msg.to||""));
      if(!target)return;
      send(target.ws,{type:msg.type,from:id,profile:item.profile,description:msg.description,candidate:msg.candidate})
    }
  });

  ws.on("close",()=>{
    if(!peers.has(id))return;
    peers.delete(id);
    broadcast({type:"peer-left",id:id})
  });
  ws.on("error",()=>{try{ws.close()}catch{}})
});

server.listen(PORT,()=>console.log("DropLink listening on port "+PORT));