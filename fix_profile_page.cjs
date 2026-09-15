const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfilePage.tsx', 'utf8');

code = code.replace(
  '<div>\n          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Unified Profile</h1>',
  `<div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Unified Profile</h1>
          <div className="mt-2 mb-2">
             <Link to="/os/messages" className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors inline-flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4" /> Message User
             </Link>
          </div>`
);

if (!code.includes('import { MessageSquare }')) {
  code = code.replace('import { Camera, Save, Loader2, Link as LinkIcon, User as UserIcon } from \'lucide-react\';', 'import { Camera, Save, Loader2, Link as LinkIcon, User as UserIcon, MessageSquare } from \'lucide-react\';\nimport { Link } from \'react-router-dom\';');
}

fs.writeFileSync('src/pages/ProfilePage.tsx', code);
