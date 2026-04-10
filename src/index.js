const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ override: true });

const client = new Anthropic({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.API_KEY
});

const MODEL = process.env.MODEL_ID;
const WORKDIR = process.cwd();
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done.
Prefer tools over prose.`;

const { tools, toolHandlers } = require('./utils/tools');
const { type } = require('os');
const { text } = require('stream/consumers');
async function agentLoop(messages, unCallTodoRound = 0) {
  const stream = await client.messages.stream({
    model: MODEL,
    system: SYSTEM,
    messages: messages,
    tools: tools,
    max_tokens: 8000,
  });
  let fullResponse = '';
  let isToolCall = false;
  let isTodoCall = false;
  const results = [];

  // 监听文本事件
  stream.on("text", (text) => {
    process.stdout.write(text);
    fullResponse += text;
  });

  // 监听消息完成事件
  stream.on("message", (response) => {
    messages.push({ role: "assistant", content: response.content });
    const stop_reason = response.stop_reason;
    if (stop_reason !== "tool_use") {
      console.log("\n使用统计:", response.usage);
      return
    }
    isToolCall = true;
    for (const block of response.content) {
      if (block.name === 'todo') {
        isTodoCall = true;
      }
      if (!toolHandlers[block.name]) {
        console.warn(`Unknown tool: ${block.name}`);
        continue;
      }
      console.log(`\x1b[33mToolCall ${block.name}\x1b[0m`);
      const output = toolHandlers[block.name](block.input);
      console.log('ToolCall End');
      results.push({ type: "tool_result", tool_use_id: block.id, content: output });
    }

  });

  // 监听错误事件
  stream.on("error", (error) => {
    console.error("\n错误:", error);
  });

  try {
    await stream.done();
    // 等待一小段时间，确保所有事件处理完成
    await new Promise(resolve => setTimeout(resolve, 100));
    if (isTodoCall) {
      unCallTodoRound = 0
    } else {
      unCallTodoRound++;
    }
    if (unCallTodoRound >= 3) {
      results.push({ type: "text", text: "<reminder>Please update todo.</reminder>" });
    }
    messages.push({ role: "user", content: results });

    if (!isToolCall) {
      console.log("\n对话完成");
    } else {
      return await agentLoop(messages, unCallTodoRound);
    }
  } catch (error) {
    console.error("流处理失败:", error);
    throw error;
  }
}


if (require.main === module) {
  const readline = require('readline');
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
      await agentLoop(history);

      console.log();
      prompt();
    });
  }
  prompt();

}
