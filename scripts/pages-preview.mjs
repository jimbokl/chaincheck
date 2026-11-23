import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('docs');
http.createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/'||p==='/chaincheck/')p='/index.html';else if(p.startsWith('/chaincheck/'))p=p.slice('/chaincheck'.length);const full=resolve(root,'.'+p);if(!full.startsWith(root+'\\')&&!full.startsWith(root+'/'))throw Error('Not found');const bytes=await readFile(full);res.writeHead(200,{'content-type':extname(full)==='.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8','cache-control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}}).listen(8788,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8788/chaincheck/'));
