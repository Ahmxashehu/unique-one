        return res.status(200).json({ status: 'declined' });
      }

      const applicantUid = String(application.applicantUid || '');
      const userRef = adminDb.collection('users').doc(applicantUid);
      let joinBusinessId = '';
      if (application.applicationType === 'join_business') {
        const organizationName = typeof application.organizationName === 'string' ? application.organizationName.trim() : '';
        const matches = organizationName
          ? await adminDb.collection('businesses').where('name', '==', organizationName).limit(2).get()
          : null;
        if (!matches || matches.empty) throw new Error('BUSINESS_NOT_FOUND');
        if (matches.size > 1) throw new Error('BUSINESS_AMBIGUOUS');
        joinBusinessId = matches.docs[0].id;
      }
      const businessRef = adminDb.collection('businesses').doc();
      await adminDb.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) throw new Error('APPLICANT_NOT_FOUND');
        const userData = userSnapshot.data() || {};
        const existingRoles = Array.isArray(userData.roles) ? userData.roles.filter((role: unknown): role is string => typeof role === 'string') : [];
        const requestedRole = String(application.requestedRole || 'business_owner');

        if (application.applicationType === 'create_business') {
          transaction.set(businessRef, {
            ownerUid: applicantUid,
            name: application.name,
            registrationNumber: application.registrationNumber || '',
            description: application.description,
            contactEmail: application.contactEmail,
            contactPhone: application.contactPhone,
            categories: [application.category],
            status: 'active',
            verificationStatus: 'verified',
            createdAt: now,
            updatedAt: now,
            approvedAt: now,
            approvedBy: adminUid,
          });
        }

        transaction.update(userRef, {
          roles: Array.from(new Set([...existingRoles, requestedRole])),
          businessAccessApprovedAt: now,
          businessAccessApprovedBy: adminUid,
        });
        const approvedBusinessId = application.applicationType === 'create_business' ? businessRef.id : joinBusinessId;
        transaction.set(adminDb.collection('businessMemberships').doc(applicantUid + '__' + approvedBusinessId), {
          uid: applicantUid,
          businessId: approvedBusinessId,
          role: requestedRole,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          sourceApplicationId: applicationRef.id,
        }, { merge: true });
        transaction.update(applicationRef, {
          status: 'approved',
          reviewNote,
          reviewedBy: adminUid,
          reviewedAt: now,
          updatedAt: now,
          businessId: approvedBusinessId,