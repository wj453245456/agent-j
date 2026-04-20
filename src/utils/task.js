import fs from 'fs';
import path from 'path';

const TASKS_DIR = path.join(process.cwd(), '.tasks');

class TaskManager {
    constructor(tasksDir) {
        this.dir = tasksDir;
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true });
        }
        this._nextId = this._maxId() + 1;
    }

    _maxId() {
        const files = fs.readdirSync(this.dir).filter(file => file.match(/^task_\d+\.json$/));
        const ids = files.map(file => parseInt(file.split('_')[1].split('.')[0]));
        return ids.length > 0 ? Math.max(...ids) : 0;
    }

    _load(task_id) {
        const taskPath = path.join(this.dir, `task_${task_id}.json`);
        if (!fs.existsSync(taskPath)) {
            throw new Error(`Task ${task_id} not found`);
        }
        return JSON.parse(fs.readFileSync(taskPath, 'utf8'));
    }

    _save(task) {
        const taskPath = path.join(this.dir, `task_${task.id}.json`);
        fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
    }

    create({ subject, description = "" }) {
        const task = {
            id: this._nextId,
            subject,
            description,
            status: "pending",
            blockedBy: [],
            owner: ""
        };
        this._save(task);
        this._nextId++;
        return JSON.stringify(task, null, 2);
    }

    get({ task_id }) {
        return JSON.stringify(this._load(task_id), null, 2);
    }

    update({ task_id, status = null, addBlockedBy = null, removeBlockedBy = null }) {
        const task = this._load(task_id);
        if (status) {
            if (!["pending", "in_progress", "completed"].includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }
            task.status = status;
            if (status === "completed") {
                this._clearDependency(task_id);
            }
        }
        if (addBlockedBy) {
            task.blockedBy = [...new Set([...task.blockedBy, ...addBlockedBy])];
        }
        if (removeBlockedBy) {
            task.blockedBy = task.blockedBy.filter(id => !removeBlockedBy.includes(id));
        }
        this._save(task);
        return JSON.stringify(task, null, 2);
    }

    _clearDependency(completedId) {
        /** Remove completedId from all other tasks' blockedBy lists. */
        const files = fs.readdirSync(this.dir).filter(file => file.match(/^task_\d+\.json$/));
        for (const file of files) {
            const taskPath = path.join(this.dir, file);
            const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
            if (task.blockedBy && task.blockedBy.includes(completedId)) {
                task.blockedBy = task.blockedBy.filter(id => id !== completedId);
                this._save(task);
            }
        }
    }

    listAll() {
        const tasks = [];
        const files = fs.readdirSync(this.dir)
            .filter(file => file.match(/^task_\d+\.json$/))
            .sort((a, b) => {
                const idA = parseInt(a.split('_')[1].split('.')[0]);
                const idB = parseInt(b.split('_')[1].split('.')[0]);
                return idA - idB;
            });

        for (const file of files) {
            const taskPath = path.join(this.dir, file);
            tasks.push(JSON.parse(fs.readFileSync(taskPath, 'utf8')));
        }

        if (tasks.length === 0) {
            return "No tasks.";
        }

        const lines = [];
        for (const task of tasks) {
            const marker = {
                "pending": "[ ]",
                "in_progress": "[>]",
                "completed": "[x]"
            }[task.status] || "[?]";
            const blocked = task.blockedBy && task.blockedBy.length > 0
                ? ` (blocked by: ${task.blockedBy.join(', ')})`
                : "";
            lines.push(`${marker} #${task.id}: ${task.subject}${blocked}`);
        }
        console.log(lines.join('\n'))
        return lines.join('\n');
    }
}

const TASKS = new TaskManager(TASKS_DIR);

export default TASKS;

export const taskHandler = {
    task_create: TASKS.create.bind(TASKS),
    task_get: TASKS.get.bind(TASKS),
    task_update: TASKS.update.bind(TASKS),
    task_list: TASKS.listAll.bind(TASKS),
}

export const taskTools = [{
    "name": "task_create", "description": "Create a new task.",
    "input_schema": { "type": "object", "properties": { "subject": { "type": "string" }, "description": { "type": "string" } }, "required": ["subject"] }
},
{
    "name": "task_update", "description": "Update a task's status or dependencies.",
    "input_schema": { "type": "object", "properties": { "task_id": { "type": "integer" }, "status": { "type": "string", "enum": ["pending", "in_progress", "completed"] }, "addBlockedBy": { "type": "array", "items": { "type": "integer" } }, "removeBlockedBy": { "type": "array", "items": { "type": "integer" } } }, "required": ["task_id"] }
},
{
    "name": "task_list", "description": "List all tasks with status summary.",
    "input_schema": { "type": "object", "properties": {} }
},
{
    "name": "task_get", "description": "Get full details of a task by ID.",
    "input_schema": { "type": "object", "properties": { "task_id": { "type": "integer" } }, "required": ["task_id"] }
},]