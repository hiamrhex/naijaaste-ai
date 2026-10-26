const fs = require('fs');
let content = fs.readFileSync('src/saved_places/store.js', 'utf8');
content = content.replace(".replace(/'/g, ''')", ".replace(/'/g, '&apos;')");
fs.writeFileSync('src/saved_places/store.js', content);
console.log('Fixed');