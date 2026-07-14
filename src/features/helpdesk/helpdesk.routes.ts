import { Router } from 'express';
import { helpDeskController } from './helpdesk.controller';
import { protect, requireRole } from '../../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(protect);

// ─── Stats & Audit ──────────────────────────────────────────────────────────
router.get('/stats', helpDeskController.getStats);
router.get('/audit', helpDeskController.getAuditLog);

// ─── Reports ─────────────────────────────────────────────────────────────────
router.get('/reports/dsa', helpDeskController.getDSAReport);
router.get('/reports/dsa/export', helpDeskController.exportDSAReport);

// ─── Judge Utilities ─────────────────────────────────────────────────────────
router.get('/utilities', helpDeskController.getAllUtilities);
router.get('/utilities/:id', helpDeskController.getUtilityById);
router.post('/utilities', requireRole('dept_head', 'super_admin'), helpDeskController.createUtility);
router.post('/utilities/:id/items', requireRole('dept_head', 'super_admin'), helpDeskController.addUtilityItem);
router.put('/utilities/:id/items/:itemId', requireRole('dept_head', 'super_admin'), helpDeskController.updateUtilityItem);
router.delete('/utilities/:id/items/:itemId', requireRole('super_admin'), helpDeskController.deleteUtilityItem);
router.delete('/utilities/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteUtility);

// ─── Club Membership ─────────────────────────────────────────────────────────
router.get('/club', helpDeskController.getAllClubMemberships);
router.get('/club/:id', helpDeskController.getClubMembershipById);
router.post('/club', requireRole('dept_head', 'super_admin'), helpDeskController.createClubMembership);
router.put('/club/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateClubMembershipStatus);
router.delete('/club/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteClubMembership);

// ─── Circuits ────────────────────────────────────────────────────────────────
router.get('/circuits', helpDeskController.getAllCircuits);
router.get('/circuits/:id', helpDeskController.getCircuitById);
router.post('/circuits', requireRole('dept_head', 'super_admin'), helpDeskController.createCircuit);
router.put('/circuits/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateCircuitStatus);
router.put('/circuits/:id/dsa-details', requireRole('dept_head', 'super_admin'), helpDeskController.updateCircuitDSADetails);
router.delete('/circuits/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteCircuit);

// ─── Special Benches ────────────────────────────────────────────────────────
router.get('/benches', helpDeskController.getAllBenches);
router.get('/benches/:id', helpDeskController.getBenchById);
router.post('/benches', requireRole('dept_head', 'super_admin'), helpDeskController.createBench);
router.put('/benches/:id', requireRole('dept_head', 'super_admin'), helpDeskController.updateBench);
router.put('/benches/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateBenchStatus);
router.delete('/benches/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteBench);

// ─── Part-Heards ─────────────────────────────────────────────────────────────
router.get('/part-heards', helpDeskController.getAllPartHeards);
router.get('/part-heards/:id', helpDeskController.getPartHeardById);
router.post('/part-heards', requireRole('dept_head', 'super_admin'), helpDeskController.createPartHeard);
router.put('/part-heards/:id', requireRole('dept_head', 'super_admin'), helpDeskController.updatePartHeard);
router.put('/part-heards/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updatePartHeardStatus);
router.delete('/part-heards/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deletePartHeard);

// ─── Service Weeks ──────────────────────────────────────────────────────────
router.get('/service-weeks', helpDeskController.getAllServiceWeeks);
router.get('/service-weeks/:id', helpDeskController.getServiceWeekById);
router.post('/service-weeks', requireRole('dept_head', 'super_admin'), helpDeskController.createServiceWeek);
router.put('/service-weeks/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateServiceWeekStatus);
router.delete('/service-weeks/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteServiceWeek);

// ─── Medical Expense Claims ──────────────────────────────────────────────────
router.get('/medical-claims', helpDeskController.getAllMedicalClaims);
router.get('/medical-claims/:id', helpDeskController.getMedicalClaimById);
router.post('/medical-claims', requireRole('dept_head', 'super_admin'), helpDeskController.createMedicalClaim);
router.put('/medical-claims/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateMedicalClaimStatus);
router.delete('/medical-claims/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteMedicalClaim);

// ─── General Requests ────────────────────────────────────────────────────────
router.get('/general-requests', helpDeskController.getAllGeneralRequests);
router.get('/general-requests/:id', helpDeskController.getGeneralRequestById);
router.post('/general-requests', requireRole('dept_head', 'super_admin'), helpDeskController.createGeneralRequest);
router.put('/general-requests/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateGeneralRequestStatus);
router.delete('/general-requests/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteGeneralRequest);

// ─── Visa Support ────────────────────────────────────────────────────────────
router.get('/visa', helpDeskController.getAllVisaRequests);
router.get('/visa/:id', helpDeskController.getVisaRequestById);
router.post('/visa', requireRole('dept_head', 'super_admin'), helpDeskController.createVisaRequest);
router.put('/visa/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateVisaStatus);
router.delete('/visa/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteVisaRequest);

// ─── Visa Document Tracking ─────────────────────────────────────────────────
router.post('/visa/documents/:id/view', helpDeskController.markDocumentViewed);
router.get('/visa/documents/:id/status', helpDeskController.getDocumentViewStatus);

// ─── Protocol Support ────────────────────────────────────────────────────────
router.get('/protocol', helpDeskController.getAllProtocolEvents);
router.get('/protocol/:id', helpDeskController.getProtocolEventById);
router.post('/protocol', requireRole('dept_head', 'super_admin'), helpDeskController.createProtocolEvent);
router.put('/protocol/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateProtocolStatus);
router.delete('/protocol/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteProtocolEvent);

// ─── Other Payments ──────────────────────────────────────────────────────────
router.get('/other-payments', helpDeskController.getAllOtherPayments);
router.get('/other-payments/:id', helpDeskController.getOtherPaymentById);
router.post('/other-payments', requireRole('dept_head', 'super_admin'), helpDeskController.createOtherPayment);
router.put('/other-payments/:id/status', requireRole('dept_head', 'super_admin'), helpDeskController.updateOtherPaymentStatus);
router.put('/other-payments/:id/dsa-details', requireRole('dept_head', 'super_admin'), helpDeskController.updateOtherPaymentDSADetails);
router.delete('/other-payments/:id', requireRole('super_admin', 'dept_head'), helpDeskController.deleteOtherPayment);

export default router;