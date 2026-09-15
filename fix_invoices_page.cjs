const fs = require('fs');
let code = fs.readFileSync('src/pages/InvoicesPage.tsx', 'utf8');

code = code.replace(
  '<FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />',
  `
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-slate-900">INV-2026-001</span>
              <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">Sent</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">To: Unique Solutions Ltd</p>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900">₦250,000</span>
              <Link to="/os/messages/new?invoice=INV-2026-001" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> Discuss Invoice
              </Link>
            </div>
          </div>
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />`
);

if (!code.includes('import { MessageSquare }')) {
  code = code.replace('import { FileText, Search, Plus } from \'lucide-react\';', 'import { FileText, Search, Plus, MessageSquare } from \'lucide-react\';');
}

fs.writeFileSync('src/pages/InvoicesPage.tsx', code);
