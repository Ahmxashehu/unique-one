const fs = require('fs');
let code = fs.readFileSync('src/pages/business/BusinessCustomersPage.tsx', 'utf8');

code = code.replace(
  '<Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />',
  `
        <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-slate-900">Ahmxashehu</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">Active</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">Retail Customer</p>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900"></span>
            <Link to="/os/messages/new?customer=Ahmxashehu" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Message Customer
            </Link>
          </div>
        </div>
        <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />`
);

if (!code.includes('import { MessageSquare }')) {
  code = code.replace('import { Users, Plus } from \'lucide-react\';', 'import { Users, Plus, MessageSquare } from \'lucide-react\';\nimport { Link } from \'react-router-dom\';');
}

fs.writeFileSync('src/pages/business/BusinessCustomersPage.tsx', code);
