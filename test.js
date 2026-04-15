import {microCompact, autoCompact} from './src/utils/compact.js';
import fs from 'fs';

const history = JSON.parse(fs.readFileSync('./historyMsg/history.json', 'utf8'));
const compact = await autoCompact(history);
console.log(compact)
fs.writeFileSync('./historyMsg/historyAutopCompact.json', JSON.stringify(compact, null, 2));
