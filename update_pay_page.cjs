const fs = require('fs');
let code = fs.readFileSync('src/pages/PayPage.tsx', 'utf8');

// Update Send Money button
code = code.replace(
  '<button className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">',
  '<Link to="/os/pay/send" className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">'
);
code = code.replace('Send Money\n              </button>', 'Send Money\n              </Link>');

// Add Receive Money quick link (replace Help)
code = code.replace(
  '<button className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors text-center text-sm font-medium text-slate-700">\n               <HelpCircle className="w-6 h-6 text-slate-400" />\n               Help\n             </button>',
  '<Link to="/os/pay/receive" className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-colors text-center text-sm font-medium text-slate-700">\n               <Wallet className="w-6 h-6 text-slate-600" />\n               Receive\n             </Link>'
);

// Add security/settings links to the top bar
const headerReplacement = `
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">UniquePay Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your payments, invoices, and receipts securely.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/os/pay/security" className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
            <ShieldCheck className="w-5 h-5" />
          </Link>
          <Link to="/os/pay/settings" className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>
`;
code = code.replace(/<div>\s*<h1 className="text-2xl font-bold tracking-tight text-slate-900">UniquePay Dashboard<\/h1>\s*<p className="text-sm text-slate-500 mt-1">Manage your payments, invoices, and receipts securely\.<\/p>\s*<\/div>/, headerReplacement);

if (!code.includes('import { Settings, ShieldCheck')) {
  code = code.replace('import { Wallet, ArrowUpRight, ArrowDownRight, FileText, Receipt, ShieldCheck, HelpCircle } from \'lucide-react\';', 'import { Wallet, ArrowUpRight, ArrowDownRight, FileText, Receipt, ShieldCheck, HelpCircle, Settings } from \'lucide-react\';');
}

fs.writeFileSync('src/pages/PayPage.tsx', code);
