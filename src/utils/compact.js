import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const WORKDIR = process.cwd();
const THRESHOLD = 50000;
const TRANSCRIPT_DIR = path.join(WORKDIR, '.transcripts');
const KEEP_RECENT = 3;
const PRESERVE_RESULT_TOOLS = ["read_file"];
const MODEL = process.env.MODEL_ID;

const client = new Anthropic({
    baseURL: process.env.BASE_URL,
    apiKey: process.env.API_KEY
});

function estimateTokens(messages) {
    return Math.floor(JSON.stringify(messages).length / 4);
}

function microCompact(messages) {
    if (messages.length <= KEEP_RECENT * 2) {
        return messages;
    }
    const toolResults = [];
    messages.forEach((msg, msgIdx) => {
        if (msg.role === "user" && Array.isArray(msg.content)) {
            msg.content.forEach((part, partIdx) => {
                if (typeof part === 'object' && part.type === "tool_result") {
                    toolResults.push([msgIdx, partIdx, part]);
                }
            });
        }
    });

    if (toolResults.length <= KEEP_RECENT) {
        return messages;
    }

    const toolNameMap = {};
    messages.forEach((msg) => {
        if (msg.role === "assistant") {
            const content = msg.content || [];
            if (Array.isArray(content)) {
                content.forEach((block) => {
                    if (block.type === "tool_use") {
                        toolNameMap[block.id] = block.name;
                    }
                });
            }
        }
    });

    const toClear = toolResults.slice(0, -KEEP_RECENT);
    toClear.forEach(([msgIdx, partIdx, result]) => {
        if (typeof result.content !== 'string' || result.content.length <= 100) {
            return;
        }
        const toolId = result.tool_use_id || "";
        const toolName = toolNameMap[toolId] || "unknown";
        if (PRESERVE_RESULT_TOOLS.includes(toolName)) {
            return;
        }
        result.content = `[Previous: used ${toolName}]`;
    });

    return messages;
}

async function autoCompact(messages) {
    if (!fs.existsSync(TRANSCRIPT_DIR)) {
        fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
    }

    const transcriptPath = path.join(TRANSCRIPT_DIR, `transcript_${Math.floor(Date.now() / 1000)}.jsonl`);
    const transcriptContent = messages.map(msg => JSON.stringify(msg)).join('\n');
    fs.writeFileSync(transcriptPath, transcriptContent);
    console.log(`[transcript saved: ${transcriptPath}]`);

    const conversationText = JSON.stringify(messages).slice(-80000);
    const response = await client.messages.create({
        model: MODEL,
        messages: [{
            role: "user",
            content: "Summarize this conversation for continuity. Include: " +
                "1) What was accomplished, 2) Current state, 3) Key decisions made. " +
                "Be concise but preserve critical details.\n\n" + conversationText
        }],
        max_tokens: 2000,
    });

    let summary = "";
    for (const block of response.content) {
        if (block.text) {
            summary = block.text;
            break;
        }
    }

    if (!summary) {
        summary = "No summary generated.";
    }
    messages.length = 0;
    messages.push({
        role: "user",
        content: `[Conversation compressed. Transcript: ${transcriptPath}]\n\n${summary}`
    });
}

export {
    estimateTokens,
    microCompact,
    autoCompact,
    THRESHOLD
};