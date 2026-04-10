class ToDoTool {
    constructor() {
        this.list = []
    }
    update = ({ tasks }) => {
        if (tasks.length > 10) {
            throw new Error('Todo list is full max 10 items')
        }
        // status : pending | in_progress | completed 只能有一个in_progress
        if (tasks.filter(t => t.status === 'in_progress').length > 1) {
            throw new Error('Only one in_progress item is allowed')
        }
        tasks.forEach(item => {
            if (!['pending', 'in_progress', 'completed'].includes(item.status)) {
                throw new Error(`Status must be one of ['pending', 'in_progress', 'completed']`)
            }
            if (!item.content) {
                throw new Error('Content is required')
            }
            if (!item.id) {
                throw new Error('Id is required')
            }
        })

        this.list = tasks
        return this.doNext()
    }
    doNext = () => {
        if (this.list.length === 0) {
            return 'Todo list is empty'
        }
        let lines = [];
        for (const item of this.list) {
            const marker = { "pending": "[ ]", "in_progress": "[>]", "completed": "[✓]" }[item.status];
            lines.push(`${marker} #${item.id}: ${item.content}`);
        }
        const done = this.list.filter(t => t.status === "completed").length;
        lines.push(`\n(${done}/${this.list.length} completed)`);
        console.log(lines.join('\n'))
        return lines.join('\n')
    }
}

module.exports = ToDoTool