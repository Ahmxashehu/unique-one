const fs = require('fs');
let code = fs.readFileSync('src/pages/business/SuppliersPage.tsx', 'utf8');

code = code.replace(
  '<Truck className="w-12 h-12 text-slate-400 mx-auto mb-4" />',
  `
        <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
          <div className="flex justify-between items-start mb-2">
            <span className="font-bold text-slate-900">Agro Farms Ltd</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">Verified</span>
          </div>
          <p className="text-sm text-slate-600 mb-4">Supplier • Fresh Produce</p>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-900"></span>
            <Link to="/os/messages/new?supplier=AgroFarmsLtd" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
              <MessageSquare className="w-4 h-4" /> Message Supplier
            </Link>
          </div>
        </div>
        <Truck className="w-12 h-12 text-slate-400 mx-auto mb-4" />`
);

if (!code.includes('import { MessageSquare }')) {
  code = code.replace('import { Truck, Plus } from \'lucide-react\';', 'import { Truck, Plus, MessageSquare } from \'lucide-react\';\nimport { Link } from \'react-router-dom\';');
}

fs.writeFileSync('src/pages/business/SuppliersPage.tsx', code);
