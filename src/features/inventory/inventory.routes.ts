import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ── Statistics ──────────────────────────────────────────────────────────────
router.get('/stats', inventoryController.getStats);

// ── Activity Log ────────────────────────────────────────────────────────────
router.get('/activity-log', inventoryController.getActivityLog);

// ── Inventory Items ─────────────────────────────────────────────────────────
router.get('/items', inventoryController.getAllItems);
router.get('/items/:id', inventoryController.getItemById);
router.post('/items', requireRole(['dept_head', 'super_admin']), inventoryController.createItem);
router.put('/items/:id', requireRole(['dept_head', 'super_admin']), inventoryController.updateItem);
router.delete('/items/:id', requireRole(['dept_head', 'super_admin']), inventoryController.deleteItem);

// ── Store Requests ──────────────────────────────────────────────────────────
// Users can view their own requests
router.get('/store-requests/my', inventoryController.getMyStoreRequests);
// Admins can view all requests
router.get('/store-requests', requireRole(['dept_head', 'super_admin']), inventoryController.getAllStoreRequests);
router.get('/store-requests/:id', requireRole(['dept_head', 'super_admin']), inventoryController.getStoreRequestById);
// Anyone can create a request
router.post('/store-requests', requireRole(['staff', 'dept_head', 'super_admin']), inventoryController.createStoreRequest);
// Only admins can update/delete
router.put('/store-requests/:id', requireRole(['dept_head', 'super_admin']), inventoryController.updateStoreRequest);
router.delete('/store-requests/:id', requireRole(['dept_head', 'super_admin']), inventoryController.deleteStoreRequest);

// ── Procurement Requests ────────────────────────────────────────────────────
// Users can view their own procurement requests
router.get('/procurement-requests/my', inventoryController.getMyProcurementRequests);
// Admins can view all procurement requests
router.get('/procurement-requests', requireRole(['dept_head', 'super_admin']), inventoryController.getAllProcurementRequests);
router.get('/procurement-requests/:id', requireRole(['dept_head', 'super_admin']), inventoryController.getProcurementRequestById);
// Anyone can create a procurement request
router.post('/procurement-requests', requireRole(['staff', 'dept_head', 'super_admin']), inventoryController.createProcurementRequest);
// Only admins can update/delete
router.put('/procurement-requests/:id', requireRole(['dept_head', 'super_admin']), inventoryController.updateProcurementRequest);
router.delete('/procurement-requests/:id', requireRole(['dept_head', 'super_admin']), inventoryController.deleteProcurementRequest);

// ── Approved Procurement ────────────────────────────────────────────────────
router.get('/approved', requireRole(['dept_head', 'super_admin']), inventoryController.getAllApprovedProcurement);
router.get('/approved/:id', requireRole(['dept_head', 'super_admin']), inventoryController.getApprovedProcurementById);
router.post('/approved', requireRole(['dept_head', 'super_admin']), inventoryController.createApprovedProcurement);
router.put('/approved/:id/purchase', requireRole(['dept_head', 'super_admin']), inventoryController.markProcurementPurchased);

export default router;