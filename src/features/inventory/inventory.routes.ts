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

// ── Categories ──────────────────────────────────────────────────────────────
router.get('/categories', inventoryController.getAllCategories);

// ── Inventory Items ─────────────────────────────────────────────────────────
router.get('/items', inventoryController.getAllItems);
router.get('/items/:id', inventoryController.getItemById);
router.post('/items', requireRole('dept_head', 'super_admin'), inventoryController.createItem);
router.put('/items/:id', requireRole('dept_head', 'super_admin'), inventoryController.updateItem);
router.delete('/items/:id', requireRole('dept_head', 'super_admin'), inventoryController.deleteItem);

// ── Store Requests ──────────────────────────────────────────────────────────
// Users can view their own requests
router.get('/store-requests/my', inventoryController.getMyStoreRequests);
// Admins can view all requests
router.get('/store-requests', requireRole('dept_head', 'super_admin'), inventoryController.getAllStoreRequests);
// Anyone can view a specific request (provided they are the requester or admin – controller will enforce)
router.get('/store-requests/:id', inventoryController.getStoreRequestById);
// Anyone can create a request
router.post('/store-requests', requireRole('staff', 'dept_head', 'super_admin'), inventoryController.createStoreRequest);
// Admins can approve/reject
router.put('/store-requests/:id', requireRole('dept_head', 'super_admin'), inventoryController.updateStoreRequest);
// Store staff (admins) can issue items
router.put('/store-requests/:id/issue', requireRole('dept_head', 'super_admin'), inventoryController.issueStoreRequest);
// Requester can confirm receipt (staff or admin; controller checks ownership)
router.put('/store-requests/:id/receive', requireRole('staff', 'dept_head', 'super_admin'), inventoryController.receiveStoreRequest);
// Admin can delete
router.delete('/store-requests/:id', requireRole('dept_head', 'super_admin'), inventoryController.deleteStoreRequest);

// ── Procurement Requests ────────────────────────────────────────────────────
// Users can view their own procurement requests
router.get('/procurement-requests/my', inventoryController.getMyProcurementRequests);
// Admins can view all procurement requests
router.get('/procurement-requests', requireRole('dept_head', 'super_admin'), inventoryController.getAllProcurementRequests);
// Anyone can view a specific procurement request (controller may enforce ownership)
router.get('/procurement-requests/:id', inventoryController.getProcurementRequestById);
// Anyone can create a procurement request (storekeeper, etc.)
router.post('/procurement-requests', requireRole('staff', 'dept_head', 'super_admin'), inventoryController.createProcurementRequest);
// Generate memo and submit request for approval
router.post('/procurement-requests/:id/memo', requireRole('staff', 'dept_head', 'super_admin'), inventoryController.submitProcurementMemo);
// Only admins can update/delete
router.put('/procurement-requests/:id', requireRole('dept_head', 'super_admin'), inventoryController.updateProcurementRequest);
router.delete('/procurement-requests/:id', requireRole('dept_head', 'super_admin'), inventoryController.deleteProcurementRequest);

// ── Approved Procurement ────────────────────────────────────────────────────
router.get('/approved', requireRole('dept_head', 'super_admin'), inventoryController.getAllApprovedProcurement);
router.get('/approved/:id', requireRole('dept_head', 'super_admin'), inventoryController.getApprovedProcurementById);
router.post('/approved', requireRole('dept_head', 'super_admin'), inventoryController.createApprovedProcurement);
router.put('/approved/:id/purchase', requireRole('dept_head', 'super_admin'), inventoryController.markProcurementPurchased);

export default router;