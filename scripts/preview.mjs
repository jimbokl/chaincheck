import http from 'node:http';
import app from '../worker/index.js';
const server=http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const request=new Request('http://127.0.0.1:8787'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )});const response=await app.fetch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end(e.message);}});
server.listen(8787,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8787'));
