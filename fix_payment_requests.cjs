const fs = require('fs');
let code = fs.readFileSync('src/pages/PaymentRequestsPage.tsx', 'utf8');

code = code.replace(
  '<Receipt className="w-12 h-12 text-slate-400 mx-auto mb-4" />',
  `
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-slate-900">PAY-1122</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-md">Pending</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">Payment request for web development services.</p>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900">₦150,000</span>
              <Link to="/os/messages/new?payment=PAY-1122" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> Discuss Payment
              </Link>
            </div>
          </div>
          <Receipt className="w-12 h-12 text-slate-400 mx-auto mb-4" />`
);

if (!code.includes('import { MessageSquare }')) {
  code = code.replace('import { Receipt, Search, Plus } from \'lucide-react\';', 'import { Receipt, Search, Plus, MessageSquare } from \'lucide-react\';');
}

fs.writeFileSync('src/pages/PaymentRequestsPage.tsx', code);
