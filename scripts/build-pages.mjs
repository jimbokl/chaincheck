import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import app from '../worker/index.js';
await mkdir('docs/worker',{recursive:true});
const response=await app.fetch(new Request('https://chaincheck.local/'));
let html=await response.text();
// Load the local request engine before running application event handlers.
html=html.replace('<script>','<script type="module">\nimport app from \'./worker/index.js\';\nconst upstreamFetch=globalThis.fetch.bind(globalThis);\nglobalThis.fetch=async(input,options)=>{const p=typeof input===\'string\'?input:\'\';if(p===\'/api/check\'||p===\'/api/wallets\')return app.fetch(new Request(new URL(p,location.origin),options));return upstreamFetch(input,options);};\n');
html=html.replace('Только чтение. Подключать кошелёк не требуется.','GitHub Pages · запросы выполняются в вашем браузере. Только чтение. Подключать кошелёк не требуется.');
await writeFile('docs/index.html',html);await writeFile('docs/.nojekyll','');
await copyFile('worker/index.js','docs/worker/index.js');await copyFile('worker/non-evm.js','docs/worker/non-evm.js');
console.log('Built GitHub Pages in docs/');
