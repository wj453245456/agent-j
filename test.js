const { TOOLS, ToolHandlers } = require('./src/utils/tools.js');


// 在Windows中，date命令需要/t参数才能直接显示日期
console.log(ToolHandlers.write_file({filePath: 'date.txt', content: '2023-08-01 12:00:00'}))
