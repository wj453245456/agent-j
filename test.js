import { taskHandler } from "./src/utils/task.js";
const tasks = await taskHandler.task_list()
console.log(tasks)
