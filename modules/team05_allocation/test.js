const fs = require('fs');
let content = fs.readFileSync('/Users/avinash/Desktop/team05_allocation/module.js', 'utf8');

content = content.replace("resetData();\n            renderUI();", "console.log('RESET CLICKED');\n            resetData();\n            renderUI();\n            console.log('RESET COMPLETE', isAllocated, blocks.length);");

fs.writeFileSync('/Users/avinash/Desktop/team05_allocation/module.js', content);
console.log('Injected console logs');
