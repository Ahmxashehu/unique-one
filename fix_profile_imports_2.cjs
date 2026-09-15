const fs = require('fs');
let code = fs.readFileSync('src/pages/ProfilePage.tsx', 'utf8');

if (!code.includes("import { Link } from 'react-router-dom';")) {
  code = code.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport { Link } from 'react-router-dom';");
}

if (!code.includes("MessageSquare")) {
  code = code.replace("import { User, Mail, Phone, MapPin, BadgeCheck, Clock, Save, Loader2, ShieldCheck, Hash } from 'lucide-react';", "import { User, Mail, Phone, MapPin, BadgeCheck, Clock, Save, Loader2, ShieldCheck, Hash, MessageSquare } from 'lucide-react';");
}

fs.writeFileSync('src/pages/ProfilePage.tsx', code);
