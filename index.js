const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ override: true });

const client = new Anthropic({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.API_KEY
});

const MODEL = process.env.MODEL_ID;
const WORKDIR = process.cwd();
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use bash to solve tasks. Act, don't explain.`;

const { TOOLS, ToolHandlers } = require('./tools');
async function agentLoop(messages) {
  const stream = await client.messages.stream({
    model: MODEL,
    system: SYSTEM,
    messages: messages,
    tools: TOOLS,
    max_tokens: 8000,
  });
  let fullResponse = '';
  let isToolCall = false;
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
    const results = [];
    isToolCall = true;
    for (const block of response.content) {
      if (!ToolHandlers[block.name]) {
        console.warn(`Unknown tool: ${block.name}`);
        continue;
      }
      console.log(`\x1b[33mToolCall ${block.name}\x1b[0m`);
      const output = ToolHandlers[block.name](block.input);
      console.log('ToolCall End');
      results.push({ type: "tool_result", tool_use_id: block.id, content: output });
    }
    messages.push({ role: "user", content: results });

  });

  // 监听错误事件
  stream.on("error", (error) => {
    console.error("\n错误:", error);
  });

  try {
    await stream.done();
    // 等待一小段时间，确保所有事件处理完成
    await new Promise(resolve => setTimeout(resolve, 100));
    if(!isToolCall) {
      console.log("\n对话完成");
    }else{
      return await agentLoop(messages);
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
    ToolHandlers.write_file({ filePath: './history.json', content: JSON.stringify(history, null, 2) });
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
