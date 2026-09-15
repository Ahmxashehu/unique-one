const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfilePage.tsx', 'utf8');

if (!code.includes("import { Link } from 'react-router-dom';")) {
  code = code.replace("import { Camera, Save, Loader2, Link as LinkIcon, User as UserIcon } from 'lucide-react';", 
    "import { Camera, Save, Loader2, Link as LinkIcon, User as UserIcon, MessageSquare } from 'lucide-react';\nimport { Link } from 'react-router-dom';");
} else if (!code.includes("MessageSquare")) {
   code = code.replace("import { Camera, Save, Loader2, Link as LinkIcon, User as UserIcon } from 'lucide-react';", 
    "import { Camera, Save, Loader2, Link as LinkIcon, User as UserIcon, MessageSquare } from 'lucide-react';");
}

fs.writeFileSync('src/pages/ProfilePage.tsx', code);
