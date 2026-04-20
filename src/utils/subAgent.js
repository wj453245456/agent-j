import agentLoop from "../agentLoop.js"
const WORKDIR = process.cwd();
import { tools, toolHandlers } from './tools.js';

const SUBAGENT_SYSTEM = `You are a coding subAgent at ${WORKDIR}.Complete the given task, then summarize your findings.`


export const task = {
    "name": "task", "description": "Spawn a subagent with fresh context. It shares the filesystem but not conversation history.",
    "input_schema": { "type": "object", "properties": { "prompt": { "type": "string" }, "description": { "type": "string", "description": "Short description of the task" } }, "required": ["prompt"] }
}
export const taskHandler = async ({ prompt }) => {
    const messages = [{ "role": "user", "content": prompt }]
    await agentLoop({ messages: messages, system: SUBAGENT_SYSTEM, tools, toolHandlers });
    toolHandlers.write_file({ filePath: './.historyMsg/subHistory.json', content: JSON.stringify(messages, null, 2) });
    const summary = messages[messages.length - 1]?.content[0]?.text || 'no summary'
    console.log('subAgent summary:', summary)
    return summary
}