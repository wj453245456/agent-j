import dotenv from 'dotenv';
dotenv.config({ override: true })
import Anthropic from '@anthropic-ai/sdk';
const MODEL = process.env.MODEL_ID;
import { microCompact, autoCompact, THRESHOLD, estimateTokens } from './utils/compact.js';
import background from './utils/background.js';
const client = new Anthropic({
    baseURL: process.env.BASE_URL,
    apiKey: process.env.API_KEY
});
async function agentLoop({ messages = [], unCallTodoRound = 0, system = '', tools = [], toolHandlers = {} }) {
    const notifs = background.drainNotifications()

    if (notifs && messages) {
        const notif_text = notifs.map(n => `[bg:${n['task_id']}] ${n['status']}: ${n['result']}`).join('\n')
        console.log(notif_text)
        messages.push({ "role": "user", "content": `<background-results>\n${notif_text}\n</background-results>` })
    }
    microCompact(messages);
    if (estimateTokens(messages) > THRESHOLD) {
        console.log(`[autoCompact] ${estimateTokens(messages)}`);
        await autoCompact(messages);
    }

    const stream = await client.messages.stream({
        model: MODEL,
        system: system,
        messages: messages,
        tools: tools,
        max_tokens: 8000,
    });
    let isToolCall = false;
    let isTodoCall = false;
    let isManualCompact = false;
    const results = [];
    let messageProcessingPromise = new Promise(resolve => {

        // 监听文本事件
        stream.on("text", (text) => {
            process.stdout.write(text);
        });

        // 监听消息完成事件
        stream.on("message", async (response) => {
            messages.push({ role: "assistant", content: response.content });
            const stop_reason = response.stop_reason;
            if (stop_reason !== "tool_use") {
                console.log("\n使用统计:", response.usage);
                resolve()
                return
            }
            isToolCall = true;
            for (const block of response.content) {
                if (block.name === 'todo') {
                    isTodoCall = true;
                } else if (block.name === 'compact') {
                    isManualCompact = true;
                }
                if (!toolHandlers[block.name]) {
                    console.warn(`Unknown tool: ${block.name}`);
                    continue;
                }
                console.log(`\x1b[33mToolCall ${block.name}\x1b[0m`);
                const output = await toolHandlers[block.name](block.input);
                console.log(`\x1b[33mToolCall ${block.name} End--resultLen:\x1b[0m${output.length}`);
                results.push({ type: "tool_result", tool_use_id: block.id, content: output });
            }
            if (isManualCompact) {
                console.log(`[autoCompact] ${estimateTokens(messages)}`);
                await autoCompact(messages);
            }
            resolve()
        });

        // 监听错误事件
        stream.on("error", (error) => {
            console.error("\n错误:", error);
            resolve()
        });
    })
    try {
        await stream.done();
        // 确保所有事件处理完成
        await messageProcessingPromise
        if (isTodoCall) {
            unCallTodoRound = 0
        } else {
            unCallTodoRound++;
        }
        if (unCallTodoRound >= 3) {
            results.push({ type: "text", text: "<reminder>Please update todo.</reminder>" });
        }

        if (!isToolCall) {
            console.log("\n对话完成");
            return;
        } else {
            messages.push({ role: "user", content: results });

            return await agentLoop({ messages, system, tools, toolHandlers, unCallTodoRound });
        }
    } catch (error) {
        console.error("流处理失败:", error);
        throw error;
    }
}

export default agentLoop;