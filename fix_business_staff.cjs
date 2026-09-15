const fs = require('fs');
let code = fs.readFileSync('src/pages/business/StaffPage.tsx', 'utf8');

code = code.replace(
  '<Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />',
  `
        <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-slate-900">John Doe</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">Manager</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">Lagos Branch</p>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900"></span>
            <Link to="/os/messages/new?staff=JohnDoe" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Message Staff
            </Link>
          </div>
        </div>
        <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />`
);

if (!code.includes('import { MessageSquare }')) {
  code = code.replace('import { Users, Plus, Shield } from \'lucide-react\';', 'import { Users, Plus, Shield, MessageSquare } from \'lucide-react\';\nimport { Link } from \'react-router-dom\';');
}

fs.writeFileSync('src/pages/business/StaffPage.tsx', code);
