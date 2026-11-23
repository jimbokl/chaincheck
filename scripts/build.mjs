import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const main=await readFile('worker/index.js','utf8'),adapter=await readFile('worker/non-evm.js','utf8');
await writeFile('dist/server/index.js',adapter+'\n'+main.replace("import {NON_EVM,nonEvmCheck,nonEvmWallet} from './non-evm.js';",''));await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Worker ESM');
