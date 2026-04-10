const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORKDIR = process.cwd();

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
];

function safePath(p) {
    const resolvedPath = path.resolve(WORKDIR, p);
    const relativePath = path.relative(WORKDIR, resolvedPath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Path escapes workspace: ${p}`);
    }
    return resolvedPath;
}

function runBash({command}) {
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
        const out = result.trim();
        return out ? out.substring(0, 50000) : "(no output)";
    } catch (error) {
        if (error.killed && error.signal === 'SIGTERM') {
            return "Error: Timeout (120s)";
        }
        return `${error.message}`;
    }
}

function runRead({filePath, limit}) {
    try {
        const safeFilePath = safePath(filePath);
        const text = fs.readFileSync(safeFilePath, 'utf8');
        const lines = text.split('\n');
        if (limit && limit < lines.length) {
            lines.splice(limit, lines.length - limit, `... (${lines.length - limit} more lines)`);
        }
        return lines.join('\n').substring(0, 50000);
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

function runWrite({filePath, content}) {
    try {
        const safeFilePath = safePath(filePath);
        const dirPath = path.dirname(safeFilePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(safeFilePath, content, 'utf8');
        return `Wrote ${content.length} bytes to ${filePath}`;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

function runEdit({filePath, oldText, newText}) {
    try {
        const safeFilePath = safePath(filePath);
        const content = fs.readFileSync(safeFilePath, 'utf8');
        if (!content.includes(oldText)) {
            return `Error: Text not found in ${filePath}`;
        }
        const newContent = content.replace(oldText, newText);
        fs.writeFileSync(safeFilePath, newContent, 'utf8');
        return `Edited ${filePath}`;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

module.exports = {
    TOOLS,
    ToolHandlers: {
        bash: runBash,
        read_file: runRead,
        write_file: runWrite,
        edit_file: runEdit
    }
};