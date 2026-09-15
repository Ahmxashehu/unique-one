const fs = require('fs');
let code = fs.readFileSync('src/pages/messages/MessagesPage.tsx', 'utf8');

const replacement = `
export default function MessagesPage() {
  const location = useLocation();
  const isRoot = location.pathname === '/os/messages';
  
  return (
    <div className="h-full">
      <div className="hidden md:block h-full">
        <Routes>
          <Route path="/" element={<MessagesCenter />} />
          <Route path="/:id" element={
            <div className="flex h-[calc(100vh-64px)] -m-4 md:-m-6 lg:-m-8">
              <div className="w-80 lg:w-96 shrink-0 z-10 relative bg-white">
                <MessagesCenter />
              </div>
              <div className="flex-1 min-w-0 bg-slate-50 relative z-20">
                <div className="p-4 md:p-6 lg:p-8 h-full">
                  <ChatView />
                </div>
              </div>
            </div>
          } />
        </Routes>
      </div>
      
      <div className="md:hidden h-full">
        <Routes>
          <Route path="/" element={<MessagesCenter />} />
          <Route path="/:id" element={<ChatView />} />
        </Routes>
      </div>
    </div>
  );
}
`;

code = code.replace(/export default function MessagesPage\(\) \{[\s\S]*\}\n/m, replacement);
fs.writeFileSync('src/pages/messages/MessagesPage.tsx', code);
