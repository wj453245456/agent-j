const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKDIR = process.cwd();
const ToDoTool = require('./todo');
const todoTool = new ToDoTool();


function safePath(p) {
    const resolvedPath = path.resolve(WORKDIR, p);
    const relativePath = path.relative(WORKDIR, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Path escapes workspace: ${p}`);
    }
    return resolvedPath;
}

function runBash({ command }) {
    const dangerous = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];
    if (dangerous.some(d => command.includes(d))) {
        return "Error: Dangerous command blocked";
    }
    try {
        const result = execSync(command, {
            cwd: WORKDIR,
            encoding: 'utf8',
            timeout: 120000
        });
        console.log(`Run ${command}`);
        console.log(result);
        const out = result.trim();
        return out ? out.substring(0, 50000) : "(no output)";
    } catch (error) {
        if (error.killed && error.signal === 'SIGTERM') {
            return "Error: Timeout (120s)";
        }
        return `${error.message}`;
    }
}

function runRead({ filePath, limit }) {
    try {
        const safeFilePath = safePath(filePath);
        const text = fs.readFileSync(safeFilePath, 'utf8');
        const lines = text.split('\n');
        if (limit && limit < lines.length) {
            lines.splice(limit, lines.length - limit, `... (${lines.length - limit} more lines)`);
        }
        console.log(`Read ${safeFilePath} with ${lines.length} lines`);
        return lines.join('\n').substring(0, 50000);
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

function runWrite({ filePath, content }) {
    try {
        const safeFilePath = safePath(filePath);
        const dirPath = path.dirname(safeFilePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(safeFilePath, content, 'utf8');
        console.log(`Wrote ${content.length} bytes to ${safeFilePath}`);
        return `Wrote ${content.length} bytes to ${filePath}`;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

function runEdit({ filePath, oldText, newText }) {
    try {
        const safeFilePath = safePath(filePath);
        const content = fs.readFileSync(safeFilePath, 'utf8');
        if (!content.includes(oldText)) {
            return `Error: Text not found in ${filePath}`;
        }
        const newContent = content.replace(oldText, newText);
        fs.writeFileSync(safeFilePath, newContent, 'utf8');
        console.log(`Edited ${safeFilePath} ${oldText.length} bytes replaced ${newContent.length} bytes`);
        return `Edited ${filePath}`;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}


const TOOLS = [{
    name: "bash",
    description: "Run a shell command.",
    input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] }
},
{
    name: "read_file", description: "Read file contents.",
    input_schema: { type: "object", properties: { "filePath": { "type": "string" }, "limit": { "type": "integer" } }, required: ["filePath"] }
},
{
    name: "write_file", description: "Write content to file.",
    input_schema: { type: "object", properties: { filePath: { type: "string" }, content: { type: "string" } }, required: ["filePath", "content"] }
},
{
    name: "edit_file", description: "Replace exact text in file.",
    input_schema: { type: "object", properties: { filePath: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["filePath", "old_text", "new_text"] }
},
{
    name: "todo", description: "Update task list. Track progress on multi-step tasks.",
    input_schema: {
        type: "object", properties: { tasks: { type: "array", items: { type: "object" }, properties: { id: { type: "string" }, content: { type: "string" }, status: { type: "string", enum: ["pending", "in_progress", "completed"] } }, required: ["id", "text", "status"] } }, required: ["tasks"]
    }
}
];
module.exports = {
    tools: TOOLS,
    toolHandlers: {
        bash: runBash,
        read_file: runRead,
        write_file: runWrite,
        edit_file: runEdit,
        todo: todoTool.update
    }
};