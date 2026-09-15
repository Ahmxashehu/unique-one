const fs = require('fs');
let code = fs.readFileSync('src/layouts/PublicLayout.tsx', 'utf8');

if (!code.includes('useAuth')) {
  code = code.replace(
    "import { cn } from '../lib/utils';",
    "import { cn } from '../lib/utils';\nimport { useAuth } from '../contexts/AuthContext';"
  );
}

code = code.replace(
  'export default function PublicLayout() {',
  'export default function PublicLayout() {\n  const { currentUser } = useAuth();'
);

const loginButtons = `<div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">Log in</Link>
            <Link to="/register" className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors">
              Sign Up
            </Link>
          </div>`;

const newAuthButtons = `<div className="flex items-center gap-3">
            {currentUser ? (
              <Link to="/os/dashboard" className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">Log in</Link>
                <Link to="/register" className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors">
                  Sign Up
                </Link>
              </>
            )}
          </div>`;

code = code.replace(loginButtons, newAuthButtons);

fs.writeFileSync('src/layouts/PublicLayout.tsx', code);
