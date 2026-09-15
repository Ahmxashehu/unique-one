const fs = require('fs');
let code = fs.readFileSync('src/pages/messages/MessagesPage.tsx', 'utf8');

code = code.replace(
  'import ChatView from \'./ChatView\';',
  'import ChatView from \'./ChatView\';\nimport NewMessagePage from \'./NewMessagePage\';'
);

const oldDesktopRouting = `
        <Routes>
          <Route path="/" element={<MessagesCenter />} />
          <Route path="/:id" element={
`;
const newDesktopRouting = `
        <Routes>
          <Route path="/" element={<MessagesCenter />} />
          <Route path="/new" element={
            <div className="flex h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8">
              <div className="w-80 lg:w-96 shrink-0 z-10 relative bg-white border-r border-slate-200">
                <MessagesCenter />
              </div>
              <div className="flex-1 min-w-0 bg-slate-50 relative z-20 p-4 md:p-6 lg:p-8 h-full">
                <NewMessagePage />
              </div>
            </div>
          } />
          <Route path="/:id" element={
`;

code = code.replace(oldDesktopRouting, newDesktopRouting);

const oldMobileRouting = `
        <Routes>
          <Route path="/" element={<MessagesCenter />} />
          <Route path="/:id" element={<ChatView />} />
        </Routes>
`;
const newMobileRouting = `
        <Routes>
          <Route path="/" element={<MessagesCenter />} />
          <Route path="/new" element={<NewMessagePage />} />
          <Route path="/:id" element={<ChatView />} />
        </Routes>
`;

code = code.replace(oldMobileRouting, newMobileRouting);

fs.writeFileSync('src/pages/messages/MessagesPage.tsx', code);
