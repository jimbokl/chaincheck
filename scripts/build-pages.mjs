import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import app from '../worker/index.js';
await mkdir('docs/worker',{recursive:true});
const response=await app.fetch(new Request('https://chaincheck.local/'));
let html=await response.text();
const main=await readFile('worker/index.js','utf8'),adapter=await readFile('worker/non-evm.js','utf8'),version=createHash('sha256').update(main+adapter).digest('hex').slice(0,16);
// Load the local request engine before running application event handlers.
html=html.replace('<script>','<script type="module">\nimport app from \'./worker/index.js\';\nconst upstreamFetch=globalThis.fetch.bind(globalThis);\nglobalThis.fetch=async(input,options)=>{const p=typeof input===\'string\'?input:\'\';if(p===\'/api/check\'||p===\'/api/wallets\')return app.fetch(new Request(new URL(p,location.origin),options));return upstreamFetch(input,options);};\n');
html=html.replace('Только чтение. Подключать кошелёк не требуется.','GitHub Pages · запросы выполняются в вашем браузере. Только чтение. Подключать кошелёк не требуется.');
html=html.replace("import app from './worker/index.js';","import app from './worker/index.js?v="+version+"';");
await writeFile('docs/index.html',html);await writeFile('docs/.nojekyll','');
await writeFile('docs/worker/index.js',main.replace("from './non-evm.js'","from './non-evm.js?v="+version+"'"));await writeFile('docs/worker/non-evm.js',adapter);
console.log('Built GitHub Pages in docs/');
