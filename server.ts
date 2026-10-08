    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Restaurant order creation failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Restaurant order could not be created. Your checkout details were not lost.');
    }
  });

  app.post("/api/restaurant/orders/:orderId/status", authenticate, rateLimit({
    windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false,
    store: createFirestoreRateLimitStore('restaurantOrderStatusRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;
      return isSafeFirebaseUid(uid) ? uid : ipKeyGenerator(req.ip);
    },
    handler: (_req, res) => errorResponse(res, 'RATE_LIMITED', 'Too many Restaurant order status attempts.'),
  }), async (req, res) => {
    try {
      const uid = sanitizeRequiredAuthUid((req as any).user?.uid);
      const orderId = typeof req.params.orderId === 'string' ? req.params.orderId.trim() : '';
      const nextStatus = typeof req.body?.status === 'string' ? req.body.status.trim() : '';
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) return errorResponse(res, 'INVALID_REQUEST', 'Invalid Restaurant order ID.');
      // This endpoint is customer-facing and must never grant fulfillment authority.
      // Merchant/restaurant staff use the protected business status endpoint below.
      const allowed: Record<string, string[]> = {
        paid: ['cancelled'],
        accepted: ['cancelled'],
      };
      const orderRef = adminDb.collection('restaurantOrders').doc(orderId);
      const now = Timestamp.now();
      let refundRequired = false;
      await adminDb.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new RequestValidationError('NOT_FOUND', 'Restaurant order not found.');
        const order = orderSnap.data() as Record<string, any>;
        const current = String(order.status || '');
        const actorIsCustomer = order.customerId === uid;
        const actorIsOwner = Boolean(order.businessId && order.restaurantId && order.branchId) && false;
        if (!actorIsCustomer) throw new RequestValidationError('FORBIDDEN', 'Only the customer may cancel a Restaurant order through this endpoint.');
        if (String(order.paymentStatus || '') !== 'paid' && nextStatus !== 'cancelled') {
          throw new RequestValidationError('INVALID_STATE', 'Only paid Restaurant orders can enter fulfilment.');
        }
        if (!allowed[current]?.includes(nextStatus) || (nextStatus !== 'cancelled' && !actorIsCustomer)) throw new RequestValidationError('INVALID_STATE', 'Invalid Restaurant order status transition.');
        transaction.update(orderRef, {
          status: nextStatus,
          updatedAt: now,
          orderTimeline: [...(Array.isArray(order.orderTimeline) ? order.orderTimeline : []), { status: nextStatus, at: now }],
        });
        transaction.create(adminDb.collection('audit_logs').doc(), {
          action: 'restaurant.order.status_changed', actorUid: uid, resource: 'restaurant_order', resourceId: orderId,
          restaurantId: String(order.restaurantId || ''), businessId: String(order.businessId || ''), branchId: String(order.branchId || ''),
          details: { previousStatus: current, newStatus: nextStatus }, timestamp: now,
        });
      });
      return res.json({ ok: true, orderId, status: nextStatus });
    } catch (error) {
      if (error instanceof RequestValidationError) return errorResponse(res, error.code, error.message);
      console.error('Restaurant order status update failed:', error);
      return errorResponse(res, 'SERVICE_UNAVAILABLE', 'Restaurant order status is temporarily unavailable.');
    }
  });

  app.post("/api/restaurant/orders/:orderId/cancel", authenticate, rateLimit({
    windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false,
    store: createFirestoreRateLimitStore('restaurantOrderCancellationRateLimits', 60_000),
    keyGenerator: (req) => {
      const uid = (req as any).user?.uid;