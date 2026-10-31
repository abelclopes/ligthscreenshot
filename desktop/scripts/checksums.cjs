const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const files = fs.readdirSync('dist').filter(name => /\.(exe|AppImage|deb|tar\.gz|dmg|zip)$/.test(name));
if (!files.length) throw new Error('No packages generated');
const lines = files.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join('dist', name))).digest('hex')}  ${name}`);
fs.writeFileSync('dist/SHA256SUMS.txt', lines.join('\n') + '\n');
console.log(lines.join('\n'));
