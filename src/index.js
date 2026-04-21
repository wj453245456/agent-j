

import readline from 'readline';

import agentLoop from './agentLoop.js';
import { tools, toolHandlers } from './utils/tools.js';
import { task, taskHandler } from './utils/subAgent.js';
const WORKDIR = process.cwd();
import skillLoader from './utils/skillLoader.js';




const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const history = [];

function prompt() {
  toolHandlers.write_file({ filePath: './.historyMsg/history.json', content: JSON.stringify(history, null, 2) });
  rl.question('\x1b[36magent-j: >> \x1b[0m', async (query) => {
    if (query.trim().toLowerCase() === 'q' || query.trim().toLowerCase() === 'exit' || query.trim() === '') {
      rl.close();
      return;
    }

    history.push({ role: "user", content: query });
    //task 主agent 调度子agent
    const SYSTEM = `You are a coding agent at ${WORKDIR}.
    Use task tools to plan and track work;
    Use background_run for long-running commands.
    Use load_skill to access specialized knowledge before tackling unfamiliar topics.
Skills available:
${skillLoader.getDescriptions()}"`;
    await agentLoop({
      messages: history, system: SYSTEM, tools: tools.concat([task]), toolHandlers: {
        ...toolHandlers,
        task: taskHandler
      }
    });
    console.log();
    prompt();
  });
}
prompt();


