import { exec } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const WORKDIR = process.cwd();

class BackgroundManager {
    constructor() {
        this.tasks = {}; // task_id -> {status, result, command}
        this._notificationQueue = []; // completed task results
        this._lock = false;
    }

    run(command) {
        /** Start a background task, return task_id immediately. */
        const taskId = uuidv4().substring(0, 8);
        this.tasks[taskId] = { status: 'running', result: null, command };

        // 异步执行命令
        this._execute(taskId, command);

        return `Background task ${taskId} started: ${command.substring(0, 80)}`;
    }

    _execute(taskId, command) {
        /** Execute command, capture output, push to queue. */
        exec(command, {
            cwd: WORKDIR,
            timeout: 300000, // 300秒超时
            maxBuffer: 50000 * 1024 // 50MB缓冲区
        }, (error, stdout, stderr) => {
            let output, status;

            if (error) {
                if (error.killed && error.signal === 'SIGTERM') {
                    output = 'Error: Timeout (300s)';
                    status = 'timeout';
                } else {
                    output = `Error: ${error.message}`;
                    status = 'error';
                }
            } else {
                output = (stdout + stderr).trim().substring(0, 50000);
                status = 'completed';
            }

            this.tasks[taskId].status = status;
            this.tasks[taskId].result = output || '(no output)';

            // 线程安全地添加到通知队列
            while (this._lock) {
                // 简单的自旋锁
            }
            this._lock = true;
            this._notificationQueue.push({
                task_id: taskId,
                status,
                command: command.substring(0, 80),
                result: (output || '(no output)').substring(0, 500),
            });
            this._lock = false;
        });
    }

    check(taskId = null) {
        /** Check status of one task or list all. */
        if (taskId) {
            const t = this.tasks[taskId];
            if (!t) {
                return `Error: Unknown task ${taskId}`;
            }
            return `[${t.status}] ${t.command.substring(0, 60)}\n${t.result || '(running)'}`;
        }

        const lines = [];
        for (const [tid, t] of Object.entries(this.tasks)) {
            lines.push(`${tid}: [${t.status}] ${t.command.substring(0, 60)}`);
        }

        return lines.length > 0 ? lines.join('\n') : 'No background tasks.';
    }

    drainNotifications() {
        /** Return and clear all pending completion notifications. */
        while (this._lock) {
            // 简单的自旋锁
        }
        this._lock = true;
        const notifications = [...this._notificationQueue];
        this._notificationQueue = [];
        this._lock = false;

        return notifications;
    }
}

// 导出单例
const BACKGROUND = new BackgroundManager();
export default BACKGROUND;

export const backgroundHandler = {
    background_run: ({command}) => BACKGROUND.run(command),
    background_check: ({taskId}) => BACKGROUND.check(taskId),
}
export const backgroundTools = [
    {
        "name": "background_run", "description": "Run command in background thread. Returns task_id immediately.",
        "input_schema": { "type": "object", "properties": { "command": { "type": "string" } }, "required": ["command"] }
    },
    {
        "name": "background_check", "description": "Check background task status. Omit task_id to list all.",
        "input_schema": { "type": "object", "properties": { "task_id": { "type": "string" } } }
    },
]