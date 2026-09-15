const fs = require('fs');
let code = fs.readFileSync('src/pages/business/SellerDashboardPage.tsx', 'utf8');

if (!code.includes('Team Chat')) {
  code = code.replace(
    '<Link to="/os/business/finance" className="text-sm text-blue-600 font-medium hover:underline">View Ledger</Link>',
    '<Link to="/os/business/finance" className="text-sm text-blue-600 font-medium hover:underline">View Ledger</Link>\n              <Link to="/os/messages/new?context=team" className="ml-4 text-sm text-blue-600 font-medium hover:underline">Team Chat</Link>'
  );
  fs.writeFileSync('src/pages/business/SellerDashboardPage.tsx', code);
}
