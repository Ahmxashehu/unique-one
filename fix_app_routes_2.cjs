const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('path="messages/*"')) {
   code = code.replace('<Route path="messages" element={<MessagesPage />} />', '<Route path="messages/*" element={<MessagesPage />} />');
   fs.writeFileSync('src/App.tsx', code);
}
