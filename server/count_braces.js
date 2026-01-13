
const fs = require('fs');
const content = fs.readFileSync('server/index.js', 'utf8');
const lines = content.split('\n');

let balance = 0;
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
        if (char === '{') balance++;
        if (char === '}') balance--;
    }
    // Check around line 226
    if (i === 225) { // 0-indexed, so this is line 226
        console.log(`Line 226 finish balance: ${balance}`);
    }
    if (i === 231) { // Line 232
        console.log(`Line 232 finish balance: ${balance}`);
    }
}
console.log(`Final balance: ${balance}`);
