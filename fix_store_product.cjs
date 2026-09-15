const fs = require('fs');
let code = fs.readFileSync('src/pages/store/StoreProductPage.tsx', 'utf8');

code = code.replace(
  '<MessageSquare className="w-4 h-4" /> Ask Seller',
  '<MessageSquare className="w-4 h-4" /> Message Seller'
);

code = code.replace(
  '<button className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex justify-center items-center gap-2">',
  '<Link to={`/os/messages/new?product=${product.id}&seller=${product.sellerId}`} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex justify-center items-center gap-2">'
);

code = code.replace(
  '<MessageSquare className="w-4 h-4" /> Message Seller\n              </button>',
  '<MessageSquare className="w-4 h-4" /> Message Seller\n              </Link>'
);

fs.writeFileSync('src/pages/store/StoreProductPage.tsx', code);
