const fs = require('fs');
let code = fs.readFileSync('src/pages/OrdersPage.tsx', 'utf8');

code = code.replace(
  '<div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">',
  `
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6">
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-slate-900">#ORD-5432</span>
              <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">Pending</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">1x Premium White Rice (50kg)</p>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900">₦45,000</span>
              <Link to="/os/messages/new?order=ORD-5432" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
                <MessageSquare className="w-4 h-4" /> Discuss Order
              </Link>
            </div>
          </div>
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">`
);

if (!code.includes('import { Link }')) {
  code = code.replace('import { ShoppingCart, Filter } from \'lucide-react\';', 'import { ShoppingCart, Filter, MessageSquare } from \'lucide-react\';\nimport { Link } from \'react-router-dom\';');
}

fs.writeFileSync('src/pages/OrdersPage.tsx', code);
