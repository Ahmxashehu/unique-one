const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (code.includes('import MessagesPage from "./pages/MessagesPage";')) {
  code = code.replace('import MessagesPage from "./pages/MessagesPage";', 'import MessagesPage from "./pages/messages/MessagesPage";');
} else if (!code.includes('import MessagesPage from "./pages/messages/MessagesPage";')) {
  code = code.replace('import ProfilePage from "./pages/ProfilePage";', 'import ProfilePage from "./pages/ProfilePage";\nimport MessagesPage from "./pages/messages/MessagesPage";');
}

// In App.tsx, the MessagesPage route might need `/*` if not already set.
code = code.replace('<Route path="messages" element={<MessagesPage />} />', '<Route path="messages/*" element={<MessagesPage />} />');
code = code.replace('<Route path="messages/*" element={<MessagesPage />} />', '<Route path="messages/*" element={<MessagesPage />} />'); // Dedup just in case

fs.writeFileSync('src/App.tsx', code);
