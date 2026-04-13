

import readline from 'readline';

import agentLoop from './agentLoop.js';
import { tools, toolHandlers } from './utils/tools.js';
import { task, taskHandler } from './utils/subAgent.js';
const WORKDIR = process.cwd();


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const history = [];

function prompt() {
  toolHandlers.write_file({ filePath: './history.json', content: JSON.stringify(history, null, 2) });
  rl.question('\x1b[36magent-j: >> \x1b[0m', async (query) => {
    if (query.trim().toLowerCase() === 'q' || query.trim().toLowerCase() === 'exit' || query.trim() === '') {
      rl.close();
      return;
    }

    history.push({ role: "user", content: query });
    //task 主agent 调度子agent
    const SYSTEM = `You are a coding agent at ${WORKDIR}.Use the task tool to delegate exploration or subtasks`;
    await agentLoop({ messages: history, system: SYSTEM, tools: [task], toolHandlers: { task: taskHandler } });
    console.log();
    prompt();
  });
}
prompt();


