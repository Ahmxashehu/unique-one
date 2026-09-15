const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace("import { doc, getDoc } from 'firebase/firestore';", "import { doc, getDoc, onSnapshot } from 'firebase/firestore';");

const oldEffect = `  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UniqueUser);
          } else {
            // User exists in Auth but not Firestore yet (e.g. during registration flow)
            console.warn("User document not found in Firestore.");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);`;

const newEffect = `  useEffect(() => {
    let unsubsribeSnapshot: (() => void) | null = null;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          unsubsribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
             if (docSnap.exists()) {
               setUserData(docSnap.data() as UniqueUser);
             } else {
               console.warn("User document not found in Firestore.");
             }
          });
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        if (unsubsribeSnapshot) {
           unsubsribeSnapshot();
        }
        setUserData(null);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubsribeSnapshot) unsubsribeSnapshot();
    };
  }, []);`;

code = code.replace(oldEffect, newEffect);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
