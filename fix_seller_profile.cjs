const fs = require('fs');
let code = fs.readFileSync('src/pages/store/StoreSellerProfilePage.tsx', 'utf8');

code = code.replace(
  '<button className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">\n              <MessageSquare className="w-4 h-4" /> Message Seller\n            </button>',
  '<Link to={`/os/messages/new?seller=${id}`} className="w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">\n              <MessageSquare className="w-4 h-4" /> Message Seller\n            </Link>'
);

if (!code.includes('import { Link }')) {
  code = code.replace('import { useParams } from \'react-router-dom\';', 'import { useParams, Link } from \'react-router-dom\';');
}

fs.writeFileSync('src/pages/store/StoreSellerProfilePage.tsx', code);
